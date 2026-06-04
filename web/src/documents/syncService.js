import {
  createDriveFolder,
  createDriveTextFile,
  downloadDriveBlob,
  getKnowledgeRootFolderId,
  listDriveChildren,
  readMarkdownFile,
  updateDriveBlob,
  updateDriveTextFile,
  uploadDriveAsset,
} from "./driveService";
import {
  exportWorkspace,
  getSyncStatus as getLocalSyncStatus,
  hasDirtyLocalChanges,
  importWorkspace,
  markAssetBackedUp,
  markWorkspaceRestored,
  markWorkspaceSynced,
  saveStorageSettings,
} from "./localDbService";
import { scanLocalWorkspace, updateLocalManifest } from "./localFileWorkspaceService";

const BACKUP_FOLDER_NAME = "AshramKnowledgeBackup";
const MANIFEST_FILE = "manifest.json";
const FOLDERS_FILE = "folders.json";
const DOCUMENTS_FILE = "documents.json";
const BACKUP_JSON_FILE = "backup.json";
const INDEX_JSON_FILE = "index.json";
const JSON_MIME = "application/json";

export async function backupToGoogleDrive() {
  const workspace = await exportWorkspace();
  const rootFolderId = getKnowledgeRootFolderId();
  console.info("Buscando carpeta AshramGanesha en Drive...", { rootFolderId });
  const backedUpAt = new Date().toISOString();
  const cleanFolders = workspace.folders.map(stripRuntimeFields);
  const cleanDocuments = workspace.documents.map(stripRuntimeFields);
  const manifest = {
    version: 1,
    workspaceId: workspace.workspace?.id || "ashram-workspace",
    updatedAt: backedUpAt,
    deviceId: getDeviceId(),
    foldersCount: cleanFolders.filter((folder) => !folder.deletedAt).length,
    documentsCount: cleanDocuments.filter((document) => !document.deletedAt).length,
  };

  await upsertJsonFile(rootFolderId, MANIFEST_FILE, manifest);
  await upsertJsonFile(rootFolderId, FOLDERS_FILE, cleanFolders);
  await upsertJsonFile(rootFolderId, DOCUMENTS_FILE, cleanDocuments);
  await upsertJsonFile(rootFolderId, INDEX_JSON_FILE, manifest);
  await upsertJsonFile(rootFolderId, BACKUP_JSON_FILE, buildIndexedDbBackupJson(workspace, manifest, backedUpAt));
  await uploadAssetsBackup(rootFolderId, workspace.assets, backedUpAt);
  await markWorkspaceSynced(backedUpAt);
  console.info("Sincronizacion con Google Drive completada", { rootFolderId });
  return { syncedAt: backedUpAt, manifest, backupFolder: { driveFileId: rootFolderId } };
}

export async function restoreFromGoogleDrive() {
  const downloaded = await downloadBackupFromDrive();
  if (!downloaded) return null;
  await restoreBackupToLocal(downloaded);
  return downloaded;
}

export async function downloadBackupFromDrive() {
  const rootFolderId = getKnowledgeRootFolderId();
  const fullBackup = await readJsonFromBackup(rootFolderId, BACKUP_JSON_FILE);
  if (fullBackup?.schema === "ashram-drive-backup-v1" && fullBackup.workspace) {
    return backupJsonToWorkspace(fullBackup, rootFolderId);
  }
  const [manifest, folders, documents] = await Promise.all([
    readJsonFromBackup(rootFolderId, MANIFEST_FILE),
    readJsonFromBackup(rootFolderId, FOLDERS_FILE),
    readJsonFromBackup(rootFolderId, DOCUMENTS_FILE),
  ]);
  if (!manifest || !folders || !documents) return null;
  return {
    schema: "ashram-documents-v1",
    provider: "google_drive",
    workspace: {
      id: manifest.workspaceId || "ashram-workspace",
      name: "Mis Documentos",
      rootFolderId,
      updatedAt: manifest.updatedAt,
      lastBackupAt: manifest.updatedAt,
    },
    manifest,
    folders,
    documents,
    assets: [],
    attachments: [],
    syncedAt: manifest.updatedAt,
  };
}

export async function restoreBackupToLocal(workspace) {
  await importWorkspace(workspace, { markSynced: true });
  await markWorkspaceRestored(workspace?.manifest?.updatedAt || workspace?.syncedAt || new Date().toISOString());
  return workspace;
}

