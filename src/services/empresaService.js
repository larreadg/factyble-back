const fs = require('fs');
const path = require('path');
const prisma = require('../prisma/cliente');
const ErrorApp = require('../utils/error');
const { hashPassword } = require('../utils/password');
const { encrypt } = require('../utils/crypto');
const { calcularDigitoVerificador } = require('../utils/sifen/cdc');
const firmadorService = require('./sifen/firmadorService');
const { calcularEstadoPorVencimiento, crearCertificado } = require('./sifen/certificadoService');

const ROL_ADMIN_EMPRESA = 'ADMIN';

/**
 * Alta completa de una empresa nueva: datos fiscales, al menos un establecimiento con al
 * menos una caja (con sus 3 secuencias de numeración inicializadas), el primer usuario
 * ADMIN de esa empresa, su certificado .p12 y su logo (ambos ya subidos a disco por
 * `uploadEmpresaArchivos`, ver `empresaRoute.js`).
 *
 * El certificado se valida (lectura de vigencia contra el .p12 real) ANTES de tocar la
 * base de datos, para no dejar una empresa a medio crear si la contraseña del certificado
 * es incorrecta. El resto de la escritura (empresa + establecimientos + cajas + secuencias
 * + usuario + certificado) corre en una única `prisma.$transaction`, así que ante
 * cualquier falla no queda estado parcial.
 *
 * @param {Object} datos
 * @param {Object} datos.empresa - Campos fiscales de `Empresa`
 * @param {Object[]} datos.establecimientos - Al menos un establecimiento, cada uno con `cajas: []`
 * @param {Object} datos.usuarioAdmin - Datos del primer usuario ADMIN de la empresa
 * @param {Object} datos.certificado - `{ alias, clave }` del certificado
 * @param {string} datos.archivoCertificadoPath - Path absoluto del .p12 ya guardado en disco
 * @param {string} datos.archivoLogoPath - Path absoluto del logo ya guardado en disco (`LOGOS_DIR`)
 * @returns {Promise<Object>} - Empresa creada, con establecimientos/cajas/usuario/certificado (sin secretos)
 */
