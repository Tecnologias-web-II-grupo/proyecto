/* ============================================================
   PROYECTO         : Facturación Electrónica
   GRUPO            : Kenym
   DESCRIPCIÓN      : Esquema completo para API de facturación,
                      generación documental, XML, firma, entrega
                      y trazabilidad de integraciones.
   MOTOR            : MySQL 8.0
   ============================================================ */

CREATE DATABASE IF NOT EXISTS facturaBonita
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE facturaBonita;

SET FOREIGN_KEY_CHECKS = 0;

DROP VIEW IF EXISTS vw_facturas_resumen;
DROP VIEW IF EXISTS vw_facturas_pendientes_hacienda;

DROP TABLE IF EXISTS portal_integraciones;
DROP TABLE IF EXISTS portal_ventas;
DROP TABLE IF EXISTS portal_sesiones;
DROP TABLE IF EXISTS portal_perfiles;
DROP TABLE IF EXISTS portal_usuarios;

DROP TABLE IF EXISTS factura_envios;
DROP TABLE IF EXISTS factura_integraciones;
DROP TABLE IF EXISTS factura_documentos;
DROP TABLE IF EXISTS factura_items;
DROP TABLE IF EXISTS facturas;

SET FOREIGN_KEY_CHECKS = 1;

/* ============================================================
   TABLA: facturas
   Cabecera principal de la factura.
   Los campos sensibles de identificación se almacenan cifrados
   desde la API como VARBINARY.
   ============================================================ */

CREATE TABLE facturas (
  id                        VARCHAR(20)      NOT NULL,
  fecha_emision             DATETIME         NOT NULL,
  moneda                    VARCHAR(3)       NOT NULL,
  condicion_venta           VARCHAR(2)       NOT NULL,
  medio_pago                VARCHAR(2)       NOT NULL,

  emisor_nombre             VARCHAR(150)     NOT NULL,
  emisor_tipo_id            VARCHAR(2)       NOT NULL,
  emisor_numero_id          VARBINARY(255)   NOT NULL,
  emisor_correo             VARCHAR(150)     NOT NULL,
  emisor_logo               LONGTEXT         NULL,
  emisor_logo_blanco        LONGTEXT         NULL,
  emisor_logo_posicion      VARCHAR(10)      NOT NULL DEFAULT 'left',

  receptor_nombre           VARCHAR(150)     NOT NULL,
  receptor_tipo_id          VARCHAR(2)       NULL,
  receptor_numero_id        VARBINARY(255)   NULL,
  receptor_correo           VARCHAR(150)     NOT NULL,

  total_gravado             DECIMAL(12,2)    NOT NULL DEFAULT 0.00,
  total_exento              DECIMAL(12,2)    NOT NULL DEFAULT 0.00,
  total_descuentos          DECIMAL(12,2)    NOT NULL DEFAULT 0.00,
  total_impuesto            DECIMAL(12,2)    NOT NULL DEFAULT 0.00,
  total_comprobante         DECIMAL(12,2)    NOT NULL,

  referencia_externa        VARCHAR(100)     NULL,
  origen                    VARCHAR(80)      NULL,
  datos_v44                 LONGTEXT         NULL,

  clave_electronica         VARCHAR(50)      NULL,
  consecutivo_electronico   VARCHAR(20)      NULL,

  estado_factura            VARCHAR(30)      NOT NULL DEFAULT 'creada',
  estado_documento          VARCHAR(30)      NOT NULL DEFAULT 'pendiente',
  estado_xml                VARCHAR(30)      NOT NULL DEFAULT 'pendiente',
  estado_firma              VARCHAR(30)      NOT NULL DEFAULT 'pendiente',
  estado_hacienda           VARCHAR(30)      NOT NULL DEFAULT 'pendiente',

  acuse_hacienda            VARCHAR(120)     NULL,
  mensaje_hacienda          TEXT             NULL,

  created_at                DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at                DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP
                                              ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),

  UNIQUE KEY uq_facturas_clave_electronica (clave_electronica),
  UNIQUE KEY uq_facturas_consecutivo_electronico (consecutivo_electronico),

  KEY idx_facturas_fecha_emision (fecha_emision),
  KEY idx_facturas_emisor_correo (emisor_correo),
  KEY idx_facturas_receptor_correo (receptor_correo),
  KEY idx_facturas_estado_factura (estado_factura),
  KEY idx_facturas_estado_hacienda (estado_hacienda),
  KEY idx_facturas_referencia_externa (referencia_externa),
  KEY idx_facturas_origen_referencia (origen, referencia_externa),

  CONSTRAINT chk_facturas_moneda
    CHECK (moneda IN ('CRC', 'USD')),

  CONSTRAINT chk_facturas_totales
    CHECK (
      total_gravado >= 0
      AND total_exento >= 0
      AND total_descuentos >= 0
      AND total_impuesto >= 0
      AND total_comprobante >= 0
    )
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;


