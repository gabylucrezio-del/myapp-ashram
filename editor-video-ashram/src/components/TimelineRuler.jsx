import React from "react";
import { formatTime } from "../utils/time";

export default function TimelineRuler({ totalDuration, secondsToPx }) {
  const marks = Array.from({ length: Math.ceil(totalDuration / 2) + 1 }).map((_, index) => index * 2);

  return (
    <div className="timeline-ruler-modern" style={{ "--timeline-width": `${Math.max(totalDuration * secondsToPx, 620)}px` }}>
      <div className="timeline-ruler-label-space" />
      <div className="timeline-ruler-scroll">
        {marks.map((second) => (
          <span className="timeline-ruler-mark" key={second} style={{ left: `${second * secondsToPx}px` }}>
            {formatTime(second)}
          </span>
        ))}
      </div>
    </div>
  );
}
