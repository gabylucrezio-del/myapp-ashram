const state = {
  format: "vertical",
  template: "reel",
  videoUrl: "",
  title: "Respira y vuelve a tu centro",
  subtitle: "Ashram Ganesha",
  trimStart: 0,
  trimEnd: 100,
  volume: 80,
  logo: true,
};

const templates = {
  reel: {
    label: "Reel / Shorts",
    detail: "Vertical, texto grande y cierre limpio",
    format: "vertical",
    title: "Respira y vuelve a tu centro",
    subtitle: "Ashram Ganesha",
  },
  clase: {
    label: "Clase",
    detail: "Horizontal para YouTube o cursos",
    format: "horizontal",
    title: "Clase de Ayurveda",
    subtitle: "Fragmento destacado",
  },
  satsang: {
    label: "Satsang",
    detail: "Mensaje espiritual con marca discreta",
    format: "horizontal",
    title: "Satsang Ashram Ganesha",
    subtitle: "Presencia, practica y claridad",
  },
  meditacion: {
    label: "Meditacion",
    detail: "Vertical u horizontal, ritmo suave",
    format: "vertical",
    title: "Meditacion guiada",
    subtitle: "Un minuto de presencia",
  },
};

const app = document.getElementById("app");
render();

function render() {
  app.className = "app";
  app.innerHTML = `
    <header class="topbar">
      <div class="brand">
        <strong>Editor Video Ashram</strong>
        <small>Vertical 9:16 y horizontal 16:9 para reels, clases y satsang</small>
      </div>
      <button class="primary" data-action="export">Preparar exportacion</button>
    </header>
    <main class="workspace">
      <aside class="panel">
        <h2>Proyecto</h2>
        <div class="segmented">
          <button class="${state.format === "vertical" ? "active" : ""}" data-format="vertical">Vertical 9:16</button>
          <button class="${state.format === "horizontal" ? "active" : ""}" data-format="horizontal">Horizontal 16:9</button>
        </div>
        <label class="field">Video principal
          <input data-input="video" type="file" accept="video/*" />
        </label>
        <label class="field">Titulo
          <textarea data-input="title">${escapeHtml(state.title)}</textarea>
        </label>
        <label class="field">Subtitulo
          <input data-input="subtitle" value="${escapeHtml(state.subtitle)}" />
        </label>
        <label class="field">Logo
          <select data-input="logo">
            <option value="1" ${state.logo ? "selected" : ""}>Mostrar marca Ashram</option>
            <option value="0" ${!state.logo ? "selected" : ""}>Sin logo</option>
          </select>
        </label>
      </aside>

      <section class="preview-column">
        <div class="preview-shell">
          <div class="stage ${state.format}" id="stage">
            ${state.videoUrl ? `<video id="previewVideo" src="${state.videoUrl}" playsinline muted loop></video>` : EmptyPreview()}
            ${state.logo ? `<div class="overlay-logo">AG</div>` : ""}
            <div class="overlay-title">${escapeHtml(state.title)}</div>
            <div class="overlay-subtitle">${escapeHtml(state.subtitle)}</div>
          </div>
        </div>
        <section class="timeline">
          <div class="transport">
            <button class="icon-button" data-action="play" aria-label="Play">Play</button>
            <button class="ghost" data-action="restart">Inicio</button>
            <span id="timeLabel">00:00</span>
          </div>
          <div class="track" style="--trim-start:${state.trimStart}%; --trim-end:${state.trimEnd}%"></div>
          <div class="range-row">
            <span>Inicio</span>
            <input data-input="trimStart" type="range" min="0" max="90" value="${state.trimStart}" />
            <output>${state.trimStart}%</output>
          </div>
          <div class="range-row">
            <span>Final</span>
            <input data-input="trimEnd" type="range" min="10" max="100" value="${state.trimEnd}" />
            <output>${state.trimEnd}%</output>
          </div>
        </section>
      </section>

      <aside class="panel right-panel">
        <section>
          <h2>Plantillas</h2>
          <div class="template-list">
            ${Object.entries(templates).map(([id, template]) => `
              <button class="${state.template === id ? "active" : ""}" data-template="${id}">
                <strong>${template.label}</strong>
                <small>${template.detail}</small>
              </button>
            `).join("")}
          </div>
        </section>
        <section>
          <h2>Salida</h2>
          <ul class="notes">
            <li>Formato actual: ${state.format === "vertical" ? "vertical 9:16" : "horizontal 16:9"}.</li>
            <li>Esta primera version prepara la maqueta y la previsualizacion.</li>
            <li>El siguiente paso es conectar FFmpeg para exportar MP4 real.</li>
          </ul>
        </section>
      </aside>
    </main>
  `;
  bind();
  syncVideo();
}

