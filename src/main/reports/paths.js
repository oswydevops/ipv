'use strict';
const { app } = require('electron');
const path = require('path');
const fs = require('fs');

/**
 * Genera y asegura las rutas de guardado para los reportes de cierre:
 * app.getPath('documents')/IPV/Reportes/AAAA/MM/cierre-AAAA-MM-DD.(pdf|xlsx)
 *
 * @param {string} fecha - Fecha en formato 'AAAA-MM-DD'
 * @returns {{ directory: string, pdfPath: string, excelPath: string, fecha: string }}
 */
function getReportPaths(fecha) {
  if (!fecha || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    throw new Error('Fecha inválida para generar rutas de reporte. Se espera AAAA-MM-DD');
  }

  const [year, month] = fecha.split('-');

  // Directorio base: Documentos del usuario
  let docsDir;
  try {
    docsDir = app.getPath('documents');
  } catch {
    docsDir = path.join(process.env.USERPROFILE || process.env.HOME || '.', 'Documents');
  }

  const targetDir = path.join(docsDir, 'IPV', 'Reportes', year, month);

  // Crear carpetas si no existen de manera recursiva
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  const pdfPath = path.join(targetDir, `cierre-${fecha}.pdf`);
  const excelPath = path.join(targetDir, `cierre-${fecha}.xlsx`);

  return {
    directory: targetDir,
    pdfPath,
    excelPath,
    fecha,
  };
}

/**
 * Resuelve la ruta absoluta al archivo de plantilla (.hbs),
 * soportando tanto modo de desarrollo como producción empaquetada (app.isPackaged).
 *
 * @param {string} [templateName='cierre.hbs'] - Nombre del template
 * @returns {string} Ruta absoluta del template
 */
function getTemplatePath(templateName = 'cierre.hbs') {
  const isPackaged = app ? app.isPackaged : false;

  const candidates = [
    // 1. Recursos empaquetados en extraResources (process.resourcesPath/templates)
    process.resourcesPath ? path.join(process.resourcesPath, 'templates', templateName) : null,
    // 2. Empaquetado dentro de app.asar o app empaquetada
    app && app.getAppPath ? path.join(app.getAppPath(), 'templates', templateName) : null,
    // 3. Raíz del proyecto en ejecución / desarrollo
    path.join(process.cwd(), 'templates', templateName),
    path.join(__dirname, '..', '..', '..', 'templates', templateName),
    path.join(__dirname, '..', '..', 'templates', templateName),
    path.join(__dirname, 'templates', templateName),
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  // Si no se encuentra físicamente, devolver el primer candidato por defecto
  return candidates[0] || path.join(process.cwd(), 'templates', templateName);
}

module.exports = {
  getReportPaths,
  getTemplatePath,
};
