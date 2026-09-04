const { v4: uuidv4 } = require("uuid");
const prisma = require("../../prisma/cliente");
const ErrorApp = require("../../utils/error");
const xmlBuilderService = require("./xmlBuilderService");
const firmadorService = require("./firmadorService");
const qrService = require("./qrService");
const certificadoService = require("./certificadoService");
const sifenClientService = require("./sifenClientService");
const trazabilidadService = require("./trazabilidadService");
const correoService = require("../correoService");
const botService = require("../botService");
const telegramService = require("../telegramService");
const { marcarComoOee } = require("../oeeService");
const { interpretarCodigo, CATEGORIA } = require("../../utils/sifen/codigosRespuesta");
const {
  extraerCodigoYMensaje,
  extraerProtocoloLote,
  extraerResultadosPorDocumento,
  extraerCdc,
  extraerProtocoloAutorizacion,
} = require("../../utils/sifen/respuestaSoap");
const { decryptTolerante } = require("../../utils/crypto");
const { formatNumeroDocumento } = require("../../utils/format");

/**
 * Único camino de emisión de Factura/NotaCredito (Decisión cerrada) —
 * incluso un lote de 1 solo documento pasa por acá, no hay atajo síncrono para "urgente" (se eliminó
 * `setapi.recibe`, ver `sifenClientService.js`).
 *
 * Aislamiento de error por documento, por lote y por empresa en las 3 etapas (armado/firma, envío,
 * consulta) — corrige el antipatrón Q de `src/` (v2), donde solo 2 de los 3 servicios de lote
 * aislaban errores: una excepción en un documento/lote/empresa nunca debe abortar el resto del batch.
 *
 * Máquina de estados (`EstadoSifen`): GENERADO -> FIRMADO -> ENCOLADO (asignado a un Lote) -> ENVIADO
 * (SIFEN aceptó el lote) -> APROBADO | RECHAZADO | ERROR (definitivo, tras `consultarLotes` o la red
 * de seguridad por CDC).
 *
 * Los campos exactos de la respuesta SOAP de `consultaLote` (namespace, anidamiento) están confirmados
 * contra un round-trip real de producción (spike #3 resuelto — ver `utils/sifen/respuestaSoap.js`): el
 * nodo por-documento es `gResProcLote` (no `gResProcLoteDe`), el código/mensaje de sobre son
 * `dCodResLot`/`dMsgResLot` (distintos de `dCodRes`/`dMsgRes`, que a ese nivel son del documento
 * anidado), el CDC viene en `id` y el protocolo de autorización en `dProtAut`. La extracción de campos
 * acá usa búsqueda por sufijo de nombre de tag (robusta a variaciones de namespace) y está aislada en
 * funciones puntuales en `respuestaSoap.js`.
 */

const LOTE_MAX_DOCUMENTOS = 50;

const BACKOFF_BASE_SEGUNDOS = Number(process.env.SIFEN_LOTE_BACKOFF_BASE_SEGUNDOS) || 60;
const BACKOFF_CAP_SEGUNDOS = Number(process.env.SIFEN_LOTE_BACKOFF_CAP_SEGUNDOS) || 3600;
// `MAX_INTENTOS_ENVIO` ya NO condena el lote a ERROR (ver `MAX_HORAS_ENVIO`): pasó a ser solo el umbral
// del aviso temprano one-shot — al cruzarlo (≈5h de fallas de transporte sostenidas) se alerta UNA vez
// que SIFEN lleva rato inalcanzable, sin marcar ERROR.
const MAX_INTENTOS_ENVIO = Number(process.env.SIFEN_LOTE_MAX_INTENTOS) || 10;

// Presupuesto de TIEMPO (no de conteo) para reintentar el ENVÍO de un lote ante fallas de transporte
// sostenidas (SIFEN caído/inalcanzable). Antes se condenaba por conteo (`MAX_INTENTOS_ENVIO`=10), lo que
// mataba los lotes a las ~5h y generaba ERROR masivo + reenvío manual tras una caída larga (p. ej. un
// fin de semana entero). Ahora se reintenta con backoff (cap 1h) hasta este límite; recién pasado eso se
// marca ERROR para intervención manual. 96h (4 días) es un techo realista para una caída de SIFEN, muy
// por debajo del plazo de transmisión de 720h (que sigue siendo el deadline duro para que el documento
// sea reenviable, ver `PLAZO_TRANSMISION_HORAS`). Se mide desde `Lote.fecha_creacion` (cuándo se empezó
// a intentar enviar este lote).
const MAX_HORAS_ENVIO = Number(process.env.SIFEN_LOTE_MAX_HORAS_ENVIO) || 96;
const RED_SEGURIDAD_UMBRAL_MINUTOS = Number(process.env.SIFEN_RED_SEGURIDAD_UMBRAL_MINUTOS) || 120;

// Límite de "transmisión extemporánea" del Manual Técnico SIFEN v150 §6.2: pasadas 720h (30 días)
// desde la fecha de emisión real del documento, SIFEN rechaza el envío sin excepción — no tiene
// sentido intentar un reenvío manual más allá de este punto, el número queda inevitablemente
// "quemado" y requiere inutilización (no implementada) + un documento nuevo.
const PLAZO_TRANSMISION_HORAS = Number(process.env.SIFEN_PLAZO_TRANSMISION_HORAS) || 720;

// Tope de reintentos de firma (`firmarPendientes()`) — sin esto, un documento que nunca lograba
// firmarse (certificado vencido, datos fiscales incompletos, bug de armado de XML) reintentaba cada 5
// min para siempre, sin escalar nunca a `ERROR` ni alertar a nadie. A diferencia del ENVÍO (que ahora
// se condena por TIEMPO, `MAX_HORAS_ENVIO`, porque un fallo de transporte es transitorio — SIFEN caído),
// la firma se condena por CONTEO: es un cómputo local, no una llamada a SIFEN, así que un fallo
// persistente es un problema de datos/certificado que no se resuelve reintentando. Seguro escalar a
// `ERROR` acá: el documento todavía no se le envió nada a SIFEN, así que un reintento posterior vía
// `reintentarEnvioDocumento()` nunca arriesga un duplicado.
const FIRMA_MAX_INTENTOS = Number(process.env.SIFEN_FIRMA_MAX_INTENTOS) || 10;

// Config por tipo de documento: parametriza toda la lógica de armado/envío/consulta, que es
// idéntica entre Factura y NotaCredito salvo el modelo Prisma y el builder de XML a usar (mismo
// patrón de paralelismo que ya tiene xmlBuilderService entre construirXmlFactura/construirXmlNotaCredito).
const TIPOS_DOCUMENTO = {
  FACTURA: {
    entidadTipo: "FACTURA",
    // Acepta un cliente Prisma explícito (la `tx` del caller, ver `firmarDocumentoRecienCreado`) —
    // default `prisma` para todos los call sites del cron, que no corren dentro de una transacción.
    modelo: (client = prisma) => client.factura,
    construirXml: xmlBuilderService.construirXmlFactura,
    include: {
      detalles: true,
      usuario: true,
      cliente_empresa: { include: { cliente: true } },
      caja: { include: { establecimiento: { include: { empresa: { include: { establecimientos: true } } } } } },
    },
    obtenerContactos: (documento) => ({
      cliente: documento.cliente_empresa.cliente,
      empresa: documento.caja.establecimiento.empresa,
      usuarioEmail: documento.usuario ? documento.usuario.email : null,
    }),
    // Nombre de la columna del secuencial, para poder pedirlo por `select` sin traerse la fila entera
    // (`xml_firmado` pesa) al armar el aviso de aprobados por lote — `numeroDocumento` de abajo
    // sigue siendo el accessor que usa el resto del módulo.
    campoNumero: "numero_factura",
    numeroDocumento: (documento) => documento.numero_factura,
    notificarAprobado: async (documento, { cliente, empresa }) =>
      correoService.enviarFactura({
        cdc: documento.cdc,
        cliente: cliente.tipo_identificacion === "RUC" ? cliente.razon_social : `${cliente.nombres} ${cliente.apellidos}`,
        email: cliente.email,
        uuid: documento.factura_uuid,
        nroFactura: documento.numero_factura,
        empresa: empresa.nombre_empresa,
        emailEmpresa: empresa.email,
        xmlFirmado: documento.xml_firmado,
      }),
    notificarRechazado: async (documento, { empresa, usuarioEmail }, mensaje) =>
      correoService.enviarErrorFactura({
        email: usuarioEmail,
        empresa: empresa.nombre_empresa,
        errorFactura: mensaje,
        nroFactura: documento.numero_factura,
      }),
  },
  NOTA_CREDITO: {
    entidadTipo: "NOTA_CREDITO",
    modelo: (client = prisma) => client.notaCredito,
    construirXml: xmlBuilderService.construirXmlNotaCredito,
    include: {
      nota_credito_detalle: true,
      usuario: true,
      factura: { include: { cliente_empresa: { include: { cliente: true } } } },
      caja: { include: { establecimiento: { include: { empresa: { include: { establecimientos: true } } } } } },
    },
    obtenerContactos: (documento) => ({
      cliente: documento.factura.cliente_empresa.cliente,
      empresa: documento.caja.establecimiento.empresa,
      usuarioEmail: documento.usuario ? documento.usuario.email : null,
    }),
    // Nombre de la columna del secuencial, para poder pedirlo por `select` sin traerse la fila entera
    // (`xml_firmado` pesa) al armar el aviso de aprobados por lote — `numeroDocumento` de abajo
    // sigue siendo el accessor que usa el resto del módulo.
    campoNumero: "numero_nota_credito",
    numeroDocumento: (documento) => documento.numero_nota_credito,
    notificarAprobado: async (documento, { cliente, empresa }) =>
      correoService.enviarNotaDeCredito({
        cdc: documento.cdc,
        cliente: cliente.tipo_identificacion === "RUC" ? cliente.razon_social : `${cliente.nombres} ${cliente.apellidos}`,
        email: cliente.email,
        uuid: documento.nota_credito_uuid,
        nroNotaDeCredito: documento.numero_nota_credito,
        empresa: empresa.nombre_empresa,
        emailEmpresa: empresa.email,
        xmlFirmado: documento.xml_firmado,
      }),
    notificarRechazado: async (documento, { empresa, usuarioEmail }, mensaje) =>
      correoService.enviarErrorNotaDeCredito({
        email: usuarioEmail,
        empresa: empresa.nombre_empresa,
        errorNotaDeCredito: mensaje,
        nroNotaDeCredito: documento.numero_nota_credito,
      }),
  },
};

const generarDId = () => Date.now();

const calcularBackoffSegundos = (intentos) => Math.min(BACKOFF_BASE_SEGUNDOS * 2 ** intentos, BACKOFF_CAP_SEGUNDOS);

