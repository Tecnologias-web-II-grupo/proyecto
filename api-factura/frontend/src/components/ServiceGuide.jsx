import React from 'react';

const steps=[
  ['1','Crea la cuenta','Registra la empresa que utilizará Factura Bonita.'],
  ['2','Configura el logo','El logo queda asociado a la cuenta y se usa en los PDF generados.'],
  ['3','Copia la clave','Desde Integración obtienes la X-Api-Key de tu negocio.'],
  ['4','Conecta tu sistema','EduControl u otro sistema envía la factura mediante API REST en JSON.'],
  ['5','Consulta el resultado','La factura queda guardada en Mis facturas y disponible como PDF de solo lectura.']
];

export default function ServiceGuide({onBack,loggedIn=false}){
  return <section className="panel guide-panel">
    <div className="panel-heading guide-heading"><div><span className="eyebrow">CÓMO FUNCIONA</span><h2>Factura Bonita como servicio</h2><p className="muted">Este portal no realiza ventas ni cobra. Recibe comprobantes desde sistemas conectados y genera la representación visual en PDF.</p></div>{onBack&&<button type="button" className="back-button" onClick={onBack}>← Volver</button>}</div>
    <div className="guide-flow service-guide-flow">{steps.map(([n,title,text])=><article className="guide-step" key={n}><span className="guide-number">{n}</span><div><h3>{title}</h3><p>{text}</p></div></article>)}</div>
    <div className="guide-grid">
      <article className="guide-card"><span className="eyebrow">RESPONSABILIDAD</span><h3>Factura visual PDF</h3><ul><li>Comprobante gráfico de solo lectura.</li><li>Logo configurable por cada negocio.</li><li>Consulta posterior desde Mis facturas.</li></ul></article>
      <article className="guide-card"><span className="eyebrow">INTEGRACIÓN</span><h3>API REST + JSON</h3><ul><li>POST /api/facturas</li><li>Cabecera X-Api-Key para asociar la cuenta.</li><li>Referencia externa idempotente.</li></ul></article>
      <article className="guide-card"><span className="eyebrow">OTROS SERVICIOS</span><h3>Separación de responsabilidades</h3><ul><li>Pago, firma digital, factura XML y Tributación pertenecen a sus respectivos servicios.</li><li>Factura Bonita no simula esos módulos.</li></ul></article>
    </div>
    {!loggedIn&&<div className="guide-cta"><strong>¿Primera vez?</strong><span>Crea la cuenta del negocio y luego copia su clave de integración.</span></div>}
  </section>;
}
