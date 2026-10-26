import React, { useState, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { saveFileWithPicker } from '../utils/fileSaver';
import {
  ACTIVATION_CODE_LENGTH,
  ACTIVATION_CODE_MIN_LENGTH,
  formatActivationCode,
  normalizeActivationCode,
} from '../utils/activation';

interface LastBackupState {
  date: string;
  time: string;
  fullPath: string;
  fileName: string;
  folderPath: string;
  size: string;
  status: string;
}

export const SettingsView: React.FC = () => {
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
    isAppActivated,
    isTrialActive,
    trialDaysRemaining,
    licenseStatus,
    licenseReadOnly,
    licenseExpiryDate,
    licenseDaysRemaining,
    licenseType,
    installationId,
    activationKey,
    activatedAt,
    activateApp,
    resetPasswordKey,
    updateResetPassword,
    settingsTab: activeTab,
    setSettingsTab: setActiveTab,
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

  // Modals for backup
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [backupFormat, setBackupFormat] = useState<'sqlite' | 'json'>('sqlite');
  const [isBackingUp, setIsBackingUp] = useState(false);

  // States for Reset Application Modal
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [resetPasswordInput, setResetPasswordInput] = useState('');
  const [resetError, setResetError] = useState('');
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  // States for Change Reset Password Form
  const [currentPassInput, setCurrentPassInput] = useState('');
  const [newPassInput, setNewPassInput] = useState('');
  const [confirmPassInput, setConfirmPassInput] = useState('');
  const [passError, setPassError] = useState('');
  const [showPassFields, setShowPassFields] = useState(false);

  // States for In-View License Activation Form
  const [activationCodeInput, setActivationCodeInput] = useState('');
  const [activationError, setActivationError] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleCopyText = async (text: string, label: string) => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      showToast('Copiado', `${label} copiado al portapapeles.`, 'success');
    } catch {
      showToast('Copia manual', `${label}: ${text}`, 'info');
    }
  };

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
      date: `${dateStr} • ${timeStr}`,
      destination: folder,
      size: format === 'sqlite' ? 'SQLite WAL' : 'JSON UTF-8',
      status: 'Exitoso',
    });
  };

  const handleStartBackup = async () => {
    setIsBackingUp(true);
    try {
      if (window.api && window.api.backup) {
        if (backupFormat === 'sqlite') {
          const res = await window.api.backup.saveSqlite();
          if (res.canceled) {
            showToast('Operación Cancelada', 'No se guardó el respaldo.', 'info');
            return;
          }
          updateBackupState(res.path, 'sqlite');
          showToast(
            'Respaldo SQLite Completado',
            `Base de datos respaldada correctamente en: ${res.path}`,
            'success'
          );
        } else {
          const res = await window.api.backup.saveJson();
          if (res.canceled) {
            showToast('Operación Cancelada', 'No se guardó el respaldo.', 'info');
            return;
          }
          updateBackupState(res.path, 'json');
          showToast(
            'Respaldo JSON Generado',
            `Estructura completa exportada en: ${res.path}`,
            'success'
          );
        }
        setIsBackupModalOpen(false);
      } else {
        // Fallback for browser testing
        const now = new Date();
        const dateStr = `${now.getFullYear()}_${now.getMonth() + 1}_${now.getDate()}`;
        const fakeFileName = `ferrestock_backup_${dateStr}.${backupFormat === 'sqlite' ? 'db' : 'json'}`;
        updateBackupState(`C:\\Ferrestock\\Backups\\${fakeFileName}`, backupFormat);
        showToast(
          'Copia de Seguridad Lista',
          `Se simuló la creación del respaldo ${backupFormat.toUpperCase()}`,
          'success'
        );
        setIsBackupModalOpen(false);
      }
    } catch (err: any) {
      showToast('Error de Respaldo', err?.message || 'No se pudo generar la copia.', 'error');
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleTriggerRestore = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      if (window.api && window.api.backup) {
        const res = await window.api.backup.restoreJson();
        if (res.canceled) {
          showToast('Restauración Cancelada', 'No se seleccionó archivo de restauración.', 'info');
          return;
        }

        await refreshAll();

        const now = new Date();
        const pad = (n: number) => String(n).padStart(2, '0');
        const restoredPath = (res as any)?.path || 'Archivo JSON Restaurado';
        const restoredState: LastBackupState = {
          date: now.toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' }),
          time: `${pad(now.getHours())}:${pad(now.getMinutes())} hrs`,
          folderPath: 'Restaurado',
          fileName: restoredPath.split(/[\\/]/).pop() || 'backup.json',
          fullPath: restoredPath,
          size: 'Restaurado',
          status: 'Restauración Exitosa',
        };

        setLastBackup(restoredState);
        localStorage.setItem('ferrestock_last_backup_info', JSON.stringify(restoredState));

        showToast(
          'Restauración Exitosa',
          'Datos recomparados e integrados desde el archivo de respaldo.',
          'success'
        );
      } else {
        const reader = new FileReader();
        reader.onload = async (event) => {
          try {
            const content = event.target?.result as string;
            const parsed = JSON.parse(content);
            if (!parsed.products || !Array.isArray(parsed.products)) {
              throw new Error('Estructura de JSON no compatible con FerreStock.');
            }

            localStorage.setItem('ferrestock_products', JSON.stringify(parsed.products));
            if (parsed.sales) localStorage.setItem('ferrestock_sales', JSON.stringify(parsed.sales));
            if (parsed.returns) localStorage.setItem('ipv_returns_v2', JSON.stringify(parsed.returns));

            await refreshAll();

            setLastBackup({
              date: 'Reciente',
              time: 'Ahora',
              folderPath: 'Navegador',
              fileName: file.name,
              fullPath: file.name,
              size: `${(file.size / 1024).toFixed(1)} KB`,
              status: 'Restauración Web Exitosa',
            });

            showToast(
              'Restauración Simulada',
              `Se restauraron ${parsed.products.length} productos desde ${file.name}.`,
              'success'
            );
          } catch (err: any) {
            showToast('Error de Archivo', err?.message || 'Archivo JSON inválido.', 'error');
          }
        };
        reader.readAsText(file);
      }
    } catch (err: any) {
      showToast('Error al Restaurar', err?.message || 'Fallo al procesar el archivo.', 'error');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
      setIsImportModalOpen(false);
    }
  };

  // Restablecer aplicación completa a 0 previa verificación de contraseña
  const handleConfirmReset = async () => {
    const currentActualPassword = localStorage.getItem('ferrestock_reset_password') || resetPasswordKey || 'adminreset';
    if (resetPasswordInput.trim() !== currentActualPassword.trim()) {
      setResetError('Contraseña incorrecta. Debe ingresar la contraseña de seguridad válida para autorizar el restablecimiento.');
      return;
    }

    setIsResetting(true);
    try {
      const success = await resetApplication(resetPasswordInput);
      if (success) {
        setLastBackup({
          date: 'Sin respaldos',
          time: '--:--',
          folderPath: 'N/A',
          fileName: 'Sin archivo generado',
          fullPath: 'Sistema restablecido a 0',
          size: '0 KB',
          status: 'Restablecido de Fábrica',
        });
        setIsResetModalOpen(false);
        setResetPasswordInput('');
        setResetError('');
      }
    } catch (err: any) {
      showToast('Error al Restablecer', err?.message || 'No se pudo restablecer la aplicación.', 'error');
    } finally {
      setIsResetting(false);
    }
  };

  // Guardar nueva contraseña de reinicio
  const handleSaveNewPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassInput) {
      setPassError('Ingrese la contraseña actual.');
      return;
    }
    if (newPassInput.length < 4) {
      setPassError('La nueva contraseña debe tener al menos 4 caracteres.');
      return;
    }
    if (newPassInput !== confirmPassInput) {
      setPassError('La confirmación de la nueva contraseña no coincide.');
      return;
    }

    const res = updateResetPassword(currentPassInput, newPassInput);
    if (!res.success) {
      setPassError(res.message);
    } else {
      setPassError('');
      setCurrentPassInput('');
      setNewPassInput('');
      setConfirmPassInput('');
    }
  };

  // Activar desde formulario en vista
  const handleInViewActivation = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = normalizeActivationCode(activationCodeInput);
    if (clean.length < ACTIVATION_CODE_MIN_LENGTH || clean.length > ACTIVATION_CODE_LENGTH) {
      setActivationError('El código debe contener entre 100 y 124 caracteres, sin contar espacios ni guiones.');
      return;
    }
    const res = await activateApp(activationCodeInput);
    if (!res.success) {
      setActivationError(res.message);
    } else {
      setActivationError('');
      setActivationCodeInput('');
    }
  };

  const handlePasteActivationCode = async () => {
    try {
      if (!navigator.clipboard?.readText) {
        throw new Error('El acceso al portapapeles no está disponible. Pegue el código manualmente.');
      }
      const text = await navigator.clipboard.readText();
      setActivationCodeInput(text.slice(0, 250));
      setActivationError('');
    } catch (error: unknown) {
      setActivationError(error instanceof Error ? error.message : 'No se pudo leer el portapapeles.');
    }
  };

  // ==========================================
  // GENERADORES DE REPORTES
  // ==========================================

  // Reporte 1: Planilla IPV Diaria con Devoluciones
  const handleExportDailyIPVExcel = async () => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const dateFormatted = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

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

    ipvRows.forEach((item) => {
      const estadoLabel = item.status === 'zero' ? 'Agotado' : item.status === 'low' ? 'Stock Bajo' : 'Normal';
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

    rows.push(
      `""`,
      `"2. RESUMEN FINANCIERO Y OPERATIVO DEL DÍA"`,
      `"Concepto";"Valor / Monto ($)";"Detalle / Observaciones"`,
      `"Total Unidades Vendidas";${ipvTotalUnidades};"Unidades despachadas según IPV"`,
      `"Total Facturado (Ventas Brutas)";${ipvTotalVendido.toFixed(2)};"Importe bruto facturado"`,
      `"Total Devoluciones / Reembolsos";-${totalRefundToday.toFixed(2)};"${devolucionesToday.length} devoluciones procesadas"`,
      `"Ventas Netas Efectivas del Día";${Math.max(0, ipvTotalVendido - totalRefundToday).toFixed(2)};"Ingreso neto tras descontar reembolsos"`,
      `"Efectivo en Caja ($)";${(
        denominations.reduce((acc, d) => acc + d.value * d.count, 0) + (menoresAmount || 0)
      ).toFixed(2)};"Arqueo físico de gaveta"`,
      `"Transferencias Digitales ($)";${(transferenciasAmount || 0).toFixed(2)};"EnZona / Transfermóvil"`
    );

    const csvContent = '\uFEFF' + rows.join('\r\n');
    const result = await saveFileWithPicker(csvContent, {
      suggestedName: `Planilla_IPV_Diaria_${dateFormatted}.csv`,
      mimeType: 'text/csv;charset=utf-8;',
      extension: 'csv',
      description: 'Planilla IPV Diaria (.csv / Excel)',
    });

    if (!result.canceled) {
      showToast('Planilla Diaria Exportada', `Se generó el archivo con ${ipvRows.length} artículos del IPV.`, 'success');
    }
  };

  // Reporte 2: Consolidado Contable y Fiscal Mensual
  const handleExportFiscalSummary = async () => {
    const now = new Date();
    const monthName = now.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
    const pad = (n: number) => String(n).padStart(2, '0');
    const fileCode = `${now.getFullYear()}_${pad(now.getMonth() + 1)}`;
    const currentYearMonth = `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;

    const totalEfectivo = sales.reduce((acc, s) => acc + (s.efectivoAmount || 0), 0);
    const totalTransf = sales.reduce((acc, s) => acc + (s.transferenciaAmount || 0), 0);
    const totalVentasReal = sales.reduce((acc, s) => acc + (s.total || 0), 0);

    const devolucionesMonth = returns.filter((r) => r.date && r.date.startsWith(currentYearMonth));
    const monthReturns = devolucionesMonth.length > 0 ? devolucionesMonth : returns;
    const totalRefundsMonth = monthReturns.reduce((acc, r) => acc + (r.totalRefund || 0), 0);
    const ventasNetasMonth = Math.max(0, totalVentasReal - totalRefundsMonth);
    const baseImponibleNeta = ventasNetasMonth * 0.909;
    const ivaEstimadoNeto = ventasNetasMonth * 0.091;

    const sections = [
      `"REPORTE OFICIAL DE CONTABILIDAD FISCAL Y VENTAS - INFORME MENSUAL"`,
      `"Periodo Fiscal: ${monthName.toUpperCase()}"`,
      `"Fecha de Generación: ${now.toLocaleDateString('es-ES')} ${now.toLocaleTimeString('es-CU')}"`,
      `""`,
      `"1. RESUMEN TRIBUTARIO Y VENTAS CONSOLIDADAS DEL MES"`,
      `"Concepto";"Monto ($)";"Detalle / Observaciones"`,
      `"Ventas Brutas Totales";${totalVentasReal.toFixed(2)};"Facturación bruta acumulada del mes"`,
      `"Total Devoluciones / Reembolsos del Mes";-${totalRefundsMonth.toFixed(2)};"${monthReturns.length} devoluciones procesadas"`,
      `"Ventas Netas Realizadas del Mes";${ventasNetasMonth.toFixed(2)};"Ingreso fiscal neto tras descontar devoluciones"`,
      `"Base Imponible Neta de Operaciones";${baseImponibleNeta.toFixed(2)};"Base imponible estimada (90.9%)"`,
      `"Impuesto / IVA Estimado Neto";${ivaEstimadoNeto.toFixed(2)};"Estimación tributaria (9.1%)"`,
      `"Recaudación Bruta en Efectivo";${totalEfectivo.toFixed(2)};"Cobros totales en efectivo"`,
      `"Recaudación Bruta por Transferencias";${totalTransf.toFixed(2)};"Cobros totales por canales digitales"`,
      `"Total Operaciones de Venta Registradas";${sales.length};"Tickets de venta emitidos"`,
      `"Total Operaciones de Devolución";${monthReturns.length};"Devoluciones procesadas en el periodo"`,
      `""`,
      `"2. DESGLOSE CONSOLIDADO DE ARTÍCULOS VENDIDOS"`,
      `"Código";"Descripción";"Precio Unit.";"Unidades Vendidas";"Subtotal ($)"`,
      ...ipvRows
        .filter((r) => r.vendido > 0)
        .map((r) => `"${r.code}";"${r.name.replace(/"/g, '""')}";${r.price.toFixed(2)};${r.vendido};${r.importe.toFixed(2)}`),
    ];

    const csvContent = '\uFEFF' + sections.join('\r\n');
    const result = await saveFileWithPicker(csvContent, {
      suggestedName: `Contabilidad_Fiscal_Mensual_${fileCode}.csv`,
      mimeType: 'text/csv;charset=utf-8;',
      extension: 'csv',
      description: 'Informe Fiscal Mensual (.csv / Excel)',
    });

    if (!result.canceled) {
      showToast('Informe Mensual Exportado', `Se descargó el consolidado contable de ${monthName}.`, 'success');
    }
  };

  // Reporte 3: Catálogo Completo de Productos y Existencias de Almacén
  const handleExportProductsCatalog = async () => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const dateFormatted = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

    const rows: string[] = [
      `"CATÁLOGO MAESTRO DE PRODUCTOS Y CONTROL DE EXISTENCIAS"`,
      `"Fecha de Extracción: ${dateFormatted} | Total Productos: ${products.length}"`,
      `""`,
      [
        'Código',
        'Descripción del Producto',
        'Categoría / Familia',
        'Unidad de Medida',
        'Precio de Venta ($ CUP)',
        'Stock Mostrador',
        'Stock Almacén General',
        'Stock Total Integrado',
        'Stock Mínimo de Seguridad',
        'Estado de Inventario',
        'Ubicación / Estante',
        'Proveedor',
      ].join(';'),
    ];

    products.forEach((p) => {
      const almStock = p.almacenStock || 0;
      const totalStock = p.stock + almStock;
      const estado = p.stock === 0 ? 'Agotado' : p.stock <= p.minStock ? 'Stock Crítico' : 'Disponible';

      rows.push(
        [
          `"${p.code}"`,
          `"${p.name.replace(/"/g, '""')}"`,
          `"${p.category || 'General'}"`,
          `"${p.um || 'u'}"`,
          Number(p.price || 0).toFixed(2),
          p.stock,
          almStock,
          totalStock,
          p.minStock,
          `"${estado}"`,
          `"${p.location || 'Mostrador'}"`,
          `"${p.provider || 'Principal'}"`,
        ].join(';')
      );
    });

    const csvContent = '\uFEFF' + rows.join('\r\n');
    const result = await saveFileWithPicker(csvContent, {
      suggestedName: `Catalogo_Productos_FerreStock_${dateFormatted}.csv`,
      mimeType: 'text/csv;charset=utf-8;',
      extension: 'csv',
      description: 'Catálogo de Productos (.csv / Excel)',
    });

    if (!result.canceled) {
      showToast('Catálogo Exportado', `Se exportaron ${products.length} productos con existencias.`, 'success');
    }
  };

  // Reporte 4: Historial de Ventas y Tickets de Facturación
  const handleExportSalesHistory = async () => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const dateFormatted = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

    const rows: string[] = [
      `"HISTORIAL CONSOLIDADO DE TICKETS DE VENTA Y FACTURACIÓN"`,
      `"Fecha de Extracción: ${dateFormatted} | Total Tickets: ${sales.length}"`,
      `""`,
      [
        'N° Folio / Ticket',
        'Fecha',
        'Hora',
        'Importe Total ($ CUP)',
        'Método de Pago',
        'Monto Efectivo ($)',
        'Monto Transferencia ($)',
        'Cantidad de Artículos',
        'Detalle de Productos Vendidos',
        'Nota del Ticket',
        'Estado',
      ].join(';'),
    ];

    sales.forEach((s) => {
      const itemsDetail = (s.items || [])
        .map((it) => `${it.name} (x${it.quantity} @ $${it.unitPrice})`)
        .join(' | ');

      const isVoided = (s as any).voided ? 'Anulado' : 'Completado';

      rows.push(
        [
          `"${s.ticketNumber || s.id}"`,
          `"${s.date || '--'}"`,
          `"${s.timestamp || '--:--'}"`,
          (s.total || 0).toFixed(2),
          `"${(s.paymentMethod || 'efectivo').toUpperCase()}"`,
          (s.efectivoAmount || 0).toFixed(2),
          (s.transferenciaAmount || 0).toFixed(2),
          (s.items || []).length,
          `"${itemsDetail.replace(/"/g, '""')}"`,
          `"${(s.note || '').replace(/"/g, '""')}"`,
          `"${isVoided}"`,
        ].join(';')
      );
    });

    const csvContent = '\uFEFF' + rows.join('\r\n');
    const result = await saveFileWithPicker(csvContent, {
      suggestedName: `Historial_Ventas_${dateFormatted}.csv`,
      mimeType: 'text/csv;charset=utf-8;',
      extension: 'csv',
      description: 'Historial de Ventas (.csv / Excel)',
    });

    if (!result.canceled) {
      showToast('Historial Exportado', `Se descargaron ${sales.length} tickets de venta.`, 'success');
    }
  };

  // Reporte 5: Registro de Devoluciones y Mermas
  const handleExportReturnsReport = async () => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const dateFormatted = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

    const rows: string[] = [
      `"REGISTRO DETALLADO DE DEVOLUCIONES DE CLIENTES Y CONTROL DE MERMAS"`,
      `"Fecha de Extracción: ${dateFormatted} | Total Devoluciones: ${returns.length}"`,
      `""`,
      [
        'Folio Devolución',
        'Fecha',
        'Hora',
        'Ticket de Venta Origen',
        'Nombre del Cliente',
        'Motivo de Devolución',
        'Método de Reembolso',
        'Total Reembolsado ($ CUP)',
        'Unidades Devueltas',
        'Detalle de Artículos Devueltos',
        'Condición de Artículos',
      ].join(';'),
    ];

    returns.forEach((r) => {
      const itemsStr = (r.items || [])
        .map((it) => `${it.name} (x${it.quantity} ${it.um || 'u'}) [${it.condition === 'mal_estado' ? 'Dañado' : 'Bueno'}]`)
        .join(' | ');

      const totalUds = (r.items || []).reduce((acc, it) => acc + (it.quantity || 1), 0);
      const cond = r.hasDamagedItems ? 'Con Merma / Defecto' : 'Buen Estado / En Almacén';

      rows.push(
        [
          `"${r.returnNumber || r.id}"`,
          `"${r.date || '--'}"`,
          `"${r.timestamp || '--:--'}"`,
          `"${r.ticketNumber || 'Venta directa'}"`,
          `"${(r.customerName || 'Cliente general').replace(/"/g, '""')}"`,
          `"${(r.reason || 'Sin motivo').replace(/"/g, '""')}"`,
          `"${(r.refundMethod || 'efectivo').toUpperCase()}"`,
          Number(r.totalRefund || 0).toFixed(2),
          totalUds,
          `"${itemsStr.replace(/"/g, '""')}"`,
          `"${cond}"`,
        ].join(';')
      );
    });

    const csvContent = '\uFEFF' + rows.join('\r\n');
    const result = await saveFileWithPicker(csvContent, {
      suggestedName: `Registro_Devoluciones_${dateFormatted}.csv`,
      mimeType: 'text/csv;charset=utf-8;',
      extension: 'csv',
      description: 'Registro de Devoluciones (.csv / Excel)',
    });

    if (!result.canceled) {
      showToast('Devoluciones Exportadas', `Se descargaron ${returns.length} registros de devolución.`, 'success');
    }
  };

  return (
    <div className="flex flex-col w-full gap-8 select-none pb-14">
      {/* Hidden file input for restore */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleTriggerRestore}
        accept=".json"
        className="hidden"
      />

      {/* Main Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl lg:text-3xl font-bold tracking-tight text-on-surface">
              Configuración del Sistema
            </h1>
          </div>
          <p className="text-sm text-on-surface-variant">
            Generación de reportes contables, copias de seguridad de datos, seguridad de reinicio y activación de licencia.
          </p>
        </div>

        {/* Global Quick Action */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsBackupModalOpen(true)}
            className="px-4 py-2.5 rounded-xl bg-primary text-white text-xs font-semibold shadow-md shadow-primary/25 hover:bg-primary-container transition-all flex items-center gap-2 cursor-pointer active:scale-95"
            type="button"
          >
            <span className="material-symbols-outlined text-[18px]">backup</span>
            <span>Respaldo Rápido</span>
          </button>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex flex-wrap items-center gap-2 p-1.5 rounded-2xl bg-surface neo-inset">
        <button
          type="button"
          onClick={() => setActiveTab('reportes')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'reportes'
              ? 'bg-surface neo-raised text-primary'
              : 'text-on-surface-variant hover:text-on-surface'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">description</span>
          <span>Generar Reportes</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('respaldos')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'respaldos'
              ? 'bg-surface neo-raised text-primary'
              : 'text-on-surface-variant hover:text-on-surface'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">cloud_sync</span>
          <span>Opciones de Respaldo</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('seguridad')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'seguridad'
              ? 'bg-surface neo-raised text-primary'
              : 'text-on-surface-variant hover:text-on-surface'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">security</span>
          <span>Seguridad y Reinicio</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('licencia')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'licencia'
              ? 'bg-surface neo-raised text-primary'
              : 'text-on-surface-variant hover:text-on-surface'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">key</span>
          <span>Activar Aplicación</span>
          {!isAppActivated && (
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse shrink-0" />
          )}
        </button>
      </div>

      {/* ========================================================= */}
      {/* TAB 1: GENERAR REPORTES */}
      {/* ========================================================= */}
      {activeTab === 'reportes' && (
        <section className="flex flex-col gap-6 animate-in fade-in duration-200">
          <div className="flex flex-col">
            <h2 className="text-lg font-headline font-bold text-on-surface">
              Tipos de Reportes Disponibles para Exportar
            </h2>
            <span className="text-xs text-on-surface-variant">
              Seleccione el formato y tipo de documento que desea generar en hojas de cálculo compatibles con Microsoft Excel y LibreOffice.
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Report 1: Planilla Diaria IPV */}
            <div className="rounded-2xl bg-surface neo-raised p-6 flex flex-col justify-between hover:-translate-y-1 transition-transform group">
              <div className="flex flex-col gap-3">
                <div className="w-13 h-13 rounded-2xl bg-surface neo-inset flex items-center justify-center text-primary group-hover:scale-105 transition-transform">
                  <span className="material-symbols-outlined text-[28px]">table_view</span>
                </div>
                <div className="flex flex-col gap-1 mt-1">
                  <span className="text-[11px] font-semibold text-primary uppercase tracking-wider">
                    Control Diario
                  </span>
                  <h3 className="font-bold text-base text-on-surface leading-snug">
                    IPV de la Jornada
                  </h3>
                  <p className="text-xs text-on-surface-variant leading-relaxed mt-1">
                    Inventario completo del día: saldos iniciales, entradas, stock total, artículos vendidos, saldos finales, cierre físico y devoluciones registradas.
                  </p>
                </div>
              </div>

              <div className="mt-6 pt-4 flex flex-col gap-3 border-t border-outline-variant/15">
                <div className="flex items-center justify-between text-[11px] text-on-surface-variant font-mono">
                  <span>Formato: .CSV / Excel</span>
                  <span>{ipvRows.length} artículos</span>
                </div>
                <button
                  type="button"
                  onClick={handleExportDailyIPVExcel}
                  className="w-full py-2.5 px-4 rounded-xl bg-surface neo-raised text-primary text-xs font-bold hover:text-on-surface active:neo-inset transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                >
                  <span className="material-symbols-outlined text-[17px]">file_download</span>
                  <span>Descargar Documento</span>
                </button>
              </div>
            </div>

            {/* Report 2: Contabilidad Fiscal Mensual */}
            <div className="rounded-2xl bg-surface neo-raised p-6 flex flex-col justify-between hover:-translate-y-1 transition-transform group">
              <div className="flex flex-col gap-3">
                <div className="w-13 h-13 rounded-2xl bg-surface neo-inset flex items-center justify-center text-tertiary group-hover:scale-105 transition-transform">
                  <span className="material-symbols-outlined text-[28px]">calendar_month</span>
                </div>
                <div className="flex flex-col gap-1 mt-1">
                  <span className="text-[11px] font-semibold text-tertiary uppercase tracking-wider">
                    Control Mensual
                  </span>
                  <h3 className="font-bold text-base text-on-surface leading-snug">
                    Resumen Contable Mensual
                  </h3>
                  <p className="text-xs text-on-surface-variant leading-relaxed mt-1">
                    Consolidado mensual con facturación bruta acumulada, devoluciones del mes, ventas netas y demas indicadores fiscales, incluyendo desglose de artículos vendidos.
                  </p>
                </div>
              </div>

              <div className="mt-6 pt-4 flex flex-col gap-3 border-t border-outline-variant/15">
                <div className="flex items-center justify-between text-[11px] text-on-surface-variant font-mono">
                  <span>Formato: .CSV / Excel</span>
                  <span>{sales.length} tickets mes</span>
                </div>
                <button
                  type="button"
                  onClick={handleExportFiscalSummary}
                  className="w-full py-2.5 px-4 rounded-xl bg-surface neo-raised text-tertiary text-xs font-bold hover:text-on-surface active:neo-inset transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                >
                  <span className="material-symbols-outlined text-[17px]">download_for_offline</span>
                  <span>Descargar Resumen</span>
                </button>
              </div>
            </div>

            {/* Report 3: Catálogo de Productos y Existencias */}
            <div className="rounded-2xl bg-surface neo-raised p-6 flex flex-col justify-between hover:-translate-y-1 transition-transform group">
              <div className="flex flex-col gap-3">
                <div className="w-13 h-13 rounded-2xl bg-surface neo-inset flex items-center justify-center text-emerald-600 group-hover:scale-105 transition-transform">
                  <span className="material-symbols-outlined text-[28px]">inventory_2</span>
                </div>
                <div className="flex flex-col gap-1 mt-1">
                  <span className="text-[11px] font-semibold text-emerald-600 uppercase tracking-wider">
                    Existencias y Almacén
                  </span>
                  <h3 className="font-bold text-base text-on-surface leading-snug">
                    Catálogo de Productos y Stock
                  </h3>
                  <p className="text-xs text-on-surface-variant leading-relaxed mt-1">
                    Exportación de todos los artículos registrados con código, descripción, categoría, precio de venta en CUP, stock de mostrador, existencias de almacén y umbral de seguridad.
                  </p>
                </div>
              </div>

              <div className="mt-6 pt-4 flex flex-col gap-3 border-t border-outline-variant/15">
                <div className="flex items-center justify-between text-[11px] text-on-surface-variant font-mono">
                  <span>Formato: .CSV / Excel</span>
                  <span>{products.length} productos</span>
                </div>
                <button
                  type="button"
                  onClick={handleExportProductsCatalog}
                  className="w-full py-2.5 px-4 rounded-xl bg-surface neo-raised text-emerald-700 text-xs font-bold hover:text-on-surface active:neo-inset transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                >
                  <span className="material-symbols-outlined text-[17px]">output</span>
                  <span>Exportar Catálogo</span>
                </button>
              </div>
            </div>

            {/* Report 4: Historial de Ventas y Tickets */}
            <div className="rounded-2xl bg-surface neo-raised p-6 flex flex-col justify-between hover:-translate-y-1 transition-transform group">
              <div className="flex flex-col gap-3">
                <div className="w-13 h-13 rounded-2xl bg-surface neo-inset flex items-center justify-center text-blue-600 group-hover:scale-105 transition-transform">
                  <span className="material-symbols-outlined text-[28px]">receipt_long</span>
                </div>
                <div className="flex flex-col gap-1 mt-1">
                  <span className="text-[11px] font-semibold text-blue-600 uppercase tracking-wider">
                    Facturación Comercial
                  </span>
                  <h3 className="font-bold text-base text-on-surface leading-snug">
                    Historial de Ventas y Transacciones
                  </h3>
                  <p className="text-xs text-on-surface-variant leading-relaxed mt-1">
                    Detalle cronológico de todas las ventas emitidas: fecha, hora, monto total facturado, método de pago (efectivo / transferencia / mixto), notas y relación de artículos por transacción.
                  </p>
                </div>
              </div>

              <div className="mt-6 pt-4 flex flex-col gap-3 border-t border-outline-variant/15">
                <div className="flex items-center justify-between text-[11px] text-on-surface-variant font-mono">
                  <span>Formato: .CSV / Excel</span>
                  <span>{sales.length} registros</span>
                </div>
                <button
                  type="button"
                  onClick={handleExportSalesHistory}
                  className="w-full py-2.5 px-4 rounded-xl bg-surface neo-raised text-blue-600 text-xs font-bold hover:text-on-surface active:neo-inset transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                >
                  <span className="material-symbols-outlined text-[17px]">receipt</span>
                  <span>Exportar Tickets de Venta</span>
                </button>
              </div>
            </div>

            {/* Report 5: Devoluciones y Mermas */}
            <div className="rounded-2xl bg-surface neo-raised p-6 flex flex-col justify-between hover:-translate-y-1 transition-transform group">
              <div className="flex flex-col gap-3">
                <div className="w-13 h-13 rounded-2xl bg-surface neo-inset flex items-center justify-center text-amber-600 group-hover:scale-105 transition-transform">
                  <span className="material-symbols-outlined text-[28px]">assignment_return</span>
                </div>
                <div className="flex flex-col gap-1 mt-1">
                  <span className="text-[11px] font-semibold text-amber-600 uppercase tracking-wider">
                    Garantías y Reembolsos
                  </span>
                  <h3 className="font-bold text-base text-on-surface leading-snug">
                    Registro de Devoluciones y Mermas
                  </h3>
                  <p className="text-xs text-on-surface-variant leading-relaxed mt-1">
                    Histórico de devoluciones efectuadas por clientes: folios, ticket original, motivo de retorno, cliente, montos reembolsados y clasificación del producto (reincorporado o merma).
                  </p>
                </div>
              </div>

              <div className="mt-6 pt-4 flex flex-col gap-3 border-t border-outline-variant/15">
                <div className="flex items-center justify-between text-[11px] text-on-surface-variant font-mono">
                  <span>Formato: .CSV / Excel</span>
                  <span>{returns.length} devoluciones</span>
                </div>
                <button
                  type="button"
                  onClick={handleExportReturnsReport}
                  className="w-full py-2.5 px-4 rounded-xl bg-surface neo-raised text-amber-700 text-xs font-bold hover:text-on-surface active:neo-inset transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                >
                  <span className="material-symbols-outlined text-[17px]">assignment_return</span>
                  <span>Exportar Devoluciones</span>
                </button>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ========================================================= */}
      {/* TAB 2: OPCIONES DE RESPALDO */}
      {/* ========================================================= */}
      {activeTab === 'respaldos' && (
        <section className="flex flex-col gap-6 animate-in fade-in duration-200">
          <div className="flex flex-col">
            <h2 className="text-lg font-headline font-bold text-on-surface">
              Copias de Seguridad y Resguardo de Datos
            </h2>
            <span className="text-xs text-on-surface-variant">
              Copia integral del motor relacional SQLite y archivos de respaldo JSON con posibilidad de restauración instantánea.
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Card 1: SQLite Motor */}
            <div className="rounded-2xl bg-surface neo-raised p-6 flex flex-col justify-between">
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
              <div className="mt-4 pt-4 flex flex-col gap-2 border-t border-outline-variant/15">
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

            {/* Card 2: Last Backup Info */}
            <div className="rounded-2xl bg-surface neo-raised p-6 flex flex-col justify-between">
              <div className="flex items-start justify-between">
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
                    Último Resguardo Verificado
                  </span>
                  <span className="text-lg font-bold text-on-surface">{lastBackup.date}</span>
                </div>
                <div className="w-12 h-12 rounded-xl bg-surface neo-inset flex items-center justify-center text-tertiary">
                  <span className="material-symbols-outlined text-[24px]">verified</span>
                </div>
              </div>
              <div className="mt-4 pt-4 flex flex-col gap-2 border-t border-outline-variant/15">
                <div className="flex items-center justify-between text-xs font-medium">
                  <span className="text-on-surface-variant">Hora de verificación:</span>
                  <span className="font-semibold text-on-surface font-mono">{lastBackup.time}</span>
                </div>
                <div className="flex items-center justify-between text-xs font-medium">
                  <span className="text-on-surface-variant">Archivo:</span>
                  <span className="text-on-surface font-mono text-[11px] truncate max-w-[200px]" title={lastBackup.fullPath}>
                    {lastBackup.fileName}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Backup Action Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Create Backup */}
            <div className="rounded-2xl bg-surface neo-raised p-6 flex flex-col justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-primary/10 neo-inset flex items-center justify-center text-primary shrink-0">
                  <span className="material-symbols-outlined text-[26px]">archive</span>
                </div>
                <div className="flex flex-col">
                  <h3 className="font-bold text-base text-on-surface">Crear Copia de Seguridad</h3>
                  <p className="text-xs text-on-surface-variant leading-relaxed mt-1">
                    Empaqueta todos los productos, ventas, movimientos del IPV, arqueos y devoluciones en un archivo seguro en disco.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsBackupModalOpen(true)}
                className="w-full py-2.5 px-4 rounded-xl bg-primary text-white text-xs font-bold shadow hover:bg-primary-container transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[17px]">backup</span>
                <span>Iniciar Respaldo Completo</span>
              </button>
            </div>

            {/* Restore Backup */}
            <div className="rounded-2xl bg-surface neo-raised p-6 flex flex-col justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-tertiary/10 neo-inset flex items-center justify-center text-tertiary shrink-0">
                  <span className="material-symbols-outlined text-[26px]">unarchive</span>
                </div>
                <div className="flex flex-col">
                  <h3 className="font-bold text-base text-on-surface">Restaurar Copia Previa</h3>
                  <p className="text-xs text-on-surface-variant leading-relaxed mt-1">
                    Carga un archivo de respaldo previo (.json) y reconstruye toda la base de datos de forma limpia y transaccional.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsImportModalOpen(true)}
                className="w-full py-2.5 px-4 rounded-xl bg-surface neo-raised text-tertiary text-xs font-bold hover:text-on-surface active:neo-inset transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[17px]">upload_file</span>
                <span>Restaurar desde Archivo</span>
              </button>
            </div>
          </div>
        </section>
      )}

      {/* ========================================================= */}
      {/* TAB 3: SEGURIDAD Y REINICIO DE LA APP */}
      {/* ========================================================= */}
      {activeTab === 'seguridad' && (
        <section className="flex flex-col gap-6 animate-in fade-in duration-200">
          <div className="flex flex-col">
            <h2 className="text-lg font-headline font-bold text-on-surface">
              Seguridad del Sistema y Reinicio de Fábrica
            </h2>
            <span className="text-xs text-on-surface-variant">
              Configure la contraseña de protección y gestione el restablecimiento controlado de la aplicación.
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column: Change Reset Password Form */}
            <div className="lg:col-span-6 rounded-2xl bg-surface neo-raised p-6 flex flex-col justify-between gap-5">
              <div className="flex items-start gap-3.5">
                <div className="w-12 h-12 rounded-xl bg-surface neo-inset flex items-center justify-center text-primary shrink-0">
                  <span className="material-symbols-outlined text-[24px]">lock_reset</span>
                </div>
                <div className="flex flex-col">
                  <h3 className="font-bold text-base text-on-surface">Cambiar Contraseña de Reinicio</h3>
                  <p className="text-xs text-on-surface-variant leading-relaxed mt-0.5">
                    Esta clave autoriza el borrado de datos y reinicio de la aplicación a cero. Por defecto es <code className="font-mono bg-surface-container px-1 py-0.5 rounded text-primary">adminreset</code>.
                  </p>
                </div>
              </div>

              <form onSubmit={handleSaveNewPassword} className="flex flex-col gap-3.5 pt-2">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-on-surface">Contraseña Actual:</label>
                  <input
                    type={showPassFields ? 'text' : 'password'}
                    value={currentPassInput}
                    onChange={(e) => {
                      setCurrentPassInput(e.target.value);
                      setPassError('');
                    }}
                    placeholder="Contraseña actual"
                    className="w-full h-10 px-3 text-xs rounded-xl bg-surface neo-inset text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/40 font-mono"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-on-surface">Nueva Contraseña de Reinicio:</label>
                  <input
                    type={showPassFields ? 'text' : 'password'}
                    value={newPassInput}
                    onChange={(e) => {
                      setNewPassInput(e.target.value);
                      setPassError('');
                    }}
                    placeholder="Mínimo 4 caracteres"
                    className="w-full h-10 px-3 text-xs rounded-xl bg-surface neo-inset text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/40 font-mono"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-on-surface">Confirmar Nueva Contraseña:</label>
                  <input
                    type={showPassFields ? 'text' : 'password'}
                    value={confirmPassInput}
                    onChange={(e) => {
                      setConfirmPassInput(e.target.value);
                      setPassError('');
                    }}
                    placeholder="Repita la nueva contraseña"
                    className="w-full h-10 px-3 text-xs rounded-xl bg-surface neo-inset text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/40 font-mono"
                  />
                </div>

                <div className="flex items-center justify-between text-xs pt-1">
                  <label className="flex items-center gap-2 cursor-pointer text-on-surface-variant">
                    <input
                      type="checkbox"
                      checked={showPassFields}
                      onChange={(e) => setShowPassFields(e.target.checked)}
                      className="rounded"
                    />
                    <span>Mostrar contraseñas</span>
                  </label>
                </div>

                {passError && (
                  <div className="flex items-center gap-1.5 text-xs text-rose-600 font-medium animate-in fade-in">
                    <span className="material-symbols-outlined text-[16px]">error</span>
                    <span>{passError}</span>
                  </div>
                )}

                <button
                  type="submit"
                  className="h-10 px-4 mt-2 rounded-xl bg-primary text-white text-xs font-bold hover:bg-primary-container shadow active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[17px]">save</span>
                  <span>Actualizar Contraseña de Seguridad</span>
                </button>
              </form>
            </div>

            {/* Right Column: Safe Factory Reset Button and Card */}
            <div className="lg:col-span-6 rounded-2xl bg-surface neo-raised p-6 flex flex-col justify-between gap-5 border-l-4 border-rose-500">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-rose-500/10 neo-inset flex items-center justify-center text-rose-600 shrink-0">
                  <span className="material-symbols-outlined text-[28px]">restart_alt</span>
                </div>
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-base text-on-surface">Botón de Reinicio de la App</h3>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-600 uppercase font-mono">
                      Zona Crítica
                    </span>
                  </div>
                  <p className="text-xs text-on-surface-variant leading-relaxed">
                    Borra permanentemente todos los datos almacenados en el catálogo, tickets de venta, movimientos de inventario IPV, arqueos de gaveta y devoluciones para comenzar desde cero.
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-rose-500/5 border border-rose-500/15 text-xs text-rose-800 leading-relaxed flex flex-col gap-2">
                <div className="flex items-center gap-1.5 font-bold text-rose-900">
                  <span className="material-symbols-outlined text-[16px]">warning</span>
                  <span>Acción destructiva e irreversible</span>
                </div>
                <p>
                  Antes de reiniciar, se recomienda generar una copia de seguridad desde la pestaña de Respaldos. Al presionar el botón se solicitará la contraseña de reinicio configurada.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setResetPasswordInput('');
                  setResetError('');
                  setIsResetModalOpen(true);
                }}
                className="w-full h-11 px-5 rounded-xl bg-rose-600 text-white hover:bg-rose-700 active:scale-95 font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md shadow-rose-600/25"
              >
                <span className="material-symbols-outlined text-[18px]">delete_forever</span>
                <span>Restablecer y Reiniciar a Cero</span>
              </button>
            </div>
          </div>
        </section>
      )}

      {/* ========================================================= */}
      {/* TAB 4: ACTIVAR APLICACIÓN (SISTEMA DE LICENCIA) */}
      {/* ========================================================= */}
      {activeTab === 'licencia' && (
        <section className="flex flex-col gap-6 animate-in fade-in duration-200">
          <div className="flex flex-col">
            <h2 className="text-lg font-headline font-bold text-on-surface">
              Licencia de Activación
            </h2>
            <span className="text-xs text-on-surface-variant">
              Gestión de la clave de activación única requerida para desbloquear todas las funciones operativas de FerreStock.
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Status Card */}
            <div className="lg:col-span-5 rounded-2xl bg-surface neo-raised p-6 flex flex-col justify-between gap-6">
              <div className="flex items-start justify-between">
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
                    Estado de la Licencia
                  </span>
                  <div className="flex items-center gap-2 mt-1">
                    <span
                      className={`text-xl font-bold font-headline ${
                        isAppActivated ? 'text-emerald-700' : 'text-rose-700'
                      }`}
                    >
                      {isAppActivated
                        ? 'Licencia válida'
                        : licenseStatus === 'expired'
                          ? 'Licencia vencida · Solo lectura'
                          : licenseStatus === 'clock_rollback'
                            ? 'Corrija la hora del sistema'
                            : licenseStatus === 'invalid'
                              ? 'Licencia no válida'
                              : isTrialActive
                          ? 'Prueba Gratuita Activa'
                          : 'Pendiente de Activación'}
                    </span>
                  </div>
                </div>
                <div
                  className={`w-12 h-12 rounded-xl neo-inset flex items-center justify-center ${
                    isAppActivated || isTrialActive ? 'text-emerald-600' : 'text-rose-600'
                  }`}
                >
                  <span className="material-symbols-outlined text-[28px]">
                    {isAppActivated
                      ? 'verified_user'
                      : licenseStatus === 'clock_rollback'
                        ? 'schedule'
                        : licenseReadOnly
                          ? 'lock'
                          : isTrialActive
                            ? 'hourglass_top'
                            : 'lock'}
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-3 p-4 rounded-xl bg-surface neo-inset text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-on-surface-variant">ID de Instalación:</span>
                  <span className="font-mono font-bold text-primary tracking-wider">{installationId}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-on-surface-variant">Clave Activa:</span>
                  <span className="font-mono font-bold text-on-surface break-all text-right max-w-[65%]">
                    {isAppActivated || licenseReadOnly ? activationKey : 'Ninguna'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-on-surface-variant">Fecha de Activación:</span>
                  <span className="font-mono text-on-surface-variant text-[11px]">
                    {isAppActivated || licenseReadOnly ? activatedAt || 'Registrada' : 'Sin activar'}
                  </span>
                </div>
                {(isAppActivated || licenseReadOnly) && (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-on-surface-variant">Tipo de licencia:</span>
                      <span className="font-mono text-on-surface-variant text-[11px]">{licenseType || '—'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-on-surface-variant">Fecha de vencimiento:</span>
                      <span className="font-mono text-on-surface-variant text-[11px]">
                        {licenseExpiryDate
                          ? new Date(`${licenseExpiryDate}T12:00:00`).toLocaleDateString('es-ES')
                          : '—'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-on-surface-variant">Días restantes:</span>
                      <span className="font-mono text-on-surface-variant text-[11px]">{licenseDaysRemaining}</span>
                    </div>
                  </>
                )}
              </div>

              {isAppActivated ? (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2 text-xs text-emerald-600 font-semibold">
                    <span className="material-symbols-outlined text-[16px]">check_circle</span>
                    <span>Licencia vigente. Todas las funciones están habilitadas.</span>
                  </div>
                  <span className="text-xs text-on-surface-variant">
                    {licenseDaysRemaining} {licenseDaysRemaining === 1 ? 'día restante' : 'días restantes'}.
                  </span>
                </div>
              ) : licenseReadOnly ? (
                <div className="flex items-center gap-2 text-xs text-rose-700 font-semibold">
                  <span className="material-symbols-outlined text-[16px]">
                    {licenseStatus === 'clock_rollback' ? 'schedule' : 'lock'}
                  </span>
                  <span>
                    {licenseStatus === 'clock_rollback'
                      ? 'Corrija la fecha y hora del sistema para reanudar las operaciones.'
                      : 'Solo puede consultar y exportar mientras renueva la licencia.'}
                  </span>
                </div>
              ) : isTrialActive ? (
                <div className="flex items-center gap-2 text-xs text-emerald-700 font-semibold">
                  <span className="material-symbols-outlined text-[16px]">hourglass_top</span>
                  <span>Prueba gratuita: {trialDaysRemaining} {trialDaysRemaining === 1 ? 'día restante' : 'días restantes'}.</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-xs text-rose-600 font-semibold">
                  <span className="material-symbols-outlined text-[16px]">lock</span>
                  <span>La aplicación permanece bloqueada. Ingrese el código a la derecha.</span>
                </div>
              )}
            </div>

            {/* Form Column */}
            <div className="lg:col-span-7 rounded-2xl bg-surface neo-raised p-6 flex flex-col justify-between gap-5">
              <div className="flex flex-col gap-1">
                <h3 className="font-bold text-base text-on-surface">Introducir Código de Activación</h3>
                <p className="text-xs text-on-surface-variant leading-relaxed">
                  Código firmado asociado a este ID de instalación (100–124 caracteres). Se ignoran espacios, guiones y saltos de línea.
                </p>
              </div>

              <form onSubmit={handleInViewActivation} className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-on-surface">Código de activación firmado:</label>
                    <span className="text-[11px] font-mono text-on-surface-variant">
                      {normalizeActivationCode(activationCodeInput).length}
                      {' / 100–124'}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={activationCodeInput}
                      onChange={(e) => {
                        setActivationCodeInput(e.target.value.slice(0, 250));
                        setActivationError('');
                      }}
                      onBlur={() => setActivationCodeInput(formatActivationCode(activationCodeInput))}
                      maxLength={250}
                      autoComplete="off"
                      spellCheck={false}
                      placeholder="PEGUE AQUÍ EL CÓDIGO FIRMADO"
                      className="min-w-0 flex-1 h-12 px-4 text-center font-mono text-sm md:text-base font-bold tracking-[0.12em] uppercase rounded-xl bg-surface neo-inset text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/40 border border-transparent focus:border-primary/30"
                    />
                    <button
                      type="button"
                      onClick={handlePasteActivationCode}
                      className="h-12 px-4 rounded-xl bg-surface neo-raised text-xs font-bold text-on-surface hover:text-primary transition-colors"
                    >
                      Pegar
                    </button>
                  </div>
                  {activationError && (
                    <div className="flex items-center gap-1.5 text-xs text-rose-600 font-medium">
                      <span className="material-symbols-outlined text-[16px]">error</span>
                      <span>{activationError}</span>
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={
                    normalizeActivationCode(activationCodeInput).length < ACTIVATION_CODE_MIN_LENGTH ||
                    normalizeActivationCode(activationCodeInput).length > ACTIVATION_CODE_LENGTH
                  }
                  className={`w-full h-11 rounded-xl text-xs font-bold shadow transition-all flex items-center justify-center gap-2 cursor-pointer ${
                    normalizeActivationCode(activationCodeInput).length >= ACTIVATION_CODE_MIN_LENGTH &&
                    normalizeActivationCode(activationCodeInput).length <= ACTIVATION_CODE_LENGTH
                      ? 'bg-primary text-white shadow-primary/25 hover:bg-primary-container active:scale-[0.99]'
                      : 'bg-surface-container text-on-surface-variant/50 cursor-not-allowed'
                  }`}
                >
                  <span className="material-symbols-outlined text-[18px]">verified</span>
                  <span>Validar Licencia</span>
                </button>
              </form>

              <div className="pt-3 border-t border-outline-variant/15 text-[11px] text-on-surface-variant flex items-center justify-between">
                <span>Firma digital</span>
                <span className="font-mono">FerreStock v1.1.0</span>
              </div>
            </div>
          </div>

        {/* Card de Solicitud de Código y Contacto Directo */}
          <div className="rounded-2xl bg-surface neo-raised p-6 flex flex-col gap-5">
            {/* 
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-outline-variant/15 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/15 neo-inset flex items-center justify-center text-emerald-700 shrink-0">
                  <span className="material-symbols-outlined text-[24px]">support_agent</span>
                </div>
                <div className="flex flex-col">
                  <h3 className="font-bold text-base text-on-surface">
                    Solicitud de Código de Activación y Soporte Directo
                  </h3>
                  <p className="text-xs text-on-surface-variant">
                    Comuníquese directamente para obtener el código firmado válido para esta instalación.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-800 text-[11px] font-bold border border-emerald-500/30 flex items-center gap-1.5 shrink-0">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Atención Activa
                </span>
              </div>
            </div> */}
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Opción 1: WhatsApp Directo 
              <div className="p-5 rounded-xl bg-surface neo-inset flex flex-col justify-between gap-4 border border-emerald-500/20">
                <div className="flex flex-col gap-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-[#25D366] text-white flex items-center justify-center shadow-sm">
                        <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                          <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.816 9.816 0 0 0 12.04 2zm0 18.15c-1.48 0-2.93-.4-4.2-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.16 8.16 0 0 1-1.25-4.38c0-4.54 3.7-8.24 8.24-8.24 2.2 0 4.27.86 5.82 2.42a8.17 8.17 0 0 1 2.41 5.83c0 4.54-3.7 8.23-8.23 8.23zm4.52-6.17c-.25-.12-1.47-.72-1.7-.81-.23-.08-.39-.12-.56.12-.17.25-.64.81-.79.97-.14.17-.29.19-.54.06-.25-.12-1.05-.39-2-1.23-.74-.66-1.24-1.47-1.39-1.72-.14-.25-.02-.38.11-.5.11-.11.25-.29.37-.43.12-.14.17-.25.25-.41.08-.17.04-.31-.02-.43s-.56-1.34-.76-1.84c-.2-.48-.41-.42-.56-.43h-.48c-.17 0-.44.06-.67.31-.23.25-.88.86-.88 2.1 0 1.24.9 2.44 1.03 2.61.12.17 1.78 2.71 4.3 3.8.6.26 1.07.41 1.44.53.61.19 1.16.17 1.6.1.49-.07 1.47-.6 1.68-1.18.21-.58.21-1.07.14-1.18-.06-.12-.22-.19-.47-.31z" />
                        </svg>
                      </div>
                      <span className="font-bold text-sm text-on-surface">Chat Directo de WhatsApp</span>
                    </div>
                  </div>

                  <p className="text-xs text-on-surface-variant leading-relaxed">
                    Haga clic para abrir WhatsApp directamente con el mensaje predeterminado que contiene su ID de instalación:
                  </p>

                  <div className="p-3 rounded-lg bg-surface neo-raised text-xs text-on-surface border border-outline-variant/20 italic">
                    «Hola, solicito el código de activación para FerreStock. Mi ID de instalación es: <strong className="font-mono text-primary not-italic">{installationId}</strong>»
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <a
                    href={`https://wa.me/5363242069?text=${encodeURIComponent(
                      `Hola, solicito el código de activación para FerreStock. Mi ID de instalación es: ${installationId}`
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 py-2.5 px-4 rounded-xl bg-[#25D366] text-white text-xs font-bold hover:brightness-105 active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-sm"
                  >
                    <svg className="w-4 h-4 fill-current shrink-0" viewBox="0 0 24 24">
                      <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.816 9.816 0 0 0 12.04 2zm0 18.15c-1.48 0-2.93-.4-4.2-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.16 8.16 0 0 1-1.25-4.38c0-4.54 3.7-8.24 8.24-8.24 2.2 0 4.27.86 5.82 2.42a8.17 8.17 0 0 1 2.41 5.83c0 4.54-3.7 8.23-8.23 8.23zm4.52-6.17c-.25-.12-1.47-.72-1.7-.81-.23-.08-.39-.12-.56.12-.17.25-.64.81-.79.97-.14.17-.29.19-.54.06-.25-.12-1.05-.39-2-1.23-.74-.66-1.24-1.47-1.39-1.72-.14-.25-.02-.38.11-.5.11-.11.25-.29.37-.43.12-.14.17-.25.25-.41.08-.17.04-.31-.02-.43s-.56-1.34-.76-1.84c-.2-.48-.41-.42-.56-.43h-.48c-.17 0-.44.06-.67.31-.23.25-.88.86-.88 2.1 0 1.24.9 2.44 1.03 2.61.12.17 1.78 2.71 4.3 3.8.6.26 1.07.41 1.44.53.61.19 1.16.17 1.6.1.49-.07 1.47-.6 1.68-1.18.21-.58.21-1.07.14-1.18-.06-.12-.22-.19-.47-.31z" />
                    </svg>
                    <span>WhatsApp</span>
                  </a>

                  <button
                    type="button"
                    onClick={() => {
                      const msg = `Hola, solicito el código de activación para FerreStock. Mi ID de instalación es: ${installationId}`;
                      handleCopyText(msg, 'Mensaje predeterminado');
                    }}
                    className="p-2.5 rounded-xl bg-surface neo-raised hover:text-primary active:neo-inset text-on-surface-variant transition-all cursor-pointer"
                    title="Copiar mensaje predeterminado"
                  >
                    <span className="material-symbols-outlined text-[18px]">content_copy</span>
                  </button>
                </div>
              </div> */}

              {/* Opción 2: Sin WhatsApp en la PC (Información Telefónica Separada) 
              <div className="p-5 rounded-xl bg-surface neo-inset flex flex-col justify-between gap-4 border border-blue-500/20">
                <div className="flex flex-col gap-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-primary text-white flex items-center justify-center shadow-sm">
                        <span className="material-symbols-outlined text-[18px]">phone</span>
                      </div>
                      <span className="font-bold text-sm text-on-surface">
                        ¿No tiene WhatsApp en esta PC?
                      </span>
                    </div>
                    <span className="text-[11px] text-blue-700 font-bold bg-blue-500/15 px-2 py-0.5 rounded-full">
                      Añadir de forma manual
                    </span>
                  </div>

                  <p className="text-xs text-on-surface-variant leading-relaxed">
                    Si está utilizando una computadora sin WhatsApp instalado o web, puede copiar el número y escribir desde el whatsapp de su móvil copiando el texto predeterminado de que aparece al lado del botón de whatsapp.
                  </p>

                  <div className="flex items-center justify-between p-3 rounded-lg bg-surface neo-raised flex-wrap gap-2">
                    <div className="flex flex-col">
                      <span className="text-[10px] uppercase font-bold text-on-surface-variant tracking-wider">
                        Móvil de contacto (WhatsApp):
                      </span>
                      <span className="font-mono text-base font-bold text-on-surface">
                        +53 63242069
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleCopyText('+53 63242069', 'Número de teléfono')}
                        className="px-2.5 py-1.5 rounded-lg bg-surface neo-raised hover:text-primary active:neo-inset text-xs font-bold text-on-surface transition-all flex items-center gap-1 cursor-pointer"
                        title="Copiar número de teléfono"
                      >
                        <span className="material-symbols-outlined text-[15px]">content_copy</span>
                        <span>Copiar</span>
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-outline-variant/15 text-sm text-on-surface-variant">
                  <span>No olvide mencionar en el texto su ID de instalación:</span>
                  <button
                    type="button"
                    onClick={() => handleCopyText(installationId, 'ID de instalación')}
                    className="font-mono font-bold text-primary flex items-center gap-1 cursor-pointer"
                    title="Haga clic para copiar su ID"
                  >
                    <span>{installationId}</span>
                    <span className="material-symbols-outlined text-[14px]">content_copy</span>
                  </button>
                </div>
              </div> */}
            </div>
          </div>               
        </section>
      )}

      {/* ========================================================= */}
      {/* MODAL 1: REALIZAR RESPALDO */}
      {/* ========================================================= */}
      {isBackupModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-2xl bg-surface neo-raised p-6 flex flex-col gap-6 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-primary/10 neo-inset flex items-center justify-center text-primary">
                <span className="material-symbols-outlined text-[26px]">backup</span>
              </div>
              <div className="flex flex-col">
                <h3 className="font-bold text-base text-on-surface">Configurar Copia de Respaldo</h3>
                <span className="text-xs text-on-surface-variant">Se genererá un archivo .json con todas las tablas y transacciones</span>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <span className="text-xs font-semibold text-on-surface">Formato de Exportación:</span>
              <div className="flex flex-col justify-center gap-3">

                <button
                  type="button"
                  onClick={() => setBackupFormat('json')}
                  className={`p-3.5 rounded-xl flex flex-col items-center justify-center gap-1.5 transition-all text-xs font-bold cursor-pointer ${
                    backupFormat === 'json'
                      ? 'bg-surface neo-inset text-primary border border-primary/20'
                      : 'bg-surface neo-raised text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  <span className="material-symbols-outlined text-[22px]">data_object</span>
                  <span>JSON (.json)</span>
                  {backupFormat === 'json' && (
                    <span className="text-[10px] text-primary font-normal">Portabilidad</span>
                  )}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  if (!isBackingUp) setIsBackupModalOpen(false);
                }}
                disabled={isBackingUp}
                className="px-4 py-2 rounded-xl text-xs font-bold text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleStartBackup}
                disabled={isBackingUp}
                className="px-5 py-2.5 rounded-xl bg-primary text-white text-xs font-bold shadow hover:bg-primary-container active:scale-95 transition-all flex items-center gap-2 cursor-pointer"
              >
                {isBackingUp ? (
                  <>
                    <span className="material-symbols-outlined text-[16px] animate-spin">refresh</span>
                    <span>Procesando...</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[17px]">save</span>
                    <span>Guardar Respaldo</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 2: IMPORTAR / RESTAURAR RESPALDO */}
      {/* ========================================================= */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-2xl bg-surface neo-raised p-6 flex flex-col gap-6 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-tertiary/10 neo-inset flex items-center justify-center text-tertiary">
                <span className="material-symbols-outlined text-[26px]">upload_file</span>
              </div>
              <div className="flex flex-col">
                <h3 className="font-bold text-base text-on-surface">Restaurar Copia de Seguridad</h3>
                <span className="text-xs text-on-surface-variant">Recomposición íntegra del sistema</span>
              </div>
            </div>

            <p className="text-xs text-on-surface-variant leading-relaxed">
              Seleccione un archivo de respaldo generado previamente (.json). Se restablecerán todos los productos, ventas y movimientos guardados en la copia.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsImportModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-5 py-2.5 rounded-xl bg-tertiary text-white text-xs font-bold shadow hover:bg-tertiary-container active:scale-95 transition-all flex items-center gap-2 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[17px]">folder_open</span>
                <span>Seleccionar Archivo</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 3: CONFIRMAR RESTABLECIMIENTO A CERO */}
      {/* ========================================================= */}
      {isResetModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-2xl bg-surface neo-raised p-6 flex flex-col gap-5 shadow-2xl border border-rose-500/20">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-xl bg-rose-500/10 neo-inset flex items-center justify-center text-rose-600 shrink-0">
                <span className="material-symbols-outlined text-[28px]">warning</span>
              </div>
              <div className="flex flex-col">
                <h3 className="font-bold text-base text-on-surface">Confirmar Restablecimiento Total</h3>
                <span className="text-xs text-rose-600 font-semibold">Esta acción es irreversible</span>
              </div>
            </div>

            <p className="text-xs text-on-surface-variant leading-relaxed">
              Todos los datos de la terminal serán eliminados permanentemente. Ingrese su contraseña de reinicio para autorizar la operación.
            </p>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-on-surface">Contraseña de Reinicio:</label>
              <div className="relative flex items-center">
                <input
                  type={showResetPassword ? 'text' : 'password'}
                  value={resetPasswordInput}
                  onChange={(e) => {
                    setResetPasswordInput(e.target.value);
                    setResetError('');
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleConfirmReset();
                  }}
                  placeholder="Ingrese la contraseña de seguridad"
                  disabled={isResetting}
                  className="w-full h-11 px-3.5 pr-10 text-xs rounded-xl bg-surface neo-inset text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none focus:ring-2 focus:ring-rose-500/40 font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowResetPassword(!showResetPassword)}
                  className="absolute right-3 text-on-surface-variant hover:text-on-surface"
                >
                  <span className="material-symbols-outlined text-[18px]">
                    {showResetPassword ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>

              {resetError && (
                <div className="flex items-center gap-1.5 text-xs text-rose-600 font-medium">
                  <span className="material-symbols-outlined text-[16px]">error</span>
                  <span>{resetError}</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-outline-variant/15">
              <button
                type="button"
                onClick={() => {
                  if (!isResetting) {
                    setIsResetModalOpen(false);
                    setResetPasswordInput('');
                    setResetError('');
                  }
                }}
                disabled={isResetting}
                className="px-4 py-2 rounded-xl text-xs font-bold text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmReset}
                disabled={isResetting}
                className="px-5 py-2.5 rounded-xl bg-rose-600 text-white text-xs font-bold shadow-md shadow-rose-600/25 hover:bg-rose-700 active:scale-95 transition-all flex items-center gap-2 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[17px]">
                  {isResetting ? 'refresh' : 'delete_forever'}
                </span>
                <span>{isResetting ? 'Restableciendo...' : 'Confirmar y Reiniciar'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
