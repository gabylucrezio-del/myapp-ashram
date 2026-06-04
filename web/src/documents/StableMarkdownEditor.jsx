import {
  BlockTypeSelect,
  BoldItalicUnderlineToggles,
  CreateLink,
  InsertTable,
  InsertThematicBreak,
  ListsToggle,
  MDXEditor,
  Separator,
  UndoRedo,
  codeBlockPlugin,
  codeMirrorPlugin,
  headingsPlugin,
  imagePlugin,
  linkDialogPlugin,
  linkPlugin,
  listsPlugin,
  markdownShortcutPlugin,
  quotePlugin,
  tablePlugin,
  thematicBreakPlugin,
  toolbarPlugin,
} from "@mdxeditor/editor";
import "@mdxeditor/editor/style.css";
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";

const INTERNAL_LINK_SELECTOR = [
  "a[href^='ashram-doc://']",
  "a[href^='ashram-new-doc://']",
  "a[href^='ashram-name-doc://']",
  "a[href^='#ashram-doc:']",
  "a[href^='#ashram-new-doc:']",
  "a[href^='#ashram-name-doc:']",
].join(", ");

const slashCommands = [
  { id: "h1", label: "Titulo 1", markdown: "# " },
  { id: "h2", label: "Titulo 2", markdown: "## " },
  { id: "h3", label: "Titulo 3", markdown: "### " },
  { id: "list", label: "Lista", markdown: "- " },
  { id: "checklist", label: "Checklist", markdown: "- [ ] " },
  { id: "quote", label: "Cita", markdown: "> " },
  { id: "image", label: "Imagen", markdown: "![imagen](https://)\n" },
  { id: "video", label: "Video", markdown: '<div class="video-block"><iframe src="URL" allowfullscreen></iframe></div>\n' },
  { id: "table", label: "Tabla", markdown: "\n| Columna 1 | Columna 2 |\n| --------- | --------- |\n| Texto | Texto |\n\n" },
  { id: "hr", label: "Separador", markdown: "\n---\n\n" },
  { id: "code", label: "Codigo", markdown: "```\n\n```\n" },
];

