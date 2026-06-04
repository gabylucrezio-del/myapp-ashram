const STORAGE_KEY = "estudioAshramLocal";
const WORKSPACE_DB = "estudioAshramWorkspace";
const WORKSPACE_STORE = "handles";
const WORKSPACE_HANDLE_KEY = "markdownRoot";
const INTERNAL_NOTE_PREFIX = "app://note/";
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyAXmRKx05nNsLum2qAtaoDPrSQhsBD7e3A",
  databaseURL: "https://ashramganesha-default-rtdb.firebaseio.com",
  storageBucket: "ashramganesha.firebasestorage.app",
};

const initialState = {
  activeApp: "launcher",
  mobileView: "editor",
  drawerOpen: false,
  prompterNoteId: "",
  prompterSpeed: 46,
  prompterFontSize: 34,
  prompterControlsOpen: true,
  mobileToolsOpen: false,
  driveFolderPath: "",
  platformEmail: "",
  platformBookCategory: "Biblioteca",
  platformBookAccess: "gratis",
  platformRefreshToken: "",
  platformStatus: "",
  documentMenuNoteId: "",
  renamingNoteId: "",
  renamingFolderId: "",
  movingNoteId: "",
  linkPanelOpen: false,
  createMenuFolderId: "",
  creatingFolder: false,
  creatingFolderKind: "folder",
  creatingFolderAfterId: "",
  creatingNoteFolderId: "",
  creatingNoteType: "",
  exportPanel: null,
  aiPanelOpen: false,
  bookMeta: {},
  expandedFolders: ["satsang", "investigacion", "teleprompter", "libros"],
  selectedFolderId: "satsang",
  selectedNoteId: "n1",
  folders: [
    { id: "satsang", name: "Satsang" },
    { id: "ayurveda", name: "Ayurveda" },
    { id: "investigacion", name: "Investigacion IA" },
    { id: "teleprompter", name: "Teleprompter" },
    { id: "libros", name: "Libros en proceso" },
  ],
  notes: [
    {
      id: "n1",
      folderId: "satsang",
      type: "guion",
      title: "Guion para vivo",
      body: "<p>Respira.</p><p>Hoy compartimos una practica simple para volver al centro.</p><p>La presencia no se fuerza: se recuerda.</p>",
      updatedAt: new Date().toISOString(),
      published: false,
    },
    {
      id: "n2",
      folderId: "investigacion",
      type: "nota",
      title: "Ideas investigadas con IA",
      body: "<p><strong>Resumen</strong></p><ul><li>Rutina diaria simple.</li><li>Respiracion antes de dormir.</li><li>Alimentacion consciente segun estacion.</li></ul><p>Pendiente: convertir en articulo.</p>",
      updatedAt: new Date().toISOString(),
      published: false,
    },
  ],
};

let state = loadState();
let toastTimer = 0;
let savedEditorRange = null;
const cancelledRenames = new Set();
let treeClickTimer = 0;
let workspaceAutosaveTimer = 0;
let workspaceLoading = false;
let workspaceAutosaving = false;
let prompterRuntime = {
  playing: false,
  offset: 0,
  lastFrame: 0,
  raf: 0,
};
const app = document.getElementById("app");
document.addEventListener("selectionchange", saveEditorSelection);
initApp();

async function initApp() {
  const loaded = await loadWorkspaceOnStartup();
  if (!loaded) state.activeApp = "backup";
  render();
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    return normalizeState({ ...initialState, ...saved, activeApp: "launcher" });
  } catch {
    return normalizeState(initialState);
  }
}

function saveState() {
  normalizeState(state);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  scheduleWorkspaceAutosave();
}

function normalizeState(nextState) {
  nextState.folders = (nextState.folders || []).map((folder) => ({
    parentId: "root",
    ...folder,
    id: folder.id || createId(),
    name: folder.name || "Sin nombre",
  }));
  nextState.notes = (nextState.notes || []).map((note) => ({
    layout: "document",
    ...note,
    id: note.id || createId(),
    folderId: note.folderId || nextState.folders[0]?.id || "",
    title: note.title || "Sin titulo",
    body: normalizeInternalLinks(note.body || "<p><br></p>"),
  }));
  nextState.expandedFolders = (nextState.expandedFolders || []).filter((id) => {
    return nextState.folders.some((folder) => folder.id === id);
  });
  return nextState;
}

function render() {
  stopPrompter(false);
  if (state.activeApp === "launcher") return renderLauncher();
  if (state.activeApp === "backup") return renderBackup();
  if (state.activeApp === "teleprompter") return renderTeleprompter();
  return renderStudio();
}

function renderLauncher() {
  app.className = "app launcher-app";
  app.innerHTML = `
    <main class="launcher-screen">
      <section class="launcher-brand">
        <span class="launcher-logo" aria-hidden="true">Om</span>
        <h1>Mi Ashram</h1>
        <p>Elegi tu espacio de trabajo.</p>
      </section>
      <section class="launcher-actions">
        <button class="launcher-card" data-open-app="studio">
          <span class="launcher-icon">A</span>
          <strong>Mi Ashram</strong>
          <small>Organizar carpetas, archivos, apuntes y libros locales.</small>
        </button>
        <button class="launcher-card" data-open-app="teleprompter">
          <span class="launcher-icon">T</span>
          <strong>Teleprompter</strong>
          <small>Elegir un guion de la carpeta Teleprompter y reproducirlo.</small>
        </button>
        <button class="launcher-card" data-open-app="backup">
          <span class="launcher-icon">R</span>
          <strong>Respaldo</strong>
          <small>Configurar carpeta de Google Drive, respaldar y restaurar.</small>
        </button>
      </section>
    </main>
  `;
  bindLauncher();
}

function renderBackup() {
  app.className = "app backup-app";
  app.innerHTML = `
    <header class="topbar prompter-topbar">
      <button class="menu-btn" data-open-app="launcher">Inicio</button>
      <span class="topbar-title">
        <strong>Respaldo</strong>
        <small>Conecta tu carpeta de trabajo Markdown</small>
      </span>
      <span class="brand-logo" aria-hidden="true">R</span>
    </header>
    <main class="backup-screen">
      <section class="backup-panel">
        <div class="action-head">
          <span>
            <strong>Carpeta de respaldo</strong>
            <small>Primero elegi la carpeta donde viven tus documentos .md.</small>
          </span>
        </div>
        <label class="backup-field">
          <span>Referencia de carpeta Drive</span>
          <input data-drive-folder-path value="${escapeHtml(state.driveFolderPath || "")}" placeholder="Ej: G:\\Mi unidad\\Mi Ashram o enlace de Drive" />
        </label>
        <div class="backup-actions">
          <button class="primary" data-action="export-markdown-folder">Conectar carpeta de trabajo</button>
          <button class="ghost" data-action="import-markdown-files">Importar .md</button>
          <button class="ghost" data-action="backup-all">Respaldo JSON</button>
          <button class="ghost" data-action="restore-backup">Restaurar JSON</button>
          <button class="ghost" data-action="save-drive-config">Guardar ruta</button>
        </div>
        <p class="backup-note">La app arma el arbol con las carpetas y documentos Markdown que encuentre. Las carpetas vacias tambien aparecen. Si la carpeta esta vacia, guarda ahi los documentos actuales.</p>
      </section>
    </main>
  `;
  bindBackup();
}

function renderStudio() {
  const folder = selectedFolder();
  const note = selectedNote();
  const filteredNotes = state.notes.filter((item) => item.folderId === state.selectedFolderId);
  const noteActions = actionButtonsFor(note, folder);
  app.className = "app";
  app.innerHTML = `
    <header class="topbar">
      <button class="menu-btn" data-action="launcher" aria-label="Inicio">Inicio</button>
      <button class="menu-btn drawer-menu-btn" data-action="toggle-drawer" aria-label="Carpetas">Menu</button>
      <span class="topbar-title">
        <strong>Mi Ashram</strong>
      </span>
      <span class="brand-logo" aria-hidden="true">ॐ</span>
    </header>

    <aside class="folder-drawer ${state.drawerOpen ? "open" : ""}">
      <div class="drawer-head">
        <span><strong>Carpetas</strong><small>Archivo local</small></span>
        <button class="icon-btn" data-action="toggle-drawer">X</button>
      </div>
      <div class="folder-tree">${renderFolderTree()}</div>
    </aside>
    ${state.drawerOpen ? `<button class="scrim" data-action="toggle-drawer" aria-label="Cerrar carpetas"></button>` : ""}

    <main class="workspace">
      <aside class="panel ${state.mobileView === "carpetas" ? "mobile-active" : ""}">
        <div class="panel-head">
          <span><strong>Carpetas</strong><small>Tu archivo local</small></span>
          <button class="icon-btn" data-action="new-folder">+</button>
        </div>
        <div class="folder-tree side-folder-tree">${renderFolderTree()}</div>
      </aside>

      <section class="editor ${state.mobileView === "editor" ? "mobile-active" : ""}">
        <div class="editor-head">
          <span>
            <strong>Escribir</strong>
            <small>${escapeHtml(folder?.name || "Sin carpeta")} - guardado local automatico</small>
          </span>
        </div>
        <div class="editor-meta">
          <input class="title-input" data-field="title" value="${escapeHtml(note?.title || "")}" placeholder="Titulo" />
          <select data-field="type">
            <option value="nota" ${note?.type === "nota" ? "selected" : ""}>Nota</option>
            <option value="guion_tecnico" ${note?.type === "guion_tecnico" ? "selected" : ""}>Guion tecnico</option>
            <option value="guion_literario" ${note?.type === "guion_literario" || note?.type === "guion" ? "selected" : ""}>Guion literario</option>
            <option value="capitulo" ${note?.type === "capitulo" ? "selected" : ""}>Capitulo EPUB</option>
            <option value="blog" ${note?.type === "blog" ? "selected" : ""}>Articulo plataforma</option>
          </select>
        </div>
        <div class="editor-toolbar-wrap">
          <div class="visual-toolbar">
            <button type="button" data-format="formatBlock:h1">H1</button>
            <button type="button" data-format="formatBlock:h2">H2</button>
            <button type="button" data-format="bold">B</button>
            <button type="button" data-format="italic">I</button>
            <button type="button" data-format="underline">U</button>
            <button type="button" data-format="insertUnorderedList">Lista</button>
            <button type="button" data-format="formatBlock:blockquote">Cita</button>
            <button type="button" data-format="justifyLeft">Izq</button>
            <button type="button" data-format="justifyCenter">Centro</button>
            <button type="button" data-action="link-note">Link</button>
            <button type="button" data-font-size="10">10</button>
            <button type="button" data-font-size="12">12</button>
            <button type="button" data-font-size="14">14</button>
            <button type="button" data-font-size="16">16</button>
            <button type="button" data-font-size="18">18</button>
          </div>
        </div>
        <div class="editor-body-wrap">
          <div class="visual-editor" contenteditable="true" data-editor="body" aria-label="Editor de texto">${normalizeHtml(note?.body || "")}</div>
        </div>
        <div class="mobile-compose-bar ${state.mobileToolsOpen ? "open" : ""}">
          <button type="button" class="compose-plus" data-action="toggle-mobile-tools">+</button>
          <div class="compose-tools">
            <button type="button" data-action="teleprompter">Teleprompter</button>
            <button type="button" data-format="formatBlock:h1">H1</button>
            <button type="button" data-format="formatBlock:h2">H2</button>
            <button type="button" data-format="bold">B</button>
            <button type="button" data-action="link-note">Link</button>
            <button type="button" data-font-size="14">14</button>
            <button type="button" data-font-size="18">18</button>
          </div>
        </div>
        <div class="editor-actions">
          <button class="small-primary" data-action="open-ai">IA</button>
          <button class="small-ghost danger-text" data-action="delete-note">Borrar archivo</button>
          ${noteActions.map((item) => `<button class="${item.primary ? "small-primary" : "small-ghost"}" data-action="${item.action}">${item.label}</button>`).join("")}
        </div>
      </section>

    </main>

    <nav class="bottom-nav">
      <button data-action="toggle-drawer">Carpetas</button>
      <button class="${state.mobileView === "editor" ? "active" : ""}" data-mobile="editor">Escribir</button>
      <button data-action="teleprompter">Teleprompter</button>
      <button data-open-app="backup">Respaldo</button>
    </nav>
    ${renderAiPanel()}
    ${renderLinkPanel()}
    ${renderExportPanel()}
  `;
  bind();
}

