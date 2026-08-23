const pool = require('../db/database');

function env(name, fallback='') { return String(process.env[name] || fallback).trim(); }
function configured() { return Boolean(env('EMAIL_DELIVERY_URL') || env('RESEND_API_KEY')); }
function directProvider() { return env('DIRECT_EMAIL_PROVIDER','resend').toLowerCase(); }
function endpointLabel() { return env('EMAIL_DELIVERY_URL') || (env('RESEND_API_KEY') ? 'https://api.resend.com/emails' : ''); }

async function record(ventaId, estado, mensaje, response=null) {
  await pool.execute(
    `INSERT INTO portal_integraciones (venta_id, servicio, endpoint, estado, mensaje, response_json)
     VALUES (?, 'entrega_correo', ?, ?, ?, ?)`,
    [ventaId, endpointLabel() || null, estado, mensaje || null, response ? JSON.stringify(response) : null]
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

async function sendWithExternalEndpoint(payload) {
  const endpoint = env('EMAIL_DELIVERY_URL');
  const headers = { 'Content-Type':'application/json' };
  if (env('EMAIL_DELIVERY_API_KEY')) headers['X-Api-Key'] = env('EMAIL_DELIVERY_API_KEY');
  if (env('EMAIL_DELIVERY_BEARER_TOKEN')) headers.Authorization = `Bearer ${env('EMAIL_DELIVERY_BEARER_TOKEN')}`;
  const response = await fetch(endpoint, {
    method:'POST', headers, body:JSON.stringify(payload),
    signal:AbortSignal.timeout(Number(env('EMAIL_DELIVERY_TIMEOUT_MS','25000')))
  });
  const text = await response.text(); let body=text; try{body=text?JSON.parse(text):null}catch{}
  if (!response.ok) throw new Error(`El servicio de correo respondió HTTP ${response.status}.`);
  return body;
}

async function sendWithResend(payload) {
  if (directProvider() !== 'resend') throw new Error(`Proveedor de correo directo no soportado: ${directProvider()}.`);
  const apiKey = env('RESEND_API_KEY');
  if (!apiKey) throw new Error('Falta configurar RESEND_API_KEY para enviar correos directamente.');
  const from = env('EMAIL_FROM','Factura Bonita <onboarding@resend.dev>');
  const replyTo = env('EMAIL_REPLY_TO');
  const body = {
    from,
    to:[payload.to],
    subject:payload.subject,
    html:`<div style="font-family:Arial,sans-serif;color:#102a38"><h2>Factura Bonita</h2><p>Hola ${payload.customerName || 'cliente'},</p><p>${payload.message || 'Adjuntamos los documentos de su compra.'}</p><p>Referencia: <strong>${payload.invoiceId || ''}</strong></p></div>`,
    attachments:(payload.attachments||[]).map(a=>({ filename:a.filename, content:a.contentBase64 }))
  };
  if (replyTo) body.reply_to = replyTo;
  const response = await fetch('https://api.resend.com/emails', {
    method:'POST',
    headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${apiKey}` },
    body:JSON.stringify(body),
    signal:AbortSignal.timeout(Number(env('EMAIL_DELIVERY_TIMEOUT_MS','25000')))
  });
  const text = await response.text(); let result=text; try{result=text?JSON.parse(text):null}catch{}
  if (!response.ok) throw new Error(`Resend respondió HTTP ${response.status}: ${typeof result==='string'?result:JSON.stringify(result)}`);
  return result;
}

async function sendPayload(payload) {
  if (env('EMAIL_DELIVERY_URL')) return sendWithExternalEndpoint(payload);
  return sendWithResend(payload);
}

async function entregarFacturaVisual({ ventaId, to, clienteNombre, facturaId, pdfUrl }) {
  if (!configured()) {
    await record(ventaId,'pendiente_configuracion','Falta configurar el envío de correo directo (RESEND_API_KEY) o EMAIL_DELIVERY_URL.');
    const error = new Error('La factura fue generada, pero falta configurar el envío de correo.');
    error.code = 'EMAIL_NOT_CONFIGURED';
    throw error;
  }
  await record(ventaId,'procesando',`Preparando factura visual para ${to}.`);
  const pdf = await bufferFromUrl(pdfUrl);
  if (!pdf) throw new Error('No fue posible generar el PDF que se enviará por correo.');
  const payload = {
    to,
    subject:`Factura ${facturaId} - Factura Bonita`,
    customerName:clienteNombre || '',
    invoiceId:facturaId,
    message:'Su pago fue aprobado. Adjuntamos la factura visual correspondiente a su compra.',
    attachments:[
      { filename:`factura-${facturaId}.pdf`, contentType:'application/pdf', contentBase64:pdf.toString('base64') }
    ]
  };
  try {
    const body = await sendPayload(payload);
    await record(ventaId,'completada',`Factura visual enviada a ${to}.`,body);
    return body;
  } catch (error) {
    await record(ventaId,'fallida',error.message);
    throw error;
  }
}

async function entregarDocumentos({ ventaId, to, clienteNombre, facturaId, pdfUrl, electronica, tributacion }) {
  if (!configured()) {
    await record(ventaId,'pendiente_configuracion','Falta configurar el servicio de entrega por correo.');
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
    invoiceId:facturaId,
    message:'Su operación fue procesada correctamente. Adjuntamos factura visual, factura electrónica y acuse de recibido.',
    attachments:[
      { filename:`factura-${facturaId}.pdf`, contentType:'application/pdf', contentBase64:pdf.toString('base64') },
      { filename:`factura-electronica-${facturaId}.xml`, contentType:'application/xml', contentBase64:xml.toString('base64') },
      { filename:`acuse-${facturaId}.xml`, contentType:'application/xml', contentBase64:receipt.toString('base64') },
    ]
  };
  try {
    const body = await sendPayload(payload);
    await record(ventaId,'completada',`Documentos enviados a ${to}.`,body);
    return body;
  } catch (error) {
    await record(ventaId,'fallida',error.message);
    throw error;
  }
}

module.exports = { configured, entregarFacturaVisual, entregarDocumentos };