export async function compareLocalAndDriveManifest() {
  const [local, remote] = await Promise.all([
    exportWorkspace(),
    downloadDriveManifest(),
  ]);
  return {
    localUpdatedAt: local.exportedAt,
    driveUpdatedAt: remote?.updatedAt || "",
    hasRemoteBackup: Boolean(remote),
    hasDirtyLocalChanges: await hasDirtyLocalChanges(),
    remote,
  };
}

export async function backupChangedFilesToDrive(rootHandle) {
  if (!rootHandle) return backupToGoogleDrive();
  if (navigator.onLine === false) {
    await saveStorageSettings({ pendingDriveSync: true });
    throw new Error("Sin conexion. Los cambios quedaron locales y se sincronizaran al recuperar internet.");
  }
  const rootFolderId = getKnowledgeRootFolderId();
  console.info("Buscando carpeta AshramGanesha en Drive...", { rootFolderId });
  const scan = await scanLocalWorkspace(rootHandle);
  const remoteTree = await readDriveFolderTree(rootFolderId);
  const remoteFilesByPath = new Map(flattenDriveFiles(remoteTree).map((file) => [file.path, file]));
  const previousFiles = new Map((scan.manifest?.files || []).map((file) => [file.path, file]));
  const drivePatch = {};
  let uploadedCount = 0;

  for (const folder of scan.folders) {
    console.info("Creando carpeta en Drive...", folder.path);
    await ensureDrivePath(rootFolderId, folder.path);
  }

  for (const document of scan.documents) {
    const file = await document.fileHandle.getFile();
    const hash = await hashBlob(file);
    const previous = previousFiles.get(document.path);
    const remoteFile = remoteFilesByPath.get(document.path);
    const driveFileId = previous?.driveFileId || remoteFile?.driveFileId || "";
    if (previous?.hash === hash && driveFileId) {
      drivePatch[document.path] = { driveFileId, status: "synced" };
      continue;
    }
    console.info("Subiendo archivo a Drive...", document.path);
    const parentFolderId = await ensureDrivePath(rootFolderId, dirname(document.path));
    const content = await file.text();
    const driveFile = driveFileId
      ? await updateDriveTextFile(driveFileId, content, "text/markdown")
      : await createDriveTextFile(parentFolderId, basename(document.path), content, "text/markdown");
    drivePatch[document.path] = { driveFileId: driveFile.driveFileId, status: "synced" };
    uploadedCount += 1;
  }

  for (const asset of scan.assets) {
    const file = await asset.fileHandle.getFile();
    const hash = await hashBlob(file);
    const previous = previousFiles.get(asset.path);
    const remoteFile = remoteFilesByPath.get(asset.path);
    const driveFileId = previous?.driveFileId || remoteFile?.driveFileId || "";
    if (previous?.hash === hash && driveFileId) {
      drivePatch[asset.path] = { driveFileId, status: "synced" };
      continue;
    }
    console.info("Subiendo archivo a Drive...", asset.path);
    const parentFolderId = await ensureDrivePath(rootFolderId, dirname(asset.path));
    const driveFile = driveFileId
      ? await updateDriveBlob(driveFileId, file, file.type || asset.mimeType || "application/octet-stream")
      : await uploadDriveAsset(parentFolderId, file, basename(asset.path));
    drivePatch[asset.path] = { driveFileId: driveFile.driveFileId, status: "synced" };
    uploadedCount += 1;
  }

  const backedUpAt = new Date().toISOString();
  await saveStorageSettings({ lastBackupAt: backedUpAt, driveConnected: true });
  const manifest = await updateLocalManifest(rootHandle, drivePatch);
  const index = {
    version: 1,
    workspaceId: "ashram-workspace",
    updatedAt: backedUpAt,
    deviceId: getDeviceId(),
    foldersCount: scan.folders.length,
    documentsCount: scan.documents.length,
    filesCount: manifest.files.length,
  };
  await upsertJsonFile(rootFolderId, MANIFEST_FILE, index);
  await upsertJsonFile(rootFolderId, "local-manifest.json", manifest);
  await upsertJsonFile(rootFolderId, INDEX_JSON_FILE, index);
  await upsertJsonFile(rootFolderId, BACKUP_JSON_FILE, await buildFileWorkspaceBackupJson(rootHandle, scan, manifest, backedUpAt));
  await saveStorageSettings({ pendingDriveSync: false });
  console.info("Sincronizacion con Google Drive completada", { uploadedCount, rootFolderId });
  return { syncedAt: backedUpAt, manifest, backupFolder: { driveFileId: rootFolderId }, uploadedCount };
}

