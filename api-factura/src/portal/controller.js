const { randomUUID, createHmac } = require('crypto');
const pool = require('../db/database');
const { encrypt, decrypt } = require('../middleware/crypto');
const { hashPassword, verifyPassword, newSessionToken, hashToken } = require('./security');
const { ensurePortalSchema } = require('./schema');
const { ejecutarPipeline, parsePipeline } = require('../services/integrationPipeline');
const { validarFirmaDigital, solicitarFacturaElectronica, enviarTributacion } = require('../services/ecosystemIntegration');
const { configured: emailConfigured, emailTestMode, browserFormActionMode, entregarFacturaVisual, entregarDocumentos } = require('../services/emailDelivery');

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
    provincia: clean(value.provincia, 80), canton: clean(value.canton, 80), distrito: clean(value.distrito, 80), otrasSenas: clean(value.otrasSenas, 250),
  };
  return Object.values(out).some(Boolean) ? out : null;
}

function invoiceLocation(value = {}) {
  const provincia = clean(value.provincia, 80);
  const canton = clean(value.canton, 80);
  const distrito = clean(value.distrito, 80);
  const otras = clean(value.otrasSenas, 250);
  const out = {};
  // El perfil visual acepta nombres legibles. Solo enviamos códigos estructurados
  // cuando el usuario realmente ingresó códigos numéricos.
  if (/^\d{1,3}$/.test(provincia)) out.provincia = provincia;
  if (/^\d{1,3}$/.test(canton)) out.canton = canton;
  if (/^\d{1,3}$/.test(distrito)) out.distrito = distrito;
  const nombres = [
    provincia && !/^\d{1,3}$/.test(provincia) ? provincia : '',
    canton && !/^\d{1,3}$/.test(canton) ? canton : '',
    distrito && !/^\d{1,3}$/.test(distrito) ? distrito : ''
  ].filter(Boolean);
  const texto = [nombres.join(', '), otras].filter(Boolean).join('. ');
  if (texto) out.otrasSenas = texto.slice(0, 250);
  return Object.keys(out).length ? out : undefined;
}
async function portalMerchant(userId) {
  const [rows] = await pool.execute('SELECT u.empresa, u.tipo_identificacion, u.numero_identificacion, p.bank_merchant_id, p.bank_afiliado FROM portal_usuarios u LEFT JOIN portal_perfiles p ON p.usuario_id=u.id WHERE u.id=? LIMIT 1', [userId]);
  const row = rows[0] || {};
  return {
    name: clean(row.empresa, 160),
    id: row.numero_identificacion ? decrypt(row.numero_identificacion) : '',
    type: clean(row.tipo_identificacion, 2),
    bankMerchantId: clean(row.bank_merchant_id, 160),
    bankAfiliado: Boolean(row.bank_afiliado),
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
      [id, empresa, clean(req.body.actividadEconomica, 6), clean(req.body.telefono, 30), clean(req.body.provincia, 80), clean(req.body.canton, 80), clean(req.body.distrito, 80), clean(req.body.otrasSenas, 255)]
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
            p.logo, p.logo_blanco, p.logo_posicion, p.bank_merchant_id, p.bank_afiliado
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
      bankMerchantId: u.bank_merchant_id || '', bankAfiliado: Boolean(u.bank_afiliado),
    }
  });
}

async function saveProfile(req, res) {
  const position = ['left','center','right'].includes(req.body.logoPosicion) ? req.body.logoPosicion : 'left';
  const logo = req.files?.logo?.[0] ? dataUrlFromFile(req.files.logo[0]) : null;
  const logoBlanco = req.files?.logoBlanco?.[0] ? dataUrlFromFile(req.files.logoBlanco[0]) : null;
  const [current] = await pool.execute('SELECT logo, logo_blanco FROM portal_perfiles WHERE usuario_id = ?', [req.portalUser.usuario_id]);
  const existing = current[0] || {};
  const effectiveLogo = logo || existing.logo || null;
  const effectiveWhiteLogo = logoBlanco || existing.logo_blanco || null;

  await pool.execute(
    `INSERT INTO portal_perfiles (usuario_id, logo, logo_blanco, logo_posicion)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE logo=VALUES(logo), logo_blanco=VALUES(logo_blanco), logo_posicion=VALUES(logo_posicion)`,
    [req.portalUser.usuario_id, effectiveLogo, effectiveWhiteLogo, position]
  );

  // La identidad visual pertenece a la cuenta del negocio. Si el usuario cambia
  // el logo o su posición, las facturas ya generadas desde este portal deben
  // reflejar la configuración vigente al volver a abrir su PDF.
  await pool.execute(
    `UPDATE facturas f
       INNER JOIN portal_ventas v ON v.factura_id = f.id
       SET f.emisor_logo = ?, f.emisor_logo_blanco = ?, f.emisor_logo_posicion = ?
     WHERE v.usuario_id = ?`,
    [effectiveLogo, effectiveWhiteLogo, position, req.portalUser.usuario_id]
  );

  return me(req, res);
}


