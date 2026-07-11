const ErrorApp = require("../error");

const CDC_LONGITUD = 44;

/**
 * Rellena un valor numérico con ceros a la izquierda hasta una longitud fija.
 * Lanza si el valor no es numérico o si excede la longitud (evita truncar datos).
 * @param {number|string} valor - Valor a formatear
 * @param {number} longitud - Longitud final exigida
 * @param {string} campo - Nombre del campo (para el mensaje de error)
 * @returns {string} - Valor formateado con ceros a la izquierda
 */
const rellenarNumerico = (valor, longitud, campo) => {
  const texto = String(valor ?? "");
  if (!/^\d+$/.test(texto)) {
    throw new ErrorApp(`Campo ${campo} invalido: debe ser numerico`, 400);
  }
  if (texto.length > longitud) {
    throw new ErrorApp(`Campo ${campo} invalido: excede ${longitud} digitos`, 400);
  }
  return texto.padStart(longitud, "0");
};

/**
 * Formatea una fecha como YYYYMMDD (formato exigido por SIFEN para el CDC).
 * Usa los getters locales (getFullYear/getMonth/getDate), no UTC: si se construye la
 * fecha con `new Date('YYYY-MM-DD')` (que Date interpreta como medianoche UTC), en un
 * servidor con timezone distinto a Paraguay el día puede correrse. El caller debe pasar
 * un Date cuyos campos locales ya reflejen el día calendario real de emisión.
 * @param {Date} fecha - Fecha de emisión del documento
 * @returns {string} - Fecha en formato YYYYMMDD
 */
const formatearFechaEmision = (fecha) => {
  if (!(fecha instanceof Date) || Number.isNaN(fecha.getTime())) {
    throw new ErrorApp("Campo fechaEmision invalido: debe ser una fecha valida", 400);
  }
  const anio = String(fecha.getFullYear()).padStart(4, "0");
  const mes = String(fecha.getMonth() + 1).padStart(2, "0");
  const dia = String(fecha.getDate()).padStart(2, "0");
  return `${anio}${mes}${dia}`;
};

/**
 * Calcula el dígito verificador Módulo 11 estándar SET/DGII: pesos cíclicos 2..11
 * de derecha a izquierda, resto = suma % 11, dv = resto > 1 ? 11 - resto : 0.
 * @param {string} cuerpo - Cadena de solo dígitos sobre la que se calcula el DV
 * @returns {number} - Dígito verificador (0-9)
 */
const calcularDigitoVerificador = (cuerpo) => {
  if (typeof cuerpo !== "string" || !/^\d+$/.test(cuerpo)) {
    throw new ErrorApp("No se puede calcular el digito verificador: el cuerpo debe ser solo digitos", 400);
  }

  let peso = 2;
  let suma = 0;
  for (let i = cuerpo.length - 1; i >= 0; i--) {
    suma += Number(cuerpo[i]) * peso;
    peso = peso === 11 ? 2 : peso + 1;
  }

  const resto = suma % 11;
  return resto > 1 ? 11 - resto : 0;
};

/**
 * Construye el CDC de 44 caracteres según el algoritmo de SIFEN (ver MIGRATION_PLAN.md §1.3):
 * tipoDocumento(2) + rucSinDv(8) + dvEmisor(1) + establecimiento(3) + punto(3) + numero(7)
 * + tipoContribuyente(1) + fechaEmision[YYYYMMDD](8) + tipoEmision(1) + codigoSeguridad(9)
 * + dígito verificador(1).
 * @param {Object} datos
 * @param {number|string} datos.tipoDocumento - Código de tipo de documento SIFEN (p. ej. 1=Factura, 5=Nota de Crédito)
 * @param {string} datos.rucSinDv - RUC del emisor sin dígito verificador
 * @param {number|string} datos.dvEmisor - Dígito verificador del RUC del emisor
 * @param {number|string} datos.establecimiento - Código de establecimiento
 * @param {number|string} datos.punto - Código de punto de expedición
 * @param {number|string} datos.numero - Número de documento
 * @param {number|string} datos.tipoContribuyente - 1=Física, 2=Jurídica
 * @param {Date} datos.fechaEmision - Fecha de emisión del documento
 * @param {number|string} datos.tipoEmision - 1=Normal, 2=Contingencia
 * @param {number|string} datos.codigoSeguridad - Código de seguridad de 9 dígitos (ya generado por facturaService)
 * @returns {string} - CDC de 44 caracteres, con dígito verificador incluido
 */
const construirCdc = ({
  tipoDocumento,
  rucSinDv,
  dvEmisor,
  establecimiento,
  punto,
  numero,
  tipoContribuyente,
  fechaEmision,
  tipoEmision,
  codigoSeguridad,
}) => {
  const cuerpo =
    rellenarNumerico(tipoDocumento, 2, "tipoDocumento") +
    rellenarNumerico(rucSinDv, 8, "rucSinDv") +
    rellenarNumerico(dvEmisor, 1, "dvEmisor") +
    rellenarNumerico(establecimiento, 3, "establecimiento") +
    rellenarNumerico(punto, 3, "punto") +
    rellenarNumerico(numero, 7, "numero") +
    rellenarNumerico(tipoContribuyente, 1, "tipoContribuyente") +
    formatearFechaEmision(fechaEmision) +
    rellenarNumerico(tipoEmision, 1, "tipoEmision") +
    rellenarNumerico(codigoSeguridad, 9, "codigoSeguridad");

  const cdc = cuerpo + calcularDigitoVerificador(cuerpo);

  if (cdc.length !== CDC_LONGITUD) {
    throw new ErrorApp(`CDC invalido: longitud ${cdc.length}, se esperaban ${CDC_LONGITUD}`, 500);
  }

  return cdc;
};

/**
 * Valida que un CDC tenga el formato correcto y que su dígito verificador sea consistente.
 * Pensada como red de verificación sobre el CDC que ya calcula `xmlgen` internamente,
 * no como único punto de cálculo.
 * @param {string} cdc - CDC a validar (44 dígitos)
 * @returns {boolean} - true si el formato y el dígito verificador son correctos
 */
const validarCdc = (cdc) => {
  if (typeof cdc !== "string" || !/^\d{44}$/.test(cdc)) {
    return false;
  }
  const cuerpo = cdc.slice(0, CDC_LONGITUD - 1);
  const dvInformado = Number(cdc[CDC_LONGITUD - 1]);
  return calcularDigitoVerificador(cuerpo) === dvInformado;
};

module.exports = {
  calcularDigitoVerificador,
  construirCdc,
  validarCdc,
};
