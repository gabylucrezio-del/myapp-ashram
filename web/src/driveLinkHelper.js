export function googleDriveFileId(url) {
  if (!url) return "";
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.includes("drive.google.com") && !parsed.hostname.includes("drive.usercontent.google.com")) return "";
    const idFromQuery = parsed.searchParams.get("id");
    const match = parsed.pathname.match(/\/(?:file\/d|d)\/([^/]+)/);
    return idFromQuery || match?.[1] || "";
  } catch {
    return "";
  }
}

export function drivePreviewUrl(url) {
  const id = googleDriveFileId(url);
  return id ? `https://drive.google.com/file/d/${id}/preview` : url || "";
}

export function driveDownloadUrl(url) {
  const id = googleDriveFileId(url);
  return id ? `https://drive.usercontent.google.com/download?id=${id}&export=download` : url || "";
}

export function driveImageUrl(url) {
  const id = googleDriveFileId(url);
  return id ? `https://drive.google.com/thumbnail?id=${id}&sz=w1200` : url || "";
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
    return id ? `https://www.youtube-nocookie.com/embed/${id}?rel=0&playsinline=1` : "";
  } catch {
    return "";
  }
}

export function videoEmbedUrl(url) {
  return youtubeEmbedUrl(url) || drivePreviewUrl(url);
}
