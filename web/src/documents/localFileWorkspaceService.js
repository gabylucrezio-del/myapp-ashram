import {
  getDirectoryHandle,
  getStorageSettings,
  saveDirectoryHandle,
  saveStorageSettings,
} from "./localDbService";

const MANIFEST_NAME = ".ashram-manifest.json";
const DOCUMENT_EXTENSIONS = new Set(["md", "markdown", "txt"]);
const ASSET_EXTENSIONS = new Set([
  "png", "jpg", "jpeg", "webp", "gif", "avif", "svg",
  "pdf", "doc", "docx", "odt", "rtf",
  "xls", "xlsx", "ods", "csv",
  "ppt", "pptx", "odp",
  "mp3", "m4a", "wav", "ogg",
  "mp4", "mov", "webm",
  "json", "html", "htm", "epub", "zip",
]);

export async function selectLocalWorkspaceFolder({ forceFresh = false } = {}) {
  if (!window.showDirectoryPicker) return null;
  const previous = forceFresh ? null : await restoreLocalFolderHandle();
  const handle = await window.showDirectoryPicker({
    id: "ashram-workspace",
    mode: "readwrite",
    startIn: previous || "documents",
  });
  await saveLocalFolderHandle(handle);
  await saveStorageSettings({ workspaceLocalPath: handle.name });
  await updateLocalManifest(handle);
  return handle;
}

export async function saveLocalFolderHandle(handle) {
  await saveDirectoryHandle("workspace", handle);
  return handle;
}

export async function restoreLocalFolderHandle() {
  try {
    const handle = await getDirectoryHandle("workspace");
    if (!handle) return null;
    const permission = await verifyHandlePermission(handle, true);
    return permission ? handle : null;
  } catch {
    return null;
  }
}

export async function verifyDirectoryWritePermission(handle) {
  return verifyHandlePermission(handle, true);
}

export async function scanLocalWorkspace(rootHandle) {
  if (!rootHandle) return { folders: [], documents: [], assets: [], manifest: null };
  const folders = [];
  const documents = [];
  const assets = [];

  async function walk(directoryHandle, parentPath = "") {
    for await (const [name, handle] of directoryHandle.entries()) {
      if (name === MANIFEST_NAME) continue;
      const relativePath = joinPath(parentPath, name);
      if (handle.kind === "directory") {
        folders.push(folderFromPath(relativePath, handle));
        await walk(handle, relativePath);
        continue;
      }
      const extension = extensionOf(name);
      if (DOCUMENT_EXTENSIONS.has(extension)) {
        const contentMarkdown = await readFileText(handle);
        documents.push(documentFromPath(relativePath, handle, contentMarkdown));
      } else if (ASSET_EXTENSIONS.has(extension)) {
        assets.push(assetFromPath(relativePath, handle));
      }
    }
  }

  await walk(rootHandle);
  return {
    folders: sortTreeItems(folders),
    documents: sortTreeItems(documents),
    assets: sortTreeItems(assets),
    manifest: await readLocalManifest(rootHandle),
  };
}

export function buildTreeFromLocalFolder(scan) {
  return {
    folders: sortTreeItems(scan?.folders || []),
    documents: sortTreeItems(scan?.documents || []),
    assets: sortTreeItems(scan?.assets || []),
  };
}

export async function createLocalFolder(rootHandle, parentPath = "", name = "Nueva carpeta") {
  const parent = await getDirectoryByPath(rootHandle, parentPath);
  const cleanName = safeSegment(name) || "Nueva carpeta";
  const handle = await parent.getDirectoryHandle(cleanName, { create: true });
  await updateLocalManifest(rootHandle);
  return folderFromPath(joinPath(parentPath, cleanName), handle);
}

export async function createLocalMarkdownFile(rootHandle, folderPath = "", title = "Nuevo documento", content = "") {
  const parent = await getDirectoryByPath(rootHandle, folderPath);
  const baseName = safeSegment(stripMarkdownExtension(title)) || "Nuevo documento";
  const fileName = `${baseName}.md`;
  const handle = await parent.getFileHandle(fileName, { create: true });
  const initialContent = content || `# ${baseName}\n\n`;
  await writeFileText(handle, initialContent);
  await updateLocalManifest(rootHandle);
  return documentFromPath(joinPath(folderPath, fileName), handle, initialContent);
}

