import React from "react";
import { Upload } from "lucide-react";

export default function VideoImporter({ onFiles }) {
  return (
    <section className="panel-block">
      <div className="section-heading">
        <Upload size={18} />
        <h2>Importar</h2>
      </div>
      <label className="import-box" htmlFor="video-importer">
        <input
          id="video-importer"
          type="file"
          accept="video/*"
          multiple
          onChange={(event) => onFiles(Array.from(event.target.files || []))}
        />
        <Upload size={24} />
        <strong>Videos del celular</strong>
        <small>Selecciona uno o varios clips.</small>
      </label>
    </section>
  );
}
