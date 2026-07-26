import { Copy, Eye, EyeOff, Layers, Lock, SlidersHorizontal, Trash2, Unlock } from "lucide-react";
import * as LucideIcons from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import ActionsEditor from "./ActionsEditor.jsx";
import { componentDefaults, getLayoutComponents, sanitizeComponentName, useBuilderStore, validateComponentName } from "../store/useBuilderStore.js";

const contentFields = [{ key: "text", label: "Texto", type: "text" }];
const expressionFields = [
  { key: "formula", label: "Formula", type: "text" },
  { key: "ifExpression", label: "if", type: "text" },
  { key: "elseExpression", label: "else", type: "text" },
  { key: "visibleIf", label: "visibleIf", type: "text" },
  { key: "enabledIf", label: "enabledIf", type: "text" },
];
const positionFields = [
  { key: "x", label: "Posicion X", type: "number", min: 0, max: 1200 },
  { key: "y", label: "Posicion Y", type: "number", min: 0, max: 1200 },
  { key: "zIndex", label: "Capa", type: "number", min: -100, max: 1000 },
];
const sizeFields = [
  { key: "width", label: "Ancho", type: "number", min: 20, max: 1200 },
  { key: "height", label: "Alto", type: "number", min: 2, max: 1200 },
];
const styleFields = [
  { key: "color", label: "Color", type: "color" },
  { key: "backgroundColor", label: "Color fondo", type: "color" },
  { key: "fontSize", label: "Tamano fuente", type: "number", min: 8, max: 96 },
  { key: "borderRadius", label: "Borde redondeado", type: "number", min: 0, max: 120 },
];

const componentSpecificFields = {
  icon: [
    { key: "iconName", label: "Icono", type: "icon" },
    { key: "borderColor", label: "Borde", type: "color" },
    { key: "actionType", label: "Accion al tocar", type: "select", options: ["none", "navigate", "link", "message"] },
  ],
  switch: [
    { key: "switchSize", label: "Tamano", type: "select", options: ["small", "medium", "large"] },
    { key: "onColor", label: "Color on", type: "color" },
    { key: "offColor", label: "Color off", type: "color" },
    { key: "thumbColor", label: "Thumb", type: "color" },
    { key: "value", label: "Estado inicial", type: "checkbox" },
  ],
  select: [{ key: "options", label: "Opciones", type: "textarea" }, { key: "value", label: "Valor", type: "text" }],
  textarea: [{ key: "placeholder", label: "Placeholder", type: "text" }, { key: "value", label: "Valor", type: "textarea" }],
  input: [{ key: "placeholder", label: "Placeholder", type: "text" }, { key: "value", label: "Valor", type: "text" }],
  searchInput: [{ key: "placeholder", label: "Placeholder", type: "text" }, { key: "value", label: "Valor", type: "text" }],
  datePicker: [{ key: "label", label: "Label", type: "text" }, { key: "value", label: "Fecha", type: "date" }, { key: "minDate", label: "Fecha min", type: "date" }, { key: "maxDate", label: "Fecha max", type: "date" }, { key: "format", label: "Formato", type: "text" }],
  timePicker: [{ key: "label", label: "Label", type: "text" }, { key: "value", label: "Hora", type: "time" }],
  radioGroup: [{ key: "options", label: "Opciones", type: "textarea" }, { key: "value", label: "Seleccion", type: "text" }],
  slider: [{ key: "min", label: "Min", type: "number" }, { key: "max", label: "Max", type: "number" }, { key: "step", label: "Step", type: "number" }, { key: "value", label: "Valor", type: "number" }],
  filePicker: [{ key: "value", label: "Archivo", type: "text" }],
  imagePicker: [{ key: "value", label: "Imagen", type: "text" }],
  tabs: [{ key: "tabs", label: "Tabs", type: "textarea" }, { key: "activeTab", label: "Tab activo", type: "number" }],
  bottomNavigation: [{ key: "items", label: "Items", type: "textarea" }, { key: "selectedIndex", label: "Seleccion", type: "number" }],
  drawer: [{ key: "items", label: "Items", type: "textarea" }],
  qrCode: [{ key: "value", label: "Valor", type: "text" }, { key: "size", label: "Tamano", type: "number" }],
  webView: [{ key: "url", label: "URL", type: "text" }],
  pdfViewer: [{ key: "source", label: "Source", type: "text" }],
  audioPlayer: [{ key: "source", label: "Source", type: "text" }],
  videoPlayer: [{ key: "source", label: "Source", type: "text" }],
  dataTable: [{ key: "columns", label: "Columnas", type: "textarea" }],
  list: [{ key: "showIcon", label: "Mostrar icono", type: "checkbox" }],
  dynamicList: [{ key: "showIcon", label: "Mostrar icono", type: "checkbox" }, { key: "dataTitleField", label: "Campo titulo", type: "text" }, { key: "dataSubtitleField", label: "Campo subtitulo", type: "text" }],
  progressBar: [{ key: "value", label: "Valor", type: "number" }, { key: "max", label: "Max", type: "number" }],
  circularProgress: [{ key: "value", label: "Valor", type: "number" }, { key: "max", label: "Max", type: "number" }],
  gradientBox: [{ key: "gradientTo", label: "Gradiente hasta", type: "color" }],
  modal: [{ key: "title", label: "Titulo", type: "text" }],
  alertDialog: [{ key: "title", label: "Titulo", type: "text" }],
};

