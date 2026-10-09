import React, { createContext, useContext, useState, useMemo, useEffect } from 'react';
import { ViewType, Product, IPVRow, Denomination, BackupRecord, SaleRecord, SaleItem } from '../types';
import {
  INITIAL_PRODUCTS,
  INITIAL_IPV_ROWS,
  INITIAL_DENOMINATIONS,
  INITIAL_BACKUPS,
  INITIAL_SALES,
} from '../data/initialData';

interface ToastData {
  title: string;
  desc: string;
  type?: 'success' | 'info' | 'error';
}

interface RecordSaleInput {
  items: SaleItem[];
  paymentMethod: 'efectivo' | 'transferencia' | 'mixto';
  efectivoAmount: number;
  transferenciaAmount: number;
  amountReceived?: number;
  change?: number;
  note?: string;
}

interface AppContextType {
  currentView: ViewType;
  setCurrentView: (view: ViewType) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  isSearchModalOpen: boolean;
  setIsSearchModalOpen: (open: boolean) => void;
  products: Product[];
  addProduct: (product: Omit<Product, 'id'>) => void;
  editProduct: (id: string, updated: Partial<Product>) => void;
  deleteProduct: (id: string) => void;
  updateProductStock: (idOrCode: string, addedStock: number) => void;
  selectedProductId: string | null;
  setSelectedProductId: (id: string | null) => void;
  ipvRows: IPVRow[];
  updateIpvVendido: (id: string, newVendido: number) => void;
  ipvTotalVendido: number;
  ipvTotalUnidades: number;
  denominations: Denomination[];
  updateDenominationCount: (id: string, count: number) => void;
  menoresAmount: number;
  setMenoresAmount: (amount: number) => void;
  transferenciasAmount: number;
  setTransferenciasAmount: (amount: number) => void;
  totalCashFisico: number;
  totalGeneralContado: number;
  diferenciaCaja: number;
  backupRecords: BackupRecord[];
  addBackupRecord: (rec: Omit<BackupRecord, 'id'>) => void;
  restoreBackup: (backupData: any) => boolean;
  // Sales & Cash Reconciliation
  sales: SaleRecord[];
  totalVentasEfectivo: number;
  totalVentasTransferencia: number;
  recordSale: (saleInput: RecordSaleInput) => boolean;
  cancelSale: (saleId: string) => void;
  isSaleModalOpen: boolean;
  setIsSaleModalOpen: (open: boolean) => void;
  preselectedProductForSale: Product | null;
  setPreselectedProductForSale: (p: Product | null) => void;
  openSaleModal: (productOrRow?: Product | IPVRow | null) => void;
  closeSaleModal: () => void;
  toast: ToastData | null;
  showToast: (title: string, desc: string, type?: 'success' | 'info' | 'error') => void;
  hideToast: () => void;
  recalculateCash: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentView, setCurrentView] = useState<ViewType>('dashboard');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [products, setProducts] = useState<Product[]>(() => {
    try {
      const saved = localStorage.getItem('ferrestock_products');
      if (saved) return JSON.parse(saved);
    } catch {}
    return INITIAL_PRODUCTS;
  });
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [ipvRows, setIpvRows] = useState<IPVRow[]>(() => {
    try {
      const saved = localStorage.getItem('ferrestock_ipv_rows');
      if (saved) return JSON.parse(saved);
    } catch {}
    return INITIAL_IPV_ROWS;
  });
  const [denominations, setDenominations] = useState<Denomination[]>(INITIAL_DENOMINATIONS);
  const [menoresAmount, setMenoresAmount] = useState<number>(200.0);
  const [transferenciasAmount, setTransferenciasAmount] = useState<number>(4300.0);
  const [sales, setSales] = useState<SaleRecord[]>(() => {
    try {
      const saved = localStorage.getItem('ferrestock_sales');
      if (saved) return JSON.parse(saved);
    } catch {}
    return INITIAL_SALES;
  });
  const [isSaleModalOpen, setIsSaleModalOpen] = useState(false);
  const [preselectedProductForSale, setPreselectedProductForSale] = useState<Product | null>(null);
  const [backupRecords, setBackupRecords] = useState<BackupRecord[]>(INITIAL_BACKUPS);
  const [toast, setToast] = useState<ToastData | null>(null);

  // Sync to localStorage for offline resilience
  useEffect(() => {
    try {
      localStorage.setItem('ferrestock_products', JSON.stringify(products));
    } catch {}
  }, [products]);

  useEffect(() => {
    try {
      localStorage.setItem('ferrestock_ipv_rows', JSON.stringify(ipvRows));
    } catch {}
  }, [ipvRows]);

  useEffect(() => {
    try {
      localStorage.setItem('ferrestock_sales', JSON.stringify(sales));
    } catch {}
  }, [sales]);

  const showToast = (title: string, desc: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToast({ title, desc, type });
    setTimeout(() => {
      setToast(null);
    }, 3800);
  };

  const hideToast = () => {
    setToast(null);
  };

  // Calculations for IPV
  const ipvTotalVendido = useMemo(() => {
    return ipvRows.reduce((acc, row) => acc + row.importe, 0);
  }, [ipvRows]);

  const ipvTotalUnidades = useMemo(() => {
    return ipvRows.reduce((acc, row) => acc + row.vendido, 0);
  }, [ipvRows]);

  // Calculations for Sales breakdown (Efectivo vs Transferencia)
  const totalVentasEfectivo = useMemo(() => {
    return sales.reduce((acc, s) => acc + (s.efectivoAmount || 0), 0);
  }, [sales]);

  const totalVentasTransferencia = useMemo(() => {
    return sales.reduce((acc, s) => acc + (s.transferenciaAmount || 0), 0);
  }, [sales]);

  // Calculations for Cash
  const totalCashFisico = useMemo(() => {
    const fromDenoms = denominations.reduce((acc, d) => acc + d.value * d.count, 0);
    return fromDenoms + (Number(menoresAmount) || 0);
  }, [denominations, menoresAmount]);

  const totalGeneralContado = useMemo(() => {
    return totalCashFisico + (Number(transferenciasAmount) || 0);
  }, [totalCashFisico, transferenciasAmount]);

  const diferenciaCaja = useMemo(() => {
    return totalGeneralContado - ipvTotalVendido;
  }, [totalGeneralContado, ipvTotalVendido]);

  const updateIpvVendido = (id: string, newVendido: number) => {
    setIpvRows((prev) =>
      prev.map((row) => {
        if (row.id === id) {
          const validVendido = Math.max(0, newVendido);
          const finalSaldo = row.saldoIni + row.entrada - validVendido;
          const status = finalSaldo <= 0 ? 'zero' : finalSaldo <= 5 ? 'low' : 'normal';
          return {
            ...row,
            vendido: validVendido,
            saldoFinal: finalSaldo,
            importe: validVendido * row.price,
            status,
          };
        }
        return row;
      })
    );
  };

  const updateDenominationCount = (id: string, count: number) => {
    setDenominations((prev) =>
      prev.map((d) => (d.id === id ? { ...d, count: Math.max(0, count) } : d))
    );
  };

  const recalculateCash = () => {
    showToast('Cálculo Actualizado', 'Todos los totales y denominaciones han sido sincronizados.');
  };

  const addProduct = (productData: Omit<Product, 'id'>) => {
    const newId = `prod-${Date.now()}`;
    const now = new Date();
    const formattedTimestamp =
      productData.createdAt ||
      now.toLocaleDateString('es-CU', { day: '2-digit', month: '2-digit', year: 'numeric' }) +
        ' • ' +
        now.toLocaleTimeString('es-CU', { hour: '2-digit', minute: '2-digit' }) +
        ' hrs';

    let finalCode = productData.code?.trim();
    if (!finalCode) {
      let maxNum = 0;
      products.forEach((p) => {
        const match = p.code.match(/PROD-(\d+)/i);
        if (match) {
          const num = parseInt(match[1], 10);
          if (!isNaN(num) && num > maxNum) maxNum = num;
        }
      });
      const nextNum = maxNum > 0 ? maxNum + 1 : products.length + 1;
      finalCode = `PROD-${String(nextNum).padStart(3, '0')}`;
    }

    const newProduct: Product = {
      ...productData,
      id: newId,
      code: finalCode,
      createdAt: formattedTimestamp,
    };
    setProducts((prev) => [newProduct, ...prev]);
    setSelectedProductId(newId);
    showToast('Producto Creado', `"${newProduct.name}" (${newProduct.code}) agregado exitosamente al catálogo.`);
  };

  const editProduct = (id: string, updated: Partial<Product>) => {
    setProducts((prev) =>
      prev.map((p) => {
        if (p.id === id) {
          const merged = { ...p, ...updated };
          const newStatus =
            merged.stock === 0 ? 'out' : merged.stock <= merged.minStock ? 'low' : 'ok';
          return { ...merged, status: newStatus };
        }
        return p;
      })
    );
    showToast('Producto Actualizado', 'Los cambios se guardaron correctamente en el catálogo.');
  };

  const deleteProduct = (id: string) => {
    const toDelete = products.find((p) => p.id === id);
    setProducts((prev) => prev.filter((p) => p.id !== id));
    if (selectedProductId === id) {
      setSelectedProductId(null);
    }
    showToast(
      'Producto Eliminado',
      `"${toDelete?.name || 'Producto'}" fue eliminado del catálogo maestro.`
    );
  };

  const updateProductStock = (idOrCode: string, addedStock: number) => {
    setProducts((prev) =>
      prev.map((p) => {
        if (p.id === idOrCode || p.code === idOrCode || p.name.toLowerCase().includes(idOrCode.toLowerCase())) {
          const newStock = Math.max(0, p.stock + addedStock);
          const newStatus = newStock === 0 ? 'out' : newStock <= p.minStock ? 'low' : 'ok';
          return {
            ...p,
            stock: newStock,
            status: newStatus,
          };
        }
        return p;
      })
    );
  };

  const addBackupRecord = (rec: Omit<BackupRecord, 'id'>) => {
    const newRec: BackupRecord = {
      ...rec,
      id: `bk-${Date.now()}`,
    };
    setBackupRecords((prev) => [newRec, ...prev]);
  };

  const openSaleModal = (productOrRow?: Product | IPVRow | null) => {
    if (productOrRow) {
      let targetProduct: Product | undefined;
      if ('stock' in productOrRow) {
        targetProduct = productOrRow;
      } else {
        targetProduct = products.find(
          (p) => p.id === productOrRow.productId || p.code === productOrRow.code || p.name === productOrRow.name
        );
        if (!targetProduct) {
          targetProduct = {
            id: productOrRow.productId || `prod-${productOrRow.code}`,
            code: productOrRow.code,
            name: productOrRow.name,
            detail: productOrRow.detail,
            category: productOrRow.category,
            um: productOrRow.um,
            price: productOrRow.price,
            stock: productOrRow.saldoFinal,
            minStock: 5,
            status: productOrRow.saldoFinal <= 0 ? 'out' : productOrRow.saldoFinal <= 5 ? 'low' : 'ok',
          };
        }
      }
      setPreselectedProductForSale(targetProduct);
    } else {
      setPreselectedProductForSale(null);
    }
    setIsSaleModalOpen(true);
  };

  const closeSaleModal = () => {
    setIsSaleModalOpen(false);
    setPreselectedProductForSale(null);
  };

  const recordSale = (saleInput: RecordSaleInput): boolean => {
    if (!saleInput.items || saleInput.items.length === 0) {
      showToast('Error en Venta', 'Debe seleccionar al menos un producto para registrar la venta.', 'error');
      return false;
    }

    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')} hrs`;
    const dateStr = now.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const saleId = `sale-${Date.now()}`;
    const nextTicketNum = sales.length + 101;
    const ticketNumber = `TKT-${String(nextTicketNum).padStart(5, '0')}`;

    const total = saleInput.items.reduce((acc, it) => acc + it.subtotal, 0);

    const newSaleRecord: SaleRecord = {
      id: saleId,
      ticketNumber,
      timestamp: timeStr,
      date: dateStr,
      items: saleInput.items,
      total,
      paymentMethod: saleInput.paymentMethod,
      efectivoAmount: saleInput.efectivoAmount,
      transferenciaAmount: saleInput.transferenciaAmount,
      amountReceived: saleInput.amountReceived,
      change: saleInput.change,
      note: saleInput.note,
    };

    // 1. Update sales list
    setSales((prev) => [newSaleRecord, ...prev]);

    // 2. Update stock in products catalog
    setProducts((prev) =>
      prev.map((p) => {
        const itemSold = saleInput.items.find(
          (it) => it.productId === p.id || it.code === p.code || it.name.toLowerCase() === p.name.toLowerCase()
        );
        if (itemSold) {
          const newStock = Math.max(0, p.stock - itemSold.quantity);
          const newStatus = newStock === 0 ? 'out' : newStock <= p.minStock ? 'low' : 'ok';
          return {
            ...p,
            stock: newStock,
            status: newStatus,
            lastExit: `Hoy ${timeStr.replace(' hrs', '')}`,
          };
        }
        return p;
      })
    );

    // 3. Update IPV Rows (Vendido, SaldoFinal, Importe)
    setIpvRows((prev) => {
      const updated = [...prev];
      saleInput.items.forEach((itemSold) => {
        const idx = updated.findIndex(
          (r) =>
            r.productId === itemSold.productId ||
            r.code === itemSold.code ||
            r.name.toLowerCase() === itemSold.name.toLowerCase()
        );
        if (idx !== -1) {
          const row = updated[idx];
          const newVendido = row.vendido + itemSold.quantity;
          const newFinal = Math.max(0, row.saldoIni + row.entrada - newVendido);
          const newImporte = newVendido * row.price;
          const newStatus = newFinal <= 0 ? 'zero' : newFinal <= 5 ? 'low' : 'normal';
          updated[idx] = {
            ...row,
            vendido: newVendido,
            saldoFinal: newFinal,
            importe: newImporte,
            status: newStatus,
          };
        } else {
          // If not in IPV yet, create row
          const newRow: IPVRow = {
            id: `ipv-${Date.now()}-${itemSold.code}`,
            num: String(updated.length + 1).padStart(2, '0'),
            productId: itemSold.productId,
            code: itemSold.code,
            name: itemSold.name,
            category: 'General',
            detail: `Venta TPV • Cód: ${itemSold.code}`,
            um: itemSold.um || 'Unidad',
            saldoIni: itemSold.quantity,
            entrada: 0,
            vendido: itemSold.quantity,
            saldoFinal: 0,
            price: itemSold.unitPrice,
            importe: itemSold.subtotal,
            status: 'zero',
            icon: 'point_of_sale',
          };
          updated.push(newRow);
        }
      });
      return updated;
    });

    // 4. Update transferenciasAmount automatically if paid by transfer or mixed
    if (saleInput.transferenciaAmount > 0) {
      setTransferenciasAmount((prev) => prev + saleInput.transferenciaAmount);
    }

    const payLabel =
      saleInput.paymentMethod === 'efectivo'
        ? `Efectivo (${total.toFixed(2)} CUP)`
        : saleInput.paymentMethod === 'transferencia'
        ? `Transferencia (${total.toFixed(2)} CUP)`
        : `Mixto (Ef: $${saleInput.efectivoAmount.toFixed(2)} / Tr: $${saleInput.transferenciaAmount.toFixed(2)})`;

    showToast(
      'Venta Cobrada con Éxito',
      `${ticketNumber}: ${total.toLocaleString('es-CU', { minimumFractionDigits: 2 })} CUP • Pago en ${payLabel}`
    );

    return true;
  };

  const cancelSale = (saleId: string) => {
    const saleToCancel = sales.find((s) => s.id === saleId);
    if (!saleToCancel) return;

    setSales((prev) => prev.filter((s) => s.id !== saleId));

    setProducts((prev) =>
      prev.map((p) => {
        const itemSold = saleToCancel.items.find(
          (it) =>
            it.productId === p.id ||
            it.code === p.code ||
            (it.productCode && it.productCode === p.code) ||
            it.name.toLowerCase() === p.name.toLowerCase()
        );
        if (itemSold) {
          const newStock = p.stock + itemSold.quantity;
          const newStatus = newStock === 0 ? 'out' : newStock <= p.minStock ? 'low' : 'ok';
          return {
            ...p,
            stock: newStock,
            status: newStatus,
          };
        }
        return p;
      })
    );

    setIpvRows((prev) =>
      prev.map((row) => {
        const itemSold = saleToCancel.items.find(
          (it) =>
            it.productId === row.productId ||
            it.code === row.code ||
            it.name.toLowerCase() === row.name.toLowerCase()
        );
        if (itemSold) {
          const newVendido = Math.max(0, row.vendido - itemSold.quantity);
          const newFinal = Math.max(0, row.saldoIni + row.entrada - newVendido);
          const newImporte = newVendido * row.price;
          const newStatus = newFinal <= 0 ? 'zero' : newFinal <= 5 ? 'low' : 'normal';
          return {
            ...row,
            vendido: newVendido,
            saldoFinal: newFinal,
            importe: newImporte,
            status: newStatus,
          };
        }
        return row;
      })
    );

    if (saleToCancel.transferenciaAmount > 0) {
      setTransferenciasAmount((prev) => Math.max(0, prev - saleToCancel.transferenciaAmount));
    }

    showToast(
      'Venta Anulada',
      `Se canceló ${saleToCancel.ticketNumber}. Se reincorporó el stock al inventario y al IPV.`
    );
  };

  const restoreBackup = (data: any): boolean => {
    try {
      if (data && typeof data === 'object') {
        if (Array.isArray(data.products) && data.products.length > 0) {
          setProducts(data.products);
        }
        if (Array.isArray(data.ipvRows) && data.ipvRows.length > 0) {
          setIpvRows(data.ipvRows);
        }
        if (Array.isArray(data.denominations) && data.denominations.length > 0) {
          setDenominations(data.denominations);
        }
        if (typeof data.menoresAmount === 'number') {
          setMenoresAmount(data.menoresAmount);
        }
        if (typeof data.transferenciasAmount === 'number') {
          setTransferenciasAmount(data.transferenciasAmount);
        }
        if (Array.isArray(data.sales) && data.sales.length > 0) {
          setSales(data.sales);
        }
        showToast('Respaldo Restaurado', 'Los datos del inventario, IPV y caja han sido restablecidos.');
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  return (
    <AppContext.Provider
      value={{
        currentView,
        setCurrentView,
        searchQuery,
        setSearchQuery,
        isSearchModalOpen,
        setIsSearchModalOpen,
        products,
        addProduct,
        editProduct,
        deleteProduct,
        updateProductStock,
        selectedProductId,
        setSelectedProductId,
        ipvRows,
        updateIpvVendido,
        ipvTotalVendido,
        ipvTotalUnidades,
        denominations,
        updateDenominationCount,
        menoresAmount,
        setMenoresAmount,
        transferenciasAmount,
        setTransferenciasAmount,
        totalCashFisico,
        totalGeneralContado,
        diferenciaCaja,
        backupRecords,
        addBackupRecord,
        restoreBackup,
        // Sales & Cash Reconciliation
        sales,
        totalVentasEfectivo,
        totalVentasTransferencia,
        recordSale,
        cancelSale,
        isSaleModalOpen,
        setIsSaleModalOpen,
        preselectedProductForSale,
        setPreselectedProductForSale,
        openSaleModal,
        closeSaleModal,
        toast,
        showToast,
        hideToast,
        recalculateCash,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
