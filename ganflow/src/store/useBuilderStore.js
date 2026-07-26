import { create } from "zustand";
import { persist } from "zustand/middleware";

const STORAGE_KEY = "ganflow.project.v3";
const DEFAULT_SCREEN_ID = "screen-home";

try {
  const storedProject = localStorage.getItem(STORAGE_KEY);
  if (storedProject) JSON.parse(storedProject);
} catch {
  localStorage.removeItem(STORAGE_KEY);
}

export const VIEWPORTS = {
  mobile: { label: "Movil", width: 390, height: 844 },
  tablet: { label: "Tablet", width: 768, height: 1024 },
  desktop: { label: "PC", width: 1280, height: 720 },
};

const defaultScreenSettings = {
  width: 390,
  height: 844,
  background: "#ffffff",
  scroll: true,
  orientation: "portrait",
  viewport: {
    mode: "mobile",
    mobile: { width: 390, height: 844 },
    tablet: { width: 768, height: 1024 },
    desktop: { width: 1280, height: 720 },
  },
  appBar: {
    enabled: false,
    title: "Inicio",
    height: 56,
    backgroundColor: "#ffffff",
    textColor: "#111827",
    showBack: false,
    showMenu: true,
    showMore: false,
    actions: [],
    moreMenu: [],
    shadow: true,
    titleAlign: "left",
  },
  drawer: {
    enabled: false,
    items: [],
  },
  bottomBar: {
    enabled: false,
  },
};

const breakpointOrder = ["mobile", "tablet", "desktop"];

const baseProps = {
  text: "",
  color: "#111827",
  fontSize: 16,
  width: 180,
  height: 56,
  x: 32,
  y: 32,
  backgroundColor: "#ffffff",
  borderRadius: 14,
  zIndex: 1,
  locked: false,
  hidden: false,
  actionType: "none",
  actionTarget: "",
  actionUrl: "",
  actionMessage: "",
  formula: "",
  ifExpression: "",
  elseExpression: "",
  visibleIf: "",
  enabledIf: "",
  useThemeStyle: true,
};

const defaultEvents = {
  onTap: [],
  onLoad: [],
  onChange: [],
  onSubmit: [],
};

const defaultAndroidConfig = {
  appName: "GanFlow",
  packageName: "com.ganflow.app",
  version: "1.0.0",
  buildNumber: 1,
  appIconResourceId: "",
  splashResourceId: "",
  orientation: "portrait",
  permissions: {
    internet: true,
    camera: false,
    gallery: false,
    location: false,
    microphone: false,
    notifications: false,
    storage: false,
  },
};

const createDefaultFlow = () => ({
  id: "flow-main",
  name: "Flujo principal",
  trigger: { type: "screenEvent", screenId: DEFAULT_SCREEN_ID, componentId: "", event: "onLoad" },
  zoom: 1,
  pan: { x: 0, y: 0 },
  selectedNodeIds: [],
  errors: [],
  nodes: [
    { id: "node-load", type: "onLoad", category: "Eventos", label: "onLoad", x: 80, y: 120, params: {} },
    { id: "node-message", type: "showMessage", category: "Mensajes", label: "Mostrar Mensaje", x: 340, y: 120, params: { message: "App lista" } },
  ],
  connections: [
    { id: "conn-load-message", type: "execution", from: "node-load.next", to: "node-message.in" },
  ],
  edges: [
    { id: "conn-load-message", type: "execution", from: "node-load.next", to: "node-message.in" },
  ],
});

export const variableTypes = ["string", "number", "boolean", "date", "list", "object", "image"];
export const fieldTypes = ["string", "number", "boolean", "date", "image", "list", "object", "relation"];

const systemFields = [
  { id: "field-id", name: "id", type: "string", system: true },
  { id: "field-created-at", name: "createdAt", type: "date", system: true },
  { id: "field-updated-at", name: "updatedAt", type: "date", system: true },
];

const createField = (name = "campo", type = "string") => ({
  id: createId(),
  name,
  type,
  relation: { tableId: "", fieldName: "id" },
});

const createTable = (name = "Nueva tabla") => {
  const id = slugify(name) || `tabla_${Date.now()}`;
  return {
    id,
    name,
    fields: [...systemFields, createField("nombre", "string")],
    relations: [],
    records: [],
  };
};

const createDefaultDataSources = () => [
  {
    id: "local1",
    type: "local",
    name: "Base Local",
    tables: [
      {
        id: "pacientes",
        name: "Pacientes",
        fields: [
          ...systemFields,
          { id: "field-nombre", name: "nombre", type: "string" },
          { id: "field-telefono", name: "telefono", type: "string" },
          { id: "field-dosha", name: "dosha", type: "string" },
          { id: "field-fecha-nacimiento", name: "fechaNacimiento", type: "date" },
          { id: "field-observaciones", name: "observaciones", type: "string" },
        ],
        relations: [],
        records: [
          { id: "paciente-1", nombre: "Gabriel", telefono: "", dosha: "Vata-Pitta", fechaNacimiento: "", observaciones: "", createdAt: "", updatedAt: "" },
          { id: "paciente-2", nombre: "Ana", telefono: "", dosha: "Pitta", fechaNacimiento: "", observaciones: "", createdAt: "", updatedAt: "" },
          { id: "paciente-3", nombre: "Juan", telefono: "", dosha: "Kapha", fechaNacimiento: "", observaciones: "", createdAt: "", updatedAt: "" },
        ],
      },
    ],
  },
  {
    id: "firebase1",
    type: "firebase",
    name: "Firebase",
    tables: [],
  },
];

const createVariable = (scope = "global") => ({
  id: createId(),
  scope,
  name: "variable",
  type: "string",
  initialValue: "",
});

export const themePresets = {
  "Moderno claro": {
    name: "Moderno claro",
    mode: "light",
    colors: { primary: "#2563eb", secondary: "#14b8a6", background: "#f1f5f9", surface: "#ffffff", text: "#111827", border: "#e2e8f0" },
    typography: { fontFamily: "Inter", baseSize: 12, titleSize: 18, weight: 400 },
    shape: { radius: 12 },
    effects: { shadow: "soft" },
    spacing: { base: 8 },
  },
  "Moderno oscuro": {
    name: "Moderno oscuro",
    mode: "dark",
    colors: { primary: "#60a5fa", secondary: "#22d3ee", background: "#0f172a", surface: "#1e293b", text: "#e5e7eb", border: "#334155" },
    typography: { fontFamily: "Inter", baseSize: 12, titleSize: 18, weight: 400 },
    shape: { radius: 12 },
    effects: { shadow: "medium" },
    spacing: { base: 8 },
  },
  Minimalista: {
    name: "Minimalista",
    mode: "light",
    colors: { primary: "#111827", secondary: "#6b7280", background: "#fafafa", surface: "#ffffff", text: "#18181b", border: "#e4e4e7" },
    typography: { fontFamily: "Inter", baseSize: 12, titleSize: 17, weight: 400 },
    shape: { radius: 8 },
    effects: { shadow: "none" },
    spacing: { base: 8 },
  },
  Ayurveda: {
    name: "Ayurveda",
    mode: "light",
    colors: { primary: "#6B8E23", secondary: "#D4A017", background: "#F7F1E5", surface: "#FFFFFF", text: "#1F2937", border: "#E5E7EB" },
    typography: { fontFamily: "Inter", baseSize: 12, titleSize: 18, weight: 400 },
    shape: { radius: 12 },
    effects: { shadow: "soft" },
    spacing: { base: 8 },
  },
  Espiritual: {
    name: "Espiritual",
    mode: "light",
    colors: { primary: "#7c3aed", secondary: "#f59e0b", background: "#f8f7ff", surface: "#ffffff", text: "#2e1065", border: "#ddd6fe" },
    typography: { fontFamily: "Inter", baseSize: 12, titleSize: 18, weight: 400 },
    shape: { radius: 16 },
    effects: { shadow: "soft" },
    spacing: { base: 10 },
  },
  Material: {
    name: "Material",
    mode: "light",
    colors: { primary: "#6750a4", secondary: "#625b71", background: "#fffbfe", surface: "#ffffff", text: "#1c1b1f", border: "#cac4d0" },
    typography: { fontFamily: "Inter", baseSize: 12, titleSize: 18, weight: 400 },
    shape: { radius: 12 },
    effects: { shadow: "soft" },
    spacing: { base: 8 },
  },
  Elegante: {
    name: "Elegante",
    mode: "light",
    colors: { primary: "#0f172a", secondary: "#b45309", background: "#f8fafc", surface: "#ffffff", text: "#111827", border: "#d1d5db" },
    typography: { fontFamily: "Inter", baseSize: 12, titleSize: 19, weight: 400 },
    shape: { radius: 10 },
    effects: { shadow: "medium" },
    spacing: { base: 8 },
  },
};

const componentStyleKeys = {
  button: "buttons",
  text: "texts",
  input: "inputs",
  textarea: "inputs",
  searchInput: "inputs",
  datePicker: "inputs",
  timePicker: "inputs",
  radioGroup: "inputs",
  slider: "inputs",
  filePicker: "inputs",
  imagePicker: "inputs",
  select: "inputs",
  checkbox: "inputs",
  switch: "inputs",
  card: "cards",
  badge: "buttons",
  chip: "buttons",
  appbar: "appbars",
  list: "lists",
  dynamicList: "lists",
  dataTable: "lists",
  pagination: "lists",
  form: "forms",
  container: "cards",
  modal: "modals",
  alertDialog: "modals",
};

const buildComponentStyles = (theme) => ({
  buttons: { color: "#ffffff", backgroundColor: theme.colors.primary, borderRadius: theme.shape.radius, fontSize: theme.typography.baseSize + 1 },
  texts: { color: theme.colors.text, backgroundColor: "transparent", borderRadius: 0, fontSize: theme.typography.titleSize },
  inputs: { color: theme.colors.text, backgroundColor: theme.colors.surface, borderRadius: theme.shape.radius, fontSize: theme.typography.baseSize },
  cards: { color: theme.colors.text, backgroundColor: theme.colors.surface, borderRadius: theme.shape.radius + 4, fontSize: theme.typography.baseSize + 1 },
  appbars: { color: "#ffffff", backgroundColor: theme.colors.primary, borderRadius: theme.shape.radius + 4, fontSize: theme.typography.titleSize },
  lists: { color: theme.colors.text, backgroundColor: theme.colors.surface, borderRadius: theme.shape.radius + 2, fontSize: theme.typography.baseSize },
  forms: { color: theme.colors.text, backgroundColor: theme.colors.surface, borderRadius: theme.shape.radius + 4, fontSize: theme.typography.baseSize },
  modals: { color: theme.colors.text, backgroundColor: theme.colors.surface, borderRadius: theme.shape.radius + 6, fontSize: theme.typography.baseSize },
});

const createTheme = (preset = themePresets["Moderno claro"]) => ({
  ...preset,
  colors: { ...preset.colors },
  typography: { ...preset.typography },
  shape: { ...preset.shape },
  effects: { ...preset.effects },
  spacing: { ...preset.spacing },
  componentStyles: buildComponentStyles(preset),
});

function normalizeTheme(theme) {
  const base = createTheme(themePresets["Moderno claro"]);
  const merged = {
    ...base,
    ...(theme || {}),
    colors: { ...base.colors, ...(theme?.colors || {}) },
    typography: { ...base.typography, ...(theme?.typography || {}) },
    shape: { ...base.shape, ...(theme?.shape || {}) },
    effects: { ...base.effects, ...(theme?.effects || {}) },
    spacing: { ...base.spacing, ...(theme?.spacing || {}) },
  };
  return {
    ...merged,
    componentStyles: {
      ...buildComponentStyles(merged),
      ...(theme?.componentStyles || {}),
    },
  };
}

