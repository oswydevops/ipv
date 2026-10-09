import React, { useState } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  Legend,
} from 'recharts';
import { useApp } from '../context/AppContext';
import { TOP_PRODUCTS } from '../data/initialData';

// Data for Hourly Trend (Today)
interface TrendDataPoint {
  label: string;
  ventas: number;
  transacciones: number;
  meta?: number;
}

const HOURLY_DATA: TrendDataPoint[] = [
  { label: '08:00', ventas: 4200, transacciones: 2, meta: 3500 },
  { label: '10:00', ventas: 8900, transacciones: 3, meta: 7000 },
  { label: '12:00', ventas: 14500, transacciones: 5, meta: 11000 },
  { label: '14:00', ventas: 9800, transacciones: 4, meta: 9000 },
  { label: '16:00', ventas: 7450, transacciones: 3, meta: 8000 },
  { label: '18:00', ventas: 3800, transacciones: 2, meta: 3000 },
];

// Data for 7-Day Trend
const WEEKLY_TREND: TrendDataPoint[] = [
  { label: 'Lun 18', ventas: 41200, transacciones: 18 },
  { label: 'Mar 19', ventas: 68400, transacciones: 29 },
  { label: 'Mié 20', ventas: 44500, transacciones: 21 },
  { label: 'Jue 21', ventas: 46800, transacciones: 22 },
  { label: 'Vie 22', ventas: 52100, transacciones: 25 },
  { label: 'Sáb 23', ventas: 43280, transacciones: 19 },
  { label: 'Hoy 24', ventas: 48650, transacciones: 24 },
];

// Category Revenue Distribution
const CATEGORY_DISTRIBUTION = [
  { category: 'Plomería', total: 24700, porcentaje: 50.8, color: '#6366f1' },
  { category: 'Electricidad', total: 11200, porcentaje: 23.0, color: '#7c3aed' },
  { category: 'Tornillería', total: 6450, porcentaje: 13.3, color: '#3b82f6' },
  { category: 'Herramientas', total: 4200, porcentaje: 8.6, color: '#10b981' },
  { category: 'Pinturas', total: 2100, porcentaje: 4.3, color: '#f59e0b' },
];

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