const StableMarkdownEditor = forwardRef(function StableMarkdownEditor({
  documentId,
  markdown = "",
  onChange,
  onInternalLinkClick,
  onPendingInternalLinkClick,
  onNamedInternalLinkClick,
  getInternalLinkInfo,
  onImageAction,
}, ref) {
  const [initialMarkdown, setInitialMarkdown] = useState(toEditorMarkdown(markdown || ""));
  const [hoverLink, setHoverLink] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);
  const [slashMenu, setSlashMenu] = useState(null);
  const editorRef = useRef(null);
  const lastLinkActivationRef = useRef({ href: "", time: 0 });

  useEffect(() => {
    setInitialMarkdown(toEditorMarkdown(markdown || ""));
  }, [documentId]);

  useImperativeHandle(ref, () => ({
    insertMarkdown(value) {
      const editor = editorRef.current;
      if (!editor) {
        console.warn("Insertando imagen en editor: no existe editor instance");
        return "";
      }
      const before = fromEditorMarkdown(editor.getMarkdown?.() || "");
      const editorValue = toEditorMarkdown(value);
      editor.focus?.(() => editor.insertMarkdown(editorValue), { preventScroll: true });
      window.setTimeout(() => {
        const after = fromEditorMarkdown(editor.getMarkdown?.() || "");
        if (after && after !== before) {
          onChange?.(after, documentId);
          return;
        }
        const fallback = `${before || ""}\n${value}\n`;
        console.warn("Insertando imagen en editor: fallback setMarkdown");
        editor.setMarkdown(toEditorMarkdown(fallback));
        onChange?.(fallback, documentId);
      }, 80);
      return before;
    },
    getMarkdown() {
      return fromEditorMarkdown(editorRef.current?.getMarkdown() || "");
    },
    setMarkdown(value) {
      editorRef.current?.setMarkdown(toEditorMarkdown(value));
    },
  }));

  function activateInternalLink(event) {
    const link = event.target?.closest?.(INTERNAL_LINK_SELECTOR);
    if (!link) return false;
    event.preventDefault();
    event.stopPropagation();
    link.classList.add("internal-link");
    const href = link.getAttribute("href") || "";
    const parsedLink = parseInternalHref(href);
    if (!parsedLink) return false;
    const now = Date.now();
    if (lastLinkActivationRef.current.href === href && now - lastLinkActivationRef.current.time < 350) {
      return true;
    }
    lastLinkActivationRef.current = { href, time: now };
    if (parsedLink.type === "new") {
      onPendingInternalLinkClick?.(parsedLink.target);
      return true;
    }
    if (parsedLink.type === "name") {
      onNamedInternalLinkClick?.(parsedLink.target);
      return true;
    }
    onInternalLinkClick?.(parsedLink.target);
    return true;
  }

  function handlePointerDownCapture(event) {
    if (event.button && event.button !== 0) return;
    activateInternalLink(event);
  }

  function handleClick(event) {
    const image = event.target?.closest?.(".image-block img, img");
    if (image) {
      const rect = image.getBoundingClientRect();
      setSelectedImage({
        src: image.getAttribute("src") || "",
        alt: image.getAttribute("alt") || "",
        x: Math.min(rect.left, window.innerWidth - 300),
        y: Math.min(rect.bottom + 8, window.innerHeight - 180),
      });
      return;
    }

    activateInternalLink(event);
  }

  function handleMouseOver(event) {
    const link = event.target?.closest?.(INTERNAL_LINK_SELECTOR);
    if (!link) return;
    link.classList.add("internal-link");
    const href = link.getAttribute("href") || "";
    const parsedLink = parseInternalHref(href);
    if (!parsedLink) return;
    const isNew = parsedLink.type === "new";
    const isNamed = parsedLink.type === "name";
    const target = parsedLink.target;
    const info = isNamed ? getInternalLinkInfo?.(target, "name") : getInternalLinkInfo?.(target);
    const rect = link.getBoundingClientRect();
    setHoverLink({
      isPending: isNew || (isNamed && !info),
      target,
      isNamed,
      x: Math.min(rect.left, window.innerWidth - 280),
      y: Math.min(rect.bottom + 8, window.innerHeight - 142),
      info: isNew ? null : info,
    });
  }

  function handleKeyDownCapture(event) {
    if (event.key === "Escape") {
      setSlashMenu(null);
      return;
    }
    if (event.key !== "/" || event.ctrlKey || event.metaKey || event.altKey) return;
    const target = event.target;
    if (!target?.closest?.(".stable-markdown-editor")) return;
    event.preventDefault();
    const rect = getSelectionRect();
    setSlashMenu({
      x: Math.min(rect.left, window.innerWidth - 260),
      y: Math.min(rect.bottom + 8, window.innerHeight - 330),
    });
  }

  function insertSlashCommand(command) {
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus?.(() => editor.insertMarkdown(toEditorMarkdown(command.markdown)), { preventScroll: true });
    window.setTimeout(() => {
      onChange?.(fromEditorMarkdown(editor.getMarkdown?.() || ""), documentId);
    }, 80);
    setSlashMenu(null);
  }

  return (
    <div
      className="stable-markdown-editor"
      onPointerDownCapture={handlePointerDownCapture}
      onClick={handleClick}
      onMouseOver={handleMouseOver}
      onKeyDownCapture={handleKeyDownCapture}
    >
      <MDXEditor
        ref={editorRef}
        key={documentId || "new-document"}
        markdown={initialMarkdown}
        onChange={(value) => onChange?.(fromEditorMarkdown(value), documentId)}
        contentEditableClassName="stable-markdown-surface"
        plugins={[
          headingsPlugin(),
          listsPlugin(),
          quotePlugin(),
          thematicBreakPlugin(),
          linkPlugin(),
          linkDialogPlugin(),
          imagePlugin(),
          tablePlugin(),
          codeBlockPlugin({ defaultCodeBlockLanguage: "txt" }),
          codeMirrorPlugin({ codeBlockLanguages: { txt: "Texto", js: "JavaScript", css: "CSS", html: "HTML", md: "Markdown" } }),
          markdownShortcutPlugin(),
          toolbarPlugin({
            toolbarContents: () => (
              <>
                <UndoRedo />
                <Separator />
                <BlockTypeSelect />
                <Separator />
                <BoldItalicUnderlineToggles />
                <Separator />
                <ListsToggle />
                <Separator />
                <CreateLink />
                <InsertTable />
                <InsertThematicBreak />
              </>
            ),
          }),
        ]}
      />
      {hoverLink ? (
        <InternalLinkTooltip
          link={hoverLink}
          onClose={() => setHoverLink(null)}
          onOpen={onInternalLinkClick}
          onCreate={onPendingInternalLinkClick}
          onNamedOpen={onNamedInternalLinkClick}
        />
      ) : null}
      {selectedImage ? (
        <ImageBlockControls
          image={selectedImage}
          onClose={() => setSelectedImage(null)}
          onAction={(action, value) => {
            const markdown = fromEditorMarkdown(editorRef.current?.getMarkdown() || "");
            const nextMarkdown = updateImageBlock(markdown, selectedImage.src, action, value);
            editorRef.current?.setMarkdown(toEditorMarkdown(nextMarkdown));
            onImageAction?.(nextMarkdown);
            setSelectedImage(null);
          }}
        />
      ) : null}
      {slashMenu ? (
        <SlashCommandMenu
          position={slashMenu}
          commands={slashCommands}
          onChoose={insertSlashCommand}
          onClose={() => setSlashMenu(null)}
        />
      ) : null}
    </div>
  );
});