// Mismo criterio ya usado en `notificarAprobado` de arriba (RUC -> razón social, resto -> nombre y
// apellido) — reutilizado acá para armar el mensaje de alerta a Telegram (`telegramService.js`).
const formatearCliente = (cliente) => ({
  nombre: cliente.tipo_identificacion === "RUC" ? cliente.razon_social : `${cliente.nombres} ${cliente.apellidos}`,
  documento: cliente.tipo_identificacion === "RUC" ? cliente.ruc : cliente.documento,
});

/**
 * Firma un documento (Factura o NotaCredito) pendiente y persiste `xml_firmado` + `estado_sifen`
 * `FIRMADO` en una sola escritura (atómico por construcción — evita el antipatrón P de `src/`, donde
 * el XML quedaba firmado sin fila consistente en la BD). Si falla en cualquier paso, el documento
 * queda tal cual estaba (sin `xml_firmado`, `estado_sifen` sin cambios) y el próximo `armarLotes()`
 * (cron cada 5 min) lo vuelve a tomar — no hay campos de reintento a nivel de documento individual en
 * el schema (esos existen recién en `Lote`/`EventoSifen`, ver §2.2), a propósito: reintentar
 * indefinidamente el armado es seguro (es un cómputo local, no una llamada a SIFEN).
 * @param {"FACTURA"|"NOTA_CREDITO"} tipoDoc
 * @param {Object} documento - Factura o NotaCredito de Prisma, con el include de `TIPOS_DOCUMENTO[tipoDoc]` ya cargado
 * @param {Object} [client] - Cliente Prisma a usar para la escritura final (la `tx` del caller si se
 *   quiere que la firma participe de una transacción más amplia — ver `firmarDocumentoRecienCreado` —
 *   o `prisma` por default, usado por `firmarPendientes()` en el cron)
 * @returns {Promise<Object>} - El documento actualizado (con `xml_firmado`, `linkqr`, `estado_sifen: "FIRMADO"`)
 */
const firmarYPersistirDocumento = async (tipoDoc, documento, client = prisma) => {
  const config = TIPOS_DOCUMENTO[tipoDoc];
  let xmlSinFirmar = null;
  let xmlConQr = null;
  try {
    if (!documento.caja) {
      throw new ErrorApp(`${tipoDoc} id=${documento.id} no tiene caja asignada, no se puede firmar`, 400);
    }
    const empresa = documento.caja.establecimiento.empresa;
    const certificado = await certificadoService.obtenerCertificadoActivo({ empresaId: empresa.id });
    xmlSinFirmar = await config.construirXml(documento);
    const xmlFirmado = await firmadorService.firmarXmlDocumento({
      xml: xmlSinFirmar,
      certificadoPath: certificado.archivo,
      certificadoPassword: certificado.clave,
    });
    // Empresa.csc: lectura tolerante (AUD-006, STATIC_AUDIT_FINDINGS.json) — hoy no existe ningún
    // endpoint/CRUD que escriba este campo (confirmado: no hay `empresaRoute`/`certificadoRoute` en
    // `src/routes/`, el alta es manual/ad-hoc, igual que el resto de la carga de datos fiscales), así
    // que las filas existentes están en texto plano. `decryptTolerante` descifra si el valor fue
    // cifrado con `utils/crypto.js#encrypt` (formato esperado), y si no, lo devuelve tal cual — sin
    // esto, forzar `decrypt()` habría roto el único camino real por el que se carga `Empresa.csc` hoy.
    const resultadoQr = await qrService.generarQr({ xmlFirmado, idCSC: empresa.csc_id, csc: decryptTolerante(empresa.csc) });
    xmlConQr = resultadoQr.xmlConQr;

    // `linkqr` sigue siendo la misma columna que ya alimentaba `generarPdf.js`/el mail — no es un
    // campo legacy congelado (a diferencia de `xml`/`sifen_estado`):
    // solo cambia quién la calcula (ver docstring de `qrService.generarQr`).
    const documentoActualizado = await config.modelo(client).update({
      where: { id: documento.id },
      data: {
        xml_firmado: xmlConQr,
        linkqr: resultadoQr.linkQr,
        estado_sifen: "FIRMADO",
        fecha_firma: new Date(),
        intentos_firma: 0,
      },
    });

    await trazabilidadService.registrarInteraccion({
      entidadTipo: config.entidadTipo,
      entidadId: documento.id,
      operacion: "FIRMA",
      request: xmlSinFirmar,
      response: xmlConQr,
      exitoso: true,
    });

    return documentoActualizado;
  } catch (error) {
    await trazabilidadService.registrarInteraccion({
      entidadTipo: config.entidadTipo,
      entidadId: documento.id,
      operacion: "FIRMA",
      request: xmlSinFirmar,
      response: null,
      exitoso: false,
    });
    throw error;
  }
};

/**
 * Firma y persiste, sincrónicamente, un documento recién creado por `facturaService`/
 * `notaDeCreditoService` (Fase 5) — a diferencia de `firmarPendientes()`
 * (que corre en el cron cada 5 min sobre cualquier `GENERADO` suelto), este camino firma en el mismo
 * momento de la emisión, replicando el comportamiento que ya tenía la API PHP legacy (`data.php`
 * firmaba sincrónico, solo el envío a SIFEN era asíncrono por lote). Pensado para invocarse con la
 * `tx` de la transacción de creación del caller: si
 * la firma falla (certificado vencido/ausente, datos fiscales incompletos de la empresa), toda la
 * transacción se revierte junto con la numeración recién asignada — no queda un número de documento
 * "quemado" por un problema de configuración detectable en el momento (mismo criterio atómico que ya
 * tenía `emitirFactura`/`emitirNotaDeCredito` contra la API PHP legacy).
 * @param {"FACTURA"|"NOTA_CREDITO"} tipoDoc
 * @param {number} documentoId
 * @param {Object} [client] - Cliente Prisma (la `tx` del caller, o `prisma` por default)
 * @returns {Promise<Object>} - El documento actualizado (con `xml_firmado`, `linkqr`, `estado_sifen: "FIRMADO"`)
 */
const firmarDocumentoRecienCreado = async (tipoDoc, documentoId, client = prisma) => {
  const config = TIPOS_DOCUMENTO[tipoDoc];
  const documento = await config.modelo(client).findFirst({
    where: { id: documentoId },
    include: config.include,
  });
  return firmarYPersistirDocumento(tipoDoc, documento, client);
};

/**
 * Reintenta manualmente el envío a SIFEN de un documento que quedó en `ERROR` (agotó los reintentos
 * automáticos de `enviarLotesConstruidos()`/`marcarLoteAgotado()` — ver docstring de esa función) o en
 * `RECHAZADO`.
 *
 * También acepta `RECHAZADO` (ampliado respecto al alcance original de "solo ERROR"): en la práctica no
 * todo RECHAZADO es un rechazo de negocio genuino sobre el contenido del documento. `interpretarCodigo()`
 * (`codigosRespuesta.js`) clasifica como RECHAZADO por default cualquier código que no esté mapeado
 * explícitamente como APROBADO/REINTENTABLE/INFORMATIVO — y una caída/inestabilidad del motor de
 * validaciones de SIFEN puede devolver un código no documentado (p. ej. "Error Inesperado en
 * validaciones... No se pudo evaluar" en vez del texto real de rechazo de la regla) que cae en ese
 * default sin ser en realidad un rechazo de contenido. Reintentar el mismo documento (mismo CDC, mismos
 * datos) es seguro en ese caso porque SIFEN nunca llegó a resolver la validación. Sigue siendo una acción
 * manual gateada a ADMIN: si el RECHAZADO fue un rechazo de negocio real (dato inválido, p. ej. código
 * 0142/0301/0420/0421), reintentar sin cambios va a repetir el mismo resultado — el operador que dispara
 * el reintento es quien debe leer `sifen_estado_mensaje`/la trazabilidad y juzgar si tiene sentido antes
 * de usarlo.
 *
 * Resetea a `estado_sifen: GENERADO` (no reutiliza el `xml_firmado` existente) para que el próximo
 * `firmarPendientes()` del cron reconstruya y refirme el documento desde cero. Dos motivos:
 * 1) Refresca `fecha_firma`, uno de los dos relojes del plazo de transmisión de SIFEN (Manual Técnico
 *    v150 §6.2: hasta 72h desde la firma para transmisión "normal") — reenviar el XML ya firmado hace
 *    tiempo arriesga que SIFEN lo considere fuera de ese plazo aunque el reintento sea inmediato.
 * 2) Si el motivo original del error era un bug de armado de XML ya corregido en `xmlBuilderService`,
 *    el reintento lo incorpora en vez de reenviar los mismos bytes rotos.
 * El CDC y el número de documento NUNCA cambian (`construirCdc` no se vuelve a invocar: `factura.cdc`/
 * `notaCredito.cdc` ya están fijos desde la creación) — esto reintenta el mismo documento/mismo
 * número, nunca uno nuevo.
 *
 * **Antes de reenviar, consulta a SIFEN por CDC** (`reconciliarPorCdc`) — corrige el bug raíz de esta
 * función (reconciliación por CDC): la premisa vieja era "un documento que no llegó
 * a APROBADO nunca fue consumido por SIFEN, así que reusar el CDC es seguro", pero un documento pudo
 * quedar en ERROR/RECHAZADO en nuestra base por una consulta de lote fallida/ambigua (p. ej.
 * `dCodResLot` ausente) aunque SIFEN lo haya aprobado. Reenviar el mismo CDC en ese caso choca con
 * "CDC duplicado" (1001) indefinidamente. Según lo que responda la consulta por CDC:
 * - APROBADO: `reconciliarPorCdc` ya sincronizó `estado_sifen = APROBADO` — NO se reenvía nada, se
 *   devuelve el documento ya corregido (el problema del operador queda resuelto).
 * - INEXISTENTE (0420): SIFEN confirma que no lo tiene — seguro reenviar el mismo CDC (sigue el reset).
 * - INDETERMINADO / falla de la consulta: no se puede verificar — se aborta el reintento (reenviar sin
 *   confirmar arriesga un duplicado), el operador reintenta más tarde.
 *
 * Rechaza el reintento si ya pasaron más de `SIFEN_PLAZO_TRANSMISION_HORAS` (default 720h/30 días —
 * el límite de "transmisión extemporánea" del Manual Técnico) desde `fecha_creacion` (la fecha de
 * emisión real, el otro reloj del plazo, que NO se puede refrescar): pasado ese punto SIFEN rechaza el
 * envío sin importar qué se haga, y el único camino real es inutilizar el número (no implementado acá)
 * y emitir un documento nuevo.
 * @param {"FACTURA"|"NOTA_CREDITO"} tipoDoc
 * @param {number} documentoId
 * @param {number} empresaId - Scoping multi-tenant: solo se puede reintentar un documento de la propia empresa
 * @returns {Promise<Object>} - El documento reseteado a `GENERADO`
 */
