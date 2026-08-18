const { renderizarHtml } = require('./htmlRenderer');
const { generarPdf } = require('./pdfRenderer');
const { RendererError } = require('./errors');
const { obtenerFacturaPorId } = require('../src/controllers/facturaController');

const ID_PATTERN = /^[A-Za-z0-9._-]+$/;

function createDocumentController(dependencies = {}) {
  const facturaProvider =
    dependencies.apiClient ||
    dependencies.facturaProvider ||
    { obtenerPorId: obtenerFacturaPorId };

  const htmlRenderer = dependencies.htmlRenderer || renderizarHtml;
  const pdfRenderer = dependencies.pdfRenderer || generarPdf;

  return async function obtenerDocumento(req, res) {
    try {
      const { id } = req.params;
      const formato = String(req.query.formato || 'html').toLowerCase();

      if (!id || id.length > 128 || !ID_PATTERN.test(id)) {
        throw new RendererError(
          'Identificador de factura inválido',
          400,
          'ID_INVALIDO'
        );
      }

      if (!['html', 'pdf'].includes(formato)) {
        throw new RendererError(
          'Formato inválido; utilice html o pdf',
          400,
          'FORMATO_INVALIDO'
        );
      }

      const factura = await facturaProvider.obtenerPorId(id);

      if (!factura) {
        throw new RendererError(
          'Factura no encontrada',
          404,
          'FACTURA_NO_ENCONTRADA'
        );
      }

      if (String(factura.id) !== id) {
        throw new RendererError(
          'Se obtuvo una factura distinta de la solicitada',
          502,
          'RESPUESTA_INVALIDA'
        );
      }

      const html = await htmlRenderer(factura);

      if (formato === 'html') {
        return res.status(200).type('html').send(html);
      }

      const pdf = await pdfRenderer(html);

      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="factura-${id}.pdf"`,
        'Content-Length': pdf.length,
        'Cache-Control': 'no-store',
      });

      return res.status(200).send(pdf);
    } catch (error) {
      const controlled = error instanceof RendererError;

      if (!controlled) {
        console.error('[document-renderer]', error);
      }

      return res.status(controlled ? error.status : 500).json({
        error: controlled ? error.message : 'No se pudo generar el documento',
        codigo: controlled ? error.code : 'RENDERER_ERROR',
      });
    }
  };
}

module.exports = { createDocumentController };
