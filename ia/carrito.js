let carrito = [];

function cargarCarrito() {
    const carritoGuardado = localStorage.getItem('carrito');
    if (carritoGuardado) {
        carrito = JSON.parse(carritoGuardado);
        actualizarCarrito();
    }
}

function actualizarCarrito() {
    const listaCarrito = document.getElementById('lista-carrito');
    const total = document.getElementById('total');
    
    listaCarrito.innerHTML = '';
    let suma = 0;

    carrito.forEach(item => {
        const li = document.createElement('li');
        li.innerHTML = `
            <span>${item.nombre}</span>
            <span>$${item.precio}</span>
            <span>${item.cantidad}</span>
            <span>
                <button onclick="eliminarDelCarrito(${item.id})"><i class="fas fa-trash"></i></button>
            </span>
        `;
        listaCarrito.appendChild(li);
        suma += item.precio * item.cantidad;
    });

    total.textContent = `$${suma.toFixed(2)}`;
}

function eliminarDelCarrito(id) {
    const index = carrito.findIndex(item => item.id === id);
    if (index !== -1) {
        carrito.splice(index, 1);
    }
    actualizarCarrito();
    guardarCarritoEnLocalStorage();
}

function guardarCarritoEnLocalStorage() {
    localStorage.setItem('carrito', JSON.stringify(carrito));
}

function enviarPedidoPorWhatsApp() {
    let mensaje = "Hola, me gustaría hacer el siguiente pedido:\n\n";
    carrito.forEach(item => {
        mensaje += `${item.nombre} x ${item.cantidad} - $${(item.precio * item.cantidad).toFixed(2)}\n`;
    });
    const total = carrito.reduce((sum, item) => sum + item.precio * item.cantidad, 0);
    mensaje += `\nTotal: $${total.toFixed(2)}`;
    
    const numeroWhatsApp = "51955486170";
    const url = `https://wa.me/${numeroWhatsApp}?text=${encodeURIComponent(mensaje)}`;
    window.open(url, '_blank');
}

document.getElementById('realizar-pedido').addEventListener('click', enviarPedidoPorWhatsApp);

cargarCarrito();