import React, { useState, useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { useApp } from '../context/AppContext';

interface TrendDataPoint {
  label: string;
  ventas: number;
  transacciones: number;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    value: number;
    name: string;
    color?: string;
  }>;
  label?: string;
}

const CustomTooltip: React.FC<CustomTooltipProps> = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-xl bg-surface neo-raised p-3 border border-outline-variant/30 shadow-xl text-xs flex flex-col gap-1.5">
        <span className="font-bold text-on-surface text-[11px] pb-1 border-b border-outline-variant/20">
          Franja: {label}
        </span>
        {payload.map((entry, index) => (
          <div key={`tooltip-${index}`} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-on-surface-variant text-[11px]">
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: entry.color || '#6366f1' }}
              ></span>
              {entry.name === 'ventas' ? 'Ventas' : entry.name === 'transacciones' ? 'Operaciones' : entry.name}:
            </span>
            <span className="font-mono font-bold text-on-surface text-[11px]">
              {entry.name === 'ventas' || entry.name === 'meta'
                ? `$${Number(entry.value).toLocaleString('es-CU', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })} CUP`
                : `${entry.value} ops`}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

interface CategoryPieTooltipProps {
  active?: boolean;
  payload?: Array<{
    payload: {
      category: string;
      total: number;
      units: number;
      porcentaje: number;
      color: string;
    };
  }>;
}

const CategoryPieTooltip: React.FC<CategoryPieTooltipProps> = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="rounded-xl bg-surface neo-raised p-3 border border-outline-variant/30 shadow-xl text-xs flex flex-col gap-1.5 min-w-[170px] z-50">
        <div className="flex items-center gap-2 pb-1.5 border-b border-outline-variant/20">
          <span
            className="w-3 h-3 rounded-md shrink-0 shadow-sm"
            style={{ backgroundColor: data.color }}
          />
          <span className="font-bold text-on-surface text-xs truncate">{data.category}</span>
        </div>
        <div className="flex items-center justify-between gap-3 text-[11px]">
          <span className="text-on-surface-variant font-medium">Recaudación:</span>
          <span className="font-mono font-bold text-on-surface">
            ${Number(data.total).toLocaleString('es-CU', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })} CUP
          </span>
        </div>
        <div className="flex items-center justify-between gap-3 text-[11px]">
          <span className="text-on-surface-variant font-medium">Unidades:</span>
          <span className="font-mono font-semibold text-on-surface">{data.units} uds</span>
        </div>
        <div className="flex items-center justify-between gap-3 text-[11px] pt-1 border-t border-outline-variant/10">
          <span className="text-on-surface-variant font-medium">Participación:</span>
          <span
            className="font-mono font-bold px-1.5 py-0.5 rounded-md text-[11px]"
            style={{ backgroundColor: `${data.color}20`, color: data.color }}
          >
            {data.porcentaje}%
          </span>
        </div>
      </div>
    );
  }
  return null;
};

const CATEGORY_COLORS = [
  '#6366f1', // Indigo
  '#06b6d4', // Cyan
  '#8b5cf6', // Violet
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#ec4899', // Pink
  '#3b82f6', // Blue
  '#14b8a6', // Teal
];

