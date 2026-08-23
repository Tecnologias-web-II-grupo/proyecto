import React, { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api';
import InvoiceReadyModal from './InvoiceReadyModal.jsx';

const emptyItem=()=>({tipoItem:'servicio',detalle:'',codigoCabys:'',codigoComercial:'',cantidad:'1',unidadMedida:'Sp',unidadMedidaComercial:'Unidad',tipoTransaccion:'01',precioUnitario:'',descuento:'0',impuestoTarifa:'13',codigoTarifaIVA:'08'});
const emptyClient={nombre:'',nombreComercial:'',correo:'',tipo:'01',numero:'',actividadEconomica:'',telefono:'',provincia:'',canton:'',distrito:'',otrasSenas:''};
const money=(n)=>`CRC ${Math.round(Number(n||0)).toLocaleString('es-CR')}`;
const digits=(v,max=12)=>String(v??'').replace(/\D/g,'').slice(0,max);
const whole=(v,max=999999999)=>{const d=digits(v,12); if(!d)return ''; return String(Math.min(Number(d),max));};

export default function SaleWorkspace({ config, me, onCompleted }){
  const [receptor,setReceptor]=useState(emptyClient);
  const [savedClients,setSavedClients]=useState([]);
  const [items,setItems]=useState([emptyItem()]);
  const [sale,setSale]=useState(null); const [message,setMessage]=useState(''); const [busy,setBusy]=useState(false);
  const [advanced,setAdvanced]=useState(false); const [invoiceReady,setInvoiceReady]=useState(null);
  const popup=useRef(null); const poller=useRef(null);

  const totals=useMemo(()=>items.reduce((a,i)=>{
    const q=Math.max(parseInt(i.cantidad||0,10)||0,0),p=Math.max(parseInt(i.precioUnitario||0,10)||0,0),d=Math.max(parseInt(i.descuento||0,10)||0,0),t=Math.max(Number(i.impuestoTarifa)||0,0);
    const gross=q*p, discount=Math.min(d,gross), sub=Math.max(gross-discount,0), tax=sub*t/100;
    return {venta:a.venta+gross,descuento:a.descuento+discount,subtotal:a.subtotal+sub,impuesto:a.impuesto+tax,total:a.total+sub+tax};
  },{venta:0,descuento:0,subtotal:0,impuesto:0,total:0}),[items]);

  useEffect(()=>{api('/api/portal/clientes').then(r=>setSavedClients(r.items||[])).catch(()=>{})},[]);
  function updateItem(index,key,value){setItems(list=>list.map((x,i)=>i===index?{...x,[key]:value}:x))}
  function pickClient(id){const c=savedClients.find(x=>x.id===id); if(!c)return; setReceptor({...emptyClient,...c});}
  function reset(){setSale(null);setReceptor(emptyClient);setItems([emptyItem()]);setMessage('');setInvoiceReady(null);setAdvanced(false)}

  function validate(){
    if(!receptor.nombre.trim())return 'Indica el nombre o razón social del cliente.';
    if(!/^\S+@\S+\.\S+$/.test(receptor.correo))return 'Indica un correo válido para el cliente.';
    if(!receptor.numero || receptor.numero.length<8)return 'Indica una identificación válida del cliente.';
    for(let idx=0;idx<items.length;idx++){
      const i=items[idx], q=Number(i.cantidad), p=Number(i.precioUnitario), d=Number(i.descuento), cabys=String(i.codigoCabys||'');
      if(!i.detalle.trim())return `Escribe qué estás vendiendo en la línea ${idx+1}.`;
      if(cabys.length!==13)return `El CAByS de la línea ${idx+1} debe tener 13 dígitos.`;
      if(!Number.isInteger(q)||q<1)return `La cantidad de la línea ${idx+1} debe ser un número entero mayor que cero.`;
      if(!Number.isInteger(p)||p<1)return `El precio de la línea ${idx+1} debe ser un monto entero mayor que cero.`;
      if(d<0||d>q*p)return `El descuento de la línea ${idx+1} no puede superar el importe de esa línea.`;
    }
    return '';
  }

  async function create(){
    const error=validate(); if(error){setMessage(error);return}
    setBusy(true);setMessage('');
    try{
      const data=await api('/api/portal/ventas',{method:'POST',body:JSON.stringify({
        receptor:{nombre:receptor.nombre,nombreComercial:receptor.nombreComercial,correo:receptor.correo,actividadEconomica:receptor.actividadEconomica,telefono:receptor.telefono,ubicacion:{provincia:receptor.provincia,canton:receptor.canton,distrito:receptor.distrito,otrasSenas:receptor.otrasSenas},identificacion:{tipo:receptor.tipo,numero:receptor.numero}},
        items,moneda:'CRC',condicionVenta:'01',detalleCondicionVenta:'Contado',medioPago:'02',plazoCredito:0
      })});
      setSale(data);setMessage('Venta lista. Continúa con el pago para emitir la factura.');
      api('/api/portal/clientes').then(r=>setSavedClients(r.items||[])).catch(()=>{});
    }catch(e){setMessage(e.message)}finally{setBusy(false)}
  }
  async function pay(){
    if(!sale)return;setBusy(true);setMessage('');
    try{
      const data=await api(`/api/portal/ventas/${sale.id}/pago/iniciar`,{method:'POST'});
      if(data.alreadyCompleted&&data.facturaId){setInvoiceReady(data.facturaId);return}
      popup.current=window.open(data.checkoutUrl,'bankCheckout','width=560,height=780,resizable=yes,scrollbars=yes');
      if(!popup.current)throw new Error('El navegador bloqueó la ventana de pago. Habilita las ventanas emergentes e inténtalo de nuevo.');
      setMessage('Completa el pago en la ventana segura que se abrió.'); beginPolling();
    }catch(e){setMessage(e.message)}finally{setBusy(false)}
  }
  async function refresh(){if(!sale)return null;try{const current=await api(`/api/portal/ventas/${sale.id}`);setSale(current);if(current.facturaId)finish(current);return current}catch(e){setMessage(e.message);return null}}
  function finish(current){clearInterval(poller.current);try{popup.current?.close()}catch{};setInvoiceReady(current.facturaId);setMessage('');onCompleted?.()}
  function beginPolling(){clearInterval(poller.current);poller.current=setInterval(()=>refresh(),2500)}
  useEffect(()=>()=>clearInterval(poller.current),[]);
  useEffect(()=>{
    function onMessage(event){
      if(!sale)return; const payload=event.data||{};
      const isBankOrigin=config?.bank?.origin&&event.origin===config.bank.origin;
      const isReturnBridge=event.origin===window.location.origin&&payload.type==='bank-return';
      if(!isBankOrigin&&!isReturnBridge)return;
      if(isReturnBridge){refresh();return}
      const status=String(payload.status||payload.estado||'').toLowerCase();
      const ok=payload.paid===true||payload.success===true||['paid','success','completed','aprobado','pagado'].includes(status);
      if(!ok)return;
      api(`/api/portal/ventas/${sale.id}/pago/confirmar`,{method:'POST',body:JSON.stringify({sourceOrigin:event.origin,payload})}).then(data=>{setSale(data);if(data.facturaId)finish(data)}).catch(e=>setMessage(e.message));
    }
    window.addEventListener('message',onMessage);return()=>window.removeEventListener('message',onMessage);
  },[sale?.id,config?.bank?.origin]);

  const status=sale?.estado||'nuevo';
  return <section className="panel sale-panel">
    <div className="panel-heading"><div><span className="eyebrow">NUEVA VENTA</span><h2>Registra lo que vas a cobrar</h2><p className="muted">Los datos de <b>{me?.empresa}</b> ya están cargados desde tu cuenta. Completa únicamente el cliente y los conceptos de esta venta.</p></div>{sale&&<span className={`status-chip ${status}`}>{status==='pendiente_pago'?'Lista para pagar':status==='esperando_banco'?'Esperando pago':status==='facturada'?'Completada':'Procesando'}</span>}</div>

    <div className="seller-strip"><div><span>Emisor</span><strong>{me?.empresa}</strong></div><div><span>Identificación</span><strong>{me?.numeroIdentificacion}</strong></div><div><span>Correo de factura</span><strong>{me?.correoFacturacion}</strong></div></div>

    <div className="sale-grid">
      <div className="client-form"><div className="section-heading-inline"><div><h3>¿A quién le vendes?</h3><p className="muted small">Estos datos aparecerán como cliente en la factura.</p></div>{savedClients.length>0&&<select className="saved-client" defaultValue="" onChange={e=>pickClient(e.target.value)}><option value="">Cliente guardado…</option>{savedClients.map(c=><option key={c.id} value={c.id}>{c.nombre} · {c.numero}</option>)}</select>}</div>
        <label>Nombre o razón social<input maxLength="160" placeholder="Ej. Empresa Cliente S.A." value={receptor.nombre} onChange={e=>setReceptor({...receptor,nombre:e.target.value})}/></label>
        <div className="form-grid two"><label>Correo para la factura<input type="email" placeholder="cliente@correo.com" value={receptor.correo} onChange={e=>setReceptor({...receptor,correo:e.target.value})}/></label><label>Tipo de identificación<select value={receptor.tipo} onChange={e=>setReceptor({...receptor,tipo:e.target.value})}><option value="01">Persona física</option><option value="02">Persona jurídica</option><option value="03">DIMEX</option><option value="04">NITE</option></select></label></div>
        <label>Número de identificación<input inputMode="numeric" placeholder="Solo números" value={receptor.numero} onChange={e=>setReceptor({...receptor,numero:digits(e.target.value,12)})}/></label>
        <button type="button" className="text-toggle" onClick={()=>setAdvanced(!advanced)}>{advanced?'Ocultar información opcional':'Agregar información opcional del cliente'}</button>
        {advanced&&<div className="advanced-client"><div className="form-grid two"><label>Nombre comercial<input value={receptor.nombreComercial} onChange={e=>setReceptor({...receptor,nombreComercial:e.target.value})}/></label><label>Actividad económica<input inputMode="numeric" value={receptor.actividadEconomica} onChange={e=>setReceptor({...receptor,actividadEconomica:digits(e.target.value,6)})} placeholder="6 dígitos"/></label><label>Teléfono<input inputMode="numeric" value={receptor.telefono} onChange={e=>setReceptor({...receptor,telefono:digits(e.target.value,12)})}/></label><label>Provincia<input inputMode="numeric" value={receptor.provincia} onChange={e=>setReceptor({...receptor,provincia:digits(e.target.value,2)})}/></label><label>Cantón<input inputMode="numeric" value={receptor.canton} onChange={e=>setReceptor({...receptor,canton:digits(e.target.value,2)})}/></label><label>Distrito<input inputMode="numeric" value={receptor.distrito} onChange={e=>setReceptor({...receptor,distrito:digits(e.target.value,2)})}/></label></div><label>Dirección / otras señas<input value={receptor.otrasSenas} onChange={e=>setReceptor({...receptor,otrasSenas:e.target.value})}/></label></div>}
      </div>
      <div className="summary-card"><div className="summary-row"><span>Importe</span><strong>{money(totals.venta)}</strong></div>{totals.descuento>0&&<div className="summary-row"><span>Descuento</span><strong>- {money(totals.descuento)}</strong></div>}<div className="summary-row"><span>Subtotal</span><strong>{money(totals.subtotal)}</strong></div><div className="summary-row"><span>Impuestos</span><strong>{money(totals.impuesto)}</strong></div><div className="summary-total"><span>Total a pagar</span><b>{money(totals.total)}</b></div></div>
    </div>

    <div className="items-editor"><div className="items-title"><div><h3>¿Qué estás vendiendo?</h3><p className="muted small">Agrega cada producto o servicio tal como quieres que aparezca en la factura.</p></div><button className="secondary" onClick={()=>setItems([...items,emptyItem()])}>Agregar concepto</button></div>
      {items.map((i,idx)=><article className="sale-item" key={idx}><div className="item-main polished-item-main">
        <label className="description-field">Descripción<input placeholder="Ej. Servicio de soporte mensual" value={i.detalle} onChange={e=>updateItem(idx,'detalle',e.target.value)} maxLength="255"/></label>
        <label>CAByS<input inputMode="numeric" placeholder="13 dígitos" value={i.codigoCabys} onChange={e=>updateItem(idx,'codigoCabys',digits(e.target.value,13))}/></label>
        <label>Cantidad<input inputMode="numeric" value={i.cantidad} onChange={e=>updateItem(idx,'cantidad',whole(e.target.value,100000))}/></label>
        <label>Precio unitario<div className="input-affix prefix"><span>₡</span><input inputMode="numeric" placeholder="0" value={i.precioUnitario} onChange={e=>updateItem(idx,'precioUnitario',whole(e.target.value))}/></div></label>
        <label>IVA<select value={i.impuestoTarifa} onChange={e=>updateItem(idx,'impuestoTarifa',e.target.value)}><option value="0">0 %</option><option value="1">1 %</option><option value="2">2 %</option><option value="4">4 %</option><option value="13">13 %</option></select></label>
        <button className="remove-line" disabled={items.length===1} onClick={()=>setItems(items.filter((_,x)=>x!==idx))}>Eliminar</button>
      </div><details className="item-details"><summary>Más opciones de este concepto</summary><div className="item-detail-grid"><label>Tipo<select value={i.tipoItem} onChange={e=>updateItem(idx,'tipoItem',e.target.value)}><option value="servicio">Servicio</option><option value="mercancia">Producto</option></select></label><label>Unidad<select value={i.unidadMedida} onChange={e=>updateItem(idx,'unidadMedida',e.target.value)}><option value="Sp">Servicio</option><option value="Unid">Unidad</option><option value="h">Hora</option><option value="d">Día</option><option value="mes">Mes</option></select></label><label>Unidad comercial<input placeholder="Ej. Mes" value={i.unidadMedidaComercial} onChange={e=>updateItem(idx,'unidadMedidaComercial',e.target.value)}/></label><label>Código interno<input placeholder="Opcional" value={i.codigoComercial} onChange={e=>updateItem(idx,'codigoComercial',e.target.value)}/></label><label>Descuento<div className="input-affix prefix"><span>₡</span><input inputMode="numeric" value={i.descuento} onChange={e=>updateItem(idx,'descuento',whole(e.target.value))}/></div></label></div></details></article>)}
    </div>

    <div className="checkout-strip"><div><strong>{sale?'Venta preparada':'Revisa antes de continuar'}</strong><span>{sale?'Completa el pago para emitir la factura.':'El pago se realizará por el total mostrado arriba.'}</span></div><div className="actions">{!sale?<button className="primary" disabled={busy||totals.total<=0} onClick={create}>Continuar al pago</button>:<><button className="bank-button" disabled={busy||status==='facturada'} onClick={pay}>Pagar</button><button className="secondary" onClick={refresh}>Actualizar</button><button className="link-quiet" onClick={reset}>Cancelar</button></>}</div></div>
    {message&&<div className="alert info">{message}</div>}{sale?.errorDetalle&&<div className="alert error">{sale.errorDetalle}</div>}
    <InvoiceReadyModal invoiceId={invoiceReady} onClose={()=>setInvoiceReady(null)} onNewSale={reset}/>
  </section>
}
