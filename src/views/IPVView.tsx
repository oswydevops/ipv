import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';

export const IPVView: React.FC = () => {
  const {
    ipvRows,
    updateIpvVendido,
    ipvTotalVendido,
    ipvTotalUnidades,
    totalVentasEfectivo,
    totalVentasTransferencia,
    openSaleModal,
    setCurrentView,
    showToast,
  } = useApp();

  const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'zero' | 'low'>('all');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 5;

  const formatCUP = (val: number) => {
    return Number(val).toLocaleString('es-CU', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const filteredRows = ipvRows.filter((row) => {
    if (activeFilter === 'zero' && row.status !== 'zero') return false;
    if (activeFilter === 'low' && row.status !== 'low') return false;
    if (activeFilter === 'active' && row.vendido === 0) return false;
    if (selectedCategory !== 'all' && row.category !== selectedCategory) return false;
    return true;
  });

  useEffect(() => {
    setCurrentPage(1);
  }, [activeFilter, selectedCategory]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const validPage = Math.min(currentPage, totalPages);
  const paginatedRows = filteredRows.slice((validPage - 1) * pageSize, validPage * pageSize);
  const startIdx = filteredRows.length === 0 ? 0 : (validPage - 1) * pageSize + 1;
  const endIdx = Math.min(validPage * pageSize, filteredRows.length);

  const zeroCount = ipvRows.filter((r) => r.status === 'zero').length;
  const lowCount = ipvRows.filter((r) => r.status === 'low').length;
  const activeCount = ipvRows.filter((r) => r.vendido > 0).length;

  const handleFinalize = () => {
    showToast('IPV Finalizado', 'Saldos de turno cerrados. Procediendo a conciliación de caja.');
    setCurrentView('cierre-de-caja');
  };

  return (
    <div className="flex flex-col w-full gap-6 pb-24 select-none">
      {/* Content Header Area */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight text-on-surface">IPV del día</h1>
          </div>
          <p className="text-xs text-on-surface-variant font-medium">
            Control de movimiento de inventario diario y cálculo automático de ventas por renglón
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => openSaleModal()}
            className="px-4 py-2.5 rounded-xl bg-primary text-white text-xs font-bold shadow-md shadow-primary/25 hover:bg-primary-container transition-all flex items-center gap-2 cursor-pointer"
            type="button"
          >
            <span className="material-symbols-outlined text-[18px]">point_of_sale</span>
            <span>⚡ Registrar Venta Rápida [F1]</span>
          </button>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Total Vendido */}
        <div className="p-5 rounded-2xl bg-surface neo-raised flex flex-col justify-between relative overflow-hidden group">
          <div className="flex items-start justify-between">
            <div className="w-10 h-10 rounded-xl bg-surface neo-inset flex items-center justify-center text-primary">
              <span className="material-symbols-outlined text-xl">payments</span>
            </div>
            <div className="flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-surface-container text-primary">
              <span className="material-symbols-outlined text-[14px]">trending_up</span>
              <span>+12.4%</span>
            </div>
          </div>
          <div className="mt-4">
            <span className="text-[11px] font-semibold tracking-wider uppercase text-on-surface-variant">
              Total Vendido Hoy
            </span>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-2xl font-bold tracking-tight text-on-surface font-mono">
                {formatCUP(ipvTotalVendido)}
              </span>
              <span className="text-xs font-bold text-primary">CUP</span>
            </div>

            {/* Efectivo vs Transferencia Breakdown */}
            <div className="mt-2.5 pt-2 border-t border-outline-variant/15 flex flex-col gap-1 text-[10px]">
              <div className="flex items-center justify-between">
                <span className="text-on-surface-variant flex items-center gap-1 font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Efectivo:
                </span>
                <span className="font-mono font-bold text-emerald-600">
                  ${formatCUP(totalVentasEfectivo)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-on-surface-variant flex items-center gap-1 font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary"></span> Transferencia:
                </span>
                <span className="font-mono font-bold text-primary">
                  ${formatCUP(totalVentasTransferencia)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* KPI 2: Unidades Vendidas */}
        <div className="p-5 rounded-2xl bg-surface neo-raised flex flex-col justify-between relative group">
          <div className="flex items-start justify-between">
            <div className="w-10 h-10 rounded-xl bg-surface neo-inset flex items-center justify-center text-tertiary">
              <span className="material-symbols-outlined text-xl">shopping_cart_checkout</span>
            </div>
            <div className="flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-surface-container text-on-surface-variant">
              <span>{activeCount} renglones</span>
            </div>
          </div>
          <div className="mt-4">
            <span className="text-[11px] font-semibold tracking-wider uppercase text-on-surface-variant">
              Productos Vendidos
            </span>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-2xl font-bold tracking-tight text-on-surface font-mono">
                {ipvTotalUnidades}
              </span>
              <span className="text-xs font-medium text-on-surface-variant">unidades</span>
            </div>
            <p className="text-[11px] text-on-surface-variant mt-1">En {activeCount} ventas registradas</p>
          </div>
        </div>

        {/* KPI 3: Productos en Cero */}
        <div className="p-5 rounded-2xl bg-surface neo-raised flex flex-col justify-between relative group">
          <div className="flex items-start justify-between">
            <div className="w-10 h-10 rounded-xl bg-surface neo-inset flex items-center justify-center text-error">
              <span className="material-symbols-outlined text-xl">remove_shopping_cart</span>
            </div>
            <div className="flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-error-container text-on-error-container">
              <span className="w-1.5 h-1.5 rounded-full bg-error animate-pulse"></span>
              <span>Agotados</span>
            </div>
          </div>
          <div className="mt-4">
            <span className="text-[11px] font-semibold tracking-wider uppercase text-on-surface-variant">
              En Cero / Agotados
            </span>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-2xl font-bold tracking-tight text-error font-mono">{zeroCount}</span>
              <span className="text-xs font-medium text-on-surface-variant">artículos</span>
            </div>
            <p className="text-[11px] text-on-surface-variant mt-1">Requieren reposición urgente</p>
          </div>
        </div>

        {/* KPI 4: Stock Bajo */}
        <div className="p-5 rounded-2xl bg-surface neo-raised flex flex-col justify-between relative group">
          <div className="flex items-start justify-between">
            <div className="w-10 h-10 rounded-xl bg-surface neo-inset flex items-center justify-center text-amber-600">
              <span className="material-symbols-outlined text-xl">production_quantity_limits</span>
            </div>
            <div className="flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-surface-container text-amber-700">
              <span className="material-symbols-outlined text-[13px]">warning</span>
              <span>Bajo umbral</span>
            </div>
          </div>
          <div className="mt-4">
            <span className="text-[11px] font-semibold tracking-wider uppercase text-on-surface-variant">
              Stock Crítico
            </span>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-2xl font-bold tracking-tight text-on-surface font-mono">
                {lowCount}
              </span>
              <span className="text-xs font-medium text-on-surface-variant">artículos</span>
            </div>
            <p className="text-[11px] text-on-surface-variant mt-1">≤ 20% de existencia mínima</p>
          </div>
        </div>
      </div>

      {/* Filters & Controls Bar */}
      <div className="p-4 rounded-2xl bg-surface neo-raised flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
        {/* Segmented Tabs */}
        <div className="p-1 rounded-xl bg-surface neo-inset flex flex-wrap gap-1">
          <button
            onClick={() => setActiveFilter('all')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeFilter === 'all'
                ? 'bg-surface neo-raised text-primary shadow-sm'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
            type="button"
          >
            Todos <span className="ml-1 text-[10px] opacity-75 font-normal">846</span>
          </button>
          <button
            onClick={() => setActiveFilter('active')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeFilter === 'active'
                ? 'bg-surface neo-raised text-primary shadow-sm font-semibold'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
            type="button"
          >
            Con movimiento{' '}
            <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded-full bg-surface-container-high text-on-surface font-bold">
              {activeCount}
            </span>
          </button>
          <button
            onClick={() => setActiveFilter('zero')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeFilter === 'zero'
                ? 'bg-surface neo-raised text-error shadow-sm font-semibold'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
            type="button"
          >
            En cero{' '}
            <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded-full bg-error-container text-on-error-container font-bold">
              {zeroCount}
            </span>
          </button>
          <button
            onClick={() => setActiveFilter('low')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeFilter === 'low'
                ? 'bg-surface neo-raised text-amber-700 shadow-sm font-semibold'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
            type="button"
          >
            Stock bajo{' '}
            <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded-full bg-surface-container-high text-amber-700 font-bold">
              {lowCount}
            </span>
          </button>
        </div>

        {/* Quick Dropdowns & Search/Date */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="appearance-none h-9 pl-3.5 pr-8 rounded-xl bg-surface neo-inset text-xs font-medium text-on-surface focus:outline-none cursor-pointer"
            >
              <option value="all">Todas las categorías</option>
              <option value="Plomería">Plomería y Agua</option>
              <option value="Electricidad">Electricidad e Iluminación</option>
              <option value="Tornillería">Fijaciones y Tornillería</option>
              <option value="Herramientas">Herramientas Manuales</option>
            </select>
            <span className="material-symbols-outlined text-[16px] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-on-surface-variant">
              expand_more
            </span>
          </div>

          <div className="h-9 px-3 rounded-xl bg-surface neo-inset flex items-center gap-2 text-xs font-medium text-on-surface">
            <span className="material-symbols-outlined text-primary text-[16px]">calendar_today</span>
            <span>24 Oct 2024</span>
            <span className="text-[10px] text-on-surface-variant ml-1 font-semibold uppercase">
              Hoy
            </span>
          </div>

          <button
            onClick={() => showToast('Sincronización', 'Saldos del IPV recalculados con éxito.')}
            className="w-9 h-9 rounded-xl bg-surface neo-raised flex items-center justify-center text-on-surface-variant hover:text-primary transition-all active:neo-inset"
            title="Recalcular saldos"
            type="button"
          >
            <span className="material-symbols-outlined text-[18px]">sync</span>
          </button>
        </div>
      </div>

      {/* Master IPV Table Container */}
      <div className="rounded-2xl bg-surface neo-raised overflow-hidden p-3 sm:p-5">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">
                <th className="py-3.5 px-3 w-12 text-center">No.</th>
                <th className="py-3.5 px-4 min-w-[220px]">Producto</th>
                <th className="py-3.5 px-3 text-center w-20">U/M</th>
                <th className="py-3.5 px-3 text-right">Saldo Ini.</th>
                <th className="py-3.5 px-3 text-center">Entrada</th>
                <th className="py-3.5 px-3 text-center">Vendido</th>
                <th className="py-3.5 px-4 text-center">Saldo Final</th>
                <th className="py-3.5 px-3 text-right min-w-[110px]">Precio (CUP)</th>
                <th className="py-3.5 px-4 text-right min-w-[130px]">Importe (CUP)</th>
                <th className="py-3.5 px-3 text-center w-28">Venta</th>
              </tr>
            </thead>
            <tbody className="text-xs font-medium divide-y-0">
              {paginatedRows.map((row) => (
                <tr
                  key={row.id}
                  className="ipv-row group hover:bg-surface-container-low/50 transition-colors"
                >
                  <td className="py-4 px-3 text-center text-on-surface-variant font-mono text-[11px]">
                    {row.num}
                  </td>
                  <td className="py-4 px-4">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-9 h-9 rounded-xl bg-surface neo-inset flex items-center justify-center shrink-0 ${
                          row.status === 'zero'
                            ? 'text-error'
                            : row.status === 'low'
                            ? 'text-amber-600'
                            : 'text-primary'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[18px]">{row.icon}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="font-semibold text-on-surface">{row.name}</span>
                        <span className="text-[10px] text-on-surface-variant">{row.detail}</span>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-3 text-center">
                    <span className="px-2 py-0.5 rounded-lg bg-surface neo-inset text-[11px] text-on-surface-variant">
                      {row.um}
                    </span>
                  </td>
                  <td className="py-4 px-3 text-right font-mono text-on-surface">{row.saldoIni}</td>
                  <td className="py-4 px-3 text-center">
                    {row.entrada > 0 ? (
                      <div className="inline-flex items-center justify-center min-w-[48px] h-7 px-2 rounded-lg bg-surface neo-inset text-primary font-semibold font-mono text-xs">
                        +{row.entrada}
                      </div>
                    ) : (
                      <span className="text-on-surface-variant text-xs font-mono">-</span>
                    )}
                  </td>
                  <td className="py-4 px-3 text-center">
                    <input
                      type="number"
                      min="0"
                      value={row.vendido}
                      onChange={(e) => updateIpvVendido(row.id, parseInt(e.target.value) || 0)}
                      className={`w-14 h-7 text-center rounded-lg bg-surface neo-inset font-semibold font-mono text-xs focus:outline-none ${
                        row.status === 'zero'
                          ? 'text-error font-bold'
                          : row.status === 'low'
                          ? 'text-amber-700'
                          : 'text-on-surface focus:text-primary'
                      }`}
                    />
                  </td>
                  <td className="py-4 px-4 text-center">
                    {row.status === 'zero' ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-surface neo-raised text-error">
                        <span className="w-1.5 h-1.5 rounded-full bg-error"></span>
                        0 Agotado
                      </span>
                    ) : row.status === 'low' ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-surface neo-raised text-amber-700">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                        {row.saldoFinal} disp.
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-surface neo-raised text-emerald-700">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                        {row.saldoFinal} disp.
                      </span>
                    )}
                  </td>
                  <td className="py-4 px-3 text-right font-mono text-on-surface-variant">
                    {formatCUP(row.price)}
                  </td>
                  <td className="py-4 px-4 text-right font-mono font-bold text-on-surface">
                    {formatCUP(row.importe)}
                  </td>
                  <td className="py-4 px-3 text-center">
                    <button
                      onClick={() => openSaleModal(row)}
                      className="px-2.5 py-1.5 rounded-lg bg-surface neo-raised text-primary text-xs font-bold hover:bg-primary hover:text-white active:neo-inset transition-all flex items-center justify-center gap-1 mx-auto shadow-sm cursor-pointer"
                      title={`Vender ${row.name} (Cobro rápido en Efectivo o Transferencia)`}
                      type="button"
                    >
                      <span className="material-symbols-outlined text-[15px]">point_of_sale</span>
                      <span>Vender</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Quick Pagination / Row Count */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 mt-2 px-2 text-xs text-on-surface-variant">
          <div className="flex items-center gap-2">
            <span>
              Mostrando <strong className="text-on-surface">{startIdx} a {endIdx}</strong> de{' '}
              <strong className="text-on-surface">{filteredRows.length}</strong> renglones
            </span>
            {(selectedCategory !== 'all' || activeFilter !== 'all') && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-surface-container-high text-on-surface font-semibold">
                Filtro aplicado
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={validPage === 1}
              className={`w-8 h-8 rounded-lg bg-surface neo-raised flex items-center justify-center transition-all ${
                validPage === 1
                  ? 'opacity-40 cursor-not-allowed text-on-surface-variant'
                  : 'hover:text-primary active:neo-inset cursor-pointer text-on-surface'
              }`}
              type="button"
              title="Página anterior"
            >
              <span className="material-symbols-outlined text-sm">chevron_left</span>
            </button>

            {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
              <button
                key={pageNum}
                onClick={() => setCurrentPage(pageNum)}
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
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={validPage === totalPages}
              className={`w-8 h-8 rounded-lg bg-surface neo-raised flex items-center justify-center transition-all ${
                validPage === totalPages
                  ? 'opacity-40 cursor-not-allowed text-on-surface-variant'
                  : 'hover:text-primary active:neo-inset cursor-pointer text-on-surface'
              }`}
              type="button"
              title="Página siguiente"
            >
              <span className="material-symbols-outlined text-sm">chevron_right</span>
            </button>
          </div>
        </div>
      </div>

      {/* Mini Insights Bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-surface neo-raised flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-surface neo-inset flex items-center justify-center text-primary">
            <span className="material-symbols-outlined text-[20px]">insights</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant">
              Mayor Aporte Financiero
            </span>
            <span className="text-xs font-bold text-on-surface">Niple 1/2&quot; galv. (53.1% del total)</span>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-surface neo-raised flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-surface neo-inset flex items-center justify-center text-tertiary">
            <span className="material-symbols-outlined text-[20px]">sync_alt</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant">
              Entradas del Día
            </span>
            <span className="text-xs font-bold text-on-surface">80 unidades ingresadas</span>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-surface neo-raised flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-surface neo-inset flex items-center justify-center text-emerald-600">
            <span className="material-symbols-outlined text-[20px]">price_check</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant">
              Precio Promedio por Unidad
            </span>
            <span className="text-xs font-bold text-on-surface">368.56 CUP / u.</span>
          </div>
        </div>
      </div>

      {/* Sticky Summary Bar */}
      <div className="sticky bottom-4 z-30 w-full">
        <div className="p-4 rounded-2xl bg-surface/95 backdrop-blur-md neo-raised shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-surface neo-inset flex items-center justify-center text-primary">
                <span className="material-symbols-outlined text-[22px]">calculate</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant">
                  Total Unidades Vendidas
                </span>
                <span className="text-base font-bold text-on-surface">
                  {ipvTotalUnidades}{' '}
                  <span className="text-xs font-normal text-on-surface-variant">unidades</span>
                </span>
              </div>
            </div>

            <div className="hidden sm:block h-8 w-px bg-outline-variant/60"></div>

            <div className="flex items-center gap-3">
              <div className="flex flex-col">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant">
                  Estado de Carga
                </span>
                <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  <span>Todos los renglones cuadrados</span>
                </div>
              </div>
            </div>
          </div>

          {/* Grand Total */}
          <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
            <div className="flex items-center gap-3 px-4 py-2 rounded-xl bg-surface neo-inset">
              <span className="text-xs font-medium text-on-surface-variant">Gran Total del Día:</span>
              <span className="text-lg font-bold tracking-tight text-primary font-mono">
                {formatCUP(ipvTotalVendido)}
              </span>
              <span className="text-xs font-bold text-primary">CUP</span>
            </div>
            <button
              onClick={handleFinalize}
              className="px-5 py-2.5 rounded-xl bg-primary text-white text-xs font-semibold hover:bg-tertiary transition-all shadow-md flex items-center gap-2 shrink-0 cursor-pointer"
              type="button"
            >
              <span>Finalizar IPV</span>
              <span className="material-symbols-outlined text-[16px]">done_all</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
