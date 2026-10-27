'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const ExcelJS = require('exceljs');
const { getResumenDia } = require('./getResumenDia.js');
const { generarExcelCierre } = require('./excel.js');
const { generarExcelIpv } = require('./ipvExcel.js');
const { buildHandlers } = require('../../../electron/ipc.cjs');

const fecha = '2026-10-17';
const fakeDb = {
  prepare(query) {
    return {
      get() {
        if (query.includes('SUM(si.unit_cost * si.quantity)')) {
          return { costOfGoods: 120 };
        }
        if (query.includes('voided_at IS NOT NULL')) {
          return { voidedCount: 1, voidedTotal: 15, voidedCash: 0, voidedTransfer: 15 };
        }
        if (query.includes('SUM(efectivo)')) {
          return { ticketsCount: 8, totalVentas: 500, totalEfectivo: 400, totalTransferencia: 100 };
        }
        if (query.includes('SELECT * FROM day_closes')) {
          return {
            closed_at: `${fecha} 17:00`,
            denominations: JSON.stringify([{ id: '100', label: 'Billete 100 CUP', value: 100, count: 3 }]),
            menores: 20,
            transferencias: 100,
            total_contado: 420,
            total_ipv: 500,
            diferencia: -80,
            note: 'Cierre de prueba',
          };
        }
        return null;
      },
      all() {
        if (query.includes('FROM return_items')) {
          return [{
            product_id: 'product-1',
            code: 'P-001',
            name: 'Artículo de prueba',
            um: 'Unidad',
            quantity: 1,
            unit_price: 45,
            refund_amount: 45,
            condition: 'mal_estado',
            damaged_reason: 'No funciona',
          }];
        }
        if (query.includes('return_number') && query.includes('total_refund')) {
          return [{
            id: 'return-1',
            sale_id: null,
            return_number: 'DEV-001',
            timestamp: '16:30',
            total_refund: 45,
            refund_method: 'efectivo',
            customer_name: 'Cliente de prueba',
            reason: 'Producto defectuoso',
            product_id: 'product-1',
            code: 'P-001',
            name: 'Artículo de prueba',
            um: 'Unidad',
            quantity: 1,
            unit_price: 45,
            refund_amount: 45,
            condition: 'mal_estado',
            damaged_reason: 'No funciona',
            reintegrate_to_stock: 0,
          }];
        }
        if (query.includes('ticket_number, time')) {
          return [{
            id: 'sale-void-1',
            ticket_number: 123,
            time: '16:00',
            payment_method: 'transferencia',
            efectivo: 0,
            transferencia: 15,
            total: 15,
            voided_at: `${fecha} 16:10`,
          }];
        }
        if (query.includes('si.code AS codigo')) {
          return [{
            codigo: 'P-001',
            nombre: 'Artículo de prueba',
            categoria: 'General',
            um: 'Unidad',
            precioUnitario: 50,
            cantidad: 10,
            total: 500,
          }];
        }
        return [];
      },
    };
  },
};

