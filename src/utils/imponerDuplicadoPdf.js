const fs = require("fs/promises");
const { PDFDocument } = require("pdf-lib");
const { esPlantillaA4 } = require("./plantillasPdf");

// A4 horizontal en puntos PostScript (la vertical de los jrxml es 595.28 x 841.89).
const A4_HORIZONTAL = { ancho: 841.89, alto: 595.28 };
// Margen exterior y separación entre las dos copias. Valores chicos a propósito: el KuDE A4 vertical
// ya trae su propio margen dibujado, así que lo único que se necesita acá es que la impresora no
// recorte el borde y que quede una guía visual entre original y copia.
const MARGEN = 15;
const CANALETA = 10;

/**
 * Imposición 2-up: toma los bytes de un KuDE A4 vertical y devuelve un PDF A4 horizontal donde cada
 * página del original aparece estampada dos veces, lado a lado (original + copia). Multipágina: una
 * factura con muchos ítems genera un KuDE de N páginas y el resultado son N hojas horizontales, cada
 * una con su página duplicada — no se mezclan páginas distintas en la misma hoja.
 *
 * La escala es uniforme (`Math.min` sobre ambos ejes) para no deformar el KuDE; en la práctica queda
 * en ~66%, y el QR sigue siendo escaneable a ese tamaño.
 *
 * @param {Uint8Array|Buffer} pdfBytes - PDF vertical ya generado por JasperReports
 * @returns {Promise<Uint8Array>} PDF A4 horizontal con las copias lado a lado
 */
const imponerDuplicado = async (pdfBytes) => {
  const src = await PDFDocument.load(pdfBytes);
  const out = await PDFDocument.create();

  const anchoSlot = (A4_HORIZONTAL.ancho - MARGEN * 2 - CANALETA) / 2;
  const altoSlot = A4_HORIZONTAL.alto - MARGEN * 2;

  // `embedPdf` con todos los índices de una: cada página del original se embebe UNA sola vez como
  // XObject y se dibuja dos veces, así el archivo resultante no duplica el contenido en bytes.
  const embebidas = await out.embedPdf(src, src.getPageIndices());

  for (const emb of embebidas) {
    const escala = Math.min(anchoSlot / emb.width, altoSlot / emb.height);
    const ancho = emb.width * escala;
    const alto = emb.height * escala;
    const y = (A4_HORIZONTAL.alto - alto) / 2;

    const hoja = out.addPage([A4_HORIZONTAL.ancho, A4_HORIZONTAL.alto]);
    hoja.drawPage(emb, { x: MARGEN, y, width: ancho, height: alto });
    hoja.drawPage(emb, { x: MARGEN + anchoSlot + CANALETA, y, width: ancho, height: alto });
  }

  return out.save();
};

/**
 * Aplica `imponerDuplicado` sobre un PDF ya escrito en disco, SOBRESCRIBIENDO el mismo path. Esa es
 * la propiedad que hace que el resto del sistema no se entere: el registro en la BD, el endpoint de
 * descarga (`/public/<uuid>.pdf`), el adjunto del correo y el bot de WhatsApp siguen apuntando al
 * mismo archivo con el mismo nombre.
 *
 * Nunca lanza. Llega a correrse con el DE ya firmado y aceptado — un fallo de post-proceso cosmético
 * no puede tumbar la emisión ni dejarla sin PDF, así que ante cualquier error se loguea con contexto
 * y el archivo queda como estaba (vertical, sin duplicar).
 *
 * @param {Object} datos
 * @param {string} datos.pdfPath - Path absoluto del PDF a sobrescribir
 * @param {string|number} [datos.empresaId] - Solo para el log
 * @param {string|number} [datos.documentoId] - Solo para el log (número formateado o uuid)
 * @returns {Promise<boolean>} true si el archivo quedó duplicado, false si se dejó el original
 */
const aplicarDuplicadoEnArchivo = async ({ pdfPath, empresaId, documentoId }) => {
  // Se escribe a un temporal y recién ahí se renombra sobre el destino. `writeFile` abre con 'w', que
  // TRUNCA el PDF vertical bueno antes de escribir: si la escritura falla a mitad (ENOSPC en `public/`,
  // EIO), el catch de abajo loguearía "se deja el original" cuando en realidad quedó un archivo
  // truncado, y `emitirFactura` seguiría adelante adjuntándolo al correo y al bot de WhatsApp. Con
  // rename —atómico dentro del mismo filesystem, por eso el temporal va al lado del destino y no en
  // os.tmpdir()— el original solo desaparece cuando ya hay un reemplazo completo en disco.
  const tmpPath = `${pdfPath}.tmp`;
  try {
    const original = await fs.readFile(pdfPath);
    const duplicado = await imponerDuplicado(original);
    await fs.writeFile(tmpPath, duplicado);
    await fs.rename(tmpPath, pdfPath);
    console.log(`[duplicarDoc] PDF duplicado en A4 horizontal: ${pdfPath}`);
    return true;
  } catch (error) {
    // El temporal puede haber quedado a medias; se limpia sin tapar el error real.
    await fs.unlink(tmpPath).catch(() => {});
    console.error(
      `[duplicarDoc] Error al imponer el duplicado (empresaId=${empresaId}, documentoId=${documentoId}, path=${pdfPath}) — se deja el PDF vertical original:`,
      error
    );
    return false;
  }
};

module.exports = { imponerDuplicado, aplicarDuplicadoEnArchivo, esPlantillaA4 };
