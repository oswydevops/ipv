'use strict';
const { contextBridge, ipcRenderer } = require('electron');

const call = async (channel, ...args) => {
  const res = await ipcRenderer.invoke(channel, ...args);
  if (res && res.ok) return res.data;
  const err = new Error((res && res.error && res.error.message) || 'Error desconocido');
  err.code = (res && res.error && res.error.code) || 'INTERNAL';
  throw err;
};

contextBridge.exposeInMainWorld('api', {
  today: () => call('app:today'),
  files: {
    save: (input) => call('files:save', input),
  },
  license: {
    status: () => call('license:status'),
    activate: (code) => call('license:activate', code),
    trialStatus: () => call('license:trialStatus'),
  },
  products: {
    list: () => call('products:list'),
    create: (input) => call('products:create', input),
    update: (id, patch) => call('products:update', id, patch),
    archive: (id) => call('products:archive', id),
    delete: (id) => call('products:delete', id),
    addStock: (id, qty, note) => call('products:addStock', id, qty, note),
    reponerStock: (id, qty) => call('products:reponerStock', id, qty),
  },
  sales: {
    record: (input) => call('sales:record', input),
    void: (id) => call('sales:void', id),
    listByDate: (date) => call('sales:listByDate', date),
    listRange: (startDate, endDate) => call('sales:listRange', startDate, endDate),
  },
  returns: {
    record: (input) => call('returns:record', input),
    list: () => call('returns:list'),
  },
  mermas: {
    list: () => call('mermas:list'),
    venderConDescuento: (id, price, note) => call('mermas:venderConDescuento', id, price, note),
    enviarAlmacen: (id, note) => call('mermas:enviarAlmacen', id, note),
    enviarAStock: (id, note) => call('mermas:enviarAStock', id, note),
    darDeBaja: (id, note) => call('mermas:darDeBaja', id, note),
    revocar: (id) => call('mermas:revocar', id),
  },
  ipv: { getDay: (date) => call('ipv:getDay', date) },
  cash: {
    getClose: (date) => call('cash:getClose', date),
    listCloses: (limit) => call('cash:listCloses', limit),
    closeDay: (date, input) => call('cash:closeDay', date, input),
    reopenDay: (date) => call('cash:reopenDay', date),
  },
  backup: {
    saveSqlite: () => call('backup:saveSqlite'),
    saveJson: () => call('backup:saveJson'),
    restoreJson: () => call('backup:restoreJson'),
    resetApplication: (password) => call('backup:resetApplication', password),
  },
  reports: {
    exportarCierre: (fecha) => call('reportes:exportar-cierre', fecha),
    exportarCierreExcel: (fecha) => call('reportes:exportar-cierre-excel', fecha),
    exportarIpvExcel: (input) => call('reportes:exportar-ipv-excel', input),
  },
  exportarCierre: (fecha) => call('reportes:exportar-cierre', fecha),
});