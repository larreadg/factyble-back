# `oeeRucs.json` — catálogo de Organismos y Entidades del Estado

Lista de RUC que SIFEN considera OEE. `oeeService.sembrarCatalogoOee()` la usa para poblar
`padron_ruc.es_oee`, que a su vez determina si un DE sale como B2G (`iTiOpe=3`).

**Por qué existe este archivo:** ninguna fuente automática dice qué RUC es un OEE.

| Fuente | Qué trae | ¿Dice si es OEE? |
|---|---|---|
| TXT del padrón DNIT | `ruc\|razonSocial\|dv\|rucAnterior\|estado\|` | No — son 5 campos y ninguno es este |
| WS `siConsRUC` | `ContenedorRUC_v150.xsd`, campos ContRUC01-06 | No |
| Open data DNCP | entidades contratantes con código `DNCP-SICP-CODE-nnn` | Identifica la entidad, **pero nunca publica su RUC** |

Sin esta lista, la única señal es el rechazo 1332 de SIFEN, que llega cuando la factura ya se emitió
y se rechazó (ver `loteService.marcarReceptorComoOee`, que sigue funcionando como red de seguridad
para lo que este catálogo no cubra).

## Cómo se derivó

1. **Entidades**: descargas OCDS públicas de la DNCP, sin API key, años 2024, 2025 y 2026:
   `https://www.contrataciones.gov.py/images/opendata-v3/final/ocds/{año}/ten-masivo.zip`.
   De `records.csv` se toman `compiledRelease/buyer/{id,name}` y
   `compiledRelease/tender/procuringEntity/{id,name}`. Resultado: **441 entidades distintas**
   (390 aparecen en 2026; los otros años aportan 51 que no licitaron este año).

2. **RUC**: como la DNCP no lo publica, se obtiene cruzando la razón social contra
   `padron_ruc` (universo `ruc LIKE '800%' OR '801%'` — se verificó que ninguna fila con nombre
   institucional cae fuera de esos prefijos). Dos pasadas:
   - **Exacta** sobre la razón social normalizada (sin acentos, mayúsculas, sin la sigla final entre
     paréntesis o tras guion, sin el sufijo `/ Entidad padre`, con abreviaturas expandidas —
     `GRAL`→`GENERAL`, `MCAL`→`MARISCAL`, `DR`→`DOCTOR`…): **348 entidades**.
   - **Por tokens** (Jaccard ≥ 0.8) para las que no matchearon exacto: **6 más**.

3. **Revisión manual** de los 66 matches con similitud entre 0.5 y 0.8: **43 aceptados,
   23 rechazados** (abajo).

**Total: 392 RUC distintos.** Control de sanidad: los tres OEE conocidos de antemano —ANDE
`80009735-1`, BCP `80009769-6` (los dos que el backend PHP legacy tenía hardcodeados) y MEC
`80005190-4` (el que produjo el rechazo que originó todo esto)— los resuelve el método solo, sin
haber sido sembrados a mano.

## Criterio de la revisión: ante la duda, rechazar

La asimetría manda. Un **falso negativo** produce un rechazo 1332, que se autocorrige y solo cuesta
reemitir el documento. Un **falso positivo** emite B2G a un contribuyente privado, con datos
fiscales incorrectos ya declarados a la SET. Por eso el corte automático está en 0.8 y todo lo de
abajo pasó por ojo humano.

### Los 23 matches rechazados

Casi todos son la misma trampa: una organización *satélite* de la entidad estatal (sindicato de sus
funcionarios, fundación, club) o una empresa privada con nombre parecido.

