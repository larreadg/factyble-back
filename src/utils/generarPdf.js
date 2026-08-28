const java = require("./jvm");
const path = require("path");
const dayjs = require("dayjs");
const QRCode = require("qrcode");
const { formatNumber } = require("./format");
const { resolverPlantillaPdf } = require("./plantillasPdf");
const { imprimirJasperPrint } = require("./imprimirJasper");
const LOGOS_DIR = path.resolve(__dirname, "../..", process.env.LOGOS_DIR || "logos");
const PUBLIC_QR = path.resolve(__dirname, '../../public/qr');
const FACTYBLE_LOGO = path.resolve(__dirname, "..", "resources", "factura.png");

// El classpath de JasperReports lo arma `./jvm` al cargarse (node-java lo congela en la primera
// llamada a Java, así que no puede registrarse acá abajo).

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
    params.putSync("empresaNombre",          toStringValue(datos.empresaNombre));
    params.putSync("empresaDireccion",       toStringValue(datos.empresaDireccion));
    params.putSync("empresaTelefono",        toStringValue(datos.empresaTelefono));
    params.putSync("empresaCiudad",          toStringValue(datos.empresaCiudad));
    params.putSync("empresaCorreoElectronico", toStringValue(datos.empresaCorreoElectronico));
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

    console.log("PDF generado exitosamente en:", outputPath);

    // 8) Impresión directa (opcional, sólo el despliegue on-prem la pide). Se reutiliza el MISMO
    // jasperPrint del PDF: no se vuelve a llenar el reporte y lo que sale por la impresora es
    // idéntico al archivo que se archiva y se le manda al cliente.
    //
    // Aislada en su propio try/catch a propósito: cuando esto corre la factura YA se emitió y ya se
    // firmó. Un atasco de papel, una impresora apagada o un nombre mal configurado no pueden hacer
    // fallar el request y dejar al caller creyendo que la emisión no ocurrió — el candado del outbox
    // volvería a PENDIENTE y la venta se emitiría dos veces.
    if (datos.impresora) {
      try {
        imprimirJasperPrint(jasperPrint, datos.impresora);
        console.log(`Ticket enviado a la impresora "${datos.impresora}"`);
      } catch (errorImpresion) {
        console.error(`No se pudo imprimir el ticket (la factura SÍ se emitió):`, errorImpresion.message);
      }
    }

    return { outputPath };
  }
  catch (error) {
    console.error("Error al generar PDF:", error);
    throw error;
  }
};

module.exports = generarPdf;