function renderTeleprompter() {
  const folder = ensureFolder("teleprompter", "Teleprompter");
  const scripts = state.notes.filter((note) => note.folderId === folder.id && note.type === "guion_literario");
  if (!state.prompterNoteId && scripts[0]) state.prompterNoteId = scripts[0].id;
  const selected = scripts.find((note) => note.id === state.prompterNoteId) || scripts[0] || null;
  app.className = "app teleprompter-app";
  app.innerHTML = `
    <header class="topbar prompter-topbar">
      <button class="menu-btn" data-action="launcher" aria-label="Inicio">Inicio</button>
      <span class="topbar-title">
        <strong>Teleprompter</strong>
        <small>${scripts.length} guiones literarios en Teleprompter</small>
      </span>
      <button class="menu-btn" data-action="studio-tele-folder">Editar</button>
    </header>
    <main class="prompter-shell">
      <aside class="prompter-library">
        <div class="panel-head">
          <span><strong>Guion literario</strong><small>Carpeta Teleprompter</small></span>
          <button class="icon-btn" data-action="new-prompter-script">+</button>
        </div>
        <div class="note-list">
          ${scripts.map((item) => `
            <button class="note-row ${item.id === selected?.id ? "active" : ""}" data-prompter-note="${item.id}">
              <strong>${escapeHtml(item.title)}</strong>
              <small>${formatDate(item.updatedAt)} - ${wordCount(item.body)} palabras</small>
            </button>
          `).join("") || `<p class="empty">No hay guiones literarios. Toca + para crear el primero.</p>`}
        </div>
      </aside>
      <section class="prompter-stage">
        ${selected ? `
          <div class="prompter-view">
            <div class="prompter-scroll" data-prompter-scroll style="font-size: ${state.prompterFontSize}px;">
              <h2>${escapeHtml(selected.title)}</h2>
              ${normalizeHtml(selected.body)}
            </div>
          </div>
          <div class="prompter-controls ${state.prompterControlsOpen ? "" : "collapsed"}">
            <button class="primary" data-action="prompter-play">${window.MiAshramAndroid ? "Play flotante" : "Play"}</button>
            <button class="ghost" data-action="prompter-reset">Reiniciar</button>
            <label>
              <span>Velocidad</span>
              <input type="range" min="10" max="130" value="${state.prompterSpeed}" data-prompter-speed />
            </label>
            <label>
              <span>Texto</span>
              <input type="range" min="22" max="64" value="${state.prompterFontSize}" data-prompter-font />
            </label>
            <button class="ghost" data-action="toggle-prompter-controls">${state.prompterControlsOpen ? "Ocultar" : "Controles"}</button>
          </div>
        ` : `
          <div class="prompter-empty">
            <strong>Sin archivos</strong>
            <p>Crea un guion literario dentro de la carpeta Teleprompter para reproducirlo aca.</p>
            <button class="primary" data-action="new-prompter-script">Crear guion literario</button>
          </div>
        `}
      </section>
    </main>
  `;
  saveState();
  bindTeleprompter();
}

function bindLauncher() {
  document.querySelectorAll("[data-open-app]").forEach((button) => {
    button.addEventListener("click", () => {
      state.activeApp = button.dataset.openApp;
      saveState();
      render();
    });
  });
}

function bindBackup() {
  document.querySelectorAll("[data-open-app]").forEach((button) => {
    button.addEventListener("click", () => {
      state.activeApp = button.dataset.openApp;
      saveState();
      render();
    });
  });

  document.querySelector("[data-drive-folder-path]")?.addEventListener("input", (event) => {
    state.driveFolderPath = event.target.value;
    saveState();
  });

  document.querySelector("[data-action='save-drive-config']")?.addEventListener("click", () => {
    saveState();
    showToast("Ruta de respaldo guardada.");
  });

  document.querySelector("[data-action='backup-all']")?.addEventListener("click", exportFullBackup);
  document.querySelector("[data-action='restore-backup']")?.addEventListener("click", restoreBackupFromFile);
  document.querySelector("[data-action='export-markdown-folder']")?.addEventListener("click", exportMarkdownProject);
  document.querySelector("[data-action='import-markdown-files']")?.addEventListener("click", importMarkdownFiles);
}

function bind() {
  document.querySelectorAll("[data-action='launcher']").forEach((button) => {
    button.addEventListener("click", () => {
      state.activeApp = "launcher";
      state.drawerOpen = false;
      saveState();
      render();
    });
  });

  document.querySelectorAll("[data-open-app]").forEach((button) => {
    button.addEventListener("click", () => {
      state.activeApp = button.dataset.openApp;
      state.drawerOpen = false;
      saveState();
      render();
    });
  });

  document.querySelectorAll("[data-action='toggle-drawer']").forEach((button) => {
    button.addEventListener("click", () => {
      state.drawerOpen = !state.drawerOpen;
      state.mobileView = "editor";
      saveState();
      render();
    });
  });

  document.querySelector("[data-action='toggle-mobile-tools']")?.addEventListener("click", () => {
    state.mobileToolsOpen = !state.mobileToolsOpen;
    saveState();
    render();
  });

  document.querySelector("[data-action='start-folder']")?.addEventListener("click", () => {
    startInlineFolder("folder");
  });

  document.querySelectorAll("[data-create]").forEach((button) => {
    button.addEventListener("click", () => {
      const kind = button.dataset.create;
      const folderId = button.dataset.createFolder || state.selectedFolderId || state.folders[0]?.id || "";
      if (kind === "folder") return startInlineFolder("folder", folderId);
      if (kind === "book") return startInlineFolder("book", folderId);
      if (kind === "document") return startInlineNote(folderId);
      if (kind === "technical-script") return startInlineNote(folderId, "guion_tecnico");
      if (kind === "literary-script") return startInlineNote(folderId, "guion_literario");
    });
  });

  document.querySelector("[data-new-folder-input]")?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") createFolderFromInline(event.target.value);
    if (event.key === "Escape") cancelInlineFolder();
  });

  document.querySelector("[data-new-folder-input]")?.addEventListener("blur", (event) => {
    createFolderFromInline(event.target.value);
  });

  document.querySelector("[data-action='cancel-folder']")?.addEventListener("mousedown", (event) => {
    event.preventDefault();
    cancelInlineFolder();
  });

  document.querySelectorAll("[data-folder-toggle]").forEach((button) => {
    button.addEventListener("click", (event) => {
      if (state.renamingFolderId) return;
      const id = button.dataset.folderToggle;
      if (event.detail >= 2) {
        event.preventDefault();
        clearPendingTreeClick();
        startRenameFolder(id);
        return;
      }
      queueTreeClick(() => {
        state.selectedFolderId = id;
        if (state.expandedFolders.includes(id)) {
          state.expandedFolders = state.expandedFolders.filter((item) => item !== id);
        } else {
          state.expandedFolders.push(id);
        }
        saveState();
        render();
      });
    });
  });

  document.querySelectorAll("[data-folder]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedFolderId = button.dataset.folder;
      state.selectedNoteId = state.notes.find((item) => item.folderId === state.selectedFolderId)?.id || "";
      state.mobileView = "editor";
      state.drawerOpen = false;
      saveState();
      render();
    });
  });

  document.querySelectorAll("[data-rename-folder-input]").forEach((input) => {
    input.addEventListener("click", (event) => event.stopPropagation());
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        commitFolderRename(input.dataset.renameFolderInput, input.value);
      }
      if (event.key === "Escape") cancelRenameInput("folder", input.dataset.renameFolderInput);
    });
    input.addEventListener("blur", () => {
      if (consumeCancelledRename("folder", input.dataset.renameFolderInput)) return;
      commitFolderRename(input.dataset.renameFolderInput, input.value);
    });
    input.focus();
    input.select();
  });

  document.querySelectorAll("[data-folder-plus]").forEach((button) => {
    button.addEventListener("click", () => {
      const folderId = button.dataset.folderPlus;
      const compactPointer = window.matchMedia?.("(max-width: 760px)")?.matches;
      if (!compactPointer) return startInlineFolder("folder", folderId);
      state.selectedFolderId = folderId;
      state.createMenuFolderId = state.createMenuFolderId === folderId ? "" : folderId;
      state.creatingFolder = false;
      state.creatingNoteFolderId = "";
      if (!state.expandedFolders.includes(folderId)) state.expandedFolders.push(folderId);
      saveState();
      render();
    });
  });

  document.querySelector("[data-new-note-input]")?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") createNoteFromInline(event.target.value);
    if (event.key === "Escape") cancelInlineNote();
  });

  document.querySelector("[data-new-note-input]")?.addEventListener("blur", (event) => {
    createNoteFromInline(event.target.value);
  });

  document.querySelector("[data-action='cancel-note']")?.addEventListener("mousedown", (event) => {
    event.preventDefault();
    cancelInlineNote();
  });

  document.querySelectorAll("[data-note]").forEach((button) => {
    button.addEventListener("click", (event) => {
      if (state.renamingNoteId) return;
      const noteId = button.dataset.note;
      if (event.detail >= 2) {
        event.preventDefault();
        clearPendingTreeClick();
        startRenameNote(noteId);
        return;
      }
      queueTreeClick(() => {
        state.selectedNoteId = noteId;
        state.mobileView = "editor";
        state.documentMenuNoteId = "";
        saveState();
        render();
      });
    });
  });

  document.querySelectorAll("[data-note-menu]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      state.documentMenuNoteId = state.documentMenuNoteId === button.dataset.noteMenu ? "" : button.dataset.noteMenu;
      saveState();
      render();
    });
  });

  document.querySelectorAll("[data-rename-note]").forEach((button) => {
    button.addEventListener("click", () => startRenameNote(button.dataset.renameNote));
  });

  document.querySelectorAll("[data-move-note]").forEach((button) => {
    button.addEventListener("click", () => {
      state.movingNoteId = state.movingNoteId === button.dataset.moveNote ? "" : button.dataset.moveNote;
      saveState();
      render();
    });
  });

  document.querySelectorAll("[data-move-note-target]").forEach((button) => {
    button.addEventListener("click", () => moveNoteToFolder(button.dataset.moveNoteTarget, button.dataset.targetFolder));
  });

  document.querySelectorAll("[data-delete-note-id]").forEach((button) => {
    button.addEventListener("click", () => deleteNoteById(button.dataset.deleteNoteId));
  });

  document.querySelectorAll("[data-rename-note-input]").forEach((input) => {
    input.addEventListener("click", (event) => event.stopPropagation());
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        commitNoteRename(input.dataset.renameNoteInput, input.value);
      }
      if (event.key === "Escape") cancelRenameInput("note", input.dataset.renameNoteInput);
    });
    input.addEventListener("blur", () => {
      if (consumeCancelledRename("note", input.dataset.renameNoteInput)) return;
      commitNoteRename(input.dataset.renameNoteInput, input.value);
    });
    input.focus();
    input.select();
  });

  document.querySelectorAll("[data-delete-folder]").forEach((button) => {
    button.addEventListener("click", () => deleteFolder(button.dataset.deleteFolder));
  });

  document.querySelectorAll("[data-mobile]").forEach((button) => {
    button.addEventListener("click", () => {
      state.mobileView = button.dataset.mobile;
      saveState();
      render();
    });
  });

  document.querySelector("[data-action='new-folder']")?.addEventListener("click", () => {
    state.createMenuFolderId = state.createMenuFolderId === state.selectedFolderId ? "" : state.selectedFolderId;
    state.drawerOpen = true;
    saveState();
    render();
  });

  document.querySelectorAll("[data-action='new-note']").forEach((button) => {
    button.addEventListener("click", () => {
      createNote("nota");
    });
  });

  document.querySelectorAll("[data-action='new-smart']").forEach((button) => {
    button.addEventListener("click", () => {
      state.drawerOpen = true;
      state.createMenuFolderId = state.selectedFolderId || state.folders[0]?.id || "";
      saveState();
      render();
    });
  });

  document.querySelectorAll("[data-field]").forEach((field) => {
    field.addEventListener("input", () => {
      const note = selectedNote();
      if (!note) return;
      note[field.dataset.field] = field.value;
      note.updatedAt = new Date().toISOString();
      note.published = false;
      saveState();
    });
  });

  document.querySelector("[data-editor='body']")?.addEventListener("input", (event) => {
    const note = selectedNote();
    if (!note) return;
    note.body = event.currentTarget.innerHTML;
    note.updatedAt = new Date().toISOString();
    note.published = false;
    saveState();
  });

  document.querySelector("[data-editor='body']")?.addEventListener("paste", (event) => {
    pasteCleanText(event);
  });

  document.querySelector("[data-editor='body']")?.addEventListener("pointerdown", (event) => {
    const link = event.target.closest("[data-note-link]");
    if (!link) return;
    event.preventDefault();
    openLinkedNote(link.dataset.noteLink);
  });

  document.querySelector("[data-editor='body']")?.addEventListener("keyup", saveEditorSelection);
  document.querySelector("[data-editor='body']")?.addEventListener("mouseup", saveEditorSelection);

  document.querySelectorAll("[data-format]").forEach((button) => {
    button.addEventListener("mousedown", saveEditorSelection);
    button.addEventListener("click", () => applyFormat(button.dataset.format));
  });

  document.querySelectorAll("[data-action='link-note']").forEach((button) => {
    button.addEventListener("mousedown", (event) => {
      event.preventDefault();
      saveEditorSelection();
      openLinkPanel();
    });
    button.addEventListener("touchstart", (event) => {
      event.preventDefault();
      saveEditorSelection();
      openLinkPanel();
    });
  });

  document.querySelectorAll("[data-font-size]").forEach((button) => {
    button.addEventListener("mousedown", (event) => {
      event.preventDefault();
      saveEditorSelection();
      applyFontSize(button.dataset.fontSize);
    });
    button.addEventListener("touchstart", (event) => {
      event.preventDefault();
      saveEditorSelection();
      applyFontSize(button.dataset.fontSize);
    });
  });

  document.querySelector("[data-action='delete-note']")?.addEventListener("click", deleteCurrentNote);

  document.querySelectorAll("[data-action='publish']").forEach((button) => {
    button.addEventListener("click", () => {
      const note = selectedNote();
      if (!note) return;
      note.published = true;
      note.updatedAt = new Date().toISOString();
      saveState();
      showToast("Demo: esta nota quedaria subida a Firebase/plataforma.");
      render();
    });
  });

  document.querySelectorAll("[data-action='publish-post']").forEach((button) => {
    button.addEventListener("click", () => showToast("Demo: se publicaria como post en la plataforma."));
  });

  document.querySelector("[data-action='open-ai']")?.addEventListener("click", () => {
    state.aiPanelOpen = true;
    saveState();
    render();
  });

  document.querySelectorAll("[data-action='close-ai']").forEach((button) => {
    button.addEventListener("click", () => {
      state.aiPanelOpen = false;
      saveState();
      render();
    });
  });

  document.querySelectorAll("[data-action='close-link-panel']").forEach((button) => {
    button.addEventListener("click", () => {
      clearPendingLinkMarker();
      state.linkPanelOpen = false;
      saveState();
      render();
    });
  });

  document.querySelectorAll("[data-link-note-id]").forEach((button) => {
    button.addEventListener("click", () => applyNoteLink(button.dataset.linkNoteId));
  });

  document.querySelector("[data-action='create-linked-note']")?.addEventListener("click", createLinkedNoteFromSelection);

  document.querySelectorAll("[data-ai-prompt]").forEach((button) => {
    button.addEventListener("click", () => copyAiPrompt(button.dataset.aiPrompt));
  });

  document.querySelectorAll("[data-action='export-epub']").forEach((button) => {
    button.addEventListener("click", () => openBookExport("epub"));
  });

  document.querySelectorAll("[data-action='export-pdf']").forEach((button) => {
    button.addEventListener("click", () => openBookExport("pdf"));
  });

  document.querySelectorAll("[data-action='publish-book']").forEach((button) => {
    button.addEventListener("click", publishSelectedBookToPlatform);
  });

  document.querySelectorAll("[data-action='new-chapter']").forEach((button) => {
    button.addEventListener("click", createNextChapter);
  });

  document.querySelectorAll("[data-action='teleprompter']").forEach((button) => {
    button.addEventListener("click", () => {
      const note = selectedNote();
      if (note) state.prompterNoteId = note.id;
      state.activeApp = "teleprompter";
      saveState();
      render();
    });
  });

  document.querySelectorAll("[data-action='book']").forEach((button) => {
    button.addEventListener("click", () => showToast("Demo: se arma un EPUB con las notas tipo capitulo."));
  });

  document.querySelector("[data-action='backup']")?.addEventListener("click", exportBackup);

  document.querySelectorAll("[data-action='close-export']").forEach((button) => {
    button.addEventListener("click", () => {
      state.exportPanel = null;
      saveState();
      render();
    });
  });

  document.querySelectorAll("[data-book-meta]").forEach((field) => {
    field.addEventListener("input", () => updateBookMeta(field));
  });

  document.querySelectorAll("[data-platform-field]").forEach((field) => {
    field.addEventListener("input", () => {
      const key = field.dataset.platformField;
      if (key === "email") state.platformEmail = field.value.trim();
      if (key === "category") state.platformBookCategory = field.value.trim();
      if (key === "access") state.platformBookAccess = field.value;
      saveState();
    });
  });

  document.querySelector("[data-cover-input]")?.addEventListener("change", handleCoverInput);
  document.querySelectorAll("[data-export-chapter]").forEach((field) => {
    field.addEventListener("change", () => toggleExportChapter(field.dataset.exportChapter, field.checked));
  });
  document.querySelectorAll("[data-move-chapter]").forEach((button) => {
    button.addEventListener("click", () => moveExportChapter(button.dataset.moveChapter, button.dataset.direction));
  });
  document.querySelector("[data-action='download-epub']")?.addEventListener("click", exportCurrentBookAsEpub);
  document.querySelector("[data-action='download-pdf']")?.addEventListener("click", exportCurrentBookAsPdf);
}

