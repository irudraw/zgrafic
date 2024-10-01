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

// Funciones para cargar y mostrar productos
async function cargarProductos() {
    const versionAleatoria = Math.floor(Math.random() * 1000000);
    const url = `productos.json?v=${versionAleatoria}`;
    const respuesta = await fetch(url);
    productos = await respuesta.json();
    productosFiltrados = [...productos];
    actualizarPaginacion();
    mostrarProductos();
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
    
    // Reemplazar '\n' con '<br>' para los saltos de línea
    popupDescripcion.innerHTML = productoActual.descripcion.replace(/\n/g, '<br>');
    
    popupAgregar.textContent = productoActual.precio === 0 ? 'Solicitar cotización' : 'Agregar al carrito';
    popupAgregar.onclick = () => agregarAlCarrito(productoActual.id);

    popup.style.display = 'block';
    setTimeout(() => {
        popup.classList.add('active');
    }, 10);
}

function cerrarProductoPopup() {
    const popup = document.getElementById('producto-popup');
    popup.classList.remove('active');
    setTimeout(() => {
        popup.style.display = 'none';
    }, 300);
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
    
    const productosActuales = document.querySelectorAll('.producto');
    productosActuales.forEach(producto => producto.classList.remove('aparecer'));
    
    setTimeout(mostrarProductos, 50);
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
    cargarProductos();
    cargarCarritoDesdeLocalStorage();

    document.getElementById('btn-buscar').addEventListener('click', buscarProductos);
    document.querySelector('#producto-popup .cerrar-popup').addEventListener('click', cerrarProductoPopup);
    document.getElementById('buscar-producto').addEventListener('keyup', (e) => {
        if (e.key === 'Enter') {
            buscarProductos();
        }
    });

    document.getElementById('anterior').addEventListener('click', () => cambiarPagina('anterior'));
    document.getElementById('siguiente').addEventListener('click', () => cambiarPagina('siguiente'));

    document.getElementById('carrito-contador').addEventListener('click', abrirCarritoPopup);
    document.querySelector('.cerrar-popup').addEventListener('click', cerrarCarritoPopup);

    document.getElementById('ver-carrito-completo').addEventListener('click', irACarrito);

    // Cerrar el popup si se hace clic fuera de él
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
