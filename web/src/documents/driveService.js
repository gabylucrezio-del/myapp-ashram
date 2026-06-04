import { knowledgeConfig } from "./knowledgeConfig";
import { publishToFirebase } from "./publishedContentService";
import { getDisplayName } from "./displayName";

const DRIVE_TOKEN_KEY = "ashram_drive_access_token";
const DRIVE_TOKEN_EXPIRES_KEY = "ashram_drive_access_token_expires";
const DRIVE_TOKEN_SCOPE_KEY = "ashram_drive_access_token_scope";
const DRIVE_SESSION_KEY = "ashram_drive_session";
const DRIVE_ROOT_KEY = "ashram_drive_root_folder_id";
const DRIVE_TREE_CACHE_KEY = "ashram_drive_tree_cache";
const DRIVE_DISCOVERY = "https://www.googleapis.com/drive/v3";
const DRIVE_UPLOAD = "https://www.googleapis.com/upload/drive/v3/files";
const FOLDER_MIME = "application/vnd.google-apps.folder";
const DOC_MIME = "application/vnd.google-apps.document";
const MARKDOWN_MIME = "text/markdown";
const DRIVE_SCOPE = knowledgeConfig.scopes.join(" ");

let tokenClient = null;

export const driveSyncStates = {
  draft: "borrador_drive",
  ready: "listo_para_publicar",
  published: "publicado_firebase",
  updated: "actualizado_en_drive",
  pendingPublication: "pendiente_actualizar_publicacion",
};

export function isGoogleDriveConfigured() {
  return Boolean(import.meta.env.VITE_GOOGLE_CLIENT_ID || knowledgeConfig.googleClientId);
}

export function googleDriveSetupMessage() {
  return "Google Drive necesita iniciar sesion con OAuth y permiso completo de Drive para leer carpetas creadas manualmente.";
}

export function getKnowledgeRootFolderId() {
  const savedFolderId = localStorage.getItem(DRIVE_ROOT_KEY);
  if (savedFolderId) return savedFolderId;
  localStorage.setItem(DRIVE_ROOT_KEY, knowledgeConfig.rootFolderId);
  return knowledgeConfig.rootFolderId;
}

export function selectKnowledgeRootFolder(value) {
  const folderId = extractDriveFolderId(value || window.prompt("Pegá el link o ID de la carpeta principal de Google Drive") || "");
  if (!folderId) return "";
  localStorage.setItem(DRIVE_ROOT_KEY, folderId);
  return folderId;
}

export async function connectGoogleDrive({ prompt = "consent" } = {}) {
  const cached = getCachedAccessToken();
  if (cached) return cached;

  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || knowledgeConfig.googleClientId;
  if (!clientId) {
    throw new Error(googleDriveSetupMessage());
  }

  await loadGoogleIdentityScript();
  tokenClient ||= window.google.accounts.oauth2.initTokenClient({
    client_id: clientId,
    scope: DRIVE_SCOPE,
    prompt: "",
    callback: () => {},
  });

  return new Promise((resolve, reject) => {
    tokenClient.callback = (response) => {
      if (response.error) {
        reject(new Error(response.error_description || response.error));
        return;
      }
      const expiresAt = Date.now() + Number(response.expires_in || 3600) * 1000 - 30000;
      localStorage.setItem(DRIVE_TOKEN_KEY, response.access_token);
      localStorage.setItem(DRIVE_TOKEN_EXPIRES_KEY, String(expiresAt));
      localStorage.setItem(DRIVE_TOKEN_SCOPE_KEY, DRIVE_SCOPE);
      saveDriveSession({ tokenExpiresAt: expiresAt });
      resolve(response.access_token);
    };
    tokenClient.requestAccessToken({ prompt });
  });
}

export async function signInGoogle() {
  return connectGoogleDrive({ prompt: "consent" });
}

