const java = require("./jvm");

// Impresión de un reporte JasperReports directo a una impresora del sistema, sin pasar por PDF.
//
// Por qué así y no generando ESC/POS a mano: el KUDE es un documento fiscal (QR, CDC, timbrado) y su
// diseño ya está validado en las plantillas .jrxml. Reimplementarlo en comandos de impresora sería
// mantener dos representaciones del mismo documento y arriesgar que lo impreso no coincida con el PDF
// que se archiva y se le manda al cliente. Acá se imprime EXACTAMENTE el mismo JasperPrint del que
// sale el PDF.
//
// Requiere que la impresora esté instalada en el Windows donde corre el backend: la JVM las descubre
// por el spooler del sistema operativo. Probado contra una EPSON TM-T20IV-L (driver APD, 203 dpi) en
// red por TCP 9100.

// Nombres de las impresoras que ve la JVM. Sirve para diagnosticar: si la impresora está en Windows
// pero no aparece acá, el problema es del servicio de impresión, no de este código.
function listarImpresoras() {
  const PrintServiceLookup = java.import("javax.print.PrintServiceLookup");
  const servicios = PrintServiceLookup.lookupPrintServicesSync(null, null);

  const nombres = [];
  for (let i = 0; i < servicios.length; i++) {
    nombres.push(servicios[i].getNameSync());
  }
  return nombres;
}

// Devuelve el PrintService de esa impresora, o null.
function buscarServicio(nombreImpresora) {
  const PrintServiceLookup = java.import("javax.print.PrintServiceLookup");
  const servicios = PrintServiceLookup.lookupPrintServicesSync(null, null);

  for (let i = 0; i < servicios.length; i++) {
    if (servicios[i].getNameSync() === nombreImpresora) return servicios[i];
  }
  return null;
}

// Elige el formato de papel MÁS CHICO en el que entre esta página, entre los que declara el driver.
//
// El driver de la térmica trae por defecto "Roll Paper 80 x 297 mm", y 297mm es un tope real: un
// ticket más largo sale cortado ahí, sin error — Windows da el trabajo por impreso. Como las
// plantillas usan isIgnorePagination y la página crece con los ítems (421mm con 8, 517mm con 12),
// hay que pedir explícitamente el formato largo ("Roll Paper 80 x 3276 mm") cuando hace falta.
//
// Se elige el más chico que sirva y no siempre el más largo, para no pedirle al driver un formato de
// 3,2 metros cuando el ticket entra en uno de 297mm.
function elegirMedia(servicio, anchoPt, altoPt) {
  const MediaSize = java.import("javax.print.attribute.standard.MediaSize");
  const UNIDAD_PULGADA = java.getStaticFieldValue("javax.print.attribute.standard.MediaSize", "INCH");
  const claseMedia = java.callStaticMethodSync("java.lang.Class", "forName", "javax.print.attribute.standard.Media");

  const soportados = servicio.getSupportedAttributeValuesSync(claseMedia, null, null);
  if (!soportados) return null;

  const anchoPulgadas = anchoPt / 72;
  const altoPulgadas = altoPt / 72;

  let elegido = null;
  let areaElegida = Infinity;

  for (let i = 0; i < soportados.length; i++) {
    const media = soportados[i];

    // Las bandejas (MediaTray) también vienen en esta lista y no tienen tamaño.
    let tamano = null;
    try {
      tamano = MediaSize.getMediaSizeForNameSync(media);
    } catch (e) {
      continue;
    }
    if (!tamano) continue;

    const ancho = tamano.getXSync(UNIDAD_PULGADA);
    const alto = tamano.getYSync(UNIDAD_PULGADA);

    // Medio milímetro de tolerancia: los formatos del driver redondean (80mm reales = 3.15").
    if (ancho + 0.02 < anchoPulgadas || alto + 0.02 < altoPulgadas) continue;

    const area = ancho * alto;
    if (area < areaElegida) {
      areaElegida = area;
      elegido = media;
    }
  }

  return elegido;
}

