'use strict';
const { DomainError } = require('./db.cjs');
const { getResumenDia } = require('../src/main/reports/getResumenDia.js');
const { getReportPaths } = require('../src/main/reports/paths.js');
const { generarPdfCierre } = require('../src/main/reports/pdf.js');
const { generarExcelCierre } = require('../src/main/reports/excel.js');
const { generarExcelIpv } = require('../src/main/reports/ipvExcel.js');
const path = require('path');

// Cada canal es "espacio:función". El renderer solo puede llamar a lo que esté aquí.
function buildHandlers(repo, { dialog, getWindow, fs, db }) {
  return {
    'products:list': () => repo.listProducts(),
    'products:create': (input) => repo.createProduct(input),
    'products:update': (id, patch) => repo.updateProduct(id, patch),
    'products:archive': (id) => repo.archiveProduct(id),
    'products:addStock': (id, qty, note) => repo.addStock(id, qty, note),
    'products:reponerStock': (id, qty) => repo.reponerStock(id, qty),

    'sales:record': (input) => repo.recordSale(input),
    'sales:void': (id) => repo.voidSale(id),
    'sales:listByDate': (date) => repo.listSales(date),
    'sales:listRange': (startDate, endDate) => repo.listSalesRange(startDate, endDate),

    'returns:record': (input) => repo.recordReturn(input),
    'returns:list': () => repo.listReturns(),

    'ipv:getDay': (date) => repo.getIpvDay(date),
    'app:today': () => repo.today(),

    'cash:getClose': (date) => repo.getClose(date),
    'cash:listCloses': (limit) => repo.listCloses(limit),
    'cash:closeDay': (date, input) => repo.closeDay(date, input),
    'cash:reopenDay': (date) => repo.reopenDay(date),

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
    'backup:resetApplication': (password) => {
      if (typeof password !== 'string' || password !== 'adminreset') {
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
}

// Respuesta uniforme {ok,data} | {ok:false,error:{code,message}}:
// Electron pierde las propiedades de los Error que cruzan IPC, así que
// el código de error viaja en el sobre.
function register(ipcMain, handlers) {
  for (const [channel, fn] of Object.entries(handlers)) {
    ipcMain.handle(channel, async (_event, ...args) => {
      try {
        return { ok: true, data: await fn(...args) };
      } catch (e) {
        if (e instanceof DomainError) return { ok: false, error: { code: e.code, message: e.message } };
        console.error(`[ipc ${channel}]`, e);
        return { ok: false, error: { code: 'INTERNAL', message: 'Error interno al acceder a la base de datos.' } };
      }
    });
  }
}

module.exports = { buildHandlers, register };