const pool = require('../db/database');

function env(name, fallback='') { return String(process.env[name] || fallback).trim(); }
function configured() { return Boolean(env('EMAIL_DELIVERY_URL')); }

async function record(ventaId, estado, mensaje, response=null) {
  await pool.execute(
    `INSERT INTO portal_integraciones (venta_id, servicio, endpoint, estado, mensaje, response_json)
     VALUES (?, 'entrega_correo', ?, ?, ?, ?)`,
    [ventaId, env('EMAIL_DELIVERY_URL') || null, estado, mensaje || null, response ? JSON.stringify(response) : null]
  );
}

async function bufferFromUrl(url, timeoutMs=20000) {
  if (!url) return null;
  const response = await fetch(url, { signal:AbortSignal.timeout(timeoutMs) });
  if (!response.ok) throw new Error(`No se pudo descargar un documento para el correo (HTTP ${response.status}).`);
  return Buffer.from(await response.arrayBuffer());
}

async function documentBuffer({ content, base64, url }) {
  if (content) return Buffer.from(String(content), 'utf8');
  if (base64) return Buffer.from(String(base64), 'base64');
  if (url) return bufferFromUrl(url);
  return null;
}

async function entregarDocumentos({ ventaId, to, clienteNombre, facturaId, pdfUrl, electronica, tributacion }) {
  const endpoint = env('EMAIL_DELIVERY_URL');
  if (!endpoint) {
    await record(ventaId,'pendiente_configuracion','Falta configurar EMAIL_DELIVERY_URL para entregar los documentos al cliente.');
    const error = new Error('La factura está validada, pero el servicio de entrega por correo todavía no está configurado.');
    error.code = 'EMAIL_NOT_CONFIGURED';
    throw error;
  }

  await record(ventaId,'procesando',`Preparando entrega para ${to}.`);
  const pdf = await bufferFromUrl(pdfUrl);
  const xml = await documentBuffer({ content:electronica.xml, base64:electronica.xmlBase64, url:electronica.url });
  const receipt = await documentBuffer({ content:tributacion.receipt, base64:tributacion.receiptBase64, url:tributacion.receiptUrl });
  if (!pdf || !xml || !receipt) throw new Error('No fue posible reunir los tres documentos requeridos para la entrega al cliente.');

  const payload = {
    to,
    subject:`Documentos de su compra - ${facturaId}`,
    customerName:clienteNombre || '',
    message:`Su operación fue procesada correctamente. Adjuntamos factura visual, factura electrónica y acuse de recibido.`,
    attachments:[
      { filename:`factura-${facturaId}.pdf`, contentType:'application/pdf', contentBase64:pdf.toString('base64') },
      { filename:`factura-electronica-${facturaId}.xml`, contentType:'application/xml', contentBase64:xml.toString('base64') },
      { filename:`acuse-${facturaId}.xml`, contentType:'application/xml', contentBase64:receipt.toString('base64') },
    ]
  };
  const headers = { 'Content-Type':'application/json' };
  if (env('EMAIL_DELIVERY_API_KEY')) headers['X-Api-Key'] = env('EMAIL_DELIVERY_API_KEY');
  if (env('EMAIL_DELIVERY_BEARER_TOKEN')) headers.Authorization = `Bearer ${env('EMAIL_DELIVERY_BEARER_TOKEN')}`;

  const response = await fetch(endpoint, {
    method:'POST', headers, body:JSON.stringify(payload),
    signal:AbortSignal.timeout(Number(env('EMAIL_DELIVERY_TIMEOUT_MS','25000')))
  });
  const text = await response.text(); let body=text; try{body=text?JSON.parse(text):null}catch{}
  if (!response.ok) {
    await record(ventaId,'fallida',`El servicio de correo respondió HTTP ${response.status}.`,body);
    throw new Error(`No se pudieron enviar los documentos al correo del cliente (HTTP ${response.status}).`);
  }
  await record(ventaId,'completada',`Documentos enviados a ${to}.`,body);
  return body;
}

module.exports = { configured, entregarDocumentos };
