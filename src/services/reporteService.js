const dayjs = require("dayjs");
const prisma = require("../prisma/cliente");
const ErrorApp = require("../utils/error");
const { esAprobado, esCancelado, esRechazado } = require("../utils/sifen/estadoHistorico");

// Documentos históricos (previos al pipeline nativo o emitidos mientras convivió con la API PHP
// legacy) tienen estado_sifen NULL — su estado real vive en sifen_estado (texto libre, ver
// utils/sifen/estadoHistorico.js). Normalizamos ambos a los valores del enum EstadoSifen para que
// los reportes no subcuenten esos documentos. Si ninguna de las dos fuentes resuelve el estado
// (legacy sin sifen_estado reconocible), se agrupa como DESCONOCIDO en vez de descartarse.
const normalizarEstado = (documento) => {
  if (documento.estado_sifen) return documento.estado_sifen;
  if (esAprobado(documento)) return "APROBADO";
  if (esCancelado(documento)) return "CANCELADO";
  if (esRechazado(documento)) return "RECHAZADO";
  return "DESCONOCIDO";
};

// Una factura CANCELADA no representa facturación real: se excluye de los reportes monetarios
// (facturación por período, top clientes), pero sí se cuenta en el reporte de facturas por estado.
const estaCancelada = (documento) => normalizarEstado(documento) === "CANCELADO";

const construirRangoFechas = (desde, hasta) => {
  const rango = {};
  if (desde) rango.gte = dayjs(desde).startOf("day").toDate();
  if (hasta) rango.lte = dayjs(hasta).endOf("day").toDate();
  return Object.keys(rango).length ? rango : undefined;
};

const nombreCliente = (cliente) =>
  cliente.tipo_identificacion === "RUC" ? cliente.razon_social : `${cliente.nombres} ${cliente.apellidos}`;

const facturasPorEstados = async (desde, hasta, empresaId) => {
  try {
    const rangoFechas = construirRangoFechas(desde, hasta);

    const facturas = await prisma.factura.findMany({
      where: {
        cliente_empresa: { empresa_id: empresaId },
        ...(rangoFechas && { fecha_creacion: rangoFechas }),
      },
      select: {
        estado_sifen: true,
        sifen_estado: true,
      },
    });

    const conteoPorEstado = facturas.reduce((acc, factura) => {
      const estado = normalizarEstado(factura);
      acc[estado] = (acc[estado] || 0) + 1;
      return acc;
    }, {});

    const estados = Object.entries(conteoPorEstado)
      .map(([estado, cantidad]) => ({ estado, cantidad }))
      .sort((a, b) => b.cantidad - a.cantidad);

    return {
      desde: desde || null,
      hasta: hasta || null,
      totalFacturas: facturas.length,
      estados,
    };
  } catch (error) {
    ErrorApp.handleServiceError(error, "Error al obtener facturas por estado");
  }
};

const facturacionPorPeriodo = async (desde, hasta, empresaId) => {
  try {
    const rangoFechas = construirRangoFechas(desde, hasta);

    const facturas = await prisma.factura.findMany({
      where: {
        cliente_empresa: { empresa_id: empresaId },
        ...(rangoFechas && { fecha_creacion: rangoFechas }),
      },
      select: {
        total: true,
        fecha_creacion: true,
        estado_sifen: true,
        sifen_estado: true,
      },
      orderBy: { fecha_creacion: "asc" },
    });

    const facturasValidas = facturas.filter((factura) => !estaCancelada(factura));

    const detallePorFecha = facturasValidas.reduce((acc, factura) => {
      const fecha = dayjs(factura.fecha_creacion).format("YYYY-MM-DD");
      if (!acc[fecha]) acc[fecha] = { fecha, total: 0, cantidadFacturas: 0 };
      acc[fecha].total += factura.total;
      acc[fecha].cantidadFacturas += 1;
      return acc;
    }, {});

    const detalle = Object.values(detallePorFecha).sort((a, b) => (a.fecha > b.fecha ? 1 : -1));

    return {
      desde: desde || null,
      hasta: hasta || null,
      totalFacturado: facturasValidas.reduce((acc, factura) => acc + factura.total, 0),
      cantidadFacturas: facturasValidas.length,
      detalle,
    };
  } catch (error) {
    ErrorApp.handleServiceError(error, "Error al obtener facturación por período");
  }
};

const topClientes = async (desde, hasta, limite = 10, empresaId) => {
  try {
    const rangoFechas = construirRangoFechas(desde, hasta);

    const facturas = await prisma.factura.findMany({
      where: {
        cliente_empresa: { empresa_id: empresaId },
        ...(rangoFechas && { fecha_creacion: rangoFechas }),
      },
      select: {
        total: true,
        estado_sifen: true,
        sifen_estado: true,
        cliente_empresa: {
          select: {
            cliente_id: true,
            cliente: {
              select: {
                ruc: true,
                documento: true,
                razon_social: true,
                nombres: true,
                apellidos: true,
                tipo_identificacion: true,
              },
            },
          },
        },
      },
    });

    const facturasValidas = facturas.filter((factura) => !estaCancelada(factura));

    const totalesPorCliente = facturasValidas.reduce((acc, factura) => {
      const { cliente_id, cliente } = factura.cliente_empresa;
      if (!acc[cliente_id]) {
        acc[cliente_id] = {
          clienteId: cliente_id,
          ruc: cliente.ruc,
          documento: cliente.documento,
          nombre: nombreCliente(cliente),
          totalFacturado: 0,
          cantidadFacturas: 0,
        };
      }
      acc[cliente_id].totalFacturado += factura.total;
      acc[cliente_id].cantidadFacturas += 1;
      return acc;
    }, {});

    const clientes = Object.values(totalesPorCliente)
      .sort((a, b) => b.totalFacturado - a.totalFacturado)
      .slice(0, limite);

    return {
      desde: desde || null,
      hasta: hasta || null,
      clientes,
    };
  } catch (error) {
    ErrorApp.handleServiceError(error, "Error al obtener top de clientes");
  }
};

module.exports = {
  facturasPorEstados,
  facturacionPorPeriodo,
  topClientes,
};
