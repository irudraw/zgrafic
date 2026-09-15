/**
 * app.js — PrintCRM Web
 *
 * Editor independiente (sin backend propio) que lee y escribe el MISMO
 * archivo de respaldo que ya sube la extensión de Chrome/Edge a Google
 * Drive (printcrm-backup.json), o que puede crear uno nuevo desde cero si
 * todavía no existe. No es una copia de la extensión: es una segunda forma
 * de ver y editar los mismos datos desde cualquier navegador, sin tener
 * que instalar nada.
 *
 * IMPORTANTE sobre las credenciales de Google: a diferencia de la
 * extensión (que usa un flujo con "Client Secret" porque corre como app
 * instalada), esta página usa el flujo de token de Google Identity
 * Services, pensado específicamente para apps que corren 100% en el
 * navegador -- NO necesita (ni debe llevar) un Client Secret, porque
 * cualquiera podría ver el código fuente de esta página en GitHub.
 *
 * Sobre la seguridad de acceso: no hace falta verificar con qué cuenta de
 * Google se conecta quien sea que abra esta página. El scope drive.file
 * que se usa aquí solo deja ver los archivos que la propia app creó DENTRO
 * de la cuenta de Google con la que cada quien inicia sesión -- si alguien
 * más la abre y se conecta con su propia cuenta, nunca va a poder ver el
 * archivo de datos de otra persona, porque es privado en su Drive. El
 * aislamiento ya lo da Google Drive mismo.
 */

// =========================================================================
// Configuración
// =========================================================================

// Mismo Client ID que ya usa la extensión (los Client ID son públicos por
// diseño; lo que nunca se pone acá es el Client Secret). Para que Google
// permita usarlo desde esta página, hay que agregar la URL donde termines
// publicando esto a "Authorized JavaScript origins" en Google Cloud
// Console -> Credenciales -> este mismo cliente OAuth. Ver el README.
const CLIENT_ID = '681041725445-ubp84nj3t5pl7sb2mt8dt0r0qvt9hdh4.apps.googleusercontent.com';
const SCOPE_DRIVE = 'https://www.googleapis.com/auth/drive.file';
const NOMBRE_ARCHIVO_BACKUP = 'printcrm-backup.json';

const DRIVE_FILES_API = 'https://www.googleapis.com/drive/v3/files';
const DRIVE_UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3/files';

const ESTADOS_TRABAJO = [
  'cotizacion',
  'diseno',
  'esperando_aprobacion',
  'imprimiendo',
  'laminando',
  'cortando',
  'terminado',
  'entregado',
  'cancelado',
];
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
const ROLES_PRECIO = ['cliente', 'disenador', 'vendedor', 'casero'];
const ETIQUETAS_ROL = { cliente: 'Cliente', disenador: 'Diseñador', vendedor: 'Vendedor', casero: 'Casero' };
const TIPOS_ARCHIVO = ['imagen', 'pdf', 'coreldraw', 'illustrator', 'photoshop', 'logo', 'captura_pago', 'otro'];

// =========================================================================
// Estado en memoria
// =========================================================================

const state = {
  accessToken: null,
  archivoId: null, // id del archivo printcrm-backup.json en Drive (null si todavía no existe)
  paquete: null, // { appName, versionBackup, fecha, config, datos: {clientes,trabajos,pagos,archivos,historial} }
  clienteSeleccionadoId: null,
  tabActiva: 'resumen', // resumen | cliente | pedidos | pagos | archivos | historial
  filtroTexto: '',
  sinGuardar: false,
  tokenClient: null,
};

function marcarSinGuardar() {
  state.sinGuardar = true;
  const btn = document.getElementById('btnGuardar');
  btn.disabled = false;
  btn.textContent = '💾 Guardar cambios *';
}
function marcarGuardado() {
  state.sinGuardar = false;
  const btn = document.getElementById('btnGuardar');
  btn.disabled = true;
  btn.textContent = '💾 Guardar cambios';
}
window.addEventListener('beforeunload', (e) => {
  if (state.sinGuardar) {
    e.preventDefault();
    e.returnValue = '';
  }
});

// =========================================================================
// Utilidades (toast, modal, formato, ids)
// =========================================================================

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
  document.getElementById('btnGuardar').style.display = 'inline-block';

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

async function subirContenido(fileId, jsonTexto) {
  const boundary = `printcrmweb_${Date.now()}`;
  const metadata = { name: NOMBRE_ARCHIVO_BACKUP, mimeType: 'application/json' };
  const cuerpo =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify(fileId ? {} : metadata)}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: application/json\r\n\r\n` +
    `${jsonTexto}\r\n` +
    `--${boundary}--`;

  const url = fileId
    ? `${DRIVE_UPLOAD_API}/${fileId}?uploadType=multipart&fields=id,modifiedTime`
    : `${DRIVE_UPLOAD_API}?uploadType=multipart&fields=id,modifiedTime`;

  const res = await fetch(url, {
    method: fileId ? 'PATCH' : 'POST',
    headers: {
      Authorization: `Bearer ${state.accessToken}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body: cuerpo,
  });
  if (!res.ok) throw new Error(`No se pudo subir a Drive (código ${res.status})`);
  return res.json();
}

async function cargarDesdeGoogleDrive() {
  const archivo = await buscarArchivoBackup();
  if (!archivo) {
    document.getElementById('estadoConexion').textContent = '🟡 Conectado, pero todavía no hay ninguna copia de seguridad en Drive';
    document.getElementById('appRoot').innerHTML = `
      <div class="pantalla-inicial">
        <h2>Todavía no hay datos para mostrar</h2>
        <p>Puedes empezar de cero directamente desde acá (sin necesidad de la extensión), o si ya usas la extensión de PrintCRM en WhatsApp Web, conéctala a Google Drive desde ahí y después dale "🔄 Recargar" acá.</p>
        <button type="button" class="boton boton--primario" id="btnCrearDesdeVacio" style="margin-top: 10px;">➕ Empezar de cero</button>
      </div>`;
    document.getElementById('btnCrearDesdeVacio').addEventListener('click', crearBaseDeDatosVacia);
    return;
  }
  state.archivoId = archivo.id;
  const texto = await descargarContenido(archivo.id);
  state.paquete = JSON.parse(texto);

  document.getElementById('estadoConexion').textContent =
    `🟢 Conectado — datos de: ${formatearFechaHora(archivo.modifiedTime)}`;

  marcarGuardado();
  renderizarTodo();
}

