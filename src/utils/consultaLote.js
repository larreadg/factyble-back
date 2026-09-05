// Soporte para los endpoints `POST /<recurso>/id-externo/consultar-lote`: resuelven hasta
// MAX_NUMEROS_CONSULTA_LOTE documentos por `id_externo` en una sola request, en vez de N llamadas a
// `GET /<recurso>/id-externo/:id`. Es un POST porque la lista de identificadores va en el body (una
// query string con 100 valores es frágil y tiene tope de longitud), pero no muta nada.
//
// El contrato de la respuesta es una lista PARALELA a la de la request: un ítem por cada valor pedido,
// en el mismo orden y conservando los duplicados, con `encontrado: false` para los que no existen. No
// hay 404 por elemento: un id_externo inexistente no puede tumbar la consulta de los otros 99, y desde
// afuera "no existe" y "es de otra empresa" son indistinguibles a propósito.

const { proyectar } = require("./fields");

// Tope de elementos por request. Mismo valor que el de los `bulk-insert` de factura / nota de crédito /
// recibo, para que un integrador maneje un único tamaño de lote en los dos sentidos. El chequeo vive en
// la cadena de express-validator de cada ruta, que importa ESTA constante — no repite el literal, para
// que los tres endpoints no puedan quedar con topes distintos.
const MAX_NUMEROS_CONSULTA_LOTE = 100;

// Este índice reimplementa en JS el criterio de comparación de la base, y tiene que ser al menos tan
// PERMISIVO como ella: el `IN (...)` ya filtró, así que el índice solo contiene filas que MySQL dio por
// coincidentes — aflojar acá no puede inventar resultados, pero quedarse corto SÍ pierde documentos que
// la base sí matcheó (salen con `encontrado: false` mientras el GET unitario los devuelve).
//
// `id_externo` es `utf8mb4_unicode_ci` (verificado en information_schema), que es case-insensitive,
// **PAD SPACE** y **accent-insensitive**. Con solo `.toLowerCase()` divergían dos ejes reales:
//   guardado "ERP-1 " / pedido "ERP-1"   -> MySQL: igual, JS: distinto
//   guardado "ERP-Á1" / pedido "ERP-A1"  -> MySQL: igual, JS: distinto
// (el espacio a la IZQUIERDA no entra: PAD SPACE solo ignora el relleno final, y ahí la base tampoco
// matchea — el GET unitario falla igual, así que los dos caminos siguen coincidiendo.)
//
// Residual asumido: la paridad exacta con `unicode_ci` no es replicable en JS —el UCA colapsa además
// cosas como "ß"="ss" o "æ"="ae"— y llegar hasta ahí exigiría traerse una tabla de collation. Los `id
// externo` son claves de sistemas ERP (ASCII alfanumérico con guiones en la práctica), así que se cubren
// los tres ejes que se dan en el mundo real y se acepta el resto. Un id que caiga en el residual se
// comporta como antes de esta normalización: `encontrado: false` en el lote, y el GET unitario lo trae.
const claveIdExterno = (valor) =>
  String(valor)
    // PAD SPACE: MySQL ignora el relleno a la derecha al comparar.
    .trimEnd()
    // Accent-insensitive: NFD separa la letra base de los diacríticos y se descartan estos últimos.
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

// Indexa por `id_externo` los documentos traídos de la base. `id_externo` NO es único: si hay varios
// con el mismo valor gana el de mayor id, igual que el GET unitario, que resuelve la ambigüedad con
// `orderBy: { id: 'desc' }`. Para que eso se cumpla el caller debe traerlos ordenados por id ASC — así
// el último `set` de cada clave es el más reciente.
const indexarPorIdExterno = (documentos) => {
  const indice = new Map();
  for (const documento of documentos) {
    indice.set(claveIdExterno(documento.id_externo), documento);
  }
  return indice;
};

// Arma la respuesta final proyectando cada documento encontrado sobre los `campos` pedidos (null =
// todos los del select). `numero` es el eco del valor tal como vino en la request — no el número
// impreso del documento, que viaja aparte en `numero_factura` / `numero_nota_credito` / `numero_recibo`.
const armarRespuestaConsultaLote = (numeros, indice, campos) =>
  numeros.map((numero) => {
    const documento = indice.get(claveIdExterno(numero));
    if (!documento) return { numero, encontrado: false };
    return { numero, encontrado: true, ...proyectar(documento, campos) };
  });

module.exports = {
  MAX_NUMEROS_CONSULTA_LOTE,
  indexarPorIdExterno,
  armarRespuestaConsultaLote,
};
