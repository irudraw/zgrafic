document.addEventListener('DOMContentLoaded', function() {
    // Elementos del DOM
    const findPosterBtn = document.getElementById('findPoster');
    const videoUrlInput = document.getElementById('videoUrl');
    const errorDiv = document.getElementById('error');
    const resultDiv = document.getElementById('result');
    const loadingDiv = document.getElementById('loading');
    const posterImage = document.getElementById('posterImage');
    const downloadBtn = document.getElementById('downloadBtn');
    const directLink = document.getElementById('directLink');
    let currentPosterUrls = {}; // Almacenará las URLs de diferentes calidades

    // Event Listeners
    findPosterBtn.addEventListener('click', findPoster);
    downloadBtn.addEventListener('click', downloadImage);
    
    // Botones de calidad
    document.querySelectorAll('.quality-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const quality = this.getAttribute('data-quality');
            if (currentPosterUrls[quality]) {
                changeImageQuality(quality);
            }
        });
    });

    // Función principal para buscar el poster
    async function findPoster() {
        const videoUrl = videoUrlInput.value.trim();
        
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
        const urlObj = new URL(url);
        urlObj.searchParams.set('width', width);
        urlObj.searchParams.set('height', height);
        return urlObj.toString();
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
        posterImage.src = imageUrl;
        directLink.href = imageUrl;
        resultDiv.classList.remove('d-none');
        
        // Activar botón HD si está disponible
        if (currentPosterUrls.hd) {
            document.querySelector('[data-quality="hd"]').classList.remove('disabled');
        }
    }

    // Cambiar calidad de imagen
    async function changeImageQuality(quality) {
        if (!currentPosterUrls[quality]) return;
        
        showImageLoading();
        posterImage.src = currentPosterUrls[quality];
        directLink.href = currentPosterUrls[quality];
        
        // Actualizar botón activo
        document.querySelectorAll('.quality-btn').forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-quality') === quality);
        });
    }

    // Descargar imagen
    function downloadImage() {
        if (!posterImage.src || posterImage.src.includes('placeholder.com')) {
            showError('No hay imagen válida para descargar');
            return;
        }

        const link = document.createElement('a');
        link.href = posterImage.src;
        link.download = `fb-poster-${Date.now()}.jpg`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    // Helpers para UI
    function showLoading() {
        loadingDiv.classList.remove('d-none');
    }

    function hideLoading() {
        loadingDiv.classList.add('d-none');
    }

    function showImageLoading() {
        posterImage.style.opacity = '0.5';
    }

    function hideImageLoading() {
        posterImage.style.opacity = '1';
    }

    function showError(message) {
        errorDiv.innerHTML = message;
        errorDiv.classList.remove('d-none');
    }

    function resetUI() {
        errorDiv.classList.add('d-none');
        resultDiv.classList.add('d-none');
        currentPosterUrls = {};
        
        // Desactivar botones de calidad
        document.querySelectorAll('.quality-btn').forEach(btn => {
            btn.classList.add('disabled');
        });
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

    // Verificar carga de imagen
    posterImage.onload = hideImageLoading;
    posterImage.onerror = function() {
        this.onerror = null;
        this.src = 'https://via.placeholder.com/1000x562?text=Imagen+no+disponible';
        hideImageLoading();
    };
});
