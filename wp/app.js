/* =========================================================
   Cuaderno de Fiados — lógica principal
   Guarda todo en un archivo JSON local en tu computadora
   (usando la File System Access API de Chrome/Edge), con
   respaldo en localStorage para navegadores sin esa función.
   ========================================================= */

const FS_API_SOPORTADA = "showSaveFilePicker" in window;

let fileHandle = null;          // handle del archivo local (solo si FS_API_SOPORTADA)
let datosApp = { clientes: {} }; // { clientes: { "<telefono>": {...} } }
let clienteActivo = null;

const pantallaArchivo = document.getElementById("pantallaArchivo");
const appContenido = document.getElementById("appContenido");
const bannerSoporte = document.getElementById("bannerSoporte");
const btnCambiarArchivo = document.getElementById("btnCambiarArchivo");

let handlePendienteReconexion = null;

/* ---------- IndexedDB: solo para recordar el handle del archivo ---------- */

const HANDLE_DB = "cuadernoFiadosHandleDB";

function abrirHandleDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(HANDLE_DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore("handles");
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function guardarHandleRecordado(handle) {
  const hdb = await abrirHandleDB();
  return new Promise((resolve, reject) => {
    const tx = hdb.transaction("handles", "readwrite");
    tx.objectStore("handles").put(handle, "archivoDeudas");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function recuperarHandleRecordado() {
  const hdb = await abrirHandleDB();
  return new Promise((resolve, reject) => {
    const tx = hdb.transaction("handles", "readonly");
    const req = tx.objectStore("handles").get("archivoDeudas");
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

/* ---------- carga / guardado de datos ---------- */

async function cargarDesdeArchivo() {
  const file = await fileHandle.getFile();
  const texto = await file.text();
  datosApp = texto.trim() ? JSON.parse(texto) : { clientes: {} };
  if (!datosApp.clientes) datosApp.clientes = {};
}

function cargarDesdeLocalStorage() {
  const raw = localStorage.getItem("cuadernoFiadosDatos");
  datosApp = raw ? JSON.parse(raw) : { clientes: {} };
}

async function guardarDatosPersistente() {
  if (fileHandle) {
    const writable = await fileHandle.createWritable();
    await writable.write(JSON.stringify(datosApp, null, 2));
    await writable.close();
  } else {
    localStorage.setItem("cuadernoFiadosDatos", JSON.stringify(datosApp));
  }
}

/* ---------- arranque: elegir/reconectar archivo o usar respaldo local ---------- */

async function iniciar() {
  if (!FS_API_SOPORTADA) {
    cargarDesdeLocalStorage();
    bannerSoporte.hidden = false;
    mostrarApp();
    return;
  }

  const handleGuardado = await recuperarHandleRecordado().catch(() => null);
  if (handleGuardado) {
    const permiso = await handleGuardado.queryPermission({ mode: "readwrite" });
    if (permiso === "granted") {
      fileHandle = handleGuardado;
      await cargarDesdeArchivo();
      mostrarApp();
      return;
    }
    // Existe un archivo recordado pero el navegador necesita que confirmes
    // el permiso con un clic (medida de seguridad del navegador).
    handlePendienteReconexion = handleGuardado;
    document.getElementById("gateTexto").textContent =
      "Encontramos tu archivo de datos, solo falta confirmar el permiso para volver a usarlo.";
    document.getElementById("btnElegirArchivo").textContent = "Reconectar archivo de datos";
    return;
  }

  // primera vez: pantallaArchivo ya está visible con su texto por defecto
}

function mostrarApp() {
  pantallaArchivo.hidden = true;
  appContenido.hidden = false;
  btnCambiarArchivo.hidden = !FS_API_SOPORTADA;
  renderLista();
  manejarParametrosURL();
}

document.getElementById("btnElegirArchivo").addEventListener("click", async () => {
  try {
    if (handlePendienteReconexion) {
      const permiso = await handlePendienteReconexion.requestPermission({ mode: "readwrite" });
      if (permiso !== "granted") {
        alert("No se concedió permiso para usar el archivo.");
        return;
      }
      fileHandle = handlePendienteReconexion;
    } else {
      fileHandle = await window.showSaveFilePicker({
        suggestedName: "deudas.json",
        types: [{ description: "Archivo JSON", accept: { "application/json": [".json"] } }]
      });
      await guardarHandleRecordado(fileHandle);
    }
    await cargarDesdeArchivo();
    mostrarApp();
  } catch (err) {
    if (err.name !== "AbortError") alert("No se pudo abrir el archivo: " + err.message);
  }
});

btnCambiarArchivo.addEventListener("click", async () => {
  try {
    const nuevoHandle = await window.showSaveFilePicker({
      suggestedName: "deudas.json",
      types: [{ description: "Archivo JSON", accept: { "application/json": [".json"] } }]
    });
    fileHandle = nuevoHandle;
    await guardarHandleRecordado(fileHandle);
    await cargarDesdeArchivo();
    await renderLista(document.getElementById("buscador").value);
  } catch (err) {
    if (err.name !== "AbortError") alert("No se pudo cambiar de archivo: " + err.message);
  }
});

/* ---------- exportar / importar copia manual (funciona siempre) ---------- */

document.getElementById("btnExportar").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(datosApp, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "deudas-respaldo-" + new Date().toISOString().slice(0, 10) + ".json";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
});

document.getElementById("btnImportarInput").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  if (!confirm("Esto reemplaza todos los datos actuales por los del archivo importado. ¿Continuar?")) {
    e.target.value = "";
    return;
  }
  try {
    const texto = await file.text();
    const nuevo = JSON.parse(texto);
    datosApp = nuevo && nuevo.clientes ? nuevo : { clientes: {} };
    await guardarDatosPersistente();
    await renderLista(document.getElementById("buscador").value);
  } catch (err) {
    alert("El archivo no es un JSON válido de este cuaderno.");
  }
  e.target.value = "";
});

/* ---------- capa de datos (en memoria + persistencia) ---------- */

function getAllClientes() {
  return Promise.resolve(Object.values(datosApp.clientes));
}

function getCliente(telefono) {
  return Promise.resolve(datosApp.clientes[telefono] || null);
}

async function guardarCliente(cliente) {
  datosApp.clientes[cliente.telefono] = cliente;
  await guardarDatosPersistente();
}

async function eliminarClienteDB(telefono) {
  delete datosApp.clientes[telefono];
  await guardarDatosPersistente();
}

/* ---------- utilidades ---------- */

function soloDigitos(str) {
  return (str || "").replace(/\D/g, "");
}

function formatoMonto(n) {
  return "S/ " + (Math.round(n * 100) / 100).toFixed(2);
}

function calcularSaldo(cliente) {
  return (cliente.movimientos || []).reduce((acc, m) => {
    return acc + (m.tipo === "deuda" ? m.monto : -m.monto);
  }, 0);
}

function formatoFecha(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString("es-PE", { day: "2-digit", month: "short" }) +
         " " + d.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" });
}

// Comprime una imagen a un dataURL liviano antes de guardarla
// (el archivo JSON crece rápido con imágenes sin comprimir)
function comprimirImagen(file, maxAncho = 500, calidad = 0.7) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const escala = Math.min(1, maxAncho / img.width);
        const canvas = document.createElement("canvas");
        canvas.width = img.width * escala;
        canvas.height = img.height * escala;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", calidad));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/* ---------- render: lista principal ---------- */

async function renderLista(filtro = "") {
  const clientes = await getAllClientes();
  const cont = document.getElementById("listaClientes");
  const emptyState = document.getElementById("emptyState");
  cont.innerHTML = "";

  const filtroNorm = filtro.trim().toLowerCase();
  const filtrados = clientes.filter(c => {
    if (!filtroNorm) return true;
    return c.nombre.toLowerCase().includes(filtroNorm) || c.telefono.includes(filtroNorm);
  }).sort((a, b) => calcularSaldo(b) - calcularSaldo(a));

  emptyState.hidden = clientes.length > 0;

  let totalPorCobrar = 0;
  clientes.forEach(c => { totalPorCobrar += Math.max(0, calcularSaldo(c)); });
  document.getElementById("totalPorCobrar").textContent = formatoMonto(totalPorCobrar);

  filtrados.forEach(c => {
    const saldo = calcularSaldo(c);
    const fila = document.createElement("div");
    fila.className = "fila-cliente";
    fila.tabIndex = 0;

    const avatarHTML = c.imagen
      ? `<img class="fila-avatar" src="${c.imagen}" alt="">`
      : `<div class="fila-avatar placeholder">${c.nombre.charAt(0).toUpperCase()}</div>`;

    fila.innerHTML = `
      ${avatarHTML}
      <div class="fila-texto">
        <div class="fila-nombre">${escapeHTML(c.nombre)}</div>
        <div class="fila-telefono">${c.telefono}</div>
      </div>
      <div class="fila-saldo ${saldo > 0 ? "debe" : "aldia"}">
        ${saldo > 0 ? formatoMonto(saldo) : "Al día"}
      </div>
    `;
    fila.addEventListener("click", () => abrirDetalle(c.telefono));
    cont.appendChild(fila);
  });
}

function escapeHTML(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

/* ---------- modal: nuevo cliente ---------- */

const modalNuevo = document.getElementById("modalNuevo");
const formNuevo = document.getElementById("formNuevo");
const previewNuevo = document.getElementById("previewNuevo");
let imagenNuevoDataURL = null;

document.getElementById("btnNuevoCliente").addEventListener("click", () => abrirModalNuevo());

function abrirModalNuevo(telefonoPrellenado = "", nombrePrellenado = "") {
  formNuevo.reset();
  previewNuevo.hidden = true;
  imagenNuevoDataURL = null;
  document.getElementById("nuevoTelefono").value = telefonoPrellenado;
  document.getElementById("nuevoNombre").value = nombrePrellenado;
  modalNuevo.hidden = false;
  document.getElementById("nuevoNombre").focus();
}

document.getElementById("nuevoImagen").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  imagenNuevoDataURL = await comprimirImagen(file);
  previewNuevo.src = imagenNuevoDataURL;
  previewNuevo.hidden = false;
});

formNuevo.addEventListener("submit", async (e) => {
  e.preventDefault();
  const telefono = soloDigitos(document.getElementById("nuevoTelefono").value);
  const nombre = document.getElementById("nuevoNombre").value.trim();
  const montoInicial = parseFloat(document.getElementById("nuevoMonto").value) || 0;

  if (!telefono || !nombre) return;

  const existente = await getCliente(telefono);
  if (existente) {
    alert("Ya existe un cliente con ese número. Abriendo su ficha…");
    modalNuevo.hidden = true;
    abrirDetalle(telefono);
    return;
  }

  const movimientos = [];
  if (montoInicial > 0) {
    movimientos.push({ tipo: "deuda", monto: montoInicial, nota: "Deuda inicial", fecha: new Date().toISOString() });
  }

  const cliente = {
    telefono,
    nombre,
    imagen: imagenNuevoDataURL,
    movimientos
  };

  await guardarCliente(cliente);
  modalNuevo.hidden = true;
  await renderLista(document.getElementById("buscador").value);
});

/* ---------- modal: detalle cliente ---------- */

const modalDetalle = document.getElementById("modalDetalle");

async function abrirDetalle(telefono) {
  const c = await getCliente(telefono);
  if (!c) return;
  clienteActivo = telefono;
  pintarDetalle(c);
  modalDetalle.hidden = false;
}

function pintarDetalle(c) {
  const saldo = calcularSaldo(c);

  document.getElementById("detNombre").textContent = c.nombre;
  document.getElementById("detTelefono").textContent = c.telefono;

  const fotoEl = document.getElementById("detFoto");
  if (c.imagen) { fotoEl.src = c.imagen; fotoEl.hidden = false; } else { fotoEl.hidden = true; }

  const stamp = document.getElementById("detStamp");
  const saldoEl = document.getElementById("detSaldo");
  if (saldo > 0) {
    stamp.textContent = "Debe";
    stamp.className = "stamp debe";
    saldoEl.textContent = formatoMonto(saldo);
    saldoEl.style.color = "var(--debt-red)";
  } else {
    stamp.textContent = "Al día";
    stamp.className = "stamp aldia";
    saldoEl.textContent = "S/ 0.00";
    saldoEl.style.color = "var(--paid-green)";
  }

  const hist = document.getElementById("detHistorial");
  hist.innerHTML = "";
  const movs = [...(c.movimientos || [])].reverse();
  if (movs.length === 0) {
    hist.innerHTML = `<p style="color:var(--ink-soft);font-size:13px;">Sin movimientos todavía.</p>`;
  }
  movs.forEach(m => {
    const row = document.createElement("div");
    row.className = "mov-row";
    row.innerHTML = `
      <div>
        <div class="mov-fecha">${formatoFecha(m.fecha)}</div>
        ${m.nota ? `<div class="mov-nota">${escapeHTML(m.nota)}</div>` : ""}
      </div>
      <div class="mov-monto ${m.tipo}">${m.tipo === "deuda" ? "+" : "−"} ${formatoMonto(m.monto)}</div>
    `;
    hist.appendChild(row);
  });
}

document.getElementById("detImagenInput").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file || !clienteActivo) return;
  const c = await getCliente(clienteActivo);
  c.imagen = await comprimirImagen(file);
  await guardarCliente(c);
  pintarDetalle(c);
  await renderLista(document.getElementById("buscador").value);
});
document.querySelector(".cambiar-foto").addEventListener("click", () => {
  document.getElementById("detImagenInput").click();
});

