import { getDownloadURL, ref as storageRef, uploadBytes } from "firebase/storage";
import { storage } from "./firebase";

export const imageTypes = ["image/jpeg", "image/png", "image/webp"];

export function cleanText(value) {
  return (value || "").trim();
}

export function firebaseKey(text) {
  return (text || "modulo").replace(/[^a-zA-Z0-9_-]+/g, "_").replace(/^_+|_+$/g, "") || "modulo";
}

export function youtubeEmbedUrl(url) {
  if (!url) return "";
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    let id = "";

    if (host.includes("youtu.be")) {
      id = parsed.pathname.replace("/", "").split("/")[0];
    } else if (host.includes("youtube.com")) {
      if (parsed.pathname.startsWith("/shorts/") || parsed.pathname.startsWith("/embed/")) {
        id = parsed.pathname.split("/")[2];
      } else {
        id = parsed.searchParams.get("v") || "";
      }
    }

    return id ? `https://www.youtube-nocookie.com/embed/${id}?rel=0&playsinline=1&vq=hd1080` : url;
  } catch {
    return url;
  }
}

export function downloadUrl(url, filename = "material.pdf") {
  if (!url) return "#";
  if (!url.includes("firebasestorage.googleapis.com")) return url;
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}response-content-disposition=attachment%3B%20filename%3D${encodeURIComponent(filename)}`;
}

export function drivePreviewUrl(url) {
  if (!url) return "";
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.includes("drive.google.com")) return url;
    const idFromQuery = parsed.searchParams.get("id");
    const match = parsed.pathname.match(/\/(?:file\/d|d)\/([^/]+)/);
    const id = idFromQuery || match?.[1];
    return id ? `https://drive.google.com/file/d/${id}/preview` : url;
  } catch {
    return url;
  }
}

export function pdfViewerUrl(url) {
  if (!url) return "";
  if (url.includes("drive.google.com")) return drivePreviewUrl(url);
  return url;
}

export async function optimizeImageToWebp(file, maxSize = 1200, quality = 0.82) {
  if (!imageTypes.includes(file.type)) {
    throw new Error("La imagen debe ser JPG, PNG o WEBP.");
  }

  const source = await loadImageSource(file);
  const scale = Math.min(1, maxSize / Math.max(source.width, source.height));
  const width = Math.round(source.width * scale);
  const height = Math.round(source.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(source.image, 0, 0, width, height);
  source.cleanup?.();

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/webp", quality));
  if (!blob) throw new Error("No se pudo optimizar la imagen.");
  return blob;
}

export async function optimizeImageToDataUrl(file, maxSize = 360, quality = 0.76) {
  if (!imageTypes.includes(file.type)) {
    throw new Error("La imagen debe ser JPG, PNG o WEBP.");
  }

  const source = await loadImageSource(file);
  const scale = Math.min(1, maxSize / Math.max(source.width, source.height));
  const width = Math.round(source.width * scale);
  const height = Math.round(source.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(source.image, 0, 0, width, height);
  source.cleanup?.();
  return canvas.toDataURL("image/webp", quality);
}

async function loadImageSource(file) {
  if ("createImageBitmap" in window) {
    try {
      const bitmap = await createImageBitmap(file);
      return {
        image: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        cleanup: () => bitmap.close?.(),
      };
    } catch {
      // Some mobile browsers fail here with camera photos; fall back to an HTML image.
    }
  }

  const objectUrl = URL.createObjectURL(file);
  const image = new Image();
  image.decoding = "async";
  image.src = objectUrl;
  await new Promise((resolve, reject) => {
    image.onload = resolve;
    image.onerror = () => reject(new Error("No se pudo leer la imagen."));
  });

  return {
    image,
    width: image.naturalWidth,
    height: image.naturalHeight,
    cleanup: () => URL.revokeObjectURL(objectUrl),
  };
}

export async function uploadOptimizedImage(file, folder) {
  const blob = await optimizeImageToWebp(file);
  const path = `${folder}/${new Date().toISOString().slice(0, 10)}_${crypto.randomUUID()}.webp`;
  const ref = storageRef(storage, path);
  await uploadBytes(ref, blob, { contentType: "image/webp" });
  return { url: await getDownloadURL(ref), path };
}

export async function uploadPdf(file, folder) {
  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
    throw new Error("El archivo debe ser PDF.");
  }
  const path = `${folder}/${new Date().toISOString().slice(0, 10)}_${crypto.randomUUID()}.pdf`;
  const ref = storageRef(storage, path);
  await uploadBytes(ref, file, { contentType: "application/pdf" });
  return { url: await getDownloadURL(ref), path };
}

export async function uploadEpub(file, folder) {
  const name = file.name.toLowerCase();
  const isEpub = file.type === "application/epub+zip" || name.endsWith(".epub");
  if (!isEpub) {
    throw new Error("El archivo debe ser EPUB.");
  }
  const path = `${folder}/${new Date().toISOString().slice(0, 10)}_${crypto.randomUUID()}.epub`;
  const ref = storageRef(storage, path);
  await uploadBytes(ref, file, { contentType: "application/epub+zip" });
  return { url: await getDownloadURL(ref), path };
}

export async function uploadAudio(file, folder) {
  const name = file.name.toLowerCase();
  const isM4a = file.type === "audio/mp4" || file.type === "audio/x-m4a" || name.endsWith(".m4a");
  if (!isM4a) {
    throw new Error("El audio debe ser un archivo M4A.");
  }
  const path = `${folder}/${new Date().toISOString().slice(0, 10)}_${crypto.randomUUID()}.m4a`;
  const ref = storageRef(storage, path);
  await uploadBytes(ref, file, { contentType: "audio/mp4" });
  return { url: await getDownloadURL(ref), path };
}
