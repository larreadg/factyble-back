// Plantillas de PDF de factura/nota de crédito disponibles. El valor es el nombre BASE del
// archivo en `src/resources/` — existe un par `<base>.jrxml` + `<base>.jasper` por cada una
// (Factura = color/tamaño carta, Factura80mm = ticket térmico 80mm, FacturaBN = blanco y negro).
// Cada empresa guarda cuál usa en `Empresa.plantilla_pdf`; si es null se cae a la default.
//
// Este módulo se mantiene libre de dependencias a propósito: lo importan tanto `generarPdf.js`
// (que carga la JVM vía el paquete `java`) como `empresaRoute.js` (validación), y no queremos
// arrastrar la carga del bridge nativo a la capa de rutas.
const PLANTILLAS_PDF = ["Factura", "Factura80mm", "FacturaBN"];

// Default histórica: `generarPdf` tenía hardcodeado FacturaBN antes de que esto fuera
// configurable, así que las empresas sin `plantilla_pdf` seteado siguen imprimiendo igual.
const PLANTILLA_PDF_DEFAULT = "FacturaBN";

// Normaliza una plantilla a un valor válido: si viene null/undefined o algo no reconocido,
// devuelve la default. Es el único punto que decide qué archivo se usa realmente al imprimir.
const resolverPlantillaPdf = (plantilla) =>
  PLANTILLAS_PDF.includes(plantilla) ? plantilla : PLANTILLA_PDF_DEFAULT;

module.exports = { PLANTILLAS_PDF, PLANTILLA_PDF_DEFAULT, resolverPlantillaPdf };
