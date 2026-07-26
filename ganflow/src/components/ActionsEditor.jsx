import { ArrowDown, ArrowUp, Plus, Trash2, Workflow } from "lucide-react";

const events = ["onTap", "onLoad", "onChange", "onSubmit"];

const actionTypes = [
  "navigateToScreen",
  "openModal",
  "closeModal",
  "showMessage",
  "openUrl",
  "pickImage",
  "setVariable",
  "clearForm",
  "showComponent",
  "hideComponent",
  "saveToLocalDatabase",
  "readFromLocalDatabase",
  "saveToFirebase",
  "readFromFirebase",
  "createRecord",
  "updateRecord",
  "deleteRecord",
  "getRecord",
  "listRecords",
  "filterRecords",
];

const actionLabels = {
  navigateToScreen: "Navegar a pantalla",
  openModal: "Abrir modal",
  closeModal: "Cerrar modal",
  showMessage: "Mostrar mensaje",
  openUrl: "Abrir URL",
  pickImage: "Elegir imagen",
  setVariable: "Set variable",
  clearForm: "Limpiar formulario",
  showComponent: "Mostrar componente",
  hideComponent: "Ocultar componente",
  saveToLocalDatabase: "Guardar local",
  readFromLocalDatabase: "Leer local",
  saveToFirebase: "Guardar Firebase",
  readFromFirebase: "Leer Firebase",
  createRecord: "Crear registro",
  updateRecord: "Actualizar registro",
  deleteRecord: "Eliminar registro",
  getRecord: "Obtener registro",
  listRecords: "Listar registros",
  filterRecords: "Filtrar registros",
};

const defaultParams = {
  navigateToScreen: { screenId: "" },
  openModal: { modalId: "" },
  closeModal: { modalId: "" },
  showMessage: { message: "Mensaje" },
  openUrl: { url: "https://" },
  pickImage: { variable: "selectedImage" },
  setVariable: { name: "variable", value: "" },
  clearForm: { formId: "" },
  showComponent: { componentId: "" },
  hideComponent: { componentId: "" },
  saveToLocalDatabase: { table: "tabla", fields: "{}" },
  readFromLocalDatabase: { table: "tabla", filters: "{}", targetVariable: "resultado" },
  saveToFirebase: { collection: "coleccion", fields: "{}" },
  readFromFirebase: { collection: "coleccion", filters: "{}", targetVariable: "resultado" },
  createRecord: { table: "pacientes", values: "{}" },
  updateRecord: { table: "pacientes", recordId: "", values: "{}" },
  deleteRecord: { table: "pacientes", recordId: "" },
  getRecord: { table: "pacientes", recordId: "", targetVariable: "registro" },
  listRecords: { table: "pacientes", filters: "{}", targetVariable: "registros" },
  filterRecords: { table: "pacientes", filters: "{}", targetVariable: "registrosFiltrados" },
};

