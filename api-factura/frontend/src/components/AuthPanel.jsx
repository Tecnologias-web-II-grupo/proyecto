import React, { useState } from 'react';
import { api, setToken } from '../api';

export default function AuthPanel({ onReady }) {
  const [mode,setMode] = useState('login');
  const [form,setForm] = useState({ nombre:'', email:'', password:'', empresa:'', tipoIdentificacion:'02', numeroIdentificacion:'', correoFacturacion:'' });
  const [error,setError]=useState(''); const [loading,setLoading]=useState(false);
  const change=e=>setForm(f=>({...f,[e.target.name]:e.target.value}));
  async function submit(e){
    e.preventDefault(); setError(''); setLoading(true);
    try{
      if(mode==='register'){
        await api('/api/portal/auth/register',{method:'POST',body:JSON.stringify(form)});
      }
      const login=await api('/api/portal/auth/login',{method:'POST',body:JSON.stringify({email:form.email,password:form.password})});
      setToken(login.token); onReady();
    }catch(err){setError(err.message)} finally{setLoading(false)}
  }
  return <section className="auth-shell">
    <div className="auth-card">
      <div className="eyebrow">PORTAL DEL SERVICIO</div>
      <h2>{mode==='login'?'Iniciar sesión':'Crear cuenta'}</h2>
      <p className="muted">Registra tu negocio, configura tu factura y procesa ventas conectadas por API REST.</p>
      <form onSubmit={submit}>
        {mode==='register' && <>
          <label>Nombre responsable<input name="nombre" value={form.nombre} onChange={change} required /></label>
          <label>Empresa / razón social<input name="empresa" value={form.empresa} onChange={change} required /></label>
          <div className="form-grid two"><label>Tipo identificación<select name="tipoIdentificacion" value={form.tipoIdentificacion} onChange={change}><option value="01">Física</option><option value="02">Jurídica</option><option value="03">DIMEX</option><option value="04">NITE</option></select></label><label>Número<input name="numeroIdentificacion" value={form.numeroIdentificacion} onChange={change} required /></label></div>
        </>}
        <label>Correo<input type="email" name="email" value={form.email} onChange={change} required /></label>
        {mode==='register' && <label>Correo de facturación<input type="email" name="correoFacturacion" value={form.correoFacturacion} onChange={change} placeholder="Puede ser el mismo correo" /></label>}
        <label>Contraseña<input type="password" name="password" value={form.password} onChange={change} minLength="8" required /></label>
        {error && <div className="alert error">{error}</div>}
        <button className="primary wide" disabled={loading}>{loading?'Procesando...':mode==='login'?'Entrar':'Registrar negocio'}</button>
      </form>
      <button className="link-button" onClick={()=>{setMode(mode==='login'?'register':'login');setError('')}}>{mode==='login'?'¿Primera vez? Crear cuenta':'Ya tengo cuenta'}</button>
    </div>
  </section>
}