/**
 * Crea un respaldo nuevo, vacío, directo desde esta página -- para que se
 * pueda usar PrintCRM Web de forma completamente independiente, sin
 * necesitar que la extensión haya corrido primero en ninguna computadora.
 */
async function crearBaseDeDatosVacia() {
  state.paquete = {
    appName: 'PrintCRM',
    versionBackup: 1,
    fecha: new Date().toISOString(),
    config: { moneda: 'PEN', tema: 'claro', nombreNegocio: 'Mi Imprenta' },
    datos: { clientes: [], trabajos: [], pagos: [], archivos: [], historial: [] },
  };
  try {
    const resultado = await subirContenido(null, JSON.stringify(state.paquete));
    state.archivoId = resultado.id;
    marcarGuardado();
    document.getElementById('estadoConexion').textContent = `🟢 Base de datos nueva creada`;
    toast('Base de datos creada. Ya puedes agregar tu primer cliente', 'exito');
    renderizarTodo();
  } catch (err) {
    toast(err.message || 'No se pudo crear la base de datos', 'error');
  }
}

async function guardarEnGoogleDrive() {
  if (!state.paquete) return;
  const btn = document.getElementById('btnGuardar');
  btn.disabled = true;
  btn.textContent = '💾 Guardando...';
  try {
    state.paquete.fecha = new Date().toISOString();
    const resultado = await subirContenido(state.archivoId, JSON.stringify(state.paquete));
    state.archivoId = resultado.id;
    marcarGuardado();
    document.getElementById('estadoConexion').textContent =
      `🟢 Conectado — datos de: ${formatearFechaHora(resultado.modifiedTime)}`;
    toast('Cambios guardados en Google Drive', 'exito');
  } catch (err) {
    toast(err.message || 'No se pudo guardar en Drive', 'error');
    btn.disabled = false;
    btn.textContent = '💾 Guardar cambios *';
  }
}

// =========================================================================
// Lógica de negocio (misma que la extensión, para que los datos queden
// 100% compatibles entre las dos: mismos cálculos de saldo, mismo reparto
// de pagos generales entre pedidos pendientes, etc.)
// =========================================================================

function datos() { return state.paquete.datos; }

function esPedidoConfirmado(t) {
  return t.estado !== 'cotizacion' && t.estado !== 'cancelado';
}

function pedidosDeCliente(clienteId) {
  return datos().trabajos.filter((t) => t.clienteId === clienteId);
}
function pagosDeCliente(clienteId) {
  return datos().pagos.filter((p) => p.clienteId === clienteId).sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
}
function archivosDeCliente(clienteId) {
  return datos().archivos.filter((a) => a.clienteId === clienteId).sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
}
function historialDeCliente(clienteId) {
  return datos().historial.filter((h) => h.clienteId === clienteId).sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
}

function registrarHistorial(clienteId, descripcion) {
  const ahora = new Date();
  datos().historial.push({
    id: nuevoId(datos().historial),
    clienteId,
    fecha: ahora.toISOString(),
    hora: ahora.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }),
    descripcion,
  });
}

/** Recalcula saldoPendiente/estado del cliente igual que la extensión: Total confirmado - Total pagado. */
function recalcularCliente(clienteId) {
  const cliente = datos().clientes.find((c) => c.id === clienteId);
  if (!cliente) return;
  const pedidos = pedidosDeCliente(clienteId);
  const confirmados = pedidos.filter(esPedidoConfirmado);
  const totalConfirmado = confirmados.reduce((acc, t) => acc + (Number(t.precio) || 0), 0);
  const totalPagado = pagosDeCliente(clienteId).reduce((acc, p) => acc + (Number(p.monto) || 0), 0);
  const saldoPendiente = Math.max(totalConfirmado - totalPagado, 0);
  const hayTerminado = confirmados.some((t) => t.estado === 'terminado');
  const hayPendiente = confirmados.some((t) => t.estado !== 'entregado' && t.estado !== 'terminado');

  let estado = 'al_dia';
  if (saldoPendiente > 0) estado = 'debe';
  else if (hayPendiente) estado = 'pendiente';
  else if (hayTerminado) estado = 'terminado';

  cliente.saldoPendiente = saldoPendiente;
  cliente.estado = estado;
}

// ---------- Pedidos ----------

function crearPedido(clienteId, datosForm) {
  const cantidad = Math.max(Number(datosForm.cantidad) || 1, 1);
  const precioUnitario = Number(datosForm.precioUnitario) || 0;
  const precio = datosForm.precio !== undefined ? Number(datosForm.precio) || 0 : cantidad * precioUnitario;
  const fecha = datosForm.fecha ? new Date(`${datosForm.fecha}T12:00:00`).toISOString() : new Date().toISOString();

  const trabajo = {
    id: nuevoId(datos().trabajos),
    clienteId,
    nombre: datosForm.nombre || 'Pedido sin nombre',
    descripcion: datosForm.descripcion || '',
    cantidad,
    precioUnitario,
    precio,
    adelanto: 0,
    saldo: precio,
    fecha,
    fechaEntrega: datosForm.fechaEntrega || null,
    estado: ESTADOS_TRABAJO.includes(datosForm.estado) ? datosForm.estado : 'cotizacion',
  };
  datos().trabajos.push(trabajo);
  registrarHistorial(clienteId, `Se creó el pedido "${trabajo.nombre}"`);
  recalcularCliente(clienteId);
  return trabajo;
}

