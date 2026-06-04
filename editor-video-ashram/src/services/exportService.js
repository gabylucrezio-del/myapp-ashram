import { formatTime } from "../utils/time";

export function buildFfmpegPlan(project) {
  const target = project.resolution === "1080p" ? "1080" : "720";
  const aspect = project.format === "vertical" ? "9:16" : project.format === "square" ? "1:1" : "16:9";

  return {
    engine: "native-ffmpeg-capacitor",
    output: `editor-ashram-${Date.now()}.mp4`,
    target,
    aspect,
    steps: [
      "Copiar medios al almacenamiento temporal de la app.",
      "Recortar cada clip segun trimStart/trimEnd.",
      "Concatenar clips en el orden de la linea de tiempo.",
      "Aplicar escala, pad/crop segun formato elegido.",
      "Mezclar audio original y musica si existe.",
      "Aplicar logo, textos, subtitulos, transiciones y efectos cuando esten habilitados.",
      "Guardar MP4 final en Movies/EditorAshram o compartir con Android Sharesheet.",
    ],
    clips: project.clips.map((clip, index) => ({
      index,
      name: clip.name,
      trim: `${formatTime(clip.trimStart)} - ${formatTime(clip.trimEnd || clip.duration)}`,
    })),
  };
}

export async function exportPreviewWebM({ project, videoElement, onProgress }) {
  if (!videoElement?.captureStream || typeof MediaRecorder === "undefined") {
    throw new Error("Este dispositivo necesita FFmpeg nativo para exportar video.");
  }

  const stream = videoElement.captureStream();
  const recorder = new MediaRecorder(stream, { mimeType: "video/webm" });
  const chunks = [];

  recorder.ondataavailable = (event) => {
    if (event.data.size) chunks.push(event.data);
  };

  const done = new Promise((resolve) => {
    recorder.onstop = () => resolve(new Blob(chunks, { type: "video/webm" }));
  });

  recorder.start(250);
  onProgress?.(12);
  await new Promise((resolve) => setTimeout(resolve, 900));
  onProgress?.(65);
  recorder.stop();

  const blob = await done;
  onProgress?.(100);
  return {
    blob,
    name: `${project.name.replace(/\s+/g, "-").toLowerCase()}-preview.webm`,
  };
}