async function run() {
  const resumen = getResumenDia(fecha, fakeDb);
  assert.strictEqual(resumen.totales.efectivoContado, 320);
  assert.strictEqual(resumen.totales.transferenciaContada, 100);
  assert.strictEqual(resumen.totales.totalDevoluciones, 60);
  assert.strictEqual(resumen.totales.costoArticulosVendidos, 120);
  assert.strictEqual(resumen.totales.gananciasNetas, 320);
  assert.strictEqual(resumen.devoluciones.length, 1);
  assert.strictEqual(resumen.ventasAnuladas.length, 1);

  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ipv-report-'));
  const output = path.join(directory, `cierre-${fecha}.xlsx`);
  try {
    await generarExcelCierre(resumen, output);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(output);

    const summary = workbook.getWorksheet('Resumen');
    const summaryRows = [];
    summary.eachRow((row) => summaryRows.push(row.values));
    assert.ok(summaryRows.some((row) => row.includes('Efectivo contado en gaveta') && row.includes(320)));
    assert.ok(summaryRows.some((row) => row.includes('Transferencias contadas') && row.includes(100)));
    assert.ok(summaryRows.some((row) => row.includes('Total devuelto / anulado') && row.includes(60)));
    assert.ok(summaryRows.some((row) => row.includes('Ganancias Netas del Día') && row.includes(320)));
    assert.ok(summaryRows.some((row) => row.includes('Billete 100 CUP')));

    const returnSheet = workbook.getWorksheet('Devoluciones');
    const returnValues = [];
    returnSheet.eachRow((row) => returnValues.push(...row.values));
    assert.ok(returnValues.includes('DEV-001'));
    assert.ok(returnValues.includes('TKT-00123'));
    assert.ok(returnValues.some((value) => typeof value === 'string' && value.includes('Artículo de prueba')));
    assert.ok(returnValues.includes('Venta anulada'));

    const ipvOutput = path.join(directory, 'reporte-ipv.xlsx');
    await generarExcelIpv({
      date: fecha,
      fileName: 'reporte-ipv.xlsx',
      title: 'Reporte IPV Mensual',
      period: 'Octubre 2026',
      columns: [{ header: 'Producto', key: 'product' }],
      rows: [{ product: 'Producto vendido' }],
      metrics: [{ label: 'Unidades vendidas', value: 12 }],
      returns: [
        {
          date: fecha,
          timestamp: '11:00',
          returnNumber: 'DEV-101',
          ticketNumber: 'TKT-10001',
          customerName: 'Cliente Efectivo',
          refundMethod: 'efectivo',
          reason: 'Producto defectuoso',
          totalRefund: 25,
          items: [{ code: 'P-01', name: 'Producto devuelto', quantity: 1, condition: 'mal_estado', damagedReason: 'Empaque roto', refundAmount: 25, reintegrateToStock: false }],
        },
        {
          date: fecha,
          timestamp: '12:00',
          returnNumber: 'DEV-102',
          customerName: 'Cliente Mixto',
          refundMethod: 'mixto',
          reason: 'Cambio solicitado',
          totalRefund: 40,
          items: [{ code: 'P-02', name: 'Otro devuelto', quantity: 2, condition: 'buen_estado', refundAmount: 40, reintegrateToStock: true }],
        },
      ],
    }, ipvOutput);
    const ipvWorkbook = new ExcelJS.Workbook();
    await ipvWorkbook.xlsx.readFile(ipvOutput);
    const ipvRefundSheet = ipvWorkbook.getWorksheet('Devoluciones');
    const ipvRefundValues = [];
    ipvRefundSheet.eachRow((row) => ipvRefundValues.push(...row.values));
    assert.ok(ipvRefundValues.includes('Efectivo'));
    assert.ok(ipvRefundValues.includes('Mixto'));
    assert.ok(ipvRefundValues.includes('Cliente Efectivo'));
    assert.ok(ipvRefundValues.includes('Empaque roto'));
    assert.ok(ipvRefundValues.includes('Producto devuelto'));

    const selectedPath = path.join(directory, 'ubicacion-elegida.xlsx');
    const previousUserProfile = process.env.USERPROFILE;
    process.env.USERPROFILE = directory;
    try {
      let nextSaveResult = { canceled: false, filePath: selectedPath };
      let saveDialogOptions;
      let saveDialogCount = 0;
      const handlers = buildHandlers(
        { today: () => fecha },
        {
          dialog: {
            async showSaveDialog(_window, options) {
              saveDialogCount += 1;
              saveDialogOptions = options;
              return nextSaveResult;
            },
          },
          getWindow: () => null,
          fs,
          db: fakeDb,
        }
      );

      let resetCalled = false;
      const resetHandlers = buildHandlers(
        {
          today: () => fecha,
          observeLicenseDate: () => ({ clockRollback: false, currentDate: fecha }),
          getLicenseRecord: () => ({ installation_id: 'ABC234', payload: null }),
          resetAll: () => { resetCalled = true; return { cleared: { products: 1 } }; },
        },
        { trialStatePath: path.join(directory, 'trial.json') }
      );
      await assert.rejects(
        resetHandlers['backup:resetApplication']('incorrecta'),
        /Contraseña incorrecta/
      );
      assert.strictEqual(resetCalled, false);
      assert.deepStrictEqual(
        await resetHandlers['backup:resetApplication']('adminreset'),
        { cleared: { products: 1 } }
      );
      assert.strictEqual(resetCalled, true);

      const exported = await handlers['reportes:exportar-cierre-excel'](fecha);
      assert.strictEqual(exported.excelPath, selectedPath);
      assert.ok(fs.existsSync(selectedPath));
      assert.ok(saveDialogOptions.defaultPath.endsWith(`cierre-${fecha}.xlsx`));

      const fileExportPath = path.join(directory, 'exportacion-elegida.csv');
      nextSaveResult = { canceled: false, filePath: fileExportPath };
      const dialogCountBeforeFileExport = saveDialogCount;
      const exportedFile = await handlers['files:save']({
        contentBase64: Buffer.from('contenido exportado', 'utf8').toString('base64'),
        suggestedName: 'reporte.csv',
        extension: 'csv',
        description: 'Reporte CSV',
      });
      assert.deepStrictEqual(exportedFile, { canceled: false, path: fileExportPath });
      assert.strictEqual(fs.readFileSync(fileExportPath, 'utf8'), 'contenido exportado');
      assert.strictEqual(saveDialogCount, dialogCountBeforeFileExport + 1);
      assert.strictEqual(saveDialogOptions.defaultPath, 'reporte.csv');

      nextSaveResult = { canceled: true, filePath: undefined };
      const canceled = await handlers['reportes:exportar-cierre-excel'](fecha);
      assert.deepStrictEqual(canceled, { canceled: true });

      nextSaveResult = { canceled: false, filePath: path.join(directory, 'ipv-elegido.xlsx') };
      const exportedIpv = await handlers['reportes:exportar-ipv-excel']({
        date: fecha,
        fileName: 'Reporte_IPV_Diario.xlsx',
        title: 'Reporte IPV Diario',
        period: fecha,
        columns: [{ header: 'Producto', key: 'product' }],
        rows: [{ product: 'Producto IPV' }],
        metrics: [],
        returns: [],
      });
      assert.ok(fs.existsSync(exportedIpv.excelPath));
      console.log('Selector de destino y cancelación: prueba OK');
    } finally {
      if (previousUserProfile === undefined) delete process.env.USERPROFILE;
      else process.env.USERPROFILE = previousUserProfile;
    }
    console.log('Reporte de cierre Excel: prueba OK');
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
