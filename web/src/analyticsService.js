import { logEvent } from "firebase/analytics";
import { doc, increment, serverTimestamp, setDoc } from "firebase/firestore";
import { analyticsPromise, auth, firestoreDb } from "./firebase";

const ANALYTICS_ENDPOINT = "/api/analytics-event";
const COMMUNITY_ANALYTICS_ENABLED = true;
const STOP_WORDS = new Set([
  "para", "como", "con", "por", "una", "uno", "las", "los", "del", "que",
  "este", "esta", "esto", "sobre", "desde", "hacia", "cuando", "donde",
  "quiero", "puedo", "necesito", "ashram", "ganesha", "guia",
  "cual", "cuales", "hacer", "decir", "tengo", "estoy", "puede", "pueden",
  "consulta", "consultar", "saber", "interesa", "interes", "tema", "temas",
]);

export function startAnalyticsSession(user, profile) {
  if (!user?.uid) return () => {};
  recordLogin(user, profile).catch(logPresenceError);
  setPresence(user, profile, true).catch(logPresenceError);

  const heartbeat = window.setInterval(() => {
    setPresence(user, profile, true).catch(logPresenceError);
  }, 60 * 1000);
  const handleVisibility = () => {
    setPresence(user, profile, document.visibilityState === "visible").catch(logPresenceError);
  };
  const markOffline = () => {
    setPresence(user, profile, false).catch(logPresenceError);
  };

  document.addEventListener("visibilitychange", handleVisibility);
  window.addEventListener("pagehide", markOffline);
  window.addEventListener("beforeunload", markOffline);

  return () => {
    window.clearInterval(heartbeat);
    document.removeEventListener("visibilitychange", handleVisibility);
    window.removeEventListener("pagehide", markOffline);
    window.removeEventListener("beforeunload", markOffline);
    markOffline();
  };
}

export async function recordLogin(user, profile = {}) {
  if (!user?.uid) return undefined;
  return setDoc(doc(firestoreDb, "userAnalytics", user.uid), {
    userId: user.uid,
    email: user.email || profile.email || "",
    displayName: displayName(user, profile),
    lastLogin: serverTimestamp(),
    lastActiveAt: serverTimestamp(),
    lastActiveDateKey: dateKey(),
    totalLogins: increment(1),
    deviceType: deviceType(),
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

export async function setPresence(user, profile = {}, isOnline = true) {
  if (!user?.uid) return undefined;
  return setDoc(doc(firestoreDb, "userPresence", user.uid), {
    userId: user.uid,
    email: user.email || profile.email || "",
    displayName: displayName(user, profile),
    isOnline: Boolean(isOnline),
    lastActiveAt: serverTimestamp(),
    deviceType: deviceType(),
  }, { merge: true });
}

export async function trackEvent(eventType, payload = {}) {
  trackFirebaseAnalyticsEvent(eventType, payload);
  if (!COMMUNITY_ANALYTICS_ENABLED) return;
  const user = auth.currentUser;
  if (!user?.uid || !eventType) return;
  if (!isCommunityInterestEvent(eventType)) return;
  const topics = normalizeTopics(payload.detectedTopics?.length ? payload.detectedTopics : extractTopics([
    payload.contentTitle,
    payload.contentCategory,
    payload.question,
    payload.searchQuery,
  ].filter(Boolean).join(" ")));
  const keywords = normalizeTopics(payload.keywords?.length ? payload.keywords : topics);
  const eventData = {
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
    productId: payload.productId || payload.contentId || "",
    productName: trimText(payload.productName || payload.contentTitle || "", 180),
    shareMethod: trimText(payload.shareMethod || "", 80),
    imageAttached: Boolean(payload.imageAttached),
    shareUrl: trimText(payload.shareUrl || "", 500),
    value: Number(payload.value || 0),
    quantity: Number(payload.quantity || 0),
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
      }),
    });
    if (response.ok) {
      console.log("Interes comunitario registrado", {
        eventType,
        contentType: eventData.contentType,
        contentTitle: eventData.contentTitle,
        detectedTopics: eventData.detectedTopics,
      });
      return;
    }
    console.warn("Endpoint de intereses respondio con error", response.status, await response.text().catch(() => ""));
  } catch (error) {
    console.warn("No se pudo registrar interes comunitario.", error);
  }
}

async function trackFirebaseAnalyticsEvent(eventType, payload = {}) {
  if (!eventType) return;
  try {
    const analytics = await analyticsPromise;
    if (!analytics) return;
    const eventData = sanitizeAnalyticsPayload({
      ...payload,
      user_state: auth.currentUser?.uid ? "registrado" : "visitante",
      screen_name: payload.screenName || payload.contentType || payload.contentCategory || "",
      content_type: payload.contentType || "",
      content_id: payload.contentId || "",
      content_title: payload.contentTitle || "",
      content_category: payload.contentCategory || payload.category || "",
    });
    logEvent(analytics, normalizeAnalyticsEventName(eventType), eventData);
    if (eventType === "open_section") {
      logEvent(analytics, "screen_view", sanitizeAnalyticsPayload({
        firebase_screen: payload.contentTitle || payload.contentId || "home",
        firebase_screen_class: "AshramWeb",
        screen_name: payload.contentTitle || payload.contentId || "home",
      }));
    }
  } catch (error) {
    console.warn("No se pudo enviar evento a Firebase Analytics.", error);
  }
}

function normalizeAnalyticsEventName(eventType = "") {
  return String(eventType || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40) || "evento";
}

function sanitizeAnalyticsPayload(payload = {}) {
  return Object.fromEntries(Object.entries(payload)
    .map(([key, value]) => [normalizeAnalyticsParamName(key), analyticsParamValue(value)])
    .filter(([key, value]) => key && value !== undefined && value !== ""));
}

function normalizeAnalyticsParamName(key = "") {
  return String(key || "")
    .replace(/[A-Z]/g, (match) => `_${match.toLowerCase()}`)
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}

function analyticsParamValue(value) {
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.join(", ").slice(0, 100);
  if (value == null) return "";
  return String(value).slice(0, 100);
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
  return undefined;
}

function isCommunityInterestEvent(eventType = "") {
  return [
    "open_section",
    "section_time",
    "landing_view",
    "app_open",
    "tienda_open",
    "login_success",
    "signup_success",
    "continue_as_guest",
    "open_post",
    "open_article",
    "open_course",
    "open_meditation",
    "open_book",
    "ask_ganesha",
    "search_content",
    "finish_meditation",
    "open_video",
    "click_related_resource",
    "open_content",
    "store_view",
    "product_view",
    "store_product_shared",
    "whatsapp_order_click",
    "whatsapp_order_confirmed",
    "begin_checkout",
    "add_to_cart",
  ].includes(eventType);
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

function trimText(value = "", max = 200) {
  return String(value || "").trim().slice(0, max);
}

function displayName(user, profile = {}) {
  return trimText(profile.nombre || profile.displayName || user?.displayName || user?.email || "Usuario", 160);
}

function logPresenceError(error) {
  console.warn("No se pudo actualizar presencia.", error);
}

function titleCase(value = "") {
  const text = String(value || "").trim();
  if (!text) return "";
  return text.charAt(0).toUpperCase() + text.slice(1);
}
