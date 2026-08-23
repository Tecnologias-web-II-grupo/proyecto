import React, { useState } from 'react';
import { api, setToken } from '../api';

const onlyDigits=(v,max)=>String(v||'').replace(/\D/g,'').slice(0,max);

export default function AuthPanel({ onReady }) {
  const [mode,setMode] = useState('login');
  const [showPassword,setShowPassword]=useState(false);
  const [form,setForm] = useState({
    nombre:'', email:'', password:'', empresa:'', tipoIdentificacion:'02', numeroIdentificacion:'', correoFacturacion:'',
    actividadEconomica:'', telefono:'', provincia:'', canton:'', distrito:'', otrasSenas:''
  });
  const [error,setError]=useState('');
  const [loading,setLoading]=useState(false);
  const change=e=>setForm(f=>({...f,[e.target.name]:e.target.value}));
  const changeDigits=(name,max)=>(e)=>setForm(f=>({...f,[name]:onlyDigits(e.target.value,max)}));

  function switchMode(nextMode=mode==='login'?'register':'login'){
    setMode(nextMode);
    setShowPassword(false);
    setError('');
    setForm({
      nombre:'', email:'', password:'', empresa:'', tipoIdentificacion:'02', numeroIdentificacion:'', correoFacturacion:'',
      actividadEconomica:'', telefono:'', provincia:'', canton:'', distrito:'', otrasSenas:''
    });
  }

  async function submit(e){
    e.preventDefault();
    setError('');
    setLoading(true);
    try{
      if(mode==='register') await api('/api/portal/auth/register',{method:'POST',body:JSON.stringify(form)});
      const login=await api('/api/portal/auth/login',{method:'POST',body:JSON.stringify({email:form.email,password:form.password})});
      setToken(login.token);
      onReady();
    }catch(err){
      setError(err.message);
    }finally{
      setLoading(false);
    }
  }

  return <section className="auth-shell"><div className={`auth-card auth-card-polished ${mode==='register'?'register-mode':''}`}>
    <div className="auth-topline">
      <div className="auth-icon">FB</div>
      <div><span className="eyebrow">{mode==='login'?'ACCESO AL PORTAL':'REGISTRO DEL NEGOCIO'}</span><strong>{mode==='login'?'Factura Bonita':'Crea tu espacio de facturación'}</strong></div>
    </div>

    <div className="auth-mode-switch" aria-label="Seleccionar acceso o registro">
      <button type="button" className={mode==='login'?'active':''} onClick={()=>switchMode('login')}>Iniciar sesión</button>
      <button type="button" className={mode==='register'?'active':''} onClick={()=>switchMode('register')}>Crear cuenta</button>
    </div>

    <div className="auth-heading">
      <h2>{mode==='login'?'Bienvenido de nuevo':'Registra tu negocio'}</h2>
      <p className="muted">{mode==='login'?'Ingresa para continuar con tus ventas, cobros y facturas.':'Estos datos identificarán a tu negocio dentro del servicio y en las facturas que generes.'}</p>
    </div>

    <form onSubmit={submit} autoComplete={mode==='register'?'off':'on'}>
      {mode==='register' && <>
        <label>Persona responsable<input name="nombre" value={form.nombre} onChange={change} maxLength="120" required placeholder="Nombre completo" /></label>
        <label>Nombre o razón social<input name="empresa" value={form.empresa} onChange={change} maxLength="160" required placeholder="Ej. Innovatech S.A" /></label>
        <div className="form-grid two"><label>Tipo de identificación<select name="tipoIdentificacion" value={form.tipoIdentificacion} onChange={change}><option value="01">Persona física</option><option value="02">Persona jurídica</option><option value="03">DIMEX</option><option value="04">NITE</option></select></label><label>Número de identificación<input inputMode="numeric" name="numeroIdentificacion" value={form.numeroIdentificacion} onChange={changeDigits('numeroIdentificacion',12)} placeholder="Solo números" required /></label></div>
      </>}

      <label>Correo electrónico<input type="email" name="email" value={form.email} onChange={change} required placeholder={mode==='register'?'nombre@correo.com':'tu@correo.com'} autoComplete={mode==='register'?'off':'email'} data-lpignore={mode==='register'?'true':undefined} data-1p-ignore={mode==='register'?'true':undefined} /></label>
      {mode==='register' && <label>Correo para facturas<input type="email" name="correoFacturacion" value={form.correoFacturacion} onChange={change} placeholder="facturacion@tunegocio.com" autoComplete="off" data-lpignore="true" data-1p-ignore="true" /></label>}

      <label>Contraseña<div className="password-field"><input type={showPassword?'text':'password'} name="password" value={form.password} onChange={change} minLength="8" required placeholder={mode==='register'?'Mínimo 8 caracteres':'Ingresa tu contraseña'} autoComplete={mode==='register'?'new-password':'current-password'} /><button type="button" onClick={()=>setShowPassword(v=>!v)}>{showPassword?'Ocultar':'Mostrar'}</button></div></label>

      {mode==='register' && <details className="registration-extra"><summary>Datos fiscales y de contacto opcionales</summary><div className="registration-extra-body">
        <div className="form-grid two"><label>Código de actividad económica <small>Solo si lo conoces. Es el código de 6 dígitos de la actividad del negocio.</small><input inputMode="numeric" name="actividadEconomica" value={form.actividadEconomica} onChange={changeDigits('actividadEconomica',6)} placeholder="Ej. 620100" /></label><label>Teléfono<input inputMode="numeric" name="telefono" value={form.telefono} onChange={changeDigits('telefono',12)} placeholder="Ej. 88887777" /></label></div>
        <div className="form-grid three"><label>Provincia<input name="provincia" value={form.provincia} onChange={change} maxLength="80" placeholder="Ej. San José" /></label><label>Cantón<input name="canton" value={form.canton} onChange={change} maxLength="80" placeholder="Ej. Escazú" /></label><label>Distrito<input name="distrito" value={form.distrito} onChange={change} maxLength="80" placeholder="Ej. San Rafael" /></label></div>
        <label>Dirección / otras señas<input name="otrasSenas" value={form.otrasSenas} onChange={change} maxLength="255" /></label>
      </div></details>}

      {error && <div className="alert error">{error}</div>}
      <button className="primary wide auth-submit" disabled={loading}>{loading?'Procesando...':mode==='login'?'Entrar al portal':'Crear cuenta y continuar'}</button>
    </form>

    {mode==='login' && <div className="auth-footnote"><span>¿Primera vez en Factura Bonita?</span><button type="button" className="link-button" onClick={()=>switchMode('register')}>Crear una cuenta</button></div>}
    {mode==='register' && <button type="button" className="link-button" onClick={()=>switchMode('login')}>← Volver a iniciar sesión</button>}
  </div></section>;
}
