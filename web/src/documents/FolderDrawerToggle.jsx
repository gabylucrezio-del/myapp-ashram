export default function FolderDrawerToggle({ open, onClick }) {
  return (
    <button className={`folder-drawer-toggle ${open ? "open" : ""}`} type="button" onClick={onClick} aria-label={open ? "Cerrar carpetas" : "Abrir carpetas"}>
      {open ? "‹" : "›"}
    </button>
  );
}