export const DashboardView: React.FC = () => {
  const {
    ipvTotalVendido,
    ipvTotalUnidades,
    totalGeneralContado,
    products,
    setCurrentView,
    showToast,
  } = useApp();

  const [trendView, setTrendView] = useState<'hourly' | 'weekly'>('hourly');

  const zeroStockCount = products.filter((p) => p.stock === 0).length;
  const lowStockCount = products.filter((p) => p.stock > 0 && p.stock <= p.minStock).length;

  const formatCUP = (val: number) => {
    return Number(val).toLocaleString('es-CU', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const chartData = trendView === 'hourly' ? HOURLY_DATA : WEEKLY_TREND;

  return (
    <div className="flex flex-col w-full gap-7 pb-16 select-none">
      {/* Top Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl lg:text-3xl font-headline font-bold text-on-surface tracking-tight">
            Dashboard de Rendimiento Diario
          </h1>
          <p className="text-xs lg:text-sm text-on-surface-variant">
            Resumen en vivo de ventas del día, recaudación en efectivo, productos líderes y curvas de tendencia.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => showToast('Datos Actualizados', 'Saldos y curvas sincronizados con SQLite.')}
            className="h-10 px-4 rounded-xl bg-surface neo-raised flex items-center gap-2 text-xs font-semibold text-on-surface hover:text-primary transition-all active:neo-inset"
            type="button"
          >
            <span className="material-symbols-outlined text-[18px]">sync</span>
            <span>Actualizar</span>
          </button>
          <button
            onClick={() => setCurrentView('ipv-del-dia')}
            className="h-10 px-4 rounded-xl bg-surface neo-raised flex items-center gap-2 text-xs font-semibold text-primary hover:text-tertiary transition-all active:neo-inset"
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

      {/* 3 Bento KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
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
              +12.4%
            </span>
            <span className="text-[11px] text-on-surface-variant font-medium">vs ayer (43,280 CUP)</span>
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
            <span>Ticket prom.: <strong>{formatCUP(ipvTotalVendido / (ipvTotalUnidades || 1))} CUP</strong></span>
            <span className="w-2 h-2 rounded-full bg-primary/70"></span>
          </div>
        </div>

        {/* Metric 3: Inventario en Alerta */}
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
              className="text-primary font-semibold hover:underline flex items-center gap-1"
            >
              <span>Resolver en reposición</span>
              <span className="material-symbols-outlined text-[13px]">arrow_forward</span>
            </button>
            <span className="w-2 h-2 rounded-full bg-error animate-pulse"></span>
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
                className={`px-3 py-1.5 rounded-lg text-xs transition-all ${
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
                className={`px-3 py-1.5 rounded-lg text-xs transition-all ${
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
                  <linearGradient id="colorMeta" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#7c3aed" stopOpacity={0.0} />
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
                {trendView === 'hourly' && (
                  <Area
                    type="monotone"
                    dataKey="meta"
                    name="meta"
                    stroke="#7c3aed"
                    strokeWidth={2}
                    strokeDasharray="4 4"
                    fill="url(#colorMeta)"
                    fillOpacity={0.5}
                  />
                )}
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="flex flex-wrap items-center justify-between text-xs text-on-surface-variant pt-2 border-t border-outline-variant/20">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-primary"></span>
                Recaudación en CUP
              </span>
              {trendView === 'hourly' && (
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-0.5 bg-tertiary"></span>
                  Meta de turno
                </span>
              )}
            </div>
            <span className="font-medium text-on-surface font-mono">
              Pico máximo registrado: <strong>68,400.00 CUP</strong>
            </span>
          </div>
        </div>

        {/* Category Breakdown (4 cols) */}
        <div className="lg:col-span-4 p-6 rounded-2xl bg-surface neo-raised flex flex-col justify-between gap-4">
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <h2 className="text-base font-headline font-bold text-on-surface">
                Ventas por Categoría
              </h2>
              <span className="text-xs text-on-surface-variant">Distribución del flujo de caja</span>
            </div>
            <span className="material-symbols-outlined text-primary text-[20px]">category</span>
          </div>

          {/* Recharts Horizontal Bar Chart */}
          <div className="w-full h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={CATEGORY_DISTRIBUTION}
                layout="vertical"
                margin={{ top: 5, right: 10, left: 15, bottom: 5 }}
              >
                <XAxis type="number" hide />
                <YAxis
                  dataKey="category"
                  type="category"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#2e3040', fontSize: 11, fontWeight: 600 }}
                  width={75}
                />
                <Tooltip
                  formatter={(value) => [`$${formatCUP(Number(value) || 0)} CUP`, 'Total']}
                  contentStyle={{
                    backgroundColor: '#e8eaf0',
                    borderRadius: '0.75rem',
                    boxShadow: '4px 4px 10px rgba(0,0,0,0.08), -4px -4px 10px rgba(255,255,255,0.7)',
                    border: 'none',
                    fontSize: '11px',
                    fontWeight: 600,
                  }}
                />
                <Bar dataKey="total" radius={[0, 8, 8, 0]}>
                  {CATEGORY_DISTRIBUTION.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Category detail list */}
          <div className="flex flex-col gap-2 pt-2 border-t border-outline-variant/20">
            {CATEGORY_DISTRIBUTION.slice(0, 3).map((cat) => (
              <div key={cat.category} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.color }}></span>
                  <span className="font-medium text-on-surface">{cat.category}</span>
                </div>
                <div className="flex items-center gap-2 font-mono">
                  <span className="font-bold text-on-surface">${formatCUP(cat.total)}</span>
                  <span className="text-[10px] text-on-surface-variant font-semibold">
                    ({cat.porcentaje}%)
                  </span>
                </div>
              </div>
            ))}
          </div>
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
            className="h-9 px-3.5 rounded-xl bg-surface neo-raised text-xs font-semibold text-primary hover:text-on-surface active:neo-inset transition-all flex items-center gap-1.5 self-start sm:self-auto"
            type="button"
          >
            <span>Ver Catálogo Maestro</span>
            <span className="material-symbols-outlined text-[15px]">arrow_forward</span>
          </button>
        </div>

        {/* Product Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {TOP_PRODUCTS.slice(0, 3).map((item) => (
            <div
              key={item.rank}
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
                  {item.percentage}% tienda
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-outline-variant/20 text-xs">
                <div>
                  <span className="text-[10px] text-on-surface-variant block uppercase">Vendidos</span>
                  <span className="font-mono font-bold text-on-surface">{item.soldUnits} u.</span>
                </div>
                <div>
                  <span className="text-[10px] text-on-surface-variant block uppercase">Unitario</span>
                  <span className="font-mono font-bold text-on-surface">${item.unitPrice.toFixed(0)}</span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-on-surface-variant block uppercase">Recaudado</span>
                  <span className="font-mono font-bold text-primary">${formatCUP(item.totalIncome)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
