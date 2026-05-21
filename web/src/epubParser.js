import JSZip from "jszip";

export async function parseEpubBuffer(buffer, onStatus = () => {}) {
  onStatus("Abriendo paquete EPUB...");
  const zip = await JSZip.loadAsync(buffer);
  const parser = new DOMParser();
  onStatus("Buscando indice interno...");
  const containerText = await zip.file("META-INF/container.xml")?.async("text");
  if (!containerText) throw new Error("Este EPUB no tiene el archivo META-INF/container.xml.");

  const container = parser.parseFromString(containerText, "application/xml");
  const opfPath = firstElement(container, "rootfile")?.getAttribute("full-path");
  if (!opfPath) throw new Error("No se encontro el indice interno del EPUB.");

  const opfText = await zip.file(opfPath)?.async("text");
  if (!opfText) throw new Error("No se pudo leer content.opf.");
  const opf = parser.parseFromString(opfText, "application/xml");
  const basePath = opfPath.includes("/") ? opfPath.slice(0, opfPath.lastIndexOf("/") + 1) : "";
  const title = firstElement(opf, "title")?.textContent?.trim() || "";

  const manifest = new Map(
    elements(opf, "item").map((item) => [
      item.getAttribute("id"),
      {
        href: item.getAttribute("href") || "",
        mediaType: item.getAttribute("media-type") || "",
      },
    ]),
  );

  const spineIds = elements(opf, "itemref").map((item) => item.getAttribute("idref"));
  const chapters = [];

  for (const id of spineIds) {
    onStatus(`Preparando capitulo ${chapters.length + 1}...`);
    const manifestItem = manifest.get(id);
    if (!manifestItem?.href || !/x?html/i.test(manifestItem.mediaType)) continue;
    const chapterPath = normalizeZipPath(basePath + manifestItem.href);
    const chapterText = await zip.file(chapterPath)?.async("text");
    if (!chapterText) continue;
    const chapterDoc = parser.parseFromString(chapterText, "text/html");
    chapterDoc.querySelectorAll("script, style, link").forEach((node) => node.remove());
    await rewriteImages(chapterDoc, zip, chapterPath);
    const chapterTitle = chapterDoc.querySelector("h1,h2,h3,title")?.textContent?.trim() || `Capitulo ${chapters.length + 1}`;
    chapters.push({
      href: manifestItem.href,
      title: chapterTitle,
      html: chapterDoc.body?.innerHTML || "<p></p>",
    });
  }

  if (!chapters.length) throw new Error("No encontre capitulos legibles dentro de este EPUB.");
  return { title, chapters };
}

async function rewriteImages(doc, zip, chapterPath) {
  const chapterBase = chapterPath.includes("/") ? chapterPath.slice(0, chapterPath.lastIndexOf("/") + 1) : "";
  const images = Array.from(doc.querySelectorAll("img"));
  await Promise.all(images.map(async (img) => {
    const src = img.getAttribute("src");
    if (!src || /^https?:|^data:/i.test(src)) return;
    const imagePath = normalizeZipPath(chapterBase + src);
    const file = zip.file(imagePath);
    if (!file) return;
    const base64 = await file.async("base64");
    const type = imagePath.toLowerCase().endsWith(".png") ? "image/png" : imagePath.toLowerCase().endsWith(".webp") ? "image/webp" : "image/jpeg";
    img.setAttribute("src", `data:${type};base64,${base64}`);
  }));
}

function elements(doc, localName) {
  return Array.from(doc.getElementsByTagName("*")).filter((item) => item.localName === localName);
}

function firstElement(doc, localName) {
  return elements(doc, localName)[0] || null;
}

function normalizeZipPath(path) {
  const parts = [];
  path.split("/").forEach((part) => {
    if (!part || part === ".") return;
    if (part === "..") parts.pop();
    else parts.push(decodeURIComponent(part));
  });
  return parts.join("/");
}
