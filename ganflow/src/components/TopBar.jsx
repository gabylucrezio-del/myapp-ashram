import { ArrowLeft, Code2, Download, FileArchive, FileCode2, Focus, Maximize2, Monitor, PackageCheck, Play, Smartphone, Tablet, Upload } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import BuildApkModal from "./BuildApkModal.jsx";
import { useBuilderStore, VIEWPORTS } from "../store/useBuilderStore.js";
import { generateFlutterProject } from "../utils/flutterProjectGenerator.js";
import { createZipBlob } from "../utils/zipBuilder.js";

const viewportIcons = {
  mobile: Smartphone,
  tablet: Tablet,
  desktop: Monitor,
};

export default function TopBar({ onBackToProjects, onStartTest, focusMode = false, onToggleFocus }) {
  const fileInputRef = useRef(null);
  const [showBuildModal, setShowBuildModal] = useState(false);
  const projectName = useBuilderStore((state) => state.projectName);
  const setProjectName = useBuilderStore((state) => state.setProjectName);
  const viewport = useBuilderStore((state) => state.viewport);
  const setViewport = useBuilderStore((state) => state.setViewport);
  const setShowJson = useBuilderStore((state) => state.setShowJson);
  const setShowFlutterCode = useBuilderStore((state) => state.setShowFlutterCode);
  const importProject = useBuilderStore((state) => state.importProject);
  const getBuilderJson = useBuilderStore((state) => state.getBuilderJson);
  const builderJson = getBuilderJson();
  const flutterProject = useMemo(() => generateFlutterProject(builderJson), [builderJson]);

  function exportProject() {
    const blob = new Blob([JSON.stringify(getBuilderJson(), null, 2)], {
      type: "application/json;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    const safeName = projectName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "ganflow";
    anchor.href = url;
    anchor.download = `${safeName}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function exportFlutterProject() {
    const result = generateFlutterProject(getBuilderJson());
    if (result.validation.errors.length > 0) {
      alert(`No se puede exportar el proyecto Flutter:\n\n${result.validation.errors.join("\n")}`);
      return;
    }
    if (result.validation.warnings.length > 0) {
      const shouldContinue = window.confirm(`GanFlow encontro advertencias:\n\n${result.validation.warnings.join("\n")}\n\n¿Exportar de todos modos?`);
      if (!shouldContinue) return;
    }

    const blob = createZipBlob(result.files);
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${result.projectName}.zip`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function handleImport(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const content = await file.text();
      importProject(JSON.parse(content));
    } catch {
      alert("No se pudo importar el JSON del proyecto.");
    } finally {
      event.target.value = "";
    }
  }

  function toggleFullscreen() {
    if (document.fullscreenElement) {
      document.exitFullscreen?.();
      return;
    }
    document.documentElement.requestFullscreen?.();
  }

  return (
    <header className={`flex shrink-0 items-center justify-between border-b border-slate-200 bg-white/95 px-3 shadow-panel backdrop-blur ${focusMode ? "h-10" : "h-12"}`}>
      <div className="flex min-w-0 items-center gap-2">
        <button
          className="grid h-8 w-8 place-items-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-panel transition hover:bg-slate-50"
          type="button"
          title="Mis Proyectos"
          onClick={onBackToProjects}
        >
          <ArrowLeft size={15} />
        </button>

        <div className="grid h-8 w-8 place-items-center rounded-xl bg-blue-600 text-sm font-medium text-white shadow-panel">
          G
        </div>
        <div className="min-w-0">
          <input
            className="w-44 rounded-lg border border-transparent bg-transparent text-sm font-medium leading-tight outline-none transition focus:border-slate-200 focus:bg-slate-50 focus:px-2"
            value={projectName}
            onChange={(event) => setProjectName(event.target.value)}
            aria-label="Nombre del proyecto"
          />
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        <div className="flex rounded-xl border border-slate-200 bg-slate-100 p-0.5">
          {Object.entries(VIEWPORTS).map(([key, config]) => {
            const Icon = viewportIcons[key];

            return (
              <button
                key={key}
                className={`grid h-8 w-8 place-items-center rounded-lg text-sm font-medium transition ${
                  viewport === key ? "bg-white text-blue-700 shadow-panel" : "text-slate-500 hover:text-slate-900"
                }`}
                type="button"
                onClick={() => setViewport(key)}
                title={config.label}
              >
                <Icon size={15} />
              </button>
            );
          })}
        </div>

        <TopIcon title="Exportar JSON" onClick={exportProject}><Download size={15} /></TopIcon>
        <TopIcon title="Importar JSON" onClick={() => fileInputRef.current?.click()}><Upload size={15} /></TopIcon>

        <input ref={fileInputRef} className="hidden" type="file" accept=".json,application/json" onChange={handleImport} />

        <button
          className="flex h-8 items-center gap-1.5 rounded-xl bg-emerald-600 px-2.5 text-xs font-medium text-white shadow-panel transition hover:bg-emerald-700"
          type="button"
          onClick={onStartTest}
          title="Probar App"
        >
          <Play size={14} fill="currentColor" />
          Probar
        </button>

        <TopIcon title="Generar Flutter" onClick={() => setShowFlutterCode(true)}><FileCode2 size={15} /></TopIcon>
        <TopIcon title="Exportar Proyecto Flutter" onClick={exportFlutterProject}><FileArchive size={15} /></TopIcon>
        <TopIcon title="Compilar APK" onClick={() => setShowBuildModal(true)} accent><PackageCheck size={15} /></TopIcon>
        <TopIcon title="Ver JSON" onClick={() => setShowJson(true)}><Code2 size={15} /></TopIcon>
        <TopIcon title={focusMode ? "Salir de modo foco" : "Modo foco"} onClick={onToggleFocus} active={focusMode}><Focus size={15} /></TopIcon>
        <TopIcon title="Pantalla completa" onClick={toggleFullscreen}><Maximize2 size={15} /></TopIcon>
      </div>
      {showBuildModal ? (
        <BuildApkModal
          builderJson={builderJson}
          flutterProject={flutterProject}
          onClose={() => setShowBuildModal(false)}
          onExportFlutter={exportFlutterProject}
        />
      ) : null}
    </header>
  );
}

function TopIcon({ children, title, onClick, accent = false, active = false }) {
  return (
    <button
      className={`grid h-8 w-8 place-items-center rounded-xl border text-slate-600 shadow-panel transition ${
        active ? "border-blue-300 bg-blue-50 text-blue-700" : accent ? "border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100" : "border-slate-200 bg-white hover:bg-slate-50"
      }`}
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
