const pool = require('../db/database');

async function columnExists(table, column) {
  const [rows] = await pool.execute(
    `SELECT 1 FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND COLUMN_NAME=? LIMIT 1`,
    [table, column]
  );
  return rows.length > 0;
}

async function ensureColumn(table, column, definition) {
  if (!(await columnExists(table, column))) {
    await pool.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

async function indexExists(table, indexName) {
  const [rows] = await pool.execute(
    `SELECT 1 FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND INDEX_NAME=? LIMIT 1`,
    [table, indexName]
  );
  return rows.length > 0;
}

async function ensureIndex(table, indexName, sql) {
  if (!(await indexExists(table, indexName))) await pool.query(sql);
}

async function ensurePortalSchema() {
  await pool.query(`CREATE TABLE IF NOT EXISTS portal_usuarios (
    id CHAR(36) NOT NULL,
    nombre VARCHAR(120) NOT NULL,
    email VARCHAR(160) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    empresa VARCHAR(160) NOT NULL,
    tipo_identificacion VARCHAR(2) NOT NULL,
    numero_identificacion VARBINARY(255) NOT NULL,
    correo_facturacion VARCHAR(160) NOT NULL,
    api_key VARBINARY(255) NULL,
    api_key_hash CHAR(64) NULL,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_portal_usuarios_email (email)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

  await ensureColumn('portal_usuarios', 'api_key', 'VARBINARY(255) NULL AFTER correo_facturacion');
  await ensureColumn('portal_usuarios', 'api_key_hash', 'CHAR(64) NULL AFTER api_key');
  await ensureIndex(
    'portal_usuarios',
    'uq_portal_usuarios_api_key_hash',
    `ALTER TABLE portal_usuarios ADD UNIQUE KEY uq_portal_usuarios_api_key_hash (api_key_hash)`
  );

  await pool.query(`CREATE TABLE IF NOT EXISTS portal_perfiles (
    usuario_id CHAR(36) NOT NULL,
    nombre_comercial VARCHAR(160) NULL,
    actividad_economica VARCHAR(12) NULL,
    telefono VARCHAR(30) NULL,
    provincia VARCHAR(80) NULL,
    canton VARCHAR(80) NULL,
    distrito VARCHAR(80) NULL,
    otras_senas VARCHAR(255) NULL,
    logo LONGTEXT NULL,
    logo_blanco LONGTEXT NULL,
    logo_posicion ENUM('left','center','right') NOT NULL DEFAULT 'left',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (usuario_id),
    CONSTRAINT fk_portal_perfil_usuario
      FOREIGN KEY (usuario_id) REFERENCES portal_usuarios(id)
      ON DELETE CASCADE ON UPDATE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

  await pool.query(`CREATE TABLE IF NOT EXISTS portal_sesiones (
    id BIGINT NOT NULL AUTO_INCREMENT,
    usuario_id CHAR(36) NOT NULL,
    token_hash CHAR(64) NOT NULL,
    expires_at DATETIME NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_portal_sesiones_token (token_hash),
    KEY idx_portal_sesiones_usuario (usuario_id),
    CONSTRAINT fk_portal_sesion_usuario
      FOREIGN KEY (usuario_id) REFERENCES portal_usuarios(id)
      ON DELETE CASCADE ON UPDATE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

  // Las facturas pertenecen al servicio visual. La asociación con la cuenta
  // permite que cada negocio consulte únicamente "Mis facturas" y que el
  // logo configurado en el portal se aplique a sus comprobantes.
  await ensureColumn('facturas', 'portal_usuario_id', 'CHAR(36) NULL');
  await ensureIndex(
    'facturas',
    'idx_facturas_portal_usuario',
    `ALTER TABLE facturas ADD INDEX idx_facturas_portal_usuario (portal_usuario_id)`
  );
}

module.exports = { ensurePortalSchema };
