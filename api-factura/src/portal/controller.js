const { randomUUID, createHmac } = require('crypto');
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
function identificationHash(value) { return createHmac('sha256', String(process.env.ENCRYPTION_KEY || 'portal-client-key')).update(String(value || '')).digest('hex'); }
function bankOrigin() {
  if (process.env.BANK_ALLOWED_ORIGIN) return String(process.env.BANK_ALLOWED_ORIGIN).trim();
  try { return new URL(process.env.BANK_CHECKOUT_URL || 'https://bankyfinanzas.netlify.app/checkout').origin; }
  catch { return 'https://bankyfinanzas.netlify.app'; }
}
function publicAppUrl() { return process.env.PUBLIC_APP_URL || process.env.RENDER_EXTERNAL_URL || `http://localhost:${process.env.PORT || 3000}`; }
function publicApiUrl() { return process.env.PUBLIC_API_URL || process.env.RENDER_EXTERNAL_URL || `http://127.0.0.1:${process.env.PORT || 3000}`; }

function taxCode(rate) {
  const n = Number(rate || 0);
  if (n === 13) return '08';
  if (n === 4) return '03';
  if (n === 2) return '02';
  if (n === 1) return '01';
  return '01';
}
function compactLocation(value = {}) {
  const out = {
    provincia: clean(value.provincia, 3), canton: clean(value.canton, 3), distrito: clean(value.distrito, 3), otrasSenas: clean(value.otrasSenas, 250),
  };
  return Object.values(out).some(Boolean) ? out : null;
}
async function portalMerchant(userId) {
  const [rows] = await pool.execute('SELECT empresa, tipo_identificacion, numero_identificacion FROM portal_usuarios WHERE id=? LIMIT 1', [userId]);
  const row = rows[0] || {};
  return {
    name: clean(row.empresa, 160),
    id: row.numero_identificacion ? decrypt(row.numero_identificacion) : '',
    type: clean(row.tipo_identificacion, 2),
  };
}

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
  if (!/^\d{8,12}$/.test(numero)) return res.status(400).json({ error: 'La identificación debe contener entre 8 y 12 dígitos.' });
  if (req.body.actividadEconomica && !/^\d{6}$/.test(String(req.body.actividadEconomica))) return res.status(400).json({ error:'La actividad económica debe tener 6 dígitos.' });
  const passwordHash = await hashPassword(password);
  const id = randomUUID();
  try {
    await pool.execute(
      `INSERT INTO portal_usuarios (id, nombre, email, password_hash, empresa, tipo_identificacion, numero_identificacion, correo_facturacion)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, nombre, email, passwordHash, empresa, tipo, encrypt(numero), correoFacturacion]
    );
    await pool.execute(
      `INSERT INTO portal_perfiles (usuario_id, nombre_comercial, actividad_economica, telefono, provincia, canton, distrito, otras_senas)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, empresa, clean(req.body.actividadEconomica, 6), clean(req.body.telefono, 30), clean(req.body.provincia, 3), clean(req.body.canton, 3), clean(req.body.distrito, 3), clean(req.body.otrasSenas, 255)]
    );
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
  const [current] = await pool.execute('SELECT logo, logo_blanco FROM portal_perfiles WHERE usuario_id = ?', [req.portalUser.usuario_id]);
  const existing = current[0] || {};
  await pool.execute(
    `INSERT INTO portal_perfiles (usuario_id, logo, logo_blanco, logo_posicion)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE logo=VALUES(logo), logo_blanco=VALUES(logo_blanco), logo_posicion=VALUES(logo_posicion)`,
    [req.portalUser.usuario_id, logo || existing.logo || null, logoBlanco || existing.logo_blanco || null, position]
  );
  return me(req, res);
}

