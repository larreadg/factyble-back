const sifenClientService = require("./sifenClientService");
const certificadoService = require("./certificadoService");
const { calcularDigitoVerificador } = require("../../utils/sifen/cdc");

/**
 * Fallback del padrón local: consulta el RUC directamente contra el WS `siConsRUC` de SIFEN cuando
 * no está en `padron_ruc`. El padrón local sigue siendo el camino rápido (lectura de BD, sin red ni
 * certificado); esto solo corre cuando ese camino no tiene respuesta.
 *
 * Motivo: `padron_ruc` se importa en batch y a mano (no hay cron), así que un RUC dado de alta
 * después de la última importación no existe localmente. Antes de este fallback la emisión
 * fabricaba el registro con `estado: "ACTIVO"` asumido y el buscador devolvía un 404 duro.
 *
 * Los tres resultados posibles son deliberadamente distintos y el caller decide qué hacer con cada
 * uno (ver `emitirFactura` y `genericoService.getDatosByRuc`):
 *
 *   - `encontrado`    -> SIFEN conoce el RUC y devolvió sus datos. Es la autoridad: se usa tal cual.
 *   - `noExiste`      -> SIFEN afirma que el RUC no existe (0500). Es una respuesta positiva, no una
 *                        falla: habilita a rechazar la emisión.
 *   - `indeterminado` -> no pudimos saberlo (timeout, red caída, sin certificado activo, 0501, forma
 *                        de respuesta inesperada). NO es lo mismo que "no existe": el caller debe
 *                        degradar a su comportamiento previo (emitir sin comprobar), nunca rechazar.
 *
 * La distinción entre `noExiste` e `indeterminado` es la pieza central de este módulo. Colapsar las
 * dos en un booleano haría que una caída de SIFEN bloquee emisiones de RUCs perfectamente válidos.
 *
 * Códigos y valores sourceados del Manual Técnico SIFEN v150 (copia local
 * `Manual Técnico Versión 150.md`), §9.6 "WS consulta RUC – siConsRUC" y §12.3.5 — no adivinados,
 * misma regla que `utils/sifen/codigosRespuesta.js`. Verificados además contra el WS real de
 * producción: 0502 con un RUC existente, 0500 con RUCs inexistentes.
 */

// §12.3.5 (tabla BO01-BO03) y §9.6.
const COD_RUC_NO_EXISTE = "0500";
// "RUC no tiene permiso para utilizar el WS". Habla del RUC EMISOR (el del certificado con el que
// consultamos), no del consultado — es un problema de habilitación nuestro, así que es
// indeterminado, jamás "el RUC del receptor no existe".
const COD_RUC_SIN_PERMISO = "0501";
const COD_RUC_ENCONTRADO = "0502";

/**
 * `dCodEstCons` (ContRUC04) traducido al vocabulario textual que ya usa `padron_ruc.estado` en la
 * importación batch. Se traduce en vez de guardar el código de 3 letras para que la tabla no termine
 * con dos dialectos de estado y para que `bloqueaEmision()` siga funcionando sin tocarla: esa función
 * ya normaliza (mayúsculas, sin diacríticos) y su lista descalificante es CANCELADO / CANCELADO
 * DEFINITIVO / SUSPENSION TEMPORAL, que acá quedan cubiertas por CAN / CDE / SUS.
 *
 * SAD (Suspensión Administrativa) y BLQ (Bloqueado) NO bloquean: el manual (D206c/d, D101b, GET016b)
 * solo nombra a las otras tres, criterio ya documentado en `utils/sifen/estadoPadronRuc.js`.
 */
const ESTADO_POR_CODIGO = {
  ACT: "ACTIVO",
  SUS: "SUSPENSION TEMPORAL",
  SAD: "SUSPENSION ADMINISTRATIVA",
  BLQ: "BLOQUEADO",
  CAN: "CANCELADO",
  CDE: "CANCELADO DEFINITIVO",
};

