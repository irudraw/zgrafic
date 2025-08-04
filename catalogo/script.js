// Constantes y variables globales
const SIMBOLO_MONEDA = 'S/.';
let productos = [];
let productosFiltrados = [];
let carrito = [];
let paginaActual = 1;
const productosPorPagina = 8;
let isScrolling = false;
let scrollAccumulator = 0;
const scrollThreshold = 1000;
let lastPageChangeTime = 0;
const pageChangeDelay = 200;
let categoriasUnicas = [];

// Funciones para cargar y mostrar productos
async function cargarProductos() {
    const versionAleatoria = Math.floor(Math.random() * 1000000);
    const url = `productos.json?v=${versionAleatoria}`;
    const respuesta = await fetch(url);
    productos = await respuesta.json();
    
    // Extraer categorías únicas de los productos
    categoriasUnicas = [...new Set(productos.map(p => p.categoria))].filter(Boolean).sort();
    
    // Obtener categoría de la URL
    const categoriaURL = obtenerParametroURL('categoria');
    
    productosFiltrados = categoriaURL 
        ? productos.filter(p => p.categoria === categoriaURL) 
        : [...productos];
    
    actualizarPaginacion();
    mostrarProductos();
    mostrarCategorias();
}

function toggleDarkTheme() {
    document.body.classList.toggle('dark-theme');
    // Guardar preferencia en localStorage si es necesario
    localStorage.setItem('darkTheme', document.body.classList.contains('dark-theme'));
}

// Nueva función para mostrar categorías
function mostrarCategorias() {
    const contenedor = document.querySelector('#categorias-fixed .categorias-container');
    if (!contenedor) return;
    
    contenedor.innerHTML = '';
    
    const categoriaActual = obtenerParametroURL('categoria');
    
    // Botón "Todos"
    const btnTodos = document.createElement('button');
    btnTodos.className = `categoria-btn ${!categoriaActual ? 'active' : ''}`;
    btnTodos.textContent = 'Todos';
    btnTodos.onclick = () => filtrarPorCategoria('');
    contenedor.appendChild(btnTodos);
    
    // Botones de categorías
    categoriasUnicas.forEach(categoria => {
        const btn = document.createElement('button');
        btn.className = `categoria-btn ${categoriaActual === categoria ? 'active' : ''}`;
        btn.textContent = categoria;
        btn.onclick = () => filtrarPorCategoria(categoria);
        contenedor.appendChild(btn);
    });
}

