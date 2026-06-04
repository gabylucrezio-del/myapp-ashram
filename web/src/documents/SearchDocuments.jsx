import { Search } from "lucide-react";

export default function SearchDocuments({ value, onChange }) {
  return (
    <label className="documents-search">
      <Search size={15} />
      <input value={value} onChange={(event) => onChange(event.target.value)} placeholder="Buscar por titulo o contenido..." />
    </label>
  );
}
