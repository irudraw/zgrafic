document.addEventListener('DOMContentLoaded', function() {
    const videoElement = document.getElementById('myVideo');
    const urlParams = new URLSearchParams(window.location.search);
    const fileId = urlParams.get('id');
    const fileKey = urlParams.get('key');

    if (fileId && fileKey) {
        loadMegaScript()
            .then(() => initMega())
            .then(() => loadVideo(fileId, fileKey))
            .catch(error => console.error('Error general:', error));
    } else {
        console.error('No se proporcionó ID de archivo o clave');
    }

    function loadMegaScript() {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://eu.static.mega.co.nz/3/|mega.min.js';
            script.onload = resolve;
            script.onerror = reject;
            document.body.appendChild(script);
        });
    }

    function initMega() {
        return new Promise((resolve, reject) => {
            mega.init((error) => {
                if (error) {
                    console.error("Error al inicializar Mega:", error);
                    reject(error);
                } else {
                    console.log("Mega inicializado correctamente");
                    resolve();
                }
            });
        });
    }

    function loadVideo(fileId, fileKey) {
        mega.file.get(fileId, fileKey)
            .then(file => {
                console.log("Archivo obtenido:", file);
                if (file.mime.startsWith('video/')) {
                    return streamVideo(file);
                } else {
                    throw new Error('El archivo no es un video');
                }
            })
            .catch(error => {
                console.error('Error detallado al cargar el video:', error);
                if (error.stack) console.error(error.stack);
            });
    }

    function streamVideo(file) {
        return new Promise((resolve, reject) => {
            mega.file.getStream(file, (stream) => {
                if (stream) {
                    videoElement.src = URL.createObjectURL(stream);
                    videoElement.onloadedmetadata = () => {
                        console.log("Metadatos del video cargados");
                        videoElement.play()
                            .then(() => {
                                console.log("Reproducción iniciada");
                                resolve();
                            })
                            .catch(e => {
                                console.error("Error al reproducir:", e);
                                reject(e);
                            });
                    };
                    videoElement.onerror = (e) => {
                        console.error("Error en el elemento de video:", e);
                        reject(e);
                    };
                } else {
                    reject(new Error("No se pudo obtener el stream del video"));
                }
            });
        });
    }

    // Función alternativa para descargar el video por partes si el streaming falla
    function downloadVideo(file) {
        return new Promise((resolve, reject) => {
            const chunks = [];
            mega.file.download(file, (buffer, offset) => {
                chunks.push(buffer);
                console.log(`Descargado ${offset} de ${file.size} bytes`);
                if (offset === file.size) {
                    const blob = new Blob(chunks, { type: file.mime });
                    videoElement.src = URL.createObjectURL(blob);
                    videoElement.onloadedmetadata = () => {
                        console.log("Metadatos del video cargados");
                        videoElement.play()
                            .then(() => {
                                console.log("Reproducción iniciada");
                                resolve();
                            })
                            .catch(e => {
                                console.error("Error al reproducir:", e);
                                reject(e);
                            });
                    };
                    videoElement.onerror = (e) => {
                        console.error("Error en el elemento de video:", e);
                        reject(e);
                    };
                }
            });
        });
    }
});