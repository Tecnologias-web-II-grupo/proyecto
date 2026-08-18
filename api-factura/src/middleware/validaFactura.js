function validateFactura(body) {
  const errors = [];

  const required = (path, value) => {
    if (value === undefined || value === null || value === '') {
      errors.push(`Falta el campo requerido: ${path}`);
    }
  };

  required('fecha', body.fecha);
  required('moneda', body.moneda);
  required('condicionVenta', body.condicionVenta);
  required('medioPago', body.medioPago);

  if (body.moneda && !['CRC', 'USD'].includes(body.moneda)) {
    errors.push(`moneda inválida: ${body.moneda} (debe ser CRC o USD)`);
  }

  const emisor = body.emisor || {};
  required('emisor.nombre', emisor.nombre);
  required('emisor.identificacion.tipo', emisor.identificacion?.tipo);
  required('emisor.identificacion.numero', emisor.identificacion?.numero);
  required('emisor.correo', emisor.correo);

  if (emisor.logoUrl) {
    const logo = String(emisor.logoUrl).trim();
    if (logo.length > 800000) {
      errors.push('emisor.logoUrl excede el tamaño máximo permitido');
    } else if (!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=\s]+$/i.test(logo)) {
      errors.push('emisor.logoUrl debe ser una imagen PNG, JPG o WEBP válida');
    }
  }

  const receptor = body.receptor || {};
  required('receptor.nombre', receptor.nombre);
  required('receptor.correo', receptor.correo);

  if (!Array.isArray(body.items) || body.items.length === 0) {
    errors.push('Falta el campo requerido: items (debe tener al menos 1 elemento)');
  } else {
    body.items.forEach((item, idx) => {
      required(`items[${idx}].detalle`, item.detalle);
      required(`items[${idx}].cantidad`, item.cantidad);
      required(`items[${idx}].precioUnitario`, item.precioUnitario);
      required(`items[${idx}].impuesto.tarifa`, item.impuesto?.tarifa);
      required(`items[${idx}].subtotal`, item.subtotal);
      required(`items[${idx}].montoTotalLinea`, item.montoTotalLinea);
    });
  }

  const totales = body.totales || {};
  required('totales.totalGravado', totales.totalGravado);
  required('totales.totalExento', totales.totalExento);
  required('totales.totalImpuesto', totales.totalImpuesto);
  required('totales.totalComprobante', totales.totalComprobante);

  return errors;
}

function validateFacturaMiddleware(req, res, next) {
  const errors = validateFactura(req.body);
  if (errors.length > 0) {
    return res.status(400).json({ error: 'Datos de la factura inválidos', detalles: errors });
  }
  next();
}

module.exports = { validateFactura, validateFacturaMiddleware };