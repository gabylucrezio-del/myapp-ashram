import { AlertTriangle, Cloud, Download, Laptop, PackageCheck, Server, X } from "lucide-react";
import { useMemo, useState } from "react";
import { createBuildPayload, sendBuildToServer, BUILD_SERVER_ARCHITECTURE } from "../utils/buildServerClient.js";

export default function BuildApkModal({ builderJson, flutterProject, onClose, onExportFlutter }) {
  const [mode, setMode] = useState("server");
  const [endpoint, setEndpoint] = useState(localStorage.getItem("ganflow.buildServerEndpoint") || "");
  const [status, setStatus] = useState("idle");
  const [logs, setLogs] = useState("");
  const isTablet = useMemo(() => isLikelyTablet(), []);
  const validation = flutterProject.validation;

  async function buildOnServer() {
    try {
      setStatus("building");
      setLogs("Preparando proyecto Flutter...\n");
      localStorage.setItem("ganflow.buildServerEndpoint", endpoint);
      const payload = createBuildPayload({ builderJson, flutterProject, mode: "release" });
      setLogs((current) => `${current}Enviando ${Math.round(payload.size / 1024)} KB al servidor...\n`);
      const result = await sendBuildToServer({ endpoint, payload });
      setStatus("done");
      setLogs((current) => `${current}${result.logs || "Build completado."}\n${result.apkUrl ? `APK: ${result.apkUrl}` : ""}`);
      if (result.apkUrl) window.open(result.apkUrl, "_blank", "noopener,noreferrer");
    } catch (error) {
      setStatus("error");
      setLogs((current) => `${current}${error.message}\n`);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-6 backdrop-blur-sm">
      <section className="w-full max-w-3xl overflow-hidden rounded-3xl bg-white shadow-soft">
        <header className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-600">Android build</p>
            <h2 className="text-lg font-bold">Compilar APK</h2>
          </div>
          <button className="grid h-10 w-10 place-items-center rounded-2xl bg-slate-100 text-slate-600 hover:bg-slate-200" type="button" onClick={onClose}>
            <X size={18} />
          </button>
        </header>

        <div className="grid gap-4 p-5">
          {isTablet ? (
            <div className="flex items-start gap-3 rounded-2xl bg-emerald-50 p-3 text-sm text-emerald-800">
              <PackageCheck className="mt-0.5 shrink-0" size={18} />
              Estas usando una pantalla tactil/tablet. Para APK real se recomienda compilar en servidor.
            </div>
          ) : null}

          {validation.errors.length ? (
            <div className="rounded-2xl bg-rose-50 p-3 text-sm text-rose-700">
              <strong>No se puede compilar todavia.</strong>
              <ul className="mt-2 list-disc pl-5">
                {validation.errors.map((error) => <li key={error}>{error}</li>)}
              </ul>
            </div>
          ) : null}

          {validation.warnings.length ? (
            <div className="flex items-start gap-3 rounded-2xl bg-amber-50 p-3 text-sm text-amber-800">
              <AlertTriangle className="mt-0.5 shrink-0" size={18} />
              <span>{validation.warnings.join(" ")}</span>
            </div>
          ) : null}

          <div className="grid grid-cols-3 gap-2">
            <BuildOption active={mode === "server"} icon={Cloud} title="Compilar en servidor" onClick={() => setMode("server")} />
            <BuildOption active={mode === "pc"} icon={Laptop} title="Compilar en mi PC" onClick={() => setMode("pc")} />
            <BuildOption active={mode === "export"} icon={Download} title="Exportar Flutter" onClick={() => setMode("export")} />
          </div>

          {mode === "server" ? (
            <div className="grid gap-3 rounded-2xl bg-slate-50 p-4">
              <label className="grid gap-1">
                <span className="text-[11px] font-bold uppercase tracking-wide text-slate-400">URL del servidor de compilacion</span>
                <input
                  className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-emerald-400"
                  placeholder="https://build.tu-dominio.com/api/build-apk"
                  value={endpoint}
                  onChange={(event) => setEndpoint(event.target.value)}
                />
              </label>
              <button className="flex h-11 items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 text-sm font-bold text-white shadow-panel transition hover:bg-emerald-700 disabled:opacity-50" type="button" disabled={status === "building" || validation.errors.length > 0} onClick={buildOnServer}>
                <Server size={17} />
                {status === "building" ? "Compilando..." : "Enviar y compilar APK release"}
              </button>
            </div>
          ) : null}

          {mode === "pc" ? (
            <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
              Exporta el proyecto Flutter y compila en tu PC con <code className="rounded bg-white px-1">flutter pub get</code> y <code className="rounded bg-white px-1">flutter build apk --release</code>.
            </div>
          ) : null}

          {mode === "export" || mode === "pc" ? (
            <button className="flex h-11 items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 text-sm font-bold text-white shadow-panel transition hover:bg-blue-700 disabled:opacity-50" type="button" disabled={validation.errors.length > 0} onClick={onExportFlutter}>
              <Download size={17} />
              Exportar proyecto Flutter ZIP
            </button>
          ) : null}

          <details className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
            <summary className="cursor-pointer font-medium text-slate-800">Arquitectura segura del Build Server</summary>
            <ul className="mt-3 grid gap-2">
              {BUILD_SERVER_ARCHITECTURE.map((item) => <li key={item}>- {item}</li>)}
            </ul>
          </details>

          {logs ? <pre className="max-h-44 overflow-auto rounded-2xl bg-slate-950 p-4 text-xs leading-5 text-emerald-100">{logs}</pre> : null}
        </div>
      </section>
    </div>
  );
}

function BuildOption({ active, icon: Icon, title, onClick }) {
  return (
    <button className={`flex min-h-20 flex-col items-center justify-center gap-2 rounded-2xl border p-3 text-center text-sm font-bold transition ${active ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`} type="button" onClick={onClick}>
      <Icon size={20} />
      {title}
    </button>
  );
}

function isLikelyTablet() {
  return window.matchMedia("(pointer: coarse)").matches && window.innerWidth >= 700;
}
