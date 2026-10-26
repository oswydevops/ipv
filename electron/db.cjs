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
const fs = require('fs');
const { execFileSync } = require('child_process');

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
const BASE32_CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

function readMachineGuid() {
  if (process.platform !== 'win32') return null;

  try {
    const output = execFileSync(
      'reg.exe',
      ['query', 'HKLM\\SOFTWARE\\Microsoft\\Cryptography', '/v', 'MachineGuid'],
      { encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] }
    );
    const match = output.match(/^\s*MachineGuid\s+REG_SZ\s+([^\r\n]+)\s*$/im);
    return match ? match[1].trim() || null : null;
  } catch {
    return null;
  }
}

function readFallbackGuid(file) {
  try {
    const guid = fs.readFileSync(file, 'utf8').trim();
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(guid)) {
      return guid;
    }
    throw new Error('El UUID de respaldo de la instalación no es válido.');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }

  const guid = crypto.randomUUID();
  try {
    fs.writeFileSync(file, guid, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
    return guid;
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    const existingGuid = fs.readFileSync(file, 'utf8').trim();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(existingGuid)) {
      throw new Error('El UUID de respaldo de la instalación no es válido.');
    }
    return existingGuid;
  }
}

function installationIdFromGuid(guid) {
  const digest = crypto.createHash('sha256').update(`FerreStock-v1:${guid}`, 'utf8').digest();
  let buffer = 0;
  let bits = 0;
  let encoded = '';
  for (const byte of digest) {
    buffer = (buffer << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      encoded += BASE32_CROCKFORD[(buffer >> bits) & 31];
      buffer &= (1 << bits) - 1;
    }
  }
  if (bits > 0) encoded += BASE32_CROCKFORD[(buffer << (5 - bits)) & 31];
  return encoded.slice(0, 6);
}

function createInstallationId(machineGuidReader, fallbackGuidPath) {
  let machineGuid = null;
  try {
    machineGuid = machineGuidReader();
  } catch {
    machineGuid = null;
  }
  const guid = typeof machineGuid === 'string' && machineGuid.trim()
    ? machineGuid.trim()
    : readFallbackGuid(fallbackGuidPath);
  return installationIdFromGuid(guid);
}

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
  (db) => {
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
  },
  (db) => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS license_state (
        id                 INTEGER PRIMARY KEY CHECK (id = 1),
        installation_id    TEXT NOT NULL,
        payload            BLOB,
        signature          BLOB,
        ultima_fecha_vista TEXT
      );
    `);
  },
  (db) => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS merma_items (
        id TEXT PRIMARY KEY,
        return_id TEXT NOT NULL,
        return_number TEXT NOT NULL,
        date TEXT NOT NULL,
        product_id TEXT NOT NULL,
        code TEXT NOT NULL,
        name TEXT NOT NULL,
        um TEXT NOT NULL,
        quantity REAL NOT NULL CHECK (quantity > 0),
        original_unit_price REAL NOT NULL DEFAULT 0,
        damaged_reason TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('en_almacen_merma','reincorporado_con_precio','devuelto_a_almacen','baja_definitiva')),
        discounted_price REAL,
        resolved_at TEXT,
        resolution_note TEXT
      );
      INSERT OR IGNORE INTO merma_items (
        id, return_id, return_number, date, product_id, code, name, um, quantity,
        original_unit_price, damaged_reason, status
      )
      SELECT
        'merma-' || r.id || '-' || ri.id,
        r.id, r.return_number, r.date, ri.product_id, ri.code, ri.name, ri.um, ri.quantity,
        ri.unit_price, COALESCE(ri.damaged_reason, r.reason, 'Devolución de cliente'), 'en_almacen_merma'
      FROM return_items ri
      JOIN returns r ON r.id = ri.return_id
      WHERE ri.condition = 'mal_estado';
    `);
  },
  (db) => {
    try {
      db.exec('ALTER TABLE merma_items ADD COLUMN defective_product_id TEXT;');
    } catch {}
  },
  (db) => {
    // `products.code` tenía UNIQUE a nivel de columna, así que un producto archivado
    // seguía bloqueando su código para siempre. Se reconstruye la tabla sin ese UNIQUE
    // y se crea un índice único parcial que cubre solo los productos activos: el
    // archivado conserva su código para los reportes históricos y el código vuelve a
    // quedar disponible para un producto nuevo.
    // SQLite no permite quitar un constraint de columna, por eso el rebuild.
    db.exec(`
      CREATE TABLE products_rebuild (
        id            TEXT PRIMARY KEY,
        code          TEXT NOT NULL,
        name          TEXT NOT NULL,
        detail        TEXT NOT NULL DEFAULT '',
        category      TEXT NOT NULL DEFAULT 'General',
        um            TEXT NOT NULL DEFAULT 'Unidad',
        price         REAL NOT NULL DEFAULT 0 CHECK (price >= 0),
        stock         REAL NOT NULL DEFAULT 0 CHECK (stock >= 0),
        min_stock     REAL NOT NULL DEFAULT 0 CHECK (min_stock >= 0),
        provider      TEXT,
        location      TEXT,
        rotation      TEXT,
        last_exit     TEXT,
        created_at    TEXT NOT NULL,
        archived      INTEGER NOT NULL DEFAULT 0,
        almacen_stock REAL NOT NULL DEFAULT 0
      );

      INSERT INTO products_rebuild (
        id, code, name, detail, category, um, price, stock, min_stock,
        provider, location, rotation, last_exit, created_at, archived, almacen_stock
      )
      SELECT
        id, code, name, detail, category, um, price, stock, min_stock,
        provider, location, rotation, last_exit, created_at, archived, almacen_stock
      FROM products;

      DROP TABLE products;
      ALTER TABLE products_rebuild RENAME TO products;

      CREATE UNIQUE INDEX ux_products_code_active ON products(code) WHERE archived = 0;
    `);
  },
];

