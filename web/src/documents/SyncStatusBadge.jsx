export default function SyncStatusBadge({ status }) {
  const value = typeof status === "string" ? status : status?.status;
  const labels = {
    local_only: "Guardado en Firestore",
    modified_local: "Cambios pendientes de guardado",
    backed_up: "Respaldado en Firestore",
    conflict: "Conflicto",
    deleted_local: "Eliminado localmente",
    offline: "Sin conexion",
    local: "Guardado en Firestore",
    pending_upload: "Pendiente de guardar",
    synced: "Sincronizado",
    borrador_drive: "Borrador en Firestore",
    listo_para_publicar: "Listo para publicar",
    publicado_firebase: "Publicado",
    actualizado_en_drive: "Actualizado en Firestore",
    pendiente_actualizar_publicacion: "Actualizar publicacion",
  };
  return <span className={`sync-status-badge ${value || "local"}`}>{labels[value] || labels.local}</span>;
}
