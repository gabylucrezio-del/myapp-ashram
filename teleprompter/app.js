const STORAGE_KEY = "ashramLocalTeleprompter";

const state = {
  folders: [],
  scripts: [],
  selectedFolderId: "",
  selectedScriptId: "",
  playing: false,
  speed: 150,
  cameraOn: true,
  cameraStream: null,
  animationFrame: 0,
  lastTick: 0,
  scrollOffset: 0,
  countdownTimer: 0,
  countdownValue: 0,
  recognition: null,
  voiceOn: false,
  deferredInstallPrompt: null,
};

const els = {
  installButton: document.getElementById("installButton"),
  newFolderButton: document.getElementById("newFolderButton"),
  newScriptButton: document.getElementById("newScriptButton"),
  exportButton: document.getElementById("exportButton"),
  importInput: document.getElementById("importInput"),
  folderFilter: document.getElementById("folderFilter"),
  searchInput: document.getElementById("searchInput"),
  folderList: document.getElementById("folderList"),
  scriptList: document.getElementById("scriptList"),
  titleInput: document.getElementById("titleInput"),
  scriptFolderSelect: document.getElementById("scriptFolderSelect"),
  saveButton: document.getElementById("saveButton"),
  deleteButton: document.getElementById("deleteButton"),
  openPrompterButton: document.getElementById("openPrompterButton"),
  prompter: document.getElementById("prompter"),
  cameraPreview: document.getElementById("cameraPreview"),
  tint: document.getElementById("tint"),
  prompterTitle: document.getElementById("prompterTitle"),
  prompterFolder: document.getElementById("prompterFolder"),
  closePrompterButton: document.getElementById("closePrompterButton"),
  playButton: document.getElementById("playButton"),
  resetButton: document.getElementById("resetButton"),
  cameraButton: document.getElementById("cameraButton"),
  fullscreenButton: document.getElementById("fullscreenButton"),
  voiceButton: document.getElementById("voiceButton"),
  countdownInput: document.getElementById("countdownInput"),
  speedInput: document.getElementById("speedInput"),
  fontInput: document.getElementById("fontInput"),
  opacityInput: document.getElementById("opacityInput"),
  textColorInput: document.getElementById("textColorInput"),
  bgColorInput: document.getElementById("bgColorInput"),
  cameraMessage: document.getElementById("cameraMessage"),
  countdownDisplay: document.getElementById("countdownDisplay"),
  prompterViewport: document.getElementById("prompterViewport"),
  prompterText: document.getElementById("prompterText"),
  scriptText: document.getElementById("scriptText"),
};

loadState();
bindEvents();
render();
registerServiceWorker();

function bindEvents() {
  els.newFolderButton.addEventListener("click", createFolder);
  els.newScriptButton.addEventListener("click", createScript);
  els.exportButton.addEventListener("click", exportData);
  els.importInput.addEventListener("change", importData);
  els.folderFilter.addEventListener("change", () => {
    state.selectedFolderId = els.folderFilter.value;
    renderLists();
  });
  els.searchInput.addEventListener("input", renderLists);
  els.scriptFolderSelect.addEventListener("change", () => {
    const script = selectedScript();
    if (!script) return;
    script.folderId = els.scriptFolderSelect.value;
    saveState();
    render();
  });
  els.saveButton.addEventListener("click", saveCurrentScript);
  els.deleteButton.addEventListener("click", deleteCurrentScript);
  els.openPrompterButton.addEventListener("click", openPrompter);
  els.closePrompterButton.addEventListener("click", closePrompter);
  els.playButton.addEventListener("click", togglePlay);
  els.resetButton.addEventListener("click", resetPrompter);
  els.cameraButton.addEventListener("click", toggleCamera);
  els.fullscreenButton.addEventListener("click", toggleFullscreen);
  els.voiceButton.addEventListener("click", toggleVoiceFollow);
  els.speedInput.addEventListener("input", () => {
    state.speed = Number(els.speedInput.value);
  });
  els.fontInput.addEventListener("input", () => {
    els.prompterText.style.fontSize = `${els.fontInput.value}px`;
  });
  els.opacityInput.addEventListener("input", updateTint);
  els.bgColorInput.addEventListener("input", updateTint);
  els.textColorInput.addEventListener("input", () => {
    els.prompterText.style.color = els.textColorInput.value;
  });
  window.addEventListener("keydown", handleKeys);
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    state.deferredInstallPrompt = event;
    els.installButton.hidden = false;
  });
  els.installButton.addEventListener("click", async () => {
    if (!state.deferredInstallPrompt) return;
    state.deferredInstallPrompt.prompt();
    await state.deferredInstallPrompt.userChoice;
    state.deferredInstallPrompt = null;
  });
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    state.folders = Array.isArray(saved.folders) ? saved.folders : [];
    state.scripts = Array.isArray(saved.scripts) ? saved.scripts : [];
    state.selectedFolderId = saved.selectedFolderId || "";
    state.selectedScriptId = saved.selectedScriptId || "";
  } catch {
    state.folders = [];
    state.scripts = [];
  }

  if (!state.folders.length) {
    state.folders = [
      { id: createId(), name: "Ayurveda" },
      { id: createId(), name: "Registros" },
      { id: createId(), name: "Satsang" },
    ];
  }

  if (!state.scripts.length) {
    state.scripts = [
      {
        id: createId(),
        folderId: state.folders[0].id,
        title: "Primer guion",
        text: "Respira.\n\nMira suavemente hacia la camara.\n\nEmpieza tu mensaje cuando estes listo.",
        updatedAt: new Date().toISOString(),
      },
    ];
    state.selectedScriptId = state.scripts[0].id;
  }
}

