import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { SearchableSelect } from '../components/SearchableSelect';

export const IPVView: React.FC = () => {
  const {
    ipvRows,
    ipvTotalVendido,
    ipvTotalUnidades,
    totalVentasEfectivo,
    totalVentasTransferencia,
    openSaleModal,
    setCurrentView,
    todayDate,
    selectedIpvDate,
    setSelectedIpvDate,
    isCurrentDayClosed,
    isViewDateClosed,
    isViewingPastDate,
    refreshIpvDay,
    returns = [],
  } = useApp();

  const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'zero' | 'low'>('all');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 8;

  // Devoluciones correspondientes a la fecha consultada en el IPV
  const returnsForDate = useMemo(() => {
    const targetDate = selectedIpvDate || todayDate;
    return returns.filter((r) => r.date === targetDate);
  }, [returns, selectedIpvDate, todayDate]);

  const returnsForDateTotal = useMemo(() => {
    return returnsForDate.reduce((acc, r) => acc + (r.totalRefund || 0), 0);
  }, [returnsForDate]);

  const returnedUnitsDate = useMemo(() => {
    return returnsForDate.reduce((acc, r) => {
      const q = (r.items || []).reduce((s, it) => s + (it.quantity || 1), 0);
      return acc + q;
    }, 0);
  }, [returnsForDate]);

  const damagedUnitsDate = useMemo(() => {
    return returnsForDate.reduce((acc, r) => {
      const q = (r.items || [])
        .filter((it) => it.condition === 'mal_estado')
        .reduce((s, it) => s + (it.quantity || 1), 0);
      return acc + q;
    }, 0);
  }, [returnsForDate]);

  const formatCUP = (val: number) => {
    return Number(val).toLocaleString('es-CU', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  // Determinar si alguna fila tiene ajuste diferente de 0
  const hasAnyAjuste = useMemo(() => {
    return ipvRows.some((row) => row.ajuste !== undefined && row.ajuste !== 0);
  }, [ipvRows]);

  const categories = useMemo(() => {
    return ['all', ...Array.from(new Set(ipvRows.map((r) => r.category).filter(Boolean)))];
  }, [ipvRows]);

  const filteredRows = ipvRows.filter((row) => {
    if (activeFilter === 'zero' && row.status !== 'zero') return false;
    if (activeFilter === 'low' && row.status !== 'low') return false;
    if (activeFilter === 'active' && row.vendido === 0) return false;
    if (selectedCategory !== 'all' && row.category !== selectedCategory) return false;
    return true;
  });

  useEffect(() => {
    setCurrentPage(1);
  }, [activeFilter, selectedCategory, selectedIpvDate]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const validPage = Math.min(currentPage, totalPages);
  const paginatedRows = filteredRows.slice((validPage - 1) * pageSize, validPage * pageSize);
  const startIdx = filteredRows.length === 0 ? 0 : (validPage - 1) * pageSize + 1;
  const endIdx = Math.min(validPage * pageSize, filteredRows.length);

  const zeroCount = ipvRows.filter((r) => r.status === 'zero').length;
  const lowCount = ipvRows.filter((r) => r.status === 'low').length;
  const activeCount = ipvRows.filter((r) => r.vendido > 0).length;

  const isClosedForSales = isCurrentDayClosed || isViewDateClosed || isViewingPastDate;

  return (
    <div className="flex flex-col w-full gap-6 pb-24 select-none">
      {/* Aviso si el día está cerrado o se consulta un día pasado */}
      {isClosedForSales && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between gap-4 text-amber-900">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-amber-600 text-2xl">lock</span>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider">
                {isViewingPastDate ? `Consultando histórico (${selectedIpvDate})` : 'Jornada Cerrada'}
              </p>
              <p className="text-xs text-amber-800">
                {isViewingPastDate
                  ? 'Modo de solo lectura. Para registrar ventas o movimientos regresa a la fecha de hoy.'
                  : 'Este día fue cerrado en el arqueo de caja. El registro y la anulación de ventas están bloqueados.'}
              </p>
            </div>
          </div>
          {isViewingPastDate ? (
            <button
              onClick={() => setSelectedIpvDate(todayDate)}
              className="px-3.5 py-1.5 rounded-xl bg-surface neo-raised text-xs font-bold text-primary hover:bg-primary hover:text-white transition-all cursor-pointer"
            >
              Volver a Hoy ({todayDate})
            </button>
          ) : (
            <button
              onClick={() => setCurrentView('cierre-de-caja')}
              className="px-3.5 py-1.5 rounded-xl bg-surface neo-raised text-xs font-bold text-amber-800 hover:bg-amber-600 hover:text-white transition-all cursor-pointer"
            >
              Ir a Cierre de Caja
            </button>
          )}
        </div>
      )}

      {/* Content Header Area */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl lg:text-3xl font-headline font-bold text-on-surface tracking-tight">IPV del Dia</h1>
            {isViewDateClosed && (
              <span className="px-2.5 py-0.5 rounded-full bg-red-100 text-red-700 text-[10px] font-bold uppercase tracking-wider">
                Cerrado
              </span>
            )}
          </div>
          <p className="text-xs lg:text-sm text-on-surface-variant">
            Control de movimiento de inventario calculado a partir de movimientos de stock (solo lectura)
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => openSaleModal()}
            disabled={isClosedForSales}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold shadow-md transition-all flex items-center gap-2 ${
              isClosedForSales
                ? 'bg-outline-variant/40 text-on-surface-variant cursor-not-allowed opacity-60'
                : 'bg-primary text-white shadow-primary/25 hover:bg-primary-container cursor-pointer'
            }`}
            type="button"
            title={isClosedForSales ? 'Ventas bloqueadas (día cerrado o consulta histórica)' : 'Registrar Venta'}
          >
            <span className="material-symbols-outlined text-[18px]">point_of_sale</span>
            <span>⚡ Registrar Venta</span>
          </button>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
        {/* KPI 1: Total Vendido */}
        <div className="p-5 rounded-2xl bg-surface neo-raised flex flex-col justify-between relative overflow-hidden group">
          <div className="flex items-start justify-between">
            <div className="w-10 h-10 rounded-xl bg-surface neo-inset flex items-center justify-center text-primary">
              <span className="material-symbols-outlined text-xl">payments</span>
            </div>
            <div className="flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-surface-container text-primary">
              <span className="material-symbols-outlined text-[14px]">calendar_today</span>
              <span>{selectedIpvDate}</span>
            </div>
          </div>
          <div className="mt-4">
            <span className="text-[11px] font-semibold tracking-wider uppercase text-on-surface-variant">
              Total Vendido
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
              <span>{activeCount} con venta</span>
            </div>
          </div>
          <div className="mt-4">
            <span className="text-[11px] font-semibold tracking-wider uppercase text-on-surface-variant">
              Unidades Vendidas
            </span>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-2xl font-bold tracking-tight text-on-surface font-mono">
                {ipvTotalUnidades}
              </span>
              <span className="text-xs font-medium text-on-surface-variant">unidades</span>
            </div>
            <p className="text-[11px] text-on-surface-variant mt-1">Total de piezas despachadas</p>
          </div>
        </div>

        {/* KPI 3: Devoluciones (reordenado a tercera posición) */}
        <div className="p-5 rounded-2xl bg-surface neo-raised flex flex-col justify-between relative group">
          <div className="flex items-start justify-between">
            <div className="w-10 h-10 rounded-xl bg-surface neo-inset flex items-center justify-center text-amber-600">
              <span className="material-symbols-outlined text-xl">assignment_return</span>
            </div>
            <div className="flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-700">
              <span>{returnsForDate.length} {returnsForDate.length === 1 ? 'dev.' : 'devs.'}</span>
            </div>
          </div>
          <div className="mt-4">
            <span className="text-[11px] font-semibold tracking-wider uppercase text-on-surface-variant">
              Devoluciones
            </span>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-2xl font-bold tracking-tight text-amber-600 font-mono">
                ${formatCUP(returnsForDateTotal)}
              </span>
              <span className="text-xs font-bold text-amber-600">CUP</span>
            </div>
            <div className="mt-2.5 pt-2 border-t border-outline-variant/15 flex items-center justify-between text-[11px]">
              <span className="text-on-surface-variant font-medium">
                {returnedUnitsDate} u. dev.{damagedUnitsDate > 0 ? ` • ${damagedUnitsDate} merma` : ''}
              </span>
              <button
                onClick={() => setCurrentView('devoluciones')}
                className="text-amber-700 hover:underline font-semibold flex items-center gap-0.5 cursor-pointer"
                type="button"
              >
                <span>Ver</span>
                <span className="material-symbols-outlined text-[13px]">arrow_forward</span>
              </button>
            </div>
          </div>
        </div>

        {/* KPI 4: Productos en Cero */}
        <div className="p-5 rounded-2xl bg-surface neo-raised flex flex-col justify-between relative group">
          <div className="flex items-start justify-between">
            <div className="w-10 h-10 rounded-xl bg-surface neo-inset flex items-center justify-center text-error">
              <span className="material-symbols-outlined text-xl">remove_shopping_cart</span>
            </div>
            <div className="flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-error-container text-on-error-container">
              <span>Agotados</span>
            </div>
          </div>
          <div className="mt-4">
            <span className="text-[11px] font-semibold tracking-wider uppercase text-on-surface-variant">
              Saldo Final en Cero
            </span>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-2xl font-bold tracking-tight text-error font-mono">{zeroCount}</span>
              <span className="text-xs font-medium text-on-surface-variant">artículos</span>
            </div>
            <p className="text-[11px] text-on-surface-variant mt-1">Requieren reposición</p>
          </div>
        </div>

        {/* KPI 5: Stock Bajo */}
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
            <p className="text-[11px] text-on-surface-variant mt-1">Existencia por debajo del mínimo</p>
          </div>
        </div>
      </div>

      {/* Filters & Controls Bar with Date Selector */}
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
            Todos <span className="ml-1 text-[10px] opacity-75 font-normal">{ipvRows.length}</span>
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
            Con venta{' '}
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
          {/* Selector de Categoría */}
          <SearchableSelect
            value={selectedCategory}
            onChange={setSelectedCategory}
            ariaLabel="Filtrar por categoría"
            placeholder="Buscar categoría..."
            options={categories.map((category) => ({
              value: category,
              label: category === 'all' ? 'Todas las categorías' : category,
            }))}
            containerClassName="w-full sm:w-56"
            className="h-10 pl-3.5 rounded-xl bg-surface neo-inset text-xs font-medium"
          />

          {/* Selector de Fecha para consultar días anteriores */}
          <div className="h-9 px-3 rounded-xl bg-surface neo-inset flex items-center gap-2 text-xs font-medium text-on-surface">
            <span className="material-symbols-outlined text-primary text-[16px]">calendar_today</span>
            <input
              type="date"
              value={selectedIpvDate}
              max={todayDate}
              onChange={(e) => {
                if (e.target.value) {
                  setSelectedIpvDate(e.target.value);
                }
              }}
              className="bg-transparent border-none text-xs font-mono font-semibold text-on-surface focus:outline-none cursor-pointer"
            />
            {selectedIpvDate === todayDate ? (
              <span className="text-[10px] text-emerald-600 font-bold uppercase px-1.5 py-0.5 rounded bg-emerald-500/10">
                Hoy
              </span>
            ) : (
              <span className="text-[10px] text-amber-700 font-bold uppercase px-1.5 py-0.5 rounded bg-amber-500/10">
                Histórico
              </span>
            )}
          </div>

          <button
            onClick={() => refreshIpvDay(selectedIpvDate)}
            className="w-9 h-9 rounded-xl bg-surface neo-raised flex items-center justify-center text-on-surface-variant hover:text-primary transition-all active:neo-inset cursor-pointer"
            title="Recargar IPV"
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
                {hasAnyAjuste && <th className="py-3.5 px-3 text-center">Ajuste</th>}
                <th className="py-3.5 px-4 text-center">Saldo Final</th>
                <th className="py-3.5 px-3 text-right min-w-[110px]">Precio (CUP)</th>
                <th className="py-3.5 px-4 text-right min-w-[130px]">Importe (CUP)</th>
              </tr>
            </thead>
            <tbody className="text-xs font-medium divide-y-0">
              {paginatedRows.length === 0 ? (
                <tr>
                  <td colSpan={hasAnyAjuste ? 10 : 9} className="py-12 text-center text-on-surface-variant">
                    <span className="material-symbols-outlined text-4xl block mb-2 opacity-50">inventory_2</span>
                    No hay productos con movimientos para esta fecha o filtros seleccionados.
                  </td>
                </tr>
              ) : (
                paginatedRows.map((row) => (
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
                          <span className="text-[10px] text-on-surface-variant font-mono">{row.code}</span>
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

                    {/* Columna Vendido: Solo Lectura */}
                    <td className="py-4 px-3 text-center font-mono font-bold text-on-surface">
                      {row.vendido > 0 ? (
                        <span className="px-2 py-1 rounded-md bg-surface neo-inset text-primary">
                          {row.vendido}
                        </span>
                      ) : (
                        <span className="text-on-surface-variant text-xs font-mono">0</span>
                      )}
                    </td>

                    {/* Columna Ajuste: Se muestra solo cuando hasAnyAjuste es true */}
                    {hasAnyAjuste && (
                      <td className="py-4 px-3 text-center font-mono text-xs">
                        {row.ajuste !== undefined && row.ajuste !== 0 ? (
                          <span className={`px-2 py-0.5 rounded font-bold ${row.ajuste > 0 ? 'text-emerald-600 bg-emerald-50' : 'text-amber-700 bg-amber-50'}`}>
                            {row.ajuste > 0 ? `+${row.ajuste}` : row.ajuste}
                          </span>
                        ) : (
                          <span className="text-on-surface-variant opacity-40">-</span>
                        )}
                      </td>
                    )}

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
                  </tr>
                ))
              )}
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
              className="p-1.5 rounded-lg bg-surface neo-raised disabled:opacity-40 disabled:cursor-not-allowed hover:text-primary transition-all active:neo-inset cursor-pointer"
              type="button"
            >
              <span className="material-symbols-outlined text-[18px]">chevron_left</span>
            </button>
            <span className="px-2 font-mono text-on-surface">
              {validPage} / {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={validPage === totalPages}
              className="p-1.5 rounded-lg bg-surface neo-raised disabled:opacity-40 disabled:cursor-not-allowed hover:text-primary transition-all active:neo-inset cursor-pointer"
              type="button"
            >
              <span className="material-symbols-outlined text-[18px]">chevron_right</span>
            </button>
          </div>
        </div>
      </div>

      {/* Sticky Bottom Actions Bar */}
      <div className="p-4 rounded-2xl bg-surface neo-raised flex flex-col lg:flex-row items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-6 w-full lg:w-auto justify-between sm:justify-start">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-surface neo-inset flex items-center justify-center text-primary">
              <span className="material-symbols-outlined text-lg">receipt_long</span>
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
                Estado del Día
              </span>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600">
                <span className={`w-2 h-2 rounded-full ${isViewDateClosed ? 'bg-red-500' : 'bg-emerald-500'}`}></span>
                <span className={isViewDateClosed ? 'text-red-600' : 'text-emerald-600'}>
                  {isViewDateClosed ? 'Día cerrado' : 'Jornada activa'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Grand Total */}
        <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
          <div className="flex items-center gap-3 px-4 py-2 rounded-xl bg-surface neo-inset">
            <span className="text-xs font-medium text-on-surface-variant">Importe Total del Día:</span>
            <span className="text-lg font-bold tracking-tight text-primary font-mono">
              {formatCUP(ipvTotalVendido)}
            </span>
            <span className="text-xs font-bold text-primary">CUP</span>
          </div>
          <button
            onClick={() => setCurrentView('cierre-de-caja')}
            className="px-5 py-2.5 rounded-xl bg-primary text-white text-xs font-semibold hover:bg-tertiary transition-all shadow-md flex items-center gap-2 shrink-0 cursor-pointer"
            type="button"
          >
            <span>Ir a Cierre de Caja</span>
            <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
          </button>
        </div>
      </div>
    </div>
  );
};
