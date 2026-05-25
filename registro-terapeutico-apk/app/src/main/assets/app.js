const STORAGE_KEY = "registroTerapeuticoAshram";
const LOGO_SRC = "./logo-ashram.webp";

const views = [
  ["dashboard", "Panel", "IN"],
  ["patients", "Pacientes", "PA"],
  ["consult-select", "Consulta", "CO"],
  ["plants", "Boticario", "BO"],
  ["calendar", "Calendario", "CA"],
];

const menuIcons = {
  patients: `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
      <path d="M4.5 21a7.5 7.5 0 0 1 15 0" />
    </svg>
  `,
  consult: `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 3v5a6 6 0 0 0 12 0V3" />
      <path d="M9 3v5a3 3 0 0 0 6 0V3" />
      <path d="M12 14v2a5 5 0 0 0 5 5h1" />
      <path d="M18 18a2 2 0 1 0 0 .1" />
    </svg>
  `,
  plants: `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 21V10" />
      <path d="M12 10C7 10 4.5 7.5 4 3c4.5.5 8 2.5 8 7Z" />
      <path d="M12 13c5 0 7.5-2.5 8-7-4.5.5-8 2.5-8 7Z" />
    </svg>
  `,
};

const fieldGroups = {
  patient: [
    ["nombre", "Nombre y apellido"],
    ["telefono", "Telefono"],
    ["email", "Email"],
    ["nacimiento", "Fecha de nacimiento", "date"],
    ["domicilio", "Domicilio"],
    ["ocupacion", "Ocupacion"],
    ["antecedentes", "Antecedentes importantes", "textarea"],
    ["medicacion", "Medicacion actual", "textarea"],
    ["observaciones", "Observaciones generales", "textarea"],
  ],
  ayurveda: [
    ["fecha", "Fecha", "date"],
    ["motivo", "Motivo de consulta", "textarea"],
    ["dosha", "Dosha predominante", "select:Vata|Pitta|Kapha|Mixto"],
    ["vikriti", "Vikriti actual"],
    ["prakriti", "Prakriti estimada"],
    ["agni", "Agni", "select:Bajo|Irregular|Fuerte|Equilibrado"],
    ["ama", "Ama", "select:No|Si"],
    ["evacuacion", "Evacuacion"],
    ["sueno", "Sueno"],
    ["apetito", "Apetito"],
    ["energia", "Energia"],
    ["emocional", "Estado emocional"],
    ["lengua", "Lengua"],
    ["pulso", "Pulso"],
    ["alimentacion", "Alimentacion actual", "textarea"],
    ["rutina", "Rutina diaria", "textarea"],
    ["desequilibrios", "Desequilibrios observados", "textarea"],
    ["recomendaciones", "Recomendaciones alimentarias", "textarea"],
    ["especias", "Especias sugeridas"],
    ["infusiones", "Infusiones"],
    ["dinacharya", "Rutinas Dinacharya", "textarea"],
    ["respiracion", "Practicas respiratorias"],
    ["meditacion", "Meditacion o mantra recomendado"],
    ["observaciones", "Observaciones del terapeuta", "textarea"],
  ],
  coaching: [
    ["fecha", "Fecha", "date"],
    ["tema", "Tema principal trabajado", "textarea"],
    ["emocionalInicial", "Estado emocional inicial"],
    ["creencias", "Creencias limitantes detectadas", "textarea"],
    ["preguntas", "Preguntas poderosas realizadas", "textarea"],
    ["recursos", "Recursos internos encontrados", "textarea"],
    ["objetivos", "Objetivos del paciente", "textarea"],
    ["accion", "Accion concreta para la semana", "textarea"],
    ["frase", "Frase o reflexion final", "textarea"],
    ["emocionalFinal", "Estado emocional al finalizar"],
    ["seguimiento", "Seguimiento proxima sesion", "textarea"],
  ],
  plant: [
    ["nombre", "Nombre comun"],
    ["cientifico", "Nombre cientifico"],
    ["sanscrito", "Nombre en sanscrito"],
    ["parte", "Parte utilizada"],
    ["rasa", "Rasa / sabor"],
    ["virya", "Virya", "select:Caliente|Fria"],
    ["vipaka", "Vipaka"],
    ["gunas", "Gunas / cualidades"],
    ["equilibra", "Doshas que equilibra"],
    ["agrava", "Doshas que puede agravar"],
    ["accion", "Accion principal"],
    ["usos", "Usos ayurvedicos", "textarea"],
    ["contraindicaciones", "Contraindicaciones", "textarea"],
    ["preparacion", "Forma de preparacion", "textarea"],
    ["dosis", "Dosis orientativa"],
    ["imagen", "Foto de la planta", "file"],
    ["observaciones", "Observaciones", "textarea"],
  ],
};

let state = loadState();
let view = "dashboard";
let drawerOpen = false;
let consultType = "ayurveda";
let selectedPatientId = state.patients[0]?.id || "";
let patientFormOpen = false;
let editingPatientId = "";
let editingConsultId = "";
let plantFormOpen = false;
let editingPlantId = "";