function saveState() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      folders: state.folders,
      scripts: state.scripts,
      selectedFolderId: state.selectedFolderId,
      selectedScriptId: state.selectedScriptId,
    }),
  );
}

function render() {
  renderFolderControls();
  renderLists();
  renderEditor();
}

function renderFolderControls() {
  const options = [`<option value="">Todas las carpetas</option>`]
    .concat(state.folders.map((folder) => `<option value="${folder.id}">${escapeHtml(folder.name)}</option>`))
    .join("");
  els.folderFilter.innerHTML = options;
  els.folderFilter.value = state.selectedFolderId;

  els.scriptFolderSelect.innerHTML = [`<option value="">Sin carpeta</option>`]
    .concat(state.folders.map((folder) => `<option value="${folder.id}">${escapeHtml(folder.name)}</option>`))
    .join("");
}

function renderLists() {
  els.folderList.innerHTML = state.folders
    .map((folder) => (
      `<button class="folder-row ${state.selectedFolderId === folder.id ? "active" : ""}" data-folder="${folder.id}" type="button">
        <strong>${escapeHtml(folder.name)}</strong>
        <small>${scriptCount(folder.id)} guiones</small>
      </button>`
    ))
    .join("");

  els.folderList.querySelectorAll("[data-folder]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedFolderId = button.dataset.folder;
      els.folderFilter.value = state.selectedFolderId;
      saveState();
      renderLists();
    });
  });

  const query = els.searchInput.value.trim().toLowerCase();
  const scripts = state.scripts.filter((script) => {
    const inFolder = state.selectedFolderId ? script.folderId === state.selectedFolderId : true;
    const matches = query ? `${script.title} ${script.text}`.toLowerCase().includes(query) : true;
    return inFolder && matches;
  });

  els.scriptList.innerHTML = scripts
    .map((script) => (
      `<button class="script-row ${state.selectedScriptId === script.id ? "active" : ""}" data-script="${script.id}" type="button">
        <strong>${escapeHtml(script.title || "Sin titulo")}</strong>
        <small>${escapeHtml(folderName(script.folderId))}</small>
      </button>`
    ))
    .join("");

  els.scriptList.querySelectorAll("[data-script]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedScriptId = button.dataset.script;
      saveState();
      renderLists();
      renderEditor();
    });
  });
}

function renderEditor() {
  const script = selectedScript();
  els.titleInput.value = script?.title || "";
  els.scriptText.value = script?.text || "";
  els.scriptFolderSelect.value = script?.folderId || "";
}

function createFolder() {
  const name = window.prompt("Nombre de la carpeta");
  if (!name?.trim()) return;
  const folder = { id: createId(), name: name.trim() };
  state.folders.push(folder);
  state.selectedFolderId = folder.id;
  saveState();
  render();
}

