const INPUT = 'w-20 h-8 px-2 text-right bg-surface-container-low rounded border border-transparent focus:border-outline font-label-md text-on-surface tabular-nums focus:outline-none';
const CHIP = 'filter-chip px-space-md py-1 rounded font-label-md text-label-md transition-colors ';
const CHIP_ON = CHIP + 'bg-primary-container text-on-primary shadow-sm';
const CHIP_OFF = CHIP + 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high';
const ETIQUETA = 'text-[11px] font-label-sm uppercase font-semibold';

let filas = [];
let filtro = 'all';

const saldo = (f) => f.saldo_inicial + f.entrada - f.vendido;
const estado = (f) => (saldo(f) <= 0 ? 'zero' : saldo(f) <= f.stock_minimo ? 'low' : 'normal');

function badge(f) {
  const s = saldo(f);
  const e = estado(f);
  if (e === 'zero') return `<span class="inline-flex items-center gap-1 font-headline-sm text-headline-sm font-bold px-2 py-0.5 rounded text-error bg-error-container">${s}<span class="${ETIQUETA}">En cero</span></span>`;
  if (e === 'low') return `<span class="inline-flex items-center gap-1 font-headline-sm text-headline-sm font-bold px-2 py-0.5 rounded text-tertiary bg-tertiary-fixed/60">${s}<span class="${ETIQUETA}">Stock bajo</span></span>`;
  return `<span class="inline-flex items-center font-headline-sm text-headline-sm font-bold text-secondary">${s}</span>`;
}

const fila = (f) => `<tr class="ipv-row h-14 border-b border-surface-variant/40 hover:bg-surface-container-low/50 transition-colors" data-id="${f.id}">
  <td class="text-center font-label-sm text-outline px-2">${f.id}</td>
  <td class="px-space-md font-label-md text-on-surface font-semibold">${esc(f.nombre)}</td>
  <td class="px-space-sm text-center text-on-surface-variant font-label-sm">${esc(f.um)}</td>
  <td class="px-space-sm text-right tabular-nums text-on-surface-variant">${f.saldo_inicial}</td>
  <td class="px-space-sm text-right"><input class="${INPUT}" min="0" type="number" value="${f.entrada}" data-c="entrada"></td>
  <td class="px-space-sm text-right"><input class="${INPUT}" min="0" type="number" value="${f.vendido}" data-c="vendido"></td>
  <td class="px-space-sm text-right sf">${badge(f)}</td>
  <td class="px-space-sm text-right tabular-nums text-on-surface-variant">${fmt(f.precio)}</td>
  <td class="px-space-md text-right font-label-md font-semibold text-on-surface tabular-nums imp">${fmt(f.importe)} CUP</td>
</tr>`;

const pasa = (f, q) =>
  f.nombre.toLowerCase().includes(q) &&
  (filtro === 'all' || (filtro === 'movement' && (f.vendido > 0 || f.entrada > 0)) || filtro === estado(f));

function resumen() {
  const cero = filas.filter((f) => estado(f) === 'zero').length;
  const bajo = filas.filter((f) => estado(f) === 'low').length;
  const unidades = filas.reduce((s, f) => s + f.vendido, 0);
  const total = filas.reduce((s, f) => s + f.importe, 0);
  $('#kpiTotal').textContent = fmt(total) + ' CUP';
  $('#kpiOps').textContent = 'Importe acumulado del día';
  $('#kpiRenglones').textContent = filas.filter((f) => f.vendido > 0).length + ' renglones';
  $('#kpiUnidades').textContent = unidades + ' unidades físicas';
  $('#kpiCero').textContent = cero;
  $('#kpiBajo').textContent = bajo;
  $('#totalUnitsSold').textContent = unidades + ' unidades vendidas';
  $('#grandTotalDisplay').textContent = fmt(total) + ' CUP';
  const n = { all: filas.length, movement: filas.filter((f) => f.vendido > 0 || f.entrada > 0).length, zero: cero, low: bajo };
  const nombre = { all: 'Todos', movement: 'Con movimiento', zero: 'En cero', low: 'Stock bajo' };
  document.querySelectorAll('.filter-chip').forEach((b) => {
    const k = b.dataset.filter;
    b.textContent = `${nombre[k]} (${n[k]})`;
    b.className = k === filtro ? CHIP_ON : CHIP_OFF;
  });
}

function pintar() {
  const q = $('#productSearchInput').value.toLowerCase().trim();
  $('#ipvTableBody').innerHTML = filas.filter((f) => pasa(f, q)).map(fila).join('');
  resumen();
}

async function cargar() {
  filas = await window.api.listarIPV($('#fecha').value);
  pintar();
}

$('#ipvTableBody').addEventListener('change', async (e) => {
  const tr = e.target.closest('tr');
  const f = filas.find((x) => x.id === Number(tr.dataset.id));
  const campo = e.target.dataset.c;
  f[campo] = Math.max(0, parseInt(e.target.value, 10) || 0);
  e.target.value = f[campo];
  f.importe = f.vendido * f.precio;
  await window.api.fijarDia({ fecha: $('#fecha').value, productoId: f.id, entrada: f.entrada, vendido: f.vendido });
  tr.querySelector('.sf').innerHTML = badge(f);
  tr.querySelector('.imp').textContent = fmt(f.importe) + ' CUP';
  resumen();
});

document.querySelectorAll('.filter-chip').forEach((b) =>
  b.addEventListener('click', () => { filtro = b.dataset.filter; pintar(); }));
$('#productSearchInput').addEventListener('input', pintar);
$('#fecha').addEventListener('change', cargar);
$('#btnCashClose').addEventListener('click', () => (location.href = 'cierre.html'));
$('#btnSaveDay').addEventListener('click', () => {
  const b = $('#btnSaveDay');
  const antes = b.innerHTML;
  b.innerHTML = '<span class="material-symbols-outlined text-[18px]">done</span><span>Guardado</span>';
  setTimeout(() => (b.innerHTML = antes), 1200);
});
window.addEventListener('keydown', (e) => {
  if (e.key === 'F2') { e.preventDefault(); $('#productSearchInput').focus(); }
  if (e.key === 'F5') { e.preventDefault(); $('#btnSaveDay').click(); }
  if (e.key === 'F9') { e.preventDefault(); $('#btnCashClose').click(); }
});

$('#fecha').value = hoy();
$('#productSearchInput').value = new URLSearchParams(location.search).get('q') || '';
cargar();