async function saveBankProfile(req, res) {
  const affiliated = req.body?.bankAfiliado === true || String(req.body?.bankAfiliado || '').toLowerCase() === 'true';
  const merchantId = clean(req.body?.bankMerchantId, 160);
  if (affiliated && !merchantId) return res.status(400).json({ error:'Indica el identificador de comercio de Credenciales API de BankyFinanzas.' });
  if (merchantId && !/^[A-Za-z0-9_-]{20,128}$/.test(merchantId)) return res.status(400).json({ error:'El identificador de comercio de BankyFinanzas no tiene un formato válido.' });
  await pool.execute(
    `INSERT INTO portal_perfiles (usuario_id, bank_merchant_id, bank_afiliado)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE bank_merchant_id=VALUES(bank_merchant_id), bank_afiliado=VALUES(bank_afiliado), updated_at=CURRENT_TIMESTAMP`,
    [req.portalUser.usuario_id, merchantId || null, affiliated ? 1 : 0]
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
    if (cabys && !/^\d{13}$/.test(cabys)) throw new Error(`El CAByS de la línea ${index + 1} debe tener 13 dígitos cuando se indique.`);
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
      codigoCabys: cabys || undefined,
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
    [req.portalUser.usuario_id,clean(receptor.nombre,160),clean(receptor.nombreComercial,160),clientType,encrypt(clientNumber),identificationHash(clientNumber),clean(receptor.correo,160).toLowerCase(),clean(receptor.actividadEconomica,12),clean(receptor.telefono,30),clean(receptor.ubicacion?.provincia,80),clean(receptor.ubicacion?.canton,80),clean(receptor.ubicacion?.distrito,80),clean(receptor.ubicacion?.otrasSenas,255)]
  );
  return res.status(201).json(await getSaleObject(id, req.portalUser.usuario_id));
}