function editarPedido(id, datosForm) {
  const t = datos().trabajos.find((x) => x.id === id);
  if (!t) return;
  const precioAnterior = Number(t.precio) || 0;

  if (datosForm.nombre !== undefined) t.nombre = datosForm.nombre || t.nombre;
  if (datosForm.descripcion !== undefined) t.descripcion = datosForm.descripcion;
  if (datosForm.cantidad !== undefined) t.cantidad = Number(datosForm.cantidad) || t.cantidad;
  if (datosForm.precioUnitario !== undefined) t.precioUnitario = Number(datosForm.precioUnitario) || 0;
  if (datosForm.precio !== undefined) t.precio = Number(datosForm.precio) || 0;
  if (datosForm.fecha !== undefined && datosForm.fecha) t.fecha = new Date(`${datosForm.fecha}T12:00:00`).toISOString();
  if (datosForm.fechaEntrega !== undefined) t.fechaEntrega = datosForm.fechaEntrega || null;
  if (datosForm.estado !== undefined && ESTADOS_TRABAJO.includes(datosForm.estado)) {
    if (datosForm.estado !== t.estado) {
      registrarHistorial(t.clienteId, `Pedido "${t.nombre}" cambió a estado: ${ETIQUETAS_ESTADO[datosForm.estado]}`);
    }
    t.estado = datosForm.estado;
  }
  t.saldo = Math.max((Number(t.precio) || 0) - (Number(t.adelanto) || 0), 0);

  if (Number(t.precio) !== precioAnterior) {
    registrarHistorial(
      t.clienteId,
      `Precio del pedido "${t.nombre}" editado: ${formatearMoneda(precioAnterior)} → ${formatearMoneda(t.precio)}`
    );
  }
  recalcularCliente(t.clienteId);
}

function eliminarPedido(id) {
  const t = datos().trabajos.find((x) => x.id === id);
  if (!t) return;
  datos().trabajos = datos().trabajos.filter((x) => x.id !== id);
  registrarHistorial(t.clienteId, `Pedido "${t.nombre}" eliminado`);
  recalcularCliente(t.clienteId);
}

// ---------- Pagos (con el mismo reparto automático que la extensión) ----------

function _aplicarMontoATrabajo(trabajoId, monto) {
  if (!trabajoId || !monto) return;
  const t = datos().trabajos.find((x) => x.id === trabajoId);
  if (!t) return;
  t.adelanto = (Number(t.adelanto) || 0) + monto;
  t.saldo = Math.max((Number(t.precio) || 0) - t.adelanto, 0);
}
function _revertirMontoDeTrabajo(trabajoId, monto) {
  if (!trabajoId || !monto) return;
  const t = datos().trabajos.find((x) => x.id === trabajoId);
  if (!t) return;
  t.adelanto = Math.max((Number(t.adelanto) || 0) - monto, 0);
  t.saldo = Math.max((Number(t.precio) || 0) - t.adelanto, 0);
}
function _distribuirPagoGeneral(clienteId, monto) {
  let restante = Number(monto) || 0;
  const distribucion = [];
  if (restante <= 0) return distribucion;
  const pendientes = pedidosDeCliente(clienteId)
    .filter((t) => esPedidoConfirmado(t) && (Number(t.saldo) || 0) > 0)
    .sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
  for (const t of pendientes) {
    if (restante <= 0) break;
    const aplicar = Math.min(restante, Number(t.saldo) || 0);
    if (aplicar <= 0) continue;
    _aplicarMontoATrabajo(t.id, aplicar);
    distribucion.push({ trabajoId: t.id, monto: aplicar });
    restante -= aplicar;
  }
  return distribucion;
}
function _revertirDistribucion(distribucion) {
  (distribucion || []).forEach((item) => _revertirMontoDeTrabajo(item.trabajoId, item.monto));
}

function registrarPago(clienteId, trabajoId, datosForm) {
  const monto = Number(datosForm.monto) || 0;
  const ahora = new Date();
  const pago = {
    id: nuevoId(datos().pagos),
    clienteId,
    trabajoId: trabajoId || null,
    distribucion: null,
    fecha: ahora.toISOString(),
    hora: ahora.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }),
    metodo: datosForm.metodo || 'No especificado',
    monto,
    observaciones: datosForm.observaciones || '',
  };
  if (trabajoId) {
    _aplicarMontoATrabajo(trabajoId, monto);
  } else {
    pago.distribucion = _distribuirPagoGeneral(clienteId, monto);
  }
  datos().pagos.push(pago);
  registrarHistorial(clienteId, `Pago registrado: ${formatearMoneda(monto)} (${pago.metodo})`);
  recalcularCliente(clienteId);
  return pago;
}

function editarPago(id, datosForm) {
  const pago = datos().pagos.find((p) => p.id === id);
  if (!pago) return;

  if (pago.trabajoId) _revertirMontoDeTrabajo(pago.trabajoId, pago.monto);
  else if (pago.distribucion) _revertirDistribucion(pago.distribucion);

  const montoNuevo = datosForm.monto !== undefined ? Number(datosForm.monto) || 0 : pago.monto;
  const trabajoIdNuevo = datosForm.trabajoId !== undefined ? datosForm.trabajoId || null : pago.trabajoId;

  pago.monto = montoNuevo;
  pago.metodo = datosForm.metodo !== undefined ? datosForm.metodo || 'No especificado' : pago.metodo;
  pago.observaciones = datosForm.observaciones !== undefined ? datosForm.observaciones : pago.observaciones;
  pago.trabajoId = trabajoIdNuevo;

  if (trabajoIdNuevo) {
    pago.distribucion = null;
    _aplicarMontoATrabajo(trabajoIdNuevo, montoNuevo);
  } else {
    pago.distribucion = _distribuirPagoGeneral(pago.clienteId, montoNuevo);
  }
  registrarHistorial(pago.clienteId, `Pago editado: ahora ${formatearMoneda(montoNuevo)} (${pago.metodo})`);
  recalcularCliente(pago.clienteId);
}

