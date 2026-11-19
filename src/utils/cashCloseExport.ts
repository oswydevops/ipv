import { Denomination, ReturnRecord, SaleRecord } from '../types';

interface CashCloseExportInput {
  date: string;
  responsibleName: string;
  isClosed: boolean;
  ipvTotalVendido: number;
  denominations: Denomination[];
  menoresAmount: number;
  transferenciasAmount: number;
  sales: SaleRecord[];
  returns: ReturnRecord[];
}

export const generateWebCashCloseExport = ({
  date,
  responsibleName,
  isClosed,
  ipvTotalVendido,
  denominations,
  menoresAmount,
  transferenciasAmount,
  sales,
  returns,
}: CashCloseExportInput): string => {
  const now = new Date();
  const returnsToday = returns.filter((record) => record.date === date);
  const totalRefundToday = returnsToday.reduce((total, record) => total + (record.totalRefund || 0), 0);
  const activeSalesToday = sales.filter((sale) => sale.date === date && !sale.voided);
  const returnedSaleIds = new Set(returnsToday.map((record) => record.saleId).filter(Boolean));
  const voidedSalesTotal = sales
    .filter((sale) => sale.voided && sale.date === date && !returnedSaleIds.has(sale.id))
    .reduce((total, sale) => total + (sale.total || 0), 0);
  const costOfGoodsToday = activeSalesToday.reduce(
    (total, sale) => total + (sale.items || []).reduce(
      (cost, item) => cost + (Number(item.purchasePrice) || 0) * item.quantity,
      0
    ),
    0
  );
  const netProfitToday =
    activeSalesToday.reduce((total, sale) => total + (sale.total || 0), 0) -
    costOfGoodsToday -
    totalRefundToday -
    voidedSalesTotal;
  const totalCashSales = activeSalesToday.reduce((total, sale) => total + (sale.efectivoAmount || 0), 0);
  const totalTransferSales = activeSalesToday.reduce(
    (total, sale) => total + (sale.transferenciaAmount || 0),
    0
  );
  const totalCashCounted =
    denominations.reduce((total, denomination) => total + denomination.value * denomination.count, 0) +
    (menoresAmount || 0);
  const totalCounted = totalCashCounted + (transferenciasAmount || 0);
  const totalPieces = denominations.reduce((total, denomination) => total + denomination.count, 0);

  const rows = [
    'REPORTE OFICIAL DE CIERRE DE CAJA DIARIO - IPV',
    `Fecha de Cierre: ${date} | Generado: ${now.toLocaleTimeString('es-CU')}`,
    `Responsable: ${responsibleName} | Estado: ${isClosed ? 'Cerrado' : 'Abierto / En Arqueo'}`,
    '',
    '--- RESUMEN GENERAL DE OPERACIONES ---',
    'Concepto;Monto ($);Detalle / Observación',
    `Total Facturado (Ventas Brutas);${ipvTotalVendido.toFixed(2)};Importe bruto según IPV`,
    `Total Devoluciones / Reembolsos;-${totalRefundToday.toFixed(2)};${returnsToday.length} devoluciones procesadas`,
    `Ventas Netas Realizadas;${Math.max(0, ipvTotalVendido - totalRefundToday).toFixed(2)};Ingreso neto efectivo tras reembolsos`,
    `Costo de Artículos Vendidos;${costOfGoodsToday.toFixed(2)};Costo de compra registrado para las ventas de la jornada`,
    `Ganancias Netas del Día;${netProfitToday.toFixed(2)};Ventas menos costo de compra, devoluciones y anulaciones`,
    `Total Ventas Efectivo;${totalCashSales.toFixed(2)};Cobros en efectivo`,
    `Total Transferencias;${totalTransferSales.toFixed(2)};EnZona / Transfermóvil`,
    `Efectivo Físico en Gaveta;${totalCounted.toFixed(2)};Total del arqueo físico`,
    `Diferencia de Caja;${(totalCounted - ipvTotalVendido).toFixed(2)};${
      totalCounted === ipvTotalVendido
        ? 'Cuadrado Exacto'
        : totalCounted > ipvTotalVendido
          ? 'Sobrante en caja'
          : 'Faltante en caja'
    }`,
    '',
    '--- CONTEO DE BILLETES Y EFECTIVO FÍSICO ---',
    'Denominación;Valor Unitario ($);Cantidad de Piezas;Importe Total ($)',
    ...denominations.map(
      (denomination) =>
        `"${denomination.label}";${denomination.value.toFixed(2)};${denomination.count};${(
          denomination.value * denomination.count
        ).toFixed(2)}`
    ),
    `"Fondo de Menores / Monedas";0.00;1;${(menoresAmount || 0).toFixed(2)}`,
    `"Total Efectivo Contado";0.00;${totalPieces};${totalCounted.toFixed(2)}`,
    '',
    '--- REGISTRO DETALLADO DE DEVOLUCIONES DE LA JORNADA ---',
    'Folio;Hora;Ticket Origen;Cliente;Motivo de Devolución;Método de Reembolso;Artículos Devueltos;Uds;Condición;Monto Reembolsado ($)',
  ];

  if (returnsToday.length === 0) {
    rows.push('Sin devoluciones registradas en esta jornada;;;;;;;;;');
  } else {
    returnsToday.forEach((record) => {
      const totalUnits = (record.items || []).reduce((total, item) => total + (item.quantity || 1), 0);
      const items = (record.items || [])
        .map((item) => `${item.name} (x${item.quantity} ${item.um || 'u.'})`)
        .join(', ');
      const condition = record.hasDamagedItems ? 'Con merma / Dañado' : 'Buen estado / Reintegrado';
      rows.push([
        `"${record.returnNumber || 'DEV-N/A'}"`,
        `"${record.timestamp || '--:--'}"`,
        `"${record.ticketNumber || 'Venta directa'}"`,
        `"${(record.customerName || 'Cliente general').replace(/"/g, '""')}"`,
        `"${(record.reason || 'Sin motivo especificado').replace(/"/g, '""')}"`,
        `"${(record.refundMethod || 'efectivo').toUpperCase()}"`,
        `"${items.replace(/"/g, '""')}"`,
        totalUnits,
        `"${condition}"`,
        `-${(record.totalRefund || 0).toFixed(2)}`,
      ].join(';'));
    });
  }

  const refundCashToday = returnsToday
    .filter((record) => record.refundMethod === 'efectivo')
    .reduce((total, record) => total + (record.totalRefund || 0), 0);
  const refundTransferToday = returnsToday
    .filter((record) => record.refundMethod === 'transferencia')
    .reduce((total, record) => total + (record.totalRefund || 0), 0);
  const refundMixedToday = returnsToday
    .filter((record) => record.refundMethod === 'mixto')
    .reduce((total, record) => total + (record.totalRefund || 0), 0);

  rows.push(
    '',
    '"--- RESUMEN DETALLADO DE REEMBOLSOS POR CANAL DE PAGO ---";;;',
    '"Canal / Método";"Monto Reembolsado ($)";"Operaciones";',
    `"Efectivo";-${refundCashToday.toFixed(2)};${returnsToday.filter((record) => record.refundMethod === 'efectivo').length};`,
    `"Transferencia";-${refundTransferToday.toFixed(2)};${returnsToday.filter((record) => record.refundMethod === 'transferencia').length};`,
    `"Mixto";-${refundMixedToday.toFixed(2)};${returnsToday.filter((record) => record.refundMethod === 'mixto').length};`,
    `"Total Reembolsos del Día ($)";-${totalRefundToday.toFixed(2)};${returnsToday.length};`,
    `"Ventas Netas Efectivas del Día ($)";${Math.max(0, ipvTotalVendido - totalRefundToday).toFixed(2)};;`
  );

  return '\uFEFF' + rows.join('\r\n');
};
