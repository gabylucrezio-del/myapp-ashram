import { useMemo, useState } from "react";
import ExportModal from "./ExportModal";
import ExportStatus from "./ExportStatus";
import { buildPostVariants } from "./exportService";

export default function PostExportModal({ document, onClose, onExported }) {
  const variants = useMemo(() => buildPostVariants(document.contentMarkdown || ""), [document.contentMarkdown]);
  const [mode, setMode] = useState("full");
  const [content, setContent] = useState(variants.full);
  const [status, setStatus] = useState("");

  function choose(nextMode) {
    setMode(nextMode);
    setContent(variants[nextMode] || variants.full);
  }

  async function copy() {
    await navigator.clipboard?.writeText(content);
    setStatus("Texto copiado.");
  }

  async function savePost() {
    await onExported?.({
      type: "post",
      title: document.title || "Post",
      fileName: `${document.title || "post"}.txt`,
      content,
      status: "saved",
    });
    setStatus("Post guardado dentro de la app.");
  }

  return (
    <ExportModal title="Compartir como post" onClose={onClose}>
      <div className="post-export-modes">
        <button className={mode === "full" ? "active" : ""} type="button" onClick={() => choose("full")}>Completo</button>
        <button className={mode === "summary" ? "active" : ""} type="button" onClick={() => choose("summary")}>Resumen</button>
        <button className={mode === "instagram" ? "active" : ""} type="button" onClick={() => choose("instagram")}>Instagram</button>
        <button className={mode === "blog" ? "active" : ""} type="button" onClick={() => choose("blog")}>Blog</button>
      </div>
      <textarea className="post-export-textarea" value={content} onChange={(event) => setContent(event.target.value)} />
      <div className="export-actions">
        <button className="ghost compact" type="button" onClick={copy}>Copiar</button>
        <button className="primary small" type="button" onClick={savePost}>Guardar como post</button>
      </div>
      <ExportStatus message={status} />
    </ExportModal>
  );
}
