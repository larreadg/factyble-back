/**
 * Cambia la contraseña de un usuario existente, identificado por email.
 *
 * Uso:
 *   node scripts/cambiarPassword.js --email=x@factyble.com --password=nuevaPass123
 */
const prisma = require('../src/prisma/cliente');
const { hashPassword } = require('../src/utils/password');

const CAMPOS_REQUERIDOS = ['email', 'password'];

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
    console.error('Uso: node scripts/cambiarPassword.js --email=... --password=...');
    process.exitCode = 1;
    return;
  }

  const { email, password } = args;

  const usuario = await prisma.usuario.findFirst({ where: { email } });
  if (!usuario) {
    console.error(`No existe un usuario con el email ${email}`);
    process.exitCode = 1;
    return;
  }

  const passwordHash = await hashPassword(password);

  await prisma.usuario.update({
    where: { id: usuario.id },
    data: { password: passwordHash },
  });

  console.log(`Contraseña actualizada: id=${usuario.id} email=${usuario.email}`);
};

main()
  .catch((error) => {
    console.error('Error al cambiar la contraseña:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
