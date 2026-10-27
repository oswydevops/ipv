import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { SearchableSelect } from '../components/SearchableSelect';
import { ReturnRecord, ReturnItem, MermaItem } from '../types';
import { getMermaDestination, getReturnItemMermas } from '../utils/returnDestinations';

export const ReturnsView: React.FC = () => {
  const {
    returns = [],
    sales = [],
    products = [],
    mermaItems = [],
    venderMermaConDescuento,
    enviarMermaAlmacen,
    enviarMermaAStock,
    darDeBajaMermaItem,
    revocarMermaItem,
    todayDate,
    addReturn,
    isCurrentDayClosed,
    setCurrentView,
  } = useApp();

  // Estados de vista
  const [activeTab, setActiveTab] = useState<'todas' | 'almacen_merma'>('todas');
  const [searchQuery, setSearchQuery] = useState('');
  const [periodFilter, setPeriodFilter] = useState<'hoy' | 'semana' | 'mes' | 'todos'>('hoy');
  const [page, setPage] = useState(1);
  const pageSize = 8;

  // Estados para Modal de Nueva Devolución
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [refundMethod, setRefundMethod] = useState<'efectivo' | 'transferencia' | 'mixto'>('efectivo');
  const [transferenciaRefundInput, setTransferenciaRefundInput] = useState<string>('');
  const [generalReason, setGeneralReason] = useState('Artículo defectuoso / Garantía');
  const [customReason, setCustomReason] = useState('');
  const [selectedReturnDetail, setSelectedReturnDetail] = useState<ReturnRecord | null>(null);

  // Estados para gestión de merma
  const [mermaItemToReprice, setMermaItemToReprice] = useState<MermaItem | null>(null);
  const [newPriceInput, setNewPriceInput] = useState<string>('');
  const [repriceNote, setRepriceNote] = useState<string>('');
  const [mermaItemToBaja, setMermaItemToBaja] = useState<MermaItem | null>(null);
  const [bajaNote, setBajaNote] = useState<string>('');
  const [mermaItemToWarehouse, setMermaItemToWarehouse] = useState<MermaItem | null>(null);
  const [mermaItemToRevoke, setMermaItemToRevoke] = useState<MermaItem | null>(null);

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

  // 2. Filtrado por búsqueda
  const finalFilteredReturns = useMemo(() => {
    return periodFilteredReturns.filter((r) => {
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
  }, [periodFilteredReturns, searchQuery]);

  // Artículos en merma filtrados por búsqueda
  const filteredMermaItems = useMemo(() => {
    const pendingItems = mermaItems.filter((item) => item.status === 'en_almacen_merma');
    if (!searchQuery.trim()) return pendingItems;
    const q = searchQuery.toLowerCase();
    return pendingItems.filter(
      (m) =>
        m.name?.toLowerCase().includes(q) ||
        m.code?.toLowerCase().includes(q) ||
        m.returnNumber?.toLowerCase().includes(q) ||
        m.damagedReason?.toLowerCase().includes(q)
    );
  }, [mermaItems, searchQuery]);

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
  const todayMermaItems = useMemo(
    () => mermaItems.filter((item) => item.resolvedAt === todayDate),
    [mermaItems, todayDate]
  );
  const damagedSoldToday = todayMermaItems
    .filter((item) => item.condition === 'mal_estado' && item.status === 'reincorporado_con_precio')
    .reduce((total, item) => total + item.quantity, 0);
  const damagedWrittenOffToday = todayMermaItems
    .filter((item) => item.condition === 'mal_estado' && item.status === 'baja_definitiva')
    .reduce((total, item) => total + item.quantity, 0);
  const goodSentToWarehouseToday = todayMermaItems
    .filter((item) => item.condition === 'buen_estado' && item.status === 'devuelto_a_almacen')
    .reduce((total, item) => total + item.quantity, 0);
  const goodSentToStockToday = todayMermaItems
    .filter((item) => item.condition === 'buen_estado' && item.status === 'reintegrado_a_stock')
    .reduce((total, item) => total + item.quantity, 0);
  const resolvedReturnReason = generalReason === 'Otro motivo' && customReason.trim()
    ? customReason.trim()
    : generalReason;
  const selectedReturnDestinations = selectedReturnDetail
    ? getReturnItemMermas(selectedReturnDetail, mermaItems)
    : [];

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

    const finalReason = resolvedReturnReason.trim() || 'Devolución de cliente';
    const returnItems: ReturnItem[] = selectedDrafts.map((d) => ({
      productId: d.productId,
      code: d.code,
      name: d.name,
      um: d.um,
      quantity: Number(d.quantity),
      unitPrice: Number(d.unitPrice),
      refundAmount: Number(d.quantity) * Number(d.unitPrice),
      condition: d.condition,
      damagedReason: d.condition === 'mal_estado' ? finalReason : undefined,
      reintegrateToStock: false,
    }));

    const trAmount = refundMethod === 'mixto'
      ? Math.min(modalCalculatedRefund, Math.max(0, parseFloat(transferenciaRefundInput) || 0))
      : refundMethod === 'transferencia'
      ? modalCalculatedRefund
      : 0;

    const efAmount = refundMethod === 'mixto'
      ? Math.max(0, modalCalculatedRefund - trAmount)
      : refundMethod === 'efectivo'
      ? modalCalculatedRefund
      : 0;

    const returnPayload = {
      customerName: customerName.trim() || undefined,
      refundMethod,
      transferenciaAmount: trAmount,
      efectivoAmount: efAmount,
      reason: finalReason,
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
      setTransferenciaRefundInput('');
    }
  };

  // Imprimir comprobante de devolución
  const handlePrintReturn = (record: ReturnRecord) => {
    const printWindow = window.open('', '_blank', 'width=600,height=700');
    if (!printWindow) return;

    const destinations = getReturnItemMermas(record, mermaItems);
    const itemsHtml = (record.items || [])
      .map(
        (it, index) => {
          const destination = getMermaDestination(destinations[index]);
          return `
        <tr>
          <td style="padding: 6px 0; border-bottom: 1px dashed #ccc;">
            <strong>${it.name}</strong><br/>
            <small style="color: #666;">Cód: ${it.code} | Cant: ${it.quantity} ${it.um} x $${it.unitPrice.toFixed(2)}</small><br/>
            ${
              it.condition === 'mal_estado'
                ? `<span style="color: #d32f2f; font-weight: bold; font-size: 11px;">⚠️ MAL ESTADO: ${it.damagedReason || 'Averiado / defecto'}</span>`
                : `<span style="color: #2e7d32; font-weight: bold; font-size: 11px;">✓ BUEN ESTADO</span>`
            }
            <br/><small><strong>Destino:</strong> ${destination.label}</small>
          </td>
          <td style="padding: 6px 0; text-align: right; border-bottom: 1px dashed #ccc; font-weight: bold;">
            $${it.refundAmount.toFixed(2)} CUP
          </td>
        </tr>
      `;
        }
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
            <div>
              <h1 className="text-2xl lg:text-3xl font-headline font-bold text-on-surface tracking-tight">
                Control de Devoluciones y Garantías
              </h1>
              <p className="text-xs lg:text-sm text-on-surface-variant">
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
            <span>Registrar Devolución</span>
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
            <span>Reflejado en Cierre de Caja</span>
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
          <div className="flex items-center justify-between gap-1.5 mt-3 pt-2.5 border-t border-red-200/40 text-[11px] text-red-700 font-medium">
            <span>Venta con descuento: <strong>{damagedSoldToday}</strong></span>
            <span>Baja: <strong>{damagedWrittenOffToday}</strong></span>
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
          <div className="flex items-center justify-between gap-1.5 mt-3 pt-2.5 border-t border-emerald-200/40 text-[11px] text-emerald-700 font-medium">
            <span>Almacén: <strong>{goodSentToWarehouseToday}</strong></span>
            <span>Stock: <strong>{goodSentToStockToday}</strong></span>
          </div>
        </div>
      </div>

      {/* Barra de Filtros, Pestañas y Búsqueda */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 p-4 rounded-2xl bg-surface neo-raised">
        {/* Pestañas de vista */}
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
              setActiveTab('almacen_merma');
              setPage(1);
            }}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'almacen_merma'
                ? 'bg-amber-500/15 text-amber-700 font-bold border border-amber-500/20'
                : 'text-amber-700 hover:bg-amber-500/10'
            }`}
            type="button"
          >
            <span className="material-symbols-outlined text-[16px]">warehouse</span>
            <span>
              Almacén de Mermas ({mermaItems.filter((item) => item.status === 'en_almacen_merma').length})
            </span>
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
              className="app-select h-10 px-3 rounded-xl bg-surface neo-inset text-xs font-semibold text-on-surface outline-none focus:ring-1 focus:ring-primary cursor-pointer"
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

      {/* Vista Condicional: Almacén de Mermas o Tabla Principal de Devoluciones */}
      {activeTab === 'almacen_merma' ? (
        <div className="rounded-2xl bg-surface neo-raised p-4 flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center text-amber-700 shrink-0">
                <span className="material-symbols-outlined text-[24px]">warehouse</span>
              </div>
              <div>
                <h3 className="text-sm font-bold text-amber-900">
                  Gestión del Almacén de Mermas y Artículos Averiados
                </h3>
                <p className="text-xs text-amber-800">
                  Clasifique cada artículo defectuoso: venderlo a un precio rebajado, enviarlo al almacén central para reponerlo después al mostrador o darlo de baja.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 self-end sm:self-auto">
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-800 font-mono">
                {filteredMermaItems.filter((m) => m.status === 'en_almacen_merma').length} pendientes
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full table-fixed text-left text-sm whitespace-nowrap">
              <thead>
                <tr className="text-[10px] font-semibold uppercase tracking-wide text-on-surface-variant bg-surface-container-low/40">
                  <th className="py-2 px-2 w-[9%]">Fecha</th>
                  <th className="py-2 px-2 w-[9%]">Folio</th>
                  <th className="py-2 px-2 w-[18%]">Artículo</th>
                  <th className="py-2 px-2 w-[8%] text-center">Cant.</th>
                  <th className="py-2 px-2 w-[12%] text-right">Precio orig.</th>
                  <th className="py-2 px-2 w-[19%]">Defecto / Causa</th>
                  <th className="py-2 px-2 w-[15%] text-center">Estado</th>
                  <th className="py-2 px-2 w-[10%] text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y-0 text-on-surface">
                {filteredMermaItems.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-xs text-on-surface-variant font-medium">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <span className="material-symbols-outlined text-[36px] text-on-surface-variant/60">
                          inventory_2
                        </span>
                        <span className="text-sm font-semibold text-on-surface">
                          No hay artículos en el almacén de merma actualmente
                        </span>
                        <p className="text-xs text-on-surface-variant/80">
                          Los artículos de cada devolución aparecerán aquí hasta que decida su destino.
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredMermaItems.map((item) => {
                    const isGoodCondition = item.condition
                      ? item.condition === 'buen_estado'
                      : item.damagedReason === 'Artículo en buen estado';
                    return (
                    <tr
                      key={item.id}
                      className="group hover:bg-surface-container-high/40 transition-colors border-b border-outline-variant/10"
                    >
                      <td className="py-2 px-2 font-mono text-[10px] text-on-surface-variant">
                        {item.date}
                      </td>
                      <td className="py-2 px-2 font-mono font-bold text-[10px] text-amber-600">
                        {item.returnNumber}
                      </td>
                      <td className="py-2 px-2">
                        <div className="flex flex-col">
                          <span className="font-semibold text-on-surface text-[11px] truncate" title={item.name}>{item.name}</span>
                          <span className="text-[9px] text-on-surface-variant font-mono truncate">
                            Cód: {item.code}
                          </span>
                        </div>
                      </td>
                      <td className="py-2 px-2 text-center font-mono font-bold text-[10px]">
                        {item.quantity} {item.um}
                      </td>
                      <td className="py-2 px-2 text-right font-mono font-semibold text-[10px] text-on-surface-variant">
                        ${formatCUP(item.originalUnitPrice)} CUP
                      </td>
                      <td className="py-2 px-2">
                        <span
                          className={`text-[10px] font-medium block truncate ${isGoodCondition ? 'text-emerald-600' : 'text-red-600'}`}
                          title={item.damagedReason}
                        >
                          {item.damagedReason}
                        </span>
                      </td>
                      <td className="py-2 px-2 text-left align-top">
                        {item.status === 'en_almacen_merma' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-800 border border-amber-500/30">
                            <span className="material-symbols-outlined text-[13px]">warehouse</span>
                            EN MERMA
                          </span>
                        ) : item.status === 'reincorporado_con_precio' ? (
                          <div className="flex flex-col items-start">
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[9px] font-bold bg-emerald-500/15 text-emerald-700 border border-emerald-500/30">
                              <span className="material-symbols-outlined text-[13px]">verified</span>
                              VENTA DEFECTUOSA
                            </span>                            
                          </div>
                        ) : item.status === 'devuelto_a_almacen' ? (
                          <div className="flex flex-col items-start">
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-sky-500/15 text-sky-700 border border-sky-500/30">
                              <span className="material-symbols-outlined text-[13px]">inventory_2</span>
                              EN ALMACÉN 
                            </span>
                          </div>
                        ) : (
                          <div className="flex flex-col items-start">
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-gray-500/15 text-gray-700 border border-gray-500/30">
                              <span className="material-symbols-outlined text-[13px]">delete_sweep</span>
                              BAJA DEFINITIVA
                            </span>                    
                          </div>
                        )}
                      </td>
                      <td className="py-2 px-1 text-center">
                        {isGoodCondition ? (
                          <div className="flex items-center justify-center">
                            <button
                              onClick={() => setMermaItemToWarehouse(item)}
                              className="w-7 h-7 rounded-lg bg-surface neo-raised text-sky-700 hover:text-sky-800 flex items-center justify-center cursor-pointer transition-all active:neo-inset"
                              type="button"
                              title="Elegir destino: almacén central o stock del mostrador"
                              aria-label="Elegir destino del artículo en buen estado"
                            >
                              <span className="material-symbols-outlined text-[16px]">warehouse</span>
                            </button>
                          </div>
                        ) : item.status === 'en_almacen_merma' ? (
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => {
                                setMermaItemToReprice(item);
                                const suggested = Math.max(0.01, Number((item.originalUnitPrice * 0.7).toFixed(2)));
                                setNewPriceInput(String(suggested));
                                setRepriceNote(`Venta como defectuoso por: ${item.damagedReason}`);
                              }}
                              className="w-7 h-7 rounded-lg bg-surface neo-raised text-primary hover:text-primary-container flex items-center justify-center cursor-pointer transition-all active:neo-inset"
                              type="button"
                              title="Crear existencia separada para vender como artículo defectuoso"
                            >
                              <span className="material-symbols-outlined text-[16px]">price_change</span>
                            </button>
                            <button
                              onClick={() => {
                                setMermaItemToBaja(item);
                                setBajaNote(`Baja definitiva por daño irreparable: ${item.damagedReason}`);
                              }}
                              className="w-7 h-7 rounded-lg bg-surface neo-raised text-red-600 hover:text-red-700 flex items-center justify-center cursor-pointer transition-all active:neo-inset"
                              type="button"
                              title="Dar de baja el artículo defectuoso"
                            >
                              <span className="material-symbols-outlined text-[16px]">delete</span>
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center">
                            <button
                              onClick={() => setMermaItemToRevoke(item)}
                              className="w-7 h-7 rounded-lg bg-surface neo-raised text-amber-700 hover:text-amber-800 flex items-center justify-center cursor-pointer transition-all active:neo-inset"
                              type="button"
                              title="Revocar acción y devolver a pendientes"
                              aria-label="Revocar acción y devolver a pendientes"
                            >
                              <span className="material-symbols-outlined text-[16px]">undo</span>
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Tabla Principal de Devoluciones y Artículos Devueltos */
        <div className="rounded-2xl bg-surface neo-raised p-2 overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead>
              <tr className="text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant bg-surface-container-low/40">
                <th className="py-3 px-4">N° Devolución</th>
                <th className="py-3 px-4">Fecha &amp; Hora</th>
                <th className="py-3 px-4">Artículos Devueltos</th>
                <th className="py-3 px-4 text-right">Reembolsado (CUP)</th>
                <th className="py-3 px-4 text-center">Reintegro</th>
                <th className="py-3 px-4 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y-0 text-on-surface">
              {paginatedReturns.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-14 text-center text-xs text-on-surface-variant font-medium">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <span className="material-symbols-outlined text-[36px] text-on-surface-variant/60">
                        assignment_return
                      </span>
                      <span className="text-sm font-semibold text-on-surface">
                        No hay devoluciones registradas en este período
                      </span>
                      <p className="text-xs text-on-surface-variant/80 max-w-md">
                        Utilice el botón «Registrar Devolución» para ingresar devoluciones de clientes.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedReturns.map((ret) => {
                  const visibleItems = ret.items || [];
                  const destinations = getReturnItemMermas(ret, mermaItems);
                  const hasDamaged = visibleItems.some((item) => item.condition === 'mal_estado');
                  const visibleRefund = ret.totalRefund;

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

                      {/* Artículos Devueltos */}
                      <td className="py-3.5 px-4">
                        <div className="flex flex-col max-w-sm">
                          {visibleItems.map((it, idx) => {
                            const destination = getMermaDestination(destinations[idx]);
                            return (
                            <div key={idx} className="flex items-center gap-1.5 text-xs py-0.5">
                              <span className="font-mono font-bold text-primary">
                                {it.quantity} {it.um}
                              </span>
                              <span className="font-semibold text-on-surface truncate">
                                {it.name}
                              </span>
                              <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${destination.className}`}>
                                {destination.label}
                              </span>
                            </div>
                            );
                          })}
                          {ret.customerName && (
                            <span className="text-[11px] text-on-surface-variant font-medium mt-0.5">
                              Cliente: <strong className="text-on-surface">{ret.customerName}</strong>
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Monto Reembolsado al cliente */}
                      <td className="py-3.5 px-4 text-center">
                        <span className="font-mono font-bold text-sm text-amber-600">
                          ${formatCUP(visibleRefund)}
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
      )}

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
                    {products.length} producto(s) en catálogo
                  </span>
                </div>

                <SearchableSelect
                  value=""
                  onChange={(productId) => {
                    if (productId) handleAddManualProduct(productId);
                  }}
                  placeholder="+ Buscar artículo por nombre o código para agregar..."
                  options={products.map((product) => ({
                    value: product.id,
                    label: `${product.name} (${product.code}) — Stock: ${product.stock} ${product.um} — $${product.price.toFixed(2)} CUP`,
                  }))}
                  emptyMessage="No se encontraron productos"
                  className="h-10 pl-3 rounded-xl bg-surface neo-raised text-xs font-semibold"
                />
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
                                    Causa registrada:
                                  </label>
                                  <div className="w-full min-h-8 px-2.5 py-1.5 rounded-lg bg-surface neo-inset text-xs text-red-700 font-medium">
                                    {resolvedReturnReason}
                                  </div>
                                  <span className="text-[10px] text-red-600 font-semibold flex items-center gap-1 mt-1">
                                    <span className="material-symbols-outlined text-[13px]">warehouse</span>
                                    Pasa al almacén de mermas para venderlo con descuento como defectuoso o darlo de baja
                                  </span>
                                </div>
                              ) : (
                                <div>
                                  <label className="text-[10px] font-bold uppercase text-amber-700 block mb-1">
                                    Destino en Almacén de Mermas:
                                  </label>
                                  <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-700 mt-1">
                                    <span className="material-symbols-outlined text-amber-600 text-[16px]">warehouse</span>
                                    <span>Pasa a mermas para su revisión antes de reincorporarse al inventario o darse de baja</span>
                                  </div>
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
                    className="app-select w-full h-10 px-3 rounded-xl bg-surface neo-raised text-xs font-semibold text-on-surface outline-none cursor-pointer focus:ring-1 focus:ring-primary"
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
                    onChange={(e) => {
                      const next = e.target.value as any;
                      setRefundMethod(next);
                      if (next === 'mixto' && !transferenciaRefundInput) {
                        setTransferenciaRefundInput((modalCalculatedRefund / 2).toFixed(2));
                      }
                    }}
                    className="app-select w-full h-10 px-3 rounded-xl bg-surface neo-raised text-xs font-semibold text-on-surface outline-none cursor-pointer focus:ring-1 focus:ring-primary"
                  >
                    <option value="efectivo">Efectivo (100%)</option>
                    <option value="transferencia">Transferencia (100%)</option>
                    <option value="mixto">Método Mixto (Efectivo + Transferencia)</option>
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

              {/* Si es Método Mixto: selector de cantidad por transferencia y resto en efectivo */}
              {refundMethod === 'mixto' && (
                <div className="p-4 rounded-xl bg-surface neo-inset border border-outline-variant/20 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-on-surface flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[18px] text-primary">call_split</span>
                      Desglose del Reembolso Mixto
                    </span>
                    <span className="text-[10px] text-on-surface-variant font-mono">
                      Total a devolver: ${formatCUP(modalCalculatedRefund)} CUP
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-[11px] font-bold text-primary block mb-1">
                        Cantidad a Entregar por Transferencia:
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-2.5 font-mono text-xs font-bold text-primary">$</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          max={modalCalculatedRefund}
                          value={transferenciaRefundInput}
                          onChange={(e) => {
                            const val = e.target.value;
                            const num = parseFloat(val);
                            if (num > modalCalculatedRefund) {
                              setTransferenciaRefundInput(String(modalCalculatedRefund));
                            } else {
                              setTransferenciaRefundInput(val);
                            }
                          }}
                          placeholder="0.00"
                          className="w-full h-10 pl-7 pr-3 rounded-xl bg-surface neo-raised font-mono text-xs font-bold text-primary outline-none focus:ring-1 focus:ring-primary"
                        />
                      </div>
                      <span className="text-[10px] text-on-surface-variant mt-1 block">
                        Se descontará de transferencias digitales en Cierre de Caja
                      </span>
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-emerald-700 block mb-1">
                        Cantidad Restante en Efectivo (Automático):
                      </label>
                      <div className="h-10 px-3.5 rounded-xl bg-surface neo-raised flex items-center justify-between border border-emerald-500/20">
                        <span className="text-xs text-on-surface-variant font-medium">Resto en efectivo:</span>
                        <span className="font-mono text-sm font-bold text-emerald-600">
                          ${formatCUP(Math.max(0, modalCalculatedRefund - (parseFloat(transferenciaRefundInput) || 0)))} CUP
                        </span>
                      </div>
                      <span className="text-[10px] text-on-surface-variant mt-1 block">
                        Se descontará de la gaveta de efectivo en Cierre de Caja
                      </span>
                    </div>
                  </div>
                </div>
              )}

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
                  {(selectedReturnDetail.items || []).map((it, idx) => {
                    const destination = getMermaDestination(selectedReturnDestinations[idx]);
                    return (
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
                              ✓ Buen Estado
                            </span>
                          )}
                        </div>
                        <span className={`inline-flex mt-1 px-2 py-0.5 rounded text-[10px] font-bold ${destination.className}`}>
                          Destino: {destination.label}
                        </span>
                      </div>
                      <span className="font-mono font-bold text-amber-600">
                        ${it.refundAmount.toFixed(2)} CUP
                      </span>
                    </div>
                    );
                  })}
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

      {/* Modal para preparar el artículo defectuoso para la venta */}
      {mermaItemToReprice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md rounded-2xl bg-surface neo-raised border border-outline-variant/20 shadow-2xl overflow-hidden flex flex-col">
            <div className="p-4 border-b border-outline-variant/15 flex items-center justify-between bg-surface-container-low/40">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                  <span className="material-symbols-outlined text-[20px]">price_change</span>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-on-surface">Vender a Precio Rebajado</h3>
                  <span className="text-xs text-on-surface-variant font-mono">
                    {mermaItemToReprice.code} • {mermaItemToReprice.returnNumber}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setMermaItemToReprice(null)}
                className="w-7 h-7 rounded-lg bg-surface neo-raised flex items-center justify-center text-on-surface-variant hover:text-on-surface cursor-pointer"
                type="button"
              >
                ✕
              </button>
            </div>

            <div className="p-5 flex flex-col gap-4 text-xs">
              <div className="p-3 rounded-xl bg-surface neo-inset flex flex-col gap-1.5">
                <span className="text-on-surface font-semibold text-xs">
                  {mermaItemToReprice.name}
                </span>
                <span className="text-[11px] text-red-600 font-medium">
                  <strong>Defecto registrado:</strong> {mermaItemToReprice.damagedReason}
                </span>
                <div className="flex justify-between items-center mt-1 pt-1 border-t border-outline-variant/10 text-[11px]">
                  <span className="text-on-surface-variant">Precio original anterior:</span>
                  <span className="font-mono font-bold text-on-surface">
                    ${formatCUP(mermaItemToReprice.originalUnitPrice)} CUP
                  </span>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-on-surface block mb-1">
                  Precio de venta del artículo defectuoso ($ CUP):
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 font-mono text-xs font-bold text-primary">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={newPriceInput}
                    onChange={(e) => setNewPriceInput(e.target.value)}
                    placeholder="0.00"
                    className="w-full h-10 pl-7 pr-3 rounded-xl bg-surface neo-inset font-mono text-sm font-bold text-primary outline-none focus:ring-1 focus:ring-primary"
                    autoFocus
                  />
                </div>
                {parseFloat(newPriceInput) > 0 && (
                  <div className="flex items-center justify-between text-[11px] mt-1.5 px-1">
                    <span className="text-on-surface-variant">Diferencia / Descuento:</span>
                    <span className="font-mono font-semibold text-emerald-600">
                      -${formatCUP(Math.max(0, mermaItemToReprice.originalUnitPrice - parseFloat(newPriceInput)))} CUP
                      {mermaItemToReprice.originalUnitPrice > 0 && ` (-${Math.round(((mermaItemToReprice.originalUnitPrice - parseFloat(newPriceInput)) / mermaItemToReprice.originalUnitPrice) * 100)}%)`}
                    </span>
                  </div>
                )}
                {Number(newPriceInput) >= mermaItemToReprice.originalUnitPrice && (
                  <p className="text-[10px] text-red-600 mt-1">
                    El precio debe ser menor que el precio original de ${formatCUP(mermaItemToReprice.originalUnitPrice)} CUP.
                  </p>
                )}
              </div>

              <div>
                <label className="text-[11px] font-bold text-on-surface-variant block mb-1">
                  Nota / Justificación técnica del precio:
                </label>
                <input
                  type="text"
                  value={repriceNote}
                  onChange={(e) => setRepriceNote(e.target.value)}
                  placeholder="Ej: Vendido como saldo / defecto estético leve..."
                  className="w-full h-9 px-3 rounded-xl bg-surface neo-raised text-xs text-on-surface outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-emerald-800">
                Se creará una existencia separada identificada como <strong>Defectuoso</strong>, con este precio y cantidad. Aparecerá así en el cierre de caja; no se mezclará con el stock normal.
              </div>
            </div>

            <div className="p-4 border-t border-outline-variant/15 flex justify-end gap-2 bg-surface-container-low/20">
              <button
                onClick={() => setMermaItemToReprice(null)}
                className="px-4 py-2 rounded-xl bg-surface neo-raised text-xs font-semibold text-on-surface-variant hover:text-on-surface cursor-pointer"
                type="button"
              >
                Cancelar
              </button>
              <button
                onClick={async () => {
                  const np = parseFloat(newPriceInput);
                  if (isNaN(np) || np <= 0) return;
                  const success = await venderMermaConDescuento(
                    mermaItemToReprice.id,
                    np,
                    repriceNote.trim() || undefined
                  );
                  if (success) setMermaItemToReprice(null);
                }}
                disabled={!newPriceInput || parseFloat(newPriceInput) <= 0 || parseFloat(newPriceInput) >= mermaItemToReprice.originalUnitPrice}
                className="px-4 py-2 rounded-xl bg-primary text-white text-xs font-bold shadow-md hover:bg-primary-container disabled:opacity-50 cursor-pointer"
                type="button"
              >
                Preparar para Venta
              </button>
            </div>
          </div>
        </div>
      )}

      {mermaItemToWarehouse && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md rounded-2xl bg-surface neo-raised border border-outline-variant/20 shadow-2xl overflow-hidden flex flex-col">
            <div className="p-4 border-b border-outline-variant/15 flex items-center gap-2.5 bg-surface-container-low/40">
              <div className="w-9 h-9 rounded-xl bg-sky-500/10 flex items-center justify-center text-sky-700">
                <span className="material-symbols-outlined text-[20px]">warehouse</span>
              </div>
              <div>
                <h3 className="text-sm font-bold text-on-surface">
                  {mermaItemToWarehouse.condition === 'buen_estado' ||
                  mermaItemToWarehouse.damagedReason === 'Artículo en buen estado'
                    ? 'Elegir destino del artículo'
                    : 'Enviar al almacén central'}
                </h3>
                <span className="text-xs text-on-surface-variant font-mono">
                  {mermaItemToWarehouse.code} • {mermaItemToWarehouse.returnNumber}
                </span>
              </div>
            </div>
            <div className="p-5 flex flex-col gap-3 text-xs">
              <div className="p-3 rounded-xl bg-surface neo-inset flex flex-col gap-1">
                <span className="font-bold text-on-surface">{mermaItemToWarehouse.name}</span>
                <span className="text-on-surface-variant">Cantidad: {mermaItemToWarehouse.quantity} {mermaItemToWarehouse.um}</span>
              </div>
              <p className="text-on-surface-variant">
                {mermaItemToWarehouse.condition === 'buen_estado' ||
                mermaItemToWarehouse.damagedReason === 'Artículo en buen estado'
                  ? 'Seleccione si desea guardar la cantidad en el almacén central o dejarla disponible inmediatamente en el stock del mostrador.'
                  : 'La cantidad se sumará al almacén del producto original, no al stock disponible para venta. Desde Productos podrá reponerla al mostrador cuando corresponda.'}
              </p>
            </div>
            <div className="p-4 border-t border-outline-variant/15 flex justify-end gap-2 bg-surface-container-low/20">
              <button
                onClick={() => setMermaItemToWarehouse(null)}
                className="px-4 py-2 rounded-xl bg-surface neo-raised text-xs font-semibold text-on-surface-variant hover:text-on-surface cursor-pointer"
                type="button"
              >
                Cancelar
              </button>
              {(mermaItemToWarehouse.condition === 'buen_estado' ||
              mermaItemToWarehouse.damagedReason === 'Artículo en buen estado') ? (
                <>
                  <button
                    onClick={async () => {
                      const success = await enviarMermaAlmacen(mermaItemToWarehouse.id);
                      if (success) setMermaItemToWarehouse(null);
                    }}
                    className="px-4 py-2 rounded-xl bg-sky-700 hover:bg-sky-800 text-white text-xs font-bold shadow-md cursor-pointer"
                    type="button"
                  >
                    Enviar al almacén central
                  </button>
                  <button
                    onClick={async () => {
                      const success = await enviarMermaAStock(mermaItemToWarehouse.id);
                      if (success) setMermaItemToWarehouse(null);
                    }}
                    className="px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shadow-md cursor-pointer"
                    type="button"
                  >
                    Enviar al stock
                  </button>
                </>
              ) : (
                <button
                  onClick={async () => {
                    const success = await enviarMermaAlmacen(mermaItemToWarehouse.id);
                    if (success) setMermaItemToWarehouse(null);
                  }}
                  className="px-4 py-2 rounded-xl bg-sky-700 hover:bg-sky-800 text-white text-xs font-bold shadow-md cursor-pointer"
                  type="button"
                >
                  Confirmar Envío
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {mermaItemToRevoke && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md rounded-2xl bg-surface neo-raised border border-outline-variant/20 shadow-2xl overflow-hidden flex flex-col">
            <div className="p-4 border-b border-outline-variant/15 flex items-center justify-between bg-surface-container-low/40">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-700">
                  <span className="material-symbols-outlined text-[20px]">undo</span>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-on-surface">Revocar acción aplicada</h3>
                  <span className="text-xs text-on-surface-variant font-mono">
                    {mermaItemToRevoke.code} • {mermaItemToRevoke.returnNumber}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setMermaItemToRevoke(null)}
                className="w-7 h-7 rounded-lg bg-surface neo-raised flex items-center justify-center text-on-surface-variant hover:text-on-surface cursor-pointer"
                type="button"
                aria-label="Cerrar"
              >
                <span className="material-symbols-outlined text-[16px]">close</span>
              </button>
            </div>

            <div className="p-5 flex flex-col gap-3 text-xs">
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-900 flex flex-col gap-1">
                <span className="font-bold text-xs">{mermaItemToRevoke.name}</span>
                <span>
                  Cantidad: {mermaItemToRevoke.quantity} {mermaItemToRevoke.um}
                </span>
              </div>
              <p className="text-on-surface-variant">
                Se revocará la acción aplicada y el artículo volverá a quedar pendiente en el almacén de mermas.
              </p>
            </div>

            <div className="p-4 border-t border-outline-variant/15 flex justify-end gap-2 bg-surface-container-low/20">
              <button
                onClick={() => setMermaItemToRevoke(null)}
                className="px-4 py-2 rounded-xl bg-surface neo-raised text-xs font-semibold text-on-surface-variant hover:text-on-surface cursor-pointer"
                type="button"
              >
                Cancelar
              </button>
              <button
                onClick={async () => {
                  const success = await revocarMermaItem(mermaItemToRevoke.id);
                  if (success) setMermaItemToRevoke(null);
                }}
                className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-md cursor-pointer"
                type="button"
              >
                Confirmar revocación
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal para Confirmar Baja Definitiva de Merma */}
      {mermaItemToBaja && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md rounded-2xl bg-surface neo-raised border border-outline-variant/20 shadow-2xl overflow-hidden flex flex-col">
            <div className="p-4 border-b border-outline-variant/15 flex items-center justify-between bg-surface-container-low/40">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-red-500/10 flex items-center justify-center text-red-600">
                  <span className="material-symbols-outlined text-[20px]">delete_forever</span>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-on-surface">Dar de Baja Definitiva</h3>
                  <span className="text-xs text-on-surface-variant font-mono">
                    {mermaItemToBaja.code} • {mermaItemToBaja.returnNumber}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setMermaItemToBaja(null)}
                className="w-7 h-7 rounded-lg bg-surface neo-raised flex items-center justify-center text-on-surface-variant hover:text-on-surface cursor-pointer"
                type="button"
              >
                ✕
              </button>
            </div>

            <div className="p-5 flex flex-col gap-4 text-xs">
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-800 flex flex-col gap-1">
                <span className="font-bold text-xs">{mermaItemToBaja.name}</span>
                <span>Cantidad: {mermaItemToBaja.quantity} {mermaItemToBaja.um}</span>
                <span>Defecto: {mermaItemToBaja.damagedReason}</span>
              </div>

              <div>
                <label className="text-[11px] font-bold text-on-surface-variant block mb-1">
                  Motivo / Justificación de la Baja:
                </label>
                <input
                  type="text"
                  value={bajaNote}
                  onChange={(e) => setBajaNote(e.target.value)}
                  placeholder="Ej: Inutilizable, daño estructural irreparable..."
                  className="w-full h-9 px-3 rounded-xl bg-surface neo-raised text-xs text-on-surface outline-none focus:ring-1 focus:ring-red-500"
                  autoFocus
                />
              </div>

              <p className="text-[11px] text-on-surface-variant">
                Esta acción registrará la baja definitiva del artículo en el almacén de merma. No pasará al stock comercial de venta.
              </p>
            </div>

            <div className="p-4 border-t border-outline-variant/15 flex justify-end gap-2 bg-surface-container-low/20">
              <button
                onClick={() => setMermaItemToBaja(null)}
                className="px-4 py-2 rounded-xl bg-surface neo-raised text-xs font-semibold text-on-surface-variant hover:text-on-surface cursor-pointer"
                type="button"
              >
                Cancelar
              </button>
              <button
                onClick={async () => {
                  const success = await darDeBajaMermaItem(mermaItemToBaja.id, bajaNote.trim() || undefined);
                  if (success) setMermaItemToBaja(null);
                }}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-md cursor-pointer"
                type="button"
              >
                Confirmar Baja
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
