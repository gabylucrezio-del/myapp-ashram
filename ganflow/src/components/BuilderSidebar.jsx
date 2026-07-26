import { useDraggable } from "@dnd-kit/core";
import {
  AppWindow,
  Archive,
  BadgeCheck,
  BookOpen,
  Box,
  Boxes,
  BrickWall,
  CalendarDays,
  CaseSensitive,
  CheckSquare,
  CircleUserRound,
  Copy,
  Database,
  FileBox,
  Folder,
  FormInput,
  GraduationCap,
  HeartPulse,
  Home,
  Image,
  KeyRound,
  Layers3,
  List,
  Menu,
  MessageSquare,
  MousePointerClick,
  PanelLeftClose,
  PanelLeftOpen,
  PanelTop,
  Palette,
  PlaySquare,
  Plus,
  Route,
  Search,
  ShieldCheck,
  ShoppingBag,
  Square,
  Star,
  StickyNote,
  Ticket,
  ToggleRight,
  Trash2,
  Users,
  Variable,
  Wand2,
  Workflow,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { fieldTypes, paletteItems, templateNames, themePresets, useBuilderStore, variableTypes } from "../store/useBuilderStore.js";
import { appTemplates } from "../templates/appTemplates.js";

const tabs = [
  { id: "components", label: "Componentes", icon: Archive },
  { id: "templates", label: "Plantillas", icon: BrickWall },
  { id: "screens", label: "Pantallas", icon: AppWindow },
  { id: "data", label: "Datos", icon: Database },
  { id: "variables", label: "Variables", icon: Variable },
  { id: "theme", label: "Tema", icon: Palette },
  { id: "android", label: "Android", icon: BadgeCheck },
  { id: "flows", label: "Flujos", icon: Workflow },
  { id: "resources", label: "Recursos", icon: Folder },
];

const componentIcons = {
  text: CaseSensitive,
  button: MousePointerClick,
  input: PanelTop,
  image: Image,
  container: Square,
  card: Box,
  list: List,
  form: FormInput,
  appbar: AppWindow,
  drawer: Menu,
  checkbox: CheckSquare,
  switch: ToggleRight,
  select: PanelTop,
  avatar: CircleUserRound,
  icon: Star,
  video: PlaySquare,
};

const actionLibrary = [
  ["Navegar", Route],
  ["Abrir Modal", Layers3],
  ["Cerrar Modal", PanelLeftClose],
  ["Mostrar Mensaje", MessageSquare],
  ["Abrir URL", MousePointerClick],
  ["Seleccionar Imagen", Image],
  ["Guardar Registro", Database],
  ["Leer Registro", Search],
  ["Actualizar Registro", FileBox],
  ["Eliminar Registro", Trash2],
  ["Mostrar/Ocultar", Square],
  ["Cambiar Variable", Variable],
];

export default function BuilderSidebar({ collapsed, onToggleCollapsed, activeTab, onTabChange }) {
  const ActiveIcon = tabs.find((tab) => tab.id === activeTab)?.icon || Archive;

  return (
    <aside className={`flex min-h-0 flex-col rounded-2xl bg-white shadow-soft transition-all ${collapsed ? "w-[60px] p-2" : "w-[300px] p-3"}`}>
      <div className="mb-2 flex items-center justify-between gap-2">
        {!collapsed ? (
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-blue-50 text-blue-700">
              <ActiveIcon size={16} />
            </span>
            <span className="text-xs font-medium text-slate-700">{tabs.find((tab) => tab.id === activeTab)?.label}</span>
          </div>
        ) : null}
        <button
          className="grid h-8 w-8 place-items-center rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200"
          type="button"
          title={collapsed ? "Expandir" : "Colapsar"}
          onClick={onToggleCollapsed}
        >
          {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
        </button>
      </div>

      <div className={`mb-3 grid gap-1 ${collapsed ? "grid-cols-1" : "grid-cols-4"}`}>
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              className={`grid h-9 place-items-center rounded-xl transition ${activeTab === tab.id ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-500 hover:text-slate-900"}`}
              type="button"
              title={tab.label}
              onClick={() => onTabChange(tab.id)}
            >
              <Icon size={16} />
            </button>
          );
        })}
      </div>

      {!collapsed ? (
        <div className="min-h-0 flex-1 overflow-hidden">
          {activeTab === "components" ? <ComponentsTab /> : null}
          {activeTab === "templates" ? <TemplatesTab /> : null}
          {activeTab === "screens" ? <ScreensTab /> : null}
          {activeTab === "data" ? <DataTab /> : null}
          {activeTab === "variables" ? <VariablesTab /> : null}
          {activeTab === "theme" ? <ThemeTab /> : null}
          {activeTab === "android" ? <AndroidTab /> : null}
          {activeTab === "flows" ? <FlowsTab /> : null}
          {activeTab === "resources" ? <ResourcesTab /> : null}
        </div>
      ) : null}
    </aside>
  );
}

function SearchBox({ value, onChange, placeholder = "Buscar" }) {
  return (
    <label className="mb-3 flex h-8 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-2 text-slate-400">
      <Search size={14} />
      <input className="min-w-0 flex-1 bg-transparent text-xs text-slate-700 outline-none" value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />
    </label>
  );
}

