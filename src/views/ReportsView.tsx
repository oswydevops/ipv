import React, { useState } from 'react';
import { TOP_PRODUCTS } from '../data/initialData';
import { useApp } from '../context/AppContext';

interface BarItem {
  label: string;
  sublabel: string;
  value: number;
  formatted: string;
  heightPct: number;
  isPeak?: boolean;
}

interface PeriodConfig {
  kpis: {
    total: string;
    totalLabel: string;
    diff: string;
    diffText: string;
    avgLabel: string;
    avgDaily: string;
    avgDailyNote: string;
    peakTitle: string;
    peakValue: string;
    peakAmount: string;
    peakBadge: string;
    margin: string;
    netProfit: string;
  };
  bars: {
    title: string;
    subtitle: string;
    badge: string;
    items: BarItem[];
    footerNote: string;
    footerTotal: string;
  };
  curve: {
    title: string;
    subtitle: string;
    labels: string[];
    peakText: string;
    peakCoord: { x: number; y: number };
    areaPath: string;
    linePath: string;
    movingAvgPath: string;
    dots: { cx: number; cy: number }[];
    varianceText: string;
    avgTrans: string;
  };
}

type MonthKey = 'octubre' | 'septiembre' | 'agosto';
type WeekKey = 'sem1' | 'sem2' | 'sem3' | 'sem4';

interface MonthData {
  name: string;
  shortName: string;
  mensual: PeriodConfig;
  semanas: Record<
    WeekKey,
    {
      label: string;
      dateRange: string;
      config: PeriodConfig;
    }
  >;
}

