const pool = require('../db/database');
const { encrypt, decrypt } = require('../middleware/crypto');
const { randomUUID } = require('crypto');

async function asegurarEsquemaCompartido() {
  // No se memoriza el resultado indefinidamente. Durante desarrollo/defensa la
  // base puede ser restaurada mientras el proceso de Render sigue vivo; en ese
  // caso una promesa cacheada haría creer que columnas como emisor_logo aún
  // existen. Esta verificación es liviana y mantiene el API autocurable.
  if (!(await columnaExiste('emisor_logo'))) {
    await pool.query('ALTER TABLE facturas ADD COLUMN emisor_logo LONGTEXT NULL AFTER emisor_correo');
  }
  if (!(await columnaExiste('referencia_externa'))) {
    await pool.query('ALTER TABLE facturas ADD COLUMN referencia_externa VARCHAR(100) NULL AFTER total_comprobante');
  }
  if (!(await columnaExiste('origen'))) {
    await pool.query('ALTER TABLE facturas ADD COLUMN origen VARCHAR(80) NULL AFTER referencia_externa');
  }
  if (!(await indiceExiste('idx_facturas_origen_referencia'))) {
    await pool.query('CREATE INDEX idx_facturas_origen_referencia ON facturas (origen, referencia_externa)');
  }
}

function normalizarTexto(valor, maximo) {
  const texto = String(valor ?? '').trim();
  return maximo ? texto.slice(0, maximo) : texto;
}

function normalizarLogo(valor) {
  if (valor === null || valor === undefined || valor === '') return null;
  const logo = String(valor).trim();
  const match = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=\s]+)$/i.exec(logo);
  if (!match) throw new Error('El logo debe ser PNG, JPG o WEBP en formato data URL.');

  const bytes = Buffer.from(match[2].replace(/\s+/g, ''), 'base64');
  if (!bytes.length) throw new Error('El logo enviado está vacío.');
  if (bytes.length > 500 * 1024) throw new Error('El logo excede 500 KB.');
  return logo;
}

function origenFactura(body) {
  return normalizarTexto(body.origen || body.source || body.sistema || '', 80) || null;
}

function referenciaFactura(body) {
  return normalizarTexto(body.referenciaExterna || body.referencia_externa || body.externalReference || '', 100) || null;
}

async function buscarPorReferencia(origen, referencia, connection = pool) {
  if (!origen || !referencia) return null;
  const [rows] = await connection.execute(
    'SELECT id FROM facturas WHERE origen = ? AND referencia_externa = ? ORDER BY created_at DESC LIMIT 1',
    [origen, referencia]
  );
  return rows[0]?.id || null;
}

async function crearFactura(req, res) {
  const body = req.body || {};
  const origen = origenFactura(body);
  const referenciaExterna = referenciaFactura(body);
  const idSolicitado = normalizarTexto(body.id || '', 20);
  const id = idSolicitado || `F-${randomUUID().slice(0, 8).toUpperCase()}`;

  if (!/^[A-Za-z0-9._-]{1,20}$/.test(id)) {
    return res.status(400).json({ error: 'Identificador de factura inválido' });
  }

  try {
    await asegurarEsquemaCompartido();
  } catch (error) {
    console.error('[schema] error:', error.message);
    return res.status(500).json({ error: 'No se pudo preparar el esquema de facturación', detalle: error.message });
  }

  const logoEmisor = normalizarLogo(body.emisor?.logoUrl || body.emisor?.logo_data || null);
  const conn = await pool.getConnection();
  const lockName = origen && referenciaExterna
    ? `factura:${Buffer.from(`${origen}|${referenciaExterna}`).toString('base64url').slice(0, 54)}`
    : null;

  try {
    if (lockName) {
      const [[lock]] = await conn.query('SELECT GET_LOCK(?, 8) AS adquirido', [lockName]);
      if (Number(lock?.adquirido) !== 1) {
        return res.status(503).set('Retry-After', '2').json({
          error: 'Capacidad temporal',
          detalle: 'La misma factura está siendo procesada. Intenta nuevamente en unos segundos.'
        });
      }

      const existenteId = await buscarPorReferencia(origen, referenciaExterna, conn);
      if (existenteId) {
        const existente = await obtenerFacturaPorId(existenteId);
        res.set('X-Idempotent-Replay', 'true');
        return res.status(200).json(existente);
      }
    }

    await conn.beginTransaction();

    await conn.execute(
      `INSERT INTO facturas (
        id, fecha_emision, moneda, condicion_venta, medio_pago,
        emisor_nombre, emisor_tipo_id, emisor_numero_id, emisor_correo, emisor_logo,
        receptor_nombre, receptor_tipo_id, receptor_numero_id, receptor_correo,
        total_gravado, total_exento, total_descuentos, total_impuesto, total_comprobante,
        referencia_externa, origen
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        new Date(body.fecha),
        body.moneda,
        body.condicionVenta,
        body.medioPago,
        normalizarTexto(body.emisor.nombre, 150),
        normalizarTexto(body.emisor.identificacion.tipo, 2),
        encrypt(normalizarTexto(body.emisor.identificacion.numero, 40)),
        normalizarTexto(body.emisor.correo, 150).toLowerCase(),
        logoEmisor,
        normalizarTexto(body.receptor.nombre, 150),
        body.receptor.identificacion?.tipo ? normalizarTexto(body.receptor.identificacion.tipo, 2) : null,
        body.receptor.identificacion?.numero ? encrypt(normalizarTexto(body.receptor.identificacion.numero, 40)) : null,
        normalizarTexto(body.receptor.correo, 150).toLowerCase(),
        Number(body.totales.totalGravado || 0),
        Number(body.totales.totalExento || 0),
        Number(body.totales.totalDescuentos || 0),
        Number(body.totales.totalImpuesto || 0),
        Number(body.totales.totalComprobante || 0),
        referenciaExterna,
        origen,
      ]
    );

    for (let index = 0; index < body.items.length; index += 1) {
      const item = body.items[index];
      await conn.execute(
        `INSERT INTO factura_items (
          factura_id, numero_linea, detalle, cantidad, precio_unitario,
          descuento, impuesto_tarifa, subtotal, monto_total_linea
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          Number(item.numeroLinea || index + 1),
          normalizarTexto(item.detalle, 255),
          Number(item.cantidad),
          Number(item.precioUnitario),
          Number(item.descuento || 0),
          Number(item.impuesto?.tarifa || 0),
          Number(item.subtotal),
          Number(item.montoTotalLinea),
        ]
      );
    }

    await conn.commit();
    return res.status(201).json(await obtenerFacturaPorId(id));
  } catch (err) {
    try { await conn.rollback(); } catch {}

    if (err?.code === 'ER_DUP_ENTRY' && origen && referenciaExterna) {
      const existenteId = await buscarPorReferencia(origen, referenciaExterna).catch(() => null);
      if (existenteId) {
        res.set('X-Idempotent-Replay', 'true');
        return res.status(200).json(await obtenerFacturaPorId(existenteId));
      }
    }

    console.error('[crearFactura] error:', err.message);
    return res.status(500).json({ error: 'No se pudo crear la factura', detalle: err.message });
  } finally {
    if (lockName) {
      try { await conn.query('SELECT RELEASE_LOCK(?)', [lockName]); } catch {}
    }
    conn.release();
  }
}

