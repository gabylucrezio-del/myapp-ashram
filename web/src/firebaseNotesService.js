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
    etiqueta: "Curso",
    imagen: publishedImageUrl(note),
    video: note.videoUrl || "",
    link_video_original: note.videoUrl || "",
    fecha_creacion: now,
  });
}
