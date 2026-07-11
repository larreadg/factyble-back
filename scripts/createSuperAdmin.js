/**
 * Crea un usuario con rol SUPERADMIN (staff de plataforma, sin empresa asociada).
 *
 * Uso:
 *   node scripts/createSuperAdmin.js --email=x@factyble.com --password=xxxxx \
 *     --nombres=Juan --apellidos=Perez --documento=1234567 --telefono=0981000000
 *
 * Requiere que la migración `20260711134651_add_superadmin_rol` ya haya corrido
 * (crea el rol SUPERADMIN) y que `Usuario.empresa_id` sea nullable (migración
 * `20260711163646_usuario_empresa_id_opcional`).
 */
const prisma = require('../src/prisma/cliente');
const { hashPassword } = require('../src/utils/password');

const ROL_SUPERADMIN = 'SUPERADMIN';
const CAMPOS_REQUERIDOS = ['email', 'password', 'nombres', 'apellidos', 'documento', 'telefono'];

const parseArgs = (argv) => {
  const args = {};
  for (const arg of argv) {
    const match = /^--([^=]+)=(.*)$/.exec(arg);
    if (match) {
      args[match[1]] = match[2];
    }
  }
  return args;
};

const main = async () => {
  const args = parseArgs(process.argv.slice(2));

  const faltantes = CAMPOS_REQUERIDOS.filter((campo) => !args[campo]);
  if (faltantes.length > 0) {
    console.error(`Faltan argumentos requeridos: ${faltantes.join(', ')}`);
    console.error(
      'Uso: node scripts/createSuperAdmin.js --email=... --password=... --nombres=... --apellidos=... --documento=... --telefono=...'
    );
    process.exitCode = 1;
    return;
  }

  const { email, password, nombres, apellidos, documento, telefono } = args;

  const usuarioExistente = await prisma.usuario.findFirst({ where: { email } });
  if (usuarioExistente) {
    console.error(`Ya existe un usuario con el email ${email}`);
    process.exitCode = 1;
    return;
  }

  const rolSuperAdmin = await prisma.rol.findFirst({ where: { nombre: ROL_SUPERADMIN } });
  if (!rolSuperAdmin) {
    console.error(
      `El rol ${ROL_SUPERADMIN} no existe. Corré la migración "20260711134651_add_superadmin_rol" antes.`
    );
    process.exitCode = 1;
    return;
  }

  const passwordHash = await hashPassword(password);

  const usuarioCreado = await prisma.usuario.create({
    data: {
      nombres,
      apellidos,
      email,
      documento,
      telefono,
      password: passwordHash,
      empresa_id: null,
    },
  });

  await prisma.usuarioRol.create({
    data: { usuario_id: usuarioCreado.id, rol_id: rolSuperAdmin.id },
  });

  console.log(`Usuario SUPERADMIN creado: id=${usuarioCreado.id} email=${usuarioCreado.email}`);
};

main()
  .catch((error) => {
    console.error('Error al crear el usuario SUPERADMIN:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
