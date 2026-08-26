const React = require('react');

function texto(v, fallback = '—') {
  if (v === undefined || v === null || String(v).trim() === '') return fallback;
  return String(v);
}

function fecha(v) {
  if (!v) return '—';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return texto(v);
  return new Intl.DateTimeFormat('es-CR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(d);
}

function dinero(v, moneda = 'CRC') {
  const n = Number(v || 0);
  const c = String(moneda || 'CRC').toUpperCase();
  try {
    return new Intl.NumberFormat('es-CR', { style: 'currency', currency: c, minimumFractionDigits: 2 }).format(n);
  } catch {
    return `${c} ${n.toFixed(2)}`;
  }
}

function ini(nombre) {
  return texto(nombre, 'F').split(/\s+/).filter(Boolean).slice(0, 2).map((x) => x[0]).join('').toUpperCase();
}

const ID = {
  '01': 'Persona física', '02': 'Persona jurídica', '03': 'DIMEX', '04': 'NITE',
  '05': 'Extranjero no domiciliado', '06': 'No contribuyente'
};
const CV = {
  '01': 'Contado', '02': 'Crédito', '03': 'Consignación', '04': 'Apartado',
  '05': 'Arrendamiento con opción de compra', '06': 'Arrendamiento financiero',
  '07': 'Cobro a favor de tercero', '08': 'Servicios al Estado a crédito',
  '09': 'Servicios al Estado de contado', '10': 'Venta a crédito IVA hasta 90 días',
  '11': 'Pago de venta a crédito IVA hasta 90 días', '12': 'Mercancía no nacionalizada',
  '13': 'Bienes usados no contribuyente', '14': 'Arrendamiento operativo',
  '15': 'Arrendamiento financiero', '99': 'Otros'
};
const MP = {
  '01': 'Efectivo', '02': 'Tarjeta', '03': 'Cheque', '04': 'Transferencia/depósito',
  '05': 'Recaudado por terceros', '06': 'SINPE Móvil', '07': 'Plataforma digital', '99': 'Otros'
};

function cod(map, v) {
  const k = texto(v, '');
  return map[k] ? `${map[k]} · ${k}` : texto(v);
}

function proveedorTexto(v) {
  if (!v) return '—';
  if (typeof v === 'string') return texto(v);
  const nombre = v.nombre || v.razonSocial || v.proveedor || '';
  const id = v.identificacion?.numero || v.identificacion || v.numeroIdentificacion || '';
  return [nombre, id && `ID ${id}`].filter(Boolean).join(' · ') || '—';
}

function primerImpuesto(item) {
  if (Array.isArray(item?.impuestos) && item.impuestos.length) return item.impuestos[0] || {};
  return item?.impuesto || {};
}

function listaCorreos(p) {
  const extras = [
    ...(Array.isArray(p?.correosAdicionales) ? p.correosAdicionales : []),
    ...(Array.isArray(p?.correos) ? p.correos : [])
  ].filter(Boolean);
  return Array.from(new Set(extras)).join(', ') || '—';
}

function telefonoTexto(p) {
  const t = p?.telefono || {};
  return t.numero ? `${t.codigoPais ? `+${t.codigoPais} ` : ''}${t.numero}` : '—';
}

function ubicacionTexto(p) {
  const u = p?.ubicacion || {};
  return [
    u.provincia && `Provincia ${u.provincia}`,
    u.canton && `Cantón ${u.canton}`,
    u.distrito && `Distrito ${u.distrito}`,
    u.barrio && `Barrio ${u.barrio}`
  ].filter(Boolean).join(' · ') || '—';
}

function D({ l, v, mono = false, wide = false }) {
  return React.createElement('div', { className: `datum${wide ? ' wide' : ''}` },
    React.createElement('span', { className: 'label' }, l),
    React.createElement('strong', { className: mono ? 'mono' : '' }, texto(v))
  );
}

function SectionTitle({ kicker, title, compact = false }) {
  return React.createElement('div', { className: `section-title${compact ? ' compact' : ''}` },
    React.createElement('span', null, kicker),
    React.createElement('h2', null, title)
  );
}

function Person({ title, p = {}, side }) {
  return React.createElement('section', { className: `person-card ${side}` },
    React.createElement(SectionTitle, { kicker: side === 'issuer' ? 'QUIEN EMITE' : 'QUIEN RECIBE', title }),
    React.createElement('div', { className: 'grid two person-core-grid' },
      React.createElement(D, { l: 'Nombre o razón social', v: p.nombre }),
      React.createElement(D, { l: 'Identificación', v: p.identificacion?.numero, mono: true }),
      React.createElement(D, { l: 'Tipo de identificación', v: cod(ID, p.identificacion?.tipo) }),
      React.createElement(D, { l: 'Correo electrónico', v: p.correo })
    )
  );
}

function PartyExtraCard({ title, p = {}, side }) {
  const u = p.ubicacion || {};
  return React.createElement('section', { className: `party-extra-card ${side}` },
    React.createElement('div', { className: 'party-extra-head' },
      React.createElement('span', null, side === 'issuer' ? 'EMISOR · DATOS COMPLEMENTARIOS' : 'CLIENTE · DATOS COMPLEMENTARIOS'),
      React.createElement('h3', null, title)
    ),
    React.createElement('div', { className: 'grid two party-extra-grid' },
      React.createElement(D, { l: 'Nombre comercial', v: p.nombreComercial }),
      React.createElement(D, { l: 'Teléfono', v: telefonoTexto(p) }),
      React.createElement(D, { l: 'Actividad económica', v: p.actividadEconomica }),
      React.createElement(D, { l: 'Correos adicionales', v: listaCorreos(p) }),
      React.createElement(D, { l: 'Registro fiscal / bebidas', v: p.registroBebidasAlcoholicas }),
      React.createElement(D, { l: 'Ubicación administrativa', v: ubicacionTexto(p), wide: true }),
      React.createElement(D, { l: 'Provincia', v: u.provincia }),
      React.createElement(D, { l: 'Cantón', v: u.canton }),
      React.createElement(D, { l: 'Distrito', v: u.distrito }),
      React.createElement(D, { l: 'Barrio', v: u.barrio }),
      React.createElement(D, { l: 'Otras señas', v: u.otrasSenas || u.otrasSenasExtranjero, wide: true })
    )
  );
}

function Header({ f }) {
  const e = f.emisor || {};
  const logo = e.logoUrl || e.logoUrlBlanco;
  const logoPosicion = ['left', 'center', 'right'].includes(String(e.logoPosicion || '').toLowerCase())
    ? String(e.logoPosicion).toLowerCase() : 'left';

  return React.createElement(React.Fragment, null,
    React.createElement('header', { className: `hero hero-logo-${logoPosicion}` },
      React.createElement('div', { className: `brand brand-logo-${logoPosicion}` },
        React.createElement('div', { className: 'brand-logo-wrap' },
          logo
            ? React.createElement('div', { className: 'logo' }, React.createElement('img', { src: logo, alt: 'Logo del emisor' }))
            : React.createElement('div', { className: 'logo fallback' }, ini(e.nombre))
        ),
        React.createElement('div', { className: 'brand-text' },
          React.createElement('span', { className: 'overline' }, 'COMPROBANTE DE INGRESO'),
          React.createElement('h1', null, texto(e.nombre, 'Emisor no indicado')),
          React.createElement('p', null, texto(e.correo))
        )
      ),
      React.createElement('div', { className: 'number' },
        React.createElement('span', null, 'FACTURA'),
        React.createElement('strong', { className: 'mono' }, texto(f.id, 'Sin número')),
        React.createElement('em', null, 'PDF · SOLO LECTURA')
      )
    ),
    React.createElement('section', { className: 'meta' },
      React.createElement(D, { l: 'Fecha de emisión', v: fecha(f.fecha) }),
      React.createElement(D, { l: 'Moneda', v: f.moneda }),
      React.createElement(D, { l: 'Condición de venta', v: cod(CV, f.condicionVenta) }),
      React.createElement(D, { l: 'Medio de pago', v: cod(MP, f.medioPago) }),
      React.createElement(D, { l: 'Plazo de crédito', v: (f.plazoCreditoDias ?? f.plazoCredito) != null ? `${f.plazoCreditoDias ?? f.plazoCredito} días` : '—' }),
      React.createElement(D, { l: 'Tipo de cambio', v: f.totales?.tipoCambio }),
      React.createElement(D, { l: 'Proveedor de sistemas', v: proveedorTexto(f.proveedorSistemas) }),
      React.createElement(D, { l: 'Referencia externa', v: f.referenciaExterna })
    )
  );
}

function Items({ f }) {
  const items = Array.isArray(f.items) && f.items.length ? f.items : [{}];
  return React.createElement('section', { className: 'block' },
    React.createElement(SectionTitle, { kicker: 'DETALLE DEL COMPROBANTE', title: 'Conceptos facturados' }),
    React.createElement('div', { className: 'table-wrap' },
      React.createElement('table', null,
        React.createElement('thead', null,
          React.createElement('tr', null,
            ['#', 'CAByS', 'Descripción', 'Cant.', 'Unidad', 'Precio', 'Desc.', 'IVA', 'Subtotal', 'Total'].map((x) => React.createElement('th', { key: x }, x))
          )
        ),
        React.createElement('tbody', null,
          items.map((it, i) => {
            const imp = primerImpuesto(it);
            return React.createElement('tr', { key: i },
              React.createElement('td', { className: 'center' }, it.numeroLinea ?? i + 1),
              React.createElement('td', { className: 'mono' }, texto(it.codigoCabys)),
              React.createElement('td', null, texto(it.detalle)),
              React.createElement('td', { className: 'center' }, texto(it.cantidad)),
              React.createElement('td', { className: 'center' }, texto(it.unidadMedida)),
              React.createElement('td', { className: 'money' }, dinero(it.precioUnitario, f.moneda)),
              React.createElement('td', { className: 'money' }, dinero(it.descuento, f.moneda)),
              React.createElement('td', { className: 'center' }, `${Number(imp.tarifa || 0)}%`),
              React.createElement('td', { className: 'money' }, dinero(it.subtotal, f.moneda)),
              React.createElement('td', { className: 'money strong' }, dinero(it.montoTotalLinea, f.moneda))
            );
          })
        )
      )
    ),
    React.createElement('div', { className: 'line-details-title' }, 'INFORMACIÓN FISCAL Y COMERCIAL POR LÍNEA'),
    ...items.map((it, i) => {
      const impuestos = Array.isArray(it.impuestos) && it.impuestos.length ? it.impuestos : [primerImpuesto(it)];
      const imp = impuestos[0] || {};
      const descuentos = Array.isArray(it.descuentos) ? it.descuentos : [];
      const desc = descuentos[0] || {};
      const comerciales = Array.isArray(it.codigosComerciales) ? it.codigosComerciales : [];
      const comercial = comerciales[0] || {};
      const ex = imp.exoneracion || {};
      return React.createElement('div', { className: 'line-extra', key: `detalle-${i}` },
        React.createElement('h3', null, `Línea ${it.numeroLinea ?? i + 1}`),
        React.createElement('div', { className: 'grid four' },
          React.createElement(D, { l: 'Partida arancelaria', v: it.partidaArancelaria }),
          React.createElement(D, { l: 'Unidad comercial', v: it.unidadMedidaComercial }),
          React.createElement(D, { l: 'Tipo de transacción', v: it.tipoTransaccion }),
          React.createElement(D, { l: 'VIN / Serie', v: it.numeroVinSerie }),
          React.createElement(D, { l: 'Registro medicamento', v: it.registroMedicamento }),
          React.createElement(D, { l: 'Forma farmacéutica', v: it.formaFarmaceutica }),
          React.createElement(D, { l: 'Base imponible', v: dinero(it.baseImponible, f.moneda) }),
          React.createElement(D, { l: 'Impuesto asumido emisor', v: dinero(it.impuestoAsumidoEmisor, f.moneda) }),
          React.createElement(D, { l: 'Código comercial tipo', v: comercial.tipo }),
          React.createElement(D, { l: 'Código comercial', v: comercial.codigo }),
          React.createElement(D, { l: 'Descuento código', v: desc.codigo }),
          React.createElement(D, { l: 'Naturaleza descuento', v: desc.naturaleza }),
          React.createElement(D, { l: 'Impuesto código', v: imp.codigo }),
          React.createElement(D, { l: 'Código tarifa IVA', v: imp.codigoTarifaIVA }),
          React.createElement(D, { l: 'Tarifa', v: `${Number(imp.tarifa || 0)}%` }),
          React.createElement(D, { l: 'Monto impuesto', v: dinero(imp.monto, f.moneda) }),
          React.createElement(D, { l: 'Exoneración documento', v: ex.numeroDocumento }),
          React.createElement(D, { l: 'Exoneración institución', v: ex.nombreInstitucion }),
          React.createElement(D, { l: 'Exoneración porcentaje', v: ex.porcentajeCompra != null ? `${ex.porcentajeCompra}%` : '—' }),
          React.createElement(D, { l: 'Detalle surtido / paquete', v: Array.isArray(it.detalleSurtido) && it.detalleSurtido.length ? `${it.detalleSurtido.length} componente(s)` : '—' })
        )
      );
    })
  );
}

function PartyExtended({ f }) {
  return React.createElement('section', { className: 'block party-extended' },
    React.createElement(SectionTitle, { kicker: 'INFORMACIÓN AMPLIADA DE LAS PARTES', title: 'Datos complementarios del emisor y del cliente' }),
    React.createElement('div', { className: 'party-extended-grid' },
      React.createElement(PartyExtraCard, { title: texto(f.emisor?.nombre, 'Datos del emisor'), p: f.emisor || {}, side: 'issuer' }),
      React.createElement(PartyExtraCard, { title: texto(f.receptor?.nombre, 'Datos del cliente'), p: f.receptor || {}, side: 'client' })
    )
  );
}

function obtenerOtros(f) {
  const raw = f?.otros;
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.filter(Boolean).map((o) => typeof o === 'string' ? o : (o.texto || o.contenido || o.observaciones || o.informacionAdicional || JSON.stringify(o)));
  if (typeof raw === 'object') {
    const out = [];
    if (raw.observaciones) out.push(`Observaciones: ${raw.observaciones}`);
    if (raw.informacionAdicional) out.push(`Información adicional: ${raw.informacionAdicional}`);
    if (raw.texto) out.push(raw.texto);
    return out;
  }
  return [String(raw)];
}

function Summary({ f }) {
  const t = f.totales || {};
  const rows = [
    ['Servicios gravados', t.totalServiciosGravados ?? t.totalServGravados],
    ['Servicios exentos', t.totalServiciosExentos ?? t.totalServExentos],
    ['Servicios exonerados', t.totalServiciosExonerados ?? t.totalServExonerados],
    ['Servicios no sujetos', t.totalServiciosNoSujetos ?? t.totalServNoSujetos],
    ['Mercancías gravadas', t.totalMercanciasGravadas],
    ['Mercancías exentas', t.totalMercanciasExentas],
    ['Mercancías exoneradas', t.totalMercanciasExoneradas],
    ['Mercancías no sujetas', t.totalMercanciasNoSujetas],
    ['Total gravado', t.totalGravado],
    ['Total exento', t.totalExento],
    ['Total exonerado', t.totalExonerado],
    ['Total no sujeto', t.totalNoSujeto],
    ['Total venta', t.totalVenta],
    ['Descuentos', t.totalDescuentos],
    ['Venta neta', t.totalVentaNeta],
    ['Impuestos', t.totalImpuesto],
    ['IVA devuelto', t.totalIVADevuelto],
    ['Otros cargos', t.totalOtrosCargos]
  ];
  const medios = Array.isArray(t.mediosPago) ? t.mediosPago : [];
  const refs = Array.isArray(f.referencias) ? f.referencias : [];
  const cargos = Array.isArray(f.otrosCargos) ? f.otrosCargos : [];
  const otros = obtenerOtros(f);
  const condicion = f.detalleCondicionVenta || f.detalleCondicionVentaOtro;

  return React.createElement(React.Fragment, null,
    React.createElement('section', { className: 'block summary-shell' },
      React.createElement('div', { className: 'summary-left' },
        React.createElement(SectionTitle, { kicker: 'INFORMACIÓN DEL COMPROBANTE', title: 'Datos y trazabilidad del comprobante', compact: true }),
        React.createElement('div', { className: 'grid two info-grid info-grid-slim' },
          React.createElement(D, { l: 'Perfil de validación', v: f.perfilValidacion || 'Visual completa' }),
          React.createElement(D, { l: 'Número de factura', v: f.id, mono: true }),
          React.createElement(D, { l: 'Sistema de origen', v: f.origen }),
          React.createElement(D, { l: 'Referencia externa', v: f.referenciaExterna }),
          React.createElement(D, { l: 'Condición / detalle', v: condicion }),
          React.createElement(D, { l: 'Proveedor de sistemas', v: proveedorTexto(f.proveedorSistemas) }),
          React.createElement(D, { l: 'Clave electrónica', v: f.claveElectronica, mono: true }),
          React.createElement(D, { l: 'Consecutivo electrónico', v: f.consecutivoElectronico, mono: true }),
          React.createElement(D, { l: 'Formato', v: 'PDF de solo lectura' }),
          React.createElement(D, { l: 'Estado del documento', v: f.estadoDocumento || f.estado }),
          React.createElement(D, { l: 'Estado XML', v: f.estadoXml }),
          React.createElement(D, { l: 'Estado Hacienda', v: f.estadoHacienda })
        )
      ),
      React.createElement('div', { className: 'summary-right' },
        React.createElement(SectionTitle, { kicker: 'RESUMEN DE IMPORTES', title: 'Totales del comprobante', compact: true }),
        React.createElement('div', { className: 'totals totals-large' },
          React.createElement('div', { className: 'totals-grid' },
            ...rows.map(([l, v]) => React.createElement('div', { className: 'total-row', key: l },
              React.createElement('span', null, l), React.createElement('strong', null, dinero(v, f.moneda))
            ))
          ),
          React.createElement('div', { className: 'grand' },
            React.createElement('span', null, 'TOTAL COMPROBANTE'),
            React.createElement('strong', null, dinero(t.totalComprobante, f.moneda))
          )
        )
      )
    ),
    React.createElement('section', { className: 'block complementary' },
      React.createElement(SectionTitle, { kicker: 'INFORMACIÓN COMPLEMENTARIA', title: 'Medios de pago, referencias y observaciones' }),
      React.createElement('div', { className: 'complement-grid' },
        React.createElement('div', { className: 'complement-card' },
          React.createElement('h3', null, 'Medios de pago'),
          medios.length
            ? medios.map((m, i) => React.createElement('p', { key: `m${i}` }, `${cod(MP, m.tipo)} · ${dinero(m.total ?? m.monto, f.moneda)}`))
            : React.createElement('p', null, `${cod(MP, f.medioPago)} · ${dinero(t.totalComprobante, f.moneda)}`)
        ),
        React.createElement('div', { className: 'complement-card' },
          React.createElement('h3', null, 'Referencias'),
          refs.length
            ? refs.map((r, i) => React.createElement('p', { key: `r${i}` }, `${texto(r.tipoDocumento)} · ${texto(r.numero || r.numeroDocumento)} · ${fecha(r.fechaEmision)} · ${texto(r.razon)}`))
            : React.createElement('p', null, '—')
        ),
        React.createElement('div', { className: 'complement-card' },
          React.createElement('h3', null, 'Otros cargos'),
          cargos.length
            ? cargos.map((c, i) => React.createElement('p', { key: `c${i}` }, `${texto(c.detalle || c.tipoDocumento)} · ${dinero(c.monto, f.moneda)}`))
            : React.createElement('p', null, '—')
        ),
        React.createElement('div', { className: 'complement-card' },
          React.createElement('h3', null, 'Observaciones y datos adicionales'),
          otros.length
            ? otros.map((o, i) => React.createElement('p', { key: `o${i}` }, o))
            : React.createElement('p', null, '—')
        )
      )
    )
  );
}

function FacturaDocument({ factura: f }) {
  return React.createElement('main', { className: 'invoice' },
    React.createElement(Header, { f }),
    React.createElement('div', { className: 'content' },
      React.createElement('div', { className: 'people' },
        React.createElement(Person, { title: 'Datos del emisor', p: f.emisor || {}, side: 'issuer' }),
        React.createElement(Person, { title: 'Datos del cliente', p: f.receptor || {}, side: 'client' })
      ),
      React.createElement(Items, { f }),
      React.createElement(PartyExtended, { f }),
      React.createElement(Summary, { f })
    ),
    React.createElement('footer', null,
      React.createElement('span', null, texto(f.emisor?.nombre, 'Emisor')),
      React.createElement('span', { className: 'mono' }, texto(f.id)),
      React.createElement('span', null, 'Comprobante PDF de solo lectura')
    )
  );
}

module.exports = { FacturaDocument, formatoMoneda: dinero, formatearFecha: fecha };
