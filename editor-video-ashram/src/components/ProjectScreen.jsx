import React, { useEffect, useRef } from "react";
import AudioTool from "./AudioTool.jsx";
import EffectsTool from "./EffectsTool.jsx";
import LogoTool from "./LogoTool.jsx";
import ProjectSettings from "./ProjectSettings.jsx";
import TextTool from "./TextTool.jsx";
import TimelineEditor from "./TimelineEditor.jsx";
import ToolBar from "./ToolBar.jsx";
import TransitionTool from "./TransitionTool.jsx";
import VideoPreview from "./VideoPreview.jsx";
import { clamp, uid } from "../utils/time";

export default function ProjectScreen({ project, selectedClip, videoRef, onProjectChange }) {
  const lastSyncedTimeRef = useRef(0);

  useEffect(() => {
    return () => {
      project.clips.forEach((clip) => {
        if (clip.objectUrl) URL.revokeObjectURL(clip.objectUrl);
      });
    };
  }, []);

  function addFiles(files) {
    const clips = files.map((file) => ({
      id: uid("clip"),
      name: file.name,
      sourceName: file.name,
      sourceSize: file.size,
      sourceType: file.type,
      file,
      objectUrl: URL.createObjectURL(file),
      duration: 0,
      trimStart: 0,
      trimEnd: 0,
      muted: false,
      volume: 1,
      transition: "none",
    }));

    onProjectChange((current) => ({
      ...current,
      clips: [...current.clips, ...clips],
      selectedClipId: clips[0]?.id || current.selectedClipId || null,
    }));
  }

  function updateClip(clipId, patch) {
    onProjectChange((current) => ({
      ...current,
      clips: current.clips.map((clip) => (clip.id === clipId ? { ...clip, ...patch } : clip)),
    }));
  }

  function splitClip() {
    if (!selectedClip || !videoRef.current) return;
    videoRef.current.pause();
    const currentTime = videoRef.current.currentTime;
    const start = selectedClip.trimStart || 0;
    const end = selectedClip.trimEnd || selectedClip.duration;
    if (currentTime <= start + 0.4 || currentTime >= end - 0.4) return;

    const left = { ...selectedClip, id: uid("clip"), name: `${selectedClip.name} A`, trimEnd: currentTime, playhead: currentTime };
    const right = { ...selectedClip, id: uid("clip"), name: `${selectedClip.name} B`, trimStart: currentTime, playhead: currentTime };

    onProjectChange((current) => ({
      ...current,
      clips: current.clips.flatMap((clip) => (clip.id === selectedClip.id ? [left, right] : [clip])),
      selectedClipId: left.id,
    }));

    requestAnimationFrame(() => {
      if (videoRef.current) {
        videoRef.current.currentTime = currentTime;
        videoRef.current.pause();
      }
    });
  }

  function clipLength(clip) {
    return Math.max((clip.trimEnd || clip.duration || 1) - (clip.trimStart || 0), 1);
  }

  function clipOffset(clips, clipId) {
    let offset = 0;
    for (const clip of clips) {
      if (clip.id === clipId) return offset;
      offset += clipLength(clip);
    }
    return 0;
  }

  function setClipPlayhead(value) {
    if (!selectedClip) return;
    const nextTime = Number(value);
    updateClip(selectedClip.id, { playhead: nextTime });
    if (videoRef.current) {
      videoRef.current.currentTime = nextTime;
      videoRef.current.pause();
    }
  }

  function syncPreviewTime(value) {
    if (!selectedClip) return;
    if (Math.abs(value - lastSyncedTimeRef.current) < 0.18) return;
    lastSyncedTimeRef.current = value;
    updateClip(selectedClip.id, { playhead: Number(value) });
  }

  function seekTimeline(absoluteSecond) {
    if (!project.clips.length) return;
    let offset = 0;
    for (const clip of project.clips) {
      const length = clipLength(clip);
      if (absoluteSecond <= offset + length || clip === project.clips[project.clips.length - 1]) {
        const local = clamp((clip.trimStart || 0) + (absoluteSecond - offset), clip.trimStart || 0, clip.trimEnd || clip.duration || length);
        onProjectChange((current) => ({
          ...current,
          selectedClipId: clip.id,
          clips: current.clips.map((item) => (item.id === clip.id ? { ...item, playhead: local } : item)),
        }));
        if (videoRef.current) videoRef.current.currentTime = local;
        if (videoRef.current) videoRef.current.pause();
        return;
      }
      offset += length;
    }
  }

  function currentAbsolutePlayhead() {
    if (!selectedClip) return 0;
    return clipOffset(project.clips, selectedClip.id) + ((selectedClip.playhead ?? selectedClip.trimStart ?? 0) - (selectedClip.trimStart || 0));
  }

  function addTextAtPlayhead() {
    const start = currentAbsolutePlayhead();
    const text = {
      id: uid("text"),
      kind: "subtitle",
      value: "La mente cambia, el Ser permanece",
      color: "#fff8e7",
      size: 22,
      start,
      end: start + 5,
      effectIn: "fade-in",
      effectOut: "fade-out",
      background: true,
      position: "bottom",
      align: "center",
    };
    onProjectChange((current) => ({ ...current, texts: [...current.texts, text] }));
  }

  function stepFrame(direction) {
    if (!selectedClip || !videoRef.current) return;
    const frame = 1 / 30;
    const start = selectedClip.trimStart || 0;
    const end = selectedClip.trimEnd || selectedClip.duration || start;
    const next = clamp(videoRef.current.currentTime + direction * frame, start, end);
    videoRef.current.pause();
    videoRef.current.currentTime = next;
    updateClip(selectedClip.id, { playhead: next });
  }

  function updateText(textId, patch) {
    onProjectChange((current) => ({
      ...current,
      texts: current.texts.map((text) => (text.id === textId ? { ...text, ...patch } : text)),
    }));
  }

  function deleteText(textId) {
    onProjectChange((current) => ({
      ...current,
      texts: current.texts.filter((text) => text.id !== textId),
    }));
  }

  function markCutStart() {
    if (!selectedClip) return;
    const time = videoRef.current?.currentTime ?? selectedClip.playhead ?? selectedClip.trimStart ?? 0;
    updateClip(selectedClip.id, { cutStart: clamp(time, selectedClip.trimStart || 0, selectedClip.trimEnd || selectedClip.duration || 0) });
  }

  function markCutEnd() {
    if (!selectedClip) return;
    const end = selectedClip.trimEnd || selectedClip.duration || 0;
    const time = videoRef.current?.currentTime ?? selectedClip.playhead ?? end;
    updateClip(selectedClip.id, { cutEnd: clamp(time, selectedClip.trimStart || 0, end) });
  }

  function deleteMarkedRange() {
    if (!selectedClip) return;
    const start = selectedClip.trimStart || 0;
    const end = selectedClip.trimEnd || selectedClip.duration || 0;
    const cutStart = clamp(selectedClip.cutStart ?? selectedClip.playhead ?? start, start, end);
    const cutEnd = clamp(selectedClip.cutEnd ?? end, start, end);
    if (cutEnd <= cutStart + 0.2) return;

    const left = cutStart > start + 0.2
      ? { ...selectedClip, id: uid("clip"), name: `${selectedClip.name} antes`, trimEnd: cutStart, cutStart: null, cutEnd: null, playhead: start }
      : null;
    const right = cutEnd < end - 0.2
      ? { ...selectedClip, id: uid("clip"), name: `${selectedClip.name} despues`, trimStart: cutEnd, trimEnd: end, cutStart: null, cutEnd: null, playhead: cutEnd }
      : null;
    const replacement = [left, right].filter(Boolean);

    onProjectChange((current) => {
      const clips = current.clips.flatMap((clip) => (clip.id === selectedClip.id ? replacement : [clip]));
      return {
        ...current,
        clips,
        selectedClipId: replacement[0]?.id || clips[0]?.id || null,
      };
    });
  }

  function deleteSelectedClip() {
    if (!selectedClip) return;
    if (selectedClip.objectUrl) URL.revokeObjectURL(selectedClip.objectUrl);
    onProjectChange((current) => {
      const clips = current.clips.filter((clip) => clip.id !== selectedClip.id);
      return { ...current, clips, selectedClipId: clips[0]?.id || null };
    });
  }

  function moveSelectedClip(direction) {
    if (!selectedClip) return;
    onProjectChange((current) => {
      const index = current.clips.findIndex((clip) => clip.id === selectedClip.id);
      const target = index + direction;
      if (target < 0 || target >= current.clips.length) return current;
      const clips = [...current.clips];
      [clips[index], clips[target]] = [clips[target], clips[index]];
      return { ...current, clips };
    });
  }

  function reorderClips(fromIndex, toIndex) {
    onProjectChange((current) => {
      if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) return current;
      const clips = [...current.clips];
      const [clip] = clips.splice(fromIndex, 1);
      clips.splice(toIndex, 0, clip);
      return { ...current, clips };
    });
  }

  return (
    <>
      <input
        id="video-importer"
        className="visually-hidden-input"
        type="file"
        accept="video/*"
        multiple
        onChange={(event) => addFiles(Array.from(event.target.files || []))}
      />
      <section className="editor-page">
        <section className="editor-workspace">
          <aside className="side-panel left-panel">
            <ProjectSettings project={project} onProjectChange={onProjectChange} />
            <LogoTool project={project} onProjectChange={onProjectChange} />
            <TextTool project={project} onProjectChange={onProjectChange} />
          </aside>

          <section className="main-editor">
            <VideoPreview
              project={project}
              clip={selectedClip}
              videoRef={videoRef}
              onMetadata={(duration) => selectedClip && updateClip(selectedClip.id, { duration, trimEnd: selectedClip.trimEnd || duration })}
              onTimeUpdate={syncPreviewTime}
            />
          </section>

          <aside className="side-panel tool-panel">
            <ToolBar
              onSplit={splitClip}
              onDelete={deleteSelectedClip}
              onMoveLeft={() => moveSelectedClip(-1)}
              onMoveRight={() => moveSelectedClip(1)}
              disabled={!selectedClip}
            />
            <TransitionTool selectedClip={selectedClip} onClipChange={updateClip} />
            <AudioTool selectedClip={selectedClip} onClipChange={updateClip} />
            <EffectsTool project={project} onProjectChange={onProjectChange} />
          </aside>
        </section>

        <TimelineEditor
          project={project}
          selectedClip={selectedClip}
          onImportClick={() => document.getElementById("video-importer")?.click()}
          onSelect={(clipId) => onProjectChange((current) => ({ ...current, selectedClipId: clipId }))}
          onClipChange={updateClip}
          onPlayheadChange={setClipPlayhead}
          onSplit={splitClip}
          onDeleteClip={deleteSelectedClip}
          onReorderClips={reorderClips}
          onSeekTimeline={seekTimeline}
          onAddText={addTextAtPlayhead}
          onTextChange={updateText}
          onTextDelete={deleteText}
          onStepFrame={stepFrame}
          onMarkStart={markCutStart}
          onMarkEnd={markCutEnd}
          onDeleteRange={deleteMarkedRange}
        />
      </section>
    </>
  );
}
