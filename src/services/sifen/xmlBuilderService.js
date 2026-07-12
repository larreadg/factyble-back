const xmlgen = require("facturacionelectronicapy-xmlgen").default;
const dayjs = require("dayjs");
const utc = require("dayjs/plugin/utc");
const timezone = require("dayjs/plugin/timezone");
const ErrorApp = require("../../utils/error");
const { validarCdc } = require("../../utils/sifen/cdc");

dayjs.extend(utc);
dayjs.extend(timezone);

// Misma zona horaria y mismo motivo que utils/sifen/cdc.js#ZONA_HORARIA_PARAGUAY (AUD-002,
// STATIC_AUDIT_FINDINGS.json) — la fecha del XML y la del CDC deben coincidir en el mismo día
// calendario real de Paraguay, independientemente del timezone del proceso Node.
const ZONA_HORARIA_PARAGUAY = "America/Asuncion";

const VERSION_FORMATO = 150; // dVerFor, plantilla siRecepDE_v150.xsd (ver MIGRATION_PLAN.md §1.2)
const TIPO_DOCUMENTO_FACTURA = 1;
const TIPO_DOCUMENTO_NOTA_CREDITO = 5;
const TIPO_EMISION_NORMAL = 1; // 2=Contingencia, fuera de alcance (ver Decisiones cerradas)
const TIPO_TRANSACCION_VENTA_MERCADERIA = 1;
const INDICADOR_PRESENCIA_OPERACION_PRESENCIAL = 1;
const DOCUMENTO_ASOCIADO_FORMATO_ELECTRONICO = 1;
const CONDICION_OPERACION_CONTADO = 1;
const CONDICION_OPERACION_CREDITO = 2;
const CONDICION_PAGO_EFECTIVO = 1;
const CREDITO_TIPO_PLAZO = 1;

// El schema no registra código/unidad de medida por ítem (FacturaDetalle/NotaCreditoDetalle son
// texto libre + cantidad/precio). Se replican los mismos defaults que ya usaba la API PHP legacy
// (facturaService.js:388 aprox.: codigo "0011", unidadMedida 77-Unidad) — lógica de negocio ya
// validada en producción, no se reinventa acá.
const CODIGO_ITEM_DEFAULT = "0011";
const UNIDAD_MEDIDA_DEFAULT = 77;

// NotaCredito no persiste un motivo propio (no hay campo `motivo` en el modelo Prisma). Se usa el
// motivo más genérico del catálogo SIFEN como default documentado — si en el futuro se necesita
// precisión, agregar NotaCredito.motivo y mapear 1:1 contra constants.service.js#notasCreditosMotivos.
const MOTIVO_NOTA_CREDITO_DEFAULT = 1; // "Devolución y Ajuste de precios"

// Factura no registra plazo de crédito real (sin fecha de vencimiento ni cuotas en el schema).
// Se informa un plazo fijo en días como default documentado, vía condicion.credito.tipo=1 (Plazo,
// no Cuota) para no inventar datos de cuotas que no existen — ver nota en MIGRATION_PLAN.md.
const PLAZO_CREDITO_DIAS_DEFAULT = "30";

const TIPO_CONTRIBUYENTE_SIFEN = { FISICA: 1, JURIDICA: 2 };
const TIPO_IMPUESTO_SIFEN = { IVA: 1, ISC: 2, RENTA: 3, NINGUNO: 4, IVA_RENTA: 5 };
const TIPO_OPERACION_SIFEN = { CONTRIBUYENTE: 1, NO_CONTRIBUYENTE: 2, NO_DOMICILIADO: 4 };
const TIPO_DOCUMENTO_RECEPTOR_SIFEN = {
  CEDULA: 1,
  PASAPORTE: 2,
  CARNE_DE_RESIDENCIA: 4,
  IDENTIFICACION_TRIBUTARIA: 9,
};

// Cliente no distingue Física/Jurídica (sin campo en el schema). Se asume Jurídica por defecto para
// receptores contribuyentes (perfil B2B típico de facturación con RUC) — documentado como gap, ver
// MIGRATION_PLAN.md. Si se necesita precisión, agregar Cliente.tipo_contribuyente.
const TIPO_CONTRIBUYENTE_CLIENTE_DEFAULT = 2;

