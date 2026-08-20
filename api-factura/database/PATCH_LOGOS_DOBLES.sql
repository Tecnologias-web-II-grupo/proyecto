ALTER TABLE facturas
  ADD COLUMN IF NOT EXISTS emisor_logo LONGTEXT NULL AFTER emisor_correo,
  ADD COLUMN IF NOT EXISTS emisor_logo_blanco LONGTEXT NULL AFTER emisor_logo;