export default function PropertyPanel() {
  const selectedId = useBuilderStore((state) => state.selectedId);
  const activeScreenId = useBuilderStore((state) => state.activeScreenId);
  const viewport = useBuilderStore((state) => state.viewport);
  const screens = useBuilderStore((state) => state.screens);
  const dataSources = useBuilderStore((state) => state.dataSources);
  const component = useMemo(() => {
    const screen = screens.find((item) => item.id === activeScreenId);
    return getLayoutComponents(screen, viewport).find((item) => item.id === selectedId);
  }, [activeScreenId, screens, selectedId, viewport]);
  const activeScreen = useMemo(() => screens.find((item) => item.id === activeScreenId) || screens[0], [activeScreenId, screens]);
  const activeComponents = useMemo(() => getLayoutComponents(activeScreen, viewport), [activeScreen, viewport]);
  const updateComponent = useBuilderStore((state) => state.updateComponent);
  const renameComponent = useBuilderStore((state) => state.renameComponent);
  const updateActiveScreenSettings = useBuilderStore((state) => state.updateActiveScreenSettings);
  const renameScreen = useBuilderStore((state) => state.renameScreen);
  const deleteComponent = useBuilderStore((state) => state.deleteComponent);
  const duplicateComponent = useBuilderStore((state) => state.duplicateComponent);
  const bringToFront = useBuilderStore((state) => state.bringToFront);
  const sendToBack = useBuilderStore((state) => state.sendToBack);
  const toggleLocked = useBuilderStore((state) => state.toggleLocked);
  const toggleHidden = useBuilderStore((state) => state.toggleHidden);
  const createFlowForComponent = useBuilderStore((state) => state.createFlowForComponent);
  const editFlowForComponent = useBuilderStore((state) => state.editFlowForComponent);

  return (
    <aside className="flex min-h-0 flex-col rounded-2xl bg-white p-3 shadow-soft">
      <div className="mb-3 flex items-center gap-2">
        <span className="grid h-8 w-8 place-items-center rounded-xl bg-slate-100 text-blue-700">
          <SlidersHorizontal size={16} />
        </span>
        <div>
          <p className="text-[11px] uppercase tracking-wide text-slate-400">Propiedades</p>
          <h2 className="text-sm font-medium">{component ? component.name : activeScreen?.name || "Pantalla"}</h2>
        </div>
      </div>

      {!component ? (
        <ScreenSettingsPanel screen={activeScreen} renameScreen={renameScreen} updateSettings={updateActiveScreenSettings} />
      ) : (
        <div className="grid gap-2 overflow-auto pr-1">
          <ComponentIdentity
            component={component}
            components={activeComponents}
            renameComponent={renameComponent}
          />

          <Accordion title="General" defaultOpen>
            <label className="flex h-8 items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-2 text-xs text-slate-600">
              Usar estilo del tema
              <input
                type="checkbox"
                checked={component.props.useThemeStyle !== false}
                onChange={(event) => updateComponent(component.id, { useThemeStyle: event.target.checked })}
              />
            </label>
            <FieldGroup fields={contentFields} component={component} updateComponent={updateComponent} />
            <p className="rounded-xl bg-blue-50 px-3 py-2 text-[11px] text-blue-700">
              Usa bindings como {`{{nombre}}`}, formulas como {`{{precio}} * {{cantidad}}`} y condiciones simples.
            </p>
            <FieldGroup fields={expressionFields} component={component} updateComponent={updateComponent} />
            <div className="grid grid-cols-2 gap-1">
              <ActionButton icon={component.props.locked ? Unlock : Lock} label={component.props.locked ? "Desbloq." : "Bloq."} onClick={() => toggleLocked(component.id)} />
              <ActionButton icon={component.props.hidden ? Eye : EyeOff} label={component.props.hidden ? "Mostrar" : "Ocultar"} onClick={() => toggleHidden(component.id)} />
            </div>
          </Accordion>

          <Accordion title="Posicion">
            <FieldGroup fields={positionFields} component={component} updateComponent={updateComponent} />
            <div className="grid grid-cols-2 gap-1">
              <ActionButton icon={Layers} label="Frente" onClick={() => bringToFront(component.id)} />
              <ActionButton icon={Layers} label="Atras" onClick={() => sendToBack(component.id)} />
            </div>
          </Accordion>

          <Accordion title="Tamano">
            <FieldGroup fields={sizeFields} component={component} updateComponent={updateComponent} />
          </Accordion>

          <Accordion title="Estilo">
            <FieldGroup fields={styleFields} component={component} updateComponent={updateComponent} />
          </Accordion>

          <Accordion title="Componente" defaultOpen={Boolean(componentSpecificFields[component.type])}>
            <FieldGroup fields={componentSpecificFields[component.type] || []} component={component} updateComponent={updateComponent} />
            {!componentSpecificFields[component.type] ? <p className="rounded-xl bg-slate-50 p-3 text-xs text-slate-400">Sin propiedades especificas.</p> : null}
          </Accordion>

          <Accordion title="Datos">
            <ComponentDataBinding component={component} dataSources={dataSources} updateComponent={updateComponent} />
          </Accordion>

          <Accordion title="Eventos">
            <ComponentFlowShortcuts component={component} createFlowForComponent={createFlowForComponent} editFlowForComponent={editFlowForComponent} />
            <ActionsEditor component={component} screens={screens} updateComponent={updateComponent} />
            <div className="grid grid-cols-2 gap-1">
              <ActionButton icon={Copy} label="Duplicar" onClick={() => duplicateComponent(component.id)} />
              <ActionButton danger icon={Trash2} label="Eliminar" onClick={() => deleteComponent(component.id)} />
            </div>
          </Accordion>

          <Accordion title="Animaciones">
            <p className="rounded-xl bg-slate-50 p-3 text-xs text-slate-400">Preparado para transiciones y animaciones.</p>
          </Accordion>
        </div>
      )}
    </aside>
  );
}

