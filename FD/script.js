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

  function findPoster() {
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

      // Extraer el ID del video
      const videoId = extractVideoId(videoUrl);
      if (!videoId) {
          showError('No se pudo extraer el ID del video de la URL proporcionada');
          return;
      }

      // Construir URL de la imagen poster
      const posterUrl = `https://graph.facebook.com/${videoId}/picture`;
      
      // Mostrar resultado
      posterImage.src = posterUrl;
      directLink.href = posterUrl;
      resultDiv.classList.remove('d-none');
      errorDiv.classList.add('d-none');
  }

  function downloadImage() {
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
      // Extraer ID de diferentes formatos de URL de Facebook
      const watchRegex = /facebook\.com\/watch\/\?v=(\d+)/;
      const videoRegex = /facebook\.com\/.+\/videos\/(\d+)/;
      
      let match = url.match(watchRegex) || url.match(videoRegex);
      return match ? match[1] : null;
  }
});