/* ============================================================
   TABLA: factura_items
   Líneas o servicios incluidos en cada factura.
   Los campos actualmente usados por api-core conservan sus
   nombres para no romper POST /api/facturas ni GET /api/facturas/:id.
   ============================================================ */

CREATE TABLE factura_items (
  id                        BIGINT           NOT NULL AUTO_INCREMENT,
  factura_id                VARCHAR(20)      NOT NULL,
  numero_linea              INT              NOT NULL,
  detalle                   VARCHAR(255)     NOT NULL,
  cantidad                  DECIMAL(10,3)    NOT NULL,
  precio_unitario           DECIMAL(12,5)    NOT NULL,
  descuento                 DECIMAL(12,2)    NOT NULL DEFAULT 0.00,
  impuesto_tarifa           DECIMAL(5,2)     NOT NULL DEFAULT 0.00,
  subtotal                  DECIMAL(12,5)    NOT NULL,
  monto_total_linea         DECIMAL(12,5)    NOT NULL,

  codigo                    VARCHAR(50)      NULL,
  unidad_medida             VARCHAR(20)      NULL,
  impuesto_codigo           VARCHAR(10)      NULL,
  monto_impuesto            DECIMAL(12,5)    NOT NULL DEFAULT 0.00000,

  created_at                DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),

  UNIQUE KEY uq_factura_numero_linea (factura_id, numero_linea),
  KEY idx_factura_items_factura (factura_id),

  CONSTRAINT fk_factura_items_factura
    FOREIGN KEY (factura_id)
    REFERENCES facturas(id)
    ON UPDATE CASCADE
    ON DELETE CASCADE,

  CONSTRAINT chk_factura_items_numero_linea
    CHECK (numero_linea > 0),

  CONSTRAINT chk_factura_items_cantidad
    CHECK (cantidad > 0),

  CONSTRAINT chk_factura_items_montos
    CHECK (
      precio_unitario >= 0
      AND descuento >= 0
      AND impuesto_tarifa >= 0
      AND subtotal >= 0
      AND monto_total_linea >= 0
      AND monto_impuesto >= 0
    )
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;


/* ============================================================
   TABLA: factura_documentos
   Archivos derivados de una factura.
   Puede almacenar referencias al HTML, PDF y XML generados por
   los módulos de las demás personas del equipo.
   ============================================================ */

CREATE TABLE factura_documentos (
  id                        BIGINT           NOT NULL AUTO_INCREMENT,
  factura_id                VARCHAR(20)      NOT NULL,

  tipo_documento            VARCHAR(15)      NOT NULL,
  estado                    VARCHAR(30)      NOT NULL DEFAULT 'pendiente',

  url_documento             VARCHAR(1000)    NULL,
  nombre_archivo            VARCHAR(255)     NULL,
  mime_type                 VARCHAR(100)     NULL,

  hash_sha256               VARCHAR(64)      NULL,
  solo_lectura              BOOLEAN          NOT NULL DEFAULT TRUE,

  xml_validado              BOOLEAN          NOT NULL DEFAULT FALSE,
  firmado_digitalmente      BOOLEAN          NOT NULL DEFAULT FALSE,

  referencia_servicio       VARCHAR(150)     NULL,
  detalle_error             TEXT             NULL,

  created_at                DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at                DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP
                                              ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),

  KEY idx_documentos_factura (factura_id),
  KEY idx_documentos_tipo (tipo_documento),
  KEY idx_documentos_estado (estado),

  CONSTRAINT fk_factura_documentos_factura
    FOREIGN KEY (factura_id)
    REFERENCES facturas(id)
    ON UPDATE CASCADE
    ON DELETE CASCADE,

  CONSTRAINT chk_factura_documentos_tipo
    CHECK (tipo_documento IN ('HTML', 'PDF', 'XML', 'OTRO'))
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;


