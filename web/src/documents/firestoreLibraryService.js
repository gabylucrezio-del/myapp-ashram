import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import JSZip from "jszip";
import { auth, firestoreDb } from "../firebase";

export const ASHRAM_DOCUMENTS_COLLECTION = "ashramDocuments";
export const ASHRAM_FOLDERS_COLLECTION = "ashramFolders";
export const ASHRAM_DOCUMENT_VERSIONS_COLLECTION = "ashramDocumentVersions";

const DEBUG_LIBRARY_FIRESTORE = true;
const DOCUMENT_COLLECTION_FALLBACKS = [
  ASHRAM_DOCUMENTS_COLLECTION,
  "documents",
  "notas",
  "archivosMarkdown",
  "markdown",
];
const DEFAULT_AUTHOR = "Gabriel Premananda";
const ROOT_FOLDERS = [
  { id: "folder-ayurveda", title: "Ayurveda", icon: "leaf", color: "#2f7d57", order: 1 },
  { id: "folder-espiritualidad", title: "Espiritualidad", icon: "sparkles", color: "#7a5c2e", order: 2 },
  { id: "folder-meditaciones", title: "Meditaciones", icon: "moon", color: "#4a6f78", order: 3 },
  { id: "folder-cursos", title: "Cursos", icon: "book", color: "#9b6b43", order: 4 },
  { id: "folder-libros", title: "Libros", icon: "book-open", color: "#5c6f3c", order: 5 },
  { id: "folder-biblioteca", title: "Biblioteca", icon: "library", color: "#6c6840", order: 6 },
];

export async function getFirestoreLibraryTree({ seedDefaults = true } = {}) {
  await waitForAuthenticatedUser();
  if (seedDefaults) await ensureDefaultFolders();
  debugLibrary("Colecciones consultadas:", {
    folders: ASHRAM_FOLDERS_COLLECTION,
    documents: DOCUMENT_COLLECTION_FALLBACKS,
    user: auth.currentUser?.email || "sin usuario",
  });
  const [folderSnap, documentSnap] = await Promise.all([
    getDocs(collection(firestoreDb, ASHRAM_FOLDERS_COLLECTION)),
    getDocumentsSnapshotWithFallback(),
  ]);
  debugLibrary("Cantidad de cuadernos encontrados:", {
    folders: folderSnap.docs.length,
    documents: documentSnap.docs.length,
    documentCollection: documentSnap.collectionName || ASHRAM_DOCUMENTS_COLLECTION,
    user: auth.currentUser?.email || "sin usuario",
  });
  return libraryTreeFromSnapshots(folderSnap, documentSnap);
}

export async function subscribeFirestoreLibraryTree({ onChange, onError } = {}) {
  await waitForAuthenticatedUser();
  await ensureDefaultFolders();
  let latestFolders = null;
  let latestDocuments = null;

  function emitIfReady() {
    if (!latestFolders || !latestDocuments) return;
    onChange?.(libraryTreeFromSnapshots(latestFolders, latestDocuments));
  }

  const unsubscribeFolders = onSnapshot(
      collection(firestoreDb, ASHRAM_FOLDERS_COLLECTION),
      (snapshot) => {
        debugLibrary("Snapshot de carpetas:", {
          collectionName: ASHRAM_FOLDERS_COLLECTION,
          docs: snapshot.docs.length,
          user: auth.currentUser?.email || "sin usuario",
        });
        latestFolders = snapshot;
        emitIfReady();
      },
      (error) => {
        debugLibrary("Error leyendo carpetas:", {
          collectionName: ASHRAM_FOLDERS_COLLECTION,
          code: error?.code,
          message: error?.message,
          user: auth.currentUser?.email || "sin usuario",
        });
        onError?.(error);
      },
  );
  const unsubscribeDocuments = onSnapshot(
      collection(firestoreDb, ASHRAM_DOCUMENTS_COLLECTION),
      async (snapshot) => {
        const nextSnapshot = snapshot.empty ? await getDocumentsSnapshotWithFallback() : snapshot;
        debugLibrary("Snapshot de documentos:", {
          collectionName: nextSnapshot.collectionName || ASHRAM_DOCUMENTS_COLLECTION,
          docs: nextSnapshot.docs.length,
          user: auth.currentUser?.email || "sin usuario",
        });
        latestDocuments = nextSnapshot;
        emitIfReady();
      },
      (error) => {
        debugLibrary("Error leyendo documentos:", {
          collectionName: ASHRAM_DOCUMENTS_COLLECTION,
          code: error?.code,
          message: error?.message,
          user: auth.currentUser?.email || "sin usuario",
        });
        onError?.(error);
      },
  );

  return () => {
    unsubscribeFolders();
    unsubscribeDocuments();
  };
}

