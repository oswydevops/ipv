const $ = (s) => document.querySelector(s);
const fmt = (n) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const esc = (t) => String(t).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const hoy = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);

let filas = [];
const saldo = (f) => f.saldo_inicial + f.entrada - f.vendido;
const clase = (f) => (saldo(f) <= 0 ? 'r' : saldo(f) <= f.stock_minimo ? 'a' : 'v');

async function cargar() {
  filas = await window.api.listarIPV($('#fecha').value);
  pintar();
  pintarAlertas();
}

function pintar() {
  const q = $('#buscar').value.toLowerCase();
  $('#tabla').innerHTML = filas
    .filter((f) => f.nombre.toLowerCase().includes(q))
    .map((f) => `<tr data-id="${f.id}">
      <td>${f.id}</td><td>${esc(f.nombre)}</td><td>${esc(f.um)}</td>
      <td class="n">${f.saldo_inicial}</td>
      <td><input type="number" min="0" value="${f.entrada}" data-c="entrada"></td>
      <td><input type="number" min="0" value="${f.vendido}" data-c="vendido"></td>
      <td class="n sf ${clase(f)}">${saldo(f)}</td>
      <td class="n">${fmt(f.precio)}</td>
      <td class="n imp">${fmt(f.importe)}</td></tr>`)
    .join('');
  total();
}

function total() {
  $('#total').textContent = fmt(filas.reduce((s, f) => s + f.importe, 0));
}

async function pintarAlertas() {
  const a = await window.api.alertas();
  const lista = (estado) =>
    a.filter((x) => x.estado === estado).map((x) => `<li><span>${esc(x.nombre)}</span><b>${x.saldo}</b></li>`).join('')
    || '<div class="vacio">Ninguno</div>';
  $('#l-cero').innerHTML = lista('cero');
  $('#l-bajo').innerHTML = lista('bajo');
  $('#n-cero').textContent = a.filter((x) => x.estado === 'cero').length;
  $('#n-bajo').textContent = a.filter((x) => x.estado === 'bajo').length;
}

$('#tabla').addEventListener('change', async (e) => {
  const tr = e.target.closest('tr');
  const f = filas.find((x) => x.id === Number(tr.dataset.id));
  f[e.target.dataset.c] = Math.max(0, parseInt(e.target.value, 10) || 0);
  e.target.value = f[e.target.dataset.c];
  f.importe = f.vendido * f.precio;
  await window.api.fijarDia({ fecha: $('#fecha').value, productoId: f.id, entrada: f.entrada, vendido: f.vendido });
  const sf = tr.querySelector('.sf');
  sf.textContent = saldo(f);
  sf.className = `n sf ${clase(f)}`;
  tr.querySelector('.imp').textContent = fmt(f.importe);
  total();
  pintarAlertas();
});

$('#buscar').addEventListener('input', pintar);
$('#fecha').addEventListener('change', cargar);
$('#fecha').value = hoy();
cargar();