export async function deleteLocalItem(rootHandle, item) {
  if (!rootHandle || !item?.path) return;
  const parent = await getDirectoryByPath(rootHandle, dirname(item.path));
  await parent.removeEntry(basename(item.path), { recursive: item.type === "folder" || Boolean(item.directoryHandle) });
  await updateLocalManifest(rootHandle);
}

export async function renameLocalItem(rootHandle, item, nextName) {
  if (!rootHandle || !item?.path || !nextName?.trim()) return null;
  const parentPath = dirname(item.path);
  const parent = await getDirectoryByPath(rootHandle, parentPath);
  const oldName = basename(item.path);
  const isFolder = item.type === "folder" || Boolean(item.directoryHandle);
  const cleanName = isFolder
    ? safeSegment(nextName)
    : `${safeSegment(stripMarkdownExtension(nextName)) || stripMarkdownExtension(oldName)}.md`;
  if (!cleanName || cleanName === oldName) return item;
  if (isFolder) {
    const oldDirectory = await parent.getDirectoryHandle(oldName);
    const newDirectory = await parent.getDirectoryHandle(cleanName, { create: true });
    await copyDirectory(oldDirectory, newDirectory);
    await parent.removeEntry(oldName, { recursive: true });
    await updateLocalManifest(rootHandle);
    return folderFromPath(joinPath(parentPath, cleanName), newDirectory);
  }
  const oldFile = await parent.getFileHandle(oldName);
  const newFile = await parent.getFileHandle(cleanName, { create: true });
  await writeFileText(newFile, await readFileText(oldFile));
  await parent.removeEntry(oldName);
  await updateLocalManifest(rootHandle);
  return documentFromPath(joinPath(parentPath, cleanName), newFile, await readFileText(newFile));
}

export async function moveLocalMarkdownFile(rootHandle, documentItem, targetFolderPath = "") {
  if (!rootHandle || !documentItem?.path) return null;
  const currentFolderPath = dirname(documentItem.path);
  const nextFolderPath = targetFolderPath || "";
  if (currentFolderPath === nextFolderPath) return documentItem;
  const currentFolder = await getDirectoryByPath(rootHandle, currentFolderPath);
  const targetFolder = await getDirectoryByPath(rootHandle, nextFolderPath);
  const oldName = basename(documentItem.path);
  const oldFile = await currentFolder.getFileHandle(oldName);
  const nextName = await uniqueFileName(targetFolder, oldName);
  const nextFile = await targetFolder.getFileHandle(nextName, { create: true });
  const content = await readFileText(oldFile);
  await writeFileText(nextFile, content);
  await currentFolder.removeEntry(oldName);
  await updateLocalManifest(rootHandle);
  return documentFromPath(joinPath(nextFolderPath, nextName), nextFile, content);
}

export async function readLocalMarkdownFile(documentItem) {
  if (!documentItem?.fileHandle) return documentItem?.contentMarkdown || "";
  return readFileText(documentItem.fileHandle);
}

export async function writeLocalMarkdownFile(rootHandle, documentItem, contentMarkdown = "") {
  if (!documentItem?.fileHandle) throw new Error("El documento no tiene archivo local asociado.");
  await writeFileText(documentItem.fileHandle, contentMarkdown);
  await updateLocalManifest(rootHandle);
  return { ...documentItem, contentMarkdown, updatedAt: new Date().toISOString(), status: "local_only", statusSync: "local_only", syncStatus: "local_only" };
}

