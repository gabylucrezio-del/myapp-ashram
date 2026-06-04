import { useState } from "react";
import ColorPicker from "./ColorPicker";
import ExportModal from "./ExportModal";
import IconPicker from "./IconPicker";
import { iconFor } from "./documentIcons";

export default function RenameIconModal({ item, title, focus = "name", onClose, onSave }) {
  const isFolder = Object.prototype.hasOwnProperty.call(item || {}, "parentId");
  const fallbackIcon = isFolder ? "folder" : "document";
  const fallbackColor = isFolder ? "#d9a51f" : "#6c6840";
  const [name, setName] = useState(item?.title || "");
  const [icon, setIcon] = useState(item?.icon || fallbackIcon);
  const [color, setColor] = useState(item?.color || item?.iconColor || fallbackColor);
  const PreviewIcon = iconFor(icon, fallbackIcon);

  function submit(event) {
    event.preventDefault();
    if (!name.trim()) return;
    onSave({ ...item, title: name.trim(), icon, color, iconColor: color });
  }

  return (
    <ExportModal title={title} onClose={onClose}>
      <form className="rename-icon-form" onSubmit={submit}>
        <label>Nombre<input value={name} onChange={(event) => setName(event.target.value)} /></label>
        <div className="rename-icon-preview">
          <PreviewIcon size={22} style={{ color }} />
          <strong>{name || "Sin titulo"}</strong>
        </div>
        {focus !== "color" ? <><span>Icono</span><IconPicker value={icon} onChange={setIcon} /></> : null}
        {focus !== "icon" ? <><span>Color</span><ColorPicker value={color} onChange={setColor} /></> : null}
        <div className="export-actions">
          <button className="ghost compact" type="button" onClick={onClose}>Cancelar</button>
          <button className="primary small" type="submit">Guardar</button>
        </div>
      </form>
    </ExportModal>
  );
}
