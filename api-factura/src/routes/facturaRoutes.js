const express = require('express');
const router = express.Router();
const {
  crearFactura,
  consultarFactura,
  listarFacturas,
  actualizarLogoFactura,
} = require('../controllers/facturaController');
const { normalizarFacturaEntrada, validateFacturaMiddleware } = require('../middleware/validaFactura');

router.get('/', listarFacturas);
router.post('/', normalizarFacturaEntrada, validateFacturaMiddleware, crearFactura);
router.patch('/:id/logo', actualizarLogoFactura);
router.get('/:id', consultarFactura);

module.exports = router;
