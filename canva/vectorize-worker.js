importScripts('https://cdnjs.cloudflare.com/ajax/libs/potrace/1.16.0/potrace.min.js');

self.onmessage = function(e) {
    const { image, colorTolerance, detailLevel } = e.data;

    const img = new Image();
    img.onload = function() {
        const canvas = new OffscreenCanvas(img.width, img.height);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const colors = quantizeColors(imageData.data, colorTolerance);
        
        let svgPaths = '';
        colors.forEach((color, index) => {
            const bitmap = createBitmapForColor(imageData, color);
            const svg = traceBitmap(bitmap, detailLevel);
            svgPaths += `<path fill="${color}" d="${svg}"/>`;
            
            self.postMessage({ progress: (index + 1) / colors.length * 100 });
        });

        const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="${canvas.width}" height="${canvas.height}">${svgPaths}</svg>`;
        self.postMessage({ svg: svgContent });
    };
    img.src = image;
};

function quantizeColors(data, tolerance) {
    // Implementa un algoritmo de cuantización de color aquí
    // Este es un ejemplo simplificado
    const colors = new Set();
    for (let i = 0; i < data.length; i += 4) {
        const r = Math.round(data[i] / tolerance) * tolerance;
        const g = Math.round(data[i+1] / tolerance) * tolerance;
        const b = Math.round(data[i+2] / tolerance) * tolerance;
        colors.add(`rgb(${r},${g},${b})`);
    }
    return Array.from(colors);
}

function createBitmapForColor(imageData, color) {
    // Crea un bitmap para un color específico
    const bitmap = new Uint8Array(imageData.width * imageData.height);
    const [r, g, b] = color.match(/\d+/g).map(Number);
    for (let i = 0; i < imageData.data.length; i += 4) {
        const index = i / 4;
        if (Math.abs(imageData.data[i] - r) <= 5 &&
            Math.abs(imageData.data[i+1] - g) <= 5 &&
            Math.abs(imageData.data[i+2] - b) <= 5) {
            bitmap[index] = 1;
        }
    }
    return bitmap;
}

function traceBitmap(bitmap, detailLevel) {
    // Configura Potrace según el nivel de detalle
    const traceOptions = {
        turdSize: detailLevel === 'low' ? 100 : detailLevel === 'medium' ? 50 : 25,
        alphaMax: detailLevel === 'low' ? 0.5 : detailLevel === 'medium' ? 1 : 2,
        optCurve: true,
        optTolerance: detailLevel === 'low' ? 0.4 : detailLevel === 'medium' ? 0.2 : 0.1
    };

    const traceData = Potrace.trace(bitmap, traceOptions);
    return traceData.toString();
}