document.getElementById("btnEliminarCliente").addEventListener("click", async () => {
  if (!clienteActivo) return;
  if (!confirm("¿Eliminar este cliente y todo su historial? Esta acción no se puede deshacer.")) return;
  await eliminarClienteDB(clienteActivo);
  modalDetalle.hidden = true;
  clienteActivo = null;
  await renderLista(document.getElementById("buscador").value);
});

/* ---------- mini-formulario: agregar deuda / abono ---------- */

const miniForm = document.getElementById("miniForm");
const miniFormTitulo = document.getElementById("miniFormTitulo");
const miniFormMonto = document.getElementById("miniFormMonto");
const miniFormNota = document.getElementById("miniFormNota");
let tipoMovimientoActual = null;

document.getElementById("btnAgregarDeuda").addEventListener("click", () => abrirMiniForm("deuda"));
document.getElementById("btnAgregarAbono").addEventListener("click", () => abrirMiniForm("abono"));

function abrirMiniForm(tipo) {
  tipoMovimientoActual = tipo;
  miniFormTitulo.textContent = tipo === "deuda" ? "Registrar nueva deuda" : "Registrar abono / adelanto";
  miniFormMonto.value = "";
  miniFormNota.value = "";
  miniForm.hidden = false;
  miniFormMonto.focus();
}

