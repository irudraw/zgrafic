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

function vectorizeImage() {
    log('Iniciando vectorización');
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = originalImage.width;
    canvas.height = originalImage.height;
    ctx.drawImage(originalImage, 0, 0);

    log(`Dimensiones de la imagen: ${canvas.width}x${canvas.height}`);

    vectorImage.setAttribute('width', canvas.width);
    vectorImage.setAttribute('height', canvas.height);
    vectorImage.setAttribute('viewBox', `0 0 ${canvas.width} ${canvas.height}`);
    
    // Aquí puedes implementar tu lógica de vectorización
    // Por ahora, dibujamos un simple rectángulo y una línea diagonal
    const svgContent = `
        <rect x="0" y="0" width="${canvas.width}" height="${canvas.height}" 
              fill="none" stroke="black" stroke-width="2"/>
        <line x1="0" y1="0" x2="${canvas.width}" y2="${canvas.height}" 
              stroke="red" stroke-width="2"/>
    `;
    vectorImage.innerHTML = svgContent;

    log('Vectorización completada');
    log(`Contenido SVG: ${svgContent}`);
}
