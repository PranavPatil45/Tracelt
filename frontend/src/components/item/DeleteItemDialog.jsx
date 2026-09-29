import { Trash2, AlertTriangle, X } from 'lucide-react'

export default function DeleteItemDialog({
  isOpen,
  itemTitle,
  itemType,
  onConfirm,
  onCancel,
  isDeleting,
}) {
  if (!isOpen) return null

  const isLost = itemType === 'LOST'

  return (
    <div
      className="item-modal-backdrop"
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-dialog-title"
    >
      <div className="item-modal-card item-modal-card--danger" onClick={(e) => e.stopPropagation()}>
        <header className="item-modal-header">
          <div className="item-delete-icon-wrapper">
            <Trash2 size={24} className="item-delete-icon" />
          </div>
          <button
            type="button"
            className="item-modal-close"
            onClick={onCancel}
            disabled={isDeleting}
            aria-label="Close dialog"
          >
            <X size={20} />
          </button>
        </header>

        <div className="item-modal-body">
          <h2 id="delete-dialog-title" className="item-delete-title">
            Delete {isLost ? 'Lost Item' : 'Found Item'} Report?
          </h2>
          <p className="item-delete-message">
            Are you sure you want to delete <strong>&ldquo;{itemTitle}&rdquo;</strong>? This action cannot be undone and will permanently remove this report from Tracelt.
          </p>

          <div className="item-delete-warning-box">
            <AlertTriangle size={16} />
            <span>Any active matching notifications for this report will also be terminated.</span>
          </div>
        </div>

        <footer className="item-modal-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onCancel}
            disabled={isDeleting}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-danger"
            onClick={onConfirm}
            disabled={isDeleting}
          >
            {isDeleting ? 'Deleting Report...' : 'Yes, Delete Report'}
          </button>
        </footer>
      </div>
    </div>
  )
}
