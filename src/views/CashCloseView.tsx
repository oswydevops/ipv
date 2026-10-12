import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { DayClose } from '../data/api';
import { APP_NAME } from '../config';

export const CashCloseView: React.FC = () => {
  const {
    todayDate,
    isCurrentDayClosed,
    currentIpvDay,
    denominations,
    updateDenominationCount,
    menoresAmount,
    setMenoresAmount,
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
  const cashDifference = totalCashFisico - totalVentasEfectivo;
  const transferDifference = transferenciasAmount - totalVentasTransferencia;


  // Manejar el cierre real del día
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
            Conciliación de efectivo y transferencias bancarias (EnZona / Transfermóvil).
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
                    Desglose Físico de Billetes y Monedas
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
                <div className="col-span-2 text-right">Facial</div>
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
                      <span className="w-8 h-8 rounded-lg bg-surface neo-inset flex items-center justify-center text-primary text-xs font-bold font-mono">
                        {denom.badge}
                      </span>
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

              {/* Row: Menores y Monedas */}
              <div className="grid grid-cols-12 items-center px-4 py-3 rounded-xl bg-surface neo-raised transition-all">
                <div className="col-span-4 flex items-center gap-2.5">
                  <span className="w-8 h-8 rounded-lg bg-surface neo-inset flex items-center justify-center text-on-surface-variant text-xs font-bold">
                    <span className="material-symbols-outlined text-[16px]">toll</span>
                  </span>
                  <div className="flex flex-col">
                    <span className="text-xs font-semibold text-on-surface">Menores (20, 10, 5)</span>
                    <span className="text-[10px] text-on-surface-variant">Suelto &amp; monedas</span>
                  </div>
                </div>
                <div className="col-span-2 text-right text-xs font-mono text-on-surface-variant font-medium">
                  Mixto
                </div>
                <div className="col-span-3 flex items-center justify-center">
                  <div className="flex items-center bg-surface neo-inset rounded-lg px-2.5 py-1">
                    <span className="text-[10px] font-mono text-on-surface-variant mr-1">$</span>
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      disabled={isCurrentDayClosed}
                      value={menoresAmount}
                      onChange={(e) => setMenoresAmount(parseFloat(e.target.value) || 0)}
                      className="w-16 bg-transparent text-center font-mono text-xs font-semibold text-on-surface focus:outline-none disabled:opacity-60"
                    />
                  </div>
                </div>
                <div className="col-span-3 text-right">
                  <span className="font-mono text-xs font-bold text-on-surface">
                    {formatCUP(menoresAmount)}
                  </span>
                  <span className="text-[10px] text-on-surface-variant ml-0.5">CUP</span>
                </div>
              </div>
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
                  Total Efectivo Físico Contado
                </span>
                <span className="text-xs text-on-surface-variant mt-0.5">
                  Suma de todas las denominaciones de efectivo físico contadas en gaveta
                </span>
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  <span className="text-[11px] text-on-surface-variant font-medium">
                    Esperado en ventas: <strong className="font-mono text-on-surface">${formatCUP(totalVentasEfectivo)} CUP</strong>
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
                <span>{totalPieces} piezas contabilizadas en total</span>
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
                  Resumen de Conciliación
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
                <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-outline-variant/15">
                  <div className="flex flex-col">
                    <span className="text-[10px] text-on-surface-variant flex items-center gap-1 font-medium">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> En Efectivo:
                    </span>
                    <span className="font-mono font-bold text-emerald-600 mt-0.5">
                      ${formatCUP(totalVentasEfectivo)} CUP
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] text-on-surface-variant flex items-center gap-1 font-medium">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary"></span> Transferencia:
                    </span>
                    <span className="font-mono font-bold text-primary mt-0.5">
                      ${formatCUP(totalVentasTransferencia)} CUP
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
                      Efectivo Contado Total
                    </span>
                    <span className="text-[10px] text-on-surface-variant">
                      Billetes y monedas en gaveta
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
                      EnZona / Transfermóvil (Propuesto del IPV: ${formatCUP(totalVentasTransferencia)})
                    </span>
                    {transferDifference !== 0 && !isCurrentDayClosed && (
                      <button
                        onClick={() => setTransferenciasAmount(totalVentasTransferencia)}
                        className="text-[10px] text-primary underline text-left font-semibold mt-0.5 cursor-pointer"
                        type="button"
                      >
                        Sincronizar con ventas (${formatCUP(totalVentasTransferencia)} CUP)
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
                        Efectivo Contado + Transferencias
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
                <div className="flex items-center justify-between pt-2 border-t border-primary/15 text-xs font-semibold">
                  <span className="text-on-surface-variant text-[11px]">
                    Diferencia Real vs Facturado (IPV ${formatCUP(ipvTotalVendido)}):
                  </span>
                  <span
                    className={`font-mono text-xs font-bold ${
                      diferenciaCaja === 0
                        ? 'text-emerald-600'
                        : diferenciaCaja > 0
                        ? 'text-primary'
                        : 'text-error'
                    }`}
                  >
                    {diferenciaCaja === 0
                      ? '✓ Cuadrado Exacto (0.00)'
                      : diferenciaCaja > 0
                      ? `+$${formatCUP(diferenciaCaja)} Superávit`
                      : `-$${formatCUP(Math.abs(diferenciaCaja))} Faltante`}
                  </span>
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
                <span className="text-xs font-bold text-on-surface">Datos de Custodia y Turno</span>
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
                Observaciones del arqueo (opcional)
              </label>
              <input
                id="cash-notes"
                type="text"
                disabled={isCurrentDayClosed}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Sin incidencias en el arqueo del día..."
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
                <span>Historial Arqueos</span>
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
          </div>
        </div>
      </div>

      {/* Official Thermal Ticket / Acta Modal */}
      {showActaModal && (
        <div className="fixed inset-0 z-50 bg-inverse-surface/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl bg-surface neo-raised p-6 flex flex-col gap-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-outline-variant/30">
              <div className="flex items-center gap-2.5">
                <span className="material-symbols-outlined text-primary text-[24px]">receipt</span>
                <div>
                  <h3 className="font-headline font-bold text-sm text-on-surface">
                    Acta Oficial de Cierre de Caja
                  </h3>
                  <p className="text-[10px] text-on-surface-variant font-mono">{todayDate} • {closeTime}</p>
                </div>
              </div>
              <button
                onClick={() => setShowActaModal(false)}
                className="w-7 h-7 rounded-lg bg-surface neo-raised flex items-center justify-center text-on-surface-variant hover:text-on-surface active:neo-inset cursor-pointer"
                type="button"
              >
                <span className="material-symbols-outlined text-[16px]">close</span>
              </button>
            </div>

            {/* Thermal Slip Simulation */}
            <div className="bg-white p-5 rounded-xl shadow-inner font-mono text-[11px] text-neutral-800 flex flex-col gap-2 border border-neutral-300">
              <div className="text-center pb-2 border-b border-dashed border-neutral-400">
                <p className="font-bold text-sm">{APP_NAME}</p>
                <p className="text-[10px]">ACTA DE ARQUEO Y CIERRE DIARIO</p>
              </div>

              <div className="flex justify-between text-[10px] pt-1">
                <span>FECHA: {todayDate}</span>
                <span>HORA: {closeTime}</span>
              </div>
              <div className="flex justify-between text-[10px]">
                <span>RESPONSABLE: {responsibleName.toUpperCase()}</span>
                <span>ESTADO: {isCurrentDayClosed ? 'CERRADO' : 'POR CERRAR'}</span>
              </div>

              <div className="my-1 border-t border-dashed border-neutral-400"></div>

              <p className="font-bold text-center">VENTAS REGISTRADAS EN IPV</p>
              <div className="flex justify-between">
                <span>Ventas en Efectivo:</span>
                <span>${formatCUP(totalVentasEfectivo)} CUP</span>
              </div>
              <div className="flex justify-between">
                <span>Ventas por Transferencia:</span>
                <span>${formatCUP(totalVentasTransferencia)} CUP</span>
              </div>
              <div className="flex justify-between font-bold">
                <span>TOTAL FACTURADO IPV:</span>
                <span>${formatCUP(ipvTotalVendido)} CUP</span>
              </div>

              <div className="my-1 border-t border-dashed border-neutral-400"></div>

              <p className="font-bold text-center">DESGLOSE DE EFECTIVO CONTADO (CUP)</p>
              {denominations.map((d) => (
                <div key={d.id} className="flex justify-between">
                  <span>
                    {d.count.toString().padStart(2, ' ')}x ${d.value} CUP
                  </span>
                  <span>${formatCUP(d.count * d.value)}</span>
                </div>
              ))}
              <div className="flex justify-between">
                <span>Menores / Suelto:</span>
                <span>${formatCUP(menoresAmount)}</span>
              </div>

              <div className="my-1 border-t border-dashed border-neutral-400"></div>

              <div className="flex justify-between font-bold">
                <span>EFECTIVO CONTADO TOTAL:</span>
                <span>${formatCUP(totalCashFisico)} CUP</span>
              </div>
              <div className="flex justify-between">
                <span>Diferencia vs Ventas Efectivo:</span>
                <span className={cashDifference === 0 ? '' : cashDifference > 0 ? 'text-blue-700 font-bold' : 'text-red-700 font-bold'}>
                  {cashDifference === 0 ? '0.00 (Exacto)' : `${cashDifference > 0 ? '+' : ''}${formatCUP(cashDifference)} CUP`}
                </span>
              </div>
              <div className="flex justify-between">
                <span>TRANSFERENCIAS (ENZONA/TRANSFERMÓVIL):</span>
                <span>${formatCUP(transferenciasAmount)} CUP</span>
              </div>
              <div className="flex justify-between font-bold text-xs pt-1 border-t border-neutral-300 text-neutral-900">
                <span>TOTAL RECAUDADO:</span>
                <span>${formatCUP(totalGeneralContado)} CUP</span>
              </div>
              <div className="flex justify-between text-[11px] pt-1">
                <span>DIFERENCIA REAL VS IPV:</span>
                <span className={diferenciaCaja === 0 ? 'font-bold text-emerald-700' : 'font-bold text-red-700'}>
                  {diferenciaCaja === 0 ? '0.00 (Cuadrado)' : `${diferenciaCaja > 0 ? '+' : ''}${formatCUP(diferenciaCaja)} CUP`}
                </span>
              </div>

              {notes && (
                <>
                  <div className="my-1 border-t border-dashed border-neutral-400"></div>
                  <p className="text-[10px] text-neutral-600">OBSERVACIONES: {notes}</p>
                </>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
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
                  className="px-5 py-2.5 rounded-xl bg-primary text-white text-xs font-bold hover:bg-primary-container transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  type="button"
                >
                  <span className="material-symbols-outlined text-[16px]">lock</span>
                  <span>Confirmar y Cerrar Día</span>
                </button>
              )}
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
    </div>
  );
};
