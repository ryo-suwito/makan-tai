import type { AlertDialogState } from '@/components/home/types';

interface AlertDialogProps {
  alertDialog: AlertDialogState;
  onClose: () => void;
}

export function AlertDialog({ alertDialog, onClose }: AlertDialogProps) {
  return (
    <div className="swal-overlay" role="presentation" onClick={onClose}>
      <div
        className="swal-card"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="swal-title"
        aria-describedby="swal-message"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="swal-icon" aria-hidden="true">!</div>
        <h2 id="swal-title" className="swal-title">{alertDialog.title}</h2>
        <p id="swal-message" className="swal-message">{alertDialog.message}</p>
        <button className="swal-confirm" onClick={onClose}>{alertDialog.confirmLabel}</button>
      </div>
    </div>
  );
}
