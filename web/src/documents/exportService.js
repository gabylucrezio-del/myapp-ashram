import JSZip from "jszip";

export function detectChapters(markdown = "") {
  const lines = markdown.split(/\r?\n/);
  const chapters = [];
  let current = null;
  const headingPattern = /^(#|##)\s+(.+)$/;
  const namedPattern = /^(Introduccion|Introducción|Prologo|Prólogo|Epilogo|Epílogo|Cap[ií]tulo\s+\d+\s*:?.*)$/i;

  lines.forEach((line) => {
    const trimmed = line.trim();
    const heading = trimmed.match(headingPattern);
    const named = trimmed.match(namedPattern);
    const isMain = heading?.[1] === "#" || (!heading && named);
    const isSub = heading?.[1] === "##";

    if (isMain) {
      current = {
        title: heading?.[2] || named?.[1] || "Capitulo",
        content: [],
        subtitles: [],
      };
      chapters.push(current);
      return;
    }

    if (isSub && current) {
      current.subtitles.push(heading[2]);
      current.content.push(line);
      return;
    }

    if (!current && trimmed) {
      current = { title: "Documento", content: [], subtitles: [] };
      chapters.push(current);
    }
    current?.content.push(line);
  });

  return chapters.length ? chapters : [{ title: "Documento", content: [markdown], subtitles: [] }];
}

export async function exportMarkdown(document) {
  const fileName = safeFileName(document.title || "documento", "md");
  downloadBlob(new Blob([document.contentMarkdown || ""], { type: "text/markdown;charset=utf-8" }), fileName);
  return { fileName };
}

export async function exportEpub(document, options) {
  const chapters = options.chapters?.length ? options.chapters : detectChapters(document.contentMarkdown || "");
  const fileName = safeFileName(options.fileName || options.title || document.title || "libro", "epub");
  const zip = new JSZip();

  zip.file("mimetype", "application/epub+zip", { compression: "STORE" });
  zip.file("META-INF/container.xml", `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles>
</container>`);

  const manifestItems = chapters.map((_, index) => `<item id="chapter${index + 1}" href="chapter${index + 1}.xhtml" media-type="application/xhtml+xml"/>`).join("\n");
  const spineItems = chapters.map((_, index) => `<itemref idref="chapter${index + 1}"/>`).join("\n");
  zip.file("OEBPS/content.opf", `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="bookid" version="3.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="bookid">${crypto.randomUUID?.() || Date.now()}</dc:identifier>
    <dc:title>${escapeXml(options.title || document.title || "Libro")}</dc:title>
    <dc:creator>${escapeXml(options.author || "Ashram Ganesha")}</dc:creator>
    <dc:language>${escapeXml(options.language || "es")}</dc:language>
    <dc:description>${escapeXml(options.description || "")}</dc:description>
  </metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    ${manifestItems}
  </manifest>
  <spine>${spineItems}</spine>
</package>`);

  zip.file("OEBPS/nav.xhtml", xhtmlPage("Indice", `<nav epub:type="toc"><ol>${chapters.map((chapter, index) => `<li><a href="chapter${index + 1}.xhtml">${escapeXml(chapter.title)}</a></li>`).join("")}</ol></nav>`));
  chapters.forEach((chapter, index) => {
    zip.file(`OEBPS/chapter${index + 1}.xhtml`, xhtmlPage(chapter.title, markdownToHtml(`# ${chapter.title}\n\n${chapter.content.join("\n")}`)));
  });

  const blob = await zip.generateAsync({ type: "blob", mimeType: "application/epub+zip" });
  if (options.download !== false) downloadBlob(blob, fileName);
  return { fileName, chapters, blob };
}

export async function exportPdf(document, options) {
  const fileName = safeFileName(options.fileName || options.title || document.title || "documento", "pdf");
  const pages = paginateText(markdownToPlainText(document.contentMarkdown || ""), 2800);
  const pdf = buildSimplePdf([
    `${options.title || document.title || "Documento"}\n${options.author ? `Autor: ${options.author}\n` : ""}`,
    ...pages,
  ]);
  downloadBlob(new Blob([pdf], { type: "application/pdf" }), fileName);
  return { fileName };
}

export function buildPostVariants(markdown = "") {
  const text = markdownToPlainText(markdown).replace(/\s+/g, " ").trim();
  const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean);
  return {
    full: text,
    summary: sentences.slice(0, 3).join(" "),
    instagram: text.slice(0, 700),
    blog: text,
  };
}