function normalizeItems(items) {
  if (!Array.isArray(items) || !items.length) throw new Error('Agrega al menos un producto o servicio.');
  return items.slice(0, 50).map((item, index) => {
    const cantidad = Number(item.cantidad || 0);
    const precio = Number(item.precioUnitario || 0);
    const descuento = Number(item.descuento || 0);
    const tarifa = Number(item.impuestoTarifa || 0);
    const detalle = clean(item.detalle, 255);
    const cabys = clean(item.codigoCabys, 13);
    if (!detalle) throw new Error(`Escribe la descripción de la línea ${index + 1}.`);
    if (!cabys || !/^\d{13}$/.test(cabys)) throw new Error(`La línea ${index + 1} requiere un código CAByS de 13 dígitos.`);
    if (!Number.isInteger(cantidad) || cantidad < 1 || cantidad > 100000) throw new Error(`La cantidad de la línea ${index + 1} debe ser un número entero entre 1 y 100000.`);
    if (!Number.isInteger(precio) || precio < 1 || precio > 999999999) throw new Error(`El precio de la línea ${index + 1} debe ser un monto entero mayor que cero.`);
    if (!Number.isInteger(descuento) || descuento < 0) throw new Error(`El descuento de la línea ${index + 1} debe ser un monto entero mayor o igual a cero.`);
    if (![0,1,2,4,13].includes(tarifa)) throw new Error(`La tarifa de IVA de la línea ${index + 1} no es válida.`);
    const bruto = cantidad * precio;
    if (descuento > bruto) throw new Error(`El descuento de la línea ${index + 1} no puede superar el importe de la línea.`);
    const subtotal = bruto - descuento;
    const impuestoMonto = subtotal * tarifa / 100;
    const codigoComercial = clean(item.codigoComercial, 50);
    const impuesto = { codigo:'01', codigoTarifaIVA:clean(item.codigoTarifaIVA,2) || taxCode(tarifa), tarifa, factorCalculoIVA:1, monto:Number(impuestoMonto.toFixed(2)) };
    return {
      numeroLinea: index + 1,
      tipoItem: item.tipoItem === 'mercancia' ? 'mercancia' : 'servicio',
      codigoCabys: cabys,
      codigosComerciales: codigoComercial ? [{ tipo:'04', codigo:codigoComercial }] : [],
      cantidad,
      unidadMedida: clean(item.unidadMedida || 'Sp', 20),
      unidadMedidaComercial: clean(item.unidadMedidaComercial || 'Unidad', 40),
      tipoTransaccion: clean(item.tipoTransaccion || '01', 2),
      detalle,
      precioUnitario: Number(precio.toFixed(2)),
      montoTotal: Number(bruto.toFixed(2)),
      descuento: Number(descuento.toFixed(2)),
      descuentos: descuento > 0 ? [{ monto:Number(descuento.toFixed(2)), codigo:'01', naturaleza:'Descuento aplicado a la venta' }] : [],
      subtotal: Number(subtotal.toFixed(2)),
      baseImponible: Number(subtotal.toFixed(2)),
      impuestoTarifa: tarifa,
      impuesto: { tarifa },
      impuestos: [impuesto],
      impuestoNeto: Number(impuestoMonto.toFixed(2)),
      montoTotalLinea: Number((subtotal + impuestoMonto).toFixed(2)),
    };
  });
}

