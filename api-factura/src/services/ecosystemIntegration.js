const pool = require('../db/database');

function env(name, fallback='') { return String(process.env[name] || fallback).trim(); }
function parseJson(text) { try { return text ? JSON.parse(text) : null; } catch { return text; } }
function enabled(url) { return Boolean(String(url || '').trim()); }

async function record(ventaId, servicio, endpoint, estado, extra={}) {
  await pool.execute(
    `INSERT INTO portal_integraciones (venta_id, servicio, endpoint, estado, http_status, mensaje, request_json, response_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [ventaId, servicio, endpoint || null, estado, extra.httpStatus || null, extra.mensaje || null,
      extra.request ? JSON.stringify(extra.request) : null,
      extra.response !== undefined ? JSON.stringify(extra.response) : null]
  );
}

function buildHeaders(prefix) {
  const out = { 'Content-Type':'application/json' };
  const apiKey = env(`${prefix}_API_KEY`);
  const bearer = env(`${prefix}_BEARER_TOKEN`);
  if (apiKey) out['X-Api-Key'] = apiKey;
  if (bearer) out.Authorization = `Bearer ${bearer}`;
  return out;
}

async function postJson({ ventaId, serviceName, url, prefix, payload, timeoutMs=18000 }) {
  if (!enabled(url)) {
    await record(ventaId, serviceName, null, 'pendiente_configuracion', { mensaje:`Falta configurar ${prefix}_URL.` });
    const error = new Error(`${serviceName} todavía no está configurado.`);
    error.code = 'SERVICE_NOT_CONFIGURED';
    throw error;
  }
  await record(ventaId, serviceName, url, 'procesando', { request:payload, mensaje:'Solicitud enviada.' });
  try {
    const response = await fetch(url, {
      method:'POST', headers:buildHeaders(prefix), body:JSON.stringify(payload),
      signal:AbortSignal.timeout(Number(env(`${prefix}_TIMEOUT_MS`, timeoutMs)))
    });
    const text = await response.text();
    const body = parseJson(text);
    await record(ventaId, serviceName, url, response.ok ? 'completada' : 'fallida', {
      httpStatus:response.status, request:payload, response:body,
      mensaje:response.ok ? 'Servicio completado.' : `HTTP ${response.status}`
    });
    if (!response.ok) throw new Error(`${serviceName} respondió HTTP ${response.status}.`);
    return body;
  } catch (error) {
    if (error?.name === 'TimeoutError' || error?.name === 'AbortError') {
      await record(ventaId, serviceName, url, 'fallida', { request:payload, mensaje:'Tiempo de espera agotado.' });
    }
    throw error;
  }
}

function responseAccepted(body) {
  if (!body || typeof body !== 'object') return false;
  if (body.ok === true || body.valid === true || body.accepted === true || body.approved === true || body.success === true || body.registered === true || body.registrado === true || body.enabled === true || body.habilitado === true) return true;
  const status = String(body.status || body.estado || body.resultado || '').toLowerCase();
  return ['ok','valid','validado','validated','accepted','aceptada','aceptado','approved','aprobado','success','completed','registrado','registered'].includes(status);
}

function firstValue(obj, keys) {
  for (const key of keys) {
    const parts = key.split('.'); let current = obj;
    for (const part of parts) current = current && current[part];
    if (current !== undefined && current !== null && current !== '') return current;
  }
  return null;
}

async function validarFirmaDigital({ ventaId, emisor, venta }) {
  const payload = {
    negocio:{ nombre:emisor.nombre, nombreComercial:emisor.nombreComercial, identificacion:emisor.identificacion, correo:emisor.correo },
    venta:{ id:venta.id, referencia:venta.referencia_pago || venta.referenciaPago || '', total:Number(venta.total), moneda:venta.moneda || 'CRC' }
  };
  const body = await postJson({
    ventaId, serviceName:'firma_digital', url:env('DIGITAL_SIGNATURE_VALIDATE_URL'), prefix:'DIGITAL_SIGNATURE', payload
  });
  if (!responseAccepted(body)) throw new Error('El servicio de firma digital no confirmó que el negocio esté registrado y habilitado.');
  return body;
}

async function solicitarFacturaElectronica({ ventaId, factura, facturaId, pdfUrl }) {
  const payload = {
    facturaId,
    facturaVisual:factura,
    documentoVisual:{ formato:'pdf', url:pdfUrl }
  };
  const body = await postJson({
    ventaId, serviceName:'facturacion_electronica', url:env('ELECTRONIC_INVOICE_URL'), prefix:'ELECTRONIC_INVOICE', payload, timeoutMs:25000
  });
  const xml = firstValue(body, ['xml','facturaXml','facturaElectronica.xml','documento.xml','data.xml']);
  const xmlBase64 = firstValue(body, ['xmlBase64','facturaXmlBase64','facturaElectronica.base64','documento.base64']);
  const url = firstValue(body, ['xmlUrl','facturaElectronicaUrl','facturaElectronica.url','documento.url','url']);
  if (!xml && !xmlBase64 && !url) throw new Error('Facturación Electrónica respondió, pero no devolvió el XML ni una URL del documento.');
  return { raw:body, xml, xmlBase64, url };
}

async function enviarTributacion({ ventaId, facturaId, emisor, receptor, electronica }) {
  const payload = {
    facturaId,
    emisor:{ nombre:emisor.nombre, identificacion:emisor.identificacion },
    receptor:{ nombre:receptor.nombre, identificacion:receptor.identificacion, correo:receptor.correo },
    facturaElectronica:electronica.raw,
    xml:electronica.xml || undefined,
    xmlBase64:electronica.xmlBase64 || undefined,
    xmlUrl:electronica.url || undefined
  };
  const body = await postJson({
    ventaId, serviceName:'tributacion', url:env('TAXATION_URL'), prefix:'TAXATION', payload, timeoutMs:25000
  });
  const receipt = firstValue(body, ['acuse','acuseRecibido','receipt','comprobante','respuesta.acuse','data.acuse']);
  const receiptBase64 = firstValue(body, ['acuseBase64','receiptBase64','comprobanteBase64','respuesta.acuseBase64']);
  const receiptUrl = firstValue(body, ['acuseUrl','receiptUrl','comprobanteUrl','respuesta.acuseUrl']);
  if (!responseAccepted(body) && !receipt && !receiptBase64 && !receiptUrl) throw new Error('Tributación no devolvió una aceptación ni un acuse válido para la factura electrónica.');
  if (!receipt && !receiptBase64 && !receiptUrl) throw new Error('Tributación aceptó la factura, pero no devolvió un acuse de recibido utilizable.');
  return { raw:body, receipt, receiptBase64, receiptUrl };
}

module.exports = {
  validarFirmaDigital,
  solicitarFacturaElectronica,
  enviarTributacion,
  responseAccepted,
  firstValue,
};
