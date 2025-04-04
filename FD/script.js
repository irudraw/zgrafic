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

    // Función principal mejorada
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
            await loadImageAndDisplay(posterData.original);
            updateVideoButton(videoUrl);
        } catch (error) {
            console.error('Error:', error);
            showError(
                error.message, 
                error.includes('URL alternativa') ? 'Prueba con esta URL' : 'Intenta con otro video o verifica la URL'
            );
        } finally {
            hideLoading();
        }
    }

    // Función mejorada para cargar y mostrar imágenes
    async function loadImageAndDisplay(imageUrl) {
        return new Promise((resolve, reject) => {
            // Limpiar URL antes de cargar
            const cleanUrl = cleanImageUrl(imageUrl);
            
            // Configurar manejadores de eventos
            elements.posterImage.onload = function() {
                this.classList.remove('loading');
                elements.resultDiv.classList.remove('d-none');
                resolve();
            };
            
            elements.posterImage.onerror = function() {
                this.src = 'https://via.placeholder.com/1000x562.png?text=Imagen+no+disponible';
                this.classList.remove('loading');
                reject(new Error('Error al cargar la imagen'));
            };

            // Cargar la imagen
            elements.posterImage.classList.add('loading');
            elements.posterImage.src = cleanUrl;
            elements.directLink.href = cleanUrl;
        });
    }

    // Descargar imagen - Versión optimizada
    function downloadImage() {
        if (!elements.posterImage.src || elements.posterImage.src.includes('placeholder.com')) {
            showError('No hay imagen válida para descargar', 'Busca una imagen primero');
            return;
        }

        showLoading();
        elements.posterImage.classList.add('loading');

        // Usar la URL original sin parámetros
        const imageUrl = cleanImageUrl(elements.posterImage.src);
        
        // Crear enlace de descarga
        const link = document.createElement('a');
        link.href = imageUrl + '?dl=1';
        link.download = `fb-poster-${Date.now()}.jpg`;
        link.style.display = 'none';
        
        document.body.appendChild(link);
        link.click();
        
        // Limpieza
        setTimeout(() => {
            document.body.removeChild(link);
            elements.posterImage.classList.remove('loading');
            hideLoading();
        }, 100);
    }

    // Helpers mejorados
    function showLoading() {
        elements.loadingDiv.classList.remove('d-none');
    }

    function hideLoading() {
        elements.loadingDiv.classList.add('d-none');
    }

    function showError(message, solution) {
        elements.errorMessage.innerHTML = message;
        elements.errorSolution.innerHTML = solution || '';
        elements.errorSolution.classList.toggle('d-none', !solution);
        elements.errorDiv.classList.remove('d-none');
    }

    function resetUI() {
        elements.errorDiv.classList.add('d-none');
        elements.resultDiv.classList.add('d-none');
        currentPosterUrls = {};
    }

    function updateVideoButton(videoUrl) {
        elements.viewVideoBtn.href = `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(videoUrl)}`;
    }

    function handleQualityChange(e) {
        if (e.target.classList.contains('quality-btn')) {
            const quality = e.target.getAttribute('data-quality');
            if (currentPosterUrls[quality]) {
                loadImageAndDisplay(currentPosterUrls[quality])
                    .catch(error => showError(error.message, 'Intenta con otra calidad'));
                
                // Actualizar botón activo
                document.querySelectorAll('.quality-btn').forEach(btn => {
                    btn.classList.toggle('active', btn === e.target);
                });
            }
        }
    }

    // Validación de URL mejorada
    function isValidFacebookUrl(url) {
        const patterns = [
            /^(https?:\/\/)?(www\.|m\.)?facebook\.com\/watch\/\?v=\d+/i,
            /^(https?:\/\/)?(www\.|m\.)?facebook\.com\/.+\/videos(?:\/\d+)?\/?\d*/i,
            /^(https?:\/\/)?(www\.|m\.)?facebook\.com\/video\.php\?(?:.*&)?v=\d+/i,
            /^(https?:\/\/)?(www\.)?fb\.watch\/[a-zA-Z0-9_-]+/i,
            /^(https?:\/\/)?(www\.|m\.)?facebook\.com\/reel\/\d+/i,
            /^(https?:\/\/)?(www\.|m\.)?facebook\.com\/.+\/reels\/\d+/i
        ];
        return patterns.some(pattern => pattern.test(url));
    }

    // Limpiar URL de imagen
    function cleanImageUrl(url) {
        if (!url) return '';
        return url.replace(/&amp;/g, '&')
                 .split('?')[0]
                 .replace(/^\/\//, 'https://')
                 .trim();
    }

    // Extracción de datos mejorada
    async function fetchPosterData(videoUrl) {
        try {
            const apiUrl = `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(videoUrl)}&show_text=false`;
            const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(apiUrl)}`;
            
            const response = await fetch(proxyUrl);
            if (!response.ok) throw new Error('Error al conectar con el servidor');
            
            const htmlContent = await response.text();
            return extractImageUrls(htmlContent);
        } catch (error) {
            console.error('Error en fetchPosterData:', error);
            throw new Error('No se pudo obtener la información del video');
        }
    }

    // Extracción de URLs mejorada
    function extractImageUrls(htmlContent) {
        // Método 1: Meta tag (og:image)
        const metaMatch = htmlContent.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/i);
        if (metaMatch && metaMatch[1]) {
            const baseUrl = cleanImageUrl(metaMatch[1]);
            return generateQualityUrls(baseUrl);
        }

        // Método 2: Etiqueta img
        const imgMatch = htmlContent.match(/<img[^>]+(data-src|src)="([^"]+)"/i);
        if (imgMatch && imgMatch[2]) {
            const baseUrl = cleanImageUrl(imgMatch[2]);
            return generateQualityUrls(baseUrl);
        }

        // Método 3: Etiqueta video (poster)
        const videoMatch = htmlContent.match(/<video[^>]+poster="([^"]+)"/i);
        if (videoMatch && videoMatch[1]) {
            const baseUrl = cleanImageUrl(videoMatch[1]);
            return generateQualityUrls(baseUrl);
        }

        throw new Error('No se encontró la imagen del video');
    }

    function generateQualityUrls(baseUrl) {
        return {
            sd: `${baseUrl}?width=640&height=360`,
            hd: `${baseUrl}?width=1280&height=720`,
            original: baseUrl // Sin parámetros para la versión original
        };
    }
});
