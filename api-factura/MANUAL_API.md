# Manual base — API de Facturación al Cliente

## Propósito
Servicio REST compartido para registrar facturas al cliente, consultarlas en JSON y generar su representación visual en PDF de solo lectura.

## URL base
`https://proyecto-kn7p.onrender.com`

## Formato de comunicación
- Solicitudes y respuestas de datos: `application/json`.
- Logo opcional: `multipart/form-data` con campo `logo`, o `emisor.logoUrl` como data URL.
- Documento visual: `application/pdf`.

## Endpoints principales

### Crear factura
`POST /api/facturas`

Recibe el JSON de la factura y devuelve el registro creado con su `id`.

### Consultar factura
`GET /api/facturas/:id`

Devuelve la factura completa en JSON. Este es el endpoint recomendado para que otros servicios consuman los datos sin acceder a la base de datos.

### Listar facturas
`GET /api/facturas`

Filtros disponibles según contrato: `origen`, `referenciaExterna`, `limit`, `offset`.

### Obtener PDF
`GET /api/documentos/facturas/:id?formato=pdf&plantilla=auto`

- `auto`: EduControl si `origen=educontrol`; genérica para otros sistemas.
- `educontrol`: fuerza plantilla EduControl.
- `generica`: fuerza plantilla genérica.

### Actualizar logo
`PATCH /api/facturas/:id/logo`

Postman: Body → form-data → key `logo` → Type `File` → seleccionar PNG/JPG/WEBP.

### Estado y contrato
- `GET /health`
- `GET /health/documentos`
- `GET /api/contrato`
- `GET /` o `GET /docs` para documentación web.

## Integración con otros servicios
1. El sistema vendedor crea la factura mediante `POST /api/facturas`.
2. La API devuelve un identificador `F-XXXXXXXX`.
3. Otro backend consulta `GET /api/facturas/F-XXXXXXXX`.
4. Recibe el mismo contrato JSON y continúa con su propio proceso.

No se requiere acceso directo a la base de datos.