export async function syncChangedFilesFromDrive(rootHandle, options = {}) {
  if (!rootHandle) return restoreFromGoogleDrive();
  if (navigator.onLine === false) {
    await saveStorageSettings({ pendingDriveSync: true });
    throw new Error("Sin conexion. Se intentara sincronizar cuando vuelva internet.");
  }
  return restoreDriveFolderToLocal(rootHandle, options);
}

export async function restoreDriveFolderToLocal(rootHandle, { onProgress } = {}) {
  if (!rootHandle) return restoreFromGoogleDrive();
  if (navigator.onLine === false) {
    await saveStorageSettings({ pendingDriveSync: true });
    throw new Error("Sin conexion. Se intentara sincronizar cuando vuelva internet.");
  }
  await ensureDirectoryWritePermission(rootHandle);
  console.info("Restauración iniciada");
  onProgress?.({ stage: "reading_drive", label: "Leyendo Google Drive..." });
  const rootFolderId = getKnowledgeRootFolderId();
  console.info("Buscando carpeta AshramGanesha en Drive...", { rootFolderId });
  const sourceFolderId = rootFolderId;
  const sourceFolderName = "AshramGanesha";
  const remoteTree = await readDriveFolderTree(sourceFolderId);
  const remoteFiles = flattenDriveFiles(remoteTree);
  const remoteFolders = flattenDriveFolders(remoteTree);
  console.info(`Carpetas encontradas: ${remoteFolders.length}`, remoteFolders.map((folder) => folder.path));
  console.info(`Archivos encontrados: ${remoteFiles.length}`, remoteFiles.map((file) => file.path));
  if (!remoteFiles.length && !remoteFolders.length) return null;

  onProgress?.({ stage: "folders", label: "Encontrando carpetas...", total: remoteFolders.length || 1, current: 0 });
  for (let index = 0; index < remoteFolders.length; index += 1) {
    const folder = remoteFolders[index];
    onProgress?.({
      stage: "folders",
      label: "Encontrando carpetas...",
      fileName: folder.path,
      total: remoteFolders.length,
      current: index + 1,
    });
    console.info("Creando carpeta local...", folder.path);
    await ensureDirectoryWritePermission(rootHandle);
    await getDirectoryByPath(rootHandle, folder.path);
  }

  onProgress?.({ stage: "downloading", label: "Descargando archivos", total: remoteFiles.length, current: 0 });
  const localScan = await scanLocalWorkspace(rootHandle);
  const localFiles = new Map((localScan.manifest?.files || []).map((file) => [file.path, file]));
  const drivePatch = {};
  let downloadedCount = 0;
  let keptLocalCount = 0;

  for (let index = 0; index < remoteFiles.length; index += 1) {
    const remoteFile = remoteFiles[index];
    onProgress?.({
      stage: "downloading",
      label: "Descargando archivos",
      fileName: remoteFile.path,
      total: remoteFiles.length,
      current: index + 1,
    });
    console.info("Descargando archivo...", remoteFile.path);
    await ensureDirectoryWritePermission(rootHandle);
    const localFile = await readLocalFileMeta(rootHandle, remoteFile.path) || localFiles.get(remoteFile.path);
    if (localFile && !isRemoteNewer(remoteFile, localFile)) {
      console.info("Conservando archivo local mas reciente...", remoteFile.path);
      drivePatch[remoteFile.path] = {
        driveFileId: remoteFile.driveFileId,
        status: "local_newer",
      };
      keptLocalCount += 1;
      continue;
    }
    const blob = await downloadDriveBlob(remoteFile.driveFileId, remoteFile.mimeType);
    console.info("Archivo descargado", remoteFile.path);
    await ensureDirectoryWritePermission(rootHandle);
    await writeBlobToLocalPath(rootHandle, remoteFile.path, blob);
    drivePatch[remoteFile.path] = {
      driveFileId: remoteFile.driveFileId,
      status: "synced",
    };
    downloadedCount += 1;
  }

  onProgress?.({ stage: "restoring", label: "Restaurando contenido..." });
  const syncedAt = new Date().toISOString();
  await saveStorageSettings({ lastSyncAt: syncedAt, driveConnected: true, pendingDriveSync: false });
  const manifest = await updateLocalManifest(rootHandle, drivePatch);
  const restoredScan = await scanLocalWorkspace(rootHandle);
  await importWorkspace(fileScanToWorkspace(restoredScan, {
    rootFolderId,
    sourceFolderId,
    sourceFolderName,
    syncedAt,
  }), { markSynced: true });
  await markWorkspaceRestored(syncedAt);
  console.info("Restauración finalizada", { downloadedCount, keptLocalCount, folders: remoteFolders.length, files: remoteFiles.length });
  onProgress?.({
    stage: "completed",
    label: "Completado",
    total: remoteFiles.length || 1,
    current: remoteFiles.length,
    foldersRestored: remoteFolders.length,
    filesRestored: remoteFiles.length,
  });
  return {
    manifest,
    downloadedCount,
    keptLocalCount,
    uploadedCount: 0,
    syncedAt,
    sourceFolderId,
    sourceFolderName,
    foldersCount: remoteFolders.length,
    filesCount: remoteFiles.length,
  };
}