const reintentarEnvioDocumento = async (tipoDoc, documentoId, empresaId) => {
  const config = TIPOS_DOCUMENTO[tipoDoc];
  const documento = await config.modelo().findFirst({
    where: { id: documentoId },
    include: config.include,
  });

  if (!documento) {
    throw new ErrorApp(`${tipoDoc} no encontrada`, 404);
  }

  const { empresa } = config.obtenerContactos(documento);
  if (empresa.id !== empresaId) {
    throw new ErrorApp(`${tipoDoc} no encontrada`, 404);
  }

  if (documento.estado_sifen !== "ERROR" && documento.estado_sifen !== "RECHAZADO") {
    throw new ErrorApp(
      `Solo se puede reintentar un documento en estado ERROR o RECHAZADO (actual: ${documento.estado_sifen || "sin estado SIFEN"})`,
      400
    );
  }

  const horasDesdeEmision = (Date.now() - documento.fecha_creacion.getTime()) / (1000 * 60 * 60);
  if (horasDesdeEmision > PLAZO_TRANSMISION_HORAS) {
    throw new ErrorApp(
      `No se puede reintentar: pasaron ${Math.floor(horasDesdeEmision)}h desde la emisión, supera el ` +
        `plazo de transmisión de SIFEN (${PLAZO_TRANSMISION_HORAS}h) — este número ya no es reenviable, ` +
        "requiere inutilizarlo ante SIFEN y emitir un documento nuevo.",
      409
    );
  }

  // Fuente de verdad antes de reenviar: ¿SIFEN ya tiene este CDC? (ver docstring). Solo un documento
  // que SIFEN confirma como inexistente (0420) es seguro de reenviar sin arriesgar un "CDC duplicado".
  let reconciliacion;
  try {
    reconciliacion = await reconciliarPorCdc(tipoDoc, documento);
  } catch (error) {
    throw new ErrorApp(
      `No se pudo verificar el estado del ${tipoDoc} en SIFEN antes de reenviar (${error.message}). ` +
        "Reintente más tarde: reenviar sin verificar arriesga un documento duplicado.",
      503
    );
  }

  if (reconciliacion === "APROBADO") {
    // SIFEN ya lo tenía autorizado — `reconciliarPorCdc` ya sincronizó `estado_sifen = APROBADO` y
    // notificó. No se reenvía nada: se devuelve el documento ya corregido.
    console.log(`[loteService] Reintento manual: ${tipoDoc} id=${documento.id} (empresa=${empresaId}) ya estaba APROBADO en SIFEN — se sincronizó el estado, no se reenvía.`);
    return config.modelo().findFirst({ where: { id: documento.id }, include: config.include });
  }

  if (reconciliacion === "INDETERMINADO") {
    throw new ErrorApp(
      `No se pudo determinar el estado del ${tipoDoc} en SIFEN (respuesta no concluyente). ` +
        "Reintente más tarde: reenviar sin confirmar que SIFEN no lo tiene arriesga un documento duplicado.",
      409
    );
  }

  // reconciliacion === "INEXISTENTE": SIFEN confirma que no tiene el CDC — seguro reenviar el mismo
  // documento/CDC. Se resetea a GENERADO para que el cron lo refirme y reencole.
  const documentoActualizado = await config.modelo().update({
    where: { id: documento.id },
    data: {
      estado_sifen: "GENERADO",
      lote_id: null,
      sifen_cod_respuesta: null,
      sifen_estado_mensaje: null,
      sifen_num_transaccion: null,
      fecha_respuesta_sifen: null,
      // Reseteo defensivo: este documento ya pasó por FIRMADO/ENCOLADO alguna vez (llegó a ERROR
      // después de eso), así que intentos_firma debería estar en 0 — pero si por algún motivo no lo
      // está, un reintento manual siempre debe arrancar con el presupuesto completo de intentos.
      intentos_firma: 0,
    },
  });

  // No pasa por trazabilidadService: acá todavía no hubo ningún request/response real contra SIFEN
  // (eso lo va a generar el próximo firmarPendientes()/enviarLotesConstruidos() del cron, que ya
  // registran su propia trazabilidad) — esto es solo el reseteo local de estado que dispara ese reintento.
  console.log(`[loteService] Reintento manual: ${tipoDoc} id=${documento.id} (empresa=${empresaId}) ERROR -> GENERADO`);

  return documentoActualizado;
};

// Código de la validación D202b: "El tipo de operación no compatible para un Organismo o Entidad del
// Estado" (Nota Técnica N° 20, vigente en producción desde el 31/01/2024). Ver codigosRespuesta.js.
const CODIGO_RECHAZO_OEE = "1332";

/**
 * Marca al receptor como Organismo o Entidad del Estado cuando SIFEN rechaza el documento con 1332.
 *
 * Por qué acá y no a mano: ninguna fuente de datos nos dice qué RUC es un OEE. El TXT del DNIT trae
 * cinco campos y no incluye eso; `siConsRUC` devuelve ContRUC01-06 y tampoco; el open data de la
 * DNCP identifica a sus entidades con un código interno, nunca con el RUC. El catálogo sembrado
 * (`data/oeeRucs.json`) cubre lo conocido, pero necesariamente se queda corto con cualquier
 * organismo nuevo. Un 1332 es SIFEN afirmando la condición de OEE con autoridad — el mismo tipo de
 * hecho que el `estado` que ya cacheamos desde `siConsRUC`, no una inferencia nuestra.
 *
 * Se marcan DOS lugares y los dos hacen falta:
 *   - `padron_ruc`: para que cualquier emisión futura, de cualquier empresa, resuelva bien.
 *   - `cliente`: porque el reintento (`reintentarDocumento`) re-firma ESTE documento sin volver a
 *     pasar por `emitirFactura`, y el XML se arma leyendo `cliente.es_oee`. Sin esto, reemitir
 *     produciría exactamente el mismo rechazo.
 *
 * Aislada en su propio try/catch, como el resto de los efectos secundarios de este módulo: un fallo
 * marcando no debe impedir que el rechazo se persista, se notifique por mail ni se alerte.
 *
 * @param {"FACTURA"|"NOTA_CREDITO"} tipoDoc
 * @param {number} documentoId
 * @param {string|null} codigo - Código ya interpretado (`interpretacion.codigo`)
 */
const marcarReceptorComoOee = async (tipoDoc, documentoId, codigo) => {
  if (String(codigo) !== CODIGO_RECHAZO_OEE) {
    return;
  }

  try {
    const config = TIPOS_DOCUMENTO[tipoDoc];
    const documento = await config.modelo().findFirst({ where: { id: documentoId }, include: config.include });
    if (!documento) {
      return;
    }

    const { cliente } = config.obtenerContactos(documento);

    // Solo un receptor CONTRIBUYENTE puede ser un OEE, y el filtro no es teórico: para un receptor
    // degradado a cédula `cliente.ruc` es el número de CI desnudo, que para una persona física ES
    // una clave válida de `padron_ruc`. Sin este guard, un 1332 sobre semejante documento marcaría
    // como Organismo del Estado el RUC de una persona, en una tabla compartida por TODAS las
    // empresas, y a partir de ahí cada factura de contribuyente a esa persona saldría B2G. El mismo
    // recaudo tiene el UPDATE de la migración (`AND c.situacion_tributaria = 'CONTRIBUYENTE'`).
    // En la práctica SIFEN no debería emitir 1332 sobre un DE sin RUC —D202b se dispara por D206—,
    // pero el costo de equivocarse es contaminar el padrón para todos, así que no se confía en eso.
    if (cliente.situacion_tributaria !== "CONTRIBUYENTE" || cliente.tipo_identificacion === "INNOMINADO") {
      console.log(
        `[loteService] ${tipoDoc} id=${documentoId} rechazado con 1332 pero su receptor no es ` +
          `CONTRIBUYENTE (${cliente.situacion_tributaria}/${cliente.tipo_identificacion}): no se marca nada.`
      );
      return;
    }

    // Misma normalización a BASE que usan emitirFactura y getDatosByRuc: el padrón guarda el RUC sin
    // DV ni ceros a la izquierda, mientras que `cliente.ruc` puede venir como "80005190-4".
    const rucBase = String(cliente.ruc || "").split("-")[0].replace(/^0+(?=\d)/, "");
    if (!rucBase) {
      return;
    }

    const marcadoEnPadron = await marcarComoOee(rucBase);
    await prisma.cliente.updateMany({
      where: { id: cliente.id, OR: [{ es_oee: null }, { es_oee: false }] },
      data: { es_oee: true },
    });

    console.log(
      `[loteService] SIFEN rechazó ${tipoDoc} id=${documentoId} con 1332: el RUC ${rucBase} ` +
        `("${cliente.razon_social}") es un Organismo o Entidad del Estado. Marcado en cliente id=${cliente.id}` +
        `${marcadoEnPadron ? " y en padron_ruc" : " (en padron_ruc ya estaba marcado o el RUC no está en el padrón)"}. ` +
        `Reemitir el documento: saldrá como B2G.`
    );
  } catch (error) {
    console.error(`[loteService] Error al marcar el receptor de ${tipoDoc} id=${documentoId} como OEE tras un 1332:`, error.message);
  }
};

/**
 * Envía la notificación por correo (aprobación o rechazo) del resultado final de SIFEN para un
 * documento — reemplaza la lógica que antes vivía en `facturaService#checkFacturaStatus` (eliminado
 * en Fase 5), generalizada a Factura y NotaCredito vía `TIPOS_DOCUMENTO[tipoDoc].notificarAprobado`/
 * `notificarRechazado`. Aislado con su propio try/catch — un fallo de envío de correo (SMTP caído,
 * plantilla rota) no debe interrumpir la sincronización de estado SIFEN del resto del lote/consulta
 * (mismo espíritu que el antipatrón Q, ya aplicado en el resto de este módulo).
 * @param {"FACTURA"|"NOTA_CREDITO"} tipoDoc
 * @param {number} documentoId
 * @param {"APROBADO"|"RECHAZADO"} nuevoEstado
 * @param {string} [mensaje] - Mensaje de SIFEN (o el interno de `codigosRespuesta.js`), para el mail de rechazo
 */
