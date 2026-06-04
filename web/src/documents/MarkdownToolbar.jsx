import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  CheckSquare,
  Code2,
  Eye,
  Heading1,
  Heading2,
  Heading3,
  Image,
  Italic,
  Link,
  List,
  ListOrdered,
  Minus,
  Pencil,
  Plus,
  Quote,
  Strikethrough,
  Table2,
  Video,
} from "lucide-react";
import { useState } from "react";

const actions = [
  { id: "h1", label: "Titulo H1", icon: Heading1, mobilePrimary: true },
  { id: "h2", label: "Subtitulo H2", icon: Heading2, mobilePrimary: true },
  { id: "h3", label: "Titulo H3", icon: Heading3 },
  { id: "bold", label: "Negrita", icon: Bold, mobilePrimary: true },
  { id: "italic", label: "Cursiva", icon: Italic, mobilePrimary: true },
  { id: "strike", label: "Tachado", icon: Strikethrough },
  { id: "quote", label: "Cita", icon: Quote },
  { id: "inlineCode", label: "Codigo inline", icon: Code2 },
  { id: "ul", label: "Lista con vinetas", icon: List, mobilePrimary: true },
  { id: "ol", label: "Lista numerada", icon: ListOrdered },
  { id: "checklist", label: "Checklist", icon: CheckSquare },
  { id: "hr", label: "Separador", icon: Minus },
  { id: "link", label: "Link", icon: Link, mobilePrimary: true },
  { id: "image", label: "Imagen", icon: Image, mobilePrimary: true },
  { id: "video", label: "Video embebido", icon: Video },
  { id: "table", label: "Tabla", icon: Table2, mobilePrimary: true },
  { id: "code", label: "Bloque de codigo", icon: Code2 },
  { id: "left", label: "Alinear izquierda", icon: AlignLeft },
  { id: "center", label: "Centrar", icon: AlignCenter },
  { id: "right", label: "Alinear derecha", icon: AlignRight },
];

export default function MarkdownToolbar({ mode = "edit", onAction, onTogglePreview }) {
  const [moreOpen, setMoreOpen] = useState(false);
  const overflowActions = actions;

  function chooseAction(id) {
    onAction(id);
    setMoreOpen(false);
  }

  return (
    <div className="markdown-toolbar" aria-label="Herramientas Markdown">
      {actions.map(({ id, label, icon: Icon, mobilePrimary }) => (
        <button
          className={mobilePrimary ? "mobile-primary-tool" : "mobile-secondary-tool"}
          data-tool={id}
          key={id}
          type="button"
          title={label}
          onClick={() => chooseAction(id)}
        >
          <Icon size={15} />
        </button>
      ))}
      <button className={mode === "source" ? "active" : ""} type="button" title={mode === "source" ? "Editor visual" : "Ver Markdown"} onClick={onTogglePreview}>
        {mode === "source" ? <Pencil size={15} /> : <Eye size={15} />}
      </button>
      <div className="toolbar-more-wrap">
        <button type="button" title="Mas herramientas" onClick={() => setMoreOpen((open) => !open)}>
          <Plus size={15} />
        </button>
        {moreOpen ? (
          <div className="toolbar-more-menu">
            {overflowActions.map(({ id, label, icon: Icon }) => (
              <button key={id} type="button" onClick={() => chooseAction(id)}>
                <Icon size={14} /> {label}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
