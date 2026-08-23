import React, { useEffect, useMemo, useState } from 'react';
import { api, getToken, setToken } from './api';
import AuthPanel from './components/AuthPanel.jsx';
import LogoDesigner from './components/LogoDesigner.jsx';
import SaleWorkspace from './components/SaleWorkspace.jsx';
import SalesHistory from './components/SalesHistory.jsx';
import BankConnection from './components/BankConnection.jsx';
import ServiceGuide from './components/ServiceGuide.jsx';

function PaymentReturnBridge(){
  useEffect(()=>{
    const params=new URLSearchParams(window.location.search);
    const reference=params.get('paymentReference')||params.get('reference')||params.get('referencia');
    if(!reference || !window.opener)return;
    const payload=Object.fromEntries(params.entries());
    try{window.opener.postMessage({type:'bank-return',reference,payload},window.location.origin)}catch{}
    window.setTimeout(()=>window.close(),350);
  },[]);
  return <div className="payment-return"><div className="loader-dot"></div><h2>Estamos confirmando tu pago</h2><p>Esta ventana se cerrará automáticamente.</p></div>;
}

export default function App(){
  const [me,setMe]=useState(null);
  const [config,setConfig]=useState(null);
  const [loading,setLoading]=useState(true);
  const [tab,setTab]=useState('sale');
  const [refreshKey,setRefreshKey]=useState(0);
  const [guideOpen,setGuideOpen]=useState(false);

  const isBankReturn=useMemo(()=>{
    const p=new URLSearchParams(window.location.search);
    return Boolean((p.get('paymentReference')||p.get('reference')||p.get('referencia')) && window.opener);
  },[]);

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
  if(isBankReturn)return <PaymentReturnBridge/>;
  if(loading)return <div className="splash">Factura Bonita</div>;

  return <div className="app-shell">
    <header className="site-header">
      <div className="brand-mark">FB</div>
      <div className="brand-copy-ui"><b>Factura Bonita</b><span>Facturas claras para tus ventas</span></div>
      {!me&&<button type="button" className="header-guide-button" onClick={()=>setGuideOpen(true)}>Cómo funciona</button>}
      {me&&<nav className="customer-nav">
        <button className={tab==='sale'&&!guideOpen?'active':''} onClick={()=>{setGuideOpen(false);setTab('sale')}}>Nueva venta</button>
        <button className={tab==='history'&&!guideOpen?'active':''} onClick={()=>{setGuideOpen(false);setTab('history')}}>Mis facturas</button>
        <button className={tab==='brand'&&!guideOpen?'active':''} onClick={()=>{setGuideOpen(false);setTab('brand')}}>Mi logo</button>
        <button className={tab==='bank'&&!guideOpen?'active':''} onClick={()=>{setGuideOpen(false);setTab('bank')}}>{me?.perfil?.bankAfiliado?'Cobros':'Cobros · configurar'}</button>
        <button className={guideOpen?'active':''} onClick={()=>setGuideOpen(true)}>Cómo funciona</button>
        <button className="logout" onClick={()=>{setToken('');setMe(null);setGuideOpen(false)}}>Salir</button>
      </nav>}
    </header>

    {guideOpen?
      <main className="dashboard guide-dashboard"><ServiceGuide loggedIn={Boolean(me)} onBack={()=>setGuideOpen(false)}/></main>
      :!me?
      <main className="landing">
        <section className="hero-copy">
          <span className="eyebrow">FACTURA BONITA</span>
          <h1>Vende, cobra y entrega una factura clara.</h1>
          <p>Registra tu negocio, prepara una venta y cobra de forma segura. Después del pago, Factura Bonita coordina la validación documental y entrega al cliente la factura visual, la factura electrónica y el acuse.</p>
          <div className="benefits"><span>Tu negocio y tus clientes</span><span>Factura después del pago</span><span>Logo a tu manera</span></div>
        </section>
        <AuthPanel onReady={load}/>
      </main>
      :
      <main className="dashboard">
        <section className="welcome compact-welcome">
          <div><span className="eyebrow">TU NEGOCIO</span><h1>{me.empresa}</h1><p>Hola, {me.nombre}. Todo listo para seguir vendiendo.</p></div>
        </section>
        {tab==='sale'&&<SaleWorkspace config={{...config,bank:{...(config?.bank||{}),ready:Boolean(me?.perfil?.bankAfiliado)}}} me={me} onCompleted={()=>setRefreshKey(k=>k+1)}/>} 
        {tab==='history'&&<SalesHistory refreshKey={refreshKey} onBack={()=>setTab('sale')}/>} 
        {tab==='brand'&&<LogoDesigner me={me} onSaved={setMe} onBack={()=>setTab('sale')}/>} 
        {tab==='bank'&&<BankConnection config={config} me={me} onSaved={setMe} onBack={()=>setTab('sale')}/>} 
      </main>
    }
    <footer className="site-footer"><div><strong>Factura Bonita</strong><span>Una forma simple de entregar tus facturas.</span></div><div className="footer-meta"><span>Ventas</span><span>Pagos</span><span>Facturas</span></div></footer>
  </div>
}