async function updateSale(req, res) {
  const [existingRows] = await pool.execute('SELECT estado, factura_id FROM portal_ventas WHERE id=? AND usuario_id=? LIMIT 1', [req.params.id, req.portalUser.usuario_id]);
  if (!existingRows.length) return res.status(404).json({ error:'Venta no encontrada' });
  const current = existingRows[0];
  if (current.factura_id || current.estado !== 'pendiente_pago') return res.status(409).json({ error:'Solo puedes editar una venta guardada antes de iniciar el pago.' });

  const receptor = req.body.receptor || {};
  const items = normalizeItems(req.body.items);
  const subtotal = items.reduce((a, i) => a + i.subtotal, 0);
  const descuento = items.reduce((a, i) => a + i.descuento, 0);
  const impuesto = items.reduce((a, i) => a + i.impuestoNeto, 0);
  const total = items.reduce((a, i) => a + i.montoTotalLinea, 0);
  const receptorNombre=clean(receptor.nombre,160), receptorCorreo=clean(receptor.correo,160).toLowerCase(), receptorNumero=clean(receptor.identificacion?.numero,40);
  if (!receptorNombre || !receptorCorreo || !receptorNumero) return res.status(400).json({ error:'Completa nombre, identificación y correo del cliente.' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(receptorCorreo)) return res.status(400).json({ error:'El correo del cliente no es válido.' });
  if (!/^\d{8,12}$/.test(receptorNumero)) return res.status(400).json({ error:'La identificación del cliente debe contener entre 8 y 12 dígitos.' });
  if (total <= 0) return res.status(400).json({ error:'El total de la venta debe ser mayor que cero.' });

  const extra = {
    nombreComercial: clean(receptor.nombreComercial,160), actividadEconomica: clean(receptor.actividadEconomica,6), telefono: clean(receptor.telefono,30),
    ubicacion: compactLocation(receptor.ubicacion || {}), condicionVenta: clean(req.body.condicionVenta || '01',2),
    detalleCondicionVenta: clean(req.body.detalleCondicionVenta || 'Contado',120), medioPago: clean(req.body.medioPago || '02',2),
    plazoCredito: Math.max(Number(req.body.plazoCredito || 0),0), observaciones: clean(req.body.observaciones,500),
  };
  await pool.execute(
    `UPDATE portal_ventas SET receptor_nombre=?, receptor_tipo_id=?, receptor_numero_id=?, receptor_correo=?, items_json=?, datos_venta_json=?, subtotal=?, descuento=?, impuesto=?, total=?, moneda=?, error_detalle=NULL WHERE id=? AND usuario_id=?`,
    [receptorNombre, clean(receptor.identificacion?.tipo,2)||null, encrypt(receptorNumero), receptorCorreo, JSON.stringify(items), JSON.stringify(extra), subtotal, descuento, impuesto, total, clean(req.body.moneda||'CRC',3), req.params.id, req.portalUser.usuario_id]
  );
  return res.json(await getSaleObject(req.params.id, req.portalUser.usuario_id));
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
    items: parseJson(v.items_json, []), integraciones: steps,
    pago: { intentId:v.bank_intent_id||null, paymentId:v.bank_payment_id||null, transactionCode:v.bank_transaction_code||null, confirmadoAt:v.pago_confirmado_at||null },
    createdAt: v.created_at, updatedAt: v.updated_at,
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
  if (sale.estado === 'entregada') return res.json({ alreadyCompleted: true, facturaId: sale.facturaId });
  if (sale?.pago?.transactionCode || sale?.pago?.confirmadoAt) return res.status(409).json({ error:'Esta venta ya tiene un pago aprobado y está procesando sus documentos.' });
  if (Number(sale.total) <= 0) return res.status(400).json({ error:'No se puede iniciar un pago con monto cero.' });
  const merchant = await portalMerchant(req.portalUser.usuario_id);
  if (!merchant.bankAfiliado) return res.status(409).json({ error:'Antes de pagar, confirma la afiliación de tu negocio en BankyFinanzas desde la sección Cobros.' });

  const checkout = new URL(process.env.BANK_CHECKOUT_URL || 'https://bankyfinanzas.netlify.app/checkout');
  const appOrigin = new URL(publicAppUrl()).origin;
  const merchantValue = clean(merchant.bankMerchantId || process.env.BANK_MERCHANT_ID || merchant.id, 160);
  if (!merchantValue) return res.status(409).json({ error:'No se encontró el identificador de comercio de BankyFinanzas.' });

  checkout.searchParams.set('reference', sale.referenciaPago);
  checkout.searchParams.set('orderId', sale.referenciaPago);
  checkout.searchParams.set('amount', String(Number(sale.total).toFixed(2)));
  checkout.searchParams.set('currency', sale.moneda || 'CRC');
  checkout.searchParams.set('description', sale.items?.[0]?.detalle || `Venta ${sale.id}`);
  checkout.searchParams.set('origin', appOrigin);
  checkout.searchParams.set('returnUrl', `${publicAppUrl()}/?paymentReference=${encodeURIComponent(sale.referenciaPago)}`);

  // BankyFinanzas entrega un identificador de comercio. merchantId es el nombre esperado
  // por el adaptador compartido; se conserva merchant por compatibilidad con pruebas anteriores.
  checkout.searchParams.set('merchantId', merchantValue);
  checkout.searchParams.set('merchant', merchantValue);
  if (merchant.name) checkout.searchParams.set('merchantName', merchant.name);

  await pool.execute("UPDATE portal_ventas SET estado='esperando_banco', error_detalle=NULL WHERE id=?", [sale.id]);
  return res.json({
    checkoutUrl: checkout.toString(), referencia: sale.referenciaPago, monto: sale.total,
    moneda: sale.moneda, expectedOrigin: bankOrigin(), channel: 'bankyfinanzas:checkout'
  });
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
            p.nombre_comercial, p.actividad_economica, p.telefono, p.provincia, p.canton, p.distrito, p.otras_senas, p.logo, p.logo_blanco, p.logo_posicion, p.bank_merchant_id, p.bank_afiliado
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
      ubicacion:invoiceLocation({provincia:p.provincia,canton:p.canton,distrito:p.distrito,otrasSenas:p.otras_senas}),
      logoUrl:p.logo||null,logoUrlBlanco:p.logo_blanco||null,logoPosicion:p.logo_posicion||'left'
    },
    receptor:{
      nombre:saleRow.receptor_nombre,nombreComercial:extra.nombreComercial||undefined,actividadEconomica:extra.actividadEconomica||undefined,
      identificacion:saleRow.receptor_numero_id?{tipo:saleRow.receptor_tipo_id,numero:decrypt(saleRow.receptor_numero_id)}:undefined,correo:saleRow.receptor_correo,
      telefono:extra.telefono?{codigoPais:'506',numero:String(extra.telefono).replace(/\D/g,'')}:undefined,ubicacion:invoiceLocation(receptorUb||{})
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

async function fetchInvoiceJson(facturaId) {
  const response = await fetch(`${publicApiUrl()}/api/facturas/${encodeURIComponent(facturaId)}`, {
    signal:AbortSignal.timeout(15000)
  });
  const text = await response.text(); let body = text; try { body = text ? JSON.parse(text) : null; } catch {}
  if (!response.ok) throw new Error(`No se pudo recuperar la factura visual ${facturaId}.`);
  return body;
}

async function processPaidSale(saleId) {
  const [rows] = await pool.execute('SELECT * FROM portal_ventas WHERE id=? LIMIT 1', [saleId]);
  if (!rows.length) throw new Error('Venta no encontrada');
  let row = rows[0];
  if (row.estado !== 'pagada' && !row.bank_transaction_code && !row.pago_confirmado_at) throw new Error('La venta todavía no tiene un pago aprobado.');
  if (row.estado === 'entregada') return row.factura_id;

  const ecosystemEnabled = String(process.env.ECOSYSTEM_ENABLED || 'false').toLowerCase() === 'true';

  try {
    const invoiceDraft = await buildInvoiceFromSale(row, row.usuario_id);

    // El flujo externo puede activarse cuando los servicios asociados estén disponibles.
    if (ecosystemEnabled) {
      await pool.execute("UPDATE portal_ventas SET estado='validando_firma', error_detalle=NULL WHERE id=?", [saleId]);
      await validarFirmaDigital({ ventaId:saleId, emisor:invoiceDraft.emisor, venta:row });
    }

    // Generamos nuestra factura visual.
    let facturaId = row.factura_id;
    let invoiceBody = invoiceDraft;
    if (!facturaId) {
      await pool.execute("UPDATE portal_ventas SET estado='generando_factura_visual' WHERE id=?", [saleId]);
      const response = await fetch(`${publicApiUrl()}/api/facturas`, {
        method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(invoiceDraft), signal:AbortSignal.timeout(20000)
      });
      const text = await response.text(); let result = text; try { result = JSON.parse(text); } catch {}
      if (!response.ok || !result?.id) throw new Error(`No se pudo generar la factura visual: ${typeof result==='string'?result:JSON.stringify(result)}`);
      facturaId = result.id;
      await pool.execute("UPDATE portal_ventas SET factura_id=?, estado='factura_visual_generada', error_detalle=NULL WHERE id=?", [facturaId, saleId]);
      const [fresh] = await pool.execute('SELECT * FROM portal_ventas WHERE id=? LIMIT 1',[saleId]);
      row = fresh[0] || row;
    } else {
      invoiceBody = await fetchInvoiceJson(facturaId);
    }

    const pdfUrl = `${publicAppUrl()}/api/documentos/facturas/${encodeURIComponent(facturaId)}?formato=pdf&plantilla=auto`;

    if (!ecosystemEnabled) {
      // Con el flujo externo desactivado, se completa la entrega de la factura visual por correo.
      await pool.execute("UPDATE portal_ventas SET estado='preparando_entrega' WHERE id=?", [saleId]);
      await entregarFacturaVisual({
        ventaId:saleId, to:row.receptor_correo, clienteNombre:row.receptor_nombre, facturaId, pdfUrl
      });
      await pool.execute("UPDATE portal_ventas SET estado='entregada', error_detalle=NULL WHERE id=?", [saleId]);
      return facturaId;
    }

    // Flujo completo del ecosistema: Facturación Electrónica -> Tributación -> correo con 3 archivos.
    await pool.execute("UPDATE portal_ventas SET estado='procesando_electronica' WHERE id=?", [saleId]);
    const electronica = await solicitarFacturaElectronica({ ventaId:saleId, factura:invoiceBody, facturaId, pdfUrl });

    await pool.execute("UPDATE portal_ventas SET estado='procesando_tributacion' WHERE id=?", [saleId]);
    const tributacion = await enviarTributacion({
      ventaId:saleId, facturaId, emisor:invoiceBody.emisor, receptor:invoiceBody.receptor, electronica
    });

    if (parsePipeline().length) {
      await pool.execute("UPDATE portal_ventas SET estado='procesando_integraciones' WHERE id=?", [saleId]);
      await ejecutarPipeline(row, {
        facturaId, factura:invoiceBody, facturaElectronica:electronica.raw, tributacion:tributacion.raw,
        receptor:{ nombre:row.receptor_nombre, correo:row.receptor_correo }, total:Number(row.total), moneda:row.moneda
      });
    }

    await pool.execute("UPDATE portal_ventas SET estado='preparando_entrega' WHERE id=?", [saleId]);
    await entregarDocumentos({
      ventaId:saleId, to:row.receptor_correo, clienteNombre:row.receptor_nombre,
      facturaId, pdfUrl, electronica, tributacion
    });

    await pool.execute("UPDATE portal_ventas SET estado='entregada', error_detalle=NULL WHERE id=?", [saleId]);
    return facturaId;
  } catch (error) {
    console.error('[portal] No se pudo completar la entrega de la venta', saleId, error);
    let publicMessage = 'No fue posible completar la entrega de la factura. Puedes reintentar el procesamiento.';
    if (error?.code === 'EMAIL_ACTIVATION_REQUIRED') {
      publicMessage = 'El correo de entrega requiere una confirmación inicial. Revisa la bandeja de entrada y vuelve a intentarlo.';
    } else if (error?.code === 'EMAIL_NOT_CONFIGURED') {
      publicMessage = 'El servicio de entrega por correo aún no está disponible.';
    }
    await pool.execute("UPDATE portal_ventas SET estado='procesamiento_fallido', error_detalle=? WHERE id=?", [publicMessage, saleId]);
    const wrapped = new Error(publicMessage);
    wrapped.code = error?.code || 'DELIVERY_FAILED';
    throw wrapped;
  }
}

async function confirmPayment(req, res) {
  const [rows] = await pool.execute('SELECT * FROM portal_ventas WHERE id=? AND usuario_id=? LIMIT 1', [req.params.id, req.portalUser.usuario_id]);
  if (!rows.length) return res.status(404).json({ error:'Venta no encontrada' });
  const row = rows[0];
  if (row.factura_id) return res.json(await getSaleObject(row.id, row.usuario_id));

  const mode = String(process.env.BANK_CONFIRM_MODE || 'postmessage').toLowerCase();
  let verified = null;
  try { verified = await verifyBankIfConfigured(await getSaleObject(row.id,row.usuario_id), req.body?.payload || req.body); }
  catch (e) { return res.status(409).json({ error:e.message }); }

  if (!verified) {
    if (mode !== 'postmessage') return res.status(409).json({ error:'Falta configurar BANK_VERIFY_URL o un callback del banco para validar el pago.' });
    if (String(req.body?.sourceOrigin || '') !== bankOrigin()) return res.status(403).json({ error:'El resultado no proviene del origen de BankyFinanzas configurado.' });

    const payload = req.body?.payload || {};
    const status = String(payload.status || '').toLowerCase();
    if (status !== 'completed') return res.status(409).json({ error:'BankyFinanzas no reportó el pago como completado.' });

    const paidAmount = Number(payload.amount);
    if (!Number.isFinite(paidAmount) || Math.abs(paidAmount - Number(row.total)) > 0.01) {
      return res.status(409).json({ error:'El monto confirmado por BankyFinanzas no coincide con el total de la venta.' });
    }
    if (String(payload.currency || '').toUpperCase() !== String(row.moneda || '').toUpperCase()) {
      return res.status(409).json({ error:'La moneda confirmada por BankyFinanzas no coincide con la venta.' });
    }
    if (!clean(payload.transactionCode,100)) return res.status(409).json({ error:'BankyFinanzas no devolvió el código de transacción.' });
    verified = payload;
  }

  const transactionCode = clean(verified.transactionCode,100);
  const paymentId = clean(verified.paymentId,100);
  const intentId = clean(verified.intentId,100);
  if (transactionCode) {
    const [dups] = await pool.execute('SELECT id FROM portal_ventas WHERE bank_transaction_code=? AND id<>? LIMIT 1',[transactionCode,row.id]);
    if (dups.length) return res.status(409).json({ error:'Ese código de transacción ya fue utilizado por otra venta.' });
  }
  if (paymentId) {
    const [dups] = await pool.execute('SELECT id FROM portal_ventas WHERE bank_payment_id=? AND id<>? LIMIT 1',[paymentId,row.id]);
    if (dups.length) return res.status(409).json({ error:'Ese pago ya fue utilizado por otra venta.' });
  }

  await pool.execute(
    `UPDATE portal_ventas SET estado='pagada', pago_payload=?, bank_intent_id=?, bank_payment_id=?, bank_transaction_code=?, pago_confirmado_at=NOW(), error_detalle=NULL WHERE id=?`,
    [JSON.stringify(verified), intentId || null, paymentId || null, transactionCode || null, row.id]
  );
  try { await processPaidSale(row.id); }
  catch (error) { return res.status(502).json({ error:'El pago fue aprobado y quedó registrado, pero el procesamiento documental no pudo terminar.', detalle:error.message, venta:await getSaleObject(row.id,row.usuario_id) }); }
  return res.json(await getSaleObject(row.id,row.usuario_id));
}

async function recordPaymentResult(req, res) {
  const [rows] = await pool.execute('SELECT * FROM portal_ventas WHERE id=? AND usuario_id=? LIMIT 1', [req.params.id, req.portalUser.usuario_id]);
  if (!rows.length) return res.status(404).json({ error:'Venta no encontrada' });
  const row = rows[0];
  if (row.factura_id) return res.json(await getSaleObject(row.id,row.usuario_id));
  if (String(req.body?.sourceOrigin || '') !== bankOrigin()) return res.status(403).json({ error:'El resultado no proviene del origen de BankyFinanzas configurado.' });
  const payload=req.body?.payload||{};
  const status=String(payload.status||'').toLowerCase();
  if (!['rejected','cancelled'].includes(status)) return res.status(400).json({ error:'Resultado bancario no válido para esta operación.' });
  await pool.execute("UPDATE portal_ventas SET estado='pendiente_pago', pago_payload=?, error_detalle=NULL WHERE id=?",[JSON.stringify(payload),row.id]);
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
  if (!sale?.pago?.transactionCode && !sale?.pago?.confirmadoAt && !['pagada','procesamiento_fallido','validando_firma','generando_factura_visual','factura_visual_generada','procesando_electronica','procesando_tributacion','procesando_integraciones','preparando_entrega'].includes(sale.estado)) return res.status(409).json({ error:'La venta todavía no tiene un pago aprobado.' });
  try { await processPaidSale(sale.id); return res.json(await getSaleObject(sale.id, req.portalUser.usuario_id)); }
  catch (error) { return res.status(502).json({ error:error.message, venta:await getSaleObject(sale.id,req.portalUser.usuario_id) }); }
}

async function config(req, res) {
  return res.json({
    serviceName:'Factura Bonita',
    bank:{ checkoutUrl:process.env.BANK_CHECKOUT_URL || 'https://bankyfinanzas.netlify.app/checkout', loginUrl:process.env.BANK_LOGIN_URL || 'https://bankyfinanzas.netlify.app/login', registerUrl:process.env.BANK_REGISTER_URL || 'https://bankyfinanzas.netlify.app/registro/negocio', origin:bankOrigin(), verificationConfigured:Boolean(process.env.BANK_VERIFY_URL), confirmMode:process.env.BANK_CONFIRM_MODE || 'postmessage', ready:false },
    invoice:{ logoPositions:['left','center','right'] },
    ecosystem:{
      enabled:String(process.env.ECOSYSTEM_ENABLED || 'false').toLowerCase() === 'true',
      digitalSignatureConfigured:Boolean(process.env.DIGITAL_SIGNATURE_VALIDATE_URL),
      electronicInvoiceConfigured:Boolean(process.env.ELECTRONIC_INVOICE_URL),
      taxationConfigured:Boolean(process.env.TAXATION_URL),
      emailConfigured:emailConfigured(),
      emailTestMode:emailTestMode(),
      emailBrowserFormAction:browserFormActionMode(),
      ready:String(process.env.ECOSYSTEM_ENABLED || 'false').toLowerCase() !== 'true'
        ? emailConfigured()
        : Boolean(process.env.DIGITAL_SIGNATURE_VALIDATE_URL && process.env.ELECTRONIC_INVOICE_URL && process.env.TAXATION_URL && emailConfigured())
    }
  });
}

module.exports = { register, login, me, saveProfile, saveBankProfile, listClients, createSale, updateSale, listSales, saleById, startPayment, confirmPayment, recordPaymentResult, bankCallback, retryPipeline, config };
