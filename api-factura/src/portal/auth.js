const pool = require('../db/database');
const { hashToken } = require('./security');

async function requirePortalAuth(req, res, next) {
  try {
    const header = String(req.headers.authorization || '');
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
    if (!token) return res.status(401).json({ error: 'Sesión requerida' });

    const tokenHash = hashToken(token);
    const [rows] = await pool.execute(
      `SELECT s.usuario_id, u.nombre, u.email, u.empresa, u.correo_facturacion
       FROM portal_sesiones s
       JOIN portal_usuarios u ON u.id = s.usuario_id
       WHERE s.token_hash = ? AND s.expires_at > NOW() AND u.activo = TRUE
       LIMIT 1`,
      [tokenHash]
    );
    if (!rows.length) return res.status(401).json({ error: 'Sesión inválida o expirada' });
    req.portalUser = rows[0];
    next();
  } catch (error) {
    next(error);
  }
}

module.exports = { requirePortalAuth };
