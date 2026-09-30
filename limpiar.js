// Uso: node limpiar.js
// Lee los HTML originales de Stitch desde ./stitch/ y escribe las versiones limpias en ./src/
const fs = require('fs');

const NAV = {
  'ipv-del-dia': 'index.html', 'alertas-de-stock': 'alertas.html', 'cierre-de-caja': 'cierre.html',
  reportes: 'reportes.html', productos: 'productos.html', 'respaldo-y-exportacion': 'respaldo.html',
};
const LIVE = { 'index.html': 'ipv.js', 'alertas.html': 'alertas.js' };
const HEAD = `<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'">
<link rel="stylesheet" href="fuentes.css"><link rel="stylesheet" href="styles.css">
`;
const FECHA = '<input id="fecha" type="date" class="h-8 px-2 border border-surface-variant rounded font-label-md text-on-surface-variant bg-surface-container-lowest">';
const TOOLBAR = `<div class="flex flex-1 items-center gap-space-sm min-w-[320px]"><div class="relative flex-1 max-w-md"><span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[20px]">search</span><input id="searchInput" type="text" placeholder="Buscar por nombre o código (F2)..." class="w-full h-10 pl-10 pr-3 bg-surface-container-low border border-surface-variant rounded font-body-md text-on-surface focus:outline-none"></div></div><div class="flex items-center gap-space-sm"><button id="btnImportar" type="button" class="h-10 px-space-md border border-surface-variant hover:bg-surface-container-low text-on-surface rounded font-label-md flex items-center gap-space-xs"><span class="material-symbols-outlined text-[18px]">upload_file</span>Importar desde Excel</button><button id="btnNuevo" type="button" onclick="document.getElementById('productModal').classList.remove('hidden')" class="h-10 px-space-lg bg-primary hover:bg-primary-container text-on-primary rounded font-label-md flex items-center gap-space-xs"><span class="material-symbols-outlined text-[18px]">add</span>Nuevo producto (F3)</button></div>`;

function cambiar(t, re, rep, nombre) {
  if (!re.test(t)) { console.log('AVISO: no encontrado ->', nombre); return t; }
  return t.replace(re, typeof rep === 'function' ? rep : () => rep);
}

fs.mkdirSync('src', { recursive: true });
for (const f of Object.values(NAV)) {
  if (!fs.existsSync('stitch/' + f)) { console.log('FALTA stitch/' + f); continue; }
  let t = fs.readFileSync('stitch/' + f, 'utf8');

  if (f === 'index.html') {
    const m = t.match(/tailwind\.config=(\{.*?\})<\/script>/s);
    const ext = JSON.parse(m[1]).theme.extend;
    for (const k in ext.fontFamily) ext.fontFamily[k] = ['Public Sans', 'Segoe UI', 'system-ui', 'sans-serif'];
    fs.writeFileSync('tailwind.config.js',
      `module.exports = {\n  content: ['./src/**/*.{html,js}'],\n  darkMode: 'class',\n  theme: { extend: ${JSON.stringify(ext, null, 2)} },\n};\n`);
  }

  // Limpieza común: sin CDN, sin fuentes de Google, con scrollbars, enlaces reales entre pantallas
  t = t.replace('<script src="https://cdn.tailwindcss.com"></script>', '')
    .replace(/<script id="tailwind-config">.*?<\/script>/s, '')
    .replace(/<link[^>]*fonts\.googleapis\.com[^>]*>\s*/g, '')
    .replace('::-webkit-scrollbar{display:none;}', '')
    .replace('</head>', () => HEAD + '</head>')
    .replace(/data-path="([^"]+)" href="#"/g, (_, p) => `data-path="${p}" href="${NAV[p]}"`);

  if (f === 'index.html') {
    t = cambiar(t, /<span class="text-on-surface-variant font-label-md text-label-md">Lunes, 24 de Octubre de 2024<\/span>/, FECHA, 'fecha IPV');
    for (const [a, b] of [
      ['tracking-tight">48,650.00 CUP</div>', 'tracking-tight" id="kpiTotal">0.00 CUP</div>'],
      ['mt-1">14 operaciones</span>', 'mt-1" id="kpiOps"></span>'],
      ['tracking-tight">18 renglones</div>', 'tracking-tight" id="kpiRenglones">0</div>'],
      ['mt-1">86 unidades físicas</span>', 'mt-1" id="kpiUnidades"></span>'],
      ['text-error tracking-tight">3</div>', 'text-error tracking-tight" id="kpiCero">0</div>'],
      ['text-tertiary tracking-tight">7</div>', 'text-tertiary tracking-tight" id="kpiBajo">0</div>'],
    ]) {
      if (!t.includes(a)) console.log('AVISO KPI no encontrado ->', a);
      t = t.replace(a, () => b);
    }
    t = cambiar(t, /(<tbody[^>]*id="ipvTableBody">).*?(<\/tbody>)/s, (_, a, b) => a + b, 'tbody IPV');
  }

  if (f === 'alertas.html') {
    t = cambiar(t, /<!-- Paginación de Terminal \/ Registro de filas -->.*?id="line-stock-bajo"><\/div>\s*<\/button><\/div>/s,
      '<div class="px-space-md py-space-sm bg-surface-container-low font-label-md text-label-md text-on-surface-variant" id="rows-summary"></div>', 'pie duplicado alertas');
    t = cambiar(t, /(<tbody[^>]*id="inventory-tbody">).*?(<\/tbody>)/s, (_, a, b) => a + b, 'tbody alertas');
  }

  if (f === 'productos.html') {
    t = t.replace('backdrop-blur-xs p-space-md" id="productModal"', 'backdrop-blur-xs p-space-md hidden" id="productModal"');
    const fix = (precio, args, hover) => {
      t = cambiar(t, new RegExp(`<button '${precio}'[^>]*title="Editar producto">`),
        `<button class="p-1 ${hover} text-primary rounded" onclick="openEditModal(${args})" title="Editar producto">`, 'botón ' + precio);
    };
    fix('1000\\.00', "'PROD-004', 'Universal de 1&quot; PVC', 'Unidad', '1000.00', '5', '6'", 'hover:bg-surface-container-high');
    fix('200\\.00', "'PROD-005', 'Codo 3/4&quot; 90 Grados', 'Unidad', '200.00', '30', '55'", 'hover:bg-surface-container');
    t = cambiar(t, /<!-- Search Input \+ Category dropdown -->.*?(?=<\/div>\s*<\/div>\s*<!-- Data Display Grid)/s, TOOLBAR, 'barra de productos');
  }

  t = t.replace('Lunes, 24 de Octubre de 2024', () => '<span data-fecha-larga>Lunes, 24 de Octubre de 2024</span>');
  if (LIVE[f]) t = t.replace(/<script>.*?<\/script>/s, ''); // quita el script de demostración de Stitch
  const scripts = '<script src="common.js"></script>' + (LIVE[f] ? `<script src="${LIVE[f]}"></script>` : '');
  t = t.replace('</body>', () => scripts + '</body>');

  const externas = t.match(/https?:\/\/[^"\s')]+/g);
  if (externas) console.log(f, '-> URLs externas que quedan:', [...new Set(externas)]);
  fs.writeFileSync('src/' + f, t);
  console.log('OK', f);
}
