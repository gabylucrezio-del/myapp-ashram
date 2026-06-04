import SyncStatusDot from "./SyncStatusDot";
import ItemOptionsMenu from "./ItemOptionsMenu";
import { iconFor } from "./documentIcons";
import { getDisplayName } from "./displayName";

export default function DocumentItem({ document, active, depth, onSelect, onRename, onDelete, onDragStart, onDragEnd }) {
  const DocumentIcon = iconFor(document.icon, "document");
  const documentKey = document.path || document.id;
  return (
    <div
      className={`doc-tree-file ${active ? "active" : ""}`}
      style={{ "--tree-depth": depth }}
      draggable
      onDragStart={(event) => onDragStart?.(event, document)}
      onDragEnd={onDragEnd}
    >
      <button type="button" onClick={() => onSelect(documentKey)}>
        <span className="custom-tree-icon" style={{ color: document.color || document.iconColor || "#6c6840" }}>
          <DocumentIcon key={`${document.id}-${document.icon}-${document.color || document.iconColor}`} size={16} />
        </span>
        <span>
          <strong>{document.displayName || getDisplayName(document.title || document.name || "Sin titulo")}</strong>
          <small>{formatDate(document.updatedAt)}</small>
        </span>
      </button>
      <SyncStatusDot status={document.statusSync || document.syncStatus} />
      <ItemOptionsMenu
        onRename={() => onRename(document, "name")}
        onChangeIcon={() => onRename(document, "icon")}
        onChangeColor={() => onRename(document, "color")}
        onDelete={() => onDelete(document)}
      />
    </div>
  );
}

function formatDate(value) {
  if (!value) return "sin fecha";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "sin fecha";
  return date.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" });
}
