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
    setBusy(true); setMsg('');
    try {
      const data = await api('/api/portal/perfil/banco', {
        method: 'PUT',
        body: JSON.stringify({ bankAfiliado: affiliated, bankMerchantId: merchantId })
      });
      onSaved?.(data);
      setMsg(affiliated ? 'Configuración de cobro guardada.' : 'Configuración actualizada.');
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
        <p className="muted">Para cobrar una venta, primero debes tener una cuenta en BankyFinanzas y afiliar este mismo negocio.</p>
      </div>
      <button type="button" className="back-button" onClick={onBack}>← Volver</button>
    </div>

    <div className="bank-steps">
      <article><span>1</span><div><strong>Inicia sesión o crea tu cuenta</strong><p>Abre BankyFinanzas y completa el acceso con tus datos.</p><a className="secondary anchor" href={loginUrl} target="_blank" rel="noreferrer">Abrir BankyFinanzas</a></div></article>
      <article><span>2</span><div><strong>Afiliar el negocio</strong><p>Registra el mismo negocio con el que usas Factura Bonita.</p><a className="secondary anchor" href={registerUrl} target="_blank" rel="noreferrer">Afiliar mi negocio</a></div></article>
      <article><span>3</span><div><strong>Confirma la afiliación aquí</strong><p>Cuando BankyFinanzas termine el registro, marca tu negocio como afiliado. Si te entrega un identificador de comercio, guárdalo también.</p></div></article>
    </div>

    <div className="bank-config-card">
      <label className="check-line"><input type="checkbox" checked={affiliated} onChange={e=>setAffiliated(e.target.checked)}/><span>Ya afilié <b>{me?.empresa}</b> en BankyFinanzas</span></label>
      <label>Identificador de comercio <small>Opcional si BankyFinanzas utiliza la identificación de tu negocio</small>
        <input value={merchantId} onChange={e=>setMerchantId(e.target.value.trimStart().slice(0,160))} placeholder="Ej. MERCHANT-001" disabled={!affiliated}/>
      </label>
      <div className="bank-business-reference"><span>Negocio</span><strong>{me?.empresa}</strong><span>Identificación</span><strong>{me?.numeroIdentificacion}</strong></div>
      <button className="primary" disabled={busy} onClick={save}>{busy?'Guardando...':'Guardar configuración'}</button>
      {msg&&<div className="inline-message">{msg}</div>}
    </div>
  </section>;
}
