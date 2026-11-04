'use strict';

function parseDelimitedText(content, delimiter = ';') {
  const text = String(content || '').replace(/^\uFEFF/, '');
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
    } else if (character === '"' && field.length === 0) {
      quoted = true;
    } else if (character === delimiter) {
      row.push(field);
      field = '';
    } else if (character === '\n' || character === '\r') {
      if (character === '\r' && text[index + 1] === '\n') index += 1;
      row.push(field);
      if (row.some((cell) => cell !== '')) rows.push(row);
      row = [];
      field = '';
    } else {
      field += character;
    }
  }

  row.push(field);
  if (row.some((cell) => cell !== '')) rows.push(row);
  if (quoted) throw new Error('El reporte tiene una celda sin cerrar.');
  return rows;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildReportHtml({ title, csvContent, delimiter = ';' }) {
  const rows = parseDelimitedText(csvContent, delimiter);
  const columnCount = Math.max(1, ...rows.map((row) => row.length));
  const tableRows = rows.map((row, index) => {
    const populated = row.filter((cell) => cell !== '');
    const singleCell = populated.length === 1;
    const isSection = singleCell && (
      index < 3 ||
      /^[-\d.]+\s/.test(populated[0]) ||
      /^(RESUMEN|REGISTRO|CATÁLOGO|HISTORIAL|PLANILLA|CONTROL|ARTÍCULOS|PRODUCTOS|DETALLE)/i.test(populated[0])
    );
    if (singleCell) {
      return `<tr class="${isSection ? (index === 0 ? 'report-title' : 'report-section') : 'report-note'}"><th colspan="${columnCount}">${escapeHtml(populated[0])}</th></tr>`;
    }
    const cells = Array.from({ length: columnCount }, (_, column) => `<td>${escapeHtml(row[column] || '')}</td>`).join('');
    return `<tr>${cells}</tr>`;
  }).join('');

  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<style>
@page { size: A4 landscape; margin: 12mm; }
* { box-sizing: border-box; }
body { font: 9px Arial, sans-serif; color: #172033; }
h1 { font-size: 18px; margin: 0 0 5px; color: #0f172a; }
.generated { color: #64748b; font-size: 9px; margin-bottom: 12px; }
table { width: 100%; border-collapse: collapse; table-layout: auto; }
td, th { border: 1px solid #cbd5e1; padding: 4px 5px; text-align: left; vertical-align: top; overflow-wrap: anywhere; }
td { white-space: pre-wrap; }
tr:nth-child(even) td { background: #f8fafc; }
.report-title th { background: #0f172a; color: #fff; font-size: 15px; padding: 8px; }
.report-section th { background: #e2e8f0; color: #0f172a; font-size: 10px; padding: 6px; }
.report-note th { background: #f8fafc; color: #475569; font-weight: normal; }
tr { page-break-inside: avoid; }
</style></head><body>
<h1>${escapeHtml(title)}</h1>
<div class="generated">Generado: ${escapeHtml(new Date().toLocaleString('es-CU'))}</div>
<table><tbody>${tableRows}</tbody></table>
</body></html>`;
}

module.exports = { buildReportHtml, parseDelimitedText };
