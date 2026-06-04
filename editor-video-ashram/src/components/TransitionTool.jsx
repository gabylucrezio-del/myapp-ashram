import React from "react";
import { Sparkles } from "lucide-react";

const transitions = [
  ["none", "Sin transicion"],
  ["fade", "Fade"],
  ["dissolve", "Disolver"],
  ["soft-light", "Luz suave"],
  ["golden", "Fundido dorado"],
  ["ease", "Entrada suave"],
];

export default function TransitionTool({ selectedClip, onClipChange }) {
  return (
    <section className="panel-block">
      <div className="section-heading">
        <Sparkles size={18} />
        <h2>Transicion</h2>
      </div>
      <label className="field">
        Entre clips
        <select
          disabled={!selectedClip}
          value={selectedClip?.transition || "none"}
          onChange={(event) => onClipChange(selectedClip.id, { transition: event.target.value })}
        >
          {transitions.map(([value, label]) => (
            <option value={value} key={value}>{label}</option>
          ))}
        </select>
      </label>
    </section>
  );
}