const notificarResultadoDocumento = async (tipoDoc, documentoId, nuevoEstado, mensaje) => {
  const config = TIPOS_DOCUMENTO[tipoDoc];
  let documento = null;
  let contactos = null;
  try {
    documento = await config.modelo().findFirst({ where: { id: documentoId }, include: config.include });
    if (!documento) {
      return;
    }
    contactos = config.obtenerContactos(documento);
    if (nuevoEstado === "APROBADO") {
      await config.notificarAprobado(documento, contactos);
    } else if (nuevoEstado === "RECHAZADO") {
      await config.notificarRechazado(documento, contactos, mensaje);
    }
  } catch (error) {
    console.error(`[loteService] Error al notificar resultado de ${tipoDoc} id=${documentoId}:`, error.message);
    // Si `contactos` no llegó a resolverse (findFirst/obtenerContactos fallaron, no el envío de mail en
    // sí), los bloques de bot/Telegram de abajo no se van a ejecutar (dependen de `contactos`) — sin
    // este aviso, un RECHAZADO/APROBADO real quedaría sin ninguna alerta (ni mail, ni bot, ni Telegram).
    if (!contactos) {
      try {
        await telegramService.notificarFallaSistemica({
          titulo: `No se pudo procesar el resultado de ${tipoDoc} id=${documentoId}`,
          detalle: `Estado nuevo: ${nuevoEstado}. Error al obtener el documento/sus contactos: ${error.message}`,
        });
      } catch (errorTelegram) {
        console.error(`[loteService] Error al notificar a Telegram la falla de notificarResultadoDocumento para ${tipoDoc} id=${documentoId}:`, errorTelegram.message);
      }
    }
  }

  // Documentos originados en el bot (WhatsApp) se reenvían al bot con el resultado final de SIFEN,
  // para que le avise al cliente final — aislado de la notificación por correo de arriba (un fallo acá
  // no debe impedir que ya se haya mandado, o se intente mandar, el mail; y viceversa).
  if (documento && documento.fuente === "BOT" && contactos) {
    try {
      await botService.bulkUpdateDocumentos([
        {
          empresaId: contactos.empresa.id,
          cdc: documento.cdc,
          estadoSifen: nuevoEstado,
          sifenEstadoMensaje: nuevoEstado === "RECHAZADO" ? mensaje || null : null,
        },
      ]);
    } catch (error) {
      console.error(`[loteService] Error al reenviar al bot el resultado de ${tipoDoc} id=${documentoId}:`, error.message);
      try {
        await telegramService.notificarFallaSistemica({
          titulo: `No se pudo avisar al bot (WhatsApp) el resultado de ${tipoDoc} id=${documentoId}`,
          detalle: `CDC=${documento.cdc}, estado=${nuevoEstado}. El cliente final no recibió el aviso automático: ${error.message}`,
        });
      } catch (errorTelegram) {
        console.error(`[loteService] Error al notificar a Telegram la falla de reenvio al bot para ${tipoDoc} id=${documentoId}:`, errorTelegram.message);
      }
    }
  }

  // Alerta al admin por Telegram cuando SIFEN rechaza el documento (definitivo, ya no reintentable) —
  // aislado del resto: un fallo acá no debe impedir el mail ni el reenvío al bot de arriba, ni viceversa.
  if (documento && nuevoEstado === "RECHAZADO" && contactos) {
    try {
      const clienteFmt = formatearCliente(contactos.cliente);
      await telegramService.notificarDocumentoRechazado({
        tipoDoc,
        estado: "RECHAZADO",
        numeroDocumento: config.numeroDocumento(documento),
        cdc: documento.cdc,
        empresaNombre: contactos.empresa.nombre_empresa,
        clienteNombre: clienteFmt.nombre,
        clienteDocumento: clienteFmt.documento,
        motivo: mensaje || documento.sifen_estado_mensaje || "Sin detalle",
      });
    } catch (error) {
      console.error(`[loteService] Error al notificar a Telegram el rechazo de ${tipoDoc} id=${documentoId}:`, error.message);
    }
  }
};

/**
 * Escala un documento a `ERROR` tras agotar `FIRMA_MAX_INTENTOS` reintentos de firma — mismo estado
 * terminal y mismo criterio que `marcarLoteAgotado()`, pero para fallas *antes* de llegar a formar
 * parte de un `Lote` (el documento nunca se le envió a SIFEN, así que un reintento posterior vía
 * `reintentarEnvioDocumento()` es igual de seguro que para un lote agotado). Alerta por Telegram
 * reusando el mismo formato que el resto del módulo, aislada en su propio try/catch.
 * @param {"FACTURA"|"NOTA_CREDITO"} tipoDoc
 * @param {Object} documento - Con el `include` de `TIPOS_DOCUMENTO[tipoDoc]` ya cargado
 * @param {string} mensajeError
 */
const marcarFirmaAgotada = async (tipoDoc, documento, mensajeError) => {
  const config = TIPOS_DOCUMENTO[tipoDoc];

  try {
    const contactos = config.obtenerContactos(documento);
    const clienteFmt = formatearCliente(contactos.cliente);
    await telegramService.notificarDocumentoRechazado({
      tipoDoc,
      estado: "ERROR",
      numeroDocumento: config.numeroDocumento(documento),
      cdc: documento.cdc,
      empresaNombre: contactos.empresa.nombre_empresa,
      clienteNombre: clienteFmt.nombre,
      clienteDocumento: clienteFmt.documento,
      motivo: mensajeError,
    });
  } catch (error) {
    console.error(`[loteService] Error al notificar a Telegram el agotamiento de firma de ${tipoDoc} id=${documento.id}:`, error.message);
  }
};

/**
 * Firma todos los documentos pendientes (sin lote asignado, sin firmar todavía), aislado por
 * documento — un error en uno no afecta a los demás (antipatrón Q).
 *
 * Selecciona únicamente `estado_sifen = 'GENERADO'`, **nunca** `estado_sifen IS NULL` — a propósito.
 * `estado_sifen` es nullable y hoy vale `null` para el 100% de las Facturas/NotasCredito existentes
 * (tanto las históricas de antes de esta migración como cualquier factura nueva emitida por el flujo
 * legacy todavía vigente — `facturaService.js`/
 * `notaDeCreditoService.js` todavía no fueron reescritos para usar este pipeline, eso es Fase 5).
 * Solo el flujo de emisión nativo (todavía sin escribir) va a setear `estado_sifen = 'GENERADO'` al
 * crear el documento. Si acá se incluyera también `estado_sifen IS NULL`, `armarLotes()` intentaría
 * reprocesar cada Factura/NotaCredito legacy existente en la base en cada corrida — confirmado como
 * problema real en la verificación ad-hoc de este módulo (miles de filas legacy sin certificado
 * asociado, todas fallando pero sin abortar el resto — el aislamiento por documento funcionó, pero el
 * alcance de la query estaba mal).
 *
 * Tope de reintentos vía `intentos_firma` (`FIRMA_MAX_INTENTOS`): al agotarse, escala a `ERROR` +
 * alerta por Telegram (`marcarFirmaAgotada`) en vez de reintentar para siempre en silencio.
 * @returns {Promise<void>}
 */
const firmarPendientes = async () => {
  for (const tipoDoc of Object.keys(TIPOS_DOCUMENTO)) {
    const config = TIPOS_DOCUMENTO[tipoDoc];
    const pendientes = await config.modelo().findMany({
      where: { lote_id: null, estado_sifen: "GENERADO" },
      select: { id: true },
    });

    for (const { id } of pendientes) {
      // Claim atómico (AUD-009, STATIC_AUDIT_FINDINGS.json): si otra ejecución (cron solapado por una
      // corrida anterior más lenta que el intervalo, u otra instancia del proceso) ya reclamó este
      // documento entre el findMany de arriba y este punto, `count` da 0 y se descarta sin firmarlo de
      // nuevo — evita firmar/generar QR dos veces para el mismo documento.
      const claim = await config.modelo().updateMany({
        where: { id, estado_sifen: "GENERADO" },
        data: { estado_sifen: "FIRMANDO" },
      });
      if (claim.count === 0) {
        continue;
      }

      try {
        const documento = await config.modelo().findFirst({ where: { id }, include: config.include });
        await firmarYPersistirDocumento(tipoDoc, documento);
      } catch (error) {
        console.error(`[loteService] Error al firmar ${tipoDoc} id=${id}:`, error.message);

        const previo = await config.modelo().findFirst({ where: { id }, select: { intentos_firma: true } });
        const intentos = (previo?.intentos_firma || 0) + 1;

        if (intentos >= FIRMA_MAX_INTENTOS) {
          const documentoAgotado = await config.modelo().update({
            where: { id },
            data: { estado_sifen: "ERROR", intentos_firma: intentos, sifen_estado_mensaje: `Excedido el maximo de intentos de firma (${FIRMA_MAX_INTENTOS}): ${error.message}` },
            include: config.include,
          });
          await marcarFirmaAgotada(tipoDoc, documentoAgotado, `Excedido el maximo de intentos de firma (${FIRMA_MAX_INTENTOS}): ${error.message}`);
          continue;
        }

        // Libera el claim (FIRMANDO -> GENERADO) para que la próxima pasada del cron reintente —
        // reintentar el armado es seguro (cómputo local, no una llamada a SIFEN), mismo criterio ya
        // documentado en este módulo para el resto del pipeline.
        await config.modelo().updateMany({
          where: { id, estado_sifen: "FIRMANDO" },
          data: { estado_sifen: "GENERADO", intentos_firma: intentos },
        });
      }
    }
  }
};

/**
 * Agrupa los documentos ya firmados (sin lote asignado) por empresa, en chunks de hasta
 * `LOTE_MAX_DOCUMENTOS` (límite real de SIFEN, confirmado en el spike #1 — ver `sifenClientService.js`).
 * SIFEN exige lotes de un solo tipo de documento, pero como `TIPOS_DOCUMENTO` ya separa Factura de
 * NotaCredito en colecciones distintas, cada grupo resultante ya es homogéneo por construcción.
 * @param {Object[]} documentos - Documentos firmados de un mismo tipo, con `caja.establecimiento.empresa_id` cargado
 * @returns {Map<number, Object[][]>} - empresa_id -> lista de chunks (cada chunk, hasta 50 documentos)
 */
const agruparPorEmpresaEnChunks = (documentos) => {
  const porEmpresa = new Map();
  for (const documento of documentos) {
    const empresaId = documento.caja.establecimiento.empresa_id;
    if (!porEmpresa.has(empresaId)) {
      porEmpresa.set(empresaId, []);
    }
    porEmpresa.get(empresaId).push(documento);
  }

  const resultado = new Map();
  for (const [empresaId, docs] of porEmpresa.entries()) {
    const chunks = [];
    for (let i = 0; i < docs.length; i += LOTE_MAX_DOCUMENTOS) {
      chunks.push(docs.slice(i, i + LOTE_MAX_DOCUMENTOS));
    }
    resultado.set(empresaId, chunks);
  }
  return resultado;
};

/**
 * Crea un `Lote` y asigna los documentos que lo componen en una única transacción — evita que un
 * crash a mitad de camino deje documentos "fantasma" (firmados, marcados como parte de un lote que
 * nunca se creó, o viceversa; mismo espíritu que el antipatrón I de `v1`).
 * @param {"FACTURA"|"NOTA_CREDITO"} tipoDoc
 * @param {number} empresaId
 * @param {Object[]} documentos - Chunk de hasta 50 documentos firmados de la misma empresa
 * @returns {Promise<Object>} - Lote creado
 */
