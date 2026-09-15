# PrintCRM Web

Editor web **independiente** para ver y editar tus datos de PrintCRM (clientes, pedidos, pagos, archivos, historial) desde cualquier navegador, en cualquier parte — sin depender de tener la extensión instalada ni de haberla usado antes. Puedes empezar de cero directamente desde acá, o seguir usando el mismo respaldo que ya tenías si ya usas la extensión: ambos leen y escriben el mismo archivo (`printcrm-backup.json`) en tu Google Drive, así que lo que hagas en un lado se refleja en el otro.

No necesita instalación ni servidor propio: son 2 archivos (`index.html` y `app.js`) que puedes abrir directo en el navegador o publicar gratis con GitHub Pages.

## Sobre la seguridad: no hace falta restringir por correo

Esta página queda pública en GitHub (cualquiera con el link puede abrirla), pero eso no es un problema real: usa el scope `drive.file` de Google, que solo deja ver los archivos que la propia app creó **dentro de la cuenta de Google con la que cada quien inicia sesión**. Si alguien más abre esta página y se conecta con su propia cuenta, jamás va a poder ver tu archivo `printcrm-backup.json` — es privado en tu Drive, no está compartido con nadie. El aislamiento lo da Google Drive mismo, sin necesidad de ninguna verificación extra.

## Publicar en GitHub Pages (gratis, ~5 minutos)

1. Crea un repositorio nuevo en GitHub (puede ser privado o público).
2. Sube estos dos archivos (`index.html` y `app.js`) a la raíz del repositorio.
3. Ve a **Settings → Pages** del repositorio → en "Source" elige la rama (`main`) y la carpeta raíz (`/`) → Guardar.
4. GitHub te da una URL tipo `https://tu-usuario.github.io/tu-repo/` — esa es la dirección de tu editor. Puedes guardarla como acceso directo en tu celular, tablet o cualquier otra computadora.

## Configurar Google Cloud (una sola vez)

Esta página usa el **mismo Client ID de Google** que ya configuraste para la extensión (está escrito directamente en `app.js`, en la constante `CLIENT_ID` al inicio del archivo — los Client ID son públicos por diseño, a diferencia del Client Secret, que esta página nunca usa ni necesita).

Para que Google la deje usar ese Client ID desde tu nueva URL de GitHub Pages:

1. Entra a [Google Cloud Console](https://console.cloud.google.com/) → tu proyecto → **APIs y servicios → Credenciales**.
2. Abre el cliente OAuth de tipo **"Aplicación web"** (el mismo que usa la extensión).
3. En **"Orígenes de JavaScript autorizados"**, agrega tu URL de GitHub Pages, **sin barra al final**, por ejemplo:
   ```
   https://tu-usuario.github.io
   ```
4. Guardar. Puede tardar unos minutos en aplicarse.
5. Abre tu página, dale **"🔗 Conectar con Google"**, e inicia sesión con tu cuenta de Google (la misma que usas en la extensión, si ya la tienes).

## Primer uso: empezar de cero o seguir con lo que ya tenías

- **Si nunca usaste la extensión (o quieres arrancar desde acá)**: al conectar, la página te va a avisar que no encontró ningún respaldo, y te ofrece un botón **"➕ Empezar de cero"** que crea una base de datos vacía en tu Drive, lista para que agregues tu primer cliente ahí mismo.
- **Si ya usas la extensión**: al conectar, va a encontrar el respaldo que la extensión ya subió, y vas a ver tus datos reales de una vez.

## Qué puedes hacer desde acá

- **Resumen general**: estadísticas (clientes, cotizaciones, pedidos activos/terminados, cobrado, pendiente, facturado) y la lista de clientes con deuda.
- **Por cliente**: editar nombre, número, rol de precio y observaciones; eliminar el cliente (y todos sus datos).
- **Pedidos**: crear, editar (con el mismo cálculo automático Cantidad × Precio unitario que la extensión, y precio final editable a mano) y eliminar.
- **Pagos**: registrar, editar y eliminar — con el mismo reparto automático entre pedidos pendientes cuando el pago es "general" (sin pedido asociado).
- **Archivos**: ver las imágenes guardadas (clic para verlas en grande) y eliminarlas. No se pueden agregar archivos nuevos desde acá (eso requiere capturarlos del chat de WhatsApp, que solo la extensión puede hacer).
- **Historial**: solo lectura.

Todo lo que edites queda en memoria hasta que le des **"💾 Guardar cambios"** arriba — ahí recién se sube a Google Drive. Si cierras la pestaña con cambios sin guardar, el navegador te va a avisar.

## Limitaciones honestas

- **Un solo usuario a la vez.** Esto asume que tú eres la única persona editando (desde un dispositivo a la vez, ya sea la extensión o esta página). Si editas en dos lugares al mismo tiempo, el que guarde último sobreescribe por completo los datos del que guardó antes — no hay fusión automática de cambios.
- **No se pueden agregar archivos nuevos** desde esta página (solo verlos y eliminarlos), porque no hay forma de "capturar" una imagen de WhatsApp fuera de la extensión.
- **La Calculadora de presupuestos no está acá.** Esta página es para ver y corregir datos, no para generar nuevas cotizaciones — para eso, usa la extensión.
