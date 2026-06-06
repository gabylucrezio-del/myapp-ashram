import { auth } from "../firebase";

const TRANSFORM_ENDPOINT = "/api/ganesha-transform-document";
const GEMINI_BUSY_MESSAGE =
  "Ganesha está integrando la respuesta. Hay mucha actividad en este momento. Intentá nuevamente en unos instantes.";
const RETRY_DELAYS_MS = [2000, 4000, 6000];

export const DOCUMENT_AI_ACTIONS = [
  { id: "summary", label: "Crear resumen", target: "document" },
  { id: "post", label: "Crear post", target: "publish", publishType: "post" },
  { id: "article", label: "Crear artículo", target: "publish", publishType: "article" },
  { id: "video_script", label: "Crear guion para video", target: "document" },
];

export async function transformDocumentWithAi({ action, document, onStatus }) {
  const token = await auth.currentUser?.getIdToken?.();
  if (!token) throw new Error("Necesitas iniciar sesion para usar IA.");

  let lastError = null;
  const totalAttempts = RETRY_DELAYS_MS.length + 1;
  for (let attempt = 1; attempt <= totalAttempts; attempt += 1) {
    onStatus?.({
      phase: "loading",
      message: "Consultando la sabiduría del Ashram...",
      attempt,
      totalAttempts,
    });

    try {
      return await requestTransform({ token, action, document });
    } catch (error) {
      lastError = error;
      if (!isGeminiUnavailable(error) || attempt === totalAttempts) break;
      const delayMs = RETRY_DELAYS_MS[attempt - 1];
      onStatus?.({
        phase: "retrying",
        message: "Consultando la sabiduría del Ashram...",
        attempt,
        totalAttempts,
        delayMs,
      });
      await wait(delayMs);
    }
  }

  if (isGeminiUnavailable(lastError)) {
    const friendly = new Error(GEMINI_BUSY_MESSAGE);
    friendly.isRetryable = true;
    throw friendly;
  }
  throw lastError || new Error("No se pudo crear el borrador con IA.");
}

async function requestTransform({ token, action, document }) {
  const response = await fetch(TRANSFORM_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      action,
      title: document?.title || document?.displayName || "",
      content: document?.contentMarkdown || document?.content || "",
      documentId: document?.id || "",
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || "No se pudo crear el borrador con IA.");
    error.status = response.status;
    error.code = data.code || "";
    throw error;
  }
  return data;
}

function isGeminiUnavailable(error) {
  const text = `${error?.status || ""} ${error?.code || ""} ${error?.message || ""}`.toUpperCase();
  return text.includes("503") || text.includes("UNAVAILABLE");
}

function wait(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
