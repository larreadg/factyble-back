# API Factyble — Documentación de integración

**Base URL:** `https://factyble.simplifika.lat/api`

Todos los endpoints devuelven siempre el mismo sobre de respuesta (`status`, `code`, `data`, `message`):

```json
{
  "status": "success",
  "code": 200,
  "data": { },
  "message": "Operación exitosa"
}
```

En caso de error de validación de campos, `data` es un arreglo con el detalle de cada campo inválido:

```json
{
  "status": "error",
  "code": 400,
  "data": [
    { "type": "field", "value": "", "msg": "Parámetro ruc requerido", "path": "ruc", "location": "body" }
  ],
  "message": "Error de validación"
}
```

---

## 1. Autenticación

### `POST /usuario/authenticate`

Login. Para integraciones vía API se debe enviar el header `x-client-type: api`, que evita tener que resolver un captcha (obligatorio solo para el login desde el panel web).

**Headers**

| Header | Valor |
|---|---|
| `Content-Type` | `application/json` |
| `x-client-type` | `api` |

**Body**

| Campo | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `usuario` | string | Sí | Email del usuario registrado en Factyble |
| `password` | string | Sí | Contraseña |

```json
{
  "usuario": "integraciones@miempresa.com",
  "password": "********"
}
```

**Respuesta 200**

```json
{
  "status": "success",
  "code": 200,
  "data": { "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." },
  "message": "Autenticación exitosa"
}
```

El `token` es un JWT que debe enviarse en **todos** los demás endpoints como:

```
Authorization: Bearer <token>
```

El token contiene, entre otros datos, `empresaId` y `roles` — todas las consultas y emisiones quedan automáticamente acotadas a la empresa del usuario autenticado; no es posible ver ni operar datos de otra empresa. Todos los endpoints listados a continuación requieren que el usuario tenga el rol `ADMIN`.

**Errores posibles**

| Código | Motivo |
|---|---|
| 400 | Falta `usuario` o `password` |
| 401 | Usuario o contraseña incorrectos (mensaje genérico: `Error al autenticar usuario`) |
| 401 | Token inválido o no enviado (en endpoints protegidos) |
| 403 | El usuario no tiene el rol requerido (`Permiso denegado`) |

---

## 2. Facturas

### `GET /factura/`

Lista las facturas de la empresa del usuario autenticado, paginadas.

**Headers:** `Authorization: Bearer <token>`

**Query params**

| Param | Tipo | Default | Descripción |
|---|---|---|---|
| `page` | int | 1 | Página |
| `itemsPerPage` | int | 10 | Cantidad de registros por página |
| `filter` | string | — | Busca por RUC/documento, nombre/apellido/razón social o email del cliente, por CDC, o por número de factura (si es numérico) |

```
GET /factura/?page=1&itemsPerPage=20&filter=80012345
```

**Respuesta 200**

```json
{
  "status": "success",
  "code": 200,
  "data": {
    "items": [
      {
        "id": 101,
        "numero_factura": "001-001-0000123",
        "factura_uuid": "a1b2c3d4-...",
        "condicion_venta": "CONTADO",
        "total": 220000,
        "total_iva": 20000,
        "cdc": "01800123450010010000012320260712123456789012",
        "estado_sifen": "APROBADO",
        "sifen_cod_respuesta": "0260",
        "linkqr": "https://ekuatia.set.gov.py/consultas/qr?...",
        "xml_firmado": "<rDE>...</rDE>",
        "fecha_creacion": "2026-07-12T13:00:00.000Z",
        "detalles": [
          {
            "id": 501,
            "cantidad": 2,
            "precio_unitario": 100000,
            "tasa": "T10",
            "impuesto": 18182,
            "total": 200000,
            "descripcion": "Servicio de consultoría"
          }
        ],
        "cliente_empresa": {
          "cliente": {
            "ruc": "80012345-6",
            "razon_social": "Cliente SA",
            "email": "cliente@empresa.com"
          }
        },
        "eventos_sifen": []
      }
    ],
    "page": 1,
    "itemsPerPage": 20,
    "totalItems": 1
  },
  "message": "Datos obtenidos"
}
```

### `GET /factura/:id`

Detalle de una factura por ID interno.

**Headers:** `Authorization: Bearer <token>`

**Respuesta 200:** mismo objeto de factura que en el listado (incluye `detalles` y `eventos_sifen`).

**Errores:** `404` si el `id` no existe (`Factura con ID {id} no encontrado`).

### `POST /factura/`

Emite una factura electrónica. La firma y el envío a SIFEN se ejecutan de forma síncrona: si la respuesta es 200, la factura ya quedó firmada (`xml_firmado` presente) y encolada/enviada al pipeline SIFEN.

