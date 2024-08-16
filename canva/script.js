const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('fileInput');
const preview = document.getElementById('preview');
const originalImage = document.getElementById('originalImage');
const vectorImage = document.getElementById('vectorImage');
const logDiv = document.getElementById('log');

function log(message) {
    console.log(message);
    logDiv.innerHTML += message + '<br>';
    logDiv.scrollTop = logDiv.scrollHeight;
}

dropzone.addEventListener('click', () => fileInput.click());
dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
});
dropzone.addEventListener('drop', handleDrop);
fileInput.addEventListener('change', handleFileSelect);

function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    log('Archivo soltado');
    const file = e.dataTransfer.files[0];
    processFile(file);
}

function handleFileSelect(e) {
    log('Archivo seleccionado');
    const file = e.target.files[0];
    processFile(file);
}

function processFile(file) {
    if (!file) {
        log('No se seleccionó ningún archivo');
        return;
    }
    log(`Procesando archivo: ${file.name}`);
    
    const reader = new FileReader();
    reader.onload = (event) => {
        log('Archivo leído correctamente');
        originalImage.src = event.target.result;
        originalImage.onload = () => {
            preview.style.display = 'flex';
            log('Imagen mostrada en preview');
            vectorizeImage();
        };
    };
    reader.onerror = (error) => {
        log(`Error al leer el archivo: ${error}`);
    };
    reader.readAsDataURL(file);
}

// ... (mantén el código anterior hasta la función vectorizeImage)

function vectorizeImage() {
    log('Iniciando vectorización');
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = originalImage.width;
    canvas.height = originalImage.height;
    ctx.drawImage(originalImage, 0, 0);

    log(`Dimensiones de la imagen: ${canvas.width}x${canvas.height}`);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const { edges, colors } = processImageData(imageData);

    vectorImage.setAttribute('width', canvas.width);
    vectorImage.setAttribute('height', canvas.height);
    vectorImage.setAttribute('viewBox', `0 0 ${canvas.width} ${canvas.height}`);
    
    const svgContent = generateSVG(edges, colors, canvas.width, canvas.height);
    vectorImage.innerHTML = svgContent;

    log('Vectorización completada');
}

// ... (mantén las funciones anteriores hasta processImageData)

function processImageData(imageData) {
    const edges = detectEdges(imageData);
    const colors = detectColors(imageData);
    const areas = detectAreas(imageData, edges);
    return { edges, colors, areas };
}

function detectEdges(imageData) {
    const edges = new Uint8Array(imageData.width * imageData.height);
    const threshold = 30;

    for (let y = 1; y < imageData.height - 1; y++) {
        for (let x = 1; x < imageData.width - 1; x++) {
            const idx = (y * imageData.width + x) * 4;
            const neighbors = [
                imageData.data[idx - 4], imageData.data[idx + 4],
                imageData.data[idx - imageData.width * 4], imageData.data[idx + imageData.width * 4]
            ];
            const diff = Math.max(...neighbors.map(n => Math.abs(n - imageData.data[idx])));
            edges[y * imageData.width + x] = diff > threshold ? 255 : 0;
        }
    }

    return edges;
}

function detectColors(imageData) {
    const colorMap = new Map();
    const step = 4; // Analizar cada 4 píxeles para mejorar el rendimiento

    for (let i = 0; i < imageData.data.length; i += 4 * step) {
        const r = Math.round(imageData.data[i] / 10) * 10;
        const g = Math.round(imageData.data[i + 1] / 10) * 10;
        const b = Math.round(imageData.data[i + 2] / 10) * 10;
        const color = `rgb(${r},${g},${b})`;
        colorMap.set(color, (colorMap.get(color) || 0) + 1);
    }

    // Ordenar colores por frecuencia y tomar los 10 más comunes
    return Array.from(colorMap.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([color]) => color);
}

function detectAreas(imageData, edges) {
    const areas = new Uint8Array(imageData.data.length / 4);
    const width = imageData.width;
    const height = imageData.height;
    let currentArea = 1;

    function floodFill(x, y, targetColor) {
        const stack = [[x, y]];
        while (stack.length > 0) {
            const [cx, cy] = stack.pop();
            const idx = cy * width + cx;
            if (cx < 0 || cx >= width || cy < 0 || cy >= height || edges[idx] || areas[idx] !== 0) continue;
            
            const currentIdx = (cy * width + cx) * 4;
            if (Math.abs(imageData.data[currentIdx] - targetColor[0]) > 30 ||
                Math.abs(imageData.data[currentIdx + 1] - targetColor[1]) > 30 ||
                Math.abs(imageData.data[currentIdx + 2] - targetColor[2]) > 30) continue;

            areas[idx] = currentArea;
            stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
        }
    }

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const idx = y * width + x;
            if (areas[idx] === 0 && !edges[idx]) {
                const targetColor = [
                    imageData.data[idx * 4],
                    imageData.data[idx * 4 + 1],
                    imageData.data[idx * 4 + 2]
                ];
                floodFill(x, y, targetColor);
                currentArea++;
            }
        }
    }

    return areas;
}

function generateSVG(edges, colors, areas, width, height) {
    let paths = '';
    const visited = new Uint8Array(edges.length);

    // Generar paths para los bordes
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            if (edges[y * width + x] && !visited[y * width + x]) {
                paths += tracePath(x, y, edges, visited, width, height);
            }
        }
    }

    // Generar paths para las áreas
    let areaPaths = '';
    for (let area = 1; area < 255; area++) {
        const areaPath = traceArea(areas, area, width, height);
        if (areaPath) {
            const areaColor = colors[area % colors.length];
            areaPaths += `<path d="${areaPath}" fill="${areaColor}" opacity="0.5" />`;
        }
    }

    const colorRects = colors.map((color, index) => 
        `<rect x="${index * 50}" y="0" width="50" height="20" fill="${color}" />`
    ).join('');

    return `
        ${areaPaths}
        ${paths}
        ${colorRects}
    `;
}

function traceArea(areas, targetArea, width, height) {
    let path = '';
    let startX = -1, startY = -1;

    // Encontrar el punto de inicio
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            if (areas[y * width + x] === targetArea) {
                startX = x;
                startY = y;
                break;
            }
        }
        if (startX !== -1) break;
    }

    if (startX === -1) return null; // No se encontró el área

    const directions = [[1, 0], [0, 1], [-1, 0], [0, -1]];
    let x = startX, y = startY;
    let dir = 0;

    path += `M${x},${y}`;

    do {
        let newX = x + directions[dir][0];
        let newY = y + directions[dir][1];

        if (newX >= 0 && newX < width && newY >= 0 && newY < height && areas[newY * width + newX] === targetArea) {
            x = newX;
            y = newY;
            path += `L${x},${y}`;
            dir = (dir + 3) % 4;
        } else {
            dir = (dir + 1) % 4;
        }
    } while (x !== startX || y !== startY);

    return path + 'Z';
}

// ... (mantén las otras funciones sin cambios)

function tracePath(startX, startY, edges, visited, width, height) {
    let path = `M${startX},${startY}`;
    let x = startX, y = startY;
    const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]];

    while (true) {
        visited[y * width + x] = 1;
        let found = false;

        for (const [dx, dy] of directions) {
            const nx = x + dx, ny = y + dy;
            if (nx >= 0 && nx < width && ny >= 0 && ny < height &&
                edges[ny * width + nx] && !visited[ny * width + nx]) {
                path += `L${nx},${ny}`;
                x = nx;
                y = ny;
                found = true;
                break;
            }
        }

        if (!found) break;
    }

    return `<path d="${path}" fill="none" stroke="black" />`;
}
