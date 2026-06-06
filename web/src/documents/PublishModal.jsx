import { useState } from "react";
import ExportModal from "./ExportModal";
import { uploadOptimizedImage } from "../utils";

const publishTypes = [
  { id: "post", label: "Post" },
  { id: "book", label: "Libro" },
  { id: "course", label: "Curso" },
  { id: "meditation", label: "Meditacion" },
  { id: "library_resource", label: "Recurso de biblioteca" },
  { id: "pdf", label: "PDF" },
];

export default function PublishModal({ document, initialType = "post", onClose, onPublish }) {
  const defaults = document?.publishDefaults || {};
  const [form, setForm] = useState({
    type: initialType,
    title: defaults.title || document?.title || document?.name || "",
    subtitle: "",
    description: defaults.description || "",
    summary: "",
    keywords: defaults.keywords || document?.keywords || "",
    coverUrl: defaults.coverUrl || document?.coverUrl || "",
    imageStoragePath: defaults.imageStoragePath || document?.imageStoragePath || "",
    category: "",
    tags: "",
    author: defaults.author || "Ashram Ganesha",
    status: "draft_public",
    publishedAt: new Date().toISOString().slice(0, 10),
    publicFileUrl: defaults.publicFileUrl || document?.publicFileUrl || document?.webViewLink || "",
    format: defaults.format || "epub",
    price: "",
    isFree: true,
    level: "",
    instructor: "Ashram Ganesha",
    duration: "",
    resourceType: "texto",
    style: "espiritual",
    publishMode: document?.publishedContentId ? "update" : "new",
    includeContent: true,
  });
  const [busy, setBusy] = useState(false);
  const [imageBusy, setImageBusy] = useState(false);
  const chapters = detectChapters(document?.contentMarkdown || "");

  function setField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function submit(event) {
    event.preventDefault();
    if (!form.title.trim()) {
      window.alert("El titulo es obligatorio para publicar.");
      return;
    }
    setBusy(true);
    try {
      await onPublish({
        ...form,
        tags: form.tags.split(",").map((tag) => tag.trim()).filter(Boolean),
        keywordList: form.keywords.split(",").map((keyword) => keyword.trim()).filter(Boolean),
        sourceDocumentId: document?.id || "",
        sourceFolderId: document?.folderId || "",
        imageUrl: form.coverUrl,
        imageStoragePath: form.imageStoragePath || "",
        content: form.includeContent ? document?.contentMarkdown || "" : "",
      });
      onClose();
    } finally {
      setBusy(false);
    }
  }

  async function uploadPostImage(file) {
    if (!file) return;
    setImageBusy(true);
    try {
      const postId = document?.publishedContentId || document?.id || "temp";
      const folder = postId === "temp"
        ? `posts/images/temp/${Date.now()}`
        : `posts/images/${postId}`;
      const uploaded = await uploadOptimizedImage(file, folder);
      setForm((current) => ({
        ...current,
        coverUrl: uploaded.url,
        imageStoragePath: uploaded.path,
      }));
    } catch (error) {
      console.error("No se pudo subir la imagen del post", error);
      window.alert(error.message || "No se pudo subir la imagen.");
    } finally {
      setImageBusy(false);
    }
  }

  return (
    <ExportModal title="Compartir / Publicar" onClose={onClose}>
      <form className="export-form-grid" onSubmit={submit}>
        <div className="publish-step-heading">
          <strong>Paso 1</strong>
          <span>¿Que queres publicar?</span>
        </div>
        <label>Tipo
          <select value={form.type} onChange={(event) => setField("type", event.target.value)}>
            {publishTypes.map((type) => <option key={type.id} value={type.id}>{type.label}</option>)}
          </select>
        </label>
        {document?.publishedContentId ? (
          <label>Publicacion
            <select value={form.publishMode} onChange={(event) => setField("publishMode", event.target.value)}>
              <option value="update">Actualizar publicacion existente</option>
              <option value="new">Crear nueva publicacion</option>
            </select>
          </label>
        ) : null}
        <div className="publish-step-heading">
          <strong>Paso 2</strong>
          <span>{publishTypeHelp(form.type)}</span>
        </div>
        <label>Titulo
          <input required value={form.title} onChange={(event) => setField("title", event.target.value)} />
        </label>
        {form.type === "post" ? (
          <label>Subtitulo opcional
            <input value={form.subtitle} onChange={(event) => setField("subtitle", event.target.value)} />
          </label>
        ) : null}
        <label>{form.type === "post" ? "Imagen destacada / portada" : "Portada / imagen"}
          <input value={form.coverUrl} onChange={(event) => setField("coverUrl", event.target.value)} />
          <small>URL, imagen subida o biblioteca existente.</small>
        </label>
        {form.type === "post" ? (
          <div className="post-image-upload-field">
            <button className="ghost compact" type="button" disabled={imageBusy} onClick={() => window.document.getElementById("post-image-upload-input")?.click()}>
              {imageBusy ? "Subiendo imagen..." : "Subir imagen"}
            </button>
            <input
              id="post-image-upload-input"
              hidden
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(event) => {
                uploadPostImage(event.target.files?.[0]);
                event.target.value = "";
              }}
            />
            {form.coverUrl ? <img className="post-image-preview" src={form.coverUrl} alt="" /> : null}
          </div>
        ) : null}
        <label>Categoria
          <input value={form.category} onChange={(event) => setField("category", event.target.value)} />
        </label>
        <label>Autor
          <input value={form.author} onChange={(event) => setField("author", event.target.value)} />
        </label>
        <label>Palabras clave
          <input value={form.keywords} onChange={(event) => setField("keywords", event.target.value)} placeholder="Ej: ansiedad, vata, calma, respiración, Ganesha" />
        </label>
        <label>Estado
          <select value={form.status} onChange={(event) => setField("status", event.target.value)}>
            <option value="draft_public">Borrador</option>
            <option value="published">Publicado</option>
          </select>
        </label>
        <label>Fecha de publicacion
          <input type="date" value={form.publishedAt} onChange={(event) => setField("publishedAt", event.target.value)} />
        </label>
        {form.type === "post" ? (
          <>
            <label>Resumen corto
              <textarea value={form.summary} onChange={(event) => setField("summary", event.target.value)} />
            </label>
            <label>Tags
              <input value={form.tags} onChange={(event) => setField("tags", event.target.value)} placeholder="ayurveda, meditacion" />
            </label>
          </>
        ) : null}
        {form.type === "book" ? (
          <>
            <label>Descripcion del libro
              <textarea value={form.description} onChange={(event) => setField("description", event.target.value)} />
            </label>
            <label>Formato
              <select value={form.format} onChange={(event) => setField("format", event.target.value)}>
                <option value="epub">EPUB</option>
                <option value="pdf">PDF</option>
                <option value="both">EPUB y PDF</option>
              </select>
            </label>
            <label>Archivo EPUB
              <input value={form.publicFileUrl} onChange={(event) => setField("publicFileUrl", event.target.value)} />
              <small>Ya queda completo si venis desde Exportar EPUB.</small>
            </label>
            <label>Precio
              <input disabled={form.isFree} value={form.price} onChange={(event) => setField("price", event.target.value)} />
            </label>
            <label className="publish-check">
              <input type="checkbox" checked={form.isFree} onChange={(event) => setField("isFree", event.target.checked)} />
              Gratuito
            </label>
            <div className="chapter-preview publish-chapters">
              <strong>Capitulos detectados</strong>
              {chapters.length ? (
                <ol>{chapters.map((chapter) => <li key={`${chapter.level}-${chapter.title}`}>{chapter.title}</li>)}</ol>
              ) : <small>Se publicara como capitulo unico.</small>}
            </div>
          </>
        ) : null}
        {form.type === "course" ? (
          <>
            <label>Descripcion del curso
              <textarea value={form.description} onChange={(event) => setField("description", event.target.value)} />
            </label>
            <label>Nivel
              <input value={form.level} onChange={(event) => setField("level", event.target.value)} />
            </label>
            <label>Instructor
              <input value={form.instructor} onChange={(event) => setField("instructor", event.target.value)} />
            </label>
            <label>Material EPUB
              <input value={form.publicFileUrl} onChange={(event) => setField("publicFileUrl", event.target.value)} />
              <small>Archivo del material del curso.</small>
            </label>
            <label>Precio
              <input disabled={form.isFree} value={form.price} onChange={(event) => setField("price", event.target.value)} />
            </label>
            <label className="publish-check">
              <input type="checkbox" checked={form.isFree} onChange={(event) => setField("isFree", event.target.checked)} />
              Gratuito
            </label>
          </>
        ) : null}
        {form.type === "meditation" ? (
          <>
            <label>Descripcion
              <textarea value={form.description} onChange={(event) => setField("description", event.target.value)} />
            </label>
            <label>Audio o enlace de audio
              <input value={form.publicFileUrl} onChange={(event) => setField("publicFileUrl", event.target.value)} />
            </label>
            <label>Duracion
              <input value={form.duration} onChange={(event) => setField("duration", event.target.value)} placeholder="12 min" />
            </label>
          </>
        ) : null}
        {form.type === "library_resource" ? (
          <>
            <label>Descripcion
              <textarea value={form.description} onChange={(event) => setField("description", event.target.value)} />
            </label>
            <label>Tipo de recurso
              <select value={form.resourceType} onChange={(event) => setField("resourceType", event.target.value)}>
                <option value="pdf">PDF</option>
                <option value="audio">Audio</option>
                <option value="video">Video</option>
                <option value="texto">Texto</option>
                <option value="link">Enlace</option>
              </select>
            </label>
            <label>Archivo o URL
              <input value={form.publicFileUrl} onChange={(event) => setField("publicFileUrl", event.target.value)} />
            </label>
          </>
        ) : null}
        {form.type === "pdf" ? (
          <>
            <label>Autor
              <input value={form.author} onChange={(event) => setField("author", event.target.value)} />
            </label>
            <label>Estilo
              <select value={form.style} onChange={(event) => setField("style", event.target.value)}>
                <option value="simple">Simple</option>
                <option value="espiritual">Espiritual</option>
                <option value="libro">Libro</option>
                <option value="apunte">Apunte</option>
              </select>
            </label>
            <label>URL publica del PDF
              <input value={form.publicFileUrl} onChange={(event) => setField("publicFileUrl", event.target.value)} />
            </label>
          </>
        ) : null}
        {form.type !== "post" && form.type !== "book" && form.type !== "course" && form.type !== "meditation" && form.type !== "library_resource" && form.type !== "pdf" ? (
          <label>Descripcion
            <textarea value={form.description} onChange={(event) => setField("description", event.target.value)} />
          </label>
        ) : null}
        <label className="publish-check">
          <input type="checkbox" checked={form.includeContent} onChange={(event) => setField("includeContent", event.target.checked)} />
          Incluir texto del documento
        </label>
        <p className="export-status">
          Firebase guardara solo esta publicacion. El documento original queda privado en Firestore y no se modifica.
        </p>
        <div className="export-actions">
          <button className="ghost compact" type="button" onClick={onClose}>Cancelar</button>
          <button className="primary small" type="submit" disabled={busy}>{submitLabel(form.type)}</button>
        </div>
      </form>
    </ExportModal>
  );
}

function publishTypeHelp(type) {
  const labels = {
    post: "Preparar datos para publicar en Blog.",
    book: "Completar datos para Biblioteca o Libros.",
    course: "Completar datos para Cursos.",
    meditation: "Completar datos para Meditaciones.",
    library_resource: "Completar datos para Biblioteca.",
    pdf: "Generar o publicar un PDF.",
  };
  return labels[type] || "Completar datos de publicacion.";
}

function submitLabel(type) {
  const labels = {
    post: "Publicar en Blog",
    book: "Publicar libro",
    course: "Publicar en Cursos",
    meditation: "Publicar en Meditaciones",
    library_resource: "Publicar en Biblioteca",
    pdf: "Publicar PDF",
  };
  return labels[type] || "Publicar";
}

function detectChapters(markdown = "") {
  return markdown.split("\n").filter((line) =>
    /^#{1,2}\s+/.test(line.trim()) ||
    /^(capitulo|capítulo)\s+\d+/i.test(line.trim()) ||
    /^(introduccion|introducción|prologo|prólogo|epilogo|epílogo)$/i.test(line.trim()),
  ).map((line) => ({
    level: line.startsWith("##") ? 2 : 1,
    title: line.replace(/^#{1,2}\s+/, "").trim(),
  }));
}
