document.addEventListener('DOMContentLoaded', function() {
    const findPosterBtn = document.getElementById('findPoster');
    const videoUrlInput = document.getElementById('videoUrl');
    const errorDiv = document.getElementById('error');
    const resultDiv = document.getElementById('result');
    const loadingDiv = document.getElementById('loading');
    const posterImage = document.getElementById('posterImage');
    const downloadBtn = document.getElementById('downloadBtn');
    const directLink = document.getElementById('directLink');

    findPosterBtn.addEventListener('click', findPoster);
    downloadBtn.addEventListener('click', downloadImage);

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

        loadingDiv.classList.remove('d-none');
        resultDiv.classList.add('d-none');
        errorDiv.classList.add('d-none');

        try {
            // Construimos la URL del plugin de video
            const pluginUrl = `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(videoUrl)}&show_text=false&width=500`;
            
            // Usamos un proxy CORS para acceder al contenido
            const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(pluginUrl)}`;
            
            const response = await fetch(proxyUrl);
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error('No se pudo acceder al video. Intenta nuevamente.');
            }

            // Extraemos la imagen del contenido HTML
            const posterUrl = await extractPosterFromPluginContent(data.contents);
            
            if (!posterUrl) {
                throw new Error('No se encontró la imagen poster para este video. Puede ser privado o tener restricciones.');
            }

            // Verificamos que la imagen sea válida
            const imgValid = await testImage(posterUrl);
            if (!imgValid) {
                throw new Error('La imagen obtenida no es válida. Facebook puede estar bloqueando el acceso.');
            }

            posterImage.src = posterUrl;
            directLink.href = posterUrl;
            resultDiv.classList.remove('d-none');
        } catch (error) {
            showError(error.message);
            console.error(error);
        } finally {
            loadingDiv.classList.add('d-none');
        }
    }

    async function extractPosterFromPluginContent(htmlContent) {
        const extractionMethods = [
            // 1. Meta tag og:image (primera opción)
            () => {
                const match = htmlContent.match(/<meta property="og:image" content="([^"]+)"/i);
                return match?.[1]?.replace(/&amp;/g, '&');
            },
            // 2. Atributo poster del tag video
            () => {
                const match = htmlContent.match(/<video[^>]+poster="([^"]+)"/i);
                return match?.[1]?.replace(/&amp;/g, '&');
            },
            // 3. Imagen con clase específica
            () => {
                const match = htmlContent.match(/<img[^>]+class="[^"]*img[^"]*"[^>]+src="([^"]+)"/i);
                return match?.[1]?.replace(/&amp;/g, '&');
            },
            // 4. Imagen con data-src
            () => {
                const match = htmlContent.match(/<img[^>]+data-src="([^"]+)"/i);
                return match?.[1]?.replace(/&amp;/g, '&');
            }
        ];

        for (const method of extractionMethods) {
            try {
                const url = method();
                if (url && await testImage(url)) {
                    return url;
                }
            } catch (e) {
                console.warn('Error en método de extracción:', e);
            }
        }
        return null;
    }

    async function testImage(url) {
        return new Promise((resolve) => {
            if (!url) return resolve(false);
            
            // Verificar si es la imagen de error de Facebook
            if (url.includes('rsrc.php') && (url.endsWith('.gif') || url.includes('safe_image.php'))) {
                return resolve(false);
            }

            const img = new Image();
            img.onload = () => resolve(true);
            img.onerror = () => resolve(false);
            img.src = url;
        });
    }

    function downloadImage() {
        if (!posterImage.src || posterImage.src.includes('placeholder.com')) {
            showError('No hay imagen válida para descargar');
            return;
        }

        const link = document.createElement('a');
        link.href = posterImage.src;
        link.download = `facebook-poster-${Date.now()}.jpg`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    function showError(message) {
        errorDiv.innerHTML = message;
        errorDiv.classList.remove('d-none');
        resultDiv.classList.add('d-none');
        loadingDiv.classList.add('d-none');
    }

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
});
