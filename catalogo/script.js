// Carga el archivo XML (puedes reemplazar 'productos.xml' con tu propio archivo)
fetch('productos.xml')
    .then(response => response.text())
    .then(data => {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(data, 'text/xml');
        const productos = xmlDoc.querySelectorAll('producto');

        const catalogo = document.getElementById('catalogo');
        productos.forEach(producto => {
            const nombre = producto.querySelector('nombre').textContent;
            const precio = producto.querySelector('precio').textContent;
            const imagen = producto.querySelector('imagen').textContent;

            const productoHTML = `
                <div class="producto">
                    <img src="${imagen}" alt="${nombre}">
                    <h3>${nombre}</h3>
                    <p>Precio: $${precio}</p>
                </div>
            `;
            catalogo.innerHTML += productoHTML;
        });
    })
    .catch(error => console.error('Error al cargar el archivo XML:', error));
