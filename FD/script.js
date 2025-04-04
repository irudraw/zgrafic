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
            showError('La URL no parece ser de un video de Facebook. Ejemplo válido: https://www.facebook.com/watch/?v=1234567890');
            return;
        }

        loadingDiv.classList.remove('d-none');
        resultDiv.classList.add('d-none');
        errorDiv.classList.add('d-none');

        try {
            // Usamos un servicio proxy público (AllOrigins como ejemplo)
            const encodedUrl = encodeURIComponent(videoUrl);
            const proxyUrl = `https://api.allorigins.win/get?url=${encodedUrl}`;
            
            const response = await fetch(proxyUrl);
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error('No se pudo acceder al video');
            }

            // Extraemos la imagen del contenido HTML (solución alternativa)
            const posterUrl = extractPosterFromContent(data.contents);
            
            if (!posterUrl) {
                throw new Error('No se encontró la imagen poster en esta URL');
            }

            // Verificamos que la imagen sea válida
            const imgValid = await testImage(posterUrl);
            if (!imgValid) {
                throw new Error('La imagen obtenida no es válida');
            }

            posterImage.src = posterUrl;
            directLink.href = posterUrl;
            resultDiv.classList.remove('d-none');
        } catch (error) {
            showError('Error: ' + error.message);
            console.error(error);
        } finally {
            loadingDiv.classList.add('d-none');
        }
    }

    function extractPosterFromContent(htmlContent) {
        // Solución alternativa: buscar metatags o elementos de imagen
        const ogImageMatch = htmlContent.match(/<meta property="og:image" content="([^"]+)"/i);
        if (ogImageMatch && ogImageMatch[1]) {
            return ogImageMatch[1];
        }

        const videoPosterMatch = htmlContent.match(/<video[^>]+poster="([^"]+)"/i);
        if (videoPosterMatch && videoPosterMatch[1]) {
            return videoPosterMatch[1];
        }

        return null;
    }

    async function testImage(url) {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => resolve(true);
            img.onerror = () => resolve(false);
            img.src = url;
        });
    }

    function downloadImage() {
        if (!posterImage.src) {
            showError('No hay imagen para descargar');
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
        errorDiv.textContent = message;
        errorDiv.classList.remove('d-none');
        resultDiv.classList.add('d-none');
        loadingDiv.classList.add('d-none');
    }

    function isValidFacebookUrl(url) {
        const patterns = [
            /facebook\.com\/watch\/\?v=\d+/i,
            /facebook\.com\/.+\/videos\/\d+/i,
            /facebook\.com\/video\.php\?v=\d+/i,
            /fb\.watch\/[a-zA-Z0-9_-]+/i
        ];
        
        return patterns.some(pattern => pattern.test(url));
    }
});
