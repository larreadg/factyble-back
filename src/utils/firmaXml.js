// Firmador XML-DSig genérico (enveloped, RSA-SHA256, C14N exclusivo).
//
// Por qué existe si ya hay services/sifen/firmadorService.js: ese firmador envuelve
// `facturacionelectronicapy-xmlsign`, cuya implementación Node (XMLDsigNode) está cableada a la estructura
// del DE de SIFEN — hace `jsonXML.rDE[tag][0].$.Id`, que lanza con cualquier raíz que no sea `rDE`. El XML
// propio del recibo (utils/reciboXml.js) no es un `rDE`, así que necesita una firma genérica.
//
// Se usa el mismo stack criptográfico que la vía Node de xmlsign (xml-crypto + node-forge, sin
// child_process), evitando por completo la vía Java de xmlsign (inyección de comandos vía password del
// P12 — ver el comentario en firmadorService.js). La clave privada y el certificado se extraen del .p12
// con node-forge y se pasan en PEM a xml-crypto.

const fs = require("fs");
const { SignedXml } = require("xml-crypto");
const forge = require("node-forge");
const ErrorApp = require("./error");

const ALGO_FIRMA = "http://www.w3.org/2001/04/xmldsig-more#rsa-sha256";
const ALGO_C14N = "http://www.w3.org/2001/10/xml-exc-c14n#";
const ALGO_DIGEST = "http://www.w3.org/2001/04/xmlenc#sha256";
const TRANSFORM_ENVELOPED = "http://www.w3.org/2000/09/xmldsig#enveloped-signature";

// Extrae { privateKeyPem, certPem, certBase64 } de un archivo .p12/.pfx usando node-forge.
const extraerClaveYCertificado = (certificadoPath, certificadoPassword) => {
  if (!fs.existsSync(certificadoPath)) {
    throw new ErrorApp(`Certificado no encontrado: ${certificadoPath}`, 400);
  }
  const der = fs.readFileSync(certificadoPath, "binary");
  const p12Asn1 = forge.asn1.fromDer(der);
  const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, certificadoPassword);

  // La clave privada puede venir cifrada (pkcs8ShroudedKeyBag, lo habitual) o en claro (keyBag).
  let keyBag =
    (p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[forge.pki.oids.pkcs8ShroudedKeyBag] || [])[0] ||
    (p12.getBags({ bagType: forge.pki.oids.keyBag })[forge.pki.oids.keyBag] || [])[0];

  const certBag = (p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag] || [])[0];

  if (!keyBag || !keyBag.key) {
    throw new ErrorApp("El certificado no contiene una clave privada legible", 400);
  }
  if (!certBag || !certBag.cert) {
    throw new ErrorApp("El certificado no contiene un certificado X.509 legible", 400);
  }

  const privateKeyPem = forge.pki.privateKeyToPem(keyBag.key);
  const certPem = forge.pki.certificateToPem(certBag.cert);
  const certBase64 = certPem
    .replace(/-----BEGIN CERTIFICATE-----/g, "")
    .replace(/-----END CERTIFICATE-----/g, "")
    .replace(/\s+/g, "");

  return { privateKeyPem, certPem, certBase64 };
};

/**
 * Firma un XML genérico insertando una firma XML-DSig enveloped como hijo del nodo `tag`.
 * La Reference apunta a `//*[local-name()='<tag>']` con transforms enveloped + exc-c14n y digest SHA-256.
 *
 * @param {Object} datos
 * @param {string} datos.xml - XML sin firmar
 * @param {string} datos.tag - Nombre local del nodo a firmar (ej. "Recibo")
 * @param {string} datos.certificadoPath - Path del .p12 en filesystem
 * @param {string} datos.certificadoPassword - Contraseña del .p12, ya descifrada
 * @returns {Promise<string>} XML firmado
 */
const firmarXmlGenerico = async ({ xml, tag, certificadoPath, certificadoPassword }) => {
  try {
    const { privateKeyPem, certBase64 } = extraerClaveYCertificado(certificadoPath, certificadoPassword);

    const sig = new SignedXml({
      privateKey: privateKeyPem,
      publicKey: certBase64,
      signatureAlgorithm: ALGO_FIRMA,
      canonicalizationAlgorithm: ALGO_C14N,
      getKeyInfoContent: () => `<X509Data><X509Certificate>${certBase64}</X509Certificate></X509Data>`,
    });

    sig.addReference({
      xpath: `//*[local-name()='${tag}']`,
      digestAlgorithm: ALGO_DIGEST,
      transforms: [TRANSFORM_ENVELOPED, ALGO_C14N],
    });

    // La firma se agrega como último hijo del nodo firmado (enveloped): así el transform enveloped-signature
    // la excluye del digest y la Reference sigue siendo válida.
    sig.computeSignature(xml, {
      location: { reference: `//*[local-name()='${tag}']`, action: "append" },
    });

    return sig.getSignedXml();
  } catch (error) {
    ErrorApp.handleServiceError(error, "Error al firmar el XML del recibo");
  }
};

module.exports = { firmarXmlGenerico };
