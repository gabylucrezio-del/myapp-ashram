import { auth, firestoreDb } from "./firebase";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  increment,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";

const SESSION_KEY = "ashram-analytics-session";
const ANALYTICS_ENDPOINT = "/api/analytics-event";
const ANALYTICS_DISABLED = true;
const STOP_WORDS = new Set([
  "para", "como", "con", "por", "una", "uno", "las", "los", "del", "que",
  "este", "esta", "esto", "sobre", "desde", "hacia", "cuando", "donde",
  "quiero", "puedo", "necesito", "ashram", "ganesha", "guia",
  "cual", "cuales", "hacer", "decir", "tengo", "estoy", "puede", "pueden",
]);

export function startAnalyticsSession(user, profile) {
  // Hook-shaped helper kept dependency-free so App can call it from useEffect.
  if (ANALYTICS_DISABLED) return () => {};
  if (!user?.uid) return () => {};
  const startedAt = Date.now();
  const sessionId = ensureSessionId();
  let closed = false;

  recordLogin(user, profile);
  setPresence(user, profile, true);
  console.log("Usuario activo", { userId: user.uid, deviceType: deviceType() });
  trackEvent("login", { contentTitle: "Ingreso a la plataforma" });

  const activityTimer = window.setInterval(() => {
    setPresence(user, profile, true);
  }, 60000);

  const closeSession = () => {
    if (closed) return;
    closed = true;
    window.clearInterval(activityTimer);
    const durationMinutes = Math.max(1, Math.round((Date.now() - startedAt) / 60000));
    updateSessionMinutes(user.uid, durationMinutes);
    trackEvent("logout", { durationMinutes, sessionId });
    setPresence(user, profile, false);
  };

  const onVisibility = () => {
    if (document.visibilityState === "hidden") {
      const durationMinutes = Math.max(1, Math.round((Date.now() - startedAt) / 60000));
      updateSessionMinutes(user.uid, durationMinutes);
      setPresence(user, profile, false);
    } else {
      setPresence(user, profile, true);
    }
  };

  window.addEventListener("beforeunload", closeSession);
  document.addEventListener("visibilitychange", onVisibility);
  return () => {
    window.removeEventListener("beforeunload", closeSession);
    document.removeEventListener("visibilitychange", onVisibility);
    closeSession();
  };
}

export async function recordLogin(user, profile = {}) {
  if (ANALYTICS_DISABLED) return;
  if (!user?.uid) return;
  const ref = doc(firestoreDb, "userAnalytics", user.uid);
  const current = await getDoc(ref).catch(() => null);
  const base = {
    userId: user.uid,
    lastLogin: serverTimestamp(),
    lastActiveAt: serverTimestamp(),
    lastActiveDateKey: dateKey(),
    totalLogins: increment(1),
    deviceType: deviceType(),
    updatedAt: serverTimestamp(),
  };
  if (!current?.exists?.()) {
    base.registeredAt = serverTimestamp();
    base.totalMinutes = 0;
    base.interests = [];
  }
  await setDoc(ref, base, { merge: true }).catch((error) => {
    console.warn("No se pudo registrar analitica de login", error);
  });
}

export async function setPresence(user, profile = {}, isOnline = true) {
  if (ANALYTICS_DISABLED) return;
  if (!user?.uid) return;
  const presenceData = {
    userId: user.uid,
    isOnline,
    lastActiveAt: serverTimestamp(),
    deviceType: deviceType(),
  };
  console.log("Usuario activo", { userId: user.uid, isOnline, deviceType: presenceData.deviceType });
  await setDoc(doc(firestoreDb, "userPresence", user.uid), presenceData, { merge: true }).catch((error) => {
    console.warn("No se pudo actualizar presencia", error);
  });
  await setDoc(doc(firestoreDb, "users", user.uid), presenceData, { merge: true }).catch((error) => {
    console.warn("No se pudo actualizar presencia en users", error);
  });
}

export async function trackEvent(eventType, payload = {}) {
  if (ANALYTICS_DISABLED) return;
  const user = auth.currentUser;
  if (!user?.uid || !eventType) return;
  console.log("Registrando evento", eventType, payload);
  const topics = normalizeTopics(payload.detectedTopics?.length ? payload.detectedTopics : extractTopics([
    payload.contentTitle,
    payload.contentCategory,
    payload.question,
    payload.searchQuery,
  ].filter(Boolean).join(" ")));
  const keywords = normalizeTopics(payload.keywords?.length ? payload.keywords : topics);
  const eventData = {
    userId: user.uid,
    eventType,
    contentId: payload.contentId || "",
    contentTitle: trimText(payload.contentTitle || "", 180),
    contentType: payload.contentType || "",
    contentCategory: trimText(payload.contentCategory || "", 120),
    category: trimText(payload.category || payload.contentCategory || "", 120),
    tags: normalizeTopics(payload.tags || []),
    keywords,
    question: trimText(payload.question || "", 800),
    searchQuery: trimText(payload.searchQuery || "", 180),
    detectedTopics: topics,
    durationMinutes: Number(payload.durationMinutes || 0),
    timestamp: serverTimestamp(),
    dateKey: dateKey(),
    deviceType: deviceType(),
  };
  try {
    const token = await user.getIdToken();
    const response = await fetch(ANALYTICS_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...eventData,
        timestamp: undefined,
      }),
    });
    if (response.ok) {
      console.log("Evento registrado", eventType);
      return;
    }
    console.warn("Endpoint de analiticas respondio con error", response.status, await response.text().catch(() => ""));
  } catch (error) {
    console.warn("Endpoint de analiticas no disponible, usando fallback.", error);
  }
  await addDoc(collection(firestoreDb, "analyticsEvents"), eventData).catch((error) => {
    console.warn("No se pudo registrar evento analitico", error);
  });
}