function EmptyPreview() {
  return `
    <div class="empty-preview">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 5h10a4 4 0 0 1 4 4v6a4 4 0 0 1-4 4H5z" />
        <path d="m19 10 4-2v8l-4-2" />
        <path d="M8 9h5M8 13h7" />
      </svg>
      <strong>Carga un video</strong>
      <small>La previsualizacion mantiene el formato elegido.</small>
    </div>
  `;
}

function bind() {
  document.querySelectorAll("[data-format]").forEach((button) => {
    button.addEventListener("click", () => {
      state.format = button.dataset.format;
      render();
    });
  });

  document.querySelectorAll("[data-template]").forEach((button) => {
    button.addEventListener("click", () => {
      const template = templates[button.dataset.template];
      state.template = button.dataset.template;
      state.format = template.format;
      state.title = template.title;
      state.subtitle = template.subtitle;
      render();
    });
  });

  document.querySelector("[data-input='video']")?.addEventListener("change", (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (state.videoUrl) URL.revokeObjectURL(state.videoUrl);
    state.videoUrl = URL.createObjectURL(file);
    render();
  });

  document.querySelector("[data-input='title']")?.addEventListener("input", (event) => {
    state.title = event.target.value;
    document.querySelector(".overlay-title").textContent = state.title;
  });

  document.querySelector("[data-input='subtitle']")?.addEventListener("input", (event) => {
    state.subtitle = event.target.value;
    document.querySelector(".overlay-subtitle").textContent = state.subtitle;
  });

  document.querySelector("[data-input='logo']")?.addEventListener("change", (event) => {
    state.logo = event.target.value === "1";
    render();
  });

  ["trimStart", "trimEnd"].forEach((name) => {
    document.querySelector(`[data-input='${name}']`)?.addEventListener("input", (event) => {
      state[name] = Number(event.target.value);
      if (state.trimStart >= state.trimEnd) {
        state.trimStart = Math.max(0, state.trimEnd - 5);
      }
      document.querySelector(".track")?.style.setProperty("--trim-start", `${state.trimStart}%`);
      document.querySelector(".track")?.style.setProperty("--trim-end", `${state.trimEnd}%`);
      event.target.parentElement.querySelector("output").textContent = `${state[name]}%`;
    });
  });

  document.querySelector("[data-action='play']")?.addEventListener("click", () => {
    const video = document.getElementById("previewVideo");
    if (!video) return;
    video.paused ? video.play() : video.pause();
  });

  document.querySelector("[data-action='restart']")?.addEventListener("click", () => {
    const video = document.getElementById("previewVideo");
    if (!video) return;
    video.currentTime = 0;
    video.play();
  });

  document.querySelector("[data-action='export']")?.addEventListener("click", () => {
    alert("Siguiente etapa: conectar exportacion MP4 con FFmpeg manteniendo este formato y textos.");
  });
}

function syncVideo() {
  const video = document.getElementById("previewVideo");
  const label = document.getElementById("timeLabel");
  if (!video || !label) return;
  video.volume = state.volume / 100;
  video.addEventListener("timeupdate", () => {
    label.textContent = formatTime(video.currentTime);
  });
}

function formatTime(seconds) {
  const value = Math.max(0, Math.floor(seconds || 0));
  const minutes = Math.floor(value / 60);
  const rest = value % 60;
  return `${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
