import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { IPVRow } from '../types';

interface BarItem {
  label: string;
  sublabel: string;
  value: number;
  formatted: string;
  heightPct: number;
  isPeak?: boolean;
}

interface TrendPoint {
  label: string;
  value: number;
}

interface MonthOption {
  key: string; // 'YYYY-MM'
  name: string; // 'Octubre 2026'
  shortName: string; // 'Oct'
  year: number;
  month: number; // 0-11
}

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

const SHORT_MONTH_NAMES = [
  'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
  'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'
];

type WeekKey = 'sem1' | 'sem2' | 'sem3' | 'sem4';

const WEEKS_DEF: { key: WeekKey; label: string; startDay: number; endDay: number }[] = [
  { key: 'sem1', label: 'Semana 1', startDay: 1, endDay: 7 },
  { key: 'sem2', label: 'Semana 2', startDay: 8, endDay: 14 },
  { key: 'sem3', label: 'Semana 3', startDay: 15, endDay: 21 },
  { key: 'sem4', label: 'Semana 4', startDay: 22, endDay: 31 },
];

export const ReportsView: React.FC = () => {
  const { showToast, sales = [], returns = [], ipvRows = [], products = [], todayDate } = useApp();

  const [periodTab, setPeriodTab] = useState<'semanal' | 'mensual' | 'trimestral'>('semanal');
  const [isMonthDropdownOpen, setIsMonthDropdownOpen] = useState(false);
  const [isWeekDropdownOpen, setIsWeekDropdownOpen] = useState(false);
  const [filterSort, setFilterSort] = useState<'recaudacion' | 'volumen'>('recaudacion');
  const [page, setPage] = useState(1);
  const [isExporting, setIsExporting] = useState(false);

  // Fecha de referencia actual
  const refDate = useMemo(() => {
    if (todayDate) {
      const parts = todayDate.split('-');
      if (parts.length === 3) {
        return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      }
    }
    return new Date();
  }, [todayDate]);

  // Lista de meses disponibles (mes actual y 2 anteriores, más cualquier mes con ventas reales)
  const availableMonths: MonthOption[] = useMemo(() => {
    const monthsMap = new Map<string, MonthOption>();

    // Agregar mes actual y los 2 anteriores
    for (let offset = 0; offset >= -2; offset--) {
      const d = new Date(refDate.getFullYear(), refDate.getMonth() + offset, 1);
      const y = d.getFullYear();
      const m = d.getMonth();
      const key = `${y}-${String(m + 1).padStart(2, '0')}`;
      monthsMap.set(key, {
        key,
        name: `${MONTH_NAMES[m]} ${y}`,
        shortName: SHORT_MONTH_NAMES[m],
        year: y,
        month: m,
      });
    }

    // Agregar otros meses con ventas o devoluciones históricas
    [...sales, ...returns].forEach((record) => {
      if (record.date && record.date.length >= 7) {
        const ym = record.date.slice(0, 7);
        if (!monthsMap.has(ym)) {
          const parts = ym.split('-');
          const y = parseInt(parts[0], 10);
          const m = parseInt(parts[1], 10) - 1;
          if (!isNaN(y) && !isNaN(m) && m >= 0 && m < 12) {
            monthsMap.set(ym, {
              key: ym,
              name: `${MONTH_NAMES[m]} ${y}`,
              shortName: SHORT_MONTH_NAMES[m],
              year: y,
              month: m,
            });
          }
        }
      }
    });

    return Array.from(monthsMap.values()).sort((a, b) => b.key.localeCompare(a.key));
  }, [refDate, sales, returns]);

  const defaultMonthKey = availableMonths[0]?.key || `${refDate.getFullYear()}-${String(refDate.getMonth() + 1).padStart(2, '0')}`;
  const [selectedMonthKey, setSelectedMonthKey] = useState<string>(defaultMonthKey);

  // Asegurar que selectedMonthKey exista
  const currentMonthOption = useMemo(() => {
    return availableMonths.find((m) => m.key === selectedMonthKey) || availableMonths[0] || {
      key: defaultMonthKey,
      name: `${MONTH_NAMES[refDate.getMonth()]} ${refDate.getFullYear()}`,
      shortName: SHORT_MONTH_NAMES[refDate.getMonth()],
      year: refDate.getFullYear(),
      month: refDate.getMonth(),
    };
  }, [availableMonths, selectedMonthKey, defaultMonthKey, refDate]);

  // Determinar semana actual o seleccionada
  const currentDayOfMonth = refDate.getDate();
  const defaultWeekKey: WeekKey = currentDayOfMonth <= 7 ? 'sem1' : currentDayOfMonth <= 14 ? 'sem2' : currentDayOfMonth <= 21 ? 'sem3' : 'sem4';
  const [selectedWeekKey, setSelectedWeekKey] = useState<WeekKey>(defaultWeekKey);

  const selectedWeekDef = WEEKS_DEF.find((w) => w.key === selectedWeekKey) || WEEKS_DEF[0];

  // Rango de fechas de la semana seleccionada en formato YYYY-MM-DD
  const daysInSelectedMonth = new Date(currentMonthOption.year, currentMonthOption.month + 1, 0).getDate();
  const weekStartDay = Math.min(selectedWeekDef.startDay, daysInSelectedMonth);
  const weekEndDay = Math.min(selectedWeekDef.endDay, daysInSelectedMonth);

  const weekDateRangeLabel = `${String(weekStartDay).padStart(2, '0')} - ${String(weekEndDay).padStart(2, '0')} ${currentMonthOption.shortName}`;

  // Filtrar ventas reales para el periodo seleccionado
  const periodFilteredSales = useMemo(() => {
    if (periodTab === 'trimestral') {
      // Últimos 3 meses disponibles
      const allowedKeys = new Set(availableMonths.slice(0, 3).map((m) => m.key));
      return sales.filter((s) => s.date && allowedKeys.has(s.date.slice(0, 7)));
    }

    if (periodTab === 'mensual') {
      return sales.filter((s) => s.date && s.date.startsWith(currentMonthOption.key));
    }

    // Semanal
    return sales.filter((s) => {
      if (!s.date || !s.date.startsWith(currentMonthOption.key)) return false;
      const dayNum = parseInt(s.date.split('-')[2], 10);
      return dayNum >= weekStartDay && dayNum <= weekEndDay;
    });
  }, [sales, periodTab, availableMonths, currentMonthOption.key, weekStartDay, weekEndDay]);

  const periodFilteredReturns = useMemo(() => {
    if (periodTab === 'trimestral') {
      const allowedKeys = new Set(availableMonths.slice(0, 3).map((month) => month.key));
      return returns.filter((record) => record.date && allowedKeys.has(record.date.slice(0, 7)));
    }
    if (periodTab === 'mensual') {
      return returns.filter((record) => record.date?.startsWith(currentMonthOption.key));
    }
    return returns.filter((record) => {
      if (!record.date?.startsWith(currentMonthOption.key)) return false;
      const day = Number(record.date.split('-')[2]);
      return day >= weekStartDay && day <= weekEndDay;
    });
  }, [returns, periodTab, availableMonths, currentMonthOption.key, weekStartDay, weekEndDay]);

  const periodReturnTotals = useMemo(() => {
    const byMethod = periodFilteredReturns.reduce(
      (totals, record) => {
        totals[record.refundMethod] += Number(record.totalRefund || 0);
        return totals;
      },
      { efectivo: 0, transferencia: 0, mixto: 0 }
    );
    return {
      count: periodFilteredReturns.length,
      total: byMethod.efectivo + byMethod.transferencia + byMethod.mixto,
      ...byMethod,
    };
  }, [periodFilteredReturns]);

  // Si no hay ventas registradas en sales pero hay datos en el IPV del día actual, respaldar con el IPV
  const isCurrentSelectionToday = currentMonthOption.key === defaultMonthKey;
  const ipvTotalVendidoToday = (ipvRows || []).reduce((acc, r) => acc + (r.importe || 0), 0);

  // Total de ingresos del periodo
  const periodTotalRevenue = useMemo(() => {
    const fromSales = periodFilteredSales.reduce((acc, s) => acc + (s.total || 0), 0);
    if (fromSales > 0) return fromSales;
    // Si aún no hay tickets de venta guardados pero el IPV tiene ventas del día
    if (isCurrentSelectionToday && periodTab === 'semanal' && ipvTotalVendidoToday > 0) {
      return ipvTotalVendidoToday;
    }
    return 0;
  }, [periodFilteredSales, isCurrentSelectionToday, periodTab, ipvTotalVendidoToday]);

  // Costo total de lo vendido para cálculo de margen
  const periodCost = useMemo(() => {
    let totalC = 0;
    periodFilteredSales.forEach((s) => {
      (s.items || []).forEach((it) => {
        // Estimación de costo al 65% del precio de venta (margen del 35%)
        const itemCost = it.unitPrice * 0.65;
        totalC += itemCost * (it.quantity || 1);
      });
    });

    if (totalC === 0 && periodTotalRevenue > 0) {
      totalC = periodTotalRevenue * 0.65;
    }
    return totalC;
  }, [periodFilteredSales, periodTotalRevenue]);

  const netProfit = Math.max(0, periodTotalRevenue - periodCost);
  const marginPct = periodTotalRevenue > 0 ? ((netProfit / periodTotalRevenue) * 100).toFixed(1) : '0.0';

  // Desglose de barras dinámico
  const barData: { title: string; subtitle: string; badge: string; items: BarItem[]; footerNote: string; footerTotal: string } = useMemo(() => {
    if (periodTab === 'trimestral') {
      const top3 = availableMonths.slice(0, 3).reverse();
      const monthTotals = top3.map((m) => {
        const monthSales = sales.filter((s) => s.date && s.date.startsWith(m.key));
        const val = monthSales.reduce((acc, s) => acc + (s.total || 0), 0);
        return { m, val };
      });
      const maxVal = Math.max(...monthTotals.map((x) => x.val), 1);
      const hasAny = monthTotals.some((x) => x.val > 0);

      const items: BarItem[] = monthTotals.map((x) => {
        const isPeak = hasAny && x.val === maxVal && x.val > 0;
        return {
          label: x.m.shortName,
          sublabel: x.val > 0 ? `${(x.val / 1000).toFixed(1)}k` : '0 CUP',
          value: x.val,
          formatted: x.val >= 1000 ? `${(x.val / 1000).toFixed(1)}k` : `$${x.val.toFixed(0)}`,
          heightPct: hasAny && x.val > 0 ? Math.max(8, Math.round((x.val / maxVal) * 100)) : 4,
          isPeak,
        };
      });

      const peakMonth = monthTotals.find((x) => x.val === maxVal && x.val > 0);

      return {
        title: 'Ventas por Mes del Trimestre (CUP)',
        subtitle: `Consolidado de los últimos ${top3.length} meses evaluados`,
        badge: `${top3.length} meses`,
        items,
        footerNote: peakMonth ? `Mes con mayor facturación: ${peakMonth.m.name}` : 'Sin ventas registradas en el trimestre',
        footerTotal: `${periodTotalRevenue.toLocaleString('es-CU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} CUP`,
      };
    }

    if (periodTab === 'mensual') {
      // 4 semanas del mes
      const weekTotals = WEEKS_DEF.map((w) => {
        const wStart = Math.min(w.startDay, daysInSelectedMonth);
        const wEnd = Math.min(w.endDay, daysInSelectedMonth);
        const weekSales = sales.filter((s) => {
          if (!s.date || !s.date.startsWith(currentMonthOption.key)) return false;
          const dayNum = parseInt(s.date.split('-')[2], 10);
          return dayNum >= wStart && dayNum <= wEnd;
        });
        const val = weekSales.reduce((acc, s) => acc + (s.total || 0), 0);
        return { w, val };
      });

      const maxVal = Math.max(...weekTotals.map((x) => x.val), 1);
      const hasAny = weekTotals.some((x) => x.val > 0);

      const items: BarItem[] = weekTotals.map((x) => {
        const isPeak = hasAny && x.val === maxVal && x.val > 0;
        return {
          label: x.w.label.replace('Semana ', 'Sem '),
          sublabel: x.val > 0 ? `${(x.val / 1000).toFixed(1)}k` : '0 CUP',
          value: x.val,
          formatted: x.val >= 1000 ? `${(x.val / 1000).toFixed(1)}k` : `$${x.val.toFixed(0)}`,
          heightPct: hasAny && x.val > 0 ? Math.max(8, Math.round((x.val / maxVal) * 100)) : 4,
          isPeak,
        };
      });

      const peakWeek = weekTotals.find((x) => x.val === maxVal && x.val > 0);

      return {
        title: `Ventas por Semana - ${currentMonthOption.name} (CUP)`,
        subtitle: `Desglose de las 4 semanas de ${currentMonthOption.name}`,
        badge: '4 semanas',
        items,
        footerNote: peakWeek ? `Semana de mayor facturación: ${peakWeek.w.label}` : 'Sin ventas registradas en el mes',
        footerTotal: `${periodTotalRevenue.toLocaleString('es-CU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} CUP`,
      };
    }

    // Semanal: Desglose por los 7 días de la semana
    const dayNames = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
    const daysCount = Math.max(1, weekEndDay - weekStartDay + 1);
    const dayItems: { dayNum: number; dateStr: string; label: string; val: number }[] = [];

    for (let d = weekStartDay; d <= weekEndDay; d++) {
      const dateObj = new Date(currentMonthOption.year, currentMonthOption.month, d);
      // JS getDay(): 0 es Dom, 1 es Lun...
      const dayIdx = (dateObj.getDay() + 6) % 7; // Lun=0, Dom=6
      const dateStr = `${currentMonthOption.key}-${String(d).padStart(2, '0')}`;
      const daySales = sales.filter((s) => s.date === dateStr);
      let val = daySales.reduce((acc, s) => acc + (s.total || 0), 0);

      // Si es hoy y no hay tickets pero hay IPV
      if (dateStr === todayDate && val === 0 && ipvTotalVendidoToday > 0) {
        val = ipvTotalVendidoToday;
      }

      dayItems.push({
        dayNum: d,
        dateStr,
        label: `${dayNames[dayIdx]} ${String(d).padStart(2, '0')}`,
        val,
      });
    }

    const maxVal = Math.max(...dayItems.map((x) => x.val), 1);
    const hasAny = dayItems.some((x) => x.val > 0);

    const items: BarItem[] = dayItems.map((x) => {
      const isPeak = hasAny && x.val === maxVal && x.val > 0;
      return {
        label: x.label,
        sublabel: x.val > 0 ? `${(x.val / 1000).toFixed(1)}k` : '0',
        value: x.val,
        formatted: x.val >= 1000 ? `${(x.val / 1000).toFixed(1)}k` : `$${x.val.toFixed(0)}`,
        heightPct: hasAny && x.val > 0 ? Math.max(8, Math.round((x.val / maxVal) * 100)) : 4,
        isPeak,
      };
    });

    const peakDay = dayItems.find((x) => x.val === maxVal && x.val > 0);

    return {
      title: `Ventas Diarias - ${selectedWeekDef.label} (CUP)`,
      subtitle: `Desglose del ${weekDateRangeLabel}`,
      badge: selectedWeekDef.label,
      items,
      footerNote: peakDay ? `Día pico: ${peakDay.label} (${peakDay.val.toLocaleString('es-CU')} CUP)` : 'Sin ventas en esta semana',
      footerTotal: `${periodTotalRevenue.toLocaleString('es-CU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} CUP`,
    };
  }, [
    periodTab,
    availableMonths,
    sales,
    currentMonthOption,
    daysInSelectedMonth,
    weekStartDay,
    weekEndDay,
    selectedWeekDef.label,
    weekDateRangeLabel,
    todayDate,
    ipvTotalVendidoToday,
    periodTotalRevenue,
  ]);

  // Curva de tendencia dinámica (SVG paths calculados a partir de los datos reales)
  const curveData = useMemo(() => {
    const rawPoints: TrendPoint[] = barData.items.map((b) => ({
      label: b.label,
      value: b.value,
    }));

    const maxVal = Math.max(...rawPoints.map((p) => p.value), 0);
    const count = rawPoints.length;
    const width = 700;
    const height = 240;
    const paddingX = 40;
    const baseY = 210;
    const peakY = 50;

    if (maxVal === 0 || count < 2) {
      // Línea plana de base limpia cuando no hay ventas
      const flatDots = rawPoints.map((p, idx) => ({
        cx: paddingX + (idx / Math.max(1, count - 1)) * (width - 2 * paddingX),
        cy: baseY,
      }));

      return {
        title: `Curva de Tendencia - ${periodTab === 'trimestral' ? 'Trimestre' : periodTab === 'mensual' ? currentMonthOption.name : selectedWeekDef.label}`,
        subtitle: 'Evolución real del volumen de facturación por transacciones',
        labels: rawPoints.map((p) => p.label),
        peakText: '0.00 CUP',
        peakCoord: { x: width / 2, y: baseY },
        areaPath: `M ${paddingX} ${baseY} L ${width - paddingX} ${baseY} L ${width - paddingX} 225 L ${paddingX} 225 Z`,
        linePath: `M ${paddingX} ${baseY} L ${width - paddingX} ${baseY}`,
        movingAvgPath: `M ${paddingX} ${baseY} L ${width - paddingX} ${baseY}`,
        dots: flatDots,
        varianceText: 'Sin fluctuaciones (esperando primeras ventas)',
        avgTrans: `${periodFilteredSales.length} tickets registrados`,
      };
    }

    // Calcular coordenadas escaladas
    const dots = rawPoints.map((p, idx) => {
      const cx = paddingX + (idx / (count - 1)) * (width - 2 * paddingX);
      const cy = baseY - (p.value / maxVal) * (baseY - peakY);
      return { cx, cy };
    });

    // Construir paths SVG
    let linePath = `M ${dots[0].cx} ${dots[0].cy}`;
    for (let i = 1; i < dots.length; i++) {
      const prev = dots[i - 1];
      const curr = dots[i];
      const midX = (prev.cx + curr.cx) / 2;
      linePath += ` C ${midX} ${prev.cy}, ${midX} ${curr.cy}, ${curr.cx} ${curr.cy}`;
    }

    const areaPath = `${linePath} L ${dots[dots.length - 1].cx} 225 L ${dots[0].cx} 225 Z`;

    // Moving average sencilla
    const movingDots = dots.map((d, i) => {
      const prevVal = i > 0 ? dots[i - 1].cy : d.cy;
      const nextVal = i < dots.length - 1 ? dots[i + 1].cy : d.cy;
      return { cx: d.cx, cy: (prevVal + d.cy + nextVal) / 3 };
    });

    let movingAvgPath = `M ${movingDots[0].cx} ${movingDots[0].cy}`;
    for (let i = 1; i < movingDots.length; i++) {
      movingAvgPath += ` L ${movingDots[i].cx} ${movingDots[i].cy}`;
    }

    // Coordenada del pico máximo
    let peakIdx = 0;
    rawPoints.forEach((p, idx) => {
      if (p.value > rawPoints[peakIdx].value) peakIdx = idx;
    });

    return {
      title: `Curva de Tendencia - ${periodTab === 'trimestral' ? 'Trimestre' : periodTab === 'mensual' ? currentMonthOption.name : selectedWeekDef.label}`,
      subtitle: 'Evolución real del volumen de facturación por transacciones',
      labels: rawPoints.map((p) => p.label),
      peakText: `Pico: ${maxVal.toLocaleString('es-CU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} CUP`,
      peakCoord: { x: dots[peakIdx].cx, y: dots[peakIdx].cy },
      areaPath,
      linePath,
      movingAvgPath,
      dots,
      varianceText: `Facturación registrada: ${periodFilteredSales.length} transacciones`,
      avgTrans: `Promedio: ${(periodTotalRevenue / Math.max(1, count)).toFixed(2)} CUP / unidad temporal`,
    };
  }, [
    barData.items,
    periodTab,
    currentMonthOption.name,
    selectedWeekDef.label,
    periodFilteredSales.length,
    periodTotalRevenue,
  ]);

  // KPIs dinámicos calculados
  const kpis = useMemo(() => {
    const totalFormatted = periodTotalRevenue.toLocaleString('es-CU', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

    // Promedio diario o por venta
    const activeUnits = Math.max(1, barData.items.filter((b) => b.value > 0).length);
    const avgDailyVal = periodTotalRevenue > 0 ? periodTotalRevenue / activeUnits : 0;
    const avgDailyFormatted = avgDailyVal.toLocaleString('es-CU', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

    // Pico
    const peakItem = barData.items.find((b) => b.isPeak && b.value > 0);
    const peakTitle = periodTab === 'semanal' ? 'Mejor Día' : periodTab === 'mensual' ? 'Mejor Semana' : 'Mejor Mes';
    const peakValue = peakItem ? peakItem.label : 'Sin registros';
    const peakAmount = peakItem ? `${peakItem.value.toLocaleString('es-CU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} CUP` : '0.00 CUP';
    const peakBadge = peakItem ? 'Pico del Periodo' : 'En Espera';

    const netProfitFormatted = `${netProfit.toLocaleString('es-CU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} CUP`;

    return {
      total: totalFormatted,
      totalLabel: periodTab === 'semanal' ? `Ventas ${selectedWeekDef.label} (${currentMonthOption.shortName})` : periodTab === 'mensual' ? `Ventas Totales de ${currentMonthOption.name}` : 'Ventas del Trimestre Activo',
      diff: periodTotalRevenue > 0 ? 'Activo' : '0.0%',
      diffText: periodTotalRevenue > 0 ? `${periodFilteredSales.length} ventas procesadas` : 'Sin transacciones aún',
      avgLabel: 'Promedio Operativo',
      avgDaily: avgDailyFormatted,
      avgDailyNote: periodTotalRevenue > 0 ? `Calculado en ${activeUnits} periodos con actividad` : 'En espera de ventas',
      peakTitle,
      peakValue,
      peakAmount,
      peakBadge,
      margin: `${marginPct}%`,
      netProfit: netProfitFormatted,
    };
  }, [
    periodTotalRevenue,
    barData.items,
    periodTab,
    selectedWeekDef.label,
    currentMonthOption.shortName,
    currentMonthOption.name,
    periodFilteredSales.length,
    netProfit,
    marginPct,
  ]);

  // Lista de Productos más vendidos derivada de las ventas reales del periodo (o del IPV si aún no hay tickets)
  const sortedProducts = useMemo(() => {
    // 1. Intentar construir a partir de periodFilteredSales
    const productStatsMap = new Map<string, { code: string; name: string; category: string; soldUnits: number; unitPrice: number; totalIncome: number }>();

    periodFilteredSales.forEach((s) => {
      (s.items || []).forEach((it) => {
        const key = it.code || it.productId || it.name;
        const existing = productStatsMap.get(key);
        if (existing) {
          existing.soldUnits += it.quantity || 0;
          existing.totalIncome += it.subtotal || 0;
        } else {
          productStatsMap.set(key, {
            code: it.code || 'S/C',
            name: it.name || 'Producto',
            category: 'General',
            soldUnits: it.quantity || 0,
            unitPrice: it.unitPrice || 0,
            totalIncome: it.subtotal || 0,
          });
        }
      });
    });

    // 2. Si las ventas del periodo están vacías pero ipvRows tiene ventas del día
    if (productStatsMap.size === 0 && isCurrentSelectionToday) {
      (ipvRows || []).filter((r: IPVRow) => (r.vendido || 0) > 0).forEach((r: IPVRow) => {
        productStatsMap.set(r.code, {
          code: r.code,
          name: r.name,
          category: r.category || 'General',
          soldUnits: r.vendido,
          unitPrice: r.price,
          totalIncome: r.importe,
        });
      });
    }

    if (productStatsMap.size === 0) {
      return [];
    }

    const items = Array.from(productStatsMap.values());
    const totalIncomeAll = items.reduce((acc, it) => acc + it.totalIncome, 0);

    return items
      .map((item, idx) => ({
        rank: idx + 1,
        code: item.code,
        name: item.name,
        category: item.category,
        icon: 'inventory_2',
        soldUnits: item.soldUnits,
        unitPrice: item.unitPrice,
        totalIncome: item.totalIncome,
        percentage: totalIncomeAll > 0 ? Number(((item.totalIncome / totalIncomeAll) * 100).toFixed(1)) : 0,
      }))
      .sort((a, b) => {
        if (filterSort === 'volumen') {
          return b.soldUnits - a.soldUnits;
        }
        return b.totalIncome - a.totalIncome;
      })
      .map((p, idx) => ({ ...p, rank: idx + 1 }));
  }, [periodFilteredSales, isCurrentSelectionToday, ipvRows, filterSort]);

  const pageSize = 5;
  const totalPages = Math.max(1, Math.ceil(sortedProducts.length / pageSize));
  const validPage = Math.min(page, totalPages);
  const paginatedReports = sortedProducts.slice((validPage - 1) * pageSize, validPage * pageSize);
  const startIdx = sortedProducts.length === 0 ? 0 : (validPage - 1) * pageSize + 1;
  const endIdx = Math.min(validPage * pageSize, sortedProducts.length);

  // Exportar productos y devoluciones del periodo a un libro de Excel
  const handleExport = async () => {
    const filename =
      periodTab === 'trimestral'
        ? `Reporte_IPV_Trimestral_${currentMonthOption.year}.xlsx`
        : periodTab === 'mensual'
        ? `Reporte_IPV_${currentMonthOption.key}.xlsx`
        : `Reporte_IPV_${currentMonthOption.key}_${selectedWeekKey.toUpperCase()}.xlsx`;
    const periodLabel = periodTab === 'trimestral'
      ? `Trimestre hasta ${currentMonthOption.name}`
      : periodTab === 'mensual'
      ? currentMonthOption.name
      : `${selectedWeekDef.label} de ${currentMonthOption.name}`;

    setIsExporting(true);
    try {
      if (!window.api?.reports?.exportarIpvExcel) {
        throw new Error('La exportación IPV a Excel no está disponible en esta versión de la aplicación.');
      }
      const result = await window.api.reports.exportarIpvExcel({
        date: `${currentMonthOption.key}-01`,
        fileName: filename,
        title: 'Reporte IPV y ventas',
        period: periodLabel,
        columns: [
          { header: 'Posición', key: 'rank', width: 12 },
          { header: 'Código', key: 'code', width: 16 },
          { header: 'Producto', key: 'name', width: 32 },
          { header: 'Categoría', key: 'category', width: 20 },
          { header: 'Unidades vendidas', key: 'soldUnits', width: 20 },
          { header: 'Precio unitario (CUP)', key: 'unitPrice', width: 22 },
          { header: 'Ingresos (CUP)', key: 'totalIncome', width: 20 },
          { header: 'Participación', key: 'percentage', width: 16 },
        ],
        rows: sortedProducts.map((product) => ({
          rank: product.rank,
          code: product.code,
          name: product.name,
          category: product.category,
          soldUnits: product.soldUnits,
          unitPrice: product.unitPrice,
          totalIncome: product.totalIncome,
          percentage: `${product.percentage}%`,
        })),
        metrics: [
          { label: 'Ingresos del periodo (CUP)', value: periodTotalRevenue },
          { label: 'Ventas registradas', value: periodFilteredSales.length },
          { label: 'Devoluciones registradas', value: periodReturnTotals.count },
        ],
        returns: periodFilteredReturns,
      });
      if (!result.canceled) {
        showToast('Reporte IPV exportado', result.excelPath, 'success');
      }
    } catch (error: any) {
      console.error('Error al exportar reporte IPV:', error);
      showToast('Error al exportar reporte', error?.message || 'No se pudo generar el archivo Excel.', 'error');
    } finally {
      setIsExporting(false);
    }
  };

  const handlePeriodTabChange = (tab: 'semanal' | 'mensual' | 'trimestral') => {
    setPeriodTab(tab);
    setIsMonthDropdownOpen(false);
    setIsWeekDropdownOpen(false);
    setPage(1);
    const label = tab === 'semanal' ? 'Semanal' : tab === 'mensual' ? 'Mensual' : 'Trimestral';
    showToast('Periodo Actualizado', `Mostrando análisis para vista ${label}.`);
  };

  const getTableTitle = () => {
    if (periodTab === 'trimestral') {
      return 'Productos Más Vendidos del Trimestre Activo';
    }
    if (periodTab === 'mensual') {
      return `Productos Más Vendidos de ${currentMonthOption.name}`;
    }
    return `Productos Más Vendidos (${selectedWeekDef.label} de ${currentMonthOption.name})`;
  };

  return (
    <div className="flex flex-col w-full gap-8 select-none pb-12">
      {/* Header section */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-2xl lg:text-3xl font-headline font-bold text-on-surface tracking-tight">
            Reportes y Analítica de Ventas
          </h1>
          <p className="text-sm text-on-surface-variant max-w-2xl font-normal leading-relaxed">
            Rendimiento comercial calculado a partir de las ventas en tiempo real, desglose semanal y consolidado mensual en CUP.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Period Tabs: Semanal, Mensual, Trimestral */}
          <div className="p-1 rounded-xl bg-surface neo-inset flex items-center gap-1">
            <button
              onClick={() => handlePeriodTabChange('semanal')}
              className={`px-3.5 py-1.5 rounded-lg text-xs transition-all cursor-pointer ${
                periodTab === 'semanal'
                  ? 'font-semibold text-primary bg-surface neo-raised shadow-sm'
                  : 'font-medium text-on-surface-variant hover:text-on-surface'
              }`}
              type="button"
            >
              Semanal
            </button>
            <button
              onClick={() => handlePeriodTabChange('mensual')}
              className={`px-3.5 py-1.5 rounded-lg text-xs transition-all cursor-pointer ${
                periodTab === 'mensual'
                  ? 'font-semibold text-primary bg-surface neo-raised shadow-sm'
                  : 'font-medium text-on-surface-variant hover:text-on-surface'
              }`}
              type="button"
            >
              Mensual
            </button>
            <button
              onClick={() => handlePeriodTabChange('trimestral')}
              className={`px-3.5 py-1.5 rounded-lg text-xs transition-all cursor-pointer ${
                periodTab === 'trimestral'
                  ? 'font-semibold text-primary bg-surface neo-raised shadow-sm'
                  : 'font-medium text-on-surface-variant hover:text-on-surface'
              }`}
              type="button"
            >
              Trimestral
            </button>
          </div>

          {/* Timeframe Selectors */}
          {periodTab === 'trimestral' ? (
            /* Trimestral Badge Pill */
            <div className="h-11 px-4 rounded-xl bg-surface neo-inset flex items-center gap-2 text-xs font-semibold text-primary">
              <span className="material-symbols-outlined text-[19px]">history_edu</span>
              <span>Trimestre Activo ({availableMonths.slice(0, 3).map((m) => m.shortName).join(' - ')})</span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              {/* Month Dropdown dinámico */}
              <div className="relative inline-block text-left">
                <button
                  onClick={() => {
                    setIsMonthDropdownOpen(!isMonthDropdownOpen);
                    setIsWeekDropdownOpen(false);
                  }}
                  className="h-11 px-4 rounded-xl bg-surface neo-raised flex items-center gap-2 text-xs font-semibold text-on-surface hover:text-primary transition-all active:neo-inset cursor-pointer"
                  type="button"
                  title="Seleccionar mes"
                >
                  <span className="material-symbols-outlined text-[18px] text-primary">calendar_month</span>
                  <span>{currentMonthOption.name}</span>
                  <span className="material-symbols-outlined text-[16px] text-on-surface-variant">expand_more</span>
                </button>

                {isMonthDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-56 rounded-xl bg-surface neo-raised shadow-xl z-30 p-2 flex flex-col gap-1">
                    <span className="px-2.5 py-1 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">
                      Meses Disponibles
                    </span>
                    {availableMonths.map((m) => {
                      const isSelected = selectedMonthKey === m.key;
                      const isCurrent = m.key === defaultMonthKey;
                      return (
                        <button
                          key={m.key}
                          onClick={() => {
                            setSelectedMonthKey(m.key);
                            setIsMonthDropdownOpen(false);
                            setPage(1);
                            showToast('Mes Seleccionado', `Visualizando datos para ${m.name}`);
                          }}
                          className={`w-full text-left px-3 py-2 text-xs font-semibold rounded-lg transition-colors flex items-center justify-between cursor-pointer ${
                            isSelected
                              ? 'bg-primary/10 text-primary font-bold'
                              : 'text-on-surface hover:bg-surface-container-high'
                          }`}
                          type="button"
                        >
                          <span>{m.name}</span>
                          {isCurrent && (
                            <span className="text-[10px] font-mono text-primary bg-surface neo-inset px-1.5 py-0.5 rounded">
                              Actual
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Week Dropdown */}
              {periodTab === 'semanal' && (
                <div className="relative inline-block text-left">
                  <button
                    onClick={() => {
                      setIsWeekDropdownOpen(!isWeekDropdownOpen);
                      setIsMonthDropdownOpen(false);
                    }}
                    className="h-11 px-4 rounded-xl bg-surface neo-raised flex items-center gap-2 text-xs font-semibold text-primary transition-all active:neo-inset cursor-pointer"
                    type="button"
                    title={`Seleccionar semana de ${currentMonthOption.name}`}
                  >
                    <span className="material-symbols-outlined text-[18px]">date_range</span>
                    <span>
                      {selectedWeekDef.label} ({weekDateRangeLabel})
                    </span>
                    <span className="material-symbols-outlined text-[16px] text-primary">expand_more</span>
                  </button>

                  {isWeekDropdownOpen && (
                    <div className="absolute right-0 mt-2 w-64 rounded-xl bg-surface neo-raised shadow-xl z-30 p-2 flex flex-col gap-1">
                      <div className="px-2.5 py-1 flex items-center justify-between">
                        <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">
                          Semanas de {currentMonthOption.name}
                        </span>
                        <span className="text-[10px] text-primary font-mono font-bold">4 semanas</span>
                      </div>
                      {WEEKS_DEF.map((w) => {
                        const isSelected = selectedWeekKey === w.key;
                        const wStart = Math.min(w.startDay, daysInSelectedMonth);
                        const wEnd = Math.min(w.endDay, daysInSelectedMonth);
                        const rangeStr = `${String(wStart).padStart(2, '0')} - ${String(wEnd).padStart(2, '0')} ${currentMonthOption.shortName}`;

                        return (
                          <button
                            key={w.key}
                            onClick={() => {
                              setSelectedWeekKey(w.key);
                              setIsWeekDropdownOpen(false);
                              setPage(1);
                              showToast('Semana Seleccionada', `${w.label} (${rangeStr}) de ${currentMonthOption.name}`);
                            }}
                            className={`w-full text-left px-3 py-2 text-xs font-semibold rounded-lg transition-colors flex items-center justify-between cursor-pointer ${
                              isSelected
                                ? 'bg-primary/10 text-primary font-bold'
                                : 'text-on-surface hover:bg-surface-container-high'
                            }`}
                            type="button"
                          >
                            <span className="flex items-center gap-1.5">
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  isSelected ? 'bg-primary' : 'bg-outline-variant'
                                }`}
                              ></span>
                              {w.label}
                            </span>
                            <span className="text-[10px] text-on-surface-variant font-mono">
                              {rangeStr}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Export to Excel */}
          <button
            onClick={handleExport}
            disabled={isExporting}
            className="h-11 px-4 rounded-xl bg-surface neo-raised flex items-center gap-2 text-xs font-semibold text-emerald-600 hover:text-emerald-700 active:neo-inset transition-all group cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            type="button"
          >
            <span className="material-symbols-outlined text-[19px] transition-transform group-hover:-translate-y-0.5">
              {isExporting ? 'hourglass_top' : 'table_view'}
            </span>
            <span>{isExporting ? 'Exportando...' : 'Exportar [.xlsx]'}</span>
          </button>
        </div>
      </div>

      {/* 4 Bento Metric Cards dynamically driven by period & real sales */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-5">
        {/* Card 1: Total Ventas del Periodo */}
        <div className="p-5 rounded-2xl bg-surface neo-raised flex flex-col justify-between relative overflow-hidden group">
          <div className="flex items-start justify-between">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold tracking-wide text-on-surface-variant uppercase">
                {kpis.totalLabel}
              </span>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className="text-2xl font-headline font-bold text-on-surface tracking-tight font-mono">
                  {kpis.total}
                </span>
                <span className="text-xs font-semibold text-primary font-mono">CUP</span>
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-surface neo-inset flex items-center justify-center text-primary">
              <span className="material-symbols-outlined text-[22px]">payments</span>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-4 pt-3 border-t border-outline-variant/15">
            <span
              className={`flex items-center text-xs font-bold px-2 py-0.5 rounded-full ${
                periodTotalRevenue > 0
                  ? 'text-emerald-600 bg-emerald-500/10'
                  : 'text-on-surface-variant bg-surface-container-high'
              }`}
            >
              <span className="material-symbols-outlined text-[15px]">
                {periodTotalRevenue > 0 ? 'trending_up' : 'info'}
              </span>
              {kpis.diff}
            </span>
            <span className="text-[11px] text-on-surface-variant font-medium truncate">
              {kpis.diffText}
            </span>
          </div>
        </div>

        {/* Card 2: Promedio */}
        <div className="p-5 rounded-2xl bg-surface neo-raised flex flex-col justify-between group">
          <div className="flex items-start justify-between">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold tracking-wide text-on-surface-variant uppercase">
                {kpis.avgLabel}
              </span>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className="text-2xl font-headline font-bold text-on-surface tracking-tight font-mono">
                  {kpis.avgDaily}
                </span>
                <span className="text-xs font-semibold text-primary font-mono">CUP</span>
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-surface neo-inset flex items-center justify-center text-tertiary">
              <span className="material-symbols-outlined text-[22px]">speed</span>
            </div>
          </div>
          <div className="flex items-center justify-between mt-4 pt-3 border-t border-outline-variant/15">
            <span className="text-[11px] text-on-surface-variant font-medium">
              {kpis.avgDailyNote}
            </span>
            <span className={`w-2 h-2 rounded-full ${periodTotalRevenue > 0 ? 'bg-primary' : 'bg-outline-variant'}`}></span>
          </div>
        </div>

        {/* Card 3: Pico / Mejor Periodo */}
        <div className="p-5 rounded-2xl bg-surface neo-raised flex flex-col justify-between group">
          <div className="flex items-start justify-between">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold tracking-wide text-on-surface-variant uppercase">
                {kpis.peakTitle}
              </span>
              <span className="text-xl font-headline font-bold text-on-surface tracking-tight mt-0.5 truncate">
                {kpis.peakValue}
              </span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-surface neo-inset flex items-center justify-center text-indigo-500">
              <span className="material-symbols-outlined text-[22px]">workspace_premium</span>
            </div>
          </div>
          <div className="flex items-center justify-between mt-4 pt-3 border-t border-outline-variant/15">
            <span className="text-xs font-semibold text-on-surface font-mono">{kpis.peakAmount}</span>
            <span
              className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
                periodTotalRevenue > 0
                  ? 'text-emerald-600 bg-emerald-500/10'
                  : 'text-on-surface-variant bg-surface-container-high'
              }`}
            >
              {kpis.peakBadge}
            </span>
          </div>
        </div>

        {/* Card 4: Margen Bruto */}
        <div className="p-5 rounded-2xl bg-surface neo-raised flex flex-col justify-between group">
          <div className="flex items-start justify-between">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold tracking-wide text-on-surface-variant uppercase">
                Margen Bruto Estimado
              </span>
              <span className="text-2xl font-headline font-bold text-on-surface tracking-tight font-mono mt-0.5">
                {kpis.margin}
              </span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-surface neo-inset flex items-center justify-center text-primary">
              <span className="material-symbols-outlined text-[22px]">pie_chart</span>
            </div>
          </div>
          <div className="flex flex-col gap-1 mt-4 pt-3 border-t border-outline-variant/15">
            <div className="w-full h-1.5 rounded-full bg-surface neo-inset overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all duration-500"
                style={{ width: `${Math.min(100, Math.max(0, parseFloat(marginPct)))}%` }}
              ></div>
            </div>
            <div className="flex justify-between items-center text-[11px] text-on-surface-variant mt-1">
              <span>Rentabilidad neta</span>
              <span className="font-semibold text-on-surface font-mono">{kpis.netProfit}</span>
            </div>
          </div>
        </div>

        {/* Card 5: Devoluciones del periodo */}
        <div className="p-5 rounded-2xl bg-surface neo-raised flex flex-col justify-between group">
          <div className="flex items-start justify-between">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold tracking-wide text-on-surface-variant uppercase">
                Devoluciones del periodo
              </span>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className="text-2xl font-headline font-bold text-amber-700 tracking-tight font-mono">
                  {periodReturnTotals.total.toLocaleString('es-CU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <span className="text-xs font-semibold text-amber-700 font-mono">CUP</span>
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-surface neo-inset flex items-center justify-center text-amber-600">
              <span className="material-symbols-outlined text-[22px]">assignment_return</span>
            </div>
          </div>
          <div className="flex flex-col gap-1 mt-4 pt-3 border-t border-outline-variant/15 text-[10px] text-on-surface-variant">
            <span>{periodReturnTotals.count} devoluciones registradas</span>
            <span>
              Efectivo {periodReturnTotals.efectivo.toLocaleString('es-CU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} · Transferencia {periodReturnTotals.transferencia.toLocaleString('es-CU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span>
              Mixto {periodReturnTotals.mixto.toLocaleString('es-CU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      </div>

      {/* Visual Analytics Grid dynamically responsive to periodTab and selection */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Bar Chart breakdown */}
        <div className="lg:col-span-5 p-6 rounded-2xl bg-surface neo-raised flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div className="flex flex-col">
              <h2 className="text-base font-headline font-bold text-on-surface">
                {barData.title}
              </h2>
              <span className="text-xs text-on-surface-variant">
                {barData.subtitle}
              </span>
            </div>
            <span className="text-[11px] font-semibold px-2 py-1 rounded bg-surface neo-inset text-primary font-mono">
              {barData.badge}
            </span>
          </div>

          <div className="h-64 w-full flex items-end justify-between gap-3 pt-8 pb-3 px-2">
            {barData.items.map((bar, idx) => (
              <div key={idx} className="flex-1 flex flex-col items-center gap-2 group h-full justify-end">
                <div
                  className={`transition-opacity text-[10px] px-1.5 py-0.5 rounded shadow-sm whitespace-nowrap ${
                    bar.isPeak
                      ? 'opacity-100 font-bold text-white bg-primary'
                      : 'opacity-0 group-hover:opacity-100 font-semibold text-primary bg-surface neo-raised'
                  }`}
                >
                  {bar.formatted}
                </div>
                <div className="w-full max-w-[48px] rounded-xl bg-surface neo-inset p-1 flex items-end h-[100%]">
                  <div
                    className={`w-full rounded-lg transition-all duration-500 ${
                      bar.isPeak
                        ? 'bg-primary shadow-sm'
                        : bar.value > 0
                        ? 'bg-primary/70 group-hover:bg-primary'
                        : 'bg-outline-variant/30'
                    }`}
                    style={{ height: `${bar.heightPct}%` }}
                  ></div>
                </div>
                <div className="flex flex-col items-center mt-1">
                  <span
                    className={`text-xs font-semibold ${
                      bar.isPeak ? 'text-primary font-bold' : 'text-on-surface'
                    }`}
                  >
                    {bar.label}
                  </span>
                  <span className="text-[10px] text-on-surface-variant font-mono">
                    {bar.sublabel}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between pt-4 mt-2 text-xs text-on-surface-variant border-t border-outline-variant/15">
            <span className="flex items-center gap-1.5">
              <span className={`w-2.5 h-2.5 rounded-full ${periodTotalRevenue > 0 ? 'bg-primary' : 'bg-outline-variant'}`}></span>
              {barData.footerNote}
            </span>
            <span className="font-medium text-on-surface font-mono">
              Total: {barData.footerTotal}
            </span>
          </div>
        </div>

        {/* Right Column: Line and Area Curve Chart */}
        <div className="lg:col-span-7 p-6 rounded-2xl bg-surface neo-raised flex flex-col justify-between">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <div className="flex flex-col">
              <h2 className="text-base font-headline font-bold text-on-surface">
                {curveData.title}
              </h2>
              <span className="text-xs text-on-surface-variant">
                {curveData.subtitle}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 text-xs text-on-surface-variant">
                <span className="w-2.5 h-2.5 rounded-full bg-primary"></span>
                <span>Ventas Periodo</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-on-surface-variant">
                <span className="w-2.5 h-2.5 rounded-full bg-tertiary"></span>
                <span>Media</span>
              </div>
            </div>
          </div>

          {/* SVG Line and Area Chart */}
          <div className="relative w-full h-64 mt-2">
            <svg className="w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 700 240">
              <defs>
                <linearGradient id="areaGradient" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#0052CC" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#0052CC" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Grid Lines */}
              <line x1="0" y1="50" x2="700" y2="50" stroke="#d0d2dc" strokeDasharray="4 4" strokeWidth="1" opacity="0.5" />
              <line x1="0" y1="110" x2="700" y2="110" stroke="#d0d2dc" strokeDasharray="4 4" strokeWidth="1" opacity="0.5" />
              <line x1="0" y1="170" x2="700" y2="170" stroke="#d0d2dc" strokeDasharray="4 4" strokeWidth="1" opacity="0.5" />
              <line x1="0" y1="210" x2="700" y2="210" stroke="#8a8c9a" strokeWidth="1" opacity="0.3" />

              {/* Shaded Area */}
              <path
                d={curveData.areaPath}
                fill="url(#areaGradient)"
                className="transition-all duration-500"
              />

              {/* Primary Line */}
              <path
                d={curveData.linePath}
                fill="none"
                stroke="#0052CC"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="transition-all duration-500"
              />

              {/* Moving Average Line */}
              <path
                d={curveData.movingAvgPath}
                fill="none"
                stroke="#FF7A00"
                strokeDasharray="5 5"
                strokeWidth="2"
                opacity="0.8"
                className="transition-all duration-500"
              />

              {/* Regular Point Dots */}
              {curveData.dots.map((dot, idx) => (
                <circle
                  key={idx}
                  cx={dot.cx}
                  cy={dot.cy}
                  r="4"
                  fill="#ffffff"
                  stroke="#0052CC"
                  strokeWidth="2.5"
                />
              ))}

              {/* Peak Tooltip & Highlight */}
              {periodTotalRevenue > 0 && (
                <g>
                  <circle
                    cx={curveData.peakCoord.x}
                    cy={curveData.peakCoord.y}
                    r="6"
                    fill="#0052CC"
                    stroke="#ffffff"
                    strokeWidth="2"
                  />
                  <rect
                    x={Math.max(10, curveData.peakCoord.x - 65)}
                    y={Math.max(4, curveData.peakCoord.y - 32)}
                    width="130"
                    height="24"
                    rx="6"
                    fill="#1E293B"
                  />
                  <text
                    x={Math.max(75, curveData.peakCoord.x)}
                    y={Math.max(20, curveData.peakCoord.y - 16)}
                    fill="#ffffff"
                    fontSize="10"
                    fontWeight="600"
                    textAnchor="middle"
                  >
                    {curveData.peakText}
                  </text>
                </g>
              )}
            </svg>

            {/* X-Axis Labels */}
            <div className="flex justify-between items-center text-[10px] text-on-surface-variant font-medium pt-2 px-1">
              {curveData.labels.map((lbl, idx) => (
                <span
                  key={idx}
                  className="truncate max-w-[80px] text-center"
                >
                  {lbl}
                </span>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-on-surface-variant pt-3 border-t border-outline-variant/15">
            <span className="flex items-center gap-1">
              <span className={`material-symbols-outlined text-[16px] ${periodTotalRevenue > 0 ? 'text-emerald-500' : 'text-on-surface-variant'}`}>
                {periodTotalRevenue > 0 ? 'check_circle' : 'hourglass_empty'}
              </span>
              {curveData.varianceText}
            </span>
            <span className="font-medium text-on-surface">
              {curveData.avgTrans}
            </span>
          </div>
        </div>
      </div>

      {/* Top Best Sellers Table */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-surface neo-raised flex items-center justify-center text-primary">
              <span className="material-symbols-outlined text-[22px]">leaderboard</span>
            </div>
            <div className="flex flex-col">
              <h2 className="text-lg font-headline font-bold text-on-surface">
                {getTableTitle()}
              </h2>
              <span className="text-xs text-on-surface-variant">
                Líderes de volumen comercial, facturación agregada e impacto relativo calculados de ventas reales
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-on-surface-variant">Filtrar por:</span>
            <button
              onClick={() =>
                setFilterSort(filterSort === 'recaudacion' ? 'volumen' : 'recaudacion')
              }
              className="h-9 px-3 rounded-xl bg-surface neo-raised text-xs font-semibold text-primary flex items-center gap-1.5 active:neo-inset cursor-pointer"
              type="button"
            >
              <span>{filterSort === 'recaudacion' ? 'Mayor Recaudación' : 'Mayor Volumen'}</span>
              <span className="material-symbols-outlined text-[16px]">swap_vert</span>
            </button>
          </div>
        </div>

        <div className="rounded-2xl bg-surface neo-raised p-2 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead>
                <tr className="text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">
                  <th className="py-3 px-4 text-center w-12" scope="col">
                    # Rank
                  </th>
                  <th className="py-3 px-4" scope="col">
                    Producto &amp; Especificación
                  </th>
                  <th className="py-3 px-4" scope="col">
                    Categoría
                  </th>
                  <th className="py-3 px-4 text-right" scope="col">
                    Uds. Vendidas
                  </th>
                  <th className="py-3 px-4 text-right" scope="col">
                    Precio Unitario
                  </th>
                  <th className="py-3 px-4 text-right" scope="col">
                    Total Ingresos (CUP)
                  </th>
                  <th className="py-3 px-4 text-center w-48" scope="col">
                    % Ventas Periodo
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y-0 text-on-surface">
                {paginatedReports.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-xs text-on-surface-variant font-medium">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <span className="material-symbols-outlined text-[32px] text-on-surface-variant/70">receipt_long</span>
                        <span>No hay registros de ventas para el periodo seleccionado</span>
                        <p className="text-[11px] text-on-surface-variant/70 max-w-sm">
                          A medida que se registren ventas en la caja o en el IPV, los datos y estadísticas se calcularán automáticamente aquí.
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedReports.map((p) => (
                    <tr key={p.rank} className="group hover:bg-surface-container-high/40 transition-colors">
                      <td className="py-3.5 px-4 text-center">
                        <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-surface neo-inset text-primary font-bold text-xs font-mono">
                          {p.rank}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-surface neo-raised flex items-center justify-center text-on-surface-variant">
                            <span className="material-symbols-outlined text-[18px]">{p.icon}</span>
                          </div>
                          <div className="flex flex-col">
                            <span className="font-semibold text-on-surface group-hover:text-primary transition-colors">
                              {p.name}
                            </span>
                            <span className="text-[11px] text-on-surface-variant font-mono">COD: {p.code}</span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-surface neo-inset text-on-surface-variant">
                          {p.category}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right font-medium font-mono">{p.soldUnits} u.</td>
                      <td className="py-3.5 px-4 text-right text-on-surface-variant font-mono">
                        {p.unitPrice.toFixed(2)} CUP
                      </td>
                      <td className="py-3.5 px-4 text-right font-bold text-on-surface font-mono">
                        {p.totalIncome.toLocaleString('es-CU', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}{' '}
                        CUP
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="flex-1 h-2 rounded-full bg-surface neo-inset overflow-hidden">
                            <div
                              className="h-full rounded-full bg-primary"
                              style={{ width: `${Math.min(100, p.percentage)}%` }}
                            ></div>
                          </div>
                          <span className="text-xs font-bold text-on-surface w-10 text-right font-mono">
                            {p.percentage}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="p-3.5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-on-surface-variant bg-surface rounded-xl mt-2 neo-inset">
            <span className="font-medium">
              Mostrando <strong className="text-on-surface">{startIdx} a {endIdx}</strong> de{' '}
              <strong className="text-on-surface">{sortedProducts.length}</strong> productos líderes
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={validPage === 1}
                className={`w-8 h-8 rounded-lg bg-surface neo-raised flex items-center justify-center transition-all ${
                  validPage === 1
                    ? 'opacity-40 cursor-not-allowed text-on-surface-variant'
                    : 'hover:text-primary active:neo-inset cursor-pointer text-on-surface'
                }`}
                type="button"
                title="Página anterior"
              >
                <span className="material-symbols-outlined text-[16px]">chevron_left</span>
              </button>

              {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                <button
                  key={pageNum}
                  onClick={() => setPage(pageNum)}
                  className={`w-8 h-8 rounded-lg text-xs font-semibold flex items-center justify-center transition-all cursor-pointer ${
                    validPage === pageNum
                      ? 'bg-surface neo-inset text-primary font-bold shadow-inner'
                      : 'bg-surface neo-raised text-on-surface-variant hover:text-on-surface active:neo-inset'
                  }`}
                  type="button"
                >
                  {pageNum}
                </button>
              ))}

              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={validPage === totalPages}
                className={`w-8 h-8 rounded-lg bg-surface neo-raised flex items-center justify-center transition-all ${
                  validPage === totalPages
                    ? 'opacity-40 cursor-not-allowed text-on-surface-variant'
                    : 'hover:text-primary active:neo-inset cursor-pointer text-on-surface'
                }`}
                type="button"
                title="Página siguiente"
              >
                <span className="material-symbols-outlined text-[16px]">chevron_right</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
