const pool = require('../db/database');

async function columnExists(table, column){
  const [rows]=await pool.execute(`SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND COLUMN_NAME=? LIMIT 1`,[table,column]);
  return rows.length>0;
}
async function ensureColumn(table,column,definition){ if(!(await columnExists(table,column))) await pool.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`); }

async function ensurePortalSchema() {
  await pool.query(`CREATE TABLE IF NOT EXISTS portal_usuarios (
    id CHAR(36) NOT NULL,nombre VARCHAR(120) NOT NULL,email VARCHAR(160) NOT NULL,password_hash VARCHAR(255) NOT NULL,empresa VARCHAR(160) NOT NULL,
    tipo_identificacion VARCHAR(2) NOT NULL,numero_identificacion VARBINARY(255) NOT NULL,correo_facturacion VARCHAR(160) NOT NULL,activo BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),UNIQUE KEY uq_portal_usuarios_email (email)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

  await pool.query(`CREATE TABLE IF NOT EXISTS portal_perfiles (
    usuario_id CHAR(36) NOT NULL,nombre_comercial VARCHAR(160) NULL,actividad_economica VARCHAR(12) NULL,telefono VARCHAR(30) NULL,provincia VARCHAR(3) NULL,canton VARCHAR(3) NULL,distrito VARCHAR(3) NULL,otras_senas VARCHAR(255) NULL,
    logo LONGTEXT NULL,logo_blanco LONGTEXT NULL,logo_posicion ENUM('left','center','right') NOT NULL DEFAULT 'left',created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (usuario_id),CONSTRAINT fk_portal_perfil_usuario FOREIGN KEY (usuario_id) REFERENCES portal_usuarios(id) ON DELETE CASCADE ON UPDATE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

  await pool.query(`CREATE TABLE IF NOT EXISTS portal_sesiones (
    id BIGINT NOT NULL AUTO_INCREMENT,usuario_id CHAR(36) NOT NULL,token_hash CHAR(64) NOT NULL,expires_at DATETIME NOT NULL,created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),UNIQUE KEY uq_portal_sesiones_token (token_hash),KEY idx_portal_sesiones_usuario (usuario_id),CONSTRAINT fk_portal_sesion_usuario FOREIGN KEY (usuario_id) REFERENCES portal_usuarios(id) ON DELETE CASCADE ON UPDATE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

  await pool.query(`CREATE TABLE IF NOT EXISTS portal_ventas (
    id VARCHAR(24) NOT NULL,usuario_id CHAR(36) NOT NULL,receptor_nombre VARCHAR(160) NOT NULL,receptor_tipo_id VARCHAR(2) NULL,receptor_numero_id VARBINARY(255) NULL,receptor_correo VARCHAR(160) NOT NULL,
    items_json LONGTEXT NOT NULL,datos_venta_json LONGTEXT NULL,subtotal DECIMAL(12,2) NOT NULL DEFAULT 0,descuento DECIMAL(12,2) NOT NULL DEFAULT 0,impuesto DECIMAL(12,2) NOT NULL DEFAULT 0,total DECIMAL(12,2) NOT NULL,
    moneda VARCHAR(3) NOT NULL DEFAULT 'CRC',estado VARCHAR(40) NOT NULL DEFAULT 'pendiente_pago',referencia_pago VARCHAR(100) NOT NULL,pago_payload LONGTEXT NULL,factura_id VARCHAR(20) NULL,error_detalle TEXT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),UNIQUE KEY uq_portal_venta_referencia_pago (referencia_pago),KEY idx_portal_ventas_usuario (usuario_id),KEY idx_portal_ventas_estado (estado),
    CONSTRAINT fk_portal_venta_usuario FOREIGN KEY (usuario_id) REFERENCES portal_usuarios(id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_portal_venta_factura FOREIGN KEY (factura_id) REFERENCES facturas(id) ON DELETE SET NULL ON UPDATE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  await ensureColumn('portal_ventas','datos_venta_json','LONGTEXT NULL AFTER items_json');

  await pool.query(`CREATE TABLE IF NOT EXISTS portal_integraciones (
    id BIGINT NOT NULL AUTO_INCREMENT,venta_id VARCHAR(24) NOT NULL,servicio VARCHAR(100) NOT NULL,endpoint VARCHAR(1000) NULL,estado VARCHAR(30) NOT NULL DEFAULT 'pendiente',http_status INT NULL,mensaje TEXT NULL,
    request_json LONGTEXT NULL,response_json LONGTEXT NULL,created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),KEY idx_portal_integraciones_venta (venta_id),CONSTRAINT fk_portal_integracion_venta FOREIGN KEY (venta_id) REFERENCES portal_ventas(id) ON DELETE CASCADE ON UPDATE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
}
module.exports = { ensurePortalSchema };