function bindTeleprompter() {
  document.querySelectorAll("[data-action='launcher']").forEach((button) => {
    button.addEventListener("click", () => {
      state.activeApp = "launcher";
      saveState();
      render();
    });
  });

  document.querySelector("[data-action='studio-tele-folder']")?.addEventListener("click", () => {
    const folder = ensureFolder("teleprompter", "Teleprompter");
    state.activeApp = "studio";
    state.selectedFolderId = folder.id;
    state.mobileView = "editor";
    state.drawerOpen = false;
    saveState();
    render();
  });

  document.querySelectorAll("[data-prompter-note]").forEach((button) => {
    button.addEventListener("click", () => {
      state.prompterNoteId = button.dataset.prompterNote;
      prompterRuntime.offset = 0;
      saveState();
      render();
    });
  });

  document.querySelector("[data-action='new-prompter-script']")?.addEventListener("click", () => {
    const folder = ensureFolder("teleprompter", "Teleprompter");
    state.selectedFolderId = folder.id;
    state.activeApp = "studio";
    saveState();
    createNote("guion_literario", "Nuevo guion literario");
  });

  document.querySelector("[data-action='prompter-play']")?.addEventListener("click", (event) => {
    if (startNativeTeleprompter()) return;
    togglePrompterPlay(event);
  });
  document.querySelector("[data-action='prompter-reset']")?.addEventListener("click", resetPrompter);
  document.querySelector("[data-action='toggle-prompter-controls']")?.addEventListener("click", () => {
    state.prompterControlsOpen = !state.prompterControlsOpen;
    saveState();
    render();
  });

  document.querySelector("[data-prompter-speed]")?.addEventListener("input", (event) => {
    state.prompterSpeed = Number(event.target.value);
    saveState();
  });

  document.querySelector("[data-prompter-font]")?.addEventListener("input", (event) => {
    state.prompterFontSize = Number(event.target.value);
    const scroll = document.querySelector("[data-prompter-scroll]");
    if (scroll) scroll.style.fontSize = `${state.prompterFontSize}px`;
    saveState();
  });
}

function applyFormat(format) {
  const editor = document.querySelector("[data-editor='body']");
  const note = selectedNote();
  if (!editor || !note) return;
  editor.focus();
  restoreEditorSelection();
  const [command, value] = format.split(":");
  document.execCommand(command, false, value || null);
  note.body = editor.innerHTML;
  note.updatedAt = new Date().toISOString();
  note.published = false;
  saveState();
}

function saveEditorSelection() {
  const editor = document.querySelector("[data-editor='body']");
  const selection = window.getSelection();
  if (!editor || !selection || selection.rangeCount === 0) return;
  const range = selection.getRangeAt(0);
  if (!editor.contains(range.commonAncestorContainer)) return;
  savedEditorRange = range.cloneRange();
}

function restoreEditorSelection() {
  if (!savedEditorRange) return;
  const selection = window.getSelection();
  if (!selection) return;
  selection.removeAllRanges();
  selection.addRange(savedEditorRange);
}

function applyFontSize(size) {
  const editor = document.querySelector("[data-editor='body']");
  const note = selectedNote();
  if (!editor || !note || !size) return;
  editor.focus();
  restoreEditorSelection();
  document.execCommand("fontSize", false, "7");
  editor.querySelectorAll("font[size='7']").forEach((font) => {
    const span = document.createElement("span");
    span.style.fontSize = `${size}px`;
    span.innerHTML = font.innerHTML;
    font.replaceWith(span);
  });
  note.body = editor.innerHTML;
  note.updatedAt = new Date().toISOString();
  note.published = false;
  saveState();
}

function openLinkPanel() {
  saveEditorSelection();
  if (!savedEditorRange || !selectedEditorText()) {
    showToast("Seleccioná una palabra o frase para relacionar.");
    return;
  }
  markPendingLinkSelection();
  state.linkPanelOpen = true;
  saveState();
  render();
}

function applyNoteLink(noteId) {
  const note = selectedNote();
  if (!note || !noteId) return;
  const wrapper = document.createElement("div");
  wrapper.innerHTML = note.body || "";
  const marker = wrapper.querySelector("[data-pending-link]");
  if (!marker) {
    showToast("No encontré la palabra marcada.");
    return;
  }
  const text = marker.textContent || "";
  marker.outerHTML = noteLinkHtml(noteId, text);
  note.body = wrapper.innerHTML;
  note.updatedAt = new Date().toISOString();
  state.linkPanelOpen = false;
  saveState();
  render();
}

function openLinkedNote(noteId) {
  const linked = state.notes.find((note) => note.id === noteId);
  if (!linked) {
    showToast("Ese documento vinculado ya no existe.");
    return;
  }
  state.selectedFolderId = linked.folderId;
  state.selectedNoteId = linked.id;
  state.mobileView = "editor";
  if (!state.expandedFolders.includes(linked.folderId)) state.expandedFolders.push(linked.folderId);
  saveState();
  render();
}

function createLinkedNoteFromSelection() {
  const current = selectedNote();
  const wrapper = document.createElement("div");
  wrapper.innerHTML = current?.body || "";
  const marker = wrapper.querySelector("[data-pending-link]");
  const text = (marker?.textContent || selectedEditorText()).trim();
  if (!text) {
    showToast("Seleccioná una palabra o frase.");
    return;
  }
  const note = {
    id: createId(),
    folderId: state.selectedFolderId || state.folders[0]?.id || "",
    type: "nota",
    title: text,
    body: `<p>${escapeHtml(text)}</p>`,
    updatedAt: new Date().toISOString(),
    published: false,
  };
  state.notes.unshift(note);
  applyNoteLink(note.id);
}

function noteLinkHtml(noteId, text) {
  const safeId = escapeHtml(noteId || "");
  return `<a href="${INTERNAL_NOTE_PREFIX}${safeId}" class="note-link" data-note-link="${safeId}" contenteditable="false">${escapeHtml(text || "Documento")}</a>`;
}

function noteLinkHtmlFromEscaped(noteId, escapedText) {
  const safeId = escapeHtml(noteId || "");
  return `<a href="${INTERNAL_NOTE_PREFIX}${safeId}" class="note-link" data-note-link="${safeId}" contenteditable="false">${escapedText || "Documento"}</a>`;
}

function markPendingLinkSelection() {
  const editor = document.querySelector("[data-editor='body']");
  const note = selectedNote();
  const text = selectedEditorText();
  if (!editor || !note || !text) return;
  restoreEditorSelection();
  clearPendingLinkMarker(false);
  document.execCommand("insertHTML", false, `<span class="pending-note-link" data-pending-link="true">${escapeHtml(text)}</span>`);
  note.body = editor.innerHTML;
  note.updatedAt = new Date().toISOString();
}

function clearPendingLinkMarker(shouldSave = true) {
  const note = selectedNote();
  if (!note) return;
  const wrapper = document.createElement("div");
  wrapper.innerHTML = note.body || "";
  wrapper.querySelectorAll("[data-pending-link]").forEach((marker) => {
    marker.replaceWith(document.createTextNode(marker.textContent || ""));
  });
  note.body = wrapper.innerHTML;
  if (shouldSave) saveState();
}

