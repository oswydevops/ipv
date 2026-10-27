'use strict';
const { DomainError } = require('./db.cjs');
const { getResumenDia } = require('../src/main/reports/getResumenDia.js');
const { getReportPaths } = require('../src/main/reports/paths.js');
const { generarPdfCierre } = require('../src/main/reports/pdf.js');
const { generarExcelCierre } = require('../src/main/reports/excel.js');
const { generarExcelIpv } = require('../src/main/reports/ipvExcel.js');
const path = require('path');
const { getTrialStatus } = require('./trial.cjs');
const {
  activationCodeFromPayload,
  normalizeActivationCode,
  validateActivationCode,
  validatePayload,
} = require('./license.cjs');

// Cada canal es "espacio:función". El renderer solo puede llamar a lo que esté aquí.
function buildHandlers(repo, { dialog, getWindow, fs, db, isPackaged = true, trialStatePath }) {
  const getLicenseStatus = () => {
    const clock = repo.observeLicenseDate();
    const record = repo.getLicenseRecord();
    if (!record || !record.payload) {
      return {
        status: 'none',
        hasLicense: false,
        installationId: record?.installation_id || '',
        issueDate: null,
        expiryDate: null,
        daysRemaining: 0,
        licenseType: null,
        activationCode: '',
      };
    }

    const result = validatePayload(
      Buffer.from(record.payload),
      Buffer.from(record.signature || []),
      record.installation_id,
      clock.currentDate
    );
    const code = activationCodeFromPayload(record.payload, record.signature || []);
    if (!result.ok && result.code !== 'LICENSE_EXPIRED') {
      return {
        status: 'invalid',
        hasLicense: true,
        errorCode: result.code,
        installationId: record.installation_id,
        issueDate: null,
        expiryDate: null,
        daysRemaining: 0,
        licenseType: null,
        activationCode: code,
      };
    }

    const status = clock.clockRollback
      ? 'clock_rollback'
      : result.code === 'LICENSE_EXPIRED'
        ? 'expired'
        : 'valid';
    return {
      status,
      hasLicense: true,
      errorCode: clock.clockRollback ? 'CLOCK_ROLLBACK' : result.code || null,
      installationId: record.installation_id,
      issueDate: result.issueDate,
      expiryDate: result.expiryDate,
      daysRemaining: result.daysRemaining,
      licenseType: result.licenseTypeName,
      activationCode: code,
    };
  };

  const assertCanWrite = () => {
    const status = getLicenseStatus();
    if (status.status === 'valid') return;
    if (status.hasLicense) {
      if (status.status === 'clock_rollback') {
        throw new DomainError('CLOCK_ROLLBACK', 'La fecha del sistema es anterior a la última fecha registrada. Corrija la hora del sistema para continuar.');
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
    'license:trialStatus': () => {
      if (!trialStatePath) throw new Error('No se configuró el almacenamiento de la prueba gratuita.');
      return getTrialStatus(trialStatePath);
    },
    'license:activate': (code) => {
      const record = repo.getLicenseRecord();
      const currentStatus = getLicenseStatus();
      if (currentStatus.status === 'clock_rollback') {
        throw new DomainError('CLOCK_ROLLBACK', 'La fecha del sistema es anterior a la última fecha registrada. Corrija la hora antes de activar.');
      }

      const result = validateActivationCode(
        normalizeActivationCode(code),
        record.installation_id,
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