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
const { interpretarCodigo, CATEGORIA } = require("../../utils/sifen/codigosRespuesta");
const {
  extraerCodigoYMensaje,
  extraerProtocoloLote,
  extraerResultadosPorDocumento,
  extraerCdc,
  extraerProtocoloAutorizacion,
} = require("../../utils/sifen/respuestaSoap");
const { decryptTolerante } = require("../../utils/crypto");

/**
 * Único camino de emisión de Factura/NotaCredito (MIGRATION_PLAN.md §3.1/§3.2, Decisión cerrada) —
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
const MAX_INTENTOS_ENVIO = Number(process.env.SIFEN_LOTE_MAX_INTENTOS) || 10;
const RED_SEGURIDAD_UMBRAL_MINUTOS = Number(process.env.SIFEN_RED_SEGURIDAD_UMBRAL_MINUTOS) || 120;

// Límite de "transmisión extemporánea" del Manual Técnico SIFEN v150 §6.2: pasadas 720h (30 días)
// desde la fecha de emisión real del documento, SIFEN rechaza el envío sin excepción — no tiene
// sentido intentar un reenvío manual más allá de este punto, el número queda inevitablemente
// "quemado" y requiere inutilización (no implementada) + un documento nuevo.
const PLAZO_TRANSMISION_HORAS = Number(process.env.SIFEN_PLAZO_TRANSMISION_HORAS) || 720;

// Tope de reintentos de firma (`firmarPendientes()`) — sin esto, un documento que nunca lograba
// firmarse (certificado vencido, datos fiscales incompletos, bug de armado de XML) reintentaba cada 5
// min para siempre, sin escalar nunca a `ERROR` ni alertar a nadie. Mismo criterio que
// `SIFEN_LOTE_MAX_INTENTOS` para el envío. Seguro escalar a `ERROR` acá (a diferencia de una consulta
// fallida): el documento todavía no se le envió nada a SIFEN, así que un reintento posterior vía
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
    // campo legacy congelado (a diferencia de `xml`/`sifen_estado`, ver MIGRATION_PLAN.md §2.2):
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
 * `notaDeCreditoService` (Fase 5, MIGRATION_PLAN.md §3.2) — a diferencia de `firmarPendientes()`
 * (que corre en el cron cada 5 min sobre cualquier `GENERADO` suelto), este camino firma en el mismo
 * momento de la emisión, replicando el comportamiento que ya tenía la API PHP legacy (`data.php`
 * firmaba sincrónico, solo el envío a SIFEN era asíncrono por lote — ver "Conflictos detectados" en
 * MIGRATION_PLAN.md). Pensado para invocarse con la `tx` de la transacción de creación del caller: si
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
 * automáticos de `enviarLotesConstruidos()`/`marcarLoteAgotado()` — ver docstring de esa función).
 * Deliberadamente NO acepta documentos `RECHAZADO`: ese es un resultado de negocio (SIFEN evaluó el
 * contenido y lo rechazó, p. ej. dato inválido), no un fallo técnico/de transporte — reenviar el mismo
 * dato sin cambios repetiría el mismo rechazo, y hoy no existe forma de editar una Factura/NotaCredito
 * ya creada. Alcance decidido con el usuario: solo `ERROR` por ahora.
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
 * número, nunca uno nuevo. Un documento que no llegó a `APROBADO` nunca fue consumido por SIFEN, así
 * que no hay problema de correlatividad en reusar el número.
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

  if (documento.estado_sifen !== "ERROR") {
    throw new ErrorApp(
      `Solo se puede reintentar un documento en estado ERROR (actual: ${documento.estado_sifen || "sin estado SIFEN"})`,
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
 * legacy todavía vigente, ver desvío #1 de MIGRATION_PLAN.md — `facturaService.js`/
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
    const documentos = lote.tipo_doc === "FACTURA" ? lote.facturas : lote.notas_credito;
    const xmls = documentos.map((d) => d.xml_firmado);
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
      await config.modelo().updateMany({
        where: { lote_id: lote.id },
        data: { estado_sifen: "ENVIADO", fecha_envio_sifen: new Date() },
      });
    } catch (error) {
      // Falla de transporte (timeout/red/5xx) o certificado no disponible/vencido — siempre
      // reintentable con backoff, a diferencia de un rechazo de negocio (ya manejado arriba).
      const intentos = lote.intentos_envio + 1;
      console.error(`[loteService] Error al enviar lote ${lote.id} (intento ${intentos}):`, error.message);

      await trazabilidadService.registrarInteraccion({
        entidadTipo: "LOTE",
        entidadId: lote.id,
        operacion: "ENVIO_LOTE",
        request: xmls.join("\n"),
        response: null,
        exitoso: false,
      });

      if (intentos >= MAX_INTENTOS_ENVIO) {
        await marcarLoteAgotado(lote, `Excedido el maximo de intentos de envio (${MAX_INTENTOS_ENVIO}): ${error.message}`);
        continue;
      }

      // Libera el claim (ENVIANDO -> CONSTRUIDO) para que la próxima pasada del cron, una vez cumplido
      // el backoff, pueda volver a tomar y reintentar este lote.
      await prisma.lote.update({
        where: { id: lote.id },
        data: {
          estado: "CONSTRUIDO",
          intentos_envio: { increment: 1 },
          proximo_intento_en: new Date(Date.now() + calcularBackoffSegundos(intentos) * 1000),
          ultimo_error: error.message,
        },
      });
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

  const nuevoEstado = interpretacion.categoria === CATEGORIA.APROBADO ? "APROBADO" : "RECHAZADO";
  const modelo = tipoDoc === "FACTURA" ? prisma.factura : prisma.notaCredito;
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

  await notificarResultadoDocumento(tipoDoc, documentoPrevio.id, nuevoEstado, mensaje || interpretacion.mensajeInterno);
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
      } else if (interpretacionLote.categoria === CATEGORIA.RECHAZADO) {
        // Sin detalle por documento, pero el lote en sí resolvió a rechazado a nivel de sobre.
        await marcarLoteAgotado(lote, `Lote rechazado en consulta (${interpretacionLote.codigo}): ${mensaje || interpretacionLote.mensajeInterno}`);
        continue;
      }

      const pendientes = await config.modelo().count({ where: { lote_id: lote.id, estado_sifen: { in: ["ENVIADO", "ENCOLADO"] } } });
      if (pendientes === 0) {
        await prisma.lote.update({ where: { id: lote.id }, data: { estado: "CONSULTADO" } });
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
 * Red de seguridad (§3.4): documentos que quedaron en `ENVIADO` sin resolución por más de
 * `SIFEN_RED_SEGURIDAD_UMBRAL_MINUTOS` (default 120) — cubre el caso borde de una consulta de lote
 * que nunca resuelve (p. ej. el lote se perdió del lado de SIFEN). No reemplaza `consultarLotes`, es
 * un complemento de baja frecuencia (pensado para correr cada 1 hora).
 * @returns {Promise<void>}
 */