function pasteCleanText(event) {
  const editor = event.currentTarget;
  const note = selectedNote();
  const text = event.clipboardData?.getData("text/plain");
  if (!text) return;

  event.preventDefault();
  const cleaned = text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const html = cleaned
    ? cleaned
        .split(/\n{2,}/)
        .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, " ")}</p>`)
        .join("")
    : "";

  document.execCommand("insertHTML", false, html || "<p><br></p>");
  document.execCommand("removeFormat", false, null);
  if (note) {
    note.body = editor.innerHTML;
    note.updatedAt = new Date().toISOString();
    note.published = false;
    saveState();
  }
}

function createSmartFile() {
  const kind = prompt("Que queres crear? Escribi: literario, tecnico, libro, apunte o post", "apunte");
  if (!kind) return;
  createByKind(kind.toLowerCase().trim());
}

function createByKind(kind) {
  if (kind === "guion" || kind === "literario" || kind === "guion literario") {
    const folder = ensureFolder("teleprompter", "Teleprompter");
    state.selectedFolderId = folder.id;
    return createNote("guion_literario", "Nuevo guion literario");
  }
  if (kind === "tecnico" || kind === "técnico" || kind === "guion tecnico" || kind === "guion técnico") {
    const folder = ensureFolder("teleprompter", "Teleprompter");
    state.selectedFolderId = folder.id;
    return createNote("guion_tecnico", "Nuevo guion tecnico");
  }
  if (kind === "libro") {
    const bookName = prompt("Nombre del libro", "Nuevo libro");
    if (!bookName?.trim()) return;
    const folder = { id: createId(), name: bookName.trim(), kind: "libro" };
    state.folders.push(folder);
    state.selectedFolderId = folder.id;
    return createNote("capitulo", "Capitulo 1");
  }
  if (kind === "post") {
    return createNote("blog", "Nuevo post");
  }
  const name = prompt("Nombre del apunte", "Nuevo apunte");
  if (!name?.trim()) return;
  const folder = { id: createId(), name: name.trim(), kind: "apunte" };
  state.folders.push(folder);
  state.selectedFolderId = folder.id;
  return createNote("nota", name.trim());
}

function createNote(type = "nota", title = defaultTitle(type)) {
  const folderId = state.selectedFolderId || state.folders[0]?.id || "";
  const note = {
    id: createId(),
    folderId,
    type,
    layout: "document",
    title,
    body: "<p><br></p>",
    updatedAt: new Date().toISOString(),
    published: false,
  };
  if (type === "capitulo") {
    state.notes.push(note);
  } else {
    state.notes.unshift(note);
  }
  state.selectedNoteId = note.id;
  state.mobileView = "editor";
  state.creatingNoteFolderId = "";
  saveState();
  render();
  document.querySelector("[data-editor='body']")?.focus();
}

function ensureFolder(id, name) {
  let folder = state.folders.find((item) => item.id === id);
  if (!folder) {
    folder = { id, name, parentId: "root" };
    state.folders.push(folder);
  }
  return folder;
}

function ensureFolderPath(path) {
  const parts = String(path || "Importados").split(/[\\/]+/).map((part) => part.trim()).filter(Boolean);
  let parentId = "root";
  let current = null;
  parts.forEach((part, index) => {
    const fullPath = parts.slice(0, index + 1).join("/");
    current = ensureFolder(folderIdFromPath(fullPath), part);
    current.name = part;
    current.parentId = parentId;
    current.sourceFolderPath = fullPath;
    parentId = current.id;
  });
  return current || ensureFolder("importados", "Importados");
}

function selectedFolder() {
  return state.folders.find((item) => item.id === state.selectedFolderId);
}

function selectedNote() {
  const selected = state.notes.find((item) => item.id === state.selectedNoteId);
  if (selected) return selected;
  return state.notes.find((item) => item.folderId === state.selectedFolderId) || null;
}

function countNotes(folderId) {
  return state.notes.filter((item) => item.folderId === folderId).length;
}

function countByType(type) {
  return state.notes.filter((item) => item.type === type).length;
}

function countLiteraryScripts() {
  return state.notes.filter((item) => item.type === "guion_literario").length;
}

function labelType(type) {
  return {
    nota: "Nota",
    guion: "Guion literario",
    guion_tecnico: "Guion tecnico",
    guion_literario: "Guion literario",
    capitulo: "Capitulo",
    blog: "Blog",
  }[type] || "Nota";
}

function renderFolderTree() {
  const inlineFolderLabel = state.creatingFolderKind === "book" ? "Nombre del libro EPUB" : "Nombre de carpeta";
  const inline = state.creatingFolder ? `
    <section class="tree-folder inline-folder">
      <div class="tree-folder-row active">
        <div class="tree-folder-main">
          <span class="folder-icon">v</span>
          <span class="folder-symbol"></span>
          <input data-new-folder-input value="" placeholder="${inlineFolderLabel}" />
        </div>
        <button class="tree-mini muted" data-action="cancel-folder" aria-label="Cancelar">x</button>
      </div>
    </section>
  ` : "";

  const renderFolderNode = (folder) => {
    const childFolders = state.folders.filter((item) => (item.parentId || "root") === folder.id);
    const notes = state.notes.filter((note) => note.folderId === folder.id);
    const expanded = state.expandedFolders.includes(folder.id);
    const isBook = folder.kind === "libro" || notes.some((note) => note.type === "capitulo") || childFolders.some((child) => child.kind === "libro");
    const creatingNote = state.creatingNoteFolderId === folder.id;
    const folderMenuOpen = state.createMenuFolderId === folder.id;
    const inlineAfterFolder = state.creatingFolder && state.creatingFolderAfterId === folder.id;
    const folderMain = state.renamingFolderId === folder.id ? `
      <div class="tree-folder-main renaming-item">
        <span class="folder-icon">${expanded ? "v" : ">"}</span>
        <span class="folder-symbol"></span>
        <span>
          <input data-rename-folder-input="${folder.id}" value="${escapeHtml(folder.name)}" />
          <small>${isBook ? "Libro / capitulos" : `${notes.length} archivos`}</small>
        </span>
      </div>
    ` : `
      <button class="tree-folder-main" data-folder-toggle="${folder.id}">
        <span class="folder-icon">${expanded ? "v" : ">"}</span>
        <span class="folder-symbol"></span>
        <span>
          <strong>${escapeHtml(folder.name)}</strong>
          <small>${isBook ? "Libro / capitulos" : `${notes.length} archivos`}</small>
        </span>
      </button>
    `;
    return `
      <section class="tree-folder ${folder.parentId && folder.parentId !== "root" ? "child-folder" : ""}">
        <div class="tree-folder-row ${folder.id === state.selectedFolderId ? "active" : ""}">
          ${folderMain}
          <button class="tree-mini" data-folder-plus="${folder.id}">+</button>
          <button class="tree-mini trash-btn danger-text" data-delete-folder="${folder.id}" aria-label="Borrar carpeta"><span class="trash-icon"></span></button>
        </div>
        ${folderMenuOpen ? `
          <div class="create-menu folder-create-menu">
            <button data-create="folder" data-create-folder="${folder.id}">Carpeta</button>
            <button data-create="book" data-create-folder="${folder.id}">Libro EPUB</button>
            <button data-create="document" data-create-folder="${folder.id}">Documento</button>
            <button data-create="technical-script" data-create-folder="${folder.id}">Guion tecnico</button>
            <button data-create="literary-script" data-create-folder="${folder.id}">Guion literario</button>
          </div>
        ` : ""}
        ${expanded ? `
          <div class="tree-files">
            ${inlineAfterFolder ? inline : ""}
            ${childFolders.map(renderFolderNode).join("")}
            ${creatingNote ? `
              <div class="tree-file inline-note active">
                <span>${isBook ? "Cap." : "Archivo"}</span>
                <input data-new-note-input value="" placeholder="${inlineNotePlaceholder(isBook)}" />
                <button class="tree-mini muted" data-action="cancel-note" aria-label="Cancelar">x</button>
              </div>
            ` : ""}
            ${notes.map((note, index) => `
              <div class="tree-file-wrap">
                ${state.renamingNoteId === note.id ? `
                  <div class="tree-file active renaming-item">
                    <span>${note.type === "capitulo" ? `Cap. ${index + 1}` : labelType(note.type)}</span>
                    <input data-rename-note-input="${note.id}" value="${escapeHtml(note.title)}" />
                  </div>
                ` : `
                  <button class="tree-file ${note.id === state.selectedNoteId ? "active" : ""}" data-note="${note.id}">
                    <span>${note.type === "capitulo" ? `Cap. ${index + 1}` : labelType(note.type)}</span>
                    <strong>${escapeHtml(note.title)}</strong>
                  </button>
                `}
                <button class="tree-mini" data-note-menu="${note.id}">...</button>
                ${state.documentMenuNoteId === note.id ? `
                  <div class="document-menu">
                    <button data-rename-note="${note.id}">Renombrar</button>
                    <button data-move-note="${note.id}">Mover</button>
                    <button class="danger-text" data-delete-note-id="${note.id}">Borrar</button>
                    ${state.movingNoteId === note.id ? `
                      <div class="move-menu">
                        ${state.folders.map((targetFolder) => `
                          <button data-move-note-target="${note.id}" data-target-folder="${targetFolder.id}">
                            ${escapeHtml(targetFolder.name)}
                          </button>
                        `).join("")}
                      </div>
                    ` : ""}
                  </div>
                ` : ""}
              </div>
            `).join("") || (creatingNote || childFolders.length || inlineAfterFolder ? "" : `<small class="tree-empty">Sin archivos</small>`)}
          </div>
        ` : ""}
      </section>
    `;
  };

  const rootFolders = state.folders.filter((folder) => !folder.parentId || folder.parentId === "root" || !state.folders.some((item) => item.id === folder.parentId));
  return (state.creatingFolder && !state.creatingFolderAfterId ? inline : "") + rootFolders.map(renderFolderNode).join("");
}

function renderAiPanel() {
  if (!state.aiPanelOpen) return "";
  const options = [
    ["improve", "Mejorar texto", "Claridad, calidez y estilo espiritual."],
    ["summary", "Resumir", "Idea central y puntos importantes."],
    ["post", "Convertir en post", "Texto listo para publicar."],
    ["script", "Crear guion", "Guion fluido para teleprompter."],
    ["chapter", "Ordenar capitulo", "Estructura limpia para libro."],
    ["continue", "Ideas para continuar", "Nuevos enfoques y desarrollo."],
  ];
  return `
    <section class="ai-overlay" role="dialog" aria-modal="true">
      <div class="ai-panel link-panel">
        <div class="ai-head">
          <span>
            <strong>IA con ChatGPT</strong>
            <small>Copia un pedido listo para pegar en ChatGPT</small>
          </span>
          <button class="icon-btn" data-action="close-ai">X</button>
        </div>
        <div class="ai-options link-options">
          ${options.map(([id, label, hint]) => `
            <button data-ai-prompt="${id}">
              <span>${label}</span>
              <small>${hint}</small>
            </button>
          `).join("")}
        </div>
        <div class="ai-note">
          <small>Se usa tu suscripcion de ChatGPT: la app copia el mensaje y vos lo pegas en ChatGPT.</small>
        </div>
      </div>
    </section>
  `;
}

function renderLinkPanel() {
  if (!state.linkPanelOpen) return "";
  const currentId = selectedNote()?.id || "";
  return `
    <section class="ai-overlay" role="dialog" aria-modal="true">
      <div class="ai-panel">
        <div class="ai-head">
          <span>
            <strong>Relacionar texto</strong>
            <small>Elegí un documento o crea uno nuevo desde la palabra seleccionada.</small>
          </span>
          <button class="icon-btn" data-action="close-link-panel">X</button>
        </div>
        <div class="ai-options">
          ${state.notes.filter((note) => note.id !== currentId).map((note) => `
            <button data-link-note-id="${note.id}">
              <span>${escapeHtml(note.title)}</span>
              <small>${escapeHtml(folderNameById(note.folderId))} - ${labelType(note.type)}</small>
            </button>
          `).join("") || `<p class="empty">No hay otros documentos todavía.</p>`}
        </div>
        <button class="primary" data-action="create-linked-note">Crear documento nuevo</button>
      </div>
    </section>
  `;
}

function folderNameById(folderId) {
  return state.folders.find((folder) => folder.id === folderId)?.name || "Sin carpeta";
}

function selectedEditorText() {
  if (!savedEditorRange) return "";
  return savedEditorRange.toString().trim();
}

function inlineNotePlaceholder(isBook) {
  if (isBook) return "Nombre del capitulo";
  if (state.creatingNoteType === "guion_tecnico") return "Nombre del guion tecnico";
  if (state.creatingNoteType === "guion_literario") return "Nombre del guion literario";
  return "Nombre del archivo";
}

function renderExportPanel() {
  if (!state.exportPanel) return "";
  const folder = state.folders.find((item) => item.id === state.exportPanel.folderId);
  if (!folder) return "";
  const chapters = chaptersForFolder(folder.id);
  const meta = bookMetaFor(folder);
  return `
    <section class="export-overlay" role="dialog" aria-modal="true">
      <div class="export-panel">
        <div class="export-head">
          <span>
            <strong>Exportar ${state.exportPanel.format === "pdf" ? "PDF" : "EPUB"}</strong>
            <small>${escapeHtml(folder.name)} - ${chapters.length} capitulos unidos</small>
          </span>
          <button class="icon-btn" data-action="close-export">X</button>
        </div>
        <div class="export-grid">
          <label>
            <span>Titulo del libro</span>
            <input data-book-meta="title" value="${escapeHtml(meta.title)}" placeholder="Titulo" />
          </label>
          <label>
            <span>Autor</span>
            <input data-book-meta="author" value="${escapeHtml(meta.author)}" placeholder="Tu nombre" />
          </label>
          <label class="wide">
            <span>Descripcion corta</span>
            <textarea data-book-meta="description" rows="3" placeholder="De que trata este libro">${escapeHtml(meta.description)}</textarea>
          </label>
          <label class="wide">
            <span>Imagen de portada</span>
            <input data-cover-input type="file" accept="image/*" />
          </label>
        </div>
        <div class="cover-preview">
          ${meta.cover ? `<img src="${meta.cover}" alt="Portada del libro" />` : `<div class="cover-empty">Portada</div>`}
          <span>
            <strong>${escapeHtml(meta.title || folder.name)}</strong>
            <small>${escapeHtml(meta.author || "Autor pendiente")}</small>
          </span>
        </div>
        ${state.exportPanel.format === "epub" ? `
          <div class="platform-panel">
            <strong>Subir a plataforma</strong>
            <div class="export-grid">
              <label>
                <span>Email admin</span>
                <input data-platform-field="email" value="${escapeHtml(state.platformEmail || "")}" placeholder="admin@email.com" />
              </label>
              <label>
                <span>Clave ${state.platformRefreshToken ? "(opcional)" : ""}</span>
                <input data-platform-password type="text" placeholder="${state.platformRefreshToken ? "Sesion guardada" : "Clave Firebase"}" />
              </label>
              <label>
                <span>Categoria</span>
                <input data-platform-field="category" value="${escapeHtml(state.platformBookCategory || "Biblioteca")}" placeholder="Biblioteca" />
              </label>
              <label>
                <span>Acceso</span>
                <select data-platform-field="access">
                  <option value="gratis" ${state.platformBookAccess === "gratis" ? "selected" : ""}>Gratis</option>
                  <option value="suscripcion" ${state.platformBookAccess === "suscripcion" ? "selected" : ""}>Suscripcion</option>
                  <option value="compra" ${state.platformBookAccess === "compra" ? "selected" : ""}>Compra</option>
                </select>
              </label>
            </div>
            ${state.platformStatus ? `<small class="platform-status">${escapeHtml(state.platformStatus)}</small>` : ""}
          </div>
        ` : ""}
        <div class="chapter-order">
          <strong>Capitulos para exportar</strong>
          ${chapters.map((chapter) => {
            const selectedChapters = exportChaptersForPanel();
            const checked = selectedChapters.some((item) => item.id === chapter.id);
            const order = selectedChapters.findIndex((item) => item.id === chapter.id) + 1;
            return `
              <div class="chapter-row">
                <label>
                  <input type="checkbox" data-export-chapter="${chapter.id}" ${checked ? "checked" : ""} />
                  <small>${checked ? `${order}. ` : ""}${escapeHtml(chapter.title)}</small>
                </label>
                <button class="tree-mini" data-move-chapter="${chapter.id}" data-direction="up">↑</button>
                <button class="tree-mini" data-move-chapter="${chapter.id}" data-direction="down">↓</button>
              </div>
            `;
          }).join("") || `<p class="empty">Este libro todavia no tiene capitulos.</p>`}
        </div>
        <div class="export-actions">
          <button class="small-ghost" data-action="close-export">Cancelar</button>
          <button class="small-primary" data-action="${state.exportPanel.format === "pdf" ? "download-pdf" : "download-epub"}">
            ${state.exportPanel.format === "pdf" ? "Abrir PDF" : "Descargar EPUB"}
          </button>
          ${state.exportPanel.format === "epub" ? `<button class="small-primary" data-action="publish-book">Subir a plataforma</button>` : ""}
        </div>
      </div>
    </section>
  `;
}

function createFolderFromInline(value) {
  if (!state.creatingFolder) return;
  const name = String(value || "").trim();
  if (!name) {
    cancelInlineFolder();
    return;
  }
  const folder = {
    id: createId(),
    name,
    parentId: state.creatingFolderAfterId || "root",
    ...(state.creatingFolderKind === "book" ? { kind: "libro" } : {}),
  };
  const parentFolder = state.folders.find((item) => item.id === folder.parentId);
  folder.sourceFolderPath = parentFolder
    ? `${parentFolder.sourceFolderPath || parentFolder.name}/${name}`
    : name;
  const insertIndex = state.creatingFolderAfterId
    ? state.folders.findIndex((item) => item.id === state.creatingFolderAfterId) + 1
    : state.folders.length;
  state.folders.splice(Math.max(insertIndex, 0), 0, folder);
  state.selectedFolderId = folder.id;
  state.selectedNoteId = state.notes.find((item) => item.folderId === folder.id)?.id || "";
  if (!state.expandedFolders.includes(folder.id)) state.expandedFolders.push(folder.id);
  if (parentFolder && !state.expandedFolders.includes(parentFolder.id)) state.expandedFolders.push(parentFolder.id);
  state.creatingFolder = false;
  state.createMenuFolderId = "";
  state.creatingFolderKind = "folder";
  state.creatingFolderAfterId = "";
  state.drawerOpen = false;
  saveState();
  if (folder.kind === "libro") {
    state.drawerOpen = false;
    createNote("capitulo", "Capitulo 1");
    return;
  }
  render();
}

function cancelInlineFolder() {
  state.creatingFolder = false;
  state.creatingFolderKind = "folder";
  state.creatingFolderAfterId = "";
  saveState();
  render();
}

function startInlineFolder(kind = "folder", afterFolderId = "") {
  state.creatingFolder = true;
  state.creatingFolderKind = kind;
  state.creatingFolderAfterId = afterFolderId;
  state.creatingNoteFolderId = "";
  state.createMenuFolderId = "";
  saveState();
  render();
  document.querySelector("[data-new-folder-input]")?.focus();
}

function startInlineNote(folderId, type = "") {
  if (!folderId) return;
  state.selectedFolderId = folderId;
  state.creatingFolder = false;
  state.creatingFolderAfterId = "";
  state.creatingNoteFolderId = folderId;
  state.creatingNoteType = type;
  state.createMenuFolderId = "";
  if (!state.expandedFolders.includes(folderId)) state.expandedFolders.push(folderId);
  saveState();
  render();
  document.querySelector("[data-new-note-input]")?.focus();
}

function createNoteFromInline(value) {
  const folderId = state.creatingNoteFolderId;
  if (!folderId) return;
  const title = String(value || "").trim();
  if (!title) {
    cancelInlineNote();
    return;
  }
  const folder = state.folders.find((item) => item.id === folderId);
  const type = state.creatingNoteType || (folder?.kind === "libro" ? "capitulo" : "nota");
  state.selectedFolderId = folderId;
  state.creatingNoteFolderId = "";
  state.creatingNoteType = "";
  state.drawerOpen = false;
  createNote(type, title);
}

function cancelInlineNote() {
  state.creatingNoteFolderId = "";
  state.creatingNoteType = "";
  saveState();
  render();
}

function deleteCurrentNote() {
  const note = selectedNote();
  if (!note) return;
  deleteNoteById(note.id);
}

async function deleteNoteById(noteId) {
  const note = state.notes.find((item) => item.id === noteId);
  if (!note || !confirm(`Borrar "${note.title}"?`)) return;
  await deleteNoteFromWorkspace(note);
  state.notes = state.notes.filter((item) => item.id !== noteId);
  state.documentMenuNoteId = "";
  state.selectedNoteId = state.notes.find((item) => item.folderId === state.selectedFolderId)?.id || state.notes[0]?.id || "";
  saveState();
  render();
}

function startRenameNote(noteId) {
  const note = state.notes.find((item) => item.id === noteId);
  if (!note) return;
  state.renamingNoteId = noteId;
  state.documentMenuNoteId = "";
  saveState();
  render();
}

function startRenameFolder(folderId) {
  const folder = state.folders.find((item) => item.id === folderId);
  if (!folder) return;
  state.renamingFolderId = folderId;
  state.createMenuFolderId = "";
  saveState();
  render();
}

function queueTreeClick(callback) {
  clearPendingTreeClick();
  treeClickTimer = setTimeout(() => {
    treeClickTimer = 0;
    callback();
  }, 320);
}

function clearPendingTreeClick() {
  if (!treeClickTimer) return;
  clearTimeout(treeClickTimer);
  treeClickTimer = 0;
}

function commitNoteRename(noteId, value) {
  const note = state.notes.find((item) => item.id === noteId);
  if (!note) return cancelInlineRename();
  const title = String(value || "").trim();
  if (title) note.title = title;
  note.updatedAt = new Date().toISOString();
  state.renamingNoteId = "";
  state.documentMenuNoteId = "";
  saveState();
  render();
}

function commitFolderRename(folderId, value) {
  const folder = state.folders.find((item) => item.id === folderId);
  if (!folder) return cancelInlineRename();
  const name = String(value || "").trim();
  if (name) folder.name = name;
  state.renamingFolderId = "";
  saveState();
  render();
}

function cancelRenameInput(type, id) {
  cancelledRenames.add(`${type}:${id}`);
  cancelInlineRename();
}

function consumeCancelledRename(type, id) {
  const key = `${type}:${id}`;
  if (!cancelledRenames.has(key)) return false;
  cancelledRenames.delete(key);
  return true;
}

function cancelInlineRename() {
  state.renamingNoteId = "";
  state.renamingFolderId = "";
  saveState();
  render();
}

function moveNoteToFolder(noteId, folderId) {
  const note = state.notes.find((item) => item.id === noteId);
  if (!note) return;
  const folder = state.folders.find((item) => item.id === folderId);
  if (!folder) return;
  note.folderId = folder.id;
  note.updatedAt = new Date().toISOString();
  state.selectedFolderId = folder.id;
  state.selectedNoteId = note.id;
  state.documentMenuNoteId = "";
  state.movingNoteId = "";
  saveState();
  render();
}

async function deleteFolder(folderId) {
  const folder = state.folders.find((item) => item.id === folderId);
  if (!folder) return;
  if (!confirm(`Borrar la carpeta "${folder.name}" y sus archivos?`)) return;
  const idsToDelete = collectFolderDescendantIds(folderId);
  await deleteFolderFromWorkspace(folder);
  state.folders = state.folders.filter((item) => !idsToDelete.includes(item.id));
  state.notes = state.notes.filter((item) => !idsToDelete.includes(item.folderId));
  state.selectedFolderId = state.folders[0]?.id || "";
  state.selectedNoteId = state.notes.find((item) => item.folderId === state.selectedFolderId)?.id || state.notes[0]?.id || "";
  state.expandedFolders = state.expandedFolders.filter((item) => !idsToDelete.includes(item));
  saveState();
  render();
}

function collectFolderDescendantIds(folderId) {
  const ids = [folderId];
  state.folders
    .filter((folder) => folder.parentId === folderId)
    .forEach((folder) => ids.push(...collectFolderDescendantIds(folder.id)));
  return ids;
}

function defaultTitle(type) {
  return {
    nota: "Nueva nota",
    guion: "Nuevo guion literario",
    guion_tecnico: "Nuevo guion tecnico",
    guion_literario: "Nuevo guion literario",
    capitulo: "Nuevo capitulo",
    blog: "Nuevo articulo",
  }[type] || "Nueva nota";
}

function actionButtonsFor(note, folder = selectedFolder()) {
  const isBook = isBookFolder(folder, note);
  if (isBook) {
    return [
      { action: "new-chapter", label: "Nuevo capitulo", primary: true },
      { action: "export-epub", label: "Exportar EPUB" },
      { action: "publish-book", label: "Subir plataforma", primary: true },
      { action: "export-pdf", label: "PDF" },
      { action: "backup", label: "Respaldo" },
    ];
  }
  if (!note) return [{ action: "backup", label: "Respaldo" }];
  if (note.type === "guion_literario" || note.type === "guion") {
    return [
      { action: "teleprompter", label: "Enviar a teleprompter", primary: true },
      { action: "backup", label: "Respaldo" },
    ];
  }
  if (note.type === "guion_tecnico") {
    return [
      { action: "backup", label: "Respaldo" },
    ];
  }
  if (note.type === "blog") {
    return [
      { action: "publish-post", label: "Publicar post", primary: true },
      { action: "backup", label: "Respaldo" },
    ];
  }
  return [
    { action: "publish-post", label: "Publicar como post" },
    { action: "backup", label: "Respaldo" },
  ];
}

function isBookFolder(folder, note = null) {
  if (!folder) return false;
  if (folder.kind === "libro") return true;
  if (note?.type === "capitulo" && note.folderId === folder.id) return true;
  if (chaptersForFolder(folder.id).length > 0) return true;
  const parent = state.folders.find((item) => item.id === folder.parentId);
  const path = `${parent?.name || ""}/${folder.sourceFolderPath || folder.name || ""}`.toLowerCase();
  return path.includes("libro");
}

function copyAiPrompt(kind) {
  const note = selectedNote();
  if (!note) return;
  const folder = state.folders.find((item) => item.id === note.folderId);
  const text = htmlToPlainText(note.body).trim();
  const prompt = buildAiPrompt(kind, note, folder, text);
  copyText(prompt);
  showToast("Pedido copiado para pegar en ChatGPT.");
}

function buildAiPrompt(kind, note, folder, text) {
  const title = note.title || "Texto sin titulo";
  const location = folder?.name ? `Carpeta: ${folder.name}` : "";
  const base = {
    improve: "Mejora este texto manteniendo un tono espiritual, claro, humano y calido para mi Ashram Ganesha. Conserva mi idea principal y no lo vuelvas artificial.",
    summary: "Resume este texto en forma clara. Dame primero una idea central y despues puntos importantes.",
    post: "Convierte este texto en un post para mi plataforma Ashram Ganesha. Que sea simple, profundo y cercano. Agrega un titulo sugerido.",
    script: "Convierte este texto en un guion para teleprompter. Usalo para un video hablado, con frases naturales y pausas sugeridas.",
    chapter: "Ordena este texto como capitulo de un libro EPUB. Crea subtitulos, mejora la continuidad y conserva el sentido espiritual.",
    continue: "Dame ideas para continuar este texto. Sugeri enfoques, preguntas y posibles secciones nuevas.",
  }[kind] || "Ayudame con este texto.";
  return `${base}

