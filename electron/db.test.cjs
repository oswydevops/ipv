'use strict';
// Ejecutar con:  node electron/db.test.cjs
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { openDatabase } = require('./db.cjs');
const { getResumenDia } = require('../src/main/reports/getResumenDia.js');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ipv-'));
let now = new Date(2026, 9, 9, 9, 0); // 2026-10-09 09:00 local
const store = openDatabase(path.join(tmp, 'test.sqlite'), { clock: () => now });
const repo = store.repo;
const D1 = '2026-10-09';
const D2 = '2026-10-10';
const nextDay = () => { now = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 9, 0); };

let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log('  ok  ' + name); };
const throwsCode = (fn, code) => {
  try { fn(); } catch (e) { assert.strictEqual(e.code, code, `esperaba ${code}, llegó ${e.code}: ${e.message}`); return; }
  assert.fail(`esperaba error ${code}`);
};
const row = (ipv, code) => ipv.rows.find((r) => r.code === code);

let tornillo, cemento;

test('crear productos: código automático y stock inicial como movimiento', () => {
  tornillo = repo.createProduct({ name: 'Tornillo 1"', price: 10, stock: 100, um: 'u', minStock: 20 });
  cemento = repo.createProduct({ name: 'Cemento', price: 1500.5, stock: 10, um: 'saco' });
  assert.strictEqual(tornillo.code, 'PROD-001');
  assert.strictEqual(cemento.code, 'PROD-002');
  assert.strictEqual(repo.listProducts().length, 2);
  throwsCode(() => repo.createProduct({ name: 'Otro', code: 'prod-001' }), 'CODE_EXISTS');
});

test('venta: descuenta stock, ticket 101, importe con precio al momento de vender', () => {
  const s = repo.recordSale({ items: [{ productId: tornillo.id, quantity: 30 }, { productId: cemento.id, quantity: 2 }], paymentMethod: 'efectivo' });
  assert.strictEqual(s.ticketNumber, 'TKT-00101');
  assert.strictEqual(s.total, 300 + 3001);
  const p = repo.listProducts().find((x) => x.id === tornillo.id);
  assert.strictEqual(p.stock, 70);
});

test('no se puede vender más de lo que hay y el stock no cambia', () => {
  throwsCode(() => repo.recordSale({ items: [{ productId: cemento.id, quantity: 9 }], paymentMethod: 'efectivo' }), 'INSUFFICIENT_STOCK');
  assert.strictEqual(repo.listProducts().find((x) => x.id === cemento.id).stock, 8);
  // dos líneas del mismo producto se suman antes de validar
  throwsCode(() => repo.recordSale({ items: [{ productId: cemento.id, quantity: 5 }, { productId: cemento.id, quantity: 5 }], paymentMethod: 'efectivo' }), 'INSUFFICIENT_STOCK');
});

test('pago mixto debe cuadrar con el total', () => {
  throwsCode(() => repo.recordSale({ items: [{ productId: tornillo.id, quantity: 1 }], paymentMethod: 'mixto', efectivoAmount: 3, transferenciaAmount: 3 }), 'PAYMENT_MISMATCH');
  const ok = repo.recordSale({ items: [{ productId: tornillo.id, quantity: 1 }], paymentMethod: 'mixto', efectivoAmount: 4, transferenciaAmount: 6 });
  assert.strictEqual(ok.ticketNumber, 'TKT-00102');
});

test('anular: repone exactamente, no se anula dos veces, tickets no se reutilizan', () => {
  const before = repo.listProducts().find((x) => x.id === tornillo.id).stock; // 69
  const s = repo.recordSale({ items: [{ productId: tornillo.id, quantity: 4 }], paymentMethod: 'transferencia' }); // 103
  assert.strictEqual(repo.listProducts().find((x) => x.id === tornillo.id).stock, before - 4);
  repo.voidSale(s.id);
  assert.strictEqual(repo.listProducts().find((x) => x.id === tornillo.id).stock, before);
  throwsCode(() => repo.voidSale(s.id), 'ALREADY_VOIDED');
  const next = repo.recordSale({ items: [{ productId: tornillo.id, quantity: 1 }], paymentMethod: 'efectivo' });
  assert.strictEqual(next.ticketNumber, 'TKT-00104'); // el 103 anulado no se reutiliza
});

