import { get, onValue, push, ref, remove, set, update } from "firebase/database";
import { db } from "./firebase";
import { driveImageUrl } from "./driveLinkHelper";

function publishedImageUrl(note) {
  return driveImageUrl(note?.imagenUrl || "");
}

export function listenNoteFolders(callback) {
  return onValue(ref(db, "noteFolders"), (snap) => {
    const value = snap.val() || {};
    callback(
      Object.entries(value)
        .map(([id, folder]) => ({ id, ...folder }))
        .sort((a, b) => (a.nombre || "").localeCompare(b.nombre || "")),
    );
  });
}

export function listenPrivateNotes(callback) {
  return onValue(ref(db, "privateNotes"), (snap) => {
    const value = snap.val() || {};
    callback(
      Object.entries(value)
        .map(([id, note]) => ({ id, ...note }))
        .sort((a, b) => (b.actualizadoEn || b.creadoEn || "").localeCompare(a.actualizadoEn || a.creadoEn || "")),
    );
  });
}

export async function loadNotebookWorkspace() {
  const workspaceSnap = await get(ref(db, "noteWorkspace"));
  const workspace = workspaceSnap.val();
  if (workspace?.folders || workspace?.notes) {
    return {
      folders: Object.entries(workspace.folders || {})
        .map(([id, folder]) => ({ id, ...folder }))
        .sort((a, b) => (a.nombre || "").localeCompare(b.nombre || "")),
      notes: Object.entries(workspace.notes || {})
        .map(([id, note]) => ({ id, ...note }))
        .sort((a, b) => (b.actualizadoEn || b.creadoEn || "").localeCompare(a.actualizadoEn || a.creadoEn || "")),
      syncedAt: workspace.syncedAt || "",
    };
  }

  const [foldersSnap, notesSnap] = await Promise.all([
    get(ref(db, "noteFolders")),
    get(ref(db, "privateNotes")),
  ]);
  const folders = foldersSnap.val() || {};
  const notes = notesSnap.val() || {};
  return {
    folders: Object.entries(folders)
      .map(([id, folder]) => ({ id, ...folder }))
      .sort((a, b) => (a.nombre || "").localeCompare(b.nombre || "")),
    notes: Object.entries(notes)
      .map(([id, note]) => ({ id, ...note }))
      .sort((a, b) => (b.actualizadoEn || b.creadoEn || "").localeCompare(a.actualizadoEn || a.creadoEn || "")),
    syncedAt: "",
  };
}

export async function uploadNotebookWorkspace({ folders = [], notes = [] }) {
  const syncedAt = new Date().toISOString();
  const folderMap = Object.fromEntries(
    folders.map(({ id, ...folder }) => [id, { ...folder, actualizadoEn: folder.actualizadoEn || syncedAt }]),
  );
  const noteMap = Object.fromEntries(
    notes.map(({ id, ...note }) => [id, { ...note, actualizadoEn: note.actualizadoEn || syncedAt }]),
  );
  await set(ref(db, "noteWorkspace"), {
    schema: "ashram-notebook-v1",
    syncedAt,
    folders: folderMap,
    notes: noteMap,
  });
  return syncedAt;
}

export async function saveFolder(folder) {
  const now = new Date().toISOString();
  const data = {
    nombre: (folder.nombre || "").trim(),
    parentId: folder.parentId || null,
    actualizadoEn: now,
  };
  if (folder.id) {
    await update(ref(db, `noteFolders/${folder.id}`), data);
    return folder.id;
  }
  const folderRef = push(ref(db, "noteFolders"));
  await set(folderRef, { ...data, creadoEn: now });
  return folderRef.key;
}

export async function deleteFolder(folderId, options = {}) {
  if (options.deleteNotes) {
    const snap = await get(ref(db, "privateNotes"));
    const notes = snap.val() || {};
    await Promise.all(
      Object.entries(notes)
        .filter(([, note]) => note.folderId === folderId)
        .map(([noteId]) => remove(ref(db, `privateNotes/${noteId}`))),
    );
  }
  await remove(ref(db, `noteFolders/${folderId}`));
}

export async function saveNote(note) {
  const now = new Date().toISOString();
  const data = {
    titulo: (note.titulo || "").trim(),
    folderId: note.folderId || "",
    contenidoMarkdown: note.contenidoMarkdown || "",
    keywords: (note.keywords || "").trim(),
    imagenUrl: (note.imagenUrl || "").trim(),
    audioUrl: (note.audioUrl || "").trim(),
    pdfUrl: (note.pdfUrl || "").trim(),
    videoUrl: (note.videoUrl || "").trim(),
    estado: note.estado || "borrador",
    actualizadoEn: now,
  };
  if (note.id) {
    await update(ref(db, `privateNotes/${note.id}`), data);
    return note.id;
  }
  const noteRef = push(ref(db, "privateNotes"));
  await set(noteRef, { ...data, creadoEn: now });
  return noteRef.key;
}

