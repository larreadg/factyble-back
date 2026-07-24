const axios = require("axios");
const { AxiosError } = require("axios");

/**
 * Consulta la existencia de una cédula de identidad paraguaya contra el servicio externo
 * (registro de identificaciones) configurado por URL_CI/USER_CI/PW_CI. Devuelve `null` si la
 * cédula no existe — confirmado ad-hoc contra el servicio real: para una cédula inexistente
 * responde 200 con un array vacío (`[]`), no un 404, así que no alcanza con chequear el status
 * HTTP ni la verdad/falsedad de `data` (`[]` es truthy en JS). Cualquier otro error (red, 5xx,
 * credenciales inválidas) se propaga tal cual para que el caller decida cómo tratarlo.
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
    });

    if (!data || (Array.isArray(data) && data.length === 0)) {
      return null;
    }

    return data;
  } catch (error) {
    if (error instanceof AxiosError && error.response && error.response.status === 404) {
      return null;
    }

    throw error;
  }
};

module.exports = {
  consultarCedula,
};
