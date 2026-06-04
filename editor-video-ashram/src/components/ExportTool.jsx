import React from "react";
import { X } from "lucide-react";

export default function ExportTool({ state, plan, onClose }) {
  if (!state.open) return null;

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <section className="export-modal">
        <button className="icon-action close-button" type="button" onClick={onClose} aria-label="Cerrar">
          <X size={20} />
        </button>
        <h2>Exportar video</h2>
        <p>{state.message}</p>
        <div className="progress-bar">
          <span style={{ width: `${state.progress}%` }} />
        </div>
        <div className="export-plan">
          <strong>Plan MP4 Android</strong>
          <small>{plan.aspect} · {plan.target}p · {plan.output}</small>
          <ol>
            {plan.steps.slice(0, 5).map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </div>
      </section>
    </div>
  );
}
