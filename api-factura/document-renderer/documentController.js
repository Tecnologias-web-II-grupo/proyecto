const { renderizarHtml } = require('./htmlRenderer');
const { generarPdf } = require('./pdfRenderer');
const { RendererError } = require('./errors');
const { obtenerFacturaPorId } = require('../src/controllers/facturaController');

const ID_PATTERN = /^[A-Za-z0-9._-]+$/;

function createDocumentController(dependencies = {}) {
  const facturaProvider = dependencies.apiClient || dependencies.facturaProvider || { obtenerPorId: obtenerFacturaPorId };
  const htmlRenderer = dependencies.htmlRenderer || renderizarHtml;
  const pdfRenderer = dependencies.pdfRenderer || generarPdf;

  return async function obtenerDocumento(req, res) {
    try {
      const { id } = req.params;
      const formato = String(req.query.formato || 'pdf').toLowerCase();
      const plantillaSolicitada = String(req.query.plantilla || 'auto').toLowerCase();

      if (!id || id.length > 128 || !ID_PATTERN.test(id)) {
        throw new RendererError('Identificador de factura inválido', 400, 'ID_INVALIDO');
      }
      if (formato !== 'pdf') {
        throw new RendererError('Por el momento este servicio entrega únicamente facturas en PDF', 400, 'FORMATO_INVALIDO');
      }

      const factura = await facturaProvider.obtenerPorId(id);
      if (!factura) throw new RendererError('Factura no encontrada', 404, 'FACTURA_NO_ENCONTRADA');
      if (String(factura.id) !== id) throw new RendererError('Se obtuvo una factura distinta de la solicitada', 502, 'RESPUESTA_INVALIDA');

      const render = await htmlRenderer(factura, { plantilla: plantillaSolicitada });
      const html = typeof render === 'string' ? render : render.html;
      const plantilla = typeof render === 'string' ? plantillaSolicitada : render.plantilla;
      const pdf = await pdfRenderer(html);

      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="factura-${id}.pdf"`,
        'Content-Length': pdf.length,
        'Cache-Control': 'private, max-age=300',
        'X-Content-Type-Options': 'nosniff',
        'X-Factura-Plantilla': plantilla,
      });
      return res.status(200).send(pdf);
    } catch (error) {
      const controlled = error instanceof RendererError;
      const status = controlled ? error.status : (Number(error?.status) || 500);
      const codigo = controlled ? error.code : (error?.code || 'RENDERER_ERROR');
      if (!controlled) console.error('[document-renderer]', error);
      if (status === 503) res.set('Retry-After', '2');
      return res.status(status).json({
        error: controlled ? error.message : (status === 503 ? error.message : 'No se pudo generar el PDF'),
        codigo,
      });
    }
  };
}

module.exports = { createDocumentController };
