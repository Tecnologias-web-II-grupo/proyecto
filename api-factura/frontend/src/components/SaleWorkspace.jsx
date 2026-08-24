import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import InvoiceReadyModal from './InvoiceReadyModal.jsx';
import { pagarConBanky, describirResultado, aMetodoDePago } from '../services/payments/bankyCheckout.js';

const emptyItem=()=>({tipoItem:'servicio',detalle:'',codigoCabys:'',codigoComercial:'',cantidad:'1',unidadMedida:'Sp',unidadMedidaComercial:'Unidad',tipoTransaccion:'01',precioUnitario:'',descuento:'0',impuestoTarifa:'13',codigoTarifaIVA:'08'});
const emptyClient={nombre:'',nombreComercial:'',correo:'',tipo:'01',numero:'',actividadEconomica:'',telefono:'',provincia:'',canton:'',distrito:'',otrasSenas:''};
const money=(n)=>`CRC ${Math.round(Number(n||0)).toLocaleString('es-CR')}`;
const digits=(v,max=12)=>String(v??'').replace(/\D/g,'').slice(0,max);
const whole=(v,max=999999999)=>{const d=digits(v,12); if(!d)return ''; return String(Math.min(Number(d),max));};
const statusLabel={
  pendiente_pago:'Lista para pagar',
  esperando_banco:'Procesando pago',
  pagada:'Pago aprobado',
  validando_firma:'Validando firma digital',
  generando_factura_visual:'Generando factura',
  factura_visual_generada:'Factura visual generada',
  procesando_electronica:'Procesando factura electrónica',
  procesando_tributacion:'Validando en Tributación',
  procesando_integraciones:'Procesando servicios',
  preparando_entrega:'Preparando envío',
  procesamiento_fallido:'Pendiente de entrega',
  entregada:'Completado'
};
const integrationLabel={firma_digital:'Firma digital',facturacion_electronica:'Factura electrónica',tributacion:'Tributación',entrega_correo:'Entrega por correo'};
const doneStates=new Set(['completada']);


async function submitInvoiceByFormAction({ invoiceId, customerEmail, ownerEmail }){
  if(!invoiceId)throw new Error('La factura todavía no está lista.');
  customerEmail=String(customerEmail||'').trim().toLowerCase();
  ownerEmail=String(ownerEmail||'').trim().toLowerCase();
  if(!/^\S+@\S+\.\S+$/.test(customerEmail))throw new Error('El correo de entrega no es válido.');
  if(!/^\S+@\S+\.\S+$/.test(ownerEmail))throw new Error('El correo del negocio no es válido para habilitar el canal de entrega.');

  const pdfResponse=await fetch(`/api/documentos/facturas/${encodeURIComponent(invoiceId)}?formato=pdf&plantilla=generica`);
  if(!pdfResponse.ok)throw new Error('No se pudo preparar el PDF para el correo.');
  const blob=await pdfResponse.blob();
  const file=new File([blob],`factura-${invoiceId}.pdf`,{type:'application/pdf'});

  const formData=new FormData();
  formData.append('_subject',`Factura ${invoiceId}`);
  formData.append('_template','table');
  formData.append('_cc',customerEmail);
  formData.append('_replyto',customerEmail);
  formData.append('email',customerEmail);
  formData.append('cliente',customerEmail);
  formData.append('factura',invoiceId);
  formData.append('mensaje','Adjuntamos la factura correspondiente a la compra realizada.');
  formData.append('attachment',file,file.name);

  let response;
  try{
    response=await fetch(`https://formsubmit.co/ajax/${encodeURIComponent(ownerEmail)}`,{
      method:'POST',
      body:formData,
      headers:{Accept:'application/json'}
    });
  }catch{
    throw new Error('No fue posible contactar el servicio de entrega por correo.');
  }

  let body={};
  try{body=await response.json()}catch{}
  const text=String(body?.message||body?.error||'').trim();
  if(!response.ok || body?.success===false){
    if(/activ|confirm/i.test(text)){
      const error=new Error('El correo del negocio debe activar una sola vez el canal de entrega. Revisa su bandeja de entrada y luego reintenta.');
      error.code='FORM_ACTIVATION_REQUIRED';
      throw error;
    }
    throw new Error(text||`No se pudo solicitar el envío de la factura (HTTP ${response.status}).`);
  }
  return {ok:true,to:customerEmail,provider:'formsubmit',message:text||'Solicitud aceptada'};
}


