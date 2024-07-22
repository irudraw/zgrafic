let carrito = [];

function cargarCarrito() {
    const carritoGuardado = localStorage.getItem('carrito');
    if (carritoGuardado) {
        carrito = JSON.parse(carritoGuardado);
        mostrarResumenPedido();
    }
}

function mostrarResumenPedido() {
    const listaPedido = document.getElementById('lista-pedido');
    const totalPedido = document.getElementById('total-pedido');
    
    listaPedido.innerHTML = '';
    let suma = 0;

    carrito.forEach(producto => {
        const li = document.createElement('li');
        li.textContent = `${producto.nombre} - $${producto.precio}`;
        listaPedido.appendChild(li);
        suma += producto.precio;
    });

    totalPedido.textContent = suma;
}

function confirmarPedido() {
    let mensaje = 'Hola, quisiera realizar el siguiente pedido:\n\n';
    carrito.forEach(producto => {
        mensaje += `${producto.nombre} - $${producto.precio}\n`;
    });
    mensaje += `\nTotal: $${document.getElementById('total-pedido').textContent}`;

    const numeroWhatsApp = '1234567890'; // Reemplaza con el número de WhatsApp correcto
    const urlWhatsApp = `https://wa.me/${numeroWhatsApp}?text=${encodeURIComponent(mensaje)}`;
    window.open(urlWhatsApp, '_blank');
    
    // Limpiar el carrito después de enviar el pedido
    localStorage.removeItem('carrito');
}

document.getElementById('confirmar-pedido').addEventListener('click', confirmarPedido);

cargarCarrito();