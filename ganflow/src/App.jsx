import { DndContext, DragOverlay, pointerWithin } from "@dnd-kit/core";
import { useEffect, useMemo, useState } from "react";
import BuilderSidebar from "./components/BuilderSidebar.jsx";
import Canvas from "./components/Canvas.jsx";
import FlowCanvas from "./components/FlowCanvas.jsx";
import FlutterCodeModal from "./components/FlutterCodeModal.jsx";
import ProjectDashboard from "./components/ProjectDashboard.jsx";
import PropertyPanel from "./components/PropertyPanel.jsx";
import TestMode from "./components/TestMode.jsx";
import TopBar from "./components/TopBar.jsx";
import { getLayoutComponents, getLayoutSize, useBuilderStore, paletteItems } from "./store/useBuilderStore.js";

const PROJECTS_STORAGE_KEY = "ganflow.projects.v1";

export default function App() {
  const [activeDrag, setActiveDrag] = useState(null);
  const [dragFrame, setDragFrame] = useState(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [activeSidebarTab, setActiveSidebarTab] = useState("components");
  const [mode, setMode] = useState("dashboard");
  const [projects, setProjects] = useState(() => loadProjectLibrary());
  const [activeProjectId, setActiveProjectId] = useState(() => loadActiveProjectId());
  const addComponent = useBuilderStore((state) => state.addComponent);
  const updateComponent = useBuilderStore((state) => state.updateComponent);
  const setMovingId = useBuilderStore((state) => state.setMovingId);
  const viewport = useBuilderStore((state) => state.viewport);
  const showJson = useBuilderStore((state) => state.showJson);
  const showFlutterCode = useBuilderStore((state) => state.showFlutterCode);
  const setShowJson = useBuilderStore((state) => state.setShowJson);
  const getBuilderJson = useBuilderStore((state) => state.getBuilderJson);
  const importProject = useBuilderStore((state) => state.importProject);
  const setProjectName = useBuilderStore((state) => state.setProjectName);

  const builderJson = getBuilderJson();
  const builderJsonString = JSON.stringify(builderJson);
  const activeScreen = useMemo(() => {
    return builderJson.screens?.find((screen) => screen.id === builderJson.activeScreenId) || builderJson.screens?.[0];
  }, [builderJson.activeScreenId, builderJson.screens]);
  const activeProject = useMemo(
    () => projects.find((project) => project.id === activeProjectId) || null,
    [activeProjectId, projects],
  );

  useEffect(() => {
    localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify({ projects, activeProjectId }));
  }, [activeProjectId, projects]);

  useEffect(() => {
    if (projects.length > 0) return;
    const migrated = makeProject(builderJson.projectName || "GanFlow", builderJson);
    setProjects([migrated]);
    setActiveProjectId(migrated.id);
  }, []);

  useEffect(() => {
    if (mode !== "editor" || !activeProjectId) return;
    const data = JSON.parse(builderJsonString);
    setProjects((current) =>
      current.map((project) =>
        project.id === activeProjectId
          ? { ...project, name: data.projectName || project.name, updatedAt: new Date().toISOString(), data }
          : project,
      ),
    );
  }, [activeProjectId, builderJsonString, mode]);

  useEffect(() => {
    function openFlows() {
      setActiveSidebarTab("flows");
    }
    window.addEventListener("ganflow:open-flows", openFlows);
    return () => window.removeEventListener("ganflow:open-flows", openFlows);
  }, []);

  function handleDragStart(event) {
    const { active } = event;
    const data = active.data.current;
    const pointer = getPointer(event.activatorEvent);
    const rect = active.rect.current.initial;
    const activeComponents = getLayoutComponents(activeScreen, viewport);
    const component = data?.source === "canvas" ? activeComponents.find((item) => item.id === data.id) : null;
    const offset = pointer && rect
      ? { x: pointer.x - rect.left, y: pointer.y - rect.top }
      : { x: 0, y: 0 };

    setActiveDrag({ ...data, pointerOffset: offset, initialRect: rect, component });
    if (data?.source === "canvas") setMovingId(data.id);
  }

  function handleDragMove(event) {
    const data = event.active.data.current;
    if (data?.source !== "canvas") return;
    const component = getLayoutComponents(activeScreen, viewport).find((item) => item.id === data.id);
    if (!component) return;
    const scale = getCanvasScale(activeScreen, viewport);
    const next = snapRect({
      id: component.id,
      x: component.props.x + event.delta.x / scale.x,
      y: component.props.y + event.delta.y / scale.y,
      width: component.props.width,
      height: component.props.height,
    }, builderJson.canvasSettings);
    setDragFrame(next);
  }

  function handleDragEnd(event) {
    const { active, delta, over } = event;
    const data = active.data.current;
    setActiveDrag(null);
    setDragFrame(null);
    setMovingId(null);

    if (!data) return;

    if (data.source === "palette" && over?.id === "canvas") {
      addComponent(data.type, getDropPosition(event, activeDrag, activeScreen, viewport, builderJson.canvasSettings));
    }

    if (data.source === "canvas") {
      const component = getLayoutComponents(activeScreen, viewport).find((item) => item.id === data.id);
      if (!component) return;
      const scale = getCanvasScale(activeScreen, viewport);
      const next = snapRect({
        id: component.id,
        x: component.props.x + delta.x / scale.x,
        y: component.props.y + delta.y / scale.y,
        width: component.props.width,
        height: component.props.height,
      }, builderJson.canvasSettings);
      updateComponent(data.id, clampRectToScreen(next, activeScreen, viewport));
    }
  }

  function handleDragCancel() {
    setActiveDrag(null);
    setDragFrame(null);
    setMovingId(null);
  }

  function createProject() {
    const name = uniqueProjectName("Nuevo proyecto", projects);
    const project = makeProject(name, { projectName: name });
    setProjects((current) => [project, ...current]);
    setActiveProjectId(project.id);
    importProject(project.data);
    setMode("editor");
  }

  function openProject(id) {
    const project = projects.find((item) => item.id === id);
    if (!project) return;
    setActiveProjectId(id);
    importProject(project.data);
    setMode("editor");
  }

  function duplicateProject(id) {
    const project = projects.find((item) => item.id === id);
    if (!project) return;
    const name = uniqueProjectName(`${project.name} copia`, projects);
    const duplicate = makeProject(name, { ...cloneJson(project.data), projectName: name });
    setProjects((current) => [duplicate, ...current]);
  }

  function renameProject(id, name) {
    setProjects((current) =>
      current.map((project) =>
        project.id === id
          ? { ...project, name, updatedAt: new Date().toISOString(), data: { ...project.data, projectName: name } }
          : project,
      ),
    );
    if (id === activeProjectId) setProjectName(name);
  }

  function deleteProject(id) {
    setProjects((current) => current.filter((project) => project.id !== id));
    if (id === activeProjectId) setActiveProjectId(null);
  }

  function exportProject(id) {
    const project = projects.find((item) => item.id === id);
    if (!project) return;
    downloadJson(project.data, project.name);
  }

  function importProjectFile(json, fileName = "Proyecto importado") {
    const data = json?.data && json?.name ? json.data : json;
    const name = uniqueProjectName(data.projectName || json?.name || cleanFileName(fileName) || "Proyecto importado", projects);
    const project = makeProject(name, { ...data, projectName: name });
    setProjects((current) => [project, ...current]);
    setActiveProjectId(project.id);
    importProject(project.data);
    setMode("editor");
  }

  function backToProjects() {
    setMode("dashboard");
  }

  if (mode === "dashboard") {
    return (
      <ProjectDashboard
        projects={projects}
        activeProjectId={activeProjectId}
        onCreate={createProject}
        onOpen={openProject}
        onDuplicate={duplicateProject}
        onRename={renameProject}
        onDelete={deleteProject}
        onExport={exportProject}
        onImport={importProjectFile}
      />
    );
  }

  if (mode === "test") {
    return <TestMode project={builderJson} initialViewport={viewport} onExit={() => setMode("editor")} />;
  }

  return (
    <DndContext
      collisionDetection={pointerWithin}
      onDragStart={handleDragStart}
      onDragMove={handleDragMove}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="flex h-screen min-h-[720px] flex-col bg-slate-100 text-slate-950">
        <TopBar onBackToProjects={backToProjects} onStartTest={() => setMode("test")} focusMode={focusMode} onToggleFocus={() => setFocusMode((value) => !value)} />

        <main
          className="grid min-h-0 flex-1 gap-2 p-2 transition-all"
          style={{ gridTemplateColumns: focusMode ? "minmax(0, 1fr)" : `${sidebarCollapsed ? "54px" : "280px"} minmax(0, 1fr) 290px` }}
        >
          {focusMode ? null : (
            <BuilderSidebar
              collapsed={sidebarCollapsed}
              activeTab={activeSidebarTab}
              onTabChange={setActiveSidebarTab}
              onToggleCollapsed={() => setSidebarCollapsed((value) => !value)}
            />
          )}
          {activeSidebarTab === "flows" ? <FlowCanvas /> : <Canvas dragFrame={dragFrame} />}
          {focusMode ? null : <PropertyPanel />}
        </main>

        {showJson ? (
          <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/35 p-6 backdrop-blur-sm">
            <section className="w-full max-w-4xl overflow-hidden rounded-3xl bg-white shadow-soft">
              <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
                <div>
                  <h2 className="text-lg font-bold">JSON actual</h2>
                  <p className="text-sm text-slate-500">Estructura guardada de la pantalla visual.</p>
                </div>
                <button
                  className="rounded-2xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white shadow-panel"
                  type="button"
                  onClick={() => setShowJson(false)}
                >
                  Cerrar
                </button>
              </div>
              <pre className="max-h-[70vh] overflow-auto bg-slate-950 p-6 text-sm leading-6 text-emerald-100">
                {JSON.stringify(builderJson, null, 2)}
              </pre>
            </section>
          </div>
        ) : null}

        {showFlutterCode ? <FlutterCodeModal /> : null}

        <DragOverlay>
          {activeDrag?.source === "palette" ? (
            <div className="rounded-2xl border border-blue-200 bg-white/80 px-4 py-3 text-sm font-semibold text-slate-900 opacity-80 shadow-soft backdrop-blur">
              {paletteItems.find((item) => item.type === activeDrag.type)?.label}
            </div>
          ) : null}
        </DragOverlay>
      </div>
    </DndContext>
  );
}

