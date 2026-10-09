import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';

export const CashCloseView: React.FC = () => {
  const {
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
    openSaleModal,
    showToast,
    recalculateCash,
  } = useApp();

  const [responsibleName, setResponsibleName] = useState('M. Gómez');
  const [closeDate] = useState('24 de Octubre de 2024');
  const [closeTime] = useState('18:30 hrs');
  const [notes, setNotes] = useState('');
  const [showActaModal, setShowActaModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  // Format currency in es-CU / standard style
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

  // Keyboard shortcut F12 to complete close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F12') {
        e.preventDefault();
        setShowActaModal(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleSaveDraft = () => {
    showToast('Cierre Parcial Guardado', 'Se ha salvado el borrador del cierre en la base SQLite.');
  };

  const handleCompleteClose = () => {
    setShowActaModal(true);
  };

  return (
    <div className="flex flex-col w-full gap-7 pb-12 select-none">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="font-headline font-bold text-2xl lg:text-3xl text-on-surface tracking-tight">
            Cierre de Caja
          </h1>
          <p className="text-xs sm:text-sm text-on-surface-variant font-medium">
            Conciliación de efectivo y transferencias bancarias (EnZona / Transfermóvil).
          </p>
        </div>

        {/* Quick Actions Top Bar */}
        <div className="flex items-center gap-3">
          <div className="h-11 px-4 rounded-xl bg-surface neo-inset flex items-center gap-2.5 text-xs text-on-surface-variant font-medium">
            <span className="material-symbols-outlined text-primary text-[18px]">search_off</span>
            <span>
              Corte: <strong>18:30 hrs</strong>
            </span>
          </div>
          <button
            onClick={recalculateCash}
            className="h-11 px-4 rounded-xl bg-surface neo-raised hover:text-primary active:neo-inset flex items-center gap-2 text-xs font-semibold text-on-surface transition-all"
            type="button"
          >
            <span className="material-symbols-outlined text-[18px]">sync</span>
            <span>Recalcular</span>
          </button>
          <button
            onClick={() => setShowHistoryModal(true)}
            className="h-11 w-11 rounded-xl bg-surface neo-raised hover:text-primary active:neo-inset flex items-center justify-center text-on-surface-variant transition-all"
            title="Historial de arqueos previos"
            type="button"
          >
            <span className="material-symbols-outlined text-[20px]">history</span>
          </button>
        </div>
      </div>

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
                          className="w-5 h-5 rounded flex items-center justify-center text-on-surface-variant hover:text-primary transition-colors text-sm font-bold"
                          type="button"
                        >
                          -
                        </button>
                        <input
                          type="number"
                          min="0"
                          value={denom.count}
                          onChange={(e) =>
                            updateDenominationCount(denom.id, parseInt(e.target.value) || 0)
                          }
                          className="w-12 bg-transparent text-center font-mono text-xs font-semibold text-on-surface focus:outline-none"
                        />
                        <button
                          onClick={() => updateDenominationCount(denom.id, denom.count + 1)}
                          className="w-5 h-5 rounded flex items-center justify-center text-on-surface-variant hover:text-primary transition-colors text-sm font-bold"
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
                      value={menoresAmount}
                      onChange={(e) => setMenoresAmount(parseFloat(e.target.value) || 0)}
                      className="w-16 bg-transparent text-center font-mono text-xs font-semibold text-on-surface focus:outline-none"
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
                      EnZona / Transfermóvil (Ventas: ${formatCUP(totalVentasTransferencia)})
                    </span>
                    {transferDifference !== 0 && (
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
                    value={transferenciasAmount}
                    onChange={(e) => setTransferenciasAmount(parseFloat(e.target.value) || 0)}
                    className="w-24 bg-transparent text-right font-mono text-xs font-bold text-primary focus:outline-none"
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
                    Cuadre Global vs Facturado (IPV ${formatCUP(ipvTotalVendido)}):
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
              <span className="text-[10px] text-on-surface-variant font-mono">{closeDate}</span>
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
                  placeholder="Nombre del responsable"
                />
                <span className="text-[10px] text-on-surface-variant mt-0.5">Encargado de Turno</span>
              </div>
              <div className="p-2.5 rounded-xl bg-surface neo-inset flex flex-col justify-center">
                <span className="text-[10px] text-on-surface-variant uppercase font-medium">
                  Fecha del Cierre
                </span>
                <span className="font-bold text-on-surface mt-0.5 truncate text-xs">
                  {closeDate}
                </span>
                <span className="text-[10px] text-on-surface-variant">{closeTime}</span>
              </div>
            </div>

            {/* Optional Notes Field */}
            <div className="flex flex-col gap-1.5 mt-1">
              <label
                className="text-[10px] font-semibold text-on-surface-variant uppercase"
                htmlFor="cash-notes"
              >
                Observaciones del corte (opcional)
              </label>
              <input
                id="cash-notes"
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Sin incidencias en el arqueo del día..."
                className="w-full bg-surface neo-inset px-3 py-2 rounded-xl text-xs text-on-surface placeholder:text-on-surface-variant/60 focus:outline-none"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col gap-3">
            <button
              onClick={handleCompleteClose}
              className="w-full py-4 px-6 rounded-2xl bg-primary text-white font-headline font-semibold text-sm shadow-[0_8px_20px_rgba(99,102,241,0.25)] hover:opacity-95 active:scale-[0.99] transition-all flex items-center justify-center gap-3 cursor-pointer"
              type="button"
            >
              <span className="material-symbols-outlined text-[20px]">verified</span>
              <span>Completar Cierre de Caja e Imprimir Acta [F12]</span>
            </button>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={handleSaveDraft}
                className="py-2.5 px-4 rounded-xl bg-surface neo-raised hover:text-primary active:neo-inset text-xs font-semibold text-on-surface transition-all flex items-center justify-center gap-2 cursor-pointer"
                type="button"
              >
                <span className="material-symbols-outlined text-[16px]">save</span>
                <span>Guardar Parcial</span>
              </button>
              <button
                onClick={() => setShowActaModal(true)}
                className="py-2.5 px-4 rounded-xl bg-surface neo-raised hover:text-primary active:neo-inset text-xs font-semibold text-on-surface transition-all flex items-center justify-center gap-2 cursor-pointer"
                type="button"
              >
                <span className="material-symbols-outlined text-[16px]">print</span>
                <span>Vista Previa</span>
              </button>
            </div>
          </div>

          {/* Security Notice */}
          <div className="flex items-center gap-2 text-[10px] text-on-surface-variant px-1 justify-center">
            <span className="material-symbols-outlined text-[14px]">shield</span>
            <span>El cierre genera una firma criptográfica en el archivo local SQLite.</span>
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
                  <p className="text-[10px] text-on-surface-variant">{closeDate} • {closeTime}</p>
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
                <p className="font-bold text-sm">FERRETERÍA CENTRAL</p>
                <p className="text-[10px]">CONTROL DE VENTAS</p>
                <p className="text-[10px]">RUT / REGISTRO: 0102934-CU</p>
              </div>

              <div className="flex justify-between text-[10px] pt-1">
                <span>FECHA: {closeDate}</span>
                <span>HORA: {closeTime}</span>
              </div>
              <div className="flex justify-between text-[10px]">
                <span>RESPONSABLE: {responsibleName.toUpperCase()}</span>
                <span>TURNO: REGULAR</span>
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
              <div className="flex justify-between text-[10px]">
                <span>CUADRE FINAL vs IPV:</span>
                <span className={diferenciaCaja === 0 ? 'font-bold' : 'font-bold text-red-700'}>
                  {diferenciaCaja === 0 ? '0.00 (Cuadrado)' : `${diferenciaCaja > 0 ? '+' : ''}${formatCUP(diferenciaCaja)} CUP`}
                </span>
              </div>

              <div className="my-1 border-t border-dashed border-neutral-400"></div>

              <p className="text-[9px] text-center text-neutral-500 mt-1">
                Firma Criptográfica SHA-256: 7f8a9b1c3d4e5f6a7b8c9d...
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setShowActaModal(false)}
                className="px-4 py-2 rounded-xl bg-surface neo-raised text-xs font-semibold text-on-surface hover:text-error active:neo-inset cursor-pointer"
                type="button"
              >
                Cerrar
              </button>
              <button
                onClick={() => {
                  setShowActaModal(false);
                  showToast(
                    'Acta Generada y Registrada',
                    'Cierre grabado correctamente en la base de datos local SQLite.'
                  );
                }}
                className="px-5 py-2 rounded-xl bg-primary text-white text-xs font-bold hover:bg-primary-container transition-all flex items-center gap-1.5 cursor-pointer"
                type="button"
              >
                <span className="material-symbols-outlined text-[16px]">print</span>
                <span>Imprimir Comprobante</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* History Modal */}
      {showHistoryModal && (
        <div className="fixed inset-0 z-50 bg-inverse-surface/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-2xl bg-surface neo-raised p-6 flex flex-col gap-4 shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-outline-variant/30">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[22px]">history</span>
                <h3 className="font-bold text-sm text-on-surface">Histórico de Arqueos de Turno</h3>
              </div>
              <button
                onClick={() => setShowHistoryModal(false)}
                className="w-7 h-7 rounded-lg bg-surface neo-raised flex items-center justify-center text-on-surface-variant hover:text-on-surface active:neo-inset"
                type="button"
              >
                <span className="material-symbols-outlined text-[16px]">close</span>
              </button>
            </div>
            <div className="flex flex-col gap-2.5 max-h-72 overflow-y-auto">
              {[
                { date: '23/10/2024 · 18:30 hrs', user: 'M. Gómez', total: '43,280.00 CUP', status: 'Recaudado OK' },
                { date: '22/10/2024 · 18:30 hrs', user: 'R. Fernández', total: '51,400.00 CUP', status: 'Recaudado OK' },
                { date: '21/10/2024 · 18:30 hrs', user: 'M. Gómez', total: '39,120.00 CUP', status: 'Recaudado OK' },
              ].map((h, i) => (
                <div key={i} className="p-3 rounded-xl bg-surface neo-inset flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold block text-on-surface">{h.date}</span>
                    <span className="text-[10px] text-on-surface-variant">Responsable: {h.user}</span>
                  </div>
                  <div className="text-right">
                    <span className="font-mono font-bold block text-on-surface">{h.total}</span>
                    <span className="text-[10px] text-emerald-600 font-semibold">{h.status}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setShowHistoryModal(false)}
                className="px-4 py-2 rounded-xl bg-surface neo-raised text-xs font-semibold text-primary active:neo-inset"
                type="button"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
