import React, { useEffect, useMemo, useState } from 'react';
import { api, getToken, setToken } from './api';
import AuthPanel from './components/AuthPanel.jsx';
import LogoDesigner from './components/LogoDesigner.jsx';
import SaleWorkspace from './components/SaleWorkspace.jsx';
import SalesHistory from './components/SalesHistory.jsx';

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
      <div className="brand-copy-ui"><b>Factura Bonita</b><span>Comprobantes claros para tu negocio</span></div>
      {me&&<nav className="customer-nav">
        <button className={tab==='sale'?'active':''} onClick={()=>setTab('sale')}>Nueva venta</button>
        <button className={tab==='history'?'active':''} onClick={()=>setTab('history')}>Mis facturas</button>
        <button className={tab==='brand'?'active':''} onClick={()=>setTab('brand')}>Mi marca</button>
        <button className="logout" onClick={()=>{setToken('');setMe(null)}}>Salir</button>
      </nav>}
    </header>

    {!me?
      <main className="landing">
        <section className="hero-copy">
          <span className="eyebrow">FACTURACIÓN PARA TU NEGOCIO</span>
          <h1>Vende con tranquilidad. Tu factura queda lista al finalizar el pago.</h1>
          <p>Crea tu cuenta, registra una venta y personaliza el comprobante con la identidad de tu negocio. El pago se completa en una ventana segura y, al aprobarse, tu factura queda disponible para verla o guardarla.</p>
          <div className="benefits"><span>Cuenta independiente</span><span>Pago antes de facturar</span><span>Logo personalizado</span></div>
        </section>
        <AuthPanel onReady={load}/>
      </main>
      :
      <main className="dashboard">
        <section className="welcome compact-welcome">
          <div><span className="eyebrow">TU NEGOCIO</span><h1>{me.empresa}</h1><p>Hola, {me.nombre}. Todo listo para seguir vendiendo.</p></div>
        </section>
        {tab==='sale'&&<SaleWorkspace config={config} me={me} onCompleted={()=>setRefreshKey(k=>k+1)}/>} 
        {tab==='history'&&<SalesHistory refreshKey={refreshKey}/>} 
        {tab==='brand'&&<LogoDesigner me={me} onSaved={setMe}/>} 
      </main>
    }
    <footer className="site-footer"><span>Factura Bonita</span><span>Comprobantes para tus ventas</span></footer>
  </div>
}
