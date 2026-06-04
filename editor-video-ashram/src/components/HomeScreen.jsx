import React from "react";
import { Clock, Film, Plus, Square, Smartphone, Youtube } from "lucide-react";

const formats = [
  { id: "vertical", label: "Vertical 9:16", detail: "Reels, historias y shorts", icon: Smartphone },
  { id: "horizontal", label: "Horizontal 16:9", detail: "YouTube, cursos y clases", icon: Youtube },
  { id: "square", label: "Cuadrado 1:1", detail: "Publicaciones y piezas simples", icon: Square },
];

export default function HomeScreen({ projects, onCreate, onOpen }) {
  return (
    <main className="home-screen">
      <section className="home-hero">
        <div className="brand-mark">
          <Film size={28} />
        </div>
        <div>
          <h1>Editor Ashram</h1>
          <p>Videos simples para redes, cursos, satsang, yoga, meditacion, Ayurveda y coaching espiritual.</p>
        </div>
      </section>

      <section className="format-grid" aria-label="Crear proyecto">
        {formats.map((format) => {
          const Icon = format.icon;
          return (
            <button className="format-card" type="button" key={format.id} onClick={() => onCreate(format.id)}>
              <Icon size={26} />
              <span>
                <strong>{format.label}</strong>
                <small>{format.detail}</small>
              </span>
              <Plus size={20} />
            </button>
          );
        })}
      </section>

      <section className="recent-section">
        <div className="section-heading">
          <Clock size={18} />
          <h2>Proyectos recientes</h2>
        </div>
        {projects.length === 0 ? (
          <div className="empty-state">
            <strong>No hay proyectos guardados todavia.</strong>
            <span>Crea uno nuevo, importa clips y guarda el avance.</span>
          </div>
        ) : (
          <div className="recent-list">
            {projects.map((project) => (
              <button type="button" className="recent-item" key={project.id} onClick={() => onOpen(project)}>
                <span>
                  <strong>{project.name}</strong>
                  <small>{project.format} · {project.resolution} · {project.clips.length} clips</small>
                </span>
                <small>{new Date(project.updatedAt).toLocaleDateString()}</small>
              </button>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
