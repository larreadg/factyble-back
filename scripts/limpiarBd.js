/**
 * Vacía todas las tablas de la BD apuntada por DATABASE_URL (TRUNCATE),
 * preservando el schema y el historial de migraciones (`_prisma_migrations`).
 *
 * Pensado solo para BD local de desarrollo. No dropea ni recrea la base:
 * si necesitás eso, usá `npx prisma migrate reset`.
 *
 * Uso:
 *   node scripts/limpiarBd.js --yes
 */
const prisma = require('../src/prisma/cliente');

const main = async () => {
  const confirmado = process.argv.includes('--yes');

  const [{ nombreBd }] = await prisma.$queryRaw`SELECT DATABASE() AS nombreBd`;

  if (!confirmado) {
    console.log(`Esto va a vaciar TODAS las tablas de la BD "${nombreBd}".`);
    console.log('Volvé a ejecutar el script con --yes para confirmar:');
    console.log('  node scripts/limpiarBd.js --yes');
    process.exit(1);
  }

  const tablas = await prisma.$queryRaw`
    SELECT TABLE_NAME
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = ${nombreBd}
      AND TABLE_TYPE = 'BASE TABLE'
      AND TABLE_NAME != '_prisma_migrations'
  `;

  if (tablas.length === 0) {
    console.log('No hay tablas para vaciar.');
    return;
  }

  await prisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 0');
  try {
    for (const { TABLE_NAME } of tablas) {
      await prisma.$executeRawUnsafe(`TRUNCATE TABLE \`${TABLE_NAME}\``);
      console.log(`Tabla vaciada: ${TABLE_NAME}`);
    }
  } finally {
    await prisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 1');
  }

  console.log(`Listo. ${tablas.length} tablas vaciadas en "${nombreBd}".`);
};

main()
  .catch((error) => {
    console.error('Error al limpiar la BD:', error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
