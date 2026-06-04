const DB_NAME = "ashram-documents-db";
const DB_VERSION = 2;
const WORKSPACE_ID = "ashram-workspace";

const stores = {
  workspaces: "workspaces",
  folders: "folders",
  documents: "documents",
  assets: "assets",
  attachments: "attachments",
  exports: "exports",
  meta: "meta",
};

export const defaultWorkspace = {
  id: WORKSPACE_ID,
  name: "Mis Documentos",
  nombre: "Mis Documentos",
  rootFolderId: "",
  createdAt: "",
  updatedAt: "",
  lastBackupAt: "",
  lastSyncAt: "",
};

export async function initLocalDb() {
  const db = await openDb();
  const workspace = await getById(db, stores.workspaces, WORKSPACE_ID);
  if (!workspace) {
    const now = nowIso();
    await put(db, stores.workspaces, { ...defaultWorkspace, createdAt: now, updatedAt: now });
  }
  await seedIfEmpty(db);
  db.close();
}

export async function getWorkspace() {
  const db = await openDb();
  const workspace = await getById(db, stores.workspaces, WORKSPACE_ID);
  db.close();
  return workspace || defaultWorkspace;
}

export async function getStorageSettings() {
  const db = await openDb();
  const stored = await getById(db, stores.meta, "storageSettings");
  db.close();
  return {
    workspaceLocalPath: "",
    backupPath: "",
    driveConnected: false,
    autoSyncDrive: false,
    pendingDriveSync: false,
    lastBackupAt: "",
    lastSyncAt: "",
    ...(stored?.value || readStorageSettingsFallback()),
  };
}

export async function saveStorageSettings(patch = {}) {
  const current = await getStorageSettings();
  const next = { ...current, ...patch };
  const db = await openDb();
  await put(db, stores.meta, { id: "storageSettings", value: next });
  db.close();
  localStorage.setItem("ashram_storage_settings", JSON.stringify(next));
  return next;
}

export async function saveDirectoryHandle(kind, handle) {
  if (!kind || !handle) return null;
  const db = await openDb();
  await put(db, stores.meta, { id: `directoryHandle:${kind}`, value: handle });
  db.close();
  return handle;
}

export async function getDirectoryHandle(kind) {
  const db = await openDb();
  const stored = await getById(db, stores.meta, `directoryHandle:${kind}`);
  db.close();
  return stored?.value || null;
}

export async function getFolders({ includeDeleted = false } = {}) {
  const db = await openDb();
  const folders = await getAll(db, stores.folders);
  db.close();
  return sortTreeItems(includeDeleted ? folders : folders.filter((folder) => !folder.deletedAt));
}

export async function saveFolder(folder) {
  const db = await openDb();
  const now = nowIso();
  const current = folder.id ? await getById(db, stores.folders, folder.id) : null;
  const status = normalizeStatus(folder.status || folder.statusSync || (current ? "modified_local" : "local_only"));
  const next = {
    id: folder.id || localId("folder"),
    workspaceId: WORKSPACE_ID,
    parentId: folder.parentId || null,
    name: (folder.name || folder.title || folder.nombre || "Nueva carpeta").trim(),
    title: (folder.title || folder.name || folder.nombre || "Nueva carpeta").trim(),
    icon: folder.icon || "folder",
    color: folder.color || folder.iconColor || "#d9a51f",
    iconColor: folder.color || folder.iconColor || "#d9a51f",
    order: Number(folder.order ?? Date.now()),
    createdAt: current?.createdAt || folder.createdAt || now,
    updatedAt: now,
    deletedAt: folder.deletedAt || "",
    dirty: folder.dirty ?? true,
    status,
    statusSync: normalizeStatus(folder.statusSync || status),
    syncStatus: normalizeStatus(folder.syncStatus || folder.statusSync || status),
    driveFileId: folder.driveFileId || "",
    webViewLink: folder.webViewLink || "",
    lastBackupAt: folder.lastBackupAt || current?.lastBackupAt || "",
  };
  await put(db, stores.folders, next);
  db.close();
  return next;
}

