const java = require("java");
const path = require("path");
const dayjs = require("dayjs");
const { formatNumber } = require("./format");

const PUBLIC_LOGOS = path.resolve(__dirname, "../../public/logos");
const PUBLIC_FIRMAS = path.resolve(__dirname, "../../public/firmas");

java.classpath.push(path.resolve(__dirname, "..", "resources/lib/jasperreports.jar"));
java.classpath.push(path.resolve(__dirname, "..", "resources/lib/jasperreports-fonts.jar"));
java.classpath.push(path.resolve(__dirname, "..", "resources/lib/commons-collections.jar"));
java.classpath.push(path.resolve(__dirname, "..", "resources/lib/itext.jar"));
java.classpath.push(path.resolve(__dirname, "..", "resources/lib/commons-logging.jar"));
java.classpath.push(path.resolve(__dirname, "..", "resources/lib/commons-digester.jar"));
java.classpath.push(path.resolve(__dirname, "..", "resources/lib/commons-beanutils.jar"));

const toStringValue = (value) => {
  if (value === null || value === undefined) return "";
  return String(value);
};

const formatAmount = (value) => {
  if (value === null || value === undefined || value === "") return "";
  return formatNumber(value);
};

const mapToJavaDataSource = (items) => {
  const JRBeanArrayDataSource = java.import("net.sf.jasperreports.engine.data.JRBeanArrayDataSource");
  const itemList = items.map((item) => {
    const map = java.newInstanceSync("java.util.HashMap");
    Object.entries(item).forEach(([key, value]) => {
      map.putSync(key, toStringValue(value));
    });
    return map;
  });
  const javaArray = java.newArray("java.util.Map", itemList);
  return new JRBeanArrayDataSource(javaArray);
};

const generarPdfRecibo = async (datos) => {
  try {
    const jrxmlPath = path.resolve(__dirname, "..", "resources", "Recibo.jrxml");
    const jasperPath = path.resolve(__dirname, "..", "resources", "Recibo.jasper");
    const pdfFilename = datos.reciboUuid || datos.reciboId;
    const outputPath = path.resolve(__dirname, "../../public", `${pdfFilename}.pdf`);

    const JasperCompileManager = java.import("net.sf.jasperreports.engine.JasperCompileManager");
    JasperCompileManager.compileReportToFileSync(jrxmlPath, jasperPath);

    const HashMap = java.import("java.util.HashMap");
    const params = new HashMap();

    if (datos.empresaLogo) {
      params.putSync("empresaLogo", path.resolve(PUBLIC_LOGOS, datos.empresaLogo));
    }

    if (datos.empresaFirma || datos.empresaRuc) {
      const firmaFilename = datos.empresaFirma || `${toStringValue(datos.empresaRuc)}.png`;
      params.putSync("empresaFirma", path.resolve(PUBLIC_FIRMAS, firmaFilename));
    }

    params.putSync("reciboId", toStringValue(datos.reciboId));
    params.putSync("fechaHora", toStringValue(datos.fechaHora || dayjs().format("YYYY-MM-DD HH:mm:ss")));
    params.putSync("ruc", toStringValue(datos.ruc));
    params.putSync("razonSocial", toStringValue(datos.razonSocial));
    params.putSync("correoElectronico", toStringValue(datos.correoElectronico));
    params.putSync("total", formatAmount(datos.total));
    params.putSync("empresaRuc", toStringValue(datos.empresaRuc));
    params.putSync("empresaTimbrado", toStringValue(datos.empresaTimbrado));
    params.putSync("empresaVigenteDesde", toStringValue(datos.empresaVigenteDesde));
    params.putSync("empresaNombre", toStringValue(datos.empresaNombre));
    params.putSync("empresaDireccion", toStringValue(datos.empresaDireccion));
    params.putSync("empresaCorreoElectronico", toStringValue(datos.empresaCorreoElectronico));
    params.putSync("empresaCiudad", toStringValue(datos.empresaCiudad));
    params.putSync("empresaTelefono", toStringValue(datos.empresaTelefono));
    params.putSync("tipoDocumento", toStringValue(datos.tipoDocumento));
    params.putSync("tipoDocumentoTop", toStringValue(datos.tipoDocumentoTop));
    params.putSync("totalEfectivo", formatAmount(datos.totalEfectivo) + '-');
    params.putSync("totalLetras", toStringValue(datos.totalLetras).toUpperCase() + '-');
    params.putSync("concepto", toStringValue(datos.concepto));

    const facturas = Array.isArray(datos.ds) && datos.ds.length > 0
      ? datos.ds.map((item) => ({
        facturaNumero: toStringValue(item.facturaNumero),
        importe: formatAmount(item.importe) + '-',
      }))
      : [{ facturaNumero: "-", importe: "-" }];

    const cheques = Array.isArray(datos.dsCheque) && datos.dsCheque.length > 0
      ? datos.dsCheque.map((item) => ({
        banco: toStringValue(item.banco),
        chequeNumero: toStringValue(item.chequeNumero),
        total: formatAmount(item.total) + '-',
      }))
      : [{ banco: "-", chequeNumero: "-", total: "-" }];

    params.putSync("ds", mapToJavaDataSource(facturas));
    params.putSync("dsCheque", mapToJavaDataSource(cheques));

    const JasperFillManager = java.import("net.sf.jasperreports.engine.JasperFillManager");
    const jasperPrint = JasperFillManager.fillReportSync(
      jasperPath,
      params,
      new java.import("net.sf.jasperreports.engine.JREmptyDataSource")()
    );

    const JasperExportManager = java.import("net.sf.jasperreports.engine.JasperExportManager");
    JasperExportManager.exportReportToPdfFileSync(jasperPrint, outputPath);

    return { outputPath };
  } catch (error) {
    console.error("Error al generar PDF de recibo:", error);
    throw error;
  }
};

module.exports = generarPdfRecibo;
