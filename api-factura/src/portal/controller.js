const { randomUUID } = require('crypto');
const pool = require('../db/database');
const { encrypt, decrypt } = require('../middleware/crypto');
const { hashPassword, verifyPassword, newSessionToken, hashToken } = require('./security');
const { ensurePortalSchema } = require('./schema');
const { ejecutarPipeline, parsePipeline } = require('../services/integrationPipeline');

function clean(value, max = 255) { return String(value ?? '').trim().slice(0, max); }
function dataUrlFromFile(file) {
  if (!file?.buffer?.length) return null;
  return `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
}
function parseJson(value, fallback) { try { return JSON.parse(value); } catch { return fallback; } }
function bankOrigin() {
  if (process.env.BANK_ALLOWED_ORIGIN) return String(process.env.BANK_ALLOWED_ORIGIN).trim();
  try { return new URL(process.env.BANK_CHECKOUT_URL || 'https://bankyfinanzas.netlify.app/checkout').origin; }
  catch { return 'https://bankyfinanzas.netlify.app'; }
}
function publicAppUrl() { return process.env.PUBLIC_APP_URL || process.env.RENDER_EXTERNAL_URL || `http://localhost:${process.env.PORT || 3000}`; }
function publicApiUrl() { return process.env.PUBLIC_API_URL || process.env.RENDER_EXTERNAL_URL || `http://127.0.0.1:${process.env.PORT || 3000}`; }

async function register(req, res) {
  await ensurePortalSchema();
  const nombre = clean(req.body.nombre, 120);
  const email = clean(req.body.email, 160).toLowerCase();
  const password = String(req.body.password || '');
  const empresa = clean(req.body.empresa, 160);
  const tipo = clean(req.body.tipoIdentificacion || '02', 2);
  const numero = clean(req.body.numeroIdentificacion, 40);
  const correoFacturacion = clean(req.body.correoFacturacion || email, 160).toLowerCase();
  if (!nombre || !email || !empresa || !numero) return res.status(400).json({ error: 'Completa nombre, correo, empresa e identificación.' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Correo inválido' });
  const passwordHash = await hashPassword(password);
  const id = randomUUID();
  try {
    await pool.execute(
      `INSERT INTO portal_usuarios (id, nombre, email, password_hash, empresa, tipo_identificacion, numero_identificacion, correo_facturacion)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, nombre, email, passwordHash, empresa, tipo, encrypt(numero), correoFacturacion]
    );
    await pool.execute('INSERT INTO portal_perfiles (usuario_id, nombre_comercial) VALUES (?, ?)', [id, empresa]);
    return res.status(201).json({ id, nombre, email, empresa });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Ya existe una cuenta con ese correo.' });
    throw error;
  }
}

async function login(req, res) {
  await ensurePortalSchema();
  const email = clean(req.body.email, 160).toLowerCase();
  const [rows] = await pool.execute('SELECT * FROM portal_usuarios WHERE email = ? AND activo = TRUE LIMIT 1', [email]);
  const user = rows[0];
  if (!user || !(await verifyPassword(req.body.password, user.password_hash))) return res.status(401).json({ error: 'Correo o contraseña incorrectos.' });
  const token = newSessionToken();
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await pool.execute('INSERT INTO portal_sesiones (usuario_id, token_hash, expires_at) VALUES (?, ?, ?)', [user.id, hashToken(token), expires]);
  return res.json({ token, expiresAt: expires.toISOString(), user: { id: user.id, nombre: user.nombre, email: user.email, empresa: user.empresa } });
}

async function me(req, res) {
  const [rows] = await pool.execute(
    `SELECT u.id, u.nombre, u.email, u.empresa, u.tipo_identificacion, u.numero_identificacion, u.correo_facturacion,
            p.nombre_comercial, p.actividad_economica, p.telefono, p.provincia, p.canton, p.distrito, p.otras_senas,
            p.logo, p.logo_blanco, p.logo_posicion
     FROM portal_usuarios u LEFT JOIN portal_perfiles p ON p.usuario_id = u.id WHERE u.id = ? LIMIT 1`,
    [req.portalUser.usuario_id]
  );
  const u = rows[0];
  return res.json({
    id: u.id, nombre: u.nombre, email: u.email, empresa: u.empresa,
    tipoIdentificacion: u.tipo_identificacion, numeroIdentificacion: decrypt(u.numero_identificacion), correoFacturacion: u.correo_facturacion,
    perfil: {
      nombreComercial: u.nombre_comercial || '', actividadEconomica: u.actividad_economica || '', telefono: u.telefono || '',
      ubicacion: { provincia: u.provincia || '', canton: u.canton || '', distrito: u.distrito || '', otrasSenas: u.otras_senas || '' },
      logoUrl: u.logo || null, logoUrlBlanco: u.logo_blanco || null, logoPosicion: u.logo_posicion || 'left',
    }
  });
}

async function saveProfile(req, res) {
  const position = ['left','center','right'].includes(req.body.logoPosicion) ? req.body.logoPosicion : 'left';
  const logo = req.files?.logo?.[0] ? dataUrlFromFile(req.files.logo[0]) : null;
  const logoBlanco = req.files?.logoBlanco?.[0] ? dataUrlFromFile(req.files.logoBlanco[0]) : null;
  const current = await pool.execute('SELECT logo, logo_blanco FROM portal_perfiles WHERE usuario_id = ?', [req.portalUser.usuario_id]);
  const existing = current[0][0] || {};
  await pool.execute(
    `INSERT INTO portal_perfiles (usuario_id, nombre_comercial, actividad_economica, telefono, provincia, canton, distrito, otras_senas, logo, logo_blanco, logo_posicion)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE nombre_comercial=VALUES(nombre_comercial), actividad_economica=VALUES(actividad_economica), telefono=VALUES(telefono),
       provincia=VALUES(provincia), canton=VALUES(canton), distrito=VALUES(distrito), otras_senas=VALUES(otras_senas),
       logo=VALUES(logo), logo_blanco=VALUES(logo_blanco), logo_posicion=VALUES(logo_posicion)`,
    [req.portalUser.usuario_id, clean(req.body.nombreComercial, 160), clean(req.body.actividadEconomica, 12), clean(req.body.telefono, 30),
      clean(req.body.provincia, 3), clean(req.body.canton, 3), clean(req.body.distrito, 3), clean(req.body.otrasSenas, 255),
      logo || existing.logo || null, logoBlanco || existing.logo_blanco || null, position]
  );
  return me(req, res);
}

function normalizeItems(items) {
  if (!Array.isArray(items) || !items.length) throw new Error('Agrega al menos un producto o servicio.');
  return items.slice(0, 20).map((item, index) => {
    const cantidad = Math.max(Number(item.cantidad || 0), 0);
    const precio = Math.max(Number(item.precioUnitario || 0), 0);
    const descuento = Math.max(Number(item.descuento || 0), 0);
    const tarifa = Math.max(Number(item.impuestoTarifa || 0), 0);
    if (!clean(item.detalle, 255) || cantidad <= 0) throw new Error(`La línea ${index + 1} no es válida.`);
    const bruto = cantidad * precio;
    const subtotal = Math.max(bruto - descuento, 0);
    const impuesto = subtotal * tarifa / 100;
    return {
      numeroLinea: index + 1,
      codigoCabys: clean(item.codigoCabys, 13) || null,
      detalle: clean(item.detalle, 255), cantidad, unidadMedida: clean(item.unidadMedida || 'Sp', 20),
      precioUnitario: Number(precio.toFixed(2)), descuento: Number(descuento.toFixed(2)), impuestoTarifa: tarifa,
      subtotal: Number(subtotal.toFixed(2)), montoTotalLinea: Number((subtotal + impuesto).toFixed(2)),
    };
  });
}

async function createSale(req, res) {
  const receptor = req.body.receptor || {};
  const items = normalizeItems(req.body.items);
  const subtotal = items.reduce((a, i) => a + i.subtotal, 0);
  const descuento = items.reduce((a, i) => a + i.descuento, 0);
  const impuesto = items.reduce((a, i) => a + (i.montoTotalLinea - i.subtotal), 0);
  const total = items.reduce((a, i) => a + i.montoTotalLinea, 0);
  if (!clean(receptor.nombre,160) || !clean(receptor.correo,160)) return res.status(400).json({ error: 'Completa nombre y correo del cliente.' });
  const id = `V-${randomUUID().slice(0,8).toUpperCase()}`;
  const reference = `BANK-${id}`;
  await pool.execute(
    `INSERT INTO portal_ventas (id, usuario_id, receptor_nombre, receptor_tipo_id, receptor_numero_id, receptor_correo, items_json,
      subtotal, descuento, impuesto, total, moneda, estado, referencia_pago)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pendiente_pago', ?)`,
    [id, req.portalUser.usuario_id, clean(receptor.nombre,160), clean(receptor.identificacion?.tipo,2) || null,
      receptor.identificacion?.numero ? encrypt(clean(receptor.identificacion.numero,40)) : null, clean(receptor.correo,160).toLowerCase(), JSON.stringify(items),
      subtotal, descuento, impuesto, total, clean(req.body.moneda || 'CRC',3), reference]
  );
  return res.status(201).json(await getSaleObject(id, req.portalUser.usuario_id));
}

async function getSaleObject(id, userId) {
  const [rows] = await pool.execute('SELECT * FROM portal_ventas WHERE id = ? AND usuario_id = ? LIMIT 1', [id, userId]);
  if (!rows.length) return null;
  const v = rows[0];
  const [steps] = await pool.execute('SELECT servicio, endpoint, estado, http_status, mensaje, created_at FROM portal_integraciones WHERE venta_id = ? ORDER BY id', [id]);
  return {
    id: v.id, estado: v.estado, moneda: v.moneda, subtotal: Number(v.subtotal), descuento: Number(v.descuento), impuesto: Number(v.impuesto), total: Number(v.total),
    referenciaPago: v.referencia_pago, facturaId: v.factura_id || null, errorDetalle: v.error_detalle || null,
    receptor: { nombre: v.receptor_nombre, correo: v.receptor_correo, identificacion: v.receptor_numero_id ? { tipo: v.receptor_tipo_id, numero: decrypt(v.receptor_numero_id) } : null },
    items: parseJson(v.items_json, []), integraciones: steps, createdAt: v.created_at, updatedAt: v.updated_at,
  };
}

async function listSales(req, res) {
  const [rows] = await pool.execute('SELECT id FROM portal_ventas WHERE usuario_id = ? ORDER BY created_at DESC LIMIT 50', [req.portalUser.usuario_id]);
  const items = [];
  for (const row of rows) items.push(await getSaleObject(row.id, req.portalUser.usuario_id));
  return res.json({ items });
}

async function saleById(req, res) {
  const sale = await getSaleObject(req.params.id, req.portalUser.usuario_id);
  if (!sale) return res.status(404).json({ error: 'Venta no encontrada' });
  return res.json(sale);
}

async function startPayment(req, res) {
  const sale = await getSaleObject(req.params.id, req.portalUser.usuario_id);
  if (!sale) return res.status(404).json({ error: 'Venta no encontrada' });
  if (sale.estado === 'facturada') return res.json({ alreadyCompleted: true, facturaId: sale.facturaId });
  const checkout = new URL(process.env.BANK_CHECKOUT_URL || 'https://bankyfinanzas.netlify.app/checkout');
  checkout.searchParams.set('reference', sale.referenciaPago);
  checkout.searchParams.set('amount', String(sale.total));
  checkout.searchParams.set('currency', sale.moneda);
  checkout.searchParams.set('returnUrl', `${publicAppUrl()}/?paymentReference=${encodeURIComponent(sale.referenciaPago)}`);
  await pool.execute("UPDATE portal_ventas SET estado='esperando_banco' WHERE id=?", [sale.id]);
  return res.json({ checkoutUrl: checkout.toString(), referencia: sale.referenciaPago, monto: sale.total, moneda: sale.moneda, expectedOrigin: bankOrigin() });
}

async function verifyBankIfConfigured(sale, payload) {
  const verifyUrl = clean(process.env.BANK_VERIFY_URL, 1000);
  if (!verifyUrl) return null;
  const response = await fetch(verifyUrl, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reference: sale.referenciaPago, amount: sale.total, currency: sale.moneda, payload }),
    signal: AbortSignal.timeout(Number(process.env.BANK_VERIFY_TIMEOUT_MS || 12000)),
  });
  const text = await response.text(); let body = text; try { body = text ? JSON.parse(text) : null; } catch {}
  if (!response.ok) throw new Error(`El banco no validó el pago (HTTP ${response.status}).`);
  const ok = body?.paid === true || ['paid','success','completed','aprobado','pagado'].includes(String(body?.status || body?.estado || '').toLowerCase());
  if (!ok) throw new Error('El banco respondió, pero el pago todavía no aparece aprobado.');
  return body;
}

async function buildInvoiceFromSale(saleRow, userId) {
  const [rows] = await pool.execute(
    `SELECT u.empresa, u.tipo_identificacion, u.numero_identificacion, u.correo_facturacion,
            p.nombre_comercial, p.actividad_economica, p.telefono, p.provincia, p.canton, p.distrito, p.otras_senas, p.logo, p.logo_blanco, p.logo_posicion
     FROM portal_usuarios u LEFT JOIN portal_perfiles p ON p.usuario_id=u.id WHERE u.id=? LIMIT 1`, [userId]
  );
  const p = rows[0];
  const items = parseJson(saleRow.items_json, []);
  const totalGravado = items.filter((i)=>Number(i.impuestoTarifa||0)>0).reduce((a,i)=>a+Number(i.subtotal||0),0);
  const totalExento = items.filter((i)=>Number(i.impuestoTarifa||0)===0).reduce((a,i)=>a+Number(i.subtotal||0),0);
  return {
    origen: 'portal-api-factura', referenciaExterna: `venta:${saleRow.id}`, fecha: new Date().toISOString(), moneda: saleRow.moneda,
    condicionVenta: '01', medioPago: '02',
    emisor: {
      nombre: p.empresa, nombreComercial: p.nombre_comercial || p.empresa,
      identificacion: { tipo: p.tipo_identificacion, numero: decrypt(p.numero_identificacion) },
      correo: p.correo_facturacion, actividadEconomica: p.actividad_economica || undefined,
      telefono: p.telefono ? { codigoPais:'506', numero:String(p.telefono).replace(/\D/g,'') } : undefined,
      ubicacion: (p.provincia || p.canton || p.distrito || p.otras_senas) ? { provincia:p.provincia||'', canton:p.canton||'', distrito:p.distrito||'', otrasSenas:p.otras_senas||'' } : undefined,
      logoUrl: p.logo || null, logoUrlBlanco: p.logo_blanco || null, logoPosicion: p.logo_posicion || 'left',
    },
    receptor: {
      nombre: saleRow.receptor_nombre,
      identificacion: saleRow.receptor_numero_id ? { tipo: saleRow.receptor_tipo_id, numero: decrypt(saleRow.receptor_numero_id) } : undefined,
      correo: saleRow.receptor_correo,
    },
    items: items.map((i)=>({ ...i, impuesto: { tarifa:Number(i.impuestoTarifa||0) } })),
    totales: {
      totalGravado:Number(totalGravado.toFixed(2)), totalExento:Number(totalExento.toFixed(2)), totalDescuentos:Number(saleRow.descuento),
      totalImpuesto:Number(saleRow.impuesto), totalComprobante:Number(saleRow.total), totalVenta:Number((Number(saleRow.subtotal)+Number(saleRow.descuento)).toFixed(2)),
      totalVentaNeta:Number(saleRow.subtotal), mediosPago:[{ tipo:'02', total:Number(saleRow.total) }]
    },
    referencias: [], otrosCargos: [],
  };
}

async function processPaidSale(saleId) {
  const [rows] = await pool.execute('SELECT * FROM portal_ventas WHERE id=? LIMIT 1', [saleId]);
  if (!rows.length) throw new Error('Venta no encontrada');
  const row = rows[0];
  if (row.factura_id) return row.factura_id;
  await pool.execute("UPDATE portal_ventas SET estado='procesando_integraciones', error_detalle=NULL WHERE id=?", [saleId]);
  try {
    const payload = {
      receptor: { nombre: row.receptor_nombre, correo: row.receptor_correo },
      items: parseJson(row.items_json, []), total: Number(row.total), moneda: row.moneda, referenciaPago: row.referencia_pago,
    };
    await ejecutarPipeline(row, payload);
    const invoiceBody = await buildInvoiceFromSale(row, row.usuario_id);
    const response = await fetch(`${publicApiUrl()}/api/facturas`, {
      method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(invoiceBody), signal:AbortSignal.timeout(20000)
    });
    const text = await response.text(); let result = text; try { result = JSON.parse(text); } catch {}
    if (!response.ok || !result?.id) throw new Error(`No se pudo generar la factura: ${typeof result==='string'?result:JSON.stringify(result)}`);
    await pool.execute("UPDATE portal_ventas SET estado='facturada', factura_id=?, error_detalle=NULL WHERE id=?", [result.id, saleId]);
    return result.id;
  } catch (error) {
    await pool.execute("UPDATE portal_ventas SET estado='integracion_fallida', error_detalle=? WHERE id=?", [error.message, saleId]);
    throw error;
  }
}

async function confirmPayment(req, res) {
  const [rows] = await pool.execute('SELECT * FROM portal_ventas WHERE id=? AND usuario_id=? LIMIT 1', [req.params.id, req.portalUser.usuario_id]);
  if (!rows.length) return res.status(404).json({ error:'Venta no encontrada' });
  const row = rows[0];
  if (row.factura_id) return res.json(await getSaleObject(row.id, row.usuario_id));
  const mode = String(process.env.BANK_CONFIRM_MODE || 'postmessage').toLowerCase();
  let verified = null;
  try { verified = await verifyBankIfConfigured(await getSaleObject(row.id,row.usuario_id), req.body?.payload || req.body); } catch (e) { return res.status(409).json({ error:e.message }); }
  if (!verified) {
    if (mode !== 'postmessage') return res.status(409).json({ error:'Falta configurar BANK_VERIFY_URL o un callback del banco para validar el pago.' });
    if (String(req.body?.sourceOrigin || '') !== bankOrigin()) return res.status(403).json({ error:'El mensaje de pago no proviene del origen del banco configurado.' });
    const payload = req.body?.payload || {};
    const status = String(payload.status || payload.estado || '').toLowerCase();
    const success = payload.paid === true || payload.success === true || ['paid','success','completed','aprobado','pagado'].includes(status);
    const reference = payload.reference || payload.referencia || payload.paymentReference || payload.referenciaPago;
    if (!success) return res.status(409).json({ error:'El banco aún no reporta el pago como aprobado.' });
    if (reference && String(reference) !== row.referencia_pago) return res.status(409).json({ error:'La referencia del pago no coincide con la venta.' });
    verified = payload;
  }
  await pool.execute("UPDATE portal_ventas SET estado='pagada', pago_payload=? WHERE id=?", [JSON.stringify(verified || req.body || {}), row.id]);
  try { await processPaidSale(row.id); } catch (error) { return res.status(502).json({ error:'El pago fue aprobado, pero una integración posterior falló.', detalle:error.message, venta:await getSaleObject(row.id,row.usuario_id) }); }
  return res.json(await getSaleObject(row.id,row.usuario_id));
}

async function bankCallback(req, res) {
  const secret = process.env.BANK_CALLBACK_SECRET || '';
  if (!secret) return res.status(503).json({ error:'Callback bancario no configurado. Use BANK_CALLBACK_SECRET cuando el banco entregue su contrato.' });
  if (req.headers['x-bank-callback-secret'] !== secret) return res.status(403).json({ error:'Callback no autorizado' });
  const reference = clean(req.body.reference || req.body.referencia || req.body.paymentReference, 100);
  const status = String(req.body.status || req.body.estado || '').toLowerCase();
  const success = req.body.paid === true || req.body.success === true || ['paid','success','completed','aprobado','pagado'].includes(status);
  if (!reference || !success) return res.status(400).json({ error:'Callback incompleto o pago no aprobado' });
  const [rows] = await pool.execute('SELECT * FROM portal_ventas WHERE referencia_pago=? LIMIT 1', [reference]);
  if (!rows.length) return res.status(404).json({ error:'Referencia no encontrada' });
  const row = rows[0];
  await pool.execute("UPDATE portal_ventas SET estado='pagada', pago_payload=? WHERE id=?", [JSON.stringify(req.body), row.id]);
  try { const facturaId = await processPaidSale(row.id); return res.json({ ok:true, ventaId:row.id, facturaId }); }
  catch (error) { return res.status(502).json({ ok:false, ventaId:row.id, error:error.message }); }
}

async function retryPipeline(req, res) {
  const sale = await getSaleObject(req.params.id, req.portalUser.usuario_id);
  if (!sale) return res.status(404).json({ error:'Venta no encontrada' });
  if (!['pagada','integracion_fallida','procesando_integraciones'].includes(sale.estado)) return res.status(409).json({ error:'La venta todavía no tiene un pago aprobado.' });
  try { await processPaidSale(sale.id); return res.json(await getSaleObject(sale.id, req.portalUser.usuario_id)); }
  catch (error) { return res.status(502).json({ error:error.message, venta:await getSaleObject(sale.id,req.portalUser.usuario_id) }); }
}

async function config(req, res) {
  return res.json({
    serviceName:'API Factura',
    bank:{ checkoutUrl:process.env.BANK_CHECKOUT_URL || 'https://bankyfinanzas.netlify.app/checkout', origin:bankOrigin(), verificationConfigured:Boolean(process.env.BANK_VERIFY_URL), confirmMode:process.env.BANK_CONFIRM_MODE || 'postmessage' },
    pipeline:parsePipeline().map((x)=>({ name:x.name, url:x.url })),
    invoice:{ logoPositions:['left','center','right'] }
  });
}

module.exports = { register, login, me, saveProfile, createSale, listSales, saleById, startPayment, confirmPayment, bankCallback, retryPipeline, config };
