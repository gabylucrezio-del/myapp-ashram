import DocumentsLayout from "./documents/DocumentsLayout";

export default function CuadernoAshram({ profile, onBackToAdminPanel, onToast }) {
  if (profile?.rol !== "admin") {
    return (
      <div className="archive-panel">
        <h2>Mis Documentos</h2>
        <p>Este espacio es privado para administradores.</p>
      </div>
    );
  }

  return (
    <DocumentsLayout
      onBackToAdminPanel={onBackToAdminPanel}
      onToast={onToast}
    />
  );
}
