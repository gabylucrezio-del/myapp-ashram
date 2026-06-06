import { ArrowLeft, ChevronLeft, ChevronRight, FileText, List, Moon, Pause, Play, Square, Sun, Type, X } from "lucide-react";
import { getBlob, ref as storageRef } from "firebase/storage";
import { useEffect, useMemo, useRef, useState } from "react";
import { storage } from "./firebase";
import { parseEpubBuffer } from "./epubParser";

export default function EpubReader({ viewer, onClose }) {
  const [book, setBook] = useState(null);
  const [chapterIndex, setChapterIndex] = useState(0);
  const [fontSize, setFontSize] = useState(100);
  const [theme, setTheme] = useState("sepia");
  const [tocOpen, setTocOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("Abriendo EPUB...");
  const [speechState, setSpeechState] = useState("idle");
  const speechRef = useRef({ cancelled: false, chapter: 0, chunk: 0, chunks: [] });
  const storageKey = useMemo(() => `epub-chapter:${viewer.url}`, [viewer.url]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    setStatus("Preparando EPUB...");
    setBook(null);

    async function openBook() {
      try {
        if (viewer.chapters?.length) {
          const parsed = { title: viewer.epubTitle || viewer.title || "", chapters: normalizeViewerChapters(viewer.chapters) };
          const savedIndex = Number(localStorage.getItem(storageKey));
          const initialIndex = Number.isFinite(savedIndex) ? Math.min(parsed.chapters.length - 1, Math.max(0, savedIndex)) : 0;
          setBook(parsed);
          setChapterIndex(initialIndex);
          setLoading(false);
          return;
        }
        const buffer = await loadEpubBuffer(viewer, setStatus);
        if (!isZipBuffer(buffer)) throw new Error("El archivo descargado no parece ser un EPUB valido.");
        setStatus("Leyendo estructura del libro...");
        const parsed = await withTimeout(parseEpubBuffer(buffer, setStatus), 15000, "El EPUB tardo demasiado en preparar los capitulos.");
        if (cancelled) return;
        const savedIndex = Number(localStorage.getItem(storageKey));
        const initialIndex = Number.isFinite(savedIndex) ? Math.min(parsed.chapters.length - 1, Math.max(0, savedIndex)) : 0;
        setBook(parsed);
        setChapterIndex(initialIndex);
        setLoading(false);
      } catch (openError) {
        if (cancelled) return;
        setLoading(false);
        setError(openError?.message || "No se pudo abrir este EPUB. Verifica que sea un archivo .epub valido y que tenga permisos de lectura.");
      }
    }

    openBook();
    return () => {
      cancelled = true;
    };
  }, [viewer.url, storageKey]);

  useEffect(() => {
    return () => stopSpeech();
  }, []);

  const progress = book?.chapters?.length ? Math.round(((chapterIndex + 1) / book.chapters.length) * 100) : 0;
  const currentChapter = book?.chapters?.[chapterIndex];

  function selectChapter(index) {
    if (!book) return;
    const next = Math.min(book.chapters.length - 1, Math.max(0, index));
    stopSpeech();
    setChapterIndex(next);
    localStorage.setItem(storageKey, String(next));
    setTocOpen(false);
  }

  function previousPage() {
    selectChapter(chapterIndex - 1);
  }

  function nextPage() {
    selectChapter(chapterIndex + 1);
  }

  function changeFont(delta) {
    setFontSize((current) => Math.min(150, Math.max(80, current + delta)));
  }

  function exportBookPdf() {
    if (!book?.chapters?.length) return;
    const title = viewer.title || book.title || "Libro EPUB";
    const pdf = buildFormattedPdf({
      title,
      author: viewer.author || viewer.autor || "",
      chapters: book.chapters,
    });
    downloadBlob(new Blob([pdf], { type: "application/pdf" }), safeFileName(title, "pdf"));
  }

  function speakBook() {
    if (!book?.chapters?.length || !("speechSynthesis" in window)) return;
    if (speechState === "paused") {
      window.speechSynthesis.resume();
      setSpeechState("playing");
      return;
    }
    speechRef.current.cancelled = false;
    speechRef.current.chapter = chapterIndex;
    speechRef.current.chunk = 0;
    speechRef.current.chunks = chapterSpeechChunks(book.chapters[chapterIndex], chapterIndex);
    setSpeechState("playing");
    speakNextChunk();
  }

  function pauseSpeech() {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.pause();
    setSpeechState("paused");
  }

  function stopSpeech() {
    speechRef.current.cancelled = true;
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    setSpeechState("idle");
  }

  function speakNextChunk() {
    const speech = speechRef.current;
    if (speech.cancelled || !book?.chapters?.length) return;

    if (speech.chunk >= speech.chunks.length) {
      const nextChapter = speech.chapter + 1;
      if (nextChapter >= book.chapters.length) {
        setSpeechState("idle");
        return;
      }
      speech.chapter = nextChapter;
      speech.chunk = 0;
      speech.chunks = chapterSpeechChunks(book.chapters[nextChapter], nextChapter);
      setChapterIndex(nextChapter);
      localStorage.setItem(storageKey, String(nextChapter));
    }

    const text = speech.chunks[speech.chunk] || "";
    speech.chunk += 1;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "es-AR";
    utterance.rate = 0.95;
    utterance.onend = () => {
      if (!speechRef.current.cancelled) speakNextChunk();
    };
    utterance.onerror = () => {
      if (!speechRef.current.cancelled) setSpeechState("idle");
    };
    window.speechSynthesis.speak(utterance);
  }

  return (
    <div className="modal-backdrop epub-backdrop">
      <div className={`epub-modal epub-theme-${theme}`}>
        <header className="epub-reader-bar">
          <button className="back-icon" type="button" onClick={onClose} aria-label="Cerrar">
            <ArrowLeft size={22} />
          </button>
          <span>
            <strong>{viewer.title || book?.title || "Libro EPUB"}</strong>
            <small>{progress}% leido</small>
          </span>
          <button className="icon-btn" type="button" onClick={() => setTocOpen((open) => !open)} title="Indice">
            <List size={18} />
          </button>
          <button className="icon-btn" type="button" onClick={onClose} title="Cerrar">
            <X size={18} />
          </button>
        </header>

        <div className="epub-reader-tools">
          <button type="button" onClick={() => changeFont(-10)} title="Achicar texto"><Type size={14} /> -</button>
          <span>{fontSize}%</span>
          <button type="button" onClick={() => changeFont(10)} title="Agrandar texto"><Type size={14} /> +</button>
          <button className={theme === "claro" ? "active" : ""} type="button" onClick={() => setTheme("claro")} title="Claro"><Sun size={15} /></button>
          <button className={theme === "sepia" ? "active" : ""} type="button" onClick={() => setTheme("sepia")} title="Sepia">S</button>
          <button className={theme === "oscuro" ? "active" : ""} type="button" onClick={() => setTheme("oscuro")} title="Oscuro"><Moon size={15} /></button>
          <button type="button" onClick={exportBookPdf} title="Exportar libro a PDF" disabled={!book?.chapters?.length}>
            <FileText size={15} /> PDF
          </button>
          {speechState === "playing" ? (
            <button type="button" onClick={pauseSpeech} title="Pausar lectura">
              <Pause size={15} /> Pausar
            </button>
          ) : (
            <button type="button" onClick={speakBook} title="Escuchar libro" disabled={!currentChapter || !("speechSynthesis" in window)}>
              <Play size={15} /> Escuchar
            </button>
          )}
          <button type="button" onClick={stopSpeech} title="Detener lectura" disabled={speechState === "idle"}>
            <Square size={14} /> Detener
          </button>
        </div>

        <div className="epub-reader-body">
          {tocOpen ? (
            <aside className="epub-toc">
              <strong>Indice</strong>
              {book?.chapters?.length ? book.chapters.map((chapter, index) => (
                <button key={`${chapter.href}-${index}`} type="button" onClick={() => selectChapter(index)}>
                  {chapter.title || `Capitulo ${index + 1}`}
                </button>
              )) : <p className="empty-state">Cargando indice...</p>}
            </aside>
          ) : null}

          <button className="epub-page-button prev" type="button" onClick={previousPage} title="Capitulo anterior" disabled={!book || chapterIndex === 0}>
            <ChevronLeft size={24} />
          </button>
          <main className="epub-viewer-wrap">
            {loading ? <p className="empty-state epub-reader-message epub-reader-status">{status}</p> : null}
            {error ? (
              <div className="epub-error">
                <strong>No se pudo abrir el EPUB</strong>
                <p>{error}</p>
                <button className="primary small" type="button" onClick={onClose}>
                  Cerrar lector
                </button>
              </div>
            ) : null}
            {currentChapter ? (
              <article
                className="epub-fallback-page"
                style={{ fontSize: `${fontSize}%` }}
                dangerouslySetInnerHTML={{ __html: currentChapter.html }}
              />
            ) : null}
          </main>
          <button className="epub-page-button next" type="button" onClick={nextPage} title="Capitulo siguiente" disabled={!book || chapterIndex >= book.chapters.length - 1}>
            <ChevronRight size={24} />
          </button>
        </div>

        <div className="epub-progress">
          <span style={{ width: `${progress}%` }} />
        </div>
      </div>
    </div>
  );
}

