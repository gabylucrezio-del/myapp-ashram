import React from "react";
import { Pause, Play, RotateCcw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { formatTime } from "../utils/time";

export default function VideoPreview({ project, clip, videoRef, onMetadata, onTimeUpdate }) {
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const lastTimelineUpdateRef = useRef(0);

  useEffect(() => {
    setPlaying(false);
    setTime(clip?.trimStart || 0);
  }, [clip?.id]);

  useEffect(() => {
    if (!videoRef.current || !clip) return;
    videoRef.current.volume = clip.volume ?? 1;
  }, [clip?.id, clip?.volume, videoRef]);

  function togglePlay() {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play();
      setPlaying(true);
    } else {
      video.pause();
      setPlaying(false);
    }
  }

  function restart() {
    const video = videoRef.current;
    if (!video || !clip) return;
    video.currentTime = clip.trimStart || 0;
    video.play();
    setPlaying(true);
  }

  function handleTimeUpdate(event) {
    const current = event.currentTarget.currentTime;
    const end = clip?.trimEnd || clip?.duration || Number.MAX_SAFE_INTEGER;
    setTime(current);
    const now = performance.now();
    if (now - lastTimelineUpdateRef.current > 180) {
      lastTimelineUpdateRef.current = now;
      onTimeUpdate?.(current);
    }
    if (current >= end) {
      event.currentTarget.pause();
      setPlaying(false);
    }
  }

  return (
    <section className="preview-area">
      <div className={`video-stage ${project.format}`}>
        {clip ? (
          <video
            ref={videoRef}
            key={clip.id}
            src={clip.objectUrl}
            playsInline
            onLoadedMetadata={(event) => {
              event.currentTarget.currentTime = clip.trimStart || 0;
              onMetadata(event.currentTarget.duration || 0);
            }}
            onTimeUpdate={handleTimeUpdate}
            onPause={() => setPlaying(false)}
            onPlay={() => setPlaying(true)}
            muted={clip.muted}
            style={{ filter: project.effect || "none" }}
          />
        ) : (
          <div className="preview-empty">
            <strong>Importa videos para comenzar</strong>
            <span>El preview mantiene el formato elegido.</span>
          </div>
        )}
        {project.logo?.url && (
          <img
            className={`watermark ${project.logo.position}`}
            src={project.logo.url}
            alt=""
            style={{ opacity: project.logo.opacity, width: `${project.logo.size}%` }}
          />
        )}
        {project.texts.map((text) => (
          <div className="text-overlay" key={text.id} style={{ color: text.color, fontSize: `${text.size}px` }}>
            {text.value}
          </div>
        ))}
      </div>
      <div className="transport-bar">
        <button className="icon-action" type="button" onClick={togglePlay} disabled={!clip} aria-label={playing ? "Pausar" : "Reproducir"}>
          {playing ? <Pause size={22} /> : <Play size={22} />}
        </button>
        <button className="icon-action" type="button" onClick={restart} disabled={!clip} aria-label="Volver al inicio">
          <RotateCcw size={20} />
        </button>
        <span className="time-pill">{formatTime(time)} / {formatTime(clip?.trimEnd || clip?.duration || 0)}</span>
      </div>
    </section>
  );
}
