'use strict';
const { BrowserWindow } = require('electron');
const fs = require('fs');
const handlebars = require('handlebars');
const { getTemplatePath } = require('./paths.js');

// Registrar helpers para Handlebars
handlebars.registerHelper('money', function (val) {
  return Number(val || 0).toLocaleString('es-CU', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
});

handlebars.registerHelper('multiply', function (a, b) {
  return Number(a || 0) * Number(b || 0);
});

handlebars.registerHelper('eq', function (a, b) {
  return a === b;
});

handlebars.registerHelper('gt', function (a, b) {
  return Number(a || 0) > Number(b || 0);
});

/**
 * Renderiza la plantilla templates/cierre.hbs con los datos de getResumenDia
 * y genera un archivo PDF mediante una BrowserWindow oculta y webContents.printToPDF.
 *
 * @param {object} resumenDia - Objeto retornado por getResumenDia
 * @param {string} outputPath - Ruta de destino para el archivo .pdf
 * @returns {Promise<string>} Ruta del archivo PDF generado
 */
async function generarPdfCierre(resumenDia, outputPath) {
  const templatePath = getTemplatePath('cierre.hbs');
  if (!fs.existsSync(templatePath)) {
    throw new Error(`Plantilla no encontrada en la ruta: ${templatePath}`);
  }

  const templateContent = fs.readFileSync(templatePath, 'utf8');
  const compiled = handlebars.compile(templateContent);
  const htmlContent = compiled(resumenDia);

  // Crear BrowserWindow oculta para el renderizado
  const printWin = new BrowserWindow({
    show: false,
    width: 1024,
    height: 1400,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });

  try {
    const dataUrl = `data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`;
    await printWin.loadURL(dataUrl);

    // Pequeño retardo para que el motor de renderizado complete el layout y estilos
    await new Promise((resolve) => setTimeout(resolve, 350));

    const pdfBuffer = await printWin.webContents.printToPDF({
      marginsType: 0,
      printBackground: true,
      pageSize: 'A4',
      landscape: false,
    });

    fs.writeFileSync(outputPath, pdfBuffer);
    return outputPath;
  } finally {
    if (!printWin.isDestroyed()) {
      printWin.destroy();
    }
  }
}

module.exports = { generarPdfCierre };
