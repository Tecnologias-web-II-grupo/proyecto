const multer = require('multer');

const MAX_LOGO_BYTES = 500 * 1024;
const MIME_PERMITIDOS = new Set(['image/png', 'image/jpeg', 'image/webp']);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_LOGO_BYTES, files: 2 },
  fileFilter: (req, file, cb) => {
    if (!MIME_PERMITIDOS.has(String(file.mimetype || '').toLowerCase())) {
      const err = new Error('Los logos deben ser PNG, JPG/JPEG o WEBP.');
      err.status = 400;
      return cb(err);
    }
    return cb(null, true);
  },
});

function detectarMime(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) return null;
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) return 'image/png';
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
  if (buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP') return 'image/webp';
  return null;
}

function archivoADataUrl(file) {
  if (!file?.buffer?.length) return null;
  const mimeReal = detectarMime(file.buffer);
  if (!mimeReal) {
    const err = new Error('El archivo seleccionado no contiene una imagen PNG, JPG/JPEG o WEBP válida.');
    err.status = 400;
    throw err;
  }
  return `data:${mimeReal};base64,${file.buffer.toString('base64')}`;
}

function archivos(req) {
  const f = req.files || {};
  return {
    principal: Array.isArray(f.logo) ? f.logo[0] : null,
    blanco: Array.isArray(f.logoBlanco) ? f.logoBlanco[0] : null,
  };
}

function prepararLogoArchivo(req, res, next) {
  try {
    const { principal, blanco } = archivos(req);
    req.body = req.body || {};
    if (principal) req.body.logoUrl = archivoADataUrl(principal);
    if (blanco) req.body.logoUrlBlanco = archivoADataUrl(blanco);
    next();
  } catch (err) { next(err); }
}

function prepararFacturaMultipart(req, res, next) {
  try {
    if (!req.is('multipart/form-data')) return next();

    let factura = {};
    const raw = req.body?.factura ?? req.body?.json ?? req.body?.data;
    if (raw) {
      try { factura = typeof raw === 'string' ? JSON.parse(raw) : raw; }
      catch {
        const err = new Error('El campo form-data "factura" debe contener JSON válido.');
        err.status = 400;
        throw err;
      }
    } else {
      factura = { ...req.body };
    }

    const { principal, blanco } = archivos(req);
    if (principal || blanco) {
      factura.emisor = factura.emisor && typeof factura.emisor === 'object' ? factura.emisor : {};
      if (principal) factura.emisor.logoUrl = archivoADataUrl(principal);
      if (blanco) factura.emisor.logoUrlBlanco = archivoADataUrl(blanco);
    }

    req.body = factura;
    next();
  } catch (err) { next(err); }
}

function manejarErrorMulter(err, req, res, next) {
  if (!err) return next();
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'Logo inválido', detalle: 'Cada variante del logo admite máximo 500 KB.' });
    }
    return res.status(400).json({ error: 'Logo inválido', detalle: err.message });
  }
  return next(err);
}

module.exports = {
  uploadLogo: upload.fields([{ name: 'logo', maxCount: 1 }, { name: 'logoBlanco', maxCount: 1 }]),
  prepararLogoArchivo,
  prepararFacturaMultipart,
  manejarErrorMulter,
};
