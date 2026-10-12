import React, { createContext, useContext, useState, useMemo, useEffect, useCallback } from 'react';
import { ViewType, Product, IPVRow, Denomination, BackupRecord, SaleRecord, SaleItem } from '../types';
import { IpvDay, IpvDayRow, SaleInput, DayClose, ClockStatus } from '../data/api';

export const INITIAL_DENOMINATIONS: Denomination[] = [
  { id: 'd-1000', label: '$1,000 CUP', sublabel: 'Billetes mayores', badge: 'Alta', value: 1000, count: 0 },
  { id: 'd-500', label: '$500 CUP', sublabel: 'Billetes corrientes', badge: 'Media', value: 500, count: 0 },
  { id: 'd-200', label: '$200 CUP', sublabel: 'Billetes corrientes', badge: 'Media', value: 200, count: 0 },
  { id: 'd-100', label: '$100 CUP', sublabel: 'Billetes menores', badge: 'Frecuente', value: 100, count: 0 },
  { id: 'd-50', label: '$50 CUP', sublabel: 'Billetes de cambio', badge: 'Frecuente', value: 50, count: 0 },
  { id: 'd-20', label: '$20 CUP', sublabel: 'Fraccionario', badge: 'Menor', value: 20, count: 0 },
  { id: 'd-10', label: '$10 CUP', sublabel: 'Fraccionario', badge: 'Menor', value: 10, count: 0 },
  { id: 'd-5', label: '$5 CUP', sublabel: 'Moneda / Billete', badge: 'Menor', value: 5, count: 0 },
  { id: 'd-1', label: '$1 CUP', sublabel: 'Fraccionario base', badge: 'Menor', value: 1, count: 0 },
];

export const ERROR_MESSAGES_ES: Record<string, string> = {
  INSUFFICIENT_STOCK: 'Stock insuficiente para completar la venta de uno o más artículos.',
  PAYMENT_MISMATCH: 'El total de los métodos de pago no coincide con el importe de la venta.',
  DAY_CLOSED: 'El día se encuentra cerrado. No se permiten más ventas ni modificaciones.',
  ALREADY_VOIDED: 'La venta seleccionada ya ha sido anulada previamente.',
  CODE_EXISTS: 'Ya existe un producto registrado con ese código.',
  INVALID: 'Los datos introducidos no son válidos o están incompletos.',
  NOT_FOUND: 'El registro solicitado no fue encontrado en la base de datos.',
  BAD_DATE: 'Formato de fecha inválido. Se espera AAAA-MM-DD.',
  BAD_BACKUP: 'El archivo de respaldo está dañado o no tiene un formato válido.',
  INTERNAL: 'Error interno en la base de datos SQLite.',
};

export const getFriendlyErrorMessage = (err: any): string => {
  const code = err?.code || (err?.message && ERROR_MESSAGES_ES[err.message] ? err.message : null);
  if (code && ERROR_MESSAGES_ES[code]) {
    return ERROR_MESSAGES_ES[code];
  }
  return err?.message || 'Ocurrió un error inesperado al procesar la solicitud.';
};

const getCategoryIcon = (category: string) => {
  const cat = (category || '').toLowerCase();
  if (cat.includes('plom') || cat.includes('agua') || cat.includes('fontan')) return 'plumbing';
  if (cat.includes('electr') || cat.includes('ilum')) return 'bolt';
  if (cat.includes('tornill') || cat.includes('fijac')) return 'build';
  if (cat.includes('herram')) return 'handyman';
  if (cat.includes('pint')) return 'format_paint';
  return 'inventory_2';
};

const mapIpvDayRowToIPVRow = (r: IpvDayRow): IPVRow => ({
  id: r.id,
  num: r.num,
  productId: r.productId,
  code: r.code,
  name: r.name,
  category: r.category || 'General',
  detail: r.detail || '',
  um: r.um || 'Unidad',
  saldoIni: r.saldoIni,
  entrada: r.entrada,
  vendido: r.vendido,
  ajuste: r.ajuste,
  saldoFinal: r.saldoFinal,
  price: r.price,
  importe: r.importe,
  status: r.status,
  icon: getCategoryIcon(r.category),
});

interface ToastData {
  title: string;
  desc: string;
  type?: 'success' | 'info' | 'error';
}