const crearEmpresaCompleta = async ({ empresa, establecimientos, usuarioAdmin, certificado, archivoCertificadoPath, archivoLogoPath }) => {
  try {
    const dvCalculado = calcularDigitoVerificador(empresa.rucSinDv);
    if (String(dvCalculado) !== String(empresa.digitoVerificador)) {
      throw new ErrorApp('El dígito verificador no corresponde al RUC informado (rucSinDv)', 400);
    }

    // Se valida el .p12 contra el filesystem real ANTES de escribir nada en la base de
    // datos — si la contraseña es incorrecta o el archivo está corrupto, falla acá y no
    // queda una empresa/establecimiento/usuario huérfano sin certificado.
    let vigenteHasta;
    try {
      ({ vigenteHasta } = await firmadorService.obtenerVencimientoCertificado({
        certificadoPath: archivoCertificadoPath,
        certificadoPassword: certificado.clave,
      }));
    } catch (error) {
      // `firmadorService` no distingue "contraseña incorrecta" de un error de servidor y
      // propaga 500 (ver ErrorApp default) — acá sí es un dato de entrada inválido del
      // cliente de esta API, así que se traduce a 400.
      throw new ErrorApp(`El certificado no pudo leerse (¿contraseña incorrecta o archivo corrupto?): ${error.message}`, 400);
    }

    const empresaExistente = await prisma.empresa.findFirst({
      where: { OR: [{ ruc: empresa.ruc }, { ruc_sin_dv: empresa.rucSinDv }] },
    });
    if (empresaExistente) {
      throw new ErrorApp('Ya existe una empresa con ese RUC', 400);
    }

    const usuarioExistente = await prisma.usuario.findFirst({ where: { email: usuarioAdmin.email } });
    if (usuarioExistente) {
      throw new ErrorApp('El email del usuario administrador ya está en uso', 400);
    }

    const rolAdmin = await prisma.rol.findFirst({ where: { nombre: ROL_ADMIN_EMPRESA } });
    if (!rolAdmin) {
      throw new ErrorApp(`El rol ${ROL_ADMIN_EMPRESA} no existe, debe crearse antes de dar de alta una empresa`, 500);
    }

    const passwordHash = await hashPassword(usuarioAdmin.password);
    const cscCifrado = encrypt(empresa.csc);
    const claveCertificadoCifrada = encrypt(certificado.clave);

    const empresaId = await prisma.$transaction(async (tx) => {
      const empresaCreada = await tx.empresa.create({
        data: {
          ruc: empresa.ruc,
          nombre_empresa: empresa.nombreEmpresa,
          timbrado: empresa.timbrado,
          direccion: empresa.direccion,
          vigente_desde: new Date(empresa.vigenteDesde),
          telefono: empresa.telefono,
          email: empresa.email,
          ciudad: empresa.ciudad,
          logo: path.basename(archivoLogoPath),
          ruc_sin_dv: empresa.rucSinDv,
          digito_verificador: empresa.digitoVerificador,
          tipo_contribuyente: empresa.tipoContribuyente,
          tipo_impuesto: empresa.tipoImpuesto,
          cod_actividad_principal: empresa.codActividadPrincipal,
          desc_actividad_principal: empresa.descActividadPrincipal,
          cod_actividad_secundaria: empresa.codActividadSecundaria,
          desc_actividad_secundaria: empresa.descActividadSecundaria,
          cod_moneda: empresa.codMoneda || 'PYG',
          desc_moneda: empresa.descMoneda,
          csc: cscCifrado,
          csc_id: empresa.cscId,
        },
      });

      for (const establecimiento of establecimientos) {
        const establecimientoCreado = await tx.establecimiento.create({
          data: {
            nombre: establecimiento.nombre,
            direccion: establecimiento.direccion,
            numero_casa: establecimiento.numeroCasa,
            telefono: establecimiento.telefono,
            codigo: establecimiento.codigo,
            cod_distrito: establecimiento.codDistrito,
            cod_ciudad: establecimiento.codCiudad,
            cod_departamento: establecimiento.codDepartamento,
            empresa_id: empresaCreada.id,
          },
        });

        for (const caja of establecimiento.cajas) {
          const cajaCreada = await tx.caja.create({
            data: {
              nombre: caja.nombre,
              codigo: caja.codigo,
              establecimiento_id: establecimientoCreado.id,
            },
          });

          await tx.secuenciaFactura.create({
            data: { caja_id: cajaCreada.id, valor: caja.secuenciaFacturaInicial ?? 0 },
          });
          await tx.secuenciaNotaCredito.create({
            data: { caja_id: cajaCreada.id, valor: caja.secuenciaNotaCreditoInicial ?? 0 },
          });
          await tx.secuenciaRecibo.create({
            data: { caja_id: cajaCreada.id, valor: caja.secuenciaReciboInicial ?? 0 },
          });
        }
      }

      const usuarioCreado = await tx.usuario.create({
        data: {
          nombres: usuarioAdmin.nombres,
          apellidos: usuarioAdmin.apellidos,
          email: usuarioAdmin.email,
          documento: usuarioAdmin.documento,
          telefono: usuarioAdmin.telefono,
          password: passwordHash,
          empresa_id: empresaCreada.id,
        },
      });

      await tx.usuarioRol.create({
        data: { usuario_id: usuarioCreado.id, rol_id: rolAdmin.id },
      });

      await tx.certificado.create({
        data: {
          empresa_id: empresaCreada.id,
          alias: certificado.alias,
          archivo: archivoCertificadoPath,
          clave: claveCertificadoCifrada,
          fecha_vencimiento: vigenteHasta,
          activo: true,
          estado: calcularEstadoPorVencimiento(vigenteHasta),
        },
      });

      return empresaCreada.id;
    });

    return await obtenerEmpresaCompleta({ empresaId });
  } catch (error) {
    // Los archivos ya están en disco (los guardó multer antes de llegar acá) — si algo falló,
    // sea la validación del propio .p12 o la transacción, no los dejamos huérfanos.
    if (archivoCertificadoPath) {
      fs.unlink(archivoCertificadoPath, () => {});
    }
    if (archivoLogoPath) {
      fs.unlink(archivoLogoPath, () => {});
    }
    ErrorApp.handleServiceError(error, 'Error al dar de alta la empresa');
  }
};