export function markdownToHtml(markdown = "") {
  return markdown
    .split(/\r?\n/)
    .map((line) => {
      if (line.startsWith("# ")) return `<h1>${escapeHtml(line.slice(2))}</h1>`;
      if (line.startsWith("## ")) return `<h2>${escapeHtml(line.slice(3))}</h2>`;
      if (line.startsWith("> ")) return `<blockquote>${escapeHtml(line.slice(2))}</blockquote>`;
      if (line.trim() === "---") return "<hr/>";
      if (line.startsWith("- ")) return `<ul><li>${escapeHtml(line.slice(2))}</li></ul>`;
      if (!line.trim()) return "";
      return `<p>${escapeHtml(line)}</p>`;
    })
    .join("\n")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/!\[([^\]]*)]\(([^)]+)\)/g, '<img alt="$1" src="$2" />')
    .replace(/\[([^\]]+)]\(([^)]+)\)/g, '<a href="$2">$1</a>');
}

function xhtmlPage(title, body) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="es">
<head><title>${escapeXml(title)}</title><style>body{font-family:serif;line-height:1.55;} img{max-width:100%;}</style></head>
<body>${body}</body></html>`;
}

function buildSimplePdf(pages) {
  const objects = [];
  const pageRefs = [];
  objects.push("<< /Type /Catalog /Pages 2 0 R >>");
  objects.push("<< /Type /Pages /Kids [] /Count 0 >>");
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  pages.forEach((page) => {
    const content = pdfTextContent(page);
    const contentId = objects.length + 2;
    const pageId = objects.length + 1;
    pageRefs.push(`${pageId} 0 R`);
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentId} 0 R >>`);
    objects.push(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
  });
  objects[1] = `<< /Type /Pages /Kids [${pageRefs.join(" ")}] /Count ${pageRefs.length} >>`;
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return pdf;
}

function pdfTextContent(text) {
  const lines = text.split(/\r?\n/).flatMap((line) => wrapLine(line, 82)).slice(0, 46);
  return `BT /F1 11 Tf 56 790 Td 15 TL ${lines.map((line) => `(${escapePdf(line)}) Tj T*`).join(" ")} ET`;
}

function wrapLine(line, size) {
  const words = line.split(/\s+/);
  const lines = [];
  let current = "";
  words.forEach((word) => {
    if ((current + " " + word).trim().length > size) {
      lines.push(current);
      current = word;
    } else {
      current = `${current} ${word}`.trim();
    }
  });
  lines.push(current);
  return lines;
}

function paginateText(text, size) {
  const pages = [];
  for (let index = 0; index < text.length; index += size) pages.push(text.slice(index, index + size));
  return pages.length ? pages : [""];
}

function markdownToPlainText(markdown) {
  return markdown
    .replace(/!\[([^\]]*)]\(([^)]+)\)/g, "$1 $2")
    .replace(/\[([^\]]+)]\(([^)]+)\)/g, "$1 $2")
    .replace(/[#>*_`-]/g, "")
    .trim();
}

function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function safeFileName(name, extension) {
  const clean = String(name || "documento").toLowerCase().replace(/[^a-z0-9áéíóúñü]+/gi, "-").replace(/^-+|-+$/g, "") || "documento";
  return clean.endsWith(`.${extension}`) ? clean : `${clean}.${extension}`;
}

function escapeXml(value = "") {
  return escapeHtml(value).replace(/"/g, "&quot;");
}

function escapeHtml(value = "") {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapePdf(value = "") {
  return String(value).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)").replace(/[^\x09\x0A\x0D\x20-\x7E]/g, "");
}
