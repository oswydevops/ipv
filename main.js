const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { abrir, listarIPV, fijarDia, alertas, fijarMinimo } = require('./db');

let db;

app.whenReady().then(() => {
  db = abrir('C:\\IPV-Datos');

  ipcMain.handle('ipv:listar', (_, fecha) => listarIPV(db, fecha));
  ipcMain.handle('ipv:fijar', (_, datos) => fijarDia(db, datos));
  ipcMain.handle('alertas:listar', () => alertas(db));
  ipcMain.handle('alertas:minimo', (_, { id, minimo }) => fijarMinimo(db, id, minimo));

  const win = new BrowserWindow({
    width: 1366,
    height: 768,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.setMenuBarVisibility(false);
  win.loadFile(path.join(__dirname, 'src', 'index.html'));
});

app.on('before-quit', () => db && db.close());
app.on('window-all-closed', () => app.quit());
