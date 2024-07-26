let productos = [];
let productosFiltrados = [];
let carrito = [];
let paginaActual = 1;
const productosPorPagina = 8;

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
    
    productosPagina.forEach(producto => {
        const divProducto = document.createElement('div');
        divProducto.className = 'producto';
        divProducto.innerHTML = `
            <img src="${producto.imagen}" alt="${producto.nombre}">
            <h3>${producto.nombre}</h3>
            <p class="precio">$${producto.precio}</p>
            <p class="descripcion">${producto.descripcion}</p>
            <button onclick="agregarAlCarrito(${producto.id})">Agregar al carrito</button>
        `;
        contenedor.appendChild(divProducto);
    });
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
    }
    actualizarPaginacion();
    mostrarProductos();
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
            <span>${item.nombre} - $${item.precio} x ${item.cantidad}</span>
            <button class="eliminar" onclick="eliminarDelCarrito(${item.id})"><i class="fas fa-trash"></i></button>
        `;
        listaCarrito.appendChild(li);
        suma += item.precio * item.cantidad;
    });

    total.textContent = suma.toFixed(2);
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
    mostrarProductos();
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

cargarProductos();
cargarCarritoDesdeLocalStorage();
