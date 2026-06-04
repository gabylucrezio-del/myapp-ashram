import React from "react";
import { Music, Volume2, VolumeX } from "lucide-react";

export default function AudioTool({ selectedClip, onClipChange }) {
  return (
    <section className="panel-block">
      <div className="section-heading">
        <Music size={18} />
        <h2>Audio</h2>
      </div>
      <button
        className="wide-action"
        type="button"
        disabled={!selectedClip}
        onClick={() => onClipChange(selectedClip.id, { muted: !selectedClip.muted })}
      >
        {selectedClip?.muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
        {selectedClip?.muted ? "Activar audio original" : "Mutear audio original"}
      </button>
      <label className="field">
        Volumen original
        <input
          disabled={!selectedClip}
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={selectedClip?.volume || 1}
          onChange={(event) => onClipChange(selectedClip.id, { volume: Number(event.target.value) })}
        />
      </label>
      <p className="tool-note">La musica de fondo queda preparada para la segunda etapa con FFmpeg nativo.</p>
    </section>
  );
}