async function actualizarLogoFactura(req, res) {
  const id = normalizarTexto(req.params.id, 20);
  if (!id) return res.status(400).json({ error: 'Factura inválida' });

  try {
    await asegurarEsquemaCompartido();
    const logoEmisor = normalizarLogo(req.body?.logoUrl ?? req.body?.logo_data ?? null);
    const [result] = await pool.execute('UPDATE facturas SET emisor_logo = ? WHERE id = ?', [logoEmisor, id]);
    if (!result.affectedRows) return res.status(404).json({ error: 'Factura no encontrada' });
    return res.json({ id, logoActualizado: Boolean(logoEmisor) });
  } catch (err) {
    console.error('[actualizarLogoFactura] error:', err.message);
    return res.status(400).json({ error: 'No se pudo actualizar el logo', detalle: err.message });
  }
}

async function listarFacturas(req, res) {
  try {
    await asegurarEsquemaCompartido();
    const condiciones = [];
    const valores = [];

    const origen = normalizarTexto(req.query.origen || '', 80);
    const referencia = normalizarTexto(req.query.referenciaExterna || req.query.referencia_externa || '', 100);
    const desde = normalizarTexto(req.query.desde || '', 10);
    const hasta = normalizarTexto(req.query.hasta || '', 10);
    const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 50, 1), 200);
    const offset = Math.max(Number.parseInt(req.query.offset, 10) || 0, 0);

    if (origen) { condiciones.push('origen = ?'); valores.push(origen); }
    if (referencia) { condiciones.push('referencia_externa = ?'); valores.push(referencia); }
    if (/^\d{4}-\d{2}-\d{2}$/.test(desde)) { condiciones.push('DATE(fecha_emision) >= ?'); valores.push(desde); }
    if (/^\d{4}-\d{2}-\d{2}$/.test(hasta)) { condiciones.push('DATE(fecha_emision) <= ?'); valores.push(hasta); }

    const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';
    const [rows] = await pool.query(
      `SELECT id, fecha_emision, moneda, emisor_nombre, emisor_correo,
              receptor_nombre, receptor_correo, total_comprobante,
              referencia_externa, origen, created_at, updated_at
       FROM facturas
       ${where}
       ORDER BY fecha_emision DESC, created_at DESC
       LIMIT ? OFFSET ?`,
      [...valores, limit, offset]
    );
    const [[count]] = await pool.query(`SELECT COUNT(*) AS total FROM facturas ${where}`, valores);

    return res.json({
      items: rows.map((row) => ({
        id: row.id,
        fecha: row.fecha_emision,
        moneda: row.moneda,
        emisorNombre: row.emisor_nombre,
        emisorCorreo: row.emisor_correo,
        receptorNombre: row.receptor_nombre,
        receptorCorreo: row.receptor_correo,
        totalComprobante: Number(row.total_comprobante || 0),
        referenciaExterna: row.referencia_externa || null,
        origen: row.origen || null,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      })),
      total: Number(count?.total || 0),
      limit,
      offset,
    });
  } catch (err) {
    console.error('[listarFacturas] error:', err.message);
    return res.status(500).json({ error: 'No se pudieron consultar las facturas', detalle: err.message });
  }
}

async function consultarFactura(req, res) {
  try {
    const factura = await obtenerFacturaPorId(req.params.id);
    if (!factura) return res.status(404).json({ error: 'Factura no encontrada' });
    return res.json(factura);
  } catch (err) {
    console.error('[consultarFactura] error:', err.message);
    return res.status(500).json({ error: 'Error al consultar la factura' });
  }
}

async function obtenerFacturaPorId(id) {
  await asegurarEsquemaCompartido();
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
    origen: f.origen || null,
    referenciaExterna: f.referencia_externa || null,
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
    createdAt: f.created_at || null,
    updatedAt: f.updated_at || null,
  };
}

module.exports = {
  crearFactura,
  consultarFactura,
  listarFacturas,
  actualizarLogoFactura,
  obtenerFacturaPorId,
  asegurarEsquemaCompartido,
};
