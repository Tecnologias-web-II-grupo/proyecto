class RendererError extends Error {
  constructor(message, status = 500, code = 'RENDERER_ERROR') {
    super(message);
    this.name = 'RendererError';
    this.status = status;
    this.code = code;
  }
}

module.exports = { RendererError };
