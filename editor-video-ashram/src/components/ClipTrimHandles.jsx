import React from "react";

export default function ClipTrimHandles({ clip, onClipChange, enabled }) {
  if (!enabled) {
    return (
      <>
        <span className="trim-handle left" />
        <span className="trim-handle right" />
      </>
    );
  }

  const duration = Math.max(clip.duration || 1, 1);
  const end = clip.trimEnd || duration;

  return (
    <>
      <label className="trim-handle left active" title="Recortar inicio">
        <input
          type="range"
          min="0"
          max={Math.max(end - 0.4, 0.5)}
          step="0.1"
          value={clip.trimStart || 0}
          onClick={(event) => event.stopPropagation()}
          onChange={(event) => onClipChange({ trimStart: Number(event.target.value) })}
        />
      </label>
      <label className="trim-handle right active" title="Recortar final">
        <input
          type="range"
          min={(clip.trimStart || 0) + 0.4}
          max={duration}
          step="0.1"
          value={end}
          onClick={(event) => event.stopPropagation()}
          onChange={(event) => onClipChange({ trimEnd: Number(event.target.value) })}
        />
      </label>
    </>
  );
}