export async function restoreDriveFolderToIndexedDb({ onProgress } = {}) {
  if (navigator.onLine === false) {
    await saveStorageSettings({ pendingDriveSync: true });
    throw new Error("Sin conexion. Se intentara sincronizar cuando vuelva internet.");
  }
  console.info("Restauración iniciada");
  onProgress?.({ stage: "reading_drive", label: "Leyendo Google Drive..." });
  const rootFolderId = getKnowledgeRootFolderId();
  console.info("Buscando carpeta AshramGanesha en Drive...", { rootFolderId });
  const remoteTree = await readDriveFolderTree(rootFolderId);
  const remoteFolders = flattenDriveFolders(remoteTree);
  const remoteFiles = flattenDriveFiles(remoteTree);
  console.info(`Carpetas encontradas: ${remoteFolders.length}`, remoteFolders.map((folder) => folder.path));
  console.info(`Archivos encontrados: ${remoteFiles.length}`, remoteFiles.map((file) => file.path));

  if (!remoteFiles.length && !remoteFolders.length) return null;

  onProgress?.({
    stage: "folders",
    label: "Encontrando carpetas...",
    current: remoteFolders.length,
    total: remoteFolders.length || 1,
    foldersRestored: remoteFolders.length,
    filesRestored: 0,
  });

  const documents = [];
  const assets = [];

  onProgress?.({ stage: "downloading", label: "Descargando archivos...", current: 0, total: remoteFiles.length || 1 });
  for (let index = 0; index < remoteFiles.length; index += 1) {
    const remoteFile = remoteFiles[index];
    onProgress?.({
      stage: "downloading",
      label: "Descargando archivos...",
      fileName: remoteFile.path,
      current: index + 1,
      total: remoteFiles.length,
      foldersRestored: remoteFolders.length,
      filesRestored: index,
    });
    console.info("Descargando archivo...", remoteFile.path);
    const blob = await downloadDriveBlob(remoteFile.driveFileId, remoteFile.mimeType);
    console.info("Archivo descargado", remoteFile.path);
    if (isMarkdownLike(remoteFile)) {
      documents.push(driveFileToDocument(remoteFile, await blob.text()));
    } else {
      assets.push({
        id: remoteFile.path,
        path: remoteFile.path,
        folderId: dirname(remoteFile.path),
        fileName: basename(remoteFile.path),
        title: basename(remoteFile.path),
        name: basename(remoteFile.path),
        type: fileTypeFromPath(remoteFile.path, remoteFile.mimeType),
        mimeType: blob.type || remoteFile.mimeType || "application/octet-stream",
        localBlob: blob,
        driveFileId: remoteFile.driveFileId,
        status: "backed_up",
        statusSync: "backed_up",
        syncStatus: "backed_up",
        dirty: false,
        updatedAt: remoteFile.modifiedAt || remoteFile.updatedAt || new Date().toISOString(),
      });
    }
  }

  onProgress?.({
    stage: "restoring",
    label: "Restaurando contenido...",
    current: remoteFiles.length,
    total: remoteFiles.length || 1,
    foldersRestored: remoteFolders.length,
    filesRestored: remoteFiles.length,
  });
  const syncedAt = new Date().toISOString();
  await importWorkspace({
    schema: "ashram-documents-v1",
    provider: "google_drive",
    workspace: {
      id: "ashram-workspace",
      name: "AshramGanesha",
      rootFolderId,
      sourceFolderId: rootFolderId,
      updatedAt: syncedAt,
      lastSyncAt: syncedAt,
      lastBackupAt: syncedAt,
    },
    manifest: {
      updatedAt: syncedAt,
      foldersCount: remoteFolders.length,
      filesCount: remoteFiles.length,
    },
    folders: remoteFolders.map((folder) => driveFolderToLocalFolder(folder, syncedAt)),
    documents,
    assets,
    attachments: [],
    meta: {},
    syncedAt,
  }, { markSynced: true });
  await saveStorageSettings({ lastSyncAt: syncedAt, driveConnected: true, pendingDriveSync: false, workspaceLocalPath: "IndexedDB local" });
  await markWorkspaceRestored(syncedAt);
  console.info("Restauración finalizada", { folders: remoteFolders.length, files: remoteFiles.length });
  onProgress?.({
    stage: "completed",
    label: "Completado",
    current: remoteFiles.length,
    total: remoteFiles.length || 1,
    foldersRestored: remoteFolders.length,
    filesRestored: remoteFiles.length,
  });
  return {
    syncedAt,
    downloadedCount: remoteFiles.length,
    keptLocalCount: 0,
    foldersCount: remoteFolders.length,
    filesCount: remoteFiles.length,
    indexedDbOnly: true,
  };
}