export async function deleteFolder(folderId) {
  const db = await openDb();
  const folders = await getAll(db, stores.folders);
  const documents = await getAll(db, stores.documents);
  const ids = new Set([folderId, ...descendantFolderIds(folders, folderId)]);
  const now = nowIso();
  await Promise.all([
    ...folders.filter((folder) => ids.has(folder.id)).map((folder) => put(db, stores.folders, markDeleted(folder, now))),
    ...documents.filter((doc) => ids.has(doc.folderId)).map((doc) => put(db, stores.documents, markDeleted(doc, now))),
  ]);
  db.close();
}

export async function getDocuments({ includeDeleted = false } = {}) {
  const db = await openDb();
  const documents = await getAll(db, stores.documents);
  db.close();
  return sortTreeItems(includeDeleted ? documents : documents.filter((document) => !document.deletedAt));
}

export async function saveDocument(document) {
  const db = await openDb();
  const now = nowIso();
  const current = document.id ? await getById(db, stores.documents, document.id) : null;
  const status = normalizeStatus(document.status || document.statusSync || (current ? "modified_local" : "local_only"));
  const next = normalizeDocument({
    ...current,
    ...document,
    id: document.id || localId("doc"),
    createdAt: current?.createdAt || document.createdAt || now,
    updatedAt: now,
    dirty: document.dirty ?? true,
    status,
    statusSync: document.statusSync || status,
    syncStatus: document.syncStatus || document.statusSync || status,
  });
  await put(db, stores.documents, next);
  db.close();
  return next;
}

export async function updateDocument(documentId, patch) {
  const db = await openDb();
  const current = await getById(db, stores.documents, documentId);
  if (!current) {
    db.close();
    return null;
  }
  const status = normalizeStatus(patch.status || patch.statusSync || "modified_local");
  const next = normalizeDocument({
    ...current,
    ...patch,
    id: documentId,
    updatedAt: nowIso(),
    dirty: patch.dirty ?? true,
    status,
    statusSync: patch.statusSync || status,
    syncStatus: patch.syncStatus || patch.statusSync || status,
  });
  await put(db, stores.documents, next);
  db.close();
  return next;
}

export async function deleteDocument(documentId) {
  const db = await openDb();
  const current = await getById(db, stores.documents, documentId);
  if (current) await put(db, stores.documents, markDeleted(current));
  db.close();
}

export async function getAssets(documentId = "") {
  const db = await openDb();
  const assets = (await getAll(db, stores.assets)).filter((asset) => !documentId || asset.documentId === documentId);
  db.close();
  return assets.map(hydrateAssetUrl);
}

export async function saveAssetLocal(asset) {
  const db = await openDb();
  const now = nowIso();
  const next = {
    id: asset.id || localId("asset"),
    documentId: asset.documentId || "",
    localBlob: asset.localBlob || asset.file || null,
    localUrl: asset.localUrl || "",
    driveFileId: asset.driveFileId || "",
    fileName: asset.fileName || asset.localBlob?.name || asset.file?.name || `asset-${Date.now()}`,
    mimeType: asset.mimeType || asset.localBlob?.type || asset.file?.type || "application/octet-stream",
    createdAt: asset.createdAt || now,
    updatedAt: now,
    dirty: asset.dirty ?? true,
    lastBackupAt: asset.lastBackupAt || "",
  };
  await put(db, stores.assets, next);
  db.close();
  return hydrateAssetUrl(next);
}

export async function markAssetBackedUp(assetId, patch = {}) {
  const db = await openDb();
  const current = await getById(db, stores.assets, assetId);
  if (current) {
    await put(db, stores.assets, { ...current, ...patch, dirty: false, lastBackupAt: patch.lastBackupAt || nowIso() });
  }
  db.close();
}

export async function getAttachmentLinks(documentId) {
  const db = await openDb();
  const links = (await getAll(db, stores.attachments))
    .filter((item) => item.documentId === documentId)
    .sort((a, b) => (a.createdAt || "").localeCompare(b.createdAt || ""));
  db.close();
  return links;
}

export async function saveAttachmentLink(link) {
  const db = await openDb();
  const now = nowIso();
  const next = {
    id: link.id || localId("att"),
    documentId: link.documentId,
    type: link.type || inferAttachmentType(link.url),
    title: (link.title || "").trim(),
    url: (link.url || "").trim(),
    description: (link.description || "").trim(),
    createdAt: link.createdAt || now,
  };
  await put(db, stores.attachments, next);
  db.close();
  return next;
}