export function getThemeStyleForType(theme, type) {
  const normalizedTheme = normalizeTheme(theme);
  const key = componentStyleKeys[type] || (type === "icon" || type === "avatar" ? "buttons" : "cards");
  return {
    color: normalizedTheme.colors.text,
    backgroundColor: normalizedTheme.colors.surface,
    borderRadius: normalizedTheme.shape.radius,
    fontSize: normalizedTheme.typography.baseSize,
    ...(normalizedTheme.componentStyles?.[key] || {}),
  };
}

export function getThemedProps(component, theme) {
  const props = component?.props || {};
  if (props.useThemeStyle === false) return props;
  return { ...props, ...getThemeStyleForType(theme, component?.type), width: props.width, height: props.height, x: props.x, y: props.y, zIndex: props.zIndex };
}

export const componentDefaults = {
  text: { label: "Texto", category: "Básicos", props: { ...baseProps, text: "Texto principal", fontSize: 24, width: 220, height: 44, backgroundColor: "transparent", borderRadius: 0 } },
  button: { label: "Botón", category: "Básicos", description: "Ejecuta acciones al tocarlo.", props: { ...baseProps, text: "Botón", color: "#ffffff", backgroundColor: "#2563eb", width: 150, height: 48 } },
  card: { label: "Card", category: "Layout", props: { ...baseProps, text: "Tarjeta", fontSize: 18, width: 280, height: 150, borderRadius: 20 } },
  icon: { label: "Icono", category: "Básicos", props: { ...baseProps, text: "star", iconName: "Star", color: "#2563eb", backgroundColor: "transparent", borderColor: "#dbeafe", width: 56, height: 56, fontSize: 28, borderRadius: 0 } },
  badge: { label: "Badge", category: "Básicos", props: { ...baseProps, text: "Nuevo", color: "#065f46", backgroundColor: "#d1fae5", width: 92, height: 32, fontSize: 12, borderRadius: 999 } },
  chip: { label: "Chip", category: "Básicos", props: { ...baseProps, text: "Etiqueta", color: "#334155", backgroundColor: "#f1f5f9", width: 112, height: 36, fontSize: 12, borderRadius: 999 } },
  divider: { label: "Divider", category: "Básicos", props: { ...baseProps, text: "", backgroundColor: "#cbd5e1", width: 260, height: 2, borderRadius: 999 } },
  spacer: { label: "Spacer", category: "Básicos", props: { ...baseProps, text: "", backgroundColor: "transparent", width: 120, height: 32, borderRadius: 0 } },
  input: { label: "Input", category: "Formularios", props: { ...baseProps, text: "Nombre", placeholder: "Nombre", value: "", color: "#64748b", width: 260, height: 48 } },
  textarea: { label: "TextArea", category: "Formularios", props: { ...baseProps, text: "Mensaje", placeholder: "Mensaje", value: "", color: "#64748b", width: 260, height: 96 } },
  checkbox: { label: "Checkbox", category: "Formularios", props: { ...baseProps, text: "Acepto", value: true, width: 170, height: 44, backgroundColor: "transparent", borderRadius: 0 } },
  switch: { label: "Switch", category: "Formularios", props: { ...baseProps, text: "Activo", value: true, onColor: "#2563eb", offColor: "#cbd5e1", thumbColor: "#ffffff", switchSize: "medium", width: 170, height: 44, backgroundColor: "transparent", borderRadius: 0 } },
  select: { label: "Select", category: "Formularios", props: { ...baseProps, text: "Seleccionar", value: "", options: "Opcion 1\nOpcion 2\nOpcion 3", color: "#475569", width: 220, height: 48 } },
  datePicker: { label: "DatePicker", category: "Formularios", props: { ...baseProps, text: "Fecha", label: "Fecha", value: "", minDate: "", maxDate: "", format: "yyyy-MM-dd", width: 220, height: 48 } },
  timePicker: { label: "TimePicker", category: "Formularios", props: { ...baseProps, text: "Hora", label: "Hora", value: "", width: 180, height: 48 } },
  radioGroup: { label: "RadioGroup", category: "Formularios", props: { ...baseProps, text: "Opciones", value: "Opcion 1", options: "Opcion 1\nOpcion 2\nOpcion 3", width: 220, height: 110, backgroundColor: "transparent" } },
  slider: { label: "Slider", category: "Formularios", props: { ...baseProps, text: "Valor", min: 0, max: 100, step: 1, value: 50, width: 240, height: 52, backgroundColor: "transparent" } },
  searchInput: { label: "SearchInput", category: "Formularios", props: { ...baseProps, text: "Buscar", placeholder: "Buscar", value: "", width: 260, height: 44 } },
  filePicker: { label: "FilePicker", category: "Formularios", props: { ...baseProps, text: "Elegir archivo", value: "", width: 220, height: 48 } },
  imagePicker: { label: "ImagePicker", category: "Formularios", props: { ...baseProps, text: "Elegir imagen", value: "", width: 220, height: 120, backgroundColor: "#eff6ff" } },
  form: { label: "Formulario", category: "Formularios", props: { ...baseProps, text: "Formulario", color: "#334155", backgroundColor: "#ffffff", width: 320, height: 260, borderRadius: 20 } },
  container: { label: "Contenedor", category: "Layout", props: { ...baseProps, text: "Contenedor", color: "#334155", backgroundColor: "#f8fafc", width: 300, height: 180, borderRadius: 22 } },
  gradientBox: { label: "GradientBox", category: "Diseño", props: { ...baseProps, text: "Gradiente", color: "#ffffff", backgroundColor: "#2563eb", gradientTo: "#14b8a6", width: 260, height: 140, borderRadius: 20 } },
  list: { label: "Lista", category: "Datos", props: { ...baseProps, text: "Elemento 1\nElemento 2\nElemento 3", showIcon: false, backgroundColor: "#ffffff", width: 280, height: 180, borderRadius: 18 } },
  dataTable: { label: "DataTable", category: "Datos", props: { ...baseProps, text: "Tabla", columns: "nombre\ndosha", dataTable: "pacientes", width: 320, height: 210, borderRadius: 16 } },
  dynamicList: { label: "DynamicList", category: "Datos", props: { ...baseProps, text: "Lista dinamica", showIcon: false, dataTable: "pacientes", dataTitleField: "nombre", dataSubtitleField: "dosha", width: 300, height: 220, borderRadius: 18 } },
  detailView: { label: "DetailView", category: "Datos", props: { ...baseProps, text: "Detalle", dataTable: "pacientes", width: 280, height: 180, borderRadius: 18 } },
  emptyState: { label: "EmptyState", category: "Datos", props: { ...baseProps, text: "Sin datos", width: 260, height: 140, borderRadius: 18 } },
  pagination: { label: "Pagination", category: "Datos", props: { ...baseProps, text: "1 / 5", value: 1, max: 5, width: 180, height: 44, borderRadius: 999 } },
  image: { label: "Imagen", category: "Básicos", props: { ...baseProps, text: "Imagen", color: "#64748b", backgroundColor: "#dbeafe", width: 220, height: 140, borderRadius: 18 } },
  avatar: { label: "Avatar", category: "Multimedia", props: { ...baseProps, text: "A", color: "#ffffff", backgroundColor: "#7c3aed", width: 72, height: 72, fontSize: 24, borderRadius: 999 } },
  video: { label: "Video", category: "Multimedia", props: { ...baseProps, text: "Video", color: "#ffffff", backgroundColor: "#111827", width: 280, height: 160, borderRadius: 22 } },
  audioPlayer: { label: "AudioPlayer", category: "Multimedia", props: { ...baseProps, text: "Audio", source: "", width: 280, height: 72, borderRadius: 18 } },
  videoPlayer: { label: "VideoPlayer", category: "Multimedia", props: { ...baseProps, text: "Video", source: "", color: "#ffffff", backgroundColor: "#111827", width: 280, height: 160, borderRadius: 22 } },
  pdfViewer: { label: "PDFViewer", category: "Multimedia", props: { ...baseProps, text: "PDF", source: "", width: 280, height: 180, borderRadius: 18 } },
  webView: { label: "WebView", category: "Multimedia", props: { ...baseProps, text: "Web", url: "https://", width: 300, height: 190, borderRadius: 18 } },
  qrCode: { label: "QRCode", category: "Multimedia", props: { ...baseProps, text: "QR", value: "https://ganflow.app", size: 120, width: 140, height: 140, borderRadius: 16 } },
  qrScanner: { label: "QRScanner", category: "Multimedia", props: { ...baseProps, text: "Escanear QR", width: 220, height: 140, borderRadius: 18 } },
  appbar: { label: "AppBar", category: "Navegación", props: { ...baseProps, text: "Mi aplicacion", color: "#ffffff", backgroundColor: "#2563eb", width: 326, height: 64, borderRadius: 18 } },
  drawer: { label: "Menu lateral", category: "Navegación", props: { ...baseProps, text: "Menu", items: "Inicio\nPerfil\nAjustes", backgroundColor: "#ffffff", width: 220, height: 420, borderRadius: 22 } },
  bottomNavigation: { label: "BottomNavigation", category: "Navegación", props: { ...baseProps, text: "Inicio\nBuscar\nPerfil", items: "Inicio\nBuscar\nPerfil", selectedIndex: 0, width: 326, height: 64, borderRadius: 20 } },
  tabs: { label: "Tabs", category: "Navegación", props: { ...baseProps, text: "Todos\nActivos\nArchivo", tabs: "Todos\nActivos\nArchivo", activeTab: 0, width: 300, height: 52, borderRadius: 999 } },
  floatingActionButton: { label: "FAB", category: "Navegación", props: { ...baseProps, text: "+", iconName: "Plus", color: "#ffffff", backgroundColor: "#2563eb", width: 56, height: 56, borderRadius: 999 } },
  breadcrumb: { label: "Breadcrumb", category: "Navegación", props: { ...baseProps, text: "Inicio / Detalle", width: 260, height: 40, backgroundColor: "transparent" } },
  progressBar: { label: "ProgressBar", category: "Diseño", props: { ...baseProps, text: "", value: 45, max: 100, color: "#2563eb", backgroundColor: "#e2e8f0", width: 240, height: 14, borderRadius: 999 } },
  circularProgress: { label: "CircularProgress", category: "Diseño", props: { ...baseProps, text: "65", value: 65, max: 100, color: "#2563eb", backgroundColor: "#e2e8f0", width: 86, height: 86, borderRadius: 999 } },
  accordion: { label: "Accordion", category: "Layout", props: { ...baseProps, text: "Titulo\nContenido desplegable", value: true, width: 280, height: 120, borderRadius: 16 } },
  stepper: { label: "Stepper", category: "Layout", props: { ...baseProps, text: "Paso 1\nPaso 2\nPaso 3", value: 1, width: 280, height: 80, backgroundColor: "transparent" } },
  modal: { label: "Modal", category: "Diseño", props: { ...baseProps, text: "Contenido del modal", title: "Modal", width: 280, height: 170, borderRadius: 20 } },
  alertDialog: { label: "AlertDialog", category: "Diseño", props: { ...baseProps, text: "Mensaje importante", title: "Alerta", width: 280, height: 150, borderRadius: 20 } },
};

export const componentIcons = {
  text: "🔤",
  button: "🔘",
  image: "🖼️",
  icon: "⭐",
  divider: "➖",
  spacer: "↕️",
  badge: "🏷️",
  chip: "💊",
  input: "✏️",
  textarea: "📝",
  select: "🔽",
  checkbox: "☑️",
  switch: "🔛",
  radioGroup: "⚪",
  datePicker: "📅",
  timePicker: "🕒",
  slider: "🎚️",
  searchInput: "🔍",
  filePicker: "📎",
  imagePicker: "🌄",
  container: "▢",
  card: "🃏",
  row: "↔️",
  column: "↕️",
  grid: "🔲",
  stack: "🧱",
  accordion: "📂",
  stepper: "①②③",
  drawer: "☰",
  bottomNavigation: "📱",
  tabs: "🗂️",
  floatingActionButton: "➕",
  breadcrumb: "🧭",
  list: "📋",
  dynamicList: "🔁",
  dataTable: "📊",
  detailView: "🔎",
  emptyState: "🫙",
  pagination: "📄",
  videoPlayer: "🎬",
  video: "🎬",
  audioPlayer: "🎧",
  pdfViewer: "📕",
  webView: "🌐",
  qrCode: "▦",
  qrScanner: "📷",
  gradientBox: "🌈",
  progressBar: "▰",
  circularProgress: "⏳",
  modal: "🪟",
  alertDialog: "⚠️",
};

