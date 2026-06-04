import { BookOpen, Download, Edit3, FilePlus2, GraduationCap, Library, Plus, Save, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import NoteEditor from "./NoteEditor";
import { uploadEpub } from "./utils";
import {
  deleteBookChapter,
  deleteBookProject,
  listenBookChapters,
  listenBookProjects,
  saveBookChapter,
  saveBookProject,
} from "./firebaseNotesService";

const emptyBook = {
  titulo: "",
  autor: "",
  descripcion: "",
  portadaUrl: "",
  estado: "borrador",
};

export default function BookStudio({ profile, onToast, onPublishToLibrary }) {
  const [books, setBooks] = useState([]);
  const [chapters, setChapters] = useState([]);
  const [selectedBookId, setSelectedBookId] = useState("");
  const [selectedChapterId, setSelectedChapterId] = useState("");
  const [editingBook, setEditingBook] = useState(null);
  const [editingChapter, setEditingChapter] = useState(null);
  const [epubChoiceOpen, setEpubChoiceOpen] = useState(false);
  const [epubBusy, setEpubBusy] = useState(false);
  const isAdmin = profile?.rol === "admin";

  useEffect(() => {
    if (!isAdmin) return undefined;
    return listenBookProjects(setBooks);
  }, [isAdmin]);

  const selectedBook = books.find((book) => book.id === selectedBookId) || books[0] || null;
  const selectedChapter = chapters.find((chapter) => chapter.id === selectedChapterId) || chapters[0] || null;

  useEffect(() => {
    if (selectedBook && selectedBook.id !== selectedBookId) setSelectedBookId(selectedBook.id);
    if (!books.length) setSelectedBookId("");
  }, [books, selectedBook, selectedBookId]);

  useEffect(() => {
    if (!selectedBook?.id) {
      setChapters([]);
      return undefined;
    }
    return listenBookChapters(selectedBook.id, setChapters);
  }, [selectedBook?.id]);

  useEffect(() => {
    if (selectedChapter && selectedChapter.id !== selectedChapterId) setSelectedChapterId(selectedChapter.id);
    if (!chapters.length) setSelectedChapterId("");
  }, [chapters, selectedChapter, selectedChapterId]);

  const editorChapter = editingChapter || selectedChapter || null;

  const stats = useMemo(() => {
    const words = chapters.reduce((count, chapter) => count + wordCount(chapter.contenidoMarkdown), 0);
    return { chapters: chapters.length, words };
  }, [chapters]);

  if (!isAdmin) {
    return (
      <div className="archive-panel">
        <h2>Libros</h2>
        <p>Este espacio es privado para administradores.</p>
      </div>
    );
  }

  async function saveBook(event) {
    event.preventDefault();
    if (!editingBook?.titulo?.trim()) return;
    const id = await saveBookProject(editingBook);
    setEditingBook(null);
    setSelectedBookId(id);
    onToast?.("Libro guardado.");
  }

  async function removeBook(book) {
    if (!book || !window.confirm(`Borrar el libro "${book.titulo || "Sin titulo"}" y todos sus capitulos?`)) return;
    await deleteBookProject(book.id);
    setSelectedBookId("");
    setSelectedChapterId("");
    onToast?.("Libro eliminado.");
  }

  function createChapter() {
    if (!selectedBook) return;
    setEditingChapter({
      titulo: `Capitulo ${chapters.length + 1}`,
      contenidoMarkdown: "",
      orden: chapters.length + 1,
      estado: "borrador",
    });
    setSelectedChapterId("");
  }

  async function saveChapter(chapter) {
    if (!selectedBook) return;
    const savedChapter = await saveBookChapter(selectedBook.id, {
      ...chapter,
      orden: chapter.orden || chapters.length + 1,
    });
    setChapters((current) => sortChapters(upsertChapter(current, savedChapter)));
    setEditingChapter(null);
    setSelectedChapterId(savedChapter.id);
    onToast?.("Capitulo guardado.");
  }

  async function removeChapter(chapter) {
    if (!selectedBook || !chapter || !window.confirm(`Borrar el capitulo "${chapter.titulo || "Sin titulo"}"?`)) return;
    await deleteBookChapter(selectedBook.id, chapter.id);
    setSelectedChapterId("");
    onToast?.("Capitulo eliminado.");
  }

  function createSelectedEpubFile() {
    if (!selectedBook) return;
    const emptyChapters = chapters.filter((chapter) => !chapterMarkdown(chapter).trim());
    if (emptyChapters.length) {
      const proceed = window.confirm(`Hay ${emptyChapters.length} capitulo${emptyChapters.length === 1 ? "" : "s"} sin contenido guardado. ¿Crear el EPUB igual?`);
      if (!proceed) return null;
    }
    const blob = createEpubBlob(selectedBook, chapters);
    const fileName = `${slugify(selectedBook.titulo || "libro")}.epub`;
    return new File([blob], fileName, { type: "application/epub+zip" });
  }

  function downloadEpub() {
    const file = createSelectedEpubFile();
    if (!file) return;
    const url = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = url;
    link.download = file.name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setEpubChoiceOpen(false);
    onToast?.("EPUB exportado.");
  }

  async function publishEpub(target = "biblioteca") {
    if (!selectedBook) return;
    setEpubBusy(true);
    try {
      const file = createSelectedEpubFile();
      if (!file) return;
      const isLibrary = target === "biblioteca";
      const isCourse = target === "curso";
      const uploaded = await uploadEpub(file, isLibrary ? "biblioteca/epubs" : "contenidos/conocimiento/epubs");
      const epubDraft = {
        titulo: selectedBook.titulo || "",
        descripcion: selectedBook.descripcion || "",
        imagen: selectedBook.portadaUrl || "",
        epub: uploaded.url,
        epub_url: uploaded.url,
        epub_path: uploaded.path,
        epub_file_name: file.name,
        epub_title: selectedBook.titulo || "",
        epub_chapters: chapters.map((chapter) => ({
          title: chapter.titulo || "",
          content: chapterMarkdown(chapter),
        })),
      };
      if (isLibrary) {
        epubDraft.autor = selectedBook.autor || "";
        epubDraft.portada_url = selectedBook.portadaUrl || "";
      } else {
        epubDraft.etiqueta = isCourse ? selectedBook.titulo || "Curso" : "Conocimiento";
        epubDraft.categoria = epubDraft.etiqueta;
        epubDraft.orden = isCourse ? 1 : "";
        epubDraft.curso_acceso = isCourse ? "gratis" : "suscripcion";
        epubDraft.video = "";
        epubDraft.link_video_original = "";
      }
      onPublishToLibrary?.(target, epubDraft);
      setEpubChoiceOpen(false);
      const targetLabel = isLibrary ? "Biblioteca" : isCourse ? "Curso" : "Conocimiento";
      onToast?.(`EPUB cargado en el formulario de ${targetLabel}.`);
    } catch (error) {
      onToast?.(`No pude preparar el EPUB: ${error.message}`);
    } finally {
      setEpubBusy(false);
    }
  }

  return (
    <div className="book-studio">
      <aside className="book-sidebar">
        <div className="book-panel-head">
          <span>
            <strong>Libros</strong>
            <small>{books.length} proyectos</small>
          </span>
          <button className="icon-btn" type="button" onClick={() => setEditingBook({ ...emptyBook })} title="Nuevo libro">
            <Plus size={16} />
          </button>
        </div>

        {books.length === 0 ? <p className="empty-state">Crea tu primer libro para empezar a escribir.</p> : null}
        <div className="book-list">
          {books.map((book) => (
            <button className={`book-row ${selectedBook?.id === book.id ? "active" : ""}`} key={book.id} type="button" onClick={() => { setSelectedBookId(book.id); setEditingBook(null); setEditingChapter(null); }}>
              <BookOpen size={16} />
              <span>
                <strong>{book.titulo || "Sin titulo"}</strong>
                <small>{book.autor || "Sin autor"}</small>
              </span>
            </button>
          ))}
        </div>
      </aside>

      <main className="book-main">
        <div className="book-hero">
          <span>
            <small>Editor de libros</small>
            <h2>{selectedBook?.titulo || "Nuevo libro"}</h2>
            <p>{selectedBook?.descripcion || "Escribe capitulos desde la tablet y exporta tu libro cuando este listo."}</p>
          </span>
          <div className="book-actions">
            <button className="ghost compact" type="button" onClick={() => selectedBook && setEditingBook(selectedBook)} disabled={!selectedBook}><Edit3 size={15} /> Editar libro</button>
            <button className="ghost compact" type="button" onClick={() => removeBook(selectedBook)} disabled={!selectedBook}><Trash2 size={15} /> Borrar</button>
            <button className="primary small" type="button" onClick={() => setEpubChoiceOpen(true)} disabled={!selectedBook || !chapters.length}><Download size={15} /> EPUB</button>
          </div>
        </div>

        {epubChoiceOpen ? (
          <div className="book-epub-popover" role="dialog" aria-label="Exportar EPUB">
            <strong>EPUB del libro</strong>
            <small>Elegi si queres publicarlo, cargarlo como conocimiento/curso o descargarlo.</small>
            <div>
              <button className="primary small" type="button" onClick={() => publishEpub("biblioteca")} disabled={epubBusy}>
                <Library size={15} /> {epubBusy ? "Preparando..." : "Biblioteca"}
              </button>
              <button className="primary small" type="button" onClick={() => publishEpub("conocimiento")} disabled={epubBusy}>
                <BookOpen size={15} /> Conocimiento
              </button>
              <button className="primary small" type="button" onClick={() => publishEpub("curso")} disabled={epubBusy}>
                <GraduationCap size={15} /> Curso
              </button>
              <button className="ghost compact" type="button" onClick={downloadEpub} disabled={epubBusy}>Descargar</button>
              <button className="ghost compact" type="button" onClick={() => setEpubChoiceOpen(false)} disabled={epubBusy}>Cancelar</button>
            </div>
          </div>
        ) : null}

        {editingBook ? (
          <form className="book-meta-form" onSubmit={saveBook}>
            <label>Titulo<input value={editingBook.titulo} onChange={(event) => setEditingBook((current) => ({ ...current, titulo: event.target.value }))} placeholder="Titulo del libro" /></label>
            <label>Autor<input value={editingBook.autor} onChange={(event) => setEditingBook((current) => ({ ...current, autor: event.target.value }))} placeholder="Nombre del autor" /></label>
            <label>Descripcion<textarea value={editingBook.descripcion} onChange={(event) => setEditingBook((current) => ({ ...current, descripcion: event.target.value }))} placeholder="Descripcion breve" /></label>
            <label>Portada URL<input value={editingBook.portadaUrl} onChange={(event) => setEditingBook((current) => ({ ...current, portadaUrl: event.target.value }))} placeholder="Link de portada opcional" /></label>
            <div className="form-actions">
              <button className="ghost compact" type="button" onClick={() => setEditingBook(null)}>Cancelar</button>
              <button className="primary small" type="submit"><Save size={15} /> Guardar libro</button>
            </div>
          </form>
        ) : null}

        {selectedBook ? (
          <section className="book-workspace">
            <aside className="chapter-panel">
              <div className="book-panel-head">
                <span>
                  <strong>Capitulos</strong>
                  <small>{stats.chapters} capitulos - {stats.words} palabras</small>
                </span>
                <button className="icon-btn" type="button" onClick={createChapter} title="Nuevo capitulo">
                  <FilePlus2 size={16} />
                </button>
              </div>
              {chapters.length === 0 ? <p className="empty-state">Todavia no hay capitulos.</p> : null}
              {chapters.map((chapter) => (
                <button className={`chapter-row ${selectedChapter?.id === chapter.id ? "active" : ""}`} key={chapter.id} type="button" onClick={() => { setSelectedChapterId(chapter.id); setEditingChapter(null); }}>
                  <span>
                    <strong>{chapter.orden || 0}. {chapter.titulo || "Sin titulo"}</strong>
                    <small>{wordCount(chapter.contenidoMarkdown)} palabras</small>
                  </span>
                  <Edit3 size={15} onClick={(event) => { event.stopPropagation(); setEditingChapter(chapter); }} />
                </button>
              ))}
            </aside>

            <section className="chapter-editor">
              {editorChapter ? (
                <>
                  <div className="chapter-actions">
                    <span>{editingChapter ? "Editando capitulo" : "Capitulo actual"}</span>
                    <button className="ghost compact danger" type="button" onClick={() => removeChapter(selectedChapter)} disabled={!selectedChapter}><Trash2 size={15} /> Borrar capitulo</button>
                  </div>
                  <NoteEditor
                    key={`${editorChapter.id || `new-chapter-${selectedBook.id}-${chapters.length}`}-${editorChapter.actualizadoEn || ""}`}
                    note={editorChapter}
                    folders={[]}
                    notes={chapters.filter((chapter) => chapter.id !== editorChapter.id)}
                    mode="chapter"
                    hideResourceFields
                    onSave={saveChapter}
                  />
                </>
              ) : (
                <div className="book-empty-editor">
                  <BookOpen size={34} />
                  <h2>Elige o crea un capitulo</h2>
                  <button className="primary small" type="button" onClick={createChapter}><FilePlus2 size={15} /> Nuevo capitulo</button>
                </div>
              )}
            </section>
          </section>
        ) : null}
      </main>
    </div>
  );
}

function wordCount(text = "") {
  return (text.replace(/[#>*_`[\]()!-]/g, " ").match(/\S+/g) || []).length;
}

function upsertChapter(chapters, chapter) {
  if (!chapter?.id) return chapters;
  const exists = chapters.some((item) => item.id === chapter.id);
  if (!exists) return [...chapters, chapter];
  return chapters.map((item) => item.id === chapter.id ? { ...item, ...chapter } : item);
}

function sortChapters(chapters) {
  return [...chapters].sort((a, b) => (a.orden || 0) - (b.orden || 0));
}

function createEpubBlob(book, chapters) {
  const now = new Date().toISOString();
  const safeTitle = escapeXml(book.titulo || "Libro");
  const safeAuthor = escapeXml(book.autor || "Ashram Ganesha");
  const sorted = [...chapters].sort((a, b) => (a.orden || 0) - (b.orden || 0));
  const files = [
    { path: "mimetype", content: "application/epub+zip", store: true },
    { path: "META-INF/container.xml", content: `<?xml version="1.0" encoding="UTF-8"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>` },
    { path: "OEBPS/nav.xhtml", content: navXhtml(book, sorted) },
    {
      path: "OEBPS/content.opf",
      content: `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="book-id">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="book-id">urn:ashram:${escapeXml(slugify(book.id || book.titulo || "libro"))}</dc:identifier>
    <dc:title>${safeTitle}</dc:title>
    <dc:creator>${safeAuthor}</dc:creator>
    <dc:language>es</dc:language>
    <meta property="dcterms:modified">${now}</meta>
  </metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    ${sorted.map((chapter, index) => `<item id="chapter-${index + 1}" href="chapter-${index + 1}.xhtml" media-type="application/xhtml+xml"/>`).join("\n    ")}
  </manifest>
  <spine>
    ${sorted.map((_, index) => `<itemref idref="chapter-${index + 1}"/>`).join("\n    ")}
  </spine>
</package>`,
    },
    ...sorted.map((chapter, index) => ({
      path: `OEBPS/chapter-${index + 1}.xhtml`,
      content: chapterXhtml(chapter, index + 1),
    })),
  ];
  return new Blob([zipFiles(files)], { type: "application/epub+zip" });
}

function navXhtml(book, chapters) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="es">
<head><title>${escapeXml(book.titulo || "Libro")}</title></head>
<body>
<nav epub:type="toc" id="toc"><h1>${escapeXml(book.titulo || "Libro")}</h1><ol>
${chapters.map((chapter, index) => `<li><a href="chapter-${index + 1}.xhtml">${escapeXml(chapter.titulo || `Capitulo ${index + 1}`)}</a></li>`).join("\n")}
</ol></nav>
</body></html>`;
}

function chapterXhtml(chapter, index) {
  const markdown = chapterMarkdown(chapter);
  return `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" lang="es">
<head><title>${escapeXml(chapter.titulo || `Capitulo ${index}`)}</title></head>
<body>
<h1>${escapeXml(chapter.titulo || `Capitulo ${index}`)}</h1>
${markdownToXhtml(markdown || "_Capitulo sin contenido guardado._")}
</body></html>`;
}

function chapterMarkdown(chapter) {
  return String(
    chapter?.contenidoMarkdown
    || chapter?.contentMarkdown
    || chapter?.contenido
    || chapter?.texto
    || "",
  );
}

function markdownToXhtml(markdown) {
  const lines = markdown.split(/\r?\n/);
  const html = [];
  let list = [];
  function flushList() {
    if (!list.length) return;
    html.push(`<ul>${list.map((item) => `<li>${inlineMarkdownToXhtml(item)}</li>`).join("")}</ul>`);
    list = [];
  }
  lines.forEach((rawLine) => {
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
    if (line.startsWith("### ")) html.push(`<h3>${inlineMarkdownToXhtml(line.slice(4))}</h3>`);
    else if (line.startsWith("## ")) html.push(`<h2>${inlineMarkdownToXhtml(line.slice(3))}</h2>`);
    else if (line.startsWith("# ")) html.push(`<h1>${inlineMarkdownToXhtml(line.slice(2))}</h1>`);
    else if (line.startsWith("> ")) html.push(`<blockquote>${inlineMarkdownToXhtml(line.slice(2))}</blockquote>`);
    else html.push(`<p>${inlineMarkdownToXhtml(line)}</p>`);
  });
  flushList();
  return html.join("\n") || "<p></p>";
}

function inlineMarkdownToXhtml(text) {
  let html = escapeXml(text);
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  return html;
}

function zipFiles(files) {
  const encoder = new TextEncoder();
  const chunks = [];
  const central = [];
  let offset = 0;
  files.forEach((file) => {
    const name = encoder.encode(file.path);
    const data = encoder.encode(file.content);
    const crc = crc32(data);
    const local = new Uint8Array(30 + name.length);
    const view = new DataView(local.buffer);
    view.setUint32(0, 0x04034b50, true);
    view.setUint16(4, 20, true);
    view.setUint16(6, 0, true);
    view.setUint16(8, file.store ? 0 : 0, true);
    view.setUint32(14, crc, true);
    view.setUint32(18, data.length, true);
    view.setUint32(22, data.length, true);
    view.setUint16(26, name.length, true);
    local.set(name, 30);
    chunks.push(local, data);

    const entry = new Uint8Array(46 + name.length);
    const entryView = new DataView(entry.buffer);
    entryView.setUint32(0, 0x02014b50, true);
    entryView.setUint16(4, 20, true);
    entryView.setUint16(6, 20, true);
    entryView.setUint16(10, file.store ? 0 : 0, true);
    entryView.setUint32(16, crc, true);
    entryView.setUint32(20, data.length, true);
    entryView.setUint32(24, data.length, true);
    entryView.setUint16(28, name.length, true);
    entryView.setUint32(42, offset, true);
    entry.set(name, 46);
    central.push(entry);
    offset += local.length + data.length;
  });
  const centralSize = central.reduce((sum, entry) => sum + entry.length, 0);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(8, files.length, true);
  endView.setUint16(10, files.length, true);
  endView.setUint32(12, centralSize, true);
  endView.setUint32(16, offset, true);
  return new Blob([...chunks, ...central, end]);
}

function crc32(data) {
  let crc = -1;
  for (let i = 0; i < data.length; i += 1) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ data[i]) & 0xff];
  }
  return (crc ^ -1) >>> 0;
}

const crcTable = Array.from({ length: 256 }, (_, index) => {
  let crc = index;
  for (let bit = 0; bit < 8; bit += 1) crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  return crc >>> 0;
});

function slugify(value = "") {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "libro";
}

function escapeXml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