export default function ActionsEditor({ component, screens, updateComponent }) {
  const activeEvent = component.props.activeEvent || "onTap";
  const actions = component.events?.[activeEvent] || [];

  function updateEvents(nextActions) {
    updateComponent(component.id, {}, {
      ...component.events,
      [activeEvent]: nextActions,
    });
  }

  function addAction() {
    updateEvents([
      ...actions,
      {
        id: createId(),
        type: "showMessage",
        params: { ...defaultParams.showMessage },
      },
    ]);
  }

  function updateAction(index, patch) {
    updateEvents(actions.map((action, actionIndex) => (actionIndex === index ? { ...action, ...patch } : action)));
  }

  function updateActionParams(index, paramsPatch) {
    updateEvents(actions.map((action, actionIndex) =>
      actionIndex === index ? { ...action, params: { ...action.params, ...paramsPatch } } : action,
    ));
  }

  function moveAction(index, direction) {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= actions.length) return;
    const nextActions = [...actions];
    const [item] = nextActions.splice(index, 1);
    nextActions.splice(nextIndex, 0, item);
    updateEvents(nextActions);
  }

  function deleteAction(index) {
    updateEvents(actions.filter((_, actionIndex) => actionIndex !== index));
  }

  return (
    <div className="grid gap-3">
      <div className="grid grid-cols-2 gap-2">
        {events.map((eventName) => (
          <button
            key={eventName}
            className={`h-9 rounded-2xl text-xs font-black transition ${
              activeEvent === eventName ? "bg-blue-600 text-white shadow-panel" : "bg-slate-100 text-slate-500 hover:text-slate-900"
            }`}
            type="button"
            onClick={() => updateComponent(component.id, { activeEvent: eventName })}
          >
            {eventName}
          </button>
        ))}
      </div>

      <button
        className="flex h-10 items-center justify-center gap-2 rounded-2xl bg-blue-600 text-sm font-black text-white shadow-panel transition hover:bg-blue-700"
        type="button"
        onClick={addAction}
      >
        <Plus size={16} />
        Agregar accion
      </button>

      {actions.length === 0 ? (
        <div className="grid place-items-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-center">
          <Workflow className="mb-2 text-slate-300" size={24} />
          <p className="text-xs font-bold text-slate-400">Sin acciones en {activeEvent}.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {actions.map((action, index) => (
            <article key={action.id || index} className="rounded-2xl border border-slate-200 bg-white p-3 shadow-panel">
              <div className="mb-3 flex items-center gap-2">
                <span className="grid h-7 w-7 place-items-center rounded-xl bg-blue-50 text-xs font-black text-blue-700">
                  {index + 1}
                </span>
                <select
                  className="h-9 min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-2 text-xs font-black text-slate-700 outline-none focus:border-blue-400"
                  value={action.type}
                  onChange={(event) => {
                    const type = event.target.value;
                    updateAction(index, { type, params: { ...defaultParams[type] } });
                  }}
                >
                  {actionTypes.map((type) => (
                    <option key={type} value={type}>{actionLabels[type]}</option>
                  ))}
                </select>
                <MiniButton title="Subir" onClick={() => moveAction(index, -1)} disabled={index === 0}>
                  <ArrowUp size={14} />
                </MiniButton>
                <MiniButton title="Bajar" onClick={() => moveAction(index, 1)} disabled={index === actions.length - 1}>
                  <ArrowDown size={14} />
                </MiniButton>
                <MiniButton danger title="Eliminar" onClick={() => deleteAction(index)}>
                  <Trash2 size={14} />
                </MiniButton>
              </div>

              <ActionParams
                action={action}
                screens={screens}
                onChange={(paramsPatch) => updateActionParams(index, paramsPatch)}
              />
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function ActionParams({ action, screens, onChange }) {
  if (action.type === "navigateToScreen") {
    return (
      <SelectField label="Pantalla destino" value={action.params?.screenId || ""} onChange={(value) => onChange({ screenId: value })}>
        <option value="">Elegir pantalla</option>
        {screens.map((screen) => (
          <option key={screen.id} value={screen.id}>{screen.name}</option>
        ))}
      </SelectField>
    );
  }

  if (action.type === "showMessage") {
    return <TextField label="Mensaje" value={action.params?.message || ""} onChange={(value) => onChange({ message: value })} />;
  }

  if (action.type === "openUrl") {
    return <TextField label="URL" value={action.params?.url || ""} onChange={(value) => onChange({ url: value })} />;
  }

  if (action.type === "pickImage") {
    return <TextField label="Variable imagen" value={action.params?.variable || ""} onChange={(value) => onChange({ variable: value })} />;
  }

  if (action.type === "setVariable") {
    return (
      <div className="grid grid-cols-2 gap-2">
        <TextField label="Variable" value={action.params?.name || ""} onChange={(value) => onChange({ name: value })} />
        <TextField label="Valor" value={action.params?.value || ""} onChange={(value) => onChange({ value })} />
      </div>
    );
  }

  if (["showComponent", "hideComponent", "openModal", "closeModal", "clearForm"].includes(action.type)) {
    const key = action.type.includes("Component") ? "componentId" : action.type.includes("Modal") ? "modalId" : "formId";
    return <TextField label={key} value={action.params?.[key] || ""} onChange={(value) => onChange({ [key]: value })} />;
  }

  if (["saveToLocalDatabase", "readFromLocalDatabase"].includes(action.type)) {
    return (
      <div className="grid gap-2">
        <TextField label="Tabla" value={action.params?.table || ""} onChange={(value) => onChange({ table: value })} />
        <TextArea label={action.type.startsWith("save") ? "Campos JSON" : "Filtros JSON"} value={action.type.startsWith("save") ? action.params?.fields : action.params?.filters} onChange={(value) => onChange(action.type.startsWith("save") ? { fields: value } : { filters: value })} />
        {action.type.startsWith("read") ? <TextField label="Variable destino" value={action.params?.targetVariable || ""} onChange={(value) => onChange({ targetVariable: value })} /> : null}
      </div>
    );
  }

  if (["createRecord", "updateRecord", "deleteRecord", "getRecord", "listRecords", "filterRecords"].includes(action.type)) {
    return (
      <div className="grid gap-2">
        <TextField label="Tabla" value={action.params?.table || ""} onChange={(value) => onChange({ table: value })} />
        {["updateRecord", "deleteRecord", "getRecord"].includes(action.type) ? (
          <TextField label="recordId" value={action.params?.recordId || ""} onChange={(value) => onChange({ recordId: value })} />
        ) : null}
        {["createRecord", "updateRecord"].includes(action.type) ? (
          <TextArea label="Valores JSON" value={action.params?.values} onChange={(value) => onChange({ values: value })} />
        ) : null}
        {["listRecords", "filterRecords"].includes(action.type) ? (
          <TextArea label="Filtros JSON" value={action.params?.filters} onChange={(value) => onChange({ filters: value })} />
        ) : null}
        {["getRecord", "listRecords", "filterRecords"].includes(action.type) ? (
          <TextField label="Variable destino" value={action.params?.targetVariable || ""} onChange={(value) => onChange({ targetVariable: value })} />
        ) : null}
      </div>
    );
  }

  if (["saveToFirebase", "readFromFirebase"].includes(action.type)) {
    return (
      <div className="grid gap-2">
        <TextField label="Coleccion" value={action.params?.collection || ""} onChange={(value) => onChange({ collection: value })} />
        <TextArea label={action.type.startsWith("save") ? "Campos JSON" : "Filtros JSON"} value={action.type.startsWith("save") ? action.params?.fields : action.params?.filters} onChange={(value) => onChange(action.type.startsWith("save") ? { fields: value } : { filters: value })} />
        {action.type.startsWith("read") ? <TextField label="Variable destino" value={action.params?.targetVariable || ""} onChange={(value) => onChange({ targetVariable: value })} /> : null}
      </div>
    );
  }

  return <p className="rounded-xl bg-slate-50 p-3 text-xs font-bold text-slate-400">Esta accion no requiere parametros.</p>;
}

function MiniButton({ children, title, onClick, danger = false, disabled = false }) {
  return (
    <button
      className={`grid h-8 w-8 place-items-center rounded-xl border transition ${
        danger ? "border-rose-100 bg-rose-50 text-rose-600" : "border-slate-200 bg-white text-slate-600"
      } disabled:opacity-35`}
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}

function TextField({ label, value, onChange }) {
  return (
    <label className="grid gap-1">
      <span className="text-[10px] font-black uppercase tracking-[0.08em] text-slate-400">{label}</span>
      <input
        className="h-9 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-bold text-slate-700 outline-none focus:border-blue-400 focus:bg-white"
        value={value || ""}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function TextArea({ label, value, onChange }) {
  return (
    <label className="grid gap-1">
      <span className="text-[10px] font-black uppercase tracking-[0.08em] text-slate-400">{label}</span>
      <textarea
        className="min-h-20 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:border-blue-400 focus:bg-white"
        value={value || ""}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function SelectField({ label, value, onChange, children }) {
  return (
    <label className="grid gap-1">
      <span className="text-[10px] font-black uppercase tracking-[0.08em] text-slate-400">{label}</span>
      <select
        className="h-9 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-bold text-slate-700 outline-none focus:border-blue-400 focus:bg-white"
        value={value || ""}
        onChange={(event) => onChange(event.target.value)}
      >
        {children}
      </select>
    </label>
  );
}

function createId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") return window.crypto.randomUUID();
  return `action-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