// iAfecIVA/dTasaIVA/dPropIVA por tasa: 3=Exento (dPropIVA debe ser 0), 1=Gravado IVA (dPropIVA debe
// ser 100) — mismo mapeo que ya usaba la API PHP legacy (ivaAfecta 3 exenta / 1 gravada).
const TASA_SIFEN = {
  T0: { iva: 0, ivaTipo: 3, ivaBase: 0 },
  T5: { iva: 5, ivaTipo: 1, ivaBase: 100 },
  T10: { iva: 10, ivaTipo: 1, ivaBase: 100 },
};

const leftZero = (valor, longitud) => String(valor ?? "").padStart(longitud, "0");

// Bug confirmado en xmlgen (jsonDeMain.service.js): `if (typeof params['tipoRegimen'] != undefined)`
// compara con el valor `undefined`, no con el string `"undefined"` — `typeof` siempre devuelve un
// string, asi que la condicion es SIEMPRE true y el tag `cTipReg` se emite aunque `tipoRegimen` no
// se haya pasado, quedando `<cTipReg/>` vacio. El XSD oficial (`DE_v150.xsd`, tipo `tcTipReg`) exige
// un digito `[1-8]` si el tag esta presente — un `<cTipReg/>` vacio no valida contra el XSD.
// `Empresa` no tiene hoy un campo `tipo_regimen` (regimenes especiales: turismo, importador,
// exportador, maquila, Ley 60/90, etc. — no aplica a la generalidad de las empresas), asi que no hay
// de donde tomar un valor real para pasarlo a xmlgen. Mientras tanto, se remueve el tag vacio despues
// de generar el XML (no se puede evitar que xmlgen lo escriba, ver bug arriba). Si en el futuro se
// agrega `Empresa.tipo_regimen`, pasar `params.tipoRegimen` con el codigo real en vez de confiar en
// este parche.
const repararCTipRegVacio = (xml) => xml.replace(/<cTipReg\s*\/>/, "").replace(/<cTipReg>\s*<\/cTipReg>/, "");

/**
 * Formatea una fecha como YYYY-MM-DDTHH:mm:ss (formato exigido por `data.fecha` de xmlgen,
 * validado con `isIsoDateTime`), en el momento real de Paraguay (`ZONA_HORARIA_PARAGUAY`) — no en
 * el timezone del proceso Node (ver AUD-002, STATIC_AUDIT_FINDINGS.json).
 * @param {Date} fecha
 * @returns {string}
 */
const formatearFechaHoraISO = (fecha) => dayjs(fecha).tz(ZONA_HORARIA_PARAGUAY).format("YYYY-MM-DDTHH:mm:ss");

/**
 * Formatea una fecha-calendario (sin componente horario significativo, p. ej. `Empresa.vigente_desde`)
 * como YYYY-MM-DD para `params.timbradoFecha`. A diferencia de `formatearFechaHoraISO`, NO convierte
 * a `ZONA_HORARIA_PARAGUAY`: el valor se persiste como medianoche UTC del día real, y convertirlo a
 * un huso horario negativo (UTC-3) corre la fecha un día hacia atrás — causa raíz de un rechazo SIFEN
 * real (1107 "Fecha de inicio de vigencia del timbrado incorrecta") reproducido y confirmado contra
 * el XML firmado (`<dFeIniT>` salía un día antes de `Empresa.vigente_desde`). Se lee el día calendario
 * tal cual está guardado (`dayjs.utc`), sin reinterpretarlo como un instante en otro huso horario.
 * @param {Date} fecha
 * @returns {string}
 */
const formatearFechaISO = (fecha) => dayjs.utc(fecha).format("YYYY-MM-DD");

/**
 * Arma el `params` de empresa (datos del emisor, estables entre documentos) que espera
 * `xmlgen.generateXMLDE`. Reusable entre Factura y NotaCredito.
 * @param {Object} empresa - Empresa de Prisma con `establecimientos` incluido
 * @returns {Object}
 */