async function loadEpubBuffer(viewer, setStatus) {
  let storageError = null;
  if (viewer.path) {
    try {
      setStatus("Preparando archivo desde Biblioteca...");
      const blob = await withTimeout(getBlob(storageRef(storage, viewer.path)), 60000, "Firebase Storage no respondio a tiempo.");
      return blob.arrayBuffer();
    } catch (error) {
      storageError = error;
    }
  }
  setStatus("Preparando archivo desde Biblioteca...");
  try {
    const response = await fetchWithTimeout(viewer.url, 60000);
    if (!response.ok) throw new Error(`No se pudo descargar el EPUB (${response.status}).`);
    return response.arrayBuffer();
  } catch (urlError) {
    throw new Error(storageError ? `${storageError.message || storageError}. Tambien fallo la URL publica: ${urlError.message || urlError}` : (urlError.message || "No se pudo descargar el EPUB."));
  }
}

function isZipBuffer(buffer) {
  const bytes = new Uint8Array(buffer, 0, Math.min(4, buffer.byteLength));
  return bytes[0] === 0x50 && bytes[1] === 0x4b;
}

function withTimeout(promise, ms, message) {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = window.setTimeout(() => reject(new Error(message)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => window.clearTimeout(timeoutId));
}

async function fetchWithTimeout(url, ms) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { mode: "cors", signal: controller.signal });
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function normalizeViewerChapters(chapters = []) {
  return chapters.map((chapter, index) => ({
    href: chapter.href || `chapter-${index + 1}`,
    title: chapter.title || chapter.titulo || `Capitulo ${index + 1}`,
    html: chapter.html || markdownToHtml(chapter.content || chapter.contenidoMarkdown || chapter.texto || ""),
  }));
}

