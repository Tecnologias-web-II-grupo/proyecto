function texto(valor, fallback = 'No indicado') {
  if (valor === undefined || valor === null || valor === '') return fallback;
  return String(valor);
}

function fecha(valor) {
  if (!valor) return 'No indicada';
  const d = new Date(valor);
  if (Number.isNaN(d.getTime())) return texto(valor);
  return new Intl.DateTimeFormat('es-CR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(d);
}

function dinero(valor, moneda = 'CRC') {
  const numero = Number(valor || 0);
  const codigo = String(moneda || 'CRC').toUpperCase();
  try {
    return new Intl.NumberFormat('es-CR', {
      style: 'currency', currency: codigo, minimumFractionDigits: 2,
    }).format(numero);
  } catch {
    return `${codigo} ${numero.toFixed(2)}`;
  }
}

function iniciales(nombre) {
  return texto(nombre, 'F').split(/\s+/).filter(Boolean).slice(0, 2).map((x) => x[0]).join('').toUpperCase();
}

const IDENTIFICACIONES = { '01':'Persona física','02':'Persona jurídica','03':'DIMEX','04':'NITE','05':'Extranjero no domiciliado','06':'No contribuyente' };
const CONDICIONES = { '01':'Contado','02':'Crédito','03':'Consignación','04':'Apartado','05':'Arrendamiento con opción de compra','06':'Arrendamiento financiero','07':'Cobro a favor de tercero','08':'Servicios al Estado a crédito','09':'Servicios al Estado de contado','10':'Venta a crédito IVA hasta 90 días','11':'Pago de venta a crédito IVA hasta 90 días','12':'Mercancía no nacionalizada','13':'Bienes usados no contribuyente','14':'Arrendamiento operativo','15':'Arrendamiento financiero','99':'Otros' };
const PAGOS = { '01':'Efectivo','02':'Tarjeta','03':'Cheque','04':'Transferencia/depósito','05':'Recaudado por terceros','06':'SINPE Móvil','07':'Plataforma digital','99':'Otros' };

function codigo(mapa, valor) {
  const key = texto(valor, '');
  return mapa[key] ? `${mapa[key]} · ${key}` : texto(valor);
}

function proveedorTexto(valor) {
  if (!valor) return null;
  if (typeof valor === 'string') return valor;
  const nombre = valor.nombre || valor.razonSocial || valor.proveedor || '';
  const id = valor.identificacion?.numero || valor.identificacion || valor.numeroIdentificacion || '';
  return [nombre, id && `ID ${id}`].filter(Boolean).join(' · ') || null;
}

function otrosTexto(factura) {
  const raw = factura?.otros;
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.filter(Boolean).map((o) => typeof o === 'string' ? o : (o.texto || o.contenido || o.observaciones || o.informacionAdicional || JSON.stringify(o)));
  if (typeof raw === 'object') {
    const salida = [];
    if (raw.observaciones) salida.push(`Observaciones: ${raw.observaciones}`);
    if (raw.informacionAdicional) salida.push(`Información adicional: ${raw.informacionAdicional}`);
    if (raw.texto) salida.push(raw.texto);
    return salida;
  }
  return [String(raw)];
}

module.exports = { texto, fecha, dinero, iniciales, IDENTIFICACIONES, CONDICIONES, PAGOS, codigo, proveedorTexto, otrosTexto };
