import React from "react";

export default class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  resetProject = () => {
    localStorage.removeItem("ganflow.project.v3");
    window.location.reload();
  };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <main className="grid min-h-screen place-items-center bg-slate-100 p-6 text-slate-900">
        <section className="max-w-lg rounded-3xl bg-white p-6 shadow-soft">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">GanFlow</p>
          <h1 className="mt-2 text-2xl font-semibold">No pude abrir el proyecto guardado</h1>
          <p className="mt-3 text-sm leading-6 text-slate-500">
            El editor encontro datos guardados incompatibles. Podés limpiar el proyecto local y volver a cargar la app.
          </p>
          <pre className="mt-4 max-h-40 overflow-auto rounded-2xl bg-slate-950 p-3 text-xs text-rose-100">
            {String(this.state.error?.message || this.state.error)}
          </pre>
          <button
            className="mt-4 h-10 rounded-2xl bg-blue-600 px-4 text-sm font-semibold text-white shadow-panel"
            type="button"
            onClick={this.resetProject}
          >
            Reiniciar proyecto local
          </button>
        </section>
      </main>
    );
  }
}