// Select compartido entre `obtenerEmpresaCompleta` (respuesta de POST /) y `getEmpresaById`
// (GET /:id) — nunca incluye `Usuario.password`, `Certificado.clave` ni `Empresa.csc` (quedan
// cifrados en DB y no tienen ningún motivo para viajar por la API).
const EMPRESA_COMPLETA_SELECT = {
  id: true,
  ruc: true,
  nombre_empresa: true,
  timbrado: true,
  direccion: true,
  vigente_desde: true,
  telefono: true,
  email: true,
  ciudad: true,
  logo: true,
  ruc_sin_dv: true,
  digito_verificador: true,
  tipo_contribuyente: true,
  tipo_impuesto: true,
  cod_actividad_principal: true,
  desc_actividad_principal: true,
  cod_actividad_secundaria: true,
  desc_actividad_secundaria: true,
  cod_moneda: true,
  desc_moneda: true,
  csc_id: true,
  fecha_creacion: true,
  establecimientos: {
    select: {
      id: true,
      nombre: true,
      direccion: true,
      numero_casa: true,
      telefono: true,
      codigo: true,
      cod_distrito: true,
      cod_ciudad: true,
      cod_departamento: true,
      cajas: {
        select: {
          id: true,
          nombre: true,
          codigo: true,
          secuencia_factura: { select: { valor: true } },
          secuencia_nota_credito: { select: { valor: true } },
          secuencia_recibo: { select: { valor: true } },
        },
      },
    },
  },
  usuarios: {
    select: { id: true, nombres: true, apellidos: true, email: true, documento: true, telefono: true },
  },
  certificados: {
    select: { id: true, alias: true, fecha_vencimiento: true, activo: true, estado: true },
  },
};

/**
 * Relee la empresa recién creada con su estructura completa, sin exponer secretos.
 * @param {Object} datos
 * @param {number} datos.empresaId
 * @returns {Promise<Object>}
 */
const obtenerEmpresaCompleta = async ({ empresaId }) => {
  return await prisma.empresa.findUnique({
    where: { id: empresaId },
    select: EMPRESA_COMPLETA_SELECT,
  });
};

/**
 * Listado paginado de empresas (`GET /empresa`), para el panel de plataforma (`SUPERADMIN`).
 * Vista liviana — no trae establecimientos/cajas/usuarios, solo lo necesario para una tabla de
 * listado más el estado del certificado activo (si tiene).
 * @param {Object} datos
 * @param {number} [datos.page=1]
 * @param {number} [datos.itemsPerPage=10]
 * @param {string} [datos.filter] - Busca por ruc, nombre_empresa o email (contains)
 * @returns {Promise<{items: Object[], page: number, itemsPerPage: number, totalItems: number}>}
 */
const getEmpresas = async ({ page = 1, itemsPerPage = 10, filter = null } = {}) => {
  try {
    const skip = (page - 1) * itemsPerPage;
    const take = itemsPerPage;

    const where = filter
      ? {
          OR: [
            { ruc: { contains: filter } },
            { nombre_empresa: { contains: filter } },
            { email: { contains: filter } },
          ],
        }
      : {};

    const [empresas, totalItems] = await Promise.all([
      prisma.empresa.findMany({
        skip,
        take,
        where,
        orderBy: { fecha_creacion: 'desc' },
        select: {
          id: true,
          ruc: true,
          nombre_empresa: true,
          email: true,
          telefono: true,
          ciudad: true,
          tipo_contribuyente: true,
          fecha_creacion: true,
          _count: { select: { establecimientos: true, usuarios: true } },
          certificados: {
            where: { activo: true },
            select: { estado: true, fecha_vencimiento: true },
          },
        },
      }),
      prisma.empresa.count({ where }),
    ]);

    const items = empresas.map(({ certificados, _count, ...empresa }) => ({
      ...empresa,
      cantidadEstablecimientos: _count.establecimientos,
      cantidadUsuarios: _count.usuarios,
      certificadoActivo: certificados[0] || null,
    }));

    return { items, page, itemsPerPage, totalItems };
  } catch (error) {
    ErrorApp.handleServiceError(error, 'Error al obtener las empresas');
  }
};

/**
 * Detalle completo de una empresa (`GET /empresa/:id`), misma forma que la respuesta de
 * `POST /empresa`.
 * @param {Object} datos
 * @param {number} datos.empresaId
 * @returns {Promise<Object>}
 */
