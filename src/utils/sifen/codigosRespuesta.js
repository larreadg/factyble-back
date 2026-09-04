/**
 * Mapa de interpretación de códigos de respuesta de negocio de SIFEN (`dCodRes`). Solo interpreta
 * códigos que llegaron dentro de una respuesta SOAP ya resuelta —
 * `sifenClientService` nunca rechaza la Promise ante un código de negocio, solo ante fallas de
 * transporte/parseo (timeout, red, 5xx, respuesta no-XML). Esas fallas de transporte NO pasan por
 * acá: `loteService`/`eventoService` las atrapan directamente (catch del `ErrorApp` que lanza
 * `sifenClientService`) y las tratan como reintentables sin necesidad de este mapa.
 *
 * NO INVENTAR CÓDIGOS — cada entrada de este mapa está sourceada, no adivinada:
 * - "0142": documentado desde el inicio del proyecto (motivo original de esta
 *   migración — certificado no asociado/vencido para el RUC emisor).
 * - "0260", "0300", "0301", "0360", "0361", "0362", "0363", "0420", "0421", "0422", "0600":
 *   confirmados contra el Manual Técnico SIFEN v150 oficial (DNIT), copia local
 *   `Manual Técnico Versión 150.md` — tabla maestra de códigos en §12.1.1/§12.2, y detalle por WS en
 *   §12.3.2.3 (`siRecepLoteDE`), §12.3.3.3 (`siResultLoteDE`/`consultaLote`), §12.3.4.3 (`siConsDE`,
 *   Tabla G en §9.4.2) y §12.3.6.3 (`siRecepEvento`).
 *
 * `0361` ("Lote en procesamiento") y `0362` ("Procesamiento de lote concluido") están catalogados en
 * el manual como códigos de validación del WS `siResultLoteDE` en sí (columna "E" = R/A), no como
 * aprobación/rechazo de negocio del lote — acá se re-mapean a INFORMATIVO/APROBADO respectivamente
 * porque es lo que representan funcionalmente para `consultarLotes()`: `0361` significa "todavía no
 * terminó, no es un resultado final" (mismo criterio que ya se usa para `0300`), y tratarlo como
 * RECHAZADO (el default de código no mapeado) hacía que `marcarLoteAgotado()` matara un lote que SIFEN
 * simplemente no había terminado de procesar todavía — bug real encontrado al hacer esta verificación.
 *
 * Para ampliar este mapa: consultar el Manual Técnico oficial (dnit.gov.py), nunca adivinar un
 * código nuevo.
 */

const CATEGORIA = {
  APROBADO: "APROBADO",
  RECHAZADO: "RECHAZADO",
  REINTENTABLE: "REINTENTABLE",
  // No es un resultado final por sí solo (p. ej. lote encolado, todavía sin resolver) — no dispara
  // ninguna transición de estado en el documento/lote, solo se persiste para trazabilidad.
  INFORMATIVO: "INFORMATIVO",
  // "CDC/DE duplicado" (1001/1002): SIFEN rechaza el ENVÍO, pero la propia descripción del manual dice
  // "Ya fue AUTORIZADO otro documento…" — o sea el documento YA EXISTE como DTE en SIFEN. No es un
  // rechazo de contenido: es la prueba de que reintentar el envío no corresponde. Debe disparar
  // reconciliación por CDC (que resolverá a APROBADO), nunca `marcarLoteAgotado` ni un RECHAZADO
  // terminal (ver la reconciliación por CDC en `loteService.js`).
  DUPLICADO: "DUPLICADO",
};