// ContRUC02: `dRUCCons` es A 5-8. Una base fuera de ese rango hace que SIFEN ni siquiera conteste un
// `rResEnviConsRUC` — devuelve `rRetEnviDe` con 0160 "XML Mal Formado" (verificado con el RUC "1").
// Se corta antes de gastar la llamada.
const RUC_LONGITUD_MINIMA = 5;
const RUC_LONGITUD_MAXIMA = 8;
const CONSULTA_RUC_TIMEOUT_MS = 5_000;

const indeterminado = (motivo) => ({ encontrado: false, noExiste: false, indeterminado: true, motivo });

/**
 * La lib parsea el SOAP con xml2js sin `stripPrefix`, así que todas las claves llegan como
 * "ns2:xxx". Se quita el prefijo de namespace de forma recursiva para poder leerlas por nombre.
 * @param {*} valor
 * @returns {*}
 */
const sinPrefijos = (valor) => {
  if (Array.isArray(valor)) return valor.map(sinPrefijos);
  if (valor && typeof valor === "object") {
    return Object.keys(valor).reduce((acumulador, clave) => {
      acumulador[clave.replace(/^[^:]+:/, "")] = sinPrefijos(valor[clave]);
      return acumulador;
    }, {});
  }
  return valor;
};

/**
 * Consulta un RUC en SIFEN y lo devuelve con la misma forma que `buscarPorRuc` (padrón local), para
 * que el caller pueda usar cualquiera de las dos fuentes indistintamente.
 *
 * Nunca lanza: toda falla se traduce a `indeterminado`. Es a propósito — este es un fallback, y una
 * excepción escapándose haría que una caída de SIFEN rompa la emisión y la búsqueda de clientes, que
 * es exactamente lo que el padrón local está para evitar.
 *
 * No registra trazabilidad en `sifen_trazabilidad`: esa tabla exige `entidad_tipo`/`entidad_id` de un
 * documento, y acá todavía no hay documento (la consulta ocurre antes de crear la Factura). Queda la
 * línea `[consultaRucSifen]` como rastro, mismo criterio que `[receptorFallback]`.
 *
 * @param {Object} datos
 * @param {string} datos.ruc - RUC BASE, sin dígito verificador ni ceros a la izquierda
 * @param {number} datos.empresaId - Empresa cuyo certificado activo se usa para el mTLS de la consulta
 * @returns {Promise<{encontrado: boolean, noExiste: boolean, indeterminado: boolean, motivo?: string, registro?: {ruc: string, razonSocial: string, digitoVerificador: string, rucAnterior: null, estado: string}, esFacturadorElectronico?: boolean}>}
 */
