import React from "react";
import { BadgePlus, Image } from "lucide-react";

export default function LogoTool({ project, onProjectChange }) {
  function setLogoFile(file) {
    if (!file) return;
    onProjectChange((current) => ({
      ...current,
      logo: {
        url: URL.createObjectURL(file),
        size: current.logo?.size || 18,
        opacity: current.logo?.opacity || 0.85,
        position: current.logo?.position || "top-right",
      },
    }));
  }

  function patchLogo(patch) {
    onProjectChange((current) => ({
      ...current,
      logo: { ...(current.logo || { size: 18, opacity: 0.85, position: "top-right" }), ...patch },
    }));
  }

  return (
    <section className="panel-block">
      <div className="section-heading">
        <Image size={18} />
        <h2>Logo</h2>
      </div>
      <label className="soft-upload">
        <input type="file" accept="image/png,image/*" onChange={(event) => setLogoFile(event.target.files?.[0])} />
        <BadgePlus size={18} />
        Cargar PNG
      </label>
      <label className="field">
        Posicion
        <select value={project.logo?.position || "top-right"} onChange={(event) => patchLogo({ position: event.target.value })}>
          <option value="top-right">Arriba derecha</option>
          <option value="top-left">Arriba izquierda</option>
          <option value="bottom-right">Abajo derecha</option>
          <option value="bottom-left">Abajo izquierda</option>
        </select>
      </label>
      <label className="field">
        Tamano
        <input type="range" min="8" max="34" value={project.logo?.size || 18} onChange={(event) => patchLogo({ size: Number(event.target.value) })} />
      </label>
      <label className="field">
        Opacidad
        <input type="range" min="0.2" max="1" step="0.05" value={project.logo?.opacity || 0.85} onChange={(event) => patchLogo({ opacity: Number(event.target.value) })} />
      </label>
    </section>
  );
}