export const DashboardView: React.FC = () => {
  const {
    ipvTotalVendido,
    ipvTotalUnidades,
    totalGeneralContado,
    products,
    ipvRows,
    sales,
    returns = [],
    totalDevolucionesToday,
    todayDate,
    setCurrentView,
    refreshAll,
    showToast,
  } = useApp();

  const [trendView, setTrendView] = useState<'hourly' | 'weekly'>('hourly');
  const [hoveredCategoryIndex, setHoveredCategoryIndex] = useState<number | null>(null);

  const zeroStockCount = products.filter((p) => p.stock === 0).length;
  const lowStockCount = products.filter((p) => p.stock > 0 && p.stock <= p.minStock).length;

  const returnsToday = useMemo(() => {
    return returns.filter((r) => r.date === todayDate);
  }, [returns, todayDate]);

  const damagedUnitsToday = useMemo(() => {
    return returnsToday.reduce((acc, r) => {
      const damaged = (r.items || [])
        .filter((it) => it.condition === 'mal_estado')
        .reduce((s, it) => s + (it.quantity || 1), 0);
      return acc + damaged;
    }, 0);
  }, [returnsToday]);

  const returnedUnitsToday = useMemo(() => {
    return returnsToday.reduce((acc, r) => {
      const qty = (r.items || []).reduce((s, it) => s + (it.quantity || 1), 0);
      return acc + qty;
    }, 0);
  }, [returnsToday]);

  const formatCUP = (val: number) => {
    return Number(val).toLocaleString('es-CU', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  // Cálculo de líderes de venta reales a partir de ipvRows
  const topProducts = useMemo(() => {
    const soldItems = ipvRows.filter((r) => r.vendido > 0);
    if (soldItems.length > 0) {
      const sorted = [...soldItems].sort((a, b) => b.importe - a.importe);
      return sorted.slice(0, 3).map((item, idx) => {
        const pct = ipvTotalVendido > 0 ? (item.importe / ipvTotalVendido) * 100 : 0;
        return {
          rank: idx + 1,
          name: item.name,
          category: item.category || 'General',
          code: item.code,
          soldUnits: item.vendido,
          unitPrice: item.price,
          totalIncome: item.importe,
          percentage: pct.toFixed(1),
        };
      });
    }
    // Si aún no hay ventas hoy, mostrar los 3 productos principales del catálogo
    return products.slice(0, 3).map((p, idx) => ({
      rank: idx + 1,
      name: p.name,
      category: p.category || 'General',
      code: p.code,
      soldUnits: 0,
      unitPrice: p.price,
      totalIncome: 0,
      percentage: '0.0',
    }));
  }, [ipvRows, products, ipvTotalVendido]);

  // Distribución por categorías calculada estrictamente a partir de ventas reales
  const categoryDistribution = useMemo(() => {
    const catMap = new Map<string, { total: number; units: number }>();

    // Mapeo rápido de categoría de producto por ID o código
    const productCatMap = new Map<string, string>();
    products.forEach((p) => {
      if (p.category) {
        productCatMap.set(p.id, p.category);
        productCatMap.set(p.code, p.category);
      }
    });
    ipvRows.forEach((r) => {
      if (r.category) {
        productCatMap.set(r.productId, r.category);
        productCatMap.set(r.code, r.category);
      }
    });

    let hasSales = false;

    // 1. Acumular a partir de los tickets de venta (excluyendo ventas anuladas)
    const activeSales = sales.filter((s) => !(s as any).voided);
    if (activeSales.length > 0) {
      activeSales.forEach((s) => {
        (s.items || []).forEach((item) => {
          const cat = productCatMap.get(item.productId) || productCatMap.get(item.code) || 'General';
          const cur = catMap.get(cat) || { total: 0, units: 0 };
          cur.total += item.subtotal || 0;
          cur.units += item.quantity || 0;
          catMap.set(cat, cur);
          hasSales = true;
        });
      });
    } else if (ipvTotalVendido > 0) {
      // 2. Si no hay tickets detallados pero hay ventas registradas en IPV del día
      ipvRows.forEach((row) => {
        if (row.vendido > 0) {
          const cat = row.category || 'General';
          const cur = catMap.get(cat) || { total: 0, units: 0 };
          cur.total += row.importe || 0;
          cur.units += row.vendido || 0;
          catMap.set(cat, cur);
          hasSales = true;
        }
      });
    }

    if (!hasSales || catMap.size === 0) {
      return [];
    }

    // Ordenar de mayor a menor según las categorías que más se vendan
    const entries = Array.from(catMap.entries()).sort((a, b) => b[1].total - a[1].total);
    const totalSum = entries.reduce((acc, curr) => acc + curr[1].total, 0) || 1;

    // Mostrar hasta 6 categorías principales y agrupar el resto en "Otras" para cobertura total del 100%
    const maxVisibleCategories = 6;
    let finalCategories: { category: string; total: number; units: number }[] = [];

    if (entries.length <= maxVisibleCategories) {
      finalCategories = entries.map(([category, data]) => ({
        category,
        total: data.total,
        units: data.units,
      }));
    } else {
      const topEntries = entries.slice(0, maxVisibleCategories - 1);
      const otherEntries = entries.slice(maxVisibleCategories - 1);
      const otherTotal = otherEntries.reduce((acc, [, d]) => acc + d.total, 0);
      const otherUnits = otherEntries.reduce((acc, [, d]) => acc + d.units, 0);

      finalCategories = [
        ...topEntries.map(([category, data]) => ({
          category,
          total: data.total,
          units: data.units,
        })),
        {
          category: 'Otras',
          total: otherTotal,
          units: otherUnits,
        },
      ];
    }

    return finalCategories.map((item, idx) => ({
      category: item.category,
      total: item.total,
      units: item.units,
      porcentaje: Number(((item.total / totalSum) * 100).toFixed(1)),
      color: CATEGORY_COLORS[idx % CATEGORY_COLORS.length],
    }));
  }, [sales, ipvRows, products, ipvTotalVendido]);

  const categoryTotalSum = useMemo(() => {
    return categoryDistribution.reduce((acc, curr) => acc + curr.total, 0);
  }, [categoryDistribution]);

  const categoryTotalUnits = useMemo(() => {
    return categoryDistribution.reduce((acc, curr) => acc + curr.units, 0);
  }, [categoryDistribution]);

  const hoveredCategory = hoveredCategoryIndex !== null ? categoryDistribution[hoveredCategoryIndex] : null;

  // Curva horaria calculada a partir de los tickets reales de hoy
  const hourlyData = useMemo<TrendDataPoint[]>(() => {
    const timeSlots = ['08:00', '10:00', '12:00', '14:00', '16:00', '18:00'];
    const slotMap = new Map<string, { ventas: number; transacciones: number }>();
    timeSlots.forEach((slot) => slotMap.set(slot, { ventas: 0, transacciones: 0 }));

    sales.forEach((s) => {
      const hour = parseInt(s.timestamp?.split(':')[0] || '10', 10);
      let targetSlot = '18:00';
      if (hour < 9) targetSlot = '08:00';
      else if (hour < 11) targetSlot = '10:00';
      else if (hour < 13) targetSlot = '12:00';
      else if (hour < 15) targetSlot = '14:00';
      else if (hour < 17) targetSlot = '16:00';

      const cur = slotMap.get(targetSlot) || { ventas: 0, transacciones: 0 };
      cur.ventas += s.total;
      cur.transacciones += 1;
      slotMap.set(targetSlot, cur);
    });

    return timeSlots.map((slot) => {
      const data = slotMap.get(slot)!;
      return {
        label: slot,
        ventas: data.ventas,
        transacciones: data.transacciones,
      };
    });
  }, [sales]);

  const weeklyTrend: TrendDataPoint[] = useMemo(() => {
    const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const now = new Date();
    const points: TrendDataPoint[] = [];

    for (let i = 6; i >= 1; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dayLabel = `${dayNames[d.getDay()]} ${d.getDate()}`;
      points.push({
        label: dayLabel,
        ventas: 0,
        transacciones: 0,
      });
    }

    points.push({
      label: 'Hoy',
      ventas: ipvTotalVendido,
      transacciones: sales.length,
    });

    return points;
  }, [ipvTotalVendido, sales.length]);

  const chartData = trendView === 'hourly' ? hourlyData : weeklyTrend;

  const handleSync = async () => {
    await refreshAll();
    showToast('Datos Sincronizados', 'Saldos, ventas y métricas actualizados desde SQLite.', 'success');
  };

  return (
    <div className="flex flex-col w-full gap-7 pb-16 select-none">
      {/* Top Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl lg:text-3xl font-headline font-bold text-on-surface tracking-tight">
            Dashboard de Rendimiento
          </h1>
          <p className="text-xs lg:text-sm text-on-surface-variant">
            Resumen en vivo de ventas del día, recaudación en efectivo, productos líderes y curvas de tendencia.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleSync}
            className="h-10 px-4 rounded-xl bg-surface neo-raised flex items-center gap-2 text-xs font-semibold text-on-surface hover:text-primary transition-all active:neo-inset cursor-pointer"
            type="button"
          >
            <span className="material-symbols-outlined text-[18px]">sync</span>
            <span>Actualizar</span>
          </button>
          <button
            onClick={() => setCurrentView('ipv-del-dia')}
            className="h-10 px-4 rounded-xl bg-surface neo-raised flex items-center gap-2 text-xs font-semibold text-primary hover:text-tertiary transition-all active:neo-inset cursor-pointer"
            type="button"
          >
            <span className="material-symbols-outlined text-[18px]">point_of_sale</span>
            <span>Ver IPV del Día</span>
          </button>
          <button
            onClick={() => setCurrentView('cierre-de-caja')}
            className="h-10 px-5 rounded-xl bg-primary text-white text-xs font-bold shadow-md shadow-primary/25 hover:bg-primary-container transition-all flex items-center gap-2 cursor-pointer"
            type="button"
          >
            <span className="material-symbols-outlined text-[18px]">lock_clock</span>
            <span>Cierre de Caja</span>
          </button>
        </div>
      </div>

      {/* 4 Bento KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Metric 1: Total Recaudado */}
        <div className="p-5 rounded-2xl bg-surface neo-raised flex flex-col justify-between relative overflow-hidden group">
          <div className="flex items-start justify-between">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold tracking-wide text-on-surface-variant uppercase">
                Total Recaudado Hoy
              </span>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className="text-2xl font-headline font-bold text-on-surface tracking-tight font-mono">
                  ${formatCUP(totalGeneralContado)}
                </span>
              </div>
            </div>
            <div className="w-11 h-11 rounded-xl bg-surface neo-inset flex items-center justify-center text-primary">
              <span className="material-symbols-outlined text-[22px]">payments</span>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-4 pt-3 border-t-0">
            <span className="flex items-center text-xs font-bold text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-full">
              <span className="material-symbols-outlined text-[14px]">trending_up</span>
              En caja activa
            </span>
            <span className="text-[11px] text-on-surface-variant font-medium">
              Vendido IPV: ${formatCUP(ipvTotalVendido)} CUP
            </span>
          </div>
        </div>

        {/* Metric 2: Unidades y Ventas */}
        <div className="p-5 rounded-2xl bg-surface neo-raised flex flex-col justify-between group">
          <div className="flex items-start justify-between">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold tracking-wide text-on-surface-variant uppercase">
                Artículos Vendidos
              </span>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className="text-2xl font-headline font-bold text-on-surface tracking-tight font-mono">
                  {ipvTotalUnidades}
                </span>
                <span className="text-xs font-medium text-on-surface-variant">unidades</span>
              </div>
            </div>
            <div className="w-11 h-11 rounded-xl bg-surface neo-inset flex items-center justify-center text-tertiary">
              <span className="material-symbols-outlined text-[22px]">shopping_cart_checkout</span>
            </div>
          </div>
          <div className="flex items-center justify-between mt-4 pt-3 text-xs text-on-surface-variant">
            <span>
              Ticket prom.:{' '}
              <strong>
                {formatCUP(sales.length > 0 ? ipvTotalVendido / sales.length : 0)} CUP
              </strong>
            </span>
            <span className="text-primary font-medium font-mono">{sales.length} tickets</span>
          </div>
        </div>

        {/* Metric 3: Inventario en Alerta (Stock Crítico) */}
        <div className="p-5 rounded-2xl bg-surface neo-raised flex flex-col justify-between group">
          <div className="flex items-start justify-between">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold tracking-wide text-on-surface-variant uppercase">
                Stock Crítico
              </span>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="text-2xl font-headline font-bold text-error font-mono">
                  {zeroStockCount}
                </span>
                <span className="text-xs font-semibold text-error">en cero</span>
                <span className="text-xs text-on-surface-variant">• {lowStockCount} bajo umbral</span>
              </div>
            </div>
            <div className="w-11 h-11 rounded-xl bg-surface neo-inset flex items-center justify-center text-amber-500">
              <span className="material-symbols-outlined text-[22px]">warning</span>
            </div>
          </div>
          <div className="flex items-center justify-between mt-4 pt-3 text-xs">
            <button
              onClick={() => setCurrentView('alertas-de-stock')}
              className="text-primary font-semibold hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>Resolver en reposición</span>
              <span className="material-symbols-outlined text-[13px]">arrow_forward</span>
            </button>
            {zeroStockCount > 0 && (
              <span className="w-2 h-2 rounded-full bg-error animate-pulse"></span>
            )}
          </div>
        </div>

        {/* Metric 4: Devoluciones del Día (al lado de Stock Crítico) */}
        <div className="p-5 rounded-2xl bg-surface neo-raised flex flex-col justify-between group">
          <div className="flex items-start justify-between">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold tracking-wide text-on-surface-variant uppercase">
                Devoluciones del Día
              </span>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className="text-2xl font-headline font-bold text-amber-600 font-mono">
                  ${formatCUP(totalDevolucionesToday)}
                </span>
                <span className="text-xs font-bold text-amber-600">CUP</span>
              </div>
            </div>
            <div className="w-11 h-11 rounded-xl bg-surface neo-inset flex items-center justify-center text-amber-600">
              <span className="material-symbols-outlined text-[22px]">assignment_return</span>
            </div>
          </div>
          <div className="flex items-center justify-between mt-4 pt-3 text-xs">
            <button
              onClick={() => setCurrentView('devoluciones')}
              className="text-amber-700 hover:text-amber-800 font-semibold hover:underline flex items-center gap-1 cursor-pointer"
              type="button"
            >
              <span>
                {returnsToday.length} {returnsToday.length === 1 ? 'devolución' : 'devoluciones'} ({returnedUnitsToday} u.)
              </span>
              <span className="material-symbols-outlined text-[13px]">arrow_forward</span>
            </button>
            {damagedUnitsToday > 0 ? (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/10 text-red-600 border border-red-500/20">
                {damagedUnitsToday} merma
              </span>
            ) : (
              <span className="text-[11px] text-on-surface-variant font-medium">
                Descontado en caja
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Main Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Trend Area Chart (8 cols) */}
        <div className="lg:col-span-8 p-6 rounded-2xl bg-surface neo-raised flex flex-col justify-between gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[20px]">show_chart</span>
                <h2 className="text-base font-headline font-bold text-on-surface">
                  Curva de Ventas y Tendencia
                </h2>
              </div>
              <span className="text-xs text-on-surface-variant">
                Recaudación en Pesos Cubanos (CUP) por franja temporal
              </span>
            </div>

            {/* Timeframe Switcher */}
            <div className="p-1 rounded-xl bg-surface neo-inset flex items-center gap-1 self-start sm:self-auto">
              <button
                onClick={() => setTrendView('hourly')}
                className={`px-3 py-1.5 rounded-lg text-xs transition-all cursor-pointer ${
                  trendView === 'hourly'
                    ? 'font-semibold text-primary bg-surface neo-raised shadow-sm'
                    : 'font-medium text-on-surface-variant hover:text-on-surface'
                }`}
                type="button"
              >
                Hoy (Horas)
              </button>
              <button
                onClick={() => setTrendView('weekly')}
                className={`px-3 py-1.5 rounded-lg text-xs transition-all cursor-pointer ${
                  trendView === 'weekly'
                    ? 'font-semibold text-primary bg-surface neo-raised shadow-sm'
                    : 'font-medium text-on-surface-variant hover:text-on-surface'
                }`}
                type="button"
              >
                Últimos 7 días
              </button>
            </div>
          </div>

          {/* Recharts Area Component */}
          <div className="w-full h-72 pt-3">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 15, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorVentas" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#d0d2dc" vertical={false} opacity={0.6} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: '#585a68', fontSize: 11, fontWeight: 500 }}
                  axisLine={{ stroke: '#d0d2dc' }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: '#585a68', fontSize: 10, fontWeight: 500 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(val) => `$${(val / 1000).toFixed(0)}k`}
                />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey="ventas"
                  name="ventas"
                  stroke="#6366f1"
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#colorVentas)"
                  dot={{ r: 4, fill: '#e8eaf0', stroke: '#6366f1', strokeWidth: 2 }}
                  activeDot={{ r: 7, fill: '#6366f1', stroke: '#ffffff', strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="flex flex-wrap items-center justify-between text-xs text-on-surface-variant pt-2 border-t border-outline-variant/20">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-primary"></span>
                Recaudación en CUP
              </span>
            </div>
            <span className="font-medium text-on-surface font-mono">
              Total jornada: <strong>${formatCUP(ipvTotalVendido)} CUP</strong>
            </span>
          </div>
        </div>

        {/* Category Breakdown (4 cols) */}
        <div className="lg:col-span-4 p-6 rounded-2xl bg-surface neo-raised flex flex-col justify-between gap-4">
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-headline font-bold text-on-surface">
                  Ventas por Categoría
                </h2>
                {categoryDistribution.length > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold font-mono">
                    {categoryDistribution.length} {categoryDistribution.length === 1 ? 'cat.' : 'cats.'}
                  </span>
                )}
              </div>
              <span className="text-xs text-on-surface-variant">
                Distribución porcentual de recaudación
              </span>
            </div>
            <div className="w-8 h-8 rounded-xl bg-surface neo-inset flex items-center justify-center text-primary">
              <span className="material-symbols-outlined text-[19px]">pie_chart</span>
            </div>
          </div>

          {categoryDistribution.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-center p-4 gap-2.5 text-on-surface-variant">
              <div className="w-14 h-14 rounded-2xl bg-surface neo-inset flex items-center justify-center text-primary/60">
                <span className="material-symbols-outlined text-[30px]">donut_small</span>
              </div>
              <p className="text-xs font-semibold text-on-surface">Sin ventas por categoría aún</p>
              <p className="text-[11px] text-on-surface-variant max-w-[240px] leading-relaxed">
                Este gráfico de pastel se generará automáticamente mostrando la proporción de ventas por categoría a medida que se registren operaciones.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {/* Donut / Pie Chart Container */}
              <div className="relative w-full h-48 flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Tooltip content={<CategoryPieTooltip />} />
                    <Pie
                      data={categoryDistribution}
                      dataKey="total"
                      nameKey="category"
                      cx="50%"
                      cy="50%"
                      innerRadius={46}
                      outerRadius={72}
                      paddingAngle={3}
                      stroke="#e8eaf0"
                      strokeWidth={2}
                      onMouseEnter={(_, index) => setHoveredCategoryIndex(index)}
                      onMouseLeave={() => setHoveredCategoryIndex(null)}
                    >
                      {categoryDistribution.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={entry.color}
                          opacity={hoveredCategoryIndex === null || hoveredCategoryIndex === index ? 1 : 0.35}
                          className="transition-all duration-200 cursor-pointer outline-none"
                        />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>

                {/* Donut Center Display */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none">
                  {hoveredCategory ? (
                    <div className="flex flex-col items-center justify-center text-center px-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant max-w-[85px] truncate">
                        {hoveredCategory.category}
                      </span>
                      <span className="text-base font-extrabold font-mono text-on-surface leading-tight">
                        {hoveredCategory.porcentaje}%
                      </span>
                      <span className="text-[9px] font-mono text-on-surface-variant font-medium">
                        ${formatCUP(hoveredCategory.total)}
                      </span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center text-center px-2">
                      <span className="text-[9px] font-bold uppercase tracking-wider text-on-surface-variant">
                        Total
                      </span>
                      <span className="text-sm font-extrabold font-mono text-on-surface leading-tight">
                        100%
                      </span>
                      <span className="text-[9px] font-mono text-on-surface-variant font-medium">
                        {categoryDistribution.length} cats.
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Categorized Legend List */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between text-[11px] font-semibold text-on-surface-variant px-1">
                  <span>Leyenda por categoría</span>
                  <span>Monto / Cuota</span>
                </div>

                <div className="flex flex-col gap-1.5 max-h-52 overflow-y-auto pr-1">
                  {categoryDistribution.map((cat, idx) => {
                    const isHovered = hoveredCategoryIndex === idx;
                    const isAnyHovered = hoveredCategoryIndex !== null;
                    return (
                      <div
                        key={cat.category}
                        onMouseEnter={() => setHoveredCategoryIndex(idx)}
                        onMouseLeave={() => setHoveredCategoryIndex(null)}
                        className={`p-2 rounded-xl transition-all cursor-pointer flex flex-col gap-1.5 border ${
                          isHovered
                            ? 'bg-surface neo-inset border-primary/30 scale-[1.01]'
                            : isAnyHovered
                            ? 'bg-surface/40 border-transparent opacity-40 hover:opacity-100'
                            : 'bg-surface-container/50 border-transparent hover:bg-surface neo-raised-sm'
                        }`}
                      >
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className="w-3 h-3 rounded-md shrink-0 shadow-sm"
                              style={{ backgroundColor: cat.color }}
                            />
                            <span className="font-semibold text-on-surface truncate text-xs">
                              {cat.category}
                            </span>
                            <span className="text-[10px] text-on-surface-variant px-1.5 py-0.5 rounded-md bg-surface font-medium shrink-0 font-mono">
                              {cat.units} {cat.units === 1 ? 'ud' : 'uds'}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 font-mono shrink-0 ml-2">
                            <span className="font-bold text-on-surface text-xs">
                              ${formatCUP(cat.total)}
                            </span>
                            <span
                              className="text-[11px] font-bold px-1.5 py-0.5 rounded-md font-mono"
                              style={{
                                backgroundColor: `${cat.color}20`,
                                color: cat.color,
                              }}
                            >
                              {cat.porcentaje}%
                            </span>
                          </div>
                        </div>

                        {/* Visual Proportion Bar */}
                        <div className="w-full h-1.5 rounded-full bg-surface-container overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-300"
                            style={{
                              width: `${cat.porcentaje}%`,
                              backgroundColor: cat.color,
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Bottom Summary Strip */}
              <div className="flex items-center justify-between text-xs pt-3 border-t border-outline-variant/20 text-on-surface-variant">
                <span className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[15px] text-primary">analytics</span>
                  <span>Total comercializado:</span>
                </span>
                <span className="font-mono font-bold text-on-surface">
                  ${formatCUP(categoryTotalSum)} CUP
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Top Best Selling Products Section */}
      <div className="rounded-2xl bg-surface neo-raised p-6 flex flex-col gap-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-surface neo-inset flex items-center justify-center text-primary">
              <span className="material-symbols-outlined text-[22px]">leaderboard</span>
            </div>
            <div>
              <h2 className="text-base font-headline font-bold text-on-surface">
                Productos con Mayor Rotación y Recaudación
              </h2>
              <p className="text-xs text-on-surface-variant">
                Líderes de mostrador con impacto directo en el balance de inventario local
              </p>
            </div>
          </div>

          <button
            onClick={() => setCurrentView('productos')}
            className="h-9 px-3.5 rounded-xl bg-surface neo-raised text-xs font-semibold text-primary hover:text-on-surface active:neo-inset transition-all flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
            type="button"
          >
            <span>Ver Catálogo Maestro</span>
            <span className="material-symbols-outlined text-[15px]">arrow_forward</span>
          </button>
        </div>

        {/* Product Cards Grid */}
        {topProducts.length === 0 ? (
          <div className="p-8 rounded-xl bg-surface neo-inset flex flex-col items-center justify-center text-center gap-2">
            <span className="material-symbols-outlined text-[36px] text-on-surface-variant">inventory_2</span>
            <p className="text-sm font-semibold text-on-surface">No hay productos en el inventario aún</p>
            <p className="text-xs text-on-surface-variant">Comience agregando sus productos en el Catálogo Maestro.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {topProducts.map((item) => (
              <div
                key={item.code}
                className="p-4 rounded-xl bg-surface neo-inset flex flex-col justify-between gap-3 group hover:border hover:border-primary/20 transition-all"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-surface neo-raised flex items-center justify-center text-primary font-bold text-xs font-mono">
                      #{item.rank}
                    </div>
                    <div>
                      <h3 className="font-semibold text-xs text-on-surface group-hover:text-primary transition-colors">
                        {item.name}
                      </h3>
                      <span className="text-[10px] text-on-surface-variant font-mono">
                        {item.category} • {item.code}
                      </span>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary-fixed text-on-primary-fixed">
                    {item.percentage}% ventas
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-outline-variant/20 text-xs">
                  <div>
                    <span className="text-[10px] text-on-surface-variant block uppercase">Vendidos</span>
                    <span className="font-mono font-bold text-on-surface">{item.soldUnits} u.</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-on-surface-variant block uppercase">Unitario</span>
                    <span className="font-mono font-bold text-on-surface">${item.unitPrice.toFixed(2)}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-on-surface-variant block uppercase">Recaudado</span>
                    <span className="font-mono font-bold text-primary">${formatCUP(item.totalIncome)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