Titulo: ${title}
${location}

Texto:
${text || "(Todavia no escribi contenido. Ayudame a empezar desde el titulo.)"}`;
}

function htmlToPlainText(value) {
  const root = document.createElement("div");
  root.innerHTML = normalizeHtml(value);
  return root.innerText || root.textContent || "";
}

function wordCount(value) {
  return htmlToPlainText(value).trim().split(/\s+/).filter(Boolean).length;
}

function togglePrompterPlay(event) {
  if (prompterRuntime.playing) {
    stopPrompter();
    if (event?.target) event.target.textContent = "Play";
    return;
  }
  prompterRuntime.playing = true;
  prompterRuntime.lastFrame = performance.now();
  if (event?.target) event.target.textContent = "Pausa";
  prompterRuntime.raf = requestAnimationFrame(tickPrompter);
}

function startNativeTeleprompter() {
  const bridge = window.MiAshramAndroid;
  if (!bridge?.startTeleprompter) return false;
  const note = state.notes.find((item) => item.id === state.prompterNoteId);
  if (!note) {
    showToast("Elegí un archivo de la carpeta Teleprompter.");
    return true;
  }
  const text = htmlToPlainText(note.body).trim();
  bridge.startTeleprompter(note.title || "Guion", text);
  showToast("Teleprompter flotante iniciado.");
  return true;
}

function tickPrompter(now) {
  if (!prompterRuntime.playing) return;
  const scroll = document.querySelector("[data-prompter-scroll]");
  if (!scroll) return stopPrompter(false);
  const delta = Math.max(0, now - prompterRuntime.lastFrame) / 1000;
  prompterRuntime.lastFrame = now;
  prompterRuntime.offset += state.prompterSpeed * delta;
  scroll.style.transform = `translateY(${-prompterRuntime.offset}px)`;
  prompterRuntime.raf = requestAnimationFrame(tickPrompter);
}

function stopPrompter(updateButton = true) {
  prompterRuntime.playing = false;
  if (prompterRuntime.raf) cancelAnimationFrame(prompterRuntime.raf);
  prompterRuntime.raf = 0;
  if (updateButton) {
    const button = document.querySelector("[data-action='prompter-play']");
    if (button) button.textContent = "Play";
  }
}

function resetPrompter() {
  stopPrompter();
  prompterRuntime.offset = 0;
  const scroll = document.querySelector("[data-prompter-scroll]");
  if (scroll) scroll.style.transform = "translateY(0)";
}

async function copyText(value) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return;
    }
  } catch {
    // Fallback below.
  }
  const field = document.createElement("textarea");
  field.value = value;
  field.setAttribute("readonly", "");
  field.style.position = "fixed";
  field.style.left = "-9999px";
  document.body.appendChild(field);
  field.select();
  document.execCommand("copy");
  field.remove();
}

function createNextChapter() {
  const note = selectedNote();
  const selected = selectedFolder();
  const folderId = isBookFolder(selected, note) ? selected.id : note?.folderId || state.selectedFolderId;
  const folder = state.folders.find((item) => item.id === folderId);
  if (!folder) return;
  folder.kind = "libro";
  const chapters = chaptersForFolder(folder.id);
  state.selectedFolderId = folder.id;
  state.drawerOpen = false;
  if (!state.expandedFolders.includes(folder.id)) state.expandedFolders.push(folder.id);
  createNote("capitulo", `Capitulo ${chapters.length + 1}`);
  showToast("Nuevo capitulo agregado al libro.");
}

function openBookExport(format) {
  const note = selectedNote();
  const selected = selectedFolder();
  const folderId = isBookFolder(selected, note) ? selected.id : note?.folderId || state.selectedFolderId;
  const folder = state.folders.find((item) => item.id === folderId);
  if (!folder) return;
  folder.kind = "libro";
  if (!chaptersForFolder(folder.id).length) {
    showToast("Primero crea capitulos dentro del libro.");
    return;
  }
  state.exportPanel = {
    folderId: folder.id,
    format,
    chapterIds: chaptersForFolder(folder.id).map((chapter) => chapter.id),
  };
  state.bookMeta[folder.id] = bookMetaFor(folder);
  saveState();
  render();
}

function selectedBookForPublish() {
  const note = selectedNote();
  const folder = selectedFolder();
  const folderId = isBookFolder(folder, note) ? folder.id : note?.folderId || state.selectedFolderId;
  const bookFolder = state.folders.find((item) => item.id === folderId);
  if (!bookFolder) return null;
  const chapters = chaptersForFolder(bookFolder.id);
  if (!chapters.length) {
    showToast("Primero crea capitulos dentro del libro.");
    return null;
  }
  bookFolder.kind = "libro";
  return { folder: bookFolder, chapters, meta: bookMetaFor(bookFolder) };
}

async function publishSelectedBookToPlatform() {
  const book = state.exportPanel ? currentExportBook() : selectedBookForPublish();
  if (!book) return;
  const email = document.querySelector("[data-platform-field='email']")?.value?.trim() || state.platformEmail || "";
  const password = document.querySelector("[data-platform-password]")?.value || "";
  const category = document.querySelector("[data-platform-field='category']")?.value?.trim() || state.platformBookCategory || "Biblioteca";
  const access = document.querySelector("[data-platform-field='access']")?.value || state.platformBookAccess || "gratis";
  if (!email) {
    showToast("Completa el email admin.");
    return;
  }
  state.platformEmail = email;
  state.platformBookCategory = category;
  state.platformBookAccess = access;
  state.platformStatus = "Preparando subida...";
  saveState();

  try {
    showToast("Subiendo EPUB a plataforma...");
    state.platformStatus = "Iniciando sesion admin...";
    saveState();
    const auth = await getPlatformAuth(email, password);
    state.platformStatus = "Armando EPUB...";
    saveState();
    const blob = makeZip(buildEpubFiles(book), "application/epub+zip");
    const epubPath = `biblioteca/epubs/${new Date().toISOString().slice(0, 10)}_${createId()}.epub`;
    state.platformStatus = "Subiendo EPUB a Firebase Storage...";
    saveState();
    const epubUpload = await uploadBlobToFirebaseStorage(blob, epubPath, "application/epub+zip", auth.idToken);
    let coverUpload = { url: "", path: "" };
    if (book.meta.cover) {
      const coverInfo = imageInfoFromDataUrl(book.meta.cover);
      if (coverInfo) {
        const coverBlob = new Blob([coverInfo.bytes], { type: coverInfo.mediaType });
        const coverPath = `biblioteca/portadas/${new Date().toISOString().slice(0, 10)}_${createId()}.${imageExtensionFromDataUrl(book.meta.cover)}`;
        state.platformStatus = "Subiendo portada...";
        saveState();
        coverUpload = await uploadBlobToFirebaseStorage(coverBlob, coverPath, coverInfo.mediaType, auth.idToken);
      }
    }
    state.platformStatus = "Creando registro en Biblioteca...";
    saveState();
    const payload = {
      titulo: book.meta.title || book.folder.name,
      autor: book.meta.author || "Mi Ashram",
      descripcion: book.meta.description || "",
      categoria: state.platformBookCategory,
      acceso: state.platformBookAccess,
      fecha_creacion: new Date().toISOString(),
      epub: epubUpload.url,
      epub_url: epubUpload.url,
      epub_path: epubUpload.path,
      epub_title: book.meta.title || book.folder.name,
      epub_chapters: book.chapters.map((chapter, index) => ({
        href: `chapter-${index + 1}.xhtml`,
        title: chapter.title || `Capitulo ${index + 1}`,
        html: htmlToEpub(chapter.body),
      })),
      imagen: coverUpload.url,
      portada_url: coverUpload.url,
      portada_path: coverUpload.path,
      pdf: "",
      pdf_url: "",
      pdf_path: "",
    };
    const saved = await pushFirebaseDatabase("libros", payload, auth.idToken);
    book.folder.platformBookId = saved.name || saved.key || "";
    state.platformStatus = "Libro subido correctamente.";
    saveState();
    showToast("Libro subido a la plataforma.");
  } catch (error) {
    console.error("Error al subir libro", error);
    state.platformStatus = error.message || "No se pudo subir el libro.";
    saveState();
    render();
    showToast(state.platformStatus);
  }
}

async function firebaseSignIn(email, password) {
  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_CONFIG.apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(firebaseAuthMessage(data));
  state.platformRefreshToken = data.refreshToken || "";
  saveState();
  return data;
}

async function getPlatformAuth(email, password) {
  if (state.platformRefreshToken) {
    try {
      return await firebaseRefreshSession();
    } catch {
      state.platformRefreshToken = "";
      saveState();
    }
  }
  if (!password) throw new Error("Completa la clave admin para iniciar sesion.");
  return firebaseSignIn(email, password);
}

async function firebaseRefreshSession() {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: state.platformRefreshToken,
  });
  const response = await fetch(`https://securetoken.googleapis.com/v1/token?key=${FIREBASE_CONFIG.apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const data = await response.json();
  if (!response.ok) throw new Error(firebaseAuthMessage(data));
  state.platformRefreshToken = data.refresh_token || state.platformRefreshToken;
  saveState();
  return {
    idToken: data.id_token,
    refreshToken: data.refresh_token,
    email: state.platformEmail,
  };
}

