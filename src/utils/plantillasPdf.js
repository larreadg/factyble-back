// Plantillas de PDF de factura/nota de crédito disponibles. El valor es el nombre BASE del
// archivo en `src/resources/` — existe un par `<base>.jrxml` + `<base>.jasper` por cada una
// (Factura = color/tamaño carta, Factura80mm = ticket térmico 80mm, Factura58mm = ticket térmico
// 58mm, FacturaBN = blanco y negro).
// Cada empresa guarda cuál usa en `Empresa.plantilla_pdf`; si es null se cae a la default.
//
// Este módulo se mantiene libre de dependencias a propósito: lo importan tanto `generarPdf.js`
// (que carga la JVM vía el paquete `java`) como `empresaRoute.js` (validación), y no queremos
// arrastrar la carga del bridge nativo a la capa de rutas.
const PLANTILLAS_PDF = ["Factura", "Factura80mm", "Factura58mm", "FacturaBN"];

// Default histórica: `generarPdf` tenía hardcodeado FacturaBN antes de que esto fuera
// configurable, así que las empresas sin `plantilla_pdf` seteado siguen imprimiendo igual.
const PLANTILLA_PDF_DEFAULT = "FacturaBN";

// Normaliza una plantilla a un valor válido: si viene null/undefined o algo no reconocido,
// devuelve la default. Es el único punto que decide qué archivo se usa realmente al imprimir.
const resolverPlantillaPdf = (plantilla) =>
  PLANTILLAS_PDF.includes(plantilla) ? plantilla : PLANTILLA_PDF_DEFAULT;

// Subconjunto de `PLANTILLAS_PDF` que imprime en hoja A4 vertical (595x842pt). Es la única fuente
// del criterio "es una plantilla de hoja, no un ticket térmico": la imposición 2-up de
// `imponerDuplicadoPdf.js` solo aplica a estas, porque duplicar un ticket de 80mm/58mm lado a lado
// en una A4 horizontal no tiene sentido físico (el rollo no es una hoja).
const PLANTILLAS_PDF_A4 = ["Factura", "FacturaBN"];

// `plantilla` puede venir sin normalizar (null, o un valor no reconocido). Se resuelve primero para
// que el chequeo se haga sobre la plantilla que realmente se va a imprimir — la default histórica
// (FacturaBN) es A4, así que una empresa sin `plantilla_pdf` seteado sí entra en el duplicado.
const esPlantillaA4 = (plantilla) => PLANTILLAS_PDF_A4.includes(resolverPlantillaPdf(plantilla));

module.exports = { PLANTILLAS_PDF, PLANTILLAS_PDF_A4, PLANTILLA_PDF_DEFAULT, resolverPlantillaPdf, esPlantillaA4 };
