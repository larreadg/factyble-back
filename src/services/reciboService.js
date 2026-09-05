const { v4: uuidv4 } = require("uuid");
const dayjs = require("dayjs");
const path = require("path");
const fs = require("fs");
const { validationResult } = require("express-validator");
const prisma = require("../prisma/cliente");
const ErrorApp = require("../utils/error");
const { validadoresRecibo } = require("../validators/reciboValidators");
const { NumerosALetras } = require("numero-a-letras");
const { parseEntero } = require("../utils/number");
const { formatNumeroDocumento } = require("../utils/format");
const { formatearFechaCalendario } = require("../utils/fechaCalendario");
const { separarCajaEstablecimiento, parseNumeroCompuesto } = require("../utils/documento");
const { parsearFields, proyectar } = require("../utils/fields");
const { indexarPorIdExterno, armarRespuestaConsultaLote } = require("../utils/consultaLote");
const generarPdfRecibo = require("../utils/generarPdfRecibo");
const { enviarRecibo } = require("./correoService");
const { obtenerCertificadoActivo } = require("./sifen/certificadoService");
const { construirXmlRecibo } = require("../utils/reciboXml");
const { firmarXmlGenerico } = require("../utils/firmaXml");
const firmarPdf = require("../utils/firmarPdf");

// Directorio público donde generarPdfRecibo deja el PDF y donde también se escribe el .xml firmado.
const PUBLIC_DIR = path.resolve(__dirname, "..", "..", "public");

/**
 * Firma (best-effort) un recibo ya emitido: firma el PDF de forma invisible, construye y firma el XML propio
 * de Factyble, lo escribe en /public y persiste `xml_firmado`/`fecha_firma`. Un recibo de dinero NO es un
 * documento electrónico SIFEN (no hay DE/CDC ni envío a SET); esto es una firma propia con el certificado de
 * la empresa. Si la empresa no tiene certificado activo/vigente, o si la firma falla, el recibo YA quedó
 * emitido: se loguea y se devuelve null en vez de abortar (mismo criterio de aislamiento del resto del
 * pipeline). Devuelve el XML firmado (para adjuntarlo al correo) o null.
 */
const firmarRecibo = async ({
  recibo,
  reciboUuid,
  reciboId,
  empresa,
  receptor,
  documentos,
  cheques,
  transferencias,
  totales,
  concepto,
}) => {
  let certificado;
  try {
    certificado = await obtenerCertificadoActivo({ empresaId: empresa.id });
  } catch (error) {
    console.warn(
      `Recibo ${recibo.id}: se emite sin firma (sin certificado activo/vigente): ${error.message}`
    );
    return null;
  }

  try {
    // 1) Firma criptográfica invisible del PDF ya generado.
    const pdfPath = path.join(PUBLIC_DIR, `${reciboUuid}.pdf`);
    await firmarPdf({
      pdfPath,
      certificadoPath: certificado.archivo,
      certificadoPassword: certificado.clave,
      motivo: "Firma electronica del emisor",
      ubicacion: empresa.ciudad || "",
    });

    // 2) Construcción + firma del XML propio del recibo.
    const xml = construirXmlRecibo({
      reciboUuid,
      reciboId,
      fechaEmision: recibo.fecha_emision,
      concepto,
      emisor: {
        ruc: empresa.ruc,
        nombre: empresa.nombre_empresa,
        direccion: empresa.direccion,
        ciudad: empresa.ciudad,
        telefono: empresa.telefono,
        email: empresa.email,
        timbrado: empresa.timbrado,
      },
      receptor,
      documentos,
      cheques,
      transferencias,
      totalEfectivo: totales.totalEfectivo,
      totalCheques: totales.totalCheques,
      totalTransferencias: totales.totalTransferencias,
      total: totales.total,
      totalLetras: totales.totalLetras,
    });

    const xmlFirmado = await firmarXmlGenerico({
      xml,
      tag: "Recibo",
      certificadoPath: certificado.archivo,
      certificadoPassword: certificado.clave,
    });

    // 3) Persistir: .xml en /public (junto al PDF) + columna xml_firmado en BD.
    fs.writeFileSync(path.join(PUBLIC_DIR, `${reciboUuid}.xml`), xmlFirmado, "utf-8");
    await prisma.recibo.update({
      where: { id: recibo.id },
      data: { xml_firmado: xmlFirmado, fecha_firma: new Date() },
    });

    return xmlFirmado;
  } catch (error) {
    console.error(`Recibo ${recibo.id}: fallo al firmar (se emite sin firma):`, error);
    return null;
  }
};

