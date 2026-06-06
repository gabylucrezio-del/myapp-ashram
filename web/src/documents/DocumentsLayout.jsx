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
import {
  deleteFirestoreDocument,
  deleteFirestoreFolder,
  getFirestoreLibraryTree,
  exportFirestoreLibraryBackup,
  saveFirestoreDocument,
  saveFirestoreFolder,
  searchFirestoreLibrary,
  subscribeFirestoreLibraryTree,
  updateFirestoreDocument,
} from "./firestoreLibraryService";

const LAST_DOCUMENT_KEY = "ashram_last_firestore_document_id";
const DRIVE_LEGACY_DISABLED = true;

export default function DocumentsLayout({ onBackToAdminPanel, onToast }) {
  const [folders, setFolders] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [activeFolderId, setActiveFolderId] = useState("");
  const [activeDocumentId, setActiveDocumentId] = useState("");
  const [activeDocumentPath, setActiveDocumentPath] = useState("");
  const [openedLocalDocument, setOpenedLocalDocument] = useState(null);
  const [expandedFolderIds, setExpandedFolderIds] = useState([]);
  const [search, setSearch] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [syncStatus, setSyncStatus] = useState({ status: "local", label: "Guardado localmente" });
  const [busy, setBusy] = useState(false);
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
    const [nextSettings, nextWorkspace] = await Promise.all([
      getStorageSettings(),
      getWorkspace(),
    ]);
    const { folders: nextFolders, documents: nextDocuments } = await getFirestoreLibraryTree();
    setFolders(sortFolders(nextFolders));
    setDocuments(sortDocuments(nextDocuments));
    setSyncStatus({ status: "synced", label: "Sincronizado en Firestore" });
    setStorageSettings(nextSettings);
    setWorkspaceInfo(nextWorkspace);
    setActiveFolderId((current) => current && nextFolders.some((folder) => folder.id === current) ? current : "");
    setActiveDocumentId((current) => current && nextDocuments.some((document) => document.id === current) ? current : "");
  }, []);

  useEffect(() => {
    let unsubscribe = null;
    let cancelled = false;
    getStorageSettings().then((nextSettings) => {
      if (!cancelled) setStorageSettings(nextSettings);
    });
    getWorkspace().then((nextWorkspace) => {
      if (!cancelled) setWorkspaceInfo(nextWorkspace);
    });
    subscribeFirestoreLibraryTree({
      onChange: ({ folders: nextFolders, documents: nextDocuments }) => {
        if (cancelled) return;
        setFolders(sortFolders(nextFolders));
        setDocuments(sortDocuments(nextDocuments));
        setSyncStatus({ status: "synced", label: "Sincronizado en Firestore" });
        setActiveFolderId((current) => current && nextFolders.some((folder) => folder.id === current) ? current : "");
        setActiveDocumentId((current) => current && nextDocuments.some((document) => document.id === current) ? current : "");
      },
      onError: (error) => {
        if (!cancelled) showFirestoreError(error, { alert: false });
      },
    }).then((nextUnsubscribe) => {
      if (cancelled) {
        nextUnsubscribe?.();
        return;
      }
      unsubscribe = nextUnsubscribe;
    });
    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, []);

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

  const visibleDocuments = useMemo(() => {
    const searched = searchFirestoreLibrary(documents, search);
    if (!tagFilter) return searched;
    return searched.filter((document) => (document.tags || []).includes(tagFilter));
  }, [documents, search, tagFilter]);
  const availableTags = useMemo(() => {
    const tags = documents.flatMap((document) => document.tags || []);
    return [...new Set(tags.filter(Boolean))].sort((a, b) => a.localeCompare(b, "es"));
  }, [documents]);

  async function createFolder(parentIdOverride) {
    const parentId = parentIdOverride === undefined ? getTargetParentId(selectedItem) : parentIdOverride;
    const title = window.prompt("Nombre de la carpeta");
    if (!title?.trim()) return;
    try {
      if (!DRIVE_LEGACY_DISABLED && workspaceFolderHandle) {
        const folder = await createLocalFolder(workspaceFolderHandle, localPathForFolderId(parentId), title.trim());
        await refreshTreeAfterChange({
          nextActiveFolderId: folder.id,
          nextActiveDocumentId: "",
          openFolderIds: [...ancestorFolderIds(folders, parentId), parentId, folder.id],
        });
        onToast?.("Carpeta creada localmente.");
        return;
      }
      const folder = await saveFirestoreFolder({
        id: localDocumentId("folder"),
        title: title.trim(),
        parentId: parentId || null,
        statusSync: "synced",
        syncStatus: "synced",
      }, folders);
      setFolders((current) => sortFolders([...current.filter((item) => item.id !== folder.id), folder]));
      setActiveFolderId(folder.id);
      setActiveDocumentId("");
      setExpandedFolderIds((current) => uniqueIds([...current, ...ancestorFolderIds(folders, parentId), parentId, folder.id]));
      setSyncStatus({ status: "synced", label: "Sincronizado en Firestore" });
      onToast?.("Carpeta creada en Firestore.");
    } catch (error) {
      showFirestoreError(error);
    }
  }

  async function createDocument(folderIdOverride, title = "") {
    const folderId = folderIdOverride === undefined ? getTargetFolderIdForDocument(selectedItem) : folderIdOverride;
    const name = title || window.prompt("Titulo del documento", "Nuevo documento");
    if (!name?.trim()) return null;
    try {
      const cleanName = name.trim();
      if (!DRIVE_LEGACY_DISABLED && workspaceFolderHandle) {
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
      const document = await saveFirestoreDocument({
        id: localDocumentId("doc"),
        folderId: folderId || "",
        name: `${cleanName}.md`,
        displayName: cleanName,
        title: cleanName,
        contentMarkdown: `# ${cleanName}\n\n`,
        blocks: [],
        type: "cuaderno",
        mimeType: "text/markdown",
        statusSync: "synced",
        syncStatus: "synced",
      }, folders);
      setDocuments((current) => sortDocuments([document, ...current.filter((item) => item.id !== document.id)]));
      setActiveFolderId(folderId || "");
      setActiveDocumentId(document.id);
      setExpandedFolderIds((current) => uniqueIds([...current, ...ancestorFolderIds(folders, folderId || ""), folderId || ""]));
      setDrawerOpen(false);
      setSyncStatus({ status: "synced", label: "Sincronizado en Firestore" });
      onToast?.("Documento creado en Firestore.");
      return document;
    } catch (error) {
      showFirestoreError(error);
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
    if (!DRIVE_LEGACY_DISABLED && handle) {
      return refreshLocalTreeFromDisk({
        handle,
        keepActiveDocument,
        nextActiveFolderId,
        nextActiveDocumentId,
        nextActiveDocumentPath,
        openFolderIds,
      });
    }
    const { folders: nextFolders, documents: nextDocuments } = await getFirestoreLibraryTree();
    setFolders(sortFolders(nextFolders));
    setDocuments(sortDocuments(nextDocuments));
    setSyncStatus({ status: "synced", label: "Sincronizado en Firestore" });
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
    await refreshTreeAfterChange({ silent });
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
    if (!DRIVE_LEGACY_DISABLED && workspaceFolderHandle && nextFolder.path) {
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
    const saved = await saveFirestoreFolder({ ...nextFolder, statusSync: "synced", syncStatus: "synced" }, folders);
    setFolders((current) => sortFolders(current.map((item) => item.id === saved.id ? { ...item, ...saved } : item)));
    setSyncStatus({ status: "synced", label: "Sincronizado en Firestore" });
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
    if (!DRIVE_LEGACY_DISABLED && workspaceFolderHandle && nextDocument.path) {
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
    const saved = await updateFirestoreDocument(nextDocument.id, { ...nextDocument, title: nextDocument.title, icon: nextDocument.icon, color: nextDocument.color, iconColor: nextDocument.iconColor, statusSync: "synced", syncStatus: "synced" }, folders);
    if (saved) setDocuments((current) => sortDocuments(current.map((item) => item.id === saved.id ? { ...item, ...saved } : item)));
    setSyncStatus({ status: "synced", label: "Sincronizado en Firestore" });
    setRenameTarget(null);
    onToast?.("Documento actualizado.");
  }

  async function moveDocumentToFolder(document, targetFolderId = "") {
    if (!document) return;
    const currentFolderId = document.folderId || "";
    const nextFolderId = targetFolderId || "";
    if (currentFolderId === nextFolderId) return;

    if (!DRIVE_LEGACY_DISABLED && workspaceFolderHandle && document.path) {
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
      statusSync: "synced",
      syncStatus: "synced",
    };
    setDocuments((current) => sortDocuments(current.map((item) => item.id === document.id ? optimistic : item)));
    const saved = await updateFirestoreDocument(document.id, {
      ...document,
      folderId: nextFolderId,
      statusSync: "synced",
      syncStatus: "synced",
    }, folders);
    if (saved) {
      setDocuments((current) => sortDocuments(current.map((item) => item.id === saved.id ? { ...item, ...saved } : item)));
      if (activeDocumentId === saved.id) setActiveFolderId(saved.folderId || "");
    }
    setExpandedFolderIds((current) => uniqueIds([...current, ...ancestorFolderIds(folders, nextFolderId), nextFolderId]));
    setSyncStatus({ status: "synced", label: "Sincronizado en Firestore" });
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
    if (!DRIVE_LEGACY_DISABLED && workspaceFolderHandle && folder.path) {
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
    await deleteFirestoreFolder(folder.id, folders, documents);
    const { folderIds } = validation;
    setFolders((current) => current.filter((item) => !folderIds.has(item.id)));
    setDocuments((current) => current.filter((item) => !folderIds.has(item.folderId)));
    setActiveFolderId("");
    if (activeDocument && folderIds.has(activeDocument.folderId)) setActiveDocumentId("");
    setSyncStatus({ status: "synced", label: "Sincronizado en Firestore" });
    setDeleteTarget(null);
    onToast?.("Carpeta eliminada.");
  }

  async function removeDocument(document) {
    if (!DRIVE_LEGACY_DISABLED && workspaceFolderHandle && document.path) {
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
    await deleteFirestoreDocument(document.id);
    setDocuments((current) => current.filter((item) => item.id !== document.id));
    if (activeDocumentId === document.id) setActiveDocumentId("");
    setSyncStatus({ status: "synced", label: "Sincronizado en Firestore" });
    setDeleteTarget(null);
    onToast?.("Documento eliminado.");
  }

  async function persistDocument(nextDocument) {
    if (!DRIVE_LEGACY_DISABLED && workspaceFolderHandle && nextDocument?.fileHandle) {
      const saved = await writeLocalMarkdownFile(workspaceFolderHandle, nextDocument, nextDocument.contentMarkdown || "");
      await refreshLocalTreeFromDisk({
        nextActiveFolderId: saved.folderId || "",
        nextActiveDocumentPath: saved.path,
        openFolderIds: saved.folderId ? ancestorFolderIds(folders, saved.folderId) : [],
      });
      return;
    }
    const saved = await saveFirestoreDocument({ ...nextDocument, statusSync: "synced", syncStatus: "synced" }, folders);
    setDocuments((current) => sortDocuments([saved, ...current.filter((item) => item.id !== saved.id)]));
    setActiveFolderId(saved.folderId || "");
    setSyncStatus({ status: "synced", label: "Sincronizado en Firestore" });
  }

  async function registerExport(exportItem) {
    await saveContentExport({
      documentId: activeDocument?.id || exportItem.documentId,
      title: exportItem.title || activeDocument?.title || "",
      ...exportItem,
    });
    onToast?.("Exportacion registrada.");
  }

  async function publishDocument(payload) {
    const published = await publishToFirebase(payload);
    if (payload.document?.id) {
      const saved = await updateFirestoreDocument(payload.document.id, {
        ...payload.document,
        statusSync: "synced",
        syncStatus: "synced",
        publishedContentId: published.id,
        lastPublishedAt: published.publishedAt,
        relatedIds: uniqueIds([...(payload.document.relatedIds || []), published.id]),
      }, folders);
      if (saved) setDocuments((current) => sortDocuments([saved, ...current.filter((item) => item.id !== saved.id)]));
    }
    onToast?.("Publicado en Firebase.");
  }

  async function uploadImageForActiveDocument(file) {
    try {
      if (!activeDocument?.id) throw new Error("Primero abri o crea un documento para insertar la imagen.");
      if (!DRIVE_LEGACY_DISABLED && workspaceFolderHandle && activeDocument.fileHandle) {
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
      showFirestoreError(error);
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

  async function createAiDocument(seedDocument) {
    const cleanTitle = seedDocument?.title?.trim() || "Borrador IA";
    const sourceDocumentId = seedDocument?.sourceDocumentId || activeDocument?.id || "";
    const document = await saveFirestoreDocument({
      id: localDocumentId("doc"),
      folderId: seedDocument?.folderId || activeDocument?.folderId || activeFolderId || "",
      title: cleanTitle,
      displayName: cleanTitle,
      name: `${cleanTitle}.md`,
      contentMarkdown: seedDocument?.contentMarkdown || seedDocument?.content || "",
      type: seedDocument?.type || "cuaderno",
      tags: seedDocument?.tags || [],
      keywords: seedDocument?.keywords || "",
      sourceDocumentId,
      relatedIds: sourceDocumentId ? [sourceDocumentId] : [],
      statusSync: "synced",
      syncStatus: "synced",
    }, folders);
    setDocuments((current) => sortDocuments([document, ...current.filter((item) => item.id !== document.id)]));
    if (sourceDocumentId) {
      const original = documents.find((item) => item.id === sourceDocumentId);
      if (original) {
        const updatedOriginal = await updateFirestoreDocument(sourceDocumentId, {
          ...original,
          relatedIds: uniqueIds([...(original.relatedIds || []), document.id]),
        }, folders);
        setDocuments((current) => sortDocuments(current.map((item) => item.id === updatedOriginal.id ? updatedOriginal : item)));
      }
    }
    setActiveFolderId(document.folderId || "");
    setActiveDocumentId(document.id);
    setActiveDocumentPath(document.path || document.id);
    setSyncStatus({ status: "synced", label: "Sincronizado en Firestore" });
    onToast?.("Borrador creado con IA.");
    return document;
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
    if (!DRIVE_LEGACY_DISABLED && workspaceFolderHandle && document.fileHandle) {
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
    driveConnected: false,
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
      showFirestoreError(error);
      return false;
    }
  }

  async function exportLibraryBackup(format = "json") {
    try {
      await exportFirestoreLibraryBackup(format);
      const labels = { json: "JSON", markdown: "Markdown", zip: "ZIP" };
      onToast?.(`Biblioteca exportada en ${labels[format] || "JSON"}.`);
    } catch (error) {
      showFirestoreError(error);
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
          <small className="drive-last-updated">Fuente principal: Firestore</small>
        </span>
        <button className="icon-btn" type="button" disabled={busy} onClick={() => setStorageConfigOpen(true)} title="Configuracion de almacenamiento">
          <Settings size={15} />
        </button>
        {availableTags.length ? (
          <select value={tagFilter} onChange={(event) => setTagFilter(event.target.value)} title="Filtrar por etiqueta">
            <option value="">Todas las etiquetas</option>
            {availableTags.map((tag) => <option key={tag} value={tag}>{tag}</option>)}
          </select>
        ) : null}
        <button className="ghost compact" type="button" disabled={busy} onClick={() => exportLibraryBackup("json")}>
          JSON
        </button>
        <button className="ghost compact" type="button" disabled={busy} onClick={() => exportLibraryBackup("markdown")}>
          Markdown
        </button>
        <button className="primary small" type="button" disabled={busy} onClick={() => exportLibraryBackup("zip")}>
          ZIP
        </button>
        <button className="icon-btn" type="button" disabled={busy} onClick={() => refreshTreeAfterChange()} title="Actualizar Firestore">
          <RefreshCw size={15} />
        </button>
      </header>
      {driveError ? (
        <div className="drive-setup-warning">
          <strong>Error de sincronizacion</strong>
          <small>{driveError}</small>
        </div>
      ) : null}
      {restoreProgress ? <RestoreProgress progress={restoreProgress} /> : null}
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
              â† Panel de administracion
            </button>
          </div>
          <div className="mobile-sidebar-title">
            <strong>Mis documentos</strong>
            <button className="icon-btn" type="button" onClick={() => setMobileConfigOpen(true)} title="Configuracion local">
              âš™ï¸
            </button>
          </div>
          {renderMobileTreeStatus()}
          {renderSidebarTree()}
        </MobileFolderDrawer>
        {mobileConfigOpen ? (
          <MobileLocalConfigSheet
            settings={storageSettings}
            syncStatus={syncStatus}
            busy={busy}
            onClose={() => setMobileConfigOpen(false)}
            onRefreshLocalTree={async () => {
              await refreshTreeAfterChange();
              onToast?.("Arbol actualizado desde Firestore");
            }}
            onExportBackup={exportLibraryBackup}
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
          onCreateAiDocument={createAiDocument}
          onOpenDocument={selectDocument}
          onOpenStorageConfig={() => setStorageConfigOpen(true)}
          onRefreshTree={() => refreshTreeAfterChange()}
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
          busy={busy}
          onClose={() => setStorageConfigOpen(false)}
          onRefreshLocalTree={async () => {
            await refreshTreeAfterChange();
            onToast?.("Arbol actualizado desde Firestore");
          }}
          onExportBackup={exportLibraryBackup}
        />
      ) : null}
    </section>
  );

  function showFirestoreError(error, { alert = true } = {}) {
    const message = error?.message || "No se pudo completar la operacion en Firestore.";
    setDriveError(message);
    onToast?.(message);
    if (alert) window.alert(message);
  }

  function renderMobileTreeStatus() {
    const hasFirestoreItems = folders.length || documents.length;
    if (!hasFirestoreItems) {
      return (
        <div className="mobile-drive-empty">
          <p className="drive-tree-message">No hay carpetas o documentos en Firestore todavia.</p>
        </div>
      );
    }
    return null;
  }
}

function MobileLocalConfigSheet({
  settings,
  syncStatus,
  busy,
  onClose,
  onRefreshLocalTree,
  onExportBackup,
}) {
  return (
    <div className="mobile-config-backdrop" role="presentation">
      <section className="mobile-config-sheet">
        <header>
          <strong>Biblioteca Firestore</strong>
          <button className="icon-btn" type="button" onClick={onClose}>x</button>
        </header>
        <button className="ghost compact" type="button" disabled={busy} onClick={onRefreshLocalTree}>Releer Firestore</button>
        <button className="ghost compact" type="button" disabled={busy} onClick={() => onExportBackup?.("json")}>Exportar JSON</button>
        <button className="ghost compact" type="button" disabled={busy} onClick={() => onExportBackup?.("markdown")}>Exportar Markdown</button>
        <button className="primary small" type="button" disabled={busy} onClick={() => onExportBackup?.("zip")}>Exportar ZIP</button>
        <div className="mobile-config-status">
          <strong>Estado actual</strong>
          <StoragePathRow label="Fuente" value="Firestore" />
          <StoragePathRow label="Ultima exportacion" value={formatDriveDate(settings.lastBackupAt) || "Sin exportar"} />
          <StoragePathRow label="Estado" value={mobileSyncStatusLabel(syncStatus.status)} />
        </div>
      </section>
    </div>
  );
}
function mobileSyncStatusLabel(status) {
  const labels = {
    backed_up: "ðŸŸ¢ Sincronizado",
    synced: "ðŸŸ¢ Sincronizado",
    local_only: "ðŸŸ¢ Local activo",
    modified_local: "ðŸŸ¡ Cambios locales pendientes",
    pending_upload: "ðŸŸ¡ Cambios locales pendientes",
    conflict: "ðŸ”´ Conflicto",
    offline: "ðŸŸ¡ Sin conexion",
  };
  return labels[status] || "ðŸŸ¢ Local activo";
}

function sortFolders(folders) {
  return [...folders].sort((a, b) => compareTreeItems(a, b));
}

function StorageStateIndicator({ status }) {
  const config = {
    local_only: { icon: "ðŸŸ¢", label: "Local activo" },
    modified_local: { icon: "ðŸŸ¡", label: "Cambios sin respaldar" },
    backed_up: { icon: "â˜ï¸", label: "Sincronizado en Firestore" },
    offline: { icon: "ðŸŸ¢", label: "Local activo sin conexion" },
  };
  const fixedConfig = {
    local_only: { icon: "\u{1F7E2}", label: "Firestore activo" },
    modified_local: { icon: "\u{1F7E1}", label: "Guardando cambios" },
    backed_up: { icon: "\u2601\uFE0F", label: "Sincronizado en Firestore" },
    synced: { icon: "\u2601\uFE0F", label: "Sincronizado en Firestore" },
    offline: { icon: "\u{1F7E2}", label: "Firestore activo sin conexion" },
  };
  const item = fixedConfig[status] || fixedConfig.local_only;
  return <span className={`storage-state-indicator ${status || "local_only"}`} title={item.label}>{item.icon} {item.label}</span>;
}

function RestoreProgress({ progress, onAction }) {
  const steps = [
    ["starting", "Iniciando respaldo"],
    ["reading_firestore", "Leyendo Firestore"],
    ["folders", "Encontrando carpetas"],
    ["downloading", "Descargando archivos"],
    ["restoring", "Preparando contenido"],
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
        <strong>{progress?.label || "Preparando respaldo"}</strong>
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
  busy,
  onClose,
  onRefreshLocalTree,
  onExportBackup,
}) {
  return (
    <div className="export-modal-backdrop">
      <section className="export-modal storage-config-modal">
        <header>
          <strong className="storage-config-title-desktop">Biblioteca Firestore</strong>
          <strong className="storage-config-title-mobile">Firestore</strong>
          <button className="icon-btn" type="button" onClick={onClose}>x</button>
        </header>

        <div className="storage-config-desktop-detail">
          <div className="storage-config-section">
            <h3>Fuente principal</h3>
            <StoragePathRow label="Base" value="Cloud Firestore" />
            <StoragePathRow label="Coleccion documentos" value="ashramDocuments" />
            <StoragePathRow label="Coleccion carpetas" value="ashramFolders" />
            <button className="ghost compact" type="button" disabled={busy} onClick={onRefreshLocalTree}>Releer Firestore</button>
            <small>La biblioteca lee y escribe directamente en Firestore.</small>
          </div>

          <div className="storage-config-section">
            <h3>Respaldo sin Drive</h3>
            <div className="storage-config-actions">
              <button className="ghost compact" type="button" disabled={busy} onClick={() => onExportBackup?.("json")}>Exportar JSON</button>
              <button className="ghost compact" type="button" disabled={busy} onClick={() => onExportBackup?.("markdown")}>Exportar Markdown</button>
              <button className="primary small" type="button" disabled={busy} onClick={() => onExportBackup?.("zip")}>Exportar ZIP</button>
            </div>
          </div>

          <div className="storage-config-section">
            <h3>Workspace</h3>
            <div className="storage-config-grid">
              <StoragePathRow label="Nombre" value={workspace?.name || workspace?.nombre || "Ashram Ganesha"} />
              <StoragePathRow label="Carpetas" value={String(foldersCount)} />
              <StoragePathRow label="Documentos" value={String(documentsCount)} />
              <StoragePathRow label="Ultima exportacion" value={formatDriveDate(settings.lastBackupAt || workspace?.lastBackupAt) || "Sin exportar"} />
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