const crearLoteConDocumentos = async (tipoDoc, empresaId, documentos) => {
  const config = TIPOS_DOCUMENTO[tipoDoc];
  const idsDocumentos = documentos.map((d) => d.id);

  return prisma.$transaction(async (tx) => {
    const lote = await tx.lote.create({
      data: {
        empresa_id: empresaId,
        secuencia: uuidv4(),
        tipo_doc: tipoDoc,
        estado: "CONSTRUIDO",
      },
    });

    // `lote_id: null` en el where (AUD-009, STATIC_AUDIT_FINDINGS.json): sin esto, un documento que
    // otra ejecución concurrente ya asignó a otro lote entre el findMany de `armarLotes()` y esta
    // transacción quedaba "robado" en silencio (este updateMany lo reasignaba igual, sin chequear que
    // siguiera libre). Con el filtro, el documento ya tomado por otro lote no matchea y se descarta
    // solo — el `count` resultante puede terminar siendo menor a `idsDocumentos.length` si eso pasó.
    const modeloTx = tipoDoc === "FACTURA" ? tx.factura : tx.notaCredito;
    const asignados = await modeloTx.updateMany({
      where: { id: { in: idsDocumentos }, lote_id: null },
      data: { lote_id: lote.id, estado_sifen: "ENCOLADO" },
    });

    if (asignados.count !== idsDocumentos.length) {
      console.warn(
        `[loteService] crearLoteConDocumentos: lote ${lote.id} esperaba ${idsDocumentos.length} documentos disponibles, solo se reclamaron ${asignados.count} — posible solapamiento de cron/otra instancia.`
      );
    }

    return lote;
  });
};

/**
 * Arma lotes nuevos a partir de los documentos pendientes: firma lo que falte firmar, y agrupa lo ya
 * firmado (de cualquier corrida anterior que haya fallado en el paso de agrupar) en lotes de hasta 50
 * documentos por empresa. Aislado por empresa — una empresa con datos fiscales incompletos (ver
 * `xmlBuilderService#construirParamsEmpresa`) o sin certificado activo no bloquea el armado de lotes
 * de otras empresas.
 * @returns {Promise<Object[]>} - Lotes creados en esta corrida
 */
const armarLotes = async () => {
  await firmarPendientes();

  const lotesCreados = [];
  for (const tipoDoc of Object.keys(TIPOS_DOCUMENTO)) {
    const config = TIPOS_DOCUMENTO[tipoDoc];
    const firmados = await config.modelo().findMany({
      where: { lote_id: null, estado_sifen: "FIRMADO" },
      include: { caja: { include: { establecimiento: { select: { empresa_id: true } } } } },
    });

    const chunksPorEmpresa = agruparPorEmpresaEnChunks(firmados);
    for (const [empresaId, chunks] of chunksPorEmpresa.entries()) {
      for (const chunk of chunks) {
        try {
          const lote = await crearLoteConDocumentos(tipoDoc, empresaId, chunk);
          lotesCreados.push(lote);
        } catch (error) {
          console.error(`[loteService] Error al crear lote de ${tipoDoc} para empresa=${empresaId}:`, error.message);
        }
      }
    }
  }
  return lotesCreados;
};

/**
 * Marca un lote como agotado (excedió el máximo de reintentos, o SIFEN rechazó el sobre de forma
 * definitiva): sus documentos pasan a `ERROR` — requieren intervención manual, ya no se van a
 * reintentar automáticamente. El propio `Lote` pasa a `estado: AGOTADO` (estado terminal explícito,
 * agregado junto con `ENVIANDO` para cerrar AUD-003 en STATIC_AUDIT_FINDINGS.json) — antes de esto,
 * `Lote.estado` nunca salía de `CONSTRUIDO` tras un rechazo/agotamiento, y como `proximo_intento_en`
 * quedaba en `null`, el lote volvía a matchear el `where` de `enviarLotesConstruidos()` en la
 * siguiente pasada del cron y se reenviaba a SIFEN indefinidamente — bug real encontrado al
 * implementar el claim atómico, no solo el escenario de solapamiento originalmente reportado.
 * @param {Object} lote
 * @param {string} mensajeError
 */
const marcarLoteAgotado = async (lote, mensajeError) => {
  const config = TIPOS_DOCUMENTO[lote.tipo_doc];
  const modelo = config.modelo();
  const whereAfectados = { lote_id: lote.id, estado_sifen: { notIn: ["APROBADO", "RECHAZADO"] } };

  // Se lee antes del updateMany porque este último no devuelve las filas afectadas, y las necesitamos
  // (con el include completo) para armar la alerta a Telegram de abajo.
  const afectados = await modelo.findMany({ where: whereAfectados, include: config.include });

  await modelo.updateMany({ where: whereAfectados, data: { estado_sifen: "ERROR", sifen_estado_mensaje: mensajeError } });
  await prisma.lote.update({
    where: { id: lote.id },
    data: { estado: "AGOTADO", ultimo_error: mensajeError, proximo_intento_en: null },
  });

  // ERROR es un problema interno de Factyble (lote agotado por reintentos o rechazo de sobre), no un
  // resultado de negocio que le incumba al cliente final — a diferencia de RECHAZADO, acá deliberadamente
  // NO se reenvía a `botService` (WhatsApp del cliente). Solo se alerta al admin por Telegram, aislado
  // por documento (un fallo de Telegram para uno no debe impedir el aviso de los demás).
  for (const documento of afectados) {
    try {
      const contactos = config.obtenerContactos(documento);
      const clienteFmt = formatearCliente(contactos.cliente);
      await telegramService.notificarDocumentoRechazado({
        tipoDoc: lote.tipo_doc,
        estado: "ERROR",
        numeroDocumento: config.numeroDocumento(documento),
        cdc: documento.cdc,
        empresaNombre: contactos.empresa.nombre_empresa,
        clienteNombre: clienteFmt.nombre,
        clienteDocumento: clienteFmt.documento,
        motivo: mensajeError,
      });
    } catch (error) {
      console.error(`[loteService] Error al notificar a Telegram el agotamiento del lote ${lote.id} (documento id=${documento.id}):`, error.message);
    }
  }
};

/**
 * Registra un intento de envío fallido de un lote (falla de transporte al enviar, o SIFEN inalcanzable
 * al reconciliar antes de reenviar) y decide el próximo paso — compartido por ambos caminos:
 * - Si el lote lleva más de `MAX_HORAS_ENVIO` intentando (desde `fecha_creacion`), lo agota a ERROR
 *   (intervención manual) — 96h/4 días es un techo realista de caída de SIFEN.
 * - Si no, reprograma con backoff (cap 1h) para reintentar, y dispara el aviso temprano one-shot por
 *   Telegram al cruzar `MAX_INTENTOS_ENVIO` (≈5h) — sin condenar.
 * NO registra trazabilidad: cada caller registra la suya (ENVIO_LOTE en el envío; `reconciliarPorCdc`
 * ya registra CONSULTA_DOCUMENTO en la reconciliación).
 * @param {Object} lote
 * @param {string} mensajeError
 */
const registrarFalloEnvio = async (lote, mensajeError) => {
  const intentos = lote.intentos_envio + 1;

  const horasIntentandoEnviar = (Date.now() - lote.fecha_creacion.getTime()) / (1000 * 60 * 60);
  if (horasIntentandoEnviar > MAX_HORAS_ENVIO) {
    await marcarLoteAgotado(
      lote,
      `El envío a SIFEN falló de forma sostenida por más de ${MAX_HORAS_ENVIO}h ` +
        `(${Math.floor(horasIntentandoEnviar)}h, ${intentos} intentos): ${mensajeError}`
    );
    return;
  }

  // Aviso temprano one-shot: al cruzar `MAX_INTENTOS_ENVIO` (≈5h de fallas) se alerta UNA sola vez que
  // SIFEN lleva rato inalcanzable, sin condenar el lote — para que ops lo vea bastante antes del corte
  // de `MAX_HORAS_ENVIO`. Aislado en su propio try/catch (un fallo de Telegram no debe cortar el
  // reintento). Se dispara con `===` para que ocurra exactamente una vez, no en cada intento posterior.
  if (intentos === MAX_INTENTOS_ENVIO) {
    try {
      await telegramService.notificarFallaSistemica({
        titulo: `Envío a SIFEN fallando de forma sostenida (lote ${lote.id})`,
        detalle:
          `El lote lleva ${intentos} intentos de envío fallidos (SIFEN inalcanzable/timeout). Se sigue ` +
          `reintentando cada ~1h hasta ${MAX_HORAS_ENVIO}h desde su creación; pasado eso se marca ERROR ` +
          `para intervención manual. Último error: ${mensajeError}`,
      });
    } catch (errorTelegram) {
      console.error(`[loteService] Error al notificar a Telegram el envío sostenido fallido del lote ${lote.id}:`, errorTelegram.message);
    }
  }

  // Libera el claim (ENVIANDO -> CONSTRUIDO) para que la próxima pasada del cron, una vez cumplido el
  // backoff, pueda volver a tomar y reintentar este lote.
  await prisma.lote.update({
    where: { id: lote.id },
    data: {
      estado: "CONSTRUIDO",
      intentos_envio: { increment: 1 },
      proximo_intento_en: new Date(Date.now() + calcularBackoffSegundos(intentos) * 1000),
      ultimo_error: mensajeError,
    },
  });
};

/**
 * Reconciliación por CDC previa a un RE-envío (Opción B).
 * Un fallo de transporte en un envío previo es ambiguo — SIFEN pudo haber recibido el lote y perderse
 * la respuesta —, así que reenviar a ciegas arriesga un "CDC duplicado". Antes de reenviar, se consulta
 * cada documento del lote por CDC (`reconciliarPorCdc`, que sincroniza a APROBADO los que SIFEN ya
 * tiene) y se particiona:
 * - `porEnviar`: SIFEN confirma que NO los tiene (0420) — es seguro reenviarlos.
 * - `aprobados`: SIFEN ya los tiene autorizados — no se reenvían (ya quedaron en APROBADO).
 * - `indeterminados`: la consulta no fue concluyente — no es seguro reenviar todavía.
 * Propaga cualquier error de transporte (SIFEN inalcanzable durante la reconciliación) al caller, que
 * lo trata como un intento de envío fallido.
 * @param {Object} lote
 * @returns {Promise<{porEnviar: Object[], aprobados: number, indeterminados: number}>}
 */
const reconciliarDocsAntesDeReenviar = async (lote) => {
  const config = TIPOS_DOCUMENTO[lote.tipo_doc];
  const documentos = await config.modelo().findMany({
    where: { lote_id: lote.id },
    include: { caja: { include: { establecimiento: { select: { empresa_id: true } } } } },
  });

  const porEnviar = [];
  let aprobados = 0;
  let indeterminados = 0;
  for (const documento of documentos) {
    // Los ya resueltos en una pasada anterior no se reconsultan ni reenvían.
    if (documento.estado_sifen === "APROBADO") {
      aprobados += 1;
      continue;
    }
    if (documento.estado_sifen === "RECHAZADO") {
      continue;
    }
    const resultado = await reconciliarPorCdc(lote.tipo_doc, documento);
    if (resultado === "APROBADO") {
      aprobados += 1;
    } else if (resultado === "INEXISTENTE") {
      porEnviar.push(documento);
    } else {
      indeterminados += 1;
    }
  }
  return { porEnviar, aprobados, indeterminados };
};

