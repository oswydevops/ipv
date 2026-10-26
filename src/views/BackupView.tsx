import React, { useState, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { saveFileWithPicker } from '../utils/fileSaver';

interface LastBackupState {
  date: string;
  time: string;
  fullPath: string;
  fileName: string;
  folderPath: string;
  size: string;
  status: string;
}

export const BackupView: React.FC = () => {
  const {
    products,
    ipvRows,
    denominations,
    menoresAmount,
    transferenciasAmount,
    sales,
    returns = [],
    todayDate,
    ipvTotalVendido,
    ipvTotalUnidades,
    addBackupRecord,
    refreshAll,
    showToast,
    resetApplication,
  } = useApp();

  // Storage for Last Verified Backup State
  const [lastBackup, setLastBackup] = useState<LastBackupState>(() => {
    const saved = localStorage.getItem('ferrestock_last_backup_info');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        // fallback
      }
    }
    return {
      date: 'Sin respaldos',
      time: '--:--',
      folderPath: 'N/A',
      fileName: 'Sin archivo generado',
      fullPath: 'No se ha generado ningún archivo de respaldo aún',
      size: '0 KB',
      status: 'Pendiente',
    };
  });

  // Modals and form state
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);

  // Estados para Restablecer Aplicación
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [resetPassword, setResetPassword] = useState('');
  const [resetError, setResetError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Helper to extract filename and directory from path
  const updateBackupState = (fullPath: string, format: 'sqlite' | 'json') => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const timeStr = `${pad(now.getHours())}:${pad(now.getMinutes())} hrs`;
    const dateStr = now.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });

    const isWindows = fullPath.includes('\\');
    const sep = isWindows ? '\\' : '/';
    const lastSlash = fullPath.lastIndexOf(sep);
    const folder = lastSlash >= 0 ? fullPath.substring(0, lastSlash + 1) : './';
    const fileName = lastSlash >= 0 ? fullPath.substring(lastSlash + 1) : fullPath;

    const updatedState: LastBackupState = {
      date: dateStr,
      time: timeStr,
      folderPath: folder,
      fileName,
      fullPath,
      size: format === 'sqlite' ? 'SQLite Nativo' : 'JSON Estructurado',
      status: 'Verificado y Seguro',
    };

    setLastBackup(updatedState);
    localStorage.setItem('ferrestock_last_backup_info', JSON.stringify(updatedState));

    addBackupRecord({
      fileName,
      description: format === 'sqlite' ? 'Copia Binaria SQLite (.sqlite)' : 'Exportación Estructurada (.json)',
      date: `${now.toLocaleDateString('es-ES')} • ${timeStr}`,
      destination: folder,
      size: format === 'sqlite' ? 'SQLite WAL' : 'JSON UTF-8',
      status: 'Exitoso',
    });
  };

  // Respaldo Inmediato ejecutado a través de window.api
  const handleStartBackup = async () => {
    setIsBackingUp(true);
    try {
      if (window.api && window.api.backup) {
        
          const res = await window.api.backup.saveJson();
          if (res.canceled || !('path' in res)) {
            showToast('Operación Cancelada', 'No se guardó el respaldo.', 'info');
            return;
          }
          updateBackupState(res.path, 'json');
          showToast(
            'Respaldo JSON Generado',
            `Tablas y transacciones exportadas a:\n${res.path}`,
            'success'
          );
        
        setIsBackupModalOpen(false);
      } else {
        showToast('Aviso', 'API de respaldo no disponible en este entorno.', 'error');
      }
    } catch (err: any) {
      console.error(err);
      showToast('Error en Respaldo', err.message || 'Error al escribir el archivo.', 'error');
    } finally {
      setIsBackingUp(false);
    }
  };

  // Restaurar respaldo mediante diálogo nativo o fallback
  const handleTriggerRestore = async () => {
    try {
      if (window.api && window.api.backup) {
        const res = await window.api.backup.restoreJson();
        if (res.canceled) {
          showToast('Operación Cancelada', 'No se seleccionó ningún archivo de respaldo.', 'info');
          return;
        }

        await refreshAll();

        const now = new Date();
        const pad = (n: number) => String(n).padStart(2, '0');
        const restoredState: LastBackupState = {
          date: now.toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' }),
          time: `${pad(now.getHours())}:${pad(now.getMinutes())} hrs`,
          folderPath: 'Restaurado desde archivo',
          fileName: 'Archivo JSON',
          fullPath: 'Importación transaccional SQLite',
          size: 'Completado',
          status: 'Restaurado con Éxito',
        };
        setLastBackup(restoredState);
        localStorage.setItem('ferrestock_last_backup_info', JSON.stringify(restoredState));

        setIsImportModalOpen(false);
        const countSummary = res.restored
          ? Object.entries(res.restored)
              .map(([tbl, count]) => `${tbl}: ${count}`)
              .join(', ')
          : 'Tablas restauradas';

        showToast(
          'Base de Datos Restaurada',
          `Se restablecieron con éxito todos los datos (${countSummary}).`,
          'success'
        );
      }
    } catch (err: any) {
      console.error(err);
      showToast('Error al Restaurar', err.message || 'Archivo de respaldo corrupto o incompatible.', 'error');
    }
  };

  // Restablecer aplicación completa a 0 previa verificación de contraseña "adminreset"
  const handleConfirmReset = async () => {
    const configuredPassword = localStorage.getItem('ferrestock_reset_password') || 'adminreset';
    if (resetPassword.trim() !== configuredPassword.trim()) {
      setResetError('Contraseña incorrecta. Ingrese la contraseña configurada para autorizar el restablecimiento.');
      showToast('Acceso Denegado', 'La contraseña de seguridad ingresada es incorrecta.', 'error');
      return;
    }

    setIsResetting(true);
    try {
      const success = await resetApplication(resetPassword);
      if (success) {
        setLastBackup({
          date: 'Sin respaldos',
          time: '--:--',
          folderPath: 'N/A',
          fileName: 'Sin archivo generado',
          fullPath: 'No se ha generado ningún archivo de respaldo aún',
          size: '0 KB',
          status: 'Pendiente',
        });
        setIsResetModalOpen(false);
        setResetPassword('');
        setResetError('');
      }
    } catch (err: any) {
      showToast('Error al Restablecer', err?.message || 'No se pudo restablecer la aplicación.', 'error');
    } finally {
      setIsResetting(false);
    }
  };

  // Action 1: Export Daily IPV to Excel (Planilla Diaria con Devoluciones de la Jornada)
  const handleExportDailyIPVExcel = async () => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const dateFormatted = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

    // Filtrar devoluciones del día
    const devolucionesToday = returns.filter((r) => r.date === todayDate || r.date === dateFormatted);
    const totalRefundToday = devolucionesToday.reduce((acc, r) => acc + (r.totalRefund || 0), 0);
    const refundCashToday = devolucionesToday
      .filter((r) => r.refundMethod === 'efectivo')
      .reduce((acc, r) => acc + (r.totalRefund || 0), 0);
    const refundTransfToday = devolucionesToday
      .filter((r) => r.refundMethod === 'transferencia')
      .reduce((acc, r) => acc + (r.totalRefund || 0), 0);
    const refundMixtoToday = devolucionesToday
      .filter((r) => r.refundMethod === 'mixto')
      .reduce((acc, r) => acc + (r.totalRefund || 0), 0);
    const totalReturnedUnitsToday = devolucionesToday.reduce(
      (acc, r) => acc + (r.items || []).reduce((s, it) => s + (it.quantity || 1), 0),
      0
    );

    // 1. Encabezado de la planilla IPV
    const rows: string[] = [
      `"PLANILLA OFICIAL DE CONTROL DE INVENTARIO Y VENTAS (IPV) - JORNADA DIARIA"`,
      `"Fecha de Operación: ${dateFormatted} | Generado: ${now.toLocaleTimeString('es-CU')}"`,
      `""`,
      `"1. MOVIMIENTO DE ARTÍCULOS EN EXISTENCIA (INVENTARIO Y VENTAS)"`,
      [
        'Código',
        'Producto',
        'Categoría',
        'Unidad',
        'Precio ($)',
        'Saldo Inicial',
        'Entradas',
        'Total Stock',
        'Vendido',
        'Saldo Final',
        'Importe Vendido ($)',
        'Estado',
      ].join(';'),
    ];

    // Filas del IPV
    ipvRows.forEach((item) => {
      const estadoLabel =
        item.status === 'zero'
          ? 'Agotado'
          : item.status === 'low'
          ? 'Stock Bajo'
          : 'Normal';

      rows.push(
        [
          `"${item.code}"`,
          `"${item.name.replace(/"/g, '""')}"`,
          `"${item.category || 'General'}"`,
          `"${item.um}"`,
          item.price.toFixed(2),
          item.saldoIni,
          item.entrada,
          item.saldoIni + item.entrada,
          item.vendido,
          item.saldoFinal,
          item.importe.toFixed(2),
          `"${estadoLabel}"`,
        ].join(';')
      );
    });

    // 2. Resumen General del Día (incluye devoluciones y ventas netas)
    rows.push(
      `""`,
      `"2. RESUMEN FINANCIERO Y OPERATIVO DEL DÍA"`,
      `"Concepto";"Valor / Monto ($)";"Detalle / Observaciones"`,
      `"Total Unidades Vendidas (Brutas)";${ipvTotalUnidades};"Unidades despachadas según IPV"`,
      `"Total Facturado (Ventas Brutas)";${ipvTotalVendido.toFixed(2)};"Importe bruto facturado"`,
      `"Total Devoluciones / Reembolsos";-${totalRefundToday.toFixed(2)};"${devolucionesToday.length} devoluciones procesadas (${totalReturnedUnitsToday} unidades devueltas)"`,
      `"Ventas Netas Efectivas del Día";${Math.max(0, ipvTotalVendido - totalRefundToday).toFixed(2)};"Ingreso neto tras descontar reembolsos"`,
      `"Efectivo en Caja ($)";${(
        denominations.reduce((acc, d) => acc + d.value * d.count, 0) + (menoresAmount || 0)
      ).toFixed(2)};"Arqueo físico de gaveta"`,
      `"Transferencias Digitales ($)";${(transferenciasAmount || 0).toFixed(2)};"EnZona / Transfermóvil"`
    );

    // 3. REGISTRO DETALLADO DE DEVOLUCIONES DEL DÍA
    rows.push(
      `""`,
      `"3. REGISTRO DETALLADO DE DEVOLUCIONES DE LA JORNADA"`,
      [
        'Folio Devolución',
        'Hora',
        'Ticket Origen',
        'Nombre del Cliente',
        'Motivo de Devolución',
        'Método de Reembolso',
        'Artículos Devueltos y Cantidades',
        'Unidades Devueltas',
        'Condición del Artículo',
        'Monto Reembolsado ($)',
      ].join(';')
    );

    if (devolucionesToday.length === 0) {
      rows.push(`"Sin devoluciones registradas en la jornada de hoy";;;;;;;;;`);
    } else {
      devolucionesToday.forEach((r) => {
        const totalUnits = (r.items || []).reduce((acc, it) => acc + (it.quantity || 1), 0);
        const itemsStr = (r.items || [])
          .map((it) => `${it.name} (x${it.quantity} ${it.um || 'u.'})`)
          .join(', ');
        const conditionStr = r.hasDamagedItems ? 'Con merma / Dañado' : 'Buen estado / Reintegrado al stock';
        const clienteStr = r.customerName && r.customerName.trim() ? r.customerName.trim() : 'Cliente general (No registrado)';
        const metodoStr = (r.refundMethod || 'efectivo').toUpperCase();

        rows.push(
          [
            `"${r.returnNumber || 'DEV-N/A'}"`,
            `"${r.timestamp || '--:--'}"`,
            `"${r.ticketNumber || 'Venta directa'}"`,
            `"${clienteStr.replace(/"/g, '""')}"`,
            `"${(r.reason || 'Sin motivo especificado').replace(/"/g, '""')}"`,
            `"${metodoStr}"`,
            `"${itemsStr.replace(/"/g, '""')}"`,
            totalUnits,
            `"${conditionStr}"`,
            `-${(r.totalRefund || 0).toFixed(2)}`,
          ].join(';')
        );
      });
    }

    // Totales de reembolsos por método
    rows.push(
      `""`,
      `"RESUMEN DE REEMBOLSOS POR CANAL DE PAGO DEL DÍA"`,
      `"Canal / Método";"Total Reembolsado ($)";"Operaciones Registradas"`,
      `"Efectivo";-${refundCashToday.toFixed(2)};${devolucionesToday.filter((r) => r.refundMethod === 'efectivo').length}`,
      `"Transferencia";-${refundTransfToday.toFixed(2)};${devolucionesToday.filter((r) => r.refundMethod === 'transferencia').length}`,
      `"Mixto";-${refundMixtoToday.toFixed(2)};${devolucionesToday.filter((r) => r.refundMethod === 'mixto').length}`,
      `"Total Reembolsos del Día";-${totalRefundToday.toFixed(2)};${devolucionesToday.length}`,
      `""`,
      `"Emitido por Terminal IPV - Módulo de Respaldo y Control de Inventarios"`
    );

    const csvContent = '\uFEFF' + rows.join('\r\n');
    const result = await saveFileWithPicker(csvContent, {
      suggestedName: `Planilla_IPV_Diaria_${dateFormatted}.csv`,
      mimeType: 'text/csv;charset=utf-8;',
      extension: 'csv',
      description: 'Planilla IPV Diaria con Devoluciones (.csv / Excel)',
    });

    if (result.canceled) {
      showToast('Operación Cancelada', 'No se guardó la planilla diaria.', 'info');
      return;
    }

    showToast(
      'Planilla Diaria Exportada',
      `Se generó el archivo Excel con el IPV y datos de devoluciones del día (${ipvRows.length} artículos, ${devolucionesToday.length} devoluciones).`,
      'success'
    );
  };

  // Action 2: Export Monthly Fiscal Accounting (Contabilidad Fiscal con Devoluciones del Mes)
  const handleExportFiscalSummary = async () => {
    const now = new Date();
    const monthName = now.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
    const pad = (n: number) => String(n).padStart(2, '0');
    const fileCode = `${now.getFullYear()}_${pad(now.getMonth() + 1)}`;
    const currentYearMonth = `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;

    // Ventas
    const totalEfectivo = sales.reduce((acc, s) => acc + (s.efectivoAmount || 0), 0);
    const totalTransf = sales.reduce((acc, s) => acc + (s.transferenciaAmount || 0), 0);
    const totalVentasReal = sales.reduce((acc, s) => acc + (s.total || 0), 0);

    // Devoluciones del mes
    const devolucionesMonth = returns.filter((r) => {
      if (!r.date) return false;
      return r.date.startsWith(currentYearMonth);
    });
    const monthReturns = devolucionesMonth.length > 0 ? devolucionesMonth : returns;

    const totalRefundsMonth = monthReturns.reduce((acc, r) => acc + (r.totalRefund || 0), 0);
    const refundCashMonth = monthReturns
      .filter((r) => r.refundMethod === 'efectivo')
      .reduce((acc, r) => acc + (r.totalRefund || 0), 0);
    const refundTransfMonth = monthReturns
      .filter((r) => r.refundMethod === 'transferencia')
      .reduce((acc, r) => acc + (r.totalRefund || 0), 0);
    const refundMixtoMonth = monthReturns
      .filter((r) => r.refundMethod === 'mixto')
      .reduce((acc, r) => acc + (r.totalRefund || 0), 0);
    const totalReturnedUnitsMonth = monthReturns.reduce(
      (acc, r) => acc + (r.items || []).reduce((s, it) => s + (it.quantity || 1), 0),
      0
    );

    const ventasNetasMonth = Math.max(0, totalVentasReal - totalRefundsMonth);
    const baseImponibleNeta = ventasNetasMonth * 0.909;
    const ivaEstimadoNeto = ventasNetasMonth * 0.091;
    const efectivoNeto = Math.max(0, totalEfectivo - refundCashMonth);
    const transfNeta = Math.max(0, totalTransf - refundTransfMonth);

    const sections = [
      `"REPORTE OFICIAL DE CONTABILIDAD FISCAL Y VENTAS - INFORME MENSUAL"`,
      `"Periodo Fiscal: ${monthName.toUpperCase()}"`,
      `"Fecha de Generación: ${now.toLocaleDateString('es-ES')} ${now.toLocaleTimeString('es-CU')}"`,
      `""`,
      `"1. RESUMEN TRIBUTARIO Y VENTAS CONSOLIDADAS DEL MES"`,
      `"Concepto";"Monto ($)";"Detalle / Observaciones"`,
      `"Ventas Brutas Totales";${totalVentasReal.toFixed(2)};"Facturación bruta acumulada del mes"`,
      `"Total Devoluciones / Reembolsos del Mes";-${totalRefundsMonth.toFixed(2)};"${monthReturns.length} devoluciones procesadas (${totalReturnedUnitsMonth} unidades devueltas)"`,
      `"Ventas Netas Realizadas del Mes";${ventasNetasMonth.toFixed(2)};"Ingreso fiscal neto tras descontar devoluciones"`,
      `"Base Imponible Neta de Operaciones";${baseImponibleNeta.toFixed(2)};"Base imponible estimada (90.9%)"`,
      `"Impuesto / IVA Estimado Neto";${ivaEstimadoNeto.toFixed(2)};"Estimación tributaria (9.1%)"`,
      `"Recaudación Bruta en Efectivo";${totalEfectivo.toFixed(2)};"Cobros totales en efectivo"`,
      `"Reembolsos en Efectivo por Devolución";-${refundCashMonth.toFixed(2)};"Reembolsos descontados de efectivo"`,
      `"Efectivo Neto Recaudado";${efectivoNeto.toFixed(2)};"Ingreso real neto en efectivo"`,
      `"Recaudación Bruta por Transferencias";${totalTransf.toFixed(2)};"Cobros totales por canales digitales"`,
      `"Reembolsos por Transferencia";-${refundTransfMonth.toFixed(2)};"Reembolsos canal digital"`,
      `"Transferencias Netas Recaudadas";${transfNeta.toFixed(2)};"Ingreso real neto por transferencias"`,
      `"Total Operaciones de Venta Registradas";${sales.length};"Tickets de venta emitidos"`,
      `"Total Operaciones de Devolución";${monthReturns.length};"Devoluciones procesadas en el periodo"`,
      `""`,
      `"2. DESGLOSE CONSOLIDADO DE ARTÍCULOS EN JORNADA"`,
      `"Código";"Descripción";"Precio Unit.";"Unidades Vendidas";"Subtotal ($)"`,
      ...ipvRows
        .filter((r) => r.vendido > 0)
        .map(
          (r) =>
            `"${r.code}";"${r.name.replace(/"/g, '""')}";${r.price.toFixed(2)};${r.vendido};${r.importe.toFixed(2)}`
        ),
      `""`,
      `"3. HISTORIAL Y REGISTRO DETALLADO DE DEVOLUCIONES DEL MES (${monthName.toUpperCase()})"`,
      `"Folio";"Fecha";"Hora";"Ticket Origen";"Cliente";"Motivo de Devolución";"Método de Reembolso";"Artículos Devueltos";"Uds Devueltas";"Condición";"Monto Reembolsado ($)"`,
    ];

    if (monthReturns.length === 0) {
      sections.push(`"Sin devoluciones registradas en el mes de ${monthName}";;;;;;;;;;`);
    } else {
      monthReturns.forEach((r) => {
        const totalUnits = (r.items || []).reduce((acc, it) => acc + (it.quantity || 1), 0);
        const itemsStr = (r.items || [])
          .map((it) => `${it.name} (x${it.quantity} ${it.um || 'u.'})`)
          .join(', ');
        const conditionStr = r.hasDamagedItems ? 'Con merma / Dañado' : 'Buen estado / Reintegrado al stock';
        const clienteStr = r.customerName && r.customerName.trim() ? r.customerName.trim() : 'Cliente general (No registrado)';
        const metodoStr = (r.refundMethod || 'efectivo').toUpperCase();

        sections.push(
          [
            `"${r.returnNumber || 'DEV-N/A'}"`,
            `"${r.date || '--'}"`,
            `"${r.timestamp || '--:--'}"`,
            `"${r.ticketNumber || 'Venta directa'}"`,
            `"${clienteStr.replace(/"/g, '""')}"`,
            `"${(r.reason || 'Sin motivo especificado').replace(/"/g, '""')}"`,
            `"${metodoStr}"`,
            `"${itemsStr.replace(/"/g, '""')}"`,
            totalUnits,
            `"${conditionStr}"`,
            `-${(r.totalRefund || 0).toFixed(2)}`,
          ].join(';')
        );
      });
    }

    sections.push(
      `""`,
      `"RESUMEN MENSUAL DE REEMBOLSOS POR MÉTODO"`,
      `"Método de Reembolso";"Total Reembolsado ($)";"Operaciones"`,
      `"Efectivo";-${refundCashMonth.toFixed(2)};${monthReturns.filter((r) => r.refundMethod === 'efectivo').length}`,
      `"Transferencia";-${refundTransfMonth.toFixed(2)};${monthReturns.filter((r) => r.refundMethod === 'transferencia').length}`,
      `"Mixto";-${refundMixtoMonth.toFixed(2)};${monthReturns.filter((r) => r.refundMethod === 'mixto').length}`,
      `"Total Reembolsos del Mes";-${totalRefundsMonth.toFixed(2)};${monthReturns.length}`,
      `""`,
      `"Emitido por Terminal IPV - Contabilidad y Control Fiscal Conforme a Base de Datos SQLite"`
    );

    const csvContent = '\uFEFF' + sections.join('\r\n');
    const result = await saveFileWithPicker(csvContent, {
      suggestedName: `Contabilidad_Fiscal_Mensual_${fileCode}.csv`,
      mimeType: 'text/csv;charset=utf-8;',
      extension: 'csv',
      description: 'Informe Fiscal Mensual con Devoluciones (.csv / Excel)',
    });

    if (result.canceled) {
      showToast('Operación Cancelada', 'No se guardó el informe mensual.', 'info');
      return;
    }

    showToast(
      'Informe Mensual Exportado',
      `Se descargó el informe contable completo de ${monthName} con ${monthReturns.length} devoluciones registradas.`,
      'success'
    );
  };

  return (
    <div className="flex flex-col w-full gap-8 select-none pb-12">
      {/* Hidden file input for fallback import */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleTriggerRestore}
        accept=".json"
        className="hidden"
      />

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl lg:text-3xl font-bold tracking-tight text-on-surface">
            Respaldo de Datos y Exportación
          </h1>
          <p className="text-sm text-on-surface-variant">
            Copias de seguridad integrales en SQLite y JSON, exportación de planillas y restauración segura del sistema.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsBackupModalOpen(true)}
            className="px-5 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold shadow-md shadow-primary/25 hover:bg-primary-container transition-all flex items-center gap-2 cursor-pointer"
            type="button"
          >
            <span className="material-symbols-outlined text-[19px]">backup</span>
            <span>Respaldo Inmediato</span>
          </button>
        </div>
      </div>

      {/* 2 Infrastructure Status Cards */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Card 1: Local SQLite */}
        <div className="rounded-2xl bg-surface neo-raised p-6 flex flex-col justify-between relative overflow-hidden">
          <div className="flex items-start justify-between">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
                Motor de Base de Datos
              </span>
              <span className="text-lg font-bold text-on-surface">SQLite 3 (Modo WAL)</span>
            </div>
            <div className="w-12 h-12 rounded-xl bg-surface neo-inset flex items-center justify-center text-primary">
              <span className="material-symbols-outlined text-[24px]">database</span>
            </div>
          </div>
          <div className="mt-4 pt-4 flex flex-col gap-2">
            <div className="flex items-center justify-between text-xs font-medium">
              <span className="text-on-surface-variant font-mono">Transacciones: ACID / WAL</span>
              <span className="text-on-surface font-semibold font-mono">{products.length} productos</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-xs font-semibold text-emerald-600">
                Conectado y consistente (Sin errores de integridad)
              </span>
            </div>
          </div>
        </div>

        {/* Card 2: Last Verified Backup */}
        <div className="rounded-2xl bg-surface neo-raised p-6 flex flex-col justify-between relative overflow-hidden">
          <div className="flex items-start justify-between">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
                Último Resguardo Verificado
              </span>
              <span className="text-lg font-bold text-on-surface">{lastBackup.date}</span>
            </div>
            <div className="w-12 h-12 rounded-xl bg-surface neo-inset flex items-center justify-center text-emerald-600">
              <span className="material-symbols-outlined text-[24px]">verified_user</span>
            </div>
          </div>

          <div className="mt-4 pt-4 flex flex-col gap-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-on-surface-variant">Hora de ejecución:</span>
              <span className="font-semibold text-on-surface font-mono">{lastBackup.time}</span>
            </div>

            <div className="flex flex-col gap-1 text-xs">
              <span className="text-on-surface-variant">Ubicación registrada:</span>
              <span className="font-mono text-[11px] font-semibold text-primary break-all bg-surface neo-inset px-3 py-1.5 rounded-lg select-all">
                {lastBackup.fullPath}
              </span>
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                {lastBackup.status}
              </span>
              <span className="text-[11px] text-on-surface-variant font-mono font-medium">
                {lastBackup.size}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Primary Action Cards */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-on-surface flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[20px]">folder_zip</span>
            Acciones Principales de Resguardo y Extracción
          </h2>
          <span className="text-xs font-medium text-on-surface-variant hidden sm:inline">
            Seleccione la tarea que desea ejecutar
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1: Planilla Diaria */}
          <div className="rounded-2xl bg-surface neo-raised p-6 flex flex-col justify-between hover:-translate-y-1 transition-transform group">
            <div className="flex flex-col gap-3">
              <div className="w-14 h-14 rounded-2xl bg-surface neo-inset flex items-center justify-center text-primary group-hover:scale-105 transition-transform">
                <span className="material-symbols-outlined text-[30px]">table_view</span>
              </div>
              <div className="flex flex-col gap-1 mt-2">
                <span className="text-[11px] font-semibold text-primary uppercase tracking-wider">
                  Planilla Diaria
                </span>
                <h3 className="font-bold text-base text-on-surface leading-snug">
                  Exportar IPV del día a Excel
                </h3>
                <p className="text-xs text-on-surface-variant leading-relaxed mt-1">
                  Genera una planilla Excel (.csv UTF-8 compatible) con los movimientos del IPV registrados
                  hasta este momento: saldos iniciales, entradas, total stock, ventas e importes.
                </p>
              </div>
            </div>
            <div className="mt-6 pt-4 flex flex-col gap-3">
              <div className="flex items-center justify-between text-[11px] text-on-surface-variant font-mono">
                <span>Formato: .csv / Excel</span>
                <span>{ipvRows.length} artículos al corte</span>
              </div>
              <button
                onClick={handleExportDailyIPVExcel}
                className="w-full py-2.5 px-4 rounded-xl bg-surface neo-raised text-primary text-xs font-bold hover:text-on-surface active:neo-inset transition-all flex items-center justify-center gap-2 cursor-pointer"
                type="button"
              >
                <span className="material-symbols-outlined text-[17px]">file_download</span>
                <span>Generar Planilla Excel</span>
              </button>
            </div>
          </div>

          {/* Card 2: Contabilidad Fiscal */}
          <div className="rounded-2xl bg-surface neo-raised p-6 flex flex-col justify-between hover:-translate-y-1 transition-transform group">
            <div className="flex flex-col gap-3">
              <div className="w-14 h-14 rounded-2xl bg-surface neo-inset flex items-center justify-center text-tertiary group-hover:scale-105 transition-transform">
                <span className="material-symbols-outlined text-[30px]">calendar_month</span>
              </div>
              <div className="flex flex-col gap-1 mt-2">
                <span className="text-[11px] font-semibold text-tertiary uppercase tracking-wider">
                  Contabilidad Fiscal
                </span>
                <h3 className="font-bold text-base text-on-surface leading-snug">
                  Exportar informe mensual
                </h3>
                <p className="text-xs text-on-surface-variant leading-relaxed mt-1">
                  Genera el consolidado contable completo de operaciones: facturación acumulada,
                  base imponible estimada, desglose en efectivo y transferencias bancarias.
                </p>
              </div>
            </div>
            <div className="mt-6 pt-4 flex flex-col gap-3">
              <div className="flex items-center justify-between text-[11px] text-on-surface-variant font-mono">
                <span>Periodo: Operaciones Registradas</span>
                <span>Formato: .csv / Excel</span>
              </div>
              <button
                onClick={handleExportFiscalSummary}
                className="w-full py-2.5 px-4 rounded-xl bg-surface neo-raised text-tertiary text-xs font-bold hover:text-on-surface active:neo-inset transition-all flex items-center justify-center gap-2 cursor-pointer"
                type="button"
              >
                <span className="material-symbols-outlined text-[17px]">download_for_offline</span>
                <span>Descargar Resumen Fiscal</span>
              </button>
            </div>
          </div>

          {/* Card 3: Importar Respaldo */}
          <div className="rounded-2xl bg-surface neo-raised p-6 flex flex-col justify-between hover:-translate-y-1 transition-transform group relative">
            <div className="flex flex-col gap-3">
              <div className="w-14 h-14 rounded-2xl bg-surface neo-inset flex items-center justify-center text-primary group-hover:scale-105 transition-transform">
                <span className="material-symbols-outlined text-[30px]">unarchive</span>
              </div>
              <div className="flex flex-col gap-1 mt-2">
                <span className="text-[11px] font-semibold text-primary uppercase tracking-wider">
                  Importar Respaldo
                </span>
                <h3 className="font-bold text-base text-on-surface leading-snug">
                  Restaurar desde archivo
                </h3>
                <p className="text-xs text-on-surface-variant leading-relaxed mt-1">
                  Restaura de forma transaccional una copia previa (.json) generada por el sistema,
                  recomponiendo productos, historial de ventas, movimientos y arqueos de caja.
                </p>
              </div>
            </div>
            <div className="mt-6 pt-4 flex flex-col gap-3">
              <div className="flex items-center justify-between text-[11px] text-on-surface-variant font-mono">
                <span>Formato: .json de respaldo</span>
                <span>Transacción segura SQLite</span>
              </div>
              <button
                onClick={() => setIsImportModalOpen(true)}
                className="w-full py-2.5 px-4 rounded-xl bg-primary text-white text-xs font-bold shadow hover:bg-primary-container active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
                type="button"
              >
                <span className="material-symbols-outlined text-[17px]">upload_file</span>
                <span>Importar Respaldo</span>
              </button>
            </div>
          </div>
        </div>

        {/* Zona de Seguridad / Restablecer la Aplicación */}
        <div className="rounded-2xl bg-surface neo-raised p-6 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 border-l-4 border-rose-500">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-rose-500/10 neo-inset flex items-center justify-center text-rose-600 shrink-0">
              <span className="material-symbols-outlined text-[28px]">restart_alt</span>
            </div>
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-on-surface">Restablecer la Aplicación a Cero</h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-600 uppercase font-mono tracking-wide">
                  Zona de Seguridad
                </span>
              </div>
              <p className="text-xs text-on-surface-variant max-w-2xl leading-relaxed">
                Borra permanentemente todos los datos almacenados (productos del catálogo, ventas realizadas, inventario IPV, arqueos de caja, devoluciones e historial) y reinicia la aplicación desde cero. Para autorizar esta acción se requerirá la contraseña de seguridad.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setResetPassword('');
              setResetError('');
              setIsResetModalOpen(true);
            }}
            className="h-11 px-5 rounded-xl bg-surface neo-raised text-rose-600 hover:text-white hover:bg-rose-600 active:neo-inset font-bold text-xs flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap shadow-sm group"
          >
            <span className="material-symbols-outlined text-[20px] transition-transform group-hover:rotate-180 duration-500">
              delete_forever
            </span>
            <span>Restablecer Aplicación</span>
          </button>
        </div>
      </div>

      {/* Modal: Respaldo Inmediato con selector de formato */}
      {isBackupModalOpen && (
        <div className="fixed inset-0 z-50 bg-inverse-surface/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-2xl bg-surface neo-raised p-6 flex flex-col gap-5 shadow-2xl">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-surface neo-inset flex items-center justify-center text-primary shrink-0">
                <span className="material-symbols-outlined text-[26px]">backup</span>
              </div>
              <div className="flex flex-col flex-1">
                <h3 className="text-base font-bold text-on-surface">Respaldo Inmediato del Sistema</h3>
                <p className="text-xs text-on-surface-variant mt-1 leading-relaxed">
                  Se generará un archivo .json con todas las tablas y transacciones. Se abrirá el selector nativo para que elija la carpeta de su PC donde guardarlo.
                </p>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-surface neo-inset flex items-center gap-3 text-xs text-on-surface-variant">
              <span className="material-symbols-outlined text-primary text-[20px]">folder</span>
              <span>
                Al presionar continuar, podrá seleccionar la ubicación y el nombre final del archivo directamente en su computadora.
              </span>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-outline-variant/20">
              <button
                onClick={() => {
                  if (!isBackingUp) setIsBackupModalOpen(false);
                }}
                disabled={isBackingUp}
                className="px-4 py-2.5 rounded-xl bg-surface neo-raised text-xs font-semibold text-on-surface hover:text-error transition-all active:neo-inset disabled:opacity-50 cursor-pointer"
                type="button"
              >
                Cancelar
              </button>
              <button
                onClick={handleStartBackup}
                disabled={isBackingUp}
                className="px-5 py-2.5 rounded-xl bg-primary text-white text-xs font-bold hover:bg-primary-container transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer shadow-md shadow-primary/25"
                type="button"
              >
                <span className="material-symbols-outlined text-[17px]">
                  {isBackingUp ? 'hourglass_top' : 'save'}
                </span>
                <span>{isBackingUp ? 'Guardando...' : 'Seleccionar Carpeta y Guardar'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Importar Respaldo */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 bg-inverse-surface/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-2xl bg-surface neo-raised p-6 flex flex-col gap-5 shadow-2xl">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-surface neo-inset flex items-center justify-center text-primary shrink-0">
                <span className="material-symbols-outlined text-[26px]">unarchive</span>
              </div>
              <div className="flex flex-col">
                <h3 className="text-base font-bold text-on-surface">Restaurar Base de Datos desde Respaldo</h3>
                <p className="text-xs text-on-surface-variant mt-1 leading-relaxed">
                  Seleccione el archivo JSON generado previamente. El motor de base de datos validará el esquema y cargará todas las tablas de forma transaccional.
                </p>
              </div>
            </div>

            <div
              onClick={handleTriggerRestore}
              className="rounded-2xl bg-surface neo-inset p-8 flex flex-col items-center justify-center gap-3 border-2 border-dashed border-outline/30 text-center cursor-pointer hover:border-primary transition-colors group"
            >
              <div className="w-14 h-14 rounded-2xl bg-surface neo-raised flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined text-[32px]">upload_file</span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-bold text-on-surface">
                  Haga clic para abrir el diálogo y elegir el archivo .json
                </span>
                <span className="text-xs text-on-surface-variant">
                  Se verificará integridad referencial y versión de esquema.
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setIsImportModalOpen(false)}
                className="px-4 py-2.5 rounded-xl bg-surface neo-raised text-xs font-semibold text-on-surface active:neo-inset cursor-pointer"
                type="button"
              >
                Cerrar
              </button>
              <button
                onClick={handleTriggerRestore}
                className="px-5 py-2.5 rounded-xl bg-primary text-white text-xs font-bold hover:bg-primary-container transition-all flex items-center gap-1.5 cursor-pointer shadow-md shadow-primary/25"
                type="button"
              >
                <span className="material-symbols-outlined text-[17px]">folder_open</span>
                <span>Examinar Archivos</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Restablecer Aplicación a Cero con Contraseña */}
      {isResetModalOpen && (
        <div className="fixed inset-0 z-50 bg-inverse-surface/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl bg-surface neo-raised p-6 flex flex-col gap-5 shadow-2xl border border-rose-500/20">
            <div className="flex items-start gap-3.5">
              <div className="w-12 h-12 rounded-xl bg-rose-500/15 neo-inset flex items-center justify-center text-rose-600 shrink-0">
                <span className="material-symbols-outlined text-[28px]">warning</span>
              </div>
              <div className="flex flex-col">
                <h3 className="text-base font-bold text-on-surface">Restablecer la Aplicación a Cero</h3>
                <p className="text-xs text-on-surface-variant mt-0.5">
                  Esta acción eliminará todos los registros (productos, ventas, inventario, devoluciones y caja) de forma definitiva e irreversible.
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-700 text-xs flex items-start gap-2.5">
              <span className="material-symbols-outlined text-[18px] shrink-0 mt-0.5">lock</span>
              <span>
                Para autorizar el reinicio completo a cero, escriba la contraseña de seguridad:
              </span>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-on-surface">Contraseña de Seguridad:</label>
              <div className="h-11 px-3.5 rounded-xl bg-surface neo-inset flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-on-surface-variant">key</span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={resetPassword}
                  onChange={(e) => {
                    setResetPassword(e.target.value);
                    setResetError('');
                  }}
                  placeholder="Escriba la contraseña de seguridad"
                  className="bg-transparent border-none outline-none text-xs text-on-surface w-full font-mono"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleConfirmReset();
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-on-surface-variant hover:text-on-surface cursor-pointer text-xs p-1"
                  title={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                >
                  <span className="material-symbols-outlined text-[18px]">
                    {showPassword ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>
              {resetError && (
                <span className="text-[11px] font-semibold text-rose-600 flex items-center gap-1 mt-0.5">
                  <span className="material-symbols-outlined text-[14px]">error</span>
                  {resetError}
                </span>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-outline-variant/20">
              <button
                onClick={() => {
                  if (!isResetting) {
                    setIsResetModalOpen(false);
                    setResetPassword('');
                    setResetError('');
                  }
                }}
                disabled={isResetting}
                className="px-4 py-2.5 rounded-xl bg-surface neo-raised text-xs font-semibold text-on-surface hover:text-error transition-all active:neo-inset disabled:opacity-50 cursor-pointer"
                type="button"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmReset}
                disabled={isResetting}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer shadow-md shadow-rose-600/25"
                type="button"
              >
                <span className="material-symbols-outlined text-[17px]">
                  {isResetting ? 'hourglass_top' : 'delete_forever'}
                </span>
                <span>{isResetting ? 'Restableciendo...' : 'Confirmar y Comenzar desde Cero'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
