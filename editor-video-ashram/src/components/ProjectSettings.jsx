import React from "react";
import { Settings } from "lucide-react";

export default function ProjectSettings({ project, onProjectChange }) {
  return (
    <section className="panel-block">
      <div className="section-heading">
        <Settings size={18} />
        <h2>Proyecto</h2>
      </div>
      <label className="field">
        Nombre
        <input
          value={project.name}
          onChange={(event) => onProjectChange((current) => ({ ...current, name: event.target.value }))}
        />
      </label>
      <label className="field">
        Formato
        <select
          value={project.format}
          onChange={(event) => onProjectChange((current) => ({ ...current, format: event.target.value }))}
        >
          <option value="vertical">Vertical 9:16</option>
          <option value="horizontal">Horizontal 16:9</option>
          <option value="square">Cuadrado 1:1</option>
        </select>
      </label>
      <label className="field">
        Exportacion
        <select
          value={project.resolution}
          onChange={(event) => onProjectChange((current) => ({ ...current, resolution: event.target.value }))}
        >
          <option value="1080p">1080p</option>
          <option value="720p">720p</option>
        </select>
      </label>
    </section>
  );
}