function eliminarPago(id) {
  const pago = datos().pagos.find((p) => p.id === id);
  if (!pago) return;
  if (pago.trabajoId) _revertirMontoDeTrabajo(pago.trabajoId, pago.monto);
  else if (pago.distribucion) _revertirDistribucion(pago.distribucion);
  datos().pagos = datos().pagos.filter((p) => p.id !== id);
  registrarHistorial(pago.clienteId, `Pago eliminado: ${formatearMoneda(pago.monto)}`);
  recalcularCliente(pago.clienteId);
}

// ---------- Archivos ----------

function eliminarArchivo(id) {
  const a = datos().archivos.find((x) => x.id === id);
  if (!a) return;
  datos().archivos = datos().archivos.filter((x) => x.id !== id);
  registrarHistorial(a.clienteId, `Archivo eliminado: ${a.nombre}`);
}

// ---------- Clientes ----------

function crearCliente(datosForm) {
  const numero = (datosForm.numero || '').replace(/[^\d]/g, '');
  const cliente = {
    id: nuevoId(datos().clientes),
    nombre: datosForm.nombre || 'Sin nombre',
    numero: numero || `web_${Date.now()}`,
    numeroConfirmado: !!numero,
    nombresConocidos: datosForm.nombre ? [datosForm.nombre] : [],
    foto: null,
    fechaRegistro: new Date().toISOString(),
    observaciones: '',
    estado: 'al_dia',
    saldoPendiente: 0,
    rolPrecio: 'cliente',
    mensajesTemporales: false,
  };
  datos().clientes.push(cliente);
  registrarHistorial(cliente.id, 'Cliente creado desde PrintCRM Web');
  return cliente;
}

function editarCliente(id, datosForm) {
  const c = datos().clientes.find((x) => x.id === id);
  if (!c) return;
  if (datosForm.nombre !== undefined && datosForm.nombre.trim()) c.nombre = datosForm.nombre.trim();
  if (datosForm.numero !== undefined && datosForm.numero.trim()) {
    c.numero = datosForm.numero.replace(/[^\d]/g, '');
    c.numeroConfirmado = true;
  }
  if (datosForm.rolPrecio !== undefined && ROLES_PRECIO.includes(datosForm.rolPrecio)) c.rolPrecio = datosForm.rolPrecio;
  if (datosForm.observaciones !== undefined) c.observaciones = datosForm.observaciones;
}

function eliminarCliente(id) {
  datos().clientes = datos().clientes.filter((c) => c.id !== id);
  datos().trabajos = datos().trabajos.filter((t) => t.clienteId !== id);
  datos().pagos = datos().pagos.filter((p) => p.clienteId !== id);
  datos().archivos = datos().archivos.filter((a) => a.clienteId !== id);
  datos().historial = datos().historial.filter((h) => h.clienteId !== id);
}

// =========================================================================
// Renderizado
// =========================================================================

function colorEstado(estado) {
  return { al_dia: '#25d366', pendiente: '#f0ad4e', debe: '#e64848', terminado: '#2a9df4' }[estado] || '#ccc';
}

function renderizarTodo() {
  const root = document.getElementById('appRoot');
  root.innerHTML = `
    <div class="layout">
      <aside class="sidebar">
        <div class="sidebar__buscador">
          <input type="text" id="buscadorClientes" placeholder="Buscar cliente..." value="${escaparHtml(state.filtroTexto)}" />
        </div>
        <div class="sidebar__lista" id="listaClientes"></div>
        <div style="padding:10px;border-top:1px solid var(--pcrm-borde);">
          <button class="boton boton--primario boton--full" id="btnNuevoCliente">+ Nuevo cliente</button>
        </div>
      </aside>
      <section class="contenido">
        <div class="tabs" id="tabsNav"></div>
        <div id="panelContenido"></div>
      </section>
    </div>
  `;
  document.getElementById('buscadorClientes').addEventListener('input', (e) => {
    state.filtroTexto = e.target.value;
    renderizarListaClientes();
  });
  document.getElementById('btnNuevoCliente').addEventListener('click', abrirModalNuevoCliente);

  renderizarListaClientes();
  renderizarTabs();
  renderizarContenido();
}

function renderizarListaClientes() {
  const cont = document.getElementById('listaClientes');
  if (!cont) return;
  const filtro = state.filtroTexto.trim().toLowerCase();
  let clientes = datos().clientes.slice().sort((a, b) => a.nombre.localeCompare(b.nombre));
  if (filtro) {
    clientes = clientes.filter(
      (c) => c.nombre.toLowerCase().includes(filtro) || (c.numeroConfirmado && c.numero.includes(filtro))
    );
  }
  if (!clientes.length) {
    cont.innerHTML = '<p class="vacio">Sin resultados</p>';
    return;
  }
  cont.innerHTML = clientes
    .map(
      (c) => `
    <div class="cliente-item ${c.id === state.clienteSeleccionadoId ? 'cliente-item--activo' : ''}" data-id="${c.id}">
      <span class="cliente-item__dot" style="background:${colorEstado(c.estado)}"></span>
      <div class="cliente-item__info">
        <div class="cliente-item__nombre">${escaparHtml(c.nombre)}</div>
        <div class="cliente-item__saldo ${c.saldoPendiente > 0 ? 'cliente-item__saldo--debe' : ''}">${formatearMoneda(c.saldoPendiente)}</div>
      </div>
    </div>`
    )
    .join('');
  cont.querySelectorAll('.cliente-item').forEach((el) => {
    el.addEventListener('click', () => {
      state.clienteSeleccionadoId = Number(el.dataset.id);
      if (state.tabActiva === 'resumen') state.tabActiva = 'cliente';
      renderizarListaClientes();
      renderizarTabs();
      renderizarContenido();
    });
  });
}