export async function restoreBackupJsonFromDrive(rootHandle) {
  if (!rootHandle) return restoreFromGoogleDrive();
  const rootFolderId = getKnowledgeRootFolderId();
  let backup = await readJsonFromBackup(rootFolderId, BACKUP_JSON_FILE);
  if (!backup) {
    const backupFolder = await findBackupFolder(rootFolderId);
    if (backupFolder?.driveFileId) backup = await readJsonFromBackup(backupFolder.driveFileId, BACKUP_JSON_FILE);
  }
  if (!backup?.files?.length) return null;
  await restoreBackupJsonToLocalFolder(rootHandle, backup);
  const syncedAt = backup.updatedAt || new Date().toISOString();
  await saveStorageSettings({ lastSyncAt: syncedAt, driveConnected: true, pendingDriveSync: false });
  const manifest = await updateLocalManifest(rootHandle, Object.fromEntries(backup.files.map((file) => [file.path, {
    driveFileId: file.driveFileId,
    status: "synced",
  }])));
  return { manifest, downloadedCount: backup.files.length, syncedAt };
}

export async function uploadWorkspace() {
  return backupToGoogleDrive();
}

export async function downloadWorkspace() {
  return restoreFromGoogleDrive();
}

export async function uploadBackupToDrive() {
  return backupToGoogleDrive();
}

export async function downloadBackupFromDriveOnly() {
  return downloadBackupFromDrive();
}

export async function syncDocument() {
  return backupToGoogleDrive();
}

export async function getSyncStatus() {
  return getLocalSyncStatus();
}

async function readDriveFolderTree(folderId, basePath = "") {
  const children = await listDriveChildren(folderId);
  const folders = [];
  const files = [];

  for (const child of children) {
    if (child.type === "folder") {
      folders.push({
        ...child,
        path: joinPath(basePath, child.name),
        children: await readDriveFolderTree(child.driveFileId, joinPath(basePath, child.name)),
      });
      continue;
    }
    if (!child.driveFileId) continue;
    files.push({
      ...child,
      path: joinPath(basePath, driveDownloadFileName(child)),
      modifiedAt: child.modifiedTime || child.updatedAt || child.modifiedAt || "",
    });
  }

  return { folders, files };
}

function flattenDriveFiles(tree) {
  const files = [...(tree?.files || [])];
  for (const folder of tree?.folders || []) {
    files.push(...flattenDriveFiles(folder.children));
  }
  return files
    .filter((file) => file.path && file.driveFileId)
    .sort((a, b) => a.path.localeCompare(b.path, "es", { sensitivity: "base" }));
}

function flattenDriveFolders(tree) {
  const folders = [];
  for (const folder of tree?.folders || []) {
    folders.push(folder);
    folders.push(...flattenDriveFolders(folder.children));
  }
  return folders
    .filter((folder) => folder.path)
    .sort((a, b) => a.path.localeCompare(b.path, "es", { sensitivity: "base" }));
}

function driveDownloadFileName(file) {
  const name = file?.name || file?.title || `archivo-${Date.now()}`;
  if (file?.mimeType === "application/vnd.google-apps.document" && !/\.[a-z0-9]{2,8}$/i.test(name)) {
    return `${name}.txt`;
  }
  return name;
}

