const { createHash } = require('crypto');
const pool = require('../db/database');

const DEFAULT_FACTURASMART_URL = process.env.FACTURASMART_URL || 'https://proyecto-facturaci-n-electr-nica.onrender.com';
let schemaPromise = null;

function clean(value, max = 500) {
  return String(value ?? '').trim().slice(0, max);
}

function normalizeBaseUrl(value) {
  const raw = clean(value || DEFAULT_FACTURASMART_URL, 500).replace(/\/+$/, '');
  const url = new URL(raw);
  const allowed = new URL(DEFAULT_FACTURASMART_URL);
  if (!['http:', 'https:'].includes(url.protocol) || url.origin !== allowed.origin) {
    throw new Error('La integración solo permite el endpoint configurado de FacturaSmart.');
  }
  return url.origin + url.pathname.replace(/\/+$/, '');
}

function tipoIdentificacion(tipo) {
  const value = clean(tipo, 40).toUpperCase();
  const map = {
    '01': 'CEDULA_FISICA',
    '02': 'CEDULA_JURIDICA',
    '03': 'DIMEX',
    '04': 'NITE',
  };
  if (map[value]) return map[value];
  if (['CEDULA_FISICA', 'CEDULA_JURIDICA', 'DIMEX', 'NITE'].includes(value)) return value;
  return 'CEDULA_FISICA';
}

function localDateTime(value) {
  const date = value ? new Date(value) : new Date();
  const valid = Number.isNaN(date.getTime()) ? new Date() : date;
  return valid.toISOString().replace(/\.\d{3}Z$/, '');
}

function deterministicSmartId(factura) {
  const referencia = clean(factura?.referenciaExterna, 100);
  const cargoMatch = String(factura?.origen || '').toLowerCase() === 'educontrol' ? /^cargo:(\d+)$/.exec(referencia) : null;
  const seed = cargoMatch
    ? `educontrol:cargo:${Number(cargoMatch[1])}`
    : `${factura?.origen || 'factura-bonita'}|${referencia}|${factura?.id || ''}`;
  const chars = createHash('sha256').update(seed).digest('hex').slice(0, 32).split('');
  chars[12] = '4';
  chars[16] = ['8', '9', 'a', 'b'][parseInt(chars[16], 16) % 4];
  const h = chars.join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
}

function facturaSmartPayload(factura) {
  const smartId = deterministicSmartId(factura);
  const receptorIdentificacion = factura?.receptor?.identificacion?.numero
    ? {
        tipo: tipoIdentificacion(factura.receptor.identificacion.tipo),
        numero: clean(factura.receptor.identificacion.numero, 40),
      }
    : null;

  return {
    id: smartId,
    fecha: localDateTime(factura?.fecha),
    moneda: clean(factura?.moneda || 'CRC', 10),
    condicionVenta: clean(factura?.condicionVenta || '01', 20),
    medioPago: clean(factura?.medioPago || '01', 20),
    tipoDocumento: 'FACTURA_ELECTRONICA',
    emisor: {
      nombre: clean(factura?.emisor?.nombre, 180),
      identificacion: {
        tipo: tipoIdentificacion(factura?.emisor?.identificacion?.tipo),
        numero: clean(factura?.emisor?.identificacion?.numero, 40),
      },
      correo: clean(factura?.emisor?.correo, 180).toLowerCase(),
    },
    receptor: {
      nombre: clean(factura?.receptor?.nombre, 180),
      identificacion: receptorIdentificacion,
      correo: clean(factura?.receptor?.correo, 180).toLowerCase(),
    },
    items: (Array.isArray(factura?.items) ? factura.items : []).map((item, index) => ({
      numeroLinea: Number(item?.numeroLinea || index + 1),
      detalle: clean(item?.detalle, 255),
      cantidad: Number(item?.cantidad || 0),
      precioUnitario: Number(item?.precioUnitario || 0),
      descuento: Number(item?.descuento || 0),
      impuesto: { tarifa: Number(item?.impuesto?.tarifa || 0) },
      subtotal: Number(item?.subtotal || 0),
      montoTotalLinea: Number(item?.montoTotalLinea || 0),
    })),
    totales: {
      totalGravado: Number(factura?.totales?.totalGravado || 0),
      totalExento: Number(factura?.totales?.totalExento || 0),
      totalDescuentos: Number(factura?.totales?.totalDescuentos || 0),
      totalImpuesto: Number(factura?.totales?.totalImpuesto || 0),
      totalComprobante: Number(factura?.totales?.totalComprobante || 0),
    },
  };
}

