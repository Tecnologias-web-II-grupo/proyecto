USE facturaBonita;

CREATE TABLE IF NOT EXISTS portal_clientes (
  id BIGINT NOT NULL AUTO_INCREMENT,
  usuario_id CHAR(36) NOT NULL,
  nombre VARCHAR(160) NOT NULL,
  nombre_comercial VARCHAR(160) NULL,
  tipo_identificacion VARCHAR(2) NOT NULL,
  numero_identificacion VARBINARY(255) NOT NULL,
  identificacion_hash CHAR(64) NOT NULL,
  correo VARCHAR(160) NOT NULL,
  actividad_economica VARCHAR(12) NULL,
  telefono VARCHAR(30) NULL,
  provincia VARCHAR(3) NULL,
  canton VARCHAR(3) NULL,
  distrito VARCHAR(3) NULL,
  otras_senas VARCHAR(255) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_portal_cliente_usuario_identificacion (usuario_id, tipo_identificacion, identificacion_hash),
  KEY idx_portal_clientes_usuario (usuario_id),
  CONSTRAINT fk_portal_cliente_usuario FOREIGN KEY (usuario_id) REFERENCES portal_usuarios(id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
