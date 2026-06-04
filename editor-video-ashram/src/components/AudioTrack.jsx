import React, { memo } from "react";
import { Music } from "lucide-react";
import TimelineTrack from "./TimelineTrack.jsx";

function AudioTrack({ clips, selectedClipId, secondsToPx, onSelect }) {
  return (
    <TimelineTrack label="Audio" icon={Music}>
      {clips.map((clip, index) => {
        const duration = Math.max((clip.trimEnd || clip.duration || 6) - (clip.trimStart || 0), 1);
        return (
          <button
            className={`audio-wave-block ${clip.id === selectedClipId ? "selected" : ""}`}
            type="button"
            key={clip.id}
            style={{ width: Math.max(duration * secondsToPx, 112) }}
            onClick={() => onSelect(clip, index)}
          >
            {Array.from({ length: 22 }).map((_, bar) => (
              <span key={bar} style={{ height: `${18 + ((bar * 13 + index * 7) % 28)}%` }} />
            ))}
          </button>
        );
      })}
    </TimelineTrack>
  );
}

export default memo(AudioTrack);
