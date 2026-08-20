# Cargar un logo directamente desde Postman

La API acepta un archivo real sin convertirlo manualmente a Base64.

## Opción A — Agregar/cambiar logo de una factura existente

**Método**: `PATCH`

**Ruta**:

`/api/facturas/F-XXXXXXXX/logo`

En Postman:

1. `Body` → `form-data`.
2. Agregue la key `logo`.
3. Cambie el tipo de la key de `Text` a `File`.
4. Seleccione un archivo `.png`, `.jpg`, `.jpeg` o `.webp` de máximo 500 KB.
5. Presione `Send`.

No configure manualmente `Content-Type`; Postman agrega automáticamente el boundary de `multipart/form-data`.

Respuesta esperada:

```json
{
  "id": "F-XXXXXXXX",
  "logoActualizado": true
}
```

Luego abra:

`GET /api/documentos/facturas/F-XXXXXXXX?formato=pdf&plantilla=auto`

## Opción B — Crear factura + subir logo en una sola petición

**Método**: `POST`

**Ruta**: `/api/facturas`

En `Body` → `form-data` agregue:

- `factura` (Text): pegue el JSON completo de la factura.
- `logo` (File): seleccione el archivo de imagen.

La API inserta el archivo como `emisor.logoUrl` antes de validar y guardar la factura.

## Compatibilidad

Se mantiene la forma anterior por JSON:

```json
{
  "logoUrl": "data:image/png;base64,..."
}
```
