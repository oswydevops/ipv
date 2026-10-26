import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { SearchableSelect } from '../components/SearchableSelect';
import { PRODUCT_CATEGORIES } from '../data/productCategories';
import { Product } from '../types';

export const StockAlertsView: React.FC = () => {
  const { products, reponerProduct, refreshAll, showToast } = useApp();

  const [activeTab, setActiveTab] = useState<'todos' | 'agotados' | 'stock-bajo' | 'disponibles'>('todos');
  const [familyFilter, setFamilyFilter] = useState('all');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Modal state for quick restock
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalProductId, setModalProductId] = useState('');
  const [modalQty, setModalQty] = useState('0');
  const [modalCost, setModalCost] = useState(0);
  const [modalDest, setModalDest] = useState('Mostrador Principal / Repisa Inmediata');

  const zeroItems = products.filter((p) => p.stock === 0);
  const lowItems = products.filter((p) => p.stock > 0 && p.stock <= p.minStock);
  const availableItems = products.filter((p) => p.stock > p.minStock);

  const displayedList = products.filter((p) => {
    if (activeTab === 'agotados' && p.stock !== 0) return false;
    if (activeTab === 'stock-bajo' && (p.stock === 0 || p.stock > p.minStock)) return false;
    if (activeTab === 'disponibles' && p.stock <= p.minStock) return false;

    if (familyFilter !== 'all' && p.category.toLowerCase() !== familyFilter.toLowerCase()) {
      return false;
    }

    if (severityFilter === 'critico' && p.stock !== 0) return false;
    if (severityFilter === 'bajo' && (p.stock === 0 || p.stock > p.minStock)) return false;
    if (severityFilter === 'disponible' && p.stock <= p.minStock) return false;

    return true;
  });

  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, familyFilter, severityFilter]);

  const totalPages = Math.max(1, Math.ceil(displayedList.length / pageSize));
  const validPage = Math.min(currentPage, totalPages);
  const paginatedAlerts = displayedList.slice((validPage - 1) * pageSize, validPage * pageSize);
  const startIdx = displayedList.length === 0 ? 0 : (validPage - 1) * pageSize + 1;
  const endIdx = Math.min(validPage * pageSize, displayedList.length);

  const handleOpenRestock = (targetProduct?: Product) => {
    let prodId = '';
    if (targetProduct) {
      prodId = targetProduct.id;
    } else if (products.length > 0) {
      prodId = products[0].id;
    }

    setModalProductId(prodId);
    setModalQty('0');
    setIsModalOpen(true);
  };

  const handleConfirmRestock = async () => {
    if (!modalProductId) {
      showToast('Error', 'Seleccione un producto para reponer.', 'error');
      return;
    }
    const targetProd = products.find((p) => p.id === modalProductId);
    if (!targetProd) {
      showToast('Error', 'Producto no encontrado.', 'error');
      return;
    }
    const qty = Number(modalQty);
    if (!qty || qty <= 0) {
      showToast('Error', 'La cantidad a reponer debe ser mayor que cero.', 'error');
      return;
    }
    const dispAlmacen = targetProd.almacenStock || 0;
    if (dispAlmacen <= 0) {
      showToast('Almacén sin existencias', `"${targetProd.name}" no tiene existencias en almacén para reponer.`, 'error');
      return;
    }
    if (qty > dispAlmacen) {
      showToast('Cantidad excede almacén', `Solo hay ${dispAlmacen} unidades disponibles en almacén.`, 'error');
      return;
    }

    const success = await reponerProduct(modalProductId, qty);
    if (success) {
      setIsModalOpen(false);
    }
  };

  return (
    <div className="flex flex-col gap-8 w-full max-w-7xl mx-auto pb-12 select-none">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <h1 className="font-headline font-bold text-2xl lg:text-3xl tracking-tight text-on-surface">
            Alertas y Reposición de Inventario
          </h1>
          <p className="text-xs sm:text-sm text-on-surface-variant max-w-2xl leading-relaxed">
            Monitoreo preventivo de existencias críticas, déficit de mostrador y pedidos urgentes para
            continuidad de operaciones.
          </p>
        </div>

        {/* Live Sync Capsule */}
        <div className="flex items-center gap-3">
          <div className="h-10 px-4 rounded-xl bg-surface neo-raised flex items-center gap-3 text-xs font-medium text-on-surface select-none">
            <span className="flex h-2.5 w-2.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-error opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-error"></span>
            </span>
            <span className="text-on-surface-variant">
              Actualización<strong className="text-on-surface">(BD)</strong>
            </span>
            <button
              onClick={async () => {
                await refreshAll();
                showToast('Sincronización Concluida', 'Saldos actualizados con la base de datos SQLite.');
              }}
              className="w-7 h-7 rounded-lg bg-surface neo-raised hover:text-primary transition-all flex items-center justify-center text-on-surface-variant active:neo-inset cursor-pointer"
              title="Recargar inventario y umbrales"
              type="button"
            >
              <span className="material-symbols-outlined text-[17px]">refresh</span>
            </button>
          </div>
        </div>
      </div>

      {/* 3 Summary Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Card 1: Artículos Agotados */}
        <div
          onClick={() => setActiveTab('agotados')}
          className={`rounded-2xl bg-surface neo-raised p-6 flex flex-col justify-between relative overflow-hidden transition-all duration-300 hover:-translate-y-0.5 cursor-pointer ${
            activeTab === 'agotados' ? 'ring-2 ring-error/50' : ''
          }`}
        >
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold uppercase tracking-wider text-error">
              Artículos Agotados
            </span>
            <div className="w-10 h-10 rounded-xl bg-error-container text-on-error-container flex items-center justify-center">
              <span className="material-symbols-outlined text-[22px]">remove_shopping_cart</span>
            </div>
          </div>
          <div className="flex items-baseline gap-2.5">
            <span className="font-headline text-4xl font-bold tracking-tight text-error font-mono">
              {zeroItems.length}
            </span>
            <span className="text-xs font-semibold text-error">en cero (crítico)</span>
          </div>
          <p className="text-xs text-on-surface-variant mt-2 leading-relaxed">
            Existencias totalmente agotadas que requieren pedido de reposición urgente para el mostrador.
          </p>
          <div className="mt-4 pt-3 flex items-center justify-between text-xs border-t border-outline-variant/15">
            <span className="text-error font-semibold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-error animate-pulse"></span>
              Prioridad inmediata
            </span>
            <span className="text-on-surface-variant font-mono text-[11px] font-semibold">Déficit 100%</span>
          </div>
        </div>

        {/* Card 2: Stock Bajo */}
        <div
          onClick={() => setActiveTab('stock-bajo')}
          className={`rounded-2xl bg-surface neo-raised p-6 flex flex-col justify-between relative overflow-hidden transition-all duration-300 hover:-translate-y-0.5 cursor-pointer ${
            activeTab === 'stock-bajo' ? 'ring-2 ring-amber-500/50' : ''
          }`}
        >
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-700">
              Stock Bajo
            </span>
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center">
              <span className="material-symbols-outlined text-[22px]">warning_amber</span>
            </div>
          </div>
          <div className="flex items-baseline gap-2.5">
            <span className="font-headline text-4xl font-bold tracking-tight text-amber-700 font-mono">
              {lowItems.length}
            </span>
            <span className="text-xs font-semibold text-amber-700">bajo umbral mínimo</span>
          </div>
          <p className="text-xs text-on-surface-variant mt-2 leading-relaxed">
            Existencias con reserva para menos de 48 horas según el ritmo promedio de rotación diaria.
          </p>
          <div className="mt-4 pt-3 flex items-center justify-between text-xs border-t border-outline-variant/15">
            <span className="text-amber-700 font-semibold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-500"></span>
              En alerta operativa
            </span>
            <span className="text-on-surface-variant font-mono text-[11px] font-semibold">&lt; 48 hrs reserva</span>
          </div>
        </div>

        {/* Card 3: Stock Disponible */}
        <div
          onClick={() => setActiveTab('disponibles')}
          className={`rounded-2xl bg-surface neo-raised p-6 flex flex-col justify-between relative overflow-hidden transition-all duration-300 hover:-translate-y-0.5 cursor-pointer ${
            activeTab === 'disponibles' ? 'ring-2 ring-emerald-500/50' : ''
          }`}
        >
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">
              Stock Disponible
            </span>
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center">
              <span className="material-symbols-outlined text-[22px]">check_circle</span>
            </div>
          </div>
          <div className="flex items-baseline gap-2.5">
            <span className="font-headline text-4xl font-bold tracking-tight text-emerald-600 font-mono">
              {availableItems.length}
            </span>
            <span className="text-xs font-semibold text-emerald-700">referencias óptimas</span>
          </div>
          <p className="text-xs text-on-surface-variant mt-2 leading-relaxed">
            Productos con nivel de existencias suficiente para despacho continuo sin riesgo de quiebre.
          </p>
          <div className="mt-4 pt-3 flex items-center justify-between text-xs border-t border-outline-variant/15">
            <span className="text-emerald-700 font-semibold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              Nivel saludable
            </span>
            <span className="text-on-surface-variant font-mono text-[11px] font-semibold">
              {products.reduce((acc, p) => acc + p.stock, 0)} unidades tot.
            </span>
          </div>
        </div>
      </div>

      {/* Pill Switcher and Action Cluster */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div className="p-1.5 rounded-xl bg-surface neo-inset inline-flex items-center gap-1 select-none overflow-x-auto">
          <button
            onClick={() => setActiveTab('todos')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'todos'
                ? 'bg-surface text-primary neo-raised shadow-sm'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
            type="button"
          >
            <span>Todos</span>
            <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-surface-container-high text-on-surface font-mono font-bold">
              {products.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('agotados')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'agotados'
                ? 'bg-surface text-error neo-raised shadow-sm'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
            type="button"
          >
            <span className="w-2 h-2 rounded-full bg-error"></span>
            <span>Agotados</span>
            <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-error-container text-on-error-container font-mono font-bold">
              {zeroItems.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('stock-bajo')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'stock-bajo'
                ? 'bg-surface text-amber-700 neo-raised shadow-sm'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
            type="button"
          >
            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
            <span>Stock Bajo</span>
            <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-amber-100 text-amber-900 font-mono font-bold">
              {lowItems.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('disponibles')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'disponibles'
                ? 'bg-surface text-emerald-700 neo-raised shadow-sm'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
            type="button"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>Disponibles</span>
            <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-emerald-100 text-emerald-800 font-mono font-bold">
              {availableItems.length}
            </span>
          </button>
        </div>

        {/* Dropdowns & Reset button */}
        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5">
          {/* Category Dropdown */}
          <div className="relative flex-1 sm:flex-initial sm:w-56">
            <SearchableSelect
              value={familyFilter}
              onChange={setFamilyFilter}
              placeholder="Buscar categoría..."
              options={[
                { value: 'all', label: 'Todas las categorías' },
                ...PRODUCT_CATEGORIES.map((category) => ({ value: category, label: category })),
              ]}
              className="h-10 pl-3.5 rounded-xl bg-surface neo-inset text-xs font-semibold"
            />
          </div>

          {/* Severity Dropdown */}
          <div className="relative flex-1 sm:flex-initial sm:w-48">
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="app-select w-full h-10 pl-3.5 rounded-xl bg-surface neo-inset text-xs font-semibold text-on-surface focus:outline-none cursor-pointer"
            >
              <option value="all">Todas las alertas</option>
              <option value="critico">Solo Agotados (Cero)</option>
              <option value="bajo">Solo Stock Bajo</option>
              <option value="disponible">Solo Disponibles</option>
            </select>
          </div>

          {/* Reset Filters button */}
          {(familyFilter !== 'all' || severityFilter !== 'all') && (
            <button
              onClick={() => {
                setFamilyFilter('all');
                setSeverityFilter('all');
              }}
              className="h-10 px-3.5 rounded-xl bg-surface neo-raised flex items-center justify-center gap-1.5 text-xs font-semibold text-on-surface-variant hover:text-primary active:neo-inset transition-all cursor-pointer"
              title="Restablecer filtros"
              type="button"
            >
              <span className="material-symbols-outlined text-[18px]">filter_alt_off</span>
              <span className="hidden sm:inline">Limpiar</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Alert Table */}
      <div className="rounded-2xl bg-surface neo-raised overflow-hidden">
        <div className="px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface border-b border-outline-variant/15">
          <div className="flex items-center gap-2.5">
            <span className="text-xs font-bold text-on-surface">Catálogo de Existencias y Reposición</span>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono bg-surface neo-inset text-primary font-bold">
              {displayedList.length} productos
            </span>
          </div>
          <div className="flex items-center gap-4 text-xs text-on-surface-variant">
            <span className="flex items-center gap-1.5 font-medium">
              <span className="w-2 h-2 rounded-full bg-error"></span> Agotado (Cero)
            </span>
            <span className="flex items-center gap-1.5 font-medium">
              <span className="w-2 h-2 rounded-full bg-amber-500"></span> Stock Bajo
            </span>
            <span className="flex items-center gap-1.5 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Disponible
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="text-on-surface-variant font-semibold uppercase tracking-wider text-[11px] bg-surface-container-low/50">
                <th className="py-3.5 px-6">Estado / Prioridad</th>
                <th className="py-3.5 px-6">Código y Descripción</th>
                <th className="py-3.5 px-3 text-center">U/M</th>
                <th className="py-3.5 px-4 text-center">Mostrador</th>
                <th className="py-3.5 px-4 text-center">Almacén</th>
                <th className="py-3.5 px-4">Últ. Salida</th>
                <th className="py-3.5 px-6 text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y-0 text-on-surface">
              {paginatedAlerts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-on-surface-variant text-xs">
                    No hay productos que coincidan con los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                paginatedAlerts.map((item) => {
                  const isZero = item.stock === 0;
                  const isLow = item.stock > 0 && item.stock <= item.minStock;

                  return (
                    <tr key={item.id} className="hover:bg-surface-bright/60 transition-colors group">
                      <td className="py-4 px-6 align-middle">
                        {isZero ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-error-container text-on-error-container">
                            <span className="w-1.5 h-1.5 rounded-full bg-error animate-pulse"></span>
                            Agotado (Cero)
                          </span>
                        ) : isLow ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-900">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                            Stock Bajo
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-900">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                            Disponible
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-6 align-middle">
                        <div className="flex flex-col">
                          <span className="font-semibold text-on-surface text-[13px] group-hover:text-primary transition-colors">
                            {item.name}
                          </span>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="font-mono text-[11px] text-on-surface-variant font-semibold">
                              SKU: {item.code}
                            </span>
                            <span className="text-outline text-[10px]">•</span>
                            <span className="text-[11px] text-on-surface-variant">{item.detail}</span>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-3 align-middle text-center font-medium text-on-surface-variant">
                        {item.um}
                      </td>
                      <td className="py-4 px-4 align-middle text-center">
                        <span
                          className={`inline-flex px-2.5 py-1 rounded-lg font-mono font-bold text-xs ${
                            isZero ? 'bg-error-container text-on-error-container' : isLow ? 'bg-amber-100 text-amber-900' : 'bg-emerald-100 text-emerald-900'
                          }`}
                        >
                          {item.stock} {item.um}
                        </span>
                      </td>
                      <td className="py-4 px-4 align-middle text-center">
                        <span
                          className={`inline-flex px-2.5 py-1 rounded-lg font-mono font-bold text-xs ${
                            (item.almacenStock || 0) > 0
                              ? 'bg-blue-100 text-blue-900'
                              : 'bg-surface neo-inset text-on-surface-variant opacity-60'
                          }`}
                        >
                          {item.almacenStock || 0} {item.um}
                        </span>
                      </td>
                      <td className="py-4 px-4 align-middle font-mono text-[11px] text-on-surface-variant">
                        {item.lastExit || 'Ayer'}
                      </td>
                      <td className="py-4 px-6 align-middle text-right">
                        <button
                          onClick={() => handleOpenRestock(item)}
                          className="px-3.5 py-1.5 rounded-xl bg-surface neo-raised text-primary hover:text-white hover:bg-primary transition-all font-semibold text-xs inline-flex items-center gap-1.5 active:neo-inset cursor-pointer shadow-sm"
                          type="button"
                          title={`Reponer ${item.name} desde el almacén al mostrador`}
                        >
                          <span className="material-symbols-outlined text-[15px]">sync_alt</span>
                          <span>Reponer</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4 bg-surface border-t border-outline-variant/15">
          <div className="text-xs text-on-surface-variant">
            Mostrando <strong className="text-on-surface">{startIdx} a {endIdx}</strong> de{' '}
            <strong className="text-on-surface">{displayedList.length}</strong> productos • Página{' '}
            <strong className="text-on-surface">{validPage}</strong> de{' '}
            <strong className="text-on-surface">{totalPages}</strong>
          </div>
          <div className="flex items-center gap-2">
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
              <span className="material-symbols-outlined text-[16px]">chevron_left</span>
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
              <span className="material-symbols-outlined text-[16px]">chevron_right</span>
            </button>
          </div>
        </div>
      </div>

      {/* Restock Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-inverse-surface/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface rounded-2xl neo-raised w-full max-w-lg p-6 flex flex-col gap-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-surface neo-raised flex items-center justify-center text-primary">
                  <span className="material-symbols-outlined text-[22px]">sync_alt</span>
                </div>
                <div>
                  <h3 className="font-headline font-semibold text-base text-on-surface">
                    Reponer Mostrador desde Almacén
                  </h3>
                  <span className="text-xs text-on-surface-variant">
                    Descuenta existencias del almacén y las agrega al mostrador
                  </span>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 rounded-lg bg-surface neo-raised flex items-center justify-center text-on-surface-variant hover:text-on-surface active:neo-inset cursor-pointer"
                type="button"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            {/* Selected Product Info */}
            {(() => {
              const currentProd = products.find((p) => p.id === modalProductId);
              const dispAlmacen = currentProd ? (currentProd.almacenStock || 0) : 0;
              const enMostrador = currentProd ? currentProd.stock : 0;

              return (
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-on-surface">Producto a reponer</label>
                    <SearchableSelect
                      value={modalProductId}
                      onChange={(selectedId) => {
                        setModalProductId(selectedId);
                        setModalQty('0');
                      }}
                      placeholder={products.length === 0 ? 'No hay productos disponibles' : 'Buscar producto por código o nombre...'}
                      options={products.map((product) => ({
                        value: product.id,
                        label: `${product.code} - ${product.name}`,
                      }))}
                      disabled={products.length === 0}
                      className="h-11 pl-3.5 rounded-xl bg-surface neo-inset text-xs font-medium"
                    />
                  </div>

                  {/* Badges mostrador vs almacén */}
                  {currentProd && (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 rounded-xl bg-surface neo-inset flex flex-col gap-1">
                        <span className="text-[10px] uppercase font-bold text-on-surface-variant">En Mostrador</span>
                        <span className="text-base font-bold font-mono text-on-surface">
                          {enMostrador} {currentProd.um}
                        </span>
                      </div>
                      <div className="p-3 rounded-xl bg-surface neo-inset flex flex-col gap-1">
                        <span className="text-[10px] uppercase font-bold text-on-surface-variant">Disponible en Almacén</span>
                        <span className={`text-base font-bold font-mono ${dispAlmacen > 0 ? 'text-primary' : 'text-error'}`}>
                          {dispAlmacen} {currentProd.um}
                        </span>
                      </div>
                    </div>
                  )}

                  {dispAlmacen <= 0 && (
                    <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-800 text-xs flex items-center gap-2">
                      <span className="material-symbols-outlined text-[18px] text-amber-600">warning</span>
                      <span>No quedan unidades de este artículo en el almacén para reponer.</span>
                    </div>
                  )}

                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-on-surface">Cantidad a traspasar al mostrador</label>
                      {dispAlmacen > 0 && (
                        <button
                          type="button"
                          onClick={() => setModalQty(String(dispAlmacen))}
                          className="text-[11px] text-primary font-bold hover:underline cursor-pointer"
                        >
                          Todo el almacén ({dispAlmacen})
                        </button>
                      )}
                    </div>
                    <div className="h-11 px-3.5 rounded-xl bg-surface neo-inset flex items-center text-xs">
                      <input
                        type="number"
                        min="1"
                        max={dispAlmacen > 0 ? dispAlmacen : 1}
                        value={modalQty}
                        onChange={(e) => setModalQty(e.target.value.replace(/^0+(?=\d)/, ''))}
                        className="bg-transparent w-full focus:outline-none font-mono font-bold text-sm text-on-surface"
                      />
                    </div>
                    <span className="text-[10px] text-on-surface-variant">
                      Se sumará al mostrador y se descontará automáticamente del almacén.
                    </span>
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-2">
                    <button
                      onClick={() => setIsModalOpen(false)}
                      className="px-4 py-2.5 rounded-xl bg-surface neo-raised text-xs font-semibold text-on-surface-variant hover:text-on-surface active:neo-inset cursor-pointer"
                      type="button"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleConfirmRestock}
                      disabled={dispAlmacen <= 0}
                      className="px-5 py-2.5 rounded-xl bg-primary text-white text-xs font-bold hover:bg-primary/90 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
                      type="button"
                    >
                      <span className="material-symbols-outlined text-[17px]">check_circle</span>
                      <span>Confirmar Reposición</span>
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
};
