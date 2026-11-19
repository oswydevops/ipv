'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { buildReportHtml, parseDelimitedText } = require('./reportExport.cjs');

const rows = parseDelimitedText(
  '\uFEFF"Reporte";;"Fecha: hoy"\r\n\r\n"Nombre";"Detalle";"Importe"\r\n"Producto, uno";"Línea 1\nLínea 2";10,50',
  ';'
);
assert.deepStrictEqual(rows, [
  ['Reporte', '', 'Fecha: hoy'],
  ['Nombre', 'Detalle', 'Importe'],
  ['Producto, uno', 'Línea 1\nLínea 2', '10,50'],
]);

const html = buildReportHtml({
  title: '<Reporte>',
  csvContent: '"Resumen";;\n"Nombre";"Detalle"\n"<Producto>";"A & B"',
});
assert.match(html, /&lt;Reporte&gt;/);
assert.match(html, /&lt;Producto&gt;/);
assert.match(html, /A &amp; B/);
assert.match(html, /colspan="3"/);
const businessReportHtml = buildReportHtml({
  title: 'Reporte Comercial - Mipyme (comercio mixto)',
  csvContent: '"Tipo de negocio";"Mipyme (comercio mixto)"\n"Categoría";"Alimentos básicos"',
  businessName: 'Ferretería Central',
  ownerName: 'Ana Pérez',
  businessProfileName: 'Mipyme (comercio mixto)',
  logoDataUrl: 'data:image/png;base64,Zm9v',
});
assert.match(businessReportHtml, /Reporte Comercial - Mipyme/);
assert.match(businessReportHtml, /Mipyme \(comercio mixto\)/);
assert.match(businessReportHtml, /Alimentos básicos/);
assert.match(businessReportHtml, /Ferretería Central/);
assert.match(businessReportHtml, /Ana Pérez/);
assert.match(businessReportHtml, /data:image\/png;base64,Zm9v/);
assert.throws(() => parseDelimitedText('"celda sin cerrar', ';'));

let exposedApi;
const electronMock = {
  contextBridge: {
    exposeInMainWorld(name, api) {
      assert.strictEqual(name, 'api');
      exposedApi = api;
    },
  },
  ipcRenderer: { invoke() {} },
};
vm.runInNewContext(fs.readFileSync(path.join(__dirname, 'preload.cjs'), 'utf8'), {
  require: (moduleName) => {
    if (moduleName !== 'electron') throw new Error(`Unexpected module: ${moduleName}`);
    return electronMock;
  },
});
assert.strictEqual(exposedApi._isElectron, true);
assert.strictEqual(typeof exposedApi.reports.exportarTabla, 'function');

console.log('report export tests passed');
