/**
 * Marca en `padron_ruc` los RUC del catálogo de Organismos y Entidades del Estado
 * (`src/data/oeeRucs.json`), para que las emisiones dirigidas a ellos salgan como B2G
 * (`iTiOpe=3`) y no las rechace SIFEN con el código 1332 (validación D202b, NT 20).
 *
 * Es idempotente: correrlo de nuevo no escribe nada si ya está sembrado. Conviene correrlo
 * después de cada importación batch del padrón, aunque `guardarLote` ya preserva la marca.
 *
 * Uso:
 *   node scripts/sembrarOee.js
 */
const prisma = require('../src/prisma/cliente');
const { sembrarCatalogoOee } = require('../src/services/oeeService');

const main = async () => {
  const resumen = await sembrarCatalogoOee();

  console.log(JSON.stringify(resumen, null, 2));
};

main()
  .catch((error) => {
    console.error('Error al sembrar el catálogo de OEE:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
