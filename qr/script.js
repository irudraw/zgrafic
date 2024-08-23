// Añade esto al principio del archivo script.js
function autoResizeTextarea() {
    this.style.height = 'auto';
    this.style.height = (this.scrollHeight) + 'px';
}

document.getElementById('textInput').addEventListener('input', autoResizeTextarea);

// ... (resto del código sin cambios)

function readQRCode(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = function(e) {
            const img = new Image();
            img.onload = function() {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const code = jsQR(imageData.data, imageData.width, imageData.height);
                if (code) {
                    resolve(code.data);
                } else {
                    reject('No se encontró código QR');
                }
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });
}

function generateStylizedQR(text, size = 256) {
    const qr = qrcode(0, 'M');
    qr.addData(text);
    qr.make();
    
    const modules = qr.getModuleCount();
    const cellSize = size / (modules + 8);
    const margin = cellSize * 4;
    
    let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">`;
    
    function addCornerElement(x, y) {
        const cornerSize = cellSize * 7;
        const borderRadius = cellSize; // Ajusta este valor para cambiar el redondeo de las esquinas

        svg += `<rect x="${x}" y="${y}" width="${cornerSize}" height="${cornerSize}" fill="black" rx="${borderRadius}" ry="${borderRadius}"/>`;
        svg += `<rect x="${x + cellSize}" y="${y + cellSize}" width="${cornerSize - 2*cellSize}" height="${cornerSize - 2*cellSize}" fill="white" rx="${borderRadius * 1}" ry="${borderRadius * 1}"/>`;
        svg += `<rect x="${x + 2*cellSize}" y="${y + 2*cellSize}" width="${cornerSize - 4*cellSize}" height="${cornerSize - 4*cellSize}" fill="black" rx="${borderRadius * 2.5}" ry="${borderRadius * 2.5}"/>`;
    }

    addCornerElement(margin, margin);
    addCornerElement(size - margin - cellSize * 7, margin);
    addCornerElement(margin, size - margin - cellSize * 7);

    for (let row = 0; row < modules; row++) {
        for (let col = 0; col < modules; col++) {
            if (qr.isDark(row, col)) {
                const x = margin + (col * cellSize);
                const y = margin + (row * cellSize);
                
                if (!((row < 7 && col < 7) || 
                      (row < 7 && col >= modules - 7) || 
                      (row >= modules - 7 && col < 7))) {
                    svg += `<circle cx="${x + cellSize/2}" cy="${y + cellSize/2}" r="${cellSize/2}" fill="black" />`;
                }
            }
        }
    }
    
    svg += '</svg>';
    return svg;
}

function displayQR(text) {
    const svgQR = generateStylizedQR(text);
    document.getElementById('qrOutput').innerHTML = svgQR;
    document.getElementById('downloadBtn').style.display = 'inline-block';
}

// Modifica la función handleFile para ajustar el textarea
function handleFile(file) {
    readQRCode(file)
        .then(text => {
            console.log('Texto leído del QR:', text);
            const textInput = document.getElementById('textInput');
            textInput.value = text;
            autoResizeTextarea.call(textInput);
            displayQR(text);
        })
        .catch(error => {
            console.error(error);
            document.getElementById('qrOutput').innerHTML = `<p style="color: red;">${error}</p>`;
            document.getElementById('downloadBtn').style.display = 'none';
        });
}

// ... (resto del código sin cambios)

document.getElementById('generateBtn').addEventListener('click', function() {
    const text = document.getElementById('textInput').value;
    if (text) {
        displayQR(text);
    } else {
        alert('Por favor, ingrese un texto para generar el QR.');
    }
});

document.getElementById('fileInput').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (file) {
        handleFile(file);
    }
});

const dropZone = document.getElementById('dropZone');

dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
});

dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('dragover');
});

dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file) {
        handleFile(file);
    }
});

document.getElementById('downloadBtn').addEventListener('click', function() {
    const svg = document.querySelector('#qrOutput svg');
    const svgData = new XMLSerializer().serializeToString(svg);
    const svgBlob = new Blob([svgData], {type: "image/svg+xml;charset=utf-8"});
    const svgUrl = URL.createObjectURL(svgBlob);
    const downloadLink = document.createElement("a");
    downloadLink.href = svgUrl;
    downloadLink.download = "qr_code.svg";
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
});