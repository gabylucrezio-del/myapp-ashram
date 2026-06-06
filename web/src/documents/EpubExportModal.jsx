import { useMemo, useState } from "react";
import ChapterPreview from "./ChapterPreview";
import CoverSelector from "./CoverSelector";
import ExportModal from "./ExportModal";
import ExportStatus from "./ExportStatus";
import { detectChapters, exportEpub } from "./exportService";
import { uploadEpub } from "../utils";

export default function EpubExportModal({ document, onClose, onExported, onPublishRequested }) {
  const chapters = useMemo(() => detectChapters(document.contentMarkdown || ""), [document.contentMarkdown]);
  const [form, setForm] = useState({
    title: document.title || "",
    author: "Ashram Ganesha",
    description: "",
    keywords: "",
    language: "es",
    coverUrl: "",
    fileName: document.title || "libro",
    target: "library",
    libraryAction: "download",
  });
  const [status, setStatus] = useState("");

  function setField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function submit() {
    setStatus("Creando EPUB...");
    const shouldDownload = form.target === "library" && form.libraryAction === "download";
    const result = await exportEpub(document, { ...form, chapters, download: shouldDownload });
    await onExported?.({ type: "epub", ...form, fileName: result.fileName });

    if (shouldDownload) {
      setStatus("EPUB guardado en disco.");
      return;
    }

    setStatus("Subiendo EPUB...");
    const file = new File([result.blob], result.fileName, { type: "application/epub+zip" });
    const publishType = form.target === "course" ? "course" : "book";
    const folder = publishType === "course" ? "contenidos/conocimiento/epubs" : "biblioteca/epubs";
    const uploaded = await uploadEpub(file, folder);
    setStatus("EPUB listo para publicar.");
    onPublishRequested?.({
      publishType,
      uploaded,
      fileName: result.fileName,
      chapters: result.chapters,
      title: form.title,
      author: form.author,
      description: form.description,
      keywords: form.keywords,
      coverUrl: form.coverUrl,
    });
  }

  return (
    <ExportModal title="Exportar como EPUB" onClose={onClose}>
      <div className="export-form-grid">
        <label>Destino
          <select value={form.target} onChange={(event) => setField("target", event.target.value)}>
            <option value="library">Biblioteca / libro</option>
            <option value="course">Material de curso</option>
          </select>
        </label>
        {form.target === "library" ? (
          <label>Accion
            <select value={form.libraryAction} onChange={(event) => setField("libraryAction", event.target.value)}>
              <option value="download">Guardar en disco</option>
              <option value="publish">Publicar libro</option>
            </select>
          </label>
        ) : null}
        <label>Titulo del libro<input value={form.title} onChange={(event) => setField("title", event.target.value)} /></label>
        <label>Autor<input value={form.author} onChange={(event) => setField("author", event.target.value)} /></label>
        <label>Descripcion breve<textarea value={form.description} onChange={(event) => setField("description", event.target.value)} /></label>
        <label>Palabras clave<input value={form.keywords} onChange={(event) => setField("keywords", event.target.value)} placeholder="Ej: ansiedad, vata, calma, respiración, Ganesha" /></label>
        <label>Idioma<input value={form.language} onChange={(event) => setField("language", event.target.value)} /></label>
        <label>Nombre del archivo<input value={form.fileName} onChange={(event) => setField("fileName", event.target.value)} /></label>
      </div>
      <CoverSelector value={form.coverUrl} onChange={(value) => setField("coverUrl", value)} />
      <ChapterPreview chapters={chapters} />
      <div className="export-actions">
        <button className="ghost compact" type="button" onClick={onClose}>Cancelar</button>
        <button className="primary small" type="button" onClick={submit}>Crear EPUB</button>
      </div>
      <ExportStatus message={status} />
    </ExportModal>
  );
}