export async function saveFirestoreFolder(folder = {}, folders = []) {
  const id = folder.id || localId("folder");
  const now = new Date().toISOString();
  const next = normalizeFolderForFirestore({
    ...folder,
    id,
    createdAt: folder.createdAt || now,
    updatedAt: now,
  }, folders);
  await setDoc(doc(firestoreDb, ASHRAM_FOLDERS_COLLECTION, id), {
    ...next,
    updatedAt: serverTimestamp(),
    createdAt: folder.createdAt || serverTimestamp(),
  }, { merge: true });
  return normalizeFolderFromFirestore(id, next);
}

export async function deleteFirestoreFolder(folderId, folders = [], documents = []) {
  const folderIds = new Set([folderId, ...descendantFolderIds(folders, folderId)]);
  const batch = writeBatch(firestoreDb);
  folderIds.forEach((id) => batch.delete(doc(firestoreDb, ASHRAM_FOLDERS_COLLECTION, id)));
  documents
      .filter((item) => folderIds.has(item.folderId))
      .forEach((item) => batch.delete(doc(firestoreDb, ASHRAM_DOCUMENTS_COLLECTION, item.id)));
  await batch.commit();
}

export async function saveFirestoreDocument(documentData = {}, folders = []) {
  const id = documentData.id || localId("doc");
  const now = new Date().toISOString();
  const currentSnapshot = await getDoc(doc(firestoreDb, ASHRAM_DOCUMENTS_COLLECTION, id));
  const next = normalizeDocumentForFirestore({
    ...documentData,
    id,
    createdAt: documentData.createdAt || now,
    updatedAt: now,
  }, folders);
  await setDoc(doc(firestoreDb, ASHRAM_DOCUMENTS_COLLECTION, id), {
    ...next,
    updatedAt: serverTimestamp(),
    createdAt: documentData.createdAt || serverTimestamp(),
  }, { merge: true });
  if (currentSnapshot.exists()) {
    await saveDocumentVersionIfChanged(id, currentSnapshot.data(), next);
  }
  return normalizeDocumentFromFirestore(id, next);
}

export async function updateFirestoreDocument(documentId, patch = {}, folders = []) {
  const current = patch.id ? patch : null;
  const next = normalizeDocumentForFirestore({ ...(current || {}), ...patch, id: documentId }, folders);
  const currentSnapshot = await getDoc(doc(firestoreDb, ASHRAM_DOCUMENTS_COLLECTION, documentId));
  await updateDoc(doc(firestoreDb, ASHRAM_DOCUMENTS_COLLECTION, documentId), {
    ...next,
    updatedAt: serverTimestamp(),
  });
  if (currentSnapshot.exists()) {
    await saveDocumentVersionIfChanged(documentId, currentSnapshot.data(), next);
  }
  return normalizeDocumentFromFirestore(documentId, next);
}

export async function deleteFirestoreDocument(documentId) {
  await deleteDoc(doc(firestoreDb, ASHRAM_DOCUMENTS_COLLECTION, documentId));
}

export function searchFirestoreLibrary(documents = [], query = "") {
  const cleanQuery = normalizeText(query);
  if (!cleanQuery) return documents;
  const terms = cleanQuery.split(/\s+/).filter(Boolean);
  return documents.filter((document) => {
    const haystack = normalizeText([
      document.title,
      document.displayName,
      document.contentMarkdown,
      document.content,
      document.folderPath,
      document.fullPath,
      document.keywords,
      ...(document.tags || []),
    ].join(" "));
    return terms.every((term) => haystack.includes(term)) || haystack.includes(cleanQuery);
  });
}