test('IPV del día: saldo ini + entrada - vendido = saldo final, anuladas no cuentan', () => {
  const ipv = repo.getIpvDay(D1);
  const t = row(ipv, 'PROD-001');
  assert.strictEqual(t.saldoIni, 0);
  assert.strictEqual(t.entrada, 100);
  assert.strictEqual(t.vendido, 32); // 30 + 1 + 1 (la de 4 se anuló)
  assert.strictEqual(t.saldoFinal, 68);
  assert.strictEqual(t.importe, 320);
  assert.strictEqual(ipv.totalVendido, 320 + 3001);
  assert.strictEqual(ipv.sales.count, 3);
});

test('cierre de caja: calcula diferencia y bloquea el día', () => {
  const ipv = repo.getIpvDay(D1);
  const close = repo.closeDay(D1, {
    denominations: [{ id: 'd1000', label: '1000', value: 1000, count: 3 }, { id: 'd100', label: '100', value: 100, count: 2 }],
    menoresAmount: 50, transferenciasAmount: 6,
  });
  assert.strictEqual(close.totalContado, 3000 + 200 + 50 + 6);
  assert.strictEqual(close.totalIpv, ipv.totalVendido);
  assert.strictEqual(close.diferencia, 3256 - 3321);
  throwsCode(() => repo.closeDay(D1, { denominations: [] }), 'DAY_CLOSED');
  throwsCode(() => repo.recordSale({ items: [{ productId: tornillo.id, quantity: 1 }], paymentMethod: 'efectivo' }), 'DAY_CLOSED');
  const anyId = repo.listSales(D1)[0].id;
  throwsCode(() => repo.voidSale(anyId), 'DAY_CLOSED');
  assert.strictEqual(repo.listCloses(10).length, 1);
});

test('día siguiente: saldo inicial = saldo final de ayer y el histórico no cambia', () => {
  nextDay();
  const d2 = repo.getIpvDay(D2);
  assert.strictEqual(row(d2, 'PROD-001').saldoIni, 68);
  assert.strictEqual(row(d2, 'PROD-001').vendido, 0);
  repo.addStock(tornillo.id, 50, 'Compra proveedor');
  repo.recordSale({ items: [{ productId: tornillo.id, quantity: 8 }], paymentMethod: 'efectivo' });
  const d2b = repo.getIpvDay(D2);
  const t2 = row(d2b, 'PROD-001');
  assert.deepStrictEqual([t2.saldoIni, t2.entrada, t2.vendido, t2.saldoFinal], [68, 50, 8, 110]);
  const d1 = row(repo.getIpvDay(D1), 'PROD-001'); // ayer intacto
  assert.deepStrictEqual([d1.saldoIni, d1.entrada, d1.vendido, d1.saldoFinal], [0, 100, 32, 68]);
});

test('producto creado hoy no aparece en días anteriores', () => {
  const nuevo = repo.createProduct({ name: 'Martillo', price: 900, stock: 5 });
  assert.ok(row(repo.getIpvDay(D2), nuevo.code));
  assert.ok(!row(repo.getIpvDay(D1), nuevo.code));
});

test('ajuste manual desde catálogo queda como movimiento y no rompe la identidad', () => {
  repo.updateProduct(cemento.id, { stock: 20, price: 1600 });
  const c = row(repo.getIpvDay(D2), 'PROD-002');
  assert.strictEqual(c.saldoIni, 8);
  assert.strictEqual(c.ajuste, 12);
  assert.strictEqual(c.saldoFinal, c.saldoIni + c.entrada - c.vendido + c.ajuste);
  assert.strictEqual(c.price, 1600);
  // las ventas viejas conservan el precio con el que se hicieron
  assert.strictEqual(row(repo.getIpvDay(D1), 'PROD-002').importe, 3001);
});

test('archivar no borra el historial', () => {
  repo.archiveProduct(cemento.id);
  assert.ok(!repo.listProducts().find((p) => p.id === cemento.id));
  assert.strictEqual(row(repo.getIpvDay(D1), 'PROD-002').importe, 3001);
});