export async function copyImageToLocalAssets(rootHandle, documentItem, file) {
  if (!rootHandle || !documentItem?.path) return null;
  const documentFolderPath = dirname(documentItem.path);
  const documentFolder = await getDirectoryByPath(rootHandle, documentFolderPath);
  const assetsFolder = await documentFolder.getDirectoryHandle("assets", { create: true });
  const fileName = await uniqueFileName(assetsFolder, file.name || `imagen-${Date.now()}`);
  const assetHandle = await assetsFolder.getFileHandle(fileName, { create: true });
  const writable = await assetHandle.createWritable();
  await writable.write(file);
  await writable.close();
  await updateLocalManifest(rootHandle);
  const markdownUrl = joinPath("assets", fileName);
  return {
    id: joinPath(documentFolderPath, markdownUrl),
    path: joinPath(documentFolderPath, markdownUrl),
    markdownUrl,
    localPreviewUrl: URL.createObjectURL(file),
    publicFileUrl: markdownUrl,
    webContentLink: markdownUrl,
    webViewLink: markdownUrl,
    fileName,
    mimeType: file.type || "application/octet-stream",
  };
}

export function insertImageReferenceInDocument(markdown = "", { markdownUrl, alt = "imagen" }) {
  return `${markdown}\n\n![${String(alt).replace(/]/g, "\\]")}](${markdownUrl})\n`;
}

export async function updateLocalManifest(rootHandle, drivePatch = {}) {
  const files = [];
  const previousManifest = await readLocalManifest(rootHandle);
  const previousFiles = new Map((previousManifest?.files || []).map((file) => [file.path, file]));

  async function walk(directoryHandle, parentPath = "") {
    for await (const [name, handle] of directoryHandle.entries()) {
      if (name === MANIFEST_NAME) continue;
      const relativePath = joinPath(parentPath, name);
      if (handle.kind === "directory") {
        await walk(handle, relativePath);
        continue;
      }
      const file = await handle.getFile();
      files.push({
        path: relativePath,
        hash: await hashBlob(file),
        modifiedAt: new Date(file.lastModified).toISOString(),
        driveFileId: drivePatch[relativePath]?.driveFileId || previousFiles.get(relativePath)?.driveFileId || "",
        status: drivePatch[relativePath]?.status || previousFiles.get(relativePath)?.status || "local",
      });
    }
  }

  await walk(rootHandle);
  const settings = await getStorageSettings();
  const manifest = {
    version: 1,
    workspaceName: settings.workspaceLocalPath || rootHandle.name || "Ashram Ganesha",
    lastBackupAt: settings.lastBackupAt || "",
    lastSyncAt: settings.lastSyncAt || "",
    files: files.sort((a, b) => a.path.localeCompare(b.path, "es", { sensitivity: "base" })),
  };
  const handle = await rootHandle.getFileHandle(MANIFEST_NAME, { create: true });
  await writeFileText(handle, JSON.stringify(manifest, null, 2));
  return manifest;
}

export async function backupChangedFilesToDrive() {
  throw new Error("El respaldo automatico a Drive esta desactivado. Usa la exportacion manual de Firestore.");
}

export async function syncChangedFilesFromDrive() {
  throw new Error("La sincronizacion desde Drive esta desactivada. Firestore es la fuente principal.");
}

async function readLocalManifest(rootHandle) {
  try {
    const handle = await rootHandle.getFileHandle(MANIFEST_NAME);
    return JSON.parse(await readFileText(handle));
  } catch {
    return null;
  }
}

async function verifyHandlePermission(handle, readWrite = false) {
  const options = readWrite ? { mode: "readwrite" } : {};
  if ((await handle.queryPermission?.(options)) === "granted") return true;
  return (await handle.requestPermission?.(options)) === "granted";
}

async function getDirectoryByPath(rootHandle, path = "") {
  const parts = path.split("/").filter(Boolean);
  let current = rootHandle;
  for (const part of parts) {
    current = await current.getDirectoryHandle(part, { create: true });
  }
  return current;
}

async function readFileText(fileHandle) {
  const file = await fileHandle.getFile();
  return file.text();
}

async function writeFileText(fileHandle, content) {
  const writable = await fileHandle.createWritable();
  await writable.write(content || "");
  await writable.close();
}

