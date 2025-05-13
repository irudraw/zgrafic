document.addEventListener('DOMContentLoaded', function() {
    // Elementos del DOM
    const elements = {
        findPosterBtn: document.getElementById('findPoster'),
        videoUrlInput: document.getElementById('videoUrl'),
        errorDiv: document.getElementById('error'),
        errorMessage: document.querySelector('.error-message'),
        errorSolution: document.querySelector('.error-solution'),
        resultDiv: document.getElementById('result'),
        loadingDiv: document.getElementById('loading'),
        posterImage: document.getElementById('posterImage'),
        downloadBtn: document.getElementById('downloadBtn'),
        directLink: document.getElementById('directLink'),
        viewVideoBtn: document.getElementById('viewVideoBtn'),
        qualityOptions: document.getElementById('qualityOptions')
    };

    // Variables de estado
    let currentPosterUrls = {};
    let currentVideoUrl = '';

    // Event Listeners
    elements.findPosterBtn.addEventListener('click', findPoster);
    elements.downloadBtn.addEventListener('click', downloadImage);
    elements.qualityOptions.addEventListener('click', handleQualityChange);

    // Función principal
    async function findPoster() {
        const videoUrl = elements.videoUrlInput.value.trim();
        currentVideoUrl = videoUrl;
        
        if (!videoUrl) {
            showError('Por favor ingresa una URL', '');
            return;
        }

        if (!isValidFacebookUrl(videoUrl)) {
            showError(
                'URL no válida', 
                'Ejemplos válidos:<br>• https://www.facebook.com/watch/?v=1234567890<br>• https://fb.watch/abc123def/'
            );
            return;
        }

        resetUI();
        showLoading();

        try {
            const posterData = await fetchPosterData(videoUrl);
            
            if (!posterData.original) {
                throw new Error('No se encontró la imagen poster para este video.');
            }

            currentPosterUrls = posterData;
            displayResult(posterData.original);
            updateVideoButton(videoUrl);
        } catch (error) {
            showError(
                error.message, 
                'Prueba con otra URL o verifica que el video sea público'
            );
            console.error('Error:', error);
        } finally {
            hideLoading();
        }
    }

    // Descargar imagen mediante Canvas
    function downloadImage() {
        if (!elements.posterImage.src || elements.posterImage.src.includes('placeholder.com')) {
            showError('No hay imagen válida para descargar', 'Busca una imagen primero');
            return;
        }

        showLoading();
        elements.posterImage.classList.add('loading');

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = elements.posterImage.naturalWidth;
        canvas.height = elements.posterImage.naturalHeight;
        ctx.drawImage(elements.posterImage, 0, 0, canvas.width, canvas.height);
        
        canvas.toBlob(blob => {
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `fb-poster-${Date.now()}.jpg`;
            link.style.display = 'none';
            
            document.body.appendChild(link);
            link.click();
            
            setTimeout(() => {
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
                elements.posterImage.classList.remove('loading');
                hideLoading();
            }, 100);
        }, 'image/jpeg', 0.95);
    }

    // Helper: Mostrar/ocultar carga
    function showLoading() {
        elements.loadingDiv.classList.remove('d-none');
    }

    function hideLoading() {
        elements.loadingDiv.classList.add('d-none');
    }

    // Helper: Manejo de errores
    function showError(message, solution) {
        elements.errorMessage.innerHTML = message;
        elements.errorDiv.classList.remove('d-none');
        
        if (solution) {
            elements.errorSolution.innerHTML = solution;
            elements.errorSolution.classList.remove('d-none');
        } else {
            elements.errorSolution.classList.add('d-none');
        }
    }

    // Helper: Reset UI
    function resetUI() {
        elements.errorDiv.classList.add('d-none');
        elements.resultDiv.classList.add('d-none');
        currentPosterUrls = {};
    }

    // Helper: Mostrar resultados
    function displayResult(imageUrl) {
        elements.posterImage.onload = function() {
            this.classList.remove('loading');
        };
        
        elements.posterImage.onerror = function() {
            this.src = 'https://via.placeholder.com/1000x562.png?text=Imagen+no+disponible';
            this.classList.remove('loading');
            showError('Error al cargar la imagen', 'Intenta con otra URL o calidad');
        };

        elements.posterImage.src = imageUrl;
        elements.directLink.href = imageUrl;
        elements.resultDiv.classList.remove('d-none');
    }

    // Helper: Actualizar botón de video
    function updateVideoButton(videoUrl) {
        elements.viewVideoBtn.href = `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(videoUrl)}`;
    }

    // Helper: Cambiar calidad
    function handleQualityChange(e) {
        if (e.target.classList.contains('quality-btn')) {
            const quality = e.target.getAttribute('data-quality');
            if (currentPosterUrls[quality]) {
                elements.posterImage.classList.add('loading');
                elements.posterImage.src = currentPosterUrls[quality];
                
                document.querySelectorAll('.quality-btn').forEach(btn => {
                    btn.classList.toggle('active', btn === e.target);
                });
            }
        }
    }

    // Helper: Validar URL de Facebook (mejorada)
    function isValidFacebookUrl(url) {
        const patterns = [
            /^(https?:\/\/)?(www\.)?facebook\.com\/watch\/\?v=\d+/i,
            /^(https?:\/\/)?(www\.)?facebook\.com\/.+\/videos\/\d+/i,
            /^(https?:\/\/)?(www\.)?facebook\.com\/video\.php\?v=\d+/i,
            /^(https?:\/\/)?(www\.)?fb\.watch\/[a-zA-Z0-9_-]+/i,
            /^(https?:\/\/)?(www\.)?facebook\.com\/.+\/videos\/.+\/\d+/i,
            /^(https?:\/\/)?(www\.)?facebook\.com\/reel\/\d+/i,
            /^(https?:\/\/)?(www\.)?facebook\.com\/.+\/reels\/\d+/i
        ];
        return patterns.some(pattern => pattern.test(url));
    }

    // Helper: Obtener datos del poster (mejorado)
    async function fetchPosterData(videoUrl) {
    try {
        // Usar proxy con headers mejorados
        const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(`https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(videoUrl)}&show_text=false&width=500`)}`;
        
        const response = await fetch(proxyUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36 Edg/91.0.864.59',
                'Referer': 'https://www.facebook.com/',
                'Accept-Language': 'es-MX,es;q=0.9'
            }
        });
        
        if (!response.ok) throw new Error('Error de conexión con Facebook');
        
        const data = await response.json();
        const htmlContent = data.contents;
        
        // Extracción mejorada para Reels
        const imageUrl = extractReelImageUrl(htmlContent);
        
        if (!imageUrl) throw new Error('Imagen no encontrada - El video puede ser privado');

        return {
            sd: `${imageUrl}?width=640`,
            hd: `${imageUrl}?width=1280`,
            original: imageUrl
        };
    } catch (error) {
        console.error('Error:', error);
        throw new Error(`Error técnico: ${error.message}`);
    }
}
    // Helper: Extraer URL de imagen del HTML (mejorado)
    function extractReelImageUrl(html) {
    // Método 1: Buscar en datos JSON embebidos
    const jsonMatch = html.match(/"preferred_thumbnail":{"image":{"uri":"([^"]+)/i);
    if (jsonMatch) return jsonMatch[1].replace(/\\\//g, '/');

    // Método 2: Enlace directo en meta tags
    const metaMatch = html.match(/<meta property="og:image" content="([^"]+)/i);
    if (metaMatch) return metaMatch[1];

    // Método 3: URL del CDN de Facebook
    const cdnMatch = html.match(/https:\/\/scontent\.([^"']+\.(?:jpg|png))/i);
    return cdnMatch ? cdnMatch[0] : null;
}
});
