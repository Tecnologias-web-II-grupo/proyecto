const express = require('express');
const router = express.Router();
const { crearFactura, consultarFactura } = require('../controllers/facturaController');
const { validateFacturaMiddleware } = require('../middleware/validaFactura');

router.post('/', validateFacturaMiddleware, crearFactura);
router.get('/:id', consultarFactura);

module.exports = router;