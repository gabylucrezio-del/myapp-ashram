import { Bold, CheckSquare, Code2, Heading1, Heading2, Heading3, Image as ImageIcon, Italic, Link, List, ListOrdered, Music, Quote, Redo2, Save, StickyNote, Table2, Undo2, Video, Volume2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const emptyNote = {
  titulo: "",
  folderId: "",
  contenidoMarkdown: "",
  keywords: "",
  imagenUrl: "",
  audioUrl: "",
  pdfUrl: "",
  videoUrl: "",
  estado: "borrador",
};

const slashCommands = [
  { id: "nota", label: "Vinculo a otra nota", icon: StickyNote },
  { id: "youtube", label: "Video de YouTube", icon: Video },
  { id: "pdf", label: "Link de PDF", icon: Link },
  { id: "audio", label: "Link de audio", icon: Music },
  { id: "imagen", label: "Link de imagen", icon: ImageIcon },
  { id: "tabla", label: "Tabla", icon: Table2 },
];

export default function NoteEditor({ note, folders, notes = [], defaultFolderId = "", onSave, mode = "note", hideResourceFields = false }) {
  const [form, setForm] = useState({ ...emptyNote, folderId: defaultFolderId, ...note });
  const [saving, setSaving] = useState(false);
  const [showSlash, setShowSlash] = useState(false);
  const editorRef = useRef(null);
  const savedRangeRef = useRef(null);

  useEffect(() => {
    const nextForm = { ...emptyNote, folderId: defaultFolderId, ...note };
    setForm(nextForm);
    if (editorRef.current) {
      editorRef.current.innerHTML = markdownToHtml(nextForm.contenidoMarkdown);
    }
    setShowSlash(false);
  }, [note?.id, note?.actualizadoEn, note?.contenidoMarkdown, defaultFolderId]);

  function setField(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function syncEditor(extraFields = {}) {
    const markdown = htmlToMarkdown(editorRef.current);
    setForm((current) => ({ ...current, ...extraFields, contenidoMarkdown: markdown }));
    setShowSlash(getTextBeforeCursor(editorRef.current).endsWith("/"));
  }

  function saveSelection() {
    const selection = window.getSelection();
    if (!selection?.rangeCount || !editorRef.current?.contains(selection.anchorNode)) return;
    savedRangeRef.current = selection.getRangeAt(0).cloneRange();
  }

  function restoreSelection() {
    if (!savedRangeRef.current) return;
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(savedRangeRef.current);
  }

  function focusEditor() {
    editorRef.current?.focus();
  }

  function applyCommand(command, value = null, extraFields = {}) {
    focusEditor();
    restoreSelection();
    document.execCommand(command, false, value);
    saveSelection();
    syncEditor(extraFields);
  }

  function insertHtml(html, extraFields = {}) {
    focusEditor();
    restoreSelection();
    removeSlashBeforeCursor(editorRef.current);
    document.execCommand("insertHTML", false, html);
    saveSelection();
    syncEditor(extraFields);
    setShowSlash(false);
  }

  function runSlashCommand(command) {
    if (command === "tabla") {
      insertTable();
      return;
    }

    if (command === "nota") {
      if (!notes.length) {
        insertHtml('<a href="nota:">Nota vinculada</a>');
        return;
      }
      const options = notes.map((item, index) => `${index + 1}. ${item.titulo || "Sin titulo"}`).join("\n");
      restoreSelection();
      const selectedText = window.getSelection()?.toString();
      const selected = Number(window.prompt(`Elegi una nota por numero:\n${options}`));
      const target = notes[selected - 1];
      if (!target) return;
      linkSelectionToNote(target, selectedText);
      return;
    }

    const url = window.prompt("Pega el link");
    if (!url) return;
    if (command === "youtube") insertHtml(`<p><a href="${escapeAttribute(url)}">Video</a></p>`, { videoUrl: url });
    if (command === "pdf") insertHtml(`<p><a href="${escapeAttribute(url)}">PDF</a></p>`, { pdfUrl: url });
    if (command === "audio") insertHtml(`<p><a href="${escapeAttribute(url)}">Audio</a></p>`, { audioUrl: url });
    if (command === "imagen") insertHtml(`<figure><img src="${escapeAttribute(url)}" alt="Imagen" /></figure>`, { imagenUrl: url });
  }

  function insertLink() {
    restoreSelection();
    const url = window.prompt("Pega el link", "https://");
    if (!url) return;
    applyCommand("createLink", url);
  }

  function applyHeading(level) {
    restoreSelection();
    const selected = window.getSelection()?.toString();
    if (selected?.trim()) {
      insertHtml(`<h${level} class="compact-heading">${escapeHtml(selected.trim())}</h${level}>`);
      return;
    }
    applyCommand("formatBlock", `H${level}`);
  }

  function insertCode() {
    restoreSelection();
    const selected = window.getSelection()?.toString() || "codigo";
    insertHtml(`<code>${escapeHtml(selected)}</code>`);
  }

  function insertQuote() {
    restoreSelection();
    const selected = window.getSelection()?.toString();
    if (selected.trim()) {
      applyCommand("formatBlock", "BLOCKQUOTE");
      return;
    }
    insertHtml("<blockquote>cita</blockquote>");
  }

  function insertTable() {
    insertHtml(`
      <table>
        <thead>
          <tr><th>Columna 1</th><th>Columna 2</th><th>Columna 3</th></tr>
        </thead>
        <tbody>
          <tr><td>Texto</td><td>Texto</td><td>Texto</td></tr>
          <tr><td>Texto</td><td>Texto</td><td>Texto</td></tr>
        </tbody>
      </table>
      <p><br></p>
    `);
  }

  function handleEditorKeyDown(event) {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
      event.preventDefault();
      applyCommand("undo");
      return;
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "y") {
      event.preventDefault();
      applyCommand("redo");
      return;
    }
    if (event.key !== "Enter") return;
    event.preventDefault();
    restoreSelection();
    document.execCommand("insertLineBreak", false);
    saveSelection();
    syncEditor();
  }

  function linkSelectionToNote(target, selectedText = "") {
    const href = `nota:${target.id}`;
    restoreSelection();
    if (selectedText.trim()) {
      applyCommand("createLink", href);
      return;
    }
    insertHtml(`<a href="${escapeAttribute(href)}">${escapeHtml(target.titulo || "Nota")}</a>`);
  }

  const toolbar = [
    { label: "Deshacer", icon: Undo2, action: () => applyCommand("undo") },
    { label: "Rehacer", icon: Redo2, action: () => applyCommand("redo") },
    { label: "Negrita", icon: Bold, action: () => applyCommand("bold") },
    { label: "Cursiva", icon: Italic, action: () => applyCommand("italic") },
    { label: "Titulo 1", icon: Heading1, action: () => applyHeading(1) },
    { label: "Titulo 2", icon: Heading2, action: () => applyHeading(2) },
    { label: "Titulo 3", icon: Heading3, action: () => applyHeading(3) },
    { label: "Lista", icon: List, action: () => applyCommand("insertUnorderedList") },
    { label: "Numerada", icon: ListOrdered, action: () => applyCommand("insertOrderedList") },
    { label: "Tarea", icon: CheckSquare, action: () => insertHtml("<ul><li>[ ] tarea</li></ul>") },
    { label: "Link", icon: Link, action: insertLink },
    { label: "Nota", icon: StickyNote, action: () => runSlashCommand("nota") },
    { label: "Imagen", icon: ImageIcon, action: () => runSlashCommand("imagen") },
    { label: "Audio", icon: Volume2, action: () => runSlashCommand("audio") },
    { label: "Video", icon: Video, action: () => runSlashCommand("youtube") },
    { label: "Tabla", icon: Table2, action: insertTable },
    { label: "Codigo", icon: Code2, action: insertCode },
    { label: "Cita", icon: Quote, action: insertQuote },
  ];

  async function submit(event) {
    event.preventDefault();
    const latestMarkdown = htmlToMarkdown(editorRef.current);
    if (!form.titulo.trim()) return;
    setSaving(true);
    try {
      await onSave({ ...form, contenidoMarkdown: latestMarkdown });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className={`note-editor note-editor-inline ${mode === "chapter" ? "chapter-note-editor" : ""}`} onSubmit={submit}>
      <div className="notebook-editor-head">
        <input className="note-title-input" value={form.titulo} onChange={(event) => setField("titulo", event.target.value)} placeholder="Titulo de la nota" />
        <button className="primary small" disabled={saving}><Save size={16} /> {saving ? "Guardando..." : "Guardar"}</button>
      </div>
      {folders.length || mode !== "chapter" ? (
        <div className="note-meta-row">
          <label>Carpeta
            <select value={form.folderId || ""} onChange={(event) => setField("folderId", event.target.value)}>
              <option value="">Sin carpeta</option>
              {folders.map((folder) => <option key={folder.id} value={folder.id}>{folder.nombre}</option>)}
            </select>
          </label>
          <label>Estado
            <select value={form.estado} onChange={(event) => setField("estado", event.target.value)}>
              <option value="borrador">Borrador</option>
              <option value="listo">Listo</option>
              <option value="publicado">Publicado</option>
            </select>
          </label>
          <label>Palabras clave
            <input value={form.keywords || ""} onChange={(event) => setField("keywords", event.target.value)} placeholder="Ej: ansiedad, vata, calma, respiración, Ganesha" />
          </label>
        </div>
      ) : (
        <input type="hidden" value={form.estado} readOnly />
      )}
      {folders.length || mode !== "chapter" ? null : (
        <div className="chapter-status-row">
          <span>{form.estado || "borrador"}</span>
        </div>
      )}
      <div className="note-editor-tabs">
        <span>Editor visual</span>
      </div>
      <div className="note-format-toolbar" aria-label="Herramientas de formato">
        {toolbar.map(({ label, icon: Icon, action }) => (
          <button
            key={label}
            type="button"
            onMouseDown={(event) => {
              event.preventDefault();
              restoreSelection();
              action();
            }}
            title={label}
          >
            <Icon size={15} />
          </button>
        ))}
      </div>
      <div className="note-editor-grid">
        <label className="markdown-field">
          <span className="editor-shell">
            <div
              ref={editorRef}
              className="markdown-editor visual-note-editor markdown-body"
              contentEditable
              suppressContentEditableWarning
              data-placeholder="Escribi tu nota. Usa / para insertar una nota, video, PDF, audio o imagen."
              onInput={() => {
                saveSelection();
                syncEditor();
              }}
              onKeyUp={() => {
                saveSelection();
                syncEditor();
              }}
              onKeyDown={handleEditorKeyDown}
              onMouseUp={saveSelection}
              onPaste={() => window.setTimeout(() => syncEditor(), 0)}
            />
            {showSlash ? (
              <div className="slash-menu">
                {slashCommands.map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    type="button"
                    onMouseDown={(event) => {
                      event.preventDefault();
                      restoreSelection();
                      runSlashCommand(id);
                    }}
                  >
                    <Icon size={16} />
                    <span>{label}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </span>
        </label>
      </div>
      {!hideResourceFields ? (
        <div className="note-url-grid">
          <label><ImageIcon size={14} /> Imagen<input value={form.imagenUrl} onChange={(event) => setField("imagenUrl", event.target.value)} placeholder="Pega el link aqui..." /></label>
          <label><Music size={14} /> Audio<input value={form.audioUrl} onChange={(event) => setField("audioUrl", event.target.value)} placeholder="Pega el link aqui..." /></label>
          <label><Link size={14} /> PDF<input value={form.pdfUrl} onChange={(event) => setField("pdfUrl", event.target.value)} placeholder="Pega el link aqui..." /></label>
          <label><Video size={14} /> Video<input value={form.videoUrl} onChange={(event) => setField("videoUrl", event.target.value)} placeholder="Pega el link aqui..." /></label>
        </div>
      ) : null}
    </form>
  );
}

function markdownToHtml(markdown = "") {
  const lines = markdown.split(/\r?\n/);
  const html = [];
  let listItems = [];
  let orderedItems = [];

  function flushList() {
    if (listItems.length) {
      html.push(`<ul>${listItems.map((item) => `<li>${renderInlineMarkdown(item)}</li>`).join("")}</ul>`);
      listItems = [];
    }
    if (orderedItems.length) {
      html.push(`<ol>${orderedItems.map((item) => `<li>${renderInlineMarkdown(item)}</li>`).join("")}</ol>`);
      orderedItems = [];
    }
  }

  for (let index = 0; index < lines.length; index += 1) {
    const rawLine = lines[index];
    const line = rawLine.trim();
    if (!line) {
      flushList();
      continue;
    }
    if (line.startsWith("|")) {
      const tableLines = [];
      while (index < lines.length && lines[index].trim().startsWith("|")) {
        tableLines.push(lines[index]);
        index += 1;
      }
      index -= 1;
      flushList();
      html.push(markdownTableToHtml(tableLines.join("\n")));
      continue;
    }
    if (line.startsWith("- ")) {
      orderedItems = [];
      listItems.push(line.slice(2));
      continue;
    }
    const ordered = line.match(/^\d+\.\s+(.+)$/);
    if (ordered) {
      listItems = [];
      orderedItems.push(ordered[1]);
      continue;
    }
    flushList();
    if (line.startsWith("### ")) html.push(`<h3>${renderInlineMarkdown(line.slice(4))}</h3>`);
    else if (line.startsWith("## ")) html.push(`<h2>${renderInlineMarkdown(line.slice(3))}</h2>`);
    else if (line.startsWith("# ")) html.push(`<h1>${renderInlineMarkdown(line.slice(2))}</h1>`);
    else if (line.startsWith("> ")) html.push(`<blockquote>${renderInlineMarkdown(line.slice(2))}</blockquote>`);
    else html.push(`<p>${renderInlineMarkdown(line)}</p>`);
  }
  flushList();
  return html.join("");
}

function renderInlineMarkdown(text = "") {
  let html = escapeHtml(text);
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, alt, src) => `<img src="${escapeAttribute(src)}" alt="${escapeAttribute(alt)}" />`);
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, href) => `<a href="${escapeAttribute(href)}">${label}</a>`);
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
  return html;
}

function htmlToMarkdown(root) {
  if (!root) return "";
  return Array.from(root.childNodes)
    .map((node) => blockToMarkdown(node))
    .join("")
    .replace(/\u00a0/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function blockToMarkdown(node) {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent || "";
  if (node.nodeType !== Node.ELEMENT_NODE) return "";
  const tag = node.tagName.toLowerCase();
  if (tag === "br") return "\n";
  if (tag === "h1") return `# ${inlineToMarkdown(node)}\n`;
  if (tag === "h2") return `## ${inlineToMarkdown(node)}\n`;
  if (tag === "h3") return `### ${inlineToMarkdown(node)}\n`;
  if (tag === "blockquote") return `> ${inlineToMarkdown(node)}\n`;
  if (tag === "ul") return `${Array.from(node.children).map((child) => `- ${inlineToMarkdown(child)}`).join("\n")}\n`;
  if (tag === "ol") return `${Array.from(node.children).map((child, index) => `${index + 1}. ${inlineToMarkdown(child)}`).join("\n")}\n`;
  if (tag === "table") return `${htmlTableToMarkdown(node)}\n`;
  if (tag === "figure") return `${inlineToMarkdown(node)}\n`;
  if (tag === "p" || tag === "div") return `${inlineToMarkdown(node)}\n`;
  return inlineToMarkdown(node);
}

function inlineToMarkdown(node) {
  return Array.from(node.childNodes).map((child) => {
    if (child.nodeType === Node.TEXT_NODE) return child.textContent || "";
    if (child.nodeType !== Node.ELEMENT_NODE) return "";
    const tag = child.tagName.toLowerCase();
    const text = inlineToMarkdown(child);
    if (tag === "strong" || tag === "b") return `**${text}**`;
    if (tag === "em" || tag === "i") return `*${text}*`;
    if (tag === "code") return `\`${text}\``;
    if (tag === "a") return `[${text || child.href}](${child.getAttribute("href") || child.href})`;
    if (tag === "img") return `![${child.getAttribute("alt") || "Imagen"}](${child.getAttribute("src") || child.src})`;
    if (tag === "br") return "\n";
    if (tag === "li") return inlineToMarkdown(child);
    if (tag === "td" || tag === "th") return inlineToMarkdown(child);
    return text;
  }).join("").trim();
}

function markdownTableToHtml(table = "") {
  const rows = table.trim().split(/\r?\n/).filter((row) => row.trim().startsWith("|"));
  if (rows.length < 2) return `<p>${renderInlineMarkdown(table)}</p>`;
  const cells = rows.map((row) => row.trim().replace(/^\||\|$/g, "").split("|").map((cell) => cell.trim()));
  const headers = cells[0] || [];
  const body = cells.slice(2);
  return `<table><thead><tr>${headers.map((header) => `<th>${renderInlineMarkdown(header)}</th>`).join("")}</tr></thead><tbody>${body.map((row) => `<tr>${row.map((cell) => `<td>${renderInlineMarkdown(cell)}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
}

function htmlTableToMarkdown(table) {
  const rows = Array.from(table.querySelectorAll("tr")).map((row) => Array.from(row.children).map((cell) => inlineToMarkdown(cell).replace(/\|/g, "\\|")));
  if (!rows.length) return "";
  const columnCount = Math.max(...rows.map((row) => row.length));
  const normalized = rows.map((row) => Array.from({ length: columnCount }, (_, index) => row[index] || ""));
  const header = normalized[0];
  const divider = header.map(() => "---");
  const body = normalized.slice(1);
  return [header, divider, ...body].map((row) => `| ${row.join(" | ")} |`).join("\n");
}

function getTextBeforeCursor(editor) {
  const selection = window.getSelection();
  if (!selection?.rangeCount) return "";
  const range = selection.getRangeAt(0).cloneRange();
  if (!editor || !editor.contains(range.startContainer)) return "";
  range.selectNodeContents(editor);
  range.setEnd(selection.anchorNode, selection.anchorOffset);
  return range.toString();
}

function removeSlashBeforeCursor(editor) {
  const selection = window.getSelection();
  if (!selection?.rangeCount || !getTextBeforeCursor(editor).endsWith("/")) return;
  const range = selection.getRangeAt(0);
  if (range.startOffset > 0 && range.startContainer.nodeType === Node.TEXT_NODE) {
    range.setStart(range.startContainer, range.startOffset - 1);
    range.deleteContents();
  }
}

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeAttribute(value = "") {
  return escapeHtml(value).replace(/"/g, "&quot;");
}
