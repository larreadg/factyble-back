const java = require("java");
const path = require("path");
const dayjs = require("dayjs");
const QRCode = require("qrcode");
const { formatNumber } = require("./format");
const { resolverPlantillaPdf, esPlantillaA4 } = require("./plantillasPdf");
const { aplicarDuplicadoEnArchivo } = require("./imponerDuplicadoPdf");
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

// Todos los parámetros del Factura.jrxml son java.lang.String. Si un valor llega null/undefined hay
// que mandar "" y no dejar que se imprima "null" en el KUDE — ojo que String(null) === "null", por eso
// no alcanza con String(...). Mismo criterio que generarPdfRecibo.js.
const toStringValue = (value) => {
  if (value === null || value === undefined) return "";
  return String(value);
};

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
    // Rutas a JRXML y Jasper — el nombre base sale de la plantilla configurada en la empresa
    // (Factura / Factura80mm / FacturaBN). `resolverPlantillaPdf` cae a la default si viene null
    // o un valor no reconocido, así que acá siempre se resuelve a un par de archivos existente.
    const plantilla  = resolverPlantillaPdf(datos.plantilla);
    const jrxmlPath  = path.resolve(__dirname, "..", "resources", `${plantilla}.jrxml`);
    const jasperPath = path.resolve(__dirname, "..", "resources", `${plantilla}.jasper`);
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
    params.putSync("empresaRuc",             toStringValue(datos.empresaRuc));
    params.putSync("empresaTimbrado",        toStringValue(datos.empresaTimbrado));
    params.putSync("empresaVigenteDesde",    toStringValue(datos.empresaVigenteDesde));
    // Fin de vigencia del timbrado. Puede no estar cargado (columna nullable): ahí va "" y el jrxml
    // no dibuja la línea — por eso el caller no debe mandar un dayjs(null).format(), que daría el
    // string "Invalid Date" impreso en el KuDE.
    params.putSync("empresaVigenteHasta",    toStringValue(datos.empresaVigenteHasta));
    params.putSync("empresaNombre",          toStringValue(datos.empresaNombre));
    params.putSync("empresaDireccion",       toStringValue(datos.empresaDireccion));
    params.putSync("empresaTelefono",        toStringValue(datos.empresaTelefono));
    params.putSync("empresaCiudad",          toStringValue(datos.empresaCiudad));
    params.putSync("empresaCorreoElectronico", toStringValue(datos.empresaCorreoElectronico));
    // Actividades económicas del emisor: solo la descripción (dDesActEco), sin el código. Se mandan
    // siempre, incluso vacías: los jrxml que las imprimen las ocultan con printWhenExpression sobre
    // string vacío, y los que todavía no declaran el parámetro simplemente lo ignoran al llenar el
    // reporte (JasperReports lee solo los parámetros declarados; las claves de más no molestan).
    params.putSync("empresaActEc1",          toStringValue(datos.empresaActEc1));
    params.putSync("empresaActEc2",          toStringValue(datos.empresaActEc2));
    params.putSync("facturaId",              toStringValue(datos.facturaId));
    params.putSync("fechaHora",              dayjs().format("YYYY-MM-DD HH:mm:ss"));
    params.putSync("condicionVenta",         toStringValue(datos.condicionVenta));
    params.putSync("moneda",                 toStringValue(datos.moneda));
    params.putSync("ruc",                    toStringValue(datos.ruc));
    params.putSync("razonSocial",            toStringValue(datos.razonSocial));
    params.putSync("correoElectronico",      toStringValue(datos.correoElectronico));
    params.putSync("total",                  formatNumber(datos.total));
    params.putSync("totalIva",               formatNumber(datos.totalIva));
    params.putSync("totalIva5",              formatNumber(datos.totalIva5));
    params.putSync("totalIva10",             formatNumber(datos.totalIva10));
    params.putSync("totalExenta",            formatNumber(datos.totalExenta));
    params.putSync("cdc",                    toStringValue(datos.cdc));
    params.putSync("tipoDocumento",          toStringValue(datos.tipoDocumento));
    params.putSync("tipoDocumentoTop",       toStringValue(datos.tipoDocumentoTop));

    // 3) Código de crédito condicional (si lo tienes en datos)
    if (datos.condicionVenta === "CREDITO") {
      if (datos.tipoCredito === "CUOTA") {
        params.putSync("tipoCredito",               "CUOTA");
        params.putSync("creditoCuotaCantidad",      toStringValue(datos.cantidadCuota));
        params.putSync("creditoCuotaPeriodicidad",  toStringValue(datos.periodicidad));
      } else if (datos.tipoCredito === "A_PLAZO") {
        params.putSync("tipoCredito",               "A PLAZO");
        params.putSync("creditoAPlazoDescripcion",  toStringValue(datos.plazoDescripcion));
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
        map.putSync(k, toStringValue(v));
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

    // 8) Duplicado opcional (empresa.duplicar_doc): post-proceso 2-up que reescribe el MISMO path con
    // la versión A4 horizontal de dos copias lado a lado. Se hace acá, en el único punto que escribe
    // el archivo, para que valga por igual para facturas y notas de crédito y para que no pueda
    // aplicarse dos veces sobre el mismo PDF. Solo para las plantillas de hoja: un ticket térmico
    // 80mm/58mm queda fuera aunque el flag esté prendido.
    // No corta el flujo si falla — `aplicarDuplicadoEnArchivo` nunca lanza y a esta altura el DE ya
    // está firmado; ante un error queda el PDF vertical, que es un KuDE perfectamente válido.
    if (datos.duplicarDoc && esPlantillaA4(datos.plantilla)) {
      await aplicarDuplicadoEnArchivo({
        pdfPath: outputPath,
        empresaId: datos.empresaId,
        documentoId: datos.facturaId,
      });
    }

    console.log("PDF generado exitosamente en:", outputPath);
    return { outputPath };
  }
  catch (error) {
    console.error("Error al generar PDF:", error);
    throw error;
  }
};

module.exports = generarPdf;
