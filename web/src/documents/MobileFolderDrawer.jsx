import FolderDrawerToggle from "./FolderDrawerToggle";

export default function MobileFolderDrawer({
  open,
  onToggle,
  onClose,
  children,
}) {
  return (
    <>
      <FolderDrawerToggle open={open} onClick={onToggle} />
      {open ? <button className="folder-drawer-backdrop" type="button" onClick={onClose} aria-label="Cerrar menu de documentos" /> : null}
      <div className={`mobile-folder-drawer ${open ? "open" : ""}`}>
        {children}
      </div>
    </>
  );
}
