import React from 'react';

const steps=[
  ['1','Crea tu cuenta','Registra tu negocio una sola vez. Esos datos se reutilizan como emisor en tus facturas.'],
  ['2','Prepara la venta','Selecciona o registra al cliente, agrega los conceptos y revisa el total antes de guardar.'],
  ['3','Guarda la venta','La venta queda pendiente y puedes volver a ella sin perder los datos.'],
  ['4','Realiza el cobro','Factura Bonita abre el servicio de pago conectado y conserva el resultado aprobado.'],
  ['5','Procesa los documentos','Después del pago se valida la firma, se obtiene la factura electrónica y se espera el acuse de Tributación.'],
  ['6','Entrega al cliente','Cuando todo está aceptado, el cliente recibe por correo la factura visual, la factura electrónica y el acuse.']
];

export default function ServiceGuide({onBack,loggedIn=false}){
  return <section className="panel guide-panel">
    <div className="panel-heading guide-heading">
      <div>
        <span className="eyebrow">CÓMO FUNCIONA</span>
        <h2>De la venta a la factura, paso a paso</h2>
        <p className="muted">Factura Bonita conserva la venta, registra el pago y coordina los servicios necesarios antes de entregar los documentos al cliente.</p>
      </div>
      {onBack&&<button type="button" className="back-button" onClick={onBack}>← Volver</button>}
    </div>

    <div className="guide-flow">
      {steps.map(([n,title,text])=><article className="guide-step" key={n}>
        <span className="guide-number">{n}</span>
        <div><h3>{title}</h3><p>{text}</p></div>
      </article>)}
    </div>

    <div className="guide-grid">
      <article className="guide-card">
        <span className="eyebrow">QUÉ DATOS NECESITAS</span>
        <h3>Lo esencial para una venta</h3>
        <ul>
          <li>Datos del cliente y su identificación.</li>
          <li>Descripción de lo vendido.</li>
          <li>Cantidad, precio, impuesto y descuento si aplica.</li>
          <li>Datos opcionales como CAByS o código interno cuando los conozcas.</li>
        </ul>
      </article>
      <article className="guide-card">
        <span className="eyebrow">TU FACTURA</span>
        <h3>Qué sucede después del pago</h3>
        <ul>
          <li>El pago se valida con el servicio conectado.</li>
          <li>La venta cambia a pagada y comienza el procesamiento documental.</li>
          <li>Se valida firma digital, factura electrónica y Tributación.</li>
          <li>Al recibir el acuse, se entregan los tres documentos al correo del cliente.</li>
        </ul>
      </article>
      <article className="guide-card">
        <span className="eyebrow">TU MARCA</span>
        <h3>Personaliza el comprobante</h3>
        <ul>
          <li>Sube el logo de tu negocio.</li>
          <li>Elige izquierda, centro o derecha.</li>
          <li>La preferencia queda guardada para futuras facturas.</li>
        </ul>
      </article>
    </div>

    <details className="integration-guide">
      <summary>Integrar Factura Bonita con otro sistema</summary>
      <div className="integration-guide-body">
        <p>Esta sección está pensada para equipos que necesiten conectar otro proyecto con Factura Bonita. El usuario normal no necesita realizar estos pasos.</p>
        <div className="integration-mini-grid">
          <div><span>Crear factura</span><code>POST /api/facturas</code></div>
          <div><span>Consultar factura</span><code>GET /api/facturas/:id</code></div>
          <div><span>Obtener PDF</span><code>GET /api/documentos/facturas/:id?formato=pdf</code></div>
          <div><span>Contrato técnico</span><code>GET /api/contrato</code></div>
        </div>
        <p className="small muted">La documentación técnica completa permanece disponible en <strong>/docs</strong>.</p>
      </div>
    </details>

    {!loggedIn&&<div className="guide-cta"><strong>¿Quieres probarlo?</strong><span>Crea tu cuenta y registra una venta de prueba.</span></div>}
  </section>;
}