const consultarRucEnSifen = async ({ ruc, empresaId }) => {
  const rucBase = String(ruc || "").trim();

  if (!/^\d+$/.test(rucBase) || rucBase.length < RUC_LONGITUD_MINIMA || rucBase.length > RUC_LONGITUD_MAXIMA) {
    const motivo = `RUC "${rucBase}" fuera del formato que acepta el WS (dRUCCons es A 5-8)`;
    console.log(`[consultaRucSifen] ${motivo} — no se consulta`);
    return indeterminado(motivo);
  }

  let certificado;
  try {
    certificado = await certificadoService.obtenerCertificadoActivo({ empresaId });
  } catch (error) {
    // Sin certificado activo (o vencido/revocado) no hay mTLS posible. La empresa tampoco podría
    // emitir, pero el buscador de clientes sí tiene que seguir funcionando, así que se degrada.
    const motivo = `sin certificado utilizable para la empresa ${empresaId}: ${error.message}`;
    console.log(`[consultaRucSifen] RUC ${rucBase} — ${motivo}`);
    return indeterminado(motivo);
  }

  let respuesta;
  try {
    respuesta = await sifenClientService.consultaRuc({
      id: Date.now(),
      ruc: rucBase,
      certificadoPath: certificado.archivo,
      certificadoPassword: certificado.clave,
      // Esta consulta es un fallback de padrón y no debe bloquear la UI ni la emisión durante los
      // 90 s del default de la librería. Una demora se traduce a `indeterminado` y el caller aplica
      // su política local.
      config: { timeout: CONSULTA_RUC_TIMEOUT_MS },
    });
  } catch (error) {
    // `sifenClientService` solo rechaza ante fallas de transporte/parseo (timeout, red, 5xx, HTML de
    // la página de logout del BIG-IP). Ninguna de esas dice nada sobre la existencia del RUC.
    const motivo = `falla de transporte consultando SIFEN: ${error.message}`;
    console.log(`[consultaRucSifen] RUC ${rucBase} — ${motivo}`);
    return indeterminado(motivo);
  }

  const cuerpo = (sinPrefijos(respuesta) || {}).rResEnviConsRUC;

  if (!cuerpo) {
    // Forma de respuesta inesperada — p. ej. el `rRetEnviDe` con 0160 "XML Mal Formado" que SIFEN
    // devuelve ante una entrada que no cumple el schema.
    const motivo = "respuesta de SIFEN sin nodo rResEnviConsRUC";
    console.log(`[consultaRucSifen] RUC ${rucBase} — ${motivo}: ${JSON.stringify(respuesta)}`);
    return indeterminado(motivo);
  }

  const codigo = cuerpo.dCodRes;

  if (codigo === COD_RUC_NO_EXISTE) {
    console.log(`[consultaRucSifen] RUC ${rucBase} — SIFEN responde ${codigo} "${cuerpo.dMsgRes}": no existe`);
    return { encontrado: false, noExiste: true, indeterminado: false };
  }

  if (codigo !== COD_RUC_ENCONTRADO) {
    // Incluye 0501 (sin permiso para usar el WS) y cualquier código no catalogado: no afirman nada
    // sobre el RUC consultado.
    const detallePermiso = codigo === COD_RUC_SIN_PERMISO ? " — el RUC emisor no está habilitado para usar siConsRUC" : "";
    const motivo = `código de respuesta ${codigo} ("${cuerpo.dMsgRes}")${detallePermiso}`;
    console.log(`[consultaRucSifen] RUC ${rucBase} — ${motivo}`);
    return indeterminado(motivo);
  }

  const contenido = cuerpo.xContRUC || {};
  const codigoEstado = String(contenido.dCodEstCons || "").trim().toUpperCase();
  const estado = ESTADO_POR_CODIGO[codigoEstado];

  if (!estado) {
    // Un dCodEstCons fuera de la tabla del manual no se adivina ni se asume ACTIVO: sin estado
    // confiable no se puede decidir si bloquea la emisión.
    const motivo = `dCodEstCons desconocido "${codigoEstado}" (no está en la tabla ContRUC04 del manual)`;
    console.log(`[consultaRucSifen] RUC ${rucBase} — ${motivo}`);
    return indeterminado(motivo);
  }

  // La razón social se normaliza a MAYÚSCULAS y se capea a 255 para quedar en el mismo formato que
  // los registros de la importación batch (padron_ruc.razon_social es VarChar(255)).
  const razonSocial = String(contenido.dRazCons || "").trim().toUpperCase().slice(0, 255);

  // El WS no devuelve el DV (la tabla ContRUC01-06 no tiene ningún dDVCons), así que se calcula por
  // Módulo 11 — mismo algoritmo SET que ya usa la emisión cuando el RUC no está en el padrón.
  const registro = {
    ruc: rucBase,
    razonSocial,
    digitoVerificador: String(calcularDigitoVerificador(rucBase)),
    rucAnterior: null,
    estado,
  };

  console.log(`[consultaRucSifen] RUC ${rucBase} — encontrado en SIFEN: "${razonSocial}" (${codigoEstado} -> ${estado})`);

  return {
    encontrado: true,
    noExiste: false,
    indeterminado: false,
    registro,
    esFacturadorElectronico: String(contenido.dRUCFactElec || "").trim().toUpperCase() === "S",
  };
};

module.exports = {
  consultarRucEnSifen,
};
