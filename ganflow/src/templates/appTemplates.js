const baseEvents = { onTap: [], onLoad: [], onChange: [], onSubmit: [] };

const c = (id, type, text, x, y, width, height, extra = {}) => ({
  id,
  type,
  name: text,
  events: extra.events || baseEvents,
  props: {
    text,
    x,
    y,
    width,
    height,
    useThemeStyle: true,
    ...(extra.props || {}),
  },
});

const screen = (id, name, components = []) => ({ id, name, variables: [], components });

const field = (name, type = "string", extra = {}) => ({ id: `field-${name}`, name, type, ...extra });

const table = (id, name, fields, relations = []) => ({
  id,
  name,
  fields: [
    field("id", "string", { system: true }),
    ...fields,
    field("createdAt", "date", { system: true }),
    field("updatedAt", "date", { system: true }),
  ],
  relations,
  records: [],
});

const flow = (id, name, steps) => ({
  id,
  name,
  zoom: 1,
  pan: { x: 0, y: 0 },
  selectedNodeIds: [],
  errors: [],
  nodes: steps.map((step, index) => ({
    id: `${id}-node-${index}`,
    x: 80 + index * 230,
    y: 120,
    ...step,
  })),
  connections: steps.slice(1).map((_, index) => ({
    id: `${id}-conn-${index}`,
    from: `${id}-node-${index}`,
    to: `${id}-node-${index + 1}`,
  })),
});

const navigateEvent = (screenId) => ({
  ...baseEvents,
  onTap: [{ id: `action-${screenId}`, type: "navigateToScreen", params: { screenId } }],
});

const professionalTheme = {
  name: "Profesional suave",
  mode: "light",
  colors: {
    primary: "#2563eb",
    secondary: "#14b8a6",
    background: "#eef4f8",
    surface: "#ffffff",
    text: "#1f2937",
    border: "#dbe4ea",
  },
  typography: { fontFamily: "Inter", baseSize: 12, titleSize: 18, weight: 400 },
  shape: { radius: 12 },
  effects: { shadow: "soft" },
  spacing: { base: 8 },
};

const courseTheme = {
  name: "Cursos moderno",
  mode: "light",
  colors: {
    primary: "#7c3aed",
    secondary: "#06b6d4",
    background: "#f5f3ff",
    surface: "#ffffff",
    text: "#1e1b4b",
    border: "#ddd6fe",
  },
  typography: { fontFamily: "Inter", baseSize: 12, titleSize: 18, weight: 400 },
  shape: { radius: 14 },
  effects: { shadow: "soft" },
  spacing: { base: 8 },
};

const appShell = (title, cards) => [
  c("appbar", "appbar", title, 24, 24, 342, 56),
  ...cards.map((item, index) =>
    c(`card-${index}`, "card", item.label, 32, 104 + index * 118, 326, 92, {
      events: navigateEvent(item.target),
      props: { actionType: "navigate", actionTarget: item.target },
    }),
  ),
];