function migrate(db) {
  const current = db.pragma('user_version', { simple: true });
  if (current >= MIGRATIONS.length) return;
  // Las migraciones que reconstruyen tablas necesitan las claves foráneas apagadas:
  // con foreign_keys = ON, DROP TABLE hace un DELETE implícito y falla contra
  // sale_items / stock_movements, que referencian products(id).
  const fkWasOn = db.pragma('foreign_keys', { simple: true });
  db.pragma('foreign_keys = OFF');
  try {
    for (let i = current; i < MIGRATIONS.length; i++) {
      db.transaction(() => {
        MIGRATIONS[i](db);
        db.pragma(`user_version = ${i + 1}`);
      })();
    }
    const violations = db.pragma('foreign_key_check');
    if (violations.length) {
      throw new Error(`Migración con violaciones de clave foránea: ${JSON.stringify(violations.slice(0, 5))}`);
    }
  } finally {
    db.pragma(`foreign_keys = ${fkWasOn ? 'ON' : 'OFF'}`);
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

const mapMerma = (r) => ({
  id: r.id,
  returnId: r.return_id,
  returnNumber: r.return_number,
  date: r.date,
  productId: r.product_id,
  code: r.code,
  name: r.name,
  um: r.um,
  quantity: r.quantity,
  originalUnitPrice: r.original_unit_price,
  damagedReason: r.damaged_reason,
  status: r.status,
  discountedPrice: r.discounted_price === null ? undefined : r.discounted_price,
  defectiveProductId: r.defective_product_id || undefined,
  resolvedAt: r.resolved_at || undefined,
  resolutionNote: r.resolution_note || undefined,
});

const ticketLabel = (n) => `TKT-${String(n).padStart(5, '0')}`;

/* ------------------------------------------------------------------ */
/* Repositorio                                                         */
/* ------------------------------------------------------------------ */
function createRepo(db, {
  clock = () => new Date(),
  machineGuidReader = readMachineGuid,
  fallbackGuidPath,
} = {}) {
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
  const existingLicenseState = db.prepare('SELECT installation_id FROM license_state WHERE id = 1').get();
  if (!existingLicenseState) {
    const installationId = createInstallationId(machineGuidReader, fallbackGuidPath);
    db.prepare('INSERT INTO license_state (id, installation_id) VALUES (1, ?)').run(installationId);
  }
  const getLicenseRecord = () => db.prepare('SELECT * FROM license_state WHERE id = 1').get();
  const observeLicenseDate = () => {
    const record = getLicenseRecord();
    const currentDate = today();
    if (!record || !record.payload) return { clockRollback: false, currentDate, lastSeenDate: null };
    if (record.ultima_fecha_vista && currentDate < record.ultima_fecha_vista) {
      return { clockRollback: true, currentDate, lastSeenDate: record.ultima_fecha_vista };
    }
    db.prepare('UPDATE license_state SET ultima_fecha_vista = ? WHERE id = 1').run(currentDate);
    return { clockRollback: false, currentDate, lastSeenDate: currentDate };
  };
  const saveLicense = (payload, signature, issueDate) => {
    const record = getLicenseRecord();
    const currentDate = today();
    if (record.payload && record.ultima_fecha_vista && currentDate < record.ultima_fecha_vista) {
      throw new DomainError('CLOCK_ROLLBACK', 'La fecha del sistema es anterior a la última fecha registrada. Corrija la hora antes de activar.');
    }
    if (typeof issueDate !== 'string' || !DATE_RE.test(issueDate)) {
      throw new DomainError('INVALID', 'La fecha de emisión de la licencia no es válida.');
    }
    db.prepare(
      'UPDATE license_state SET payload = ?, signature = ?, ultima_fecha_vista = ? WHERE id = 1'
    ).run(payload, signature, currentDate);
    return getLicenseRecord();
  };
  const clockStatus = () => {
    const result = db.prepare(`
      SELECT MAX(activity_date) AS last_activity_date
      FROM (
        SELECT substr(created_at, 1, 10) AS activity_date FROM products
        UNION ALL SELECT date FROM stock_movements
        UNION ALL SELECT date FROM sales
        UNION ALL SELECT date FROM day_closes
        UNION ALL SELECT date FROM returns
      )
    `).get();
    const lastActivityDate = result.last_activity_date || null;
    const currentDate = today();
    return {
      today: currentDate,
      lastActivityDate,
      warning: Boolean(lastActivityDate && currentDate < lastActivityDate),
    };
  };

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
    if (db.prepare('SELECT 1 FROM products WHERE code = ? COLLATE NOCASE AND archived = 0').get(code)) {
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
      db.prepare('SELECT 1 FROM products WHERE code = ? COLLATE NOCASE AND id <> ? AND archived = 0').get(next.code, id)
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

  // Borra de verdad solo si el producto no dejó rastro. Si tiene historial (ventas,
  // movimientos de stock, devoluciones o mermas) se archiva: esos registros lo
  // referencian y los reportes históricos dependen de él. En ambos casos el código
  // queda disponible para reutilizar.
  function hasHistory(id) {
    return Boolean(
      db.prepare('SELECT 1 FROM sale_items WHERE product_id = ? LIMIT 1').get(id) ||
      db.prepare('SELECT 1 FROM stock_movements WHERE product_id = ? LIMIT 1').get(id) ||
      db.prepare('SELECT 1 FROM return_items WHERE product_id = ? LIMIT 1').get(id) ||
      db.prepare('SELECT 1 FROM merma_items WHERE defective_product_id = ? LIMIT 1').get(id)
    );
  }

  const deleteProduct = db.transaction((id) => {
    const cur = q.productById.get(id);
    if (!cur) throw new DomainError('NOT_FOUND', 'Producto no encontrado.');
    if (hasHistory(id)) {
      db.prepare('UPDATE products SET archived = 1 WHERE id = ?').run(id);
      return { id, mode: 'archived' };
    }
    db.prepare('DELETE FROM products WHERE id = ?').run(id);
    return { id, mode: 'deleted' };
  });

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
    const licenseState = getLicenseRecord();
    if (
      licenseState.payload &&
      licenseState.ultima_fecha_vista &&
      date < licenseState.ultima_fecha_vista
    ) {
      throw new DomainError('CLOCK_ROLLBACK', 'La fecha del sistema es anterior a la última fecha registrada. Corrija la hora para registrar ventas.');
    }
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
    db.prepare(
      `UPDATE license_state
          SET ultima_fecha_vista = MAX(COALESCE(ultima_fecha_vista, ?), ?)
        WHERE id = 1 AND payload IS NOT NULL`
    ).run(date, date);
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
  const TABLES = [
    'products', 'sales', 'sale_items', 'stock_movements', 'day_closes', 'meta',
    'returns', 'return_items', 'merma_items',
  ];
  // orden de inserción respetando claves foráneas; el borrado va al revés
  const BACKUP_FORMAT = 1;

  function exportAll() {
    const tables = {};
    for (const t of TABLES) tables[t] = db.prepare(`SELECT * FROM ${t}`).all();
    return { format: BACKUP_FORMAT, schema: db.pragma('user_version', { simple: true }), exportedAt: nowStamp(), tables };
  }

  const restoreAll = db.transaction((data) => {
    if (!data || data.format !== BACKUP_FORMAT || !data.tables) throw new DomainError('BAD_BACKUP', 'Archivo de respaldo no reconocido.');
    const currentSchema = db.pragma('user_version', { simple: true });
    if (data.schema !== currentSchema && data.schema !== currentSchema - 1) {
      throw new DomainError('BAD_BACKUP', 'El respaldo es de otra versión de la base de datos.');
    }
    for (const t of TABLES) if (!Array.isArray(data.tables[t])) throw new DomainError('BAD_BACKUP', `Falta la tabla ${t} en el respaldo.`);
    for (const t of [...TABLES].reverse()) db.prepare(`DELETE FROM ${t}`).run();
    db.prepare("DELETE FROM sqlite_sequence WHERE name IN ('sale_items','stock_movements','return_items')").run();
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

    let itemIndex = 0;
    for (const it of items) {
      itemIndex += 1;
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
      if (isDamaged) {
        db.prepare(`
          INSERT INTO merma_items (
            id, return_id, return_number, date, product_id, code, name, um, quantity,
            original_unit_price, damaged_reason, status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'en_almacen_merma')
        `).run(
          `merma-${id}-${itemIndex}`,
          id,
          returnNumber,
          dateStr,
          it.productId,
          it.code || '',
          it.name || '',
          it.um || 'Unidad',
          q,
          uPrice,
          it.damagedReason || input.reason || 'Devolución de cliente'
        );
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

  function listMermas() {
    return db.prepare('SELECT * FROM merma_items ORDER BY date DESC, id DESC').all().map(mapMerma);
  }

  const venderMermaConDescuento = db.transaction((mermaId, newPrice, note) => {
    const item = db.prepare('SELECT * FROM merma_items WHERE id = ?').get(mermaId);
    if (!item) throw new DomainError('NOT_FOUND', 'Artículo de merma no encontrado.');
    if (item.status !== 'en_almacen_merma') throw new DomainError('INVALID', 'Este artículo de merma ya fue procesado.');
    const price = Number(newPrice);
    if (!isNum(price) || price <= 0 || price >= Number(item.original_unit_price)) {
      throw new DomainError('INVALID', 'El precio debe ser mayor que cero y menor que el precio original.');
    }
    const source = q.productById.get(item.product_id);
    if (!source || source.archived) throw new DomainError('NOT_FOUND', 'No se encontró el producto original.');
    const defectiveProduct = createProduct({
      code: `MERMA-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
      name: `${item.name} (Defectuoso)`,
      detail: `Artículo defectuoso: ${item.damaged_reason}`,
      category: 'Defectuoso',
      um: item.um,
      price,
      stock: item.quantity,
      minStock: 1,
    });
    db.prepare(`
      UPDATE merma_items
      SET status = 'reincorporado_con_precio', discounted_price = ?, defective_product_id = ?, resolved_at = ?, resolution_note = ?
      WHERE id = ?
    `).run(
      price,
      defectiveProduct.id,
      today(),
      note || `Preparado para venta como defectuoso con precio de $${price.toFixed(2)}`,
      mermaId
    );
    return { ...mapMerma(db.prepare('SELECT * FROM merma_items WHERE id = ?').get(mermaId)), defectiveProductId: defectiveProduct.id };
  });

  const enviarMermaAlmacen = db.transaction((mermaId, note) => {
    const item = db.prepare('SELECT * FROM merma_items WHERE id = ?').get(mermaId);
    if (!item) throw new DomainError('NOT_FOUND', 'Artículo de merma no encontrado.');
    if (item.status !== 'en_almacen_merma') throw new DomainError('INVALID', 'Este artículo de merma ya fue procesado.');
    const product = q.productById.get(item.product_id);
    if (!product || product.archived) throw new DomainError('NOT_FOUND', 'No se encontró el producto original.');
    db.prepare('UPDATE products SET almacen_stock = almacen_stock + ? WHERE id = ?').run(item.quantity, item.product_id);
    db.prepare(`
      UPDATE merma_items
      SET status = 'devuelto_a_almacen', resolved_at = ?, resolution_note = ?
      WHERE id = ?
    `).run(
      today(),
      note || 'Enviado al almacén central para reponerlo al mostrador cuando sea necesario.',
      mermaId
    );
    return mapMerma(db.prepare('SELECT * FROM merma_items WHERE id = ?').get(mermaId));
  });

  const darDeBajaMerma = db.transaction((mermaId, note) => {
    const item = db.prepare('SELECT * FROM merma_items WHERE id = ?').get(mermaId);
    if (!item) throw new DomainError('NOT_FOUND', 'Artículo de merma no encontrado.');
    if (item.status !== 'en_almacen_merma') throw new DomainError('INVALID', 'Este artículo de merma ya fue procesado.');
    db.prepare(`
      UPDATE merma_items
      SET status = 'baja_definitiva', resolved_at = ?, resolution_note = ?
      WHERE id = ?
    `).run(today(), note || 'Baja definitiva por daño irreparable / inutilizable', mermaId);
    return mapMerma(db.prepare('SELECT * FROM merma_items WHERE id = ?').get(mermaId));
  });

  const revocarMerma = db.transaction((mermaId) => {
    const item = db.prepare('SELECT * FROM merma_items WHERE id = ?').get(mermaId);
    if (!item) throw new DomainError('NOT_FOUND', 'Artículo de merma no encontrado.');
    if (item.status === 'en_almacen_merma') {
      throw new DomainError('INVALID', 'El artículo todavía está pendiente.');
    }

    if (item.status === 'reincorporado_con_precio') {
      let defectiveProductId = item.defective_product_id;
      if (!defectiveProductId) {
        const candidates = db.prepare(`
          SELECT p.id
          FROM products p
          WHERE p.code LIKE 'MERMA-%'
            AND p.name = ?
            AND p.detail = ?
            AND p.category = 'Defectuoso'
            AND p.price = ?
            AND p.stock = ?
            AND COALESCE(p.almacen_stock, 0) = 0
            AND substr(p.created_at, 1, 10) = ?
            AND NOT EXISTS (SELECT 1 FROM sale_items si WHERE si.product_id = p.id)
            AND (SELECT COUNT(*) FROM stock_movements sm WHERE sm.product_id = p.id) = 1
            AND EXISTS (
              SELECT 1 FROM stock_movements sm
              WHERE sm.product_id = p.id AND sm.type = 'inicial' AND sm.qty = ?
            )
        `).all(
          `${item.name} (Defectuoso)`,
          `Artículo defectuoso: ${item.damaged_reason}`,
          item.discounted_price,
          item.quantity,
          item.resolved_at,
          item.quantity
        );
        if (candidates.length !== 1) {
          throw new DomainError('INVALID', 'No se puede revocar con seguridad: no se encontró un único artículo defectuoso intacto asociado.');
        }
        defectiveProductId = candidates[0].id;
      }
      const product = q.productById.get(defectiveProductId);
      const saleCount = db.prepare('SELECT COUNT(*) AS count FROM sale_items WHERE product_id = ?')
        .get(defectiveProductId).count;
      const movements = db.prepare('SELECT type, qty FROM stock_movements WHERE product_id = ?')
        .all(defectiveProductId);
      if (
        !product ||
        Number(product.stock) !== Number(item.quantity) ||
        Number(product.almacen_stock || 0) !== 0 ||
        saleCount > 0 ||
        movements.length !== 1 ||
        movements[0].type !== 'inicial' ||
        Number(movements[0].qty) !== Number(item.quantity)
      ) {
        throw new DomainError('INVALID', 'No se puede revocar: el artículo defectuoso ya se vendió o su existencia cambió.');
      }
      db.prepare('UPDATE products SET archived = 1 WHERE id = ?').run(defectiveProductId);
    } else if (item.status === 'devuelto_a_almacen') {
      const product = q.productById.get(item.product_id);
      if (!product || product.archived) {
        throw new DomainError('NOT_FOUND', 'No se puede revocar: el producto original no está disponible.');
      }
      if (Number(product.almacen_stock || 0) < Number(item.quantity)) {
        throw new DomainError('INVALID', 'No se puede revocar: no hay suficiente existencia en el almacén para devolver la cantidad.');
      }
      db.prepare('UPDATE products SET almacen_stock = almacen_stock - ? WHERE id = ?')
        .run(item.quantity, item.product_id);
    }

    db.prepare(`
      UPDATE merma_items
      SET status = 'en_almacen_merma', discounted_price = NULL, defective_product_id = NULL,
          resolved_at = NULL, resolution_note = NULL
      WHERE id = ?
    `).run(mermaId);
    return mapMerma(db.prepare('SELECT * FROM merma_items WHERE id = ?').get(mermaId));
  });

  const resetAll = db.transaction(() => {
    const cleared = {};
    for (const t of [...TABLES].reverse()) {
      cleared[t] = db.prepare(`SELECT COUNT(*) AS count FROM ${t}`).get().count;
      db.prepare(`DELETE FROM ${t}`).run();
    }
    db.prepare("DELETE FROM sqlite_sequence WHERE name IN ('sale_items','stock_movements','return_items')").run();
    db.prepare("INSERT INTO meta (key, value) VALUES ('ticket_seq', '100')").run();
    return { ok: true, cleared };
  });

  return {
    today, clockStatus,
    getLicenseRecord, observeLicenseDate, saveLicense,
    listProducts, createProduct, updateProduct, archiveProduct, deleteProduct, addStock, reponerStock,
    recordSale, voidSale, listSales, listSalesRange,
    recordReturn, listReturns, listMermas, venderMermaConDescuento, enviarMermaAlmacen,     darDeBajaMerma, revocarMerma,
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
  const repoOptions = {
    ...options,
    fallbackGuidPath: options?.fallbackGuidPath || `${file}.machine-guid`,
  };
  return { db, repo: createRepo(db, repoOptions), close: () => db.close() };
}

module.exports = { openDatabase, DomainError, localDate };