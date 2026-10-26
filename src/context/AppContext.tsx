import React, { createContext, useContext, useState, useMemo, useEffect, useCallback } from 'react';
import { ViewType, Product, IPVRow, Denomination, BackupRecord, SaleRecord, SaleItem, ReturnRecord, ReturnItem, MermaItem } from '../types';
import { IpvDay, IpvDayRow, SaleInput, DayClose, LicenseStatus } from '../data/api';
import {
  ACTIVATION_CODE_LENGTH,
  formatActivationCode,
  normalizeActivationCode,
} from '../utils/activation';

export const INITIAL_DENOMINATIONS: Denomination[] = [
  { id: 'd-20000', label: '$20,000 CUP', sublabel: 'Billete 20 Mil', badge: '', value: 20000, count: 0 },
  { id: 'd-10000', label: '$10,000 CUP', sublabel: 'Billete 10 Mil', badge: '', value: 10000, count: 0 },
  { id: 'd-5000', label: '$5,000 CUP', sublabel: 'Billete 5 Mil', badge: '', value: 5000, count: 0 },
  { id: 'd-2000', label: '$2,000 CUP', sublabel: 'Billete 2 Mil', badge: '', value: 2000, count: 0 },
  { id: 'd-1000', label: '$1,000 CUP', sublabel: 'Billete 1 Mil', badge: '', value: 1000, count: 0 },
  { id: 'd-500', label: '$500 CUP', sublabel: 'Billete 500', badge: '', value: 500, count: 0 },
  { id: 'd-200', label: '$200 CUP', sublabel: 'Billete 200', badge: '', value: 200, count: 0 },
  { id: 'd-100', label: '$100 CUP', sublabel: 'Billete 100', badge: '', value: 100, count: 0 },
  { id: 'd-50', label: '$50 CUP', sublabel: 'Billete 50', badge: '', value: 50, count: 0 },
  { id: 'd-20', label: '$20 CUP', sublabel: 'Billete 20', badge: '', value: 20, count: 0 },
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
  INVALID_SIGNATURE: 'La firma del código es inválida.',
  INSTALLATION_MISMATCH: 'El código pertenece a un ID de instalación distinto.',
  LICENSE_EXPIRED: 'La licencia venció. La aplicación está en modo de solo lectura.',
  LICENSE_ALREADY_USED: 'El código ya fue usado o no renueva la licencia actual.',
  CLOCK_ROLLBACK: 'La fecha actual es anterior a la última fecha registrada. Corrija la hora del sistema.',
  LICENSE_REQUIRED: 'Se necesita una licencia válida para realizar esta acción.',
  INVALID_CODE: 'El código firmado tiene una versión o contenido no válido.',
};

export const getFriendlyErrorMessage = (err: any): string => {
  const code = err?.code || (err?.message && ERROR_MESSAGES_ES[err.message] ? err.message : null);
  if (code && ERROR_MESSAGES_ES[code]) {
    return ERROR_MESSAGES_ES[code];
  }
  return err?.message || 'Ocurrió un error inesperado al procesar la solicitud.';
};

