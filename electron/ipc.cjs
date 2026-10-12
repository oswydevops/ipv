'use strict';
const { exec } = require('child_process');
const { DomainError } = require('./db.cjs');

// Cada canal es "espacio:función". El renderer solo puede llamar a lo que esté aquí.
function buildHandlers(repo, { dialog, getWindow, fs }) {
  return {
    'products:list': () => repo.listProducts(),
    'products:create': (input) => repo.createProduct(input),
    'products:update': (id, patch) => repo.updateProduct(id, patch),
    'products:archive': (id) => repo.archiveProduct(id),
    'products:addStock': (id, qty, note) => repo.addStock(id, qty, note),

    'sales:record': (input) => repo.recordSale(input),
    'sales:void': (id) => repo.voidSale(id),
    'sales:listByDate': (date) => repo.listSales(date),
    'sales:listRange': (startDate, endDate) => repo.listSalesRange(startDate, endDate),

    'ipv:getDay': (date) => repo.getIpvDay(date),
    'app:today': () => repo.today(),
    'clock:status': () => repo.clockStatus(),
    'system:openDateSettings': () => {
      if (process.platform === 'win32') {
        exec('control timedate.cpl', (err) => {
          if (err) console.error('[system:openDateSettings]', err);
        });
        return { opened: true };
      }
      return { opened: false };
    },

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