export async function deleteNote(noteId) {
  await remove(ref(db, `privateNotes/${noteId}`));
}

export async function publishNoteToBlog(note) {
  const now = new Date().toISOString();
  await push(ref(db, "blog"), {
    titulo: note.titulo,
    descripcion: note.contenidoMarkdown || "",
    keywords: (note.keywords || "").trim(),
    imagen: publishedImageUrl(note),
    etiqueta: "Cuaderno",
    fecha_carga: now,
    fecha_creacion: now,
  });
}

export async function publishNoteToSatsang(note) {
  const now = new Date().toISOString();
  await push(ref(db, "satsang"), {
    tema: note.titulo,
    titulo: note.titulo,
    descripcion: note.contenidoMarkdown || "",
    keywords: (note.keywords || "").trim(),
    imagen: publishedImageUrl(note),
    video: note.videoUrl || "",
    link_video_original: note.videoUrl || "",
    fecha_creacion: now,
  });
}

export async function publishNoteToMeditaciones(note) {
  const now = new Date().toISOString();
  await push(ref(db, "meditaciones"), {
    titulo: note.titulo,
    descripcion: note.contenidoMarkdown || "",
    keywords: (note.keywords || "").trim(),
    detalle: "",
    imagen: publishedImageUrl(note),
    audio: note.audioUrl || "",
    link_audio: note.audioUrl || "",
    link_drive: note.audioUrl || "",
    fecha_creacion: now,
  });
}

export async function publishNoteToCurso(note) {
  const now = new Date().toISOString();
  // TODO: conectar a una coleccion "cursos" si se crea en el futuro.
  // Por ahora se publica como modulo de Conocimiento con etiqueta "Curso".
  await push(ref(db, "conocimiento"), {
    titulo: note.titulo,
    descripcion: note.contenidoMarkdown || "",
    keywords: (note.keywords || "").trim(),
    etiqueta: "Curso",
    imagen: publishedImageUrl(note),
    video: note.videoUrl || "",
    link_video_original: note.videoUrl || "",
    fecha_creacion: now,
  });
}

export function listenBookProjects(callback) {
  return onValue(ref(db, "bookProjects"), (snap) => {
    const value = snap.val() || {};
    callback(
      Object.entries(value)
        .map(([id, book]) => ({ id, ...book }))
        .sort((a, b) => (b.actualizadoEn || b.creadoEn || "").localeCompare(a.actualizadoEn || a.creadoEn || "")),
    );
  });
}

export function listenBookChapters(bookId, callback) {
  if (!bookId) {
    callback([]);
    return () => {};
  }
  return onValue(ref(db, `bookChapters/${bookId}`), (snap) => {
    const value = snap.val() || {};
    callback(
      Object.entries(value)
        .map(([id, chapter]) => ({ id, bookId, ...chapter }))
        .sort((a, b) => (a.orden || 0) - (b.orden || 0)),
    );
  });
}

export async function saveBookProject(book) {
  const now = new Date().toISOString();
  const data = {
    titulo: (book.titulo || "").trim(),
    autor: (book.autor || "").trim(),
    descripcion: (book.descripcion || "").trim(),
    keywords: (book.keywords || "").trim(),
    portadaUrl: (book.portadaUrl || "").trim(),
    estado: book.estado || "borrador",
    actualizadoEn: now,
  };
  if (book.id) {
    await update(ref(db, `bookProjects/${book.id}`), data);
    return book.id;
  }
  const bookRef = push(ref(db, "bookProjects"));
  await set(bookRef, { ...data, creadoEn: now });
  return bookRef.key;
}

export async function deleteBookProject(bookId) {
  await remove(ref(db, `bookProjects/${bookId}`));
  await remove(ref(db, `bookChapters/${bookId}`));
}

export async function saveBookChapter(bookId, chapter) {
  const now = new Date().toISOString();
  const data = {
    titulo: (chapter.titulo || "").trim(),
    contenidoMarkdown: chapter.contenidoMarkdown || "",
    orden: Number(chapter.orden || 0),
    estado: chapter.estado || "borrador",
    actualizadoEn: now,
  };
  if (chapter.id) {
    await update(ref(db, `bookChapters/${bookId}/${chapter.id}`), data);
    return { id: chapter.id, bookId, ...chapter, ...data };
  }
  const chapterRef = push(ref(db, `bookChapters/${bookId}`));
  const newChapter = { ...data, creadoEn: now };
  await set(chapterRef, newChapter);
  return { id: chapterRef.key, bookId, ...newChapter };
}

export async function deleteBookChapter(bookId, chapterId) {
  await remove(ref(db, `bookChapters/${bookId}/${chapterId}`));
}
