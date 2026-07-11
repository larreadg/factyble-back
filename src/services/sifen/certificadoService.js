const prisma = require("../../prisma/cliente");
const ErrorApp = require("../../utils/error");
const { encrypt, decrypt } = require("../../utils/crypto");
const firmadorService = require("./firmadorService");

/**
 * CRUD de `Certificado` (MIGRATION_PLAN.md §3.2), chequeo de vencimiento proactivo (causa
 * raíz documentada del error 0142 — v1/v2 nunca lo chequean, ver §1.4) y selección del
 * certificado activo por empresa. La contraseña del .p12 se cifra a nivel aplicación
 * (`utils/crypto.js`, AES-256-GCM) antes de persistirse en `Certificado.clave` — nunca
 * texto plano (antipatrón J).
 *
 * "Un certificado activo a la vez por empresa" NO está garantizado por constraint de BD
 * (MySQL no tiene índice único parcial, ver MIGRATION_PLAN.md §2.2) — se enforza acá,
 * desactivando el certificado activo anterior dentro de la misma `prisma.$transaction`
 * en la que se activa el nuevo.
 */

const POR_VENCER_DIAS = 30;

/**
 * Da de alta un nuevo certificado para una empresa. La contraseña recibida es la real, en
 * texto plano — se cifra acá antes de tocar la BD. Si `activo` es true (default), desactiva
 * atómicamente cualquier otro certificado activo de la misma empresa (ver nota de clase).
 * @param {Object} datos
 * @param {number} datos.empresaId - Id de la empresa dueña del certificado
 * @param {string} datos.alias - Identificador legible para versionado (p. ej. "2026")
 * @param {string} datos.archivo - Path del archivo .p12 en filesystem
 * @param {string} datos.clave - Contraseña del .p12, en texto plano (se cifra antes de persistir)
 * @param {boolean} [datos.activo] - Si este certificado pasa a ser el activo de la empresa (default true)
 * @returns {Promise<Object>} - Certificado creado (con `clave` ya cifrada, no se descifra en la respuesta)
 */
const crearCertificado = async ({ empresaId, alias, archivo, clave, activo = true }) => {
  try {
    const { vigenteHasta } = await firmadorService.obtenerVencimientoCertificado({
      certificadoPath: archivo,
      certificadoPassword: clave,
    });

    const claveCifrada = encrypt(clave);

    return await prisma.$transaction(async (tx) => {
      // Bloquea la fila de la empresa hasta el commit de esta transacción — serializa cualquier
      // alta/activación concurrente de certificados para la misma empresa (AUD-005,
      // STATIC_AUDIT_FINDINGS.json). Sin esto, dos transacciones que arrancan antes de que exista un
      // certificado activo previo podían terminar cada una con el suyo en `activo:true`
      // simultáneamente, porque el `updateMany` de abajo solo desactiva filas que ya existen y están
      // commiteadas en el momento en que corre — mismo patrón ya usado en el proyecto para la
      // secuencia de numeración (`facturaService.js`, `FOR UPDATE`).
      await tx.$queryRaw`SELECT id FROM empresa WHERE id = ${empresaId} FOR UPDATE`;

      if (activo) {
        await tx.certificado.updateMany({
          where: { empresa_id: empresaId, activo: true },
          data: { activo: false },
        });
      }

      return await tx.certificado.create({
        data: {
          empresa_id: empresaId,
          alias,
          archivo,
          clave: claveCifrada,
          fecha_vencimiento: vigenteHasta,
          activo,
          estado: calcularEstadoPorVencimiento(vigenteHasta),
        },
      });
    });
  } catch (error) {
    ErrorApp.handleServiceError(error, "Error al crear el certificado");
  }
};

/**
 * Marca un certificado como el activo de su empresa, desactivando atómicamente cualquier
 * otro certificado activo de esa misma empresa.
 * @param {Object} datos
 * @param {number} datos.certificadoId - Id del certificado a activar
 * @returns {Promise<Object>} - Certificado activado
 */
const activarCertificado = async ({ certificadoId }) => {
  try {
    return await prisma.$transaction(async (tx) => {
      const certificado = await tx.certificado.findUnique({ where: { id: certificadoId } });
      if (!certificado) {
        throw new ErrorApp("Certificado no encontrado", 404);
      }

      // Mismo lock que en crearCertificado — ver comentario ahí (AUD-005, STATIC_AUDIT_FINDINGS.json).
      await tx.$queryRaw`SELECT id FROM empresa WHERE id = ${certificado.empresa_id} FOR UPDATE`;

      await tx.certificado.updateMany({
        where: { empresa_id: certificado.empresa_id, activo: true },
        data: { activo: false },
      });

      return await tx.certificado.update({
        where: { id: certificadoId },
        data: { activo: true },
      });
    });
  } catch (error) {
    ErrorApp.handleServiceError(error, "Error al activar el certificado");
  }
};

