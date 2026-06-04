import { ChevronRight, FilePlus, FolderPlus } from "lucide-react";
import { useEffect, useState } from "react";
import DocumentItem from "./DocumentItem";
import ItemOptionsMenu from "./ItemOptionsMenu";
import { iconFor } from "./documentIcons";

export default function FolderItem({
  folder,
  folders,
  documents,
  activeFolderId,
  activeDocumentId,
  expandedFolderIds = [],
  onToggleOpen,
  depth = 0,
  onSelectFolder,
  onSelectDocument,
  onCreateFolder,
  onCreateDocument,
  onRenameFolder,
  onRenameDocument,
  onDeleteFolder,
  onDeleteDocument,
  onMoveDocument,
  onDocumentDragStart,
  onDocumentDragEnd,
}) {
  const [open, setOpen] = useState(true);
  const [dragOver, setDragOver] = useState(false);
  const childFolders = folders.filter((item) => item.parentId === folder.id);
  const childDocuments = documents.filter((item) => item.folderId === folder.id);
  const active = activeFolderId === folder.id;
  const FolderIcon = iconFor(folder.icon, "folder");
  const shouldForceOpen = active || expandedFolderIds.includes(folder.id) || childFolders.some((item) => item.id === activeFolderId) || childDocuments.some((item) => item.id === activeDocumentId);

  useEffect(() => {
    if (shouldForceOpen) setOpen(true);
  }, [shouldForceOpen]);

  function toggleOpen() {
    setOpen((current) => {
      const next = !current;
      onToggleOpen?.(folder.id, next);
      return next;
    });
  }

  function handleDragOver(event) {
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "move";
    setDragOver(true);
  }

  function handleDrop(event) {
    event.preventDefault();
    event.stopPropagation();
    setDragOver(false);
    onMoveDocument?.(folder.id);
  }

  return (
    <div className="doc-folder-branch">
      <div
        className={`doc-tree-folder ${active ? "active" : ""} ${dragOver ? "drop-target" : ""}`}
        style={{ "--tree-depth": depth }}
        onDragOver={handleDragOver}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        <button className="doc-folder-toggle" type="button" onClick={toggleOpen} title={open ? "Cerrar carpeta" : "Abrir carpeta"}>
          <ChevronRight className={open ? "open" : ""} size={15} />
        </button>
        <button className="doc-folder-main" type="button" onClick={() => onSelectFolder(folder.id)}>
          <span className="custom-tree-icon" style={{ color: folder.color || folder.iconColor || "#d9a51f" }}>
            <FolderIcon key={`${folder.id}-${folder.icon}-${folder.color || folder.iconColor}`} size={17} />
          </span>
          <span>
            <strong>{folder.title}</strong>
            <small>{childFolders.length + childDocuments.length} elementos</small>
          </span>
        </button>
        <button className="icon-btn" type="button" onClick={() => onCreateFolder(folder.id)} title="Crear subcarpeta">
          <FolderPlus size={14} />
        </button>
        <button className="icon-btn" type="button" onClick={() => onCreateDocument(folder.id)} title="Crear documento">
          <FilePlus size={14} />
        </button>
        <ItemOptionsMenu
          onRename={() => onRenameFolder(folder, "name")}
          onChangeIcon={() => onRenameFolder(folder, "icon")}
          onChangeColor={() => onRenameFolder(folder, "color")}
          onDelete={() => onDeleteFolder(folder)}
        />
      </div>
      {open ? (
        <div className="doc-tree-children">
          {childFolders.map((child) => (
            <FolderItem
              key={child.path || child.id}
              folder={child}
              folders={folders}
              documents={documents}
              activeFolderId={activeFolderId}
              activeDocumentId={activeDocumentId}
              expandedFolderIds={expandedFolderIds}
              onToggleOpen={onToggleOpen}
              depth={depth + 1}
              onSelectFolder={onSelectFolder}
              onSelectDocument={onSelectDocument}
              onCreateFolder={onCreateFolder}
              onCreateDocument={onCreateDocument}
              onRenameFolder={onRenameFolder}
              onRenameDocument={onRenameDocument}
              onDeleteFolder={onDeleteFolder}
              onDeleteDocument={onDeleteDocument}
              onMoveDocument={onMoveDocument}
              onDocumentDragStart={onDocumentDragStart}
              onDocumentDragEnd={onDocumentDragEnd}
            />
          ))}
          {childDocuments.map((document) => (
            <DocumentItem
              key={document.path || document.id}
              document={document}
              active={activeDocumentId === document.id}
              depth={depth + 1}
              onSelect={onSelectDocument}
              onRename={onRenameDocument}
              onDelete={onDeleteDocument}
              onDragStart={onDocumentDragStart}
              onDragEnd={onDocumentDragEnd}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
