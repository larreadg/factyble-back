// Soporte para el query param `fields` de los GET: permite pedir un subconjunto de los atributos de
// PRIMER NIVEL de cada documento (ej. ?fields=cdc,total,caja). La lista de atributos válidos es una
// lista cerrada definida por cada servicio (CAMPOS_*), para que el contrato sea explícito y no se
// filtren campos por error de tipeo.

// Divide el valor CSV del param en una lista de atributos, trimmeando y descartando vacíos/duplicados.
// Devuelve null cuando no se pasó `fields` (=> se devuelve el documento completo).
const parsearFields = (fieldsParam) => {
  if (fieldsParam === undefined || fieldsParam === null) return null;
  const fields = String(fieldsParam)
    .split(",")
    .map((f) => f.trim())
    .filter((f) => f.length > 0);
  return fields.length ? [...new Set(fields)] : null;
};

// Fabrica un validator de express-validator para `query('fields')`: acepta el param opcional y rechaza
// (400) cualquier atributo que no esté en la lista cerrada `camposPermitidos`.
const validarFields = (camposPermitidos) => (value) => {
  const fields = parsearFields(value);
  if (!fields) return true;
  const invalidos = fields.filter((f) => !camposPermitidos.includes(f));
  if (invalidos.length > 0) {
    throw new Error(
      `Campos inválidos en 'fields': ${invalidos.join(", ")}. Permitidos: ${camposPermitidos.join(", ")}`
    );
  }
  return true;
};

// Proyecta un objeto quedándose solo con las claves pedidas (primer nivel). Si `fields` es null
// devuelve el objeto intacto. Solo copia claves que existan en el objeto, así un campo desconocido
// nunca puede exponer datos que no estén en la respuesta.
const proyectar = (obj, fields) => {
  if (!fields || !obj) return obj;
  const salida = {};
  for (const f of fields) {
    if (Object.prototype.hasOwnProperty.call(obj, f)) salida[f] = obj[f];
  }
  return salida;
};

module.exports = { parsearFields, validarFields, proyectar };
