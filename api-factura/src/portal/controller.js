const { randomUUID } = require('crypto');
const pool = require('../db/database');
const { encrypt, decrypt } = require('../middleware/crypto');
const { hashPassword, verifyPassword, newSessionToken, hashToken } = require('./security');
const { ensurePortalSchema } = require('./schema');
const { ensureUserApiKey, rotateUserApiKey } = require('./apiKey');

function clean(value, max = 255) {
  return String(value ?? '').trim().slice(0, max);
}

function dataUrlFromFile(file) {
  if (!file?.buffer?.length) return null;
  return `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
}

function publicAppUrl() {
  return process.env.PUBLIC_APP_URL || process.env.RENDER_EXTERNAL_URL || `http://localhost:${process.env.PORT || 3000}`;
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

  if (!nombre || !email || !empresa || !numero || !password) {
    return res.status(400).json({ error: 'Completa nombre, correo, empresa, identificación y contraseña.' });
  }
  if (password.length < 8) return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres.' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Correo inválido.' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correoFacturacion)) return res.status(400).json({ error: 'Correo de facturación inválido.' });
  if (!/^\d{8,12}$/.test(numero)) return res.status(400).json({ error: 'La identificación debe contener entre 8 y 12 dígitos.' });
  if (req.body.actividadEconomica && !/^\d{6}$/.test(String(req.body.actividadEconomica))) {
    return res.status(400).json({ error: 'La actividad económica debe tener 6 dígitos.' });
  }

  const passwordHash = await hashPassword(password);
  const id = randomUUID();

  try {
    await pool.execute(
      `INSERT INTO portal_usuarios
        (id, nombre, email, password_hash, empresa, tipo_identificacion, numero_identificacion, correo_facturacion)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, nombre, email, passwordHash, empresa, tipo, encrypt(numero), correoFacturacion]
    );
    await pool.execute(
      `INSERT INTO portal_perfiles
        (usuario_id, nombre_comercial, actividad_economica, telefono, provincia, canton, distrito, otras_senas)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        empresa,
        clean(req.body.actividadEconomica, 6),
        clean(req.body.telefono, 30),
        clean(req.body.provincia, 80),
        clean(req.body.canton, 80),
        clean(req.body.distrito, 80),
        clean(req.body.otrasSenas, 255),
      ]
    );
    const apiKey = await ensureUserApiKey(id);
    return res.status(201).json({ id, nombre, email, empresa, integration: { apiKey } });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Ya existe una cuenta con ese correo.' });
    throw error;
  }
}

async function login(req, res) {
  await ensurePortalSchema();
  const email = clean(req.body.email, 160).toLowerCase();
  const [rows] = await pool.execute(
    'SELECT * FROM portal_usuarios WHERE email = ? AND activo = TRUE LIMIT 1',
    [email]
  );
  const user = rows[0];
  if (!user || !(await verifyPassword(req.body.password, user.password_hash))) {
    return res.status(401).json({ error: 'Correo o contraseña incorrectos.' });
  }

  await ensureUserApiKey(user.id);
  const token = newSessionToken();
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await pool.execute(
    'INSERT INTO portal_sesiones (usuario_id, token_hash, expires_at) VALUES (?, ?, ?)',
    [user.id, hashToken(token), expires]
  );

  return res.json({
    token,
    expiresAt: expires.toISOString(),
    user: { id: user.id, nombre: user.nombre, email: user.email, empresa: user.empresa }
  });
}

