import { Check, ExternalLink, Image, Link2, Menu, Minimize2, MoreVertical, Save, Share2, Sparkles, Undo2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import BookModeToolbar from "./BookModeToolbar";
import ChapterPreview from "./ChapterPreview";
import EpubExportModal from "./EpubExportModal";
import ExportMenu from "./ExportMenu";
import MarkdownToolbar from "./MarkdownToolbar";
import PdfExportModal from "./PdfExportModal";
import PostExportModal from "./PostExportModal";
import PublishModal from "./PublishModal";
import StableMarkdownEditor from "./StableMarkdownEditor";
import { iconFor } from "./documentIcons";
import { DOCUMENT_AI_ACTIONS, transformDocumentWithAi } from "./documentAiService";
import { detectChapters, exportMarkdown } from "./exportService";

export default function DocumentEditor({
  document,
  folders,
  documents = [],
  onChange,
  onExport,
  onPublish,
  onShowSidebar,
  onUploadImage,
  onCreateLinkedDocument,
  onCreateAiDocument,
  onOpenDocument,
  onOpenStorageConfig,
  onRefreshTree,
  busy = false,
  internalDocuments = [],
}) {
  const [draft, setDraft] = useState(document);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [mobileExportMenuOpen, setMobileExportMenuOpen] = useState(false);
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);
  const [mobileAiOpen, setMobileAiOpen] = useState(false);
  const [exportModal, setExportModal] = useState("");
  const [publishSeedDocument, setPublishSeedDocument] = useState(null);
  const [showChapters, setShowChapters] = useState(false);
  const [editorMode, setEditorMode] = useState("visual");
  const [focusMode, setFocusMode] = useState(false);
  const [imageMenuOpen, setImageMenuOpen] = useState(false);
  const [linkModal, setLinkModal] = useState("");
  const [linkSearch, setLinkSearch] = useState("");
  const [history, setHistory] = useState([]);
  const [saveStatus, setSaveStatus] = useState("idle");
  const [aiBusyAction, setAiBusyAction] = useState("");
  const [aiStatus, setAiStatus] = useState(null);
  const textareaRef = useRef(null);
  const visualEditorRef = useRef(null);
  const stableEditorRef = useRef(null);
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const autoSaveReadyRef = useRef(false);
  const markdownDocuments = useMemo(
    () => internalDocuments.length ? internalDocuments : getAllMarkdownDocumentsFromTree(documents, folders),
    [documents, folders, internalDocuments],
  );

  useEffect(() => {
    setDraft(document);
    setSaveStatus("idle");
    autoSaveReadyRef.current = false;
  }, [document?.id]);

  useEffect(() => {
    if (!document?.id || document.id !== draft?.id) return;
    setDraft((current) => ({
      ...current,
      ...document,
      contentMarkdown: document.contentMarkdown ?? current?.contentMarkdown ?? "",
    }));
  }, [document?.contentMarkdown, document?.updatedAt, document?.statusSync]);

  useEffect(() => {
    if (!visualEditorRef.current || !document?.id) return;
    visualEditorRef.current.innerHTML = markdownToHtml(document.contentMarkdown || "");
  }, [document?.id]);

  useEffect(() => {
    if (!draft?.id || draft.editable === false) return undefined;
    if (!autoSaveReadyRef.current) {
      autoSaveReadyRef.current = true;
      return undefined;
    }
    const timer = window.setTimeout(() => {
      saveCurrentDocument({ silent: true });
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [draft?.title, draft?.folderId, draft?.contentMarkdown]);

  useEffect(() => {
    if (editorMode !== "visual" || !visualEditorRef.current) return;
    visualEditorRef.current.innerHTML = markdownToHtml(draft?.contentMarkdown || "");
  }, [editorMode]);

  if (!draft) {
    return (
      <section className="document-empty">
        <button className="ghost compact mobile-documents-button" type="button" onClick={onShowSidebar}>
          <Menu size={16} /> Documentos
        </button>
        <h2>Elegí o creá un documento</h2>
        <p>El cuaderno guarda todo primero en este dispositivo.</p>
      </section>
    );
  }

  function setField(field, value) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  function setContentMarkdown(contentMarkdown, sourceDocumentId) {
    if (sourceDocumentId && sourceDocumentId !== draft?.id) {
      console.warn("Ignorando cambio tardio del editor", {
        sourceDocumentId,
        activeDocumentId: draft?.id,
      });
      return;
    }
    setField("contentMarkdown", contentMarkdown);
  }

  async function saveCurrentDocument({ silent = false } = {}) {
    if (!draft?.id || draft.editable === false) return true;
    const latestMarkdown = editorMode === "visual"
      ? stableEditorRef.current?.getMarkdown?.() ?? draft.contentMarkdown ?? ""
      : draft.contentMarkdown || "";
    const nextDraft = {
      ...draft,
      id: draft.id,
      contentMarkdown: latestMarkdown,
    };
    setDraft(nextDraft);
    if (!silent) setSaveStatus("saving");
    try {
      await onChange?.(nextDraft);
      if (!silent) {
        setSaveStatus("saved");
        window.setTimeout(() => setSaveStatus((status) => status === "saved" ? "idle" : status), 2200);
      }
      return true;
    } catch (error) {
      console.error("No se pudo guardar el documento", error);
      if (!silent) setSaveStatus("error");
      return false;
    }
  }

  function currentDraftWithEditorContent() {
    const latestMarkdown = editorMode === "visual"
      ? stableEditorRef.current?.getMarkdown?.() ?? draft.contentMarkdown ?? ""
      : draft.contentMarkdown || "";
    return {
      ...draft,
      contentMarkdown: latestMarkdown,
      content: latestMarkdown,
    };
  }

  function insertSnippet(snippet) {
    if (editorMode !== "source") {
      insertVisualHtml(markdownToHtml(snippet));
      return;
    }
    const textarea = textareaRef.current;
    if (!textarea) {
      setField("contentMarkdown", `${draft.contentMarkdown || ""}${snippet}`);
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = draft.contentMarkdown || "";
    const next = `${text.slice(0, start)}${snippet}${text.slice(end)}`;
    setField("contentMarkdown", next);
    window.requestAnimationFrame(() => {
      textarea.focus();
      textarea.selectionStart = textarea.selectionEnd = start + snippet.length;
    });
  }

  function selectedText(fallback = "texto") {
    if (editorMode !== "source") return window.getSelection?.().toString() || fallback;
    const textarea = textareaRef.current;
    const text = draft.contentMarkdown || "";
    if (!textarea) return fallback;
    return text.slice(textarea.selectionStart, textarea.selectionEnd) || fallback;
  }

  function wrapSelection(before, after = "", fallback = "texto") {
    if (editorMode !== "source") {
      if (before === "**" && after === "**") return runVisualCommand("bold");
      if (before === "*" && after === "*") return runVisualCommand("italic");
      if (before === "``" && after === "``") return wrapVisualInline("code");
    }
    const textarea = textareaRef.current;
    if (!textarea) {
      insertSnippet(`${before}${fallback}${after}`);
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = draft.contentMarkdown || "";
    const selected = text.slice(start, end) || fallback;
    const next = `${text.slice(0, start)}${before}${selected}${after}${text.slice(end)}`;
    setField("contentMarkdown", next);
    window.requestAnimationFrame(() => {
      textarea.focus();
      textarea.selectionStart = start + before.length;
      textarea.selectionEnd = start + before.length + selected.length;
    });
  }

  function handleToolbarAction(action) {
    const handlers = {
      h1: () => insertMarkdownAtCursor(`# ${selectedText("Titulo")}\n\n`),
      h2: () => insertMarkdownAtCursor(`## ${selectedText("Subtitulo")}\n\n`),
      h3: () => insertMarkdownAtCursor(`### ${selectedText("Titulo")}\n\n`),
      bold: () => editorMode === "source" ? wrapSelection("**", "**") : insertMarkdownAtCursor(`**${selectedText("texto")}**`),
      italic: () => editorMode === "source" ? wrapSelection("*", "*") : insertMarkdownAtCursor(`*${selectedText("texto")}*`),
      strike: () => runVisualCommand("strikeThrough"),
      quote: () => insertMarkdownAtCursor(`> ${selectedText("cita")}\n\n`),
      inlineCode: () => wrapVisualInline("code"),
      ul: () => insertMarkdownAtCursor("- item\n- item\n"),
      ol: () => insertMarkdownAtCursor("1. item\n2. item\n"),
      checklist: () => insertMarkdownAtCursor("- [ ] Tarea\n"),
      hr: () => insertMarkdownAtCursor("\n---\n\n"),
      link: insertLink,
      image: insertImageBlock,
      video: insertVideoBlock,
      table: () => insertMarkdownAtCursor("\n| Columna 1 | Columna 2 |\n| --------- | --------- |\n| Texto | Texto |\n\n"),
      code: () => editorMode === "source" ? wrapSelection("```\n", "\n```", "codigo") : insertMarkdownAtCursor("```\ncodigo\n```\n"),
      left: () => runVisualCommand("justifyLeft"),
      center: () => runVisualCommand("justifyCenter"),
      right: () => runVisualCommand("justifyRight"),
    };
    handlers[action]?.();
  }

  function insertLink() {
    const title = window.prompt("Texto del link", selectedText("titulo"));
    if (!title) return;
    const url = window.prompt("URL", "https://");
    if (!url) return;
    insertMarkdownAtCursor(`[${title}](${url})`);
  }

  function insertImageBlock() {
    const url = window.prompt("URL de imagen externa o de la biblioteca");
    if (!url) return;
    const alt = window.prompt("Texto alternativo", "") || "";
    const caption = window.prompt("Pie de imagen", "") || "";
    const width = window.prompt("Ancho: 25%, 50%, 75%, 100% o px", "60%") || "60%";
    const align = window.prompt("Alineacion: left, center, right", "center") || "center";
    const html = `<div class="image-block" style="text-align:${align};"><img src="${escapeHtml(url)}" alt="${escapeHtml(alt)}" style="width:${escapeHtml(width)}; max-width:100%;" />${caption ? `<p class="caption">${escapeHtml(caption)}</p>` : ""}</div><p><br></p>`;
    insertMarkdownAtCursor(`\n${html}\n\n`);
  }

  function insertVideoBlock() {
    const url = window.prompt("URL de YouTube, Vimeo o video externo");
    if (!url) return;
    const html = `<div class="video-block"><iframe src="${escapeHtml(videoEmbedUrl(url))}" allowfullscreen></iframe></div><p><br></p>`;
    insertMarkdownAtCursor(`\n${html}\n\n`);
  }

  function wrapAlignment(align) {
    insertSnippet(`\n<div style="text-align:${align};">\n${selectedText("Texto alineado")}\n</div>\n\n`);
  }

  function runVisualCommand(command, value = null) {
    visualEditorRef.current?.focus();
    const blockValue = ["h1", "h2", "h3", "blockquote", "pre"].includes(value) ? value.toUpperCase() : value;
    window.document.execCommand(command, false, blockValue);
    syncVisualToDraft();
  }

  function wrapVisualInline(tagName) {
    const selection = window.getSelection?.();
    if (!selection?.rangeCount) return;
    const range = selection.getRangeAt(0);
    const wrapper = window.document.createElement(tagName);
    wrapper.textContent = selection.toString() || "codigo";
    range.deleteContents();
    range.insertNode(wrapper);
    syncVisualToDraft();
  }

  function insertVisualHtml(html) {
    visualEditorRef.current?.focus();
    window.document.execCommand("insertHTML", false, html);
    syncVisualToDraft();
  }

  function syncVisualToDraft() {
    setField("contentMarkdown", htmlToMarkdown(visualEditorRef.current?.innerHTML || ""));
  }

  async function chooseExport(type) {
    setMobileExportMenuOpen(false);
    setMobileMoreOpen(false);
    if (type.startsWith("publish_")) {
      setExportModal(type);
      return;
    }
    if (type === "copy") {
      await navigator.clipboard?.writeText(draft.contentMarkdown || "");
      await onExport?.({ type: "markdown", title: draft.title, fileName: "", status: "copied" });
      return;
    }
    if (type === "markdown") {
      const result = await exportMarkdown(draft);
      await onExport?.({ type: "markdown", title: draft.title, fileName: result.fileName });
      return;
    }
    setExportModal(type);
  }

  async function registerExport(data) {
    await onExport?.({ documentId: draft.id, title: draft.title, ...data });
  }

  async function publish(data) {
    await onPublish?.({ document: draft, ...data });
  }

  async function runAiAction(actionConfig) {
    if (!draft?.id) return;
    setMobileAiOpen(false);
    const sourceDraft = currentDraftWithEditorContent();
    setDraft(sourceDraft);
    const saved = await saveCurrentDocument({ silent: true });
    if (!saved) return;
    setAiBusyAction(actionConfig.id);
    setAiStatus({
      phase: "loading",
      message: "Consultando la sabiduría del Ashram...",
      actionConfig,
    });
    try {
      const result = await transformDocumentWithAi({
        action: actionConfig.id,
        document: sourceDraft,
        onStatus: (status) => setAiStatus({ ...status, actionConfig }),
      });
      const seedDocument = {
        ...sourceDraft,
        title: result.title || `${actionConfig.label}: ${sourceDraft.title || "Documento"}`,
        contentMarkdown: result.content || "",
        content: result.content || "",
        summary: result.summary || "",
        tags: result.tags || [],
        keywords: Array.isArray(result.tags) ? result.tags.join(", ") : "",
        sourceDocumentId: sourceDraft.id,
        sourceFolderId: sourceDraft.folderId || "",
      };
      if (actionConfig.target === "publish") {
        setPublishSeedDocument(seedDocument);
        setExportModal(`publish_${actionConfig.publishType || "post"}`);
        setAiStatus(null);
        return;
      }
      await onCreateAiDocument?.(seedDocument);
      setAiStatus(null);
    } catch (error) {
      console.error("No se pudo transformar el documento con IA", error);
      setAiStatus({
        phase: "error",
        message: error.message || "No se pudo crear el borrador con IA.",
        retryable: Boolean(error.isRetryable),
        actionConfig,
      });
    } finally {
      setAiBusyAction("");
    }
  }

  function openPublishFromEpub(payload) {
    const nextDocument = {
      ...draft,
      title: payload.title || draft.title,
      coverUrl: payload.coverUrl || draft.coverUrl || "",
      publicFileUrl: payload.uploaded?.url || "",
      epub_url: payload.uploaded?.url || "",
      epub: payload.uploaded?.url || "",
      epub_path: payload.uploaded?.path || "",
      epub_file_name: payload.fileName || "",
      epub_chapters: payload.chapters || [],
      epub_title: payload.title || draft.title || "",
      publishDefaults: {
        title: payload.title || draft.title || "",
        author: payload.author || "Ashram Ganesha",
        description: payload.description || "",
        keywords: payload.keywords || "",
        coverUrl: payload.coverUrl || "",
        publicFileUrl: payload.uploaded?.url || "",
        format: "epub",
      },
    };
    setPublishSeedDocument(nextDocument);
    setExportModal(`publish_${payload.publishType || "book"}`);
  }

  async function handleImageFiles(fileList) {
    const files = Array.from(fileList || []).filter(Boolean);
    if (!files.length) return;
    if (!draft?.id) {
      window.alert("Primero abrí o creá un documento para insertar la imagen.");
      return;
    }
    const blocks = [];
    const imageUrls = [];
    for (const file of files) {
      const driveItem = await onUploadImage?.(file);
      const markdownUrl = driveItem?.markdownUrl || driveItem?.publicFileUrl || driveItem?.webContentLink || driveItem?.webViewLink || "";
      const previewUrl = driveItem?.localPreviewUrl || driveItem?.publicFileUrl || driveItem?.webContentLink || driveItem?.webViewLink || markdownUrl;
      if (!markdownUrl) continue;
      imageUrls.push(previewUrl);
      blocks.push(createImageMarkdownBlock({
        url: markdownUrl,
        alt: file.name || "imagen",
      }));
    }
    if (blocks.length) {
      const blockMarkdown = `\n${blocks.join("\n\n")}\n\n`;
      const beforeMarkdown = insertMarkdownAtCursor(blockMarkdown) || "";
      window.setTimeout(() => {
        const editorMarkdown = stableEditorRef.current?.getMarkdown?.() || "";
        const hasImage = imageUrls.some((url) => editorMarkdown.includes(url));
        if (editorMode === "visual" && !hasImage) {
          const nextMarkdown = `${beforeMarkdown || draft.contentMarkdown || ""}${blockMarkdown}`;
          const nextDraft = { ...draft, contentMarkdown: nextMarkdown };
          console.warn("Insertando imagen en editor: fallback en documento activo", draft.id);
          setDraft(nextDraft);
          stableEditorRef.current?.setMarkdown?.(nextMarkdown);
          onChange?.(nextDraft);
        } else if (editorMode === "visual" && hasImage) {
          const nextDraft = { ...draft, contentMarkdown: editorMarkdown };
          setDraft(nextDraft);
          onChange?.(nextDraft);
        }
      }, 180);
    }
    setImageMenuOpen(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (cameraInputRef.current) cameraInputRef.current.value = "";
  }

  function insertMarkdownAtCursor(value) {
    if (editorMode === "source") {
      insertSnippet(value);
      return draft.contentMarkdown || "";
    }
    return stableEditorRef.current?.insertMarkdown(value) || "";
  }

  function getCurrentEditorSelection() {
    if (editorMode === "source" && textareaRef.current) {
      return {
        start: textareaRef.current.selectionStart,
        end: textareaRef.current.selectionEnd,
      };
    }
    const selection = window.getSelection?.();
    return selection
      ? {
        text: selection.toString(),
        rangeCount: selection.rangeCount,
        anchorNode: selection.anchorNode?.nodeName,
        focusNode: selection.focusNode?.nodeName,
      }
      : null;
  }

  function insertExternalLink(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const url = form.get("url")?.toString().trim();
    const text = form.get("text")?.toString().trim() || url;
    if (!url) return;
    insertMarkdownAtCursor(`[${text}](${url})`);
    setLinkModal("");
  }

  function insertInternalLink(documentItem) {
    if (!documentItem) {
      const title = linkSearch.trim();
      if (!title) return;
      insertPendingInternalLink(title);
      setLinkModal("");
      setLinkSearch("");
      return;
    }
    const target = documentItem;
    const linkId = target.id;
    const title = cleanDocumentTitle(target);
    insertMarkdownAtCursor(`[[${linkId}|${title}]]`);
    setLinkModal("");
    setLinkSearch("");
  }

  function insertPendingInternalLink(title) {
    insertMarkdownAtCursor(`[[new:${title}]]`);
  }

  async function openInternalDocument(linkTarget, { skipSave = false } = {}) {
    if (!skipSave) {
      const saved = await saveCurrentDocument({ silent: true });
      if (!saved) {
        window.alert("No se pudo guardar el documento actual antes de abrir el enlace.");
        return;
      }
    }
    if (draft?.id) setHistory((current) => [...current, draft.id]);
    onOpenDocument?.(linkTarget);
  }

  async function createPendingInternalLink(title) {
    const cleanTitle = title?.trim();
    if (!cleanTitle) return;
    if (!window.confirm(`Crear el documento "${cleanTitle}" en la carpeta actual?`)) return;
    const target = await onCreateLinkedDocument?.(cleanTitle);
    if (!target) return;
    const linkId = target.id;
    const visibleTitle = cleanDocumentTitle(target);
    const oldToken = `[[${cleanTitle}]]`;
    const oldPendingToken = `[[new:${cleanTitle}]]`;
    const newToken = `[[${linkId}|${visibleTitle}]]`;
    const currentMarkdown = stableEditorRef.current?.getMarkdown?.() || draft.contentMarkdown || "";
    const nextMarkdown = currentMarkdown.includes(oldPendingToken)
      ? currentMarkdown.replace(oldPendingToken, newToken)
      : currentMarkdown.includes(oldToken)
      ? currentMarkdown.replace(oldToken, newToken)
      : currentMarkdown
        .replace(`[[new:${cleanTitle}]]`, newToken)
        .replace(`[${cleanTitle}](ashram-new-doc://${encodeURIComponent(cleanTitle)})`, newToken)
        .replace(`[${cleanTitle}](ashram-name-doc://${encodeURIComponent(cleanTitle)})`, newToken)
        .replace(`[${cleanTitle}](#ashram-new-doc:${encodeURIComponent(cleanTitle)})`, newToken)
        .replace(`[${cleanTitle}](#ashram-name-doc:${encodeURIComponent(cleanTitle)})`, newToken);
    const nextDraft = { ...draft, contentMarkdown: nextMarkdown };
    setDraft(nextDraft);
    stableEditorRef.current?.setMarkdown?.(nextMarkdown);
    await onChange?.(nextDraft);
    openInternalDocument(linkId, { skipSave: true });
  }

  async function openNamedInternalLink(title) {
    const existing = findDocumentByTitle(title);
    if (existing) {
      openInternalDocument(existing.id);
      return;
    }
    await createPendingInternalLink(title);
  }

  function getInternalLinkInfo(linkTarget, mode = "id") {
    const item = mode === "name"
      ? findDocumentByTitle(linkTarget)
      : markdownDocuments.find((documentItem) =>
        documentItem.id === linkTarget
      );
    if (!item) return null;
    return {
      title: cleanDocumentTitle(item),
      folderPath: item.folderPath || getFolderPath(item.folderId, folders),
    };
  }

  function findDocumentByTitle(title) {
    const cleanTitle = String(title || "").replace(/\.[^/.]+$/, "").trim().toLowerCase();
    return markdownDocuments.find((item) => cleanDocumentTitle(item).trim().toLowerCase() === cleanTitle);
  }

  function goBack() {
    setHistory((current) => {
      const previous = current[current.length - 1];
      if (previous) onOpenDocument?.(previous);
      return current.slice(0, -1);
    });
  }

  const editable = draft.editable !== false;

  return (
    <section className={`document-editor ${focusMode ? "focus-writing" : ""}`}>
      <div className="mobile-writing-bar">
        <button className="icon-btn" type="button" onClick={onShowSidebar} title="Documentos">
          <Menu size={17} />
        </button>
        <strong>{draft.title || "Sin titulo"}</strong>
        <button className="icon-btn" type="button" onClick={saveCurrentDocument} title="Guardar">
          <Check size={17} />
        </button>
        <button className="icon-btn mobile-export-toggle" type="button" onClick={() => setMobileExportMenuOpen((open) => !open)} title="Compartir / Publicar">
          <Share2 size={17} />
        </button>
        <button className="icon-btn" type="button" onClick={() => setMobileMoreOpen((open) => !open)} title="Mas opciones">
          <MoreVertical size={17} />
        </button>
      </div>
      {mobileExportMenuOpen ? (
        <div className="mobile-export-menu-wrap">
          <ExportMenu onChoose={chooseExport} onClose={() => setMobileExportMenuOpen(false)} />
        </div>
      ) : null}
      {mobileMoreOpen ? (
        <div className="mobile-more-menu-wrap">
          <button type="button" onClick={() => { setLinkModal("internal"); setMobileMoreOpen(false); }}>Link interno</button>
          <button type="button" onClick={() => { setLinkModal("external"); setMobileMoreOpen(false); }}>Link externo</button>
          <button type="button" onClick={() => { setImageMenuOpen((open) => !open); setMobileMoreOpen(false); }}>Insertar imagen</button>
          <button type="button" onClick={() => { handleToolbarAction("table"); setMobileMoreOpen(false); }}>Insertar tabla</button>
          <button type="button" onClick={() => { onOpenStorageConfig?.(); setMobileMoreOpen(false); }}>Configuracion Firestore</button>
          <button type="button" onClick={() => { onRefreshTree?.(); setMobileMoreOpen(false); }}>Releer arbol</button>
          <button type="button" onClick={() => { setMobileExportMenuOpen(true); setMobileMoreOpen(false); }}>Compartir / Publicar</button>
          <button type="button" onClick={() => { setEditorMode((mode) => mode === "source" ? "visual" : "source"); setMobileMoreOpen(false); }}>
            {editorMode === "source" ? "Editor visual" : "Ver Markdown"}
          </button>
          <button type="button" onClick={() => { setFocusMode((value) => !value); setMobileMoreOpen(false); }}>Concentracion</button>
        </div>
      ) : null}
      <header className="document-editor-head">
        <button className="ghost compact mobile-documents-button" type="button" onClick={onShowSidebar}>
          <Menu size={16} /> Documentos
        </button>
        <span>
          <small>Creado {formatDate(draft.createdAt)} · Modificado {formatDate(draft.updatedAt)}</small>
        </span>
        <label className="document-mode-select">
          <select value={draft.mode || "document"} onChange={(event) => setField("mode", event.target.value)}>
            <option value="document">Documento normal</option>
            <option value="book">Libro</option>
            <option value="post">Post</option>
          </select>
        </label>
        <div className="export-menu-wrap">
          <button className="ghost compact" type="button" onClick={() => setExportMenuOpen((open) => !open)}>
            <Share2 size={15} /> Compartir / Publicar
          </button>
          {exportMenuOpen ? <ExportMenu onChoose={chooseExport} onClose={() => setExportMenuOpen(false)} /> : null}
        </div>
        <button className="primary small" type="button" disabled={!editable} onClick={saveCurrentDocument}>
          <Save size={15} /> Guardar
        </button>
        <span className={`manual-save-status ${saveStatus}`}>{saveStatusLabel(saveStatus)}</span>
        <button className="ghost compact focus-mode-button" type="button" onClick={() => setFocusMode((value) => !value)}>
          <Minimize2 size={15} /> Concentracion
        </button>
      </header>
      {saveStatus !== "idle" ? <p className={`manual-save-message ${saveStatus}`}>{saveStatusLabel(saveStatus)}</p> : null}
      {history.length ? (
        <button className="ghost compact internal-back-button" type="button" onClick={goBack}>
          <Undo2 size={14} /> Volver
        </button>
      ) : null}

      <div className="document-title-row">
        <input className="document-title-input" value={draft.title || ""} onChange={(event) => setField("title", event.target.value)} placeholder="Titulo del documento" />
        <label>Carpeta
          <select value={draft.folderId || ""} onChange={(event) => setField("folderId", event.target.value)}>
            <option value="">Workspace Ashram</option>
            {folders.map((folder) => <option key={folder.id} value={folder.id}>{folder.title}</option>)}
          </select>
        </label>
      </div>

      {editable ? (
        <MarkdownToolbar
          mode={editorMode}
          onAction={handleToolbarAction}
          onTogglePreview={() => setEditorMode((mode) => mode === "source" ? "visual" : "source")}
        />
      ) : null}

      {editable ? (
        <div className="editor-mode-actions">
          <div className="ai-document-actions">
            <span><Sparkles size={14} /> IA</span>
            {DOCUMENT_AI_ACTIONS.map((action) => (
              <button
                className="ghost compact"
                type="button"
                key={action.id}
                disabled={Boolean(aiBusyAction)}
                onClick={() => runAiAction(action)}
              >
                {aiBusyAction === action.id ? "Creando..." : action.label}
              </button>
            ))}
          </div>
          <div className="appflowy-insert-wrap">
            <button className="ghost compact" type="button" onMouseDown={keepEditorSelection} onClick={() => setImageMenuOpen((open) => !open)}>
              <Image size={14} /> Imagen
            </button>
            {imageMenuOpen ? (
              <div className="appflowy-insert-menu">
                <button type="button" onMouseDown={keepEditorSelection} onClick={() => fileInputRef.current?.click()}>Elegir archivo</button>
                <button type="button" onMouseDown={keepEditorSelection} onClick={() => fileInputRef.current?.click()}>Elegir desde galeria</button>
                <button type="button" onMouseDown={keepEditorSelection} onClick={() => cameraInputRef.current?.click()}>Tomar foto</button>
                <button type="button" onMouseDown={keepEditorSelection} onClick={() => setLinkModal("library_image")}>Elegir desde biblioteca</button>
              </div>
            ) : null}
          </div>
          <button className="ghost compact" type="button" onClick={() => setLinkModal("external")}>
            <Link2 size={14} /> Link externo
          </button>
          <button className="ghost compact" type="button" onClick={() => setLinkModal("internal")}>
            <Link2 size={14} /> Link interno
          </button>
          <button className="ghost compact" type="button" onClick={() => setEditorMode((mode) => mode === "source" ? "visual" : "source")}>
            {editorMode === "source" ? "Editor visual" : "Ver Markdown"}
          </button>
          <input ref={fileInputRef} hidden type="file" accept="image/*" multiple onChange={(event) => handleImageFiles(event.target.files)} />
          <input ref={cameraInputRef} hidden type="file" accept="image/*" capture="environment" onChange={(event) => handleImageFiles(event.target.files)} />
        </div>
      ) : null}
      {editable && aiStatus ? (
        <div className={`document-ai-status ${aiStatus.phase === "error" ? "error" : "loading"}`} role="status">
          <span className="document-ai-status-dot" aria-hidden="true" />
          <span>{aiStatus.message}</span>
          {aiStatus.phase === "retrying" ? <small>Reintentando en unos instantes...</small> : null}
          {aiStatus.phase === "error" && aiStatus.retryable ? (
            <button className="ghost compact" type="button" onClick={() => runAiAction(aiStatus.actionConfig)}>
              Reintentar
            </button>
          ) : null}
        </div>
      ) : null}
      {editable ? (
        <div className="mobile-ai-toolkit">
          <button
            className="mobile-ai-fab"
            type="button"
            onClick={() => setMobileAiOpen((open) => !open)}
            aria-expanded={mobileAiOpen}
            aria-label="Herramientas de IA"
          >
            <Sparkles size={17} /> IA
          </button>
          {mobileAiOpen ? (
            <div className="mobile-ai-menu" role="menu" aria-label="Herramientas IA para este cuaderno">
              <strong><Sparkles size={14} /> Transformar cuaderno</strong>
              {DOCUMENT_AI_ACTIONS.map((action) => (
                <button
                  type="button"
                  role="menuitem"
                  key={action.id}
                  disabled={Boolean(aiBusyAction)}
                  onClick={() => runAiAction(action)}
                >
                  {aiBusyAction === action.id ? "Creando..." : action.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
      {editable && draft.mode === "book" ? (
        <BookModeToolbar
          onInsert={insertSnippet}
          onPreview={() => setShowChapters((current) => !current)}
          onExport={() => setExportModal("epub")}
        />
      ) : null}
      {editable && showChapters ? <ChapterPreview chapters={detectChapters(draft.contentMarkdown || "")} /> : null}
      {editable && editorMode === "visual" ? (
        <StableMarkdownEditor
          ref={stableEditorRef}
          documentId={draft.id}
          markdown={draft.contentMarkdown || ""}
          onChange={setContentMarkdown}
          onInternalLinkClick={openInternalDocument}
          onPendingInternalLinkClick={createPendingInternalLink}
          onNamedInternalLinkClick={openNamedInternalLink}
          getInternalLinkInfo={getInternalLinkInfo}
          onImageAction={(contentMarkdown) => setContentMarkdown(contentMarkdown, draft.id)}
        />
      ) : null}
      {editable && editorMode === "source" ? <textarea
        ref={textareaRef}
        className="document-markdown"
        value={draft.contentMarkdown || ""}
        onChange={(event) => setField("contentMarkdown", event.target.value)}
        placeholder="Markdown del documento..."
      /> : null}
      {!editable ? <DriveResourcePreview item={draft} /> : null}
      {exportModal === "epub" ? (
        <EpubExportModal
          document={draft}
          onClose={() => setExportModal("")}
          onExported={registerExport}
          onPublishRequested={openPublishFromEpub}
        />
      ) : null}
      {exportModal === "pdf" ? <PdfExportModal document={draft} onClose={() => setExportModal("")} onExported={registerExport} /> : null}
      {exportModal === "post" ? <PostExportModal document={draft} onClose={() => setExportModal("")} onExported={registerExport} /> : null}
      {exportModal.startsWith("publish_") ? (
        <PublishModal
          document={publishSeedDocument || draft}
          initialType={exportModal.replace("publish_", "")}
          onClose={() => {
            setExportModal("");
            setPublishSeedDocument(null);
          }}
          onPublish={publish}
        />
      ) : null}
      {linkModal ? (
        <LinkAssistantModal
          mode={linkModal}
          documents={linkModal === "internal" ? markdownDocuments : documents}
          folders={folders}
          search={linkSearch}
          onSearch={setLinkSearch}
          onClose={() => setLinkModal("")}
          onExternal={insertExternalLink}
          onInternal={insertInternalLink}
          onInsertLibraryImage={(item) => {
            insertMarkdownAtCursor(`\n${createImageMarkdownBlock({
              url: item.publicFileUrl || item.webContentLink || item.webViewLink,
              alt: item.displayName || item.title || "imagen",
            })}\n`);
            setLinkModal("");
          }}
        />
      ) : null}
    </section>
  );
}

function keepEditorSelection(event) {
  event.preventDefault();
}

function saveStatusLabel(status) {
  const labels = {
    saving: "Guardando...",
    saved: "Guardado",
    error: "No se pudo guardar",
  };
  return labels[status] || "";
}

function createImageMarkdownBlock({ url, alt = "imagen", caption = "" }) {
  if (caption) {
    return `<div class="image-block" style="text-align:center;">
  <img src="${escapeHtml(url)}" alt="${escapeHtml(alt)}" style="width:60%; max-width:100%;" />
  <p class="caption">${escapeHtml(caption)}</p>
</div>`;
  }
  return `![${alt.replace(/]/g, "\\]")}](${url})`;
}

function LinkAssistantModal({ mode, documents, folders = [], search, onSearch, onClose, onExternal, onInternal, onInsertLibraryImage }) {
  const query = search.trim().toLowerCase();
  const results = documents.filter((item) => {
    const folderPath = (item.folderPath || getFolderPath(item.folderId, folders)).toLowerCase();
    const text = `${cleanDocumentTitle(item)} ${item.contentMarkdown || ""} ${folderPath}`.toLowerCase();
    if (mode === "library_image" && item.driveType !== "image" && item.type !== "image") return false;
    if (mode === "internal" && item.editable === false) return false;
    return !query || text.includes(query);
  }).slice(0, 24);
  const exactMatch = query && documents.some((item) => cleanDocumentTitle(item).toLowerCase() === query);

  return (
    <div className="export-modal-backdrop">
      <section className="export-modal link-assistant-modal">
        <header>
          <strong>{mode === "external" ? "Enlace externo" : mode === "library_image" ? "Imagen desde biblioteca" : "Enlace interno"}</strong>
          <button className="icon-btn" type="button" onClick={onClose}>×</button>
        </header>
        {mode === "external" ? (
          <form className="export-form-grid" onSubmit={onExternal}>
            <label>URL<input name="url" required placeholder="https://" /></label>
            <label>Texto visible<input name="text" placeholder="Texto del enlace" /></label>
            <div className="export-actions">
              <button className="ghost compact" type="button" onClick={onClose}>Cancelar</button>
              <button className="primary small" type="submit">Insertar</button>
            </div>
          </form>
        ) : (
          <InternalLinkPicker
            mode={mode}
            results={results}
            folders={folders}
            search={search}
            exactMatch={exactMatch}
            onSearch={onSearch}
            onInternal={onInternal}
            onInsertLibraryImage={onInsertLibraryImage}
          />
        )}
      </section>
    </div>
  );
}

function InternalLinkPicker({ mode, results, folders, search, exactMatch, onSearch, onInternal, onInsertLibraryImage }) {
  return (
    <div className="internal-link-picker">
      <input value={search} onChange={(event) => onSearch(event.target.value)} placeholder={mode === "library_image" ? "Buscar imagen..." : "Buscar documento..."} autoFocus />
      <DocumentSearchList
        mode={mode}
        results={results}
        folders={folders}
        search={search}
        exactMatch={exactMatch}
        onInternal={onInternal}
        onInsertLibraryImage={onInsertLibraryImage}
      />
    </div>
  );
}

function DocumentSearchList({ mode, results, folders, search, exactMatch, onInternal, onInsertLibraryImage }) {
  return (
    <div className="internal-link-results">
      {results.map((item) => (
        <button key={item.id} type="button" onClick={() => mode === "library_image" ? onInsertLibraryImage(item) : onInternal(item)}>
          <ItemIcon item={item} />
          <span>
            <strong>{cleanDocumentTitle(item)}</strong>
            <small>{mode === "library_image" ? item.type || item.mimeType || "imagen" : item.folderPath || getFolderPath(item.folderId, folders)}</small>
          </span>
        </button>
      ))}
      {!results.length ? (
        <p className="internal-link-empty">{mode === "library_image" ? "No se encontraron imagenes." : "No se encontraron documentos exactos."}</p>
      ) : null}
      {mode === "internal" && search.trim() && !exactMatch ? (
        <button type="button" onClick={() => onInternal(null)}>
          <span className="internal-link-icon">+</span>
          <span>
            <strong>Crear enlace a "{search.trim()}"</strong>
            <small>Queda pendiente hasta tocarlo y crear el documento</small>
          </span>
        </button>
      ) : null}
    </div>
  );
}

function ItemIcon({ item }) {
  const Icon = iconFor(item.icon, "document");
  return <Icon className="internal-link-icon" size={16} style={{ color: item.color || item.iconColor || "#d9a51f" }} />;
}

function cleanDocumentTitle(item = {}) {
  return (item.displayName || item.title || item.name || "Sin titulo").replace(/\.[^/.]+$/, "");
}

function getFolderPath(folderId, folders = []) {
  if (!folderId) return "Ashram Ganesha";
  const byId = new Map(folders.map((folder) => [folder.id, folder]));
  const names = [];
  let current = byId.get(folderId);
  let safety = 0;
  while (current && safety < 20) {
    names.unshift(current.displayName || current.title || current.name);
    current = byId.get(current.parentId);
    safety += 1;
  }
  return ["Ashram Ganesha", ...names].join(" / ");
}

function getAllMarkdownDocumentsFromTree(documents = [], folders = []) {
  return documents
    .filter((item) => {
      const name = `${item.name || item.title || ""}`.toLowerCase();
      return item.editable !== false && (["cuaderno", "markdown"].includes(item.type) || item.mimeType === "text/markdown" || name.endsWith(".md"));
    })
    .map((item) => ({
      ...item,
      displayName: cleanDocumentTitle(item),
      folderPath: getFolderPath(item.folderId, folders),
      parentFolderId: item.folderId || "",
    }))
    .sort((a, b) => (a.displayName || "").localeCompare(b.displayName || "", "es"));
}

function DriveResourcePreview({ item }) {
  const url = item.publicFileUrl || item.webContentLink || item.webViewLink;
  const previewUrl = item.webViewLink?.includes("/view") ? item.webViewLink.replace("/view", "/preview") : item.webViewLink;
  return (
    <div className="drive-resource-preview">
      <span>
        <strong>{resourceLabel(item.driveType || item.type)}</strong>
        <small>{item.mimeType || "Recurso externo"}</small>
      </span>
      {item.driveType === "image" && url ? <img src={url} alt={item.title || ""} /> : null}
      {item.driveType === "audio" && url ? <audio controls src={url} /> : null}
      {item.driveType === "video" && url ? <video controls src={url} /> : null}
      {item.driveType === "pdf" && previewUrl ? <iframe title={item.title || "PDF"} src={previewUrl} /> : null}
      <a className="ghost compact" href={item.webViewLink || url} target="_blank" rel="noreferrer">
        <ExternalLink size={15} /> Abrir recurso
      </a>
    </div>
  );
}

function resourceLabel(type) {
  const labels = {
    pdf: "PDF vinculado",
    image: "Imagen vinculada",
    audio: "Audio vinculado",
    video: "Video vinculado",
    google_doc: "Google Docs",
    other: "Recurso vinculado",
  };
  return labels[type] || "Recurso vinculado";
}

function MarkdownVisualPreview({ markdown, onUpdate }) {
  return (
    <div className="markdown-visual-preview">
      <div className="markdown-preview-body" dangerouslySetInnerHTML={{ __html: markdownToHtml(markdown) }} />
      <div className="image-quick-controls">
        <button type="button" onClick={() => resizeLastImage(markdown, onUpdate, "25%")}>25%</button>
        <button type="button" onClick={() => resizeLastImage(markdown, onUpdate, "50%")}>50%</button>
        <button type="button" onClick={() => resizeLastImage(markdown, onUpdate, "75%")}>75%</button>
        <button type="button" onClick={() => resizeLastImage(markdown, onUpdate, "100%")}>100%</button>
        <button type="button" onClick={() => alignLastImage(markdown, onUpdate, "left")}>Izq.</button>
        <button type="button" onClick={() => alignLastImage(markdown, onUpdate, "center")}>Centro</button>
        <button type="button" onClick={() => alignLastImage(markdown, onUpdate, "right")}>Der.</button>
      </div>
    </div>
  );
}

function markdownToHtml(markdown = "") {
  let html = escapeHtml(markdown);
  html = html.replace(/((?:^\|.*\|\n?)+)/gm, (table) => markdownTableToHtml(table));
  html = html.replace(/^-\s+\[ \]\s+(.*)$/gm, '<ul class="checklist"><li><label><input type="checkbox"> $1</label></li></ul>');
  html = html.replace(/^-\s+\[x\]\s+(.*)$/gim, '<ul class="checklist"><li><label><input type="checkbox" checked> $1</label></li></ul>');
  html = html.replace(/^-\s+(.*)$/gm, "<ul><li>$1</li></ul>");
  html = html.replace(/^\d+\.\s+(.*)$/gm, "<ol><li>$1</li></ol>");
  html = html.replace(/&lt;(\/?(div|img|p|iframe|br|hr|table|thead|tbody|tr|th|td|ul|ol|li|label|input|pre|code)[^&]*)&gt;/g, "<$1>");
  html = html.replace(/^### (.*)$/gm, "<h3>$1</h3>");
  html = html.replace(/^## (.*)$/gm, "<h2>$1</h2>");
  html = html.replace(/^# (.*)$/gm, "<h1>$1</h1>");
  html = html.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*(.*?)\*/g, "<em>$1</em>");
  html = html.replace(/~~(.*?)~~/g, "<s>$1</s>");
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
  html = html.replace(/^&gt; (.*)$/gm, "<blockquote>$1</blockquote>");
  html = html.replace(/!\[(.*?)\]\((.*?)\)/g, '<img src="$2" alt="$1" style="max-width:100%;" />');
  html = html.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>');
  html = html.replace(/^---$/gm, "<hr />");
  html = html.replace(/\n/g, "<br />");
  return html;
}

function htmlToMarkdown(html = "") {
  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div>${html}</div>`, "text/html");
  return Array.from(doc.body.firstChild.childNodes).map(nodeToMarkdown).join("").replace(/\n{3,}/g, "\n\n").trim();
}

function nodeToMarkdown(node) {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent || "";
  if (node.nodeType !== Node.ELEMENT_NODE) return "";
  const tag = node.tagName.toLowerCase();
  const text = () => Array.from(node.childNodes).map(nodeToMarkdown).join("");
  if (tag === "h1") return `# ${text().trim()}\n\n`;
  if (tag === "h2") return `## ${text().trim()}\n\n`;
  if (tag === "h3") return `### ${text().trim()}\n\n`;
  if (tag === "strong" || tag === "b") return `**${text()}**`;
  if (tag === "em" || tag === "i") return `*${text()}*`;
  if (tag === "s" || tag === "strike") return `~~${text()}~~`;
  if (tag === "code") return `\`${text()}\``;
  if (tag === "pre") return `\n\`\`\`\n${node.textContent || ""}\n\`\`\`\n\n`;
  if (tag === "blockquote") return `> ${text().trim()}\n\n`;
  if (tag === "hr") return "\n---\n\n";
  if (tag === "br") return "\n";
  if (tag === "a") return `[${text() || node.getAttribute("href")}](${node.getAttribute("href") || ""})`;
  if (tag === "img") return `![${node.getAttribute("alt") || ""}](${node.getAttribute("src") || ""})`;
  if (tag === "ul") return `${Array.from(node.children).map((li) => `- ${nodeToMarkdown(li).trim()}`).join("\n")}\n\n`;
  if (tag === "ol") return `${Array.from(node.children).map((li, index) => `${index + 1}. ${nodeToMarkdown(li).trim()}`).join("\n")}\n\n`;
  if (tag === "li") return text();
  if (tag === "table") return `${htmlTableToMarkdown(node)}\n\n`;
  if (tag === "div" && (node.classList.contains("image-block") || node.classList.contains("video-block"))) return `\n${node.outerHTML}\n\n`;
  if (tag === "p") return `${text().trim()}\n\n`;
  return text();
}

function markdownTableToHtml(table = "") {
  const rows = table.trim().split("\n").filter((row) => row.trim().startsWith("|"));
  if (rows.length < 2) return table;
  const cells = (row) => row.split("|").slice(1, -1).map((cell) => cell.trim());
  const headers = cells(rows[0]);
  const body = rows.slice(2).map(cells);
  return `<table><thead><tr>${headers.map((header) => `<th>${header}</th>`).join("")}</tr></thead><tbody>${body.map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
}

function htmlTableToMarkdown(table) {
  const rows = Array.from(table.querySelectorAll("tr")).map((row) => Array.from(row.children).map((cell) => cell.textContent.trim()));
  if (!rows.length) return "";
  const header = rows[0];
  const separator = header.map(() => "---------");
  return [header, separator, ...rows.slice(1)].map((row) => `| ${row.join(" | ")} |`).join("\n");
}

function resizeLastImage(markdown, onUpdate, width) {
  onUpdate(replaceLastImageStyle(markdown, (style) => {
    const clean = style.replace(/width\s*:[^;]+;?/i, "").trim();
    return `width:${width}; max-width:100%; ${clean}`.trim();
  }));
}

function alignLastImage(markdown, onUpdate, align) {
  const blockRegex = /<div class="image-block" style="text-align:[^"]*;">([\s\S]*?)<\/div>/g;
  const matches = [...markdown.matchAll(blockRegex)];
  if (!matches.length) return;
  const last = matches[matches.length - 1][0];
  onUpdate(markdown.replace(last, last.replace(/text-align:[^;"]*;?/i, `text-align:${align};`)));
}

function replaceLastImageStyle(markdown, mapper) {
  const imgRegex = /<img([^>]*?)style="([^"]*)"([^>]*?)>/g;
  const matches = [...markdown.matchAll(imgRegex)];
  if (!matches.length) return markdown;
  const last = matches[matches.length - 1];
  const next = `<img${last[1]}style="${mapper(last[2])}"${last[3]}>`;
  return `${markdown.slice(0, last.index)}${next}${markdown.slice(last.index + last[0].length)}`;
}

function videoEmbedUrl(url) {
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

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatDate(value) {
  if (!value) return "sin fecha";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "sin fecha";
  return date.toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
