import { useState } from "react";
import CoverSelector from "./CoverSelector";
import ExportModal from "./ExportModal";
import ExportStatus from "./ExportStatus";
import { exportPdf } from "./exportService";

export default function PdfExportModal({ document, onClose, onExported }) {
  const [form, setForm] = useState({
    title: document.title || "",
    author: "Ashram Ganesha",
    coverUrl: "",
    pageSize: "A4",
    style: "espiritual",
    fileName: document.title || "documento",
  });
  const [status, setStatus] = useState("");

  function setField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function submit() {
    setStatus("Creando PDF...");
    const result = await exportPdf(document, form);
    await onExported?.({ type: "pdf", ...form, fileName: result.fileName });
    setStatus("PDF creado.");
  }

  return (
    <ExportModal title="Exportar como PDF" onClose={onClose}>
      <div className="export-form-grid">
        <label>Titulo<input value={form.title} onChange={(event) => setField("title", event.target.value)} /></label>
        <label>Autor<input value={form.author} onChange={(event) => setField("author", event.target.value)} /></label>
        <label>Tamano<select value={form.pageSize} onChange={(event) => setField("pageSize", event.target.value)}><option>A4</option></select></label>
        <label>Estilo<select value={form.style} onChange={(event) => setField("style", event.target.value)}><option value="simple">simple</option><option value="espiritual">espiritual</option><option value="libro">libro</option><option value="apunte">apunte</option></select></label>
        <label>Nombre del archivo<input value={form.fileName} onChange={(event) => setField("fileName", event.target.value)} /></label>
      </div>
      <CoverSelector value={form.coverUrl} onChange={(value) => setField("coverUrl", value)} />
      <div className="export-actions">
        <button className="ghost compact" type="button" onClick={onClose}>Cancelar</button>
        <button className="primary small" type="button" onClick={submit}>Crear PDF</button>
      </div>
      <ExportStatus message={status} />
    </ExportModal>
  );
}