const pacientesScreens = [
  screen("inicio", "Inicio", appShell("Pacientes Pro", [
    { label: "Pacientes", target: "pacientes_lista" },
    { label: "Turnos", target: "turnos_lista" },
    { label: "Configuracion", target: "configuracion" },
  ])),
  screen("pacientes_lista", "PacientesLista", [
    c("pl-appbar", "appbar", "Pacientes", 24, 24, 342, 56),
    c("pl-search", "input", "Buscar paciente", 32, 96, 326, 42, { props: { dataTable: "pacientes", dataField: "nombre" } }),
    c("pl-list", "list", "{{registro.nombre}}\n{{registro.telefono}}\n{{registro.dosha}}", 32, 154, 326, 386, { props: { dataTable: "pacientes", dataTitleField: "nombre", dataSubtitleField: "dosha", actionType: "navigate", actionTarget: "paciente_detalle" } }),
    c("pl-new", "button", "Nuevo", 244, 594, 114, 48, { events: navigateEvent("paciente_crear"), props: { actionType: "navigate", actionTarget: "paciente_crear", borderRadius: 999 } }),
  ]),
  screen("paciente_detalle", "PacienteDetalle", [
    c("pd-appbar", "appbar", "Detalle paciente", 24, 24, 342, 56),
    c("pd-card", "card", "Nombre: {{registro.nombre}}\nTelefono: {{registro.telefono}}\nDosha: {{registro.dosha}}\nMotivo: {{registro.motivoConsulta}}", 32, 112, 326, 278),
    c("pd-edit", "button", "Editar", 32, 430, 150, 44, { events: navigateEvent("paciente_editar"), props: { actionType: "navigate", actionTarget: "paciente_editar" } }),
    c("pd-delete", "button", "Eliminar", 198, 430, 160, 44, { props: { backgroundColor: "#ef4444" } }),
  ]),
  screen("paciente_crear", "PacienteCrear", [
    c("pc-appbar", "appbar", "Nuevo paciente", 24, 24, 342, 56),
    c("pc-form", "form", "Paciente", 24, 92, 342, 430, { props: { dataTable: "pacientes" } }),
    c("pc-nombre", "input", "Nombre", 32, 112, 326, 42, { props: { dataTable: "pacientes", dataField: "nombre" } }),
    c("pc-telefono", "input", "Telefono", 32, 166, 326, 42, { props: { dataTable: "pacientes", dataField: "telefono" } }),
    c("pc-email", "input", "Email", 32, 220, 326, 42, { props: { dataTable: "pacientes", dataField: "email" } }),
    c("pc-dosha", "select", "Dosha", 32, 274, 326, 42, { props: { dataTable: "pacientes", dataField: "dosha" } }),
    c("pc-motivo", "input", "Motivo consulta", 32, 328, 326, 42, { props: { dataTable: "pacientes", dataField: "motivoConsulta" } }),
    c("pc-save", "button", "Guardar", 198, 594, 160, 44),
  ]),
  screen("paciente_editar", "PacienteEditar", [
    c("pe-appbar", "appbar", "Editar paciente", 24, 24, 342, 56),
    c("pe-form", "form", "Paciente", 24, 92, 342, 430, { props: { dataTable: "pacientes" } }),
    c("pe-nombre", "input", "Nombre", 32, 112, 326, 42, { props: { dataTable: "pacientes", dataField: "nombre" } }),
    c("pe-telefono", "input", "Telefono", 32, 166, 326, 42, { props: { dataTable: "pacientes", dataField: "telefono" } }),
    c("pe-email", "input", "Email", 32, 220, 326, 42, { props: { dataTable: "pacientes", dataField: "email" } }),
    c("pe-dosha", "select", "Dosha", 32, 274, 326, 42, { props: { dataTable: "pacientes", dataField: "dosha" } }),
    c("pe-save", "button", "Actualizar", 198, 594, 160, 44),
  ]),
  screen("turnos_lista", "TurnosLista", [
    c("tl-appbar", "appbar", "Turnos", 24, 24, 342, 56),
    c("tl-list", "list", "{{registro.fecha}}\n{{registro.hora}}\n{{registro.estado}}", 32, 112, 326, 420, { props: { dataTable: "turnos", dataTitleField: "fecha", dataSubtitleField: "motivo" } }),
    c("tl-new", "button", "Nuevo turno", 214, 594, 144, 48, { events: navigateEvent("turno_crear"), props: { actionType: "navigate", actionTarget: "turno_crear", borderRadius: 999 } }),
  ]),
  screen("turno_crear", "TurnoCrear", [
    c("tc-appbar", "appbar", "Nuevo turno", 24, 24, 342, 56),
    c("tc-paciente", "select", "Paciente", 32, 112, 326, 42, { props: { dataTable: "turnos", dataField: "pacienteId" } }),
    c("tc-fecha", "input", "Fecha", 32, 166, 326, 42, { props: { dataTable: "turnos", dataField: "fecha" } }),
    c("tc-hora", "input", "Hora", 32, 220, 326, 42, { props: { dataTable: "turnos", dataField: "hora" } }),
    c("tc-motivo", "input", "Motivo", 32, 274, 326, 42, { props: { dataTable: "turnos", dataField: "motivo" } }),
    c("tc-save", "button", "Guardar turno", 198, 594, 160, 44),
  ]),
  screen("configuracion", "Configuracion", [
    c("cfg-appbar", "appbar", "Configuracion", 24, 24, 342, 56),
    c("cfg-card", "card", "Preferencias\nTema claro\nBase local", 32, 112, 326, 180),
  ]),
];

const pacientesTables = [
  table("pacientes", "Pacientes", [
    field("nombre"), field("telefono"), field("email"), field("fechaNacimiento", "date"),
    field("dosha"), field("motivoConsulta"), field("observaciones"),
  ]),
  table("turnos", "Turnos", [
    field("pacienteId", "relation", { relation: { tableId: "pacientes", fieldName: "id" } }),
    field("fecha", "date"), field("hora"), field("motivo"), field("estado"),
  ], [{ id: "rel-turnos-pacientes", fieldName: "pacienteId", targetTableId: "pacientes", targetFieldName: "id" }]),
  table("tratamientos", "Tratamientos", [field("pacienteId", "relation"), field("nombre"), field("descripcion"), field("estado")]),
  table("notas", "Notas", [field("pacienteId", "relation"), field("contenido"), field("fecha", "date")]),
];

