/* =========================================================
   Cuaderno de Fiados — content script para WhatsApp Web
   ---------------------------------------------------------
   IMPORTANTE: reemplazá BASE_URL por la URL real de tu
   página publicada en GitHub Pages antes de usar la extensión.
   Ejemplo: "https://tu-usuario.github.io/cuaderno-fiados/"
   ========================================================= */

const CONFIG = {
  BASE_URL: "https://TU-USUARIO.github.io/TU-REPOSITORIO/"
};

const BOTON_ID = "fiado-boton-flotante";

// WhatsApp Web guarda internamente el id del chat (algo como
// "51987654321@c.us") en atributos data-id de varios elementos
// del DOM. Lo buscamos como mejor esfuerzo: si WhatsApp cambia
// su estructura interna, este selector puede necesitar ajustes.
function extraerTelefonoDelChatActivo() {
  const candidatos = document.querySelectorAll('[data-id]');
  for (const el of candidatos) {
    const dataId = el.getAttribute('data-id') || '';
    const match = dataId.match(/(\d{5,15})@c\.us/);
    if (match) return match[1];
  }
  return null;
}

function extraerNombreDelChatActivo() {
  // El nombre visible suele estar en el header, en un span con "title"
  const header = document.querySelector('header');
  if (!header) return "";
  const spanTitulo = header.querySelector('span[title]');
  return spanTitulo ? spanTitulo.getAttribute('title') : "";
}

function crearBoton() {
  const btn = document.createElement("button");
  btn.id = BOTON_ID;
  btn.type = "button";
  btn.textContent = "💰 Ver deuda";
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    const telefono = extraerTelefonoDelChatActivo();
    const nombre = extraerNombreDelChatActivo();

    if (!telefono) {
      alert("No pude detectar el número de este chat. Probá abrir la info del contacto y volvé a intentar.");
      return;
    }

    const url = new URL(CONFIG.BASE_URL);
    url.searchParams.set("phone", telefono);
    if (nombre) url.searchParams.set("nombre", nombre);
    window.open(url.toString(), "_blank");
  });
  return btn;
}

function inyectarBotonSiHaceFalta() {
  const header = document.querySelector('header');
  if (!header) return;

  // Evitar duplicados
  if (document.getElementById(BOTON_ID)) return;

  // Solo inyectar si hay un chat realmente abierto (el header de un
  // chat abierto contiene un span[title] con el nombre del contacto)
  const spanTitulo = header.querySelector('span[title]');
  if (!spanTitulo) return;

  const contenedorAcciones = header.querySelector('header > div:last-child') || header;
  const btn = crearBoton();
  contenedorAcciones.appendChild(btn);
}

// WhatsApp Web es una SPA: observamos el DOM para detectar
// cuándo cambia de chat o se carga la interfaz.
const observer = new MutationObserver(() => {
  inyectarBotonSiHaceFalta();
});

observer.observe(document.body, { childList: true, subtree: true });

// primer intento por si el DOM ya estaba listo
inyectarBotonSiHaceFalta();