function renderizarTabs() {
  const cont = document.getElementById('tabsNav');
  const tabs = [
    { key: 'resumen', label: '📊 Resumen' },
    { key: 'cliente', label: '👤 Cliente' },
    { key: 'pedidos', label: '🛠️ Pedidos' },
    { key: 'pagos', label: '💰 Pagos' },
    { key: 'archivos', label: '📁 Archivos' },
    { key: 'historial', label: '🕒 Historial' },
  ];
  cont.innerHTML = tabs
    .map((t) => `<button type="button" class="tab ${state.tabActiva === t.key ? 'tab--activo' : ''}" data-tab="${t.key}">${t.label}</button>`)
    .join('');
  cont.querySelectorAll('.tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.tabActiva = btn.dataset.tab;
      renderizarTabs();
      renderizarContenido();
    });
  });
}

function renderizarContenido() {
  const cont = document.getElementById('panelContenido');
  if (state.tabActiva === 'resumen') return renderizarResumen(cont);

  const cliente = datos().clientes.find((c) => c.id === state.clienteSeleccionadoId);
  if (!cliente) {
    cont.innerHTML = '<div class="contenido-vacio">Elige un cliente de la lista de la izquierda (o crea uno nuevo).</div>';
    return;
  }
  switch (state.tabActiva) {
    case 'cliente': return renderizarTabCliente(cont, cliente);
    case 'pedidos': return renderizarTabPedidos(cont, cliente);
    case 'pagos': return renderizarTabPagos(cont, cliente);
    case 'archivos': return renderizarTabArchivos(cont, cliente);
    case 'historial': return renderizarTabHistorial(cont, cliente);
    default: return;
  }
}

function renderizarResumen(cont) {
  const clientes = datos().clientes;
  const trabajos = datos().trabajos;
  const pagos = datos().pagos;
  const confirmados = trabajos.filter(esPedidoConfirmado);
  const cotizaciones = trabajos.filter((t) => t.estado === 'cotizacion').length;
  const activos = confirmados.filter((t) => t.estado !== 'entregado').length;
  const terminados = trabajos.filter((t) => ['terminado', 'entregado'].includes(t.estado)).length;
  const facturado = confirmados.reduce((a, t) => a + (Number(t.precio) || 0), 0);
  const cobrado = pagos.reduce((a, p) => a + (Number(p.monto) || 0), 0);
  const pendiente = Math.max(facturado - cobrado, 0);
  const conDeuda = clientes.filter((c) => c.saldoPendiente > 0).sort((a, b) => b.saldoPendiente - a.saldoPendiente);

  cont.innerHTML = `
    <h2 class="titulo-cliente">Resumen general</h2>
    <p class="subtitulo-cliente">Datos de: ${state.paquete.fecha ? formatearFechaHora(state.paquete.fecha) : '-'}</p>
    <div class="grid-stats">
      <div class="stat"><div class="stat__valor">${clientes.length}</div><div class="stat__etiqueta">Clientes</div></div>
      <div class="stat"><div class="stat__valor">${cotizaciones}</div><div class="stat__etiqueta">Cotizaciones pendientes</div></div>
      <div class="stat"><div class="stat__valor">${activos}</div><div class="stat__etiqueta">Pedidos activos</div></div>
      <div class="stat"><div class="stat__valor">${terminados}</div><div class="stat__etiqueta">Pedidos terminados</div></div>
      <div class="stat"><div class="stat__valor">${formatearMoneda(cobrado)}</div><div class="stat__etiqueta">Cobrado</div></div>
      <div class="stat"><div class="stat__valor">${formatearMoneda(pendiente)}</div><div class="stat__etiqueta">Pendiente por cobrar</div></div>
      <div class="stat"><div class="stat__valor">${formatearMoneda(facturado)}</div><div class="stat__etiqueta">Facturado</div></div>
    </div>
    <h3>Clientes con deuda (${conDeuda.length})</h3>
    ${
      conDeuda.length
        ? `<div class="tabla-wrap"><table class="tabla"><thead><tr><th>Cliente</th><th>Número</th><th>Saldo</th></tr></thead><tbody>
      ${conDeuda
        .map(
          (c) =>
            `<tr><td>${escaparHtml(c.nombre)}</td><td>${c.numeroConfirmado ? escaparHtml(c.numero) : 'sin confirmar'}</td><td><span class="badge badge--debe">${formatearMoneda(c.saldoPendiente)}</span></td></tr>`
        )
        .join('')}
    </tbody></table></div>`
        : '<p class="vacio">Nadie debe dinero 🎉</p>'
    }
  `;
}

function renderizarTabCliente(cont, cliente) {
  cont.innerHTML = `
    <h2 class="titulo-cliente">${escaparHtml(cliente.nombre)}</h2>
    <p class="subtitulo-cliente">${cliente.numeroConfirmado ? escaparHtml(cliente.numero) : 'Número no confirmado'} · Saldo: ${formatearMoneda(cliente.saldoPendiente)} · Registrado: ${formatearFecha(cliente.fechaRegistro)}</p>
    <form class="form" id="formCliente">
      <label>Nombre <input type="text" name="nombre" value="${escaparHtml(cliente.nombre)}" required /></label>
      <label>Número <input type="text" name="numero" value="${cliente.numeroConfirmado ? escaparHtml(cliente.numero) : ''}" placeholder="Ej: 51987654321" /></label>
      <label>Rol de precio
        <select name="rolPrecio">
          ${ROLES_PRECIO.map((r) => `<option value="${r}" ${r === cliente.rolPrecio ? 'selected' : ''}>${ETIQUETAS_ROL[r]}</option>`).join('')}
        </select>
      </label>
      <label>Observaciones <textarea name="observaciones" rows="4">${escaparHtml(cliente.observaciones || '')}</textarea></label>
      <button type="submit" class="boton boton--primario">Guardar cambios</button>
    </form>
    <h3 style="margin-top:28px;">Zona de peligro</h3>
    <button type="button" class="boton boton--peligro" id="btnEliminarCliente">🗑️ Eliminar cliente (y todos sus pedidos, pagos, archivos e historial)</button>
  `;
  document.getElementById('formCliente').addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    editarCliente(cliente.id, {
      nombre: fd.get('nombre'),
      numero: fd.get('numero'),
      rolPrecio: fd.get('rolPrecio'),
      observaciones: fd.get('observaciones'),
    });
    marcarSinGuardar();
    toast('Cliente actualizado (no olvides "Guardar cambios" arriba para subirlo a Drive)', 'exito');
    renderizarListaClientes();
    renderizarContenido();
  });
  document.getElementById('btnEliminarCliente').addEventListener('click', () => {
    abrirModal({
      titulo: 'Eliminar cliente',
      contenidoHtml: `<p>¿Eliminar a "<strong>${escaparHtml(cliente.nombre)}</strong>" y TODOS sus pedidos, pagos, archivos e historial? Esta acción no se puede deshacer.</p>`,
      botones: [
        { texto: 'Cancelar', tipo: 'secundario', onClick: cerrarModal },
        {
          texto: 'Eliminar todo',
          tipo: 'peligro',
          onClick: () => {
            eliminarCliente(cliente.id);
            state.clienteSeleccionadoId = null;
            state.tabActiva = 'resumen';
            marcarSinGuardar();
            cerrarModal();
            toast('Cliente eliminado', 'exito');
            renderizarTodo();
          },
        },
      ],
    });
  });
}