export default StableMarkdownEditor;

function InternalLinkTooltip({ link, onClose, onOpen, onCreate, onNamedOpen }) {
  return (
    <div className="internal-link-tooltip" style={{ left: link.x, top: link.y }} onMouseLeave={onClose}>
      {link.isPending ? (
        <>
          <strong>Este documento todavia no existe</strong>
          <small>Destino sugerido: carpeta actual</small>
          <button type="button" onClick={() => link.isNamed ? onNamedOpen?.(link.target) : onCreate?.(link.target)}>
            Crear documento
          </button>
        </>
      ) : (
        <>
          <strong>{link.info?.title || "Documento vinculado"}</strong>
          <small>{link.info?.folderPath || "Ashram Ganesha"}</small>
          <button type="button" onClick={() => link.isNamed ? onNamedOpen?.(link.target) : onOpen?.(link.target)}>
            Abrir documento
          </button>
        </>
      )}
    </div>
  );
}

function ImageBlockControls({ image, onClose, onAction }) {
  return (
    <div className="image-block-controls" style={{ left: image.x, top: image.y }} onMouseLeave={onClose}>
      <strong>Imagen</strong>
      <div>
        {["25%", "50%", "75%", "100%"].map((size) => (
          <button key={size} type="button" onClick={() => onAction("resize", size)}>{size}</button>
        ))}
      </div>
      <div>
        <button type="button" onClick={() => onAction("align", "left")}>Izq.</button>
        <button type="button" onClick={() => onAction("align", "center")}>Centro</button>
        <button type="button" onClick={() => onAction("align", "right")}>Der.</button>
      </div>
      <button type="button" onClick={() => onAction("caption", window.prompt("Pie de imagen", "") || "")}>Pie de imagen</button>
      <button type="button" onClick={() => onAction("replace", window.prompt("Nueva URL de imagen", image.src) || image.src)}>Reemplazar</button>
      <button type="button" onClick={() => onAction("delete")}>Eliminar</button>
    </div>
  );
}

function SlashCommandMenu({ position, commands, onChoose, onClose }) {
  return (
    <div className="appflowy-slash-command-menu" style={{ left: position.x, top: position.y }} onMouseLeave={onClose}>
      <strong>Insertar bloque</strong>
      {commands.map((command) => (
        <button key={command.id} type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => onChoose(command)}>
          {command.label}
        </button>
      ))}
    </div>
  );
}

function getSelectionRect() {
  const selection = window.getSelection?.();
  if (selection?.rangeCount) {
    const rect = selection.getRangeAt(0).getBoundingClientRect();
    if (rect.width || rect.height) return rect;
  }
  return { left: 24, bottom: 120 };
}

function toEditorMarkdown(markdown = "") {
  return markdown
    .replace(/\[\[new:([^\]\n]+)\]\]/g, (_match, title) => `[${title}](#ashram-new-doc:${encodeURIComponent(title)})`)
    .replace(/\[\[([^|\]\n]+)\|([^\]\n]+)\]\]/g, (_match, id, title) => `[${title}](#ashram-doc:${encodeURIComponent(id)})`)
    .replace(/\[\[([^|\]\n]+)\]\]/g, (_match, title) => `[${title}](#ashram-name-doc:${encodeURIComponent(title)})`);
}