export function signOutGoogle() {
  const token = getCachedAccessToken();
  localStorage.removeItem(DRIVE_TOKEN_KEY);
  localStorage.removeItem(DRIVE_TOKEN_EXPIRES_KEY);
  localStorage.removeItem(DRIVE_TOKEN_SCOPE_KEY);
  clearDriveSession();
  if (token) window.google?.accounts?.oauth2?.revoke?.(token, () => {});
}

export function saveDriveSession(patch = {}) {
  const current = loadDriveSession();
  const knowledgeRootFolderId = getKnowledgeRootFolderId();
  const session = {
    ...current,
    ...patch,
    googleDriveConnected: true,
    knowledgeRootFolderId,
    lastConnectedAt: new Date().toISOString(),
  };
  localStorage.setItem(DRIVE_SESSION_KEY, JSON.stringify(session));
  return session;
}

export function loadDriveSession() {
  try {
    return JSON.parse(localStorage.getItem(DRIVE_SESSION_KEY) || "null") || {};
  } catch {
    return {};
  }
}

export function clearDriveSession() {
  localStorage.removeItem(DRIVE_SESSION_KEY);
}

export async function restoreDriveSession() {
  const session = loadDriveSession();
  if (!session.googleDriveConnected) return "";
  const cached = getCachedAccessToken();
  if (cached) return cached;
  return connectGoogleDrive({ prompt: "" });
}

export async function initializeGoogleDrive() {
  await signInGoogle();
  return loadDriveTree(getKnowledgeRootFolderId());
}

export function getGoogleDriveConnectionStatus() {
  return getCachedAccessToken() ? "connected" : "disconnected";
}

export async function listDriveFolders(parentId = getKnowledgeRootFolderId()) {
  return listDriveItems(parentId, `mimeType = '${FOLDER_MIME}'`);
}

export async function listKnowledgeFolders(parentId = getKnowledgeRootFolderId()) {
  return listDriveFolders(parentId);
}

export async function listDriveFiles(parentId = getKnowledgeRootFolderId()) {
  return listDriveItems(parentId, `mimeType != '${FOLDER_MIME}'`);
}

export async function listKnowledgeDocuments(parentId = getKnowledgeRootFolderId()) {
  return listDriveFiles(parentId);
}

export async function listKnowledgeRoot() {
  return listDriveFolderChildren(getKnowledgeRootFolderId());
}

export async function listDriveFolderChildren(folderId = getKnowledgeRootFolderId()) {
  return listDriveChildren(folderId || getKnowledgeRootFolderId());
}

export async function listDriveChildren(folderId = getKnowledgeRootFolderId()) {
  return listDriveItems(folderId || getKnowledgeRootFolderId());
}

export async function listDriveItems(parentId = getKnowledgeRootFolderId(), mimeQuery = "") {
  if (!parentId) return [];
  const query = [`'${parentId}' in parents`, "trashed = false", mimeQuery].filter(Boolean).join(" and ");
  const files = [];
  let pageToken = "";
  do {
    const params = new URLSearchParams({
      q: query,
      fields: "nextPageToken,files(id,name,mimeType,parents,webViewLink,webContentLink,modifiedTime,iconLink,thumbnailLink)",
      orderBy: "folder,name",
      pageSize: "1000",
      includeItemsFromAllDrives: "true",
      supportsAllDrives: "true",
    });
    if (pageToken) params.set("pageToken", pageToken);
    const data = await driveFetch(`${DRIVE_DISCOVERY}/files?${params.toString()}`);
    files.push(...(data.files || []));
    pageToken = data.nextPageToken || "";
  } while (pageToken);
  return files.map(normalizeDriveItem);
}

export async function readDriveDocument(fileId, mimeType = MARKDOWN_MIME) {
  if (!fileId) return "";
  if (mimeType === DOC_MIME) {
    const params = new URLSearchParams({ mimeType: "text/plain" });
    return driveFetchText(`${DRIVE_DISCOVERY}/files/${fileId}/export?${params.toString()}`);
  }
  return driveFetchText(`${DRIVE_DISCOVERY}/files/${fileId}?alt=media`);
}