function markdownToHtml(markdown = "") {
  const lines = String(markdown || "").split(/\r?\n/);
  const html = [];
  let list = [];

  function flushList() {
    if (!list.length) return;
    html.push(`<ul>${list.map((item) => `<li>${inlineMarkdownToHtml(item)}</li>`).join("")}</ul>`);
    list = [];
  }

  for (let index = 0; index < lines.length; index += 1) {
    const rawLine = lines[index];
    const line = rawLine.trim();
    if (!line) {
      flushList();
      continue;
    }
    if (line.startsWith("|")) {
      const tableLines = [];
      while (index < lines.length && lines[index].trim().startsWith("|")) {
        tableLines.push(lines[index]);
        index += 1;
      }
      index -= 1;
      flushList();
      html.push(markdownTableToHtml(tableLines.join("\n")));
      continue;
    }
    if (line.startsWith("- ")) {
      list.push(line.slice(2));
      continue;
    }
    flushList();
    if (line.startsWith("### ")) html.push(`<h3>${inlineMarkdownToHtml(line.slice(4))}</h3>`);
    else if (line.startsWith("## ")) html.push(`<h2>${inlineMarkdownToHtml(line.slice(3))}</h2>`);
    else if (line.startsWith("# ")) html.push(`<h1>${inlineMarkdownToHtml(line.slice(2))}</h1>`);
    else if (line.startsWith("> ")) html.push(`<blockquote>${inlineMarkdownToHtml(line.slice(2))}</blockquote>`);
    else html.push(`<p>${inlineMarkdownToHtml(line)}</p>`);
  }
  flushList();
  return html.join("\n") || "<p>Capitulo sin contenido guardado.</p>";
}

