import React, { useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Film, Scissors, Trash2, Type, Volume2, VolumeX } from "lucide-react";
import TimelineRuler from "./TimelineRuler.jsx";
import TimelineZoomControls from "./TimelineZoomControls.jsx";
import TimelineTrack from "./TimelineTrack.jsx";
import TimelineClip from "./TimelineClip.jsx";
import TimelinePlayhead from "./TimelinePlayhead.jsx";
import AudioTrack from "./AudioTrack.jsx";
import TextTrack from "./TextTrack.jsx";
import TransitionBlock from "./TransitionBlock.jsx";
import { clamp, formatTime } from "../utils/time";

const MOCK_CLIPS = [
  {
    id: "mock-video-1",
    name: "Clase yoga intro.mp4",
    duration: 18,
    trimStart: 0,
    trimEnd: 18,
    mock: true,
    color: "teal",
  },
  {
    id: "mock-video-2",
    name: "Satsang corte.mp4",
    duration: 13,
    trimStart: 0,
    trimEnd: 13,
    mock: true,
    color: "gold",
    transition: "Fade",
  },
  {
    id: "mock-video-3",
    name: "Cierre meditacion.mp4",
    duration: 10,
    trimStart: 0,
    trimEnd: 10,
    mock: true,
    color: "clay",
    transition: "Luz",
  },
];

const MOCK_TEXTS = [
  { id: "mock-text-1", value: "Respira y vuelve al centro", start: 2, end: 9, kind: "title" },
  { id: "mock-text-2", value: "Subtitulo manual", start: 11, end: 18, kind: "subtitle" },
];

const MOCK_LOGO = [{ id: "mock-logo-1", value: "Logo Ashram", start: 0, end: 18 }];