// Manda `jasperPrint` a la impresora indicada por nombre exacto (el de Windows, p. ej.
// "EPSON TM-T20IV-L Receipt"). Sin diálogos: esto corre en un servidor, no hay nadie para aceptarlos.
//
// Lanza si la impresora no existe. El caller decide qué hacer con eso — ver generarPdf.js, donde un
// fallo de impresión NO puede voltear la emisión: para cuando se imprime, la factura ya se emitió.
function imprimirJasperPrint(jasperPrint, nombreImpresora) {
  if (!nombreImpresora) {
    throw new Error("No se indicó el nombre de la impresora");
  }

  // Se valida contra la lista en vez de dejar que el exporter falle: si el nombre no coincide,
  // JRPrintServiceExporter no siempre da error — puede mandar el trabajo a la impresora por defecto,
  // que en esta máquina es "Microsoft Print to PDF". Es decir: el ticket nunca sale y nadie se entera.
  const disponibles = listarImpresoras();
  if (!disponibles.includes(nombreImpresora)) {
    throw new Error(
      `La impresora "${nombreImpresora}" no está disponible. Instaladas: ${disponibles.join(", ") || "(ninguna)"}`
    );
  }

  const JRPrintServiceExporter = java.import("net.sf.jasperreports.engine.export.JRPrintServiceExporter");
  const SimpleExporterInput = java.import("net.sf.jasperreports.export.SimpleExporterInput");
  const SimplePrintServiceExporterConfiguration = java.import(
    "net.sf.jasperreports.export.SimplePrintServiceExporterConfiguration"
  );
  const HashPrintServiceAttributeSet = java.import("javax.print.attribute.HashPrintServiceAttributeSet");
  const HashPrintRequestAttributeSet = java.import("javax.print.attribute.HashPrintRequestAttributeSet");
  const PrinterName = java.import("javax.print.attribute.standard.PrinterName");
  const MediaPrintableArea = java.import("javax.print.attribute.standard.MediaPrintableArea");

  // Seleccionar el servicio POR NOMBRE es lo que evita que el trabajo caiga en la impresora por
  // defecto del sistema.
  const atributos = new HashPrintServiceAttributeSet();
  atributos.addSync(new PrinterName(nombreImpresora, null));

  // Área imprimible del TAMAÑO REAL de este ticket, no del papel configurado en el driver.
  //
  // Las plantillas de ticket usan isIgnorePagination="true": Jasper arma una única página cuyo alto
  // CRECE con la cantidad de ítems (medido: 277mm con 2 ítems, 421mm con 8, 517mm con 12). El driver
  // de la térmica, en cambio, trae un largo de papel fijo, y todo lo que pasa ese largo lo recorta —
  // el ticket sale cortado siempre a la misma distancia del inicio, sin ningún error de por medio.
  // Declarando el área por trabajo, el driver imprime exactamente lo que mide este ticket.
  const anchoPt = jasperPrint.getPageWidthSync();
  const altoPt = jasperPrint.getPageHeightSync();
  const anchoPulgadas = anchoPt / 72;
  const altoPulgadas = altoPt / 72;
  const UNIDAD_PULGADA = java.getStaticFieldValue("javax.print.attribute.standard.MediaPrintableArea", "INCH");

  const pedido = new HashPrintRequestAttributeSet();

  // El formato de papel va primero: sin esto el driver usa su default (297mm) y recorta. El
  // MediaPrintableArea por sí solo NO alcanza — probado, el driver lo ignora.
  const servicio = buscarServicio(nombreImpresora);
  const media = servicio && elegirMedia(servicio, anchoPt, altoPt);
  if (media) {
    pedido.addSync(media);
    console.log(
      `[imprimirJasper] página de ${(altoPulgadas * 25.4).toFixed(0)}mm -> formato "${media.toStringSync()}"`
    );
  } else {
    console.warn(
      `[imprimirJasper] ningún formato de papel de "${nombreImpresora}" contiene una página de ` +
        `${(altoPulgadas * 25.4).toFixed(0)}mm: el ticket puede salir cortado.`
    );
  }

  pedido.addSync(
    new MediaPrintableArea(
      java.newFloat(0),
      java.newFloat(0),
      java.newFloat(anchoPulgadas),
      java.newFloat(altoPulgadas),
      UNIDAD_PULGADA
    )
  );

  const config = new SimplePrintServiceExporterConfiguration();
  config.setPrintServiceAttributeSetSync(atributos);
  config.setPrintRequestAttributeSetSync(pedido);
  config.setDisplayPageDialogSync(false);
  config.setDisplayPrintDialogSync(false);

  const exporter = new JRPrintServiceExporter();
  exporter.setExporterInputSync(new SimpleExporterInput(jasperPrint));
  exporter.setConfigurationSync(config);
  exporter.exportReportSync();
}

module.exports = { imprimirJasperPrint, listarImpresoras };
