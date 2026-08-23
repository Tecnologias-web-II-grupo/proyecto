export const BANKY_CHANNEL = 'bankyfinanzas:checkout';

export function describirResultado(result = {}) {
  const status = String(result.status || '').toLowerCase();
  if (status === 'completed') return 'Pago aprobado correctamente.';
  if (status === 'cancelled') return 'Cerraste la ventana de pago antes de completar la operación.';
  const code = String(result.rejectionCode || '').toUpperCase();
  const messages = {
    INSUFFICIENT_FUNDS: 'La tarjeta no tiene fondos suficientes.',
    CARD_EXPIRED: 'La tarjeta está vencida.',
    CARD_DECLINED: 'El pago fue rechazado por el banco.',
    INVALID_CARD: 'La tarjeta no es válida para este pago.',
    NETWORK_ERROR: 'No se pudo contactar al banco emisor.',
  };
  return messages[code] || 'El pago no pudo completarse.';
}

export function aMetodoDePago(result = {}) {
  return {
    titular: result.cardholderName || '',
    tipoTarjeta: result.cardBrand || '',
    ultimosDigitos: result.cardLastFourDigits || '',
    vencimiento: result.cardExpiration || '',
  };
}

export function pagarConBanky({ checkoutUrl, expectedOrigin }) {
  if (!checkoutUrl) return Promise.reject(new Error('No se recibió la dirección de pago de BankyFinanzas.'));
  if (!expectedOrigin) return Promise.reject(new Error('No se configuró el origen seguro de BankyFinanzas.'));

  return new Promise((resolve, reject) => {
    let settled = false;
    let popup = null;
    let watcher = null;

    function cleanup() {
      window.removeEventListener('message', onMessage);
      if (watcher) window.clearInterval(watcher);
    }

    function finish(result) {
      if (settled) return;
      settled = true;
      cleanup();
      try { popup?.close(); } catch {}
      try { window.focus(); } catch {}
      resolve(result);
    }

    function onMessage(event) {
      if (event.origin !== expectedOrigin) return;
      const data = event.data || {};
      if (data.channel !== BANKY_CHANNEL) return;
      const result = data.result;
      if (!result || typeof result !== 'object') return;
      const status = String(result.status || '').toLowerCase();
      if (!['completed', 'rejected', 'cancelled'].includes(status)) return;
      finish(result);
    }

    window.addEventListener('message', onMessage);
    popup = window.open(checkoutUrl, 'bankyCheckout', 'width=620,height=820,resizable=yes,scrollbars=yes');
    if (!popup) {
      cleanup();
      reject(new Error('El navegador bloqueó la ventana de pago. Permite ventanas emergentes e inténtalo nuevamente.'));
      return;
    }

    watcher = window.setInterval(() => {
      if (!popup || popup.closed) {
        finish({ status: 'cancelled' });
      }
    }, 500);
  });
}
