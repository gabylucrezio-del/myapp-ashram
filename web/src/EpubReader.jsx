import { ArrowLeft, ChevronLeft, ChevronRight, List, Moon, Sun, Type, X } from "lucide-react";
import { getBlob, ref as storageRef } from "firebase/storage";
import { useEffect, useMemo, useState } from "react";
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
          const parsed = { title: viewer.epubTitle || viewer.title || "", chapters: viewer.chapters };
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

  const progress = book?.chapters?.length ? Math.round(((chapterIndex + 1) / book.chapters.length) * 100) : 0;
  const currentChapter = book?.chapters?.[chapterIndex];

  function selectChapter(index) {
    if (!book) return;
    const next = Math.min(book.chapters.length - 1, Math.max(0, index));
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