export const paletteItems = Object.entries(componentDefaults).map(([type, config]) => ({
  type,
  label: config.label,
  category: config.category,
  icon: componentIcons[type] || "▢",
  description: config.description || "",
})).filter((item) => item.type !== "appbar");

const createId = () => {
  if (window.crypto && typeof window.crypto.randomUUID === "function") return window.crypto.randomUUID();
  return `item-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const createComponentId = () => {
  if (window.crypto && typeof window.crypto.randomUUID === "function") return `cmp_${window.crypto.randomUUID().slice(0, 8)}`;
  return `cmp_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
};

const componentNameBases = {
  button: "btnNuevo",
  input: "inputTexto",
  text: "txtTexto",
  image: "imgImagen",
  list: "listaDatos",
  dynamicList: "listaDatos",
  select: "selectOpcion",
  switch: "switchActivo",
  checkbox: "checkOpcion",
  textarea: "txtArea",
  searchInput: "inputBusqueda",
  icon: "iconoNuevo",
  card: "cardNueva",
};

const componentTypePrefixes = {
  button: "btn",
  input: "input",
  text: "txt",
  image: "img",
  list: "lista",
  dynamicList: "lista",
  select: "select",
  switch: "switch",
  checkbox: "check",
};

export const componentNamePattern = /^[A-Za-z_][A-Za-z0-9_]*$/;

export function sanitizeComponentName(value, type = "component") {
  let words = String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9_]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const prefix = componentTypePrefixes[type] || "cmp";
  const first = words[0]?.toLowerCase();
  const typeWords = {
    button: ["boton", "button", "btn"],
    input: ["input", "campo"],
    text: ["texto", "text", "txt"],
    image: ["imagen", "image", "img"],
    list: ["lista", "list"],
    select: ["select"],
    switch: ["switch"],
    checkbox: ["checkbox", "check"],
  }[type] || [];
  if (typeWords.includes(first) && words.length > 1) words = words.slice(1);
  if (words.length === 0) return componentNameBases[type] || `${prefix}Nuevo`;
  const camel = words.map((word, index) => {
    const lower = word.charAt(0).toLowerCase() + word.slice(1);
    return index === 0 ? lower : lower.charAt(0).toUpperCase() + lower.slice(1);
  }).join("");
  const needsPrefix = componentTypePrefixes[type] && !camel.toLowerCase().startsWith(prefix.toLowerCase());
  const withPrefix = needsPrefix
    ? `${prefix}${camel.charAt(0).toUpperCase()}${camel.slice(1)}`
    : /^[A-Za-z_]/.test(camel) ? camel : `${prefix}${camel.charAt(0).toUpperCase()}${camel.slice(1)}`;
  return withPrefix.replace(/[^A-Za-z0-9_]/g, "") || componentNameBases[type] || `${prefix}Nuevo`;
}

function makeUniqueComponentName(baseName, components = [], currentId = null) {
  const usedNames = new Set(components.filter((component) => component.id !== currentId).map((component) => component.name).filter(Boolean));
  const cleanBase = sanitizeComponentName(baseName);
  if (!usedNames.has(cleanBase)) return cleanBase;
  let index = 2;
  let nextName = `${cleanBase}${index}`;
  while (usedNames.has(nextName)) {
    index += 1;
    nextName = `${cleanBase}${index}`;
  }
  return nextName;
}

export function validateComponentName(value, components = [], currentId = null) {
  const name = String(value || "").trim();
  const suggestion = makeUniqueComponentName(sanitizeComponentName(name, components.find((component) => component.id === currentId)?.type), components, currentId);
  if (!name) return { valid: false, message: "El nombre interno no puede estar vacío.", suggestion };
  if (!componentNamePattern.test(name)) return { valid: false, message: "Usa solo letras, números y guion bajo; debe empezar con letra o guion bajo.", suggestion };
  if (components.some((component) => component.id !== currentId && component.name === name)) return { valid: false, message: "Ya existe un componente con ese nombre en esta pantalla.", suggestion: makeUniqueComponentName(name, components, currentId) };
  return { valid: true, message: "", suggestion: name };
}