const CODIGOS_RESPUESTA = {
  "0142": {
    categoria: CATEGORIA.RECHAZADO,
    alertar: true,
    mensajeInterno:
      "Certificado no asociado o vencido para el RUC emisor — no reintentar tal cual, requiere " +
      "intervención manual (renovar o asociar el certificado correcto antes de reenviar).",
  },
  // Nivel documento (dentro de gResProcLoteDe de consultaLote, o de una consulta individual por CDC).
  "0260": {
    categoria: CATEGORIA.APROBADO,
    alertar: false,
    mensajeInterno: "Documento autorizado (aprobado) por SIFEN.",
  },
  // Nivel lote/sobre (respuesta de recibeLote).
  "0300": {
    categoria: CATEGORIA.INFORMATIVO,
    alertar: false,
    mensajeInterno:
      "Lote recibido con éxito por SIFEN, encolado para procesamiento asíncrono " +
      "(dProtConsLote disponible para consultarLote más adelante) — todavía no es un resultado final.",
  },
  "0301": {
    categoria: CATEGORIA.RECHAZADO,
    alertar: true,
    mensajeInterno:
      "Lote no encolado para procesamiento (rechazado a nivel de sobre/envoltorio, p. ej. ZIP o XML " +
      "malformado) — no reintentar el mismo envío tal cual, requiere revisar el error antes de reenviar.",
  },
  // Nivel sobre, respuesta de consultaLote (Manual §12.3.3.3, WS siResultLoteDE).
  "0360": {
    categoria: CATEGORIA.RECHAZADO,
    alertar: true,
    mensajeInterno:
      "Lote inexistente — el número de protocolo consultado no existe del lado de SIFEN (no debería " +
      "pasar en operación normal, revisar manualmente el Lote y su sifen_numero_lote).",
  },
  "0361": {
    // Ver nota arriba del archivo: no es un rechazo de negocio, es "SIFEN todavía no terminó de
    // procesar este lote" — mismo tratamiento que 0300 (no dispara ninguna transición final).
    categoria: CATEGORIA.INFORMATIVO,
    alertar: false,
    mensajeInterno: "Lote todavía en procesamiento por SIFEN — no es un resultado final, reintentar la consulta más adelante.",
  },
  "0362": {
    categoria: CATEGORIA.APROBADO,
    alertar: false,
    mensajeInterno:
      "Procesamiento del lote concluido por SIFEN (código de validación del WS, no de un documento en " +
      "particular — el resultado real de cada documento viene en gResProcLote).",
  },
  "0363": {
    categoria: CATEGORIA.RECHAZADO,
    alertar: true,
    mensajeInterno:
      "Lote con tipos distintos de documento electrónico — no debería poder pasar (loteService agrupa " +
      "por tipo_doc antes de armar el lote), si aparece es señal de un bug en el armado de lotes.",
  },
  // Nivel documento, respuesta de siConsDE (Manual §9.4.2 Tabla G / §12.3.4.3) — usado por
  // consultaIndividualRedDeSeguridad (consulta por CDC, no por lote).
  "0420": {
    categoria: CATEGORIA.RECHAZADO,
    alertar: true,
    mensajeInterno:
      "CDC inexistente en SIFEN — el documento no fue encontrado (solo los DE que superaron todas las " +
      "validaciones y se convirtieron en DTE quedan consultables por este WS).",
  },
  "0421": {
    categoria: CATEGORIA.RECHAZADO,
    alertar: true,
    mensajeInterno:
      "El RUC del certificado usado en la conexión no tiene permiso para consultar este DE — revisar " +
      "el certificado activo de la empresa antes de reintentar.",
  },
  "0422": {
    categoria: CATEGORIA.APROBADO,
    alertar: false,
    mensajeInterno: "CDC encontrado — el documento existe como DTE en SIFEN (fue aprobado).",
  },
  // Nivel documento, respuesta de siRecepEvento (Manual §9.5.3 / §12.3.6.3).
  "0600": {
    categoria: CATEGORIA.APROBADO,
    alertar: false,
    mensajeInterno: "Evento registrado correctamente por SIFEN (p. ej. cancelación aprobada).",
  },
  // Rechazos de la validación de eventos de cancelación (Manual §11.6.1, tabla "Reglas de validación
  // para cancelación" — todos marcados "R"). Confirmados contra la copia local `Manual Técnico Versión
  // 150.md` (líneas 6528-6554), no adivinados. Son terminales para el evento (la cancelación no se
  // registró), por eso RECHAZADO + alertar.
  "4000": {
    categoria: CATEGORIA.RECHAZADO,
    alertar: true,
    mensajeInterno: "Cancelación rechazada: la versión del formato del evento no corresponde a la vigente (GDE005).",
  },
  "4001": {
    categoria: CATEGORIA.RECHAZADO,
    alertar: true,
    mensajeInterno:
      "Cancelación rechazada: CDC inválido (GEC002) — no cumple la estructura de 44 caracteres " +
      "(longitud, orden de campos, fecha o dígito verificador).",
  },
  // El equivalente de 0420 pero en el WS de eventos: el CDC no está aprobado como DTE en SIFEN. Que
  // aparezca al cancelar es la señal de que el documento nunca existió realmente como DTE (aunque
  // localmente figurara APROBADO) — el caso que destapó el bug del DUPLICADO en `actualizarDocumentoPorResultado`.
  "4002": {
    categoria: CATEGORIA.RECHAZADO,
    alertar: true,
    mensajeInterno:
      "Cancelación rechazada: CDC no existente en SIFEN (GEC002a) — el documento no se encuentra " +
      "aprobado como DTE. Si localmente figuraba APROBADO, el estado estaba divergente: reconciliar por CDC.",
  },
  "4003": {
    categoria: CATEGORIA.RECHAZADO,
    alertar: true,
    mensajeInterno:
      "Cancelación rechazada: el DTE ya tiene registrado el mismo evento solicitado (GEC002b, duplicidad) " +
      "— la cancelación previa ya fue aceptada, no reintentar.",
  },
  "4004": {
    categoria: CATEGORIA.RECHAZADO,
    alertar: true,
    mensajeInterno:
      "Cancelación rechazada: el último evento del receptor sobre el CDC es una confirmación parcial o " +
      "total (GEC002c) — el emisor ya no puede cancelar.",
  },
  // Nivel documento — validaciones de contenido del DE (Manual Técnico SIFEN v150, tabla de códigos de
  // rechazo, entradas A002a/A002b). Confirmados contra la copia local `Manual Técnico Versión 150.md`
  // (líneas 7691-7694). El manual los marca como rechazo ("R"), PERO su descripción es "Ya fue
  // AUTORIZADO otro documento con coincidencia simultánea de los campos del CDC/Timbrado": el documento
  // ya existe como DTE en SIFEN. Por eso se mapean a DUPLICADO (no RECHAZADO): un envío que choca con
  // esto no debe matar el lote/documento, debe disparar reconciliación por CDC — que va a devolver
  // APROBADO, sincronizando el estado real en vez de reintentar un envío que siempre volverá a duplicar.
  "1001": {
    categoria: CATEGORIA.DUPLICADO,
    alertar: true,
    mensajeInterno:
      "CDC duplicado — SIFEN ya autorizó otro documento con el mismo CDC (el documento ya existe como " +
      "DTE). No reenviar: reconciliar por CDC para sincronizar el estado real (APROBADO).",
  },
  "1002": {
    categoria: CATEGORIA.DUPLICADO,
    alertar: true,
    mensajeInterno:
      "Documento electrónico duplicado — SIFEN ya autorizó otro documento con coincidencia de los " +
      "campos del timbrado (el documento ya existe como DTE). No reenviar: reconciliar por CDC.",
  },
  // Nivel documento — validación D202b. NO está en el cuerpo del MT v150 (que es de septiembre de
  // 2019): lo agregó la Nota Técnica N° 20 del 17/11/2023, vigente en producción desde el
  // 31/01/2024. Copia local: `NT_E_KUATIA_020_MT_V150.pdf`, y transcrito en el addendum B2G del
  // `Manual Técnico Versión 150.md`. Texto oficial: "Si el RUC del receptor (D206) corresponde a un
  // Organismo o Entidad del Estado (OEE), el tipo de operación debe ser B2G (D202=3)".
  //
  // Es un rechazo terminal —el documento hay que reemitirlo— pero además es la única señal
  // automática que tenemos de que un RUC es un OEE: ni el TXT del DNIT ni `siConsRUC` lo informan.
  // Por eso `loteService` lo usa para marcar `padron_ruc.es_oee` y que la próxima emisión al mismo
  // receptor salga bien sola.
  "1332": {
    categoria: CATEGORIA.RECHAZADO,
    alertar: true,
    mensajeInterno:
      "Tipo de operación incompatible con un Organismo o Entidad del Estado (D202b, NT 20) — el " +
      "receptor es un OEE y el DE debe informar B2G (iTiOpe=3). El RUC se marca automáticamente " +
      "como OEE en padron_ruc; hay que REEMITIR el documento, que saldrá corregido.",
  },
  // Grupo de Compras Públicas (E020-E029) y códigos DNCP por ítem (E704/E705). Confirmados contra la
  // copia local `Manual Técnico Versión 150.md`: validaciones 78/79/80 (líneas 8149-8155) y 129/130
  // (líneas 8532-8535), más la tabla maestra de rangos de códigos (líneas 7247 y 7298).
  //
  // Estos cinco están mapeados por precaución, no porque se hayan visto: los emite SIFEN si valida
  // de verdad el grupo de Compras Públicas de un DE B2G. Hoy ese grupo lo completa `xmlgen` con
  // valores por defecto (ver la nota en `xmlBuilderService`) y está PENDIENTE de confirmar contra
  // SIFEN que los acepte. A diferencia del 1332, ninguno de estos tiene camino de autocorrección:
  // si aparecen, TODA emisión B2G queda rota hasta cambiar código. Por eso llevan un mensajeInterno
  // que dice qué hacer, en vez de caer en el default de "código desconocido" que no orienta a nadie.
  "1400": {
    categoria: CATEGORIA.RECHAZADO,
    alertar: true,
    mensajeInterno:
      "Falta el grupo de Compras Públicas (E020 gCompPub), obligatorio para tipo de operación B2G " +
      "(D202=3). Significa que SIFEN SÍ valida ese grupo: no alcanza con emitir B2G a secas. Hay que " +
      "capturar los datos reales del contrato DNCP (modalidad/entidad/año/secuencia/fecha) y pasarlos " +
      "por `data.dncp` en xmlBuilderService. Afecta a TODAS las emisiones a organismos del Estado.",
  },
  "1401": {
    categoria: CATEGORIA.RECHAZADO,
    alertar: true,
    mensajeInterno:
      "Se informó el grupo de Compras Públicas (E020 gCompPub) en un documento que NO es B2G " +
      "(D202≠3) — solo se permite con D202=3. Indica que se está emitiendo gCompPub a un receptor " +
      "que no es un OEE: revisar por qué `cliente.es_oee` no coincide con el tipo de operación del DE.",
  },
  "1402": {
    categoria: CATEGORIA.RECHAZADO,
    alertar: true,
    mensajeInterno:
      "La fecha del código de contratación DNCP (E025 dFeCodCont) es posterior a la fecha de emisión " +
      "de la Factura. Con los valores por defecto de xmlgen esa fecha es `hoy - 30 días`, así que un " +
      "rechazo por acá apunta a un desfasaje de reloj/zona horaria, o a un documento emitido con " +
      "fecha retroactiva de más de 30 días.",
  },
  "1800": {
    categoria: CATEGORIA.RECHAZADO,
    alertar: true,
    mensajeInterno:
      "Falta el Código DNCP – Nivel General (E704 dDncpG) en algún ítem, obligatorio con D202=3. " +
      "Mismo diagnóstico y misma solución que el 1400, pero a nivel de ítem: los datos reales van en " +
      "`item.dncp.codigoNivelGeneral`.",
  },
  "1801": {
    categoria: CATEGORIA.RECHAZADO,
    alertar: true,
    mensajeInterno:
      "Se informó el Código DNCP – Nivel General (E704) sin el de Nivel Específico (E705 dDncpE), " +
      "que es obligatorio cuando existe el primero. Los datos reales van en " +
      "`item.dncp.codigoNivelEspecifico`.",
  },
};