export async function readMarkdownFile(fileId, mimeType = MARKDOWN_MIME) {
  return readDriveDocument(fileId, mimeType);
}

export async function readDriveBlob(fileId) {
  if (!fileId) throw new Error("Falta el ID del archivo de Drive.");
  const token = await connectGoogleDrive();
  const response = await fetch(`${DRIVE_DISCOVERY}/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error(await driveError(response));
  return response.blob();
}

export async function updateDriveDocument(fileId, contentMarkdown) {
  if (!fileId) throw new Error("Falta el ID del archivo de Drive.");
  const token = await connectGoogleDrive();
  const response = await fetch(`${DRIVE_UPLOAD}/${fileId}?uploadType=media&supportsAllDrives=true`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": MARKDOWN_MIME,
    },
    body: contentMarkdown || "",
  });
  if (!response.ok) throw new Error(await driveError(response));
  return normalizeDriveItem(await response.json());
}

export async function saveMarkdownFile(fileId, content) {
  return updateDriveDocument(fileId, content);
}

export async function createDriveTextFile(parentFolderId, fileName, content = "", mimeType = "text/plain") {
  const parentId = parentFolderId || getKnowledgeRootFolderId();
  const boundary = `ashram_text_${Date.now()}`;
  const metadata = {
    name: fileName || "archivo.txt",
    mimeType,
    parents: parentId ? [parentId] : undefined,
  };
  const body = [
    `--${boundary}`,
    "Content-Type: application/json; charset=UTF-8",
    "",
    JSON.stringify(metadata),
    `--${boundary}`,
    `Content-Type: ${mimeType}; charset=UTF-8`,
    "",
    content || "",
    `--${boundary}--`,
  ].join("\r\n");
  const data = await driveFetch(`${DRIVE_UPLOAD}?uploadType=multipart&supportsAllDrives=true&fields=id,name,mimeType,parents,webViewLink,webContentLink,modifiedTime`, {
    method: "POST",
    headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
    body,
  });
  return normalizeDriveItem(data);
}

export async function updateDriveTextFile(fileId, content = "", mimeType = "text/plain") {
  if (!fileId) throw new Error("Falta el ID del archivo de Drive.");
  const token = await connectGoogleDrive();
  const response = await fetch(`${DRIVE_UPLOAD}/${fileId}?uploadType=media&supportsAllDrives=true&fields=id,name,mimeType,parents,webViewLink,webContentLink,modifiedTime`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": `${mimeType}; charset=UTF-8`,
    },
    body: content || "",
  });
  if (!response.ok) throw new Error(await driveError(response));
  return normalizeDriveItem(await response.json());
}

export async function updateDriveBlob(fileId, file, mimeType = "application/octet-stream") {
  if (!fileId) throw new Error("Falta el ID del archivo de Drive.");
  const token = await connectGoogleDrive();
  const response = await fetch(`${DRIVE_UPLOAD}/${fileId}?uploadType=media&supportsAllDrives=true&fields=id,name,mimeType,parents,webViewLink,webContentLink,thumbnailLink,modifiedTime`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": mimeType,
    },
    body: file,
  });
  if (!response.ok) throw new Error(await driveError(response));
  return normalizeDriveItem(await response.json());
}

export async function downloadDriveBlob(fileId, mimeType = "") {
  if (!fileId) throw new Error("Falta el ID del archivo de Drive.");
  if (mimeType === DOC_MIME) {
    const text = await readDriveDocument(fileId, DOC_MIME);
    return new Blob([text], { type: "text/plain" });
  }
  return readDriveBlob(fileId);
}

export async function createDriveFolder(parentOrOptions = {}, folderName = "") {
  const options = parentOrOptions && typeof parentOrOptions === "object"
    ? parentOrOptions
    : { parentId: parentOrOptions, name: folderName };
  const parentId = options.parentId || getKnowledgeRootFolderId();
  const metadata = {
    name: options.name || "Nueva carpeta",
    mimeType: FOLDER_MIME,
    parents: parentId ? [parentId] : undefined,
  };
  const data = await driveFetch(`${DRIVE_DISCOVERY}/files?supportsAllDrives=true&fields=id,name,mimeType,parents,webViewLink,modifiedTime`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(metadata),
  });
  return normalizeDriveItem(data);
}

export async function createFolderInDrive(parentFolderId, folderName) {
  return createDriveFolder(parentFolderId || getKnowledgeRootFolderId(), folderName);
}

export async function createDriveDocument(parentOrOptions = {}, title = "", content = "") {
  const options = parentOrOptions && typeof parentOrOptions === "object"
    ? parentOrOptions
    : { parentId: parentOrOptions, name: title, contentMarkdown: content };
  const parentId = options.parentId || getKnowledgeRootFolderId();
  const name = options.name || options.title || "Nuevo documento";
  const contentMarkdown = options.contentMarkdown ?? "";
  const fileName = name?.endsWith(".md") ? name : `${name || "Nuevo documento"}.md`;
  const boundary = `ashram_${Date.now()}`;
  const metadata = {
    name: fileName,
    mimeType: MARKDOWN_MIME,
    parents: parentId ? [parentId] : undefined,
  };
  const body = [
    `--${boundary}`,
    "Content-Type: application/json; charset=UTF-8",
    "",
    JSON.stringify(metadata),
    `--${boundary}`,
    `Content-Type: ${MARKDOWN_MIME}; charset=UTF-8`,
    "",
    contentMarkdown,
    `--${boundary}--`,
  ].join("\r\n");
  const data = await driveFetch(`${DRIVE_UPLOAD}?uploadType=multipart&supportsAllDrives=true&fields=id,name,mimeType,parents,webViewLink,webContentLink,modifiedTime`, {
    method: "POST",
    headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
    body,
  });
  const driveFile = normalizeDriveItem(data);
  if (!driveFile.driveFileId) throw new Error("Google Drive no devolvio el ID real del documento.");
  if (!String(driveFile.name || fileName).toLowerCase().endsWith(".md")) {
    throw new Error("El documento creado en Drive no quedo como archivo .md.");
  }
  return driveFile;
}

export async function createDocumentInDrive(parentFolderId, title, content = "") {
  return createDriveDocument(parentFolderId || getKnowledgeRootFolderId(), title, content);
}

export async function createMarkdownFile(parentFolderId, title, content = "") {
  return createDriveDocument(parentFolderId || getKnowledgeRootFolderId(), title, content);
}

export async function uploadDriveAsset(parentFolderId, file, fileName = "") {
  if (!file) throw new Error("No se selecciono ningun archivo.");
  const parentId = await ensureDriveAssetsFolder(parentFolderId || getKnowledgeRootFolderId());
  const boundary = `ashram_asset_${Date.now()}`;
  const metadata = {
    name: fileName || file.name || `imagen-${Date.now()}`,
    mimeType: file.type || "application/octet-stream",
    parents: [parentId],
  };
  const token = await connectGoogleDrive();
  const body = new Blob([
    `--${boundary}\r\n`,
    "Content-Type: application/json; charset=UTF-8\r\n\r\n",
    JSON.stringify(metadata),
    `\r\n--${boundary}\r\n`,
    `Content-Type: ${metadata.mimeType}\r\n\r\n`,
    file,
    `\r\n--${boundary}--`,
  ]);
  const response = await fetch(`${DRIVE_UPLOAD}?uploadType=multipart&supportsAllDrives=true&fields=id,name,mimeType,parents,webViewLink,webContentLink,thumbnailLink,modifiedTime`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": `multipart/related; boundary=${boundary}`,
    },
    body,
  });
  if (!response.ok) throw new Error(await driveError(response));
  const item = normalizeDriveItem(await response.json());
  return {
    ...item,
    publicFileUrl: item.thumbnailLink || item.webContentLink || `https://drive.google.com/uc?export=view&id=${item.driveFileId}`,
  };
}