async function uniqueFileName(directoryHandle, fileName) {
  const clean = safeFileName(fileName);
  const dot = clean.lastIndexOf(".");
  const name = dot > 0 ? clean.slice(0, dot) : clean;
  const extension = dot > 0 ? clean.slice(dot) : "";
  let candidate = clean;
  let index = 1;
  while (await fileExists(directoryHandle, candidate)) {
    candidate = `${name}-${index}${extension}`;
    index += 1;
  }
  return candidate;
}

async function copyDirectory(sourceDirectory, targetDirectory) {
  for await (const [name, handle] of sourceDirectory.entries()) {
    if (handle.kind === "directory") {
      const nextTarget = await targetDirectory.getDirectoryHandle(name, { create: true });
      await copyDirectory(handle, nextTarget);
      continue;
    }
    const sourceFile = await handle.getFile();
    const targetFile = await targetDirectory.getFileHandle(name, { create: true });
    const writable = await targetFile.createWritable();
    await writable.write(sourceFile);
    await writable.close();
  }
}

async function fileExists(directoryHandle, fileName) {
  try {
    await directoryHandle.getFileHandle(fileName);
    return true;
  } catch {
    return false;
  }
}

function folderFromPath(path, directoryHandle) {
  return {
    id: path,
    path,
    directoryHandle,
    type: "folder",
    workspaceId: "ashram-workspace",
    parentId: parentIdForPath(path),
    title: basename(path),
    name: basename(path),
    displayName: basename(path),
    icon: "folder",
    color: "#d9a51f",
    iconColor: "#d9a51f",
    status: "local_only",
    statusSync: "local_only",
    syncStatus: "local_only",
    dirty: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function documentFromPath(path, fileHandle, contentMarkdown) {
  const title = stripMarkdownExtension(basename(path));
  const now = new Date().toISOString();
  return {
    id: path,
    path,
    fileHandle,
    folderId: parentIdForPath(path),
    title,
    name: basename(path),
    displayName: title,
    contentMarkdown,
    blocks: [],
    mode: "document",
    type: "markdown",
    mimeType: "text/markdown",
    icon: "document",
    color: "#6c6840",
    iconColor: "#6c6840",
    status: "local_only",
    statusSync: "local_only",
    syncStatus: "local_only",
    dirty: false,
    createdAt: now,
    updatedAt: now,
  };
}

function assetFromPath(path, fileHandle) {
  return {
    id: path,
    path,
    fileHandle,
    folderId: parentIdForPath(path),
    title: basename(path),
    name: basename(path),
    type: extensionOf(path),
    status: "local_only",
  };
}

async function hashBlob(blob) {
  const buffer = await blob.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function parentIdForPath(path) {
  const parent = dirname(path);
  return parent;
}

function dirname(path = "") {
  const parts = path.split("/").filter(Boolean);
  parts.pop();
  return parts.join("/");
}

function basename(path = "") {
  return path.split("/").filter(Boolean).pop() || "";
}

function joinPath(...parts) {
  return parts.filter(Boolean).join("/").replace(/\/+/g, "/");
}

function extensionOf(path = "") {
  const clean = basename(path).toLowerCase();
  const dot = clean.lastIndexOf(".");
  return dot > -1 ? clean.slice(dot + 1) : "";
}

function stripMarkdownExtension(value = "") {
  return String(value || "").replace(/\.(md|markdown|txt)$/i, "");
}

function safeSegment(value = "") {
  return String(value || "").replace(/[<>:"/\\|?*]+/g, "-").trim();
}

function safeFileName(value = "") {
  return safeSegment(value) || `asset-${Date.now()}`;
}

function sortTreeItems(items) {
  return [...items].sort((a, b) => {
    const aIsFolder = Boolean(a.directoryHandle);
    const bIsFolder = Boolean(b.directoryHandle);
    if (aIsFolder && !bIsFolder) return -1;
    if (!aIsFolder && bIsFolder) return 1;
    return (a.displayName || a.title || a.name || "").localeCompare(b.displayName || b.title || b.name || "", "es", { sensitivity: "base" });
  });
}
