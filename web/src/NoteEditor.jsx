import { Bold, CheckSquare, Code2, Eye, Heading2, Image as ImageIcon, Italic, Link, List, ListOrdered, Music, Quote, Save, StickyNote, Video, Volume2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { renderMarkdown } from "./NotePreview";

const emptyNote = {
  titulo: "",
  folderId: "",
  contenidoMarkdown: "",
  imagenUrl: "",
  audioUrl: "",
  pdfUrl: "",
  videoUrl: "",
  estado: "borrador",
};

const slashCommands = [
  { id: "nota", label: "Vinculo a otra nota", icon: StickyNote },
  { id: "youtube", label: "Video de YouTube", icon: Video },
  { id: "pdf", label: "Link de PDF", icon: Link },
  { id: "audio", label: "Link de audio", icon: Music },
  { id: "imagen", label: "Link de imagen", icon: ImageIcon },
];

export default function NoteEditor({ note, folders, notes = [], defaultFolderId = "", onSave }) {
  const [form, setForm] = useState({ ...emptyNote, folderId: defaultFolderId, ...note });
  const [saving, setSaving] = useState(false);
  const [showSlash, setShowSlash] = useState(false);
  const textareaRef = useRef(null);
  const preview = useMemo(() => renderMarkdown(form.contenidoMarkdown), [form.contenidoMarkdown]);

  useEffect(() => {
    setForm({ ...emptyNote, folderId: defaultFolderId, ...note });
    setShowSlash(false);
  }, [note?.id, defaultFolderId]);

  function setField(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function onMarkdownChange(event) {
    const value = event.target.value;
    setField("contenidoMarkdown", value);
    const cursor = event.target.selectionStart;
    setShowSlash(value[cursor - 1] === "/");
  }

  function replaceSlash(insertText, extraFields = {}) {
    const textarea = textareaRef.current;
    const cursor = textarea?.selectionStart ?? form.contenidoMarkdown.length;
    const before = form.contenidoMarkdown.slice(0, cursor).replace(/\/$/, "");
    const after = form.contenidoMarkdown.slice(cursor);
    const next = `${before}${insertText}${after}`;
    setForm((current) => ({ ...current, ...extraFields, contenidoMarkdown: next }));
    setShowSlash(false);
    window.setTimeout(() => textareaRef.current?.focus(), 0);
  }

  function runSlashCommand(command) {
    if (command === "nota") {
      if (!notes.length) {
        replaceSlash("[Nota vinculada](nota:)", {});
        return;
      }
      const options = notes.map((item, index) => `${index + 1}. ${item.titulo || "Sin titulo"}`).join("\n");
      const selected = Number(window.prompt(`Elegi una nota por numero:\n${options}`));
      const target = notes[selected - 1];
      if (!target) return;
      replaceSlash(`[${target.titulo || "Nota"}](nota:${target.id})`);
      return;
    }

    const url = window.prompt("Pega el link");
    if (!url) return;
    if (command === "youtube") replaceSlash(`\n\n[Video](${url})\n`, { videoUrl: url });
    if (command === "pdf") replaceSlash(`\n\n[PDF](${url})\n`, { pdfUrl: url });
    if (command === "audio") replaceSlash(`\n\n[Audio](${url})\n`, { audioUrl: url });
    if (command === "imagen") replaceSlash(`\n\n![Imagen](${url})\n`, { imagenUrl: url });
  }

  function insertMarkdown(text, fieldUpdates = {}) {
    const textarea = textareaRef.current;
    const cursor = textarea?.selectionStart ?? form.contenidoMarkdown.length;
    const before = form.contenidoMarkdown.slice(0, cursor);
    const after = form.contenidoMarkdown.slice(cursor);
    setForm((current) => ({ ...current, ...fieldUpdates, contenidoMarkdown: `${before}${text}${after}` }));
    window.setTimeout(() => textareaRef.current?.focus(), 0);
  }

  function wrapMarkdown(beforeToken, afterToken = beforeToken) {
    const textarea = textareaRef.current;
    const start = textarea?.selectionStart ?? form.contenidoMarkdown.length;
    const end = textarea?.selectionEnd ?? start;
    const selected = form.contenidoMarkdown.slice(start, end) || "texto";
    const before = form.contenidoMarkdown.slice(0, start);
    const after = form.contenidoMarkdown.slice(end);
    setForm((current) => ({ ...current, contenidoMarkdown: `${before}${beforeToken}${selected}${afterToken}${after}` }));
    window.setTimeout(() => textareaRef.current?.focus(), 0);
  }

  const toolbar = [
    { label: "Negrita", icon: Bold, action: () => wrapMarkdown("**") },
    { label: "Cursiva", icon: Italic, action: () => wrapMarkdown("*") },
    { label: "Titulo", icon: Heading2, action: () => insertMarkdown("\n## Titulo\n") },
    { label: "Lista", icon: List, action: () => insertMarkdown("\n- item\n") },
    { label: "Numerada", icon: ListOrdered, action: () => insertMarkdown("\n1. item\n") },
    { label: "Tarea", icon: CheckSquare, action: () => insertMarkdown("\n- [ ] tarea\n") },
    { label: "Link", icon: Link, action: () => insertMarkdown("[texto](https://)") },
    { label: "Imagen", icon: ImageIcon, action: () => runSlashCommand("imagen") },
    { label: "Audio", icon: Volume2, action: () => runSlashCommand("audio") },
    { label: "Video", icon: Video, action: () => runSlashCommand("youtube") },
    { label: "Codigo", icon: Code2, action: () => wrapMarkdown("`") },
    { label: "Cita", icon: Quote, action: () => insertMarkdown("\n> cita\n") },
  ];

  async function submit(event) {
    event.preventDefault();
    if (!form.titulo.trim()) return;
    setSaving(true);
    try {
      await onSave(form);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="note-editor note-editor-inline" onSubmit={submit}>
        <div className="notebook-editor-head">
          <input className="note-title-input" value={form.titulo} onChange={(event) => setField("titulo", event.target.value)} placeholder="Titulo de la nota" />
          <button className="primary small" disabled={saving}><Save size={16} /> {saving ? "Guardando..." : "Guardar"}</button>
        </div>
        <div className="note-meta-row">
        <label>Carpeta
          <select value={form.folderId || ""} onChange={(event) => setField("folderId", event.target.value)}>
            <option value="">Sin carpeta</option>
            {folders.map((folder) => <option key={folder.id} value={folder.id}>{folder.nombre}</option>)}
          </select>
        </label>
        <label>Estado
          <select value={form.estado} onChange={(event) => setField("estado", event.target.value)}>
            <option value="borrador">Borrador</option>
            <option value="listo">Listo</option>
            <option value="publicado">Publicado</option>
          </select>
        </label>
        </div>
        <div className="note-editor-tabs">
          <span>Editar</span>
          <span><Eye size={14} /> Vista previa</span>
        </div>
        <div className="note-format-toolbar" aria-label="Herramientas Markdown">
          {toolbar.map(({ label, icon: Icon, action }) => (
            <button key={label} type="button" onClick={action} title={label}>
              <Icon size={15} />
            </button>
          ))}
        </div>
        <div className="note-editor-grid">
          <label className="markdown-field">Markdown
            <span className="editor-shell">
              <textarea ref={textareaRef} className="markdown-editor" value={form.contenidoMarkdown} onChange={onMarkdownChange} placeholder="Escribi tu nota. Usa / para insertar una nota, video, PDF, audio o imagen." />
              {showSlash ? (
                <div className="slash-menu">
                  {slashCommands.map(({ id, label, icon: Icon }) => (
                    <button key={id} type="button" onClick={() => runSlashCommand(id)}>
                      <Icon size={16} />
                      <span>{label}</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </span>
          </label>
          <section className="editor-preview">
            <strong>Vista previa</strong>
            <article className="markdown-body">{preview}</article>
          </section>
        </div>
        <div className="note-url-grid">
          <label><ImageIcon size={14} /> Imagen<input value={form.imagenUrl} onChange={(event) => setField("imagenUrl", event.target.value)} placeholder="Pega el link aqui..." /></label>
          <label><Music size={14} /> Audio<input value={form.audioUrl} onChange={(event) => setField("audioUrl", event.target.value)} placeholder="Pega el link aqui..." /></label>
          <label><Link size={14} /> PDF<input value={form.pdfUrl} onChange={(event) => setField("pdfUrl", event.target.value)} placeholder="Pega el link aqui..." /></label>
          <label><Video size={14} /> Video<input value={form.videoUrl} onChange={(event) => setField("videoUrl", event.target.value)} placeholder="Pega el link aqui..." /></label>
        </div>
      </form>
  );
}