function renderizarTabPedidos(cont, cliente) {
  const pedidos = pedidosDeCliente(cliente.id).sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
  cont.innerHTML = `
    <h2 class="titulo-cliente">Pedidos de ${escaparHtml(cliente.nombre)}</h2>
    <button type="button" class="boton boton--primario" id="btnNuevoPedido" style="margin-bottom:14px;">+ Nuevo pedido</button>
    ${
      pedidos.length
        ? `<div class="tabla-wrap"><table class="tabla"><thead><tr>
      <th>Nombre</th><th>Cant.</th><th>Precio</th><th>Saldo</th><th>Estado</th><th>Entrega</th><th></th>
    </tr></thead><tbody>
      ${pedidos
        .map(
          (t) => `
        <tr>
          <td>${escaparHtml(t.nombre)}</td>
          <td>${t.cantidad}</td>
          <td>${formatearMoneda(t.precio)}</td>
          <td>${formatearMoneda(t.saldo)}</td>
          <td><span class="badge badge--${t.estado}">${ETIQUETAS_ESTADO[t.estado]}</span></td>
          <td>${t.fechaEntrega ? formatearFecha(t.fechaEntrega) : '-'}</td>
          <td>
            <button type="button" class="boton boton--pequeno" data-editar-pedido="${t.id}">✏️</button>
            <button type="button" class="boton boton--pequeno boton--peligro" data-eliminar-pedido="${t.id}">🗑️</button>
          </td>
        </tr>`
        )
        .join('')}
    </tbody></table></div>`
        : '<p class="vacio">Este cliente aún no tiene pedidos.</p>'
    }
  `;
  document.getElementById('btnNuevoPedido').addEventListener('click', () => abrirModalPedido(cliente.id, null));
  cont.querySelectorAll('[data-editar-pedido]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const t = pedidos.find((x) => x.id === Number(btn.dataset.editarPedido));
      abrirModalPedido(cliente.id, t);
    });
  });
  cont.querySelectorAll('[data-eliminar-pedido]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const t = pedidos.find((x) => x.id === Number(btn.dataset.eliminarPedido));
      abrirModal({
        titulo: 'Eliminar pedido',
        contenidoHtml: `<p>¿Eliminar "<strong>${escaparHtml(t.nombre)}</strong>"? Esta acción no se puede deshacer.</p>`,
        botones: [
          { texto: 'Cancelar', tipo: 'secundario', onClick: cerrarModal },
          {
            texto: 'Eliminar',
            tipo: 'peligro',
            onClick: () => {
              eliminarPedido(t.id);
              marcarSinGuardar();
              cerrarModal();
              renderizarListaClientes();
              renderizarContenido();
              toast('Pedido eliminado', 'exito');
            },
          },
        ],
      });
    });
  });
}

function abrirModalPedido(clienteId, pedidoExistente) {
  const hoyISO = new Date().toISOString().slice(0, 10);
  const t = pedidoExistente;
  const modal = abrirModal({
    titulo: t ? 'Editar pedido' : 'Nuevo pedido',
    contenidoHtml: `
      <form class="form" id="formPedido">
        <label>Nombre <input type="text" name="nombre" value="${t ? escaparHtml(t.nombre) : ''}" required /></label>
        <label>Descripción <textarea name="descripcion" rows="2">${t ? escaparHtml(t.descripcion || '') : ''}</textarea></label>
        <div class="form-fila">
          <label>Cantidad <input type="number" name="cantidad" min="1" step="1" value="${t ? t.cantidad : 1}" /></label>
          <label>Precio unitario <input type="number" name="precioUnitario" min="0" step="0.01" value="${t ? (t.precioUnitario !== undefined && t.precioUnitario !== null ? t.precioUnitario : t.precio / (t.cantidad || 1)) : 0}" /></label>
        </div>
        <label>Precio final <input type="number" name="precio" min="0" step="0.01" value="${t ? t.precio : 0}" /></label>
        <label>Estado
          <select name="estado">
            ${ESTADOS_TRABAJO.map((e) => `<option value="${e}" ${t && t.estado === e ? 'selected' : ''}>${ETIQUETAS_ESTADO[e]}</option>`).join('')}
          </select>
        </label>
        <div class="form-fila">
          <label>Fecha <input type="date" name="fecha" value="${t ? t.fecha.slice(0, 10) : hoyISO}" /></label>
          <label>Fecha de entrega <input type="date" name="fechaEntrega" value="${t && t.fechaEntrega ? t.fechaEntrega.slice(0, 10) : ''}" /></label>
        </div>
      </form>
    `,
    botones: [
      { texto: 'Cancelar', tipo: 'secundario', onClick: cerrarModal },
      {
        texto: t ? 'Guardar cambios' : 'Crear pedido',
        tipo: 'primario',
        onClick: (modalEl) => {
          const form = modalEl.querySelector('#formPedido');
          if (!form.nombre.value.trim()) {
            toast('El nombre es obligatorio', 'error');
            return;
          }
          const datosForm = {
            nombre: form.nombre.value.trim(),
            descripcion: form.descripcion.value.trim(),
            cantidad: form.cantidad.value,
            precioUnitario: form.precioUnitario.value,
            precio: form.precio.value,
            estado: form.estado.value,
            fecha: form.fecha.value,
            fechaEntrega: form.fechaEntrega.value || null,
          };
          if (t) editarPedido(t.id, datosForm);
          else crearPedido(clienteId, datosForm);
          marcarSinGuardar();
          cerrarModal();
          renderizarListaClientes();
          renderizarContenido();
          toast(t ? 'Pedido actualizado' : 'Pedido creado', 'exito');
        },
      },
    ],
  });
  const form = modal.querySelector('#formPedido');
  function recalc() {
    const cant = Math.max(Number(form.cantidad.value) || 1, 1);
    const unit = Number(form.precioUnitario.value) || 0;
    form.precio.value = (cant * unit).toFixed(2);
  }
  form.cantidad.addEventListener('input', recalc);
  form.precioUnitario.addEventListener('input', recalc);
}

