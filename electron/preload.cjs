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
  products: {
    list: () => call('products:list'),
    create: (input) => call('products:create', input),
    update: (id, patch) => call('products:update', id, patch),
    archive: (id) => call('products:archive', id),
    addStock: (id, qty, note) => call('products:addStock', id, qty, note),
  },
  sales: {
    record: (input) => call('sales:record', input),
    void: (id) => call('sales:void', id),
    listByDate: (date) => call('sales:listByDate', date),
    listRange: (startDate, endDate) => call('sales:listRange', startDate, endDate),
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
  },
  clock: {
    status: () => call('clock:status'),
  },
  system: {
    openDateSettings: () => call('system:openDateSettings'),
  },
});