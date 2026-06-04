import React from "react";
import { formatTime } from "../utils/time";

export default function TimelinePlayhead({ offset, time, onPointerDown }) {
  return (
    <button
      className="timeline-playhead"
      type="button"
      style={{ left: `${offset}px` }}
      onPointerDown={onPointerDown}
      aria-label={`Playhead ${formatTime(time)}`}
    >
      <span>{formatTime(time)}</span>
    </button>
  );
}
