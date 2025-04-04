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
        qualityOptions: document.getElementById('qualityOptions'),
        framesContainer: document.getElementById('framesContainer'),
        framesGrid: document.getElementById('framesGrid')
    };

    // Verificar elementos esenciales
    if (!elements.findPosterBtn || !elements.videoUrlInput || !elements.posterImage) {
        showError('Error inicializando la aplicación. Recarga la página.');
        return;
    }

    let currentPosterUrls = {};
    let videoFrames = [];

    // Event Listeners
    elements.findPosterBtn.addEventListener('click', findPoster);
    elements.downloadBtn.addEventListener('click', downloadImage);
    
    // Delegación de eventos para botones de calidad
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

    // Función principal
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
            await displayResult(posterData.original);
            
            // Generar frames de demostración (mock)
            await generateMockFrames(posterData.original);
            
        } catch (error) {
            showError(error.message);
            console.error(error);
        } finally {
            hideLoading();
        }
    }

    // Obtener datos del poster
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
    async function displayResult(imageUrl) {
        elements.posterImage.src = imageUrl;
        elements.directLink.href = imageUrl;
        elements.resultDiv.classList.remove('d-none');
        
        // Mostrar sección de frames
        if (elements.framesContainer) {
            elements.framesContainer.style.display = 'block';
        }
        
        // Activar botones de calidad
        if (elements.qualityOptions) {
            const qualityBtns = elements.qualityOptions.querySelectorAll('.quality-btn');
            qualityBtns.forEach(btn => {
                const quality = btn.getAttribute('data-quality');
                btn.classList.toggle('disabled', !currentPosterUrls[quality]);
                
                if (quality === 'sd' && currentPosterUrls.sd) {
                    btn.classList.add('active');
                }
            });
        }
    }

    // Generar frames de demostración (mock)
    async function generateMockFrames(baseImageUrl) {
        if (!elements.framesGrid) return;
        
        elements.framesGrid.innerHTML = '';
        videoFrames = [];
        
        // Crear 5 frames de ejemplo con variaciones
        for (let i = 0; i < 5; i++) {
            const frameUrl = `${baseImageUrl}&mock_frame=${i}&t=${Date.now()}`;
            videoFrames.push(frameUrl);
            
            const frameElement = document.createElement('img');
            frameElement.src = frameUrl;
            frameElement.classList.add('frame-thumbnail');
            frameElement.alt = `Frame ${i+1}`;
            frameElement.onclick = () => showFullFrame(frameUrl);
            
            elements.framesGrid.appendChild(frameElement);
            
            // Simular carga progresiva
            await new Promise(resolve => setTimeout(resolve, 200));
        }
    }

    // Mostrar frame en tamaño completo
    function showFullFrame(frameUrl) {
        elements.posterImage.src = frameUrl;
        elements.directLink.href = frameUrl;
        
        // Scroll suave a la imagen principal
        elements.posterImage.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    // Cambiar calidad de imagen
    function changeImageQuality(quality) {
        if (!currentPosterUrls[quality]) return;
        
        elements.posterImage.classList.add('loading');
        elements.posterImage.src = currentPosterUrls[quality];
        elements.directLink.href = currentPosterUrls[quality];
        
        // Actualizar botón activo
        if (elements.qualityOptions) {
            const qualityBtns = elements.qualityOptions.querySelectorAll('.quality-btn');
            qualityBtns.forEach(btn => {
                if (btn.getAttribute('data-quality') === quality) {
                    btn.classList.add('active');
                } else {
                    btn.classList.remove('active');
                }
            });
        }
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
        if (elements.loadingDiv) elements.loadingDiv.classList.remove('d-none');
    }

    function hideLoading() {
        if (elements.loadingDiv) elements.loadingDiv.classList.add('d-none');
    }

    function showError(message) {
        if (elements.errorDiv) {
            elements.errorDiv.innerHTML = message;
            elements.errorDiv.classList.remove('d-none');
        }
    }

    function resetUI() {
        if (elements.errorDiv) elements.errorDiv.classList.add('d-none');
        if (elements.resultDiv) elements.resultDiv.classList.add('d-none');
        if (elements.framesContainer) elements.framesContainer.style.display = 'none';
        if (elements.framesGrid) elements.framesGrid.innerHTML = '';
        
        currentPosterUrls = {};
        videoFrames = [];
        
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
