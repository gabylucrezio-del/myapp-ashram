import React from "react";
import { Captions, Plus, Type } from "lucide-react";
import { uid } from "../utils/time";

export default function TextTool({ project, onProjectChange }) {
  function addText(kind) {
    onProjectChange((current) => ({
      ...current,
      texts: [
        ...current.texts,
        {
          id: uid("text"),
          kind,
          value: kind === "subtitle" ? "Subtitulo manual" : "Texto Ashram",
          color: "#fff8e7",
          size: kind === "subtitle" ? 18 : 24,
          start: 0,
          end: 8,
        },
      ],
    }));
  }

  function updateText(id, patch) {
    onProjectChange((current) => ({
      ...current,
      texts: current.texts.map((text) => (text.id === id ? { ...text, ...patch } : text)),
    }));
  }

  return (
    <section className="panel-block">
      <div className="section-heading">
        <Type size={18} />
        <h2>Texto</h2>
      </div>
      <div className="split-actions">
        <button type="button" onClick={() => addText("title")}>
          <Plus size={17} />
          Texto
        </button>
        <button type="button" onClick={() => addText("subtitle")}>
          <Captions size={17} />
          Subtitulo
        </button>
      </div>
      <div className="text-list">
        {project.texts.map((text) => (
          <label className="field" key={text.id}>
            {text.kind === "subtitle" ? "Subtitulo" : "Texto"}
            <input value={text.value} onChange={(event) => updateText(text.id, { value: event.target.value })} />
            <input type="range" min="14" max="44" value={text.size} onChange={(event) => updateText(text.id, { size: Number(event.target.value) })} />
          </label>
        ))}
      </div>
    </section>
  );
}
