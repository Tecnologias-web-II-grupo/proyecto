const pool = require('../db/database');

function parsePipeline() {
  try {
    const raw = process.env.SERVICE_PIPELINE_JSON || '[]';
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list.filter((x) => x && x.name && x.url) : [];
  } catch {
    return [];
  }
}

async function registrar(ventaId, data) {
  await pool.execute(
    `INSERT INTO portal_integraciones (venta_id, servicio, endpoint, estado, http_status, mensaje, request_json, response_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [ventaId, data.servicio, data.endpoint || null, data.estado, data.httpStatus || null, data.mensaje || null,
      data.request ? JSON.stringify(data.request) : null, data.response ? JSON.stringify(data.response) : null]
  );
}

async function ejecutarPipeline(venta, payloadBase) {
  const servicios = parsePipeline();
  const resultados = [];

  for (const servicio of servicios) {
    const requestPayload = { ventaId: venta.id, facturaPendiente: true, ...payloadBase };
    try {
      const response = await fetch(servicio.url, {
        method: servicio.method || 'POST',
        headers: { 'Content-Type': 'application/json', ...(servicio.headers || {}) },
        body: JSON.stringify(requestPayload),
        signal: AbortSignal.timeout(Number(servicio.timeoutMs || 15000)),
      });
      const text = await response.text();
      let body = text;
      try { body = text ? JSON.parse(text) : null; } catch {}
      const ok = response.ok;
      await registrar(venta.id, {
        servicio: servicio.name,
        endpoint: servicio.url,
        estado: ok ? 'completada' : 'fallida',
        httpStatus: response.status,
        mensaje: ok ? 'Integración completada' : `HTTP ${response.status}`,
        request: requestPayload,
        response: body,
      });
      resultados.push({ name: servicio.name, ok, status: response.status, response: body });
      if (!ok) throw new Error(`${servicio.name} respondió HTTP ${response.status}`);
    } catch (error) {
      if (!resultados.some((r) => r.name === servicio.name)) {
        await registrar(venta.id, {
          servicio: servicio.name,
          endpoint: servicio.url,
          estado: 'fallida',
          mensaje: error.message,
          request: requestPayload,
        });
      }
      throw error;
    }
  }
  return resultados;
}

module.exports = { ejecutarPipeline, parsePipeline };
