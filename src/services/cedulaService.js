const axios = require("axios");
const { AxiosError } = require("axios");
const ErrorApp = require("../utils/error");

/**
 * Techo de espera de la consulta al registro de identificaciones. Mismo criterio y mismo valor que
 * `CONSULTA_RUC_TIMEOUT_MS` en `sifen/sifenClientService.js`: esta consulta cuelga de los mismos dos
 * requests sincrónicos del usuario (el buscador de clientes y la emisión desde caja) y corre
 * inmediatamente después de aquella, así que sin tope el recorte hecho del lado de SIFEN no sirve
 * de nada — la caja quedaría colgada acá en vez de allá.
 *
 * El default de axios es `0`, es decir SIN timeout: antes de esto, un URL_CI que aceptara la
 * conexión y no contestara dejaba el request esperando indefinidamente. Tuneable con `TIMEOUT_CI`.
 */
const TIMEOUT_CI_MS = Number(process.env.TIMEOUT_CI) || 5000;

/**
 * Consulta la existencia de una cédula de identidad paraguaya contra el servicio externo
 * (registro de identificaciones) configurado por URL_CI/USER_CI/PW_CI. Devuelve `null` si la
 * cédula no existe — confirmado ad-hoc contra el servicio real: para una cédula inexistente
 * responde 200 con un array vacío (`[]`), no un 404, así que no alcanza con chequear el status
 * HTTP ni la verdad/falsedad de `data` (`[]` es truthy en JS). Cualquier otro error (red, 5xx,
 * credenciales inválidas) se propaga tal cual para que el caller decida cómo tratarlo.
 *
 * Única excepción a "se propaga tal cual": el timeout se traduce a un `ErrorApp` 504 con mensaje
 * legible. Un `AxiosError` de timeout no trae `response`, así que `handleServiceError` lo
 * convertiría en un 500 con el texto crudo "timeout of 5000ms exceeded" — inservible para quien
 * está en la caja. Esto NO cambia el camino de la degradación por RUC bloqueado:
 * `receptorFallbackService` atrapa cualquier throw de acá y devuelve `null`, manteniendo intacto
 * el 400 original sobre el estado del RUC.
 *
 * Agotar el tiempo nunca significa "la cédula no existe": eso es `null`, y solo lo produce una
 * respuesta efectiva del servicio.
 * @param {string} cedula
 * @returns {Promise<Object|null>}
 */
const consultarCedula = async (cedula) => {
  try {
    const { data } = await axios({
      url: process.env.URL_CI,
      params: { cedula },
      auth: {
        username: process.env.USER_CI,
        password: process.env.PW_CI,
      },
      timeout: TIMEOUT_CI_MS,
    });

    if (!data || (Array.isArray(data) && data.length === 0)) {
      return null;
    }

    return data;
  } catch (error) {
    if (error instanceof AxiosError && error.response && error.response.status === 404) {
      return null;
    }

    // `ECONNABORTED` es el código con el que axios aborta por `timeout`; `ETIMEDOUT` es el del
    // sistema operativo cuando el TCP muere antes. Ninguno dice nada sobre la existencia de la
    // cédula — traducirlos a `null` sería afirmar que no existe.
    if (error instanceof AxiosError && (error.code === "ECONNABORTED" || error.code === "ETIMEDOUT")) {
      throw new ErrorApp(
        `El registro de identificaciones no respondió en ${TIMEOUT_CI_MS} ms al consultar la cédula ${cedula}. Reintentá en unos minutos.`,
        504
      );
    }

    throw error;
  }
};

module.exports = {
  consultarCedula,
};