test('devolución: registra y consulta artículos devueltos', () => {
  const record = repo.recordReturn({
    totalRefund: 20,
    refundMethod: 'efectivo',
    reason: 'Artículo defectuoso',
    items: [{
      productId: tornillo.id,
      code: tornillo.code,
      name: tornillo.name,
      um: tornillo.um,
      quantity: 2,
      unitPrice: 10,
      refundAmount: 20,
      condition: 'mal_estado',
      reintegrateToStock: false,
    }],
  });

  assert.ok(record.id.startsWith('return-'));
  assert.strictEqual(record.date, D2);
  assert.strictEqual(record.totalRefund, 20);
  assert.strictEqual(record.items.length, 1);
  assert.strictEqual(repo.listReturns()[0].id, record.id);
  const merma = repo.listMermas().find((item) => item.returnId === record.id);
  assert.ok(merma);
  assert.strictEqual(merma.status, 'en_almacen_merma');

  repo.venderMermaConDescuento(merma.id, 7);
  const defectiveProduct = repo.listProducts().find((product) => product.category === 'Defectuoso');
  assert.ok(defectiveProduct.name.includes('(Defectuoso)'));
  assert.strictEqual(defectiveProduct.price, 7);
  assert.strictEqual(defectiveProduct.stock, 2);
  assert.strictEqual(repo.listMermas().find((item) => item.id === merma.id).defectiveProductId, defectiveProduct.id);
  const defectiveSale = repo.recordSale({
    items: [{ productId: defectiveProduct.id, quantity: 1 }],
    paymentMethod: 'efectivo',
  });
  throwsCode(() => repo.revocarMerma(merma.id), 'INVALID');
  assert.strictEqual(defectiveSale.items[0].unitPrice, 7);
  const closeSummary = getResumenDia(D2, store.db);
  const defectiveLine = closeSummary.ventasPorProducto.find((item) => item.codigo === defectiveProduct.code);
  assert.strictEqual(defectiveLine.categoria, 'Defectuoso');
  assert.ok(defectiveLine.nombre.includes('(Defectuoso)'));

  const reversibleSaleReturn = repo.recordReturn({
    reason: 'Revocación de venta rebajada',
    items: [{
      productId: tornillo.id, code: tornillo.code, name: tornillo.name, um: tornillo.um,
      quantity: 1, unitPrice: 10, condition: 'mal_estado',
    }],
  });
  const reversibleSaleMerma = repo.listMermas().find((item) => item.returnId === reversibleSaleReturn.id);
  repo.venderMermaConDescuento(reversibleSaleMerma.id, 7);
  const reversibleDefectiveId = repo.listMermas().find((item) => item.id === reversibleSaleMerma.id).defectiveProductId;
  store.db.prepare('UPDATE merma_items SET defective_product_id = NULL WHERE id = ?').run(reversibleSaleMerma.id);
  repo.revocarMerma(reversibleSaleMerma.id);
  assert.strictEqual(repo.listMermas().find((item) => item.id === reversibleSaleMerma.id).status, 'en_almacen_merma');
  assert.ok(!repo.listProducts().some((product) => product.id === reversibleDefectiveId));

  const warehouseReturn = repo.recordReturn({
    reason: 'Devolución para almacén',
    items: [{
      productId: tornillo.id, code: tornillo.code, name: tornillo.name, um: tornillo.um,
      quantity: 1, unitPrice: 10, condition: 'mal_estado',
    }],
  });
  const warehouseMerma = repo.listMermas().find((item) => item.returnId === warehouseReturn.id);
  const stockBeforeWarehouse = repo.listProducts().find((product) => product.id === tornillo.id);
  const stockBefore = stockBeforeWarehouse.stock;
  const warehouseBefore = stockBeforeWarehouse.almacenStock;
  repo.enviarMermaAlmacen(warehouseMerma.id);
  const afterWarehouse = repo.listProducts().find((product) => product.id === tornillo.id);
  assert.strictEqual(afterWarehouse.stock, stockBefore);
  assert.strictEqual(afterWarehouse.almacenStock, warehouseBefore + 1);
  assert.strictEqual(repo.listMermas().find((item) => item.id === warehouseMerma.id).status, 'devuelto_a_almacen');
  repo.revocarMerma(warehouseMerma.id);
  assert.strictEqual(repo.listMermas().find((item) => item.id === warehouseMerma.id).status, 'en_almacen_merma');
  assert.strictEqual(repo.listProducts().find((product) => product.id === tornillo.id).almacenStock, warehouseBefore);
  repo.enviarMermaAlmacen(warehouseMerma.id);
  repo.reponerStock(tornillo.id, 1);
  const afterRestock = repo.listProducts().find((product) => product.id === tornillo.id);
  assert.strictEqual(afterRestock.stock, stockBefore + 1);
  assert.strictEqual(afterRestock.almacenStock, warehouseBefore);

  const discardedReturn = repo.recordReturn({
    reason: 'Artículo inservible',
    items: [{
      productId: tornillo.id, code: tornillo.code, name: tornillo.name, um: tornillo.um,
      quantity: 1, unitPrice: 10, condition: 'mal_estado',
    }],
  });
  const discardedMerma = repo.listMermas().find((item) => item.returnId === discardedReturn.id);
  repo.darDeBajaMerma(discardedMerma.id);
  assert.strictEqual(repo.listMermas().find((item) => item.id === discardedMerma.id).status, 'baja_definitiva');
  repo.revocarMerma(discardedMerma.id);
  assert.strictEqual(repo.listMermas().find((item) => item.id === discardedMerma.id).status, 'en_almacen_merma');
});

