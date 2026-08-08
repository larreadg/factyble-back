const axios = require("axios");
const { AxiosError } = require("axios");
const ErrorApp = require("../utils/error");

// Servicio externo de consulta de RUC (ruc.com.py). Solo se usa como FALLBACK cuando el RUC no
// está en la tabla local `padron_ruc`; el padrón importado en batch sigue siendo la fuente primaria.
const URL_RUC_EXTERNO = process.env.URL_RUC_EXTERNO || "https://ruc.com.py/api/consulta-ruc";
const TIMEOUT_MS = parseInt(process.env.URL_RUC_EXTERNO_TIMEOUT_MS, 10) || 8000;

/**
 * Consulta un RUC contra el servicio externo ruc.com.py cuando no aparece en el padrón local.
 *
 * `termino` es la BASE del RUC (sin dígito verificador). El servicio hace una búsqueda por término
 * y puede devolver varias coincidencias parciales, por lo que se filtra por match EXACTO de la base
 * (normalizada igual que el padrón: sin ceros a la izquierda). El servicio devuelve el RUC como
 * "BASE-DV", que se descompone para poblar `digito_verificador` (misma autoridad de DV que el padrón).
 *
 * Devuelve `null` si no hay coincidencia exacta, si el registro no trae DV/razón social, o si el
 * servicio responde 404/sin data. Ante un fallo de red/timeout/5xx/429 lanza un `ErrorApp` 503 con
 * mensaje accionable (no se puede validar el DV contra una autoridad ⇒ se aborta la emisión).
 *
 * @param {string} rucBase - RUC sin dígito verificador ni ceros a la izquierda
 * @returns {Promise<{ruc: string, razonSocial: string, digitoVerificador: string, rucAnterior: null, estado: string}|null>}
 */
const consultarRucExterno = async (rucBase) => {
  try {
    const { data } = await axios({
      url: URL_RUC_EXTERNO,
      method: "GET",
      params: { termino: rucBase },
      timeout: TIMEOUT_MS,
    });

    const registros = data && Array.isArray(data.data) ? data.data : [];
    if (registros.length === 0) return null;

    // La búsqueda por término puede traer coincidencias parciales: nos quedamos con la fila cuya
    // BASE coincide exactamente con la consultada, no con la primera del array.
    const match = registros.find((r) => {
      const base = String(r.ruc || "").split("-")[0].replace(/^0+(?=\d)/, "");
      return base === rucBase;
    });

    if (!match) return null;

    const [baseRaw, dv] = String(match.ruc).split("-");

    // Sin DV no podemos poblar el padrón con la autoridad que exige la emisión (D206b/c/d).
    if (dv === undefined || dv === "") return null;

    // razon_social es NOT NULL en padron_ruc: un registro externo sin razón social está malformado,
    // lo tratamos como "no encontrado" en vez de persistir una fila vacía.
    if (!match.razon_social) return null;

    return {
      ruc: baseRaw.replace(/^0+(?=\d)/, ""),
      razonSocial: match.razon_social,
      digitoVerificador: dv,
      rucAnterior: null,
      // estado es NOT NULL en padron_ruc. Si el registro externo no lo trae, default a "ACTIVO"
      // (no bloqueante): evita reventar la emisión por un dato faltante; SIFEN revalida el estado real.
      estado: match.estado || "ACTIVO",
    };
  } catch (error) {
    if (error instanceof AxiosError && error.response && error.response.status === 404) {
      return null;
    }

    // Timeout, 5xx, rate-limit (429) o red caída: no podemos validar el DV contra una autoridad.
    // No devolvemos null (sería un "no existe en el padrón" engañoso); lanzamos un error claro 503
    // para que el caller aborte con un mensaje accionable en vez de un 500 opaco.
    throw new ErrorApp(
      "No se pudo validar el RUC contra el padrón externo. Reintentá en unos minutos.",
      503
    );
  }
};

module.exports = {
  consultarRucExterno,
};