function ComponentIdentity({ component, components, renameComponent }) {
  const [draftName, setDraftName] = useState(component.name || "");

  useEffect(() => {
    setDraftName(component.name || "");
  }, [component.id, component.name]);

  const validation = validateComponentName(draftName, components, component.id);
  const typeLabel = componentDefaults[component.type]?.label || component.type;

  function commit(nextName = draftName) {
    const result = renameComponent(component.id, nextName.trim());
    if (!result.valid) {
      setDraftName(result.suggestion || sanitizeComponentName(nextName, component.type));
      return;
    }
    setDraftName(result.suggestion);
  }

  return (
    <Accordion title="Identificación" defaultOpen>
      <label className="grid gap-1">
        <span className="text-[10px] uppercase tracking-wide text-slate-400">Nombre interno</span>
        <input
          className={`h-9 rounded-xl border bg-white px-3 font-mono text-xs outline-none focus:ring-2 ${
            validation.valid ? "border-slate-200 text-slate-800 focus:border-blue-400 focus:ring-blue-100" : "border-amber-300 text-amber-900 focus:border-amber-400 focus:ring-amber-100"
          }`}
          value={draftName}
          onBlur={() => commit()}
          onChange={(event) => setDraftName(event.target.value)}
        />
      </label>
      {!validation.valid ? (
        <div className="grid gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
          <span>{validation.message}</span>
          <button className="justify-self-start rounded-lg bg-white px-2 py-1 font-medium text-amber-900 shadow-panel" type="button" onClick={() => commit(validation.suggestion)}>
            Usar {validation.suggestion}
          </button>
        </div>
      ) : null}
      <div className="grid grid-cols-2 gap-2">
        <ReadOnlyIdentity label="Tipo" value={typeLabel} />
        <ReadOnlyIdentity label="ID técnico" value={component.id} mono />
      </div>
    </Accordion>
  );
}

