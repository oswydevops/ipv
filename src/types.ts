export type ViewType = 
  | 'dashboard'
  | 'ipv-del-dia'
  | 'historial-ventas'
  | 'devoluciones'
  | 'alertas-de-stock'
  | 'cierre-de-caja'
  | 'reportes'
  | 'productos'
  | 'configuracion'
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
  almacenStock?: number;
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

export interface ReturnItem {
  productId: string;
  code: string;
  name: string;
  um: string;
  quantity: number;
  unitPrice: number;
  refundAmount: number;
  condition: 'mal_estado' | 'buen_estado';
  damagedReason?: string;
  reintegrateToStock: boolean;
}

export interface ReturnRecord {
  id: string;
  returnNumber: string;
  saleId?: string;
  ticketNumber?: string;
  date: string;
  timestamp: string;
  items: ReturnItem[];
  totalRefund: number;
  refundMethod: 'efectivo' | 'transferencia' | 'mixto';
  efectivoAmount?: number;
  transferenciaAmount?: number;
  customerName?: string;
  reason: string;
  hasDamagedItems: boolean;
  createdAt: string;
}

export interface MermaItem {
  id: string;
  returnId: string;
  returnNumber: string;
  date: string;
  productId: string;
  code: string;
  name: string;
  um: string;
  quantity: number;
  originalUnitPrice: number;
  damagedReason: string;
  status: 'en_almacen_merma' | 'reincorporado_con_precio' | 'devuelto_a_almacen' | 'baja_definitiva';
  discountedPrice?: number;
  defectiveProductId?: string;
  resolvedAt?: string;
  resolutionNote?: string;
}
