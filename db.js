const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

function abrir(carpeta) {
  fs.mkdirSync(carpeta, { recursive: true });
  const db = new Database(path.join(carpeta, 'ipv.db'));
  db.pragma('synchronous = FULL');
  db.pragma('foreign_keys = ON');
  db.exec(`
    CREATE TABLE IF NOT EXISTS productos (
      id INTEGER PRIMARY KEY, nombre TEXT NOT NULL, um TEXT DEFAULT 'U',
      precio REAL NOT NULL DEFAULT 0, stock_minimo INTEGER DEFAULT 3, activo INTEGER DEFAULT 1);
    CREATE TABLE IF NOT EXISTS movimientos (
      id INTEGER PRIMARY KEY, fecha TEXT NOT NULL,
      producto_id INTEGER NOT NULL REFERENCES productos(id),
      tipo TEXT NOT NULL CHECK (tipo IN ('entrada','venta','ajuste')),
      cantidad INTEGER NOT NULL, precio REAL);
    CREATE INDEX IF NOT EXISTS idx_mov ON movimientos(fecha, producto_id);
    CREATE TABLE IF NOT EXISTS cierres (
      fecha TEXT PRIMARY KEY, billetes TEXT, efectivo REAL, transferencia REAL,
      total_ipv REAL, diferencia REAL);
  `);
  sembrar(db);
  return db;
}

// Productos de ejemplo (de tu hoja) para poder probar. Borra ipv.db para reiniciar.
function sembrar(db) {
  if (db.prepare('SELECT COUNT(*) n FROM productos').get().n) return;
  const p = db.prepare('INSERT INTO productos (nombre, um, precio) VALUES (?,?,?)');
  const m = db.prepare("INSERT INTO movimientos (fecha, producto_id, tipo, cantidad) VALUES ('2000-01-01', ?, 'ajuste', ?)");
  db.transaction(() => {
    [
      ['Teflón', 'Rollo', 160, 59],
      ['Llave de ángulo', 'U', 1100, 8],
      ['Llave de Fregadero Metálica', 'U', 1200, 0],
      ['Válvula de 1/2', 'U', 500, 2],
      ['Universal de 1"', 'U', 1000, 32],
      ['Tee 1"', 'U', 450, 30],
      ['Codo 3/4"', 'U', 200, 596],
      ['Niple de 1/2"', 'U', 550, 62],
    ].forEach(([n, u, pr, s]) => {
      const id = p.run(n, u, pr).lastInsertRowid;
      if (s) m.run(id, s);
    });
  })();
}

// Saldo = entradas y ajustes - ventas. El saldo inicial de un día es el saldo de los días anteriores.
function listarIPV(db, fecha) {
  return db.prepare(`
    SELECT p.id, p.nombre, p.um, p.precio, p.stock_minimo,
      COALESCE(SUM(CASE WHEN m.fecha < @f THEN (CASE WHEN m.tipo='venta' THEN -m.cantidad ELSE m.cantidad END) END), 0) AS saldo_inicial,
      COALESCE(SUM(CASE WHEN m.fecha = @f AND m.tipo IN ('entrada','ajuste') THEN m.cantidad END), 0) AS entrada,
      COALESCE(SUM(CASE WHEN m.fecha = @f AND m.tipo = 'venta' THEN m.cantidad END), 0) AS vendido,
      COALESCE(SUM(CASE WHEN m.fecha = @f AND m.tipo = 'venta' THEN m.cantidad * m.precio END), 0) AS importe
    FROM productos p
    LEFT JOIN movimientos m ON m.producto_id = p.id AND m.fecha <= @f
    WHERE p.activo = 1
    GROUP BY p.id ORDER BY p.id`).all({ f: fecha });
}

// Reemplaza la entrada y la venta de un producto en un día (una sola transacción).
function fijarDia(db, { fecha, productoId, entrada, vendido }) {
  db.transaction(() => {
    db.prepare("DELETE FROM movimientos WHERE fecha = ? AND producto_id = ? AND tipo IN ('entrada','venta')")
      .run(fecha, productoId);
    const precio = db.prepare('SELECT precio FROM productos WHERE id = ?').get(productoId).precio;
    const ins = db.prepare('INSERT INTO movimientos (fecha, producto_id, tipo, cantidad, precio) VALUES (?,?,?,?,?)');
    if (entrada > 0) ins.run(fecha, productoId, 'entrada', entrada, precio);
    if (vendido > 0) ins.run(fecha, productoId, 'venta', vendido, precio);
  })();
}

function alertas(db) {
  return db.prepare(`
    SELECT p.id, p.nombre, p.um, p.stock_minimo,
      COALESCE(SUM(CASE WHEN m.tipo='venta' THEN -m.cantidad ELSE m.cantidad END), 0) AS saldo,
      MAX(CASE WHEN m.fecha > '2000-01-01' THEN m.fecha END) AS ultimo
    FROM productos p LEFT JOIN movimientos m ON m.producto_id = p.id
    WHERE p.activo = 1
    GROUP BY p.id
    HAVING saldo <= p.stock_minimo
    ORDER BY saldo, p.nombre`).all()
    .map((r) => ({ ...r, estado: r.saldo <= 0 ? 'cero' : 'bajo' }));
}

function fijarMinimo(db, id, minimo) {
  db.prepare('UPDATE productos SET stock_minimo = ? WHERE id = ?').run(minimo, id);
}

module.exports = { abrir, listarIPV, fijarDia, alertas, fijarMinimo };
