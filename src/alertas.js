const TAB = 'relative flex items-center gap-space-xs px-space-lg py-space-sm rounded-t font-label-lg text-label-lg transition-all ';
let datos = [];
let tab = 'cero';
let editando = null;

const faltante = (a) => Math.max(a.stock_minimo - a.saldo, 0);

function fila(a, i) {
  const c = a.estado === 'cero' ? 'text-error' : 'text-tertiary';
  const fondo = i % 2 ? 'bg-surface-container-low' : 'bg-surface-container-lowest';
  return `<tr class="h-[44px] ${fondo} hover:bg-surface-container transition-colors" data-id="${a.id}" data-nombre="${esc(a.nombre)}" data-min="${a.stock_minimo}">
  <td class="px-space-md text-center text-outline font-label-sm text-label-sm">${String(i + 1).padStart(2, '0')}</td>
  <td class="px-space-md font-label-lg text-label-lg text-primary"><span class="line-clamp-1">${esc(a.nombre)}</span></td>
  <td class="px-space-md text-center text-on-surface-variant font-label-md text-label-md">${esc(a.um)}</td>
  <td class="px-space-md text-center"><span class="${c} font-label-md text-label-md">${a.saldo} un</span></td>
  <td class="px-space-md text-right"><div class="inline-flex items-center justify-end gap-space-xs">
    <span class="font-body-md text-body-md text-on-surface">${a.stock_minimo}</span>
    <button class="btn-min text-outline hover:text-primary p-0.5 rounded hover:bg-surface-container transition-colors" title="Modificar límite mínimo"><span class="material-symbols-outlined text-[16px]">edit</span></button>
  </div></td>
  <td class="px-space-md text-right font-label-md text-label-md ${c}">-${faltante(a)} un</td>
  <td class="px-space-md text-on-surface-variant font-label-sm text-label-sm">${a.ultimo || 'Sin movimientos'}</td>
  <td class="px-space-md text-center"><a href="index.html?q=${encodeURIComponent(a.nombre)}" class="h-8 px-space-sm inline-flex items-center text-primary hover:bg-surface-container font-label-sm text-label-sm rounded transition-colors">+ Entrada</a></td>
</tr>`;
}

function pintar() {
  const q = $('#search-input').value.toLowerCase().trim();
  const cero = datos.filter((a) => a.estado === 'cero');
  const bajo = datos.filter((a) => a.estado === 'bajo');
  $('#total-agotados-val').textContent = cero.length;
  $('#total-bajo-val').textContent = bajo.length;
  $('#tab-agotados span').textContent = `Agotados (${cero.length})`;
  $('#tab-stock-bajo span').textContent = `Stock bajo (${bajo.length})`;
  $('#tab-agotados').className = TAB + (tab === 'cero' ? 'text-error bg-surface-container-lowest border-b-2 border-error' : 'text-on-surface-variant hover:text-on-surface');
  $('#tab-stock-bajo').className = TAB + (tab === 'bajo' ? 'text-tertiary bg-surface-container-lowest border-b-2 border-tertiary ml-space-xs' : 'text-on-surface-variant hover:text-on-surface ml-space-xs');
  const lista = (tab === 'cero' ? cero : bajo).filter((a) => a.nombre.toLowerCase().includes(q));
  $('#inventory-tbody').innerHTML = lista.map(fila).join('') ||
    '<tr><td colspan="8" class="px-space-md py-space-lg text-center text-on-surface-variant">Sin productos en esta lista</td></tr>';
  $('#rows-summary').textContent = `Mostrando ${lista.length} registros`;
}

async function cargar() {
  datos = await window.api.alertas();
  pintar();
}

function toast(texto) {
  const el = $('#toast-feedback');
  $('#toast-text').textContent = texto;
  el.classList.remove('opacity-0', 'pointer-events-none');
  setTimeout(() => el.classList.add('opacity-0', 'pointer-events-none'), 2800);
}

// Funciones globales: el HTML de Stitch las llama desde onclick="..."
window.switchTab = (t) => { tab = t === 'agotados' ? 'cero' : 'bajo'; pintar(); };
window.closeModal = () => { $('#modal-stock').classList.add('hidden'); editando = null; };
window.saveMinStock = async () => {
  const v = parseInt($('#modal-stock-input').value, 10);
  if (!(v > 0)) { toast('Ingrese una cantidad mayor que 0'); return; }
  await window.api.fijarMinimo({ id: editando, minimo: v });
  closeModal();
  await cargar();
  toast(`Stock mínimo actualizado a ${v}`);
};

$('#inventory-tbody').addEventListener('click', (e) => {
  if (!e.target.closest('.btn-min')) return;
  const tr = e.target.closest('tr');
  editando = Number(tr.dataset.id);
  $('#modal-product-name').textContent = 'Producto: ' + tr.dataset.nombre;
  $('#modal-stock-input').value = tr.dataset.min;
  $('#modal-stock').classList.remove('hidden');
  $('#modal-stock-input').select();
});

$('#search-input').addEventListener('input', pintar);
$('#btn-export').addEventListener('click', () => {
  const filas = [['Producto', 'U/M', 'Saldo', 'Mínimo', 'Faltante'],
    ...datos.map((a) => [a.nombre, a.um, a.saldo, a.stock_minimo, faltante(a)])];
  const csv = '\uFEFF' + filas.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  a.download = `reposicion-${hoy()}.csv`;
  a.click();
});

cargar();
