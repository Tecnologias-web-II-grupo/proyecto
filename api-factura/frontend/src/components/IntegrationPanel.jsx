import React from 'react';

export default function IntegrationPanel({ config }){
  const pipeline=config?.pipeline||[];
  return <section className="panel integration-panel">
    <div className="panel-heading"><div><span className="eyebrow">INTEROPERABILIDAD</span><h2>Servicios conectados</h2></div><span className="status-chip">API REST</span></div>
    <div className="integration-list">
      <div className="integration-item"><div className="service-icon bank">B</div><div><strong>Banco / Finanzas</strong><span>{config?.bank?.checkoutUrl||'Sin configurar'}</span></div><b className="connected-label">Conectado</b></div>
      {pipeline.map((x)=><div className="integration-item" key={x.name}><div className="service-icon">API</div><div><strong>{x.name}</strong><span>{x.url}</span></div><b className="connected-label">En pipeline</b></div>)}
      {!pipeline.length&&<div className="future-services">Los próximos endpoints se agregan en <code>SERVICE_PIPELINE_JSON</code>. La factura se genera únicamente cuando todos los servicios configurados terminan correctamente.</div>}
    </div>
  </section>
}