const pacientesFlows = [
  flow("cargarPacientes", "cargarPacientes", [
    { type: "onLoad", category: "Eventos", label: "Al cargar", params: {} },
    { type: "listRecords", category: "Datos", label: "Listar pacientes", params: { table: "pacientes", targetVariable: "listaPacientes" } },
  ]),
  flow("crearPaciente", "crearPaciente", [
    { type: "onClick", category: "Eventos", label: "Guardar", params: {} },
    { type: "createRecord", category: "Datos", label: "Crear paciente", params: { table: "pacientes" } },
    { type: "showMessage", category: "Mensajes", label: "Confirmar", params: { message: "Paciente guardado" } },
  ]),
  flow("actualizarPaciente", "actualizarPaciente", [
    { type: "onClick", category: "Eventos", label: "Actualizar", params: {} },
    { type: "updateRecord", category: "Datos", label: "Actualizar paciente", params: { table: "pacientes" } },
  ]),
  flow("eliminarPaciente", "eliminarPaciente", [
    { type: "onClick", category: "Eventos", label: "Eliminar", params: {} },
    { type: "deleteRecord", category: "Datos", label: "Eliminar paciente", params: { table: "pacientes" } },
  ]),
  flow("cargarTurnos", "cargarTurnos", [
    { type: "onLoad", category: "Eventos", label: "Al cargar", params: {} },
    { type: "listRecords", category: "Datos", label: "Listar turnos", params: { table: "turnos", targetVariable: "listaTurnos" } },
  ]),
  flow("crearTurno", "crearTurno", [
    { type: "onClick", category: "Eventos", label: "Guardar turno", params: {} },
    { type: "createRecord", category: "Datos", label: "Crear turno", params: { table: "turnos" } },
  ]),
  flow("navegarADetallePaciente", "navegarADetallePaciente", [
    { type: "onClick", category: "Eventos", label: "Abrir paciente", params: {} },
    { type: "navigateTo", category: "Navegacion", label: "Detalle", params: { screenId: "paciente_detalle" } },
  ]),
];

const cursosScreens = [
  screen("inicio", "Inicio", appShell("Cursos", [
    { label: "Explorar cursos", target: "cursos_lista" },
    { label: "Mis cursos", target: "mis_cursos" },
    { label: "Perfil", target: "perfil" },
  ])),
  screen("cursos_lista", "CursosLista", [
    c("cl-appbar", "appbar", "Cursos", 24, 24, 342, 56),
    c("cl-list", "list", "{{registro.titulo}}\n{{registro.descripcion}}\n{{registro.precio}}", 32, 104, 326, 430, { props: { dataTable: "cursos", dataTitleField: "titulo", dataSubtitleField: "descripcion", dataImageField: "imagen", actionType: "navigate", actionTarget: "curso_detalle" } }),
  ]),
  screen("curso_detalle", "CursoDetalle", [
    c("cd-image", "image", "{{registro.imagen}}", 32, 40, 326, 170),
    c("cd-title", "text", "{{registro.titulo}}", 32, 236, 326, 44),
    c("cd-card", "card", "{{registro.descripcion}}\nPrecio: {{registro.precio}}", 32, 300, 326, 160),
  ]),
  screen("leccion_detalle", "LeccionDetalle", [
    c("ld-video", "video", "Video de leccion", 32, 64, 326, 190),
    c("ld-card", "card", "{{registro.contenido}}", 32, 286, 326, 240),
  ]),
  screen("perfil", "Perfil", [
    c("pf-avatar", "avatar", "U", 151, 64, 88, 88),
    c("pf-card", "card", "Usuario actual\nProgreso general", 32, 200, 326, 180),
  ]),
  screen("mis_cursos", "MisCursos", [
    c("mc-appbar", "appbar", "Mis cursos", 24, 24, 342, 56),
    c("mc-list", "list", "{{registro.titulo}}\n{{registro.progreso}}", 32, 112, 326, 420, { props: { dataTable: "progreso", dataTitleField: "cursoId", dataSubtitleField: "estado" } }),
  ]),
];

const cursosTables = [
  table("cursos", "Cursos", [field("titulo"), field("descripcion"), field("imagen", "image"), field("precio", "number"), field("publicado", "boolean")]),
  table("lecciones", "Lecciones", [field("cursoId", "relation"), field("titulo"), field("videoUrl"), field("contenido"), field("orden", "number")]),
  table("usuarios", "Usuarios", [field("nombre"), field("email"), field("avatar", "image")]),
  table("progreso", "Progreso", [field("usuarioId", "relation"), field("cursoId", "relation"), field("estado"), field("porcentaje", "number")]),
];

