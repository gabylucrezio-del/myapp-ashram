import React from "react";
import { ArrowLeft, ArrowRight, Scissors, Trash2 } from "lucide-react";

export default function ToolBar({ onSplit, onDelete, onMoveLeft, onMoveRight, disabled }) {
  return (
    <section className="panel-block">
      <div className="tool-grid">
        <button type="button" onClick={onSplit} disabled={disabled} title="Dividir clip">
          <Scissors size={22} />
          <span>Dividir</span>
        </button>
        <button type="button" onClick={onDelete} disabled={disabled} title="Eliminar clip">
          <Trash2 size={22} />
          <span>Borrar</span>
        </button>
        <button type="button" onClick={onMoveLeft} disabled={disabled} title="Mover a la izquierda">
          <ArrowLeft size={22} />
          <span>Antes</span>
        </button>
        <button type="button" onClick={onMoveRight} disabled={disabled} title="Mover a la derecha">
          <ArrowRight size={22} />
          <span>Despues</span>
        </button>
      </div>
    </section>
  );
}
