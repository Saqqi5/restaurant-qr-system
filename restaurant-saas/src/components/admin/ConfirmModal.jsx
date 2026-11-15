// Styled confirm dialog in the app's own dark SAQLYN theme — replaces the
// browser's plain window.confirm popup (which looks unstyled on phones).
// Props: title, message, confirmLabel, cancelLabel, danger (red confirm
// button for destructive actions), onConfirm, onCancel.
export default function ConfirmModal({ title, message, confirmLabel = "OK", cancelLabel = "Cancel", danger = false, onConfirm, onCancel }) {
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal confirm-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{title}</h3>
          <button className="modal-close" onClick={onCancel}>✕</button>
        </div>
        <div className="modal-body">
          <p className="confirm-message">{message}</p>
        </div>
        <div className="modal-footer">
          <button className="btn-secondary" onClick={onCancel}>{cancelLabel}</button>
          <button className={danger ? "btn-danger" : "btn-primary"} onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