function isMarkdownLike(file) {
  const name = `${file?.path || file?.name || ""}`.toLowerCase();
  return file?.type === "markdown" || file?.type === "text" || file?.mimeType === "text/markdown" || file?.mimeType === "text/plain" || name.endsWith(".md") || name.endsWith(".txt");
}

function driveFileToDocument(file, contentMarkdown) {
  const title = basename(file.path).replace(/\.(md|txt)$/i, "");
  return {
    id: file.path,
    path: file.path,
    folderId: dirname(file.path),
    title,
    name: basename(file.path),
    displayName: title,
    contentMarkdown,
    blocks: [],
    mode: "document",
    type: "markdown",
    mimeType: "text/markdown",
    icon: "document",
    color: "#6c6840",
    iconColor: "#6c6840",
    driveFileId: file.driveFileId,
    status: "backed_up",
    statusSync: "backed_up",
    syncStatus: "backed_up",
    dirty: false,
    createdAt: file.modifiedAt || file.updatedAt || new Date().toISOString(),
    updatedAt: file.modifiedAt || file.updatedAt || new Date().toISOString(),
  };
}

function driveFolderToLocalFolder(folder, syncedAt) {
  return {
    id: folder.path,
    path: folder.path,
    workspaceId: "ashram-workspace",
    parentId: dirname(folder.path) || null,
    title: basename(folder.path),
    name: basename(folder.path),
    displayName: basename(folder.path),
    icon: "folder",
    color: "#d9a51f",
    iconColor: "#d9a51f",
    driveFileId: folder.driveFileId,
    status: "backed_up",
    statusSync: "backed_up",
    syncStatus: "backed_up",
    dirty: false,
    createdAt: folder.modifiedAt || syncedAt,
    updatedAt: folder.modifiedAt || syncedAt,
  };
}

function fileTypeFromPath(path = "", mimeType = "") {
  if (mimeType.includes("image/")) return "image";
  if (mimeType.includes("audio/")) return "audio";
  if (mimeType.includes("video/")) return "video";
  if (mimeType.includes("pdf") || path.toLowerCase().endsWith(".pdf")) return "pdf";
  return basename(path).split(".").pop()?.toLowerCase() || "asset";
}

async function readLocalFileMeta(rootHandle, path) {
  try {
    const directory = await getDirectoryByPath(rootHandle, dirname(path));
    const handle = await directory.getFileHandle(basename(path));
    const file = await handle.getFile();
    return {
      path,
      hash: await hashBlob(file),
      modifiedAt: new Date(file.lastModified).toISOString(),
    };
  } catch {
    return null;
  }
}

function fileScanToWorkspace(scan, { rootFolderId, sourceFolderId, sourceFolderName, syncedAt }) {
  return {
    schema: "ashram-documents-v1",
    provider: "google_drive",
    workspace: {
      id: "ashram-workspace",
      name: sourceFolderName || "Mis Documentos",
      rootFolderId,
      sourceFolderId,
      updatedAt: syncedAt,
      lastSyncAt: syncedAt,
      lastBackupAt: syncedAt,
    },
    manifest: scan.manifest || { updatedAt: syncedAt },
    folders: (scan.folders || []).map(stripRuntimeFields),
    documents: (scan.documents || []).map((document) => ({
      ...stripRuntimeFields(document),
      status: "backed_up",
      statusSync: "backed_up",
      syncStatus: "backed_up",
      dirty: false,
      lastSyncedAt: syncedAt,
      lastBackupAt: syncedAt,
    })),
    assets: (scan.assets || []).map((asset) => ({
      ...stripRuntimeFields(asset),
      status: "backed_up",
      statusSync: "backed_up",
      syncStatus: "backed_up",
      dirty: false,
      lastSyncedAt: syncedAt,
      lastBackupAt: syncedAt,
    })),
    attachments: [],
    meta: {},
    syncedAt,
  };
}

async function uploadAssetsBackup(backupFolderId, assets = [], backedUpAt) {
  const validAssets = assets.filter((asset) => asset.localBlob);
  if (!validAssets.length) return [];
  const uploaded = [];
  for (const asset of validAssets) {
    const driveItem = await uploadDriveAsset(backupFolderId, asset.localBlob, asset.fileName);
    uploaded.push(driveItem);
    await markAssetBackedUp(asset.id, { driveFileId: driveItem.driveFileId, lastBackupAt: backedUpAt });
  }
  return uploaded;
}

