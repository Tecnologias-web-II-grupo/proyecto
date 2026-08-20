-- Compatibilidad del comprobante visual con logo por emisor.
-- El API también crea esta columna automáticamente si falta.
ALTER TABLE facturas
  ADD COLUMN emisor_logo LONGTEXT NULL AFTER emisor_correo;
