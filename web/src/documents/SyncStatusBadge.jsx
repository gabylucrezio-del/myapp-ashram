export default function SyncStatusBadge({ status }) {
  const value = typeof status === "string" ? status : status?.status;
  const labels = {
    local_only: "Guardado localmente",
    modified_local: "Cambios pendientes de respaldo",
    backed_up: "Respaldado en Drive",
    conflict: "Conflicto",
    deleted_local: "Eliminado localmente",
    offline: "Sin conexion",
    local: "Guardado localmente",
    pending_upload: "Pendiente de subir",
    synced: "Sincronizado",
    borrador_drive: "Borrador en Drive",
    listo_para_publicar: "Listo para publicar",
    publicado_firebase: "Publicado",
    actualizado_en_drive: "Actualizado en Drive",
    pendiente_actualizar_publicacion: "Actualizar publicacion",
  };
  return <span className={`sync-status-badge ${value || "local"}`}>{labels[value] || labels.local}</span>;
}
