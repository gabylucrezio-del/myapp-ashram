import { Plus, Trash2, Variable } from "lucide-react";
import { useMemo, useState } from "react";
import { useBuilderStore, variableTypes } from "../store/useBuilderStore.js";

const scopes = [
  { id: "global", label: "Global" },
  { id: "screen", label: "Pantalla" },
  { id: "local", label: "Local" },
];

export default function VariablesPanel() {
  const [scope, setScope] = useState("global");
  const variables = useBuilderStore((state) => state.variables);
  const screens = useBuilderStore((state) => state.screens);
  const activeScreenId = useBuilderStore((state) => state.activeScreenId);
  const addVariable = useBuilderStore((state) => state.addVariable);
  const updateVariable = useBuilderStore((state) => state.updateVariable);
  const deleteVariable = useBuilderStore((state) => state.deleteVariable);

  const activeScreenVariables = useMemo(() => {
    const screen = screens.find((item) => item.id === activeScreenId);
    return screen?.variables || [];
  }, [activeScreenId, screens]);
  const visibleVariables = scope === "screen" ? activeScreenVariables : variables?.[scope] || [];

  return (
    <aside className="flex min-h-0 flex-col rounded-2xl bg-white p-3 shadow-soft">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-xl bg-blue-50 text-blue-700">
            <Variable size={15} />
          </span>
          <p className="text-xs font-semibold text-slate-700">Variables</p>
        </div>
        <button
          className="grid h-7 w-7 place-items-center rounded-xl bg-blue-600 text-white shadow-panel"
          type="button"
          title="Crear variable"
          onClick={() => addVariable(scope)}
        >
          <Plus size={14} />
        </button>
      </div>

      <div className="mb-3 grid grid-cols-3 gap-1">
        {scopes.map((item) => (
          <button
            key={item.id}
            className={`h-7 rounded-xl text-[11px] transition ${
              scope === item.id ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-500 hover:text-slate-900"
            }`}
            type="button"
            onClick={() => setScope(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="grid gap-2 overflow-auto pr-1">
        {visibleVariables.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-3 text-center text-xs text-slate-400">
            Sin variables.
          </p>
        ) : (
          visibleVariables.map((variable) => (
            <article key={variable.id} className="grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2">
              <div className="flex gap-1">
                <input
                  className="h-8 min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2 text-xs outline-none focus:border-blue-400"
                  value={variable.name}
                  onChange={(event) => updateVariable(scope, variable.id, { name: event.target.value })}
                  placeholder="nombre"
                />
                <button
                  className="grid h-8 w-8 place-items-center rounded-lg bg-rose-50 text-rose-600"
                  type="button"
                  title="Eliminar"
                  onClick={() => deleteVariable(scope, variable.id)}
                >
                  <Trash2 size={13} />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-1">
                <select
                  className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs outline-none focus:border-blue-400"
                  value={variable.type}
                  onChange={(event) => updateVariable(scope, variable.id, { type: event.target.value })}
                >
                  {variableTypes.map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
                <input
                  className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs outline-none focus:border-blue-400"
                  value={variable.initialValue}
                  onChange={(event) => updateVariable(scope, variable.id, { initialValue: event.target.value })}
                  placeholder="valor inicial"
                />
              </div>
            </article>
          ))
        )}
      </div>
    </aside>
  );
}
