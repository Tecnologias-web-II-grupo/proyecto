import React, { useState } from 'react';
import { api, setToken } from '../api';

const onlyDigits=(v,max)=>String(v||'').replace(/\D/g,'').slice(0,max);

export default function AuthPanel({ onReady }) {
  const initialMode = (() => {
    try {
      const p = new URLSearchParams(window.location.search);
      return ['1','true','registro','register'].includes(String(p.get('registro') || p.get('mode') || '').toLowerCase()) ? 'register' : 'login';
    } catch { return 'login'; }
  })();
  const [mode,setMode] = useState(initialMode);
  const [form,setForm] = useState({
    nombre:'', email:'', password:'', empresa:'', tipoIdentificacion:'02', numeroIdentificacion:'', correoFacturacion:'',
    actividadEconomica:'', telefono:'', provincia:'', canton:'', distrito:'', otrasSenas:''
  });
  const [error,setError]=useState(''); const [loading,setLoading]=useState(false);
  const change=e=>setForm(f=>({...f,[e.target.name]:e.target.value}));
  const changeDigits=(name,max)=>(e)=>setForm(f=>({...f,[name]:onlyDigits(e.target.value,max)}));

  function switchMode(){
    const next=mode==='login'?'register':'login';
    setMode(next);
    setError('');
    setForm({
      nombre:'', email:'', password:'', empresa:'', tipoIdentificacion:'02', numeroIdentificacion:'', correoFacturacion:'',
      actividadEconomica:'', telefono:'', provincia:'', canton:'', distrito:'', otrasSenas:''
    });
  }

  async function submit(e){
    e.preventDefault(); setError(''); setLoading(true);
    try{
      let registration=null;
      if(mode==='register') registration=await api('/api/portal/auth/register',{method:'POST',body:JSON.stringify(form)});
      const login=await api('/api/portal/auth/login',{method:'POST',body:JSON.stringify({email:form.email,password:form.password})});
      setToken(login.token);

      if(mode==='register' && registration?.integration?.apiKey && window.opener){
        try{
          const params=new URLSearchParams(window.location.search);
          const requested=params.get('returnUrl');
          const targetOrigin=requested ? new URL(requested).origin : '';
          if(targetOrigin && /^https?:\/\//i.test(targetOrigin)){
            window.opener.postMessage({
              type:'factura-bonita:registered',
              apiKey:registration.integration.apiKey,
              baseUrl:window.location.origin,
              empresa:registration.empresa
            },targetOrigin);
            window.setTimeout(()=>window.close(),450);
          }
        }catch{}
      }
      onReady();
    }catch(err){setError(err.message)} finally{setLoading(false)}
  }

  return <section className="auth-shell"><div className="auth-card">
    <span className="eyebrow">{mode==='login'?'BIENVENIDO':'CREA TU NEGOCIO'}</span>
    <h2>{mode==='login'?'Iniciar sesión':'Crear tu cuenta'}</h2>
    <p className="muted">{mode==='login'?'Ingresa para consultar tus facturas y administrar la integración.':'Con estos datos identificaremos a tu negocio y crearemos su acceso al servicio.'}</p>
    <form onSubmit={submit} autoComplete={mode==='register'?'off':'on'}>
      {mode==='register' && <>
        <label>Persona responsable<input name="nombre" value={form.nombre} onChange={change} maxLength="120" required /></label>
        <label>Nombre o razón social<input name="empresa" value={form.empresa} onChange={change} maxLength="160" required /></label>
        <div className="form-grid two"><label>Tipo de identificación<select name="tipoIdentificacion" value={form.tipoIdentificacion} onChange={change}><option value="01">Persona física</option><option value="02">Persona jurídica</option><option value="03">DIMEX</option><option value="04">NITE</option></select></label><label>Número de identificación<input inputMode="numeric" name="numeroIdentificacion" value={form.numeroIdentificacion} onChange={changeDigits('numeroIdentificacion',12)} placeholder="Solo números" required /></label></div>
      </>}
      <label>Correo<input type="email" name="email" value={form.email} onChange={change} required placeholder="nombre@correo.com" autoComplete={mode==='register'?'off':'email'} data-lpignore={mode==='register'?'true':undefined} data-1p-ignore={mode==='register'?'true':undefined} /></label>
      {mode==='register' && <label>Correo para facturas<input type="email" name="correoFacturacion" value={form.correoFacturacion} onChange={change} placeholder="facturacion@tunegocio.com" autoComplete="off" data-lpignore="true" data-1p-ignore="true" /></label>}
      <label>Contraseña<input type="password" name="password" value={form.password} onChange={change} minLength="8" required placeholder={mode==='register'?'Crea una contraseña segura':'Ingresa tu contraseña'} autoComplete={mode==='register'?'new-password':'current-password'} /></label>
      {mode==='register' && <details className="registration-extra"><summary>Datos fiscales y de contacto opcionales</summary><div className="registration-extra-body">
        <div className="form-grid two"><label>Código de actividad económica <small>Solo si lo conoces. Es el código de 6 dígitos de la actividad del negocio.</small><input inputMode="numeric" name="actividadEconomica" value={form.actividadEconomica} onChange={changeDigits('actividadEconomica',6)} placeholder="Ej. 620100" /></label><label>Teléfono<input inputMode="numeric" name="telefono" value={form.telefono} onChange={changeDigits('telefono',12)} placeholder="Ej. 88887777" /></label></div>
        <div className="form-grid three"><label>Provincia<input name="provincia" value={form.provincia} onChange={change} maxLength="80" placeholder="Ej. San José" /></label><label>Cantón<input name="canton" value={form.canton} onChange={change} maxLength="80" placeholder="Ej. Escazú" /></label><label>Distrito<input name="distrito" value={form.distrito} onChange={change} maxLength="80" placeholder="Ej. San Rafael" /></label></div>
        <label>Dirección / otras señas<input name="otrasSenas" value={form.otrasSenas} onChange={change} maxLength="255" /></label>
      </div></details>}
      {error && <div className="alert error">{error}</div>}
      <button className="primary wide" disabled={loading}>{loading?'Procesando...':mode==='login'?'Entrar':'Crear cuenta'}</button>
    </form>
    <button className="link-button" onClick={switchMode}>{mode==='login'?'¿Primera vez? Crear cuenta':'← Volver a iniciar sesión'}</button>
  </div></section>
}
