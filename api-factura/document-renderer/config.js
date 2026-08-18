const DEFAULT_TIMEOUT_MS = 5000;

function getRendererConfig() {
  const timeout = Number(process.env.DOCUMENT_RENDERER_TIMEOUT_MS || DEFAULT_TIMEOUT_MS);

  return {
    apiBaseUrl: process.env.FACTURAS_API_URL || `http://127.0.0.1:${process.env.PORT || 3000}`,
    timeoutMs: Number.isFinite(timeout) && timeout > 0 ? timeout : DEFAULT_TIMEOUT_MS,
  };
}

module.exports = { getRendererConfig };