function fromEditorMarkdown(markdown = "") {
  return markdown
    .replace(/\[([^\]\n]+)\]\(#ashram-new-doc:([^)]+)\)/g, (_match, title, encodedTitle) => `[[new:${safeDecode(encodedTitle) || title}]]`)
    .replace(/\[([^\]\n]+)\]\(#ashram-doc:([^)]+)\)/g, (_match, title, id) => `[[${safeDecode(id)}|${title}]]`)
    .replace(/\[([^\]\n]+)\]\(#ashram-name-doc:([^)]+)\)/g, (_match, title, encodedTitle) => `[[${safeDecode(encodedTitle) || title}]]`)
    .replace(/\[([^\]\n]+)\]\(ashram-new-doc:\/\/([^)]+)\)/g, (_match, title, encodedTitle) => `[[new:${safeDecode(encodedTitle) || title}]]`)
    .replace(/\[([^\]\n]+)\]\(ashram-doc:\/\/([^)]+)\)/g, (_match, title, id) => `[[${id}|${title}]]`)
    .replace(/\[([^\]\n]+)\]\(ashram-name-doc:\/\/([^)]+)\)/g, (_match, title, encodedTitle) => `[[${safeDecode(encodedTitle) || title}]]`);
}

function parseInternalHref(href = "") {
  if (href.startsWith("#ashram-new-doc:")) return { type: "new", target: safeDecode(href.replace("#ashram-new-doc:", "")) };
  if (href.startsWith("#ashram-name-doc:")) return { type: "name", target: safeDecode(href.replace("#ashram-name-doc:", "")) };
  if (href.startsWith("#ashram-doc:")) return { type: "doc", target: safeDecode(href.replace("#ashram-doc:", "")) };
  if (href.startsWith("ashram-new-doc://")) return { type: "new", target: safeDecode(href.replace("ashram-new-doc://", "")) };
  if (href.startsWith("ashram-name-doc://")) return { type: "name", target: safeDecode(href.replace("ashram-name-doc://", "")) };
  if (href.startsWith("ashram-doc://")) return { type: "doc", target: href.replace("ashram-doc://", "") };
  return null;
}

function safeDecode(value = "") {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function updateImageBlock(markdown = "", src = "", action, value = "") {
  if (!src) return markdown;
  const escapedSrc = escapeRegExp(src);
  const blockRegex = new RegExp(`<div class="image-block"[^>]*>[\\s\\S]*?<img[^>]*src="${escapedSrc}"[\\s\\S]*?<\\/div>\\s*`, "i");
  const blockMatch = markdown.match(blockRegex);
  const block = blockMatch?.[0] || "";
  if (!block) {
    const markdownImageRegex = new RegExp(`!\\[([^\\]]*)\\]\\(${escapedSrc}\\)\\s*`, "i");
    const imageMatch = markdown.match(markdownImageRegex);
    if (!imageMatch) return markdown;
    if (action === "delete") return markdown.replace(markdownImageRegex, "");
    const alt = imageMatch[1] || "imagen";
    const align = action === "align" ? value : "center";
    const width = action === "resize" ? value : "60%";
    const caption = action === "caption" ? value : "";
    const nextSrc = action === "replace" ? value : src;
    return markdown.replace(markdownImageRegex, createImageHtmlBlock(nextSrc, alt, width, align, caption));
  }
  if (action === "delete") return markdown.replace(block, "");
  if (action === "resize") {
    return markdown.replace(block, block.replace(/width\s*:\s*[^;"]+;?/i, `width:${value};`));
  }
  if (action === "align") {
    return markdown.replace(block, block.replace(/text-align\s*:\s*[^;"]+;?/i, `text-align:${value};`));
  }
  if (action === "caption") {
    const caption = `<p class="caption">${escapeHtml(value)}</p>`;
    const nextBlock = block.includes("class=\"caption\"")
      ? block.replace(/<p class="caption">[\s\S]*?<\/p>/i, caption)
      : block.replace(/<\/div>\s*$/i, `${caption}</div>\n`);
    return markdown.replace(block, nextBlock);
  }
  if (action === "replace") {
    return markdown.replace(block, block.replace(new RegExp(escapedSrc, "g"), escapeHtml(value)));
  }
  return markdown;
}

function createImageHtmlBlock(src, alt, width = "60%", align = "center", caption = "") {
  return `<div class="image-block" style="text-align:${escapeHtml(align)};">
  <img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" style="width:${escapeHtml(width)}; max-width:100%;" />
  <p class="caption">${escapeHtml(caption)}</p>
</div>
`;
}

function escapeRegExp(value = "") {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