function ReadOnlyIdentity({ label, value, mono = false }) {
  return (
    <label className="grid gap-1">
      <span className="text-[10px] uppercase tracking-wide text-slate-400">{label}</span>
      <input className={`h-8 rounded-xl border border-slate-200 bg-slate-50 px-2 text-[11px] text-slate-500 ${mono ? "font-mono" : ""}`} value={value || ""} readOnly />
    </label>
  );
}

function ComponentFlowShortcuts({ component, createFlowForComponent, editFlowForComponent }) {
  if (!["button", "icon", "card", "floatingActionButton", "input", "select", "switch", "checkbox"].includes(component.type)) return null;
  const eventName = ["input", "select", "switch", "checkbox"].includes(component.type) ? "onChange" : "onClick";
  return (
    <div className="grid grid-cols-2 gap-1 rounded-xl border border-blue-100 bg-blue-50 p-2">
      <button className="h-8 rounded-xl bg-blue-600 px-2 text-xs font-medium text-white shadow-panel" type="button" onClick={() => { createFlowForComponent(component.id, eventName); window.dispatchEvent(new CustomEvent("ganflow:open-flows")); }}>
        {eventName} Crear flujo
      </button>
      <button className="h-8 rounded-xl bg-white px-2 text-xs font-medium text-blue-700 shadow-panel" type="button" onClick={() => { editFlowForComponent(component.id, eventName); window.dispatchEvent(new CustomEvent("ganflow:open-flows")); }}>
        Editar flujo
      </button>
    </div>
  );
}

