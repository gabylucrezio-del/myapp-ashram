import { BookOpen, Camera, Copy, Edit3, FileText, FolderOpen, FolderPlus, GraduationCap, Headphones, Maximize2, Palette, Pause, Play, Plus, Search, Sparkles, Trash2, Type, Users, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import FolderList from "./FolderList";
import NoteEditor from "./NoteEditor";
import {
  deleteFolder,
  deleteNote,
  listenNoteFolders,
  listenPrivateNotes,
  publishNoteToBlog,
  publishNoteToCurso,
  publishNoteToMeditaciones,
  publishNoteToSatsang,
  saveFolder,
  saveNote,
} from "./firebaseNotesService";

const LOCAL_FOLDERS_CACHE_KEY = "ashramTeleprompterFolders";
const LOCAL_NOTES_CACHE_KEY = "ashramTeleprompterNotes";

export default function CuadernoAshram({ profile, quickNoteRequest = 0, onQuickNoteHandled, onToast, onShared }) {
  const [folders, setFolders] = useState(() => readLocalCache(LOCAL_FOLDERS_CACHE_KEY));
  const [notes, setNotes] = useState(() => readLocalCache(LOCAL_NOTES_CACHE_KEY));
  const [selectedFolderId, setSelectedFolderId] = useState("");
  const [selectedNoteId, setSelectedNoteId] = useState("");
  const [editingNote, setEditingNote] = useState(null);
  const [newNoteFolderId, setNewNoteFolderId] = useState("");
  const [treeOpen, setTreeOpen] = useState(false);
  const [noteSearch, setNoteSearch] = useState("");
  const [noteFilter, setNoteFilter] = useState("todas");
  const [prompterPickerOpen, setPrompterPickerOpen] = useState(false);
  const [prompterOpen, setPrompterOpen] = useState(false);
  const [prompterNote, setPrompterNote] = useState(null);
  const isAdmin = profile?.rol === "admin";

  useEffect(() => {
    if (!isAdmin) return undefined;
    const offFolders = listenNoteFolders((nextFolders) => {
      setFolders(nextFolders);
      writeLocalCache(LOCAL_FOLDERS_CACHE_KEY, nextFolders);
    });
    const offNotes = listenPrivateNotes((nextNotes) => {
      setNotes(nextNotes);
      writeLocalCache(LOCAL_NOTES_CACHE_KEY, nextNotes);
    });
    return () => {
      offFolders();
      offNotes();
    };
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin || !quickNoteRequest) return;
    createQuickNote().finally(() => onQuickNoteHandled?.());
  }, [isAdmin, quickNoteRequest]);

  const filteredNotes = useMemo(() => {
    const byFolder = selectedFolderId ? notes.filter((note) => note.folderId === selectedFolderId) : notes;
    const byStatus = byFolder.filter((note) => {
      if (noteFilter === "pendientes") return note.estado !== "publicado";
      if (noteFilter === "borrador") return (note.estado || "borrador") === "borrador";
      if (noteFilter === "listo") return note.estado === "listo";
      if (noteFilter === "publicado") return note.estado === "publicado";
      return true;
    });
    const query = noteSearch.trim().toLowerCase();
    if (!query) return byStatus;
    return byStatus.filter((note) =>
      `${note.titulo || ""} ${note.contenidoMarkdown || ""}`.toLowerCase().includes(query),
    );
  }, [notes, noteFilter, noteSearch, selectedFolderId]);
  const selectedNote = notes.find((note) => note.id === selectedNoteId) || filteredNotes[0] || null;
  const selectedFolder = folders.find((folder) => folder.id === selectedFolderId);

  useEffect(() => {
    if (selectedNote && selectedNote.id !== selectedNoteId) setSelectedNoteId(selectedNote.id);
    if (!filteredNotes.length) setSelectedNoteId("");
  }, [filteredNotes, selectedNote, selectedNoteId]);

  if (!isAdmin) {
    return (
      <div className="archive-panel">
        <h2>Cuaderno del Ashram</h2>
        <p>Este espacio es privado para administradores.</p>
      </div>
    );
  }

  async function createFolder() {
    const nombre = window.prompt("Nombre de la carpeta");
    if (!nombre?.trim()) return;
    await saveFolder({ nombre, parentId: selectedFolderId || null });
    onToast?.("Carpeta creada.");
  }

  async function editFolder(folder) {
    const nombre = window.prompt("Nuevo nombre de la carpeta", folder.nombre);
    if (!nombre?.trim() || nombre === folder.nombre) return;
    await saveFolder({ ...folder, nombre });
    onToast?.("Carpeta actualizada.");
  }

  async function removeFolder(folder) {
    const folderNotes = notes.filter((note) => note.folderId === folder.id);
    const message = folderNotes.length
      ? `La carpeta "${folder.nombre}" tiene ${folderNotes.length} notas. Queres borrar tambien esas notas?`
      : `Borrar la carpeta "${folder.nombre}"?`;
    if (!window.confirm(message)) return;
    await deleteFolder(folder.id, { deleteNotes: folderNotes.length > 0 });
    if (selectedFolderId === folder.id) setSelectedFolderId("");
    onToast?.("Carpeta eliminada.");
  }

  function createNote(folderId = selectedFolderId) {
    setNewNoteFolderId(folderId || "");
    setEditingNote({ folderId: folderId || "" });
    setSelectedNoteId("");
    setTreeOpen(false);
  }

  async function createQuickNote() {
    const text = window.prompt("Nota rapida");
    if (!text?.trim()) return;
    const cleanText = text.trim();
    const id = await saveNote({
      titulo: cleanText.slice(0, 48) || "Nota rapida",
      folderId: selectedFolderId || "",
      contenidoMarkdown: cleanText,
      estado: "borrador",
    });
    setSelectedNoteId(id);
    setEditingNote(null);
    setTreeOpen(false);
    onToast?.("Nota rapida guardada.");
  }

  async function saveEditingNote(note) {
    const id = await saveNote(note);
    setEditingNote(null);
    setSelectedNoteId(id);
    onToast?.("Nota guardada.");
  }

  async function removeNote(note) {
    if (!note || !window.confirm(`Borrar la nota "${note.titulo || "Sin titulo"}"?`)) return;
    await deleteNote(note.id);
    setSelectedNoteId("");
    onToast?.("Nota eliminada.");
  }

  async function copyText() {
    if (!selectedNote) return;
    await navigator.clipboard?.writeText(selectedNote.contenidoMarkdown || "");
    onToast?.("Texto copiado.");
  }

  async function publish(target) {
    if (!selectedNote) return;
    const missing = missingFieldsForPublish(selectedNote, target);
    if (missing.length) {
      const publishAnyway = window.confirm(
        `Para publicar en ${publishLabel(target)} faltan estos datos: ${missing.join(", ")}.\n\nAceptar: publicar igual.\nCancelar: volver al editor para completarlos.`,
      );
      if (!publishAnyway) {
        setEditingNote(selectedNote);
        return;
      }
    }
    const publishers = {
      blog: publishNoteToBlog,
      satsang: publishNoteToSatsang,
      meditaciones: publishNoteToMeditaciones,
      curso: publishNoteToCurso,
    };
    if (!window.confirm(`Publicar esta nota en ${publishLabel(target)}? Se creara contenido visible en esa seccion.`)) return;
    await publishers[target](selectedNote);
    await saveNote({ ...selectedNote, estado: "publicado" });
    onToast?.("Nota publicada.");
    onShared?.(target, selectedNote);
  }

  function selectNote(noteId) {
    setSelectedNoteId(noteId);
    setEditingNote(null);
    setTreeOpen(false);
  }

  function selectFolder(folderId) {
    setSelectedFolderId(folderId);
    setTreeOpen(false);
  }

  function openPrompterWithNote(note) {
    setPrompterNote(note);
    setSelectedNoteId(note.id);
    setPrompterPickerOpen(false);
    setPrompterOpen(true);
  }

  const editorNote = editingNote || selectedNote || { folderId: selectedFolderId || "" };
  const activePrompterFolder = folders.find((folder) => folder.id === prompterNote?.folderId);

  return (
    <div className={`notebook notebook-editor-mode ${treeOpen ? "tree-open" : ""}`}>
      <div className="notebook-topbar">
        <button className="icon-btn notebook-folder-toggle" type="button" onClick={() => setTreeOpen((open) => !open)} title="Abrir carpetas">
          {treeOpen ? <X size={20} /> : <FolderOpen size={20} />}
        </button>
        <span className="notebook-title-block">
          <h2>Cuaderno del Ashram</h2>
          <small>{selectedNote?.titulo || editingNote?.titulo || "Editor Markdown privado"}</small>
        </span>
        <label className="notebook-folder-select">
          <FolderOpen size={15} />
          <select value={selectedFolderId} onChange={(event) => setSelectedFolderId(event.target.value)}>
            <option value="">Todas las carpetas</option>
            {folders.map((folder) => <option key={folder.id} value={folder.id}>{folder.nombre}</option>)}
          </select>
        </label>
        <button className="ghost compact notebook-quick-note" type="button" onClick={createQuickNote}><Sparkles size={15} /> Rapida</button>
        <button className="ghost compact notebook-prompter-button" type="button" onClick={() => setPrompterPickerOpen(true)}><Maximize2 size={15} /> Teleprompter</button>
        <button className="primary small" type="button" onClick={() => createNote("")}><Plus size={16} /> Nota</button>
      </div>

      <div className="notebook-workspace">
        <aside className="notebook-tree-panel">
          <div className="notebook-panel-head">
            <strong>Carpetas</strong>
            <button className="icon-btn" type="button" onClick={() => setTreeOpen(false)} title="Cerrar">
              <X size={15} />
            </button>
          </div>
          <div className="tree-panel-actions">
            <button className="primary small" type="button" onClick={createFolder}><FolderPlus size={16} /> Carpeta</button>
            <button className="primary small" type="button" onClick={() => createNote(selectedFolderId)}><Plus size={16} /> Nota</button>
          </div>
          <button className="ghost compact notebook-quick-card" type="button" onClick={createQuickNote}>
            <Sparkles size={15} /> Nota rapida
          </button>
          <FolderList
            folders={folders}
            notes={notes}
            selectedFolderId={selectedFolderId}
            onSelectFolder={selectFolder}
            onCreateFolder={createFolder}
            onEditFolder={editFolder}
            onDeleteFolder={removeFolder}
            onCreateNote={createNote}
          />

          <section className="notes-list">
            <div className="notes-list-head">
              <span>
                <h2>Notas</h2>
                <small>{selectedFolder?.nombre || "Todas las carpetas"}</small>
              </span>
              <button className="icon-btn" type="button" onClick={() => createNote(selectedFolderId)} title="Nueva nota">
                <Plus size={15} />
              </button>
            </div>
            <label className="note-search">
              <Search size={14} />
              <input value={noteSearch} onChange={(event) => setNoteSearch(event.target.value)} placeholder="Buscar notas..." />
            </label>
            <div className="note-filter-row">
              {[
                ["todas", "Todas"],
                ["pendientes", "Pendientes"],
                ["borrador", "Borrador"],
                ["listo", "Listas"],
                ["publicado", "Publicadas"],
              ].map(([value, label]) => (
                <button className={noteFilter === value ? "active" : ""} key={value} type="button" onClick={() => setNoteFilter(value)}>
                  {label}
                </button>
              ))}
            </div>
            {filteredNotes.length === 0 ? <p className="empty-state">Aun no hay notas en esta carpeta.</p> : null}
            {filteredNotes.map((note) => (
              <button className={`note-row ${selectedNote?.id === note.id ? "active" : ""}`} key={note.id} type="button" onClick={() => selectNote(note.id)}>
                <span>
                  <strong>{note.titulo || "Sin titulo"}</strong>
                  <small>{note.estado || "borrador"}</small>
                </span>
                <Edit3 size={16} onClick={(event) => { event.stopPropagation(); setEditingNote(note); setTreeOpen(false); }} />
              </button>
            ))}
          </section>
        </aside>

        <main className="notebook-editor-surface">
          <div className="notebook-actions">
            <span>Nota actual</span>
            <button className="ghost compact icon-only-action" type="button" onClick={copyText} disabled={!selectedNote} title="Copiar texto"><Copy size={15} /></button>
            <button className="ghost compact icon-only-action" type="button" onClick={() => selectedNote && setEditingNote(selectedNote)} disabled={!selectedNote} title="Editar"><Edit3 size={15} /></button>
            <button className="ghost compact danger icon-only-action" type="button" onClick={() => removeNote(selectedNote)} disabled={!selectedNote} title="Borrar"><Trash2 size={15} /></button>
            <small>{selectedNote?.estado || editorNote?.estado || "borrador"}</small>
          </div>
          <NoteEditor
            key={editorNote?.id || `new-${newNoteFolderId}`}
            note={editorNote}
            folders={folders}
            notes={notes.filter((note) => note.id !== editorNote?.id)}
            defaultFolderId={newNoteFolderId}
            onSave={saveEditingNote}
          />
          <div className="notebook-publish-row">
            <span>Publicar en</span>
            <button className="ghost compact" type="button" onClick={() => publish("blog")} disabled={!selectedNote}><FileText size={15} /> Blog</button>
            <button className="ghost compact" type="button" onClick={() => publish("satsang")} disabled={!selectedNote}><Users size={15} /> Satsang</button>
            <button className="ghost compact" type="button" onClick={() => publish("meditaciones")} disabled={!selectedNote}><Headphones size={15} /> Meditacion</button>
            <button className="ghost compact" type="button" onClick={() => publish("curso")} disabled={!selectedNote}><GraduationCap size={15} /> Curso</button>
            <button className="ghost compact" type="button" onClick={() => createNote(selectedFolderId)}><BookOpen size={15} /> Nueva</button>
          </div>
        </main>
      </div>
      {prompterPickerOpen ? (
        <TeleprompterPicker
          folders={folders}
          notes={notes}
          onClose={() => setPrompterPickerOpen(false)}
          onSelect={openPrompterWithNote}
        />
      ) : null}
      {prompterOpen ? (
        <Teleprompter note={prompterNote} folder={activePrompterFolder} onClose={() => setPrompterOpen(false)} />
      ) : null}
    </div>
  );
}

