function normalizarFacturaEntrada(req, res, next) {
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  body.fecha = body.fecha ?? body.fecha_emision;
  body.condicionVenta = body.condicionVenta ?? body.condicion_venta;
  body.medioPago = body.medioPago ?? body.medio_pago;
  body.referenciaExterna = body.referenciaExterna ?? body.referencia_externa;

  const normalizarParte = (parte = {}) => {
    const identificacion = parte.identificacion || {};
    return {
      ...parte,
      nombre: parte.nombre ?? parte.razon_social,
      correo: parte.correo ?? parte.email,
      logoUrl: parte.logoUrl ?? parte.logo_url ?? parte.logo_data,
      identificacion: {
        ...identificacion,
        tipo: identificacion.tipo ?? parte.tipo_identificacion ?? parte.tipo_id,
        numero: identificacion.numero ?? parte.numero_identificacion ?? parte.numero_id,
      },
    };
  };

  body.emisor = normalizarParte(body.emisor || {});
  body.receptor = normalizarParte(body.receptor || {});

  if (Array.isArray(body.items)) {
    body.items = body.items.map((item = {}, index) => ({
      ...item,
      numeroLinea: item.numeroLinea ?? item.numero_linea ?? index + 1,
      detalle: item.detalle ?? item.descripcion,
      cantidad: item.cantidad,
      precioUnitario: item.precioUnitario ?? item.precio_unitario,
      descuento: item.descuento ?? 0,
      impuesto: { tarifa: item.impuesto?.tarifa ?? item.impuesto_tarifa ?? 0 },
      subtotal: item.subtotal,
      montoTotalLinea: item.montoTotalLinea ?? item.monto_total_linea ?? item.total_linea,
    }));
  }

  const t = body.totales || {};
  body.totales = {
    ...t,
    totalGravado: t.totalGravado ?? t.total_gravado,
    totalExento: t.totalExento ?? t.total_exento,
    totalDescuentos: t.totalDescuentos ?? t.total_descuentos ?? 0,
    totalImpuesto: t.totalImpuesto ?? t.total_impuesto,
    totalComprobante: t.totalComprobante ?? t.total_comprobante,
  };

  req.body = body;
  next();
}

function validateFactura(body = {}) {
  const errors = [];

  const required = (path, value) => {
    if (value === undefined || value === null || value === '') {
      errors.push(`Falta el campo requerido: ${path}`);
    }
  };

  const numeroNoNegativo = (path, value, { positivo = false } = {}) => {
    const n = Number(value);
    if (!Number.isFinite(n) || (positivo ? n <= 0 : n < 0)) {
      errors.push(`${path} debe ser un número ${positivo ? 'mayor que cero' : 'mayor o igual a cero'}`);
    }
  };

  required('fecha', body.fecha);
  required('moneda', body.moneda);
  required('condicionVenta', body.condicionVenta);
  required('medioPago', body.medioPago);

  if (body.fecha && Number.isNaN(new Date(body.fecha).getTime())) errors.push('fecha no es válida');
  if (body.moneda && !['CRC', 'USD'].includes(String(body.moneda).toUpperCase())) {
    errors.push(`moneda inválida: ${body.moneda} (debe ser CRC o USD)`);
  }

  for (const [campo, maximo] of [['origen', 80], ['referenciaExterna', 100]]) {
    const valor = body[campo] ?? (campo === 'referenciaExterna' ? body.referencia_externa : undefined);
    if (valor !== undefined && valor !== null && String(valor).trim().length > maximo) {
      errors.push(`${campo} no puede superar ${maximo} caracteres`);
    }
  }

  const emisor = body.emisor || {};
  required('emisor.nombre', emisor.nombre);
  required('emisor.identificacion.tipo', emisor.identificacion?.tipo);
  required('emisor.identificacion.numero', emisor.identificacion?.numero);
  required('emisor.correo', emisor.correo);

  if (emisor.logoUrl || emisor.logo_data) {
    const logo = String(emisor.logoUrl || emisor.logo_data).trim();
    const match = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=\s]+)$/i.exec(logo);
    if (!match) {
      errors.push('emisor.logoUrl debe ser una imagen PNG, JPG o WEBP en formato data URL');
    } else {
      const bytes = Buffer.from(match[2].replace(/\s+/g, ''), 'base64');
      if (!bytes.length) errors.push('emisor.logoUrl está vacío');
      if (bytes.length > 500 * 1024) errors.push('emisor.logoUrl excede 500 KB');
    }
  }

  const receptor = body.receptor || {};
  required('receptor.nombre', receptor.nombre);
  required('receptor.correo', receptor.correo);

  if (!Array.isArray(body.items) || body.items.length === 0) {
    errors.push('Falta el campo requerido: items (debe tener al menos 1 elemento)');
  } else if (body.items.length > 100) {
    errors.push('items no puede contener más de 100 líneas');
  } else {
    body.items.forEach((item = {}, idx) => {
      required(`items[${idx}].detalle`, item.detalle);
      required(`items[${idx}].cantidad`, item.cantidad);
      required(`items[${idx}].precioUnitario`, item.precioUnitario);
      required(`items[${idx}].impuesto.tarifa`, item.impuesto?.tarifa);
      required(`items[${idx}].subtotal`, item.subtotal);
      required(`items[${idx}].montoTotalLinea`, item.montoTotalLinea);
      numeroNoNegativo(`items[${idx}].cantidad`, item.cantidad, { positivo: true });
      numeroNoNegativo(`items[${idx}].precioUnitario`, item.precioUnitario);
      numeroNoNegativo(`items[${idx}].descuento`, item.descuento || 0);
      numeroNoNegativo(`items[${idx}].impuesto.tarifa`, item.impuesto?.tarifa || 0);
      numeroNoNegativo(`items[${idx}].subtotal`, item.subtotal);
      numeroNoNegativo(`items[${idx}].montoTotalLinea`, item.montoTotalLinea);
    });
  }

  const totales = body.totales || {};
  required('totales.totalGravado', totales.totalGravado);
  required('totales.totalExento', totales.totalExento);
  required('totales.totalImpuesto', totales.totalImpuesto);
  required('totales.totalComprobante', totales.totalComprobante);
  numeroNoNegativo('totales.totalGravado', totales.totalGravado);
  numeroNoNegativo('totales.totalExento', totales.totalExento);
  numeroNoNegativo('totales.totalDescuentos', totales.totalDescuentos || 0);
  numeroNoNegativo('totales.totalImpuesto', totales.totalImpuesto);
  numeroNoNegativo('totales.totalComprobante', totales.totalComprobante);

  return errors;
}

function validateFacturaMiddleware(req, res, next) {
  const errors = validateFactura(req.body);
  if (errors.length > 0) {
    return res.status(400).json({ error: 'Datos de la factura inválidos', detalles: errors });
  }
  next();
}

module.exports = { normalizarFacturaEntrada, validateFactura, validateFacturaMiddleware };
