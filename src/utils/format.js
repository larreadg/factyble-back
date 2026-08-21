
const formatNumber = (num) => {
   return new Intl.NumberFormat('de-DE', { useGrouping: true }).format(num)
}

const formatNumberWithLeadingZeros = (number) => {
    return number.toString().padStart(7, '0');
}

// Número de documento tal como se imprime en el PDF/KuDE: establecimiento-caja-numero, con el número
// rellenado a 7 dígitos (ej. "001-001-0000002"). Es el mismo criterio que arma emitirFactura/
// emitirNotaDeCredito/emitirRecibo — centralizado acá para no duplicarlo. Devuelve null cuando falta
// el establecimiento o la caja (p. ej. documentos legacy con caja_id NULL), ya que sin ambos códigos
// no se puede reconstruir el número impreso.
const formatNumeroDocumento = (establecimientoCodigo, cajaCodigo, numero) => {
    if (!establecimientoCodigo || !cajaCodigo || numero == null) return null;
    return `${establecimientoCodigo}-${cajaCodigo}-${formatNumberWithLeadingZeros(numero)}`;
}

// Inversa de formatNumeroDocumento: parsea "EEE-PPP-NNNNNNN" (ej. "001-002-0000062") y devuelve sus
// tres componentes { establecimiento, caja, numero } — establecimiento/caja como string de 3 dígitos
// (así se comparan contra Establecimiento.codigo / Caja.codigo) y numero como Int (el numero_factura /
// numero_nota_credito almacenado, sin ceros a la izquierda). Devuelve null si el valor no es un string
// con ese formato exacto o el secuencial no es un entero >= 1. Se usa para aceptar el número impreso
// completo en endpoints que históricamente pedían caja + número por separado.
const RE_NUMERO_DOCUMENTO = /^(\d{3})-(\d{3})-(\d+)$/;
const parseNumeroDocumento = (valor) => {
    if (typeof valor !== 'string') return null;
    const match = valor.trim().match(RE_NUMERO_DOCUMENTO);
    if (!match) return null;
    const numero = parseInt(match[3], 10);
    if (!Number.isInteger(numero) || numero < 1) return null;
    return { establecimiento: match[1], caja: match[2], numero };
}

module.exports = {
    formatNumber,
    formatNumberWithLeadingZeros,
    formatNumeroDocumento,
    parseNumeroDocumento
}