function ScreenSettingsPanel({ screen, renameScreen, updateSettings }) {
  const settings = screen?.settings || {};
  const appBar = settings.appBar || {};
  const viewport = settings.viewport || {};
  const drawer = settings.drawer || {};

  return (
    <div className="grid gap-2 overflow-auto pr-1">
      <Accordion title="Pantalla" defaultOpen>
        <PropertyField field={{ key: "name", label: "Nombre", type: "text" }} value={screen?.name || ""} onChange={(value) => renameScreen(screen.id, value)} />
        <div className="grid grid-cols-2 gap-2">
          <SimpleNumber label="Ancho" value={settings.width} onChange={(value) => updateSettings({ width: value })} />
          <SimpleNumber label="Alto" value={settings.height} onChange={(value) => updateSettings({ height: value })} />
        </div>
        <label className="grid gap-1">
          <span className="text-[10px] uppercase tracking-wide text-slate-400">Fondo</span>
          <input className="h-9 rounded-xl border border-slate-200 bg-white px-2 text-xs" type="color" value={settings.background || "#ffffff"} onChange={(event) => updateSettings({ background: event.target.value })} />
        </label>
        <div className="grid grid-cols-2 gap-1">
          <ToggleSetting label="Scroll" checked={settings.scroll !== false} onChange={(value) => updateSettings({ scroll: value })} />
          <label className="grid gap-1">
            <span className="text-[10px] uppercase tracking-wide text-slate-400">Orientacion</span>
            <select className="h-8 rounded-xl border border-slate-200 bg-white px-2 text-xs" value={settings.orientation || "portrait"} onChange={(event) => updateSettings({ orientation: event.target.value })}>
              <option value="portrait">Vertical</option>
              <option value="landscape">Horizontal</option>
              <option value="both">Ambas</option>
            </select>
          </label>
        </div>
        <div className="grid grid-cols-2 gap-1">
          <ToggleSetting label="Drawer" checked={settings.drawer?.enabled || false} onChange={(value) => updateSettings({ drawer: { enabled: value } })} />
          <ToggleSetting label="BottomBar" checked={settings.bottomBar?.enabled || false} onChange={(value) => updateSettings({ bottomBar: { enabled: value } })} />
        </div>
      </Accordion>

      <Accordion title="Responsive">
        <label className="grid gap-1">
          <span className="text-[10px] uppercase tracking-wide text-slate-400">Modo base</span>
          <select className="h-8 rounded-xl border border-slate-200 bg-white px-2 text-xs" value={viewport.mode || "mobile"} onChange={(event) => updateSettings({ viewport: { mode: event.target.value } })}>
            <option value="mobile">Movil</option>
            <option value="tablet">Tablet</option>
            <option value="desktop">PC</option>
          </select>
        </label>
        {["mobile", "tablet", "desktop"].map((mode) => (
          <div key={mode} className="grid grid-cols-2 gap-2">
            <SimpleNumber label={`${mode} ancho`} value={viewport[mode]?.width} onChange={(value) => updateSettings({ viewport: { [mode]: { ...(viewport[mode] || {}), width: value } } })} />
            <SimpleNumber label={`${mode} alto`} value={viewport[mode]?.height} onChange={(value) => updateSettings({ viewport: { [mode]: { ...(viewport[mode] || {}), height: value } } })} />
          </div>
        ))}
      </Accordion>

      <Accordion title="AppBar" defaultOpen={appBar.enabled}>
        <ToggleSetting label="AppBar activo" checked={appBar.enabled || false} onChange={(value) => updateSettings({ appBar: { enabled: value } })} />
        <PropertyField field={{ key: "title", label: "Titulo", type: "text" }} value={appBar.title || ""} onChange={(value) => updateSettings({ appBar: { title: value } })} />
        <div className="grid grid-cols-2 gap-2">
          <SimpleNumber label="Altura" value={appBar.height} onChange={(value) => updateSettings({ appBar: { height: value } })} />
          <label className="grid gap-1">
            <span className="text-[10px] uppercase tracking-wide text-slate-400">Alineacion</span>
            <select className="h-8 rounded-xl border border-slate-200 bg-white px-2 text-xs" value={appBar.titleAlign || "left"} onChange={(event) => updateSettings({ appBar: { titleAlign: event.target.value } })}>
              <option value="left">Izquierda</option>
              <option value="center">Centro</option>
              <option value="right">Derecha</option>
            </select>
          </label>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <ColorSetting label="Fondo" value={appBar.backgroundColor || "#ffffff"} onChange={(value) => updateSettings({ appBar: { backgroundColor: value } })} />
          <ColorSetting label="Texto" value={appBar.textColor || "#111827"} onChange={(value) => updateSettings({ appBar: { textColor: value } })} />
        </div>
        <div className="grid grid-cols-2 gap-1">
          <ToggleSetting label="Volver" checked={appBar.showBack || false} onChange={(value) => updateSettings({ appBar: { showBack: value } })} />
          <ToggleSetting label="Menu" checked={appBar.showMenu || false} onChange={(value) => updateSettings({ appBar: { showMenu: value } })} />
          <ToggleSetting label="Tres puntos" checked={appBar.showMore || false} onChange={(value) => updateSettings({ appBar: { showMore: value } })} />
          <ToggleSetting label="Sombra" checked={appBar.shadow !== false} onChange={(value) => updateSettings({ appBar: { shadow: value } })} />
        </div>
        <JsonField label="Acciones derecha JSON" value={appBar.actions || []} onChange={(value) => updateSettings({ appBar: { actions: value } })} />
        <JsonField label="Menu tres puntos JSON" value={appBar.moreMenu || []} onChange={(value) => updateSettings({ appBar: { moreMenu: value } })} />
      </Accordion>

      <Accordion title="Drawer" defaultOpen={drawer.enabled}>
        <ToggleSetting label="Drawer activo" checked={drawer.enabled || false} onChange={(value) => updateSettings({ drawer: { enabled: value } })} />
        <JsonField label="Items drawer JSON" value={drawer.items || []} onChange={(value) => updateSettings({ drawer: { items: value } })} />
      </Accordion>

      <p className="rounded-xl bg-slate-50 p-3 text-xs text-slate-400">Selecciona un componente del canvas para editar sus propiedades individuales.</p>
    </div>
  );
}

