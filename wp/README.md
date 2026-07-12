# Cuaderno de Fiados 📒

Una libreta digital para llevar el control de quién te debe, cuánto,
con foto de referencia — y un botoncito en WhatsApp Web para acceder
directo a la ficha del cliente que tenés abierto en el chat.

## Cómo funciona

- **`index.html` / `style.css` / `app.js`** → tu página, la subís a
  GitHub Pages. Guarda todo en tu navegador (IndexedDB), no necesita
  servidor ni base de datos externa.
- **`extension/`** → una extensión de Chrome que agrega un botón
  "💰 Ver deuda" en el header de cada chat de WhatsApp Web. Al
  tocarlo, abre tu página con el número de teléfono de ese chat, y
  la página te muestra al toque si ese cliente debe o está al día.

No lee tus mensajes ni los envía automáticamente — solo detecta con
qué número estás chateando y te lleva a tu ficha.

---

## Paso 1: Publicar la página en GitHub Pages

1. Creá un repositorio nuevo en GitHub (público), por ejemplo
   `cuaderno-fiados`.
2. Subí estos archivos a la raíz del repo: `index.html`, `style.css`,
   `app.js`.
3. Andá a **Settings → Pages** en tu repo.
4. En "Source" elegí la rama `main` y carpeta `/ (root)`. Guardá.
5. En 1-2 minutos tu página va a estar en:
   `https://TU-USUARIO.github.io/cuaderno-fiados/`

Probala abriéndola directo en el navegador y agregá un par de
clientes de prueba.

> ⚠️ Los datos se guardan en el navegador de cada dispositivo
> (IndexedDB). Si abrís la página desde otra computadora o borrás
> el historial del navegador, no vas a ver los mismos clientes. Es
> la forma más simple de arrancar sin backend; si más adelante
> querés que los datos se sincronicen entre dispositivos, se puede
> migrar a una base de datos gratuita (Firebase, Supabase) — avisame
> y lo armamos.

## Paso 2: Configurar la extensión

1. Abrí `extension/content.js`.
2. Reemplazá esta línea con la URL real de tu página (la del Paso 1):

   ```js
   const CONFIG = {
     BASE_URL: "https://TU-USUARIO.github.io/cuaderno-fiados/"
   };
   ```

## Paso 3: Instalar la extensión en Chrome

1. Andá a `chrome://extensions`.
2. Activá **"Modo de desarrollador"** (arriba a la derecha).
3. Tocá **"Cargar descomprimida"** (Load unpacked).
4. Seleccioná la carpeta `extension/`.
5. Abrí [web.whatsapp.com](https://web.whatsapp.com), abrí cualquier
   chat, y deberías ver el botón **"💰 Ver deuda"** en el header.

---

## Cosas a tener en cuenta

- **WhatsApp actualiza seguido su interfaz.** El script que detecta
  el número de teléfono busca patrones en el HTML de WhatsApp Web;
  si en algún momento WhatsApp cambia su estructura interna, el botón
  puede dejar de detectar el número correctamente. Si eso pasa, avisame
  y ajustamos el selector.
- **Términos de servicio de WhatsApp:** esta extensión solo *lee*
  información visible en pantalla para armar un enlace — no automatiza
  el envío de mensajes ni simula ser otro cliente de WhatsApp, que es
  lo que suele generar bloqueos de cuenta. Aun así, usalo con criterio.
- **Imágenes de referencia:** se comprimen automáticamente antes de
  guardarse para no ocupar demasiado espacio en el navegador.

## Posibles mejoras a futuro

- Sincronizar los datos entre dispositivos (Firebase/Supabase).
- Que el botón de la extensión muestre el monto de la deuda
  directamente, sin tener que abrir la página (requiere conectar la
  extensión y la página mediante `chrome.storage` + mensajería).
- Usar un modelo de Hugging Face para leer automáticamente montos
  desde una foto de un recibo/comprobante (OCR).
