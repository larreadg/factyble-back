/**
 * Parseo/normalización de una línea del TXT del padrón de RUC (formato SET/DNIT):
 *   ruc|razonSocial|digitoVerificador|rucAnterior|estado|
 * El '|' final genera una posición vacía extra al hacer split, que se descarta acá.
 */

// El padrón real de la SET/DNIT incluye RUC puramente numéricos, pero también algunos con un
// sufijo de una sola letra (p. ej. "1028959B") — usado históricamente para desambiguar dos
// contribuyentes que quedaron con el mismo número de RUC base. Por eso el campo se guarda
// como texto y no como número, y el formato acepta ese sufijo opcional.
const RUC_REGEX = /^\d{1,14}[A-Za-z]?$/;
const DV_REGEX = /^\d{1,2}$/;

/**
 * @param {string} lineaCruda
 * @returns {{ valida: true, registro: { ruc: string, razonSocial: string, digitoVerificador: string, rucAnterior: string|null, estado: string } } | { valida: false, motivo: string }}
 */
const parsearLinea = (lineaCruda) => {
    if (typeof lineaCruda !== 'string') {
        return { valida: false, motivo: 'Línea no es texto' };
    }

    const linea = lineaCruda.replace(/[\r\n]+$/, '').trim();

    if (linea === '') {
        return { valida: false, motivo: 'Línea vacía' };
    }

    const partes = linea.split('|');

    // El formato válido termina en '|', lo que agrega una posición vacía final que se ignora.
    if (partes.length > 0 && partes[partes.length - 1] === '') {
        partes.pop();
    }

    // Si tras descartar el separador final no quedan exactamente 5 campos, la línea está
    // incompleta o tiene un '|' de más (p. ej. dentro de la razón social) — se rechaza en vez
    // de intentar adivinar qué campo se corrió, para no guardar datos desplazados.
    if (partes.length !== 5) {
        return { valida: false, motivo: `Se esperaban 5 campos, se encontraron ${partes.length}` };
    }

    const [rucRaw, razonSocialRaw, dvRaw, rucAnteriorRaw, estadoRaw] = partes;

    const ruc = rucRaw.trim();
    const razonSocial = razonSocialRaw.trim();
    const digitoVerificador = dvRaw.trim();
    const rucAnterior = rucAnteriorRaw.trim();
    const estado = estadoRaw.trim();

    if (!RUC_REGEX.test(ruc)) {
        return { valida: false, motivo: `RUC con formato inválido: "${ruc}"` };
    }

    if (!DV_REGEX.test(digitoVerificador)) {
        return { valida: false, motivo: `Dígito verificador con formato inválido: "${digitoVerificador}"` };
    }

    if (razonSocial === '' || razonSocial.length > 255) {
        return { valida: false, motivo: 'Razón social vacía o demasiado larga' };
    }

    if (rucAnterior.length > 20) {
        return { valida: false, motivo: 'RUC anterior demasiado largo' };
    }

    if (estado === '' || estado.length > 50) {
        return { valida: false, motivo: 'Estado vacío o demasiado largo' };
    }

    return {
        valida: true,
        registro: {
            ruc,
            razonSocial,
            digitoVerificador,
            rucAnterior: rucAnterior === '' ? null : rucAnterior,
            estado
        }
    };
};

module.exports = {
    parsearLinea
};
