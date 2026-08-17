const express = require('express');
const { createDocumentController } = require('./documentController');

function createDocumentRoutes(dependencies) {
  const router = express.Router();
  router.get('/facturas/:id', createDocumentController(dependencies));
  return router;
}

module.exports = { createDocumentRoutes };
