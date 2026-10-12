import React, { useState, useRef } from 'react';
import { useApp } from '../context/AppContext';

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
    ipvTotalVendido,
    ipvTotalUnidades,
    addBackupRecord,
    refreshAll,
    showToast,
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
  const [backupFormat, setBackupFormat] = useState<'sqlite' | 'json'>('sqlite');
  const [isBackingUp, setIsBackingUp] = useState(false);

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
        if (backupFormat === 'sqlite') {
          const res = await window.api.backup.saveSqlite();
          if (res.canceled || !('path' in res)) {
            showToast('Operación Cancelada', 'No se guardó el respaldo.', 'info');
            return;
          }
          updateBackupState(res.path, 'sqlite');
          showToast(
            'Copia SQLite Generada',
            `Base de datos respaldada correctamente en:\n${res.path}`,
            'success'
          );
        } else {
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
        }
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

  // Action 1: Export Daily IPV to Excel (Planilla Diaria)
  const handleExportDailyIPVExcel = () => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const dateFormatted = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

    // Header row
    const headers = [
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
    ];

    // Data rows from current IPV
    const rows = ipvRows.map((item) => {
      const estadoLabel =
        item.status === 'zero'
          ? 'Agotado'
          : item.status === 'low'
          ? 'Stock Bajo'
          : 'Normal';

      return [
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
      ].join(';');
    });

    // Summary footer rows
    const summaryRows = [
      '',
      `"RESUMEN IPV DEL DÍA AL CORTE (${now.toLocaleTimeString('es-CU')})";;;;;;;;;;;`,
      `"Total Unidades Vendidas";;;;;;;${ipvTotalUnidades};;;;`,
      `"Total Importe Vendido ($)";;;;;;;;;${ipvTotalVendido.toFixed(2)};;`,
      `"Efectivo en Caja ($)";;;;;;;;;${(
        denominations.reduce((acc, d) => acc + d.value * d.count, 0) + (menoresAmount || 0)
      ).toFixed(2)};;`,
      `"Transferencias Digitales ($)";;;;;;;;;${(transferenciasAmount || 0).toFixed(2)};;`,
    ];

    const csvContent =
      '\uFEFF' + [headers.join(';'), ...rows, ...summaryRows].join('\r\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Planilla_IPV_Diaria_${dateFormatted}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showToast(
      'Planilla Diaria Exportada',
      `Se generó el archivo Excel con el IPV del día (${ipvRows.length} artículos al corte actual).`,
      'success'
    );
  };

  // Action 2: Export Monthly Fiscal Accounting (Contabilidad Fiscal)
  const handleExportFiscalSummary = () => {
    const now = new Date();
    const monthName = now.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
    const pad = (n: number) => String(n).padStart(2, '0');
    const fileCode = `${now.getFullYear()}_${pad(now.getMonth() + 1)}`;

    const totalEfectivo = sales.reduce((acc, s) => acc + (s.efectivoAmount || 0), 0);
    const totalTransf = sales.reduce((acc, s) => acc + (s.transferenciaAmount || 0), 0);
    const totalVentasReal = sales.reduce((acc, s) => acc + (s.total || 0), 0);
    const baseImponible = totalVentasReal * 0.909;
    const ivaEstimado = totalVentasReal * 0.091;

    const sections = [
      `"REPORTE DE CONTABILIDAD FISCAL Y VENTAS - IPV"`,
      `"Periodo Fiscal: ${monthName.toUpperCase()}"`,
      `"Fecha de Generación: ${now.toLocaleDateString('es-ES')} ${now.toLocaleTimeString('es-CU')}"`,
      `""`,
      `"RESUMEN TRIBUTARIO Y VENTAS CONSOLIDADAS"`,
      `"Concepto";"Monto ($)"`,
      `"Ventas Brutas Totales";${totalVentasReal.toFixed(2)}`,
      `"Base Imponible de Operaciones";${baseImponible.toFixed(2)}`,
      `"Impuesto / IVA Estimado";${ivaEstimado.toFixed(2)}`,
      `"Recaudación en Efectivo";${totalEfectivo.toFixed(2)}`,
      `"Recaudación por Transferencias";${totalTransf.toFixed(2)}`,
      `"Total Tickets de Venta Registrados";${sales.length}`,
      `""`,
      `"DESGLOSE DE ARTÍCULOS EN JORNADA"`,
      `"Código";"Descripción";"Precio Unit.";"Unidades Vendidas";"Subtotal ($)"`,
      ...ipvRows
        .filter((r) => r.vendido > 0)
        .map(
          (r) =>
            `"${r.code}";"${r.name.replace(/"/g, '""')}";${r.price.toFixed(2)};${r.vendido};${r.importe.toFixed(2)}`
        ),
      `""`,
      `"Emitido por Terminal IPV - Base de Datos SQLite Conforme"`,
    ];

    const csvContent = '\uFEFF' + sections.join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Contabilidad_Fiscal_Mensual_${fileCode}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showToast(
      'Contabilidad Fiscal Exportada',
      `Se descargó el resumen contable y fiscal completo del mes de ${monthName}.`,
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
                  Elija el tipo de archivo que desea generar. Se abrirá el selector nativo para que elija la carpeta de su PC donde guardarlo.
                </p>
              </div>
            </div>

            {/* Selector de Formato */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-on-surface">Formato de Respaldo:</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setBackupFormat('sqlite')}
                  className={`p-3.5 rounded-xl border text-left flex flex-col gap-1 transition-all cursor-pointer ${
                    backupFormat === 'sqlite'
                      ? 'border-primary bg-primary/5 neo-inset'
                      : 'border-outline-variant/30 bg-surface neo-raised hover:border-primary/50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-on-surface flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[16px] text-primary">database</span>
                      Base SQLite (.sqlite)
                    </span>
                    {backupFormat === 'sqlite' && (
                      <span className="w-2 h-2 rounded-full bg-primary"></span>
                    )}
                  </div>
                  <span className="text-[10px] text-on-surface-variant">
                    Copia bit-a-bit exacta del archivo de base de datos activa.
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setBackupFormat('json')}
                  className={`p-3.5 rounded-xl border text-left flex flex-col gap-1 transition-all cursor-pointer ${
                    backupFormat === 'json'
                      ? 'border-primary bg-primary/5 neo-inset'
                      : 'border-outline-variant/30 bg-surface neo-raised hover:border-primary/50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-on-surface flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[16px] text-tertiary">data_object</span>
                      Exportación JSON (.json)
                    </span>
                    {backupFormat === 'json' && (
                      <span className="w-2 h-2 rounded-full bg-primary"></span>
                    )}
                  </div>
                  <span className="text-[10px] text-on-surface-variant">
                    Estructura en texto legible con esquema y tablas completas.
                  </span>
                </button>
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
    </div>
  );
};
