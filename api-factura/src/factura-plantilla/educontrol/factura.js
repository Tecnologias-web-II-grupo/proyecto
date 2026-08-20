const React = require('react');

function texto(v, fallback = 'No indicado') {
  if (v === undefined || v === null || v === '') return fallback;
  return String(v);
}
function fecha(v) {
  if (!v) return 'No indicada';
  const d = new Date(v); if (Number.isNaN(d.getTime())) return texto(v);
  return new Intl.DateTimeFormat('es-CR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(d);
}
function dinero(v, moneda = 'CRC') {
  const n = Number(v || 0); const c = String(moneda || 'CRC').toUpperCase();
  try { return new Intl.NumberFormat('es-CR', { style: 'currency', currency: c, minimumFractionDigits: 2 }).format(n); }
  catch { return `${c} ${n.toFixed(2)}`; }
}
function ini(nombre) { return texto(nombre, 'F').split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join('').toUpperCase(); }

const ID = { '01':'Persona física','02':'Persona jurídica','03':'DIMEX','04':'NITE','05':'Extranjero no domiciliado','06':'No contribuyente' };
const CV = { '01':'Contado','02':'Crédito','03':'Consignación','04':'Apartado','05':'Arrendamiento con opción de compra','06':'Arrendamiento financiero','07':'Cobro a favor de tercero','08':'Servicios al Estado a crédito','09':'Servicios al Estado de contado','10':'Venta a crédito IVA hasta 90 días','11':'Pago de venta a crédito IVA hasta 90 días','12':'Mercancía no nacionalizada','13':'Bienes usados no contribuyente','14':'Arrendamiento operativo','15':'Arrendamiento financiero','99':'Otros' };
const MP = { '01':'Efectivo','02':'Tarjeta','03':'Cheque','04':'Transferencia/depósito','05':'Recaudado por terceros','06':'SINPE Móvil','07':'Plataforma digital','99':'Otros' };
function cod(map, v) { const k=texto(v,''); return map[k] ? `${map[k]} · ${k}` : texto(v); }
function proveedorTexto(v){ if(!v) return null; if(typeof v==='string') return v; const nombre=v.nombre||v.razonSocial||v.proveedor||''; const id=v.identificacion?.numero||v.identificacion||v.numeroIdentificacion||''; return [nombre,id&&`ID ${id}`].filter(Boolean).join(' · ') || null; }

function D({l,v,mono=false}) { return React.createElement('div',{className:'datum'},React.createElement('span',{className:'label'},l),React.createElement('strong',{className:mono?'mono':''},texto(v))); }
function SectionTitle({kicker,title}) { return React.createElement('div',{className:'section-title'},React.createElement('span',null,kicker),React.createElement('h2',null,title)); }
function Person({title,p,side}) {
  const u=p?.ubicacion||{}, t=p?.telefono||{};
  const extra=[
    ['Nombre comercial',p?.nombreComercial],['Actividad económica',p?.actividadEconomica],['Registro fiscal bebidas',p?.registroBebidasAlcoholicas],
    ['Teléfono',t?.numero ? `${t.codigoPais?`+${t.codigoPais} `:''}${t.numero}`:null],
    ['Ubicación',[u.provincia&&`Prov. ${u.provincia}`,u.canton&&`Cant. ${u.canton}`,u.distrito&&`Dist. ${u.distrito}`,u.barrio&&`Barrio ${u.barrio}`].filter(Boolean).join(' · ')],
    ['Otras señas',u.otrasSenas||u.otrasSenasExtranjero],['Correos adicionales',Array.isArray(p?.correos)?p.correos.join(', '):null]
  ].filter(([,v])=>v);
  return React.createElement('section',{className:`person-card ${side}`},
    React.createElement(SectionTitle,{kicker:side==='issuer'?'QUIEN EMITE':'QUIEN RECIBE',title}),
    React.createElement('div',{className:'grid two'},
      React.createElement(D,{l:'Nombre o razón social',v:p?.nombre}), React.createElement(D,{l:'Identificación',v:p?.identificacion?.numero,mono:true}),
      React.createElement(D,{l:'Tipo de identificación',v:cod(ID,p?.identificacion?.tipo)}), React.createElement(D,{l:'Correo electrónico',v:p?.correo}),
      ...extra.map(([l,v])=>React.createElement(D,{key:l,l,v}))
    )
  );
}
function Header({f}) {
  const e=f.emisor||{}, logo=e.logoUrl;
  return React.createElement(React.Fragment,null,
    React.createElement('header',{className:'hero'},
      React.createElement('div',{className:'brand'}, logo?React.createElement('div',{className:'logo'},React.createElement('img',{src:logo,alt:'Logo'})):React.createElement('div',{className:'logo fallback'},ini(e.nombre)),
        React.createElement('div',null,React.createElement('span',{className:'overline'},'COMPROBANTE DE INGRESO'),React.createElement('h1',null,texto(e.nombre,'Emisor')),React.createElement('p',null,texto(e.correo,'')))) ,
      React.createElement('div',{className:'number'},React.createElement('span',null,'FACTURA'),React.createElement('strong',{className:'mono'},texto(f.id,'Sin número')),React.createElement('em',null,'PDF · SOLO LECTURA'))
    ),
    React.createElement('section',{className:'meta'},
      React.createElement(D,{l:'Fecha de emisión',v:fecha(f.fecha)}),React.createElement(D,{l:'Moneda',v:f.moneda}),
      React.createElement(D,{l:'Condición de venta',v:cod(CV,f.condicionVenta)}),React.createElement(D,{l:'Medio de pago',v:cod(MP,f.medioPago)}),
      (f.plazoCreditoDias??f.plazoCredito)!==undefined&&(f.plazoCreditoDias??f.plazoCredito)!==null?React.createElement(D,{l:'Plazo de crédito',v:`${f.plazoCreditoDias??f.plazoCredito} días`}):null,
      f.proveedorSistemas?React.createElement(D,{l:'Proveedor de sistemas',v:proveedorTexto(f.proveedorSistemas)}):null,
      f.totales?.tipoCambio!==undefined?React.createElement(D,{l:'Tipo de cambio',v:f.totales.tipoCambio}):null
    )
  );
}
function Items({f}) {
  const items=Array.isArray(f.items)?f.items:[];
  return React.createElement('section',{className:'block'},
    React.createElement(SectionTitle,{kicker:'DETALLE DEL COMPROBANTE',title:'Conceptos facturados'}),
    React.createElement('div',{className:'table-wrap'},React.createElement('table',null,
      React.createElement('thead',null,React.createElement('tr',null,['#','CAByS','Descripción','Cant.','Unidad','Precio','Desc.','IVA','Subtotal','Total'].map(x=>React.createElement('th',{key:x},x)))),
      React.createElement('tbody',null,items.map((it,i)=>React.createElement('tr',{key:i},
        React.createElement('td',{className:'center'},it.numeroLinea??i+1),React.createElement('td',{className:'mono'},texto(it.codigoCabys,'—')),
        React.createElement('td',null,texto(it.detalle)),React.createElement('td',{className:'center'},texto(it.cantidad)),React.createElement('td',{className:'center'},texto(it.unidadMedida,'—')),
        React.createElement('td',{className:'money'},dinero(it.precioUnitario,f.moneda)),React.createElement('td',{className:'money'},dinero(it.descuento,f.moneda)),
        React.createElement('td',{className:'center'},`${Number((it.impuestos?.[0]?.tarifa ?? it.impuesto?.tarifa) || 0)}%`),React.createElement('td',{className:'money'},dinero(it.subtotal,f.moneda)),React.createElement('td',{className:'money strong'},dinero(it.montoTotalLinea,f.moneda))
      )))
    )),
    items.map((it,i)=>{
      const desc=Array.isArray(it.descuentos)?it.descuentos:[]; const imps=Array.isArray(it.impuestos)&&it.impuestos.length?it.impuestos:(it.impuesto?[it.impuesto]:[]);
      const comerciales=Array.isArray(it.codigosComerciales)?it.codigosComerciales:[];
      const show=it.partidaArancelaria||comerciales.length||it.unidadMedidaComercial||it.tipoTransaccion||it.numeroVinSerie||it.registroMedicamento||it.formaFarmaceutica||(Array.isArray(it.detalleSurtido)&&it.detalleSurtido.length)||it.baseImponible!==undefined||desc.length||imps.some(x=>x.codigo||x.codigoTarifaIVA||x.monto!==undefined||x.exoneracion)||it.impuestoAsumidoEmisor!==undefined;
      if(!show)return null;
      return React.createElement('div',{className:'line-extra',key:`e${i}`},
        React.createElement('h3',null,`Información complementaria · línea ${it.numeroLinea??i+1}`),
        React.createElement('div',{className:'grid four'},
          it.partidaArancelaria&&React.createElement(D,{l:'Partida arancelaria',v:it.partidaArancelaria}),it.unidadMedidaComercial&&React.createElement(D,{l:'Unidad comercial',v:it.unidadMedidaComercial}),
          it.tipoTransaccion&&React.createElement(D,{l:'Tipo de transacción',v:it.tipoTransaccion}),it.numeroVinSerie&&React.createElement(D,{l:'VIN / Serie',v:it.numeroVinSerie}),
          it.registroMedicamento&&React.createElement(D,{l:'Registro de medicamento',v:it.registroMedicamento}),it.formaFarmaceutica&&React.createElement(D,{l:'Forma farmacéutica',v:it.formaFarmaceutica}),
          it.baseImponible!==undefined&&React.createElement(D,{l:'Base imponible',v:dinero(it.baseImponible,f.moneda)}),it.impuestoAsumidoEmisor!==undefined&&React.createElement(D,{l:'Impuesto asumido emisor',v:dinero(it.impuestoAsumidoEmisor,f.moneda)})
        ),
        comerciales.length?React.createElement('p',{className:'small'},`Códigos comerciales: ${comerciales.map(c=>`${c.tipo||'—'}:${c.codigo||'—'}`).join(' · ')}`):null,
        Array.isArray(it.detalleSurtido)&&it.detalleSurtido.length?React.createElement('p',{className:'small'},`Componentes de surtido/paquete: ${it.detalleSurtido.map(c=>`${c.codigoCabys||'—'} ${c.detalle||''}`).join(' · ')}`):null,
        desc.length?React.createElement('div',{className:'mini-table'},React.createElement('b',null,'Descuentos'),...desc.map((d,j)=>React.createElement('span',{key:j},`${d.codigo||'—'}${d.codigoOtro?` / ${d.codigoOtro}`:''} · ${d.naturaleza||'Sin naturaleza'} · ${dinero(d.monto,f.moneda)}`))):null,
        imps.length?React.createElement('div',{className:'mini-table'},React.createElement('b',null,'Impuestos'),...imps.map((x,j)=>React.createElement('span',{key:j},`${x.codigo||'—'}${x.codigoOtro?` / ${x.codigoOtro}`:''} · tarifa ${x.tarifa??0}% · código tarifa ${x.codigoTarifaIVA||'—'} · monto ${dinero(x.monto??0,f.moneda)}${x.exoneracion?` · Exoneración ${x.exoneracion.numeroDocumento||''} ${x.exoneracion.nombreInstitucion||''}`:''}`))):null
      );
    })
  );
}
function Summary({f}) {
  const t=f.totales||{};
  const rows=[
    ['Servicios gravados',t.totalServiciosGravados??t.totalServGravados],['Servicios exentos',t.totalServiciosExentos??t.totalServExentos],
    ['Mercancías gravadas',t.totalMercanciasGravadas],['Mercancías exentas',t.totalMercanciasExentas],
    ['Total gravado',t.totalGravado],['Total exento',t.totalExento],['Total exonerado',t.totalExonerado],['Total no sujeto',t.totalNoSujeto],
    ['Total venta',t.totalVenta],['Descuentos',t.totalDescuentos],['Venta neta',t.totalVentaNeta],['Impuestos',t.totalImpuesto],['Otros cargos',t.totalOtrosCargos]
  ].filter(([,v])=>v!==undefined&&v!==null&&Number(v)!==0);
  const medios=Array.isArray(t.mediosPago)?t.mediosPago:[];
  return React.createElement('section',{className:'summary'},
    React.createElement('div',{className:'summary-info'},
      React.createElement('div',{className:'summary-info-title'},'Información del comprobante'),
      React.createElement('div',{className:'summary-info-grid'},
        f.perfilValidacion?React.createElement(D,{l:'Perfil de validación',v:f.perfilValidacion}):null,
        f.detalleCondicionVenta||f.detalleCondicionVentaOtro?React.createElement(D,{l:'Detalle condición',v:f.detalleCondicionVenta||f.detalleCondicionVentaOtro}):null,
        medios.length?React.createElement(D,{l:'Medio(s) de pago',v:medios.map(m=>`${cod(MP,m.tipo)} · ${dinero(m.total??m.monto,f.moneda)}`).join(' | ')}):null,
        React.createElement(D,{l:'Formato',v:'PDF de solo lectura'})
      )
    ),
    React.createElement('div',{className:'totals'},React.createElement('h3',null,'Resumen de importes'),
      ...rows.map(([l,v])=>React.createElement('div',{className:'total-row',key:l},React.createElement('span',null,l),React.createElement('strong',null,dinero(v,f.moneda)))),
      React.createElement('div',{className:'grand'},React.createElement('span',null,'TOTAL COMPROBANTE'),React.createElement('strong',null,dinero(t.totalComprobante,f.moneda)))
    )
  );
}
function Extras({f}) {
  const refs=Array.isArray(f.referencias)?f.referencias:[];
  const cargos=Array.isArray(f.otrosCargos)?f.otrosCargos:[];
  const otros=Array.isArray(f.otros)?f.otros:[];
  if(!refs.length&&!cargos.length&&!otros.length)return null;
  return React.createElement('section',{className:'block extras-compact'},
    React.createElement(SectionTitle,{kicker:'DATOS ADICIONALES',title:'Información complementaria'}),
    cargos.length?React.createElement('div',{className:'compact-list'},React.createElement('b',null,'Otros cargos'),...cargos.map((c,i)=>React.createElement('span',{key:i},`${c.detalle||c.tipoDocumento||'Cargo'} · ${dinero(c.monto,f.moneda)}`))):null,
    refs.length?React.createElement('div',{className:'compact-list'},React.createElement('b',null,'Referencias'),...refs.map((r,i)=>React.createElement('span',{key:i},`${r.tipoDocumento||'—'} · ${r.numero||r.numeroDocumento||'—'} · ${fecha(r.fechaEmision)} · ${r.razon||''}`))):null,
    otros.length?React.createElement('div',{className:'compact-list'},React.createElement('b',null,'Otros datos'),...otros.map((o,i)=>React.createElement('span',{key:i},typeof o==='string'?o:(o.texto||o.contenido||JSON.stringify(o))))):null
  );
}
function FacturaDocument({factura:f}) { return React.createElement('main',{className:'invoice'},React.createElement(Header,{f}),React.createElement('div',{className:'content'},React.createElement('div',{className:'people'},React.createElement(Person,{title:'Datos del emisor',p:f.emisor,side:'issuer'}),React.createElement(Person,{title:'Datos del cliente',p:f.receptor,side:'client'})),React.createElement(Items,{f}),React.createElement(Summary,{f}),React.createElement(Extras,{f})),React.createElement('footer',null,React.createElement('span',null,texto(f.emisor?.nombre,'Emisor')),React.createElement('span',{className:'mono'},texto(f.id,'')),React.createElement('span',null,'Comprobante PDF de solo lectura'))); }

module.exports={FacturaDocument,formatoMoneda:dinero,formatearFecha:fecha};