export default function TimelineEditor({
  project,
  selectedClip,
  onImportClick,
  onSelect,
  onClipChange,
  onPlayheadChange,
  onSplit,
  onDeleteClip,
  onReorderClips,
  onSeekTimeline,
  onAddText,
  onTextChange,
  onTextDelete,
  onStepFrame,
}) {
  const [zoom, setZoom] = useState(1);
  const [mockSelectedId, setMockSelectedId] = useState(MOCK_CLIPS[0].id);
  const [dragIndex, setDragIndex] = useState(null);
  const scrollRef = useRef(null);

  const hasRealClips = project.clips.length > 0;
  const clips = hasRealClips ? project.clips : MOCK_CLIPS;
  const activeClip = hasRealClips ? selectedClip || clips[0] : clips.find((clip) => clip.id === mockSelectedId) || clips[0];
  const totalDuration = Math.max(
    clips.reduce((sum, clip) => sum + Math.max((clip.trimEnd || clip.duration || 1) - (clip.trimStart || 0), 1), 0),
    24,
  );
  const secondsToPx = 12 * zoom;
  const playhead = activeClip?.playhead ?? activeClip?.trimStart ?? 0;
  const playheadSeconds = useMemo(() => {
    let offset = 0;
    for (const clip of clips) {
      if (clip.id === activeClip?.id) break;
      offset += Math.max((clip.trimEnd || clip.duration || 1) - (clip.trimStart || 0), 1);
    }
    return offset + playhead - (activeClip?.trimStart || 0);
  }, [activeClip, clips, playhead]);
  const playheadOffset = playheadSeconds * secondsToPx;

  function selectClip(clip, index) {
    if (hasRealClips) onSelect(clip.id);
    else setMockSelectedId(clip.id);
  }

  function changeClip(clip, patch) {
    if (!hasRealClips) return;
    onClipChange(clip.id, patch);
  }

  function movePlayhead(value) {
    if (!hasRealClips || !activeClip) return;
    onPlayheadChange(Number(value));
  }

  function handleDrop(index) {
    if (hasRealClips && dragIndex != null) onReorderClips(dragIndex, index);
    setDragIndex(null);
  }

  function seekFromClientX(clientX) {
    if (!scrollRef.current) return;
    const rect = scrollRef.current.getBoundingClientRect();
    const labelWidth = window.matchMedia("(max-width: 760px)").matches ? 72 : 96;
    const x = clientX - rect.left + scrollRef.current.scrollLeft - labelWidth;
    const seconds = clamp(x / secondsToPx, 0, totalDuration);
    if (hasRealClips) onSeekTimeline(seconds);
    else {
      let offset = 0;
      for (const clip of clips) {
        const length = Math.max((clip.trimEnd || clip.duration || 1) - (clip.trimStart || 0), 1);
        if (seconds <= offset + length) {
          setMockSelectedId(clip.id);
          return;
        }
        offset += length;
      }
    }
  }

  function startPlayheadDrag(event) {
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    seekFromClientX(event.clientX);
    const move = (moveEvent) => seekFromClientX(moveEvent.clientX);
    const stop = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
  }

  return (
    <section className="timeline-editor" aria-label="Editor de linea de tiempo">
      <header className="timeline-editor-top">
        <div className="timeline-editor-title">
          <Film size={18} />
          <strong>Timeline</strong>
          <span>{hasRealClips ? `${clips.length} clips` : "vista simulada"}</span>
        </div>
        <div className="timeline-actions">
          <button className="timeline-action" type="button" onClick={onImportClick}>
            <Film size={18} />
            Video
          </button>
          <button
            className="timeline-action"
            type="button"
            disabled={!hasRealClips || !activeClip}
            onClick={() => activeClip && changeClip(activeClip, { muted: !activeClip.muted })}
          >
            {activeClip?.muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>
          <button className="timeline-action" type="button" disabled={!hasRealClips || !activeClip} onClick={onSplit}>
            <Scissors size={18} />
            Dividir
          </button>
          <button className="timeline-action icon-only" type="button" disabled={!hasRealClips || !activeClip} onClick={() => onStepFrame?.(-1)} title="Frame anterior">
            <ChevronLeft size={18} />
          </button>
          <button className="timeline-action icon-only" type="button" disabled={!hasRealClips || !activeClip} onClick={() => onStepFrame?.(1)} title="Frame siguiente">
            <ChevronRight size={18} />
          </button>
          <button className="timeline-action" type="button" disabled={!hasRealClips} onClick={onAddText}>
            <Type size={18} />
            Texto
          </button>
          <button className="timeline-action danger" type="button" disabled={!hasRealClips || !activeClip} onClick={onDeleteClip}>
            <Trash2 size={18} />
          </button>
          <TimelineZoomControls zoom={zoom} onZoomChange={setZoom} />
        </div>
      </header>

      <div className="timeline-scrub-control">
        <span>{formatTime(playheadSeconds)}</span>
        <input
          type="range"
          min={activeClip?.trimStart || 0}
          max={activeClip?.trimEnd || activeClip?.duration || 1}
          step="0.1"
          value={playhead}
          disabled={!hasRealClips || !activeClip}
          onChange={(event) => movePlayhead(event.target.value)}
        />
      </div>

      <div className="timeline-scroll" ref={scrollRef} onPointerDown={(event) => {
        if (event.target.closest("button, input, label")) return;
        seekFromClientX(event.clientX);
      }}>
        <TimelineRuler totalDuration={totalDuration} secondsToPx={secondsToPx} />
        <div className="timeline-tracks" style={{ "--timeline-width": `${Math.max(totalDuration * secondsToPx, 620)}px` }}>
          <TimelinePlayhead offset={playheadOffset} time={playheadSeconds} onPointerDown={startPlayheadDrag} />
          <TimelineTrack label="Video" icon={Film}>
            {clips.map((clip, index) => (
              <React.Fragment key={clip.id}>
                {index > 0 && <TransitionBlock label={clip.transition || "Fade"} />}
                <TimelineClip
                  clip={clip}
                  index={index}
                  secondsToPx={secondsToPx}
                  selected={clip.id === activeClip?.id}
                  onSelect={() => selectClip(clip, index)}
                  onClipChange={(patch) => changeClip(clip, patch)}
                  draggable={hasRealClips}
                  onDragStart={() => setDragIndex(index)}
                  onDrop={() => handleDrop(index)}
                />
              </React.Fragment>
            ))}
          </TimelineTrack>
          <AudioTrack
            clips={clips}
            selectedClipId={activeClip?.id}
            secondsToPx={secondsToPx}
            onSelect={selectClip}
          />
          <TextTrack
            label="Texto"
            items={hasRealClips ? project.texts : MOCK_TEXTS}
            secondsToPx={secondsToPx}
            editable={hasRealClips}
            onItemChange={onTextChange}
            onItemDelete={onTextDelete}
          />
          <TextTrack
            label="Logo"
            items={hasRealClips && project.logo ? [{ id: "logo-real", value: "Logo", start: 0, end: totalDuration }] : MOCK_LOGO}
            secondsToPx={secondsToPx}
            compact
          />
        </div>
      </div>
    </section>
  );
}