function JsonField({ label, value, onChange }) {
  const [text, setText] = useState(() => JSON.stringify(value || [], null, 2));

  useEffect(() => {
    setText(JSON.stringify(value || [], null, 2));
  }, [value]);

  function commit(nextText) {
    try {
      const parsed = JSON.parse(nextText);
      if (Array.isArray(parsed)) onChange(parsed);
    } catch {
      setText(JSON.stringify(value || [], null, 2));
    }
  }

  return (
    <label className="grid gap-1">
      <span className="text-[10px] uppercase tracking-wide text-slate-400">{label}</span>
      <textarea
        className="min-h-28 rounded-xl border border-slate-200 bg-white px-2 py-2 font-mono text-[11px] text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
        value={text}
        onChange={(event) => setText(event.target.value)}
        onBlur={(event) => commit(event.target.value)}
      />
    </label>
  );
}

function ToggleSetting({ label, checked, onChange }) {
  return (
    <label className="flex h-8 items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-2 text-xs text-slate-600">
      {label}
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
    </label>
  );
}

function SimpleNumber({ label, value, onChange }) {
  return (
    <label className="grid gap-1">
      <span className="text-[10px] uppercase tracking-wide text-slate-400">{label}</span>
      <input className="h-8 rounded-xl border border-slate-200 bg-white px-2 text-xs" type="number" value={value ?? 0} onChange={(event) => onChange(Number(event.target.value))} />
    </label>
  );
}

