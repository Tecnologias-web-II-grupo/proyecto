import React, { useEffect, useRef, useState } from 'react';
import { api } from '../api';

const emptyItem=()=>({detalle:'',cantidad:1,precioUnitario:0,descuento:0,impuestoTarifa:13,codigoCabys:'',unidadMedida:'Sp'});
export default function SaleWorkspace({ config }){
  const [receptor,setReceptor]=useState({nombre:'',correo:'',tipo:'01',numero:''});
  const [items,setItems]=useState([emptyItem()]); const [sale,setSale]=useState(null); const [message,setMessage]=useState(''); const [busy,setBusy]=useState(false);
  const popup=useRef(null);
  const totals=items.reduce((a,i)=>{const q=Number(i.cantidad)||0,p=Number(i.precioUnitario)||0,d=Number(i.descuento)||0,t=Number(i.impuestoTarifa)||0;const sub=Math.max(q*p-d,0);return {subtotal:a.subtotal+sub,impuesto:a.impuesto+sub*t/100,total:a.total+sub*(1+t/100)}},{subtotal:0,impuesto:0,total:0});
  function updateItem(index,key,value){setItems(list=>list.map((x,i)=>i===index?{...x,[key]:value}:x))}
  async function create(){setBusy(true);setMessage('');try{const data=await api('/api/portal/ventas',{method:'POST',body:JSON.stringify({receptor:{nombre:receptor.nombre,correo:receptor.correo,identificacion:receptor.numero?{tipo:receptor.tipo,numero:receptor.numero}:undefined},items,moneda:'CRC'})});setSale(data);setMessage('Venta creada. Continúa con el banco.')}catch(e){setMessage(e.message)}finally{setBusy(false)}}
  async function pay(){if(!sale)return;setBusy(true);setMessage('');try{const data=await api(`/api/portal/ventas/${sale.id}/pago/iniciar`,{method:'POST'});popup.current=window.open(data.checkoutUrl,'bankCheckout','width=520,height=720,resizable=yes,scrollbars=yes');setMessage('Se abrió el checkout del banco. La factura se genera cuando el pago queda validado.')}catch(e){setMessage(e.message)}finally{setBusy(false)}}
  async function refresh(){if(!sale)return;try{setSale(await api(`/api/portal/ventas/${sale.id}`))}catch(e){setMessage(e.message)}}
  useEffect(()=>{
    function onMessage(event){
      if(!config?.bank?.origin || event.origin!==config.bank.origin || !sale)return;
      const payload=event.data||{};
      const status=String(payload.status||payload.estado||'').toLowerCase();
      const ok=payload.paid===true||payload.success===true||['paid','success','completed','aprobado','pagado'].includes(status);
      if(!ok)return;
      api(`/api/portal/ventas/${sale.id}/pago/confirmar`,{method:'POST',body:JSON.stringify({sourceOrigin:event.origin,payload})})
        .then(data=>{setSale(data);setMessage('Pago validado e integraciones completadas.');try{popup.current?.close()}catch{}})
        .catch(e=>setMessage(e.message));
    }
    window.addEventListener('message',onMessage);return()=>window.removeEventListener('message',onMessage);
  },[sale?.id,config?.bank?.origin]);
  const status=sale?.estado||'borrador';
  return <section className="panel">
    <div className="panel-heading"><div><span className="eyebrow">VENTA INTEGRADA</span><h2>Procesar una venta</h2></div><span className={`status-chip ${status}`}>{status.replaceAll('_',' ')}</span></div>
    <div className="flow"><span className={sale?'done':'active'}>1 Venta</span><span className={['esperando_banco','pagada','procesando_integraciones','facturada'].includes(status)?'done':''}>2 Banco</span><span className={['procesando_integraciones','facturada'].includes(status)?'done':''}>3 Servicios</span><span className={status==='facturada'?'done':''}>4 Factura</span></div>
    <div className="sale-grid">
      <div><h3>Cliente</h3><label>Nombre<input value={receptor.nombre} onChange={e=>setReceptor({...receptor,nombre:e.target.value})}/></label><label>Correo<input type="email" value={receptor.correo} onChange={e=>setReceptor({...receptor,correo:e.target.value})}/></label><div className="form-grid two"><label>Tipo ID<select value={receptor.tipo} onChange={e=>setReceptor({...receptor,tipo:e.target.value})}><option value="01">Física</option><option value="02">Jurídica</option><option value="03">DIMEX</option></select></label><label>Identificación<input value={receptor.numero} onChange={e=>setReceptor({...receptor,numero:e.target.value})}/></label></div></div>
      <div className="summary-card"><span>Subtotal</span><strong>CRC {totals.subtotal.toLocaleString('es-CR',{minimumFractionDigits:2})}</strong><span>Impuestos</span><strong>CRC {totals.impuesto.toLocaleString('es-CR',{minimumFractionDigits:2})}</strong><div className="summary-total"><span>Total</span><b>CRC {totals.total.toLocaleString('es-CR',{minimumFractionDigits:2})}</b></div></div>
    </div>
    <div className="items-editor"><div className="items-title"><h3>Conceptos</h3><button className="secondary" onClick={()=>setItems([...items,emptyItem()])}>+ Agregar línea</button></div>{items.map((i,idx)=><div className="item-row" key={idx}><input className="wide-item" placeholder="Producto o servicio" value={i.detalle} onChange={e=>updateItem(idx,'detalle',e.target.value)}/><input type="number" min="0.001" step="0.001" value={i.cantidad} onChange={e=>updateItem(idx,'cantidad',e.target.value)}/><input type="number" min="0" step="0.01" value={i.precioUnitario} onChange={e=>updateItem(idx,'precioUnitario',e.target.value)}/><input type="number" min="0" step="0.01" value={i.descuento} onChange={e=>updateItem(idx,'descuento',e.target.value)}/><input type="number" min="0" step="0.01" value={i.impuestoTarifa} onChange={e=>updateItem(idx,'impuestoTarifa',e.target.value)}/><button className="icon-button" disabled={items.length===1} onClick={()=>setItems(items.filter((_,x)=>x!==idx))}>×</button></div>)}</div>
    <div className="actions"><button className="primary" disabled={busy||Boolean(sale)} onClick={create}>Crear venta</button><button className="bank-button" disabled={busy||!sale||status==='facturada'} onClick={pay}>Abrir banco</button>{sale&&<button className="secondary" onClick={refresh}>Actualizar estado</button>}{sale?.facturaId&&<a className="primary anchor" target="_blank" href={`/api/documentos/facturas/${sale.facturaId}?formato=pdf&plantilla=generica`}>Abrir factura</a>}</div>
    {message&&<div className="alert info">{message}</div>}
    {sale?.errorDetalle&&<div className="alert error">{sale.errorDetalle}</div>}
    <p className="integration-note">Banco configurado: <b>{config?.bank?.checkoutUrl}</b>. Cuando los demás equipos entreguen sus endpoints, se agregan al pipeline sin cambiar esta pantalla.</p>
  </section>
}
