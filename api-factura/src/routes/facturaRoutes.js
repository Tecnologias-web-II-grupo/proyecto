const express = require('express');
const router = express.Router();
const {
  crearFactura,
  consultarFactura,
  listarFacturas,
  actualizarLogoFactura,
} = require('../controllers/facturaController');
const { normalizarFacturaEntrada, validateFacturaMiddleware } = require('../middleware/validaFactura');
const {
  uploadLogo,
  prepararLogoArchivo,
  prepararFacturaMultipart,
  manejarErrorMulter,
} = require('../middleware/logoUpload');

router.get('/', listarFacturas);

// JSON tradicional o multipart/form-data. En multipart:
// - "factura": texto con el JSON completo
// - "logo": archivo PNG/JPG/WEBP (opcional, máximo 500 KB)
router.post('/', uploadLogo, manejarErrorMulter, prepararFacturaMultipart, normalizarFacturaEntrada, validateFacturaMiddleware, crearFactura);

// Permite dos formas:
// 1) Body JSON { "logoUrl": "data:image/...;base64,..." }
// 2) Body form-data, key "logo" de tipo File.
router.patch('/:id/logo', uploadLogo, manejarErrorMulter, prepararLogoArchivo, actualizarLogoFactura);
router.get('/:id', consultarFactura);

module.exports = router;
