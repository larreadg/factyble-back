const java = require("java");
const fs = require("fs");
const path = require("path");
const dayjs = require("dayjs");
const QRCode = require("qrcode");
const PUBLIC_LOGOS = path.resolve(__dirname,"../../public/logos");
const PUBLIC_QR = path.resolve(__dirname, '../../public/qr');

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
  console.log(path.resolve(PUBLIC_LOGOS, datos.empresaLogo));
  try {
    // Configurar el reporte
    const reportPath = path.resolve(__dirname, "..", "resources/Factura.jasper");
    const outputPath = path.resolve(__dirname, '../../public', `${datos.facturaUuid}.pdf`);

    // Crear un HashMap para los parámetros
    const HashMap = java.import("java.util.HashMap");
    const params = new HashMap();
    if(datos.empresaLogo) params.putSync('empresaLogo', path.resolve(PUBLIC_LOGOS, datos.empresaLogo));
    params.putSync("empresaRuc", String(datos.empresaRuc));
    params.putSync("empresaTimbrado", String(datos.empresaTimbrado));
    params.putSync("empresaVigenteDesde", datos.empresaVigenteDesde);
    params.putSync("empresaNombre", datos.empresaNombre);
    params.putSync("empresaDireccion", datos.empresaDireccion);
    params.putSync("empresaTelefono", String(datos.empresaTelefono));
    params.putSync("empresaCiudad", datos.empresaCiudad);
    params.putSync("empresaCorreoElectronico", datos.empresaCorreoElectronico);
    params.putSync("facturaId", datos.facturaId);
    params.putSync("fechaHora", dayjs().format('YYYY-MM-DD HH:MM:ss'));
    params.putSync("condicionVenta", datos.condicionVenta);
    params.putSync("moneda", datos.moneda); //??como vamos a hacer
    params.putSync("ruc", String(datos.ruc));
    params.putSync("razonSocial", datos.razonSocial);
    params.putSync("correoElectronico", datos.correoElectronico);
    params.putSync("total", String(datos.total));
    params.putSync("totalIva", String(datos.totalIva));
    params.putSync("totalIva5", String(datos.totalIva5));
    params.putSync("totalIva10", String(datos.totalIva10));
    params.putSync("totalExenta", String(datos.totalExenta)); //?? no faltaría este campo?
    params.putSync("cdc", datos.cdc);

    const qrFilename = `${datos.facturaUuid}.png`;
    const qrPath = await generarQr(
      "https://ekuatia.set.gov.py/consultas/qr?nVersion=150&Id=01800192702001001726491922024072512599984166&dFeEmiDE=323032342d30372d32355431323a30303a3030&dRucRec=5249657&dTotGralOpe=177&dTotIVA=16&cItems=2&DigestValue=4147535a4e735155507a65537751616b4a532b5730444f4b64332f35476a75786d3945492b6b71697646773d&IdCSC=0001&cHashQR=fd1de10f0f2a5f38bd70a7d4022b5d66e4442ecde819358de34507ff33f6e8c8",
      qrFilename
    );
    params.putSync("qr", qrPath);

    // Crear un JRBeanArrayDataSource
    const JRBeanArrayDataSource = java.import("net.sf.jasperreports.engine.data.JRBeanArrayDataSource");

    // Crear los objetos Java para cada item
    const itemList = datos.items.map((item) => {
      const map = java.newInstanceSync("java.util.HashMap");
      for (let key in item) {
        map.putSync(key, String(item[key]));
      }
      return map;
    });

    // Crear un array de objetos Java
    const JavaArray = java.newArray("java.util.Map", itemList);

    // Crear el datasource con el array de objetos Java
    const dataSource = new JRBeanArrayDataSource(JavaArray);

    // Añadir el datasource a los parámetros
    params.putSync("ds", dataSource);

    // Cargar y llenar el reporte
    const JasperFillManager = java.import("net.sf.jasperreports.engine.JasperFillManager");
    const jasperPrint = JasperFillManager.fillReportSync(
      reportPath,
      params,
      new java.import("net.sf.jasperreports.engine.JREmptyDataSource")()
    );

    // Exportar el reporte a PDF
    const JasperExportManager = java.import("net.sf.jasperreports.engine.JasperExportManager");
    JasperExportManager.exportReportToPdfFileSync(jasperPrint, outputPath);

    console.log("PDF generado exitosamente en:", outputPath);

    return {
      outputPath
    }

  } catch (error) {
    console.log(error);
  }

};

module.exports = generarPdf;
