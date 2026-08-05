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

module.exports = { separarCajaEstablecimiento };