export async function exportFirestoreLibraryBackup(format = "json") {
  const tree = await getFirestoreLibraryTree({ seedDefaults: false });
  const exportedAt = new Date().toISOString();
  const payload = {
    schema: "ashram-firestore-library-v1",
    exportedAt,
    collections: {
      folders: ASHRAM_FOLDERS_COLLECTION,
      documents: ASHRAM_DOCUMENTS_COLLECTION,
    },
    folders: tree.folders,
    documents: tree.documents,
  };
  const date = exportedAt.slice(0, 10);

  if (format === "markdown") {
    const markdown = buildMarkdownBackup(payload);
    downloadBlob(
        new Blob([markdown], {type: "text/markdown;charset=utf-8"}),
        `ashram-biblioteca-${date}.md`,
    );
    return payload;
  }

  if (format === "zip") {
    const zip = new JSZip();
    zip.file("ashram-biblioteca.json", JSON.stringify(payload, null, 2));
    tree.documents.forEach((documentData) => {
      const path = safeBackupPath(documentData.fullPath || documentData.title);
      zip.file(`${path || documentData.id}.md`, documentData.contentMarkdown || "");
    });
    const blob = await zip.generateAsync({type: "blob"});
    downloadBlob(blob, `ashram-biblioteca-${date}.zip`);
    return payload;
  }

  downloadBlob(
      new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json;charset=utf-8",
      }),
      `ashram-biblioteca-${date}.json`,
  );
  return payload;
}

async function ensureDefaultFolders() {
  await waitForAuthenticatedUser();
  debugLibrary("Verificando carpetas base:", {
    collectionName: ASHRAM_FOLDERS_COLLECTION,
    user: auth.currentUser?.email || "sin usuario",
  });
  const snapshot = await getDocs(collection(firestoreDb, ASHRAM_FOLDERS_COLLECTION));
  debugLibrary("Carpetas base recibidas:", {
    collectionName: ASHRAM_FOLDERS_COLLECTION,
    docs: snapshot.docs.length,
    user: auth.currentUser?.email || "sin usuario",
  });
  if (!snapshot.empty) return;
  const batch = writeBatch(firestoreDb);
  ROOT_FOLDERS.forEach((folder) => {
    const ref = doc(firestoreDb, ASHRAM_FOLDERS_COLLECTION, folder.id);
    batch.set(ref, {
      ...normalizeFolderForFirestore(folder, []),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });
  await batch.commit();
}

async function getDocumentsSnapshotWithFallback() {
  let firstSnapshot = null;
  for (const collectionName of DOCUMENT_COLLECTION_FALLBACKS) {
    debugLibrary("Leyendo cuadernos desde:", {
      collectionName,
      user: auth.currentUser?.email || "sin usuario",
    });
    const snapshot = await getDocs(collection(firestoreDb, collectionName));
    const result = {
      docs: snapshot.docs,
      empty: snapshot.empty,
      collectionName,
    };
    debugLibrary("Cantidad de cuadernos encontrados:", {
      collectionName,
      docs: snapshot.docs.length,
      user: auth.currentUser?.email || "sin usuario",
    });
    if (!firstSnapshot) firstSnapshot = result;
    if (!snapshot.empty) return result;
  }
  return firstSnapshot;
}

function waitForAuthenticatedUser() {
  if (auth.currentUser) {
    return auth.currentUser.getIdToken(true).then(() => auth.currentUser);
  }
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      unsubscribe();
      reject(new Error("No se pudo confirmar el usuario autenticado para leer Firestore."));
    }, 8000);
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) return;
      window.clearTimeout(timer);
      unsubscribe();
      await user.getIdToken(true);
      debugLibrary("Usuario actual:", {
        email: user.email || "",
        emailVerified: user.emailVerified,
        uid: user.uid,
      });
      resolve(user);
    }, (error) => {
      window.clearTimeout(timer);
      unsubscribe();
      reject(error);
    });
  });
}

function debugLibrary(message, payload = {}) {
  if (!DEBUG_LIBRARY_FIRESTORE) return;
  console.log(`[Cuadernos Firestore] ${message}`, payload);
}

function libraryTreeFromSnapshots(folderSnap, documentSnap) {
  const folders = folderSnap.docs
      .map((snapshot) => normalizeFolderFromFirestore(snapshot.id, snapshot.data()))
      .filter((folder) => !folder.deletedAt);
  const documents = documentSnap.docs
      .map((snapshot) => normalizeDocumentFromFirestore(snapshot.id, {
        ...snapshot.data(),
        _firestoreCollection: documentSnap.collectionName || ASHRAM_DOCUMENTS_COLLECTION,
      }))
      .filter((document) => !document.deletedAt);
  const foldersWithPaths = applyFolderPaths(folders);
  const documentsWithPaths = documents.map((document) => applyDocumentPath(document, foldersWithPaths));
  return {
    folders: sortTreeItems(foldersWithPaths),
    documents: sortTreeItems(documentsWithPaths),
  };
}