const construirParamsEmpresa = (empresa) => {
  if (!empresa.tipo_contribuyente || !empresa.tipo_impuesto || !empresa.cod_actividad_principal) {
    throw new ErrorApp(
      "La empresa no tiene completos los datos fiscales SIFEN (tipo_contribuyente/tipo_impuesto/actividad economica) — ver desvio #3 de MIGRATION_PLAN.md",
      400
    );
  }
  if (!(empresa.ruc || "").includes("-")) {
    throw new ErrorApp("El RUC de la empresa debe incluir el digito verificador (formato NNNNNNNN-D)", 400);
  }
  if (!empresa.establecimientos || empresa.establecimientos.length === 0) {
    throw new ErrorApp("La empresa no tiene establecimientos configurados", 400);
  }

  const actividadesEconomicas = [
    { codigo: empresa.cod_actividad_principal, descripcion: empresa.desc_actividad_principal || "" },
  ];
  if (empresa.cod_actividad_secundaria) {
    actividadesEconomicas.push({
      codigo: empresa.cod_actividad_secundaria,
      descripcion: empresa.desc_actividad_secundaria || "",
    });
  }

  return {
    version: VERSION_FORMATO,
    ruc: empresa.ruc,
    razonSocial: empresa.nombre_empresa,
    tipoContribuyente: TIPO_CONTRIBUYENTE_SIFEN[empresa.tipo_contribuyente],
    timbradoNumero: empresa.timbrado,
    timbradoFecha: formatearFechaISO(new Date(empresa.vigente_desde)),
    actividadesEconomicas,
    establecimientos: empresa.establecimientos.map((establecimiento) => {
      const item = {
        codigo: leftZero(establecimiento.codigo, 3),
        denominacion: establecimiento.nombre,
        direccion: establecimiento.direccion,
        numeroCasa: establecimiento.numero_casa || "0",
        // xmlgen compara estos códigos contra su catálogo con === estricto (sin coerción numérica
        // en esta ruta puntual, a diferencia de data.cliente.*) — deben ser Number, no String, aunque
        // el schema los guarda como String (cod_departamento/cod_distrito/cod_ciudad).
        departamento: Number(establecimiento.cod_departamento),
        distrito: Number(establecimiento.cod_distrito),
        ciudad: Number(establecimiento.cod_ciudad),
      };
      if (establecimiento.telefono) {
        item.telefono = establecimiento.telefono;
      }
      // dEmailE es obligatorio en el XSD oficial (DE_v150.xsd, tgEmis) pero xmlgen solo lo emite si
      // recibe params.establecimientos[i].email (jsonDeMain.service.js) — sin `if` de validacion
      // propia que lo exija, omite el tag en silencio si falta. Establecimiento no tiene email propio
      // en el schema; se usa el de Empresa (campo obligatorio, no nullable) para los 3 (confirmado
      // por validacion XSD ad-hoc contra siRecepDE_v150.xsd — ver MIGRATION_PLAN.md).
      item.email = empresa.email;
      return item;
    }),
  };
};

/**
 * Mapea un Cliente de Prisma al `data.cliente` que espera xmlgen, según su `situacion_tributaria`.
 * Escapado de XML: no se hace acá — xml2js.Builder (usado internamente por xmlgen para serializar el
 * JSON a XML) escapa entities de texto por default; confirmado en la verificación ad-hoc de este
 * módulo (ver MIGRATION_PLAN.md). No replicar el antipatrón T (`.replace(/&/g, 'Y')`).
 * @param {Object} cliente - Cliente de Prisma
 * @returns {Object}
 */