function ColorSetting({ label, value, onChange }) {
  return (
    <label className="grid gap-1">
      <span className="text-[10px] uppercase tracking-wide text-slate-400">{label}</span>
      <input className="h-8 rounded-xl border border-slate-200 bg-white px-2 text-xs" type="color" value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function ComponentDataBinding({ component, dataSources, updateComponent }) {
  const localTables = dataSources.flatMap((source) =>
    source.tables.map((table) => ({ ...table, sourceId: source.id, sourceName: source.name })),
  );
  const table = localTables.find((item) => item.id === component.props.dataTable);
  const fields = table?.fields || [];

  if (!["input", "searchInput", "textarea", "list", "dynamicList", "dataTable", "detailView", "text", "container", "card"].includes(component.type)) {
    return <p className="rounded-2xl bg-slate-50 p-3 text-xs text-slate-400">Este componente no requiere binding de datos.</p>;
  }

  return (
    <div className="grid gap-3">
      <label className="grid gap-1">
        <span className="text-[10px] uppercase tracking-wide text-slate-400">Tabla</span>
        <select className="h-9 rounded-xl border border-slate-200 bg-white px-2 text-xs" value={component.props.dataTable || ""} onChange={(event) => updateComponent(component.id, { dataTable: event.target.value })}>
          <option value="">Sin tabla</option>
          {localTables.map((item) => <option key={`${item.sourceId}-${item.id}`} value={item.id}>{item.name}</option>)}
        </select>
      </label>

      {["input", "searchInput", "textarea"].includes(component.type) ? (
        <FieldSelect label="Campo" value={component.props.dataField || ""} fields={fields} onChange={(value) => updateComponent(component.id, { dataField: value })} />
      ) : null}

      {["list", "dynamicList"].includes(component.type) ? (
        <div className="grid gap-2">
          <FieldSelect label="Titulo" value={component.props.dataTitleField || ""} fields={fields} onChange={(value) => updateComponent(component.id, { dataTitleField: value })} />
          <FieldSelect label="Subtitulo" value={component.props.dataSubtitleField || ""} fields={fields} onChange={(value) => updateComponent(component.id, { dataSubtitleField: value })} />
          <FieldSelect label="Imagen" value={component.props.dataImageField || ""} fields={fields} onChange={(value) => updateComponent(component.id, { dataImageField: value })} />
        </div>
      ) : null}

      {["text", "container", "card"].includes(component.type) ? (
        <p className="rounded-xl bg-blue-50 px-3 py-2 text-[11px] text-blue-700">Usa bindings como {`{{registro.nombre}}`} en el texto.</p>
      ) : null}
    </div>
  );
}

function FieldSelect({ label, value, fields, onChange }) {
  return (
    <label className="grid gap-1">
      <span className="text-[10px] uppercase tracking-wide text-slate-400">{label}</span>
      <select className="h-9 rounded-xl border border-slate-200 bg-white px-2 text-xs" value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">Sin campo</option>
        {fields.map((field) => <option key={field.id} value={field.name}>{field.name}</option>)}
      </select>
    </label>
  );
}

function ComponentActionEditor({ component, screens, updateComponent }) {
  const props = component.props;

  return (
    <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
      <label className="grid gap-2">
        <span className="text-xs font-black uppercase tracking-[0.08em] text-slate-500">Tipo de accion</span>
        <select
          className="h-10 rounded-2xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
          value={props.actionType || "none"}
          onChange={(event) => updateComponent(component.id, { actionType: event.target.value })}
        >
          <option value="none">Sin accion</option>
          <option value="navigate">Navegar a pantalla</option>
          <option value="link">Abrir enlace</option>
          <option value="message">Mostrar mensaje</option>
        </select>
      </label>

      {props.actionType === "navigate" ? (
        <label className="grid gap-2">
          <span className="text-xs font-black uppercase tracking-[0.08em] text-slate-500">Pantalla destino</span>
          <select
            className="h-10 rounded-2xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
            value={props.actionTarget || ""}
            onChange={(event) => updateComponent(component.id, { actionTarget: event.target.value })}
          >
            <option value="">Elegir pantalla</option>
            {screens.map((screen) => (
              <option key={screen.id} value={screen.id}>{screen.name}</option>
            ))}
          </select>
        </label>
      ) : null}

      {props.actionType === "link" ? (
        <PropertyField
          field={{ key: "actionUrl", label: "URL", type: "text" }}
          value={props.actionUrl}
          onChange={(value) => updateComponent(component.id, { actionUrl: value })}
        />
      ) : null}

      {props.actionType === "message" ? (
        <PropertyField
          field={{ key: "actionMessage", label: "Mensaje", type: "text" }}
          value={props.actionMessage}
          onChange={(value) => updateComponent(component.id, { actionMessage: value })}
        />
      ) : null}
    </div>
  );
}

function Accordion({ title, children, defaultOpen = false }) {
  return (
    <details className="rounded-xl border border-slate-200 bg-slate-50 p-2 open:bg-white" open={defaultOpen}>
      <summary className="cursor-pointer select-none text-xs font-medium text-slate-700">{title}</summary>
      <div className="mt-2 grid gap-2">{children}</div>
    </details>
  );
}

function FieldGroup({ fields, component, updateComponent }) {
  return fields.map((field) => (
    <PropertyField
      key={field.key}
      field={field}
      value={component.props[field.key]}
      onChange={(value) => updateComponent(component.id, { [field.key]: value })}
    />
  ));
}

function ActionButton({ icon: Icon, label, onClick, danger = false }) {
  return (
    <button
      className={`flex h-8 items-center justify-center gap-1 rounded-xl border px-2 text-xs font-normal shadow-panel transition ${
        danger
          ? "border-rose-100 bg-rose-50 text-rose-700 hover:bg-rose-100"
          : "border-slate-200 bg-white text-slate-700 hover:bg-blue-50 hover:text-blue-700"
      }`}
      type="button"
      onClick={onClick}
    >
      <Icon size={15} />
      {label}
    </button>
  );
}

function PropertyField({ field, value, onChange }) {
  const isColor = field.type === "color";

  if (field.type === "select") {
    return (
      <label className="grid gap-2">
        <span className="text-[11px] font-normal uppercase tracking-wide text-slate-500">{field.label}</span>
        <select className="h-8 w-full rounded-xl border border-slate-200 bg-white px-2 text-xs text-slate-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" value={value ?? ""} onChange={(event) => onChange(event.target.value)}>
          {(field.options || []).map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
      </label>
    );
  }

  if (field.type === "textarea") {
    return (
      <label className="grid gap-2">
        <span className="text-[11px] font-normal uppercase tracking-wide text-slate-500">{field.label}</span>
        <textarea className="min-h-20 w-full rounded-xl border border-slate-200 bg-white px-2 py-2 text-xs text-slate-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" value={value ?? ""} onChange={(event) => onChange(event.target.value)} />
      </label>
    );
  }

  if (field.type === "checkbox") {
    return (
      <label className="flex h-8 items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-2 text-xs text-slate-600">
        {field.label}
        <input type="checkbox" checked={Boolean(value)} onChange={(event) => onChange(event.target.checked)} />
      </label>
    );
  }

  if (field.type === "icon") {
    return <IconPicker value={value || "Star"} onChange={onChange} />;
  }

  return (
    <label className="grid gap-2">
      <span className="text-[11px] font-normal uppercase tracking-wide text-slate-500">{field.label}</span>
      <div className={isColor ? "flex gap-2" : ""}>
        <input
          className={`h-8 w-full rounded-xl border border-slate-200 bg-white px-2 text-xs font-normal text-slate-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 ${
            isColor ? "max-w-[58px] p-1" : ""
          }`}
          type={field.type}
          min={field.min}
          max={field.max}
          value={normalizeInputValue(value, field.type)}
          onChange={(event) => {
            const nextValue = field.type === "number" ? Number(event.target.value) : event.target.value;
            onChange(nextValue);
          }}
        />
        {isColor ? (
          <input
            className="h-8 min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-2 text-xs font-normal text-slate-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            type="text"
            value={value}
            onChange={(event) => onChange(event.target.value)}
          />
        ) : null}
      </div>
    </label>
  );
}

const iconPickerNames = [
  "Star", "Heart", "Home", "User", "Settings", "Search", "Bell", "CalendarDays",
  "Clock", "Camera", "Image", "Mail", "Phone", "MapPin", "ShoppingCart", "CreditCard",
  "Plus", "Check", "X", "ArrowRight", "ChevronRight", "Play", "Pause", "Download",
  "Upload", "QrCode", "Globe", "BookOpen", "Music", "Video", "FileText", "Sparkles",
];

function IconPicker({ value, onChange }) {
  const [query, setQuery] = useState("");
  const filtered = iconPickerNames.filter((name) => name.toLowerCase().includes(query.toLowerCase()));
  const CurrentIcon = LucideIcons[value] || LucideIcons.Star;

  return (
    <div className="grid gap-2">
      <span className="text-[11px] font-normal uppercase tracking-wide text-slate-500">Icono</span>
      <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-2">
        <CurrentIcon size={16} className="text-blue-600" />
        <input className="h-8 min-w-0 flex-1 text-xs outline-none" value={query} placeholder={value || "Buscar icono"} onChange={(event) => setQuery(event.target.value)} />
      </div>
      <div className="grid max-h-40 grid-cols-4 gap-1 overflow-auto rounded-xl border border-slate-200 bg-slate-50 p-1">
        {filtered.map((name) => {
          const Icon = LucideIcons[name] || LucideIcons.Circle;
          return (
            <button key={name} className={`grid h-9 place-items-center rounded-lg border text-slate-600 transition hover:bg-white hover:text-blue-700 ${value === name ? "border-blue-300 bg-white text-blue-700" : "border-transparent"}`} type="button" title={name} onClick={() => onChange(name)}>
              <Icon size={17} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

function normalizeInputValue(value, type) {
  if (type === "color" && value === "transparent") return "#ffffff";
  return value ?? "";
}
