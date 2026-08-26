const { randomBytes, createHash } = require('crypto');
const pool = require('../db/database');
const { encrypt, decrypt } = require('../middleware/crypto');
const { ensurePortalSchema } = require('./schema');

function hashApiKey(value) {
  return createHash('sha256').update(String(value || '').trim()).digest('hex');
}

function createApiKey() {
  return `fb_live_${randomBytes(24).toString('hex')}`;
}

async function ensureUserApiKey(userId) {
  await ensurePortalSchema();
  const [rows] = await pool.execute('SELECT api_key, api_key_hash FROM portal_usuarios WHERE id=? LIMIT 1', [userId]);
  if (!rows.length) return null;
  if (rows[0].api_key && rows[0].api_key_hash) {
    return decrypt(rows[0].api_key);
  }
  const apiKey = createApiKey();
  await pool.execute(
    'UPDATE portal_usuarios SET api_key=?, api_key_hash=?, updated_at=CURRENT_TIMESTAMP WHERE id=?',
    [encrypt(apiKey), hashApiKey(apiKey), userId]
  );
  return apiKey;
}

async function rotateUserApiKey(userId) {
  await ensurePortalSchema();
  const apiKey = createApiKey();
  await pool.execute(
    'UPDATE portal_usuarios SET api_key=?, api_key_hash=?, updated_at=CURRENT_TIMESTAMP WHERE id=?',
    [encrypt(apiKey), hashApiKey(apiKey), userId]
  );
  return apiKey;
}

async function accountByApiKey(apiKey) {
  const clean = String(apiKey || '').trim();
  if (!clean) return null;
  await ensurePortalSchema();
  const [rows] = await pool.execute(
    `SELECT u.id, u.nombre, u.email, u.empresa, u.tipo_identificacion, u.numero_identificacion, u.correo_facturacion,
            p.nombre_comercial, p.actividad_economica, p.telefono, p.provincia, p.canton, p.distrito, p.otras_senas,
            p.logo, p.logo_blanco, p.logo_posicion
     FROM portal_usuarios u
     LEFT JOIN portal_perfiles p ON p.usuario_id=u.id
     WHERE u.api_key_hash=? AND u.activo=TRUE LIMIT 1`,
    [hashApiKey(clean)]
  );
  return rows[0] || null;
}

module.exports = { ensureUserApiKey, rotateUserApiKey, accountByApiKey };