function replaceComponentReference(value, oldName, newName) {
  if (typeof value === "string") {
    const mustache = new RegExp(`{{\\s*${escapeRegExp(oldName)}(?=\\.|\\s*}})`, "g");
    return value.replace(mustache, `{{${newName}`);
  }
  if (Array.isArray(value)) return value.map((item) => replaceComponentReference(item, oldName, newName));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, replaceComponentReference(item, oldName, newName)]));
  }
  return value;
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function slugify(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

const createDefaultProject = () => ({
  projectName: "GanFlow",
  viewport: "mobile",
  activeScreenId: DEFAULT_SCREEN_ID,
  startScreenId: DEFAULT_SCREEN_ID,
  variables: {
    global: [],
    local: [],
  },
  dataSources: createDefaultDataSources(),
  crudModules: [],
  theme: createTheme(),
  resources: [],
  androidConfig: { ...defaultAndroidConfig },
  activeFlowId: "flow-main",
  flows: [createDefaultFlow()],
  canvasSettings: {
    gridVisible: true,
    snapToGrid: true,
    gridSize: 8,
    flowSnapToGrid: false,
    flowGridSize: 12,
    flowDragSensitivity: "smooth",
    designZoom: 1,
    designPan: { x: 0, y: 0 },
  },
  screens: [{ id: DEFAULT_SCREEN_ID, name: "Inicio", settings: normalizeScreenSettings({ appBar: { enabled: true, title: "Inicio" } }, "Inicio"), variables: [], components: [] }],
});

const normalizeComponent = (component, index = 0) => ({
  ...component,
  id: component.id || createComponentId(),
  type: component.type || "text",
  name: sanitizeComponentName(component.name || componentNameBases[component.type] || componentDefaults[component.type]?.label || "cmpNuevo", component.type),
  events: {
    ...defaultEvents,
    ...(component.events || {}),
  },
  props: {
    ...baseProps,
    ...(componentDefaults[component.type]?.props || {}),
    ...(component.props || {}),
    zIndex: component.props?.zIndex ?? index + 1,
    locked: Boolean(component.props?.locked),
    hidden: Boolean(component.props?.hidden),
  },
});

function withUniqueComponentNames(components = []) {
  const used = new Set();
  return components.map((component) => {
    const baseName = sanitizeComponentName(component.name || componentNameBases[component.type] || "cmpNuevo", component.type);
    let name = baseName;
    let counter = 2;
    while (used.has(name)) {
      name = `${baseName}${counter}`;
      counter += 1;
    }
    used.add(name);
    return { ...component, name };
  });
}

const appBarFromComponent = (component, screenName = "Pantalla") => {
  const props = component?.props || {};
  return {
    ...defaultScreenSettings.appBar,
    enabled: true,
    title: props.text || screenName,
    height: Number(props.height) || defaultScreenSettings.appBar.height,
    backgroundColor: props.backgroundColor || defaultScreenSettings.appBar.backgroundColor,
    textColor: props.color || defaultScreenSettings.appBar.textColor,
    shadow: true,
  };
};

const normalizeScreenSettings = (settings = {}, screenName = "Pantalla", appBarComponent = null) => {
  const viewport = normalizeViewportSettings(settings.viewport);
  return {
    ...defaultScreenSettings,
    ...settings,
    viewport,
    width: Number(settings.width) || viewport.mobile.width,
    height: Number(settings.height) || viewport.mobile.height,
    background: settings.background || defaultScreenSettings.background,
    scroll: settings.scroll ?? defaultScreenSettings.scroll,
    orientation: settings.orientation || defaultScreenSettings.orientation,
    appBar: {
      ...defaultScreenSettings.appBar,
      ...(settings.appBar || {}),
      ...(appBarComponent ? appBarFromComponent(appBarComponent, screenName) : {}),
      title: appBarComponent?.props?.text || settings.appBar?.title || screenName,
      height: Number(appBarComponent?.props?.height || settings.appBar?.height) || defaultScreenSettings.appBar.height,
      actions: normalizeMenuItems(settings.appBar?.actions, "action"),
      moreMenu: normalizeMenuItems(settings.appBar?.moreMenu, "more"),
    },
    drawer: {
      ...defaultScreenSettings.drawer,
      ...(settings.drawer || {}),
      items: normalizeMenuItems(settings.drawer?.items, "drawer"),
    },
    bottomBar: {
      ...defaultScreenSettings.bottomBar,
      ...(settings.bottomBar || {}),
    },
  };
};

function normalizeViewportSettings(viewport = {}) {
  return {
    ...defaultScreenSettings.viewport,
    ...(viewport || {}),
    mobile: { ...defaultScreenSettings.viewport.mobile, ...(viewport?.mobile || {}) },
    tablet: { ...defaultScreenSettings.viewport.tablet, ...(viewport?.tablet || {}) },
    desktop: { ...defaultScreenSettings.viewport.desktop, ...(viewport?.desktop || {}) },
  };
}

function normalizeMenuItems(items, prefix = "item") {
  if (!Array.isArray(items)) return [];
  return items.map((item, index) => {
    if (typeof item === "string") {
      return { id: `${prefix}_${index}`, label: item, icon: item, action: { type: "showMessage", message: item } };
    }
    const action = item.action || {};
    return {
      id: item.id || `${prefix}_${index}`,
      label: item.label || item.text || item.id || `Opcion ${index + 1}`,
      icon: item.icon || "circle",
      type: item.type || "icon",
      action: {
        ...action,
        type: action.type || item.actionType || "showMessage",
        screen: action.screen || action.screenId || item.screen || item.screenId || "",
        screenId: action.screenId || action.screen || item.screenId || item.screen || "",
        message: action.message || item.message || item.label || "",
        modalId: action.modalId || item.modalId || "",
      },
    };
  });
}

const normalizeScreen = (screen) => {
  const rawComponents = Array.isArray(screen.components) ? screen.components : [];
  const appBarComponent = rawComponents.find((component) => component.type === "appbar");
  const settings = normalizeScreenSettings(screen.settings, screen.name || "Pantalla", appBarComponent);
  const topInset = getScreenTopInset({ settings });
  const normalizedComponents = rawComponents
    .filter((component) => component.type !== "appbar")
    .map((component, index) => {
      const normalized = normalizeComponent(component, index);
      return { ...normalized, props: { ...normalized.props, y: Math.max(topInset, Number(normalized.props.y) || 0) } };
    });
  const layouts = normalizeScreenLayouts(screen.layouts, withUniqueComponentNames(normalizedComponents), settings, topInset);
  const activeLayout = settings.viewport?.mode || "mobile";
  return {
    id: screen.id || createId(),
    name: screen.name || "Pantalla",
    settings,
    variables: Array.isArray(screen.variables) ? screen.variables.map((item) => normalizeVariable(item, "screen")) : [],
    layouts,
    components: layouts[activeLayout]?.components || layouts.mobile.components,
  };
};

function normalizeScreenLayouts(layouts = null, fallbackComponents = [], settings, topInset = 0) {
  const mobileSize = settings.viewport?.mobile || defaultScreenSettings.viewport.mobile;
  const source = layouts?.mobile?.components || fallbackComponents;
  return Object.fromEntries(breakpointOrder.map((mode) => {
    const size = settings.viewport?.[mode] || defaultScreenSettings.viewport[mode];
    const existing = layouts?.[mode];
    const components = Array.isArray(existing?.components)
      ? existing.components
      : mode === "mobile"
        ? source
        : scaleComponentsForLayout(source, mobileSize, size);
    return [
      mode,
      {
        width: Number(existing?.width || size.width),
        height: Number(existing?.height || size.height),
        components: withUniqueComponentNames(components.map((component, index) => {
          const normalized = normalizeComponent(component, index);
          return { ...normalized, props: { ...normalized.props, y: Math.max(topInset, Number(normalized.props.y) || 0) } };
        })),
      },
    ];
  }));
}

function scaleComponentsForLayout(components, fromSize, toSize) {
  const sx = (Number(toSize?.width) || 1) / (Number(fromSize?.width) || 1);
  const sy = (Number(toSize?.height) || 1) / (Number(fromSize?.height) || 1);
  return components.map((component) => ({
    ...cloneJson(component),
    props: {
      ...(component.props || {}),
      x: Math.round((Number(component.props?.x) || 0) * sx),
      y: Math.round((Number(component.props?.y) || 0) * sy),
      width: Math.max(20, Math.round((Number(component.props?.width) || 120) * sx)),
      height: Math.max(2, Math.round((Number(component.props?.height) || 44) * sy)),
    },
  }));
}

const normalizeVariable = (variable, scope = "global") => ({
  id: variable?.id || createId(),
  scope: variable?.scope || scope,
  name: variable?.name || "variable",
  type: variableTypes.includes(variable?.type) ? variable.type : "string",
  initialValue: variable?.initialValue ?? "",
});

const normalizeField = (field) => ({
  id: field?.id || createId(),
  name: field?.name || "campo",
  type: fieldTypes.includes(field?.type) ? field.type : "string",
  system: Boolean(field?.system),
  relation: field?.relation || { tableId: "", fieldName: "id" },
});

const normalizeTable = (table) => {
  const fields = Array.isArray(table?.fields) ? table.fields.map(normalizeField) : [];
  const fieldNames = new Set(fields.map((field) => field.name));
  const mergedFields = [
    ...systemFields.filter((field) => !fieldNames.has(field.name)),
    ...fields,
  ];

  return {
    id: table?.id || slugify(table?.name || "tabla") || createId(),
    name: table?.name || "Tabla",
    fields: mergedFields,
    relations: Array.isArray(table?.relations) ? table.relations : [],
    records: Array.isArray(table?.records) ? table.records : [],
  };
};

const normalizeDataSource = (source) => ({
  id: source?.id || createId(),
  type: ["local", "firebase"].includes(source?.type) ? source.type : "local",
  name: source?.name || "Fuente de datos",
  tables: Array.isArray(source?.tables) ? source.tables.map(normalizeTable) : [],
});

const normalizeCrudModule = (module) => ({
  id: module?.id || createId(),
  sourceId: module?.sourceId || "",
  tableId: module?.tableId || "",
  moduleName: module?.moduleName || "Modulo",
  screenIds: module?.screenIds || {},
  options: module?.options || {},
});

const normalizeResource = (resource) => ({
  id: resource?.id || createId(),
  name: resource?.name || "recurso",
  type: resource?.type || "application/octet-stream",
  size: Number(resource?.size) || 0,
  dataUrl: resource?.dataUrl || "",
});

const normalizeAndroidConfig = (config, projectName = "GanFlow") => ({
  ...defaultAndroidConfig,
  ...(config || {}),
  appName: config?.appName || projectName || defaultAndroidConfig.appName,
  buildNumber: Number(config?.buildNumber) || defaultAndroidConfig.buildNumber,
  permissions: {
    ...defaultAndroidConfig.permissions,
    ...(config?.permissions || {}),
  },
});

const normalizeFlow = (flow) => ({
  id: flow?.id || createId(),
  name: flow?.name || "Flujo",
  trigger: flow?.trigger || inferFlowTrigger(flow),
  zoom: Number(flow?.zoom) || 1,
  pan: flow?.pan || { x: 0, y: 0 },
  selectedNodeIds: Array.isArray(flow?.selectedNodeIds) ? flow.selectedNodeIds : [],
  errors: Array.isArray(flow?.errors) ? flow.errors : [],
  nodes: Array.isArray(flow?.nodes) ? flow.nodes.map((node) => ({
    id: node.id || createId(),
    type: node.type || "showMessage",
    category: node.category || "Mensajes",
    label: node.label || node.type || "Nodo",
    x: Number(node.x) || 120,
    y: Number(node.y) || 120,
    params: node.params || {},
  })) : [],
  connections: normalizeFlowConnections(flow),
  edges: normalizeFlowConnections(flow),
});

function normalizeFlowConnections(flow) {
  const raw = Array.isArray(flow?.edges) ? flow.edges : Array.isArray(flow?.connections) ? flow.connections : [];
  return raw.map((connection) => {
    const from = withPortRef(connection.from || connection.source, connection.fromHandle || connection.sourceHandle || connection.output || "next");
    const to = withPortRef(connection.to || connection.target, connection.toHandle || connection.targetHandle || connection.input || "in");
    const [source, sourceHandle = "next"] = from.split(".");
    const [target, targetHandle = "in"] = to.split(".");
    return {
      id: connection.id || createId(),
      type: connection.type || inferConnectionType(connection),
      from,
      to,
      source,
      sourceHandle,
      target,
      targetHandle,
    };
  });
}

function withPortRef(value, fallbackPort) {
  if (!value) return "";
  const ref = String(value);
  return ref.includes(".") ? ref : `${ref}.${fallbackPort}`;
}

function nodeIdFromRef(value) {
  return String(value || "").split(".")[0];
}

function inferConnectionType(connection) {
  const fromHandle = connection?.fromHandle || connection?.sourceHandle;
  const toHandle = connection?.toHandle || connection?.targetHandle;
  if (fromHandle === "value" || toHandle === "value" || String(fromHandle || "").startsWith("data") || String(toHandle || "").startsWith("data")) return "data";
  return "execution";
}

function inferFlowTrigger(flow) {
  const eventNode = (flow?.nodes || []).find((node) => ["event", "onClick", "onLoad", "onChange", "onSubmit"].includes(node.type));
  if (!eventNode) return { type: "componentEvent", screenId: "", componentId: "", event: "onClick" };
  return {
    type: eventNode.params?.componentId ? "componentEvent" : "screenEvent",
    screenId: eventNode.params?.screenId || "",
    componentId: eventNode.params?.componentId || "",
    event: eventNode.params?.event || (eventNode.type === "event" ? "onClick" : eventNode.type),
  };
}

const applyThemeToComponent = (component, theme) => {
  const props = component.props || {};
  const themed = getThemeStyleForType(theme, component.type);
  return {
    ...component,
    props: {
      ...props,
      ...themed,
      x: props.x,
      y: props.y,
      width: props.width,
      height: props.height,
      zIndex: props.zIndex,
      locked: props.locked,
      hidden: props.hidden,
      useThemeStyle: true,
    },
  };
};

const createComponent = (type, position = {}, zIndex = 1, theme = null) => {
  const defaults = componentDefaults[type] || componentDefaults.text;
  const component = {
    id: createComponentId(),
    type,
    name: sanitizeComponentName(componentNameBases[type] || defaults.label || "cmpNuevo", type),
    events: { ...defaultEvents },
    props: {
      ...defaults.props,
      ...position,
      zIndex,
    },
  };
  return applyThemeToComponent(component, theme);
};

const makeTemplateComponent = (type, props, zIndex) => normalizeComponent({
  id: createComponentId(),
  type,
  name: componentNameBases[type] || componentDefaults[type]?.label,
  props: {
    ...(componentDefaults[type]?.props || {}),
    ...props,
    zIndex,
  },
});

const templates = {
  Login: [
    ["text", { text: "Bienvenido", x: 48, y: 88, width: 260, height: 44, fontSize: 28, backgroundColor: "transparent" }],
    ["input", { text: "Email", x: 48, y: 176, width: 294, height: 50 }],
    ["input", { text: "Password", x: 48, y: 242, width: 294, height: 50 }],
    ["button", { text: "Ingresar", x: 48, y: 324, width: 294, height: 52 }],
  ],
  Registro: [
    ["text", { text: "Crear cuenta", x: 48, y: 72, width: 260, height: 44, fontSize: 28, backgroundColor: "transparent" }],
    ["input", { text: "Nombre", x: 48, y: 150, width: 294, height: 50 }],
    ["input", { text: "Email", x: 48, y: 216, width: 294, height: 50 }],
    ["button", { text: "Registrarme", x: 48, y: 296, width: 294, height: 52 }],
  ],
  Home: [
    ["appbar", { text: "Home", x: 24, y: 24, width: 342, height: 64 }],
    ["card", { text: "Resumen", x: 32, y: 120, width: 326, height: 140 }],
    ["button", { text: "Continuar", x: 32, y: 292, width: 180, height: 50 }],
  ],
  Lista: [
    ["appbar", { text: "Lista", x: 24, y: 24, width: 342, height: 64 }],
    ["list", { text: "Elemento 1\nElemento 2\nElemento 3\nElemento 4", x: 32, y: 112, width: 326, height: 320 }],
  ],
  Detalle: [
    ["image", { text: "Imagen principal", x: 32, y: 48, width: 326, height: 190 }],
    ["text", { text: "Titulo del detalle", x: 32, y: 270, width: 300, height: 44, fontSize: 24, backgroundColor: "transparent" }],
    ["card", { text: "Contenido del detalle", x: 32, y: 336, width: 326, height: 170 }],
  ],
  Formulario: [
    ["text", { text: "Formulario", x: 48, y: 64, width: 260, height: 44, fontSize: 28, backgroundColor: "transparent" }],
    ["input", { text: "Nombre", x: 48, y: 140, width: 294, height: 50 }],
    ["select", { text: "Categoria", x: 48, y: 206, width: 294, height: 50 }],
    ["checkbox", { text: "Acepto terminos", x: 48, y: 276, width: 230, height: 44 }],
    ["button", { text: "Enviar", x: 48, y: 348, width: 294, height: 52 }],
  ],
  Perfil: [
    ["avatar", { text: "GA", x: 151, y: 64, width: 88, height: 88 }],
    ["text", { text: "Nombre de usuario", x: 64, y: 178, width: 260, height: 36, fontSize: 22, backgroundColor: "transparent" }],
    ["card", { text: "Informacion del perfil", x: 32, y: 248, width: 326, height: 170 }],
  ],
};

export const templateNames = Object.keys(templates);

const createScreen = (name = "Pantalla", components = []) => {
  const appBarEntry = components.find(([type]) => type === "appbar");
  const appBarComponent = appBarEntry ? { type: "appbar", props: appBarEntry[1] || {} } : null;
  return {
    id: createId(),
    name,
    settings: normalizeScreenSettings({ appBar: { enabled: Boolean(appBarEntry), title: name } }, name, appBarComponent),
    variables: [],
    components: components.filter(([type]) => type !== "appbar").map(([type, props], index) => makeTemplateComponent(type, props, index + 1)),
  };
};

const createGeneratedComponent = (type, props, zIndex, name = null, events = null) => normalizeComponent({
  id: createId(),
  type,
  name: name || componentDefaults[type]?.label,
  events: events || defaultEvents,
  props: {
    ...(componentDefaults[type]?.props || {}),
    ...props,
    zIndex,
  },
});

const labelFromField = (value) => String(value || "")
  .replace(/([a-z])([A-Z])/g, "$1 $2")
  .replace(/[_-]+/g, " ")
  .replace(/\b\w/g, (char) => char.toUpperCase());

const formControlForField = (field) => {
  if (field.type === "boolean") return "switch";
  if (field.type === "list" || field.type === "relation") return "select";
  if (field.type === "image") return "image";
  return "input";
};

const createFlowFromSteps = (name, steps) => {
  const nodes = steps.map((step, index) => ({
    id: createId(),
    type: step.type,
    category: step.category,
    label: step.label || step.type,
    x: 80 + index * 230,
    y: 120,
    params: step.params || {},
  }));

  return normalizeFlow({
    id: createId(),
    name,
    nodes,
    connections: nodes.slice(1).map((node, index) => ({
      id: createId(),
      from: nodes[index].id,
      to: node.id,
    })),
  });
};

const createCrudScreensAndFlows = (config, existingScreens = [], mode = "copy") => {
  const moduleName = config.moduleName || config.table?.name || "Modulo";
  const baseNames = {
    list: `${moduleName}Lista`,
    detail: `${moduleName}Detalle`,
    create: `${moduleName}Crear`,
    edit: `${moduleName}Editar`,
  };
  const existingNames = new Set(existingScreens.map((screen) => screen.name));
  const shouldCreate = {
    list: true,
    detail: Boolean(config.enableDetail),
    create: true,
    edit: Boolean(config.enableEdit),
  };
  const resolvedNames = {};

  Object.entries(baseNames).forEach(([key, name]) => {
    if (!shouldCreate[key]) return;
    if (mode !== "copy" || !existingNames.has(name)) {
      resolvedNames[key] = name;
      return;
    }

    let counter = 2;
    let copyName = `${name} ${counter}`;
    while (existingNames.has(copyName)) {
      counter += 1;
      copyName = `${name} ${counter}`;
    }
    resolvedNames[key] = copyName;
    existingNames.add(copyName);
  });

  const screenIds = Object.fromEntries(Object.keys(resolvedNames).map((key) => [key, createId()]));
  const table = config.table;
  const tableId = table.id;
  const formFields = (config.formFields || []).filter((field) => !field.system && field.name !== "id");
  const visibleFields = config.visibleFields || [];
  const titleField = config.titleField || visibleFields[0]?.name || "nombre";
  const subtitleField = config.subtitleField || visibleFields[1]?.name || "id";
  const searchField = config.searchField || titleField;
  const valueMap = Object.fromEntries(formFields.map((field) => [field.name, `{{${field.name}.value}}`]));
  const screens = [];
  const flows = [];

  const navigateAction = (target) => target ? {
    onTap: [{ id: createId(), type: "navigateToScreen", params: { screenId: target } }],
    onLoad: [],
    onChange: [],
    onSubmit: [],
  } : { ...defaultEvents };

  screens.push({
    id: screenIds.list,
    name: resolvedNames.list,
    variables: [],
    components: [
      createGeneratedComponent("appbar", { text: moduleName, x: 24, y: 24, width: 342, height: 56, borderRadius: 16 }, 1, "AppBar CRUD"),
      createGeneratedComponent("input", { text: `Buscar por ${labelFromField(searchField)}`, x: 32, y: 96, width: 326, height: 42, dataTable: tableId, dataField: searchField }, 2, "Buscador"),
      createGeneratedComponent("list", {
        text: visibleFields.map((field) => `{{registro.${field.name}}}`).join("\n") || "Sin campos",
        x: 32,
        y: 154,
        width: 326,
        height: 410,
        dataTable: tableId,
        dataTitleField: titleField,
        dataSubtitleField: subtitleField,
        dataImageField: config.imageField || "",
        actionType: config.enableDetail ? "navigate" : "none",
        actionTarget: screenIds.detail || "",
      }, 3, "Lista dinamica"),
      createGeneratedComponent("button", {
        text: "Nuevo",
        x: 244,
        y: 596,
        width: 114,
        height: 48,
        borderRadius: 999,
        actionType: "navigate",
        actionTarget: screenIds.create,
      }, 4, "Nuevo", navigateAction(screenIds.create)),
    ],
  });

  flows.push(createFlowFromSteps(`${moduleName} - cargar lista`, [
    { type: "onLoad", category: "Eventos", label: "Al cargar" },
    { type: "listRecords", category: "Datos", label: "Listar registros", params: { table: tableId, filters: { [searchField]: `{{busqueda}}` }, targetVariable: `${slugify(moduleName)}Records` } },
  ]));

  const makeFormScreen = (kind, name, targetAction) => {
    const controls = formFields.slice(0, 7).map((field, index) => {
      const type = formControlForField(field);
      return createGeneratedComponent(type, {
        text: labelFromField(field.name),
        x: 32,
        y: 104 + index * 58,
        width: 326,
        height: type === "image" ? 92 : 44,
        dataTable: tableId,
        dataField: field.name,
      }, index + 3, labelFromField(field.name));
    });
    const buttonsY = Math.min(596, 122 + controls.length * 58);
    return {
      id: screenIds[kind],
      name,
      variables: [],
      components: [
        createGeneratedComponent("appbar", { text: name, x: 24, y: 24, width: 342, height: 56, borderRadius: 16 }, 1, "AppBar CRUD"),
        createGeneratedComponent("form", { text: table.name, x: 24, y: 88, width: 342, height: Math.min(470, 92 + controls.length * 58), backgroundColor: "#ffffff" }, 2, "Formulario CRUD"),
        ...controls,
        createGeneratedComponent("button", {
          text: "Cancelar",
          x: 32,
          y: buttonsY,
          width: 150,
          height: 44,
          color: "#334155",
          backgroundColor: "#e2e8f0",
          actionType: "navigate",
          actionTarget: screenIds.list,
        }, 20, "Cancelar", navigateAction(screenIds.list)),
        createGeneratedComponent("button", {
          text: "Guardar",
          x: 198,
          y: buttonsY,
          width: 160,
          height: 44,
        }, 21, "Guardar", {
          ...defaultEvents,
          onTap: [
            { id: createId(), type: targetAction, params: { table: tableId, values: valueMap, recordId: "{{registro.id}}" } },
            { id: createId(), type: "showMessage", params: { message: targetAction === "createRecord" ? `${moduleName} creado` : `${moduleName} actualizado` } },
            { id: createId(), type: "navigateToScreen", params: { screenId: screenIds.list } },
          ],
        }),
      ],
    };
  };

  screens.push(makeFormScreen("create", resolvedNames.create, "createRecord"));
  flows.push(createFlowFromSteps(`${moduleName} - crear`, [
    { type: "onClick", category: "Eventos", label: "Guardar nuevo" },
    { type: "createRecord", category: "Datos", label: "Crear registro", params: { table: tableId, values: valueMap } },
    { type: "showMessage", category: "Mensajes", label: "Confirmar", params: { message: `${moduleName} creado` } },
    { type: "navigateTo", category: "Navegacion", label: "Volver a lista", params: { screenId: screenIds.list } },
  ]));

  if (config.enableEdit) {
    screens.push(makeFormScreen("edit", resolvedNames.edit, "updateRecord"));
    flows.push(createFlowFromSteps(`${moduleName} - editar`, [
      { type: "onClick", category: "Eventos", label: "Guardar cambios" },
      { type: "updateRecord", category: "Datos", label: "Actualizar registro", params: { table: tableId, recordId: "{{registro.id}}", values: valueMap } },
      { type: "showMessage", category: "Mensajes", label: "Confirmar", params: { message: `${moduleName} actualizado` } },
      { type: "navigateTo", category: "Navegacion", label: "Volver a lista", params: { screenId: screenIds.list } },
    ]));
  }

  if (config.enableDetail) {
    const detailFields = visibleFields.slice(0, 6).map((field) => `${labelFromField(field.name)}: {{registro.${field.name}}}`).join("\n");
    screens.push({
      id: screenIds.detail,
      name: resolvedNames.detail,
      variables: [],
      components: [
        createGeneratedComponent("appbar", { text: `${moduleName} detalle`, x: 24, y: 24, width: 342, height: 56, borderRadius: 16 }, 1, "AppBar CRUD"),
        config.imageField ? createGeneratedComponent("image", { text: `{{registro.${config.imageField}}}`, x: 32, y: 104, width: 326, height: 150 }, 2, "Imagen detalle") : null,
        createGeneratedComponent("card", {
          text: detailFields || `{{registro.${titleField}}}`,
          x: 32,
          y: config.imageField ? 278 : 112,
          width: 326,
          height: config.imageField ? 210 : 280,
          fontSize: 13,
          backgroundColor: "#ffffff",
        }, 3, "Card informacion"),
        config.enableEdit ? createGeneratedComponent("button", {
          text: "Editar",
          x: 32,
          y: 528,
          width: config.enableDelete ? 150 : 326,
          height: 44,
          actionType: "navigate",
          actionTarget: screenIds.edit,
        }, 4, "Editar", navigateAction(screenIds.edit)) : null,
        config.enableDelete ? createGeneratedComponent("button", {
          text: "Eliminar",
          x: config.enableEdit ? 198 : 32,
          y: 528,
          width: config.enableEdit ? 160 : 326,
          height: 44,
          backgroundColor: "#ef4444",
          actionType: "navigate",
          actionTarget: screenIds.list,
        }, 5, "Eliminar", {
          ...defaultEvents,
          onTap: [
            { id: createId(), type: "deleteRecord", params: { table: tableId, recordId: "{{registro.id}}" } },
            { id: createId(), type: "showMessage", params: { message: `${moduleName} eliminado` } },
            { id: createId(), type: "navigateToScreen", params: { screenId: screenIds.list } },
          ],
        }) : null,
      ].filter(Boolean),
    });

    if (config.enableDelete) {
      flows.push(createFlowFromSteps(`${moduleName} - eliminar`, [
        { type: "onClick", category: "Eventos", label: "Eliminar" },
        { type: "deleteRecord", category: "Datos", label: "Eliminar registro", params: { table: tableId, recordId: "{{registro.id}}" } },
        { type: "showMessage", category: "Mensajes", label: "Confirmar", params: { message: `${moduleName} eliminado` } },
        { type: "navigateTo", category: "Navegacion", label: "Volver a lista", params: { screenId: screenIds.list } },
      ]));
    }
  }

  return {
    module: {
      id: createId(),
      tableId,
      sourceId: config.sourceId,
      moduleName,
      screenIds,
      options: {
        visibleFields: visibleFields.map((field) => field.name),
        formFields: formFields.map((field) => field.name),
        titleField,
        subtitleField,
        imageField: config.imageField || "",
        searchField,
        enableDetail: Boolean(config.enableDetail),
        enableEdit: Boolean(config.enableEdit),
        enableDelete: Boolean(config.enableDelete),
      },
    },
    screens,
    flows,
    conflicts: Object.values(baseNames).filter((name) => shouldCreate[Object.keys(baseNames).find((key) => baseNames[key] === name)] && existingScreens.some((screen) => screen.name === name)),
  };
};

const getActiveScreen = (state) =>
  state.screens.find((screen) => screen.id === state.activeScreenId) || state.screens[0];

const getActiveBreakpoint = (state) => breakpointOrder.includes(state.viewport) ? state.viewport : "mobile";

export const getLayoutComponents = (screen, viewport = "mobile") => {
  const mode = breakpointOrder.includes(viewport) ? viewport : "mobile";
  return screen?.layouts?.[mode]?.components || screen?.components || [];
};

export const getLayoutSize = (screen, viewport = "mobile") => {
  const mode = breakpointOrder.includes(viewport) ? viewport : "mobile";
  const layout = screen?.layouts?.[mode];
  const setting = screen?.settings?.viewport?.[mode] || VIEWPORTS[mode] || VIEWPORTS.mobile;
  return {
    label: VIEWPORTS[mode]?.label || mode,
    width: Number(layout?.width || setting.width),
    height: Number(layout?.height || setting.height),
  };
};

const getScreenTopInset = (screen) => screen?.settings?.appBar?.enabled ? Number(screen.settings.appBar.height) || 0 : 0;

const updateActiveScreen = (state, updater) => ({
  screens: state.screens.map((screen) => (screen.id === state.activeScreenId ? updater(screen) : screen)),
});

const updateActiveLayout = (state, updater) => {
  const mode = getActiveBreakpoint(state);
  return updateActiveScreen(state, (screen) => {
    const current = screen.layouts?.[mode] || { ...getLayoutSize(screen, mode), components: getLayoutComponents(screen, mode) };
    const nextLayout = updater(current, screen, mode);
    return {
      ...screen,
      layouts: {
        ...(screen.layouts || {}),
        [mode]: nextLayout,
      },
      components: mode === (screen.settings?.viewport?.mode || "mobile") ? nextLayout.components : screen.components,
    };
  });
};

const snapValue = (value, state) => {
  if (!state.canvasSettings?.snapToGrid) return Math.round(value);
  const gridSize = Number(state.canvasSettings.gridSize) || 24;
  return Math.round(value / gridSize) * gridSize;
};

const normalizeProject = (project) => {
  if (!project || typeof project !== "object") return createDefaultProject();

  const fallback = createDefaultProject();
  const screens = Array.isArray(project.screens) && project.screens.length > 0
    ? project.screens
    : [{ ...fallback.screens[0], components: Array.isArray(project.components) ? project.components : [] }];

  return {
    projectName: project.projectName || "GanFlow",
    viewport: project.viewport?.id || project.viewport || "mobile",
    activeScreenId: project.activeScreenId || screens[0].id || DEFAULT_SCREEN_ID,
    startScreenId: project.startScreenId || project.initialScreenId || screens[0].id || DEFAULT_SCREEN_ID,
    variables: {
      global: Array.isArray(project.variables?.global) ? project.variables.global.map((item) => normalizeVariable(item, "global")) : [],
      local: Array.isArray(project.variables?.local) ? project.variables.local.map((item) => normalizeVariable(item, "local")) : [],
    },
    dataSources: Array.isArray(project.dataSources) && project.dataSources.length > 0
      ? project.dataSources.map(normalizeDataSource)
      : createDefaultDataSources(),
    crudModules: Array.isArray(project.crudModules) ? project.crudModules.map(normalizeCrudModule) : [],
    theme: normalizeTheme(project.theme),
    resources: Array.isArray(project.resources) ? project.resources.map(normalizeResource) : [],
    androidConfig: normalizeAndroidConfig(project.androidConfig, project.projectName),
    activeFlowId: project.activeFlowId || project.flows?.[0]?.id || "flow-main",
    flows: Array.isArray(project.flows) && project.flows.length > 0
      ? project.flows.map(normalizeFlow)
      : [createDefaultFlow()],
    canvasSettings: {
      ...fallback.canvasSettings,
      ...(project.canvasSettings || {}),
    },
    screens: screens.map(normalizeScreen),
  };
};

const cloneJson = (value) => JSON.parse(JSON.stringify(value));

const uniqueName = (name, existingNames) => {
  if (!existingNames.has(name)) {
    existingNames.add(name);
    return name;
  }
  let counter = 2;
  let nextName = `${name} ${counter}`;
  while (existingNames.has(nextName)) {
    counter += 1;
    nextName = `${name} ${counter}`;
  }
  existingNames.add(nextName);
  return nextName;
};

const uniqueId = (id, existingIds) => {
  if (!existingIds.has(id)) {
    existingIds.add(id);
    return id;
  }
  let counter = 2;
  let nextId = `${id}_${counter}`;
  while (existingIds.has(nextId)) {
    counter += 1;
    nextId = `${id}_${counter}`;
  }
  existingIds.add(nextId);
  return nextId;
};

const mapActionParams = (params = {}, screenIdMap, tableIdMap) => {
  const next = { ...params };
  if (next.screenId && screenIdMap[next.screenId]) next.screenId = screenIdMap[next.screenId];
  if (next.table && tableIdMap[next.table]) next.table = tableIdMap[next.table];
  return next;
};

const mapEvents = (events = defaultEvents, screenIdMap, tableIdMap) => ({
  ...defaultEvents,
  ...Object.fromEntries(Object.entries({ ...defaultEvents, ...events }).map(([eventName, actions]) => [
    eventName,
    (actions || []).map((action) => ({
      ...action,
      id: createId(),
      params: mapActionParams(action.params, screenIdMap, tableIdMap),
    })),
  ])),
});

const materializeTemplate = (template, options, state, mode) => {
  const append = mode === "append";
  const existingScreenNames = new Set(append ? state.screens.map((screen) => screen.name) : []);
  const existingTableIds = new Set(append ? state.dataSources.flatMap((source) => source.tables.map((table) => table.id)) : []);
  const screenIdMap = {};
  const tableIdMap = {};
  const sourceId = createId();
  const baseType = options.databaseType || "local";

  (template.screens || []).forEach((screen) => {
    screenIdMap[screen.id] = createId();
  });

  (template.dataSources || []).forEach((source) => {
    (source.tables || []).forEach((table) => {
      tableIdMap[table.id] = append ? uniqueId(table.id, existingTableIds) : table.id;
    });
  });

  const screens = (template.screens || []).map((screen) => normalizeScreen({
    ...cloneJson(screen),
    id: screenIdMap[screen.id],
    name: uniqueName(screen.name, existingScreenNames),
    components: (screen.components || []).map((component) => {
      const next = cloneJson(component);
      next.id = createId();
      next.events = mapEvents(next.events, screenIdMap, tableIdMap);
      next.props = {
        ...(next.props || {}),
        actionTarget: screenIdMap[next.props?.actionTarget] || next.props?.actionTarget || "",
        dataTable: tableIdMap[next.props?.dataTable] || next.props?.dataTable || "",
        useThemeStyle: next.props?.useThemeStyle !== false,
      };
      return normalizeComponent(next);
    }),
  }));

  if (options.enableLogin) {
    screens.unshift(createScreen("Login", templates.Login));
  }

  const dataSources = (template.dataSources || []).map((source) => ({
    id: sourceId,
    type: baseType,
    name: baseType === "firebase" ? "Firebase" : "Base Local",
    tables: (source.tables || []).map((table) => normalizeTable({
      ...cloneJson(table),
      id: tableIdMap[table.id] || table.id,
      relations: (table.relations || []).map((relation) => ({
        ...relation,
        targetTableId: tableIdMap[relation.targetTableId] || relation.targetTableId,
      })),
      fields: (table.fields || []).map((field) => ({
        ...field,
        relation: field.relation ? {
          ...field.relation,
          tableId: tableIdMap[field.relation.tableId] || field.relation.tableId,
        } : field.relation,
      })),
    })),
  }));

  const flows = (template.flows || []).map((flow) => normalizeFlow({
    ...cloneJson(flow),
    id: createId(),
    nodes: (flow.nodes || []).map((node) => ({
      ...node,
      id: createId(),
      params: mapActionParams(node.params, screenIdMap, tableIdMap),
    })),
    connections: [],
  })).map((flow) => ({
    ...flow,
    connections: flow.nodes.slice(1).map((node, index) => ({ id: createId(), from: flow.nodes[index].id, to: node.id })),
  }));

  const variables = {
    global: (template.variables?.global || []).map((variable) => normalizeVariable({ ...variable, id: createId() }, "global")),
    local: (template.variables?.local || []).map((variable) => normalizeVariable({ ...variable, id: createId() }, "local")),
  };

  const selectedInitial = options.initialScreenId && screenIdMap[options.initialScreenId]
    ? screenIdMap[options.initialScreenId]
    : screens[0]?.id || DEFAULT_SCREEN_ID;

  return {
    projectName: options.appName || template.name || "GanFlow",
    viewport: state.viewport || "mobile",
    activeScreenId: selectedInitial,
    startScreenId: selectedInitial,
    variables,
    dataSources,
    crudModules: [],
    theme: normalizeTheme(options.theme || template.theme),
    resources: [],
    activeFlowId: flows[0]?.id || "flow-main",
    flows: flows.length > 0 ? flows : [createDefaultFlow()],
    canvasSettings: state.canvasSettings || createDefaultProject().canvasSettings,
    screens,
  };
};

export const useBuilderStore = create(
  persist(
    (set, get) => ({
      ...createDefaultProject(),
      selectedId: null,
      movingId: null,
      showJson: false,
      showFlutterCode: false,

      setProjectName: (projectName) => set({ projectName }),
      setViewport: (viewport) => set({ viewport, selectedId: null }),
      setSelectedId: (selectedId) => set({ selectedId }),
      setMovingId: (movingId) => set({ movingId }),
      setShowJson: (showJson) => set({ showJson }),
      setShowFlutterCode: (showFlutterCode) => set({ showFlutterCode }),
      setCanvasSetting: (key, value) => set((state) => ({ canvasSettings: { ...state.canvasSettings, [key]: value } })),
      copyLayout: (from, to) => set((state) => updateActiveScreen(state, (screen) => {
        const source = screen.layouts?.[from];
        const targetSize = getLayoutSize(screen, to);
        if (!source || !breakpointOrder.includes(to)) return screen;
        return {
          ...screen,
          layouts: {
            ...(screen.layouts || {}),
            [to]: {
              ...targetSize,
              components: (source.components || []).map((component) => normalizeComponent(cloneJson(component))),
            },
          },
        };
      })),
      setThemePreset: (presetName) => set(() => ({ theme: createTheme(themePresets[presetName] || themePresets["Moderno claro"]) })),
      updateTheme: (patch) => set((state) => ({ theme: normalizeTheme({ ...state.theme, ...patch }) })),
      updateThemeSection: (section, patch) => set((state) => {
        const merged = normalizeTheme({
          ...state.theme,
          [section]: { ...(state.theme?.[section] || {}), ...patch },
        });
        const shouldRefreshComponentStyles = ["colors", "typography", "shape"].includes(section);
        return {
          theme: {
            ...merged,
            componentStyles: shouldRefreshComponentStyles ? buildComponentStyles(merged) : merged.componentStyles,
          },
        };
      }),
      updateComponentThemeStyle: (styleKey, patch) => set((state) => ({
        theme: normalizeTheme({
          ...state.theme,
          componentStyles: {
            ...(state.theme?.componentStyles || {}),
            [styleKey]: { ...(state.theme?.componentStyles?.[styleKey] || {}), ...patch },
          },
        }),
      })),
      applyThemeToScreen: () => set((state) => updateActiveScreen(state, (screen) => ({
        ...screen,
        components: screen.components.map((component) => applyThemeToComponent(component, state.theme)),
      }))),
      applyThemeToProject: () => set((state) => ({
        screens: state.screens.map((screen) => ({
          ...screen,
          components: screen.components.map((component) => applyThemeToComponent(component, state.theme)),
        })),
      })),
      updateActiveScreenSettings: (patch) => set((state) => updateActiveScreen(state, (screen) => ({
        ...screen,
        ...(() => {
          const nextSettings = normalizeScreenSettings({
            ...(screen.settings || {}),
            ...patch,
            viewport: patch.viewport ? {
              ...(screen.settings?.viewport || {}),
              ...patch.viewport,
              mobile: patch.viewport.mobile ? { ...(screen.settings?.viewport?.mobile || {}), ...patch.viewport.mobile } : screen.settings?.viewport?.mobile,
              tablet: patch.viewport.tablet ? { ...(screen.settings?.viewport?.tablet || {}), ...patch.viewport.tablet } : screen.settings?.viewport?.tablet,
              desktop: patch.viewport.desktop ? { ...(screen.settings?.viewport?.desktop || {}), ...patch.viewport.desktop } : screen.settings?.viewport?.desktop,
            } : screen.settings?.viewport,
            appBar: patch.appBar ? { ...(screen.settings?.appBar || {}), ...patch.appBar } : screen.settings?.appBar,
            drawer: patch.drawer ? { ...(screen.settings?.drawer || {}), ...patch.drawer } : screen.settings?.drawer,
            bottomBar: patch.bottomBar ? { ...(screen.settings?.bottomBar || {}), ...patch.bottomBar } : screen.settings?.bottomBar,
          }, screen.name);
          const nextLayouts = { ...(screen.layouts || {}) };
          if (patch.viewport) {
            breakpointOrder.forEach((mode) => {
              nextLayouts[mode] = {
                ...(nextLayouts[mode] || { components: [] }),
                width: nextSettings.viewport[mode].width,
                height: nextSettings.viewport[mode].height,
              };
            });
          }
          return { settings: nextSettings, layouts: nextLayouts };
        })(),
      }))),

      applyAppTemplate: (template, options = {}, mode = "new") => set((state) => {
        const materialized = materializeTemplate(template, options, state, mode);
        if (mode === "append") {
          return {
            projectName: options.appName || state.projectName,
            screens: [...state.screens, ...materialized.screens],
            dataSources: [...state.dataSources, ...materialized.dataSources],
            variables: {
              global: [...(state.variables?.global || []), ...materialized.variables.global],
              local: [...(state.variables?.local || []), ...materialized.variables.local],
            },
            flows: [...state.flows, ...materialized.flows],
            theme: materialized.theme,
            activeScreenId: materialized.activeScreenId,
            startScreenId: state.startScreenId || materialized.startScreenId,
            activeFlowId: materialized.activeFlowId,
            selectedId: null,
          };
        }

        return {
          ...materialized,
          selectedId: null,
          movingId: null,
          showJson: false,
          showFlutterCode: false,
        };
      }),

      addResource: (resource) => set((state) => ({
        resources: [...(state.resources || []), normalizeResource(resource)],
      })),
      deleteResource: (resourceId) => set((state) => ({
        resources: (state.resources || []).filter((resource) => resource.id !== resourceId),
      })),
      updateAndroidConfig: (patch) => set((state) => ({
        androidConfig: normalizeAndroidConfig({
          ...(state.androidConfig || {}),
          ...patch,
          permissions: patch.permissions
            ? { ...(state.androidConfig?.permissions || {}), ...patch.permissions }
            : state.androidConfig?.permissions,
        }, state.projectName),
      })),

      setActiveFlow: (flowId) => set({ activeFlowId: flowId }),

      addFlow: () => {
        const flow = normalizeFlow({ id: createId(), name: "Nuevo flujo", nodes: [], connections: [] });
        set((state) => ({
          flows: [...state.flows, flow],
          activeFlowId: flow.id,
        }));
      },

      updateFlow: (flowId, patch) => set((state) => ({
        flows: state.flows.map((flow) => (flow.id === flowId ? { ...flow, ...patch } : flow)),
      })),

      createFlowForComponent: (componentId, event = "onClick") => {
        let createdId = null;
        set((state) => {
          const screen = getActiveScreen(state);
          const component = getLayoutComponents(screen, state.viewport).find((item) => item.id === componentId);
          const flow = normalizeFlow({
            id: createId(),
            name: `${event} ${component?.name || componentId}`,
            trigger: { type: "componentEvent", screenId: screen?.id || "", componentId, event },
            nodes: [{
              id: createId(),
              type: "event",
              category: "Eventos",
              label: `${event.replace(/^on/, "")}: ${component?.name || componentId}`,
              x: 100,
              y: 120,
              params: { screenId: screen?.id || "", componentId, event },
            }],
            connections: [],
          });
          createdId = flow.id;
          return { flows: [...state.flows, flow], activeFlowId: flow.id };
        });
        return createdId;
      },

      editFlowForComponent: (componentId, event = "onClick") => {
        let targetId = null;
        set((state) => {
          const found = state.flows.find((flow) => flow.trigger?.componentId === componentId && flow.trigger?.event === event);
          if (found) {
            targetId = found.id;
            return { activeFlowId: found.id };
          }
          return state;
        });
        if (!targetId) get().createFlowForComponent(componentId, event);
      },

      addFlowNode: (flowId, node) => set((state) => ({
        flows: state.flows.map((flow) =>
          flow.id === flowId
            ? {
                ...flow,
                nodes: [
                  ...flow.nodes,
                  {
                    id: createId(),
                    type: node.type,
                    category: node.category,
                    label: node.label,
                    x: node.x ?? 140,
                    y: node.y ?? 140,
                    params: node.params || {},
                  },
                ],
              }
            : flow,
        ),
      })),

      updateFlowNode: (flowId, nodeId, patch) => set((state) => ({
        flows: state.flows.map((flow) =>
          flow.id === flowId
            ? {
                ...flow,
                nodes: flow.nodes.map((node) => (node.id === nodeId ? { ...node, ...patch, params: patch.params || node.params } : node)),
              }
            : flow,
        ),
      })),

      moveFlowNode: (flowId, nodeId, delta) => set((state) => ({
        flows: state.flows.map((flow) =>
          flow.id === flowId
            ? {
                ...flow,
                nodes: flow.nodes.map((node) =>
                  node.id === nodeId ? { ...node, x: node.x + delta.x, y: node.y + delta.y } : node,
                ),
              }
            : flow,
        ),
      })),

      selectFlowNode: (flowId, nodeId, additive = false) => set((state) => ({
        flows: state.flows.map((flow) => {
          if (flow.id !== flowId) return flow;
          const selectedNodeIds = additive
            ? flow.selectedNodeIds.includes(nodeId)
              ? flow.selectedNodeIds.filter((id) => id !== nodeId)
              : [...flow.selectedNodeIds, nodeId]
            : [nodeId];
          return { ...flow, selectedNodeIds };
        }),
      })),

      clearFlowSelection: (flowId) => set((state) => ({
        flows: state.flows.map((flow) => (flow.id === flowId ? { ...flow, selectedNodeIds: [] } : flow)),
      })),

      deleteFlowNode: (flowId, nodeId) => set((state) => ({
        flows: state.flows.map((flow) =>
          flow.id === flowId
            ? {
                ...flow,
                nodes: flow.nodes.filter((node) => node.id !== nodeId),
                connections: flow.connections.filter((connection) => nodeIdFromRef(connection.from) !== nodeId && nodeIdFromRef(connection.to) !== nodeId),
                edges: (flow.edges || []).filter((connection) => nodeIdFromRef(connection.from) !== nodeId && nodeIdFromRef(connection.to) !== nodeId),
                selectedNodeIds: flow.selectedNodeIds.filter((id) => id !== nodeId),
              }
            : flow,
        ),
      })),

      addFlowConnection: (flowId, from, to, type = "execution") => set((state) => ({
        flows: state.flows.map((flow) => {
          if (flow.id !== flowId) return flow;
          const fromRef = withPortRef(from, "next");
          const toRef = withPortRef(to, "in");
          const errors = [];
          if (!fromRef || !toRef || nodeIdFromRef(fromRef) === nodeIdFromRef(toRef)) errors.push("No se puede conectar un nodo consigo mismo.");
          if (flow.connections.some((connection) => connection.from === fromRef && connection.to === toRef && connection.type === type)) errors.push("La conexion ya existe.");
          if (errors.length > 0) return { ...flow, errors };
          const [source, sourceHandle = "next"] = fromRef.split(".");
          const [target, targetHandle = "in"] = toRef.split(".");
          const connection = {
            id: `edge_${source}_${target}_${Date.now()}`,
            type,
            from: fromRef,
            to: toRef,
            source,
            sourceHandle,
            target,
            targetHandle,
          };
          return {
            ...flow,
            errors: [],
            connections: [...flow.connections, connection],
            edges: [...(flow.edges || flow.connections), connection],
          };
        }),
      })),

      deleteFlowConnection: (flowId, connectionId) => set((state) => ({
        flows: state.flows.map((flow) =>
          flow.id === flowId
            ? {
                ...flow,
                connections: flow.connections.filter((connection) => connection.id !== connectionId),
                edges: (flow.edges || []).filter((connection) => connection.id !== connectionId),
              }
            : flow,
        ),
      })),

      addDataSource: (type = "local") => set((state) => ({
        dataSources: [
          ...state.dataSources,
          { id: createId(), type, name: type === "firebase" ? "Firebase" : "Base Local", tables: [] },
        ],
      })),

      updateDataSource: (sourceId, patch) => set((state) => ({
        dataSources: state.dataSources.map((source) => (source.id === sourceId ? { ...source, ...patch } : source)),
      })),

      deleteDataSource: (sourceId) => set((state) => ({
        dataSources: state.dataSources.filter((source) => source.id !== sourceId),
      })),

      addTable: (sourceId, name = "Nueva tabla") => set((state) => ({
        dataSources: state.dataSources.map((source) =>
          source.id === sourceId ? { ...source, tables: [...source.tables, createTable(name)] } : source,
        ),
      })),

      updateTable: (sourceId, tableId, patch) => set((state) => ({
        dataSources: state.dataSources.map((source) =>
          source.id === sourceId
            ? {
                ...source,
                tables: source.tables.map((table) => (table.id === tableId ? { ...table, ...patch } : table)),
              }
            : source,
        ),
      })),

      deleteTable: (sourceId, tableId) => set((state) => ({
        dataSources: state.dataSources.map((source) =>
          source.id === sourceId
            ? { ...source, tables: source.tables.filter((table) => table.id !== tableId) }
            : source,
        ),
      })),

      addField: (sourceId, tableId) => set((state) => ({
        dataSources: state.dataSources.map((source) =>
          source.id === sourceId
            ? {
                ...source,
                tables: source.tables.map((table) =>
                  table.id === tableId ? { ...table, fields: [...table.fields, createField()] } : table,
                ),
              }
            : source,
        ),
      })),

      updateField: (sourceId, tableId, fieldId, patch) => set((state) => ({
        dataSources: state.dataSources.map((source) =>
          source.id === sourceId
            ? {
                ...source,
                tables: source.tables.map((table) =>
                  table.id === tableId
                    ? {
                        ...table,
                        fields: table.fields.map((field) =>
                          field.id === fieldId ? { ...field, ...patch } : field,
                        ),
                      }
                    : table,
                ),
              }
            : source,
        ),
      })),

      deleteField: (sourceId, tableId, fieldId) => set((state) => ({
        dataSources: state.dataSources.map((source) =>
          source.id === sourceId
            ? {
                ...source,
                tables: source.tables.map((table) =>
                  table.id === tableId
                    ? { ...table, fields: table.fields.filter((field) => field.id !== fieldId || field.system) }
                    : table,
                ),
              }
            : source,
        ),
      })),

      addRelation: (sourceId, tableId) => set((state) => ({
        dataSources: state.dataSources.map((source) =>
          source.id === sourceId
            ? {
                ...source,
                tables: source.tables.map((table) =>
                  table.id === tableId
                    ? {
                        ...table,
                        relations: [
                          ...(table.relations || []),
                          { id: createId(), fieldName: "", targetTableId: "", targetFieldName: "id" },
                        ],
                      }
                    : table,
                ),
              }
            : source,
        ),
      })),

      updateRelation: (sourceId, tableId, relationId, patch) => set((state) => ({
        dataSources: state.dataSources.map((source) =>
          source.id === sourceId
            ? {
                ...source,
                tables: source.tables.map((table) =>
                  table.id === tableId
                    ? {
                        ...table,
                        relations: (table.relations || []).map((relation) =>
                          relation.id === relationId ? { ...relation, ...patch } : relation,
                        ),
                      }
                    : table,
                ),
              }
            : source,
        ),
      })),

      deleteRelation: (sourceId, tableId, relationId) => set((state) => ({
        dataSources: state.dataSources.map((source) =>
          source.id === sourceId
            ? {
                ...source,
                tables: source.tables.map((table) =>
                  table.id === tableId
                    ? { ...table, relations: (table.relations || []).filter((relation) => relation.id !== relationId) }
                    : table,
                ),
              }
            : source,
        ),
      })),

      addRecord: (sourceId, tableId) => set((state) => ({
        dataSources: state.dataSources.map((source) =>
          source.id === sourceId
            ? {
                ...source,
                tables: source.tables.map((table) =>
                  table.id === tableId
                    ? {
                        ...table,
                        records: [
                          ...(table.records || []),
                          Object.fromEntries(table.fields.map((field) => [field.name, field.name === "id" ? createId() : ""])),
                        ],
                      }
                    : table,
                ),
              }
            : source,
        ),
      })),

      updateRecord: (sourceId, tableId, index, patch) => set((state) => ({
        dataSources: state.dataSources.map((source) =>
          source.id === sourceId
            ? {
                ...source,
                tables: source.tables.map((table) =>
                  table.id === tableId
                    ? {
                        ...table,
                        records: (table.records || []).map((record, recordIndex) =>
                          recordIndex === index ? { ...record, ...patch } : record,
                        ),
                      }
                    : table,
                ),
              }
            : source,
        ),
      })),

      deleteRecord: (sourceId, tableId, index) => set((state) => ({
        dataSources: state.dataSources.map((source) =>
          source.id === sourceId
            ? {
                ...source,
                tables: source.tables.map((table) =>
                  table.id === tableId
                    ? { ...table, records: (table.records || []).filter((_, recordIndex) => recordIndex !== index) }
                    : table,
                ),
              }
            : source,
        ),
      })),

      generateCrudModule: (config, mode = "check") => {
        const current = get();
        const result = createCrudScreensAndFlows(config, current.screens, mode);
        if (result.conflicts.length > 0 && mode === "check") return result;

        set((state) => {
          const conflictNames = new Set(result.conflicts);
          const screens = mode === "overwrite"
            ? state.screens.filter((screen) => !conflictNames.has(screen.name))
            : state.screens;

          return {
            screens: [...screens, ...result.screens.map(normalizeScreen)],
            flows: [...state.flows, ...result.flows],
            crudModules: [...(state.crudModules || []), result.module],
            activeScreenId: result.module.screenIds.list || result.screens[0]?.id || state.activeScreenId,
            activeFlowId: result.flows[0]?.id || state.activeFlowId,
            selectedId: null,
          };
        });

        return result;
      },

      addVariable: (scope) => {
        const variable = createVariable(scope);
        if (scope === "screen") {
          set((state) => updateActiveScreen(state, (screen) => ({
            ...screen,
            variables: [...(screen.variables || []), variable],
          })));
          return;
        }

        set((state) => ({
          variables: {
            ...state.variables,
            [scope]: [...(state.variables?.[scope] || []), variable],
          },
        }));
      },

      updateVariable: (scope, id, patch) => {
        if (scope === "screen") {
          set((state) => updateActiveScreen(state, (screen) => ({
            ...screen,
            variables: (screen.variables || []).map((variable) =>
              variable.id === id ? { ...variable, ...patch } : variable,
            ),
          })));
          return;
        }

        set((state) => ({
          variables: {
            ...state.variables,
            [scope]: (state.variables?.[scope] || []).map((variable) =>
              variable.id === id ? { ...variable, ...patch } : variable,
            ),
          },
        }));
      },

      deleteVariable: (scope, id) => {
        if (scope === "screen") {
          set((state) => updateActiveScreen(state, (screen) => ({
            ...screen,
            variables: (screen.variables || []).filter((variable) => variable.id !== id),
          })));
          return;
        }

        set((state) => ({
          variables: {
            ...state.variables,
            [scope]: (state.variables?.[scope] || []).filter((variable) => variable.id !== id),
          },
        }));
      },

      addScreen: (templateName) => {
        const template = templates[templateName] || [];
        const screen = createScreen(templateName || "Nueva pantalla", template);
        set((state) => ({
          screens: [...state.screens, screen],
          activeScreenId: screen.id,
          selectedId: null,
        }));
      },

      renameScreen: (id, name) => set((state) => ({
        screens: state.screens.map((screen) => (screen.id === id ? { ...screen, name } : screen)),
      })),

      selectScreen: (id) => set({ activeScreenId: id, selectedId: null }),

      setStartScreen: (id) => set({ startScreenId: id }),

      duplicateScreen: (id) => {
        const source = get().screens.find((screen) => screen.id === id);
        if (!source) return;
        const duplicate = {
          id: createId(),
          name: `${source.name} copia`,
          variables: (source.variables || []).map((variable) => ({ ...variable, id: createId() })),
          components: source.components.map((component) => normalizeComponent({ ...component, id: createId() })),
        };
        set((state) => ({
          screens: [...state.screens, duplicate],
          activeScreenId: duplicate.id,
          selectedId: null,
        }));
      },

      deleteScreen: (id) => set((state) => {
        if (state.screens.length <= 1) return state;
        const screens = state.screens.filter((screen) => screen.id !== id);
        const activeScreenId = state.activeScreenId === id ? screens[0].id : state.activeScreenId;
        const startScreenId = state.startScreenId === id ? screens[0].id : state.startScreenId;
        return { screens, activeScreenId, startScreenId, selectedId: null };
      }),

      addComponent: (type, position = {}) => {
        if (type === "appbar") return;
        let addedId = null;
        set((state) => updateActiveLayout(state, (layout, screen) => {
          const components = layout.components || [];
          const zIndex = Math.max(0, ...components.map((item) => item.props.zIndex || 0)) + 1;
          const topInset = getScreenTopInset(screen);
          const component = createComponent(type, {
            ...position,
            x: snapValue(position.x ?? 32, state),
            y: Math.max(topInset, snapValue(position.y ?? 32, state)),
          }, zIndex, state.theme);
          component.name = makeUniqueComponentName(component.name, components, component.id);
          addedId = component.id;
          return { ...layout, components: [...components, component] };
        }));
        set({ selectedId: addedId });
      },

      updateComponent: (id, patch, eventsPatch = null) => set((state) =>
        updateActiveLayout(state, (layout, screen) => {
          const topInset = getScreenTopInset(screen);
          return {
            ...layout,
            components: (layout.components || []).map((component) =>
              component.id === id
                ? {
                    ...component,
                    events: eventsPatch ? { ...defaultEvents, ...eventsPatch } : component.events,
                    props: { ...component.props, ...patch, y: patch.y !== undefined ? Math.max(topInset, Number(patch.y) || 0) : component.props.y },
                  }
                : component,
            ),
          };
        }),
      ),

      renameComponent: (id, rawName) => {
        let result = { valid: false, message: "No se pudo renombrar.", suggestion: "" };
        set((state) => {
          const screen = getActiveScreen(state);
          const components = getLayoutComponents(screen, state.viewport);
          const component = components.find((item) => item.id === id);
          if (!component) return state;
          result = validateComponentName(rawName, components, id);
          if (!result.valid) return state;
          const oldName = component.name;
          const newName = result.suggestion;
          if (oldName === newName) return state;
          return {
            ...updateActiveLayout(state, (layout) => ({
              ...layout,
              components: (layout.components || []).map((item) =>
                item.id === id
                  ? { ...replaceComponentReference(item, oldName, newName), name: newName }
                  : replaceComponentReference(item, oldName, newName),
              ),
            })),
            flows: state.flows.map((flow) => replaceComponentReference({
              ...flow,
              name: flow.name?.includes(oldName) ? flow.name.replaceAll(oldName, newName) : flow.name,
              nodes: (flow.nodes || []).map((node) => ({
                ...replaceComponentReference(node, oldName, newName),
                label: node.label?.includes(oldName) ? node.label.replaceAll(oldName, newName) : node.label,
              })),
            }, oldName, newName)),
          };
        });
        return result;
      },

      moveComponent: (id, delta) => {
        const component = get().getActiveComponents().find((item) => item.id === id);
        if (!component || component.props.locked) return;
        const topInset = getScreenTopInset(getActiveScreen(get()));
        get().updateComponent(id, {
          x: Math.max(0, snapValue(component.props.x + delta.x, get())),
          y: Math.max(topInset, snapValue(component.props.y + delta.y, get())),
        });
      },

      resizeComponent: (id, patch) => {
        const component = get().getActiveComponents().find((item) => item.id === id);
        if (!component || component.props.locked) return;
        const topInset = getScreenTopInset(getActiveScreen(get()));
        get().updateComponent(id, {
          width: Math.max(20, snapValue(patch.width ?? component.props.width, get())),
          height: Math.max(2, snapValue(patch.height ?? component.props.height, get())),
          x: Math.max(0, snapValue(patch.x ?? component.props.x, get())),
          y: Math.max(topInset, snapValue(patch.y ?? component.props.y, get())),
        });
      },

      deleteComponent: (id) => set((state) => ({
        ...updateActiveLayout(state, (layout) => ({ ...layout, components: (layout.components || []).filter((component) => component.id !== id) })),
        selectedId: state.selectedId === id ? null : state.selectedId,
      })),

      duplicateComponent: (id) => {
        const component = get().getActiveComponents().find((item) => item.id === id);
        if (!component) return;
        const duplicate = normalizeComponent({
          ...component,
          id: createComponentId(),
          name: makeUniqueComponentName(component.name, get().getActiveComponents()),
          props: {
            ...component.props,
            x: component.props.x + 24,
            y: component.props.y + 24,
            zIndex: Math.max(0, ...get().getActiveComponents().map((item) => item.props.zIndex || 0)) + 1,
            locked: false,
          },
        });
        set((state) => ({
          ...updateActiveLayout(state, (layout) => ({ ...layout, components: [...(layout.components || []), duplicate] })),
          selectedId: duplicate.id,
        }));
      },

      bringToFront: (id) => {
        const maxZ = Math.max(0, ...get().getActiveComponents().map((item) => item.props.zIndex || 0));
        get().updateComponent(id, { zIndex: maxZ + 1 });
      },

      sendToBack: (id) => {
        const minZ = Math.min(0, ...get().getActiveComponents().map((item) => item.props.zIndex || 0));
        get().updateComponent(id, { zIndex: minZ - 1 });
      },

      toggleLocked: (id) => {
        const component = get().getActiveComponents().find((item) => item.id === id);
        if (component) get().updateComponent(id, { locked: !component.props.locked });
      },

      toggleHidden: (id) => {
        const component = get().getActiveComponents().find((item) => item.id === id);
        if (component) get().updateComponent(id, { hidden: !component.props.hidden });
      },

      importProject: (project) => set({ ...normalizeProject(project), selectedId: null, showJson: false, showFlutterCode: false }),

      getActiveComponents: () => getLayoutComponents(getActiveScreen(get()), get().viewport),

      getBuilderJson: () => {
        const state = get();
        const activeScreen = getActiveScreen(state);
        return {
          projectName: state.projectName,
          viewport: { id: state.viewport, ...VIEWPORTS[state.viewport] },
          activeScreenId: state.activeScreenId,
          startScreenId: state.startScreenId,
          variables: state.variables,
          dataSources: state.dataSources,
          crudModules: state.crudModules,
          theme: state.theme,
          resources: state.resources,
          androidConfig: state.androidConfig,
          activeFlowId: state.activeFlowId,
          flows: state.flows,
          canvasSettings: state.canvasSettings,
          screens: state.screens.map((screen) => ({
            ...screen,
            components: getLayoutComponents(screen, state.viewport),
          })),
          components: getLayoutComponents(activeScreen, state.viewport),
        };
      },
    }),
    {
      name: STORAGE_KEY,
      partialize: (state) => ({
        projectName: state.projectName,
        viewport: state.viewport,
        activeScreenId: state.activeScreenId,
        startScreenId: state.startScreenId,
        variables: state.variables,
        dataSources: state.dataSources,
        crudModules: state.crudModules,
        theme: state.theme,
        resources: state.resources,
        androidConfig: state.androidConfig,
        activeFlowId: state.activeFlowId,
        flows: state.flows,
        canvasSettings: state.canvasSettings,
        screens: state.screens,
      }),
      merge: (persistedState, currentState) => ({
        ...currentState,
        ...normalizeProject(persistedState),
      }),
    },
  ),
);
