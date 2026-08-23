import React, { useState } from 'react';

async function downloadInvoice(id){
  const response=await fetch(`/api/documentos/facturas/${id}?formato=pdf&plantilla=generica`);
  if(!response.ok)throw new Error('No se pudo guardar la factura.');
  const blob=await response.blob();
  const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`factura-${id}.pdf`;document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
}
export default function InvoiceReadyModal({invoiceId,onClose,onNewSale}){
  const [error,setError]=useState('');
  if(!invoiceId)return null;
  return <div className="modal-backdrop"><section className="completion-modal"><div className="success-mark">✓</div><h2>Pago aprobado</h2><p>Tu factura ya está lista. ¿Qué deseas hacer?</p><div className="completion-actions"><a className="primary anchor" target="_blank" rel="noreferrer" href={`/api/documentos/facturas/${invoiceId}?formato=pdf&plantilla=generica`}>Ver factura</a><button className="secondary" onClick={()=>downloadInvoice(invoiceId).catch(e=>setError(e.message))}>Guardar PDF</button></div>{error&&<div className="alert error">{error}</div>}<button className="link-button" onClick={onNewSale}>Registrar otra venta</button><button className="modal-close" aria-label="Cerrar" onClick={onClose}>×</button></section></div>
}
