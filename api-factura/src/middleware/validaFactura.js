function normalizarFacturaEntrada(req, res, next) {
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  body.fecha = body.fecha ?? body.fecha_emision;
  body.condicionVenta = body.condicionVenta ?? body.condicion_venta;
  body.medioPago = body.medioPago ?? body.medio_pago;
  body.referenciaExterna = body.referenciaExterna ?? body.referencia_externa;
  body.perfilValidacion = body.perfilValidacion ?? body.perfil_validacion ?? body.esquema ?? 'basico';

  const normalizarUbicacion = (ubicacion = {}) => ({
    ...ubicacion,
    provincia: ubicacion.provincia,
    canton: ubicacion.canton ?? ubicacion.cantón,
    distrito: ubicacion.distrito,
    barrio: ubicacion.barrio,
    otrasSenas: ubicacion.otrasSenas ?? ubicacion.otras_senas,
    otrasSenasExtranjero: ubicacion.otrasSenasExtranjero ?? ubicacion.otras_senas_extranjero,
  });

  const normalizarParte = (parte = {}) => {
    const identificacion = parte.identificacion || {};
    const telefono = parte.telefono || {};
    return {
      ...parte,
      nombre: parte.nombre ?? parte.razon_social,
      nombreComercial: parte.nombreComercial ?? parte.nombre_comercial,
      actividadEconomica: parte.actividadEconomica ?? parte.codigoActividad ?? parte.codigo_actividad,
      correo: parte.correo ?? parte.email,
      correos: parte.correos ?? parte.emails,
      logoUrl: parte.logoUrl ?? parte.logo_url ?? parte.logo_data,
      registroBebidasAlcoholicas: parte.registroBebidasAlcoholicas ?? parte.registro_bebidas_alcoholicas,
      identificacion: {
        ...identificacion,
        tipo: identificacion.tipo ?? parte.tipo_identificacion ?? parte.tipo_id,
        numero: identificacion.numero ?? parte.numero_identificacion ?? parte.numero_id,
      },
      ubicacion: normalizarUbicacion(parte.ubicacion || {}),
      telefono: {
        ...telefono,
        codigoPais: telefono.codigoPais ?? telefono.codigo_pais,
        numero: telefono.numero,
      },
    };
  };

  body.emisor = normalizarParte(body.emisor || {});
  body.receptor = normalizarParte(body.receptor || {});

  if (Array.isArray(body.items)) {
    body.items = body.items.map((item = {}, index) => ({
      ...item,
      numeroLinea: item.numeroLinea ?? item.numero_linea ?? index + 1,
      codigoCabys: item.codigoCabys ?? item.codigoCABYS ?? item.codigo_cabys ?? item.codigoProductoServicio,
      partidaArancelaria: item.partidaArancelaria ?? item.partida_arancelaria,
      codigosComerciales: item.codigosComerciales ?? item.codigos_comerciales ?? [],
      unidadMedida: item.unidadMedida ?? item.unidad_medida,
      unidadMedidaComercial: item.unidadMedidaComercial ?? item.unidad_medida_comercial,
      tipoTransaccion: item.tipoTransaccion ?? item.tipo_transaccion,
      numeroVinSerie: item.numeroVinSerie ?? item.numero_vin_serie ?? item.vin,
      registroMedicamento: item.registroMedicamento ?? item.registro_medicamento,
      formaFarmaceutica: item.formaFarmaceutica ?? item.forma_farmaceutica,
      detalleSurtido: item.detalleSurtido ?? item.detalle_surtido ?? [],
      detalle: item.detalle ?? item.descripcion,
      cantidad: item.cantidad,
      precioUnitario: item.precioUnitario ?? item.precio_unitario,
      descuentos: item.descuentos ?? [],
      descuento: item.descuento ?? 0,
      baseImponible: item.baseImponible ?? item.base_imponible,
      impuestos: item.impuestos ?? (item.impuesto ? [item.impuesto] : []),
      impuesto: {
        ...(item.impuesto || {}),
        tarifa: item.impuesto?.tarifa ?? item.impuestos?.[0]?.tarifa ?? item.impuesto_tarifa ?? 0,
      },
      impuestoAsumidoEmisor: item.impuestoAsumidoEmisor ?? item.impuesto_asumido_emisor,
      subtotal: item.subtotal,
      montoTotalLinea: item.montoTotalLinea ?? item.monto_total_linea ?? item.total_linea,
    }));
  }

  const t = body.totales || {};
  body.totales = {
    ...t,
    totalServiciosGravados: t.totalServiciosGravados ?? t.total_servicios_gravados,
    totalServiciosExentos: t.totalServiciosExentos ?? t.total_servicios_exentos,
    totalServiciosExonerados: t.totalServiciosExonerados ?? t.total_servicios_exonerados,
    totalServiciosNoSujetos: t.totalServiciosNoSujetos ?? t.total_servicios_no_sujetos,
    totalMercanciasGravadas: t.totalMercanciasGravadas ?? t.total_mercancias_gravadas,
    totalMercanciasExentas: t.totalMercanciasExentas ?? t.total_mercancias_exentas,
    totalMercanciasExoneradas: t.totalMercanciasExoneradas ?? t.total_mercancias_exoneradas,
    totalMercanciasNoSujetas: t.totalMercanciasNoSujetas ?? t.total_mercancias_no_sujetas,
    totalGravado: t.totalGravado ?? t.total_gravado,
    totalExento: t.totalExento ?? t.total_exento,
    totalExonerado: t.totalExonerado ?? t.total_exonerado,
    totalNoSujeto: t.totalNoSujeto ?? t.total_no_sujeto,
    totalVenta: t.totalVenta ?? t.total_venta,
    totalDescuentos: t.totalDescuentos ?? t.total_descuentos ?? 0,
    totalVentaNeta: t.totalVentaNeta ?? t.total_venta_neta,
    totalImpuesto: t.totalImpuesto ?? t.total_impuesto,
    totalIVADevuelto: t.totalIVADevuelto ?? t.total_iva_devuelto,
    totalOtrosCargos: t.totalOtrosCargos ?? t.total_otros_cargos,
    totalComprobante: t.totalComprobante ?? t.total_comprobante,
    tipoCambio: t.tipoCambio ?? t.tipo_cambio,
    mediosPago: t.mediosPago ?? t.medios_pago ?? [],
  };

  body.plazoCreditoDias = body.plazoCreditoDias ?? body.plazo_credito_dias;
  body.detalleCondicionVentaOtro = body.detalleCondicionVentaOtro ?? body.detalle_condicion_venta_otro;
  body.referencias = body.referencias ?? body.informacionReferencia ?? [];
  body.otrosCargos = body.otrosCargos ?? body.otros_cargos ?? [];
  body.otros = body.otros ?? [];

  req.body = body;
  next();
}

