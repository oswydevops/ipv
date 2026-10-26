import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { Product } from '../types';

interface CartItem {
  product: Product;
  quantity: number;
}

export const SaleModal: React.FC = () => {
  const {
    isSaleModalOpen,
    closeSaleModal,
    preselectedProductForSale,
    products,
    recordSale,
    sales,
    cancelSale,
    totalVentasEfectivo,
    totalVentasTransferencia,
    ipvTotalVendido,
    isCurrentDayClosed,
    isViewingPastDate,
  } = useApp();

  const [activeTab, setActiveTab] = useState<'nueva' | 'historial'>('nueva');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [paymentMethod, setPaymentMethod] = useState<'efectivo' | 'transferencia' | 'mixto'>('efectivo');
  const [amountReceived, setAmountReceived] = useState<string>('');
  const [transferAmountInput, setTransferAmountInput] = useState<string>('');
  const [saleNote, setSaleNote] = useState('');
  const [lastCompletedSale, setLastCompletedSale] = useState<any | null>(null);
  const [selectedSaleForDetail, setSelectedSaleForDetail] = useState<any | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Play a pleasant offline audio chime when sale is confirmed
  const playCashChime = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = 'sine';
      osc2.type = 'triangle';
      osc1.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc1.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15); // A5

      osc2.frequency.setValueAtTime(880, ctx.currentTime);
      osc2.frequency.exponentialRampToValueAtTime(1174.66, ctx.currentTime + 0.18); // D6

      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start();
      osc2.start();
      osc1.stop(ctx.currentTime + 0.32);
      osc2.stop(ctx.currentTime + 0.32);
    } catch {}
  };

  // Cerrar modal con tecla Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isSaleModalOpen) {
        closeSaleModal();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSaleModalOpen, closeSaleModal]);

  // When modal opens or preselected product is passed
  useEffect(() => {
    if (isSaleModalOpen) {
      setActiveTab('nueva');
      setLastCompletedSale(null);
      if (preselectedProductForSale) {
        setCart([{ product: preselectedProductForSale, quantity: 1 }]);
      } else if (cart.length === 0) {
        setCart([]);
      }
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    }
  }, [isSaleModalOpen, preselectedProductForSale]);

  if (!isSaleModalOpen) return null;

  const formatCUP = (val: number) => {
    return Number(val).toLocaleString('es-CU', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  // Cart operations
  const addToCart = (product: Product) => {
    if (product.stock <= 0) return;
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        if (existing.quantity >= product.stock) return prev;
        return prev.map((item) =>
          item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const updateQuantity = (productId: string, newQty: number) => {
    if (newQty <= 0) {
      removeFromCart(productId);
      return;
    }
    setCart((prev) =>
      prev.map((item) => {
        if (item.product.id === productId) {
          const max = item.product.stock;
          return { ...item, quantity: Math.min(newQty, max) };
        }
        return item;
      })
    );
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const clearCart = () => {
    setCart([]);
    setAmountReceived('');
    setTransferAmountInput('');
    setSaleNote('');
  };

  // Calculations
  const totalSale = cart.reduce((acc, item) => acc + item.product.price * item.quantity, 0);

  const numReceived = parseFloat(amountReceived) || 0;
  const numTransfer = parseFloat(transferAmountInput) || 0;

  let cashToPay = 0;
  let transferToPay = 0;
  let changeDue = 0;

  if (paymentMethod === 'efectivo') {
    cashToPay = totalSale;
    transferToPay = 0;
    changeDue = Math.max(0, numReceived - totalSale);
  } else if (paymentMethod === 'transferencia') {
    cashToPay = 0;
    transferToPay = totalSale;
    changeDue = 0;
  } else if (paymentMethod === 'mixto') {
    transferToPay = Math.min(totalSale, numTransfer);
    cashToPay = Math.max(0, totalSale - transferToPay);
    changeDue = Math.max(0, numReceived - cashToPay);
  }

  // Filter products for left column
  const filteredProducts = products.filter((p) => {
    if (selectedCategory !== 'all' && p.category !== selectedCategory) return false;
    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      p.code.toLowerCase().includes(q) ||
      (p.detail && p.detail.toLowerCase().includes(q))
    );
  });

  const categories = ['all', ...Array.from(new Set(products.map((p) => p.category)))];

  // Submit sale
  const handleConfirmSale = async () => {
    if (cart.length === 0 || totalSale <= 0) return;

    const saleItems = cart.map((item) => ({
      productId: item.product.id,
      code: item.product.code,
      name: item.product.name,
      productCode: item.product.code,
      productName: item.product.name,
      um: item.product.um,
      unitPrice: item.product.price,
      quantity: item.quantity,
      subtotal: item.product.price * item.quantity,
    }));

    const success = await recordSale({
      items: saleItems,
      paymentMethod,
      efectivoAmount: cashToPay,
      transferenciaAmount: transferToPay,
      amountReceived: paymentMethod === 'efectivo' || paymentMethod === 'mixto' ? numReceived : undefined,
      change: changeDue,
      note: saleNote.trim() || undefined,
    });

    if (success) {
      playCashChime();
      setLastCompletedSale({
        items: saleItems,
        total: totalSale,
        paymentMethod,
        cashToPay,
        transferToPay,
        changeDue,
        timestamp: new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
      });
      clearCart();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-inverse-surface/40 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 select-none">
      <div className="w-full max-w-5xl max-h-[92vh] rounded-3xl bg-surface neo-raised flex flex-col shadow-2xl overflow-hidden border border-outline-variant/20 animate-in fade-in zoom-in-95 duration-150">
        {/* Header Modal Bar */}
        <div className="px-6 py-4 border-b border-outline-variant/20 flex items-center justify-between shrink-0 bg-surface">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-white shadow-md shadow-primary/25">
              <span className="material-symbols-outlined text-[22px]">point_of_sale</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-headline font-bold text-lg text-on-surface">
                  Venta Rápida de Mostrador (TPV)
                </h2>
                <span className="px-2 py-0.5 rounded-md bg-surface neo-inset text-[10px] font-mono font-bold text-primary">
                  100% OFFLINE
                </span>
              </div>
              <p className="text-xs text-on-surface-variant">
                Registra ventas en el IPV del día y clasifica pagos en Efectivo vs Transferencia
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Tabs switcher */}
            <div className="p-1 rounded-xl bg-surface neo-inset flex items-center gap-1">
              <button
                onClick={() => {
                  setActiveTab('nueva');
                  setLastCompletedSale(null);
                }}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'nueva'
                    ? 'bg-primary text-white shadow-sm'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
                type="button"
              >
                🛒 Nueva Venta
              </button>
              <button
                onClick={() => setActiveTab('historial')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'historial'
                    ? 'bg-primary text-white shadow-sm'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
                type="button"
              >
                📋 Ventas de Hoy ({sales.length})
              </button>
            </div>

            <button
              onClick={closeSaleModal}
              className="w-9 h-9 rounded-xl bg-surface neo-raised flex items-center justify-center text-on-surface-variant hover:text-error active:neo-inset transition-all cursor-pointer"
              title="Cerrar ventana [ESC]"
              type="button"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>
        </div>

        {/* Modal Body */}
        {activeTab === 'nueva' ? (
          <div className="flex-1 overflow-y-auto p-5 grid grid-cols-1 lg:grid-cols-12 gap-5 min-h-[460px]">
            {/* LEFT COLUMN: Product Catalog & Search (6 of 12 cols) */}
            <div className="lg:col-span-6 min-w-0 flex flex-col gap-3.5">
              {/* Search Bar */}
              <div className="flex items-center gap-2">
                <div className="flex-1 h-11 px-3.5 rounded-xl bg-surface neo-inset flex items-center gap-2 text-on-surface">
                  <span className="material-symbols-outlined text-primary text-[20px]">search</span>
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Buscar producto, código (PLM, PVC...) o código de barras..."
                    className="bg-transparent text-xs w-full focus:outline-none placeholder:text-on-surface-variant/70 font-medium"
                  />
                  {searchTerm && (
                    <button
                      onClick={() => setSearchTerm('')}
                      className="text-on-surface-variant hover:text-on-surface"
                      type="button"
                    >
                      <span className="material-symbols-outlined text-[16px]">cancel</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Category Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto h-scrollbar pb-2 text-xs">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3 py-1 rounded-lg shrink-0 text-[11px] font-semibold transition-all cursor-pointer ${
                      selectedCategory === cat
                        ? 'bg-surface neo-inset text-primary font-bold'
                        : 'bg-surface neo-raised text-on-surface-variant hover:text-on-surface'
                    }`}
                    type="button"
                  >
                    {cat === 'all' ? 'Todas las categorias' : cat}
                  </button>
                ))}
              </div>

              {/* Products List / Grid */}
              <div className="flex-1 max-h-[360px] overflow-y-auto flex flex-col gap-2 pr-1">
                {filteredProducts.length === 0 ? (
                  <div className="p-8 text-center text-on-surface-variant text-xs flex flex-col items-center gap-2">
                    <span className="material-symbols-outlined text-[36px] text-on-surface-variant/40">
                      inventory_2
                    </span>
                    <span>No se encontraron productos coincidentes.</span>
                  </div>
                ) : (
                  filteredProducts.map((p) => {
                    const isOutOfStock = p.stock <= 0;
                    const inCartItem = cart.find((item) => item.product.id === p.id);
                    const remainingAfterCart = p.stock - (inCartItem ? inCartItem.quantity : 0);

                    return (
                      <div
                        key={p.id}
                        className={`p-3 rounded-xl bg-surface neo-raised flex items-center justify-between gap-3 transition-all ${
                          isOutOfStock ? 'opacity-50' : 'hover:border-primary/30'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-9 h-9 rounded-lg bg-surface neo-inset flex items-center justify-center text-primary shrink-0">
                            <span className="material-symbols-outlined text-[18px]">hardware</span>
                          </div>
                          <div className="flex flex-col min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-on-surface truncate">{p.name}</span>
                              <span className="px-1.5 py-0.2 rounded bg-surface neo-inset text-[9px] font-mono font-bold text-on-surface-variant">
                                {p.code}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 mt-0.5 text-[11px]">
                              <span className="font-mono font-bold text-primary">
                                ${formatCUP(p.price)} CUP
                              </span>
                              <span className="text-on-surface-variant">/ {p.um}</span>
                              <span
                                className={`font-mono text-[10px] font-semibold ${
                                  remainingAfterCart <= 0
                                    ? 'text-error font-bold'
                                    : remainingAfterCart <= p.minStock
                                    ? 'text-amber-600'
                                    : 'text-emerald-600'
                                }`}
                              >
                                {remainingAfterCart > 0 ? `(${remainingAfterCart} disp)` : '(Agotado)'}
                              </span>
                            </div>
                          </div>
                        </div>

                        <button
                          onClick={() => addToCart(p)}
                          disabled={remainingAfterCart <= 0}
                          className={`h-8 px-3 rounded-lg text-xs font-bold flex items-center gap-1 shrink-0 transition-all cursor-pointer ${
                            remainingAfterCart <= 0
                              ? 'bg-surface text-on-surface-variant/40 cursor-not-allowed neo-inset'
                              : 'bg-primary text-white hover:bg-primary-container shadow-sm active:scale-95'
                          }`}
                          type="button"
                        >
                          <span className="material-symbols-outlined text-[16px]">add</span>
                          <span>Agregar</span>
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* RIGHT COLUMN: Current Sale Cart, Payment Method & Confirm (6 of 12 cols) */}
            <div className="lg:col-span-6 flex flex-col gap-4 bg-surface-container-low/40 rounded-2xl p-4.5 border border-outline-variant/15">
              {/* Cart Header */}
              <div className="flex items-center justify-between pb-2 border-b border-outline-variant/20">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-[20px]">shopping_cart</span>
                  <span className="text-xs font-bold text-on-surface uppercase tracking-wider">
                    Ticket de Mostrador ({cart.reduce((a, b) => a + b.quantity, 0)} unidades)
                  </span>
                </div>
                {cart.length > 0 && (
                  <button
                    onClick={clearCart}
                    className="text-[11px] font-semibold text-error hover:underline flex items-center gap-1 cursor-pointer"
                    type="button"
                  >
                    <span className="material-symbols-outlined text-[14px]">delete</span>
                    Vaciar ticket
                  </button>
                )}
              </div>

              {/* Cart Items List */}
              <div className="max-h-[170px] overflow-y-auto flex flex-col gap-2">
                {cart.length === 0 ? (
                  <div className="py-8 text-center text-on-surface-variant text-xs flex flex-col items-center justify-center gap-2">
                    <span className="material-symbols-outlined text-[32px] text-on-surface-variant/30">
                      add_shopping_cart
                    </span>
                    <span>El ticket está vacío. Seleccione productos a la izquierda para comenzar.</span>
                  </div>
                ) : (
                  cart.map((item) => (
                    <div
                      key={item.product.id}
                      className="p-2.5 rounded-xl bg-surface neo-raised flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex flex-col min-w-0 flex-1">
                        <span className="font-bold text-on-surface truncate">{item.product.name}</span>
                        <span className="text-[10px] text-on-surface-variant font-mono">
                          ${formatCUP(item.product.price)} CUP c/u
                        </span>
                      </div>

                      {/* Quantity Controls */}
                      <div className="flex items-center gap-1 bg-surface neo-inset px-2 py-0.5 rounded-lg shrink-0">
                        <button
                          onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                          className="w-5 h-5 rounded flex items-center justify-center font-bold text-on-surface-variant hover:text-error cursor-pointer"
                          type="button"
                        >
                          -
                        </button>
                        <span className="w-6 text-center font-mono font-bold text-xs text-on-surface">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                          disabled={item.quantity >= item.product.stock}
                          className={`w-5 h-5 rounded flex items-center justify-center font-bold text-on-surface-variant hover:text-primary cursor-pointer ${
                            item.quantity >= item.product.stock ? 'opacity-30 cursor-not-allowed' : ''
                          }`}
                          type="button"
                        >
                          +
                        </button>
                      </div>

                      <div className="text-right font-mono font-bold text-on-surface min-w-[70px]">
                        ${formatCUP(item.product.price * item.quantity)}
                      </div>

                      <button
                        onClick={() => removeFromCart(item.product.id)}
                        className="text-on-surface-variant hover:text-error ml-1 cursor-pointer"
                        title="Quitar"
                        type="button"
                      >
                        <span className="material-symbols-outlined text-[16px]">close</span>
                      </button>
                    </div>
                  ))
                )}
              </div>

              {/* Total Hero Block */}
              <div className="p-3.5 rounded-xl bg-surface neo-raised flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                  Total a Cobrar
                </span>
                <div className="flex items-baseline gap-1">
                  <span className="font-headline font-bold text-2xl text-primary font-mono">
                    ${formatCUP(totalSale)}
                  </span>
                  <span className="text-xs font-bold text-primary font-mono">CUP</span>
                </div>
              </div>

              {/* Payment Method Selector */}
              <div className="flex flex-col gap-2">
                <label className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
                  Forma de Cobro del Cliente:
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {/* Option 1: Efectivo */}
                  <button
                    onClick={() => setPaymentMethod('efectivo')}
                    className={`p-2.5 rounded-xl flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                      paymentMethod === 'efectivo'
                        ? 'bg-primary text-white font-bold shadow-md shadow-primary/20 scale-[1.02]'
                        : 'bg-surface neo-raised text-on-surface hover:text-primary'
                    }`}
                    type="button"
                  >
                    <span className="material-symbols-outlined text-[20px]">payments</span>
                    <span className="text-xs">Efectivo</span>
                  </button>

                  {/* Option 2: Transferencia */}
                  <button
                    onClick={() => setPaymentMethod('transferencia')}
                    className={`p-2.5 rounded-xl flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                      paymentMethod === 'transferencia'
                        ? 'bg-primary text-white font-bold shadow-md shadow-primary/20 scale-[1.02]'
                        : 'bg-surface neo-raised text-on-surface hover:text-primary'
                    }`}
                    type="button"
                  >
                    <span className="material-symbols-outlined text-[20px]">qr_code_2</span>
                    <span className="text-xs">Transferencia</span>
                  </button>

                  {/* Option 3: Mixto */}
                  <button
                    onClick={() => setPaymentMethod('mixto')}
                    className={`p-2.5 rounded-xl flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                      paymentMethod === 'mixto'
                        ? 'bg-primary text-white font-bold shadow-md shadow-primary/20 scale-[1.02]'
                        : 'bg-surface neo-raised text-on-surface hover:text-primary'
                    }`}
                    type="button"
                  >
                    <span className="material-symbols-outlined text-[20px]">swap_horiz</span>
                    <span className="text-xs">Mixto</span>
                  </button>
                </div>
              </div>

              {/* Payment Details Form */}
              <div className="p-3 rounded-xl bg-surface neo-inset flex flex-col gap-2 text-xs">
                {paymentMethod === 'efectivo' && (
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-on-surface-variant font-medium">
                        ¿Con cuánto paga el cliente?
                      </span>
                      <div className="flex items-center gap-1 bg-surface neo-raised px-2.5 py-1 rounded-lg">
                        <span className="font-mono text-on-surface-variant font-bold">$</span>
                        <input
                          type="number"
                          min="0"
                          step="10"
                          value={amountReceived}
                          onChange={(e) => setAmountReceived(e.target.value)}
                          placeholder={totalSale.toString()}
                          className="w-24 bg-transparent font-mono font-bold text-xs text-on-surface focus:outline-none text-right"
                        />
                        <span className="text-[10px] font-bold text-primary ml-0.5">CUP</span>
                      </div>
                    </div>
                    {numReceived > 0 && (
                      <div className="flex items-center justify-between pt-1 border-t border-outline-variant/15 text-xs font-semibold">
                        <span className="text-on-surface-variant">Cambio / Vuelto a entregar:</span>
                        <span
                          className={`font-mono font-bold ${
                            changeDue >= 0 ? 'text-emerald-600' : 'text-error'
                          }`}
                        >
                          ${formatCUP(changeDue)} CUP
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {paymentMethod === 'transferencia' && (
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between">
                      <span className="text-on-surface-variant font-medium">Cobro por Transferencia:</span>
                      <span className="font-mono font-bold text-primary">${formatCUP(totalSale)} CUP</span>
                    </div>
                    <p className="text-[10px] text-on-surface-variant mt-0.5">
                      ✓ Se suma automáticamente a <strong>Transferencias en Cierre de Caja</strong> (EnZona / Transfermóvil).
                    </p>
                    <input
                      type="text"
                      value={saleNote}
                      onChange={(e) => setSaleNote(e.target.value)}
                      placeholder="Nro. Transacción / Teléfono (opcional)"
                      className="mt-1 px-2.5 py-1.5 rounded-lg bg-surface neo-raised text-xs text-on-surface focus:outline-none placeholder:text-on-surface-variant/50"
                    />
                  </div>
                )}

                {paymentMethod === 'mixto' && (
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-on-surface-variant font-medium">
                        Parte Transferencia (EnZona / Transfermóvil):
                      </span>
                      <div className="flex items-center gap-1 bg-surface neo-raised px-2 py-0.5 rounded-lg">
                        <span className="font-mono font-bold text-on-surface-variant">$</span>
                        <input
                          type="number"
                          min="0"
                          step="10"
                          value={transferAmountInput}
                          onChange={(e) => setTransferAmountInput(e.target.value)}
                          placeholder="0.00"
                          className="w-20 bg-transparent font-mono font-bold text-xs text-primary focus:outline-none text-right"
                        />
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-on-surface-variant font-medium">
                        Resta en Efectivo:
                      </span>
                      <span className="font-mono font-bold text-on-surface">${formatCUP(cashToPay)} CUP</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Aviso si el día está cerrado */}
              {(isCurrentDayClosed || isViewingPastDate) && (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-900 text-xs flex items-center gap-2">
                  <span className="material-symbols-outlined text-amber-600 text-lg">lock</span>
                  <span>Jornada cerrada. No se pueden registrar ventas hasta reabrir el día.</span>
                </div>
              )}

              {/* Action Button: Confirm and Record Sale */}
              <button
                onClick={handleConfirmSale}
                disabled={cart.length === 0 || totalSale <= 0 || isCurrentDayClosed || isViewingPastDate}
                className={`w-full py-3.5 px-4 rounded-xl text-white font-headline font-bold text-sm flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer ${
                  cart.length === 0 || totalSale <= 0 || isCurrentDayClosed || isViewingPastDate
                    ? 'bg-outline-variant/60 cursor-not-allowed opacity-50'
                    : 'bg-primary hover:bg-primary-container shadow-primary/25 active:scale-[0.99]'
                }`}
                type="button"
              >
                <span className="material-symbols-outlined text-[20px]">check_circle</span>
                <span>
                  Confirmar Cobro · ${formatCUP(totalSale)} CUP
                </span>
              </button>

              {/* Feedback Ticket after sale */}
              {lastCompletedSale && (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-900 flex items-center justify-between text-xs animate-in fade-in">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-emerald-600 text-[20px]">
                      check_circle
                    </span>
                    <div>
                      <span className="font-bold block">¡Venta cobrada y asentada con éxito!</span>
                      <span className="text-[10px] text-emerald-700">
                        {lastCompletedSale.timestamp} · Actualizado en IPV y Cierre de Caja
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => setActiveTab('historial')}
                    className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white font-semibold text-[11px] hover:bg-emerald-700 cursor-pointer"
                    type="button"
                  >
                    Ver Comprobante
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* TAB 2: Historial de Ventas del Día */
          <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-5">
            {/* KPI Summary for Today's Sales */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-2xl bg-surface neo-raised flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-surface neo-inset flex items-center justify-center text-primary">
                  <span className="material-symbols-outlined text-[22px]">receipt_long</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold uppercase text-on-surface-variant">
                    Total Facturado Hoy
                  </span>
                  <span className="font-headline font-bold text-lg text-on-surface font-mono">
                    ${formatCUP(ipvTotalVendido)} CUP
                  </span>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-surface neo-raised flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-surface neo-inset flex items-center justify-center text-emerald-600">
                  <span className="material-symbols-outlined text-[22px]">payments</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold uppercase text-on-surface-variant">
                    Cobradas en Efectivo
                  </span>
                  <span className="font-headline font-bold text-lg text-emerald-600 font-mono">
                    ${formatCUP(totalVentasEfectivo)} CUP
                  </span>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-surface neo-raised flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-surface neo-inset flex items-center justify-center text-primary">
                  <span className="material-symbols-outlined text-[22px]">qr_code_2</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold uppercase text-on-surface-variant">
                    Cobradas por Transferencia
                  </span>
                  <span className="font-headline font-bold text-lg text-primary font-mono">
                    ${formatCUP(totalVentasTransferencia)} CUP
                  </span>
                </div>
              </div>
            </div>

            {/* Sales Table */}
            <div className="rounded-2xl bg-surface neo-raised p-4 overflow-hidden">
              <h3 className="text-xs font-bold text-on-surface uppercase tracking-wider mb-3">
                Registro de Tickets de Venta de la Jornada
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="text-[11px] font-semibold text-on-surface-variant uppercase border-b border-outline-variant/20">
                      <th className="py-2.5 px-3">Ticket</th>
                      <th className="py-2.5 px-3">Hora</th>
                      <th className="py-2.5 px-3">Artículos</th>
                      <th className="py-2.5 px-3 text-center">Método de Pago</th>
                      <th className="py-2.5 px-3 text-right">Monto Total</th>
                      <th className="py-2.5 px-3 text-center">Detalle</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/10">
                    {sales.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-on-surface-variant">
                          No se han registrado ventas en esta sesión.
                        </td>
                      </tr>
                    ) : (
                      sales.map((sale) => (
                        <tr key={sale.id} className="hover:bg-surface-container-low/40 transition-colors">
                          <td className="py-3 px-3 font-mono font-bold text-on-surface">
                            {sale.ticketNumber}
                          </td>
                          <td className="py-3 px-3 text-on-surface-variant font-mono">
                            {sale.timestamp}
                          </td>
                          <td className="py-3 px-3">
                            <div className="flex flex-col">
                              <span className="font-semibold text-on-surface">
                                {sale.items.map((i) => `${i.quantity}x ${i.name}`).join(', ')}
                              </span>
                              {sale.note && (
                                <span className="text-[10px] text-on-surface-variant italic">
                                  Nota: {sale.note}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-3 text-center">
                            {sale.paymentMethod === 'efectivo' ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <span className="material-symbols-outlined text-[13px]">payments</span>
                                Efectivo
                              </span>
                            ) : sale.paymentMethod === 'transferencia' ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-primary/10 text-primary border border-primary/20">
                                <span className="material-symbols-outlined text-[13px]">qr_code_2</span>
                                Transferencia
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                                Mixto (Ef/Tr)
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-right font-mono font-bold text-on-surface">
                            ${formatCUP(sale.total)} CUP
                          </td>
                          <td className="py-3 px-3 text-center">
                            <button
                              onClick={() => setSelectedSaleForDetail(sale)}
                              className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-surface neo-raised text-on-surface hover:text-primary active:neo-inset cursor-pointer inline-flex items-center gap-1 transition-all"
                              title="Ver detalles de la venta"
                              type="button"
                            >
                              <span className="material-symbols-outlined text-[15px]">visibility</span>
                              <span>Detalles</span>
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Modal de Detalle de Ticket / Venta */}
        {selectedSaleForDetail && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="w-full max-w-lg rounded-2xl bg-surface neo-raised border border-outline-variant/20 shadow-2xl overflow-hidden flex flex-col">
              <div className="p-4 border-b border-outline-variant/15 flex items-center justify-between bg-surface-container-low/40">
                <div className="flex items-center gap-2.5">
                  <span className="material-symbols-outlined text-primary text-[22px]">receipt_long</span>
                  <div>
                    <h3 className="text-sm font-bold text-on-surface">
                      Detalle de Ticket #{selectedSaleForDetail.ticketNumber}
                    </h3>
                    <span className="text-[11px] text-on-surface-variant font-mono">
                      {selectedSaleForDetail.date} · {selectedSaleForDetail.timestamp}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedSaleForDetail(null)}
                  className="w-8 h-8 rounded-lg bg-surface neo-raised flex items-center justify-center text-on-surface-variant hover:text-on-surface cursor-pointer"
                  type="button"
                >
                  ✕
                </button>
              </div>

              <div className="p-5 flex flex-col gap-4 text-xs overflow-y-auto max-h-[70vh]">
                <div className="p-3 rounded-xl bg-surface neo-inset flex justify-between items-center">
                  <span className="text-on-surface-variant font-medium">Método de Pago:</span>
                  <span className="font-bold uppercase text-primary font-mono">
                    {selectedSaleForDetail.paymentMethod === 'mixto'
                      ? `Mixto (Ef: $${formatCUP(selectedSaleForDetail.efectivoAmount || 0)} / Tr: $${formatCUP(selectedSaleForDetail.transferenciaAmount || 0)})`
                      : selectedSaleForDetail.paymentMethod}
                  </span>
                </div>

                <div className="flex flex-col gap-2">
                  <span className="font-bold text-on-surface-variant uppercase text-[10px] tracking-wider">
                    Artículos Vendidos:
                  </span>
                  <div className="rounded-xl border border-outline-variant/15 overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-surface-container-low/40 text-[10px] uppercase text-on-surface-variant border-b border-outline-variant/15">
                        <tr>
                          <th className="p-2.5">Producto</th>
                          <th className="p-2.5 text-center">Cant.</th>
                          <th className="p-2.5 text-right">Precio</th>
                          <th className="p-2.5 text-right">Subtotal</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-outline-variant/10">
                        {(selectedSaleForDetail.items || []).map((it: any, idx: number) => (
                          <tr key={idx} className="hover:bg-surface-container-low/20">
                            <td className="p-2.5 font-medium text-on-surface">
                              {it.name || it.productName}
                              <span className="text-[10px] text-on-surface-variant block font-mono">
                                {it.code || it.productCode}
                              </span>
                            </td>
                            <td className="p-2.5 text-center font-mono">
                              {it.quantity} {it.um}
                            </td>
                            <td className="p-2.5 text-right font-mono text-on-surface-variant">
                              ${formatCUP(it.unitPrice)}
                            </td>
                            <td className="p-2.5 text-right font-mono font-bold text-on-surface">
                              ${formatCUP(it.subtotal || it.quantity * it.unitPrice)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {selectedSaleForDetail.note && (
                  <div className="p-2.5 rounded-lg bg-surface-container text-[11px] text-on-surface-variant">
                    <strong>Nota:</strong> {selectedSaleForDetail.note}
                  </div>
                )}

                <div className="p-3 rounded-xl bg-surface neo-raised flex justify-between items-center text-sm font-bold border border-outline-variant/20">
                  <span>Total Facturado:</span>
                  <span className="font-mono text-primary text-base">
                    ${formatCUP(selectedSaleForDetail.total)} CUP
                  </span>
                </div>
              </div>

              <div className="p-4 border-t border-outline-variant/15 flex justify-end gap-2 bg-surface-container-low/20">
                <button
                  onClick={() => setSelectedSaleForDetail(null)}
                  className="px-4 py-2 rounded-xl bg-surface neo-raised text-xs font-semibold text-on-surface hover:text-primary cursor-pointer"
                  type="button"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
