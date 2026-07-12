const java = require("java");
const path = require("path");
const dayjs = require("dayjs");
const QRCode = require("qrcode");
const { formatNumber } = require("./format");
const LOGOS_DIR = path.resolve(__dirname, "../..", process.env.LOGOS_DIR || "logos");
const PUBLIC_QR = path.resolve(__dirname, '../../public/qr');
const FACTYBLE_LOGO = path.resolve(__dirname, "..", "resources", "factura.png");

java.classpath.push(path.resolve(__dirname, "..", "resources/lib/jasperreports.jar"));
java.classpath.push(path.resolve(__dirname, "..", "resources/lib/jasperreports-fonts.jar"));
java.classpath.push(path.resolve(__dirname, "..", "resources/lib/commons-collections.jar"));
java.classpath.push(path.resolve(__dirname, "..", "resources/lib/itext.jar"));
java.classpath.push(path.resolve(__dirname, "..", "resources/lib/commons-logging.jar"));
java.classpath.push(path.resolve(__dirname, "..", "resources/lib/commons-digester.jar"));
java.classpath.push(path.resolve(__dirname, "..", "resources/lib/commons-beanutils.jar"));

const generarQr = async (url, filename) => {
  return new Promise((resolve, reject) => {
    QRCode.toFile(path.resolve(PUBLIC_QR, filename), url, (err) => {
      if (err) reject(err);
      resolve(`/public/qr/${filename}`);
    });
  });
};
const generarPdf = async (datos) => {
  try {
    // Rutas a JRXML y Jasper
    const jrxmlPath  = path.resolve(__dirname, "..", "resources", "Factura.jrxml");
    const jasperPath = path.resolve(__dirname, "..", "resources", "Factura.jasper");
    const outputPath = path.resolve(__dirname, "../../public", `${datos.uuid}.pdf`);

    // 1) Compila el JRXML a Jasper fresco
    const JasperCompileManager = java.import("net.sf.jasperreports.engine.JasperCompileManager");
    JasperCompileManager.compileReportToFileSync(jrxmlPath, jasperPath);

    // 2) Crea el HashMap de parámetros
    const HashMap = java.import("java.util.HashMap");
    const params  = new HashMap();
    if (datos.empresaLogo) {
      params.putSync("empresaLogo", path.resolve(LOGOS_DIR, datos.empresaLogo));
    }
    params.putSync("factyble",               FACTYBLE_LOGO);
    params.putSync("empresaRuc",             String(datos.empresaRuc));
    params.putSync("empresaTimbrado",        String(datos.empresaTimbrado));
    params.putSync("empresaVigenteDesde",    datos.empresaVigenteDesde);
    params.putSync("empresaNombre",          datos.empresaNombre);
    params.putSync("empresaDireccion",       datos.empresaDireccion);
    params.putSync("empresaTelefono",        String(datos.empresaTelefono));
    params.putSync("empresaCiudad",          datos.empresaCiudad);
    params.putSync("empresaCorreoElectronico", datos.empresaCorreoElectronico);
    params.putSync("facturaId",              datos.facturaId);
    params.putSync("fechaHora",              dayjs().format("YYYY-MM-DD HH:mm:ss"));
    params.putSync("condicionVenta",         datos.condicionVenta);
    params.putSync("moneda",                 datos.moneda);
    params.putSync("ruc",                    String(datos.ruc));
    params.putSync("razonSocial",            datos.razonSocial);
    params.putSync("correoElectronico",      datos.correoElectronico);
    params.putSync("total",                  formatNumber(datos.total));
    params.putSync("totalIva",               formatNumber(datos.totalIva));
    params.putSync("totalIva5",              formatNumber(datos.totalIva5));
    params.putSync("totalIva10",             formatNumber(datos.totalIva10));
    params.putSync("totalExenta",            formatNumber(datos.totalExenta));
    params.putSync("cdc",                    datos.cdc);
    params.putSync("tipoDocumento",          datos.tipoDocumento);
    params.putSync("tipoDocumentoTop",       datos.tipoDocumentoTop);

    // 3) Código de crédito condicional (si lo tienes en datos)
    if (datos.condicionVenta === "CREDITO") {
      if (datos.tipoCredito === "CUOTA") {
        params.putSync("tipoCredito",               "CUOTA");
        params.putSync("creditoCuotaCantidad",      datos.cantidadCuota);
        params.putSync("creditoCuotaPeriodicidad",  datos.periodicidad);
      } else if (datos.tipoCredito === "A_PLAZO") {
        params.putSync("tipoCredito",               "A PLAZO");
        params.putSync("creditoAPlazoDescripcion",  datos.plazoDescripcion);
      }
    }

    console.log("Mapa de parámetros:", params.toStringSync())

    // 4) Genera y añade el QR
    const qrFilename = `${datos.uuid}.png`;
    const qrPath     = await generarQr(datos.linkqr, qrFilename);
    params.putSync("qr", qrPath);

    // 5) Crea el data source (JRBeanArrayDataSource)
    const JRBeanArrayDataSource = java.import("net.sf.jasperreports.engine.data.JRBeanArrayDataSource");
    const itemList = datos.items.map(item => {
      const map = java.newInstanceSync("java.util.HashMap");
      Object.entries(item).forEach(([k, v]) => {
        map.putSync(k, v);
      });
      return map;
    });
    const JavaArray = java.newArray("java.util.Map", itemList);
    const dataSource = new JRBeanArrayDataSource(JavaArray);
    params.putSync("ds", dataSource);

    // 6) Llena el reporte
    const JasperFillManager = java.import("net.sf.jasperreports.engine.JasperFillManager");
    const jasperPrint = JasperFillManager.fillReportSync(
      jasperPath,
      params,
      new java.import("net.sf.jasperreports.engine.JREmptyDataSource")()
    );

    // 7) Exporta a PDF
    const JasperExportManager = java.import("net.sf.jasperreports.engine.JasperExportManager");
    JasperExportManager.exportReportToPdfFileSync(jasperPrint, outputPath);

    console.log("PDF generado exitosamente en:", outputPath);
    return { outputPath };
  }
  catch (error) {
    console.error("Error al generar PDF:", error);
    throw error;
  }
};

module.exports = generarPdf;
