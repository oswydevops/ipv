'use strict';
const { DomainError } = require('./db.cjs');
const { getResumenDia } = require('../src/main/reports/getResumenDia.js');
const { getReportPaths } = require('../src/main/reports/paths.js');
const { generarPdfCierre } = require('../src/main/reports/pdf.js');
const { generarExcelCierre } = require('../src/main/reports/excel.js');
const { generarExcelIpv } = require('../src/main/reports/ipvExcel.js');
const { buildReportHtml, parseDelimitedText } = require('./reportExport.cjs');
const path = require('path');
const { getTrialLastSeenDate, getTrialStatus } = require('./trial.cjs');
const {
  activationCodeFromPayload,
  normalizeActivationCode,
  validateActivationCode,
  validatePayload,
} = require('./license.cjs');

// Cada canal es "espacio:función". El renderer solo puede llamar a lo que esté aquí.
function buildHandlers(repo, { dialog, getWindow, fs, db, isPackaged = true, trialStatePath }) {
  const clockRollbackMessage = (clock) =>
    `Corrija fecha y hora; última fecha registrada: ${clock.lastSeenDate || clock.currentDate}.`;
  const getTrialClockAnchor = () =>
    trialStatePath ? getTrialLastSeenDate(trialStatePath) : null;
  const getLicenseStatus = () => {
    const clock = repo.observeLicenseDate(getTrialClockAnchor());
    const record = repo.getLicenseRecord();
    const hasLicense = Boolean(record && record.payload);
    if (hasLicense && !repo.installationMatches(record.installation_id)) {
      return {
        status: 'invalid',
        hasLicense: true,
        errorCode: 'INSTALLATION_MISMATCH',
        installationId: repo.getInstallationIdentity().installationId,
        issueDate: null,
        expiryDate: null,
        daysRemaining: 0,
        isLifetime: false,
        licenseType: null,
        activationCode: '',
        lastSeenDate: clock.lastSeenDate,
      };
    }
    if (clock.clockRollback) {
      return {
        status: 'clock_rollback',
        hasLicense,
        errorCode: 'CLOCK_ROLLBACK',
        installationId: repo.getInstallationIdentity().installationId,
        issueDate: null,
        expiryDate: null,
        daysRemaining: 0,
        isLifetime: false,
        licenseType: null,
        activationCode: '',
        lastSeenDate: clock.lastSeenDate,
      };
    }
    if (!record || !record.payload) {
      return {
        status: 'none',
        hasLicense: false,
        installationId: repo.getInstallationIdentity().installationId,
        issueDate: null,
        expiryDate: null,
        daysRemaining: 0,
        isLifetime: false,
        licenseType: null,
        activationCode: '',
        lastSeenDate: clock.lastSeenDate,
      };
    }

    const result = validatePayload(
      Buffer.from(record.payload),
      Buffer.from(record.signature || []),
      repo.getInstallationIdentity(),
      clock.currentDate
    );
    const code = activationCodeFromPayload(record.payload, record.signature || []);
    if (!result.ok && result.code !== 'LICENSE_EXPIRED') {
      return {
        status: 'invalid',
        hasLicense: true,
        errorCode: result.code,
        installationId: repo.getInstallationIdentity().installationId,
        issueDate: null,
        expiryDate: null,
        daysRemaining: 0,
        isLifetime: false,
        licenseType: null,
        activationCode: code,
        lastSeenDate: clock.lastSeenDate,
      };
    }

    const status = result.code === 'LICENSE_EXPIRED' ? 'expired' : 'valid';
    return {
      status,
      hasLicense: true,
      errorCode: result.code || null,
      installationId: repo.getInstallationIdentity().installationId,
      issueDate: result.issueDate,
      expiryDate: result.expiryDate,
      daysRemaining: result.daysRemaining,
      isLifetime: result.isLifetime,
      licenseType: result.licenseTypeName,
      activationCode: code,
      lastSeenDate: clock.lastSeenDate,
    };
  };

  const assertCanWrite = () => {
    const status = getLicenseStatus();
    if (status.status === 'valid') return;
    if (status.status === 'clock_rollback') {
      throw new DomainError('CLOCK_ROLLBACK', clockRollbackMessage({
        lastSeenDate: status.lastSeenDate,
        currentDate: repo.today(),
      }));
    }
    if (status.hasLicense) {
      if (status.errorCode === 'INSTALLATION_MISMATCH') {
        throw new DomainError('INSTALLATION_MISMATCH', 'La licencia no corresponde a esta instalación. Active una licencia emitida para este equipo.');
      }
      if (status.status === 'expired') {
        throw new DomainError('LICENSE_EXPIRED', 'La licencia venció. FerreStock permanece en modo de solo lectura hasta renovar la licencia.');
      }
      throw new DomainError('INVALID_SIGNATURE', 'La licencia guardada no es válida. Active una licencia firmada correctamente.');
    }

    if (trialStatePath && getTrialStatus(trialStatePath).isActive) return;
    throw new DomainError('LICENSE_REQUIRED', 'Se requiere una licencia válida para realizar cambios.');
  };

  const handlers = {
    'license:status': () => getLicenseStatus(),
    'license:deactivate': () => {
      repo.clearLicense();
      return getLicenseStatus();
    },
    'license:trialStatus': () => {
      if (!trialStatePath) throw new Error('No se configuró el almacenamiento de la prueba gratuita.');
      return getTrialStatus(trialStatePath);
    },
    'license:activate': (code) => {
      const record = repo.getLicenseRecord();
      const activationClock = repo.observeLicenseDate(getTrialClockAnchor());
      if (activationClock.clockRollback) {
        throw new DomainError('CLOCK_ROLLBACK', clockRollbackMessage(activationClock));
      }
      const currentStatus = getLicenseStatus();
      if (currentStatus.status === 'clock_rollback') {
        throw new DomainError('CLOCK_ROLLBACK', clockRollbackMessage(activationClock));
      }
      if (!repo.installationMatches(record.installation_id)) {
        throw new DomainError('INSTALLATION_MISMATCH', 'La instalación no coincide con la licencia guardada.');
      }

      const result = validateActivationCode(
        normalizeActivationCode(code),
        repo.getInstallationIdentity(),
        repo.today()
      );
      if (!result.ok) {
        const messages = {
          INVALID_SIGNATURE: 'La firma del código es inválida.',
          INSTALLATION_MISMATCH: 'El código pertenece a un ID de instalación distinto.',
          LICENSE_EXPIRED: 'El código de licencia está vencido.',
          INVALID_CODE: 'El código firmado tiene una versión o contenido no válido.',
        };
        throw new DomainError(result.code, messages[result.code] || 'El código de activación no es válido.');
      }

      if (currentStatus.hasLicense && currentStatus.issueDate && result.issueDate <= currentStatus.issueDate) {
        throw new DomainError('LICENSE_ALREADY_USED', 'El código ya fue usado o su fecha de emisión no es posterior a la licencia actual.');
      }
      repo.saveLicense(result.payload, result.signature, result.issueDate);
      return getLicenseStatus();
    },
    'products:list': () => repo.listProducts(),
    'products:create': (input) => repo.createProduct(input),
    'products:update': (id, patch) => repo.updateProduct(id, patch),
    'products:archive': (id) => repo.archiveProduct(id),
    'products:delete': (id) => repo.deleteProduct(id),
    'products:addStock': (id, qty, note) => repo.addStock(id, qty, note),
    'products:reponerStock': (id, qty) => repo.reponerStock(id, qty),

    'sales:record': (input) => repo.recordSale(input),
    'sales:void': (id) => repo.voidSale(id),
    'sales:listByDate': (date) => repo.listSales(date),
    'sales:listRange': (startDate, endDate) => repo.listSalesRange(startDate, endDate),

    'returns:record': (input) => repo.recordReturn(input),
    'returns:list': () => repo.listReturns(),
    'mermas:list': () => repo.listMermas(),
    'mermas:venderConDescuento': (id, price, note) => repo.venderMermaConDescuento(id, price, note),
    'mermas:enviarAlmacen': (id, note) => repo.enviarMermaAlmacen(id, note),
    'mermas:enviarAStock': (id, note) => repo.enviarMermaAStock(id, note),
    'mermas:darDeBaja': (id, note) => repo.darDeBajaMerma(id, note),
    'mermas:revocar': (id) => repo.revocarMerma(id),

    'ipv:getDay': (date) => repo.getIpvDay(date),
    'app:today': () => repo.today(),

    'cash:getClose': (date) => repo.getClose(date),
    'cash:listCloses': (limit) => repo.listCloses(limit),
    'cash:closeDay': (date, input) => repo.closeDay(date, input),
    'cash:reopenDay': (date) => repo.reopenDay(date),

    'files:save': async (input) => {
      if (
        !input ||
        typeof input.contentBase64 !== 'string' ||
        !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(input.contentBase64) ||
        typeof input.suggestedName !== 'string' ||
        typeof input.extension !== 'string' ||
        !/^[a-zA-Z0-9]+$/.test(input.extension) ||
        typeof input.description !== 'string'
      ) {
        throw new DomainError('INVALID', 'Los datos del archivo para exportar no son válidos.');
      }

      const extension = input.extension.toLowerCase();
      const suggestedName = path.basename(input.suggestedName);
      const saveResult = await dialog.showSaveDialog(getWindow(), {
        title: `Guardar ${input.description}`,
        defaultPath: suggestedName,
        filters: [{ name: input.description, extensions: [extension] }],
      });
      if (saveResult.canceled || !saveResult.filePath) return { canceled: true };

      fs.writeFileSync(saveResult.filePath, Buffer.from(input.contentBase64, 'base64'));
      return { canceled: false, path: saveResult.filePath };
    },

    // Respaldo a archivo: el diálogo se abre en el proceso principal.
    'backup:saveSqlite': async () => {
      const r = await dialog.showSaveDialog(getWindow(), {
        title: 'Guardar copia de la base de datos',
        defaultPath: `ipv-respaldo-${repo.today()}.sqlite`,
        filters: [{ name: 'SQLite', extensions: ['sqlite'] }],
      });
      if (r.canceled || !r.filePath) return { canceled: true };
      await repo.backupTo(r.filePath);
      return { canceled: false, path: r.filePath };
    },
    'backup:saveJson': async () => {
      const r = await dialog.showSaveDialog(getWindow(), {
        title: 'Exportar respaldo (JSON)',
        defaultPath: `ipv-respaldo-${repo.today()}.json`,
        filters: [{ name: 'JSON', extensions: ['json'] }],
      });
      if (r.canceled || !r.filePath) return { canceled: true };
      fs.writeFileSync(r.filePath, JSON.stringify(repo.exportAll()), 'utf8');
      return { canceled: false, path: r.filePath };
    },
    'backup:restoreJson': async () => {
      const r = await dialog.showOpenDialog(getWindow(), {
        title: 'Restaurar respaldo (JSON)',
        properties: ['openFile'],
        filters: [{ name: 'JSON', extensions: ['json'] }],
      });
      if (r.canceled || !r.filePaths[0]) return { canceled: true };
      let data;
      try {
        data = JSON.parse(fs.readFileSync(r.filePaths[0], 'utf8'));
      } catch {
        throw new DomainError('BAD_BACKUP', 'El archivo no es un JSON válido.');
      }
      return { canceled: false, ...repo.restoreAll(data) };
    },
    'backup:resetApplication': async (password, event) => {
      const configuredPassword = event?.sender?.executeJavaScript
        ? await event.sender.executeJavaScript(
            `window.localStorage.getItem('ferrestock_reset_password') || 'adminreset'`
          )
        : 'adminreset';
      if (
        typeof password !== 'string' ||
        typeof configuredPassword !== 'string' ||
        password.trim() !== configuredPassword.trim()
      ) {
        throw new DomainError('INVALID', 'Contraseña incorrecta.');
      }
      return repo.resetAll();
    },

    // Exportación de Reportes de Cierre (PDF y Excel)
    'reportes:exportar-cierre': async (fecha) => {
      const targetDate = fecha || repo.today();
      const resumen = getResumenDia(targetDate, db);
      const paths = getReportPaths(targetDate);
      await generarPdfCierre(resumen, paths.pdfPath);
      await generarExcelCierre(resumen, paths.excelPath);
      return {
        ok: true,
        fecha: targetDate,
        pdfPath: paths.pdfPath,
        excelPath: paths.excelPath,
        directory: paths.directory,
      };
    },
    'reportes:exportar-cierre-excel': async (fecha) => {
      const targetDate = fecha || repo.today();
      const resumen = getResumenDia(targetDate, db);
      const paths = getReportPaths(targetDate);
      const saveResult = await dialog.showSaveDialog(getWindow(), {
        title: 'Guardar reporte de cierre en Excel',
        defaultPath: paths.excelPath,
        filters: [{ name: 'Libro de Excel', extensions: ['xlsx'] }],
      });
      if (saveResult.canceled || !saveResult.filePath) {
        return { canceled: true };
      }
      const excelPath = await generarExcelCierre(resumen, saveResult.filePath);
      return {
        canceled: false,
        ok: true,
        fecha: targetDate,
        excelPath,
      };
    },
    'reportes:exportar-cierre-formato': async (input) => {
      if (!input || !['excel', 'pdf'].includes(input.format)) {
        throw new DomainError('INVALID', 'Seleccione Excel o PDF para guardar el reporte.');
      }
      const targetDate = input.date || repo.today();
      const resumen = getResumenDia(targetDate, db);
      const paths = getReportPaths(targetDate);
      const format = input.format;
      const extension = format === 'excel' ? 'xlsx' : 'pdf';
      const saveResult = await dialog.showSaveDialog(getWindow(), {
        title: `Guardar cierre de caja en ${format === 'excel' ? 'Excel' : 'PDF'}`,
        defaultPath: format === 'excel' ? paths.excelPath : paths.pdfPath,
        filters: [{
          name: format === 'excel' ? 'Libro de Excel' : 'Documento PDF',
          extensions: [extension],
        }],
      });
      if (saveResult.canceled || !saveResult.filePath) return { canceled: true };
      const outputPath = path.extname(saveResult.filePath).toLowerCase() === `.${extension}`
        ? saveResult.filePath
        : `${saveResult.filePath}.${extension}`;
      const savedPath = format === 'excel'
        ? await generarExcelCierre(resumen, outputPath)
        : await generarPdfCierre(resumen, outputPath);
      return { canceled: false, path: savedPath, fecha: targetDate, format };
    },
    'reportes:exportar-tabla': async (input) => {
      if (
        !input ||
        typeof input.title !== 'string' ||
        typeof input.fileName !== 'string' ||
        typeof input.csvContent !== 'string' ||
        !['excel', 'pdf'].includes(input.format) ||
        ![',', ';'].includes(input.delimiter || ';') ||
        input.csvContent.length > 20 * 1024 * 1024
      ) {
        throw new DomainError('INVALID', 'No se pudieron preparar los datos del reporte.');
      }

      const format = input.format;
      const extension = format === 'excel' ? 'xlsx' : 'pdf';
      const fileName = path.basename(input.fileName, path.extname(input.fileName));
      const saveResult = await dialog.showSaveDialog(getWindow(), {
        title: `Guardar reporte en ${format === 'excel' ? 'Excel' : 'PDF'}`,
        defaultPath: `${fileName}.${extension}`,
        filters: [{
          name: format === 'excel' ? 'Libro de Excel' : 'Documento PDF',
          extensions: [extension],
        }],
      });
      if (saveResult.canceled || !saveResult.filePath) return { canceled: true };

      const outputPath = path.extname(saveResult.filePath).toLowerCase() === `.${extension}`
        ? saveResult.filePath
        : `${saveResult.filePath}.${extension}`;
      const rows = parseDelimitedText(input.csvContent, input.delimiter || ';');

      if (format === 'excel') {
        const ExcelJS = require('exceljs');
        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'FerreStock';
        workbook.created = new Date();
        const sheet = workbook.addWorksheet('Reporte', {
          views: [{ state: 'frozen', ySplit: 1 }],
          pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
        });
        const columnCount = Math.max(1, ...rows.map((row) => row.length));
        sheet.columns = Array.from({ length: columnCount }, (_, index) => {
          const width = Math.min(42, Math.max(12, ...rows.map((row) => String(row[index] || '').length + 2)));
          return { width };
        });
        rows.forEach((row, index) => {
          const excelRow = sheet.addRow(row);
          if (index === 0) {
            excelRow.font = { bold: true, size: 15, color: { argb: 'FFFFFFFF' } };
            excelRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
          } else if (row.filter((cell) => cell !== '').length === 1) {
            excelRow.font = { bold: true, color: { argb: 'FF0F172A' } };
            excelRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
          } else if (index > 0 && rows[index - 1].filter((cell) => cell !== '').length === 1) {
            excelRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
            excelRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF334155' } };
          }
          excelRow.eachCell((cell) => {
            cell.alignment = { vertical: 'top', wrapText: true };
            cell.border = {
              bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            };
          });
        });
        await workbook.xlsx.writeFile(outputPath);
      } else {
        const { BrowserWindow } = require('electron');
        const printWindow = new BrowserWindow({
          show: false,
          width: 1400,
          height: 1000,
          webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: true,
          },
        });
        try {
          const html = buildReportHtml({
            title: input.title,
            csvContent: input.csvContent,
            delimiter: input.delimiter || ';',
          });
          await printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
          const pdf = await printWindow.webContents.printToPDF({
            marginsType: 0,
            printBackground: true,
            pageSize: 'A4',
            landscape: true,
          });
          fs.writeFileSync(outputPath, pdf);
        } finally {
          if (!printWindow.isDestroyed()) printWindow.destroy();
        }
      }
      return { canceled: false, path: outputPath };
    },
    'reportes:exportar-ipv-excel': async (input) => {
      if (!input || !/^\d{4}-\d{2}-\d{2}$/.test(input.date || '')) {
        throw new Error('Fecha inválida para exportar el reporte IPV.');
      }
      if (!Array.isArray(input.columns) || !Array.isArray(input.rows) || !Array.isArray(input.returns)) {
        throw new Error('Faltan datos para generar el reporte IPV en Excel.');
      }

      const paths = getReportPaths(input.date);
      const filename = path.basename(String(input.fileName || `Reporte_IPV_${input.date}.xlsx`));
      const saveResult = await dialog.showSaveDialog(getWindow(), {
        title: 'Guardar reporte IPV en Excel',
        defaultPath: path.join(paths.directory, filename),
        filters: [{ name: 'Libro de Excel', extensions: ['xlsx'] }],
      });
      if (saveResult.canceled || !saveResult.filePath) {
        return { canceled: true };
      }

      const excelPath = path.extname(saveResult.filePath).toLowerCase() === '.xlsx'
        ? saveResult.filePath
        : `${saveResult.filePath}.xlsx`;
      await generarExcelIpv(input, excelPath);
      return { canceled: false, excelPath };
    },
  };

  const writeChannels = new Set([
    'products:create',
    'products:update',
    'products:archive',
    'products:delete',
    'products:addStock',
    'products:reponerStock',
    'sales:record',
    'sales:void',
    'returns:record',
    'mermas:venderConDescuento',
    'mermas:enviarAlmacen',
    'mermas:enviarAStock',
    'mermas:darDeBaja',
    'mermas:revocar',
    'cash:closeDay',
    'cash:reopenDay',
    'backup:restoreJson',
    'backup:resetApplication',
  ]);
  return Object.fromEntries(
    Object.entries(handlers).map(([channel, handler]) => [
      channel,
      writeChannels.has(channel)
        ? (...args) => {
            assertCanWrite();
            return handler(...args);
          }
        : handler,
    ])
  );
}

// Respuesta uniforme {ok,data} | {ok:false,error:{code,message}}:
// Electron pierde las propiedades de los Error que cruzan IPC, así que
// el código de error viaja en el sobre.
function register(ipcMain, handlers) {
  for (const [channel, fn] of Object.entries(handlers)) {
    ipcMain.handle(channel, async (event, ...args) => {
      try {
        return { ok: true, data: await fn(...args, event) };
      } catch (e) {
        if (e instanceof DomainError) return { ok: false, error: { code: e.code, message: e.message } };
        console.error(`[ipc ${channel}]`, e);
        return { ok: false, error: { code: 'INTERNAL', message: 'Error interno al acceder a la base de datos.' } };
      }
    });
  }
}

module.exports = { buildHandlers, register };