/**
 * Envía a SIFEN los lotes ya construidos (`estado: CONSTRUIDO`) cuyo `proximo_intento_en` ya se
 * cumplió (o nunca se fijó, primer intento). Aislado por lote — el fallo de un lote (de cualquier
 * empresa) no bloquea el envío de los demás (antipatrón Q).
 *
 * Antes de llamar a SIFEN, reclama el lote de forma atómica (`CONSTRUIDO` -> `ENVIANDO`) y descarta
 * silenciosamente cualquier lote cuyo `updateMany` afecte 0 filas — significa que otra ejecución
 * (cron solapado por una corrida anterior más lenta que el intervalo de 5 min, u otra instancia del
 * proceso) ya lo tomó primero. Sin este claim, dos ejecuciones podían enviar el mismo lote a SIFEN
 * dos veces antes de que la primera alcanzara a persistir su resultado (AUD-003,
 * STATIC_AUDIT_FINDINGS.json).
 *
 * **Reenvío a prueba de duplicados (Opción B):** en el PRIMER intento (`intentos_envio === 0`) no hubo
 * envío previo, así que se envía el lote completo sin más. En un RE-intento se reconcilia primero por
 * CDC (`reconciliarDocsAntesDeReenviar`) y se reenvían SOLO los documentos que SIFEN confirma que no
 * tiene — nunca los que ya recibió, evitando el "CDC duplicado".
 * @returns {Promise<void>}
 */
const enviarLotesConstruidos = async () => {
  const ahora = new Date();
  const lotes = await prisma.lote.findMany({
    where: {
      estado: "CONSTRUIDO",
      OR: [{ proximo_intento_en: null }, { proximo_intento_en: { lte: ahora } }],
    },
    include: { facturas: true, notas_credito: true },
  });

  for (const lote of lotes) {
    const claim = await prisma.lote.updateMany({
      where: { id: lote.id, estado: "CONSTRUIDO" },
      data: { estado: "ENVIANDO" },
    });
    if (claim.count === 0) {
      // Otra ejecución ya reclamó este lote entre el findMany de arriba y este punto — se descarta,
      // esa otra ejecución es la que lo va a enviar/reintentar.
      continue;
    }

    const config = TIPOS_DOCUMENTO[lote.tipo_doc];

    // Determinar qué documentos enviar (Opción B — reenvío a prueba de duplicados).
    let documentosAEnviar;
    if (lote.intentos_envio === 0) {
      // Primer intento: no hubo envío previo, no hay riesgo de duplicado — se envía el lote completo.
      documentosAEnviar = lote.tipo_doc === "FACTURA" ? lote.facturas : lote.notas_credito;
    } else {
      // Re-intento: un fallo de transporte previo es ambiguo (SIFEN pudo haber recibido el lote). Se
      // reconcilia por CDC y se reenvían SOLO los que SIFEN confirma que no tiene.
      let particion;
      try {
        particion = await reconciliarDocsAntesDeReenviar(lote);
      } catch (error) {
        // SIFEN inalcanzable durante la reconciliación → se trata como un intento de envío fallido.
        console.error(`[loteService] Error al reconciliar lote ${lote.id} antes de reenviar:`, error.message);
        await registrarFalloEnvio(lote, `No se pudo reconciliar por CDC antes de reenviar (SIFEN inalcanzable): ${error.message}`);
        continue;
      }

      if (particion.indeterminados > 0) {
        // Al menos un documento no tiene estado concluyente en SIFEN — no es seguro reenviar todavía
        // (reenviar solo los inexistentes dejaría a los indeterminados sin resolver dentro del lote).
        // Se reprograma con backoff y se reintenta cuando todos resuelvan.
        console.warn(`[loteService] Lote ${lote.id}: ${particion.indeterminados} documento(s) sin estado concluyente en SIFEN — se pospone el reenvío.`);
        await registrarFalloEnvio(lote, `Reconciliación por CDC: ${particion.indeterminados} documento(s) sin estado concluyente en SIFEN, se reintenta más tarde.`);
        continue;
      }

      if (particion.porEnviar.length === 0) {
        // Nada por enviar y sin indeterminados → todos los documentos ya están en SIFEN (aprobados).
        // El lote terminó: pasa a CONSULTADO si ya no queda nada pendiente.
        const pendientes = await config.modelo().count({ where: { lote_id: lote.id, estado_sifen: { in: ["ENVIADO", "ENCOLADO"] } } });
        await prisma.lote.update({ where: { id: lote.id }, data: { estado: pendientes === 0 ? "CONSULTADO" : "ENVIADO" } });
        console.log(`[loteService] Lote ${lote.id}: todos los documentos ya estaban aprobados en SIFEN (reconciliados) — no se reenvía nada.`);
        continue;
      }

      documentosAEnviar = particion.porEnviar;
    }

    const xmls = documentosAEnviar.map((d) => d.xml_firmado);
    const idsAEnviar = documentosAEnviar.map((d) => d.id);
    const id = generarDId();

    try {
      const certificado = await certificadoService.obtenerCertificadoActivo({ empresaId: lote.empresa_id });
      const respuesta = await sifenClientService.recibeLote({
        id,
        xmls,
        certificadoPath: certificado.archivo,
        certificadoPassword: certificado.clave,
      });

      // Código a nivel de sobre/lote (0300/0301, ver codigosRespuesta.js) — se excluye explícitamente
      // el subárbol gResProcLote (breakdown por documento, si llegara a venir en esta respuesta) para
      // que nunca se confunda con el código de un documento individual (AUD-008, STATIC_AUDIT_FINDINGS.json).
      const { codigo, mensaje } = extraerCodigoYMensaje(respuesta, { excluirSufijos: ["gResProcLote"] });
      const protocolo = extraerProtocoloLote(respuesta);
      const interpretacion = interpretarCodigo(codigo);

      await trazabilidadService.registrarInteraccion({
        entidadTipo: "LOTE",
        entidadId: lote.id,
        operacion: "ENVIO_LOTE",
        request: xmls.join("\n"),
        response: respuesta,
        codigoRespuesta: interpretacion.codigo,
        exitoso: interpretacion.categoria !== CATEGORIA.RECHAZADO,
      });

      if (interpretacion.categoria === CATEGORIA.RECHAZADO) {
        console.error(`[loteService] Lote ${lote.id} rechazado por SIFEN (codigo ${interpretacion.codigo}): ${interpretacion.mensajeInterno} — SIFEN dijo: ${mensaje}`);
        await marcarLoteAgotado(lote, `Rechazado por SIFEN (${interpretacion.codigo}): ${mensaje || interpretacion.mensajeInterno}`);
        continue;
      }

      // INFORMATIVO (p. ej. "0300 - lote recibido con éxito") o cualquier código no-RECHAZADO: SIFEN
      // aceptó el lote para procesamiento asíncrono. `consultarLotes()` resuelve el resultado final.
      await prisma.lote.update({
        where: { id: lote.id },
        data: {
          estado: "ENVIADO",
          sifen_numero_lote: protocolo ? String(protocolo) : null,
          sifen_envio_codigo: interpretacion.codigo,
          sifen_envio_mensaje: mensaje || null,
          intentos_envio: { increment: 1 },
        },
      });
      // Se marcan ENVIADO SOLO los documentos efectivamente enviados en esta pasada (`idsAEnviar`) — en
      // un reenvío parcial, los ya reconciliados quedaron en APROBADO y no se deben pisar.
      await config.modelo().updateMany({
        where: { id: { in: idsAEnviar } },
        data: { estado_sifen: "ENVIADO", fecha_envio_sifen: new Date() },
      });
    } catch (error) {
      // Falla de transporte (timeout/red/5xx) o certificado no disponible/vencido — siempre
      // reintentable, a diferencia de un rechazo de negocio (ya manejado arriba). El backoff, el aviso
      // one-shot y el corte por tiempo (`MAX_HORAS_ENVIO`) los maneja `registrarFalloEnvio`.
      console.error(`[loteService] Error al enviar lote ${lote.id} (intento ${lote.intentos_envio + 1}):`, error.message);
      await trazabilidadService.registrarInteraccion({
        entidadTipo: "LOTE",
        entidadId: lote.id,
        operacion: "ENVIO_LOTE",
        request: xmls.join("\n"),
        response: null,
        exitoso: false,
      });
      await registrarFalloEnvio(lote, error.message);
    }
  }
};

/**
 * Actualiza un documento (Factura o NotaCredito) a partir de su entrada de resultado dentro de
 * `gResProcLote` (respuesta de `consultaLote`). No toca nada si el resultado todavía es
 * INFORMATIVO (sin resolución final).
 * @param {"FACTURA"|"NOTA_CREDITO"} tipoDoc
 * @param {number} loteId
 * @param {Object} resultadoDocumento - Una entrada de `gResProcLote`
 */
const actualizarDocumentoPorResultado = async (tipoDoc, loteId, resultadoDocumento) => {
  const cdc = extraerCdc(resultadoDocumento);
  const { codigo, mensaje } = extraerCodigoYMensaje(resultadoDocumento);
  const interpretacion = interpretarCodigo(codigo);

  if (!cdc || interpretacion.categoria === CATEGORIA.INFORMATIVO) {
    return;
  }

  const config = TIPOS_DOCUMENTO[tipoDoc];
  const modelo = config.modelo();

  // DUPLICADO (1001/1002) NO prueba que ESTE CDC exista como DTE: SIFEN dice "ya fue autorizado OTRO
  // documento con coincidencia de los campos del timbrado" — ese "otro" puede ser un CDC distinto (p. ej.
  // una emisión previa del mismo número de timbrado por el flujo legacy). Confiar en el 1002 del lote y
  // marcar APROBADO a ciegas fue un bug real de producción (factura id=39): un CDC que nunca existió en
  // SIFEN quedó APROBADO y se dejó cancelar, y SIFEN respondió 4002 "CDC no existente". Por eso un
  // DUPLICADO NO se resuelve acá: dispara la reconciliación por CDC (siConsDE, fuente de verdad
  // autoritativa), que distingue 0422 (existe -> APROBADO) de 0420 (no existe -> se deja como está para
  // la próxima consulta/red de seguridad). Es exactamente lo que ya documentaba codigosRespuesta.js
  // (categoría DUPLICADO) y la reconciliación por CDC — este atajo lo contradecía.
  if (interpretacion.categoria === CATEGORIA.DUPLICADO) {
    const documentoDuplicado = await modelo.findFirst({ where: { cdc, lote_id: loteId }, include: config.include });
    if (!documentoDuplicado) {
      return;
    }
    try {
      await reconciliarPorCdc(tipoDoc, documentoDuplicado);
    } catch (error) {
      console.error(
        `[loteService] Error al reconciliar por CDC ${config.entidadTipo} id=${documentoDuplicado.id} ` +
          `(lote ${loteId}) tras DUPLICADO (${interpretacion.codigo}): ${error.message}`
      );
    }
    return;
  }

  const nuevoEstado = interpretacion.categoria === CATEGORIA.APROBADO ? "APROBADO" : "RECHAZADO";
  const documentoPrevio = await modelo.findFirst({ where: { cdc, lote_id: loteId } });
  if (!documentoPrevio) {
    return;
  }

  await modelo.update({
    where: { id: documentoPrevio.id },
    data: {
      estado_sifen: nuevoEstado,
      sifen_cod_respuesta: interpretacion.codigo,
      sifen_estado_mensaje: nuevoEstado === "RECHAZADO" ? mensaje || interpretacion.mensajeInterno : null,
      sifen_num_transaccion: extraerProtocoloAutorizacion(resultadoDocumento) || null,
      fecha_respuesta_sifen: new Date(),
    },
  });

  if (interpretacion.alertar) {
    console.error(`[loteService] SIFEN respondio codigo ${interpretacion.codigo} para CDC=${cdc}: ${interpretacion.mensajeInterno} — SIFEN dijo: ${mensaje}`);
  }

  // Antes de notificar: si el rechazo fue 1332, SIFEN acaba de decirnos que el receptor es un OEE.
  // Se marca ahora para que el reintento manual del documento (que el mail de rechazo va a
  // provocar) ya salga corregido como B2G.
  await marcarReceptorComoOee(tipoDoc, documentoPrevio.id, interpretacion.codigo);

  await notificarResultadoDocumento(tipoDoc, documentoPrevio.id, nuevoEstado, mensaje || interpretacion.mensajeInterno);
};