const getEmpresaById = async ({ empresaId }) => {
  try {
    const empresa = await obtenerEmpresaCompleta({ empresaId });
    if (!empresa) {
      throw new ErrorApp('Empresa no encontrada', 404);
    }
    return empresa;
  } catch (error) {
    ErrorApp.handleServiceError(error, 'Error al obtener la empresa');
  }
};

// Mapeo camelCase (body de PUT /empresa/:id) -> columna snake_case de `Empresa`. Deliberadamente
// NO incluye establecimientos/cajas/secuencias/usuarios — esos son otros recursos (con su
// propia numeración de comprobantes, en el caso de las secuencias) y editarlos acá rompería la
// numeración fiscal ya emitida. `csc` se mapea aparte porque va cifrado; `logo` y `certificado`
// tampoco están acá porque no son campos de texto — son archivos, se manejan aparte en
// `actualizarEmpresa` (ver `archivoLogoPath`/`archivoCertificadoPath`).
const EMPRESA_CAMPOS_EDITABLES = {
  ruc: 'ruc',
  nombreEmpresa: 'nombre_empresa',
  timbrado: 'timbrado',
  direccion: 'direccion',
  vigenteDesde: 'vigente_desde',
  telefono: 'telefono',
  email: 'email',
  ciudad: 'ciudad',
  rucSinDv: 'ruc_sin_dv',
  digitoVerificador: 'digito_verificador',
  tipoContribuyente: 'tipo_contribuyente',
  tipoImpuesto: 'tipo_impuesto',
  codActividadPrincipal: 'cod_actividad_principal',
  descActividadPrincipal: 'desc_actividad_principal',
  codActividadSecundaria: 'cod_actividad_secundaria',
  descActividadSecundaria: 'desc_actividad_secundaria',
  codMoneda: 'cod_moneda',
  descMoneda: 'desc_moneda',
  cscId: 'csc_id',
};

/**
 * Actualiza los datos propios de `Empresa` (`PUT /empresa/:id`) — nunca
 * establecimientos/cajas/secuencias/usuarios, que son otros recursos con su propia numeración
 * fiscal ya emitida. Update parcial: cualquier subconjunto de `EMPRESA_CAMPOS_EDITABLES`
 * (+ `csc`), el resto de columnas queda intacto.
 *
 * `certificado`/`logo` son la excepción: si vienen (junto con sus archivos ya subidos por
 * multer, `archivoCertificadoPath`/`archivoLogoPath`), se procesan además del resto de campos.
 * Un certificado nuevo no reemplaza el registro anterior — lo desactiva y crea uno nuevo activo
 * vía `certificadoService.crearCertificado` (mismo mecanismo atómico "un activo por empresa" que
 * usa el resto del pipeline SIFEN), preservando el historial. El logo si se reemplaza en el lugar
 * (no hay historial de logos) — el archivo viejo queda huérfano en `LOGOS_DIR`, no se borra.
 *
 * @param {Object} datos
 * @param {number} datos.empresaId
 * @param {Object} datos.cambios - Body de la request, camelCase (mismos nombres que `POST /empresa`)
 * @param {string} [datos.archivoCertificadoPath] - Path absoluto del .p12 nuevo, si se está renovando
 * @param {string} [datos.archivoLogoPath] - Path absoluto del logo nuevo, si se está reemplazando
 * @returns {Promise<Object>}
 */