const createMermaItemsForReturn = (
  returnRecord: Pick<ReturnRecord, 'id' | 'returnNumber' | 'date' | 'reason'>,
  items: ReturnItem[]
): MermaItem[] =>
  items.filter((item) => item.condition === 'mal_estado').map((item, index) => ({
    id: `merma-${returnRecord.id}-${index + 1}`,
    returnId: returnRecord.id,
    returnNumber: returnRecord.returnNumber,
    date: returnRecord.date,
    productId: item.productId,
    code: item.code,
    name: item.name,
    um: item.um,
    quantity: Number(item.quantity) || 1,
    originalUnitPrice: Number(item.unitPrice) || 0,
    damagedReason: item.damagedReason?.trim() || returnRecord.reason || 'Devolución de cliente',
    status: 'en_almacen_merma',
  }));

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
  reponerProduct: (id: string, qty: number) => Promise<boolean>;
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
  resetApplication: (password: string) => Promise<boolean>;

  // Ventas y Devoluciones
  sales: SaleRecord[];
  totalVentasEfectivo: number;
  totalVentasTransferencia: number;
  recordSale: (saleInput: RecordSaleInput) => Promise<boolean>;
  cancelSale: (saleId: string) => Promise<boolean>;
  returns: ReturnRecord[];
  addReturn: (returnData: any) => Promise<boolean>;
  totalDevolucionesToday: number;
  totalDevolucionesEfectivoToday: number;
  totalDevolucionesTransferenciaToday: number;
  mermaItems: MermaItem[];
  venderMermaConDescuento: (mermaId: string, newPrice: number, note?: string) => Promise<boolean>;
  enviarMermaAlmacen: (mermaId: string, note?: string) => Promise<boolean>;
  darDeBajaMermaItem: (mermaId: string, note?: string) => Promise<boolean>;
  revocarMermaItem: (mermaId: string) => Promise<boolean>;
  isSaleModalOpen: boolean;
  setIsSaleModalOpen: (open: boolean) => void;
  preselectedProductForSale: Product | null;
  setPreselectedProductForSale: (p: Product | null) => void;
  openSaleModal: (productOrRow?: Product | IPVRow | null) => void;
  closeSaleModal: () => void;

  // Licencia y Activación
  isAppActivated: boolean;
  isTrialActive: boolean;
  trialDaysRemaining: number;
  hasAppAccess: boolean;
  licenseStatus: LicenseStatus['status'];
  licenseReadOnly: boolean;
  licenseExpiryDate: string;
  licenseDaysRemaining: number;
  licenseType: string;
  installationId: string;
  activationKey: string;
  activatedAt: string;
  activateApp: (code: string) => Promise<{ success: boolean; message: string }>;
  settingsTab: 'reportes' | 'respaldos' | 'seguridad' | 'licencia';
  setSettingsTab: (tab: 'reportes' | 'respaldos' | 'seguridad' | 'licencia') => void;
  navigateToActivation: () => void;

  // Seguridad y Contraseña de Reinicio
  resetPasswordKey: string;
  updateResetPassword: (currentPass: string, newPass: string) => { success: boolean; message: string };

  // UI Toast y recargas
  toast: ToastData | null;
  showToast: (title: string, desc: string, type?: 'success' | 'info' | 'error') => void;
  hideToast: () => void;
  refreshAll: () => Promise<void>;
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
  const [returns, setReturns] = useState<ReturnRecord[]>([]);
  const [mermaItems, setMermaItems] = useState<MermaItem[]>(() => {
    try {
      const raw = localStorage.getItem('ipv_mermas_v2');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  // Caja y Denominaciones
  const [denominations, setDenominations] = useState<Denomination[]>(INITIAL_DENOMINATIONS);
  const [menoresAmount, setMenoresAmount] = useState<number>(0);
  const [transferenciasAmount, setTransferenciasAmount] = useState<number>(0);

  // Respaldos y Modales
  const [backupRecords, setBackupRecords] = useState<BackupRecord[]>([]);
  const [isSaleModalOpen, setIsSaleModalOpen] = useState(false);
  const [preselectedProductForSale, setPreselectedProductForSale] = useState<Product | null>(null);

  // Licencia y Activación
  const [installationId, setInstallationId] = useState<string>('');
  const [isAppActivated, setIsAppActivated] = useState<boolean>(false);
  const [isTrialActive, setIsTrialActive] = useState<boolean>(false);
  const [trialDaysRemaining, setTrialDaysRemaining] = useState<number>(0);
  const [licenseStatus, setLicenseStatus] = useState<LicenseStatus['status']>('none');
  const [licenseHasRecord, setLicenseHasRecord] = useState<boolean>(false);
  const [licenseExpiryDate, setLicenseExpiryDate] = useState<string>('');
  const [licenseDaysRemaining, setLicenseDaysRemaining] = useState<number>(0);
  const [licenseType, setLicenseType] = useState<string>('');
  const [activationKey, setActivationKey] = useState<string>('');
  const [activatedAt, setActivatedAt] = useState<string>('');
  const [settingsTab, setSettingsTab] = useState<'reportes' | 'respaldos' | 'seguridad' | 'licencia'>('reportes');

  // Seguridad y Contraseña de Reinicio
  const [resetPasswordKey, setResetPasswordKey] = useState<string>(() => {
    return localStorage.getItem('ferrestock_reset_password') || 'adminreset';
  });

  const [toast, setToast] = useState<ToastData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const showToast = useCallback((title: string, desc: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToast({ title, desc, type });
    setTimeout(() => {
      setToast(null);
    }, 4500);
  }, []);

  const applyLicenseStatus = useCallback((status: LicenseStatus) => {
    setLicenseStatus(status.status);
    setLicenseHasRecord(status.hasLicense);
    setInstallationId(status.installationId);
    setIsAppActivated(status.status === 'valid');
    setLicenseExpiryDate(status.expiryDate || '');
    setLicenseDaysRemaining(status.daysRemaining);
    setLicenseType(status.licenseType || '');
    setActivationKey(status.activationCode ? formatActivationCode(status.activationCode) : '');
    setActivatedAt(status.issueDate || '');
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

      if (window.api && (window.api as any).returns) {
        try {
          const loadedReturns = await (window.api as any).returns.list();
          setReturns(loadedReturns || []);
        } catch {
          // fallback
        }
      } else {
        try {
          const raw = localStorage.getItem('ipv_returns_v2');
          if (raw) setReturns(JSON.parse(raw));
        } catch {}
      }

      if (window.api && (window.api as any).mermas) {
        try {
          const loadedMermas = await (window.api as any).mermas.list();
          setMermaItems(loadedMermas || []);
        } catch {
          // fallback
        }
      } else {
        try {
          const rawM = localStorage.getItem('ipv_mermas_v2');
          if (rawM) setMermaItems(JSON.parse(rawM));
        } catch {}
      }
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

  useEffect(() => {
    let cancelled = false;

    const checkAccess = async () => {
      if (!window.api?.license) {
        setIsAppActivated(false);
        setLicenseHasRecord(false);
        setIsTrialActive(false);
        setTrialDaysRemaining(0);
        setLicenseStatus('none');
        return;
      }

      try {
        const trial = await window.api.license.trialStatus();
        if (cancelled) return;
        setIsTrialActive(trial.isActive);
        setTrialDaysRemaining(trial.daysRemaining);
      } catch (error: unknown) {
        if (cancelled) return;
        console.error('Error al comprobar el período de prueba:', error);
        setIsTrialActive(false);
        setTrialDaysRemaining(0);
        showToast('No se pudo comprobar la prueba', getFriendlyErrorMessage(error), 'error');
      }

      try {
        const license = await window.api.license.status();
        if (cancelled) return;
        applyLicenseStatus(license);
      } catch (error: unknown) {
        if (cancelled) return;
        console.error('Error al verificar la licencia guardada:', error);
        setIsAppActivated(false);
        showToast('No se pudo verificar la licencia', getFriendlyErrorMessage(error), 'error');
      }
    };

    void checkAccess();

    return () => {
      cancelled = true;
    };
  }, [applyLicenseStatus, showToast]);

  useEffect(() => {
    const licenseApi = window.api?.license;
    if (!licenseApi) return;

    let cancelled = false;
    let hasReportedRefreshError = false;
    const refreshTrialStatus = async () => {
      try {
        const trial = await licenseApi.trialStatus();
        if (cancelled) return;
        setIsTrialActive(trial.isActive);
        setTrialDaysRemaining(trial.daysRemaining);
      } catch (error: unknown) {
        if (cancelled) return;
        console.error('Error al actualizar el período de prueba:', error);
        setIsTrialActive(false);
        setTrialDaysRemaining(0);
        if (!hasReportedRefreshError) {
          hasReportedRefreshError = true;
          showToast('No se pudo comprobar la prueba', getFriendlyErrorMessage(error), 'error');
        }
      }
      try {
        const status = await licenseApi.status();
        if (cancelled) return;
        hasReportedRefreshError = false;
        applyLicenseStatus(status);
      } catch (error: unknown) {
        if (cancelled) return;
        console.error('Error al actualizar el estado de la licencia:', error);
        if (!hasReportedRefreshError) {
          hasReportedRefreshError = true;
          showToast('No se pudo comprobar la licencia', getFriendlyErrorMessage(error), 'error');
        }
      }
    };

    const intervalId = window.setInterval(() => {
      void refreshTrialStatus();
    }, 60_000);
    window.addEventListener('focus', refreshTrialStatus);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      window.removeEventListener('focus', refreshTrialStatus);
    };
  }, [applyLicenseStatus, showToast]);

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
        almacenStock: (productData as any).almacenStock || 0,
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
        almacenStock: (updated as any).almacenStock !== undefined ? (updated as any).almacenStock : undefined,
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
      const result = await window.api.products.delete(id);
      if (selectedProductId === id) {
        setSelectedProductId(null);
      }
      await refreshAll();
      if (result?.mode === 'archived') {
        showToast(
          'Producto Archivado',
          'El producto tiene historial de ventas o movimientos, así que se archivó. Su código ya quedó disponible para reutilizar.'
        );
      } else {
        showToast('Producto Eliminado', 'El producto fue eliminado del catálogo de forma definitiva.');
      }
      return true;
    } catch (err: any) {
      showToast('Error al eliminar', getFriendlyErrorMessage(err), 'error');
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

  const reponerProduct = async (id: string, qty: number): Promise<boolean> => {
    try {
      if (!window.api) return false;
      const targetProd = products.find((p) => p.id === id);
      if (!targetProd) {
        showToast('Error', 'Producto no encontrado.', 'error');
        return false;
      }
      await window.api.products.reponerStock(id, qty);
      await refreshAll();
      showToast(
        'Reposición Exitosa',
        `Se traspasaron ${qty} unidades de almacén al mostrador para "${targetProd.name}".`,
        'success'
      );
      return true;
    } catch (err: any) {
      showToast('Error al reponer', getFriendlyErrorMessage(err), 'error');
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

  const totalDevolucionesToday = useMemo(() => {
    return returns
      .filter((r) => r.date === todayDate)
      .reduce((acc, r) => acc + (r.totalRefund || 0), 0);
  }, [returns, todayDate]);

  const totalDevolucionesEfectivoToday = useMemo(() => {
    return returns
      .filter((r) => r.date === todayDate)
      .reduce((acc, r) => {
        if (r.refundMethod === 'efectivo' || !r.refundMethod) {
          return acc + (r.totalRefund || 0);
        }
        if (r.refundMethod === 'mixto') {
          const ef = r.efectivoAmount !== undefined
            ? r.efectivoAmount
            : Math.max(0, (r.totalRefund || 0) - (r.transferenciaAmount || 0));
          return acc + ef;
        }
        return acc;
      }, 0);
  }, [returns, todayDate]);

  const totalDevolucionesTransferenciaToday = useMemo(() => {
    return returns
      .filter((r) => r.date === todayDate)
      .reduce((acc, r) => {
        if (r.refundMethod === 'transferencia') {
          return acc + (r.totalRefund || 0);
        }
        if (r.refundMethod === 'mixto') {
          const tr = r.transferenciaAmount !== undefined ? r.transferenciaAmount : 0;
          return acc + tr;
        }
        return acc;
      }, 0);
  }, [returns, todayDate]);

  const addReturn = async (returnData: any): Promise<boolean> => {
    if (isCurrentDayClosed) {
      showToast('Día Cerrado', 'No se pueden registrar devoluciones porque la jornada ya fue cerrada.', 'error');
      return false;
    }
    try {
      if (window.api && (window.api as any).returns) {
        const recordedReturn: ReturnRecord = await (window.api as any).returns.record(returnData);
        if (!window.api.mermas) {
          const rawMermas = localStorage.getItem('ipv_mermas_v2');
          const storedMermas: MermaItem[] = rawMermas ? JSON.parse(rawMermas) : mermaItems;
          const updatedMermas = [
            ...storedMermas,
            ...createMermaItemsForReturn(recordedReturn, returnData.items || []),
          ];
          localStorage.setItem('ipv_mermas_v2', JSON.stringify(updatedMermas));
          setMermaItems(updatedMermas);
        }
      } else {
        const today = todayDate || new Date().toISOString().slice(0, 10);
        const now = new Date();
        const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        const totalRefund = Number(returnData.totalRefund) || 0;
        const refundMethod = returnData.refundMethod || 'efectivo';

        let transferenciaAmount = 0;
        let efectivoAmount = 0;
        if (refundMethod === 'efectivo') {
          efectivoAmount = totalRefund;
          transferenciaAmount = 0;
        } else if (refundMethod === 'transferencia') {
          efectivoAmount = 0;
          transferenciaAmount = totalRefund;
        } else if (refundMethod === 'mixto') {
          transferenciaAmount = Math.min(totalRefund, Math.max(0, Number(returnData.transferenciaAmount) || 0));
          efectivoAmount = Math.max(0, totalRefund - transferenciaAmount);
        }

        const newRecord: ReturnRecord = {
          id: `dev-${Date.now()}`,
          returnNumber: `DEV-${String(returns.length + 1).padStart(3, '0')}`,
          saleId: returnData.saleId,
          ticketNumber: returnData.ticketNumber,
          date: today,
          timestamp: time,
          items: returnData.items || [],
          totalRefund,
          refundMethod,
          efectivoAmount,
          transferenciaAmount,
          customerName: returnData.customerName,
          reason: returnData.reason || 'Devolución de cliente',
          hasDamagedItems: (returnData.items || []).some((it: any) => it.condition === 'mal_estado'),
          createdAt: `${today} ${time}`,
        };

        const updatedReturns = [newRecord, ...returns];
        setReturns(updatedReturns);
        try {
          localStorage.setItem('ipv_returns_v2', JSON.stringify(updatedReturns));
        } catch {}

        // Toda devolución queda pendiente de revisión en el almacén de mermas.
        let mermas = [...mermaItems];
        mermas.push(...createMermaItemsForReturn(newRecord, returnData.items || []));
        setMermaItems(mermas);
        try {
          localStorage.setItem('ipv_mermas_v2', JSON.stringify(mermas));
        } catch {}
      }

      await refreshAll();
      showToast(
        'Devolución Registrada',
        `Reembolso de $${(Number(returnData.totalRefund) || 0).toFixed(2)} CUP registrado exitosamente.`,
        'success'
      );
      return true;
    } catch (err: any) {
      showToast('Error en Devolución', getFriendlyErrorMessage(err), 'error');
      return false;
    }
  };

  const venderMermaConDescuento = async (mermaId: string, newPrice: number, note?: string): Promise<boolean> => {
    try {
      if (window.api.mermas) {
        await window.api.mermas.venderConDescuento(mermaId, newPrice, note);
      } else {
        const raw = localStorage.getItem('ipv_mermas_v2');
        let mermas: MermaItem[] = raw ? JSON.parse(raw) : [];
        const idx = mermas.findIndex((m) => m.id === mermaId);
        if (idx === -1) throw new Error('Artículo de merma no encontrado');
        if (newPrice <= 0 || newPrice >= mermas[idx].originalUnitPrice) {
          throw new Error('El precio debe ser mayor que cero y menor que el precio original.');
        }

        const sourceProduct = products.find((product) => product.id === mermas[idx].productId);
        if (!sourceProduct) throw new Error('No se encontró el producto original para crear la existencia defectuosa.');
        const defectiveProduct: Product = {
          ...sourceProduct,
          id: `prod-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          code: `MERMA-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
          name: `${mermas[idx].name} (Defectuoso)`,
          detail: `Artículo defectuoso: ${mermas[idx].damagedReason}`,
          category: 'Defectuoso',
          price: newPrice,
          stock: mermas[idx].quantity,
          almacenStock: 0,
          minStock: 1,
          status: 'ok',
          createdAt: todayDate,
        };
        await window.api.products.create(defectiveProduct);
        mermas[idx].status = 'reincorporado_con_precio';
        mermas[idx].discountedPrice = Number(newPrice);
        mermas[idx].defectiveProductId = defectiveProduct.id;
        mermas[idx].resolvedAt = todayDate;
        mermas[idx].resolutionNote = note || `Preparado para venta como defectuoso: $${Number(newPrice).toFixed(2)}`;
        setMermaItems([...mermas]);
        localStorage.setItem('ipv_mermas_v2', JSON.stringify(mermas));
      }
      await refreshAll();
      showToast(
        'Artículo listo para la venta',
        `Se creó una existencia separada como artículo defectuoso con precio de $${Number(newPrice).toFixed(2)} CUP.`,
        'success'
      );
      return true;
    } catch (err: any) {
      showToast('Error al preparar la venta', err?.message || 'No se pudo preparar el artículo defectuoso', 'error');
      return false;
    }
  };

  const enviarMermaAlmacen = async (mermaId: string, note?: string): Promise<boolean> => {
    try {
      if (window.api.mermas) {
        await window.api.mermas.enviarAlmacen(mermaId, note);
      } else {
        const raw = localStorage.getItem('ipv_mermas_v2');
        const mermas: MermaItem[] = raw ? JSON.parse(raw) : [];
        const item = mermas.find((merma) => merma.id === mermaId);
        if (!item) throw new Error('Artículo de merma no encontrado');
        const product = products.find((entry) => entry.id === item.productId);
        if (!product) throw new Error('No se encontró el producto original para enviarlo al almacén.');
        product.almacenStock = (product.almacenStock || 0) + item.quantity;
        item.status = 'devuelto_a_almacen';
        item.resolvedAt = todayDate;
        item.resolutionNote = note || 'Enviado al almacén central para reponerlo al mostrador cuando sea necesario.';
        setMermaItems([...mermas]);
        localStorage.setItem('ipv_mermas_v2', JSON.stringify(mermas));
        localStorage.setItem('ipv_products_v2', JSON.stringify(products));
      }
      await refreshAll();
      showToast(
        'Artículo enviado al almacén',
        'La cantidad quedó disponible en el almacén central; puede reponerla al mostrador desde Productos.',
        'success'
      );
      return true;
    } catch (err: any) {
      showToast('Error al enviar al almacén', err?.message || 'No se pudo enviar el artículo al almacén', 'error');
      return false;
    }
  };

  const darDeBajaMermaItem = async (mermaId: string, note?: string): Promise<boolean> => {
    try {
      if (window.api.mermas) {
        await window.api.mermas.darDeBaja(mermaId, note);
      } else {
        const raw = localStorage.getItem('ipv_mermas_v2');
        let mermas: MermaItem[] = raw ? JSON.parse(raw) : [];
        const idx = mermas.findIndex((m) => m.id === mermaId);
        if (idx === -1) throw new Error('Artículo de merma no encontrado');

        mermas[idx].status = 'baja_definitiva';
        mermas[idx].resolvedAt = todayDate;
        mermas[idx].resolutionNote = note || 'Baja definitiva por daño irreparable / inutilizable';
        setMermaItems([...mermas]);
        localStorage.setItem('ipv_mermas_v2', JSON.stringify(mermas));
      }
      await refreshAll();
      showToast('Baja Definitiva Registrada', 'El artículo ha sido dado de baja en el almacén de merma.', 'info');
      return true;
    } catch (err: any) {
      showToast('Error al dar de baja', err?.message || 'No se pudo dar de baja el artículo', 'error');
      return false;
    }
  };

  const revocarMermaItem = async (mermaId: string): Promise<boolean> => {
    try {
      if (window.api.mermas?.revocar) {
        await window.api.mermas.revocar(mermaId);
      } else {
        const raw = localStorage.getItem('ipv_mermas_v2');
        const mermas: MermaItem[] = raw ? JSON.parse(raw) : [];
        const item = mermas.find((merma) => merma.id === mermaId);
        if (!item) throw new Error('Artículo de merma no encontrado');
        if (item.status === 'en_almacen_merma') throw new Error('El artículo todavía está pendiente.');

        if (item.status === 'reincorporado_con_precio') {
          let defectiveProductId = item.defectiveProductId;
          if (!defectiveProductId) {
            const candidates = products.filter((product) =>
              product.code.startsWith('MERMA-') &&
              product.name === `${item.name} (Defectuoso)` &&
              product.detail === `Artículo defectuoso: ${item.damagedReason}` &&
              product.category === 'Defectuoso' &&
              product.price === Number(item.discountedPrice) &&
              product.stock === Number(item.quantity) &&
              Number(product.almacenStock || 0) === 0 &&
              product.createdAt?.slice(0, 10) === item.resolvedAt &&
              !sales.some((sale) => sale.items.some((saleItem) => saleItem.productId === product.id))
            );
            if (candidates.length !== 1) {
              throw new Error('No se puede revocar con seguridad: no se encontró un único artículo defectuoso intacto asociado.');
            }
            defectiveProductId = candidates[0].id;
          }
          const defectiveProduct = products.find((product) => product.id === defectiveProductId);
          const hasSales = sales.some((sale) => sale.items.some((saleItem) => saleItem.productId === defectiveProductId));
          if (!defectiveProduct || defectiveProduct.stock !== item.quantity || defectiveProduct.almacenStock !== 0 || hasSales) {
            throw new Error('No se puede revocar: el artículo defectuoso ya se vendió o su existencia cambió.');
          }
          await window.api.products.archive(defectiveProductId);
        } else if (item.status === 'devuelto_a_almacen') {
          const product = products.find((entry) => entry.id === item.productId);
          if (!product || (product.almacenStock || 0) < item.quantity) {
            throw new Error('No se puede revocar: no hay suficiente existencia en el almacén para devolver la cantidad.');
          }
          await window.api.products.update(item.productId, { almacenStock: Number(product.almacenStock || 0) - item.quantity });
        }

        item.status = 'en_almacen_merma';
        item.discountedPrice = undefined;
        item.defectiveProductId = undefined;
        item.resolvedAt = undefined;
        item.resolutionNote = undefined;
        setMermaItems(mermas);
        localStorage.setItem('ipv_mermas_v2', JSON.stringify(mermas));
      }
      await refreshAll();
      showToast('Acción revocada', 'El artículo volvió a quedar pendiente en el almacén de mermas.', 'success');
      return true;
    } catch (err: any) {
      showToast('Error al revocar la acción', err?.message || 'No se pudo revocar la acción del artículo', 'error');
      return false;
    }
  };

  // Modales de venta
  const openSaleModal = (productOrRow?: Product | IPVRow | null) => {
    if (licenseReadOnly) {
      showToast(
        'Operación bloqueada',
        licenseStatus === 'clock_rollback'
          ? 'Corrija la fecha y hora del sistema para volver a operar.'
          : 'La licencia venció. Renueve la licencia para registrar ventas.',
        'error'
      );
      return;
    }
    if (!isAppActivated && !isTrialActive) {
      navigateToActivation();
      showToast('Aplicación Sin Activar', 'Debe activar la aplicación con su código firmado para operar el punto de venta.', 'error');
      return;
    }
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

  const resetApplication = async (password: string): Promise<boolean> => {
    try {
      setIsLoading(true);
      await window.api.backup.resetApplication(password);
      for (const key of [
        'ipv_products_v2',
        'ipv_sales_v2',
        'ipv_closes_v2',
        'ipv_returns_v2',
        'ipv_mermas_v2',
        'ipv_date_v2',
        'ipv_fallback_products_v1',
        'ipv_fallback_sales_v1',
        'ipv_fallback_closes_v1',
        'ipv_fallback_date_v1',
        'ferrestock_products',
        'ferrestock_sales',
        'ferrestock_last_backup_info',
        'ferrestock_backup_history',
      ]) {
        localStorage.removeItem(key);
      }
      setProducts([]);
      setSales([]);
      setReturns([]);
      setMermaItems([]);
      setCurrentIpvDay(null);
      setIsCurrentDayClosed(false);
      setBackupRecords([]);
      setMenoresAmount(0);
      setTransferenciasAmount(0);
      setDenominations(INITIAL_DENOMINATIONS.map((d) => ({ ...d, count: 0 })));
      setSelectedProductId(null);
      setSelectedIpvDate(todayDate);
      await refreshAll();
      showToast(
        'Aplicación Restablecida',
        'Todos los datos han sido borrados. La aplicación ha comenzado desde cero.',
        'success'
      );
      return true;
    } catch (err: any) {
      showToast('Error al restablecer', getFriendlyErrorMessage(err), 'error');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Licencia y Activación
  const activateApp = useCallback(async (code: string) => {
    const clean = normalizeActivationCode(code);
    if (!clean) {
      return { success: false, message: 'Pegue el código de activación firmado.' };
    }
    if (clean.length < 100 || clean.length > ACTIVATION_CODE_LENGTH) {
      return { success: false, message: 'El código debe contener entre 100 y 124 caracteres.' };
    }

    if (!window.api?.license) {
      return { success: false, message: 'La verificación digital solo está disponible en la aplicación de escritorio.' };
    }

    try {
      const status = await window.api.license.activate(clean);
      applyLicenseStatus(status);
      showToast('¡Aplicación Activada!', 'La licencia ha sido validada y guardada en la base de datos.', 'success');
      return { success: true, message: 'Aplicación activada con éxito.' };
    } catch (error: unknown) {
      return { success: false, message: getFriendlyErrorMessage(error) };
    }
  }, [applyLicenseStatus, showToast]);

  const navigateToActivation = useCallback(() => {
    setCurrentView('configuracion');
    setSettingsTab('licencia');
  }, []);

  const licenseReadOnly = licenseHasRecord && licenseStatus !== 'valid';
  const hasAppAccess = isAppActivated || isTrialActive || licenseHasRecord;

  const updateResetPassword = useCallback((currentPass: string, newPass: string) => {
    const saved = localStorage.getItem('ferrestock_reset_password') || 'adminreset';
    if (currentPass.trim() !== saved.trim()) {
      return { success: false, message: 'La contraseña actual de reinicio no coincide.' };
    }
    if (newPass.trim().length < 4) {
      return { success: false, message: 'La nueva contraseña debe tener al menos 4 caracteres.' };
    }
    localStorage.setItem('ferrestock_reset_password', newPass.trim());
    setResetPasswordKey(newPass.trim());
    showToast('Contraseña Actualizada', 'La contraseña de seguridad para restablecimiento ha sido modificada con éxito.', 'success');
    return { success: true, message: 'Contraseña actualizada correctamente.' };
  }, [showToast]);

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
        reponerProduct,
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
        resetApplication,
        sales,
        totalVentasEfectivo,
        totalVentasTransferencia,
        recordSale,
        cancelSale,
        returns,
        addReturn,
        totalDevolucionesToday,
        totalDevolucionesEfectivoToday,
        totalDevolucionesTransferenciaToday,
        mermaItems,
        venderMermaConDescuento,
        enviarMermaAlmacen,
        darDeBajaMermaItem,
        revocarMermaItem,
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
        isLoading,
        isAppActivated,
        isTrialActive,
        trialDaysRemaining,
        hasAppAccess,
        licenseStatus,
        licenseReadOnly,
        licenseExpiryDate,
        licenseDaysRemaining,
        licenseType,
        installationId,
        activationKey,
        activatedAt,
        activateApp,
        settingsTab,
        setSettingsTab,
        navigateToActivation,
        resetPasswordKey,
        updateResetPassword,
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