// Nueva función para filtrar por categoría
function filtrarPorCategoria(categoria) {
    // Actualizar URL
    const nuevaURL = categoria 
        ? `${window.location.pathname}?categoria=${encodeURIComponent(categoria)}` 
        : window.location.pathname;
    
    window.history.pushState({ path: nuevaURL }, '', nuevaURL);
    
    // Filtrar productos
    productosFiltrados = categoria 
        ? productos.filter(p => p.categoria === categoria) 
        : [...productos];
    
    paginaActual = 1;
    actualizarPaginacion();
    mostrarProductos();
    mostrarCategorias();
    
    // Scroll suave al inicio
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

let productoActual = null;

function mostrarProductos() {
    const contenedor = document.getElementById('productos');
    contenedor.innerHTML = '';
    
    const inicio = (paginaActual - 1) * productosPorPagina;
    const fin = inicio + productosPorPagina;
    const productosPagina = productosFiltrados.slice(inicio, fin);
    
    productosPagina.forEach((producto, index) => {
        const divProducto = document.createElement('div');
        divProducto.className = 'producto';
        divProducto.innerHTML = `
            <img src="${producto.imagen}" alt="${producto.nombre}" onclick="abrirProductoPopup(${producto.id})">
            <h3>${producto.nombre}</h3>
            <p class="precio">${producto.precio === 0 ? 'Cotizar' : `${SIMBOLO_MONEDA}${producto.precio.toFixed(2)}`}</p>
            <button onclick="agregarAlCarrito(${producto.id})">${producto.precio === 0 ? 'Solicitar cotización' : 'Agregar al carrito'}</button>
        `;
        contenedor.appendChild(divProducto);
        
        setTimeout(() => {
            divProducto.classList.add('aparecer');
        }, index * 100);
    });
}



function cerrarProductoPopup() {
    const popup = document.getElementById('producto-popup');
    popup.classList.remove('active');
    setTimeout(() => {
        popup.style.display = 'none';
    }, 300);
    
    // Limpiar parámetro de producto de la URL
    window.history.pushState({}, document.title, window.location.pathname);
}

// Funciones para el manejo del carrito
function agregarAlCarrito(id) {
    const producto = productos.find(p => p.id === id);
    const itemEnCarrito = carrito.find(item => item.id === id);

    if (itemEnCarrito) {
        itemEnCarrito.cantidad++;
    } else {
        carrito.push({ ...producto, cantidad: 1 });
    }

    actualizarCarrito();
    actualizarContadorCarrito();
    guardarCarritoEnLocalStorage();
    mostrarNotificacion(producto.precio === 0 ? 'Solicitud de cotización agregada' : 'Producto agregado al carrito');
}

function eliminarDelCarrito(id) {
    const index = carrito.findIndex(item => item.id === id);
    if (index !== -1) {
        if (carrito[index].cantidad > 1) {
            carrito[index].cantidad--;
        } else {
            carrito.splice(index, 1);
        }
    }
    actualizarCarrito();
    actualizarContadorCarrito();
    guardarCarritoEnLocalStorage();
}

function actualizarCarrito() {
    const listaCarrito = document.getElementById('carrito-items');
    const total = document.getElementById('carrito-total');
    
    listaCarrito.innerHTML = '';
    let suma = 0;
    let hayProductosCotizar = false;

    carrito.forEach(item => {
        const li = document.createElement('div');
        if (item.precio === 0) {
            li.innerHTML = `
                <img src="${item.imagen}" alt="${item.nombre}">
                <span>${item.nombre} - Cotizar x ${item.cantidad}</span>
                <button class="eliminar" onclick="eliminarDelCarrito(${item.id})"><i class="fas fa-trash"></i></button>
            `;
            hayProductosCotizar = true;
        } else {
            li.innerHTML = `
                <img src="${item.imagen}" alt="${item.nombre}">
                <span>${item.nombre} - ${SIMBOLO_MONEDA}${item.precio.toFixed(2)} x ${item.cantidad}</span>
                <button class="eliminar" onclick="eliminarDelCarrito(${item.id})"><i class="fas fa-trash"></i></button>
            `;
            suma += item.precio * item.cantidad;
        }
        listaCarrito.appendChild(li);
    });

    if (hayProductosCotizar) {
        if (suma > 0) {
            total.textContent = `Total: ${SIMBOLO_MONEDA}${suma.toFixed(2)} + Cotización`;
        } else {
            total.textContent = 'Total: Cotización';
        }
    } else {
        total.textContent = `Total: ${SIMBOLO_MONEDA}${suma.toFixed(2)}`;
    }
}

function actualizarContadorCarrito() {
    const contador = document.getElementById('contador');
    const totalItems = carrito.reduce((total, item) => total + item.cantidad, 0);
    contador.textContent = totalItems;
}

// Funciones para el manejo del almacenamiento local
function guardarCarritoEnLocalStorage() {
    localStorage.setItem('carrito', JSON.stringify(carrito));
}

function cargarCarritoDesdeLocalStorage() {
    const carritoGuardado = localStorage.getItem('carrito');
    if (carritoGuardado) {
        carrito = JSON.parse(carritoGuardado);
        actualizarCarrito();
        actualizarContadorCarrito();
    }
}

// Funciones para el manejo de popups
function abrirCarritoPopup() {
    const popup = document.getElementById('carrito-popup');
    popup.style.display = 'block';
    setTimeout(() => {
        popup.classList.add('active');
    }, 10);
}

function cerrarCarritoPopup() {
    const popup = document.getElementById('carrito-popup');
    popup.classList.remove('active');
    setTimeout(() => {
        popup.style.display = 'none';
    }, 300);
}
// Funciones para la búsqueda y paginación
function buscarProductos() {
    const textoBusqueda = document.getElementById('buscar-producto').value.toLowerCase();
    
    if (textoBusqueda.trim() === '') {
        productosFiltrados = [...productos];
    } else {
        productosFiltrados = productos.filter(producto => 
            producto.nombre.toLowerCase().includes(textoBusqueda) ||
            producto.descripcion.toLowerCase().includes(textoBusqueda)
        );
    }
    
    paginaActual = 1;
    actualizarPaginacion();
    mostrarProductos();
}

function actualizarPaginacion() {
    const totalPaginas = Math.ceil(productosFiltrados.length / productosPorPagina);
    document.getElementById('pagina-actual').textContent = paginaActual;
    document.getElementById('total-paginas').textContent = totalPaginas;
    
    const btnAnterior = document.getElementById('anterior');
    const btnSiguiente = document.getElementById('siguiente');
    
    btnAnterior.disabled = paginaActual === 1;
    btnSiguiente.disabled = paginaActual === totalPaginas;
    
    btnAnterior.style.opacity = paginaActual === 1 ? '0.5' : '1';
    btnSiguiente.style.opacity = paginaActual === totalPaginas ? '0.5' : '1';
}

function cambiarPagina(direccion) {
    const totalPaginas = Math.ceil(productosFiltrados.length / productosPorPagina);
    if (direccion === 'anterior' && paginaActual > 1) {
        paginaActual--;
    } else if (direccion === 'siguiente' && paginaActual < totalPaginas) {
        paginaActual++;
    } else {
        return;
    }
    actualizarPaginacion();
    
    const pageTransition = document.querySelector('.page-transition');
    pageTransition.classList.add('active');
    
    const productos = document.querySelectorAll('.producto');
    productos.forEach(producto => producto.classList.remove('aparecer'));
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    setTimeout(() => {
        mostrarProductos();
        pageTransition.classList.remove('active');
    }, 500);
}

// Función para mostrar notificaciones
function mostrarNotificacion(mensaje) {
    const notificacion = document.createElement('div');
    notificacion.textContent = mensaje;
    notificacion.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background-color: #4CAF50;
        color: white;
        padding: 10px 20px;
        border-radius: 5px;
        z-index: 1001;
        opacity: 0;
        transition: opacity 0.3s ease-in-out;
    `;
    document.body.appendChild(notificacion);

    setTimeout(() => {
        notificacion.style.opacity = '1';
    }, 10);

    setTimeout(() => {
        notificacion.style.opacity = '0';
        setTimeout(() => {
            document.body.removeChild(notificacion);
        }, 300);
    }, 3000);
}

// Función para ir al carrito completo
function irACarrito() {
    window.location.href = 'carrito.html';
}

// Eventos
document.addEventListener('DOMContentLoaded', () => {
    cargarProductos().then(() => {
        const productoId = obtenerParametroURL('producto');
        if (productoId) {
            const id = parseFloat(productoId);
            const productoExiste = productos.find(p => p.id === id);
            if (productoExiste) {
                abrirProductoPopup(id);
            }
        }
    });

    // Manejar cambios de estado (para navegación adelante/atrás)
    window.addEventListener('popstate', () => {
        const productoId = obtenerParametroURL('producto');
        if (productoId) {
            const id = parseFloat(productoId);
            const productoExiste = productos.find(p => p.id === id);
            if (productoExiste) {
                abrirProductoPopup(id);
            }
        } else {
            const categoriaURL = obtenerParametroURL('categoria');
            productosFiltrados = categoriaURL 
                ? productos.filter(p => p.categoria === categoriaURL) 
                : [...productos];
            paginaActual = 1;
            actualizarPaginacion();
            mostrarProductos();
            mostrarCategorias();
        }
    });
    
    cargarCarritoDesdeLocalStorage();

    document.getElementById('btn-buscar').addEventListener('click', buscarProductos);
    document.querySelector('#producto-popup .cerrar-popup').addEventListener('click', cerrarProductoPopup);
    // Reemplaza el evento keyup por input para tiempo real
    document.getElementById('buscar-producto').addEventListener('input', (e) => {
        buscarProductos();
    });

    document.getElementById('anterior').addEventListener('click', () => cambiarPagina('anterior'));
    document.getElementById('siguiente').addEventListener('click', () => cambiarPagina('siguiente'));

    document.getElementById('carrito-contador').addEventListener('click', abrirCarritoPopup);
    document.querySelector('.cerrar-popup').addEventListener('click', cerrarCarritoPopup);

    document.getElementById('ver-carrito-completo').addEventListener('click', irACarrito);

    // Cerrar el popup si se hace clic fuera de él
    window.addEventListener('click', (event) => {
        const popupCarrito = document.getElementById('carrito-popup');
        const popupProducto = document.getElementById('producto-popup');
        if (event.target === popupCarrito) {
            cerrarCarritoPopup();
        } else if (event.target === popupProducto) {
            cerrarProductoPopup();
        }
    });

    // Manejo del scroll para cambio de página
    window.addEventListener('wheel', (event) => {
        if (isScrolling) return;

        const currentTime = new Date().getTime();
        if (currentTime - lastPageChangeTime < pageChangeDelay) return;

        const scrollDirection = event.deltaY > 0 ? 'down' : 'up';
        const isAtBottom = (window.innerHeight + window.scrollY) >= document.body.offsetHeight - 100;
        const isAtTop = window.scrollY === 0;

        scrollAccumulator += Math.abs(event.deltaY);

        if (scrollAccumulator >= scrollThreshold) {
            if (scrollDirection === 'down' && isAtBottom) {
                isScrolling = true;
                cambiarPagina('siguiente');
                lastPageChangeTime = currentTime;
                setTimeout(() => { 
                    isScrolling = false; 
                    scrollAccumulator = 0;
                }, 1000);
            } else if (scrollDirection === 'up' && isAtTop) {
                isScrolling = true;
                cambiarPagina('anterior');
                lastPageChangeTime = currentTime;
                setTimeout(() => { 
                    isScrolling = false; 
                    scrollAccumulator = 0;
                }, 1000);
            } else {
                scrollAccumulator = 0;
            }
        }
    });

    // Reiniciar el acumulador cuando el usuario deja de desplazarse
    let scrollTimeout;
    window.addEventListener('scroll', () => {
        clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(() => {
            scrollAccumulator = 0;
        }, 500);
    });
});

// Función para actualizar la URL con el ID del producto
function actualizarURL(id) {
    const nuevaURL = window.location.origin + window.location.pathname + '?producto=' + id;
    window.history.pushState({ path: nuevaURL }, '', nuevaURL);
}

// Función para obtener parámetros de la URL
function obtenerParametroURL(nombre) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(nombre);
}

// ... (todo el código previo se mantiene igual) ...

// Modificar abrirProductoPopup para actualizar la URL
function abrirProductoPopup(id) {
    productoActual = productos.find(p => p.id === id);
    const popup = document.getElementById('producto-popup');
    const popupImagen = document.getElementById('popup-imagen');
    const popupNombre = document.getElementById('popup-nombre');
    const popupPrecio = document.getElementById('popup-precio');
    const popupDescripcion = document.getElementById('popup-descripcion');
    const popupAgregar = document.getElementById('popup-agregar');

    popupImagen.src = productoActual.imagen;
    popupImagen.alt = productoActual.nombre;
    popupNombre.textContent = productoActual.nombre;
    popupPrecio.textContent = productoActual.precio === 0 ? 'Cotizar' : `${SIMBOLO_MONEDA}${productoActual.precio.toFixed(2)}`;
    popupDescripcion.innerHTML = productoActual.descripcion.replace(/\n/g, '<br>');
    popupAgregar.textContent = productoActual.precio === 0 ? 'Solicitar cotización' : 'Agregar al carrito';
    popupAgregar.onclick = () => agregarAlCarrito(productoActual.id);

    popup.style.display = 'block';
    setTimeout(() => {
        popup.classList.add('active');
        configurarCapturaPopup();
    }, 10);
    
    // Actualizar URL con el ID del producto
    actualizarURL(id);
}

// Función para configurar el botón de captura
// Función principal de captura
async function capturarPopupConMarcaAgua() {
    try {
        const popup = document.getElementById('producto-popup');
        const popupContent = popup.querySelector('.popup-content');
        
        // 1. Crear contenedor de captura fuera del DOM visible
        const contenedorCaptura = document.createElement('div');
        contenedorCaptura.className = 'contenedor-captura-temporal';
        document.body.appendChild(contenedorCaptura);

        // 2. Clonar el contenido con todos los child nodes
        const contenidoClonado = popupContent.cloneNode(true);
        contenedorCaptura.appendChild(contenidoClonado);

        // 3. Aplicar estilos críticos directamente
        contenidoClonado.style.display = 'block';
        contenidoClonado.style.opacity = '1';
        contenidoClonado.style.visibility = 'visible';
        contenidoClonado.style.position = 'relative';

        // 4. Añadir marca de agua con estilos inline
        const marcaAgua = document.createElement('div');
        marcaAgua.innerHTML = 'ZGrafic.com';
        marcaAgua.style.cssText = `
            position: absolute;
            bottom: 20px;
            right: 20px;
            color: rgba(0, 0, 0, 0.5);
            font-size: 22px;
            font-weight: bold;
            font-family: Arial, sans-serif;
            text-shadow: 0 0 5px rgba(255,255,255,0.7);
            z-index: 99999;
            pointer-events: none;
            opacity: 0.8;
        `;
        contenidoClonado.appendChild(marcaAgua);

        // 5. Pequeño delay para renderizado
        await new Promise(resolve => setTimeout(resolve, 50));

        // 6. Configuración optimizada de html2canvas
        const canvas = await html2canvas(contenidoClonado, {
            scale: window.devicePixelRatio || 1,
            logging: true,
            useCORS: true,
            allowTaint: true,
            backgroundColor: null,
            ignoreElements: (el) => el === marcaAgua ? false : false,
            onclone: (clonedDoc, element) => {
                element.style.boxShadow = 'none';
                element.style.transform = 'none';
            }
        });

        // 7. Limpieza
        document.body.removeChild(contenedorCaptura);
        return canvas;

    } catch (error) {
        console.error('Error en captura:', error);
        throw error;
    }
}

// Configuración del botón de captura
function configurarCapturaPopup() {
    const btnCapturar = document.getElementById('popup-copiar-imagen');
    if (btnCapturar) {
        btnCapturar.onclick = async () => {
            try {
                // Feedback visual
                const originalHTML = btnCapturar.innerHTML;
                btnCapturar.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i>';
                btnCapturar.style.pointerEvents = 'none';
                
                // Capturar
                const canvas = await capturarPopupConMarcaAgua();
                
                // Opción 1: Copiar al portapapeles
                try {
                    canvas.toBlob(async (blob) => {
                        await navigator.clipboard.write([
                            new ClipboardItem({ 'image/png': blob })
                        ]);
                        mostrarNotificacion('Captura exitosa');
                    }, 'image/png', 1.0);
                } 
                // Opción 2: Descargar
                catch (err) {
                    const link = document.createElement('a');
                    link.download = `ZGrafic_${new Date().getTime()}.png`;
                    link.href = canvas.toDataURL('image/png', 1.0);
                    link.click();
                }
                
            } catch (error) {
                mostrarNotificacion('Error en captura', 'error');
            } finally {
                // Restaurar botón
                const btn = document.getElementById('popup-copiar-imagen');
                if (btn) {
                    btn.innerHTML = '<i class="fas fa-camera"></i>';
                    btn.style.pointerEvents = 'auto';
                }
            }
        };
    }
}
// Parche para imágenes externas (opcional)
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('#producto-popup img').forEach(img => {
        img.setAttribute('crossorigin', 'anonymous');
    });
});

// Función para mostrar/ocultar buscador móvil
function toggleMobileSearch() {
    const mobileSearch = document.getElementById('mobile-search-container');
    const wasVisible = mobileSearch.classList.contains('mobile-search-visible');
    
    mobileSearch.classList.toggle('mobile-search-visible');
    
    if (!wasVisible) {
        document.getElementById('mobile-buscar-producto').focus();
        document.body.style.overflow = 'hidden'; // Evita scroll cuando el buscador está abierto
    } else {
        document.body.style.overflow = ''; // Restaura el scroll
    }
}

// Conectar eventos de búsqueda móvil
document.getElementById('mobile-btn-buscar').addEventListener('click', () => {
    const query = document.getElementById('mobile-buscar-producto').value;
    document.getElementById('buscar-producto').value = query;
    buscarProductos();
    toggleMobileSearch();
});

document.getElementById('mobile-buscar-producto').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        const query = document.getElementById('mobile-buscar-producto').value;
        document.getElementById('buscar-producto').value = query;
        buscarProductos();
        toggleMobileSearch();
    }
});



