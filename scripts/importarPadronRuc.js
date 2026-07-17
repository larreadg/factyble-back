/**
 * Importa uno o varios ZIP del padrón de RUC de la SET/DNIT sin pasar por el endpoint HTTP
 * (útil para un cron o una corrida manual con archivos ya en disco). Reutiliza el mismo
 * servicio que usa `POST /rucs/import` (`padronRucImportService.js`) — no duplica lógica.
 *
 * Uso:
 *   node scripts/importarPadronRuc.js ruta/ruc0.zip ruta/ruc1.zip ruta/ruc2.zip
 */
const prisma = require('../src/prisma/cliente');
const { importarPadronRuc } = require('../src/services/padronRucImportService');

const main = async () => {
  const rutasArchivos = process.argv.slice(2);

  if (rutasArchivos.length === 0) {
    console.error('Uso: node scripts/importarPadronRuc.js <archivo1.zip> [archivo2.zip ...]');
    process.exitCode = 1;
    return;
  }

  const resumen = await importarPadronRuc(rutasArchivos);

  console.log(JSON.stringify(resumen, null, 2));

  if (resumen.archivosConError > 0) {
    process.exitCode = 1;
  }
};

main()
  .catch((error) => {
    console.error('Error al importar el padrón de RUC:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
