import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { SaleRecord, SaleItem } from '../types';

type PeriodFilter = 'diarias' | 'semanales' | 'mensual';

export const SalesHistoryView: React.FC = () => {
  const { sales = [], cancelSale, products = [], showToast, todayDate } = useApp();

  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('diarias');
  const [searchQuery, setSearchQuery] = useState('');
  const [paymentFilter, setPaymentFilter] = useState<'all' | 'efectivo' | 'transferencia' | 'mixto'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'voided'>('all');
  const [selectedDay, setSelectedDay] = useState<string>(todayDate || new Date().toISOString().slice(0, 10));
  const [selectedWeekIdx, setSelectedWeekIdx] = useState<number>(0); // 0 = Esta semana, 1 = Sem 1, etc.
  const [page, setPage] = useState(1);

  // Modal de Detalle de Ticket
  const [selectedSaleForDetail, setSelectedSaleForDetail] = useState<SaleRecord | null>(null);
  const [saleToVoid, setSaleToVoid] = useState<SaleRecord | null>(null);

  // Fecha límite de 1 mes (31 días hacia atrás)
  const oneMonthCutoffStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 31);
    return d.toISOString().slice(0, 10);
  }, []);

  // 1. Filtrar ventas para que sean estrictamente del último mes (retención de 1 mes)
  const monthSales = useMemo(() => {
    return sales
      .filter((s) => s.date >= oneMonthCutoffStr)
      .sort((a, b) => {
        // Orden descendente por fecha y hora
        if (a.date !== b.date) return b.date.localeCompare(a.date);
        return (b.timestamp || '').localeCompare(a.timestamp || '');
      });
  }, [sales, oneMonthCutoffStr]);

  // Lista de días con ventas en el mes para el selector diario
  const activeDaysInMonth = useMemo(() => {
    const daysSet = new Set<string>();
    monthSales.forEach((s) => daysSet.add(s.date));
    if (todayDate) daysSet.add(todayDate);
    return Array.from(daysSet).sort((a, b) => b.localeCompare(a));
  }, [monthSales, todayDate]);

  // Semanas calculadas de los últimos 30 días (4 bloques de 7 días)
  const weeksList = useMemo(() => {
    const now = new Date();
    const list: { idx: number; label: string; startDate: string; endDate: string }[] = [];

    for (let i = 0; i < 4; i++) {
      const end = new Date(now);
      end.setDate(now.getDate() - (i * 7));
      const start = new Date(now);
      start.setDate(now.getDate() - ((i + 1) * 7 - 1));

      const startStr = start.toISOString().slice(0, 10);
      const endStr = end.toISOString().slice(0, 10);

      const label = i === 0 ? 'Semana Actual (Últimos 7 días)' : `Semana -${i} (${startStr.slice(5)} al ${endStr.slice(5)})`;
      list.push({ idx: i, label, startDate: startStr, endDate: endStr });
    }
    return list;
  }, []);

  // 2. Filtrar ventas según el período seleccionado (diario, semanal o mensual)
  const periodFilteredSales = useMemo(() => {
    if (periodFilter === 'diarias') {
      return monthSales.filter((s) => s.date === selectedDay);
    }
    if (periodFilter === 'semanales') {
      const targetWeek = weeksList[selectedWeekIdx] || weeksList[0];
      return monthSales.filter((s) => s.date >= targetWeek.startDate && s.date <= targetWeek.endDate);
    }
    // Mensual: Todo el mes activo (últimos 30 días)
    return monthSales;
  }, [monthSales, periodFilter, selectedDay, periodFilter, selectedWeekIdx, weeksList]);

  // 3. Aplicar filtros de búsqueda, método de pago y estado
  const finalFilteredSales = useMemo(() => {
    return periodFilteredSales.filter((s) => {
      // Método de pago
      if (paymentFilter !== 'all' && s.paymentMethod !== paymentFilter) return false;

      // Estado anulado
      const isVoided = (s as any).voided;
      if (statusFilter === 'active' && isVoided) return false;
      if (statusFilter === 'voided' && !isVoided) return false;

      // Búsqueda por texto (ticket, producto, código o nota)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const ticketMatch = s.ticketNumber.toLowerCase().includes(q);
        const noteMatch = (s.note || '').toLowerCase().includes(q);
        const itemMatch = (s.items || []).some(
          (it) => it.name.toLowerCase().includes(q) || (it.code || '').toLowerCase().includes(q)
        );
        if (!ticketMatch && !noteMatch && !itemMatch) return false;
      }

      return true;
    });
  }, [periodFilteredSales, paymentFilter, statusFilter, searchQuery]);

  // Estadísticas del filtro actual (excluyendo anuladas para importes netos)
  const stats = useMemo(() => {
    let total = 0;
    let efectivo = 0;
    let transferencia = 0;
    let activeTickets = 0;
    let voidedTickets = 0;

    finalFilteredSales.forEach((s) => {
      const isVoided = (s as any).voided;
      if (isVoided) {
        voidedTickets++;
      } else {
        activeTickets++;
        total += s.total || 0;
        efectivo += s.efectivoAmount || 0;
        transferencia += s.transferenciaAmount || 0;
      }
    });

    const avgTicket = activeTickets > 0 ? total / activeTickets : 0;

    return {
      total,
      efectivo,
      transferencia,
      activeTickets,
      voidedTickets,
      avgTicket,
    };
  }, [finalFilteredSales]);

  // Paginación
  const pageSize = 10;
  const totalPages = Math.max(1, Math.ceil(finalFilteredSales.length / pageSize));
  const validPage = Math.min(page, totalPages);
  const paginatedSales = finalFilteredSales.slice((validPage - 1) * pageSize, validPage * pageSize);
  const startIdx = finalFilteredSales.length === 0 ? 0 : (validPage - 1) * pageSize + 1;
  const endIdx = Math.min(validPage * pageSize, finalFilteredSales.length);

  // Manejo de anulación de venta
  const handleConfirmVoid = async () => {
    if (!saleToVoid) return;
    const success = await cancelSale(saleToVoid.id);
    if (success) {
      if (selectedSaleForDetail?.id === saleToVoid.id) {
        setSelectedSaleForDetail({ ...selectedSaleForDetail, ...({ voided: true } as any) });
      }
      setSaleToVoid(null);
    }
  };


  // Impresión de ticket térmico
  const handlePrintSale = (sale: SaleRecord) => {
    const printWindow = window.open('', '_blank', 'width=380,height=600');
    if (!printWindow) {
      showToast('Impresión', 'No se pudo abrir la ventana de impresión. Verifique bloqueadores de popups.', 'error');
      return;
    }

    const itemsRows = (sale.items || [])
      .map(
        (it) => `
        <tr>
          <td style="text-align:left; padding: 4px 0;">${it.name}<br/><span style="font-size:10px; color:#666;">${it.code} (${it.quantity} ${it.um} x $${it.unitPrice.toFixed(2)})</span></td>
          <td style="text-align:right; padding: 4px 0; vertical-align:top; font-weight:bold;">$${it.subtotal.toFixed(2)}</td>
        </tr>`
      )
      .join('');

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8" />
        <title>Ticket ${sale.ticketNumber} - FerreStock</title>
        <style>
          @page { size: 80mm auto; margin: 4mm; }
          body { font-family: 'Courier New', monospace, sans-serif; font-size: 12px; margin: 0; padding: 8px; color: #000; }
          .center { text-align: center; }
          .bold { font-weight: bold; }
          .divider { border-bottom: 1px dashed #000; margin: 8px 0; }
          table { width: 100%; border-collapse: collapse; font-size: 11px; }
          .total-box { font-size: 15px; font-weight: bold; margin: 8px 0; }
        </style>
      </head>
      <body>
        <div class="center">
          <div class="bold" style="font-size: 16px;">FERRESTOCK</div>
          <div style="font-size: 10px;">SISTEMA IPV - CONTROL DE INVENTARIO</div>
          <div class="divider"></div>
          <div class="bold">COMPROBANTE DE VENTA</div>
          <div>Ticket: <strong>${sale.ticketNumber}</strong></div>
          <div>Fecha: ${sale.date} • ${sale.timestamp || ''}</div>
          ${(sale as any).voided ? '<div class="bold" style="color:red; margin-top:4px;">*** VENTA ANULADA ***</div>' : ''}
        </div>
        <div class="divider"></div>
        <table>
          <thead>
            <tr style="border-bottom: 1px solid #000;">
              <th style="text-align:left;">DESCRIPCIÓN</th>
              <th style="text-align:right;">IMPORTE</th>
            </tr>
          </thead>
          <tbody>
            ${itemsRows}
          </tbody>
        </table>
        <div class="divider"></div>
        <div style="display:flex; justify-content:space-between;" class="total-box">
          <span>TOTAL CUP:</span>
          <span>$${sale.total.toFixed(2)}</span>
        </div>
        <div style="font-size: 11px;">
          <div>Método de pago: <strong>${sale.paymentMethod.toUpperCase()}</strong></div>
          ${sale.efectivoAmount ? `<div>Efectivo: $${sale.efectivoAmount.toFixed(2)} CUP</div>` : ''}
          ${sale.transferenciaAmount ? `<div>Transferencia: $${sale.transferenciaAmount.toFixed(2)} CUP</div>` : ''}
          ${sale.amountReceived ? `<div>Recibido: $${sale.amountReceived.toFixed(2)} CUP</div>` : ''}
          ${sale.change ? `<div>Cambio: $${sale.change.toFixed(2)} CUP</div>` : ''}
        </div>
        <div class="divider"></div>
        <div class="center" style="font-size: 10px; margin-top: 12px;">
          <div>¡Gracias por su compra!</div>
          <div>FerreStock - Calidad y Confianza</div>
        </div>
        <script>
          window.onload = function() { window.print(); };
        </script>
      </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  // Descargar ticket en texto
  const handleDownloadTicketTxt = (sale: SaleRecord) => {
    const lines = [
      '========================================',
      '          FERRESTOCK - SISTEMA IPV      ',
      '========================================',
      `TICKET: ${sale.ticketNumber}`,
      `FECHA:  ${sale.date} ${sale.timestamp || ''}`,
      (sale as any).voided ? 'ESTADO: *** ANULADO ***' : 'ESTADO: COMPLETADO',
      '----------------------------------------',
      'CANT | PRODUCTO                 | TOTAL ',
      '----------------------------------------',
      ...((sale.items || []).map((it) => 
        `${String(it.quantity).padEnd(4)} | ${(it.name.slice(0, 24)).padEnd(24)} | $${it.subtotal.toFixed(2)}`
      )),
      '----------------------------------------',
      `TOTAL A PAGAR: $${sale.total.toFixed(2)} CUP`,
      `METODO DE PAGO: ${sale.paymentMethod.toUpperCase()}`,
      sale.efectivoAmount ? `Efectivo: $${sale.efectivoAmount.toFixed(2)} CUP` : '',
      sale.transferenciaAmount ? `Transferencia: $${sale.transferenciaAmount.toFixed(2)} CUP` : '',
      sale.amountReceived ? `Entregado: $${sale.amountReceived.toFixed(2)} CUP` : '',
      sale.change ? `Cambio: $${sale.change.toFixed(2)} CUP` : '',
      '========================================',
      '     ¡GRACIAS POR SU PREFERENCIA!       ',
      '========================================',
    ].filter(Boolean);

    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Ticket_${sale.ticketNumber}_${sale.date}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast('Descarga Exitosa', `Se descargó el comprobante del Ticket ${sale.ticketNumber}.`);
  };

  // Exportar lista de ventas a CSV
  const handleExportCSV = () => {
    const headers = [
      'Ticket',
      'Fecha',
      'Hora',
      'Estado',
      'Metodo_Pago',
      'Total_CUP',
      'Efectivo_CUP',
      'Transferencia_CUP',
      'Articulos',
      'Nota',
    ];

    const rows = finalFilteredSales.map((s) => [
      `"${s.ticketNumber}"`,
      `"${s.date}"`,
      `"${s.timestamp || ''}"`,
      `"${(s as any).voided ? 'Anulada' : 'Completada'}"`,
      `"${s.paymentMethod}"`,
      s.total.toFixed(2),
      (s.efectivoAmount || 0).toFixed(2),
      (s.transferenciaAmount || 0).toFixed(2),
      `"${(s.items || []).map((it) => `${it.quantity}x ${it.name}`).join('; ')}"`,
      `"${(s.note || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Historial_Ventas_${periodFilter}_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast('Historial Exportado', 'Se ha descargado el archivo CSV con los tickets filtrados.');
  };

  return (
    <div className="flex flex-col w-full gap-7 select-none pb-12">
      {/* Header section */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl lg:text-3xl font-headline font-bold text-on-surface tracking-tight">
              Historial de Ventas
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-primary/10 text-primary border border-primary/20 flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px]">history</span>
              Retención de 1 mes (30 días)
            </span>
          </div>
          <p className="text-sm text-on-surface-variant max-w-3xl font-normal leading-relaxed">
            Auditoría de tickets emitidos, reimpresión de comprobantes y control de ventas diarias, semanales y mensuales en CUP.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Exportar CSV */}
          <button
            onClick={handleExportCSV}
            disabled={finalFilteredSales.length === 0}
            className={`h-11 px-4 rounded-xl bg-surface neo-raised flex items-center gap-2 text-xs font-semibold transition-all cursor-pointer ${
              finalFilteredSales.length === 0
                ? 'opacity-40 cursor-not-allowed text-on-surface-variant'
                : 'text-emerald-600 hover:text-emerald-700 active:neo-inset'
            }`}
            type="button"
          >
            <span className="material-symbols-outlined text-[19px]">table_view</span>
            <span>Exportar [.csv]</span>
          </button>
        </div>
      </div>

      {/* Tabs de Período: Diarias | Semanales | Mensual */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-2 rounded-2xl bg-surface neo-raised">
        <div className="p-1 rounded-xl bg-surface neo-inset flex items-center gap-1 w-full sm:w-auto">
          <button
            onClick={() => {
              setPeriodFilter('diarias');
              setPage(1);
            }}
            className={`flex-1 sm:flex-none px-5 py-2 rounded-lg text-xs transition-all cursor-pointer flex items-center justify-center gap-2 ${
              periodFilter === 'diarias'
                ? 'font-bold text-primary bg-surface neo-raised shadow-sm'
                : 'font-medium text-on-surface-variant hover:text-on-surface'
            }`}
            type="button"
          >
            <span className="material-symbols-outlined text-[18px]">calendar_today</span>
            <span>Ventas Diarias</span>
          </button>
          <button
            onClick={() => {
              setPeriodFilter('semanales');
              setPage(1);
            }}
            className={`flex-1 sm:flex-none px-5 py-2 rounded-lg text-xs transition-all cursor-pointer flex items-center justify-center gap-2 ${
              periodFilter === 'semanales'
                ? 'font-bold text-primary bg-surface neo-raised shadow-sm'
                : 'font-medium text-on-surface-variant hover:text-on-surface'
            }`}
            type="button"
          >
            <span className="material-symbols-outlined text-[18px]">date_range</span>
            <span>Ventas Semanales</span>
          </button>
          <button
            onClick={() => {
              setPeriodFilter('mensual');
              setPage(1);
            }}
            className={`flex-1 sm:flex-none px-5 py-2 rounded-lg text-xs transition-all cursor-pointer flex items-center justify-center gap-2 ${
              periodFilter === 'mensual'
                ? 'font-bold text-primary bg-surface neo-raised shadow-sm'
                : 'font-medium text-on-surface-variant hover:text-on-surface'
            }`}
            type="button"
          >
            <span className="material-symbols-outlined text-[18px]">calendar_month</span>
            <span>Acumulado Mensual (30 Días)</span>
          </button>
        </div>

        {/* Selector contextual de fecha según pestaña */}
        <div className="flex items-center gap-2 px-2">
          {periodFilter === 'diarias' && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-on-surface-variant">Día:</span>
              <input
                type="date"
                value={selectedDay}
                min={oneMonthCutoffStr}
                max={todayDate || new Date().toISOString().slice(0, 10)}
                onChange={(e) => {
                  setSelectedDay(e.target.value);
                  setPage(1);
                }}
                className="h-10 px-3 rounded-xl bg-surface neo-inset text-xs font-mono font-bold text-on-surface outline-none focus:ring-1 focus:ring-primary cursor-pointer"
              />
              {selectedDay === todayDate && (
                <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-1 rounded-full">
                  Hoy
                </span>
              )}
            </div>
          )}

          {periodFilter === 'semanales' && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-on-surface-variant">Semana:</span>
              <select
                value={selectedWeekIdx}
                onChange={(e) => {
                  setSelectedWeekIdx(Number(e.target.value));
                  setPage(1);
                }}
                className="h-10 px-3 rounded-xl bg-surface neo-inset text-xs font-semibold text-on-surface outline-none focus:ring-1 focus:ring-primary cursor-pointer"
              >
                {weeksList.map((w) => (
                  <option key={w.idx} value={w.idx}>
                    {w.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {periodFilter === 'mensual' && (
            <div className="text-xs font-semibold text-on-surface-variant flex items-center gap-1.5 px-2">
              <span className="material-symbols-outlined text-[16px] text-primary">verified</span>
              <span>Todos los tickets de los últimos 30 días</span>
            </div>
          )}
        </div>
      </div>

      {/* 4 Tarjetas Bento de Resumen Comercial del Período */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        {/* Total Facturado */}
        <div className="p-5 rounded-2xl bg-surface neo-raised flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold tracking-wide text-on-surface-variant uppercase">
                Total Facturado ({periodFilter})
              </span>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className="text-2xl font-headline font-bold text-on-surface tracking-tight font-mono">
                  {stats.total.toLocaleString('es-CU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <span className="text-xs font-semibold text-primary font-mono">CUP</span>
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-surface neo-inset flex items-center justify-center text-primary">
              <span className="material-symbols-outlined text-[22px]">payments</span>
            </div>
          </div>
          <div className="flex items-center justify-between mt-4 pt-3 border-t border-outline-variant/15 text-xs text-on-surface-variant">
            <span>Tickets activos: <strong className="text-on-surface">{stats.activeTickets}</strong></span>
            {stats.voidedTickets > 0 && (
              <span className="text-amber-600 font-medium">({stats.voidedTickets} anulados)</span>
            )}
          </div>
        </div>

        {/* Ventas en Efectivo */}
        <div className="p-5 rounded-2xl bg-surface neo-raised flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold tracking-wide text-on-surface-variant uppercase">
                Recaudado en Efectivo
              </span>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className="text-2xl font-headline font-bold text-emerald-600 tracking-tight font-mono">
                  {stats.efectivo.toLocaleString('es-CU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <span className="text-xs font-semibold text-emerald-600 font-mono">CUP</span>
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-surface neo-inset flex items-center justify-center text-emerald-600">
              <span className="material-symbols-outlined text-[22px]">point_of_sale</span>
            </div>
          </div>
          <div className="flex items-center justify-between mt-4 pt-3 border-t border-outline-variant/15 text-xs text-on-surface-variant">
            <span>Aporte a caja:</span>
            <span className="font-semibold text-on-surface font-mono">
              {stats.total > 0 ? `${((stats.efectivo / stats.total) * 100).toFixed(1)}%` : '0%'}
            </span>
          </div>
        </div>

        {/* Ventas por Transferencia */}
        <div className="p-5 rounded-2xl bg-surface neo-raised flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold tracking-wide text-on-surface-variant uppercase">
                Transferencias / Digital
              </span>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className="text-2xl font-headline font-bold text-primary tracking-tight font-mono">
                  {stats.transferencia.toLocaleString('es-CU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <span className="text-xs font-semibold text-primary font-mono">CUP</span>
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-surface neo-inset flex items-center justify-center text-primary">
              <span className="material-symbols-outlined text-[22px]">account_balance</span>
            </div>
          </div>
          <div className="flex items-center justify-between mt-4 pt-3 border-t border-outline-variant/15 text-xs text-on-surface-variant">
            <span>Aporte digital:</span>
            <span className="font-semibold text-on-surface font-mono">
              {stats.total > 0 ? `${((stats.transferencia / stats.total) * 100).toFixed(1)}%` : '0%'}
            </span>
          </div>
        </div>

        {/* Ticket Promedio */}
        <div className="p-5 rounded-2xl bg-surface neo-raised flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold tracking-wide text-on-surface-variant uppercase">
                Ticket Promedio
              </span>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className="text-2xl font-headline font-bold text-on-surface tracking-tight font-mono">
                  {stats.avgTicket.toLocaleString('es-CU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <span className="text-xs font-semibold text-primary font-mono">CUP</span>
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-surface neo-inset flex items-center justify-center text-indigo-500">
              <span className="material-symbols-outlined text-[22px]">analytics</span>
            </div>
          </div>
          <div className="flex items-center justify-between mt-4 pt-3 border-t border-outline-variant/15 text-xs text-on-surface-variant">
            <span>Operaciones procesadas:</span>
            <span className="font-semibold text-on-surface font-mono">{stats.activeTickets}</span>
          </div>
        </div>
      </div>

      {/* Barra de Filtros y Búsqueda */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 p-4 rounded-2xl bg-surface neo-raised">
        <div className="flex-1 flex items-center gap-3">
          {/* Buscador */}
          <div className="relative flex-1 max-w-md">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 material-symbols-outlined text-[19px] text-on-surface-variant">
              search
            </span>
            <input
              type="text"
              placeholder="Buscar por ticket (TKT-...), producto, código o nota..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              className="w-full h-11 pl-10 pr-9 rounded-xl bg-surface neo-inset text-xs text-on-surface placeholder:text-on-surface-variant outline-none focus:ring-1 focus:ring-primary"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface cursor-pointer"
                type="button"
              >
                <span className="material-symbols-outlined text-[16px]">close</span>
              </button>
            )}
          </div>

          {/* Filtro por Método de Pago */}
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-surface neo-inset text-xs">
            <button
              onClick={() => {
                setPaymentFilter('all');
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                paymentFilter === 'all'
                  ? 'bg-surface neo-raised text-primary shadow-sm'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
              type="button"
            >
              Todos
            </button>
            <button
              onClick={() => {
                setPaymentFilter('efectivo');
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                paymentFilter === 'efectivo'
                  ? 'bg-surface neo-raised text-emerald-600 shadow-sm'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
              type="button"
            >
              Efectivo
            </button>
            <button
              onClick={() => {
                setPaymentFilter('transferencia');
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                paymentFilter === 'transferencia'
                  ? 'bg-surface neo-raised text-primary shadow-sm'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
              type="button"
            >
              Transf.
            </button>
            <button
              onClick={() => {
                setPaymentFilter('mixto');
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                paymentFilter === 'mixto'
                  ? 'bg-surface neo-raised text-purple-600 shadow-sm'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
              type="button"
            >
              Mixto
            </button>
          </div>
        </div>

        {/* Filtro por Estado: Activo / Anulado */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-on-surface-variant hidden sm:inline">Estado:</span>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as any);
              setPage(1);
            }}
            className="h-10 px-3 rounded-xl bg-surface neo-inset text-xs font-semibold text-on-surface outline-none focus:ring-1 focus:ring-primary cursor-pointer"
          >
            <option value="all">Todos los tickets</option>
            <option value="active">Solo completadas</option>
            <option value="voided">Solo anuladas</option>
          </select>

          <span className="text-xs text-on-surface-variant font-medium pl-2">
            <strong className="text-on-surface font-mono">{finalFilteredSales.length}</strong> encontrados
          </span>
        </div>
      </div>

      {/* Tabla de Tickets de Ventas */}
      <div className="rounded-2xl bg-surface neo-raised p-2 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead>
              <tr className="text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">
                <th className="py-3 px-4" scope="col">Ticket / Comprobante</th>
                <th className="py-3 px-4" scope="col">Fecha &amp; Hora</th>
                <th className="py-3 px-4" scope="col">Artículos Vendidos</th>
                <th className="py-3 px-4" scope="col">Método de Pago</th>
                <th className="py-3 px-4 text-right" scope="col">Total (CUP)</th>
                <th className="py-3 px-4 text-center" scope="col">Estado</th>
                <th className="py-3 px-4 text-center" scope="col">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y-0 text-on-surface">
              {paginatedSales.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-14 text-center text-xs text-on-surface-variant font-medium">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <span className="material-symbols-outlined text-[36px] text-on-surface-variant/60">
                        receipt_long
                      </span>
                      <span className="text-sm font-semibold text-on-surface">No hay tickets de venta registrados</span>
                      <p className="text-xs text-on-surface-variant/80 max-w-sm">
                        {searchQuery || paymentFilter !== 'all' || statusFilter !== 'all'
                          ? 'No hay ventas que coincidan con los filtros de búsqueda aplicados.'
                          : 'Las ventas realizadas desde el Punto de Venta o el IPV aparecerán guardadas aquí durante 30 días.'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedSales.map((sale) => {
                  const isVoided = (sale as any).voided;
                  const totalUnits = (sale.items || []).reduce((acc, it) => acc + (it.quantity || 0), 0);
                  const itemsCount = (sale.items || []).length;
                  const firstItemName = sale.items?.[0]?.name || 'Producto';

                  return (
                    <tr
                      key={sale.id}
                      className={`group hover:bg-surface-container-high/40 transition-colors ${
                        isVoided ? 'opacity-60 bg-surface-container-low/30' : ''
                      }`}
                    >
                      {/* Ticket # */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-xs px-2.5 py-1 rounded-lg bg-surface neo-inset text-primary">
                            {sale.ticketNumber}
                          </span>
                        </div>
                      </td>

                      {/* Fecha y Hora */}
                      <td className="py-3.5 px-4 font-mono text-xs">
                        <div className="flex flex-col">
                          <span className="font-semibold text-on-surface">{sale.date}</span>
                          <span className="text-[11px] text-on-surface-variant">{sale.timestamp || '--:--'}</span>
                        </div>
                      </td>

                      {/* Artículos Vendidos */}
                      <td className="py-3.5 px-4">
                        <div className="flex flex-col max-w-xs">
                          <span className="font-medium text-xs text-on-surface truncate">
                            {itemsCount > 1 ? `${firstItemName} +${itemsCount - 1} más` : firstItemName}
                          </span>
                          <span className="text-[11px] text-on-surface-variant font-mono">
                            {itemsCount} {itemsCount === 1 ? 'artículo' : 'artículos'} • {totalUnits} u. en total
                          </span>
                        </div>
                      </td>

                      {/* Método de Pago */}
                      <td className="py-3.5 px-4">
                        {sale.paymentMethod === 'efectivo' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                            <span className="material-symbols-outlined text-[14px]">payments</span>
                            Efectivo
                          </span>
                        )}
                        {sale.paymentMethod === 'transferencia' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-primary/10 text-primary border border-primary/20">
                            <span className="material-symbols-outlined text-[14px]">account_balance</span>
                            Transferencia
                          </span>
                        )}
                        {sale.paymentMethod === 'mixto' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-purple-500/10 text-purple-600 border border-purple-500/20">
                            <span className="material-symbols-outlined text-[14px]">shuffle</span>
                            Mixto
                          </span>
                        )}
                      </td>

                      {/* Total CUP */}
                      <td className="py-3.5 px-4 text-right">
                        <span className={`font-mono font-bold text-sm ${isVoided ? 'line-through text-on-surface-variant' : 'text-on-surface'}`}>
                          ${sale.total.toLocaleString('es-CU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </td>

                      {/* Estado */}
                      <td className="py-3.5 px-4 text-center">
                        {isVoided ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-700">
                            <span className="material-symbols-outlined text-[13px]">block</span>
                            ANULADO
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-600">
                            <span className="material-symbols-outlined text-[13px]">check_circle</span>
                            COMPLETADO
                          </span>
                        )}
                      </td>

                      {/* Acciones */}
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* Ver Detalle */}
                          <button
                            onClick={() => setSelectedSaleForDetail(sale)}
                            className="w-8 h-8 rounded-lg bg-surface neo-raised flex items-center justify-center text-on-surface hover:text-primary active:neo-inset transition-all cursor-pointer"
                            type="button"
                            title="Ver detalle del ticket"
                          >
                            <span className="material-symbols-outlined text-[17px]">visibility</span>
                          </button>

                          {/* Reimprimir Ticket */}
                          <button
                            onClick={() => handlePrintSale(sale)}
                            className="w-8 h-8 rounded-lg bg-surface neo-raised flex items-center justify-center text-on-surface hover:text-emerald-600 active:neo-inset transition-all cursor-pointer"
                            type="button"
                            title="Reimprimir comprobante"
                          >
                            <span className="material-symbols-outlined text-[17px]">print</span>
                          </button>

                          {/* Anular Venta */}
                          {!isVoided && (
                            <button
                              onClick={() => setSaleToVoid(sale)}
                              className="w-8 h-8 rounded-lg bg-surface neo-raised flex items-center justify-center text-on-surface-variant hover:text-red-500 active:neo-inset transition-all cursor-pointer"
                              type="button"
                              title="Anular venta y reponer existencias"
                            >
                              <span className="material-symbols-outlined text-[17px]">cancel</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Paginación */}
        <div className="p-3.5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-on-surface-variant bg-surface rounded-xl mt-2 neo-inset">
          <span className="font-medium">
            Mostrando <strong className="text-on-surface font-mono">{startIdx} a {endIdx}</strong> de{' '}
            <strong className="text-on-surface font-mono">{finalFilteredSales.length}</strong> tickets
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={validPage === 1}
              className={`w-8 h-8 rounded-lg bg-surface neo-raised flex items-center justify-center transition-all ${
                validPage === 1
                  ? 'opacity-40 cursor-not-allowed text-on-surface-variant'
                  : 'hover:text-primary active:neo-inset cursor-pointer text-on-surface'
              }`}
              type="button"
              title="Página anterior"
            >
              <span className="material-symbols-outlined text-[16px]">chevron_left</span>
            </button>

            {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
              <button
                key={pageNum}
                onClick={() => setPage(pageNum)}
                className={`w-8 h-8 rounded-lg text-xs font-semibold flex items-center justify-center transition-all cursor-pointer ${
                  validPage === pageNum
                    ? 'bg-surface neo-inset text-primary font-bold shadow-inner'
                    : 'bg-surface neo-raised text-on-surface-variant hover:text-on-surface active:neo-inset'
                }`}
                type="button"
              >
                {pageNum}
              </button>
            ))}

            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={validPage === totalPages}
              className={`w-8 h-8 rounded-lg bg-surface neo-raised flex items-center justify-center transition-all ${
                validPage === totalPages
                  ? 'opacity-40 cursor-not-allowed text-on-surface-variant'
                  : 'hover:text-primary active:neo-inset cursor-pointer text-on-surface'
              }`}
              type="button"
              title="Página siguiente"
            >
              <span className="material-symbols-outlined text-[16px]">chevron_right</span>
            </button>
          </div>
        </div>
      </div>



      {/* MODAL DE DETALLE DEL TICKET */}
      {selectedSaleForDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-lg rounded-2xl bg-surface neo-raised border border-outline-variant/20 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-5 border-b border-outline-variant/15 flex items-center justify-between bg-surface-container-low/40">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-surface neo-inset flex items-center justify-center text-primary">
                  <span className="material-symbols-outlined text-[22px]">receipt</span>
                </div>
                <div>
                  <h3 className="text-base font-headline font-bold text-on-surface">
                    Comprobante de Venta {selectedSaleForDetail.ticketNumber}
                  </h3>
                  <span className="text-xs text-on-surface-variant font-mono">
                    {selectedSaleForDetail.date} • {selectedSaleForDetail.timestamp || '--:--'}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setSelectedSaleForDetail(null)}
                className="w-8 h-8 rounded-lg bg-surface neo-raised flex items-center justify-center text-on-surface-variant hover:text-on-surface cursor-pointer"
                type="button"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            {/* Modal Body: Ticket content */}
            <div className="p-6 overflow-y-auto flex flex-col gap-5">
              {/* Status Banner */}
              {(selectedSaleForDetail as any).voided ? (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 text-xs font-semibold flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px]">error</span>
                  <span>Este ticket fue ANULADO. Las existencias fueron repuestas al inventario.</span>
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 text-xs font-semibold flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px]">verified</span>
                  <span>Venta Completada y Registrada en el Cuadre Diario.</span>
                </div>
              )}

              {/* Items Table */}
              <div className="rounded-xl bg-surface neo-inset p-3 overflow-hidden">
                <div className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider mb-2">
                  Artículos del Comprobante
                </div>
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="text-on-surface-variant border-b border-outline-variant/20 pb-1">
                      <th className="pb-1.5 font-semibold">Cant.</th>
                      <th className="pb-1.5 font-semibold">Producto</th>
                      <th className="pb-1.5 text-right font-semibold">Precio U.</th>
                      <th className="pb-1.5 text-right font-semibold">Importe</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/10 text-on-surface">
                    {(selectedSaleForDetail.items || []).map((it, idx) => (
                      <tr key={idx} className="py-2">
                        <td className="py-2 font-mono font-bold text-primary">
                          {it.quantity} {it.um}
                        </td>
                        <td className="py-2">
                          <div className="flex flex-col">
                            <span className="font-semibold">{it.name}</span>
                            <span className="text-[10px] text-on-surface-variant font-mono">COD: {it.code}</span>
                          </div>
                        </td>
                        <td className="py-2 text-right font-mono text-on-surface-variant">
                          ${it.unitPrice.toFixed(2)}
                        </td>
                        <td className="py-2 text-right font-mono font-bold">
                          ${it.subtotal.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Totales y Pago */}
              <div className="p-4 rounded-xl bg-surface neo-raised flex flex-col gap-2">
                <div className="flex justify-between items-center text-sm font-bold text-on-surface">
                  <span>TOTAL A PAGAR:</span>
                  <span className="font-mono text-lg text-primary">
                    ${selectedSaleForDetail.total.toFixed(2)} CUP
                  </span>
                </div>
                <div className="h-px bg-outline-variant/20 my-1"></div>
                <div className="flex justify-between items-center text-xs text-on-surface-variant">
                  <span>Método de Pago:</span>
                  <span className="font-semibold text-on-surface uppercase">
                    {selectedSaleForDetail.paymentMethod}
                  </span>
                </div>
                {selectedSaleForDetail.efectivoAmount !== undefined && selectedSaleForDetail.efectivoAmount > 0 && (
                  <div className="flex justify-between items-center text-xs text-on-surface-variant">
                    <span>Efectivo cobrado:</span>
                    <span className="font-mono font-semibold text-on-surface">
                      ${selectedSaleForDetail.efectivoAmount.toFixed(2)} CUP
                    </span>
                  </div>
                )}
                {selectedSaleForDetail.transferenciaAmount !== undefined && selectedSaleForDetail.transferenciaAmount > 0 && (
                  <div className="flex justify-between items-center text-xs text-on-surface-variant">
                    <span>Transferencia cobrada:</span>
                    <span className="font-mono font-semibold text-on-surface">
                      ${selectedSaleForDetail.transferenciaAmount.toFixed(2)} CUP
                    </span>
                  </div>
                )}
                {selectedSaleForDetail.amountReceived !== undefined && selectedSaleForDetail.amountReceived > 0 && (
                  <div className="flex justify-between items-center text-xs text-on-surface-variant">
                    <span>Monto Recibido del Cliente:</span>
                    <span className="font-mono text-on-surface">
                      ${selectedSaleForDetail.amountReceived.toFixed(2)} CUP
                    </span>
                  </div>
                )}
                {selectedSaleForDetail.change !== undefined && selectedSaleForDetail.change > 0 && (
                  <div className="flex justify-between items-center text-xs text-emerald-600 font-semibold">
                    <span>Cambio Entregado:</span>
                    <span className="font-mono">
                      ${selectedSaleForDetail.change.toFixed(2)} CUP
                    </span>
                  </div>
                )}
                {selectedSaleForDetail.note && (
                  <div className="mt-2 pt-2 border-t border-outline-variant/10 text-xs text-on-surface-variant">
                    <span className="font-medium">Nota / Observación:</span> {selectedSaleForDetail.note}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer Actions */}
            <div className="p-4 border-t border-outline-variant/15 flex flex-wrap items-center justify-between gap-2 bg-surface-container-low/40">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handlePrintSale(selectedSaleForDetail)}
                  className="px-4 py-2 rounded-xl bg-emerald-600 text-white font-semibold text-xs flex items-center gap-1.5 shadow-sm hover:bg-emerald-700 transition-all cursor-pointer"
                  type="button"
                >
                  <span className="material-symbols-outlined text-[16px]">print</span>
                  <span>Imprimir Ticket</span>
                </button>

                <button
                  onClick={() => handleDownloadTicketTxt(selectedSaleForDetail)}
                  className="px-3 py-2 rounded-xl bg-surface neo-raised text-on-surface font-semibold text-xs flex items-center gap-1.5 hover:text-primary transition-all cursor-pointer"
                  type="button"
                >
                  <span className="material-symbols-outlined text-[16px]">download</span>
                  <span>Descargar</span>
                </button>
              </div>

              <div className="flex items-center gap-2">

                {!(selectedSaleForDetail as any).voided && (
                  <button
                    onClick={() => {
                      setSaleToVoid(selectedSaleForDetail);
                    }}
                    className="px-3 py-2 rounded-xl bg-red-500/10 text-red-600 hover:bg-red-500/20 font-semibold text-xs flex items-center gap-1 transition-all cursor-pointer"
                    type="button"
                  >
                    <span className="material-symbols-outlined text-[16px]">cancel</span>
                    <span>Anular Venta</span>
                  </button>
                )}

                <button
                  onClick={() => setSelectedSaleForDetail(null)}
                  className="px-4 py-2 rounded-xl bg-surface neo-raised text-on-surface font-semibold text-xs hover:text-primary transition-all cursor-pointer"
                  type="button"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DIÁLOGO DE CONFIRMACIÓN PARA ANULAR VENTA */}
      {saleToVoid && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md rounded-2xl bg-surface neo-raised p-6 flex flex-col gap-4 border border-outline-variant/20 shadow-2xl">
            <div className="flex items-center gap-3 text-red-500">
              <div className="w-11 h-11 rounded-xl bg-red-500/10 flex items-center justify-center">
                <span className="material-symbols-outlined text-[24px]">warning</span>
              </div>
              <div>
                <h3 className="text-base font-headline font-bold text-on-surface">
                  ¿Anular Venta {saleToVoid.ticketNumber}?
                </h3>
                <span className="text-xs text-on-surface-variant font-mono">
                  Monto: ${saleToVoid.total.toFixed(2)} CUP
                </span>
              </div>
            </div>

            <p className="text-xs text-on-surface-variant leading-relaxed">
              Esta acción marcará el ticket como <strong>ANULADO</strong>, restará el importe recaudado de la caja del día y <strong>repondrá automáticamente todas las unidades vendidas</strong> al inventario.
            </p>

            <div className="flex items-center justify-end gap-3 mt-2">
              <button
                onClick={() => setSaleToVoid(null)}
                className="px-4 py-2 rounded-xl bg-surface neo-raised text-xs font-semibold text-on-surface hover:text-primary transition-all cursor-pointer"
                type="button"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmVoid}
                className="px-4 py-2 rounded-xl bg-red-600 text-white text-xs font-headline font-bold shadow-md hover:bg-red-700 active:scale-[0.99] transition-all cursor-pointer"
                type="button"
              >
                Confirmar Anulación
              </button>
            </div>
          </div>
        </div>
      )}



    </div>
  );
};
