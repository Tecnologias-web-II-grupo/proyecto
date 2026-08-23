import React, { useEffect, useState } from 'react';
import { api, getToken, setToken } from './api';
import AuthPanel from './components/AuthPanel.jsx';
import LogoDesigner from './components/LogoDesigner.jsx';
import SaleWorkspace from './components/SaleWorkspace.jsx';
import IntegrationPanel from './components/IntegrationPanel.jsx';

export default function App(){
  const [me,setMe]=useState(null);const [config,setConfig]=useState(null);const [loading,setLoading]=useState(true);
  async function load(){setLoading(true);try{const [c,u]=await Promise.all([api('/api/portal/config'),getToken()?api('/api/portal/me'):Promise.resolve(null)]);setConfig(c);setMe(u)}catch{setToken('');setMe(null);try{setConfig(await api('/api/portal/config'))}catch{}}finally{setLoading(false)}}
  useEffect(()=>{load()},[]);
  if(loading)return <div className="splash">API Factura</div>;
  return <div className="app-shell">
    <header className="site-header"><div className="brand-mark">AF</div><div><b>API Factura</b><span>Venta, integración y comprobante</span></div><nav><a href="/docs" target="_blank">Endpoints</a>{me&&<button onClick={()=>{setToken('');setMe(null)}}>Cerrar sesión</button>}</nav></header>
    {!me?<main className="landing"><section className="hero-copy"><span className="eyebrow">SERVICIO DE FACTURACIÓN AL CLIENTE</span><h1>Vende, conecta servicios y genera la factura al final del flujo.</h1><p>Registra tu negocio, configura tu identidad visual y procesa ventas conectadas por API REST. El banco se abre en una ventana separada y la factura se genera únicamente cuando el pago y las integraciones terminan correctamente.</p><div className="mini-flow"><span>Registro</span><b>→</b><span>Venta</span><b>→</b><span>Banco</span><b>→</b><span>APIs</span><b>→</b><span>Factura</span></div></section><AuthPanel onReady={load}/></main>:
      <main className="dashboard"><section className="welcome"><div><span className="eyebrow">CUENTA ACTIVA</span><h1>{me.empresa}</h1><p>{me.nombre} · {me.email}</p></div><div className="connected"><i></i> API disponible</div></section><IntegrationPanel config={config}/><SaleWorkspace config={config}/><LogoDesigner me={me} onSaved={setMe}/></main>}
    <footer className="site-footer"><span>API Factura</span><span>Facturación al cliente mediante API REST</span></footer>
  </div>
}
