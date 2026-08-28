import React, { useState } from 'react';
import { api, setToken } from '../api';
import { confirmAction, showSuccess } from '../utils/alerts.js';

function accountDate(value) {
  if (!value) return 'No disponible';
  return new Intl.DateTimeFormat('es-CR', { dateStyle: 'long' }).format(new Date(value));
}

export default function AccountProfile({ me, onSignedOut }) {
  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '', confirmation: '' });
  const [deletion, setDeletion] = useState({ password: '', confirmation: '' });
  const [message, setMessage] = useState(null);
  const [busy, setBusy] = useState(false);

  function signOut() {
    setToken('');
    onSignedOut();
  }

  async function changePassword(event) {
    event.preventDefault();
    setMessage(null);
    if (passwords.newPassword !== passwords.confirmation) {
      return setMessage({ type: 'error', text: 'La confirmación no coincide con la nueva contraseña.' });
    }
    setBusy(true);
    try {
      await api('/api/portal/cuenta/contrasena', {
        method: 'PUT',
        body: JSON.stringify({ currentPassword: passwords.currentPassword, newPassword: passwords.newPassword })
      });
      await showSuccess('Contraseña actualizada', 'Por seguridad, inicia sesión nuevamente con tu nueva contraseña.');
      // El servidor revoca todas las sesiones al cambiar la contraseña.
      // Limpiar también el token local mantiene la interfaz sincronizada.
      signOut();
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setBusy(false);
    }
  }

  async function deleteAccount(event) {
    event.preventDefault();
    setMessage(null);
    if (deletion.confirmation !== 'ELIMINAR') {
      return setMessage({ type: 'error', text: 'Escribe ELIMINAR exactamente para confirmar.' });
    }
    const confirmed = await confirmAction({
      title: '¿Eliminar tu cuenta definitivamente?',
      text: 'Esta acción borrará tu acceso, perfil, logos y clave API. No podrás deshacerla.',
      confirmText: 'Eliminar cuenta',
      danger: true
    });
    if (!confirmed) return;
    setBusy(true);
    try {
      await api('/api/portal/cuenta', { method: 'DELETE', body: JSON.stringify(deletion) });
      await showSuccess('Cuenta eliminada', 'Tu cuenta y sus datos de acceso fueron eliminados correctamente.');
      signOut();
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setBusy(false);
    }
  }

  return <section className="panel profile-panel">
    <div className="panel-heading">
      <div><span className="eyebrow">MI CUENTA</span><h2>Perfil y seguridad</h2><p className="muted">Consulta tus datos y administra el acceso a Factura Bonita.</p></div>
      <span className="status-chip facturada">Cuenta activa</span>
    </div>

    <div className="account-summary">
      <div><span>Nombre</span><strong>{me.nombre}</strong></div>
      <div><span>Correo de acceso</span><strong>{me.email}</strong></div>
      <div><span>Empresa</span><strong>{me.empresa}</strong></div>
      <div><span>Identificación</span><strong>{me.tipoIdentificacion} · {me.numeroIdentificacion}</strong></div>
      <div><span>Correo de facturación</span><strong>{me.correoFacturacion}</strong></div>
      <div><span>Miembro desde</span><strong>{accountDate(me.createdAt)}</strong></div>
    </div>

    {message && <div className={`alert ${message.type}`}>{message.text}</div>}

    <div className="account-actions-grid">
      <form className="account-card" onSubmit={changePassword}>
        <div><h3>Cambiar contraseña</h3><p>Al guardarla, se cerrarán las sesiones abiertas por seguridad.</p></div>
        <label>Contraseña actual<input type="password" autoComplete="current-password" required value={passwords.currentPassword} onChange={e=>setPasswords({...passwords,currentPassword:e.target.value})}/></label>
        <label>Nueva contraseña<input type="password" autoComplete="new-password" minLength="8" required value={passwords.newPassword} onChange={e=>setPasswords({...passwords,newPassword:e.target.value})}/><small>Mínimo 8 caracteres.</small></label>
        <label>Confirmar nueva contraseña<input type="password" autoComplete="new-password" minLength="8" required value={passwords.confirmation} onChange={e=>setPasswords({...passwords,confirmation:e.target.value})}/></label>
        <button className="primary" disabled={busy}>Actualizar contraseña</button>
      </form>

      <form className="account-card danger-zone" onSubmit={deleteAccount}>
        <div><span className="eyebrow">GESTIÓN DE LA CUENTA</span><h3>Eliminar mi cuenta</h3><p>Se borrarán tu acceso, perfil, logos y clave API. Las facturas emitidas se conservan como comprobantes históricos.</p></div>
        <label>Contraseña actual<input type="password" autoComplete="current-password" required value={deletion.password} onChange={e=>setDeletion({...deletion,password:e.target.value})}/></label>
        <label>Escribe ELIMINAR<input type="text" autoComplete="off" required placeholder="ELIMINAR" value={deletion.confirmation} onChange={e=>setDeletion({...deletion,confirmation:e.target.value})}/></label>
        <button className="danger-button" disabled={busy || deletion.confirmation !== 'ELIMINAR'}>Eliminar cuenta definitivamente</button>
      </form>
    </div>
  </section>;
}
