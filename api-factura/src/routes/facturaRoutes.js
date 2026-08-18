const express = require('express');
const router = express.Router();
const { crearFactura, consultarFactura, actualizarLogoFactura } = require('../controllers/facturaController');
const { validateFacturaMiddleware } = require('../middleware/validaFactura');

router.post('/', validateFacturaMiddleware, crearFactura);
router.patch('/:id/logo', actualizarLogoFactura);
router.get('/:id', consultarFactura);

module.exports = router;