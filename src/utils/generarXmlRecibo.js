const fs = require("fs");
const path = require("path");

const escaparXml = (valor) =>
  String(valor ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

const tag = (nombre, valor) => `<${nombre}>${escaparXml(valor)}</${nombre}>`;

/**
 * Genera un XML con los datos del recibo y lo escribe en public/{reciboUuid}.xml.
 * No es un documento SIFEN: es una representacion estructurada de los datos del recibo.
 *
 * @returns {{ outputPath: string, filename: string }}
 */
const generarXmlRecibo = (datos) => {
  const {
    reciboUuid,
    reciboId,
    numeroRecibo,
    fechaHora,
    concepto,
    totalLetras,
    empresa,
    cliente,
    facturas = [],
    notasCredito = [],
    cheques = [],
    transferencias = [],
    totalEfectivo,
    totalCheques,
    totalTransferencias,
    total,
  } = datos;

  const facturasXml = facturas
    .map(
      (f) =>
        `      <Factura>${tag("Numero", f.numero)}${tag(
          "MontoAplicado",
          f.montoAplicado
        )}</Factura>`
    )
    .join("\n");

  const notasXml = notasCredito
    .map(
      (n) =>
        `      <NotaCredito>${tag("Numero", n.numero)}${tag(
          "MontoAplicado",
          n.montoAplicado
        )}</NotaCredito>`
    )
    .join("\n");

  const chequesXml = cheques
    .map(
      (c) =>
        `      <Cheque>${tag("Banco", c.banco)}${tag(
          "Numero",
          c.numeroReferencia
        )}${tag("Monto", c.monto)}</Cheque>`
    )
    .join("\n");

  const transferenciasXml = transferencias
    .map(
      (t) =>
        `      <Transferencia>${tag("Banco", t.banco)}${tag(
          "NumeroReferencia",
          t.numeroReferencia
        )}${tag("Monto", t.monto)}</Transferencia>`
    )
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Recibo>
  <Identificacion>
    ${tag("ReciboId", reciboId)}
    ${tag("NumeroRecibo", numeroRecibo)}
    ${tag("Uuid", reciboUuid)}
    ${tag("FechaHora", fechaHora)}
    ${tag("Concepto", concepto)}
  </Identificacion>
  <Empresa>
    ${tag("Ruc", empresa.ruc)}
    ${tag("Nombre", empresa.nombre)}
    ${tag("Timbrado", empresa.timbrado)}
  </Empresa>
  <Cliente>
    ${tag("Ruc", cliente.ruc)}
    ${tag("RazonSocial", cliente.razonSocial)}
    ${tag("Email", cliente.email)}
  </Cliente>
  <DocumentosAplicados>
${facturasXml}
${notasXml}
  </DocumentosAplicados>
  <MediosDePago>
    ${tag("Efectivo", totalEfectivo)}
${chequesXml}
${transferenciasXml}
  </MediosDePago>
  <Totales>
    ${tag("Efectivo", totalEfectivo)}
    ${tag("Cheques", totalCheques)}
    ${tag("Transferencias", totalTransferencias)}
    ${tag("Total", total)}
    ${tag("TotalEnLetras", totalLetras)}
  </Totales>
</Recibo>
`;

  const outputPath = path.resolve(
    __dirname,
    "../../public",
    `${reciboUuid}.xml`
  );
  fs.writeFileSync(outputPath, xml, { encoding: "utf-8" });

  return { outputPath, filename: `${reciboUuid}.xml` };
};

module.exports = generarXmlRecibo;
