const pool = require('../db/database');
const { encrypt, decrypt } = require('../middleware/crypto');
const { randomUUID } = require('crypto');

let logoSchemaPromise = null;

async function asegurarColumnaLogo() {
  if (logoSchemaPromise) return logoSchemaPromise;

  logoSchemaPromise = (async () => {
    const [[row]] = await pool.query(
      `SELECT COUNT(*) AS existe
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'facturas'
         AND COLUMN_NAME = 'emisor_logo'`
    );

    if (!Number(row?.existe || 0)) {
      await pool.query(
        `ALTER TABLE facturas
         ADD COLUMN emisor_logo LONGTEXT NULL AFTER emisor_correo`
      );
    }
  })().catch((error) => {
    logoSchemaPromise = null;
    throw error;
  });

  return logoSchemaPromise;
}

function normalizarLogo(valor) {
  if (valor === null || valor === undefined || valor === '') return null;
  const logo = String(valor).trim();

  if (logo.length > 800000) {
    throw new Error('El logo excede el tamaño máximo permitido.');
  }

  if (!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=\s]+$/i.test(logo)) {
    throw new Error('El logo debe ser PNG, JPG o WEBP en formato data URL.');
  }

  return logo;
}

async function crearFactura(req, res) {
  const body = req.body;
  const id = body.id || `F-${randomUUID().slice(0, 8).toUpperCase()}`;
  await asegurarColumnaLogo();
  const logoEmisor = normalizarLogo(body.emisor?.logoUrl || body.emisor?.logo_data || null);
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    await conn.execute(
      `INSERT INTO facturas (
        id, fecha_emision, moneda, condicion_venta, medio_pago,
        emisor_nombre, emisor_tipo_id, emisor_numero_id, emisor_correo, emisor_logo,
        receptor_nombre, receptor_tipo_id, receptor_numero_id, receptor_correo,
        total_gravado, total_exento, total_descuentos, total_impuesto, total_comprobante
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        new Date(body.fecha),
        body.moneda,
        body.condicionVenta,
        body.medioPago,
        body.emisor.nombre,
        body.emisor.identificacion.tipo,
        encrypt(body.emisor.identificacion.numero),
        body.emisor.correo,
        logoEmisor,
        body.receptor.nombre,
        body.receptor.identificacion?.tipo || null,
        body.receptor.identificacion?.numero ? encrypt(body.receptor.identificacion.numero) : null,
        body.receptor.correo,
        body.totales.totalGravado,
        body.totales.totalExento,
        body.totales.totalDescuentos || 0,
        body.totales.totalImpuesto,
        body.totales.totalComprobante,
      ]
    );

    for (const item of body.items) {
      await conn.execute(
        `INSERT INTO factura_items (
          factura_id, numero_linea, detalle, cantidad, precio_unitario,
          descuento, impuesto_tarifa, subtotal, monto_total_linea
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          item.numeroLinea ?? null,
          item.detalle,
          item.cantidad,
          item.precioUnitario,
          item.descuento || 0,
          item.impuesto.tarifa,
          item.subtotal,
          item.montoTotalLinea,
        ]
      );
    }

    await conn.commit();
    const facturaCreada = await obtenerFacturaPorId(id);
    return res.status(201).json(facturaCreada);
  } catch (err) {
    await conn.rollback();
    console.error('[crearFactura] error:', err.message);
    return res.status(500).json({ error: 'No se pudo crear la factura', detalle: err.message });
  } finally {
    conn.release();
  }
}


async function actualizarLogoFactura(req, res) {
  const id = String(req.params.id || '').trim();
  if (!id) return res.status(400).json({ error: 'Factura inválida' });
  try {
    await asegurarColumnaLogo();
    const logoEmisor = normalizarLogo(req.body?.logoUrl ?? req.body?.logo_data ?? null);
    const soloSiVacio = req.body?.soloSiVacio !== false;
    const [result] = soloSiVacio
      ? await pool.execute('UPDATE facturas SET emisor_logo = COALESCE(emisor_logo, ?) WHERE id = ?', [logoEmisor, id])
      : await pool.execute('UPDATE facturas SET emisor_logo = ? WHERE id = ?', [logoEmisor, id]);
    if (!result.affectedRows) return res.status(404).json({ error: 'Factura no encontrada' });
    const factura = await obtenerFacturaPorId(id);
    return res.json({ id, logoActualizado: Boolean(factura?.emisor?.logoUrl) });
  } catch (err) {
    console.error('[actualizarLogoFactura] error:', err.message);
    return res.status(400).json({ error: 'No se pudo actualizar el logo', detalle: err.message });
  }
}

async function consultarFactura(req, res) {
  try {
    const factura = await obtenerFacturaPorId(req.params.id);
    if (!factura) {
      return res.status(404).json({ error: 'Factura no encontrada' });
    }
    return res.json(factura);
  } catch (err) {
    console.error('[consultarFactura] error:', err.message);
    return res.status(500).json({ error: 'Error al consultar la factura' });
  }
}

async function obtenerFacturaPorId(id) {
  await asegurarColumnaLogo();
  const [facturaRows] = await pool.execute('SELECT * FROM facturas WHERE id = ?', [id]);
  if (facturaRows.length === 0) return null;
  const f = facturaRows[0];

  const [itemRows] = await pool.execute(
    'SELECT * FROM factura_items WHERE factura_id = ? ORDER BY numero_linea',
    [id]
  );

  return {
    id: f.id,
    fecha: new Date(f.fecha_emision).toISOString(),
    moneda: f.moneda,
    condicionVenta: f.condicion_venta,
    medioPago: f.medio_pago,
    emisor: {
      nombre: f.emisor_nombre,
      identificacion: { tipo: f.emisor_tipo_id, numero: decrypt(f.emisor_numero_id) },
      correo: f.emisor_correo,
      logoUrl: f.emisor_logo || null,
    },
    receptor: {
      nombre: f.receptor_nombre,
      identificacion: f.receptor_numero_id
        ? { tipo: f.receptor_tipo_id, numero: decrypt(f.receptor_numero_id) }
        : null,
      correo: f.receptor_correo,
    },
    items: itemRows.map((it) => ({
      numeroLinea: it.numero_linea,
      detalle: it.detalle,
      cantidad: Number(it.cantidad),
      precioUnitario: Number(it.precio_unitario),
      descuento: Number(it.descuento),
      impuesto: { tarifa: Number(it.impuesto_tarifa) },
      subtotal: Number(it.subtotal),
      montoTotalLinea: Number(it.monto_total_linea),
    })),
    totales: {
      totalGravado: Number(f.total_gravado),
      totalExento: Number(f.total_exento),
      totalDescuentos: Number(f.total_descuentos),
      totalImpuesto: Number(f.total_impuesto),
      totalComprobante: Number(f.total_comprobante),
    },
  };
}

module.exports = { crearFactura, consultarFactura, actualizarLogoFactura, obtenerFacturaPorId };