const mapearCliente = (cliente) => {
  const contribuyente = cliente.situacion_tributaria === "CONTRIBUYENTE";
  const noDomiciliado = cliente.situacion_tributaria === "NO_DOMICILIADO";
  const tipoOperacion = TIPO_OPERACION_SIFEN[cliente.situacion_tributaria];

  const base = {
    contribuyente,
    tipoOperacion,
    razonSocial: cliente.razon_social || `${cliente.nombres} ${cliente.apellidos}`.trim(),
  };
  if (cliente.email) {
    base.email = cliente.email;
  }
  if (cliente.telefono) {
    base.telefono = cliente.telefono;
  }

  if (contribuyente) {
    return {
      ...base,
      pais: "PRY",
      ruc: cliente.ruc,
      tipoContribuyente: TIPO_CONTRIBUYENTE_CLIENTE_DEFAULT,
    };
  }

  if (noDomiciliado) {
    // Mismo tratamiento que la API PHP legacy (facturaService.js:404-410), pero sin el antipatrón
    // T de reemplazar '&' por 'Y' — el escape correcto de XML lo hace xml2js.Builder.
    return {
      ...base,
      pais: cliente.pais && cliente.pais !== "PRY" ? cliente.pais : "USA",
      direccion: cliente.direccion || "S/D",
      numeroCasa: 0,
    };
  }

  const documentoTipo = TIPO_DOCUMENTO_RECEPTOR_SIFEN[cliente.tipo_identificacion];
  if (!documentoTipo) {
    throw new ErrorApp(`Tipo de identificacion de cliente no soportado por SIFEN: ${cliente.tipo_identificacion}`, 400);
  }
  const resultado = {
    ...base,
    pais: "PRY",
    documentoTipo,
    documentoNumero: cliente.documento,
  };
  if (documentoTipo === TIPO_DOCUMENTO_RECEPTOR_SIFEN.IDENTIFICACION_TRIBUTARIA) {
    resultado.documentoTipoDescripcion = "Identificacion tributaria extranjera";
  }
  return resultado;
};

/**
 * Mapea un detalle (FacturaDetalle o NotaCreditoDetalle, misma forma) a un item de xmlgen.
 * @param {Object} detalle
 * @returns {Object}
 */
const mapearItem = (detalle) => {
  const tasa = TASA_SIFEN[detalle.tasa];
  if (!tasa) {
    throw new ErrorApp(`Tasa de IVA desconocida en el detalle: ${detalle.tasa}`, 400);
  }
  return {
    codigo: CODIGO_ITEM_DEFAULT,
    descripcion: detalle.descripcion,
    unidadMedida: UNIDAD_MEDIDA_DEFAULT,
    cantidad: detalle.cantidad,
    precioUnitario: detalle.precio_unitario,
    ivaTipo: tasa.ivaTipo,
    iva: tasa.iva,
    ivaBase: tasa.ivaBase,
  };
};

/**
 * Arma `data.condicion` a partir de la condición de venta de la Factura. Solo aplica a Factura
 * (tipoDocumento=1) — xmlgen no valida ni exige `condicion` para Nota de Crédito.
 * @param {"CONTADO"|"CREDITO"} condicionVenta
 * @param {number} total
 * @returns {Object}
 */
const mapearCondicion = (condicionVenta, total) => {
  if (condicionVenta === "CONTADO") {
    return {
      tipo: CONDICION_OPERACION_CONTADO,
      entregas: [{ tipo: CONDICION_PAGO_EFECTIVO, monto: total, moneda: "PYG" }],
    };
  }
  return {
    tipo: CONDICION_OPERACION_CREDITO,
    credito: { tipo: CREDITO_TIPO_PLAZO, plazo: PLAZO_CREDITO_DIAS_DEFAULT },
  };
};

/**
 * Valida el CDC ya calculado (por el caller, antes de invocar este módulo) como red de
 * verificación previa a mandarlo a xmlgen — ver `utils/sifen/cdc.js`. xmlgen reutiliza este CDC
 * tal cual si tiene 44 caracteres (no lo recalcula), así que un CDC corrupto acá se propagaría
 * silenciosamente al XML si no se lo valida antes.
 * @param {string} cdc
 */
const validarCdcOLanzar = (cdc) => {
  if (!validarCdc(cdc)) {
    throw new ErrorApp("El CDC del documento es invalido (formato o digito verificador incorrecto)", 400);
  }
};

/**
 * Arma los campos de `data` comunes a Factura y Nota de Crédito.
 */
