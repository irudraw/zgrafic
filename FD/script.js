document.addEventListener('DOMContentLoaded', function() {
    const findPosterBtn = document.getElementById('findPoster');
    const videoUrlInput = document.getElementById('videoUrl');
    const errorDiv = document.getElementById('error');
    const resultDiv = document.getElementById('result');
    const posterImage = document.getElementById('posterImage');
    const downloadBtn = document.getElementById('downloadBtn');
    const directLink = document.getElementById('directLink');

    findPosterBtn.addEventListener('click', findPoster);
    downloadBtn.addEventListener('click', downloadImage);

    async function findPoster() {
        const videoUrl = videoUrlInput.value.trim();
        
        // Validar URL
        if (!videoUrl) {
            showError('Por favor ingresa una URL');
            return;
        }

        if (!isValidFacebookUrl(videoUrl)) {
            showError('La URL no parece ser de un video de Facebook');
            return;
        }

        // Mostrar carga
        posterImage.src = '';
        posterImage.alt = 'Cargando...';
        resultDiv.classList.remove('d-none');
        errorDiv.classList.add('d-none');

        try {
            // Usar un proxy backend para obtener la imagen
            const posterUrl = await getPosterThroughProxy(videoUrl);
            
            if (!posterUrl) {
                showError('No se pudo obtener la imagen poster. El video puede ser privado o la URL incorrecta.');
                return;
            }

            // Mostrar resultado
            posterImage.src = posterUrl;
            posterImage.alt = 'Poster del video de Facebook';
            directLink.href = posterUrl;
        } catch (error) {
            showError('Error al obtener la imagen: ' + error.message);
            console.error(error);
        }
    }

    async function getPosterThroughProxy(videoUrl) {
        // En una implementación real, aquí llamarías a tu propio backend
        // Esta es una implementación simulada para demostración
        
        // Extraer el ID del video
        const videoId = extractVideoId(videoUrl);
        if (!videoId) return null;

        // Intentar con diferentes métodos para obtener la miniatura
        const methods = [
            `https://img.facebook.com/${videoId}/picture`,
            `https://graph.facebook.com/${videoId}/picture`,
            `https://www.facebook.com/thumbnail.php?vid=${videoId}`
        ];

        // Probar cada método hasta encontrar uno que funcione
        for (const url of methods) {
            try {
                const response = await fetch(url, { method: 'HEAD' });
                if (response.ok) {
                    return url;
                }
            } catch (e) {
                console.log(`Método fallido: ${url}`);
            }
        }

        // Si ningún método directo funciona, requeriría un backend con scraping
        return null;
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
    }

    function isValidFacebookUrl(url) {
        return url.includes('facebook.com') && (url.includes('/watch/') || url.includes('/video/'));
    }

    function extractVideoId(url) {
        // Patrones actualizados para extraer ID de video
        const patterns = [
            /facebook\.com\/watch\/\?v=(\d+)/,
            /facebook\.com\/.+\/videos\/(\d+)/,
            /facebook\.com\/video\.php\?v=(\d+)/,
            /fb\.watch\/([a-zA-Z0-9_-]+)/
        ];
        
        for (const pattern of patterns) {
            const match = url.match(pattern);
            if (match) return match[1];
        }
        return null;
    }
});
