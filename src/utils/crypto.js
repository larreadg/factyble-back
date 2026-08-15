const crypto = require("crypto");
const ErrorApp = require("./error");

/**
 * Cifrado simétrico reversible de secretos a nivel aplicación (p. ej. la contraseña de un
 * certificado .p12 en `certificadoService.js` — antipatrón J de la API PHP legacy:
 * contraseña de certificado en texto plano en BD).
 * AES-256-GCM: la clave (`CERT_ENCRYPTION_KEY`, 32 bytes en hex, generada con
 * `crypto.randomBytes(32).toString('hex')`) vive solo en variable de entorno, nunca en BD.
 */
const ALGORITMO = "aes-256-gcm";
const LONGITUD_IV = 12;
const LONGITUD_AUTH_TAG = 16;

/**
 * Lee y valida la clave de cifrado desde `process.env.CERT_ENCRYPTION_KEY`.
 * @returns {Buffer} - Clave de 32 bytes
 */
const obtenerClave = () => {
  const claveHex = process.env.CERT_ENCRYPTION_KEY;
  if (!claveHex) {
    throw new ErrorApp("CERT_ENCRYPTION_KEY no esta configurada", 500);
  }
  const clave = Buffer.from(claveHex, "hex");
  if (clave.length !== 32) {
    throw new ErrorApp("CERT_ENCRYPTION_KEY invalida: se esperan 32 bytes en hexadecimal", 500);
  }
  return clave;
};

/**
 * Cifra un texto plano. El resultado empaqueta IV + auth tag + texto cifrado en un solo
 * string base64, listo para persistir en una columna `String`.
 * @param {string} textoPlano - Secreto a cifrar (p. ej. contraseña del .p12)
 * @returns {string} - Texto cifrado (base64)
 */
const encrypt = (textoPlano) => {
  if (typeof textoPlano !== "string" || textoPlano.length === 0) {
    throw new ErrorApp("No se puede cifrar un valor vacio", 400);
  }
  const clave = obtenerClave();
  const iv = crypto.randomBytes(LONGITUD_IV);
  const cipher = crypto.createCipheriv(ALGORITMO, clave, iv);
  const cifrado = Buffer.concat([cipher.update(textoPlano, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, cifrado]).toString("base64");
};

/**
 * Descifra un texto cifrado con `encrypt`. Lanza si la clave no coincide o el dato fue
 * alterado (el auth tag de GCM detecta ambos casos).
 * @param {string} textoCifrado - Texto cifrado (base64), tal como lo devuelve `encrypt`
 * @returns {string} - Texto plano original
 */
const decrypt = (textoCifrado) => {
  if (typeof textoCifrado !== "string" || textoCifrado.length === 0) {
    throw new ErrorApp("No se puede descifrar un valor vacio", 400);
  }
  const clave = obtenerClave();
  const datos = Buffer.from(textoCifrado, "base64");
  const iv = datos.subarray(0, LONGITUD_IV);
  const authTag = datos.subarray(LONGITUD_IV, LONGITUD_IV + LONGITUD_AUTH_TAG);
  const cifrado = datos.subarray(LONGITUD_IV + LONGITUD_AUTH_TAG);

  const decipher = crypto.createDecipheriv(ALGORITMO, clave, iv);
  decipher.setAuthTag(authTag);
  const descifrado = Buffer.concat([decipher.update(cifrado), decipher.final()]);
  return descifrado.toString("utf8");
};

/**
 * Descifra un valor que puede o no estar cifrado con `encrypt` — pensado para campos que antes se
 * guardaban en texto plano y todavía pueden tener filas viejas sin cifrar mientras no se corra un
 * backfill (p. ej. `Empresa.csc`, ver AUD-006 en STATIC_AUDIT_FINDINGS.json: hoy no existe ningún
 * endpoint/CRUD que escriba `Empresa.csc`, así que forzar `decrypt()` sin este fallback rompería el
 * único camino real por el que ese campo se carga hoy — directo en BD, en texto plano). Si `valor` no
 * fue cifrado con `encrypt()` (no es base64 válido con el formato esperado, o falla la verificación
 * del auth tag de GCM), se asume que es texto plano heredado y se devuelve tal cual, sin lanzar.
 * @param {string} valor
 * @returns {string} - Valor descifrado, o el valor original si no estaba cifrado
 */
const decryptTolerante = (valor) => {
  try {
    return decrypt(valor);
  } catch (_error) {
    return valor;
  }
};

module.exports = {
  encrypt,
  decrypt,
  decryptTolerante,
};
