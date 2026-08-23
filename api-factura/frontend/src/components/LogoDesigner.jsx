import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../api';

export default function LogoDesigner({ me, onSaved }){
  const [position,setPosition]=useState(me?.perfil?.logoPosicion||'left');
  const [file,setFile]=useState(null); const [whiteFile,setWhiteFile]=useState(null);
  const [fields,setFields]=useState({nombreComercial:me?.perfil?.nombreComercial||'',actividadEconomica:me?.perfil?.actividadEconomica||'',telefono:me?.perfil?.telefono||'',provincia:me?.perfil?.ubicacion?.provincia||'',canton:me?.perfil?.ubicacion?.canton||'',distrito:me?.perfil?.ubicacion?.distrito||'',otrasSenas:me?.perfil?.ubicacion?.otrasSenas||''});
  const [msg,setMsg]=useState('');
  useEffect(()=>{setPosition(me?.perfil?.logoPosicion||'left')},[me]);
  const preview=useMemo(()=>file?URL.createObjectURL(file):me?.perfil?.logoUrl,[file,me]);
  async function save(){
    setMsg(''); const fd=new FormData(); Object.entries(fields).forEach(([k,v])=>fd.append(k,v)); fd.append('logoPosicion',position); if(file)fd.append('logo',file); if(whiteFile)fd.append('logoBlanco',whiteFile);
    try{const data=await api('/api/portal/perfil',{method:'PUT',body:fd}); setMsg('Configuración guardada.'); onSaved(data)}catch(e){setMsg(e.message)}
  }
  return <section className="panel">
    <div className="panel-heading"><div><span className="eyebrow">IDENTIDAD VISUAL</span><h2>Logo de tus facturas</h2></div><span className="status-chip">Se guarda por cuenta</span></div>
    <p className="muted">Sube tu logo y decide dónde aparecerá. La vista previa representa la zona superior del PDF.</p>
    <div className="designer-grid">
      <div className="logo-controls">
        <label>Logo principal<input type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>setFile(e.target.files?.[0]||null)} /></label>
        <label>Logo claro (opcional)<input type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>setWhiteFile(e.target.files?.[0]||null)} /></label>
        <div><span className="field-title">Posición</span><div className="segmented">{['left','center','right'].map(p=><button type="button" key={p} className={position===p?'active':''} onClick={()=>setPosition(p)}>{p==='left'?'Izquierda':p==='center'?'Centro':'Derecha'}</button>)}</div></div>
        <div className="form-grid two"><label>Nombre comercial<input value={fields.nombreComercial} onChange={e=>setFields({...fields,nombreComercial:e.target.value})}/></label><label>Actividad económica (6 dígitos)<input value={fields.actividadEconomica} onChange={e=>setFields({...fields,actividadEconomica:e.target.value})}/></label><label>Teléfono<input value={fields.telefono} onChange={e=>setFields({...fields,telefono:e.target.value})}/></label><label>Provincia (código)<input value={fields.provincia} onChange={e=>setFields({...fields,provincia:e.target.value})}/></label><label>Cantón (código)<input value={fields.canton} onChange={e=>setFields({...fields,canton:e.target.value})}/></label><label>Distrito (código)<input value={fields.distrito} onChange={e=>setFields({...fields,distrito:e.target.value})}/></label></div>
        <label>Otras señas<input value={fields.otrasSenas} onChange={e=>setFields({...fields,otrasSenas:e.target.value})}/></label>
        <button className="primary" onClick={save}>Guardar diseño</button>{msg&&<span className="inline-message">{msg}</span>}
      </div>
      <div className="paper-preview">
        <div className={`preview-logo ${position}`}>{preview?<img src={preview} alt="Vista previa del logo"/>:<span>Tu logo</span>}</div>
        <div className="preview-head"><strong>{me?.empresa||'Tu empresa'}</strong><b>FACTURA</b></div>
        <div className="preview-lines"><span></span><span></span><span></span></div>
        <div className="preview-total">TOTAL <strong>₡00 000,00</strong></div>
      </div>
    </div>
  </section>
}
