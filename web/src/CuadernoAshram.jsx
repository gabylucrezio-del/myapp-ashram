import { BookOpen, Copy, Edit3, FileText, FolderOpen, FolderPlus, GraduationCap, Headphones, Plus, Search, Sparkles, Trash2, Users, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
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

export default function CuadernoAshram({ profile, quickNoteRequest = 0, onQuickNoteHandled, onToast, onShared }) {
  const [folders, setFolders] = useState([]);
  const [notes, setNotes] = useState([]);
  const [selectedFolderId, setSelectedFolderId] = useState("");
  const [selectedNoteId, setSelectedNoteId] = useState("");
  const [editingNote, setEditingNote] = useState(null);
  const [newNoteFolderId, setNewNoteFolderId] = useState("");
  const [treeOpen, setTreeOpen] = useState(false);
  const [noteSearch, setNoteSearch] = useState("");
  const [noteFilter, setNoteFilter] = useState("todas");
  const isAdmin = profile?.rol === "admin";

  useEffect(() => {
    if (!isAdmin) return undefined;
    const offFolders = listenNoteFolders(setFolders);
    const offNotes = listenPrivateNotes(setNotes);
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

  const editorNote = editingNote || selectedNote || { folderId: selectedFolderId || "" };

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
    </div>
  );
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
