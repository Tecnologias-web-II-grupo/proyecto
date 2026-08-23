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
      if(mode==='register') await api('/api/portal/auth/register',{method:'POST',body:JSON.stringify(form)});
      const login=await api('/api/portal/auth/login',{method:'POST',body:JSON.stringify({email:form.email,password:form.password})});
      setToken(login.token); onReady();
    }catch(err){setError(err.message)} finally{setLoading(false)}
  }
  return <section className="auth-shell">
    <div className="auth-card">
      <span className="eyebrow">{mode==='login'?'BIENVENIDO':'EMPECEMOS'}</span>
      <h2>{mode==='login'?'Iniciar sesión':'Crear tu cuenta'}</h2>
      <p className="muted">{mode==='login'?'Ingresa para continuar con tus ventas.':'Registra tu negocio y deja preparada tu identidad para las facturas.'}</p>
      <form onSubmit={submit}>
        {mode==='register' && <>
          <label>Nombre de la persona responsable<input name="nombre" value={form.nombre} onChange={change} required /></label>
          <label>Nombre o razón social<input name="empresa" value={form.empresa} onChange={change} required /></label>
          <div className="form-grid two"><label>Tipo de identificación<select name="tipoIdentificacion" value={form.tipoIdentificacion} onChange={change}><option value="01">Persona física</option><option value="02">Persona jurídica</option><option value="03">DIMEX</option><option value="04">NITE</option></select></label><label>Número de identificación<input name="numeroIdentificacion" value={form.numeroIdentificacion} onChange={change} required /></label></div>
        </>}
        <label>Correo<input type="email" name="email" value={form.email} onChange={change} required /></label>
        {mode==='register' && <label>Correo para facturas<input type="email" name="correoFacturacion" value={form.correoFacturacion} onChange={change} placeholder="Si lo dejas vacío usaremos tu correo" /></label>}
        <label>Contraseña<input type="password" name="password" value={form.password} onChange={change} minLength="8" required /></label>
        {error && <div className="alert error">{error}</div>}
        <button className="primary wide" disabled={loading}>{loading?'Procesando...':mode==='login'?'Entrar':'Crear cuenta'}</button>
      </form>
      <button className="link-button" onClick={()=>{setMode(mode==='login'?'register':'login');setError('')}}>{mode==='login'?'¿Primera vez? Crear cuenta':'Ya tengo una cuenta'}</button>
    </div>
  </section>
}
