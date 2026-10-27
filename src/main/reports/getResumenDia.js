'use strict';

/**
 * Consulta SQLite y devuelve un objeto con totales, ventas por producto y por método de pago
 * para una fecha dada (AAAA-MM-DD).
 *
 * @param {string} fecha - Fecha en formato 'AAAA-MM-DD'
 * @param {import('better-sqlite3').Database} [dbInstance] - Instancia de better-sqlite3 opcional
 * @returns {object} Resumen diario estructurado
 */
function getResumenDia(fecha, dbInstance) {
  if (!fecha || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    throw new Error('Fecha inválida. Se espera el formato AAAA-MM-DD');
  }

  // Si no se pasó una instancia de DB explícita, intentar obtener la instancia activa
  let db = dbInstance;
  if (!db) {
    try {
      const { openDatabase } = require('../../electron/db.cjs');
      const { app } = require('electron');
      const path = require('path');
      const dbFile = path.join(app.getPath('userData'), 'ipv.sqlite');
      const store = openDatabase(dbFile);
      db = store.db;
    } catch {
      // Si aún no está disponible, fallará más adelante si se intenta ejecutar sin db
    }
  }

  if (!db) {
    throw new Error('No se proporcionó una conexión válida a la base de datos SQLite.');
  }

  // 1. Resumen de ventas activas del día (no anuladas)
  const salesSummary = db.prepare(`
    SELECT
      COUNT(*) AS ticketsCount,
      COALESCE(SUM(total), 0) AS totalVentas,
      COALESCE(SUM(efectivo), 0) AS totalEfectivo,
      COALESCE(SUM(transferencia), 0) AS totalTransferencia
    FROM sales
    WHERE date = ? AND voided_at IS NULL
  `).get(fecha) || { ticketsCount: 0, totalVentas: 0, totalEfectivo: 0, totalTransferencia: 0 };

  const costSummary = db.prepare(`
    SELECT COALESCE(SUM(si.unit_cost * si.quantity), 0) AS costOfGoods
    FROM sale_items si
    JOIN sales s ON s.id = si.sale_id
    WHERE s.date = ? AND s.voided_at IS NULL
  `).get(fecha) || { costOfGoods: 0 };

  // 2. Ventas anuladas del día (devoluciones / reembolsos)
  const voidedSummary = db.prepare(`
    SELECT
      COUNT(*) AS voidedCount,
      COALESCE(SUM(total), 0) AS voidedTotal,
      COALESCE(SUM(efectivo), 0) AS voidedCash,
      COALESCE(SUM(transferencia), 0) AS voidedTransfer
    FROM sales
    WHERE date = ? AND voided_at IS NOT NULL
  `).get(fecha) || { voidedCount: 0, voidedTotal: 0 };

  const ventasAnuladasRaw = db.prepare(`
    SELECT id, ticket_number, time, payment_method, efectivo, transferencia, total
    FROM sales
    WHERE date = ? AND voided_at IS NOT NULL
    ORDER BY time ASC
  `).all(fecha);
  const ventasAnuladas = ventasAnuladasRaw.map((sale) => ({
    id: sale.id,
    ticketNumber: `TKT-${String(sale.ticket_number).padStart(5, '0')}`,
    hora: sale.time,
    paymentMethod: sale.payment_method,
    efectivo: Number(sale.efectivo || 0),
    transferencia: Number(sale.transferencia || 0),
    total: Number(sale.total || 0),
  }));

  // 3. Ventas agrupadas por producto
  const productRows = db.prepare(`
    SELECT 
      si.code AS codigo,
      si.name AS nombre,
      COALESCE(p.category, 'General') AS categoria,
      si.um AS um,
      si.unit_price AS precioUnitario,
      SUM(si.quantity) AS cantidad,
      SUM(si.subtotal) AS total
    FROM sale_items si
    JOIN sales s ON si.sale_id = s.id
    LEFT JOIN products p ON si.product_id = p.id
    WHERE s.date = ? AND s.voided_at IS NULL
    GROUP BY si.code, si.name, p.category, si.um, si.unit_price
    ORDER BY total DESC, cantidad DESC
  `).all(fecha);

  const totalArticulosVendidos = productRows.reduce((acc, r) => acc + Number(r.cantidad || 0), 0);

  const ventasPorProducto = productRows.map((p) => {
    const total = Number(p.total || 0);
    const pct = salesSummary.totalVentas > 0 ? (total / salesSummary.totalVentas) * 100 : 0;
    return {
      codigo: p.codigo,
      nombre: p.nombre,
      categoria: p.categoria,
      um: p.um,
      precioUnitario: Number(p.precioUnitario || 0),
      cantidad: Number(p.cantidad || 0),
      total: total,
      porcentaje: Number(pct.toFixed(1)),
      porcentajeStr: `${pct.toFixed(1)}%`,
    };
  });

  // 4. Ventas agrupadas por método de pago
  const paymentMethodsRaw = db.prepare(`
    SELECT 
      payment_method AS metodo,
      COUNT(*) AS operaciones,
      COALESCE(SUM(total), 0) AS total
    FROM sales
    WHERE date = ? AND voided_at IS NULL
    GROUP BY payment_method
  `).all(fecha);

  const porMetodoPago = [
    {
      metodo: 'Efectivo',
      total: Number(salesSummary.totalEfectivo || 0),
      porcentaje: salesSummary.totalVentas > 0
        ? Number(((salesSummary.totalEfectivo / salesSummary.totalVentas) * 100).toFixed(1))
        : 0,
      porcentajeStr: salesSummary.totalVentas > 0
        ? `${((salesSummary.totalEfectivo / salesSummary.totalVentas) * 100).toFixed(1)}%`
        : '0%',
      operaciones: paymentMethodsRaw.find((m) => m.metodo === 'efectivo')?.operaciones || 0,
    },
    {
      metodo: 'Transferencia',
      total: Number(salesSummary.totalTransferencia || 0),
      porcentaje: salesSummary.totalVentas > 0
        ? Number(((salesSummary.totalTransferencia / salesSummary.totalVentas) * 100).toFixed(1))
        : 0,
      porcentajeStr: salesSummary.totalVentas > 0
        ? `${((salesSummary.totalTransferencia / salesSummary.totalVentas) * 100).toFixed(1)}%`
        : '0%',
      operaciones: paymentMethodsRaw.find((m) => m.metodo === 'transferencia')?.operaciones || 0,
    },
  ];

  // 5. Cierre de caja del día (si existe en day_closes)
  const closeRow = db.prepare(`
    SELECT * FROM day_closes WHERE date = ?
  `).get(fecha);

  let denominaciones = [];
  if (closeRow && closeRow.denominations) {
    try {
      denominaciones = JSON.parse(closeRow.denominations);
    } catch {
      denominaciones = [];
    }
  }

  // 6. Devoluciones registradas en la tabla returns
  const returnRows = db.prepare(`
      SELECT
        id, return_number, sale_id, ticket_number, timestamp,
        total_refund, refund_method, customer_name, reason, has_damaged_items
      FROM returns
      WHERE date = ?
      ORDER BY timestamp ASC
  `).all(fecha);

  const getItemsStmt = db.prepare(`
      SELECT product_id, code, name, um, quantity, unit_price, refund_amount, condition, damaged_reason
      FROM return_items WHERE return_id = ?
  `);

  const devoluciones = returnRows.map((r) => ({
      id: r.id,
      returnNumber: r.return_number,
      saleId: r.sale_id,
      ticketNumber: r.ticket_number,
      hora: r.timestamp,
      totalRefund: Number(r.total_refund || 0),
      refundMethod: r.refund_method,
      customerName: r.customer_name || 'Cliente general',
      reason: r.reason || 'Sin motivo especificado',
      hasDamagedItems: Boolean(r.has_damaged_items),
      items: getItemsStmt.all(r.id).map((it) => ({
        code: it.code,
        name: it.name,
        um: it.um,
        quantity: Number(it.quantity || 0),
        unitPrice: Number(it.unit_price || 0),
        refundAmount: Number(it.refund_amount || 0),
        condition: it.condition,
        damagedReason: it.damaged_reason,
      })),
    }));

  const totalDevolucionesMonto =
    devoluciones.reduce((acc, d) => acc + d.totalRefund, 0) +
    Number(voidedSummary.voidedTotal || 0);

  const totalDevolucionesEfectivo = devoluciones
    .filter((d) => d.refundMethod === 'efectivo')
    .reduce((acc, d) => acc + d.totalRefund, 0) +
    Number(voidedSummary.voidedCash || 0);

  const totalDevolucionesTransferencia = devoluciones
    .filter((d) => d.refundMethod === 'transferencia')
    .reduce((acc, d) => acc + d.totalRefund, 0) +
    Number(voidedSummary.voidedTransfer || 0);

  const totalDevolucionesMixto = devoluciones
    .filter((d) => d.refundMethod === 'mixto')
    .reduce((acc, d) => acc + d.totalRefund, 0);

  const totalUnidadesDevueltas = devoluciones.reduce(
    (acc, d) => acc + (d.items || []).reduce((s, it) => s + (it.quantity || 1), 0),
    0
  );

  const totalVentasBrutas = Number(salesSummary.totalVentas || 0);
  const ventasNetas = Math.max(0, totalVentasBrutas - totalDevolucionesMonto);
  const costoArticulosVendidos = Number(costSummary.costOfGoods || 0);
  const gananciasNetas = totalVentasBrutas - costoArticulosVendidos - totalDevolucionesMonto;

  return {
    fecha,
    fechaFormateada: fecha.split('-').reverse().join('/'),
    generadoEn: new Date().toLocaleString('es-CU'),
    totales: {
      totalVentas: totalVentasBrutas,
      ventasNetas,
      costoArticulosVendidos,
      gananciasNetas,
      totalEfectivo: Number(salesSummary.totalEfectivo || 0),
      totalTransferencia: Number(salesSummary.totalTransferencia || 0),
      totalDevoluciones: totalDevolucionesMonto,
      cantidadDevoluciones: devoluciones.length || Number(voidedSummary.voidedCount || 0),
      totalDevolucionesEfectivo,
      totalDevolucionesTransferencia,
      totalDevolucionesMixto,
      totalUnidadesDevueltas,
      totalArticulosVendidos,
      cantidadTickets: Number(salesSummary.ticketsCount || 0),
      // Datos del arqueo/cierre
      estaCerrado: Boolean(closeRow),
      estadoCierre: closeRow ? 'Cerrado' : 'Abierto / En jornada',
      cerradoEn: closeRow ? closeRow.closed_at : null,
      totalContado: closeRow ? Number(closeRow.total_contado || 0) : Number(salesSummary.totalEfectivo || 0),
      efectivoContado: closeRow
        ? Math.max(0, Number(closeRow.total_contado || 0) - Number(closeRow.transferencias || 0))
        : Number(salesSummary.totalEfectivo || 0),
      transferenciaContada: closeRow
        ? Number(closeRow.transferencias || 0)
        : Number(salesSummary.totalTransferencia || 0),
      totalIpv: closeRow ? Number(closeRow.total_ipv || 0) : totalVentasBrutas,
      diferencia: closeRow ? Number(closeRow.diferencia || 0) : 0,
      notaCierre: closeRow ? closeRow.note || '' : '',
    },
    porMetodoPago,
    ventasPorProducto,
    denominaciones,
    devoluciones,
    ventasAnuladas,
  };
}

module.exports = { getResumenDia };