const HISTORIAL_DATA: Record<MonthKey, MonthData> = {
  octubre: {
    name: 'Octubre 2024',
    shortName: 'Oct',
    mensual: {
      kpis: {
        total: '1,248,500.00',
        totalLabel: 'Ventas Totales de Octubre',
        diff: '+18.5%',
        diffText: 'vs. septiembre (1,411,700 CUP)',
        avgLabel: 'Promedio Diario',
        avgDaily: '49,940.00',
        avgDailyNote: 'Tasa calculada en 25 días operativos',
        peakTitle: 'Mejor Semana',
        peakValue: 'Semana 3',
        peakAmount: '385,200.00 CUP',
        peakBadge: 'Pico de Octubre',
        margin: '34.2%',
        netProfit: '427,000 CUP',
      },
      bars: {
        title: 'Ventas por Semana - Octubre (CUP)',
        subtitle: 'Desglose de las 4 semanas de octubre',
        badge: '4 semanas',
        items: [
          { label: 'Sem 1', sublabel: '280,000', value: 280000, formatted: '280k', heightPct: 72 },
          { label: 'Sem 2', sublabel: '310,000', value: 310000, formatted: '310k', heightPct: 80 },
          { label: 'Sem 3', sublabel: '385,200', value: 385200, formatted: '385k ★', heightPct: 100, isPeak: true },
          { label: 'Sem 4', sublabel: '273,300', value: 273300, formatted: '273k', heightPct: 70 },
        ],
        footerNote: 'Semana de mayor facturación: Semana 3',
        footerTotal: '1,248,500 CUP',
      },
      curve: {
        title: 'Comportamiento Diario (Octubre)',
        subtitle: 'Consistencia de recaudación diaria y puntos de alta rotación',
        labels: ['Día 01', 'Día 05', 'Día 10', 'Día 15', 'Día 19 (Pico)', 'Día 23', 'Día 27', 'Hoy'],
        peakText: 'Pico: 68,400 CUP',
        peakCoord: { x: 410, y: 40 },
        areaPath: 'M 10 180 Q 60 160 110 140 T 210 130 T 310 90 T 410 40 T 510 120 T 610 80 T 690 100 L 690 225 L 10 225 Z',
        linePath: 'M 10 180 Q 60 160 110 140 T 210 130 T 310 90 T 410 40 T 510 120 T 610 80 T 690 100',
        movingAvgPath: 'M 10 165 Q 110 150 210 135 T 410 85 T 610 95 T 690 92',
        dots: [
          { cx: 110, cy: 140 },
          { cx: 210, cy: 130 },
          { cx: 310, cy: 90 },
          { cx: 510, cy: 120 },
          { cx: 610, cy: 80 },
          { cx: 690, cy: 100 },
        ],
        varianceText: 'Varianza diaria controlada: ±12% respecto a la mediana',
        avgTrans: 'Volumen promedio: 142 tickets/día',
      },
    },
    semanas: {
      sem1: {
        label: 'Semana 1',
        dateRange: '01 - 07 Oct',
        config: {
          kpis: {
            total: '280,000.00',
            totalLabel: 'Ventas Semana 1 (Octubre)',
            diff: '+5.4%',
            diffText: 'vs. semana previa',
            avgLabel: 'Promedio Diario',
            avgDaily: '40,000.00',
            avgDailyNote: 'Tasa promedio en 7 días',
            peakTitle: 'Mejor Día',
            peakValue: 'Sábado 05 Oct',
            peakAmount: '58,200.00 CUP',
            peakBadge: 'Pico Sem 1',
            margin: '34.0%',
            netProfit: '95,200 CUP',
          },
          bars: {
            title: 'Ventas Diarias - Semana 1 Octubre (CUP)',
            subtitle: 'Desglose del 01 al 07 de octubre',
            badge: 'Semana 1',
            items: [
              { label: 'Lun 01', sublabel: '34,000', value: 34000, formatted: '34k', heightPct: 58 },
              { label: 'Mar 02', sublabel: '38,000', value: 38000, formatted: '38k', heightPct: 65 },
              { label: 'Mié 03', sublabel: '37,000', value: 37000, formatted: '37k', heightPct: 63 },
              { label: 'Jue 04', sublabel: '41,000', value: 41000, formatted: '41k', heightPct: 70 },
              { label: 'Vie 05', sublabel: '48,000', value: 48000, formatted: '48k', heightPct: 82 },
              { label: 'Sáb 06', sublabel: '58,200', value: 58200, formatted: '58.2k ★', heightPct: 100, isPeak: true },
              { label: 'Dom 07', sublabel: '23,800', value: 23800, formatted: '23.8k', heightPct: 41 },
            ],
            footerNote: 'Día pico: Sábado (58,200 CUP)',
            footerTotal: '280,000 CUP',
          },
          curve: {
            title: 'Curva de Tendencia - Semana 1 Octubre',
            subtitle: 'Evolución diaria de recaudación',
            labels: ['Lun 01', 'Mar 02', 'Mié 03', 'Jue 04', 'Vie 05', 'Sáb 06 (Pico)', 'Dom 07'],
            peakText: 'Pico: 58,200 CUP',
            peakCoord: { x: 575, y: 45 },
            areaPath: 'M 10 175 Q 90 155 170 140 T 270 145 T 370 125 T 470 100 T 575 45 T 685 185 L 685 225 L 10 225 Z',
            linePath: 'M 10 175 Q 90 155 170 140 T 270 145 T 370 125 T 470 100 T 575 45 T 685 185',
            movingAvgPath: 'M 10 165 Q 150 150 300 135 T 450 105 T 600 80 T 685 115',
            dots: [{ cx: 90, cy: 155 }, { cx: 170, cy: 140 }, { cx: 270, cy: 145 }, { cx: 370, cy: 125 }, { cx: 470, cy: 100 }, { cx: 685, cy: 185 }],
            varianceText: 'Varianza intersemanal controlada: ±8%',
            avgTrans: 'Volumen promedio: 132 tickets/día',
          },
        },
      },
      sem2: {
        label: 'Semana 2',
        dateRange: '08 - 14 Oct',
        config: {
          kpis: {
            total: '310,000.00',
            totalLabel: 'Ventas Semana 2 (Octubre)',
            diff: '+10.7%',
            diffText: 'vs. semana 1 (+30,000 CUP)',
            avgLabel: 'Promedio Diario',
            avgDaily: '44,285.71',
            avgDailyNote: 'Tasa promedio en 7 días',
            peakTitle: 'Mejor Día',
            peakValue: 'Sábado 12 Oct',
            peakAmount: '64,000.00 CUP',
            peakBadge: 'Pico Sem 2',
            margin: '34.5%',
            netProfit: '106,950 CUP',
          },
          bars: {
            title: 'Ventas Diarias - Semana 2 Octubre (CUP)',
            subtitle: 'Desglose del 08 al 14 de octubre',
            badge: 'Semana 2',
            items: [
              { label: 'Lun 08', sublabel: '36,000', value: 36000, formatted: '36k', heightPct: 56 },
              { label: 'Mar 09', sublabel: '41,000', value: 41000, formatted: '41k', heightPct: 64 },
              { label: 'Mié 10', sublabel: '39,000', value: 39000, formatted: '39k', heightPct: 61 },
              { label: 'Jue 11', sublabel: '45,000', value: 45000, formatted: '45k', heightPct: 70 },
              { label: 'Vie 12', sublabel: '52,000', value: 52000, formatted: '52k', heightPct: 81 },
              { label: 'Sáb 13', sublabel: '64,000', value: 64000, formatted: '64k ★', heightPct: 100, isPeak: true },
              { label: 'Dom 14', sublabel: '33,000', value: 33000, formatted: '33k', heightPct: 51 },
            ],
            footerNote: 'Día pico: Sábado (64,000 CUP)',
            footerTotal: '310,000 CUP',
          },
          curve: {
            title: 'Curva de Tendencia - Semana 2 Octubre',
            subtitle: 'Evolución diaria de recaudación',
            labels: ['Lun 08', 'Mar 09', 'Mié 10', 'Jue 11', 'Vie 12', 'Sáb 13 (Pico)', 'Dom 14'],
            peakText: 'Pico: 64,000 CUP',
            peakCoord: { x: 575, y: 40 },
            areaPath: 'M 10 170 Q 90 150 170 135 T 270 140 T 370 120 T 470 90 T 575 40 T 685 160 L 685 225 L 10 225 Z',
            linePath: 'M 10 170 Q 90 150 170 135 T 270 140 T 370 120 T 470 90 T 575 40 T 685 160',
            movingAvgPath: 'M 10 160 Q 150 145 300 130 T 450 100 T 600 75 T 685 105',
            dots: [{ cx: 90, cy: 150 }, { cx: 170, cy: 135 }, { cx: 270, cy: 140 }, { cx: 370, cy: 120 }, { cx: 470, cy: 90 }, { cx: 685, cy: 160 }],
            varianceText: 'Crecimiento sostenido: +10.7%',
            avgTrans: 'Volumen promedio: 138 tickets/día',
          },
        },
      },
      sem3: {
        label: 'Semana 3',
        dateRange: '15 - 21 Oct',
        config: {
          kpis: {
            total: '385,200.00',
            totalLabel: 'Ventas Semana 3 (Octubre)',
            diff: '+24.2%',
            diffText: 'vs. semana 2 (Semana Récord)',
            avgLabel: 'Promedio Diario',
            avgDaily: '55,028.57',
            avgDailyNote: 'Tasa promedio en 7 días',
            peakTitle: 'Mejor Día',
            peakValue: 'Sábado 19 Oct',
            peakAmount: '78,500.00 CUP',
            peakBadge: 'Récord Mensual',
            margin: '35.1%',
            netProfit: '135,200 CUP',
          },
          bars: {
            title: 'Ventas Diarias - Semana 3 Octubre (CUP)',
            subtitle: 'Desglose del 15 al 21 de octubre (Pico del mes)',
            badge: 'Semana 3 ★',
            items: [
              { label: 'Lun 15', sublabel: '45,000', value: 45000, formatted: '45k', heightPct: 57 },
              { label: 'Mar 16', sublabel: '51,000', value: 51000, formatted: '51k', heightPct: 65 },
              { label: 'Mié 17', sublabel: '48,000', value: 48000, formatted: '48k', heightPct: 61 },
              { label: 'Jue 18', sublabel: '56,000', value: 56000, formatted: '56k', heightPct: 71 },
              { label: 'Vie 19', sublabel: '68,000', value: 68000, formatted: '68k', heightPct: 86 },
              { label: 'Sáb 20', sublabel: '78,500', value: 78500, formatted: '78.5k ★', heightPct: 100, isPeak: true },
              { label: 'Dom 21', sublabel: '38,700', value: 38700, formatted: '38.7k', heightPct: 49 },
            ],
            footerNote: 'Semana pico del mes: 385,200 CUP',
            footerTotal: '385,200 CUP',
          },
          curve: {
            title: 'Curva de Tendencia - Semana 3 Octubre',
            subtitle: 'Semana récord de facturación comercial',
            labels: ['Lun 15', 'Mar 16', 'Mié 17', 'Jue 18', 'Vie 19', 'Sáb 20 (Pico)', 'Dom 21'],
            peakText: 'Pico: 78,500 CUP',
            peakCoord: { x: 575, y: 30 },
            areaPath: 'M 10 160 Q 90 140 170 120 T 270 128 T 370 100 T 470 65 T 575 30 T 685 145 L 685 225 L 10 225 Z',
            linePath: 'M 10 160 Q 90 140 170 120 T 270 128 T 370 100 T 470 65 T 575 30 T 685 145',
            movingAvgPath: 'M 10 150 Q 150 130 300 115 T 450 85 T 600 60 T 685 95',
            dots: [{ cx: 90, cy: 140 }, { cx: 170, cy: 120 }, { cx: 270, cy: 128 }, { cx: 370, cy: 100 }, { cx: 470, cy: 65 }, { cx: 685, cy: 145 }],
            varianceText: 'Récord histórico de rotación: +24.2%',
            avgTrans: 'Volumen promedio: 165 tickets/día',
          },
        },
      },
      sem4: {
        label: 'Semana 4',
        dateRange: '22 - 28 Oct',
        config: {
          kpis: {
            total: '273,300.00',
            totalLabel: 'Ventas Semana 4 (Octubre)',
            diff: '-29.0%',
            diffText: 'vs. semana 3 (estabilización)',
            avgLabel: 'Promedio Diario',
            avgDaily: '39,042.86',
            avgDailyNote: 'Tasa promedio en 7 días',
            peakTitle: 'Mejor Día',
            peakValue: 'Sábado 26 Oct',
            peakAmount: '56,800.00 CUP',
            peakBadge: 'Pico Sem 4',
            margin: '33.9%',
            netProfit: '92,650 CUP',
          },
          bars: {
            title: 'Ventas Diarias - Semana 4 Octubre (CUP)',
            subtitle: 'Desglose del 22 al 28 de octubre',
            badge: 'Semana 4',
            items: [
              { label: 'Lun 22', sublabel: '33,000', value: 33000, formatted: '33k', heightPct: 58 },
              { label: 'Mar 23', sublabel: '37,000', value: 37000, formatted: '37k', heightPct: 65 },
              { label: 'Mié 24', sublabel: '36,000', value: 36000, formatted: '36k', heightPct: 63 },
              { label: 'Jue 25', sublabel: '40,000', value: 40000, formatted: '40k', heightPct: 70 },
              { label: 'Vie 26', sublabel: '47,000', value: 47000, formatted: '47k', heightPct: 83 },
              { label: 'Sáb 27', sublabel: '56,800', value: 56800, formatted: '56.8k ★', heightPct: 100, isPeak: true },
              { label: 'Dom 28', sublabel: '23,500', value: 23500, formatted: '23.5k', heightPct: 41 },
            ],
            footerNote: 'Día pico: Sábado (56,800 CUP)',
            footerTotal: '273,300 CUP',
          },
          curve: {
            title: 'Curva de Tendencia - Semana 4 Octubre',
            subtitle: 'Evolución diaria de recaudación',
            labels: ['Lun 22', 'Mar 23', 'Mié 24', 'Jue 25', 'Vie 26', 'Sáb 27 (Pico)', 'Dom 28'],
            peakText: 'Pico: 56,800 CUP',
            peakCoord: { x: 575, y: 50 },
            areaPath: 'M 10 180 Q 90 160 170 145 T 270 150 T 370 130 T 470 105 T 575 50 T 685 190 L 685 225 L 10 225 Z',
            linePath: 'M 10 180 Q 90 160 170 145 T 270 150 T 370 130 T 470 105 T 575 50 T 685 190',
            movingAvgPath: 'M 10 170 Q 150 155 300 140 T 450 110 T 600 85 T 685 120',
            dots: [{ cx: 90, cy: 160 }, { cx: 170, cy: 145 }, { cx: 270, cy: 150 }, { cx: 370, cy: 130 }, { cx: 470, cy: 105 }, { cx: 685, cy: 190 }],
            varianceText: 'Estabilización de fin de mes: ±11%',
            avgTrans: 'Volumen promedio: 129 tickets/día',
          },
        },
      },
    },
  },
  septiembre: {
    name: 'Septiembre 2024',
    shortName: 'Sep',
    mensual: {
      kpis: {
        total: '1,411,700.00',
        totalLabel: 'Ventas Totales de Septiembre',
        diff: '+19.6%',
        diffText: 'vs. agosto (1,180,000 CUP)',
        avgLabel: 'Promedio Diario',
        avgDaily: '56,468.00',
        avgDailyNote: 'Tasa calculada en 25 días operativos',
        peakTitle: 'Mejor Semana',
        peakValue: 'Semana 3',
        peakAmount: '412,000.00 CUP',
        peakBadge: 'Pico del Trimestre',
        margin: '35.4%',
        netProfit: '499,700 CUP',
      },
      bars: {
        title: 'Ventas por Semana - Septiembre (CUP)',
        subtitle: 'Desglose de las 4 semanas de septiembre',
        badge: '4 semanas',
        items: [
          { label: 'Sem 1', sublabel: '325,000', value: 325000, formatted: '325k', heightPct: 79 },
          { label: 'Sem 2', sublabel: '348,000', value: 348000, formatted: '348k', heightPct: 84 },
          { label: 'Sem 3', sublabel: '412,000', value: 412000, formatted: '412k ★', heightPct: 100, isPeak: true },
          { label: 'Sem 4', sublabel: '326,700', value: 326700, formatted: '326k', heightPct: 79 },
        ],
        footerNote: 'Semana récord de facturación: Semana 3',
        footerTotal: '1,411,700 CUP',
      },
      curve: {
        title: 'Comportamiento Diario (Septiembre)',
        subtitle: 'Mes pico del trimestre con fuerte actividad comercial',
        labels: ['Día 01', 'Día 05', 'Día 10', 'Día 15', 'Día 20 (Pico)', 'Día 24', 'Día 28', 'Día 30'],
        peakText: 'Pico: 84,000 CUP',
        peakCoord: { x: 420, y: 35 },
        areaPath: 'M 10 170 Q 70 145 130 130 T 230 115 T 330 80 T 420 35 T 520 95 T 620 75 T 690 90 L 690 225 L 10 225 Z',
        linePath: 'M 10 170 Q 70 145 130 130 T 230 115 T 330 80 T 420 35 T 520 95 T 620 75 T 690 90',
        movingAvgPath: 'M 10 155 Q 120 135 230 120 T 420 75 T 620 85 T 690 85',
        dots: [
          { cx: 130, cy: 130 },
          { cx: 230, cy: 115 },
          { cx: 330, cy: 80 },
          { cx: 520, cy: 95 },
          { cx: 620, cy: 75 },
          { cx: 690, cy: 90 },
        ],
        varianceText: 'Mes de mayor rendimiento del año: +19.6%',
        avgTrans: 'Volumen promedio: 154 tickets/día',
      },
    },
    semanas: {
      sem1: {
        label: 'Semana 1',
        dateRange: '01 - 07 Sep',
        config: {
          kpis: {
            total: '325,000.00',
            totalLabel: 'Ventas Semana 1 (Septiembre)',
            diff: '+14.0%',
            diffText: 'vs. última semana de agosto',
            avgLabel: 'Promedio Diario',
            avgDaily: '46,428.57',
            avgDailyNote: 'Tasa promedio en 7 días',
            peakTitle: 'Mejor Día',
            peakValue: 'Sábado 07 Sep',
            peakAmount: '67,500.00 CUP',
            peakBadge: 'Pico Sem 1',
            margin: '35.0%',
            netProfit: '113,750 CUP',
          },
          bars: {
            title: 'Ventas Diarias - Semana 1 Septiembre (CUP)',
            subtitle: 'Desglose del 01 al 07 de septiembre',
            badge: 'Semana 1',
            items: [
              { label: 'Lun 01', sublabel: '40,000', value: 40000, formatted: '40k', heightPct: 59 },
              { label: 'Mar 02', sublabel: '43,000', value: 43000, formatted: '43k', heightPct: 64 },
              { label: 'Mié 03', sublabel: '42,000', value: 42000, formatted: '42k', heightPct: 62 },
              { label: 'Jue 04', sublabel: '47,000', value: 47000, formatted: '47k', heightPct: 70 },
              { label: 'Vie 05', sublabel: '56,000', value: 56000, formatted: '56k', heightPct: 83 },
              { label: 'Sáb 06', sublabel: '67,500', value: 67500, formatted: '67.5k ★', heightPct: 100, isPeak: true },
              { label: 'Dom 07', sublabel: '29,500', value: 29500, formatted: '29.5k', heightPct: 44 },
            ],
            footerNote: 'Día pico: Sábado (67,500 CUP)',
            footerTotal: '325,000 CUP',
          },
          curve: {
            title: 'Curva de Tendencia - Semana 1 Septiembre',
            subtitle: 'Evolución diaria de recaudación',
            labels: ['Lun 01', 'Mar 02', 'Mié 03', 'Jue 04', 'Vie 05', 'Sáb 06 (Pico)', 'Dom 07'],
            peakText: 'Pico: 67,500 CUP',
            peakCoord: { x: 575, y: 38 },
            areaPath: 'M 10 170 Q 90 148 170 135 T 270 138 T 370 118 T 470 85 T 575 38 T 685 165 L 685 225 L 10 225 Z',
            linePath: 'M 10 170 Q 90 148 170 135 T 270 138 T 370 118 T 470 85 T 575 38 T 685 165',
            movingAvgPath: 'M 10 160 Q 150 140 300 128 T 450 95 T 600 70 T 685 110',
            dots: [{ cx: 90, cy: 148 }, { cx: 170, cy: 135 }, { cx: 270, cy: 138 }, { cx: 370, cy: 118 }, { cx: 470, cy: 85 }, { cx: 685, cy: 165 }],
            varianceText: 'Arranque dinámico de septiembre: +14.0%',
            avgTrans: 'Volumen promedio: 145 tickets/día',
          },
        },
      },
      sem2: {
        label: 'Semana 2',
        dateRange: '08 - 14 Sep',
        config: {
          kpis: {
            total: '348,000.00',
            totalLabel: 'Ventas Semana 2 (Septiembre)',
            diff: '+7.1%',
            diffText: 'vs. semana 1 (+23,000 CUP)',
            avgLabel: 'Promedio Diario',
            avgDaily: '49,714.29',
            avgDailyNote: 'Tasa promedio en 7 días',
            peakTitle: 'Mejor Día',
            peakValue: 'Sábado 14 Sep',
            peakAmount: '72,000.00 CUP',
            peakBadge: 'Pico Sem 2',
            margin: '35.3%',
            netProfit: '122,840 CUP',
          },
          bars: {
            title: 'Ventas Diarias - Semana 2 Septiembre (CUP)',
            subtitle: 'Desglose del 08 al 14 de septiembre',
            badge: 'Semana 2',
            items: [
              { label: 'Lun 08', sublabel: '42,000', value: 42000, formatted: '42k', heightPct: 58 },
              { label: 'Mar 09', sublabel: '46,000', value: 46000, formatted: '46k', heightPct: 64 },
              { label: 'Mié 10', sublabel: '45,000', value: 45000, formatted: '45k', heightPct: 63 },
              { label: 'Jue 11', sublabel: '51,000', value: 51000, formatted: '51k', heightPct: 71 },
              { label: 'Vie 12', sublabel: '60,000', value: 60000, formatted: '60k', heightPct: 83 },
              { label: 'Sáb 13', sublabel: '72,000', value: 72000, formatted: '72k ★', heightPct: 100, isPeak: true },
              { label: 'Dom 14', sublabel: '32,000', value: 32000, formatted: '32k', heightPct: 44 },
            ],
            footerNote: 'Día pico: Sábado (72,000 CUP)',
            footerTotal: '348,000 CUP',
          },
          curve: {
            title: 'Curva de Tendencia - Semana 2 Septiembre',
            subtitle: 'Evolución diaria de recaudación',
            labels: ['Lun 08', 'Mar 09', 'Mié 10', 'Jue 11', 'Vie 12', 'Sáb 13 (Pico)', 'Dom 14'],
            peakText: 'Pico: 72,000 CUP',
            peakCoord: { x: 575, y: 35 },
            areaPath: 'M 10 165 Q 90 145 170 130 T 270 132 T 370 110 T 470 75 T 575 35 T 685 155 L 685 225 L 10 225 Z',
            linePath: 'M 10 165 Q 90 145 170 130 T 270 132 T 370 110 T 470 75 T 575 35 T 685 155',
            movingAvgPath: 'M 10 155 Q 150 135 300 120 T 450 90 T 600 65 T 685 100',
            dots: [{ cx: 90, cy: 145 }, { cx: 170, cy: 130 }, { cx: 270, cy: 132 }, { cx: 370, cy: 110 }, { cx: 470, cy: 75 }, { cx: 685, cy: 155 }],
            varianceText: 'Sostenimiento de alta rotación: ±7%',
            avgTrans: 'Volumen promedio: 152 tickets/día',
          },
        },
      },
      sem3: {
        label: 'Semana 3',
        dateRange: '15 - 21 Sep',
        config: {
          kpis: {
            total: '412,000.00',
            totalLabel: 'Ventas Semana 3 (Septiembre)',
            diff: '+18.4%',
            diffText: 'vs. semana 2 (Pico Absoluto)',
            avgLabel: 'Promedio Diario',
            avgDaily: '58,857.14',
            avgDailyNote: 'Tasa promedio en 7 días',
            peakTitle: 'Mejor Día',
            peakValue: 'Sábado 21 Sep',
            peakAmount: '84,000.00 CUP',
            peakBadge: 'Pico Anual',
            margin: '36.0%',
            netProfit: '148,320 CUP',
          },
          bars: {
            title: 'Ventas Diarias - Semana 3 Septiembre (CUP)',
            subtitle: 'Desglose del 15 al 21 de septiembre',
            badge: 'Semana 3 ★',
            items: [
              { label: 'Lun 15', sublabel: '48,000', value: 48000, formatted: '48k', heightPct: 57 },
              { label: 'Mar 16', sublabel: '54,000', value: 54000, formatted: '54k', heightPct: 64 },
              { label: 'Mié 17', sublabel: '53,000', value: 53000, formatted: '53k', heightPct: 63 },
              { label: 'Jue 18', sublabel: '62,000', value: 62000, formatted: '62k', heightPct: 74 },
              { label: 'Vie 19', sublabel: '73,000', value: 73000, formatted: '73k', heightPct: 87 },
              { label: 'Sáb 20', sublabel: '84,000', value: 84000, formatted: '84k ★', heightPct: 100, isPeak: true },
              { label: 'Dom 21', sublabel: '38,000', value: 38000, formatted: '38k', heightPct: 45 },
            ],
            footerNote: 'Semana de mayor facturación del trimestre: 412,000 CUP',
            footerTotal: '412,000 CUP',
          },
          curve: {
            title: 'Curva de Tendencia - Semana 3 Septiembre',
            subtitle: 'Récord histórico de facturación en el negocio',
            labels: ['Lun 15', 'Mar 16', 'Mié 17', 'Jue 18', 'Vie 19', 'Sáb 20 (Pico)', 'Dom 21'],
            peakText: 'Pico: 84,000 CUP',
            peakCoord: { x: 575, y: 25 },
            areaPath: 'M 10 155 Q 90 135 170 115 T 270 120 T 370 90 T 470 55 T 575 25 T 685 140 L 685 225 L 10 225 Z',
            linePath: 'M 10 155 Q 90 135 170 115 T 270 120 T 370 90 T 470 55 T 575 25 T 685 140',
            movingAvgPath: 'M 10 145 Q 150 125 300 110 T 450 75 T 600 50 T 685 90',
            dots: [{ cx: 90, cy: 135 }, { cx: 170, cy: 115 }, { cx: 270, cy: 120 }, { cx: 370, cy: 90 }, { cx: 470, cy: 55 }, { cx: 685, cy: 140 }],
            varianceText: 'Máxima rentabilidad trimestral: +18.4%',
            avgTrans: 'Volumen promedio: 172 tickets/día',
          },
        },
      },
      sem4: {
        label: 'Semana 4',
        dateRange: '22 - 28 Sep',
        config: {
          kpis: {
            total: '326,700.00',
            totalLabel: 'Ventas Semana 4 (Septiembre)',
            diff: '-20.7%',
            diffText: 'vs. semana 3 (estabilización)',
            avgLabel: 'Promedio Diario',
            avgDaily: '46,671.43',
            avgDailyNote: 'Tasa promedio en 7 días',
            peakTitle: 'Mejor Día',
            peakValue: 'Sábado 28 Sep',
            peakAmount: '68,000.00 CUP',
            peakBadge: 'Pico Sem 4',
            margin: '35.1%',
            netProfit: '114,670 CUP',
          },
          bars: {
            title: 'Ventas Diarias - Semana 4 Septiembre (CUP)',
            subtitle: 'Desglose del 22 al 28 de septiembre',
            badge: 'Semana 4',
            items: [
              { label: 'Lun 22', sublabel: '39,000', value: 39000, formatted: '39k', heightPct: 57 },
              { label: 'Mar 23', sublabel: '44,000', value: 44000, formatted: '44k', heightPct: 65 },
              { label: 'Mié 24', sublabel: '43,000', value: 43000, formatted: '43k', heightPct: 63 },
              { label: 'Jue 25', sublabel: '48,000', value: 48000, formatted: '48k', heightPct: 71 },
              { label: 'Vie 26', sublabel: '56,000', value: 56000, formatted: '56k', heightPct: 82 },
              { label: 'Sáb 27', sublabel: '68,000', value: 68000, formatted: '68k ★', heightPct: 100, isPeak: true },
              { label: 'Dom 28', sublabel: '28,700', value: 28700, formatted: '28.7k', heightPct: 42 },
            ],
            footerNote: 'Día pico: Sábado (68,000 CUP)',
            footerTotal: '326,700 CUP',
          },
          curve: {
            title: 'Curva de Tendencia - Semana 4 Septiembre',
            subtitle: 'Evolución diaria de recaudación',
            labels: ['Lun 22', 'Mar 23', 'Mié 24', 'Jue 25', 'Vie 26', 'Sáb 27 (Pico)', 'Dom 28'],
            peakText: 'Pico: 68,000 CUP',
            peakCoord: { x: 575, y: 42 },
            areaPath: 'M 10 170 Q 90 150 170 135 T 270 140 T 370 120 T 470 95 T 575 42 T 685 170 L 685 225 L 10 225 Z',
            linePath: 'M 10 170 Q 90 150 170 135 T 270 140 T 370 120 T 470 95 T 575 42 T 685 170',
            movingAvgPath: 'M 10 160 Q 150 145 300 130 T 450 100 T 600 75 T 685 115',
            dots: [{ cx: 90, cy: 150 }, { cx: 170, cy: 135 }, { cx: 270, cy: 140 }, { cx: 370, cy: 120 }, { cx: 470, cy: 95 }, { cx: 685, cy: 170 }],
            varianceText: 'Estabilidad de cierre mensual: ±8%',
            avgTrans: 'Volumen promedio: 144 tickets/día',
          },
        },
      },
    },
  },
  agosto: {
    name: 'Agosto 2024',
    shortName: 'Ago',
    mensual: {
      kpis: {
        total: '1,180,000.00',
        totalLabel: 'Ventas Totales de Agosto',
        diff: '+12.1%',
        diffText: 'vs. julio (1,052,000 CUP)',
        avgLabel: 'Promedio Diario',
        avgDaily: '47,200.00',
        avgDailyNote: 'Tasa calculada en 25 días operativos',
        peakTitle: 'Mejor Semana',
        peakValue: 'Semana 3',
        peakAmount: '330,000.00 CUP',
        peakBadge: 'Pico de Agosto',
        margin: '33.8%',
        netProfit: '398,800 CUP',
      },
      bars: {
        title: 'Ventas por Semana - Agosto (CUP)',
        subtitle: 'Desglose de las 4 semanas de agosto',
        badge: '4 semanas',
        items: [
          { label: 'Sem 1', sublabel: '270,000', value: 270000, formatted: '270k', heightPct: 82 },
          { label: 'Sem 2', sublabel: '295,000', value: 295000, formatted: '295k', heightPct: 89 },
          { label: 'Sem 3', sublabel: '330,000', value: 330000, formatted: '330k ★', heightPct: 100, isPeak: true },
          { label: 'Sem 4', sublabel: '285,000', value: 285000, formatted: '285k', heightPct: 86 },
        ],
        footerNote: 'Semana de mayor facturación: Semana 3',
        footerTotal: '1,180,000 CUP',
      },
      curve: {
        title: 'Comportamiento Diario (Agosto)',
        subtitle: 'Consistencia comercial durante el periodo estival',
        labels: ['Día 01', 'Día 05', 'Día 10', 'Día 15', 'Día 18 (Pico)', 'Día 22', 'Día 26', 'Día 31'],
        peakText: 'Pico: 69,000 CUP',
        peakCoord: { x: 410, y: 48 },
        areaPath: 'M 10 185 Q 60 165 110 150 T 210 140 T 310 100 T 410 48 T 510 125 T 610 95 T 690 110 L 690 225 L 10 225 Z',
        linePath: 'M 10 185 Q 60 165 110 150 T 210 140 T 310 100 T 410 48 T 510 125 T 610 95 T 690 110',
        movingAvgPath: 'M 10 170 Q 110 155 210 145 T 410 95 T 610 100 T 690 105',
        dots: [
          { cx: 110, cy: 150 },
          { cx: 210, cy: 140 },
          { cx: 310, cy: 100 },
          { cx: 510, cy: 125 },
          { cx: 610, cy: 95 },
          { cx: 690, cy: 110 },
        ],
        varianceText: 'Comportamiento estival balanceado: ±10%',
        avgTrans: 'Volumen promedio: 135 tickets/día',
      },
    },
    semanas: {
      sem1: {
        label: 'Semana 1',
        dateRange: '01 - 07 Ago',
        config: {
          kpis: {
            total: '270,000.00',
            totalLabel: 'Ventas Semana 1 (Agosto)',
            diff: '+4.2%',
            diffText: 'vs. semana previa',
            avgLabel: 'Promedio Diario',
            avgDaily: '38,571.43',
            avgDailyNote: 'Tasa promedio en 7 días',
            peakTitle: 'Mejor Día',
            peakValue: 'Sábado 03 Ago',
            peakAmount: '55,000.00 CUP',
            peakBadge: 'Pico Sem 1',
            margin: '33.5%',
            netProfit: '90,450 CUP',
          },
          bars: {
            title: 'Ventas Diarias - Semana 1 Agosto (CUP)',
            subtitle: 'Desglose del 01 al 07 de agosto',
            badge: 'Semana 1',
            items: [
              { label: 'Lun 01', sublabel: '32,000', value: 32000, formatted: '32k', heightPct: 58 },
              { label: 'Mar 02', sublabel: '36,000', value: 36000, formatted: '36k', heightPct: 65 },
              { label: 'Mié 03', sublabel: '35,000', value: 35000, formatted: '35k', heightPct: 64 },
              { label: 'Jue 04', sublabel: '39,000', value: 39000, formatted: '39k', heightPct: 71 },
              { label: 'Vie 05', sublabel: '46,000', value: 46000, formatted: '46k', heightPct: 84 },
              { label: 'Sáb 06', sublabel: '55,000', value: 55000, formatted: '55k ★', heightPct: 100, isPeak: true },
              { label: 'Dom 07', sublabel: '27,000', value: 27000, formatted: '27k', heightPct: 49 },
            ],
            footerNote: 'Día pico: Sábado (55,000 CUP)',
            footerTotal: '270,000 CUP',
          },
          curve: {
            title: 'Curva de Tendencia - Semana 1 Agosto',
            subtitle: 'Evolución diaria de recaudación',
            labels: ['Lun 01', 'Mar 02', 'Mié 03', 'Jue 04', 'Vie 05', 'Sáb 06 (Pico)', 'Dom 07'],
            peakText: 'Pico: 55,000 CUP',
            peakCoord: { x: 575, y: 50 },
            areaPath: 'M 10 180 Q 90 160 170 148 T 270 150 T 370 130 T 470 100 T 575 50 T 685 180 L 685 225 L 10 225 Z',
            linePath: 'M 10 180 Q 90 160 170 148 T 270 150 T 370 130 T 470 100 T 575 50 T 685 180',
            movingAvgPath: 'M 10 170 Q 150 155 300 140 T 450 110 T 600 85 T 685 125',
            dots: [{ cx: 90, cy: 160 }, { cx: 170, cy: 148 }, { cx: 270, cy: 150 }, { cx: 370, cy: 130 }, { cx: 470, cy: 100 }, { cx: 685, cy: 180 }],
            varianceText: 'Estabilidad de verano: ±9%',
            avgTrans: 'Volumen promedio: 130 tickets/día',
          },
        },
      },
      sem2: {
        label: 'Semana 2',
        dateRange: '08 - 14 Ago',
        config: {
          kpis: {
            total: '295,000.00',
            totalLabel: 'Ventas Semana 2 (Agosto)',
            diff: '+9.3%',
            diffText: 'vs. semana 1 (+25,000 CUP)',
            avgLabel: 'Promedio Diario',
            avgDaily: '42,142.86',
            avgDailyNote: 'Tasa promedio en 7 días',
            peakTitle: 'Mejor Día',
            peakValue: 'Sábado 10 Ago',
            peakAmount: '61,000.00 CUP',
            peakBadge: 'Pico Sem 2',
            margin: '33.9%',
            netProfit: '100,005 CUP',
          },
          bars: {
            title: 'Ventas Diarias - Semana 2 Agosto (CUP)',
            subtitle: 'Desglose del 08 al 14 de agosto',
            badge: 'Semana 2',
            items: [
              { label: 'Lun 08', sublabel: '35,000', value: 35000, formatted: '35k', heightPct: 57 },
              { label: 'Mar 09', sublabel: '39,000', value: 39000, formatted: '39k', heightPct: 64 },
              { label: 'Mié 10', sublabel: '38,000', value: 38000, formatted: '38k', heightPct: 62 },
              { label: 'Jue 11', sublabel: '43,000', value: 43000, formatted: '43k', heightPct: 70 },
              { label: 'Vie 12', sublabel: '50,000', value: 50000, formatted: '50k', heightPct: 82 },
              { label: 'Sáb 13', sublabel: '61,000', value: 61000, formatted: '61k ★', heightPct: 100, isPeak: true },
              { label: 'Dom 14', sublabel: '29,000', value: 29000, formatted: '29k', heightPct: 48 },
            ],
            footerNote: 'Día pico: Sábado (61,000 CUP)',
            footerTotal: '295,000 CUP',
          },
          curve: {
            title: 'Curva de Tendencia - Semana 2 Agosto',
            subtitle: 'Evolución diaria de recaudación',
            labels: ['Lun 08', 'Mar 09', 'Mié 10', 'Jue 11', 'Vie 12', 'Sáb 13 (Pico)', 'Dom 14'],
            peakText: 'Pico: 61,000 CUP',
            peakCoord: { x: 575, y: 44 },
            areaPath: 'M 10 175 Q 90 155 170 140 T 270 142 T 370 120 T 470 90 T 575 44 T 685 170 L 685 225 L 10 225 Z',
            linePath: 'M 10 175 Q 90 155 170 140 T 270 142 T 370 120 T 470 90 T 575 44 T 685 170',
            movingAvgPath: 'M 10 165 Q 150 145 300 132 T 450 100 T 600 78 T 685 115',
            dots: [{ cx: 90, cy: 155 }, { cx: 170, cy: 140 }, { cx: 270, cy: 142 }, { cx: 370, cy: 120 }, { cx: 470, cy: 90 }, { cx: 685, cy: 170 }],
            varianceText: 'Comportamiento en alza: +9.3%',
            avgTrans: 'Volumen promedio: 134 tickets/día',
          },
        },
      },
      sem3: {
        label: 'Semana 3',
        dateRange: '15 - 21 Ago',
        config: {
          kpis: {
            total: '330,000.00',
            totalLabel: 'Ventas Semana 3 (Agosto)',
            diff: '+11.9%',
            diffText: 'vs. semana 2 (Pico de Agosto)',
            avgLabel: 'Promedio Diario',
            avgDaily: '47,142.86',
            avgDailyNote: 'Tasa promedio en 7 días',
            peakTitle: 'Mejor Día',
            peakValue: 'Sábado 17 Ago',
            peakAmount: '69,000.00 CUP',
            peakBadge: 'Pico Sem 3',
            margin: '34.2%',
            netProfit: '112,860 CUP',
          },
          bars: {
            title: 'Ventas Diarias - Semana 3 Agosto (CUP)',
            subtitle: 'Desglose del 15 al 21 de agosto (Semana récord de agosto)',
            badge: 'Semana 3 ★',
            items: [
              { label: 'Lun 15', sublabel: '39,000', value: 39000, formatted: '39k', heightPct: 57 },
              { label: 'Mar 16', sublabel: '44,000', value: 44000, formatted: '44k', heightPct: 64 },
              { label: 'Mié 17', sublabel: '43,000', value: 43000, formatted: '43k', heightPct: 62 },
              { label: 'Jue 18', sublabel: '48,000', value: 48000, formatted: '48k', heightPct: 70 },
              { label: 'Vie 19', sublabel: '57,000', value: 57000, formatted: '57k', heightPct: 83 },
              { label: 'Sáb 20', sublabel: '69,000', value: 69000, formatted: '69k ★', heightPct: 100, isPeak: true },
              { label: 'Dom 21', sublabel: '30,000', value: 30000, formatted: '30k', heightPct: 43 },
            ],
            footerNote: 'Semana de mayor facturación en agosto: 330,000 CUP',
            footerTotal: '330,000 CUP',
          },
          curve: {
            title: 'Curva de Tendencia - Semana 3 Agosto',
            subtitle: 'Semana pico del mes de agosto',
            labels: ['Lun 15', 'Mar 16', 'Mié 17', 'Jue 18', 'Vie 19', 'Sáb 20 (Pico)', 'Dom 21'],
            peakText: 'Pico: 69,000 CUP',
            peakCoord: { x: 575, y: 35 },
            areaPath: 'M 10 165 Q 90 145 170 128 T 270 132 T 370 110 T 470 75 T 575 35 T 685 160 L 685 225 L 10 225 Z',
            linePath: 'M 10 165 Q 90 145 170 128 T 270 132 T 370 110 T 470 75 T 575 35 T 685 160',
            movingAvgPath: 'M 10 155 Q 150 135 300 120 T 450 90 T 600 65 T 685 105',
            dots: [{ cx: 90, cy: 145 }, { cx: 170, cy: 128 }, { cx: 270, cy: 132 }, { cx: 370, cy: 110 }, { cx: 470, cy: 75 }, { cx: 685, cy: 160 }],
            varianceText: 'Récord de mitad de mes: +11.9%',
            avgTrans: 'Volumen promedio: 141 tickets/día',
          },
        },
      },
      sem4: {
        label: 'Semana 4',
        dateRange: '22 - 28 Ago',
        config: {
          kpis: {
            total: '285,000.00',
            totalLabel: 'Ventas Semana 4 (Agosto)',
            diff: '-13.6%',
            diffText: 'vs. semana 3',
            avgLabel: 'Promedio Diario',
            avgDaily: '40,714.29',
            avgDailyNote: 'Tasa promedio en 7 días',
            peakTitle: 'Mejor Día',
            peakValue: 'Sábado 24 Ago',
            peakAmount: '58,000.00 CUP',
            peakBadge: 'Pico Sem 4',
            margin: '33.6%',
            netProfit: '95,760 CUP',
          },
          bars: {
            title: 'Ventas Diarias - Semana 4 Agosto (CUP)',
            subtitle: 'Desglose del 22 al 28 de agosto',
            badge: 'Semana 4',
            items: [
              { label: 'Lun 22', sublabel: '34,000', value: 34000, formatted: '34k', heightPct: 59 },
              { label: 'Mar 23', sublabel: '38,000', value: 38000, formatted: '38k', heightPct: 66 },
              { label: 'Mié 24', sublabel: '37,000', value: 37000, formatted: '37k', heightPct: 64 },
              { label: 'Jue 25', sublabel: '41,000', value: 41000, formatted: '41k', heightPct: 71 },
              { label: 'Vie 26', sublabel: '49,000', value: 49000, formatted: '49k', heightPct: 84 },
              { label: 'Sáb 27', sublabel: '58,000', value: 58000, formatted: '58k ★', heightPct: 100, isPeak: true },
              { label: 'Dom 28', sublabel: '28,000', value: 28000, formatted: '28k', heightPct: 48 },
            ],
            footerNote: 'Día pico: Sábado (58,000 CUP)',
            footerTotal: '285,000 CUP',
          },
          curve: {
            title: 'Curva de Tendencia - Semana 4 Agosto',
            subtitle: 'Evolución diaria de recaudación',
            labels: ['Lun 22', 'Mar 23', 'Mié 24', 'Jue 25', 'Vie 26', 'Sáb 27 (Pico)', 'Dom 28'],
            peakText: 'Pico: 58,000 CUP',
            peakCoord: { x: 575, y: 48 },
            areaPath: 'M 10 178 Q 90 158 170 144 T 270 146 T 370 126 T 470 94 T 575 48 T 685 174 L 685 225 L 10 225 Z',
            linePath: 'M 10 178 Q 90 158 170 144 T 270 146 T 370 126 T 470 94 T 575 48 T 685 174',
            movingAvgPath: 'M 10 168 Q 150 150 300 136 T 450 106 T 600 80 T 685 120',
            dots: [{ cx: 90, cy: 158 }, { cx: 170, cy: 144 }, { cx: 270, cy: 146 }, { cx: 370, cy: 126 }, { cx: 470, cy: 94 }, { cx: 685, cy: 174 }],
            varianceText: 'Cierre de ciclo estival ordenado: ±10%',
            avgTrans: 'Volumen promedio: 133 tickets/día',
          },
        },
      },
    },
  },
};

