import React, { useEffect, useState } from 'react';
import { api } from '../api';

const money=(n)=>`CRC ${Number(n||0).toLocaleString('es-CR',{minimumFractionDigits:0,maximumFractionDigits:2})}`;

async function downloadInvoice(id){
  const response=await fetch(`/api/documentos/facturas/${encodeURIComponent(id)}?formato=pdf&plantilla=auto`);
  if(!response.ok)throw new Error('No se pudo descargar la factura.');
  const blob=await response.blob();
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');a.href=url;a.download=`factura-${id}.pdf`;document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
}

export default function SalesHistory({refreshKey}){
  const [items,setItems]=useState([]);const [loading,setLoading]=useState(true);const [error,setError]=useState('');
  async function load(){setLoading(true);setError('');try{const data=await api('/api/portal/facturas');setItems(data.items||[])}catch(e){setError(e.message)}finally{setLoading(false)}}
  useEffect(()=>{load()},[refreshKey]);

  return <section className="panel history-panel invoices-only-panel">
    <div className="panel-heading"><div><span className="eyebrow">TU ARCHIVO</span><h2>Mis facturas</h2><p className="muted">Aquí aparecen los comprobantes creados por los sistemas que utilizan la clave de integración de esta cuenta.</p></div><button type="button" className="secondary" onClick={load}>Actualizar</button></div>
    {error&&<div className="alert error">{error}</div>}
    {loading?<div className="empty-state">Cargando facturas...</div>:!items.length?<div className="empty-state"><b>Aún no hay facturas asociadas.</b><span>Conecta tu sistema desde la sección Integración. Cuando genere una factura, aparecerá aquí.</span></div>:<div className="history-list">{items.map(v=><article key={v.id} className="history-row invoice-history-row">
      <div><strong>{v.receptorNombre||'Cliente'}</strong><span>{new Date(v.createdAt||v.fecha).toLocaleString('es-CR')}</span><small>{v.origen||'sistema externo'}{v.referenciaExterna?` · ${v.referenciaExterna}`:''}</small></div>
      <div className="history-amount"><b>{money(v.total)}</b>{Number(v.descuento||0)>0&&<span>Descuento: {money(v.descuento)}</span>}<span className="status-chip entregada">PDF disponible</span></div>
      <div className="history-actions"><a className="secondary anchor" target="_blank" rel="noreferrer" href={v.pdfUrl}>Ver PDF</a><button className="secondary" onClick={()=>downloadInvoice(v.id).catch(e=>setError(e.message))}>Guardar</button></div>
    </article>)}</div>}
  </section>
}
