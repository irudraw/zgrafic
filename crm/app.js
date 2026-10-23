/**
 * app.js — PrintCRM Web (versión resumida, solo lectura)
 *
 * Visor ligero de los datos que la extensión de PrintCRM sube a Google
 * Drive (printcrm-backup.json). La edición de clientes, pedidos y pagos se
 * hace en la extensión; acá se ve lo principal:
 *   - qué pedidos faltan entregar y cuánto debe cada cliente,
 *   - los pedidos y archivos de cada cliente,
 *   - una "captura rápida" (miniatura PNG con número, imagen y deuda del
 *     pedido) lista para compartir.
 *
 * No escribe nada en Drive (por eso no puede pisar los datos de la extensión).
 * Usa el flujo de token de Google Identity Services (sin Client Secret) y el
 * scope drive.file, que solo ve los archivos de la propia cuenta.
 */

// =========================================================================
// Configuración
// =========================================================================
const CLIENT_ID = '681041725445-ubp84nj3t5pl7sb2mt8dt0r0qvt9hdh4.apps.googleusercontent.com';
const SCOPE_DRIVE = 'https://www.googleapis.com/auth/drive.file';
const NOMBRE_ARCHIVO_BACKUP = 'printcrm-backup.json';

const DRIVE_FILES_API = 'https://www.googleapis.com/drive/v3/files';
const DRIVE_UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3/files';


const ETIQUETAS_ESTADO = {
  cotizacion: 'Cotización',
  diseno: 'Diseño',
  esperando_aprobacion: 'Esperando aprobación',
  imprimiendo: 'Imprimiendo',
  laminando: 'Laminando',
  cortando: 'Cortando',
  terminado: 'Terminado',
  entregado: 'Entregado',
  cancelado: 'Cancelado',
};

const state = {
  accessToken: null,
  archivoId: null,
  paquete: null,
  clienteId: null, // null = pantalla principal
  tab: 'pedidos', // pedidos | archivos
  vista: 'entregar', // entregar | deuda | todos
  texto: '',
  tokenClient: null,
};

function toast(mensaje, tipo = 'info') {
  const cont = document.getElementById('toast-container');
  const el = document.createElement('div');
  el.className = `toast toast--${tipo}`;
  el.textContent = mensaje;
  cont.appendChild(el);
  requestAnimationFrame(() => el.classList.add('toast--visible'));
  setTimeout(() => {
    el.classList.remove('toast--visible');
    setTimeout(() => el.remove(), 250);
  }, 3200);
}

function escaparHtml(texto) {
  if (texto === null || texto === undefined) return '';
  const div = document.createElement('div');
  div.textContent = String(texto);
  return div.innerHTML;
}

