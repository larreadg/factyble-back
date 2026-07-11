const fs = require('fs');
const sharp = require('sharp');

const MAX_BYTES_DEFAULT = 300 * 1024;
const INTENTOS_MAXIMOS = 8;

const esperar = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Reintenta una operación de lectura de disco unas pocas veces con backoff corto. En este
 * entorno Windows se observó más de una vez (acá y con el query engine de Prisma) que un
 * archivo recién escrito queda momentáneamente bloqueado — probablemente por un antivirus/EDR
 * escaneándolo on-access — y una relectura inmediata falla con `UNKNOWN: unknown error, open
 * ...` aunque el archivo esté perfectamente sano un instante después.
 */
const conReintentos = async (fn, intentos = 3, delayMs = 150) => {
  let ultimoError;
  for (let i = 0; i < intentos; i++) {
    try {
      return await fn();
    } catch (error) {
      ultimoError = error;
      if (i < intentos - 1) await esperar(delayMs);
    }
  }
  throw ultimoError;
};

/**
 * Comprime una imagen en el filesystem in-place hasta que no supere `maxBytes`: reduce
 * dimensión máxima y calidad de forma iterativa (JPEG: calidad; PNG: paleta +
 * compressionLevel, preservando canal alfa) hasta entrar bajo el límite. El archivo de
 * destino conserva el mismo path/extensión — solo cambian los bytes.
 * @param {string} rutaArchivo - Path absoluto del archivo ya guardado en disco
 * @param {Object} [opciones]
 * @param {number} [opciones.maxBytes] - Límite duro de tamaño final (default 300KB)
 * @throws {Error} Si ni el intento más agresivo entra bajo `maxBytes`
 */
const comprimirImagen = async (rutaArchivo, { maxBytes = MAX_BYTES_DEFAULT } = {}) => {
  const metadata = await conReintentos(() => sharp(rutaArchivo).metadata());
  const esJpeg = metadata.format === 'jpeg';

  let maxDimension = 1600;
  let calidad = 80;

  for (let intento = 0; intento < INTENTOS_MAXIMOS; intento++) {
    const buffer = await conReintentos(() => {
      let pipeline = sharp(rutaArchivo).resize({
        width: maxDimension,
        height: maxDimension,
        fit: 'inside',
        withoutEnlargement: true,
      });

      pipeline = esJpeg
        ? pipeline.jpeg({ quality: calidad, mozjpeg: true })
        : pipeline.png({ quality: calidad, compressionLevel: 9, palette: true });

      return pipeline.toBuffer();
    });

    if (buffer.length <= maxBytes) {
      // Escribir directo sobre `rutaArchivo` justo después de que sharp lo acaba de leer
      // dispara un sharing violation en Windows (el handle de lectura de libvips no se libera
      // a tiempo) — se ve como "UNKNOWN: unknown error, open ...". Escribir a un temporal y
      // renombrar evita el conflicto y de paso deja el reemplazo atómico.
      const rutaTemporal = `${rutaArchivo}.tmp${process.pid}`;
      fs.writeFileSync(rutaTemporal, buffer);
      fs.renameSync(rutaTemporal, rutaArchivo);
      return;
    }

    calidad = Math.max(30, calidad - 15);
    maxDimension = Math.round(maxDimension * 0.8);
  }

  throw new Error(`No se pudo comprimir la imagen por debajo de ${Math.round(maxBytes / 1024)}KB`);
};

module.exports = { comprimirImagen };
