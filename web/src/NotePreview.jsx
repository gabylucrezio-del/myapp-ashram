import { Copy, FileText, Headphones, Image as ImageIcon, Play, Send } from "lucide-react";
import { driveDownloadUrl, driveImageUrl, drivePreviewUrl, videoEmbedUrl } from "./driveLinkHelper";

export default function NotePreview({ note, onCopy, onPublish }) {
  if (!note) {
    return (
      <section className="notebook-preview empty">
        <FileText size={34} />
        <h2>Selecciona una nota</h2>
        <p>El contenido del cuaderno aparece aqui para leerlo, revisar links y publicarlo cuando este listo.</p>
      </section>
    );
  }

  return (
    <section className="notebook-preview">
      <div className="notebook-preview-head">
        <span>
          <h2>{note.titulo || "Sin titulo"}</h2>
          <small>{statusLabel(note.estado)} · actualizado {formatDate(note.actualizadoEn || note.creadoEn)}</small>
        </span>
        <button className="ghost compact" type="button" onClick={onCopy}>
          <Copy size={16} /> Copiar texto
        </button>
      </div>

      {note.imagenUrl ? (
        <figure className="notebook-media">
          <img src={driveImageUrl(note.imagenUrl)} alt={note.titulo || "Imagen"} />
          <figcaption><ImageIcon size={15} /> Imagen vinculada</figcaption>
        </figure>
      ) : null}

      {note.videoUrl ? (
        <div className="notebook-frame">
          <iframe title={note.titulo || "Video"} src={videoEmbedUrl(note.videoUrl)} allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen />
        </div>
      ) : null}

      {note.audioUrl ? (
        <div className="notebook-audio">
          <Headphones size={18} />
          <audio controls src={driveDownloadUrl(note.audioUrl)} />
        </div>
      ) : null}

      {note.pdfUrl ? (
        <div className="notebook-pdf">
          <iframe title={`${note.titulo || "Nota"} PDF`} src={drivePreviewUrl(note.pdfUrl)} />
          <a className="primary small" href={note.pdfUrl} target="_blank" rel="noreferrer">
            Abrir PDF
          </a>
        </div>
      ) : null}

      <article className="markdown-body">
        {renderMarkdown(note.contenidoMarkdown)}
      </article>

      <div className="publish-row">
        <button className="primary small" type="button" onClick={() => onPublish("blog")}><Send size={15} /> Publicar en Blog</button>
        <button className="primary small" type="button" onClick={() => onPublish("satsang")}><Play size={15} /> Publicar en Satsang</button>
        <button className="primary small" type="button" onClick={() => onPublish("meditaciones")}><Headphones size={15} /> Publicar en Meditaciones</button>
        <button className="primary small" type="button" onClick={() => onPublish("curso")}><FileText size={15} /> Publicar en Curso</button>
      </div>
    </section>
  );
}

export function renderMarkdown(markdown = "") {
  const lines = markdown.split(/\r?\n/);
  const nodes = [];
  let list = [];

  function flushList() {
    if (!list.length) return;
    nodes.push(
      <ul key={`list-${nodes.length}`}>
        {list.map((item, index) => <li key={index}>{renderInline(item)}</li>)}
      </ul>,
    );
    list = [];
  }

  lines.forEach((rawLine, index) => {
    const line = rawLine.trim();
    if (!line) {
      flushList();
      return;
    }
    if (line.startsWith("- ")) {
      list.push(line.slice(2));
      return;
    }
    flushList();
    if (line.startsWith("### ")) nodes.push(<h3 key={index}>{renderInline(line.slice(4))}</h3>);
    else if (line.startsWith("## ")) nodes.push(<h2 key={index}>{renderInline(line.slice(3))}</h2>);
    else if (line.startsWith("# ")) nodes.push(<h1 key={index}>{renderInline(line.slice(2))}</h1>);
    else if (line.startsWith("> ")) nodes.push(<blockquote key={index}>{renderInline(line.slice(2))}</blockquote>);
    else nodes.push(<p key={index}>{renderInline(line)}</p>);
  });
  flushList();
  return nodes.length ? nodes : <p className="empty-state">Esta nota todavia no tiene texto.</p>;
}

function renderInline(text) {
  const parts = [];
  const pattern = /(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g;
  let lastIndex = 0;
  let match;
  while ((match = pattern.exec(text))) {
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index));
    const token = match[0];
    if (token.startsWith("**")) {
      parts.push(<strong key={parts.length}>{token.slice(2, -2)}</strong>);
    } else {
      const link = token.match(/\[([^\]]+)\]\(([^)]+)\)/);
      parts.push(<a key={parts.length} href={link[2]} target="_blank" rel="noreferrer">{link[1]}</a>);
    }
    lastIndex = pattern.lastIndex;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts;
}

function statusLabel(status) {
  if (status === "listo") return "Listo";
  if (status === "publicado") return "Publicado";
  return "Borrador";
}

function formatDate(value) {
  if (!value) return "sin fecha";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("es-AR");
}
