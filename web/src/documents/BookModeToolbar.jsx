import { BookOpen, Eye, Heading1, Heading2 } from "lucide-react";

export default function BookModeToolbar({ onInsert, onPreview, onExport }) {
  return (
    <div className="book-mode-toolbar">
      <button type="button" onClick={() => onInsert("# Capitulo 1: Titulo del capitulo\n\n")}><Heading1 size={15} /> Capitulo</button>
      <button type="button" onClick={() => onInsert("## Subtitulo\n\n")}><Heading2 size={15} /> Subtitulo</button>
      <button type="button" onClick={() => onInsert("# Prologo\n\n")}>Prologo</button>
      <button type="button" onClick={() => onInsert("# Epilogo\n\n")}>Epilogo</button>
      <button type="button" onClick={onPreview}><Eye size={15} /> Capitulos</button>
      <button type="button" onClick={onExport}><BookOpen size={15} /> EPUB</button>
    </div>
  );
}