async function ensureSchema() {
  if (schemaPromise) return schemaPromise;
  schemaPromise = pool.query(`CREATE TABLE IF NOT EXISTS factura_electronica_integracion (
    factura_id VARCHAR(20) NOT NULL PRIMARY KEY,
    facturasmart_id VARCHAR(100) NULL,
    estado VARCHAR(40) NOT NULL DEFAULT 'pendiente',
    xml_base64 LONGTEXT NULL,
    mime_type VARCHAR(120) NULL,
    respuesta_json LONGTEXT NULL,
    error_mensaje VARCHAR(500) NULL,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_factura_electronica_estado (estado)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`).catch((error) => {
    schemaPromise = null;
    throw error;
  });
  return schemaPromise;
}

async function saveState(facturaId, data = {}) {
  await ensureSchema();
  await pool.execute(
    `INSERT INTO factura_electronica_integracion
      (factura_id, facturasmart_id, estado, xml_base64, mime_type, respuesta_json, error_mensaje)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       facturasmart_id=COALESCE(VALUES(facturasmart_id), facturasmart_id),
       estado=VALUES(estado),
       xml_base64=COALESCE(VALUES(xml_base64), xml_base64),
       mime_type=COALESCE(VALUES(mime_type), mime_type),
       respuesta_json=COALESCE(VALUES(respuesta_json), respuesta_json),
       error_mensaje=VALUES(error_mensaje),
       updated_at=CURRENT_TIMESTAMP`,
    [
      facturaId,
      data.facturasmartId || null,
      data.estado || 'pendiente',
      data.xmlBase64 || null,
      data.mimeType || null,
      data.respuesta ? JSON.stringify(data.respuesta) : null,
      data.error || null,
    ]
  );
}

async function requestJson(baseUrl, path, token, { method = 'GET', body = null, timeout = 45000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        Accept: 'application/json',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        Authorization: `Bearer ${token}`,
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    const text = await response.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = text ? { mensaje: text } : null; }
    return { ok: response.ok, status: response.status, data };
  } finally {
    clearTimeout(timer);
  }
}

async function requestBinary(baseUrl, path, token, timeout = 45000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(`${baseUrl}${path}`, {
      headers: { Accept: 'application/xml,text/xml,*/*', Authorization: `Bearer ${token}` },
      signal: controller.signal,
    });
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(text || `FacturaSmart respondió HTTP ${response.status} al consultar el XML.`);
    }
    return {
      buffer: Buffer.from(await response.arrayBuffer()),
      mimeType: response.headers.get('content-type') || 'application/xml',
    };
  } finally {
    clearTimeout(timer);
  }
}

function messageFrom(data, fallback) {
  if (!data || typeof data !== 'object') return fallback;
  return clean(data.message || data.mensaje || data.error || data.detalle || fallback, 500);
}