/* ============================================================
   TABLA: factura_integraciones
   Bitácora técnica de las llamadas a APIs externas.
   Permite registrar XML, firma digital, validación, tributación,
   renderizado del documento u otros servicios.
   ============================================================ */

CREATE TABLE factura_integraciones (
  id                        BIGINT           NOT NULL AUTO_INCREMENT,
  factura_id                VARCHAR(20)      NOT NULL,

  servicio                  VARCHAR(80)      NOT NULL,
  operacion                 VARCHAR(80)      NULL,
  endpoint                  VARCHAR(1000)    NULL,

  estado                    VARCHAR(30)      NOT NULL DEFAULT 'pendiente',
  http_status               INT              NULL,

  referencia_externa        VARCHAR(255)     NULL,
  mensaje                   TEXT             NULL,

  intento                   INT              NOT NULL DEFAULT 1,
  fecha_solicitud           DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_respuesta           DATETIME         NULL,

  created_at                DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),

  KEY idx_integraciones_factura (factura_id),
  KEY idx_integraciones_servicio (servicio),
  KEY idx_integraciones_estado (estado),

  CONSTRAINT fk_factura_integraciones_factura
    FOREIGN KEY (factura_id)
    REFERENCES facturas(id)
    ON UPDATE CASCADE
    ON DELETE CASCADE,

  CONSTRAINT chk_factura_integraciones_intento
    CHECK (intento > 0)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;


/* ============================================================
   TABLA: factura_envios
   Control de entrega al cliente y envío al módulo tributario.
   Guarda el estado, rechazo o acuse retornado.
   ============================================================ */

CREATE TABLE factura_envios (
  id                        BIGINT           NOT NULL AUTO_INCREMENT,
  factura_id                VARCHAR(20)      NOT NULL,

  destino                   VARCHAR(30)      NOT NULL,
  canal                     VARCHAR(30)      NULL,
  destinatario              VARCHAR(255)     NULL,

  estado                    VARCHAR(30)      NOT NULL DEFAULT 'pendiente',
  numero_intento            INT              NOT NULL DEFAULT 1,

  numero_acuse              VARCHAR(150)     NULL,
  motivo_rechazo            TEXT             NULL,
  referencia_externa        VARCHAR(255)     NULL,

  fecha_envio               DATETIME         NULL,
  fecha_respuesta           DATETIME         NULL,

  created_at                DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at                DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP
                                              ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),

  KEY idx_envios_factura (factura_id),
  KEY idx_envios_destino (destino),
  KEY idx_envios_estado (estado),

  CONSTRAINT fk_factura_envios_factura
    FOREIGN KEY (factura_id)
    REFERENCES facturas(id)
    ON UPDATE CASCADE
    ON DELETE CASCADE,

  CONSTRAINT chk_factura_envios_intento
    CHECK (numero_intento > 0)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;




/* ============================================================
   PORTAL DEL SERVICIO API FACTURA
   Registro de negocios, configuración del logo y ventas que
   se conectan a servicios externos antes de generar factura.
   ============================================================ */

