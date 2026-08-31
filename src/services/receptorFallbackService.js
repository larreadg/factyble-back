const { consultarCedula } = require("./cedulaService");

/**
 * Degradación automática de receptor CONTRIBUYENTE a NO_CONTRIBUYENTE por cédula.
 *
 * Contexto: un RUC en estado CANCELADO / CANCELADO DEFINITIVO / SUSPENSION TEMPORAL no puede
 * recibir un DE (ver `utils/sifen/estadoPadronRuc.js`, validaciones D206c/d del Manual Técnico
 * v150). En la práctica esto pasa casi siempre con personas físicas, cuyo RUC base ES su número de
 * cédula. En vez de bloquear la emisión, se emite la factura como consumidor final identificado por
 * CI: `iNatRec=2` / `iTiOpe=2` / `iTipIDRec=1`. SIFEN no valida el padrón de RUC en esa rama —
 * D206c/d sólo corren cuando el DE informa un RUC — así que el documento pasa sin observaciones.
 *
 * Consecuencia (decisión de producto, tomada a sabiendas): el receptor NO puede usar esa factura
 * como crédito fiscal IVA ni como gasto deducible, y eso no se corrige con una Nota de Crédito (la
 * NC no cambia la naturaleza del receptor) — habría que cancelar el DE y re-emitir. Por eso cada
 * degradación se loguea: es el único rastro para soporte de por qué una factura pedida con RUC
 * salió a nombre de una cédula.
 */

// Prefijo que la SET asigna a los RUC de personas jurídicas (80xxxxxx). El fallback sólo aplica a
// personas físicas, así que un RUC con este prefijo se descarta antes de salir a la red: una
// sociedad con el RUC cancelado no tiene cédula a la cual degradar, y así se evita además el riesgo
// (remoto, pero irreversible) de que un RUC de empresa matchee por casualidad como número de cédula
// y termine emitido como `dNumIDRec`. Si el prefijo no alcanza, la consulta al registro de
// identificaciones es la segunda barrera: sin cédula real no hay degradación.
const PREFIJO_RUC_PERSONA_JURIDICA = "80";

const esRucPersonaJuridica = (rucBase) => String(rucBase || "").startsWith(PREFIJO_RUC_PERSONA_JURIDICA);

/**
 * Normaliza la respuesta del servicio de cédulas (URL_CI) al shape que consumen los callers.
 * Tolera que el servicio devuelva el registro suelto o dentro de un array: `consultarCedula` ya
 * trata `[]` como "no existe", pero un array de un elemento llegaría acá como objeto sin
 * `cedula_identidad` y produciría un receptor vacío que SIFEN rechaza.
 * @param {Object|Array|null} data - Respuesta cruda de `consultarCedula`
 * @returns {{documento: string, nombres: string, apellidos: string, razonSocial: string}|null}
 */
const normalizarDatosCedula = (data) => {
  const registro = Array.isArray(data) ? data[0] : data;

  if (!registro || !registro.cedula_identidad) {
    return null;
  }

  const nombres = String(registro.nombres || "").trim();
  const apellidos = String(registro.apellidos || "").trim();
  // Mismo formato "APELLIDOS, NOMBRES" que ya persiste genericoService para receptores por cédula.
  const razonSocial = apellidos && nombres ? `${apellidos}, ${nombres}` : apellidos || nombres;

  if (!razonSocial) {
    return null;
  }

  return {
    documento: String(registro.cedula_identidad).trim(),
    nombres,
    apellidos,
    razonSocial,
  };
};

/**
 * Resuelve los datos del receptor por cédula para un RUC bloqueado por su estado en el padrón.
 *
 * Devuelve `null` cuando la degradación NO aplica y el caller debe mantener el rechazo original:
 * RUC de persona jurídica, cédula inexistente en el registro, o servicio de cédulas caído. Este
 * último caso se traga deliberadamente: si URL_CI no responde, el caller debe seguir devolviendo el
 * 400 claro sobre el estado del RUC y no un 500 de infraestructura sobre un servicio que el usuario
 * no pidió consultar.
 *
 * @param {string} rucBase - RUC sin DV ni ceros a la izquierda (para persona física == su cédula)
 * @param {string} estado - Estado del padrón que bloqueó la emisión, sólo para el log
 * @returns {Promise<{documento: string, nombres: string, apellidos: string, razonSocial: string}|null>}
 */
const resolverReceptorPorCedula = async (rucBase, estado) => {
  if (esRucPersonaJuridica(rucBase)) {
    return null;
  }

  let data;

  try {
    data = await consultarCedula(rucBase);
  } catch (error) {
    console.log(`[receptorFallback] No se pudo consultar la cédula ${rucBase} (RUC en estado "${estado}"):`, error.message);
    return null;
  }

  const receptor = normalizarDatosCedula(data);

  if (!receptor) {
    return null;
  }

  console.log(
    `[receptorFallback] RUC ${rucBase} en estado "${estado}": se emite como NO_CONTRIBUYENTE con CI ${receptor.documento} (${receptor.razonSocial})`
  );

  return receptor;
};

module.exports = {
  PREFIJO_RUC_PERSONA_JURIDICA,
  esRucPersonaJuridica,
  normalizarDatosCedula,
  resolverReceptorPorCedula,
};
