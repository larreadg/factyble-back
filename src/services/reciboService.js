const { v4: uuidv4 } = require("uuid");
const dayjs = require("dayjs");
const prisma = require("../prisma/cliente");
const ErrorApp = require("../utils/error");
const { NumerosALetras } = require("numero-a-letras");
const { parseEntero } = require("../utils/number");
const { formatNumberWithLeadingZeros } = require("../utils/format");
const generarPdfRecibo = require("../utils/generarPdfRecibo");
const firmarPdf = require("../utils/firmarPdf");
const generarXmlRecibo = require("../utils/generarXmlRecibo");
const firmarXml = require("../utils/firmarXml");
const { enviarRecibo } = require("./correoService");

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

    const facturasDb =
      facturasNormalizadas.length > 0
        ? await prisma.factura.findMany({
            where: {
              numero_factura: {
                in: facturasNormalizadas.map((f) => f.numeroDocumentoNumerico),
              },
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

    const notasCreditoDb =
      notasCreditoNormalizadas.length > 0
        ? await prisma.notaCredito.findMany({
            where: {
              numero_nota_credito: {
                in: notasCreditoNormalizadas.map((n) => n.numeroDocumentoNumerico),
              },
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

    const reciboId = `${datos.establecimiento}-${datos.caja}-${formatNumberWithLeadingZeros(recibo.numero_recibo)}`;
    const fechaHora = dayjs().format("YYYY-MM-DD HH:mm:ss");

    const { outputPath: pdfPath } = await generarPdfRecibo({
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
      fechaHora,
      ruc: rucTexto,
      razonSocial: datos.razonSocial,
      correoElectronico: datos.email,
      total: totalRecibo,
      empresaRuc: usuario.empresa.ruc,
      empresaTimbrado: usuario.empresa.timbrado,
      empresaVigenteDesde: dayjs(usuario.empresa.vigente_desde).format("YYYY-MM-DD"),
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

    // Firma digital (invisible) del PDF con el certificado .p12 de la empresa.
    // Si la empresa no tiene certificado, se emite el recibo sin firmar.
    try {
      const resultadoFirma = await firmarPdf({
        pdfPath,
        certPath: usuario.empresa.cert_path,
        certPw: usuario.empresa.cert_pw,
        reason: `Recibo Nro. ${reciboId}`,
        name: usuario.empresa.nombre_empresa,
        location: usuario.empresa.ciudad,
      });
      if (!resultadoFirma.firmado) {
        console.warn(
          `Recibo ${recibo.id}: PDF no firmado (${resultadoFirma.motivo})`
        );
      }
    } catch (errorFirma) {
      console.error(
        `Recibo ${recibo.id}: error al firmar el PDF, se emite sin firma`,
        errorFirma
      );
    }

    // XML de datos del recibo (se guarda en public/ y se adjunta al correo).
    // Es un efecto secundario post-commit: si falla, no debe romper la emision
    // (el recibo ya esta persistido), para evitar respuestas de error que
    // provoquen reintentos y recibos duplicados.
    let xmlFilename;
    try {
      let xmlPath;
      ({ outputPath: xmlPath, filename: xmlFilename } = generarXmlRecibo({
        reciboUuid,
        reciboId,
        numeroRecibo: recibo.numero_recibo,
        fechaHora,
        concepto: datos.concepto,
        totalLetras,
        empresa: {
          ruc: usuario.empresa.ruc,
          nombre: usuario.empresa.nombre_empresa,
          timbrado: usuario.empresa.timbrado,
        },
        cliente: {
          ruc: rucTexto,
          razonSocial: datos.razonSocial,
          email: datos.email,
        },
        facturas: facturasNormalizadas.map((f) => ({
          numero: f.numeroDocumento,
          montoAplicado: f.montoAplicado,
        })),
        notasCredito: notasCreditoNormalizadas.map((n) => ({
          numero: n.numeroDocumento,
          montoAplicado: n.montoAplicado,
        })),
        cheques: chequesNormalizados.map((c) => ({
          banco: c.banco,
          numeroReferencia: c.numeroReferencia,
          monto: c.monto,
        })),
        transferencias: transferenciasNormalizadas.map((t) => ({
          banco: t.banco,
          numeroReferencia: t.numeroReferencia,
          monto: t.monto,
        })),
        totalEfectivo,
        totalCheques,
        totalTransferencias,
        total: totalRecibo,
      }));

      // Firma digital (XML-DSig) del XML con el mismo certificado .p12.
      const resultadoFirmaXml = firmarXml({
        xmlPath,
        certPath: usuario.empresa.cert_path,
        certPw: usuario.empresa.cert_pw,
      });
      if (!resultadoFirmaXml.firmado) {
        console.warn(
          `Recibo ${recibo.id}: XML no firmado (${resultadoFirmaXml.motivo})`
        );
      }
    } catch (errorXml) {
      console.error(
        `Recibo ${recibo.id}: error al generar/firmar el XML, se emite sin XML firmado`,
        errorXml
      );
    }

    // Envio de correo: tambien es un efecto secundario post-commit; un fallo de
    // SMTP no debe romper la emision de un recibo ya persistido.
    if (isEmailValido(datos.email)) {
      try {
        await enviarRecibo({
          email: datos.email,
          cliente: datos.razonSocial,
          uuid: reciboUuid,
          xmlFilename,
          reciboId,
          nroRecibo: recibo.numero_recibo,
          empresa: usuario.empresa.nombre_empresa,
          emailEmpresa: usuario.empresa.email,
        });
      } catch (errorCorreo) {
        console.error(
          `Recibo ${recibo.id}: error al enviar el correo del recibo`,
          errorCorreo
        );
      }
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

const getRecibos = async (page = 1, itemsPerPage = 10, filter = null, empresaId) => {
  try {
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
      items: recibos,
      page,
      itemsPerPage,
      totalItems,
    };
  } catch (error) {
    ErrorApp.handleServiceError(error, "Error al obtener recibos");
  }
};

module.exports = {
  emitirRecibo,
  getRecibos,
};
