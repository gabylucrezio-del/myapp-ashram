import React from "react";
import { Image, Type } from "lucide-react";
import TimelineTrack from "./TimelineTrack.jsx";
import { formatTime } from "../utils/time";

const effects = [
  ["none", "Sin efecto"],
  ["fade-in", "Fade in"],
  ["fade-out", "Fade out"],
  ["from-bottom", "Desde abajo"],
  ["from-top", "Desde arriba"],
  ["soft-zoom", "Zoom suave"],
  ["typing", "Escritura"],
];

export default function TextTrack({ label, items, secondsToPx, compact, editable, onItemChange, onItemDelete }) {
  return (
    <TimelineTrack label={label} icon={compact ? Image : Type}>
      {items.length === 0 ? (
        <div className="timeline-track-empty">{label}</div>
      ) : (
        items.map((item) => (
          <TextTimelineBlock
            key={item.id}
            item={item}
            compact={compact}
            editable={editable}
            secondsToPx={secondsToPx}
            onItemChange={onItemChange}
            onItemDelete={onItemDelete}
          />
        ))
      )}
    </TimelineTrack>
  );
}

function TextTimelineBlock({ item, compact, editable, secondsToPx, onItemChange, onItemDelete }) {
  const start = item.start || 0;
  const end = item.end || start + 5;
  const duration = Math.max(end - start, 0.5);

  function patch(patchValue) {
    onItemChange?.(item.id, patchValue);
  }

  return (
    <div
      className={`text-timeline-block ${compact ? "overlay" : ""}`}
      draggable={editable}
      style={{
        marginLeft: `${start * secondsToPx}px`,
        width: `${Math.max(duration * secondsToPx, 132)}px`,
      }}
    >
      <span className="text-block-label">{item.value}</span>
      {editable && !compact && (
        <span className="text-block-editor">
          <input value={item.value} onChange={(event) => patch({ value: event.target.value })} />
          <span>{formatTime(start)} / {duration.toFixed(1)}s</span>
          <input
            type="number"
            min="0"
            step="0.1"
            value={start.toFixed(1)}
            onChange={(event) => {
              const nextStart = Number(event.target.value);
              patch({ start: nextStart, end: nextStart + duration });
            }}
          />
          <input
            type="number"
            min="0.5"
            step="0.5"
            value={duration.toFixed(1)}
            onChange={(event) => patch({ end: start + Number(event.target.value) })}
          />
          <select value={item.effectIn || "none"} onChange={(event) => patch({ effectIn: event.target.value })}>
            {effects.map(([value, label]) => <option value={value} key={value}>{label}</option>)}
          </select>
          <button type="button" onClick={() => onItemDelete?.(item.id)}>Eliminar</button>
        </span>
      )}
      {editable && !compact && (
        <>
          <label className="text-resize-handle left">
            <input
              type="range"
              min="0"
              max={Math.max(end - 0.5, 0.5)}
              step="0.1"
              value={start}
              onChange={(event) => patch({ start: Number(event.target.value) })}
            />
          </label>
          <label className="text-resize-handle right">
            <input
              type="range"
              min={start + 0.5}
              max={Math.max(end + 20, 20)}
              step="0.1"
              value={end}
              onChange={(event) => patch({ end: Number(event.target.value) })}
            />
          </label>
        </>
      )}
    </div>
  );
}
