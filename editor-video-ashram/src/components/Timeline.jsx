import React from "react";
import { Film, Scissors, Trash2, Volume2, VolumeX, ZoomIn, ZoomOut } from "lucide-react";
import { useState } from "react";
import { clamp, formatTime } from "../utils/time";

export default function Timeline({
  project,
  selectedClip,
  onImportClick,
  onSelect,
  onClipChange,
  onPlayheadChange,
  onSplit,
  onMarkStart,
  onMarkEnd,
  onDeleteRange,
}) {
  const [zoom, setZoom] = useState(1);
  const duration = Math.max(selectedClip?.duration || 0, 0);
  const trimStart = selectedClip?.trimStart || 0;
  const trimEnd = selectedClip?.trimEnd || duration;
  const playhead = selectedClip?.playhead ?? trimStart;
  const cutStart = selectedClip?.cutStart ?? null;
  const cutEnd = selectedClip?.cutEnd ?? null;

  return (
    <section className="timeline-panel">
      <div className="timeline-head">
        <span className="timeline-title">
          <Film size={18} />
          <strong>Linea de tiempo</strong>
        </span>
        <div className="tiny-actions">
          <button type="button" onClick={() => setZoom((value) => clamp(value - 0.25, 0.75, 2))} aria-label="Alejar">
            <ZoomOut size={17} />
          </button>
          <button type="button" onClick={() => setZoom((value) => clamp(value + 0.25, 0.75, 2))} aria-label="Acercar">
            <ZoomIn size={17} />
          </button>
        </div>
      </div>
      <div className="timeline-ruler" aria-hidden="true">
        <span>{formatTime(trimStart)}</span>
        <span>{selectedClip ? selectedClip.name : "Sin clip"}</span>
        <span>{formatTime(trimEnd)}</span>
      </div>
      <div className="cut-controls">
        <label className="playhead-control">
          <span>{formatTime(playhead)}</span>
          <input
            type="range"
            min={trimStart}
            max={trimEnd || 1}
            step="0.1"
            value={playhead}
            disabled={!selectedClip}
            onChange={(event) => onPlayheadChange(Number(event.target.value))}
          />
        </label>
        <button type="button" disabled={!selectedClip} onClick={onMarkStart}>
          <Scissors size={17} />
          Marcar inicio
        </button>
        <button type="button" disabled={!selectedClip} onClick={onSplit}>
          <Scissors size={17} />
          Cortar
        </button>
        <button type="button" disabled={!selectedClip} onClick={onMarkEnd}>
          <Scissors size={17} />
          Marcar final
        </button>
        <button type="button" disabled={!selectedClip || cutStart == null || cutEnd == null} onClick={onDeleteRange}>
          <Trash2 size={17} />
          Borrar tramo
        </button>
      </div>
      <div className="timeline-workbench">
        <div className="video-track-controls">
          <button className="track-icon-button" type="button" onClick={onImportClick} aria-label="Importar video">
            <Film size={22} />
          </button>
          <button
            className={`track-icon-button ${selectedClip?.muted ? "muted" : ""}`}
            type="button"
            disabled={!selectedClip}
            onClick={() => selectedClip && onClipChange(selectedClip.id, { muted: !selectedClip.muted })}
            aria-label={selectedClip?.muted ? "Activar audio del video" : "Mutear video"}
            title={selectedClip?.muted ? "Activar audio del video" : "Mutear video"}
          >
            {selectedClip?.muted ? <VolumeX size={21} /> : <Volume2 size={21} />}
          </button>
        </div>
        <div
          className="clip-track video-track"
          style={{
            "--zoom": zoom,
            "--playhead": `${percent(playhead, trimStart, trimEnd)}%`,
            "--cut-start": `${percent(cutStart ?? trimStart, trimStart, trimEnd)}%`,
            "--cut-end": `${percent(cutEnd ?? trimStart, trimStart, trimEnd)}%`,
          }}
        >
          <div className="playhead" aria-hidden="true" />
          {cutStart != null && cutEnd != null && <div className="cut-range" aria-hidden="true" />}
          {project.clips.length === 0 ? (
            <div className="timeline-empty">Importa un video y aparecera aqui debajo del visor.</div>
          ) : (
            project.clips.map((clip, index) => (
              <ClipBlock
                key={clip.id}
                clip={clip}
                index={index}
                selected={clip.id === selectedClip?.id}
                onSelect={() => onSelect(clip.id)}
                onClipChange={onClipChange}
              />
            ))
          )}
        </div>
      </div>
    </section>
  );
}

function percent(value, start, end) {
  if (value == null || end <= start) return 0;
  return clamp(((value - start) / (end - start)) * 100, 0, 100);
}

function ClipBlock({ clip, index, selected, onSelect, onClipChange }) {
  const duration = Math.max(clip.duration || 1, 1);
  const end = clip.trimEnd || duration;
  const clipSeconds = Math.max(end - clip.trimStart, 1);
  const width = Math.max(280, Math.min(960, clipSeconds * 18));

  return (
    <button
      className={`clip-block ${selected ? "selected" : ""}`}
      type="button"
      style={{ "--clip-width": `${width}px` }}
      onClick={onSelect}
    >
      <span className="clip-index">{index + 1}</span>
      <span className="clip-thumb-wrap">
        <video className="clip-thumb" src={clip.objectUrl} muted playsInline preload="metadata" />
      </span>
      <span className="clip-meta">
        <strong>{clip.name}</strong>
        <small>{formatTime(clip.trimStart)} - {formatTime(end)}</small>
      </span>
      {selected && (
        <span className="trim-controls" onClick={(event) => event.stopPropagation()}>
          <label>
            Inicio
            <input
              type="range"
              min="0"
              max={Math.max(end - 0.5, 1)}
              step="0.1"
              value={clip.trimStart}
              onChange={(event) => onClipChange(clip.id, { trimStart: Number(event.target.value) })}
            />
          </label>
          <label>
            Final
            <input
              type="range"
              min={clip.trimStart + 0.5}
              max={duration}
              step="0.1"
              value={end}
              onChange={(event) => onClipChange(clip.id, { trimEnd: Number(event.target.value) })}
            />
          </label>
          <span className="clip-cut-hint">Usa el marcador rojo para elegir el tramo y borrarlo.</span>
        </span>
      )}
    </button>
  );
}
