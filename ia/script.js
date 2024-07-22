let productos = [];
let carrito = [];

async function cargarProductos() {
    const respuesta = await fetch('productos.json');
    productos = await respuesta.json();
    mostrarProductos();
}

function mostrarProductos() {
    const contenedor = document.getElementById('productos');
    productos.forEach(producto => {
        const divProducto = document.createElement('div');
        divProducto.className = 'producto';
        divProducto.innerHTML = `
            <img src="${producto.imagen}" alt="${producto.nombre}">
            <h3>${producto.nombre}</h3>
            <p>$${producto.precio}</p>
            <button onclick="agregarAlCarrito(${producto.id})">Agregar al carrito</button>
            <button class="btn-descripcion" onclick="toggleDescripcion(this)">Ver descripción</button>
            <div class="descripcion">
                <p>${producto.descripcion}</p>
            </div>
        `;
        contenedor.appendChild(divProducto);
    });
}

function toggleDescripcion(button) {
    const descripcion = button.nextElementSibling;
    descripcion.classList.toggle('visible');
    button.textContent = descripcion.classList.contains('visible') ? 'Ocultar descripción' : 'Ver descripción';
}

// ... (resto de las funciones del carrito) ...

function toggleCarritoLateral() {
    const carritoLateral = document.getElementById('carrito-lateral');
    const overlay = document.getElementById('overlay');
    carritoLateral.classList.toggle('abierto');
    overlay.classList.toggle('abierto');
}

// ... (resto del código) ...

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
    const listaCarrito = document.getElementById('lista-carrito-lateral');
    const total = document.getElementById('total-lateral');
    
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

function toggleCarritoLateral() {
    const carritoLateral = document.getElementById('carrito-lateral');
    const overlay = document.getElementById('overlay');
    carritoLateral.classList.toggle('abierto');
    overlay.classList.toggle('abierto');
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

document.getElementById('carrito-contador').addEventListener('click', toggleCarritoLateral);
document.getElementById('ver-carrito').addEventListener('click', irACarrito);
document.getElementById('overlay').addEventListener('click', toggleCarritoLateral);

cargarProductos();
cargarCarritoDesdeLocalStorage();