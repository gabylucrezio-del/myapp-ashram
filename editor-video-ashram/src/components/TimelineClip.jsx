import React, { memo, useMemo } from "react";
import ClipTrimHandles from "./ClipTrimHandles.jsx";
import { formatTime } from "../utils/time";

function TimelineClip({
  clip,
  index,
  secondsToPx,
  selected,
  onSelect,
  onClipChange,
  draggable,
  onDragStart,
  onDrop,
}) {
  const start = clip.trimStart || 0;
  const end = clip.trimEnd || clip.duration || 6;
  const duration = Math.max(end - start, 1);
  const width = Math.max(duration * secondsToPx, 112);
  const thumbCount = useMemo(() => {
    const interval = duration > 40 ? 10 : 5;
    return Math.max(3, Math.min(10, Math.ceil(duration / interval)));
  }, [duration]);

  return (
    <button
      className={`timeline-clip ${selected ? "selected" : ""} ${clip.mock ? `mock-${clip.color}` : ""}`}
      type="button"
      style={{ width }}
      onClick={onSelect}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={(event) => event.preventDefault()}
      onDrop={onDrop}
    >
      <ClipTrimHandles clip={clip} onClipChange={onClipChange} enabled={selected && !clip.mock} />
      <span className="timeline-clip-thumbs" aria-hidden="true">
        {Array.from({ length: thumbCount }).map((_, thumbIndex) => (
          <span className="timeline-thumb" key={thumbIndex} />
        ))}
      </span>
      <span className="timeline-clip-name">{clip.name}</span>
      <span className="timeline-clip-time">{formatTime(start)} - {formatTime(end)}</span>
    </button>
  );
}

export default memo(TimelineClip);
