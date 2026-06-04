import React from "react";
import { ZoomIn, ZoomOut } from "lucide-react";
import { clamp } from "../utils/time";

export default function TimelineZoomControls({ zoom, onZoomChange }) {
  return (
    <div className="timeline-zoom-controls">
      <button type="button" onClick={() => onZoomChange(clamp(zoom - 0.25, 0.75, 3))} aria-label="Alejar">
        <ZoomOut size={17} />
      </button>
      <span>{Math.round(zoom * 100)}%</span>
      <button type="button" onClick={() => onZoomChange(clamp(zoom + 0.25, 0.75, 3))} aria-label="Acercar">
        <ZoomIn size={17} />
      </button>
    </div>
  );
}
