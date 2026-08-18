const test = require('node:test');
const assert = require('node:assert/strict');
const { renderizarHtml } = require('../document-renderer/htmlRenderer');
const { createFacturaApiClient } = require('../document-renderer/facturaApiClient');
const { createDocumentController } = require('../document-renderer/documentController');

const factura = {
  id: 'F-UTF8',
  fecha: '2026-08-07T10:30:00-06:00',
  moneda: 'CRC',
  condicionVenta: 'Contado',
  medioPago: 'Tarjeta',
  emisor: {
    nombre: 'Tecnología José Muñoz',
    identificacion: { tipo: '01', numero: '1-0000-0000' },
    correo: 'jose@example.com',
  },
  receptor: {
    nombre: 'María Peña',
    identificacion: { tipo: '01', numero: '2-0000-0000' },
    correo: 'maria@example.com',
  },
  items: [{
    numeroLinea: 1,
    detalle: 'Artículo electrónico para niño – edición especial <script>alert(1)</script>',
    cantidad: 1,
    precioUnitario: 10000,
    descuento: 0,
    impuesto: { tarifa: 13 },
    subtotal: 10000,
    montoTotalLinea: 11300,
  }],
  totales: {
    totalGravado: 10000,
    totalExento: 0,
    totalDescuentos: 0,
    totalImpuesto: 1300,
    totalComprobante: 11300,
  },
};

function createResponse() {
  return {
    statusCode: 200,
    headers: {},
    status(code) { this.statusCode = code; return this; },
    set(values) { Object.assign(this.headers, values); return this; },
    send(body) { this.body = body; return this; },
    json(body) { this.body = body; return this; },
  };
}

test('React renderiza la factura con datos UTF-8 y escapa HTML de entrada', async () => {
  const html = await renderizarHtml(factura);
  assert.match(html, /Tecnología José Muñoz/);
  assert.match(html, /María Peña/);
  assert.match(html, /Artículo electrónico para niño – edición especial/);
  assert.match(html, /FACTURA/);
  assert.doesNotMatch(html, /FACTURA ELECTRÓNICA/);
  assert.doesNotMatch(html, /<script>alert\(1\)<\/script>/);
});

test('el endpoint documental entrega PDF por defecto', async () => {
  const pdf = Buffer.from('%PDF-1.7\ncontenido');
  const controller = createDocumentController({
    apiClient: { obtenerPorId: async () => factura },
    htmlRenderer: renderizarHtml,
    pdfRenderer: async () => pdf,
  });
  const response = createResponse();
  await controller({ params: { id: factura.id }, query: {} }, response);
  assert.equal(response.statusCode, 200);
  assert.equal(response.headers['Content-Type'], 'application/pdf');
  assert.deepEqual(response.body, pdf);
});

test('rechaza formatos distintos de PDF', async () => {
  const controller = createDocumentController({ apiClient: { obtenerPorId: async () => factura } });
  const response = createResponse();
  await controller({ params: { id: factura.id }, query: { formato: 'html' } }, response);
  assert.equal(response.statusCode, 400);
  assert.equal(response.body.codigo, 'FORMATO_INVALIDO');
});

test('rechaza identificadores inválidos', async () => {
  const controller = createDocumentController({ apiClient: { obtenerPorId: async () => factura } });
  const response = createResponse();
  await controller({ params: { id: '../factura' }, query: {} }, response);
  assert.equal(response.statusCode, 400);
  assert.equal(response.body.codigo, 'ID_INVALIDO');
});

test('propaga factura inexistente y controla respuestas inesperadas', async () => {
  const notFoundClient = createFacturaApiClient({
    baseUrl: 'http://api.test', timeoutMs: 100,
    fetchImpl: async () => ({ status: 404, ok: false }),
  });
  await assert.rejects(() => notFoundClient.obtenerPorId('F-404'), { code: 'FACTURA_NO_ENCONTRADA' });

  const invalidClient = createFacturaApiClient({
    baseUrl: 'http://api.test', timeoutMs: 100,
    fetchImpl: async () => ({ status: 200, ok: true, text: async () => 'no-json' }),
  });
  await assert.rejects(() => invalidClient.obtenerPorId('F-1'), { code: 'RESPUESTA_INVALIDA' });
});

test('procesa facturas consecutivas sin mezclar sus datos', async () => {
  const results = await Promise.all([
    renderizarHtml(factura),
    renderizarHtml({ ...factura, id: 'F-OTRA', receptor: { ...factura.receptor, nombre: 'Ana Núñez' } }),
  ]);
  assert.match(results[0], /F-UTF8/);
  assert.doesNotMatch(results[0], /Ana Núñez/);
  assert.match(results[1], /F-OTRA/);
});