async function saveDocumentVersionIfChanged(documentId, previous = {}, next = {}) {
  const previousContent = previous.contentMarkdown ?? previous.content ?? "";
  const nextContent = next.contentMarkdown ?? next.content ?? "";
  const previousTitle = previous.title || "";
  const nextTitle = next.title || "";
  if (previousContent === nextContent && previousTitle === nextTitle) return;
  await addDoc(collection(firestoreDb, ASHRAM_DOCUMENT_VERSIONS_COLLECTION), {
    documentId,
    title: previousTitle,
    contentMarkdown: previousContent,
    folderPath: previous.folderPath || "",
    fullPath: previous.fullPath || "",
    type: previous.type || "cuaderno",
    tags: Array.isArray(previous.tags) ? previous.tags : [],
    author: previous.author || DEFAULT_AUTHOR,
    createdBy: auth.currentUser?.uid || "",
    createdAt: serverTimestamp(),
  });
}

function normalizeFolderForFirestore(folder, folders) {
  const title = (folder.title || folder.name || "Carpeta").trim();
  const path = folderPathFor({ ...folder, title }, folders);
  return {
    id: folder.id,
    title,
    name: title,
    parentId: folder.parentId || "",
    icon: folder.icon || "folder",
    color: folder.color || folder.iconColor || "#d9a51f",
    iconColor: folder.color || folder.iconColor || "#d9a51f",
    order: Number(folder.order ?? Date.now()),
    folderPath: parentFolderPath(folder.parentId || "", folders),
    fullPath: path,
    isPrivate: folder.isPrivate !== false,
    author: folder.author || DEFAULT_AUTHOR,
    createdBy: folder.createdBy || auth.currentUser?.uid || "",
    updatedBy: auth.currentUser?.uid || "",
    createdAt: folder.createdAt || "",
    updatedAt: folder.updatedAt || "",
    deletedAt: folder.deletedAt || "",
  };
}

function normalizeDocumentForFirestore(documentData, folders) {
  const title = stripMarkdownExtension(documentData.title || documentData.displayName || documentData.name || "Sin titulo");
  const content = documentData.contentMarkdown ?? documentData.content ?? "";
  const folderPath = parentFolderPath(documentData.folderId || "", folders);
  const tags = Array.isArray(documentData.tags) ? documentData.tags : splitTags(documentData.keywords || documentData.tags || "");
  return {
    id: documentData.id,
    title,
    name: `${title}.md`,
    displayName: title,
    content,
    contentMarkdown: content,
    folderId: documentData.folderId || "",
    folderPath,
    fullPath: [folderPath, title].filter(Boolean).join("/"),
    type: documentData.type || "cuaderno",
    mimeType: documentData.mimeType || "text/markdown",
    tags,
    keywords: documentData.keywords || tags.join(", "),
    author: documentData.author || DEFAULT_AUTHOR,
    isPrivate: documentData.isPrivate !== false,
    status: documentData.status || "synced",
    statusSync: documentData.statusSync || "synced",
    syncStatus: documentData.syncStatus || documentData.statusSync || "synced",
    icon: documentData.icon || "document",
    color: documentData.color || documentData.iconColor || "#6c6840",
    iconColor: documentData.color || documentData.iconColor || "#6c6840",
    sourceDocumentId: documentData.sourceDocumentId || "",
    sourceContentId: documentData.sourceContentId || "",
    relatedIds: Array.isArray(documentData.relatedIds) ? documentData.relatedIds : [],
    publishedContentId: documentData.publishedContentId || "",
    lastPublishedAt: documentData.lastPublishedAt || "",
    createdBy: documentData.createdBy || auth.currentUser?.uid || "",
    updatedBy: auth.currentUser?.uid || "",
    createdAt: documentData.createdAt || "",
    updatedAt: documentData.updatedAt || "",
    deletedAt: documentData.deletedAt || "",
  };
}

function normalizeFolderFromFirestore(id, data = {}) {
  return {
    ...data,
    id,
    parentId: data.parentId || "",
    title: data.title || data.name || "Carpeta",
    name: data.name || data.title || "Carpeta",
    icon: data.icon || "folder",
    color: data.color || data.iconColor || "#d9a51f",
    iconColor: data.iconColor || data.color || "#d9a51f",
    createdAt: dateValue(data.createdAt),
    updatedAt: dateValue(data.updatedAt),
    status: data.status || "synced",
    statusSync: data.statusSync || "synced",
    syncStatus: data.syncStatus || data.statusSync || "synced",
  };
}

