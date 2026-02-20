const { v4: uuidv4 } = require("uuid");
const dayjs = require("dayjs");
const prisma = require("../prisma/cliente");
const ErrorApp = require("../utils/error");
const { NumerosALetras } = require("numero-a-letras");
const { parseEntero } = require("../utils/number");
const { formatNumberWithLeadingZeros } = require("../utils/format");
const generarPdfRecibo = require("../utils/generarPdfRecibo");
const { enviarRecibo } = require("./correoService");

const isEmailValido = (email) => {
  if (!email) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim());
};

/**
 * @typedef {Object} ReciboChequeInput
 * @property {string} banco - Nombre del banco del cheque.
 * @property {string} numero - Numero de cheque.
 * @property {string|number} monto - Monto del cheque en formato entero (sin decimales).
 */

/**
 * @typedef {Object} ReciboFacturaInput
 * @property {string} numeroFactura - Numero de factura recibido desde frontend.
 * @property {string|number} montoAplicado - Monto aplicado a esa factura en formato entero.
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
 * - Buscar y validar facturas por numeroFactura.
 * - Calcular totales (efectivo, cheques, total y total_letras).
 * - Persistir Recibo, ReciboFactura y ReciboCheque.
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

    // Validar facturas de entrada
    if (!Array.isArray(datos.facturas) || datos.facturas.length === 0) {
      throw new ErrorApp("Debe proporcionar al menos una factura", 400);
    }

    const facturasNormalizadas = datos.facturas.map((f) => ({
      numeroFactura: String(f.numeroFactura).trim(),
      numeroFacturaNumerico: Number(String(f.numeroFactura).replace(/^0+/, "") || "0"),
      montoAplicado: parseEntero(f.montoAplicado, "montoAplicado", { min: 1 }),
    }));

    if (facturasNormalizadas.some((f) => !f.numeroFactura || Number.isNaN(f.numeroFacturaNumerico) || f.numeroFacturaNumerico <= 0)) {
      throw new ErrorApp("Numero de factura invalido", 400);
    }

    const numerosDuplicados = new Set();
    for (const f of facturasNormalizadas) {
      const key = String(f.numeroFacturaNumerico);
      if (numerosDuplicados.has(key)) {
        throw new ErrorApp("No se permiten facturas duplicadas en el recibo", 400);
      }
      numerosDuplicados.add(key);
    }

    const facturasDb = await prisma.factura.findMany({
      where: {
        numero_factura: {
          in: facturasNormalizadas.map((f) => f.numeroFacturaNumerico),
        },
        cliente_empresa: {
          empresa_id: usuario.empresa_id,
        },
      },
      include: {
        cliente_empresa: true,
      },
    });

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

    // Validar cheques y totales
    const cheques = Array.isArray(datos.cheques) ? datos.cheques : [];
    const totalEfectivo = parseEntero(datos.totalEfectivo || 0, "totalEfectivo");

    const chequesNormalizados = cheques.map((c) => ({
      banco: String(c.banco || "").trim(),
      numeroCheque: String(c.numero || "").trim(),
      monto: parseEntero(c.monto, "cheques.monto"),
    }));

    if (
      chequesNormalizados.some(
        (c) => !c.banco || !c.numeroCheque
      )
    ) {
      throw new ErrorApp("Datos de cheques invalidos", 400);
    }

    const totalCheques = chequesNormalizados.reduce((acc, c) => acc + c.monto, 0);
    const totalFacturas = facturasNormalizadas.reduce(
      (acc, f) => acc + f.montoAplicado,
      0
    );
    const totalRecibo = totalEfectivo + totalCheques;

    if (totalRecibo !== totalFacturas) {
      throw new ErrorApp(
        "El total recibido (efectivo + cheques) no coincide con el monto aplicado en facturas",
        400
      );
    }

    const reciboUuid = uuidv4();
    const totalReciboString = `${totalRecibo}.00`;
    const totalEfectivoString = `${totalEfectivo}.00`;
    const totalChequesString = `${totalCheques}.00`;
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
          total: totalReciboString,
          total_letras: totalLetras,
          concepto: datos.concepto,
          caja_id: caja.id,
        },
      });

      const mapaFacturaPorNumero = new Map(
        facturasDb.map((f) => [f.numero_factura, f.id])
      );

      await tx.reciboFactura.createMany({
        data: facturasNormalizadas.map((f) => ({
          recibo_id: reciboCreado.id,
          factura_id: mapaFacturaPorNumero.get(f.numeroFacturaNumerico),
          monto_aplicado: `${f.montoAplicado}.00`,
        })),
      });

      if (chequesNormalizados.length > 0) {
        await tx.reciboCheque.createMany({
          data: chequesNormalizados.map((c) => ({
            recibo_id: reciboCreado.id,
            banco: c.banco,
            numero_cheque: c.numeroCheque,
            monto: `${c.monto}.00`,
          })),
        });
      }

      return reciboCreado;
    });

    const reciboId = `${datos.establecimiento}-${datos.caja}-${formatNumberWithLeadingZeros(recibo.numero_recibo)}`;

    await generarPdfRecibo({
      empresaLogo: usuario.empresa.logo,
      reciboUuid,
      reciboId,
      ds: facturasNormalizadas.map((f) => ({
        facturaNumero: f.numeroFactura,
        importe: f.montoAplicado,
      })),
      dsCheque: chequesNormalizados.map((c) => ({
        banco: c.banco,
        chequeNumero: c.numeroCheque,
        total: c.monto,
      })),
      fechaHora: dayjs().format("YYYY-MM-DD HH:mm:ss"),
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

    if (isEmailValido(datos.email)) {
      await enviarRecibo({
        email: datos.email,
        cliente: datos.razonSocial,
        uuid: reciboUuid,
        reciboId,
        nroRecibo: recibo.numero_recibo,
        empresa: usuario.empresa.nombre_empresa,
        emailEmpresa: usuario.empresa.email,
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
        cheques: true,
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
