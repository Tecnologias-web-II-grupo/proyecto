const express = require('express');
const path = require('path');
require('dotenv').config();

const facturaRoutes = require('./routes/facturaRoutes');
const { createDocumentRoutes } = require('../document-renderer/routes');

const app = express();
app.use(express.json());

// Servir archivos estáticos de la plantilla de factura
app.use(express.static(path.join(__dirname, 'factura-plantilla')));

// Servir el JSON de factura de ejemplo a través de la API
app.get('/api/factura-ejemplo', (req, res) => {
  res.sendFile(path.join(__dirname, '../factura-ejemplo.json'));
});

app.get('/health', (req, res) => res.json({ status: 'ok' }));
app.use('/api/facturas', facturaRoutes);
app.use('/api/documentos', createDocumentRoutes());

app.use((err, req, res, next) => {
  console.error('[error]', err.message);
  res.status(400).json({ error: 'Solicitud inválida', detalle: err.message });
});

const PORT = process.env.PORT || 3000;
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`API de Facturación al Cliente corriendo en http://localhost:${PORT}`);
  });
}

module.exports = app;