const consultaIndividualRedDeSeguridad = async () => {
  const limite = new Date(Date.now() - RED_SEGURIDAD_UMBRAL_MINUTOS * 60 * 1000);

  for (const tipoDoc of Object.keys(TIPOS_DOCUMENTO)) {
    const config = TIPOS_DOCUMENTO[tipoDoc];
    const estancados = await config.modelo().findMany({
      where: { estado_sifen: "ENVIADO", fecha_envio_sifen: { lte: limite } },
      include: { caja: { include: { establecimiento: { select: { empresa_id: true } } } } },
    });

    for (const documento of estancados) {
      try {
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

        await trazabilidadService.registrarInteraccion({
          entidadTipo: config.entidadTipo,
          entidadId: documento.id,
          operacion: "CONSULTA_DOCUMENTO",
          request: { cdc: documento.cdc },
          response: respuesta,
          codigoRespuesta: interpretacion.codigo,
          exitoso: interpretacion.categoria !== CATEGORIA.RECHAZADO,
        });

        if (interpretacion.categoria === CATEGORIA.INFORMATIVO) {
          continue;
        }

        const nuevoEstado = interpretacion.categoria === CATEGORIA.APROBADO ? "APROBADO" : "RECHAZADO";
        await config.modelo().update({
          where: { id: documento.id },
          data: {
            estado_sifen: nuevoEstado,
            sifen_cod_respuesta: interpretacion.codigo,
            sifen_estado_mensaje: nuevoEstado === "RECHAZADO" ? mensaje || interpretacion.mensajeInterno : null,
            fecha_respuesta_sifen: new Date(),
          },
        });

        if (interpretacion.alertar) {
          console.error(`[loteService] Red de seguridad: SIFEN respondio codigo ${interpretacion.codigo} para CDC=${documento.cdc}: ${interpretacion.mensajeInterno} — SIFEN dijo: ${mensaje}`);
        }

        await notificarResultadoDocumento(tipoDoc, documento.id, nuevoEstado, mensaje || interpretacion.mensajeInterno);
      } catch (error) {
        console.error(`[loteService] Error en consulta individual de red de seguridad para ${tipoDoc} id=${documento.id}:`, error.message);
        // Este es el backstop de baja frecuencia (corre 1 vez por hora, ver docstring de la función):
        // si un documento llega hasta acá y la consulta individual TAMBIÉN falla, es la señal más
        // fuerte de que SIFEN está caído/inalcanzable de forma sostenida (no un timeout aislado) — a
        // diferencia de `consultarLotes()` (cada 5 min, deliberadamente sin alerta acá para no spamear
        // Telegram en cada corrida), acá sí se alerta, aislado en su propio try/catch.
        try {
          await telegramService.notificarFallaSistemica({
            titulo: `Red de seguridad: no se pudo consultar ${tipoDoc} en SIFEN`,
            detalle: `id=${documento.id}, CDC=${documento.cdc}. Lleva más de ${RED_SEGURIDAD_UMBRAL_MINUTOS} min en ENVIADO sin resolución y la consulta individual también falló: ${error.message}`,
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
