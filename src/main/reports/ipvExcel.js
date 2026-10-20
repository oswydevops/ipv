'use strict';

const ExcelJS = require('exceljs');

const REFUND_METHODS = {
  efectivo: 'Efectivo',
  transferencia: 'Transferencia',
  mixto: 'Mixto',
};

async function generarExcelIpv(input, outputPath) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'IPV';
  workbook.created = new Date();
  workbook.modified = new Date();

  const headerFill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF0F172A' },
  };
  const headerFont = {
    name: 'Calibri',
    size: 11,
    bold: true,
    color: { argb: 'FFFFFFFF' },
  };
  const border = {
    top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
  };
  const returns = Array.isArray(input.returns) ? input.returns : [];
  const refundTotals = returns.reduce(
    (totals, record) => {
      totals[record.refundMethod] += Number(record.totalRefund || 0);
      return totals;
    },
    { efectivo: 0, transferencia: 0, mixto: 0 }
  );

  const summary = workbook.addWorksheet('Resumen');
  summary.columns = [
    { header: 'Concepto', key: 'label', width: 38 },
    { header: 'Valor', key: 'value', width: 28 },
  ];
  summary.addRow([input.title || 'Reporte IPV', input.period || '']);
  summary.addRow(['Generado', new Date().toLocaleString('es-CU')]);
  summary.addRow([]);
  summary.addRow(['Resumen de devoluciones', '']);
  summary.addRow(['Cantidad de devoluciones', returns.length]);
  summary.addRow(['Total reembolsado (CUP)', refundTotals.efectivo + refundTotals.transferencia + refundTotals.mixto]);
  summary.addRow(['Reembolsos en efectivo (CUP)', refundTotals.efectivo]);
  summary.addRow(['Reembolsos por transferencia (CUP)', refundTotals.transferencia]);
  summary.addRow(['Reembolsos mixtos (CUP)', refundTotals.mixto]);
  for (const metric of input.metrics || []) {
    const row = summary.addRow([metric.label, metric.value]);
    if (metric.label.includes('(CUP)')) {
      row.getCell(2).numFmt = '$#,##0.00';
    }
  }
  for (const row of [summary.getRow(1), summary.getRow(4)]) {
    row.eachCell((cell) => {
      cell.fill = headerFill;
      cell.font = headerFont;
    });
  }
  summary.getCell('B5').numFmt = '0';
  for (const rowNumber of [6, 7, 8, 9]) {
    summary.getCell(`B${rowNumber}`).numFmt = '$#,##0.00';
  }
  summary.views = [{ state: 'frozen', ySplit: 1 }];

  const detail = workbook.addWorksheet('Detalle IPV');
  detail.columns = (input.columns || []).map((column) => ({
    header: column.header,
    key: column.key,
    width: column.width || 20,
  }));
  const detailHeader = detail.getRow(1);
  detailHeader.eachCell((cell) => {
    cell.fill = headerFill;
    cell.font = headerFont;
    cell.alignment = { vertical: 'middle', wrapText: true };
  });
  detailHeader.height = 30;
  for (const row of input.rows || []) {
    const added = detail.addRow(row);
    added.eachCell((cell) => { cell.border = border; });
  }
  detail.views = [{ state: 'frozen', ySplit: 1 }];
  if (detail.columnCount > 0) {
    detail.autoFilter = { from: 'A1', to: `${detail.getColumn(detail.columnCount).letter}${Math.max(1, detail.rowCount)}` };
  }

  const returnsSheet = workbook.addWorksheet('Devoluciones');
  returnsSheet.columns = [
    { header: 'Fecha', key: 'date', width: 14 },
    { header: 'Hora', key: 'time', width: 10 },
    { header: 'Devolución', key: 'number', width: 16 },
    { header: 'Ticket de venta', key: 'ticket', width: 18 },
    { header: 'Cliente', key: 'customer', width: 24 },
    { header: 'Método de reembolso', key: 'method', width: 24 },
    { header: 'Motivo de devolución', key: 'reason', width: 32 },
    { header: 'Código', key: 'code', width: 16 },
    { header: 'Artículo', key: 'product', width: 32 },
    { header: 'Cantidad', key: 'quantity', width: 12 },
    { header: 'Condición', key: 'condition', width: 18 },
    { header: 'Reintegrado a stock', key: 'reintegrated', width: 20 },
    { header: 'Total reembolsado (CUP)', key: 'total', width: 24 },
    { header: 'Importe del artículo (CUP)', key: 'itemTotal', width: 26 },
  ];
  const returnsHeader = returnsSheet.getRow(1);
  returnsHeader.eachCell((cell) => {
    cell.fill = headerFill;
    cell.font = headerFont;
    cell.alignment = { vertical: 'middle', wrapText: true };
  });
  returnsHeader.height = 32;
  returnsSheet.views = [{ state: 'frozen', ySplit: 1 }];
  returnsSheet.autoFilter = { from: 'A1', to: 'N1' };

  for (const record of returns) {
    const items = record.items?.length ? record.items : [null];
    items.forEach((item, index) => {
      const row = returnsSheet.addRow({
        date: record.date || '',
        time: record.timestamp || '',
        number: record.returnNumber || '',
        ticket: record.ticketNumber || '',
        customer: record.customerName || 'No especificado',
        method: REFUND_METHODS[record.refundMethod] || record.refundMethod || '',
        reason: item?.damagedReason || record.reason || 'No especificado',
        code: item?.code || '',
        product: item?.name || '',
        quantity: item?.quantity ?? '',
        condition: item?.condition === 'buen_estado'
          ? 'Buen estado'
          : item?.condition === 'mal_estado' ? 'Mal estado' : '',
        reintegrated: item ? (item.reintegrateToStock ? 'Sí' : 'No') : '',
        total: index === 0 ? Number(record.totalRefund || 0) : '',
        itemTotal: item?.refundAmount ?? '',
      });
      row.getCell(13).numFmt = '$#,##0.00';
      row.getCell(14).numFmt = '$#,##0.00';
      row.eachCell((cell) => { cell.border = border; });
    });
  }
  if (returnsSheet.rowCount === 1) {
    returnsSheet.addRow(['Sin devoluciones registradas para este periodo.']);
  }

  await workbook.xlsx.writeFile(outputPath);
  return outputPath;
}

module.exports = { generarExcelIpv };
