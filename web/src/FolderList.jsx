import { Edit3, Folder, Plus, Trash2 } from "lucide-react";

export default function FolderList({ folders, notes, selectedFolderId, onSelectFolder, onCreateFolder, onEditFolder, onDeleteFolder, onCreateNote }) {
  const rootFolders = folders.filter((folder) => !folder.parentId);

  return (
    <aside className="folder-list">
      <div className="folder-list-head">
        <h2>Carpetas</h2>
        <button className="icon-btn" type="button" onClick={onCreateFolder} title="Nueva carpeta">
          <Plus size={18} />
        </button>
      </div>
      <button className={`folder-row ${selectedFolderId === "" ? "active" : ""}`} type="button" onClick={() => onSelectFolder("")}>
        <Folder size={18} />
        <span>
          <strong>Todas</strong>
          <small>{notes.length} notas</small>
        </span>
      </button>
      {rootFolders.map((folder) => (
        <FolderBranch
          key={folder.id}
          folder={folder}
          folders={folders}
          notes={notes}
          selectedFolderId={selectedFolderId}
          depth={0}
          onSelectFolder={onSelectFolder}
          onCreateNote={onCreateNote}
          onEditFolder={onEditFolder}
          onDeleteFolder={onDeleteFolder}
        />
      ))}
    </aside>
  );
}

function FolderBranch({ folder, folders, notes, selectedFolderId, depth, onSelectFolder, onCreateNote, onEditFolder, onDeleteFolder }) {
  const count = notes.filter((note) => note.folderId === folder.id).length;
  const children = folders.filter((item) => item.parentId === folder.id);

  return (
    <div className="folder-branch">
      <div className={`folder-row-wrap ${selectedFolderId === folder.id ? "active" : ""}`} style={{ "--folder-depth": depth }}>
        <button className="folder-row" type="button" onClick={() => onSelectFolder(folder.id)}>
          <Folder size={18} />
          <span>
            <strong>{folder.nombre}</strong>
            <small>{count} notas</small>
          </span>
        </button>
        <button className="icon-btn" type="button" onClick={() => onCreateNote(folder.id)} title="Nueva nota">
          <Plus size={16} />
        </button>
        <button className="icon-btn" type="button" onClick={() => onEditFolder(folder)} title="Editar carpeta">
          <Edit3 size={16} />
        </button>
        <button className="icon-btn danger" type="button" onClick={() => onDeleteFolder(folder)} title="Eliminar carpeta">
          <Trash2 size={16} />
        </button>
      </div>
      {children.map((child) => (
        <FolderBranch
          key={child.id}
          folder={child}
          folders={folders}
          notes={notes}
          selectedFolderId={selectedFolderId}
          depth={depth + 1}
          onSelectFolder={onSelectFolder}
          onCreateNote={onCreateNote}
          onEditFolder={onEditFolder}
          onDeleteFolder={onDeleteFolder}
        />
      ))}
    </div>
  );
}
