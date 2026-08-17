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
    type(value) { this.headers['Content-Type'] = value === 'html' ? 'text/html; charset=utf-8' : value; return this; },
    set(values) { Object.assign(this.headers, values); return this; },
    send(body) { this.body = body; return this; },
    json(body) { this.body = body; return this; },
  };
}

test('renderiza datos UTF-8 en la plantilla sin ejecutar HTML de los datos', async () => {
  const html = await renderizarHtml(factura);
  assert.match(html, /Tecnología José Muñoz/);
  assert.match(html, /María Peña/);
  assert.match(html, /Artículo electrónico para niño – edición especial/);
  assert.match(html, /₡11(?:&nbsp;|\s)300,00/);
  assert.doesNotMatch(html, /<script>alert\(1\)<\/script>/);
  assert.doesNotMatch(html, /Ãƒ|Ã‚|ï¿½/);
});

test('devuelve HTML con el Content-Type requerido', async () => {
  const controller = createDocumentController({
    apiClient: { obtenerPorId: async () => factura },
    htmlRenderer: renderizarHtml,
  });
  const response = createResponse();
  await controller({ params: { id: factura.id }, query: { formato: 'html' } }, response);
  assert.equal(response.statusCode, 200);
  assert.equal(response.headers['Content-Type'], 'text/html; charset=utf-8');
  assert.match(response.body, /María Peña/);
});

test('devuelve un PDF en memoria con el Content-Type requerido', async () => {
  const pdf = Buffer.from('%PDF-1.7\ncontenido');
  const controller = createDocumentController({
    apiClient: { obtenerPorId: async () => factura },
    htmlRenderer: renderizarHtml,
    pdfRenderer: async () => pdf,
  });
  const response = createResponse();
  await controller({ params: { id: factura.id }, query: { formato: 'pdf' } }, response);
  assert.equal(response.statusCode, 200);
  assert.equal(response.headers['Content-Type'], 'application/pdf');
  assert.deepEqual(response.body, pdf);
});

test('rechaza identificadores y formatos inválidos', async () => {
  const controller = createDocumentController({ apiClient: { obtenerPorId: async () => factura } });
  const invalidId = createResponse();
  await controller({ params: { id: '../factura' }, query: {} }, invalidId);
  assert.equal(invalidId.statusCode, 400);
  assert.equal(invalidId.body.codigo, 'ID_INVALIDO');

  const invalidFormat = createResponse();
  await controller({ params: { id: 'F-0001' }, query: { formato: 'xml' } }, invalidFormat);
  assert.equal(invalidFormat.statusCode, 400);
  assert.equal(invalidFormat.body.codigo, 'FORMATO_INVALIDO');
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

test('controla API no disponible y timeout', async () => {
  const unavailable = createFacturaApiClient({
    baseUrl: 'http://api.test', timeoutMs: 100,
    fetchImpl: async () => { throw new Error('ECONNREFUSED'); },
  });
  await assert.rejects(() => unavailable.obtenerPorId('F-1'), { code: 'API_NO_DISPONIBLE' });

  const timeout = createFacturaApiClient({
    baseUrl: 'http://api.test', timeoutMs: 5,
    fetchImpl: (_url, { signal }) => new Promise((_resolve, reject) => {
      signal.addEventListener('abort', () => reject(Object.assign(new Error('abort'), { name: 'AbortError' })));
    }),
  });
  await assert.rejects(() => timeout.obtenerPorId('F-1'), { code: 'API_TIMEOUT' });
});

test('procesa solicitudes consecutivas sin compartir el documento', async () => {
  const results = await Promise.all([
    renderizarHtml(factura),
    renderizarHtml({ ...factura, id: 'F-OTRA', receptor: { ...factura.receptor, nombre: 'Ana Núñez' } }),
  ]);
  assert.match(results[0], /F-UTF8/);
  assert.doesNotMatch(results[0], /Ana Núñez/);
  assert.match(results[1], /F-OTRA/);
});