**Headers:** `Authorization: Bearer <token>`, `Content-Type: application/json`

**Body — nivel raíz**

| Campo | Tipo | Obligatorio | Valores / formato | Descripción |
|---|---|---|---|---|
| `ruc` | string | Sí | — | RUC o documento del cliente/receptor |
| `razonSocial` | string | Sí | `"Apellido, Nombre"` o razón social | Se usa para derivar `nombres`/`apellidos` del cliente |
| `situacionTributaria` | string | Sí | `CONTRIBUYENTE` \| `NO_CONTRIBUYENTE` \| `NO_DOMICILIADO` | Si es `CONTRIBUYENTE`, `tipoIdentificacion` se fuerza a `RUC` y `pais` a `PRY` |
| `tipoIdentificacion` | string | Recomendado | `CEDULA` \| `CARNE_DE_RESIDENCIA` \| `PASAPORTE` \| `IDENTIFICACION_TRIBUTARIA` \| `RUC` | No tiene validación explícita de tipo, pero es usado por el motor de emisión; enviarlo siempre salvo `CONTRIBUYENTE` |
| `direccion` | string | No | — | Dirección del cliente |
| `email` | string | Sí | email válido | Email del cliente (recibe el KuDE) |
| `telefono` | string | No | — | Teléfono del cliente |
| `pais` | string | No | código país (ej. `PRY`) | Se fuerza a `PRY` si `situacionTributaria=CONTRIBUYENTE` o si viene vacío |
| `condicionVenta` | string | Sí | `CONTADO` \| `CREDITO` | |
| `tipoCredito` | string | Solo si `condicionVenta=CREDITO` | `CUOTA` \| `A_PLAZO` | |
| `periodicidad` | string | Solo si `condicionVenta=CREDITO` | `SEMANAL` \| `QUINCENAL` \| `MENSUAL` \| `TRIMESTRAL` \| `SEMESTRAL` \| `ANUAL` | |
| `cantidadCuota` | number | Solo si `condicionVenta=CREDITO` y `tipoCredito=CUOTA` | entero > 0 | |
| `plazoDescripcion` | string | Solo si `condicionVenta=CREDITO` y `tipoCredito=A_PLAZO` | — | |
| `total` | number | Sí | debe ser igual a la suma de `items[].total` | Total de la factura |
| `totalIva` | number | Sí | debe ser igual a la suma de `items[].impuesto` | Total de IVA |
| `establecimiento` | string | Sí | 3 dígitos, ej. `"001"` | Código de establecimiento (**siempre string**, no número) |
| `caja` | string | Sí | 3 dígitos, ej. `"001"` | Código de caja dentro del establecimiento (**siempre string**) |
| `items` | array (min. 1) | Sí | ver tabla siguiente | Detalle de la factura |

**Body — cada elemento de `items`**

| Campo | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `cantidad` | int | Sí | Cantidad |
| `precioUnitario` | number | Sí | Precio unitario |
| `tasa` | string | Sí | `"0%"` \| `"5%"` \| `"10%"` |
| `impuesto` | number | Sí | Debe ser exactamente el IVA calculado para `cantidad`/`precioUnitario`/`tasa` (el servidor recalcula y compara) |
| `total` | number | Sí | Debe ser exactamente `cantidad * precioUnitario` |
| `descripcion` | string | Sí | Descripción del ítem |

> El servidor recalcula impuesto y totales de cada ítem y los compara con lo enviado. Si no coinciden exactamente, devuelve `400 Datos proporcionados incorrectos`.

**Ejemplo — factura de contado**

```json
{
  "ruc": "80012345-6",
  "razonSocial": "Pérez, Juan",
  "situacionTributaria": "CONTRIBUYENTE",
  "tipoIdentificacion": "RUC",
  "email": "juan.perez@cliente.com",
  "direccion": "Av. España 123",
  "telefono": "0981123456",
  "condicionVenta": "CONTADO",
  "total": 220000,
  "totalIva": 20000,
  "establecimiento": "001",
  "caja": "001",
  "items": [
    {
      "cantidad": 2,
      "precioUnitario": 100000,
      "tasa": "10%",
      "impuesto": 18182,
      "total": 200000,
      "descripcion": "Servicio de consultoría"
    },
    {
      "cantidad": 1,
      "precioUnitario": 20000,
      "tasa": "0%",
      "impuesto": 0,
      "total": 20000,
      "descripcion": "Insumo exento"
    }
  ]
}
```

**Ejemplo — factura a crédito (cuotas)**

