import { Edit3, FileText, Folder, FolderOpen, FolderPlus, Plus, Trash2 } from "lucide-react";

export default function FolderList({
  folders,
  notes,
  selectedFolderId,
  selectedNoteId,
  onSelectFolder,
  onSelectNote,
  onCreateFolder,
  onEditFolder,
  onDeleteFolder,
  onCreateNote,
  onEditNote,
  onDeleteNote,
}) {
  const rootFolders = folders.filter((folder) => !folder.parentId);
  const rootNotes = notes.filter((note) => !note.folderId);

  return (
    <aside className="folder-list file-tree">
      <div className="folder-list-head">
        <h2>Explorador</h2>
        <button className="icon-btn" type="button" onClick={onCreateFolder} title="Nueva carpeta">
          <Plus size={18} />
        </button>
      </div>
      <button className={`folder-row ${selectedFolderId === "" ? "active" : ""}`} type="button" onClick={() => onSelectFolder("")}>
        <FolderOpen size={18} />
        <span>
          <strong>Mi cuaderno</strong>
          <small>{folders.length} carpetas · {notes.length} documentos</small>
        </span>
      </button>
      <div className="file-tree-children">
        {rootFolders.map((folder) => (
          <FolderBranch
            key={folder.id}
            folder={folder}
            folders={folders}
            notes={notes}
            selectedFolderId={selectedFolderId}
            selectedNoteId={selectedNoteId}
            depth={0}
            onSelectFolder={onSelectFolder}
            onSelectNote={onSelectNote}
            onCreateNote={onCreateNote}
            onEditFolder={onEditFolder}
            onDeleteFolder={onDeleteFolder}
            onEditNote={onEditNote}
            onDeleteNote={onDeleteNote}
          />
        ))}
        {rootNotes.map((note) => (
          <NoteFile
            key={note.id}
            note={note}
            selected={selectedNoteId === note.id}
            depth={0}
            onSelectNote={onSelectNote}
            onEditNote={onEditNote}
            onDeleteNote={onDeleteNote}
          />
        ))}
      </div>
    </aside>
  );
}

function FolderBranch({
  folder,
  folders,
  notes,
  selectedFolderId,
  selectedNoteId,
  depth,
  onSelectFolder,
  onSelectNote,
  onCreateNote,
  onEditFolder,
  onDeleteFolder,
  onEditNote,
  onDeleteNote,
}) {
  const children = folders.filter((item) => item.parentId === folder.id);
  const folderNotes = notes.filter((note) => note.folderId === folder.id);
  const count = folderNotes.length + children.length;

  return (
    <div className="folder-branch">
      <div className={`folder-row-wrap ${selectedFolderId === folder.id ? "active" : ""}`} style={{ "--folder-depth": depth }}>
        <button className="folder-row" type="button" onClick={() => onSelectFolder(folder.id)}>
          <Folder size={18} />
          <span>
            <strong>{folder.nombre}</strong>
            <small>{count} elementos</small>
          </span>
        </button>
        <button className="icon-btn" type="button" onClick={() => onCreateFolder(folder.id)} title="Nueva subcarpeta">
          <FolderPlus size={16} />
        </button>
        <button className="icon-btn" type="button" onClick={() => onCreateNote(folder.id)} title="Nuevo documento">
          <Plus size={16} />
        </button>
        <button className="icon-btn" type="button" onClick={() => onEditFolder(folder)} title="Editar carpeta">
          <Edit3 size={16} />
        </button>
        <button className="icon-btn danger" type="button" onClick={() => onDeleteFolder(folder)} title="Eliminar carpeta">
          <Trash2 size={16} />
        </button>
      </div>
      <div className="file-tree-children">
        {children.map((child) => (
          <FolderBranch
            key={child.id}
            folder={child}
            folders={folders}
            notes={notes}
            selectedFolderId={selectedFolderId}
            selectedNoteId={selectedNoteId}
            depth={depth + 1}
            onSelectFolder={onSelectFolder}
            onSelectNote={onSelectNote}
            onCreateNote={onCreateNote}
            onEditFolder={onEditFolder}
            onDeleteFolder={onDeleteFolder}
            onEditNote={onEditNote}
            onDeleteNote={onDeleteNote}
          />
        ))}
        {folderNotes.map((note) => (
          <NoteFile
            key={note.id}
            note={note}
            selected={selectedNoteId === note.id}
            depth={depth + 1}
            onSelectNote={onSelectNote}
            onEditNote={onEditNote}
            onDeleteNote={onDeleteNote}
          />
        ))}
      </div>
    </div>
  );
}

function NoteFile({ note, selected, depth, onSelectNote, onEditNote, onDeleteNote }) {
  return (
    <div className={`file-row-wrap ${selected ? "active" : ""}`} style={{ "--folder-depth": depth }}>
      <button className="file-row" type="button" onClick={() => onSelectNote(note.id)}>
        <FileText size={16} />
        <span>
          <strong>{note.titulo || "Sin titulo"}</strong>
          <small>{note.estado || "borrador"}</small>
        </span>
      </button>
      <button className="icon-btn" type="button" onClick={() => onEditNote(note)} title="Editar documento">
        <Edit3 size={15} />
      </button>
      <button className="icon-btn danger" type="button" onClick={() => onDeleteNote(note)} title="Eliminar documento">
        <Trash2 size={15} />
      </button>
    </div>
  );
}
