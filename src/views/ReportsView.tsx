import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { IPVRow, ReturnRecord } from '../types';
import { getMermaDestination, getReturnItemMermas } from '../utils/returnDestinations';
import { saveFileWithPicker } from '../utils/fileSaver';

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
  const { showToast, sales = [], ipvRows = [], products = [], returns = [], mermaItems = [], todayDate } = useApp();

  const [periodTab, setPeriodTab] = useState<'semanal' | 'mensual' | 'trimestral'>('semanal');
  const [tableTab, setTableTab] = useState<'productos' | 'menos-vendidos' | 'devoluciones'>('productos');
  const [isMonthDropdownOpen, setIsMonthDropdownOpen] = useState(false);
  const [isWeekDropdownOpen, setIsWeekDropdownOpen] = useState(false);
  const [filterSort, setFilterSort] = useState<'recaudacion' | 'volumen'>('recaudacion');
  const [page, setPage] = useState(1);
  const [returnsPage, setReturnsPage] = useState(1);
  const [returnsSearch, setReturnsSearch] = useState('');

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

  // Lista de meses disponibles (mes actual y 2 anteriores, más cualquier mes con ventas o devoluciones)
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

    // Agregar cualquier otro mes de ventas históricas
    sales.forEach((s) => {
      if (s.date && s.date.length >= 7) {
        const ym = s.date.slice(0, 7);
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

    // Agregar cualquier otro mes de devoluciones históricas
    returns.forEach((r) => {
      if (r.date && r.date.length >= 7) {
        const ym = r.date.slice(0, 7);
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
      const allowedKeys = new Set(availableMonths.slice(0, 3).map((m) => m.key));
      return sales.filter((s) => s.date && !(s as any).voided && allowedKeys.has(s.date.slice(0, 7)));
    }

    if (periodTab === 'mensual') {
      return sales.filter((s) => s.date && !(s as any).voided && s.date.startsWith(currentMonthOption.key));
    }

    // Semanal
    return sales.filter((s) => {
      if (!s.date || (s as any).voided || !s.date.startsWith(currentMonthOption.key)) return false;
      const dayNum = parseInt(s.date.split('-')[2], 10);
      return dayNum >= weekStartDay && dayNum <= weekEndDay;
    });
  }, [sales, periodTab, availableMonths, currentMonthOption.key, weekStartDay, weekEndDay]);

  // Filtrar devoluciones para el periodo seleccionado
  const periodFilteredReturns = useMemo(() => {
    if (periodTab === 'trimestral') {
      const allowedKeys = new Set(availableMonths.slice(0, 3).map((m) => m.key));
      return returns.filter((r) => r.date && allowedKeys.has(r.date.slice(0, 7)));
    }

    if (periodTab === 'mensual') {
      return returns.filter((r) => r.date && r.date.startsWith(currentMonthOption.key));
    }

    // Semanal
    return returns.filter((r) => {
      if (!r.date || !r.date.startsWith(currentMonthOption.key)) return false;
      const dayNum = parseInt(r.date.split('-')[2], 10);
      return dayNum >= weekStartDay && dayNum <= weekEndDay;
    });
  }, [returns, periodTab, availableMonths, currentMonthOption.key, weekStartDay, weekEndDay]);

  const periodFilteredMermas = useMemo(() => {
    return mermaItems.filter((item) => {
      if (!item.resolvedAt) return false;
      if (periodTab === 'trimestral') {
        const allowedKeys = new Set(availableMonths.slice(0, 3).map((month) => month.key));
        return allowedKeys.has(item.resolvedAt.slice(0, 7));
      }
      if (!item.resolvedAt.startsWith(currentMonthOption.key)) return false;
      if (periodTab === 'mensual') return true;
      const dayNum = parseInt(item.resolvedAt.split('-')[2], 10);
      return dayNum >= weekStartDay && dayNum <= weekEndDay;
    });
  }, [mermaItems, periodTab, availableMonths, currentMonthOption.key, weekStartDay, weekEndDay]);

  // Si no hay ventas registradas en sales pero hay datos en el IPV del día actual, respaldar con el IPV
  const isCurrentSelectionToday = currentMonthOption.key === defaultMonthKey;
  const ipvTotalVendidoToday = (ipvRows || []).reduce((acc, r) => acc + (r.importe || 0), 0);

  // Total de ingresos brutos del periodo
  const periodTotalRevenue = useMemo(() => {
    const fromSales = periodFilteredSales.reduce((acc, s) => acc + (s.total || 0), 0);
    if (fromSales > 0) return fromSales;
    if (isCurrentSelectionToday && periodTab === 'semanal' && ipvTotalVendidoToday > 0) {
      return ipvTotalVendidoToday;
    }
    return 0;
  }, [periodFilteredSales, isCurrentSelectionToday, periodTab, ipvTotalVendidoToday]);

  // Estadísticas consolidadas de devoluciones en el periodo
  const returnsStats = useMemo(() => {
    const totalRefund = periodFilteredReturns.reduce((acc, r) => acc + (r.totalRefund || 0), 0);
    const count = periodFilteredReturns.length;
    let returnedUnits = 0;
    let damagedUnits = 0;
    let goodUnits = 0;
    let cashRefund = 0;
    let transferRefund = 0;
    let mixedRefund = 0;

    periodFilteredReturns.forEach((r) => {
      if (r.refundMethod === 'efectivo') cashRefund += r.totalRefund || 0;
      else if (r.refundMethod === 'transferencia') transferRefund += r.totalRefund || 0;
      else mixedRefund += r.totalRefund || 0;

      (r.items || []).forEach((it) => {
        const q = it.quantity || 1;
        returnedUnits += q;
        if (it.condition === 'mal_estado') {
          damagedUnits += q;
        } else {
          goodUnits += q;
        }
      });
    });

    const refundPercentageOfRevenue = periodTotalRevenue > 0
      ? ((totalRefund / periodTotalRevenue) * 100).toFixed(1)
      : '0.0';

    return {
      totalRefund,
      count,
      returnedUnits,
      damagedUnits,
      goodUnits,
      cashRefund,
      transferRefund,
      mixedRefund,
      refundPercentageOfRevenue,
    };
  }, [periodFilteredReturns, periodTotalRevenue]);

  const returnDestinationStats = useMemo(() => {
    const totals = {
      defectiveSaleUnits: 0,
      writtenOffUnits: 0,
      warehouseUnits: 0,
      stockUnits: 0,
    };
    periodFilteredMermas.forEach((item) => {
      if (item.status === 'reincorporado_con_precio') totals.defectiveSaleUnits += item.quantity;
      if (item.status === 'baja_definitiva') totals.writtenOffUnits += item.quantity;
      if (item.status === 'devuelto_a_almacen') totals.warehouseUnits += item.quantity;
      if (item.status === 'reintegrado_a_stock') totals.stockUnits += item.quantity;
    });
    return totals;
  }, [periodFilteredMermas]);

  // Ingreso neto real (Ventas Brutas - Devoluciones Totales)
  const periodNetRevenue = Math.max(0, periodTotalRevenue - returnsStats.totalRefund);

  // Costo total de lo vendido para cálculo de margen
  const periodCost = useMemo(() => {
    let totalC = 0;
    periodFilteredSales.forEach((s) => {
      (s.items || []).forEach((it) => {
        const itemCost = Number(it.purchasePrice) || 0;
        totalC += itemCost * (it.quantity || 1);
      });
    });

    return totalC;
  }, [periodFilteredSales]);

  const netProfit = periodNetRevenue - periodCost;
  const marginPct = periodNetRevenue > 0 ? ((netProfit / periodNetRevenue) * 100).toFixed(1) : (periodTotalRevenue > 0 ? ((netProfit / periodTotalRevenue) * 100).toFixed(1) : '0.0');

  const totalInventoryInvestment = useMemo(
    () => products.reduce((total, product) => {
      const inventoryQuantity = (Number(product.stock) || 0) + (Number(product.almacenStock) || 0);
      return total + (Number(product.purchasePrice) || 0) * inventoryQuantity;
    }, 0),
    [products]
  );

  // Mapa de unidades devueltas por producto
  const returnedUnitsByProduct = useMemo(() => {
    const map = new Map<string, number>();
    periodFilteredReturns.forEach((r) => {
      (r.items || []).forEach((it) => {
        const key = it.code || it.productId || it.name;
        map.set(key, (map.get(key) || 0) + (it.quantity || 1));
      });
    });
    return map;
  }, [periodFilteredReturns]);

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
        footerNote: peakMonth ? `Mes pico: ${peakMonth.m.name}` : 'Sin ventas registradas en el trimestre',
        footerTotal: `${periodTotalRevenue.toLocaleString('es-CU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} CUP`,
      };
    }

    if (periodTab === 'mensual') {
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
        footerNote: peakWeek ? `Semana pico: ${peakWeek.w.label}` : 'Sin ventas registradas en el mes',
        footerTotal: `${periodTotalRevenue.toLocaleString('es-CU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} CUP`,
      };
    }

    // Semanal: Desglose por los 7 días de la semana
    const dayNames = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
    const dayItems: { dayNum: number; dateStr: string; label: string; val: number }[] = [];

    for (let d = weekStartDay; d <= weekEndDay; d++) {
      const dateObj = new Date(currentMonthOption.year, currentMonthOption.month, d);
      const dayIdx = (dateObj.getDay() + 6) % 7; // Lun=0, Dom=6
      const dateStr = `${currentMonthOption.key}-${String(d).padStart(2, '0')}`;
      const daySales = sales.filter((s) => s.date === dateStr);
      let val = daySales.reduce((acc, s) => acc + (s.total || 0), 0);

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

  // Curva de tendencia dinámica (SVG paths)
  const curveData = useMemo(() => {
    const rawPoints: TrendPoint[] = barData.items.map((b) => ({
      label: b.label,
      value: b.value,
    }));

    const maxVal = Math.max(...rawPoints.map((p) => p.value), 0);
    const count = rawPoints.length;
    const width = 700;
    const paddingX = 40;
    const baseY = 210;
    const peakY = 50;

    if (maxVal === 0 || count < 2) {
      const flatDots = rawPoints.map((_, idx) => ({
        cx: paddingX + (idx / Math.max(1, count - 1)) * (width - 2 * paddingX),
        cy: baseY,
      }));

      return {
        title: `Curva de Tendencia - ${periodTab === 'trimestral' ? 'Trimestre' : periodTab === 'mensual' ? currentMonthOption.name : selectedWeekDef.label}`,
        subtitle: 'Evolución de facturación y devoluciones del periodo seleccionado',
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

    const dots = rawPoints.map((p, idx) => {
      const cx = paddingX + (idx / (count - 1)) * (width - 2 * paddingX);
      const cy = baseY - (p.value / maxVal) * (baseY - peakY);
      return { cx, cy };
    });

    let linePath = `M ${dots[0].cx} ${dots[0].cy}`;
    for (let i = 1; i < dots.length; i++) {
      const prev = dots[i - 1];
      const curr = dots[i];
      const midX = (prev.cx + curr.cx) / 2;
      linePath += ` C ${midX} ${prev.cy}, ${midX} ${curr.cy}, ${curr.cx} ${curr.cy}`;
    }

    const areaPath = `${linePath} L ${dots[dots.length - 1].cx} 225 L ${dots[0].cx} 225 Z`;

    const movingDots = dots.map((d, i) => {
      const prevVal = i > 0 ? dots[i - 1].cy : d.cy;
      const nextVal = i < dots.length - 1 ? dots[i + 1].cy : d.cy;
      return { cx: d.cx, cy: (prevVal + d.cy + nextVal) / 3 };
    });

    let movingAvgPath = `M ${movingDots[0].cx} ${movingDots[0].cy}`;
    for (let i = 1; i < movingDots.length; i++) {
      movingAvgPath += ` L ${movingDots[i].cx} ${movingDots[i].cy}`;
    }

    let peakIdx = 0;
    rawPoints.forEach((p, idx) => {
      if (p.value > rawPoints[peakIdx].value) peakIdx = idx;
    });

    return {
      title: `Curva de Tendencia - ${periodTab === 'trimestral' ? 'Trimestre' : periodTab === 'mensual' ? currentMonthOption.name : selectedWeekDef.label}`,
      subtitle: 'Evolución de facturación y transacciones operativas',
      labels: rawPoints.map((p) => p.label),
      peakText: `Pico: ${maxVal.toLocaleString('es-CU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} CUP`,
      peakCoord: { x: dots[peakIdx].cx, y: dots[peakIdx].cy },
      areaPath,
      linePath,
      movingAvgPath,
      dots,
      varianceText: `Facturación registrada: ${periodFilteredSales.length} ventas`,
      avgTrans: `Promedio: ${(periodTotalRevenue / Math.max(1, count)).toFixed(2)} CUP / unidad`,
    };
  }, [
    barData.items,
    periodTab,
    currentMonthOption.name,
    selectedWeekDef.label,
    periodFilteredSales.length,
    periodTotalRevenue,
  ]);

  // KPIs dinámicos calculados incluyendo devoluciones
  const kpis = useMemo(() => {
    const grossTotalFormatted = periodTotalRevenue.toLocaleString('es-CU', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

    const netTotalFormatted = periodNetRevenue.toLocaleString('es-CU', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

    const returnsTotalFormatted = returnsStats.totalRefund.toLocaleString('es-CU', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

    const netProfitFormatted = `${netProfit.toLocaleString('es-CU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} CUP`;

    return {
      grossTotal: grossTotalFormatted,
      netTotal: netTotalFormatted,
      returnsTotal: returnsTotalFormatted,
      returnsCount: returnsStats.count,
      returnsUnits: returnsStats.returnedUnits,
      returnsDamaged: returnsStats.damagedUnits,
      returnsRate: `${returnsStats.refundPercentageOfRevenue}%`,
      margin: `${marginPct}%`,
      netProfit: netProfitFormatted,
      grossLabel: periodTab === 'semanal' ? `Ventas Brutas (${selectedWeekDef.label})` : periodTab === 'mensual' ? `Ventas Brutas (${currentMonthOption.name})` : 'Ventas Brutas (Trimestre)',
      diffText: periodTotalRevenue > 0 ? `${periodFilteredSales.length} tickets emitidos` : 'Sin transacciones aún',
    };
  }, [
    periodTotalRevenue,
    periodNetRevenue,
    returnsStats,
    periodTab,
    selectedWeekDef.label,
    currentMonthOption.name,
    periodFilteredSales.length,
    netProfit,
    marginPct,
  ]);

  // Lista de Productos más vendidos derivada de las ventas reales
  const sortedProducts = useMemo(() => {
    const productStatsMap = new Map<string, { code: string; name: string; category: string; soldUnits: number; unitPrice: number; totalIncome: number }>();

    periodFilteredSales.forEach((s) => {
      (s.items || []).forEach((it) => {
        const key = it.productId || it.code || it.name;
        const existing = productStatsMap.get(key);
        if (existing) {
          existing.soldUnits += it.quantity || 0;
          existing.totalIncome += it.subtotal || 0;
        } else {
          const product = products.find((entry) => entry.id === it.productId || entry.code === it.code);
          productStatsMap.set(key, {
            code: it.code || 'S/C',
            name: it.name || 'Producto',
            category: product?.category || 'General',
            soldUnits: it.quantity || 0,
            unitPrice: it.unitPrice || 0,
            totalIncome: it.subtotal || 0,
          });
        }
      });
    });

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
      .map((item, idx) => {
        const returnedQty = returnedUnitsByProduct.get(item.code) || 0;
        return {
          rank: idx + 1,
          code: item.code,
          name: item.name,
          category: item.category,
          icon: 'inventory_2',
          soldUnits: item.soldUnits,
          returnedUnits: returnedQty,
          unitPrice: item.unitPrice,
          totalIncome: item.totalIncome,
          percentage: totalIncomeAll > 0 ? Number(((item.totalIncome / totalIncomeAll) * 100).toFixed(1)) : 0,
        };
      })
      .sort((a, b) => {
        if (filterSort === 'volumen') {
          return b.soldUnits - a.soldUnits;
        }
        return b.totalIncome - a.totalIncome;
      })
      .map((p, idx) => ({ ...p, rank: idx + 1 }));
  }, [periodFilteredSales, isCurrentSelectionToday, ipvRows, filterSort, returnedUnitsByProduct, products]);

  const leastSoldProducts = useMemo(
    () => [...sortedProducts]
      .sort((a, b) => a.soldUnits - b.soldUnits || a.totalIncome - b.totalIncome)
      .map((product, index) => ({ ...product, rank: index + 1 })),
    [sortedProducts]
  );
  const displayedProducts = tableTab === 'menos-vendidos' ? leastSoldProducts : sortedProducts;

  // Paginación para productos más vendidos
  const pageSize = 6;
  const totalPages = Math.max(1, Math.ceil(displayedProducts.length / pageSize));
  const validPage = Math.min(page, totalPages);
  const paginatedReports = displayedProducts.slice((validPage - 1) * pageSize, validPage * pageSize);
  const startIdx = displayedProducts.length === 0 ? 0 : (validPage - 1) * pageSize + 1;
  const endIdx = Math.min(validPage * pageSize, displayedProducts.length);

  // Filtrado y paginación para lista de Devoluciones en reportes
  const filteredReturnsForReport = useMemo(() => {
    if (!returnsSearch.trim()) return periodFilteredReturns;
    const q = returnsSearch.toLowerCase();
    return periodFilteredReturns.filter((r) => {
      const matchNum = r.returnNumber?.toLowerCase().includes(q);
      const matchTicket = r.ticketNumber?.toLowerCase().includes(q);
      const matchClient = r.customerName?.toLowerCase().includes(q);
      const matchReason = r.reason?.toLowerCase().includes(q);
      const matchProduct = (r.items || []).some(
        (it) => it.name.toLowerCase().includes(q) || it.code.toLowerCase().includes(q)
      );
      return matchNum || matchTicket || matchClient || matchReason || matchProduct;
    });
  }, [periodFilteredReturns, returnsSearch]);

  const returnsPageSize = 6;
  const returnsTotalPages = Math.max(1, Math.ceil(filteredReturnsForReport.length / returnsPageSize));
  const validReturnsPage = Math.min(returnsPage, returnsTotalPages);
  const paginatedReturns = filteredReturnsForReport.slice(
    (validReturnsPage - 1) * returnsPageSize,
    validReturnsPage * returnsPageSize
  );
  const returnsStartIdx = filteredReturnsForReport.length === 0 ? 0 : (validReturnsPage - 1) * returnsPageSize + 1;
  const returnsEndIdx = Math.min(validReturnsPage * returnsPageSize, filteredReturnsForReport.length);

  // Exportar datos reales consolidados (Ventas + Devoluciones)
  const handleExport = async () => {
    const filename =
      periodTab === 'trimestral'
        ? `Reporte_Comercial_Trimestral_${currentMonthOption.year}.csv`
        : periodTab === 'mensual'
        ? `Reporte_Comercial_${currentMonthOption.name.replace(' ', '_')}.csv`
        : `Reporte_Comercial_${currentMonthOption.name.replace(' ', '_')}_${selectedWeekKey.toUpperCase()}.csv`;

    const summaryLines = [
      '--- RESUMEN EJECUTIVO DEL PERIODO ---',
      `Periodo,${periodTab === 'semanal' ? `${selectedWeekDef.label} (${weekDateRangeLabel})` : periodTab === 'mensual' ? currentMonthOption.name : 'Trimestre Activo'}`,
      `Ventas Brutas Totales (CUP),${periodTotalRevenue.toFixed(2)}`,
      `Total Devoluciones / Reembolsos (CUP),${returnsStats.totalRefund.toFixed(2)}`,
      `Ventas Netas Realizadas (CUP),${periodNetRevenue.toFixed(2)}`,
      `Costo de Compra de Artículos Vendidos (CUP),${periodCost.toFixed(2)}`,
      `Cantidad de Devoluciones Procesadas,${returnsStats.count}`,
      `Unidades Devueltas Totales,${returnsStats.returnedUnits}`,
      `Unidades en Mal Estado (Merma),${returnsStats.damagedUnits}`,
      `Margen Bruto,${marginPct}%`,
      `Ganancias Netas (CUP),${netProfit.toFixed(2)}`,
      '',
      '--- PRODUCTOS MÁS VENDIDOS ---',
      'Rank,Codigo,Producto,Categoria,Uds_Vendidas,Uds_Devueltas,Precio_Unitario_CUP,Total_Ingresos_CUP,Porcentaje_Ventas',
    ];

    const productRows = sortedProducts.map((p) =>
      [
        p.rank,
        `"${p.code}"`,
        `"${p.name.replace(/"/g, '""')}"`,
        `"${p.category}"`,
        p.soldUnits,
        p.returnedUnits,
        p.unitPrice.toFixed(2),
        p.totalIncome.toFixed(2),
        `${p.percentage}%`,
      ].join(',')
    );

    const returnHeader = [
      '',
      '--- REGISTRO DETALLADO DE DEVOLUCIONES DEL PERIODO ---',
      'Folio_Devolucion,Fecha,Hora,Ticket_Origen,Cliente,Metodo_Reembolso,Motivo,Uds_Totales,Total_Reembolsado_CUP',
    ];

    const returnRows = periodFilteredReturns.map((r) => {
      const units = (r.items || []).reduce((s, it) => s + (it.quantity || 1), 0);
      const timePart = r.timestamp ? r.timestamp.split('T')[1]?.slice(0, 5) || '' : '';
      return [
        `"${r.returnNumber || ''}"`,
        `"${r.date || ''}"`,
        `"${timePart}"`,
        `"${r.ticketNumber || 'Venta Directa'}"`,
        `"${(r.customerName || 'Cliente').replace(/"/g, '""')}"`,
        `"${r.refundMethod}"`,
        `"${(r.reason || '').replace(/"/g, '""')}"`,
        units,
        (r.totalRefund || 0).toFixed(2),
      ].join(',');
    });

    const fullContent = [
      ...summaryLines,
      ...productRows,
      ...returnHeader,
      ...returnRows,
    ].join('\n');

    const csvContent = '\uFEFF' + fullContent;
    const result = await saveFileWithPicker(csvContent, {
      suggestedName: filename,
      mimeType: 'text/csv;charset=utf-8;',
      extension: 'csv',
      description: 'Reporte comercial (.csv / Excel)',
    });
    if (result.canceled) return;
    if (!result.ok) {
      showToast('Error al exportar reporte', result.error || 'No se pudo guardar el archivo.', 'error');
      return;
    }
    showToast('Reporte Completo Exportado', `Se ha generado "${filename}" con el balance de ventas y devoluciones.`);
  };

  const handlePeriodTabChange = (tab: 'semanal' | 'mensual' | 'trimestral') => {
    setPeriodTab(tab);
    setIsMonthDropdownOpen(false);
    setIsWeekDropdownOpen(false);
    setPage(1);
    setReturnsPage(1);
    const label = tab === 'semanal' ? 'Semanal' : tab === 'mensual' ? 'Mensual' : 'Trimestral';
    showToast('Periodo Actualizado', `Mostrando análisis para vista ${label}.`);
  };

  const formatCUP = (val: number) => {
    return Number(val || 0).toLocaleString('es-CU', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  return (
    <div className="flex flex-col w-full gap-8 select-none pb-12">
      {/* Header section */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-2xl lg:text-3xl font-headline font-bold text-on-surface tracking-tight flex items-center gap-2.5">
            <span>Reportes y Analítica Comercial</span>
          </h1>
          <p className="text-sm text-on-surface-variant max-w-2xl font-normal leading-relaxed">
            Consolidación integral de facturación bruta, reembolsos procesados por devoluciones y recaudación neta en CUP.
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
                            setReturnsPage(1);
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
                              setReturnsPage(1);
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

          {/* Export to Excel / CSV */}
          <button
            onClick={handleExport}
            className="h-11 px-4 rounded-xl bg-surface neo-raised flex items-center gap-2 text-xs font-semibold text-emerald-600 hover:text-emerald-700 active:neo-inset transition-all group cursor-pointer"
            type="button"
          >
            <span className="material-symbols-outlined text-[19px] transition-transform group-hover:-translate-y-0.5">
              table_view
            </span>
            <span>Exportar Reporte Completo [.csv]</span>
          </button>
        </div>
      </div>

      {/* 5 Bento Metric Cards with Returns and Inventory Investment */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-5">
        {/* Card 1: Total Ventas Brutas */}
        <div className="p-5 rounded-2xl bg-surface neo-raised flex flex-col justify-between relative overflow-hidden group">
          <div className="flex items-start justify-between">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold tracking-wide text-on-surface-variant uppercase">
                {kpis.grossLabel}
              </span>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className="text-2xl font-headline font-bold text-on-surface tracking-tight font-mono">
                  {kpis.grossTotal}
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
              Ventas
            </span>
            <span className="text-[11px] text-on-surface-variant font-medium truncate">
              {kpis.diffText}
            </span>
          </div>
        </div>

        {/* Card 2: Devoluciones y Reembolsos del Periodo */}
        <div className="p-5 rounded-2xl bg-surface neo-raised flex flex-col justify-between relative overflow-hidden group">
          <div className="flex items-start justify-between">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold tracking-wide text-rose-600 uppercase flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                Devoluciones del Período
              </span>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className="text-2xl font-headline font-bold text-rose-600 tracking-tight font-mono">
                  -${kpis.returnsTotal}
                </span>
                <span className="text-xs font-semibold text-rose-500 font-mono">CUP</span>
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-surface neo-inset flex items-center justify-center text-rose-500">
              <span className="material-symbols-outlined text-[22px]">assignment_return</span>
            </div>
          </div>
          <div className="flex items-center justify-between mt-4 pt-3 border-t border-outline-variant/15">
            <span className="text-[11px] text-on-surface-variant font-medium truncate">
              {kpis.returnsCount} devoluciones
            </span>
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full font-mono ${
                returnsStats.totalRefund > 0
                  ? 'text-rose-600 bg-rose-500/10'
                  : 'text-on-surface-variant bg-surface-container-high'
              }`}
            >
              {kpis.returnsRate} de ventas
            </span>
          </div>
        </div>

        {/* Card 3: Ventas Netas Efectivas */}
        <div className="p-5 rounded-2xl bg-surface neo-raised flex flex-col justify-between group">
          <div className="flex items-start justify-between">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold tracking-wide text-emerald-600 uppercase flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                Ventas Netas Realizadas
              </span>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className="text-2xl font-headline font-bold text-emerald-700 tracking-tight font-mono">
                  {kpis.netTotal}
                </span>
                <span className="text-xs font-semibold text-emerald-600 font-mono">CUP</span>
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-surface neo-inset flex items-center justify-center text-emerald-600">
              <span className="material-symbols-outlined text-[22px]">account_balance_wallet</span>
            </div>
          </div>
          <div className="flex items-center justify-between mt-4 pt-3 border-t border-outline-variant/15">
            <span className="text-[11px] text-on-surface-variant font-medium">
              Ingresos reales descontando reembolsos
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-emerald-600 bg-emerald-500/10 font-mono">
              Neto
            </span>
          </div>
        </div>

        {/* Card 4: Margen Bruto y Rentabilidad */}
        <div className="p-5 rounded-2xl bg-surface neo-raised flex flex-col justify-between group">
          <div className="flex items-start justify-between">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold tracking-wide text-on-surface-variant uppercase">
                Margen Bruto
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
              <span>Ganancias netas</span>
              <span className="font-semibold text-on-surface font-mono">{kpis.netProfit}</span>
            </div>
          </div>
        </div>

        {/* Card 5: Inversión Total en Inventario */}
        <div className="p-5 rounded-2xl bg-surface neo-raised flex flex-col justify-between group">
          <div className="flex items-start justify-between">
            <div className="flex min-w-0 flex-col gap-1">
              <span className="text-xs font-semibold tracking-wide text-amber-700 uppercase">
                Inversión Total
              </span>
              <span className="text-xl font-headline font-bold text-amber-800 tracking-tight font-mono mt-0.5 truncate" title={`${formatCUP(totalInventoryInvestment)} CUP`}>
                {formatCUP(totalInventoryInvestment)}
              </span>
              <span className="text-[10px] font-semibold text-amber-700 font-mono">CUP</span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-surface neo-inset flex items-center justify-center text-amber-600 shrink-0">
              <span className="material-symbols-outlined text-[22px]">inventory</span>
            </div>
          </div>
          <div className="flex items-center mt-4 pt-3 border-t border-outline-variant/15">
            <span className="text-[10px] text-on-surface-variant font-medium">
              Precio de compra × unidades en stock y almacén
            </span>
          </div>
        </div>
      </div>

      {/* Visual Analytics Grid */}
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
              Bruto: {barData.footerTotal}
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
                <span>Facturación Bruta</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-rose-500 font-medium">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
                <span>{returnsStats.count} devoluciones</span>
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
        </div>
      </div>

      {/* Main Reporting Tabs: Productos Más Vendidos vs Devoluciones del Periodo */}
      <div className="flex flex-col gap-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-outline-variant/20 pb-2">
          {/* Tabs Switcher */}
          <div className="flex flex-wrap items-center gap-1 p-1 rounded-xl bg-surface neo-inset">
            <button
              onClick={() => {
                setTableTab('productos');
                setPage(1);
              }}
              className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
                tableTab === 'productos'
                  ? 'bg-surface neo-raised text-primary shadow-sm'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
              type="button"
            >
              <span className="material-symbols-outlined text-[18px]">leaderboard</span>
              <span>Productos Más Vendidos</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-primary/10 text-primary">
                {sortedProducts.length}
              </span>
            </button>

            <button
              onClick={() => {
                setTableTab('menos-vendidos');
                setPage(1);
              }}
              className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
                tableTab === 'menos-vendidos'
                  ? 'bg-surface neo-raised text-amber-700 shadow-sm'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
              type="button"
            >
              <span className="material-symbols-outlined text-[18px]">trending_down</span>
              <span>Productos Menos Vendidos</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-amber-500/10 text-amber-700">
                {leastSoldProducts.length}
              </span>
            </button>

            <button
              onClick={() => {
                setTableTab('devoluciones');
                setReturnsPage(1);
              }}
              className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
                tableTab === 'devoluciones'
                  ? 'bg-surface neo-raised text-rose-600 shadow-sm'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
              type="button"
            >
              <span className="material-symbols-outlined text-[18px]">assignment_return</span>
              <span>Devoluciones del Periodo</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                  periodFilteredReturns.length > 0
                    ? 'bg-rose-500/15 text-rose-600 font-bold'
                    : 'bg-surface-container-high text-on-surface-variant'
                }`}
              >
                {periodFilteredReturns.length}
              </span>
            </button>
          </div>

          {/* Contextual Action for Current Tab */}
          {tableTab === 'productos' ? (
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
          ) : tableTab === 'menos-vendidos' ? (
            <span className="text-xs font-medium text-on-surface-variant">
              Orden ascendente por unidades vendidas
            </span>
          ) : (
            <div className="flex items-center gap-2">
              <div className="relative">
                <input
                  type="text"
                  value={returnsSearch}
                  onChange={(e) => {
                    setReturnsSearch(e.target.value);
                    setReturnsPage(1);
                  }}
                  placeholder="Buscar en devoluciones..."
                  className="h-9 pl-8 pr-3 text-xs rounded-xl bg-surface neo-inset text-on-surface placeholder:text-on-surface-variant/60 focus:outline-none focus:ring-1 focus:ring-primary w-52 sm:w-64"
                />
                <span className="material-symbols-outlined text-[16px] absolute left-2.5 top-2.5 text-on-surface-variant">
                  search
                </span>
              </div>
            </div>
          )}
        </div>

        {/* TAB 1: PRODUCTOS VENDIDOS */}
        {tableTab !== 'devoluciones' && (
          <div className="rounded-2xl bg-surface neo-raised p-2 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] xl:min-w-0 table-fixed text-left text-xs">
                <thead>
                  <tr className="text-[9px] font-semibold uppercase tracking-wide text-on-surface-variant">
                    <th className="py-2 px-2 text-center w-[6%]" scope="col">
                      # Rank
                    </th>
                    <th className="py-2 px-2 w-[23%]" scope="col">
                      Producto &amp; Especificación
                    </th>
                    <th className="py-2 px-2 w-[12%]" scope="col">
                      Categoría
                    </th>
                    <th className="py-2 px-2 text-right w-[10%]" scope="col">
                      Uds. Vendidas
                    </th>
                    <th className="py-2 px-2 text-center w-[10%]" scope="col">
                      Devueltas
                    </th>
                    <th className="py-2 px-2 text-right w-[12%]" scope="col">
                      Precio Unitario (CUP)
                    </th>
                    <th className="py-2 px-2 text-right w-[14%]" scope="col">
                      Total Ingresos (CUP)
                    </th>
                    <th className="py-2 px-2 text-center w-[13%]" scope="col">
                      % Ventas Periodo
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y-0 text-on-surface">
                  {paginatedReports.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-xs text-on-surface-variant font-medium">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <span className="material-symbols-outlined text-[32px] text-on-surface-variant/70">receipt_long</span>
                          <span>{tableTab === 'menos-vendidos' ? 'No hay productos vendidos para el periodo seleccionado' : 'No hay registros de ventas para el periodo seleccionado'}</span>
                          <p className="text-[10px] text-on-surface-variant/70 max-w-sm">
                            A medida que se registren ventas en la caja o en el IPV, los datos y estadísticas se calcularán automáticamente aquí.
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    paginatedReports.map((p) => (
                      <tr key={p.rank} className="group hover:bg-surface-container-high/40 transition-colors">
                        <td className="py-2 px-2 text-center">
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-lg bg-surface neo-inset text-primary font-bold text-[10px] font-mono">
                            {p.rank}
                          </span>
                        </td>
                        <td className="py-2 px-2">
                          <div className="flex min-w-0 items-center gap-2">
                            <div className="w-7 h-7 rounded-lg bg-surface neo-raised flex items-center justify-center text-on-surface-variant shrink-0">
                              <span className="material-symbols-outlined text-[16px]">{p.icon}</span>
                            </div>
                            <div className="flex min-w-0 flex-col">
                              <span title={p.name} className="truncate font-semibold text-on-surface group-hover:text-primary transition-colors">
                                {p.name}
                              </span>
                              <span title={p.code} className="truncate text-[9px] text-on-surface-variant font-mono">COD: {p.code}</span>
                            </div>
                          </div>
                        </td>
                        <td className="py-2 px-2">
                          <span title={p.category} className="block truncate px-2 py-1 rounded-full text-[10px] font-medium bg-surface neo-inset text-on-surface-variant">
                            {p.category}
                          </span>
                        </td>
                        <td className="py-2 px-2 text-right font-medium font-mono">{p.soldUnits} u.</td>
                        <td className="py-2 px-2 text-center">
                          {p.returnedUnits > 0 ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-600 font-mono">
                              <span className="material-symbols-outlined text-[13px]">assignment_return</span>
                              -{p.returnedUnits} u.
                            </span>
                          ) : (
                            <span className="text-on-surface-variant/40 font-mono text-xs">-</span>
                          )}
                        </td>
                        <td className="py-2 px-2 text-right text-on-surface-variant font-mono text-[10px]">
                          {p.unitPrice.toFixed(2)}
                        </td>
                        <td className="py-2 px-2 text-right font-bold text-on-surface font-mono text-[10px]">
                          {p.totalIncome.toLocaleString('es-CU', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}{' '}
                        </td>
                        <td className="py-2 px-2">
                          <div className="flex items-center gap-1.5">
                            <div className="flex-1 h-1.5 rounded-full bg-surface neo-inset overflow-hidden">
                              <div
                                className="h-full rounded-full bg-primary"
                                style={{ width: `${Math.min(100, p.percentage)}%` }}
                              ></div>
                            </div>
                            <span className="text-[10px] font-bold text-on-surface w-8 text-right font-mono">
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
                <strong className="text-on-surface">{displayedProducts.length}</strong> productos analizados
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
        )}

        {/* TAB 2: DETALLE DE DEVOLUCIONES DEL PERIODO */}
        {tableTab === 'devoluciones' && (
          <div className="flex flex-col gap-5">
            {/* 4 Mini Cards de Resumen de Devoluciones */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-surface neo-inset flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-[11px] font-semibold text-on-surface-variant uppercase">
                    Reembolso en Efectivo
                  </span>
                  <span className="text-lg font-bold text-on-surface font-mono mt-0.5">
                    ${formatCUP(returnsStats.cashRefund)} CUP
                  </span>
                </div>
                <div className="w-8 h-8 rounded-lg bg-surface neo-raised flex items-center justify-center text-primary">
                  <span className="material-symbols-outlined text-[18px]">payments</span>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-surface neo-inset flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-[11px] font-semibold text-on-surface-variant uppercase">
                    Reembolso Transferencia
                  </span>
                  <span className="text-lg font-bold text-on-surface font-mono mt-0.5">
                    ${formatCUP(returnsStats.transferRefund)} CUP
                  </span>
                </div>
                <div className="w-8 h-8 rounded-lg bg-surface neo-raised flex items-center justify-center text-primary">
                  <span className="material-symbols-outlined text-[18px]">account_balance</span>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-surface neo-inset flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-[11px] font-semibold text-emerald-700 uppercase">
                    Venta como defectuoso
                  </span>
                  <span className="text-lg font-bold text-emerald-700 font-mono mt-0.5">
                    {returnDestinationStats.defectiveSaleUnits} unidades
                  </span>
                </div>
                <div className="w-8 h-8 rounded-lg bg-surface neo-raised flex items-center justify-center text-emerald-600">
                  <span className="material-symbols-outlined text-[18px]">sell</span>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-surface neo-inset flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-[11px] font-semibold text-rose-600 uppercase">
                    Artículos dados de baja
                  </span>
                  <span className="text-lg font-bold text-rose-600 font-mono mt-0.5">
                    {returnDestinationStats.writtenOffUnits} unidades
                  </span>
                </div>
                <div className="w-8 h-8 rounded-lg bg-surface neo-raised flex items-center justify-center text-rose-500">
                  <span className="material-symbols-outlined text-[18px]">delete_sweep</span>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-surface neo-inset flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-[11px] font-semibold text-sky-700 uppercase">
                    Buen estado al almacén
                  </span>
                  <span className="text-lg font-bold text-sky-700 font-mono mt-0.5">
                    {returnDestinationStats.warehouseUnits} unidades
                  </span>
                </div>
                <div className="w-8 h-8 rounded-lg bg-surface neo-raised flex items-center justify-center text-sky-600">
                  <span className="material-symbols-outlined text-[18px]">warehouse</span>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-surface neo-inset flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-[11px] font-semibold text-emerald-700 uppercase">
                    Buen estado al stock
                  </span>
                  <span className="text-lg font-bold text-emerald-700 font-mono mt-0.5">
                    {returnDestinationStats.stockUnits} unidades
                  </span>
                </div>
                <div className="w-8 h-8 rounded-lg bg-surface neo-raised flex items-center justify-center text-emerald-600">
                  <span className="material-symbols-outlined text-[18px]">inventory_2</span>
                </div>
              </div>
            </div>

            {/* Tabla Detallada de Devoluciones */}
            <div className="rounded-2xl bg-surface neo-raised p-2 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] xl:min-w-0 table-fixed text-left text-xs">
                  <thead>
                    <tr className="text-[9px] font-semibold uppercase tracking-wide text-on-surface-variant">
                      <th className="py-2 px-2 w-[14%]" scope="col">
                        Folio &amp; Fecha
                      </th>
                      <th className="py-2 px-2 w-[13%]" scope="col">
                        Ticket Origen
                      </th>
                      <th className="py-2 px-2 w-[19%]" scope="col">
                        Cliente / Motivo
                      </th>
                      <th className="py-2 px-2 w-[29%]" scope="col">
                        Artículos Devueltos
                      </th>
                      <th className="py-2 px-2 text-center w-[12%]" scope="col">
                        Método Reembolso
                      </th>
                      <th className="py-2 px-2 text-right w-[13%]" scope="col">
                        Monto Reembolsado (CUP)
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y-0 text-on-surface">
                    {paginatedReturns.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-xs text-on-surface-variant font-medium">
                          <div className="flex flex-col items-center justify-center gap-2">
                            <span className="material-symbols-outlined text-[32px] text-on-surface-variant/70">
                              assignment_return
                            </span>
                            <span>No hay devoluciones registradas en este periodo</span>
                            <p className="text-[11px] text-on-surface-variant/70 max-w-sm">
                              Cualquier devolución registrada para esta semana, mes o trimestre aparecerá clasificada aquí automáticamente.
                            </p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      paginatedReturns.map((r: ReturnRecord) => {
                        const totalUnits = (r.items || []).reduce((acc, it) => acc + (it.quantity || 1), 0);
                        const hasDamaged = r.hasDamagedItems || (r.items || []).some((it) => it.condition === 'mal_estado');
                        const destinations = getReturnItemMermas(r, mermaItems);

                        return (
                          <tr key={r.id} className="group hover:bg-surface-container-high/40 transition-colors">
                            <td className="py-2 px-2">
                              <div className="flex flex-col">
                                <span className="truncate font-bold text-on-surface font-mono group-hover:text-primary transition-colors">
                                  {r.returnNumber || 'DEV-N/A'}
                                </span>
                                <span className="text-[9px] text-on-surface-variant font-mono">
                                  {r.date} {r.timestamp ? r.timestamp.split('T')[1]?.slice(0, 5) : ''}
                                </span>
                              </div>
                            </td>
                            <td className="py-2 px-2">
                              <span className="block truncate px-2 py-1 rounded-md text-[10px] font-mono font-medium bg-surface neo-inset text-on-surface-variant">
                                {r.ticketNumber || 'Venta directa'}
                              </span>
                            </td>
                            <td className="py-2 px-2">
                              <div className="flex min-w-0 flex-col">
                                <span className="font-semibold text-on-surface text-[11px] truncate">
                                  {r.customerName || 'Cliente general'}
                                </span>
                                <span className="text-[10px] text-on-surface-variant truncate">
                                  {r.reason || 'Sin motivo especificado'}
                                </span>
                              </div>
                            </td>
                            <td className="py-2 px-2">
                              <div className="flex min-w-0 flex-col gap-1">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[10px] font-medium text-on-surface font-mono">
                                    {totalUnits} {totalUnits === 1 ? 'artículo' : 'artículos'}
                                  </span>
                                  {hasDamaged ? (
                                    <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-rose-500/10 text-rose-600">
                                      Con merma
                                    </span>
                                  ) : (
                                    <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-600">
                                      Reintegrable
                                    </span>
                                  )}
                                </div>
                                <div className="flex min-w-0 flex-col gap-1 mt-0.5">
                                  {(r.items || []).map((it, idx) => {
                                    const destination = getMermaDestination(destinations[idx]);
                                    return (
                                      <div key={`${it.productId}-${idx}`} className="flex items-center gap-1 min-w-0">
                                        <span title={it.name} className="text-[10px] text-on-surface-variant truncate">
                                          {it.name} (x{it.quantity})
                                        </span>
                                        <span className={`shrink-0 px-1 py-0.5 rounded text-[8px] font-bold ${destination.className}`}>
                                          {destination.label}
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            </td>
                            <td className="py-2 px-2 text-center">
                              <span
                                className={`px-2 py-1 rounded-full text-[9px] font-semibold uppercase tracking-wide ${
                                  r.refundMethod === 'efectivo'
                                    ? 'bg-emerald-500/10 text-emerald-700'
                                    : r.refundMethod === 'transferencia'
                                    ? 'bg-blue-500/10 text-blue-700'
                                    : 'bg-purple-500/10 text-purple-700'
                                }`}
                              >
                                {r.refundMethod}
                              </span>
                            </td>
                            <td className="py-2 px-2 text-right">
                              <span className="font-bold text-rose-600 font-mono text-[10px]">
                                -{formatCUP(r.totalRefund)}
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              <div className="p-3.5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-on-surface-variant bg-surface rounded-xl mt-2 neo-inset">
                <span className="font-medium">
                  Mostrando <strong className="text-on-surface">{returnsStartIdx} a {returnsEndIdx}</strong> de{' '}
                  <strong className="text-on-surface">{filteredReturnsForReport.length}</strong> devoluciones registradas
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setReturnsPage((p) => Math.max(1, p - 1))}
                    disabled={validReturnsPage === 1}
                    className={`w-8 h-8 rounded-lg bg-surface neo-raised flex items-center justify-center transition-all ${
                      validReturnsPage === 1
                        ? 'opacity-40 cursor-not-allowed text-on-surface-variant'
                        : 'hover:text-primary active:neo-inset cursor-pointer text-on-surface'
                    }`}
                    type="button"
                    title="Página anterior"
                  >
                    <span className="material-symbols-outlined text-[16px]">chevron_left</span>
                  </button>

                  {Array.from({ length: returnsTotalPages }, (_, i) => i + 1).map((pageNum) => (
                    <button
                      key={pageNum}
                      onClick={() => setReturnsPage(pageNum)}
                      className={`w-8 h-8 rounded-lg text-xs font-semibold flex items-center justify-center transition-all cursor-pointer ${
                        validReturnsPage === pageNum
                          ? 'bg-surface neo-inset text-rose-600 font-bold shadow-inner'
                          : 'bg-surface neo-raised text-on-surface-variant hover:text-on-surface active:neo-inset'
                      }`}
                      type="button"
                    >
                      {pageNum}
                    </button>
                  ))}

                  <button
                    onClick={() => setReturnsPage((p) => Math.min(returnsTotalPages, p + 1))}
                    disabled={validReturnsPage === returnsTotalPages}
                    className={`w-8 h-8 rounded-lg bg-surface neo-raised flex items-center justify-center transition-all ${
                      validReturnsPage === returnsTotalPages
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
        )}
      </div>
    </div>
  );
};