function createScript() {
  const script = {
    id: createId(),
    folderId: state.selectedFolderId,
    title: "Nuevo guion",
    text: "",
    updatedAt: new Date().toISOString(),
  };
  state.scripts.unshift(script);
  state.selectedScriptId = script.id;
  saveState();
  render();
  els.titleInput.focus();
  els.titleInput.select();
}

function saveCurrentScript() {
  let script = selectedScript();
  if (!script) {
    createScript();
    script = selectedScript();
  }
  script.title = els.titleInput.value.trim() || "Sin titulo";
  script.folderId = els.scriptFolderSelect.value;
  script.text = els.scriptText.value;
  script.updatedAt = new Date().toISOString();
  saveState();
  render();
}

function deleteCurrentScript() {
  const script = selectedScript();
  if (!script || !window.confirm(`Borrar "${script.title || "Sin titulo"}"?`)) return;
  state.scripts = state.scripts.filter((item) => item.id !== script.id);
  state.selectedScriptId = state.scripts[0]?.id || "";
  saveState();
  render();
}

async function openPrompter() {
  saveCurrentScript();
  const script = selectedScript();
  if (!script) return;
  els.prompterTitle.textContent = script.title || "Sin titulo";
  els.prompterFolder.textContent = folderName(script.folderId);
  els.prompterText.textContent = script.text || "Este guion esta vacio.";
  state.scrollOffset = 0;
  renderPrompterPosition();
  els.prompter.classList.remove("hidden");
  updateTint();
  await startCamera();
}

function closePrompter() {
  stopPlay();
  stopCountdown();
  stopVoiceFollow();
  stopCamera();
  els.prompter.classList.add("hidden");
  if (document.fullscreenElement) document.exitFullscreen();
}

async function startCamera() {
  if (!state.cameraOn) return;
  if (!navigator.mediaDevices?.getUserMedia) {
    showCameraMessage("La camara necesita navegador compatible o HTTPS/localhost.");
    return;
  }
  try {
    hideCameraMessage();
    state.cameraStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user" },
      audio: false,
    });
    els.cameraPreview.srcObject = state.cameraStream;
  } catch {
    showCameraMessage("No pude abrir la camara frontal.");
  }
}

function stopCamera() {
  state.cameraStream?.getTracks().forEach((track) => track.stop());
  state.cameraStream = null;
  els.cameraPreview.srcObject = null;
}

async function toggleCamera() {
  state.cameraOn = !state.cameraOn;
  els.cameraButton.textContent = state.cameraOn ? "Camara" : "Sin camara";
  if (state.cameraOn) {
    await startCamera();
  } else {
    stopCamera();
  }
}

function togglePlay() {
  if (state.playing) {
    stopPlay();
    return;
  }
  startCountdownThenPlay();
}

function startCountdownThenPlay() {
  stopCountdown();
  const seconds = Number(els.countdownInput.value || 0);
  if (!seconds) {
    startPlay();
    return;
  }
  state.countdownValue = seconds;
  renderCountdown();
  state.countdownTimer = window.setInterval(() => {
    state.countdownValue -= 1;
    if (state.countdownValue <= 0) {
      stopCountdown();
      startPlay();
      return;
    }
    renderCountdown();
  }, 1000);
}

function renderCountdown() {
  els.countdownDisplay.textContent = state.countdownValue;
  els.countdownDisplay.classList.remove("hidden");
}

function stopCountdown() {
  window.clearInterval(state.countdownTimer);
  state.countdownTimer = 0;
  state.countdownValue = 0;
  els.countdownDisplay.classList.add("hidden");
}

function startPlay() {
  state.playing = true;
  state.lastTick = 0;
  state.speed = Number(els.speedInput.value);
  els.playButton.textContent = "Pausa";
  state.animationFrame = requestAnimationFrame(tick);
}

function stopPlay() {
  state.playing = false;
  state.lastTick = 0;
  els.playButton.textContent = "Play";
  cancelAnimationFrame(state.animationFrame);
}

function tick(timestamp) {
  if (!state.playing) return;
  if (!state.lastTick) state.lastTick = timestamp;
  const delta = (timestamp - state.lastTick) / 1000;
  state.lastTick = timestamp;
  state.scrollOffset += state.speed * delta;
  renderPrompterPosition();
  state.animationFrame = requestAnimationFrame(tick);
}

