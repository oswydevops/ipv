import type { IpvApi, Sale, SaleInput, IpvDay, DayClose, DenominationInput } from './api';
import type { Product } from '../types';
import { INITIAL_PRODUCTS, INITIAL_IPV_ROWS, INITIAL_DENOMINATIONS } from './initialData';

const STORAGE_KEYS = {
  PRODUCTS: 'ipv_products_v2',
  SALES: 'ipv_sales_v2',
  CLOSES: 'ipv_closes_v2',
  DATE: 'ipv_date_v2',
  RETURNS: 'ipv_returns_v2',
  MERMAS: 'ipv_mermas_v2',
};

// Limpieza automática de datos de prueba / mock anteriores
try {
  localStorage.removeItem('ipv_fallback_products_v1');
  localStorage.removeItem('ipv_fallback_sales_v1');
  localStorage.removeItem('ipv_fallback_closes_v1');
  localStorage.removeItem('ipv_fallback_date_v1');
  localStorage.removeItem('ferrestock_last_backup_info');
} catch {
  // Entornos restringidos sin acceso a storage
}

function getStored<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function setStored<T>(key: string, data: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.warn('Storage quota exceeded or unavailable', e);
  }
}

const pad = (n: number) => String(n).padStart(2, '0');
const getTodayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const purgeOldSales = (list: Sale[]): Sale[] => {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 31);
  const cutoffStr = `${cutoff.getFullYear()}-${pad(cutoff.getMonth() + 1)}-${pad(cutoff.getDate())}`;
  return list.filter((s) => s.date >= cutoffStr);
};

