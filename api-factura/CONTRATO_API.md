# API compartida de facturación

Este servicio recibe facturas desde distintos proyectos, las almacena y permite consultar sus datos o generar un PDF visual de solo lectura.

## Endpoints

- `POST /api/facturas`: registra una factura.
- `GET /api/facturas/:id`: devuelve una factura completa en JSON.
- `GET /api/facturas?origen=...&referenciaExterna=...&limit=...&offset=...`: consulta el histórico resumido.
- `PATCH /api/facturas/:id/logo`: actualiza el logo visual de una factura existente.
- `GET /api/documentos/facturas/:id?formato=pdf`: genera o recupera el PDF.
- `GET /health`: estado ligero del API.
- `GET /health/documentos`: estado del motor PDF, cola y navegador.

## Interoperabilidad

Cada proyecto puede enviar `origen` y `referenciaExterna`. La combinación permite que una misma operación sea idempotente: si el cliente reintenta por un timeout, el API reutiliza la factura existente en vez de crear un duplicado.

Ejemplo:

```json
{
  "origen": "mi-proyecto",
  "referenciaExterna": "venta:12345",
  "fecha": "2026-08-19T20:00:00-06:00",
  "moneda": "CRC",
  "condicionVenta": "01",
  "medioPago": "04",
  "emisor": {
    "nombre": "Mi Negocio",
    "identificacion": { "tipo": "02", "numero": "3-101-000000" },
    "correo": "facturacion@minegocio.com",
    "logoUrl": "data:image/png;base64,..."
  },
  "receptor": {
    "nombre": "Cliente",
    "identificacion": { "tipo": "01", "numero": "101110111" },
    "correo": "cliente@example.com"
  },
  "items": [
    {
      "numeroLinea": 1,
      "detalle": "Servicio",
      "cantidad": 1,
      "precioUnitario": 10000,
      "descuento": 0,
      "impuesto": { "tarifa": 0 },
      "subtotal": 10000,
      "montoTotalLinea": 10000
    }
  ],
  "totales": {
    "totalGravado": 0,
    "totalExento": 10000,
    "totalDescuentos": 0,
    "totalImpuesto": 0,
    "totalComprobante": 10000
  }
}
```

## Logo

`emisor.logoUrl` es opcional. Debe enviarse como data URL PNG, JPG o WEBP de hasta 500 KB. De esta manera cada proyecto puede usar su propio logo sin depender de rutas locales del servidor.

## Rendimiento del PDF

Chrome se mantiene abierto y reutilizable. Las solicitudes PDF se atienden con concurrencia controlada y cola; además, documentos idénticos se coalescen y se almacenan temporalmente en memoria. El servicio solo devuelve capacidad temporal cuando la cola realmente alcanza el límite configurado.

## Idempotencia y facturas por operación

Cada sistema consumidor debe enviar un `origen` estable y una `referenciaExterna` única por operación/cargo/venta. La misma combinación se considera la misma factura y se reutiliza para evitar duplicados.

Ejemplos:

- `origen: "educontrol"`, `referenciaExterna: "cargo:15"` -> una factura para ese cargo.
- `origen: "educontrol"`, `referenciaExterna: "cargo:22"` -> otra factura distinta, aunque pertenezca al mismo estudiante.
- Otro proyecto puede usar `origen: "tienda-grupo-4"`, `referenciaExterna: "venta:903"` sin mezclarse con EduControl.

Esto permite que un mismo cliente/persona tenga tantas facturas como operaciones distintas haya pagado, manteniendo cada comprobante consultable de forma independiente.
