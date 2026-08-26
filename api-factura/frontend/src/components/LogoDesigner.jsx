import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../api';

export default function LogoDesigner({ me, onSaved, onBack }){
  const [profile,setProfile]=useState(me);
  const [position,setPosition]=useState(me?.perfil?.logoPosicion||'left');
  const [file,setFile]=useState(null);
  const [whiteFile,setWhiteFile]=useState(null);
  const [msg,setMsg]=useState('');
  const [loadingProfile,setLoadingProfile]=useState(false);

  useEffect(()=>{
    let active=true;
    setProfile(me);
    setPosition(me?.perfil?.logoPosicion||'left');
    (async()=>{
      setLoadingProfile(true);
      try{
        const fresh=await api(`/api/portal/me?_=${Date.now()}`);
        if(!active)return;
        setProfile(fresh);
        setPosition(fresh?.perfil?.logoPosicion||'left');
        onSaved?.(fresh);
      }catch{}finally{ if(active)setLoadingProfile(false); }
    })();
    return()=>{active=false};
  },[]);

  const preview=useMemo(()=>file?URL.createObjectURL(file):profile?.perfil?.logoUrl,[file,profile]);
  useEffect(()=>()=>{ if(file && preview?.startsWith('blob:')) URL.revokeObjectURL(preview); },[file,preview]);

  async function save(){
    setMsg('');
    const fd=new FormData();
    fd.append('logoPosicion',position);
    if(file)fd.append('logo',file);
    if(whiteFile)fd.append('logoBlanco',whiteFile);
    try{
      await api('/api/portal/perfil',{method:'PUT',body:fd});
      const fresh=await api(`/api/portal/me?_=${Date.now()}`);
      setProfile(fresh);
      setPosition(fresh?.perfil?.logoPosicion||position);
      setFile(null);
      setWhiteFile(null);
      setMsg(fresh?.perfil?.logoUrl ? 'Logo guardado y verificado.' : 'Configuración guardada.');
      onSaved?.(fresh);
    }catch(e){ setMsg(e.message); }
  }

  return <section className="panel brand-panel">
    <div className="panel-heading"><div><span className="eyebrow">TU LOGO</span><h2>Personaliza tu factura</h2><p className="muted">Sube tu logo y elige dónde quieres que aparezca en el encabezado del comprobante.</p></div>{onBack&&<button type="button" className="back-button" onClick={onBack}>← Volver</button>}</div>
    <div className="designer-grid logo-only-grid">
      <div className="logo-controls">
        <label>Logo principal<input type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>setFile(e.target.files?.[0]||null)} /></label>
        <label className="optional-field">Logo claro <small>Opcional, útil si alguna plantilla usa fondo oscuro</small><input type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>setWhiteFile(e.target.files?.[0]||null)} /></label>
        <div><span className="field-title">Posición del logo</span><div className="segmented">{['left','center','right'].map(p=><button type="button" key={p} className={position===p?'active':''} onClick={()=>setPosition(p)}>{p==='left'?'Izquierda':p==='center'?'Centro':'Derecha'}</button>)}</div></div>
        <div className="brand-note"><strong>{profile?.empresa}</strong><span>{profile?.perfil?.logoUrl?'✓ Logo guardado en tu cuenta. Se cargará automáticamente al volver a entrar.':'Los datos fiscales de tu negocio se toman de la cuenta con la que te registraste.'}</span></div>
        <button className="primary" onClick={save} disabled={loadingProfile}>{loadingProfile?'Cargando perfil...':'Guardar logo'}</button>{msg&&<span className="inline-message">{msg}</span>}
      </div>
      <div className="paper-preview">
        <div className={`preview-logo ${position}`}>{preview?<img src={preview} alt="Vista previa del logo"/>:<span>Tu logo</span>}</div>
        <div className="preview-head"><strong>{profile?.empresa||'Tu empresa'}</strong><b>FACTURA</b></div>
        <div className="preview-lines"><span></span><span></span><span></span></div>
        <div className="preview-total">TOTAL <strong>₡84 750</strong></div>
      </div>
    </div>
  </section>
}
