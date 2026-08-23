-- Corrige instalaciones existentes donde portal_integraciones.mensaje quedó con longitud corta.
ALTER TABLE portal_integraciones
  MODIFY COLUMN endpoint VARCHAR(1000) NULL,
  MODIFY COLUMN mensaje TEXT NULL,
  MODIFY COLUMN request_json LONGTEXT NULL,
  MODIFY COLUMN response_json LONGTEXT NULL;
