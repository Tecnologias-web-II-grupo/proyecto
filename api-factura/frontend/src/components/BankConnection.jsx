import React, { useEffect, useState } from 'react';
import { api } from '../api';

export default function BankConnection({ config, me, onSaved, onBack }) {
  const [merchantId, setMerchantId] = useState(me?.perfil?.bankMerchantId || '');
  const [affiliated, setAffiliated] = useState(Boolean(me?.perfil?.bankAfiliado));
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setMerchantId(me?.perfil?.bankMerchantId || '');
    setAffiliated(Boolean(me?.perfil?.bankAfiliado));
  }, [me]);

  async function save() {
    if (affiliated && !merchantId.trim()) { setMsg('Copia primero el identificador de comercio que aparece en Credenciales API de BankyFinanzas.'); return; }
    setBusy(true); setMsg('');
    try {
      const data = await api('/api/portal/perfil/banco', {
        method: 'PUT',
        body: JSON.stringify({ bankAfiliado: affiliated, bankMerchantId: merchantId.trim() })
      });
      onSaved?.(data);
      setMsg(affiliated ? 'Cobros configurados. Ya puedes enviar ventas a BankyFinanzas.' : 'Configuración actualizada.');
    } catch (e) { setMsg(e.message); }
    finally { setBusy(false); }
  }

  const loginUrl = config?.bank?.loginUrl || 'https://bankyfinanzas.netlify.app/login';
  const registerUrl = config?.bank?.registerUrl || 'https://bankyfinanzas.netlify.app/registro/negocio';

  return <section className="panel bank-panel">
    <div className="panel-heading bank-heading">
      <div>
        <span className="eyebrow">COBROS</span>
        <h2>Conecta tu negocio con BankyFinanzas</h2>
        <p className="muted">Esta configuración se hace una sola vez. Después podrás cobrar las ventas guardadas directamente desde Factura Bonita.</p>
      </div>
      <button type="button" className="back-button" onClick={onBack}>← Volver</button>
    </div>

    <div className="bank-steps">
      <article><span>1</span><div><strong>Accede a BankyFinanzas</strong><p>Inicia sesión con tu negocio o crea la cuenta si todavía no existe.</p><a className="secondary anchor" href={loginUrl} target="_blank" rel="noreferrer">Abrir BankyFinanzas</a></div></article>
      <article><span>2</span><div><strong>Afilia el negocio</strong><p>Completa el registro de negocio para que BankyFinanzas pueda recibir tus cobros.</p><a className="secondary anchor" href={registerUrl} target="_blank" rel="noreferrer">Afiliar mi negocio</a></div></article>
      <article><span>3</span><div><strong>Copia tu identificador de comercio</strong><p>En BankyFinanzas abre <b>Credenciales API</b> y copia el identificador de comercio. Es el dato que enlaza tus cobros con tu negocio.</p></div></article>
    </div>

    <div className="bank-config-card">
      <label className="check-line"><input type="checkbox" checked={affiliated} onChange={e=>setAffiliated(e.target.checked)}/><span>Mi negocio ya está afiliado en BankyFinanzas</span></label>
      <label>Identificador de comercio <small>Lo encuentras en Credenciales API de BankyFinanzas.</small>
        <input value={merchantId} onChange={e=>setMerchantId(e.target.value.trimStart().slice(0,160))} placeholder="Pega aquí tu identificador" disabled={!affiliated}/>
      </label>
      <div className="bank-business-reference"><span>Negocio</span><strong>{me?.empresa}</strong><span>Identificación</span><strong>{me?.numeroIdentificacion}</strong></div>
      <button className="primary" disabled={busy||!affiliated||!merchantId.trim()} onClick={save}>{busy?'Guardando...':'Guardar conexión de cobro'}</button>
      {msg&&<div className="inline-message">{msg}</div>}
    </div>
  </section>;
}