test('respaldo: exportar -> borrar cambios -> restaurar deja todo igual', () => {
  const snap = JSON.parse(JSON.stringify(repo.exportAll()));
  const ipvBefore = JSON.stringify(repo.getIpvDay(D2));
  repo.createProduct({ name: 'Basura', stock: 1 });
  repo.recordSale({ items: [{ productId: tornillo.id, quantity: 1 }], paymentMethod: 'efectivo' });
  repo.restoreAll(snap);
  assert.strictEqual(JSON.stringify(repo.getIpvDay(D2)), ipvBefore);
  throwsCode(() => repo.restoreAll({ format: 99 }), 'BAD_BACKUP');
  // el contador de tickets sigue funcionando tras restaurar
  const s = repo.recordSale({ items: [{ productId: tornillo.id, quantity: 1 }], paymentMethod: 'efectivo' });
  assert.ok(Number(s.ticketNumber.slice(4)) > 104);
});

test('clockStatus: sin actividad devuelve lastActivityDate null y warning false', () => {
  const freshStore = openDatabase(path.join(tmp, 'fresh-clock.sqlite'), { clock: () => now });
  const status = freshStore.repo.clockStatus();
  assert.strictEqual(status.today, repo.today());
  assert.strictEqual(status.lastActivityDate, null);
  assert.strictEqual(status.warning, false);
  freshStore.close();
});

test('clockStatus: día normal con actividad tiene warning false', () => {
  const status = repo.clockStatus();
  assert.strictEqual(status.today, repo.today());
  assert.strictEqual(status.warning, false);
  assert.ok(status.lastActivityDate !== null);
  assert.ok(status.today >= status.lastActivityDate);
});

test('clockStatus: reloj atrasado detecta warning true', () => {
  const savedNow = now;
  // Simular reloj atrasado a fecha anterior a la última actividad
  now = new Date(2026, 9, 1, 9, 0); // 2026-10-01
  const status = repo.clockStatus();
  assert.strictEqual(status.today, '2026-10-01');
  assert.strictEqual(status.warning, true);
  assert.ok(status.lastActivityDate !== null);
  assert.ok(status.today < status.lastActivityDate);
  now = savedNow; // Restaurar reloj
});

test('migración repara tablas de devoluciones ausentes', () => {
  const file = path.join(tmp, 'returns-migration.sqlite');
  const oldStore = openDatabase(file, { clock: () => now });
  oldStore.db.exec('DROP TABLE return_items; DROP TABLE returns; PRAGMA user_version = 3;');
  oldStore.close();

  const repairedStore = openDatabase(file, { clock: () => now });
  const product = repairedStore.repo.createProduct({ name: 'Producto devuelto', price: 25 });
  const record = repairedStore.repo.recordReturn({
    totalRefund: 25,
    refundMethod: 'efectivo',
    items: [{
      productId: product.id,
      code: product.code,
      name: product.name,
      um: product.um,
      quantity: 1,
      unitPrice: product.price,
      refundAmount: 25,
      condition: 'mal_estado',
    }],
  });

  assert.strictEqual(record.items.length, 1);
  assert.strictEqual(repairedStore.repo.listReturns()[0].returnNumber, record.returnNumber);
  assert.strictEqual(repairedStore.repo.listMermas().length, 1);
  repairedStore.db.exec('DROP TABLE merma_items; PRAGMA user_version = 5;');
  repairedStore.close();
  const migratedStore = openDatabase(file, { clock: () => now });
  assert.strictEqual(migratedStore.repo.listMermas().length, 1);
  assert.strictEqual(migratedStore.repo.listMermas()[0].status, 'en_almacen_merma');
  migratedStore.close();
});

