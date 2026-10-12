'use strict';
// Ejecutar con:  node electron/db.test.cjs
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { openDatabase } = require('./db.cjs');

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