function resetPrompter() {
  stopPlay();
  stopCountdown();
  state.scrollOffset = 0;
  renderPrompterPosition();
}

function renderPrompterPosition() {
  els.prompterText.style.transform = `translateY(${-state.scrollOffset}px)`;
}

function toggleVoiceFollow() {
  state.voiceOn ? stopVoiceFollow() : startVoiceFollow();
}

function startVoiceFollow() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    showCameraMessage("Reconocimiento de voz no disponible en este navegador.");
    return;
  }
  const script = selectedScript();
  if (!script?.text?.trim()) return;

  stopPlay();
  state.recognition = new SpeechRecognition();
  state.recognition.lang = "es-AR";
  state.recognition.continuous = true;
  state.recognition.interimResults = true;
  state.recognition.onresult = (event) => {
    const latest = Array.from(event.results)
      .slice(-2)
      .map((result) => result[0]?.transcript || "")
      .join(" ");
    followSpokenText(latest, script.text);
  };
  state.recognition.onend = () => {
    if (state.voiceOn) state.recognition?.start();
  };
  state.voiceOn = true;
  els.voiceButton.textContent = "Voz activa";
  state.recognition.start();
}

function stopVoiceFollow() {
  state.voiceOn = false;
  els.voiceButton.textContent = "Voz";
  state.recognition?.stop();
  state.recognition = null;
}

function followSpokenText(spoken, scriptText) {
  const spokenWords = normalizeWords(spoken).slice(-8);
  if (spokenWords.length < 3) return;
  const scriptWords = normalizeWords(scriptText);
  const phrase = spokenWords.join(" ");
  const scriptJoined = scriptWords.join(" ");
  const wordIndex = scriptJoined.indexOf(phrase);
  if (wordIndex < 0) return;
  const progress = Math.min(0.96, wordIndex / Math.max(1, scriptJoined.length));
  const maxOffset = Math.max(0, els.prompterText.scrollHeight - els.prompterViewport.clientHeight * 0.55);
  state.scrollOffset = maxOffset * progress;
  renderPrompterPosition();
}

function normalizeWords(text) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9ñ\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function updateTint() {
  els.tint.style.background = els.bgColorInput.value;
  els.tint.style.opacity = Number(els.opacityInput.value) / 100;
}

async function toggleFullscreen() {
  if (document.fullscreenElement) {
    await document.exitFullscreen();
    return;
  }
  await els.prompter.requestFullscreen?.();
}

function exportData() {
  saveCurrentScript();
  const blob = new Blob([JSON.stringify({ folders: state.folders, scripts: state.scripts }, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `teleprompter-ashram-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

async function importData(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const text = await file.text();
  const data = JSON.parse(text);
  if (!Array.isArray(data.folders) || !Array.isArray(data.scripts)) {
    window.alert("El archivo no tiene formato de teleprompter.");
    return;
  }
  state.folders = data.folders;
  state.scripts = data.scripts;
  state.selectedScriptId = state.scripts[0]?.id || "";
  state.selectedFolderId = "";
  saveState();
  render();
  event.target.value = "";
}

function handleKeys(event) {
  if (els.prompter.classList.contains("hidden")) return;
  if (event.key === "Escape") closePrompter();
  if (event.code === "Space") {
    event.preventDefault();
    togglePlay();
  }
  if (event.key === "ArrowDown") {
    event.preventDefault();
    state.scrollOffset += 70;
    renderPrompterPosition();
  }
  if (event.key === "ArrowUp") {
    event.preventDefault();
    state.scrollOffset = Math.max(0, state.scrollOffset - 70);
    renderPrompterPosition();
  }
}

function selectedScript() {
  return state.scripts.find((script) => script.id === state.selectedScriptId) || state.scripts[0] || null;
}

function scriptCount(folderId) {
  return state.scripts.filter((script) => script.folderId === folderId).length;
}

function folderName(folderId) {
  return state.folders.find((folder) => folder.id === folderId)?.name || "Sin carpeta";
}

function showCameraMessage(message) {
  els.cameraMessage.textContent = message;
  els.cameraMessage.classList.remove("hidden");
}

function hideCameraMessage() {
  els.cameraMessage.classList.add("hidden");
}

function createId() {
  return crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  navigator.serviceWorker.register("./sw.js").catch(() => {});
}
