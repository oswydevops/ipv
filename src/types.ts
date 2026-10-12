export type ViewType = 
  | 'dashboard'
  | 'ipv-del-dia'
  | 'historial-ventas'
  | 'alertas-de-stock'
  | 'cierre-de-caja'
  | 'reportes'
  | 'productos'
  | 'respaldo-y-exportacion';

export interface Product {
  id: string;
  code: string;
  name: string;
  detail: string;
  category: string;
  um: string;
  price: number;
  stock: number;
  minStock: number;
  status: 'ok' | 'low' | 'out';
  rotation?: string;
  provider?: string;
  location?: string;
  lastExit?: string;
  createdAt?: string;
}

export interface IPVRow {
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
  ajuste?: number;
  saldoFinal: number;
  price: number;
  importe: number;
  status: 'normal' | 'low' | 'zero';
  icon: string;
}

export interface Denomination {
  id: string;
  label: string;
  sublabel: string;
  badge: string;
  value: number;
  count: number;
}

export interface BackupRecord {
  id: string;
  fileName: string;
  description: string;
  date: string;
  destination: string;
  size: string;
  status: 'Exitoso' | 'Pendiente' | 'Fallido';
}

export interface TopProduct {
  rank: number;
  code: string;
  name: string;
  category: string;
  icon: string;
  soldUnits: number;
  unitPrice: number;
  totalIncome: number;
  percentage: number;
}

export interface SaleItem {
  productId: string;
  code: string;
  name: string;
  productCode?: string;
  productName?: string;
  um: string;
  unitPrice: number;
  quantity: number;
  subtotal: number;
}

export interface SaleRecord {
  id: string;
  ticketNumber: string;
  timestamp: string;
  date: string;
  items: SaleItem[];
  total: number;
  paymentMethod: 'efectivo' | 'transferencia' | 'mixto';
  efectivoAmount: number;
  transferenciaAmount: number;
  amountReceived?: number;
  change?: number;
  note?: string;
}