function normalizeDocumentFromFirestore(id, data = {}) {
  const title = stripMarkdownExtension(data.title || data.displayName || data.name || "Sin titulo");
  const content = data.contentMarkdown ?? data.content ?? "";
  return {
    ...data,
    id,
    folderId: data.folderId || "",
    title,
    name: data.name || `${title}.md`,
    displayName: data.displayName || title,
    content,
    contentMarkdown: content,
    type: data.type || "cuaderno",
    mimeType: data.mimeType || "text/markdown",
    tags: Array.isArray(data.tags) ? data.tags : splitTags(data.keywords || ""),
    keywords: data.keywords || "",
    isPrivate: data.isPrivate !== false,
    createdAt: dateValue(data.createdAt),
    updatedAt: dateValue(data.updatedAt),
    status: data.status || "synced",
    statusSync: data.statusSync || "synced",
    syncStatus: data.syncStatus || data.statusSync || "synced",
  };
}

function applyFolderPaths(folders) {
  return folders.map((folder) => ({
    ...folder,
    folderPath: parentFolderPath(folder.parentId || "", folders),
    fullPath: folderPathFor(folder, folders),
  }));
}

function applyDocumentPath(documentData, folders) {
  const folderPath = parentFolderPath(documentData.folderId || "", folders);
  return {
    ...documentData,
    folderPath,
    fullPath: [folderPath, documentData.displayName || documentData.title].filter(Boolean).join("/"),
  };
}

function folderPathFor(folder, folders) {
  const parentPath = parentFolderPath(folder.parentId || "", folders);
  return [parentPath, folder.title || folder.name].filter(Boolean).join("/");
}

function parentFolderPath(folderId, folders) {
  if (!folderId) return "";
  const folder = folders.find((item) => item.id === folderId);
  if (!folder) return "";
  return folderPathFor(folder, folders.filter((item) => item.id !== folder.id));
}

function descendantFolderIds(folders, folderId) {
  const children = folders.filter((folder) => folder.parentId === folderId);
  return children.flatMap((folder) => [folder.id, ...descendantFolderIds(folders, folder.id)]);
}

function sortTreeItems(items) {
  return [...items].sort((a, b) => {
    const orderA = Number(a.order ?? Number.MAX_SAFE_INTEGER);
    const orderB = Number(b.order ?? Number.MAX_SAFE_INTEGER);
    if (orderA !== orderB) return orderA - orderB;
    return String(a.displayName || a.title || a.name || "")
        .localeCompare(String(b.displayName || b.title || b.name || ""), "es", { sensitivity: "base" });
  });
}

function stripMarkdownExtension(value = "") {
  return String(value || "Sin titulo").trim().replace(/\.(md|markdown)$/i, "");
}

function splitTags(value = "") {
  if (Array.isArray(value)) return value.map((tag) => String(tag).trim()).filter(Boolean);
  return String(value)
      .split(/[,#]/)
      .map((tag) => tag.trim().toLowerCase())
      .filter(Boolean)
      .slice(0, 30);
}

function normalizeText(value = "") {
  return String(value)
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim();
}

function dateValue(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value.toDate === "function") return value.toDate().toISOString();
  return String(value);
}

function localId(prefix) {
  if (window.crypto?.randomUUID) return `${prefix}_${window.crypto.randomUUID()}`;
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function buildMarkdownBackup(payload) {
  const lines = [
    "# Biblioteca del Ashram Ganesha",
    "",
    `Exportado: ${payload.exportedAt}`,
    "",
  ];
  payload.documents.forEach((documentData) => {
    lines.push(
        "---",
        "",
        `# ${documentData.title || "Sin titulo"}`,
        "",
        `Ruta: ${documentData.folderPath || "Raiz"}`,
        `Tipo: ${documentData.type || "markdown"}`,
        `Etiquetas: ${(documentData.tags || []).join(", ")}`,
        "",
        documentData.contentMarkdown || "",
        "",
    );
  });
  return lines.join("\n");
}

function safeBackupPath(value = "") {
  return String(value || "documento")
      .replace(/\\/g, "/")
      .split("/")
      .map((part) => part
          .replace(/[<>:"|?*]/g, "-")
          .replace(/\s+/g, " ")
          .trim())
      .filter(Boolean)
      .join("/");
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
