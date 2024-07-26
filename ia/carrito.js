const SIMBOLO_MONEDA = 'S/.'; // Asegúrese de que este valor sea el mismo que en script.js

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

    if (carrito.length === 0) {
        const li = document.createElement('li');
        li.textContent = 'El carrito está vacío';
        listaCarrito.appendChild(li);
    } else {
        carrito.forEach(item => {
            const li = document.createElement('li');
            li.innerHTML = `
                <div class="producto-info">
                    <img src="${item.imagen}" alt="${item.nombre}" class="producto-miniatura">
                    <span>${item.nombre}</span>
                </div>
                <span>${SIMBOLO_MONEDA}${item.precio.toFixed(2)}</span>
                <span>${item.cantidad}</span>
                <span>
                    <button onclick="eliminarDelCarrito(${item.id})"><i class="fas fa-trash"></i></button>
                </span>
            `;
            listaCarrito.appendChild(li);
            suma += item.precio * item.cantidad;
        });
    }

    total.textContent = SIMBOLO_MONEDA + suma.toFixed(2);
    actualizarBotonPedido();
}

function actualizarBotonPedido() {
    const botonPedido = document.getElementById('realizar-pedido');
    if (carrito.length === 0) {
        botonPedido.disabled = true;
        botonPedido.classList.add('disabled');
    } else {
        botonPedido.disabled = false;
        botonPedido.classList.remove('disabled');
    }
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
    guardarCarritoEnLocalStorage();
}

function guardarCarritoEnLocalStorage() {
    localStorage.setItem('carrito', JSON.stringify(carrito));
}

function enviarPedidoPorWhatsApp() {
    if (carrito.length === 0) {
        alert('No hay productos en el carrito');
        return;
    }

    let mensaje = "Hola, me gustaría hacer el siguiente pedido:\n\n";
    carrito.forEach(item => {
        mensaje += `${item.nombre} x ${item.cantidad} - ${SIMBOLO_MONEDA}${(item.precio * item.cantidad).toFixed(2)}\n`;
    });
    const total = carrito.reduce((sum, item) => sum + item.precio * item.cantidad, 0);
    mensaje += `\nTotal: ${SIMBOLO_MONEDA}${total.toFixed(2)}`;
    
    const numeroWhatsApp = "51955486170";
    const url = `https://wa.me/${numeroWhatsApp}?text=${encodeURIComponent(mensaje)}`;
    
    // Abrir WhatsApp en una nueva ventana
    window.open(url, '_blank');
    
    // Limpiar el carrito
    carrito = [];
    actualizarCarrito();
    guardarCarritoEnLocalStorage();
    
    // Mostrar un mensaje de confirmación
    alert('¡Pedido enviado! El carrito ha sido limpiado.');
}

document.getElementById('realizar-pedido').addEventListener('click', enviarPedidoPorWhatsApp);

cargarCarrito();