const TRIMESTRAL_CONFIG: PeriodConfig = {
  kpis: {
    total: '3,840,200.00',
    totalLabel: 'Ventas del Trimestre (Ago - Oct 2024)',
    diff: '+14.3%',
    diffText: 'vs. trimestre anterior (3,359,000 CUP)',
    avgLabel: 'Promedio Mensual',
    avgDaily: '1,280,066.67',
    avgDailyNote: 'Tasa promedio en los 3 meses evaluados',
    peakTitle: 'Mejor Mes',
    peakValue: 'Septiembre 2024',
    peakAmount: '1,411,700.00 CUP',
    peakBadge: 'Pico Trimestral',
    margin: '34.8%',
    netProfit: '1,336,400 CUP',
  },
  bars: {
    title: 'Ventas por Mes del Trimestre (CUP)',
    subtitle: 'Historial comparativo de los últimos 3 meses cerrados',
    badge: '3 meses',
    items: [
      { label: 'Agosto', sublabel: '1,180,000', value: 1180000, formatted: '1.18M', heightPct: 83 },
      { label: 'Septiembre', sublabel: '1,411,700', value: 1411700, formatted: '1.41M ★', heightPct: 100, isPeak: true },
      { label: 'Octubre', sublabel: '1,248,500', value: 1248500, formatted: '1.25M', heightPct: 88 },
    ],
    footerNote: 'Mes pico del trimestre: Septiembre 2024 (1,411,700 CUP)',
    footerTotal: '3,840,200 CUP',
  },
  curve: {
    title: 'Evolución Quincenal del Trimestre',
    subtitle: 'Trayectoria agregada de recaudación por quincenas',
    labels: ['Q1 Ago', 'Q2 Ago', 'Q1 Sep', 'Q2 Sep (Pico)', 'Q1 Oct', 'Q2 Oct'],
    peakText: 'Pico: 720,500 CUP',
    peakCoord: { x: 440, y: 35 },
    areaPath: 'M 10 160 Q 80 140 160 130 T 300 110 T 440 35 T 580 85 T 690 95 L 690 225 L 10 225 Z',
    linePath: 'M 10 160 Q 80 140 160 130 T 300 110 T 440 35 T 580 85 T 690 95',
    movingAvgPath: 'M 10 150 Q 150 135 300 115 T 450 70 T 600 80 T 690 90',
    dots: [
      { cx: 80, cy: 140 },
      { cx: 160, cy: 130 },
      { cx: 300, cy: 110 },
      { cx: 580, cy: 85 },
      { cx: 690, cy: 95 },
    ],
    varianceText: 'Crecimiento sostenido intertrimestral: +14.3%',
    avgTrans: 'Volumen promedio: 148 tickets/día',
  },
};

