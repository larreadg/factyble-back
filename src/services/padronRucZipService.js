const readline = require('readline');
const yauzl = require('yauzl');
const { parsearLinea } = require('../utils/padronRucParser');
const { guardarLote } = require('./padronRucPersistenciaService');
const { BATCH_SIZE } = require('../utils/padronRucConfig');
const ErrorApp = require('../utils/error');

/**
 * Procesa un único ZIP del padrón de RUC en streaming: abre el ZIP con `yauzl` en modo
 * `lazyEntries` (nunca carga el ZIP ni el TXT interno completos en memoria), localiza el
 * primer `.txt`, lo lee línea por línea con `readline`, y acumula registros válidos en un
 * buffer que se vacía a la base de datos cada `BATCH_SIZE` líneas.
 *
 * `yauzl.open` valida la estructura real del ZIP (no confía en la extensión/mimetype del
 * archivo recibido) — si el archivo no es un ZIP válido, la promesa rechaza acá.
 *
 * @param {string} rutaZip
 * @returns {Promise<{lineasLeidas: number, registrosValidos: number, registrosInvalidos: number, lotesProcesados: number}>}
 */
const procesarArchivoZip = (rutaZip) => {
    return new Promise((resolve, reject) => {
        const stats = {
            lineasLeidas: 0,
            registrosValidos: 0,
            registrosInvalidos: 0,
            lotesProcesados: 0
        };

        let buffer = [];
        let txtEncontrado = false;
        let liquidado = false;

        const terminarConError = (zipfile, error) => {
            if (liquidado) return;
            liquidado = true;
            if (zipfile) zipfile.close();
            // Se adjuntan las estadísticas parciales para que el orquestador pueda reportar
            // cuánto se alcanzó a procesar antes del error, en vez de perder ese progreso.
            error.statsParciales = { ...stats };
            reject(error);
        };

        const terminarOk = (zipfile) => {
            if (liquidado) return;
            liquidado = true;
            if (zipfile) zipfile.close();
            resolve(stats);
        };

        yauzl.open(rutaZip, { lazyEntries: true, autoClose: false }, (err, zipfile) => {
            if (err) {
                return terminarConError(null, new ErrorApp(`Archivo ZIP inválido o corrupto: ${err.message}`, 400));
            }

            zipfile.on('error', (error) => {
                terminarConError(zipfile, new ErrorApp(`Error leyendo ZIP: ${error.message}`, 400));
            });

            zipfile.on('end', () => {
                if (!txtEncontrado) {
                    terminarConError(zipfile, new ErrorApp('El ZIP no contiene ningún archivo .txt', 400));
                }
                // Si ya se encontró y procesó el .txt, `terminarOk` ya se llamó desde 'close' del readline.
            });

            zipfile.on('entry', (entry) => {
                const esDirectorio = /\/$/.test(entry.fileName);
                const esTxt = !esDirectorio && entry.fileName.toLowerCase().endsWith('.txt');

                if (txtEncontrado || !esTxt) {
                    zipfile.readEntry();
                    return;
                }

                txtEncontrado = true;

                zipfile.openReadStream(entry, (error, readStream) => {
                    if (error) {
                        return terminarConError(zipfile, new ErrorApp(`No se pudo leer "${entry.fileName}" dentro del ZIP: ${error.message}`, 400));
                    }

                    readStream.on('error', (streamError) => {
                        terminarConError(zipfile, new ErrorApp(`Error de lectura de "${entry.fileName}": ${streamError.message}`, 400));
                    });

                    const rl = readline.createInterface({ input: readStream, crlfDelay: Infinity });

                    const flush = () => {
                        const lote = buffer;
                        buffer = [];
                        return guardarLote(lote).then(() => {
                            stats.lotesProcesados += 1;
                        });
                    };

                    rl.on('line', (linea) => {
                        stats.lineasLeidas += 1;

                        const resultado = parsearLinea(linea);
                        if (!resultado.valida) {
                            if (linea.trim() !== '') stats.registrosInvalidos += 1;
                            return;
                        }

                        stats.registrosValidos += 1;
                        buffer.push(resultado.registro);

                        if (buffer.length >= BATCH_SIZE) {
                            rl.pause();
                            flush()
                                .then(() => rl.resume())
                                .catch((flushError) => terminarConError(zipfile, flushError));
                        }
                    });

                    rl.on('close', () => {
                        if (liquidado) return;
                        // Ya se encontró y procesó el único .txt que nos interesa — no hace
                        // falta seguir iterando el resto de las entradas del ZIP.
                        (buffer.length > 0 ? flush() : Promise.resolve())
                            .then(() => terminarOk(zipfile))
                            .catch((flushError) => terminarConError(zipfile, flushError));
                    });
                });
            });

            zipfile.readEntry();
        });
    });
};

module.exports = {
    procesarArchivoZip
};