function ComponentsTab() {
  const [query, setQuery] = useState("");
  const categories = ["Básicos", "Formularios", "Layout", "Navegación", "Datos", "Multimedia", "Diseño"];
  const filteredItems = paletteItems.filter((item) => item.label.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="flex h-full flex-col">
      <SearchBox value={query} onChange={setQuery} />
      <div className="grid gap-4 overflow-auto pr-1">
        {categories.map((category) => {
          const items = filteredItems.filter((item) => item.category === category);
          if (items.length === 0) return null;
          return (
            <section key={category} className="grid gap-2">
              <p className="text-[11px] font-normal uppercase tracking-wide text-slate-400">{category}</p>
              <div className="grid grid-cols-2 gap-2">
                {items.map((item) => <PaletteItem key={item.type} item={item} />)}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function PaletteItem({ item }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `palette-${item.type}`,
    data: { source: "palette", type: item.type },
  });
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined;

  return (
    <button
      ref={setNodeRef}
      className={`group relative flex h-16 flex-col items-center justify-center gap-1 rounded-xl border border-slate-200 bg-white text-slate-600 shadow-panel transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 ${isDragging ? "opacity-40" : ""}`}
      type="button"
      title={item.label}
      aria-label={item.label}
      style={style}
      {...listeners}
      {...attributes}
    >
      <span className="text-xl leading-none" aria-hidden="true">{item.icon}</span>
      <span className="text-[11px] font-normal">{item.label}</span>
      {item.description ? (
        <span className="pointer-events-none absolute left-[calc(100%+10px)] top-1/2 z-40 hidden w-52 -translate-y-1/2 rounded-xl bg-slate-950 px-3 py-2 text-left text-[11px] leading-4 text-slate-300 shadow-soft group-hover:block">
          <span className="block text-xs font-medium text-white">{item.icon} {item.label}</span>
          <span className="mt-1 block">{item.description}</span>
        </span>
      ) : null}
    </button>
  );
}

const templateIcons = {
  calendar: CalendarDays,
  heart: HeartPulse,
  graduation: GraduationCap,
  shopping: ShoppingBag,
  book: BookOpen,
  note: StickyNote,
  users: Users,
  ticket: Ticket,
  boxes: Boxes,
};

function TemplatesTab() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Todas");
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const categories = ["Todas", ...Array.from(new Set(appTemplates.map((template) => template.category)))];
  const filtered = appTemplates.filter((template) => {
    const matchesQuery = `${template.name} ${template.description}`.toLowerCase().includes(query.toLowerCase());
    const matchesCategory = category === "Todas" || template.category === category;
    return matchesQuery && matchesCategory;
  });

  return (
    <div className="flex h-full flex-col">
      <SearchBox value={query} onChange={setQuery} />
      <div className="mb-3 grid grid-cols-[1fr_88px] gap-2">
        <select className="h-8 rounded-xl border border-slate-200 bg-slate-50 px-2 text-xs" value={category} onChange={(event) => setCategory(event.target.value)}>
          {categories.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <span className="grid place-items-center rounded-xl bg-slate-100 text-[11px] text-slate-500">{filtered.length} apps</span>
      </div>
      <div className="grid gap-2 overflow-auto pr-1">
        {filtered.map((template) => {
          const Icon = templateIcons[template.icon] || BrickWall;
          return (
            <article key={template.id} className="grid gap-2 rounded-xl border border-slate-200 bg-white p-2 shadow-panel">
              <div className="flex items-start gap-2">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-700">
                  <Icon size={16} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-slate-700">{template.name}</p>
                  <p className="line-clamp-2 text-[11px] text-slate-400">{template.description}</p>
                  <span className="mt-1 inline-flex rounded-lg bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500">{template.category}</span>
                </div>
              </div>
              <button className="h-8 rounded-xl bg-blue-600 text-xs text-white" type="button" onClick={() => setSelectedTemplate(template)}>
                Usar plantilla
              </button>
            </article>
          );
        })}
      </div>
      {selectedTemplate ? <TemplateModal template={selectedTemplate} onClose={() => setSelectedTemplate(null)} /> : null}
    </div>
  );
}

function TemplateModal({ template, onClose }) {
  const applyAppTemplate = useBuilderStore((state) => state.applyAppTemplate);
  const [mode, setMode] = useState("new");
  const [appName, setAppName] = useState(template.name);
  const [themeName, setThemeName] = useState(themePresets[template.theme?.name] ? template.theme.name : "Moderno claro");
  const [databaseType, setDatabaseType] = useState("local");
  const [initialScreenId, setInitialScreenId] = useState(template.screens?.[0]?.id || "");
  const [enableLogin, setEnableLogin] = useState(false);

  function submit() {
    applyAppTemplate(template, {
      appName,
      databaseType,
      initialScreenId,
      enableLogin,
      theme: themePresets[themeName] || template.theme,
    }, mode);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[110] grid place-items-center bg-slate-950/35 p-4">
      <section className="grid max-h-[88vh] w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-soft">
        <header className="flex h-12 items-center justify-between border-b border-slate-200 px-4">
          <div>
            <p className="text-xs font-medium text-slate-700">{template.name}</p>
            <p className="text-[11px] text-slate-400">{template.description}</p>
          </div>
          <button className="grid h-8 w-8 place-items-center rounded-xl bg-slate-100 text-slate-500" type="button" onClick={onClose}>
            <X size={15} />
          </button>
        </header>
        <div className="grid gap-3 overflow-auto p-4">
          <div className="grid grid-cols-2 gap-2">
            <button className={`h-9 rounded-xl text-xs ${mode === "new" ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600"}`} type="button" onClick={() => setMode("new")}>Crear proyecto nuevo</button>
            <button className={`h-9 rounded-xl text-xs ${mode === "append" ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600"}`} type="button" onClick={() => setMode("append")}>Agregar al actual</button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <ThemeInput label="Nombre de la app" value={appName} onChange={setAppName} />
            <label className="grid gap-1">
              <span className="text-[10px] text-slate-400">Tema</span>
              <select className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs" value={themeName} onChange={(event) => setThemeName(event.target.value)}>
                {Object.keys(themePresets).map((name) => <option key={name} value={name}>{name}</option>)}
              </select>
            </label>
            <label className="grid gap-1">
              <span className="text-[10px] text-slate-400">Base</span>
              <select className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs" value={databaseType} onChange={(event) => setDatabaseType(event.target.value)}>
                <option value="local">Local</option>
                <option value="firebase">Firebase</option>
              </select>
            </label>
            <label className="grid gap-1">
              <span className="text-[10px] text-slate-400">Pantalla inicial</span>
              <select className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs" value={initialScreenId} onChange={(event) => setInitialScreenId(event.target.value)}>
                {(template.screens || []).map((screen) => <option key={screen.id} value={screen.id}>{screen.name}</option>)}
              </select>
            </label>
          </div>
          <label className="flex h-9 items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs text-slate-600">
            Activar login
            <input type="checkbox" checked={enableLogin} onChange={(event) => setEnableLogin(event.target.checked)} />
          </label>
          <div className="grid grid-cols-3 gap-2 rounded-xl bg-slate-50 p-2 text-center text-[11px] text-slate-500">
            <span>{template.screens?.length || 0} pantallas</span>
            <span>{template.dataSources?.[0]?.tables?.length || 0} tablas</span>
            <span>{template.flows?.length || 0} flujos</span>
          </div>
          {mode === "append" ? (
            <p className="rounded-xl bg-amber-50 px-3 py-2 text-[11px] text-amber-700">
              Si ya existen nombres de pantallas o IDs de tablas, GanFlow creara copias automaticamente.
            </p>
          ) : null}
        </div>
        <footer className="flex justify-end gap-2 border-t border-slate-200 p-3">
          <button className="h-8 rounded-xl bg-slate-100 px-3 text-xs text-slate-600" type="button" onClick={onClose}>Cancelar</button>
          <button className="h-8 rounded-xl bg-blue-600 px-3 text-xs text-white" type="button" onClick={submit}>Crear app</button>
        </footer>
      </section>
    </div>
  );
}

function ScreensTab() {
  const [query, setQuery] = useState("");
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
  const filteredScreens = screens.filter((screen) => screen.name.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="flex h-full flex-col">
      <SearchBox value={query} onChange={setQuery} />
      <div className="mb-3 grid grid-cols-[1fr_72px] gap-2">
        <select className="h-8 rounded-xl border border-slate-200 bg-slate-50 px-2 text-xs" value={templateName} onChange={(event) => setTemplateName(event.target.value)}>
          {templateNames.map((name) => <option key={name} value={name}>{name}</option>)}
          <option value="">Vacia</option>
        </select>
        <button className="h-8 rounded-xl bg-blue-600 text-xs text-white" type="button" onClick={() => addScreen(templateName)}>Nueva</button>
      </div>
      <div className="grid gap-2 overflow-auto pr-1">
        {filteredScreens.map((screen) => {
          const active = screen.id === activeScreenId;
          const start = screen.id === startScreenId;
          return (
            <section key={screen.id} className={`rounded-xl border p-2 ${active ? "border-blue-300 bg-blue-50" : "border-slate-200 bg-white"}`}>
              <button className="flex w-full items-center gap-2 text-left" type="button" onClick={() => selectScreen(screen.id)}>
                <span className={`grid h-7 w-7 place-items-center rounded-lg ${active ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-500"}`}>
                  {start ? <Star size={13} fill="currentColor" /> : <Home size={13} />}
                </span>
                <div className="min-w-0 flex-1">
                  <input className="w-full bg-transparent text-xs font-normal outline-none" value={screen.name} onClick={(event) => event.stopPropagation()} onChange={(event) => renameScreen(screen.id, event.target.value)} />
                  <p className="text-[10px] text-slate-400">{screen.components.length} componentes</p>
                </div>
              </button>
              <div className="mt-2 grid grid-cols-3 gap-1">
                <MiniIcon title="Inicial" active={start} onClick={() => setStartScreen(screen.id)}><Star size={13} /></MiniIcon>
                <MiniIcon title="Duplicar" onClick={() => duplicateScreen(screen.id)}><Copy size={13} /></MiniIcon>
                <MiniIcon title="Eliminar" danger disabled={screens.length <= 1} onClick={() => deleteScreen(screen.id)}><Trash2 size={13} /></MiniIcon>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function VariablesTab() {
  const [query, setQuery] = useState("");
  const variables = useBuilderStore((state) => state.variables);
  const screens = useBuilderStore((state) => state.screens);
  const activeScreenId = useBuilderStore((state) => state.activeScreenId);
  const addVariable = useBuilderStore((state) => state.addVariable);
  const updateVariable = useBuilderStore((state) => state.updateVariable);
  const deleteVariable = useBuilderStore((state) => state.deleteVariable);
  const activeScreenVariables = useMemo(() => screens.find((screen) => screen.id === activeScreenId)?.variables || [], [activeScreenId, screens]);
  const groups = [
    ["global", "Variables Globales", variables?.global || []],
    ["screen", "Variables de Pantalla", activeScreenVariables],
    ["local", "Variables Locales", variables?.local || []],
  ];

  return (
    <div className="flex h-full flex-col">
      <SearchBox value={query} onChange={setQuery} />
      <div className="grid gap-3 overflow-auto pr-1">
        {groups.map(([scope, label, items]) => (
          <section key={scope} className="grid gap-2">
            <div className="flex items-center justify-between">
              <p className="text-[11px] uppercase tracking-wide text-slate-400">{label}</p>
              <button className="grid h-6 w-6 place-items-center rounded-lg bg-blue-600 text-white" type="button" onClick={() => addVariable(scope)}><Plus size={12} /></button>
            </div>
            {items.filter((item) => item.name.toLowerCase().includes(query.toLowerCase())).map((variable) => (
              <article key={variable.id} className="grid gap-1 rounded-xl border border-slate-200 bg-slate-50 p-2">
                <div className="flex gap-1">
                  <input className="h-7 min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2 text-xs" value={variable.name} onChange={(event) => updateVariable(scope, variable.id, { name: event.target.value })} />
                  <MiniIcon danger title="Eliminar" onClick={() => deleteVariable(scope, variable.id)}><Trash2 size={12} /></MiniIcon>
                </div>
                <div className="grid grid-cols-2 gap-1">
                  <select className="h-7 rounded-lg border border-slate-200 bg-white px-1 text-xs" value={variable.type} onChange={(event) => updateVariable(scope, variable.id, { type: event.target.value })}>
                    {variableTypes.map((type) => <option key={type} value={type}>{type}</option>)}
                  </select>
                  <input className="h-7 rounded-lg border border-slate-200 bg-white px-2 text-xs" value={variable.initialValue} onChange={(event) => updateVariable(scope, variable.id, { initialValue: event.target.value })} placeholder="valor" />
                </div>
              </article>
            ))}
          </section>
        ))}
      </div>
    </div>
  );
}

const themeStyleGroups = [
  ["buttons", "Botones"],
  ["texts", "Textos"],
  ["inputs", "Inputs"],
  ["cards", "Cards"],
  ["appbars", "AppBars"],
  ["lists", "Listas"],
  ["forms", "Formularios"],
  ["modals", "Modales"],
];

function ThemeTab() {
  const theme = useBuilderStore((state) => state.theme);
  const setThemePreset = useBuilderStore((state) => state.setThemePreset);
  const updateTheme = useBuilderStore((state) => state.updateTheme);
  const updateThemeSection = useBuilderStore((state) => state.updateThemeSection);
  const updateComponentThemeStyle = useBuilderStore((state) => state.updateComponentThemeStyle);
  const applyThemeToScreen = useBuilderStore((state) => state.applyThemeToScreen);
  const applyThemeToProject = useBuilderStore((state) => state.applyThemeToProject);

  return (
    <div className="flex h-full flex-col gap-3 overflow-auto pr-1">
      <label className="grid gap-1">
        <span className="text-[10px] uppercase tracking-wide text-slate-400">Preset</span>
        <select className="h-8 rounded-xl border border-slate-200 bg-white px-2 text-xs" value={theme.name} onChange={(event) => setThemePreset(event.target.value)}>
          {Object.keys(themePresets).map((name) => <option key={name} value={name}>{name}</option>)}
        </select>
      </label>

      <section className="grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2">
        <p className="text-[11px] uppercase tracking-wide text-slate-400">Configuracion global</p>
        <div className="grid grid-cols-2 gap-2">
          <ThemeInput label="Nombre" value={theme.name} onChange={(value) => updateTheme({ name: value })} />
          <label className="grid gap-1">
            <span className="text-[10px] text-slate-400">Modo</span>
            <select className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs" value={theme.mode} onChange={(event) => updateTheme({ mode: event.target.value })}>
              <option value="light">Claro</option>
              <option value="dark">Oscuro</option>
            </select>
          </label>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {[
            ["primary", "Primario"],
            ["secondary", "Secundario"],
            ["background", "Fondo"],
            ["text", "Texto"],
            ["surface", "Panel/card"],
            ["border", "Borde"],
          ].map(([key, label]) => (
            <ColorField key={key} label={label} value={theme.colors[key]} onChange={(value) => updateThemeSection("colors", { [key]: value })} />
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <ThemeInput label="Fuente" value={theme.typography.fontFamily} onChange={(value) => updateThemeSection("typography", { fontFamily: value })} />
          <ThemeNumber label="Base" value={theme.typography.baseSize} onChange={(value) => updateThemeSection("typography", { baseSize: value })} />
          <ThemeNumber label="Titulo" value={theme.typography.titleSize} onChange={(value) => updateThemeSection("typography", { titleSize: value })} />
          <ThemeNumber label="Peso" value={theme.typography.weight} onChange={(value) => updateThemeSection("typography", { weight: value })} />
          <ThemeNumber label="Radio" value={theme.shape.radius} onChange={(value) => updateThemeSection("shape", { radius: value })} />
          <ThemeNumber label="Espaciado" value={theme.spacing.base} onChange={(value) => updateThemeSection("spacing", { base: value })} />
        </div>
        <label className="grid gap-1">
          <span className="text-[10px] text-slate-400">Sombra</span>
          <select className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs" value={theme.effects.shadow} onChange={(event) => updateThemeSection("effects", { shadow: event.target.value })}>
            <option value="none">Sin sombra</option>
            <option value="soft">Suave</option>
            <option value="medium">Media</option>
          </select>
        </label>
      </section>

      <section className="grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2">
        <p className="text-[11px] uppercase tracking-wide text-slate-400">Estilos por componente</p>
        {themeStyleGroups.map(([key, label]) => (
          <details key={key} className="rounded-xl bg-white p-2">
            <summary className="cursor-pointer text-xs text-slate-600">{label}</summary>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <ColorField label="Texto" value={theme.componentStyles[key]?.color} onChange={(value) => updateComponentThemeStyle(key, { color: value })} />
              <ColorField label="Fondo" value={theme.componentStyles[key]?.backgroundColor} onChange={(value) => updateComponentThemeStyle(key, { backgroundColor: value })} />
              <ThemeNumber label="Fuente" value={theme.componentStyles[key]?.fontSize} onChange={(value) => updateComponentThemeStyle(key, { fontSize: value })} />
              <ThemeNumber label="Radio" value={theme.componentStyles[key]?.borderRadius} onChange={(value) => updateComponentThemeStyle(key, { borderRadius: value })} />
            </div>
          </details>
        ))}
      </section>

      <div className="grid gap-2">
        <button className="h-8 rounded-xl bg-blue-600 text-xs text-white" type="button" onClick={applyThemeToScreen}>Aplicar tema a toda la pantalla</button>
        <button className="h-8 rounded-xl bg-slate-900 text-xs text-white" type="button" onClick={applyThemeToProject}>Aplicar tema a todo el proyecto</button>
      </div>
    </div>
  );
}

function ColorField({ label, value, onChange }) {
  return (
    <label className="grid gap-1">
      <span className="text-[10px] text-slate-400">{label}</span>
      <span className="flex h-8 items-center gap-1 rounded-lg border border-slate-200 bg-white px-1">
        <input className="h-5 w-6" type="color" value={value || "#ffffff"} onChange={(event) => onChange(event.target.value)} />
        <input className="min-w-0 flex-1 bg-transparent text-[11px] outline-none" value={value || ""} onChange={(event) => onChange(event.target.value)} />
      </span>
    </label>
  );
}

function ThemeInput({ label, value, onChange }) {
  return (
    <label className="grid gap-1">
      <span className="text-[10px] text-slate-400">{label}</span>
      <input className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs" value={value || ""} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function ThemeNumber({ label, value, onChange }) {
  return (
    <label className="grid gap-1">
      <span className="text-[10px] text-slate-400">{label}</span>
      <input className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs" type="number" value={value ?? 0} onChange={(event) => onChange(Number(event.target.value))} />
    </label>
  );
}

const androidPermissions = [
  ["internet", "Internet"],
  ["camera", "Camara"],
  ["gallery", "Galeria"],
  ["location", "Ubicacion"],
  ["microphone", "Microfono"],
  ["notifications", "Notificaciones"],
  ["storage", "Almacenamiento"],
];

function AndroidTab() {
  const androidConfig = useBuilderStore((state) => state.androidConfig);
  const resources = useBuilderStore((state) => state.resources || []);
  const updateAndroidConfig = useBuilderStore((state) => state.updateAndroidConfig);
  const packageValid = /^([a-z][a-z0-9_]*\.)+[a-z][a-z0-9_]*$/.test(androidConfig.packageName || "");
  const imageResources = resources.filter((resource) => resource.type?.startsWith("image/"));

  return (
    <div className="flex h-full flex-col gap-3 overflow-auto pr-1">
      <section className="grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-xl bg-emerald-50 text-emerald-700">
            <BadgeCheck size={15} />
          </span>
          <div>
            <p className="text-xs font-medium text-slate-700">Android APK</p>
            <p className="text-[11px] text-slate-400">Configuracion para compilar release.</p>
          </div>
        </div>
        <ThemeInput label="Nombre de la app" value={androidConfig.appName} onChange={(value) => updateAndroidConfig({ appName: value })} />
        <label className="grid gap-1">
          <span className="text-[10px] text-slate-400">Package name</span>
          <span className={`flex h-8 items-center gap-1 rounded-lg border bg-white px-2 ${packageValid ? "border-slate-200" : "border-rose-300"}`}>
            <KeyRound size={12} className={packageValid ? "text-slate-400" : "text-rose-500"} />
            <input className="min-w-0 flex-1 bg-transparent text-xs outline-none" value={androidConfig.packageName} onChange={(event) => updateAndroidConfig({ packageName: event.target.value })} placeholder="com.usuario.miapp" />
          </span>
          {!packageValid ? <span className="text-[10px] text-rose-600">Usa formato com.usuario.miapp</span> : null}
        </label>
        <div className="grid grid-cols-2 gap-2">
          <ThemeInput label="Version" value={androidConfig.version} onChange={(value) => updateAndroidConfig({ version: value })} />
          <ThemeNumber label="Build" value={androidConfig.buildNumber} onChange={(value) => updateAndroidConfig({ buildNumber: value })} />
        </div>
        <label className="grid gap-1">
          <span className="text-[10px] text-slate-400">Orientacion</span>
          <select className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs" value={androidConfig.orientation} onChange={(event) => updateAndroidConfig({ orientation: event.target.value })}>
            <option value="portrait">Vertical</option>
            <option value="landscape">Horizontal</option>
            <option value="both">Ambas</option>
          </select>
        </label>
      </section>

      <section className="grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2">
        <p className="text-[11px] uppercase tracking-wide text-slate-400">Branding</p>
        <ResourceSelect label="Icono de app" value={androidConfig.appIconResourceId} resources={imageResources} onChange={(value) => updateAndroidConfig({ appIconResourceId: value })} />
        <ResourceSelect label="Splash screen" value={androidConfig.splashResourceId} resources={imageResources} onChange={(value) => updateAndroidConfig({ splashResourceId: value })} />
        {imageResources.length === 0 ? (
          <p className="rounded-xl bg-amber-50 px-3 py-2 text-[11px] text-amber-700">Importa imagenes desde Recursos para usarlas como icono o splash.</p>
        ) : null}
      </section>

      <section className="grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2">
        <div className="flex items-center gap-2">
          <ShieldCheck size={14} className="text-slate-400" />
          <p className="text-[11px] uppercase tracking-wide text-slate-400">Permisos</p>
        </div>
        <div className="grid gap-1">
          {androidPermissions.map(([key, label]) => (
            <label key={key} className="flex h-8 items-center justify-between rounded-lg bg-white px-2 text-xs text-slate-600">
              {label}
              <input
                type="checkbox"
                checked={Boolean(androidConfig.permissions?.[key])}
                onChange={(event) => updateAndroidConfig({ permissions: { [key]: event.target.checked } })}
              />
            </label>
          ))}
        </div>
      </section>
    </div>
  );
}

function ResourceSelect({ label, value, resources, onChange }) {
  return (
    <label className="grid gap-1">
      <span className="text-[10px] text-slate-400">{label}</span>
      <select className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs" value={value || ""} onChange={(event) => onChange(event.target.value)}>
        <option value="">Usar default</option>
        {resources.map((resource) => <option key={resource.id} value={resource.id}>{resource.name}</option>)}
      </select>
    </label>
  );
}

function DataTab() {
  const [query, setQuery] = useState("");
  const [crudConfig, setCrudConfig] = useState(null);
  const dataSources = useBuilderStore((state) => state.dataSources);
  const addTable = useBuilderStore((state) => state.addTable);
  const updateTable = useBuilderStore((state) => state.updateTable);
  const deleteTable = useBuilderStore((state) => state.deleteTable);
  const addField = useBuilderStore((state) => state.addField);
  const updateField = useBuilderStore((state) => state.updateField);
  const deleteField = useBuilderStore((state) => state.deleteField);

  return (
    <div className="flex h-full flex-col">
      <SearchBox value={query} onChange={setQuery} />
      <div className="grid gap-3 overflow-auto pr-1">
        {dataSources.map((source) => (
          <section key={source.id} className="grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2">
            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-600">{source.name}</p>
              <span className="rounded-lg bg-white px-2 py-1 text-[10px] uppercase text-blue-600">{source.type}</span>
            </div>
            <button className="h-7 rounded-lg bg-blue-600 text-xs text-white" type="button" onClick={() => addTable(source.id, "Nueva tabla")}>Crear tabla</button>
            {source.tables.filter((table) => table.name.toLowerCase().includes(query.toLowerCase())).map((table) => (
              <details key={table.id} className="rounded-xl bg-white p-2">
                <summary className="cursor-pointer text-xs text-slate-700">{table.name}</summary>
                <div className="mt-2 grid gap-2">
                  <div className="flex gap-1">
                    <input className="h-7 min-w-0 flex-1 rounded-lg border border-slate-200 px-2 text-xs" value={table.name} onChange={(event) => updateTable(source.id, table.id, { name: event.target.value })} />
                    <MiniIcon danger title="Eliminar tabla" onClick={() => deleteTable(source.id, table.id)}><Trash2 size={12} /></MiniIcon>
                  </div>
                  <button className="h-7 rounded-lg bg-slate-100 text-xs text-slate-600" type="button" onClick={() => addField(source.id, table.id)}>Agregar campo</button>
                  <button
                    className="flex h-8 items-center justify-center gap-1 rounded-lg bg-blue-600 text-xs text-white"
                    type="button"
                    onClick={() => setCrudConfig(createDefaultCrudConfig(dataSources, source.id, table.id))}
                  >
                    <Wand2 size={13} />
                    Generar CRUD
                  </button>
                  {table.fields.map((field) => (
                    <div key={field.id} className="grid grid-cols-[1fr_82px_26px] gap-1">
                      <input disabled={field.system} className="h-7 rounded-lg border border-slate-200 px-2 text-[11px] disabled:bg-slate-100" value={field.name} onChange={(event) => updateField(source.id, table.id, field.id, { name: event.target.value })} />
                      <select disabled={field.system} className="h-7 rounded-lg border border-slate-200 px-1 text-[11px] disabled:bg-slate-100" value={field.type} onChange={(event) => updateField(source.id, table.id, field.id, { type: event.target.value })}>
                        {fieldTypes.map((type) => <option key={type} value={type}>{type}</option>)}
                      </select>
                      <MiniIcon danger disabled={field.system} title="Eliminar campo" onClick={() => deleteField(source.id, table.id, field.id)}><Trash2 size={11} /></MiniIcon>
                    </div>
                  ))}
                  {(table.relations || []).length > 0 ? <p className="text-[11px] text-slate-400">{table.relations.length} relaciones</p> : null}
                </div>
              </details>
            ))}
          </section>
        ))}
      </div>
      {crudConfig ? (
        <CrudGeneratorModal
          config={crudConfig}
          dataSources={dataSources}
          onChange={setCrudConfig}
          onClose={() => setCrudConfig(null)}
        />
      ) : null}
    </div>
  );
}

function createDefaultCrudConfig(dataSources, sourceId, tableId) {
  const source = dataSources.find((item) => item.id === sourceId) || dataSources[0];
  const table = source?.tables.find((item) => item.id === tableId) || source?.tables[0];
  const editableFields = (table?.fields || []).filter((field) => !field.system && field.name !== "id");
  const titleField = editableFields.find((field) => field.name.toLowerCase().includes("nombre"))?.name || editableFields[0]?.name || "id";
  const subtitleField = editableFields.find((field) => ["telefono", "dosha", "email"].some((key) => field.name.toLowerCase().includes(key)))?.name || editableFields[1]?.name || titleField;
  const imageField = editableFields.find((field) => field.type === "image")?.name || "";

  return {
    sourceId: source?.id || "",
    tableId: table?.id || "",
    moduleName: table?.name || "Modulo",
    visibleFieldNames: editableFields.slice(0, 3).map((field) => field.name),
    titleField,
    subtitleField,
    imageField,
    formFieldNames: editableFields.map((field) => field.name),
    searchField: titleField,
    enableDetail: true,
    enableEdit: true,
    enableDelete: true,
    conflicts: [],
  };
}

function CrudGeneratorModal({ config, dataSources, onChange, onClose }) {
  const generateCrudModule = useBuilderStore((state) => state.generateCrudModule);
  const tables = dataSources.flatMap((source) =>
    source.tables.map((table) => ({ ...table, sourceId: source.id, sourceName: source.name })),
  );
  const selectedTable = tables.find((table) => table.sourceId === config.sourceId && table.id === config.tableId) || tables[0];
  const editableFields = (selectedTable?.fields || []).filter((field) => !field.system && field.name !== "id");
  const imageFields = editableFields.filter((field) => field.type === "image");

  function update(patch) {
    onChange({ ...config, ...patch, conflicts: [] });
  }

  function changeTable(value) {
    const [sourceId, tableId] = value.split("::");
    onChange(createDefaultCrudConfig(dataSources, sourceId, tableId));
  }

  function toggleField(key, fieldName) {
    const values = config[key] || [];
    update({
      [key]: values.includes(fieldName)
        ? values.filter((item) => item !== fieldName)
        : [...values, fieldName],
    });
  }

  function buildPayload() {
    return {
      sourceId: config.sourceId,
      table: selectedTable,
      moduleName: config.moduleName,
      visibleFields: editableFields.filter((field) => config.visibleFieldNames.includes(field.name)),
      formFields: editableFields.filter((field) => config.formFieldNames.includes(field.name)),
      titleField: config.titleField,
      subtitleField: config.subtitleField,
      imageField: config.imageField,
      searchField: config.searchField,
      enableDetail: config.enableDetail,
      enableEdit: config.enableEdit,
      enableDelete: config.enableDelete,
    };
  }

  function submit(mode = "check") {
    const result = generateCrudModule(buildPayload(), mode);
    if (result?.conflicts?.length && mode === "check") {
      onChange({ ...config, conflicts: result.conflicts });
      return;
    }
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-slate-950/35 p-4">
      <section className="grid max-h-[88vh] w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-soft">
        <header className="flex h-12 items-center justify-between border-b border-slate-200 px-4">
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-blue-50 text-blue-700"><Wand2 size={15} /></span>
            <div>
              <p className="text-xs font-medium text-slate-700">Generar CRUD</p>
              <p className="text-[11px] text-slate-400">Pantallas, componentes y flujos automaticos</p>
            </div>
          </div>
          <button className="grid h-8 w-8 place-items-center rounded-xl bg-slate-100 text-slate-500" type="button" onClick={onClose}>
            <X size={15} />
          </button>
        </header>

        <div className="grid gap-3 overflow-auto p-4">
          <div className="grid grid-cols-2 gap-3">
            <ModalField label="Tabla origen">
              <select className="h-8 rounded-xl border border-slate-200 px-2 text-xs" value={`${config.sourceId}::${config.tableId}`} onChange={(event) => changeTable(event.target.value)}>
                {tables.map((table) => <option key={`${table.sourceId}-${table.id}`} value={`${table.sourceId}::${table.id}`}>{table.sourceName} / {table.name}</option>)}
              </select>
            </ModalField>
            <ModalField label="Nombre del modulo">
              <input className="h-8 rounded-xl border border-slate-200 px-2 text-xs" value={config.moduleName} onChange={(event) => update({ moduleName: event.target.value })} />
            </ModalField>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <ModalField label="Campo titulo">
              <FieldChoice fields={editableFields} value={config.titleField} onChange={(value) => update({ titleField: value })} />
            </ModalField>
            <ModalField label="Campo subtitulo">
              <FieldChoice fields={editableFields} value={config.subtitleField} onChange={(value) => update({ subtitleField: value })} />
            </ModalField>
            <ModalField label="Imagen opcional">
              <FieldChoice fields={imageFields} value={config.imageField} onChange={(value) => update({ imageField: value })} emptyLabel="Sin imagen" />
            </ModalField>
            <ModalField label="Busqueda principal">
              <FieldChoice fields={editableFields} value={config.searchField} onChange={(value) => update({ searchField: value })} />
            </ModalField>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FieldChecklist title="Campos visibles en lista" fields={editableFields} values={config.visibleFieldNames} onToggle={(fieldName) => toggleField("visibleFieldNames", fieldName)} />
            <FieldChecklist title="Campos incluidos en formulario" fields={editableFields} values={config.formFieldNames} onToggle={(fieldName) => toggleField("formFieldNames", fieldName)} />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <ToggleOption label="Detalle" checked={config.enableDetail} onChange={(value) => update({ enableDetail: value })} />
            <ToggleOption label="Edicion" checked={config.enableEdit} onChange={(value) => update({ enableEdit: value })} />
            <ToggleOption label="Eliminacion" checked={config.enableDelete} onChange={(value) => update({ enableDelete: value })} />
          </div>

          {config.conflicts?.length ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
              <p className="text-xs font-medium text-amber-800">Ya existen pantallas con esos nombres.</p>
              <p className="mt-1 text-[11px] text-amber-700">{config.conflicts.join(", ")}</p>
              <div className="mt-3 grid grid-cols-3 gap-2">
                <button className="h-8 rounded-xl bg-amber-500 text-xs text-white" type="button" onClick={() => submit("overwrite")}>Sobrescribir</button>
                <button className="h-8 rounded-xl bg-blue-600 text-xs text-white" type="button" onClick={() => submit("copy")}>Crear copia</button>
                <button className="h-8 rounded-xl bg-white text-xs text-slate-600" type="button" onClick={onClose}>Cancelar</button>
              </div>
            </div>
          ) : null}
        </div>

        <footer className="flex justify-end gap-2 border-t border-slate-200 p-3">
          <button className="h-8 rounded-xl bg-slate-100 px-3 text-xs text-slate-600" type="button" onClick={onClose}>Cancelar</button>
          <button className="h-8 rounded-xl bg-blue-600 px-3 text-xs text-white" type="button" onClick={() => submit("check")} disabled={!selectedTable || !config.moduleName}>
            Generar CRUD
          </button>
        </footer>
      </section>
    </div>
  );
}

function ModalField({ label, children }) {
  return (
    <label className="grid gap-1">
      <span className="text-[10px] uppercase tracking-wide text-slate-400">{label}</span>
      {children}
    </label>
  );
}

function FieldChoice({ fields, value, onChange, emptyLabel = "Elegir campo" }) {
  return (
    <select className="h-8 rounded-xl border border-slate-200 px-2 text-xs" value={value || ""} onChange={(event) => onChange(event.target.value)}>
      <option value="">{emptyLabel}</option>
      {fields.map((field) => <option key={field.id} value={field.name}>{field.name}</option>)}
    </select>
  );
}

function FieldChecklist({ title, fields, values, onToggle }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-slate-50 p-2">
      <p className="mb-2 text-[11px] text-slate-500">{title}</p>
      <div className="grid max-h-40 gap-1 overflow-auto">
        {fields.map((field) => (
          <label key={field.id} className="flex h-7 items-center gap-2 rounded-lg bg-white px-2 text-[11px] text-slate-600">
            <input type="checkbox" checked={(values || []).includes(field.name)} onChange={() => onToggle(field.name)} />
            <span className="min-w-0 flex-1 truncate">{field.name}</span>
            <span className="text-[10px] text-slate-400">{field.type}</span>
          </label>
        ))}
      </div>
    </section>
  );
}

function ToggleOption({ label, checked, onChange }) {
  return (
    <label className="flex h-9 items-center justify-between rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-600">
      {label}
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
    </label>
  );
}

function FlowsTab() {
  const flows = useBuilderStore((state) => state.flows);
  const activeFlowId = useBuilderStore((state) => state.activeFlowId);
  const setActiveFlow = useBuilderStore((state) => state.setActiveFlow);
  const addFlow = useBuilderStore((state) => state.addFlow);
  const updateFlow = useBuilderStore((state) => state.updateFlow);

  return (
    <div className="flex h-full flex-col gap-3">
      <button className="h-8 rounded-xl bg-blue-600 text-xs text-white" type="button" onClick={addFlow}>Nuevo flujo</button>
      <div className="grid gap-2">
        {flows.map((flow) => (
          <button
            key={flow.id}
            className={`rounded-xl border p-2 text-left ${flow.id === activeFlowId ? "border-blue-300 bg-blue-50" : "border-slate-200 bg-white"}`}
            type="button"
            onClick={() => setActiveFlow(flow.id)}
          >
            <input
              className="w-full bg-transparent text-xs text-slate-700 outline-none"
              value={flow.name}
              onClick={(event) => event.stopPropagation()}
              onChange={(event) => updateFlow(flow.id, { name: event.target.value })}
            />
            <p className="text-[10px] text-slate-400">{flow.nodes.length} nodos · {flow.connections.length} conexiones</p>
          </button>
        ))}
      </div>
      <div className="min-h-0 overflow-auto">
        <p className="mb-2 text-[11px] uppercase tracking-wide text-slate-400">Biblioteca visual</p>
        <div className="grid grid-cols-2 gap-2 pr-1">
          {actionLibrary.map(([label, Icon]) => (
            <article key={label} className="flex h-16 flex-col items-center justify-center gap-1 rounded-xl border border-slate-200 bg-white text-slate-600 shadow-panel">
              <Icon size={17} />
              <span className="text-center text-[11px]">{label}</span>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}

function ResourcesTab() {
  const resources = useBuilderStore((state) => state.resources || []);
  const addResource = useBuilderStore((state) => state.addResource);
  const deleteResource = useBuilderStore((state) => state.deleteResource);

  async function importResources(event) {
    const files = Array.from(event.target.files || []);
    await Promise.all(files.map((file) => new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => {
        addResource({
          id: crypto.randomUUID(),
          name: file.name,
          type: file.type,
          size: file.size,
          dataUrl: reader.result,
        });
        resolve();
      };
      reader.readAsDataURL(file);
    })));
    event.target.value = "";
  }

  return (
    <div className="flex h-full flex-col">
      <label className="mb-3 flex h-9 cursor-pointer items-center justify-center gap-2 rounded-xl bg-blue-600 text-xs text-white">
        <Plus size={14} />
        Importar recurso
        <input className="hidden" type="file" multiple onChange={importResources} />
      </label>
      <div className="grid gap-2 overflow-auto">
        {resources.length === 0 ? <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-3 text-center text-xs text-slate-400">Imagenes, iconos, videos, audios y archivos.</p> : null}
        {resources.map((resource) => (
          <div key={resource.id} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-2">
            <Folder size={14} className="text-slate-400" />
            <span className="min-w-0 flex-1 truncate text-xs text-slate-600">{resource.name}</span>
            <MiniIcon danger title="Eliminar" onClick={() => deleteResource(resource.id)}><Trash2 size={12} /></MiniIcon>
          </div>
        ))}
      </div>
    </div>
  );
}

function MiniIcon({ children, title, onClick, active = false, danger = false, disabled = false }) {
  return (
    <button
      className={`grid h-7 place-items-center rounded-lg border text-xs transition ${active ? "border-blue-600 bg-blue-600 text-white" : danger ? "border-rose-100 bg-rose-50 text-rose-600" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"} disabled:opacity-40`}
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}