function validateFactura(body = {}) {
  const errors = [];
  const perfilV44 = ['v44', 'v44-visual', 'hacienda-v44'].includes(String(body.perfilValidacion || '').toLowerCase());

  const required = (path, value) => {
    if (value === undefined || value === null || value === '') errors.push(`Falta el campo requerido: ${path}`);
  };
  const numeroNoNegativo = (path, value, { positivo = false } = {}) => {
    const n = Number(value);
    if (!Number.isFinite(n) || (positivo ? n <= 0 : n < 0)) {
      errors.push(`${path} debe ser un número ${positivo ? 'mayor que cero' : 'mayor o igual a cero'}`);
    }
  };
  const maxLen = (path, value, max) => {
    if (value !== undefined && value !== null && String(value).length > max) errors.push(`${path} no puede superar ${max} caracteres`);
  };
  const codigoFijo = (path, value, len) => {
    if (value !== undefined && value !== null && value !== '' && String(value).length !== len) errors.push(`${path} debe tener ${len} caracteres`);
  };
  const fechaValida = (path, value) => {
    if (value && Number.isNaN(new Date(value).getTime())) errors.push(`${path} no es una fecha válida`);
  };

  required('fecha', body.fecha);
  required('moneda', body.moneda);
  required('condicionVenta', body.condicionVenta);
  required('medioPago', body.medioPago);
  fechaValida('fecha', body.fecha);
  if (body.moneda && !/^[A-Z]{3}$/.test(String(body.moneda).toUpperCase())) errors.push('moneda debe usar un código ISO de 3 letras, por ejemplo CRC o USD');
  codigoFijo('condicionVenta', body.condicionVenta, 2);
  codigoFijo('medioPago', body.medioPago, 2);

  for (const [campo, maximo] of [['origen', 80], ['referenciaExterna', 100]]) maxLen(campo, body[campo], maximo);

  const validarParte = (nombre, parte = {}, receptor = false) => {
    required(`${nombre}.nombre`, parte.nombre);
    required(`${nombre}.identificacion.tipo`, parte.identificacion?.tipo);
    required(`${nombre}.identificacion.numero`, parte.identificacion?.numero);
    required(`${nombre}.correo`, parte.correo);
    codigoFijo(`${nombre}.identificacion.tipo`, parte.identificacion?.tipo, 2);
    maxLen(`${nombre}.identificacion.numero`, parte.identificacion?.numero, 20);
    maxLen(`${nombre}.nombre`, parte.nombre, 100);
    maxLen(`${nombre}.nombreComercial`, parte.nombreComercial, 80);
    maxLen(`${nombre}.correo`, parte.correo, 160);
    if (parte.correo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(parte.correo))) errors.push(`${nombre}.correo no tiene un formato válido`);
    if (parte.actividadEconomica) codigoFijo(`${nombre}.actividadEconomica`, parte.actividadEconomica, 6);
    if (parte.telefono?.numero && !/^\d{8,20}$/.test(String(parte.telefono.numero))) errors.push(`${nombre}.telefono.numero debe tener entre 8 y 20 dígitos`);
    if (parte.ubicacion) {
      for (const k of ['provincia', 'canton', 'distrito']) {
        if (parte.ubicacion[k] && !/^\d{1,3}$/.test(String(parte.ubicacion[k]))) errors.push(`${nombre}.ubicacion.${k} debe ser numérico`);
      }
      maxLen(`${nombre}.ubicacion.otrasSenas`, parte.ubicacion.otrasSenas, 250);
      maxLen(`${nombre}.ubicacion.otrasSenasExtranjero`, parte.ubicacion.otrasSenasExtranjero, 300);
    }
    if (!receptor && perfilV44) {
      required(`${nombre}.actividadEconomica`, parte.actividadEconomica);
    }
  };

  validarParte('emisor', body.emisor || {}, false);
  validarParte('receptor', body.receptor || {}, true);

  if (perfilV44) {
    required('proveedorSistemas', body.proveedorSistemas);
    maxLen('proveedorSistemas', body.proveedorSistemas, 20);
  }

  const logo = body.emisor?.logoUrl || body.emisor?.logo_data;
  if (logo) {
    const match = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=\s]+)$/i.exec(String(logo).trim());
    if (!match) errors.push('emisor.logoUrl debe ser una imagen PNG, JPG o WEBP en formato data URL');
    else {
      const bytes = Buffer.from(match[2].replace(/\s+/g, ''), 'base64');
      if (!bytes.length) errors.push('emisor.logoUrl está vacío');
      if (bytes.length > 500 * 1024) errors.push('emisor.logoUrl excede 500 KB');
    }
  }

  if (String(body.condicionVenta) === '99') required('detalleCondicionVentaOtro', body.detalleCondicionVentaOtro);
  if (body.plazoCreditoDias !== undefined && body.plazoCreditoDias !== null && body.plazoCreditoDias !== '') {
    const plazo = Number(body.plazoCreditoDias);
    if (!Number.isInteger(plazo) || plazo < 0 || plazo > 99999) errors.push('plazoCreditoDias debe ser un entero entre 0 y 99999');
  }

  if (!Array.isArray(body.items) || body.items.length === 0) errors.push('Falta el campo requerido: items (debe tener al menos 1 elemento)');
  else if (body.items.length > 1000) errors.push('items no puede contener más de 1000 líneas');
  else {
    body.items.forEach((item = {}, idx) => {
      required(`items[${idx}].detalle`, item.detalle);
      required(`items[${idx}].cantidad`, item.cantidad);
      required(`items[${idx}].precioUnitario`, item.precioUnitario);
      required(`items[${idx}].subtotal`, item.subtotal);
      required(`items[${idx}].montoTotalLinea`, item.montoTotalLinea);
      numeroNoNegativo(`items[${idx}].cantidad`, item.cantidad, { positivo: true });
      numeroNoNegativo(`items[${idx}].precioUnitario`, item.precioUnitario);
      numeroNoNegativo(`items[${idx}].descuento`, item.descuento || 0);
      numeroNoNegativo(`items[${idx}].subtotal`, item.subtotal);
      numeroNoNegativo(`items[${idx}].montoTotalLinea`, item.montoTotalLinea);

      if (perfilV44) {
        required(`items[${idx}].codigoCabys`, item.codigoCabys);
        required(`items[${idx}].unidadMedida`, item.unidadMedida);
        required(`items[${idx}].baseImponible`, item.baseImponible ?? item.subtotal);
        maxLen(`items[${idx}].codigoCabys`, item.codigoCabys, 13);
        maxLen(`items[${idx}].unidadMedida`, item.unidadMedida, 20);
      }

      if (Array.isArray(item.codigosComerciales) && item.codigosComerciales.length > 5) errors.push(`items[${idx}].codigosComerciales permite máximo 5 códigos`);
      maxLen(`items[${idx}].registroMedicamento`, item.registroMedicamento, 100);
      if (item.formaFarmaceutica) codigoFijo(`items[${idx}].formaFarmaceutica`, item.formaFarmaceutica, 3);
      if (Array.isArray(item.detalleSurtido) && item.detalleSurtido.length > 20) errors.push(`items[${idx}].detalleSurtido permite máximo 20 componentes`);
      if (Array.isArray(item.descuentos) && item.descuentos.length > 5) errors.push(`items[${idx}].descuentos permite máximo 5 descuentos`);

      const impuestos = Array.isArray(item.impuestos) && item.impuestos.length ? item.impuestos : (item.impuesto ? [item.impuesto] : []);
      if (perfilV44 && impuestos.length === 0) errors.push(`Falta el campo requerido: items[${idx}].impuestos`);
      impuestos.forEach((imp = {}, j) => {
        if (perfilV44) required(`items[${idx}].impuestos[${j}].codigo`, imp.codigo);
        if (imp.codigo) codigoFijo(`items[${idx}].impuestos[${j}].codigo`, imp.codigo, 2);
        if (imp.codigoTarifaIVA) codigoFijo(`items[${idx}].impuestos[${j}].codigoTarifaIVA`, imp.codigoTarifaIVA, 2);
        if (imp.tarifa !== undefined) numeroNoNegativo(`items[${idx}].impuestos[${j}].tarifa`, imp.tarifa);
        if (imp.monto !== undefined) numeroNoNegativo(`items[${idx}].impuestos[${j}].monto`, imp.monto);
        if (String(imp.codigo) === '99') required(`items[${idx}].impuestos[${j}].codigoOtro`, imp.codigoOtro);
        if (imp.exoneracion) {
          required(`items[${idx}].impuestos[${j}].exoneracion.tipoDocumento`, imp.exoneracion.tipoDocumento);
          required(`items[${idx}].impuestos[${j}].exoneracion.numeroDocumento`, imp.exoneracion.numeroDocumento);
          required(`items[${idx}].impuestos[${j}].exoneracion.nombreInstitucion`, imp.exoneracion.nombreInstitucion);
          required(`items[${idx}].impuestos[${j}].exoneracion.fechaEmision`, imp.exoneracion.fechaEmision);
          fechaValida(`items[${idx}].impuestos[${j}].exoneracion.fechaEmision`, imp.exoneracion.fechaEmision);
        }
      });

      (item.descuentos || []).forEach((d = {}, j) => {
        required(`items[${idx}].descuentos[${j}].monto`, d.monto);
        required(`items[${idx}].descuentos[${j}].codigo`, d.codigo);
        numeroNoNegativo(`items[${idx}].descuentos[${j}].monto`, d.monto);
        if (String(d.codigo) === '99') {
          required(`items[${idx}].descuentos[${j}].codigoOtro`, d.codigoOtro);
          required(`items[${idx}].descuentos[${j}].naturaleza`, d.naturaleza);
        }
      });
    });
  }

  const totales = body.totales || {};
  required('totales.totalGravado', totales.totalGravado);
  required('totales.totalExento', totales.totalExento);
  required('totales.totalImpuesto', totales.totalImpuesto);
  required('totales.totalComprobante', totales.totalComprobante);
  for (const [k, v] of Object.entries(totales)) {
    if (k === 'mediosPago') continue;
    if (typeof v === 'number' || (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v)))) numeroNoNegativo(`totales.${k}`, v);
  }
  if (perfilV44) {
    for (const campo of ['totalVenta', 'totalVentaNeta']) required(`totales.${campo}`, totales[campo]);
    if (!Array.isArray(totales.mediosPago) || totales.mediosPago.length === 0) errors.push('Falta el campo requerido: totales.mediosPago');
  }
  (totales.mediosPago || []).forEach((m = {}, idx) => {
    required(`totales.mediosPago[${idx}].tipo`, m.tipo);
    required(`totales.mediosPago[${idx}].total`, m.total);
    codigoFijo(`totales.mediosPago[${idx}].tipo`, m.tipo, 2);
    numeroNoNegativo(`totales.mediosPago[${idx}].total`, m.total);
    if (String(m.tipo) === '99') required(`totales.mediosPago[${idx}].detalleOtro`, m.detalleOtro);
  });

  if (!Array.isArray(body.referencias)) errors.push('referencias debe ser un arreglo');
  else if (body.referencias.length > 10) errors.push('referencias permite máximo 10 elementos');
  else body.referencias.forEach((r = {}, idx) => {
    required(`referencias[${idx}].tipoDocumento`, r.tipoDocumento);
    required(`referencias[${idx}].numero`, r.numero);
    required(`referencias[${idx}].fechaEmision`, r.fechaEmision);
    required(`referencias[${idx}].codigo`, r.codigo);
    required(`referencias[${idx}].razon`, r.razon);
    fechaValida(`referencias[${idx}].fechaEmision`, r.fechaEmision);
    if (String(r.tipoDocumento) === '99') required(`referencias[${idx}].tipoDocumentoOtro`, r.tipoDocumentoOtro);
    if (String(r.codigo) === '99') required(`referencias[${idx}].codigoReferenciaOtro`, r.codigoReferenciaOtro);
    maxLen(`referencias[${idx}].razon`, r.razon, 180);
  });

  if (!Array.isArray(body.otrosCargos)) errors.push('otrosCargos debe ser un arreglo');
  else if (body.otrosCargos.length > 15) errors.push('otrosCargos permite máximo 15 elementos');
  else body.otrosCargos.forEach((c = {}, idx) => {
    required(`otrosCargos[${idx}].tipoDocumento`, c.tipoDocumento);
    required(`otrosCargos[${idx}].detalle`, c.detalle);
    required(`otrosCargos[${idx}].monto`, c.monto);
    numeroNoNegativo(`otrosCargos[${idx}].monto`, c.monto);
    if (String(c.tipoDocumento) === '99') required(`otrosCargos[${idx}].tipoDocumentoOtro`, c.tipoDocumentoOtro);
    if (c.tercero?.identificacion) {
      required(`otrosCargos[${idx}].tercero.identificacion.tipo`, c.tercero.identificacion.tipo);
      required(`otrosCargos[${idx}].tercero.identificacion.numero`, c.tercero.identificacion.numero);
    }
  });

  return errors;
}

function validateFacturaMiddleware(req, res, next) {
  const errors = validateFactura(req.body);
  if (errors.length > 0) return res.status(400).json({ error: 'Datos de la factura inválidos', detalles: errors });
  next();
}

module.exports = { normalizarFacturaEntrada, validateFactura, validateFacturaMiddleware };
