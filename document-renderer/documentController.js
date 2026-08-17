const { getRendererConfig } = require('./config');
const { createFacturaApiClient } = require('./facturaApiClient');
const { renderizarHtml } = require('./htmlRenderer');
const { generarPdf } = require('./pdfRenderer');
const { RendererError } = require('./errors');

const ID_PATTERN = /^[A-Za-z0-9._-]+$/;

function createDocumentController(dependencies = {}) {
  const config = dependencies.config || getRendererConfig();
  const apiClient = dependencies.apiClient || createFacturaApiClient({
    baseUrl: config.apiBaseUrl,
    timeoutMs: config.timeoutMs,
  });
  const htmlRenderer = dependencies.htmlRenderer || renderizarHtml;
  const pdfRenderer = dependencies.pdfRenderer || generarPdf;

  return async function obtenerDocumento(req, res) {
    try {
      const { id } = req.params;
      const formato = String(req.query.formato || 'html').toLowerCase();
      if (!id || id.length > 128 || !ID_PATTERN.test(id)) {
        throw new RendererError('Identificador de factura inválido', 400, 'ID_INVALIDO');
      }
      if (!['html', 'pdf'].includes(formato)) {
        throw new RendererError('Formato inválido; utilice html o pdf', 400, 'FORMATO_INVALIDO');
      }

      const factura = await apiClient.obtenerPorId(id);
      if (String(factura?.id) !== id) {
        throw new RendererError('El API devolvió una factura distinta de la solicitada', 502, 'RESPUESTA_INVALIDA');
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
      });
      return res.status(200).send(pdf);
    } catch (error) {
      const controlled = error instanceof RendererError;
      if (!controlled) console.error('[document-renderer]', error.message);
      return res.status(controlled ? error.status : 500).json({
        error: controlled ? error.message : 'No se pudo generar el documento',
        codigo: controlled ? error.code : 'RENDERER_ERROR',
      });
    }
  };
}

module.exports = { createDocumentController };