```json
{
  "ruc": "80012345-6",
  "razonSocial": "Pérez, Juan",
  "situacionTributaria": "CONTRIBUYENTE",
  "tipoIdentificacion": "RUC",
  "email": "juan.perez@cliente.com",
  "condicionVenta": "CREDITO",
  "tipoCredito": "CUOTA",
  "periodicidad": "MENSUAL",
  "cantidadCuota": 6,
  "total": 220000,
  "totalIva": 20000,
  "establecimiento": "001",
  "caja": "001",
  "items": [
    {
      "cantidad": 1,
      "precioUnitario": 200000,
      "tasa": "10%",
      "impuesto": 18182,
      "total": 200000,
      "descripcion": "Equipo"
    }
  ]
}
```

**Respuesta 200**

```json
{
  "status": "success",
  "code": 200,
  "data": {
    "id": 101,
    "numero_factura": "001-001-0000123",
    "cdc": "01800123450010010000012320260712123456789012",
    "estado_sifen": "FIRMADO",
    "xml_firmado": "<rDE>...</rDE>",
    "linkqr": "https://ekuatia.set.gov.py/consultas/qr?..."
  },
  "message": "Factura creada"
}
```

**Errores posibles**

| Código | Motivo |
|---|---|
| 400 | Validación de campos, o descuadre entre `items` y totales/impuestos declarados |
| 404 | No se encontró el `establecimiento` o `caja` indicados para la empresa |
| 500 | Error interno / SIFEN |

### `POST /factura/reenviar`

Reenvía por correo el KuDE/XML de una factura ya aprobada.

**Headers:** `Authorization: Bearer <token>`

**Body**

| Campo | Tipo | Obligatorio |
|---|---|---|
| `email` | string (email) | Sí |
| `facturaId` | int | Sí |

**Errores:** `404` si la factura no existe o no está aprobada (`La factura no existe`).

**Respuesta 200:** `{ "status": "success", "code": 200, "data": null, "message": "Datos obtenidos" }`

---

## 3. Notas de crédito

### `GET /nota-credito/`

Lista las notas de crédito de la empresa del usuario autenticado. No existe endpoint de detalle por ID.

**Headers:** `Authorization: Bearer <token>`

**Query params**

| Param | Tipo | Default | Descripción |
|---|---|---|---|
| `page` | int | 1 | Página |
| `itemsPerPage` | int | 10 | Registros por página |
| `filter` | string | — | Si se envía, busca la factura por `cdc` o por `numero_factura` (numérico, hasta 7 dígitos) y lista solo sus notas de crédito |

**Respuesta 200**

```json
{
  "status": "success",
  "code": 200,
  "data": {
    "items": [
      {
        "id": 55,
        "numero_nota_credito": "001-001-0000010",
        "factura_id": 101,
        "cdc": "05800123450010010000001020260712123456789012",
        "estado_sifen": "APROBADO",
        "total": 50000,
        "total_iva": 4546,
        "linkqr": "https://ekuatia.set.gov.py/consultas/qr?...",
        "factura": { "id": 101, "numero_factura": "001-001-0000123" },
        "eventos_sifen": []
      }
    ],
    "page": 1,
    "itemsPerPage": 10,
    "totalItems": 1
  },
  "message": "Notas de crédito obtenidas"
}
```

### `POST /nota-credito/`

Emite una nota de crédito asociada a una factura ya **aprobada** y no cancelada. El receptor (cliente) se toma automáticamente de la factura referenciada — no se envía RUC/razón social.

**Headers:** `Authorization: Bearer <token>`, `Content-Type: application/json`

**Body — nivel raíz**

| Campo | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `cdc` | string | Sí | CDC de la factura a la que se aplica la nota de crédito |
| `total` | number | Sí | Debe ser igual a la suma de `items[].total` |
| `totalIva` | number | Sí | Debe ser igual a la suma de `items[].impuesto` |
| `establecimiento` | string | Sí | 3 dígitos, ej. `"001"` |
| `caja` | string | Sí | 3 dígitos, ej. `"001"` |
| `items` | array (min. 1) | Sí | Mismo formato que en factura: `cantidad`, `precioUnitario`, `tasa` (`"0%"`\|`"5%"`\|`"10%"`), `impuesto`, `total`, `descripcion` |

**Ejemplo**

```json
{
  "cdc": "01800123450010010000012320260712123456789012",
  "total": 50000,
  "totalIva": 4546,
  "establecimiento": "001",
  "caja": "001",
  "items": [
    {
      "cantidad": 1,
      "precioUnitario": 50000,
      "tasa": "10%",
      "impuesto": 4546,
      "total": 50000,
      "descripcion": "Devolución parcial - Servicio de consultoría"
    }
  ]
}
```

