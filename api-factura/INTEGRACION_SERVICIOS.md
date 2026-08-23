# Integración final entre servicios

Factura Bonita ya deja preparado el flujo posterior al pago. No hay que cambiar el código cuando los otros grupos entreguen sus URLs: basta con completar las variables en `.env`.

## Orden del flujo

1. BankyFinanzas confirma el pago.
2. `DIGITAL_SIGNATURE_VALIDATE_URL` valida que el negocio esté registrado/habilitado en Firma Digital.
3. Factura Bonita genera internamente su factura visual/PDF.
4. `ELECTRONIC_INVOICE_URL` recibe el JSON de la factura y devuelve el XML electrónico, XML en base64 o una URL al XML.
5. `TAXATION_URL` recibe la factura electrónica y devuelve aceptación + acuse (contenido, base64 o URL).
6. `EMAIL_DELIVERY_URL` envía al correo del cliente tres documentos: PDF visual, factura electrónica y acuse.
7. La venta cambia a `entregada` y la interfaz habilita Ver/Guardar.

## Variables que se deben completar

```env
DIGITAL_SIGNATURE_VALIDATE_URL=
DIGITAL_SIGNATURE_API_KEY=
DIGITAL_SIGNATURE_BEARER_TOKEN=

ELECTRONIC_INVOICE_URL=
ELECTRONIC_INVOICE_API_KEY=
ELECTRONIC_INVOICE_BEARER_TOKEN=

TAXATION_URL=
TAXATION_API_KEY=
TAXATION_BEARER_TOKEN=

EMAIL_DELIVERY_URL=
EMAIL_DELIVERY_API_KEY=
EMAIL_DELIVERY_BEARER_TOKEN=
```

## Respuestas toleradas

Firma Digital y Tributación pueden indicar éxito mediante campos como `ok`, `valid`, `accepted`, `approved`, `success`, o estados equivalentes (`accepted`, `aceptada`, `aprobado`, etc.).

Facturación Electrónica debe devolver por lo menos uno de estos datos:

- `xml`
- `xmlBase64`
- `xmlUrl`
- equivalentes dentro de `facturaElectronica` o `documento`

Tributación debe devolver por lo menos un acuse mediante:

- `acuse`
- `acuseBase64`
- `acuseUrl`
- `receipt`
- `receiptBase64`
- `receiptUrl`

Cuando los compañeros entreguen el contrato exacto de sus APIs, conviene adaptar los nombres de campos a ese contrato si son distintos.