export async function deleteAttachmentLink(linkId) {
  const db = await openDb();
  await removeById(db, stores.attachments, linkId);
  db.close();
}

export async function exportWorkspace() {
  const db = await openDb();
  const [workspace, folders, documents, assets, attachments, metaItems] = await Promise.all([
    getById(db, stores.workspaces, WORKSPACE_ID),
    getAll(db, stores.folders),
    getAll(db, stores.documents),
    getAll(db, stores.assets),
    getAll(db, stores.attachments),
    getAll(db, stores.meta),
  ]);
  db.close();
  return {
    schema: "ashram-documents-v1",
    exportedAt: nowIso(),
    workspace: workspace || defaultWorkspace,
    folders: sortTreeItems(folders),
    documents: sortTreeItems(documents),
    assets,
    attachments,
    meta: Object.fromEntries(metaItems.map((item) => [item.id, item.value])),
  };
}

export async function importWorkspace(payload, { markSynced = false } = {}) {
  if (!payload) return;
  const db = await openDb();
  await clearStore(db, stores.workspaces);
  await clearStore(db, stores.folders);
  await clearStore(db, stores.documents);
  await clearStore(db, stores.assets);
  await clearStore(db, stores.attachments);
  const now = nowIso();
  const workspace = payload.workspace || {};
  await put(db, stores.workspaces, {
    ...defaultWorkspace,
    ...workspace,
    id: WORKSPACE_ID,
    name: workspace.name || workspace.nombre || defaultWorkspace.name,
    updatedAt: now,
    lastSyncAt: markSynced ? now : workspace.lastSyncAt || "",
  });
  await Promise.all((payload.folders || []).map((folder) => put(db, stores.folders, normalizeFolderImport(folder, markSynced, now))));
  await Promise.all((payload.documents || []).map((document) => put(db, stores.documents, normalizeDocument({
    ...document,
    status: markSynced ? "backed_up" : document.status || document.statusSync || "local_only",
    statusSync: markSynced ? "backed_up" : document.statusSync || document.status || "local_only",
    syncStatus: markSynced ? "backed_up" : document.syncStatus || document.statusSync || document.status || "local_only",
    dirty: markSynced ? false : document.dirty ?? true,
    lastSyncedAt: markSynced ? now : document.lastSyncedAt || "",
    lastBackupAt: markSynced ? now : document.lastBackupAt || "",
  }))));
  await Promise.all((payload.assets || []).map((asset) => put(db, stores.assets, {
    ...asset,
    dirty: markSynced ? false : asset.dirty ?? true,
    lastBackupAt: markSynced ? now : asset.lastBackupAt || "",
  })));
  await Promise.all((payload.attachments || []).map((link) => put(db, stores.attachments, link)));
  if (payload.meta) {
    await Promise.all(Object.entries(payload.meta).map(([id, value]) => put(db, stores.meta, { id, value })));
  }
  db.close();
}

export async function markWorkspaceSynced(syncedAt = nowIso()) {
  const db = await openDb();
  const [workspace, folders, documents, assets] = await Promise.all([
    getById(db, stores.workspaces, WORKSPACE_ID),
    getAll(db, stores.folders),
    getAll(db, stores.documents),
    getAll(db, stores.assets),
  ]);
  await Promise.all(folders.map((folder) => put(db, stores.folders, markBackedUp(folder, syncedAt))));
  await Promise.all(documents.map((document) => put(db, stores.documents, markBackedUp(document, syncedAt))));
  await Promise.all(assets.map((asset) => put(db, stores.assets, { ...asset, dirty: false, lastBackupAt: syncedAt })));
  await put(db, stores.workspaces, { ...(workspace || defaultWorkspace), id: WORKSPACE_ID, lastBackupAt: syncedAt, updatedAt: syncedAt });
  await put(db, stores.meta, { id: "lastSyncedAt", value: syncedAt });
  db.close();
  await saveStorageSettings({ lastBackupAt: syncedAt });
  return syncedAt;
}

