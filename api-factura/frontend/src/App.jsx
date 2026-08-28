import React, { useEffect, useState } from 'react';
import { api, getToken, setToken } from './api';
import AuthPanel from './components/AuthPanel.jsx';
import LogoDesigner from './components/LogoDesigner.jsx';
import SalesHistory from './components/SalesHistory.jsx';
import IntegrationPanel from './components/IntegrationPanel.jsx';
import ServiceGuide from './components/ServiceGuide.jsx';
import AccountProfile from './components/AccountProfile.jsx';
import { confirmAction } from './utils/alerts.js';

export default function App(){
  const [me,setMe]=useState(null);
  const [config,setConfig]=useState(null);
  const [loading,setLoading]=useState(true);
  const [tab,setTab]=useState('history');
  const [refreshKey,setRefreshKey]=useState(0);
  const [guideOpen,setGuideOpen]=useState(false);

  async function load(){
    setLoading(true);
    try{
      const [c,u]=await Promise.all([api('/api/portal/config'),getToken()?api('/api/portal/me'):Promise.resolve(null)]);
      setConfig(c);setMe(u);
    }catch{
      setToken('');setMe(null);
      try{setConfig(await api('/api/portal/config'))}catch{}
    }finally{setLoading(false)}
  }
  useEffect(()=>{load()},[]);
  async function logout(){
    const confirmed=await confirmAction({
      title:'¿Cerrar sesión?',
      text:'Tendrás que ingresar nuevamente para acceder a tus facturas y configuración.',
      confirmText:'Cerrar sesión'
    });
    if(!confirmed)return;
    setToken('');setMe(null);setGuideOpen(false);setTab('history');
  }
  if(loading)return <div className="splash">Factura Bonita</div>;

  return <div className="app-shell">
    <header className="site-header">
      <div className="brand-mark">FB</div>
      <div className="brand-copy-ui"><b>Factura Bonita</b><span>Comprobantes PDF para sistemas conectados</span></div>
      {!me&&<button type="button" className="header-guide-button" onClick={()=>setGuideOpen(true)}>Cómo funciona</button>}
      {me&&<nav className="customer-nav">
        <button className={tab==='history'&&!guideOpen?'active':''} onClick={()=>{setGuideOpen(false);setTab('history')}}>Mis facturas</button>
        <button className={tab==='brand'&&!guideOpen?'active':''} onClick={()=>{setGuideOpen(false);setTab('brand')}}>Mi logo</button>
        <button className={tab==='integration'&&!guideOpen?'active':''} onClick={()=>{setGuideOpen(false);setTab('integration')}}>Integración</button>
        <button className={guideOpen?'active':''} onClick={()=>setGuideOpen(true)}>Ayuda</button>
        <button className={tab==='profile'&&!guideOpen?'active':''} onClick={()=>{setGuideOpen(false);setTab('profile')}}>Mi perfil</button>
        <button className="logout" onClick={logout}>Salir</button>
      </nav>}
    </header>

    {guideOpen?
      <main className="dashboard guide-dashboard"><ServiceGuide loggedIn={Boolean(me)} onBack={()=>setGuideOpen(false)}/></main>
      :!me?
      <main className="landing service-landing">
        <section className="hero-copy">
          <span className="eyebrow">SERVICIO DE FACTURA VISUAL</span>
          <h1>Tu sistema vende. Factura Bonita presenta el comprobante.</h1>
          <p>Registra tu negocio, configura el logo y conecta tu sistema mediante API REST. Cada factura creada con tu clave quedará disponible aquí como PDF de solo lectura.</p>
          <div className="benefits"><span>Registro de negocio</span><span>Logo configurable</span><span>Mis facturas PDF</span></div>
        </section>
        <AuthPanel onReady={load}/>
      </main>
      :
      <main className="dashboard">
        <section className="welcome compact-welcome">
          <div><span className="eyebrow">CUENTA DE FACTURACIÓN</span><h1>{me.empresa}</h1><p>Hola, {me.nombre}. Tu servicio de factura visual está disponible.</p></div>
          <span className="service-live-chip">● Servicio activo</span>
        </section>
        {tab==='history'&&<SalesHistory refreshKey={refreshKey}/>}
        {tab==='brand'&&<LogoDesigner me={me} onSaved={setMe}/>}
        {tab==='integration'&&<IntegrationPanel me={me} onSaved={setMe}/>}
        {tab==='profile'&&<AccountProfile me={me} onSignedOut={()=>{setMe(null);setGuideOpen(false);setTab('history')}}/>}
      </main>
    }
    <footer className="site-footer"><div><strong>Factura Bonita</strong><span>Factura visual PDF de solo lectura.</span></div><div className="footer-meta"><span>API REST</span><span>Logo</span><span>PDF</span></div></footer>
  </div>
}
