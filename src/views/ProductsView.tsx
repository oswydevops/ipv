import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Product } from '../types';

const PRODUCT_CATEGORIES = [
  'Herramientas manuales',
  'Herramientas eléctricas',
  'Tornillería y fijaciones',
  'Electricidad e iluminación',
  'Plomería y gasfitería',
  'Pinturas y accesorios',
  'Adhesivos y selladores',
  'Cerrajería y herrajes',
  'Construcción y obra',
  'Jardinería y exteriores',
  'Seguridad y protección (EPIs)',
] as const;

const getCategoryBadgeClass = (category: string) => {
  switch (category) {
    case 'Herramientas manuales':
      return 'bg-amber-100 text-amber-800';
    case 'Herramientas eléctricas':
      return 'bg-orange-100 text-orange-800';
    case 'Tornillería y fijaciones':
      return 'bg-indigo-100 text-indigo-700';
    case 'Electricidad e iluminación':
      return 'bg-yellow-100 text-yellow-800';
    case 'Plomería y gasfitería':
      return 'bg-blue-100 text-blue-700';
    case 'Pinturas y accesorios':
      return 'bg-emerald-100 text-emerald-800';
    case 'Adhesivos y selladores':
      return 'bg-violet-100 text-violet-700';
    case 'Cerrajería y herrajes':
      return 'bg-stone-100 text-stone-700';
    case 'Construcción y obra':
      return 'bg-red-100 text-red-700';
    case 'Jardinería y exteriores':
      return 'bg-green-100 text-green-700';
    case 'Seguridad y protección (EPIs)':
      return 'bg-cyan-100 text-cyan-700';
    default:
      return 'bg-surface-container-high text-on-surface';
  }
};

