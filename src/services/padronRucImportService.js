const path = require('path');
const { procesarArchivoZip } = require('./padronRucZipService');
const { ErrorInfraestructuraPadronRuc } = require('./padronRucPersistenciaService');

const resultadoVacio = (archivo, error) => ({
    archivo,
    lineasLeidas: 0,
    registrosValidos: 0,
    registrosInvalidos: 0,
    lotesProcesados: 0,
    error
});

/**
 * Importa uno o varios ZIP del padrón de RUC de forma secuencial (nunca en paralelo, para
 * acotar memoria/CPU/conexiones a la BD). Reutilizable fuera del endpoint HTTP — p. ej. desde
 * un script de línea de comandos o un cron — por lo que no asume nada sobre el origen de los
 * archivos ni los borra: quien la llama decide qué hacer con los archivos de entrada.
 *
 * Un error de datos/ZIP puntual de un archivo no aborta el resto (se reporta en `resultados`
 * y se sigue). Un error de infraestructura (falla de BD) sí aborta el resto de los archivos
 * pendientes, para no dejar resultados inconsistentes.
 *
 * @param {string[]} rutasArchivos
 * @returns {Promise<object>} resumen de la importación
 */
const importarPadronRuc = async (rutasArchivos) => {
    const inicio = Date.now();
    const archivosRecibidos = rutasArchivos.length;

    console.log(`[padronRuc] Inicio de importación de ${archivosRecibidos} archivo(s)`);

    const resumen = {
        archivosRecibidos,
        archivosProcesados: 0,
        archivosConError: 0,
        lineasLeidas: 0,
        registrosValidos: 0,
        registrosInvalidos: 0,
        lotesProcesados: 0,
        duracionMs: 0,
        error: null,
        resultados: []
    };

    let abortado = false;

    for (const rutaArchivo of rutasArchivos) {
        const nombreArchivo = path.basename(rutaArchivo);

        if (abortado) {
            resumen.resultados.push(resultadoVacio(
                nombreArchivo,
                'No procesado: la importación se abortó por un error de infraestructura en un archivo anterior'
            ));
            continue;
        }

        console.log(`[padronRuc] Procesando "${nombreArchivo}"...`);

        try {
            const stats = await procesarArchivoZip(rutaArchivo);

            resumen.archivosProcesados += 1;
            resumen.lineasLeidas += stats.lineasLeidas;
            resumen.registrosValidos += stats.registrosValidos;
            resumen.registrosInvalidos += stats.registrosInvalidos;
            resumen.lotesProcesados += stats.lotesProcesados;

            resumen.resultados.push({
                archivo: nombreArchivo,
                ...stats,
                error: null
            });

            console.log(`[padronRuc] "${nombreArchivo}" OK: ${stats.registrosValidos} válidos, ${stats.registrosInvalidos} inválidos, ${stats.lotesProcesados} lote(s)`);
        } catch (error) {
            const statsParciales = error.statsParciales || {};
            resumen.archivosConError += 1;
            resumen.lineasLeidas += statsParciales.lineasLeidas || 0;
            resumen.registrosValidos += statsParciales.registrosValidos || 0;
            resumen.registrosInvalidos += statsParciales.registrosInvalidos || 0;
            resumen.lotesProcesados += statsParciales.lotesProcesados || 0;

            resumen.resultados.push({
                archivo: nombreArchivo,
                lineasLeidas: statsParciales.lineasLeidas || 0,
                registrosValidos: statsParciales.registrosValidos || 0,
                registrosInvalidos: statsParciales.registrosInvalidos || 0,
                lotesProcesados: statsParciales.lotesProcesados || 0,
                error: error.message
            });

            if (error instanceof ErrorInfraestructuraPadronRuc) {
                console.error(`[padronRuc] Error de infraestructura en "${nombreArchivo}", se aborta el resto de la importación: ${error.message}`);
                resumen.error = error.message;
                abortado = true;
            } else {
                console.error(`[padronRuc] Error procesando "${nombreArchivo}", se continúa con el resto: ${error.message}`);
            }
        }
    }

    resumen.duracionMs = Date.now() - inicio;

    console.log(`[padronRuc] Fin de importación en ${resumen.duracionMs}ms: ${resumen.archivosProcesados}/${archivosRecibidos} archivo(s) OK, ${resumen.registrosValidos} registros válidos, ${resumen.registrosInvalidos} inválidos`);

    return resumen;
};

module.exports = {
    importarPadronRuc
};
