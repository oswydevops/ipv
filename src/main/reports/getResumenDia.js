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

  const devolucionesRows = db.prepare(`
    SELECT
      r.id, r.sale_id, r.return_number, r.timestamp, r.total_refund, r.refund_method,
      r.customer_name, r.reason,
      ri.product_id, ri.code, ri.name, ri.um, ri.quantity, ri.unit_price,
      ri.refund_amount, ri.condition, ri.damaged_reason, ri.reintegrate_to_stock
    FROM returns r
    LEFT JOIN return_items ri ON ri.return_id = r.id
    WHERE r.date = ?
    ORDER BY r.created_at, ri.id
  `).all(fecha);

  const devoluciones = [];
  for (const row of devolucionesRows) {
    let devolucion = devoluciones.find((item) => item.id === row.id);
    if (!devolucion) {
      devolucion = {
        id: row.id,
        saleId: row.sale_id,
        numero: row.return_number,
        hora: row.timestamp,
        importe: Number(row.total_refund || 0),
        metodo: row.refund_method || 'efectivo',
        cliente: row.customer_name || '',
        motivo: row.reason || '',
        items: [],
      };
      devoluciones.push(devolucion);
    }
    if (row.product_id !== null) {
      devolucion.items.push({
        codigo: row.code || '',
        producto: row.name || '',
        um: row.um || '',
        cantidad: Number(row.quantity || 0),
        precioUnitario: Number(row.unit_price || 0),
        importe: Number(row.refund_amount || 0),
        condicion: row.condition || '',
        motivoDano: row.damaged_reason || '',
        reintegrado: Boolean(row.reintegrate_to_stock),
      });
    }
  }

  const devolucionesPorMetodo = devoluciones.reduce((totals, item) => {
    const method = item.metodo;
    totals[method] = (totals[method] || 0) + item.importe;
    return totals;
  }, {});

  const ventasAnuladas = db.prepare(`
    SELECT id, ticket_number, time, payment_method, efectivo, transferencia, total, voided_at
    FROM sales
    WHERE date = ? AND voided_at IS NOT NULL
    ORDER BY voided_at
  `).all(fecha)
    .filter((sale) => !devoluciones.some((devolucion) => devolucion.saleId === sale.id))
    .map((sale) => ({
      ticket: `TKT-${String(sale.ticket_number).padStart(5, '0')}`,
      hora: sale.time,
      metodo: sale.payment_method,
      efectivo: Number(sale.efectivo || 0),
      transferencia: Number(sale.transferencia || 0),
      importe: Number(sale.total || 0),
      anuladaEn: sale.voided_at,
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

  const efectivoContado = closeRow
    ? denominaciones.reduce((total, item) => total + Number(item.value || 0) * Number(item.count || 0), 0)
      + Number(closeRow.menores || 0)
    : Number(salesSummary.totalEfectivo || 0);
  const transferenciaContada = closeRow
    ? Number(closeRow.transferencias || 0)
    : Number(salesSummary.totalTransferencia || 0);
  const totalDevolucionesRegistradas = devoluciones.reduce((total, item) => total + item.importe, 0);
  const efectivoDevuelto = Number(devolucionesPorMetodo.efectivo || 0);
  const transferenciaDevuelta = Number(devolucionesPorMetodo.transferencia || 0);
  const totalAnulaciones = ventasAnuladas.reduce((total, item) => total + item.importe, 0);

  return {
    fecha,
    fechaFormateada: fecha.split('-').reverse().join('/'),
    generadoEn: new Date().toLocaleString('es-CU'),
    totales: {
      totalVentas: Number(salesSummary.totalVentas || 0),
      totalEfectivo: Number(salesSummary.totalEfectivo || 0),
      totalTransferencia: Number(salesSummary.totalTransferencia || 0),
      totalDevoluciones: totalDevolucionesRegistradas + totalAnulaciones,
      cantidadDevoluciones: devoluciones.length + ventasAnuladas.length,
      totalDevolucionesRegistradas,
      cantidadDevolucionesRegistradas: devoluciones.length,
      totalVentasAnuladas: totalAnulaciones,
      cantidadVentasAnuladas: ventasAnuladas.length,
      efectivoDevuelto,
      transferenciaDevuelta,
      otrosReembolsos: Number(devolucionesPorMetodo.mixto || 0),
      totalArticulosVendidos,
      cantidadTickets: Number(salesSummary.ticketsCount || 0),
      // Datos del arqueo/cierre
      estaCerrado: Boolean(closeRow),
      estadoCierre: closeRow ? 'Cerrado' : 'Abierto / En jornada',
      cerradoEn: closeRow ? closeRow.closed_at : null,
      efectivoContado,
      transferenciaContada,
      menoresAmount: closeRow ? Number(closeRow.menores || 0) : 0,
      totalContado: closeRow
        ? Number(closeRow.total_contado || 0)
        : Number(salesSummary.totalEfectivo || 0) + Number(salesSummary.totalTransferencia || 0),
      totalIpv: closeRow ? Number(closeRow.total_ipv || 0) : Number(salesSummary.totalVentas || 0),
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