const construirDataComun = ({ tipoDocumento, empresa, establecimientoCodigo, puntoCodigo, numero, fecha, cdc, cliente, detalles }) => {
  validarCdcOLanzar(cdc);
  return {
    tipoDocumento,
    tipoEmision: TIPO_EMISION_NORMAL,
    tipoTransaccion: TIPO_TRANSACCION_VENTA_MERCADERIA,
    tipoImpuesto: TIPO_IMPUESTO_SIFEN[empresa.tipo_impuesto],
    moneda: empresa.cod_moneda,
    fecha: formatearFechaHoraISO(new Date(fecha)),
    establecimiento: leftZero(establecimientoCodigo, 3),
    punto: leftZero(puntoCodigo, 3),
    numero: leftZero(numero, 7),
    cdc,
    cliente: mapearCliente(cliente),
    items: detalles.map(mapearItem),
  };
};

/**
 * Genera el XML sin firmar del Documento Electrónico (DE) de una Factura (tipoDocumento SIFEN = 1).
 * No firma, no persiste, no llama a SIFEN — ver `firmadorService.js` para la firma.
 * @param {Object} factura - Factura de Prisma con los siguientes includes cargados por el caller:
 *   `detalles`,
 *   `cliente_empresa.cliente`,
 *   `caja.establecimiento.empresa.establecimientos`
 *   (ej.: `prisma.factura.findUnique({ where: { id }, include: { detalles: true,
 *     cliente_empresa: { include: { cliente: true } },
 *     caja: { include: { establecimiento: { include: { empresa: { include: { establecimientos: true } } } } } }
 *   } })`)
 * @returns {Promise<string>} - XML del DE sin firmar
 */
const construirXmlFactura = async (factura) => {
  try {
    if (!factura.caja) {
      throw new ErrorApp("La Factura no tiene caja asignada, no se puede generar el XML SIFEN", 400);
    }
    const empresa = factura.caja.establecimiento.empresa;
    const params = construirParamsEmpresa(empresa);
    const data = {
      ...construirDataComun({
        tipoDocumento: TIPO_DOCUMENTO_FACTURA,
        empresa,
        establecimientoCodigo: factura.caja.establecimiento.codigo,
        puntoCodigo: factura.caja.codigo,
        numero: factura.numero_factura,
        fecha: factura.fecha_creacion,
        cdc: factura.cdc,
        cliente: factura.cliente_empresa.cliente,
        detalles: factura.detalles,
      }),
      factura: { presencia: INDICADOR_PRESENCIA_OPERACION_PRESENCIAL },
      condicion: mapearCondicion(factura.condicion_venta, factura.total),
      totalPago: factura.total,
    };
    return repararCTipRegVacio(await xmlgen.generateXMLDE(params, data));
  } catch (error) {
    ErrorApp.handleServiceError(error, "Error al generar el XML de la Factura");
  }
};

/**
 * Genera el XML sin firmar del Documento Electrónico (DE) de una Nota de Crédito
 * (tipoDocumento SIFEN = 5), asociada a la Factura que acredita.
 * @param {Object} notaCredito - NotaCredito de Prisma con los siguientes includes cargados:
 *   `nota_credito_detalle`,
 *   `factura.cdc` y `factura.cliente_empresa.cliente` (la Nota de Crédito no tiene relación propia
 *     a Cliente — el receptor es siempre el de la Factura que se acredita),
 *   `caja.establecimiento.empresa.establecimientos`
 *   (ej.: `prisma.notaCredito.findUnique({ where: { id }, include: { nota_credito_detalle: true,
 *     factura: { include: { cliente_empresa: { include: { cliente: true } } } },
 *     caja: { include: { establecimiento: { include: { empresa: { include: { establecimientos: true } } } } } }
 *   } })`)
 * @returns {Promise<string>} - XML del DE sin firmar
 */
