'use strict';
/**
 * Capa de datos del IPV (SQLite).
 *
 * Principio: la única fuente de verdad del inventario es `products.stock` más
 * la tabla `stock_movements`. El IPV de cualquier día se CALCULA a partir de
 * los movimientos; no se guarda como filas editables. Así el saldo inicial de
 * hoy es automáticamente el saldo final de ayer y el histórico no cambia.
 *
 * Compatible con Node 16 (Electron 22) y better-sqlite3 8.x.
 */
const Database = require('better-sqlite3');
const crypto = require('crypto');

class DomainError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'DomainError';
    this.code = code;
  }
}

const pad = (n) => String(n).padStart(2, '0');
const localDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const localTime = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const isNum = (n) => typeof n === 'number' && Number.isFinite(n);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/* ------------------------------------------------------------------ */
/* Migraciones: se aplican en orden; PRAGMA user_version guarda el nº. */
/* Nunca edites una migración ya entregada: añade una nueva al final.  */
/* ------------------------------------------------------------------ */
const MIGRATIONS = [
  (db) =>
    db.exec(`
    CREATE TABLE products (
      id         TEXT PRIMARY KEY,
      code       TEXT NOT NULL UNIQUE,
      name       TEXT NOT NULL,
      detail     TEXT NOT NULL DEFAULT '',
      category   TEXT NOT NULL DEFAULT 'General',
      um         TEXT NOT NULL DEFAULT 'Unidad',
      price      REAL NOT NULL DEFAULT 0 CHECK (price >= 0),
      stock      REAL NOT NULL DEFAULT 0 CHECK (stock >= 0),
      min_stock  REAL NOT NULL DEFAULT 0 CHECK (min_stock >= 0),
      provider   TEXT,
      location   TEXT,
      rotation   TEXT,
      last_exit  TEXT,
      created_at TEXT NOT NULL,            -- 'YYYY-MM-DD HH:MM'
      archived   INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE sales (
      id              TEXT PRIMARY KEY,
      ticket_number   INTEGER NOT NULL UNIQUE,
      date            TEXT NOT NULL,       -- 'YYYY-MM-DD' (hora local)
      time            TEXT NOT NULL,       -- 'HH:MM'
      payment_method  TEXT NOT NULL CHECK (payment_method IN ('efectivo','transferencia','mixto')),
      efectivo        REAL NOT NULL DEFAULT 0,
      transferencia   REAL NOT NULL DEFAULT 0,
      total           REAL NOT NULL,
      amount_received REAL,
      change_given    REAL,
      note            TEXT,
      voided_at       TEXT
    );
    CREATE INDEX idx_sales_date ON sales(date);

    CREATE TABLE sale_items (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_id    TEXT NOT NULL REFERENCES sales(id),
      product_id TEXT NOT NULL REFERENCES products(id),
      code       TEXT NOT NULL,
      name       TEXT NOT NULL,
      um         TEXT NOT NULL,
      unit_price REAL NOT NULL,
      quantity   REAL NOT NULL CHECK (quantity > 0),
      subtotal   REAL NOT NULL
    );
    CREATE INDEX idx_items_sale ON sale_items(sale_id);

    -- qty con signo: + aumenta stock, - lo reduce
    CREATE TABLE stock_movements (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id TEXT NOT NULL REFERENCES products(id),
      date       TEXT NOT NULL,
      ts         TEXT NOT NULL,
      type       TEXT NOT NULL CHECK (type IN ('inicial','entrada','venta','anulacion','ajuste')),
      qty        REAL NOT NULL,
      sale_id    TEXT REFERENCES sales(id),
      note       TEXT
    );
    CREATE INDEX idx_mov_date ON stock_movements(date, product_id);
    CREATE INDEX idx_mov_product ON stock_movements(product_id);

    CREATE TABLE day_closes (
      date           TEXT PRIMARY KEY,
      closed_at      TEXT NOT NULL,
      denominations  TEXT NOT NULL,        -- JSON [{id,label,value,count}]
      menores        REAL NOT NULL,
      transferencias REAL NOT NULL,
      total_contado  REAL NOT NULL,
      total_ipv      REAL NOT NULL,
      diferencia     REAL NOT NULL,
      note           TEXT
    );

    CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    INSERT INTO meta (key, value) VALUES ('ticket_seq', '100');
  `),
  (db) => {
    try {
      db.exec('ALTER TABLE products ADD COLUMN almacen_stock REAL NOT NULL DEFAULT 0;');
    } catch {}
  },
  (db) => {
    try {
      db.exec(`
        CREATE TABLE IF NOT EXISTS returns (
          id TEXT PRIMARY KEY,
          return_number TEXT NOT NULL,
          sale_id TEXT,
          ticket_number TEXT,
          date TEXT NOT NULL,
          timestamp TEXT NOT NULL,
          total_refund REAL NOT NULL,
          refund_method TEXT NOT NULL,
          customer_name TEXT,
          reason TEXT,
          has_damaged_items INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS return_items (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          return_id TEXT NOT NULL REFERENCES returns(id),
          product_id TEXT NOT NULL,
          code TEXT NOT NULL,
          name TEXT NOT NULL,
          um TEXT NOT NULL,
          quantity REAL NOT NULL,
          unit_price REAL NOT NULL,
          refund_amount REAL NOT NULL,
          condition TEXT NOT NULL,
          damaged_reason TEXT,
          reintegrate_to_stock INTEGER NOT NULL DEFAULT 0
        );
      `);
    } catch {}
  },
  // Reintenta la migración anterior, que podía ocultar errores y avanzar user_version.
  (db) =>
    db.exec(`
      CREATE TABLE IF NOT EXISTS returns (
        id TEXT PRIMARY KEY,
        return_number TEXT NOT NULL,
        sale_id TEXT,
        ticket_number TEXT,
        date TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        total_refund REAL NOT NULL,
        refund_method TEXT NOT NULL,
        customer_name TEXT,
        reason TEXT,
        has_damaged_items INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS return_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        return_id TEXT NOT NULL REFERENCES returns(id),
        product_id TEXT NOT NULL,
        code TEXT NOT NULL,
        name TEXT NOT NULL,
        um TEXT NOT NULL,
        quantity REAL NOT NULL,
        unit_price REAL NOT NULL,
        refund_amount REAL NOT NULL,
        condition TEXT NOT NULL,
        damaged_reason TEXT,
        reintegrate_to_stock INTEGER NOT NULL DEFAULT 0
      );
    `),
];

