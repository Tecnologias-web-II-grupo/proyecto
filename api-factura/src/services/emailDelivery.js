const tls = require('tls');
const pool = require('../db/database');

function env(name, fallback='') { return String(process.env[name] || fallback).trim(); }
function firstEnv(...names) {
  for (const name of names) {
    const value = env(name);
    if (value) return value;
  }
  return '';
}
function directProvider() {
  const explicit = env('DIRECT_EMAIL_PROVIDER').toLowerCase();
  if (explicit) return explicit;
  if (firstEnv('GMAIL_USER','EMAIL_USER') && firstEnv('GMAIL_APP_PASSWORD','EMAIL_APP_PASSWORD')) return 'gmail';
  if (env('RESEND_API_KEY')) return 'resend';
  return 'smtp';
}
function smtpSettings() {
  const provider = directProvider();
  const gmail = provider === 'gmail';
  const user = firstEnv('SMTP_USER','GMAIL_USER','EMAIL_USER');
  const pass = firstEnv('SMTP_PASS','GMAIL_APP_PASSWORD','EMAIL_APP_PASSWORD');
  return {
    host: env('SMTP_HOST', gmail ? 'smtp.gmail.com' : 'smtp.gmail.com'),
    port: Number(env('SMTP_PORT', gmail ? '465' : '465')),
    user,
    pass,
    fromAddress: firstEnv('SMTP_FROM_EMAIL','EMAIL_FROM_ADDRESS') || user,
    fromName: env('SMTP_FROM_NAME', env('EMAIL_FROM_NAME','Factura Bonita')),
  };
}
function smtpConfigured() {
  const cfg = smtpSettings();
  return Boolean(cfg.host && cfg.user && cfg.pass && cfg.fromAddress);
}

function browserFormActionMode() { return String(process.env.EMAIL_BROWSER_FORM_ACTION || 'true').toLowerCase() === 'true'; }
function emailTestMode() { return String(process.env.EMAIL_TEST_MODE || 'false').toLowerCase() === 'true'; }

function configured() {
  if (browserFormActionMode()) return true;
  if (emailTestMode()) return true;
  if (env('EMAIL_DELIVERY_URL')) return true;
  if (directProvider() === 'resend') return Boolean(env('RESEND_API_KEY'));
  if (['smtp','gmail'].includes(directProvider())) return smtpConfigured();
  return false;
}

function endpointLabel() {
  if (browserFormActionMode()) return 'form-action-browser';
  if (emailTestMode()) return 'modo-prueba';
  if (env('EMAIL_DELIVERY_URL')) return env('EMAIL_DELIVERY_URL');
  if (directProvider() === 'resend') return env('RESEND_API_KEY') ? 'https://api.resend.com/emails' : '';
  if (['smtp','gmail'].includes(directProvider())) { const cfg=smtpSettings(); return smtpConfigured() ? `${cfg.host}:${cfg.port}` : ''; }
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
  if (!response.ok) throw new Error(`Resend respondió HTTP ${response.status}.`);
  return result;
}

function smtpRead(socket, timeoutMs=15000) {
  return new Promise((resolve, reject) => {
    let buffer = '';
    const timer = setTimeout(() => cleanup(new Error('Tiempo de espera agotado al comunicarse con el servidor de correo.')), timeoutMs);
    const onData = chunk => {
      buffer += chunk.toString('utf8');
      const lines = buffer.split(/\r?\n/).filter(Boolean);
      const last = lines[lines.length - 1] || '';
      if (/^\d{3} /.test(last)) cleanup(null, buffer);
    };
    const onError = err => cleanup(err);
    function cleanup(err, value) {
      clearTimeout(timer); socket.off('data', onData); socket.off('error', onError);
      err ? reject(err) : resolve(value);
    }
    socket.on('data', onData); socket.on('error', onError);
  });
}

async function smtpCommand(socket, command, expected) {
  if (command !== null) socket.write(command + '\r\n');
  const response = await smtpRead(socket);
  const code = Number(String(response).slice(0,3));
  const accepted = Array.isArray(expected) ? expected : [expected];
  if (!accepted.includes(code)) throw new Error(`El servidor de correo rechazó la operación (${code}).`);
  return response;
}

