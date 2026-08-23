const pool = require('../db/database');

function env(name, fallback='') { return String(process.env[name] || fallback).trim(); }
function directProvider() { return env('DIRECT_EMAIL_PROVIDER','formsubmit').toLowerCase(); }
function formActionTemplate() { return env('FORM_ACTION_URL_TEMPLATE','https://formsubmit.co/ajax/{email}'); }
function configured() {
  if (env('EMAIL_DELIVERY_URL')) return true;
  if (directProvider() === 'resend') return Boolean(env('RESEND_API_KEY'));
  if (directProvider() === 'formsubmit') return Boolean(formActionTemplate());
  return false;
}
function endpointLabel() {
  if (env('EMAIL_DELIVERY_URL')) return env('EMAIL_DELIVERY_URL');
  if (directProvider() === 'resend') return env('RESEND_API_KEY') ? 'https://api.resend.com/emails' : '';
  if (directProvider() === 'formsubmit') return formActionTemplate();
  return '';
}

async function record(ventaId, estado, mensaje, response=null) {
  const safeMessage = mensaje == null ? null : String(mensaje).slice(0, 12000);
  await pool.execute(
    `INSERT INTO portal_integraciones (venta_id, servicio, endpoint, estado, mensaje, response_json)
     VALUES (?, 'entrega_correo', ?, ?, ?, ?)`,
    [ventaId, endpointLabel() || null, estado, safeMessage, response ? JSON.stringify(response) : null]
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

async function sendWithFormAction(payload) {
  const recipient = String(payload.to || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) throw new Error('El correo del cliente no tiene un formato válido.');

  const template = formActionTemplate();
  if (!template || !template.includes('{email}')) {
    throw new Error('FORM_ACTION_URL_TEMPLATE debe incluir {email}.');
  }

  const endpoint = template.replace('{email}', encodeURIComponent(recipient));
  const form = new FormData();
  form.append('_subject', payload.subject || `Factura ${payload.invoiceId || ''}`);
  form.append('_captcha', 'false');
  form.append('_template', 'table');
  form.append('cliente', payload.customerName || 'Cliente');
  form.append('factura', payload.invoiceId || '');
  form.append('mensaje', payload.message || 'Adjuntamos los documentos de su compra.');

  for (const attachment of payload.attachments || []) {
    if (!attachment?.contentBase64 || !attachment?.filename) continue;
    const bytes = Buffer.from(attachment.contentBase64, 'base64');
    const blob = new Blob([bytes], { type: attachment.contentType || 'application/octet-stream' });
    form.append('attachment', blob, attachment.filename);
  }

  const response = await fetch(endpoint, {
    method:'POST',
    headers:{ Accept:'application/json' },
    body:form,
    signal:AbortSignal.timeout(Number(env('EMAIL_DELIVERY_TIMEOUT_MS','25000')))
  });
  const text = await response.text(); let result=text; try{result=text?JSON.parse(text):null}catch{}
  if (!response.ok) throw new Error(`El servicio de entrega respondió HTTP ${response.status}.`);

  // FormSubmit puede requerir una activación inicial del correo destinatario.
  const message = String(result?.message || result?.Message || '').toLowerCase();
  if (message.includes('activate') || message.includes('activation') || message.includes('confirm')) {
    const error = new Error('El correo necesita activar primero el servicio de envío. Revisa la bandeja de entrada, confirma la activación y luego usa “Reintentar procesamiento”.');
    error.code = 'EMAIL_ACTIVATION_REQUIRED';
    error.details = result;
    throw error;
  }
  return result || { success:true, provider:'formsubmit', to:recipient };
}

async function sendPayload(payload) {
  if (env('EMAIL_DELIVERY_URL')) return sendWithExternalEndpoint(payload);
  const provider = directProvider();
  if (provider === 'resend') return sendWithResend(payload);
  if (provider === 'formsubmit') return sendWithFormAction(payload);
  throw new Error(`Proveedor de correo directo no soportado: ${provider}.`);
}

async function entregarFacturaVisual({ ventaId, to, clienteNombre, facturaId, pdfUrl }) {
  if (!configured()) {
    await record(ventaId,'pendiente_configuracion','Falta configurar el envío de correo.');
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
    await record(ventaId,error.code==='EMAIL_ACTIVATION_REQUIRED'?'pendiente_activacion':'fallida',error.message,error.details||null);
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
    await record(ventaId,error.code==='EMAIL_ACTIVATION_REQUIRED'?'pendiente_activacion':'fallida',error.message,error.details||null);
    throw error;
  }
}

module.exports = { configured, entregarFacturaVisual, entregarDocumentos };
