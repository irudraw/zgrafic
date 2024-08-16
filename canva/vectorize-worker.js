self.onmessage = function(e) {
    console.log("Mensaje recibido en el worker:", e.data);
    const { image } = e.data;

    const img = new Image();
    img.onload = function() {
        console.log("Imagen cargada en el worker");
        const canvas = new OffscreenCanvas(img.width, img.height);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        
        // Crear un SVG simple con un rectángulo del tamaño de la imagen
        const svgContent = `
            <svg xmlns="http://www.w3.org/2000/svg" width="${canvas.width}" height="${canvas.height}">
                <rect width="100%" height="100%" fill="rgba(255,0,0,0.5)"/>
            </svg>
        `;
        
        console.log("SVG creado");
        self.postMessage({ svg: svgContent });
    };
    img.onerror = function() {
        console.error("Error al cargar la imagen en el worker");
    };
    img.src = image;
};