/**
 * Interpreta un código de respuesta de SIFEN. Códigos desconocidos (no mapeados arriba) se tratan
 * como RECHAZADO — no REINTENTABLE — porque ya es una respuesta de negocio resuelta (no una falla de
 * transporte): reintentar el mismo documento sin cambios muy probablemente repite el mismo resultado.
 * Siempre se marca `alertar: true` para códigos desconocidos, para que un humano agregue el código a
 * este mapa consultando el Manual Técnico oficial (nunca inventarlo acá).
 * @param {string|number|null|undefined} codigo - Código crudo devuelto por SIFEN (`dCodRes`)
 * @returns {{codigo: string|null, conocido: boolean, categoria: string, alertar: boolean, mensajeInterno: string}}
 */
const interpretarCodigo = (codigo) => {
  const codigoNormalizado = codigo === null || codigo === undefined || codigo === "" ? null : String(codigo);
  const entrada = codigoNormalizado ? CODIGOS_RESPUESTA[codigoNormalizado] : undefined;

  if (entrada) {
    return { codigo: codigoNormalizado, conocido: true, ...entrada };
  }

  return {
    codigo: codigoNormalizado,
    conocido: false,
    categoria: CATEGORIA.RECHAZADO,
    alertar: true,
    mensajeInterno: codigoNormalizado
      ? `Código de respuesta SIFEN "${codigoNormalizado}" no está mapeado en codigosRespuesta.js — ` +
        "agregarlo consultando el Manual Técnico oficial antes de asumir su categoría."
      : "Respuesta de SIFEN sin código de resultado (dCodRes ausente) — revisar la respuesta cruda " +
        "persistida en SifenTrazabilidad para diagnosticar.",
  };
};

/**
 * Atajo para el caso más común: ¿este código representa un documento aprobado por SIFEN?
 * @param {string|number|null|undefined} codigo
 * @returns {boolean}
 */
const esAprobado = (codigo) => interpretarCodigo(codigo).categoria === CATEGORIA.APROBADO;

module.exports = {
  CATEGORIA,
  CODIGOS_RESPUESTA,
  interpretarCodigo,
  esAprobado,
};
