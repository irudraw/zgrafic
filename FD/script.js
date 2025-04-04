document.addEventListener('DOMContentLoaded', function() {
    // Elementos del DOM con verificaciones
    const elements = {
        findPosterBtn: document.getElementById('findPoster'),
        videoUrlInput: document.getElementById('videoUrl'),
        errorDiv: document.getElementById('error'),
        resultDiv: document.getElementById('result'),
        loadingDiv: document.getElementById('loading'),
        posterImage: document.getElementById('posterImage'),
        downloadBtn: document.getElementById('downloadBtn'),
        directLink: document.getElementById('directLink'),
        qualityOptions: document.getElementById('qualityOptions')
    };

    // Verificar que todos los elementos esenciales existan
    if (Object.values(elements).some(element => !element)) {
        console.error('Error: Faltan elementos esenciales en el DOM');
        if (elements.errorDiv) {
            elements.errorDiv.textContent = 'Error inicializando la aplicación. Recarga la página.';
            elements.errorDiv.classList.remove('d-none');
        }
        return;
    }

    let currentPosterUrls = {};

    // Event Listeners
    elements.findPosterBtn.addEventListener('click', findPoster);
    elements.downloadBtn.addEventListener('click', downloadImage);
    
    // Manejador delegado para botones de calidad
    if (elements.qualityOptions) {
        elements.qualityOptions.addEventListener('click', function(e) {
            if (e.target.classList.contains('quality-btn')) {
                const quality = e.target.getAttribute('data-quality');
                if (currentPosterUrls[quality]) {
                    changeImageQuality(quality);
                }
            }
        });
    }

    // Función principal para buscar el poster
    async function findPoster() {
        const videoUrl = elements.videoUrlInput.value.trim();
        
        if (!videoUrl) {
            showError('Por favor ingresa una URL');
            return;
        }

        if (!isValidFacebookUrl(videoUrl)) {
            showError('URL no válida. Ejemplos válidos:<br>• https://www.facebook.com/watch/?v=1234567890<br>• https://fb.watch/abc123def/');
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
        } catch (error) {
            showError(error.message);
            console.error(error);
        } finally {
            hideLoading();
        }
    }

    // Obtener datos del poster desde Facebook
    async function fetchPosterData(videoUrl) {
        const pluginUrl = `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(videoUrl)}&show_text=false&width=500`;
        const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(pluginUrl)}`;
        
        const response = await fetch(proxyUrl);
        const data = await response.json();
        
        if (!response.ok) throw new Error('No se pudo acceder al video. Intenta nuevamente.');

        return extractAllQualityUrls(data.contents);
    }

    // Extraer URLs en diferentes calidades
    function extractAllQualityUrls(htmlContent) {
        const baseUrl = extractBaseImageUrl(htmlContent);
        if (!baseUrl) throw new Error('No se pudo extraer la imagen del video.');

        return {
            sd: addQualityParams(baseUrl, 640, 360),
            hd: addQualityParams(baseUrl, 1280, 720),
            original: removeQualityParams(baseUrl),
            base: baseUrl
        };
    }

    // Funciones auxiliares para manejo de URLs
    function extractBaseImageUrl(htmlContent) {
        const metaMatch = htmlContent.match(/<meta property="og:image" content="([^"]+)"/i);
        if (metaMatch) return metaMatch[1].replace(/&amp;/g, '&');

        const imgMatch = htmlContent.match(/<img[^>]+(data-src|src)="([^"]+)"/i);
        if (imgMatch) return imgMatch[2].replace(/&amp;/g, '&');

        const videoMatch = htmlContent.match(/<video[^>]+poster="([^"]+)"/i);
        if (videoMatch) return videoMatch[1].replace(/&amp;/g, '&');

        return null;
    }

    function addQualityParams(url, width, height) {
        try {
            const urlObj = new URL(url);
            urlObj.searchParams.set('width', width);
            urlObj.searchParams.set('height', height);
            return urlObj.toString();
        } catch {
            return url;
        }
    }

    function removeQualityParams(url) {
        try {
            const urlObj = new URL(url);
            urlObj.searchParams.delete('width');
            urlObj.searchParams.delete('height');
            return urlObj.toString();
        } catch {
            return url;
        }
    }

    // Mostrar resultados
    function displayResult(imageUrl) {
        elements.posterImage.src = imageUrl;
        elements.directLink.href = imageUrl;
        elements.resultDiv.classList.remove('d-none');
        
        // Activar botones de calidad según disponibilidad
        const qualityBtns = elements.qualityOptions.querySelectorAll('.quality-btn');
        qualityBtns.forEach(btn => {
            const quality = btn.getAttribute('data-quality');
            btn.classList.toggle('disabled', !currentPosterUrls[quality]);
            
            // Activar SD por defecto
            if (quality === 'sd' && currentPosterUrls.sd) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
    }

    // Cambiar calidad de imagen
    function changeImageQuality(quality) {
        if (!currentPosterUrls[quality] || !elements.posterImage) return;
        
        elements.posterImage.classList.add('loading');
        elements.posterImage.src = currentPosterUrls[quality];
        elements.directLink.href = currentPosterUrls[quality];
        
        // Actualizar botón activo
        const qualityBtns = elements.qualityOptions.querySelectorAll('.quality-btn');
        qualityBtns.forEach(btn => {
            if (btn.getAttribute('data-quality') === quality) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
    }

    // Descargar imagen
    function downloadImage() {
        if (!elements.posterImage.src || elements.posterImage.src.includes('placeholder.com')) {
            showError('No hay imagen válida para descargar');
            return;
        }

        const link = document.createElement('a');
        link.href = elements.posterImage.src;
        link.download = `fb-poster-${Date.now()}.jpg`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    // Helpers para UI
    function showLoading() {
        elements.loadingDiv.classList.remove('d-none');
    }

    function hideLoading() {
        elements.loadingDiv.classList.add('d-none');
    }

    function showError(message) {
        elements.errorDiv.innerHTML = message;
        elements.errorDiv.classList.remove('d-none');
    }

    function resetUI() {
        elements.errorDiv.classList.add('d-none');
        elements.resultDiv.classList.add('d-none');
        currentPosterUrls = {};
        
        if (elements.posterImage) {
            elements.posterImage.src = '';
            elements.posterImage.classList.remove('loading');
        }
    }

    // Validación de URL
    function isValidFacebookUrl(url) {
        const patterns = [
            /facebook\.com\/watch\/\?v=\d+/i,
            /facebook\.com\/.+\/videos\/\d+/i,
            /facebook\.com\/video\.php\?v=\d+/i,
            /fb\.watch\/[a-zA-Z0-9_-]+/i,
            /facebook\.com\/.+\/videos\/.+\/\d+/i
        ];
        
        return patterns.some(pattern => pattern.test(url));
    }

    // Manejar carga/error de imagen
    if (elements.posterImage) {
        elements.posterImage.onload = function() {
            this.classList.remove('loading');
        };
        
        elements.posterImage.onerror = function() {
            this.onerror = null;
            this.src = 'https://via.placeholder.com/1000x562?text=Imagen+no+disponible';
            this.classList.remove('loading');
        };
    }
});
