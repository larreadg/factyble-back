// Nombre de la impresora del sistema a la que se mandan los tickets (KuDE) en el despliegue on-prem.
//
// Se lee UNA vez al cargar el módulo: cambiar el .env no tiene efecto hasta reiniciar el proceso.
// Vive acá y no en cada consumidor porque hay dos caminos que la necesitan y no pueden divergir:
//   - `procesarFacturaService` la inyecta como `datos.impresora` al EMITIR desde la pantalla de caja.
//   - `reimpresionService` la usa para REIMPRIMIR un documento ya emitido.
// Si cada uno leyera su propio process.env, un futuro cambio de nombre de variable dejaría a uno de
// los dos imprimiendo y al otro no, sin que nada lo delate.
//
// Vacío = despliegue sin impresora (la nube): no se imprime nada y la reimpresión responde 400.
// Este módulo se mantiene SIN dependencias a propósito: lo importa tanto la capa de servicios como la
// de rutas/controllers (para exponer si la función está disponible), y no queremos arrastrar ni la JVM
// ni Prisma a esos puntos.
const IMPRESORA_TICKETS = process.env.IMPRESORA_TICKETS || '';

const impresionHabilitada = () => IMPRESORA_TICKETS !== '';

module.exports = { IMPRESORA_TICKETS, impresionHabilitada };
