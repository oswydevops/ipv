'use strict';

const assert = require('assert');
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
assert.throws(() => parseDelimitedText('"celda sin cerrar', ';'));

console.log('report export tests passed');
