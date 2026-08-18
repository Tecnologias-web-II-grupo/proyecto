# Contrato de consumo - API de facturación al cliente

Este servicio es independiente del micrositio que lo consuma. No está amarrado a EduControl.

## Flujo compartido

1. El micrositio envía la venta a `POST /api/facturas`.
2. El API guarda la factura y retorna el objeto registrado con su `id`.
3. Cualquier servicio autorizado puede recuperar los datos normalizados con `GET /api/facturas/:id`.
4. El PDF de solo lectura se obtiene con `GET /api/documentos/facturas/:id?formato=pdf`.

## Ejemplo mínimo

```json
{
  "fecha": "2026-08-18T01:48:59.000Z",
  "moneda": "CRC",
  "condicionVenta": "01",
  "medioPago": "99",
  "emisor": {
    "nombre": "Nombre del negocio",
    "identificacion": { "tipo": "02", "numero": "3-101-000000" },
    "correo": "facturacion@negocio.com",
    "logoUrl": "data:image/png;base64,..."
  },
  "receptor": {
    "nombre": "Nombre del cliente",
    "identificacion": { "tipo": "01", "numero": "111111111" },
    "correo": "cliente@correo.com"
  },
  "items": [
    {
      "numeroLinea": 1,
      "detalle": "Servicio",
      "cantidad": 1,
      "precioUnitario": 35000,
      "descuento": 0,
      "impuesto": { "tarifa": 0 },
      "subtotal": 35000,
      "montoTotalLinea": 35000
    }
  ],
  "totales": {
    "totalGravado": 0,
    "totalExento": 35000,
    "totalDescuentos": 0,
    "totalImpuesto": 0,
    "totalComprobante": 35000
  }
}
```

## Logo

`emisor.logoUrl` es opcional y debe ser una data URL PNG, JPG o WEBP. Si no se envía logo, la plantilla utiliza las iniciales del nombre del emisor. Esto permite que cada micrositio use su propia identidad visual sin modificar el API.

## CORS

Las llamadas servicio-a-servicio no requieren CORS. Para consumo directo desde navegadores, `FRONTEND_URL` acepta una lista separada por comas. Para una demostración controlada puede configurarse `CORS_ALLOW_ALL=true`.