export const ProductsView: React.FC = () => {
  const {
    products,
    addProduct,
    editProduct,
    deleteProduct,
    selectedProductId,
    setSelectedProductId,
    openSaleModal,
    showToast,
  } = useApp();

  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 6;

  // New product form state
  const [newCode, setNewCode] = useState('');
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState<string>(PRODUCT_CATEGORIES[0]);
  const [newUM, setNewUM] = useState('Unidad');
  const [newPrice, setNewPrice] = useState<number>(0);
  const [newStock, setNewStock] = useState<number>(10);
  const [newMinStock, setNewMinStock] = useState<number>(5);
  const [newAlmacenStock, setNewAlmacenStock] = useState<number>(0);
  const [newLocation, setNewLocation] = useState('Almacén Central');

  // Edit product form state
  const [editCode, setEditCode] = useState('');
  const [editName, setEditName] = useState('');
  const [editCategory, setEditCategory] = useState<string>(PRODUCT_CATEGORIES[0]);
  const [editUM, setEditUM] = useState('Unidad');
  const [editPrice, setEditPrice] = useState<number>(0);
  const [editStock, setEditStock] = useState<number>(0);
  const [editMinStock, setEditMinStock] = useState<number>(0);
  const [editAlmacenStock, setEditAlmacenStock] = useState<number>(0);
  const [editLocation, setEditLocation] = useState('');

  const zeroCount = products.filter((p) => p.stock === 0).length;
  const lowCount = products.filter((p) => p.stock > 0 && p.stock <= p.minStock).length;

  const totalPages = Math.max(1, Math.ceil(products.length / pageSize));
  const validPage = Math.min(currentPage, totalPages);
  const paginatedProducts = products.slice((validPage - 1) * pageSize, validPage * pageSize);
  const startIdx = products.length === 0 ? 0 : (validPage - 1) * pageSize + 1;
  const endIdx = Math.min(validPage * pageSize, products.length);

  // Currently selected product for Ficha Técnica (only if explicitly selected)
  const selectedProduct = selectedProductId
    ? products.find((p) => p.id === selectedProductId) || null
    : null;

  // Helper to generate the next sequential product code automatically
  const generateNextProductCode = (currentProducts: Product[]): string => {
    const existingCodes = new Set(currentProducts.map((p) => p.code.trim().toUpperCase()));
    let maxNum = 0;
    for (const p of currentProducts) {
      const match = p.code.match(/PROD-(\d+)/i);
      if (match) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > maxNum) {
          maxNum = num;
        }
      }
    }
    let nextNum = maxNum > 0 ? maxNum + 1 : currentProducts.length + 1;
    let candidate = `PROD-${String(nextNum).padStart(3, '0')}`;
    while (existingCodes.has(candidate.toUpperCase())) {
      nextNum++;
      candidate = `PROD-${String(nextNum).padStart(3, '0')}`;
    }
    return candidate;
  };

  const handleOpenNewModal = () => {
    const autoCode = generateNextProductCode(products);
    setNewCode(autoCode);
    setNewName('');
    setNewCategory(PRODUCT_CATEGORIES[0]);
    setNewUM('Unidad');
    setNewPrice(0);
    setNewStock(10);
    setNewMinStock(5);
    setNewAlmacenStock(0);
    setNewLocation('Almacén Central');
    setIsNewModalOpen(true);
  };

  const handleSaveProduct = async () => {
    if (!newName.trim()) {
      showToast('Error', 'El nombre del producto no puede estar vacío.', 'error');
      return;
    }
    // Product code is automatically generated upon adding the product
    const finalCode = newCode || generateNextProductCode(products);
    const status = newStock === 0 ? 'out' : newStock <= newMinStock ? 'low' : 'ok';
    const now = new Date();
    const formattedDate =
      now.toLocaleDateString('es-CU', { day: '2-digit', month: '2-digit', year: 'numeric' }) +
      ' • ' +
      now.toLocaleTimeString('es-CU', { hour: '2-digit', minute: '2-digit' }) +
      ' hrs';

    const success = await addProduct({
      code: finalCode,
      name: newName.trim(),
      detail: `${newCategory} • Grado Profesional`,
      category: newCategory,
      um: newUM,
      price: Number(newPrice) || 0,
      stock: Number(newStock) || 0,
      minStock: Number(newMinStock) || 0,
      almacenStock: Number(newAlmacenStock) || 0,
      status,
      rotation: 'Normal (15 u)',
      location: newLocation.trim() || 'Almacén Central',
      lastExit: 'Hoy',
      createdAt: formattedDate,
    });
    if (success) {
      setIsNewModalOpen(false);
    }
  };

  const handleOpenEdit = (product: Product, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingProduct(product);
    setEditCode(product.code);
    setEditName(product.name);
    setEditCategory(product.category);
    setEditUM(product.um);
    setEditPrice(product.price);
    setEditStock(product.stock);
    setEditMinStock(product.minStock);
    setEditAlmacenStock(product.almacenStock || 0);
    setEditLocation(product.location || 'Almacén Central');
  };

  const handleSaveEdit = async () => {
    if (!editingProduct) return;
    if (!editName.trim()) {
      showToast('Error', 'El nombre no puede estar vacío.', 'error');
      return;
    }
    const stockNum = Number(editStock) || 0;
    const minStockNum = Number(editMinStock) || 0;
    const newStatus = stockNum === 0 ? 'out' : stockNum <= minStockNum ? 'low' : 'ok';

    const success = await editProduct(editingProduct.id, {
      code: editCode.trim() || editingProduct.code,
      name: editName.trim(),
      category: editCategory,
      um: editUM,
      price: Number(editPrice) || 0,
      stock: stockNum,
      minStock: minStockNum,
      almacenStock: Number(editAlmacenStock) || 0,
      status: newStatus,
      location: editLocation.trim(),
    });
    if (success) {
      setEditingProduct(null);
    }
  };

  const handleOpenDelete = (product: Product, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setDeletingProduct(product);
  };

  const handleConfirmDelete = async () => {
    if (deletingProduct) {
      const success = await deleteProduct(deletingProduct.id);
      if (success) {
        setDeletingProduct(null);
      }
    }
  };

  return (
    <div className="flex flex-col w-full gap-7 select-none pb-12">
      {/* Header section without Gestion de Almacen badge and without Excel/Export buttons */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-2xl lg:text-3xl font-headline font-semibold text-on-surface tracking-tight">
            Catálogo Maestro de Productos
          </h1>
          <p className="text-xs lg:text-sm text-on-surface-variant max-w-2xl leading-relaxed">
            Gestión de existencias base, categorización, precios oficiales en CUP y umbrales de stock mínimo de seguridad.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleOpenNewModal}
            className="h-10 px-5 rounded-xl bg-primary text-white flex items-center gap-2 text-xs font-semibold shadow-md shadow-primary/20 hover:bg-primary-container transition-all cursor-pointer"
            type="button"
          >
            <span className="material-symbols-outlined text-[18px]">add_circle</span>
            <span>+ Nuevo Producto</span>
          </button>
        </div>
      </div>

      {/* 4 Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-surface neo-raised flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-surface neo-inset flex items-center justify-center text-primary">
            <span className="material-symbols-outlined text-[24px]">inventory_2</span>
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider">
              Total Productos
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-headline font-bold text-on-surface font-mono">
                {products.length}
              </span>
              <span className="text-[11px] text-primary font-medium">activos</span>
            </div>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-surface neo-raised flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-surface neo-inset flex items-center justify-center text-tertiary">
            <span className="material-symbols-outlined text-[24px]">category</span>
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider">
              Categorías
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-headline font-bold text-on-surface font-mono">
                {Array.from(new Set(products.map((p) => p.category))).length}
              </span>
              <span className="text-[11px] text-on-surface-variant">familias</span>
            </div>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-surface neo-raised flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-surface neo-inset flex items-center justify-center text-amber-500">
            <span className="material-symbols-outlined text-[24px]">warning</span>
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider">
              Stock Bajo
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-headline font-bold text-on-surface font-mono">{lowCount}</span>
              <span className="text-[11px] text-amber-600 font-medium">en alerta</span>
            </div>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-surface neo-raised flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-surface neo-inset flex items-center justify-center text-error">
            <span className="material-symbols-outlined text-[24px]">remove_shopping_cart</span>
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider">
              Agotados
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-headline font-bold text-on-surface font-mono">{zeroCount}</span>
              <span className="text-[11px] text-error font-medium">urgente</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Layout: Products Table & Dynamic Ficha Técnica (appears only when a product is selected) */}
      <div className={`grid grid-cols-1 ${selectedProduct ? 'xl:grid-cols-12' : ''} gap-6 items-start`}>
        {/* Products Table (8 cols if Ficha is open, full width if no selection) */}
        <div className={`${selectedProduct ? 'xl:col-span-8' : 'w-full'} flex flex-col gap-4`}>
          <div className="rounded-2xl bg-surface neo-raised p-2 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-on-surface-variant/80 uppercase text-[10px] font-semibold tracking-wider">
                    <th className="py-3 px-4">Código</th>
                    <th className="py-3 px-4">Producto / Detalle</th>
                    <th className="py-3 px-3">Categoría</th>
                    <th className="py-3 px-3 text-center">U/M</th>
                    <th className="py-3 px-4 text-right">Precio CUP</th>
                    <th className="py-3 px-4 text-center">Stock</th>
                    <th className="py-3 px-3 text-center">Almacén</th>
                    <th className="py-3 px-4 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y-0 text-on-surface">
                  {paginatedProducts.map((p) => {
                    const isSelected = selectedProductId === p.id;
                    const isZero = p.stock === 0;
                    const isLow = p.stock > 0 && p.stock <= p.minStock;

                    return (
                      <tr
                        key={p.id}
                        onClick={() => setSelectedProductId(isSelected ? null : p.id)}
                        className={`group rounded-xl transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-primary/10 neo-inset ring-1 ring-primary/30'
                            : 'hover:bg-surface-container-low'
                        }`}
                        title="Haga clic para ver la Ficha Técnica"
                      >
                        <td className="py-3 px-4 font-mono font-medium text-primary">
                          <span className="px-2 py-1 rounded-lg bg-surface neo-inset font-bold">
                            {p.code}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-semibold text-on-surface group-hover:text-primary transition-colors">
                            {p.name}
                          </div>
                          <div className="text-[10px] text-on-surface-variant">{p.detail}</div>
                        </td>
                        <td className="py-3 px-3">
                          <span
                            className={`px-2.5 py-1 rounded-full text-[10px] font-semibold ${getCategoryBadgeClass(p.category)}`}
                          >
                            {p.category}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center font-mono text-on-surface-variant">
                          {p.um}
                        </td>
                        <td className="py-3 px-4 text-right font-headline font-semibold text-on-surface font-mono">
                          ${p.price.toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {isZero ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-red-100 text-red-700">
                              <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>0 (Agotado)
                            </span>
                          ) : isLow ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-800">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                              {p.stock} (Bajo)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-700">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                              {p.stock}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-center font-mono">
                          <span
                            className={`px-2 py-0.5 rounded-lg text-xs font-bold ${
                              (p.almacenStock || 0) > 0
                                ? 'bg-blue-50 text-blue-700'
                                : 'text-on-surface-variant opacity-60 bg-surface neo-inset'
                            }`}
                          >
                            {p.almacenStock || 0}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={(e) => handleOpenEdit(p, e)}
                              className="w-8 h-8 rounded-lg bg-surface neo-raised flex items-center justify-center text-on-surface-variant hover:text-primary transition-all active:neo-inset cursor-pointer"
                              title="Editar producto"
                              type="button"
                            >
                              <span className="material-symbols-outlined text-[16px]">edit</span>
                            </button>
                            <button
                              onClick={(e) => handleOpenDelete(p, e)}
                              className="w-8 h-8 rounded-lg bg-surface neo-raised flex items-center justify-center text-on-surface-variant hover:text-error transition-all active:neo-inset cursor-pointer"
                              title="Eliminar producto"
                              type="button"
                            >
                              <span className="material-symbols-outlined text-[16px]">delete</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination footer */}
            <div className="p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-on-surface-variant border-t border-outline-variant/15">
              <div className="flex items-center gap-2">
                <span>
                  Mostrando <strong className="text-on-surface">{startIdx} a {endIdx}</strong> de{' '}
                  <strong className="text-on-surface">{products.length}</strong> productos
                </span>
                <span className="hidden md:inline text-[10px] px-2 py-0.5 rounded bg-surface neo-inset font-semibold">
                  Pág {validPage} de {totalPages}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(Math.max(1, validPage - 1))}
                  className={`w-8 h-8 rounded-lg bg-surface neo-raised flex items-center justify-center transition-all ${
                    validPage === 1
                      ? 'text-on-surface-variant opacity-40 cursor-not-allowed'
                      : 'text-on-surface-variant hover:text-primary active:neo-inset cursor-pointer'
                  }`}
                  type="button"
                  disabled={validPage === 1}
                  title="Página anterior"
                >
                  <span className="material-symbols-outlined text-[18px]">chevron_left</span>
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`w-8 h-8 rounded-lg flex items-center justify-center font-semibold text-xs transition-all cursor-pointer ${
                      validPage === pageNum
                        ? 'bg-surface neo-inset text-primary font-bold'
                        : 'bg-surface neo-raised text-on-surface-variant hover:text-on-surface active:neo-inset'
                    }`}
                    type="button"
                  >
                    {pageNum}
                  </button>
                ))}
                <button
                  onClick={() => setCurrentPage(Math.min(totalPages, validPage + 1))}
                  className={`w-8 h-8 rounded-lg bg-surface neo-raised flex items-center justify-center transition-all ${
                    validPage === totalPages
                      ? 'text-on-surface-variant opacity-40 cursor-not-allowed'
                      : 'text-on-surface-variant hover:text-primary active:neo-inset cursor-pointer'
                  }`}
                  type="button"
                  disabled={validPage === totalPages}
                  title="Página siguiente"
                >
                  <span className="material-symbols-outlined text-[18px]">chevron_right</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Ficha Técnica: ONLY renders when a product is selected */}
        {selectedProduct && (
          <div className="xl:col-span-4 flex flex-col gap-5">
            <div className="p-6 rounded-2xl bg-surface neo-raised flex flex-col gap-5 relative">
              {/* Header of Ficha with Close button */}
              <div className="flex items-start justify-between">
                <div className="flex flex-col">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-on-surface-variant">
                    Ficha Técnica del Producto
                  </span>
                  <span className="text-sm font-headline font-bold text-primary">
                    {selectedProduct.code}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${
                      selectedProduct.stock === 0
                        ? 'bg-red-100 text-red-700'
                        : selectedProduct.stock <= selectedProduct.minStock
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-emerald-100 text-emerald-700'
                    }`}
                  >
                    {selectedProduct.stock === 0
                      ? 'Agotado'
                      : selectedProduct.stock <= selectedProduct.minStock
                      ? 'Bajo stock'
                      : 'En stock'}
                  </span>
                  <button
                    onClick={() => setSelectedProductId(null)}
                    className="w-7 h-7 rounded-lg bg-surface neo-raised flex items-center justify-center text-on-surface-variant hover:text-error active:neo-inset cursor-pointer"
                    title="Cerrar ficha técnica"
                    type="button"
                  >
                    <span className="material-symbols-outlined text-[16px]">close</span>
                  </button>
                </div>
              </div>

              {/* Main product presentation */}
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-xl bg-surface neo-inset flex items-center justify-center text-primary shrink-0">
                  <span className="material-symbols-outlined text-[32px]">inventory</span>
                </div>
                <div className="flex flex-col min-w-0">
                  <h3 className="font-headline font-semibold text-base text-on-surface leading-snug">
                    {selectedProduct.name}
                  </h3>
                  <span className="text-xs text-on-surface-variant mt-0.5">
                    Familia: {selectedProduct.category}
                  </span>
                  <span className="text-[11px] text-on-surface-variant/80 mt-0.5">
                    {selectedProduct.detail}
                  </span>
                </div>
              </div>

              {/* 4 Stats Grid */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="p-3 rounded-xl bg-surface neo-inset flex flex-col">
                  <span className="text-[10px] text-on-surface-variant uppercase font-medium">Precio Venta</span>
                  <span className="text-base font-headline font-bold text-on-surface font-mono">
                    ${selectedProduct.price.toFixed(2)} CUP
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-surface neo-inset flex flex-col">
                  <span className="text-[10px] text-on-surface-variant uppercase font-medium">Existencia Real</span>
                  <span
                    className={`text-base font-headline font-bold font-mono ${
                      selectedProduct.stock === 0
                        ? 'text-error'
                        : selectedProduct.stock <= selectedProduct.minStock
                        ? 'text-amber-600'
                        : 'text-emerald-600'
                    }`}
                  >
                    {selectedProduct.stock} {selectedProduct.um}s
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-surface neo-inset flex flex-col">
                  <span className="text-[10px] text-on-surface-variant uppercase font-medium">En Almacén</span>
                  <span className="text-base font-headline font-bold text-primary font-mono">
                    {selectedProduct.almacenStock || 0} {selectedProduct.um}s
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-surface neo-inset flex flex-col">
                  <span className="text-[10px] text-on-surface-variant uppercase font-medium">Rotación (30d)</span>
                  <span className="text-base font-headline font-bold text-on-surface font-mono">
                    {selectedProduct.rotation || 'Normal (25 u)'}
                  </span>
                </div>
              </div>

              {/* Ubicación en Almacén */}
              <div className="p-3 rounded-xl bg-surface neo-inset flex items-center justify-between text-xs">
                <span className="text-[10px] text-on-surface-variant uppercase font-medium flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[15px] text-primary">location_on</span>
                  Ubicación en Almacén
                </span>
                <span className="font-semibold text-on-surface truncate">
                  {selectedProduct.location || 'Almacén Central'}
                </span>
              </div>

              {/* Requirement 7: Fecha y Hora en que se agregó */}
              <div className="p-3.5 rounded-xl bg-surface neo-inset flex items-center justify-between text-xs border border-primary/15">
                <div className="flex items-center gap-2 text-on-surface-variant">
                  <span className="material-symbols-outlined text-[18px] text-primary">schedule</span>
                  <span className="font-medium">Fecha y hora de registro:</span>
                </div>
                <span className="font-mono font-bold text-on-surface text-[11px]">
                  {selectedProduct.createdAt || 'Reciente'}
                </span>
              </div>

              {/* Quick Sell from Technical Sheet */}
              <button
                onClick={() => openSaleModal(selectedProduct)}
                disabled={selectedProduct.stock <= 0}
                className={`w-full py-3 px-4 rounded-xl text-white font-headline font-bold text-xs flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer ${
                  selectedProduct.stock <= 0
                    ? 'bg-outline-variant/60 opacity-50 cursor-not-allowed'
                    : 'bg-primary hover:bg-primary-container shadow-primary/25 active:scale-[0.99]'
                }`}
                type="button"
              >
                <span className="material-symbols-outlined text-[18px]">point_of_sale</span>
                <span>
                  {selectedProduct.stock <= 0
                    ? 'Sin existencias para vender'
                    : '⚡ Vender este producto [Cobro Rápido]'}
                </span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal "+ Nuevo Producto" */}
      {isNewModalOpen && (
        <div className="fixed inset-0 bg-inverse-surface/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface rounded-2xl p-6 neo-raised w-full max-w-lg flex flex-col gap-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-surface neo-inset flex items-center justify-center text-primary">
                  <span className="material-symbols-outlined text-[20px]">add_box</span>
                </div>
                <div>
                  <h2 className="text-base font-headline font-bold text-on-surface">
                    Nuevo Producto en Catálogo
                  </h2>
                  <p className="text-[11px] text-on-surface-variant">
                    Asigne código interno y valores oficiales en CUP
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsNewModalOpen(false)}
                className="w-8 h-8 rounded-lg bg-surface neo-raised flex items-center justify-center text-on-surface-variant hover:text-on-surface active:neo-inset cursor-pointer"
                type="button"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="flex flex-col gap-1.5">
                <label className="font-semibold text-on-surface">Código de Producto</label>
                <div className="h-10 px-3 rounded-xl bg-surface neo-inset flex items-center justify-between border border-primary/25">
                  <span className="font-mono text-primary font-bold text-sm tracking-wide">
                    {newCode || 'PROD-AUTO'}
                  </span>
                  <span className="material-symbols-outlined text-primary/70 text-[18px]">
                    lock
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="font-semibold text-on-surface">Categoría</label>
                <div className="h-10 px-3 rounded-xl bg-surface neo-inset flex items-center">
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="bg-transparent border-none outline-none w-full text-on-surface cursor-pointer text-xs"
                  >
                    {PRODUCT_CATEGORIES.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="col-span-2 flex flex-col gap-1.5">
                <label className="font-semibold text-on-surface">
                  Descripción / Nombre Comercial
                </label>
                <div className="h-10 px-3 rounded-xl bg-surface neo-inset flex items-center">
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Ej: Válvula Check 3/4 horizontal de bronce"
                    className="bg-transparent border-none outline-none text-on-surface w-full font-medium text-xs"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="font-semibold text-on-surface">Unidad de Medida (U/M)</label>
                <div className="h-10 px-3 rounded-xl bg-surface neo-inset flex items-center">
                  <select
                    value={newUM}
                    onChange={(e) => setNewUM(e.target.value)}
                    className="bg-transparent border-none outline-none w-full text-on-surface cursor-pointer text-xs"
                  >
                    <option>Unidad</option>
                    <option>Metro</option>
                    <option>Rollo</option>
                    <option>Pieza</option>
                    <option>Caja</option>
                    <option>Galón</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="font-semibold text-on-surface">Precio Oficial (CUP)</label>
                <div className="h-10 px-3 rounded-xl bg-surface neo-inset flex items-center">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={newPrice || ''}
                    onChange={(e) => setNewPrice(parseFloat(e.target.value) || 0)}
                    placeholder="0.00"
                    className="bg-transparent border-none outline-none text-on-surface w-full font-headline font-semibold font-mono text-xs"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="font-semibold text-on-surface">Stock Inicial (Mostrador)</label>
                <div className="h-10 px-3 rounded-xl bg-surface neo-inset flex items-center">
                  <input
                    type="number"
                    min="0"
                    value={newStock}
                    onChange={(e) => setNewStock(parseInt(e.target.value) || 0)}
                    placeholder="En mostrador"
                    className="bg-transparent border-none outline-none text-on-surface w-full font-mono font-bold text-xs"
                  />
                </div>
                <span className="text-[10px] text-on-surface-variant">
                  Existencias que tendrá en ese momento en mostrador
                </span>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="font-semibold text-on-surface">Almacén</label>
                <div className="h-10 px-3 rounded-xl bg-surface neo-inset flex items-center">
                  <input
                    type="number"
                    min="0"
                    value={newAlmacenStock}
                    onChange={(e) => setNewAlmacenStock(parseInt(e.target.value) || 0)}
                    placeholder="Resto en almacén"
                    className="bg-transparent border-none outline-none text-on-surface w-full font-mono font-bold text-xs"
                  />
                </div>
                <span className="text-[10px] text-on-surface-variant">
                  Resto que aún no ha sacado al mostrador
                </span>
              </div>

              <div className="col-span-2 flex flex-col gap-1.5">
                <label className="font-semibold text-on-surface">Ubicación en Almacén</label>
                <div className="h-10 px-3 rounded-xl bg-surface neo-inset flex items-center">
                  <input
                    type="text"
                    value={newLocation}
                    onChange={(e) => setNewLocation(e.target.value)}
                    placeholder="Ej: Almacén Central • Estante B-4"
                    className="bg-transparent border-none outline-none text-on-surface w-full text-xs"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setIsNewModalOpen(false)}
                className="h-10 px-4 rounded-xl bg-surface neo-raised text-xs font-semibold text-on-surface-variant hover:text-on-surface active:neo-inset cursor-pointer"
                type="button"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveProduct}
                className="h-10 px-5 rounded-xl bg-primary text-white text-xs font-semibold hover:bg-primary-container active:neo-inset transition-all cursor-pointer"
                type="button"
              >
                Guardar Producto
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal "Editar Producto" */}
      {editingProduct && (
        <div className="fixed inset-0 bg-inverse-surface/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface rounded-2xl p-6 neo-raised w-full max-w-lg flex flex-col gap-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-surface neo-inset flex items-center justify-center text-primary">
                  <span className="material-symbols-outlined text-[20px]">edit_note</span>
                </div>
                <div>
                  <h2 className="text-base font-headline font-bold text-on-surface">
                    Editar Producto
                  </h2>
                  <p className="text-[11px] text-on-surface-variant">
                    Modifique los parámetros y existencias del producto
                  </p>
                </div>
              </div>
              <button
                onClick={() => setEditingProduct(null)}
                className="w-8 h-8 rounded-lg bg-surface neo-raised flex items-center justify-center text-on-surface-variant hover:text-on-surface active:neo-inset cursor-pointer"
                type="button"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="flex flex-col gap-1.5">
                <label className="font-semibold text-on-surface">Código Único</label>
                <div className="h-10 px-3 rounded-xl bg-surface neo-inset flex items-center justify-between">
                  <span className="font-mono text-primary font-bold text-sm tracking-wide">{editCode}</span>
                  <span className="material-symbols-outlined text-on-surface-variant/50 text-[18px]">lock</span>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="font-semibold text-on-surface">Categoría</label>
                <div className="h-10 px-3 rounded-xl bg-surface neo-inset flex items-center">
                  <select
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value)}
                    className="bg-transparent border-none outline-none w-full text-on-surface cursor-pointer"
                  >
                    {PRODUCT_CATEGORIES.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="col-span-2 flex flex-col gap-1.5">
                <label className="font-semibold text-on-surface">
                  Descripción / Nombre Comercial
                </label>
                <div className="h-10 px-3 rounded-xl bg-surface neo-inset flex items-center">
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="bg-transparent border-none outline-none text-on-surface w-full font-medium"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="font-semibold text-on-surface">Unidad de Medida (U/M)</label>
                <div className="h-10 px-3 rounded-xl bg-surface neo-inset flex items-center">
                  <select
                    value={editUM}
                    onChange={(e) => setEditUM(e.target.value)}
                    className="bg-transparent border-none outline-none w-full text-on-surface cursor-pointer"
                  >
                    <option>Unidad</option>
                    <option>Metro</option>
                    <option>Rollo</option>
                    <option>Pieza</option>
                    <option>Caja</option>
                    <option>Galón</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="font-semibold text-on-surface">Precio Oficial (CUP)</label>
                <div className="h-10 px-3 rounded-xl bg-surface neo-inset flex items-center">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={editPrice}
                    onChange={(e) => setEditPrice(parseFloat(e.target.value) || 0)}
                    className="bg-transparent border-none outline-none text-on-surface w-full font-headline font-semibold font-mono"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="font-semibold text-on-surface">Mostrador</label>
                <div className="h-10 px-3 rounded-xl bg-surface neo-inset flex items-center">
                  <input
                    type="number"
                    min="0"
                    value={editStock}
                    onChange={(e) => setEditStock(parseInt(e.target.value) || 0)}
                    className="bg-transparent border-none outline-none text-on-surface w-full font-mono font-bold text-xs"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="font-semibold text-on-surface">Almacén</label>
                <div className="h-10 px-3 rounded-xl bg-surface neo-inset flex items-center">
                  <input
                    type="number"
                    min="0"
                    value={editAlmacenStock}
                    onChange={(e) => setEditAlmacenStock(parseInt(e.target.value) || 0)}
                    className="bg-transparent border-none outline-none text-on-surface w-full font-mono font-bold text-xs"
                  />
                </div>
              </div>

              <div className="col-span-2 flex flex-col gap-1.5">
                <label className="font-semibold text-on-surface">Ubicación en Almacén</label>
                <div className="h-10 px-3 rounded-xl bg-surface neo-inset flex items-center">
                  <input
                    type="text"
                    value={editLocation}
                    onChange={(e) => setEditLocation(e.target.value)}
                    placeholder="Ej: Almacén Central • Estante B-4"
                    className="bg-transparent border-none outline-none text-on-surface w-full text-xs"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setEditingProduct(null)}
                className="h-10 px-4 rounded-xl bg-surface neo-raised text-xs font-semibold text-on-surface-variant hover:text-on-surface active:neo-inset cursor-pointer"
                type="button"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveEdit}
                className="h-10 px-5 rounded-xl bg-primary text-white text-xs font-semibold hover:bg-primary-container active:neo-inset transition-all cursor-pointer"
                type="button"
              >
                Guardar Cambios
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Confirmación de Eliminación */}
      {deletingProduct && (
        <div className="fixed inset-0 bg-inverse-surface/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface rounded-2xl p-6 neo-raised w-full max-w-md flex flex-col gap-4 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-100 text-error flex items-center justify-center">
                <span className="material-symbols-outlined text-[24px]">delete</span>
              </div>
              <div>
                <h3 className="font-headline font-bold text-base text-on-surface">
                  ¿Eliminar Producto?
                </h3>
                <span className="text-xs text-on-surface-variant font-mono">
                  {deletingProduct.code}
                </span>
              </div>
            </div>

            <p className="text-xs text-on-surface-variant leading-relaxed">
              Está a punto de eliminar el producto{' '}
              <strong className="text-on-surface">"{deletingProduct.name}"</strong>.
              El producto será retirado del catálogo activo de existencias. ¿Desea confirmar la eliminación?
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setDeletingProduct(null)}
                className="h-10 px-4 rounded-xl bg-surface neo-raised text-xs font-semibold text-on-surface-variant hover:text-on-surface active:neo-inset cursor-pointer"
                type="button"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmDelete}
                className="h-10 px-5 rounded-xl bg-error text-white text-xs font-semibold hover:bg-error-container active:neo-inset transition-all cursor-pointer"
                type="button"
              >
                Sí, Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
