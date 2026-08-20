ALTER TABLE facturas
  ADD COLUMN IF NOT EXISTS emisor_logo LONGTEXT NULL,
  ADD COLUMN IF NOT EXISTS referencia_externa VARCHAR(100) NULL,
  ADD COLUMN IF NOT EXISTS origen VARCHAR(80) NULL,
  ADD COLUMN IF NOT EXISTS datos_v44 LONGTEXT NULL;

CREATE INDEX IF NOT EXISTS idx_facturas_origen_referencia
  ON facturas (origen, referencia_externa);
