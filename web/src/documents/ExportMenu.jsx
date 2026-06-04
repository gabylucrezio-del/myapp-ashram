import { BookOpen, Clipboard, FileDown, FileText, GraduationCap, Headphones, Library, Newspaper, Share2 } from "lucide-react";

export default function ExportMenu({ onChoose, onClose }) {
  const options = [
    ["publish_post", "Publicar como post", Newspaper],
    ["publish_course", "Publicar como curso", GraduationCap],
    ["publish_meditation", "Publicar como meditacion", Headphones],
    ["publish_book", "Publicar como libro", BookOpen],
    ["publish_pdf", "Publicar como PDF", FileText],
    ["publish_library_resource", "Publicar en biblioteca", Library],
    ["epub", "Exportar como libro EPUB", BookOpen],
    ["pdf", "Exportar como PDF", FileText],
    ["post", "Preparar texto/post", Share2],
    ["copy", "Copiar texto", Clipboard],
    ["markdown", "Descargar Markdown", FileDown],
  ];

  return (
    <div className="export-menu">
      {options.map(([id, label, Icon]) => (
        <button key={id} type="button" onClick={() => { onChoose(id); onClose?.(); }}>
          <Icon size={15} /> {label}
        </button>
      ))}
    </div>
  );
}