const quickTemplate = (id, name, category, description, icon, tableName, theme = professionalTheme) => ({
  id,
  name,
  category,
  description,
  icon,
  theme,
  screens: [
    screen("inicio", "Inicio", appShell(name, [{ label: tableName, target: "lista" }])),
    screen("lista", `${tableName}Lista`, [
      c("appbar", "appbar", tableName, 24, 24, 342, 56),
      c("search", "input", `Buscar ${tableName.toLowerCase()}`, 32, 96, 326, 42),
      c("list", "list", "{{registro.nombre}}\n{{registro.descripcion}}", 32, 154, 326, 410, { props: { dataTable: tableName.toLowerCase(), dataTitleField: "nombre", dataSubtitleField: "descripcion" } }),
    ]),
  ],
  dataSources: [{ id: "source", type: "local", name: "Base Local", tables: [table(tableName.toLowerCase(), tableName, [field("nombre"), field("descripcion"), field("estado")])] }],
  variables: { global: [{ id: "usuarioActual", scope: "global", name: "usuarioActual", type: "object", initialValue: "" }], local: [] },
  flows: [flow(`cargar${tableName}`, `cargar${tableName}`, [
    { type: "onLoad", category: "Eventos", label: "Al cargar", params: {} },
    { type: "listRecords", category: "Datos", label: `Listar ${tableName}`, params: { table: tableName.toLowerCase(), targetVariable: `lista${tableName}` } },
  ])],
});

export const appTemplates = [
  {
    id: "app_turnos",
    name: "App de Turnos",
    category: "Servicios",
    description: "Agenda, clientes, reservas y estados de turnos.",
    icon: "calendar",
    theme: professionalTheme,
    screens: pacientesScreens.filter((item) => ["inicio", "turnos_lista", "turno_crear", "configuracion"].includes(item.id)),
    dataSources: [{ id: "source", type: "local", name: "Base Local", tables: pacientesTables.slice(0, 2) }],
    variables: { global: [{ id: "usuarioActual", scope: "global", name: "usuarioActual", type: "object", initialValue: "" }, { id: "listaTurnos", scope: "global", name: "listaTurnos", type: "list", initialValue: "" }], local: [] },
    flows: pacientesFlows.filter((item) => ["cargarTurnos", "crearTurno"].includes(item.id)),
  },
  {
    id: "app_pacientes",
    name: "App de Pacientes",
    category: "Salud",
    description: "Gestion de pacientes, turnos, tratamientos y notas.",
    icon: "heart",
    theme: professionalTheme,
    screens: pacientesScreens,
    dataSources: [{ id: "source", type: "local", name: "Base Local", tables: pacientesTables }],
    variables: {
      global: [
        { id: "usuarioActual", scope: "global", name: "usuarioActual", type: "object", initialValue: "" },
        { id: "pacienteSeleccionado", scope: "global", name: "pacienteSeleccionado", type: "object", initialValue: "" },
        { id: "listaPacientes", scope: "global", name: "listaPacientes", type: "list", initialValue: "" },
        { id: "listaTurnos", scope: "global", name: "listaTurnos", type: "list", initialValue: "" },
      ],
      local: [],
    },
    flows: pacientesFlows,
  },
  {
    id: "app_cursos",
    name: "App de Cursos",
    category: "Educacion",
    description: "Cursos, lecciones, usuarios y seguimiento de progreso.",
    icon: "graduation",
    theme: courseTheme,
    screens: cursosScreens,
    dataSources: [{ id: "source", type: "local", name: "Base Local", tables: cursosTables }],
    variables: { global: [{ id: "usuarioActual", scope: "global", name: "usuarioActual", type: "object", initialValue: "" }, { id: "misCursos", scope: "global", name: "misCursos", type: "list", initialValue: "" }], local: [] },
    flows: [
      flow("cargarCursos", "cargarCursos", [
        { type: "onLoad", category: "Eventos", label: "Al cargar", params: {} },
        { type: "listRecords", category: "Datos", label: "Listar cursos", params: { table: "cursos", targetVariable: "listaCursos" } },
      ]),
    ],
  },
  quickTemplate("app_tienda", "App de Tienda", "Comercio", "Catalogo, productos y pedidos.", "shopping", "Productos"),
  quickTemplate("app_biblioteca", "App de Biblioteca", "Educacion", "Libros, autores y prestamos.", "book", "Libros"),
  quickTemplate("app_notas", "App de Notas", "Productividad", "Notas, etiquetas y busqueda simple.", "note", "Notas"),
  quickTemplate("app_reservas", "App de Reservas", "Servicios", "Disponibilidad, reservas y clientes.", "calendar", "Reservas"),
  quickTemplate("app_comunidad", "App de Comunidad", "Social", "Publicaciones, miembros y mensajes.", "users", "Publicaciones", courseTheme),
  quickTemplate("app_eventos", "App de Eventos", "Eventos", "Eventos, asistentes y agenda.", "ticket", "Eventos"),
  quickTemplate("app_inventario", "App de Inventario", "Operaciones", "Stock, productos y movimientos.", "boxes", "Productos"),
];
