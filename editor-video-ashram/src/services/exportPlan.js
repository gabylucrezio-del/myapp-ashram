export function createExportPlan(project) {
  return {
    version: 1,
    format: project.format,
    resolution: project.resolution,
    clips: project.clips.map((clip, index) => ({
      index,
      sourceName: clip.sourceName || clip.name,
      startTime: clip.trimStart || 0,
      endTime: clip.trimEnd || clip.duration || 0,
      timelinePosition: index,
      muted: Boolean(clip.muted),
      volume: clip.volume ?? 1,
      transition: clip.transition || "none",
    })),
    texts: project.texts.map((text) => ({
      value: text.value,
      startTime: text.start || 0,
      endTime: text.end || 0,
      style: {
        size: text.size,
        color: text.color,
        background: text.background,
        position: text.position,
        align: text.align,
      },
      effects: {
        in: text.effectIn || "none",
        out: text.effectOut || "none",
      },
    })),
    logo: project.logo
      ? {
          size: project.logo.size,
          opacity: project.logo.opacity,
          position: project.logo.position,
        }
      : null,
    engine: "native-capacitor-ffmpeg-preferred",
  };
}
