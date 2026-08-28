const java = require("java");
const path = require("path");

// Punto único de arranque de la JVM. node-java CONGELA el classpath en la primera llamada a Java:
// después de eso, cualquier `java.classpath.push` tira "Can't add to classpath after calling any of
// the java methods". Por eso los jars se registran acá, en un módulo que se resuelve al cargarse
// (antes de que corra nada), y todo el que necesite JasperReports pide `require('./jvm')` en vez de
// `require('java')` — así no importa el orden en que se carguen los consumidores.
const LIB = path.resolve(__dirname, "..", "resources", "lib");

const JARS = [
  "jasperreports.jar",
  "jasperreports-fonts.jar",
  "commons-collections.jar",
  "itext.jar",
  "commons-logging.jar",
  "commons-digester.jar",
  "commons-beanutils.jar",
];

for (const jar of JARS) {
  java.classpath.push(path.join(LIB, jar));
}

module.exports = java;
