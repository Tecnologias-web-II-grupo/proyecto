import React, { useState } from 'react';
import { api } from '../api';

export default function IntegrationPanel({ me, onSaved }) {
  const [copied,setCopied]=useState('');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const key=me?.integration?.apiKey || '';
  const base=me?.integration?.apiBaseUrl || window.location.origin;

  async function copy(value,label){
    try{
      await navigator.clipboard.writeText(value);
      setCopied(label);
      window.setTimeout(()=>setCopied(''),1600);
    }catch{ setError('No se pudo copiar automáticamente. Selecciona el texto y cópialo manualmente.'); }
  }

  async function rotate(){
    if(!window.confirm('¿Generar una nueva clave? La clave anterior dejará de funcionar de inmediato.'))return;
    setBusy(true);setError('');
    try{
      await api('/api/portal/integracion/api-key/rotar',{method:'POST'});
      const fresh=await api('/api/portal/me');
      onSaved?.(fresh);
    }catch(e){setError(e.message)}finally{setBusy(false)}
  }

  return <section className="panel integration-panel">
    <div className="panel-heading">
      <div><span className="eyebrow">INTEGRACIÓN</span><h2>Conecta tu sistema con Factura Bonita</h2><p className="muted">Usa esta clave desde tu sistema autorizado. Las facturas creadas con ella aparecerán en “Mis facturas” y usarán el logo de esta cuenta.</p></div>
    </div>
    {error&&<div className="alert error">{error}</div>}
    <div className="integration-account-grid">
      <article className="integration-account-card">
        <span className="integration-account-icon">✓</span>
        <div><small>Servicio</small><strong>Factura visual PDF</strong><span>Activo y listo para recibir comprobantes.</span></div>
      </article>
      <article className="integration-account-card">
        <span className="integration-account-icon key">⌘</span>
        <div><small>Identificación</small><strong>{me?.empresa}</strong><span>Las facturas se asociarán a esta cuenta.</span></div>
      </article>
    </div>
    <div className="api-key-box">
      <div className="api-key-heading"><div><span className="eyebrow">CLAVE DE INTEGRACIÓN</span><h3>X-Api-Key</h3></div><button type="button" className="secondary" onClick={()=>copy(key,'key')}>{copied==='key'?'Copiada':'Copiar clave'}</button></div>
      <code className="api-key-value">{key}</code>
      <p>No publiques esta clave en el frontend. Debe guardarse únicamente en el backend del sistema cliente.</p>
    </div>
    <div className="integration-endpoints">
      <div><span>Crear factura visual</span><code>POST {base}/api/facturas</code><button type="button" onClick={()=>copy(`${base}/api/facturas`,'create')}>{copied==='create'?'Copiado':'Copiar'}</button></div>
      <div><span>Consultar PDF</span><code>GET {base}/api/documentos/facturas/:id?formato=pdf</code><button type="button" onClick={()=>copy(`${base}/api/documentos/facturas/:id?formato=pdf`,'pdf')}>{copied==='pdf'?'Copiado':'Copiar'}</button></div>
    </div>
    <div className="integration-security-note"><strong>Seguridad</strong><span>Si crees que la clave fue expuesta, genera una nueva. El cambio es inmediato.</span><button type="button" className="danger-outline" disabled={busy} onClick={rotate}>{busy?'Generando...':'Rotar clave'}</button></div>
  </section>;
}