async function uploadBlobToFirebaseStorage(blob, path, contentType, idToken) {
  const downloadToken = createId();
  const response = await fetch(`https://firebasestorage.googleapis.com/v0/b/${FIREBASE_CONFIG.storageBucket}/o?uploadType=media&name=${encodeURIComponent(path)}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${idToken}`,
      "Content-Type": contentType,
      "x-goog-meta-firebaseStorageDownloadTokens": downloadToken,
    },
    body: blob,
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error?.message || "Firebase Storage rechazo la subida.");
  const token = data.downloadTokens || data.metadata?.firebaseStorageDownloadTokens || downloadToken;
  return {
    path,
    url: firebaseDownloadUrl(path, token),
  };
}

async function pushFirebaseDatabase(path, payload, idToken) {
  const response = await fetch(`${FIREBASE_CONFIG.databaseURL}/${path}.json?auth=${encodeURIComponent(idToken)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error || "Firebase Database rechazo la publicacion.");
  return data;
}

function firebaseDownloadUrl(path, token) {
  const base = `https://firebasestorage.googleapis.com/v0/b/${FIREBASE_CONFIG.storageBucket}/o/${encodeURIComponent(path)}?alt=media`;
  return token ? `${base}&token=${encodeURIComponent(token)}` : base;
}

function firebaseAuthMessage(data) {
  const message = data?.error?.message || "";
  if (message.includes("INVALID_LOGIN_CREDENTIALS") || message.includes("INVALID_PASSWORD")) return "Email o clave incorrecta.";
  if (message.includes("EMAIL_NOT_FOUND")) return "No encontre ese email en Firebase.";
  return message || "No se pudo iniciar sesion en Firebase.";
}

function chaptersForFolder(folderId) {
  return state.notes.filter((note) => note.folderId === folderId && note.type === "capitulo");
}

function exportChaptersForPanel() {
  const panel = state.exportPanel;
  if (!panel) return [];
  const chapters = chaptersForFolder(panel.folderId);
  const ids = Array.isArray(panel.chapterIds) && panel.chapterIds.length
    ? panel.chapterIds
    : chapters.map((chapter) => chapter.id);
  return ids
    .map((id) => chapters.find((chapter) => chapter.id === id))
    .filter(Boolean);
}

function toggleExportChapter(chapterId, checked) {
  const panel = state.exportPanel;
  if (!panel) return;
  const current = Array.isArray(panel.chapterIds) ? [...panel.chapterIds] : chaptersForFolder(panel.folderId).map((chapter) => chapter.id);
  panel.chapterIds = checked
    ? [...current.filter((id) => id !== chapterId), chapterId]
    : current.filter((id) => id !== chapterId);
  saveState();
  render();
}

function moveExportChapter(chapterId, direction) {
  const panel = state.exportPanel;
  if (!panel) return;
  const ids = Array.isArray(panel.chapterIds) ? [...panel.chapterIds] : chaptersForFolder(panel.folderId).map((chapter) => chapter.id);
  const index = ids.indexOf(chapterId);
  if (index < 0) return;
  const nextIndex = direction === "up" ? index - 1 : index + 1;
  if (nextIndex < 0 || nextIndex >= ids.length) return;
  [ids[index], ids[nextIndex]] = [ids[nextIndex], ids[index]];
  panel.chapterIds = ids;
  saveState();
  render();
}

function bookMetaFor(folder) {
  return {
    title: folder.name || "",
    author: "Mi Ashram",
    description: "",
    cover: "",
    ...(state.bookMeta?.[folder.id] || {}),
  };
}

function updateBookMeta(field) {
  const panel = state.exportPanel;
  if (!panel) return;
  const folder = state.folders.find((item) => item.id === panel.folderId);
  if (!folder) return;
  state.bookMeta[folder.id] = {
    ...bookMetaFor(folder),
    [field.dataset.bookMeta]: field.value,
  };
  saveState();
}

function handleCoverInput(event) {
  const file = event.target.files?.[0];
  const panel = state.exportPanel;
  if (!file || !panel) return;
  const folder = state.folders.find((item) => item.id === panel.folderId);
  if (!folder) return;
  const reader = new FileReader();
  reader.addEventListener("load", () => {
    state.bookMeta[folder.id] = {
      ...bookMetaFor(folder),
      cover: String(reader.result || ""),
    };
    saveState();
    render();
  });
  reader.readAsDataURL(file);
}

function exportCurrentBookAsPdf() {
  const book = currentExportBook();
  if (!book) return;
  const win = window.open("", "_blank");
  if (!win) {
    showToast("El navegador bloqueo la ventana del PDF.");
    return;
  }
  win.document.write(buildPrintableBookHtml(book));
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 300);
}

function exportCurrentBookAsEpub() {
  const book = currentExportBook();
  if (!book) return;
  const files = buildEpubFiles(book);
  const blob = makeZip(files, "application/epub+zip");
  downloadBlob(blob, `${slugify(book.meta.title || book.folder.name)}.epub`);
  showToast("EPUB descargado con portada y capitulos.");
}

function currentExportBook() {
  const panel = state.exportPanel;
  if (!panel) return null;
  const folder = state.folders.find((item) => item.id === panel.folderId);
  if (!folder) return null;
  const chapters = exportChaptersForPanel();
  if (!chapters.length) {
    showToast("Selecciona al menos un capitulo.");
    return null;
  }
  return { folder, chapters, meta: bookMetaFor(folder) };
}

