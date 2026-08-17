const fs = require("fs");
const forge = require("node-forge");
const { SignedXml } = require("xml-crypto");

const RSA_SHA256 = "http://www.w3.org/2001/04/xmldsig-more#rsa-sha256";
const SHA256 = "http://www.w3.org/2001/04/xmlenc#sha256";
const EXC_C14N = "http://www.w3.org/2001/10/xml-exc-c14n#";
const ENVELOPED = "http://www.w3.org/2000/09/xmldsig#enveloped-signature";

/**
 * Extrae la clave privada y el certificado (hoja) en PEM desde un archivo PKCS#12.
 * @returns {{ pemKey: string, pemCert: string }}
 */
const extraerDesdeP12 = (certPath, certPw) => {
  const p12Der = fs.readFileSync(certPath, "binary");
  const p12Asn1 = forge.asn1.fromDer(p12Der);
  const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, false, certPw);

  // Clave privada (puede estar en un keyBag cifrado o sin cifrar)
  let keyBag =
    (p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[
      forge.pki.oids.pkcs8ShroudedKeyBag
    ] || [])[0];
  if (!keyBag) {
    keyBag =
      (p12.getBags({ bagType: forge.pki.oids.keyBag })[
        forge.pki.oids.keyBag
      ] || [])[0];
  }
  if (!keyBag || !keyBag.key) {
    throw new Error("No se encontro la clave privada en el certificado .p12");
  }
  const key = keyBag.key;

  // Certificado hoja: el que corresponde a la clave privada (por modulo).
  const certBags =
    p12.getBags({ bagType: forge.pki.oids.certBag })[
      forge.pki.oids.certBag
    ] || [];
  if (certBags.length === 0) {
    throw new Error("No se encontro certificado en el .p12");
  }
  let leaf = certBags[0].cert;
  for (const cb of certBags) {
    const pub = cb.cert && cb.cert.publicKey;
    if (pub && pub.n && key.n && pub.n.equals(key.n)) {
      leaf = cb.cert;
      break;
    }
  }

  return {
    pemKey: forge.pki.privateKeyToPem(key),
    pemCert: forge.pki.certificateToPem(leaf),
  };
};

/**
 * Firma digitalmente (XML-DSig enveloped, RSA-SHA256) el XML en disco usando el
 * certificado PKCS#12 (.p12) de la empresa. Sobrescribe el mismo archivo con la
 * version firmada (la firma se agrega como ultimo hijo del elemento raiz).
 *
 * Resiliente: si no hay certificado configurado o el archivo no existe, no firma
 * y devuelve { firmado: false } sin lanzar, para no romper la emision del recibo.
 *
 * @param {Object} params
 * @param {string} params.xmlPath  Ruta al XML a firmar.
 * @param {string} [params.certPath] Ruta al .p12 (empresa.cert_path).
 * @param {string} [params.certPw]   Contrasena del .p12 (empresa.cert_pw).
 * @returns {{ firmado: boolean, motivo?: string }}
 */
const firmarXml = ({ xmlPath, certPath, certPw }) => {
  if (!certPath || !certPw) {
    return { firmado: false, motivo: "empresa sin certificado configurado" };
  }
  if (!fs.existsSync(certPath)) {
    return { firmado: false, motivo: `certificado no encontrado en ${certPath}` };
  }

  const { pemKey, pemCert } = extraerDesdeP12(certPath, certPw);
  const xml = fs.readFileSync(xmlPath, "utf-8");

  const sig = new SignedXml({
    privateKey: pemKey,
    publicCert: pemCert,
    signatureAlgorithm: RSA_SHA256,
    canonicalizationAlgorithm: EXC_C14N,
  });

  sig.addReference({
    xpath: "/*",
    transforms: [ENVELOPED, EXC_C14N],
    digestAlgorithm: SHA256,
  });

  sig.computeSignature(xml, {
    location: { reference: "/*", action: "append" },
  });

  fs.writeFileSync(xmlPath, sig.getSignedXml(), { encoding: "utf-8" });

  return { firmado: true };
};

module.exports = firmarXml;
