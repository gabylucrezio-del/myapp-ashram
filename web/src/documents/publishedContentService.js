import { get, push, ref, remove, update } from "firebase/database";
import { db } from "../firebase";

const PUBLISHED_PATH = "publishedContent";

export async function publishToFirebase(payload) {
  const { document, type, title, description, coverUrl, publicFileUrl, content } = payload;
  const now = new Date().toISOString();
  const sourceDocumentId = payload.sourceDocumentId || document?.id || "";
  const sourceFolderId = payload.sourceFolderId || document?.folderId || "";
  const existing = sourceDocumentId && payload.publishMode !== "new" ? await findPublishedBySource(sourceDocumentId, type) : null;
  const published = normalizePublishedContent({
    id: existing?.id,
    sourceDocumentId,
    sourceFolderId,
    type,
    title: title || document?.title || document?.name || "Sin titulo",
    subtitle: payload.subtitle,
    description,
    summary: payload.summary,
    content: content ?? document?.contentMarkdown ?? "",
    coverUrl,
    imageUrl: payload.imageUrl || coverUrl,
    imagen: payload.imageUrl || coverUrl,
    imageStoragePath: payload.imageStoragePath,
    category: payload.category,
    keywords: payload.keywords,
    keywordList: payload.keywordList,
    tags: payload.tags,
    author: payload.author,
    publicFileUrl: publicFileUrl || document?.publicFileUrl || document?.webViewLink || "",
    format: payload.format,
    price: payload.price,
    isFree: payload.isFree,
    level: payload.level,
    instructor: payload.instructor,
    duration: payload.duration,
    resourceType: payload.resourceType,
    style: payload.style,
    status: payload.status || "published",
    createdAt: existing?.createdAt || now,
    updatedAt: now,
    publishedAt: payload.publishedAt || existing?.publishedAt || now,
  });

  if (existing?.id) {
    await update(ref(db, `${PUBLISHED_PATH}/${existing.id}`), published);
    return published;
  }

  const itemRef = push(ref(db, PUBLISHED_PATH));
  const next = { ...published, id: itemRef.key };
  await update(itemRef, next);
  return next;
}

export async function updatePublishedContent(id, patch) {
  const next = {
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  await update(ref(db, `${PUBLISHED_PATH}/${id}`), next);
  return { id, ...next };
}

export async function unpublishContent(id) {
  await remove(ref(db, `${PUBLISHED_PATH}/${id}`));
}

async function findPublishedBySource(sourceDocumentId, type) {
  const snap = await get(ref(db, PUBLISHED_PATH));
  if (!snap.exists()) return null;
  const entries = Object.entries(snap.val() || {});
  const found = entries.find(([, item]) => item.sourceDocumentId === sourceDocumentId && item.type === type);
  return found ? { id: found[0], ...found[1] } : null;
}

function normalizePublishedContent(item) {
  return {
    id: item.id || "",
    sourceDocumentId: item.sourceDocumentId || "",
    sourceFolderId: item.sourceFolderId || "",
    type: item.type || "post",
    title: (item.title || "").trim(),
    subtitle: (item.subtitle || "").trim(),
    description: (item.description || "").trim(),
    summary: (item.summary || "").trim(),
    content: item.content || "",
    coverUrl: (item.coverUrl || "").trim(),
    imageUrl: (item.imageUrl || item.coverUrl || item.imagen || "").trim(),
    imagen: (item.imagen || item.imageUrl || item.coverUrl || "").trim(),
    imageStoragePath: (item.imageStoragePath || item.imagen_path || "").trim(),
    category: (item.category || "").trim(),
    keywords: (item.keywords || "").trim(),
    keywordList: Array.isArray(item.keywordList) ? item.keywordList : [],
    tags: Array.isArray(item.tags) ? item.tags : [],
    author: (item.author || "").trim(),
    publicFileUrl: (item.publicFileUrl || "").trim(),
    format: item.format || "",
    price: item.price || "",
    isFree: item.isFree !== false,
    level: item.level || "",
    instructor: item.instructor || "",
    duration: item.duration || "",
    resourceType: item.resourceType || "",
    style: item.style || "",
    status: item.status || "published",
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    publishedAt: item.publishedAt,
  };
}
