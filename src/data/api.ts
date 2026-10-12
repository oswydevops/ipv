import type { Product } from '../types';

export type PaymentMethod = 'efectivo' | 'transferencia' | 'mixto';

export interface SaleItemInput {
  productId: string;
  quantity: number;
  unitPrice?: number; // si se omite, se usa el precio actual del producto
}

export interface SaleInput {
  items: SaleItemInput[];
  paymentMethod: PaymentMethod;
  efectivoAmount?: number; // solo se exige en pago mixto
  transferenciaAmount?: number;
  amountReceived?: number;
  change?: number;
  note?: string;
}

export interface Sale {
  id: string;
  ticketNumber: string;
  date: string; // AAAA-MM-DD
  timestamp: string; // HH:MM
  items: { productId: string; code: string; name: string; um: string; unitPrice: number; quantity: number; subtotal: number }[];
  total: number;
  paymentMethod: PaymentMethod;
  efectivoAmount: number;
  transferenciaAmount: number;
  amountReceived?: number;
  change?: number;
  note?: string;
  voided: boolean;
}

export interface IpvDayRow {
  id: string;
  num: string;
  productId: string;
  code: string;
  name: string;
  category: string;
  detail: string;
  um: string;
  saldoIni: number;
  entrada: number;
  vendido: number;
  ajuste: number; // saldoFinal = saldoIni + entrada - vendido + ajuste
  saldoFinal: number;
  price: number;
  importe: number;
  status: 'normal' | 'low' | 'zero';
}

export interface IpvDay {
  date: string;
  closed: boolean;
  rows: IpvDayRow[];
  totalVendido: number;
  totalUnidades: number;
  sales: { count: number; total: number; efectivo: number; transferencia: number };
}

export interface DenominationInput {
  id: string;
  label: string;
  value: number;
  count: number;
}

export interface DayClose {
  date: string;
  closedAt: string;
  denominations: DenominationInput[];
  menoresAmount: number;
  transferenciasAmount: number;
  totalContado: number;
  totalIpv: number;
  diferencia: number;
  note?: string;
}

export type ApiErrorCode =
  | 'INVALID' | 'NOT_FOUND' | 'CODE_EXISTS' | 'INSUFFICIENT_STOCK' | 'PAYMENT_MISMATCH'
  | 'DAY_CLOSED' | 'ALREADY_VOIDED' | 'BAD_DATE' | 'BAD_BACKUP' | 'INTERNAL';

export type ApiError = Error & { code: ApiErrorCode };

export interface ClockStatus {
  today: string;
  lastActivityDate: string | null;
  warning: boolean;
}

type FileResult = { canceled: true } | { canceled: false; path: string };

export interface IpvApi {
  today(): Promise<string>;
  products: {
    list(): Promise<Product[]>;
    create(input: Partial<Omit<Product, 'id' | 'status' | 'createdAt'>> & { name: string }): Promise<Product>;
    update(id: string, patch: Partial<Omit<Product, 'id' | 'status' | 'createdAt'>>): Promise<Product>;
    archive(id: string): Promise<{ id: string }>;
    addStock(id: string, qty: number, note?: string): Promise<Product>;
  };
  sales: {
    record(input: SaleInput): Promise<Sale>;
    void(id: string): Promise<Sale>;
    listByDate(date: string): Promise<Sale[]>;
    listRange(startDate?: string, endDate?: string): Promise<Sale[]>;
  };
  ipv: { getDay(date: string): Promise<IpvDay> };
  cash: {
    getClose(date: string): Promise<DayClose | null>;
    listCloses(limit?: number): Promise<DayClose[]>;
    closeDay(
      date: string,
      input: { denominations: DenominationInput[]; menoresAmount: number; transferenciasAmount: number; note?: string }
    ): Promise<DayClose>;
    reopenDay(date: string): Promise<{ date: string }>;
  };
  backup: {
    saveSqlite(): Promise<FileResult>;
    saveJson(): Promise<FileResult>;
    restoreJson(): Promise<{ canceled: true } | { canceled: false; restored: Record<string, number> }>;
  };
  clock: {
    status(): Promise<ClockStatus>;
  };
  system: {
    openDateSettings(): Promise<{ opened: boolean } | void>;
  };
}

declare global {
  interface Window {
    api: IpvApi;
  }
}