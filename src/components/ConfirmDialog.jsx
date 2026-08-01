import { AlertTriangle } from 'lucide-react'

export default function ConfirmDialog({ title, body, confirmLabel = 'Delete', onConfirm, onCancel }) {
  return (
    <div className="modal-backdrop" role="presentation" onClick={onCancel}>
      <div
        className="modal-card"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-icon danger">
          <AlertTriangle size={22} />
        </div>
        <h2 id="confirm-title" className="modal-title">{title}</h2>
        {body && <p className="modal-body">{body}</p>}
        <div className="modal-actions">
          <button className="btn ghost block" onClick={onCancel}>Cancel</button>
          <button className="btn danger block" onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  )
}