export async function ensureDriveAssetsFolder(parentFolderId) {
  const rootFolderId = getKnowledgeRootFolderId();
  const children = await listDriveChildren(parentFolderId || rootFolderId);
  const existing = children.find((item) => item.type === "folder" && ["assets", "imagenes", "imágenes"].includes((item.name || "").toLowerCase()));
  if (existing?.driveFileId) return existing.driveFileId;
  const folder = await createDriveFolder(parentFolderId || rootFolderId, "assets");
  return folder.driveFileId;
}

export async function updateDocumentInDrive(fileId, content) {
  return updateDriveDocument(fileId, content);
}

export async function renameDriveItem(fileId, newName) {
  if (!fileId) throw new Error("Falta el ID del archivo de Drive.");
  const data = await driveFetch(`${DRIVE_DISCOVERY}/files/${fileId}?supportsAllDrives=true&fields=id,name,mimeType,parents,webViewLink,modifiedTime`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: newName || "Sin titulo" }),
  });
  return normalizeDriveItem(data);
}

export async function deleteDriveItem(fileId) {
  if (!fileId) throw new Error("Falta el ID del archivo de Drive.");
  await driveFetch(`${DRIVE_DISCOVERY}/files/${fileId}?supportsAllDrives=true&fields=id`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ trashed: true }),
  });
}