document.getElementById("miniFormCancelar").addEventListener("click", () => { miniForm.hidden = true; });

document.getElementById("miniFormGuardar").addEventListener("click", async () => {
  const monto = parseFloat(miniFormMonto.value);
  if (!monto || monto <= 0 || !clienteActivo) return;

  const c = await getCliente(clienteActivo);
  c.movimientos = c.movimientos || [];
  c.movimientos.push({
    tipo: tipoMovimientoActual,
    monto,
    nota: miniFormNota.value.trim(),
    fecha: new Date().toISOString()
  });
  await guardarCliente(c);
  miniForm.hidden = true;
  pintarDetalle(c);
  await renderLista(document.getElementById("buscador").value);
});

/* ---------- cerrar modales ---------- */

document.querySelectorAll("[data-close]").forEach(btn => {
  btn.addEventListener("click", (e) => {
    e.target.closest(".modal-backdrop").hidden = true;
    miniForm.hidden = true;
  });
});
document.querySelectorAll(".modal-backdrop").forEach(bg => {
  bg.addEventListener("click", (e) => {
    if (e.target === bg) { bg.hidden = true; miniForm.hidden = true; }
  });
});

/* ---------- búsqueda ---------- */

document.getElementById("buscador").addEventListener("input", (e) => {
  renderLista(e.target.value);
});

/* ---------- integración con la extensión de WhatsApp Web ----------
   La extensión abre esta página así:
   index.html?phone=51987654321&nombre=Juan%20Perez
   La comparamos contra los datos del archivo local: si el cliente
   ya existe, abrimos su ficha (mostrando si debe o está al día). Si
   no existe, abrimos el formulario de "nuevo cliente" prellenado.
------------------------------------------------------------------- */

async function manejarParametrosURL() {
  const params = new URLSearchParams(window.location.search);
  const telefono = soloDigitos(params.get("phone") || "");
  const nombre = params.get("nombre") || "";
  if (!telefono) return;

  const existente = await getCliente(telefono);
  if (existente) {
    abrirDetalle(telefono);
  } else {
    abrirModalNuevo(telefono, nombre);
  }
}

/* ---------- arranque ---------- */

iniciar();
