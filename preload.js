const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  listarIPV: (fecha) => ipcRenderer.invoke('ipv:listar', fecha),
  fijarDia: (datos) => ipcRenderer.invoke('ipv:fijar', datos),
  alertas: () => ipcRenderer.invoke('alertas:listar'),
  fijarMinimo: (datos) => ipcRenderer.invoke('alertas:minimo', datos),
});
