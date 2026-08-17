// Dado el objeto `caja` que se incluye en un documento (con su `establecimiento` anidado adentro),
// lo separa en dos campos hermanos para la respuesta de los GET: `caja` (sin el establecimiento
// anidado) y `establecimiento`. Así cada documento expone su caja y su establecimiento de forma
// explícita en el mismo nivel, en vez de tener el establecimiento enterrado dentro de caja.
// Devuelve ambos en null cuando el documento no tiene caja (legacy con caja_id NULL).
const separarCajaEstablecimiento = (caja) => {
  if (!caja) return { caja: null, establecimiento: null };
  const { establecimiento = null, ...cajaSinEstablecimiento } = caja;
  return { caja: cajaSinEstablecimiento, establecimiento };
};

// Interpreta un filtro de búsqueda como número compuesto de documento en formato
// establecimiento-caja-numero (ej. "001-001-0000023"), que es exactamente como lo imprime
// formatNumeroDocumento (utils/format.js) y como se muestra en las grillas. Sólo devuelve un objeto cuando
// el filtro tiene forma de número compuesto — 3 segmentos numéricos separados por "-", "/" o espacios —, así
// no pisa la búsqueda por número simple ni por texto. Es tolerante con códigos sin ceros a la izquierda
// ("1-1-23" ≡ "001-001-0000023") porque establecimiento/caja se normalizan a 3 dígitos, igual que están
// guardados. Devuelve null si no aplica; si aplica, `{ establecimiento, caja, numero }` con
// establecimiento/caja como string de 3 dígitos y numero como entero seguro.
const parseNumeroCompuesto = (filter) => {
  if (typeof filter !== "string") return null;

  const partes = filter.trim().split(/[-/\s]+/).filter(Boolean);
  if (partes.length !== 3) return null;
  if (!partes.every((p) => /^[0-9]+$/.test(p))) return null;

  const [est, caja, num] = partes;

  // Los códigos de establecimiento/caja se persisten como 3 dígitos (001..999). Se normaliza el input a ese
  // formato para que "1" matchee "001". Un código de más de 3 dígitos no existe => no puede matchear.
  const pad3 = (s) => (s.length <= 3 ? s.padStart(3, "0") : s);

  const numero = Number(num);
  if (!Number.isSafeInteger(numero)) return null;

  return {
    establecimiento: pad3(est),
    caja: pad3(caja),
    numero,
  };
};

module.exports = { separarCajaEstablecimiento, parseNumeroCompuesto };