async function me(req, res) {
  await ensurePortalSchema();
  res.set('Cache-Control', 'no-store, private, max-age=0');
  res.set('Pragma', 'no-cache');
  const [rows] = await pool.execute(
    `SELECT u.id, u.nombre, u.email, u.empresa, u.tipo_identificacion, u.numero_identificacion, u.correo_facturacion, u.created_at,
            p.nombre_comercial, p.actividad_economica, p.telefono, p.provincia, p.canton, p.distrito, p.otras_senas,
            p.logo, p.logo_blanco, p.logo_posicion
       FROM portal_usuarios u
       LEFT JOIN portal_perfiles p ON p.usuario_id = u.id
      WHERE u.id = ? LIMIT 1`,
    [req.portalUser.usuario_id]
  );

  if (!rows.length) return res.status(404).json({ error: 'Cuenta no encontrada.' });
  const u = rows[0];
  const apiKey = await ensureUserApiKey(u.id);

  return res.json({
    id: u.id,
    nombre: u.nombre,
    email: u.email,
    empresa: u.empresa,
    tipoIdentificacion: u.tipo_identificacion,
    numeroIdentificacion: decrypt(u.numero_identificacion),
    correoFacturacion: u.correo_facturacion,
    createdAt: u.created_at,
    perfil: {
      nombreComercial: u.nombre_comercial || '',
      actividadEconomica: u.actividad_economica || '',
      telefono: u.telefono || '',
      ubicacion: {
        provincia: u.provincia || '',
        canton: u.canton || '',
        distrito: u.distrito || '',
        otrasSenas: u.otras_senas || ''
      },
      logoUrl: u.logo || null,
      logoUrlBlanco: u.logo_blanco || null,
      logoPosicion: u.logo_posicion || 'left'
    },
    integration: {
      apiKey,
      apiBaseUrl: publicAppUrl(),
      createInvoicePath: '/api/facturas'
    }
  });
}

async function changePassword(req, res) {
  await ensurePortalSchema();
  const currentPassword = String(req.body.currentPassword || '');
  const newPassword = String(req.body.newPassword || '');

  if (newPassword.length < 8) {
    return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 8 caracteres.' });
  }
  if (currentPassword === newPassword) {
    return res.status(400).json({ error: 'La nueva contraseña debe ser diferente de la actual.' });
  }

  const [rows] = await pool.execute(
    'SELECT password_hash FROM portal_usuarios WHERE id = ? AND activo = TRUE LIMIT 1',
    [req.portalUser.usuario_id]
  );
  if (!rows.length || !(await verifyPassword(currentPassword, rows[0].password_hash))) {
    return res.status(401).json({ error: 'La contraseña actual no es correcta.' });
  }

  const passwordHash = await hashPassword(newPassword);
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.execute(
      'UPDATE portal_usuarios SET password_hash = ? WHERE id = ?',
      [passwordHash, req.portalUser.usuario_id]
    );
    // Cerrar todas las sesiones evita que un dispositivo que quedó abierto
    // conserve acceso después de un cambio de credenciales.
    await connection.execute('DELETE FROM portal_sesiones WHERE usuario_id = ?', [req.portalUser.usuario_id]);
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  return res.json({ message: 'Contraseña actualizada. Inicia sesión nuevamente.' });
}