function renderizarTabPagos(cont, cliente) {
  const pagos = pagosDeCliente(cliente.id);
  const pedidos = pedidosDeCliente(cliente.id);
  const nombrePorPedido = new Map(pedidos.map((t) => [t.id, t.nombre]));
  const totalConfirmado = pedidos.filter(esPedidoConfirmado).reduce((a, t) => a + (Number(t.precio) || 0), 0);
  const totalPagado = pagos.reduce((a, p) => a + (Number(p.monto) || 0), 0);

  cont.innerHTML = `
    <h2 class="titulo-cliente">Pagos de ${escaparHtml(cliente.nombre)}</h2>
    <div class="grid-stats" style="max-width:520px;">
      <div class="stat"><div class="stat__valor">${formatearMoneda(totalConfirmado)}</div><div class="stat__etiqueta">Total</div></div>
      <div class="stat"><div class="stat__valor">${formatearMoneda(totalPagado)}</div><div class="stat__etiqueta">Pagado</div></div>
      <div class="stat"><div class="stat__valor">${formatearMoneda(cliente.saldoPendiente)}</div><div class="stat__etiqueta">Saldo</div></div>
    </div>
    <button type="button" class="boton boton--primario" id="btnNuevoPago" style="margin-bottom:14px;">+ Registrar pago</button>
    ${
      pagos.length
        ? `<div class="tabla-wrap"><table class="tabla"><thead><tr><th>Monto</th><th>Método</th><th>Pedido</th><th>Fecha</th><th></th></tr></thead><tbody>
      ${pagos
        .map(
          (p) => `<tr>
        <td>${formatearMoneda(p.monto)}</td>
        <td>${escaparHtml(p.metodo)}</td>
        <td>${p.trabajoId ? escaparHtml(nombrePorPedido.get(p.trabajoId) || 'pedido eliminado') : 'General'}</td>
        <td>${formatearFechaHora(p.fecha)}</td>
        <td>
          <button type="button" class="boton boton--pequeno" data-editar-pago="${p.id}">✏️</button>
          <button type="button" class="boton boton--pequeno boton--peligro" data-eliminar-pago="${p.id}">🗑️</button>
        </td>
      </tr>`
        )
        .join('')}
    </tbody></table></div>`
        : '<p class="vacio">Aún no hay pagos registrados.</p>'
    }
  `;
  document.getElementById('btnNuevoPago').addEventListener('click', () => abrirModalPago(cliente.id, null));
  cont.querySelectorAll('[data-editar-pago]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const p = pagos.find((x) => x.id === Number(btn.dataset.editarPago));
      abrirModalPago(cliente.id, p);
    });
  });
  cont.querySelectorAll('[data-eliminar-pago]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const p = pagos.find((x) => x.id === Number(btn.dataset.eliminarPago));
      abrirModal({
        titulo: 'Eliminar pago',
        contenidoHtml: `<p>¿Eliminar el pago de <strong>${formatearMoneda(p.monto)}</strong>? El saldo se recalcula solo.</p>`,
        botones: [
          { texto: 'Cancelar', tipo: 'secundario', onClick: cerrarModal },
          {
            texto: 'Eliminar',
            tipo: 'peligro',
            onClick: () => {
              eliminarPago(p.id);
              marcarSinGuardar();
              cerrarModal();
              renderizarListaClientes();
              renderizarContenido();
              toast('Pago eliminado', 'exito');
            },
          },
        ],
      });
    });
  });
}

function abrirModalPago(clienteId, pagoExistente) {
  const p = pagoExistente;
  const pedidos = pedidosDeCliente(clienteId).filter(
    (t) => t.estado !== 'cancelado' && ((Number(t.saldo) || 0) > 0 || (p && p.trabajoId === t.id))
  );
  const opciones = pedidos
    .map((t) => `<option value="${t.id}" ${p && p.trabajoId === t.id ? 'selected' : ''}>${escaparHtml(t.nombre)}</option>`)
    .join('');

  abrirModal({
    titulo: p ? 'Editar pago' : 'Registrar pago',
    contenidoHtml: `
      <form class="form" id="formPago">
        <label>Pedido asociado (opcional)
          <select name="trabajoId">
            <option value="" ${!p || !p.trabajoId ? 'selected' : ''}>Pago general</option>
            ${opciones}
          </select>
        </label>
        <label>Monto <input type="number" name="monto" min="0" step="0.01" value="${p ? p.monto : ''}" required /></label>
        <label>Método <input type="text" name="metodo" value="${p ? escaparHtml(p.metodo) : ''}" placeholder="Yape, efectivo, transferencia..." /></label>
        <label>Observaciones <textarea name="observaciones" rows="2">${p ? escaparHtml(p.observaciones || '') : ''}</textarea></label>
      </form>
    `,
    botones: [
      { texto: 'Cancelar', tipo: 'secundario', onClick: cerrarModal },
      {
        texto: p ? 'Guardar cambios' : 'Registrar',
        tipo: 'primario',
        onClick: (modalEl) => {
          const form = modalEl.querySelector('#formPago');
          const monto = Number(form.monto.value);
          if (!monto || monto <= 0) {
            toast('Ingresa un monto válido', 'error');
            return;
          }
          const datosForm = {
            monto,
            metodo: form.metodo.value.trim(),
            observaciones: form.observaciones.value.trim(),
            trabajoId: form.trabajoId.value ? Number(form.trabajoId.value) : null,
          };
          if (p) editarPago(p.id, datosForm);
          else registrarPago(clienteId, datosForm.trabajoId, datosForm);
          marcarSinGuardar();
          cerrarModal();
          renderizarListaClientes();
          renderizarContenido();
          toast(p ? 'Pago actualizado' : 'Pago registrado', 'exito');
        },
      },
    ],
  });
}

