Versión 150
10/09/2019
MANUAL TÉCNICO
SISTEMA INTEGRADO
DE FACTURACIÓN
ELECTRÓNICA
```
NACIONAL (SIFEN)
```
El presente documento puede sufrir
modificaciones hasta la implementación total
del proyecto SIFEN.
septiembre de 2019 1
Contenido
INDICE DE GRÁFICAS ..................................................................................................... 7
INDICE DE TABLAS .......................................................................................................... 8
INDICE DE SCHEMAS ...................................................................................................... 9
Control de versiones ........................................................................................................ 10
Versión: 120................................................................................................................................................... 10
Versión: 130................................................................................................................................................... 10
Versión: 140................................................................................................................................................... 11
Versión: 141................................................................................................................................................... 12
Versión: 150................................................................................................................................................... 12
1. INTRODUCCIÓN .................................................................................................. 15
2. OBJETIVOS .......................................................................................................... 16
3. ALCANCE ............................................................................................................. 17
4. Sistema Integrado de Facturación Electrónica Nacional SIFEN ............................ 18
4.1. Estructura y subsistemas SIFEN ......................................................................................................... 18
4.2. Fundamento legal .............................................................................................................................. 20
4.3. Validez jurídica e incidencia tributaria de los documentos tributarios electrónicos ........................ 21
5. Documentos Tributarios Electrónicos .................................................................... 22
5.1. Comprobantes de ventas electrónicos: ............................................................................................. 22
5.2. Documentos complementarios electrónicos: ................................................................................... 22
5.3. Nota de Remisión Electrónica ........................................................................................................... 22
6. Modelo Operativo .................................................................................................. 23
6.1. Descriptores del modelo operativo de SIFEN .................................................................................... 23
6.1.1. Archivo electrónico .................................................................................................................... 23
6.1.2. Aprobación del DTE ................................................................................................................... 23
6.2. Plazo de transmisión del DE a la SET ................................................................................................. 24
6.2.1. Plazos SIFEN ............................................................................................................................... 24
6.3. Relación directa con los contribuyentes ........................................................................................... 26
6.4. Entrega del DE al receptor ................................................................................................................. 26
6.5. Rechazo del DE en el modelo de aprobación posterior .................................................................... 26
6.6. Verificación de la existencia del DTE por parte del receptor ............................................................ 27
7. Características tecnológicas del formato ............................................................... 28
7.1. Modelo conceptual de comunicación ............................................................................................... 28
7.2. Estándar del formato XML ................................................................................................................. 30
7.2.1. Estándar de codificación............................................................................................................ 30
7.2.2. Declaración namespace ............................................................................................................. 30
septiembre de 2019 2
7.2.2.1. Particularidad de la firma digital ........................................................................................... 31
7.2.2.2. Particularidad del envío de lote............................................................................................. 31
7.2.3. Convenciones referenciadas en tablas ...................................................................................... 32
7.2.4. Recomendaciones mejores prácticas de generación del archivo ............................................. 34
7.3. Contenedor de documento electrónico ............................................................................................ 35
7.4. Estándar de comunicación ................................................................................................................ 35
7.5. Estándar de certificado digital ........................................................................................................... 36
7.6. Estándar de firma digital ................................................................................................................... 37
7.7. Especificaciones técnicas del estándar de certificado y firma digital ............................................... 39
7.8. Procedimiento para la validación de la firma digital: ........................................................................ 40
7.9. Síntesis de definiciones tecnológicas ................................................................................................ 40
7.10. Resumen de las Direcciones Electrónicas de los Servicios Web para Ambientes de Pruebas y
Producción ..................................................................................................................................................... 41
7.11. Servidor para sincronización externa de horario .......................................................................... 41
8. Aspectos Tecnológicos de los Servicios Web del SIFEN ...................................... 42
8.1. Servicio síncrono................................................................................................................................ 42
8.1.1. Flujo funcional: .......................................................................................................................... 42
8.2. Servicio asíncrono.............................................................................................................................. 43
8.2.1. Secuencia del servicio asíncrono: .............................................................................................. 43
8.2.2. Tiempo promedio de procesamiento de un lote: ..................................................................... 43
8.3. Estándar de mensajes de los servicios del SIFEN .............................................................................. 44
8.4. Versión de los Schemas XML ............................................................................................................. 44
8.4.1. Identificación de la versión de los Schemas XML ...................................................................... 44
8.4.2. Liberación de versiones de los Schemas XML ........................................................................... 44
8.4.3. Paquete inicial de Schemas ....................................................................................................... 44
9. Descripción de los Servicios Web del SIFEN ........................................................ 45
9.1. WS recepción documento electrónico – siRecepDE.......................................................................... 45
9.1.1. Definición del protocolo que consume este servicio ................................................................ 45
9.1.2. Descripción del procesamiento ................................................................................................. 45
9.1.3. Protocolo de respuesta ............................................................................................................. 46
9.2. WS recepción lote DE – siRecepLoteDE............................................................................................. 47
9.2.1. Definición del protocolo que consume este servicio ................................................................ 47
9.2.2. Descripción del procesamiento ................................................................................................. 47
9.2.3. Protocolo de respuesta ............................................................................................................. 48
septiembre de 2019 3
9.3. WS consulta resultado de lote DE – siResultLoteDE ......................................................................... 48
9.3.1. Definición del protocolo que consume este servicio ................................................................ 48
9.3.2. Descripción del procesamiento ................................................................................................. 49
9.3.3. Protocolo de respuesta ............................................................................................................. 49
9.4. WS consulta DE – siConsDE ............................................................................................................... 50
9.4.1. Definición del protocolo que consume este servicio ................................................................ 50
9.4.2. Descripción del procesamiento ................................................................................................. 51
9.4.3. Protocolo de respuesta ............................................................................................................. 51
9.5. WS recepción evento – siRecepEvento ............................................................................................. 52
9.5.1. Definición del protocolo que consume este Servicio ................................................................ 52
9.5.2. Descripción del procesamiento ................................................................................................. 53
9.5.3. Protocolo de respuesta ............................................................................................................. 53
9.6. WS consulta RUC – siConsRUC .......................................................................................................... 53
9.6.1. Definición del protocolo que consume este servicio ................................................................ 54
9.6.2. Descripción del procesamiento ................................................................................................. 54
9.6.3. Protocolo de respuesta ............................................................................................................. 54
```
9.7. WS consulta DE de entidades u organismos externos autorizados – siConsDEST (a futuro) ............ 55
```
10. Formato de los Documentos Electrónicos ............................................................. 56
```
10.1. Estructura del código de control (CDC) de los DE ......................................................................... 56
```
10.2. Dígito verificador del CDC.............................................................................................................. 57
10.3. Generación del código de seguridad ............................................................................................. 57
```
10.4. Datos que se deben informar en los documentos electrónicos (DE) ............................................ 58
```
10.5. Manejo del timbrado y Numeración ............................................................................................. 59
11. Gestión de eventos ............................................................................................. 112
11.1. Eventos realizados por el emisor................................................................................................. 112
11.1.1. Inutilización de número de DE ................................................................................................ 112
11.1.2. Cancelación.............................................................................................................................. 113
11.1.3. Devolución y Ajuste de precios ............................................................................................... 113
```
11.1.4. Endoso de FE (evento futuro) .................................................................................................. 114
```
11.2. Eventos registrados por el receptor ............................................................................................ 114
11.2.1. Conformidad con el DTE .......................................................................................................... 114
11.2.2. Disconformidad con el DTE...................................................................................................... 114
11.2.3. Desconocimiento con el DE o DTE ........................................................................................... 114
11.2.4. Notificación de recepción de un DE o DTE .............................................................................. 115
septiembre de 2019 4
11.2.5. Tipología de los eventos del receptor ......................................................................................... 115
```
11.4. Eventos registrados por la SET (evento futuro)........................................................................... 116
```
11.4.1. Impugnación de DTE ................................................................................................................ 116
11.5. Estructura de los Eventos ............................................................................................................ 120
11.5.1. FORMATO DE EVENTOS EMISOR ............................................................................................. 121
11.5.2. FORMATO DE EVENTOS RECEPTOR ......................................................................................... 123
11.6. REGLAS DE VALIDACIÓN DE GESTIÓN DE EVENTOS .................................................................... 133
11.6.1. REGLAS DE VALIDACIÓN PARA CANCELACIÓN ........................................................................ 134
11.6.2. REGLAS DE VALIDACIÓN PARA INUTILIZACIÓN ....................................................................... 135
11.6.3. REGLAS DE VALIDACIÓN PARA NOTIFICACIÓN – RECEPCIÓN DE/DTE .................................... 136
11.6.4. REGLAS DE VALIDACIÓN PARA EL EVENTO CONFORMIDAD ................................................... 137
11.6.5. REGLAS DE VALIDACIÓN PARA EL EVENTO DISCONFORMIDAD .............................................. 138
11.6.6. REGLAS DE VALIDACIÓN PARA EL EVENTO DESCONOCIMIENTO DE/DTE ............................... 139
11.6.7. REGLAS DE VALIDACIÓN PARA EL EVENTO POR ACTUALIZACIÓN DE DATOS: DATOS DEL
TRANSPORTE ........................................................................................................................................... 141
12. Validaciones ........................................................................................................ 145
12.1. Estructura de los códigos de validación ...................................................................................... 146
12.1.1. Códigos de respuestas de las validaciones de los Servicios Web ............................................ 147
12.1.2. Códigos de respuestas de las validaciones de los DE .............................................................. 148
12.1.3. Códigos de respuestas de las validaciones de los eventos ...................................................... 150
12.2. Codificación de respuestas de los Servicios WEB del SIFEN ........................................................ 150
12.2.1. Validaciones del certificado de transmisión. Protocolo TLS .................................................... 150
12.2.2. Validación de la estructura XML de los WS ............................................................................. 151
12.2.3. Validación de forma del área de datos del Request ................................................................ 152
12.2.4. Validación del certificado de firma .......................................................................................... 152
12.2.5. Validación de la firma digital ................................................................................................... 153
12.2.6. Validaciones genéricas a los mensajes de entrada de los WS ................................................. 153
12.2.7. Validaciones genéricas a los mensajes de control de llamada de los WS ............................... 154
12.3. Validaciones de cada Web Service .............................................................................................. 154
12.3.1. WS recepción documento electrónico – siRecepDE................................................................ 154
12.3.1.1. Mensaje de entrada del WS ................................................................................................ 154
12.3.1.2. Información de control de la llamada al WS ....................................................................... 154
12.3.1.3. Área de datos del WS .......................................................................................................... 154
12.3.2. WS recepción lote DE – siRecepLoteDE................................................................................... 155
septiembre de 2019 5
12.3.2.1. Mensaje de entrada del WS ................................................................................................ 155
12.3.2.2. Información de control de la llamada al WS ....................................................................... 155
12.3.2.3. Área de datos del WS .......................................................................................................... 155
12.3.3. WS consulta resultado de lote DE – siResultLoteDE ............................................................... 155
12.3.3.1. Mensaje de entrada del WS ................................................................................................ 155
12.3.3.2. Información de control de la llamada al WS ....................................................................... 156
12.3.3.3. Área de datos del WS .......................................................................................................... 156
12.3.4. WS consulta de DE – siConsDE ................................................................................................ 156
12.3.4.1. Mensaje de entrada del WS ................................................................................................ 156
12.3.4.2. Información de control de la llamada al WS ....................................................................... 157
12.3.4.3. Área de datos del WS .......................................................................................................... 157
12.3.5. WS consulta de RUC – siConsRUC ........................................................................................... 157
12.3.5.1. Mensaje de entrada del WS ................................................................................................ 157
12.3.5.2. Información de control de la llamada al WS ....................................................................... 157
12.3.5.3. Área de datos del WS .......................................................................................................... 157
12.3.6. WS recepción de evento – siRecepEvento .............................................................................. 158
12.3.6.1. Mensaje de entrada del WS ................................................................................................ 158
12.3.6.2. Información de control de la llamada al WS ....................................................................... 158
12.3.6.3. Área de datos del WS .......................................................................................................... 158
12.4. Validaciones del formato ............................................................................................................. 159
13. Gráfica (KUDE) ................................................................................................... 193
13.1. Definición y alcance del KuDE: .................................................................................................... 193
13.2. Características y funcionalidades ................................................................................................ 193
13.3. Denominación de los KuDE.......................................................................................................... 193
13.4. Estructura del KuDE ..................................................................................................................... 194
13.4.1. Campos del encabezado del KuDE .......................................................................................... 195
13.4.2. Campos que describen los ítems de la operación del KuDE .................................................... 196
13.4.3. Campos que describen los subtotales y totales de la transacción documentada y liquidación de
IVA 196
13.4.4. Campos de información propia de la consulta en SIFEN de la SET ......................................... 196
13.4.5. Información adicional de interés para el emisor ..................................................................... 197
13.5. KuDE ............................................................................................................................................ 197
```
13.6. KuDE (cinta de papel) .................................................................................................................. 203
```
13.7. Cinta papel resumen del KuDE .................................................................................................... 204
septiembre de 2019 6
```
13.8. Código bidimensional (QR) .......................................................................................................... 205
```
13.8.1. Delineamientos del QR Code ................................................................................................... 205
13.8.2. Conformación del Código QR .................................................................................................. 205
13.8.3. Metodología para la generación del Código QR ...................................................................... 206
13.8.4. Ejemplo de generación del Código QR .................................................................................... 207
13.8.5. Mensajes desplegados en consulta del QR ............................................................................. 209
14. Operación de Contingencia (Futuro) ................................................................... 210
15. CODIFICACIONES ............................................................................................. 210
16. GLOSARIO TÉCNICO ........................................................................................ 214
septiembre de 2019 7
INDICE DE GRÁFICAS
```
Gráfica Nº 01 Sistema Integrado de Facturación Electrónica Nacional (SIFEN) .............. 18
```
Gráfica Nº 02 Subsistema de Validación de Uso ............................................................. 19
Gráfica Nº 03 Subsistema Electrónico Solución Gratuita E-kuatia’i .................................. 20
Gráfica Nº 04: Secuencia de acciones tecnológicas SIFEN ............................................. 23
Gráfica Nº 05: Flujo de comunicación .............................................................................. 28
Gráfica Nº 06: WS Sincrónico .......................................................................................... 29
Gráfica Nº 07: WS Asincrónico ........................................................................................ 29
Gráfica N° 08: Relación elementos XML .......................................................................... 32
```
Gráfica Nº 09 – KuDE FE Formato 1 (Papel Carta o similar) ......................................... 198
```
```
Gráfica Nº 10 – KuDE NCE Formato 1 (Papel Carta o similar) ...................................... 199
```
```
Gráfica Nº 11 – KuDE NDE Formato 1 (Papel Carta o similar) ...................................... 200
```
```
Gráfica Nº 12 – KuDE AFE Formato 1 (Papel Carta o similar) ....................................... 201
```
```
Gráfica Nº 13 – KuDE NRE Formato 1 (Papel Carta o similar) ...................................... 202
```
```
Gráfica Nº 14 – KuDE FE Formato 2 (cinta de papel) .................................................... 203
```
Gráfica Nº 15 – Cinta papel resumen del KuDE ............................................................. 204
septiembre de 2019 8
INDICE DE TABLAS
Tabla A – Convenciones Utilizadas en la Tablas de Definición de los Formatos XML ..... 32
Tabla B – Tipos de Datos en los Archivos XML ............................................................... 33
Tabla C: Tamaños de campos ......................................................................................... 34
Tabla D: Formatos numéricos .......................................................................................... 34
Tabla E: Estándares de tecnología utilizados .................................................................. 40
Tabla F – Resultados de Procesamiento del WS Consulta Resultado de Lote ................ 49
Tabla G – Resultados de Procesamiento del WS Consulta DE........................................ 51
Tabla H – Resultados de Procesamiento del WS Consulta RUC ..................................... 54
Tabla I – Grupos de campos del Archivo XML ................................................................. 58
Tabla J: Resumen de los eventos de SIFEN según los actores ..................................... 117
Tabla K: Correcciones de los eventos del Receptor en el SIFEN ................................... 119
TABLA 1 – TIPO DE REGIMEN ..................................................................................... 210
TABLA 2.1 – DEPARTAMENTOS, DISTRITOS Y CIUDADES ...................................... 210
TABLA 2.2 - CIUDADES ................................................................................................ 210
TABLA 3 – ACTIVIDADES ECONÓMICAS.................................................................... 211
TABLA 4 – CODIFICACION DE PAISES ....................................................................... 211
TABLA 5 – CODIFICACION DE UNIDADES DE MEDIDA ............................................. 211
TABLA 6 – CODIGOS DE AFECTACION ...................................................................... 212
TABLA 7 – CATEGORIAS DEL ISC .............................................................................. 212
TABLA 8 – TASAS DEL ISC .......................................................................................... 212
TABLA 9 – TIPOS DE VEHÍCULOS .............................................................................. 212
TABLA 10 – CONDICIONES DE NEGOCIACION - INCOTERMS ................................. 213
TABLA 11 – REGÍMENES ADUANEROS ...................................................................... 213
septiembre de 2019 9
INDICE DE SCHEMAS
```
Schema XML 1: xmldsig-core-schema- v150.xsd (Estándar de la Firma Digital).............. 38
```
```
Schema XML 2: siRecepDE_v150.xsd (WS Recepción DE) ............................................ 45
```
```
Schema XML 3: resRecepDE_v150.xsd (Respuesta del “WS Recepción DE”) ................ 46
```
```
Schema XML 4: ProtProcesDE_v150.xsd (Protocolo de Procesamiento de DE) ............. 46
```
```
Schema XML 5: SiRecepLoteDE_v150.xsd (WS Recepción DE Lote)............................. 47
```
```
Schema XML 5A: ProtProcesLoteDE_v150.xsd (Protocolo de procesamiento del Lote) .. 47
```
```
Schema XML 6: resRecepLoteDE_v150.xsd (Respuesta del WS Recepción Lote) ......... 48
```
```
Schema XML 7: SiResultLoteDE_v150.xsd (WS Consulta Resultado de Lote) ................ 48
```
```
Schema XML 8: resResultLoteDE_v150.xsd (Respuesta del WS Consulta Resultado Lote)49
```
```
Schema XML 9: siConsDE_v150.xsd (WS Consulta DE)................................................. 50
```
```
Schema XML 10: resConsDE_v150.xsd (Respuesta del WS Consulta DE) ..................... 51
```
```
Schema XML 11: ContenedorDE_v150.xsd (Contenedor de DE) .................................... 51
```
```
Schema XML 12: ContenedorEvento_v150.xsd (Contenedor de Evento) ........................ 52
```
```
Schema XML 13: siRecepEvento_v150.xsd (WS Recepción Evento) .............................. 52
```
```
Schema XML 14: resRecepEvento_v150.xsd (Respuesta del WS Recepción Evento) .... 53
```
```
Schema XML 15: siConsRUC_v150.xsd (WS Consulta RUC) ......................................... 54
```
```
Schema XML 16: resConsRUC_v150.xsd (Respuesta del WS Consulta RUC) ............... 54
```
```
Schema XML 17: ContenedorRUC_v150.xsd (Contenedor de RUC) ............................... 55
```
```
Schema XML 18: DE_v150.xsd (Documento Electrónico) ............................................... 61
```
```
Schema XML 19: Evento_v150.xsd (Formato de evento emisor) ................................... 120
```
septiembre de 2019 10
Control de versiones
Versión: 120
Fecha de modificación: 03/05/2018
Ubicación - capítulo Descripción de las modificaciones
Por la cual se crea el Manual Técnico que establece los requisitos y condiciones tecnológicos para
constituirse como Facturador Electrónico del Sistema Integrado de Facturación Electrónica Nacional
```
(SIFEN)
```
Versión: 130
Fecha de modificación: 29/06/2018
Ubicación - capítulo Descripción de las modificaciones
6 Modelo operativo Eliminación de Ambiente de habilitación y/o pruebas.
Creación y Reestructuración del apartado 6.2.1 Plazo de transmisión del
DE a la SET.
Cambios en Rechazo del DE en el modelo de validación posterior
6.2.1. Plazos SIFEN Se crea esta sección, se introducen cambios en la tabla de plazos
7. Características
tecnológicas del formato
Se agrega las etiquetas <rDE> <dVerfor> en 7.2.2.1 Particularidad de la
Firma digital y 7.2.2.2 Particularidad de envío de lote
Cambios en el 7.4. Estándar de comunicación, se modificó Request de
ejemplo utilizando SOAP
8.3. Estándar de mensajes
de los servicios del SIFEN y
8.4 Información de control y
área de datos de los
mensajes
Se elimina la versión
9 Descripción de los
servicios web del SIFEN
```
Desde el Schema XML 2 al Schema XML 14 (Se eliminó versión)
```
10.3. Generación del código
de seguridad
Se agregó esta sección
TABLA DE FORMATO DE
CAMPOS DE UN
DOCUMENTO
ELECTRÓNICO
El antiguo grupo A se divide en grupo AA y A.
Se eliminó el grupo Campos que identifican a los terceros autorizados.
Reestructuración en el grupo E
Se agregaron campos en el grupo D3. Datos que identifican al receptor
```
del Documento Electrónico DE (D200-D299)
```
11 Gestión de eventos Modificaciones en 11.1.3 Anulación o Ajuste y 11.2.1 Disconformidad
con el DTE
Se agrega 11.1.4 Endoso de FE
13.7 Código bidimensional
```
(QR)
```
Cambios en 13.7.2. Conformación del Código QR se agregaron.
Se agregan las siguientes secciones: 13.7.3 Metodología para la
generación del código QR, 13.7.4 Ejemplo de datos de generación del
código QR, 13.7.5 Ejemplo URL de la imagen del QR y 13.7.6 Mensajes
desplegados en consulta del QR
septiembre de 2019 11
Versión: 140
Fecha de modificación: 23/08/2018
Ubicación - capítulo Descripción de las modificaciones
Se detallan los cambios de la versión actual y la anterior en el control de versiones.
6.2.1. Plazos SIFEN Se introducen cambios en la tabla de plazos
6.5 Rechazo del DE en el
modelo de validación
posterior
Se aclara el procedimiento
7.2.3 Tabla A Tipos de Datos
y en todas las secciones en
donde se utilizan fechas.
- Del tipo de dato Fecha (F) se elimina la zona horaria.
- En el tipo de dato Numérico (N) no se mantiene una longitud
invariante.
7.5 Estándar de certificado
digital
Se agrega un ejemplo de uso del dato RUC
8.2.2 Tiempo promedio de
procesamiento de un lote
Aclaraciones en tiempos de procesamiento
8.4.5. Paquete de Schemas
para el ambiente de
pruebas
Se elimina esta sección, debido a que ya no se utiliza el ambiente
```
(prueba o producción)
```
9. DESCRIPCIÓN DE LOS
SERVICIOS WEB DEL SIFEN
- Se eliminó el ambiente y la versión del formato de los Web Services.
- Se modifica la versión de los Schemas de 100 a 140.
- El proceso síncrono ahora devuelve un número de transacción.
El proceso asíncrono en su respuesta contiene un número de lote
```
(denominado Número del protocolo de autorización anteriormente)
```
- Se agrega el Web service de consulta de RUC siConsRUC y el Web
service consulta DE destinadas siConsDEST
10.1. Estructura del código
```
de control (CDC) de los DE
```
Se modifica la estructura del CDC, ahora se diferencian el RUC del
emisor y su Dígito verificador.
TABLA DE FORMATO DE
CAMPOS DE UN
DOCUMENTO
```
ELECTRONICO (DE)
```
Se introdujeron varios cambios en los grupos, no entramos a detallarlos
en esta sección para contribuir a la legibilidad, sin embargo, esos
cambios se reflejan en esta versión del Manual Técnico mediante los
siguientes colores.
```
Amarillo = modificaciones
```
```
Verde = adición de campos
```
11 Gestión de eventos Se agrega una tabla resumen de tipo de evento según el actor.
Se agrega las estructuras correspondientes a los eventos de
Cancelación e Inutilización.
Se agregan las validaciones a realizarse sobre los eventos de
Cancelación e Inutilización
13.7 Código bidimensional
```
(QR)
```
Se elimina el ambiente de generación
septiembre de 2019 12
Versión: 141
Fecha de modificación: 21/09/2018
Ubicación - capítulo Descripción de las modificaciones
6.2.1 Plazos SIFEN Se introducen cambios en la tabla de plazos
7.2 Estándar del formato
XML
7.2.2 Declaración namespace, se cambia la url del namespace
7.2.2.1 Particularidad de la firma digital, cambio del ejemplo
7.2.2.2 Particularidad del envío de lote, cambio del ejemplo
7.2.3 Convenciones referenciadas en tablas, mejor especificación del
tipo de dato fecha y se agregó el tipo de dato Binario
7.4 Estándar de
comunicación
Se modificaron el Request y el Response de ejemplo
7.6 Estándar de firma digital Modificaciones en el Schema XML 1.
7.10 Resumen de las
Direcciones Electrónicas de
los Servicios Web para
Ambientes de Pruebas y
Producción
Se agregó la tabla resumen con las urls.
8 ASPECTOS
TECNOLÓGICOS DE LOS
SERVICIOS WEB DEL SIFEN
Se elimina la sección 8.4 Información de control y área de datos de los
mensajes
9 DESCRIPCIÓN de los
Servicios Web del SIFEN
- Modificaciones en los siguientes schemas: Schema XML 4, Schema
XML 5, Schema XML 6, Schema XML 7, Schema XML 8, Schema XML 16,
Schema XML 17
- Se agregó el Schema XML 5A
TABLA DE FORMATO DE
CAMPOS DE UN
DOCUMENTO
```
ELECTRONICO (DE)
```
Se introdujeron varios cambios en los grupos, no entramos a detallarlos
en esta sección para contribuir a la legibilidad, sin embargo, esos
cambios se reflejan en esta versión del Manual Técnico mediante los
siguientes colores.
```
Amarillo = modificaciones
```
```
Verde = adición de campos
```
11 Gestión de eventos Modificaciones en las validaciones a realizarse sobre los eventos de
Cancelación e Inutilización
13.8 Código bidimensional
```
(QR)
```
```
Se modifica el Código de Seguridad (CSC) a 32 dígitos alfanuméricos.
```
Versión: 150
Fecha de modificación: 10/09/2019
Ubicación - capítulo Descripción de las modificaciones
Se realizó la actualización de la numeración de los capítulos, estilos y formatos para mejor
organización de los índices.
4.1. Estructura y
subsistemas SIFEN
Actualización de la gráfica Nº 2
4.2. Fundamento Legal Se agregó la resolución general reglamentaria
6.2.1 Plazos SIFEN Se introducen plazos para eventos en la tabla
septiembre de 2019 13
7.10 Resumen de las
Direcciones Electrónicas de
los Servicios Web para
Ambientes de Pruebas y
Producción
Se actualizan las URLs para los ambientes de Producción y Test
7.4. Estándar de
comunicación
Se corrige el campo donde se incluye el mensaje XML a cualquiera de
los Servicios Web del SIFEN. El campo actualizado es soap:Body
9 DESCRIPCIÓN de los
Servicios Web del SIFEN
- Modificaciones en los siguientes schemas: Schema XML 4, Schema
XML 6, Schema XML 8, Schema XML 14, Schema XML 17
TABLA DE FORMATO DE
CAMPOS DE UN
DOCUMENTO
```
ELECTRONICO (DE)
```
Se introdujeron varios cambios, ya que desde esta versión del sistema
se puede recibir y gestionar los siguientes DEs: Autofactura electrónica
y Nota de Remisión electrónica. Los cambios se reflejan en esta versión
del Manual Técnico mediante los siguientes colores.
```
Amarillo = modificaciones
```
```
Verde = adición de campos
```
```
Rojo = eliminación
```
Además, se eliminaron las citas que se hacían hacia los tipos de
```
documentos: Factura electrónica de exportación, Factura electrónica
```
de importación y Comprobante de retención electrónico.
Se eliminó la estructura relacionada a ISC
10.5 Manejo del timbrado y
Numeración
Explicación del uso de serie
11 Gestión de eventos El evento de anulación ahora se denomina Devolución y Ajuste de
precios
Se introdujeron eventos que realizarán los receptores: Conformidad y
Disconformidad con el DTE, Desconocimiento con el DE o DTE y
Notificación de recepción de un DE o DTE
Cambios en la Tabla J: Resumen de los eventos de SIFEN según los
actores
Se agrega la Tabla K: Correcciones de los eventos del Receptor en el
SIFEN
Se agregan las estructuras que se utilizarán para los servicios de
eventos del receptor
Se agregan los esquemas para los nuevos eventos automáticos y para
el evento de actualización de datos del transporte
12.2.2. Validación de la
estructura XML de los WS
La versión del DE se informa en el campo de versión dentro del grupo
rDE
Se elimina el ejemplo del elemento soap12:Header
12.2.3 Validación de forma
del área de datos del
Request
Se eliminan los mensajes con código desde 0100 hasta el 0107
12.2.4 Validación del
certificado de firma
Se eliminan los mensajes con código desde el 0123 hasta el 0126
12.2.5 Validación de la
firma
La validación con código 0141 se encarga de controlar los casos que se
contemplaban en las validaciones con código 0123 al 0126
12.4 Validaciones del
formato
Se introdujeron cambios en las validaciones sobre el formato, puesto
que se han agregado los siguientes DE: Autofactura electrónica y
Notificación de recepción electrónica.
Se eliminaron las validaciones correspondientes al ISC, así como las
validaciones que se estimaban se realizarían en el futuro.
13. Gráfica KuDE Actualización de las URLs de consulta en los distintos ambientes
Se agregan ejemplos de cada uno de los KuDEs
septiembre de 2019 14
13.8.3. Metodología para la
generación del Código QR
Modificaciones en los datos del cuadro de ejemplo
13.8.4. Ejemplo datos QR Se modifica para especificar por pasos la generación de código QR.
13.8.5. Ejemplo del QR con
el Código Secreto del
Contribuyente
Se elimina como 13.8.5 y se inserta como un paso más en el punto
13.8.4.
13.8.6. Ejemplo URL de la
imagen del QR
Se elimina como 13.8.6 y se inserta como un paso más en el punto
13.8.4
13.8.7 Mensajes
desplegados en consulta
del QR
Se actualiza la numeración a 13.8.5
14. Operación de
Contingencia
Se elimina el contenido de esta sección, ya que sigue en etapa de
definición
15. Codificaciones Se elimina tabla de Ciudades (Tabla 2.2) y se reemplaza por el link que
```
lleva al archivo de Departamentos, Distritos y Ciudades (Tabla 2.1)
```
```
Se agrega el link para la tabla de Regímenes Aduaneros (Tabla 11)
```
Observación: en esta versión del Manual técnico están resaltados la mayor parte de los cambios que se
introdujeron siguiendo el siguiente patrón:
```
Amarillo = modificaciones
```
```
Verde = adición de contenido
```
```
Rojo = eliminación de contenido
```
No se respetó este esquema de control de versiones a color en la eliminación de contenido relacionado a ISC,
y a los tipos de documentos: Factura electrónica de exportación, Factura electrónica de importación y
Comprobante de retenciones electrónico.
septiembre de 2019 15
1. INTRODUCCIÓN
```
El presente Manual Técnico (MT) tiene como propósito constituirse en el documento maestro que establece
```
el conjunto de requisitos, condiciones y procedimientos tecnológicos que deben cumplir los contribuyentes
de IVA que se adhieran de manera voluntaria, o aquellos que hayan sido seleccionados por parte de la SET
```
para ser facturadores electrónicos, en el Sistema Integrado de Facturación Electrónica Nacional (SIFEN).
```
En tal sentido, el MT es una guía tecnológica en la cual los contribuyentes, potenciales facturadores
```
electrónicos, pueden encontrar los objetivos y alcance pretendidos en los capítulos 2 y 3; identificar en el
```
capítulo 4, en las secciones 4.1 a 4.3, la estructura y subsistemas de SIFEN, el fundamento legal que lo soporta,
```
la validez jurídica de los Documentos Tributarios Electrónicos (DTE) que se verán alcanzados con la operación
```
electrónica.
En el capítulo 5 se detallan los documentos tributarios electrónicos previstos para la versión actual del MT. En
el capítulo 6 se describe el Modelo Operativo.
En el capítulo 7, uno de los más determinantes del MT, se establecen las características tecnológicas del
formato, abarcando el modelo conceptual de comunicación, los estándares del formato XML, de
comunicación, del certificado y firma digital y las especificaciones técnicas respectivas.
Seguidamente, en los capítulos 8 y 9, se describen los Servicios Web previstos para SIFEN. El formato de los
Documentos Electrónicos, la gestión de eventos y las validaciones, son abordados en los capítulos 10, 11 y 12
respectivamente.
```
Los capítulos 13 al 17 abarcan lo concerniente a la representación gráfica (KuDE), la operación de contingencia,
```
la conservación de los DTE, las codificaciones utilizadas por SIFEN y glosario técnico.
```
Finalmente, es importante mencionar que este documento forma parte integral de la Resolución (futura) para
```
la etapa de Voluntariedad, que establece el marco jurídico procedimental y reglamenta a su vez el Decreto No
```
7.795/2017, mediante el cual se crea el SIFEN; constituyéndose en el pilar que regula y orienta la operación
```
```
del Sistema Integrado de Facturación Electrónica Nacional (SIFEN) del Paraguay.
```
septiembre de 2019 16
2. OBJETIVOS
Definir los requisitos y condiciones, así como los procedimientos tecnológicos y operacionales para realizar los
ajustes informáticos, la parametrización y adaptación de los sistemas de facturación, que deben cumplir los
contribuyentes de IVA, sean estos voluntarios y/o elegidos por la SET, para constituirse como facturadores
electrónicos.
Establecer el paso a paso a seguir para realizar la solicitud de autorización y timbrado, y en consecuencia
obtener la habilitación correspondiente.
Determinar las condiciones de estructuración del formato electrónico que deben observar los emisores al
momento de enviar y transmitir los Documentos Electrónicos a los receptores y a la SET respectivamente, a
```
este último actor, mediante el consumo de los servicios web dispuestos (estándar, tipos y descripción); así
```
como, aquellas referentes a la validación y/o rechazo por parte de la SET.
Precisar las condiciones, acciones y procedimientos que deban observar los contribuyentes facturadores
electrónicos para gestionar la contingencia que se presenta en el proceso de facturación electrónica, con el
```
objeto de generar y entregar la representación gráfica (KuDE) a los receptores y para el uso de las
```
codificaciones requeridas en el SIFEN.
Definir las condiciones, acciones y procedimientos que deban observar los contribuyentes facturadores
electrónicos para gestionar los eventos que se sucedan sobre los documentos electrónicos previamente
```
validados por la SET; así como, las condiciones y requisitos para consumir los servicios de consulta de los
```
mismos y sus eventos asociados.
septiembre de 2019 17
3. ALCANCE
Este documento tiene como alcance definir el conjunto de requisitos, condiciones y procedimientos
tecnológicos que deben cumplir los contribuyentes de IVA que se adhieran de manera voluntaria, o aquellos
que hayan sido seleccionados por la SET para ser facturadores electrónicos, en el Sistema Integrado de
```
Facturación Electrónica Nacional (SIFEN) del Paraguay.
```
septiembre de 2019 18
4. Sistema Integrado de Facturación Electrónica Nacional SIFEN
4.1. Estructura y subsistemas SIFEN
```
El Sistema Integrado de Facturación Electrónica Nacional (SIFEN) se encuentra estructurado en dos
```
```
subsistemas (subsistema de validación, y subsistema solución gratuita de facturación electrónica) que agrupan
```
funcionalidades específicas y servicios orientados a diferentes segmentos del universo de contribuyentes de
```
la SET, diferenciadas en su alcance, modelo operativo y tecnológico, volumen transaccional; así como, en su
```
desarrollo y construcción en el horizonte de tiempo de ejecución. Ver Gráfica Nº 01.
```
Gráfica Nº 01 Sistema Integrado de Facturación Electrónica Nacional (SIFEN)
```
Subsistema de Aprobación: se encuentra orientado en especial a grandes y medianos contribuyentes, los
cuales se podrán adherir de manera voluntaria o podrán ser seleccionados por la SET de manera obligatoria a
facturar electrónicamente. Los facturadores electrónicos comprendidos en este subsistema tendrán que
observar los requisitos, condiciones y plazos establecidos en el Decreto, su Resolución Reglamentaria y en el
presente Manual Técnico.
Este subsistema contempla dos momentos en su operación:
```
Primer momento – Operación comercial con documentos electrónicos (DE)
```
```
Como resultado de la operación comercial, el facturador electrónico emite el documento electrónico (DE)
```
firmado digitalmente y lo envía al comprador o receptor, en formato XML. Si el comprador o receptor no es
facturador electrónico, el emisor deberá enviar o disponibilizar una representación gráfica del documento
```
(KuDE) que soporta la transacción en formato físico o digital.
```
```
Segundo momento – Transmisión de los documentos electrónicos (DE) a la SET
```
Los contribuyentes facturadores electrónicos, envían el formato XML firmado digitalmente de los DE a la SET
```
para su proceso de validación (Ver Gráfica Nº 02).
```
septiembre de 2019 19
Gráfica Nº 02 Subsistema de Validación de Uso
Este subsistema contemplará, en las fases de piloto y voluntariedad del plan de masificación de la factura
electrónica, el control sobre aquellos segmentos de contribuyentes que tendrán que enviar el formato de los
DE al Sistema Integrado de Facturación Electrónica Nacional en un plazo de hasta 72 horas para su
correspondiente validación y aprobación como DTE, entiéndase horas corridas desde el momento de la firma
digital del DE.
Del mismo modo, y de manera controlada en las diferentes fases del plan de masificación podrá establecer o
```
habilitar a determinados contribuyentes bajo la modalidad de la validación previa; es decir, aquella en la cual
```
```
se exige al facturador electrónico (en condición de emisor) que previamente transmita el documento
```
```
electrónico (DE) a la SET (SIFEN) para su validación antes de su envío al receptor. Obviamente con la obtención
```
```
de la validación positiva (aprobación) por parte de SIFEN.
```
Subsistema Solución Gratuita de Facturación Electrónica Ekuatia’i: se encuentra orientado a contribuyentes
con una cantidad de emisión de documentos electrónicos baja, el cual será provisto por la SET de manera
gratuita, y comprenderá como productos y servicios básicos la emisión, transmisión y almacenamiento de
documentos electrónicos, estando soportados en los servicios web desarrollados en el subsistema de
aprobación, lo que permitirá mantener la integridad transaccional del SIFEN. Contempla para determinados
contribuyentes de este segmento el uso de firma digital. Las transacciones que se realicen en este subsistema
son en tiempo real. Ver Gráfica Nº 03.
septiembre de 2019 20
Gráfica Nº 03 Subsistema Electrónico Solución Gratuita E-kuatia’i
Los anteriores subsistemas mencionados de SIFEN tendrán una interoperabilidad con Marangatu, en particular
con el RUC y el módulo de Autorización y Timbrado, al igual que con los prestadores de servicios de
certificación de Paraguay a efectos de validar la vigencia del certificado digital.
SIFEN proveerá todos los servicios web y de internet de consulta referente a los Documentos Tributarios
```
Electrónicos (DTE), así como aquellos servicios orientados a indicar las novedades, afectaciones y eventos
```
sobre los mismos.
4.2. Fundamento legal
El SIFEN tiene su base legal en el siguiente marco normativo:
```
• La Ley N° 125/1991 "Que Establece el Nuevo Régimen Tributario" y sus modificaciones;
```
• La Ley Nº 4.017/2010 “De validez jurídica de la firma electrónica, la firma digital, los mensajes de datos
y el expediente electrónico”, y sus modificaciones.
• La Ley Nº 4.679/2012 “De Trámites Administrativos”.
• La Ley Nº 4.868/2013 “Comercio Electrónico”.
• El Decreto N° 6.539/2005 “Por el cual se dicta el reglamento general de Timbrado y uso de
Comprobantes de Venta, Documentos Complementarios, Notas de Remisión y Comprobantes de
Retención” y sus modificaciones.
• El Decreto Nº 7.369/2011” Por el cual se aprueba el Reglamento General de la Ley Nº 4.017/2010 de
validez jurídica de la firma electrónica, la firma digital, los mensajes de datos y el expediente
electrónico”.
• El Decreto Nº 1.165/2014 “Por el cual se aprueba el reglamento de la Ley Nº 4.868 del 26 de febrero
de 2013 de Comercio Electrónico”.
• El Decreto Nº 7.795/2017 “Por el cual se crea el Sistema Integrado de Facturación Electrónica
Nacional”.
MARANGATU 2.0
Acceso y Autenticación• Usuario y Clave
Portal SIFEN
Solución Gratuita
E-Kuatia’i
Pequeños contribuyentesVolumen bajo de DTE
Timbrado - RUC
ConsultaDTE
GeneraciónKuDE
ComunicaciónActores comerciales
ReportesBásicos
Codificación e importaciónde productos y catálogos
Firma DigitalSET o Contribuyente
Gestión deEventos
```
APP Móvil(Consulta QR)
```
GeneraciónDTE Web Service
```
Sincrónica (1 FE/vez)
```
MultiplataformaWeb Responsive
WS
```
DTE: FE, NCE, NDE,NRE, AFE
```
Web ServiceSincrónico/AsincrónicoWS
Posib. import.Archivo TXT/XML
Validaciones previas
Solución Gratuita
SIFEN
septiembre de 2019 21
• La Resolución Nº 124/2018 “Por la cual se designa a las empresas participantes del plan piloto de
```
implementación del sistema integrado de facturación electrónica nacional (SIFEN)”.
```
• La Resolución General Reglamentaria Nº 05/2018 “Por la cual se reglamenta el Sistema de Facturación
Electrónica Nacional”.
• La Resolución General Reglamentaria Futura, para la etapa de voluntariedad.
4.3. Validez jurídica e incidencia tributaria de los documentos tributarios electrónicos
Para efectos del MT se debe considerar lo manifestado el artículo 32 de La Ley N° 4.868/2013 “Comercio
Electrónico”, el cual define a la factura electrónica como el comprobante de pago que deberán emitir los
proveedores de bienes y servicios por vía electrónica a distancia a quienes realicen transacciones comerciales
con ellos.
Por otra parte, la referida Ley en su artículo 33, dispone que la factura electrónica emitida por los proveedores
de bienes y servicios tendrá la misma validez contable y tributaria que la factura convencional, siempre que
cumplan con las normas tributarias y sus disposiciones reglamentarias.
En ese sentido, el Decreto N° 7.795/2017, por el cual se crea el SIFEN, en su artículo 2° define al documento
tributario electrónico como el documento emitido por el facturador electrónico con firma digital que ha sido
validado formalmente por la Administración Tributaria y que sirve para respaldar el débito y el crédito fiscal
del Impuesto al Valor Agregado, así como las ventas de bienes y servicios, los costos y los gastos en los
Impuestos a la renta.
```
Lo anterior significa en el contexto del presente MT, que los Documentos Electrónicos (DE) definidos en el
```
glosario y condicionados por el estándar del formato electrónico XML descripto en la sección 7.2, una vez
firmados digitalmente conforme lo mencionado en la sección 7.7, y efectuado el proceso de validación por
```
parte de la Administración Tributaria, adquieren naturaleza Documentos Tributarios Electrónicos (DTE) con
```
validez jurídica, fuerza probatoria e incidencia tributaria en las mismas condiciones que los comprobantes
físicos o convencionales autorizados por la Subsecretaría de Estado de Tributación.
```
El proceso se encuentra soportado en el conjunto de validaciones definidas en el capítulo 12; en tal sentido,
```
si un formato electrónico XML reúne las condiciones y requisitos formales y tecnológicos establecidos, se da
por superado el proceso de validación y se otorga la aprobación de uso del DTE.
Esto no implica que la Administración Tributaria se pronuncie sobre la veracidad de la operación comercial
documentada en el DTE, ni limita o excluye las facultades de fiscalización que posea sobre la misma.
septiembre de 2019 22
5. Documentos Tributarios Electrónicos
Los documentos electrónicos previstos por SIFEN para la presente versión, son los siguientes:
5.1. Comprobantes de ventas electrónicos:
• Factura Electrónica
• Autofactura Electrónica
5.2. Documentos complementarios electrónicos:
• Nota de Crédito Electrónica.
• Nota de Débito Electrónica.
5.3. Nota de Remisión Electrónica
Conforme lo establecido en el Decreto 7.795/2017 y sus reglamentaciones, lo anterior no implica que la
Administración Tributaria pueda implementar de manera gradual la utilización de otros DE, que por su
naturaleza requieran un tratamiento similar de operación electrónica, los cuales se introducirán en versiones
posteriores del presente MT.
septiembre de 2019 23
6. Modelo Operativo
6.1. Descriptores del modelo operativo de SIFEN
6.1.1. Archivo electrónico
El SIFEN define el archivo electrónico basado en el lenguaje XML como la representación electrónica de una
factura o los documentos establecidos en el capítulo 5 del presente MT. Del mismo modo, el archivo
electrónico en el contexto de la Ley 4.017/2010 tiene naturaleza de mensaje de datos y como tal, si contiene
una firma digital válida tiene admisibilidad y fuerza probatoria.
6.1.2. Aprobación del DTE
Para efectos de que el receptor, de un DE firmado digitalmente por un facturador electrónico, pueda asegurar
que el mismo tiene validez, el modelo operativo de SIFEN ha definido que este documento debe ser objeto de
```
unas validaciones (de conexión, técnicas, y de negocio) sobre el formato electrónico de cada uno de los DE
```
transmitidos, cuya aprobación de uso tendrá efectos tributarios sobre los contribuyentes involucrados en la
operación comercial al establecer su ingreso o no al SIFEN.
```
En un archivo XML estructurado conforme el Schema XML 4: ProtProcesDE_v150.xsd (protocolo de
```
```
procesamiento del DE), existen campos que definen que ha superado satisfactoriamente las validaciones
```
definidas para el efecto en el presente MT y, por tanto, ha sido aprobado como DTE. Ver gráfica Nº 04.
Gráfica Nº 04: Secuencia de acciones tecnológicas SIFEN
La obtención del resultado satisfactorio de las validaciones y en consecuencia la naturaleza de DTE
```
(Aprobación) no implican que la SET, como Administración Tributaria, pueda establecer la veracidad de la
```
operación comercial documentada en el DTE, en consecuencia, no limita ni excluye las facultades de
fiscalización de esta.
septiembre de 2019 24
6.2. Plazo de transmisión del DE a la SET
La transmisión del DE firmado digitalmente contempla un plazo de hasta 72 horas posteriores a la firma digital
del DE de la operación comercial. El modelo operativo tiene previsto para el futuro, dependiendo de la
naturaleza de las operaciones, empresas, sectores y/o gremios en particular, y con base en unos criterios
propios de la SET, determinados contribuyentes transmitan estos DE en plazos menores a las 72 horas.
El plazo de transmisión del DE de hasta 72 hs es un beneficio del modelo operativo para el contribuyente
emisor, para que pueda tener tranquilidad en su operación comercial y disminuir la necesidad del uso de
contingencia por problemas de infraestructura de Internet, de energía eléctrica o de disponibilidad de SIFEN.
Para la SET, en SIFEN, el tiempo de respuesta de validación de un DTE está establecido, como máximo de 1
```
(un) minuto, con objetivo de llegar, en el futuro, en tiempo de procesamiento menor a 2 (dos) segundos por
```
DTE.
Por lo tanto, por decisión de las empresas o industrias se podrá optar por la validación y aprobación previa, la
cual implica que SIFEN realice las validaciones y se obtenga el protocolo de aprobación del DTE, de manera
previa o posterior, a la entrega del documento al receptor por parte del emisor.
Adicionalmente, como un descriptor diferenciador entre el modelo operativo de validación posterior y previa,
```
se encuentra que para el primero se permite la generación de la representación gráfica (KuDE) antes que se
```
obtenga la correspondiente aprobación de uso. La misma puede ser utilizada en caso de venta a un receptor
```
no electrónico contribuyente de IVA o renta (este se obliga a realizar la consulta conforme a lo mencionado
```
```
en la sección 6.6 del presente MT), al consumidor final y para las mercaderías en su traslado físico.
```
Es importante mencionar, que el KuDE es un documento tributario auxiliar que expresa de manera simplificada
una transacción que ha sido respaldada por un DE, y como tal no es íntegramente el Documento Tributario
```
Electrónico, por cuanto su naturaleza es simplificada (contiene sólo algunos campos representativos del DTE)
```
y su validez jurídica se encuentra condicionada a la aprobación por parte de la SET. Situación en la cual el
receptor se obliga a consultar y/o comprobar la existencia del DTE en el SIFEN, tomando en consideración
algunos campos presentes en el cuerpo del KuDE como criterios de consulta.
6.2.1. Plazos SIFEN
Conforme a las bases y condiciones estructurales del Modelo del Sistema Integrado de Facturación Electrónica
```
Nacional (SIFEN), para el correcto cumplimiento tributario conforme a la potestad otorgada mediante el
```
Decreto N° 7.795/2017 y sus reglamentaciones, partiendo de la regla general, se han establecido plazos
diferenciados, de cara a las situaciones de contingencias, eventos, emisión de determinados DE y
comunicaciones, presentes en el proceso de transmisión, de la siguiente manera:
CASOS PLAZOS OBSERVACION
```
Transmisión normal de los DE Hasta 72 horas (regla general)
```
Regla general: se considera transmisión
normal de los DE al envío de aquellos
documentos cuya fecha y hora de
transmisión no supera las 72 horas en
relación con la fecha y hora de la firma
digital de los mismos. Y que adicionalmente
septiembre de 2019 25
CASOS PLAZOS OBSERVACION
cumpla con una de las siguientes
```
condiciones:
```
• Que la diferencia entre la fecha y
```
hora de emisión (anterior) y la fecha y hora
```
de transmisión al SIFEN no sea superior a
```
120 horas (5 días).
```
• Que la diferencia entre la fecha y
```
hora de emisión (posterior) y la fecha y
```
hora de transmisión al SIFEN no sea
```
superior a 120 horas (5 días)
```
Transmisión extemporánea de
los DE
Según situación de
extemporaneidad
Se considera como transmisión
extemporánea de los DE al envío de
aquellos documentos que se encuentren en
situación contraria a la Transmisión normal
de los DE, a los cuales se les aplicará las
sanciones que correspondan
Rechazo de los DE por
```
transmisión extemporánea 720 horas (30 días)
```
Se considera situación de rechazo de los
DE por transmisión extemporánea en las
siguientes situaciones:
- Cuando la diferencia entre la fecha de
transmisión y la fecha de emisión del DE,
```
sea mayor a 720 horas (30 días)
```
*Cuando la diferencia entre la fecha de
emisión y la fecha de transmisión del DE
```
sea mayor a 120 horas (5 días)
```
Trámite administrativo para
normalizar DE rechazados por
extemporaneidad
```
Mayor a 720 horas (30 días)
```
En caso de rechazo de los DE por
transmisión extemporánea y para efectos
```
de obtener su normalización (aprobación
```
```
extemporánea) en el SIFEN, los
```
facturadores electrónicos, deberán iniciar
un trámite administrativo sin perjuicio de la
aplicación de las sanciones que
correspondan
Evento de cancelación de una
```
FE Hasta 48 horas (2 días)
```
Para efectos del registro del evento de
cancelación, necesariamente el DTE debe
existir en el SIFEN.
El cómputo del plazo será contado a partir
de la aprobación del DE por parte de la SET
```
(fecha y hora SIFEN)
```
Eventos de cancelación de DTE
distintos a FE
Hasta 168 horas
```
(7 días)
```
Para efectos del registro del evento de
cancelación, necesariamente el DTE
```
(distinto a FE) debe existir en el SIFEN.
```
El cómputo del plazo será contado a partir
de la aprobación del DE por parte de la SET
```
(fecha y hora SIFEN)
```
Inutilización de la numeración
```
de un DE Hasta 360 horas (15 días)
```
Plazo que empieza a correr a partir del
siguiente mes del consumo de la
numeración del timbrado
Eventos del Receptor:
Notificación de Recepción
DE/DTE, Conformidad,
Disconformidad,
Desconocimiento DE/DTE
```
Hasta 1080 horas (45 días) El plazo se computa desde la fecha deemisión del DE/DTE
```
septiembre de 2019 26
CASOS PLAZOS OBSERVACION
Corrección Evento del
```
Receptor: Notificación de
```
Recepción DE/DTE,
Conformidad, Disconformidad,
Desconocimiento DE/DTE
```
Hasta 360 horas (15 días)
```
El plazo se computa desde la fecha de
registro del primer evento sobre un DTE
```
(Conformidad o Disconformidad o
```
```
Desconocimiento)
```
```
Obs: El cómputo de los plazos fue establecido en horas corridas.
```
6.3. Relación directa con los contribuyentes
El modelo operativo de SIFEN entiende que la interacción de la SET con los facturadores electrónicos es de
manera directa y sin necesidad de intermediación obligatoria de actor diferente. Quiere decir esto que, a
discreción y decisión de los contribuyentes, estos podrán acudir a servicios de proveedores tecnológicos,
reiterando que en todo caso la relación es directamente con los contribuyentes.
6.4. Entrega del DE al receptor
Como regla general, la entrega del DE por parte del emisor al receptor, en el modelo de validación y aprobación
del DE, se da de manera previa, y este último se obliga a consultar a posteriori, en los servicios de consulta
```
disponibles por SIFEN, que el DTE (luego de aprobado el DE) se encuentre conforme la operación comercial
```
realizada.
“Es importante remarcar que, al momento de la generación, emisión y antes de la entrega de un Documento
```
Electrónico (DE) al receptor, el referido documento debe estar firmado digitalmente. Carecerán de total
```
validez aquellos documentos electrónicos que no lleven la firma digital y que no fueron validados y
aprobados por la Administración Tributaria”.
Entre posibles alternativas de envío del DE del emisor al receptor, propio del ámbito comercial entre las partes,
se tienen las siguientes:
• Descarga por el receptor en página web expuesta por el emisor.
• Archivo adjunto transmitido por correo electrónico o aplicaciones.
• Archivo adjunto transmitido por aplicativo de mensajería electrónica de datos.
6.5. Rechazo del DE en el modelo de aprobación posterior
En el caso de que el DE enviado a SIFEN no supere las validaciones previstas para otorgar su aprobación, y su
```
ajuste para ser validado, no implique cambios que alteren la construcción del Código de Control (CDC), se
```
```
podrá reutilizar el mismo CDC, descrito en la sección 10.1, del DE rechazado (esto con el objeto de permitir
```
```
que el DE con aprobado (DTE) pueda ser consultado por medio del QR generado en el KuDE entregado al
```
```
receptor en el momento de la operación comercial), y someter nuevamente a validación. El emisor debe
```
realizar el mismo procedimiento hasta lograr la aprobación, cuantas veces sea necesario. Esto sin prejuicio del
incumplimiento de los términos y condiciones en la transmisión de los DE y la consecuente aplicación del
régimen sancionatorio por la entrega extemporánea de los mismos.
septiembre de 2019 27
Para aquellos casos en los que se introduzcan cambios que alteren la conformación del CDC, el emisor deberá
inutilizar el número de comprobante previamente generado y emitir uno nuevo, lo cual igualmente supone su
envío al receptor o comprador.
6.6. Verificación de la existencia del DTE por parte del receptor
En el modelo de aprobación posterior, el receptor de los DE, con el objeto de ejercer sus derechos tributarios
```
(como respaldo documental de sus Declaraciones Juradas), se obliga a verificar la existencia y coincidencia de
```
```
la Representación Gráfica del DTE (KuDE) con el DTE almacenado en el SIFEN.
```
La verificación podrá realizarse por servicio web de consulta CDC, o mediante consulta en la página web que
para sus efectos disponga la SET a través de SIFEN, a partir del código QR existente incorporado en el KuDE o
por el llenado del CDC en la página. Al respecto, debe verificar en específico que:
• El DE fue transmitido y obtuvo la aprobación como DTE, y
• Que la información presente en el KuDE coincide plenamente con la información del DTE consultado.
septiembre de 2019 28
7. Características tecnológicas del formato
En este capítulo se abordan las características tecnológicas de la facturación electrónica, que involucran la
utilización de certificados digitales, el lenguaje utilizado para el intercambio de información, XML o lenguaje
de marcado o extensible1, juntamente con los Servicios Web, esenciales para el intercambio seguro de los DE.
También se identifican los Servicios Web contemplados en el modelo conceptual de comunicación, se
establecen las definiciones acerca de la utilización del XML, así como los estándares de comunicación entre el
SIFEN y los sistemas de los contribuyentes.
7.1. Modelo conceptual de comunicación
El SIFEN, disponibilizará los siguientes Servicios Web:
• Recepción de DE
• Recepción lotes de DE
• Consulta resultado lote
• Recepción evento
• Consulta DE
```
• Consulta RUC (por demanda)
```
```
• Consulta DE a entidades u organismos externos autorizados (a futuro)
```
Cada servicio se encuentra respaldado por un Servicio Web específico. El modelo de comunicación e
```
interoperabilidad siempre iniciará en el sistema del contribuyente (sea de manera directa o prestado por un
```
```
tercero), por medio del consumo del servicio correspondiente. Ver gráfica Nº 05
```
Gráfica Nº 05: Flujo de comunicación
1 https://es.wikipedia.org/wiki/Extensible_Markup_Language
FLUJO DE COMUNICACIÓN
Cliente Sistema de FE
Sistema de FE
Facturas
Servicios
Sincrónicos
Facturas
Electrónicas
SIFEN
Servicios
Asincrónicos Transacciones
https
Flujo de la
Comunicación
SETContribuyente
septiembre de 2019 29
Existen dos tipos de procesamiento de Servicios Web:
Síncronos: Se consideran a aquellos en los cuales el procesamiento y respuesta del servicio se realizan en la
misma conexión de consumo. Ver gráfica Nº 06.
Gráfica Nº 06: WS Sincrónico
Asíncronos: Son aquellos en los cuales el resultado del procesamiento del servicio requerido no es entregado
```
en la misma conexión de la solicitud de consumo (Ver gráfica Nº 07). Consta de un mensaje y un número de
```
lote descriptos a continuación:
```
• Un mensaje con un recibo (ticket) que confirma que el archivo remitido ha superado las primeras
```
validaciones y se ha recepcionado el lote, y
```
• El número de lote, incluido en esta respuesta, con el cual el cliente (sistema del contribuyente) podrá
```
consultar el resultado del procesamiento, consumiendo el Web Service correspondiente, en otra
conexión.
Gráfica Nº 07: WS Asincrónico
Web Service1 a 1Sistema deInformación FE
Contribuyente
Sincrónico
SIFENSistema de Recepción y
Procesamiento
5
Recibe mensaje de solicitudDirecciona al sistema de
recepción y procesamiento2
Realiza procesamientoDevuelve msj resultado al WS 34Recibe mensaje con resultadoDirecciona al Sistema delContribuyente
1Establece conexiónEnvía mensaje desolicitud
Recibe RespuestaTermina conexión
septiembre de 2019 30
7.2. Estándar del formato XML
```
El formato de documentos y protocolos de servicios, utilizan el lenguaje de marcas expansible (XML –
```
```
Expansible Markup Language). La definición de cada archivo XML sigue un estándar denominado “Schema
```
XML”, o lenguaje de esquema, utilizado para describir la estructura y restricciones de los documentos XML2 .
```
Esta estructura reside en un archivo con extensión “.xsd” (XML Schema Definition), el que establece qué
```
elementos contendrá el documento, como están organizados, cuáles son los atributos y de qué tipo deben ser
estos elementos.
7.2.1. Estándar de codificación
La especificación de los documentos XML es el estándar 150, con la codificación de caracteres UTF-8, por lo
cual todos los documentos se inician con la declaración:
```
<?xml version="150" encoding="UTF-8"?> (*)
```
Para mejor comprensión, se puede utilizar el siguiente enlace:
```
http://www.w3.org/TR/REC-xml
```
```
Cada archivo XML, debe poseer solo una declaración (*), para el caso de los envíos de lotes, la estructura
```
completa del archivo debe contener solo una declaración.
7.2.2. Declaración namespace
El comúnmente denominado “Espacio de Nombres”3 en XML, es utilizado para proporcionar elementos y
atributos con nombre único en un documento XML.
Este espacio de nombres se declara utilizando el atributo xmlns, el cual estará incluido en el elemento raíz del
documento como, por ejemplo:
<rDE
```
xmlns=”http://ekuatia.set.gov.py/sifen/xsd”
```
```
xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
```
```
xsi:schemaLocation="http://ekuatia.set.gov.py/sifen/xsd siRecepDE_v150.xsd">
```
Namespace utilizado en Eventos:
2 https://es.wikipedia.org/wiki/XML_Schema
```
(*) <?xml version="100" encoding="UTF-8" ?>
```
3 https://es.wikipedia.org/wiki/Espacio_de_nombres_XML
www.w3.org/TR/REC-xml
septiembre de 2019 31
<rEnviEventoDe
```
xmlns="http://ekuatia.set.gov.py/sifen/xsd"
```
```
xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
```
<dEvReg>
<gGroupGesEve>
<rGesEve
```
xsi:schemaLocation="http://ekuatia.set.gov.py/sifen/xsd
```
siRecepEvento_v150.xsd"
```
xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
```
<rEve Id="123">
</rEve>
</rGesEve>
</gGroupGesEve>
</dEvReg>
</rEnviEventoDe>
Cabe aclarar que no se podrá utilizar:
• Namespace distintos a los definidos en el presente documento
• Prefijos de namespace
Cada documento XML tendrá su namespace individual en su correspondiente elemento raíz.
7.2.2.1. Particularidad de la firma digital
La declaración namespace de la firma digital debe realizarse en la etiqueta <Signature>, conforme con el
siguiente ejemplo:
<rDE
```
xmlns="http://ekuatia.set.gov.py/sifen/xsd"
```
```
xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
```
```
xsi:schemaLocation="http://ekuatia.set.gov.py/sifen/xsd/siRecepDE_v150.xsd">
```
<dVerFor>150</dVerFor>
<DE Id="0144444401700100100145282201170125158732260988">
</DE>
<Signature xmlns="http://www.w3.org/2000/09/xmldsig#">
</Signature>
</rDE>
7.2.2.2. Particularidad del envío de lote
En el caso de envío de lote, cada DE debe contener la declaración de su namespace individual, conforme el
```
ejemplo:
```
septiembre de 2019 32
<rDE
```
xmlns="http://ekuatia.set.gov.py/sifen/xsd"
```
```
xmlns:xsi=http://www.w3.org/2001/XMLSchema-instance
```
```
xsi:schemaLocation="http://ekuatia.set.gov.py/sifen/xsd/siRecepDE_v150.xsd">
```
<dVerFor>150</dVerFor>
<DE Id="0144444401700100100145282201170125158732260988">
...
</DE>
<Signature xmlns="http://www.w3.org/2000/09/xmldsig#">
...
</Signature>
</rDE>
<rDE
```
xmlns="http://ekuatia.set.gov.py/sifen/xsd"
```
```
xmlns:xsi=http://www.w3.org/2001/XMLSchema-instance
```
```
xsi:schemaLocation="http://ekuatia.set.gov.py/sifen/xsd/siRecepDE_v150.xsd">
```
<dVerFor>150</dVerFor>
<DE Id="0144444401700100100145282201170125158732260988">
...
</DE>
<Signature xmlns="http://www.w3.org/2000/09/xmldsig#">
...
</Signature>
</rDE>
7.2.3. Convenciones referenciadas en tablas
La Gráfica Nº 08 muestra la relación entre los elementos del archivo XML
Gráfica N° 08: Relación elementos XML
La definición de las columnas de las tablas, conforme los esquemas relacionados a los archivos XML, se expone
a continuación en la Tabla A:
Tabla A – Convenciones Utilizadas en la Tablas de Definición de los Formatos XML
Título Descripción
Grupo Conjunto de campos
ID Identificación del campo para fines de referencia
Campo Nombre del campo. La primera letra indica:c: código integrante de una tabla existente en el Capítulo 16
septiembre de 2019 33
Tabla A – Convenciones Utilizadas en la Tablas de Definición de los Formatos XML
Título Descripción
```
i: código integrante de una tabla que se encuentra en la columna “Observaciones”
```
```
d: nombre de un campo común
```
```
g: nombre de un grupo
```
```
r: raíz de XML
```
Descripción Descripción del campo y su significado
```
Nodo Padre Referencia al ID del campo de grupo que contiene este campo específico (campopadre)
```
```
Tipo de Dato Tipo de dato (ver Tabla B)
```
```
Longitud Tamaño del campo (ver Tabla C)
```
Ocurrencia
Ocurrencias, en el formato m-n, en el cual
```
m: número mínimo de veces que el campo debe aparecer en el grupo
```
```
n: número máximo de veces que el campo puede aparecer en el grupo
```
Observaciones Observaciones importantes sobre el campo, incluyendo listas de valores posibles,
validaciones relevantes entre otras.
Versión Versión que el campo fue introducido en el formato, o versión en la cual ha sido
modificado por la última vez
Los tipos de campos de los archivos XML tienen su contenido descrito en la Tabla B.
Tabla B – Tipos de Datos en los Archivos XML
Tipo Descripción
XML Documento XML, descripto en un schema contenido en esta ficha técnica
G Grupo de elementos y/o grupos de elementos
CG “Choice Group”, elemento que excluye la ocurrencia de otro Choice Group, con elmismo padre
CE
“Choice Element”, elemento que excluye la ocurrencia de otro Choice Element con
el mismo padre
• Por ejemplo los varios tipos de RUC
El tipo de elemento aparece luego al lado
• Por ejemplo, “CEA” indica un Choice Element alfanumérico
A Alfanumérico
N Numérico: Vea los diversos formatos en la Tabla C
F
```
Fecha: Los campos de fecha, según corresponda, deberán contener fecha y hora en
```
el formato: AAAA-MM-DDThh:mm:ss o AAAA-MM-DD
• Por ejemplo, para expresar 2:23 PM de 01 de febrero de 2018: 2018-02-01-
14:23:00
Por ejemplo, para expresar 01 de febrero de 2018: 2018-02-01
B Binario en Base64 para envío de lote
septiembre de 2019 34
Los tamaños de campo utilizados en los archivos XML tienen su contenido descripto en la Tabla C. En el caso
```
de campos con tamaño exacto los espacios no utilizados deben ser llenados con ceros no significativos (a la
```
```
izquierda del campo).
```
Tabla C: Tamaños de campos
Título Descripción
X Tamaño exacto del campo• ej.: 2
```
x-y Tamaño mínimo x, máximo y• ej.: 0-10 (es posible expresar ningún valor, porque se permite el tamaño 0)
```
Xpn Tamaño exacto del campo x, con n cifras decimales exactamente• ej.: 22p4
```
xp(n-m) Tamaño exacto del campo x, con cifras decimales entre n y m• ej.: 22p(0-7)
```
```
(x-y)p(n-m)
```
Tamaño mínimo x, máximo y, con cifras decimales entre n y m
```
• ej.: 1-11p(0-6) (es obligatorio expresar algún valor, porque no se permite el tamaño
```
```
0, pero la parte decimal es opcional)
```
Valores
separados
por comas
El campo deberá ser informado con tamaño exacto de una de las opciones listadas
• ej.: 1, 3, 5, 8. Significa que se debe informar el campo con uno de estos cuatro
tamaños fijos
En la Tabla D se ejemplifica la manera de informar los formatos numéricos.
Tabla D: Formatos numéricos
Formato Para Informar Llenar campo con
0-11p0-6
1.105,13 1105.13
1.105,137 1105.137
1.105 1105
0 0
para no informar cantidad No incluir
0-11
1.105 1105
0 0
para no informar cantidad No incluir
1-11
1.105 1105
0 0
para no informar cantidad no es posible
```
NOTA: De manera a simplificar y utilizar toda la potencia del lenguaje, el punto (.) se utilizará como separador de decimales, tal y como lo muestra la
```
Tabla D
7.2.4. Recomendaciones mejores prácticas de generación del archivo
Como buenas prácticas al momento de la generación de los DE, tener precaución de NO incorporar:
• Espacios en blanco en el inicio o en el final de campos numéricos y alfanuméricos.
• Comentarios, anotaciones y documentaciones, léase las etiquetas annotation y documentation.
septiembre de 2019 35
• Caracteres de formato de archivo, como line-feed, carriage return, tab, espacios entre etiquetas.
• Prefijos en el namespace de las etiquetas.
• No incluir etiquetas de campos que no contengan valor, sean estas numéricas, que contienen ceros,
vacíos o blancos para campos del tipo alfanumérico. Están excluidos de esta regla todos aquellos
campos identificados como obligatorios en los distintos formatos de archivo XML, la obligatoriedad
de los mismos será plenamente detallada.
• No utilizar valores negativos
• El nombre de los campos es sensible a minúsculas y mayúsculas, por lo que deben ser comunicados
de la misma forma en la que se visualiza en el presente manual técnico.
• Ej: el grupo gOpeDE, es diferente a GopeDE, a gopede y a cualquier otra combinación distinta a la
inicial.
7.3. Contenedor de documento electrónico
Un contenedor del DE es un archivo XML que contiene el DE, con su validación de recepción, por parte del
SIFEN, así como cualquier evento, registrado que lo involucre.
La estructura está definida en la sección 9.4, correspondiente al SW “SiConsDE”.
7.4. Estándar de comunicación
La comunicación entre los contribuyentes y la SET está basada en los Servicios Web disponibles por el SIFEN.
El medio para establecer esta comunicación es la Internet, apoyado en la utilización del protocolo de seguridad
TLS versión 1.2, con autenticación mutua. Esto garantiza una comunicación segura, considerando la
identificación del cliente consumidor del servicio por medio de certificados digitales.
El modelo de comunicación sigue el estándar de Servicios Web definido por el WS-I4 BasicProfile5.
El intercambio de documentos o mensajes entre el SIFEN y el sistema de los contribuyentes, utiliza el estándar
SOAP, versión 1.26, con intercambio de mensajes XML basados en Style/Encoding: Document/Literal.
La llamada o Request a cualquiera de los Servicios Web del SIFEN, es realizada con el envío de un mensaje XML
incluido en el campo soap:Body.
Request de ejemplo utilizando SOAP:
```
4Web Services Interoperability Organization (WS-I, http://www.ws-i.org/about/Default.aspx)5
```
```
http://www.ws-i.org/Profiles/BasicProfile-1.0-2004-04-16.html6Web Services Interoperability Organization (WS-I, http://www.ws-i.org/about/Default.aspx)
```
6http://www.ws-i.org/Profiles/BasicProfile-1.0-2004-04-16.html6
```
https://www.w3.org/TR/soap12/
```
septiembre de 2019 36
<soap:Envelope
```
xmlns:soap="http://www.w3.org/2003/05/soap-envelope">
```
<soap:Header/>
<soap:body>
<rEnviDe xmlns="http://ekuatia.set.gov.py/sifen/xsd">
<dId>10000011111111</dId>
<xDE>
<rDE
```
xmlns="http://ekuatia.set.gov.py/sifen/xsd"
```
```
xmlns:xsi=http://www.w3.org/2001/XMLSchema-instance
```
```
xsi:schemaLocation="http://ekuatia.set.gov.py/sifen/xsd/siR
```
ecepDE_v150.xsd">
...
</rDE>
</xDE>
</rEnviDe>
</soap:body>
</soap:Envelope>
Response de ejemplo utilizando SOAP:
<env:Envelope
```
xmlns:soap="http://www.w3.org/2003/05/soap-envelope">
```
<env:Header/>
<env:body>
<ns2:rRetEnviDe xmlns:ns2="http://ekuatia.set.gov.py/sifen/xsd">
<ns2:rProtDe>
<ns2:dId>00000000000000000000000000000000000000000000</ns2:dId>
<ns2:dFecProc>2019-06-03T12:00:00</ns2:dFecProc>
<ns2:dDigVal>0000000000000000000000000000</ns2:dDigVal>
<ns2:gResProc>
<ns2:dEstRes>Rechazado</ns2:dEstRes>
<ns2:dProtAut>0000000000</ns2:dProtAut>
<ns2:dCodRes>0160</ns2:dCodRes>
<ns2:dMsgRes>XML malformado</ns2:dMsgRes>
</ns2:gResProc>
</ns2:rProtDe>
</ns2:rRetEnviDe>
</env:body>
</soap:Envelope>
7.5. Estándar de certificado digital
El SIFEN utiliza un certificado digital, emitido por cualquiera de los PSC7, habilitados por el Ministerio de
Industria y Comercio8 en su carácter de Administrador de la Autoridad Certificadora Raíz del Paraguay9 y ente
regulador. El certificado será utilizado para firmar digitalmente y para autenticarse en los servicios del SIFEN.
Puede ser del TIPO F110 o F211 de persona física o jurídica. En el caso de optar por el certificado de persona
jurídica, el RUC del contribuyente estará contenido en el campo SerialNumber. En el caso de optar por el
certificado de persona física, éste debe ser de un personal dependiente del contribuyente y el certificado debe
```
7 (PSC) Prestador de Servicios de Certificación https://www.acraiz.gov.py/html/Certif_1PrestaServ.html
```
8 www.acraiz.gov.py
```
9 (AA) Según la Ley N°4017 de Firma Digital es el Ministerio de Industria y Comercio
```
10 Tipo F1: corresponde a Certificado de Firma Digital por Software
11 Tipo F2: corresponde a Certificado de Firma Digital por Hardware
septiembre de 2019 37
contar obligatoriamente con el nombre y el RUC de la entidad en el que presta servicio el titular del certificado.
En este último caso el RUC del contribuyente estará contenido en el campo SubjectAlternativeName.
Estos certificados digitales serán exigidos por la SET en los siguientes momentos:
• Para firma de mensajes de datos: Se refiere al archivo de documento electrónico, registro de evento y/o
cualquier otro archivo XML admisible por el SIFEN, que requiera ser firmado digitalmente. El certificado
digital debe contener el RUC del contribuyente emisor y la clave prevista para la función de firma digital.
```
• Para establecimiento de conexiones y autenticaciones mutuas: (Comunicación entre el servidor del
```
```
contribuyente y el servidor del SIFEN). Para este efecto, el certificado digital debe contener el RUC del
```
contribuyente emisor y propietario responsable por la trasmisión del mensaje, con la extensión Extended
Key Usage con el permiso clientAuth.
Aclaración:
• Certificado de persona jurídica: el RUC del contribuyente debe estar informado en el:
o Campo X509 V3: Subject
o Nombre: “Serial Number” OID: 2.5.4.5
• Certificado de persona física: el RUC del contribuyente emisor debe estar informado en el:
o Campo X509 V3: SubjectAlternativeName
o Nombre: “SerialNumber” OID: 2.5.4.5
Para ambos casos, la información del RUC debe informarse de la siguiente manera:
RUCXXXXXXXXX-X -> es decir, se escribe la palabra RUC con mayúsculas, seguido del número de RUC
correspondiente con guion y el dígito verificador, sin ningún espacio en toda la cadena.
7.6. Estándar de firma digital
Los archivos enviados al SIFEN son documentos electrónicos construidos en lenguaje XML y deben estar
firmados con la firma digital amparada con el certificado correspondiente al RUC del contribuyente emisor del
documento.
Existen elementos que se encuentran presentes en el certificado digital del emisor de forma natural, lo que
implica innecesaria su exposición en la estructura XML. En este contexto los DE firmados digitalmente no
deben contener los siguientes elementos:
<X509SubjectName>
<X509IssuerSerial>
<X509IssuerName>
<X509SKI>
De igual manera se debe evitar el uso de los siguientes elementos, ya que esta información será obtenida a
partir del certificado digital del emisor.
septiembre de 2019 38
<KeyValue>
<RSAKeyValue>
<Modulus>
<Exponent>
Los DE utilizan el subconjunto del estándar de firma digital definido según W3C,
```
http://www.w3.org/TR/xmldsig-core/, conforme a lo expuesto en el Schema XML1.
```
Cada Documento Electrónico deberá ser firmado por el contribuyente emisor abarcando el grupo de
información A001, con sus respectivos subgrupos, identificado por el Atributo “Id” cuyo valor será el CDC
```
(Código de Control).
```
```
Véase la Tabla de Formato de Campos de un Documento Electrónico (DE). El mismo literal único (CDC)
```
precedido por el caracter “#” deberá ser informado en el atributo URI del tag Reference.
```
Schema XML 1: xmldsig-core-schema- v150.xsd (Estándar de la Firma Digital)
```
ID Campo DescripciónNodoPadreOcurrencia Observaciones
XS01 Signature - - Raíz
XS02 SinnedInfo G XS01 1-1 Grupo de información de la firma
XS03 CanonicalizationMethod G XS02 1-1 Grupo del método canónico
XS04 Algorithm A XS03 1-1
Atributo Algorithm de CanonicalizationMethod
```
https://www.w3.org/TR/2001/REC-xml-c14n-
```
20010315
XS05 SignatureMethod G XS02 1-1 Grupo del método de firma
XS06 Algorithm A XS05 1-1
Atributo Algorithm de SignatureMethod:
Sha256RSA
```
http://www.w3.org/2001/04/xmldsig-more#rsa-
```
sha256
XS07 Reference G XS02 1-1 Grupo Reference
XS08 URI A XS07 1-1 Atributo del Tag Reference que identifica los datosque se están firmandos
XS10 Transforms G XS07 1-1 Grupo Algorithm Transforms
XS12 Transforms G XS10 2-2 Grupo del Transform
XS13 Algorithm A XS12 2-2
Atributos válidos Algorithm de Transform:
```
https://www.w3.org/TR/xmldsig-core1/#sec-
```
EnvelopedSignature
```
http://www.w3.org/2001/10/xml-exc-c14n#
```
XS14 XPath E XS12 0-n XPath
XS15 DigestMethod G XS07 1-1 Grupo del método del DigestMethod
XS16 Algortihm A XS15 1-1
Atributo del algoritmo utilizado para el
```
DigestMethod:
```
```
https://www.w3.org/TR/2002/REC-xmlenc-core-
```
20021210/Overview.html#sha256
```
XS17 DigestValue E XS07 1 Digest Value (HASH SHA256)
```
XS18 SignatureValue G XS01 1-1 Grupo del Signature Value
XS19 KeyInfo G XS01 1-1 Grupo del KeyInfo
XS20 X509Data G XS19 1-1 Grupo X509
XS21 X509Certificate E XS20 1-1 Certificado Digital X509.v3
septiembre de 2019 39
Significado de la columna Descripción del Schema XML 1:
• G: Grupo
• A: Algoritmo
• RC: Regla
• E: Elemento
Esta estructura se debe utilizar para todos los archivos firmados, utilizando el CDC, para el atributo Id
<rDE xmlns=http://ekuatia.set.gov.py/sifen/xsd
```
xmlns:xsi=http://www.w3.org/2001/XMLSchema-instance
```
```
xsi:schemaLocation="http://ekuatia.set.gov.py/sifen/xsd/siRecepDE_v150.xsd">
```
<dVerFor>150</dVerFor>
<DE Id="0144444401700100100145282201170125158732260988">
...
</DE>
<Signature xmlns="http://www.w3.org/2000/09/xmldsig#">
<SignedInfo>
<CanonicalizationMethod
```
Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/>
```
<SignatureMethod Algorithm="http://www.w3.org/2001/04/xmldsig-more#rsa-sha256"/>
<Reference URI="#0144444401700100100145282201170125158732260988">
<Transforms>
<Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-
signature"/>
<Transform Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/>
</Transforms>
<DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>
<DigestValue>Nt2UmpjUHuu2DT6CJc2mtKhhqbq94LHSak1IsEOtuWk=
</DigestValue>
</Reference>
</SignedInfo>
<SignatureValue>DWN1my9sH4FI7ygPT3KF1ce...</SignatureValue>
<KeyInfo>
<X509Data>
<X509Certificate>MIIIxzCCBq+gAwIBAgITXAA...
</X509Certificate>
</X509Data>
</KeyInfo>
</Signature>
</rDE>
En el proceso de verificación de los certificados, el SIFEN se encargará de consultar la lista de certificados
```
revocados (LCR) al momento de la validación correspondiente, de manera que el contribuyente no necesitará
```
anexar esta lista al firmar el documento.
7.7. Especificaciones técnicas del estándar de certificado y firma digital
• Estándar de Firma: XML Digital Signature, se utiliza el formato Enveloped
```
http://www.w3.org/TR/xmldsig-core/
```
• Certificado Digital: Expedido por una de los PSC habilitados en la República del Paraguay, estándar
```
http://www.w3.org/2000/09/xmldsig#X509Data
```
```
https://www.acraiz.gov.py/html/Certif_1PrestaServ.html
```
septiembre de 2019 40
• Tamaño de la Clave Criptográfica: RSA 2048, para cifrado por software, para cifrado por hardware
pueden ser de RSA 2048 o RSA 4096.
```
• Función Criptográfica Asimétrica: RSA conforme a (https://www.w3.org/TR/2002/REC-xmlenc-core-
```
```
20021210/Overview.html#rsa-1_5 ).
```
• Función de “message digest”: SHA-2
```
https://www.w3.org/TR/2002/REC-xmlenc-core-20021210/Overview.html#sha256
```
• Codificación: Base64
```
https://www.w3.org/TR/xmldsig-core1/#sec-Base-64
```
• Transformaciones exigidas: Útil para canonizar el XML enviado, con el propósito de realizar la
validación correcta de la firma digital:
Enveloped, https://www.w3.org/TR/xmldsig-core1/#sec-EnvelopedSignature
C14N, http://www.w3.org/2001/10/xml-exc-c14n#
7.8. Procedimiento para la validación de la firma digital:
```
a) Extraer la clave pública del certificado digital,
```
```
b) Verificar el plazo de validez del certificado digital del emisor
```
```
c) Validar la cadena de confianza, identificando al PSC, así como la lista de certificados revocados de la
```
cadena
```
d) Verificar que el certificado digital utilizado es del contribuyente y no de una autoridad certificadora
```
```
e) Validar la integridad de las LCR utilizadas
```
```
f) Verificar el Plazo de validez de cada LCR (Effective Date y NextUpdate) en relación al momento de la
```
```
firma (campo fecha de la firma).
```
7.9. Síntesis de definiciones tecnológicas
La Tabla E resume los principales estándares de tecnología utilizados.
Tabla E: Estándares de tecnología utilizados
Característica Descripción
Web Services Estándar definido por WS-I Basic Profile 1.1
Medio lógico de comunicación Web Services disponibilizados por la SET
Medio físico de comunicación Internet
Protocolo de Internet TLS versión 1.2, con autenticación mutua utilizando los CertificadosDigitales.
Estándar de intercambio de datos SOAP versión 1.2
Estándar de Mensaje XML en el Estándar Style/Encoding: Document/Literal.
Estándar de Certificado Digital
ITU-T X.509 V.3 Information Technology Open Systems
Interconnection. The Directory: Public-key and attribute certificate
frameworks. Emitido por un PSC habilitado por el MIC.
```
https://www.acraiz.gov.py/html/Certif_1PrestaServ.html
```
Estándar de la Firma Digital
XML Digital Signature, Enveloped, con Certificado Digital X.509
versión 3, con clave privada de 2048 y estándares de criptografía
asimétrica RSA, RFC5639 y algoritmo SHA-256
Validación de la Firma Digital
Se validarán la integridad y la autoría, además la cadena de
confianza, por medio de las LCR en relación al momento de la firma
```
(campo fecha de la firma).
```
Estándares de utilización XML Definidos según las mejores prácticas a la hora de armar un archivoXML
septiembre de 2019 41
7.10. Resumen de las Direcciones Electrónicas de los Servicios Web para Ambientes de Pruebas y
Producción
URL Ambiente
```
https://sifen.set.gov.py/de/ws/sync/recibe.wsdl?wsdl Producción
```
```
https://sifen.set.gov.py/de/ws/async/recibe-lote.wsdl?wsdl Producción
```
```
https://sifen.set.gov.py/de/ws/eventos/evento.wsdl?wsdl Producción
```
```
https://sifen.set.gov.py/de/ws/consultas/consulta-lote.wsdl?wsdl Producción
```
```
https://sifen.set.gov.py/de/ws/consultas/consulta-ruc.wsdl?wsdl Producción
```
```
https://sifen.set.gov.py/de/ws/consultas/consulta.wsdl?wsdl Producción
```
```
https://sifen-test.set.gov.py/de/ws/sync/recibe.wsd?wsdl Test
```
```
https://sifen-test.set.gov.py/de/ws/async/recibe-lote.wsdl?wsdl Test
```
```
https://sifen-test.set.gov.py/de/ws/eventos/evento.wsdl?wsdl Test
```
```
https://sifen-test.set.gov.py/de/ws/consultas/consulta.wsdl?wsdl Test
```
```
https://sifen-test.set.gov.py/de/ws/consultas/consulta-lote.wsdl?wsdl Test
```
```
https://sifen-test.set.gov.py/de/ws/consultas/consulta-ruc.wsdl?wsdl Test
```
7.11. Servidor para sincronización externa de horario
Las direcciones para acceder a los servidores NTP para sincronización de horario son:
• aravo1.set.gov.py
• aravo2.set.gov.py
El acceso a los servicios, citados en los puntos 7.10 y 7.11, dependerá de la política de seguridad establecida
por la SET. Por lo que, podrá limitar y/o restringir la utilización de los servicios por contribuyente, por
direcciones IP u otros, de tal forma a asegurar la disponibilidad de los recursos según cada etapa del plan
general del SIFEN.
septiembre de 2019 42
8. Aspectos Tecnológicos de los Servicios Web del SIFEN
Los contribuyentes con naturaleza de emisores electrónicos realizarán el envío de sus DE, utilizando los
Servicios Web que el SIFEN pondrá a disposición de manera a operar máquina a máquina sin intervención del
usuario.
Para ello el sistema de los contribuyentes afectados, en adelante, clientes del servicio, deberán tener las
siguientes consideraciones:
• Poseer conexión a Internet de banda ancha.
• Para el envío de los DE deberán desarrollar el software cliente según lo enmarcado en el presente
documento, independientemente al lenguaje de programación utilizado.
• El lenguaje de intercambio de información utilizado será el XML.
• Para garantizar la comunicación segura, el software cliente deberá autenticarse ante el SIFEN
utilizando su certificado y firma digital.
El SIFEN dispondrá los siguientes servicios a ser consumidos por los clientes:
• Síncronos:
o Recepción DE
o Recepción evento
o Consulta DE
o Consulta RUC
```
o Consulta DE destinados (Futuro)
```
```
o Consulta DTE a entidades u organismos externos autorizados (a Futuro)
```
• Asíncronos:
o Recepción lote DE
o Consulta resultado lote
8.1. Servicio síncrono
```
La llamada (Request) del servidor del cliente a los servicios síncronos es procesado de forma inmediata por el
```
```
servidor del SIFEN y la respuesta (Response) se realiza en la misma conexión.
```
8.1.1. Flujo funcional:
```
a) El software cliente realiza la conexión enviando la solicitud (Request) al servicio del SIFEN.
```
```
b) El WS SIFEN recibe el Request y llama al software encargado del procesamiento del DE.
```
```
c) Éste, al culminar el proceso devuelve el resultado al WS SIFEN.
```
```
d) El WS SIFEN responde al cliente.
```
```
e) El software cliente, al obtener la respuesta, cierra la conexión.
```
septiembre de 2019 43
8.2. Servicio asíncrono
```
La llamada (Request) del servidor del cliente es procesada de la siguiente manera:
```
8.2.1. Secuencia del servicio asíncrono:
```
a) El Cliente realiza la conexión realizando un Request al WS SIFEN.
```
```
b) El WS SIFEN recibe la solicitud y responde con un mensaje de aprobación o rechazo, según las primeras
```
validaciones. Esta respuesta contiene:
a. Identificador de respuesta. (IdResp)
b. Situación (Aprobación o Rechazo).
c. Fecha y hora de recepción del mensaje.
d. Tiempo promedio de procesamiento, expresado en segundos.
```
c) El software cliente, al obtener el Response, cierra la conexión.
```
```
d) El procesamiento de los DE será realizado de manera posterior a esta conexión.
```
8.2.2. Tiempo promedio de procesamiento de un lote:
El tiempo de procesamiento en SIFEN para la validación de un DE es una información esencial del rendimiento
del sistema. Esta información está asociada directamente al procesamiento asincrónico de lotes de DE. En la
respuesta de procesamiento de un lote, una de las informaciones que se proporcionará será, justamente, el
tiempo promedio de procesamiento de un DE en los últimos 5 minutos.
Este tiempo promedio de procesamiento tendrá como unidad de medida milisegundos.
Para el cálculo del tiempo promedio de procesamiento se debe realizar la diferencia aritmética de tiempos de
```
procesamiento de los DE en los últimos 5 minutos, calculado como diferencia entre las fechas (considerando
```
```
día, mes, año, hora, minuto y segundo) de recepción de los lotes en SIFEN y sus fechas de procesamiento de
```
```
las respuestas de los lotes procesados (considerando día, mes, año, hora, minuto y segundo).
```
Este mismo tiempo promedio de procesamiento de DE estará disponible en el Portal e-Kuatia en el servicio de
semáforo de monitoreo de los WS.
Siempre que el tiempo calculado sea inferior a un segundo, la aplicación contestará como valor un segundo
de tiempo promedio.
Para los cálculos que arrojen cifras superiores a un segundo, se presentará:
• En los casos que los decimales sean inferiores a 500 ms, el valor entero se redondeará por debajo.
• En caso de que los decimales sean superiores a 500 ms, el valor entero se redondeará por encima.
```
Los contribuyentes (clientes) deberán considerar este promedio de tiempo, antes de consumir el servicio de
```
consulta de procesamiento y para la decisión del inicio del uso de la contingencia.
septiembre de 2019 44
8.3. Estándar de mensajes de los servicios del SIFEN
La solicitud de consumo de los servicios dispuestos por el SIFEN debe seguir el estándar:
• Área de datos: Esquema XML definido para cada WS.
8.4. Versión de los Schemas XML
Las modificaciones de los Schemas correspondientes a los servicios del SIFEN, pueden originarse como
necesidades técnicas, cambios normativos o de funcionalidad.
Estos cambios no serán aplicados de forma frecuente, considerando siempre el tiempo necesario para la
adecuación de los sistemas de los contribuyentes afectados.
Los mensajes recepcionados en una versión desactualizada serán rechazados especificando el error de versión.
Toda actualización de formato de los WS del SIFEN será correctamente respaldada por la actualización de su
correspondiente Schema.
8.4.1. Identificación de la versión de los Schemas XML
La versión del Schema de los DE es identificada en el nombre del archivo correspondiente, con el número
antecedido por los caracteres “_v”.
El nombre del Schema XML de la factura electrónica, versión 150 es: FE_v150.xsd
8.4.2. Liberación de versiones de los Schemas XML
Los Schemas utilizados por el SIFEN serán reglamentados y publicados en la dirección
“http://ekuatia.set.gov.py/sifen/xsd”.
Las actualizaciones de Schemas estarán publicadas en forma comprimida y contendrá el conjunto de Schemas
utilizados para la generación de los DE y consumo de WS, si correspondiera.
Este Schema tendrá la misma versión que el DE equivalente. Los archivos comprimidos serán nominados de la
siguiente manera “PS_FE_150.zip”, donde las primeras dos letras son constantes, las siguientes corresponden
al tipo de DE, seguido de la versión a la cual corresponde, en el ejemplo, versión 150.
Los archivos correspondientes a Schemas XML, se distinguen por la extensión .xsd
Según lo descripto, el archivo correspondiente al Schema XML de la recepción del DE de la versión 150 es:
SiRecepDE_v150.xsd
8.4.3. Paquete inicial de Schemas
Al momento de la publicación de la versión oficial del presente Manual Técnico, también se disponibilizará el
paquete de Schemas afectados inicialmente.
septiembre de 2019 45
9. Descripción de los Servicios Web del SIFEN
Ciertas validaciones son aplicadas igualitariamente a todos los DE y en todos los WS establecidos por el SIFEN,
según se identifican en el capítulo de validaciones del presente Manual Técnico. Estas validaciones son
empleadas en la secuencia que están dispuestas, así como, los procedimientos afectados.
De forma independiente son aplicadas las validaciones particulares, ya sea en los DE como en los WS.
9.1. WS recepción documento electrónico – siRecepDE
Función: Recibir un DE
```
Proceso: Sincrónico
```
Método: SiRecepDE
9.1.1. Definición del protocolo que consume este servicio
El protocolo de entrada para este servicio es la estructura XML que contiene un DE firmado, según el detalle
del siguiente cuadro:
```
Schema XML 2: siRecepDE_v150.xsd (WS Recepción DE)
```
ID Campo Descripción NodoPadre Tipo Dato Longitud Ocu Observaciones
ASch01 rEnviDe Raíz - - - - Elemento raíz
ASch02 dId Identificador decontrol de envío ASch01 N 1-15 1-1
Número secuencial
autoincremental, para
identificación del archivo
enviado. La
responsabilidad de
generar y controlar este
número es exclusiva del
contribuyente.
ASch03 xDe XML del DEtransmitido ASch01 XML - 1-1
Siguiendo las
definiciones del formato
del DE
9.1.2. Descripción del procesamiento
Servicio encargado de recibir un documento electrónico firmado digitalmente, en formato XML y construido
según el esquema detallado en este Manual Técnico.
Procesa las validaciones12 correspondientes y responde con un protocolo en XML, el resultado
correspondiente.
12 Las validaciones están detalladas en el capítulo 12 del presente Manual
septiembre de 2019 46
```
Este procedimiento se aplica concretamente sobre el contenido del campo ASch02 (campo XML del DE
```
```
transmitido).
```
9.1.3. Protocolo de respuesta
Contiene el resultado del procesamiento del DE, conforme lo detallado en el siguiente cuadro:
El Schema correspondiente al protocolo de respuesta será como sigue:
```
Schema XML 3: resRecepDE_v150.xsd (Respuesta del “WS Recepción DE”)
```
ID Campo Descripción NodoPadreTipoDato Longitud Ocu Observaciones
ARSch01 rRetEnviDe Raíz - - - - Elemento raíz
ARSch02 xProtDe Protocolo deprocesamiento del DE ARSch01 XML - 1-1 Schema XML 4
```
Schema XML 4: ProtProcesDE_v150.xsd (Protocolo de Procesamiento de DE)
```
ID Campo Descripción NodoPadreTipoDato Longitud Ocu Observaciones
PP01 rProtDe Raíz - - - -
PP02 id CDC del DE Procesado PP01 A 44 1-1
PP03 dFecProc Fecha y hora delprocesamiento PP01 D 19 1-1
```
Formato: “AAAA-
```
MM-DD-
```
hh:mm:ss”
```
PP04 dDigVal DigestValue del DEprocesado PP01 28 1-1
Permite verificar la
correspondencia
con el DE
transmitido por el
contribuyente
PP050 dEstRes Estado del resultado PP05 A 8-30 1-1
Aprobado
Aprobado con
observación
Rechazado
PP051 dProtAut Número deTransacción PP05 N 10 0-1
PP05 gResProc Grupo Resultado deProcesamiento PP01 G 1-100
Para producción se
limitará a 5
mensajes máximos
sin modificación de
esta especificación.
PP052 dCodRes Código del resultado deprocesamiento PP05 N 4 1-1
Definido en el
tópico
correspondiente del
capítulo 12
PP053 dMsgRes
Mensaje del resultado
de procesamiento PP05 A 1-255 1-1
Definido en el
tópico
correspondiente del
capítulo 12
septiembre de 2019 47
9.2. WS recepción lote DE – siRecepLoteDE
Función: Recibir un lote conteniendo varios DE
```
Proceso: Asíncrono
```
Método: SiRecepLoteDE
```
Particularidad: Archivo comprimido “.zip”
```
9.2.1. Definición del protocolo que consume este servicio
Para consumir este servicio, el cliente deberá construir la estructura en XML, según el Schema siguiente y
```
comprimir dicho archivo. Cabe aclarar que el lote podrá contener hasta 50 DE del mismo tipo (ejemplo:
```
```
Facturas Electrónicas), cada uno de ellos debe estar firmado.
```
```
Schema XML 5: SiRecepLoteDE_v150.xsd (WS Recepción DE Lote)
```
ID Campo Descripción NodoPadreTipoDato Longitud Ocu Observaciones
BSch01 rEnvioLote Raíz - - Elemento raíz
BSch02 dId Identificador decontrol de envío BSch01 N 1-15 1-1
Número secuencial
autoincremental, para
identificación del
mensaje enviado. La
responsabilidad de
generar y controlar este
número es exclusiva del
contribuyente.
BSch03 xDE Archivo de Lotecomprimido BSch01 B - 1-1
Campo comprimido en
formato Base64 según
el esquema del
Protocolo de
procesamiento del Lote
```
Schema XML 5A: ProtProcesLoteDE_v150.xsd (Protocolo de procesamiento del Lote)
```
ID Campo Descripción NodoPadreTipoDato Longitud Ocu Observaciones
LSch01 rLoteDE Raíz - - Elemento raíz
LSch02 rDE Protocolo deprocesamiento del DE LSch01 XML - 1-50
Sigue las
definiciones del
Capítulo Formato
de los DE
9.2.2. Descripción del procesamiento
Servicio disponible para recibir un lote que puede contener hasta 50 DE de un solo tipo, cada uno firmado
digitalmente y agrupados mediante un contenedor el cual posee el certificado digital del emisor. No se
requiere que el número del DE sea secuencial en el lote. Un lote debe contener solo un mismo tipo de DE.
septiembre de 2019 48
Una vez establecida la conexión con el SIFEN se realizarán las validaciones iniciales13, la respuesta corresponde
a un protocolo XML, donde se informa si superó o no las primeras validaciones.
9.2.3. Protocolo de respuesta
Corresponde al protocolo de procesamiento del DE y la definición de los Schemas XML 3 y XML 4.
```
Schema XML 6: resRecepLoteDE_v150.xsd (Respuesta del WS Recepción Lote)
```
ID Campo Descripción NodoPadreTipoDatoLongitud Ocu Observaciones
BRSch01 rResEnviLoteDe Raíz - - - - Elemento raíz
BRSch02 dFecProc Fecha y hora derecepción BRSch01 D 19 1-1 Formato: “AAAA-MM- DD-hh:mm:ss”
BRSch03 dCodRes Código del resultado derecepción BRSch01 N 4 1-1
Definido en el tópico
correspondiente del
capítulo 12
BRSch04 dMsgRes Mensaje del resultadode recepción BRSch01 A 1-255 1-1
Definido en el tópico
correspondiente del
capítulo 12
BRSch05 dProtConsLote Número de Lote BRSch01 N 1-15 0-1
Generado solamente
si dCodRes=0300,
Definido en el tópico
correspondiente del
capítulo 12
BRSch06 dTpoProces
Tiempo medio de
procesamiento en
segundos
BRSch01 N 1-5 1-1
Conforme a la
sección
correspondiente en
el presente manual
9.3. WS consulta resultado de lote DE – siResultLoteDE
Función: Devuelve el resultado del proceso de cada unode los DE del lote
```
Proceso: Asíncrono
```
Método: SiResultLoteDE
9.3.1. Definición del protocolo que consume este servicio
El Request que consumirá este servicio estará construido en XML, según el Schema expuesto a continuación:
```
Schema XML 7: SiResultLoteDE_v150.xsd (WS Consulta Resultado de Lote)
```
ID Campo Descripción NodoPadreTipoDatoLongitud Ocu Observaciones
CSch01 rEnviConsLoteDe Raíz - - - - Elemento raíz
13 Estas validaciones iniciales, están contenidas en el Capítulo 12 del presente Manual.
septiembre de 2019 49
ID Campo Descripción NodoPadreTipoDatoLongitud Ocu Observaciones
CSch02 dId Identificador decontrol de envío CSch01 N 1-15 1-1
Número secuencial
autoincremental, para
identificación del mensaje
enviado. La
responsabilidad de
generar y controlar este
número es exclusiva del
contribuyente.
CSch03 dProtConsLote Número del lote CSch01 N 1-15 1-1
Obtenido a partir del
mensaje de respuesta al
WS
```
soRecepLoteDE(Schema
```
```
XML 5)
```
9.3.2. Descripción del procesamiento
Servicio que se encarga de retornar el resultado del procesamiento de cada DE contenido en el lote que fuera
recibido. Cada uno de los DE es identificado y contiene el resultado de su procesamiento y la situación, si fue
```
aprobado, aprobado con observación, o rechazado; en caso de aprobado con observación, serán informadas
```
```
las mismas (hasta 5 observaciones); y en caso de rechazo, será informado el motivo (solo el primer motivo de
```
```
rechazo).
```
Tabla F – Resultados de Procesamiento del WS Consulta Resultado de Lote
Condición Mensaje generado
```
No existe número de lote consultado 0360 (Número del Lote inexistente)
```
No se ha culminado el procesamiento de los DE
del lote consultado 0361 Lote en procesamiento
Éxito en la consulta
```
0362 (Procesamiento de lote concluido)
```
- La respuesta también contiene el contenedor del
DE, definido en el Schema XML 11
9.3.3. Protocolo de respuesta
Conforme a lo definido deberá contener alguno de los mensajes de la tabla anterior, con la respuesta
correspondiente.
Para el caso que el procesamiento del lote haya concluido, el Response también contendrá el protocolo de
respuesta de cada uno de los DE contenidos en el lote, de acuerdo al Schema descrito a continuación.
```
Schema XML 8: resResultLoteDE_v150.xsd (Respuesta del WS Consulta Resultado Lote)
```
ID Campo Descripción NodoPadreTipoDato Longitud Ocu Observaciones
CRSch0
1
rResEnviCon
sLoteDe Raíz - - - - Elemento raíz
CRSch0
2 dFecProc
Fecha y hora del
procesamiento del lote CRSch01 D 19 1-1
```
Formato: “AAAA-MM-
```
```
DDhh:mm:ss”
```
Si el lote no fue
procesado, el valor será
vacío.
septiembre de 2019 50
CRSch0
3 dCodResLot
Código de resultado de
procesamiento del lote CRSch01 N 4 1-1
Definido en el tópico
correspondiente del
capítulo 12 referente al
lote
CRSch0
4 dMsgResLot
Mensaje de resultado
de procesamiento del
lote
CRSch01 A 1-255 1-1
Definido en el tópico
correspondiente del
capítulo 12 referente al
lote
CRSch0
5
gResProcLot
e
Grupo Resultado de
Procesamiento del
Lote
CRSch01 G 0-50
CRSch0
50 id
CDC del DE
procesado CRSch05 A 44 1-1
CRSch0
51 dEstRes Estado del resultado CRSch05 A 8-30 1-1
Aprobado
Aprobado con
observación
Rechazado
CRSch0
52 dProtAut Número de transacción CRSch05 N 10 0-1
Generado para el DE
del lote consultado si
```
dCodResLot=0362
```
CRSch0
53 gResProc
Grupo Mensaje de
Resultado CRSch05 G 1-100
Si es error solo se
presentará el primero.
Se pueden tener hasta
100 mensajes en caso
de aprobación con
observaciones.
CRSch0
54 dCodRes
Código de resultado de
procesamiento CRSch05 N 4 1-1
Definido en el tópico
correspondiente del
capítulo 12 referente a
cada DE
CRSch0
55 dMsgRes
Mensaje de resultado
de procesamiento CRSch05 A 1-255 1-1
Definido en el tópico
correspondiente del
capítulo 12 referente a
cada DE
9.4. WS consulta DE – siConsDE
Función: Devuelve el resultado de la consulta de un DE
por su CDC
```
Proceso: Síncrono
```
Método: SiConsDE
9.4.1. Definición del protocolo que consume este servicio
El Request que consumirá este servicio estará construido en XML, según el Schema expuesto a continuación.
```
Schema XML 9: siConsDE_v150.xsd (WS Consulta DE)
```
ID Campo Descripción NodoPadreTipoDato Longitud Ocu Observaciones
DSch01 rEnviConsDe Raíz - - - - Elemento Raíz
DSch02 dId Identificador de control deenvío DSch01 N 1-15 1-1
Número secuencial
autoincremental, para
identificación del mensaje
enviado. La
responsabilidad de generar
y controlar este número es
exclusiva del
contribuyente.
DSch03 dCDC CDC del DE consultado DSch01 C 44 1-1
CDC del DE que se
requiere la consulta en la
base de datos de SIFEN
septiembre de 2019 51
9.4.2. Descripción del procesamiento
Este servicio es el encargado de recibir la petición de consulta de un DTE de la base de datos de SIFEN. En caso
de no haber superado las validaciones, el Response contendrá el motivo.
Tabla G – Resultados de Procesamiento del WS Consulta DE
Condición Mensaje generado
No existe DE consultado 0420=CDC inexistente
RUC del certificado utilizado en la conexión no tiene
permiso para consultar el DE 0421=RUC Certificado sin permiso
Éxito en la consulta 0422=CDC encontrado
9.4.3. Protocolo de respuesta
Como ya manifestamos en el punto anterior, si las pruebas no son superadas, contendrá el error, de
lo contrario el response tendrá la información conforme al siguiente Schema.
```
Schema XML 10: resConsDE_v150.xsd (Respuesta del WS Consulta DE)
```
ID Campo Descripción Nodo Padre TipoDatoLongitud Ocu Observaciones
DRSc
h01
rResEnviCo
nsDe Raíz - - - - Elemento raíz
DRSc
h02 dFecProc
Fecha y hora del
procesamiento DRSch01 D 19 1-1
```
Formato: “AAAA-MM-DD-
```
```
hh:mm:ss”
```
DRSc
h03 dCodRes
Código del resultado de
procesamiento DRSch01 N 4 1-1
Definido en el tópico
correspondiente del
capítulo 12
DRSc
h04 dMsgRes
Mensaje del resultado
de procesamiento DRSch01 C 1-255 1-1
Definido en el tópico
correspondiente del
capítulo 12
DRSc
h05 xContenDE Contenedor del DE DRSch01 XML - 0-1
Existe solamente si
```
dCodRes = 0422
```
Definido en el Schema XML
11
```
Schema XML 11: ContenedorDE_v150.xsd (Contenedor de DE)
```
ID Campo Descripción Nodo Padre TipoDatoLongitud Ocu Observaciones
ContD
E01 rContDe Raíz DRSch01 - - - Elemento raíz
ContD
E02 rDE Archivo XML del DE ContDE01 XML - 1-1
ContD
E03 dProtAut
Número De
Transacción ContDE01 XML - 1-1
Número de transacción del
DE, recibido por el
contribuyente en el
mensaje de respuesta del
septiembre de 2019 52
ID Campo Descripción Nodo Padre TipoDatoLongitud Ocu Observaciones
WS DeRecepDE o del WS
deResultLoteDE
• definido en el Schema
XML 4
ContD
E04 xContEv Contenedor de Evento ContDE01 XML - 0-n
Información de todos los
eventos registrados
```
(contenedor montado por la
```
```
SET) o disponibles
```
```
(contenedor montado por el
```
```
emisor) hasta la fecha
```
• Definido en el Schema
XML 12
```
Schema XML 12: ContenedorEvento_v150.xsd (Contenedor de Evento)
```
ID Campo Descripción NodoPadreTipoDatoLongitud Ocu Observaciones
ContE
v01 rContEv Raíz - - - - Elemento raíz
ContE
v02 xEvento XML del Evento
ContEv
01 XML - 1-1
Definido en el capítulo de
Eventos del DE
ContE
v03
rResEnviE
ventoDe
Respuesta del WS
Recepción Evento
ContEv
01 XML -
Definido en el Schema XML
14
9.5. WS recepción evento – siRecepEvento
Función: Registra un evento en un DE
```
Proceso: Síncrono
```
Método: siRecepEvento
9.5.1. Definición del protocolo que consume este Servicio
Contiene el tipo de evento y el evento.
```
Schema XML 13: siRecepEvento_v150.xsd (WS Recepción Evento)
```
ID Campo Descripción NodoPadreTipoDatoLongitud Ocu Observaciones
GSch01 rEnviEventoDe Raíz - - - - Elemento raíz
GSch02 dId Identificador de controlde envío GSch01 N 1-15 1-1
Número secuencial
autoincremental, para
identificación del mensaje
enviado. La responsabilidad
de generar y controlar este
número es exclusiva del
contribuyente.
GSch03 dEvReg Evento a ser registrado GSch01 XML 1 1-1
De acuerdo con el schema y
grupos correspondientes
Descripto en el capítulo 11
septiembre de 2019 53
9.5.2. Descripción del procesamiento
Una vez superadas todas las validaciones iniciales y particulares, se registra el evento del DE correspondiente
y este queda debidamente almacenado en el SIFEN.
9.5.3. Protocolo de respuesta
Conforme al Schema que precede y conforme a las validaciones efectuadas, si el procesamiento concluye con
éxito, el registro de evento, contiene una respuesta satisfactoria, en caso de rechazo contiene el código y
motivo de rechazo.
```
Schema XML 14: resRecepEvento_v150.xsd (Respuesta del WS Recepción Evento)
```
ID Campo Descripción Nodo Padre TipoDatoLongitud Ocu Observaciones
GRSch01 rRetEnviEventoDe Raíz - - - - Elemento raíz
GRSch02 dFecProc
Fecha y hora del
procesamiento del
último evento
enviado
GRSch01 D 19 1-1 Formato: “AAAA-MM-DD-hh:mm:ss-ss:ss”
GRSch03 gResProcEVe
Grupo Resultado
de Procesamiento
del Evento
GRSch01 G 1-15
GRSch030 dEstRes Estado delresultado CRSch03 A 8-30 1-1
Aprobado
Aprobado con observación
Rechazado
GRSch031 dProtAut Número detransacción GRSch03 N 10 0-1
Generado para cada registro
de evento conforme
```
dCodRes=0600
```
GRSch032 id Identificador delevento GRSch03 N 10 1-1
Corresponde al id
autogenerado por el emisor,
para identificar cada evento
GRSch033 gResProc Grupo Resultado deProcesamiento GRSch03 G 1-100
Para producción se limitará a 5
mensajes máximos sin
modificación de esta
especificación.
GRSch034 dCodRes Código del resultadode procesamiento GRSch03 N 4 1-1
Definido en el tópico
correspondiente del capítulo
11
GRSch035 dMsgRes
Mensaje del
resultado de
procesamiento
GRSch03 A 1-255 1-1
Definido en el tópico
correspondiente del capítulo
11
9.6. WS consulta RUC – siConsRUC
Función: Devuelve el resultado de la consulta de los
datos y estado del RUC de un contribuyente
receptor.
```
Proceso: Síncrono
```
Método: SiConsRUC
septiembre de 2019 54
9.6.1. Definición del protocolo que consume este servicio
El Request que consumirá este servicio estará construido en XML, según el Schema expuesto a continuación.
```
Schema XML 15: siConsRUC_v150.xsd (WS Consulta RUC)
```
ID Campo Descripción NodoPadreTipoDato Longitud Ocu Observaciones
RSch01 rEnviConsRUC Raíz - - - - Elemento Raíz
RSch02 dId Identificador decontrol de envío RSch01 N 1-15 1-1
Número secuencial
autoincremental, para
identificación del mensaje
enviado. La responsabilidad
de generar y controlar este
número es exclusiva del
contribuyente.
RSch03 dRUCCons RUC consultado RSch01 A 5-8 1-1 RUC No incluye el Digito deverificación
9.6.2. Descripción del procesamiento
Este servicio es el encargado de recibir la petición de consulta de los datos y estado del RUC de un
contribuyente receptor en la base de datos de SIFEN. Solamente se permiten conexiones con certificado
digital. Los posibles resultados se listan en la tabla H.
Tabla H – Resultados de Procesamiento del WS Consulta RUC
Condición Mensaje generado
El RUC consultado no existe en el Sistema 0500=RUC no existe
RUC no tiene permiso para utilizar el WS 0501=RUC sin permiso consulta WS
Éxito en la consulta 0502=RUC encontrado
9.6.3. Protocolo de respuesta
En casos de que haya concluido con éxito la consulta, contiene el código de respuesta 0502, o en caso contrario
contiene el código de respuesta correspondiente.
```
Schema XML 16: resConsRUC_v150.xsd (Respuesta del WS Consulta RUC)
```
ID Campo Descripción NodoPadreTipoDato Longitud Ocu Observaciones
RRSch0
1
rResEnviConsR
UC Raíz - - - - Elemento raíz
RRSch0
2 dCodRes
Código del
resultado de la
consulta RUC
RRSch01 N 4 1-1
Definido en el tópico
correspondiente del
capítulo 12
RRSch0
3 dMsgRes
Mensaje del
resultado de la
consulta RUC
RRSch01 A 1-255 1-1
Definido en el tópico
correspondiente del
capítulo 12
septiembre de 2019 55
ID Campo Descripción NodoPadreTipoDato Longitud Ocu Observaciones
RRSch0
4 xContRUC
Contenedor del
RUC RRSch01 XML - 0-1
Existe solamente si
```
dCodRes = 0502
```
Definido en el Schema
XML 17
```
Schema XML 17: ContenedorRUC_v150.xsd (Contenedor de RUC)
```
ID Campo Descripción NodoPadreTipoDato Longitud Ocu Observaciones
ContRU
C01 rContRUC Raíz RRSch01 - - - Elemento raíz
ContRU
C02 dRUCCons RUC Consultado ContRUC01 A 5-8 1-1
ContRU
C03 dRazCons
Razón social del
RUC Consultado ContRUC01 A 1-250 1-1
ContRU
C04 dCodEstCons
Código del Estado
del RUC
Consultado
ContRUC01 A 3 1-1
```
ACT=Activo
```
```
SUS=Suspensión
```
Temporal
```
SAD=Suspensión
```
Administrativa
```
BLQ=Bloqueado
```
```
CAN=Cancelado
```
```
CDE=Cancelado
```
Definitivo
ContRU
C05 dDesEstCons
Descripción
Código del Estado
del RUC
Consultado
ContRUC01 A 6-25 1-1
```
ACT=Activo
```
```
SUS=Suspensión
```
Temporal
```
SAD=Suspensión
```
Administrativa
```
BLQ=Bloqueado
```
```
CAN=Cancelado
```
```
CDE=Cancelado
```
Definitivo
ContRU
C06 dRUCFactElec
RUC consultado
es facturador
electrónico
ContRUC01 A 1 1-1
```
S = Es facturador
```
electrónico
```
N = No es facturador
```
electrónico
```
9.7. WS consulta DE de entidades u organismos externos autorizados – siConsDEST (a futuro)
```
Función: Web service que tiene por objetivo entregar los DE y sus eventos para
las entidades que tiene derecho legal de recibir determinadas facturas
```
(Ej: DNA, con respecto a operaciones de comercio exterior, DNCP con
```
```
respecto a operaciones de venta al Estado)
```
```
Proceso: Síncrono
```
Método: siConsDEST
Observación: A futuro
septiembre de 2019 56
10. Formato de los Documentos Electrónicos
```
10.1. Estructura del código de control (CDC) de los DE
```
A fin de mantener una única identificación para cada documento electrónico, implementamos el código de
control o CDC14.
Este CDC debe ser generado por el sistema de facturación del emisor conforme a los delineamientos
contenidos en el presente Manual Técnico.
Conformación del CDC
Para lograr una mayor comprensión se describe a continuación un ejemplo de cómo generar un CDC:
```
Consideraremos:
```
Por lo tanto, el CDC estará conformado como sigue:
14 CDC Código de Control, único en cada DE, se referencia de forma unívoca en el SIFEN
septiembre de 2019 57
Cabe destacar que este código de control es incluido dentro del Schema XML, en el campo A002 como atributo
para la firma del DE.
```
En la representación gráfica (KuDE) deberá ser visible, por lo tanto, debe ser expuesto en grupos de cuatro
```
caracteres, tal como sigue:
10.2. Dígito verificador del CDC
Para el cálculo del dígito verificador del código de control se debe utilizar el módulo 11, con el cual se
determina su validez.
La documentación acerca de cómo generar este dígito, la cual se basa en la conformación antes descripta, se
encuentra en la siguiente dirección:
```
https://www.set.gov.py/portal/PARAGUAY-SET/detail?content-id=/repository/collaboration/sites/PARAGUAY-SET/documents/herramientas/digito-
```
verificador.pdf
10.3. Generación del código de seguridad
```
El código de seguridad de los documentos electrónicos (campo dCodSeg) tiene como objetivo asegurar la
```
privacidad de los documentos emitidos, debe ser generado por el contribuyente emisor, conforme a las
siguientes condiciones:
• Debe ser un número positivo de 9 dígitos.
• Aleatorio.
• Debe ser distinto para cada DE y generado por un algoritmo de complejidad suficiente para evitar la
reproducción del valor.
• Rango NO SECUENCIAL entre 000000001 y 999999999.
• No tener relación con ninguna información específica o directa del DE o del emisor de manera a
garantizar su seguridad.
• No debe ser igual al número de documento campo dNumDoc.
• En caso de ser un número de menos de 9 dígitos completar con 0 a la izquierda.
Representación Gráfica
0144 4444 0170 0100 1001 4528 2201 7012 5158 7326 0988
septiembre de 2019 58
```
10.4. Datos que se deben informar en los documentos electrónicos (DE)
```
A fin de facilitar la comprensión de la estructura de información de los documentos electrónicos, a
continuación, se referencian los campos contenidos en los mismos, los cuales se han organizado, definido y
agrupado conforme a la Tabla I:
Tabla I – Grupos de campos del Archivo XML
```
AA. Campos que identifican el formato electrónico XML (AA001-AA009)
```
A. Campos firmados del Documento Electrónico (A001-A099)
B. Campos inherentes a la operación de Documentos Electrónicos (B001-B099)
C. Campos de datos del Timbrado (C001-C099)
D. Campos Generales del Documento Electrónico DE (D001-D299)
```
D1. Campos inherentes a la operación comercial (D010-D099)
```
```
D2. Campos que identifican al emisor del Documento Electrónico DE (D100-D129)
```
```
D2.1 Campos que describen la actividad económica del emisor (D130-D139)
```
```
D3. Campos que identifican al receptor del Documento Electrónico DE (D200 al D299)
```
E. Campos específicos por tipo de Documento Electrónico (E001-E009)
```
E1. Campos que componen la Factura Electrónica FE (E010-E099)
```
```
E1.1. Campos de informaciones de Compras Públicas (E020-E029)
```
```
E2. Campos que componen la Factura Electrónica de Exportación FEE (E100-E199)
```
```
E3. Campos que componen la Factura Electrónica de Importación FEI (E200-E299)
```
```
E4. Campos que componen la Autofactura Electrónica AFE (E300-E399)
```
```
E5. Campos que componen la Nota de Crédito/Débito Electrónica NCE-NDE (E400-E499)
```
```
E6. Campos que componen la Nota de Remisión Electrónica (E500-E599)
```
```
E7. Campos que describen la condición de la operación (E600-E699)
```
E7.1. Campos que describen la forma de pago de la operación al contado o del
```
monto de la entrega inicial (E605-E619)
```
E7.1.1. Campos que describen el pago o entrega inicial de la operación con
```
tarjeta de crédito/débito (E620-E629)
```
E7.1.2. Campos que describen el pago o entrega inicial de la operación con
```
cheque (E630-E639)
```
```
E7.2. Campos que describen la operación a crédito (E640-E649)
```
```
E7.2.1. Campos que describen las cuotas (E650-E659)
```
```
E8. Campos que describen los ítems de la operación (E700-E899)
```
E8.1. Campos que describen el precio, tipo de cambio y valor total de la operación
```
por ítem (E720-E729)
```
E8.1.1 Campos que describen los descuentos, anticipos y valor total por
```
ítem (EA001-EA050)
```
```
E8.2. Campos que describen el IVA de la operación por ítem (E730-E739)
```
```
E8.3. Campos que describen el ISC de la operación por ítem (futuro)
```
```
E8.4. Grupo de rastreo de la mercadería (E750-E760)
```
```
E8.5. Sector de automotores nuevos y usados (E770-E789)
```
```
E9. Campos complementarios comerciales de uso específico (E790-E899)
```
```
E9.2. Sector Energía Eléctrica (E791-E799)
```
```
E9.3. Sector de Seguros (E800-E809)
```
```
E9.3.1. Póliza de seguros (EA790-EA799)
```
```
E9.4. Sector de Supermercados (E810-E819)
```
```
E9.5. Grupo de datos adicionales de uso comercial (E820-E829)
```
```
E10. Campos que describen el transporte de las mercaderías (E900-E999)
```
septiembre de 2019 59
```
E10.1. Campos que identifican el local de salida de las mercaderías (E920-E939)
```
```
E10.2. Campos que identifican el local de entrega de las mercaderías (E940-E959)
```
```
E10.3. Campos que identifican el vehículo de traslado de mercaderías (E960-E979)
```
```
E10.4. Campos que identifican al transportista (persona física o jurídica) (E980-E999)
```
F. Campos que describen los subtotales y totales de la transacción documentada (F001-F099)
G. Campos complementarios comerciales de uso general (G001-G049)
```
G1. Campos generales de la carga (G050 - G099)
```
H. Campos que identifican al documento asociado (H001-H049)
I. Información de la Firma Digital del DTE (I001-I049)
J. Campos fuera de la Firma Digital (J001-J049)
10.5. Manejo del timbrado y Numeración
Se maneja la siguiente secuencia de campos que identifican a cada DE:
• Número de timbrado
• Establecimiento
• Punto de expedición
• Tipo de documento
• Número de documento
• Serie
```
Se ha incluido el uso de la serie (todas las combinaciones de a dos que se puedan realizar entre 2 letras
```
```
mayúsculas, excepto la Ñ) ya que el timbrado no manejará una fecha de fin de vigencia.
```
Ejemplo de uso:
Situación inicial
• Número de timbrado: 12345678
• Establecimiento: 001
• Punto de expedición: 001
• Tipo de documento: 01
• Número de documento: 0000001 al 9999999
Inicio de la serie
• Número de timbrado: 12345678
• Establecimiento: 001
• Punto de expedición: 001
• Tipo de documento: 01
• Número de documento: 0000001 al 9999999
• Serie: AA
Uso de la siguiente serie
• Número de timbrado: 12345678
septiembre de 2019 60
• Establecimiento: 001
• Punto de expedición: 001
• Tipo de documento: 01
• Número de documento: 0000001 al 9999999
• Serie: AB
Inicialmente no se utilizará serie hasta consumir toda la numeración que va desde 0000001 al 9999999 para
cada tipo de documento, luego la se tendrá que hacer uso de la serie según el siguiente orden.
• Orden de Serie: AA, AB, AC, … , AZ …BA, BB, …., BZ, … ZA, ZB, … , ZZ
El sistema validará la secuencialidad del uso de la serie. Esta secuencialidad se dará según el orden mencionado
en el ejemplo anterior.
Una vez que el SIFEN reciba un DE con serie, se tomará la fecha y hora de firma digital del DE como fecha inicial
de inicio de la serie.
El sistema aprobará solo aquellos DE en las siguientes condiciones:
```
(*) Serie inmediatamente anterior: DE con serie anterior a la mayor serie enviada al SIFEN, cuya fecha y hora
```
de firma digital es anterior a la fecha de inicio de vigencia de la serie actual en el sistema.
```
(*) Serie igual: DE con serie igual a la mayor serie enviada al SIFEN
```
```
(*) Serie inmediatamente posterior: DE con serie posterior a la mayor serie enviada al SIFEN, cuya fecha y
```
hora de firma digital es posterior a la fecha de inicio de vigencia de la serie actual en el sistema.
```
Ejemplo:
```
Serie actual: AC
Fecha de inicio de vigencia de la serie: 07/06/2019 08:30:00
Ejemplo de DE con Series aprobadas:
AB con fecha de firma anterior a 07/06/2019 08:30:00
Todos los DE con serie AC
AD con fecha de firma posterior a 07/06/2019 08:30:00
```
TABLA DE FORMATO DE CAMPOS DE UN DOCUMENTO ELECTRÓNICO (DE)
```
```
Schema XML 18: DE_v150.xsd (Documento Electrónico)
```
```
AA. Campos que identifican el formato electrónico XML (AA001-AA009)
```
Grupo ID Campo Descripción NodoPadreTipoDato Longitud Ocurrencia Observaciones
AA AA001 rDE Documento Electrónicoelemento raíz Raíz G 1-1
AA AA002 dVerFor Versión del formato AA001 N 3 1-1
Control de versiones
Este campo debe contener la
versión 150
A. Campos firmados del Documento Electrónico (A001-A099)
Grupo ID Campo Descripción NodoPadreTipoDato Longitud Ocurrencia Observaciones
A A001 DE Campos firmados delDE AA001 G 1-1
A A002 Id Identificador del DE A001 A 44
Atributo del Tag <DE>
```
NOTA: Con carácter excepcional
```
cuando un RUC contenga letras para
efectos del cálculo del Dígito verificador
y la generación del CDC se realizará la
conversión de dicha letra por su valor en
código ASCII
A A003 dDVId Dígito verificador delidentificador del DE A001 N 1 1-1 Según algoritmo módulo 11
septiembre de 2019 62
Grupo ID Campo Descripción NodoPadreTipoDato Longitud Ocurrencia Observaciones
A A004 dFecFirma Fecha de la firma A001 F 19 1-1
La fecha y hora de la firma digital debe
ser anterior a la fecha y hora de
transmisión al SIFEN
El certificado digital debe estar vigente
al momento de la firma digital del DE
Fecha y hora en el formato
AAAA-MM-DDThh:mm:ss
El plazo límite de transmisión del DE al
SIFEN para la aprobación normal es
de 72 h contadas a partir de la fecha y
hora de la firma digital.
A A005 dSisFact Sistema de facturación A001 N 1 1-1
1=Sistema de facturación del
contribuyente
2=SIFEN solución gratuita
B. Campos inherentes a la operación de Documentos Electrónicos (B001-B099)
Grupo ID Campo Descripción NodoPadreTipoDato Longitud Ocurrencia Observaciones
B B001 gOpeDE Campos inherentes ala operación de DE A001 G 1-1
B B002 iTipEmi Tipo de emisión B001 N 1 1-1 1= Normal2= Contingencia
B B003 dDesTipEmi Descripción del tipo deemisión B001 A 6-12 1-1
Referente al campo B002
1= “Normal”
2= “Contingencia”
B B004 dCodSeg Código de seguridad B001 N 9 1-1
Código generado por el emisor de
manera aleatoria para asegurar la
confidencialidad de la consulta
pública del DE
B B005 dInfoEmi
Información de interés
del emisor respecto al
DE
B001 A 1-3000 0-1
septiembre de 2019 63
Grupo ID Campo Descripción NodoPadreTipoDato Longitud Ocurrencia Observaciones
B B006 dInfoFisc
Información de interés
del Fisco respecto al
DE
B001 A 1-3000 0-1
Esta información debe ser impresa
en el KuDE.
Cuando el tipo de documento es
```
Nota de remisión (C002=7) es
```
obligatorio informar el mensaje
según el Art. 3 Inc. 7 de la Resolución
general Nro. 41/2014
C. Campos de datos del Timbrado (C001-C099)
Grupo ID Campo Descripción NodoPadreTipoDato Longitud Ocurrencia Observaciones
C C001 gTimb Datos del timbrado A001 G 1-1
C C002 iTiDE Tipo de DocumentoElectrónico C001 N 1-2 1-1
1= Factura electrónica
2= Factura electrónica de exportación
```
(Futuro)
```
3= Factura electrónica de importación
```
(Futuro)
```
4= Autofactura electrónica
5= Nota de crédito electrónica
6= Nota de débito electrónica
7= Nota de remisión electrónica
8= Comprobante de retención
```
electrónico (Futuro)
```
C C003 dDesTiDE Descripción del tipo dedocumento electrónico C001 A 15-40 1-1
Referente al campo C002
1= “Factura electrónica”
2= “Factura electrónica de
exportación”
3= “Factura electrónica de
importación”
4= “Autofactura electrónica”
5= “Nota de crédito electrónica”
6= “Nota de débito electrónica”
7= “Nota de remisión electrónica”
8= “Comprobante de retención
electrónico”
C C004 dNumTim Número del timbrado C001 N 8 1-1 Debe coincidir con la estructura detimbrado
septiembre de 2019 64
Grupo ID Campo Descripción NodoPadreTipoDato Longitud Ocurrencia Observaciones
C C005 dEst Establecimiento C001 A 3 1-1
```
Completar con 0 (cero) a la izquierda
```
Debe coincidir con la estructura de
timbrado
C C006 dPunExp Punto de expedición C001 A 3 1-1
```
Completar con 0 (cero) a la izquierda
```
Debe coincidir con la estructura de
timbrado
C C007 dNumDoc Número del documento C001 A 7 1-1
```
Debe empezar con 1 (uno) para un
```
nuevo timbrado.
```
Completar con 0 (cero) a la izquierda
```
```
hasta alcanzar 7 (siete) cifras
```
Debe coincidir con la estructura de
timbrado
Una vez que se haya agotado la
numeración permitida por el sistema
```
(9999999), la numeración de los
```
comprobantes electrónicos se
reinicia con la utilización de la serie,
para evitar rechazos por duplicidad
C C010 dSerieNum Serie del número detimbrado C001 A 2 0-1
Campo obligatorio cuando ya se ha
consumido la totalidad de la
numeración permitida por el sistema
```
(9999999).
```
Referirse a la sección Manejo del
timbrado y Numeración.
C C008 dFeIniT Fecha inicio de vigenciadel timbrado C001 F 10 1-1
Formato AAAA-MM-DD
Para el KuDE el formato de la fecha
de inicio de vigencia debe contener
los guiones separadores. Ejemplo:
2018-05-31
C C009 dFeFinT Fecha fin de vigencia deltimbrado C001 F 10 1-1
Formato AAAA-MM-DD
Para el KuDE el formato de la fecha
de inicio de vigencia debe contener
los guiones separadores. Ejemplo:
2018-05-31
septiembre de 2019 65
D. Campos Generales del Documento Electrónico DE (D001-D299)
Grupo ID Campo Descripción NodoPadreTipoDato Longitud Ocurrencia Observaciones
D D001 gDatGralOpe Campos generales delDE A001 G 1-1
D D002 dFeEmiDE Fecha y hora deemisión del DE D001 F 19 1-1
Fecha y hora en el formato
AAAA-MM-DDThh:mm:ss
Para el KuDE el formato de la fecha
de emisión debe contener los
guiones separadores. Ejemplo:
2018-05-31T12:00:00
Se aceptará como límites técnicos
del sistema, que la fecha de emisión
del DE sea atrasada hasta 720
```
horas (30 días) y adelantada hasta
```
```
120 horas (5 días) en relación a la
```
fecha y hora de transmisión al
SIFEN
```
D1. Campos inherentes a la operación comercial (D010-D099)
```
Grupo ID Campo Descripción NodoPadreTipoDato Longitud Ocurrencia Observaciones
D1 D010 gOpeCom Campos inherentes ala operación comercial D001 G 0-1 Obligatorio si C002 ≠ 7No informar si C002 = 7
septiembre de 2019 66
Grupo ID Campo Descripción NodoPadreTipoDato Longitud Ocurrencia Observaciones
D1 D011 iTipTra Tipo de transacción D010 N 1-2 0-1
Obligatorio si C002 = 1 o 4
No informar si C002 ≠ 1 o 4
Tipo de transacción para el emisor
1= Venta de mercadería
2= Prestación de servicios
```
3= Mixto (Venta de mercadería y
```
```
servicios)
```
4= Venta de activo fijo
5= Venta de divisas
6= Compra de divisas
7= Promoción o entrega de
muestras
8= Donación
9= Anticipo
10= Compra de productos
11= Compra de servicios
12= Venta de crédito fiscal
```
13=Muestras médicas (Art. 3 RG
```
```
24/2014)
```
D1 D012 dDesTipTra Descripción del tipode transacción D010 A 5-36 0-1
Obligatorio si existe el campo D011
1= “Venta de mercadería”
2= “Prestación de servicios”
```
3= “Mixto” (Venta de mercadería y
```
```
servicios)
```
4= “Venta de activo fijo”
5= “Venta de divisas”
6= “Compra de divisas”
7= “Promoción o entrega de
muestras”
8= “Donación”
9= “Anticipo”
10= “Compra de productos”
11= “Compra de servicios”
12= “Venta de crédito fiscal”
```
13= ”Muestras médicas (Art. 3 RG
```
```
24/2014)”
```
D1 D013 iTImp Tipo de impuestoafectado D010 N 1 1-1
1= IVA
2= ISC
3=Renta
4=Ninguno
5=IVA - Renta
septiembre de 2019 67
Grupo ID Campo Descripción NodoPadreTipoDato Longitud Ocurrencia Observaciones
D1 D014 dDesTImp Descripción del tipode impuesto afectado D010 A 3-11 1-1
1= “IVA”
2= “ISC”
3= “Renta”
4= “Ninguno”
5= “IVA – Renta”
D1 D015 cMoneOpe Moneda de laoperación D010 A 3 1-1
Según tabla de códigos para
monedas de acuerdo con la norma
ISO 4217
Se requiere la misma moneda para
todos los ítems del DE
D1 D016 dDesMoneOpe
Descripción de la
moneda de la
operación
D010 A 3-20 1-1 Referente al campo D015
D1 D017 dCondTiCam Condición del tipo decambio D010 N 1 0-1
Obligatorio si D015 ≠ PYG
No informar si D015 = PYG
```
1= Global (un solo tipo de cambio
```
```
para todo el DE)
```
```
2= Por ítem (tipo de cambio distinto
```
```
por ítem)
```
```
D1 D018 dTiCam Tipo de cambio de laoperación D010 N 1-5p(0-4) 0-1
```
Obligatorio si D017 = 1
No informar si D017 = 2
No informar si D015=PYG
D1 D019 iCondAnt Condición del Anticipo D010 N 1 0-1
```
1= Anticipo Global (un solo tipo de
```
```
anticipo para todo el DE)
```
```
2= Anticipo por ítem (corresponde a
```
la distribución de Anticipos
```
facturados por ítem)
```
D1 D020 dDesCondAnt Descripción de lacondición del Anticipo D010 A 15-17 0-1 1= “Anticipo Global”2= “Anticipo por Ítem”
```
D2. Campos que identifican al emisor del Documento Electrónico DE (D100-D129)
```
Grupo ID Campo Descripción NodoPadreTipoDato Longitud Ocurrencia Observaciones
D2 D100 gEmis Grupo de campos queidentifican al emisor D001 G 1-1
septiembre de 2019 68
Grupo ID Campo Descripción NodoPadreTipoDato Longitud Ocurrencia Observaciones
D2 D101 dRucEm RUC del contribuyenteemisor D100 A 3-8 1-1
Debe corresponder al RUC del
certificado digital utilizado para
firmar el DE
D2 D102 dDVEmi
Dígito verificador del
RUC del contribuyente
emisor
D100 N 1 1-1 Según algoritmo módulo 11
D2 D103 iTipCont Tipo de contribuyente D100 N 1 1-1 1= Persona Física2= Persona Jurídica
D2 D104 cTipReg Tipo de régimen D100 N 1-2 0-1 Según Tabla 1 – Tipo de Régimen
D2 D105 dNomEmi Nombre o razón socialdel emisor del DE D100 A 4-255 1-1
En caso de ambiente de prueba,
debe contener obligatoriamente el
literal "DE generado en ambiente
de prueba - sin valor comercial ni
fiscal"
D2 D106 dNomFanEmi Nombre de fantasía D100 A 4-255 0-1 Debe corresponder a lo declaradoen el RUC
D2 D107 dDirEmi Dirección del localdonde se emite el DE D100 A 1-255 1-1
Nombre de la calle principal. Debe
corresponder a lo declarado en el
RUC
D2 D108 dNumCas Número de casa D100 N 1-6 1-1
Si no tiene numeración, colocar 0
```
(cero)
```
Debe corresponder a lo declarado
en el RUC
D2 D109 dCompDir1 Complemento dedirección 1 D100 A 1-255 0-1 Nombre de la calle secundaria
D2 D110 dCompDir2 Complemento dedirección 2 D100 A 1-255 0-1 Número de departamento/ piso/local/ edificio/ depósito
D2 D111 cDepEmi
Código del
departamento de
emisión
D100 N 1-2 1-1
Según XSD de Departamentos
Debe corresponder a lo declarado
en el RUC
D2 D112 dDesDepEmi
Descripción del
departamento de
emisión
D100 A 6-16 1-1
Referente al campo D111
Debe corresponder a lo declarado
en el RUC
D2 D113 cDisEmi Código del distrito deemisión D100 N 1-4 0-1
Según Tabla 2.1 – Distritos
Debe corresponder a lo declarado
en el RUC
D2 D114 dDesDisEmi Descripción del distritode emisión D100 A 1-30 0-1
Obligatorio si existe el campo D113
Debe corresponder a lo declarado
en el RUC
septiembre de 2019 69
Grupo ID Campo Descripción NodoPadreTipoDato Longitud Ocurrencia Observaciones
D2 D115 cCiuEmi Código de la ciudadde emisión D100 N 1-5 1-1
Según Tabla 2.2 – Ciudades
Debe corresponder a lo declarado
en el RUC
D2 D116 dDesCiuEmi Descripción de laciudad de emisión D100 A 1-30 1-1
Referente al campo D115
Debe corresponder a lo declarado
en el RUC
D2 D117 dTelEmi Teléfono local deemisión de DE D100 A 6-15 1-1
Debe incluir el prefijo de la ciudad
Debe corresponder a lo declarado
en el RUC
D2 D118 dEmailE Correo electrónico delemisor D100 A 3-80 1-1 Debe corresponder a lo declaradoen el RUC
D2 D119 dDenSuc
Denominación
comercial de la
sucursal
D100 A 1-30 0-1 Denominación interna del emisor
```
D2.1 Campos que describen la actividad económica del emisor (D130-D139)
```
Grupo ID Campo Descripción NodoPadreTipoDato Longitud Ocurrencia Observaciones
D2.1 D130 gActEco
Grupo de campos que
describen la actividad
económica del emisor
D100 G - 1-9
D2.1 D131 cActEco Código de la actividadeconómica del emisor D130 A 1-8 1-1
Según Tabla 3 – Actividades
Económicas
Debe corresponder a lo declarado en
el RUC
D2.1 D132 dDesActEco
Descripción de la
actividad económica
del emisor
D130 A 1-300 1-1
Referente al campo D120
Según Tabla 3 – Actividades
Económicas
Debe corresponder a lo declarado en
el RUC
septiembre de 2019 70
```
D2.2 Campos que identifican al responsable de la generación del DE (D140-D160)
```
Grupo ID Campo Descripción NodoPadreTipoDato Longitud Ocurrencia Observaciones
D2.2 D140 gRespDE
Grupo de campos que
identifican al
responsable de la
generación del DE
D100 G - 0-1
D2.2 D141 iTipIDRespDE
Tipo de documento de
identidad del
responsable de la
generación del DE
D140 N 1 1-1
1= Cédula paraguaya
2= Pasaporte
3= Cédula extranjera
4= Carnet de residencia
9= Otro
D2.2 D142 dDTipIDRespDE
Descripción del tipo de
documento de
identidad del
responsable de la
generación del DE
D140 A 9-41 1-1
1= “Cédula paraguaya”
2= “Pasaporte”
3= “Cédula extranjera”
4= “Carnet de residencia”
Si D141 = 9 informar el tipo de
documento de identidad del
responsable de la generación del DE
D2.2 D143 dNumIDRespDE
Número de documento
de identidad del
responsable de la
generación del DE
D140 A 1-20 1-1
D2.2 D144 dNomRespDE
Nombre o razón social
del responsable de la
generación del DE
D140 A 4-255 1-1
D2.2 D145 dCarRespDE
Cargo del responsable
de la generación del
DE
D140 A 4-100 1-1
```
D3. Campos que identifican al receptor del Documento Electrónico DE (D200-D299)
```
Grupo ID Campo Descripción NodoPadreTipoDato Longitud Ocurrencia Observaciones
D3 D200 gDatRec Grupo de campos queidentifican al receptor D001 G 1-1
septiembre de 2019 71
Grupo ID Campo Descripción NodoPadreTipoDato Longitud Ocurrencia Observaciones
D3 D201 iNatRec Naturaleza del receptor D200 N 1 1-1 1= contribuyente2= no contribuyente
D3 D202 iTiOpe Tipo de operación D200 N 1 1-1
1= B2B
2= B2C
3= B2G
4= B2F
```
(Esta última opción debe utilizarse
```
solo en caso de servicios para
empresas o personas físicas del
```
exterior)
```
D3 D203 cPaisRec Código de país delreceptor D200 A 3 1-1 Según XSD de Codificación dePaíses
D3 D204 dDesPaisRe Descripción del paísreceptor D200 A 4-30 1-1 Referente al campo D203
D3 D205 iTiContRec Tipo de contribuyentereceptor D200 N 1 0-1
Obligatorio si D201 = 1
No informar si D201 = 2
1= Persona Física
2= Persona Jurídica
D3 D206 dRucRec RUC del receptor D200 A 3-8 0-1 Obligatorio si D201 = 1No informar si D201 = 2
D3 D207 dDVRec Dígito verificador delRUC del receptor D200 N 1 0-1 Obligatorio si existe el campo D206Según algoritmo módulo 11
D3 D208 iTipIDRec
Tipo de documento de
identidad del receptor D200 N 1 0-1
Obligatorio si D201 = 2 y D202 ≠ 4
No informar si D201 = 1 o D202=4
1= Cédula paraguaya
2= Pasaporte
3= Cédula extranjera
4= Carnet de residencia
5= Innominado
6=Tarjeta Diplomática de
exoneración fiscal
9= Otro
septiembre de 2019 72
Grupo ID Campo Descripción NodoPadreTipoDato Longitud Ocurrencia Observaciones
D3 D209 dDTipIDRec Descripción del tipo dedocumento de identidad D200 A 9-41 0-1
Obligatorio si existe el campo D208
1= “Cédula paraguaya”
2= “Pasaporte”
3= “Cédula extranjera”
4= “Carnet de residencia”
5 = “Innominado”
6= “Tarjeta Diplomática de
exoneración fiscal”
Si D208 = 9 informar el tipo de
documento de identidad del
receptor
D3 D210 dNumIDRec Número de documentode identidad D200 A 1-20 0-1
Obligatorio si D201 = 2 y D202 ≠ 4
No informar si D201 = 1 o D202=4
En caso de DE innominado,
```
completar con 0 (cero)
```
D3 D211 dNomRec Nombre o razón socialdel receptor del DE D200 A 4-255 1-1 En caso de DE innominado,completar con “Sin Nombre”
D3 D212 dNomFanRec Nombre de fantasía D200 A 4-255 0-1
D3 D213 dDirRec Dirección del receptor D200 A 1-255 0-1 Campo obligatorio cuando C002=7o cuando D202=4
D3 D218 dNumCasRec Número de casa delreceptor D200 N 1-6 0-1
Campo obligatorio si se informa el
campo D213
Cuando D201 = 1, debe
corresponder a lo declarado en el
RUC
D3 D219 cDepRec
Código del
departamento del
receptor
D200 N 1-2 0-1
Campo obligatorio si se informa el
campo D213 y D202≠4, no se debe
informar cuando D202 = 4.
Según XSD de Departamentos
D3 D220 dDesDepRec
Descripción del
departamento del
receptor
D200 A 6-16 0-1 Referente al campo D219
D3 D221 cDisRec Código del distrito delreceptor D200 N 1-4 0-1 Según Tabla 2.1 – Distritos
D3 D222 dDesDisRec Descripción del distritodel receptor D200 A 1-30 0-1 Obligatorio si existe el campo D221
septiembre de 2019 73
Grupo ID Campo Descripción NodoPadreTipoDato Longitud Ocurrencia Observaciones
D3 D223 cCiuRec Código de la ciudad delreceptor D200 N 1-5 0-1
Campo obligatorio si se informa el
campo D213 y D202≠4, no se debe
informar cuando D202 = 4.
Según Tabla 2.2 – Ciudades
D3 D224 dDesCiuRec Descripción de la ciudaddel receptor D200 A 1-30 0-1 Referente al campo D223
D3 D214 dTelRec Número de teléfono delreceptor D200 A 6-15 0-1 Debe incluir el prefijo de la ciudad siD203 = PRY
D3 D215 dCelRec Número de celular delreceptor D200 A 10-20 0-1
D3 D216 dEmailRec Correo electrónico delreceptor D200 A 3-80 0-1
D3 D217 dCodCliente Código del cliente D200 A 3-15 0-1
E. Campos específicos por tipo de Documento Electrónico (E001-E009)
Grupo ID Campo Descripción NodoPadreTipoDato Longitud Ocurrencia Observaciones
E E001 gDtipDE
Campos específicos
por tipo de
Documento
Electrónico
A001 G 1-1
```
E1. Campos que componen la Factura Electrónica FE (E002-E099)
```
Grupo ID Campo Descripción NodoPadreTipoDato Longitud Ocurrencia Observaciones
E1 E010 gCamFE Campos quecomponen la FE E001 G 0-1 Obligatorio si C002 = 1No informar si C002 ≠ 1
septiembre de 2019 74
Grupo ID Campo Descripción NodoPadreTipoDato Longitud Ocurrencia Observaciones
E1 E011 iIndPres Indicador de presencia E010 N 1 1-1
1= Operación presencial
2= Operación electrónica
3= Operación telemarketing
4= Venta a domicilio
5= Operación bancaria
6= Operación cíclica
9= Otro
E1 E012 dDesIndPres Descripción delindicador de presencia E010 A 10-30 1-1
Referente al campo E011
1= “Operación presencial”
2= “Operación electrónica”
3= “Operación telemarketing”
4= “Venta a domicilio”
5= “Operación bancaria”
6=” Operación cíclica”
Si E011 = 9 informar el indicador de
presencia
E1 E013 dFecEmNR Fecha futura deltraslado de mercadería E010 F 10 0-1
Fecha en el formato: AAAA-MM-DD
Fecha estimada para el traslado de
la mercadería y emisión de la nota
de remisión electrónica cuando
corresponda. RG 41/14
```
E1.1. Campos de informaciones de Compras Públicas (E020-E029)
```
Grupo ID Campo Descripción NodoPadreTipoDatoLongitud Ocurrencia Observaciones
E1.1 E020 gCompPub
Campos que describen
las informaciones de
compras públicas
```
E010 G 0-1 Obligatorio si D202 = 3 (Tipo deoperación B2G)
```
E1.1 E021 dModCont Modalidad - Códigoemitido por la DNCP E020 A 2 1-1
E1.1 E022 dEntCont Entidad - Código emitidopor la DNCP E020 N 5 1-1
E1.1 E023 dAnoCont Año - Código emitido porla DNCP E020 N 2 1-1
E1.1 E024 dSecCont Secuencia - emitido porla DNCP E020 N 7 1-1
septiembre de 2019 75
Grupo ID Campo Descripción NodoPadreTipoDatoLongitud Ocurrencia Observaciones
E1.1 E025 dFeCodCont
Fecha de emisión del
código de contratación
por la DNCP
E020 F 10 1-1
Fecha en el formato: AAAA-MM-DD.
Esta fecha debe ser anterior a la fecha
de emisión de la FE
```
E4. Campos que componen la Autofactura Electrónica AFE (E300-E399)
```
Grupo ID Campo Descripción NodoPadreTipoDatoLongitud Ocurrencia Observaciones
E4 E300 gCamAE Campos que componenla Autofactura Electrónica E001 G 0-1 Obligatorio si C002 = 4No informar si C002 ≠ 4
E4 E301 iNatVen Naturaleza del vendedor E300 N 1 1-1 1= No contribuyente2= Extranjero
E4 E302 dDesNatVen Descripción de lanaturaleza del vendedor E300 A 10-16 1-1
Referente al campo E301.
1= “No contribuyente”
2= “Extranjero”
E4 E304 iTipIDVen Tipo de documento deidentidad del vendedor E300 N 1 1-1
1= Cédula paraguaya
2= Pasaporte
3= Cédula extranjera
4= Carnet de residencia
E4 E305 dDTipIDVen
Descripción del tipo de
documento de identidad
del vendedor
E300 A 9-20 1-1
Referente al campo E304
1= “Cédula paraguaya”
2= “Pasaporte”
3= “Cédula extranjera”
4= “Carnet de residencia”
E4 E306 dNumIDVen
Número de documento
de identidad del
vendedor
E300 A 1-20 1-1
E4 E307 dNomVen Nombre y apellido delvendedor E300 A 4-60 1-1
E4 E308 dDirVen Dirección del vendedor E300 A 1-255 1-1
En caso de extranjeros, colocar la
dirección en donde se realizó la
transacción.
Nombre de la calle principal
```
E4 E309 dNumCasVen Número de casa delvendedor E300 N 1-6 1-1 Si no tiene numeración colocar 0 (cero)
```
septiembre de 2019 76
Grupo ID Campo Descripción NodoPadreTipoDatoLongitud Ocurrencia Observaciones
E4 E310 cDepVen Código del departamentodel vendedor E300 N 1-2 1-1
En caso de extranjeros, colocar el
departamento en donde se realizó la
transacción.
Según XSD de Departamentos
E4 E311 dDesDepVen
Descripción del
departamento del
vendedor
E300 A 6-16 1-1 Referente al campo E310
E4 E312 cDisVen Código del distrito delvendedor E300 N 1-4 0-1
En caso de extranjeros, colocar el
distrito en donde se realizó la
transacción.
Según Tabla 2.1 - Distritos
E4 E313 dDesDisVen Descripción del distritodel vendedor E300 A 1-30 0-1 Obligatorio si existe el campo E312
E4 E314 cCiuVen Código de la ciudad delvendedor E300 N 1-5 1-1
En caso de extranjeros, colocar la
ciudad en donde se realizó la
transacción.
Según Tabla 2.2 - Ciudades
E4 E315 dDesCiuVen Descripción de la ciudaddel vendedor E300 A 1-30 1-1 Referente al campo E314
```
E4 E316 dDirProv Lugar de la transacción E300 A 1-255 1-1 Nombre de la calle principal (Direccióndonde se provee el servicio o producto)
```
E4 E317 cDepProv
Código del departamento
donde se realiza la
transacción
E300 N 1-2 1-1 Según XSD de Departamentos
E4 E318 dDesDepProv
Descripción del
departamento donde se
realiza la transacción
E300 A 6-16 1-1 Referente al campo E317
E4 E319 cDisProv Código del distrito dondese realiza la transacción E300 N 1-4 0-1 Según Tabla 2.1 - Distritos
E4 E320 dDesDisProv
Descripción del distrito
donde se realiza la
transacción
E300 A 1-30 0-1 Obligatorio si existe el campo E319
E4 E321 cCiuProv
Código de la ciudad
donde se realiza la
transacción
E300 N 1-5 1-1 Según Tabla 2.2 - Ciudades
E4 E322 dDesCiuProv
Descripción de la ciudad
donde se realiza la
transacción
E300 A 1-30 1-1 Referente al campo E321
septiembre de 2019 77
```
E5. Campos que componen la Nota de Crédito/Débito Electrónica NCE-NDE (E400-E499)
```
Grupo ID Campo Descripción NodoPadreTipoDato Longitud Ocurrencia Observaciones
E5 E400 gCamNCDE
Campos de la Nota de
Crédito/Débito
Electrónica
E001 G 0-1
```
Obligatorio si C002 = 5 o 6 (NCE y
```
```
NDE)
```
No informar si C002 ≠ 5 o 6
E5 E401 iMotEmi Motivo de emisión E400 N 1-2 1-1
1= Devolución y Ajuste de precios
2= Devolución
3= Descuento
4= Bonificación
5= Crédito incobrable
6= Recupero de costo
7= Recupero de gasto
8= Ajuste de precio
E5 E402 dDesMotEmi Descripción del motivode emisión E400 A 6-30 1-1
Referente al campo E401
1= “Devolución y Ajuste de precios”
2= “Devolución”
3= “Descuento”
4= “Bonificación”
5= “Crédito incobrable”
6= “Recupero de costo”
7= “Recupero de gasto”
8= “Ajuste de precio”
```
E6. Campos que componen la Nota de Remisión Electrónica (E500-E599)
```
Grupo ID Campo Descripción NodoPadreTipoDato Longitud Ocurrencia Observaciones
E6 E500 gCamNRE
Campos que
componen la Nota de
Remisión Electrónica
E001 G 0-1 Obligatorio si C002 = 7No informar si C002 ≠ 7
septiembre de 2019 78
Grupo ID Campo Descripción NodoPadreTipoDato Longitud Ocurrencia Observaciones
E6 E501 iMotEmiNR Motivo de emisión E500 N 1-2 1-1
1= Traslado por venta
2= Traslado por consignación
3= Exportación
4= Traslado por compra
5= Importación
6= Traslado por devolución
7= Traslado entre locales de la
empresa
8= Traslado de bienes por
transformación
9= Traslado de bienes por
reparación
10= Traslado por emisor móvil
11= Exhibición o demostración
12= Participación en ferias
13= Traslado de encomienda
14= Decomiso
```
99=Otro (deberá consignarse
```
expresamente el o los motivos
diferentes a los mencionados
```
anteriormente)
```
Obs.: Cuando el motivo sea por
operaciones internas de la empresa,
el RUC del receptor debe ser igual al
RUC del emisor.
septiembre de 2019 79
Grupo ID Campo Descripción NodoPadreTipoDato Longitud Ocurrencia Observaciones
E6 E502 dDesMotEmiNR Descripción del motivode emisión E500 A 5-60 1-1
Referente al campo E501
1= “Traslado por ventas”
2= “Traslado por consignación”
3= “Exportación”
4= “Traslado por compra”
5= “Importación”
6= “Traslado por devolución”
7= “Traslado entre locales de la
empresa”
8= “Traslado de bienes por
transformación”
9= “Traslado de bienes por
reparación”
10= “Traslado por emisor móvil”
11= “Exhibición o Demostración”
12= “Participación en ferias”
13= “Traslado de encomienda”
14= “Decomiso”
Si E501=99 describir el motivo de la
emisión
E6 E503 iRespEmiNR
Responsable de la
emisión de la Nota
Remisión Electrónica
E500 N 1 1-1
1= Emisor de la factura
2= Poseedor de la factura y bienes
3= Empresa transportista
4=Despachante de Aduanas
5= Agente de transporte o
intermediario
E6 E504 dDesRespEmiNR
Descripción del
responsable de la
emisión de la Nota de
Remisión Electrónica
E500 A 20-36 1-1
1= “Emisor de la factura”
2= “Poseedor de la factura y
bienes”
3= “Empresa transportista”
4= “Despachante de Aduanas”
5= “Agente de transporte o
intermediario”
E6 E505 dKmR Kilómetros estimadosde recorrido E500 N 1-5 0-1
E6 E506 dFecEm Fecha futura deemisión de la factura E500 F 10 0-1
Fecha en el formato AAAA-MM-
DD
Obs.: Informar cuando no se ha
emitido aún la factura electrónica,
en caso que corresponda
septiembre de 2019 80
```
E7. Campos que describen la condición de la operación (E600-E699)
```
Grupo ID Campo Descripción NodoPadreTipoDato Longitud Ocurrencia Observaciones
E7 E600 gCamCond
Campos que describen
la condición de la
operación
E001 G 0-1 Obligatorio si C002 = 1 o 4No informar si C002 ≠ 1 o 4
E7 E601 iCondOpe Condición de laoperación E600 N 1 1-1 1= Contado2= Crédito
E7 E602 dDCondOpe Descripción de lacondición de operación E600 A 7 1-1
Referente al campo E601
1= “Contado”
2= “Crédito”
```
E7.1. Campos que describen la forma de pago de la operación al contado o del monto de la entrega inicial (E605-
```
```
E619)
```
Grupo ID Campo Descripción NodoPadreTipoDato Longitud Ocurrencia Observaciones
E7.1 E605 gPaConEIni
Campos que
describen la forma de
pago al contado o del
monto de la entrega
inicial
E600 G 0-999
Obligatorio si E601 = 1
Obligatorio si existe el campo
E645
septiembre de 2019 81
Grupo ID Campo Descripción NodoPadreTipoDato Longitud Ocurrencia Observaciones
E7.1 E606 iTiPago Tipo de pago E605 N 1-2 1-1
1= Efectivo
2= Cheque
3= Tarjeta de crédito
4= Tarjeta de débito
5= Transferencia
6= Giro
7= Billetera electrónica
8= Tarjeta empresarial
9= Vale
10= Retención
11= Pago por anticipo
12= Valor fiscal
13= Valor comercial
14= Compensación
15= Permuta
```
16= Pago bancario (Informar solo
```
```
si E011=5)
```
17 = Pago Móvil
18 = Donación
19 = Promoción
20 = Consumo Interno
21 = Pago Electrónico
99 = Otro
septiembre de 2019 82
Grupo ID Campo Descripción NodoPadreTipoDato Longitud Ocurrencia Observaciones
E7.1 E607 dDesTiPag Descripción del tipo depago E605 A 4-30 1-1
Referente al campo E606
1= “Efectivo”
2= “Cheque”
3= “Tarjeta de crédito”
4= “Tarjeta de débito”
5= “Transferencia”
6= “Giro”
7= “Billetera electrónica”
8= “Tarjeta empresarial”
9= “Vale”
10= “Retención”
11= “Pago por anticipo”
12= “Valor fiscal”
13= “Valor comercial”
14= “Compensación”
15= “Permuta”.
16= “Pago bancario”
7= “Pago Móvil”
18 = “Donación”
19 = “Promoción”
20 = “Consumo Interno”
21 = “Pago Electrónico”
Si E606 = 99, informar el tipo de
pago
```
E7.1 E608 dMonTiPag Monto por tipo de pago E605 N 1-15p(0-4) 1-1
```
E7.1 E609 cMoneTiPag Moneda por tipo depago E605 A 3 1-1
Según tabla de códigos para
monedas de acuerdo con la
norma ISO 4217
Se requiere la misma moneda para
todos los ítems del DE
E7.1 E610 dDMoneTiPag
Descripción de la
moneda por tipo de
pago
E605 A 3-20 1-1 Referente al campo E609
```
E7.1 E611 dTiCamTiPag Tipo de cambio por tipode pago E605 N 1-5p(0-4) 0-1 Obligatorio si E609 ≠ PYG
```
septiembre de 2019 83
E7.1.1. Campos que describen el pago o entrega inicial de la operación con tarjeta de crédito/débito
Grupo ID Campo Descripción NodoPadreTipoDato Longitud Ocurrencia Observaciones
E7.1.1 E620 gPagTarCD
Campos que describen
el pago o entrega inicial
de la operación con
tarjeta de crédito/débito
E605 G 0-1 Se activa si E606 = 3 o 4
E7.1.1 E621 iDenTarj Denominación de latarjeta E620 N 1-2 1-1
1= Visa
2= Mastercard
3= American Express
4= Maestro
5= Panal
6= Cabal
99= Otro
E7.1.1 E622 dDesDenTarj
Descripción de
denominación de la
tarjeta
E620 A 4-20 1-1
Referente al campo E621
1= “Visa”
2= “Mastercard”
3= “American Express”
4= “Maestro”
5= “Panal”
6= “Cabal”
Si E621 = 99 informar la
descripción de la denominación
de la tarjeta
E7.1.1 E623 dRSProTar Razón social de laprocesadora de tarjeta E620 A 4-60 0-1
E7.1.1 E624 dRUCProTar RUC de la procesadorade tarjeta E620 A 3-8 0-1
E7.1.1 E625 dDVProTar
Dígito verificador del
RUC de la procesadora
de tarjeta
E620 N 1 0-1 Según algoritmo módulo 11
E7.1.1 E626 iForProPa Forma deprocesamiento de pago E620 N 1 1-1
1= POS
```
2= Pago Electrónico (Ejemplo:
```
```
compras por Internet)
```
9= Otro
E7.1.1 E627 dCodAuOpe Código de autorizaciónde la operación E620 N 6-10 0-1
E7.1.1 E628 dNomTit Nombre del titular de latarjeta E620 A 4-30 0-1
septiembre de 2019 84
Grupo ID Campo Descripción NodoPadreTipoDato Longitud Ocurrencia Observaciones
E7.1.1 E629 dNumTarj Número de la tarjeta E620 N 4 0-1 Cuatro últimos dígitos de la tarjeta
```
E7.1.2. Campos que describen el pago o entrega inicial de la operación con cheque (E630-E639)
```
Grupo ID Campo Descripción NodoPadreTipoDato Longitud Ocurrencia Observaciones
E7.1.2 E630 gPagCheq
Campos que describen
el pago o entrega inicial
de la operación con
cheque
E605 G 0-1 Se activa si E606 = 2
E7.1.2 E631 dNumCheq Número de cheque E630 A 8 1-1
```
Completar con 0 (cero) a la
```
```
izquierda hasta alcanzar 8 (ocho)
```
cifras
E7.1.2 E632 dBcoEmi Banco emisor E630 A 4-20 1-1
```
E7.2. Campos que describen la operación a crédito (E640-E649)
```
Grupo ID Campo Descripción NodoPadreTipoDato Longitud Ocurrencia Observaciones
E7.2 E640 gPagCred Campos que describenla operación a crédito E600 G 0-1 Obligatorio si E601 = 2No informar si E601 ≠ 2
E7.2 E641 iCondCred Condición de laoperación a crédito E640 N 1 1-1 1= Plazo2= Cuota
E7.2 E642 dDCondCred
Descripción de la
condición de la
operación a crédito
E640 A 5-6 1-1 1= “Plazo”2= “Cuota”
E7.2 E643 dPlazoCre Plazo del crédito E640 A 2-15 0-1 Obligatorio si E641 = 1Ejemplo: 30 días, 12 meses
E7.2 E644 dCuotas Cantidad de cuotas E640 N 1-3 0-1 Obligatorio si E641 = 2Ejemplo: 12, 24, 36
```
E7.2 E645 dMonEnt Monto de la entregainicial E640 N 1-15p(0-4) 0-1
```
septiembre de 2019 85
```
E7.2.1. Campos que describen las cuotas (E650-E659)
```
Grupo ID Campo Descripción NodoPadreTipoDato Longitud Ocurrencia Observaciones
E7.2.1 E650 gCuotas Campos que describenlas cuotas E640 G 0-999 Se activa si E641 = 2
E7.2.1 E653 cMoneCuo Moneda de las cuotas E650 A 3 1-1
Según tabla de códigos para
monedas de acuerdo con la
norma ISO 4217
Se requiere la misma moneda
para todos los ítems del DE
E7.2.1 E654 dDMoneCuo Descripción de lamoneda de las cuotas E650 A 3-20 1-1 Referente al campo E653
```
E7.2.1 E651 dMonCuota Monto de cada cuota E650 N 1-15p(0-4) 1-1
```
E7.2.1 E652 dVencCuo Fecha de vencimientode cada cuota E650 F 10 0-1 Fecha en el formato: AAAA-MM-DD
```
E8. Campos que describen los ítems de la operación (E700-E899)
```
Grupo ID Campo Descripción NodoPadreTipoDato Longitud Ocurrencia Observaciones
E8 E700 gCamItem
Campos que describen
los ítems de la
operación
E001 G 1-999
E8 E701 dCodInt Código interno E700 A 1-20 1-1
Código interno de identificación de
la mercadería o servicio de
responsabilidad del emisor. No se
pueden tener ítems distintos de
mercadería o servicio con el mismo
código interno en su catastro de
productos o servicios. Este código
se puede repetir en el DE siempre
que el producto o servicio sea el
mismo.
E8 E702 dParAranc Partida arancelaria E700 N 4 0-1
```
E8 E703 dNCM Nomenclatura comúndel Mercosur (NCM) E700 N 6-8 0-1
```
septiembre de 2019 86
Grupo ID Campo Descripción NodoPadreTipoDato Longitud Ocurrencia Observaciones
E8 E704 dDncpG Código DNCP – NivelGeneral E700 A 8 0-1
Obligatorio si D202 = 3
Informar se existe el código de la
DNCP
```
Colocar 0 (cero) a la izquierda
```
para completar los espacios
vacíos
```
E8 E705 dDncpE Código DNCP – NivelEspecifico E700 A 3-4 0-1 Obligatorio si existe el campoE704)
```
E8 E706 dGtin Código GTIN porproducto E700 N 8,12,13,14 0-1 Informar si la mercadería tieneGTIN
E8 E707 dGtinPq Código GTIN porpaquete E700 N 8,12,13,14 0-1 Informar si el paquete tiene GTIN
E8 E708 dDesProSer Descripción del productoy/o servicio E700 A 1-120 1-1
Equivalente a nombre del
producto establecido en la RG
24/2019
E8 E709 cUniMed Unidad de medida E700 N 1-5 1-1
Según Tabla 5 – Unidad de
Medida
Si D202 = 3 utilizar los datos del
WS del link de la DNCP
Utilizar el atributo “ID”
E8 E710 dDesUniMed Descripción de la unidadde medida E700 A 1-10 1-1
Referente al campo E709
Utilizar el atributo “Código”
```
Ejemplo: UNI
```
```
E8 E711 dCantProSer Cantidad del productoy/o servicio E700 N 1-10p(0-4) 1-1
```
E8 E712 cPaisOrig Código del país deorigen del producto E700 A 3 0-1 Según XSD de Codificación dePaíses
E8 E713 dDesPaisOrig Descripción del país deorigen del producto E700 A 4-30 0-1 Obligatorio si existe el campoE712
E8 E714 dInfItem
Información de interés
del emisor con respecto
al ítem
E700 A 1-500 0-1
E8 E715 cRelMerc
Código de datos de
relevancia de las
mercaderías
E700 N 1 0-1
Opcional si C002 = 7
1=Tolerancia de quiebra
2= Tolerancia de merma
Según RG 41/14
E8 E716 dDesRelMerc
Descripción del código
de datos de relevancia
de las mercaderías
E700 A 19-21 0-1 1=“Tolerancia de quiebra”2=“Tolerancia de merma”
septiembre de 2019 87
Grupo ID Campo Descripción NodoPadreTipoDato Longitud Ocurrencia Observaciones
```
E8 E717 dCanQuiMer Cantidad de quiebra omerma E700 N 1-10(0-4) 0-1
```
Obligatorio si se informa E715
Lo informado en este campo se
encuentra en la unidad de medida
elegida en E709
Según RG 41/14
```
E8 E718 dPorQuiMer Porcentaje de quiebra omerma E700 N 1-3(0-8) 0-1 Obligatorio si se informa E715Según RG 41/14
```
E8 E719 dCDCAnticipo CDC del anticipo E700 A 44 0-1
Obligatorio cuando se utilice una
factura asociada con el tipo de
transacción igual a Anticipo
```
(D011 de la factura asociada
```
```
igual a 9)
```
```
E8.1. Campos que describen el precio, tipo de cambio y valor total de la operación por ítem (E720-E729)
```
Grupo ID Campo Descripción NodoPadreTipoDato Longitud Ocurrencia Observaciones
E8.1 E720 gValorItem
Campos que describen
los precios, descuentos
y valor total por ítem
E700 G 0-1 Obligatorio si C002 ≠ 7No informar si C002 = 7
E8.1 E721 dPUniProSer
Precio unitario del
producto y/o servicio
```
(incluidos impuestos)
```
```
E720 N 1-15p(0-8) 1-1
```
```
E8.1 E725 dTiCamIt Tipo de cambio por ítem E720 N 1-5p(0-4) 0-1
```
Obligatorio si D015 ≠ PYG
Obligatorio si D017 = 2
No informar si D017 = 1
```
E8.1 E727 dTotBruOpeItem Total bruto de laoperación por ítem E720 N 1-15p(0-8) 1-1
```
Corresponde a la multiplicación
```
del precio por ítem (E721) y la
```
```
cantidad por ítem (E711)
```
```
E8.1.1 Campos que describen los descuentos, anticipos y valor total por ítem (EA001-EA050)
```
Grupo ID Campo Descripción NodoPadreTipoDato Longitud Ocurrencia Observaciones
E8.1.1 EA001 gValorRestaItem
Campos que describen
los descuentos,
anticipos valor total por
ítem
E720 G 1-1
septiembre de 2019 88
Grupo ID Campo Descripción NodoPadreTipoDato Longitud Ocurrencia Observaciones
E8.1.1 EA002 dDescItem
Descuento particular
sobre el precio unitario
```
por ítem (incluidos
```
```
impuestos)
```
```
EA001 N 1-15p(0-8) 0-1 Si no hay descuento por ítemcompletar con 0 (cero)
```
E8.1.1 EA003 dPorcDesIt
Porcentaje de
descuento particular
por ítem
```
EA001 N 1-3p(0-8) 0-1
```
Debe existir si EA002 es mayor a
```
0 (cero)
```
[EA002 * 100 / E721]
E8.1.1 EA004 dDescGloItem
Descuento global sobre
el precio unitario por
```
ítem (incluidos
```
```
impuestos)
```
```
EA001 N 1-15p(0-8) 0-1
```
Si se cuenta con un descuento
```
global, debe ser aplicado (no es
```
```
prorrateo) a cada uno de los
```
ítems, independientemente que un
ítem cuente con un descuento
particular.
E8.1.1 EA006 dAntPreUniIt
Anticipo particular
sobre el precio unitario
```
por ítem (incluidos
```
```
impuestos)
```
```
EA001 N 1-15p(0-8) 0-1
```
Se debe informar en la misma
denominación monetaria en la que
se informó en la FE de anticipo
```
asociada (D015 de la FE
```
```
asociada)
```
Si no hay anticipo por ítem
```
completar con 0 (cero)
```
E8.1.1 EA007 dAntGloPreUniIt
Anticipo global sobre el
precio unitario por ítem
```
(incluidos impuestos) EA001
```
```
N 1-15p(0-8) 0-1
```
Si se cuenta con un anticipo
global, debe ser aplicado a cada
uno de los ítems,
independientemente de que un
ítem cuente con un anticipo
particular.
Si no hay anticipo global por ítem,
```
completar con 0 (cero)
```
septiembre de 2019 89
Grupo ID Campo Descripción NodoPadreTipoDato Longitud Ocurrencia Observaciones
```
E8.1.1 EA008 dTotOpeItem Valor total de laoperación por ítem EA001 N 1-15p(0-8) 1-1
```
Cálculo para IVA, Renta,
ninguno, IVA - Renta
```
Si D013 = 1, 3, 4 o 5 (afectado al
```
```
IVA, Renta, ninguno, IVA - Renta),
```
entonces EA008 corresponde al
```
cálculo aritmético: (E721 (Precio
```
```
unitario) – EA002 (Descuento
```
```
particular) – EA004 (Descuento
```
```
global) – EA006 (Anticipo
```
```
particular) – EA007 (Anticipo
```
```
global)) * E711(cantidad)
```
Cálculo para Autofactura
```
(C002=4):
```
E721*E711
E8.1.1 EA009 dTotOpeGs
Valor total de la
operación por ítem en
guaraníes
```
EA001 N 1-15p(0-8) 0-1
```
Obligatorio si existe el campo
E725
Corresponde al cálculo aritmético
EA008* E725
```
E8.2. Campos que describen el IVA de la operación por ítem (E730-E739)
```
Grupo ID Campo Descripción NodoPadreTipoDato Longitud Ocurrencia Observaciones
E8.2 E730 gCamIVA Campos que describenel IVA de la operación E700 G 0-1
Obligatorio si D013=1, 3, 4 o 5 y
C002 ≠ 4 o 7
No informar si D013=2 y C002= 4
o 7
E8.2 E731 iAfecIVA Forma de afectacióntributaria del IVA E730 N 1 1-1
1= Gravado IVA
```
2= Exonerado (Art. 83- Ley
```
```
125/91)
```
3= Exento
```
4= Gravado parcial (Grav-Exento)
```
septiembre de 2019 90
Grupo ID Campo Descripción NodoPadreTipoDato Longitud Ocurrencia Observaciones
E8.2 E732 dDesAfecIVA
Descripción de la forma
de afectación tributaria
del IVA
E730 A 6-15 1-1
Referente al campo E731
1= “Gravado IVA”
```
2= “Exonerado (Art. 83- Ley
```
```
125/91)”
```
3= “Exento”
```
4= “Gravado parcial (Grav-
```
```
Exento)”
```
```
E8.2 E733 dPropIVA Proporción gravada deIVA E730 N 1-3p(0-8) 1-1
```
```
Corresponde al porcentaje (%)
```
gravado
```
Ejemplo:100, 50, 30, 0
```
E8.2 E734 dTasaIVA Tasa del IVA E730 N 1-2 1-1
```
Corresponde al porcentaje (%) de
```
la tasa expresado en números
enteros
```
0 (para E731 = 2 o 3)
```
```
5 (para E731 = 1 o 4)
```
```
10 (para E731 = 1 o 4)
```
```
E8.2 E735 dBasGravIVA Base gravada del IVApor ítem E730 N 1-15p(0-8) 1-1
```
Si E731 = 1 o 4 este campo es
igual al resultado del cálculo
```
[EA008* (E733/100)] / 1,1 si la
```
tasa es del 10%
```
[EA008* (E733/100)] / 1,05 si la
```
tasa es del 5%
Si E731 = 2 o 3 este campo es
igual 0
```
E8.2 E736 dLiqIVAItem Liquidación del IVA porítem E730 N 1-15p(0-8) 1-1
```
Corresponde al cálculo aritmético:
```
E735 * (E734/100)
```
Si E731 = 2 o 3 este campo es
igual 0
```
E8.4. Grupo de rastreo de la mercadería (E750-E760)
```
Grupo ID Campo Descripción NodoPadreTipoDato Longitud Ocurrencia Observaciones
E8.4 E750 gRasMerc Grupo de rastreo de lamercadería E700 G 0-1
E8.4 E751 dNumLote Número de lote E750 A 1-80 0-1 Obligados por la RG N° 24/2019– Agroquímicos
septiembre de 2019 91
Grupo ID Campo Descripción NodoPadreTipoDato Longitud Ocurrencia Observaciones
E8.4 E752 dVencMerc Fecha de vencimientode la mercadería E750 F 10 0-1 Formato AAAA-MM-DD
E8.4 E753 dNSerie Número de serie E750 A 1-10 0-1
E8.4 E754 dNumPedi Número de pedido E750 A 1-20 0-1
E8.4 E755 dNumSegui Número deseguimiento del envío E750 A 1-20 0-1
E8.4 E756 dNomImp Nombre del Importador E750 A 4-60 0-1 Obligados por la RG N° 16/2019– Agroquímicos
E8.4 E757 dDirImp Dirección deImportador E750 A 1-255 0-1 Obligados por la RG N° 16/2019– Agroquímicos
E8.4 E758 dNumFir Número de registro dela firma del importador E750 A 20 0-1 Obligados por la RG N° 16/2019– Agroquímicos
E8.4 E759 dNumReg
Número de registro del
producto otorgado por
el SENAVE
E750 A 20 0-1
Obligados por la RG N° 16/2019
y la RG N° 24/2019 –
Agroquímicos
E8.4 E760 dNumRegEntCom
Número de registro de
entidad comercial
otorgado por el
SENAVE
E750 A 20 0-1 Obligados por la RG N° 24/2019– Agroquímicos
```
E8.5. Sector de automotores nuevos y usados (E770-E789)
```
Grupo ID Campo Descripción NodoPadreTipoDato Longitud Ocurrencia Observaciones
E8.5 E770 gVehNuevo Grupo de detalle devehículos nuevos E700 G 0-1
E8.5 E771 iTipOpVN Tipo de operación deventa de vehículos E770 N 1 0-1
1= Venta a representante
2= Venta al consumidor final
3= Venta a gobierno
4= Venta a flota de vehículos
septiembre de 2019 92
Grupo ID Campo Descripción NodoPadreTipoDato Longitud Ocurrencia Observaciones
E8.5 E772 dDesTipOpVN
Descripción del tipo de
operación de venta de
vehículos
E770 A 16-30 0-1
Obligatorio si existe el campo
E762
1= “Venta a representante”
2= “Venta al consumidor final”
3= “Venta a gobierno”
4= “Venta a flota de vehículos”
E8.5 E773 dChasis Chasis del vehículo E770 A 17 0-1
E8.5 E774 dColor Color del vehículo E770 A 1-10 0-1
```
E8.5 E775 dPotencia Potencia del motor(CV) E770 N 1-4 0-1
```
```
E8.5 E776 dCapMot Capacidad del motor E770 N 1-4 0-1 Expresa en centímetros cúbicos(cc)
```
```
E8.5 E777 dPNet Peso Neto E770 N 1-6p(0-4) 0-1 Toneladas
```
```
E8.5 E778 dPBruto Peso Bruto E770 N 1-6p(0-4) 0-1 Toneladas
```
E8.5 E779 iTipCom Tipo de combustible E770 N 1 0-1
1= Gasolina
2= Diésel
3= Etanol
4= GNV
5= Flex
9= Otro
E8.5 E780 dDesTipCom Descripción del tipo decombustible E770 A 3-20 0-1
Obligatorio si existe el campo
E770
1= “Gasolina”
2= “Diésel”
3= “Etanol”
4= “GNV”
5= “Flex”
Si E769= 9 describir el tipo de
combustible
E8.5 E781 dNroMotor Número del motor E770 A 1-21 0-1
```
E8.5 E782 dCapTracc Capacidad máxima detracción E770 N 1-6p(0-4) 0-1 Toneladas
```
E8.5 E783 dAnoFab Año de fabricación E770 N 4 0-1
E8.5 E784 cTipVeh Tipo de vehículo E770 A 4-10 0-1
septiembre de 2019 93
Grupo ID Campo Descripción NodoPadreTipoDato Longitud Ocurrencia Observaciones
E8.5 E785 dCapac Capacidad máxima depasajeros E770 N 1-3 0-1 Capacidad máxima de pasajerossentados
E8.5 E786 dCilin Cilindradas del motor E770 A 4 0-1
```
E9. Campos complementarios comerciales de uso específico (E790-E899)
```
Grupo ID Campo Descripción NodoPadreTipoDato Longitud Ocurrencia Observaciones
E9 E790 gCamEsp
Campos
complementarios
comerciales de uso
específico
E001 G 0-1
```
E9.2. Sector Energía Eléctrica (E791-E799)
```
Grupo ID Campo Descripción NodoPadreTipoDato Longitud Ocurrencia Observaciones
E9.2 E791 gGrupEner Grupo del sector deenergía eléctrica E790 G 0-1
E9.2 E792 dNroMed Número de medidor E791 A 1-50 0-1
E9.2 E793 dActiv Código de actividad E791 N 2 0-1
E9.2 E794 dCateg Código de categoría E791 A 3 0-1
E9.2 E795 dLecAnt Lectura anterior E791 N 1-11p2 0-1
E9.2 E796 dLecAct Lectura actual E791 N 1-11p2 0-1
E9.2 E797 dConKwh Consumo E791 N 1-11p2 0-1 Corresponde a la diferencia entreE785-E784
septiembre de 2019 94
```
E9.3. Sector de Seguros (E800-E809)
```
Grupo ID Campo Descripción NodoPadreTipoDato Longitud Ocurrencia Observaciones
E9.3 E800 gGrupSeg Grupo del sector deseguros E790 G 0-1
E9.3 E801 dCodEmpSeg
Código de la empresa de
seguros en la
Superintendencia de
Seguros
E800 A 20 0-1
```
E9.3.1. Póliza de seguros (EA790-EA799)
```
Grupo ID Campo Descripción NodoPadreTipoDato Longitud Ocurrencia Observaciones
E9.3.1 EA790 gGrupPolSeg Grupo de póliza deseguros E800 G 1-999
E9.3.1 EA791 dPoliza Código de la póliza EA790 A 1-20 1-1
E9.3.1 EA792 dUnidVig
Descripción de la
unidad de tiempo de
vigencia
EA790 A 3-15 1-1 Ejemplo: hora, día, mes, año
E9.3.1 EA793 dVigencia Vigencia de la póliza EA790 N 1-5p1 1-1
E9.3.1 EA794 dNumPoliza Número de la póliza EA790 A 1-25 1-1
E9.3.1 EA795 dFecIniVig Fecha de inicio devigencia EA790 F 19 0-1 Según el formatoAAAA-MM-DDThh:mm:ss
E9.3.1 EA796 dFecFinVig Fecha de fin devigencia EA790 F 19 0-1 Según el formatoAAAA-MM-DDThh:mm:ss
E9.3.1 EA797 dCodInt Código interno del ítem EA790 A 1-20 0-1 Como referencia al campo E701,si desea asociar la póliza al ítem
septiembre de 2019 95
```
E9.4. Sector de Supermercados (E810-E819)
```
Grupo ID Campo Descripción NodoPadreTipoDato Longitud Ocurrencia Observaciones
E9.4 E810 gGrupSup Grupo del sectorsupermercados E790 G 0-1
E9.4 E811 dNomCaj Nombre del cajero E810 A 1-20 0-1
```
E9.4 E812 dEfectivo Efectivo E810 N 1-15p(0-4) 0-1
```
```
E9.4 E813 dVuelto Vuelto E810 N 1-6p(0-4) 0-1
```
```
E9.4 E814 dDonac Monto de la donación E810 N 1-6p(0-4) 0-1
```
E9.4 E815 dDesDonac Descripción de ladonación E810 A 1-20 0-1
```
E9.5. Grupo de datos adicionales de uso comercial (E820-E829)
```
Grupo ID Campo Descripción NodoPadreTipoDato Longitud Ocurrencia Observaciones
E9.5 E820 gGrupAdi
Grupo de datos
adicionales de uso
comercial
E790 G 0-1
E9.5 E821 dCiclo Ciclo E820 A 1-15 0-1
E9.5 E822 dFecIniC Fecha de inicio de ciclo E820 F 10 0-1
Obligatorio si se informa el campo
E811
No completar si no se informa el
campo E811
Formato AAAA-MM-DD
E9.5 E823 dFecFinC Fecha de fin de ciclo E820 F 10 0-1
Obligatorio si se informa el campo
E812
No completar si no se informa el
campo E812
Formato AAAA-MM-DD
E9.5 E824 dVencPag Fecha de vencimientopara el pago E820 F 10 0-3 Formato AAAA-MM-DD
septiembre de 2019 96
Grupo ID Campo Descripción NodoPadreTipoDato Longitud Ocurrencia Observaciones
E9.5 E825 dContrato Número de contrato E820 A 1-30 0-1
```
E9.5 E826 dSalAnt Saldo anterior E820 N 1-15p(0-4) 0-1 Monto del saldo anterior
```
```
E10. Campos que describen el transporte de las mercaderías (E900-E999)
```
Grupo ID Campo Descripción NodoPadreTipoDato Longitud Ocurrencia Observaciones
E10 E900 gTransp
Campos que describen
el transporte de
mercaderías
E001 G 0-1
Obligatorio si C002 = 7
Opcional si C002 = 1
No informar si C002= 4, 5, 6
E10 E901 iTipTrans Tipo de transporte E900 N 1 0-1
Obligatorio si C002 = 7
1= Propio
2= Tercero
E10 E902 dDesTipTrans Descripción del tipo detransporte E900 A 6-7 0-1 Obligatorio si existe el campoE901
E10 E903 iModTrans Modalidad deltransporte E900 N 1 1-1
1=Terrestre
2= Fluvial
3= Aéreo
4= Multimodal
E10 E904 dDesModTrans
Descripción de la
modalidad del
transporte
E900 A 5-10 1-1
Referente al campo E903
1= “Terrestre”
2= “Fluvial”
3= “Aéreo”
4= “Multimodal”
E10 E905 iRespFlete Responsable del costodel flete E900 N 1 1-1
1= Emisor de la Factura
Electrónica
2= Receptor de la Factura
Electrónica
3= Tercero
4= Agente intermediario del
```
transporte (cuando intervenga)
```
5= Transporte propio
E10 E906 cCondNeg Condición de lanegociación E900 A 3 0-1 Según Tabla 10 - Incoterms
septiembre de 2019 97
Grupo ID Campo Descripción NodoPadreTipoDato Longitud Ocurrencia Observaciones
E10 E907 dNuManif
Número de manifiesto o
conocimiento de carga/
declaración de tránsito
aduanero/ Carta de
porte internacional
E900 A 1-15 0-1
Campo abierto para informar la
numeración de cualquiera de las
opciones descriptas
E10 E908 dNuDespImp Número de despachode importación E900 A 16 0-1 Obligatorio si E501 = 5
E10 E909 dIniTras Fecha estimada deinicio de traslado E900 F 10 0-1
Obligatorio si C002 = 7
Opcional si C002 = 1
Fecha en el formato: AAAA-MM-
DD
E10 E910 dFinTras Fecha estimada de finde traslado E900 F 10 0-1
Obligatorio si existe el campo
E909
Fecha en el formato: AAAA-MM-
DD
E10 E911 cPaisDest Código del país dedestino E900 A 3 0-1 Según XSD de Codificación dePaíses
E10 E912 dDesPaisDest Descripción del país dedestino E900 A 4-30 0-1 Obligatorio si existe el campoE911
```
E10.1. Campos que identifican el local de salida de las mercaderías (E920-E939)
```
Grupo ID Campo Descripción NodoPadreTipoDato Longitud Ocurrencia Observaciones
E10.1 E920 gCamSal
Campos que identifican
el local de salida de las
mercaderías
E900 G 0-1
Obligatorio si C002 = 7
Opcional si C002 = 1
No informar si C002 = 4, 5, 6
E10.1 E921 dDirLocSal Dirección del local desalida E920 A 1-255 1-1 Nombre de la calle principal
```
E10.1 E922 dNumCasSal Número de casa desalida E920 N 1-6 1-1 Si no tiene numeración, colocar 0(cero)
```
E10.1 E923 dComp1Sal Complemento dedirección 1 salida E920 A 1-255 0-1 Nombre de la calle secundaria
septiembre de 2019 98
Grupo ID Campo Descripción NodoPadreTipoDato Longitud Ocurrencia Observaciones
E10.1 E924 dComp2Sal Complemento dedirección 2 salida E920 A 1-255 0-1
Número de departamento/ piso/
local/ edificio/ deposito del local
de salida de la mercadería
E10.1 E925 cDepSal
Código del
departamento del local
de salida
E920 N 1-2 1-1 Según XSD de Departamentos
E10.1 E926 dDesDepSal
Descripción del
departamento del local
de salida
E920 A 6-16 1-1 Referente al campo E925
E10.1 E927 cDisSal Código del distrito dellocal de salida E920 N 1-4 0-1 Según Tabla 2.1 - Distritos
E10.1 E928 dDesDisSal Descripción de distritodel local de salida E920 A 1-30 0-1 Obligatorio si existe el campoE927
E10.1 E929 cCiuSal Código de la ciudad dellocal de salida E920 N 1-5 1-1 Según Tabla 2.2 – Ciudades
E10.1 E930 dDesCiuSal Descripción de ciudaddel local de salida E920 A 1-30 1-1 Referente al campo E929
E10.1 E931 dTelSal Teléfono de contactodel local de salida E920 A 6-15 0-1
```
E10.2. Campos que identifican el local de entrega de las mercaderías (E940-E959)
```
Grupo ID Campo Descripción NodoPadreTipoDato Longitud Ocurrencia Observaciones
E10.2 E940 gCamEnt
Campos que identifican
el local de la entrega de
las mercaderías
E900 G 0-99 Obligatorio si C002 = 7No informar si C002 = 4, 5, 6
E10.2 E941 dDirLocEnt Dirección del local de laentrega E940 A 1-255 1-1 Nombre de la calle principal
```
E10.2 E942 dNumCasEnt Número de casa de laentrega E940 N 1-6 1-1 Si no tiene numeración, colocar 0(cero)
```
septiembre de 2019 99
Grupo ID Campo Descripción NodoPadreTipoDato Longitud Ocurrencia Observaciones
E10.2 E943 dComp1Ent Complemento dedirección 1 entrega E940 A 1-255 0-1 Nombre de la calle secundaria
E10.2 E944 dComp2Ent Complemento dedirección 2 entrega E940 A 1-255 0-1
Número de departamento/ piso/
local/ edificio/ deposito del local
de entrega de la mercadería
E10.2 E945 cDepEnt
Código del
departamento del local
de la entrega
E940 N 1-2 1-1 Según XSD de Departamentos
E10.2 E946 dDesDepEnt
Descripción del
departamento del local
de la entrega
E940 A 6-16 1-1 Referente al campo E945
E10.2 E947 cDisEnt Código del distrito dellocal de la entrega E940 N 1-4 0-1 Según Tabla 2.1 - Distritos
E10.2 E948 dDesDisEnt Descripción de distritodel local de la entrega E940 A 1-30 0-1 Obligatorio si existe el campoE947
E10.2 E949 cCiuEnt Código de la ciudad dellocal de la entrega E940 N 1-5 1-1 Según Tabla 2.2 – Ciudades
E10.2 E950 dDesCiuEnt Descripción de ciudaddel local de la entrega E940 A 1-30 1-1 Referente al campo E949
E10.2 E951 dTelEnt Teléfono de contactodel local de la entrega E940 A 6-15 0-1
```
E10.3. Campos que identifican el vehículo de traslado de mercaderías (E960-E979)
```
Grupo ID Campo Descripción NodoPadreTipoDato Longitud Ocurrencia Observaciones
E10.3 E960 gVehTras
Campos que identifican
al vehículo del traslado
de mercaderías
E900 G 0-4 Obligatorio si C002 = 7No informar si C002 = 4, 5, 6
septiembre de 2019 100
Grupo ID Campo Descripción NodoPadreTipoDato Longitud Ocurrencia Observaciones
E10.3 E961 dTiVehTras Tipo de vehículo E960 A 4-10 1-1 Debe ser acorde al campo E903
E10.3 E962 dMarVeh Marca E960 A 1-10 1-1
E10.3 E967 dTipIdenVeh Tipo de identificacióndel vehículo E960 N 1 1-1
1=Número de identificación del
vehículo
2=Número de matrícula del
vehículo
E10.3 E963 dNroIDVeh
Número de
identificación del
vehículo
E960 A 1-20 0-1 Debe informarse cuando elE967=1
E10.3 E964 dAdicVeh Datos adicionales delvehículo E960 A 1-20 0-1
E10.3 E965 dNroMatVeh Número de matrículadel vehículo E960 A 6 0-1 Debe informarse cuando elE967=2
E10.3 E966 dNroVuelo Número de vuelo E960 A 6 0-1 Obligatorio si E903 = 3No informar si E903 ≠ 3
```
E10.4. Campos que identifican al transportista (persona física o jurídica) (E980-E999)
```
Grupo ID Campo Descripción NodoPadreTipoDato Longitud Ocurrencia Observaciones
E10.4 E980 gCamTrans Campos que identificanal transportista E900 G 0-1
Obligatorio si C002 = 7
No informar si C002 = 4, 5, 6
Opcional cuando E903=1 y
```
E967=1
```
E10.4 E981 iNatTrans Naturaleza deltransportista E980 N 1 1-1 1= Contribuyente2= No contribuyente
E10.4 E982 dNomTrans Nombre o razón socialdel transportista E980 A 4-60 1-1
E10.4 E983 dRucTrans RUC del transportista E980 A 3-8 0-1 Obligatorio si E981 = 1No informar si E981 ≠ 1
septiembre de 2019 101
Grupo ID Campo Descripción NodoPadreTipoDato Longitud Ocurrencia Observaciones
E10.4 E984 dDVTrans Dígito verificador delRUC del transportista E980 N 1 0-1
Obligatorio si existe el campo
E983
Según algoritmo módulo 11
E10.4 E985 iTipIDTrans
Tipo de documento de
identidad del
transportista
E980 N 1 0-1
Obligatorio si E981 = 2
No informar si E981 = 1
1= Cédula paraguaya
2= Pasaporte
3= Cédula extranjera
4= Carnet de residencia
E10.4 E986 dDTipIDTrans
Descripción del tipo de
documento de identidad
del transportista
E980 A 9-20 0-1
Obligatorio si existe el campo
E985
1= “Cédula paraguaya”
2= “Pasaporte”
3= “Cédula extranjera”
4= “Carnet de residencia”
E10.4 E987 dNumIDTrans
Número de documento
de identidad del
transportista
E980 A 1-20 0-1 Obligatorio si existe el campoE985
E10.4 E988 cNacTrans Nacionalidad deltransportista E980 A 3 0-1 Según XSD de Codificación dePaíses
E10.4 E989 dDesNacTrans
Descripción de la
nacionalidad del
transportista
E980 A 4-30 0-1 Obligatorio si existe el campoE988
E10.4 E990 dNumIDChof Número de documentode identidad del chofer E980 A 1-20 1-1
E10.4 E991 dNomChof Nombre y apellido delchofer E980 A 4-60 1-1
E10.4 E992 dDomFisc Domicilio fiscal deltransportista E980 A 1-150 0-1
E10.4 E993 dDirChof Dirección del chofer E980 A 1-255 0-1
E10.4 E994 dNombAg Nombre o razón socialdel agente E980 A 4-60 0-1 Casos particulares según RG N°41/14
E10.4 E995 dRucAg RUC del agente E980 A 3-8 0-1 Casos particulares según RG N°41/14
septiembre de 2019 102
Grupo ID Campo Descripción NodoPadreTipoDato Longitud Ocurrencia Observaciones
E10.4 E996 dDVAg Dígito verificador delRUC del agente E980 N 1 0-1
Casos particulares según RG N°
41/14
Según algoritmo módulo 11
E10.4 E997 dDirAge Dirección del agente E980 A 1-255 0-1 Casos particulares según RG N°41/14
F. Campos que describen los subtotales y totales de la transacción documentada (F001-F099)
```
En consideración a la Resolución 347 del 2014 (Secretaría de Defensa del Consumidor-SEDECO). Las reglas de redondeo
```
aplican a múltiplos de 50 guaraníes de la siguiente manera:
```
Ejemplos:
```
Guaraníes Redondeo MontoRedondeado
107.437 37 107.400
47.789 39 47.750
Observación: Para monedas extranjeras o cualquier otro cálculo que contenga decimales, las reglas de validación
```
aceptarán redondeos de 50 céntimos (por encima o por debajo)
```
Grupo ID Campo Descripción NodoPadreTipoDato Longitud Ocurrencia Observaciones
F F001 gTotSub Campos de subtotalesy totales A001 G 0-1
Obligatorio si C002 ≠ 7
No informar si C002 = 7
Cuando C002= 4, no informar
F002, F003, F004, F005, F015,
F016, F017, F018, F019, F020,
F023, F025 y F026
septiembre de 2019 103
Grupo ID Campo Descripción NodoPadreTipoDato Longitud Ocurrencia Observaciones
```
F F002 dSubExe Subtotal de laoperación exenta F001 N 1-15p(0-8) 0-1
```
Si E731 = 3: Suma de todas las
```
ocurrencias de EA008 (Valor
```
```
total de la operación por ítem)
```
cuando la operación sea exenta
```
F F003 dSubExo Subtotal de laoperación exonerada F001 N 1-15p(0-8) 0-1
```
Si E731 = 2: Suma de todas las
```
ocurrencias de EA008 (Valor
```
```
total de la operación por ítem)
```
cuando la operación sea
exonerada
F F004 dSub5
Subtotal de la
operación con IVA
incluido a la tasa 5%
```
F001 N 1-15p(0-8) 0-1
```
Si E731 = 1 o 4: Suma de todas
```
las ocurrencias de EA008 (Valor
```
```
total de la operación por ítem)
```
cuando la operación sea a la
```
tasa del 5% (E734=5)
```
No debe existir el campo si D013
≠ 1
F F005 dSub10
Subtotal de la
operación con IVA
incluido a la tasa 10%
```
F001 N 1-15p(0-8) 0-1
```
Si E731 = 1 o 4: Suma de todas
```
las ocurrencias de EA008 (Valor
```
```
total de la operación por ítem)
```
cuando la operación sea a la
```
tasa del 10% (E734=10)
```
No debe existir el campo si D013
≠ 1
```
F F008 dTotOpe Total Bruto de laoperación F001 N 1-15p(0-8) 1-1
```
Cuando D013 = 1, 3, 4 o 5
corresponde a la suma de los
subtotales de la operación
```
(F002, F003, F004 y F005)
```
Cuando D013 = 2 corresponde a
F006
Cuando C002=4 corresponde a
la suma de todas las ocurrencias
```
de EA008 (Valor total de la
```
```
operación por ítem)
```
```
F F009 dTotDesc Total descuentoparticular por ítem F001 N 1-15p(0-8) 1-1 Suma de todos los descuentosparticulares por ítem (EA002)
```
```
F F033 dTotDescGlotem Total descuento globalpor ítem F001 N 1-15p(0-8) 1-1
```
Sumatoria de todas las
ocurrencias de descuentos
```
globales por ítem (EA004)
```
septiembre de 2019 104
Grupo ID Campo Descripción NodoPadreTipoDato Longitud Ocurrencia Observaciones
```
F F034 dTotAntItem Total Anticipo por ítem F001 N 1-15p(0-8) 1-1
```
Sumatoria de todas las
ocurrencias de anticipos por ítem
```
(EA006)
```
```
F F035 dTotAnt Total Anticipo globalpor ítem F001 N 1-15p(0-8) 1-1
```
Sumatoria de todas las
ocurrencias de anticipos global
```
por ítem (EA007)
```
F F010 dPorcDescTotal
Porcentaje de
descuento global sobre
total de la operación
```
F001 N 1-3p(0-8) 1-1 Informativo, si no existe %,completar con cero
```
```
F F011 dDescTotal Total Descuentos de laoperación F001 N 1-15p(0-8) 1-1
```
Sumatoria de todos los
```
descuentos (Global por Ítem y
```
```
particular por ítem) de cada ítem
```
```
F F012 dAnticipo Total Anticipos de laoperación F001 N 1-15p(0-8) 1-1
```
Sumatoria de todos los Anticipos
```
(Global por Ítem y particular por
```
```
ítem)
```
```
F F013 dRedon Redondeo de laoperación F001 N 1-3p(0-4) 1-1
```
Se realiza sobre el campo F008
y conforme a la explicación
inicial en el grupo F
Si no cuenta con redondeo
completar con cero
```
F F025 dComi Comisión de laoperación F001 N 1-15p(0-8) 0-1
```
```
F F014 dTotGralOpe Total Neto de laoperación F001 N 1-15p(0-8) 1-1
```
Corresponde al cálculo
aritmético
F008 - F013 + F025
```
F F015 dIVA5 Liquidación del IVA ala tasa del 5% F001 N 1-15p(0-8) 0-1
```
Suma de todas las ocurrencias
```
de E736 (Liquidación del IVA por
```
```
ítem) cuando la operación sea a
```
```
la tasa del 5% (E734=5)
```
No debe existir el campo si D013
≠ 1 o D013≠5
```
F F016 dIVA10 Liquidación del IVA ala tasa del 10% F001 N 1-15p(0-8) 0-1
```
Suma de todas las ocurrencias
```
de E736 (Liquidación del IVA por
```
```
ítem) cuando la operación sea a
```
```
la tasa del 10% (E734=10)
```
No debe existir el campo si D013
≠ 1 o D013≠5
septiembre de 2019 105
Grupo ID Campo Descripción NodoPadreTipoDato Longitud Ocurrencia Observaciones
F F036 dLiqTotIVA5
Liquidación total del
IVA por redondeo a la
tasa del 5%
```
F001 N 1-15p(0-8) 0-1
```
Corresponde al cálculo del
impuesto al IVA a la tasa del 5%
sobre el valor del redondeo
```
(Valor del redondeo/1,05),
```
cuando la operación sea a la
```
tasa del 5% (E734=5)
```
No debe existir el campo si D013
≠ 1 o D013≠5
F F037 dLiqTotIVA10
Liquidación total del
IVA por redondeo a la
tasa del 10%
```
F001 N 1-15p(0-8) 0-1
```
Corresponde al cálculo del
impuesto al IVA a la tasa del
10% sobre el valor del redondeo
```
(Valor del redondeo/1,1), cuando
```
la operación sea a la tasa del
```
10% (E734=10)
```
No debe existir el campo si D013
≠ 1 o D013≠5
```
F F026 dIVAComi Liquidación total delIVA de la comisión F001 N 1-15p(0-8) 0-1 Se aplica la tasa del 10% paracomisiones
```
```
F F017 dTotIVA Liquidación total delIVA F001 N 1-15p(0-8) 0-1
```
Corresponde al cálculo
```
aritmético F015 (Liquidación del
```
```
IVA al 10%) + F016(Liquidación
```
```
del IVA al 5%) – F036 (redondeo
```
```
al 5%) – F037 (redondeo al 10%)
```
- F026 (Liquidación total del IVA
```
de la comisión)
```
No debe existir el campo si D013
≠ 1 o D013≠5
```
F F018 dBaseGrav5 Total base gravada al5% F001 N 1-15p(0-8) 0-1
```
Suma de todas las ocurrencias
```
de E735 (base gravada del IVA
```
```
por ítem) cuando la operación
```
```
sea a la tasa del 5% (E734=5).
```
No debe existir el campo si D013
≠ 1 o D013≠5
septiembre de 2019 106
Grupo ID Campo Descripción NodoPadreTipoDato Longitud Ocurrencia Observaciones
```
F F019 dBaseGrav10 Total base gravada al10% F001 N 1-15p(0-8) 0-1
```
Suma de todas las ocurrencias
```
de E735 (base gravada del IVA
```
```
por ítem) cuando la operación
```
sea a la tasa del 10%
```
(E734=10).
```
No debe existir el campo si D013
≠ 1 o D013≠5
```
F F020 dTBasGraIVA Total de la basegravada de IVA F001 N 1-15p(0-8) 0-1
```
Corresponde al cálculo
aritmético
F018+F019
No debe existir el campo si D013
≠ 1 o D013≠5
F F023 dTotalGs
Total general de la
operación en
Guaraníes
```
F001 N 1-15p(0-8) 0-1
```
Si D015 ≠ PYG y D017 = 1,
corresponde al cálculo
aritmético:
F014 * D018
Si D015 ≠ PYG y D017 = 2,
corresponde a la suma de todas
las ocurrencias de EA009
Este campo no debe existir si
```
D015=PYG
```
No informar si D015 = PYG
Cuando C002=4 corresponde a
F014
```
F F024 dTotCom Total + comisión F001 N 1-15p(0-8) 0-1
```
G. Campos complementarios comerciales de uso general (G001-G049)
Grupo ID Campo Descripción NodoPadreTipoDato Longitud Ocurrencia Observaciones
G G001 gCamGen Campos de uso general A001 G 0-1
G G002 dOrdCompra Número de orden decompra G001 A 1-15 0-1
G G003 dOrdVta Número de orden deventa G001 A 1-15 0-1
septiembre de 2019 107
Grupo ID Campo Descripción NodoPadreTipoDato Longitud Ocurrencia Observaciones
G G004 dAsiento Número de asientocontable G001 A 1-10 0-1
```
G1. Campos generales de la carga (G050 - G099)
```
Grupo ID Campo Descripción NodoPadreTipoDato Longitud Ocurrencia Observaciones
G1 G050 gCamCarg Campos generales de lacarga G001 G 0-1
Opcional cuando C002=1 o
```
C002=7
```
No informar para C002 ≠ 1 y
C002≠7
G1 G051 cUniMedTotVol
Unidad de medida del
total de volumen de la
mercadería
G050 N 1-5 0-1
Según Tabla 5 – Unidad de
Medida
Si D202 = 3 utilizar los datos del
WS del link de la DNCP
Utilizar el atributo “ID”
G1 G052 dDesUniMedTotVol
Descripción de la
unidad de medida del
total de volumen de la
mercadería
G050 A 1-10 0-1
Referente al campo F027
Utilizar el atributo “Código”
```
Ejemplo: UNI
```
G1 G053 dTotVolMerc Total volumen de lamercadería G050 N 1-20 0-1 Corresponde al volumen total deítems que se han informado
G1 G054 cUniMedTotPes
Unidad de medida del
peso total de la
mercadería
G050 N 1-5 0-1
Según Tabla 5 – Unidad de
Medida
Si D202 = 3 utilizar los datos del
WS del link de la DNCP
Utilizar el atributo “ID”
G1 G055 dDesUniMedTotPes
Descripción de la
unidad de medida del
peso total de la
mercadería
G050 A 1-10 0-1
Referente al campo F030
Utilizar el atributo “Código”
```
Ejemplo: UNI
```
G1 G056 dTotPesMerc Total peso de lamercadería G050 N 1-20 0-1 Corresponde al peso total deítems que se han informado
septiembre de 2019 108
Grupo ID Campo Descripción NodoPadreTipoDato Longitud Ocurrencia Observaciones
G1 G057 iCarCarga Características de laCarga G050 N 1-1 0-1
1 – Mercaderías con cadena de
frío
2 – Carga peligrosa
3 – Otro de características
```
similares (especificar)
```
Obligatorio cuando lo exige la
RG 41/14
G1 G058 dDesCarCarga
Descripción de las
características de la
carga
G050 A 1-50 0-1
1 – “Mercaderías con cadena de
frío”
2 – “Carga peligrosa”
Si G057 = 3, informar la
característica de la carga
Obligatorio cuando lo exige la
RG 41/14 – Obligatorio para
KUDE
H. Campos que identifican al documento asociado (H001-H049)
Grupo ID Campo Descripción NodoPadreTipoDato Longitud Ocurrencia Observaciones
H H001 gCamDEAsoc Campos que identificanal DE asociado A001 G 0-99 Obligatorio si C002 = 4, 5, 6Opcional si C002=1 o 7
H H002 iTipDocAso Tipo de documentoasociado H001 N 1 1-1
1= Electrónico
2= Impreso
3= Constancia Electrónica
H H003 dDesTipDocAso Descripción del tipo dedocumento asociado H001 A 7-11 1-1
Referente al campo H002
1= “Electrónico”
2= “Impreso”
3= “Constancia Electrónica”
H H004 dCdCDERef CDC del DTEreferenciado H001 A 44 0-1 Obligatorio si H002=1No informar si H002 = 2 o 3
H H005 dNTimDI
Nro. timbrado
documento impreso de
referencia
H001 N 8 0-1 Obligatorio si H002=2No informar si H002 = 1 o 3
H H006 dEstDocAso Establecimiento H001 A 3 0-1
Obligatorio si H002=2
```
Completar con 0 (cero) a la
```
izquierda
No informar si H002 = 1 o 3
septiembre de 2019 109
Grupo ID Campo Descripción NodoPadreTipoDato Longitud Ocurrencia Observaciones
H H007 dPExpDocAso Punto de expedición H001 A 3 0-1
Obligatorio si H002=2
```
Completar con 0 (cero) a la
```
izquierda
No informar si H002 = 1 o 3
H H008 dNumDocAso Número del documento H001 A 7 0-1
Obligatorio si H002=2
```
Completar con 0 (cero) a la
```
```
izquierda hasta alcanzar 7 (siete)
```
cifras
No informar si H002 = 1 o 3
H H009 iTipoDocAso Tipo de documentoimpreso H001 N 1 0-1
Obligatorio si H002=2
No informar si H002 = 1 o 3
1= Factura
2= Nota de crédito
3= Nota de débito
4= Nota de remisión
5= Comprobante de retención
H H010 dDTipoDocAso Descripción del tipo dedocumento impreso H001 A 7-16 0-1
Obligatorio si existe el campo
H009
1= “Factura”
2= “Nota de crédito”
3= “Nota de débito”
4= “Nota de remisión”
5= “Comprobante de retención”
H H011 dFecEmiDI
Fecha de emisión del
documento impreso de
referencia
H001 F 10 0-1
Obligatorio si existe el campo
H005
Formato AAAA-MM-DD
No Informar si campo H005 no
existe
H H012 dNumComRet Número de comprobantede retención H001 A 15 0-1
Si E606 = 10, es opcional informar
número de comprobante de
```
retención (Cambio temporal).
```
No informar si E606 ≠ 10
H H013 dNumResCF Número de resolución decrédito fiscal H001 A 15 0-1
Si D011 = 12 obligatorio informar
número de resolución de crédito
fiscal
No informar si D011 ≠ 12
septiembre de 2019 110
Grupo ID Campo Descripción NodoPadreTipoDato Longitud Ocurrencia Observaciones
H H014 iTipCons Tipo de constancia H001 N 1 0-1
Obligatorio cuando H002 = 3
No informar cuando H002 ≠ 3
1= Constancia de no ser
contribuyente
2= Constancia de
microproductores
H H015 dDesTipCons Descripción del tipo deconstancia H001 A 30-34 0-1
Obligatorio si se informa H014
Referente al campo H014
1= “Constancia de no ser
contribuyente”
2=“Constancia de
microproductores”
H H016 dNumCons Número de constancia H001 N 11 0-1
Obligatorio cuando H002 = 3 y
```
H014 = 2
```
No informar cuando H002 ≠ 3
H H017 dNumControl Número de control de laconstancia H001 A 8 0-1
Obligatorio cuando H002 = 3 y
```
H014 = 2
```
No informar cuando H002 ≠ 3
I. Información de la Firma Digital del DTE (I001-I049)
Grupo ID Campo Descripción NodoPadreTipoDato Longitud Ocurrencia Observaciones
I I001 Signature Firma Digital del DTE AA001 G 1-1
Según el estándar XML signature
```
Debe ser firmado el grupo A (campo
```
```
A001) que contiene los grupos de
```
información del A hasta H
J. Campos fuera de la Firma Digital (J001-J049)
Grupo ID Campo Descripción NodoPadreTipoDato Longitud Ocurrencia Observaciones
J J001 gCamFuFD Campos fuera de la firmadigital AA001 G 1-1
J J002 dCarQR
Caracteres
correspondientes al código
QR
J001 A 100-600 1-1
Debe ser validado contra la información
incluida en el XML del DE, de acuerdo
con lo especificado en el capítulo del
QR del MT
septiembre de 2019 111
Grupo ID Campo Descripción NodoPadreTipoDato Longitud Ocurrencia Observaciones
J J003 dInfAdic Información adicional deinterés para el emisor J001 A 1-5000 0-1
Campo de información de interés
exclusivo del emisor para aclaraciones
a sus clientes.
Este campo NO debe ser enviado para
al SIFEN. Puede formar parte del DE o
KuDE enviado al receptor, pero NO
formará parte del DTE
11. Gestión de eventos
Entiéndase por evento toda ocurrencia o suceso registrado en SIFEN por el cual se asigna una marca,
se modifica o afecta el estado de un Documento Electrónico o Documento Tributario Electrónico y
puede darse a lo largo del ciclo de vida de este. Puede darse de manera previa o posterior a la
aprobación del DTE, dependiendo de su naturaleza.
A manera de ejemplo de eventos se tiene los siguientes:
• Cancelación
```
• Devolución y Ajuste de precios (evento automático por la emisión notas de crédito o débito
```
```
electrónicas)
```
• Disconformidad de un DE o DTE por parte del receptor
Los eventos pueden ser de dos tipos:
• De registro AUTOMÁTICO generados por SIFEN: Ejemplo: evento de ajuste de una FE por la
aprobación de una Nota de Crédito Electrónica asociada a la FE.
• De registro REQUERIDO por el consumo de los Servicios Web dispuestos por SIFEN para los
```
actores intervinientes: Ejemplo: Manifestaciones del receptor (disconformidad y
```
```
desconocimiento de la operación).
```
Dependiendo de quién lo solicite, los eventos se clasifican de la siguiente manera:
11.1. Eventos realizados por el emisor
Son aquellos eventos originados por el emisor, cuando surge alguna situación que modifica la
secuencia numérica o el contenido del DE. El emisor cuenta con la facultad para efectuar los eventos
que se citan a continuación:
11.1.1. Inutilización de número de DE
Es un evento solicitado por el emisor electrónico. Pueden darse tres situaciones:
• Saltos en la numeración: Por algún error en el sistema de facturación del emisor, se produce
un salto en la numeración. Dicha situación debe ser comunicada, reportando el tipo de DE
y saltos en el rango de numeración, de manera a no alterar la correlatividad numérica.
```
• Detección de errores técnicos (de llenado) en la emisión del DE.
```
• Por rechazo del SIFEN: Cuando un DE ha sido rechazado por el SIFEN y su ajuste implique
la modificación del CDC, indefectiblemente esa numeración no utilizada debe ser inutilizada
```
Sugerencia: Para poder inutilizar un documento, se sugiere que dicho evento se realice
```
antes de la entrega del comprobante, envío o salida de la mercadería y de la transmisión del
DE al SIFEN.
septiembre de 2019 113
El evento de inutilización de la numeración de un DE podrá realizarse siempre y cuando éste no haya
sido aprobado por el SIFEN. El estado de los números de DE inutilizados quedará registrado en el
SIFEN.
Es posible el registro de la inutilización de un rango de hasta 1000 números secuenciales de DE toda
vez que no exista ningún número utilizado en dicho rango.
Se requiere la información del motivo de la inutilización del rango de numeración en un campo libre
de texto de hasta 150 caracteres.
11.1.2. Cancelación
Es un evento solicitado por el emisor, ocurre cuando el comprobante es emitido sin errores y
transmitido y aprobado por el SIFEN se convierte en un DTE, sin embargo, por algún motivo no se
concreta la transacción.
El emisor electrónico puede solicitar la CANCELACIÓN de cualquier tipo de DTE y tiene hasta 48 hs.
posteriores a la aprobación de uso del DE para generar el evento. El estado de los DTE cancelados
quedará registrado en el SIFEN y es obligatoria la conservación por 5 años.
11.1.3. Devolución y Ajuste de precios
Son eventos automáticos generados por la emisión de una NOTA DE CRÉDITO o DÉBITO
ELECTRÓNICAS.
Es un evento exclusivo de la FACTURA ELECTRÓNICA, puesto que existen documentos para dichos
efectos. Es imperativo que la Nota de Crédito o Débito Electrónica emitida se encuentre vinculada
```
a una FE ya existente en la base de datos del SIFEN; o sea, se requiere la configuración del hecho
```
imponible, que la factura haya sido entregada al cliente, transmitida y aprobada por SIFEN. Es
importante comprender que las Notas de Crédito o Débito Electrónicas como tales, no son eventos,
sino que la operación resultante de su emisión y aprobación en SIFEN genera un evento automático
del sistema.
La coexistencia de documentos electrónicos y pre-impresos solo será permitida en las etapas del
Plan Piloto y Voluntariedad. Esto permite que la Nota de Crédito o Débito Electrónica emitida se
encuentre vinculada a una factura pre-impresa. Igualmente, el sistema genera el evento automático
de AJUSTE pero no realiza validaciones sobre los montos ajustados.
Cuando hablamos de AJUSTE nos referimos a los casos en que se acepten devoluciones en forma
parcial o se concedan descuentos y bonificaciones.
septiembre de 2019 114
Las FE con Notas de Crédito o Débito Electrónicas asociadas obligatoriamente deberán ser
conservadas por 5 años, en estos casos, el receptor no tendrá derecho al crédito del IVA contenido
en la misma ya sea en forma total o parcial.
El estado de las FE con devoluciones o ajustes de precios quedará registrado en el SIFEN. En caso de
devoluciones o ajustes de precios totales de una FE, no será posible retractarse. Para corregir esta
situación, el emisor deberá generar una nueva FE exactamente igual.
```
11.1.4. Endoso de FE (evento futuro)
```
Es un evento solicitado por el emisor, ocurre cuando la factura electrónica, cuya aprobación de uso
ha sido otorgada por la Administración Tributaria, es seleccionada por éste para ser comercializada
en el mercado financiero local. Este evento se va detallar en versión futura del MT.
11.2. Eventos registrados por el receptor
Son aquellos eventos generados por una persona física o jurídica, a cuyo nombre fue emitido un
documento electrónico. El registro del evento de receptor se puede dar sobre un DE o DTE.
Los eventos del receptor no invalidarán el DE o DTE, sino que quedarán marcados en el SIFEN y el
emisor electrónico podrá conocer dicha situación. El receptor cuenta con la facultad de comunicar
a la Administración Tributaria lo siguiente:
11.2.1. Conformidad con el DTE
El receptor informa a la Administración Tributaria que conoce dicho documento y confirma que
están correctos todas las informaciones del DTE, que no existen errores o inconsistencias en forma
parcial o total y que ha recibido la mercadería o servicio.
11.2.2. Disconformidad con el DTE
El receptor informa a la Administración Tributaria que conoce dicho documento, pero que en el
comprobante existen errores o inconsistencias en forma parcial o total.
11.2.3. Desconocimiento con el DE o DTE
El receptor informa a la Administración Tributaria que desconoce el documento que fuera emitido
a su nombre y la operación detallada en el mismo.
septiembre de 2019 115
Para efecto de gestionar ambos eventos, el receptor podrá utilizar los servicios del SIFEN para
descargar el detalle todos los DTE emitidos a su nombre o razón social
11.2.4. Notificación de recepción de un DE o DTE
El receptor informa a la Administración Tributaria que conoce dicho documento, sin embargo, aún
```
no tiene condiciones para manifestarse de forma conclusiva (con Conformidad, Disconformidad o
```
```
Desconocimiento). Es un evento opcional y no se registra este evento si ya existe otro evento
```
registrado de manifestación del destinatario.
Para efecto de gestionar ambos eventos, en el futuro, el receptor podrá utilizar los servicios del
SIFEN o en el Portal e-kuatia para descargar el detalle todos los DTE emitidos a su nombre o razón
social según reglas que se van establecer por la SET.
11.2.5. Tipología de los eventos del receptor
- Eventos conclusivos (conformidad y disconformidad): corresponden a aquellos eventos
del receptor que podrían generar una acción del emisor para modificar el estado de un DTE,
como un ajuste por la emisión de notas de crédito o débito electrónica o cancelar un DTE.
Los eventos conclusivos solo son realizados sobre DTE.
- Eventos informativos (desconocimiento y notificación de recepción): corresponden a
aquellos eventos del receptor que colocan una marca a un DTE o registran la recepción de
un DE, a diferencia de los eventos conclusivos, los eventos informativos no generan una
acción del emisor. Los eventos informativos pueden ser realizados sobre DTE y DE.
11.3. Eventos automáticos: Esta transaccionalidad informática de SIFEN permite vincular
determinados eventos y situaciones en los DTE sin la intervención directa del emisor ni del
receptor, por lo tanto, no son generados por los facturadores electrónicos, sino que se
devuelve como parte de la consulta de un DTE y se encontrará en el contenedor del evento.
• Eventos automáticos por SIFEN
o Ejemplo 1: registro automático del evento -Vinculación de la nota de crédito o
Débito automático a una Factura Electrónica- que se activa cuando se aprueba en
SIFEN la nota de crédito o Débito, según el caso.
o Ejemplo 2: registro automático del evento -Vinculación automática de la nota de
Remisión Electrónica a una Factura Electrónica- la cual se activa cuando se aprueba
en SIFEN la nota Remisión Electrónica.
septiembre de 2019 116
• Eventos automáticos por interoperabilidad
```
o Ejemplo 3: interoperabilidad con sistemas de la SET (Tesaka – retenciones y
```
```
Marangatu – Créditos fiscales por transferencia o devolución)
```
```
11.4. Eventos registrados por la SET (evento futuro)
```
La Administración Tributaria tiene la potestad para realizar el siguiente evento:
11.4.1. Impugnación de DTE
Cuando como consecuencia de un proceso de control se compruebe la falta de veracidad de la
operación económica que respalda un DTE obrante en el SIFEN, la Administración Tributaria podrá
impugnar la validez del mismo.
Con excepción a los eventos del Emisor de Cancelación de DTE e Inutilización de número de DE, y a
los eventos automáticos de SIFEN de Anulación y Asociación, la descripción detallada y efectos de
los demás eventos, se definirán en una versión posterior del presente MT y se presentan acá como
Eventos Futuros.
Tabla J: Resumen de los eventos de SIFEN según los actores
N° Evento Actor Tipo Transmisión Plazo Alcance
DE
Criterios Condiciones Acce
so
1 Cancelación
del DTE
Emisor Registro
Requerido
Evento
conclusivo
WS Sincrónico
Eventos
Hasta 48 horas de la aprobación
del DTE cuando es igual a FE.
Hasta 168 horas de la
aprobación del DTE cuando los
```
documentos electrónicos (NCE,
```
```
NDE, NRE, AFE) son distintos a
```
FE
Todos los
DTE
• DTE en SIFEN
• Situación Aprobado o Aprobado
```
con observación (por
```
```
extemporaneidad)
```
• Se requiere informar la
justificativa de la Cancelación
```
(campo texto libre)
```
• Para un DTE que tenga otros
DTEs asociados, se debe
realizar la cancelación del último
DTE hasta llegar al inicial.
• Hubo errores en la emisión
del DE
• La mercadería no fue
entregada al cliente
• El servicio no ha sido
realizado al cliente
WS
2 Inutilización
del número de
DE
Emisor Registro
Requerido
Evento
conclusivo
WS Sincrónico
Eventos
```
Dentro de los 15 (quince)
```
primeros días del mes siguiente
al acaecimiento del hecho,
deberá comunicar la
inutilización de la numeración
del DE.
Y hasta fecha límite de validez
```
del timbrado (plazo del sistema)
```
Todos los
DE
• Número del DE en el rango de
inutilización no existe en base de
datos de SIFEN
• Inutilización por rango de hasta
```
1000 (parámetro de SIFEN)
```
números de DE no utilizados
• Se requiere informar la
justificativa de la Inutilización
```
(campo texto libre)
```
• Saltos de Numeración
• Decisión de la empresa de
inutilización de un número
de DE que puede haber
sido rechazado por errores
```
técnicos (Errores de llenado
```
```
de forma del DE) y no
```
ocurrió el hecho generador
del impuesto y no hubo el
envío del DE al Receptor
WS
10 Notificación
de recepción
DE o DTE
Receptor Registro
Requerido
Evento
informativo
WS Sincrónico
Eventos o Portal
SIFEN
```
Hasta 45 (cuarenta y cinco) días
```
contados desde la fecha de
emisión
Todos los
DE o DTE
DTE o DE recepcionado WS/P
ORTA
L
11 Conformidad
DTE
Receptor Registro
Requerido
Evento
conclusivo
WS Sincrónico
Eventos o Portal
SIFEN
```
Hasta 45 (cuarenta y cinco) días
```
contados desde la fecha de
emisión
Todos los
DTE
DTE WS/P
ORTA
L
12 Disconformid
ad DTE
Receptor Registro
Requerido
WS Sincrónico
Eventos o Portal
SIFEN
```
Hasta 45 (cuarenta y cinco) días
```
contados desde la fecha de
emisión
Todos los
DTE
DTE WS/P
ORTA
L
septiembre de 2019 118
Evento
conclusivo
13 Desconocimi
ento DE o
DTE
Receptor Registro
Requerido
Evento
informativo
WS Sincrónico
Eventos o Portal
SIFEN
```
Hasta 45 (cuarenta y cinco) días
```
contados desde la fecha de
emisión
Todos los
DE o DTE
DTE o DE recepcionado WS/P
ORTA
L
14 Devolución y
Ajuste de
precios
SIFEN Registro
Automátic
o
• Plazo límite definido por la
SET
• Plazo de prescripción
FE • Emisión de una NCE o NDE
```
(asociación) para una FE con
```
situación Aprobada o Aprobado
```
con observación (por
```
```
extemporaneidad) en SIFEN
```
• La FE asociada se encuentra en
SIFEN con situación de
Aprobado o Aprobado
Extemporáneo
La NCE o NDE indica el tipo de
```
asociación (Devolución y Ajuste de
```
```
precios)
```
• Ajustar una operación de
una FE Aprobada
Por devolución y Ajuste de
precios de una operación de
una FE Aprobada
Autom
ático
16 Asociación SIFEN Registro
Automátic
o
Emisión de un DE
con otro DTE,
pre-impreso,
autoimpresor,
comprobante
virtual u otros
documentos
asociados
```
(Asociación)
```
Inmediato a la Aprobación en
SIFEN de un DTE con indicación
de otros documentos asociados
o cuando existan informaciones
provenientes del Marangatu o
Tesaka
Todos los
DE, otros
documento
s emitidos
por otra
modalidad
de
facturación
e
interoperabi
lidad con
sistemas de
la SET
• DTE asociado se encuentra en
SIFEN con situación de
Aprobado o Aprobado con
observaciones o cuando el
SIFEn reciba informaciones
provenientes de los sistemas de
la administración tributaria
```
(Marangatu o Tesaka)
```
• Ajustar una operación
• Anular una operación
Autom
ático
```
IMPORTANTE: Los eventos de Registro Requerido habilitados serán los que conciernen al emisor: de Cancelación de un DTE y la Inutilización
```
```
de un rango de DE, y el evento automático de devolución y Ajuste de precios (disparados por la emisión de Notas de Créditos y Débitos
```
```
Electrónicas) y los eventos del receptor: Notificación de recepción DE o DTE, Conformidad DTE, Disconformidad DTE, Desconocimiento DE o
```
DTE
septiembre de 2019 119
Especificaciones sobre la Gestión de Eventos por web Services para emisores y receptores electrónicos:
• Los eventos deben ser estructurados en un archivo XML por eventos
• Cada evento deberá estar firmado digitalmente
• Los eventos del emisor y receptor deberán ser transmitidos por los Web Services disponibles para dicha gestión
```
• Los eventos deberán ser enviados en lotes de hasta 15 eventos de cualquier tipo (emisor y/o receptor).
```
• La Inutilización de un número de DE debe ser solicitada por rango secuencial o correlativo.
Tabla K: Correcciones de los eventos del Receptor en el SIFEN
N° Correcciones Actor Tipo Modalidad de
Registro
Plazo Alcance
DE
Criterios Condiciones
1 Conformidad –
Disconformidad
-
Desconocimient
o DE o DTE
Receptor Registro
Requerido
WS Sincrónico
Eventos/Portal SIFEN
```
Hasta 15 (quince)
```
días del registro
del primer evento
Todos los DE
o DTE
• DTE en SIFEN
• Situación Aprobado o
Aprobado Extemporáneo
• Se requiere informar la
justificativa del evento de
```
corrección (campo texto libre)
```
• Solo se puede registrar un
evento de corrección sobre
cada evento mencionado
• Selección del
evento del
receptor por
equivocación
A continuación, se presenta el cuadro que representa las relaciones que pueden darse entre eventos del receptor.
```
Referencia:
```
```
Gris = encabezado
```
```
Verde = puede realizarse luego del evento que se encuentra en el encabezado
```
```
Rojo = no puede realizarse luego del evento que se encuentra en el encabezado
```
septiembre de 2019 120
DE
Notificación -
Recepción
Desconocimiento
Notificación -
Recepción DE
Notificación -
Recepción DE
Conformidad parcial Conformidad parcial
Conformidad total Conformidad total
Disconformidad Disconformidad
Desconocimiento
DTE
Desconocimiento DTE
Inutilización de
número
Inutilización de
número
11.5. Estructura de los Eventos
```
Para estructurar los diferentes eventos que afectan el estado de un DTE se toma como elemento base al Código de control (CDC), a
```
excepción del evento de Inutilización de número de DE.
```
Schema XML 19: Evento_v150.xsd (Formato de evento emisor)
```
Grupo ID Campo Descripción NodoPadreTipoDato Longitud Ocu Observaciones
GDE GDE000 gGroupGesEve Raíz del grupo deeventos GSch03 G 1-1
GDE GDE001 rGesEve Raíz de Gestión deEventos GDE000 G - 1-15 Elemento raíz
GDE GDE002 rEve Grupos de camposgenerales del evento GDE001 G 1-1 Grupo de campos incluidos en la firmadigital
DTE
Notificación -
Recepción
Conformidad
parcial
Conformidad
total
Disconformidad Desconocimiento
Notificación -
Recepción DTE
Notificación -
Recepción DTE
Notificación -
Recepción DTE
Notificación - Recepción
DTE
Notificación -
Recepción DTE
Conformidad parcial Conformidad parcial Conformidad parcial Conformidad parcial Conformidad parcial
Conformidad total Conformidad total Conformidad total Conformidad total Conformidad total
Disconformidad Disconformidad Disconformidad Disconformidad Disconformidad
Desconocimiento
DTE
Desconocimiento DTE Desconocimiento
DTE
Desconocimiento DTE Desconocimiento
DTE
Inutilización de
número
Inutilización de
número
Inutilización de
número
Inutilización de número Inutilización de
número
septiembre de 2019 121
GDE GDE003 Id Identificador del evento N 1-10 1-1 Atributo del campo GDE002
GDE GDE004 dFecFirma Fecha y Hora del firmado GDE002 F 19 1-1 Fecha y hora en el formato AAAA-MM-DDThh:mm:ss
GDE GDE005 dVerFor Versión del formato GDE002 N 3 1-1 Control de versiones
GDE GDE006 dTiGDE Tipo de Evento GDE002 N 1-2 1-1
Eventos del Emisor
1 = Cancelación
2 = Inutilización
```
3 = Endoso (futuro)
```
Eventos del Comprador
```
10 = Acuse del DE (futuro)
```
```
11 = Conformidad del DE (futuro)
```
```
12 = Disconformidad del DE (futuro)
```
```
13 = Desconocimiento del DE (futuro)
```
GDE GDE007 gGroupTiEvt Grupo de campos del tipode evento GDE002 G 1-1 Grupo correspondiente al evento segúndTiGDE
```
GDE GDE008 Signature Grupo de la Firma Digital GDE001 G 1-1 Firma Digital del campo rEve (GDE001)
```
11.5.1. FORMATO DE EVENTOS EMISOR
```
Grupo: Evento Cancelación (Formato del evento de cancelación)
```
Grupo ID Campo Descripción NodoPadreTipoDato Longitud Ocu Observaciones
GDE GEC001 rGeVeCan Raíz Gestión de EventosCancelación GDE007 G - -
Elemento raíz
Obligatorio si campo dTiGDE=1
```
(Cancelación)
```
```
GDE GEC002 Id Identificador del DTE GEC001 A 44 1-1 Se informa el código de control (CDC)
```
GDE GEC003 mOtEve Motivo del Evento GEC001 A 5 - 500 1-1 Campo abierto
septiembre de 2019 122
```
Grupo: Evento Inutilización (Formato del evento de inutilización)
```
Grupo ID Campo Descripción NodoPadreTipoDato Longitud Ocu Observaciones
GDE GEI001 rGeVeInu Raiz Gestión deEventos Inutilización GDE007 - - -
Elemento raíz
Obligatorio si campo dTiGDE=2
```
(Inutilización)
```
GDE GEI002 dNumTim Número del Timbrado GEI001 N 8 1-1
GDE GEI003 dEst Establecimiento GEI001 A 3 1-1 Completar con ceros a la izquierda
GDE GEI004 dPunExp Punto de expedición GEI001 A 3 1-1 Completar con ceros a la izquierda
GDE GEI005 dNumIn Número Inicio delrango del documento GEI001 A 7 1-1
La cantidad máxima para inutilización es
un rango de hasta 1000 números del DE.
Completar con ceros a la izquierda
GDE GEI006 dNumFin Número Final delrango del documento GEI001 A 7 1-1 Completar con ceros a la izquierda
GDE GEI007 iTiDE Tipo de DocumentoElectrónico GEI001 N 1-2 1-1
1= Factura electrónica
2= Factura electrónica de exportación
3= Factura electrónica de importación
4= Autofactura electrónica
5= Nota de crédito electrónica
6= Nota de débito electrónica
7= Nota de remisión electrónica
8= Comprobante de retención
electrónico
GDE GEI008 mOtEve Motivo del Evento GEI001 A 5-500 1-1 Campo libre
septiembre de 2019 123
11.5.2. FORMATO DE EVENTOS RECEPTOR
```
Evento Notificación – Recepción DE/DTE (Formato del evento de Notificación – Recepción)
```
Grupo ID Campo Descripción NodoPadreTipoDato Longitud Ocurrencia Observaciones
GER GEN001 rGeVeNotRec
Raíz Gestión de Eventos
Notificación – Recepción
DE o DTE
GDE007 G - - Elemento raíz
```
GER GEN002 Id Identificador del DE/DTE GEN001 A 44 1-1 Se informa el código de control (CDC) deun DE/DTE
```
GER GEN003 dFecEmi Fecha de emisión delDE/DTE GEN001 F 19 1-1
Requerido para conteo de plazo de
```
registro del evento del receptor (hasta 45
```
```
días desde la fecha de emisión)
```
Fecha y hora en el formato AAAA-MM-
```
DDThh:mm:ss
```
GER GEN004 dFecRecep Fecha Recepción DE GEN001 F 19 1-1
Fecha en que el receptor recibió física o
electrónicamente el documento
electrónico. Fecha y hora en el formato
AAAA-MM-DDThh:mm:ss
GER GEN005 iTipRec Tipo de Receptor GEN001 N 1 1-1 1=Contribuyente2=No Contribuyente
GER GEN006 dNomRec Nombre o Razón Socialdel Receptor del DE/DTE GEN001 A 4-60 1-1
GER GEN007 dRucRec Ruc del Receptor GEN001 A 3-8 0-1
Requerido solo cuando el tipo de receptor
```
es contribuyente (GEN005=1)
```
No Informar si GEN005=2
GER GEN008 dDVRec Dígito verificador del RUCdel contribuyente receptor GEN001 N 1 0-1
Requerido solo cuando el tipo de receptor
```
es contribuyente (GEN005=1)
```
No Informar si GEN005=2
GER GEN009 dTipIDRec
Tipo de documento de
identidad del receptor GEN001 N 1 0-1
No Informar si GEN005=1
Requerido solo cuando el tipo de receptor
```
es No Contribuyente (GEN005=2)
```
1= Cédula paraguaya
2= Pasaporte
3= Cédula extranjera
4= Carnet de residencia
GER GEN010 dNumID Número de documento deidentidad GEN001 A 1-20 0-1
No Informar si GEN005=1
Requerido solo cuando el tipo de receptor
```
es No Contribuyente (GEN005=2)
```
septiembre de 2019 124
Grupo ID Campo Descripción NodoPadreTipoDato Longitud Ocurrencia Observaciones
```
GER GEN011 dTotalGs Total general de laoperación en Guaraníes GEN001 N 1-15p(0-8) 1-1
```
```
Evento Conformidad (Formato del evento de conformidad)
```
Grupo ID Campo Descripción NodoPadreTipoDato Longitud Ocurrencia Observaciones
GER GCO001 rGeVeConf Raiz Gestión de EventosConformidad GDE007 - - - Elemento raíz
GER GCO002 Id CDC del DTE GCO001 A 44 1-1 Corresponde al CDC de un DTE
GER GCO003 iTipConf Tipo de Conformidad GCO001 N 1 1-1
1= Conformidad Total del DTE
2= Conformidad Parcial del DTE, cuando
la mercadería será entregada o servicio
será prestado en una fecha posterior a la
recepción del DE/DTE
GER GCO004 dFecRecep Fecha Estimada deRecepción GCO001 F 19 0-1
Obligatorio si el tipo de Conformidad es
```
Conformidad Parcial del DTE (GCO003=
```
```
2)
```
```
Evento Disconformidad (Formato del evento de Disconformidad)
```
Grupo ID Campo Descripción NodoPadreTipoDato Longitud Ocurrencia Observaciones
GER GDI001 rGeVeDisconf Raiz Gestión de EventosDisconformidad GDE007 - - - Elemento raíz
GER GDI002 Id CDC del DTE GDI001 N 44 1-1 Corresponde al CDC de un DTE
GER GDI004 mOtEve Motivo del Evento GDI001 A 5-500 1-1
septiembre de 2019 125
```
Evento Desconocimiento DE/DTE (Formato del evento de Desconocimiento DE/DTE)
```
Grupo ID Campo Descripción Nodo Padre TipoDato Longitud Ocurrencia Observaciones
GER GED001 rGeVeDescon
Raiz Gestión de
Eventos
Desconocimiento
GDE007 - - - Elemento raíz
GER GED002 Id CDC del DE/DTE GED001 A 44 1-1 Corresponde al CDC de un Kude o CDCde un DTE
GER GED003 dFecEmi Fecha de emisión delDE/DTEGED001 F 19 1-1
Requerido para conteo de plazo de
```
registro del evento del receptor (hasta 45
```
```
días desde la fecha de emisión).
```
Fecha y hora en el formato AAAA-MM-
```
DDThh:mm:ss.
```
GER GED004 dFecRecep Fecha Recepción DE GED001 F 19 1-1 Fecha y hora en el formato AAAA-MM-DDThh:mm:ss.
GER GED005 iTipRec Tipo de Receptor GED001 N 1 1-1 1=Contribuyente2=No Contribuyente
GER GED006 dNomRec
Nombre o Razón
Social del Receptor
del DE/DTE
GED001 A 4-60 1-1
GER GED007 dRucRec Ruc del Receptor GED001 A 3-8 0-1
Requerido solo cuando el tipo de receptor
```
es Contribuyente (GED005=1)
```
No Informar si GED005=2
GER GED008 dDVRec
Dígito verificador del
RUC del contribuyente
receptor
```
GED001 N 1 0-1Requerido solo cuando el tipo de receptores Contribuyente (GED005=1)
```
No Informar si GED005=2
GER GED009 dTipIDRec
Tipo de documento de
identidad del receptor GED001 N 1 0-1
No Informar si GED005=1
Requerido solo cuando el tipo de receptor
```
es No Contribuyente (GED005=2)
```
1= Cédula paraguaya
2= Pasaporte
3= Cédula extranjera
4= Carnet de residencia
septiembre de 2019 126
Grupo ID Campo Descripción Nodo Padre TipoDato Longitud Ocurrencia Observaciones
GER GED010 dNumID Número de documentode identidadGED001 A 1-20 0-1
No Informar si GED005=1
Requerido solo cuando el tipo de receptor
```
es No Contribuyente (GED005=2)
```
GER GED011 mOtEve Motivo del Evento GED001 A 5-500 1-1
Evento automático por interoperabilidad: Evento asociación Retención
Grupo ID Campo Descripción Nodo Padre TipoDato Longitud Ocurrencia Observaciones
GEA GER001 rGeVeRetAce Raíz Gestión deEventos de retención GDE007 - - - Elemento raíz
GEA GER002 Id CDC del DE/DTE GER001 A 44 1-1 Corresponde al CDC del DTE asociado
GEA GER003 dNumTimRetNúmero de timbradodel documento de
retención
GER001 N 8 1-1
GEA GER004 dEstRet Establecimiento GER001 A 3 1-1
GEA GER005 dPunExpRet Punto de expedición GER001 A 3 1-1
GEA GER006 dNumDocRet Número del
documento GER001 A 7 1-1
GEA GER007 dCodConRet Identificador de la
retención
GER001 A 40 1-1
GEA GER008 dFeEmiRet Fecha de emisión de
la retención
GER001 F 19 1-1
septiembre de 2019 127
Evento automático por interoperabilidad: Evento asociación de anulación de la Retención
Grupo ID Campo Descripción Nodo Padre TipoDato Longitud Ocurrencia Observaciones
GEA GERA001 rGeVeRetAnu
Raíz Gestión de
Eventos de retención
anulación
GDE007 - - - Elemento raíz
GEA GERA002 Id CDC del DE/DTE GERA001 A 44 1-1 Corresponde al CDC del DTE asociado
GEA GERA003 dNumTimRetNúmero de timbradodel documento de
retención
GERA001 N 8 1-1
GEA GERA004 dEstRetEstablecimiento deldocumento de
retención
GERA001 A 3 1-1
GEA GERA005 dPunExpRetPunto de expedicióndel documento de
retención
GERA001 A 3 1-1
GEA GERA006 dNumDocRetNúmero deldocumento de la
retención
GERA001 A 7 1-1
GEA GERA007 dCodConRet Identificador de la
retención GERA001 A 40 1-1
GEA GERA008 dFeEmiRet Fecha de emisión de
la retención GERA001 F 19 1-1
GEA GERA009 dFecAnRet Fecha de anulación
de la retención GERA001 F 19 1-1
Evento automático por interoperabilidad: Evento transferencia de créditos fiscales
Grupo ID Campo Descripción Nodo Padre TipoDato Longitud Ocurrencia Observaciones
GEA GECF001 rGeVeCCFFRaíz Gestión deEventos de créditos
fiscales
GDE007 - - - Elemento raíz
septiembre de 2019 128
Grupo ID Campo Descripción Nodo Padre TipoDato Longitud Ocurrencia Observaciones
GEA GECF002 Id CDC del DE/DTE GECF001 A 44 1-1 Corresponde al CDC del DTE asociado
GEA GECF003 dNumTraCCFF
Número de
transferencia de
créditos fiscales
GECF001 A 10 1-1
GEA GECF004 dFeAceTraCCFF Fecha de aceptacióndel crédito fiscalGECF001 F 19 1-1
Evento automático por interoperabilidad: Evento devolución de créditos fiscales - Cuestionado
Grupo ID Campo Descripción Nodo Padre TipoDato Longitud Ocurrencia Observaciones
GEA GEDF001 rGeDevCCFFCu
e
Raíz Gestión de
Eventos de devolución
de créditos fiscales -
Cuestionado
GDE007 - - - Elemento raíz
GEA GEDF002 Id CDC del DE/DTE GEDF001 A 44 1-1 Corresponde al CDC del DTE asociado
GEA GEDF003 dNumDevSol Número DIR GEDF001 A 10 1-1 Corresponde al número de solicitud de laDIR
GEA GEDF004 dNumDevInf Número de informe GEDF001 A 10 1-1
GEA GEDF005 dNumDevRes Número de resoluciónde la devoluciónGEDF001 A 10 1-1
GEA GEDF006 dFeEmiSol Fecha de emisión deDIRGEDF001 F 19 1-1
GEA GEDF007 dFeEmiInf Fecha de emisión delinformeGEDF001 F 19 1-1
GEA GEDF008 dFeEmiRes Fecha de emisión dela resoluciónGEDF001 F 19 1-1
septiembre de 2019 129
Evento automático por interoperabilidad: Evento devolución de créditos fiscales - Devuelto
Grupo ID Campo Descripción Nodo Padre TipoDato Longitud Ocurrencia Observaciones
GEA GEDD001 rGeDevCCFFDe
v
Raíz Gestión de
Eventos de devolución
de créditos fiscales -
Devuelto
GDE007 - - - Elemento raíz
GEA GEDD002 Id CDC del DE/DTE GEDD001 A 44 1-1 Corresponde al CDC del DTE asociado
GEA GEDD003 dNumDevSol Número DIR GEDD001 A 10 1-1 Corresponde al número de solicitud de la
DIR
GEA GEDD004 dNumDevInf Número de informe GEDD001 A 10 1-1
GEA GEDD005 dNumDevRes Número de resolución
de la devolución
GEDD001 A 10 1-1
GEA GEDD006 dFeEmiSol Fecha de emisión de
DIR
GEDD001 F 19 1-1
GEA GEDD007 dFeEmiInf Fecha de emisión del
informe
GEDD001 F 19 1-1
GEA GEDD008 dFeEmiRes Fecha de emisión de
la resolución
GEDD001 F 19 1-1
Evento automático por SIFEN: Evento anticipo
Grupo ID Campo Descripción Nodo Padre TipoDato Longitud Ocurrencia Observaciones
GEA GEA001 rGeVeAnt Raíz Gestión de
Eventos anticipo GDE007 - - - Elemento raíz
septiembre de 2019 130
Grupo ID Campo Descripción Nodo Padre TipoDato Longitud Ocurrencia Observaciones
GEA GEA002 Id CDC del DTE
asociado
GEA001 A 44 1-1
Evento automático por SIFEN: Evento remisión
Grupo ID Campo Descripción Nodo Padre TipoDato Longitud Ocurrencia Observaciones
GEA GERE001 rGeVeRem Raíz Gestión de
Eventos remisión GDE007 - - - Elemento raíz
GEA GERE002 Id CDC del DTE
asociado
GERE001 A 44 1-1
Evento por actualización de datos: Datos del transporte
Grupo ID Campo Descripción Nodo Padre TipoDato Longitud Ocurrencia Observaciones
GDE GET001 rGeVeTr
Raíz Gestión de
Eventos por
actualización de datos
del transporte
GDE007 - - - Elemento raíz
GDE GET002 Id CDC del DTE GET001 A 44 1-1
GDE GET003 dMotEv Motivo del evento GET001 N 1 1-1
1= Cambio del local de la entrega
2= Cambio del chofer
3= Cambio del transportista
4= Cambio de vehículo
GDE GET004 cDepEntCódigo deldepartamento del local
de la entrega
GET001 N 1-2 0-1 Obligatorio si GET003=1
Según XSD de Departamentos
septiembre de 2019 131
Grupo ID Campo Descripción Nodo Padre TipoDato Longitud Ocurrencia Observaciones
GDE GET005 dDesDepEnt
Descripción del
departamento del local
de la entrega
GET001 A 6-16 0-1 Referente al campo GET004
GDE GET006 cDisEnt Código del distrito del
local de la entrega
GET001 N 1-4 0-1 Según Tabla 2.1 - Distritos
GDE GET007 dDesDisEnt Descripción de distrito
del local de la entrega
GET001 A 1-30 0-1 Obligatorio si existe el campo GET006
GDE GET008 cCiuEnt Código de la ciudad
del local de la entrega
GET001 N 1-5 0-1Obligatorio si GET003=1
Según Tabla 2.2 – Ciudades
GDE GET009 dDesCiuEnt Descripción de ciudad
del local de la entrega
GET001 A 1-30 0-1 Referente al campo GET008
GDE GET010 dDirEnt Dirección del local dela entrega GET001 A 1-255 0-1 Obligatorio si GET003=1
GDE GET011 dNumCas Número de casa del
local de la entrega
GET001 N 1-6 0-1 Obligatorio si GET003=1
GDE GET012 dCompDir1Complemento dedirección del local de
la entrega
GET001 A 1-255 0-1 Opcional si GET003=1
GDE GET013 dNomChof Nombre y apellido del
chofer
GET001 A 4-60 1-1 Obligatorio si GET003=2
GDE GET014 dNumIDChof Número de documento
de identidad del chofer
GET001 A 1-20 0-1 Obligatorio si GET003=2
GDE GET015 iNatTrans Naturaleza del
transportista
GET001 N 1 0-1Obligatorio si GET003=31= Contribuyente
2= No contribuyente
GDE GET016 dRucTrans RUC del transportista GET001 A 3-8 0-1 Obligatorio si GET015 = 1
No informar si GET015 ≠ 1
GDE GET017 dDVTrans Dígito verificador del
RUC del transportista
GET001 N 1 0-1Obligatorio si GET015 = 1No informar si GET015 ≠ 1
septiembre de 2019 132
Grupo ID Campo Descripción Nodo Padre TipoDato Longitud Ocurrencia Observaciones
GDE GET018 dNomTrans Nombre o razón social
del transportista
GET001 A 4-60 0-1 Obligatorio si GET003=3
GDE GET019 iTipIDTransTipo de documento deidentidad del
transportista
GET001 N 1 0-1
Obligatorio si GET015 = 2
No informar si GET015 = 1
1= Cédula paraguaya
2= Pasaporte
3= Cédula extranjera
4= Carnet de residencia
GDE GET020 dDTipIDTrans
Descripción del tipo de
documento de
identidad del
transportista
GET001 A 9-20 0-1
Obligatorio si existe el campo GET019
1= “Cédula paraguaya”
2= “Pasaporte”
3= “Cédula extranjera”
4= “Carnet de residencia”
GDE GET021 dNumIDTransNúmero de documentode identidad del
transportista
GET001 A 1-20 0-1 Obligatorio si existe el campo GET019
GDE GET022 iTipTrans Tipo de transporte GET001 N 1 0-1Obligatorio si GET003=41= Propio
2= Tercero
GDE GET023 dDesTipTrans Descripción del tipo detransporte GET001 A 6-7 0-1 Obligatorio si existe el campo GET022
GDE GET024 iModTrans Modalidad del
transporte
GET001 N 1 0-1
Obligatorio si GET003=4
1=Terrestre
2= Fluvial
3= Aéreo
4= Multimodal
GDE GET025 dDesModTrans
Descripción de la
modalidad del
transporte
GET001 A 5-10 1-1
Referente al campo GET024
1= “Terrestre”
2= “Fluvial”
3= “Aéreo”
4= “Multimodal”
GDE GET026 dTiVehTras Tipo de vehículo GET001 A 4-10 0-1Obligatorio si GET003=4Descripción debe ser acorde con el campo
GET024
septiembre de 2019 133
Grupo ID Campo Descripción Nodo Padre TipoDato Longitud Ocurrencia Observaciones
GDE GET027 dMarVeh Marca del vehículo GET001 A 1-10 0-1 Obligatorio si GET003=4
GDE GET028 dTipIdenVeh Tipo de identificación
del vehículo
GET001 N 1 0-1
Obligatorio si GET003=4
1=Número de identificación del vehículo
2=Número de matrícula del vehículo
GDE GET029 dNroIDVehNúmero deidentificación del
vehículo
GET001 A 1-20 0-1 Debe informarse cuando el GET028=1
GDE GET030 dNroMatVeh Número de matrícula
del vehículo
GET001 A 6 0-1 Debe informarse cuando el GET028=2
11.6. REGLAS DE VALIDACIÓN DE GESTIÓN DE EVENTOS
REFERENCIA ESTADO DE VALIDACIÓN
CÓDIGO DESCRIPCIÓN
A APROBADO
AO APROBADO CON OBSERVACIÓN
R RECHAZADO
Los resultados de rechazo y notificación se detallan en los correspondientes códigos y mensajes de respuesta descriptos en cada Servicio
Web. Las validaciones de firma digital se realizan conforme a lo establecido en las siguientes secciones: Validación del certificado de firma
y Validación de la firma digital.
septiembre de 2019 134
11.6.1. REGLAS DE VALIDACIÓN PARA CANCELACIÓN
N° Val ID Mensaje de la Validación Código Observación E
```
1 GDE005 La versión no corresponde 4000 Versión del formato del evento (GDE005) no corresponde a laversión vigente R
```
2 GEC002 CDC inválido 4001
```
Debe validar que el CDC (GEC002) cuente con los 44 caracteres
```
```
según las reglas de estructuración del CDC (longitud, orden de los
```
```
campos del CDC, formato de la fecha invalida y/o dígito verificador)
```
R
```
3 GEC002a CDC no existente en el SIFEN 4002 El identificador del CDC (GEC002) no se encuentra aprobado comoDTE SIFEN R
```
```
4 GEC002b CDC ya se encuentra con el mismo eventosolicitado 4003 El DTE (GEC002) ya se encuentra con un evento que se estárequiriendo nuevamente (Duplicidad) R
```
5 GEC002c CDC ya se ha confirmado por el receptor 4004
```
Cuando el último evento del receptor sobre un CDC (GEC002) es
```
una confirmación parcial o total, no se permite realizar la
cancelación por parte del emisor
R
7 GDE008 Firmador no autorizado para realizar evento 4006 El RUC del certificado utilizado para firmar los eventos sobre DE yDTE, no corresponde al emisor/electrónico R
```
8 GDE008a Firma Digital inválida por certificado digitalrevocado 4007 El certificado digital que se utilizó para firmar el evento estárevocado en la fecha de firma digital (GDE004) R
```
9 GDE004 Fecha de firma digital del evento inválida 4008 La fecha y hora de firma digital del evento no puede ser posterior ala Fecha y hora de aprobación en el SIFEN R
6 GDE004a Plazo de solicitud de cancelación de una FEextemporáneo 4009
```
Cuando el tipo de documento es Factura electrónica (GEC002
```
```
inicia en 01), la fecha y hora de firma digital del evento (GDE004)
```
de cancelación no puede superar al plazo límite de 48 hs contadas
desde la fecha y hora de aprobación en el SIFEN
R
7 GDE004b Plazo de solicitud de cancelación distinto a unaFE es extemporáneo 4010
Cuando el tipo de documento es Autofactura electrónica o Nota de
```
crédito o Nota de débito o Nota de remisión (GEC002 inicia en 04
```
```
o 05 o 06 o 07), la fecha y hora de firma digital del evento (GDE004)
```
de cancelación no puede superar al plazo límite de 168 hs contadas
desde la fecha y hora de aprobación en el SIFEN
R
septiembre de 2019 135
11.6.2. REGLAS DE VALIDACIÓN PARA INUTILIZACIÓN
N° Val ID Mensaje de la Validación Código Observación E
9 GEI002 Número de timbrado inválido para el ambiente depruebas. 4051 Cuando en ambiente de prueba es obligatorio el uso del timbradode pruebas. R
8 GEI002a Número de timbrado no corresponde alcontribuyente 4052 El número de timbrado no corresponde al RUC del contribuyentefacturador electrónico R
9 GEI002b Número de timbrado no corresponde al medio degeneración 4053 El número del timbrado no corresponde al medio de generaciónpara factura electrónica R
10 GEI003 Código de establecimiento inválido para eltimbrado informado 4054 El código del establecimiento no corresponde a un timbrado delmedio de generación para facturación electrónica R
11 GEI004 El código del punto de expedición es inválidopara el timbrado informado 4055 El código del punto de expedición no corresponde a un timbradoautorizado para el contribuyente R
12 GEI007 Tipo de Documento no corresponde al Númerode Timbrado 4060 El tipo de Documento no corresponde a un número de timbradoautorizado R
13 GEI005 Existe DTE en el rango informado 4065 Para el rango solicitado existe DTE en SIFEN R
14 GEI005a Existe número inutilizado en el rango solicitado 4066 Dentro del rango solicitado para inutilización existen número de DEya inutilizados en SIFENR
```
15 GEI006 Cantidad de números en el rango es inválida 4067 La cantidad máxima de números en el rango debe ser menor o iguala 1000 (GEI006 – GEI005 menor o igual a 1000)R
```
```
16 GEI006a Número final de rango es inválido 4068 El número del final de rango (GEI006) debe ser mayor que elnúmero de inicio del rango (GEI005)R
```
19 GDE008 Firmador no autorizado para realizar evento 4069 El RUC del certificado utilizado para firmar los eventos nocorresponde al emisor/electrónicoR
```
20 GDE008a Firma Digital inválida por certificado digitalrevocado 4070 El certificado digital que se utilizó para firmar el evento estárevocado en la fecha de firma digital (GDE004) R
```
21 GDE004 Fecha de firma digital del evento inválida 4071 La fecha de firma digital del evento no puede ser posterior a laFecha de SIFEN R
septiembre de 2019 136
11.6.3. REGLAS DE VALIDACIÓN PARA NOTIFICACIÓN – RECEPCIÓN DE/DTE
N° Val ID Mensaje de la Validación Código Observación E
1 GEN001
Incongruencia en el registro de eventos del
```
receptor (hay un evento previo de conformidad
```
```
o disconformidad o desconocimiento)
```
4113
No se puede realizar una notificación – recepción de DE luego de
un evento de desconocimiento.
No se puede realizar una notificación – recepción de DTE luego de
un evento de Conformidad parcial o total, Disconformidad o
Desconocimiento
R
2 GEN002b CDC del DTE ya cuenta con un evento de estanaturaleza 4101 Sobre el CDC de un DE/DTE se puede realizar hasta un evento denotificación - recepción R
```
3 GEN002c CDC del DTE inválido 4102 La estructura del CDC informado no corresponde (Longitud y/odígito verificador) R
```
4 GEN003 Fecha de emisión del DE/DTE ha superado elplazo para registro del evento 4103 El plazo del registro del evento ha superado los 45 días contados apartir de la fecha de emisión AO
5 GEN004 Fecha de Recepción debe ser mayor o igual a lafecha de emisión del DE/DTE 4104 La fecha de emisión no puede ser mayor que la fecha de recepcióndel DE/DTE R
```
6 GEN007 Ruc del Receptor requerido 4105 Es obligatorio informar Ruc del receptor cuando el tipo de receptores Contribuyente (GEN005=1) R
```
```
7 GEN007a Ruc del Receptor no se debe informar 4106 Cuando el tipo de receptor es No Contribuyente (GEN005=2) no sedebe informar el campo Ruc del Receptor (GEN007) R
```
```
8 GEN008 Dígito verificador del RUC del contribuyentereceptor requerido 4107 Es obligatorio informar DV del receptor cuando el tipo de receptores Contribuyente (GEN005=1) R
```
9 GEN008a Dígito verificador del RUC del contribuyentereceptor no se debe informar 4108
```
Cuando el tipo de receptor es No Contribuyente (GEN005=2) no se
```
debe informar el campo Dígito verificador del RUC del contribuyente
```
receptor (GEN008)
```
R
```
10 GEN009 Tipo de documento de identidad del receptorrequerido 4109 Es obligatorio informar Tipo de documento de identidad del receptorcuando el tipo de receptor es No contribuyente (GEN005=2) R
```
septiembre de 2019 137
N° Val ID Mensaje de la Validación Código Observación E
11 GEN009a Tipo de documento de identidad del receptor nose debe informar 4110
Cuando el Tipo de documento de identidad del receptor
```
Contribuyente (GEN005=1) no se debe informar el tipo de
```
```
documento de identidad del receptor (GEN009a)
```
R
```
12 GEN010 Número de documento de identidad requerido 4111 Es obligatorio informar Número de documento de identidad cuandoel tipo de receptor es No contribuyente (GEN005=2) R
```
13 GEN010a Número de documento de identidad no se debeinformar 4112
Cuando el Tipo de documento de identidad del receptor
```
Contribuyente (GEN005=1) no se debe informar el documento de
```
```
identidad del receptor (GEN010)
```
R
11.6.4. REGLAS DE VALIDACIÓN PARA EL EVENTO CONFORMIDAD
N° Val ID Mensaje de la Validación Código Observación E
14 GCO001
Incongruencia en el registro de eventos del
```
receptor (hay un evento previo de
```
```
desconocimiento)
```
4156 No se puede realizar una conformidad de DE/DTE luego de unevento de desconocimiento R
15 GCO002 CDC del DTE ya cuenta con dos eventos de lamisma naturaleza 4150
Sobre el CDC de un DE/DTE se puede realizar hasta dos eventos
```
de conformidad (conformidad parcial luego una conformidad total,
```
```
en ese orden)
```
R
```
16 GCO002b CDC del DTE inválido 4151 La estructura del CDC informado no corresponde (longitud y/odígito verificador) R
```
septiembre de 2019 138
N° Val ID Mensaje de la Validación Código Observación E
17 GCO002c CDC del DTE es inexistente o ha superado elplazo para registro del evento 4152
Cuando el CDC no se encuentra en la base de datos del SIFEN o
el plazo del registro del evento es inválido:
Regla para plazo inválido:
*Si el primer evento del receptor que se pretende registrar es
conformidad, este no se puede realizar después de 45 días
contados a partir de la fecha de emisión del DTE
*Si no es el primer evento del receptor y el último evento realizado
por el receptor no es una disconformidad, la conformidad no puede
superar los 45 días contados a partir de la fecha de emisión del
DTE.
*Si no es el primer evento del receptor y el último evento realizado
por el receptor es una disconformidad, entonces la conformidad
```
(evento correctivo) no puede superar los 15 días contados a partir
```
de la fecha de realización del evento de disconformidad
R
18 GCO002e
No se puede registrar la confirmación por CDC
del DTE cancelado o ajustado en su totalidad
por nota de crédito
4155 El CDC del DTE ya ha sido cancelado con anterioridad R
19 GCO004 Fecha estimada de Recepción requerida 4154
```
Cuando el Tipo de Conformidad es parcial (GCO003=2) es
```
obligatorio informar el campo fecha estimada de recepción de la
```
mercadería (GCO004)
```
R
11.6.5. REGLAS DE VALIDACIÓN PARA EL EVENTO DISCONFORMIDAD
N° Val ID Mensaje de la Validación Código Observación E
20 GDI001
Incongruencia en el registro de eventos del
```
receptor (hay un evento previo de
```
```
desconocimiento)
```
4205 No se puede realizar una conformidad de DE/DTE luego de unevento de desconocimiento R
21 GDI002 CDC del DTE ya cuenta con un evento de estanaturaleza 4200 Sobre el CDC de un DTE se puede realizar hasta un evento dedisconformidad R
septiembre de 2019 139
N° Val ID Mensaje de la Validación Código Observación E
```
22 GDI002b CDC del DTE inválido 4201 La estructura del CDC informado no corresponde (longitud y/odígito verificador) R
```
23 GDI002c CDC inexistente o ha superado el plazo pararegistro del evento 4202
Cuando el CDC no se encuentra en la base de datos del SIFEN o
el plazo del registro del evento es inválido:
Regla para plazo inválido:
*Si el primer evento del receptor que se pretende registrar es
disconformidad, este no se puede realizar después de 45 días
contados a partir de la fecha de emisión del DTE
*Si no es el primer evento del receptor y el último evento realizado
por el receptor no es una conformidad, la disconformidad no puede
superar los 45 días contados a partir de la fecha de emisión del
DTE.
*Si no es el primer evento del receptor y el último evento realizado
por el receptor es una conformidad, entonces la disconformidad
```
(evento correctivo) no puede superar los 15 días contados a partir
```
de la fecha de realización del evento de conformidad
R
24 GDI002e No se puede registrar la disconformidad por CDCdel DTE cancelado 4204 El CDC del DTE ya ha sido cancelado con anterioridad R
11.6.6. REGLAS DE VALIDACIÓN PARA EL EVENTO DESCONOCIMIENTO DE/DTE
N° Val ID Resultado de la Validación Código Observación E
25 GED002b CDC del DTE ya cuenta con un evento de estanaturaleza 4251 Sobre el CDC de un DTE se puede realizar hasta un evento dedesconocimiento R
```
26 GED002c CDC del DTE inválido 4252 La estructura del CDC informado no corresponde (longitud y/o dígitoverificador) R
```
septiembre de 2019 140
N° Val ID Resultado de la Validación Código Observación E
27 GED003 Fecha de emisión del DE/DTE ha superado elplazo para registro del evento 4253 El plazo del registro del evento ha superado los 45 días contados apartir de la fecha de emisión AO
28 GED004 Fecha de Recepción debe ser mayor a la fechade emisión del DE/DTE 4254 La fecha de emisión no puede ser mayor que la fecha de recepcióndel DE/DTE R
```
29 GED007 Ruc del Receptor requerido 4255 Es obligatorio informar Ruc del receptor cuando el receptor escontribuyente (GED005=1) R
```
```
30 GEN007a Ruc del Receptor no se debe informar 4256 Cuando el tipo de receptor es No Contribuyente (GED005=2) no sedebe informar el campo Ruc del Receptor (GED007) R
```
31 GED008
Dígito verificador del RUC del contribuyente
```
receptor requerido 4257 Es obligatorio informar DV del receptor cuando el receptor escontribuyente (GED005=1) R
```
32 GEN008a
Dígito verificador del RUC del contribuyente
receptor no se debe informar 4258
```
Cuando el tipo de receptor es No Contribuyente (GED005=2) no se
```
debe informar el campo Dígito verificador del RUC del contribuyente
```
receptor (GED008)
```
R
33 GED009 Tipo de documento de identidad del receptorrequerido 4259
Es obligatorio informar el tipo de documento de identidad del
receptor cuando el tipo de receptor es No contribuyente
```
(GED005=2)
```
R
34 GED009a Tipo de documento de identidad del receptorno se debe informar 4260
```
Cuando el Tipo de Receptor es Contribuyente (GED005=1) no es
```
necesario informar el tipo de documento de identidad del receptor
```
(GED009)
```
R
35 GED010 Número de documento de identidad requerido 4261
Es obligatorio informar el número de documento de identidad del
receptor cuando el tipo de receptor es No contribuyente
```
(GED005=2)
```
R
36 GED10a
Número de documento de identidad no se debe
informar 4262
```
Cuando el Tipo de Receptor es Contribuyente (GED005=1) no es
```
necesario informar el número de documento de identidad del
```
receptor (GED010a)
```
R
septiembre de 2019 141
11.6.7. REGLAS DE VALIDACIÓN PARA EL EVENTO POR ACTUALIZACIÓN DE DATOS: DATOS DEL TRANSPORTE
N° Val ID Mensaje de la Validación Código Observación E
```
1 GET004 El Departamento, el Distrito y la Ciudad del localde entrega no están relacionados 4300 Debe haber relación entre el departamento (GET004), el distrito(GET006) y la ciudad (GET008) R
```
2 GET004a
Código del departamento del local de la entrega
requerido para el motivo Cambio del local de la
entrega
```
4301 Cuando el motivo del evento es Cambio del local de la entrega(GET003=1), es obligatorio informar el código del departamento del
```
```
local de la entrega (GET004)
```
R
3 GET005 Descripción del departamento del local de laentrega es requerida4302
Cuando se informa el código del departamento del local de la
```
entrega (GET004), es obligatorio informar la descripción del
```
```
departamento del local de la entrega (GET005)
```
R
4 GET005a Descripción del departamento del local de laentrega no corresponde al código4303 Descripción del departamento del local de la entrega no coincidentecon lo informado en el campo GET004 R
5 GET007 Descripción del distrito del local de la entrega esrequerida4304
Cuando se informa el código del distrito del local de la entrega
```
(GET006), es obligatorio informar la descripción del distrito del local
```
```
de la entrega (GET007)
```
R
6 GET007a Descripción del distrito del local de la entrega nocorresponde al código4305 Descripción del distrito del local de entrega no coincidente con loinformado en el campo GET006 R
7 GET008
Código de la ciudad del local de la entrega
requerido para el motivo Cambio del local de la
entrega
```
4306 Cuando el motivo del evento es Cambio del local de la entrega(GET003=1), es obligatorio informar el código de la ciudad del local
```
```
de la entrega (GET004)
```
R
8 GET009 Descripción de la ciudad del local de la entregaes requerida4307
Cuando se informa el código de la ciudad del local de la entrega
```
(GET008), es obligatorio informar la descripción de la ciudad del
```
```
local de la entrega (GET009)
```
R
9 GET009a Descripción de la ciudad del local de la entregano corresponde al código4308 Descripción de la ciudad del local de la entrega no coincidente conlo informado en el campo GET008 R
10 GET010 Dirección del local de la entrega requerida parael motivo Cambio del local de la entrega4309
Cuando el motivo del evento es Cambio del local de la entrega
```
(GET003=1), es obligatorio informar la dirección del local de la
```
```
entrega (GET010)
```
R
septiembre de 2019 142
N° Val ID Mensaje de la Validación Código Observación E
11 GET011
Número de casa del local de la entrega
requerido para el motivo Cambio del local de la
entrega
```
4310 Cuando el motivo del evento es Cambio del local de la entrega(GET003=1), es obligatorio informar el número de casa del local de
```
```
la entrega (GET011)
```
R
12 GET013 Nombre y apellido del chofer requerido para elmotivo Cambio del chofer4311
```
Cuando el motivo del evento es Cambio del chofer (GET003=2), es
```
```
obligatorio informar el nombre y apellido del chofer (GET013) R
```
13 GET014 Número de documento de identidad del choferrequerido para el motivo Cambio del chofer4312
```
Cuando el motivo del evento es Cambio del chofer (GET003=2), es
```
obligatorio informar el número de documento de identidad del
```
chofer (GET014)
```
R
14 GET015 Naturaleza del transportista requerida para elmotivo Cambio del transportista 4313
Cuando el motivo del evento es Cambio del transportista
```
(GET003=3), es obligatorio informar la naturaleza del transportista
```
```
(GET015)
```
R
15 GET016 RUC del transportista no informado 4314 Se requiere informar el número de RUC si la naturaleza del
```
transportista es igual a contribuyente (GET015 = 1) R
```
16 GET016a RUC del transportista inexistente 4315 El RUC del transportista informado no existe en la base de datos
de Marangatu R
17 GET016b El RUC del transportista se encuentra inactivo 4316 El RUC del transportista debe contar con un estado distinto aCANCELADO, CANCELADO DEFINITIVO o SUSPENSIÓN
TEMPORAL en Marangatu al momento de la emisión del DE
R
```
18 GET016c RUC del transportista no requerido 4317 Si la naturaleza del transportista es distinta a contribuyente(GET015 ≠ 1) el RUC del transportista (GET016) no debe ser
```
informado
R
19 GET017 Dígito Verificador del RUC del transportista
incorrecto
```
4318 El Dígito Verificador ingresado (GET017) no corresponde al módulo
```
```
11 del RUC (GET016) R
```
20 GET018 Nombre o razón social del transportista es
requerido para el motivo del evento
```
4319 Cuando el motivo del evento es cambio del transportista(GET003=3), es obligatorio informar el nombre o razón social del
```
```
transportista (GET018)
```
R
21 GET019 Tipo de documento de identidad del
transportista no informado
```
4320 Se requiere informar el tipo de documento de identidad si lanaturaleza del transportista es igual a NO contribuyente (GET015
```
```
=2)
```
R
septiembre de 2019 143
N° Val ID Mensaje de la Validación Código Observación E
22 GET019a Tipo de documento de identidad del
transportista no requerido
```
4321 Si la naturaleza del transportista es igual a contribuyente (GET015=1) el tipo de documento de identidad del transportista (GET019)
```
no debe ser informado
R
23 GET020 Descripción del tipo de documento de identidad
del transportista no informada
```
4322 Si se informa el código de tipo de documento de identidad deltransportista (GET019), es obligatorio indicar la descripción del
```
```
mismo (GET020)
```
R
24 GET020a Descripción del tipo de documento de identidad
del transportista no corresponde al código
4323 Descripción del tipo de documento de identidad del transportista
```
(GET020) no coincidente con lo informado en el campo GET019 R
```
25 GET021 Número de documento de identidad del
transportista no informado
```
4324 Si se informa el código de tipo de documento de identidad deltransportista (GET019), el número de dicho documento es
```
```
requerido (GET020)
```
R
26 GET022 Tipo de transporte requerido para el motivo
Cambio de vehículo 4313
```
Cuando el motivo del evento es cambio de vehículo (GET003=4),
```
```
es obligatorio informar el tipo de transporte (GET022) R
```
```
27 GET023 Descripción del tipo de transporte es requerida 4314 Cuando se informa el código de tipo de transporte (GET022), esobligatorio informar la descripción del tipo de transporte (GET023) R
```
28 GET023a Descripción del tipo de transporte no
corresponde al código
4315 Descripción del tipo de transporte no coincidente con lo informado
en el campo GET022 R
29 GET024 Modalidad del transporte requerido para el
motivo Cambio de vehículo
```
4316 Cuando el motivo del evento es cambio de vehículo (GET003=4),
```
```
es obligatorio informar la modalidad del transporte (GET024) R
```
30 GET025 Descripción de la modalidad del transporte es
requerida
```
4317 Cuando se informa el código de la modalidad del transporte(GET024), es obligatorio informar la descripción de la modalidad del
```
```
transporte (GET025)
```
R
31 GET025a Descripción de la modalidad del transporte no
corresponde al código
4318 Descripción de la modalidad del transporte no coincidente con lo
informado en el campo GET024 R
```
32 GET026 Tipo de vehículo requerido para el motivoCambio de vehículo4319 Cuando el motivo del evento es cambio de vehículo (GET003=4),es obligatorio informar el tipo de vehículo (GET026) R
```
33 GET027 Marca del vehículo requerida para el motivo
Cambio de vehículo
```
4320 Cuando el motivo del evento es cambio de vehículo (GET003=4),
```
```
es obligatorio informar la marca del vehículo (GET027) R
```
septiembre de 2019 144
N° Val ID Mensaje de la Validación Código Observación E
34 GET028 Tipo de identificación del vehículo requerido
para el motivo Cambio de vehículo
```
4321 Cuando el motivo del evento es cambio de vehículo (GET003=4),es obligatorio informar el tipo de identificación del vehículo
```
```
(GET028)
```
R
35 GET029 Tipo de identificación del vehículo no informado 4322 Se requiere el número de identificación del vehículo cuando el tipo
```
de identificación del vehículo es 1 (GET028=1) R
```
36 GET030 Número de matrícula del vehículo no informado 4323 Se requiere número de matrícula del vehículo cuando el tipo de
```
identificación del vehículo es 2 (GET028=2) R
```
12. Validaciones
El SIFEN realizará validaciones en varios niveles, desde la conexión vía Web Services hasta el
contenido de los mensajes de respuesta, especialmente de los campos informados en los
```
documentos electrónicos (DE).
```
```
Validaciones: Es el proceso de confirmar que los valores que se especifican en los objetos de datos,
```
en este caso en el archivo XML de un DE, son compatibles con las restricciones dentro de un
esquema del conjunto de datos, al igual que las reglas establecidas para su aplicación.
Las reglas de validación verifican que los datos que un usuario ingresa en un registro o en un
documento electrónico cumplen con las normas específicas y establecidas antes de que el usuario
guarde el registro. Una regla de validación puede contener una fórmula o expresión que evalúa los
datos en uno o más campos y ofrece un valor Verdadero o Falso.
Web Services: Es un conjunto de protocolos y estándares que sirve para intercambiar datos entre
aplicaciones.
```
DE: Documento Electrónico (Factura Electrónica, Factura Electrónica de Exportación, Factura
```
Electrónica de Importación, Nota de Crédito Electrónica, Nota de Debito Electrónica, Autofactura
```
Electrónica, Nota de Remisión Electrónica) generados por el sistema de facturación de un emisor
```
electrónico autorizado o desde el programa gratuito proveído por la Administración Tributaria.
```
DTE: Corresponde a la conversión de un DE que ha superado satisfactoriamente o exitosamente
```
todas las validaciones establecidas para efecto, que se encuentra almacenado en el SIFEN y por ende
puede ser utilizado como respaldo documental para fines tributarios, comerciales, contables y
jurídicos.
Las validaciones pueden tener uno de tres resultados:
```
• (DTE) APROBADO (A): Mensaje por el cual se comunica que un documento electrónico (DE)
```
ha superado satisfactoriamente o con éxito todas las validaciones establecidas, se
mencionará el primer error detectado.
```
• (DTE) APROBADO CON OBSERVACIONES (AO): Mensaje por el cual se comunica que un
```
```
documento electrónico (DE) ha superado satisfactoriamente o con éxito todas las
```
validaciones establecidas, consiguiendo así la aprobación para convertirse en un
```
Documento Tributario Electrónico (DTE); sin embargo, posee observaciones (Ejemplo:
```
```
extemporaneidad)
```
```
• (DE) RECHAZADO (R): Mensaje por el cual se comunica que el DE transmitido no cumple
```
con las validaciones establecidas, mencionándose el primer error identificado que impide
su procesamiento para convertirse en un DTE.
septiembre de 2019 146
GUIA DE REGLAS DE VALIDACIÓN
N° VAL Corresponde a la cantidad de reglas de validación
ID Corresponde a la identificación de los campos de los DE
Mensaje de
Validación
Corresponde a las respuestas de la verificación de los campos de
los DE
Código Correspondiente al número de respuesta de la validación
Observación Corresponde a la descripción de las reglas de validación
E Estado de la validación
V Versión del XML
REFERENCIA ESTADO DE VALIDACIÓN
CÓDIGO DESCRIPCIÓN
A APROBADO
AO APROBADO CON OBSERVACIONES
R RECHAZADO
Los resultados de rechazo y notificación se detallan en los correspondientes mensajes de respuesta
descriptos en cada Servicio Web.
12.1. Estructura de los códigos de validación
Los códigos de incumplimiento de las validaciones están compuestos de 4 dígitos numéricos, que
corresponden a los campos de los Schemas XML, siguiendo el orden dispuesto en las tablas y
secciones siguientes.
Las tablas de validación presentan en las columnas Estado el resultado correspondiente al error:
```
Aprobado (A), Rechazo (R), Aprobado con observaciones (AO).
```
septiembre de 2019 147
12.1.1. Códigos de respuestas de las validaciones de los Servicios Web
Inicio
ID
Inicio
código de
respuesta
Fin ID Fin código
de
respuesta
Tipo de Regla de Validación Apartado
```
AA01 0000 0099 AA100 Certificado de Transmisión (Protocolo TLS)
```
AB01 0100 AB20 0119 Forma del área de datos de los mensajes deentrada de los WS
AC01 0120 AC20 0139 Certificado digital utilizado por el contribuyentepara firmar
AD01 0140 AD20 0159 Firma digital
AE01 0160 AE20 0179 Validaciones genéricas sobre los mensajes deentrada de los WS
AF01 0180 AR20 0199 Validaciones genéricas sobre los mensajes decontrol de llamada de los WS
BA01 0200 BA20 0219 Mensaje de entrada del WS SiRecepDE
BB01 0220 BB20 0239 Información de control de la llamada al WSSiRecepDE
BC01 0260 BC20 0259 Área de datos del WS SiRecepDE
BD01 0270 BD20 0279 Mensaje de entrada del WS SiRecepLoteDE
BE01 0280 BE20 0299 Información de control de la llamada al WSSiRecepLoteDE
BF01 0300 BF20 0319 Área de datos del WS SiRecepLoteDE
BG01 0320 BG20 0339 Mensaje de entrada del WS SiResultLoteDE
BH01 0340 BH20 0359 Información de control de la llamada al WSSiResultLoteDE
BI01 0360 BI20 0379 Área de datos del WS SiResultLoteDE
BJ01 0380 BJ20 0399 Mensaje de entrada del WS SiConsDE
BK01 0400 BK20 0419 Información de control de la llamada al WSSiConsDE
BL01 0420 BL20 0439 Área de datos del WS SiConsDE
BM01 0460 BM20 0479 Mensaje de entrada del WS siConsRUC
BN01 0480 BN20 0499 Información de control de la llamada al WSsiConsRUC
BO01 0500 BO20 0559 Área de datos del WS siConsRUC
BS01 0560 BS20 0579 Mensaje de entrada del WS SiRecepEvento
BT01 0580 BT20 0599 Información de control de la llamada al WSSiRecepEvento
BU01 0600 BU20 0619 Área de datos del WS SiRecepEvento
septiembre de 2019 148
12.1.2. Códigos de respuestas de las validaciones de los DE
Inicio
ID
Inicio
código de
respuesta
Fin ID Fin código
de
respuesta
Tipo de Regla de Validación Grupo decampos
```
A002 1000 A004b 1049 Campos firmados del Documento Electrónico (A001-A099)
```
B002 1050 B003 1099
Campos inherentes a la operación comercial de
```
los Documentos Electrónicos (B001 -B099)
```
```
C003 1100 C009 1149 Campos de datos del Timbrado (C001 -C099)
```
```
D002 1150 D002e 1199 Campos generales del Documento Electrónico (D001 –D299)
```
```
D010 1200 D020 1249 Campos inherentes a la operación comercial (D010-D099)
```
```
D101 1250 D116 1299 Campos que identifican al emisor delDocumento Electrónico(D100 -D129)
```
```
D130 1261 D132 1262 Campos que describen la actividad económicadel emisor(D130 -D139)
```
```
D201 1300 D224 1349 Datos que identifican al receptor del DocumentoElectrónico DE(D200 -D299)
```
E010 1350 E012 1399 Campos que componen la Factura ElectrónicaFE
```
(E010-
```
```
E099)
```
```
E020 1400 E025 1449 Campos de informaciones de Compras Públicas (E020-E029)
```
```
E300 2550 E322 2561 Campos que componen la AutofacturaElectrónica AFE(E300-E399)
```
```
E400 1450 E402 1499 Campos que componen la Nota Crédito/DébitoElectrónica NCE - NDE(E400-E499)
```
```
E500 2600 E506 2650 Campos que componen la Nota de RemisiónElectrónica(E500-E599)
```
```
E600 1500 E602 1549 Campos que describen la condición de laoperación(E600–E699)
```
E605 1550 E611a 1599
Campos que describan la forma de pago de la
operación al contado o del monto de la entrega
inicial
```
(E605-
```
```
E619)
```
E620 1600 E624 1649
Campos que describen el pago de la operación
```
con tarjeta de crédito/débito (E620-E629
```
E630 1650 E630a 1699
Campos que describen el pago o entrega inicial
```
de la operación en cheque (E630-E639)
```
```
E640 1700 E644a 1749 Campos que describen la operación a crédito (E640-E649)
```
septiembre de 2019 149
Inicio
ID
Inicio
código de
respuesta
Fin ID Fin código
de
respuesta
Tipo de Regla de Validación Grupo decampos
```
E650 1750 E650a 1799 Campos que describen las cuotas (E650-E659)
```
```
E704 1800 E717 1849 Campos que describen los ítems de la operación (E700-E899)
```
```
E720 1850 E727 1899 Campos que describen el precio, tipo de cambioy valor total de la operación por ítem(E720-E729)
```
```
EA003 1852 EA050 1862 Campos que describen los descuentos,anticipos y valor total por ítem(EA001-EA050)
```
```
E730 1900 E736a 1999 Campos que describen el IVA de la operación (E730-E739)
```
```
E740 2000 E745 2049 Campos que describen el ISC de la operación (E740-E749)
```
```
E822 2050 E824 2099 Campos de datos adicionales de uso comercial (E820-E829)
```
E900 2100 E912a 2149
Campos que describen el transporte de las
```
mercaderías (E900-E999)
```
```
E920 2150 E930 2199 Campos que identifican el local de salida de lasmercaderías(E920-E939)
```
E940 2200 E950 2249
Campos que identifican el local de entrega de las
```
mercaderías (E940-E959)
```
```
E960 2250 E966a 2299 Campos que identifican el vehículo de trasladode mercaderías(E960-E979)
```
```
E980 2300 E989a 2349 Campos que identifican al transportista (personafísica o jurídica)(E980-E999)
```
```
F001 2350 F023b 2399 Campos que describen los subtotales y totalesde la transacción documentada(F001-F099)
```
```
G050 2390 G050 2399 Campos generales de la carga (G050 -G099)
```
H001 2400 H017a 2449 Campos que identifican al documento asociado
```
(H001-
```
```
H049)
```
```
I002 2450 I002 2459 Información de la Firma Digital del DTE (I001-I049)
```
```
J002 2500 J003 2599 Campos fuera de la Firma Digital (J001-J049)
```
septiembre de 2019 150
12.1.3. Códigos de respuestas de las validaciones de los eventos
Inicio
ID
Inicio
código de
respuesta
Fin ID Fin código
de
respuesta
Tipo de Regla de Validación Apartado
GEC0
02
GDE0
04
4000
GEC00
2c
GDE00
8a
4049 Registro del evento cancelación de factura
GEI00
2 4050
GEI00
6a 4099 Registro del evento Inutilización
GEN0
01 4100
GEN01
0a 4113
Registro del evento de Notificación – Recepción
DE/DTE
GCO0
01 4150
GCO0
04 4156 Registro del evento de Conformidad
GDI00
1 4200
GDI00
2e 4205 Registro del evento de Disconformidad
GED0
02b 4250
GED10
a 4262 Registro del evento de Desconocimiento
GET00
4 4300
GET03
0 4323
Reglas de validación para el evento por
actualización de datos: datos del transporte
12.2. Codificación de respuestas de los Servicios WEB del SIFEN
Los códigos de respuesta devueltos por los WS están conformados de la siguiente forma:
Campo ID en las tablas de reglas de validación identifica a un código de validación de dos letras,
conforme la secuencia AA, AB, AC,...las cuales a su vez corresponden a un tipo de validación
específico.
También existen validaciones genéricas aplicadas a más de un documento electrónico, así como a
un WS o a todos los documentos o WS.
12.2.1. Validaciones del certificado de transmisión. Protocolo TLS
ID Resultado de validación Código Observación E
AA01 Certificado de TransmisorInválido 0001
Certificado de Transmisor inexistente en el
mensaje
RVersión incorrecta
No se aceptan certificados de la AC
ExtendKeyUsage no define “ClientAuth“
AA02 Plazo de validez del Certificadodigital 0002 R
septiembre de 2019 151
ID Resultado de validación Código Observación E
AA03 Cadena de Certificación 0003
Certificado del emisor no corresponde a un PSC
habilitado en el país
RCertificado del PSC revocado
Certificado no firmado por el PSC emisor del
Certificado
AA04 LCR del Certificado Transmisor 0004
```
No existe la dirección de la LCR (CRL
```
```
DistributionPoint)
```
RLCR indisponible
LCR invalida
AA05 Certificado del transmisorrevocado 0005 R
AA06 Certificado Raíz no pertenece alMIC 0006 R
AA07 No existe la extensión del RUCdel emisor en el certificado 0007
Si el Certificado es de persona jurídica, el RUC
debe estar informado en el campo SerialNumber
en caso de ser del tipo de Persona Física el RUC,
estará informado en el campo:
SubjectAlternativeName
R
Aclaramos que las validaciones AA01 a AA05 son realizadas por el propio protocolo TLS
12.2.2. Validación de la estructura XML de los WS
La información es enviada y recibida por medio de los WS, utilizando mensajes en formato XML
definido para cada uno de los servicios.
Las actualizaciones de formato, así como estructura en los XML son controlados por medio del
versionado del archivo.
La validación de la estructura del archivo XML es realizada por medio de un analizador sintáctico
que verifica si el mensaje está estructurado de acuerdo a las definiciones y reglas de su Schema
XML. La primera validación realizada es la correspondencia entre el mensaje y su Schema.
El emisor debe generar los mensajes XML en el formato correspondiente a la versión vigente,
informando ésta en el campo de versión dentro del grupo rDE
septiembre de 2019 152
El emisor debe validar los archivos XML contra el Schema XSD correspondiente, con el fin de
garantizar la integridad y el formato de estos, antes de su trasmisión al SIFEN.
12.2.3. Validación de forma del área de datos del Request
El área de datos correspondiente al mensaje de entrada de los WS tiene las siguientes validaciones.
ID Resultado de validación Código Obs. E V
AB01 Fallo de schema XML del área de datos 0100 R 150
AB02 Fallo de schema: no existe el campo raíz esperado para el mensaje 0101 R 150
AB03 Fallo de schema: no existe el atributo versión para el campo raízesperado para el mensaje 0102 R 150
AB05 Existe algún namespace diferente del namespace estándar del DE 0104 R 150
```
AB06 Existe(n) carácter(es) de edición en el inicio o en el final del mensaje, oentre los campos XML 0105 R 150
```
AB07 Utilizado prefijo en el namespace 0106 R 150
AB08 Utilizada codificación diferente de UTF-8 0107 R 150
12.2.4. Validación del certificado de firma
ID Resultado de validación Código Observación E
AC01 Certificado inválido 0120
• No existe certificado de firma en el
mensaje
R• No se aceptan certificados del PSC
• KeyUsage no define firma digital y no
Repudio
AC02
Alguna o todas las fechas del certificado
```
(inicio o final de validez del certificado)
```
inválidas
0121 R
AC03 No existe la extensión del RUC en elcertificado 0122
De Persona Física: en el OID,
correspondiente al
SubjectAlternativeName
De Persona Jurídica: en el OID
correspondiente al SerialNumber
R
AC04 Cadena de certificación inválida 0123
• Certificado del PSC no habilitado por el
MIC
R• Certificado del PSC revocado
• Certificado no está firmado por el PSC
```
AC05 0124 • Dirección de la LCR no informada(CRLDistributionPoint) R
```
septiembre de 2019 153
ID Resultado de validación Código Observación E
Problema en la LCR del certificado de
firma
• Error en el acceso a la LCR
• LCR inexistente
AC06 Certificado de firma revocado 0125 R
AC07 Certificado raíz no corresponde al MIC 0126 R
12.2.5. Validación de la firma digital
ID Resultado de validación Código Observación E
AD01 Firma difiere del estándar 0140
• No fue firmado el documento completo
```
(falta Reference URI en la firma)
```
R• Transform Algorithm previsto en la
```
firma (“C14N” y Enveloped) no
```
informado
```
AD02 Valor de la firma (SignatureValue)diferente del calculado por el PKI 0141
```
• Certificado del PSC no habilitado por el
MIC
R
• Certificado del PSC revocado
• Certificado no está firmado por el PSC
• Dirección de la LCR no informada
```
(CRLDistributionPoint)
```
• Error en el acceso a la LCR
• LCR inexistente
• Certificado de firma revocado
• Certificado raíz no corresponde al MIC
AD03 RUC del certificado utilizado para firmarno pertenece al Contribuyente emisor 0142 R
12.2.6. Validaciones genéricas a los mensajes de entrada de los WS
Las presentes validaciones son aplicadas a los mensajes de entrada de cualquiera de los Web
Services dispuestos por la SET
ID Resultado de Validación Código Obs E
AE01 XML malformado 0160 R
AE02 Servidor de procesamiento momentáneamente sinrespuesta 0161 R
AE03 Servidor de procesamiento paralizado, sin tiempo deregreso 0162 R
AE04 Versión del formato del WS no soportada 0163 R
septiembre de 2019 154
12.2.7. Validaciones genéricas a los mensajes de control de llamada de los WS
ID Resultado de Validación Código Obs E
AF01 Elemento deHeaderMsg inexistente en el SOAPHeader 0180 R
AF04
RUC del certificado utilizado en la conexión no
pertenece a un contribuyente activo en la base
de datos de RUC.
0183 R
12.3. Validaciones de cada Web Service
12.3.1. WS recepción documento electrónico – siRecepDE
12.3.1.1. Mensaje de entrada del WS
La primera validación corresponde al tamaño máximo permitido para el mensaje, este no debe
```
superar los (1000 KB). Su verificación es:
```
• En el presente WS se devuelve el mensaje con código 0200.
```
• En la configuración de red (firewall), en el caso que la conexión sea interrumpida sin la
```
generación del mensaje de error con el código 0200.
ID Resultado de la Validación Código Obs E
BA01 Mensaje de datos de entrada del WSsiRecepDE superior a 1000 KB 0200 R
12.3.1.2. Información de control de la llamada al WS
No se realizan validaciones específicas para este método en la versión inicial 100, sin embargo,
reservamos los códigos desde el 0220 al 0239 y las correspondientes identificaciones BB01 a BB20.
12.3.1.3. Área de datos del WS
ID Resultado de la Validación Código Obs E
BC01 Autorización del DE satisfactoria 0260 N
septiembre de 2019 155
12.3.2. WS recepción lote DE – siRecepLoteDE
12.3.2.1. Mensaje de entrada del WS
La primera validación corresponde al tamaño máximo permitido para el mensaje de Web Service de
```
lote, este no debe superar los (10.000 KB). Su verificación es:
```
• En el presente WS se devuelve el mensaje con código 0270.
```
• En la configuración de red (firewall), en el caso que la conexión sea interrumpida sin la
```
generación del mensaje de error con el código 0270.
ID Resultado de la Validación Código Obs E
BD01 Mensaje de datos de entrada del WSsiRecepLoteDE superior a 10.000 KB. 0270 R
12.3.2.2. Información de control de la llamada al WS
No se realizan validaciones específicas para este método en la versión inicial 100, sin embargo,
reservamos los códigos desde el 0280 al 0299 y las correspondientes identificaciones BE01 a BE20.
12.3.2.3. Área de datos del WS
ID Resultado de la Validación Código Obs E
BF01 Lote recibido con éxito 0300 A
BF02 Lote no encolado para procesamiento 0301 R
12.3.3. WS consulta resultado de lote DE – siResultLoteDE
12.3.3.1. Mensaje de entrada del WS
La primera validación corresponde al tamaño máximo permitido para el mensaje de Web Service,
```
este no debe superar los (1000 KB). Su verificación es:
```
• En el presente WS se devuelve el mensaje con código 0320.
```
• En la configuración de red (firewall), en el caso que la conexión sea interrumpida sin la
```
generación del mensaje de error con el código 0320.
ID Resultado de la Validación Código Obs E
septiembre de 2019 156
BG01 Mensaje de datos de entrada del WSsiResultLoteDE superior a 1000 KB. 0320 R
12.3.3.2. Información de control de la llamada al WS
ID Resultado de la Validación Código Obs E
BH01 RUC del certificado de conexión no autorizadoa consultar el lote 0340
El resultado del
procesamiento del lote
solo puede ser
consultado por el RUC
que realizó la
transmisión del mismo.
R
12.3.3.3. Área de datos del WS
ID Resultado de Validación Código Obs E
BI01 Lote inexistente 0360 R
BI02 Lote en procesamiento 0361 R
BI03 Procesamiento de lote concluido 0362 A
B104 Lotes con tipos distintos de DE 0363 R
12.3.4. WS consulta de DE – siConsDE
12.3.4.1. Mensaje de entrada del WS
La primera validación corresponde al tamaño máximo permitido para el mensaje de Web Service,
```
este no debe superar los (1000 KB). Su verificación es:
```
• En el presente WS se devuelve el mensaje con código 0380.
```
• En la configuración de red (firewall), en el caso que la conexión sea interrumpida sin la
```
generación del mensaje de error con el código 0380.
ID Resultado de la Validación Código Obs E
BJ01 Mensaje de datos de entrada del WSsiConsDE superior a 1000 KB. 0380 R
septiembre de 2019 157
12.3.4.2. Información de control de la llamada al WS
No se realizan validaciones específicas para este método en la versión inicial 100, sin embargo,
reservamos los códigos desde el 0400 al 0419 y las correspondientes identificaciones BK00 a BK19.
12.3.4.3. Área de datos del WS
ID Resultado de Validación Código Obs E
BL01 CDC inexistente 0420
BL02 CDC Encontrado 0421
12.3.5. WS consulta de RUC – siConsRUC
12.3.5.1. Mensaje de entrada del WS
La primera validación corresponde al tamaño máximo permitido para el mensaje de Web Service,
```
este no debe superar los (1000 KB). Su verificación es:
```
• En el presente WS se devuelve el mensaje con código 0460.
```
• En la configuración de red (firewall), en el caso que la conexión sea interrumpida sin la
```
generación del mensaje de error con el código 0380.
ID Resultado de la Validación Código Obs E
BM01 Mensaje de datos de entrada del WSsiConsRUC superior a 1000 KB. 0460 R
12.3.5.2. Información de control de la llamada al WS
No se realizan validaciones específicas para este método en la versión inicial 100, sin embargo,
reservamos los códigos desde el 0480 al 0499 y las correspondientes identificaciones BN01 a BN20.
12.3.5.3. Área de datos del WS
ID Resultado de Validación Código Obs E
BO01 RUC inexistente 0500
BO02 RUC no tiene permiso para utilizar el WS 0501
septiembre de 2019 158
BO03 Éxito en la consulta 0502
12.3.6. WS recepción de evento – siRecepEvento
12.3.6.1. Mensaje de entrada del WS
La primera validación corresponde al tamaño máximo permitido para el mensaje de Web Service,
```
este no debe superar los (1000 KB). Su verificación es:
```
• En el presente WS se devuelve el mensaje con código 0560.
```
• En la configuración de red (firewall), en el caso que la conexión sea interrumpida sin la
```
generación del mensaje de error con el código 0560.
ID Resultado de la Validación Código Obs E
BS01 Mensaje de datos de entrada del WSsiRecepEvento superior a 1000 KB. 0560 R
12.3.6.2. Información de control de la llamada al WS
No se realizan validaciones específicas para este método en la versión inicial 100, sin embargo,
reservamos los códigos desde el 0580 al 0599 y las correspondientes identificaciones BT01 a BT20.
12.3.6.3. Área de datos del WS
ID Resultado de Validación Código Obs E
BU01 Evento registrado correctamente 0600 A
12.4. Validaciones del formato
A. Campos firmados del Documento Electrónico (A001-A099)
N° Val ID Mensaje de la Validación Código Observación E
1 A002 CDC no correspondiente con las informacionesdel XML 1000
El CDC no es compatible con las informaciones de los campos del
```
XML (C002, D101, D102, C005, C006, C007, D103, D002, B002,
```
```
B004, A003)
```
R
2 A002a CDC duplicado 1001 Ya fue autorizado otro documento con coincidencia simultánea decontenido de los campos del CDC R
3 A002b Documento electrónico duplicado 1002
Ya fue autorizado otro documento con coincidencia simultánea de
contenido de los campos del Timbrado:
```
1) Tipo de documento (C002)
```
```
2) Número de Timbrado (C004)
```
```
3) Número de documento (C007)
```
```
4) Tipo de emisión (B002)
```
```
5) Establecimiento (C005)
```
```
6) Punto de Expedición (C006)
```
```
7) Serie (C010) Si se informa
```
R
4 A003 DV del CDC inválido 1003 Valor incorrecto del dígito verificador informado según algoritmomódulo 11 R
5 A004a La fecha y hora de la firma digital es adelantada 1004 La fecha y hora de la firma digital no debe ser posterior a la fecha yhora de SIFEN R
6 A004b Transmisión extemporánea del DE 1005
La transmisión del DE no debe exceder el tiempo de validación
posterior parametrizado para el contribuyente, tomando como
```
referencia la fecha y hora de la Firma Digital (A004)
```
La SET podrá aplicar la sanción conforme a lo dispuesto en la
reglamentación.
```
Aprobado con observaciones (Extemporaneidad)
```
AO
septiembre de 2019 160
B. Campos inherentes a la operación comercial de los Documentos Electrónicos (B001 -B099)
N° Val ID Mensaje de la Validación Código Observación E
```
7 B002 Tipo de emisión inválido en esta etapa 1050 El tipo de emisión en contingencia (B002=2) no permitida en estaetapa R
```
8 B003 Descripción del tipo de emisión no correspondeal código 1051 Descripción del tipo de emisión no coincidente a lo informado en elcampo B002 R
C. Campos de datos del Timbrado (C001 - C099)
N° Val ID Mensaje de la Validación Código Observación E
9 C003 Descripción del tipo de documento electrónico nocorresponde al código 1100 Descripción del tipo de documento electrónico no coincidente a loinformado en el campo C002 R
10 C004 Número de timbrado inválido 1101 Número de timbrado no corresponde al RUC ni al Tipo deDocumento electrónico del contribuyente emisor R
11 C004a Número de timbrado no corresponde al medio degeneración para facturación electrónica 1102 Medio de generación incorrecto en el sistema de Timbrado deMarangatu R
12 C004b El número de timbrado no se encuentra vigente ala fecha de emisión del comprobante 1103
```
Número de timbrado no vigente (D002 no se encuentre dentro del
```
```
rango de las fechas de inicio y fin de vigencia del timbrado (C008 -
```
```
C009)
```
R
```
13 C004c El número de timbrado informado no se encuentraen estado ACTIVO 1104 El número de timbrado informado no se encuentra activo en la basede datos de timbrado en la fecha de emisión del DE (D002) R
```
14 C005 Código de establecimiento incorrecto 1105 El código de establecimiento no corresponde al timbrado autorizadopara el contribuyente R
15 C006 Código de punto de expedición incorrecto 1106 El código de punto de expedición no corresponde al timbradoautorizado para el contribuyente R
septiembre de 2019 161
N° Val ID Mensaje de la Validación Código Observación E
16 C007 Número de documento ha sido inutilizadoanteriormente 1109 El número de documento que pertenece al número de Timbrado,establecimiento y punto de expedición, se encuentra inutilizado R
17 C008 Fecha de inicio de vigencia del timbradoincorrecta 1107 Fecha de inicio de vigencia del timbrado no corresponde a la fechade inicio de vigencia del timbrado autorizado para el contribuyente R
18 C009 Fecha fin de vigencia del timbrado incorrecta 1108 Fecha fin de vigencia del timbrado no corresponde al timbradoautorizado para el contribuyente R
18 C010 Serie informada incorrecta 1110
Se debe respetar la secuencialidad en el uso de la serie.
```
Ej: AA, AB, AC… AZ…. ZA, …., ZZ), la primera serie a utilizar es la
```
serie AA.
Los siguientes casos no son permitidos:
```
(*) Primera serie distinta a AA
```
```
(*) Serie no es vecina: la serie informada no es vecina a la mayor
```
```
serie informada al SIFEN (serie actual)
```
```
(*) Serie inmediatamente anterior: DE con serie anterior a la mayor
```
serie enviada al SIFEN, cuya fecha y hora de firma digital es
posterior a la fecha de inicio de vigencia de la serie actual en el
sistema.
```
(*) Serie inmediatamente posterior: DE con serie posterior a la
```
mayor serie enviada al SIFEN, cuya fecha y hora de firma digital es
anterior a la fecha de inicio de vigencia de la serie actual en el
sistema.
Referirse a la sección Manejo del timbrado y Numeración para
mayor información
R
septiembre de 2019 162
D. Datos generales del Documento Electrónico (D001 – D299)
N° Val ID Mensaje de la Validación Código Observación E
19 D002 La fecha y hora de emisión del DE informada esinválida por retraso 1150
Cuando la fecha y hora de emisión es anterior a la fecha y hora de
transmisión al SIFEN, la diferencia no debe ser mayor a 720 horas
```
(30 días)
```
R
20 D002f La fecha y hora de emisión del DE informada esinválida por envío adelantado 1151
Cuando la fecha y hora de emisión del DE es posterior a la fecha y
hora de transmisión al SIFEN, la diferencia no debe ser mayor a
```
120 horas (5 días)
```
R
21 D002a Fecha y hora de emisión del DE es anterior a lafecha de lanzamiento del sistema 1156 La fecha y hora de emisión del DE debe ser posterior al 22 denoviembre del 2018 R
```
D1. Campos inherentes a la operación comercial (D010-D099)
```
N° Val ID Mensaje de la Validación Código Observación E
22 D010
Grupo de informaciones inherentes a la operación
comercial es obligatorio informar para el tipo de
documento
1200
El grupo de informaciones inherentes a la operación comercial
```
(D010) es obligatorio informar para todos los tipos de documentos
```
```
electrónicos excepto Nota de Remisión Electrónica (C002=7)
```
R
23 D010a
Grupo de informaciones inherentes a la operación
comercial no es permitido para el tipo de
documento
```
1201 El grupo de informaciones inherentes a la operación comercial(D010) no es permitido para Nota de Remisión Electrónica (C002=7) R
```
24 D011 Tipo de transacción no informado para eldocumento electrónico seleccionado 1202
Es obligatorio informar el tipo de transacción para Factura
Electrónica, Factura electrónica de Exportación, Factura Electrónica
de Importación y Autofactura Electrónica.
Obligatorio si C002 = 1, 2, 3 o 4
R
25 D012 Descripción del tipo de transacción nocorresponde al código 1203 Descripción del tipo de transacción no coincidente con lo informadoen el campo D011 R
28 D013 Tipo de impuesto afectado no informado 1204 Es obligatorio informar el tipo de impuesto afectado para FacturaElectrónica y Autofactura Electrónica. Obligatorio si C002=1 o 4 R
26 D014 La descripción del tipo de impuesto afectado nocorresponde al código 1205 Descripción del tipo de impuesto afectado no coincidente con loinformado en el campo D013 R
septiembre de 2019 163
N° Val ID Mensaje de la Validación Código Observación E
27 D016 Descripción de la moneda de la operación nocorresponde al código 1206 Descripción de la moneda de la operación no coincidente con loinformado en el campo D015 R
```
28 D017 Condición del tipo de cambio no informada 1207 Si la moneda de la operación es distinta a PYG (D015≠PYG), esobligatorio informar la condición del tipo de cambio (D017) R
```
```
29 D017a Condición del tipo de cambio no requerida 1208 Si la moneda de la operación es igual a PYG (D015=PYG), lacondición del tipo de cambio (D017) no debe ser informada R
```
```
30 D018 Tipo de cambio de la operación no informado 1209 Si la condición del tipo de cambio es global (D017=1), es obligatorioinformar el tipo de cambio de la operación (D018) R
```
31 D018a Tipo de cambio de la operación no requerido 1210
```
Si la condición del tipo de cambio es por ítem (D017=2) o la moneda
```
```
de la operación es PYG (D015=PYG), el tipo de
```
```
cambio de la operación (D018) no debe ser informado R
```
32 D020 Descripción de la condición del anticipo nocorresponde al código 1211 Descripción del tipo de la condición del anticipo no coincidente conlo informado en el campo D019 R
```
D2. Datos que identifican al emisor del Documento Electrónico (D100 -D129)
```
N° Val ID Mensaje de la Validación Código Observación E
33 D101 RUC del emisor inexistente 1250 El RUC informado no existe en la base de datos R
34 D101a RUC del Emisor inhabilitado para facturaciónelectrónica 1251 RUC no se encuentra habilitado para facturación electrónica enMarangatu R
35 D101b El RUC del emisor se encuentra inactivo 1252
El RUC del contribuyente debe contar con un estado distinto a
CANCELADO, CANCELADO DEFINITIVO o SUSPENSIÓN
TEMPORAL en Marangatu al momento de la emisión del DE
R
36 D101c RUC del emisor no está habilitado para utilizareste tipo de servicio 1264 RUC del emisor no está habilitado para utilizar el servicio síncrono R
37 D102 Dígito Verificador del RUC del emisor incorrecto 1253 El Dígito Verificador ingresado no corresponde al módulo 11 delRUC R
septiembre de 2019 164
N° Val ID Mensaje de la Validación Código Observación E
38 D105 Nombre o razón social del emisor del DE inválido 1263
Se debe utilizar el siguiente texto para el ambiente de pruebas: "DE
generado en ambiente de prueba - sin valor comercial ni fiscal".
No se debe utilizar el texto "DE generado en ambiente de prueba -
sin valor comercial ni fiscal" para el ambiente de producción.
R
```
39 D111 El Departamento, el Distrito y la Ciudad deemisión no están relacionados 1255 Debe haber relación entre el departamento (D111), el distrito (D113)y la ciudad (D115) R
```
40 D112 Descripción del departamento de emisión nocorresponde al código 1254 Descripción del departamento de emisión no coincidente con loinformado en el campo D111 R
```
44 D114 Es obligatorio indicar la descripción del código dedistrito de emisión 1256 Si se informa el código del distrito de emisión (D113), es obligatorioinformar la descripción del mismo (D114) R
```
41 D114a Descripción del distrito de emisión nocorresponde al código 1257 Descripción del distrito de emisión no coincidente con lo informadoen el campo D113 R
```
43 D115 La ciudad de emisión no corresponde aldepartamento seleccionado 1258 El código de la ciudad de emisión (D115) debe corresponder aldepartamento seleccionado (D111) R
```
44 D115a La ciudad de emisión no corresponde al distritoseleccionado 1259
```
El código de la ciudad de emisión (D115) debe corresponder al
```
```
distrito seleccionado (D113)
```
No se aplica esta regla si no ha sido informado el distrito
R
42 D116 Descripción de la ciudad de emisión nocorresponde al código 1260 Descripción de la ciudad de emisión no coincidente con lo informadoen el campo D115 R
```
D2.1 Campos que describen la actividad económica del emisor (D130-D139)
```
N° Val ID Mensaje de la Validación Código Observación E
43 D131 Código de actividad económica incorrecto 1261 La actividad económica seleccionada no corresponde a lo declaradoen el RUC R
44 D132 Descripción de la actividad económica nocorresponde al código 1262 Descripción de la actividad económica no coincidente con loinformado en el campo D120 R
septiembre de 2019 165
```
D3. Datos que identifican al receptor del Documento Electrónico DE (D200 - D299)
```
N° Val ID Mensaje de la Validación Código Observación E
```
45 D201 Naturaleza del Receptor inválida para el tipodocumento electrónico 1315 Si el tipo de documento es Autofactura (C002=4), la naturaleza delReceptor debe ser Contribuyente (D201=1) R
```
46 D202 El tipo de operación no compatible con lanaturaleza del receptor 1300
```
Si el tipo de documento no es autofactura (C002 ≠ 4) y si la
```
```
naturaleza del receptor es No contribuyente (D201=2), el tipo de
```
```
operación debe ser B2C (D202=2).
```
```
Si el tipo de operación es B2F (D202=4), la naturaleza del receptor
```
```
debe ser No contribuyente (D201=2)
```
R
```
47 D202a El tipo de operación no compatible con el tipodocumento electrónico 1316 Si la transacción se documenta con Autofactura (C002=4), el tipo deoperación debe ser B2C (D202=2) R
```
48 D203 Código de país del receptor inválido para el tipode operación informado 1320
```
Si el tipo de operación es B2F (D202=4), el país informado debe
```
```
ser diferente a PRY (D203≠PRY).
```
```
Si el tipo de operación es diferente de B2F (D202≠4) el país
```
```
informado debe ser igual a PRY (D203=PRY)
```
R
49 D204 Descripción del país receptor no corresponde alcódigo 1301 La descripción del país del receptor no coincidente con lo informadoen el campo D203 R
```
50 D205 Es obligatorio informar el tipo de contribuyentereceptor 1302 Si la naturaleza del receptor es contribuyente (D201=1) el tipo decontribuyente receptor debe ser informado R
```
```
51 D205a Tipo de contribuyente receptor inválido 1303 Si la naturaleza del receptor es NO contribuyente (D201=2), el tipode contribuyente receptor (D205) no debe ser informado R
```
```
52 D206 Es obligatorio informar el RUC del receptorcontribuyente 1304 Si la naturaleza del receptor es contribuyente (D201=1), el RUC delreceptor debe ser informado R
```
```
53 D206a RUC del receptor no requerido 1305 Si la naturaleza del receptor es NO contribuyente (D201=2), el RUCdel receptor (D206) no debe ser informado R
```
54 D206b RUC del receptor inexistente en la base de datosde Marangatu 1306 El RUC informado no existe en la base de datos de Marangatu R
septiembre de 2019 166
N° Val ID Mensaje de la Validación Código Observación E
55 D206c El RUC se encuentra inactivo para el tipo decontribuyente receptor 1307
```
Si el tipo de contribuyente receptor es persona jurídica (D205=2),
```
el RUC del receptor en Marangatu debe contar con un estado
distinto a CANCELADO, CANCELADO DEFINITIVO o
SUSPENSIÓN TEMPORAL
R
56 D206d El RUC del receptor se encuentra inactivo para eltipo de operación 1308
```
Si el tipo de operación es B2B o B2G (D202 =1 o 3), el RUC del
```
receptor en Marangatu debe contar con un estado distinto a
CANCELADO, CANCELADO DEFINITIVO o SUSPENSIÓN
TEMPORAL
R
```
57 D206e RUC del Receptor inválido para el tipo dedocumento electrónico 1317 Si el tipo de documento es Autofactura (C002=4), el RUC delReceptor deber ser el mismo que el RUC del Emisor (D206= D101) R
```
58 D207 Dígito Verificador del RUC del receptor incorrecto 1309 El Dígito Verificador ingresado no corresponde al módulo 11 delRUC R
59 D208 Es obligatorio informar el tipo de documento deidentidad del receptor 1310
```
Si la naturaleza del receptor es NO contribuyente (D201=2) y el tipo
```
```
de operación es diferente a B2F (D202≠4), el tipo de documento de
```
identidad debe ser informado
R
```
60 D208a Tipo de documento de identidad del receptorinválido 1311 Si la naturaleza del receptor es contribuyente (D201=1), el tipo dedocumento de identidad del receptor (D208) no debe ser informado R
```
61 D208b Tipo de documento de identidad del receptorincorrecto para el tipo de operación 1319
El Tipo de documento de identidad del receptor no puede ser
```
innominado (D208=5), cuando el tipo de operación es distinto a
```
```
B2C (D202 ≠ 2) R
```
62 D208c
Tipo de documento de identidad del receptor
incorrecto para el total general de la operación en
guaraníes
1321
```
Si el Tipo de transacción es distinto a Muestras médicas (D011≠13),
```
el Tipo de documento de identidad del receptor no puede ser
```
Innominado (D208≠5) cuando el total general de la operación en
```
```
guaraníes (cuando la moneda es extranjera) o el total general de la
```
```
operación (cuando la moneda es PYG) es mayor o igual a
```
```
60.000.000 (F023 >= 60000000 o F014 >= 60000000)
```
R
63 D208d El tipo de documento de identidad del receptor noes requerido 1322
```
Si la naturaleza del receptor es Contribuyente (D201=1) o el tipo de
```
```
operación es igual a B2F (D202=4), el tipo de documento de
```
identidad no debe ser informado
R
```
60 D209 Descripción del tipo de documento de identidaddel receptor no informada 1312 Si se informa el código de tipo de documento de identidad (D208),es obligatorio indicar la descripción correspondiente R
```
septiembre de 2019 167
N° Val ID Mensaje de la Validación Código Observación E
64 D209a Descripción del tipo de documento de identidaddel receptor no corresponde al código 1313 La descripción del tipo de documento de identidad del receptor nocoincidente con lo informado en el campo D208 R
65 D210 Es obligatorio informar el número de documentode identidad del receptor 1314
```
Si la naturaleza del receptor es NO contribuyente (D201=2) y el tipo
```
```
de operación es diferente a B2F (D202≠4), el número de documento
```
de identidad debe ser informado
R
66 D210a El número de documento de identidad delreceptor no es requerido 1323
```
Si la naturaleza del receptor es contribuyente (D201=1) o el tipo de
```
```
operación es igual a B2F (D202=4), el número de documento de
```
identidad no debe ser informado
R
67 D213 Dirección del receptor no informado para el tipode documento electrónico 1318
Si el tipo de documento electrónico informado es Nota de remisión
```
electrónica (C002=7) o cuando el tipo de operación es B2F
```
```
(D202=4), es obligatorio informar la dirección del receptor (D213)
```
R
```
68 D218 Es obligatorio informar el número de casa delreceptor 1330 Si se informa la dirección del receptor (D213) es obligatorio informarel número de casa (D218) R
```
69 D219 Es obligatorio informar el departamento delreceptor 1324
```
Cuando se informa la dirección del receptor (D213) y el tipo de
```
```
operación es distinto a B2F (D202≠4), es obligatorio informar el
```
```
departamento (D219)
```
R
70 D220 Descripción del departamento de emisión nocorresponde al código 1325 Descripción del departamento de emisión no coincidente con loinformado en el campo D219 R
71 D222 Descripción del distrito de emisión nocorresponde al código 1326 Descripción del distrito de emisión no coincidente con lo informadoen el campo D221 R
72 D223 Es obligatorio informar la ciudad del receptor 1327
```
Cuando se informa la dirección del receptor (D213) y el tipo de
```
```
operación es distinto a B2F (D202≠4), es obligatorio informar la
```
```
ciudad (D223)
```
R
```
73 D223a El Departamento, el Distrito y la Ciudad delreceptor no están relacionados 1328 Debe haber relación entre el departamento (D219), el distrito(D221) y la ciudad (D223) R
```
74 D224 Descripción de la ciudad de emisión nocorresponde al código 1329 Descripción de la ciudad de emisión no coincidente con loinformado en el campo D223 R
septiembre de 2019 168
```
E1. Campos que componen la Factura Electrónica FE (E010-E099)
```
N° Val ID Mensaje de la Validación Código Observación E
75 E010
Grupo de campos que componen la FE es
obligatorio para tipo de documento electrónico
seleccionado
```
1350 Si el tipo de documento electrónico informado es FE (C002=1), elgrupo de campos que componen la FE (E010) es obligatorio R
```
76 E010a Grupo de campos que componen la FE norequerido 1351
Si el tipo de documento electrónico informado es distinto a FE
```
(C002≠1), el grupo de campos que componen la FE (E010) no debe
```
ser informado
R
77 E012 Descripción del indicador de presencia nocorresponde al código 1352 La descripción del indicador de presencia no coincidente con loinformado en el campo E011 R
```
E1.1. Grupo de informaciones de Compras Públicas (E020-E029)
```
N° Val ID Mensaje de la Validación Código Observación E
```
78 E020 Grupo de informaciones de Compras Públicases obligatorio 1400 El grupo de informaciones de Compras Públicas es obligatorio paratipo de operación B2G (D202=3) R
```
```
79 E020a Grupo de informaciones de Compras Públicasno requerido para el tipo de operación 1401 El grupo de informaciones de Compras Públicas solo es permitidopara tipo de operación B2G (D202=3) R
```
```
80 E025 Fecha de emisión del código de contratacióninválida 1402 La fecha de emisión del código de contratación (E025) no puede sersuperior a la fecha de emisión (D202) de la Factura Electrónica R
```
```
E4. Campos que componen la Autofactura Electrónica AFE (E300-E399)
```
N° Val ID Mensaje de la Validación Código Observación E
81 E300
Para el tipo de documento electrónico
seleccionado, es obligatorio informar el grupo de
campos que componen la AFE
```
2550 Si el tipo de documento electrónico informado es AFE (C002 = 4), elgrupo de campos que componen la AFE (E300) es obligatorio. R
```
septiembre de 2019 169
N° Val ID Mensaje de la Validación Código Observación E
82 E300a
Para el tipo de documento electrónico
seleccionado, no se debe informar el grupo de
campos que componen la AFE
```
2551 Para el tipo de documento electrónico informado (C002 ≠ 4), el grupode campos que componen la AFE (E300) no debe informarse R
```
83 E304 El vendedor no debe ser contribuyente 2562
Cuando el Tipo de documento de identidad del vendedor es Cédula
```
de identidad o Pasaporte (E304=1 o E304=2), el vendedor no debe
```
```
ser contribuyente (E306 no debe tener RUC o el estado del RUC
```
```
debe ser CANCELADO o CANCELADO DEFINITIVO)
```
R
```
84 E310 El Departamento, el Distrito y la Ciudad delvendedor no están relacionados 2553 Debe haber relación entre el departamento (E310), el distrito (E312)y la ciudad (E314) R
```
85 E311 Descripción del departamento del vendedor nocorresponde al código 2552 Descripción del departamento no coincidente con lo informado en elcampo E310 R
86 E313b Descripción del código del distrito del vendedor nocorresponde al código 2561 Descripción del código del distrito no coincidente con lo informadoen el campo E312 R
87 E315 Descripción de la ciudad del vendedor nocorresponde al código 2555 Descripción de la ciudad no coincidente con lo informado en elcampo E314 R
```
88 E317 El Departamento, el Distrito y la Ciudad donde serealiza la transacción no están relacionados 2557 Debe haber relación entre el departamento (E317), el distrito (E319)y la ciudad (E321) R
```
89 E318 Descripción del departamento no corresponde alcódigo donde se realiza la transacción 2556 Descripción del departamento no coincidente con lo informado en elcampo E317 R
90 E320
Descripción del distrito donde se realiza la
transacción no corresponde al
código
2558 Descripción del distrito donde se realiza la transacción nocoincidente con lo informado en el campo E319 R
91 E322 Descripción de la ciudad no corresponde al códigodonde se realiza la transacción 2559 Descripción de la ciudad donde se realiza la transacción nocoincidente con lo informado en el campo E321 R
septiembre de 2019 170
```
E5. Campos que componen la Nota Crédito/Débito Electrónica NCE - NDE (E400-E499)
```
N° Val ID Mensaje de la Validación Código Observación E
92 E400
Para el tipo de documento electrónico
seleccionado es obligatorio informar el grupo de
campos que componen la Nota Crédito/Débito
Electrónica NCE – NDE
1450
Si el tipo de documento electrónico seleccionado es Nota de
```
Crédito/Débito Electrónica (C002=5 o 6), es obligatorio informar el
```
grupo de campos que componen la Nota de Crédito/Débito
```
Electrónica (E400)
```
R
93 E400a
Para el tipo de documento electrónico
seleccionado no se requiere informar el grupo de
campos que componen la Nota Crédito/Débito
Electrónica NCE – NDE
1451
Si el tipo de documento electrónico seleccionado es distinto a Nota
```
de Crédito/Débito Electrónica (C002≠5 o 6), el grupo de campos que
```
```
componen la Nota de Crédito/Débito Electrónica (E400) no debe ser
```
informado
R
94 E402 Descripción del motivo de emisión nocorresponde al código 1452 Descripción del motivo de emisión de la Nota de Crédito/DébitoElectrónica no coincidente con lo informado en el campo E401 R
```
E6. Campos que componen la Nota de Remisión Electrónica (E500-E599)
```
N° Val ID Mensaje de la Validación Código Observación E
95 E500
Para el tipo de documento electrónico
seleccionado, es obligatorio informar el grupo de
campos que componen la NRE
2600
```
Si el tipo de documento es Nota de remisión (C002=7), es obligatorio
```
informar el grupo de campos que componen la Nota de Remisión
```
(E500)
```
R
96 E500a
Para el tipo de documento electrónico
seleccionado, no se debe informar el grupo de
campos que componen la NRE
```
2601 Para el tipo de documento electrónico informado (C002 ≠ 7), el grupode campos que componen la NRE (E500) no debe informarse R
```
97 E501 RUC del receptor no coincidente con el RUC delemisor 2606
Cuando el motivo de emisión es Traslado entre los locales de la
```
empresa (E501=7), el RUC del emisor debe coincidir con el RUC del
```
```
receptor (D101=D206)
```
R
98 E502 Descripción del motivo de emisión nocorresponde al código 2602 La descripción del motivo de emisión no coincidente con loinformado en el campo E501 R
99 E504 Descripción del responsable de la emisión de laNRE, no corresponde al código 2603 La descripción del responsable por la emisión de la NRE, nocoincide con lo informado en el campo E503 R
100 E506 Fecha futura de emisión de la factura excede ellímite permitido 2604
El mes de la fecha estimada de emisión de la factura, no puede ser
posterior al mes de la fecha de emisión de la Nota de Remisión R
septiembre de 2019 171
N° Val ID Mensaje de la Validación Código Observación E
101 E506a Fecha futura de emisión de la factura noinformada para el tipo de documento electrónico 2605
```
Si el motivo de emisión es Traslado por venta (E501=1) y no se
```
```
informan documentos asociados (H001), es obligatorio el campo
```
E506. R
```
E7. Campos que describen la condición de la operación (E600–E699)
```
N° Val ID Mensaje de la Validación Código Observación E
102 E600
Para el tipo de documento electrónico
seleccionado es obligatorio informar la condición
de la operación
1500
Si el tipo de documento electrónico seleccionado es Factura
```
Electrónica o Autofactura Electrónica (C002=1 o C002=4), es
```
```
obligatorio informar la condición de la operación (E600)
```
R
103 E600a
Para el tipo de documento electrónico
seleccionado no se requiere informar la condición
de la operación
1501
Si el tipo de documento electrónico seleccionado es distinto a
```
Factura Electrónica y Autofactura Electrónica (C002≠1 y C002≠4), la
```
```
condición de la operación no debe ser informada (E600)
```
R
```
104 E601 Condición de la operación inválida para el tipo dedocumento electrónico 1503 Si el tipo de documento es Autofactura Electrónica (C002=4) esobligatorio que la condición de la operación sea al contado (E601=1) R
```
105 E602 Descripción de la condición de la operación nocorresponde al código 1502 Descripción de la condición de la operación no coincidente con loinformado en el campo E601 R
```
E7.1. Campos que describan la forma de pago de la operación al contado o del monto de la entrega inicial (E605-E619)
```
N° Val ID Mensaje de la Validación Código Observación E
106 E605
El grupo de campos que describen la forma de
pago de la operación al contado o del monto de la
entrega inicial es obligatorio
1550
```
Si la condición de la operación seleccionada es contada (E601=1),
```
es obligatorio informar el grupo de los campos que describen la
forma de pago de la operación al contado o del monto de la entrega
```
inicial (E605)
```
R
107 E605a
El grupo de campos que describen la forma de
pago de la operación al contado o del monto de la
```
entrega inicial (crédito con cuota inicial) es
```
obligatorio
1551
```
Si la condición de la operación seleccionada es crédito (E601=2), y
```
```
existe monto de entrega inicial (E645), es obligatorio informar el
```
grupo de los campos que describen la forma de pago de la operación
```
al contado o del monto de la entrega inicial (E605)
```
R
septiembre de 2019 172
N° Val ID Mensaje de la Validación Código Observación E
108 E605b
El grupo de campos que describen la forma de
pago de la operación al contado o del monto de la
entrega inicial no requerida
1552
```
Si la condición de la operación seleccionada es crédito (E601=2), y
```
```
NO existe monto de entrega inicial (E645), el grupo de los campos
```
que describen la forma de pago de la operación al contado o del
```
monto de la entrega inicial (E605) no debe ser informado
```
R
109 E606 Tipo de pago inválido 1553
```
Si el tipo de pago informado es Pago bancario (E606=16), indicador
```
```
de presencia seleccionado debe ser Operación bancaria (E011=5)
```
Esta validación se aplica solo al DE Factura electrónica
R
110 E607 Descripción del tipo de pago no corresponde alcódigo 1554 Descripción del tipo de pago no coincidente con lo informado en elcampo E606 R
111 E610 Descripción de la moneda no corresponde alcódigo 1555 Descripción de la moneda por tipo de pago no coincidente con loinformado en el campo E609 R
```
112 E611 Tipo de cambio no informado para la moneda portipo de pago seleccionada 1556 Si la moneda por tipo de pago es distinta a guaraníes (E609≠PYG),es obligatorio informar el tipo de cambio por tipo de pago (E611) R
```
```
113 E611a Tipo de cambio informado es inválido para lamoneda por tipo de pago seleccionada 1557 Si la moneda por tipo de pago es igual a guaraníes (E609=PYG), eltipo de cambio por tipo de pago (E611) no debe existir R
```
```
E7.1.1. Campos que describen el pago de la operación con tarjeta de crédito/débito (E620-E629)
```
N° Val ID Mensaje de la Validación Código Observación E
114 E620
Grupo de campos que describen el pago o
entrega inicial de la operación con tarjeta de
crédito/debito es obligatorio
1600
Si el tipo de pago seleccionado es igual a Tarjeta de Crédito/Débito
```
(E606=3 o 4), es obligatorio informar el grupo de los campos que
```
describen el pago o entrega inicial de la operación con tarjeta de
```
crédito/debito (E620)
```
R
115 E620a
Grupo de los campos que describen el pago de la
operación con tarjeta de crédito/débito no
requerido
1601
Si el tipo de pago seleccionado es distinto a Tarjeta de
```
Crédito/Débito (E606≠3 o 4), el grupo de los campos que describen
```
el pago o entrega inicial de la operación con tarjeta de crédito/debito
```
(E620) no debe ser informado
```
R
```
116 E622 Descripción de la denominación de la tarjeta nocorresponde al código 1602 Descripción de la denominación de la tarjeta (E622) no coincidentecon lo informado en el campo (E621) R
```
```
117 E623 RUC de la procesadora de tarjeta inexistente 1603 RUC de la procesadora de tarjeta (E623) inexistente en la base dedatos de Marangatu R
```
septiembre de 2019 173
N° Val ID Mensaje de la Validación Código Observación E
```
118 E624 Digito verificador del RUC de la procesadora detarjeta es inexistente 1604 El Dígito verificador ingresado (E624) no corresponde al módulo 11del RUC R
```
```
E7.1.2. Campos que describen el pago de la operación en cheque (E630- E639)
```
N° Val ID Mensaje de la Validación Código Observación E
119 E630
Grupo de los campos que describen el pago o
entrega inicial de la operación en cheque es
obligatorio
1650
```
Si el tipo de pago seleccionado es igual a Cheque (E606=2), es
```
obligatorio informar el grupo de los campos que describen el pago o
```
entrega inicial de la operación con cheque (E630)
```
R
120 E630a
Grupo de los campos que describen el pago o
entrega inicial de la operación en cheque no
requerido
1651
```
Si el tipo de pago seleccionado es distinto a Cheque (E606≠2), el
```
grupo de los campos que describen el pago o entrega inicial de la
```
operación con cheque (E630) no debe ser informado
```
R
```
E7.2. Campos que describen la forma de pago a crédito (E640-E649)
```
N° Val ID Mensaje de la Validación Código Observación E
121 E640 Grupo de los campos que describen la forma depago a crédito es obligatorio 1700
Si la condición de la operación seleccionada es igual a Crédito
```
(E601=2), es obligatorio informar el grupo de los campos que
```
```
describen la operación a crédito (E640)
```
R
122 E640a Grupo de los campos que describen la forma depago a crédito no requerido 1701
Si la condición de la operación seleccionada es distinta a Crédito
```
(E601≠2), el grupo de los campos que describen la operación a
```
```
crédito (E640) no debe ser informado
```
R
123 E642 Descripción de la condición de la operación acrédito no corresponde al código 1702 Descripción de la condición de la operación a crédito no coincidentecon lo informado en el campo E641 R
```
124 E643 Plazo del crédito es obligatorio 1703 Si la condición de la operación a crédito seleccionada es igual aPlazo (E641=1), es obligatorio informar el plazo del crédito (E643) R
```
```
125 E643a Plazo del crédito no requerido 1704 Si la condición de la operación a crédito seleccionada es distinta aPlazo (E641≠1), el plazo del crédito (E643) no debe ser informado R
```
```
126 E644 Cantidad de cuotas es obligatorio 1705 Si la condición de la operación a crédito seleccionada es igual aCuota (E641=2), es obligatorio informar la cantidad de cuotas (E644) R
```
septiembre de 2019 174
N° Val ID Mensaje de la Validación Código Observación E
```
127 E644a Cantidad de cuotas no requerida 1706 Si la condición de la operación a crédito seleccionada es distinta aCuota (E641≠2), la cantidad de cuotas (E644) no debe ser informada R
```
```
E7.2.1 Campos que describen las cuotas (E650-E659)
```
N° Val ID Mensaje de la Validación Código Observación E
117 E650 Grupo de los campos que describen las cuotas esobligatorio 1750
Si la condición de la operación a crédito seleccionada es igual a
```
Cuota (E641=2), es obligatorio informar el grupo de los campos que
```
```
describen las cuotas (E650)
```
R
128 E650a Grupo de los campos que describen las cuotas norequerido 1751
Si la condición de la operación a crédito seleccionada es distinta a
```
Cuota (E641≠2), el grupo de los campos que describen las cuotas
```
```
(E650) no debe ser informado
```
R
```
E8. Campos que describen los ítems de la operación (E700-E899)
```
N° Val ID Mensaje de la Validación Código Observación E
```
129 E704 Código de DNCP - Nivel General es obligatoriopara el tipo de operación B2G 1800 Si el tipo de operación seleccionado es igual a B2G (D202=3), esobligatorio informar el Código DNCP – Nivel General (E704) R
```
```
130 E705 Código de DNCP – Nivel Específico es obligatorio 1801 Si se informa el Código de DNCP – Nivel General (E704) esobligatorio informar el código de DNCP – Nivel Específico (E705) R
```
131 E710 Descripción de la unidad de medida nocorresponde al código 1802 Descripción de la unidad de medida no coincidente con lo informadoen el campo E709 R
132 E713 Descripción del país de origen del producto nocorresponde al código 1804 Descripción del país de origen del producto no coincidente con loinformado en el campo E712 R
132 E715
Código de datos de relevancia de las mercaderías
no informado para el tipo de documento
electrónico
```
1805 Si el tipo de documento es Nota de remisión electrónica (C002=7),es obligatorio informar E715 R
```
133 E715
Código de datos de relevancia de las mercaderías
no requerido para el tipo de documento
electrónico 1807
No se debe informar el código de datos de relevancia de las
mercaderías cuando el tipo de documento electrónico es distinto a
```
Nota de remisión (C002≠7)
```
R
septiembre de 2019 175
N° Val ID Mensaje de la Validación Código Observación E
134 E716
Descripción del código de datos de relevancia de
las mercaderías no corresponde al código 1806 La descripción del código de datos de relevancia de las mercaderíasno coincidente con lo informado en el campo E715 R
135 E717
Se debe informar la cantidad o el porcentaje de
quiebra o merma 1808
Cuando se informa el Código de datos de relevancia de mercaderías
```
(E715) es obligatorio informar uno de los siguientes datos: la
```
```
cantidad de quiebra o merma (E717) o el porcentaje de quiebra o
```
```
merma (E718)
```
R
```
E8.1. Campos que describen el precio, tipo de cambio y valor total de la operación por ítem (E720-E729)
```
N° Val ID Mensaje de la Validación Código Observación E
136 E720 Grupo de los campos que describen los precios,descuentos y valor total por ítem es obligatorio 1850
El grupo de los campos que describen los precios, descuentos y
```
valor total por ítem (E720) es obligatorio para todos los tipos de
```
documentos electrónicos excepto para Nota Remisión Electrónica
```
(C002=7)
```
R
137 E720a Grupo de los campos que describen los precios,descuentos y valor total por ítem no requerido 1851
Si el tipo de documento electrónico seleccionado es igual a Nota de
```
Remisión Electrónica (C002=7), el grupo de los campos que
```
```
describen los precios, descuentos y valor total por ítem (E720) no
```
debe ser informado
R
```
138 E725 Tipo de cambio por ítem no informado 1854 Si la condición del tipo de cambio es Por ítem (D017=2) esobligatorio informar el tipo de cambio R
```
```
139 E725a Tipo de cambio por ítem no requerido 1855 Si la condición del tipo de cambio es Global (D017=1), el tipo decambio por ítem no debe ser informado R
```
```
140 E725b La moneda de la operación seleccionada norequiere tipo de cambio por ítem 1856 Si la moneda de la operación (D015) es igual a PYG, el tipo decambio por ítem (E725) no debe existir R
```
141 E727 Error en el cálculo del valor total bruto de laoperación por ítem 1859
Cálculo del valor total bruto de la operación por ítem incorrecto
E727 debe corresponder al cálculo aritmético E721 * E711 R
septiembre de 2019 176
```
E8.1.1 Campos que describen los descuentos, anticipos y valor total por ítem (EA001-EA050)
```
N° Val ID Mensaje de la Validación Código Observación E
```
142 EA003 Porcentaje de descuento particular por ítem noinformado 1852 Si se informa el campo de descuento por ítem (EA002) con un montosuperior a 0 (cero), es obligatorio indicar el porcentaje respectivo R
```
143 EA003a Error en el cálculo del porcentaje de descuentoparticular por ítem 1861
EA003 representa el porcentaje de descuento de EA002 con
```
respecto al precio unitario del producto y/o servicios (E721)
```
Según la siguiente fórmula:
[EA002 * 100 / E721]
Puede haber una variación de 0.8
R
144 EA004
El descuento global sobre el precio unitario por
ítem no coincidente con lo informado 1862
El descuento global sobre el precio unitario por ítem no coincide con
lo informado en el porcentaje de descuento global sobre total de la
```
operación (F010)
```
Según la siguiente fórmula: [EA004 * 100 / E721]
Puede haber una variación de 0.8
R
145 EA008 Error en el cálculo del valor total de la operaciónpor ítem 1853
Cálculo del valor total de la operación por ítem incorrecto
EA008 debe corresponder al cálculo aritmético:
```
IVA: (E721- EA002 – EA004 – EA006 – EA007) * E711
```
R
```
146 EA009 Valor total de la operación por ítem en guaraníesno informado 1857 Si se informa el tipo de cambio por ítem (E725), el valor total de laoperación por ítem en guaraníes es obligatorio R
```
147 EA009a Error en el cálculo del valor total de la operaciónpor ítem en guaraníes 1858
Cálculo del valor total de la operación por ítem en guaraníes
incorrecto
EA009 debe corresponder al cálculo aritmético EA008 * E725
R
septiembre de 2019 177
```
E8.2. Campos que describen el IVA de la operación (E730-E739)
```
N° Val ID Mensaje de la Validación Código Observación E
148 E730 Grupo de los campos que describen el IVA de laoperación es obligatorio 1900
Si el tipo de impuesto al consumo afectado es IVA o Renta o
```
Ninguno o IVA - Renta (D013=1 o 3 o 4 o 5), el grupo de los campos
```
```
que describen el IVA de la operación (E730) es obligatorio para
```
todos los tipos de documentos electrónicos excepto Factura
Electrónica de Importación, Autofactura Electrónica o Nota de
```
Remisión Electrónica (C002=3, 4 o 7)
```
R
149 E730a
Grupo de los campos que describen el IVA de la
operación no requerido para el tipo de documento
electrónico seleccionado
1901
Si el tipo de documento electrónico seleccionado es igual a Factura
Electrónica de Importación, Autofactura Electrónica o Nota de
```
Remisión Electrónica (C002=3, 4 o 7), el grupo de los campos que
```
```
describen el IVA de la operación (E730) no debe ser informado
```
R
150 E730b
Grupo de los campos que describen el IVA de la
operación no requerido para el tipo de impuesto
al consumo afectado seleccionado
1902
```
Si el tipo de impuesto al consumo afectado es igual a ISC (D013=2),
```
```
el grupo de los campos que describen el IVA de la operación (E730)
```
no debe ser informado
R
151 E732 Descripción de la forma de afectación tributariadel IVA no corresponde al código 1903 Descripción de la forma de afectación tributaria del IVA coincidentecon lo informado en el campo E731 R
152 E733 Proporción gravada del IVA incorrecta para formade afectación Gravado IVA 1904
Si la forma de afectación tributaria del IVA informada es Gravado
```
IVA (E731=1), la proporción gravada del IVA debe ser igual a 100
```
```
(cien)
```
R
153 E733a Proporción gravada del IVA incorrecta para formade afectación Exonerado o Exento 1905
Si la forma de afectación tributaria del IVA informada es Exonerado
```
o Exento (E731=2 o 3), la proporción gravada del IVA debe ser igual
```
```
a 0 (cero)
```
R
154 E733b Proporción gravada del IVA incorrecta para formade afectación Gravado Parcial 1906
Si la forma de afectación tributaria del IVA informada es Gravado
```
parcial (E731=4), la proporción gravada del IVA debe ser inferior a
```
```
100 (cien) y superior a 0 (cero)
```
R
```
155 E734 Tasa del IVA es incorrecta para forma deafectación Exonerado o Exento 1907 Para la forma de afectación tributaria Exonerado o Exento (E731=2o 3), la tasa del IVA informada (E734) debe ser igual a 0 (cero) R
```
156 E734a Tasa del IVA es incorrecta para la forma deafectación Gravado IVA o Gravado parcial 1908
Para la forma de afectación tributaria Gravado IVA o Gravado
```
parcial (E731=1 o 4), la tasa del IVA informada (E734) debe ser
```
```
igual a 5 (cinco) o 10 (diez)
```
R
157 E735
Error en el cálculo de la base gravada del IVA por
ítem para forma de afectación Exonerado o
Exento
1909
Si la forma de afectación tributaria del IVA informada es Exonerado
```
o Exento (E731=2 o 3), la base gravada del IVA por ítem (E735)
```
```
debe ser igual a 0 (cero)
```
R
septiembre de 2019 178
N° Val ID Mensaje de la Validación Código Observación E
158 E735a Error en el cálculo de la base gravada del IVA porítem para tasa del 5% 1910
Cálculo de la base gravada del IVA por ítem incorrecto
Si E734 = 5 este campo es igual al resultado del cálculo
```
[EA008* (E733/100)] / 1,05
```
R
159 E735b Error en el cálculo de la base gravada del IVA porítem para tasa del 10% 1911
Cálculo de la base gravada del IVA por ítem incorrecto
Si E734 = 10 este campo es igual al resultado del cálculo
```
[EA008 * (E733/100)] / 1,1
```
R
160 E736
Error en el cálculo de la liquidación del IVA por
ítem para forma de afectación Exonerado o
Exento
1912
Si la forma de afectación tributaria del IVA informada es Exonerado
```
o Exento (E731=2 o 3), la liquidación del IVA por ítem (E736) debe
```
```
ser igual a 0 (cero)
```
R
161 E736a
Error en el cálculo de la liquidación del IVA por
ítem para forma de afectación Gravado IVA o
Gravado Parcial
1913
Cálculo de la liquidación del IVA por ítem incorrecto
Corresponde al cálculo aritmético:
```
E735 * (E734/100) para la forma de afectación tributaria Gravado
```
```
IVA o Gravado parcial (E731=1 o 4)
```
R
```
E9.5 Grupo de datos adicionales de uso comercial (E820-E829)
```
N° Val ID Mensaje de la Validación Código Observación E
```
162 E822 Fecha de inicio de ciclo es obligatorio 2050 La fecha de inicio del ciclo (E812) es obligatoria si se informa elcampo E811 R
```
163 E822a Fecha de inicio de ciclo no requerida 2051 Si NO se informa el campo E811, la fecha de inicio de ciclo no debeser informada R
```
164 E823 Fecha de fin de ciclo es obligatoria 2052 La fecha de fin de ciclo (E813) es obligatoria si se informa la fechade inicio de ciclo (E812) R
```
165 E823a Fecha de fin de ciclo no requerida 2053 Si NO se informa el campo E812, la fecha de fin de ciclo no debeser informada R
```
166 E823b Fecha de fin de ciclo inválida 2054 La fecha de fin de ciclo (E813) debe ser mayor o igual a la fecha deinicio de ciclo (E812) R
```
```
167 E824 Fecha de vencimiento del pago es retrasada 2055 La fecha de vencimiento para el pago no debe ser anterior a la fechade emisión del DE (D002) R
```
septiembre de 2019 179
```
E10. Campos que describen el transporte de las mercaderías (E900-E999)
```
N° Val ID Mensaje de la Validación Código Observación E
168 E900 Grupo de los campos que describen el transportede las mercaderías es obligatorio 2100
Si el tipo de documento electrónico seleccionado es igual Nota de
```
Remisión Electrónica (C002=7), es obligatorio informar el grupo de
```
campos que describen el transporte de las mercaderías
R
169 E900a
Grupo de los campos que describen el transporte
de las mercaderías no es permitido para el tipo de
DE seleccionado
2101
El grupo de los campos que describen el transporte de las
mercaderías no es permitido para Autofactura Electrónica, Nota de
Crédito Electrónica, Nota de Débito Electrónica o Comprobante de
```
Retención Electrónico (C002=4, 5, 6 o 8)
```
R
```
170 E901 Tipo de transporte no informado 2102 Es obligatorio informar el tipo de transporte (E901) para operacionescon Nota de Remisión Electrónica (C002 = 7) R
```
```
171 E902 Descripción del tipo de transporte no correspondeal código 2103 Descripción del tipo de transporte (E902) no coincidente con loinformado en el campo E901 R
```
```
172 E904 Descripción de la modalidad de transporte nocorresponde al código 2104 Descripción de la modalidad de transporte (E904) no corresponde alo informado en el campo E903 R
```
173 E909 Fecha estimada de inicio de traslado noinformada 2107
```
Es obligatorio informar la fecha estimada de inicio de traslado (E909)
```
para el tipo de documento electrónico seleccionado
```
(C002=7)
```
R
```
174 E909a Fecha estimada de inicio de traslado es antigua 2108 Si se informa la fecha estimada de inicio de traslado (E909), éstadebe ser posterior a fecha en producción de SIFEN R
```
```
175 E910 Fecha estimada de fin de traslado no informada 2109 Es obligatorio informar la fecha estimada de fin de traslado (E910)para el tipo de documento electrónico seleccionado (C002= 7) R
```
```
176 E910a Fecha estimada de fin de traslado es inválida 2110 Si se informa la fecha estimada de fin de traslado (E910), ésta debeser igual o mayor a la fecha estimada de inicio de traslado (E908) R
```
```
186 E912 Descripción del país de destino no informada 2112 Si se informa el código de país de destino (E911), es obligatorioindicar la descripción del país de destino (E912) R
```
```
177 E912a Descripción del país de destino no correspondeal código 2113 Descripción del país de destino (E912) no coincidente con loinformado en el campo E911 R
```
septiembre de 2019 180
```
E10.1. Campos que identifican el local de salida de las mercaderías (E920-E939)
```
N° Val ID Mensaje de la Validación Código Observación E
178 E920 Grupo de los campos que identifican el local desalida de las mercaderías es obligatorio 2150
Si el tipo de documento electrónico seleccionado es igual a Factura
```
Electrónica de Exportación o Nota de Remisión Electrónica (C002=2
```
```
o 7), es obligatorio informar el grupo de los campos que identifican
```
el local de salida de las mercaderías
R
179 E920a
Grupo de los campos que identifican el local de
salida de las mercaderías no es permitido para el
tipo de documento electrónico seleccionado
2151
El grupo de los campos que identifican el local de salida de las
mercaderías no es permitido para Autofactura Electrónica, Nota de
Crédito Electrónica, Nota de Débito Electrónica o Comprobante de
```
Retención Electrónica (C002=3, 4, 5, 6 o 8)
```
R
```
180 E925 El Departamento, el Distrito y Ciudad del local deSalida no están relacionados 2153 Debe haber relación entre el departamento (E925), el distrito (E927)y la ciudad (E929) R
```
181 E926 Descripción del departamento del local de salidano corresponde al código 2152 Descripción del departamento del local de salida no coincidente conlo informado en el campo E925 R
```
193 E928 Descripción del código de distrito del local desalida no informada 2154 Si se informa el código del distrito del local de salida (E927), ladescripción del mismo es obligatoria R
```
182 E928a Descripción del distrito del local de salida nocorresponde al código 2155 Descripción del distrito del local de salida no coincidente con loinformado en el campo E927 R
```
159 E929 La ciudad del local de salida no corresponde aldepartamento seleccionado 2156 El código de la ciudad del local de salida (E929) debe corresponderal departamento seleccionado (E925) R
```
160 E929a La ciudad del local de salida no corresponde aldistrito seleccionado 2157
```
El código de la ciudad del local de salida (E929) debe corresponder
```
```
al distrito seleccionado (E927)
```
No se aplica esta regla si no ha sido informado el distrito
R
183 E930 Descripción de la ciudad del local de salida nocorresponde al código 2158 Descripción de la ciudad del local de salida no coincidente con loinformado en el campo E929 R
septiembre de 2019 181
```
E10.2. Campos que identifican el local de entrega de las mercaderías (E940-E959)
```
N° Val ID Mensaje de la Validación Código Observación E
184 E940 Grupo de los campos que identifican el local deentrega de las mercaderías es obligatorio 2200
Si el tipo de documento electrónico seleccionado es Nota de
```
Remisión Electrónica (C002=7), es obligatorio informar el grupo de
```
los campos que identifican el local de entrega de las mercaderías
R
185 E940a
Grupo de los campos que identifican el local de
entrega de las mercaderías no es permitido para
el tipo de documento electrónico seleccionado
2201
El grupo de campos que identifican el local de entrega de las
mercaderías no es permitido para el tipo de documento Autofactura
Electrónica, Nota de Débito Electrónica, Nota de Crédito Electrónica
```
o Comprobante de Retención Electrónico (C002=4, 5, 6 o 8)
```
R
```
186 E945 El Departamento, el Distrito y la Ciudad del localde entrega no están relacionados 2203 Debe haber relación entre el departamento (E945), el distrito (E947)y la ciudad (E949) R
```
187 E946 Descripción del departamento del local de entregano corresponde al código 2202 Descripción del departamento del local de entrega no coincidentecon lo informado en el campo E945 R
```
201 E948 Descripción del código del distrito del local de laentrega no informada 2204 Si se informa el código del distrito del local de entrega (E947), ladescripción del mismo es obligatoria R
```
188 E948a Descripción del distrito del local de entrega nocorresponde al código 2205 Descripción del distrito del local de entrega no coincidente con loinformado en el campo E947 R
```
168 E949 La ciudad del local de entrega no corresponde aldepartamento seleccionado 2206 El código de la ciudad del local de entrega (E949) debecorresponder al departamento seleccionado (E945) R
```
169 E949a La ciudad del local de entrega no corresponde aldistrito seleccionado 2207
```
El código de la ciudad del local de entrega (E949) debe
```
```
corresponder al distrito seleccionado (E947)
```
No se aplica esta regla si no ha sido informado el distrito
R
189 E950 Descripción de la ciudad del local de entrega nocorresponde al código 2208 Descripción de la ciudad del local de entrega no coincidente con loinformado en el campo E949 R
```
E10.3. Campos que identifican el vehículo de traslado de mercaderías (E960-E979)
```
N° Val ID Mensaje de la Validación Código Observación E
190 E960 Grupo de los campos que identifican el vehículode traslado de las mercaderías es obligatorio 2250
Si el tipo de documento electrónico seleccionado es Nota de
```
Remisión Electrónica (C002=7), es obligatorio informar el grupo de
```
los campos que identifican el vehículo de traslado de las
mercaderías
R
septiembre de 2019 182
N° Val ID Mensaje de la Validación Código Observación E
191 E960a
Grupo de los campos que identifican el vehículo
de traslado de las mercaderías no es permitido
para el tipo de documento electrónico
seleccionado
2251
El grupo de campos que identifican el vehículo de traslado de las
mercaderías no es permitido para el tipo de documento Autofactura
Electrónica, Nota de Débito Electrónica, Nota de Crédito Electrónica
```
o Comprobante de Retención Electrónico (C002=4, 5, 6 o 8)
```
R
```
192 E963 Tipo de identificación del vehículo no informado 2255 Se requiere el número de identificación del vehículo cuando el tipode identificación del vehículo es 1 (E967=1) R
```
```
193 E965 Número de matrícula del vehículo no informado 2254 Se requiere número de matrícula del vehículo cuando el tipo deidentificación del vehículo es 2 (E967=2) R
```
```
194 E966 Número de vuelo no informado 2252 Se requiere número de vuelo para la modalidad de transporteseleccionada (E903 = 3) R
```
```
195 E966a Número de vuelo no requerido 2253 Si la modalidad de transporte seleccionada es distinta a Aéreo(E903 ≠ 3) el número de vuelo (E965) no debe ser informado R
```
```
E10.4. Campos que identifican al transportista (persona física o jurídica) (E980-E999)
```
N° Val ID Mensaje de la Validación Código Observación E
196 E980
Grupo de los campos que identifican al
```
transportista (persona física o jurídica) es
```
obligatorio
2300
Si el tipo de documento electrónico seleccionado es Nota de
```
Remisión Electrónica (C002=7), es obligatorio informar el grupo de
```
```
los campos que identifican al transportista (persona física o jurídica)
```
R
197 E980a
Grupo de los campos que identifican al
```
transportista (persona física o jurídica) no es
```
permitido para el tipo de documento electrónico
seleccionado
2301
```
El grupo de campos que identifican al transportista (persona física o
```
```
jurídica) no es permitido para el tipo de documento Autofactura
```
Electrónica, Nota de Débito Electrónica, Nota de Crédito Electrónica
```
o Comprobante de Retención Electrónico (C002=4, 5, 6 o 8)
```
R
```
198 E983 RUC del transportista no informado 2302 Se requiere informar el número de RUC si la naturaleza deltransportista es igual a contribuyente (E981 = 1) R
```
199 E983a RUC del transportista inexistente 2303 El RUC del transportista informado no existe en la base de datos deMarangatu R
200 E983b El RUC del transportista se encuentra inactivo 2304
El RUC del transportista debe contar con un estado distinto a
CANCELADO, CANCELADO DEFINITIVO o SUSPENSIÓN
TEMPORAL en Marangatu al momento de la emisión del DE
R
```
201 E983c RUC del transportista no requerido 2305 Si la naturaleza del transportista es distinta a contribuyente (E981≠1)el RUC del transportista (E983) no debe ser informado R
```
```
202 E984 Dígito Verificador del RUC del transportistaincorrecto 2306 El Dígito Verificador ingresado (E984) no corresponde al módulo 11del RUC R
```
septiembre de 2019 183
N° Val ID Mensaje de la Validación Código Observación E
```
203 E985 Tipo de documento de identidad del transportistano informado 2307 Se requiere informar el tipo de documento de identidad si lanaturaleza del transportista es igual a NO contribuyente (E981=2) R
```
204 E985a Tipo de documento de identidad del transportistano requerido 2308
```
Si la naturaleza del transportista es igual a contribuyente (E981=1)
```
```
el tipo de documento de identidad del transportista (E985) no debe
```
ser informado
R
205 E986 Descripción del tipo de documento de identidaddel transportista no informada 2309
Si se informa el código de tipo de documento de identidad del
```
transportista (E985), es obligatorio indicar la descripción del mismo
```
```
(E986)
```
R
```
206 E986a Descripción del tipo de documento de identidaddel transportista no corresponde al código 2310 Descripción del tipo de documento de identidad del transportista(E986) no coincidente con lo informado en el campo E985 R
```
```
207 E987 Número de documento de identidad deltransportista no informado 2311 Si se informa el código de tipo de documento de identidad deltransportista (E985), el número de dicho documento es requerido R
```
```
208 E989 Descripción de la nacionalidad del transportista noinformada 2312 Si se informa el código de nacionalidad del transportista (E988), esobligatorio indicar la descripción (E989) del mismo R
```
```
209 E989a Descripción de la nacionalidad del transportista nocorresponde al código 2313 Descripción de la nacionalidad del transportista (E989) nocoincidente con lo informado en el campo E988 R
```
F. Campos que describen los subtotales y totales de la transacción documentada (F001-F099)
N° Val ID Mensaje de la Validación Código Observación E
210 F001
Grupo de los campos que describen los
subtotales y totales de la transacción
documentada es obligatorio para el tipo de
documento electrónico seleccionado
2350
Si el tipo de documento electrónico seleccionado es distinto a Nota
```
de Remisión Electrónica (C002≠7), es obligatorio informar el grupo
```
de campos que describen los subtotales y totales de la transacción
documentada
R
211 F001a
Grupo de los campos que describen los
subtotales y totales de la transacción
documentada no es permitido para el tipo de
documento electrónico seleccionado
2351
El grupo de los campos que describen los subtotales y totales de la
transacción documentada no es permitido para el tipo de documento
```
electrónico Nota de Remisión Electrónica (C002=7)
```
R
212 F002 Subtotal de operaciones exentas de IVA noinformado 2352
Si se informan operaciones exentas, es obligatorio reportar el
subtotal de dichas operaciones
Si el campo E731=3 debe existir F002
R
213 F002a Cálculo del subtotal de la operación exentaincorrecto 2353
Error en el cálculo del subtotal de la operación exenta.
Calculo debe ser igual a la suma de todas las ocurrencias de EA008
cuando E731=3
R
septiembre de 2019 184
N° Val ID Mensaje de la Validación Código Observación E
214 F003 Subtotal de operaciones exoneradas de IVA noinformado 2354
Si se informan operaciones exoneradas, es obligatorio reportar el
subtotal de dichas operaciones
Si el campo E731=2 debe existir F003
R
215 F003a Cálculo del subtotal de la operación exoneradaincorrecto 2355
Error en el cálculo del subtotal de la operación exonerada.
Calculo debe ser igual a la suma de todas las ocurrencias de EA008
cuando E731=2
R
216 F004 Subtotal de operaciones gravadas al 5% de IVAno informado 2356
Si se informan operaciones gravadas al 5%, es obligatorio reportar
el subtotal de dichas operaciones.
Si el campo E731=1 o 4 y E734=5 debe existir F004
```
Corresponde al porcentaje (%) de la tasa expresado en números
```
enteros
R
217 F004a Cálculo del subtotal de la operación gravada al5% incorrecto 2357
Error en el cálculo del subtotal de la operación gravada al 5%.
Calculo debe ser igual a la suma de todas las ocurrencias de EA008
cuando E734=5
R
218 F005 Subtotal de operaciones gravadas al 10% de IVAno informado 2358
Si se informan operaciones gravadas al 10%, es obligatorio reportar
el subtotal de dichas operaciones.
Si el campo E731=1 o 4 y E734=10 debe existir F005
```
Corresponde al porcentaje (%) de la tasa expresado en números
```
enteros
R
219 F005a Cálculo del subtotal de la operación gravada al10% incorrecto 2359
Error en el cálculo del subtotal de la operación gravada al 10%.
Calculo debe ser igual a la suma de todas las ocurrencias de EA008
cuando E734=10
R
220 F008 Cálculo del total de la operación incorrecto 2362
Error en el cálculo del total de la operación.
```
Si la operación es grabada con IVA, Renta o Ninguno (D013=1, 3, 4
```
```
o 5) el cálculo debe ser igual a la suma F002+F003+F004+F005
```
Cuando C002=4 corresponde a la suma de todas las ocurrencias de
```
EA008 (Valor total de la operación por ítem)
```
R
221 F009 Cálculo del total descuento por ítem incorrecto. 2363
Error en el cálculo del total de descuento por ítem
Calculo debe ser igual la suma de todas las ocurrencias de EA002
multiplicado por la cantidad EA002*E711
R
222 F011 Cálculo del descuento sobre el total de laoperación incorrecto 2364 Error en el cálculo del descuento sobre el total de la operaciónEs la sumatoria de EA002 y EA004 de cada ítem R
223 F014 Cálculo del total general de la operaciónincorrecto. 2365
Error en el cálculo del total general de la operación
Cuando C002=1, 5 o 6 el cálculo debe ser igual a F008–F011–F012-
F013
R
septiembre de 2019 185
N° Val ID Mensaje de la Validación Código Observación E
224 F015
Si se informan operaciones gravadas al 5%, es
obligatorio reportar la liquidación del IVA de
dichas operaciones
2366
Liquidación del IVA a la tasa del 5% no informada.
```
Si se informa la liquidación del IVA por ítem (E736) y E734=5, el
```
campo F015 debe existir
R
225 F015a Cálculo de la liquidación del IVA a la tasa del 5%incorrecto 2367
Error en el cálculo de la liquidación del IVA a la tasa del 5%.
Calculo debe ser igual a la suma de todas las ocurrencias de E736
cuando E734=5
R
226 F016
Si se informan operaciones gravadas al 10%, es
obligatorio reportar la liquidación del IVA de
dichas operaciones
2368
Liquidación del IVA a la tasa del 10% no informada.
```
Si se informa la liquidación del IVA por ítem (E736) y E734=10, el
```
campo F016 debe existir
R
227 F016a Cálculo de la liquidación del IVA a la tasa del 10%incorrecto 2369
Error en el cálculo de la liquidación del IVA a la tasa del 10%.
Calculo debe ser igual a la suma de todas las ocurrencias de E736
cuando E734=10
R
228 F017 Es obligatorio informar la liquidación total del IVA 2370 Liquidación total del IVA no informada.Si existe campo F015 y/o F016 es obligatorio informar F017 R
229 F017a Cálculo de la liquidación total del IVA incorrecto 2371 Error en el cálculo de la liquidación total del IVACalculo debe ser igual a la suma F015+F016 R
230 F018
Si se informan operaciones gravadas al 5%, es
obligatorio reportar el total de la base gravada de
dichas operaciones
2372
Total base gravada al 5% no informado
```
Si se informa la base gravada del IVA por ítem (E735) y E734=5, el
```
campo F018 debe existir
R
231 F018a Cálculo total base gravada al 5% incorrecto 2373
Error en el cálculo del total base gravada al 5%
Calculo debe ser igual a la suma de todas las ocurrencias de E735
cuando E734=5
R
232 F019
Si se informan operaciones gravadas al 10%, es
obligatorio reportar el total de la base gravada de
dichas operaciones
2374
Total base gravada al 10% no informado
```
Si se informa la base gravada del IVA por ítem (E735) y E734=10,
```
el campo F019 debe existir
R
233 F019a Cálculo total base gravada al 10% incorrecto 2375
Error en el cálculo del total base gravada al 10%
Calculo debe ser igual a la suma de todas las ocurrencias de E735
cuando E734=10
R
234 F020 Es obligatorio informar el total de la base gravadade IVA 2376 Total de la base gravada del IVA no informada.Si existe campo F018 y/o F019 es obligatorio informar F020 R
235 F020a Cálculo del total de la base gravada del IVAincorrecto 2377 Error en el cálculo del total de la base gravada del IVACalculo debe ser igual a la suma F018+F019 R
236 F023
Si se informan operaciones con moneda
extranjera, es obligatorio reportar el total general
de la operación en guaraníes
2382
```
Si moneda de la operación es diferente de guaraníes (D015≠PYG)
```
es obligatorio informar total general de la operación en guaraníes
```
(F023)
```
R
septiembre de 2019 186
N° Val ID Mensaje de la Validación Código Observación E
237 F023a
Cálculo del total general de la operación en
guaraníes incorrecto para la condición del tipo de
cambio global
2385
Error en el cálculo del total general de la operación en guaraníes
```
Si moneda de la operación es diferente de guaraníes (D015≠PYG)
```
```
y la condición del tipo de cambio es global (D017=1) el cálculo debe
```
ser F014*D018
R
238 F023b
Cálculo del total general de la operación en
guaraníes incorrecto para la condición del tipo de
cambio por ítem
2386
Error en el cálculo del total general de la operación en guaraníes
```
Si moneda de la operación es diferente de guaraníes (D015≠PYG)
```
```
y la condición del tipo de cambio es por ítem (D017=2) el cálculo
```
debe ser igual a la suma de los totales en guaraníes por ítem
```
(EA009)
```
R
```
G1. Campos generales de la carga (G050 - G099)
```
N° Val ID Mensaje de la Validación Código Observación E
239 G050 Grupo generales de la carga no es permitido parael tipo de documento electrónico seleccionado 2390
El grupo de los campos generales de la carga no es permitido para
tipos de documento distintos a factura electrónica o Nota de
```
Remisión Electrónica (C002≠1 y C002≠7)
```
R
H. Campos que identifican al documento asociado (H001-H049)
N° Val ID Mensaje de la Validación Código Observación E
240 H001 Documento asociado es obligatorio para el tipo dedocumento electrónico seleccionado 2400
Si el tipo de documento electrónico seleccionado es igual a
Autofactura, Nota de Crédito Electrónica, Nota de Débito Electrónica
```
o Comprobante de Retención (C002=4, 5, 6 o 8), es obligatorio
```
informar el grupo de campos que identifican al documento asociado
R
septiembre de 2019 187
N° Val ID Mensaje de la Validación Código Observación E
241 H001a No informar el grupo de documento asociado 2414
```
Cuando el tipo de DE es Factura electrónica (C002=1), SIFEN
```
permite su asociación con los siguientes documentos:
Con Nota de remisión: Si este tipo de documento asociado es
electrónico H002=1, el CDC del DTE referenciado debe pertenecer
a una Nota de remisión. Si este tipo de documento asociado es
impreso H002=2, el tipo de documento impreso debe ser Nota de
remisión H009=4
Con Factura: cuando el tipo de transacción del documento asociado
```
es Anticipo (D011 del documento asociado = 9). Si este tipo de
```
documento asociado es electrónico H002=1, el CDC del DTE
referenciado debe pertenecer a una FE. Si este tipo de documento
asociado es impreso H002=2, el tipo de documento impreso debe
ser Factura H009=1
```
Cuando el tipo de DE es Nota de crédito o Nota de débito (C002=5
```
```
o 6), no se debe informar un grupo de documento asociado distinto
```
```
a Factura electrónica (Si el tipo de documento asociado es
```
electrónico H002=1, el CDC del DTE referenciado debe pertenecer
a una Factura electrónica. Si el tipo de documento asociado es
impreso H002=2, el tipo de documento impreso debe ser Factura
```
H009=1)
```
```
Cuando el tipo de DE es Nota de remisión (C002=7) y se informa
```
```
uno o más documentos asociados distintos a Factura electrónica (Si
```
el tipo de documento asociado es electrónico H002=1, el CDC del
DTE referenciado debe pertenecer a una Factura electrónica. Si el
tipo de documento asociado es impreso H002=2, el tipo de
```
documento impreso debe ser Factura H009=1)
```
R
```
242 H001b Cantidad incorrecta de documento(s) asociado(s) 2415
```
Cuando el tipo de documento electrónico es Autofactura, Nota de
```
crédito o nota de débito (C002=4, C002=5 o C002=6), el grupo de
```
documento asociado informado puede aparecer una sola vez. R
septiembre de 2019 188
N° Val ID Mensaje de la Validación Código Observación E
243 H002 Tipo de documento asociado obligatorio para eltipo de documento electrónico 2416
Si el tipo de documento electrónico recibido es Autofactura
```
(C002=4), el tipo de documento asociado debe ser constancia
```
```
electrónica (H002=3)
```
R
244 H002a Tipo de documento asociado no requerido para eltipo de documento electrónico 2434
Si el tipo de documento electrónico recibido es Factura electrónica,
```
Nota de crédito, Nota de débito o Nota de remisión (C002=1,5,6 o
```
```
7), el tipo de documento asociado no puede ser constancia
```
```
electrónica (H002 ≠ 3)
```
R
```
247 H002c CDC no requerido para el tipo de documentoasociado 2419 Cuando el tipo de documento asociado es impreso no se debeinformar el CDC del DTE (H004) R
```
250 H002 CDC no informado 2416 Cuando el tipo de documento asociado es electrónico es obligatorioinformar el CDC del DTE R
245 H003 Descripción del tipo de documento asociado nocorresponde al código 2401 Descripción del tipo de documento asociado no coincidente con loinformado en el campo H002 R
246 H004 Número de CDC del DTE referenciado noinformado 2402
Si el tipo de documento asociado seleccionado es igual a
```
Electrónico (H002=1), es obligatorio informar el número de CDC del
```
DTE referenciado
R
247 H004a Número de CDC del DTE referenciado inexistente 2403 El CDC del documento asociado informado es inexistente R
248 H004b El CDC informado corresponde a un DTEcancelado 2404 El DTE referenciado se encuentra cancelado en SIFEN R
```
249 H004c Número de CDC no requerido para el tipo dedocumento asociado 2418 Si el tipo de documento asociado es impreso o Constanciaelectrónica (H002=2 o H002=3), no se debe informar el CDC (H004) R
```
250 H004d
Sumatoria de los documentos asociados supera el
monto total del documento electrónico
referenciado
```
2417 La sumatoria de cada Total general de la operación (F014) de la (s)
```
```
Nota(s) de Crédito(s) (actual o pre-existentes) no puede(n) superar
```
al Total general de la operación de la Factura electrónica asociada
R
251 H004e Tipo de transacción de la FE asociada, esincorrecto2437
Cuando el tipo de documento electrónico es Factura electrónica
```
(C002=1) y el documento asociado es otra Factura electrónica
```
```
(H004 inicia con 01) necesariamente el tipo de transacción de la FE
```
```
asociada debe ser Anticipo (D011=9)
```
R
septiembre de 2019 189
N° Val ID Mensaje de la Validación Código Observación E
252 H004f Moneda de la operación informada no coincidentecon la moneda del para el documento asociado. 2438
```
Cuando el documento asociado es una FE (CDC inicia con 01), en
```
donde el tipo de transacción en este documento asociado es
```
Anticipo (D011=9) y el tipo de documento recibido es otra FE
```
```
(C002=1), el DTE y el DE deben tener la misma moneda de la
```
```
operación (D015 del documento asociado igual al D015 del
```
```
documento recibido)
```
Cuando el tipo de documento es Nota de crédito o Nota de débito
```
Electrónica (C002=5 o C002=6) y el documento asociado es Factura
```
```
electrónica (CDC inicia con 01), el DTE y el DE deben tener la misma
```
```
moneda de la operación (D015 del documento asociado igual al
```
```
D015 del documento recibido)
```
R
253 H005 Número de timbrado del documento impreso dereferencia no informado 2405
Si el tipo de documento asociado seleccionado es igual a Impreso
```
(H002=2), es obligatorio informar el número de timbrado del
```
documento impreso de referencia
R
254 H005a Número de timbrado no requerido para el tipo dedocumento asociado 2419
Si el tipo de documento asociado es electrónico o es constancia
```
electrónica (H002=1 o H002=3), no se debe informar el número de
```
timbrado
R
```
255 H005b Número de timbrado no corresponde al tipo dedocumento asociado 2440 Si el tipo de documento asociado seleccionado es igual a impreso(H002=2), no se debe informar un timbrado electrónico R
```
256 H006 Código de establecimiento del documento impresode referencia no informado 2406
Si el tipo de documento asociado seleccionado es igual a Impreso
```
(H002=2), es obligatorio informar el código de establecimiento del
```
documento impreso de referencia
R
257 H006a Código de establecimiento no requerido para eltipo de documento asociado 2420
Si el tipo de documento asociado es electrónico o es constancia
```
electrónica (H002=1 o H002=3), no se debe informar el código de
```
establecimiento
R
258 H007 Código de punto de expedición del documentoimpreso de referencia no informado 2407
Si el tipo de documento asociado seleccionado es igual a Impreso
```
(H002=2), es obligatorio informar el código de punto de expedición
```
del documento impreso de referencia
R
259 H007a Código de punto de expedición no requerido parael tipo de documento asociado 2421
Si el tipo de documento asociado es electrónico o es constancia
```
electrónica (H002=1 o H002=3), no se debe informar el código de
```
punto de expedición
R
260 H008 Número del documento impreso no informado 2408
Si el tipo de documento asociado seleccionado es igual a Impreso
```
(H002=2), es obligatorio informar el número del documento impreso
```
de referencia
R
septiembre de 2019 190
N° Val ID Mensaje de la Validación Código Observación E
261 H008a Número del documento no requerido para el tipode documento asociado 2422
Si el tipo de documento asociado es electrónico o es constancia
```
electrónica (H002=1 o H002=3), no se debe informar el número de
```
documento
R
```
262 H009 Tipo de documento impreso no informado 2409 Si el tipo de documento asociado seleccionado es igual a Impreso(H002=2), es obligatorio informar el tipo de documento impreso R
```
263 H009a Tipo de documento impreso no requerido para eltipo de documento asociado 2423
Si el tipo de documento asociado es electrónico o es constancia
```
electrónica (H002=1 o H002=3), no se debe informar el tipo de
```
documento impreso
R
264 H010 Descripción del tipo de documento impreso nocorresponde al código 2410 Descripción del tipo de documento impreso no coincidente con loinformado en el campo H009 R
```
265 H010a Descripción del tipo de documento impreso noinformada 2424 Si se informa el tipo de documento impreso (H009), es obligatorioindicar la descripción del mismo (H010) R
```
```
266 H010b Descripción del tipo de documento impreso norequerida 2435 Si no se informa el tipo de documento impreso (H009), no se debeinformar la descripción del mismo (H010) R
```
267 H011 Fecha de emisión del documento impreso dereferencia no informada 2411
Si el tipo de documento asociado seleccionado es igual a Impreso
```
(H002=2), es obligatorio informar la fecha de emisión del documento
```
impreso de referencia
R
268 H011a
Fecha de emisión del documento impreso de
referencia no requerida para el tipo de documento
asociado
2425
Si el tipo de documento asociado es electrónico o es constancia
```
electrónica (H002=1 o H002=3), no se debe informar la fecha de
```
emisión del documento impreso
R
```
236 H012 Número de comprobante de retención noinformado 2412 Si el tipo de pago informado es igual a Retenciones (E606=10), esobligatorio reportar número de comprobante de retención R
```
```
269 H012a Forma de pago incorrecto para el Número decomprobante de retención 2436 Si se informa el Número de comprobante de retención (H012), esnecesario que la forma de pago sea igual a Retención (E606=10) R
```
270 H013 Número de resolución de crédito fiscal noinformado 2413
Si el tipo de transacción informado es igual a Venta de crédito fiscal
```
(D011=12), es obligatorio reportar número de resolución de crédito
```
fiscal
R
271 H014 Tipo de constancia no informado 2426
Si el tipo de documento asociado seleccionado es igual a
```
Constancia electrónica (H002=3), es obligatorio informar el tipo de
```
constancia
R
```
272 H014a Tipo de constancia no requerido para el tipo dedocumento asociado 2427 Si el tipo de documento asociado es Electrónico o Impreso (H002=1o H002=2), no se debe informar el tipo de constancia R
```
273 H015a Descripción del tipo de constancia no correspondeal código 2429 Descripción del tipo de constancia no coincidente con lo informadoen el campo H014 R
septiembre de 2019 191
N° Val ID Mensaje de la Validación Código Observación E
274 H016 Número de constancia no informado 2430
Si el tipo de documento asociado seleccionado es igual a
```
Constancia electrónica (H002=3) y el tipo de constancia es
```
```
Constancia de no ser contribuyente (H014=2), es obligatorio
```
informar el número de constancia
R
```
275 H016a Número de constancia no requerido para el tipo dedocumento asociado 2431 Si el tipo de documento asociado es electrónico o impreso (H002=1o H002=2), no se debe informar el número de constancia R
```
276 H017 Número de control de la constancia no informado 2432
Si el tipo de documento asociado seleccionado es igual a
```
Constancia electrónica (H002=3) y el tipo de constancia es
```
```
Constancia de no ser contribuyente (H014=2), es obligatorio
```
informar el número de control de la constancia
R
277 H017a Número de control de la constancia no requeridopara el tipo de documento asociado 2433
```
Si el tipo de documento asociado es electrónico o impreso (H002=1
```
```
o H002=2), no se debe informar el número de control de la
```
constancia
R
I. Información de la Firma Digital del DTE (I001-I049)
N° Val ID Mensaje de la Validación Código Observación E
```
278 I002 Certificado digital no vigente al momento de firmadel DE 2450 El certificado digital (I002) debe estar vigente (no revocado) almomento de la firma digital (A004) R
```
J. Campos fuera de la Firma Digital (J001-J049)
N° Val ID Mensaje de la Validación Código Observación E
279 J002 Cadena de caracteres correspondiente al códigoQR no es coincidente con el archivo XML 2500
Las informaciones de la cadena de caracteres correspondiente al
```
código QR (J002) no son coincidentes con las informaciones de los
```
respectivos campos del archivo XML
R
280 J002a El hash del código QR incluido el de la cadena decaracteres es inválido 2501
El hash del código QR incluido en la cadena de caracteres
correspondiente al código QR impreso no corresponde al cálculo
obtenido del hash con la cadena informada y el CSC existente en la
base de datos de SIFEN
R
septiembre de 2019 192
```
281 J002b URL de consulta de código QR es inválida 2502 La URL de consulta del código QR informada en la cadena decaracteres (J002) no es correcta R
```
282 J003 Información adicional de interés para el emisor fueincluida en el DE 2503
La información adicional de interés para el emisor no debe ser
enviada a SIFEN.
El campo J003 fue incluido en el XML del DE
R
13. Gráfica (KUDE)
Este capítulo contempla los requisitos mínimos que deben observar y cumplir los facturadores
electrónicos para estructurar las representaciones gráficas.
13.1. Definición y alcance del KuDE:
```
Se entiende por representación gráfica al contenido de un DE (KuDE), la cual puede ser entregada
```
al receptor no electrónico o consumidor final en formato físico o digitalizado. Es un documento
tributario auxiliar que expresa de manera simplificada una transacción que ha sido respaldada por
un DE. Cabe señalar que su naturaleza simplificada obedece a que el KuDE contiene sólo algunos
campos representativos del DE.
El KuDE tiene como propósitos, los siguientes:
• Constituirse en el documento tributario físico de una transacción respaldada por un DE
emitido por facturador electrónico, a un receptor no electrónico o consumidor final.
• Amparar el traslado de las mercaderías entre los locales del emisor o entre las instalaciones
de este y el receptor comprador.
• Constituirse en el documento tributario físico que respalda o soporta los créditos fiscales
del receptor que no es facturador electrónico de SIFEN. Cabe señalar que el receptor se
obliga a consultar y/o comprobar la existencia del DTE en SIFEN, tomando en consideración
algunos campos presentes en el cuerpo del KuDE como criterios de consulta.
13.2. Características y funcionalidades
Entre las características y funcionalidades del KuDE, se encuentran las siguientes:
• KuDE posibilita la consulta pública del DTE en la página web de SIFEN con el llenado de la
información impresa del CDC o con la lectura del QR Code impreso.
• La generación del KuDE cuando se trata del facturador electrónico debe ser realizada
directamente en los sistemas de facturación, y en la base de datos oficial del SIFEN.
Igualmente puede ser consultada mediante la solución gratuita provista por este sistema.
• No puede existir información en el KuDE que no forme parte del formato del DE firmado
```
(XML), salvo las que se mencionen en el presente capítulo.
```
• La duración del papel del KuDE así como su impresión y legibilidad debe ser de un plazo no
```
menor a seis (6) meses.
```
13.3. Denominación de los KuDE
Cada documento electrónico deberá tener la denominación según corresponda a su tipo, conforme
a los enunciados citados a continuación:
septiembre de 2019 194
• KuDE de Factura Electrónica
• KuDE de Factura de Exportación Electrónica
• KuDE de Factura de Importación Electrónica
• KuDE de Autofactura Electrónica
• KuDE de Nota de Débito Electrónica
• KuDE de Nota de Crédito Electrónica
• KuDE de Nota de Remisión Electrónica
La representación gráfica de cada documento electrónico puede contar con una o varias páginas
enumeradas. Debiendo indicar para el caso de varias páginas el número de la página en relación con
el total. Ejemplo: 2/5. Para el caso de los subtotales o totales debe indicarlos en la última página y
el código QR debe ser impreso, al menos, en la primera página.
13.4. Estructura del KuDE
Independiente del formato, el KuDE estará compuesto por la siguiente estructura:
• Campos del encabezado.
• Campos que describen los ítems de la operación, los precios, descuentos y valor total por
ítem e impuestos.
• Campos subtotales y totales de la transacción documentada, totales de liquidación de IVA,
total en guaraníes.
• Campos de información propia de la consulta en SIFEN de la SET.
• Código QR.
septiembre de 2019 195
13.4.1. Campos del encabezado del KuDE
En esta sección de la estructura del KuDE se encuentran los siguientes campos:
Espacio reservado para
el logo del emisor
```
(opcional)
```
Datos del emisor:
Nombre o razón social del emisor: D105
Nombre fantasía: D106
Descripción de actividad: D131
Dirección: D107
Descripción ciudad: D116
Datos de timbrado:
RUC del emisor: D101
Timbrado Nº: C004
Fecha de inicio de vigencia: C008
Fecha de fin de vigencia:C009
Número de documento: C007
Datos generales:
Fecha y hora de emisión: D002
Descripción de condición de la operación: E602
```
Número de cuotas: E644 (Para operaciones a crédito)
```
Descripción de moneda de la operación: D016
Tipo de cambio: D018
Datos del receptor:
```
RUC del contribuyente: D206 (si D201=1)
```
```
Nº de Doc de Identidad: D210 (si D201=2)
```
Nombre/razón social: D211
Dirección: D213
Teléfono: D214
Correo electrónico: D216
Descripción del tipo de transacción: D012
Ejemplo de encabezado de KuDE de FE:
Fecha y hora de Emisión:
AAAA-MM-DDThh:mm:ss Condición de Venta: Contado Crédito
```
Cuotas: Moneda: PYG Tipo de Cambio:
```
RUC/Documento de Identidad Nº: 1131421-4
Nombre o Razón Social: Belén Bosco
Dirección: Mcal. López y Yegros
Teléfono: 021 123 456 Correo Electrónico: belbosco@gmail.com
Tipo de Operación: Venta de Mercadería
Marta Anahi Bordon Vidal
Soluciones Informáticas
Reparación de Equipos Informáticos
Avenida González Vidal #1434
```
Ciudad: Asunción
```
LOGO
KuDE DE FACTURA ELECTRÓNICA
X
Encabezado
```
RUC: 2365438-8
```
Timbrado Nº 1000332
Fecha de Inicio de Vigencia: 01/07/2018
Fecha de Fin de Vigencia: 31/07/2019
Factura Electrónica Nº 001-001-0000001
```
Ciudad: Asunción
```
septiembre de 2019 196
13.4.2. Campos que describen los ítems de la operación del KuDE
En esta sección de la estructura del KuDE se encuentran los siguientes campos:
Código
del
ítem
Descripción
del producto
y/o servicio
Descripción
de la
unidad de
medida
Cantidad Precio
unitario
Descuent
o del
producto
por ítem
Descripción
de la forma
de
afectación
tributaria
del IVA
Descripción
de la forma
de
afectación
tributaria
del IVA
Descripción
de la forma
de
afectación
tributaria
del IVA
Campo
E701-
E707
```
Campo E708 CampoE710CampoE711CampoE721CampoEA002CampoE732 (0%)CampoE732 (5%)CampoE732 (10%)
```
```
Ejemplo de ítems operación de KuDE (FE)
```
Art
Cod Descripción
Unidad de
medida Cantidad
Precio
Unitario Descuento
Valor de Venta
Exentas 5% 10%
INF012 Disco duro UNI 1 110.000 0 0 110.000
13.4.3. Campos que describen los subtotales y totales de la transacción documentada y
liquidación de IVA
En esta sección de la estructura del KuDE se encuentran los siguientes campos:
Exentas 5% 10%
Subtotal Campo F002 Campo F004 Campo F005
Total de la operación: Campo F007
Total en Guaraníes Campo F022
Liquidación IVA:
```
(5%): Campo F014
```
```
(10%): Campo F015
```
Total de IVA: Campo F016
```
Ejemplo de subtotales y totales de KuDE (FE)
```
13.4.4. Campos de información propia de la consulta en SIFEN de la SET
Los campos de Información propios de la consulta en SIFEN
• En el portal ingresar en Servicios y consultas
```
SUBTOTAL: 110.000
```
TOTAL A PAGAR: 110.000
TOTAL EN GUARANIES 110.000
```
LIQUIDACIÓN IVA: (5%) (10%) 10.000 TOTAL IVA: 10.000
```
Datos
Operación
Subtotales
Y totales
septiembre de 2019 197
o Producción: https://ekuatia.set.gov.py/consultas/
o Test: https://ekuatia.set.gov.py/consultas-test/
• CDC en once grupos de 4 posiciones.
En esta sección de la estructura del KuDE se encuentran los siguientes campos:
Información de consulta en SIFEN Ver información del QR,delineamientos, conformación
y validación del QR
13.4.5. Información adicional de interés para el emisor
Este es un espacio libre de utilización del emisor facturador electrónico con referencia a información
de los demás campos del DE, información comercial promocional o mensajes personalizados al
```
receptor: Campo J003. Esta información no debe ser enviada en el archivo XML a SIFEN.
```
No puede existir información propia de la operación que haya sido generada en el archivo
electrónico firmado digitalmente.
13.5. KuDE
Los contribuyentes podrán utilizar para la representación gráfica en el KuDE cualquier formato y
tamaño de papel estándar que se ajuste a sus necesidades. Las gráficas siguientes muestran
modelos referenciales de KuDE para cada tipo de documento electrónico, sin embargo, cada
contribuyente puede incluir otros campos presentes en el formato XML. Los campos obligatorios,
que se deben mostrar, son los que están especificados por las reglamentaciones emitidas por la
Administración Tributaria,
```
• Factura Electrónica (FE): Gráfica N° 09
```
```
• Nota de Crédito Electrónica (NCE): Grafica N° 10
```
```
• Nota de Débito Electrónica (NDE): Gráfica N° 11
```
```
• Autofactura Electrónica (AFE): Gráfica N° 12
```
```
• Nota de Remisión Electrónica (NRE): Gráfica N° 13
```
septiembre de 2019 198
Gráfica Nº 09 – KuDE FE Formato 1 convencional
septiembre de 2019 199
Gráfica Nº 10 – KuDE NCE Formato 1 convencional
septiembre de 2019 200
Gráfica Nº 11 – KuDE NDE Formato 1 convencional
septiembre de 2019 201
Gráfica Nº 12 – KuDE AFE Formato 1 convencional
septiembre de 2019 202
Gráfica Nº 13 – KuDE NRE Formato 1 convencional
septiembre de 2019 203
```
13.6. KuDE (cinta de papel)
```
El formato de cinta de papel se constituye en el más adecuado para ventas al consumidor final
```
(como supermercados, farmacias, restaurantes, estaciones de servicio, etc.)
```
```
Gráfica Nº 14 – KuDE FE Formato 2 (cinta de papel)
```
septiembre de 2019 204
13.7. Cinta papel resumen del KuDE
Si el consumidor pide se permite la impresión de un KuDE resumen que no trae el detalle de los
ítems de las mercaderías y el detalle del impuesto, solo con la información de la cantidad Total de
ítems y monto total. En la consulta pública del portal e-Kuatia por el CDC o en la consulta pública
por QR Code, el consumidor podrá imprimir el KuDE completo con los detalles de ítems y el
impuesto.
Gráfica Nº 15 – Cinta papel resumen del KuDE
septiembre de 2019 205
```
13.8. Código bidimensional (QR)
```
13.8.1. Delineamientos del QR Code
```
La imagen impresa del QR debe tener mínimamente 25 mm (veinticinco milímetros) de ancho, de
```
```
los cuales, 22 mm son para el contenido y 3 mm de margen seguro (quiet zone). Queda a criterio
```
del emisor si desea un tamaño mayor, en tal caso, el margen seguro debe ser el 10% del ancho total.
El contenido de este código es cargado en el campo J002 del archivo de DE correspondiente.
El código QR que será impreso en el KUDE, obedece al estándar internacional ISO/IEC 18004.
Para la generación del QR Code es necesario que previamente el contribuyente sea un facturador
electrónico autorizado por la SET y que haya obtenido de la Administración Tributaria, el Código de
```
Seguridad (CSC).
```
Este código estará compuesto de 32 dígitos alfanuméricos, es generado por el SIFEN y entregado al
facturador electrónico al momento de su ingreso. Sirve para garantizar la seguridad y autoría del
QR. Este código es de conocimiento exclusivo de la Administración Tributaria y del contribuyente,
permitiéndose hasta dos códigos de seguridad en estado activo.
13.8.2. Conformación del Código QR
Este código está formado por un conjunto de información adicional a fin de asegurar la autoría de
un documento electrónico, que puede no haber sido transmitido al SIFEN.
Esta imagen contendrá:
1. Dirección de la página web de consulta de la SET:
• Producción: https://ekuatia.set.gov.py/consultas/qr?
• Test: https://ekuatia.set.gov.py/consultas-test/qr?
2. Conjunto de parámetros del DE:
• Versión del QR
```
• Código de Control (Id), contenido en el campo A002
```
```
• Fecha y hora de emisión del DE (dFeEmiDE), contenido en el campo D002
```
• Identificación del receptor, valor del campo D205 o D210, según corresponda.
• F013, Total general de la operación
• F016, Liquidación total del IVA
• Cantidad de Ítems del DE, se obtiene contando la cantidad de ocurrencias del campo E701.
• Hash de la Firma, DigestValue contenido en el campo XS17.
```
• Id del Código entregado por el SIFEN (IdCSC).
```
septiembre de 2019 206
3. Código Hash de los parámetros que forman el punto 2 del QR utilizando el algoritmo SHA256.
A continuación, se muestra un cuadro descriptivo para mejor comprensión.
Parámetro Descripción Incluidoen el DE ID Campo Longitudmáxima
Incluir en
el Hash
del QR
Incluir en
la URL
del QR
nVersion
Versión de la
generación del
QR
Sí AA002 3 Sí Sí
Id
CDC del
correspondiente
DE
Sí A002 44 Sí Sí
dFeEmiDE Fecha y hora deemisión del DE Sí D002 19 Sí Sí
dRucRec/dNumIDRec
Identificación del
receptor o
cliente
```
Sí D206 oD210 20 Sí (*)
```
```
dTotGralOpe Total general dela operación Sí F014 23 Sí (*)
```
dTotIVA
Liquidación total
```
del IVA Sí F017 23 Sí (*)
```
cItems Cantidad deitems en el DE No
Cuenta
sobre el
campo
E701
```
3 Sí (*)
```
DigestValue Hash de la firmadigital del DE Sí XS17 - Sí Sí
IdCSC
Identificador del
código entregado
por el SIFEN
No - 4 Sí Sí
cHashQR Código Hash delos parámetros No - - No Sí
```
(*) En caso de que estos campos no contengan valor completar con un “0”
```
13.8.3. Metodología para la generación del Código QR
• Los siguientes campos deben ser convertidos a su equivalente hexadecimal
o Fecha de Emisión
o DigestValue de la Firma Digital
• El valor de todos los parámetros identificados en el cuadro precedente, deben ser
concatenados y aplicar el algoritmo SHA-256, para determinar el Código Hash
septiembre de 2019 207
• El valor Hash del QR, debe estar en hexadecimal.
```
Ejemplo:
```
Parámetro Contenido - Ejemplo Equivalente Hexadecimal
nVersion 150 No
Id 0144444401700100100145282201701251587326
0988
No
dFeEmiDE 2017-01-25T09:35:17 323031372d30312d32355430393a33353a3137
dRucRec/dId
enRec
88899990 No
dTotOpe 300000 No
dTotIVA 27272 No
cItems 2 No
DigestValue yzGYhUx1/XYYzksWB+fPR3Qc50c= 797a4759685578312f5859597a6b7357422b6650
523351633530633d
IdcSC 0001 No
CSC ABCD0000000000000000000000000000 No
13.8.4. Ejemplo de generación del Código QR
13.8.4.1. Paso 1 - Concatenar los datos:
```
nVersion=150&Id=0144444401700100100145282201701251587326098
```
8&dFeEmiDE=323031372d30312d32355430393a33353a3137&dRucRec
=88899990&dTotGralOpe=300000&dTotIVA=27272&cItems=2&DigestV
```
alue=797a4759685578312f5859597a6b7357422b6650523351633530633
```
d&IdCSC=0001
Si no se informan cualquiera de los siguientes campos: dTotGralOpe, dTotIVA se debe completar
```
con 0 (cero).
```
13.8.4.2. Paso 2 – Concatenar al final de los datos, del paso 1, el Código Secreto del
```
Contribuyente:
```
```
nVersion=150&Id=0144444401700100100145282201701251587326098
```
8&dFeEmiDE=323031372d30312d32355430393a33353a3137&dRucRec
=88899990&dTotGralOpe=300000&dTotIVA=27272&cItems=2&DigestV
```
alue=797a4759685578312f5859597a6b7357422b6650523351633530633
```
d&IdCSC=0001ABCD0000000000000000000000000000
septiembre de 2019 208
En este ejemplo el código secreto del contribuyente es el correspondiente al IdCSC = 0001. Si el
contribuyente tiene más de un código secreto activo, deberá especificar el IdCSC correspondiente
al código que utilizará.
El código de seguridad solo se utiliza para generar el código hash que luego será concatenado a los
datos del paso 1. Por ningún motivo el contribuyente debe compartir su código de seguridad, ni
enviar concatenado como parte de la URL del código QR.
13.8.4.3. Paso 3 – Generar el Hash con los datos del paso 2:
Para la generación del código Hash se toman los datos generados en el Paso 2 y se le aplica
el algoritmo SHA-256, el cual debe devolver un valor en codificación hexadecimal.
97ddbb3c1e7d65af03a70ffe21f2b34846ab1c89e0566c35222086766b7374ed
13.8.4.4. Paso 4 – Generar la URL para la imagen QR:
La URL final que será utilizada para generar la imagen QR es el resultado de la concatenación
```
siguiente:
```
URL QR = URL Consulta QR + Datos del Paso 1 + Hash generado en el paso 3
Donde,
URL Consulta QR:
Ambiente de Producción: https://www.ekuatia.set.gov.py/consultas/qr?
Ambiente de Test: https://www.ekuatia.set.gov.py/consultas-test/qr?
Datos del Paso 1:
```
nVersion=142&Id=01444444017001001001452822017012515873260988&dFeEmiDE
```
=323031372d30312d32355430393a33353a3137&dRucRec=88899990&dTotGralOpe=
300000&dTotIVA=27272&cItems=2&DigestValue=797a4759685578312f5859597a6b7
357422b6650523351633530633d&IdCSC=0001
```
Hash generado en el paso 3 (con su nombre de parámetro):
```
```
cHashQR=97ddbb3c1e7d65af03a70ffe21f2b34846ab1c89e0566c35222086766b7374e
```
d
URL QR:
```
https://ekuatia.set.gov.py/consultas/qr?nVersion=150&Id=014444440170010010014528
```
22017012515873260988&dFeEmiDE=323031372d30312d32355430393a33353a3137&
septiembre de 2019 209
```
dRucRec=88899990&dTotGralOpe=300000&dTotIVA=27272&cItems=2&DigestValue=7
```
97a4759685578312f5859597a6b7357422b6650523351633530633d&IdCSC=0001&cHa
```
shQR=97ddbb3c1e7d65af03a70ffe21f2b34846ab1c89e0566c35222086766b7374ed
```
Imagen QR:
13.8.4.5. Paso 5 – Insertar la URL del paso 4 en el XML:
Antes de la inserción de la URL en el XML, se deberá reemplazar los símbolos “&” por su equivalente
```
en código html, el cual es “&amp;”.
```
De esta manera la URL que se debe insertar en el XML, como valor del elemento <dCarQR> queda
como sigue:
```
https://ekuatia.set.gov.py/consultas/qr?nVersion=150&amp;Id=01444444017001001001
```
```
452822017012515873260988&amp;dFeEmiDE=323031372d30312d32355430393a333
```
```
53a3137&amp;dRucRec=88899990&amp;dTotGralOpe=300000&amp;dTotIVA=27272
```
```
&amp;cItems=2&amp;DigestValue=797a4759685578312f5859597a6b7357422b66505
```
```
23351633530633d&amp;IdCSC=0001&amp;cHashQR=97ddbb3c1e7d65af03a70ffe21f
```
2b34846ab1c89e0566c35222086766b7374ed
13.8.5. Mensajes desplegados en consulta del QR
```
a) El DTE existe en el SIFEN con situación Aprobado o Aprobado con observaciones
```
```
(Extemporáneo) – se presenta el KuDE en Cinta (para B2C) o consulta por pestañas (B2B o
```
```
B2G)
```
```
b) El DE no existe en el SIFEN
```
septiembre de 2019 210
CDC no existente en el SIFEN, consulte con el emisor del documento.
• Número del DTE: 001-001-00145282
• Tipo: Factura Electrónica
• Emisor: Empresa X – Emisor electrónico
• RUC Emisor: 44444401-7
• Fecha de emisión: 25/01/2018 09:35:30
• Cantidad de ítems: 2
• Monto Total: 300.000
• Monto Total IVA: 27272.00
```
c) El QR no es válido
```
Código QR inválido, consulte con el emisor del DE.
14. Operación de Contingencia (Futuro)
15. CODIFICACIONES
Se describen a continuación las tablas de codificaciones del sistema, para su utilización en el XML.
TABLA 1 – TIPO DE REGIMEN
Código Descripción
1 Régimen de Turismo
2 Importador
3 Exportador
4 Maquila
5 Ley N° 60/90
6 Régimen del Pequeño Productor
7 Régimen del Mediano Productor
8 Régimen Contable
TABLA 2.1 – DEPARTAMENTOS, DISTRITOS Y CIUDADES
```
Enlace: https://ekuatia.set.gov.py/portal/ekuatia/documentacion/documentaciontecnica
```
```
Archivo: CODIGO DE REFERENCIA GEOGRAFICA.xlsx
```
TABLA 2.2 - CIUDADES
Se incluirá un link de descarga dado el volumen del contenido.
septiembre de 2019 211
TABLA 3 – ACTIVIDADES ECONÓMICAS
```
https://servicios.set.gov.py/eset-publico/consultarActividadEconomicaIService.do
```
TABLA 4 – CODIFICACION DE PAISES
Utilizaremos el estándar Internacional ISO 3166-1.
Remitimos archivo en formato XSD con el estándar mencionado.
```
Referencia: https://es.wikipedia.org/wiki/ISO_3166-1#C%C3%B3digos_ISO_3166-1
```
TABLA 5 – CODIFICACION DE UNIDADES DE MEDIDA
Código Representación Descripción
87 m Metros
2366 CPM Costo por Mil
2329 UI Unidad Internacional
110 M3 Metros cúbicos
77 UNI Unidad
86 g Gramos
89 LT Litros
90 MG Miligramos
91 CM Centimetros
92 CM2 Centimetros cuadrados
93 CM3 Centimetros cubicos
94 PUL Pulgadas
96 MM2 Milímetros cuadrados
79 kg/m²
Kilogramos s/ metro
cuadrado
97 AA Año
98 ME Mes
99 TN Tonelada
100 Hs Hora
101 Mi Minuto
104 DET Determinación
103 Ya Yardas
108 MT Metros
109 M2 Metros cuadrados
95 MM Milímetros
666 Se Segundo
102 Di Día
83 kg Kilogramos
88 ML Mililitros
septiembre de 2019 212
625 Km Kilómetros
660 ml Metro lineal
885 GL Unidad Medida Global
891 pm Por Milaje
869 ha Hectáreas
569 ración Ración
TABLA 6 – CODIGOS DE AFECTACION
Código Descripción
1 Gravado IVA
```
2 Exonerado (Art.83 - 125)
```
3 Exento
4 Gravado parcial
TABLA 7 – CATEGORIAS DEL ISC
Código Descripción
```
1 Sección I - (Cigarrillos, Tabacos, Esencias y Otros derivados delTabaco)
```
```
2 Sección II - (Bebidas con y sin alcohol)
```
```
3 Sección III - (Alcoholes y Derivados del alcohol)
```
```
4 Sección IV- (Combustibles)
```
```
5 Sección V- (Artículos considerados de lujo)
```
TABLA 8 – TASAS DEL ISC
Tasas del ISC según Decretos N° 4344/04, N°
5158/10, N° 4693/15, N° 4693/15, N° 4694/15
Código Porcentaje
1 1%
2 5%
3 9%
4 10%
5 11%
6 13%
7 16%
8 18%
9 20%
10 24%
11 34%
12 38%
TABLA 9 – TIPOS DE VEHÍCULOS
septiembre de 2019 213
Agregaremos un link de descarga con la codificación a fin de agilizar su implementación.
TABLA 10 – CONDICIONES DE NEGOCIACION - INCOTERMS
Código Descripción
CFR Costo y flete
CIF Costo, seguro y flete
CIP Transporte y seguro pagados hasta
CPT Transporte pagado hasta
DAP Entregada en lugar convenido
DAT Entregada en terminal
DDP Entregada derechos pagados
EXW En fabrica
FAS Franco al costado del buque
FCA Franco transportista
FOB Franco a bordo
TABLA 11 – REGÍMENES ADUANEROS
```
http://www.aduana.gov.py/3123-4-circuitos-de-regimenes.html
```
Referencia a tablas estándares
• Tabla de Nomenclatura Común del Mercosur:
```
Referencias: http://www.sice.oas.org/Trade/MRCSRS/Resolutions/Res7006.pdf
```
```
https://sarem.mercosur.int/nomenclatura
```
• Tabla de códigos para países: Identificada por la Tabla 4
Estándar Internacional de normalización ISO 3166-1. Código Alfa-3
• Tabla de códigos para monedas:
Estándar Internacional de normalización ISO 4217
```
Referencia: https://www.currency-iso.org/en/home/tables/table-a1.html
```
septiembre de 2019 214
16. GLOSARIO TÉCNICO
Término Significado
Administración
```
Tributaria (AT) Subsecretaría de Estado de Tributación (SET)
```
Archivo
Electrónico de
Factura
```
Archivo electrónico (XML) con los datos de una factura. No ha sido
```
aún firmado digitalmente.
B2B Business to Business, acrónimo comúnmente utilizado para describirlas operaciones entre empresas.
B2C Business to Consumer, acrónimo comúnmente utilizado paradescribir las operaciones entre una empresa a un consumidor final.
B2G
Business to Government, acrónimo comúnmente utilizado para
describir las operaciones entre una empresa y una entidad de
gobierno.
B2F
Business to Foreign, acrónimo del tipo de operación para describir
los servicios prestados por una empresa nacional a una empresa o
persona física del exterior.
Certificado
Digital
Es todo mensaje de datos u otro registro emitido por una entidad
legalmente habilitada para el efecto y que confirma la vinculación
entre el titular de una firma digital y los datos de creación de la
misma.
Código de
Control del DTE
```
(CDC)
```
Número de 44 dígitos generado dentro del sistema del emisor el cual
permite identificar de manera inequívoca a un DTE, evitando
duplicidad en el envío de documentos a la SET.
Código QR
```
Un código QR (del inglés Quick Response Code, Código de
```
```
respuesta rápida) es un módulo para almacenar información en una
```
matriz de puntos o en un código de barras bidimensional.
Documento
```
Electrónico (DE)
```
Es el documento emitido y firmado digitalmente por un emisor
electrónico que aún no ha sido aprobado para su uso por parte de la
Administración Tributaria, y en consecuencia no ha ingresado al
SIFEN. Es un documento que, de acuerdo a la ley comercial, registra
una operación.
Documento
Tributario
Electrónico
```
(DTE)
```
Es el documento electrónico con aprobación de uso por parte de la
Administración Tributaria, e ingresado al SIFEN.
septiembre de 2019 215
Término Significado
Documentos
Asociados
Son los DE que pueden complementar a la factura electrónica: nota
de crédito y nota de débito.
Emisor
Contribuyente que genera el archivo electrónico, lo firma
electrónicamente y lo remite para solicitar la competente autorización
de uso.
ERP
```
La planificación de recursos empresariales (ERP, por sus siglas en
```
```
inglés) es la gestión integrada de los procesos de negocio básicos,
```
a menudo en tiempo real y mediada por software y tecnología.
Factura
Electrónica
Es el DTE que respalda la compra y venta de bienes y servicios.
Consta de un archivo electrónico que atiende simultáneamente a las
siguientes exigencias:
- Es un documento electrónico
- Tiene el formato XML de factura electrónica de acuerdo con
las definiciones legales e infra legales.
- Después de validado de acuerdo con las reglas fue aprobado
y, en consecuencia, autorizado para fines fiscales.
Facturador
Electrónico
Contribuyente autorizado por la Administración Tributaria para emitir
y recibir DTE, y que en consecuencia adquiere la naturaleza de
emisor y receptor.
Firma Digital
Firma electrónica certificada por un prestador acreditado, que ha
sido creada usando medios que el titular mantiene bajo su exclusivo
control, de manera que se vincule únicamente al mismo y a los datos
a los que se refiere, permitiendo la detección posterior de cualquier
modificación, verificando la identidad del titular e impidiendo que
desconozca la integridad del documento y su autoría.
KuDE
Palabra compuesta por dos abreviaturas. La primera abreviatura Ku
extraída de la palabra Kuatia, en guaraní que significa papel, más la
segunda abreviatura DE, propia de Documento Electrónico.
Ley Tributaria Ley No 125/1991 “Que establece el Nuevo Régimen Tributario” y susmodificaciones.
Otros
documentos
tributarios
electrónicos
Son los DTE que respaldan operaciones con incidencia tributaria
tales como: nota de remisión, autofacturas, y comprobantes de
retención.
septiembre de 2019 216
Término Significado
Prestador de
Servicios de
Certificación
```
(PSC)
```
Entidad prestadora de servicios de certificación de firmas digitales
autorizada por la Dirección General de Firma Digital y Comercio
Electrónico del Ministerio de Industria y Comercio.
Receptor
Destinatario de la factura, pudiendo ser nacional o extranjero,
persona natural o jurídica. Reglas de validación específicas deberán
ser construidas para caso de nacionales.
Representación
Gráfica
Expresión de los DE en formato físico o digital. Es la representación
impresa del DE en formado susceptible de ser visualizado, remitido
por correo electrónico o impreso de ser requerido. Incluye un código
QR para facilitar su validación.
RUC Registro Único del Contribuyente
SIFEN
```
Sistema de Facturación Electrónica Nacional; se encarga de
```
recepcionar, autorizar, almacenar y disponer los servicios de
consulta de los DTE.
Sistema
##### Marangatu Sistema de Gestión Tributaria Marangatu