test('restablecimiento elimina todos los datos comerciales y reinicia las secuencias', () => {
  const result = repo.resetAll();
  assert.ok(result.cleared.products > 0);
  assert.ok(result.cleared.sales > 0);
  assert.ok(result.cleared.returns > 0);
  for (const table of ['products', 'sales', 'sale_items', 'stock_movements', 'day_closes', 'returns', 'return_items', 'merma_items']) {
    assert.strictEqual(store.db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get().count, 0, `${table} debe quedar vacía`);
  }
  assert.strictEqual(store.db.prepare("SELECT value FROM meta WHERE key = 'ticket_seq'").get().value, '100');

  const product = repo.createProduct({ name: 'Producto después del reset', stock: 1 });
  const sale = repo.recordSale({ items: [{ productId: product.id, quantity: 1 }], paymentMethod: 'efectivo' });
  assert.strictEqual(sale.ticketNumber, 'TKT-00101');
  const returnRecord = repo.recordReturn({ items: [], totalRefund: 0, refundMethod: 'efectivo' });
  assert.strictEqual(returnRecord.returnNumber, 'DEV-001');
});

test('eliminar: sin historial borra la fila y libera el código', () => {
  const descartable = repo.createProduct({ name: 'Descartable', price: 5, stock: 0, code: 'PROD-880' });
  assert.deepStrictEqual(repo.deleteProduct(descartable.id), { id: descartable.id, mode: 'deleted' });
  assert.ok(!repo.listProducts().find((p) => p.id === descartable.id));
  assert.strictEqual(
    store.db.prepare('SELECT COUNT(*) AS count FROM products WHERE id = ?').get(descartable.id).count,
    0,
    'la fila debe desaparecer de la tabla'
  );
  const reuso = repo.createProduct({ name: 'Reuso', price: 5, stock: 0, code: 'PROD-880' });
  assert.strictEqual(reuso.code, 'PROD-880');
});

test('eliminar: con historial archiva, libera el código y conserva los movimientos', () => {
  const conHistorial = repo.createProduct({ name: 'Con historial', price: 5, stock: 3, code: 'PROD-881' });
  assert.deepStrictEqual(repo.deleteProduct(conHistorial.id), { id: conHistorial.id, mode: 'archived' });
  assert.ok(!repo.listProducts().find((p) => p.id === conHistorial.id));
  assert.strictEqual(
    store.db.prepare('SELECT archived FROM products WHERE id = ?').get(conHistorial.id).archived,
    1,
    'la fila debe quedar archivada'
  );
  assert.strictEqual(
    store.db.prepare('SELECT COUNT(*) AS count FROM stock_movements WHERE product_id = ?').get(conHistorial.id).count,
    1,
    'el movimiento inicial debe sobrevivir'
  );
  // el código archivado ya no bloquea uno nuevo
  const reuso = repo.createProduct({ name: 'Reuso con historial', price: 5, stock: 0, code: 'PROD-881' });
  assert.strictEqual(reuso.code, 'PROD-881');
  // pero sigue bloqueado mientras el nuevo está activo
  throwsCode(() => repo.createProduct({ name: 'Duplicado', price: 1, stock: 0, code: 'PROD-881' }), 'CODE_EXISTS');
});

(async () => {
  const file = path.join(tmp, 'copia.sqlite');
  await repo.backupTo(file);
  const copy = openDatabase(file, { clock: () => now });
  assert.strictEqual(copy.repo.listProducts().length, repo.listProducts().length);
  copy.close();
  passed++;
  console.log('  ok  db.backup (copia nativa) abre y coincide');
  store.close();
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`\n${passed} pruebas OK`);
})().catch((e) => { console.error(e); process.exit(1); });