/**
 * Retorna el impuesto de un producto o servicio
 * @param {number} cantidad - Cantidad del producto
 * @param {number} precioUnitario - Precio unitario del producto
 * @param {number} tasa - Tasa de impuestos
 * @returns {number} - Impuesto total
 */
const calcularImpuesto = (cantidad, precioUnitario, tasa) => {
    const iva = calcularConstanteIVA(tasa)
    if(iva === 0) return 0
    return Math.round(calcularPrecio(cantidad, precioUnitario) / iva)
}

/**
 * Calcula la constante de iva
 * @param {number} tasa - Tasa de impuestos
 * @returns {number} - Constante de iva
 */
const calcularConstanteIVA = (tasa) => {
    switch(tasa){
        case '0%':
            return 0
        case '5%':
            return 21
        default:
            return 11
    }
}

/**
 * Retorna el precio de un producto o servicio
 * @param {number} cantidad - Cantidad del producto
 * @param {number} precioUnitario - Precio unitario del producto
 * @returns {number} - El precio total
 */
const calcularPrecio = (cantidad, precioUnitario) => {
    cantidad = Number(cantidad)
    precioUnitario = Number(precioUnitario)
    if(isNaN(cantidad)) cantidad = 0
    if(isNaN(precioUnitario)) precioUnitario = 0
    return cantidad * precioUnitario
}

/**
 * Formatea un número con separadores de miles.
 * @param {number} num - El número a formatear.
 * @returns {string} - El número formateado con separadores de miles.
 */
function formatNumber(num) {
    return num.toLocaleString('es-ES'); // 'es-ES' para usar el formato de España, que usa puntos como separador de miles.
}

/**
 * Obtiene el total general
 * @param {Object[]} items - items de facturacion
 * @returns {number} - Total general
 */
function calcularTotalGeneral(items) {
    return items.reduce((total, item) => total + (Number(item.total) || 0), 0);
}

/**
 * Obtiene el total iva general
 * @param {Object[]} items - items de facturacion
 * @returns {number} - Total general
 */
function calcularTotalGeneralIva(items) {
    return items.reduce((total, item) => total + (Number(item.impuesto) || 0), 0);
}

module.exports = {
    calcularImpuesto
}