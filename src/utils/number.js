const ErrorApp = require("./error");

const parseEntero = (value, campo, { min = 0 } = {}) => {
  const texto = String(value ?? "").trim();
  if (!/^\d+$/.test(texto)) {
    throw new ErrorApp(`Parametro ${campo} invalido: debe ser entero`, 400);
  }

  const numero = Number(texto);
  if (!Number.isSafeInteger(numero) || numero < min) {
    throw new ErrorApp(`Parametro ${campo} invalido`, 400);
  }

  return numero;
};

module.exports = {
  parseEntero,
};

