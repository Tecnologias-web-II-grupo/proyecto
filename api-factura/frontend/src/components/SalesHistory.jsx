import React, { useEffect, useState } from 'react';
import { api } from '../api';

const money=(n)=>`₡${Number(n||0).toLocaleString('es-CR',{minimumFractionDigits:2,maximumFractionDigits:2})}`;

async function downloadInvoice(id){
  const response=await fetch(`/api/documentos/facturas/${id}?formato=pdf&plantilla=generica`);
  if(!response.ok)throw new Error('No se pudo guardar la factura.');
  const blob=await response.blob();
  const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`factura-${id}.pdf`;document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
}

export default function SalesHistory({refreshKey}){
  const [items,setItems]=useState([]);const [loading,setLoading]=useState(true);const [error,setError]=useState('');
  async function load(){setLoading(true);setError('');try{const data=await api('/api/portal/ventas');setItems(data.items||[])}catch(e){setError(e.message)}finally{setLoading(false)}}
  useEffect(()=>{load()},[refreshKey]);
  return <section className="panel history-panel">
    <div className="panel-heading"><div><span className="eyebrow">TUS COMPROBANTES</span><h2>Ventas recientes</h2><p className="muted">Consulta las ventas procesadas y vuelve a abrir o guardar tus facturas.</p></div><button className="secondary" onClick={load}>Actualizar</button></div>
    {error&&<div className="alert error">{error}</div>}
    {loading?<div className="empty-state">Cargando...</div>:!items.length?<div className="empty-state"><b>Aún no tienes ventas.</b><span>Cuando completes tu primera venta aparecerá aquí.</span></div>:<div className="history-list">{items.map(v=><article key={v.id} className="history-row"><div><strong>{v.receptor?.nombre||'Cliente'}</strong><span>{new Date(v.createdAt).toLocaleString('es-CR')}</span></div><div className="history-amount"><b>{money(v.total)}</b><span>{v.estado==='facturada'?'Factura lista':v.estado==='pendiente_pago'?'Pendiente de pago':'En proceso'}</span></div><div className="history-actions">{v.facturaId&&<><a className="secondary anchor" target="_blank" rel="noreferrer" href={`/api/documentos/facturas/${v.facturaId}?formato=pdf&plantilla=generica`}>Ver</a><button className="secondary" onClick={()=>downloadInvoice(v.facturaId).catch(e=>setError(e.message))}>Guardar</button></>}</div></article>)}</div>}
  </section>
}
