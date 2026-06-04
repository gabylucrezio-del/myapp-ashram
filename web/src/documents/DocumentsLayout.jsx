import { Cloud, FolderOpen, RefreshCw, Settings, Upload } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ConfirmDeleteModal from "./ConfirmDeleteModal";
import DocumentEditor from "./DocumentEditor";
import MobileFolderDrawer from "./MobileFolderDrawer";
import RenameIconModal from "./RenameIconModal";
import SidebarTree from "./SidebarTree";
import SyncStatusBadge from "./SyncStatusBadge";
import {
  deleteDocument,
  deleteFolder,
  exportLocalWorkspace,
  getDocuments,
  getDirectoryHandle,
  getFolders,
  getStorageSettings,
  getSyncStatus,
  getWorkspace,
  hasDirtyLocalChanges,
  initLocalDb,
  saveAssetLocal,
  saveContentExport,
  saveDirectoryHandle,
  saveDocument,
  saveFolder,
  saveStorageSettings,
  updateDocument,
} from "./localDbService";
import {
  getGoogleDriveConnectionStatus,
  getKnowledgeRootFolderId,
  googleDriveSetupMessage,
  isGoogleDriveConfigured,
  restoreDriveSession,
  selectKnowledgeRootFolder,
  signInGoogle,
  signOutGoogle,
} from "./driveService";
import {
  buildTreeFromLocalFolder,
  copyImageToLocalAssets,
  createLocalFolder,
  createLocalMarkdownFile,
  deleteLocalItem,
  moveLocalMarkdownFile,
  readLocalMarkdownFile,
  renameLocalItem,
  restoreLocalFolderHandle,
  scanLocalWorkspace,
  selectLocalWorkspaceFolder,
  verifyDirectoryWritePermission,
  writeLocalMarkdownFile,
} from "./localFileWorkspaceService";
import { publishToFirebase } from "./publishedContentService";
import { backupChangedFilesToDrive, backupToGoogleDrive, restoreBackupJsonFromDrive, restoreFromGoogleDrive, restoreDriveFolderToIndexedDb, syncChangedFilesFromDrive } from "./syncService";

const LAST_DOCUMENT_KEY = "ashram_last_drive_document_id";