const actualizarEmpresa = async ({ empresaId, cambios, archivoCertificadoPath, archivoLogoPath }) => {
  // No alcanza con "hubo error -> borrar los archivos": si el logo ya se guardó en `Empresa` y
  // recién después falla la renovación del certificado (o viceversa), el archivo que sí se
  // commiteó no debe borrarse — quedaría una fila apuntando a un archivo inexistente.
  let logoCommitted = false;
  let certificadoCommitted = false;
  try {
    const empresaActual = await prisma.empresa.findUnique({ where: { id: empresaId } });
    if (!empresaActual) {
      throw new ErrorApp('Empresa no encontrada', 404);
    }

    // rucSinDv y digitoVerificador viajan siempre juntos: si se toca uno, se revalida la
    // consistencia Módulo 11 contra el valor final del otro (el nuevo si vino en el body, si
    // no el que ya tenía la empresa) — mismo algoritmo que usa `crearEmpresaCompleta`.
    if (cambios.rucSinDv !== undefined || cambios.digitoVerificador !== undefined) {
      const rucSinDv = cambios.rucSinDv !== undefined ? cambios.rucSinDv : empresaActual.ruc_sin_dv;
      const digitoVerificador =
        cambios.digitoVerificador !== undefined ? cambios.digitoVerificador : empresaActual.digito_verificador;

      if (!rucSinDv || !digitoVerificador) {
        throw new ErrorApp('rucSinDv y digitoVerificador deben informarse juntos', 400);
      }

      const dvCalculado = calcularDigitoVerificador(rucSinDv);
      if (String(dvCalculado) !== String(digitoVerificador)) {
        throw new ErrorApp('El dígito verificador no corresponde al RUC informado (rucSinDv)', 400);
      }
    }

    // Si se toca ruc o rucSinDv, se revalida que no choque con otra empresa (excluyéndose a
    // sí misma) — mismo chequeo de unicidad que el alta, ahora scopeado con `id: { not }`.
    if (cambios.ruc !== undefined || cambios.rucSinDv !== undefined) {
      const ruc = cambios.ruc !== undefined ? cambios.ruc : empresaActual.ruc;
      const rucSinDv = cambios.rucSinDv !== undefined ? cambios.rucSinDv : empresaActual.ruc_sin_dv;

      const empresaExistente = await prisma.empresa.findFirst({
        where: {
          id: { not: empresaId },
          OR: [{ ruc }, ...(rucSinDv ? [{ ruc_sin_dv: rucSinDv }] : [])],
        },
      });
      if (empresaExistente) {
        throw new ErrorApp('Ya existe otra empresa con ese RUC', 400);
      }
    }

    const data = {};
    for (const [campo, columna] of Object.entries(EMPRESA_CAMPOS_EDITABLES)) {
      if (cambios[campo] !== undefined) {
        data[columna] = campo === 'vigenteDesde' ? new Date(cambios[campo]) : cambios[campo];
      }
    }
    if (cambios.csc !== undefined) {
      data.csc = encrypt(cambios.csc);
    }
    if (archivoLogoPath) {
      data.logo = path.basename(archivoLogoPath);
    }

    if (Object.keys(data).length > 0) {
      await prisma.empresa.update({ where: { id: empresaId }, data });
      if (archivoLogoPath) logoCommitted = true;
    }

    if (cambios.certificado) {
      // Se valida el .p12 contra el filesystem real ANTES de crear el registro, traduciendo el
      // error a 400 (contraseña incorrecta/archivo corrupto es un dato de entrada inválido del
      // cliente, no un 500) — mismo criterio que `crearEmpresaCompleta`. `crearCertificado`
      // vuelve a leer el archivo internamente para calcular la vigencia real a persistir; es una
      // relectura redundante pero el flujo de renovación de certificado es infrecuente.
      try {
        await firmadorService.obtenerVencimientoCertificado({
          certificadoPath: archivoCertificadoPath,
          certificadoPassword: cambios.certificado.clave,
        });
      } catch (error) {
        throw new ErrorApp(`El certificado no pudo leerse (¿contraseña incorrecta o archivo corrupto?): ${error.message}`, 400);
      }

      await crearCertificado({
        empresaId,
        alias: cambios.certificado.alias,
        archivo: archivoCertificadoPath,
        clave: cambios.certificado.clave,
      });
      certificadoCommitted = true;
    }

    return await obtenerEmpresaCompleta({ empresaId });
  } catch (error) {
    // Si algo falló después de que multer ya guardó el certificado y/o el logo nuevos, no los
    // dejamos huérfanos — salvo que ya hayan quedado commiteados en la DB (`*Committed`), en
    // cuyo caso borrarlos dejaría una fila apuntando a un archivo inexistente.
    if (archivoCertificadoPath && !certificadoCommitted) {
      fs.unlink(archivoCertificadoPath, () => {});
    }
    if (archivoLogoPath && !logoCommitted) {
      fs.unlink(archivoLogoPath, () => {});
    }
    ErrorApp.handleServiceError(error, 'Error al actualizar la empresa');
  }
};

module.exports = {
  crearEmpresaCompleta,
  getEmpresas,
  getEmpresaById,
  actualizarEmpresa,
};