function formatearMoneda(monto, moneda) {
  const simbolo = (state.paquete && state.paquete.config && state.paquete.config.moneda === 'USD') || moneda === 'USD' ? '$' : 'S/';
  return `${simbolo} ${(Number(monto) || 0).toFixed(2)}`;
}
function formatearFecha(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
function formatearFechaHora(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return `${formatearFecha(iso)} ${d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}`;
}

function nuevoId(lista) {
  return (lista || []).reduce((max, x) => Math.max(max, Number(x.id) || 0), 0) + 1;
}

let modalActual = null;
function abrirModal({ titulo, contenidoHtml, botones }) {
  cerrarModal();
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal__header">
      <h3>${escaparHtml(titulo)}</h3>
      <button type="button" class="modal__cerrar" id="modalCerrarBtn">&times;</button>
    </div>
    <div class="modal__body">${contenidoHtml}</div>
    <div class="modal__footer" id="modalFooter"></div>
  `;
  const footer = modal.querySelector('#modalFooter');
  (botones || []).forEach((b) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `boton boton--${b.tipo || 'secundario'}`;
    btn.textContent = b.texto;
    btn.addEventListener('click', () => b.onClick(modal));
    footer.appendChild(btn);
  });
  modal.querySelector('#modalCerrarBtn').addEventListener('click', cerrarModal);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) cerrarModal(); });
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  modalActual = overlay;
  return modal;
}
function cerrarModal() {
  if (modalActual) { modalActual.remove(); modalActual = null; }
}

// =========================================================================
// Google Identity Services (login) + Google Drive
// =========================================================================

function esperarGoogleCargado() {
  return new Promise((resolve) => {
    (function check() {
      if (window.google && window.google.accounts && window.google.accounts.oauth2) resolve();
      else setTimeout(check, 100);
    })();
  });
}

async function inicializarGoogle() {
  await esperarGoogleCargado();
  state.tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: SCOPE_DRIVE,
    callback: async (respuesta) => {
      if (respuesta.error) {
        toast('No se pudo conectar con Google: ' + respuesta.error, 'error');
        return;
      }
      state.accessToken = respuesta.access_token;
      await onConectado();
    },
  });
}

function conectarConGoogle() {
  if (!state.tokenClient) {
    toast('Google todavía se está cargando, intenta de nuevo en un segundo', 'error');
    return;
  }
  state.tokenClient.requestAccessToken({ prompt: '' });
}

async function onConectado() {
  document.getElementById('estadoConexion').textContent = '🟢 Conectado — buscando tu copia de seguridad...';
  document.getElementById('btnConectar').style.display = 'none';
  document.getElementById('btnRecargar').style.display = 'inline-block';

  try {
    await cargarDesdeGoogleDrive();
  } catch (err) {
    toast(err.message || 'No se pudo cargar la información de Drive', 'error');
    document.getElementById('estadoConexion').textContent = '⚠️ Conectado, pero no se pudo cargar el respaldo';
  }
}

async function buscarArchivoBackup() {
  const q = encodeURIComponent(`name='${NOMBRE_ARCHIVO_BACKUP}' and trashed=false`);
  const res = await fetch(`${DRIVE_FILES_API}?q=${q}&fields=files(id,name,modifiedTime)`, {
    headers: { Authorization: `Bearer ${state.accessToken}` },
  });
  if (!res.ok) throw new Error(`No se pudo buscar en Drive (código ${res.status})`);
  const data = await res.json();
  return (data.files && data.files[0]) || null;
}

async function descargarContenido(fileId) {
  const res = await fetch(`${DRIVE_FILES_API}/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${state.accessToken}` },
  });
  if (!res.ok) throw new Error(`No se pudo descargar el respaldo (código ${res.status})`);
  return res.text();
}

// driveFileId -> URL local (object URL) de una imagen ya descargada, para
// no volver a pedirle la misma imagen a Drive cada vez que se repinta la
// pestaña Archivos.
const cacheImagenesDrive = new Map();

/** Descarga una imagen de la carpeta "PrintCRM imagenes" y la deja lista para usar en un <img src="...">. */
async function obtenerUrlImagenDrive(driveFileId) {
  if (cacheImagenesDrive.has(driveFileId)) return cacheImagenesDrive.get(driveFileId);
  try {
    const res = await fetch(`${DRIVE_FILES_API}/${driveFileId}?alt=media`, {
      headers: { Authorization: `Bearer ${state.accessToken}` },
    });
    if (!res.ok) throw new Error(`No se pudo descargar la imagen (código ${res.status})`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    cacheImagenesDrive.set(driveFileId, url);
    return url;
  } catch (err) {
    cacheImagenesDrive.set(driveFileId, null);
    return null;
  }
}


async function cargarDesdeGoogleDrive() {
  const archivo = await buscarArchivoBackup();
  if (!archivo) {
    document.getElementById('estadoConexion').textContent = '🟡 Conectado, pero no hay ninguna copia de seguridad en Drive';
    document.getElementById('appRoot').innerHTML = `
      <div class="pantalla-inicial">
        <h2>Todavía no hay datos para mostrar</h2>
        <p>Conecta la extensión de PrintCRM a Google Drive (Dashboard → Configuración) para que suba tu copia, y después dale "🔄 Recargar" acá.</p>
      </div>`;
    return;
  }
  state.archivoId = archivo.id;
  state.paquete = JSON.parse(await descargarContenido(archivo.id));
  const d = state.paquete.datos || (state.paquete.datos = {});
  ['clientes', 'trabajos', 'pagos', 'archivos', 'historial'].forEach((k) => { if (!Array.isArray(d[k])) d[k] = []; });
  document.getElementById('estadoConexion').textContent = `🟢 Datos de: ${formatearFechaHora(archivo.modifiedTime)}`;
  renderizar();
}

// =========================================================================
// Cálculos (iguales a la extensión)
// =========================================================================

function datos() { return state.paquete.datos; }
function esPedidoConfirmado(t) { return t.estado !== 'cotizacion' && t.estado !== 'cancelado'; }
function precioNeto(t) { return Math.max((Number(t.precio) || 0) - (Number(t.recargoDeuda) || 0), 0); }
function pedidosDeCliente(id) { return datos().trabajos.filter((t) => t.clienteId === id); }
function archivosDeCliente(id) {
  return datos().archivos.filter((a) => a.clienteId === id).sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
}
function esImagen(a) { return !!(a.contenidoBase64 || a.driveFileId); }

/**
 * Lo que falta cobrar de cada pedido: todo lo pagado se aplica a los pedidos
 * confirmados del más antiguo al más nuevo. Devuelve { pendientes: Map(id → monto), deuda }.
 */
function calcularPendientes(clienteId) {
  let pozo = datos().pagos.filter((p) => p.clienteId === clienteId).reduce((a, p) => a + (Number(p.monto) || 0), 0);
  const mapa = new Map();
  let deuda = 0;
  pedidosDeCliente(clienteId)
    .filter(esPedidoConfirmado)
    .sort((a, b) => new Date(a.fecha) - new Date(b.fecha))
    .forEach((t) => {
      const neto = precioNeto(t);
      const aplicado = Math.min(pozo, neto);
      pozo -= aplicado;
      const pend = Math.round((neto - aplicado) * 100) / 100;
      mapa.set(t.id, pend);
      deuda += pend;
    });
  return { pendientes: mapa, deuda: Math.round(deuda * 100) / 100 };
}

function resumenCliente(c) {
  const activos = pedidosDeCliente(c.id).filter((t) => esPedidoConfirmado(t) && t.estado !== 'entregado')
    .sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
  const { pendientes, deuda } = calcularPendientes(c.id);
  return { cliente: c, activos, pendientes, deuda };
}

function formatearNumero(c) {
  if (!c || !c.numeroConfirmado || !c.numero) return '';
  const n = String(c.numero).replace(/\D/g, '');
  if (n.length === 11 && n.startsWith('51')) return `+51 ${n.slice(2, 5)} ${n.slice(5, 8)} ${n.slice(8)}`;
  return `+${n}`;
}

/** Miniatura del pedido: la primera imagen guardada que esté asociada a él. */
function archivoDePedido(t) {
  return datos().archivos.find((a) => a.trabajoId === t.id && esImagen(a)) || null;
}

/** Pone en un <img> la imagen de un archivo (base64 local o descarga de Drive). */
async function urlDeArchivo(a) {
  if (a.contenidoBase64) return a.contenidoBase64;
  if (a.driveFileId) return obtenerUrlImagenDrive(a.driveFileId);
  return null;
}
function cargarImagenesDiferidas(cont) {
  cont.querySelectorAll('[data-img-archivo]').forEach(async (el) => {
    const a = datos().archivos.find((x) => x.id === Number(el.dataset.imgArchivo));
    const url = a ? await urlDeArchivo(a) : null;
    if (!el.isConnected) return;
    if (!url) { el.textContent = '🖼️'; return; }
    const img = document.createElement('img');
    img.src = url;
    img.alt = a.nombre || '';
    img.className = el.className;
    img.dataset.verImg = url;
    el.replaceWith(img);
  });
  cont.querySelectorAll('img[data-ver-img]').forEach(enlazarVistaGrande);
}
function enlazarVistaGrande(img) {
  if (img.dataset.enlazada) return;
  img.dataset.enlazada = '1';
  img.addEventListener('click', (e) => {
    e.stopPropagation();
    abrirModal({
      titulo: img.alt || 'Imagen',
      contenidoHtml: `<img src="${img.dataset.verImg || img.src}" class="preview" alt="Vista previa" />`,
      botones: [{ texto: 'Cerrar', tipo: 'secundario', onClick: cerrarModal }],
    });
  });
}

// =========================================================================
// Pantallas
// =========================================================================

function renderizar() {
  const cont = document.getElementById('appRoot');
  if (!state.paquete) return;
  if (state.clienteId !== null && datos().clientes.some((c) => c.id === state.clienteId)) return renderizarCliente(cont);
  state.clienteId = null;
  renderizarPrincipal(cont);
}

function badgeEstado(estado) {
  return `<span class="badge badge--${estado}">${escaparHtml(ETIQUETAS_ESTADO[estado] || estado)}</span>`;
}

function renderizarPrincipal(cont) {
  const filas = datos().clientes.map(resumenCliente);
  const porEntregar = filas.filter((f) => f.activos.length);
  const conDeuda = filas.filter((f) => f.deuda > 0);
  const totalDeuda = conDeuda.reduce((a, f) => a + f.deuda, 0);
  const totalPedidos = porEntregar.reduce((a, f) => a + f.activos.length, 0);

  let lista = state.vista === 'deuda' ? conDeuda : state.vista === 'todos' ? filas : porEntregar;
  const q = state.texto.trim().toLowerCase();
  if (q) lista = lista.filter((f) => f.cliente.nombre.toLowerCase().includes(q) || (f.cliente.numeroConfirmado && String(f.cliente.numero).includes(q)));
  // Primero los que más deben; después, por nombre.
  lista = lista.slice().sort((a, b) => b.deuda - a.deuda || a.cliente.nombre.localeCompare(b.cliente.nombre));

  cont.innerHTML = `
    <main class="pagina">
      <div class="grid-stats">
        <div class="stat"><div class="stat__valor">${totalPedidos}</div><div class="stat__etiqueta">Pedidos por entregar</div></div>
        <div class="stat"><div class="stat__valor">${conDeuda.length}</div><div class="stat__etiqueta">Clientes con deuda</div></div>
        <div class="stat"><div class="stat__valor" style="color:var(--pcrm-rojo)">${formatearMoneda(totalDeuda)}</div><div class="stat__etiqueta">Por cobrar</div></div>
      </div>
      <div class="filtros">
        <button type="button" class="chip ${state.vista === 'entregar' ? 'chip--activo' : ''}" data-vista="entregar">🛠️ Por entregar (${porEntregar.length})</button>
        <button type="button" class="chip ${state.vista === 'deuda' ? 'chip--activo' : ''}" data-vista="deuda">💰 Con deuda (${conDeuda.length})</button>
        <button type="button" class="chip ${state.vista === 'todos' ? 'chip--activo' : ''}" data-vista="todos">👥 Todos (${filas.length})</button>
      </div>
      <input type="search" id="buscador" class="buscador" placeholder="Buscar por nombre o número…" value="${escaparHtml(state.texto)}" />
      <div id="lista">${lista.length ? lista.map(tarjetaCliente).join('') : '<p class="vacio">Nada por aquí 🎉</p>'}</div>
    </main>`;
  cont.querySelectorAll('[data-vista]').forEach((b) => b.addEventListener('click', () => { state.vista = b.dataset.vista; renderizar(); }));
  const buscador = cont.querySelector('#buscador');
  buscador.addEventListener('input', () => {
    state.texto = buscador.value;
    const pos = buscador.selectionStart;
    renderizar();
    const nuevo = document.getElementById('buscador');
    nuevo.focus();
    nuevo.setSelectionRange(pos, pos);
  });
  cont.querySelectorAll('[data-cliente]').forEach((el) => el.addEventListener('click', () => {
    state.clienteId = Number(el.dataset.cliente);
    state.tab = 'pedidos';
    window.scrollTo(0, 0);
    renderizar();
  }));
}

function tarjetaCliente(f) {
  const c = f.cliente;
  const num = formatearNumero(c);
  const lineas = f.activos.slice(0, 4).map((t) => `
    <div class="pedido-mini">
      <span class="pedido-mini__nombre">${escaparHtml(t.nombre || t.descripcion || 'Pedido')}${Number(t.cantidad) > 1 ? ` ×${t.cantidad}` : ''}</span>
      ${badgeEstado(t.estado)}
      ${(f.pendientes.get(t.id) || 0) > 0 ? `<span class="pedido-mini__debe">${formatearMoneda(f.pendientes.get(t.id))}</span>` : '<span class="pedido-mini__ok">Pagado</span>'}
    </div>`).join('');
  return `
    <div class="tarjeta-cliente" data-cliente="${c.id}">
      <div class="tarjeta-cliente__top">
        <div style="min-width:0">
          <div class="tarjeta-cliente__nombre">${escaparHtml(c.nombre)}</div>
          ${num ? `<div class="tarjeta-cliente__num">${escaparHtml(num)}</div>` : ''}
        </div>
        ${f.deuda > 0 ? `<span class="badge badge--debe badge--grande">Debe ${formatearMoneda(f.deuda)}</span>` : '<span class="badge badge--entregado badge--grande">Al día</span>'}
      </div>
      ${lineas}
      ${f.activos.length > 4 ? `<div class="pedido-mini__mas">… y ${f.activos.length - 4} más</div>` : ''}
    </div>`;
}

function renderizarCliente(cont) {
  const c = datos().clientes.find((x) => x.id === state.clienteId);
  const f = resumenCliente(c);
  const num = formatearNumero(c);
  cont.innerHTML = `
    <main class="pagina">
      <button type="button" class="boton" id="btnVolver">← Volver</button>
      <div class="cliente-cab">
        <div style="min-width:0">
          <h2 class="titulo-cliente">${escaparHtml(c.nombre)}</h2>
          <div class="subtitulo-cliente">${escaparHtml(num || 'Número no confirmado')}</div>
        </div>
        <div style="text-align:right">
          ${f.deuda > 0 ? `<span class="badge badge--debe badge--grande">Debe ${formatearMoneda(f.deuda)}</span>` : '<span class="badge badge--entregado badge--grande">Al día</span>'}
        </div>
      </div>
      <button type="button" class="boton boton--primario boton--full" id="btnCaptura">📸 Captura rápida para compartir</button>
      <div class="tabs" style="margin-top:14px">
        <button type="button" class="tab ${state.tab === 'pedidos' ? 'tab--activo' : ''}" data-tab="pedidos">🛠️ Pedidos</button>
        <button type="button" class="tab ${state.tab === 'archivos' ? 'tab--activo' : ''}" data-tab="archivos">📁 Archivos</button>
      </div>
      <div id="panelContenido"></div>
    </main>`;
  cont.querySelector('#btnVolver').addEventListener('click', () => { state.clienteId = null; renderizar(); });
  cont.querySelector('#btnCaptura').addEventListener('click', () => abrirCaptura(c));
  cont.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => { state.tab = b.dataset.tab; renderizar(); }));
  const panel = cont.querySelector('#panelContenido');
  if (state.tab === 'archivos') renderizarArchivos(panel, c);
  else renderizarPedidos(panel, c, f);
}

function renderizarPedidos(panel, c, f) {
  const todos = pedidosDeCliente(c.id).sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
  const activos = todos.filter((t) => esPedidoConfirmado(t) && t.estado !== 'entregado');
  const cotiz = todos.filter((t) => t.estado === 'cotizacion');
  const hechos = todos.filter((t) => t.estado === 'entregado' || t.estado === 'cancelado');
  const fila = (t) => {
    const a = archivoDePedido(t);
    const pend = f.pendientes.has(t.id) ? f.pendientes.get(t.id) : null;
    return `
      <div class="pedido-fila">
        ${a ? `<div class="pedido-fila__img" data-img-archivo="${a.id}">…</div>` : '<div class="pedido-fila__img pedido-fila__img--vacia">🖨️</div>'}
        <div class="pedido-fila__info">
          <div class="pedido-fila__nombre">${escaparHtml(t.nombre || t.descripcion || 'Pedido')}</div>
          <div class="pedido-fila__meta">${formatearFecha(t.fecha)}${t.fechaEntrega ? ` · Entrega: ${escaparHtml(t.fechaEntrega)}` : ''} · Cant. ${Number(t.cantidad) || 1}</div>
          <div>${badgeEstado(t.estado)}</div>
        </div>
        <div class="pedido-fila__monto">
          <div>${formatearMoneda(t.precio)}</div>
          ${pend === null ? '' : pend > 0 ? `<div class="pedido-mini__debe">Falta ${formatearMoneda(pend)}</div>` : '<div class="pedido-mini__ok">Pagado</div>'}
        </div>
      </div>`;
  };
  const seccion = (titulo, lista, abierto) => lista.length ? `
    <details class="seccion" ${abierto ? 'open' : ''}>
      <summary>${titulo} (${lista.length})</summary>
      ${lista.map(fila).join('')}
    </details>` : '';
  panel.innerHTML = (activos.length || cotiz.length || hechos.length)
    ? seccion('🛠️ Por entregar', activos, true) + seccion('📝 Cotizaciones', cotiz, false) + seccion('✅ Entregados / cancelados', hechos, false)
    : '<p class="vacio">Sin pedidos.</p>';
  cargarImagenesDiferidas(panel);
}

function renderizarArchivos(panel, c) {
  const archivos = archivosDeCliente(c.id);
  panel.innerHTML = archivos.length
    ? `<div class="archivos-grid">${archivos.map((a) => `
        <div class="archivo-card">
          ${esImagen(a) ? `<div class="archivo-card__cargando" data-img-archivo="${a.id}">Cargando…</div>` : '<div class="archivo-card__cargando">📄</div>'}
          <div class="archivo-card__nombre">${escaparHtml(a.nombre)}</div>
          <div class="archivo-card__meta">${escaparHtml(a.tipo || '')} · ${formatearFecha(a.fecha)}</div>
        </div>`).join('')}</div>`
    : '<p class="vacio">Sin archivos.</p>';
  cargarImagenesDiferidas(panel);
}

// =========================================================================
// Captura rápida: miniatura PNG (número + imagen + lo que debe) para compartir
// =========================================================================

function cargarImagen(url) {
  return new Promise((resolve) => {
    if (!url) return resolve(null);
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

function ajustarTexto(ctx, texto, anchoMax) {
  const palabras = String(texto).split(/\s+/);
  const lineas = [];
  let actual = '';
  palabras.forEach((p) => {
    const prueba = actual ? `${actual} ${p}` : p;
    if (ctx.measureText(prueba).width > anchoMax && actual) { lineas.push(actual); actual = p; } else actual = prueba;
  });
  if (actual) lineas.push(actual);
  return lineas;
}

/** Dibuja la tarjeta y devuelve el canvas. datos: {negocio, nombre, numero, imagen(Image|null), items:[{texto,monto}], total, deudaTotal, moneda} */
function dibujarCaptura(d) {
  const W = 800, M = 36;
  const medir = document.createElement('canvas').getContext('2d');
  medir.font = '600 28px "Segoe UI", Arial, sans-serif';
  const bloques = d.items.map((it) => ({ it, lineas: ajustarTexto(medir, it.texto, W - M * 2 - 190) }));
  const altoItems = bloques.reduce((a, b) => a + Math.max(b.lineas.length, 1) * 36 + 14, 0);
  const altoImg = d.imagen ? Math.min(Math.round((d.imagen.height / d.imagen.width) * (W - M * 2)), 620) : 0;
  const hayExtra = d.deudaTotal !== null;
  const H = 96 + (altoImg ? altoImg + 24 : 0) + 120 + altoItems + 130 + (hayExtra ? 44 : 0) + 30;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);
  // Cabecera
  ctx.fillStyle = '#008069';
  ctx.fillRect(0, 0, W, 76);
  ctx.fillStyle = '#fff';
  ctx.font = '700 32px "Segoe UI", Arial, sans-serif';
  ctx.textBaseline = 'middle';
  ctx.fillText(d.negocio, M, 40);
  let y = 96;
  if (d.imagen) {
    const aw = W - M * 2;
    const escala = Math.min(aw / d.imagen.width, altoImg / d.imagen.height);
    const iw = d.imagen.width * escala, ih = d.imagen.height * escala;
    ctx.fillStyle = '#f0f2f5';
    ctx.fillRect(M, y, aw, altoImg);
    ctx.drawImage(d.imagen, M + (aw - iw) / 2, y + (altoImg - ih) / 2, iw, ih);
    y += altoImg + 24;
  }
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#111b21';
  ctx.font = '700 38px "Segoe UI", Arial, sans-serif';
  ctx.fillText(d.nombre, M, y + 38, W - M * 2);
  y += 38;
  if (d.numero) {
    ctx.fillStyle = '#667781';
    ctx.font = '600 30px "Segoe UI", Arial, sans-serif';
    ctx.fillText(d.numero, M, y + 44);
  }
  y += 80;
  // Pedidos
  ctx.font = '600 28px "Segoe UI", Arial, sans-serif';
  bloques.forEach(({ it, lineas }) => {
    ctx.fillStyle = '#111b21';
    ctx.textAlign = 'left';
    lineas.forEach((l, i) => ctx.fillText(l, M, y + 28 + i * 36));
    ctx.textAlign = 'right';
    ctx.fillStyle = it.monto > 0 ? '#c22' : '#1c8a52';
    ctx.fillText(it.monto > 0 ? formatearMoneda(it.monto, d.moneda) : 'Pagado', W - M, y + 28);
    ctx.textAlign = 'left';
    y += Math.max(lineas.length, 1) * 36 + 14;
    ctx.strokeStyle = '#e9edef';
    ctx.beginPath(); ctx.moveTo(M, y - 7); ctx.lineTo(W - M, y - 7); ctx.stroke();
  });
  // Total
  y += 16;
  const debe = d.total > 0;
  ctx.fillStyle = debe ? '#fbe5e5' : '#e3f6ec';
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(M, y, W - M * 2, 96, 16); else ctx.rect(M, y, W - M * 2, 96);
  ctx.fill();
  ctx.fillStyle = debe ? '#c22' : '#1c8a52';
  ctx.font = '600 28px "Segoe UI", Arial, sans-serif';
  ctx.fillText(debe ? 'Debe' : 'Al día', M + 24, y + 58);
  ctx.textAlign = 'right';
  ctx.font = '700 52px "Segoe UI", Arial, sans-serif';
  ctx.fillText(debe ? formatearMoneda(d.total, d.moneda) : '✔', W - M - 24, y + 66);
  ctx.textAlign = 'left';
  y += 96;
  if (hayExtra) {
    ctx.fillStyle = '#667781';
    ctx.font = '500 24px "Segoe UI", Arial, sans-serif';
    ctx.fillText(`Deuda total del cliente: ${formatearMoneda(d.deudaTotal, d.moneda)}`, M, y + 36);
  }
  return cv;
}

function abrirCaptura(c) {
  const f = resumenCliente(c);
  const imagenes = archivosDeCliente(c.id).filter(esImagen);
  // Imagen inicial: la del primer pedido activo que tenga, o la última guardada.
  const delPedido = f.activos.map(archivoDePedido).find(Boolean);
  const sel = { archivoId: (delPedido || imagenes[0] || {}).id || null, url: null, subida: null };
  const pedidos = f.activos.concat(
    pedidosDeCliente(c.id).filter((t) => esPedidoConfirmado(t) && t.estado === 'entregado' && (f.pendientes.get(t.id) || 0) > 0)
  );
  const marcados = new Set(pedidos.filter((t) => (f.pendientes.get(t.id) || 0) > 0).map((t) => t.id));
  if (!marcados.size && pedidos.length) marcados.add(pedidos[0].id);

  const modal = abrirModal({
    titulo: '📸 Captura rápida',
    contenidoHtml: `
      <div class="captura-seccion">Imagen</div>
      <div class="captura-imgs" id="capImgs">
        <button type="button" class="captura-img captura-img--sin" data-sin>Sin imagen</button>
        <label class="captura-img captura-img--sin" style="cursor:pointer">📂 Subir<input type="file" accept="image/*" id="capArchivo" hidden /></label>
        ${imagenes.map((a) => `<div class="captura-img" data-sel-archivo="${a.id}" title="${escaparHtml(a.nombre)}">…</div>`).join('')}
      </div>
      <div class="captura-seccion">Pedidos que aparecen</div>
      <div id="capPedidos">${pedidos.length ? pedidos.map((t) => `
        <label class="captura-check"><input type="checkbox" data-ped="${t.id}" ${marcados.has(t.id) ? 'checked' : ''} />
          <span>${escaparHtml(t.nombre || t.descripcion || 'Pedido')}${Number(t.cantidad) > 1 ? ` ×${t.cantidad}` : ''}</span>
          <strong>${(f.pendientes.get(t.id) || 0) > 0 ? formatearMoneda(f.pendientes.get(t.id)) : 'Pagado'}</strong></label>`).join('') : '<p class="vacio" style="padding:8px 0">Sin pedidos activos: la captura mostrará solo el número.</p>'}</div>
      <div class="captura-seccion">Vista previa</div>
      <div id="capPrevia" class="captura-previa">Generando…</div>`,
    botones: [
      { texto: 'Cerrar', tipo: 'secundario', onClick: cerrarModal },
      { texto: '⬇️ Descargar', tipo: 'secundario', onClick: () => salidaCaptura('descargar') },
      { texto: '📋 Copiar', tipo: 'secundario', onClick: () => salidaCaptura('copiar') },
      { texto: '📤 Compartir', tipo: 'primario', onClick: () => salidaCaptura('compartir') },
    ],
  });
  modal.classList.add('modal--ancho');

  let canvasActual = null;
  let numeroGen = 0;
  async function regenerar() {
    const mi = ++numeroGen;
    let url = sel.subida;
    if (!url && sel.archivoId) {
      const a = datos().archivos.find((x) => x.id === sel.archivoId);
      url = a ? await urlDeArchivo(a) : null;
    }
    const imagen = await cargarImagen(url);
    if (mi !== numeroGen) return;
    const elegidos = pedidos.filter((t) => marcados.has(t.id));
    const items = elegidos.map((t) => ({ texto: t.nombre || t.descripcion || 'Pedido', monto: f.pendientes.get(t.id) || 0 }));
    items.forEach((it, i) => { if (Number(elegidos[i].cantidad) > 1) it.texto += ` ×${elegidos[i].cantidad}`; });
    const total = items.reduce((a, i) => a + i.monto, 0);
    const cfg = (state.paquete && state.paquete.config) || {};
    canvasActual = dibujarCaptura({
      negocio: cfg.nombreNegocio || 'PrintCRM',
      nombre: c.nombre,
      numero: formatearNumero(c),
      imagen,
      items,
      total,
      deudaTotal: items.length && Math.abs(f.deuda - total) > 0.005 ? f.deuda : null,
      moneda: cfg.moneda,
    });
    const previa = modal.querySelector('#capPrevia');
    previa.innerHTML = '';
    canvasActual.style.width = '100%';
    canvasActual.style.height = 'auto';
    previa.appendChild(canvasActual);
  }

  function marcarImagenActiva() {
    modal.querySelectorAll('.captura-img').forEach((el) => {
      const activo = el.hasAttribute('data-sin') ? (!sel.archivoId && !sel.subida) : (sel.archivoId && Number(el.dataset.selArchivo) === sel.archivoId && !sel.subida);
      el.classList.toggle('captura-img--activa', !!activo);
    });
  }
  // Miniaturas de la galería (cargan una por una desde Drive)
  modal.querySelectorAll('[data-sel-archivo]').forEach(async (el) => {
    const a = datos().archivos.find((x) => x.id === Number(el.dataset.selArchivo));
    const url = a ? await urlDeArchivo(a) : null;
    if (url) { el.textContent = ''; el.style.backgroundImage = `url("${url}")`; } else el.textContent = '⚠️';
  });
  modal.querySelector('#capImgs').addEventListener('click', (e) => {
    const el = e.target.closest('.captura-img');
    if (!el || el.tagName === 'LABEL') return;
    sel.subida = null;
    sel.archivoId = el.hasAttribute('data-sin') ? null : Number(el.dataset.selArchivo);
    marcarImagenActiva();
    regenerar();
  });
  modal.querySelector('#capArchivo').addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    sel.subida = URL.createObjectURL(file);
    sel.archivoId = null;
    marcarImagenActiva();
    regenerar();
  });
  modal.querySelectorAll('[data-ped]').forEach((cb) => cb.addEventListener('change', () => {
    const id = Number(cb.dataset.ped);
    if (cb.checked) marcados.add(id); else marcados.delete(id);
    regenerar();
  }));

  async function salidaCaptura(accion) {
    if (!canvasActual) return;
    const blob = await new Promise((r) => canvasActual.toBlob(r, 'image/png'));
    if (!blob) return toast('No se pudo generar la imagen', 'error');
    const nombre = `captura-${c.nombre.replace(/[^\w]+/g, '-').slice(0, 30) || 'cliente'}.png`;
    if (accion === 'descargar') {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = nombre;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      return toast('Imagen descargada', 'exito');
    }
    if (accion === 'copiar') {
      try {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        toast('Imagen copiada: pégala en el chat', 'exito');
      } catch (err) {
        toast('Tu navegador no permite copiar imágenes; usa Descargar', 'error');
      }
      return;
    }
    const archivo = new File([blob], nombre, { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [archivo] })) {
      try { await navigator.share({ files: [archivo], title: c.nombre }); } catch (err) { /* cancelado */ }
    } else {
      toast('Este navegador no puede compartir archivos; usa Copiar o Descargar', 'info');
    }
  }

  marcarImagenActiva();
  regenerar();
}

// =========================================================================
// Arranque
// =========================================================================

document.getElementById('btnConectar').addEventListener('click', conectarConGoogle);
document.getElementById('btnRecargar').addEventListener('click', async () => {
  if (!state.accessToken) return conectarConGoogle();
  try {
    await cargarDesdeGoogleDrive();
    toast('Datos actualizados desde Google Drive', 'exito');
  } catch (err) {
    toast(err.message || 'No se pudo recargar', 'error');
  }
});
inicializarGoogle();