async function sincronizarFacturaElectronica({ facturaVisualId, factura, baseUrl, accessToken }) {
  const facturaId = clean(facturaVisualId || factura?.id, 20);
  const token = clean(accessToken, 5000);
  if (!facturaId || !token) return { ok: false, omitido: true, estado: 'sin_credenciales' };

  const root = normalizeBaseUrl(baseUrl || DEFAULT_FACTURASMART_URL);
  const payload = facturaSmartPayload(factura);
  const smartIdEsperado = payload.id;

  try {
    await saveState(facturaId, { facturasmartId: smartIdEsperado, estado: 'procesando', error: null });

    let processed = await requestJson(root, '/api/v1/facturas/procesar', token, {
      method: 'POST',
      body: payload,
      timeout: 60000,
    });

    // FacturaSmart puede responder conflicto si la misma factura ya fue creada.
    // La integración es idempotente: si el GET por el mismo ID existe, continuamos.
    if (!processed.ok && processed.status === 409) {
      const existing = await requestJson(root, `/api/v1/facturas/${encodeURIComponent(smartIdEsperado)}`, token, { timeout: 30000 });
      if (existing.ok) processed = { ok: true, status: 200, data: existing.data };
    }

    if (!processed.ok) {
      const error = messageFrom(processed.data, `FacturaSmart respondió HTTP ${processed.status}.`);
      await saveState(facturaId, { facturasmartId: smartIdEsperado, estado: 'error', respuesta: processed.data, error });
      return { ok: false, estado: 'error', id: smartIdEsperado, mensaje: error, httpStatus: processed.status };
    }

    const smartId = clean(processed.data?.id || processed.data?.facturaId || processed.data?.factura?.id || smartIdEsperado, 100);
    const xml = await requestBinary(root, `/api/v1/facturas/${encodeURIComponent(smartId)}/xml`, token, 45000);
    const xmlBase64 = xml.buffer.toString('base64');

    await saveState(facturaId, {
      facturasmartId: smartId,
      estado: 'disponible',
      xmlBase64,
      mimeType: xml.mimeType,
      respuesta: processed.data,
      error: null,
    });

    return {
      ok: true,
      estado: 'disponible',
      id: smartId,
      xmlBase64,
      mimeType: xml.mimeType,
      servicio: root,
    };
  } catch (error) {
    const message = error?.name === 'AbortError'
      ? 'FacturaSmart tardó demasiado en responder.'
      : clean(error?.message || 'No se pudo sincronizar la factura electrónica.', 500);
    await saveState(facturaId, { facturasmartId: smartIdEsperado, estado: 'error', error: message }).catch(() => {});
    return { ok: false, estado: 'error', id: smartIdEsperado, mensaje: message };
  }
}

async function obtenerEstadoFacturaElectronica(facturaId) {
  await ensureSchema();
  const [rows] = await pool.execute(
    `SELECT factura_id, facturasmart_id, estado, mime_type, error_mensaje, updated_at,
            CASE WHEN xml_base64 IS NULL OR xml_base64 = '' THEN 0 ELSE 1 END AS xml_disponible
       FROM factura_electronica_integracion WHERE factura_id=? LIMIT 1`,
    [clean(facturaId, 20)]
  );
  if (!rows.length) return null;
  return {
    facturaId: rows[0].factura_id,
    facturaSmartId: rows[0].facturasmart_id,
    estado: rows[0].estado,
    mimeType: rows[0].mime_type,
    xmlDisponible: Boolean(rows[0].xml_disponible),
    error: rows[0].error_mensaje || null,
    updatedAt: rows[0].updated_at,
  };
}

async function obtenerXmlFacturaElectronica(facturaId) {
  await ensureSchema();
  const [rows] = await pool.execute(
    `SELECT facturasmart_id, xml_base64, mime_type FROM factura_electronica_integracion WHERE factura_id=? LIMIT 1`,
    [clean(facturaId, 20)]
  );
  const row = rows[0];
  if (!row?.xml_base64) return null;
  return {
    facturaSmartId: row.facturasmart_id,
    buffer: Buffer.from(String(row.xml_base64), 'base64'),
    mimeType: row.mime_type || 'application/xml',
  };
}

module.exports = {
  sincronizarFacturaElectronica,
  obtenerEstadoFacturaElectronica,
  obtenerXmlFacturaElectronica,
  ensureFacturaSmartSchema: ensureSchema,
};