/**
 * Consulta el estado real de un documento en SIFEN **por su CDC** (`sifenClientService.consulta`, WS
 * siConsDE) — la fuente de verdad autoritativa — y sincroniza `estado_sifen` en consecuencia. NUNCA
 * reenvía nada: solo lee y persiste el estado real, así que es seguro llamarla desde cualquier punto
 * (consulta de lote ambigua, red de seguridad, reintento manual). Es el mecanismo que corrige la
 * divergencia "SIFEN aprobó pero nuestra base quedó en ERROR/RECHAZADO" (reconciliación por CDC):
 * un CDC que SIFEN ya tiene autorizado (0260/0422, o el "duplicado" 1001/1002
 * que igual prueba que el documento existe) se sincroniza a APROBADO en vez de reenviarse.
 *
 * Deliberadamente **nunca marca RECHAZADO** desde acá: un DE rechazado en validación no queda
 * consultable como DTE, así que SIFEN responde `0420` (CDC inexistente) tanto para un documento
 * genuinamente rechazado como para uno que se perdió en tránsito. Ese caso es ambiguo y no se resuelve
 * adivinando — se devuelve `INEXISTENTE` y decide el caller (para un reintento manual = seguro reenviar
 * el mismo CDC; para un job de consulta = dejarlo como está y alertar).
 *
 * @param {"FACTURA"|"NOTA_CREDITO"} tipoDoc
 * @param {Object} documento - Con al menos `id`, `cdc` y `caja.establecimiento.empresa_id` cargados
 * @returns {Promise<"APROBADO"|"INEXISTENTE"|"INDETERMINADO">}
 *   - APROBADO: SIFEN tiene el documento como DTE autorizado (se sincronizó `estado_sifen = APROBADO`).
 *   - INEXISTENTE: SIFEN no tiene el CDC (0420) — no se tocó el estado; seguro reenviar el mismo CDC.
 *   - INDETERMINADO: consulta no concluyente (0421 sin permiso, informativo, código desconocido/ausente,
 *     SIFEN inestable) — no se tocó el estado.
 */
const reconciliarPorCdc = async (tipoDoc, documento) => {
  const config = TIPOS_DOCUMENTO[tipoDoc];
  const empresaId = documento.caja.establecimiento.empresa_id;
  const certificado = await certificadoService.obtenerCertificadoActivo({ empresaId });
  const respuesta = await sifenClientService.consulta({
    id: generarDId(),
    cdc: documento.cdc,
    certificadoPath: certificado.archivo,
    certificadoPassword: certificado.clave,
  });

  const { codigo, mensaje } = extraerCodigoYMensaje(respuesta);
  const interpretacion = interpretarCodigo(codigo);
  const documentoAutorizado = interpretacion.categoria === CATEGORIA.APROBADO || interpretacion.categoria === CATEGORIA.DUPLICADO;

  await trazabilidadService.registrarInteraccion({
    entidadTipo: config.entidadTipo,
    entidadId: documento.id,
    operacion: "CONSULTA_DOCUMENTO",
    request: { cdc: documento.cdc },
    response: respuesta,
    codigoRespuesta: interpretacion.codigo,
    exitoso: documentoAutorizado,
  });

  if (documentoAutorizado) {
    await config.modelo().update({
      where: { id: documento.id },
      data: {
        estado_sifen: "APROBADO",
        sifen_cod_respuesta: interpretacion.codigo,
        sifen_estado_mensaje: null,
        // `undefined` => Prisma no toca la columna (no pisa un protocolo previo si esta respuesta no lo trae).
        sifen_num_transaccion: extraerProtocoloAutorizacion(respuesta) || undefined,
        fecha_respuesta_sifen: new Date(),
      },
    });
    await notificarResultadoDocumento(tipoDoc, documento.id, "APROBADO", mensaje || interpretacion.mensajeInterno);
    return "APROBADO";
  }

  if (interpretacion.codigo === "0420") {
    return "INEXISTENTE";
  }

  if (interpretacion.alertar) {
    console.error(`[loteService] reconciliarPorCdc: respuesta no concluyente de SIFEN para CDC=${documento.cdc} (codigo ${interpretacion.codigo}): ${interpretacion.mensajeInterno} — SIFEN dijo: ${mensaje}`);
  }
  return "INDETERMINADO";
};

/**
 * Reconciliación por CDC de los documentos de un lote cuya `consultaLote` no devolvió un resultado
 * concluyente por documento (respuesta de sobre ambigua — código ausente/desconocido, ver
 * `consultarLotes`). Aislado por documento (antipatrón Q). Solo consulta/sincroniza, nunca reenvía.
 * @param {Object} lote
 */
const reconciliarLotePorCdc = async (lote) => {
  const config = TIPOS_DOCUMENTO[lote.tipo_doc];
  // Solo los que siguen sin resolución final — evita reconsultar los ya APROBADO/RECHAZADO/ERROR.
  const documentos = await config.modelo().findMany({
    where: { lote_id: lote.id, estado_sifen: { in: ["ENVIADO", "ENCOLADO"] } },
    include: { caja: { include: { establecimiento: { select: { empresa_id: true } } } } },
  });
  for (const documento of documentos) {
    try {
      await reconciliarPorCdc(lote.tipo_doc, documento);
    } catch (error) {
      console.error(`[loteService] Error al reconciliar por CDC ${config.entidadTipo} id=${documento.id} (lote ${lote.id}):`, error.message);
    }
  }
};

/**
 * Avisa por Telegram, en UN solo mensaje por lote, los documentos que esta pasada de `consultarLotes()`
 * llevó a `APROBADO` — contrapartida del aviso de rechazo, que sí es por documento (un rechazo requiere
 * acción humana; una aprobación es la confirmación de que el lote salió bien, y mandarla documento por
 * documento inundaría el grupo hasta ahogar los rechazos).
 *
 * "Recién aprobados" se calcula por diferencia contra el set de IDs que ya estaban en `APROBADO` antes
 * de procesar la respuesta (`idsAprobadosPrevios`), no por lo que devolvió `consultaLote`: un documento
 * puede terminar en `APROBADO` por tres caminos distintos dentro de la misma pasada
 * (`actualizarDocumentoPorResultado`, la reconciliación por CDC de un DUPLICADO, y `reconciliarLotePorCdc`
 * ante un sobre ambiguo), y el diff los cubre a los tres sin tener que devolver estado desde cada uno.
 * Como consecuencia también es idempotente: si la próxima pasada del cron no aprueba nada nuevo, no
 * manda nada.
 *
 * Solo cubre el camino del lote. Una aprobación recuperada por la red de seguridad
 * (`consultaIndividualRedDeSeguridad`) no pasa por acá — es un caso puntual y anómalo que ya deja su
 * propio log, y anunciarlo como "lote aprobado" sería engañoso.
 * @param {Object} lote
 * @param {Set<number>} idsAprobadosPrevios - IDs del lote que ya estaban en APROBADO antes de esta pasada
 */
const notificarAprobadosDelLote = async (lote, idsAprobadosPrevios) => {
  const config = TIPOS_DOCUMENTO[lote.tipo_doc];
  const aprobados = await config.modelo().findMany({
    where: { lote_id: lote.id, estado_sifen: "APROBADO" },
    select: {
      id: true,
      [config.campoNumero]: true,
      caja: { select: { codigo: true, establecimiento: { select: { codigo: true } } } },
    },
    orderBy: { id: "asc" },
  });

  const nuevos = aprobados.filter((documento) => !idsAprobadosPrevios.has(documento.id));
  if (nuevos.length === 0) {
    return;
  }

  const totalLote = await config.modelo().count({ where: { lote_id: lote.id } });
  // Mismo número impreso que el KUDE/PDF (`001-001-0000123`). `caja` es nullable en el schema (documentos
  // legacy con `caja_id` NULL), y ahí `formatNumeroDocumento` devuelve null: se cae al secuencial pelado
  // antes que omitir el documento del aviso.
  const numeros = nuevos.map(
    (documento) =>
      formatNumeroDocumento(
        documento.caja ? documento.caja.establecimiento.codigo : null,
        documento.caja ? documento.caja.codigo : null,
        documento[config.campoNumero]
      ) || String(documento[config.campoNumero])
  );

  await telegramService.notificarDocumentosAprobados({
    tipoDoc: lote.tipo_doc,
    numeros,
    totalLote,
    aprobadosLote: aprobados.length,
  });
};

/**
 * Consulta en SIFEN el resultado de los lotes ya enviados (`estado: ENVIADO`). Aislado por lote. Un
 * lote pasa a `CONSULTADO` recién cuando ninguno de sus documentos sigue en `ENVIADO` (todos
 * resolvieron a `APROBADO`/`RECHAZADO`/`ERROR`) — mientras tanto queda `ENVIADO` para la próxima
 * pasada del cron.
 * @returns {Promise<void>}
 */