function buildPrintableBookHtml(book) {
  const cover = book.meta.cover ? `<img class="cover" src="${book.meta.cover}" alt="Portada" />` : "";
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(book.meta.title)}</title>
  <style>
    body { margin: 0; color: #2f291f; font: 16px Georgia, serif; background: #fffdf8; }
    main { max-width: 760px; margin: 0 auto; padding: 42px 28px; }
    .title-page { min-height: 90vh; display: grid; align-content: center; gap: 16px; text-align: center; page-break-after: always; }
    .cover { max-width: 70%; max-height: 58vh; margin: 0 auto 24px; display: block; }
    h1, h2 { font-weight: 400; color: #44421f; }
    h1 { font-size: 36px; }
    h2 { margin-top: 0; font-size: 26px; page-break-before: always; }
    .description { color: #756b4a; line-height: 1.6; }
    .toc { page-break-after: always; }
    .chapter { line-height: 1.7; }
    @media print { main { max-width: none; } }
  </style>
</head>
<body>
  <main>
    <section class="title-page">
      ${cover}
      <h1>${escapeHtml(book.meta.title || book.folder.name)}</h1>
      <p>${escapeHtml(book.meta.author || "")}</p>
      <p class="description">${escapeHtml(book.meta.description || "")}</p>
    </section>
    <section class="toc">
      <h2>Indice</h2>
      <ol>${book.chapters.map((chapter) => `<li>${escapeHtml(chapter.title)}</li>`).join("")}</ol>
    </section>
    ${book.chapters.map((chapter) => `
      <section class="chapter">
        <h2>${escapeHtml(chapter.title)}</h2>
        ${normalizeHtml(chapter.body)}
      </section>
    `).join("")}
  </main>
</body>
</html>`;
}

function buildEpubFiles(book) {
  const coverInfo = imageInfoFromDataUrl(book.meta.cover);
  const files = [
    { name: "mimetype", data: "application/epub+zip" },
    { name: "META-INF/container.xml", data: `<?xml version="1.0" encoding="UTF-8"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>` },
    { name: "OEBPS/style.css", data: `body{font-family:serif;line-height:1.6;color:#2f291f;}h1,h2{font-weight:400;color:#44421f;}img.cover{max-width:100%;height:auto;display:block;margin:0 auto;}` },
    { name: "OEBPS/title.xhtml", data: buildEpubTitlePage(book, Boolean(coverInfo)) },
    { name: "OEBPS/nav.xhtml", data: buildEpubNav(book) },
    { name: "OEBPS/content.opf", data: buildEpubOpf(book, coverInfo) },
  ];
  if (coverInfo) files.push({ name: `OEBPS/${coverInfo.fileName}`, data: coverInfo.bytes });
  book.chapters.forEach((chapter, index) => {
    files.push({ name: `OEBPS/chapter-${index + 1}.xhtml`, data: buildEpubChapter(chapter) });
  });
  return files;
}

function buildEpubTitlePage(book, hasCover) {
  return epubPage("Portada", `
    <section>
      ${hasCover ? `<img class="cover" src="cover.${imageExtensionFromDataUrl(book.meta.cover)}" alt="Portada"/>` : ""}
      <h1>${escapeXml(book.meta.title || book.folder.name)}</h1>
      <p>${escapeXml(book.meta.author || "")}</p>
      <p>${escapeXml(book.meta.description || "")}</p>
    </section>
  `);
}

function buildEpubChapter(chapter) {
  return epubPage(chapter.title, `<h1>${escapeXml(chapter.title)}</h1>${htmlToEpub(chapter.body)}`);
}

function buildEpubNav(book) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="es">
<head><title>Indice</title><link rel="stylesheet" href="style.css"/></head>
<body><nav epub:type="toc"><h1>Indice</h1><ol>
<li><a href="title.xhtml">Portada</a></li>
${book.chapters.map((chapter, index) => `<li><a href="chapter-${index + 1}.xhtml">${escapeXml(chapter.title)}</a></li>`).join("")}
</ol></nav></body></html>`;
}

function buildEpubOpf(book, coverInfo) {
  const coverItem = coverInfo ? `<item id="cover-image" href="${coverInfo.fileName}" media-type="${coverInfo.mediaType}" properties="cover-image"/>` : "";
  const chapters = book.chapters.map((_, index) => `<item id="chapter-${index + 1}" href="chapter-${index + 1}.xhtml" media-type="application/xhtml+xml"/>`).join("");
  const spine = book.chapters.map((_, index) => `<itemref idref="chapter-${index + 1}"/>`).join("");
  return `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="book-id">
<metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
<dc:identifier id="book-id">${createId()}</dc:identifier>
<dc:title>${escapeXml(book.meta.title || book.folder.name)}</dc:title>
<dc:creator>${escapeXml(book.meta.author || "")}</dc:creator>
<dc:language>es</dc:language>
<dc:description>${escapeXml(book.meta.description || "")}</dc:description>
<meta property="dcterms:modified">${new Date().toISOString().replace(/\.\d{3}Z$/, "Z")}</meta>
</metadata>
<manifest>
<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
<item id="style" href="style.css" media-type="text/css"/>
<item id="title" href="title.xhtml" media-type="application/xhtml+xml"/>
${coverItem}
${chapters}
</manifest>
<spine>
<itemref idref="title"/>
${spine}
</spine>
</package>`;
}

function epubPage(title, body) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" lang="es">
<head><title>${escapeXml(title)}</title><link rel="stylesheet" href="style.css"/></head>
<body>${body}</body>
</html>`;
}

function exportBackup() {
  const note = selectedNote();
  const folder = state.folders.find((item) => item.id === note?.folderId);
  if (!note) {
    saveTextFile(
      `estudio-ashram-${new Date().toISOString().slice(0, 10)}.json`,
      "application/json",
      JSON.stringify(state, null, 2)
    );
    showToast("Respaldo general guardado.");
    return;
  }
  const content = `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(note.title)}</title>
  <style>
    body { max-width: 760px; margin: 0 auto; padding: 32px 22px; color: #2f291f; font: 17px/1.65 Georgia, serif; background: #fffdf8; }
    h1, h2 { color: #44421f; font-weight: 400; }
    small { color: #756b4a; }
  </style>
</head>
<body>
  <small>${escapeHtml(folder?.name || "Mi Ashram")} - ${labelType(note.type)} - ${new Date().toLocaleString("es-AR")}</small>
  <h1>${escapeHtml(note.title)}</h1>
  ${normalizeHtml(note.body)}
</body>
</html>`;
  saveTextFile(`${slugify(note.title)}-${new Date().toISOString().slice(0, 10)}.html`, "text/html", content);
  showToast("Nota guardada en el celular.");
}

function exportFullBackup() {
  const payload = {
    ...state,
    backupCreatedAt: new Date().toISOString(),
    backupFolderPath: state.driveFolderPath || "",
  };
  saveTextFile(
    `estudio-ashram-respaldo-${new Date().toISOString().slice(0, 10)}.json`,
    "application/json",
    JSON.stringify(payload, null, 2)
  );
  showToast(state.driveFolderPath ? "Respaldo local creado para subir a Drive." : "Respaldo local creado.");
}

function restoreBackupFromFile() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "application/json,.json";
  input.addEventListener("change", () => {
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      try {
        const backup = JSON.parse(String(reader.result || "{}"));
        state = { ...initialState, ...backup, activeApp: "launcher" };
        saveState();
        showToast("Respaldo restaurado.");
        render();
      } catch {
        showToast("No se pudo restaurar ese archivo.");
      }
    });
    reader.readAsText(file, "utf-8");
  });
  input.click();
}

async function exportMarkdownProject() {
  if (window.showDirectoryPicker) {
    try {
      const root = await window.showDirectoryPicker({ mode: "readwrite" });
      await saveWorkspaceHandle(root);
      const loaded = await loadMarkdownWorkspace(root, { replace: true });
      if (loaded > 0) {
        showToast(`Carpeta conectada: ${loaded} archivo(s) .md leidos.`);
      } else {
        const notes = state.notes.filter(Boolean);
        if (!notes.length) {
          showToast("Carpeta conectada. No hay archivos .md ni documentos locales.");
          return;
        }
        await writeMarkdownProjectToDirectory(root, notes);
        showToast("Carpeta vacia: documentos actuales guardados como .md.");
      }
      saveState();
      render();
      return;
    } catch (error) {
      if (error?.name === "AbortError") return;
    }
  }

  const notes = state.notes.filter(Boolean);
  notes.forEach((note, index) => {
    const folder = state.folders.find((item) => item.id === note.folderId);
    const fileName = `${String(index + 1).padStart(2, "0")}-${slugify(folder?.name || "sin-carpeta")}-${slugify(note.title || "archivo")}.md`;
    saveTextFile(fileName, "text/markdown", noteToMarkdown(note, folder));
  });
  showToast("Archivos .md exportados.");
}

async function loadWorkspaceOnStartup() {
  if (!window.showDirectoryPicker) return false;
  try {
    const root = await getWorkspaceHandle();
    if (!root) return false;
    if ((await root.queryPermission({ mode: "read" })) !== "granted") return false;
    await loadMarkdownWorkspace(root, { replace: true });
    saveState();
    return true;
  } catch {
    // Si el navegador no devuelve el permiso guardado, la app arranca con el cache local.
    return false;
  }
}

async function verifyDirectoryPermission(handle, write = false) {
  const options = { mode: write ? "readwrite" : "read" };
  if ((await handle.queryPermission(options)) === "granted") return true;
  return (await handle.requestPermission(options)) === "granted";
}

async function loadMarkdownWorkspace(root, { replace = false } = {}) {
  workspaceLoading = true;
  const imported = [];
  const folderPaths = [];
  try {
    await collectMarkdownDirectory(root, imported, folderPaths);
    const previousExpandedFolders = new Set(state.expandedFolders || []);

    if (replace) {
      state.folders = [];
      state.notes = [];
      state.expandedFolders = [];
    }

    folderPaths.forEach((folderPath) => {
      const folder = ensureFolderPath(folderPath);
      if (previousExpandedFolders.has(folder.id) && !state.expandedFolders.includes(folder.id)) {
        state.expandedFolders.push(folder.id);
      }
    });

    imported.forEach(({ content, fileName, folderPath }) => {
      importMarkdownNote(content, fileName, folderPath || root.name || "Raiz", { expand: false, sourceFileName: fileName, sourceFolderPath: folderPath });
    });

    state.selectedFolderId = state.folders[0]?.id || "";
    state.selectedNoteId = state.notes.find((item) => item.folderId === state.selectedFolderId)?.id || state.notes[0]?.id || "";
    state.expandedFolders = state.expandedFolders.filter((id) => state.folders.some((folder) => folder.id === id));
    state.mobileView = "editor";
    return imported.length;
  } finally {
    workspaceLoading = false;
  }
}

async function collectMarkdownDirectory(root, imported, folderPaths, folderPath = "") {
  for await (const [name, handle] of root.entries()) {
    if (handle.kind === "directory") {
      const nextPath = folderPath ? `${folderPath}/${name}` : name;
      folderPaths.push(nextPath);
      await collectMarkdownDirectory(handle, imported, folderPaths, nextPath);
      continue;
    }
    if (handle.kind !== "file" || !name.toLowerCase().endsWith(".md")) continue;
    const file = await handle.getFile();
    const content = await file.text();
    imported.push({ content, fileName: name, folderPath });
  }
}

async function writeMarkdownProjectToDirectory(root, notes) {
  for (const folder of state.folders) {
    const folderHandle = await getOrCreateDirectoryPath(root, folder.sourceFolderPath ?? slugify(folder.name || "sin-carpeta"));
    const folderNotes = notes.filter((note) => note.folderId === folder.id);
    for (const note of folderNotes) {
      const fileName = note.sourceFileName || `${slugify(note.title || "archivo")}.md`;
      const fileHandle = await folderHandle.getFileHandle(fileName, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(noteToMarkdown(note, folder));
      await writable.close();
      note.sourceFileName = fileName;
      note.sourceFolderPath = folder.sourceFolderPath ?? slugify(folder.name || "sin-carpeta");
    }
  }
}

async function getOrCreateDirectoryPath(root, path) {
  const parts = String(path || "sin-carpeta").split(/[\\/]+/).map((part) => part.trim()).filter(Boolean);
  let handle = root;
  for (const part of parts.length ? parts : ["sin-carpeta"]) {
    handle = await handle.getDirectoryHandle(part, { create: true });
  }
  return handle;
}

async function getDirectoryPath(root, path) {
  const parts = String(path || "").split(/[\\/]+/).map((part) => part.trim()).filter(Boolean);
  let handle = root;
  for (const part of parts) {
    handle = await handle.getDirectoryHandle(part, { create: false });
  }
  return handle;
}

async function deleteNoteFromWorkspace(note) {
  const root = await writableWorkspaceRoot();
  if (!root) return;
  try {
    const folder = state.folders.find((item) => item.id === note.folderId);
    const folderPath = note.sourceFolderPath ?? folder?.sourceFolderPath ?? "";
    const fileName = note.sourceFileName || `${slugify(note.title || "archivo")}.md`;
    const folderHandle = await getDirectoryPath(root, folderPath);
    await folderHandle.removeEntry(fileName);
  } catch {
    showToast("No pude borrar el archivo fisico. Revisa permiso de carpeta.");
  }
}

async function deleteFolderFromWorkspace(folder) {
  const root = await writableWorkspaceRoot();
  if (!root) return;
  try {
    const path = folder.sourceFolderPath || folder.name;
    const parts = String(path || "").split(/[\\/]+/).map((part) => part.trim()).filter(Boolean);
    const folderName = parts.pop();
    if (!folderName) return;
    const parentHandle = await getDirectoryPath(root, parts.join("/"));
    await parentHandle.removeEntry(folderName, { recursive: true });
  } catch {
    showToast("No pude borrar la carpeta fisica. Revisa permiso de carpeta.");
  }
}

async function writableWorkspaceRoot() {
  if (!window.showDirectoryPicker) return null;
  try {
    const root = await getWorkspaceHandle();
    if (!root) return null;
    if ((await root.queryPermission({ mode: "readwrite" })) !== "granted") return null;
    return root;
  } catch {
    return null;
  }
}

function importMarkdownFiles() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".md,text/markdown,text/plain";
  input.multiple = true;
  input.addEventListener("change", async () => {
    const files = Array.from(input.files || []);
    if (!files.length) return;
    for (const file of files) {
      const content = await file.text();
      importMarkdownNote(content, file.name, "Importados", { expand: true });
    }
    saveState();
    showToast(`${files.length} archivo(s) .md importado(s).`);
    render();
  });
  input.click();
}

