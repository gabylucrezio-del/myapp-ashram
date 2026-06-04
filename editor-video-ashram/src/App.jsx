import React, { useMemo, useRef, useState } from "react";
import { Download, Home, Plus, Save } from "lucide-react";
import HomeScreen from "./components/HomeScreen.jsx";
import ProjectScreen from "./components/ProjectScreen.jsx";
import ExportTool from "./components/ExportTool.jsx";
import { buildFfmpegPlan, exportPreviewWebM } from "./services/exportService";
import { createExportPlan } from "./services/exportPlan";
import { loadProjects, saveProject } from "./services/projectStorage";
import { uid } from "./utils/time";

const emptyProject = (format = "vertical") => ({
  id: uid("project"),
  name: "Nuevo video Ashram",
  format,
  resolution: "1080p",
  clips: [],
  selectedClipId: null,
  logo: null,
  texts: [],
  audio: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

export default function App() {
  const [projects, setProjects] = useState(loadProjects);
  const [project, setProject] = useState(null);
  const [exportState, setExportState] = useState({ open: false, progress: 0, message: "" });
  const videoRef = useRef(null);

  const selectedClip = useMemo(
    () => project?.clips.find((clip) => clip.id === project.selectedClipId) || project?.clips[0],
    [project],
  );

  function createProject(format) {
    setProject(emptyProject(format));
  }

  function openProject(snapshot) {
    setProject({
      ...snapshot,
      clips: [],
      selectedClipId: null,
    });
  }

  function updateProject(updater) {
    setProject((current) => {
      const next = typeof updater === "function" ? updater(current) : updater;
      return { ...next, updatedAt: new Date().toISOString() };
    });
  }

  function persistProject() {
    if (!project) return;
    saveProject({ ...project, exportPlan: createExportPlan(project) });
    setProjects(loadProjects());
  }

  async function handleExport() {
    if (!project || project.clips.length === 0) return;
    setExportState({ open: true, progress: 5, message: "Preparando exportacion..." });
    try {
      const result = await exportPreviewWebM({
        project,
        videoElement: videoRef.current,
        onProgress: (progress) =>
          setExportState({ open: true, progress, message: "Exportando vista previa WebM..." }),
      });
      const url = URL.createObjectURL(result.blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = result.name;
      link.click();
      URL.revokeObjectURL(url);
      setExportState({
        open: true,
        progress: 100,
        message: "Vista previa exportada. Para MP4 final se usa FFmpeg nativo.",
      });
    } catch (error) {
      setExportState({
        open: true,
        progress: 0,
        message: error.message || "Exportacion no disponible en este dispositivo.",
        plan: buildFfmpegPlan(project),
      });
    }
  }

  if (!project) {
    return <HomeScreen projects={projects} onCreate={createProject} onOpen={openProject} />;
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <button className="icon-action" type="button" onClick={() => setProject(null)} aria-label="Inicio">
          <Home size={21} />
        </button>
        <div className="topbar-title">
          <strong>Editor Ashram</strong>
          <span>{project.name}</span>
        </div>
        <button className="soft-button compact" type="button" onClick={persistProject}>
          <Save size={18} />
          Guardar
        </button>
        <button className="primary-button compact" type="button" onClick={handleExport}>
          <Download size={18} />
          Exportar
        </button>
      </header>

      <ProjectScreen
        project={project}
        selectedClip={selectedClip}
        videoRef={videoRef}
        onProjectChange={updateProject}
      />

      <ExportTool
        state={exportState}
        plan={exportState.plan || buildFfmpegPlan(project)}
        onClose={() => setExportState({ open: false, progress: 0, message: "" })}
      />
      <button
        className="floating-add"
        type="button"
        aria-label="Importar clips"
        onClick={() => document.getElementById("video-importer")?.click()}
      >
        <Plus size={24} />
      </button>
    </main>
  );
}