export interface RecordSaleInput {
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

  // Fecha y Día
  todayDate: string; // AAAA-MM-DD
  selectedIpvDate: string; // AAAA-MM-DD
  setSelectedIpvDate: (date: string) => void;
  isCurrentDayClosed: boolean;
  isViewDateClosed: boolean;
  isViewingPastDate: boolean;

  // Productos
  products: Product[];
  addProduct: (product: Omit<Product, 'id'>) => Promise<boolean>;
  editProduct: (id: string, updated: Partial<Product>) => Promise<boolean>;
  deleteProduct: (id: string) => Promise<boolean>;
  updateProductStock: (idOrCode: string, addedStock: number) => Promise<boolean>;
  selectedProductId: string | null;
  setSelectedProductId: (id: string | null) => void;

  // IPV
  ipvRows: IPVRow[];
  ipvTotalVendido: number;
  ipvTotalUnidades: number;
  currentIpvDay: IpvDay | null;
  refreshIpvDay: (date?: string) => Promise<void>;

  // Caja y Arqueo
  denominations: Denomination[];
  updateDenominationCount: (id: string, count: number) => void;
  menoresAmount: number;
  setMenoresAmount: (amount: number) => void;
  transferenciasAmount: number;
  setTransferenciasAmount: (amount: number) => void;
  totalCashFisico: number;
  totalGeneralContado: number;
  diferenciaCaja: number;
  recalculateCash: () => void;
  closeDay: (date: string, note?: string) => Promise<boolean>;
  reopenDay: (date: string) => Promise<boolean>;
  listCloses: (limit?: number) => Promise<DayClose[]>;

  // Respaldos
  backupRecords: BackupRecord[];
  addBackupRecord: (rec: Omit<BackupRecord, 'id'>) => void;
  restoreBackup: (backupData: any) => Promise<boolean>;

  // Ventas
  sales: SaleRecord[];
  totalVentasEfectivo: number;
  totalVentasTransferencia: number;
  recordSale: (saleInput: RecordSaleInput) => Promise<boolean>;
  cancelSale: (saleId: string) => Promise<boolean>;
  isSaleModalOpen: boolean;
  setIsSaleModalOpen: (open: boolean) => void;
  preselectedProductForSale: Product | null;
  setPreselectedProductForSale: (p: Product | null) => void;
  openSaleModal: (productOrRow?: Product | IPVRow | null) => void;
  closeSaleModal: () => void;

