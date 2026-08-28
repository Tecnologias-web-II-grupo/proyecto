import Swal from 'sweetalert2';
import 'sweetalert2/dist/sweetalert2.min.css';

// Una configuración compartida mantiene el orden y el lenguaje de las
// confirmaciones igual en todo el portal.
export async function confirmAction({ title, text, confirmText, danger = false }) {
  const result = await Swal.fire({
    title,
    text,
    icon: danger ? 'warning' : 'question',
    showCancelButton: true,
    cancelButtonText: 'Cancelar',
    confirmButtonText: confirmText,
    reverseButtons: true,
    focusCancel: danger,
    buttonsStyling: false,
    customClass: {
      popup: 'portal-alert',
      actions: 'portal-alert-actions',
      cancelButton: 'portal-alert-cancel',
      confirmButton: danger ? 'portal-alert-confirm danger' : 'portal-alert-confirm'
    }
  });

  return result.isConfirmed;
}

export function showSuccess(title, text) {
  return Swal.fire({
    title,
    text,
    icon: 'success',
    confirmButtonText: 'Aceptar',
    buttonsStyling: false,
    customClass: { popup: 'portal-alert', confirmButton: 'portal-alert-confirm' }
  });
}
