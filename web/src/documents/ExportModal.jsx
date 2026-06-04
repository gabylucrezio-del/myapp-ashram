export default function ExportModal({ title, children, onClose }) {
  return (
    <div className="export-modal-backdrop">
      <section className="export-modal">
        <header>
          <strong>{title}</strong>
          <button className="icon-btn" type="button" onClick={onClose} title="Cerrar">×</button>
        </header>
        {children}
      </section>
    </div>
  );
}
