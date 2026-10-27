'use strict';
const ExcelJS = require('exceljs');

/**
 * Genera un libro de Excel (.xlsx) con hojas 'Resumen' y 'Detalle' usando exceljs (sin gráficos).
 *
 * @param {object} resumenDia - Objeto retornado por getResumenDia
 * @param {string} outputPath - Ruta de destino para el archivo .xlsx
 * @returns {Promise<string>} Ruta del archivo Excel generado
 */
async function generarExcelCierre(resumenDia, outputPath) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'IPV';
  workbook.lastModifiedBy = 'IPV';
  workbook.created = new Date();
  workbook.modified = new Date();

  // Estilos visuales para Excel
  const darkNavyFill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF0F172A' }, // Slate 900
  };
  const slateHeaderFill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF334155' }, // Slate 700
  };
  const lightZebraFill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFF8FAFC' }, // Slate 50
  };
  const accentTotalFill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE2E8F0' }, // Slate 200
  };

  const whiteHeaderFont = {
    name: 'Calibri',
    size: 11,
    bold: true,
    color: { argb: 'FFFFFFFF' },
  };
  const boldTextFont = {
    name: 'Calibri',
    size: 10,
    bold: true,
  };
  const regularTextFont = {
    name: 'Calibri',
    size: 10,
  };

  const thinBorder = {
    top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
  };

  /* ------------------------------------------------------------- */
  /* HOJA 1: RESUMEN                                               */
  /* ------------------------------------------------------------- */
  const wsResumen = workbook.addWorksheet('Resumen', {
    views: [{ showGridLines: true }],
  });

  wsResumen.columns = [
    { key: 'colA', width: 32 },
    { key: 'colB', width: 24 },
    { key: 'colC', width: 24 },
    { key: 'colD', width: 16 },
  ];

  // Fila 1: Título Principal
  wsResumen.mergeCells('A1:D1');
  const titleCell = wsResumen.getCell('A1');
  titleCell.value = `REPORTE DE CIERRE DE CAJA DIARIO - ${resumenDia.fecha}`;
  titleCell.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FF0F172A' } };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  wsResumen.getRow(1).height = 32;

  // Fila 2: Subtítulo y Metadatos
  wsResumen.mergeCells('A2:D2');
  const subCell = wsResumen.getCell('A2');
  subCell.value = `Generado: ${resumenDia.generadoEn} | Estado: ${resumenDia.totales.estadoCierre}`;
  subCell.font = { name: 'Calibri', size: 10, italic: true, color: { argb: 'FF64748B' } };
  subCell.alignment = { horizontal: 'center', vertical: 'middle' };
  wsResumen.getRow(2).height = 18;

  wsResumen.addRow([]); // Espaciador

  // Sección: Resumen de Totales
  const h1 = wsResumen.addRow(['CONCEPTO', 'MONTO (CUP)', 'DETALLE / OBSERVACIÓN', '']);
  wsResumen.mergeCells(`A${h1.number}:D${h1.number}`);
  h1.getCell(1).value = 'TOTALES GENERALES DE LA JORNADA';
  h1.getCell(1).fill = darkNavyFill;
  h1.getCell(1).font = whiteHeaderFont;
  h1.getCell(1).alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
  h1.height = 24;

  const filasTotales = [
    ['Total Facturado (Ventas Brutas)', resumenDia.totales.totalVentas, 'Importe bruto facturado'],
    ['Total devuelto / anulado', resumenDia.totales.totalDevoluciones, `${resumenDia.totales.cantidadDevoluciones} devoluciones o ventas anuladas`],
    ['Ventas Netas Realizadas', resumenDia.totales.ventasNetas !== undefined ? resumenDia.totales.ventasNetas : (resumenDia.totales.totalVentas - resumenDia.totales.totalDevoluciones), 'Ingreso neto tras descontar reembolsos'],
    ['Costo de artículos vendidos', resumenDia.totales.costoArticulosVendidos || 0, 'Costo de compra registrado para los artículos vendidos'],
    ['Ganancias Netas del Día', resumenDia.totales.gananciasNetas !== undefined ? resumenDia.totales.gananciasNetas : 0, 'Ventas menos costo de compra, devoluciones y anulaciones'],
    ['Total Efectivo Ventas', resumenDia.totales.totalEfectivo, 'Pagos recibidos en efectivo'],
    ['Devoluciones en Efectivo', resumenDia.totales.totalDevolucionesEfectivo || 0, 'Reembolsos descontados de gaveta'],
    ['Total Transferencias Ventas', resumenDia.totales.totalTransferencia, 'EnZona / Transfermóvil'],
    ['Devoluciones por Transferencia', resumenDia.totales.totalDevolucionesTransferencia || 0, 'Reembolsos canal digital'],
    ['Devoluciones Mixtas', resumenDia.totales.totalDevolucionesMixto || 0, 'Reembolsos con método mixto'],
    ['Tickets de Venta Emitidos', resumenDia.totales.cantidadTickets, 'Operaciones registradas'],
    ['Artículos Totales Vendidos', resumenDia.totales.totalArticulosVendidos, 'Unidades despachadas'],
    ['Efectivo contado en gaveta', resumenDia.totales.efectivoContado, 'Conteo de efectivo y monedas'],
    ['Transferencias contadas', resumenDia.totales.transferenciaContada, 'Transferencias confirmadas en el cierre'],
    ['Total contado en caja', resumenDia.totales.totalContado, 'Efectivo más transferencias'],
    ['Diferencia de Caja', resumenDia.totales.diferencia, resumenDia.totales.diferencia === 0 ? '✓ Cuadrado Exacto' : (resumenDia.totales.diferencia > 0 ? 'Sobrante en caja' : 'Faltante en caja')],
  ];

  filasTotales.forEach((item, idx) => {
    const row = wsResumen.addRow([item[0], item[1], item[2]]);
    row.getCell(1).font = boldTextFont;
    row.getCell(2).font = boldTextFont;
    row.getCell(3).font = regularTextFont;

    if (typeof item[1] === 'number') {
      row.getCell(2).numFmt = '$#,##0.00';
      row.getCell(2).alignment = { horizontal: 'right' };
    }
    if (idx % 2 === 1) {
      row.eachCell((c) => { c.fill = lightZebraFill; });
    }
    row.eachCell((c) => { c.border = thinBorder; });
  });

  wsResumen.addRow([]); // Espaciador

  // Sección: Distribución por Método de Pago
  const h2 = wsResumen.addRow(['MÉTODO DE PAGO', 'TOTAL RECAUDADO (CUP)', 'PARTICIPACIÓN %', 'OPERACIONES']);
  h2.eachCell((c) => {
    c.fill = slateHeaderFill;
    c.font = whiteHeaderFont;
    c.alignment = { horizontal: 'center', vertical: 'middle' };
  });
  h2.height = 22;

  (resumenDia.porMetodoPago || []).forEach((mp, idx) => {
    const row = wsResumen.addRow([
      mp.metodo,
      mp.total,
      `${mp.porcentaje}%`,
      mp.operaciones || 0,
    ]);
    row.getCell(1).font = boldTextFont;
    row.getCell(2).numFmt = '$#,##0.00';
    row.getCell(2).alignment = { horizontal: 'right' };
    row.getCell(3).alignment = { horizontal: 'center' };
    row.getCell(4).alignment = { horizontal: 'center' };
    if (idx % 2 === 1) {
      row.eachCell((c) => { c.fill = lightZebraFill; });
    }
    row.eachCell((c) => { c.border = thinBorder; });
  });

  // Sección opcional: Desglose de Arqueo Físico
  if (resumenDia.denominaciones && resumenDia.denominaciones.length > 0) {
    wsResumen.addRow([]); // Espaciador
    const h3 = wsResumen.addRow(['DENOMINACIÓN', 'VALOR FACIAL (CUP)', 'CANTIDAD CONTADA', 'SUBTOTAL (CUP)']);
    h3.eachCell((c) => {
      c.fill = slateHeaderFill;
      c.font = whiteHeaderFont;
      c.alignment = { horizontal: 'center', vertical: 'middle' };
    });
    h3.height = 22;

    resumenDia.denominaciones.forEach((d, idx) => {
      const subtotal = Number(d.value) * Number(d.count);
      const row = wsResumen.addRow([
        d.label,
        Number(d.value),
        Number(d.count),
        subtotal,
      ]);
      row.getCell(2).numFmt = '$#,##0.00';
      row.getCell(3).alignment = { horizontal: 'center' };
      row.getCell(4).numFmt = '$#,##0.00';
      row.getCell(4).font = boldTextFont;
      row.getCell(4).alignment = { horizontal: 'right' };
      if (idx % 2 === 1) {
        row.eachCell((c) => { c.fill = lightZebraFill; });
      }
      row.eachCell((c) => { c.border = thinBorder; });
    });
  }

  /* ------------------------------------------------------------- */
  /* HOJA 2: DETALLE                                               */
  /* ------------------------------------------------------------- */
  const wsDetalle = workbook.addWorksheet('Detalle', {
    views: [{ showGridLines: true }],
  });

  wsDetalle.columns = [
    { header: 'CÓDIGO', key: 'codigo', width: 14 },
    { header: 'DESCRIPCIÓN DEL PRODUCTO', key: 'nombre', width: 36 },
    { header: 'CATEGORÍA', key: 'categoria', width: 18 },
    { header: 'U/M', key: 'um', width: 12 },
    { header: 'PRECIO UNIT. (CUP)', key: 'precioUnitario', width: 20 },
    { header: 'CANTIDAD VENDIDA', key: 'cantidad', width: 18 },
    { header: 'IMPORTE TOTAL (CUP)', key: 'total', width: 22 },
    { header: '% PARTICIPACIÓN', key: 'porcentaje', width: 16 },
  ];

  const headerRowDetalle = wsDetalle.getRow(1);
  headerRowDetalle.eachCell((c) => {
    c.fill = darkNavyFill;
    c.font = whiteHeaderFont;
    c.alignment = { horizontal: 'center', vertical: 'middle' };
  });
  headerRowDetalle.height = 26;

  (resumenDia.ventasPorProducto || []).forEach((item, idx) => {
    const row = wsDetalle.addRow({
      codigo: item.codigo,
      nombre: item.nombre,
      categoria: item.categoria,
      um: item.um,
      precioUnitario: item.precioUnitario,
      cantidad: item.cantidad,
      total: item.total,
      porcentaje: `${item.porcentaje}%`,
    });

    row.getCell(1).alignment = { horizontal: 'center' };
    row.getCell(4).alignment = { horizontal: 'center' };
    row.getCell(5).numFmt = '$#,##0.00';
    row.getCell(5).alignment = { horizontal: 'right' };
    row.getCell(6).numFmt = '#,##0.00';
    row.getCell(6).alignment = { horizontal: 'right' };
    row.getCell(7).numFmt = '$#,##0.00';
    row.getCell(7).font = boldTextFont;
    row.getCell(7).alignment = { horizontal: 'right' };
    row.getCell(8).alignment = { horizontal: 'center' };

    if (idx % 2 === 1) {
      row.eachCell((c) => { c.fill = lightZebraFill; });
    }
    row.eachCell((c) => { c.border = thinBorder; });
  });

  // Fila de totales generales al pie del detalle
  if (resumenDia.ventasPorProducto && resumenDia.ventasPorProducto.length > 0) {
    const totalRow = wsDetalle.addRow({
      codigo: 'TOTAL',
      nombre: 'TOTAL GENERAL DE VENTAS DE LA JORNADA',
      categoria: '',
      um: '',
      precioUnitario: '',
      cantidad: resumenDia.totales.totalArticulosVendidos,
      total: resumenDia.totales.totalVentas,
      porcentaje: '100%',
    });
    totalRow.eachCell((c) => {
      c.font = boldTextFont;
      c.fill = accentTotalFill;
      c.border = thinBorder;
    });
    totalRow.getCell(6).numFmt = '#,##0.00';
    totalRow.getCell(6).alignment = { horizontal: 'right' };
    totalRow.getCell(7).numFmt = '$#,##0.00';
    totalRow.getCell(7).alignment = { horizontal: 'right' };
    totalRow.getCell(8).alignment = { horizontal: 'center' };
    totalRow.height = 22;
  }

  /* ------------------------------------------------------------- */
  /* HOJA 3: DEVOLUCIONES DE LA JORNADA                            */
  /* ------------------------------------------------------------- */
  const wsDevoluciones = workbook.addWorksheet('Devoluciones', {
    views: [{ showGridLines: true }],
  });

  wsDevoluciones.columns = [
    { header: 'FOLIO DEVOLUCIÓN', key: 'folio', width: 18 },
    { header: 'HORA', key: 'hora', width: 12 },
    { header: 'TICKET VENTA', key: 'ticket', width: 18 },
    { header: 'CLIENTE', key: 'cliente', width: 24 },
    { header: 'MOTIVO DE DEVOLUCIÓN', key: 'motivo', width: 30 },
    { header: 'MÉTODO DE REEMBOLSO', key: 'metodo', width: 22 },
    { header: 'ARTÍCULOS Y CANTIDADES', key: 'articulos', width: 40 },
    { header: 'CONDICIÓN', key: 'condicion', width: 18 },
    { header: 'TOTAL REEMBOLSADO (CUP)', key: 'totalRefund', width: 24 },
  ];

  const headerRowDevoluciones = wsDevoluciones.getRow(1);
  headerRowDevoluciones.eachCell((c) => {
    c.fill = darkNavyFill;
    c.font = whiteHeaderFont;
    c.alignment = { horizontal: 'center', vertical: 'middle' };
  });
  headerRowDevoluciones.height = 26;

  const devolucionesList = resumenDia.devoluciones || [];
  const ventasAnuladasList = resumenDia.ventasAnuladas || [];
  if (devolucionesList.length === 0 && ventasAnuladasList.length === 0) {
    const emptyRow = wsDevoluciones.addRow({
      folio: 'SIN REGISTROS',
      hora: '--:--',
      ticket: 'N/A',
      cliente: 'Sin cliente registrado',
      motivo: 'No se procesaron devoluciones en esta jornada',
      metodo: 'N/A',
      articulos: 'Ningún artículo devuelto',
      condicion: 'N/A',
      totalRefund: 0,
    });
    emptyRow.eachCell((c) => {
      c.font = regularTextFont;
      c.border = thinBorder;
    });
  } else {
    devolucionesList.forEach((d, idx) => {
      const articulosStr = (d.items || [])
        .map((it) => `${it.name} (x${it.quantity} ${it.um || 'u.'})`)
        .join(', ');
      const condicionStr = d.hasDamagedItems ? 'Con merma / Dañado' : 'Buen estado';

      const row = wsDevoluciones.addRow({
        folio: d.returnNumber || 'DEV-N/A',
        hora: d.hora || '--:--',
        ticket: d.ticketNumber || 'Venta Directa',
        cliente: d.customerName || 'Cliente general',
        motivo: d.reason || 'Sin motivo especificado',
        metodo: (d.refundMethod || 'efectivo').toUpperCase(),
        articulos: articulosStr || 'Artículo devuelto',
        condicion: condicionStr,
        totalRefund: d.totalRefund,
      });

      row.getCell(1).alignment = { horizontal: 'center' };
      row.getCell(2).alignment = { horizontal: 'center' };
      row.getCell(3).alignment = { horizontal: 'center' };
      row.getCell(6).alignment = { horizontal: 'center' };
      row.getCell(8).alignment = { horizontal: 'center' };
      row.getCell(9).numFmt = '$#,##0.00';
      row.getCell(9).font = boldTextFont;
      row.getCell(9).alignment = { horizontal: 'right' };

      if (idx % 2 === 1) {
        row.eachCell((c) => { c.fill = lightZebraFill; });
      }
      row.eachCell((c) => { c.border = thinBorder; });
    });

    ventasAnuladasList.forEach((sale, idx) => {
      const row = wsDevoluciones.addRow({
        folio: 'ANULADA',
        hora: sale.hora || '--:--',
        ticket: sale.ticketNumber || 'N/A',
        cliente: 'N/A',
        motivo: 'Venta anulada',
        metodo: (sale.paymentMethod || 'N/A').toUpperCase(),
        articulos: 'Venta completa anulada',
        condicion: 'Anulada',
        totalRefund: sale.total,
      });
      row.getCell(9).numFmt = '$#,##0.00';
      row.getCell(9).alignment = { horizontal: 'right' };
      if ((devolucionesList.length + idx) % 2 === 1) {
        row.eachCell((c) => { c.fill = lightZebraFill; });
      }
      row.eachCell((c) => { c.border = thinBorder; });
    });

    const totalDevRow = wsDevoluciones.addRow({
      folio: 'TOTAL',
      hora: '',
      ticket: '',
      cliente: '',
      motivo: 'TOTAL DEVUELTO / ANULADO DE LA JORNADA',
      metodo: '',
      articulos: `${resumenDia.totales.totalUnidadesDevueltas || 0} unidades devueltas`,
      condicion: '',
      totalRefund: resumenDia.totales.totalDevoluciones,
    });
    totalDevRow.eachCell((c) => {
      c.font = boldTextFont;
      c.fill = accentTotalFill;
      c.border = thinBorder;
    });
    totalDevRow.getCell(9).numFmt = '$#,##0.00';
    totalDevRow.getCell(9).alignment = { horizontal: 'right' };
    totalDevRow.height = 22;
  }

  await workbook.xlsx.writeFile(outputPath);
  return outputPath;
}

module.exports = { generarExcelCierre };
