// Origen del documento (`Factura.fuente` / `NotaCredito.fuente`, enum FuenteDocumento del schema).
// La lista se replica acá porque los validators de express-validator necesitan un array plano y el
// cliente Prisma no expone el enum de forma utilizable en un `isIn(...)`. Si se agrega un valor al
// enum en prisma/schema.prisma, agregarlo también acá.
//
// NO es solo metadata descriptiva: `loteService.notificarResultadoDocumento` reenvía al bot de
// WhatsApp el resultado final de SIFEN únicamente para los documentos con `fuente === "BOT"`. Cambiar
// la fuente de un documento cambia si su emisor recibe o no ese aviso automático.
const FUENTES_DOCUMENTO = ["APP", "API", "BOT"];

// Default de los endpoints /simple y /bulk-insert cuando el body no manda `fuente`. Esos endpoints
// nacieron para el bot de WhatsApp y tenían "BOT" hardcodeado, así que el default preserva el
// comportamiento histórico de todo integrador que ya los use: quien no mande nada sigue siendo BOT y
// sigue recibiendo el aviso del bot.
const FUENTE_SIMPLE_POR_DEFECTO = "BOT";

module.exports = { FUENTES_DOCUMENTO, FUENTE_SIMPLE_POR_DEFECTO };
