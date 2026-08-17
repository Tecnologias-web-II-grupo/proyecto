const { RendererError } = require('./errors');

function createFacturaApiClient({ baseUrl, timeoutMs, fetchImpl = global.fetch }) {
  if (typeof fetchImpl !== 'function') {
    throw new Error('El runtime no dispone de un cliente HTTP compatible con fetch');
  }

  return {
    async obtenerPorId(id) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);

      try {
        // El renderer usa el contrato REST para permanecer desacoplado de la base de datos.
        const response = await fetchImpl(
          `${baseUrl.replace(/\/$/, '')}/api/facturas/${encodeURIComponent(id)}`,
          { headers: { Accept: 'application/json' }, signal: controller.signal }
        );

        if (response.status === 404) {
          throw new RendererError('Factura no encontrada', 404, 'FACTURA_NO_ENCONTRADA');
        }
        if (!response.ok) {
          throw new RendererError('El API de facturas no pudo completar la consulta', 502, 'API_ERROR');
        }

        const text = await response.text();
        if (!text) {
          throw new RendererError('El API de facturas devolvió una respuesta vacía', 502, 'RESPUESTA_INVALIDA');
        }

        try {
          return JSON.parse(text);
        } catch {
          throw new RendererError('El API de facturas devolvió JSON inválido', 502, 'RESPUESTA_INVALIDA');
        }
      } catch (error) {
        if (error instanceof RendererError) throw error;
        if (error.name === 'AbortError') {
          throw new RendererError('La consulta de la factura excedió el tiempo límite', 504, 'API_TIMEOUT');
        }
        throw new RendererError('No fue posible conectar con el API de facturas', 502, 'API_NO_DISPONIBLE');
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}

module.exports = { createFacturaApiClient };
