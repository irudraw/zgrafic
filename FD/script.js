document.addEventListener('DOMContentLoaded', function() {
    // Elementos del DOM
    const elements = {
        findPosterBtn: document.getElementById('findPoster'),
        videoUrlInput: document.getElementById('videoUrl'),
        errorDiv: document.getElementById('error'),
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
            updateVideoButton(videoUrl);
        } catch (error) {
            showError(error.message);
            console.error('Error:', error);
        } finally {
            hideLoading();
        }
    }

    // Descargar imagen mediante Canvas
    function downloadImage() {
        if (!elements.posterImage.src || elements.posterImage.src.includes('placeholder.com')) {
            showError('No hay imagen válida para descargar');
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
            
            document.body.appendChild(link);
            link.click();
            
            // Limpieza
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
    function showError(message) {
        elements.errorDiv.innerHTML = message;
        elements.errorDiv.classList.remove('d-none');
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
                
                // Actualizar botón activo
                document.querySelectorAll('.quality-btn').forEach(btn => {
                    btn.classList.toggle('active', btn === e.target);
                });
            }
        }
    }

    // Helper: Validar URL de Facebook
    function isValidFacebookUrl(url) {
        const patterns = [
            /facebook\.com\/watch\/\?v=\d+/i,
            /facebook\.com\/.+\/videos\/\d+/i,
            /fb\.watch\/[a-zA-Z0-9_-]+/i,
            /facebook\.com\/reel\/\d+/i
        ];
        return patterns.some(pattern => pattern.test(url));
    }

    // Helper: Obtener datos del poster
    async function fetchPosterData(videoUrl) {
        const pluginUrl = `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(videoUrl)}&show_text=false&width=500`;
        const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(pluginUrl)}`;
        
        const response = await fetch(proxyUrl);
        if (!response.ok) throw new Error('No se pudo acceder al video');
        
        const data = await response.json();
        return extractImageUrls(data.contents);
    }

    // Helper: Extraer URLs de imagen
    function extractImageUrls(htmlContent) {
        const baseUrl = htmlContent.match(/<meta property="og:image" content="([^"]+)"/i)?.[1]?.replace(/&amp;/g, '&');
        if (!baseUrl) throw new Error('No se pudo extraer la imagen');

        return {
            sd: addUrlParams(baseUrl, 640, 360),
            hd: addUrlParams(baseUrl, 1280, 720),
            original: removeUrlParams(baseUrl)
        };
    }

    // Helper: Manipulación de URLs
    function addUrlParams(url, width, height) {
        try {
            const urlObj = new URL(url);
            urlObj.searchParams.set('width', width);
            urlObj.searchParams.set('height', height);
            return urlObj.toString();
        } catch {
            return url;
        }
    }

    function removeUrlParams(url) {
        try {
            const urlObj = new URL(url);
            urlObj.searchParams.delete('width');
            urlObj.searchParams.delete('height');
            return urlObj.toString();
        } catch {
            return url;
        }
    }
});
