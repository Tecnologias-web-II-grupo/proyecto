const express = require('express');
require('dotenv').config();

const facturaRoutes = require('./routes/facturaRoutes');

const app = express();
app.use(express.json());

app.get('/health', (req, res) => res.json({ status: 'ok' }));
app.use('/api/facturas', facturaRoutes);

app.use((err, req, res, next) => {
  console.error('[error]', err.message);
  res.status(400).json({ error: 'Solicitud inválida', detalle: err.message });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`API de Facturación al Cliente corriendo en http://localhost:${PORT}`);
});