// Lista cerrada de atributos de PRIMER NIVEL que el query param `fields` de los GET puede pedir para
// un Recibo. Columnas escalares + relaciones incluidas por los GET (cliente_empresa, facturas,
// notas_credito, cheques, transferencias, caja) + campos sintetizados en la respuesta (establecimiento).
// Cualquier field fuera de esta lista => 400. Ver src/utils/fields.js.
const CAMPOS_RECIBO = [
  "id", "numero_recibo", "recibo_uuid", "cliente_empresa_id", "usuario_id",
  "total_efectivo", "total_cheques", "total_transferencias", "total", "total_letras", "concepto",
  "id_externo", "fecha_emision", "fecha_creacion", "fecha_modificacion", "caja_id",
  "cliente_empresa", "facturas", "notas_credito", "cheques", "transferencias", "caja", "establecimiento",
];

// Lista cerrada de atributos que `fields` puede pedir en POST /recibo/id-externo/consultar-lote.
// Subconjunto deliberadamente más chico que CAMPOS_RECIBO: el endpoint resuelve hasta 100 recibos por
// request, así que deja afuera las relaciones (cliente_empresa, facturas, notas_credito, cheques,
// transferencias) y el `xml_firmado`. Quien necesite el recibo completo con sus documentos imputados
// tiene el GET unitario por id_externo. A diferencia de factura y nota de crédito no hay `estado`: un
// recibo NO es un documento electrónico SIFEN (no hay DE/CDC/timbrado ni envío a la SET), así que no
// tiene estado que consultar. Sin `fields` se devuelven todos estos atributos. Ver src/utils/fields.js.
const CAMPOS_CONSULTA_LOTE_RECIBO = [
  "id", "numero_recibo", "id_externo", "concepto", "total", "total_efectivo", "total_cheques",
  "total_transferencias", "total_letras", "fecha_emision", "fecha_creacion", "fecha_firma",
];

// Columnas que trae la consulta en lote. Es un `select` explícito (no un `include`) para que el
// payload quede acotado a CAMPOS_CONSULTA_LOTE_RECIBO aun cuando no se pase `fields`. `caja` entra
// solo para poder formatear el número impreso y se descarta después.
const SELECT_CONSULTA_LOTE_RECIBO = {
  id: true,
  numero_recibo: true,
  id_externo: true,
  concepto: true,
  total: true,
  total_efectivo: true,
  total_cheques: true,
  total_transferencias: true,
  total_letras: true,
  fecha_emision: true,
  fecha_creacion: true,
  fecha_firma: true,
  caja: {
    select: {
      codigo: true,
      establecimiento: { select: { codigo: true } },
    },
  },
};

const isEmailValido = (email) => {
  if (!email) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim());
};