export function trackContentOpen(contentType, item = {}, extra = {}) {
  const tags = Array.isArray(item.tags) ? item.tags : Array.isArray(item.etiquetas) ? item.etiquetas : [];
  const keywords = extractTopics(contentText(item, extra));
  return trackEvent(eventTypeForContent(contentType), {
    contentType,
    contentId: item.id || extra.contentId || "",
    contentTitle: item.tema || item.titulo || item.title || extra.contentTitle || "",
    contentCategory: item.categoria || item.etiqueta || extra.contentCategory || "",
    category: item.categoria || item.etiqueta || extra.contentCategory || "",
    tags,
    keywords,
    detectedTopics: keywords,
  });
}

export function trackSearch(searchQuery, section = "") {
  return trackEvent("search_content", {
    searchQuery,
    contentType: section,
    keywords: extractTopics(searchQuery),
    detectedTopics: extractTopics(searchQuery),
  });
}

export function trackGaneshaQuestion(question) {
  console.log("Consulta a Ganesha", question);
  return trackEvent("ask_ganesha", {
    question,
    contentType: "ganesha-guia",
    keywords: extractTopics(question),
    detectedTopics: extractTopics(question),
  });
}

export function trackRelatedResource(resource = {}) {
  const keywords = extractTopics(contentText(resource));
  return trackEvent("click_related_resource", {
    contentType: resource.contentType || resource.type || "recurso-relacionado",
    contentId: resource.id || "",
    contentTitle: resource.title || resource.titulo || resource.tema || "",
    contentCategory: resource.category || resource.categoria || "",
    category: resource.category || resource.categoria || "",
    keywords,
    detectedTopics: keywords,
  });
}

async function updateSessionMinutes(userId, durationMinutes) {
  if (ANALYTICS_DISABLED) return;
  if (!userId || !durationMinutes) return;
  await updateDoc(doc(firestoreDb, "userAnalytics", userId), {
    totalMinutes: increment(durationMinutes),
    lastActiveAt: serverTimestamp(),
    lastActiveDateKey: dateKey(),
    updatedAt: serverTimestamp(),
  }).catch(() => {});
}

function eventTypeForContent(contentType) {
  const map = {
    blog: "open_post",
    post: "open_post",
    article: "open_article",
    articulo: "open_article",
    articulos: "open_article",
    course: "open_course",
    curso: "open_course",
    conocimiento: "open_course",
    ejercicios: "open_course",
    meditation: "open_meditation",
    meditacion: "open_meditation",
    meditaciones: "open_meditation",
    book: "open_book",
    libro: "open_book",
    biblioteca: "open_book",
    video: "open_video",
    satsang: "open_video",
  };
  return map[contentType] || `open_${contentType || "content"}`;
}

function contentText(item = {}, extra = {}) {
  return [
    item.tema,
    item.titulo,
    item.title,
    item.categoria,
    item.etiqueta,
    item.descripcion,
    item.keywords,
    extra.contentTitle,
    extra.contentCategory,
  ].filter(Boolean).join(" ");
}

export function extractTopics(value = "") {
  const normalized = String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/gi, " ");
  const counts = new Map();
  normalized.split(/\s+/)
    .map((word) => word.trim())
    .filter((word) => word.length >= 4 && !STOP_WORDS.has(word))
    .forEach((word) => counts.set(word, (counts.get(word) || 0) + 1));
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([word]) => titleCase(word));
}

function normalizeTopics(topics = []) {
  return [...new Set(topics.map((topic) => titleCase(topic)).filter(Boolean))].slice(0, 12);
}

function deviceType() {
  const ua = navigator.userAgent || "";
  if (/ipad|tablet/i.test(ua)) return "tablet";
  if (/mobi|android|iphone|ipod/i.test(ua)) return "mobile";
  return "desktop";
}

function dateKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function ensureSessionId() {
  const current = sessionStorage.getItem(SESSION_KEY);
  if (current) return current;
  const next = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  sessionStorage.setItem(SESSION_KEY, next);
  return next;
}

function trimText(value = "", max = 200) {
  return String(value || "").trim().slice(0, max);
}

function titleCase(value = "") {
  const text = String(value || "").trim();
  if (!text) return "";
  return text.charAt(0).toUpperCase() + text.slice(1);
}