function headerSafe(value='') { return String(value).replace(/[\r\n]+/g, ' ').trim(); }
function wrapBase64(value) { return String(value).replace(/(.{76})/g, '$1\r\n'); }

function buildMimeMessage(payload, fromAddress, fromName) {
  const boundary = `----FacturaBonita_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  const html = `<div style="font-family:Arial,sans-serif;color:#102a38"><h2>Factura Bonita</h2><p>Hola ${headerSafe(payload.customerName || 'cliente')},</p><p>${headerSafe(payload.message || 'Adjuntamos su factura.')}</p><p>Referencia: <strong>${headerSafe(payload.invoiceId || '')}</strong></p></div>`;
  const parts = [
    `From: ${headerSafe(fromName)} <${headerSafe(fromAddress)}>`,
    `To: ${headerSafe(payload.to)}`,
    `Subject: ${headerSafe(payload.subject)}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    'Content-Transfer-Encoding: 8bit',
    '',
    html,
    ''
  ];
  for (const a of payload.attachments || []) {
    parts.push(
      `--${boundary}`,
      `Content-Type: ${a.contentType || 'application/octet-stream'}; name="${headerSafe(a.filename)}"`,
      'Content-Transfer-Encoding: base64',
      `Content-Disposition: attachment; filename="${headerSafe(a.filename)}"`,
      '',
      wrapBase64(a.contentBase64 || ''),
      ''
    );
  }
  parts.push(`--${boundary}--`, '');
  return parts.join('\r\n').replace(/^\./gm, '..');
}

async function sendWithSmtp(payload) {
  const { host, port, user, pass, fromAddress, fromName } = smtpSettings();
  if (!host || !user || !pass || !fromAddress) {
    const error = new Error('Falta configurar la cuenta emisora de correo del sistema.');
    error.code = 'EMAIL_SENDER_NOT_CONFIGURED';
    throw error;
  }
  const socket = tls.connect({ host, port, servername:host, rejectUnauthorized:true });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(()=>reject(new Error('No fue posible conectar con el servidor de correo.')), 15000);
    socket.once('secureConnect', ()=>{ clearTimeout(timer); resolve(); });
    socket.once('error', err=>{ clearTimeout(timer); reject(err); });
  });
  try {
    await smtpCommand(socket, null, 220);
    await smtpCommand(socket, `EHLO ${env('SMTP_HELO','facturabonita.local')}`, 250);
    await smtpCommand(socket, 'AUTH LOGIN', 334);
    await smtpCommand(socket, Buffer.from(user).toString('base64'), 334);
    await smtpCommand(socket, Buffer.from(pass).toString('base64'), 235);
    await smtpCommand(socket, `MAIL FROM:<${fromAddress}>`, 250);
    await smtpCommand(socket, `RCPT TO:<${payload.to}>`, [250,251]);
    await smtpCommand(socket, 'DATA', 354);
    const mime = buildMimeMessage(payload, fromAddress, fromName);
    socket.write(mime + '\r\n.\r\n');
    const sent = await smtpRead(socket);
    const sentCode = Number(String(sent).slice(0,3));
    if (sentCode !== 250) throw new Error(`El servidor de correo no aceptó el mensaje (${sentCode}).`);
    socket.write('QUIT\r\n');
    return { success:true, provider:'smtp', to:payload.to };
  } finally {
    socket.end();
  }
}

async function sendPayload(payload) {
  if (env('EMAIL_DELIVERY_URL')) return sendWithExternalEndpoint(payload);
  const provider = directProvider();
  if (provider === 'resend') return sendWithResend(payload);
  if (provider === 'smtp' || provider === 'gmail') return sendWithSmtp(payload);
  throw new Error(`Proveedor de correo directo no soportado: ${provider}.`);
}

function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(String(value || '').trim());
}