  // UI Toast y recargas
  toast: ToastData | null;
  showToast: (title: string, desc: string, type?: 'success' | 'info' | 'error') => void;
  hideToast: () => void;
  refreshAll: () => Promise<void>;
  syncClock: (manual?: boolean) => Promise<{ changed: boolean; today: string; warning?: boolean; clockStatus?: ClockStatus }>;
  isLoading: boolean;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentView, setCurrentView] = useState<ViewType>('dashboard');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);

  // Fechas y estado de cierre
  const [todayDate, setTodayDate] = useState<string>(() => {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  });
  const [selectedIpvDate, setSelectedIpvDate] = useState<string>(todayDate);
  const [currentIpvDay, setCurrentIpvDay] = useState<IpvDay | null>(null);
  const [isCurrentDayClosed, setIsCurrentDayClosed] = useState<boolean>(false);

  // Productos y Ventas
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [sales, setSales] = useState<SaleRecord[]>([]);

  // Caja y Denominaciones
  const [denominations, setDenominations] = useState<Denomination[]>(INITIAL_DENOMINATIONS);
  const [menoresAmount, setMenoresAmount] = useState<number>(0);
  const [transferenciasAmount, setTransferenciasAmount] = useState<number>(0);

  // Respaldos y Modales
  const [backupRecords, setBackupRecords] = useState<BackupRecord[]>([]);
  const [isSaleModalOpen, setIsSaleModalOpen] = useState(false);
  const [preselectedProductForSale, setPreselectedProductForSale] = useState<Product | null>(null);
  const [toast, setToast] = useState<ToastData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const showToast = useCallback((title: string, desc: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToast({ title, desc, type });
    setTimeout(() => {
      setToast(null);
    }, 4500);
  }, []);

  const hideToast = useCallback(() => {
    setToast(null);
  }, []);

  // Cargar IPV del día seleccionado
  const refreshIpvDay = useCallback(async (targetDate?: string) => {
    const dateToFetch = targetDate || selectedIpvDate;
    try {
      if (window.api && window.api.ipv) {
        const dayData = await window.api.ipv.getDay(dateToFetch);
        setCurrentIpvDay(dayData);
        if (dateToFetch === todayDate) {
          setIsCurrentDayClosed(dayData.closed);
          setTransferenciasAmount(dayData.sales?.transferencia || 0);
        }
      }
    } catch (err: any) {
      console.error('Error al cargar IPV del día:', err);
      showToast('Error de IPV', getFriendlyErrorMessage(err), 'error');
    }
  }, [selectedIpvDate, todayDate, showToast]);

  // Cargar todos los datos desde window.api
  const refreshAll = useCallback(async () => {
    if (!window.api) return;
    setIsLoading(true);
    try {
      const today = await window.api.today();
      setTodayDate(today);
      if (!selectedIpvDate) {
        setSelectedIpvDate(today);
      }

      const [loadedProducts, loadedDay, loadedSales] = await Promise.all([
        window.api.products.list(),
        window.api.ipv.getDay(selectedIpvDate || today),
        window.api.sales.listRange
          ? window.api.sales.listRange()
          : window.api.sales.listByDate(selectedIpvDate || today),
      ]);

      setProducts(loadedProducts);
      setCurrentIpvDay(loadedDay);
      if ((selectedIpvDate || today) === today) {
        setIsCurrentDayClosed(loadedDay.closed);
        setTransferenciasAmount(loadedDay.sales?.transferencia || 0);
      }

      const formattedSales: SaleRecord[] = loadedSales.map((s) => ({
        id: s.id,
        ticketNumber: s.ticketNumber,
        timestamp: s.timestamp,
        date: s.date,
        items: s.items.map((it) => ({
          productId: it.productId,
          code: it.code,
          name: it.name,
          um: it.um,
          unitPrice: it.unitPrice,
          quantity: it.quantity,
          subtotal: it.subtotal,
        })),
        total: s.total,
        paymentMethod: s.paymentMethod,
        efectivoAmount: s.efectivoAmount,
        transferenciaAmount: s.transferenciaAmount,
        amountReceived: s.amountReceived,
        change: s.change,
        note: s.note,
      }));
      setSales(formattedSales);
    } catch (err: any) {
      console.error('Error al sincronizar con SQLite:', err);
      showToast('Error de Base de Datos', getFriendlyErrorMessage(err), 'error');
    } finally {
      setIsLoading(false);
    }
  }, [selectedIpvDate, showToast]);

  // Inicialización de la app al montar
  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  // Sincronizar reloj (Paso 1: actualiza fecha y recarga si difiere; Paso 2: estado y warning de reloj atrasado)
  const syncClock = useCallback(
    async (manual = false) => {
      if (!window.api) return { changed: false, today: todayDate, warning: false };
      try {
        const serverToday = await window.api.today();
        let changed = false;

        if (serverToday !== todayDate) {
          changed = true;
          setTodayDate(serverToday);
          setSelectedIpvDate(serverToday);

          const [loadedProducts, loadedDay, loadedSales] = await Promise.all([
            window.api.products.list(),
            window.api.ipv.getDay(serverToday),
            window.api.sales.listRange
              ? window.api.sales.listRange()
              : window.api.sales.listByDate(serverToday),
          ]);

          setProducts(loadedProducts);
          setCurrentIpvDay(loadedDay);
          setIsCurrentDayClosed(loadedDay.closed);
          setTransferenciasAmount(loadedDay.sales?.transferencia || 0);

          const formattedSales: SaleRecord[] = loadedSales.map((s) => ({
            id: s.id,
            ticketNumber: s.ticketNumber,
            timestamp: s.timestamp,
            date: s.date,
            items: s.items.map((it) => ({
              productId: it.productId,
              code: it.code,
              name: it.name,
              um: it.um,
              unitPrice: it.unitPrice,
              quantity: it.quantity,
              subtotal: it.subtotal,
            })),
            total: s.total,
            paymentMethod: s.paymentMethod,
            efectivoAmount: s.efectivoAmount,
            transferenciaAmount: s.transferenciaAmount,
            amountReceived: s.amountReceived,
            change: s.change,
            note: s.note,
          }));
          setSales(formattedSales);
          showToast('Fecha actualizada', `Fecha actualizada: ${serverToday}`, 'info');
        } else {
          if (manual) {
            showToast('Reloj sincronizado', 'Reloj ya sincronizado', 'info');
          }
        }

        let clockStatus: ClockStatus | undefined;
        let warning = false;
        if (manual && window.api.clock) {
          clockStatus = await window.api.clock.status();
          warning = Boolean(clockStatus && clockStatus.warning);
        }

        return { changed, today: serverToday, warning, clockStatus };
      } catch (err: any) {
        console.error('Error al sincronizar reloj:', err);
        if (manual) {
          showToast('Error de reloj', 'No se pudo sincronizar el reloj', 'error');
        }
        return { changed: false, today: todayDate, warning: false };
      }
    },
    [todayDate, showToast]
  );

  // Automático (sin pulsar): Repetir el paso 1 al recuperar el foco la ventana y cada 60 s, para detectar el cambio de día.
  useEffect(() => {
    const handleFocus = () => {
      syncClock(false);
    };
    window.addEventListener('focus', handleFocus);
    const interval = setInterval(() => {
      syncClock(false);
    }, 60000);
    return () => {
      window.removeEventListener('focus', handleFocus);
      clearInterval(interval);
    };
  }, [syncClock]);

  // Cuando cambia la fecha del IPV seleccionada, recargar datos para esa fecha
  useEffect(() => {
    if (selectedIpvDate) {
      refreshIpvDay(selectedIpvDate);
      if (window.api && window.api.sales) {
        const fetcher = window.api.sales.listRange
          ? window.api.sales.listRange()
          : window.api.sales.listByDate(selectedIpvDate);
        fetcher.then((loadedSales) => {
          setSales(
            loadedSales.map((s) => ({
              id: s.id,
              ticketNumber: s.ticketNumber,
              timestamp: s.timestamp,
              date: s.date,
              items: s.items.map((it) => ({
                productId: it.productId,
                code: it.code,
                name: it.name,
                um: it.um,
                unitPrice: it.unitPrice,
                quantity: it.quantity,
                subtotal: it.subtotal,
              })),
              total: s.total,
              paymentMethod: s.paymentMethod,
              efectivoAmount: s.efectivoAmount,
              transferenciaAmount: s.transferenciaAmount,
              amountReceived: s.amountReceived,
              change: s.change,
              note: s.note,
            }))
          );
        }).catch((e) => console.error(e));
      }
    }
  }, [selectedIpvDate, refreshIpvDay]);

  const isViewDateClosed = !!currentIpvDay?.closed;
  const isViewingPastDate = selectedIpvDate !== todayDate;

  // Filas del IPV mapeadas desde currentIpvDay
  const ipvRows = useMemo(() => {
    if (!currentIpvDay || !currentIpvDay.rows) return [];
    return currentIpvDay.rows.map(mapIpvDayRowToIPVRow);
  }, [currentIpvDay]);

  const ipvTotalVendido = currentIpvDay?.totalVendido || 0;
  const ipvTotalUnidades = currentIpvDay?.totalUnidades || 0;

  // Desglose de Ventas para la jornada seleccionada
  const totalVentasEfectivo = useMemo(() => {
    const targetDate = selectedIpvDate || todayDate;
    return sales
      .filter((s) => s.date === targetDate && !(s as any).voided)
      .reduce((acc, s) => acc + (s.efectivoAmount || 0), 0);
  }, [sales, selectedIpvDate, todayDate]);

  const totalVentasTransferencia = useMemo(() => {
    const targetDate = selectedIpvDate || todayDate;
    return sales
      .filter((s) => s.date === targetDate && !(s as any).voided)
      .reduce((acc, s) => acc + (s.transferenciaAmount || 0), 0);
  }, [sales, selectedIpvDate, todayDate]);

  // Cálculos de Caja
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

  const updateDenominationCount = (id: string, count: number) => {
    setDenominations((prev) =>
      prev.map((d) => (d.id === id ? { ...d, count: Math.max(0, count) } : d))
    );
  };

  const recalculateCash = () => {
    showToast('Cálculo Actualizado', 'Todos los totales de caja han sido recalculados.');
  };

  const closeDay = async (date: string, note?: string): Promise<boolean> => {
    try {
      if (!window.api) return false;
      await window.api.cash.closeDay(date, {
        denominations: denominations.map((d) => ({
          id: d.id,
          label: d.label,
          value: d.value,
          count: d.count,
        })),
        menoresAmount: Number(menoresAmount) || 0,
        transferenciasAmount: Number(transferenciasAmount) || 0,
        note,
      });
      await refreshAll();
      showToast('Día Cerrado', `El arqueo y cierre del día ${date} fue registrado con éxito en SQLite.`);
      return true;
    } catch (err: any) {
      showToast('Error al cerrar el día', getFriendlyErrorMessage(err), 'error');
      return false;
    }
  };

  const reopenDay = async (date: string): Promise<boolean> => {
    try {
      if (!window.api) return false;
      await window.api.cash.reopenDay(date);
      await refreshAll();
      showToast('Día Reabierto', `La jornada del ${date} fue reabierta. Ya se pueden registrar o anular ventas.`);
      return true;
    } catch (err: any) {
      showToast('Error al reabrir el día', getFriendlyErrorMessage(err), 'error');
      return false;
    }
  };

  const listCloses = async (limit = 30): Promise<DayClose[]> => {
    try {
      if (!window.api) return [];
      return await window.api.cash.listCloses(limit);
    } catch (err: any) {
      console.error('Error al listar cierres:', err);
      return [];
    }
  };

  // Operaciones de Producto mediante window.api
  const addProduct = async (productData: Omit<Product, 'id'>): Promise<boolean> => {
    try {
      if (!window.api) return false;
      await window.api.products.create({
        name: productData.name,
        code: productData.code,
        category: productData.category,
        detail: productData.detail,
        um: productData.um,
        price: productData.price,
        stock: productData.stock,
        minStock: productData.minStock,
        provider: productData.provider,
        location: productData.location,
        rotation: productData.rotation,
      });
      await refreshAll();
      showToast('Producto Creado', `"${productData.name}" agregado exitosamente al catálogo.`);
      return true;
    } catch (err: any) {
      showToast('Error al crear producto', getFriendlyErrorMessage(err), 'error');
      return false;
    }
  };

  const editProduct = async (id: string, updated: Partial<Product>): Promise<boolean> => {
    try {
      if (!window.api) return false;
      await window.api.products.update(id, {
        name: updated.name,
        code: updated.code,
        category: updated.category,
        detail: updated.detail,
        um: updated.um,
        price: updated.price,
        stock: updated.stock,
        minStock: updated.minStock,
        provider: updated.provider,
        location: updated.location,
        rotation: updated.rotation,
      });
      await refreshAll();
      showToast('Producto Actualizado', 'Los cambios se guardaron correctamente en la base de datos.');
      return true;
    } catch (err: any) {
      showToast('Error al actualizar', getFriendlyErrorMessage(err), 'error');
      return false;
    }
  };

  const deleteProduct = async (id: string): Promise<boolean> => {
    try {
      if (!window.api) return false;
      await window.api.products.archive(id);
      if (selectedProductId === id) {
        setSelectedProductId(null);
      }
      await refreshAll();
      showToast('Producto Archivado', 'El producto fue archivado correctamente del catálogo.');
      return true;
    } catch (err: any) {
      showToast('Error al archivar', getFriendlyErrorMessage(err), 'error');
      return false;
    }
  };

  const updateProductStock = async (idOrCode: string, addedStock: number): Promise<boolean> => {
    try {
      if (!window.api) return false;
      const targetProd = products.find((p) => p.id === idOrCode || p.code === idOrCode);
      if (!targetProd) {
        showToast('Error', 'Producto no encontrado.', 'error');
        return false;
      }
      await window.api.products.addStock(targetProd.id, addedStock, 'Entrada de mercancía');
      await refreshAll();
      showToast('Entrada Registrada', `+${addedStock} unidades añadidas a "${targetProd.name}".`);
      return true;
    } catch (err: any) {
      showToast('Error al añadir stock', getFriendlyErrorMessage(err), 'error');
      return false;
    }
  };

  // Operaciones de Venta mediante window.api
  const recordSale = async (saleInput: RecordSaleInput): Promise<boolean> => {
    if (isCurrentDayClosed) {
      showToast('Día Cerrado', 'No se pueden registrar ventas porque la jornada ya fue cerrada.', 'error');
      return false;
    }
    if (!saleInput.items || saleInput.items.length === 0) {
      showToast('Error en Venta', 'Debe seleccionar al menos un producto para registrar la venta.', 'error');
      return false;
    }

    try {
      if (!window.api) return false;
      const apiInput: SaleInput = {
        items: saleInput.items.map((it) => ({
          productId: it.productId,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
        })),
        paymentMethod: saleInput.paymentMethod,
        efectivoAmount: saleInput.paymentMethod === 'mixto' ? saleInput.efectivoAmount : undefined,
        transferenciaAmount: saleInput.paymentMethod === 'mixto' ? saleInput.transferenciaAmount : undefined,
        amountReceived: saleInput.amountReceived,
        change: saleInput.change,
        note: saleInput.note,
      };

      const recorded = await window.api.sales.record(apiInput);
      await refreshAll();

      showToast(
        'Venta Registrada con Éxito',
        `Ticket ${recorded.ticketNumber}: $${recorded.total.toFixed(2)} CUP (${recorded.paymentMethod})`
      );
      return true;
    } catch (err: any) {
      showToast('Error al registrar venta', getFriendlyErrorMessage(err), 'error');
      return false;
    }
  };

  const cancelSale = async (saleId: string): Promise<boolean> => {
    if (isCurrentDayClosed) {
      showToast('Día Cerrado', 'No se pueden anular ventas porque la jornada ya fue cerrada.', 'error');
      return false;
    }
    try {
      if (!window.api) return false;
      const voided = await window.api.sales.void(saleId);
      await refreshAll();
      showToast(
        'Venta Anulada',
        `Se anuló el Ticket ${voided.ticketNumber}. El stock fue repuesto y el IPV actualizado.`
      );
      return true;
    } catch (err: any) {
      showToast('Error al anular venta', getFriendlyErrorMessage(err), 'error');
      return false;
    }
  };

  // Modales de venta
  const openSaleModal = (productOrRow?: Product | IPVRow | null) => {
    if (isCurrentDayClosed) {
      showToast('Jornada Cerrada', 'El día está cerrado. Para realizar ventas debe reabrir la jornada en Cierre de Caja.', 'error');
      return;
    }
    if (productOrRow) {
      let targetProduct: Product | undefined;
      if ('stock' in productOrRow) {
        targetProduct = productOrRow;
      } else {
        targetProduct = products.find((p) => p.id === productOrRow.productId || p.code === productOrRow.code);
      }
      setPreselectedProductForSale(targetProduct || null);
    } else {
      setPreselectedProductForSale(null);
    }
    setIsSaleModalOpen(true);
  };

  const closeSaleModal = () => {
    setIsSaleModalOpen(false);
    setPreselectedProductForSale(null);
  };

  const addBackupRecord = (rec: Omit<BackupRecord, 'id'>) => {
    const newRec: BackupRecord = {
      ...rec,
      id: `bk-${Date.now()}`,
    };
    setBackupRecords((prev) => [newRec, ...prev]);
  };

  const restoreBackup = async (_backupData: any): Promise<boolean> => {
    try {
      if (!window.api) return false;
      const res = await window.api.backup.restoreJson();
      if (res.canceled) return false;
      await refreshAll();
      showToast('Respaldo Restaurado', 'Los datos fueron restablecidos con éxito desde el archivo.');
      return true;
    } catch (err: any) {
      showToast('Error al restaurar', getFriendlyErrorMessage(err), 'error');
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
        todayDate,
        selectedIpvDate,
        setSelectedIpvDate,
        isCurrentDayClosed,
        isViewDateClosed,
        isViewingPastDate,
        products,
        addProduct,
        editProduct,
        deleteProduct,
        updateProductStock,
        selectedProductId,
        setSelectedProductId,
        ipvRows,
        ipvTotalVendido,
        ipvTotalUnidades,
        currentIpvDay,
        refreshIpvDay,
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
        closeDay,
        reopenDay,
        listCloses,
        refreshAll,
        syncClock,
        isLoading,
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
