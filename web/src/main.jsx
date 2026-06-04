import { Component } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./styles.css";

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <main className="fallback">
          <img src="/Logo Ashram.webp" alt="Ashram Ganesha" />
          <h1>No se pudo iniciar la web</h1>
          <p>{this.state.error.message || String(this.state.error)}</p>
          <small>Actualiza la pagina. Si sigue pasando, copia este texto.</small>
        </main>
      );
    }

    return this.props.children;
  }
}

createRoot(document.getElementById("root")).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.getRegistrations?.().then((registrations) => {
      registrations.forEach((registration) => registration.unregister());
    });
    window.caches?.keys?.().then((keys) => {
      keys.forEach((key) => window.caches.delete(key));
    });
  });
}
