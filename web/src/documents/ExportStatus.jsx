export default function ExportStatus({ message }) {
  if (!message) return null;
  return <p className="export-status">{message}</p>;
}
