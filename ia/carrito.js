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
            <span>
                <img src="${item.imagen}" alt="${item.nombre}" width="50">
                ${item.nombre}
            </span>
            <span>$${item.precio.toFixed(2)}</span>
            <span>${item.cantidad}</span>
            <span>
                <button class="eliminar" onclick="eliminarDelCarrito(${item.id})"><i class="fas fa-trash"></i></button>
            </span>
        `;
        listaCarrito.appendChild(li);
        suma += item.precio * item.cantidad;
    });

    total.textContent = suma.toFixed(2);
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

function realizarPedido() {
    let mensaje = 'Hola, quisiera realizar el siguiente pedido:\n\n';
    carrito.forEach(item => {
        mensaje += `${item.nombre} - $${item.precio.toFixed(2)} x ${item.cantidad}\n`;
    });
    mensaje += `\nTotal: $${document.getElementById('total').textContent}`;

    const numeroWhatsApp = '1234567890'; // Reemplaza con el número de WhatsApp correcto
    const urlWhatsApp = `https://wa.me/${numeroWhatsApp}?text=${encodeURIComponent(mensaje)}`;
    window.open(urlWhatsApp, '_blank');
}

document.getElementById('realizar-pedido').addEventListener('click', realizarPedido);

cargarCarrito();