import React, { useEffect, useRef, useState } from 'react';
import { api } from '../api';
import InvoiceReadyModal from './InvoiceReadyModal.jsx';

const emptyItem=()=>({tipoItem:'servicio',detalle:'',codigoCabys:'',codigoComercial:'',cantidad:1,unidadMedida:'Sp',unidadMedidaComercial:'Unidad',tipoTransaccion:'01',precioUnitario:0,descuento:0,impuestoTarifa:13,codigoTarifaIVA:'08'});
const emptyClient={nombre:'',nombreComercial:'',correo:'',tipo:'01',numero:'',actividadEconomica:'',telefono:'',provincia:'',canton:'',distrito:'',otrasSenas:''};
const money=(n)=>`CRC ${Number(n||0).toLocaleString('es-CR',{minimumFractionDigits:2,maximumFractionDigits:2})}`;

export default function SaleWorkspace({ config, onCompleted }){
  const [receptor,setReceptor]=useState(emptyClient);
  const [items,setItems]=useState([emptyItem()]);
  const [sale,setSale]=useState(null); const [message,setMessage]=useState(''); const [busy,setBusy]=useState(false);
  const [advanced,setAdvanced]=useState(false); const [invoiceReady,setInvoiceReady]=useState(null);
  const popup=useRef(null); const poller=useRef(null);
  const totals=items.reduce((a,i)=>{const q=Number(i.cantidad)||0,p=Number(i.precioUnitario)||0,d=Number(i.descuento)||0,t=Number(i.impuestoTarifa)||0;const gross=q*p;const sub=Math.max(gross-d,0);return {venta:a.venta+gross,descuento:a.descuento+d,subtotal:a.subtotal+sub,impuesto:a.impuesto+sub*t/100,total:a.total+sub*(1+t/100)}},{venta:0,descuento:0,subtotal:0,impuesto:0,total:0});
  function updateItem(index,key,value){setItems(list=>list.map((x,i)=>i===index?{...x,[key]:value}:x))}
  function reset(){setSale(null);setReceptor(emptyClient);setItems([emptyItem()]);setMessage('');setInvoiceReady(null)}
  async function create(){
    if(totals.total<=0){setMessage('Agrega un concepto con un monto mayor que cero.');return}
    setBusy(true);setMessage('');
    try{
      const data=await api('/api/portal/ventas',{method:'POST',body:JSON.stringify({
        receptor:{nombre:receptor.nombre,nombreComercial:receptor.nombreComercial,correo:receptor.correo,actividadEconomica:receptor.actividadEconomica,telefono:receptor.telefono,ubicacion:{provincia:receptor.provincia,canton:receptor.canton,distrito:receptor.distrito,otrasSenas:receptor.otrasSenas},identificacion:receptor.numero?{tipo:receptor.tipo,numero:receptor.numero}:undefined},
        items,moneda:'CRC',condicionVenta:'01',detalleCondicionVenta:'Contado',medioPago:'02',plazoCredito:0
      })});
      setSale(data);setMessage('Venta preparada. Continúa con el pago para generar la factura.');
    }catch(e){setMessage(e.message)}finally{setBusy(false)}
  }
  async function pay(){
    if(!sale)return;setBusy(true);setMessage('');
    try{
      const data=await api(`/api/portal/ventas/${sale.id}/pago/iniciar`,{method:'POST'});
      if(data.alreadyCompleted&&data.facturaId){setInvoiceReady(data.facturaId);return}
      popup.current=window.open(data.checkoutUrl,'bankCheckout','width=540,height=760,resizable=yes,scrollbars=yes');
      if(!popup.current)throw new Error('El navegador bloqueó la ventana de pago. Habilita ventanas emergentes e inténtalo nuevamente.');
      setMessage('Completa el pago en la ventana que se abrió. Esta pantalla se actualizará automáticamente.');
      beginPolling();
    }catch(e){setMessage(e.message)}finally{setBusy(false)}
  }
  async function refresh(){if(!sale)return null;try{const current=await api(`/api/portal/ventas/${sale.id}`);setSale(current);if(current.facturaId){finish(current)}return current}catch(e){setMessage(e.message);return null}}
  function finish(current){clearInterval(poller.current);try{popup.current?.close()}catch{};setInvoiceReady(current.facturaId);setMessage('');onCompleted?.()}
  function beginPolling(){clearInterval(poller.current);poller.current=setInterval(()=>refresh(),2500)}
  useEffect(()=>()=>clearInterval(poller.current),[]);
  useEffect(()=>{
    function onMessage(event){
      if(!sale)return;
      const payload=event.data||{};
      const isBankOrigin=config?.bank?.origin && event.origin===config.bank.origin;
      const isReturnBridge=event.origin===window.location.origin && payload.type==='bank-return';
      if(!isBankOrigin&&!isReturnBridge)return;
      if(isReturnBridge){refresh();return}
      const status=String(payload.status||payload.estado||'').toLowerCase();
      const ok=payload.paid===true||payload.success===true||['paid','success','completed','aprobado','pagado'].includes(status);
      if(!ok)return;
      api(`/api/portal/ventas/${sale.id}/pago/confirmar`,{method:'POST',body:JSON.stringify({sourceOrigin:event.origin,payload})})
        .then(data=>{setSale(data);if(data.facturaId)finish(data)})
        .catch(e=>setMessage(e.message));
    }
    window.addEventListener('message',onMessage);return()=>window.removeEventListener('message',onMessage);
  },[sale?.id,config?.bank?.origin]);

  const status=sale?.estado||'nuevo';
  return <section className="panel sale-panel">
    <div className="panel-heading"><div><span className="eyebrow">NUEVA VENTA</span><h2>Prepara el comprobante</h2><p className="muted">Completa los datos del cliente y lo que estás vendiendo. La factura se crea únicamente cuando el pago queda aprobado.</p></div>{sale&&<span className={`status-chip ${status}`}>{status==='pendiente_pago'?'Lista para pagar':status==='esperando_banco'?'Esperando pago':status==='facturada'?'Completada':'Procesando'}</span>}</div>

    <div className="sale-grid">
      <div className="client-form"><h3>Cliente</h3><label>Nombre o razón social<input value={receptor.nombre} onChange={e=>setReceptor({...receptor,nombre:e.target.value})}/></label><label>Correo<input type="email" value={receptor.correo} onChange={e=>setReceptor({...receptor,correo:e.target.value})}/></label><div className="form-grid two"><label>Tipo de identificación<select value={receptor.tipo} onChange={e=>setReceptor({...receptor,tipo:e.target.value})}><option value="01">Persona física</option><option value="02">Persona jurídica</option><option value="03">DIMEX</option></select></label><label>Identificación<input value={receptor.numero} onChange={e=>setReceptor({...receptor,numero:e.target.value})}/></label></div><button type="button" className="text-toggle" onClick={()=>setAdvanced(!advanced)}>{advanced?'Ocultar datos adicionales':'Agregar datos adicionales del cliente'}</button>{advanced&&<div className="advanced-client"><div className="form-grid two"><label>Nombre comercial<input value={receptor.nombreComercial} onChange={e=>setReceptor({...receptor,nombreComercial:e.target.value})}/></label><label>Actividad económica<input value={receptor.actividadEconomica} onChange={e=>setReceptor({...receptor,actividadEconomica:e.target.value})} maxLength="6"/></label><label>Teléfono<input value={receptor.telefono} onChange={e=>setReceptor({...receptor,telefono:e.target.value})}/></label><label>Provincia<input value={receptor.provincia} onChange={e=>setReceptor({...receptor,provincia:e.target.value})}/></label><label>Cantón<input value={receptor.canton} onChange={e=>setReceptor({...receptor,canton:e.target.value})}/></label><label>Distrito<input value={receptor.distrito} onChange={e=>setReceptor({...receptor,distrito:e.target.value})}/></label></div><label>Otras señas<input value={receptor.otrasSenas} onChange={e=>setReceptor({...receptor,otrasSenas:e.target.value})}/></label></div>}</div>
      <div className="summary-card"><span>Subtotal</span><strong>{money(totals.subtotal)}</strong><span>Impuestos</span><strong>{money(totals.impuesto)}</strong><div className="summary-total"><span>Total</span><b>{money(totals.total)}</b></div><small>El monto que se enviará al pago es este total.</small></div>
    </div>

    <div className="items-editor"><div className="items-title"><div><h3>Productos o servicios</h3><p className="muted small">Los datos fiscales se conservan para formar correctamente la factura.</p></div><button className="secondary" onClick={()=>setItems([...items,emptyItem()])}>Agregar línea</button></div>{items.map((i,idx)=><article className="sale-item" key={idx}><div className="item-main"><label>Descripción<input placeholder="Ej. Servicio mensual" value={i.detalle} onChange={e=>updateItem(idx,'detalle',e.target.value)}/></label><label>CAByS<input placeholder="13 dígitos" value={i.codigoCabys} onChange={e=>updateItem(idx,'codigoCabys',e.target.value.replace(/\D/g,'').slice(0,13))}/></label><label>Cantidad<input type="number" min="0.001" step="0.001" value={i.cantidad} onChange={e=>updateItem(idx,'cantidad',e.target.value)}/></label><label>Precio<input type="number" min="0" step="0.01" value={i.precioUnitario} onChange={e=>updateItem(idx,'precioUnitario',e.target.value)}/></label><label>IVA %<input type="number" min="0" step="0.01" value={i.impuestoTarifa} onChange={e=>updateItem(idx,'impuestoTarifa',e.target.value)}/></label><button className="remove-line" disabled={items.length===1} onClick={()=>setItems(items.filter((_,x)=>x!==idx))}>Eliminar</button></div><details className="item-details"><summary>Más detalles</summary><div className="item-detail-grid"><label>Tipo<select value={i.tipoItem} onChange={e=>updateItem(idx,'tipoItem',e.target.value)}><option value="servicio">Servicio</option><option value="mercancia">Producto</option></select></label><label>Unidad<input value={i.unidadMedida} onChange={e=>updateItem(idx,'unidadMedida',e.target.value)}/></label><label>Unidad comercial<input value={i.unidadMedidaComercial} onChange={e=>updateItem(idx,'unidadMedidaComercial',e.target.value)}/></label><label>Código comercial<input value={i.codigoComercial} onChange={e=>updateItem(idx,'codigoComercial',e.target.value)}/></label><label>Descuento<input type="number" min="0" step="0.01" value={i.descuento} onChange={e=>updateItem(idx,'descuento',e.target.value)}/></label></div></details></article>)}</div>

    <div className="checkout-strip"><div><strong>{sale?'Venta preparada':'Cuando estés listo'}</strong><span>{sale?'Continúa al pago para terminar.':'Crea la venta y luego completa el pago.'}</span></div><div className="actions">{!sale?<button className="primary" disabled={busy||totals.total<=0} onClick={create}>Continuar</button>:<><button className="bank-button" disabled={busy||status==='facturada'} onClick={pay}>Pagar ahora</button><button className="secondary" onClick={refresh}>Revisar estado</button><button className="link-quiet" onClick={reset}>Cancelar venta</button></>}</div></div>
    {message&&<div className={`alert ${message.includes('error')?'error':'info'}`}>{message}</div>}
    {sale?.errorDetalle&&<div className="alert error">{sale.errorDetalle}</div>}
    <InvoiceReadyModal invoiceId={invoiceReady} onClose={()=>setInvoiceReady(null)} onNewSale={reset}/>
  </section>
}