const construirXmlNotaCredito = async (notaCredito) => {
  try {
    if (!notaCredito.caja) {
      throw new ErrorApp("La Nota de Credito no tiene caja asignada, no se puede generar el XML SIFEN", 400);
    }
    const empresa = notaCredito.caja.establecimiento.empresa;
    const params = construirParamsEmpresa(empresa);
    const data = {
      ...construirDataComun({
        tipoDocumento: TIPO_DOCUMENTO_NOTA_CREDITO,
        empresa,
        establecimientoCodigo: notaCredito.caja.establecimiento.codigo,
        puntoCodigo: notaCredito.caja.codigo,
        numero: notaCredito.numero_nota_credito,
        fecha: notaCredito.fecha_creacion,
        cdc: notaCredito.cdc,
        cliente: notaCredito.factura.cliente_empresa.cliente,
        detalles: notaCredito.nota_credito_detalle,
      }),
      notaCreditoDebito: { motivo: MOTIVO_NOTA_CREDITO_DEFAULT },
      documentoAsociado: {
        formato: DOCUMENTO_ASOCIADO_FORMATO_ELECTRONICO,
        cdc: notaCredito.factura.cdc,
      },
      totalPago: notaCredito.total,
    };
    return repararCTipRegVacio(await xmlgen.generateXMLDE(params, data));
  } catch (error) {
    ErrorApp.handleServiceError(error, "Error al generar el XML de la Nota de Credito");
  }
};

// Longitud exigida por xmlgen para el motivo del evento de cancelación (jsonEventoMain.service.js,
// eventosEmisorCancelacion) — se valida acá también para fallar con ErrorApp/400 en vez de dejar que
// xmlgen tire un Error genérico.
const MOTIVO_CANCELACION_LONGITUD_MIN = 5;
const MOTIVO_CANCELACION_LONGITUD_MAX = 500;

/**
 * Genera el XML del evento de Cancelación (tipoEvento SIFEN = 1), ya envuelto en el sobre SOAP
 * completo (`env:Envelope > env:Body > rEnviEventoDe > dEvReg > gGroupGesEve > rGesEve > rEve`) —
 * a diferencia de `construirXmlFactura`/`construirXmlNotaCredito`, que devuelven solo el nodo `DE`
 * suelto. Confirmado por lectura de código (`jsonEventoMain.service.js#eventosEmisorCancelacion`)
 * que el evento de cancelación solo necesita el CDC del documento y el motivo — no requiere datos de
 * empresa/establecimiento (SIFEN identifica al emisor por el certificado mTLS de la llamada SOAP, no
 * por un campo del evento).
 * Pipeline completo: este XML (sin firmar) → `firmadorService.firmarXmlEvento` (firma el nodo `rEve`
 * dentro del sobre, sin tocar el resto) → el resultado ya se puede pasar tal cual a
 * `sifenClientService.evento` (que espera el sobre SOAP completo, no solo el fragmento firmado — ver
 * comentario en `sifenClientService.js`/spike #2 de MIGRATION_PLAN.md).
 * @param {Object} datos
 * @param {number} datos.id - Identificador numérico de la solicitud (`dId` del sobre SOAP)
 * @param {string} datos.cdc - CDC (44 caracteres) del documento a cancelar
 * @param {string} datos.motivo - Motivo de la cancelación (5 a 500 caracteres, exigido por xmlgen)
 * @returns {Promise<string>} - Sobre SOAP completo con el evento sin firmar
 */
const construirXmlEventoCancelacion = async ({ id, cdc, motivo }) => {
  try {
    validarCdcOLanzar(cdc);
    const longitudMotivo = (motivo || "").length;
    if (longitudMotivo < MOTIVO_CANCELACION_LONGITUD_MIN || longitudMotivo > MOTIVO_CANCELACION_LONGITUD_MAX) {
      throw new ErrorApp(
        `El motivo de la cancelacion debe tener entre ${MOTIVO_CANCELACION_LONGITUD_MIN} y ${MOTIVO_CANCELACION_LONGITUD_MAX} caracteres`,
        400
      );
    }
    const params = { version: VERSION_FORMATO };
    const data = { cdc, motivo };
    return await xmlgen.generateXMLEventoCancelacion(id, params, data);
  } catch (error) {
    ErrorApp.handleServiceError(error, "Error al generar el XML del evento de cancelacion");
  }
};

module.exports = {
  construirXmlFactura,
  construirXmlNotaCredito,
  construirXmlEventoCancelacion,
};