**Respuesta 200**

```json
{
  "status": "success",
  "code": 200,
  "data": {
    "id": 55,
    "numero_nota_credito": "001-001-0000010",
    "cdc": "05800123450010010000001020260712123456789012",
    "estado_sifen": "FIRMADO",
    "xml_firmado": "<rDE>...</rDE>",
    "linkqr": "https://ekuatia.set.gov.py/consultas/qr?..."
  },
  "message": "Nota de crédito creada"
}
```

**Errores posibles**

| Código | Motivo |
|---|---|
| 400 | Validación de campos, o descuadre entre `items` y totales/impuestos |
| 404 | No se encontró `establecimiento`/`caja`, o no existe factura con ese `cdc` |
| 400 | La factura está cancelada (`La factura se encuentra cancelada`) |
| 400 | La factura no está aprobada (`La factura aún no se ha aprobado`) |
| 400 | El total de notas de crédito (previas + actual) supera el total de la factura |

### `POST /nota-credito/reenviar`

Reenvía por correo el KuDE/XML de una nota de crédito ya aprobada.

**Headers:** `Authorization: Bearer <token>`

**Body**

| Campo | Tipo | Obligatorio |
|---|---|---|
| `email` | string (email) | Sí |
| `notaDeCreditoId` | int | Sí |

**Errores:** `404` si no existe o no está aprobada (`La nota de crédito no existe`).

---

## 4. Cancelación (eventos SIFEN)

Solo se puede cancelar un documento en estado `APROBADO`. La cancelación es un evento síncrono ante SIFEN: la respuesta ya refleja el resultado.

### `POST /factura/cancelar`

**Headers:** `Authorization: Bearer <token>`

**Body**

| Campo | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `facturaId` | int | Sí | ID interno de la factura (no es el CDC) |
| `motivo` | string | Sí | Motivo de la cancelación. SIFEN exige entre 5 y 500 caracteres — respetar ese rango aunque la validación del servidor solo exige que no esté vacío |

```json
{
  "facturaId": 101,
  "motivo": "Anulación por error en la carga de datos del cliente"
}
```

**Respuesta 200**

```json
{
  "status": "success",
  "code": 200,
  "data": {
    "eventoId": 12,
    "estadoSifen": "CANCELADO",
    "codigoRespuesta": "0260",
    "mensajeRespuesta": "Evento Procesado"
  },
  "message": "Solicitud procesada"
}
```

**Errores posibles**

| Código | Motivo |
|---|---|
| 404 | La factura no existe o no pertenece a la empresa del usuario |
| 400 | La factura ya está cancelada |
| 400 | La factura tiene una o más notas de crédito no canceladas asociadas |
| 400 | El documento no está en estado `APROBADO` |
| 400 | El documento no tiene caja asignada |

### `POST /nota-credito/cancelar`

**Headers:** `Authorization: Bearer <token>`

**Body**

| Campo | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `notaDeCreditoId` | int | Sí | ID interno de la nota de crédito |
| `motivo` | string | Sí | Motivo de la cancelación (mismo rango recomendado 5–500 caracteres) |

```json
{
  "notaDeCreditoId": 55,
  "motivo": "Anulación por error en el monto de la devolución"
}
```

**Respuesta 200:** mismo formato que la cancelación de factura.

**Errores posibles**

| Código | Motivo |
|---|---|
| 404 | La nota de crédito no existe o no pertenece a la empresa del usuario |
| 400 | La nota de crédito ya está cancelada |
| 400 | El documento no está en estado `APROBADO` |
| 400 | El documento no tiene caja asignada |

---

## 5. Notas generales importantes

- **`establecimiento` y `caja` siempre van como string de 3 dígitos** (ej. `"001"`), nunca como número — un valor numérico sin comillas falla la validación.
- **`tasa` en los ítems** se envía como string con el símbolo de porcentaje: `"0%"`, `"5%"`, `"10%"`.
- El servidor **recalcula** el impuesto y el total de cada ítem del lado del servidor; si el valor enviado no coincide exactamente con el calculado, la emisión se rechaza con `400`.
- Todas las consultas y emisiones están **acotadas a la empresa del token** — no es posible listar ni operar documentos de otra empresa.
- El JWT no tiene endpoint de refresh — cuando expira (`JWT_EXPIRES_IN`), hay que volver a autenticar.
- Errores de validación (`400`) siempre devuelven en `data` un arreglo con el detalle campo por campo (`path`, `msg`), útil para mostrar el error exacto al usuario final.
