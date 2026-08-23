USE facturaBonita;

ALTER TABLE portal_ventas
  ADD COLUMN IF NOT EXISTS bank_intent_id VARCHAR(100) NULL AFTER pago_payload,
  ADD COLUMN IF NOT EXISTS bank_payment_id VARCHAR(100) NULL AFTER bank_intent_id,
  ADD COLUMN IF NOT EXISTS bank_transaction_code VARCHAR(100) NULL AFTER bank_payment_id,
  ADD COLUMN IF NOT EXISTS pago_confirmado_at DATETIME NULL AFTER bank_transaction_code;

SET @has_payment_index = (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME='portal_ventas' AND INDEX_NAME='uq_portal_ventas_bank_payment'
);
SET @sql_payment = IF(@has_payment_index=0,
  'ALTER TABLE portal_ventas ADD UNIQUE KEY uq_portal_ventas_bank_payment (bank_payment_id)',
  'SELECT 1');
PREPARE stmt FROM @sql_payment; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_tx_index = (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME='portal_ventas' AND INDEX_NAME='uq_portal_ventas_bank_transaction'
);
SET @sql_tx = IF(@has_tx_index=0,
  'ALTER TABLE portal_ventas ADD UNIQUE KEY uq_portal_ventas_bank_transaction (bank_transaction_code)',
  'SELECT 1');
PREPARE stmt2 FROM @sql_tx; EXECUTE stmt2; DEALLOCATE PREPARE stmt2;
