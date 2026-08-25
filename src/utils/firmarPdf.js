// Firma criptográfica INVISIBLE (PKCS#7 / PAdES-básico) de un PDF ya generado.
//
// Se firma en Node puro con `@signpdf` (usa node-forge por debajo), NO con iText/Java. Motivo: la firma de
// iText 2.1.7 (com.lowagie) depende de una versión legacy de BouncyCastle (org.bouncycastle.asn1.DEREncodable)
// que no está —ni conviene agregar— en el classpath; además evita por completo la fragilidad del bridge Java
// para esta operación. `@signpdf` agrega un placeholder de firma al PDF existente (incremental update, sin
// tocar el layout: firma invisible) y luego lo firma con el .p12.
//
// El PDF de entrada lo produce JasperReports/iText (generarPdfRecibo.js); acá sólo se lo firma en el lugar.

const fs = require("fs");
const signpdf = require("@signpdf/signpdf").default;
const { plainAddPlaceholder } = require("@signpdf/placeholder-plain");
const { P12Signer } = require("@signpdf/signer-p12");

/**
 * Firma un PDF en el lugar (reemplaza el archivo original por su versión firmada). La firma es invisible:
 * no agrega ningún widget visible ni altera el contenido renderizado.
 *
 * @param {Object} datos
 * @param {string} datos.pdfPath - Path del PDF a firmar (se sobrescribe con el firmado)
 * @param {string} datos.certificadoPath - Path del .p12 en filesystem
 * @param {string} datos.certificadoPassword - Contraseña del .p12, ya descifrada
 * @param {string} [datos.motivo] - Razón de la firma (metadato)
 * @param {string} [datos.ubicacion] - Ubicación (metadato)
 * @returns {Promise<{pdfPath: string}>}
 */
const firmarPdf = async ({ pdfPath, certificadoPath, certificadoPassword, motivo, ubicacion }) => {
  if (!fs.existsSync(pdfPath)) {
    throw new Error(`PDF no encontrado para firmar: ${pdfPath}`);
  }
  if (!fs.existsSync(certificadoPath)) {
    throw new Error(`Certificado no encontrado: ${certificadoPath}`);
  }

  const p12Buffer = fs.readFileSync(certificadoPath);

  // 1) Insertar el placeholder de firma (ByteRange + /Contents vacío) en el PDF existente.
  const pdfConPlaceholder = plainAddPlaceholder({
    pdfBuffer: fs.readFileSync(pdfPath),
    reason: motivo || "Firma electronica del emisor",
    location: ubicacion || "",
    contactInfo: "",
    name: "",
  });

  // 2) Firmar el PDF con el .p12.
  const signer = new P12Signer(p12Buffer, { passphrase: certificadoPassword });
  const pdfFirmado = await signpdf.sign(pdfConPlaceholder, signer);

  // 3) Reemplazar el PDF original por el firmado.
  fs.writeFileSync(pdfPath, pdfFirmado);
  return { pdfPath };
};

module.exports = firmarPdf;