const consultarLotes = async () => {
  const lotes = await prisma.lote.findMany({ where: { estado: "ENVIADO" } });

  for (const lote of lotes) {
    const config = TIPOS_DOCUMENTO[lote.tipo_doc];
    try {
      // Foto de los ya aprobados ANTES de procesar la respuesta: la diferencia contra el estado final
      // son los que aprobó esta pasada, que es lo que se avisa al grupo (ver `notificarAprobadosDelLote`).
      const aprobadosPrevios = await config.modelo().findMany({
        where: { lote_id: lote.id, estado_sifen: "APROBADO" },
        select: { id: true },
      });
      const idsAprobadosPrevios = new Set(aprobadosPrevios.map((documento) => documento.id));

      const certificado = await certificadoService.obtenerCertificadoActivo({ empresaId: lote.empresa_id });
      const respuesta = await sifenClientService.consultaLote({
        id: generarDId(),
        numeroProtocolo: lote.sifen_numero_lote,
        certificadoPath: certificado.archivo,
        certificadoPassword: certificado.clave,
      });

      // Código a nivel de sobre/lote de una respuesta de consultaLote: viene en dCodResLot/dMsgResLot,
      // no en dCodRes/dMsgRes (esos, a este nivel, son los del documento individual anidado dentro de
      // gResProcLote — confirmado contra un round-trip real, ver respuestaSoap.js). No es un caso
      // particular de dCodRes: es un tag distinto, por eso se pasa sufijoCodigo/sufijoMensaje en vez de
      // excluirSufijos (AUD-008, STATIC_AUDIT_FINDINGS.json — la exclusión original no cubría esto).
      const { codigo, mensaje } = extraerCodigoYMensaje(respuesta, { sufijoCodigo: "dCodResLot", sufijoMensaje: "dMsgResLot" });
      const resultadosPorDocumento = extraerResultadosPorDocumento(respuesta);
      const interpretacionLote = interpretarCodigo(codigo);

      await trazabilidadService.registrarInteraccion({
        entidadTipo: "LOTE",
        entidadId: lote.id,
        operacion: "CONSULTA_LOTE",
        request: { id: lote.id, numeroProtocolo: lote.sifen_numero_lote },
        response: respuesta,
        codigoRespuesta: interpretacionLote.codigo,
        // El código de sobre de consultaLote (p. ej. "0362", "procesamiento concluido") todavía no está
        // en codigosRespuesta.js (pendiente de verificar contra el Manual Técnico, no se inventa acá) —
        // no lo uses solo para decidir "exitoso": si ya hay resultado por documento, la consulta funcionó.
        exitoso: resultadosPorDocumento.length > 0 || interpretacionLote.categoria !== CATEGORIA.RECHAZADO,
      });

      await prisma.lote.update({
        where: { id: lote.id },
        data: { sifen_consulta_codigo: interpretacionLote.codigo, sifen_consulta_mensaje: mensaje || null },
      });

      if (resultadosPorDocumento.length > 0) {
        for (const resultadoDocumento of resultadosPorDocumento) {
          await actualizarDocumentoPorResultado(lote.tipo_doc, lote.id, resultadoDocumento);
        }
      } else if (interpretacionLote.conocido && interpretacionLote.categoria === CATEGORIA.RECHAZADO) {
        // Solo se agota el lote ante un rechazo de sobre con código CONOCIDO y explícito (p. ej. 0360
        // "lote inexistente", 0363 "tipos mezclados") — un rechazo real de nivel sobre. Un código
        // ausente/desconocido NO cae acá (ver el else de abajo): antes sí caía (interpretarCodigo(null)
        // devuelve RECHAZADO por default) y `marcarLoteAgotado` condenaba a ERROR documentos que SIFEN
        // podía tener aprobados — causa raíz del bug de "CDC duplicado" en el reintento
        // (reconciliación por CDC).
        await marcarLoteAgotado(lote, `Lote rechazado en consulta (${interpretacionLote.codigo}): ${mensaje || interpretacionLote.mensajeInterno}`);
        continue;
      } else {
        // Respuesta ambigua: sobre sin desglose por documento y con código ausente (dCodResLot null),
        // desconocido, o meramente informativo. NO se condena el lote por adivinar — se reconcilia cada
        // documento por CDC (fuente de verdad autoritativa): los que SIFEN ya aprobó pasan a APROBADO,
        // el resto queda como está (ENVIADO/ENCOLADO) para la próxima consulta o la red de seguridad.
        await reconciliarLotePorCdc(lote);
      }

      const pendientes = await config.modelo().count({ where: { lote_id: lote.id, estado_sifen: { in: ["ENVIADO", "ENCOLADO"] } } });
      if (pendientes === 0) {
        await prisma.lote.update({ where: { id: lote.id }, data: { estado: "CONSULTADO" } });
      }

      // Aislado en su propio try/catch a propósito: si cayera en el catch del lote se loguearía como
      // "Error al consultar lote" y se registraría una trazabilidad de consulta fallida que no ocurrió
      // (la consulta ya terminó bien acá). Un fallo de Telegram nunca debe alterar el estado del lote.
      try {
        await notificarAprobadosDelLote(lote, idsAprobadosPrevios);
      } catch (errorTelegram) {
        console.error(`[loteService] Error al notificar a Telegram los aprobados del lote ${lote.id}:`, errorTelegram.message);
      }
    } catch (error) {
      console.error(`[loteService] Error al consultar lote ${lote.id}:`, error.message);
      await trazabilidadService.registrarInteraccion({
        entidadTipo: "LOTE",
        entidadId: lote.id,
        operacion: "CONSULTA_LOTE",
        request: { id: lote.id, numeroProtocolo: lote.sifen_numero_lote },
        response: null,
        exitoso: false,
      });
      // Fallo de transporte al consultar: no es un rechazo de negocio, se reintenta en la próxima
      // pasada del cron sin necesidad de backoff propio (consultarLotes ya corre cada 5 min, §3.4).
    }
  }
};

/**
 * Red de seguridad (§3.4): documentos sin resolución final por más de `SIFEN_RED_SEGURIDAD_UMBRAL_MINUTOS`
 * (default 120) desde su envío a SIFEN. Reconciliación por CDC (`reconciliarPorCdc`, la fuente de verdad
 * autoritativa) — nunca reenvía, solo sincroniza el estado real. No reemplaza `consultarLotes`, es un
 * complemento de baja frecuencia (pensado para correr cada 1 hora).
 *
 * Cubre tres poblaciones (todas acotadas a "efectivamente enviadas" — `fecha_envio_sifen` no nula — y
 * dentro del plazo de transmisión de 720h):
 * 1. `ENVIADO` estancado: una consulta de lote que nunca resolvió (p. ej. el lote se perdió del lado de
 *    SIFEN, o SIFEN devuelve sobres ambiguos).
 * 2. `ERROR` que **ya se había enviado**: típicamente condenado por una consulta de lote fallida/ambigua
 *    aunque SIFEN lo tuviera aprobado (el bug raíz, reconciliación por CDC). Un ERROR
 *    de firma-agotada nunca se envió (`fecha_envio_sifen` null), así que queda excluido y no se toca.
 * 3. `RECHAZADO` que ya se había enviado: un RECHAZADO puede ser una mentira — un código no documentado
 *    o una respuesta ambigua de SIFEN (p. ej. durante una caída) que `interpretarCodigo` cae a RECHAZADO
 *    por default, aunque SIFEN haya terminado autorizando el documento. Cubrir esta población cierra la
 *    misma clase de bug que (2) para el estado que en la práctica es el más común.
 *
 * Es **seguro** incluir ERROR/RECHAZADO: `reconciliarPorCdc` solo flipea a APROBADO ante prueba positiva
 * (0422/0260/1001/1002); un rechazo/error genuino devuelve 0420 (inexistente) → no se toca el estado ni
 * se notifica. Nunca reenvía: un documento que SIFEN realmente no tiene (0420) requiere reenvío manual
 * (`reintentarEnvioDocumento`), no se reencola desde este cron.
 * @returns {Promise<void>}
 */
const consultaIndividualRedDeSeguridad = async () => {
  const limite = new Date(Date.now() - RED_SEGURIDAD_UMBRAL_MINUTOS * 60 * 1000);
  const limitePlazo = new Date(Date.now() - PLAZO_TRANSMISION_HORAS * 60 * 60 * 1000);

  for (const tipoDoc of Object.keys(TIPOS_DOCUMENTO)) {
    const config = TIPOS_DOCUMENTO[tipoDoc];
    const estancados = await config.modelo().findMany({
      where: {
        // Solo documentos efectivamente enviados a SIFEN y hace más del umbral (un ERROR de
        // firma-agotada nunca se envió → fecha_envio_sifen null → excluido naturalmente).
        fecha_envio_sifen: { not: null, lte: limite },
        // Dentro del plazo de transmisión: pasado eso el CDC ya no importa, no se reconsulta más.
        fecha_creacion: { gte: limitePlazo },
        OR: [{ estado_sifen: "ENVIADO" }, { estado_sifen: "ERROR" }, { estado_sifen: "RECHAZADO" }],
      },
      include: { caja: { include: { establecimiento: { select: { empresa_id: true } } } } },
    });

    for (const documento of estancados) {
      const estadoPrevio = documento.estado_sifen;
      try {
        const resultado = await reconciliarPorCdc(tipoDoc, documento);
        if (resultado === "APROBADO" && estadoPrevio !== "APROBADO") {
          console.log(`[loteService] Red de seguridad: ${tipoDoc} id=${documento.id} (CDC=${documento.cdc}) estaba en ${estadoPrevio} pero SIFEN lo tiene APROBADO — estado recuperado.`);
        }
        // INEXISTENTE/INDETERMINADO: no se condena ni se reenvía desde acá (reconciliarPorCdc ya loguea
        // el detalle); el documento sigue visible en su estado actual para revisión manual. No se alerta
        // a Telegram para no spamear cada hora un documento genuinamente atascado.
      } catch (error) {
        console.error(`[loteService] Error en consulta individual de red de seguridad para ${tipoDoc} id=${documento.id}:`, error.message);
        // Este es el backstop de baja frecuencia (corre 1 vez por hora, ver docstring de la función):
        // si un documento llega hasta acá y la consulta individual TAMBIÉN falla, es la señal más
        // fuerte de que SIFEN está caído/inalcanzable de forma sostenida (no un timeout aislado) — a
        // diferencia de `consultarLotes()` (cada 2.5 min, deliberadamente sin alerta acá para no
        // spamear Telegram en cada corrida), acá sí se alerta, aislado en su propio try/catch.
        try {
          await telegramService.notificarFallaSistemica({
            titulo: `Red de seguridad: no se pudo consultar ${tipoDoc} en SIFEN`,
            detalle: `id=${documento.id}, CDC=${documento.cdc}, estado=${estadoPrevio}. Lleva más de ${RED_SEGURIDAD_UMBRAL_MINUTOS} min desde el envío sin resolución y la consulta individual también falló: ${error.message}`,
          });
        } catch (errorTelegram) {
          console.error(`[loteService] Error al notificar a Telegram la falla de red de seguridad para ${tipoDoc} id=${documento.id}:`, errorTelegram.message);
        }
      }
    }
  }
};

module.exports = {
  armarLotes,
  enviarLotesConstruidos,
  consultarLotes,
  consultaIndividualRedDeSeguridad,
  firmarDocumentoRecienCreado,
  reintentarEnvioDocumento,
};
