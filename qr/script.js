let currentPage = 1;
const itemsPerPage = 4;

function autoResizeTextarea() {
    this.style.height = 'auto';
    this.style.height = (this.scrollHeight) + 'px';
}

document.getElementById('textInput').addEventListener('input', autoResizeTextarea);

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
        const borderRadius = cellSize;

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

function saveHistory(text, title = "") {
    let history = JSON.parse(localStorage.getItem('qrHistory') || '[]');
    if (!history.some(item => item.text === text)) {
        const qrSvg = generateStylizedQR(text, 64);  // Generar miniatura
        history.unshift({ text, title, date: new Date().toLocaleString(), qrSvg });
        localStorage.setItem('qrHistory', JSON.stringify(history));
    }
    updateHistoryDisplay();
}

function updateHistoryDisplay() {
    const historyList = document.getElementById('historyList');
    const searchInput = document.getElementById('searchInput');
    const searchTerm = searchInput.value.toLowerCase();
    let history = JSON.parse(localStorage.getItem('qrHistory') || '[]');
    
    // Filtrar por término de búsqueda
    const filteredHistory = history.filter(item => 
        item.text.toLowerCase().includes(searchTerm) || 
        (item.title && item.title.toLowerCase().includes(searchTerm))
    );
    
    const totalPages = Math.ceil(filteredHistory.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const currentItems = filteredHistory.slice(startIndex, endIndex);
    
    historyList.innerHTML = '';
    currentItems.forEach((item, index) => {
        const li = document.createElement('li');
        const originalIndex = history.findIndex(h => h.text === item.text && h.date === item.date);
        li.innerHTML = `
            <div class="history-item-qr">${item.qrSvg}</div>
            <div class="history-item-content">
                <div class="editable-container">
                    <span class="history-item-title" title="${item.title || "Sin título"}">${(item.title || "Sin título").substring(0, 12)}${(item.title || "Sin título").length > 12 ? '...' : ''}</span>
                    <span class="edit-icon">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path>
                        </svg>
                    </span>
                </div>
                <div class="history-item-text">${item.text.substring(0, 30)}${item.text.length > 30 ? '...' : ''}</div>
                <div class="history-item-date">${item.date}</div>
            </div>
            <div class="history-item-actions">
                <button class="view-btn" data-index="${originalIndex}">Ver</button>
                <button class="delete-btn" data-index="${originalIndex}">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                        <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/>
                        <path fill-rule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/>
                    </svg>
                </button>
            </div>
        `;
        historyList.appendChild(li);
        
        const editableContainer = li.querySelector('.editable-container');
        editableContainer.addEventListener('click', (e) => {
            if (e.target.closest('.edit-icon')) {
                makeEditable(editableContainer.querySelector('.history-item-title'), originalIndex);
            }
        });
    });
    
    updatePagination(totalPages);

    document.querySelectorAll('.view-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            viewHistoryItem(parseInt(this.getAttribute('data-index')));
        });
    });

    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            deleteHistoryItem(parseInt(this.getAttribute('data-index')));
        });
    });
}

function makeEditable(element, index) {
    let history = JSON.parse(localStorage.getItem('qrHistory') || '[]');
    const fullTitle = history[index].title || "Sin título";
    
    const input = document.createElement('input');
    input.type = 'text';
    input.value = fullTitle;
    input.classList.add('edit-input');
    
    const container = element.closest('.editable-container');
    container.innerHTML = '';
    container.appendChild(input);
    input.focus();
    
    function saveEdit() {
        const newTitle = input.value.trim() || "Sin título";
        history[index].title = newTitle;
        localStorage.setItem('qrHistory', JSON.stringify(history));
        
        const displayTitle = newTitle.substring(0, 12) + (newTitle.length > 12 ? '...' : '');
        
        container.innerHTML = `
            <span class="history-item-title" title="${newTitle}">${displayTitle}</span>
            <span class="edit-icon">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path>
                </svg>
            </span>
        `;
        
        const newEditIcon = container.querySelector('.edit-icon');
        newEditIcon.addEventListener('click', () => makeEditable(container.querySelector('.history-item-title'), index));
    }
    
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            saveEdit();
        }
    });
    
    input.addEventListener('blur', saveEdit);
}

function updatePagination(totalPages) {
    const prevButton = document.getElementById('prevPage');
    const nextButton = document.getElementById('nextPage');
    const currentPageSpan = document.getElementById('currentPage');
    
    currentPageSpan.textContent = `${currentPage} / ${totalPages}`;
    prevButton.disabled = currentPage === 1;
    nextButton.disabled = currentPage === totalPages;
}

function viewHistoryItem(index) {
    const history = JSON.parse(localStorage.getItem('qrHistory') || '[]');
    const item = history[index];
    if (item) {
        document.getElementById('textInput').value = item.text;
        displayQRWithoutSaving(item.text);
    }
}

function deleteHistoryItem(index) {
    let history = JSON.parse(localStorage.getItem('qrHistory') || '[]');
    if (index >= 0 && index < history.length) {
        history.splice(index, 1);
        localStorage.setItem('qrHistory', JSON.stringify(history));
        updateHistoryDisplay();
    }
}

function displayQR(text) {
    const svgQR = generateStylizedQR(text);
    document.getElementById('qrOutput').innerHTML = svgQR;
    document.getElementById('downloadBtn').style.display = 'inline-block';
    saveHistory(text);
}

function displayQRWithoutSaving(text) {
    const svgQR = generateStylizedQR(text);
    document.getElementById('qrOutput').innerHTML = svgQR;
    document.getElementById('downloadBtn').style.display = 'inline-block';
}

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

document.getElementById('prevPage').addEventListener('click', () => {
    if (currentPage > 1) {
        currentPage--;
        updateHistoryDisplay();
    }
});

document.getElementById('nextPage').addEventListener('click', () => {
    const history = JSON.parse(localStorage.getItem('qrHistory') || '[]');
    const totalPages = Math.ceil(history.length / itemsPerPage);
    if (currentPage < totalPages) {
        currentPage++;
        updateHistoryDisplay();
    }
});

document.getElementById('searchInput').addEventListener('input', () => {
    currentPage = 1;
    updateHistoryDisplay();
});

document.addEventListener('DOMContentLoaded', updateHistoryDisplay);