export async function markWorkspaceRestored(restoredAt = nowIso()) {
  const db = await openDb();
  const workspace = await getById(db, stores.workspaces, WORKSPACE_ID);
  await put(db, stores.workspaces, { ...(workspace || defaultWorkspace), id: WORKSPACE_ID, lastSyncAt: restoredAt, updatedAt: restoredAt });
  await put(db, stores.meta, { id: "lastSyncAt", value: restoredAt });
  db.close();
  await saveStorageSettings({ lastSyncAt: restoredAt });
  return restoredAt;
}

export async function hasDirtyLocalChanges() {
  const db = await openDb();
  const [folders, documents, assets] = await Promise.all([getAll(db, stores.folders), getAll(db, stores.documents), getAll(db, stores.assets)]);
  db.close();
  return [...folders, ...documents, ...assets].some((item) => item.dirty || ["local_only", "modified_local", "deleted_local", "pending_upload"].includes(item.status || item.statusSync));
}

export async function getSyncStatus() {
  const db = await openDb();
  const [folders, documents, assets] = await Promise.all([getAll(db, stores.folders), getAll(db, stores.documents), getAll(db, stores.assets)]);
  const meta = await getById(db, stores.meta, "lastSyncedAt");
  db.close();
  const items = [...folders, ...documents, ...assets];
  if (navigator.onLine === false) return { status: "offline", label: "Sin conexion", lastSyncedAt: meta?.value || "" };
  if (items.some((item) => item.status === "conflict" || item.statusSync === "conflict")) return { status: "conflict", label: "Conflicto", lastSyncedAt: meta?.value || "" };
  if (items.some((item) => item.dirty || ["local_only", "modified_local", "deleted_local", "pending_upload"].includes(item.status || item.statusSync))) {
    return { status: "modified_local", label: "Cambios pendientes de respaldo", lastSyncedAt: meta?.value || "" };
  }
  if (items.length && items.every((item) => ["backed_up", "synced", "publicado_firebase"].includes(item.status || item.statusSync))) {
    return { status: "backed_up", label: "Respaldado en Drive", lastSyncedAt: meta?.value || "" };
  }
  return { status: "local_only", label: "Guardado localmente", lastSyncedAt: meta?.value || "" };
}

export async function saveContentExport(exportItem) {
  const db = await openDb();
  const now = nowIso();
  const next = {
    id: exportItem.id || localId("export"),
    documentId: exportItem.documentId || "",
    type: exportItem.type || "markdown",
    title: (exportItem.title || "").trim(),
    author: (exportItem.author || "").trim(),
    coverUrl: (exportItem.coverUrl || "").trim(),
    fileName: (exportItem.fileName || "").trim(),
    createdAt: exportItem.createdAt || now,
    exportedAt: exportItem.exportedAt || now,
    status: exportItem.status || "exported",
    content: exportItem.content || "",
  };
  await put(db, stores.exports, next);
  db.close();
  return next;
}