export async function publishDriveItemToFirebase(fileId, publication = {}) {
  if (!fileId) throw new Error("Falta el ID del archivo de Drive.");
  const params = new URLSearchParams({
    fields: "id,name,mimeType,parents,webViewLink,webContentLink,modifiedTime",
    supportsAllDrives: "true",
  });
  const driveItem = normalizeDriveItem(await driveFetch(`${DRIVE_DISCOVERY}/files/${fileId}?${params.toString()}`));
  return publishToFirebase({
    document: {
      ...driveItem,
      title: publication.title || driveItem.title,
      contentMarkdown: publication.content || "",
    },
    type: publication.type || "library_resource",
    title: publication.title || driveItem.title,
    description: publication.description || "",
    coverUrl: publication.coverUrl || "",
    publicFileUrl: publication.publicFileUrl || driveItem.publicFileUrl || driveItem.webViewLink,
    content: publication.content || "",
  });
}

export async function loadDriveTree(rootFolderId = getKnowledgeRootFolderId()) {
  const root = {
    id: rootFolderId,
    driveId: rootFolderId,
    driveFileId: rootFolderId,
    name: knowledgeConfig.rootFolderName,
    title: knowledgeConfig.rootFolderName,
    type: "folder",
    mimeType: FOLDER_MIME,
    parentId: null,
    webViewLink: `https://drive.google.com/drive/folders/${rootFolderId}`,
    webContentLink: "",
    modifiedTime: "",
    children: [],
  };
  root.children = sortDriveTreeNodes(await loadDriveChildrenRecursive(rootFolderId));
  const sortedRoot = sortDriveTreeNodes([root])[0];
  const tree = buildDriveTree(sortedRoot);
  cacheDriveTree(tree);
  return tree;
}

export async function refreshDriveTree() {
  return loadDriveTree(getKnowledgeRootFolderId());
}

export function getCachedDriveTree() {
  try {
    return JSON.parse(localStorage.getItem(DRIVE_TREE_CACHE_KEY) || "null");
  } catch {
    return null;
  }
}

export function buildDriveTree(rootNode) {
  const folders = [];
  const documents = [];
  const flatten = (node, parentLocalId = "") => {
    const children = sortDriveTreeNodes(node.children || []);
    children.forEach((child) => {
      if (child.type === "folder") {
        folders.push(driveNodeToFolder(child, parentLocalId));
        flatten(child, child.id);
        return;
      }
      documents.push(driveNodeToDocument(child, parentLocalId));
    });
  };
  flatten(rootNode, "");
  return {
    root: rootNode,
    folders,
    documents,
    updatedAt: new Date().toISOString(),
    source: "google_drive",
  };
}