CREATE TABLE portal_usuarios (
  id CHAR(36) NOT NULL,
  nombre VARCHAR(120) NOT NULL,
  email VARCHAR(160) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  empresa VARCHAR(160) NOT NULL,
  tipo_identificacion VARCHAR(2) NOT NULL,
  numero_identificacion VARBINARY(255) NOT NULL,
  correo_facturacion VARCHAR(160) NOT NULL,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_portal_usuarios_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE portal_perfiles (
  usuario_id CHAR(36) NOT NULL,
  nombre_comercial VARCHAR(160) NULL,
  actividad_economica VARCHAR(12) NULL,
  telefono VARCHAR(30) NULL,
  provincia VARCHAR(3) NULL,
  canton VARCHAR(3) NULL,
  distrito VARCHAR(3) NULL,
  otras_senas VARCHAR(255) NULL,
  logo LONGTEXT NULL,
  logo_blanco LONGTEXT NULL,
  logo_posicion ENUM('left','center','right') NOT NULL DEFAULT 'left',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (usuario_id),
  CONSTRAINT fk_portal_perfil_usuario FOREIGN KEY (usuario_id) REFERENCES portal_usuarios(id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE portal_sesiones (
  id BIGINT NOT NULL AUTO_INCREMENT,
  usuario_id CHAR(36) NOT NULL,
  token_hash CHAR(64) NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_portal_sesiones_token (token_hash),
  KEY idx_portal_sesiones_usuario (usuario_id),
  CONSTRAINT fk_portal_sesion_usuario FOREIGN KEY (usuario_id) REFERENCES portal_usuarios(id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE portal_ventas (
  id VARCHAR(24) NOT NULL,
  usuario_id CHAR(36) NOT NULL,
  receptor_nombre VARCHAR(160) NOT NULL,
  receptor_tipo_id VARCHAR(2) NULL,
  receptor_numero_id VARBINARY(255) NULL,
  receptor_correo VARCHAR(160) NOT NULL,
  items_json LONGTEXT NOT NULL,
  datos_venta_json LONGTEXT NULL,
  subtotal DECIMAL(12,2) NOT NULL DEFAULT 0,
  descuento DECIMAL(12,2) NOT NULL DEFAULT 0,
  impuesto DECIMAL(12,2) NOT NULL DEFAULT 0,
  total DECIMAL(12,2) NOT NULL,
  moneda VARCHAR(3) NOT NULL DEFAULT 'CRC',
  estado VARCHAR(40) NOT NULL DEFAULT 'pendiente_pago',
  referencia_pago VARCHAR(100) NOT NULL,
  pago_payload LONGTEXT NULL,
  factura_id VARCHAR(20) NULL,
  error_detalle TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_portal_venta_referencia_pago (referencia_pago),
  KEY idx_portal_ventas_usuario (usuario_id),
  KEY idx_portal_ventas_estado (estado),
  CONSTRAINT fk_portal_venta_usuario FOREIGN KEY (usuario_id) REFERENCES portal_usuarios(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_portal_venta_factura FOREIGN KEY (factura_id) REFERENCES facturas(id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE portal_integraciones (
  id BIGINT NOT NULL AUTO_INCREMENT,
  venta_id VARCHAR(24) NOT NULL,
  servicio VARCHAR(100) NOT NULL,
  endpoint VARCHAR(1000) NULL,
  estado VARCHAR(30) NOT NULL DEFAULT 'pendiente',
  http_status INT NULL,
  mensaje TEXT NULL,
  request_json LONGTEXT NULL,
  response_json LONGTEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_portal_integraciones_venta (venta_id),
  CONSTRAINT fk_portal_integracion_venta FOREIGN KEY (venta_id) REFERENCES portal_ventas(id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


/* ============================================================
   VISTAS DE APOYO
   ============================================================ */

CREATE VIEW vw_facturas_resumen AS
SELECT
  f.id,
  f.fecha_emision,
  f.moneda,
  f.emisor_nombre,
  f.emisor_correo,
  f.receptor_nombre,
  f.receptor_correo,
  f.total_comprobante,
  f.estado_factura,
  f.estado_documento,
  f.estado_xml,
  f.estado_firma,
  f.estado_hacienda,
  f.acuse_hacienda,
  COUNT(fi.id) AS cantidad_lineas
FROM facturas f
LEFT JOIN factura_items fi
  ON fi.factura_id = f.id
GROUP BY
  f.id,
  f.fecha_emision,
  f.moneda,
  f.emisor_nombre,
  f.emisor_correo,
  f.receptor_nombre,
  f.receptor_correo,
  f.total_comprobante,
  f.estado_factura,
  f.estado_documento,
  f.estado_xml,
  f.estado_firma,
  f.estado_hacienda,
  f.acuse_hacienda;


CREATE VIEW vw_facturas_pendientes_hacienda AS
SELECT
  id,
  fecha_emision,
  receptor_nombre,
  receptor_correo,
  total_comprobante,
  estado_xml,
  estado_firma,
  estado_hacienda
FROM facturas
WHERE estado_hacienda NOT IN ('aceptada', 'recibida');


/* ============================================================
   VALIDACIONES FINALES DEL ESQUEMA
   ============================================================ */

SELECT DATABASE() AS base_activa;

SELECT
  TABLE_NAME,
  TABLE_TYPE
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = 'facturaBonita'
ORDER BY TABLE_TYPE, TABLE_NAME;

SELECT
  TABLE_NAME,
  COLUMN_NAME,
  DATA_TYPE,
  IS_NULLABLE,
  COLUMN_KEY
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = 'facturaBonita'
ORDER BY TABLE_NAME, ORDINAL_POSITION;