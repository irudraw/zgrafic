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
                error.includes('iframe') ? 'Prueba con esta URL alternativa' : 'El video puede ser privado o tener restricciones'
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

        // Crear canvas temporal
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // Configurar dimensiones
        canvas.width = elements.posterImage.naturalWidth;
        canvas.height = elements.posterImage.naturalHeight;
        
        // Dibujar imagen
        ctx.drawImage(elements.posterImage, 0, 0, canvas.width, canvas.height);
        
        // Convertir a Blob y descargar
        canvas.toBlob(blob => {
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `fb-poster-${Date.now()}.jpg`;
            link.style.display = 'none';
            
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

    // Helper: Manejo de errores mejorado
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
                
                // Actualizar botón activo
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
            const pluginUrl = `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(videoUrl)}&show_text=false&width=500`;
            const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(pluginUrl)}`;
            
            const response = await fetch(proxyUrl);
            if (!response.ok) throw new Error('Error al conectar con Facebook');
            
            const data = await response.json();
            if (!data.contents) throw new Error('No se recibieron datos del video');
            
            return extractImageUrls(data.contents);
        } catch (error) {
            console.error('Error en fetchPosterData:', error);
            throw new Error('No se pudo obtener la información del video');
        }
    }

    // Helper: Extraer URLs de imagen (robusta)
    function extractImageUrls(htmlContent) {
        // Método 1: Meta tag (og:image)
        let baseUrl = htmlContent.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/i)?.[1];
        
        // Método 2: Etiqueta img
        if (!baseUrl) {
            baseUrl = htmlContent.match(/<img[^>]+(data-src|src)="([^"]+)"[^>]*>/i)?.[2];
        }
        
        // Método 3: Etiqueta video (poster)
        if (!baseUrl) {
            baseUrl = htmlContent.match(/<video[^>]+poster="([^"]+)"/i)?.[1];
        }

        // Método 4: Iframe (como último recurso)
        if (!baseUrl) {
            const iframeSrc = htmlContent.match(/<iframe[^>]+src="([^"]+)"/i)?.[1];
            if (iframeSrc) {
                throw new Error(`Intenta con esta URL directa: ${iframeSrc}`);
            }
            throw new Error('No se encontró ninguna imagen. El video puede ser privado o tener restricciones.');
        }

        // Limpiar y preparar URLs
        baseUrl = baseUrl.replace(/&amp;/g, '&').split('?')[0];
        
        if (!baseUrl.startsWith('http')) {
            baseUrl = 'https://' + baseUrl.replace(/^\/\//, '');
        }

        return {
            sd: `${baseUrl}?width=640&height=360`,
            hd: `${baseUrl}?width=1280&height=720`,
            original: `${baseUrl}?dl=1`
        };
    }
});