function TeleprompterPicker({ folders, notes, onClose, onSelect }) {
  const [folderId, setFolderId] = useState("");
  const [query, setQuery] = useState("");
  const visibleNotes = useMemo(() => {
    const cleanQuery = query.trim().toLowerCase();
    return notes.filter((note) => {
      const inFolder = folderId ? note.folderId === folderId : true;
      const matchesQuery = cleanQuery
        ? `${note.titulo || ""} ${note.contenidoMarkdown || ""}`.toLowerCase().includes(cleanQuery)
        : true;
      return inFolder && matchesQuery;
    });
  }, [folderId, notes, query]);

  function folderName(id) {
    return folders.find((folder) => folder.id === id)?.nombre || "Sin carpeta";
  }

  return (
    <div className="teleprompter-backdrop">
      <section className="prompter-picker">
        <header>
          <span>
            <strong>Elegir guion</strong>
            <small>{visibleNotes.length} notas disponibles</small>
          </span>
          <button className="icon-btn" type="button" onClick={onClose} title="Cerrar">
            <X size={18} />
          </button>
        </header>
        <div className="prompter-picker-filters">
          <label>
            <FolderOpen size={15} />
            <select value={folderId} onChange={(event) => setFolderId(event.target.value)}>
              <option value="">Todas las carpetas</option>
              {folders.map((folder) => <option key={folder.id} value={folder.id}>{folder.nombre}</option>)}
            </select>
          </label>
          <label>
            <Search size={15} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar guion..." />
          </label>
        </div>
        <div className="prompter-note-list">
          {visibleNotes.length === 0 ? <p className="empty-state">No hay notas para usar como teleprompter.</p> : null}
          {visibleNotes.map((note) => (
            <button key={note.id} type="button" onClick={() => onSelect(note)}>
              <span>
                <strong>{note.titulo || "Sin titulo"}</strong>
                <small>{folderName(note.folderId)}</small>
              </span>
              <Play size={16} />
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

function Teleprompter({ note, folder, onClose }) {
  const textRef = useRef(null);
  const videoRef = useRef(null);
  const frameRef = useRef(null);
  const lastTickRef = useRef(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(34);
  const [fontSize, setFontSize] = useState(42);
  const [textColor, setTextColor] = useState("#ffffff");
  const [background, setBackground] = useState("#050505");
  const [backgroundOpacity, setBackgroundOpacity] = useState(32);
  const [width, setWidth] = useState(96);
  const [height, setHeight] = useState(92);
  const [cameraOn, setCameraOn] = useState(true);
  const [cameraError, setCameraError] = useState("");

  const prompterText = useMemo(() => stripMarkdown(note?.contenidoMarkdown || ""), [note?.contenidoMarkdown]);

  useEffect(() => {
    if (!cameraOn) return undefined;
    let stream;
    let cancelled = false;

    async function openCamera() {
      try {
        setCameraError("");
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user" },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        if (videoRef.current) videoRef.current.srcObject = stream;
      } catch {
        setCameraError("No pude abrir la camara frontal.");
      }
    }

    openCamera();
    return () => {
      cancelled = true;
      stream?.getTracks().forEach((track) => track.stop());
      if (videoRef.current) videoRef.current.srcObject = null;
    };
  }, [cameraOn]);

  useEffect(() => {
    if (!playing) {
      window.cancelAnimationFrame(frameRef.current);
      lastTickRef.current = 0;
      return undefined;
    }

    function tick(timestamp) {
      if (!lastTickRef.current) lastTickRef.current = timestamp;
      const delta = (timestamp - lastTickRef.current) / 1000;
      lastTickRef.current = timestamp;
      if (textRef.current) {
        textRef.current.scrollTop += speed * delta;
      }
      frameRef.current = window.requestAnimationFrame(tick);
    }

    frameRef.current = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frameRef.current);
  }, [playing, speed]);

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === "Escape") onClose();
      if (event.code === "Space") {
        event.preventDefault();
        setPlaying((current) => !current);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function resetScroll() {
    if (textRef.current) textRef.current.scrollTop = 0;
    setPlaying(false);
  }

  return (
    <div className="teleprompter-backdrop">
      <section className="teleprompter-panel" style={{ width: `${width}vw`, height: `${height}vh`, background }}>
        {cameraOn ? <video ref={videoRef} className="teleprompter-camera" autoPlay playsInline muted /> : null}
        <div className="teleprompter-tint" style={{ background, opacity: backgroundOpacity / 100 }} />
        <header className="teleprompter-bar">
          <span>
            <strong>{note?.titulo || "Guion sin titulo"}</strong>
            <small>{folder?.nombre || "Sin carpeta"}</small>
          </span>
          <button className="icon-btn" type="button" onClick={onClose} title="Cerrar">
            <X size={18} />
          </button>
        </header>

        <div className="teleprompter-controls">
          <button className="primary small" type="button" onClick={() => setPlaying((current) => !current)}>
            {playing ? <Pause size={16} /> : <Play size={16} />}
          </button>
          <button className="ghost compact" type="button" onClick={resetScroll}>Inicio</button>
          <button className="ghost compact" type="button" onClick={() => setCameraOn((current) => !current)}><Camera size={15} /> {cameraOn ? "Camara" : "Sin camara"}</button>
          <label><Play size={14} /><input type="range" min="8" max="140" value={speed} onChange={(event) => setSpeed(Number(event.target.value))} /></label>
          <label><Type size={14} /><input type="range" min="24" max="86" value={fontSize} onChange={(event) => setFontSize(Number(event.target.value))} /></label>
          <label><Palette size={14} /><input type="color" value={textColor} onChange={(event) => setTextColor(event.target.value)} /></label>
          <label><Palette size={14} /><input type="range" min="0" max="92" value={backgroundOpacity} onChange={(event) => setBackgroundOpacity(Number(event.target.value))} /></label>
          <label><Maximize2 size={14} /><input type="range" min="45" max="96" value={width} onChange={(event) => setWidth(Number(event.target.value))} /></label>
          <label><Maximize2 size={14} /><input type="range" min="38" max="92" value={height} onChange={(event) => setHeight(Number(event.target.value))} /></label>
          <input className="teleprompter-bg-input" type="color" value={background} onChange={(event) => setBackground(event.target.value)} title="Fondo" />
        </div>

        {cameraError ? <p className="teleprompter-camera-error">{cameraError}</p> : null}
        <div ref={textRef} className="teleprompter-text" style={{ color: textColor, fontSize: `${fontSize}px` }}>
          {prompterText || "Selecciona una nota con texto para usar el teleprompter."}
        </div>
      </section>
    </div>
  );
}

function stripMarkdown(markdown) {
  return markdown
    .replace(/!\[[^\]]*]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)]\([^)]*\)/g, "$1")
    .replace(/<\/?(h\d|p|br|div|strong|em|b|i|ul|ol|li|blockquote|code)[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/[#>*_`~-]/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function readLocalCache(key) {
  try {
    const value = window.localStorage.getItem(key);
    return value ? JSON.parse(value) : [];
  } catch {
    return [];
  }
}

function writeLocalCache(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Si el navegador no permite guardar localmente, la app sigue funcionando online.
  }
}

function publishLabel(target) {
  const labels = {
    blog: "Blog",
    satsang: "Satsang",
    meditaciones: "Meditacion",
    curso: "Curso",
  };
  return labels[target] || "la seccion";
}

function missingFieldsForPublish(note, target) {
  const missing = [];
  if (!note.titulo?.trim()) missing.push("titulo");
  if (!note.contenidoMarkdown?.trim()) missing.push("texto Markdown");
  if ((target === "satsang" || target === "curso") && !note.videoUrl?.trim()) missing.push("video");
  if (target === "meditaciones" && !note.audioUrl?.trim()) missing.push("audio");
  if (target === "blog" && !note.imagenUrl?.trim()) missing.push("imagen");
  return missing;
}
