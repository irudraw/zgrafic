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
}

function eliminarDelCarrito(index) {
    carrito.splice(index, 1);
    actualizarCarrito();
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
            <button class="eliminar" onclick="eliminarDelCarrito(${index})">Eliminar</button>
        `;
        listaCarrito.appendChild(li);
        suma += producto.precio;
    });

    total.textContent = suma;
}

function realizarPedido() {
    let mensaje = 'Hola, quisiera realizar el siguiente pedido:\n\n';
    carrito.forEach(producto => {
        mensaje += `${producto.nombre} - $${producto.precio}\n`;
    });
    mensaje += `\nTotal: $${document.getElementById('total').textContent}`;

    const numeroWhatsApp = '1234567890'; // Reemplaza con el número de WhatsApp correcto
    const urlWhatsApp = `https://wa.me/${numeroWhatsApp}?text=${encodeURIComponent(mensaje)}`;
    window.open(urlWhatsApp, '_blank');
}

document.getElementById('realizar-pedido').addEventListener('click', realizarPedido);

cargarProductos();