async function entregarFacturaVisual({ ventaId, to, clienteNombre, facturaId, pdfUrl }) {
  to = String(to || '').trim().toLowerCase();
  if (!validEmail(to)) {
    await record(ventaId,'fallida','El correo de entrega no tiene un formato válido.');
    const error = new Error('El correo de entrega no es válido.');
    error.code = 'INVALID_RECIPIENT_EMAIL';
    throw error;
  }
  if (!configured()) {
    await record(ventaId,'pendiente_configuracion','Falta configurar el correo saliente del sistema.');
    const error = new Error('El servicio de entrega por correo aún no está configurado.');
    error.code = 'EMAIL_NOT_CONFIGURED';
    throw error;
  }
  await record(ventaId,'procesando',`Preparando factura visual para ${to}.`);
  const pdf = await bufferFromUrl(pdfUrl);
  if (!pdf) throw new Error('No fue posible generar el PDF que se enviará por correo.');
  if (browserFormActionMode()) {
    const body = { success:true, provider:'browser-form-action', requiresBrowserSubmit:true, to, facturaId, pdfUrl };
    await record(ventaId,'completada',`Factura preparada para entrega a ${to}.`,body);
    return body;
  }
  if (emailTestMode()) {
    const body = { success:true, provider:'test', simulated:true, to, facturaId, pdfUrl };
    await record(ventaId,'completada',`Prueba completada para ${to}. La factura quedó disponible en la interfaz.`,body);
    return body;
  }
  const payload = {
    to,
    subject:`Factura ${facturaId} - Factura Bonita`,
    customerName:clienteNombre || '',
    invoiceId:facturaId,
    message:'Su pago fue aprobado. Adjuntamos la factura correspondiente a su compra.',
    attachments:[
      { filename:`factura-${facturaId}.pdf`, contentType:'application/pdf', contentBase64:pdf.toString('base64') }
    ]
  };
  try {
    const body = await sendPayload(payload);
    await record(ventaId,'completada',`Factura enviada a ${to}.`,body);
    return body;
  } catch (error) {
    await record(ventaId,'fallida',error.message,null);
    throw error;
  }
}

async function entregarDocumentos({ ventaId, to, clienteNombre, facturaId, pdfUrl, electronica, tributacion }) {
  to = String(to || '').trim().toLowerCase();
  if (!validEmail(to)) {
    await record(ventaId,'fallida','El correo de entrega no tiene un formato válido.');
    const error = new Error('El correo de entrega no es válido.');
    error.code = 'INVALID_RECIPIENT_EMAIL';
    throw error;
  }
  if (!configured()) {
    await record(ventaId,'pendiente_configuracion','Falta configurar el servicio de entrega por correo.');
    const error = new Error('El servicio de entrega por correo todavía no está configurado.');
    error.code = 'EMAIL_NOT_CONFIGURED';
    throw error;
  }
  await record(ventaId,'procesando',`Preparando entrega para ${to}.`);
  const pdf = await bufferFromUrl(pdfUrl);
  const xml = await documentBuffer({ content:electronica.xml, base64:electronica.xmlBase64, url:electronica.url });
  const receipt = await documentBuffer({ content:tributacion.receipt, base64:tributacion.receiptBase64, url:tributacion.receiptUrl });
  if (!pdf || !xml || !receipt) throw new Error('No fue posible reunir los documentos requeridos para la entrega al cliente.');
  if (emailTestMode()) {
    const body = { success:true, provider:'test', simulated:true, to, facturaId, pdfUrl };
    await record(ventaId,'completada',`Prueba completada para ${to}. Los documentos quedaron disponibles en la interfaz.`,body);
    return body;
  }
  const payload = {
    to,
    subject:`Documentos de su compra - ${facturaId}`,
    customerName:clienteNombre || '',
    invoiceId:facturaId,
    message:'Su operación fue procesada correctamente. Adjuntamos los documentos correspondientes.',
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
    await record(ventaId,'fallida',error.message,null);
    throw error;
  }
}

module.exports = { configured, emailTestMode, browserFormActionMode, entregarFacturaVisual, entregarDocumentos };