const app = document.getElementById("app");
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js").catch(() => {});
}
document.addEventListener("focusin", (event) => {
  if (!event.target.matches("input, textarea, select")) return;
  window.setTimeout(() => {
    event.target.scrollIntoView({ block: "nearest", behavior: "smooth" });
    window.setTimeout(() => window.scrollBy({ top: 70, behavior: "smooth" }), 120);
  }, 260);
});
history.replaceState({ view }, "", "");
window.addEventListener("popstate", (event) => {
  view = event.state?.view || "dashboard";
  drawerOpen = false;
  render();
});
render();

function loadState() {
  const fallback = {
    session: { userId: "admin", role: "administrador" },
    patients: [],
    consultas_ayurveda: [],
    consultas_coaching: [],
    plantas: seedPlants(),
    sugerencias: [],
    turnos: [],
  };
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    return {
      ...fallback,
      ...stored,
      session: stored.session || fallback.session,
    };
  } catch {
    return fallback;
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function render() {
  app.className = "app";
  app.innerHTML = Shell();
  bind();
}

function Shell() {
  const current = views.find(([id]) => id === view) || views[0];
  const canGoBack = view !== "dashboard";
  return `
    <section class="shell">
      <header class="topbar">
        <button class="icon-btn" data-action="${canGoBack ? "back" : "drawer"}" aria-label="${canGoBack ? "Volver" : "Menu"}">${canGoBack ? "Volver" : "Menu"}</button>
        <span><strong>${current[1]}</strong><small>Registro Terapeutico Ashram Ganesha</small></span>
      </header>
      <nav class="drawer ${drawerOpen ? "open" : ""}">
        <div class="brand drawer-brand"><img class="brand-logo small" src="${LOGO_SRC}" alt="Ashram Ganesha" /><strong>Ashram Ganesha</strong></div>
        ${views.map(([id, label, icon]) => `<button class="${view === id ? "active" : ""}" data-view="${id}"><span>${icon}</span>${label}</button>`).join("")}
      </nav>
      ${drawerOpen ? `<button class="scrim" data-action="drawer-close" aria-label="Cerrar menu"></button>` : ""}
      <main class="content">${renderView()}</main>
    </section>
  `;
}

function renderView() {
  if (view === "dashboard") return Dashboard();
  if (view === "patients") return Patients();
  if (view === "consult-select") return ConsultSelect();
  if (view === "new-consult") return NewConsult();
  if (view === "history") return History();
  if (view === "plants") return Plants();
  if (view === "calendar") return Calendar();
  if (view === "suggestions") return Suggestions();
  if (view === "settings") return Settings();
  return Dashboard();
}

function Dashboard() {
  return `
    <div class="stack">
      <div class="page-title">
        <img class="home-logo" src="${LOGO_SRC}" alt="Ashram Ganesha" />
        <h1>Registro Terapeutico</h1>
        <p>Ashram Ganesha - consulta, seguimiento y boticario local.</p>
      </div>
      <div class="main-menu">
        <button data-view="patients"><span>${menuIcons.patients}</span><strong>Pacientes</strong><small>Fichas e historial</small></button>
        <button data-view="consult-select"><span>${menuIcons.consult}</span><strong>Consulta</strong><small>Elegir paciente y registrar</small></button>
        <button data-view="plants"><span>${menuIcons.plants}</span><strong>Boticario</strong><small>Plantas medicinales argentinas</small></button>
      </div>
    </div>
  `;
}

function Patients() {
  const editing = state.patients.find((p) => p.id === editingPatientId) || {};
  return `
    <div class="stack">
      <div class="toolbar">
        <input class="search" data-search="patients" placeholder="Buscar paciente..." />
        <button class="fab small" data-action="patient-form" aria-label="Nuevo paciente">+</button>
      </div>
      <div class="list" id="patientList">${patientCards(state.patients)}</div>
      <div class="form-section" id="patientForm" ${patientFormOpen ? "" : "hidden"}>
        <h2>${editingPatientId ? "Modificar paciente" : "Nuevo paciente"}</h2>
        ${fields(fieldGroups.patient, editing)}
        <button class="primary" data-action="save-patient">${editingPatientId ? "Guardar cambios" : "Guardar paciente"}</button>
      </div>
    </div>
  `;
}

function NewConsult() {
  const patient = state.patients.find((p) => p.id === selectedPatientId);
  const collection = consultType === "ayurveda" ? state.consultas_ayurveda : state.consultas_coaching;
  const editing = collection.find((c) => c.id === editingConsultId) || {};
  return `
    <div class="stack">
      <section class="selected-patient">
        <small>Paciente seleccionado</small>
        <strong>${escapeHtml(patient?.nombre || "Sin paciente")}</strong>
        <button class="ghost" data-action="back-consult-list" type="button">Cambiar paciente</button>
      </section>
      <div class="tabs">
        <button class="${consultType === "ayurveda" ? "active" : ""}" data-consult-type="ayurveda">Ayurveda</button>
        <button class="${consultType === "coaching" ? "active" : ""}" data-consult-type="coaching">Coaching</button>
      </div>
      <form class="form-section" data-action="save-consult">
        <h2>${editingConsultId ? "Modificar" : "Nueva"} ${consultType === "ayurveda" ? "consulta Ayurveda" : "consulta Coaching"}</h2>
        ${fields(fieldGroups[consultType], editing)}
        <div class="actions">
          <button class="ghost" type="button" data-action="draft-suggestion">Generar sugerencia</button>
          <button class="primary" type="submit">${editingConsultId ? "Guardar cambios" : "Guardar consulta"}</button>
        </div>
      </form>
    </div>
  `;
}

function ConsultSelect() {
  return `
    <div class="stack">
      <div class="page-title">
        <h1>Consulta</h1>
        <p>Elige el paciente para abrir la ficha de consulta.</p>
      </div>
      <input class="search" data-search="consult-patients" placeholder="Buscar paciente..." />
      <div class="list" id="consultPatientList">${consultPatientCards(state.patients)}</div>
      <section class="form-section">
        <h2>Consultas registradas</h2>
        <div class="list">${consultCards(filterConsults(allConsults()))}</div>
      </section>
    </div>
  `;
}

function History() {
  const all = allConsults();
  return `
    <div class="stack">
      <div class="toolbar two">
        ${patientSelect("historyPatient", selectedPatientId, "Todos los pacientes")}
        <input class="search" data-search="history" type="date" />
      </div>
      <div class="list" id="historyList">${consultCards(filterConsults(all))}</div>
    </div>
  `;
}

function Plants() {
  const editing = state.plantas.find((p) => p.id === editingPlantId) || {};
  return `
    <div class="stack">
      <div class="page-title">
        <h1>Boticario</h1>
        <p>Vademecum argentino con lectura ayurvedica.</p>
      </div>
      <div class="toolbar">
        <input class="search" data-search="plants" placeholder="Buscar planta, dosha o efecto..." />
        <button class="fab small" data-action="plant-form" aria-label="Nueva planta">+</button>
      </div>
      <div class="list" id="plantList">${plantCards(state.plantas)}</div>
      <div class="form-section" id="plantForm" ${plantFormOpen ? "" : "hidden"}>
        <h2>${editingPlantId ? "Modificar planta" : "Nueva planta"}</h2>
        ${fields(fieldGroups.plant, editing)}
        <button class="primary" data-action="save-plant">${editingPlantId ? "Guardar cambios" : "Guardar planta"}</button>
      </div>
    </div>
  `;
}

function Calendar() {
  const upcoming = [...state.turnos].sort((a, b) => `${a.fecha} ${a.hora}`.localeCompare(`${b.fecha} ${b.hora}`));
  const days = monthDays();
  return `
    <div class="stack">
      <div class="page-title">
        <h1>Calendario</h1>
        <p>Agenda local preparada para conectar Google Calendar.</p>
      </div>
      <section class="calendar-grid panel">
        ${["L", "M", "M", "J", "V", "S", "D"].map((d) => `<b>${d}</b>`).join("")}
        ${days.map((day) => `<span class="${day.today ? "today" : ""} ${day.hasTurno ? "busy" : ""}">${day.label}</span>`).join("")}
      </section>
      <section class="form-section">
        <h2>Nuevo turno</h2>
        ${patientSelect("calendarPatient", selectedPatientId)}
        <div class="split">
          <label class="field">Fecha<input id="turnoFecha" type="date" /></label>
          <label class="field">Hora<input id="turnoHora" type="time" /></label>
        </div>
        <label class="field">Motivo<input id="turnoMotivo" placeholder="Consulta Ayurveda, coaching..." /></label>
        <button class="primary" data-action="save-turno">Guardar turno local</button>
        <p class="hint">Luego este modulo se conecta con Google Calendar para sincronizar crear, editar y cancelar turnos.</p>
      </section>
      <div class="list">${upcoming.length ? upcoming.map(turnoCard).join("") : `<p class="empty">Aun no hay turnos locales.</p>`}</div>
    </div>
  `;
}

function Suggestions() {
  const draft = buildSuggestion();
  return `
    <div class="stack">
      ${patientSelect("suggestionPatient", selectedPatientId)}
      <label class="field">Sugerencia final<textarea id="suggestionText">${escapeHtml(draft)}</textarea></label>
      <div class="actions">
        <button class="ghost" data-action="copy-suggestion">Copiar texto</button>
        <button class="ghost" data-action="whatsapp">WhatsApp</button>
        <button class="ghost" data-action="email">Email</button>
        <button class="primary full" data-action="save-suggestion">Guardar en historial</button>
      </div>
    </div>
  `;
}

function Settings() {
  return `
    <div class="stack">
      <section class="form-section">
        <h2>Respaldo local</h2>
        <p class="hint">Exporta una copia de pacientes, consultas, turnos, sugerencias y boticario. Importala si cambias de celular o navegador.</p>
        <div class="actions plain">
          <button class="ghost" data-action="export-backup">Exportar respaldo</button>
          <label class="ghost file-action">Importar respaldo<input data-action="import-backup" type="file" accept="application/json" /></label>
        </div>
      </section>
      <section class="form-section">
        <h2>APK y modo offline</h2>
        <p class="hint">La app ya incluye manifest y service worker basico para instalar como PWA o empaquetar con Capacitor.</p>
      </section>
      <section class="form-section">
        <h2>Seguridad</h2>
        <p class="hint">Cada registro guarda terapeutaId. Las reglas de seguridad deben filtrar por usuario autenticado.</p>
        <button class="danger" data-action="clear-demo">Borrar datos demo</button>
      </section>
    </div>
  `;
}

function fields(list, values = {}) {
  const today = new Date().toISOString().slice(0, 10);
  return list.map(([name, label, type = "text"]) => {
    const current = values[name] || (name === "fecha" ? today : "");
    const value = ` value="${escapeHtml(current)}"`;
    if (type === "textarea") return `<label class="field">${label}<textarea name="${name}">${escapeHtml(current)}</textarea></label>`;
    if (type === "file") {
      return `
        <label class="field">${label}
          ${current ? `<img class="image-preview" src="${escapeHtml(current)}" alt="${escapeHtml(label)}" />` : ""}
          <input name="${name}" type="file" accept="image/*" capture="environment" />
          <input name="${name}Actual" type="hidden" value="${escapeHtml(current)}" />
        </label>
      `;
    }
    if (type.startsWith("select:")) {
      return `<label class="field">${label}<select name="${name}">${type.slice(7).split("|").map((item) => `<option ${item === current ? "selected" : ""}>${item}</option>`).join("")}</select></label>`;
    }
    return `<label class="field">${label}<input name="${name}" type="${type}"${value} /></label>`;
  }).join("");
}

function navigate(nextView) {
  view = nextView;
  drawerOpen = false;
  history.pushState({ view }, "", "");
  render();
}

function patientSelect(id, value, emptyLabel = "Seleccionar paciente") {
  return `
    <label class="field">Paciente
      <select id="${id}">
        <option value="">${emptyLabel}</option>
        ${state.patients.map((p) => `<option value="${p.id}" ${p.id === value ? "selected" : ""}>${escapeHtml(p.nombre || "Sin nombre")}</option>`).join("")}
      </select>
    </label>
  `;
}

function bind() {
  document.querySelectorAll("[data-view]").forEach((el) => el.addEventListener("click", () => {
    if (el.dataset.view === "patients") {
      patientFormOpen = false;
      editingPatientId = "";
    }
    if (el.dataset.view === "plants") {
      plantFormOpen = false;
      editingPlantId = "";
    }
    navigate(el.dataset.view);
  }));
  document.querySelector("[data-action='back']")?.addEventListener("click", () => history.back());
  document.querySelector("[data-action='drawer']")?.addEventListener("click", () => {
    drawerOpen = !drawerOpen;
    render();
  });
  document.querySelector("[data-action='drawer-close']")?.addEventListener("click", () => {
    drawerOpen = false;
    render();
  });
  document.querySelector("[data-action='patient-form']")?.addEventListener("click", () => {
    editingPatientId = "";
    patientFormOpen = true;
    render();
  });
  document.querySelector("[data-action='back-consult-list']")?.addEventListener("click", () => {
    editingConsultId = "";
    navigate("consult-select");
  });
  document.querySelector("[data-action='save-patient']")?.addEventListener("click", savePatient);
  document.querySelector("[data-action='plant-form']")?.addEventListener("click", () => {
    editingPlantId = "";
    plantFormOpen = true;
    render();
  });
  document.querySelector("[data-action='save-plant']")?.addEventListener("click", savePlant);
  document.querySelector("[data-action='save-turno']")?.addEventListener("click", saveTurno);
  document.querySelectorAll("[data-consult-type]").forEach((el) => el.addEventListener("click", () => {
    consultType = el.dataset.consultType;
    render();
  }));
  ["consultPatient", "suggestionPatient", "calendarPatient", "historyPatient"].forEach((id) => {
    document.getElementById(id)?.addEventListener("change", (event) => {
      selectedPatientId = event.target.value;
      if (id === "suggestionPatient" || id === "historyPatient") render();
    });
  });
  document.querySelector("[data-action='save-consult']")?.addEventListener("submit", saveConsult);
  document.querySelector("[data-action='draft-suggestion']")?.addEventListener("click", () => {
    view = "suggestions";
    render();
  });
  document.querySelector("[data-action='copy-suggestion']")?.addEventListener("click", copySuggestion);
  document.querySelector("[data-action='whatsapp']")?.addEventListener("click", sendWhatsApp);
  document.querySelector("[data-action='email']")?.addEventListener("click", sendEmail);
  document.querySelector("[data-action='save-suggestion']")?.addEventListener("click", saveSuggestion);
  document.querySelector("[data-action='clear-demo']")?.addEventListener("click", clearDemo);
  document.querySelector("[data-action='export-backup']")?.addEventListener("click", exportBackup);
  document.querySelector("[data-action='import-backup']")?.addEventListener("change", importBackup);
  document.querySelector("[data-search='patients']")?.addEventListener("input", searchPatients);
  document.querySelector("[data-search='consult-patients']")?.addEventListener("input", searchConsultPatients);
  document.querySelector("[data-search='plants']")?.addEventListener("input", searchPlants);
  document.querySelector("[data-search='history']")?.addEventListener("input", searchHistory);
  document.querySelectorAll("[data-patient-action]").forEach((el) => el.addEventListener("click", patientAction));
  document.querySelectorAll("[data-consult-patient]").forEach((el) => el.addEventListener("click", openConsultForPatient));
  document.querySelectorAll("[data-consult-edit]").forEach((el) => el.addEventListener("click", editConsult));
  document.querySelectorAll("[data-plant-action]").forEach((el) => el.addEventListener("click", plantAction));
  document.querySelectorAll("[data-delete-turno]").forEach((el) => el.addEventListener("click", deleteTurno));
}

function savePatient() {
  const data = readForm("patientForm");
  if (!data.nombre?.trim()) return alert("Escribe el nombre del paciente");
  if (editingPatientId) {
    state.patients = state.patients.map((p) => p.id === editingPatientId ? { ...p, ...data, actualizadoEn: new Date().toISOString() } : p);
    selectedPatientId = editingPatientId;
  } else {
    data.id = createId();
    data.terapeutaId = state.session.userId;
    data.creadoEn = new Date().toISOString();
    state.patients.unshift(data);
    selectedPatientId = data.id;
  }
  editingPatientId = "";
  patientFormOpen = false;
  saveState();
  render();
}

function savePlant() {
  const form = document.getElementById("plantForm");
  const file = form.querySelector("input[name='imagen']").files[0];
  const finish = (imageData) => {
    const data = readForm("plantForm");
    data.imagen = imageData || data.imagenActual || "";
    delete data.imagenActual;
    if (!data.nombre?.trim()) return alert("Escribe el nombre de la planta");
    if (editingPlantId) {
      state.plantas = state.plantas.map((p) => p.id === editingPlantId ? { ...p, ...data, actualizadoEn: new Date().toISOString() } : p);
    } else {
      data.id = createId();
      data.creadoEn = new Date().toISOString();
      state.plantas.unshift(data);
    }
    editingPlantId = "";
    plantFormOpen = false;
    saveState();
    render();
  };
  if (file) {
    const reader = new FileReader();
    reader.onload = () => finish(reader.result);
    reader.readAsDataURL(file);
    return;
  }
  finish("");
}

function saveConsult(event) {
  event.preventDefault();
  if (!selectedPatientId) return alert("Selecciona un paciente");
  const data = Object.fromEntries(new FormData(event.target).entries());
  const key = consultType === "ayurveda" ? "consultas_ayurveda" : "consultas_coaching";
  if (editingConsultId) {
    state[key] = state[key].map((c) => c.id === editingConsultId ? { ...c, ...data, actualizadoEn: new Date().toISOString() } : c);
  } else {
    data.id = createId();
    data.pacienteId = selectedPatientId;
    data.terapeutaId = state.session.userId;
    data.creadoEn = new Date().toISOString();
    state[key].unshift(data);
  }
  editingConsultId = "";
  saveState();
  navigate("history");
}

function saveTurno() {
  if (!selectedPatientId) return alert("Selecciona un paciente");
  const fecha = document.getElementById("turnoFecha").value;
  const hora = document.getElementById("turnoHora").value;
  if (!fecha || !hora) return alert("Completa fecha y hora");
  const patient = state.patients.find((p) => p.id === selectedPatientId) || {};
  state.turnos.unshift({
    id: createId(),
    pacienteId: selectedPatientId,
    paciente: patient.nombre || "Paciente",
    fecha,
    hora,
    motivo: document.getElementById("turnoMotivo").value || "Consulta",
    terapeutaId: state.session.userId,
  });
  saveState();
  render();
}

function deleteTurno(event) {
  const id = event.currentTarget.dataset.deleteTurno;
  if (!confirm("Eliminar este turno?")) return;
  state.turnos = state.turnos.filter((turno) => turno.id !== id);
  saveState();
  render();
}

function patientAction(event) {
  const button = event.currentTarget;
  selectedPatientId = button.dataset.patientId;
  if (button.dataset.patientAction === "consult") {
    editingConsultId = "";
    navigate("new-consult");
    return;
  }
  if (button.dataset.patientAction === "history") {
    navigate("history");
    return;
  }
  if (button.dataset.patientAction === "edit") {
    editingPatientId = selectedPatientId;
    patientFormOpen = true;
    view = "patients";
  }
  if (button.dataset.patientAction === "whatsapp") {
    const patient = state.patients.find((p) => p.id === selectedPatientId) || {};
    const phone = (patient.telefono || "").replace(/\D/g, "");
    if (!phone) return alert("Este paciente no tiene telefono");
    window.location.href = `https://wa.me/${phone}`;
    return;
  }
  if (button.dataset.patientAction === "delete") {
    if (!confirm("Eliminar paciente y sus registros locales?")) return;
    state.patients = state.patients.filter((p) => p.id !== selectedPatientId);
    state.consultas_ayurveda = state.consultas_ayurveda.filter((c) => c.pacienteId !== selectedPatientId);
    state.consultas_coaching = state.consultas_coaching.filter((c) => c.pacienteId !== selectedPatientId);
    state.sugerencias = state.sugerencias.filter((s) => s.pacienteId !== selectedPatientId);
    state.turnos = state.turnos.filter((t) => t.pacienteId !== selectedPatientId);
    selectedPatientId = state.patients[0]?.id || "";
  }
  saveState();
  render();
}

function openConsultForPatient(event) {
  selectedPatientId = event.currentTarget.dataset.consultPatient;
  editingConsultId = "";
  navigate("new-consult");
}

function editConsult(event) {
  const button = event.currentTarget;
  consultType = button.dataset.consultType;
  editingConsultId = button.dataset.consultEdit;
  selectedPatientId = button.dataset.patientId;
  navigate("new-consult");
}

function plantAction(event) {
  const id = event.currentTarget.dataset.plantId;
  if (event.currentTarget.dataset.plantAction === "edit") {
    editingPlantId = id;
    plantFormOpen = true;
  }
  if (event.currentTarget.dataset.plantAction === "delete") {
    if (!confirm("Eliminar esta planta del boticario?")) return;
    state.plantas = state.plantas.filter((p) => p.id !== id);
    editingPlantId = "";
    plantFormOpen = false;
  }
  saveState();
  render();
}

function readForm(id) {
  const root = document.getElementById(id);
  const entries = {};
  root.querySelectorAll("input, textarea, select").forEach((input) => {
    if (input.type !== "file") entries[input.name] = input.value;
  });
  return entries;
}

function buildSuggestion() {
  const patient = state.patients.find((p) => p.id === selectedPatientId) || state.patients[0] || {};
  const lastAyurveda = state.consultas_ayurveda.find((c) => c.pacienteId === patient.id) || {};
  const lastCoaching = state.consultas_coaching.find((c) => c.pacienteId === patient.id) || {};
  return `Hola ${patient.nombre || ""}, te comparto un resumen de la consulta.\n\nTrabajamos sobre: ${lastAyurveda.motivo || lastCoaching.tema || "tu proceso actual"}.\n\nRecomendaciones ayurvedicas:\n${lastAyurveda.recomendaciones || "- Ajustar alimentacion y rutina segun tu estado actual."}\n\nInfusiones o especias:\n${lastAyurveda.infusiones || lastAyurveda.especias || "- A definir segun tolerancia."}\n\nRutina diaria:\n${lastAyurveda.dinacharya || "- Sostener una rutina simple y amable."}\n\nPractica semanal:\n${lastCoaching.accion || lastAyurveda.respiracion || "- Respirar conscientemente unos minutos al dia."}\n\nMeditacion o mantra:\n${lastAyurveda.meditacion || "- Practica breve de presencia antes de dormir."}\n\nProximo paso:\n${lastCoaching.seguimiento || "Continuar observando cambios y registrar sensaciones."}\n\nFrase final:\n${lastCoaching.frase || "Cada pequeno acto sostenido abre camino a una nueva armonia."}`;
}

async function copySuggestion() {
  await navigator.clipboard.writeText(document.getElementById("suggestionText").value);
  alert("Texto copiado");
}

function sendWhatsApp() {
  const patient = state.patients.find((p) => p.id === selectedPatientId) || state.patients[0] || {};
  const phone = (patient.telefono || "").replace(/\D/g, "");
  window.location.href = `https://wa.me/${phone}?text=${encodeURIComponent(document.getElementById("suggestionText").value)}`;
}

function sendEmail() {
  const patient = state.patients.find((p) => p.id === selectedPatientId) || state.patients[0] || {};
  window.location.href = `mailto:${patient.email || ""}?subject=${encodeURIComponent("Sugerencias de consulta")}&body=${encodeURIComponent(document.getElementById("suggestionText").value)}`;
}

function saveSuggestion() {
  if (!selectedPatientId) return alert("Selecciona un paciente");
  state.sugerencias.unshift({
    id: createId(),
    pacienteId: selectedPatientId,
    texto: document.getElementById("suggestionText").value,
    creadoEn: new Date().toISOString(),
    terapeutaId: state.session.userId,
  });
  saveState();
  alert("Sugerencia guardada");
}

function patientCards(items) {
  if (!items.length) return `<p class="empty">Aun no hay pacientes.</p>`;
  return items.map((p) => `
    <article class="card patient-card" data-patient="${p.id}">
      <header><strong>${escapeHtml(p.nombre || "Sin nombre")}</strong><small>${age(p.nacimiento)}</small></header>
      <small>${escapeHtml(p.telefono || "")} ${p.email ? " - " + escapeHtml(p.email) : ""}</small>
      <p class="meta">${escapeHtml(p.observaciones || p.antecedentes || "Sin observaciones generales")}</p>
      <div class="chips"><span class="chip">${consultCount(p.id)} consultas</span><span class="chip">${escapeHtml(p.ocupacion || "Paciente")}</span></div>
      <div class="mini-actions">
        <button data-patient-action="consult" data-patient-id="${p.id}">Consulta</button>
        <button data-patient-action="history" data-patient-id="${p.id}">Historial</button>
        <button data-patient-action="whatsapp" data-patient-id="${p.id}">WhatsApp</button>
        <button data-patient-action="edit" data-patient-id="${p.id}">Editar</button>
        <button class="danger-link" data-patient-action="delete" data-patient-id="${p.id}">Borrar</button>
      </div>
    </article>
  `).join("");
}

function consultPatientCards(items) {
  if (!items.length) return `<p class="empty">Primero agrega un paciente.</p>`;
  return items.map((p) => `
    <button class="patient-select-card" data-consult-patient="${p.id}">
      <strong>${escapeHtml(p.nombre || "Sin nombre")}</strong>
      <small>${escapeHtml(p.telefono || p.email || "Abrir consulta")}</small>
      <span>Tocar para nueva consulta - ${consultCount(p.id)} consultas</span>
    </button>
  `).join("");
}

function consultCards(items) {
  if (!items.length) return `<p class="empty">Aun no hay consultas.</p>`;
  return items.map((c) => {
    const patient = state.patients.find((p) => p.id === c.pacienteId) || {};
    const type = c.tipo === "Ayurveda" ? "ayurveda" : "coaching";
    return `
      <article class="card">
        <header><strong>${c.tipo}</strong><small>${c.fecha || "Sin fecha"}</small></header>
        <small>${escapeHtml(patient.nombre || "Paciente")}</small>
        <p class="meta">${escapeHtml(c.motivo || c.tema || "")}</p>
        <div class="mini-actions three">
          <button data-consult-edit="${c.id}" data-consult-type="${type}" data-patient-id="${c.pacienteId}">Editar</button>
          <button data-patient-action="consult" data-patient-id="${c.pacienteId}">Nueva</button>
          <button data-patient-action="history" data-patient-id="${c.pacienteId}">Historial</button>
        </div>
      </article>
    `;
  }).join("");
}

function plantCards(items) {
  if (!items.length) return `<p class="empty">Aun no hay plantas.</p>`;
  return items.map((p) => `
    <article class="card plant-card">
      ${p.imagen ? `<img src="${escapeHtml(p.imagen)}" alt="${escapeHtml(p.nombre || "Planta")}" />` : ""}
      <header><strong>${escapeHtml(p.nombre || "Planta")}</strong><small>${escapeHtml(p.cientifico || "")}</small></header>
      <p class="meta">${escapeHtml(p.accion || p.usos || "")}</p>
      <div class="chips"><span class="chip">${escapeHtml(p.equilibra || "Doshas")}</span><span class="chip">${escapeHtml(p.virya || "Virya")}</span></div>
      <div class="mini-actions two">
        <button data-plant-action="edit" data-plant-id="${p.id}">Editar</button>
        <button class="danger-link" data-plant-action="delete" data-plant-id="${p.id}">Borrar</button>
      </div>
    </article>
  `).join("");
}

function turnoCard(turno) {
  return `
    <article class="card">
      <header><strong>${escapeHtml(turno.paciente)}</strong><small>${turno.fecha} ${turno.hora}</small></header>
      <p class="meta">${escapeHtml(turno.motivo)}</p>
      <div class="mini-actions"><button data-delete-turno="${turno.id}" class="danger-link">Eliminar turno</button></div>
    </article>
  `;
}

function searchPatients(event) {
  const query = event.target.value.toLowerCase();
  document.getElementById("patientList").innerHTML = patientCards(state.patients.filter((p) => `${p.nombre} ${p.telefono} ${p.email}`.toLowerCase().includes(query)));
  document.querySelectorAll("[data-patient-action]").forEach((el) => el.addEventListener("click", patientAction));
}

function searchConsultPatients(event) {
  const query = event.target.value.toLowerCase();
  document.getElementById("consultPatientList").innerHTML = consultPatientCards(state.patients.filter((p) => `${p.nombre} ${p.telefono} ${p.email} ${p.observaciones}`.toLowerCase().includes(query)));
  document.querySelectorAll("[data-consult-patient]").forEach((el) => el.addEventListener("click", openConsultForPatient));
}

function searchPlants(event) {
  const query = event.target.value.toLowerCase();
  document.getElementById("plantList").innerHTML = plantCards(state.plantas.filter((p) => JSON.stringify(p).toLowerCase().includes(query)));
  document.querySelectorAll("[data-plant-action]").forEach((el) => el.addEventListener("click", plantAction));
}

function searchHistory(event) {
  const date = event.target.value;
  document.getElementById("historyList").innerHTML = consultCards(filterConsults(allConsults(), date));
}

function allConsults() {
  return [
    ...state.consultas_ayurveda.map((c) => ({ ...c, tipo: "Ayurveda" })),
    ...state.consultas_coaching.map((c) => ({ ...c, tipo: "Coaching" })),
  ].sort((a, b) => (b.fecha || "").localeCompare(a.fecha || ""));
}

function filterConsults(items, date = "") {
  return items.filter((c) => (!selectedPatientId || c.pacienteId === selectedPatientId) && (!date || c.fecha === date));
}

function toggle(id) {
  const el = document.getElementById(id);
  el.hidden = !el.hidden;
  if (id === "patientForm") patientFormOpen = !el.hidden;
  if (id === "plantForm") plantFormOpen = !el.hidden;
}

function clearDemo() {
  if (!confirm("Borrar datos locales de demo?")) return;
  localStorage.removeItem(STORAGE_KEY);
  state = loadState();
  selectedPatientId = "";
  view = "dashboard";
  render();
}

function exportBackup() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const date = new Date().toISOString().slice(0, 10);
  link.href = url;
  link.download = `respaldo-registro-ashram-${date}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function importBackup(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const imported = JSON.parse(reader.result);
      if (!Array.isArray(imported.patients) || !Array.isArray(imported.plantas)) throw new Error("invalid");
      state = { ...loadState(), ...imported };
      saveState();
      selectedPatientId = state.patients[0]?.id || "";
      alert("Respaldo importado");
      navigate("dashboard");
    } catch {
      alert("No pude importar ese archivo");
    }
  };
  reader.readAsText(file);
}

function consultCount(patientId) {
  return state.consultas_ayurveda.filter((c) => c.pacienteId === patientId).length + state.consultas_coaching.filter((c) => c.pacienteId === patientId).length;
}

function age(date) {
  if (!date) return "";
  const years = new Date().getFullYear() - new Date(date).getFullYear();
  return `${years} anos`;
}

function tileCopy(id) {
  return {
    patients: "Fichas e historial",
    "new-consult": "Ayurveda o coaching",
    history: "Seguimiento completo",
    plants: "Base herbal ayurvedica",
    calendar: "Turnos y agenda",
    suggestions: "Texto para enviar",
    settings: "Firebase y Google",
  }[id] || "";
}

function monthDays() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const offset = (first.getDay() + 6) % 7;
  const cells = [];
  for (let i = 0; i < offset; i += 1) cells.push({ label: "" });
  for (let day = 1; day <= last.getDate(); day += 1) {
    const date = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    cells.push({
      label: day,
      today: day === now.getDate(),
      hasTurno: state.turnos.some((t) => t.fecha === date),
    });
  }
  return cells;
}

function seedPlants() {
  return [
    { id: createId(), nombre: "Boldo", cientifico: "Peumus boldus", sanscrito: "", parte: "Hojas", rasa: "Amargo", virya: "Fria", vipaka: "Picante", gunas: "Ligero, seco", equilibra: "Pitta, Kapha", agrava: "Vata en exceso", accion: "Digestiva y hepatica", usos: "Apoyo digestivo, pesadez, cuidado hepatico.", contraindicaciones: "Evitar embarazo, lactancia y obstruccion biliar sin supervision.", preparacion: "Infusion suave de hojas.", dosis: "Orientativa segun criterio profesional." },
    { id: createId(), nombre: "Carqueja", cientifico: "Baccharis trimera", sanscrito: "", parte: "Partes aereas", rasa: "Amargo", virya: "Fria", vipaka: "Picante", gunas: "Ligera, seca", equilibra: "Pitta, Kapha", agrava: "Vata", accion: "Amarga digestiva", usos: "Digestiones lentas, apoyo hepatico y metabolico.", contraindicaciones: "Precaucion en embarazo y tratamientos hipoglucemiantes.", preparacion: "Infusion.", dosis: "Orientativa segun sensibilidad." },
    { id: createId(), nombre: "Marcela", cientifico: "Achyrocline satureioides", sanscrito: "", parte: "Flores", rasa: "Amargo, aromatico", virya: "Neutra", vipaka: "Dulce", gunas: "Ligera, suave", equilibra: "Pitta, Vata", agrava: "Kapha en exceso", accion: "Digestiva y calmante", usos: "Infusion digestiva, calma emocional suave.", contraindicaciones: "Consultar en embarazo o alergias a asteraceas.", preparacion: "Infusion de flores.", dosis: "Orientativa." },
    { id: createId(), nombre: "Cedron", cientifico: "Aloysia citriodora", sanscrito: "", parte: "Hojas", rasa: "Aromatico, levemente dulce", virya: "Fria", vipaka: "Dulce", gunas: "Ligero, suave", equilibra: "Pitta, Vata", agrava: "Kapha en exceso", accion: "Carminativa y relajante", usos: "Gases, nerviosismo, descanso.", contraindicaciones: "Usar con moderacion en hipotension.", preparacion: "Infusion.", dosis: "Orientativa." },
  ];
}

function createId() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