export const saveFolderLocal = saveFolder;
export const saveDocumentLocal = saveDocument;
export const updateDocumentLocal = updateDocument;
export const exportLocalWorkspace = exportWorkspace;
export const importWorkspaceToLocal = importWorkspace;
export const loadLocalTree = async () => ({ folders: await getFolders(), documents: await getDocuments() });
export const deleteLocalItem = async (item) => item?.type === "folder" ? deleteFolder(item.id) : deleteDocument(item?.id || item);

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      Object.values(stores).forEach((store) => {
        if (!db.objectStoreNames.contains(store)) db.createObjectStore(store, { keyPath: "id" });
      });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function seedIfEmpty(db) {
  const existing = await getAll(db, stores.documents);
  if (existing.length) return;
  const now = nowIso();
  const ayurveda = normalizeFolderImport({ id: "seed-folder-ayurveda", parentId: null, title: "Ayurveda", icon: "leaf", color: "#2f7d57", order: 1, createdAt: now, updatedAt: now, dirty: true }, false, now);
  const meditaciones = normalizeFolderImport({ id: "seed-folder-meditaciones", parentId: null, title: "Meditaciones", icon: "moon", color: "#4a324c", order: 2, createdAt: now, updatedAt: now, dirty: true }, false, now);
  const cursos = normalizeFolderImport({ id: "seed-folder-cursos", parentId: null, title: "Cursos", icon: "book", color: "#c69a2d", order: 3, createdAt: now, updatedAt: now, dirty: true }, false, now);
  await Promise.all([ayurveda, meditaciones, cursos].map((folder) => put(db, stores.folders, folder)));
  await Promise.all([
    put(db, stores.documents, normalizeDocument({
      id: "seed-doc-vata",
      folderId: ayurveda.id,
      title: "Notas sobre Vata",
      contentMarkdown: "# Notas sobre Vata\n\n- Observar sequedad, movimiento y descanso.\n- Registrar alimentos, rutina y clima.\n\n> Volver a tierra con suavidad.",
      statusSync: "local_only",
      createdAt: now,
      updatedAt: now,
    })),
    put(db, stores.documents, normalizeDocument({
      id: "seed-doc-meditacion",
      folderId: meditaciones.id,
      title: "Guion de meditacion",
      contentMarkdown: "# Guion de meditacion\n\nRespirar profundo.\n\n## Inicio\n\nInvitar al silencio, al cuerpo y a la presencia.",
      statusSync: "local_only",
      createdAt: now,
      updatedAt: now,
    })),
    put(db, stores.documents, normalizeDocument({
      id: "seed-doc-curso",
      folderId: cursos.id,
      title: "Ideas para curso",
      contentMarkdown: "# Ideas para curso\n\n1. Introduccion\n2. Practica guiada\n3. Material complementario\n\n---\n\nAgregar links de video y PDF cuando esten listos.",
      statusSync: "local_only",
      createdAt: now,
      updatedAt: now,
    })),
  ]);
}

function normalizeFolderImport(folder, markSynced = false, now = nowIso()) {
  const color = folder.color || folder.iconColor || "#d9a51f";
  const status = markSynced ? "backed_up" : normalizeStatus(folder.status || folder.statusSync || "local_only");
  return {
    ...folder,
    id: folder.id || localId("folder"),
    workspaceId: WORKSPACE_ID,
    parentId: folder.parentId || null,
    name: folder.name || folder.title || folder.nombre || "Carpeta",
    title: folder.title || folder.name || folder.nombre || "Carpeta",
    icon: folder.icon || "folder",
    color,
    iconColor: color,
    order: Number(folder.order ?? Date.now()),
    createdAt: folder.createdAt || now,
    updatedAt: folder.updatedAt || now,
    deletedAt: folder.deletedAt || "",
    dirty: markSynced ? false : folder.dirty ?? true,
    status,
    statusSync: markSynced ? "backed_up" : normalizeStatus(folder.statusSync || status),
    syncStatus: markSynced ? "backed_up" : normalizeStatus(folder.syncStatus || folder.statusSync || status),
    driveFileId: folder.driveFileId || "",
    lastBackupAt: markSynced ? now : folder.lastBackupAt || "",
  };
}

function normalizeDocument(document) {
  const status = normalizeStatus(document.status || document.statusSync || "local_only");
  return {
    id: document.id,
    folderId: document.folderId || "",
    title: (document.title || document.titulo || "Sin titulo").trim(),
    name: document.name || document.title || document.titulo || "Sin titulo",
    displayName: document.displayName || document.title || document.titulo || "Sin titulo",
    icon: document.icon || "document",
    color: document.color || document.iconColor || "#6c6840",
    iconColor: document.color || document.iconColor || "#6c6840",
    contentMarkdown: document.contentMarkdown ?? document.contenidoMarkdown ?? "",
    blocks: document.blocks || [],
    mode: document.mode || "document",
    type: document.type || document.driveType || "markdown",
    mimeType: document.mimeType || "text/markdown",
    status,
    statusSync: normalizeStatus(document.statusSync || status),
    syncStatus: normalizeStatus(document.syncStatus || document.statusSync || status),
    dirty: document.dirty ?? true,
    driveFileId: document.driveFileId || document.sourceDriveFileId || "",
    driveFolderId: document.driveFolderId || document.sourceDriveFolderId || "",
    webViewLink: document.webViewLink || "",
    publicFileUrl: document.publicFileUrl || "",
    publishedContentId: document.publishedContentId || "",
    lastPublishedAt: document.lastPublishedAt || "",
    createdAt: document.createdAt || document.creadoEn || nowIso(),
    updatedAt: document.updatedAt || document.actualizadoEn || nowIso(),
    deletedAt: document.deletedAt || "",
    lastSyncedAt: document.lastSyncedAt || "",
    lastBackupAt: document.lastBackupAt || "",
  };
}