async function createSale(req, res) {
  const receptor = req.body.receptor || {};
  const items = normalizeItems(req.body.items);
  const subtotal = items.reduce((a, i) => a + i.subtotal, 0);
  const descuento = items.reduce((a, i) => a + i.descuento, 0);
  const impuesto = items.reduce((a, i) => a + i.impuestoNeto, 0);
  const total = items.reduce((a, i) => a + i.montoTotalLinea, 0);
  const receptorNombre=clean(receptor.nombre,160), receptorCorreo=clean(receptor.correo,160).toLowerCase(), receptorNumero=clean(receptor.identificacion?.numero,40);
  if (!receptorNombre || !receptorCorreo || !receptorNumero) return res.status(400).json({ error: 'Completa nombre, identificación y correo del cliente.' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(receptorCorreo)) return res.status(400).json({ error:'El correo del cliente no es válido.' });
  if (!/^\d{8,12}$/.test(receptorNumero)) return res.status(400).json({ error:'La identificación del cliente debe contener entre 8 y 12 dígitos.' });
  if (receptor.actividadEconomica && !/^\d{6}$/.test(String(receptor.actividadEconomica))) return res.status(400).json({ error:'La actividad económica del cliente debe tener 6 dígitos.' });
  if (total <= 0) return res.status(400).json({ error:'El total de la venta debe ser mayor que cero.' });
  const id = `V-${randomUUID().slice(0,8).toUpperCase()}`;
  const reference = `BANK-${id}`;
  const extra = {
    nombreComercial: clean(receptor.nombreComercial,160), actividadEconomica: clean(receptor.actividadEconomica,6), telefono: clean(receptor.telefono,30),
    ubicacion: compactLocation(receptor.ubicacion || {}), condicionVenta: clean(req.body.condicionVenta || '01',2),
    detalleCondicionVenta: clean(req.body.detalleCondicionVenta || 'Contado',120), medioPago: clean(req.body.medioPago || '02',2),
    plazoCredito: Math.max(Number(req.body.plazoCredito || 0),0), observaciones: clean(req.body.observaciones,500),
  };
  await pool.execute(
    `INSERT INTO portal_ventas (id, usuario_id, receptor_nombre, receptor_tipo_id, receptor_numero_id, receptor_correo, items_json,
      subtotal, descuento, impuesto, total, moneda, estado, referencia_pago, datos_venta_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pendiente_pago', ?, ?)`,
    [id, req.portalUser.usuario_id, clean(receptor.nombre,160), clean(receptor.identificacion?.tipo,2) || null,
      receptor.identificacion?.numero ? encrypt(clean(receptor.identificacion.numero,40)) : null, clean(receptor.correo,160).toLowerCase(), JSON.stringify(items),
      subtotal, descuento, impuesto, total, clean(req.body.moneda || 'CRC',3), reference, JSON.stringify(extra)]
  );
  const clientNumber=clean(receptor.identificacion?.numero,40);
  const clientType=clean(receptor.identificacion?.tipo,2)||'01';
  await pool.execute(
    `INSERT INTO portal_clientes (usuario_id,nombre,nombre_comercial,tipo_identificacion,numero_identificacion,identificacion_hash,correo,actividad_economica,telefono,provincia,canton,distrito,otras_senas)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
     ON DUPLICATE KEY UPDATE nombre=VALUES(nombre),nombre_comercial=VALUES(nombre_comercial),numero_identificacion=VALUES(numero_identificacion),correo=VALUES(correo),actividad_economica=VALUES(actividad_economica),telefono=VALUES(telefono),provincia=VALUES(provincia),canton=VALUES(canton),distrito=VALUES(distrito),otras_senas=VALUES(otras_senas),updated_at=CURRENT_TIMESTAMP`,
    [req.portalUser.usuario_id,clean(receptor.nombre,160),clean(receptor.nombreComercial,160),clientType,encrypt(clientNumber),identificationHash(clientNumber),clean(receptor.correo,160).toLowerCase(),clean(receptor.actividadEconomica,12),clean(receptor.telefono,30),clean(receptor.ubicacion?.provincia,3),clean(receptor.ubicacion?.canton,3),clean(receptor.ubicacion?.distrito,3),clean(receptor.ubicacion?.otrasSenas,255)]
  );
  return res.status(201).json(await getSaleObject(id, req.portalUser.usuario_id));
}

async function getSaleObject(id, userId) {
  const [rows] = await pool.execute('SELECT * FROM portal_ventas WHERE id = ? AND usuario_id = ? LIMIT 1', [id, userId]);
  if (!rows.length) return null;
  const v = rows[0];
  const extra = parseJson(v.datos_venta_json, {});
  const [steps] = await pool.execute('SELECT servicio, endpoint, estado, http_status, mensaje, created_at FROM portal_integraciones WHERE venta_id = ? ORDER BY id', [id]);
  return {
    id: v.id, estado: v.estado, moneda: v.moneda, subtotal: Number(v.subtotal), descuento: Number(v.descuento), impuesto: Number(v.impuesto), total: Number(v.total),
    referenciaPago: v.referencia_pago, facturaId: v.factura_id || null, errorDetalle: v.error_detalle || null,
    receptor: { nombre: v.receptor_nombre, nombreComercial:extra.nombreComercial||'', actividadEconomica:extra.actividadEconomica||'', telefono:extra.telefono||'', ubicacion:extra.ubicacion||null, correo: v.receptor_correo, identificacion: v.receptor_numero_id ? { tipo: v.receptor_tipo_id, numero: decrypt(v.receptor_numero_id) } : null },
    condicionVenta:extra.condicionVenta||'01', detalleCondicionVenta:extra.detalleCondicionVenta||'', medioPago:extra.medioPago||'02', plazoCredito:Number(extra.plazoCredito||0),
    items: parseJson(v.items_json, []), integraciones: steps, createdAt: v.created_at, updatedAt: v.updated_at,
  };
}

async function listClients(req, res) {
  const [rows] = await pool.execute(
    `SELECT id,nombre,nombre_comercial,tipo_identificacion,numero_identificacion,correo,actividad_economica,telefono,provincia,canton,distrito,otras_senas
     FROM portal_clientes WHERE usuario_id=? ORDER BY updated_at DESC LIMIT 50`, [req.portalUser.usuario_id]
  );
  const items=rows.map(r=>({id:`c-${r.id}`,nombre:r.nombre,nombreComercial:r.nombre_comercial||'',tipo:r.tipo_identificacion,numero:decrypt(r.numero_identificacion),correo:r.correo,actividadEconomica:r.actividad_economica||'',telefono:r.telefono||'',provincia:r.provincia||'',canton:r.canton||'',distrito:r.distrito||'',otrasSenas:r.otras_senas||''}));
  if (items.length < 10) {
    const [sales]=await pool.execute(`SELECT id,receptor_nombre,receptor_tipo_id,receptor_numero_id,receptor_correo,datos_venta_json FROM portal_ventas WHERE usuario_id=? AND receptor_numero_id IS NOT NULL ORDER BY updated_at DESC LIMIT 30`,[req.portalUser.usuario_id]);
    const seen=new Set(items.map(x=>`${x.tipo}:${x.numero}`));
    for (const v of sales) {
      const numero=decrypt(v.receptor_numero_id), key=`${v.receptor_tipo_id}:${numero}`; if(seen.has(key))continue; seen.add(key);
      const extra=parseJson(v.datos_venta_json,{}), ub=extra.ubicacion||{};
      items.push({id:`v-${v.id}`,nombre:v.receptor_nombre,nombreComercial:extra.nombreComercial||'',tipo:v.receptor_tipo_id||'01',numero,correo:v.receptor_correo,actividadEconomica:extra.actividadEconomica||'',telefono:extra.telefono||'',provincia:ub.provincia||'',canton:ub.canton||'',distrito:ub.distrito||'',otrasSenas:ub.otrasSenas||''});
    }
  }
  return res.json({items:items.slice(0,50)});
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
  if (Number(sale.total) <= 0) return res.status(400).json({ error:'No se puede iniciar un pago con monto cero.' });
  const merchant = await portalMerchant(req.portalUser.usuario_id);
  const checkout = new URL(process.env.BANK_CHECKOUT_URL || 'https://bankyfinanzas.netlify.app/checkout');
  checkout.searchParams.set('reference', sale.referenciaPago);
  checkout.searchParams.set('amount', String(sale.total));
  checkout.searchParams.set('currency', sale.moneda);
  checkout.searchParams.set('returnUrl', `${publicAppUrl()}/?paymentReference=${encodeURIComponent(sale.referenciaPago)}`);
  checkout.searchParams.set('description', sale.items?.[0]?.detalle || 'Compra');
  const merchantValue = clean(process.env.BANK_MERCHANT_ID || merchant.id || merchant.name, 160);
  const merchantParam = clean(process.env.BANK_MERCHANT_PARAM || 'merchant', 60) || 'merchant';
  if (merchantValue) {
    checkout.searchParams.set(merchantParam, merchantValue);
    // Compatibilidad con implementaciones estudiantiles que nombren el comercio de forma distinta.
    if (String(process.env.BANK_MERCHANT_ALIASES || 'true').toLowerCase() !== 'false') {
      for (const alias of ['merchant','merchantId','commerce','comercio']) if (alias !== merchantParam) checkout.searchParams.set(alias, merchantValue);
    }
  }
  if (merchant.name) checkout.searchParams.set('merchantName', merchant.name);
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
  const extra = parseJson(saleRow.datos_venta_json, {});
  const isService=(i)=>i.tipoItem!=='mercancia';
  const gravado=(i)=>Number(i.impuestoTarifa||0)>0;
  const sum=(arr)=>Number(arr.reduce((a,i)=>a+Number(i.subtotal||0),0).toFixed(2));
  const servGrav=sum(items.filter(i=>isService(i)&&gravado(i))), servEx=sum(items.filter(i=>isService(i)&&!gravado(i)));
  const mercGrav=sum(items.filter(i=>!isService(i)&&gravado(i))), mercEx=sum(items.filter(i=>!isService(i)&&!gravado(i)));
  const totalGrav=Number((servGrav+mercGrav).toFixed(2)), totalEx=Number((servEx+mercEx).toFixed(2));
  const receptorUb=extra.ubicacion || null;
  return {
    perfilValidacion:'v44-visual', origen:'portal-api-factura', referenciaExterna:`venta:${saleRow.id}`, fecha:new Date().toISOString(), moneda:saleRow.moneda,
    condicionVenta:extra.condicionVenta||'01', detalleCondicionVenta:extra.detalleCondicionVenta||'Contado', medioPago:extra.medioPago||'02', plazoCredito:Number(extra.plazoCredito||0),
    proveedorSistemas:{ nombre:clean(process.env.SYSTEM_PROVIDER_NAME||'API Factura',80), identificacion:clean(process.env.SYSTEM_PROVIDER_ID||'3-101-999999',40) },
    emisor:{
      nombre:p.empresa, nombreComercial:p.nombre_comercial||p.empresa, actividadEconomica:p.actividad_economica||'000000',
      identificacion:{tipo:p.tipo_identificacion,numero:decrypt(p.numero_identificacion)}, correo:p.correo_facturacion,
      telefono:p.telefono?{codigoPais:'506',numero:String(p.telefono).replace(/\D/g,'')}:undefined,
      ubicacion:(p.provincia||p.canton||p.distrito||p.otras_senas)?{provincia:p.provincia||'',canton:p.canton||'',distrito:p.distrito||'',otrasSenas:p.otras_senas||''}:undefined,
      logoUrl:p.logo||null,logoUrlBlanco:p.logo_blanco||null,logoPosicion:p.logo_posicion||'left'
    },
    receptor:{
      nombre:saleRow.receptor_nombre,nombreComercial:extra.nombreComercial||undefined,actividadEconomica:extra.actividadEconomica||undefined,
      identificacion:saleRow.receptor_numero_id?{tipo:saleRow.receptor_tipo_id,numero:decrypt(saleRow.receptor_numero_id)}:undefined,correo:saleRow.receptor_correo,
      telefono:extra.telefono?{codigoPais:'506',numero:String(extra.telefono).replace(/\D/g,'')}:undefined,ubicacion:receptorUb||undefined
    },
    items,
    otrosCargos:[],
    totales:{
      totalServGravados:servGrav,totalServExentos:servEx,totalServExonerados:0,totalServNoSujetos:0,
      totalMercanciasGravadas:mercGrav,totalMercanciasExentas:mercEx,totalMercanciasExoneradas:0,totalMercanciasNoSujetas:0,
      totalGravado:totalGrav,totalExento:totalEx,totalExonerado:0,totalNoSujeto:0,
      totalVenta:Number((Number(saleRow.subtotal)+Number(saleRow.descuento)).toFixed(2)),totalDescuentos:Number(saleRow.descuento),totalVentaNeta:Number(saleRow.subtotal),
      totalImpuesto:Number(saleRow.impuesto),totalIVADevuelto:0,totalOtrosCargos:0,totalComprobante:Number(saleRow.total),mediosPago:[{tipo:extra.medioPago||'02',total:Number(saleRow.total)}]
    },
    referencias:[],otros:{observaciones:extra.observaciones||'',informacionAdicional:''}
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
    serviceName:'Factura Bonita',
    bank:{ checkoutUrl:process.env.BANK_CHECKOUT_URL || 'https://bankyfinanzas.netlify.app/checkout', origin:bankOrigin(), verificationConfigured:Boolean(process.env.BANK_VERIFY_URL), confirmMode:process.env.BANK_CONFIRM_MODE || 'postmessage' },
    invoice:{ logoPositions:['left','center','right'] }
  });
}

module.exports = { register, login, me, saveProfile, listClients, createSale, listSales, saleById, startPayment, confirmPayment, bankCallback, retryPipeline, config };