async function readJsonFromBackup(backupFolderId, fileName) {
  const file = await findFileByName(backupFolderId, fileName);
  if (!file?.driveFileId) return null;
  const text = await readMarkdownFile(file.driveFileId, file.mimeType || JSON_MIME);
  return JSON.parse(text);
}

async function buildFileWorkspaceBackupJson(rootHandle, scan, manifest, updatedAt) {
  const files = [];
  for (const item of [...(scan.documents || []), ...(scan.assets || [])]) {
    const file = await item.fileHandle.getFile();
    const isText = item.path.toLowerCase().endsWith(".md") || file.type.startsWith("text/");
    const manifestFile = (manifest.files || []).find((entry) => entry.path === item.path) || {};
    files.push({
      path: item.path,
      type: item.path.toLowerCase().endsWith(".md") ? "markdown" : "asset",
      mimeType: file.type || item.mimeType || "application/octet-stream",
      hash: manifestFile.hash || await hashBlob(file),
      modifiedAt: new Date(file.lastModified).toISOString(),
      driveFileId: manifestFile.driveFileId || "",
      encoding: isText ? "text" : "base64",
      content: isText ? await file.text() : await blobToBase64(file),
    });
  }
  return {
    schema: "ashram-drive-backup-v1",
    version: 1,
    app: "myashram",
    platform: "web-android-compatible",
    workspaceName: manifest.workspaceName || rootHandle.name || "Ashram Ganesha",
    workspaceId: "ashram-workspace",
    updatedAt,
    deviceId: getDeviceId(),
    manifest,
    folders: scan.folders.map(stripRuntimeFields),
    documents: scan.documents.map(stripRuntimeFields),
    assets: scan.assets.map(stripRuntimeFields),
    files,
  };
}

function buildIndexedDbBackupJson(workspace, manifest, updatedAt) {
  return {
    schema: "ashram-drive-backup-v1",
    version: 1,
    app: "myashram",
    platform: "web-android-compatible",
    workspaceId: workspace.workspace?.id || "ashram-workspace",
    workspace: workspace.workspace,
    updatedAt,
    deviceId: getDeviceId(),
    manifest,
    folders: workspace.folders || [],
    documents: workspace.documents || [],
    assets: workspace.assets || [],
    attachments: workspace.attachments || [],
    meta: workspace.meta || {},
    files: (workspace.documents || []).map((document) => ({
      path: document.path || `${document.title || document.id}.md`,
      type: "markdown",
      mimeType: "text/markdown",
      modifiedAt: document.updatedAt || updatedAt,
      driveFileId: document.driveFileId || "",
      encoding: "text",
      content: document.contentMarkdown || "",
    })),
  };
}

function backupJsonToWorkspace(backup, rootFolderId) {
  return {
    schema: "ashram-documents-v1",
    provider: "google_drive",
    workspace: {
      id: backup.workspaceId || backup.workspace?.id || "ashram-workspace",
      name: backup.workspaceName || backup.workspace?.name || "Mis Documentos",
      rootFolderId,
      updatedAt: backup.updatedAt,
      lastBackupAt: backup.updatedAt,
    },
    manifest: backup.manifest || { updatedAt: backup.updatedAt },
    folders: backup.folders || [],
    documents: backup.documents?.length ? backup.documents : backup.files?.filter((file) => file.type === "markdown").map((file) => ({
      id: file.path,
      title: basename(file.path).replace(/\.md$/i, ""),
      name: basename(file.path),
      displayName: basename(file.path).replace(/\.md$/i, ""),
      folderId: dirname(file.path),
      contentMarkdown: file.content || "",
      updatedAt: file.modifiedAt || backup.updatedAt,
      type: "markdown",
      mimeType: "text/markdown",
    })) || [],
    assets: backup.assets || [],
    attachments: backup.attachments || [],
    meta: backup.meta || {},
    syncedAt: backup.updatedAt,
  };
}

async function restoreBackupJsonToLocalFolder(rootHandle, backup) {
  for (const file of backup.files || []) {
    const blob = file.encoding === "base64"
      ? base64ToBlob(file.content || "", file.mimeType || "application/octet-stream")
      : new Blob([file.content || ""], { type: file.mimeType || "text/plain" });
    await writeBlobToLocalPath(rootHandle, file.path, blob);
  }
}

