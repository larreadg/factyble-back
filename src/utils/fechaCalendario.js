const dayjs = require("dayjs");
const utc = require("dayjs/plugin/utc");

dayjs.extend(utc);

/**
 * Formatea una fecha-CALENDARIO (un día del almanaque, sin componente horario significativo) como
 * `YYYY-MM-DD`.
 *
 * Prisma persiste estas columnas —`Empresa.vigente_desde`, `Empresa.vigente_hasta`— como medianoche
 * UTC del día real: `new Date("2026-12-31")` es `2026-12-31T00:00:00.000Z`. Leerlas con los getters
 * locales (`dayjs(fecha)`, `Date#getDate()`, etc.) las reinterpreta como un INSTANTE y, en cualquier
 * huso negativo, devuelve el día anterior — en `America/Asuncion` (UTC-3) ese valor se lee
 * `2026-12-30`.
 *
 * No es hipotético: es la causa raíz de un rechazo SIFEN real, 1107 "Fecha de inicio de vigencia del
 * timbrado incorrecta", reproducido y confirmado contra el XML firmado (`<dFeIniT>` salía un día antes
 * que `Empresa.vigente_desde`). El mismo error en el KuDE imprime un timbrado que parece vencido un
 * día antes de tiempo. Se lee el día tal cual está guardado, sin reinterpretarlo en otro huso.
 *
 * NO usar para timestamps con hora significativa (`fecha_creacion`, `fecha_firma`, la fecha de emisión
 * del DE): esos sí son instantes y van convertidos a la zona de facturación — ver
 * `formatearFechaHoraISO` en `services/sifen/xmlBuilderService.js`.
 *
 * @param {Date|string|null|undefined} fecha
 * @returns {string|null} `YYYY-MM-DD`, o `null` si no hay fecha (las columnas nullable no deben
 *   imprimir "Invalid Date" en el KuDE)
 */
const formatearFechaCalendario = (fecha) => {
  if (fecha === null || fecha === undefined || fecha === "") return null;
  return dayjs.utc(fecha).format("YYYY-MM-DD");
};

module.exports = { formatearFechaCalendario };
