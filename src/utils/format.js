
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

module.exports = {
    formatNumber,
    formatNumberWithLeadingZeros,
    formatNumeroDocumento
}