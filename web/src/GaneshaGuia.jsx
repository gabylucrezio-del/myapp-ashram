import { Send, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { onValue, push, ref, set } from "firebase/database";
import { db } from "./firebase";
import { trackGaneshaQuestion } from "./analyticsService";
import avatar01 from "./assets/avatar/ganesha_guia01.png";
import avatar02 from "./assets/avatar/ganesha_guia02.png";
import avatar03 from "./assets/avatar/ganesha_guia03.png";
import avatar04 from "./assets/avatar/ganesha_guia04.png";
import avatar05 from "./assets/avatar/ganesha_guia05.png";
import avatar06 from "./assets/avatar/ganesha_guia06.png";
import avatar07 from "./assets/avatar/ganesha_guia07.png";

const AVATAR_FRAMES = [avatar01, avatar02, avatar03, avatar04, avatar05, avatar06, avatar07];

// Ajustes rapidos: velocidad de la animacion y pausa antes de abrir el chat.
const FRAME_DURATION_MS = 220;
const INTRO_PAUSE_MS = 1150;
const KNOWLEDGE_PATH = "ganeshaKnowledge";
const VISIT_KEY = "ganeshaGuiaLastVisit";
const FIRST_VISIT_KEY = "ganeshaGuiaFirstVisitDone";
const SEVERAL_DAYS_MS = 3 * 24 * 60 * 60 * 1000;
const INSPIRATIONAL_PHRASES = [
  "La paz comienza cuando dejamos de luchar con el momento presente.",
  "Cada obstaculo puede convertirse en un maestro.",
  "Respira. Lo que buscas quizas ya esta dentro de ti.",
  "Un paso consciente tambien es camino.",
];

const FALLBACK_MESSAGE = "Sobre este tema todavía no tengo suficiente conocimiento dentro del Ashram.";
const ADMIN_FALLBACK_MESSAGE = "No sé cómo responder esta pregunta todavía. ¿Quieres enseñarme una respuesta?";

export default function GaneshaGuia({ onNavigate, profile }) {
  const userName = displayName(profile);
  const isAdmin = profile?.rol === "admin";
  const [isOpen, setIsOpen] = useState(false);
  const [isIntro, setIsIntro] = useState(false);
  const [frameIndex, setFrameIndex] = useState(0);
  const [introText, setIntroText] = useState("");
  const [welcomeText, setWelcomeText] = useState(() => buildWelcome(userName));
  const [messages, setMessages] = useState([]);
  const [query, setQuery] = useState("");
  const [knowledge, setKnowledge] = useState([]);
  const [teaching, setTeaching] = useState(null);
  const messagesRef = useRef(null);

  useEffect(() => {
    return subscribeKnowledge(setKnowledge);
  }, []);

  useEffect(() => {
    function openFromEvent() {
      openGuide();
    }
    window.addEventListener("open-ganesha-guia", openFromEvent);
    return () => window.removeEventListener("open-ganesha-guia", openFromEvent);
  }, [userName]);

  useEffect(() => {
    if (!isIntro) return undefined;
    setFrameIndex(0);
    setIntroText("");
    const timer = window.setInterval(() => {
      setFrameIndex((current) => {
        const next = current + 1;
        if (next >= AVATAR_FRAMES.length) {
          window.clearInterval(timer);
          window.setTimeout(() => {
            setIntroText(welcomeText);
            window.setTimeout(() => setIsIntro(false), INTRO_PAUSE_MS);
          }, FRAME_DURATION_MS);
          return AVATAR_FRAMES.length - 1;
        }
        return next;
      });
    }, FRAME_DURATION_MS);
    return () => window.clearInterval(timer);
  }, [isIntro, welcomeText]);

  useEffect(() => {
    messagesRef.current?.scrollTo({ top: messagesRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isOpen, isIntro]);

  function openGuide() {
    if (messages.length) {
      setIsOpen(true);
      setIsIntro(false);
      return;
    }
    const nextWelcome = buildWelcome(userName);
    const phrase = randomPhrase(knowledge);
    setWelcomeText(nextWelcome);
    setMessages([{ role: "bot", text: phrase ? `${nextWelcome}\n\n${phrase}` : nextWelcome, results: [] }]);
    setIsOpen(true);
    setIsIntro(true);
    localStorage.setItem(FIRST_VISIT_KEY, "yes");
    localStorage.setItem(VISIT_KEY, String(Date.now()));
  }

  function closeGuide() {
    setIsOpen(false);
    setIsIntro(false);
    setIntroText("");
  }

  async function submit(event) {
    event.preventDefault();
    const text = query.trim();
    if (!text) return;
    const greeting = greetingInfo(text);
    const questionText = greeting.remaining || text;
    setMessages((current) => [...current, { role: "user", text, sources: [] }]);
    setQuery("");
    if (greeting.isGreeting && !greeting.remaining) {
      setMessages((current) => [...current, {
        role: "bot",
        text: `${userName}, me alegra leerte. Decime que tema queres explorar dentro del Ashram y busco en los contenidos disponibles.`,
        sources: [],
      }]);
      return;
    }
    try {
      trackGaneshaQuestion(questionText);
      const response = await askGaneshaChat(questionText, userName, isAdmin);
      setMessages((current) => [...current, {
        role: "bot",
        text: response.answer,
        sources: response.sources || [],
        navigableSources: response.navigableSources || [],
        internalSourcesUsed: Boolean(response.internalSourcesUsed),
        internalSourceNote: response.internalSourceNote || "",
        teachable: Boolean(response.teachable),
        originalQuestion: questionText,
      }]);
    } catch (error) {
      console.error("GaneshaGuia error llamando endpoint nuevo:", error);
      setMessages((current) => {
        const botMessage = {
          role: "bot",
          text: isAdmin ? ADMIN_FALLBACK_MESSAGE : FALLBACK_MESSAGE,
          sources: [],
          teachable: isAdmin,
          originalQuestion: questionText,
        };
        return [...current, botMessage];
      });
    }
  }

  function handleComposerKeyDown(event) {
    if (event.key !== "Enter" || event.shiftKey) return;
    event.preventDefault();
    event.currentTarget.form?.requestSubmit();
  }

  function openSource(link) {
    const target = normalizeInternalLink(link);
    if (!target) return;
    const [view] = target.split("/");
    if (onNavigate && view) onNavigate(view);
    window.history.pushState({ source: target }, "", `#${target}`);
    window.dispatchEvent(new HashChangeEvent("hashchange"));
    setIsOpen(false);
  }

  return (
    <>
      {!isOpen ? (
        <button className="ganesha-float-button" type="button" onClick={openGuide} aria-label="Abrir Ganesha Guia">
          <img src={avatar01} alt="" />
        </button>
      ) : null}

      {isOpen ? (
        <div className="ganesha-assistant-layer" role="dialog" aria-label="Ganesha Guia">
          <div className="ganesha-assistant-backdrop" onClick={closeGuide} />
          {isIntro ? (
            <section className="ganesha-intro-card">
              <img src={AVATAR_FRAMES[frameIndex]} alt="Ganesha Guia" />
              {introText ? <p>{introText}</p> : null}
            </section>
          ) : (
            <section className="ganesha-widget">
              <header>
                <span>
                  <img src={avatar01} alt="" />
                  <strong>Ganesha Guia</strong>
                </span>
                <button className="icon-btn" type="button" onClick={closeGuide} aria-label="Cerrar Ganesha Guia">
                  <X size={18} />
                </button>
              </header>

              <div className="ganesha-widget-messages" ref={messagesRef} aria-live="polite">
                {messages.map((message, index) => (
                  <article className={`ganesha-widget-message ${message.role}`} key={`${message.role}-${index}`}>
                    <p>{message.text}</p>
                    {navigableMessageSources(message).length ? (
                      <div className="ganesha-widget-results">
                        <strong className="ganesha-sources-title">Podés ampliar aquí:</strong>
                        {navigableMessageSources(message).map((item) => (
                          <div className="ganesha-widget-result" key={`${item.type}-${item.title}-${item.link}`}>
                            {item.imageUrl ? <img src={item.imageUrl} alt="" /> : null}
                            <span>{item.type} - {item.category}</span>
                            <strong>{item.title}</strong>
                            {isCourseSource(item) ? (
                              <small>Existe un curso del Ashram que profundiza este tema.</small>
                            ) : item.description ? <small>{item.description}</small> : null}
                            <button className="ghost compact" type="button" onClick={() => openSource(item.link)}>
                              {item.actionLabel || relatedActionLabel(item)}
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : null}
                    {message.internalSourcesUsed || internalMessageSources(message).length ? (
                      <small className="ganesha-internal-note">
                        {message.internalSourceNote || "Basado en estudios y apuntes de Gabriel Premananda."}
                      </small>
                    ) : null}
                    {isAdmin && message.teachable ? (
                      <button className="ganesha-teach-btn" type="button" onClick={() => setTeaching(createTeachingDraft(message.originalQuestion || ""))}>
                        Enseñar respuesta a Ganesha
                      </button>
                    ) : null}
                  </article>
                ))}
              </div>

              <form className="ganesha-widget-form" onSubmit={submit}>
                <textarea
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={handleComposerKeyDown}
                  rows={1}
                  placeholder="Escribe tu mensaje..."
                  aria-label="Consulta para Ganesha Guia"
                />
                <button className="primary small" type="submit" aria-label="Enviar mensaje">
                  <Send size={17} />
                </button>
              </form>
            </section>
          )}
          {teaching ? (
            <GaneshaTeachModal
              draft={teaching}
              onChange={setTeaching}
              onClose={() => setTeaching(null)}
              onSaved={(saved) => {
                setTeaching(null);
                setKnowledge((current) => [{ id: saved.id, ...saved }, ...current]);
                setMessages((current) => [...current, {
                  role: "bot",
                  text: "Gracias. Esta enseñanza quedó guardada para futuras consultas dentro del Ashram.",
                  sources: [{ title: "Enseñanza de Gabriel Premananda", type: "Aprendizaje manual", category: saved.category || "Ashram" }],
                }]);
              }}
            />
          ) : null}
        </div>
      ) : null}
    </>
  );
}

function GaneshaTeachModal({ draft, onChange, onClose, onSaved }) {
  const [saving, setSaving] = useState(false);

  function setField(field, value) {
    onChange({ ...draft, [field]: value });
  }

  async function save(event) {
    event.preventDefault();
    if (!draft.originalQuestion.trim() || !draft.taughtAnswer.trim()) return;
    setSaving(true);
    try {
      const now = new Date().toISOString();
      const itemRef = push(ref(db, "ganeshaKnowledge"));
      const data = {
        originalQuestion: draft.originalQuestion.trim(),
        topic: draft.topic.trim(),
        taughtAnswer: draft.taughtAnswer.trim(),
        answer: draft.taughtAnswer.trim(),
        category: draft.category.trim(),
        keywords: draft.keywords.trim(),
        phrase: draft.phrase.trim(),
        active: Boolean(draft.active),
        priority: Number(draft.priority) || 0,
        sourceLabel: "Enseñanza de Gabriel Premananda",
        createdAt: now,
        updatedAt: now,
      };
      await set(itemRef, data);
      onSaved({ id: itemRef.key, ...data });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="ganesha-teach-modal" aria-label="Enseñar respuesta a Ganesha">
      <form onSubmit={save}>
        <div className="form-head">
          <h2>Enseñar respuesta a Ganesha</h2>
          <button className="icon-btn" type="button" onClick={onClose}><X size={18} /></button>
        </div>
        <label>Pregunta original<textarea value={draft.originalQuestion} onChange={(event) => setField("originalQuestion", event.target.value)} /></label>
        <label>Tema principal<input value={draft.topic} onChange={(event) => setField("topic", event.target.value)} placeholder="Ej: ansiedad, Vata, meditación" /></label>
        <label>Respuesta enseñada por Gabriel<textarea value={draft.taughtAnswer} onChange={(event) => setField("taughtAnswer", event.target.value)} placeholder="Escribe la enseñanza que Ganesha podrá usar luego" /></label>
        <label>Categoría<input value={draft.category} onChange={(event) => setField("category", event.target.value)} placeholder="Ej: Ayurveda" /></label>
        <label>Palabras clave / keywords<input value={draft.keywords} onChange={(event) => setField("keywords", event.target.value)} placeholder="Ej: ansiedad, vata, calma" /></label>
        <label>Frase espiritual opcional<input value={draft.phrase} onChange={(event) => setField("phrase", event.target.value)} /></label>
        <label>Prioridad<input type="number" value={draft.priority} onChange={(event) => setField("priority", event.target.value)} /></label>
        <label className="check-row">
          <input type="checkbox" checked={draft.active} onChange={(event) => setField("active", event.target.checked)} />
          Activo
        </label>
        <button className="primary" disabled={saving || !draft.originalQuestion.trim() || !draft.taughtAnswer.trim()}>
          {saving ? "Guardando..." : "Guardar enseñanza"}
        </button>
      </form>
    </section>
  );
}

function createTeachingDraft(question) {
  return {
    originalQuestion: question,
    topic: "",
    taughtAnswer: "",
    category: "",
    keywords: "",
    phrase: "",
    active: true,
    priority: 10,
  };
}

function subscribeKnowledge(setKnowledge) {
  return onValue(ref(db, KNOWLEDGE_PATH), (snap) => {
    const value = snap.val() || {};
    setKnowledge(Object.entries(value)
      .map(([id, item]) => ({ id, ...item }))
      .sort((a, b) => Number(b.priority || 0) - Number(a.priority || 0)));
  }, () => {
    setKnowledge([]);
  });
}

async function askGaneshaChat(question, userName, isAdmin) {
  const endpoint = "/api/ganesha-chat";
  console.log("GaneshaGuia usando endpoint:", endpoint);
  console.log("Pregunta enviada:", question);
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, userName, isAdmin }),
  });
  if (!response.ok) throw new Error("Ganesha Gemini no disponible");
  const data = await response.json();
  return {
    ...data,
    answer: data.answer || data.respuesta || "",
    sources: data.sources || normalizeGeminiSources(data.fuentes, data.enlaces),
  };
}

function normalizeGeminiSources(fuentes = [], enlaces = []) {
  if (!Array.isArray(fuentes)) return [];
  return fuentes.map((title, index) => ({
    title,
    type: "Conocimiento",
    category: "Ashram",
    link: Array.isArray(enlaces) ? enlaces[index] || "" : "",
  }));
}

function navigableMessageSources(message = {}) {
  const sources = message.navigableSources?.length
    ? message.navigableSources
    : message.sources || message.results || [];
  return sources.filter((item) => item?.link && item.navigable !== false && !item.internal);
}

function internalMessageSources(message = {}) {
  const sources = message.sources || message.results || [];
  return sources.filter((item) => item?.internal);
}

function isCourseSource(item = {}) {
  const text = normalizeText([item.type, item.category, item.source].filter(Boolean).join(" "));
  return text.includes("curso") || text.includes("course") || item.source === "cursos" || item.source === "courses";
}

function relatedActionLabel(item = {}) {
  const text = normalizeText([item.type, item.category, item.source, item.mediaType].filter(Boolean).join(" "));
  if (isCourseSource(item)) return "Ver curso";
  if (text.includes("meditacion")) return "Escuchar meditacion";
  if (text.includes("libro") || text.includes("pdf") || text.includes("epub") || text.includes("biblioteca")) return "Abrir libro";
  if (text.includes("post") || text.includes("articulo") || text.includes("blog")) return "Leer articulo";
  return "Ver recurso";
}

function normalizeInternalLink(link = "") {
  return String(link)
    .trim()
    .replace(/^#/, "")
    .replace(/^\//, "");
}


function buildWelcome(name) {
  const now = Date.now();
  const firstDone = localStorage.getItem(FIRST_VISIT_KEY) === "yes";
  const lastVisit = Number(localStorage.getItem(VISIT_KEY) || 0);
  if (!firstDone) return `Namasté, ${name}. Soy Ganesha Guía. Estoy aquí para acompañarte en tu camino dentro del Ashram.`;
  if (lastVisit && now - lastVisit > SEVERAL_DAYS_MS) return `Namasté, ${name}. Me alegra verte nuevamente. ¿Cómo puedo ayudarte hoy?`;
  return `Namasté, ${name}. Me alegra encontrarte en el Ashram. ¿En qué puedo ayudarte hoy?`;
}

function greetingInfo(value) {
  const text = normalizeText(value);
  const greetings = ["hola ganesha", "buen dia", "buenas tardes", "buenas noches", "namaste", "hola"];
  const matched = greetings.find((greeting) => text === greeting || text.startsWith(`${greeting} `));
  if (!matched) return { isGreeting: false, remaining: value };
  const remaining = text === matched ? "" : stripGreetingPrefix(value, matched);
  return { isGreeting: true, remaining };
}

function stripGreetingPrefix(value, matchedGreeting) {
  const wordsToDrop = matchedGreeting.split(/\s+/).length;
  return String(value)
    .trim()
    .split(/\s+/)
    .slice(wordsToDrop)
    .join(" ")
    .replace(/^[,.!¡¿?\s-]+/, "")
    .trim();
}

function randomPhrase(knowledge = []) {
  const customPhrases = knowledge
    .filter((item) => item.active !== false)
    .map((item) => item.phrase || item.frase)
    .filter(Boolean);
  const phrases = [...customPhrases, ...INSPIRATIONAL_PHRASES];
  return phrases[Math.floor(Math.random() * phrases.length)] || "";
}

function displayName(profile) {
  const name = profile?.nombre || profile?.displayName || profile?.email?.split("@")[0] || "querido caminante";
  return String(name).trim() || "querido caminante";
}

function normalizeText(value = "") {
  return String(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