/**
 * Obtiene el certificado activo de una empresa con la contraseña ya descifrada, lista para
 * pasar directo a `firmadorService`/`sifenClientService` (que la reciben explícita por
 * parámetro, sin estado global — antipatrón G).
 * @param {Object} datos
 * @param {number} datos.empresaId - Id de la empresa
 * @returns {Promise<{id: number, archivo: string, clave: string, fechaVencimiento: Date, estado: string}>}
 */
const obtenerCertificadoActivo = async ({ empresaId }) => {
  try {
    const certificado = await prisma.certificado.findFirst({
      where: { empresa_id: empresaId, activo: true },
    });

    if (!certificado) {
      throw new ErrorApp("La empresa no tiene un certificado activo", 404);
    }

    if (certificado.estado === "VENCIDO" || certificado.estado === "REVOCADO") {
      throw new ErrorApp(`El certificado activo de la empresa esta ${certificado.estado === "VENCIDO" ? "vencido" : "revocado"}`, 400);
    }

    return {
      id: certificado.id,
      archivo: certificado.archivo,
      clave: decrypt(certificado.clave),
      fechaVencimiento: certificado.fecha_vencimiento,
      estado: certificado.estado,
    };
  } catch (error) {
    ErrorApp.handleServiceError(error, "Error al obtener el certificado activo de la empresa");
  }
};

/**
 * Lista los certificados de una empresa (sin descifrar `clave` — no se expone en listados).
 * @param {Object} datos
 * @param {number} datos.empresaId - Id de la empresa
 * @returns {Promise<Object[]>}
 */
const listarCertificadosPorEmpresa = async ({ empresaId }) => {
  try {
    return await prisma.certificado.findMany({
      where: { empresa_id: empresaId },
      orderBy: { fecha_creacion: "desc" },
    });
  } catch (error) {
    ErrorApp.handleServiceError(error, "Error al listar los certificados de la empresa");
  }
};

/**
 * Recalcula `estado` (VIGENTE/POR_VENCER/VENCIDO) de todos los certificados no revocados en
 * base a `fecha_vencimiento`, para el cron `alertaCertificadosPorVencer` (§3.4) y para que
 * `obtenerCertificadoActivo` siempre lea un estado al dia sin depender de que otro proceso
 * lo haya actualizado antes. Devuelve los certificados que entraron o siguen en estado
 * POR_VENCER/VENCIDO, para que el cron decida a quién alertar.
 * @returns {Promise<Object[]>} - Certificados en estado POR_VENCER o VENCIDO tras la actualización
 */
const actualizarEstadosPorVencimiento = async () => {
  try {
    const certificados = await prisma.certificado.findMany({
      where: { estado: { not: "REVOCADO" } },
    });

    const porAlertar = [];
    for (const certificado of certificados) {
      const estado = calcularEstadoPorVencimiento(certificado.fecha_vencimiento);
      if (estado !== certificado.estado) {
        await prisma.certificado.update({
          where: { id: certificado.id },
          data: { estado },
        });
      }
      if (estado === "POR_VENCER" || estado === "VENCIDO") {
        porAlertar.push({ ...certificado, estado });
      }
    }

    return porAlertar;
  } catch (error) {
    ErrorApp.handleServiceError(error, "Error al actualizar el estado de vencimiento de los certificados");
  }
};

/**
 * Deriva el `EstadoCertificado` a partir de la fecha de vencimiento y la fecha actual.
 * No toca `REVOCADO` — esa transición es manual (revocación explícita), no automática.
 * @param {Date} fechaVencimiento
 * @returns {"VIGENTE"|"POR_VENCER"|"VENCIDO"}
 */
const calcularEstadoPorVencimiento = (fechaVencimiento) => {
  const ahora = Date.now();
  const vencimiento = new Date(fechaVencimiento).getTime();
  if (vencimiento <= ahora) {
    return "VENCIDO";
  }
  const diasRestantes = (vencimiento - ahora) / (1000 * 60 * 60 * 24);
  if (diasRestantes <= POR_VENCER_DIAS) {
    return "POR_VENCER";
  }
  return "VIGENTE";
};

module.exports = {
  crearCertificado,
  activarCertificado,
  obtenerCertificadoActivo,
  listarCertificadosPorEmpresa,
  actualizarEstadosPorVencimiento,
  calcularEstadoPorVencimiento,
};
