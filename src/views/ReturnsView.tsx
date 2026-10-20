import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { ReturnRecord, ReturnItem } from '../types';

export const ReturnsView: React.FC = () => {
  const {
    returns = [],
    sales = [],
    products = [],
    todayDate,
    addReturn,
    isCurrentDayClosed,
    setCurrentView,
  } = useApp();

  // Estados de vista
  const [activeTab, setActiveTab] = useState<'todas' | 'mal_estado' | 'buen_estado'>('todas');
  const [searchQuery, setSearchQuery] = useState('');
  const [periodFilter, setPeriodFilter] = useState<'hoy' | 'semana' | 'mes' | 'todos'>('hoy');
  const [page, setPage] = useState(1);
  const pageSize = 8;

  // Estados para Modal de Nueva Devolución
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [refundMethod, setRefundMethod] = useState<'efectivo' | 'transferencia' | 'mixto'>('efectivo');
  const [generalReason, setGeneralReason] = useState('Artículo defectuoso / Garantía');
  const [customReason, setCustomReason] = useState('');
  const [catalogSearch, setCatalogSearch] = useState('');
  const [selectedReturnDetail, setSelectedReturnDetail] = useState<ReturnRecord | null>(null);

  // Borrador de artículos a devolver en el modal
  interface ReturnDraftItem {
    productId: string;
    code: string;
    name: string;
    um: string;
    maxQty: number;
    quantity: number;
    unitPrice: number;
    condition: 'mal_estado' | 'buen_estado';
    damagedReason: string;
    reintegrateToStock: boolean;
    selected: boolean;
  }
  const [draftItems, setDraftItems] = useState<ReturnDraftItem[]>([]);

  // Formato CUP
  const formatCUP = (val: number) => {
    return Number(val || 0).toLocaleString('es-CU', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  // 1. Filtrado por período
  const periodFilteredReturns = useMemo(() => {
    const today = todayDate || new Date().toISOString().slice(0, 10);
    const now = new Date();

    return returns.filter((r) => {
      if (periodFilter === 'hoy') return r.date === today;
      if (periodFilter === 'semana') {
        const weekAgo = new Date(now);
        weekAgo.setDate(now.getDate() - 7);
        return r.date >= weekAgo.toISOString().slice(0, 10);
      }
      if (periodFilter === 'mes') {
        const monthAgo = new Date(now);
        monthAgo.setDate(now.getDate() - 31);
        return r.date >= monthAgo.toISOString().slice(0, 10);
      }
      return true;
    });
  }, [returns, todayDate, periodFilter]);

  // 2. Filtrado por pestaña (Todas / Solo Mal Estado / Solo Buen Estado) y búsqueda
  const finalFilteredReturns = useMemo(() => {
    return periodFilteredReturns.filter((r) => {
      // Filtro de condición
      if (activeTab === 'mal_estado') {
        const hasDamaged = r.hasDamagedItems || (r.items || []).some((it) => it.condition === 'mal_estado');
        if (!hasDamaged) return false;
      }
      if (activeTab === 'buen_estado') {
        const allGood = (r.items || []).every((it) => it.condition === 'buen_estado');
        if (!allGood) return false;
      }

      // Filtro de texto
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      const matchNum = r.returnNumber?.toLowerCase().includes(q);
      const matchTicket = r.ticketNumber?.toLowerCase().includes(q);
      const matchClient = r.customerName?.toLowerCase().includes(q);
      const matchReason = r.reason?.toLowerCase().includes(q);
      const matchProduct = (r.items || []).some(
        (it) => it.name.toLowerCase().includes(q) || it.code.toLowerCase().includes(q) || it.damagedReason?.toLowerCase().includes(q)
      );
      return matchNum || matchTicket || matchClient || matchReason || matchProduct;
    });
  }, [periodFilteredReturns, activeTab, searchQuery]);

  // Paginación
  const totalPages = Math.max(1, Math.ceil(finalFilteredReturns.length / pageSize));
  const validPage = Math.min(page, totalPages);
  const paginatedReturns = finalFilteredReturns.slice((validPage - 1) * pageSize, validPage * pageSize);

  // Estadísticas del día / globales
  const todayReturns = useMemo(() => returns.filter((r) => r.date === todayDate), [returns, todayDate]);
  const totalRefundToday = useMemo(
    () => todayReturns.reduce((acc, r) => acc + (r.totalRefund || 0), 0),
    [todayReturns]
  );
  const totalDamagedItemsToday = useMemo(() => {
    return todayReturns.reduce((acc, r) => {
      const damaged = (r.items || []).filter((it) => it.condition === 'mal_estado').reduce((s, it) => s + (it.quantity || 1), 0);
      return acc + damaged;
    }, 0);
  }, [todayReturns]);
  const totalGoodItemsToday = useMemo(() => {
    return todayReturns.reduce((acc, r) => {
      const good = (r.items || []).filter((it) => it.condition === 'buen_estado').reduce((s, it) => s + (it.quantity || 1), 0);
      return acc + good;
    }, 0);
  }, [todayReturns]);

  // Filtrado de productos para el selector de catálogo en el modal
  const filteredCatalogProducts = useMemo(() => {
    if (!catalogSearch.trim()) return products;
    const q = catalogSearch.toLowerCase();
    return products.filter((p) => p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q));
  }, [products, catalogSearch]);

  // Agregar producto seleccionado del catálogo al borrador
  const handleAddManualProduct = (prodId: string) => {
    const prod = products.find((p) => p.id === prodId);
    if (!prod) return;
    const existsIdx = draftItems.findIndex((d) => d.productId === prod.id);
    if (existsIdx >= 0) {
      const next = [...draftItems];
      next[existsIdx].quantity += 1;
      next[existsIdx].selected = true;
      setDraftItems(next);
      return;
    }

    setDraftItems([
      ...draftItems,
      {
        productId: prod.id,
        code: prod.code,
        name: prod.name,
        um: prod.um,
        maxQty: 9999,
        quantity: 1,
        unitPrice: prod.price,
        condition: 'mal_estado',
        damagedReason: 'Artículo en mal estado / averiado',
        reintegrateToStock: false,
        selected: true,
      },
    ]);
  };

  // Quitar artículo del borrador de devolución
  const handleRemoveDraftItem = (index: number) => {
    setDraftItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  // Total a reembolsar calculado en el modal
  const modalCalculatedRefund = useMemo(() => {
    return draftItems
      .filter((d) => d.selected && d.quantity > 0)
      .reduce((acc, d) => acc + d.quantity * d.unitPrice, 0);
  }, [draftItems]);

  // Guardar Devolución
  const handleSubmitReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    const selectedDrafts = draftItems.filter((d) => d.selected && d.quantity > 0);
    if (selectedDrafts.length === 0) {
      alert('Debe agregar al menos un artículo del catálogo para procesar la devolución.');
      return;
    }

    const returnItems: ReturnItem[] = selectedDrafts.map((d) => ({
      productId: d.productId,
      code: d.code,
      name: d.name,
      um: d.um,
      quantity: Number(d.quantity),
      unitPrice: Number(d.unitPrice),
      refundAmount: Number(d.quantity) * Number(d.unitPrice),
      condition: d.condition,
      damagedReason: d.condition === 'mal_estado' ? (d.damagedReason || 'Mal estado / averiado') : undefined,
      reintegrateToStock: d.condition === 'buen_estado' ? d.reintegrateToStock : false,
    }));

    const finalReason = generalReason === 'Otro motivo' && customReason.trim()
      ? customReason.trim()
      : generalReason;

    const returnPayload = {
      customerName: customerName.trim() || undefined,
      refundMethod,
      reason: finalReason.trim() || 'Devolución de cliente',
      totalRefund: modalCalculatedRefund,
      items: returnItems,
    };

    const success = await addReturn(returnPayload);
    if (success) {
      setIsModalOpen(false);
      setCustomerName('');
      setDraftItems([]);
      setGeneralReason('Artículo defectuoso / Garantía');
      setCustomReason('');
      setCatalogSearch('');
    }
  };

  // Imprimir comprobante de devolución
  const handlePrintReturn = (record: ReturnRecord) => {
    const printWindow = window.open('', '_blank', 'width=600,height=700');
    if (!printWindow) return;

    const itemsHtml = (record.items || [])
      .map(
        (it) => `
        <tr>
          <td style="padding: 6px 0; border-bottom: 1px dashed #ccc;">
            <strong>${it.name}</strong><br/>
            <small style="color: #666;">Cód: ${it.code} | Cant: ${it.quantity} ${it.um} x $${it.unitPrice.toFixed(2)}</small><br/>
            ${
              it.condition === 'mal_estado'
                ? `<span style="color: #d32f2f; font-weight: bold; font-size: 11px;">⚠️ MAL ESTADO: ${it.damagedReason || 'Averiado / defecto'}</span>`
                : `<span style="color: #2e7d32; font-weight: bold; font-size: 11px;">✓ BUEN ESTADO: Reintegrado</span>`
            }
          </td>
          <td style="padding: 6px 0; text-align: right; border-bottom: 1px dashed #ccc; font-weight: bold;">
            $${it.refundAmount.toFixed(2)} CUP
          </td>
        </tr>
      `
      )
      .join('');

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Comprobante Devolución ${record.returnNumber}</title>
          <style>
            body { font-family: monospace; font-size: 12px; margin: 20px; color: #111; line-height: 1.4; }
            .header { text-align: center; border-bottom: 2px dashed #000; padding-bottom: 10px; margin-bottom: 12px; }
            .title { font-size: 16px; font-weight: bold; }
            .meta { margin-bottom: 12px; font-size: 11px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
            .total { text-align: right; font-size: 14px; font-weight: bold; border-top: 2px dashed #000; padding-top: 8px; }
            .notice { font-size: 10px; color: #555; margin-top: 15px; text-align: center; border-top: 1px solid #ccc; padding-top: 8px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="title">COMPROBANTE DE DEVOLUCIÓN</div>
            <div><strong>${record.returnNumber}</strong></div>
            <div>FERRESTOCK - CONTROL DE CAJA</div>
          </div>
          <div class="meta">
            <div><strong>Fecha/Hora:</strong> ${record.date} ${record.timestamp || ''}</div>
            ${record.ticketNumber ? `<div><strong>Ticket Original:</strong> ${record.ticketNumber}</div>` : ''}
            ${record.customerName ? `<div><strong>Cliente:</strong> ${record.customerName}</div>` : ''}
            <div><strong>Motivo:</strong> ${record.reason}</div>
            <div><strong>Método Reintegro:</strong> ${record.refundMethod.toUpperCase()}</div>
          </div>
          <table>
            <thead>
              <tr style="border-bottom: 1px solid #000; text-align: left;">
                <th>Artículo / Condición</th>
                <th style="text-align: right;">Importe</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>
          <div class="total">
            TOTAL DEVUELTO AL CLIENTE: $${record.totalRefund.toFixed(2)} CUP
          </div>
          <div class="notice">
            Este importe ha sido registrado en las devoluciones del Cierre de Caja del día.<br/>
            Firma Responsable: _______________________
          </div>
          <script>
            window.onload = function() { window.print(); };
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  return (
    <div className="flex flex-col gap-6 animate-fade-in pb-16">
      {/* Encabezado Principal */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-surface neo-inset flex items-center justify-center text-amber-600">
              <span className="material-symbols-outlined text-[24px]">assignment_return</span>
            </div>
            <div>
              <h1 className="text-2xl font-headline font-bold text-on-surface">
                Control de Devoluciones y Garantías
              </h1>
              <p className="text-xs text-on-surface-variant font-medium mt-0.5">
                Registro de reembolsos al cliente, auditoría de artículos devueltos en mal estado y reflejo contable en el Cierre de Caja.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setCurrentView('cierre-de-caja')}
            className="px-4 py-2.5 rounded-xl bg-surface neo-raised text-on-surface-variant hover:text-on-surface text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer"
            type="button"
          >
            <span className="material-symbols-outlined text-[18px] text-amber-600">lock_clock</span>
            <span>Ver en Cierre de Caja</span>
          </button>

          <button
            onClick={() => {
              setDraftItems([]);
              setCustomerName('');
              setGeneralReason('Artículo defectuoso / Garantía');
              setCustomReason('');
              setRefundMethod('efectivo');
              setCatalogSearch('');
              setIsModalOpen(true);
            }}
            disabled={isCurrentDayClosed}
            className={`px-4 py-2.5 rounded-xl font-headline font-bold text-xs flex items-center gap-2 shadow-sm transition-all cursor-pointer ${
              isCurrentDayClosed
                ? 'opacity-50 cursor-not-allowed bg-neutral-300 text-neutral-600'
                : 'bg-primary text-white hover:bg-primary-hover active:scale-[0.99]'
            }`}
            type="button"
          >
            <span className="material-symbols-outlined text-[18px]">add_circle</span>
            <span>+ Registrar Devolución</span>
          </button>
        </div>
      </div>

      {/* 4 Tarjetas Bento de Resumen */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* 1. Total Reembolsado Hoy */}
        <div className="p-5 rounded-2xl bg-surface neo-raised flex flex-col justify-between border-l-4 border-amber-500">
          <div className="flex items-start justify-between">
            <div className="flex flex-col gap-1">
              <span className="text-[11px] font-bold tracking-wider uppercase text-on-surface-variant">
                Devuelto Hoy al Cliente
              </span>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className="text-2xl font-headline font-bold text-amber-600 tracking-tight font-mono">
                  ${formatCUP(totalRefundToday)}
                </span>
                <span className="text-xs font-semibold text-amber-600 font-mono">CUP</span>
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-600">
              <span className="material-symbols-outlined text-[22px]">payments</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 mt-3 pt-2.5 border-t border-outline-variant/15 text-[11px] text-on-surface-variant font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>Reflejado en Devoluciones de Cierre de Caja</span>
          </div>
        </div>

        {/* 2. Total Operaciones */}
        <div className="p-5 rounded-2xl bg-surface neo-raised flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div className="flex flex-col gap-1">
              <span className="text-[11px] font-bold tracking-wider uppercase text-on-surface-variant">
                Devoluciones Hoy
              </span>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className="text-2xl font-headline font-bold text-on-surface tracking-tight font-mono">
                  {todayReturns.length}
                </span>
                <span className="text-xs font-semibold text-on-surface-variant">operaciones</span>
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-surface neo-inset flex items-center justify-center text-primary">
              <span className="material-symbols-outlined text-[22px]">receipt_long</span>
            </div>
          </div>
          <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-outline-variant/15 text-[11px] text-on-surface-variant">
            <span>Histórico total:</span>
            <strong className="text-on-surface font-mono">{returns.length} registros</strong>
          </div>
        </div>

        {/* 3. Artículos en Mal Estado */}
        <div className="p-5 rounded-2xl bg-surface neo-raised flex flex-col justify-between border-l-4 border-red-500">
          <div className="flex items-start justify-between">
            <div className="flex flex-col gap-1">
              <span className="text-[11px] font-bold tracking-wider uppercase text-red-600 flex items-center gap-1">
                <span className="material-symbols-outlined text-[15px]">warning</span>
                En Mal Estado (Hoy)
              </span>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className="text-2xl font-headline font-bold text-red-600 tracking-tight font-mono">
                  {totalDamagedItemsToday}
                </span>
                <span className="text-xs font-semibold text-red-600 font-mono">artículos</span>
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center text-red-600">
              <span className="material-symbols-outlined text-[22px]">broken_image</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 mt-3 pt-2.5 border-t border-red-200/40 text-[11px] text-red-700 font-medium">
            <span>Catalogados como MERMA (No van a mostrador)</span>
          </div>
        </div>

        {/* 4. Artículos en Buen Estado */}
        <div className="p-5 rounded-2xl bg-surface neo-raised flex flex-col justify-between border-l-4 border-emerald-500">
          <div className="flex items-start justify-between">
            <div className="flex flex-col gap-1">
              <span className="text-[11px] font-bold tracking-wider uppercase text-emerald-600 flex items-center gap-1">
                <span className="material-symbols-outlined text-[15px]">check_circle</span>
                En Buen Estado (Hoy)
              </span>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className="text-2xl font-headline font-bold text-emerald-600 tracking-tight font-mono">
                  {totalGoodItemsToday}
                </span>
                <span className="text-xs font-semibold text-emerald-600 font-mono">artículos</span>
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-600">
              <span className="material-symbols-outlined text-[22px]">inventory</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 mt-3 pt-2.5 border-t border-emerald-200/40 text-[11px] text-emerald-700 font-medium">
            <span>Reincorporados al stock del mostrador</span>
          </div>
        </div>
      </div>

      {/* Barra de Filtros, Pestañas y Búsqueda */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 p-4 rounded-2xl bg-surface neo-raised">
        {/* Pestañas de Condición */}
        <div className="flex items-center p-1 bg-surface neo-inset rounded-xl">
          <button
            onClick={() => {
              setActiveTab('todas');
              setPage(1);
            }}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'todas'
                ? 'bg-surface neo-raised text-primary shadow-sm'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
            type="button"
          >
            Todas las Devoluciones ({periodFilteredReturns.length})
          </button>

          <button
            onClick={() => {
              setActiveTab('mal_estado');
              setPage(1);
            }}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'mal_estado'
                ? 'bg-red-500/15 text-red-700 font-bold border border-red-500/20'
                : 'text-red-600 hover:bg-red-500/10'
            }`}
            type="button"
          >
            <span className="material-symbols-outlined text-[16px]">warning</span>
            <span>Artículos en Mal Estado</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('buen_estado');
              setPage(1);
            }}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'buen_estado'
                ? 'bg-emerald-500/15 text-emerald-700 font-bold border border-emerald-500/20'
                : 'text-emerald-600 hover:bg-emerald-500/10'
            }`}
            type="button"
          >
            <span className="material-symbols-outlined text-[16px]">verified</span>
            <span>En Buen Estado</span>
          </button>
        </div>

        {/* Buscador y Filtro Temporal */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Período */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-on-surface-variant">Período:</span>
            <select
              value={periodFilter}
              onChange={(e) => {
                setPeriodFilter(e.target.value as any);
                setPage(1);
              }}
              className="h-10 px-3 rounded-xl bg-surface neo-inset text-xs font-semibold text-on-surface outline-none focus:ring-1 focus:ring-primary cursor-pointer"
            >
              <option value="hoy">Hoy ({todayDate})</option>
              <option value="semana">Últimos 7 días</option>
              <option value="mes">Últimos 30 días</option>
              <option value="todos">Todos los registros</option>
            </select>
          </div>

          {/* Búsqueda */}
          <div className="relative min-w-[240px] flex-1 sm:flex-none">
            <span className="material-symbols-outlined absolute left-3 top-2.5 text-[18px] text-on-surface-variant">
              search
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              placeholder="Buscar por artículo, ticket o cliente..."
              className="w-full h-10 pl-9 pr-3 rounded-xl bg-surface neo-inset text-xs font-medium text-on-surface outline-none focus:ring-1 focus:ring-primary"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2.5 text-on-surface-variant hover:text-on-surface text-xs"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tabla Principal de Devoluciones y Artículos Devueltos */}
      <div className="rounded-2xl bg-surface neo-raised p-2 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead>
              <tr className="text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant bg-surface-container-low/40">
                <th className="py-3 px-4">N° Devolución</th>
                <th className="py-3 px-4">Fecha &amp; Hora</th>
                <th className="py-3 px-4">Ticket Venta</th>
                <th className="py-3 px-4">Artículos Devueltos</th>
                <th className="py-3 px-4 text-center">Estado del Artículo</th>
                <th className="py-3 px-4 text-right">Reembolsado (CUP)</th>
                <th className="py-3 px-4 text-center">Reintegro</th>
                <th className="py-3 px-4 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y-0 text-on-surface">
              {paginatedReturns.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-14 text-center text-xs text-on-surface-variant font-medium">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <span className="material-symbols-outlined text-[36px] text-on-surface-variant/60">
                        assignment_return
                      </span>
                      <span className="text-sm font-semibold text-on-surface">
                        No hay devoluciones registradas en este período
                      </span>
                      <p className="text-xs text-on-surface-variant/80 max-w-md">
                        {activeTab === 'mal_estado'
                          ? 'No se han registrado artículos devueltos en mal estado o averiados.'
                          : 'Utilice el botón «+ Registrar Devolución» para ingresar devoluciones de clientes.'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedReturns.map((ret) => {
                  const hasDamaged = ret.hasDamagedItems || (ret.items || []).some((it) => it.condition === 'mal_estado');
                  const totalUnits = (ret.items || []).reduce((acc, it) => acc + (it.quantity || 0), 0);

                  return (
                    <tr
                      key={ret.id}
                      className={`group hover:bg-surface-container-high/40 transition-colors ${
                        hasDamaged ? 'bg-red-500/[0.02]' : ''
                      }`}
                    >
                      {/* N° Devolución */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-xs px-2.5 py-1 rounded-lg bg-surface neo-inset text-amber-600">
                            {ret.returnNumber}
                          </span>
                        </div>
                      </td>

                      {/* Fecha & Hora */}
                      <td className="py-3.5 px-4 font-mono text-xs">
                        <div className="flex flex-col">
                          <span className="font-semibold text-on-surface">{ret.date}</span>
                          <span className="text-[11px] text-on-surface-variant">{ret.timestamp || '--:--'}</span>
                        </div>
                      </td>

                      {/* Ticket Origen */}
                      <td className="py-3.5 px-4">
                        {ret.ticketNumber ? (
                          <span className="font-mono font-bold text-xs px-2 py-0.5 rounded bg-surface neo-inset text-primary">
                            {ret.ticketNumber}
                          </span>
                        ) : (
                          <span className="text-xs text-on-surface-variant italic">Directa / Sin ticket</span>
                        )}
                      </td>

                      {/* Artículos Devueltos */}
                      <td className="py-3.5 px-4">
                        <div className="flex flex-col max-w-sm">
                          {(ret.items || []).map((it, idx) => (
                            <div key={idx} className="flex items-center gap-1.5 text-xs py-0.5">
                              <span className="font-mono font-bold text-primary">
                                {it.quantity} {it.um}
                              </span>
                              <span className="font-semibold text-on-surface truncate">
                                {it.name}
                              </span>
                              <span className="text-[10px] text-on-surface-variant font-mono">
                                ({it.code})
                              </span>
                            </div>
                          ))}
                          {ret.customerName && (
                            <span className="text-[11px] text-on-surface-variant font-medium mt-0.5">
                              Cliente: <strong className="text-on-surface">{ret.customerName}</strong>
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Estado del Artículo (DESTACADO EN MAL ESTADO) */}
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex flex-col items-center gap-1">
                          {hasDamaged ? (
                            <div className="inline-flex flex-col items-center">
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-red-500/15 text-red-700 border border-red-500/30">
                                <span className="material-symbols-outlined text-[14px]">warning</span>
                                MAL ESTADO (MERMA)
                              </span>
                              {ret.items?.find((i) => i.condition === 'mal_estado')?.damagedReason && (
                                <span className="text-[10px] text-red-600 font-medium max-w-[180px] truncate mt-0.5" title={ret.items.find((i) => i.condition === 'mal_estado')?.damagedReason}>
                                  {ret.items.find((i) => i.condition === 'mal_estado')?.damagedReason}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-700 border border-emerald-500/30">
                              <span className="material-symbols-outlined text-[14px]">verified</span>
                              BUEN ESTADO
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Monto Reembolsado al cliente */}
                      <td className="py-3.5 px-4 text-right">
                        <span className="font-mono font-bold text-sm text-amber-600">
                          ${formatCUP(ret.totalRefund)}
                        </span>
                      </td>

                      {/* Método de Reintegro */}
                      <td className="py-3.5 px-4 text-center">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-surface neo-inset uppercase font-mono">
                          {ret.refundMethod}
                        </span>
                      </td>

                      {/* Acciones */}
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* Ver Detalle */}
                          <button
                            onClick={() => setSelectedReturnDetail(ret)}
                            className="w-8 h-8 rounded-lg bg-surface neo-raised flex items-center justify-center text-on-surface hover:text-primary active:neo-inset transition-all cursor-pointer"
                            type="button"
                            title="Ver detalle de la devolución"
                          >
                            <span className="material-symbols-outlined text-[17px]">visibility</span>
                          </button>

                          {/* Imprimir Comprobante */}
                          <button
                            onClick={() => handlePrintReturn(ret)}
                            className="w-8 h-8 rounded-lg bg-surface neo-raised flex items-center justify-center text-on-surface hover:text-emerald-600 active:neo-inset transition-all cursor-pointer"
                            type="button"
                            title="Imprimir comprobante de devolución"
                          >
                            <span className="material-symbols-outlined text-[17px]">print</span>
                          </button>
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
        {totalPages > 1 && (
          <div className="p-3.5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-on-surface-variant bg-surface rounded-xl mt-2 neo-inset">
            <span className="font-medium">
              Mostrando página <strong className="text-on-surface font-mono">{validPage}</strong> de{' '}
              <strong className="text-on-surface font-mono">{totalPages}</strong> ({finalFilteredReturns.length} registros)
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={validPage === 1}
                className="w-8 h-8 rounded-lg bg-surface neo-raised flex items-center justify-center disabled:opacity-40"
              >
                <span className="material-symbols-outlined text-[16px]">chevron_left</span>
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={validPage === totalPages}
                className="w-8 h-8 rounded-lg bg-surface neo-raised flex items-center justify-center disabled:opacity-40"
              >
                <span className="material-symbols-outlined text-[16px]">chevron_right</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* MODAL PARA REGISTRAR NUEVA DEVOLUCIÓN */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-2xl rounded-2xl bg-surface neo-raised border border-outline-variant/20 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            {/* Modal Header */}
            <div className="p-5 border-b border-outline-variant/15 flex items-center justify-between bg-surface-container-low/40">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-600">
                  <span className="material-symbols-outlined text-[22px]">assignment_return</span>
                </div>
                <div>
                  <h3 className="text-base font-headline font-bold text-on-surface">
                    Registrar Devolución de Cliente
                  </h3>
                  <span className="text-xs text-on-surface-variant">
                    Reembolso de importe y catalogación de estado técnico (bueno vs. defectuoso/merma).
                  </span>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 rounded-lg bg-surface neo-raised flex items-center justify-center text-on-surface-variant hover:text-on-surface cursor-pointer"
                type="button"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmitReturn} className="p-6 overflow-y-auto flex flex-col gap-5">
              {/* 1. Selección y Agregado de Artículos del Catálogo */}
              <div className="p-4 rounded-xl bg-surface neo-inset flex flex-col gap-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                  <span className="text-xs font-bold text-on-surface uppercase tracking-wider flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[18px] text-amber-600">inventory_2</span>
                    1. Agregar Artículo del Catálogo
                  </span>
                  <span className="text-[11px] text-on-surface-variant font-medium">
                    {filteredCatalogProducts.length} producto(s) en catálogo
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                  <div className="sm:col-span-4 relative">
                    <span className="material-symbols-outlined absolute left-2.5 top-2.5 text-[18px] text-on-surface-variant pointer-events-none">
                      search
                    </span>
                    <input
                      type="text"
                      value={catalogSearch}
                      onChange={(e) => setCatalogSearch(e.target.value)}
                      placeholder="Buscar por código o nombre..."
                      className="w-full h-10 pl-9 pr-3 rounded-xl bg-surface neo-raised text-xs text-on-surface outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>

                  <div className="sm:col-span-8">
                    <select
                      value=""
                      onChange={(e) => {
                        if (e.target.value) {
                          handleAddManualProduct(e.target.value);
                          e.target.value = '';
                        }
                      }}
                      className="w-full h-10 px-3 rounded-xl bg-surface neo-raised text-xs font-semibold text-on-surface outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                    >
                      <option value="">+ Seleccionar artículo para agregar a la devolución...</option>
                      {filteredCatalogProducts.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.code}) — Stock: {p.stock} {p.um} — ${p.price.toFixed(2)} CUP
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* 2. Lista de Artículos a Devolver con Selector de Estado */}
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-on-surface uppercase tracking-wider">
                    2. Artículos a Devolver y Estado Técnico
                  </span>
                  <span className="text-[11px] text-on-surface-variant">
                    {draftItems.length} artículo(s) seleccionado(s)
                  </span>
                </div>

                {draftItems.length === 0 ? (
                  <div className="p-6 rounded-xl bg-surface neo-inset text-center text-xs text-on-surface-variant flex flex-col items-center gap-1.5">
                    <span className="material-symbols-outlined text-[26px] text-on-surface-variant/60">add_shopping_cart</span>
                    <span>Seleccione un producto en el menú desplegable del catálogo arriba para agregarlo a la devolución.</span>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    {draftItems.map((item, idx) => (
                      <div
                        key={idx}
                        className={`p-3.5 rounded-xl border transition-all ${
                          item.condition === 'mal_estado'
                            ? 'bg-red-500/[0.04] border-red-500/30'
                            : 'bg-surface neo-raised border-outline-variant/15'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="flex items-center gap-2.5 flex-1 min-w-0">
                            <input
                              type="checkbox"
                              checked={item.selected}
                              onChange={(e) => {
                                const next = [...draftItems];
                                next[idx].selected = e.target.checked;
                                setDraftItems(next);
                              }}
                              className="w-4 h-4 rounded text-primary focus:ring-primary cursor-pointer shrink-0"
                            />
                            <div className="min-w-0 flex-1">
                              <div className="font-semibold text-xs text-on-surface flex items-center gap-1.5 truncate">
                                <span className="truncate">{item.name}</span>
                                <span className="text-[10px] text-on-surface-variant font-mono shrink-0">
                                  ({item.code})
                                </span>
                              </div>
                              <div className="text-[11px] text-on-surface-variant font-mono mt-0.5">
                                Precio unitario: ${item.unitPrice.toFixed(2)} CUP • Subtotal: ${(item.quantity * item.unitPrice).toFixed(2)} CUP
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2.5 self-end sm:self-auto shrink-0">
                            {/* Cantidad devuelta */}
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs text-on-surface-variant">Cant:</span>
                              <input
                                type="number"
                                min="1"
                                max={item.maxQty}
                                value={item.quantity}
                                onChange={(e) => {
                                  const next = [...draftItems];
                                  next[idx].quantity = Math.max(1, Math.min(item.maxQty, Number(e.target.value) || 1));
                                  setDraftItems(next);
                                }}
                                className="w-16 h-8 text-center rounded-lg bg-surface neo-inset text-xs font-mono font-bold text-on-surface outline-none"
                              />
                              <span className="text-xs font-mono text-on-surface-variant">{item.um}</span>
                            </div>

                            {/* Quitar artículo */}
                            <button
                              type="button"
                              onClick={() => handleRemoveDraftItem(idx)}
                              className="w-8 h-8 rounded-lg bg-surface neo-raised text-on-surface-variant hover:text-red-600 flex items-center justify-center transition-colors cursor-pointer"
                              title="Quitar artículo de la lista"
                            >
                              <span className="material-symbols-outlined text-[17px]">delete</span>
                            </button>
                          </div>
                        </div>

                        {/* Clasificación de Estado Técnico del Producto */}
                        {item.selected && (
                          <div className="mt-3 pt-3 border-t border-outline-variant/15 grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label className="text-[10px] font-bold uppercase text-on-surface-variant block mb-1">
                                Condición del Artículo Devuelto:
                              </label>
                              <div className="flex items-center gap-2">
                                <label
                                  className={`flex-1 p-2 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
                                    item.condition === 'mal_estado'
                                      ? 'bg-red-500/20 text-red-700 border-red-500 font-bold'
                                      : 'bg-surface border-outline-variant/20 text-on-surface-variant'
                                  }`}
                                >
                                  <input
                                    type="radio"
                                    name={`cond-${idx}`}
                                    checked={item.condition === 'mal_estado'}
                                    onChange={() => {
                                      const next = [...draftItems];
                                      next[idx].condition = 'mal_estado';
                                      next[idx].reintegrateToStock = false;
                                      setDraftItems(next);
                                    }}
                                    className="hidden"
                                  />
                                  <span className="material-symbols-outlined text-[16px]">warning</span>
                                  <span>⚠️ Mal Estado</span>
                                </label>

                                <label
                                  className={`flex-1 p-2 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
                                    item.condition === 'buen_estado'
                                      ? 'bg-emerald-500/20 text-emerald-700 border-emerald-500 font-bold'
                                      : 'bg-surface border-outline-variant/20 text-on-surface-variant'
                                  }`}
                                >
                                  <input
                                    type="radio"
                                    name={`cond-${idx}`}
                                    checked={item.condition === 'buen_estado'}
                                    onChange={() => {
                                      const next = [...draftItems];
                                      next[idx].condition = 'buen_estado';
                                      next[idx].reintegrateToStock = true;
                                      setDraftItems(next);
                                    }}
                                    className="hidden"
                                  />
                                  <span className="material-symbols-outlined text-[16px]">verified</span>
                                  <span>✓ Buen Estado</span>
                                </label>
                              </div>
                            </div>

                            {/* Motivo del Daño / Reincorporación */}
                            <div>
                              {item.condition === 'mal_estado' ? (
                                <div>
                                  <label className="text-[10px] font-bold uppercase text-red-600 block mb-1">
                                    Motivo del mal estado / Avería:
                                  </label>
                                  <input
                                    type="text"
                                    value={item.damagedReason}
                                    onChange={(e) => {
                                      const next = [...draftItems];
                                      next[idx].damagedReason = e.target.value;
                                      setDraftItems(next);
                                    }}
                                    placeholder="Ej: Roto, defecto de fábrica, no enciende, dañado..."
                                    className="w-full h-8 px-2.5 rounded-lg bg-surface neo-inset text-xs text-red-700 font-medium outline-none focus:ring-1 focus:ring-red-500"
                                  />
                                  <span className="text-[10px] text-red-600/90 block mt-0.5">
                                    No se repondrá al mostrador (Merma / Artículo averiado)
                                  </span>
                                </div>
                              ) : (
                                <div>
                                  <label className="text-[10px] font-bold uppercase text-emerald-700 block mb-1">
                                    Destino de Stock:
                                  </label>
                                  <label className="flex items-center gap-2 text-xs font-medium text-emerald-700 mt-1 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={item.reintegrateToStock}
                                      onChange={(e) => {
                                        const next = [...draftItems];
                                        next[idx].reintegrateToStock = e.target.checked;
                                        setDraftItems(next);
                                      }}
                                      className="w-3.5 h-3.5 rounded text-emerald-600 focus:ring-emerald-500"
                                    />
                                    <span>Reincorporar existencias al mostrador</span>
                                  </label>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 3. Datos del Reintegro, Motivo General y Cliente */}
              <div className="p-4 rounded-xl bg-surface neo-inset grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Motivo General (Desplegable) */}
                <div>
                  <label className="text-[11px] font-bold text-on-surface-variant block mb-1">
                    Motivo General:
                  </label>
                  <select
                    value={generalReason}
                    onChange={(e) => setGeneralReason(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl bg-surface neo-raised text-xs font-semibold text-on-surface outline-none cursor-pointer focus:ring-1 focus:ring-primary"
                  >
                    <option value="Artículo defectuoso / Garantía">Artículo defectuoso / Garantía</option>
                    <option value="Artículo en mal estado / Averiado">Artículo en mal estado / Averiado</option>
                    <option value="Error en la compra / Cambio">Error en la compra / Cambio</option>
                    <option value="Producto no compatible">Producto no compatible</option>
                    <option value="Vencido o deteriorado">Vencido o deteriorado</option>
                    <option value="Disconformidad del cliente">Disconformidad del cliente</option>
                    <option value="Otro motivo">Otro motivo...</option>
                  </select>
                  {generalReason === 'Otro motivo' && (
                    <input
                      type="text"
                      value={customReason}
                      onChange={(e) => setCustomReason(e.target.value)}
                      placeholder="Especifique el motivo..."
                      className="w-full h-8 px-2.5 mt-1.5 rounded-lg bg-surface neo-raised text-xs text-on-surface outline-none focus:ring-1 focus:ring-primary"
                    />
                  )}
                </div>

                {/* Método de Reembolso (Desplegable) */}
                <div>
                  <label className="text-[11px] font-bold text-on-surface-variant block mb-1">
                    Método de Reembolso:
                  </label>
                  <select
                    value={refundMethod}
                    onChange={(e) => setRefundMethod(e.target.value as any)}
                    className="w-full h-10 px-3 rounded-xl bg-surface neo-raised text-xs font-semibold text-on-surface outline-none cursor-pointer focus:ring-1 focus:ring-primary"
                  >
                    <option value="efectivo">Efectivo</option>
                    <option value="transferencia">Transferencia</option>
                    <option value="mixto">Mixto</option>
                  </select>
                </div>

                {/* Nombre del Cliente */}
                <div>
                  <label className="text-[11px] font-bold text-on-surface-variant block mb-1">
                    Nombre del Cliente:
                  </label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Opcional..."
                    className="w-full h-10 px-3 rounded-xl bg-surface neo-raised text-xs text-on-surface outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              {/* Total y Aviso de Cierre de Caja */}
              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/25 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span className="material-symbols-outlined text-[24px] text-amber-600">
                    monetization_on
                  </span>
                  <div>
                    <span className="text-xs font-bold text-amber-800 block">
                      MONTO TOTAL A DEVOLVER AL CLIENTE
                    </span>
                    <span className="text-[11px] text-amber-700">
                      Este importe se sumará automáticamente a las Devoluciones del Cierre de Caja.
                    </span>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-xl font-headline font-bold text-amber-700 font-mono">
                    ${formatCUP(modalCalculatedRefund)} CUP
                  </span>
                </div>
              </div>

              {/* Footer Buttons */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-surface neo-raised text-xs font-semibold text-on-surface-variant hover:text-on-surface cursor-pointer"
                  type="button"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={modalCalculatedRefund <= 0}
                  className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-headline font-bold shadow-md active:scale-[0.99] transition-all cursor-pointer disabled:opacity-50"
                >
                  Confirmar Devolución (${formatCUP(modalCalculatedRefund)} CUP)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DETALLE DE DEVOLUCIÓN */}
      {selectedReturnDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-lg rounded-2xl bg-surface neo-raised border border-outline-variant/20 shadow-2xl p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between pb-3 border-b border-outline-variant/15">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-600">
                  <span className="material-symbols-outlined text-[20px]">assignment_return</span>
                </div>
                <div>
                  <h3 className="text-base font-bold text-on-surface">
                    Devolución {selectedReturnDetail.returnNumber}
                  </h3>
                  <span className="text-xs text-on-surface-variant font-mono">
                    {selectedReturnDetail.date} • {selectedReturnDetail.timestamp || '--:--'}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setSelectedReturnDetail(null)}
                className="w-7 h-7 rounded-lg bg-surface neo-raised flex items-center justify-center text-on-surface-variant hover:text-on-surface"
              >
                ✕
              </button>
            </div>

            <div className="flex flex-col gap-3 text-xs">
              <div className="flex justify-between py-1 border-b border-outline-variant/10">
                <span className="text-on-surface-variant">Ticket Asociado:</span>
                <span className="font-mono font-bold text-primary">
                  {selectedReturnDetail.ticketNumber || 'Devolución directa'}
                </span>
              </div>
              {selectedReturnDetail.customerName && (
                <div className="flex justify-between py-1 border-b border-outline-variant/10">
                  <span className="text-on-surface-variant">Cliente:</span>
                  <span className="font-semibold">{selectedReturnDetail.customerName}</span>
                </div>
              )}
              <div className="flex justify-between py-1 border-b border-outline-variant/10">
                <span className="text-on-surface-variant">Método de Reintegro:</span>
                <span className="font-semibold uppercase font-mono">{selectedReturnDetail.refundMethod}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-outline-variant/10">
                <span className="text-on-surface-variant">Motivo:</span>
                <span>{selectedReturnDetail.reason}</span>
              </div>

              {/* Artículos */}
              <div className="p-3 rounded-xl bg-surface neo-inset mt-1">
                <span className="text-[10px] font-bold uppercase text-on-surface-variant block mb-2">
                  Artículos Devueltos
                </span>
                <div className="flex flex-col gap-2">
                  {(selectedReturnDetail.items || []).map((it, idx) => (
                    <div key={idx} className="flex items-center justify-between py-1 border-b border-outline-variant/10 last:border-0">
                      <div>
                        <div className="font-semibold text-on-surface">
                          {it.quantity} {it.um} x {it.name}
                        </div>
                        <div className="mt-0.5">
                          {it.condition === 'mal_estado' ? (
                            <span className="text-[10px] font-bold text-red-600 bg-red-500/10 px-2 py-0.5 rounded">
                              ⚠️ Mal Estado: {it.damagedReason || 'Defectuoso'} (Merma)
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded">
                              ✓ Buen Estado: Reincorporado
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="font-mono font-bold text-amber-600">
                        ${it.refundAmount.toFixed(2)} CUP
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Total Reembolsado */}
              <div className="p-3.5 rounded-xl bg-amber-500/10 flex items-center justify-between text-amber-800 font-bold">
                <span>TOTAL REEMBOLSADO:</span>
                <span className="font-mono text-base">${selectedReturnDetail.totalRefund.toFixed(2)} CUP</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => handlePrintReturn(selectedReturnDetail)}
                className="px-4 py-2 rounded-xl bg-emerald-600 text-white font-semibold text-xs flex items-center gap-1.5 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">print</span>
                <span>Imprimir Comprobante</span>
              </button>
              <button
                onClick={() => setSelectedReturnDetail(null)}
                className="px-4 py-2 rounded-xl bg-surface neo-raised text-xs font-semibold text-on-surface cursor-pointer"
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
