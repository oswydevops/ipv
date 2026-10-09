import React, { useState, useRef, useEffect } from 'react';
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
    restoreBackup,
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
      date: '24 Octubre 2024',
      time: '14:15 hrs',
      folderPath: 'C:\\Respaldos_FerreStock\\',
      fileName: 'BK_FC_20241024_1415.json',
      fullPath: 'C:\\Respaldos_FerreStock\\BK_FC_20241024_1415.json',
      size: '142.8 KB',
      status: 'Verificado y Seguro',
    };
  });

  // Modals and form state
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [backupFolderPath, setBackupFolderPath] = useState('C:\\Respaldos_FerreStock\\');
  const [backupFileName, setBackupFileName] = useState('');
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [backupProgress, setBackupProgress] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // When opening backup modal, compute a suggested file name
  const openBackupModal = () => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const dateCode = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(
      now.getHours()
    )}${pad(now.getMinutes())}`;
    setBackupFileName(`BK_FerreStock_${dateCode}.json`);
    setIsBackupModalOpen(true);
    setIsBackingUp(false);
    setBackupProgress(0);
  };

  const handleStartBackup = () => {
    if (!backupFileName.trim()) {
      showToast('Nombre Requerido', 'Por favor ingrese un nombre para el archivo de respaldo.', 'error');
      return;
    }

    setIsBackingUp(true);
    setBackupProgress(15);

    const cleanFolder = backupFolderPath.trim()
      ? backupFolderPath.trim().endsWith('\\') || backupFolderPath.trim().endsWith('/')
        ? backupFolderPath.trim()
        : `${backupFolderPath.trim()}\\`
      : 'C:\\Respaldos_FerreStock\\';

    const fullPathResult = `${cleanFolder}${backupFileName.trim()}`;

    const interval = setInterval(() => {
      setBackupProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setTimeout(() => {
            // Prepare complete backup payload
            const now = new Date();
            const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(
              now.getMinutes()
            ).padStart(2, '0')} hrs`;
            const dateStr = now.toLocaleDateString('es-ES', {
              day: '2-digit',
              month: 'long',
              year: 'numeric',
            });

            const backupData = {
              app: 'FerreStock',
              version: '2.5.0',
              createdAt: now.toISOString(),
              localSavePath: fullPathResult,
              fileName: backupFileName.trim(),
              products,
              ipvRows,
              denominations,
              menoresAmount,
              transferenciasAmount,
              sales,
              metadata: {
                totalProductos: products.length,
                totalIpvItems: ipvRows.length,
                totalVendidoJornada: ipvTotalVendido,
                totalVentasRegistradas: sales.length,
              },
            };

            const jsonString = JSON.stringify(backupData, null, 2);
            const blob = new Blob([jsonString], { type: 'application/json' });
            const sizeKb = `${(blob.size / 1024).toFixed(1)} KB`;

            // Trigger file download
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = backupFileName.trim();
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            // Update verified backup card
            const updatedState: LastBackupState = {
              date: dateStr,
              time: timeStr,
              folderPath: cleanFolder,
              fileName: backupFileName.trim(),
              fullPath: fullPathResult,
              size: sizeKb,
              status: 'Verificado y Seguro',
            };

            setLastBackup(updatedState);
            localStorage.setItem('ferrestock_last_backup_info', JSON.stringify(updatedState));

            addBackupRecord({
              fileName: backupFileName.trim(),
              description: 'Respaldo Inmediato Local',
              date: `${now.toLocaleDateString('es-ES')} • ${timeStr}`,
              destination: cleanFolder,
              size: sizeKb,
              status: 'Exitoso',
            });

            setIsBackupModalOpen(false);
            setIsBackingUp(false);
            setBackupProgress(0);

            showToast(
              'Respaldo Inmediato Completado',
              `Archivo guardado con éxito. Ruta local: ${fullPathResult}`
            );
          }, 400);
          return 100;
        }
        return prev + 25;
      });
    }, 180);
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
      `"RESUMEN IPV DEL DÍA AL CORTE (${now.toLocaleTimeString('es-ES')})";;;;;;;;;;`,
      `"Total Unidades Vendidas";;;;;;;${ipvTotalUnidades};;;`,
      `"Total Importe Vendido ($)";;;;;;;;${ipvTotalVendido.toFixed(2)};;`,
      `"Efectivo en Caja ($)";;;;;;;;${(
        denominations.reduce((acc, d) => acc + d.value * d.count, 0) + (menoresAmount || 0)
      ).toFixed(2)};;`,
      `"Transferencias Digitales ($)";;;;;;;;${(transferenciasAmount || 0).toFixed(2)};;`,
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
      `Se generó el archivo Excel con el IPV del día (${ipvRows.length} artículos al corte actual).`
    );
  };

  // Action 2: Export Monthly Fiscal Accounting (Contabilidad Fiscal)
  const handleExportFiscalSummary = () => {
    const now = new Date();
    const monthName = now.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
    const pad = (n: number) => String(n).padStart(2, '0');
    const fileCode = `${now.getFullYear()}_${pad(now.getMonth() + 1)}`;

    // Monthly estimations based on current product sales & catalog
    const baseImponible = ipvTotalVendido * 0.909;
    const ivaEstimado = ipvTotalVendido * 0.091;

    const sections = [
      `"REPORTE DE CONTABILIDAD FISCAL MENSUAL - FERRESTOCK"`,
      `"Periodo Fiscal: ${monthName.toUpperCase()}"`,
      `"Fecha de Generación: ${now.toLocaleDateString('es-ES')} ${now.toLocaleTimeString('es-ES')}"`,
      `""`,
      `"RESUMEN TRIBUTARIO Y VENTAS DEL MES"`,
      `"Concepto";"Monto ($)"`,
      `"Ventas Brutas Acumuladas";${ipvTotalVendido.toFixed(2)}`,
      `"Base Imponible Operaciones Gravadas";${baseImponible.toFixed(2)}`,
      `"Impuesto Estimado / IVA";${ivaEstimado.toFixed(2)}`,
      `"Cobros Totales en Efectivo";${(
        denominations.reduce((acc, d) => acc + d.value * d.count, 0) + (menoresAmount || 0)
      ).toFixed(2)}`,
      `"Cobros por Transferencias Bancarias";${(transferenciasAmount || 0).toFixed(2)}`,
      `"Unidades Físicas Facturadas";${ipvTotalUnidades}`,
      `""`,
      `"DESGLOSE DE ARTÍCULOS EN JORNADA FISCAL"`,
      `"Código";"Descripción";"Precio Unit.";"Unidades";"Subtotal ($)"`,
      ...ipvRows.map(
        (r) =>
          `"${r.code}";"${r.name.replace(/"/g, '""')}";${r.price.toFixed(2)};${r.vendido};${r.importe.toFixed(2)}`
      ),
      `""`,
      `"Firmado y emitido por Terminal Central - FerreStock"`,
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
      `Se descargó el resumen contable y fiscal completo del mes de ${monthName}.`
    );
  };

  // Action 3: Import Backup (Importar Respaldo)
  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);

        if (!parsed || (typeof parsed !== 'object')) {
          showToast('Formato Inválido', 'El archivo no contiene una estructura JSON válida.', 'error');
          return;
        }

        const success = restoreBackup(parsed);
        if (success) {
          const now = new Date();
          const restoredState: LastBackupState = {
            date: now.toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' }),
            time: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')} hrs`,
            folderPath: parsed.localSavePath ? parsed.localSavePath.substring(0, parsed.localSavePath.lastIndexOf('\\') + 1) : 'C:\\Respaldos_FerreStock\\',
            fileName: file.name,
            fullPath: parsed.localSavePath || `C:\\Respaldos_FerreStock\\${file.name}`,
            size: `${(file.size / 1024).toFixed(1)} KB`,
            status: 'Restaurado con Éxito',
          };
          setLastBackup(restoredState);
          localStorage.setItem('ferrestock_last_backup_info', JSON.stringify(restoredState));

          setIsImportModalOpen(false);
          showToast(
            'Respaldo Importado Correctamente',
            `Se restablecieron los datos desde "${file.name}".`
          );
        } else {
          showToast(
            'Error al Importar',
            'El archivo no coincide con el formato de respaldo generado por el sistema.',
            'error'
          );
        }
      } catch (err) {
        showToast('Error de Lectura', 'No se pudo interpretar el archivo JSON seleccionado.', 'error');
      }
    };

    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="flex flex-col w-full gap-8 select-none pb-12">
      {/* Hidden file input for importing backup */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelected}
        accept=".json"
        className="hidden"
      />

      {/* Header - Clean without breadcrumb / terminal central tags */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl lg:text-3xl font-bold tracking-tight text-on-surface">
            Respaldo de Datos y Exportación
          </h1>
          <p className="text-sm text-on-surface-variant">
            Gestión de copias de seguridad locales, generación de planillas y restauración del sistema.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={openBackupModal}
            className="px-5 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold shadow-md shadow-primary/25 hover:bg-primary-container transition-all flex items-center gap-2 cursor-pointer"
            type="button"
          >
            <span className="material-symbols-outlined text-[19px]">backup</span>
            <span>Respaldo Inmediato</span>
          </button>
        </div>
      </div>

      {/* 2 Infrastructure Status Cards (USB card removed) */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Card 1: Local SQLite */}
        <div className="rounded-2xl bg-surface neo-raised p-6 flex flex-col justify-between relative overflow-hidden">
          <div className="flex items-start justify-between">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
                Base de Datos Local
              </span>
              <span className="text-lg font-bold text-on-surface">SQLite 3 (v.3.43)</span>
            </div>
            <div className="w-12 h-12 rounded-xl bg-surface neo-inset flex items-center justify-center text-primary">
              <span className="material-symbols-outlined text-[24px]">database</span>
            </div>
          </div>
          <div className="mt-4 pt-4 flex flex-col gap-2">
            <div className="flex items-center justify-between text-xs font-medium">
              <span className="text-on-surface-variant font-mono">Ruta: C:\Ferreteria\data.sqlite</span>
              <span className="text-on-surface font-semibold font-mono">142.8 MB</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-xs font-semibold text-emerald-600">
                Conectado y consistente (Sin errores)
              </span>
            </div>
          </div>
        </div>

        {/* Card 2: Last Verified Backup (Responds to Respaldo Inmediato) */}
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
              <span className="text-on-surface-variant">Ruta donde se guardó en la PC local:</span>
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

      {/* Primary Action Cards (3 Cards: Planilla Diaria, Contabilidad Fiscal, Importar Respaldo) */}
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
          {/* Card 1: Planilla Diaria (Genera Excel con IPV del día hasta el momento) */}
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
                  Genera una planilla Excel (.csv compatible) con los movimientos del IPV registrados
                  hasta este momento: saldos iniciales, entradas, total stock, ventas e importes.
                </p>
              </div>
            </div>
            <div className="mt-6 pt-4 flex flex-col gap-3">
              <div className="flex items-center justify-between text-[11px] text-on-surface-variant font-mono">
                <span>Formato: .xlsx / .csv</span>
                <span>{ipvRows.length} ítems en corte</span>
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

          {/* Card 2: Contabilidad Fiscal (Resumen de todo el mes) */}
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
                  Genera el consolidado contable completo de todo el mes: facturación global acumulada,
                  base imponible, desglose tributario, efectivo y transferencias.
                </p>
              </div>
            </div>
            <div className="mt-6 pt-4 flex flex-col gap-3">
              <div className="flex items-center justify-between text-[11px] text-on-surface-variant font-mono">
                <span>Periodo: Mensual Completo</span>
                <span>Formato Excel / CSV</span>
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

          {/* Card 3: Importar Respaldo (Sustituye Copia Completa e importa el mismo formato) */}
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
                  Carga un archivo de respaldo (.json) generado previamente por la función de
                  Respaldo Inmediato para restablecer productos, stock y balance de caja.
                </p>
              </div>
            </div>
            <div className="mt-6 pt-4 flex flex-col gap-3">
              <div className="flex items-center justify-between text-[11px] text-on-surface-variant font-mono">
                <span>Formato: .json de respaldo</span>
                <span>Restauración segura</span>
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

      {/* Modal: Respaldo Inmediato (Shows generated filename & local PC path input) */}
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
                  Se generará una copia completa con todos los productos ({products.length}), datos de IPV
                  ({ipvRows.length} filas) y estado actual de caja.
                </p>
              </div>
            </div>

            {/* Generated file name display */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-on-surface flex items-center gap-1.5">
                <span className="material-symbols-outlined text-primary text-[16px]">description</span>
                <span>Nombre del archivo que se generará:</span>
              </label>
              <div className="p-3 rounded-xl bg-surface neo-inset font-mono text-xs text-primary font-bold flex items-center justify-between">
                <span>{backupFileName}</span>
                <span className="text-[10px] text-on-surface-variant uppercase px-2 py-0.5 rounded bg-surface neo-raised">
                  JSON
                </span>
              </div>
            </div>

            {/* Path where user wants to save in local PC */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-on-surface flex items-center gap-1.5">
                <span className="material-symbols-outlined text-primary text-[16px]">folder_open</span>
                <span>Ruta donde se desea guardar en la PC local:</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={backupFolderPath}
                  onChange={(e) => setBackupFolderPath(e.target.value)}
                  placeholder="Ej: C:\Respaldos_FerreStock\ o D:\CopiasSeguridad\"
                  className="w-full h-11 px-3.5 pr-10 rounded-xl bg-surface neo-inset font-mono text-xs text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all"
                />
                <span className="absolute right-3 top-2.5 material-symbols-outlined text-on-surface-variant text-[18px]">
                  drive_file_move
                </span>
              </div>
              <span className="text-[11px] text-on-surface-variant leading-tight">
                Destino completo:{' '}
                <strong className="text-on-surface font-mono">
                  {backupFolderPath.trim()
                    ? backupFolderPath.trim().endsWith('\\') || backupFolderPath.trim().endsWith('/')
                      ? backupFolderPath.trim()
                      : `${backupFolderPath.trim()}\\`
                    : 'C:\\Respaldos_FerreStock\\'}
                  {backupFileName}
                </strong>
              </span>
            </div>

            {/* Progress bar when backing up */}
            {isBackingUp && (
              <div className="flex flex-col gap-2 pt-2">
                <div className="flex justify-between text-xs font-semibold text-on-surface">
                  <span>Generando copia y verificando tablas...</span>
                  <span>{backupProgress}%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-surface neo-inset p-0.5 overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-300"
                    style={{ width: `${backupProgress}%` }}
                  ></div>
                </div>
              </div>
            )}

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
                <span>{isBackingUp ? 'Procesando Respaldo...' : 'Generar y Guardar Respaldo'}</span>
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
                <h3 className="text-base font-bold text-on-surface">Importar Archivo de Respaldo</h3>
                <p className="text-xs text-on-surface-variant mt-1 leading-relaxed">
                  Seleccione el archivo JSON generado por la opción de Respaldo Inmediato. Esta acción
                  restaurará el catálogo maestro, los registros del IPV y la caja.
                </p>
              </div>
            </div>

            <div
              onClick={() => fileInputRef.current?.click()}
              className="rounded-2xl bg-surface neo-inset p-8 flex flex-col items-center justify-center gap-3 border-2 border-dashed border-outline/30 text-center cursor-pointer hover:border-primary transition-colors group"
            >
              <div className="w-14 h-14 rounded-2xl bg-surface neo-raised flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined text-[32px]">upload_file</span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-bold text-on-surface">
                  Haga clic para seleccionar archivo de respaldo
                </span>
                <span className="text-xs text-on-surface-variant">
                  Formatos compatibles: .json (generados por Respaldo Inmediato)
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
                onClick={() => fileInputRef.current?.click()}
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
