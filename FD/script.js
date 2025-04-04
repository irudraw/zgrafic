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
        copyEmbed: document.getElementById('copyEmbed'),
        fallbackOptions: document.getElementById('fallbackOptions'),
        tryAlternative: document.getElementById('tryAlternative')
    };

    let currentPosterUrls = {};
    let currentVideoUrl = '';
    let retryAttempts = 0;

    // Event Listeners
    elements.findPosterBtn.addEventListener('click', processFacebookUrl);
    elements.downloadBtn.addEventListener('click', downloadImage);
    elements.copyEmbed.addEventListener('click', copyEmbedCode);
    elements.tryAlternative.addEventListener('click', tryAlternativeMethod);
    
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
        retryAttempts = 0;
        
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
            await fetchAndDisplayData(videoUrl);
        } catch (error) {
            showError(error.message);
            console.error('Error:', error);
        } finally {
            hideLoading();
        }
    }

    async function fetchAndDisplayData(videoUrl) {
        const posterData = await fetchPosterData(videoUrl);
        
        if (!posterData.original) {
            elements.fallbackOptions.classList.remove('d-none');
            throw new Error('No se pudo obtener la miniatura del video');
        }

        currentPosterUrls = posterData;
        displayResults(posterData.original);
        setupVideoPlayer(videoUrl);
        generateEmbedCode(videoUrl);
    }

    async function tryAlternativeMethod() {
        if (retryAttempts >= 2) {
            showError('No se pudo obtener la miniatura después de varios intentos');
            return;
        }
        
        showLoading();
        elements.fallbackOptions.classList.add('d-none');
        retryAttempts++;
        
        try {
            await fetchAndDisplayData(currentVideoUrl);
        } catch (error) {
            showError(error.message);
        } finally {
            hideLoading();
        }
    }

    async function fetchPosterData(videoUrl) {
        const pluginUrl = `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(videoUrl)}&show_text=false&width=500`;
        const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(pluginUrl)}`;
        
        try {
            const response = await fetch(proxyUrl);
            if (!response.ok) throw new Error('Error al conectar con el servidor');
            
            const data = await response.json();
            const htmlContent = data.contents;
            const imageUrl = extractImageUrl(htmlContent);
            
            if (!imageUrl) throw new Error('No se pudo extraer la miniatura');
            
            return {
                sd: setImageDimensions(imageUrl, 640, 360),
                hd: setImageDimensions(imageUrl, 1280, 720),
                original: imageUrl
            };
        } catch (error) {
            console.error('Error fetching poster data:', error);
            throw error;
        }
    }

    function extractImageUrl(html) {
        // Método 1: Meta tags
        const metaMatch = html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/i);
        if (metaMatch) return metaMatch[1].replace(/&amp;/g, '&');
        
        // Método 2: Imágenes con data-visual-completion
        const imgMatch = html.match(/<img[^>]+(data-src|src)="([^"]+)"[^>]+data-visual-completion=/i);
        if (imgMatch) return imgMatch[2].replace(/&amp;/g, '&');
        
        // Método 3: Atributo poster de video
        const videoMatch = html.match(/<video[^>]+poster="([^"]+)"/i);
        if (videoMatch) return videoMatch[1].replace(/&amp;/g, '&');
        
        // Método 4: Buscar en JSON
        const jsonMatch = html.match(/"thumbnail_url":"([^"]+)"/i);
        if (jsonMatch) return jsonMatch[1].replace(/\\\//g, '/');
        
        return null;
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

    function setupVideoPlayer(videoUrl) {
        const isReel = isReelUrl(videoUrl);
        const embedUrl = `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(videoUrl)}&show_text=false&width=500`;
        
        elements.videoPlayer.src = embedUrl;
        elements.videoWrapper.classList.toggle('reel-format', isReel);
    }

    function generateEmbedCode(videoUrl) {
        const isReel = isReelUrl(videoUrl);
        const width = isReel ? '350' : '500';
        const height = isReel ? '623' : '281';
        
        const embedHTML = `<iframe src="https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(videoUrl)}&show_text=false&width=${width}&height=${height}" width="${width}" height="${height}" style="border:none;overflow:hidden" scrolling="no" frameborder="0" allowfullscreen="true" allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share" allowFullScreen="true"></iframe>`;
        
        elements.embedCode.value = embedHTML;
    }

    function isReelUrl(url) {
        return url.includes('/reel/') || url.includes('/reels/');
    }

    function copyEmbedCode() {
        elements.embedCode.select();
        document.execCommand('copy');
        
        const originalText = elements.copyEmbed.textContent;
        elements.copyEmbed.textContent = '¡Copiado!';
        
        setTimeout(() => {
            elements.copyEmbed.textContent = originalText;
        }, 2000);
    }

    function displayResults(imageUrl) {
        elements.posterImage.src = imageUrl;
        elements.resultDiv.classList.remove('d-none');
        
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
        if (!elements.posterImage.src || elements.posterImage.src.includes('placeholder.com')) {
            showError('No hay imagen válida para descargar');
            return;
        }

        const link = document.createElement('a');
        link.href = elements.posterImage.src;
        link.download = `facebook-thumbnail-${Date.now()}.jpg`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

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
        elements.fallbackOptions.classList.add('d-none');
        elements.posterImage.src = '';
        elements.videoPlayer.src = '';
        elements.embedCode.value = '';
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
