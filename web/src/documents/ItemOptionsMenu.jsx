import { MoreVertical, Palette, Pencil, Shapes, Trash2 } from "lucide-react";
import { useState } from "react";

export default function ItemOptionsMenu({ onRename, onChangeIcon, onChangeColor, onDelete }) {
  const [open, setOpen] = useState(false);

  function choose(action) {
    setOpen(false);
    action();
  }

  return (
    <div className="item-options">
      <button className="icon-btn" type="button" onClick={() => setOpen((current) => !current)} title="Opciones">
        <MoreVertical size={14} />
      </button>
      {open ? (
        <div className="item-options-menu">
          <button type="button" onClick={() => choose(onRename)}><Pencil size={14} /> Renombrar</button>
          <button type="button" onClick={() => choose(onChangeIcon)}><Shapes size={14} /> Cambiar icono</button>
          <button type="button" onClick={() => choose(onChangeColor)}><Palette size={14} /> Cambiar color</button>
          <button className="danger" type="button" onClick={() => choose(onDelete)}><Trash2 size={14} /> Eliminar</button>
        </div>
      ) : null}
    </div>
  );
}
