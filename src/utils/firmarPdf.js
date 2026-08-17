const fs = require("fs");
const signpdf = require("@signpdf/signpdf").default;
const { P12Signer } = require("@signpdf/signer-p12");
const { plainAddPlaceholder } = require("@signpdf/placeholder-plain");

/**
 * Firma digitalmente (firma invisible) un PDF ya existente en disco usando el
 * certificado PKCS#12 (.p12) de la empresa. Sobrescribe el mismo archivo con la
 * version firmada.
 *
 * Es resiliente: si la empresa no tiene certificado configurado, o el archivo no
 * existe, no firma y devuelve { firmado: false } sin lanzar error, para no romper
 * la emision del recibo.
 *
 * @param {Object} params
 * @param {string} params.pdfPath   Ruta absoluta al PDF a firmar.
 * @param {string} [params.certPath] Ruta al certificado .p12 (empresa.cert_path).
 * @param {string} [params.certPw]   Contrasena del certificado (empresa.cert_pw).
 * @param {string} [params.reason]   Motivo de la firma.
 * @param {string} [params.name]     Nombre del firmante.
 * @param {string} [params.location] Ubicacion.
 * @returns {Promise<{ firmado: boolean, motivo?: string }>}
 */
const firmarPdf = async ({
  pdfPath,
  certPath,
  certPw,
  reason = "Firma electronica del recibo",
  name,
  location,
}) => {
  if (!certPath || !certPw) {
    return { firmado: false, motivo: "empresa sin certificado configurado" };
  }

  if (!fs.existsSync(certPath)) {
    return { firmado: false, motivo: `certificado no encontrado en ${certPath}` };
  }

  const p12Buffer = fs.readFileSync(certPath);

  let pdfBuffer = fs.readFileSync(pdfPath);
  pdfBuffer = plainAddPlaceholder({
    pdfBuffer,
    reason,
    contactInfo: "",
    name: name || "",
    location: location || "",
    // Margen amplio para certificados con cadena larga; el default (8192) puede
    // quedar corto y hacer fallar la firma ("Signature exceeds placeholder").
    signatureLength: 16384,
  });

  const signer = new P12Signer(p12Buffer, { passphrase: certPw });
  const signedPdf = await signpdf.sign(pdfBuffer, signer);

  fs.writeFileSync(pdfPath, signedPdf);

  return { firmado: true };
};

module.exports = firmarPdf;