const normalizarTipo = (tipo) =>
  String(tipo ?? "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[_-]/g, " ")
    .replace(/\s+/g, " ")
    .toUpperCase();

const normalizarTipoDocumento = (tipo) => {
  const valor = normalizarTipo(tipo);
  if (valor === "FACTURA") return "FACTURA";
  if (valor === "NOTA DE CREDITO") return "NOTA_CREDITO";
  return null;
};

const normalizarTipoMedioPago = (tipo) => {
  const valor = normalizarTipo(tipo);
  if (valor === "CHEQUE") return "CHEQUE";
  if (valor === "TRANSFERENCIA") return "TRANSFERENCIA";
  return null;
};

/**
 * @typedef {Object} ReciboChequeInput
 * @property {string} banco - Nombre del banco del cheque.
 * @property {string} numero - Numero de cheque.
 * @property {string|number} monto - Monto del cheque en formato entero (sin decimales).
 * @property {string} tipo - Tipo de medio bancario (CHEQUE o TRANSFERENCIA).
 */

/**
 * @typedef {Object} ReciboFacturaInput
 * @property {string} numeroFactura - Numero de factura recibido desde frontend.
 * @property {string|number} montoAplicado - Monto aplicado a esa factura en formato entero.
 * @property {string} tipo - Tipo de documento (FACTURA o NOTA DE CREDITO).
 */

/**
 * @typedef {Object} EmitirReciboInput
 * @property {ReciboChequeInput[]} cheques - Lista de cheques recibidos.
 * @property {string|number} totalEfectivo - Total de efectivo recibido en formato entero.
 * @property {string} concepto - Concepto del recibo.
 * @property {ReciboFacturaInput[]} facturas - Facturas a imputar dentro del recibo.
 * @property {string} caja - Codigo de caja con formato 3 digitos (001-999).
 * @property {string} establecimiento - Codigo de establecimiento con formato 3 digitos (001-999).
 * @property {string} ruc - RUC del cliente.
 * @property {string} razonSocial - Razon social del cliente.
 * @property {string} email - Email del cliente.
 */

/**
 * @typedef {Object} UsuarioJwtData
 * @property {number|string} id - ID del usuario autenticado.
 * @property {number|string} empresaId - ID de empresa del usuario autenticado.
 * @property {string[]} roles - Roles asignados al usuario.
 */

/**
 * Define el contrato del servicio para emision de recibo.
 *
 * Responsabilidades:
 * - Resolver usuario desde JWT (datosUsuario).
 * - Buscar o crear cliente para construir cliente_empresa.
 * - Buscar establecimiento y caja por codigo.
 * - Buscar y validar documentos por numero (factura / nota de credito).
 * - Calcular totales (efectivo, cheques, transferencias, total y total_letras).
 * - Persistir Recibo y sus detalles de documentos/medios de pago.
 *
 * @param {EmitirReciboInput} datos - Payload de entrada del recibo.
 * @param {UsuarioJwtData} datosUsuario - Datos del usuario autenticado desde JWT.
 * @returns {Promise<any>} Recibo generado (estructura final por definir en implementacion).
 */
const emitirRecibo = async (datos, datosUsuario) => {
  try {
    const rucTexto = String(datos.ruc ?? "").trim();
    const esRucConDv = /^\d+-\d+$/.test(rucTexto);
    const esCedula = /^\d+$/.test(rucTexto);

    if (!esRucConDv && !esCedula) {
      throw new ErrorApp("Parametro ruc invalido", 400);
    }

    const tipoIdentificacion = esRucConDv ? "RUC" : "CEDULA";
    const situacionTributaria = esRucConDv
      ? "CONTRIBUYENTE"
      : "NO_CONTRIBUYENTE";
    const dv = esRucConDv ? Number(rucTexto.split("-")[1]) : null;

    // Buscar establecimiento
    const establecimiento = await prisma.establecimiento.findFirst({
      where: {
        codigo: datos.establecimiento,
        empresa_id: Number(datosUsuario.empresaId),
      },
    });

    if (!establecimiento) {
      throw new ErrorApp("No se encontro establecimiento", 404);
    }

    // Buscar caja para establecimiento
    const caja = await prisma.caja.findFirst({
      where: {
        codigo: datos.caja,
        establecimiento_id: establecimiento.id,
      },
    });

    if (!caja) {
      throw new ErrorApp("No se encontro caja", 404);
    }

    // Buscar usuario
    const usuario = await prisma.usuario.findFirst({
      where: { id: Number(datosUsuario.id) },
      include: { empresa: true },
    });

    if (!usuario) {
      throw new ErrorApp("Usuario no encontrado", 404);
    }

    // Buscar cliente por RUC y crear si no existe
    let cliente = await prisma.cliente.findFirst({
      where: { ruc: rucTexto },
    });

    const nombres = datos.razonSocial.includes(",")
      ? (datos.razonSocial.split(",")[1]
          ? datos.razonSocial.split(",")[1].trim()
          : datos.razonSocial)
      : datos.razonSocial;
    const apellidos = datos.razonSocial.includes(",")
      ? (datos.razonSocial.split(",")[0]
          ? datos.razonSocial.split(",")[0].trim()
          : "")
      : "";

    if (!cliente) {
      cliente = await prisma.cliente.create({
        data: {
          ruc: rucTexto,
          documento: rucTexto,
          dv,
          razon_social: datos.razonSocial,
          tipo_identificacion: tipoIdentificacion,
          nombres,
          apellidos,
          email: datos.email,
          situacion_tributaria: situacionTributaria,
          pais: "PRY",
        },
      });
    } else {
      // Actualizar datos de cliente para mantener consistencia operativa
      await prisma.cliente.update({
        where: { id: cliente.id },
        data: {
          documento: rucTexto,
          dv,
          razon_social: datos.razonSocial,
          tipo_identificacion: tipoIdentificacion,
          situacion_tributaria: situacionTributaria,
          nombres: nombres || cliente.nombres,
          apellidos: apellidos || cliente.apellidos,
          email: datos.email || cliente.email,
        },
      });
    }

    // Buscar o crear cliente_empresa
    let clienteEmpresa = await prisma.clienteEmpresa.findFirst({
      where: {
        AND: [{ cliente_id: cliente.id }, { empresa_id: usuario.empresa_id }],
      },
    });

    if (!clienteEmpresa) {
      clienteEmpresa = await prisma.clienteEmpresa.create({
        data: {
          cliente_id: cliente.id,
          empresa_id: usuario.empresa_id,
        },
      });
    }

    // Validar documentos de entrada (factura / nota de credito)
    if (!Array.isArray(datos.facturas) || datos.facturas.length === 0) {
      throw new ErrorApp("Debe proporcionar al menos una factura o nota de credito", 400);
    }

    const documentosNormalizados = datos.facturas.map((d) => ({
      tipoDocumento: normalizarTipoDocumento(d.tipo),
      numeroDocumento: String(d.numeroFactura || "").trim(),
      numeroDocumentoNumerico: Number(String(d.numeroFactura || "").replace(/^0+/, "") || "0"),
      montoAplicado: parseEntero(d.montoAplicado, "facturas.montoAplicado", { min: 1 }),
    }));

    if (
      documentosNormalizados.some(
        (d) =>
          !d.tipoDocumento ||
          !d.numeroDocumento ||
          Number.isNaN(d.numeroDocumentoNumerico) ||
          d.numeroDocumentoNumerico <= 0
      )
    ) {
      throw new ErrorApp("Documentos del recibo invalidos", 400);
    }

    const documentosDuplicados = new Set();
    for (const d of documentosNormalizados) {
      const key = `${d.tipoDocumento}:${d.numeroDocumentoNumerico}`;
      if (documentosDuplicados.has(key)) {
        throw new ErrorApp("No se permiten documentos duplicados en el recibo", 400);
      }
      documentosDuplicados.add(key);
    }

    const facturasNormalizadas = documentosNormalizados.filter(
      (d) => d.tipoDocumento === "FACTURA"
    );
    const notasCreditoNormalizadas = documentosNormalizados.filter(
      (d) => d.tipoDocumento === "NOTA_CREDITO"
    );

    // Acotado a la CAJA del recibo (caja.id), no solo a la empresa: `numero_factura` es único por caja,
    // no por empresa (se repite entre cajas — ver reintentarEnvioSifen). El input solo trae el número,
    // sin establecimiento/caja por documento, así que la caja del recibo es el único desambiguador; sin
    // este filtro, en una empresa con varias cajas la búsqueda podía traer más de una factura con el
    // mismo número (rechazo espurio) o imputar el pago a la factura equivocada. caja_id ya implica la
    // empresa (caja -> establecimiento -> empresa); se mantiene el filtro de empresa como defensa extra.
    const facturasDb =
      facturasNormalizadas.length > 0
        ? await prisma.factura.findMany({
            where: {
              numero_factura: {
                in: facturasNormalizadas.map((f) => f.numeroDocumentoNumerico),
              },
              caja_id: caja.id,
              cliente_empresa: {
                empresa_id: usuario.empresa_id,
              },
            },
          })
        : [];

    if (facturasDb.length !== facturasNormalizadas.length) {
      throw new ErrorApp("Una o mas facturas no fueron encontradas", 404);
    }

    for (const factura of facturasDb) {
      if (factura.sifen_estado === "Cancelado") {
        throw new ErrorApp(
          `La factura ${factura.numero_factura} se encuentra cancelada`,
          400
        );
      }
    }

    // Mismo criterio que las facturas: `numero_nota_credito` es único por caja, no por empresa, y el
    // input solo trae el número — se acota a la caja del recibo (caja.id) para evitar ambigüedad.
    const notasCreditoDb =
      notasCreditoNormalizadas.length > 0
        ? await prisma.notaCredito.findMany({
            where: {
              numero_nota_credito: {
                in: notasCreditoNormalizadas.map((n) => n.numeroDocumentoNumerico),
              },
              caja_id: caja.id,
              factura: {
                cliente_empresa: {
                  empresa_id: usuario.empresa_id,
                },
              },
            },
          })
        : [];

    if (notasCreditoDb.length !== notasCreditoNormalizadas.length) {
      throw new ErrorApp("Una o mas notas de credito no fueron encontradas", 404);
    }

    for (const nota of notasCreditoDb) {
      if (["Cancelado", "Rechazado"].includes(nota.sifen_estado)) {
        throw new ErrorApp(
          `La nota de credito ${nota.numero_nota_credito} no puede aplicarse por su estado`,
          400
        );
      }
    }

    // Validar medios de pago (cheques / transferencias) y totales
    const mediosBancarios = Array.isArray(datos.cheques) ? datos.cheques : [];
    const totalEfectivo = parseEntero(datos.totalEfectivo || 0, "totalEfectivo");

    const mediosNormalizados = mediosBancarios.map((m) => ({
      tipoMedio: normalizarTipoMedioPago(m.tipo),
      banco: String(m.banco || "").trim(),
      numeroReferencia: String(m.numero || "").trim(),
      monto: parseEntero(m.monto, "cheques.monto"),
    }));

    if (
      mediosNormalizados.some(
        (m) => !m.tipoMedio || !m.banco || !m.numeroReferencia
      )
    ) {
      throw new ErrorApp("Datos de medios bancarios invalidos", 400);
    }

    const chequesNormalizados = mediosNormalizados.filter(
      (m) => m.tipoMedio === "CHEQUE"
    );
    const transferenciasNormalizadas = mediosNormalizados.filter(
      (m) => m.tipoMedio === "TRANSFERENCIA"
    );

    const totalCheques = chequesNormalizados.reduce((acc, c) => acc + c.monto, 0);
    const totalTransferencias = transferenciasNormalizadas.reduce(
      (acc, t) => acc + t.monto,
      0
    );
    const totalFacturas = facturasNormalizadas.reduce(
      (acc, f) => acc + f.montoAplicado,
      0
    );
    const totalNotasCredito = notasCreditoNormalizadas.reduce(
      (acc, n) => acc + n.montoAplicado,
      0
    );
    const totalAplicado = totalFacturas - totalNotasCredito;

    if (totalAplicado <= 0) {
      throw new ErrorApp(
        "El total aplicado (facturas - notas de credito) debe ser mayor a cero",
        400
      );
    }

    const totalRecibo = totalEfectivo + totalCheques + totalTransferencias;

    if (totalRecibo !== totalAplicado) {
      throw new ErrorApp(
        "El total recibido (efectivo + cheques + transferencias) no coincide con el monto aplicado (facturas - notas de credito)",
        400
      );
    }

    const reciboUuid = uuidv4();
    const totalReciboString = `${totalRecibo}.00`;
    const totalEfectivoString = `${totalEfectivo}.00`;
    const totalChequesString = `${totalCheques}.00`;
    const totalTransferenciasString = `${totalTransferencias}.00`;
    const totalLetras = NumerosALetras(totalRecibo)
      .replace(/\s*Pesos\s*\d{2}\/100\s*M\.N\.\s*$/i, " Guaranies")
      .trim();

    const recibo = await prisma.$transaction(async (tx) => {
      const secuencia =
        await tx.$queryRaw`SELECT valor FROM secuencia_recibo WHERE caja_id = ${caja.id} FOR UPDATE`;

      if (!secuencia || secuencia.length === 0) {
        throw new ErrorApp("Secuencia de recibo no encontrada", 404);
      }

      const numeroRecibo = Number(secuencia[0].valor) + 1;
      await tx.$executeRaw`UPDATE secuencia_recibo SET valor = ${numeroRecibo} WHERE caja_id = ${caja.id}`;

      const reciboCreado = await tx.recibo.create({
        data: {
          numero_recibo: numeroRecibo,
          recibo_uuid: reciboUuid,
          cliente_empresa_id: clienteEmpresa.id,
          usuario_id: usuario.id,
          total_efectivo: totalEfectivoString,
          total_cheques: totalChequesString,
          total_transferencias: totalTransferenciasString,
          total: totalReciboString,
          total_letras: totalLetras,
          concepto: datos.concepto,
          id_externo: datos.idExterno || null,
          caja_id: caja.id,
        },
      });

      const mapaFacturaPorNumero = new Map(
        facturasDb.map((f) => [f.numero_factura, f.id])
      );

      if (facturasNormalizadas.length > 0) {
        await tx.reciboFactura.createMany({
          data: facturasNormalizadas.map((f) => ({
            recibo_id: reciboCreado.id,
            factura_id: mapaFacturaPorNumero.get(f.numeroDocumentoNumerico),
            monto_aplicado: `${f.montoAplicado}.00`,
          })),
        });
      }

      const mapaNotaCreditoPorNumero = new Map(
        notasCreditoDb.map((n) => [n.numero_nota_credito, n.id])
      );

      if (notasCreditoNormalizadas.length > 0) {
        await tx.reciboNotaCredito.createMany({
          data: notasCreditoNormalizadas.map((n) => ({
            recibo_id: reciboCreado.id,
            nota_credito_id: mapaNotaCreditoPorNumero.get(n.numeroDocumentoNumerico),
            monto_aplicado: `${n.montoAplicado}.00`,
          })),
        });
      }

      if (chequesNormalizados.length > 0) {
        await tx.reciboCheque.createMany({
          data: chequesNormalizados.map((c) => ({
            recibo_id: reciboCreado.id,
            banco: c.banco,
            numero_cheque: c.numeroReferencia,
            monto: `${c.monto}.00`,
          })),
        });
      }

      if (transferenciasNormalizadas.length > 0) {
        await tx.reciboTransferencia.createMany({
          data: transferenciasNormalizadas.map((t) => ({
            recibo_id: reciboCreado.id,
            banco: t.banco,
            numero_referencia: t.numeroReferencia,
            monto: `${t.monto}.00`,
          })),
        });
      }

      return reciboCreado;
    });

    const reciboId = formatNumeroDocumento(datos.establecimiento, datos.caja, recibo.numero_recibo);

    await generarPdfRecibo({
      empresaLogo: usuario.empresa.logo,
      empresaFirma: `${usuario.empresa.ruc}.png`,
      reciboUuid,
      reciboId,
      ds: documentosNormalizados.map((d) => ({
        facturaNumero:
          d.tipoDocumento === "FACTURA"
            ? `FACTURA ${d.numeroDocumento}`
            : `NOTA DE CREDITO ${d.numeroDocumento} (DESCUENTO)`,
        importe: d.montoAplicado,
      })),
      dsCheque: [
        ...chequesNormalizados.map((c) => ({
          banco: c.banco,
          chequeNumero: `CHEQUE ${c.numeroReferencia}`,
          total: c.monto,
        })),
        ...transferenciasNormalizadas.map((t) => ({
          banco: t.banco,
          chequeNumero: `TRANSFERENCIA ${t.numeroReferencia}`,
          total: t.monto,
        })),
      ],
      fechaHora: dayjs().format("YYYY-MM-DD HH:mm:ss"),
      ruc: rucTexto,
      razonSocial: datos.razonSocial,
      correoElectronico: datos.email,
      total: totalRecibo,
      empresaRuc: usuario.empresa.ruc,
      empresaTimbrado: usuario.empresa.timbrado,
      // dayjs.utc, no local: ver formatearFechaCalendario (el valor es medianoche UTC del día real y
      // en UTC-3 los getters locales devuelven el día anterior).
      empresaVigenteDesde: formatearFechaCalendario(usuario.empresa.vigente_desde),
      empresaNombre: usuario.empresa.nombre_empresa,
      empresaDireccion: usuario.empresa.direccion,
      empresaCorreoElectronico: usuario.empresa.email,
      empresaCiudad: usuario.empresa.ciudad,
      empresaTelefono: usuario.empresa.telefono,
      tipoDocumento: "RECIBO DE DINERO",
      tipoDocumentoTop: "Recibo de Dinero",
      totalEfectivo,
      totalLetras,
      concepto: datos.concepto,
    });

    // Firma (best-effort) del PDF + generación/firma del XML propio. Se hace después de generar el PDF y de
    // committear el recibo: si no hay certificado o la firma falla, el recibo igual queda emitido.
    const xmlFirmado = await firmarRecibo({
      recibo,
      reciboUuid,
      reciboId,
      empresa: usuario.empresa,
      receptor: { ruc: rucTexto, razonSocial: datos.razonSocial, email: datos.email },
      documentos: documentosNormalizados,
      cheques: chequesNormalizados,
      transferencias: transferenciasNormalizadas,
      totales: {
        totalEfectivo,
        totalCheques,
        totalTransferencias,
        total: totalRecibo,
        totalLetras,
      },
      concepto: datos.concepto,
    });

    if (isEmailValido(datos.email)) {
      await enviarRecibo({
        email: datos.email,
        cliente: datos.razonSocial,
        uuid: reciboUuid,
        reciboId,
        nroRecibo: recibo.numero_recibo,
        empresa: usuario.empresa.nombre_empresa,
        emailEmpresa: usuario.empresa.email,
        xmlFirmado,
      });
    } else {
      console.warn(
        `Recibo ${recibo.id}: no se envio correo por email de cliente invalido o ausente`
      );
    }

    return recibo;
  } catch (error) {
    ErrorApp.handleServiceError(error, "Error al emitir recibo");
  }
};

// Formatea, con el mismo criterio del PDF (establecimiento-caja-numero, relleno a 7 dígitos), tanto el
// número del recibo como los números de las facturas/notas de crédito imputadas. Cae al número crudo
// cuando no se puede formatear (documentos legacy con caja_id NULL). Se centraliza acá porque getRecibos
// y getReciboByIdExterno devuelven exactamente la misma forma.
const formatearNumerosRecibo = (recibo) => ({
  ...recibo,
  numero_recibo: formatNumeroDocumento(
    recibo.caja?.establecimiento?.codigo,
    recibo.caja?.codigo,
    recibo.numero_recibo
  ) ?? recibo.numero_recibo,
  // Expone caja y establecimiento como campos hermanos del documento.
  ...separarCajaEstablecimiento(recibo.caja),
  facturas: recibo.facturas.map((rf) => ({
    ...rf,
    factura: rf.factura && {
      ...rf.factura,
      numero_factura: formatNumeroDocumento(
        rf.factura.caja?.establecimiento?.codigo,
        rf.factura.caja?.codigo,
        rf.factura.numero_factura
      ) ?? rf.factura.numero_factura,
    },
  })),
  notas_credito: recibo.notas_credito.map((rnc) => ({
    ...rnc,
    nota_credito: rnc.nota_credito && {
      ...rnc.nota_credito,
      numero_nota_credito: formatNumeroDocumento(
        rnc.nota_credito.caja?.establecimiento?.codigo,
        rnc.nota_credito.caja?.codigo,
        rnc.nota_credito.numero_nota_credito
      ) ?? rnc.nota_credito.numero_nota_credito,
    },
  })),
});

const getRecibos = async (page = 1, itemsPerPage = 10, filter = null, empresaId, fields = null) => {
  try {
    const campos = parsearFields(fields);
    const skip = (page - 1) * itemsPerPage;
    const take = itemsPerPage;

    const clienteEmpresas = await prisma.clienteEmpresa.findMany({
      where: {
        cliente: {
          ...(filter && {
            OR: [
              { ruc: { contains: filter } },
              { documento: { contains: filter } },
              { nombres: { contains: filter } },
              { apellidos: { contains: filter } },
              { razon_social: { contains: filter } },
              { email: { contains: filter } },
            ],
          }),
        },
        empresa_id: empresaId,
      },
      select: {
        id: true,
      },
    });

    const clienteEmpresaIds = clienteEmpresas.map((ce) => ce.id);

    const whereRecibos = (() => {
      const base = { cliente_empresa: { empresa_id: empresaId } };

      if (!filter) {
        return base;
      }

      const or = [];

      if (clienteEmpresaIds.length > 0) {
        or.push({ cliente_empresa_id: { in: clienteEmpresaIds } });
      }

      or.push({ recibo_uuid: { contains: filter } });
      or.push({ concepto: { contains: filter } });

      // Match por número compuesto establecimiento-caja-numero (ej. "001-001-0000023"), tal como se
      // imprime/muestra el recibo. Se resuelve contra la relación caja/establecimiento + numero_recibo.
      const compuesto = parseNumeroCompuesto(filter);
      if (compuesto) {
        or.push({
          numero_recibo: compuesto.numero,
          caja: {
            codigo: compuesto.caja,
            establecimiento: { codigo: compuesto.establecimiento },
          },
        });
      }

      const isIntegerString = /^[0-9]+$/.test(filter);
      if (isIntegerString && filter.length <= 18) {
        const n = Number(filter);
        if (Number.isSafeInteger(n)) {
          or.push({ numero_recibo: { equals: n } });
        }
      }

      return { ...base, OR: or };
    })();

    const recibos = await prisma.recibo.findMany({
      skip,
      take,
      orderBy: {
        fecha_creacion: "desc",
      },
      where: whereRecibos,
      include: {
        cliente_empresa: {
          include: {
            cliente: true,
          },
        },
        facturas: {
          include: {
            factura: {
              select: {
                id: true,
                numero_factura: true,
                total: true,
                cdc: true,
                sifen_estado: true,
                caja: {
                  select: {
                    codigo: true,
                    establecimiento: { select: { codigo: true } },
                  },
                },
              },
            },
          },
        },
        notas_credito: {
          include: {
            nota_credito: {
              select: {
                id: true,
                numero_nota_credito: true,
                total: true,
                cdc: true,
                sifen_estado: true,
                caja: {
                  select: {
                    codigo: true,
                    establecimiento: { select: { codigo: true } },
                  },
                },
              },
            },
          },
        },
        cheques: true,
        transferencias: true,
        caja: {
          include: {
            establecimiento: true,
          },
        },
      },
    });

    const totalItems = await prisma.recibo.count({
      where: whereRecibos,
    });

    return {
      items: recibos.map((recibo) => proyectar(formatearNumerosRecibo(recibo), campos)),
      page,
      itemsPerPage,
      totalItems,
    };
  } catch (error) {
    ErrorApp.handleServiceError(error, "Error al obtener recibos");
  }
};

// Búsqueda por id_externo (identificador de correlación con un sistema externo) ACOTADA a la empresa
// del usuario autenticado (cliente_empresa.empresa_id). id_externo no es único: si hubiera varios
// recibos con el mismo valor se devuelve el más reciente (orderBy id desc). Devuelve el mismo detalle
// que getRecibos (documentos imputados, medios de pago y caja/establecimiento).
const getReciboByIdExterno = async (idExterno, empresaId, fields = null) => {
  try {
    const campos = parsearFields(fields);
    const recibo = await prisma.recibo.findFirst({
      where: {
        id_externo: idExterno,
        cliente_empresa: { empresa_id: empresaId },
      },
      orderBy: { id: "desc" },
      include: {
        cliente_empresa: {
          include: {
            cliente: true,
          },
        },
        facturas: {
          include: {
            factura: {
              select: {
                id: true,
                numero_factura: true,
                total: true,
                cdc: true,
                sifen_estado: true,
                caja: {
                  select: {
                    codigo: true,
                    establecimiento: { select: { codigo: true } },
                  },
                },
              },
            },
          },
        },
        notas_credito: {
          include: {
            nota_credito: {
              select: {
                id: true,
                numero_nota_credito: true,
                total: true,
                cdc: true,
                sifen_estado: true,
                caja: {
                  select: {
                    codigo: true,
                    establecimiento: { select: { codigo: true } },
                  },
                },
              },
            },
          },
        },
        cheques: true,
        transferencias: true,
        caja: {
          include: {
            establecimiento: true,
          },
        },
      },
    });

    if (!recibo) {
      throw new ErrorApp(`Recibo con id externo ${idExterno} no encontrado`, 404);
    }

    return proyectar(formatearNumerosRecibo(recibo), campos);
  } catch (error) {
    ErrorApp.handleServiceError(error, "Error al obtener recibo");
  }
};

// Alta masiva de recibos (carga por planilla): el caller manda un array de objetos, cada uno con el mismo shape
// que POST /recibo (recibo no tiene versión "simple"). Se devuelve un array espejo `resultados` en el MISMO
// orden que la entrada, donde el elemento en la posición `i` corresponde al recibo `i`. El procesamiento es
// deliberadamente secuencial: emitirRecibo numera con un UPDATE transaccional sobre la secuencia del recibo, así
// que serializar evita carreras de numeración. Cada recibo se valida y emite de forma aislada: un ítem inválido
// o una emisión fallida produce un resultado de error propio sin abortar el resto del lote (mismo criterio de
// aislamiento por documento que facturaSimpleService.emitirFacturasBulk).
const emitirRecibosBulk = async (recibos, datosUsuario) => {
  try {
    const resultados = [];

    for (let i = 0; i < recibos.length; i++) {
      // Se valida cada elemento reutilizando exactamente las reglas de POST /recibo, corriéndolas de forma
      // imperativa contra un req sintético `{ body: item }`. Los sanitizers (p. ej. idExterno a string) mutan
      // ese body, por eso a emitirRecibo se le pasa `reqItem.body` ya saneado.
      const reqItem = { body: recibos[i] };

      for (const validador of validadoresRecibo) {
        await validador.run(reqItem);
      }

      const errores = validationResult(reqItem);
      if (!errores.isEmpty()) {
        resultados.push({
          indice: i,
          status: "error",
          code: 400,
          message: "Error de validación",
          errores: errores.array(),
          data: null,
        });
        continue;
      }

      try {
        const data = await emitirRecibo(reqItem.body, datosUsuario);
        resultados.push({
          indice: i,
          status: "success",
          code: 200,
          message: "Recibo creado",
          errores: null,
          data,
        });
      } catch (error) {
        const { code, message } = ErrorApp.handleControllerError(error, "Error al crear recibo");
        resultados.push({
          indice: i,
          status: "error",
          code,
          message,
          errores: null,
          data: null,
        });
      }
    }

    const exitosas = resultados.filter((r) => r.status === "success").length;

    return {
      resumen: {
        total: resultados.length,
        exitosas,
        fallidas: resultados.length - exitosas,
      },
      resultados,
    };
  } catch (error) {
    ErrorApp.handleServiceError(error, "Error al procesar recibos en lote");
  }
};

// Versión en lote de getReciboByIdExterno: resuelve hasta 100 `id_externo` en una sola consulta.
// Devuelve un ítem por cada valor pedido, en el MISMO orden y conservando duplicados; los que no
// existen (o son de otra empresa) vienen con `encontrado: false` en vez de cortar la respuesta con un
// 404 — un id_externo inexistente no puede tumbar la consulta de los otros. Ver utils/consultaLote.js.
const consultarRecibosPorIdExterno = async (numeros, empresaId, fields = null) => {
  try {
    const campos = parsearFields(fields);
    // Se consulta una sola vez con el set único; el orden y los duplicados de la request se
    // reconstruyen después sobre el índice.
    const unicos = [...new Set(numeros)];

    const recibos = await prisma.recibo.findMany({
      where: {
        id_externo: { in: unicos },
        // Mismo acotamiento por empresa que getReciboByIdExterno. Ojo: el recibo se acota por
        // cliente_empresa.empresa_id (no por usuario.empresa_id como factura/nota de crédito) —
        // es el criterio que ya usan todas las lecturas de este servicio, no cambiarlo acá.
        cliente_empresa: { empresa_id: empresaId },
      },
      // ASC a propósito: ante varios recibos con el mismo id_externo (la columna no es única), el
      // último `set` del índice gana, y ese es el de mayor id — el mismo recibo que devuelve el GET
      // unitario con su `orderBy: { id: "desc" }`.
      orderBy: { id: "asc" },
      select: SELECT_CONSULTA_LOTE_RECIBO,
    });

    const indice = indexarPorIdExterno(
      recibos.map(({ caja, ...recibo }) => ({
        ...recibo,
        // Número tal como se imprime en el PDF (establecimiento-caja-numero, relleno a 7 dígitos).
        // Cae al número crudo cuando no se puede formatear (recibos legacy con caja_id NULL).
        numero_recibo: formatNumeroDocumento(
          caja?.establecimiento?.codigo,
          caja?.codigo,
          recibo.numero_recibo
        ) ?? recibo.numero_recibo,
      }))
    );

    return armarRespuestaConsultaLote(numeros, indice, campos);
  } catch (error) {
    ErrorApp.handleServiceError(error, "Error al consultar recibos por id externo");
  }
};

module.exports = {
  emitirRecibo,
  emitirRecibosBulk,
  getRecibos,
  getReciboByIdExterno,
  consultarRecibosPorIdExterno,
  CAMPOS_RECIBO,
  CAMPOS_CONSULTA_LOTE_RECIBO,
};