export function createFallbackApi(): IpvApi {
  // Inicializar productos vacíos sin mocks y retener solo el último mes de ventas
  let products = getStored<Product[]>(STORAGE_KEYS.PRODUCTS, []);
  let sales = purgeOldSales(getStored<Sale[]>(STORAGE_KEYS.SALES, []));
  let closes = getStored<DayClose[]>(STORAGE_KEYS.CLOSES, []);
  let returns = getStored<any[]>(STORAGE_KEYS.RETURNS, []);

  const persist = () => {
    setStored(STORAGE_KEYS.PRODUCTS, products);
    setStored(STORAGE_KEYS.SALES, purgeOldSales(sales));
    setStored(STORAGE_KEYS.CLOSES, closes);
    setStored(STORAGE_KEYS.RETURNS, returns);
  };

  return {
    async today() {
      return getTodayStr();
    },

    products: {
      async list() {
        return [...products];
      },
      async create(input) {
        const id = `prod-${Date.now()}`;
        const code = input.code || `PRD-${Math.floor(1000 + Math.random() * 9000)}`;
        const now = new Date();
        const newProd: Product = {
          id,
          code,
          name: input.name,
          detail: input.detail || '',
          category: input.category || 'General',
          um: input.um || 'Unidad',
          price: Number(input.price) || 0,
          stock: Number(input.stock) || 0,
          minStock: Number(input.minStock) || 0,
          almacenStock: Number(input.almacenStock) || 0,
          status: (Number(input.stock) || 0) === 0 ? 'out' : (Number(input.stock) || 0) <= (Number(input.minStock) || 0) ? 'low' : 'ok',
          provider: input.provider || 'Proveedor General',
          location: input.location || 'Almacén Central',
          rotation: input.rotation || 'Normal',
          lastExit: 'Sin registro',
          createdAt: `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()} • ${pad(now.getHours())}:${pad(now.getMinutes())} hrs`,
        };
        products = [newProd, ...products];
        persist();
        return newProd;
      },
      async update(id, patch) {
        const idx = products.findIndex((p) => p.id === id);
        if (idx === -1) throw new Error('Producto no encontrado');
        const updated = { ...products[idx], ...patch };
        if (patch.almacenStock !== undefined) {
          updated.almacenStock = Number(patch.almacenStock) || 0;
        }
        if (patch.stock !== undefined || patch.minStock !== undefined) {
          const s = updated.stock;
          const ms = updated.minStock;
          updated.status = s === 0 ? 'out' : s <= ms ? 'low' : 'ok';
        }
        products[idx] = updated;
        persist();
        return updated;
      },
      async archive(id) {
        products = products.filter((p) => p.id !== id);
        persist();
        return { id };
      },
      async addStock(id, qty, _note) {
        const idx = products.findIndex((p) => p.id === id);
        if (idx === -1) throw new Error('Producto no encontrado');
        const prod = products[idx];
        const newStock = prod.stock + Number(qty);
        prod.stock = newStock;
        prod.status = newStock === 0 ? 'out' : newStock <= prod.minStock ? 'low' : 'ok';
        products[idx] = prod;
        persist();
        return prod;
      },
      async reponerStock(id, qty) {
        const idx = products.findIndex((p) => p.id === id);
        if (idx === -1) throw new Error('Producto no encontrado');
        const prod = products[idx];
        const numQty = Number(qty);
        const disp = prod.almacenStock || 0;
        if (numQty > disp) {
          throw new Error(`No hay suficiente cantidad en almacén. Disponible: ${disp}`);
        }
        prod.almacenStock = disp - numQty;
        prod.stock = prod.stock + numQty;
        prod.status = prod.stock === 0 ? 'out' : prod.stock <= prod.minStock ? 'low' : 'ok';
        products[idx] = prod;
        persist();
        return prod;
      },
    },

    sales: {
      async record(input: SaleInput) {
        const today = getTodayStr();
        const now = new Date();
        const time = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
        const ticketNum = String(1000 + sales.length + 1);

        let total = 0;
        const items = input.items.map((item) => {
          const prod = products.find((p) => p.id === item.productId);
          if (!prod) throw new Error(`Producto ${item.productId} no encontrado`);
          if (prod.stock < item.quantity) {
            throw new Error(`Stock insuficiente para "${prod.name}" (disponible: ${prod.stock})`);
          }
          const unitPrice = item.unitPrice !== undefined ? item.unitPrice : prod.price;
          const subtotal = unitPrice * item.quantity;
          total += subtotal;

          // Reducir stock del producto
          prod.stock -= item.quantity;
          prod.status = prod.stock === 0 ? 'out' : prod.stock <= prod.minStock ? 'low' : 'ok';
          prod.lastExit = `Hoy ${time}`;

          return {
            productId: prod.id,
            code: prod.code,
            name: prod.name,
            um: prod.um,
            unitPrice,
            quantity: item.quantity,
            subtotal,
          };
        });

        const efectivoAmount =
          input.paymentMethod === 'efectivo'
            ? total
            : input.paymentMethod === 'mixto'
            ? Number(input.efectivoAmount) || 0
            : 0;
        const transferenciaAmount =
          input.paymentMethod === 'transferencia'
            ? total
            : input.paymentMethod === 'mixto'
            ? Number(input.transferenciaAmount) || 0
            : 0;

        const saleRecord: Sale = {
          id: `sale-${Date.now()}`,
          ticketNumber: ticketNum,
          date: today,
          timestamp: time,
          items,
          total,
          paymentMethod: input.paymentMethod,
          efectivoAmount,
          transferenciaAmount,
          amountReceived: input.amountReceived,
          change: input.change,
          note: input.note,
          voided: false,
        };

        sales = [saleRecord, ...sales];
        persist();
        return saleRecord;
      },

      async void(id: string) {
        const sale = sales.find((s) => s.id === id);
        if (!sale) throw new Error('Venta no encontrada');
        if (sale.voided) throw new Error('La venta ya fue anulada previamente');

        // Devolver stock
        for (const it of sale.items) {
          const prod = products.find((p) => p.id === it.productId);
          if (prod) {
            prod.stock += it.quantity;
            prod.status = prod.stock === 0 ? 'out' : prod.stock <= prod.minStock ? 'low' : 'ok';
          }
        }

        sale.voided = true;
        persist();
        return sale;
      },

      async listByDate(date: string) {
        return sales.filter((s) => s.date === date);
      },

      async listRange(startDate?: string, endDate?: string) {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - 31);
        const cutoffStr = `${cutoff.getFullYear()}-${pad(cutoff.getMonth() + 1)}-${pad(cutoff.getDate())}`;

        return sales.filter((s) => {
          if (s.date < cutoffStr) return false;
          if (startDate && s.date < startDate) return false;
          if (endDate && s.date > endDate) return false;
          return true;
        });
      },
    },

    ipv: {
      async getDay(date: string): Promise<IpvDay> {
        const isClosed = closes.some((c) => c.date === date);
        const daySales = sales.filter((s) => s.date === date && !s.voided);

        let totalVendido = 0;
        let totalUnidades = 0;
        let totalEfectivo = 0;
        let totalTransferencia = 0;

        for (const s of daySales) {
          totalVendido += s.total;
          totalEfectivo += s.efectivoAmount || 0;
          totalTransferencia += s.transferenciaAmount || 0;
          for (const it of s.items) {
            totalUnidades += it.quantity;
          }
        }

        const rows = products.map((prod, idx) => {
          let vendido = 0;
          for (const s of daySales) {
            for (const it of s.items) {
              if (it.productId === prod.id) {
                vendido += it.quantity;
              }
            }
          }
          const saldoFinal = prod.stock;
          const entrada = 0;
          const ajuste = 0;
          const saldoIni = saldoFinal + vendido - entrada - ajuste;
          const importe = vendido * prod.price;

          const rowStatus: 'normal' | 'low' | 'zero' =
            saldoFinal === 0 ? 'zero' : saldoFinal <= prod.minStock ? 'low' : 'normal';

          return {
            id: `row-${prod.id}`,
            num: String(idx + 1).padStart(3, '0'),
            productId: prod.id,
            code: prod.code,
            name: prod.name,
            category: prod.category,
            detail: prod.detail,
            um: prod.um,
            saldoIni: Math.max(0, saldoIni),
            entrada,
            vendido,
            ajuste,
            saldoFinal,
            price: prod.price,
            importe,
            status: rowStatus,
          };
        });

        return {
          date,
          closed: isClosed,
          rows,
          totalVendido,
          totalUnidades,
          sales: {
            count: daySales.length,
            total: totalVendido,
            efectivo: totalEfectivo,
            transferencia: totalTransferencia,
          },
        };
      },
    },

    cash: {
      async getClose(date: string) {
        return closes.find((c) => c.date === date) || null;
      },
      async listCloses(limit = 30) {
        return closes.slice(0, limit);
      },
      async closeDay(date, input) {
        if (closes.some((c) => c.date === date)) {
          throw new Error('Ese día ya fue cerrado previamente.');
        }
        const now = new Date();
        const closedAt = `${date} ${pad(now.getHours())}:${pad(now.getMinutes())}`;

        const cashSum = (input.denominations || []).reduce(
          (acc, d) => acc + Number(d.value) * Number(d.count),
          0
        );
        const menores = Number(input.menoresAmount) || 0;
        const transf = Number(input.transferenciasAmount) || 0;
        const totalContado = cashSum + menores + transf;

        const daySales = sales.filter((s) => s.date === date && !s.voided);
        const totalIpv = daySales.reduce((acc, s) => acc + s.total, 0);

        const newClose: DayClose = {
          date,
          closedAt,
          denominations: input.denominations,
          menoresAmount: menores,
          transferenciasAmount: transf,
          totalContado,
          totalIpv,
          diferencia: totalContado - totalIpv,
          note: input.note,
        };

        closes = [newClose, ...closes];
        persist();
        return newClose;
      },
      async reopenDay(date: string) {
        const found = closes.some((c) => c.date === date);
        if (!found) throw new Error('Ese día no estaba cerrado.');
        closes = closes.filter((c) => c.date !== date);
        persist();
        return { date };
      },
    },

    backup: {
      async saveSqlite() {
        const today = getTodayStr();
        const fileName = `ipv-respaldo-${today}.sqlite`;
        const data = {
          app: 'IPV Control de Ventas',
          sqliteEmulated: true,
          date: today,
          products,
          sales,
          closes,
        };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/x-sqlite3' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        return { canceled: false, path: `Descargas/${fileName}` };
      },

      async saveJson() {
        const today = getTodayStr();
        const fileName = `ipv-respaldo-${today}.json`;
        const payload = {
          format: 1,
          schema: 1,
          exportedAt: `${today} ${new Date().toLocaleTimeString('es-CU')}`,
          tables: {
            products,
            sales,
            day_closes: closes,
          },
        };
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        return { canceled: false, path: `Descargas/${fileName}` };
      },

      async restoreJson() {
        return new Promise((resolve) => {
          const input = document.createElement('input');
          input.type = 'file';
          input.accept = '.json';
          input.onchange = async (e: any) => {
            const file = e.target.files?.[0];
            if (!file) {
              resolve({ canceled: true });
              return;
            }
            try {
              const text = await file.text();
              const parsed = JSON.parse(text);
              if (parsed.tables && parsed.tables.products) {
                products = parsed.tables.products;
                if (Array.isArray(parsed.tables.sales)) sales = parsed.tables.sales;
                if (Array.isArray(parsed.tables.day_closes)) closes = parsed.tables.day_closes;
                persist();
                resolve({
                  canceled: false,
                  restored: {
                    products: products.length,
                    sales: sales.length,
                    day_closes: closes.length,
                  },
                });
              } else if (Array.isArray(parsed.products)) {
                products = parsed.products;
                if (Array.isArray(parsed.sales)) sales = parsed.sales;
                persist();
                resolve({
                  canceled: false,
                  restored: {
                    products: products.length,
                    sales: sales.length,
                  },
                });
              } else {
                resolve({ canceled: true });
              }
            } catch {
              resolve({ canceled: true });
            }
          };
          input.click();
        });
      },

      async resetApplication(password: string) {
        if (typeof password !== 'string') {
          throw new Error('Contraseña incorrecta.');
        }
        const configuredPassword = localStorage.getItem('ferrestock_reset_password') || 'adminreset';
        if (password.trim() !== configuredPassword.trim()) {
          throw new Error('Contraseña incorrecta.');
        }
        products = [];
        sales = [];
        closes = [];
        returns = [];
        for (const key of [
          STORAGE_KEYS.PRODUCTS,
          STORAGE_KEYS.SALES,
          STORAGE_KEYS.CLOSES,
          STORAGE_KEYS.RETURNS,
          STORAGE_KEYS.MERMAS,
          STORAGE_KEYS.DATE,
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
        return { ok: true };
      },
    },

    reports: {
      async exportarCierre(date: string) {
        const targetDate = date || getTodayStr();
        const [year, month] = targetDate.split('-');
        const dummyPdf = `Documentos/IPV/Reportes/${year}/${month}/cierre-${targetDate}.pdf`;
        const dummyXlsx = `Documentos/IPV/Reportes/${year}/${month}/cierre-${targetDate}.xlsx`;
        return {
          ok: true,
          fecha: targetDate,
          pdfPath: dummyPdf,
          excelPath: dummyXlsx,
          directory: `Documentos/IPV/Reportes/${year}/${month}`,
        };
      },
    },

    returns: {
      async record(input: any) {
        const today = getTodayStr();
        const now = new Date();
        const time = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
        const id = `dev-${Date.now()}`;
        const returnNumber = `DEV-${pad(returns.length + 1)}`;
        const totalRefund = Number(input.totalRefund) || 0;
        const refundMethod = input.refundMethod || 'efectivo';

        let transferenciaAmount = 0;
        let efectivoAmount = 0;
        if (refundMethod === 'efectivo') {
          efectivoAmount = totalRefund;
          transferenciaAmount = 0;
        } else if (refundMethod === 'transferencia') {
          efectivoAmount = 0;
          transferenciaAmount = totalRefund;
        } else if (refundMethod === 'mixto') {
          transferenciaAmount = Math.min(totalRefund, Math.max(0, Number(input.transferenciaAmount) || 0));
          efectivoAmount = Math.max(0, totalRefund - transferenciaAmount);
        }

        let mermas = getStored<any[]>(STORAGE_KEYS.MERMAS, []);

        // 1. Artículos devueltos en buen estado pasan DIRECTAMENTE al almacén para volver a utilizar en stock
        for (const it of (input.items || [])) {
          if (it.condition === 'buen_estado') {
            const prod = products.find((p) => p.id === it.productId || p.code === it.code);
            if (prod) {
              prod.stock += Number(it.quantity) || 0;
              prod.status = prod.stock === 0 ? 'out' : prod.stock <= prod.minStock ? 'low' : 'ok';
            }
          } else if (it.condition === 'mal_estado') {
            // 2. Artículos devueltos en mal estado van al almacén como artículos en merma
            mermas.push({
              id: `merma-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              returnId: id,
              returnNumber,
              date: today,
              productId: it.productId,
              code: it.code,
              name: it.name,
              um: it.um,
              quantity: Number(it.quantity) || 1,
              originalUnitPrice: Number(it.unitPrice) || 0,
              damagedReason: it.damagedReason || 'Mal estado / defecto',
              status: 'en_almacen_merma',
            });
          }
        }
        setStored(STORAGE_KEYS.MERMAS, mermas);

        const hasDamagedItems = (input.items || []).some((it: any) => it.condition === 'mal_estado');

        const record = {
          id,
          returnNumber,
          saleId: input.saleId || undefined,
          ticketNumber: input.ticketNumber || undefined,
          date: today,
          timestamp: time,
          items: input.items || [],
          totalRefund,
          refundMethod,
          efectivoAmount,
          transferenciaAmount,
          customerName: input.customerName || undefined,
          reason: input.reason || 'Devolución de cliente',
          hasDamagedItems,
          createdAt: `${today} ${time}`,
        };

        returns = [record, ...returns];
        persist();
        return record;
      },

      async list() {
        return [...returns];
      },

      async listByDate(date: string) {
        return returns.filter((r) => r.date === date);
      },
    },

    mermas: {
      async list() {
        return getStored<any[]>(STORAGE_KEYS.MERMAS, []);
      },

      async reincorporar(mermaId: string, newPrice: number, note?: string) {
        let mermas = getStored<any[]>(STORAGE_KEYS.MERMAS, []);
        const itemIndex = mermas.findIndex((m) => m.id === mermaId);
        if (itemIndex === -1) throw new Error('Artículo de merma no encontrado');
        const item = mermas[itemIndex];
        item.status = 'reincorporado_con_precio';
        item.discountedPrice = Number(newPrice);
        item.resolvedAt = getTodayStr();
        item.resolutionNote = note || `Reincorporado al almacén con precio de oferta/descuento: $${Number(newPrice).toFixed(2)}`;
        setStored(STORAGE_KEYS.MERMAS, mermas);

        // Reincorporar al inventario de productos
        const existing = products.find((p) => p.id === item.productId || p.code === item.code);
        if (existing) {
          if (Math.abs(existing.price - newPrice) < 0.01) {
            existing.stock += Number(item.quantity) || 1;
            existing.status = existing.stock === 0 ? 'out' : existing.stock <= existing.minStock ? 'low' : 'ok';
          } else {
            const saldoCode = `${item.code}-SALDO`;
            const existingSaldo = products.find((p) => p.code === saldoCode);
            if (existingSaldo) {
              existingSaldo.stock += Number(item.quantity) || 1;
              existingSaldo.price = Number(newPrice);
              existingSaldo.status = existingSaldo.stock === 0 ? 'out' : existingSaldo.stock <= existingSaldo.minStock ? 'low' : 'ok';
            } else {
              const newSaldoProduct: Product = {
                id: `prod-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                code: saldoCode,
                name: `${item.name} (Saldo / Defecto)`,
                detail: `Artículo reincorporado de merma: ${item.damagedReason}`,
                category: existing.category,
                um: item.um,
                price: Number(newPrice),
                stock: Number(item.quantity) || 1,
                minStock: 1,
                status: 'ok',
              };
              products.push(newSaldoProduct);
            }
          }
        }
        persist();
        return item;
      },

      async darDeBaja(mermaId: string, note?: string) {
        let mermas = getStored<any[]>(STORAGE_KEYS.MERMAS, []);
        const itemIndex = mermas.findIndex((m) => m.id === mermaId);
        if (itemIndex === -1) throw new Error('Artículo de merma no encontrado');
        const item = mermas[itemIndex];
        item.status = 'baja_definitiva';
        item.resolvedAt = getTodayStr();
        item.resolutionNote = note || 'Baja definitiva por daño o merma irreparable';
        setStored(STORAGE_KEYS.MERMAS, mermas);
        persist();
        return item;
      },
    },

    _isElectron: false,
  };
}

// Inyectar en window.api únicamente si window.api no existe (navegador / preview web)
if (typeof window !== 'undefined' && !(window as any).api) {
  (window as any).api = createFallbackApi();
}
