const SIMBOLO_MONEDA = 'S/.';

let productos = [];
let productosFiltrados = [];
let carrito = [];
let paginaActual = 1;
const productosPorPagina = 8;
let isScrolling = false;
let scrollAccumulator = 0;
const scrollThreshold = 1000; // Esto significa que se necesitará mucho más desplazamiento antes de que se active un cambio de página
let lastPageChangeTime = 0;
const pageChangeDelay = 200; // lastPageChangeTime y pageChangeDelay. Esto asegura que debe pasar al menos (2000) 2 segundos entre cambios de página, sin importar cuánto se desplace el usuario.

async function cargarProductos() {
    const respuesta = await fetch('productos.json');
    productos = await respuesta.json();
    productosFiltrados = [...productos];
    actualizarPaginacion();
    mostrarProductos();
}

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
            <img src="${producto.imagen}" alt="${producto.nombre}" onclick="abrirPopup(${producto.id})">
            <h3>${producto.nombre}</h3>
            <button onclick="agregarAlCarrito(${producto.id})">Agregar al carrito</button>
        `;
        contenedor.appendChild(divProducto);
        
        setTimeout(() => {
            divProducto.classList.add('aparecer');
        }, index * 100);
    });
}

function abrirPopup(id) {
    const producto = productos.find(p => p.id === id);
    const popup = document.getElementById('producto-popup');
    const popupImagen = document.getElementById('popup-imagen');
    const popupNombre = document.getElementById('popup-nombre');
    const popupPrecio = document.getElementById('popup-precio');
    const popupDescripcion = document.getElementById('popup-descripcion');
    const popupAgregar = document.getElementById('popup-agregar');

    popupImagen.src = producto.imagen;
    popupImagen.alt = producto.nombre;
    popupNombre.textContent = producto.nombre;
    popupPrecio.textContent = `${SIMBOLO_MONEDA}${producto.precio.toFixed(2)}`;
    popupDescripcion.textContent = producto.descripcion;
    popupAgregar.onclick = () => {
        agregarAlCarrito(id);
        mostrarNotificacion('Producto agregado al carrito');
    };

    popup.style.display = 'block';
    // Forzamos un reflow antes de añadir la clase 'active'
    void popup.offsetWidth;
    popup.classList.add('active');
}

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

    // Hacer visible la notificación
    setTimeout(() => {
        notificacion.style.opacity = '1';
    }, 10);

    // Ocultar y remover la notificación después de 3 segundos
    setTimeout(() => {
        notificacion.style.opacity = '0';
        setTimeout(() => {
            document.body.removeChild(notificacion);
        }, 300);
    }, 3000);
}

function cerrarPopup() {
    const popup = document.getElementById('producto-popup');
    popup.classList.remove('active');
    setTimeout(() => {
        popup.style.display = 'none';
    }, 300); // Este tiempo debe coincidir con la duración de la transición en CSS
}

// Agregar evento para cerrar el popup
document.querySelector('.cerrar-popup').addEventListener('click', cerrarPopup);

// Cerrar el popup si se hace clic fuera de él
window.addEventListener('click', (event) => {
    const popup = document.getElementById('producto-popup');
    if (event.target === popup) {
        cerrarPopup();
    }
});



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
    const listaCarrito = document.getElementById('lista-carrito-flotante');
    const total = document.getElementById('total-flotante');
    
    listaCarrito.innerHTML = '';
    let suma = 0;

    carrito.forEach(item => {
        const li = document.createElement('li');
        li.innerHTML = `
            <img src="${item.imagen}" alt="${item.nombre}">
            <span>${item.nombre} - ${SIMBOLO_MONEDA}${item.precio.toFixed(2)} x ${item.cantidad}</span>
            <button class="eliminar" onclick="eliminarDelCarrito(${item.id})"><i class="fas fa-trash"></i></button>
        `;
        listaCarrito.appendChild(li);
        suma += item.precio * item.cantidad;
    });

    total.textContent = SIMBOLO_MONEDA + suma.toFixed(2);
}

function actualizarContadorCarrito() {
    const contador = document.getElementById('contador');
    const totalItems = carrito.reduce((total, item) => total + item.cantidad, 0);
    contador.textContent = totalItems;
}

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

function irACarrito() {
    window.location.href = 'carrito.html';
}

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

// Eventos
document.getElementById('btn-buscar').addEventListener('click', buscarProductos);
document.getElementById('buscar-producto').addEventListener('keyup', (e) => {
    if (e.key === 'Enter') {
        buscarProductos();
    }
});

document.getElementById('anterior').addEventListener('click', () => cambiarPagina('anterior'));
document.getElementById('siguiente').addEventListener('click', () => cambiarPagina('siguiente'));

const carritoFlotante = document.getElementById('carrito-flotante');
const carritoContador = document.getElementById('carrito-contador');

carritoContador.addEventListener('mouseenter', () => {
    carritoFlotante.classList.remove('oculto');
});

carritoFlotante.addEventListener('mouseleave', () => {
    carritoFlotante.classList.add('oculto');
});

document.getElementById('ver-carrito-completo').addEventListener('click', irACarrito);

window.addEventListener('wheel', (event) => {
    if (isScrolling) return;

    const currentTime = new Date().getTime();
    if (currentTime - lastPageChangeTime < pageChangeDelay) return;

    const scrollDirection = event.deltaY > 0 ? 'down' : 'up';
    const isAtBottom = (window.innerHeight + window.scrollY) >= document.body.offsetHeight - 100;
    const isAtTop = window.scrollY === 0;

    // Acumular el desplazamiento
    scrollAccumulator += Math.abs(event.deltaY);

    if (scrollAccumulator >= scrollThreshold) {
        if (scrollDirection === 'down' && isAtBottom) {
            isScrolling = true;
            cambiarPagina('siguiente');
            lastPageChangeTime = currentTime;
            setTimeout(() => { 
                isScrolling = false; 
                scrollAccumulator = 0; // Reiniciar el acumulador
            }, 1000);
        } else if (scrollDirection === 'up' && isAtTop) {
            isScrolling = true;
            cambiarPagina('anterior');
            lastPageChangeTime = currentTime;
            setTimeout(() => { 
                isScrolling = false; 
                scrollAccumulator = 0; // Reiniciar el acumulador
            }, 1000);
        } else {
            scrollAccumulator = 0; // Reiniciar si no estamos en el tope o fondo
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

cargarProductos();
cargarCarritoDesdeLocalStorage();