| Entidad DNCP | Con qué matcheó | Por qué se rechazó |
|---|---|---|
| Caja de Jubilaciones … Bancarios | SINDICATO DE FUNCIONARIOS DE LA CAJA… | es el sindicato, no la Caja |
| Municipalidad de San Ignacio | SAN IGNACIO SA | empresa privada |
| Hospital Gral. Pediátrico Acosta Ñu | SINDICATO DE TRABAJADORES DE LA SALUD… | sindicato |
| Caja de Jubilaciones … de la Ande | CAJA JUBILACIONES … MUNINCIPAL | es la Caja Municipal, otra entidad |
| Municipalidad de Fernando de la Mora | FERNANDO DE LA MORA SA | empresa privada |
| SENAVE | SINDICATO … (SIFUSENAVE) | sindicato |
| Hospital Nacional | FUNDACION HOSPITAL NACIONAL | otra persona jurídica |
| Cañas Paraguayas (CAPASA) | ALAS PARAGUAYAS S.A. | empresa distinta |
| Municipalidad de Cárlos Antonio López | CLUB CARLOS ANTONIO LOPEZ | club deportivo |
| Fac. Ciencias Económicas (UNA / UNE / UNCA) | FACULTAD … UNIVERSIDAD DEL CAAGUAZU | ambiguo entre tres universidades (3 entradas) |
| DINAC | SINDICATO … (SEODINAC) | sindicato |
| Instituto Nacional del Cáncer | INSTITUTO NACIONAL DE SALUD | otro instituto |
| Gobierno Departamental de Central | GOBIERNO DEPARTAMENTAL DE CAAZAPA | otro departamento |
| SENAD | SECRETARIA NACIONAL DE CULTURA | otra entidad |
| Vicepresidencia de la República | LA REPUBLICA SRL | empresa privada |
| Circunscripción Judicial Alto Paraguay | CIRCUNSCRIPCION JUDICIAL DE ALTO PARANA | otro departamento |
| Facultad de Arquitectura / UNA | ASOCIACION DE DOCENTES DE LA FACULTAD… | asociación de docentes |
| Fac. Ciencias Sociales / UNCA | FLACSO | institución distinta |
| Municipalidad de Escobar | MUNICIPALIDAD GENERAL PATRICIO ESCOBAR | otro distrito |
| Fac. Enfermería y Obstetricia / UNCA | FACULTAD … DE LA UNA | otra universidad |
| Municipalidad de Azotey | AZOTEY SA | empresa privada |

## Lo que el catálogo NO cubre

- **Entidades sin RUC en nuestro padrón.** Las municipalidades de Guajayvi, Azotey, Ybytimí,
  Tebicuarymí y Desmochados, más la Vicepresidencia, no tienen fila propia en `padron_ruc` (se
  buscaron por nombre en la tabla completa, no solo por prefijo). No se inventan filas.
- **Subunidades que comparten el RUC del organismo padre** (circunscripciones judiciales, facultades,
  unidades de las FFAA). No agregan RUC nuevos, así que su ausencia es inocua.
- **Organismos que no licitaron entre 2024 y 2026.** No aparecen en el open data de la DNCP.

Todo eso lo cubre la automarcación por 1332: cuesta un documento rechazado y una reemisión.

## Cómo refrescarlo

No hay script automático (ver la nota al pie). El procedimiento es el de arriba: bajar los ZIP del
año nuevo, extraer entidades de `records.csv`, cruzar contra `padron_ruc`, revisar a mano la franja
0.5–0.8 con el criterio de esta página, y regenerar el JSON. Después, `npm run seed:oee`.

## Cómo se aplica

La **siembra inicial vive dentro de la migración** `20260904120000_padron_ruc_cliente_es_oee`, junto
con el `ALTER TABLE` que crea la columna: una `es_oee` vacía no es un estado válido de la aplicación,
así que columna y contenido son la misma unidad de despliegue. No hace falta ningún paso manual
después de migrar.

`npm run seed:oee` corre lo mismo desde `oeeService.sembrarCatalogoOee()` y sirve para **resembrar**
cuando se agreguen RUC a este archivo sin escribir una migración nueva. Los dos son idempotentes.

> **Nota:** el generador (descarga + cruce + aplicación de las decisiones) quedó sin escribir. El
> cruce se hizo con scripts descartables, siguiendo la convención de verificación del repo. Se
> documentó el procedimiento en vez de automatizarlo porque corre a lo sumo una vez al año y la
> parte que importa —la revisión de los ambiguos— no es automatizable de todos modos.
