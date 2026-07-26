import { Check, Copy, Download, X } from "lucide-react";
import { useMemo, useState } from "react";
import { useBuilderStore } from "../store/useBuilderStore.js";
import { generateFlutterCode } from "../utils/flutterGenerator.js";

export default function FlutterCodeModal() {
  const [copied, setCopied] = useState(false);
  const setShowFlutterCode = useBuilderStore((state) => state.setShowFlutterCode);
  const getBuilderJson = useBuilderStore((state) => state.getBuilderJson);
  const flutterCode = useMemo(() => generateFlutterCode(getBuilderJson()), [getBuilderJson]);

  async function copyCode() {
    await navigator.clipboard.writeText(flutterCode);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  function downloadMainDart() {
    const blob = new Blob([flutterCode], { type: "text/x-dart;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "main.dart";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/35 p-6 backdrop-blur-sm">
      <section className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl bg-white shadow-soft">
        <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-6 py-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-600">Flutter export</p>
            <h2 className="mt-1 text-lg font-black">main.dart generado</h2>
          </div>

          <div className="flex items-center gap-2">
            <button
              className="flex h-10 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 shadow-panel transition hover:bg-slate-50"
              type="button"
              onClick={copyCode}
            >
              {copied ? <Check size={17} /> : <Copy size={17} />}
              {copied ? "Copiado" : "Copiar codigo"}
            </button>

            <button
              className="flex h-10 items-center gap-2 rounded-2xl bg-blue-600 px-4 text-sm font-bold text-white shadow-panel transition hover:bg-blue-700"
              type="button"
              onClick={downloadMainDart}
            >
              <Download size={17} />
              Descargar main.dart
            </button>

            <button
              className="grid h-10 w-10 place-items-center rounded-2xl bg-slate-950 text-white shadow-panel transition hover:bg-slate-800"
              type="button"
              onClick={() => setShowFlutterCode(false)}
              title="Cerrar"
              aria-label="Cerrar"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <pre className="min-h-0 flex-1 overflow-auto bg-slate-950 p-6 text-sm leading-6 text-sky-100">
          {flutterCode}
        </pre>
      </section>
    </div>
  );
}
