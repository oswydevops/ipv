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
          purchasePrice: Number(input.purchasePrice) || 0,
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
        if (patch.purchasePrice !== undefined && (!Number.isFinite(Number(patch.purchasePrice)) || Number(patch.purchasePrice) < 0)) {
          throw new Error('Precio de compra inválido.');
        }
        if (patch.price !== undefined && (!Number.isFinite(Number(patch.price)) || Number(patch.price) < 0)) {
          throw new Error('Precio de venta inválido.');
        }
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
      async delete(id) {
        products = products.filter((p) => p.id !== id);
        persist();
        return { id, mode: 'deleted' as const };
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
            purchasePrice: Number(prod.purchasePrice) || 0,
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
          let importe = 0;
          let costOfGoods = 0;
          for (const s of daySales) {
            for (const it of s.items) {
              if (it.productId === prod.id) {
                vendido += it.quantity;
                importe += it.subtotal;
                costOfGoods += (Number(it.purchasePrice) || 0) * it.quantity;
              }
            }
          }
          const saldoFinal = prod.stock;
          const entrada = 0;
          const ajuste = 0;
          const saldoIni = saldoFinal + vendido - entrada - ajuste;

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
            costOfGoods,
            grossProfit: importe - costOfGoods,
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

        for (const it of (input.items || [])) {
          mermas.push({
            id: `merma-${id}-${mermas.length + 1}`,
            returnId: id,
            returnNumber,
            date: today,
            productId: it.productId,
            code: it.code,
            name: it.name,
            um: it.um,
            quantity: Number(it.quantity) || 1,
            originalUnitPrice: Number(it.unitPrice) || 0,
            damagedReason: it.condition === 'buen_estado'
              ? 'Artículo en buen estado'
              : input.reason || 'Devolución de cliente',
            condition: it.condition || 'mal_estado',
            status: 'en_almacen_merma',
          });
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
        return getStored<any[]>(STORAGE_KEYS.MERMAS, []).map((item) => {
          if (item.condition) return item;
          const record = returns.find((entry) => entry.id === item.returnId);
          const returnedItem = record?.items?.find((entry: any) =>
            entry.productId === item.productId &&
            entry.code === item.code &&
            entry.name === item.name
          );
          return {
            ...item,
            condition: returnedItem?.condition ||
              (item.damagedReason === 'Artículo en buen estado' ? 'buen_estado' : 'mal_estado'),
          };
        });
      },

      async venderConDescuento(mermaId: string, newPrice: number, note?: string) {
        let mermas = getStored<any[]>(STORAGE_KEYS.MERMAS, []);
        const itemIndex = mermas.findIndex((m) => m.id === mermaId);
        if (itemIndex === -1) throw new Error('Artículo de merma no encontrado');
        const item = mermas[itemIndex];
        if (item.status !== 'en_almacen_merma') throw new Error('Este artículo de merma ya fue procesado');
        const condition = item.condition || (item.damagedReason === 'Artículo en buen estado' ? 'buen_estado' : 'mal_estado');
        if (condition !== 'mal_estado') throw new Error('Solo los artículos en mal estado pueden venderse con descuento como defectuosos.');
        if (!Number.isFinite(Number(newPrice)) || Number(newPrice) <= 0 || Number(newPrice) >= Number(item.originalUnitPrice)) {
          throw new Error('El precio debe ser mayor que cero y menor que el precio original.');
        }
        const source = products.find((p) => p.id === item.productId);
        if (!source) throw new Error('No se encontró el producto original.');
        const defectiveProduct: Product = {
          ...source,
          id: `prod-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          code: `MERMA-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
          name: `${item.name} (Defectuoso)`,
          detail: `Artículo defectuoso: ${item.damagedReason}`,
          category: 'Defectuoso',
          price: Number(newPrice),
          stock: Number(item.quantity),
          minStock: 1,
          almacenStock: 0,
          status: 'ok',
          createdAt: getTodayStr(),
        };
        products.push(defectiveProduct);
        item.status = 'reincorporado_con_precio';
        item.discountedPrice = Number(newPrice);
        item.defectiveProductId = defectiveProduct.id;
        item.resolvedAt = getTodayStr();
        item.resolutionNote = note || `Preparado para venta como defectuoso con precio de $${Number(newPrice).toFixed(2)}`;
        setStored(STORAGE_KEYS.MERMAS, mermas);
        persist();
        return item;
      },

      async enviarAlmacen(mermaId: string, note?: string) {
        const mermas = getStored<any[]>(STORAGE_KEYS.MERMAS, []);
        const item = mermas.find((m) => m.id === mermaId);
        if (!item) throw new Error('Artículo de merma no encontrado');
        if (item.status !== 'en_almacen_merma') throw new Error('Este artículo de merma ya fue procesado');
        const condition = item.condition || (item.damagedReason === 'Artículo en buen estado' ? 'buen_estado' : 'mal_estado');
        if (condition !== 'buen_estado') throw new Error('Solo los artículos en buen estado pueden enviarse al almacén central.');
        const product = products.find((p) => p.id === item.productId);
        if (!product) throw new Error('No se encontró el producto original.');
        product.almacenStock = (Number(product.almacenStock) || 0) + Number(item.quantity);
        item.status = 'devuelto_a_almacen';
        item.resolvedAt = getTodayStr();
        item.resolutionNote = note || 'Enviado al almacén central para reponerlo al mostrador cuando sea necesario.';
        setStored(STORAGE_KEYS.MERMAS, mermas);
        persist();
        return item;
      },

      async enviarAStock(mermaId: string, note?: string) {
        const mermas = getStored<any[]>(STORAGE_KEYS.MERMAS, []);
        const item = mermas.find((m) => m.id === mermaId);
        if (!item) throw new Error('Artículo de merma no encontrado');
        if (item.status !== 'en_almacen_merma') throw new Error('Este artículo de merma ya fue procesado');
        const condition = item.condition || (item.damagedReason === 'Artículo en buen estado' ? 'buen_estado' : 'mal_estado');
        if (condition !== 'buen_estado') throw new Error('Solo los artículos en buen estado pueden volver al stock.');
        const product = products.find((p) => p.id === item.productId);
        if (!product) throw new Error('No se encontró el producto original.');
        product.stock += Number(item.quantity);
        product.status = product.stock === 0 ? 'out' : product.stock <= product.minStock ? 'low' : 'ok';
        item.status = 'reintegrado_a_stock';
        item.resolvedAt = getTodayStr();
        item.resolutionNote = note || 'Reintegrado al stock disponible.';
        setStored(STORAGE_KEYS.MERMAS, mermas);
        persist();
        return item;
      },

      async darDeBaja(mermaId: string, note?: string) {
        const mermas = getStored<any[]>(STORAGE_KEYS.MERMAS, []);
        const item = mermas.find((m) => m.id === mermaId);
        if (!item) throw new Error('Artículo de merma no encontrado');
        if (item.status !== 'en_almacen_merma') throw new Error('Este artículo de merma ya fue procesado');
        const condition = item.condition || (item.damagedReason === 'Artículo en buen estado' ? 'buen_estado' : 'mal_estado');
        if (condition !== 'mal_estado') throw new Error('Solo los artículos en mal estado pueden darse de baja.');
        item.status = 'baja_definitiva';
        item.resolvedAt = getTodayStr();
        item.resolutionNote = note || 'Baja definitiva por daño o merma irreparable';
        setStored(STORAGE_KEYS.MERMAS, mermas);
        persist();
        return item;
      },

      async revocar(mermaId: string) {
        const mermas = getStored<any[]>(STORAGE_KEYS.MERMAS, []);
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
          if (!defectiveProduct || defectiveProduct.stock !== Number(item.quantity) || Number(defectiveProduct.almacenStock || 0) !== 0 || hasSales) {
            throw new Error('No se puede revocar: el artículo defectuoso ya se vendió o su existencia cambió.');
          }
          products = products.filter((product) => product.id !== defectiveProductId);
        } else if (item.status === 'devuelto_a_almacen') {
          const product = products.find((entry) => entry.id === item.productId);
          const warehouseStock = Number(product?.almacenStock || 0);
          if (!product || warehouseStock < Number(item.quantity)) {
            throw new Error('No se puede revocar: no hay suficiente existencia en el almacén para devolver la cantidad.');
          }
          product.almacenStock = warehouseStock - Number(item.quantity);
        } else if (item.status === 'reintegrado_a_stock') {
          const product = products.find((entry) => entry.id === item.productId);
          if (!product || product.stock < Number(item.quantity)) {
            throw new Error('No se puede revocar: no hay suficiente existencia en stock para devolver la cantidad.');
          }
          product.stock -= Number(item.quantity);
          product.status = product.stock === 0 ? 'out' : product.stock <= product.minStock ? 'low' : 'ok';
        }

        item.status = 'en_almacen_merma';
        item.discountedPrice = undefined;
        item.defectiveProductId = undefined;
        item.resolvedAt = undefined;
        item.resolutionNote = undefined;
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
