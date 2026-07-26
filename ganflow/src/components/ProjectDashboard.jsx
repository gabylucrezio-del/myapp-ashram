import { Copy, Download, FilePlus2, FolderOpen, Pencil, Plus, Trash2, Upload } from "lucide-react";
import { useRef } from "react";

export default function ProjectDashboard({
  projects,
  activeProjectId,
  onCreate,
  onOpen,
  onDuplicate,
  onRename,
  onDelete,
  onExport,
  onImport,
}) {
  const fileInputRef = useRef(null);
  const sortedProjects = [...projects].sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));

  async function handleImport(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const content = await file.text();
      onImport(JSON.parse(content), file.name);
    } catch {
      alert("No se pudo importar el JSON del proyecto.");
    } finally {
      event.target.value = "";
    }
  }

  return (
    <div className="min-h-screen bg-[#f5f7fb] px-5 py-6 text-slate-950">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5">
        <header className="flex flex-wrap items-center justify-between gap-3 rounded-[28px] border border-slate-200 bg-white px-5 py-4 shadow-panel">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-blue-600 text-lg font-semibold text-white shadow-panel">
              G
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">GanFlow</p>
              <h1 className="text-2xl font-semibold tracking-normal">Mis Proyectos</h1>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button className="dashboard-button bg-white text-slate-700" type="button" onClick={() => fileInputRef.current?.click()}>
              <Upload size={17} />
              Importar JSON
            </button>
            <input ref={fileInputRef} className="hidden" type="file" accept=".json,application/json" onChange={handleImport} />
            <button className="dashboard-button bg-blue-600 text-white hover:bg-blue-700" type="button" onClick={onCreate}>
              <Plus size={17} />
              Nuevo proyecto
            </button>
          </div>
        </header>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {sortedProjects.map((project) => (
            <article
              key={project.id}
              className={`rounded-[24px] border bg-white p-4 shadow-panel transition hover:-translate-y-0.5 hover:shadow-soft ${
                activeProjectId === project.id ? "border-blue-300 ring-4 ring-blue-100" : "border-slate-200"
              }`}
            >
              <div className="mb-4 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-lg font-semibold tracking-normal">{project.name || "Proyecto sin nombre"}</p>
                  <p className="mt-1 text-xs font-medium text-slate-500">Editado {formatDate(project.updatedAt)}</p>
                </div>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500">
                  {project.data?.screens?.length || 1} pantallas
                </span>
              </div>

              <div className="mb-4 grid grid-cols-3 gap-2 rounded-2xl bg-slate-50 p-3 text-xs text-slate-500">
                <Metric label="Datos" value={countTables(project.data)} />
                <Metric label="Flujos" value={project.data?.flows?.length || 0} />
                <Metric label="Tema" value={project.data?.theme?.name || "Claro"} />
              </div>

              <div className="flex flex-wrap gap-2">
                <CardButton primary title="Abrir" onClick={() => onOpen(project.id)}>
                  <FolderOpen size={15} />
                  Abrir
                </CardButton>
                <CardButton title="Renombrar" onClick={() => {
                  const name = window.prompt("Nuevo nombre del proyecto", project.name);
                  if (name?.trim()) onRename(project.id, name.trim());
                }}>
                  <Pencil size={15} />
                </CardButton>
                <CardButton title="Duplicar" onClick={() => onDuplicate(project.id)}>
                  <Copy size={15} />
                </CardButton>
                <CardButton title="Exportar JSON" onClick={() => onExport(project.id)}>
                  <Download size={15} />
                </CardButton>
                <CardButton danger title="Eliminar" onClick={() => {
                  if (window.confirm(`Eliminar "${project.name}"?`)) onDelete(project.id);
                }}>
                  <Trash2 size={15} />
                </CardButton>
              </div>
            </article>
          ))}
        </section>

        {sortedProjects.length === 0 ? (
          <section className="grid min-h-[420px] place-items-center rounded-[28px] border border-dashed border-slate-300 bg-white text-center">
            <div>
              <FilePlus2 className="mx-auto mb-3 text-slate-300" size={44} />
              <p className="text-lg font-semibold">Todavia no hay proyectos</p>
              <p className="mt-1 text-sm text-slate-500">Crea uno nuevo o importa un JSON de GanFlow.</p>
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <div className="min-w-0">
      <p className="truncate text-[11px] font-medium">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold text-slate-800">{value}</p>
    </div>
  );
}

function CardButton({ children, title, onClick, primary = false, danger = false }) {
  return (
    <button
      className={`flex h-9 items-center justify-center gap-1.5 rounded-xl px-3 text-xs font-semibold transition ${
        primary
          ? "bg-blue-600 text-white hover:bg-blue-700"
          : danger
            ? "bg-rose-50 text-rose-600 hover:bg-rose-100"
            : "bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900"
      }`}
      type="button"
      title={title}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function formatDate(value) {
  if (!value) return "sin fecha";
  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function countTables(project) {
  return (project?.dataSources || []).reduce((total, source) => total + (source.tables?.length || 0), 0);
}