function markdownTableToHtml(table = "") {
  const rows = table.trim().split(/\r?\n/).filter((row) => row.trim().startsWith("|"));
  if (rows.length < 2) return `<p>${inlineMarkdownToHtml(table)}</p>`;
  const cells = rows.map((row) => row.trim().replace(/^\||\|$/g, "").split("|").map((cell) => cell.trim()));
  const headers = cells[0] || [];
  const body = cells.slice(2);
  return `<table><thead><tr>${headers.map((header) => `<th>${inlineMarkdownToHtml(header)}</th>`).join("")}</tr></thead><tbody>${body.map((row) => `<tr>${row.map((cell) => `<td>${inlineMarkdownToHtml(cell)}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
}

function inlineMarkdownToHtml(text = "") {
  return escapeHtml(text)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\[([^\]]+)]\(([^)]+)\)/g, '<a href="$2">$1</a>');
}

function escapeHtml(value = "") {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function chapterSpeechChunks(chapter, index) {
  const title = chapter?.title || `Capitulo ${index + 1}`;
  const text = `${title}. ${htmlToText(chapter?.html || "")}`.replace(/\s+/g, " ").trim();
  return splitSpeechText(text || "Capitulo sin contenido.", 1800);
}

function splitSpeechText(text, size) {
  const sentences = String(text || "").match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [text];
  const chunks = [];
  let current = "";
  sentences.forEach((sentence) => {
    const next = `${current} ${sentence}`.trim();
    if (next.length > size && current) {
      chunks.push(current);
      current = sentence.trim();
    } else {
      current = next;
    }
  });
  if (current) chunks.push(current);
  return chunks.length ? chunks : [String(text || "")];
}

function htmlToText(html = "") {
  const parser = new DOMParser();
  const document = parser.parseFromString(String(html || ""), "text/html");
  document.querySelectorAll("script, style").forEach((node) => node.remove());
  return (document.body?.textContent || "").replace(/\s+/g, " ").trim();
}

function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function safeFileName(name, extension) {
  const clean = String(name || "libro").toLowerCase().replace(/[^a-z0-9a-z]+/gi, "-").replace(/^-+|-+$/g, "") || "libro";
  return clean.endsWith(`.${extension}`) ? clean : `${clean}.${extension}`;
}

function buildFormattedPdf({ title, author, chapters }) {
  const writer = createPdfWriter();
  writer.addCover(title, author);
  chapters.forEach((chapter, index) => {
    writer.addChapter(chapter, index);
  });
  return writer.finish();
}

function createPdfWriter() {
  const pageWidth = 595;
  const pageHeight = 842;
  const marginX = 58;
  const bottom = 58;
  const top = 790;
  const maxWidth = pageWidth - marginX * 2;
  let pages = [];
  let commands = [];
  let y = top;

  function newPage() {
    if (commands.length) pages.push(commands.join("\n"));
    commands = [];
    y = top;
  }

  function ensureSpace(height) {
    if (y - height < bottom) newPage();
  }

  function addLine(segments, size, options = {}) {
    ensureSpace(size * 1.45);
    let x = options.indent ? marginX + options.indent : marginX;
    const alignWidth = segments.reduce((sum, segment) => sum + estimatePdfTextWidth(segment.text, size, segment.bold), 0);
    if (options.align === "center") x = Math.max(marginX, (pageWidth - alignWidth) / 2);
    segments.forEach((segment) => {
      const text = normalizePdfText(segment.text);
      if (!text) return;
      const font = segment.bold ? "F2" : segment.italic ? "F3" : "F1";
      commands.push(`BT /${font} ${size} Tf ${round(x)} ${round(y)} Td (${escapePdf(text)}) Tj ET`);
      x += estimatePdfTextWidth(text, size, segment.bold);
    });
    y -= options.lineHeight || size * 1.45;
  }

  function addWrapped(segments, size, options = {}) {
    wrapInlineSegments(segments, size, maxWidth - (options.indent || 0)).forEach((line) => addLine(line, size, options));
  }

  function addBlock(block) {
    const text = block.segments.map((segment) => segment.text).join("").trim();
    if (!text) return;
    const config = {
      h1: { size: 21, before: 18, after: 8, bold: true },
      h2: { size: 16, before: 14, after: 6, bold: true },
      h3: { size: 13, before: 10, after: 5, bold: true },
      quote: { size: 11, before: 7, after: 7, indent: 18 },
      li: { size: 11, before: 3, after: 3, indent: 16, prefix: "- " },
      p: { size: 11, before: 4, after: 6 },
    }[block.type] || { size: 11, before: 4, after: 6 };
    y -= config.before;
    const source = config.prefix ? [{ text: config.prefix, bold: false }, ...block.segments] : block.segments;
    addWrapped(source.map((segment) => ({ ...segment, bold: config.bold || segment.bold })), config.size, { indent: config.indent || 0 });
    y -= config.after;
  }

  function addTable(table) {
    y -= 8;
    table.rows.forEach((row, rowIndex) => {
      const segments = row.flatMap((cell, cellIndex) => [
        { text: cellIndex === 0 ? cell : `  |  ${cell}`, bold: rowIndex === 0, italic: false },
      ]);
      addWrapped(segments, rowIndex === 0 ? 10.5 : 10, { indent: 8 });
    });
    y -= 8;
  }

  function addCover(coverTitle, coverAuthor) {
    y = 610;
    wrapInlineSegments([{ text: coverTitle || "Libro", bold: true }], 26, maxWidth).forEach((line) => addLine(line, 26, { align: "center", lineHeight: 34 }));
    if (coverAuthor) {
      y -= 18;
      addLine([{ text: coverAuthor, bold: false }], 14, { align: "center" });
    }
    y = 125;
    addLine([{ text: "Ashram Ganesha", bold: false }], 11, { align: "center" });
    newPage();
  }

  function addChapter(chapter, index) {
    const title = chapter?.title || `Capitulo ${index + 1}`;
    addBlock({ type: "h1", segments: [{ text: title, bold: true }] });
    const blocks = extractPdfBlocks(chapter?.html || "");
    if (blocks[0]?.type === "h1" && sameText(blocks[0].segments.map((segment) => segment.text).join(""), title)) blocks.shift();
    blocks.forEach((block) => {
      if (block.type === "table") addTable(block);
      else addBlock(block);
    });
  }

  function finish() {
    if (commands.length) pages.push(commands.join("\n"));
    if (!pages.length) pages = [""];
    return assemblePdf(pages);
  }

  return { addCover, addChapter, finish };
}

function extractPdfBlocks(html = "") {
  const parser = new DOMParser();
  const document = parser.parseFromString(String(html || ""), "text/html");
  document.querySelectorAll("script, style, img").forEach((node) => node.remove());
  const blocks = [];
  Array.from(document.body.children).forEach((node) => {
    collectPdfBlocksFromNode(node, blocks);
  });
  if (!blocks.length) {
    const text = document.body?.textContent?.trim();
    if (text) blocks.push({ type: "p", segments: [{ text, bold: false, italic: false }] });
  }
  return blocks;
}

function collectPdfBlocksFromNode(node, blocks) {
  if (node.nodeType !== Node.ELEMENT_NODE) return;
  const tag = node.tagName.toLowerCase();
  if (tag === "table") {
    const rows = Array.from(node.querySelectorAll("tr")).map((row) => Array.from(row.children).map((cell) => cell.textContent.replace(/\s+/g, " ").trim()));
    if (rows.length) blocks.push({ type: "table", rows });
    return;
  }
  if (["h1", "h2", "h3", "h4", "h5", "h6", "p", "blockquote", "li"].includes(tag)) {
    const tag = node.tagName.toLowerCase();
    const type = tag === "li" ? "li" : tag === "blockquote" ? "quote" : ["h1", "h2", "h3"].includes(tag) ? tag : "p";
    const segments = collectInlineSegments(node).filter((segment) => segment.text.trim());
    if (segments.length) blocks.push({ type, segments });
    return;
  }
  Array.from(node.children).forEach((child) => collectPdfBlocksFromNode(child, blocks));
}

function collectInlineSegments(node, style = {}) {
  if (node.nodeType === Node.TEXT_NODE) return [{ text: node.textContent || "", bold: Boolean(style.bold), italic: Boolean(style.italic) }];
  if (node.nodeType !== Node.ELEMENT_NODE) return [];
  const tag = node.tagName.toLowerCase();
  const nextStyle = {
    bold: style.bold || tag === "strong" || tag === "b",
    italic: style.italic || tag === "em" || tag === "i",
  };
  return Array.from(node.childNodes).flatMap((child) => collectInlineSegments(child, nextStyle));
}

function wrapInlineSegments(segments, size, maxWidth) {
  const lines = [];
  let line = [];
  let width = 0;
  segments.forEach((segment) => {
    splitWords(segment.text).forEach((word) => {
      const wordWidth = estimatePdfTextWidth(word, size, segment.bold);
      if (line.length && width + wordWidth > maxWidth) {
        lines.push(trimLineSegments(line));
        line = [];
        width = 0;
      }
      line.push({ ...segment, text: word });
      width += wordWidth;
    });
  });
  if (line.length) lines.push(trimLineSegments(line));
  return lines.filter((lineSegments) => lineSegments.some((segment) => segment.text.trim()));
}

function splitWords(text = "") {
  return normalizePdfText(text).split(/(\s+)/).filter(Boolean);
}

function trimLineSegments(segments) {
  const copy = segments.map((segment) => ({ ...segment }));
  while (copy.length && !copy[0].text.trim()) copy.shift();
  while (copy.length && !copy[copy.length - 1].text.trim()) copy.pop();
  return copy;
}

function assemblePdf(pageStreams) {
  const objects = [];
  const pageRefs = [];
  objects.push("<< /Type /Catalog /Pages 2 0 R >>");
  objects.push("<< /Type /Pages /Kids [] /Count 0 >>");
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique >>");
  pageStreams.forEach((stream) => {
    const contentId = objects.length + 2;
    const pageId = objects.length + 1;
    pageRefs.push(`${pageId} 0 R`);
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R >> >> /Contents ${contentId} 0 R >>`);
    objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
  });
  objects[1] = `<< /Type /Pages /Kids [${pageRefs.join(" ")}] /Count ${pageRefs.length} >>`;
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return pdf;
}

function estimatePdfTextWidth(text = "", size = 11, bold = false) {
  return String(text || "").length * size * (bold ? 0.56 : 0.52);
}

function normalizePdfText(value = "") {
  return String(value || "").replace(/\s+/g, " ");
}

function round(value) {
  return Math.round(value * 100) / 100;
}

function sameText(left = "", right = "") {
  return normalizePdfText(left).trim().toLowerCase() === normalizePdfText(right).trim().toLowerCase();
}

function escapePdf(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, "");
}