export default function DocumentsLayout({ onBackToAdminPanel, onToast }) {
  const [folders, setFolders] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [activeFolderId, setActiveFolderId] = useState("");
  const [activeDocumentId, setActiveDocumentId] = useState("");
  const [activeDocumentPath, setActiveDocumentPath] = useState("");
  const [openedLocalDocument, setOpenedLocalDocument] = useState(null);
  const [expandedFolderIds, setExpandedFolderIds] = useState([]);
  const [search, setSearch] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [syncStatus, setSyncStatus] = useState({ status: "local", label: "Guardado localmente" });
  const [busy, setBusy] = useState(false);
  const [driveRootFolderId, setDriveRootFolderId] = useState(() => getKnowledgeRootFolderId());
  const [driveConfigured] = useState(() => isGoogleDriveConfigured());
  const [driveStatus, setDriveStatus] = useState(() => getGoogleDriveConnectionStatus());
  const [driveError, setDriveError] = useState("");
  const [restoreProgress, setRestoreProgress] = useState(null);
  const [storageSettings, setStorageSettings] = useState(() => readStorageSettingsFallback());
  const [workspaceInfo, setWorkspaceInfo] = useState(null);
  const [storageConfigOpen, setStorageConfigOpen] = useState(false);
  const [mobileConfigOpen, setMobileConfigOpen] = useState(false);
  const [workspaceFolderHandle, setWorkspaceFolderHandle] = useState(null);
  const [renameTarget, setRenameTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isMobile, setIsMobile] = useState(() => window.matchMedia?.("(max-width: 767px)")?.matches ?? false);
  const openDocumentRequestRef = useRef(0);

  const indexedActiveDocument = documents.find((document) =>
    (activeDocumentPath && document.path === activeDocumentPath) || document.id === activeDocumentId
  ) || null;
  const activeDocument = openedLocalDocument?.path && openedLocalDocument.path === activeDocumentPath
    ? openedLocalDocument
    : indexedActiveDocument;
  const activeFolder = folders.find((folder) => folder.id === activeFolderId) || null;
  const internalLinkDocuments = useMemo(
    () => getAllMarkdownDocumentsFromTree(null, folders, documents),
    [folders, documents],
  );
  const selectedItem = activeDocument
    ? { type: "document", ...activeDocument }
    : activeFolder
      ? { type: "folder", ...activeFolder }
      : { type: "workspace", id: "ashram" };

  const refresh = useCallback(async () => {
    await initLocalDb();
    const [nextSync, nextSettings, nextWorkspace] = await Promise.all([
      getSyncStatus(),
      getStorageSettings(),
      getWorkspace(),
    ]);
    const restoredHandle = await restoreLocalFolderHandle();
    if (restoredHandle) {
      setStorageSettings(nextSettings);
      setWorkspaceInfo(nextWorkspace);
      await refreshLocalTreeFromDisk({ handle: restoredHandle });
      return;
    }
    const [nextFolders, nextDocuments] = await Promise.all([
      getFolders(),
      getDocuments(),
    ]);
    setFolders(sortFolders(nextFolders));
    setDocuments(sortDocuments(nextDocuments));
    setSyncStatus(nextSync);
    setStorageSettings(nextSettings);
    setWorkspaceInfo(nextWorkspace);
    setActiveFolderId((current) => current && nextFolders.some((folder) => folder.id === current) ? current : "");
    setActiveDocumentId((current) => current && nextDocuments.some((document) => document.id === current) ? current : "");
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const mediaQuery = window.matchMedia?.("(max-width: 767px)");
    if (!mediaQuery) return undefined;
    const handleChange = () => setIsMobile(mediaQuery.matches);
    handleChange();
    mediaQuery.addEventListener?.("change", handleChange);
    return () => mediaQuery.removeEventListener?.("change", handleChange);
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia?.("(max-width: 1024px)");
    if (!mediaQuery) return undefined;
    let resizeObserver;

    function updateHeaderHeight() {
      if (!mediaQuery.matches) return;
      const header = document.querySelector(".app-header") || document.querySelector(".topbar");
      const headerHeight = header?.offsetHeight || 80;
      document.documentElement.style.setProperty("--app-header-height", `${headerHeight}px`);
    }

    updateHeaderHeight();
    const header = document.querySelector(".app-header") || document.querySelector(".topbar");
    if (window.ResizeObserver && header) {
      resizeObserver = new ResizeObserver(updateHeaderHeight);
      resizeObserver.observe(header);
    }
    window.addEventListener("resize", updateHeaderHeight);
    mediaQuery.addEventListener?.("change", updateHeaderHeight);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener("resize", updateHeaderHeight);
      mediaQuery.removeEventListener?.("change", updateHeaderHeight);
    };
  }, []);

  useEffect(() => {
    if (activeDocumentPath || activeDocumentId || !documents.length) return;
    const lastId = localStorage.getItem(LAST_DOCUMENT_KEY);
    const fallback = documents.find((document) => document.editable !== false) || documents[0];
    const next = documents.find((document) => document.path === lastId || document.id === lastId) || fallback;
    if (next?.path || next?.id) selectDocument(next.path || next.id);
  }, [documents, activeDocumentPath, activeDocumentId]);

  useEffect(() => {
    if (!driveConfigured || getGoogleDriveConnectionStatus() !== "connected") return;
    setDriveStatus("connected");
  }, [driveConfigured]);

  useEffect(() => {
    if (!driveConfigured || getGoogleDriveConnectionStatus() === "connected") return;
    let cancelled = false;
    restoreDriveSession()
      .then((token) => {
        if (cancelled || !token) return;
        setDriveStatus("connected");
      })
      .catch(() => {
        if (!cancelled) setDriveStatus("disconnected");
      });
    return () => {
      cancelled = true;
    };
  }, [driveConfigured]);

  useEffect(() => {
    if (!storageSettings.autoSyncDrive || driveStatus !== "connected" || !workspaceFolderHandle) return undefined;
    let running = false;
    const syncWhenOnline = async () => {
      if (running || navigator.onLine === false) return;
      running = true;
      try {
        await restoreLocalBackupFromDrive({ silent: true, auto: true });
      } finally {
        running = false;
      }
    };
    window.addEventListener("online", syncWhenOnline);
    if (storageSettings.pendingDriveSync) window.setTimeout(syncWhenOnline, 500);
    return () => window.removeEventListener("online", syncWhenOnline);
  }, [storageSettings.autoSyncDrive, storageSettings.pendingDriveSync, driveStatus, workspaceFolderHandle]);

  const visibleDocuments = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return documents;
    return documents.filter((document) =>
      `${document.title || ""} ${document.contentMarkdown || ""}`.toLowerCase().includes(query),
    );
  }, [documents, search]);

  async function createFolder(parentIdOverride) {
    const parentId = parentIdOverride === undefined ? getTargetParentId(selectedItem) : parentIdOverride;
    const title = window.prompt("Nombre de la carpeta");
    if (!title?.trim()) return;
    try {
      if (workspaceFolderHandle) {
        const folder = await createLocalFolder(workspaceFolderHandle, localPathForFolderId(parentId), title.trim());
        await refreshTreeAfterChange({
          nextActiveFolderId: folder.id,
          nextActiveDocumentId: "",
          openFolderIds: [...ancestorFolderIds(folders, parentId), parentId, folder.id],
        });
        onToast?.("Carpeta creada localmente.");
        return;
      }
      const folder = await saveFolder({
        id: localDocumentId("folder"),
        title: title.trim(),
        parentId: parentId || null,
        statusSync: "pending_upload",
        syncStatus: "pending_upload",
      });
      setFolders((current) => sortFolders([...current.filter((item) => item.id !== folder.id), folder]));
      setActiveFolderId(folder.id);
      setActiveDocumentId("");
      setExpandedFolderIds((current) => uniqueIds([...current, ...ancestorFolderIds(folders, parentId), parentId, folder.id]));
      setSyncStatus(await getSyncStatus());
      onToast?.("Carpeta creada localmente.");
    } catch (error) {
      showDriveError(error);
    }
  }

  async function createDocument(folderIdOverride, title = "") {
    const folderId = folderIdOverride === undefined ? getTargetFolderIdForDocument(selectedItem) : folderIdOverride;
    const name = title || window.prompt("Titulo del documento", "Nuevo documento");
    if (!name?.trim()) return null;
    try {
      const cleanName = name.trim();
      if (workspaceFolderHandle) {
        const document = await createLocalMarkdownFile(workspaceFolderHandle, localPathForFolderId(folderId), cleanName);
        const freshTree = await refreshTreeAfterChange({
          nextActiveFolderId: document.folderId || "",
          nextActiveDocumentPath: document.path,
          openFolderIds: [...ancestorFolderIds(folders, folderId || ""), folderId || ""],
        });
        await openDocumentByPath(document.path, freshTree?.documents);
        setDrawerOpen(false);
        onToast?.("Documento creado localmente.");
        return document;
      }
      const document = await saveDocument({
        id: localDocumentId("doc"),
        folderId: folderId || "",
        name: `${cleanName}.md`,
        displayName: cleanName,
        title: `${cleanName}.md`,
        contentMarkdown: `# ${cleanName}\n\n`,
        blocks: [],
        type: "markdown",
        driveType: "markdown",
        mimeType: "text/markdown",
        statusSync: "pending_upload",
        syncStatus: "pending_upload",
      });
      setDocuments((current) => sortDocuments([document, ...current.filter((item) => item.id !== document.id)]));
      setActiveFolderId(folderId || "");
      setActiveDocumentId(document.id);
      setExpandedFolderIds((current) => uniqueIds([...current, ...ancestorFolderIds(folders, folderId || ""), folderId || ""]));
      setDrawerOpen(false);
      setSyncStatus(await getSyncStatus());
      onToast?.("Documento creado localmente.");
      return document;
    } catch (error) {
      showDriveError(error);
      return null;
    }
  }

  async function refreshTreeAfterChange({
    handle = workspaceFolderHandle,
    keepActiveDocument = true,
    nextActiveFolderId,
    nextActiveDocumentId,
    nextActiveDocumentPath,
    openFolderIds = [],
  } = {}) {
    if (handle) {
      return refreshLocalTreeFromDisk({
        handle,
        keepActiveDocument,
        nextActiveFolderId,
        nextActiveDocumentId,
        nextActiveDocumentPath,
        openFolderIds,
      });
    }
    const [nextFolders, nextDocuments, nextSync] = await Promise.all([getFolders(), getDocuments(), getSyncStatus()]);
    setFolders(sortFolders(nextFolders));
    setDocuments(sortDocuments(nextDocuments));
    setSyncStatus(nextSync);
    if (nextActiveFolderId !== undefined) setActiveFolderId(nextActiveFolderId);
    if (nextActiveDocumentId !== undefined) setActiveDocumentId(nextActiveDocumentId);
    setExpandedFolderIds((current) => uniqueIds([...current, ...openFolderIds.filter(Boolean)]));
    if (keepActiveDocument) {
      setActiveDocumentId((current) => {
        const candidate = nextActiveDocumentId !== undefined ? nextActiveDocumentId : current;
        return candidate && !nextDocuments.some((document) => document.id === candidate) ? "" : candidate;
      });
    }
  }

  async function refreshLocalTreeFromDisk({
    handle = workspaceFolderHandle,
    keepActiveDocument = true,
    nextActiveFolderId,
    nextActiveDocumentId,
    nextActiveDocumentPath,
    openFolderIds = [],
  } = {}) {
    if (!handle) return null;
    const scan = await scanLocalWorkspace(handle);
    const freshTree = buildTreeFromLocalFolder(scan);
    const nextFolders = sortFolders(freshTree.folders);
    const nextDocuments = sortDocuments(freshTree.documents);
    setWorkspaceFolderHandle(handle);
    setFolders(nextFolders);
    setDocuments(nextDocuments);
    setSyncStatus({ status: "local_only", label: "Guardado localmente" });
    setActiveFolderId((current) => {
      if (nextActiveFolderId !== undefined) return nextActiveFolderId;
      return current && nextFolders.some((folder) => folder.id === current) ? current : "";
    });
    const targetDocument = nextActiveDocumentPath !== undefined
      ? nextDocuments.find((document) => document.path === nextActiveDocumentPath)
      : nextActiveDocumentId !== undefined
        ? nextDocuments.find((document) => document.id === nextActiveDocumentId)
        : keepActiveDocument
          ? nextDocuments.find((document) => document.id === activeDocumentId || document.path === activeDocumentPath)
          : null;
    setActiveDocumentPath(targetDocument?.path || "");
    setActiveDocumentId(targetDocument?.id || "");
    setOpenedLocalDocument((current) => current?.path === targetDocument?.path ? current : null);
    setExpandedFolderIds((current) => uniqueIds([...current, ...openFolderIds.filter(Boolean)]));
    return { folders: nextFolders, documents: nextDocuments, assets: freshTree.assets || [] };
  }

  async function refreshDriveTreeFromDrive({ silent = false } = {}) {
    await restoreLocalBackupFromDrive({ silent });
  }

  async function renameFolder(folder, focus = "name") {
    setRenameTarget({ type: "folder", item: folder, focus });
  }

  async function updateFolderMetadata(folder) {
    const nextFolder = {
      ...folder,
      title: folder.title,
      icon: folder.icon || "folder",
      color: folder.color || folder.iconColor || "#d9a51f",
      iconColor: folder.color || folder.iconColor || "#d9a51f",
    };
    if (workspaceFolderHandle && nextFolder.path) {
      const saved = await renameLocalItem(workspaceFolderHandle, nextFolder, nextFolder.title);
      await refreshLocalTreeFromDisk({
        nextActiveFolderId: saved?.id || nextFolder.id,
        nextActiveDocumentId: "",
        openFolderIds: saved?.id ? [...ancestorFolderIds(folders, saved.parentId), saved.id] : [],
      });
      setRenameTarget(null);
      onToast?.("Carpeta actualizada.");
      return;
    }
    setFolders((current) => sortFolders(current.map((item) => item.id === nextFolder.id ? { ...item, ...nextFolder } : item)));
    const saved = await saveFolder({ ...nextFolder, statusSync: "pending_upload", syncStatus: "pending_upload" });
    setFolders((current) => sortFolders(current.map((item) => item.id === saved.id ? { ...item, ...saved } : item)));
    setSyncStatus(await getSyncStatus());
    setRenameTarget(null);
    onToast?.("Carpeta actualizada.");
  }

  async function renameDocument(document, focus = "name") {
    setRenameTarget({ type: "document", item: document, focus });
  }

  async function updateDocumentMetadata(document) {
    const nextDocument = {
      ...document,
      title: document.title,
      icon: document.icon || "document",
      color: document.color || document.iconColor || "#6c6840",
      iconColor: document.color || document.iconColor || "#6c6840",
    };
    if (workspaceFolderHandle && nextDocument.path) {
      const saved = await renameLocalItem(workspaceFolderHandle, nextDocument, nextDocument.title);
      await refreshLocalTreeFromDisk({
        nextActiveFolderId: saved?.folderId || nextDocument.folderId || "",
        nextActiveDocumentPath: saved?.path || nextDocument.path,
        openFolderIds: saved?.folderId ? ancestorFolderIds(folders, saved.folderId) : [],
      });
      setRenameTarget(null);
      onToast?.("Documento actualizado.");
      return;
    }
    setDocuments((current) => sortDocuments(current.map((item) => item.id === nextDocument.id ? { ...item, ...nextDocument } : item)));
    const saved = await updateDocument(nextDocument.id, { title: nextDocument.title, icon: nextDocument.icon, color: nextDocument.color, iconColor: nextDocument.iconColor, statusSync: "pending_upload", syncStatus: "pending_upload" });
    if (saved) setDocuments((current) => sortDocuments(current.map((item) => item.id === saved.id ? { ...item, ...saved } : item)));
    setSyncStatus(await getSyncStatus());
    setRenameTarget(null);
    onToast?.("Documento actualizado.");
  }

  async function moveDocumentToFolder(document, targetFolderId = "") {
    if (!document) return;
    const currentFolderId = document.folderId || "";
    const nextFolderId = targetFolderId || "";
    if (currentFolderId === nextFolderId) return;

    if (workspaceFolderHandle && document.path) {
      try {
        const moved = await moveLocalMarkdownFile(workspaceFolderHandle, document, localPathForFolderId(nextFolderId));
        await refreshLocalTreeFromDisk({
          nextActiveFolderId: moved?.folderId || nextFolderId,
          nextActiveDocumentPath: moved?.path || "",
          openFolderIds: nextFolderId ? [...ancestorFolderIds(folders, nextFolderId), nextFolderId] : [],
        });
        onToast?.("Documento movido.");
      } catch (error) {
        onToast?.(`No pude mover el documento: ${error.message}`);
      }
      return;
    }

    const optimistic = {
      ...document,
      folderId: nextFolderId,
      statusSync: "pending_upload",
      syncStatus: "pending_upload",
    };
    setDocuments((current) => sortDocuments(current.map((item) => item.id === document.id ? optimistic : item)));
    const saved = await updateDocument(document.id, {
      folderId: nextFolderId,
      statusSync: "pending_upload",
      syncStatus: "pending_upload",
    });
    if (saved) {
      setDocuments((current) => sortDocuments(current.map((item) => item.id === saved.id ? { ...item, ...saved } : item)));
      if (activeDocumentId === saved.id) setActiveFolderId(saved.folderId || "");
    }
    setExpandedFolderIds((current) => uniqueIds([...current, ...ancestorFolderIds(folders, nextFolderId), nextFolderId]));
    setSyncStatus(await getSyncStatus());
    onToast?.("Documento movido.");
  }

  function validateFolderDelete(folder) {
    const folderIds = new Set([folder.id, ...descendantFolderIds(folders, folder.id)]);
    const childFolders = folders.filter((item) => folderIds.has(item.id) && item.id !== folder.id);
    const childDocuments = documents.filter((item) => folderIds.has(item.folderId));
    return {
      folderIds,
      childFolders,
      childDocuments,
      title: "Eliminar carpeta",
      message: `Eliminar la carpeta "${folder.title}"?`,
      details: childFolders.length || childDocuments.length
        ? `Tambien se eliminaran ${childFolders.length} subcarpetas y ${childDocuments.length} documentos.`
        : "Esta carpeta no contiene elementos internos.",
    };
  }

  function validateDocumentDelete(document) {
    return {
      title: "Eliminar documento",
      message: `Eliminar el documento "${document.title || "Sin titulo"}"?`,
      details: "Esta accion tambien elimina sus links adjuntos locales.",
    };
  }

  function requestDeleteFolder(folder) {
    setDeleteTarget({ type: "folder", item: folder, validation: validateFolderDelete(folder) });
  }

  function requestDeleteDocument(document) {
    setDeleteTarget({ type: "document", item: document, validation: validateDocumentDelete(document) });
  }

  async function removeFolder(folder) {
    const validation = validateFolderDelete(folder);
    if (workspaceFolderHandle && folder.path) {
      await deleteLocalItem(workspaceFolderHandle, folder);
      await refreshLocalTreeFromDisk({
        keepActiveDocument: false,
        nextActiveFolderId: "",
        nextActiveDocumentId: "",
      });
      setDeleteTarget(null);
      onToast?.("Carpeta eliminada.");
      return;
    }
    await deleteFolder(folder.id);
    const { folderIds } = validation;
    setFolders((current) => current.filter((item) => !folderIds.has(item.id)));
    setDocuments((current) => current.filter((item) => !folderIds.has(item.folderId)));
    setActiveFolderId("");
    if (activeDocument && folderIds.has(activeDocument.folderId)) setActiveDocumentId("");
    setSyncStatus(await getSyncStatus());
    setDeleteTarget(null);
    onToast?.("Carpeta eliminada.");
  }

  async function removeDocument(document) {
    if (workspaceFolderHandle && document.path) {
      await deleteLocalItem(workspaceFolderHandle, document);
      await refreshLocalTreeFromDisk({
        keepActiveDocument: false,
        nextActiveFolderId: document.folderId || "",
        nextActiveDocumentId: "",
      });
      setDeleteTarget(null);
      onToast?.("Documento eliminado.");
      return;
    }
    await deleteDocument(document.id);
    setDocuments((current) => current.filter((item) => item.id !== document.id));
    if (activeDocumentId === document.id) setActiveDocumentId("");
    setSyncStatus(await getSyncStatus());
    setDeleteTarget(null);
    onToast?.("Documento eliminado.");
  }

  async function persistDocument(nextDocument) {
    if (workspaceFolderHandle && nextDocument?.fileHandle) {
      const saved = await writeLocalMarkdownFile(workspaceFolderHandle, nextDocument, nextDocument.contentMarkdown || "");
      await refreshLocalTreeFromDisk({
        nextActiveFolderId: saved.folderId || "",
        nextActiveDocumentPath: saved.path,
        openFolderIds: saved.folderId ? ancestorFolderIds(folders, saved.folderId) : [],
      });
      return;
    }
    const saved = await saveDocument({ ...nextDocument, statusSync: "pending_upload", syncStatus: "pending_upload" });
    setDocuments((current) => sortDocuments([saved, ...current.filter((item) => item.id !== saved.id)]));
    setActiveFolderId(saved.folderId || "");
    setSyncStatus(await getSyncStatus());
  }

  async function registerExport(exportItem) {
    await saveContentExport({
      documentId: activeDocument?.id || exportItem.documentId,
      title: exportItem.title || activeDocument?.title || "",
      ...exportItem,
    });
    onToast?.("Exportacion registrada.");
  }

  async function connectDrive() {
    setBusy(true);
    setDriveStatus("syncing");
    setDriveError("");
    try {
      assertDriveConfigured();
      await signInGoogle();
      setDriveStatus("connected");
      setStorageSettings(await saveStorageSettings({ driveConnected: true }));
      onToast?.("Google Drive conectado.");
    } catch (error) {
      setDriveStatus("error");
      showDriveError(error);
    } finally {
      setBusy(false);
    }
  }

  async function ensureDriveConnected() {
    assertDriveConfigured();
    setDriveError("");
    if (getGoogleDriveConnectionStatus() === "connected") {
      setDriveStatus("connected");
      return;
    }
    try {
      await restoreDriveSession();
    } catch {
      await signInGoogle();
    }
    if (getGoogleDriveConnectionStatus() !== "connected") {
      await signInGoogle();
    }
    setDriveStatus("connected");
    setStorageSettings(await saveStorageSettings({ driveConnected: true }));
  }

  async function uploadLocalBackupToDrive() {
    console.info("Sincronizacion con Google Drive iniciada");
    setBusy(true);
    setDriveStatus("syncing");
    try {
      await ensureDriveConnected();
      const result = workspaceFolderHandle
        ? await backupChangedFilesToDrive(workspaceFolderHandle)
        : await backupToGoogleDrive();
      setDriveStatus("connected");
      setStorageSettings(await saveStorageSettings({ driveConnected: true, lastBackupAt: result.syncedAt }));
      setSyncStatus(await getSyncStatus());
      onToast?.(workspaceFolderHandle
        ? `Cambios locales subidos a Drive (${result.uploadedCount || 0} archivo${result.uploadedCount === 1 ? "" : "s"}).`
        : `Respaldo subido a Drive ${formatDriveDate(result.syncedAt)}.`);
    } catch (error) {
      setDriveStatus("error");
      showDriveError(error);
    } finally {
      setBusy(false);
    }
  }

  function showChooseFolderToContinueProgress(error) {
    const message = restoreErrorMessage(error || new Error("Selecciona nuevamente la carpeta local para restaurar."));
    onToast?.(message);
    setRestoreProgress({
      stage: "needs_folder",
      label: "Selecciona nuevamente la carpeta local para restaurar.",
      error: message,
      action: "choose_folder",
      actionLabel: "Elegir carpeta local y continuar",
    });
  }

  async function ensureWritableWorkspaceForRestore(currentHandle, { forcePickFolder = false } = {}) {
    if (!window.showDirectoryPicker) return null;
    if (!forcePickFolder && currentHandle) {
      try {
        const granted = await verifyDirectoryWritePermission(currentHandle);
        if (granted) return currentHandle;
      } catch (error) {
        console.warn("Permiso local invalido para restaurar", error);
      }
    }
    setRestoreProgress({
      stage: "needs_folder",
      label: "Selecciona nuevamente la carpeta local para restaurar.",
      action: "choose_folder",
      actionLabel: "Elegir carpeta local y continuar",
    });
    const selected = await selectLocalDirectory("workspace", { forceFresh: true });
    if (!selected || selected === true) {
      showChooseFolderToContinueProgress();
      return null;
    }
    const granted = await verifyDirectoryWritePermission(selected);
    if (!granted) {
      throw new Error("Permiso denegado para escribir en la carpeta local. Seleccioná nuevamente la carpeta local para restaurar.");
    }
    return selected;
  }

  async function restoreLocalBackupFromDrive({ silent = false, auto = false, forcePickFolder = false } = {}) {
    console.info("Restauración iniciada");
    setRestoreProgress({ stage: "starting", label: "Iniciando restauración..." });
    let targetHandle = workspaceFolderHandle;
    try {
      if (window.showDirectoryPicker) {
        targetHandle = await ensureWritableWorkspaceForRestore(targetHandle, { forcePickFolder });
        if (!targetHandle) {
          return;
        }
      } else if (!targetHandle && auto && window.showDirectoryPicker) {
        setRestoreProgress(null);
        return;
      }
    } catch (error) {
      setDriveStatus("error");
      if (isFolderPermissionError(error)) {
        showChooseFolderToContinueProgress(error);
      } else {
        setRestoreProgress({ stage: "error", label: "Restauración detenida por error", error: restoreErrorMessage(error) });
        showDriveError(error);
      }
      return;
    }
    const hasDirty = await hasDirtyLocalChanges();
    const message = !targetHandle
      ? "Android no permite elegir una carpeta local desde este navegador. Se restaurara el contenido dentro del almacenamiento interno de la app. Continuar?"
      : hasDirty
        ? "Tenes cambios locales pendientes. Se comparara Drive con la carpeta local y se conservara la version mas reciente. Continuar?"
        : "Se leera Google Drive, se descargaran carpetas y archivos, y se reconstruira el almacenamiento local. Continuar?";
    const needsConfirmation = !silent && !forcePickFolder && !isMobile && !/Android/i.test(navigator.userAgent || "");
    if (needsConfirmation && !window.confirm(message)) {
      setRestoreProgress(null);
      return;
    }
    setBusy(true);
    setDriveStatus("syncing");
    setRestoreProgress({ stage: "reading_drive", label: "Leyendo Google Drive..." });
    try {
      await ensureDriveConnected();
      const workspace = targetHandle
        ? await syncChangedFilesFromDrive(targetHandle, { onProgress: setRestoreProgress })
        : await restoreDriveFolderToIndexedDb({ onProgress: setRestoreProgress });
      if (!workspace) {
        setRestoreProgress({ stage: "error", label: "Error restaurando desde Google Drive" });
        onToast?.("No se encontro contenido en Google Drive.");
        return;
      }
      setRestoreProgress({ ...workspace, stage: "restoring", label: "Restaurando contenido..." });
      await refreshTreeAfterChange({ handle: targetHandle, keepActiveDocument: false });
      setActiveDocumentId("");
      setDriveStatus("connected");
      setStorageSettings(await saveStorageSettings({ driveConnected: true, lastSyncAt: workspace?.manifest?.updatedAt || workspace?.syncedAt || new Date().toISOString() }));
      setSyncStatus(await getSyncStatus());
      setRestoreProgress({
        stage: "completed",
        label: "Completado",
        current: workspace.filesCount || workspace.downloadedCount || 0,
        total: workspace.filesCount || workspace.downloadedCount || 0,
        foldersRestored: workspace.foldersCount || 0,
        filesRestored: workspace.filesCount || workspace.downloadedCount || 0,
      });
      onToast?.(`Restauración completada. Carpetas: ${workspace.foldersCount || 0}. Archivos: ${workspace.filesCount || workspace.downloadedCount || 0}.`);
      window.setTimeout(() => setRestoreProgress(null), 4200);
    } catch (error) {
      if (auto) {
        await saveStorageSettings({ pendingDriveSync: true });
        return;
      }
      setDriveStatus("error");
      console.error("Error restaurando desde Google Drive", error);
      if (isFolderPermissionError(error)) {
        showChooseFolderToContinueProgress(error);
      } else {
        setRestoreProgress({ stage: "error", label: "Restauración detenida por error", error: restoreErrorMessage(error) });
        showDriveError(error);
      }
    } finally {
      setBusy(false);
    }
  }

  async function restoreCompleteBackupFromDrive({ silent = false } = {}) {
    if (!silent && !window.confirm("Esto restaurara completamente la carpeta local desde backup.json de Google Drive. Se conservara la copia mas reciente disponible. Continuar?")) return;
    setBusy(true);
    setDriveStatus("syncing");
    try {
      await ensureDriveConnected();
      const restored = workspaceFolderHandle
        ? await restoreBackupJsonFromDrive(workspaceFolderHandle)
        : await restoreFromGoogleDrive();
      if (!restored) {
        onToast?.("No se encontro backup.json en Google Drive.");
        return;
      }
      await refreshTreeAfterChange({ keepActiveDocument: false });
      setActiveDocumentId("");
      setDriveStatus("connected");
      setStorageSettings(await saveStorageSettings({ driveConnected: true, lastSyncAt: restored?.syncedAt || new Date().toISOString(), pendingDriveSync: false }));
      setSyncStatus(await getSyncStatus());
      onToast?.("Backup restaurado completamente desde Google Drive.");
    } catch (error) {
      setDriveStatus("error");
      showDriveError(error);
    } finally {
      setBusy(false);
    }
  }

  async function toggleAutoSyncDrive() {
    const next = await saveStorageSettings({ autoSyncDrive: !storageSettings.autoSyncDrive });
    setStorageSettings(next);
    onToast?.(next.autoSyncDrive ? "Sincronizacion automatica activada." : "Sincronizacion automatica desactivada.");
  }

  function disconnectDrive() {
    signOutGoogle();
    setDriveStatus("disconnected");
    setDriveError("");
    saveStorageSettings({ driveConnected: false }).then(setStorageSettings);
    onToast?.("Google Drive desconectado.");
  }

  async function chooseDriveRootFolder() {
    try {
      assertDriveConfigured();
      setDriveStatus("syncing");
      const nextFolderId = selectKnowledgeRootFolder();
      if (!nextFolderId) {
        setDriveStatus(getGoogleDriveConnectionStatus());
        return;
      }
      setDriveRootFolderId(nextFolderId);
      setDriveStatus("connected");
      onToast?.("Carpeta principal de Drive configurada para respaldos.");
    } catch (error) {
      setDriveStatus("error");
      showDriveError(error);
    }
  }

  async function publishDocument(payload) {
    const published = await publishToFirebase(payload);
    if (payload.document?.id) {
      const saved = await updateDocument(payload.document.id, {
        statusSync: "publicado_firebase",
        syncStatus: "publicado_firebase",
        publishedContentId: published.id,
        lastPublishedAt: published.publishedAt,
      });
      if (saved) setDocuments((current) => sortDocuments([saved, ...current.filter((item) => item.id !== saved.id)]));
    }
    onToast?.("Publicado en Firebase.");
  }

  async function uploadImageForActiveDocument(file) {
    try {
      if (!activeDocument?.id) throw new Error("Primero abri o crea un documento para insertar la imagen.");
      if (workspaceFolderHandle && activeDocument.fileHandle) {
        const asset = await copyImageToLocalAssets(workspaceFolderHandle, activeDocument, file);
        setSyncStatus({ status: "modified_local", label: "Cambios pendientes de respaldo" });
        onToast?.("Imagen copiada a assets locales.");
        return asset;
      }
      const localUrl = await fileToDataUrl(file);
      const asset = await saveAssetLocal({
        documentId: activeDocument.id,
        localBlob: file,
        localUrl,
        fileName: file.name,
        mimeType: file.type,
      });
      setSyncStatus(await getSyncStatus());
      onToast?.("Imagen guardada localmente.");
      return {
        ...asset,
        publicFileUrl: asset.localUrl,
        webContentLink: asset.localUrl,
        webViewLink: asset.localUrl,
      };
    } catch (error) {
      showDriveError(error);
      return null;
    }
  }

  async function createLinkedDocument(title) {
    const cleanTitle = title?.trim();
    if (!cleanTitle) return null;
    const existing = documents.find((item) => (item.displayName || item.title || "").replace(/\.[^/.]+$/, "").toLowerCase() === cleanTitle.toLowerCase());
    if (existing) return existing;
    return createDocument(activeDocument?.folderId || activeFolderId || "", cleanTitle);
  }

  function selectFolder(folderId) {
    setActiveFolderId(folderId || "");
    setActiveDocumentId("");
    setActiveDocumentPath("");
    setOpenedLocalDocument(null);
  }

  async function openDocumentByPath(path, sourceDocuments = documents) {
    return selectDocument(path, sourceDocuments);
  }

  async function selectDocument(documentKey, sourceDocuments = documents) {
    const document = sourceDocuments.find((item) =>
      item.path === documentKey || item.id === documentKey || item.driveFileId === documentKey || item.driveId === documentKey
    );
    if (!document) {
      setActiveDocumentId(documentKey);
      setActiveDocumentPath("");
      setOpenedLocalDocument(null);
      localStorage.setItem(LAST_DOCUMENT_KEY, documentKey);
      setDrawerOpen(false);
      return;
    }

    let readyDocument = document;
    if (workspaceFolderHandle && document.fileHandle) {
      const requestId = openDocumentRequestRef.current + 1;
      openDocumentRequestRef.current = requestId;
      setActiveDocumentPath(document.path || document.id);
      setActiveDocumentId("");
      setOpenedLocalDocument(null);
      const contentMarkdown = await readLocalMarkdownFile(document);
      if (requestId !== openDocumentRequestRef.current) return;
      readyDocument = { ...document, contentMarkdown };
      setDocuments(sortDocuments([readyDocument, ...sourceDocuments.filter((item) => item.id !== readyDocument.id)]));
      setOpenedLocalDocument(readyDocument);
    }

    const resolvedId = readyDocument.id || documentKey;
    setActiveFolderId(readyDocument.folderId || "");
    setActiveDocumentPath(readyDocument.path || resolvedId);
    setActiveDocumentId(resolvedId);
    localStorage.setItem(LAST_DOCUMENT_KEY, readyDocument.path || resolvedId);
    setDrawerOpen(false);
  }

  const sidebarTreeProps = {
    folders,
    documents: visibleDocuments,
    loading: false,
    driveConnected: driveStatus === "connected",
    activeFolderId,
    activeDocumentId,
    expandedFolderIds,
    onToggleFolderOpen: (folderId, open) => {
      setExpandedFolderIds((current) => open
        ? uniqueIds([...current, folderId])
        : current.filter((id) => id !== folderId));
    },
    onSelectFolder: selectFolder,
    onSelectDocument: selectDocument,
    onCreateFolder: createFolder,
    onCreateDocument: createDocument,
    onRenameFolder: renameFolder,
    onRenameDocument: renameDocument,
    onDeleteFolder: requestDeleteFolder,
    onDeleteDocument: requestDeleteDocument,
    onMoveDocument: moveDocumentToFolder,
    onRefreshTree: () => refreshTreeAfterChange(),
    search,
    onSearchChange: setSearch,
  };

  function renderSidebarTree() {
    return <SidebarTree {...sidebarTreeProps} />;
  }

  async function selectLocalDirectory(kind, { forceFresh = false } = {}) {
    const field = kind === "backup" ? "backupPath" : "workspaceLocalPath";
    const label = kind === "backup" ? "respaldos" : "workspace";
    try {
      if (kind === "workspace" && window.showDirectoryPicker) {
        const handle = await selectLocalWorkspaceFolder({ forceFresh });
        if (!handle) return;
        setWorkspaceFolderHandle(handle);
        const nextSettings = await getStorageSettings();
        setStorageSettings(nextSettings);
        await refreshLocalTreeFromDisk({
          handle,
          keepActiveDocument: false,
          nextActiveFolderId: "",
          nextActiveDocumentId: "",
        });
        onToast?.("Carpeta local configurada");
        return handle;
      }
      if (window.showDirectoryPicker) {
        const previousHandle = await getDirectoryHandle(kind);
        const handle = await window.showDirectoryPicker({
          id: `ashram-${kind}`,
          mode: "readwrite",
          startIn: previousHandle || "documents",
        });
        await saveDirectoryHandle(kind, handle);
        const next = await saveStorageSettings({ [field]: handle.name });
        setStorageSettings(next);
        onToast?.(`Carpeta de ${label} configurada.`);
        return handle;
      }
      const current = storageSettings[field] || "";
      const fallback = kind === "backup" ? "Ashram Ganesha/Backups" : "Ashram Ganesha";
      const path = window.prompt(`Ruta local para ${label}`, current || fallback);
      if (!path?.trim()) return;
      const next = await saveStorageSettings({ [field]: path.trim() });
      setStorageSettings(next);
      onToast?.(`Ruta de ${label} guardada en este dispositivo.`);
      return true;
    } catch (error) {
      if (error?.name === "AbortError") return false;
      if (kind === "workspace" && forceFresh) {
        showChooseFolderToContinueProgress(error);
        return false;
      }
      showDriveError(error);
      return false;
    }
  }

  async function exportBackupJson() {
    try {
      const workspace = await exportLocalWorkspace();
      const blob = new Blob([JSON.stringify(workspace, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `ashram-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      onToast?.("Backup local exportado.");
    } catch (error) {
      showDriveError(error);
    }
  }

  return (
    <section className="documents-layout">
      <header className="documents-topbar">
        <span>
          <Cloud size={18} />
          <strong>Mis Documentos</strong>
          <StorageStateIndicator status={syncStatus.status} />
          <SyncStatusBadge status={syncStatus.status} />
          <small className="drive-last-updated">Ultima sync: {formatDriveDate(storageSettings.lastSyncAt) || "sin sincronizar"}</small>
          <span className={`drive-status ${driveStatus}`}>{driveStatusLabel(driveStatus)}</span>
        </span>
        <button className="icon-btn" type="button" disabled={busy} onClick={() => setStorageConfigOpen(true)} title="Configuracion de almacenamiento">
          <Settings size={15} />
        </button>
        <button className="primary small" type="button" disabled={busy} onClick={connectDrive}>
          <Upload size={15} /> Conectar Drive
        </button>
        {driveStatus === "connected" ? (
          <button className="ghost compact" type="button" disabled={busy} onClick={disconnectDrive}>
            Salir Drive
          </button>
        ) : null}
        <button className="primary small" type="button" disabled={busy || !driveConfigured} onClick={uploadLocalBackupToDrive}>
          <Upload size={15} /> Respaldar en Drive
        </button>
        <button className="ghost compact" type="button" disabled={busy || !driveConfigured} onClick={restoreLocalBackupFromDrive}>
          <RefreshCw size={15} /> Restaurar desde Drive
        </button>
        <button className="ghost compact" type="button" disabled={busy} onClick={chooseDriveRootFolder} title={driveRootFolderId || "Elegir carpeta principal"}>
          <FolderOpen size={15} /> Carpeta Drive
        </button>
        <button className="icon-btn" type="button" disabled={busy} onClick={() => refreshTreeAfterChange()} title="Actualizar local">
          <RefreshCw size={15} />
        </button>
      </header>
      {!driveConfigured ? (
        <div className="drive-setup-warning">
          <strong>Google Drive no esta conectado</strong>
          <small>{googleDriveSetupMessage()}</small>
        </div>
      ) : null}
      {driveError ? (
        <div className="drive-setup-warning">
          <strong>Error de sincronizacion</strong>
          <small>{driveError}</small>
        </div>
      ) : null}
      {restoreProgress ? <RestoreProgress progress={restoreProgress} onAction={() => restoreLocalBackupFromDrive({ forcePickFolder: true })} /> : null}
      <div className="documents-workspace">
        <div className="desktop-documents-sidebar">
          {renderSidebarTree()}
        </div>
        <MobileFolderDrawer
          open={drawerOpen}
          onToggle={() => setDrawerOpen((open) => !open)}
          onClose={() => setDrawerOpen(false)}
        >
          <div className="mobile-admin-return">
            <button
              type="button"
              onClick={() => {
                setDrawerOpen(false);
                onBackToAdminPanel?.();
              }}
            >
              ← Panel de administracion
            </button>
          </div>
          <div className="mobile-sidebar-title">
            <strong>Mis documentos</strong>
            <button className="icon-btn" type="button" onClick={() => setMobileConfigOpen(true)} title="Configuracion local">
              ⚙️
            </button>
          </div>
          {renderMobileTreeStatus()}
          {renderSidebarTree()}
        </MobileFolderDrawer>
        {mobileConfigOpen ? (
          <MobileLocalConfigSheet
            settings={storageSettings}
            driveStatus={driveStatus}
            syncStatus={syncStatus}
            busy={busy}
            onClose={() => setMobileConfigOpen(false)}
            onSelectWorkspaceFolder={async () => {
              const selected = await selectLocalDirectory("workspace");
              if (selected) setMobileConfigOpen(false);
            }}
            onRefreshLocalTree={async () => {
              await refreshTreeAfterChange();
              onToast?.("Árbol actualizado");
            }}
            onRestore={async () => {
              setMobileConfigOpen(false);
              await restoreLocalBackupFromDrive();
            }}
            onRestoreComplete={async () => {
              setMobileConfigOpen(false);
              await restoreCompleteBackupFromDrive();
            }}
            onBackup={async () => {
              setMobileConfigOpen(false);
              await uploadLocalBackupToDrive();
            }}
            onToggleAutoSync={toggleAutoSyncDrive}
          />
        ) : null}
        <DocumentEditor
          key={activeDocumentPath || activeDocument?.path || activeDocument?.id || "empty-document"}
          document={activeDocument}
          folders={folders}
          documents={documents}
          onChange={persistDocument}
          onExport={registerExport}
          onPublish={publishDocument}
          onShowSidebar={() => setDrawerOpen(true)}
          onUploadImage={uploadImageForActiveDocument}
          onCreateLinkedDocument={createLinkedDocument}
          onOpenDocument={selectDocument}
          onOpenStorageConfig={() => setStorageConfigOpen(true)}
          onRefreshTree={() => refreshTreeAfterChange()}
          onBackupDrive={uploadLocalBackupToDrive}
          onRestoreDrive={restoreLocalBackupFromDrive}
          driveConnected={driveConfigured}
          busy={busy}
          internalDocuments={internalLinkDocuments}
        />
      </div>
      {renameTarget ? (
        <RenameIconModal
          key={`${renameTarget.type}-${renameTarget.item.id}`}
          item={renameTarget.item}
          title={renameTarget.type === "folder" ? "Editar carpeta" : "Editar documento"}
          focus={renameTarget.focus}
          onClose={() => setRenameTarget(null)}
          onSave={renameTarget.type === "folder" ? updateFolderMetadata : updateDocumentMetadata}
        />
      ) : null}
      {deleteTarget ? (
        <ConfirmDeleteModal
          title={deleteTarget.validation.title}
          message={deleteTarget.validation.message}
          details={deleteTarget.validation.details}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => deleteTarget.type === "folder" ? removeFolder(deleteTarget.item) : removeDocument(deleteTarget.item)}
        />
      ) : null}
      {storageConfigOpen ? (
        <StorageConfigModal
          settings={storageSettings}
          workspace={workspaceInfo}
          foldersCount={folders.length}
          documentsCount={documents.length}
          driveStatus={driveStatus}
          busy={busy}
          onClose={() => setStorageConfigOpen(false)}
          onSelectWorkspaceFolder={async () => {
            const selected = await selectLocalDirectory("workspace");
            if (selected) setStorageConfigOpen(false);
          }}
          onRefreshLocalTree={async () => {
            await refreshTreeAfterChange();
            onToast?.("Árbol actualizado");
          }}
          onSelectBackupFolder={() => selectLocalDirectory("backup")}
          onConnectDrive={connectDrive}
          onDisconnectDrive={disconnectDrive}
          onBackup={uploadLocalBackupToDrive}
          onRestore={restoreLocalBackupFromDrive}
          onRestoreComplete={restoreCompleteBackupFromDrive}
          onToggleAutoSync={toggleAutoSyncDrive}
          onExportBackup={exportBackupJson}
        />
      ) : null}
    </section>
  );

  function assertDriveConfigured() {
    if (!driveConfigured) throw new Error(googleDriveSetupMessage());
  }

  function showDriveError(error, { alert = true } = {}) {
    const message = restoreErrorMessage(error) || "No se pudo conectar con Google Drive.";
    setDriveError(message);
    onToast?.(message);
    if (alert) window.alert(message);
  }

  function restoreErrorMessage(error) {
    const message = error?.message || "";
    if (isFolderPermissionError(error)) {
      return "Selecciona nuevamente la carpeta local para restaurar.";
    }
    return message || "Error restaurando desde Google Drive";
  }

  function isFolderPermissionError(error) {
    const message = error?.message || "";
    return error?.name === "NotAllowedError"
      || message.includes("state cached in an interface object")
      || message.includes("Seleccion")
      || message.includes("Permiso denegado para escribir en la carpeta local");
  }

  function renderMobileTreeStatus() {
    const hasLocalItems = folders.length || documents.length;
    if (!workspaceFolderHandle && !storageSettings.workspaceLocalPath) {
      return (
        <div className="mobile-drive-empty">
          <p className="drive-tree-message">Selecciona una carpeta local para cargar documentos.</p>
          <button className="ghost compact" type="button" onClick={() => selectLocalDirectory("workspace")}>
            Seleccionar carpeta local
          </button>
        </div>
      );
    }
    if (!hasLocalItems) {
      return (
        <div className="mobile-drive-empty">
          <p className="drive-tree-message">No se encontraron carpetas o documentos Markdown en la carpeta local.</p>
        </div>
      );
    }
    return null;
  }
}

function MobileLocalConfigSheet({
  settings,
  driveStatus,
  syncStatus,
  busy,
  onClose,
  onSelectWorkspaceFolder,
  onRefreshLocalTree,
  onRestore,
  onRestoreComplete,
  onBackup,
  onToggleAutoSync,
}) {
  return (
    <div className="mobile-config-backdrop" role="presentation">
      <section className="mobile-config-sheet">
        <header>
          <strong>Configuracion local y sincronizacion</strong>
          <button className="icon-btn" type="button" onClick={onClose}>×</button>
        </header>
        <button className="primary small" type="button" disabled={busy} onClick={onSelectWorkspaceFolder}>📁 Elegir carpeta local</button>
        <button className="ghost compact" type="button" disabled={busy} onClick={onRefreshLocalTree}>🔄 Releer carpeta local</button>
        <button className="ghost compact" type="button" disabled={busy} onClick={onRestore}>☁️ Restaurar desde Google Drive</button>
        <button className="primary small" type="button" disabled={busy} onClick={onBackup}>⬆️ Subir cambios a Google Drive</button>
        <button className="ghost compact" type="button" disabled={busy} onClick={onRestoreComplete}>Restaurar backup.json</button>
        <button className="ghost compact" type="button" disabled={busy} onClick={onToggleAutoSync}>
          {settings.autoSyncDrive ? "Desactivar sincronizacion automatica" : "Activar sincronizacion automatica"}
        </button>
        <div className="mobile-config-status">
          <strong>Estado actual</strong>
          <StoragePathRow label="Carpeta local" value={settings.workspaceLocalPath || "Sin carpeta seleccionada"} />
          <StoragePathRow label="Ultimo respaldo" value={formatDriveDate(settings.lastBackupAt) || "Sin respaldo"} />
          <StoragePathRow label="Ultima sincronizacion" value={formatDriveDate(settings.lastSyncAt) || "Sin sincronizacion"} />
          <StoragePathRow label="Auto-sync" value={settings.autoSyncDrive ? "Activada" : "Desactivada"} />
          <StoragePathRow label="Estado" value={mobileSyncStatusLabel(syncStatus.status)} />
        </div>
      </section>
    </div>
  );
}

function mobileSyncStatusLabel(status) {
  const labels = {
    backed_up: "🟢 Sincronizado",
    synced: "🟢 Sincronizado",
    local_only: "🟢 Local activo",
    modified_local: "🟡 Cambios locales pendientes",
    pending_upload: "🟡 Cambios locales pendientes",
    drive_available: "🔵 Cambios disponibles en Drive",
    conflict: "🔴 Conflicto",
    offline: "🟡 Sin conexion",
  };
  return labels[status] || "🟢 Local activo";
}

function sortFolders(folders) {
  return [...folders].sort((a, b) => compareTreeItems(a, b));
}

function StorageStateIndicator({ status }) {
  const config = {
    local_only: { icon: "🟢", label: "Local activo" },
    modified_local: { icon: "🟡", label: "Cambios sin respaldar" },
    backed_up: { icon: "☁️", label: "Respaldado en Drive" },
    offline: { icon: "🟢", label: "Local activo sin conexion" },
  };
  const fixedConfig = {
    local_only: { icon: "\u{1F7E2}", label: "Local activo" },
    modified_local: { icon: "\u{1F7E1}", label: "Cambios sin respaldar" },
    backed_up: { icon: "\u2601\uFE0F", label: "Respaldado en Drive" },
    offline: { icon: "\u{1F7E2}", label: "Local activo sin conexion" },
  };
  const item = fixedConfig[status] || fixedConfig.local_only;
  return <span className={`storage-state-indicator ${status || "local_only"}`} title={item.label}>{item.icon} {item.label}</span>;
}

function RestoreProgress({ progress, onAction }) {
  const steps = [
    ["starting", "Iniciando restauración"],
    ["reading_drive", "Leyendo Google Drive"],
    ["folders", "Encontrando carpetas"],
    ["downloading", "Descargando archivos"],
    ["restoring", "Restaurando contenido"],
    ["completed", "Completado"],
  ];
  const activeIndex = progress?.stage === "error" || progress?.stage === "needs_folder"
    ? Math.max(0, steps.findIndex(([stage]) => stage === "restoring"))
    : Math.max(0, steps.findIndex(([stage]) => stage === progress?.stage));
  const hasTotal = Number(progress?.total) > 0;
  const percent = hasTotal
    ? Math.min(progress?.stage === "error" ? 96 : 100, Math.round((Number(progress.current || 0) / Number(progress.total)) * 100))
    : Math.round(((activeIndex + 1) / steps.length) * 100);

  return (
    <div className={`restore-progress ${progress?.stage === "error" || progress?.stage === "needs_folder" ? "error" : ""}`} role="status" aria-live="polite">
      <div className="restore-progress-head">
        <strong>{progress?.label || "Restaurando desde Drive"}</strong>
        {hasTotal ? <small>{progress.current || 0}/{progress.total} archivos</small> : null}
      </div>
      <div className="restore-progress-bar">
        <span style={{ width: `${percent}%` }} />
      </div>
      <div className="restore-progress-steps">
        {steps.map(([stage, label], index) => (
          <span className={index <= activeIndex ? "active" : ""} key={stage}>{label}</span>
        ))}
      </div>
      {progress?.fileName ? <small className="restore-progress-file">{progress.fileName}</small> : null}
      {(progress?.foldersRestored !== undefined || progress?.filesRestored !== undefined) ? (
        <div className="restore-progress-summary">
          <span>Carpetas restauradas: {progress.foldersRestored || 0}</span>
          <span>Archivos restaurados: {progress.filesRestored || 0}</span>
        </div>
      ) : null}
      {progress?.error ? <small className="restore-progress-error">{progress.error}</small> : null}
      {progress?.action === "choose_folder" ? (
        <button className="primary small restore-progress-action" type="button" onClick={onAction}>
          {progress.actionLabel || "Elegir carpeta local y continuar"}
        </button>
      ) : null}
    </div>
  );
}

function StorageConfigModal({
  settings,
  workspace,
  foldersCount,
  documentsCount,
  driveStatus,
  busy,
  onClose,
  onSelectWorkspaceFolder,
  onRefreshLocalTree,
  onSelectBackupFolder,
  onConnectDrive,
  onDisconnectDrive,
  onBackup,
  onRestore,
  onRestoreComplete,
  onToggleAutoSync,
  onExportBackup,
}) {
  return (
    <div className="export-modal-backdrop">
      <section className="export-modal storage-config-modal">
        <header>
          <strong className="storage-config-title-desktop">Configuracion del espacio de trabajo</strong>
          <strong className="storage-config-title-mobile">Configuracion local</strong>
          <button className="icon-btn" type="button" onClick={onClose}>×</button>
        </header>

        <div className="storage-config-mobile-simple">
          <StoragePathRow label="Carpeta local actual" value={settings.workspaceLocalPath || "Sin carpeta seleccionada"} />
          <button className="primary small" type="button" disabled={busy} onClick={onSelectWorkspaceFolder}>📁 Elegir carpeta local</button>
          <button className="ghost compact" type="button" disabled={busy} onClick={onRefreshLocalTree}>🔄 Releer carpeta</button>
        </div>

        <div className="storage-config-desktop-detail">
        <div className="storage-config-section">
          <h3>Carpeta local principal</h3>
          <StoragePathRow label="Carpeta actual" value={settings.workspaceLocalPath || "Almacenamiento local del navegador"} />
          <button className="primary small" type="button" onClick={onSelectWorkspaceFolder}>Seleccionar carpeta</button>
          <small>Esta configuracion queda guardada solo en este dispositivo.</small>
        </div>

        <div className="storage-config-section">
          <h3>Carpeta de respaldos</h3>
          <StoragePathRow label="Carpeta actual" value={settings.backupPath || "Sin carpeta elegida"} />
          <div className="storage-config-actions">
            <button className="primary small" type="button" onClick={onSelectBackupFolder}>Seleccionar carpeta</button>
            <button className="ghost compact" type="button" onClick={onExportBackup}>Exportar backup JSON</button>
          </div>
        </div>

        <div className="storage-config-section">
          <h3>Google Drive</h3>
          <StoragePathRow label="Estado" value={driveStatus === "connected" ? "🟢 Conectado" : "🔴 Desconectado"} />
          <div className="storage-config-actions">
            <button className="primary small" type="button" disabled={busy} onClick={onConnectDrive}>Conectar Drive</button>
            <button className="ghost compact" type="button" disabled={busy || driveStatus !== "connected"} onClick={onDisconnectDrive}>Desconectar Drive</button>
            <button className="primary small" type="button" disabled={busy} onClick={onBackup}>Respaldar ahora</button>
            <button className="ghost compact" type="button" disabled={busy} onClick={onRestore}>Sincronizar ahora</button>
            <button className="ghost compact" type="button" disabled={busy} onClick={onRestoreComplete}>Restaurar backup.json</button>
            <button className="ghost compact" type="button" disabled={busy} onClick={onToggleAutoSync}>
              {settings.autoSyncDrive ? "Auto-sync activada" : "Auto-sync desactivada"}
            </button>
          </div>
        </div>

        <div className="storage-config-section">
          <h3>Configuracion del workspace</h3>
          <div className="storage-config-grid">
            <StoragePathRow label="Nombre" value={workspace?.name || workspace?.nombre || "Ashram Ganesha"} />
            <StoragePathRow label="Carpeta raiz local" value={settings.workspaceLocalPath || "IndexedDB local"} />
            <StoragePathRow label="Ultimo respaldo" value={formatDriveDate(settings.lastBackupAt || workspace?.lastBackupAt) || "Sin respaldo"} />
            <StoragePathRow label="Ultima sincronizacion" value={formatDriveDate(settings.lastSyncAt || workspace?.lastSyncAt) || "Sin sincronizacion"} />
            <StoragePathRow label="Sincronizacion automatica" value={settings.autoSyncDrive ? "Activada" : "Desactivada"} />
            <StoragePathRow label="Cantidad de carpetas" value={String(foldersCount)} />
            <StoragePathRow label="Cantidad de documentos" value={String(documentsCount)} />
          </div>
        </div>
        </div>
      </section>
    </div>
  );
}

function StoragePathRow({ label, value }) {
  return (
    <div className="storage-path-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function sortDocuments(documents) {
  return [...documents].sort((a, b) => compareTreeItems(a, b));
}

function compareTreeItems(a, b) {
  const nameA = stripExtension(a.displayName || a.title || a.name || "").toLowerCase();
  const nameB = stripExtension(b.displayName || b.title || b.name || "").toLowerCase();
  return nameA.localeCompare(nameB, "es", { sensitivity: "base" });
}

function stripExtension(value = "") {
  return String(value || "").replace(/\.[^/.]+$/, "");
}

function localDocumentId(prefix = "item") {
  return `${prefix}_${crypto.randomUUID?.() || `${Date.now()}_${Math.random().toString(36).slice(2)}`}`;
}

function descendantFolderIds(folders, folderId) {
  const children = folders.filter((folder) => folder.parentId === folderId);
  return children.flatMap((folder) => [folder.id, ...descendantFolderIds(folders, folder.id)]);
}

function ancestorFolderIds(folders, folderId) {
  if (!folderId) return [];
  const folder = folders.find((item) => item.id === folderId);
  if (!folder) return [];
  return [...ancestorFolderIds(folders, folder.parentId), folder.id];
}

function getTargetParentId(selectedItem) {
  if (!selectedItem) return null;
  if (selectedItem.type === "workspace") return null;
  if (selectedItem.type === "folder") return selectedItem.id;
  if (selectedItem.type === "document") return selectedItem.folderId || null;
  return null;
}

function getTargetFolderIdForDocument(selectedItem) {
  if (!selectedItem || selectedItem.type === "workspace") return "";
  if (selectedItem.type === "folder") return selectedItem.id;
  if (selectedItem.type === "document") return selectedItem.folderId || "";
  return "";
}

function localPathForFolderId(folderId) {
  if (!folderId) return "";
  return String(folderId).replace(/^file:/, "");
}

function uniqueIds(ids) {
  return [...new Set(ids.filter(Boolean))];
}

function getDriveParentFolderId(folderId, folders) {
  const rootFolderId = getKnowledgeRootFolderId();
  if (!folderId) return rootFolderId;
  const folder = folders.find((item) => item.id === folderId);
  return folder?.driveFileId || folderId || rootFolderId;
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result || "");
    reader.onerror = () => reject(reader.error || new Error("No se pudo leer el archivo local."));
    reader.readAsDataURL(file);
  });
}

function normalizeMarkdownForCompare(value = "") {
  return String(value || "").replace(/\r\n/g, "\n").trimEnd();
}

function getAllMarkdownDocumentsFromTree(driveTree, folders = [], fallbackDocuments = []) {
  const folderPathById = new Map(folders.map((folder) => [folder.id, buildFolderPath(folder.id, folders)]));
  const fromTree = [];

  function walk(node, path = "Ashram Ganesha") {
    if (!node) return;
    const children = node.children || [];
    children.forEach((child) => {
      if (child.type === "folder") {
        walk(child, `${path} / ${child.displayName || child.name || child.title || "Carpeta"}`);
        return;
      }
      const name = child.name || child.title || "";
      if (child.type !== "markdown" && child.mimeType !== "text/markdown" && !name.toLowerCase().endsWith(".md")) return;
      fromTree.push({
        ...child,
        id: child.driveFileId || child.driveId || child.id,
        driveFileId: child.driveFileId || child.driveId || child.id,
        displayName: (child.displayName || name || "Sin titulo").replace(/\.[^/.]+$/, ""),
        folderId: child.parentId || child.driveFolderId || "",
        parentFolderId: child.driveFolderId || child.parentId || "",
        folderPath: path,
        icon: child.icon || "document",
        color: child.color || child.iconColor || "#6c6840",
        editable: true,
      });
    });
  }

  walk(driveTree?.root || driveTree);

  const source = fromTree.length ? fromTree : fallbackDocuments
    .filter((item) => {
      const name = `${item.name || item.title || ""}`.toLowerCase();
      return item.editable !== false && (item.driveType === "markdown" || item.mimeType === "text/markdown" || name.endsWith(".md"));
    })
    .map((item) => ({
      ...item,
      driveFileId: item.driveFileId || item.driveId || item.id,
      displayName: (item.displayName || item.title || item.name || "Sin titulo").replace(/\.[^/.]+$/, ""),
      parentFolderId: item.driveFolderId || item.folderId || "",
      folderPath: folderPathById.get(item.folderId) || "Ashram Ganesha",
    }));

  return source.sort((a, b) => (a.displayName || "").localeCompare(b.displayName || "", "es"));
}

function buildFolderPath(folderId, folders = []) {
  if (!folderId) return "Ashram Ganesha";
  const byId = new Map(folders.map((folder) => [folder.id, folder]));
  const names = [];
  let current = byId.get(folderId);
  let safety = 0;
  while (current && safety < 20) {
    names.unshift(current.displayName || current.title || current.name || "Carpeta");
    current = byId.get(current.parentId);
    safety += 1;
  }
  return ["Ashram Ganesha", ...names].join(" / ");
}

function driveStatusLabel(status) {
  const labels = {
    connected: "Drive conectado",
    disconnected: "Drive desconectado",
    syncing: "Sincronizando",
    error: "Error de sincronizacion",
    offline: "Sin conexion",
  };
  return labels[status] || labels.disconnected;
}

function formatDriveDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function readStorageSettingsFallback() {
  try {
    return JSON.parse(localStorage.getItem("ashram_storage_settings") || "null") || {};
  } catch {
    return {};
  }
}

