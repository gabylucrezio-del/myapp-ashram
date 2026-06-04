import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, File, GripVertical, Image, Plus, Trash2 } from "lucide-react";

const blockTypes = [
  ["paragraph", "Parrafo"],
  ["h1", "Titulo 1"],
  ["h2", "Titulo 2"],
  ["h3", "Titulo 3"],
  ["ul", "Lista"],
  ["ol", "Lista numerada"],
  ["checklist", "Checklist"],
  ["quote", "Cita"],
  ["image", "Imagen"],
  ["video", "Video"],
  ["table", "Tabla"],
  ["hr", "Separador"],
  ["code", "Codigo"],
  ["drive", "Archivo Drive"],
];

const AppFlowyBlockEditor = forwardRef(function AppFlowyBlockEditor({ markdown = "", onChange }, ref) {
  const [blocks, setBlocks] = useState(() => markdownToBlocks(markdown));
  const [activeId, setActiveId] = useState("");
  const [slashBlockId, setSlashBlockId] = useState("");
  const lastEmittedMarkdownRef = useRef(markdown);

  useEffect(() => {
    if (markdown === lastEmittedMarkdownRef.current) return;
    setBlocks(markdownToBlocks(markdown));
    lastEmittedMarkdownRef.current = markdown;
  }, [markdown]);

  useImperativeHandle(ref, () => ({
    handleToolbarAction(action) {
      const targetId = activeId || blocks[blocks.length - 1]?.id;
      if (!targetId) return;
      if (["h1", "h2", "h3", "quote", "ul", "ol", "checklist", "code"].includes(action)) {
        transformBlock(targetId, typeFromAction(action));
        return;
      }
      if (action === "hr") return insertBlockAfter(targetId, createBlock("hr"));
      if (action === "table") return insertBlockAfter(targetId, createBlock("table"));
      if (action === "image") return insertMediaBlock(targetId, "image");
      if (action === "video") return insertMediaBlock(targetId, "video");
      if (action === "link") return document.execCommand("createLink", false, window.prompt("URL", "https://") || "");
      if (action === "bold") return document.execCommand("bold");
      if (action === "italic") return document.execCommand("italic");
      if (action === "strike") return document.execCommand("strikeThrough");
      if (action === "inlineCode") return document.execCommand("formatBlock", false, "code");
      if (action === "left") return document.execCommand("justifyLeft");
      if (action === "center") return document.execCommand("justifyCenter");
      if (action === "right") return document.execCommand("justifyRight");
    },
  }), [activeId, blocks]);

  const slashOptions = useMemo(() => blockTypes, []);

  function commit(nextBlocks) {
    const nextMarkdown = blocksToMarkdown(nextBlocks);
    lastEmittedMarkdownRef.current = nextMarkdown;
    setBlocks(nextBlocks);
    onChange?.(nextMarkdown);
  }

  function updateBlock(id, patch) {
    commit(blocks.map((block) => block.id === id ? { ...block, ...patch } : block));
  }

  function insertBlockAfter(id, block = createBlock("paragraph")) {
    const index = blocks.findIndex((item) => item.id === id);
    const next = [...blocks];
    next.splice(index + 1, 0, block);
    commit(next);
    setActiveId(block.id);
  }

  function transformBlock(id, type) {
    updateBlock(id, normalizeBlockForType(blocks.find((block) => block.id === id), type));
    setSlashBlockId("");
  }

  function removeBlock(id) {
    const next = blocks.filter((block) => block.id !== id);
    commit(next.length ? next : [createBlock("paragraph")]);
  }

  function moveBlock(id, direction) {
    const index = blocks.findIndex((block) => block.id === id);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= blocks.length) return;
    const next = [...blocks];
    [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
    commit(next);
  }

  function insertMediaBlock(id, type) {
    const url = window.prompt(type === "image" ? "URL de imagen" : "URL de video");
    if (!url) return;
    insertBlockAfter(id, createBlock(type, { url, caption: "", align: "center", width: "60%" }));
  }

  function handleTextInput(block, event) {
    const value = event.currentTarget.innerText;
    if (value.endsWith("/")) setSlashBlockId(block.id);
    updateBlock(block.id, { content: value.replace(/\/$/, "") });
  }

  function handleKeyDown(block, event) {
    if (event.key === "Enter" && !event.shiftKey && !["table", "image", "video", "hr"].includes(block.type)) {
      event.preventDefault();
      insertBlockAfter(block.id);
    }
    if (event.key === "Backspace" && !block.content && blocks.length > 1) {
      event.preventDefault();
      removeBlock(block.id);
    }
  }

  return (
    <div className="appflowy-editor" aria-label="Editor por bloques">
      {blocks.map((block) => (
        <div className={`appflowy-block ${block.type}`} key={block.id} onFocus={() => setActiveId(block.id)}>
          <div className="block-controls">
            <button type="button" title="Insertar bloque" onClick={() => insertBlockAfter(block.id)}>
              <Plus size={14} />
            </button>
            <span title="Bloque"><GripVertical size={14} /></span>
          </div>
          <div className="block-body">
            <BlockRenderer
              block={block}
              onInput={handleTextInput}
              onKeyDown={handleKeyDown}
              onUpdate={updateBlock}
            />
            {slashBlockId === block.id ? (
              <div className="block-slash-menu">
                {slashOptions.map(([type, label]) => (
                  <button key={type} type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => transformBlock(block.id, type)}>
                    {label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          <div className="block-actions">
            <select value={block.type} onChange={(event) => transformBlock(block.id, event.target.value)} title="Tipo de bloque">
              {blockTypes.map(([type, label]) => <option key={type} value={type}>{label}</option>)}
            </select>
            <button type="button" title="Mover arriba" onClick={() => moveBlock(block.id, -1)}><ArrowUp size={13} /></button>
            <button type="button" title="Mover abajo" onClick={() => moveBlock(block.id, 1)}><ArrowDown size={13} /></button>
            <button type="button" title="Eliminar" onClick={() => removeBlock(block.id)}><Trash2 size={13} /></button>
          </div>
        </div>
      ))}
    </div>
  );
});

export default AppFlowyBlockEditor;

function BlockRenderer({ block, onInput, onKeyDown, onUpdate }) {
  if (block.type === "hr") return <hr className="appflowy-hr" />;
  if (block.type === "image") {
    return (
      <div className="appflowy-media-block" style={{ textAlign: block.align || "center" }}>
        {block.url ? <img src={block.url} alt={block.alt || ""} style={{ width: block.width || "60%", maxWidth: "100%" }} /> : <Image size={28} />}
        <input value={block.url || ""} onChange={(event) => onUpdate(block.id, { url: event.target.value })} placeholder="URL de imagen o Drive" />
        <input value={block.caption || ""} onChange={(event) => onUpdate(block.id, { caption: event.target.value })} placeholder="Pie de imagen" />
        <div className="media-options">
          {["left", "center", "right"].map((align) => <button key={align} type="button" onClick={() => onUpdate(block.id, { align })}>{align}</button>)}
          {["25%", "50%", "75%", "100%"].map((width) => <button key={width} type="button" onClick={() => onUpdate(block.id, { width })}>{width}</button>)}
        </div>
      </div>
    );
  }
  if (block.type === "video") {
    return (
      <div className="appflowy-media-block">
        {block.url ? <iframe title="Video" src={videoEmbedUrl(block.url)} allowFullScreen /> : null}
        <input value={block.url || ""} onChange={(event) => onUpdate(block.id, { url: event.target.value })} placeholder="URL de video" />
      </div>
    );
  }
  if (block.type === "drive") {
    return (
      <div className="appflowy-drive-block">
        <File size={17} />
        <input value={block.url || ""} onChange={(event) => onUpdate(block.id, { url: event.target.value })} placeholder="URL de archivo Drive" />
      </div>
    );
  }
  if (block.type === "table") return <EditableTable block={block} onUpdate={onUpdate} />;

  const Tag = blockTag(block.type);
  return (
    <Tag
      className="block-editable"
      contentEditable
      suppressContentEditableWarning
      onInput={(event) => onInput(block, event)}
      onKeyDown={(event) => onKeyDown(block, event)}
    >
      {block.content}
    </Tag>
  );
}

function EditableTable({ block, onUpdate }) {
  const rows = block.rows?.length ? block.rows : [["Columna 1", "Columna 2"], ["Texto", "Texto"]];
  function updateCell(rowIndex, cellIndex, value) {
    const next = rows.map((row) => [...row]);
    next[rowIndex][cellIndex] = value;
    onUpdate(block.id, { rows: next });
  }
  function addRow() {
    onUpdate(block.id, { rows: [...rows, rows[0].map(() => "")] });
  }
  function addColumn() {
    onUpdate(block.id, { rows: rows.map((row, index) => [...row, index === 0 ? `Columna ${row.length + 1}` : ""]) });
  }
  function removeRow() {
    if (rows.length > 1) onUpdate(block.id, { rows: rows.slice(0, -1) });
  }
  function removeColumn() {
    if (rows[0]?.length > 1) onUpdate(block.id, { rows: rows.map((row) => row.slice(0, -1)) });
  }
  return (
    <div className="appflowy-table-block">
      <table>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} contentEditable suppressContentEditableWarning onInput={(event) => updateCell(rowIndex, cellIndex, event.currentTarget.innerText)}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="table-actions">
        <button type="button" onClick={addRow}>+ fila</button>
        <button type="button" onClick={removeRow}>- fila</button>
        <button type="button" onClick={addColumn}>+ columna</button>
        <button type="button" onClick={removeColumn}>- columna</button>
      </div>
    </div>
  );
}

function createBlock(type = "paragraph", patch = {}) {
  return normalizeBlockForType({ id: crypto.randomUUID(), type, content: "", ...patch }, type);
}

function normalizeBlockForType(block = {}, type = "paragraph") {
  const base = { ...block, id: block.id || crypto.randomUUID(), type };
  if (type === "table") return { ...base, rows: base.rows || [["Columna 1", "Columna 2"], ["Texto", "Texto"]] };
  if (["image", "video", "drive"].includes(type)) return { ...base, url: base.url || "", caption: base.caption || "" };
  return base;
}

function typeFromAction(action) {
  if (action === "ul") return "ul";
  return action;
}

function blockTag(type) {
  if (type === "h1") return "h1";
  if (type === "h2") return "h2";
  if (type === "h3") return "h3";
  if (type === "quote") return "blockquote";
  if (type === "code") return "pre";
  if (type === "ul" || type === "checklist") return "p";
  return "p";
}

function markdownToBlocks(markdown = "") {
  const lines = markdown.split("\n");
  const blocks = [];
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line.trim()) continue;
    if (line.startsWith("|")) {
      const tableLines = [];
      while (lines[i]?.startsWith("|")) {
        tableLines.push(lines[i]);
        i += 1;
      }
      i -= 1;
      blocks.push(createBlock("table", { rows: parseTable(tableLines) }));
      continue;
    }
    if (line.includes('class="image-block"')) {
      blocks.push(createBlock("image", parseImageBlock(line)));
      continue;
    }
    if (line.includes('class="video-block"')) {
      blocks.push(createBlock("video", { url: extractAttr(line, "src") }));
      continue;
    }
    if (line.startsWith("# ")) blocks.push(createBlock("h1", { content: line.replace(/^#\s+/, "") }));
    else if (line.startsWith("## ")) blocks.push(createBlock("h2", { content: line.replace(/^##\s+/, "") }));
    else if (line.startsWith("### ")) blocks.push(createBlock("h3", { content: line.replace(/^###\s+/, "") }));
    else if (line.startsWith("> ")) blocks.push(createBlock("quote", { content: line.replace(/^>\s+/, "") }));
    else if (/^-\s+\[[ x]\]/i.test(line)) blocks.push(createBlock("checklist", { content: line.replace(/^-\s+\[[ x]\]\s+/i, "") }));
    else if (line.startsWith("- ")) blocks.push(createBlock("ul", { content: line.replace(/^-\s+/, "") }));
    else if (/^\d+\.\s+/.test(line)) blocks.push(createBlock("ol", { content: line.replace(/^\d+\.\s+/, "") }));
    else if (line.trim() === "---") blocks.push(createBlock("hr"));
    else blocks.push(createBlock("paragraph", { content: line }));
  }
  return blocks.length ? blocks : [createBlock("paragraph")];
}

function blocksToMarkdown(blocks = []) {
  return blocks.map((block) => {
    const content = block.content || "";
    if (block.type === "h1") return `# ${content}`;
    if (block.type === "h2") return `## ${content}`;
    if (block.type === "h3") return `### ${content}`;
    if (block.type === "quote") return `> ${content}`;
    if (block.type === "ul") return `- ${content}`;
    if (block.type === "ol") return `1. ${content}`;
    if (block.type === "checklist") return `- [ ] ${content}`;
    if (block.type === "code") return `\`\`\`\n${content}\n\`\`\``;
    if (block.type === "hr") return "---";
    if (block.type === "image") return `<div class="image-block" style="text-align:${block.align || "center"};"><img src="${block.url || ""}" alt="${block.alt || ""}" style="width:${block.width || "60%"}; max-width:100%;" />${block.caption ? `<p class="caption">${block.caption}</p>` : ""}</div>`;
    if (block.type === "video") return `<div class="video-block"><iframe src="${videoEmbedUrl(block.url || "")}" allowfullscreen></iframe></div>`;
    if (block.type === "drive") return `[Archivo Drive](${block.url || ""})`;
    if (block.type === "table") return tableToMarkdown(block.rows || []);
    return content;
  }).filter(Boolean).join("\n\n");
}

function parseTable(lines) {
  return lines
    .filter((line) => !/^\|\s*-+/.test(line))
    .map((line) => line.split("|").slice(1, -1).map((cell) => cell.trim()));
}

function tableToMarkdown(rows = []) {
  if (!rows.length) return "";
  const header = rows[0];
  const separator = header.map(() => "---------");
  return [header, separator, ...rows.slice(1)].map((row) => `| ${row.join(" | ")} |`).join("\n");
}

function parseImageBlock(value) {
  return {
    url: extractAttr(value, "src"),
    alt: extractAttr(value, "alt"),
    width: (extractAttr(value, "style").match(/width:([^;]+)/)?.[1] || "60%").trim(),
    align: (value.match(/text-align:([^;"]+)/)?.[1] || "center").trim(),
    caption: value.match(/<p class="caption">([\s\S]*?)<\/p>/)?.[1] || "",
  };
}

function extractAttr(value = "", attr = "") {
  return value.match(new RegExp(`${attr}="([^"]*)"`))?.[1] || "";
}

function videoEmbedUrl(url = "") {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes("youtube.com")) {
      const id = parsed.searchParams.get("v");
      return id ? `https://www.youtube.com/embed/${id}` : url;
    }
    if (parsed.hostname.includes("youtu.be")) return `https://www.youtube.com/embed/${parsed.pathname.slice(1)}`;
    if (parsed.hostname.includes("vimeo.com")) return `https://player.vimeo.com/video/${parsed.pathname.split("/").filter(Boolean).pop()}`;
    if (parsed.hostname.includes("drive.google.com")) return url.replace("/view", "/preview");
    return url;
  } catch {
    return url;
  }
}