async function downloadDriveManifest() {
  const rootFolderId = getKnowledgeRootFolderId();
  return readJsonFromBackup(rootFolderId, MANIFEST_FILE);
}

async function ensureBackupFolder(rootFolderId) {
  const existing = await findBackupFolder(rootFolderId);
  if (existing?.driveFileId) return existing;
  return createDriveFolder(rootFolderId, BACKUP_FOLDER_NAME);
}

async function findBackupFolder(rootFolderId) {
  const children = await listDriveChildren(rootFolderId);
  return children.find((item) => item.type === "folder" && item.name === BACKUP_FOLDER_NAME) || null;
}

async function upsertJsonFile(parentFolderId, fileName, value) {
  const content = JSON.stringify(value, null, 2);
  const existing = await findFileByName(parentFolderId, fileName);
  return existing?.driveFileId
    ? updateDriveTextFile(existing.driveFileId, content, JSON_MIME)
    : createDriveTextFile(parentFolderId, fileName, content, JSON_MIME);
}

async function findFileByName(parentFolderId, fileName) {
  const children = await listDriveChildren(parentFolderId);
  return children.find((item) => item.type !== "folder" && item.name === fileName) || null;
}

async function ensureDrivePath(rootFolderId, path = "") {
  const parts = path.split("/").filter(Boolean);
  let parentId = rootFolderId;
  for (const part of parts) {
    const children = await listDriveChildren(parentId);
    const existing = children.find((item) => item.type === "folder" && item.name === part);
    parentId = existing?.driveFileId || (await createDriveFolder(parentId, part)).driveFileId;
  }
  return parentId;
}

async function hashBlob(blob) {
  const buffer = await blob.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function isRemoteNewer(remoteFile, localFile) {
  const remoteTime = Date.parse(remoteFile.modifiedAt || remoteFile.updatedAt || remoteFile.lastBackupAt || 0) || 0;
  const localTime = Date.parse(localFile.modifiedAt || localFile.updatedAt || 0) || 0;
  return remoteTime >= localTime;
}

async function blobToBase64(blob) {
  const buffer = await blob.arrayBuffer();
  let binary = "";
  const bytes = new Uint8Array(buffer);
  for (let index = 0; index < bytes.length; index += 1) binary += String.fromCharCode(bytes[index]);
  return btoa(binary);
}

function base64ToBlob(base64, mimeType) {
  const binary = atob(base64 || "");
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return new Blob([bytes], { type: mimeType });
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

async function writeBlobToLocalPath(rootHandle, path, blob) {
  await ensureDirectoryWritePermission(rootHandle);
  const directory = await getDirectoryByPath(rootHandle, dirname(path));
  const handle = await directory.getFileHandle(basename(path), { create: true });
  const writable = await handle.createWritable();
  await writable.write(blob);
  await writable.close();
}

async function getDirectoryByPath(rootHandle, path = "") {
  await ensureDirectoryWritePermission(rootHandle);
  const parts = path.split("/").filter(Boolean);
  let current = rootHandle;
  for (const part of parts) {
    current = await current.getDirectoryHandle(part, { create: true });
  }
  return current;
}

async function ensureDirectoryWritePermission(directoryHandle) {
  if (!directoryHandle?.requestPermission) return true;
  const options = { mode: "readwrite" };
  let permission = "prompt";
  try {
    permission = await directoryHandle.queryPermission?.(options);
  } catch (error) {
    throw localPermissionError(error);
  }
  if (permission !== "granted") {
    try {
      permission = await directoryHandle.requestPermission(options);
    } catch (error) {
      throw localPermissionError(error);
    }
  }
  if (permission !== "granted") {
    throw new Error("Permiso denegado para escribir en la carpeta local. Seleccioná nuevamente la carpeta local para restaurar.");
  }
  return true;
}

function localPermissionError(error) {
  const message = error?.message || "";
  if (message.includes("state cached in an interface object") || error?.name === "NotAllowedError") {
    return new Error("Seleccioná nuevamente la carpeta local para restaurar.");
  }
  return error;
}

function stripRuntimeFields(item) {
  const { localBlob, localUrl, fileHandle, directoryHandle, webViewLink, webContentLink, thumbnailLink, ...clean } = item;
  return clean;
}

function getDeviceId() {
  const key = "ashram_knowledge_device_id";
  const existing = localStorage.getItem(key);
  if (existing) return existing;
  const next = crypto.randomUUID?.() || `device_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  localStorage.setItem(key, next);
  return next;
}
