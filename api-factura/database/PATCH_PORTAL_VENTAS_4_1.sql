USE facturaBonita;

-- Ejecutar solo si se conserva una base creada con una versión anterior del portal.
-- En una instalación nueva BaseFactura.sql ya contiene esta columna.
ALTER TABLE portal_ventas
  ADD COLUMN datos_venta_json LONGTEXT NULL AFTER items_json;
