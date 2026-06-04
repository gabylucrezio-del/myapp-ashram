import { FilePlus, FolderOpen, FolderPlus } from "lucide-react";
import { useState } from "react";
import DocumentItem from "./DocumentItem";
import FolderItem from "./FolderItem";
import SearchDocuments from "./SearchDocuments";
import { iconFor } from "./documentIcons";

export default function SidebarTree({
  folders,
  documents,
  loading = false,
  activeFolderId,
  activeDocumentId,
  expandedFolderIds,
  onToggleFolderOpen,
  onSelectFolder,
  onSelectDocument,
  onCreateFolder,
  onCreateDocument,
  onRenameFolder,
  onRenameDocument,
  onDeleteFolder,
  onDeleteDocument,
  onMoveDocument,
  search,
  onSearchChange,
}) {
  const [draggedDocument, setDraggedDocument] = useState(null);
  const [rootDragOver, setRootDragOver] = useState(false);
  const rootFolders = folders.filter((folder) => !folder.parentId);
  const rootDocuments = documents.filter((document) => !document.folderId);
  const RootIcon = iconFor("folder", "folder");

  function startDocumentDrag(event, document) {
    setDraggedDocument(document);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", document.id || document.path || "");
  }

  function moveDraggedDocument(targetFolderId = "") {
    if (!draggedDocument) return;
    onMoveDocument?.(draggedDocument, targetFolderId);
    setDraggedDocument(null);
    setRootDragOver(false);
  }

  function handleRootDragOver(event) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setRootDragOver(true);
  }

  return (
    <aside className="documents-sidebar">
      <div className="documents-sidebar-head">
        <span>
          <strong>Mis Documentos</strong>
          <small>{folders.length} carpetas · {documents.length} documentos</small>
        </span>
        <button className="icon-btn" type="button" onClick={() => onCreateFolder(null)} title="Crear carpeta en raiz">
          <FolderPlus size={16} />
        </button>
      </div>
      <SearchDocuments value={search} onChange={onSearchChange} />
      <div className="documents-sidebar-actions">
        <button className="ghost compact" type="button" onClick={() => onCreateFolder()}>
          <FolderPlus size={15} /> Carpeta
        </button>
        <button className="primary small" type="button" onClick={() => onCreateDocument()}>
          <FilePlus size={15} /> Documento
        </button>
      </div>
      <button
        className={`doc-root-row ${activeFolderId === "" ? "active" : ""} ${rootDragOver ? "drop-target" : ""}`}
        type="button"
        onClick={() => onSelectFolder("")}
        onDragOver={handleRootDragOver}
        onDragLeave={() => setRootDragOver(false)}
        onDrop={(event) => {
          event.preventDefault();
          moveDraggedDocument("");
        }}
      >
        <span className="custom-tree-icon" style={{ color: "#d9a51f" }}>
          <RootIcon size={17} />
        </span>
        <span>
          <strong>Workspace Ashram</strong>
          <small>Raiz local</small>
        </span>
      </button>
      <div className="doc-tree">
        {loading ? (
          <p className="drive-tree-message">Cargando carpetas de Google Drive...</p>
        ) : null}
        {!loading && !rootFolders.length && !rootDocuments.length ? (
          <p className="drive-tree-message">No hay carpetas ni documentos para mostrar.</p>
        ) : null}
        {rootFolders.map((folder) => (
          <FolderItem
            key={folder.path || folder.id}
            folder={folder}
            folders={folders}
            documents={documents}
            activeFolderId={activeFolderId}
            activeDocumentId={activeDocumentId}
            expandedFolderIds={expandedFolderIds}
            onToggleOpen={onToggleFolderOpen}
            onSelectFolder={onSelectFolder}
            onSelectDocument={onSelectDocument}
            onCreateFolder={onCreateFolder}
            onCreateDocument={onCreateDocument}
            onRenameFolder={onRenameFolder}
            onRenameDocument={onRenameDocument}
            onDeleteFolder={onDeleteFolder}
            onDeleteDocument={onDeleteDocument}
            onMoveDocument={moveDraggedDocument}
            onDocumentDragStart={startDocumentDrag}
            onDocumentDragEnd={() => {
              setDraggedDocument(null);
              setRootDragOver(false);
            }}
          />
        ))}
        {rootDocuments.map((document) => (
          <DocumentItem
            key={document.path || document.id}
            document={document}
            active={activeDocumentId === document.id}
            depth={0}
            onSelect={onSelectDocument}
            onRename={onRenameDocument}
            onDelete={onDeleteDocument}
            onDragStart={startDocumentDrag}
            onDragEnd={() => {
              setDraggedDocument(null);
              setRootDragOver(false);
            }}
          />
        ))}
      </div>
    </aside>
  );
}
