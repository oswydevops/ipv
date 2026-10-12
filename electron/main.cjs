'use strict';
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const fs = require('fs');
const path = require('path');
const { openDatabase } = require('./db.cjs');
const { buildHandlers, register } = require('./ipc.cjs');

app.setName('IPV'); // fija la carpeta de datos: %APPDATA%\IPV

if (!app.requestSingleInstanceLock()) {
  app.quit(); // una sola ventana por base de datos
} else {
  let win = null;
  let store = null;

  app.on('second-instance', () => {
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });

  const createWindow = () => {
    win = new BrowserWindow({
      width: 1366,
      height: 820,
      minWidth: 1024,
      minHeight: 640,
      show: false,
      webPreferences: {
        preload: path.join(__dirname, 'preload.cjs'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });
    win.once('ready-to-show', () => win.show());
    win.setMenuBarVisibility(false);
    const devUrl = process.env.IPV_DEV_URL; // ej. http://localhost:3000
    if (devUrl) win.loadURL(devUrl);
    else win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
    win.on('closed', () => { win = null; });
  };

  app.whenReady().then(() => {
    const dbFile = path.join(app.getPath('userData'), 'ipv.sqlite');
    try {
      store = openDatabase(dbFile);
    } catch (e) {
      dialog.showErrorBox('No se pudo abrir la base de datos', `${dbFile}\n\n${e && e.message}`);
      app.quit();
      return;
    }
    register(ipcMain, buildHandlers(store.repo, { dialog, getWindow: () => win, fs }));
    createWindow();
    app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
  });

  app.on('window-all-closed', () => app.quit());
  app.on('before-quit', () => { if (store) { store.close(); store = null; } });
}