export default function SaleWorkspace({ config, me, onCompleted }){
  const activeKey=`factura_bonita_active_sale_${me?.id||'user'}`;
  const [receptor,setReceptor]=useState(emptyClient);
  const [savedClients,setSavedClients]=useState([]);
  const [clientSearch,setClientSearch]=useState('');
  const [items,setItems]=useState([emptyItem()]);
  const [sale,setSale]=useState(null); const [message,setMessage]=useState(''); const [busy,setBusy]=useState(false);
  const [advanced,setAdvanced]=useState(false); const [invoiceReady,setInvoiceReady]=useState(null); const [editing,setEditing]=useState(false);
  const [restoring,setRestoring]=useState(true);
  const [deliveryMessage,setDeliveryMessage]=useState('');

  const totals=useMemo(()=>items.reduce((a,i)=>{
    const q=Math.max(parseInt(i.cantidad||0,10)||0,0),p=Math.max(parseInt(i.precioUnitario||0,10)||0,0),d=Math.max(parseInt(i.descuento||0,10)||0,0),t=Math.max(Number(i.impuestoTarifa)||0,0);
    const gross=q*p, discount=Math.min(d,gross), sub=Math.max(gross-discount,0), tax=sub*t/100;
    return {venta:a.venta+gross,descuento:a.descuento+discount,subtotal:a.subtotal+sub,impuesto:a.impuesto+tax,total:a.total+sub+tax};
  },{venta:0,descuento:0,subtotal:0,impuesto:0,total:0}),[items]);

  function normalizeClientFromSale(current){
    const r=current?.receptor||{}, u=r.ubicacion||{};
    return {...emptyClient,nombre:r.nombre||'',nombreComercial:r.nombreComercial||'',correo:r.correo||'',tipo:r.identificacion?.tipo||'01',numero:r.identificacion?.numero||'',actividadEconomica:r.actividadEconomica||'',telefono:r.telefono||'',provincia:u.provincia||'',canton:u.canton||'',distrito:u.distrito||'',otrasSenas:u.otrasSenas||''};
  }
  function normalizeItemsFromSale(current){
    return (current?.items||[]).map(i=>({
      tipoItem:i.tipoItem||'servicio',detalle:i.detalle||'',codigoCabys:i.codigoCabys||'',codigoComercial:i.codigosComerciales?.[0]?.codigo||'',cantidad:String(i.cantidad??1),unidadMedida:i.unidadMedida||'Sp',unidadMedidaComercial:i.unidadMedidaComercial||'Unidad',tipoTransaccion:i.tipoTransaccion||'01',precioUnitario:String(Math.round(Number(i.precioUnitario||0))),descuento:String(Math.round(Number(i.descuento||0))),impuestoTarifa:String(Number(i.impuestoTarifa??i.impuesto?.tarifa??13)),codigoTarifaIVA:i.impuestos?.[0]?.codigoTarifaIVA||'08'
    }));
  }
  function hydrate(current,{notice=false}={}){
    if(!current)return;
    setSale(current); setReceptor(normalizeClientFromSale(current));
    const restoredItems=normalizeItemsFromSale(current); if(restoredItems.length)setItems(restoredItems);
    localStorage.setItem(activeKey,current.id);
    if(notice)setMessage(current.facturaId?'La venta ya tiene una factura disponible.':'Recuperamos la venta que estabas procesando.');
  }

  useEffect(()=>{api('/api/portal/clientes').then(r=>setSavedClients(r.items||[])).catch(()=>{})},[]);
  useEffect(()=>{
    let cancelled=false;
    (async()=>{
      const id=localStorage.getItem(activeKey);
      if(!id){setRestoring(false);return;}
      try{
        const current=await api(`/api/portal/ventas/${id}`);
        if(cancelled)return;
        hydrate(current,{notice:true});
        const pendingRaw=localStorage.getItem(`${activeKey}:bank-result`);
        if(pendingRaw&&!current.facturaId){
          try{
            const result=JSON.parse(pendingRaw);
            if(String(result?.status||'').toLowerCase()==='completed') await confirmCompletedPayment(current,result);
          }catch{}
        }
        if(current.facturaId && current.estado==='entregada')setInvoiceReady(current.facturaId);
        else if(current?.pago?.transactionCode){
          try{
            const retried=await api(`/api/portal/ventas/${current.id}/reintentar`,{method:'POST'});
            hydrate(retried);
            if(retried.facturaId && retried.estado==='entregada')finish(retried);
          }catch(e){setMessage(`El pago ya está aprobado. La factura sigue pendiente: ${e.message}`)}
        }
      }catch{localStorage.removeItem(activeKey);localStorage.removeItem(`${activeKey}:bank-result`)}
      finally{if(!cancelled)setRestoring(false)}
    })();
    return()=>{cancelled=true};
  },[me?.id]);

  function updateItem(index,key,value){setItems(list=>list.map((x,i)=>i===index?{...x,[key]:value}:x))}
  function pickClient(id){const c=savedClients.find(x=>x.id===id); if(!c)return; setReceptor({...emptyClient,...c});}
  function reset(){localStorage.removeItem(activeKey);localStorage.removeItem(`${activeKey}:bank-result`);setSale(null);setReceptor(emptyClient);setItems([emptyItem()]);setMessage('');setDeliveryMessage('');setInvoiceReady(null);setAdvanced(false);setEditing(false)}

  function validate(){
    if(!receptor.nombre.trim())return 'Indica el nombre o razón social del cliente.';
    if(!/^\S+@\S+\.\S+$/.test(receptor.correo))return 'Indica un correo válido para el cliente.';
    if(!receptor.numero || receptor.numero.length<8)return 'Indica una identificación válida del cliente.';
    for(let idx=0;idx<items.length;idx++){
      const i=items[idx], q=Number(i.cantidad), p=Number(i.precioUnitario), d=Number(i.descuento), cabys=String(i.codigoCabys||'');
      if(!i.detalle.trim())return `Escribe qué estás vendiendo en la línea ${idx+1}.`;
      if(cabys && cabys.length!==13)return `Si indicas CAByS en la línea ${idx+1}, debe tener 13 dígitos.`;
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
      const target=sale?`/api/portal/ventas/${sale.id}`:'/api/portal/ventas';
      const data=await api(target,{method:sale?'PUT':'POST',body:JSON.stringify({
        receptor:{nombre:receptor.nombre,nombreComercial:receptor.nombreComercial,correo:receptor.correo,actividadEconomica:receptor.actividadEconomica,telefono:receptor.telefono,ubicacion:{provincia:receptor.provincia,canton:receptor.canton,distrito:receptor.distrito,otrasSenas:receptor.otrasSenas},identificacion:{tipo:receptor.tipo,numero:receptor.numero}},
        items,moneda:'CRC',condicionVenta:'01',detalleCondicionVenta:'Contado',medioPago:'02',plazoCredito:0
      })});
      hydrate(data);setEditing(false);setMessage(sale?'Cambios guardados. Ya puedes continuar con el pago.':'Venta guardada. Puedes pagar cuando estés listo.');
      api('/api/portal/clientes').then(r=>setSavedClients(r.items||[])).catch(()=>{});
    }catch(e){setMessage(e.message)}finally{setBusy(false)}
  }

  async function confirmCompletedPayment(current,result){
    const saleId=current?.id||sale?.id; if(!saleId)return null;
    localStorage.setItem(`${activeKey}:bank-result`,JSON.stringify(result));
    setMessage('Pago aprobado. Estamos preparando la factura y su entrega por correo...');
    try{
      const data=await api(`/api/portal/ventas/${saleId}/pago/confirmar`,{method:'POST',body:JSON.stringify({sourceOrigin:config?.bank?.origin,payload:result})});
      localStorage.removeItem(`${activeKey}:bank-result`);
      hydrate(data);
      if(data.facturaId && data.estado==='entregada')finish(data);
      return data;
    }catch(e){
      localStorage.removeItem(`${activeKey}:bank-result`);
      if(e.data?.venta)hydrate(e.data.venta);
      throw e;
    }
  }

  async function recordNonCompletedResult(current,result){
    const saleId=current?.id||sale?.id; if(!saleId)return;
    try{
      const data=await api(`/api/portal/ventas/${saleId}/pago/resultado`,{method:'POST',body:JSON.stringify({sourceOrigin:config?.bank?.origin,payload:result})});
      hydrate(data);
    }catch{}
  }

  async function pay(){
    if(!sale)return;setBusy(true);setMessage('');
    try{
      const data=await api(`/api/portal/ventas/${sale.id}/pago/iniciar`,{method:'POST'});
      if(data.alreadyCompleted&&data.facturaId){const current=await api(`/api/portal/ventas/${sale.id}`);hydrate(current);if(current.estado==='entregada')finish(current);return}
      const waiting={...sale,estado:'esperando_banco'}; setSale(waiting); localStorage.setItem(activeKey,sale.id);
      setMessage('Completa el pago en BankyFinanzas. Esta venta permanecerá guardada aunque cierres o recargues esta página.');
      const result=await pagarConBanky({checkoutUrl:data.checkoutUrl,expectedOrigin:data.expectedOrigin||config?.bank?.origin});
      const status=String(result?.status||'').toLowerCase();
      if(status==='completed'){
        await confirmCompletedPayment(waiting,result);
      }else{
        await recordNonCompletedResult(waiting,result);
        setMessage(describirResultado(result));
      }
    }catch(e){setMessage(e.message)}finally{setBusy(false)}
  }

  async function refresh(){if(!sale)return null;try{const current=await api(`/api/portal/ventas/${sale.id}`);hydrate(current);if(current.facturaId && current.estado==='entregada')finish(current);return current}catch(e){setMessage(e.message);return null}}
  async function finish(current){
    localStorage.removeItem(activeKey);localStorage.removeItem(`${activeKey}:bank-result`);
    setInvoiceReady(current.facturaId);setMessage('');onCompleted?.();
    if(config?.ecosystem?.emailBrowserFormAction && current?.facturaId){
      const customerEmail=current?.receptor?.correo||receptor.correo;
      const ownerEmail=me?.correoFacturacion||me?.email;
      const sentKey=`factura_bonita_form_sent_${current.facturaId}_${customerEmail}`;
      if(!localStorage.getItem(sentKey)){
        setDeliveryMessage(`Preparando envío de la factura a ${customerEmail}...`);
        try{
          await submitInvoiceByFormAction({invoiceId:current.facturaId,customerEmail,ownerEmail});
          localStorage.setItem(sentKey,'1');
          setDeliveryMessage(`Factura enviada al correo indicado: ${customerEmail}.`);
        }catch(e){
          setDeliveryMessage(e.message||'No se pudo iniciar el envío de la factura por correo.');
        }
      }
    }
  }


  async function retryProcessing(){
    if(!sale)return;setBusy(true);setMessage('Reintentando el procesamiento de documentos...');
    try{
      const current=await api(`/api/portal/ventas/${sale.id}/reintentar`,{method:'POST'});
      hydrate(current);
      if(current.facturaId && current.estado==='entregada')finish(current);
      else setMessage('El proceso sigue en curso.');
    }catch(e){
      setMessage(e.message);
      try{const current=await api(`/api/portal/ventas/${sale.id}`);hydrate(current)}catch{}
    }finally{setBusy(false)}
  }

  useEffect(()=>{
    if(!sale?.id || !sale?.pago?.transactionCode || ['entregada','procesamiento_fallido'].includes(sale.estado))return;
    const timer=window.setInterval(async()=>{
      try{
        const current=await api(`/api/portal/ventas/${sale.id}`);
        hydrate(current);
        if(current.facturaId && current.estado==='entregada'){window.clearInterval(timer);finish(current)}
      }catch{}
    },3000);
    return()=>window.clearInterval(timer);
  },[sale?.id,sale?.estado,sale?.pago?.transactionCode]);

  const integrationSteps=useMemo(()=>{
    const latest={};
    for(const step of sale?.integraciones||[])latest[step.servicio]=step;
    const keys=config?.ecosystem?.enabled?['firma_digital','facturacion_electronica','tributacion','entrega_correo']:['entrega_correo'];
    return keys.map(key=>({key,label:config?.ecosystem?.enabled?integrationLabel[key]:(key==='entrega_correo'?(config?.ecosystem?.emailBrowserFormAction?'Factura por correo':config?.ecosystem?.emailTestMode?'Factura de prueba':'Factura por correo'):integrationLabel[key]),step:latest[key]||null}));
  },[sale?.integraciones,config?.ecosystem?.enabled]);

  const filteredClients=useMemo(()=>{const q=clientSearch.trim().toLowerCase();return !q?savedClients.slice(0,6):savedClients.filter(c=>`${c.nombre} ${c.numero} ${c.correo}`.toLowerCase().includes(q)).slice(0,6)},[savedClients,clientSearch]);
  const status=sale?.estado||'nuevo';
  if(restoring)return <section className="panel sale-panel"><div className="empty-state">Recuperando tu venta...</div></section>;
  return <section className="panel sale-panel">
    <div className="panel-heading"><div><span className="eyebrow">NUEVA VENTA</span><h2>Registra lo que vas a cobrar</h2><p className="muted">Los datos de <b>{me?.empresa}</b> ya están cargados desde tu cuenta. Completa únicamente el cliente y los conceptos de esta venta.</p></div>{sale&&<span className={`status-chip ${status}`}>{statusLabel[status]||'Procesando'}</span>}</div>

    <div className="seller-strip"><div><span>Emisor</span><strong>{me?.empresa}</strong></div><div><span>Identificación</span><strong>{me?.numeroIdentificacion}</strong></div><div><span>Correo de factura</span><strong>{me?.correoFacturacion}</strong></div></div>

    <fieldset className="sale-lock" disabled={Boolean(sale)&&!editing}><div className="sale-grid">
      <div className="client-form"><div className="section-heading-inline"><div><h3>¿A quién le vendes?</h3><p className="muted small">Estos datos aparecerán como cliente en la factura.</p></div></div>{savedClients.length>0&&<div className="client-picker"><label>Buscar cliente guardado<input value={clientSearch} onChange={e=>setClientSearch(e.target.value)} placeholder="Nombre, identificación o correo" /></label>{clientSearch&&<div className="client-results">{filteredClients.length?filteredClients.map(c=><button type="button" key={c.id} onClick={()=>{pickClient(c.id);setClientSearch('')}}><strong>{c.nombre}</strong><span>{c.numero} · {c.correo}</span></button>):<span className="no-client-match">No encontramos coincidencias.</span>}</div>}</div>}
        <label>Nombre o razón social<input maxLength="160" placeholder="Ej. Empresa Cliente S.A." value={receptor.nombre} onChange={e=>setReceptor({...receptor,nombre:e.target.value})}/></label>
        <div className="form-grid two"><label>Correo de entrega<input type="email" placeholder="cliente@correo.com" value={receptor.correo} onChange={e=>setReceptor({...receptor,correo:e.target.value})}/><small className="field-help">{config?.ecosystem?.emailBrowserFormAction?'Aquí se enviará la factura PDF cuando el pago sea aprobado.':config?.ecosystem?.emailTestMode?'Este correo se valida para la prueba de factura.':'Aquí se enviará la factura PDF cuando el pago sea aprobado.'}</small></label><label>Tipo de identificación<select value={receptor.tipo} onChange={e=>setReceptor({...receptor,tipo:e.target.value})}><option value="01">Persona física</option><option value="02">Persona jurídica</option><option value="03">DIMEX</option><option value="04">NITE</option></select></label></div>
        <label>Número de identificación<input inputMode="numeric" placeholder="Solo números" value={receptor.numero} onChange={e=>setReceptor({...receptor,numero:digits(e.target.value,12)})}/></label>
        <button type="button" className="text-toggle" onClick={()=>setAdvanced(!advanced)}>{advanced?'Ocultar información opcional':'Agregar información opcional del cliente'}</button>
        {advanced&&<div className="advanced-client"><div className="form-grid two"><label>Nombre comercial<input value={receptor.nombreComercial} onChange={e=>setReceptor({...receptor,nombreComercial:e.target.value})}/></label><label>Actividad económica<input inputMode="numeric" value={receptor.actividadEconomica} onChange={e=>setReceptor({...receptor,actividadEconomica:digits(e.target.value,6)})} placeholder="6 dígitos"/></label><label>Teléfono<input inputMode="numeric" value={receptor.telefono} onChange={e=>setReceptor({...receptor,telefono:digits(e.target.value,12)})}/></label><label>Provincia<input value={receptor.provincia} maxLength="80" placeholder="Ej. San José" onChange={e=>setReceptor({...receptor,provincia:e.target.value})}/></label><label>Cantón<input value={receptor.canton} maxLength="80" placeholder="Ej. Escazú" onChange={e=>setReceptor({...receptor,canton:e.target.value})}/></label><label>Distrito<input value={receptor.distrito} maxLength="80" placeholder="Ej. San Rafael" onChange={e=>setReceptor({...receptor,distrito:e.target.value})}/></label></div><label>Dirección / otras señas<input value={receptor.otrasSenas} onChange={e=>setReceptor({...receptor,otrasSenas:e.target.value})}/></label></div>}
      </div>
      <aside className="summary-card compact-money-card"><div className="summary-heading"><span>Resumen de la venta</span><small>CRC</small></div><div className="summary-row"><span>Base</span><strong>{money(totals.venta)}</strong></div>{totals.descuento>0&&<div className="summary-row discount"><span>Descuento</span><strong>- {money(totals.descuento)}</strong></div>}<div className="summary-row"><span>IVA</span><strong>{money(totals.impuesto)}</strong></div><div className="summary-total"><span>Total a cobrar</span><b>{money(totals.total)}</b></div></aside>
    </div>

    <div className="items-editor"><div className="items-title"><div><h3>¿Qué estás vendiendo?</h3><p className="muted small">Agrega cada producto o servicio tal como quieres que aparezca en la factura.</p></div><button className="secondary" onClick={()=>setItems([...items,emptyItem()])}>Agregar concepto</button></div>
      {items.map((i,idx)=><article className="sale-item" key={idx}><div className="item-main polished-item-main">
        <label className="description-field">Descripción<input placeholder="Ej. Servicio de soporte mensual" value={i.detalle} onChange={e=>updateItem(idx,'detalle',e.target.value)} maxLength="255"/></label>
        <label>Cantidad<input inputMode="numeric" value={i.cantidad} onChange={e=>updateItem(idx,'cantidad',whole(e.target.value,100000))}/></label>
        <label>Precio unitario<div className="input-affix prefix"><span>₡</span><input inputMode="numeric" placeholder="0" value={i.precioUnitario} onChange={e=>updateItem(idx,'precioUnitario',whole(e.target.value))}/></div></label>
        <label>IVA<select value={i.impuestoTarifa} onChange={e=>updateItem(idx,'impuestoTarifa',e.target.value)}><option value="0">0 %</option><option value="1">1 %</option><option value="2">2 %</option><option value="4">4 %</option><option value="13">13 %</option></select></label>
        <button className="remove-line" disabled={items.length===1} onClick={()=>setItems(items.filter((_,x)=>x!==idx))}>Eliminar</button>
      </div><details className="item-details"><summary>Más opciones de este concepto</summary><div className="item-detail-grid"><label>CAByS <small>Opcional en este comprobante visual. Es el código oficial de 13 dígitos para clasificar un bien o servicio.</small><input inputMode="numeric" placeholder="13 dígitos, si lo conoces" value={i.codigoCabys} onChange={e=>updateItem(idx,'codigoCabys',digits(e.target.value,13))}/></label><label>Tipo<select value={i.tipoItem} onChange={e=>updateItem(idx,'tipoItem',e.target.value)}><option value="servicio">Servicio</option><option value="mercancia">Producto</option></select></label><label>Unidad<select value={i.unidadMedida} onChange={e=>updateItem(idx,'unidadMedida',e.target.value)}><option value="Sp">Servicio</option><option value="Unid">Unidad</option><option value="h">Hora</option><option value="d">Día</option><option value="mes">Mes</option></select></label><label>Unidad comercial<input placeholder="Ej. Mes" value={i.unidadMedidaComercial} onChange={e=>updateItem(idx,'unidadMedidaComercial',e.target.value)}/></label><label>Código interno<input placeholder="Opcional" value={i.codigoComercial} onChange={e=>updateItem(idx,'codigoComercial',e.target.value)}/></label><label>Descuento<div className="input-affix prefix"><span>₡</span><input inputMode="numeric" value={i.descuento} onChange={e=>updateItem(idx,'descuento',whole(e.target.value))}/></div></label></div></details></article>)}
    </div>

    </fieldset>
    <div className={`checkout-strip ${sale&&!editing?'saved-checkout':''}`}><div className="checkout-copy"><strong>{sale?(editing?'Editando venta':'Venta guardada'):'Revisa y guarda la venta'}</strong><span>{sale?(editing?'Guarda los cambios antes de pagar.':status==='entregada'?(config?.ecosystem?.emailBrowserFormAction?'La factura quedó lista y se inició su entrega al correo indicado.':config?.ecosystem?.emailTestMode?'La factura de prueba quedó lista para ver o guardar.':'Los documentos fueron enviados al correo del cliente.'):sale?.pago?.transactionCode?('Pago aprobado. Estamos preparando la entrega de los documentos.'):'Tus datos quedan guardados aunque salgas a completar el pago.'):'Primero guardamos esta venta; después podrás cobrarla.'}</span>{sale&&!editing&&<div className="secondary-sale-actions"><button className="link-quiet" disabled={status!=='pendiente_pago'} onClick={()=>setEditing(true)}>Editar venta</button><button className="link-quiet" onClick={reset}>Nueva venta</button></div>}</div>{!sale?<div className="actions"><button className="primary" disabled={busy||totals.total<=0} onClick={create}>Guardar venta</button></div>:editing?<div className="actions"><button className="primary" disabled={busy||totals.total<=0} onClick={create}>Guardar cambios</button><button className="secondary" onClick={()=>setEditing(false)}>Cancelar edición</button></div>:<div className="pay-zone"><span>Total guardado</span><strong>{money(sale.total||totals.total)}</strong><button className="bank-button" disabled={busy||status==='entregada'||Boolean(sale?.pago?.transactionCode)||!config?.bank?.ready} onClick={pay}>{busy?'Procesando...':status==='esperando_banco'?'Continuar pago':'Pagar ahora'}</button></div>}</div>
    {sale?.pago?.transactionCode&&<div className="process-tracker"><div className="process-tracker-head"><div><strong>{config?.ecosystem?.emailBrowserFormAction?'Entrega de factura':config?.ecosystem?.emailTestMode?'Prueba de factura':'Entrega de documentos'}</strong><span>{config?.ecosystem?.emailBrowserFormAction?'La factura PDF se prepara para el correo indicado en la venta.':config?.ecosystem?.emailTestMode?'El correo se valida y la factura se genera para revisarla desde esta interfaz.':'Los documentos se preparan y se envían al correo registrado para la venta.'}</span></div><span className={`status-chip ${status}`}>{statusLabel[status]||'Procesando'}</span></div><div className="process-steps"><div className="process-step done"><i>✓</i><div><strong>Pago</strong><span>Aprobado por BankyFinanzas</span></div></div>{integrationSteps.map(({key,label,step})=><div className={`process-step ${doneStates.has(step?.estado)?'done':step?.estado==='fallida'||step?.estado==='pendiente_configuracion'?'failed':step?'active':'pending'}`} key={key}><i>{doneStates.has(step?.estado)?'✓':step?.estado==='fallida'||step?.estado==='pendiente_configuracion'?'!':'•'}</i><div><strong>{label}</strong><span>{step?.mensaje||'Pendiente'}</span></div></div>)}</div>{status==='procesamiento_fallido'&&<div className="process-retry"><span>{'El pago fue aprobado. La entrega todavía está pendiente y puede reintentarse.'}</span><button className="secondary" disabled={busy} onClick={retryProcessing}>Reintentar procesamiento</button></div>}</div>}
    {sale&&!editing&&!config?.bank?.ready&&<div className="alert warning">Antes de pagar, configura y confirma la afiliación de tu negocio en la sección <b>Cobros</b>.</div>}
    {message&&<div className="alert info">{message}</div>}{deliveryMessage&&<div className="alert info">{deliveryMessage}</div>}{sale?.errorDetalle&&sale?.pago?.transactionCode&&sale.errorDetalle!==message&&<div className="alert error">{sale.errorDetalle}</div>}
    <InvoiceReadyModal invoiceId={invoiceReady} onClose={()=>setInvoiceReady(null)} onNewSale={reset}/>
  </section>
}
