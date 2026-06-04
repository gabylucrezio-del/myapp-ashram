import React from "react";
import { SlidersHorizontal } from "lucide-react";

const effects = [
  ["none", "Normal"],
  ["brightness(1.08)", "Brillo suave"],
  ["contrast(1.12)", "Contraste"],
  ["sepia(0.18) saturate(1.08)", "Calido"],
  ["brightness(1.06) sepia(0.2) contrast(1.05)", "Espiritual calido"],
];

export default function EffectsTool({ project, onProjectChange }) {
  return (
    <section className="panel-block">
      <div className="section-heading">
        <SlidersHorizontal size={18} />
        <h2>Efectos</h2>
      </div>
      <label className="field">
        Look
        <select
          value={project.effect || "none"}
          onChange={(event) => onProjectChange((current) => ({ ...current, effect: event.target.value }))}
        >
          {effects.map(([value, label]) => (
            <option value={value} key={value}>{label}</option>
          ))}
        </select>
      </label>
    </section>
  );
}
