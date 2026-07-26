import { Copy, Home, Plus, Star, Trash2 } from "lucide-react";
import { useState } from "react";
import { templateNames, useBuilderStore } from "../store/useBuilderStore.js";

export default function ScreensPanel() {
  const [templateName, setTemplateName] = useState("Home");
  const screens = useBuilderStore((state) => state.screens);
  const activeScreenId = useBuilderStore((state) => state.activeScreenId);
  const startScreenId = useBuilderStore((state) => state.startScreenId);
  const addScreen = useBuilderStore((state) => state.addScreen);
  const renameScreen = useBuilderStore((state) => state.renameScreen);
  const selectScreen = useBuilderStore((state) => state.selectScreen);
  const duplicateScreen = useBuilderStore((state) => state.duplicateScreen);
  const deleteScreen = useBuilderStore((state) => state.deleteScreen);
  const setStartScreen = useBuilderStore((state) => state.setStartScreen);

  return (
    <aside className="flex min-h-0 flex-col rounded-3xl bg-white p-4 shadow-soft">
      <div className="mb-4">
        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Pantallas</p>
        <h2 className="mt-1 text-lg font-black">Flujo</h2>
      </div>

      <div className="mb-4 grid gap-2">
        <select
          className="h-10 rounded-2xl border border-slate-200 bg-slate-50 px-3 text-sm font-bold text-slate-700 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
          value={templateName}
          onChange={(event) => setTemplateName(event.target.value)}
        >
          {templateNames.map((name) => (
            <option key={name} value={name}>{name}</option>
          ))}
          <option value="">Vacia</option>
        </select>
        <button
          className="flex h-10 items-center justify-center gap-2 rounded-2xl bg-blue-600 text-sm font-black text-white shadow-panel transition hover:bg-blue-700"
          type="button"
          onClick={() => addScreen(templateName)}
        >
          <Plus size={16} />
          Nueva
        </button>
      </div>

      <div className="grid gap-2 overflow-auto pr-1">
        {screens.map((screen) => {
          const active = screen.id === activeScreenId;
          const start = screen.id === startScreenId;

          return (
            <section
              key={screen.id}
              className={`rounded-2xl border p-2 transition ${
                active ? "border-blue-300 bg-blue-50 shadow-panel" : "border-slate-200 bg-white hover:bg-slate-50"
              }`}
            >
              <button className="flex w-full items-center gap-2 text-left" type="button" onClick={() => selectScreen(screen.id)}>
                <span className={`grid h-8 w-8 place-items-center rounded-xl ${active ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-500"}`}>
                  {start ? <Star size={15} fill="currentColor" /> : <Home size={15} />}
                </span>
                <input
                  className="min-w-0 flex-1 bg-transparent text-sm font-black outline-none"
                  value={screen.name}
                  onClick={(event) => event.stopPropagation()}
                  onChange={(event) => renameScreen(screen.id, event.target.value)}
                />
              </button>

              <div className="mt-2 grid grid-cols-3 gap-1">
                <IconButton title="Inicial" onClick={() => setStartScreen(screen.id)} active={start}>
                  <Star size={14} />
                </IconButton>
                <IconButton title="Duplicar" onClick={() => duplicateScreen(screen.id)}>
                  <Copy size={14} />
                </IconButton>
                <IconButton title="Eliminar" onClick={() => deleteScreen(screen.id)} danger disabled={screens.length <= 1}>
                  <Trash2 size={14} />
                </IconButton>
              </div>
            </section>
          );
        })}
      </div>
    </aside>
  );
}

function IconButton({ children, title, onClick, active = false, danger = false, disabled = false }) {
  return (
    <button
      className={`grid h-8 place-items-center rounded-xl border text-xs font-black transition ${
        active
          ? "border-blue-600 bg-blue-600 text-white"
          : danger
            ? "border-rose-100 bg-rose-50 text-rose-600 hover:bg-rose-100"
            : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
      } disabled:cursor-not-allowed disabled:opacity-40`}
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}
