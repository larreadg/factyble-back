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
    return Math.round(calcularTotalItem(cantidad, precioUnitario) / iva)
}

/**
 * Máximo de decimales aceptados en la cantidad por ítem.
 * SIFEN limita el campo E711 (dCantProSer) a "N 1-10p(0-4)": hasta 4 decimales
 * (Manual Técnico v150, campo E711). No enviar más: el XSD lo rechaza.
 */
const CANTIDAD_MAX_DECIMALES = 4

/**
 * Valor máximo de cantidad admisible: columna Decimal(10,4) => 6 enteros + 4 decimales,
 * que coincide con el largo total máximo de SIFEN (10 dígitos).
 */
const CANTIDAD_MAX = 999999.9999

/**
 * Valida una cantidad de ítem: numérica, mayor a 0, sin exceder el máximo ni la
 * cantidad de decimales que acepta SIFEN. Usada por los validadores de rutas.
 * @param {number|string} value
 * @returns {boolean}
 */
const validarCantidad = (value) => {
    if (value === null || value === undefined || value === '') return false
    const n = Number(value)
    if (!Number.isFinite(n) || n <= 0 || n > CANTIDAD_MAX) return false
    const decimales = (String(value).split('.')[1] || '').length
    if (decimales > CANTIDAD_MAX_DECIMALES) return false
    return true
}

/**
 * Total bruto por ítem en guaraníes (moneda PYG, sin decimales). Se redondea a entero
 * igual que lo hace la librería xmlgen para PYG (pygDecimals=0), de modo que el total
 * almacenado/impreso coincida con el que envía SIFEN aunque la cantidad tenga decimales.
 * @param {number|string} cantidad
 * @param {number|string} precioUnitario
 * @returns {number} - Total por ítem redondeado a guaraní entero
 */
const calcularTotalItem = (cantidad, precioUnitario) => {
    return Math.round(calcularPrecio(cantidad, precioUnitario))
}

/**
 * Normaliza `cantidad` a número en un array de detalles leídos de la DB.
 * La columna es Decimal(10,4): Prisma la devuelve como Prisma.Decimal, que al serializarse
 * a JSON queda como string ("5"). Este mapeo la vuelve number ("5" -> 5, "5.34" -> 5.34) para
 * conservar el contrato histórico de los GET (cantidad siempre número), incluidas facturas viejas.
 * @param {Array<Object>} detalles
 * @returns {Array<Object>}
 */
const normalizarCantidadDetalles = (detalles) => {
    if (!Array.isArray(detalles)) return detalles
    return detalles.map((d) =>
        d && d.cantidad != null ? { ...d, cantidad: Number(d.cantidad) } : d
    )
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
    calcularImpuesto,
    calcularTotalItem,
    validarCantidad,
    normalizarCantidadDetalles,
    CANTIDAD_MAX_DECIMALES,
    CANTIDAD_MAX
}