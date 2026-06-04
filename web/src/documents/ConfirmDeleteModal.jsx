import ExportModal from "./ExportModal";

export default function ConfirmDeleteModal({ title, message, details, onCancel, onConfirm }) {
  return (
    <ExportModal title={title} onClose={onCancel}>
      <div className="confirm-delete-body">
        <p>{message}</p>
        {details ? <small>{details}</small> : null}
      </div>
      <div className="export-actions">
        <button className="ghost compact" type="button" onClick={onCancel}>Cancelar</button>
        <button className="primary small danger-action" type="button" onClick={onConfirm}>Eliminar</button>
      </div>
    </ExportModal>
  );
}
