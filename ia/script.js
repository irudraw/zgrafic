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
        `;
        contenedor.appendChild(divProducto);
    });
}

function agregarAlCarrito(id) {
    const producto = productos.find(p => p.id === id);
    carrito.push(producto);
    actualizarCarrito();
    actualizarContadorCarrito();
    actualizarCarritoFlotante();
}

function eliminarDelCarrito(index) {
    carrito.splice(index, 1);
    actualizarCarrito();
    actualizarContadorCarrito();
    actualizarCarritoFlotante();
}

function actualizarCarrito() {
    const listaCarrito = document.getElementById('lista-carrito');
    const total = document.getElementById('total');
    
    listaCarrito.innerHTML = '';
    let suma = 0;

    carrito.forEach((producto, index) => {
        const li = document.createElement('li');
        li.innerHTML = `
            ${producto.nombre} - $${producto.precio}
            <button class="eliminar" onclick="eliminarDelCarrito(${index})"><i class="fas fa-trash"></i></button>
        `;
        listaCarrito.appendChild(li);
        suma += producto.precio;
    });

    total.textContent = suma;
}

function actualizarContadorCarrito() {
    const contador = document.getElementById('contador');
    contador.textContent = carrito.length;
}

function actualizarCarritoFlotante() {
    const listaCarritoFlotante = document.getElementById('lista-carrito-flotante');
    const totalFlotante = document.getElementById('total-flotante');
    
    listaCarritoFlotante.innerHTML = '';
    let suma = 0;

    carrito.forEach(producto => {
        const li = document.createElement('li');
        li.innerHTML = `
            <img src="${producto.imagen}" alt="${producto.nombre}">
            <span>${producto.nombre} - $${producto.precio}</span>
        `;
        listaCarritoFlotante.appendChild(li);
        suma += producto.precio;
    });

    totalFlotante.textContent = suma;
}

function toggleCarritoFlotante() {
    const carritoFlotante = document.getElementById('carrito-flotante');
    carritoFlotante.classList.toggle('oculto');
}

function realizarPedido() {
    localStorage.setItem('carrito', JSON.stringify(carrito));
    window.location.href = 'pedido.html';
}

document.getElementById('realizar-pedido').addEventListener('click', realizarPedido);
document.getElementById('carrito-contador').addEventListener('click', toggleCarritoFlotante);
document.getElementById('ver-carrito').addEventListener('click', () => {
    document.getElementById('carrito').scrollIntoView({ behavior: 'smooth' });
    toggleCarritoFlotante();
});

cargarProductos();