export function sortDriveTreeNodes(nodes = []) {
  return [...nodes]
    .sort((a, b) => {
      if (a.type === "folder" && b.type !== "folder") return -1;
      if (a.type !== "folder" && b.type === "folder") return 1;
      const nameA = getDisplayName(a.displayName || a.name || a.title || "").toLowerCase();
      const nameB = getDisplayName(b.displayName || b.name || b.title || "").toLowerCase();
      return nameA.localeCompare(nameB, "es", { sensitivity: "base" });
    })
    .map((node) => ({
      ...node,
      children: node.children ? sortDriveTreeNodes(node.children) : [],
    }));
}

export function normalizeDriveItem(file) {
  const mimeType = file.mimeType || "";
  const type = driveItemType(mimeType, file.name || "");
  return {
    id: file.id,
    driveId: file.id,
    driveFileId: file.id,
    driveFolderId: file.parents?.[0] || "",
    name: file.name || "Sin titulo",
    displayName: getDisplayName(file.name || "Sin titulo"),
    title: file.name || "Sin titulo",
    mimeType,
    type,
    parentId: file.parents?.[0] || null,
    webViewLink: file.webViewLink || "",
    webContentLink: file.webContentLink || "",
    thumbnailLink: file.thumbnailLink || "",
    publicFileUrl: file.thumbnailLink || file.webContentLink || file.webViewLink || "",
    modifiedTime: file.modifiedTime || "",
    updatedAt: file.modifiedTime || new Date().toISOString(),
    children: [],
    syncStatus: driveSyncStates.updated,
  };
}

export function isEditableDriveItem(item) {
  const type = item?.type || item?.driveType;
  const name = `${item?.name || item?.title || ""}`.toLowerCase();
  return Boolean(
    item?.editable === true ||
    type === "markdown" ||
    type === "text" ||
    item?.mimeType === MARKDOWN_MIME ||
    item?.mimeType === "text/plain" ||
    name.endsWith(".md") ||
    name.endsWith(".txt")
  );
}

function getCachedAccessToken() {
  const token = localStorage.getItem(DRIVE_TOKEN_KEY);
  const expiresAt = Number(localStorage.getItem(DRIVE_TOKEN_EXPIRES_KEY) || 0);
  const scope = localStorage.getItem(DRIVE_TOKEN_SCOPE_KEY) || "";
  if (!token || expiresAt <= Date.now() || scope !== DRIVE_SCOPE) {
    localStorage.removeItem(DRIVE_TOKEN_KEY);
    localStorage.removeItem(DRIVE_TOKEN_EXPIRES_KEY);
    localStorage.removeItem(DRIVE_TOKEN_SCOPE_KEY);
    return "";
  }
  return token;
}

async function driveFetch(url, options = {}) {
  const token = await connectGoogleDrive();
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });
  if (!response.ok) throw new Error(await driveError(response));
  return response.json();
}

async function driveFetchText(url) {
  const token = await connectGoogleDrive();
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) throw new Error(await driveError(response));
  return response.text();
}

async function driveError(response) {
  try {
    const data = await response.json();
    return data.error?.message || "Google Drive no respondio correctamente.";
  } catch {
    return "Google Drive no respondio correctamente.";
  }
}

