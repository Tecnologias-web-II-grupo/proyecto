# API Factura al Cliente — Guía de integración

Base pública usada en las pruebas:

`https://proyecto-kn7p.onrender.com`

## 1. Crear una factura

`POST /api/facturas`

Enviar `Content-Type: application/json` y usar como body uno de los ejemplos en `ejemplos-json/`.

La respuesta devuelve la factura completa e incluye el `id`, por ejemplo `F-0F38A222`.

## 2. Obtener la factura como JSON

`GET /api/facturas/{id}`

Esta ruta no lleva body JSON. El identificador viaja en la URL. Es la ruta recomendada para que otros servicios recuperen los datos de una factura sin acceder a la base de datos.

## 3. Obtener el PDF

Automático:

`GET /api/documentos/facturas/{id}?formato=pdf&plantilla=auto`

- Si `origen=educontrol` (o el emisor contiene EduControl) usa la plantilla de EduControl.
- Para otros sistemas usa la plantilla genérica.

También se puede forzar:

- `plantilla=educontrol`
- `plantilla=generica`

La respuesta es `application/pdf`, no JSON.

## 4. Logo

El logo es opcional y pertenece al emisor. Puede enviarse al crear la factura:

```json
{
  "emisor": {
    "logoUrl": "data:image/png;base64,..."
  }
}
```

Formatos: PNG, JPG/JPEG o WEBP. Máximo: 500 KB.

También puede actualizarse después:

`PATCH /api/facturas/{id}/logo`

```json
{
  "logoUrl": "data:image/png;base64,..."
}
```

Si no se envía logo, el PDF genera un recuadro con las iniciales del emisor.

## 5. Idempotencia / no duplicar

Para sistemas externos se recomienda enviar siempre:

```json
{
  "origen": "nombre-del-sistema",
  "referenciaExterna": "venta:123"
}
```

La misma combinación `origen + referenciaExterna` representa la misma operación. Esto evita crear dos facturas por reintentos de red o doble envío.

## 6. Flujo para otro servicio

1. El sistema vendedor crea la factura con `POST /api/facturas`.
2. Guarda el `id` recibido.
3. El cliente puede ver el PDF con `GET /api/documentos/facturas/{id}`.
4. Otro servicio que necesite los datos consulta `GET /api/facturas/{id}` y recibe el JSON estructurado.

Este API termina en el comprobante visual / JSON de factura. No genera XML de factura electrónica, firma digital ni procesos tributarios.
