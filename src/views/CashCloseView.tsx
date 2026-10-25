import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { DayClose } from '../data/api';
import { APP_NAME } from '../config';
import { saveFileWithPicker } from '../utils/fileSaver';

export const CashCloseView: React.FC = () => {
  const {
    todayDate,
    isCurrentDayClosed,
    currentIpvDay,
    denominations,
    updateDenominationCount,
    menoresAmount,
    transferenciasAmount,
    setTransferenciasAmount,
    totalCashFisico,
    totalGeneralContado,
    diferenciaCaja,
    ipvTotalVendido,
    totalVentasEfectivo,
    totalVentasTransferencia,
    recalculateCash,
    closeDay,
    reopenDay,
    listCloses,
    showToast,
    sales = [],
    returns = [],
  } = useApp();

  const [responsibleName, setResponsibleName] = useState('Vendedor');
  const [closeTime, setCloseTime] = useState('');
  const [notes, setNotes] = useState('');
  const [showActaModal, setShowActaModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showReopenConfirm, setShowReopenConfirm] = useState(false);
  const [historyList, setHistoryList] = useState<DayClose[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isExportCloseModalOpen, setIsExportCloseModalOpen] = useState(false);
  const [exportDestinationPath, setExportDestinationPath] = useState(() => {
    const [year, month] = (todayDate || new Date().toISOString().slice(0, 10)).split('-');
    return `Documentos/IPV/Reportes/${year}/${month}`;
  });

  // Set real current time and update every minute
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCloseTime(
        now.toLocaleTimeString('es-CU', {
          hour: '2-digit',
          minute: '2-digit',
        }) + ' hrs'
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 60000);
    return () => clearInterval(interval);
  }, []);

  // Proponer transferencias desde ipv.getDay(hoy).sales.transferencia si aún no se ha modificado
  useEffect(() => {
    if (currentIpvDay?.sales?.transferencia !== undefined) {
      setTransferenciasAmount(currentIpvDay.sales.transferencia);
    }
  }, [currentIpvDay, setTransferenciasAmount]);

  // Cargar historial real desde api.cash.listCloses
  const loadHistory = useCallback(async () => {
    setIsLoadingHistory(true);
    try {
      const closes = await listCloses(50);
      setHistoryList(closes);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingHistory(false);
    }
  }, [listCloses]);

  useEffect(() => {
    if (showHistoryModal) {
      loadHistory();
    }
  }, [showHistoryModal, loadHistory]);

  // Format currency in es-CU standard style
  const formatCUP = (val: number) => {
    return Number(val).toLocaleString('es-CU', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  // Total physical pieces counted
  const totalPieces = denominations.reduce((acc, d) => acc + d.count, 0);

  // Differences
  const devolucionesToday = useMemo(() => {
    return returns.filter((r) => r.date === todayDate);
  }, [returns, todayDate]);

  const totalDevolucionesRefundToday = useMemo(() => {
    return devolucionesToday.reduce((acc, r) => acc + (r.totalRefund || 0), 0);
  }, [devolucionesToday]);

  const voidedSalesToday = useMemo(() => {
    const returnSaleIds = new Set(devolucionesToday.map((r) => r.saleId).filter(Boolean));
    return sales.filter((s) => (s as any).voided && s.date === todayDate && !returnSaleIds.has(s.id));
  }, [sales, todayDate, devolucionesToday]);

  const autoDevolucionesTotal = useMemo(() => {
    const voidedSalesTotal = voidedSalesToday.reduce((acc, s) => acc + (s.total || 0), 0);
    return totalDevolucionesRefundToday + voidedSalesTotal;
  }, [totalDevolucionesRefundToday, voidedSalesToday]);

  const damagedCountToday = useMemo(() => {
    return devolucionesToday.reduce((acc, r) => {
      const damagedInReturn = (r.items || []).filter((it) => it.condition === 'mal_estado').reduce((s, it) => s + (it.quantity || 1), 0);
      return acc + damagedInReturn;
    }, 0);
  }, [devolucionesToday]);

  const [devolucionesAmount, setDevolucionesAmount] = useState<number>(0);

  useEffect(() => {
    setDevolucionesAmount(autoDevolucionesTotal);
  }, [autoDevolucionesTotal]);

  // Reembolsos en efectivo deducidos de la caja física esperada (efectivo + porción de mixto)
  const efectivoDevueltoToday = useMemo(() => {
    return devolucionesToday.reduce((acc, r) => {
      if (r.refundMethod === 'efectivo' || !r.refundMethod) {
        return acc + (r.totalRefund || 0);
      }
      if (r.refundMethod === 'mixto') {
        const ef = r.efectivoAmount !== undefined
          ? r.efectivoAmount
          : Math.max(0, (r.totalRefund || 0) - (r.transferenciaAmount || 0));
        return acc + ef;
      }
      return acc;
    }, 0);
  }, [devolucionesToday]);

  // Reembolsos por transferencia deducidos del canal digital esperado (transferencia + porción de mixto)
  const transferenciaDevueltaToday = useMemo(() => {
    return devolucionesToday.reduce((acc, r) => {
      if (r.refundMethod === 'transferencia') {
        return acc + (r.totalRefund || 0);
      }
      if (r.refundMethod === 'mixto') {
        const tr = r.transferenciaAmount !== undefined ? r.transferenciaAmount : 0;
        return acc + tr;
      }
      return acc;
    }, 0);
  }, [devolucionesToday]);

  const expectedCashInDrawer = Math.max(0, totalVentasEfectivo - efectivoDevueltoToday);
  const expectedTransfers = Math.max(0, totalVentasTransferencia - transferenciaDevueltaToday);
  const cashDifference = totalCashFisico - expectedCashInDrawer;
  const transferDifference = transferenciasAmount - expectedTransfers;
  const netIpvExpected = Math.max(0, ipvTotalVendido - devolucionesAmount);
  const netDifference = totalGeneralContado - netIpvExpected;
  const handlePerformClose = async () => {
    if (isCurrentDayClosed) {
      showToast('Aviso', 'El día ya está cerrado.', 'info');
      return;
    }
    setIsSubmitting(true);
    try {
      const success = await closeDay(todayDate, notes.trim() || undefined);
      if (success) {
        setShowActaModal(false);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Manejar la reapertura con confirmación
  const handlePerformReopen = async () => {
    setIsSubmitting(true);
    try {
      const success = await reopenDay(todayDate);
      if (success) {
        setShowReopenConfirm(false);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Abrir modal de exportación para preguntar ruta antes de guardar
  const handleExportClose = () => {
    setIsExportCloseModalOpen(true);
  };

  // Generar y guardar planilla Excel / CSV completa con arqueo, ventas y devoluciones preguntando la ruta
  const generateWebCloseExportExcel = async () => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const dateFormatted = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

    const headersResumen = [
      'REPORTE OFICIAL DE CIERRE DE CAJA DIARIO - IPV',
      `Fecha de Cierre: ${todayDate} | Generado: ${now.toLocaleTimeString('es-CU')}`,
      `Responsable: ${responsibleName} | Estado: ${isCurrentDayClosed ? 'Cerrado' : 'Abierto / En Arqueo'}`,
      '',
      '--- RESUMEN GENERAL DE OPERACIONES ---',
      'Concepto;Monto ($);Detalle / Observación',
      `Total Facturado (Ventas Brutas);${ipvTotalVendido.toFixed(2)};Importe bruto según IPV`,
      `Total Devoluciones / Reembolsos;-${totalDevolucionesRefundToday.toFixed(2)};${devolucionesToday.length} devoluciones procesadas`,
      `Ventas Netas Realizadas;${Math.max(0, ipvTotalVendido - totalDevolucionesRefundToday).toFixed(2)};Ingreso neto efectivo tras reembolsos`,
      `Total Ventas Efectivo;${totalVentasEfectivo.toFixed(2)};Cobros en efectivo`,
      `Total Transferencias;${totalVentasTransferencia.toFixed(2)};EnZona / Transfermóvil`,
      `Efectivo Físico en Gaveta;${totalGeneralContado.toFixed(2)};Total del arqueo físico`,
      `Diferencia de Caja;${diferenciaCaja.toFixed(2)};${diferenciaCaja === 0 ? 'Cuadrado Exacto' : diferenciaCaja > 0 ? 'Sobrante en caja' : 'Faltante en caja'}`,
      '',
      '--- CONTEO DE BILLETES Y EFECTIVO FÍSICO ---',
      'Denominación;Valor Unitario ($);Cantidad de Piezas;Importe Total ($)',
      ...denominations.map((d) => `"${d.label}";${d.value.toFixed(2)};${d.count};${(d.value * d.count).toFixed(2)}`),
      `"Fondo de Menores / Monedas";0.00;1;${(menoresAmount || 0).toFixed(2)}`,
      `"Total Efectivo Contado";0.00;${totalPieces};${totalGeneralContado.toFixed(2)}`,
      '',
      '--- REGISTRO DETALLADO DE DEVOLUCIONES DE LA JORNADA ---',
      'Folio;Hora;Ticket Origen;Cliente;Motivo de Devolución;Método de Reembolso;Artículos Devueltos;Uds;Condición;Monto Reembolsado ($)',
    ];

    if (devolucionesToday.length === 0) {
      headersResumen.push('Sin devoluciones registradas en esta jornada;;;;;;;;;');
    } else {
      devolucionesToday.forEach((r) => {
        const totalUnits = (r.items || []).reduce((acc, it) => acc + (it.quantity || 1), 0);
        const itemsStr = (r.items || []).map((it) => `${it.name} (x${it.quantity} ${it.um || 'u.'})`).join(', ');
        const conditionStr = r.hasDamagedItems ? 'Con merma / Dañado' : 'Buen estado / Reintegrado';
        headersResumen.push([
          `"${r.returnNumber || 'DEV-N/A'}"`,
          `"${r.timestamp || '--:--'}"`,
          `"${r.ticketNumber || 'Venta directa'}"`,
          `"${(r.customerName || 'Cliente general').replace(/"/g, '""')}"`,
          `"${(r.reason || 'Sin motivo especificado').replace(/"/g, '""')}"`,
          `"${(r.refundMethod || 'efectivo').toUpperCase()}"`,
          `"${itemsStr.replace(/"/g, '""')}"`,
          totalUnits,
          `"${conditionStr}"`,
          `-${(r.totalRefund || 0).toFixed(2)}`,
        ].join(';'));
      });
    }

    const totalRefundToday = devolucionesToday.reduce((acc, r) => acc + (r.totalRefund || 0), 0);
    const refundCashToday = devolucionesToday.filter((r) => r.refundMethod === 'efectivo').reduce((acc, r) => acc + (r.totalRefund || 0), 0);
    const refundTransferToday = devolucionesToday.filter((r) => r.refundMethod === 'transferencia').reduce((acc, r) => acc + (r.totalRefund || 0), 0);
    const refundMixtoToday = devolucionesToday.filter((r) => r.refundMethod === 'mixto').reduce((acc, r) => acc + (r.totalRefund || 0), 0);

    headersResumen.push(
      '',
      `"--- RESUMEN DETALLADO DE REEMBOLSOS POR CANAL DE PAGO ---";;;`,
      `"Canal / Método";"Monto Reembolsado ($)";"Operaciones";`,
      `"Efectivo";-${refundCashToday.toFixed(2)};${devolucionesToday.filter((r) => r.refundMethod === 'efectivo').length};`,
      `"Transferencia";-${refundTransferToday.toFixed(2)};${devolucionesToday.filter((r) => r.refundMethod === 'transferencia').length};`,
      `"Mixto";-${refundMixtoToday.toFixed(2)};${devolucionesToday.filter((r) => r.refundMethod === 'mixto').length};`,
      `"Total Reembolsos del Día ($)";-${totalRefundToday.toFixed(2)};${devolucionesToday.length};`,
      `"Ventas Netas Efectivas del Día ($)";${Math.max(0, ipvTotalVendido - totalRefundToday).toFixed(2)};;`
    );

    const csvContent = '\uFEFF' + headersResumen.join('\r\n');
    return await saveFileWithPicker(csvContent, {
      suggestedName: `Cierre_Caja_${todayDate || dateFormatted}.csv`,
      mimeType: 'text/csv;charset=utf-8;',
      extension: 'csv',
      description: 'Reporte Oficial de Cierre de Caja con Devoluciones (.csv / Excel)',
    });
  };

  // Ejecutar exportación tras confirmar y seleccionar carpeta
  const handlePerformExportClose = async () => {
    setIsExporting(true);
    try {
      const isNativeElectron = typeof window !== 'undefined' && Boolean((window as any).api?._isElectron);

      if (isNativeElectron && window.api?.reports?.exportarCierre) {
        const res = await window.api.reports.exportarCierre(todayDate);
        if (res && (res as any).canceled) {
          showToast('Operación Cancelada', 'No se seleccionó ninguna carpeta para guardar.', 'info');
          return;
        }
        setIsExportCloseModalOpen(false);
        showToast(
          'Cierre Exportado con Éxito',
          `Archivos guardados en: ${res.directory || res.excelPath || 'la carpeta seleccionada'}`,
          'success'
        );
      } else {
        const res = await generateWebCloseExportExcel();
        if (res.canceled) {
          showToast('Operación Cancelada', 'No se seleccionó ninguna ruta para guardar el archivo.', 'info');
          return;
        }
        setIsExportCloseModalOpen(false);
        showToast(
          'Cierre Exportado con Éxito',
          `Se guardó la planilla de cierre con arqueo y devoluciones (${devolucionesToday.length} devoluciones incluidas) en: ${res.fileName || res.fullPath || 'su equipo'}.`,
          'success'
        );
      }
    } catch (err: any) {
      showToast('Error al exportar cierre', err?.message || 'No se pudo generar el reporte de cierre.', 'error');
    } finally {
      setIsExporting(false);
    }
  };

  // Impresión del Comprobante / Acta térmica de cierre de caja
  const handlePrintActa = () => {
    const printWindow = window.open('', '_blank', 'width=420,height=680');
    if (!printWindow) {
      window.print();
      return;
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8" />
        <title>Acta Cierre de Caja - ${todayDate}</title>
        <style>
          @page { size: 80mm auto; margin: 4mm; }
          body { font-family: 'Courier New', monospace, sans-serif; font-size: 11px; margin: 0; padding: 6px; color: #000; }
          .center { text-align: center; }
          .bold { font-weight: bold; }
          .divider { border-bottom: 1px dashed #000; margin: 6px 0; }
          .row { display: flex; justify-content: space-between; margin: 2px 0; }
          .small { font-size: 10px; }
        </style>
      </head>
      <body>
        <div class="center">
          <div class="bold" style="font-size: 14px;">${APP_NAME}</div>
          <div class="small">ACTA DE ARQUEO Y CIERRE DIARIO</div>
        </div>
        <div class="divider"></div>
        <div class="row small"><span>FECHA: ${todayDate}</span><span>HORA: ${closeTime}</span></div>
        <div class="row small"><span>RESPONSABLE: ${responsibleName.toUpperCase()}</span><span>ESTADO: ${isCurrentDayClosed ? 'CERRADO' : 'POR CERRAR'}</span></div>
        <div class="divider"></div>
        <div class="center bold">VENTAS REGISTRADAS EN IPV</div>
        <div class="row"><span>Ventas Efectivo:</span><span>$${formatCUP(totalVentasEfectivo)} CUP</span></div>
        <div class="row"><span>Ventas Transferencia:</span><span>$${formatCUP(totalVentasTransferencia)} CUP</span></div>
        <div class="row bold"><span>TOTAL FACTURADO IPV:</span><span>$${formatCUP(ipvTotalVendido)} CUP</span></div>
        <div class="divider"></div>
        <div class="center bold">DESGLOSE EFECTIVO CONTADO</div>
        ${denominations.map(d => `<div class="row"><span>${d.count}x $${d.value} CUP</span><span>$${formatCUP(d.count * d.value)}</span></div>`).join('')}
        ${devolucionesAmount > 0 ? `<div class="row bold" style="color:#b45309;"><span>Devoluciones/Reembolsos:</span><span>-$${formatCUP(devolucionesAmount)} CUP</span></div>` : ''}
        ${damagedCountToday > 0 ? `<div class="row bold" style="color:#b91c1c;"><span>Mal Estado:</span><span>${damagedCountToday} u.</span></div>` : ''}
        <div class="divider"></div>
        <div class="row bold"><span>EFECTIVO CONTADO TOTAL:</span><span>$${formatCUP(totalCashFisico)} CUP</span></div>
        <div class="row"><span>Diferencia vs Efectivo Esp.:</span><span>${cashDifference === 0 ? '0.00 (Exacto)' : (cashDifference > 0 ? '+' : '') + formatCUP(cashDifference) + ' CUP'}</span></div>
        <div class="row"><span>TRANSFERENCIAS (ENZONA/TM):</span><span>$${formatCUP(transferenciasAmount)} CUP</span></div>
        <div class="divider"></div>
        <div class="row bold" style="font-size: 12px;"><span>TOTAL RECAUDADO:</span><span>$${formatCUP(totalGeneralContado)} CUP</span></div>
        <div class="row bold"><span>DIFERENCIA REAL NETA:</span><span>${netDifference === 0 ? '0.00 (Cuadrado)' : (netDifference > 0 ? '+' : '') + formatCUP(netDifference) + ' CUP'}</span></div>
        ${notes ? `<div class="divider"></div><div class="small">OBSERVACIONES: ${notes}</div>` : ''}
        <script>window.onload = function() { window.print(); };</script>
      </body>
      </html>
    `;
    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  return (
    <div className="flex flex-col w-full gap-7 pb-12 select-none">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3">
            <h1 className="font-headline font-bold text-2xl lg:text-3xl text-on-surface tracking-tight">
              Cierre de Caja
            </h1>
            {isCurrentDayClosed ? (
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-600"></span>
                DÍA CERRADO
              </span>
            ) : (
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse"></span>
                JORNADA ABIERTA
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-on-surface-variant font-medium">
            Cuadre de efectivo y transferencias (EnZona / Transfermóvil).
          </p>
        </div>

        {/* Quick Actions Top Bar */}
        <div className="flex items-center gap-3">
          <div className="h-11 px-4 rounded-xl bg-surface neo-inset flex items-center gap-2.5 text-xs text-on-surface-variant font-medium">
            <span className="material-symbols-outlined text-primary text-[18px]">calendar_today</span>
            <span>
              Fecha: <strong className="text-on-surface font-mono">{todayDate}</strong>
            </span>
            <span className="text-outline text-xs">•</span>
            <span className="font-mono text-on-surface">{closeTime}</span>
          </div>

          <button
            onClick={recalculateCash}
            className="h-11 px-4 rounded-xl bg-surface neo-raised hover:text-primary active:neo-inset flex items-center gap-2 text-xs font-semibold text-on-surface transition-all cursor-pointer"
            type="button"
          >
            <span className="material-symbols-outlined text-[18px]">sync</span>
            <span>Recalcular</span>
          </button>

          <button
            onClick={() => setShowHistoryModal(true)}
            className="h-11 px-3.5 rounded-xl bg-surface neo-raised hover:text-primary active:neo-inset flex items-center gap-2 text-xs font-semibold text-on-surface-variant transition-all cursor-pointer"
            title="Historial de arqueos previos de SQLite"
            type="button"
          >
            <span className="material-symbols-outlined text-[20px]">history</span>
            <span className="hidden sm:inline">Historial</span>
          </button>
        </div>
      </div>

      {/* Banner de estado cerrado */}
      {isCurrentDayClosed && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-900 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[22px]">lock</span>
            </div>
            <div>
              <h3 className="font-headline font-bold text-sm text-amber-950">
                La jornada del día {todayDate} está cerrada
              </h3>
              <p className="text-xs text-amber-900/80">
                Las operaciones de cobro y anulación de ventas están bloqueadas en el sistema.
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowReopenConfirm(true)}
            className="px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer self-start sm:self-auto shrink-0"
            type="button"
          >
            <span className="material-symbols-outlined text-[16px]">lock_open</span>
            <span>Reabrir Día</span>
          </button>
        </div>
      )}

      {/* Primary Asymmetric Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-7">
        {/* LEFT COLUMN: Desglose de Efectivo CUP (7 of 12 cols ~= 60%) */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          {/* Denominations Table Card */}
          <div className="rounded-2xl bg-surface neo-raised p-6 flex flex-col gap-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-surface neo-inset flex items-center justify-center text-primary">
                  <span className="material-symbols-outlined text-[22px]">payments</span>
                </div>
                <div>
                  <h2 className="font-headline font-semibold text-base text-on-surface leading-tight">
                    Desglose Físico de Billetes
                  </h2>
                  <p className="text-xs text-on-surface-variant font-medium mt-0.5">
                    Cálculo instantáneo por valor facial en Pesos Cubanos (CUP)
                  </p>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-lg bg-surface neo-inset text-[11px] font-bold text-primary font-mono">
                CUP $
              </span>
            </div>

            {/* Table Structure */}
            <div className="w-full flex flex-col gap-2.5 pt-2">
              {/* Table Header */}
              <div className="grid grid-cols-12 items-center px-4 py-2 text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider">
                <div className="col-span-4">Denominación</div>
                <div className="col-span-2 text-right">Valor</div>
                <div className="col-span-3 text-center">Cantidad Física</div>
                <div className="col-span-3 text-right">Subtotal</div>
              </div>

              {/* Denomination Rows */}
              {denominations.map((denom) => {
                const subtotal = denom.value * denom.count;
                return (
                  <div
                    key={denom.id}
                    className="grid grid-cols-12 items-center px-4 py-3 rounded-xl bg-surface neo-raised transition-all"
                  >
                    <div className="col-span-4 flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-surface neo-inset flex items-center justify-center text-primary shrink-0">
                        <span className="material-symbols-outlined text-[18px]">payments</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs font-semibold text-on-surface">{denom.label}</span>
                        <span className="text-[10px] text-on-surface-variant">{denom.sublabel}</span>
                      </div>
                    </div>
                    <div className="col-span-2 text-right text-xs font-mono text-on-surface-variant font-medium">
                      ${formatCUP(denom.value)}
                    </div>
                    <div className="col-span-3 flex items-center justify-center">
                      <div className="flex items-center gap-1 bg-surface neo-inset rounded-lg px-2 py-1">
                        <button
                          onClick={() => updateDenominationCount(denom.id, denom.count - 1)}
                          disabled={isCurrentDayClosed}
                          className="w-5 h-5 rounded flex items-center justify-center text-on-surface-variant hover:text-primary transition-colors text-sm font-bold disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                          type="button"
                        >
                          -
                        </button>
                        <input
                          type="number"
                          min="0"
                          disabled={isCurrentDayClosed}
                          value={denom.count}
                          onChange={(e) =>
                            updateDenominationCount(denom.id, parseInt(e.target.value) || 0)
                          }
                          className="w-12 bg-transparent text-center font-mono text-xs font-semibold text-on-surface focus:outline-none disabled:opacity-60"
                        />
                        <button
                          onClick={() => updateDenominationCount(denom.id, denom.count + 1)}
                          disabled={isCurrentDayClosed}
                          className="w-5 h-5 rounded flex items-center justify-center text-on-surface-variant hover:text-primary transition-colors text-sm font-bold disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                          type="button"
                        >
                          +
                        </button>
                      </div>
                    </div>
                    <div className="col-span-3 text-right">
                      <span className="font-mono text-xs font-bold text-on-surface">
                        {formatCUP(subtotal)}
                      </span>
                      <span className="text-[10px] text-on-surface-variant ml-0.5">CUP</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Total Efectivo Físico Contado Hero Block */}
          <div className="rounded-2xl bg-surface neo-raised p-6 flex flex-col md:flex-row md:items-center justify-between gap-5 relative overflow-hidden">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-surface neo-inset flex items-center justify-center text-primary shrink-0">
                <span className="material-symbols-outlined text-[32px]">account_balance_wallet</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
                  Total Efectivo Contado
                </span>
                <span className="text-xs text-on-surface-variant mt-0.5">
                  Suma de todas las denominaciones de efectivo contadas en gaveta
                </span>
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  <span className="text-[11px] text-on-surface-variant font-medium">
                    Esperado en gaveta: <strong className="font-mono text-on-surface">${formatCUP(expectedCashInDrawer)} CUP</strong>
                    {efectivoDevueltoToday > 0 && (
                      <span className="text-[10px] text-amber-600 font-mono ml-1.5 font-normal">
                        (Ventas: ${formatCUP(totalVentasEfectivo)} - Devoluciones: ${formatCUP(efectivoDevueltoToday)})
                      </span>
                    )}
                  </span>
                  <span
                    className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${
                      cashDifference === 0
                        ? 'bg-emerald-100 text-emerald-800'
                        : cashDifference > 0
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {cashDifference === 0
                      ? '✓ Gaveta cuadrada (0.00)'
                      : cashDifference > 0
                      ? `+$${formatCUP(cashDifference)} Sobrante`
                      : `-$${formatCUP(Math.abs(cashDifference))} Faltante`}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex flex-col md:items-end">
              <div className="flex items-baseline gap-1.5">
                <span className="font-headline font-bold text-3xl md:text-4xl text-on-surface tracking-tight font-mono">
                  {formatCUP(totalCashFisico)}
                </span>
                <span className="font-headline font-bold text-lg text-primary">CUP</span>
              </div>
              <div className="flex items-center gap-1.5 mt-1 text-[11px] text-on-surface-variant font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-primary"></span>
                <span>{totalPieces} piezas contadas en total</span>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Conciliación, Validación y Cierre (5 of 12 cols ~= 40%) */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          {/* Balance Reconciliation Card */}
          <div className="rounded-2xl bg-surface neo-raised p-6 flex flex-col gap-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-surface neo-inset flex items-center justify-center text-primary">
                  <span className="material-symbols-outlined text-[18px]">balance</span>
                </div>
                <h3 className="font-headline font-semibold text-sm text-on-surface">
                  Resumen de Cierre
                </h3>
              </div>
              <span className="text-[10px] font-mono text-primary font-bold px-2 py-0.5 rounded bg-surface neo-inset">
                CUP
              </span>
            </div>

            {/* Reconciliation Breakdown */}
            <div className="flex flex-col gap-3.5">
              {/* Ventas Registradas en Turno (IPV) */}
              <div className="p-3.5 rounded-xl bg-surface neo-inset flex flex-col gap-2">
                <div className="flex items-center justify-between text-xs font-bold text-on-surface uppercase tracking-wider">
                  <span className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[16px] text-primary">point_of_sale</span>
                    Ventas del Día (IPV)
                  </span>
                  <span className="font-mono text-primary font-bold">${formatCUP(ipvTotalVendido)} CUP</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs pt-1 border-t border-outline-variant/15">
                  <div className="flex flex-col">
                    <span className="text-[10px] text-on-surface-variant flex items-center gap-1 font-medium">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Efectivo:
                    </span>
                    <span className="font-mono font-bold text-emerald-600 mt-0.5">
                      ${formatCUP(totalVentasEfectivo)}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] text-on-surface-variant flex items-center gap-1 font-medium">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary"></span> Transf.:
                    </span>
                    <span className="font-mono font-bold text-primary mt-0.5">
                      ${formatCUP(totalVentasTransferencia)}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] text-on-surface-variant flex items-center gap-1 font-medium">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span> Devolución:
                    </span>
                    <span className="font-mono font-bold text-amber-600 mt-0.5">
                      ${formatCUP(devolucionesAmount)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Item 1: Efectivo Contado Total */}
              <div className="flex items-center justify-between p-3.5 rounded-xl bg-surface neo-inset">
                <div className="flex items-center gap-2.5">
                  <span className="material-symbols-outlined text-primary text-[20px]">
                    payments
                  </span>
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-on-surface">
                      Monto Total de Efectivo
                    </span>
                    <span className="text-[10px] text-on-surface-variant">
                      Billetes en gaveta
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="font-mono text-sm font-bold text-on-surface block">
                    ${formatCUP(totalCashFisico)}
                  </span>
                  <span className="text-[10px] text-on-surface-variant font-medium">CUP</span>
                </div>
              </div>

              {/* Item 2: Monto Total de Transferencias (EnZona / Transfermovil) */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-xl bg-surface neo-raised gap-3">
                <div className="flex items-center gap-2.5">
                  <span className="material-symbols-outlined text-primary text-[20px]">
                    qr_code_2
                  </span>
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-on-surface">
                      Monto Total de Transferencias
                    </span>
                    <span className="text-[10px] text-on-surface-variant font-medium">
                      EnZona / Transfermóvil (Neto esperado: ${formatCUP(expectedTransfers)} CUP
                      {transferenciaDevueltaToday > 0 && ` [Ventas: $${formatCUP(totalVentasTransferencia)} - Devs: $${formatCUP(transferenciaDevueltaToday)}]`})
                    </span>
                    {transferDifference !== 0 && !isCurrentDayClosed && (
                      <button
                        onClick={() => setTransferenciasAmount(expectedTransfers)}
                        className="text-[10px] text-primary underline text-left font-semibold mt-0.5 cursor-pointer"
                        type="button"
                      >
                        Sincronizar con neto esperado (${formatCUP(expectedTransfers)} CUP)
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 bg-surface neo-inset px-2.5 py-1.5 rounded-xl self-end sm:self-auto">
                  <span className="text-xs font-mono text-on-surface-variant font-bold">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    disabled={isCurrentDayClosed}
                    value={transferenciasAmount}
                    onChange={(e) => setTransferenciasAmount(parseFloat(e.target.value) || 0)}
                    className="w-24 bg-transparent text-right font-mono text-xs font-bold text-primary focus:outline-none disabled:opacity-60"
                    placeholder="0.00"
                  />
                  <span className="text-[10px] font-bold text-primary font-mono ml-0.5">CUP</span>
                </div>
              </div>

              {/* Item 3: Monto Total de Devoluciones (Ventas Anuladas / Reembolsos) */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-xl bg-surface neo-raised gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-lg bg-surface neo-inset flex items-center justify-center text-amber-600 shrink-0">
                    <span className="material-symbols-outlined text-[20px]">
                      assignment_return
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-on-surface">
                      Monto Total de Devoluciones
                    </span>
                    <span className="text-[10px] text-on-surface-variant font-medium">
                      Reembolsos del día ({devolucionesToday.length + voidedSalesToday.length} {(devolucionesToday.length + voidedSalesToday.length) === 1 ? 'operación' : 'operaciones'}
                      {damagedCountToday > 0 ? ` • ${damagedCountToday} art. en mal estado` : ''})
                    </span>
                    {devolucionesAmount !== autoDevolucionesTotal && !isCurrentDayClosed && (
                      <button
                        onClick={() => setDevolucionesAmount(autoDevolucionesTotal)}
                        className="text-[10px] text-amber-600 underline text-left font-semibold mt-0.5 cursor-pointer"
                        type="button"
                      >
                        Sincronizar con devoluciones (${formatCUP(autoDevolucionesTotal)} CUP)
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 bg-surface neo-inset px-2.5 py-1.5 rounded-xl self-end sm:self-auto">
                  <span className="text-xs font-mono text-on-surface-variant font-bold">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    disabled={isCurrentDayClosed}
                    value={devolucionesAmount}
                    onChange={(e) => setDevolucionesAmount(parseFloat(e.target.value) || 0)}
                    className="w-24 bg-transparent text-right font-mono text-xs font-bold text-amber-600 focus:outline-none disabled:opacity-60"
                    placeholder="0.00"
                  />
                  <span className="text-[10px] font-bold text-amber-600 font-mono ml-0.5">CUP</span>
                </div>
              </div>

              {/* Item 3: Total Recaudado (Suma Efectivo + Transferencias) */}
              <div className="p-4 rounded-xl bg-primary/5 border border-primary/25 neo-inset flex flex-col gap-2.5 mt-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-white shadow-sm">
                      <span className="material-symbols-outlined text-[22px]">savings</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs font-bold uppercase tracking-wider text-primary">
                        Total Recaudado
                      </span>
                      <span className="text-[10px] text-on-surface-variant">
                        Efectivo + Transferencias - Devoluciones
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="font-headline font-bold text-xl text-primary font-mono block">
                      ${formatCUP(totalGeneralContado)}
                    </span>
                    <span className="text-[10px] font-bold text-on-surface-variant font-mono">
                      CUP
                    </span>
                  </div>
                </div>
                <div className="flex flex-col gap-1 pt-2 border-t border-primary/15 text-xs font-semibold">
                  <div className="flex items-center justify-between">
                    <span className="text-on-surface-variant text-[11px]">
                      {devolucionesAmount > 0
                        ? `Diferencia Real vs Neto (${formatCUP(netIpvExpected)} CUP tras -$${formatCUP(devolucionesAmount)} en devoluciones):`
                        : `Diferencia Real vs Facturado (IPV $${formatCUP(ipvTotalVendido)}):`}
                    </span>
                    <span
                      className={`font-mono text-xs font-bold ${
                        netDifference === 0
                          ? 'text-emerald-600'
                          : netDifference > 0
                          ? 'text-primary'
                          : 'text-error'
                      }`}
                    >
                      {netDifference === 0
                        ? '✓ Cuadrado Exacto (0.00)'
                        : netDifference > 0
                        ? `+$${formatCUP(netDifference)} Superávit`
                        : `-$${formatCUP(Math.abs(netDifference))} Faltante`}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Custody and Responsible Card */}
          <div className="rounded-2xl bg-surface neo-raised p-5 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-surface neo-inset flex items-center justify-center text-primary">
                  <span className="material-symbols-outlined text-[16px]">person</span>
                </div>
                <span className="text-xs font-bold text-on-surface">Datos de Custodia</span>
              </div>
              <span className="text-[10px] text-on-surface-variant font-mono">{todayDate}</span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs pt-1">
              <div className="p-2.5 rounded-xl bg-surface neo-inset flex flex-col">
                <label className="text-[10px] text-on-surface-variant uppercase font-medium">
                  Nombre del Responsable
                </label>
                <input
                  type="text"
                  value={responsibleName}
                  onChange={(e) => setResponsibleName(e.target.value)}
                  className="font-bold text-on-surface mt-0.5 bg-transparent focus:outline-none text-xs w-full"
                  placeholder="Nombre del vendedor"
                />
                <span className="text-[10px] text-on-surface-variant mt-0.5">Vendedor</span>
              </div>
              <div className="p-2.5 rounded-xl bg-surface neo-inset flex flex-col justify-center">
                <span className="text-[10px] text-on-surface-variant uppercase font-medium">
                  Fecha del Cierre
                </span>
                <span className="font-bold text-on-surface mt-0.5 truncate text-xs font-mono">
                  {todayDate}
                </span>
                <span className="text-[10px] text-on-surface-variant font-mono">{closeTime}</span>
              </div>
            </div>

            {/* Optional Notes Field */}
            <div className="flex flex-col gap-1.5 mt-1">
              <label
                className="text-[10px] font-semibold text-on-surface-variant uppercase"
                htmlFor="cash-notes"
              >
                Observaciones del cierre (opcional)
              </label>
              <input
                id="cash-notes"
                type="text"
                disabled={isCurrentDayClosed}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Sin incidencias en el cierre del día..."
                className="w-full bg-surface neo-inset px-3 py-2 rounded-xl text-xs text-on-surface placeholder:text-on-surface-variant/60 focus:outline-none disabled:opacity-60"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col gap-3">
            {isCurrentDayClosed ? (
              <button
                onClick={() => setShowReopenConfirm(true)}
                className="w-full py-4 px-6 rounded-2xl bg-amber-600 text-white font-headline font-semibold text-sm shadow-md hover:bg-amber-700 active:scale-[0.99] transition-all flex items-center justify-center gap-3 cursor-pointer"
                type="button"
              >
                <span className="material-symbols-outlined text-[20px]">lock_open</span>
                <span>Reabrir Jornada del Día</span>
              </button>
            ) : (
              <button
                onClick={() => setShowActaModal(true)}
                className="w-full py-4 px-6 rounded-2xl bg-primary text-white font-headline font-semibold text-sm shadow-[0_8px_20px_rgba(99,102,241,0.25)] hover:opacity-95 active:scale-[0.99] transition-all flex items-center justify-center gap-3 cursor-pointer"
                type="button"
              >
                <span className="material-symbols-outlined text-[20px]">verified</span>
                <span>Cerrar Día y Generar Acta</span>
              </button>
            )}

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setShowHistoryModal(true)}
                className="py-2.5 px-4 rounded-xl bg-surface neo-raised hover:text-primary active:neo-inset text-xs font-semibold text-on-surface transition-all flex items-center justify-center gap-2 cursor-pointer"
                type="button"
              >
                <span className="material-symbols-outlined text-[16px]">history</span>
                <span>Historial de Cierres</span>
              </button>
              <button
                onClick={() => setShowActaModal(true)}
                className="py-2.5 px-4 rounded-xl bg-surface neo-raised hover:text-primary active:neo-inset text-xs font-semibold text-on-surface transition-all flex items-center justify-center gap-2 cursor-pointer"
                type="button"
              >
                <span className="material-symbols-outlined text-[16px]">print</span>
                <span>Vista Previa Acta</span>
              </button>
            </div>

            {/* Botón Exportar Cierre */}
            <button
              onClick={handleExportClose}
              disabled={isExporting}
              className="w-full py-3 px-5 rounded-2xl bg-surface neo-raised hover:text-primary active:neo-inset text-xs font-bold text-on-surface transition-all flex items-center justify-between border border-outline-variant/30 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-sm group"
              type="button"
              title="Genera reporte en PDF y Excel en Documentos/IPV/Reportes/AAAA/MM"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0 group-hover:bg-emerald-500/20 transition-colors">
                  <span className="material-symbols-outlined text-[18px]">
                    {isExporting ? 'hourglass_top' : 'file_download'}
                  </span>
                </div>
                <div className="flex flex-col text-left">
                  <span className="text-xs font-bold text-on-surface group-hover:text-primary transition-colors">
                    {isExporting ? 'Exportando cierre...' : 'Exportar cierre'}
                  </span>
                  <span className="text-[10px] text-on-surface-variant font-normal">
                    Genera PDF y Excel (.xlsx)
                  </span>
                </div>
              </div>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-surface neo-inset text-emerald-700">
                PDF + XLSX
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Official Thermal Ticket / Acta Modal */}
      {showActaModal && (
        <div className="fixed inset-0 z-50 bg-inverse-surface/40 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
          <div className="w-full max-w-xl max-h-[94vh] sm:max-h-[90vh] rounded-2xl bg-surface neo-raised p-4 sm:p-5 flex flex-col gap-3 shadow-2xl my-auto animate-fade-in border border-outline-variant/30">
            {/* Header */}
            <div className="shrink-0 flex items-center justify-between pb-2.5 border-b border-outline-variant/30">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[20px]">receipt_long</span>
                </div>
                <div>
                  <h3 className="font-headline font-bold text-sm text-on-surface">
                    Acta Oficial de Cierre de Caja
                  </h3>
                  <p className="text-[10px] text-on-surface-variant font-mono">
                    {todayDate} • {closeTime} • <span className={isCurrentDayClosed ? 'text-emerald-700 font-semibold' : 'text-amber-700 font-semibold'}>{isCurrentDayClosed ? 'JORNADA CERRADA' : 'POR CERRAR'}</span>
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={handlePrintActa}
                  className="px-2.5 py-1.5 rounded-lg bg-surface neo-raised flex items-center gap-1.5 text-xs font-semibold text-on-surface hover:text-primary active:neo-inset cursor-pointer transition-colors"
                  type="button"
                  title="Imprimir Comprobante Térmico"
                >
                  <span className="material-symbols-outlined text-[16px]">print</span>
                  <span className="hidden sm:inline text-[11px]">Imprimir</span>
                </button>
                <button
                  onClick={() => setShowActaModal(false)}
                  className="w-7 h-7 rounded-lg bg-surface neo-raised flex items-center justify-center text-on-surface-variant hover:text-on-surface active:neo-inset cursor-pointer"
                  type="button"
                >
                  <span className="material-symbols-outlined text-[16px]">close</span>
                </button>
              </div>
            </div>

            {/* Thermal Slip Simulation - Responsive Scrollable Container */}
            <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar bg-white p-3.5 sm:p-4 rounded-xl shadow-inner font-mono text-[10px] sm:text-[11px] text-neutral-800 flex flex-col gap-1.5 border border-neutral-300">
              <div className="text-center pb-2 border-b border-dashed border-neutral-400">
                <p className="font-bold text-sm text-neutral-900">{APP_NAME}</p>
                <p className="text-[9px] sm:text-[10px] text-neutral-600 tracking-wider font-semibold">ACTA DE CIERRE DIARIO</p>
              </div>

              <div className="grid grid-cols-2 text-[10px] pt-0.5 gap-y-0.5 text-neutral-700">
                <div><span>FECHA: </span><strong>{todayDate}</strong></div>
                <div className="text-right"><span>HORA: </span><strong>{closeTime}</strong></div>
                <div><span>RESPONSABLE: </span><strong>{responsibleName.toUpperCase()}</strong></div>
                <div className="text-right"><span>ESTADO: </span><strong>{isCurrentDayClosed ? 'CERRADO' : 'POR CERRAR'}</strong></div>
              </div>

              <div className="my-0.5 border-t border-dashed border-neutral-400"></div>

              <p className="font-bold text-center text-[10px] sm:text-[11px] text-neutral-900">VENTAS REGISTRADAS EN IPV</p>
              <div className="flex justify-between py-0.5">
                <span>Ventas en Efectivo:</span>
                <span className="font-semibold">${formatCUP(totalVentasEfectivo)} CUP</span>
              </div>
              <div className="flex justify-between py-0.5">
                <span>Ventas por Transferencia:</span>
                <span className="font-semibold">${formatCUP(totalVentasTransferencia)} CUP</span>
              </div>
              <div className="flex justify-between font-bold bg-neutral-100/70 px-2 py-1 rounded">
                <span>TOTAL FACTURADO IPV:</span>
                <span>${formatCUP(ipvTotalVendido)} CUP</span>
              </div>

              <div className="my-0.5 border-t border-dashed border-neutral-400"></div>

              <div className="flex items-center justify-between">
                <p className="font-bold text-[10px] sm:text-[11px] text-neutral-900">DESGLOSE DE EFECTIVO CONTADO</p>
                <span className="text-[9px] text-neutral-500 font-normal">Moneda: CUP</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-0.5 bg-neutral-50 p-2 rounded border border-neutral-200/80">
                {denominations.map((d) => (
                  <div key={d.id} className="flex justify-between py-0.5 border-b border-neutral-200/50 last:border-0 sm:border-0">
                    <span className="text-neutral-600">
                      {d.count.toString().padStart(2, ' ')}x ${d.value} CUP
                    </span>
                    <span className="font-semibold text-neutral-900">${formatCUP(d.count * d.value)}</span>
                  </div>
                ))}
              </div>

              {(devolucionesAmount > 0 || damagedCountToday > 0) && (
                <div className="flex flex-col gap-0.5 py-1 px-2 rounded bg-amber-50/70 border border-amber-200/60 my-0.5">
                  {devolucionesAmount > 0 && (
                    <div className="flex justify-between text-amber-800 font-semibold text-[10px] sm:text-[11px]">
                      <span>Devoluciones / Reembolsos:</span>
                      <span>-${formatCUP(devolucionesAmount)} CUP</span>
                    </div>
                  )}
                  {damagedCountToday > 0 && (
                    <div className="flex justify-between text-red-800 font-semibold text-[10px] sm:text-[11px]">
                      <span>Artículos en Mal Estado:</span>
                      <span>{damagedCountToday} u. (Merma/Garantía)</span>
                    </div>
                  )}
                </div>
              )}

              <div className="my-0.5 border-t border-dashed border-neutral-400"></div>

              <div className="flex justify-between font-bold py-0.5">
                <span>EFECTIVO CONTADO TOTAL:</span>
                <span className="text-neutral-900">${formatCUP(totalCashFisico)} CUP</span>
              </div>
              <div className="flex justify-between py-0.5">
                <span>Diferencia vs Ventas Efectivo:</span>
                <span className={cashDifference === 0 ? 'text-neutral-700' : cashDifference > 0 ? 'text-blue-700 font-bold' : 'text-red-700 font-bold'}>
                  {cashDifference === 0 ? '0.00 (Exacto)' : `${cashDifference > 0 ? '+' : ''}${formatCUP(cashDifference)} CUP`}
                </span>
              </div>
              <div className="flex justify-between py-0.5">
                <span>TRANSFERENCIAS (ENZONA/TRANSFERMÓVIL):</span>
                <span className="font-semibold">${formatCUP(transferenciasAmount)} CUP</span>
              </div>
              <div className="flex justify-between font-bold text-xs pt-1.5 pb-0.5 border-t border-neutral-300 text-neutral-900 bg-neutral-100/60 px-2 rounded">
                <span>TOTAL RECAUDADO:</span>
                <span>${formatCUP(totalGeneralContado)} CUP</span>
              </div>
              <div className="flex justify-between text-[10px] sm:text-[11px] pt-1 px-1">
                <span className="font-semibold">DIFERENCIA REAL VS ESPERADO:</span>
                <span className={netDifference === 0 ? 'font-bold text-emerald-700' : 'font-bold text-red-700'}>
                  {netDifference === 0 ? '0.00 (Cuadrado)' : `${netDifference > 0 ? '+' : ''}${formatCUP(netDifference)} CUP`}
                </span>
              </div>

              {notes && (
                <>
                  <div className="my-0.5 border-t border-dashed border-neutral-400"></div>
                  <p className="text-[10px] text-neutral-600 bg-neutral-50 p-1.5 rounded italic">
                    <strong>OBSERVACIONES:</strong> {notes}
                  </p>
                </>
              )}
            </div>

            {/* Modal Footer */}
            <div className="shrink-0 flex items-center justify-between gap-3 pt-2 border-t border-outline-variant/30">
              <span className="text-[10px] text-on-surface-variant font-mono">
                {isCurrentDayClosed ? 'Jornada finalizada' : 'Confirmación requerida'}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowActaModal(false)}
                  className="px-4 py-2 rounded-xl bg-surface neo-raised text-xs font-semibold text-on-surface hover:text-error active:neo-inset cursor-pointer"
                  type="button"
                >
                  Cerrar
                </button>
                {!isCurrentDayClosed && (
                  <button
                    disabled={isSubmitting}
                    onClick={handlePerformClose}
                    className="px-5 py-2.5 rounded-xl bg-primary text-white text-xs font-bold hover:bg-primary-container transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-sm"
                    type="button"
                  >
                    <span className="material-symbols-outlined text-[16px]">lock</span>
                    <span>Confirmar y Cerrar Día</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal to Reopen Day */}
      {showReopenConfirm && (
        <div className="fixed inset-0 z-50 bg-inverse-surface/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl bg-surface neo-raised p-6 flex flex-col gap-4 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[24px]">lock_open</span>
              </div>
              <div>
                <h3 className="font-headline font-bold text-base text-on-surface">
                  ¿Reabrir Jornada del Día?
                </h3>
                <span className="text-xs text-on-surface-variant font-mono">
                  Fecha: {todayDate}
                </span>
              </div>
            </div>

            <p className="text-xs text-on-surface-variant leading-relaxed">
              Al reabrir el día, el arqueo guardado se cancelará temporalmente y se habilitarán nuevamente
              las ventas y anulaciones en el punto de venta. Deberá realizar un nuevo cierre de caja antes de finalizar el turno.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setShowReopenConfirm(false)}
                className="px-4 py-2 rounded-xl bg-surface neo-raised text-xs font-semibold text-on-surface-variant hover:text-on-surface active:neo-inset cursor-pointer"
                type="button"
              >
                Cancelar
              </button>
              <button
                disabled={isSubmitting}
                onClick={handlePerformReopen}
                className="px-5 py-2 rounded-xl bg-amber-600 text-white text-xs font-semibold hover:bg-amber-700 active:neo-inset transition-all cursor-pointer disabled:opacity-50"
                type="button"
              >
                Sí, Reabrir Día
              </button>
            </div>
          </div>
        </div>
      )}

      {/* History Modal - Real data from api.cash.listCloses */}
      {showHistoryModal && (
        <div className="fixed inset-0 z-50 bg-inverse-surface/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-xl rounded-2xl bg-surface neo-raised p-6 flex flex-col gap-4 shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-outline-variant/30">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[22px]">history</span>
                <h3 className="font-bold text-sm text-on-surface">Histórico de Cierres de Caja (SQLite)</h3>
              </div>
              <button
                onClick={() => setShowHistoryModal(false)}
                className="w-7 h-7 rounded-lg bg-surface neo-raised flex items-center justify-center text-on-surface-variant hover:text-on-surface active:neo-inset cursor-pointer"
                type="button"
              >
                <span className="material-symbols-outlined text-[16px]">close</span>
              </button>
            </div>

            {isLoadingHistory ? (
              <div className="p-8 text-center text-xs text-on-surface-variant">
                Cargando histórico de arqueos...
              </div>
            ) : historyList.length === 0 ? (
              <div className="p-8 text-center flex flex-col items-center gap-2 text-on-surface-variant">
                <span className="material-symbols-outlined text-[32px] opacity-40">event_busy</span>
                <span className="text-xs">No hay cierres de caja registrados todavía en la base SQLite.</span>
              </div>
            ) : (
              <div className="flex flex-col gap-2.5 max-h-80 overflow-y-auto pr-1">
                {historyList.map((c) => (
                  <div
                    key={c.date}
                    className="p-3.5 rounded-xl bg-surface neo-inset flex items-center justify-between text-xs"
                  >
                    <div className="flex flex-col gap-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-bold font-mono text-on-surface">{c.date}</span>
                        <span className="text-[10px] text-on-surface-variant font-mono">
                          {c.closedAt}
                        </span>
                      </div>
                      <span className="text-[11px] text-on-surface-variant">
                        Facturado IPV: <strong className="font-mono text-on-surface">${formatCUP(c.totalIpv)} CUP</strong>
                      </span>
                      {c.note && (
                        <span className="text-[10px] text-on-surface-variant italic">
                          Nota: {c.note}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-0.5">
                      <span className="font-mono font-bold text-on-surface">
                        ${formatCUP(c.totalContado)} CUP
                      </span>
                      <span
                        className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full ${
                          c.diferencia === 0
                            ? 'bg-emerald-100 text-emerald-800'
                            : c.diferencia > 0
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {c.diferencia === 0
                          ? 'Cuadrado (0.00)'
                          : c.diferencia > 0
                          ? `+$${formatCUP(c.diferencia)} Sobrante`
                          : `-$${formatCUP(Math.abs(c.diferencia))} Faltante`}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setShowHistoryModal(false)}
                className="px-4 py-2 rounded-xl bg-surface neo-raised text-xs font-semibold text-primary active:neo-inset cursor-pointer"
                type="button"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Exportar Cierre de Caja del Día (Preguntar ruta y mostrar detalle) */}
      {isExportCloseModalOpen && (
        <div className="fixed inset-0 z-50 bg-inverse-surface/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-2xl bg-surface neo-raised p-6 flex flex-col gap-5 shadow-2xl">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-surface neo-inset flex items-center justify-center text-primary shrink-0">
                <span className="material-symbols-outlined text-[26px]">file_download</span>
              </div>
              <div className="flex flex-col flex-1">
                <h3 className="text-base font-bold text-on-surface">Exportar Cierre de Caja del Día</h3>
                <p className="text-xs text-on-surface-variant mt-1 leading-relaxed">
                  Se generará el reporte oficial en Excel (.xlsx) y PDF. Al presionar continuar, se le solicitará elegir la carpeta en su computadora donde desea guardarlos.
                </p>
              </div>
            </div>

            {/* Campo editable de ruta donde desea guardar */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-on-surface flex items-center justify-between">
                <span>Ruta y carpeta donde desea guardar:</span>
                <span className="text-[10px] text-primary font-mono font-semibold">Selector de Sistema</span>
              </label>
              <div className="flex items-center gap-2 p-2.5 rounded-xl bg-surface neo-inset">
                <span className="material-symbols-outlined text-primary text-[20px] shrink-0">folder_open</span>
                <input
                  type="text"
                  value={exportDestinationPath}
                  onChange={(e) => setExportDestinationPath(e.target.value)}
                  placeholder="Documentos/IPV/Reportes/..."
                  className="bg-transparent border-none text-xs font-mono text-on-surface focus:outline-none w-full"
                />
              </div>
              <span className="text-[10px] text-on-surface-variant">
                Al presionar "Seleccionar Carpeta y Guardar" se abrirá la ventana de su sistema para confirmar la carpeta y nombre final.
              </span>
            </div>

            {/* Resumen del Contenido que incluirá el Excel */}
            <div className="flex flex-col gap-2 p-3.5 rounded-xl bg-surface neo-inset text-xs">
              <span className="font-bold text-on-surface text-[11px] uppercase tracking-wider text-primary">
                Contenido que incluirá la exportación:
              </span>
              <div className="grid grid-cols-2 gap-2 mt-1 text-[11px]">
                <div className="flex items-center gap-1.5 text-on-surface">
                  <span className="material-symbols-outlined text-primary text-[15px]">check_circle</span>
                  <span>Arqueo y efectivo físico ({formatCUP(totalGeneralContado)} CUP)</span>
                </div>
                <div className="flex items-center gap-1.5 text-on-surface">
                  <span className="material-symbols-outlined text-primary text-[15px]">check_circle</span>
                  <span>Ventas brutas IPV ({formatCUP(ipvTotalVendido)} CUP)</span>
                </div>
                <div className="flex items-center gap-1.5 text-on-surface col-span-2">
                  <span className="material-symbols-outlined text-rose-600 text-[15px]">assignment_return</span>
                  <span className="font-semibold text-rose-700">
                    Registro de Devoluciones del Día: {devolucionesToday.length} devoluciones (-${formatCUP(totalDevolucionesRefundToday)} CUP) con motivo, cliente y método de reembolso
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-on-surface col-span-2">
                  <span className="material-symbols-outlined text-emerald-600 text-[15px]">account_balance_wallet</span>
                  <span className="font-semibold text-emerald-700">
                    Ventas Netas Efectivas: ${formatCUP(Math.max(0, ipvTotalVendido - totalDevolucionesRefundToday))} CUP
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-outline-variant/20">
              <button
                onClick={() => {
                  if (!isExporting) setIsExportCloseModalOpen(false);
                }}
                disabled={isExporting}
                className="px-4 py-2.5 rounded-xl bg-surface neo-raised text-xs font-semibold text-on-surface active:neo-inset disabled:opacity-50 cursor-pointer"
                type="button"
              >
                Cancelar
              </button>
              <button
                onClick={handlePerformExportClose}
                disabled={isExporting}
                className="px-5 py-2.5 rounded-xl bg-primary text-white text-xs font-bold hover:bg-primary-container transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer shadow-md shadow-primary/25"
                type="button"
              >
                <span className="material-symbols-outlined text-[17px]">
                  {isExporting ? 'hourglass_top' : 'folder_open'}
                </span>
                <span>{isExporting ? 'Exportando...' : 'Seleccionar Carpeta y Guardar'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