function loadGoogleIdentityScript() {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector("script[data-google-identity]");
    if (existing) {
      existing.addEventListener("load", resolve, { once: true });
      existing.addEventListener("error", reject, { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.dataset.googleIdentity = "true";
    script.onload = resolve;
    script.onerror = () => reject(new Error("No se pudo cargar Google Identity Services."));
    document.head.appendChild(script);
  });
}

async function loadDriveChildrenRecursive(folderId) {
  const children = sortDriveTreeNodes(await listDriveChildren(folderId));
  await Promise.all(children.filter((item) => item.type === "folder").map(async (folder) => {
    folder.children = await loadDriveChildrenRecursive(folder.driveFileId);
  }));
  return sortDriveTreeNodes(children);
}

function sortDriveNodes(nodes) {
  return sortDriveTreeNodes(nodes);
}

function driveNodeToFolder(node, parentLocalId) {
  return {
    id: node.driveFileId,
    driveFileId: node.driveFileId,
    driveId: node.driveFileId,
    workspaceId: "ashram-workspace",
    parentId: parentLocalId || null,
    title: node.title,
    displayName: node.displayName || getDisplayName(node.title),
    icon: "folder",
    color: "#d9a51f",
    iconColor: "#d9a51f",
    order: Date.parse(node.modifiedTime || node.updatedAt || "") || Date.now(),
    createdAt: node.modifiedTime || new Date().toISOString(),
    updatedAt: node.modifiedTime || node.updatedAt,
    syncStatus: "actualizado_en_drive",
    statusSync: "actualizado_en_drive",
  };
}

function driveNodeToDocument(node, parentLocalId) {
  const color = driveDocumentColor(node.type);
  return {
    id: node.driveFileId,
    driveFileId: node.driveFileId,
    driveId: node.driveFileId,
    driveFolderId: node.driveFolderId,
    folderId: parentLocalId || "",
    title: node.title,
    displayName: node.displayName || getDisplayName(node.title),
    contentMarkdown: "",
    blocks: [],
    mode: "document",
    type: node.type,
    mimeType: node.mimeType,
    driveType: node.type,
    editable: isEditableDriveItem(node),
    webViewLink: node.webViewLink,
    webContentLink: node.webContentLink,
    publicFileUrl: node.publicFileUrl,
    statusSync: "actualizado_en_drive",
    syncStatus: "actualizado_en_drive",
    icon: driveDocumentIcon(node.type),
    color,
    iconColor: color,
    createdAt: node.modifiedTime || new Date().toISOString(),
    updatedAt: node.modifiedTime || node.updatedAt,
  };
}

function cacheDriveTree(tree) {
  localStorage.setItem(DRIVE_TREE_CACHE_KEY, JSON.stringify(tree));
}

function driveItemType(mimeType, name = "") {
  const cleanName = name.toLowerCase();
  if (mimeType === FOLDER_MIME) return "folder";
  if (mimeType === DOC_MIME) return "google_doc";
  if (cleanName.endsWith(".md") || mimeType === MARKDOWN_MIME) return "markdown";
  if (cleanName.endsWith(".txt") || mimeType === "text/plain") return "text";
  if (mimeType.includes("image/")) return "image";
  if (mimeType.includes("pdf")) return "pdf";
  if (mimeType.includes("audio/")) return "audio";
  if (mimeType.includes("video/")) return "video";
  return "other";
}

function driveDocumentIcon(type) {
  if (type === "pdf") return "pdf";
  if (type === "audio") return "music";
  if (type === "video") return "video";
  if (type === "image") return "flower";
  if (type === "google_doc") return "book";
  return "document";
}

function driveDocumentColor(type) {
  if (type === "pdf") return "#a85f64";
  if (type === "audio") return "#2f6f9f";
  if (type === "video") return "#4a324c";
  if (type === "image") return "#2f7d57";
  if (type === "google_doc") return "#c69a2d";
  return "#6c6840";
}

function extractDriveFolderId(value) {
  const clean = value.trim();
  if (!clean) return "";
  try {
    const url = new URL(clean);
    const foldersMatch = url.pathname.match(/\/folders\/([^/?]+)/);
    if (foldersMatch?.[1]) return foldersMatch[1];
    return url.searchParams.get("id") || clean;
  } catch {
    return clean;
  }
}