function loadProjectLibrary() {
  try {
    const parsed = JSON.parse(localStorage.getItem(PROJECTS_STORAGE_KEY) || "{}");
    return Array.isArray(parsed.projects) ? parsed.projects : [];
  } catch {
    localStorage.removeItem(PROJECTS_STORAGE_KEY);
    return [];
  }
}

function loadActiveProjectId() {
  try {
    const parsed = JSON.parse(localStorage.getItem(PROJECTS_STORAGE_KEY) || "{}");
    return parsed.activeProjectId || null;
  } catch {
    return null;
  }
}

function makeProject(name, data = {}) {
  const now = new Date().toISOString();
  return {
    id: createId("project"),
    name,
    updatedAt: now,
    data: { ...data, projectName: data.projectName || name },
  };
}

function uniqueProjectName(baseName, projects) {
  const names = new Set(projects.map((project) => project.name));
  if (!names.has(baseName)) return baseName;
  let counter = 2;
  let nextName = `${baseName} ${counter}`;
  while (names.has(nextName)) {
    counter += 1;
    nextName = `${baseName} ${counter}`;
  }
  return nextName;
}

function downloadJson(data, name) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${safeName(name)}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function safeName(value) {
  return String(value || "ganflow").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "ganflow";
}

function cleanFileName(value) {
  return String(value || "").replace(/\.json$/i, "").trim();
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function createId(prefix) {
  if (window.crypto && typeof window.crypto.randomUUID === "function") return `${prefix}_${window.crypto.randomUUID()}`;
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function getDropPosition(event, activeDrag, activeScreen, viewport, canvasSettings) {
  const canvasNode = event.over?.rect;
  const pointer = getPointer(event.activatorEvent);
  const translated = event.active?.rect?.current?.translated;
  const screenSize = getScreenSize(activeScreen, viewport);

  if (!canvasNode || (!pointer && !translated)) {
    return { x: 32, y: 32 };
  }

  const rect = {
    left: canvasNode.left,
    top: canvasNode.top,
    width: canvasNode.width,
    height: canvasNode.height,
  };
  const scale = {
    x: rect.width / screenSize.width || 1,
    y: rect.height / screenSize.height || 1,
  };
  const point = pointer
    ? { x: pointer.x + event.delta.x, y: pointer.y + event.delta.y }
    : { x: translated.left, y: translated.top };
  const offset = activeDrag?.pointerOffset || { x: 0, y: 0 };
  const raw = {
    x: (point.x - rect.left - offset.x) / scale.x,
    y: (point.y - rect.top - offset.y) / scale.y,
    width: 180,
    height: 56,
  };
  const snapped = snapRect(raw, canvasSettings);
  return {
    x: clamp(Math.round(snapped.x), 0, screenSize.width - 80),
    y: clamp(Math.round(snapped.y), 0, screenSize.height - 40),
  };
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function getPointer(event) {
  if (!event) return null;
  if ("clientX" in event) return { x: event.clientX, y: event.clientY };
  const touch = event.touches?.[0] || event.changedTouches?.[0];
  return touch ? { x: touch.clientX, y: touch.clientY } : null;
}

function getCanvasScale(activeScreen, viewport) {
  const screenSize = getScreenSize(activeScreen, viewport);
  const node = document.querySelector("[data-ganflow-canvas='true']");
  if (!node) return { x: 1, y: 1 };
  const rect = node.getBoundingClientRect();
  return {
    x: rect.width / screenSize.width || 1,
    y: rect.height / screenSize.height || 1,
  };
}

function getScreenSize(activeScreen, viewport) {
  return getLayoutSize(activeScreen, viewport);
}

function snapRect(rect, canvasSettings) {
  if (!canvasSettings?.snapToGrid) return roundRect(rect);
  const size = Number(canvasSettings.gridSize) || 8;
  return {
    ...rect,
    x: Math.round(rect.x / size) * size,
    y: Math.round(rect.y / size) * size,
    width: Math.round(rect.width / size) * size,
    height: Math.round(rect.height / size) * size,
  };
}

function roundRect(rect) {
  return {
    ...rect,
    x: Math.round(rect.x),
    y: Math.round(rect.y),
    width: Math.round(rect.width),
    height: Math.round(rect.height),
  };
}

function clampRectToScreen(rect, activeScreen, viewport) {
  const size = getScreenSize(activeScreen, viewport);
  const topInset = activeScreen?.settings?.appBar?.enabled ? Number(activeScreen.settings.appBar.height) || 0 : 0;
  return {
    x: clamp(Math.round(rect.x), 0, Math.max(0, size.width - rect.width)),
    y: clamp(Math.round(rect.y), topInset, Math.max(topInset, size.height - rect.height)),
    width: Math.max(20, Math.round(rect.width)),
    height: Math.max(2, Math.round(rect.height)),
  };
}