function renderizarTabArchivos(cont, cliente) {
  const archivos = archivosDeCliente(cliente.id);
  cont.innerHTML = `
    <h2 class="titulo-cliente">Archivos de ${escaparHtml(cliente.nombre)}</h2>
    ${
      archivos.length
        ? `<div class="archivos-grid">
      ${archivos
        .map(
          (a) => `
        <div class="archivo-card" data-id="${a.id}">
          ${a.contenidoBase64 ? `<img src="${a.contenidoBase64}" data-ver="${a.id}" alt="${escaparHtml(a.nombre)}" />` : ''}
          <div class="archivo-card__nombre">${escaparHtml(a.nombre)}</div>
          <div class="archivo-card__meta">${escaparHtml(a.tipo)} · ${formatearFecha(a.fecha)}</div>
          <button type="button" class="archivo-card__eliminar" data-eliminar-archivo="${a.id}" title="Eliminar">✕</button>
        </div>`
        )
        .join('')}
    </div>`
        : '<p class="vacio">Sin archivos asociados.</p>'
    }
  `;
  cont.querySelectorAll('[data-ver]').forEach((img) => {
    img.addEventListener('click', () => {
      const a = archivos.find((x) => x.id === Number(img.dataset.ver));
      abrirModal({
        titulo: a.nombre,
        contenidoHtml: `<img src="${a.contenidoBase64}" class="preview" alt="Vista previa" />`,
        botones: [{ texto: 'Cerrar', tipo: 'secundario', onClick: cerrarModal }],
      });
    });
  });
  cont.querySelectorAll('[data-eliminar-archivo]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const a = archivos.find((x) => x.id === Number(btn.dataset.eliminarArchivo));
      abrirModal({
        titulo: 'Eliminar archivo',
        contenidoHtml: `<p>¿Eliminar "<strong>${escaparHtml(a.nombre)}</strong>"?</p>`,
        botones: [
          { texto: 'Cancelar', tipo: 'secundario', onClick: cerrarModal },
          {
            texto: 'Eliminar',
            tipo: 'peligro',
            onClick: () => {
              eliminarArchivo(a.id);
              marcarSinGuardar();
              cerrarModal();
              renderizarContenido();
              toast('Archivo eliminado', 'exito');
            },
          },
        ],
      });
    });
  });
}

function renderizarTabHistorial(cont, cliente) {
  const eventos = historialDeCliente(cliente.id);
  cont.innerHTML = `
    <h2 class="titulo-cliente">Historial de ${escaparHtml(cliente.nombre)}</h2>
    ${
      eventos.length
        ? `<div class="tabla-wrap"><table class="tabla"><thead><tr><th>Fecha</th><th>Evento</th></tr></thead><tbody>
      ${eventos.map((h) => `<tr><td>${formatearFechaHora(h.fecha)}</td><td>${escaparHtml(h.descripcion)}</td></tr>`).join('')}
    </tbody></table></div>`
        : '<p class="vacio">Sin eventos registrados.</p>'
    }
  `;
}

function abrirModalNuevoCliente() {
  const modal = abrirModal({
    titulo: 'Nuevo cliente',
    contenidoHtml: `
      <form class="form" id="formNuevoCliente">
        <label>Nombre <input type="text" name="nombre" required /></label>
        <label>Número (opcional) <input type="text" name="numero" placeholder="Ej: 51987654321" /></label>
      </form>
    `,
    botones: [
      { texto: 'Cancelar', tipo: 'secundario', onClick: cerrarModal },
      {
        texto: 'Crear',
        tipo: 'primario',
        onClick: (modalEl) => {
          const form = modalEl.querySelector('#formNuevoCliente');
          if (!form.nombre.value.trim()) {
            toast('El nombre es obligatorio', 'error');
            return;
          }
          const c = crearCliente({ nombre: form.nombre.value.trim(), numero: form.numero.value.trim() });
          marcarSinGuardar();
          cerrarModal();
          state.clienteSeleccionadoId = c.id;
          state.tabActiva = 'cliente';
          toast('Cliente creado', 'exito');
          renderizarTodo();
        },
      },
    ],
  });
  modal.querySelector('input[name="nombre"]').focus();
}

// =========================================================================
// Inicialización
// =========================================================================

document.getElementById('btnConectar').addEventListener('click', conectarConGoogle);

document.getElementById('btnRecargar').addEventListener('click', async () => {
  if (state.sinGuardar && !confirm('Tienes cambios sin guardar que se perderán al recargar. ¿Seguro que quieres continuar?')) {
    return;
  }
  try {
    await cargarDesdeGoogleDrive();
    toast('Datos actualizados desde Google Drive', 'exito');
  } catch (err) {
    toast(err.message || 'No se pudo recargar', 'error');
  }
});

document.getElementById('btnGuardar').addEventListener('click', guardarEnGoogleDrive);

inicializarGoogle();
