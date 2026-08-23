import React, { useEffect, useMemo, useState } from 'react';
import { api, getToken, setToken } from './api';
import AuthPanel from './components/AuthPanel.jsx';
import LogoDesigner from './components/LogoDesigner.jsx';
import SaleWorkspace from './components/SaleWorkspace.jsx';
import SalesHistory from './components/SalesHistory.jsx';
import BankConnection from './components/BankConnection.jsx';

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
      <div className="brand-copy-ui"><b>Factura Bonita</b><span>Facturas claras para tus ventas</span></div>
      {me&&<nav className="customer-nav">
        <button className={tab==='sale'?'active':''} onClick={()=>setTab('sale')}>Nueva venta</button>
        <button className={tab==='history'?'active':''} onClick={()=>setTab('history')}>Mis facturas</button>
        <button className={tab==='brand'?'active':''} onClick={()=>setTab('brand')}>Mi logo</button>
        <button className={tab==='bank'?'active':''} onClick={()=>setTab('bank')}>{me?.perfil?.bankAfiliado?'Cobros':'Cobros · configurar'}</button>
        <button className="logout" onClick={()=>{setToken('');setMe(null)}}>Salir</button>
      </nav>}
    </header>

    {!me?
      <main className="landing">
        <section className="hero-copy">
          <span className="eyebrow">FACTURA BONITA</span>
          <h1>Vende, cobra y entrega una factura clara.</h1>
          <p>Registra tu negocio, prepara una venta y cobra de forma segura. Cuando el pago queda aprobado, la factura se genera con los datos de la operación y queda lista para verla o guardarla.</p>
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
