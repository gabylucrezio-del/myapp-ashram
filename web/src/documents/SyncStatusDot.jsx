export default function SyncStatusDot({ status }) {
  const value = normalizeStatus(typeof status === "string" ? status : status?.status);
  const labels = {
    synced: "Actualizado en Drive",
    pending: "Pendiente de guardar",
    syncing: "Guardando...",
    offline: "Sin conexion",
    error: "Error de guardado",
  };

  return <span className={`sync-status-dot ${value}`} title={labels[value]} aria-label={labels[value]} />;
}

function normalizeStatus(status) {
  if (["synced", "actualizado_en_drive", "publicado_firebase"].includes(status)) return "synced";
  if (["syncing", "guardando"].includes(status)) return "syncing";
  if (["offline", "sin_conexion"].includes(status)) return "offline";
  if (["error"].includes(status)) return "error";
  if (["pending", "pending_upload", "borrador_drive", "pendiente_actualizar_publicacion", "listo_para_publicar"].includes(status)) return "pending";
  return "offline";
}