function migrate(db) {
  const current = db.pragma('user_version', { simple: true });
  for (let i = current; i < MIGRATIONS.length; i++) {
    db.transaction(() => {
      MIGRATIONS[i](db);
      db.pragma(`user_version = ${i + 1}`);
    })();
  }
}

/* ------------------------------------------------------------------ */
/* Mapeos fila -> objeto de la UI                                      */
/* ------------------------------------------------------------------ */
const productStatus = (stock, minStock) => (stock <= 0 ? 'out' : stock <= minStock ? 'low' : 'ok');

const mapProduct = (r) => ({
  id: r.id,
  code: r.code,
  name: r.name,
  detail: r.detail,
  category: r.category,
  um: r.um,
  price: r.price,
  stock: r.stock,
  minStock: r.min_stock,
  almacenStock: r.almacen_stock !== undefined ? r.almacen_stock : 0,
  status: productStatus(r.stock, r.min_stock),
  provider: r.provider || undefined,
  location: r.location || undefined,
  rotation: r.rotation || undefined,
  lastExit: r.last_exit || undefined,
  createdAt: r.created_at,
});

const ticketLabel = (n) => `TKT-${String(n).padStart(5, '0')}`;

/* ------------------------------------------------------------------ */
/* Repositorio                                                         */
/* ------------------------------------------------------------------ */
function createRepo(db, { clock = () => new Date() } = {}) {
  const today = () => localDate(clock());
  const nowStamp = () => {
    const d = clock();
    return `${localDate(d)} ${localTime(d)}`;
  };
  const assertDate = (d) => {
    if (!DATE_RE.test(String(d))) throw new DomainError('BAD_DATE', 'Fecha inválida (use AAAA-MM-DD).');
    return d;
  };
  const isClosed = (date) => !!db.prepare('SELECT 1 FROM day_closes WHERE date = ?').get(date);

  const q = {
    productById: db.prepare('SELECT * FROM products WHERE id = ?'),
    insertMovement: db.prepare(
      'INSERT INTO stock_movements (product_id, date, ts, type, qty, sale_id, note) VALUES (?,?,?,?,?,?,?)'
    ),
    setStock: db.prepare('UPDATE products SET stock = stock + ? WHERE id = ?'),
  };

  function move(productId, type, qty, { saleId = null, note = null } = {}) {
    q.insertMovement.run(productId, today(), nowStamp(), type, qty, saleId, note);
    q.setStock.run(qty, productId);
  }

  /* ---------------- Productos ---------------- */
  function nextCode() {
    let max = 0;
    for (const { code } of db.prepare('SELECT code FROM products').all()) {
      const m = /^PROD-(\d+)$/i.exec(code);
      if (m) max = Math.max(max, parseInt(m[1], 10));
    }
    return `PROD-${String(max + 1).padStart(3, '0')}`;
  }

  function listProducts() {
    return db.prepare('SELECT * FROM products WHERE archived = 0 ORDER BY name COLLATE NOCASE').all().map(mapProduct);
  }

  const createProduct = db.transaction((input) => {
    const name = String(input.name || '').trim();
    if (!name) throw new DomainError('INVALID', 'El producto necesita un nombre.');
    const price = input.price === undefined ? 0 : Number(input.price);
    const stock = input.stock === undefined ? 0 : Number(input.stock);
    const minStock = input.minStock === undefined ? 0 : Number(input.minStock);
    if (!isNum(price) || price < 0) throw new DomainError('INVALID', 'Precio inválido.');
    if (!isNum(stock) || stock < 0) throw new DomainError('INVALID', 'Stock inicial inválido.');
    if (!isNum(minStock) || minStock < 0) throw new DomainError('INVALID', 'Stock mínimo inválido.');

    const code = String(input.code || '').trim() || nextCode();
    if (db.prepare('SELECT 1 FROM products WHERE code = ? COLLATE NOCASE').get(code)) {
      throw new DomainError('CODE_EXISTS', `Ya existe un producto con el código ${code}.`);
    }
    const almacenStock = input.almacenStock === undefined ? 0 : Number(input.almacenStock);
    if (!isNum(almacenStock) || almacenStock < 0) throw new DomainError('INVALID', 'Stock en almacén inválido.');

    const id = `prod-${crypto.randomUUID()}`;
    db.prepare(
      `INSERT INTO products (id, code, name, detail, category, um, price, stock, min_stock, almacen_stock, provider, location, rotation, created_at)
       VALUES (?,?,?,?,?,?,?,0,?,?,?,?,?,?)`
    ).run(
      id, code, name,
      String(input.detail || ''),
      String(input.category || 'General'),
      String(input.um || 'Unidad'),
      round2(price), minStock, almacenStock,
      input.provider || null, input.location || null, input.rotation || null,
      nowStamp()
    );
    if (stock > 0) move(id, 'inicial', stock, { note: 'Stock inicial mostrador' });
    return mapProduct(q.productById.get(id));
  });

  const updateProduct = db.transaction((id, patch) => {
    const cur = q.productById.get(id);
    if (!cur || cur.archived) throw new DomainError('NOT_FOUND', 'Producto no encontrado.');

    const next = {
      code: patch.code !== undefined ? String(patch.code).trim() : cur.code,
      name: patch.name !== undefined ? String(patch.name).trim() : cur.name,
      detail: patch.detail !== undefined ? String(patch.detail) : cur.detail,
      category: patch.category !== undefined ? String(patch.category) : cur.category,
      um: patch.um !== undefined ? String(patch.um) : cur.um,
      price: patch.price !== undefined ? Number(patch.price) : cur.price,
      min_stock: patch.minStock !== undefined ? Number(patch.minStock) : cur.min_stock,
      provider: patch.provider !== undefined ? patch.provider || null : cur.provider,
      location: patch.location !== undefined ? patch.location || null : cur.location,
      rotation: patch.rotation !== undefined ? patch.rotation || null : cur.rotation,
    };
    if (!next.name || !next.code) throw new DomainError('INVALID', 'Nombre y código son obligatorios.');
    if (!isNum(next.price) || next.price < 0) throw new DomainError('INVALID', 'Precio inválido.');
    if (!isNum(next.min_stock) || next.min_stock < 0) throw new DomainError('INVALID', 'Stock mínimo inválido.');
    if (
      next.code.toLowerCase() !== cur.code.toLowerCase() &&
      db.prepare('SELECT 1 FROM products WHERE code = ? COLLATE NOCASE AND id <> ?').get(next.code, id)
    ) {
      throw new DomainError('CODE_EXISTS', `Ya existe un producto con el código ${next.code}.`);
    }
    db.prepare(
      `UPDATE products SET code=@code, name=@name, detail=@detail, category=@category, um=@um, price=@price,
         min_stock=@min_stock, provider=@provider, location=@location, rotation=@rotation WHERE id=@id`
    ).run({ ...next, price: round2(next.price), id });

    // El stock solo cambia con un movimiento auditable.
    if (patch.stock !== undefined) {
      const target = Number(patch.stock);
      if (!isNum(target) || target < 0) throw new DomainError('INVALID', 'Stock inválido.');
      const delta = round2(target - cur.stock);
      if (delta !== 0) move(id, 'ajuste', delta, { note: 'Ajuste manual desde catálogo' });
    }
    if (patch.almacenStock !== undefined) {
      const astock = Number(patch.almacenStock);
      if (!isNum(astock) || astock < 0) throw new DomainError('INVALID', 'Stock en almacén inválido.');
      db.prepare('UPDATE products SET almacen_stock = ? WHERE id = ?').run(astock, id);
    }
    return mapProduct(q.productById.get(id));
  });

  const reponerStock = db.transaction((id, qty) => {
    const cur = q.productById.get(id);
    if (!cur || cur.archived) throw new DomainError('NOT_FOUND', 'Producto no encontrado.');
    const qNum = Number(qty);
    if (!isNum(qNum) || qNum <= 0) throw new DomainError('INVALID', 'La cantidad a reponer debe ser mayor a cero.');
    const dispAlmacen = Number(cur.almacen_stock || 0);
    if (qNum > dispAlmacen) {
      throw new DomainError('INVALID', `No hay suficiente existencia en almacén. Disponible: ${dispAlmacen}.`);
    }
    db.prepare('UPDATE products SET almacen_stock = almacen_stock - ? WHERE id = ?').run(qNum, id);
    move(id, 'entrada', qNum, { note: 'Reposición desde almacén a mostrador' });
    return mapProduct(q.productById.get(id));
  });

  // Nunca se borra: el historial de ventas y movimientos referencia al producto.
  function archiveProduct(id) {
    const r = db.prepare('UPDATE products SET archived = 1 WHERE id = ? AND archived = 0').run(id);
    if (!r.changes) throw new DomainError('NOT_FOUND', 'Producto no encontrado.');
    return { id };
  }

  const addStock = db.transaction((productId, qty, note) => {
    const p = q.productById.get(productId);
    if (!p || p.archived) throw new DomainError('NOT_FOUND', 'Producto no encontrado.');
    if (!isNum(qty) || qty <= 0) throw new DomainError('INVALID', 'La entrada debe ser una cantidad positiva.');
    move(productId, 'entrada', qty, { note: note || null });
    return mapProduct(q.productById.get(productId));
  });

  /* ---------------- Ventas ---------------- */
  function loadSale(id) {
    const s = db.prepare('SELECT * FROM sales WHERE id = ?').get(id);
    if (!s) return null;
    const items = db.prepare('SELECT * FROM sale_items WHERE sale_id = ? ORDER BY id').all(id);
    return {
      id: s.id,
      ticketNumber: ticketLabel(s.ticket_number),
      date: s.date,
      timestamp: s.time,
      items: items.map((it) => ({
        productId: it.product_id, code: it.code, name: it.name, um: it.um,
        unitPrice: it.unit_price, quantity: it.quantity, subtotal: it.subtotal,
      })),
      total: s.total,
      paymentMethod: s.payment_method,
      efectivoAmount: s.efectivo,
      transferenciaAmount: s.transferencia,
      amountReceived: s.amount_received === null ? undefined : s.amount_received,
      change: s.change_given === null ? undefined : s.change_given,
      note: s.note || undefined,
      voided: s.voided_at !== null,
    };
  }

  const recordSale = db.transaction((input) => {
    const date = today();
    if (isClosed(date)) throw new DomainError('DAY_CLOSED', 'El día ya está cerrado. Reábrelo para registrar ventas.');
    if (!input || !Array.isArray(input.items) || input.items.length === 0) {
      throw new DomainError('INVALID', 'Debe seleccionar al menos un producto.');
    }

    // Agrupar por producto y validar existencias antes de tocar nada.
    const wanted = new Map();
    for (const it of input.items) {
      const qty = Number(it.quantity);
      if (!isNum(qty) || qty <= 0) throw new DomainError('INVALID', 'Cantidad inválida en una línea de venta.');
      const w = wanted.get(it.productId) || { qty: 0, unitPrice: it.unitPrice };
      w.qty += qty;
      wanted.set(it.productId, w);
    }
    const lines = [];
    for (const [productId, w] of wanted) {
      const p = q.productById.get(productId);
      if (!p || p.archived) throw new DomainError('NOT_FOUND', 'Un producto de la venta ya no existe.');
      if (w.qty > p.stock) {
        throw new DomainError('INSUFFICIENT_STOCK', `Stock insuficiente de "${p.name}": hay ${p.stock} ${p.um} y se piden ${w.qty}.`);
      }
      const unit = isNum(Number(w.unitPrice)) && w.unitPrice !== undefined && w.unitPrice !== null ? Number(w.unitPrice) : p.price;
      if (unit < 0) throw new DomainError('INVALID', 'Precio unitario inválido.');
      lines.push({ p, qty: w.qty, unit: round2(unit), subtotal: round2(w.qty * unit) });
    }
    const total = round2(lines.reduce((a, l) => a + l.subtotal, 0));

    // Normalizar el desglose de pago según el método.
    const method = input.paymentMethod;
    let efectivo, transferencia;
    if (method === 'efectivo') { efectivo = total; transferencia = 0; }
    else if (method === 'transferencia') { efectivo = 0; transferencia = total; }
    else if (method === 'mixto') {
      efectivo = round2(Number(input.efectivoAmount));
      transferencia = round2(Number(input.transferenciaAmount));
      if (!isNum(efectivo) || !isNum(transferencia) || efectivo < 0 || transferencia < 0 || Math.abs(efectivo + transferencia - total) > 0.01) {
        throw new DomainError('PAYMENT_MISMATCH', 'En pago mixto, efectivo + transferencia debe ser igual al total.');
      }
    } else throw new DomainError('INVALID', 'Método de pago inválido.');

    const seq = Number(db.prepare("SELECT value FROM meta WHERE key = 'ticket_seq'").get().value) + 1;
    db.prepare("UPDATE meta SET value = ? WHERE key = 'ticket_seq'").run(String(seq));

    const d = clock();
    const saleId = `sale-${crypto.randomUUID()}`;
    db.prepare(
      `INSERT INTO sales (id, ticket_number, date, time, payment_method, efectivo, transferencia, total, amount_received, change_given, note)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`
    ).run(
      saleId, seq, date, localTime(d), method, efectivo, transferencia, total,
      input.amountReceived === undefined ? null : Number(input.amountReceived),
      input.change === undefined ? null : Number(input.change),
      input.note || null
    );
    const insItem = db.prepare(
      'INSERT INTO sale_items (sale_id, product_id, code, name, um, unit_price, quantity, subtotal) VALUES (?,?,?,?,?,?,?,?)'
    );
    for (const l of lines) {
      insItem.run(saleId, l.p.id, l.p.code, l.p.name, l.p.um, l.unit, l.qty, l.subtotal);
      move(l.p.id, 'venta', -l.qty, { saleId });
      db.prepare('UPDATE products SET last_exit = ? WHERE id = ?').run(`Hoy ${localTime(d)}`, l.p.id);
    }
    return loadSale(saleId);
  });

  const voidSale = db.transaction((saleId) => {
    const s = db.prepare('SELECT * FROM sales WHERE id = ?').get(saleId);
    if (!s) throw new DomainError('NOT_FOUND', 'Venta no encontrada.');
    if (s.voided_at) throw new DomainError('ALREADY_VOIDED', 'Esa venta ya estaba anulada.');
    if (isClosed(s.date)) throw new DomainError('DAY_CLOSED', 'No se puede anular una venta de un día ya cerrado.');
    db.prepare('UPDATE sales SET voided_at = ? WHERE id = ?').run(nowStamp(), saleId);
    for (const it of db.prepare('SELECT * FROM sale_items WHERE sale_id = ?').all(saleId)) {
      move(it.product_id, 'anulacion', it.quantity, { saleId, note: `Anulación ${ticketLabel(s.ticket_number)}` });
    }
    return loadSale(saleId);
  });

  function listSales(date) {
    assertDate(date);
    const ids = db.prepare('SELECT id FROM sales WHERE date = ? ORDER BY ticket_number DESC').all(date);
    return ids.map((r) => loadSale(r.id));
  }

  function listSalesRange(startDate, endDate) {
    let ids;
    if (startDate && endDate) {
      assertDate(startDate);
      assertDate(endDate);
      ids = db.prepare('SELECT id FROM sales WHERE date >= ? AND date <= ? ORDER BY date DESC, ticket_number DESC').all(startDate, endDate);
    } else if (startDate) {
      assertDate(startDate);
      ids = db.prepare('SELECT id FROM sales WHERE date >= ? ORDER BY date DESC, ticket_number DESC').all(startDate);
    } else {
      ids = db.prepare('SELECT id FROM sales ORDER BY date DESC, ticket_number DESC LIMIT 1000').all();
    }
    return ids.map((r) => loadSale(r.id));
  }

  /* ---------------- IPV (derivado) ---------------- */
  function salesTotals(date) {
    const r = db
      .prepare(
        `SELECT COUNT(*) AS n, COALESCE(SUM(total),0) AS total, COALESCE(SUM(efectivo),0) AS efectivo,
                COALESCE(SUM(transferencia),0) AS transferencia
           FROM sales WHERE date = ? AND voided_at IS NULL`
      )
      .get(date);
    return { count: r.n, total: round2(r.total), efectivo: round2(r.efectivo), transferencia: round2(r.transferencia) };
  }

  function getIpvDay(date) {
    assertDate(date);
    const rows = db
      .prepare(
        `SELECT p.id, p.code, p.name, p.detail, p.category, p.um, p.price, p.stock, p.min_stock,
                COALESCE(SUM(CASE WHEN m.date >  @d THEN m.qty END), 0) AS delta_after,
                COALESCE(SUM(CASE WHEN m.date  = @d AND m.type IN ('entrada','inicial')   THEN  m.qty END), 0) AS entrada,
                COALESCE(SUM(CASE WHEN m.date  = @d AND m.type IN ('venta','anulacion')   THEN -m.qty END), 0) AS vendido,
                COALESCE(SUM(CASE WHEN m.date  = @d AND m.type = 'ajuste'                 THEN  m.qty END), 0) AS ajuste
           FROM products p
           LEFT JOIN stock_movements m ON m.product_id = p.id
          WHERE substr(p.created_at, 1, 10) <= @d AND (p.archived = 0 OR m.id IS NOT NULL)
          GROUP BY p.id
          ORDER BY p.name COLLATE NOCASE`
      )
      .all({ d: date });

    const importes = new Map(
      db
        .prepare(
          `SELECT si.product_id AS pid, SUM(si.subtotal) AS importe
             FROM sale_items si JOIN sales s ON s.id = si.sale_id
            WHERE s.date = ? AND s.voided_at IS NULL GROUP BY si.product_id`
        )
        .all(date)
        .map((r) => [r.pid, r.importe])
    );

    let totalVendido = 0;
    let totalUnidades = 0;
    const out = rows.map((r, i) => {
      const saldoFinal = round2(r.stock - r.delta_after);
      const saldoIni = round2(saldoFinal - r.entrada + r.vendido - r.ajuste);
      const importe = round2(importes.get(r.id) || 0);
      totalVendido += importe;
      totalUnidades += r.vendido;
      const lowAt = r.min_stock > 0 ? r.min_stock : 5;
      return {
        id: `${date}:${r.id}`,
        num: String(i + 1).padStart(2, '0'),
        productId: r.id,
        code: r.code,
        name: r.name,
        category: r.category,
        detail: r.detail,
        um: r.um,
        saldoIni,
        entrada: round2(r.entrada),
        vendido: round2(r.vendido),
        ajuste: round2(r.ajuste),
        saldoFinal,
        price: r.price,
        importe,
        status: saldoFinal <= 0 ? 'zero' : saldoFinal <= lowAt ? 'low' : 'normal',
      };
    });
    return { date, closed: isClosed(date), rows: out, totalVendido: round2(totalVendido), totalUnidades: round2(totalUnidades), sales: salesTotals(date) };
  }

  /* ---------------- Cierre de caja ---------------- */
  function mapClose(r) {
    return {
      date: r.date,
      closedAt: r.closed_at,
      denominations: JSON.parse(r.denominations),
      menoresAmount: r.menores,
      transferenciasAmount: r.transferencias,
      totalContado: r.total_contado,
      totalIpv: r.total_ipv,
      diferencia: r.diferencia,
      note: r.note || undefined,
    };
  }

  function getClose(date) {
    assertDate(date);
    const r = db.prepare('SELECT * FROM day_closes WHERE date = ?').get(date);
    return r ? mapClose(r) : null;
  }

  function listCloses(limit) {
    const n = Math.min(Math.max(parseInt(limit, 10) || 30, 1), 365);
    return db.prepare('SELECT * FROM day_closes ORDER BY date DESC LIMIT ?').all(n).map(mapClose);
  }

  const closeDay = db.transaction((date, input) => {
    assertDate(date);
    if (date > today()) throw new DomainError('BAD_DATE', 'No se puede cerrar un día futuro.');
    if (isClosed(date)) throw new DomainError('DAY_CLOSED', 'Ese día ya fue cerrado.');
    const dens = Array.isArray(input && input.denominations) ? input.denominations : [];
    let cash = 0;
    for (const d of dens) {
      const v = Number(d.value), c = Number(d.count);
      if (!isNum(v) || !isNum(c) || v < 0 || c < 0) throw new DomainError('INVALID', 'Denominación inválida.');
      cash += v * c;
    }
    const menores = Number(input.menoresAmount || 0);
    const transf = Number(input.transferenciasAmount || 0);
    if (!isNum(menores) || !isNum(transf) || menores < 0 || transf < 0) throw new DomainError('INVALID', 'Importe inválido.');
    const totalContado = round2(cash + menores + transf);
    const totalIpv = salesTotals(date).total;
    db.prepare(
      `INSERT INTO day_closes (date, closed_at, denominations, menores, transferencias, total_contado, total_ipv, diferencia, note)
       VALUES (?,?,?,?,?,?,?,?,?)`
    ).run(
      date, nowStamp(),
      JSON.stringify(dens.map((d) => ({ id: d.id, label: d.label, value: Number(d.value), count: Number(d.count) }))),
      round2(menores), round2(transf), totalContado, totalIpv, round2(totalContado - totalIpv), input.note || null
    );
    return getClose(date);
  });

  function reopenDay(date) {
    assertDate(date);
    const r = db.prepare('DELETE FROM day_closes WHERE date = ?').run(date);
    if (!r.changes) throw new DomainError('NOT_FOUND', 'Ese día no estaba cerrado.');
    return { date };
  }

  /* ---------------- Respaldo ---------------- */
  const TABLES = ['products', 'sales', 'sale_items', 'stock_movements', 'day_closes', 'meta'];
  // orden de inserción respetando claves foráneas; el borrado va al revés
  const BACKUP_FORMAT = 1;

  function exportAll() {
    const tables = {};
    for (const t of TABLES) tables[t] = db.prepare(`SELECT * FROM ${t}`).all();
    return { format: BACKUP_FORMAT, schema: db.pragma('user_version', { simple: true }), exportedAt: nowStamp(), tables };
  }

  const restoreAll = db.transaction((data) => {
    if (!data || data.format !== BACKUP_FORMAT || !data.tables) throw new DomainError('BAD_BACKUP', 'Archivo de respaldo no reconocido.');
    if (data.schema !== db.pragma('user_version', { simple: true })) {
      throw new DomainError('BAD_BACKUP', 'El respaldo es de otra versión de la base de datos.');
    }
    for (const t of TABLES) if (!Array.isArray(data.tables[t])) throw new DomainError('BAD_BACKUP', `Falta la tabla ${t} en el respaldo.`);
    for (const t of [...TABLES].reverse()) db.prepare(`DELETE FROM ${t}`).run();
    db.prepare("DELETE FROM sqlite_sequence WHERE name IN ('sale_items','stock_movements')").run();
    for (const t of TABLES) {
      const rows = data.tables[t];
      if (!rows.length) continue;
      const cols = Object.keys(rows[0]);
      for (const c of cols) if (!/^[a-z_]+$/.test(c)) throw new DomainError('BAD_BACKUP', 'Columna inválida en el respaldo.');
      const ins = db.prepare(`INSERT INTO ${t} (${cols.join(',')}) VALUES (${cols.map((c) => '@' + c).join(',')})`);
      for (const r of rows) ins.run(r);
    }
    return { restored: Object.fromEntries(TABLES.map((t) => [t, data.tables[t].length])) };
  });

  const resetAll = db.transaction(() => {
    const tables = ['return_items', 'returns', 'day_closes', 'stock_movements', 'sale_items', 'sales', 'products'];
    const cleared = Object.fromEntries(
      tables.map((table) => [table, db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get().count])
    );
    for (const table of tables) db.prepare(`DELETE FROM ${table}`).run();
    db.prepare('DELETE FROM meta').run();
    db.prepare("INSERT INTO meta (key, value) VALUES ('ticket_seq', '100')").run();
    db.prepare("DELETE FROM sqlite_sequence WHERE name IN ('sale_items', 'stock_movements', 'return_items')").run();
    return { cleared };
  });

  /* ---------------- Devoluciones ---------------- */
  const recordReturn = db.transaction((input) => {
    const id = `return-${crypto.randomUUID()}`;
    const d = clock();
    const dateStr = localDate(d);
    const timeStr = localTime(d);
    const countRow = db.prepare('SELECT COUNT(*) as c FROM returns').get();
    const retSeq = (countRow ? countRow.c : 0) + 1;
    const returnNumber = `DEV-${String(retSeq).padStart(3, '0')}`;
    const items = input.items || [];
    const hasDamaged = items.some((it) => it.condition === 'mal_estado') ? 1 : 0;
    const totalRefund = Number(input.totalRefund) || 0;

    db.prepare(`
      INSERT INTO returns (id, return_number, sale_id, ticket_number, date, timestamp, total_refund, refund_method, customer_name, reason, has_damaged_items, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      returnNumber,
      input.saleId || null,
      input.ticketNumber || null,
      dateStr,
      timeStr,
      totalRefund,
      input.refundMethod || 'efectivo',
      input.customerName || null,
      input.reason || 'Devolución de cliente',
      hasDamaged,
      `${dateStr} ${timeStr}`
    );

    const insItem = db.prepare(`
      INSERT INTO return_items (return_id, product_id, code, name, um, quantity, unit_price, refund_amount, condition, damaged_reason, reintegrate_to_stock)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const it of items) {
      const q = Number(it.quantity) || 1;
      const uPrice = Number(it.unitPrice) || 0;
      const refAmt = Number(it.refundAmount) || (q * uPrice);
      const isDamaged = it.condition === 'mal_estado';
      const reintegrate = it.reintegrateToStock && !isDamaged ? 1 : 0;
      insItem.run(
        id,
        it.productId,
        it.code || '',
        it.name || '',
        it.um || 'Unidad',
        q,
        uPrice,
        refAmt,
        it.condition || 'mal_estado',
        it.damagedReason || null,
        reintegrate
      );
      if (reintegrate) {
        move(it.productId, 'entrada', q, { note: `Reingreso por devolución ${returnNumber}` });
      }
    }

    return loadReturn(id);
  });

  function loadReturn(id) {
    const r = db.prepare('SELECT * FROM returns WHERE id = ?').get(id);
    if (!r) return null;
    const items = db.prepare('SELECT * FROM return_items WHERE return_id = ?').all(id).map((it) => ({
      productId: it.product_id,
      code: it.code,
      name: it.name,
      um: it.um,
      quantity: it.quantity,
      unitPrice: it.unit_price,
      refundAmount: it.refund_amount,
      condition: it.condition,
      damagedReason: it.damaged_reason,
      reintegrateToStock: Boolean(it.reintegrate_to_stock),
    }));
    return {
      id: r.id,
      returnNumber: r.return_number,
      saleId: r.sale_id,
      ticketNumber: r.ticket_number,
      date: r.date,
      timestamp: r.timestamp,
      totalRefund: r.total_refund,
      refundMethod: r.refund_method,
      customerName: r.customer_name,
      reason: r.reason,
      hasDamagedItems: Boolean(r.has_damaged_items),
      createdAt: r.created_at,
      items,
    };
  }

  function listReturns() {
    const rows = db.prepare('SELECT id FROM returns ORDER BY created_at DESC').all();
    return rows.map((r) => loadReturn(r.id)).filter(Boolean);
  }

  return {
    today,
    listProducts, createProduct, updateProduct, archiveProduct, addStock, reponerStock,
    recordSale, voidSale, listSales, listSalesRange,
    recordReturn, listReturns,
    getIpvDay,
    getClose, listCloses, closeDay, reopenDay,
    exportAll, restoreAll, resetAll,
    backupTo: (file) => db.backup(file),
  };
}

function openDatabase(file, options) {
  const db = new Database(file);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('synchronous = NORMAL');
  migrate(db);
  return { db, repo: createRepo(db, options), close: () => db.close() };
}

module.exports = { openDatabase, DomainError, localDate };