function normalizeStatus(status) {
  const allowed = new Set([
    "local_only",
    "modified_local",
    "backed_up",
    "conflict",
    "deleted_local",
    "offline",
    "local",
    "pending_upload",
    "synced",
    "borrador_drive",
    "listo_para_publicar",
    "publicado_firebase",
    "actualizado_en_drive",
    "pendiente_actualizar_publicacion",
  ]);
  if (status === "local") return "local_only";
  if (status === "pending_upload") return "modified_local";
  if (status === "synced" || status === "actualizado_en_drive") return "backed_up";
  if (status === "borrador_drive") return "local_only";
  return allowed.has(status) ? status : "local_only";
}

function markDeleted(item, deletedAt = nowIso()) {
  return {
    ...item,
    status: "deleted_local",
    statusSync: "deleted_local",
    syncStatus: "deleted_local",
    dirty: true,
    deletedAt,
    updatedAt: deletedAt,
  };
}

function markBackedUp(item, syncedAt) {
  return {
    ...item,
    status: "backed_up",
    statusSync: "backed_up",
    syncStatus: "backed_up",
    dirty: false,
    lastBackupAt: syncedAt,
    lastSyncedAt: syncedAt,
  };
}

function hydrateAssetUrl(asset) {
  return {
    ...asset,
    localUrl: asset.localUrl || (asset.localBlob ? URL.createObjectURL(asset.localBlob) : ""),
  };
}

function getById(db, storeName, id) {
  return requestToPromise(db.transaction(storeName, "readonly").objectStore(storeName).get(id));
}

function getAll(db, storeName) {
  return requestToPromise(db.transaction(storeName, "readonly").objectStore(storeName).getAll());
}

function put(db, storeName, value) {
  return requestToPromise(db.transaction(storeName, "readwrite").objectStore(storeName).put(value));
}

function removeById(db, storeName, id) {
  return requestToPromise(db.transaction(storeName, "readwrite").objectStore(storeName).delete(id));
}

function clearStore(db, storeName) {
  return requestToPromise(db.transaction(storeName, "readwrite").objectStore(storeName).clear());
}

function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function descendantFolderIds(folders, folderId) {
  const children = folders.filter((folder) => folder.parentId === folderId);
  return children.flatMap((folder) => [folder.id, ...descendantFolderIds(folders, folder.id)]);
}

function sortTreeItems(items) {
  return [...items].sort((a, b) => {
    const nameA = String(a.displayName || a.title || a.name || "").replace(/\.[^/.]+$/, "").toLowerCase();
    const nameB = String(b.displayName || b.title || b.name || "").replace(/\.[^/.]+$/, "").toLowerCase();
    return nameA.localeCompare(nameB, "es", { sensitivity: "base" });
  });
}

function inferAttachmentType(url = "") {
  const clean = url.toLowerCase();
  if (clean.includes("youtube.com") || clean.includes("youtu.be")) return "youtube";
  if (clean.includes("drive.google.com")) return "drive";
  if (clean.endsWith(".pdf")) return "pdf";
  if (clean.match(/\.(mp3|m4a|wav|ogg)$/)) return "audio";
  if (clean.match(/\.(mp4|mov|webm)$/)) return "video";
  if (clean.match(/\.(png|jpe?g|webp|gif|avif)$/)) return "image";
  return "external";
}

function readStorageSettingsFallback() {
  try {
    return JSON.parse(localStorage.getItem("ashram_storage_settings") || "null") || {};
  } catch {
    return {};
  }
}

function localId(prefix) {
  if (window.crypto?.randomUUID) return `${prefix}_${window.crypto.randomUUID()}`;
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function nowIso() {
  return new Date().toISOString();
}