const MONTH_KEYS: MonthKey[] = ['octubre', 'septiembre', 'agosto'];

export const ReportsView: React.FC = () => {
  const { showToast } = useApp();

  const [periodTab, setPeriodTab] = useState<'semanal' | 'mensual' | 'trimestral'>('semanal');
  const [selectedMonth, setSelectedMonth] = useState<MonthKey>('octubre');
  const [selectedWeek, setSelectedWeek] = useState<WeekKey>('sem1');
  const [isMonthDropdownOpen, setIsMonthDropdownOpen] = useState(false);
  const [isWeekDropdownOpen, setIsWeekDropdownOpen] = useState(false);

  const [filterSort, setFilterSort] = useState<'recaudacion' | 'volumen'>('recaudacion');
  const [page, setPage] = useState(1);

  // Active month data
  const currentMonthData = HISTORIAL_DATA[selectedMonth];

  // Active config based on periodTab
  const currentData: PeriodConfig =
    periodTab === 'trimestral'
      ? TRIMESTRAL_CONFIG
      : periodTab === 'mensual'
      ? currentMonthData.mensual
      : currentMonthData.semanas[selectedWeek].config;

  const sortedProducts = [...TOP_PRODUCTS].sort((a, b) => {
    if (filterSort === 'volumen') {
      return b.soldUnits - a.soldUnits;
    }
    return b.totalIncome - a.totalIncome;
  });

  const pageSize = 5;
  const totalPages = Math.max(1, Math.ceil(sortedProducts.length / pageSize));
  const validPage = Math.min(page, totalPages);
  const paginatedReports = sortedProducts.slice((validPage - 1) * pageSize, validPage * pageSize);
  const startIdx = sortedProducts.length === 0 ? 0 : (validPage - 1) * pageSize + 1;
  const endIdx = Math.min(validPage * pageSize, sortedProducts.length);

  const handleExport = () => {
    const filename =
      periodTab === 'trimestral'
        ? 'Reporte_Ventas_Trimestre_Q3_Q4_2024.xlsx'
        : periodTab === 'mensual'
        ? `Reporte_Ventas_${currentMonthData.name.replace(' ', '_')}.xlsx`
        : `Reporte_Ventas_${currentMonthData.name.replace(' ', '_')}_${selectedWeek.toUpperCase()}.xlsx`;

    showToast('Exportación a Excel', `Generando y descargando "${filename}"...`);
  };

  const handlePeriodTabChange = (tab: 'semanal' | 'mensual' | 'trimestral') => {
    setPeriodTab(tab);
    setIsMonthDropdownOpen(false);
    setIsWeekDropdownOpen(false);
    const label = tab === 'semanal' ? 'Semanal' : tab === 'mensual' ? 'Mensual' : 'Trimestral';
    showToast('Vista Actualizada', `Mostrando datos de periodo ${label}.`);
  };

  const getTableTitle = () => {
    if (periodTab === 'trimestral') {
      return 'Top 10 Productos Más Vendidos del Trimestre';
    }
    if (periodTab === 'mensual') {
      return `Top 10 Productos Más Vendidos de ${currentMonthData.name}`;
    }
    return `Top 10 Productos Más Vendidos (${currentMonthData.semanas[selectedWeek].label} de ${currentMonthData.name})`;
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
            Rendimiento comercial con historial de hasta 3 meses atrás, desglose por semanas (1, 2, 3 y 4) y consolidado trimestral en CUP.
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
              <span>Trimestre: Agosto - Octubre 2024 (3 meses)</span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              {/* Month Dropdown (Historial de 3 meses) */}
              <div className="relative inline-block text-left">
                <button
                  onClick={() => {
                    setIsMonthDropdownOpen(!isMonthDropdownOpen);
                    setIsWeekDropdownOpen(false);
                  }}
                  className="h-11 px-4 rounded-xl bg-surface neo-raised flex items-center gap-2 text-xs font-semibold text-on-surface hover:text-primary transition-all active:neo-inset cursor-pointer"
                  type="button"
                  title="Seleccionar mes del historial"
                >
                  <span className="material-symbols-outlined text-[18px] text-primary">calendar_month</span>
                  <span>{currentMonthData.name}</span>
                  <span className="material-symbols-outlined text-[16px] text-on-surface-variant">expand_more</span>
                </button>

                {isMonthDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-56 rounded-xl bg-surface neo-raised shadow-xl z-30 p-2 flex flex-col gap-1">
                    <span className="px-2.5 py-1 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">
                      Historial de 3 Meses
                    </span>
                    {MONTH_KEYS.map((mKey) => {
                      const m = HISTORIAL_DATA[mKey];
                      return (
                        <button
                          key={mKey}
                          onClick={() => {
                            setSelectedMonth(mKey);
                            setIsMonthDropdownOpen(false);
                            showToast(
                              'Mes Seleccionado',
                              `Visualizando datos para ${m.name} (${
                                periodTab === 'semanal'
                                  ? `${m.semanas[selectedWeek].label}`
                                  : 'Mes completo'
                              })`
                            );
                          }}
                          className={`w-full text-left px-3 py-2 text-xs font-semibold rounded-lg transition-colors flex items-center justify-between cursor-pointer ${
                            selectedMonth === mKey
                              ? 'bg-primary/10 text-primary font-bold'
                              : 'text-on-surface hover:bg-surface-container-high'
                          }`}
                          type="button"
                        >
                          <span>{m.name}</span>
                          {mKey === 'octubre' && (
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

              {/* Week Dropdown (Shows Semanas 1, 2, 3, 4 for the selected month) */}
              {periodTab === 'semanal' && (
                <div className="relative inline-block text-left">
                  <button
                    onClick={() => {
                      setIsWeekDropdownOpen(!isWeekDropdownOpen);
                      setIsMonthDropdownOpen(false);
                    }}
                    className="h-11 px-4 rounded-xl bg-surface neo-raised flex items-center gap-2 text-xs font-semibold text-primary transition-all active:neo-inset cursor-pointer"
                    type="button"
                    title={`Seleccionar semana de ${currentMonthData.name}`}
                  >
                    <span className="material-symbols-outlined text-[18px]">date_range</span>
                    <span>
                      {currentMonthData.semanas[selectedWeek].label} (
                      {currentMonthData.semanas[selectedWeek].dateRange})
                    </span>
                    <span className="material-symbols-outlined text-[16px] text-primary">expand_more</span>
                  </button>

                  {isWeekDropdownOpen && (
                    <div className="absolute right-0 mt-2 w-64 rounded-xl bg-surface neo-raised shadow-xl z-30 p-2 flex flex-col gap-1">
                      <div className="px-2.5 py-1 flex items-center justify-between">
                        <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">
                          Semanas de {currentMonthData.name}
                        </span>
                        <span className="text-[10px] text-primary font-mono font-bold">4 semanas</span>
                      </div>
                      {(['sem1', 'sem2', 'sem3', 'sem4'] as WeekKey[]).map((wKey) => {
                        const w = currentMonthData.semanas[wKey];
                        return (
                          <button
                            key={wKey}
                            onClick={() => {
                              setSelectedWeek(wKey);
                              setIsWeekDropdownOpen(false);
                              showToast(
                                'Semana Seleccionada',
                                `${w.label} (${w.dateRange}) de ${currentMonthData.name}`
                              );
                            }}
                            className={`w-full text-left px-3 py-2 text-xs font-semibold rounded-lg transition-colors flex items-center justify-between cursor-pointer ${
                              selectedWeek === wKey
                                ? 'bg-primary/10 text-primary font-bold'
                                : 'text-on-surface hover:bg-surface-container-high'
                            }`}
                            type="button"
                          >
                            <span className="flex items-center gap-1.5">
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  selectedWeek === wKey ? 'bg-primary' : 'bg-outline-variant'
                                }`}
                              ></span>
                              {w.label}
                            </span>
                            <span className="text-[10px] text-on-surface-variant font-mono">
                              {w.dateRange}
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
            className="h-11 px-4 rounded-xl bg-surface neo-raised flex items-center gap-2 text-xs font-semibold text-emerald-600 hover:text-emerald-700 active:neo-inset transition-all group cursor-pointer"
            type="button"
          >
            <span className="material-symbols-outlined text-[19px] transition-transform group-hover:-translate-y-0.5">
              table_view
            </span>
            <span>Exportar [.xlsx]</span>
          </button>
        </div>
      </div>

      {/* 4 Bento Metric Cards dynamically driven by period & timeframe */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        {/* Card 1: Total Ventas del Periodo */}
        <div className="p-5 rounded-2xl bg-surface neo-raised flex flex-col justify-between relative overflow-hidden group">
          <div className="flex items-start justify-between">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold tracking-wide text-on-surface-variant uppercase">
                {currentData.kpis.totalLabel}
              </span>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className="text-2xl font-headline font-bold text-on-surface tracking-tight font-mono">
                  {currentData.kpis.total}
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
                currentData.kpis.diff.startsWith('+')
                  ? 'text-emerald-600 bg-emerald-500/10'
                  : 'text-amber-700 bg-amber-500/10'
              }`}
            >
              <span className="material-symbols-outlined text-[15px]">
                {currentData.kpis.diff.startsWith('+') ? 'trending_up' : 'trending_down'}
              </span>
              {currentData.kpis.diff}
            </span>
            <span className="text-[11px] text-on-surface-variant font-medium truncate">
              {currentData.kpis.diffText}
            </span>
          </div>
        </div>

        {/* Card 2: Promedio */}
        <div className="p-5 rounded-2xl bg-surface neo-raised flex flex-col justify-between group">
          <div className="flex items-start justify-between">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold tracking-wide text-on-surface-variant uppercase">
                {currentData.kpis.avgLabel}
              </span>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className="text-2xl font-headline font-bold text-on-surface tracking-tight font-mono">
                  {currentData.kpis.avgDaily}
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
              {currentData.kpis.avgDailyNote}
            </span>
            <span className="w-2 h-2 rounded-full bg-primary/70"></span>
          </div>
        </div>

        {/* Card 3: Pico / Mejor Periodo */}
        <div className="p-5 rounded-2xl bg-surface neo-raised flex flex-col justify-between group">
          <div className="flex items-start justify-between">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold tracking-wide text-on-surface-variant uppercase">
                {currentData.kpis.peakTitle}
              </span>
              <span className="text-xl font-headline font-bold text-on-surface tracking-tight mt-0.5 truncate">
                {currentData.kpis.peakValue}
              </span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-surface neo-inset flex items-center justify-center text-indigo-500">
              <span className="material-symbols-outlined text-[22px]">workspace_premium</span>
            </div>
          </div>
          <div className="flex items-center justify-between mt-4 pt-3 border-t border-outline-variant/15">
            <span className="text-xs font-semibold text-on-surface font-mono">{currentData.kpis.peakAmount}</span>
            <span className="text-[11px] font-medium text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-full">
              {currentData.kpis.peakBadge}
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
                {currentData.kpis.margin}
              </span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-surface neo-inset flex items-center justify-center text-primary">
              <span className="material-symbols-outlined text-[22px]">pie_chart</span>
            </div>
          </div>
          <div className="flex flex-col gap-1 mt-4 pt-3 border-t border-outline-variant/15">
            <div className="w-full h-1.5 rounded-full bg-surface neo-inset overflow-hidden">
              <div className="h-full rounded-full bg-primary" style={{ width: currentData.kpis.margin }}></div>
            </div>
            <div className="flex justify-between items-center text-[11px] text-on-surface-variant mt-1">
              <span>Rentabilidad neta</span>
              <span className="font-semibold text-on-surface font-mono">{currentData.kpis.netProfit}</span>
            </div>
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
                {currentData.bars.title}
              </h2>
              <span className="text-xs text-on-surface-variant">
                {currentData.bars.subtitle}
              </span>
            </div>
            <span className="text-[11px] font-semibold px-2 py-1 rounded bg-surface neo-inset text-primary font-mono">
              {currentData.bars.badge}
            </span>
          </div>

          <div className="h-64 w-full flex items-end justify-between gap-3 pt-8 pb-3 px-2">
            {currentData.bars.items.map((bar, idx) => (
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
                        : 'bg-primary/70 group-hover:bg-primary'
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
              <span className="w-2.5 h-2.5 rounded-full bg-primary"></span>
              {currentData.bars.footerNote}
            </span>
            <span className="font-medium text-on-surface font-mono">
              Total: {currentData.bars.footerTotal}
            </span>
          </div>
        </div>

        {/* Right Column: Line and Area Curve Chart */}
        <div className="lg:col-span-7 p-6 rounded-2xl bg-surface neo-raised flex flex-col justify-between">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <div className="flex flex-col">
              <h2 className="text-base font-headline font-bold text-on-surface">
                {currentData.curve.title}
              </h2>
              <span className="text-xs text-on-surface-variant">
                {currentData.curve.subtitle}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 text-xs text-on-surface-variant">
                <span className="w-2.5 h-2.5 rounded-full bg-primary"></span>
                <span>Ventas Periodo</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-on-surface-variant">
                <span className="w-2.5 h-2.5 rounded-full bg-tertiary"></span>
                <span>Media móvil</span>
              </div>
            </div>
          </div>

          {/* SVG Line and Area Chart */}
          <div className="relative w-full h-64 mt-2">
            <svg className="w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 700 240">
              <defs>
                <linearGradient id="areaGradient" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#6366f1" stopOpacity="0.28" />
                  <stop offset="100%" stopColor="#6366f1" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Grid Lines */}
              <line x1="0" y1="50" x2="700" y2="50" stroke="#d0d2dc" strokeDasharray="4 4" strokeWidth="1" />
              <line x1="0" y1="110" x2="700" y2="110" stroke="#d0d2dc" strokeDasharray="4 4" strokeWidth="1" />
              <line x1="0" y1="170" x2="700" y2="170" stroke="#d0d2dc" strokeDasharray="4 4" strokeWidth="1" />
              <line x1="0" y1="225" x2="700" y2="225" stroke="#8a8c9a" strokeWidth="1" opacity="0.3" />

              {/* Shaded Area */}
              <path
                d={currentData.curve.areaPath}
                fill="url(#areaGradient)"
                className="transition-all duration-500"
              />

              {/* Primary Line */}
              <path
                d={currentData.curve.linePath}
                fill="none"
                stroke="#6366f1"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="transition-all duration-500"
              />

              {/* Moving Average Line */}
              <path
                d={currentData.curve.movingAvgPath}
                fill="none"
                stroke="#7c3aed"
                strokeDasharray="5 5"
                strokeWidth="2"
                opacity="0.8"
                className="transition-all duration-500"
              />

              {/* Regular Point Dots */}
              {currentData.curve.dots.map((dot, idx) => (
                <circle
                  key={idx}
                  cx={dot.cx}
                  cy={dot.cy}
                  r="4.5"
                  fill="#e8eaf0"
                  stroke="#6366f1"
                  strokeWidth="3"
                />
              ))}

              {/* Peak Tooltip & Highlight */}
              <g>
                <circle
                  cx={currentData.curve.peakCoord.x}
                  cy={currentData.curve.peakCoord.y}
                  r="6"
                  fill="#6366f1"
                  stroke="#ffffff"
                  strokeWidth="2"
                />
                <rect
                  x={Math.max(10, currentData.curve.peakCoord.x - 55)}
                  y={Math.max(4, currentData.curve.peakCoord.y - 30)}
                  width="110"
                  height="24"
                  rx="6"
                  fill="#2e3040"
                />
                <text
                  x={Math.max(65, currentData.curve.peakCoord.x)}
                  y={Math.max(20, currentData.curve.peakCoord.y - 14)}
                  fill="#ffffff"
                  fontSize="10"
                  fontWeight="600"
                  textAnchor="middle"
                >
                  {currentData.curve.peakText}
                </text>
              </g>
            </svg>

            {/* X-Axis Labels */}
            <div className="flex justify-between items-center text-[10px] text-on-surface-variant font-medium pt-2 px-1">
              {currentData.curve.labels.map((lbl, idx) => (
                <span
                  key={idx}
                  className={lbl.includes('Pico') ? 'text-primary font-bold' : ''}
                >
                  {lbl}
                </span>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-on-surface-variant pt-3 border-t border-outline-variant/15">
            <span className="flex items-center gap-1">
              <span className="material-symbols-outlined text-[16px] text-emerald-500">check_circle</span>
              {currentData.curve.varianceText}
            </span>
            <span className="font-medium text-on-surface">
              {currentData.curve.avgTrans}
            </span>
          </div>
        </div>
      </div>

      {/* Top 10 Best Sellers Table */}
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
                Líderes de volumen comercial, facturación agregada e impacto relativo
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
                    % Ventas Tienda
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y-0 text-on-surface">
                {paginatedReports.map((p) => (
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
                            style={{ width: `${p.percentage * 10}%` }}
                          ></div>
                        </div>
                        <span className="text-xs font-bold text-on-surface w-10 text-right font-mono">
                          {p.percentage}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
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
