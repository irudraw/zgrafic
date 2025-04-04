document.addEventListener('DOMContentLoaded', function() {
    // Elementos del DOM
    const elements = {
        findPosterBtn: document.getElementById('findPoster'),
        videoUrlInput: document.getElementById('videoUrl'),
        errorDiv: document.getElementById('error'),
        loadingDiv: document.getElementById('loading'),
        resultDiv: document.getElementById('result'),
        posterImage: document.getElementById('posterImage'),
        qualityOptions: document.getElementById('qualityOptions'),
        downloadBtn: document.getElementById('downloadBtn'),
        videoContainer: document.getElementById('videoContainer'),
        videoPlayer: document.getElementById('videoPlayer'),
        videoWrapper: document.querySelector('.video-responsive'),
        embedSection: document.getElementById('embedSection'),
        embedCode: document.getElementById('embedCode'),
        copyEmbed: document.getElementById('copyEmbed')
    };

    let currentPosterUrls = {};
    let currentVideoUrl = '';

    // Event Listeners
    elements.findPosterBtn.addEventListener('click', processFacebookUrl);
    elements.downloadBtn.addEventListener('click', downloadImage);
    elements.copyEmbed.addEventListener('click', copyEmbedCode);
    
    elements.qualityOptions.addEventListener('click', function(e) {
        if (e.target.classList.contains('quality-btn')) {
            const quality = e.target.getAttribute('data-quality');
            if (currentPosterUrls[quality]) {
                changeImageQuality(quality);
            }
        }
    });

    // Función principal
    async function processFacebookUrl() {
        const videoUrl = elements.videoUrlInput.value.trim();
        currentVideoUrl = videoUrl;
        
        if (!videoUrl) {
            showError('Por favor ingresa una URL de Facebook');
            return;
        }

        if (!isValidFacebookUrl(videoUrl)) {
            showError('Formato de URL no válido. Ejemplos válidos:<br>' + 
                     '• https://www.facebook.com/watch/?v=1234567890<br>' +
                     '• https://www.facebook.com/reel/1234567890');
            return;
        }

        resetUI();
        showLoading();

        try {
            // Obtener datos del video
            const posterData = await fetchPosterData(videoUrl);
            
            if (!posterData.original) {
                throw new Error('No se pudo obtener la miniatura del video');
            }

            currentPosterUrls = posterData;
            displayResults(posterData.original);
            setupVideoPlayer(videoUrl);
            generateEmbedCode(videoUrl);
        } catch (error) {
            showError(error.message);
            console.error('Error:', error);
        } finally {
            hideLoading();
        }
    }

    // Configurar reproductor de video
    function setupVideoPlayer(videoUrl) {
        const isReel = videoUrl.includes('/reel/') || videoUrl.includes('/reels/');
        const embedUrl = `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(videoUrl)}&show_text=false&width=500`;
        
        elements.videoPlayer.src = embedUrl;
        
        // Ajustar aspecto según el tipo de video
        if (isReel) {
            elements.videoWrapper.classList.add('reel-format');
        } else {
            elements.videoWrapper.classList.remove('reel-format');
        }
    }

    // Generar código embed
    function generateEmbedCode(videoUrl) {
        const isReel = videoUrl.includes('/reel/') || videoUrl.includes('/reels/');
        const width = isReel ? '350' : '500';
        const height = isReel ? '623' : '281';
        
        const embedHTML = `<iframe src="https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(videoUrl)}&show_text=false&width=${width}&height=${height}" width="${width}" height="${height}" style="border:none;overflow:hidden" scrolling="no" frameborder="0" allowfullscreen="true" allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share" allowFullScreen="true"></iframe>`;
        
        elements.embedCode.value = embedHTML;
    }

    // Copiar código embed
    function copyEmbedCode() {
        elements.embedCode.select();
        document.execCommand('copy');
        
        const originalText = elements.copyEmbed.textContent;
        elements.copyEmbed.textContent = '¡Copiado!';
        
        setTimeout(() => {
            elements.copyEmbed.textContent = originalText;
        }, 2000);
    }

    // Obtener datos del poster
    async function fetchPosterData(videoUrl) {
        const pluginUrl = `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(videoUrl)}&show_text=false&width=500`;
        const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(pluginUrl)}`;
        
        const response = await fetch(proxyUrl);
        const data = await response.json();
        
        if (!response.ok) throw new Error('Error al conectar con el servidor');

        return extractImageUrls(data.contents);
    }

    // Extraer URLs de imagen
    function extractImageUrls(htmlContent) {
        const baseUrl = extractBaseImageUrl(htmlContent);
        if (!baseUrl) throw new Error('No se encontró la miniatura del video');

        return {
            sd: setImageDimensions(baseUrl, 640, 360),
            hd: setImageDimensions(baseUrl, 1280, 720),
            original: baseUrl
        };
    }

    // Funciones auxiliares
    function extractBaseImageUrl(html) {
        const metaMatch = html.match(/<meta property="og:image" content="([^"]+)"/i);
        return metaMatch ? metaMatch[1].replace(/&amp;/g, '&') : null;
    }

    function setImageDimensions(url, width, height) {
        try {
            const urlObj = new URL(url);
            urlObj.searchParams.set('width', width);
            urlObj.searchParams.set('height', height);
            return urlObj.toString();
        } catch {
            return url;
        }
    }

    function displayResults(imageUrl) {
        elements.posterImage.src = imageUrl;
        elements.resultDiv.classList.remove('d-none');
        
        // Configurar botones de calidad
        document.querySelectorAll('.quality-btn').forEach(btn => {
            const quality = btn.getAttribute('data-quality');
            btn.classList.toggle('disabled', !currentPosterUrls[quality]);
            btn.classList.toggle('active', quality === 'original');
        });
    }

    function changeImageQuality(quality) {
        elements.posterImage.classList.add('loading');
        elements.posterImage.src = currentPosterUrls[quality];
        
        document.querySelectorAll('.quality-btn').forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-quality') === quality);
        });
    }

    function downloadImage() {
        const link = document.createElement('a');
        link.href = elements.posterImage.src;
        link.download = `facebook-thumbnail-${Date.now()}.jpg`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    // Helpers de UI
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
        elements.posterImage.src = '';
        elements.videoPlayer.src = '';
        currentPosterUrls = {};
    }

    function isValidFacebookUrl(url) {
        const patterns = [
            /facebook\.com\/watch\/\?v=\d+/i,
            /facebook\.com\/.+\/videos\/\d+/i,
            /facebook\.com\/video\.php\?v=\d+/i,
            /fb\.watch\/[a-zA-Z0-9_-]+/i,
            /facebook\.com\/reel\/\d+/i,
            /facebook\.com\/.+\/reels\/\d+/i
        ];
        return patterns.some(pattern => pattern.test(url));
    }

    // Manejo de eventos de imagen
    elements.posterImage.onload = function() {
        this.classList.remove('loading');
    };
    
    elements.posterImage.onerror = function() {
        this.src = 'https://via.placeholder.com/500x281?text=Imagen+no+disponible';
        this.classList.remove('loading');
    };
});
