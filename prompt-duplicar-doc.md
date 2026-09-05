<!--
Ejecutar con: claude --model claude-fable-5
Esfuerzo de razonamiento: medio. La tarea es acotada (un campo, una función
utilitaria, un punto de integración); no requiere extended thinking alto,
pero sí exploración cuidadosa del flujo de generación antes de tocar código.
-->

# Feature: duplicado de factura en hoja A4 horizontal (flag `duplicar_doc`)

## Contexto

factyble-back (Node.js/Express/Prisma/MySQL) genera el KuDE de facturas
electrónicas con JasperReports usando cuatro templates: `Factura.jrxml`,
`FacturaBN.jrxml` (ambos A4 vertical, 595x842pt) y los tickets térmicos
`Factura80mm.jrxml` / `Factura58mm.jrxml`.

Algunos clientes necesitan una "versión con copia": la misma factura impresa
dos veces, lado a lado, en una hoja A4 horizontal. NO vamos a crear un quinto
jrxml ni tocar los existentes — la solución es un post-proceso del PDF ya
generado, con imposición 2-up.

## Objetivo

1. Nuevo campo booleano `duplicar_doc` en el modelo de empresa.
2. Cuando `duplicar_doc === true` **y** el template usado es `Factura` o
   `FacturaBN` (los A4; los térmicos quedan explícitamente fuera), después de
   generar el PDF del KuDE se produce una versión A4 horizontal con la factura
   duplicada lado a lado, **se sobrescribe el archivo original en el mismo
   path/nombre**, y toda referencia existente (registro en DB, endpoint de
   descarga, envío por WhatsApp/correo) apunta a ese archivo sin ningún otro
   cambio.

## Antes de codear

Explorá y confirmá en el código real (no asumas):

- Dónde se invoca Jasper y dónde se persiste el PDF resultante (path, naming,
  si se guarda en disco, DB o ambos).
- Cómo se determina qué template se usa para cada emisión (¿campo en empresa?
  ¿parámetro del request?). El chequeo `Factura | FacturaBN` debe salir de esa
  misma fuente, no de un string duplicado.
- Si existen otros flujos que regeneran o releen ese PDF (reimpresión,
  reenvío por WhatsApp, notas de crédito) para verificar que sobrescribir el
  archivo no rompe nada.

Listá tus hallazgos y supuestos en un comentario breve antes de implementar.
Si encontrás una contradicción con lo especificado acá, frenás y preguntás.

## Implementación

### 1. Prisma

- Agregar `duplicar_doc Boolean @default(false)` al modelo de empresa
  (respetar la convención de naming ya usada en ese modelo — revisá si los
  campos existentes son snake_case o camelCase con @map).
- Generar la migración. No tocar datos existentes: default false = 
  comportamiento actual para todas las empresas.

### 2. API de empresa

- Exponer el campo en los endpoints de creación/edición/lectura de empresa.
- Validación con express-validator, siguiendo el patrón de las cadenas de
  validación ya existentes en las rutas de empresa:
  `body('duplicar_doc').optional().isBoolean().toBoolean()`.
  Revisá cómo manejan las rutas actuales los campos no esperados y el
  resultado de `validationResult`, y replicá exactamente ese patrón.

### 3. Utilitario de imposición 2-up

Nueva función en el módulo de utilidades de PDF (o crear uno si no existe),
usando `pdf-lib` (agregar la dependencia):

```javascript
import { PDFDocument } from 'pdf-lib';

// Toma los bytes del KuDE A4 vertical y devuelve un A4 horizontal
// con cada página del original estampada dos veces, lado a lado.
export async function imponerDuplicado(pdfBytes) {
  const src = await PDFDocument.load(pdfBytes);
  const out = await PDFDocument.create();

  const A4L = { w: 841.89, h: 595.28 };
  const margin = 15, gutter = 10;
  const slotW = (A4L.w - margin * 2 - gutter) / 2;

  const indices = src.getPageIndices();
  const embedded = await out.embedPdf(src, indices);

  for (const emb of embedded) {
    const scale = Math.min(slotW / emb.width, (A4L.h - margin * 2) / emb.height);
    const w = emb.width * scale, h = emb.height * scale;
    const y = (A4L.h - h) / 2;
    const page = out.addPage([A4L.w, A4L.h]);
    page.drawPage(emb, { x: margin, y, width: w, height: h });
    page.drawPage(emb, { x: margin + slotW + gutter, y, width: w, height: h });
  }

  return out.save();
}
```

Notas:
- Multipágina: cada página del original genera su propia hoja horizontal
  (pág. 1 dos veces, pág. 2 dos veces, etc.).
- El QR del KuDE se escala a ~66% junto con todo; sigue siendo escaneable.

### 4. Integración en el flujo de emisión

En el punto donde el PDF queda generado y antes de persistir la referencia:

```
if (empresa.duplicar_doc && esTemplateA4(template)) {
  bytes = await imponerDuplicado(bytes);
}
// escribir/sobrescribir en el path original — sin cambios aguas abajo
```

- Manejo de errores: si `imponerDuplicado` falla, **la emisión no se cae**:
  loggear el error con contexto (empresaId, facturaId) y dejar el PDF
  original vertical. La factura ya está aprobada en SIFEN a esta altura; un
  fallo cosmético no puede bloquearla ni dejarla sin PDF.
- La imposición corre una sola vez por emisión; cuidado con no aplicarla de
  nuevo en flujos de reimpresión si estos regeneran desde Jasper (en ese caso
  deben pasar por el mismo camino, chequeando el flag otra vez).

## Fuera de alcance

- Frontend (el toggle en la pantalla de configuración de factyble-front es
  una tarea separada).
- Rótulos "ORIGINAL"/"COPIA" sobre cada mitad (posible iteración futura del
  mismo utilitario).
- Templates térmicos 80mm/58mm.
- Cualquier cambio a los .jrxml.

## Verificación

1. Migración aplica limpio sobre una DB con empresas existentes; todas quedan
   con `duplicar_doc = false`.
2. Emisión con flag false → PDF idéntico al actual (vertical, sin cambios).
3. Emisión con flag true + template FacturaBN → PDF A4 horizontal, dos copias
   lado a lado, mismo filename que antes; el endpoint de descarga y el envío
   por WhatsApp entregan el nuevo layout sin ningún cambio en esos módulos.
4. Emisión con flag true + template 80mm o 58mm → sin post-proceso, ticket
   normal.
5. Factura con muchos ítems (KuDE de 2+ páginas) → cada página duplicada en
   su propia hoja.
6. Simular fallo del utilitario (mock que lanza) → la emisión completa igual
   y el PDF vertical queda disponible; error loggeado.