async function deleteAccount(req, res) {
  await ensurePortalSchema();
  const password = String(req.body.password || '');
  const confirmation = clean(req.body.confirmation, 20).toUpperCase();
  if (confirmation !== 'ELIMINAR') {
    return res.status(400).json({ error: 'Escribe ELIMINAR para confirmar.' });
  }

  const [rows] = await pool.execute(
    'SELECT password_hash FROM portal_usuarios WHERE id = ? AND activo = TRUE LIMIT 1',
    [req.portalUser.usuario_id]
  );
  if (!rows.length || !(await verifyPassword(password, rows[0].password_hash))) {
    return res.status(401).json({ error: 'La contraseña no es correcta.' });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    // Las sesiones y el perfil también tienen borrado en cascada, pero se
    // eliminan de forma explícita para que la intención del flujo sea clara.
    await connection.execute('DELETE FROM portal_sesiones WHERE usuario_id = ?', [req.portalUser.usuario_id]);
    await connection.execute('DELETE FROM portal_perfiles WHERE usuario_id = ?', [req.portalUser.usuario_id]);
    await connection.execute('DELETE FROM portal_usuarios WHERE id = ?', [req.portalUser.usuario_id]);
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  // Los comprobantes emitidos se conservan como documentos históricos; la
  // cuenta, sus credenciales, perfil, logos y sesiones sí quedan eliminados.
  return res.json({ message: 'Cuenta eliminada correctamente.' });
}

async function saveProfile(req, res) {
  await ensurePortalSchema();
  const position = ['left','center','right'].includes(req.body.logoPosicion)
    ? req.body.logoPosicion
    : 'left';
  const logo = req.files?.logo?.[0] ? dataUrlFromFile(req.files.logo[0]) : null;
  const logoBlanco = req.files?.logoBlanco?.[0] ? dataUrlFromFile(req.files.logoBlanco[0]) : null;

  const [current] = await pool.execute(
    'SELECT logo, logo_blanco FROM portal_perfiles WHERE usuario_id = ?',
    [req.portalUser.usuario_id]
  );
  const existing = current[0] || {};
  const effectiveLogo = logo || existing.logo || null;
  const effectiveWhiteLogo = logoBlanco || existing.logo_blanco || null;

  await pool.execute(
    `INSERT INTO portal_perfiles (usuario_id, logo, logo_blanco, logo_posicion)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       logo=VALUES(logo),
       logo_blanco=VALUES(logo_blanco),
       logo_posicion=VALUES(logo_posicion),
       updated_at=CURRENT_TIMESTAMP`,
    [req.portalUser.usuario_id, effectiveLogo, effectiveWhiteLogo, position]
  );

  await pool.execute(
    `UPDATE facturas
        SET emisor_logo = ?, emisor_logo_blanco = ?, emisor_logo_posicion = ?
      WHERE portal_usuario_id = ?`,
    [effectiveLogo, effectiveWhiteLogo, position, req.portalUser.usuario_id]
  );

  // Verifica contra la BD antes de responder. Esto evita que el portal
  // muestre una vista previa transitoria que no corresponda al perfil persistido.
  const [saved] = await pool.execute(
    'SELECT logo, logo_blanco, logo_posicion FROM portal_perfiles WHERE usuario_id = ? LIMIT 1',
    [req.portalUser.usuario_id]
  );
  if (!saved.length || saved[0].logo !== effectiveLogo || saved[0].logo_blanco !== effectiveWhiteLogo) {
    return res.status(500).json({ error: 'No se pudo confirmar el logo guardado. Intenta nuevamente.' });
  }

  return me(req, res);
}

async function listMyInvoices(req, res) {
  await ensurePortalSchema();
  res.set('Cache-Control', 'no-store, private, max-age=0');
  const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 100, 1), 200);
  const [rows] = await pool.query(
    `SELECT id, fecha_emision, moneda, receptor_nombre, total_comprobante, total_descuentos,
            referencia_externa, origen, created_at
       FROM facturas
      WHERE portal_usuario_id = ?
      ORDER BY created_at DESC
      LIMIT ?`,
    [req.portalUser.usuario_id, limit]
  );

  return res.json({
    items: rows.map((row) => ({
      id: row.id,
      fecha: row.fecha_emision,
      createdAt: row.created_at,
      moneda: row.moneda,
      receptorNombre: row.receptor_nombre,
      total: Number(row.total_comprobante || 0),
      descuento: Number(row.total_descuentos || 0),
      referenciaExterna: row.referencia_externa || null,
      origen: row.origen || null,
      pdfUrl: `/api/documentos/facturas/${encodeURIComponent(row.id)}?formato=pdf&plantilla=auto`
    }))
  });
}

async function rotateApiKey(req, res) {
  const apiKey = await rotateUserApiKey(req.portalUser.usuario_id);
  return res.json({ apiKey });
}

async function config(req, res) {
  return res.json({
    serviceName: 'Factura Bonita',
    purpose: 'factura_visual_pdf',
    invoice: {
      logoPositions: ['left','center','right'],
      createEndpoint: '/api/facturas',
      documentsEndpoint: '/api/documentos/facturas/:id?formato=pdf'
    },
    integration: {
      apiKeyHeader: 'X-Api-Key',
      contract: '/api/contrato',
      docs: '/docs'
    }
  });
}

module.exports = {
  register,
  login,
  me,
  saveProfile,
  changePassword,
  deleteAccount,
  listMyInvoices,
  rotateApiKey,
  config
};