function importMarkdownNote(content, fileName, fallbackFolder = "Importados", options = {}) {
  const parsed = parseMarkdownNote(content);
  const folderName = parsed.meta.folder || fallbackFolder || "Importados";
  const folder = ensureFolderPath(folderName);
  if (options.sourceFolderPath !== undefined) folder.sourceFolderPath = options.sourceFolderPath;
  const note = {
    id: parsed.meta.id || createId(),
    folderId: folder.id,
    type: parsed.meta.type || "nota",
    layout: parsed.meta.layout || "document",
    title: parsed.meta.title || fileName.replace(/\.md$/i, ""),
    body: normalizeInternalLinks(markdownToHtml(parsed.body)),
    updatedAt: parsed.meta.updatedAt || new Date().toISOString(),
    sourceFileName: options.sourceFileName || parsed.meta.sourceFileName || fileName,
    sourceFolderPath: options.sourceFolderPath ?? parsed.meta.sourceFolderPath ?? folder.sourceFolderPath ?? "",
    published: false,
  };
  const existingIndex = state.notes.findIndex((item) => item.id === note.id);
  if (existingIndex >= 0) {
    state.notes[existingIndex] = { ...state.notes[existingIndex], ...note };
  } else {
    state.notes.unshift(note);
  }
  state.selectedFolderId = folder.id;
  state.selectedNoteId = note.id;
  if (options.expand && !state.expandedFolders.includes(folder.id)) state.expandedFolders.push(folder.id);
}

function folderIdFromPath(path) {
  return slugify(String(path || "importados").replace(/[\\/]+/g, "-")) || "importados";
}

function noteToMarkdown(note, folder) {
  return `---\nid: ${note.id}\ntype: ${note.type || "nota"}\nlayout: ${note.layout || "document"}\ntitle: ${yamlSafe(note.title || "Sin titulo")}\nfolder: ${yamlSafe(folder?.sourceFolderPath || folder?.name || "Sin carpeta")}\nupdatedAt: ${note.updatedAt || new Date().toISOString()}\n---\n\n${htmlToMarkdown(note.body).trim()}\n`;
}

function scheduleWorkspaceAutosave() {
  if (workspaceLoading || workspaceAutosaving || !window.showDirectoryPicker) return;
  clearTimeout(workspaceAutosaveTimer);
  workspaceAutosaveTimer = setTimeout(() => {
    workspaceAutosaveTimer = 0;
    autosaveMarkdownWorkspace();
  }, 900);
}

async function autosaveMarkdownWorkspace() {
  if (workspaceLoading || workspaceAutosaving || !window.showDirectoryPicker) return;
  try {
    const root = await getWorkspaceHandle();
    if (!root) return;
    if ((await root.queryPermission({ mode: "readwrite" })) !== "granted") return;
    workspaceAutosaving = true;
    await writeMarkdownProjectToDirectory(root, state.notes.filter(Boolean));
  } catch {
    // El guardado manual sigue disponible si el navegador pierde permiso sobre la carpeta.
  } finally {
    workspaceAutosaving = false;
  }
}

function parseMarkdownNote(content) {
  const text = String(content || "");
  const match = text.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) return { meta: {}, body: text };
  const meta = {};
  match[1].split("\n").forEach((line) => {
    const index = line.indexOf(":");
    if (index <= 0) return;
    const key = line.slice(0, index).trim();
    const value = line.slice(index + 1).trim().replace(/^["']|["']$/g, "");
    meta[key] = value;
  });
  return { meta, body: match[2] || "" };
}

function htmlToMarkdown(value) {
  const root = document.createElement("div");
  root.innerHTML = normalizeHtml(value);
  return Array.from(root.childNodes).map(nodeToMarkdown).join("").replace(/\n{3,}/g, "\n\n").trim();
}

function nodeToMarkdown(node) {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent || "";
  if (node.nodeType !== Node.ELEMENT_NODE) return "";
  const tag = node.tagName.toLowerCase();
  const content = Array.from(node.childNodes).map(nodeToMarkdown).join("");
  if (node.hasAttribute("data-pending-link")) return content;
  if (tag === "a") {
    const noteId = noteIdFromElement(node);
    if (noteId) return `[[note:${noteId}|${content.trim() || "Documento"}]]`;
    const href = node.getAttribute("href") || "";
    return href ? `[${content.trim() || href}](${href})` : content;
  }
  if (tag === "h1") return `# ${content.trim()}\n\n`;
  if (tag === "h2") return `## ${content.trim()}\n\n`;
  if (tag === "h3") return `### ${content.trim()}\n\n`;
  if (tag === "p" || tag === "div") return `${content.trim()}\n\n`;
  if (tag === "br") return "\n";
  if (tag === "strong" || tag === "b") return `**${content}**`;
  if (tag === "em" || tag === "i") return `_${content}_`;
  if (tag === "li") return `- ${content.trim()}\n`;
  if (tag === "ul" || tag === "ol") return `${content}\n`;
  if (tag === "blockquote") return content.split("\n").map((line) => line ? `> ${line}` : "").join("\n") + "\n\n";
  return content;
}

function markdownToHtml(value) {
  const lines = String(value || "").replace(/\r\n/g, "\n").split("\n");
  const html = [];
  let paragraph = [];
  const flush = () => {
    if (!paragraph.length) return;
    html.push(`<p>${inlineMarkdown(paragraph.join(" "))}</p>`);
    paragraph = [];
  };
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      flush();
    } else if (trimmed.startsWith("# ")) {
      flush();
      html.push(`<h1>${escapeHtml(trimmed.slice(2))}</h1>`);
    } else if (trimmed.startsWith("## ")) {
      flush();
      html.push(`<h2>${escapeHtml(trimmed.slice(3))}</h2>`);
    } else if (trimmed.startsWith("- ")) {
      flush();
      html.push(`<p>${escapeHtml(trimmed.slice(2))}</p>`);
    } else {
      paragraph.push(trimmed);
    }
  }
  flush();
  return html.join("") || "<p><br></p>";
}

function inlineMarkdown(value) {
  return escapeHtml(value)
    .replace(/\[\[note:([^|\]]+)\|([^\]]+)\]\]/g, (_, noteId, text) => noteLinkHtmlFromEscaped(noteId, text))
    .replace(/\[([^\]]+)\]\(app:\/\/note\/([^)]+)\)/g, (_, text, noteId) => noteLinkHtmlFromEscaped(noteId, text))
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/_([^_]+)_/g, "<em>$1</em>");
}

function yamlSafe(value) {
  return `"${String(value || "").replace(/"/g, '\\"')}"`;
}

function openWorkspaceDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(WORKSPACE_DB, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(WORKSPACE_STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function saveWorkspaceHandle(handle) {
  const db = await openWorkspaceDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(WORKSPACE_STORE, "readwrite");
    tx.objectStore(WORKSPACE_STORE).put(handle, WORKSPACE_HANDLE_KEY);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

async function getWorkspaceHandle() {
  const db = await openWorkspaceDb();
  const handle = await new Promise((resolve, reject) => {
    const tx = db.transaction(WORKSPACE_STORE, "readonly");
    const request = tx.objectStore(WORKSPACE_STORE).get(WORKSPACE_HANDLE_KEY);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return handle;
}

function showToast(message) {
  clearTimeout(toastTimer);
  document.querySelector(".toast")?.remove();
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;
  document.body.appendChild(toast);
  toastTimer = setTimeout(() => toast.remove(), 2600);
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" });
}

function createId() {
  return crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function normalizeHtml(value) {
  const text = String(value || "");
  if (/<[a-z][\s\S]*>/i.test(text)) return normalizeInternalLinks(text);
  return text
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br>")}</p>`)
    .join("") || "<p><br></p>";
}

function normalizeInternalLinks(value) {
  const text = String(value || "");
  if (!/<[a-z][\s\S]*>/i.test(text)) return text;
  const root = document.createElement("div");
  root.innerHTML = text;
  root.querySelectorAll("a").forEach((link) => {
    const noteId = noteIdFromElement(link);
    if (!noteId) return;
    link.setAttribute("href", `${INTERNAL_NOTE_PREFIX}${noteId}`);
    link.setAttribute("data-note-link", noteId);
    link.classList.add("note-link");
    link.setAttribute("contenteditable", "false");
  });
  return root.innerHTML;
}

function noteIdFromElement(element) {
  const explicit = element.getAttribute("data-note-link");
  if (explicit) return explicit;
  const href = element.getAttribute("href") || "";
  if (href.startsWith(INTERNAL_NOTE_PREFIX)) return href.slice(INTERNAL_NOTE_PREFIX.length);
  if (href.startsWith("#note-")) return href.slice(6);
  return "";
}

function htmlToEpub(value) {
  const root = document.createElement("div");
  root.innerHTML = normalizeHtml(value);
  return Array.from(root.childNodes).map(serializeNodeForEpub).join("");
}

function serializeNodeForEpub(node) {
  if (node.nodeType === Node.TEXT_NODE) return escapeXml(node.textContent || "");
  if (node.nodeType !== Node.ELEMENT_NODE) return "";
  const tag = node.tagName.toLowerCase();
  if (tag === "br") return "<br/>";
  const allowed = ["p", "h1", "h2", "h3", "ul", "ol", "li", "blockquote", "strong", "b", "em", "i", "u", "span"];
  const safeTag = allowed.includes(tag) ? tag : "p";
  const content = Array.from(node.childNodes).map(serializeNodeForEpub).join("") || (safeTag === "p" ? "<br/>" : "");
  return `<${safeTag}>${content}</${safeTag}>`;
}

function imageInfoFromDataUrl(dataUrl) {
  if (!dataUrl) return null;
  const match = String(dataUrl).match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) return null;
  const mediaType = match[1];
  const extension = imageExtensionFromDataUrl(dataUrl);
  const binary = atob(match[2]);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return { mediaType, fileName: `cover.${extension}`, bytes };
}

function imageExtensionFromDataUrl(dataUrl) {
  const match = String(dataUrl || "").match(/^data:image\/([a-zA-Z0-9.+-]+);base64,/);
  const type = (match?.[1] || "jpeg").toLowerCase();
  if (type.includes("png")) return "png";
  if (type.includes("webp")) return "webp";
  if (type.includes("gif")) return "gif";
  return "jpg";
}

function downloadBlob(blob, fileName) {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(link.href);
}

function saveTextFile(fileName, mimeType, content) {
  if (window.MiAshramAndroid?.saveFile) {
    window.MiAshramAndroid.saveFile(fileName, mimeType, toBase64(content));
    return;
  }
  downloadBlob(new Blob([content], { type: mimeType }), fileName);
}

function toBase64(value) {
  return btoa(unescape(encodeURIComponent(String(value || ""))));
}

function slugify(value) {
  return String(value || "libro-ashram")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "libro-ashram";
}

function escapeXml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function makeZip(files, type = "application/zip") {
  const encoder = new TextEncoder();
  const chunks = [];
  const central = [];
  let offset = 0;

  files.forEach((file) => {
    const nameBytes = encoder.encode(file.name);
    const data = file.data instanceof Uint8Array ? file.data : encoder.encode(String(file.data));
    const crc = crc32(data);
    const local = new Uint8Array(30 + nameBytes.length);
    const view = new DataView(local.buffer);
    view.setUint32(0, 0x04034b50, true);
    view.setUint16(4, 20, true);
    view.setUint16(6, 0, true);
    view.setUint16(8, 0, true);
    view.setUint16(10, 0, true);
    view.setUint16(12, 0, true);
    view.setUint32(14, crc, true);
    view.setUint32(18, data.length, true);
    view.setUint32(22, data.length, true);
    view.setUint16(26, nameBytes.length, true);
    local.set(nameBytes, 30);
    chunks.push(local, data);

    const dir = new Uint8Array(46 + nameBytes.length);
    const dirView = new DataView(dir.buffer);
    dirView.setUint32(0, 0x02014b50, true);
    dirView.setUint16(4, 20, true);
    dirView.setUint16(6, 20, true);
    dirView.setUint16(8, 0, true);
    dirView.setUint16(10, 0, true);
    dirView.setUint16(12, 0, true);
    dirView.setUint16(14, 0, true);
    dirView.setUint32(16, crc, true);
    dirView.setUint32(20, data.length, true);
    dirView.setUint32(24, data.length, true);
    dirView.setUint16(28, nameBytes.length, true);
    dirView.setUint32(42, offset, true);
    dir.set(nameBytes, 46);
    central.push(dir);
    offset += local.length + data.length;
  });

  const centralSize = central.reduce((size, item) => size + item.length, 0);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(8, files.length, true);
  endView.setUint16(10, files.length, true);
  endView.setUint32(12, centralSize, true);
  endView.setUint32(16, offset, true);
  return new Blob([...chunks, ...central, end], { type });
}

function crc32(data) {
  let crc = -1;
  for (let index = 0; index < data.length; index += 1) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ data[index]) & 0xff];
  }
  return (crc ^ -1) >>> 0;
}

const crcTable = Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  return value >>> 0;
});
