import {
  ArrowLeft,
  BarChart3,
  Bell,
  BookOpen,
  CalendarDays,
  Eye,
  EyeOff,
  FileText,
  Lock,
  Heart,
  HeartHandshake,
  Copy,
  MessageCircle,
  Music,
  Newspaper,
  Pause,
  Play,
  Search as SearchIcon,
  Send,
  Settings,
  Share2,
  Sparkles,
  ShoppingBag,
  ShoppingCart,
  Download,
  Dumbbell,
  GraduationCap,
  Headphones,
  ImageIcon,
  Leaf,
  Library,
  LogOut,
  Minus,
  Pencil,
  Plus,
  Shield,
  SlidersHorizontal,
  Trash2,
  Upload,
  User,
  Video,
  X,
} from "lucide-react";
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  linkWithCredential,
  onAuthStateChanged,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut,
} from "firebase/auth";
import { get, onValue, push, ref, remove, set, update } from "firebase/database";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";
import { deleteObject, getBlob, ref as storageRef } from "firebase/storage";
import { auth, db, firebaseConfig, firestoreDb, storage } from "./firebase";
import BookStudio from "./BookStudio";
import CuadernoAshram from "./CuadernoAshram";
import GaneshaGuia from "./GaneshaGuia";
import { DeitiesAdmin, DeitiesPage, DeityCommentsAdmin } from "./Deities";
import ganeshaGuideImage from "./assets/avatar/ganesha_guia01.png";
import { parseEpubBuffer } from "./epubParser";
import TestDosha from "./TestDosha";
import {
  trackContentOpen,
  trackEvent,
  trackGaneshaQuestion,
  trackSearch,
  startAnalyticsSession,
} from "./analyticsService";
import {
  disableAdminNotifications,
  disableUserNotifications,
  enableAdminNotifications,
  enableUserNotifications,
  listenForegroundNotifications,
  notificationSupportState,
} from "./notificationService";
import {
  cleanText,
  downloadUrl,
  firebaseKey,
  optimizeImageToDataUrl,
  pdfViewerUrl,
  uploadAudio,
  uploadCeremonialMedia,
  uploadEpub,
  uploadOptimizedCeremonialImage,
  uploadOptimizedImage,
  uploadPdf,
  youtubeEmbedUrl,
} from "./utils";

const ADMIN_WHATSAPP = "5493562514248";
const APP_LOGO_SRC = "/LogoReal.png";
const DRIVE_ARCHIVE_FOLDER_ID = "1O081ln2XnQfDXVQUJaqlHnDOy3NMv1Cg";
const EpubReader = lazy(() => import("./EpubReader"));
const DRIVE_ARCHIVE_FOLDER_URL = `https://drive.google.com/drive/folders/${DRIVE_ARCHIVE_FOLDER_ID}`;
const GOOGLE_DRIVE_API_KEY = import.meta.env.VITE_GOOGLE_DRIVE_API_KEY || "";
const DEFAULT_LIVE_VIDEO = import.meta.env.VITE_ASHRAM_LIVE_VIDEO || "";
const MAIN_MENU_CONFIG_PATH = "config/menuPrincipal";
const APP_SETTINGS_PATH = "config/appSettings";
const DEITIES_VIEW = "deidades";
const STORE_SOCIAL_LINKS_PATH = "config/tiendaRedes";
const DEFAULT_STORE_SETTINGS = {
  instagram: "",
  youtube: "",
  facebook: "",
  whatsapp: "",
  backgroundColor: "",
  backgroundUrl: "",
  backgroundPath: "",
  backgroundFileName: "",
  backgroundOverlay: 0.44,
};
const ADMIN_EMAILS = new Set([
  "gabriel@ashramganesha.com",
  "ayurvedaunaformadevida@gmail.com",
]);
const ADMIN_ALERTS_STORAGE_KEY = "ashram-admin-alerts-v1";
const GUEST_AUTH_PROMPT_STORAGE_KEY = "ashram-guest-auth-prompt-dismissed-until";
const GUEST_AUTH_PROMPT_DISMISS_MS = 7 * 24 * 60 * 60 * 1000;
const storeCategories = ["Todas", "Figuras", "Sahumerios", "Bienestar", "Regalos"];
const APP_SETTINGS_STORAGE_KEY = "ashram-app-settings-v1";
const DEFAULT_APP_SETTINGS = {
  notificationSound: "temple",
  notificationVolume: 0.8,
  welcomeTitle: "Ashram Ganesha",
  welcomeText: "",
  welcomeTheme: "ganesha",
  welcomeImageUrl: "",
  welcomeImagePath: "",
  ceremonialEffects: [],
  ceremonialModules: {
    notifications: {},
    ambient: {},
    header: {},
    content: {},
  },
};
const DEFAULT_CEREMONIAL_MODULES = {
  notifications: {
    enabled: false,
    eventName: "",
    startDate: "",
    endDate: "",
    oncePerDay: true,
    showEveryVisit: false,
    title: "",
    message: "",
    imageUrl: "",
    imagePath: "",
  },
  ambient: {
    enabled: false,
    eventName: "",
    startDate: "",
    endDate: "",
    oncePerDay: true,
    showEveryVisit: false,
    type: "petals",
    durationSeconds: 6,
    amount: 28,
    speed: "medium",
    sizePreset: "medium",
  },
  header: {
    enabled: false,
    eventName: "",
    startDate: "",
    endDate: "",
    title: "",
    subtitle: "",
    backgroundUrl: "",
    backgroundPath: "",
    backgroundFileName: "",
    backgroundFit: "cover",
    backgroundPosition: "center",
    darken: true,
    backgroundOpacity: 0.5,
  },
  content: {
    enabled: false,
    eventName: "",
    startDate: "",
    endDate: "",
    oncePerDay: true,
    showEveryVisit: false,
    contentType: "sequence",
    animationName: "",
    sequenceImages: [],
    sequenceSpeedValue: 55,
    sequenceFrameMs: 180,
    savedAnimations: [],
    repeat: false,
    title: "",
    message: "",
    imageUrl: "",
    imagePath: "",
    imageFileName: "",
    mediaUrl: "",
    mediaPath: "",
    mediaFileName: "",
    youtubeUrl: "",
    chromaEnabled: false,
    chromaColor: "#00ff00",
    chromaSensitivity: 0.38,
    chromaSmoothing: 0.12,
    sizePreset: "medium",
    width: "",
    height: "",
    position: "center",
    margin: 18,
    durationSeconds: 5,
    autoClose: true,
    showOkButton: false,
  },
};
const CEREMONIAL_EFFECT_TYPES = [
  { id: "petals", label: "Flores / petalos cayendo" },
  { id: "gold_confetti", label: "Papelitos dorados" },
  { id: "diya", label: "Diya con flamita animada" },
  { id: "ganesha", label: "Ganesha saludando" },
  { id: "message", label: "Mensaje central informativo" },
  { id: "ganesha_petals", label: "Ganesha saludando + petalos" },
];
const DEFAULT_CEREMONIAL_EFFECT = {
  enabled: true,
  name: "",
  startDate: "",
  endDate: "",
  type: "petals",
  contentType: "message",
  oncePerDay: true,
  showEveryVisit: false,
  durationSeconds: 8,
  message: "",
  okButtonText: "OK",
  imageUrl: "",
  mediaUrl: "",
  mediaPath: "",
  mediaContentType: "",
  youtubeUrl: "",
  chromaEnabled: false,
  chromaColor: "#00ff00",
  chromaSensitivity: 0.38,
  chromaSmoothing: 0.12,
  sizePreset: "medium",
  width: "",
  height: "",
  position: "center",
  margin: 18,
};
const CEREMONIAL_CONTENT_TYPES = [
  { id: "image", label: "Imagen/GIF" },
  { id: "local_video", label: "Video local" },
  { id: "youtube", label: "YouTube" },
  { id: "message", label: "Mensaje" },
];
const CEREMONIAL_SIZE_PRESETS = [
  { id: "small", label: "Pequeño" },
  { id: "medium", label: "Mediano" },
  { id: "large", label: "Grande" },
  { id: "custom", label: "Personalizado" },
];
const CEREMONIAL_POSITIONS = [
  { id: "center", label: "Centro" },
  { id: "top", label: "Arriba" },
  { id: "bottom", label: "Abajo" },
  { id: "bottom-right", label: "Abajo derecha" },
  { id: "bottom-left", label: "Abajo izquierda" },
  { id: "top-right", label: "Arriba derecha" },
  { id: "top-left", label: "Arriba izquierda" },
  { id: "fullscreen", label: "Pantalla completa" },
];
const CEREMONIAL_LAYER_TYPES = [
  { id: "petals", label: "Petalos / flores" },
  { id: "gold_confetti", label: "Papelitos dorados" },
  { id: "leaves", label: "Hojas" },
  { id: "diya", label: "Diya animada" },
  { id: "ganesha", label: "Ganesha saludando" },
  { id: "text", label: "Texto" },
  { id: "image", label: "Imagen / GIF" },
  { id: "sequence", label: "Secuencia de imagenes" },
  { id: "local_video", label: "Video local" },
  { id: "youtube", label: "YouTube" },
];
const DEFAULT_CEREMONIAL_LAYER = {
  enabled: true,
  type: "text",
  title: "",
  message: "",
  mediaUrl: "",
  mediaPath: "",
  mediaContentType: "",
  youtubeUrl: "",
  chromaEnabled: false,
  chromaColor: "#00ff00",
  chromaSensitivity: 0.38,
  chromaSmoothing: 0.12,
  sizePreset: "medium",
  width: "",
  height: "",
  position: "center",
  margin: 18,
  durationSeconds: 8,
  repeat: true,
  showOkButton: false,
};
const NOTIFICATION_SOUND_OPTIONS = [
  { id: "temple", label: "Templo suave" },
  { id: "bell", label: "Campana clara" },
  { id: "mantra", label: "Mantra corto" },
  { id: "chime", label: "Chime luminoso" },
];
const WELCOME_THEME_OPTIONS = [
  { id: "ganesha", label: "Ganesha Chaturthi" },
  { id: "diwali", label: "Diwali" },
  { id: "navaratri", label: "Navaratri" },
  { id: "guru-purnima", label: "Guru Purnima" },
  { id: "custom", label: "Imagen propia" },
];
const googleProvider = new GoogleAuthProvider();
googleProvider.addScope("email");
googleProvider.addScope("profile");
googleProvider.setCustomParameters({ prompt: "select_account consent" });
let chatAudioContext = null;

const sections = [
  { id: "biblioteca", label: "Biblioteca", phrase: "Cada lectura abre una puerta interior.", icon: Library, iconSrc: "/icono_biblioteca.webp" },
  { id: "conocimiento", label: "Conocimiento", phrase: "La sabiduria florece en la practica.", icon: GraduationCap, iconSrc: "/icono_conocimiento.webp" },
  { id: "blog", label: "Blog", phrase: "Palabras para escuchar el alma.", icon: Newspaper, iconSrc: "/icono_blog.webp" },
  { id: "ejercicios", label: "Ejercicios", phrase: "El cuerpo tambien recuerda la luz.", icon: Dumbbell, iconSrc: "/icono_ejercicios.webp" },
  { id: "meditaciones", label: "Meditacion", phrase: "Respira. El centro siempre espera.", icon: Headphones, iconSrc: "/icono_meditacion.webp" },
  { id: "satsang", label: "Satsang", phrase: "La presencia compartida enciende el alma.", icon: Heart, iconSrc: "/satsang.webp" },
  { id: "deidades", label: "Deidades", phrase: "Historias, rituales y ofrendas para honrar lo sagrado.", icon: Sparkles },
  { id: "en-vivo", label: "En Vivo", phrase: "El instante nos reune en conciencia.", icon: Video, iconSrc: "/icono_en_vivo.svg" },
  { id: "sesiones", label: "Sesiones", phrase: "Un espacio privado para tu camino.", icon: CalendarDays },
  { id: "tienda", label: "Tienda", phrase: "Elementos para honrar tu practica.", icon: ShoppingBag, iconSrc: "/icono_tienda.svg" },
  { id: "ofrendas", label: "Ofrendas", phrase: "Una colaboracion voluntaria para sostener el Ashram.", icon: Heart },
];

const adminSections = [
  { id: "biblioteca", label: "Biblioteca", icon: Library, iconSrc: "/icono_biblioteca.webp" },
  { id: "conocimiento", label: "Conocimiento", icon: GraduationCap, iconSrc: "/icono_conocimiento.webp" },
  { id: "ejercicios", label: "Ejercicios", icon: Dumbbell, iconSrc: "/icono_ejercicios.webp" },
  { id: "meditaciones", label: "Meditacion", icon: Headphones, iconSrc: "/icono_meditacion.webp" },
  { id: "satsang", label: "Satsang", icon: Heart, iconSrc: "/satsang.webp" },
  { id: "blog", label: "Blog", icon: Newspaper, iconSrc: "/icono_blog.webp" },
  { id: "deidades", label: "Deidades", icon: Sparkles },
  { id: "deity-comments", label: "Comentarios de Deidades", icon: MessageCircle },
  { id: "banners", label: "Banners", icon: ImageIcon },
  { id: "usuarios", label: "Usuarios", icon: User },
  { id: "libros", label: "Libros", icon: BookOpen },
  { id: "cuaderno", label: "Cuaderno", icon: Library },
  { id: "analiticas", label: "Analiticas", icon: BarChart3 },
  { id: "configuracion", label: "Configuracion", icon: Settings },
];

export default function App() {
  const [authState, setAuthState] = useState({ loading: true, user: null, profile: null });
  const [view, setView] = useState(hashView());
  const [deitySlug, setDeitySlug] = useState(deitySlugFromLocation());
  const [menuConfig, setMenuConfig] = useState(defaultMainMenuConfig);
  const [appSettings, setAppSettings] = useState(() => readAppSettings());
  const [toast, setToast] = useState("");
  const [pendingSubscription, setPendingSubscription] = useState(null);
  const [authPrompt, setAuthPrompt] = useState(null);
  const [subscriptionPrompt, setSubscriptionPrompt] = useState(null);
  const [shareDraft, setShareDraft] = useState(null);
  const [adminAlerts, setAdminAlerts] = useState(() => readAdminAlerts());
  const viewTimeRef = useRef({ view: "", startedAt: Date.now() });

  useEffect(() => {
    return onAuthStateChanged(auth, async (user) => {
      authDebug("onAuthStateChanged", { uid: user?.uid || null, email: user?.email || "" });
      if (!user) {
        setAuthState({ loading: false, user: null, profile: null });
        return;
      }

      try {
        const profile = await ensureUserProfile(user);
        authDebug("profile loaded", {
          uid: user.uid,
          source: profile?._profileSource || "unknown",
          rol: profile?.rol || "usuario",
        });
        setAuthState({ loading: false, user, profile });
      } catch (error) {
        console.error("[auth-flow] profile load failed", error);
        setAuthState({
          loading: false,
          user,
          profile: defaultUserProfile(user),
        });
      }
    });
  }, []);

  useEffect(() => {
    window.addEventListener("pointerdown", unlockNotificationSound, { once: true });
    return () => window.removeEventListener("pointerdown", unlockNotificationSound);
  }, []);

  useEffect(() => {
    return onValue(ref(db, MAIN_MENU_CONFIG_PATH), (snap) => {
      setMenuConfig(normalizeMainMenuConfig(snap.val()));
    }, (error) => {
      console.warn("No pude leer la configuracion del menu principal", error);
    });
  }, []);

  useEffect(() => {
    return onValue(ref(db, APP_SETTINGS_PATH), (snap) => {
      const nextSettings = normalizeAppSettings(snap.val());
      setAppSettings(nextSettings);
      writeLocalAppSettings(nextSettings);
    }, (error) => {
      console.warn("No pude leer la configuracion general", error);
    });
  }, []);

  useEffect(() => {
    if (!authState.user) return undefined;
    return startAnalyticsSession(authState.user, authState.profile || {});
  }, [authState.user?.uid, authState.profile?.email, authState.profile?.nombre]);

  useEffect(() => {
    if (!authState.user || !view) return;
    trackEvent("open_section", {
      contentType: "section",
      contentId: view,
      contentTitle: sectionLabel(view),
    });
  }, [authState.user?.uid, view]);

  useEffect(() => {
    if (!authState.user || !view) return undefined;
    const previous = viewTimeRef.current;
    const now = Date.now();
    if (previous.view && previous.view !== view) {
      trackSectionDuration(previous.view, previous.startedAt, now);
    }
    viewTimeRef.current = { view, startedAt: now };

    const flushCurrentView = () => {
      const current = viewTimeRef.current;
      if (current.view) trackSectionDuration(current.view, current.startedAt, Date.now());
    };
    window.addEventListener("pagehide", flushCurrentView);
    return () => window.removeEventListener("pagehide", flushCurrentView);
  }, [authState.user?.uid, view]);

  useEffect(() => {
    if (!isAdminProfile(authState.profile, authState.user)) return undefined;
    let firstLoad = true;
    let previousLatest = {};

    return onValue(ref(db, "chat"), (snap) => {
      const value = snap.val() || {};
      const threads = Object.entries(value).map(([id, item]) => ({ id, ...item }));

      threads.forEach((thread) => {
        const previousDate = previousLatest[thread.id];
        const isUserMessage = thread.ultima_fecha && thread.ultimo_remitente_rol === "usuario";
        const isNewUserMessage = isUserMessage && (firstLoad || !previousDate || thread.ultima_fecha !== previousDate);
        if (isNewUserMessage) {
          addAdminAlert({
            type: "chat",
            title: thread.usuario_nombre || thread.usuario_email || "Nuevo mensaje",
            body: thread.ultimo_mensaje || "Te enviaron un mensaje por el chat.",
            targetView: "chat",
            targetId: thread.id,
            createdAt: thread.ultima_fecha || new Date().toISOString(),
            silent: firstLoad,
          });
        }
      });

      previousLatest = Object.fromEntries(threads.map((thread) => [thread.id, thread.ultima_fecha || ""]));
      firstLoad = false;
    });
  }, [authState.profile?.rol, authState.profile?.email, authState.user?.email]);

  useEffect(() => {
    if (!isAdminProfile(authState.profile, authState.user)) return undefined;
    let firstLoad = true;
    let previousRequests = new Set();

    return onValue(ref(db, "sesiones"), (snap) => {
      const value = snap.val() || {};
      const requests = Object.entries(value)
        .map(([id, item]) => ({ id, ...item }))
        .filter((item) => item.estado === "solicitado");

      requests.forEach((session) => {
        if (firstLoad || !previousRequests.has(session.id)) {
          addAdminAlert({
            type: "session",
            title: session.nombre || "Solicitud de turno",
            body: session.motivo || session.tipo || "Nueva solicitud de sesión.",
            targetView: "sesiones",
            targetId: session.id,
            createdAt: session.fecha_creacion || session.fecha || session.id,
            silent: firstLoad,
          });
        }
      });

      previousRequests = new Set(requests.map((session) => session.id));
      firstLoad = false;
    });
  }, [authState.profile?.rol, authState.profile?.email, authState.user?.email]);

  useEffect(() => {
    if (!isDeityPath()) window.history.replaceState({ view }, "", `#${view}`);
    const onPopState = () => {
      setView(hashView());
      setDeitySlug(deitySlugFromLocation());
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    if (view !== "ganesha-guia") return;
    window.history.replaceState({ view: "home" }, "", "#home");
    setView("home");
    window.setTimeout(() => window.dispatchEvent(new Event("open-ganesha-guia")), 0);
  }, [view]);

  function notify(message) {
    setToast(message);
    window.setTimeout(() => setToast(""), 3200);
  }

  function addAdminAlert(alert) {
    const nextAlert = {
      id: `${alert.type}-${alert.targetId || Date.now()}-${alert.createdAt || Date.now()}`,
      ...alert,
    };
    if (!nextAlert.silent) notifyAdminAlert(nextAlert);
    setAdminAlerts((current) => {
      if (current.some((item) => item.id === nextAlert.id)) return current;
      const next = [nextAlert, ...current].slice(0, 8);
      localStorage.setItem(ADMIN_ALERTS_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }

  function dismissAdminAlert(id) {
    setAdminAlerts((current) => {
      const next = current.filter((item) => item.id !== id);
      localStorage.setItem(ADMIN_ALERTS_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }

  function openAdminAlert(alert) {
    dismissAdminAlert(alert.id);
    navigate(alert.targetView || "home");
  }

  function navigate(nextView) {
    if (nextView === "ganesha-guia") {
      window.dispatchEvent(new Event("open-ganesha-guia"));
      return;
    }
    if (requiresAuthView(nextView) && !authState.user) {
      setAuthPrompt({
        mode: "login",
        title: "Entrar al espacio",
        message: protectedViewMessage(nextView),
        returnView: nextView,
      });
      return;
    }
    if (nextView === "admin" && !isAdminProfile(authState.profile, authState.user)) {
      notify("Este espacio es privado para administradores.");
      return;
    }
    if (nextView === view) return;
    if (isMainMenuSection(nextView) && !isMainMenuEnabled(menuConfig, nextView)) {
      notify("Esta seccion esta deshabilitada por administracion.");
      return;
    }
    window.history.pushState({ view: nextView, from: view }, "", `#${nextView}`);
    setView(nextView);
    if (nextView !== DEITIES_VIEW) setDeitySlug("");
  }

  function openDeityRoute(slug) {
    const cleanSlug = cleanText(slug);
    const path = cleanSlug ? `/deidades/${encodeURIComponent(cleanSlug)}` : "/deidades";
    window.history.pushState({ view: DEITIES_VIEW, deitySlug: cleanSlug, from: view }, "", path);
    setView(DEITIES_VIEW);
    setDeitySlug(cleanSlug);
  }

  function backToDeitiesList() {
    window.history.pushState({ view: DEITIES_VIEW, deitySlug: "", from: view }, "", "/deidades");
    setView(DEITIES_VIEW);
    setDeitySlug("");
  }

  function returnToPrevious(defaultView = "home") {
    const previousView = window.history.state?.from;
    navigate(previousView && previousView !== view ? previousView : defaultView);
  }

  function updateProfile(nextProfile) {
    setAuthState((current) => ({
      ...current,
      profile: {
        ...current.profile,
        ...nextProfile,
      },
    }));
  }

  function completeAuth(user, profile) {
    setAuthState({ loading: false, user, profile: profile || defaultUserProfile(user) });
    const returnView = authPrompt?.returnView;
    setAuthPrompt(null);
    if (returnView) {
      window.history.pushState({ view: returnView }, "", `#${returnView}`);
      setView(returnView);
    }
  }

  function openShare(section, item) {
    const draft = createShareDraft(section, item);
    if (draft) setShareDraft(draft);
  }

  function startSubscription(coleccion) {
    if (!authState.user) {
      setAuthPrompt({
        mode: "register",
        title: "Crea tu cuenta para continuar",
        message: "La primera clase queda abierta. Para acceder al resto del curso necesitas registrarte.",
      });
      return;
    }
    if (!hasActiveSubscription(authState.profile)) {
      setSubscriptionPrompt(coleccion);
      return;
    }
    const profile = effectiveProfile || {};
    const missing = missingProfileFields(profile);
    if (missing.length > 0) {
      const wantsProfile = window.confirm(
        `Para acompañar tu solicitud faltan estos datos: ${missing.join(", ")}. ¿Querés completar tu perfil ahora?`,
      );
      if (!wantsProfile) {
        notify("Completa tu perfil para enviar la solicitud.");
        return;
      }
      setPendingSubscription(coleccion);
      navigate("perfil");
      return;
    }
    openSubscriptionWhatsApp(profile, coleccion, authState.user?.email);
  }

  if (authState.loading) return <Splash />;
  const isAdmin = isAdminProfile(authState.profile, authState.user);
  const effectiveProfile = isAdmin
    ? { ...(authState.profile || {}), email: authState.profile?.email || authState.user?.email || "", rol: "admin" }
    : authState.profile;
  const effectiveView = (requiresAuthView(view) && !authState.user) || (view === "admin" && !isAdmin) ? "home" : view;

  return (
    <>
      <Shell
        user={authState.user}
        profile={effectiveProfile}
        view={effectiveView}
        menuConfig={menuConfig}
        appSettings={appSettings}
        setView={navigate}
        onToast={notify}
        onLogout={() => signOut(auth)}
        onLogin={() => setAuthPrompt({ mode: "login", title: "Entrar al espacio" })}
      >
        {effectiveView === "home" && (
          <Home
            user={authState.user}
            profile={effectiveProfile}
            menuConfig={menuConfig}
            appSettings={appSettings}
            setView={navigate}
            onAuthPrompt={(prompt) => setAuthPrompt(prompt)}
          />
        )}
        {effectiveView === "app-hub" && <AppHub profile={effectiveProfile} menuConfig={menuConfig} setView={navigate} onBack={() => navigate("home")} />}
        {effectiveView === "biblioteca-hub" && <BibliotecaHub menuConfig={menuConfig} setView={navigate} onBack={() => returnToPrevious("home")} />}
        {effectiveView === "biblioteca" && <Biblioteca profile={effectiveProfile} onBack={() => returnToPrevious("home")} onToast={notify} onShare={openShare} />}
        {effectiveView === "conocimiento" && <Contenido coleccion="conocimiento" titulo="Conocimiento" profile={effectiveProfile} onBack={() => returnToPrevious("home")} onToast={notify} onSubscribe={startSubscription} onShare={openShare} />}
        {effectiveView === "blog" && <Blog user={authState.user} profile={effectiveProfile} onBack={() => returnToPrevious("home")} onShare={openShare} />}
        {effectiveView === "ejercicios" && <Contenido coleccion="ejercicios" titulo="Ejercicios" profile={effectiveProfile} onBack={() => returnToPrevious("home")} onToast={notify} onSubscribe={startSubscription} onShare={openShare} />}
        {effectiveView === "meditaciones" && <Meditaciones user={authState.user} profile={effectiveProfile} onBack={() => returnToPrevious("home")} onToast={notify} onShare={openShare} />}
        {effectiveView === "satsang" && <Contenido coleccion="satsang" titulo="Satsang" user={authState.user} profile={effectiveProfile} onBack={() => returnToPrevious("home")} onToast={notify} onSubscribe={startSubscription} onShare={openShare} />}
        {effectiveView === "deidades" && (
          <DeitiesPage
            user={authState.user}
            profile={effectiveProfile}
            slug={deitySlug}
            onOpenDeity={openDeityRoute}
            onBackToList={backToDeitiesList}
            onBack={() => returnToPrevious("app-hub")}
            onToast={notify}
          />
        )}
        {effectiveView === "en-vivo" && <EnVivo user={authState.user} profile={effectiveProfile} onBack={() => returnToPrevious("home")} onToast={notify} />}
        {effectiveView === "sesiones" && <Sesiones user={authState.user} profile={effectiveProfile} onBack={() => returnToPrevious("home")} onToast={notify} />}
        {effectiveView === "tienda" && <Tienda user={authState.user} profile={effectiveProfile} onBack={() => returnToPrevious("home")} onToast={notify} />}
        {effectiveView === "ofrendas" && <Ofrendas onBack={() => returnToPrevious("home")} onToast={notify} />}
        {effectiveView === "test-dosha" && <TestDosha onBack={() => navigate("home")} />}
        {effectiveView === "chat" && authState.user && <Chat user={authState.user} profile={effectiveProfile} onBack={() => navigate("home")} />}
        {effectiveView === "admin" && isAdmin && (
          <Admin
            profile={effectiveProfile}
            menuConfig={menuConfig}
            appSettings={appSettings}
            onToast={notify}
            onBack={() => navigate("home")}
          />
        )}
        {effectiveView === "perfil" && authState.user && (
          <Perfil
            user={authState.user}
            profile={effectiveProfile}
            pendingSubscription={pendingSubscription}
            onBack={() => navigate("home")}
            onProfileSaved={updateProfile}
            onSubscriptionSent={() => setPendingSubscription(null)}
            onToast={notify}
          />
        )}
        {toast && <div className="toast">{toast}</div>}
        {isAdmin ? (
          <AdminNotificationBubble alerts={adminAlerts} onOpen={openAdminAlert} onDismiss={dismissAdminAlert} />
        ) : null}
        {shareDraft ? <SharePromoModal draft={shareDraft} onClose={() => setShareDraft(null)} onToast={notify} /> : null}
        {authPrompt ? (
          <AuthModal
            prompt={authPrompt}
            onClose={() => setAuthPrompt(null)}
            onToast={notify}
            onAuthSuccess={completeAuth}
          />
        ) : null}
        {subscriptionPrompt ? (
          <SubscriptionRequiredModal
            coleccion={subscriptionPrompt}
            profile={effectiveProfile}
            onClose={() => setSubscriptionPrompt(null)}
            onSubscribe={() => {
              const coleccion = subscriptionPrompt;
              setSubscriptionPrompt(null);
              const profile = effectiveProfile || {};
              const missing = missingProfileFields(profile);
              if (missing.length > 0) {
                setPendingSubscription(coleccion);
                navigate("perfil");
                return;
              }
              openSubscriptionWhatsApp(profile, coleccion, authState.user?.email);
            }}
          />
        ) : null}
      </Shell>
      <CeremonialEffectsLayer appSettings={appSettings} />
      <GaneshaGuia onNavigate={navigate} profile={effectiveProfile} />
      <InstallPrompt />
    </>
  );
}

function CeremonialEffectsLayer({ appSettings }) {
  const [activeEffect, setActiveEffect] = useState(null);
  const closeTimer = useRef(null);

  useEffect(() => {
    function preview(event) {
      showEffect(normalizeCeremonialEffect(event.detail), true);
    }

    window.addEventListener("ashram-preview-ceremonial-effect", preview);
    return () => window.removeEventListener("ashram-preview-ceremonial-effect", preview);
  }, []);

  useEffect(() => {
    const moduleEffect = ceremonialModulesToActiveEffect(appSettings?.ceremonialModules);
    if (moduleEffect) {
      showEffect(moduleEffect, false);
      return () => {
        if (closeTimer.current) window.clearTimeout(closeTimer.current);
      };
    }

    const effects = normalizeCeremonialEffects(appSettings?.ceremonialEffects);
    const effect = effects.find((item) => shouldShowCeremonialEffect(item));
    if (!effect) return undefined;

    if (!ceremonialEventNeedsOk(effect)) markCeremonialEffectSeen(effect);
    showEffect(effect, false);
    return () => {
      if (closeTimer.current) window.clearTimeout(closeTimer.current);
    };
  }, [appSettings?.ceremonialEffects, appSettings?.ceremonialModules]);

  function showEffect(effect, preview) {
    if (!effect?.type) return;
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    const nextEffect = { ...effect, id: effect.id || `preview-${Date.now()}`, preview };
    setActiveEffect(nextEffect);
    if (!ceremonialEventNeedsOk(nextEffect)) {
      nextEffect.moduleSeenKeys?.forEach((key) => {
        try {
          localStorage.setItem(key, "true");
        } catch {
          // localStorage puede no estar disponible.
        }
      });
      const seconds = ceremonialEventDuration(nextEffect);
      closeTimer.current = window.setTimeout(() => setActiveEffect(null), seconds * 1000);
    }
  }

  function closeActiveEffect() {
    if (activeEffect) markCeremonialEffectSeen(activeEffect);
    activeEffect?.moduleSeenKeys?.forEach((key) => {
      try {
        localStorage.setItem(key, "true");
      } catch {
        // localStorage puede no estar disponible.
      }
    });
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    setActiveEffect(null);
  }

  if (!activeEffect) return null;

  const layers = normalizeCeremonialLayers(activeEffect.layers);
  const okVisible = ceremonialEventNeedsOk(activeEffect);

  return (
    <>
      <div className="ceremony-layer" aria-live="polite">
        {layers.map((layer) => (
          <CeremonialLayer key={layer.id} layer={layer} eventName={activeEffect.name} />
        ))}
      </div>
      {okVisible ? (
        <div className="ceremony-ok-layer" role="dialog" aria-modal="true" aria-label={activeEffect.name || "Evento ceremonial"}>
          <button className="primary ceremony-ok-button" type="button" onClick={closeActiveEffect}>
            {activeEffect.okButtonText || "OK"}
          </button>
        </div>
      ) : null}
    </>
  );
}

function CeremonialLayer({ layer, eventName }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (layer.showOkButton) return undefined;
    const timer = window.setTimeout(() => setVisible(false), Math.max(1, Number(layer.durationSeconds || 8)) * 1000);
    return () => window.clearTimeout(timer);
  }, [layer.id, layer.durationSeconds, layer.showOkButton]);

  if (!visible) return null;
  if (!layer.enabled) return null;
  if (layer.type === "petals") return <CeremonyRain kind="petal" layer={layer} />;
  if (layer.type === "gold_confetti") return <CeremonyRain kind="gold" layer={layer} />;
  if (layer.type === "leaves") return <CeremonyRain kind="leaf" layer={layer} />;
  if (layer.type === "lanterns") return <CeremonyRain kind="lantern" layer={layer} />;
  if (layer.type === "diya") return <CeremonyDiya layer={layer} />;
  if (layer.type === "ganesha") return <CeremonyGanesha message={layer.message} layer={layer} />;
  if (layer.type === "text") return <CeremonyTextLayer layer={layer} eventName={eventName} />;
  if (["image", "sequence", "local_video", "youtube"].includes(layer.type)) return <CeremonyMediaLayer layer={layer} eventName={eventName} />;
  return null;
}

function CeremonyTextLayer({ layer, eventName }) {
  return (
    <article className={`ceremony-floating-panel ceremony-position-${layer.position}`} style={ceremonialBoxStyle(layer)}>
      {layer.mediaUrl ? <CeremonialMedia effect={{ ...layer, contentType: "image", name: layer.title || eventName }} /> : null}
      {layer.title || eventName ? <h2>{layer.title || eventName}</h2> : null}
      {layer.message ? <p>{layer.message}</p> : null}
    </article>
  );
}

function CeremonyMediaLayer({ layer, eventName }) {
  if (layer.type === "image" || layer.type === "sequence") {
    return (
      <div className={`ceremony-gif-layer ceremony-position-${layer.position}`} style={ceremonialBoxStyle(layer)}>
        <CeremonialMedia effect={{ ...layer, contentType: layer.type, name: layer.title || eventName }} />
      </div>
    );
  }

  return (
    <article className={`ceremony-floating-panel ceremony-media-panel ceremony-position-${layer.position}`} style={ceremonialBoxStyle(layer)}>
      <CeremonialMedia effect={{ ...layer, contentType: layer.type, name: layer.title || eventName }} />
      {layer.title ? <h2>{layer.title}</h2> : null}
      {layer.message ? <p>{layer.message}</p> : null}
    </article>
  );
}

function CeremonialMedia({ effect }) {
  if (effect.contentType === "sequence") {
    return <CeremonialSequencePlayer effect={effect} />;
  }

  if (effect.contentType === "youtube") {
    const embed = ceremonialYoutubeEmbedUrl(effect.youtubeUrl, true);
    if (!embed) return <Sparkles size={34} />;
    return (
      <div className="ceremony-youtube-frame">
        <iframe
          title={effect.name || "Video ceremonial"}
          src={embed}
          allow="autoplay; encrypted-media; picture-in-picture"
          allowFullScreen
        />
      </div>
    );
  }

  if (effect.contentType === "local_video" && effect.mediaUrl) {
    return effect.chromaEnabled ? (
      <CeremonialChromaVideo effect={effect} />
    ) : (
      <video className="ceremony-media" src={effect.mediaUrl} autoPlay muted playsInline loop={effect.repeat !== false} controls={false} />
    );
  }

  if (effect.contentType === "image" && (effect.mediaUrl || effect.imageUrl)) {
    const source = effect.mediaUrl || effect.imageUrl;
    return effect.chromaEnabled ? (
      <CeremonialChromaImage effect={effect} source={source} />
    ) : (
      <img className="ceremony-media" src={source} alt="" />
    );
  }

  if (effect.imageUrl) return <img className="ceremony-media" src={effect.imageUrl} alt="" />;
  return <Sparkles size={34} />;
}

function CeremonialSequencePlayer({ effect }) {
  const images = normalizeCeremonialSequenceImages(effect.sequenceImages);
  const [frame, setFrame] = useState(0);
  const [done, setDone] = useState(false);
  const frameMs = ceremonialSequenceFrameMs(effect);
  const sequenceKey = images.map((image) => image.url).join("|");

  useEffect(() => {
    setFrame(0);
    setDone(false);
  }, [effect.id, sequenceKey, frameMs, effect.repeat]);

  useEffect(() => {
    if (!images.length || done) return undefined;
    const timer = window.setInterval(() => {
      setFrame((current) => {
        const next = current + 1;
        if (next >= images.length) {
          if (effect.repeat) return 0;
          window.clearInterval(timer);
          setDone(true);
          return current;
        }
        return next;
      });
    }, frameMs);
    return () => window.clearInterval(timer);
  }, [images.length, frameMs, effect.repeat, done]);

  if (!images.length || done) return null;
  const current = images[Math.min(frame, images.length - 1)];
  const mediaEffect = {
    ...effect,
    contentType: "image",
    mediaUrl: current.url,
    imageUrl: current.url,
    mediaFileName: current.fileName,
  };

  return <CeremonialMedia effect={mediaEffect} />;
}

function CeremonialChromaVideo({ effect }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    let frameId = 0;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d", { willReadFrequently: true });
    if (!video || !canvas || !ctx) return undefined;

    function draw() {
      if (video.videoWidth && video.videoHeight) {
        if (canvas.width !== video.videoWidth) canvas.width = video.videoWidth;
        if (canvas.height !== video.videoHeight) canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        applyChromaToCanvas(ctx, canvas.width, canvas.height, effect);
      }
      frameId = window.requestAnimationFrame(draw);
    }

    frameId = window.requestAnimationFrame(draw);
    return () => window.cancelAnimationFrame(frameId);
  }, [effect.mediaUrl, effect.chromaColor, effect.chromaSensitivity, effect.chromaSmoothing]);

  return (
    <div className="ceremony-chroma-wrap">
      <video ref={videoRef} src={effect.mediaUrl} autoPlay muted playsInline loop={effect.repeat !== false} crossOrigin="anonymous" />
      <canvas ref={canvasRef} className="ceremony-media" />
    </div>
  );
}

function CeremonialChromaImage({ effect, source }) {
  const canvasRef = useRef(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let frameId = 0;
    let cancelled = false;
    setError("");
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => {
      function drawFrame() {
        if (cancelled) return;
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext("2d", { willReadFrequently: true });
        if (!canvas || !ctx) return;

        const width = image.naturalWidth || image.width;
        const height = image.naturalHeight || image.height;
        if (width && height) {
          if (canvas.width !== width) canvas.width = width;
          if (canvas.height !== height) canvas.height = height;
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
          try {
            applyChromaToCanvas(ctx, canvas.width, canvas.height, effect);
          } catch {
            setError("No se pudo previsualizar este GIF. Podes usar Secuencia de imagenes como alternativa.");
            return;
          }
        }

        frameId = window.requestAnimationFrame(drawFrame);
      }

      drawFrame();
    };
    image.onerror = () => setError("No se pudo previsualizar este GIF. Podes usar Secuencia de imagenes como alternativa.");
    image.src = source;
    return () => {
      cancelled = true;
      if (frameId) window.cancelAnimationFrame(frameId);
    };
  }, [source, effect.chromaColor, effect.chromaSensitivity, effect.chromaSmoothing]);

  if (error) return <p className="ceremony-media-error">{error}</p>;
  return <canvas ref={canvasRef} className="ceremony-media" />;
}

function CeremonyRain({ kind, layer }) {
  const amount = Math.max(6, Math.min(90, Number(layer?.amount || 28)));
  const speedFactor = layer?.speed === "slow" ? 1.35 : layer?.speed === "fast" ? 0.68 : 1;
  const sizeBoost = layer?.sizePreset === "small" ? -3 : layer?.sizePreset === "large" ? 5 : 0;
  return (
    <div className={`ceremony-rain ${kind}`}>
      {Array.from({ length: amount }).map((_, index) => (
        <span key={index} style={{
          "--x": `${(index * 37) % 100}%`,
          "--delay": `${(index % 9) * 0.35}s`,
          "--duration": `${(5 + (index % 6) * 0.45) * speedFactor}s`,
          "--size": `${Math.max(6, 9 + (index % 5) * 3 + sizeBoost)}px`,
          "--spin": `${index % 2 === 0 ? 1 : -1}`,
        }} />
      ))}
    </div>
  );
}

function CeremonyDiya({ layer }) {
  return (
    <div className={`ceremony-diya ceremony-position-${layer?.position || "bottom-right"}`} style={ceremonialBoxStyle(layer || DEFAULT_CEREMONIAL_LAYER)} aria-label="Diya ceremonial">
      <span className="diya-flame" />
      <span className="diya-bowl" />
    </div>
  );
}

function CeremonyGanesha({ message, layer }) {
  return (
    <div className={`ceremony-ganesha ceremony-position-${layer?.position || "bottom-right"}`} style={ceremonialBoxStyle(layer || DEFAULT_CEREMONIAL_LAYER)}>
      {message ? <p>{message}</p> : null}
      <img src={ganeshaGuideImage} alt="Ganesha saludando" />
    </div>
  );
}

function InstallPrompt() {
  const [promptEvent, setPromptEvent] = useState(null);
  const [visible, setVisible] = useState(false);
  const [isIos, setIsIos] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      window.navigator.standalone === true ||
      sessionStorage.getItem("ashram-install-closed") === "yes";

    if (standalone) return;

    const iosDevice = /iphone|ipad|ipod/i.test(window.navigator.userAgent);
    setIsIos(iosDevice);
    if (iosDevice) setVisible(true);

    function onBeforeInstallPrompt(event) {
      event.preventDefault();
      setPromptEvent(event);
      setVisible(true);
    }

    function onInstalled() {
      setVisible(false);
      sessionStorage.setItem("ashram-install-closed", "yes");
    }

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  async function install() {
    if (!promptEvent) return;
    promptEvent.prompt();
    await promptEvent.userChoice;
    setPromptEvent(null);
    setVisible(false);
    sessionStorage.setItem("ashram-install-closed", "yes");
  }

  function close() {
    setVisible(false);
    sessionStorage.setItem("ashram-install-closed", "yes");
  }

  if (!visible) return null;

  return (
    <aside className="install-prompt" role="dialog" aria-label="Instalar Ashram Ganesha">
      <img src={APP_LOGO_SRC} alt="" />
      <div>
        <strong>Instalar Ashram Ganesha</strong>
        <p>{isIos ? "En iPhone: toca Compartir y despues Agregar a inicio." : "Usala como una app normal desde tu celular."}</p>
      </div>
      {promptEvent && (
        <button className="primary" type="button" onClick={install}>
          <Download size={18} />
          Instalar
        </button>
      )}
      <button className="ghost compact" type="button" onClick={close}>
        Ahora no
      </button>
    </aside>
  );
}

function AdminNotificationBubble({ alerts, onOpen, onDismiss }) {
  if (!alerts.length) return null;
  const latest = alerts[0];
  const Icon = latest.type === "session" ? CalendarDays : MessageCircle;

  return (
    <aside className="admin-notification-bubble" aria-live="polite">
      <button className="admin-notification-main" type="button" onClick={() => onOpen(latest)}>
        <span className="admin-notification-icon">
          <Icon size={18} />
          <b>{alerts.length}</b>
        </span>
        <span>
          <strong>{latest.type === "session" ? "Nueva solicitud de turno" : "Nuevo mensaje de chat"}</strong>
          <em>{latest.title}</em>
          <small>{summary(latest.body, 80)}</small>
        </span>
      </button>
      <button className="admin-notification-close" type="button" onClick={() => onDismiss(latest.id)} aria-label="Cerrar notificacion">
        <X size={16} />
      </button>
      {alerts.length > 1 ? (
        <div className="admin-notification-list">
          {alerts.slice(1, 4).map((alert) => (
            <button key={alert.id} type="button" onClick={() => onOpen(alert)}>
              <span>{alert.type === "session" ? "Turno" : "Chat"}</span>
              <strong>{alert.title}</strong>
            </button>
          ))}
        </div>
      ) : null}
    </aside>
  );
}

function Splash() {
  return (
    <main className="login-screen">
      <img className="login-bg" src="/fondo_app.webp" alt="" />
      <div className="login-panel splash-panel">
        <img className="logo-xl" src={APP_LOGO_SRC} alt="Ashram Ganesha" />
        <p>Respira. Estas llegando.</p>
      </div>
    </main>
  );
}

function AuthModal({ prompt, onClose, onToast, onAuthSuccess }) {
  return (
    <div className="modal-backdrop auth-modal-backdrop" role="dialog" aria-modal="true" aria-label={prompt.title || "Acceso"}>
      <Login
        initialMode={prompt.mode || "login"}
        title={prompt.title}
        message={prompt.message}
        onClose={onClose}
        onToast={onToast}
        onAuthSuccess={onAuthSuccess}
      />
    </div>
  );
}

function Login({ initialMode = "login", title = "", message = "", onClose, onToast, onAuthSuccess }) {
  const [mode, setMode] = useState(initialMode);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const displayTitle = title && mode === initialMode ? title : mode === "register" ? "Crear cuenta" : "Entrar al espacio";

  async function submit(event) {
    event.preventDefault();
    if (!email || !password) return onToast("Completa email y contrasena.");
    if (mode === "register" && !name.trim()) return onToast("Escribi tu nombre.");
    if (mode === "register" && password.length < 6) return onToast("La contrasena debe tener minimo 6 caracteres.");

    setBusy(true);
    try {
      await setPersistence(auth, browserLocalPersistence);
      if (mode === "register") {
        const credential = await createUserWithEmailAndPassword(auth, email, password);
        const profile = await ensureUserProfile(credential.user, email, name);
        void trackEvent("signup_success", { method: "email" });
        onAuthSuccess?.(credential.user, profile);
      } else {
        const credential = await signInWithEmailAndPassword(auth, email, password);
        const profile = await ensureUserProfile(credential.user, email);
        void trackEvent("login_success", { method: "email" });
        onAuthSuccess?.(credential.user, profile);
      }
    } catch (error) {
      console.error("Auth error", error);
      onToast(authErrorMessage(error, mode));
    } finally {
      setBusy(false);
    }
  }

  async function resetPassword() {
    if (!email) return onToast("Escribi tu email primero.");
    try {
      await sendPasswordResetEmail(auth, email, {
        url: "https://ashramganesha.web.app",
        handleCodeInApp: false,
      });
      onToast("Te enviamos un email para recuperar la contrasena.");
    } catch (error) {
      console.error("Password reset error", error);
      onToast(authErrorMessage(error, "reset"));
    }
  }

  async function signInWithGoogle() {
    setBusy(true);
    try {
      await setPersistence(auth, browserLocalPersistence);
      const credential = await signInWithPopup(auth, googleProvider);
      const profile = await ensureUserProfile(credential.user);
      void trackEvent("login_success", { method: "google" });
      onAuthSuccess?.(credential.user, profile);
    } catch (error) {
      console.error("Google auth error", error);
      if (["auth/popup-blocked", "auth/cancelled-popup-request"].includes(error.code)) {
        await signInWithRedirect(auth, googleProvider);
        return;
      }
      if (error.code === "auth/account-exists-with-different-credential") {
        const pendingCredential = GoogleAuthProvider.credentialFromError(error);
        const existingEmail = error.customData?.email || email;
        if (pendingCredential && existingEmail && password) {
          const credential = await signInWithEmailAndPassword(auth, existingEmail, password);
          await linkWithCredential(credential.user, pendingCredential);
          const profile = await ensureUserProfile(credential.user, existingEmail);
          onAuthSuccess?.(credential.user, profile);
          onToast("Cuenta Google vinculada. Ya podes entrar con Google.");
          return;
        }
        onToast("Ese email ya existe con contrasena. Escribi email y contrasena, y volve a tocar Entrar con Google para vincularlo.");
        return;
      }
      if (error.code !== "auth/popup-closed-by-user") onToast(authErrorMessage(error, "google"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className={onClose ? "login-screen modal-login-screen" : "login-screen"}>
      {!onClose ? <img className="login-bg" src="/fondo_app.webp" alt="" /> : null}
      <form className="login-panel" onSubmit={submit}>
        {onClose ? (
          <button className="modal-close" type="button" onClick={onClose} aria-label="Cerrar">
            <X size={18} />
          </button>
        ) : null}
        <img className="logo-xl" src={APP_LOGO_SRC} alt="Ashram Ganesha" />
        <h1>{displayTitle}</h1>
        {message ? <p className="login-message">{message}</p> : null}
        {mode === "register" ? (
          <label>
            Nombre
            <input value={name} onChange={(e) => setName(e.target.value)} type="text" autoComplete="name" />
          </label>
        ) : null}
        <label>
          Email
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoComplete="email" />
        </label>
        <label>
          Contrasena
          <span className="password-field">
            <input value={password} onChange={(e) => setPassword(e.target.value)} type={showPassword ? "text" : "password"} />
            <button
              aria-label={showPassword ? "Ocultar contrasena" : "Ver contrasena"}
              className="password-toggle"
              type="button"
              onClick={() => setShowPassword((current) => !current)}
            >
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </span>
        </label>
        <button className="primary" disabled={busy}>
          {busy ? "Procesando..." : mode === "register" ? "Registrarme" : "Entrar"}
        </button>
        <div className="login-separator"><span>o</span></div>
        <button className="google-login" type="button" onClick={signInWithGoogle} disabled={busy}>
          <GoogleIcon />
          Entrar con Google
        </button>
        {mode === "login" && (
          <button className="ghost" type="button" onClick={resetPassword}>
            Olvide mi contrasena
          </button>
        )}
        <button className="ghost" type="button" onClick={() => setMode(mode === "login" ? "register" : "login")}>
          {mode === "login" ? "Crear cuenta nueva" : "Ya tengo cuenta"}
        </button>
      </form>
    </main>
  );
}

function GoogleIcon() {
  return (
    <svg className="google-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06L5.84 9.9C6.71 7.31 9.14 5.38 12 5.38z" />
    </svg>
  );
}

function SubscriptionRequiredModal({ coleccion, profile, onClose, onSubscribe }) {
  const label = subscriptionLabel(coleccion);
  return (
    <div className="modal-backdrop auth-modal-backdrop" role="dialog" aria-modal="true" aria-label="Suscripcion requerida">
      <section className="login-panel subscription-required-panel">
        <button className="modal-close" type="button" onClick={onClose} aria-label="Cerrar">
          <X size={18} />
        </button>
        <img className="logo-xl" src={APP_LOGO_SRC} alt="Ashram Ganesha" />
        <h1>Suscripcion requerida</h1>
        <p className="login-message">
          Tu cuenta esta registrada, pero todavia no tiene una suscripcion activa para acceder a este contenido.
        </p>
        <button className="primary" type="button" onClick={onSubscribe}>
          <MessageCircle size={18} /> Solicitar suscripcion
        </button>
        <button className="ghost" type="button" onClick={onClose}>
          Seguir explorando
        </button>
        <small>Seccion: {label}. Estado actual: {hasActiveSubscription(profile) ? "activa" : "inactiva"}.</small>
      </section>
    </div>
  );
}

function Shell({ children, user, profile, view, menuConfig, appSettings, setView, onLogout, onLogin }) {
  const isAdmin = isAdminProfile(profile, user);
  const profileName = profileDisplayName(profile);
  const navItems = [
    { id: "home", label: "Inicio", icon: BookOpen, iconSrc: APP_LOGO_SRC, activeViews: ["home"] },
    { id: "blog", label: "Blog", icon: Newspaper, activeViews: ["blog"] },
    { id: "sesiones", label: "Agenda", icon: CalendarDays, activeViews: ["sesiones", "en-vivo"] },
    { id: "chat", label: "Chat", icon: MessageCircle, activeViews: ["chat"] },
    { id: "perfil", label: "Mi espacio", icon: User, activeViews: ["perfil", "ofrendas"] },
  ].filter((item) => item && (!isMainMenuSection(item.id) || isMainMenuEnabled(menuConfig, item.id)));

  return (
    <main className={`app-shell ${view === "tienda" ? "store-shell" : ""}`} style={appShellStyle(appSettings)}>
      <header className="topbar">
        <button className="brand" onClick={() => setView("home")}>
          <img src={APP_LOGO_SRC} alt="" />
          <span>Ashram Ganesha</span>
        </button>
        <nav>
          <button className={view === "home" ? "active" : ""} onClick={() => setView("home")}>Inicio</button>
          {isAdmin && (
            <button className={view === "admin" ? "active" : ""} onClick={() => setView("admin")}>
              <Shield size={17} /> Admin
            </button>
          )}
          {user ? (
            <>
              <button className={view === "perfil" ? "active" : ""} onClick={() => setView("perfil")}>
                <Avatar src={profile?.foto_url} name={profileName} size="tiny" />
                <span>Mi perfil</span>
              </button>
              <button onClick={onLogout} title="Salir">
                <LogOut size={18} />
              </button>
            </>
          ) : (
            <button onClick={onLogin}>
              <User size={18} />
              <span>Entrar</span>
            </button>
          )}
        </nav>
      </header>
      {children}
      <nav className={`bottom-nav ${isAdmin ? "admin-bottom-nav" : ""}`}>
        {navItems.map(({ id, label, icon: Icon, iconSrc, action, activeViews = [id] }) => {
          return (
          <button key={id} className={activeViews.includes(view) ? "active" : ""} onClick={() => action ? action() : setView(id)}>
            {iconSrc ? <img className="nav-icon" src={iconSrc} alt="" /> : <Icon size={19} />}
            <span>{label}</span>
          </button>
          );
        })}
      </nav>
    </main>
  );
}

function Home({ user, profile, menuConfig, appSettings, setView, onAuthPrompt }) {
  const [banners, setBanners] = useState([]);
  const [bannerIndex, setBannerIndex] = useState(0);
  const [showGuestPrompt, setShowGuestPrompt] = useState(false);

  useEffect(() => {
    loadList("banners").then((items) => {
      setBanners(items.sort((a, b) => (a.orden || 0) - (b.orden || 0)));
    });
  }, []);

  useEffect(() => {
    void trackEvent("landing_view", { screenName: "home" });
  }, []);

  useEffect(() => {
    if (banners.length < 2) return undefined;
    const timer = window.setInterval(() => {
      setBannerIndex((old) => (old + 1) % banners.length);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [banners.length]);

  const currentBanner = banners[bannerIndex];
  const bannerBlogId = currentBanner?.blog_id || currentBanner?.blogId || currentBanner?.post_id || currentBanner?.postId || "";
  const specialHeader = activeCeremonialHeader(appSettings?.ceremonialModules?.header);
  const displayName = profileDisplayName(profile);
  const primaryGroups = [
    {
      id: "aprender",
      label: "Aprender",
      text: "Cursos y prácticas",
      icon: GraduationCap,
      emoji: "\uD83C\uDF3F",
      views: ["conocimiento", "ejercicios", "meditaciones"],
    },
    {
      id: "biblioteca",
      label: "Biblioteca",
      text: "Libros y Satsang",
      icon: Library,
      emoji: "\uD83D\uDCD6",
      view: "biblioteca-hub",
      views: ["biblioteca", "satsang"],
    },
    {
      id: "participar",
      label: "Participar",
      text: "Encuentros y vivo",
      icon: Video,
      views: ["en-vivo"],
    },
    {
      id: "tienda",
      label: "Tienda",
      text: "Productos del Ashram",
      icon: ShoppingBag,
      views: ["tienda"],
    },
    {
      id: "donar",
      label: "Donar",
      text: "Sostener el Ashram",
      icon: HeartHandshake,
      views: ["ofrendas"],
    },
  ];
  const visiblePrimaryGroups = primaryGroups
    .map((group) => {
      const activeView = group.views.find((sectionId) => !isMainMenuSection(sectionId) || isMainMenuEnabled(menuConfig, sectionId));
      return {
        ...group,
        view: group.view && activeView ? group.view : activeView,
      };
    })
    .filter((group) => group.view);
  const showStoreAccess = !isMainMenuSection("tienda") || isMainMenuEnabled(menuConfig, "tienda");

  function openBannerBlog() {
    if (bannerBlogId) {
      window.history.pushState({ view: "blog", detail: bannerBlogId }, "", `#blog/${bannerBlogId}`);
    }
    setView("blog");
  }

  function openStore() {
    void trackEvent("tienda_open", { source: "landing" });
    setView("tienda");
  }

  function openApp() {
    void trackEvent("app_open", { source: "landing" });
    if (user) {
      setView("app-hub");
      return;
    }
    if (shouldShowGuestAuthPrompt()) {
      void trackEvent("auth_modal_view", { source: "landing_app" });
      setShowGuestPrompt(true);
      return;
    }
    setView("app-hub");
  }

  function continueAsGuest(eventName) {
    rememberGuestAuthPromptDismissal();
    if (eventName) void trackEvent(eventName, { source: "landing_app" });
    setShowGuestPrompt(false);
    setView("app-hub");
  }

  function openAuth(mode) {
    setShowGuestPrompt(false);
    onAuthPrompt?.({
      mode,
      title: mode === "register" ? "Crear cuenta" : "Entrar al espacio",
      returnView: "app-hub",
    });
  }

  return (
    <section className="home">
      <div className={`home-card home-hero welcome-theme-${appSettings.welcomeTheme || "ganesha"}`} style={welcomeCardStyle(appSettings)}>
        <img className="home-logo" src={APP_LOGO_SRC} alt="" />
        <span>
          <small>Hola, {displayName}</small>
          <strong>{specialHeader?.title || appSettings.welcomeTitle || "Ashram Ganesha"}</strong>
          <small>{specialHeader?.subtitle || appSettings.welcomeText || "Un espacio simple para volver al centro."}</small>
        </span>
      </div>

      <button className="banner home-news home-main-banner" type="button" onClick={openBannerBlog}>
        {currentBanner?.imagen ? <img src={currentBanner.imagen} alt="" /> : null}
        <div className="banner-caption">
          {currentBanner?.titulo || "Que la luz guie tu practica de hoy."}
        </div>
      </button>

      <div className="landing-choice-grid" aria-label="Accesos principales">
        {showStoreAccess ? (
          <button className="landing-choice-card landing-choice-store" type="button" onClick={openStore}>
            <b aria-hidden="true">&#128717;&#65039;</b>
            <span>Tienda</span>
            <small>Objetos con alma para tu práctica y tu hogar.</small>
            <em>Entrar</em>
          </button>
        ) : null}
        <button className="landing-choice-card landing-choice-app" type="button" onClick={openApp}>
          <b aria-hidden="true">&#129719;</b>
          <span>App del Ashram</span>
          <small>Cursos, biblioteca, meditaciones y comunidad.</small>
          <em>Explorar</em>
        </button>
      </div>
      <p className="landing-trust-note">Podés recorrer el contenido público y la tienda sin crear cuenta. Iniciá sesión sólo cuando quieras guardar tu progreso.</p>
      {showGuestPrompt ? (
        <GuestAuthChoiceModal
          onClose={() => continueAsGuest("auth_modal_closed")}
          onContinue={() => continueAsGuest("continue_as_guest")}
          onLogin={() => openAuth("login")}
          onSignup={() => openAuth("register")}
        />
      ) : null}
    </section>
  );
}

function AppHub({ profile, menuConfig, setView, onBack }) {
  const sections = [
    {
      id: "aprender",
      label: "Aprender",
      text: "Cursos y prácticas",
      icon: GraduationCap,
      emoji: "\uD83D\uDC9B",
      views: ["conocimiento", "ejercicios"],
    },
    {
      id: "biblioteca",
      label: "Biblioteca",
      text: "Libros y Satsang",
      icon: Library,
      emoji: "\uD83D\uDCD6",
      view: "biblioteca-hub",
      views: ["biblioteca", "satsang", "meditaciones"],
    },
    {
      id: "meditaciones",
      label: "Meditación",
      text: "Zona de meditación",
      icon: Headphones,
      emoji: "\uD83E\uDDD8",
      views: ["meditaciones"],
    },
    {
      id: "blog",
      label: "Blog",
      text: "Reflexiones del Ashram",
      icon: Newspaper,
      emoji: "\uD83D\uDCDD",
      views: ["blog"],
    },
    {
      id: "deidades",
      label: "Deidades",
      text: "Rituales y ofrendas",
      icon: Sparkles,
      emoji: "\uD83E\uDEB7",
      views: ["deidades"],
    },
    {
      id: "participar",
      label: "Participar",
      text: "Transmisiones en vivo",
      icon: Video,
      emoji: "\uD83D\uDD34",
      views: ["en-vivo"],
    },
    {
      id: "mi-espacio",
      label: "Mi espacio",
      text: "Perfil y comunidad",
      icon: User,
      emoji: "\uD83C\uDF3F",
      views: ["perfil", "chat"],
    },
    {
      id: "donar",
      label: "Donar",
      text: "Sostener el Ashram",
      icon: HeartHandshake,
      emoji: "\uD83D\uDC9B",
      views: ["ofrendas"],
    },
    isAdminProfile(profile) ? {
      id: "admin",
      label: "Administración",
      text: "Panel del Ashram",
      icon: Shield,
      emoji: "\uD83D\uDEE0\uFE0F",
      views: ["admin"],
    } : null,
  ].filter(Boolean);
  const visibleSections = sections
    .map((section) => {
      const activeView = section.views.find((sectionId) => !isMainMenuSection(sectionId) || isMainMenuEnabled(menuConfig, sectionId));
      return {
        ...section,
        view: section.view && activeView ? section.view : activeView,
      };
    })
    .filter((section) => section.view);

  return (
    <section className="content-page app-hub-page">
      <PageTitle icon={Sparkles} title="App del Ashram" subtitle="Cursos, biblioteca, meditaciones y comunidad." onBack={onBack} />
      <div className="home-primary-grid app-hub-grid" aria-label="Secciones de la aplicación">
        {visibleSections.map(({ id, label, text, emoji, view }) => (
          <button key={id} className="home-primary-tile" type="button" onClick={() => setView(view)}>
            <b className="home-tile-emoji" aria-hidden="true">{emoji}</b>
            <span>{label}</span>
            <small>{text}</small>
          </button>
        ))}
      </div>
    </section>
  );
}

function GuestAuthChoiceModal({ onClose, onContinue, onLogin, onSignup }) {
  return (
    <div className="modal-backdrop auth-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="guest-auth-title">
      <section className="login-panel guest-auth-panel">
        <button className="modal-close" type="button" onClick={onClose} aria-label="Cerrar">
          <X size={18} />
        </button>
        <img className="logo-xl" src={APP_LOGO_SRC} alt="Ashram Ganesha" />
        <h1 id="guest-auth-title">Bienvenido al Ashram Ganesha</h1>
        <p className="login-message">
          Podés crear una cuenta para guardar tu progreso y acceder a contenido personalizado, o continuar navegando libremente.
        </p>
        <div className="guest-auth-actions">
          <button className="primary" type="button" onClick={onLogin}>Iniciar sesión</button>
          <button className="ghost" type="button" onClick={onSignup}>Crear cuenta</button>
          <button className="ghost guest-continue" type="button" onClick={onContinue}>Continuar sin cuenta</button>
        </div>
      </section>
    </div>
  );
}

function BibliotecaHub({ menuConfig, setView, onBack }) {
  const cards = [
    {
      id: "biblioteca",
      label: "Biblioteca",
      text: "Acceso a los libros",
      icon: Library,
      view: "biblioteca",
    },
    {
      id: "satsang",
      label: "Satsang",
      text: "Contenidos de Satsang",
      icon: Heart,
      view: "satsang",
    },
    {
      id: "meditaciones",
      label: "Meditación",
      text: "Zona de meditación",
      icon: Headphones,
      view: "meditaciones",
    },
  ].filter((card) => !isMainMenuSection(card.view) || isMainMenuEnabled(menuConfig, card.view));

  return (
    <section className="content-page library-hub-page">
      <PageTitle icon={Library} title="Biblioteca" subtitle="Libros, Satsang y meditación del Ashram." onBack={onBack} />
      <div className="home-primary-grid library-hub-grid" aria-label="Biblioteca, Satsang y Meditación">
        {cards.map(({ id, label, text, icon: Icon, view }) => (
          <button key={id} className="home-primary-tile" type="button" onClick={() => setView(view)}>
            <Icon size={24} />
            <span>{label}</span>
            <small>{text}</small>
          </button>
        ))}
      </div>
      {!cards.length ? <p className="empty-state">No hay contenidos activos en este momento.</p> : null}
    </section>
  );
}

function Sesiones({ user, profile, onBack, onToast }) {
  const isAdmin = isAdminProfile(profile, user);
  const [sessions, setSessions] = useState([]);
  const [selected, setSelected] = useState(null);
  const [selectedDay, setSelectedDay] = useState("");
  const [showDayForm, setShowDayForm] = useState(false);
  const [form, setForm] = useState({
    id: "",
    nombre: profileDisplayName(profile),
    telefono: profile?.telefono || "",
    tipo: "Coaching espiritual",
    fecha: "",
    motivo: "",
  });
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [saveStatus, setSaveStatus] = useState("");
  const optimisticSessionsRef = useRef(new Map());

  function mergeOptimisticSessions(nextSessions) {
    let merged = nextSessions;
    optimisticSessionsRef.current.forEach((session) => {
      merged = upsertById(merged, session);
    });
    return sortSessionsByDate(merged);
  }

  useEffect(() => {
    if (isAdmin) {
      let cancelled = false;
      async function loadAdminSessions() {
        try {
          const nextSessions = await fetchSessionsByRest();
          if (cancelled) return;
          setSessions(mergeOptimisticSessions(nextSessions));
          setSelected((current) => current ? nextSessions.find((item) => item.id === current.id) || current : null);
        } catch (error) {
          if (!cancelled) onToast?.(`No pude leer la agenda: ${error.message}`);
        }
      }
      loadAdminSessions();
      const interval = window.setInterval(loadAdminSessions, 8000);
      return () => {
        cancelled = true;
        window.clearInterval(interval);
      };
    }

    return onValue(ref(db, "sesiones"), (snap) => {
      const value = snap.val() || {};
      const nextSessions = Object.entries(value)
        .map(([id, item]) => ({ id, ...item }))
        .filter((item) => isAdmin || item.uid === user.uid)
        .sort((a, b) => (a.fecha || "").localeCompare(b.fecha || ""));
      setSessions(nextSessions);
      setSelected((current) => current ? nextSessions.find((item) => item.id === current.id) || current : null);
    }, (error) => {
      onToast?.(`No pude leer la agenda: ${error.message}`);
    });
  }, [isAdmin, onToast, user.uid]);

  useEffect(() => {
    setNotes(selected?.notas || "");
  }, [selected?.id]);

  async function refreshAdminSessions() {
    if (!isAdmin) return;
    const nextSessions = await fetchSessionsByRest();
    setSessions(mergeOptimisticSessions(nextSessions));
    setSelected((current) => current ? nextSessions.find((item) => item.id === current.id) || current : null);
  }

  async function bookSession(event) {
    event?.preventDefault?.();
    if (!isAdmin && !cleanText(form.nombre)) return onToast?.("Completa tu nombre.");
    if (isAdmin && !cleanText(form.fecha)) return onToast?.("Elegí día y horario.");
    setBusy(true);
    setSaveStatus("Guardando turno...");
    try {
      const isEditing = Boolean(form.id);
      const createdAt = new Date().toISOString();
      const room = sessionRoomName(user.uid, form.fecha || createdAt);
      const sessionData = {
        uid: user.uid,
        usuario_email: user.email || "",
        nombre: cleanText(form.nombre) || "Turno reservado",
        telefono: cleanText(form.telefono),
        tipo: cleanText(form.tipo) || "Coaching espiritual",
        fecha: isAdmin ? form.fecha : "",
        motivo: cleanText(form.motivo),
        sala: room,
        estado: isAdmin ? "reservado" : "solicitado",
        notas: "",
        fecha_creacion: createdAt,
      };
      const savedSession = isEditing
        ? await updateExistingSessionWithFallback(form.id, {
          ...sessionData,
          sala: form.sala || room,
          notas: form.notas || "",
          fecha_creacion: form.fecha_creacion || createdAt,
          fecha_actualizacion: createdAt,
        })
        : await saveSessionWithFallback(sessionData);
      optimisticSessionsRef.current.set(savedSession.id, savedSession);
      const savedDay = sessionDayKey(savedSession.fecha);
      if (isAdmin && savedDay && savedDay !== "sin-fecha") setSelectedDay(savedDay);
      setSessions((current) => sortSessionsByDate(upsertById(current, savedSession)));
      setShowDayForm(false);
      setForm({
        id: "",
        nombre: isAdmin ? "" : profileDisplayName(profile),
        telefono: isAdmin ? "" : profile?.telefono || "",
        tipo: "Coaching espiritual",
        fecha: isAdmin && savedDay && savedDay !== "sin-fecha" ? dateTimeForDay(savedDay) : "",
        motivo: "",
      });
      setSaveStatus(`Turno guardado: ${formatSessionTime(savedSession.fecha)} ${savedSession.nombre}.`);
      onToast?.(isAdmin ? `Turno ${isEditing ? "actualizado" : "creado"}: ${formatSessionTime(savedSession.fecha)} ${savedSession.nombre}.` : "Solicitud enviada. Te confirmaremos día y horario.");
      window.setTimeout(() => {
        optimisticSessionsRef.current.delete(savedSession.id);
        refreshAdminSessions().catch(() => {});
      }, 12000);
    } catch (error) {
      setSaveStatus(`No se pudo guardar: ${error.message || "error desconocido"}`);
      onToast?.(`No se pudo guardar turno: ${error.message || "error desconocido"}`);
    } finally {
      setBusy(false);
    }
  }

  async function updateSessionStatus(session, estado) {
    const changes = { estado };
    await updateSessionWithFallback(session.id, changes);
    setSessions((current) => sortSessionsByDate(upsertById(current, { ...session, ...changes })));
    setSelected((current) => current?.id === session.id ? { ...current, ...changes } : current);
    onToast?.(estado === "finalizada" ? "Sesión finalizada." : "Sesión actualizada.");
  }

  async function scheduleSession(session, fecha) {
    if (!cleanText(fecha)) return onToast?.("Elegí día y horario.");
    const changes = {
      fecha,
      estado: "reservado",
      sala: session.sala || sessionRoomName(session.uid || user.uid, fecha),
      fecha_confirmacion: new Date().toISOString(),
    };
    await updateSessionWithFallback(session.id, changes);
    const confirmedSession = { ...session, ...changes };
    setSessions((current) => sortSessionsByDate(upsertById(current, confirmedSession)));
    openSessionWhatsapp(confirmedSession);
    onToast?.("Turno confirmado en la agenda.");
  }

  async function saveNotes() {
    if (!selected) return;
    const changes = { notas: notes, notas_actualizadas: new Date().toISOString() };
    await updateSessionWithFallback(selected.id, changes);
    setSessions((current) => sortSessionsByDate(upsertById(current, { ...selected, ...changes })));
    setSelected((current) => current ? { ...current, ...changes } : current);
    onToast?.("Notas guardadas.");
  }

  async function deleteSession(session) {
    if (!session?.id || !window.confirm(`¿Borrar el turno de ${session.nombre || "Turno reservado"}?`)) return;
    try {
      await deleteSessionWithFallback(session.id);
      setSessions((current) => current.filter((item) => item.id !== session.id));
      refreshAdminSessions().catch(() => {});
      onToast?.("Turno borrado.");
    } catch (error) {
      onToast?.(`No se pudo borrar el turno: ${error.message || "error desconocido"}`);
    }
  }

  function openSessionCall(session) {
    const roomUrl = jitsiRoomUrl(session.sala || sessionRoomName(session.uid || user.uid, session.fecha));
    window.open(roomUrl, "_blank", "noopener,noreferrer");
  }

  function openSessionWhatsapp(session) {
    if (!session?.telefono) {
      onToast?.("Este turno no tiene WhatsApp registrado.");
      return;
    }
    window.open(sessionWhatsappUrl(session), "_blank", "noopener,noreferrer");
  }

  if (selected) {
    const roomUrl = jitsiRoomUrl(selected.sala || sessionRoomName(selected.uid || user.uid, selected.fecha));
    return (
      <section className="content-page sessions-page">
        <PageTitle icon={Video} title="Sesión 1 a 1" subtitle={selected.nombre || "Coaching espiritual"} onBack={() => setSelected(null)} />
        <div className="session-workspace">
          <article className="session-card">
            <small>{sessionStatusLabel(selected.estado)} - {formatSessionDate(selected.fecha)}</small>
            <h2>{selected.tipo || "Coaching espiritual"}</h2>
            {selected.motivo ? <p>{selected.motivo}</p> : <p>Espacio privado de acompañamiento.</p>}
            <div className="session-call-card">
              <strong>Videollamada lista</strong>
              <small>Se abre fuera de la app para que cámara y micrófono funcionen mejor.</small>
              <button className="primary" type="button" onClick={() => openSessionCall(selected)}>
                <Video size={18} /> Entrar a la videollamada
              </button>
              {isAdmin && selected.telefono ? (
                <button className="ghost compact" type="button" onClick={() => openSessionWhatsapp(selected)}>
                  <MessageCircle size={15} /> Enviar datos por WhatsApp
                </button>
              ) : null}
              <a href={roomUrl} target="_blank" rel="noreferrer">Abrir enlace de respaldo</a>
            </div>
            {isAdmin ? (
              <div className="session-actions">
                <button className="primary small" type="button" onClick={() => updateSessionStatus(selected, "en curso")}>Marcar en curso</button>
                <button className="ghost compact" type="button" onClick={() => updateSessionStatus(selected, "finalizada")}>Finalizar</button>
              </div>
            ) : null}
          </article>
          {isAdmin ? (
            <form className="session-notes" onSubmit={(event) => { event.preventDefault(); saveNotes(); }}>
              <label>Notas de la sesión<textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Tema trabajado, observaciones, tarea espiritual..." /></label>
              <button className="primary small" type="submit">Guardar notas</button>
            </form>
          ) : null}
        </div>
      </section>
    );
  }

  const requests = sessions.filter((item) => item.estado === "solicitado");
  const upcoming = sessions.filter((item) => item.estado !== "finalizada" && item.estado !== "solicitado");
  const past = sessions.filter((item) => item.estado === "finalizada");
  const selectedDaySessions = selectedDay
    ? upcoming.filter((item) => sessionDayKey(item.fecha) === selectedDay)
    : [];

  function openDay(day) {
    setSelectedDay(day);
    setShowDayForm(false);
    setForm((current) => ({
      ...current,
      fecha: dateTimeForDay(day),
    }));
  }

  function openDayForm() {
    setShowDayForm(true);
    setForm((current) => ({
      ...current,
      id: "",
      nombre: "",
      telefono: "",
      tipo: "Coaching espiritual",
      fecha: dateTimeForDay(selectedDay),
      motivo: "",
    }));
  }

  function editSession(session) {
    setShowDayForm(true);
    setForm({
      id: session.id,
      nombre: session.nombre || "",
      telefono: session.telefono || "",
      tipo: session.tipo || "Coaching espiritual",
      fecha: session.fecha || dateTimeForDay(selectedDay),
      motivo: session.motivo || "",
      sala: session.sala || "",
      notas: session.notas || "",
      fecha_creacion: session.fecha_creacion || "",
    });
  }

  if (isAdmin && selectedDay) {
    return (
      <section className="content-page sessions-page">
        <PageTitle icon={CalendarDays} title={formatSessionDay(selectedDay)} subtitle="Turnos del día" onBack={() => setSelectedDay("")} />
        <div className="session-list day-detail">
          {selectedDaySessions.length === 0 ? <p className="empty-state">No hay turnos cargados para este día.</p> : null}
          {selectedDaySessions.map((session) => (
            <article className={`session-card ${sessionStatusClass(session)}`} key={session.id}>
              <small>{sessionStatusLabel(session.estado)} - {formatSessionTime(session.fecha)}</small>
              <h3>{session.nombre}</h3>
              <p>{session.tipo || "Coaching espiritual"}</p>
              {session.telefono ? <em>WhatsApp: {session.telefono}</em> : null}
              {session.motivo ? <span>{summary(session.motivo, 120)}</span> : null}
              <div className="session-actions">
                <button className="primary small" type="button" onClick={() => setSelected(session)}>
                  <Video size={16} /> Ver enlace
                </button>
                <button className="ghost compact" type="button" onClick={() => editSession(session)}>
                  <Pencil size={15} /> Editar
                </button>
                {session.telefono ? (
                  <button className="ghost compact" type="button" onClick={() => openSessionWhatsapp(session)}>
                    <MessageCircle size={15} /> WhatsApp
                  </button>
                ) : null}
                <button className="ghost compact danger" type="button" onClick={() => deleteSession(session)}>
                  <Trash2 size={15} /> Borrar
                </button>
              </div>
            </article>
          ))}
          {!showDayForm ? (
            <button className="primary" type="button" onClick={openDayForm}>
              <Plus size={17} /> Cargar turno
            </button>
          ) : (
          <SessionBookingForm
            form={form}
            setForm={setForm}
            busy={busy}
            isAdmin={isAdmin}
            onSubmit={bookSession}
            status={saveStatus}
            submitLabel={form.id ? "Guardar cambios" : "Crear turno"}
          />
          )}
        </div>
      </section>
    );
  }

  return (
    <section className="content-page sessions-page">
      <PageTitle icon={CalendarDays} title="Sesiones" subtitle="Coaching espiritual 1 a 1 dentro del Ashram." onBack={onBack} />
      {isAdmin ? (
        <div className="session-sync-status">
          <span>{sessions.length} turno{sessions.length === 1 ? "" : "s"} leÃ­do{sessions.length === 1 ? "" : "s"} desde Firebase</span>
          <small>Si este número es cero, la app no está recibiendo la agenda guardada.</small>
        </div>
      ) : null}
      {!isAdmin ? (
        <SessionBookingForm
          form={form}
          setForm={setForm}
          busy={busy}
          isAdmin={isAdmin}
          onSubmit={bookSession}
          status={saveStatus}
          title="Solicitar sesión"
          submitLabel="Enviar solicitud"
        />
      ) : null}
      {isAdmin && requests.length ? <SessionRequests sessions={requests} onSchedule={scheduleSession} /> : null}
      <SessionList title={isAdmin ? "Agenda de sesiones" : "Tu agenda de sesiones"} sessions={upcoming} onOpen={setSelected} onDayOpen={openDay} isAdmin={isAdmin} />
      {past.length ? <SessionList title="Historial" sessions={past} onOpen={setSelected} isAdmin={isAdmin} /> : null}
    </section>
  );
}

function SessionBookingForm({ form, setForm, busy, isAdmin, onSubmit, status = "", title = "Cargar turno", submitLabel = "Guardar" }) {
  return (
    <form className="session-booking" onSubmit={onSubmit}>
      <h2>{title}</h2>
      <label>Nombre<input value={form.nombre} onChange={(event) => setForm({ ...form, nombre: event.target.value })} placeholder={isAdmin ? "Turno reservado" : ""} /></label>
      <label>WhatsApp<input value={form.telefono} onChange={(event) => setForm({ ...form, telefono: event.target.value })} placeholder="+54..." /></label>
      <label>Tipo de sesión
        <select value={form.tipo} onChange={(event) => setForm({ ...form, tipo: event.target.value })}>
          <option>Coaching espiritual</option>
          <option>Ayurveda y hábitos</option>
          <option>AcompaÃ±amiento personal</option>
        </select>
      </label>
      {isAdmin ? <label>Día y horario<input type="datetime-local" value={form.fecha} onChange={(event) => setForm({ ...form, fecha: event.target.value })} /></label> : null}
      <label>Motivo / intención<textarea value={form.motivo} onChange={(event) => setForm({ ...form, motivo: event.target.value })} placeholder="Contame brevemente qué querés trabajar..." /></label>
      {status ? <p className="session-save-status">{status}</p> : null}
      <button className="primary" type="button" disabled={busy} onClick={onSubmit}>{busy ? "Guardando..." : submitLabel}</button>
    </form>
  );
}

function SessionList({ title, sessions, onOpen, onDayOpen, isAdmin }) {
  const groups = isAdmin ? buildAdminAgendaDays(sessions) : groupSessionsByDay(sessions);
  if (!isAdmin) {
    return (
      <div className="session-list">
        <h2>{title}</h2>
        {sessions.length === 0 ? <p className="empty-state">Aún no hay sesiones confirmadas.</p> : null}
        {sessions.map((session) => (
          <article className={`session-card ${sessionStatusClass(session)}`} key={session.id}>
            <small>{sessionStatusLabel(session.estado)} - {formatSessionDate(session.fecha)}</small>
            <h3>{session.tipo || "Coaching espiritual"}</h3>
            <p>{session.motivo || "Sesión privada de acompañamiento."}</p>
            <div className="session-actions">
              <button className="primary small" type="button" onClick={() => onOpen?.(session)}>
                <Video size={16} /> Entrar a la videollamada
              </button>
            </div>
          </article>
        ))}
      </div>
    );
  }

  return (
    <div className={`session-list ${isAdmin ? "session-calendar" : ""}`}>
      <h2>{title}</h2>
      {sessions.length === 0 ? <p className="empty-state">Aún no hay sesiones.</p> : null}
      {groups.map(({ day, label, items }) => (
        <button className={`session-day ${items.length ? "has-sessions" : ""}`} key={day} type="button" onClick={() => isAdmin ? onDayOpen?.(day) : null}>
          <h3>{label}</h3>
          {items.length === 0 ? <p className="session-empty-day">Sin turnos</p> : null}
          {items.length ? <strong>{items.length} turno{items.length === 1 ? "" : "s"}</strong> : null}
          {items.slice(0, 3).map((session) => (
            <span className="session-mini-item" key={session.id}>
              <b>{formatSessionTime(session.fecha)}</b>
              <span>{session.nombre || "Alumno"}</span>
              <em>{session.tipo || "Sesión"}</em>
            </span>
          ))}
          {items.length > 3 ? <em className="session-more">+{items.length - 3} más</em> : null}
        </button>
      ))}
    </div>
  );
}

function SessionRequests({ sessions, onSchedule }) {
  const [dates, setDates] = useState({});
  return (
    <div className="session-list session-requests">
      <h2>Solicitudes pendientes</h2>
      {sessions.map((session) => (
        <article className="session-card session-request" key={session.id}>
          <small>Solicitud nueva</small>
          <h3>{session.nombre}</h3>
          <p>{session.tipo || "Coaching espiritual"}</p>
          {session.telefono ? <em>WhatsApp: {session.telefono}</em> : null}
          {session.motivo ? <span>{summary(session.motivo, 130)}</span> : null}
          <label className="schedule-field">
            Asignar día y hora
            <input
              type="datetime-local"
              value={dates[session.id] || ""}
              onChange={(event) => setDates((current) => ({ ...current, [session.id]: event.target.value }))}
            />
          </label>
          <button className="primary small" type="button" onClick={() => onSchedule(session, dates[session.id])}>
            Confirmar turno
          </button>
        </article>
      ))}
    </div>
  );
}

function Tienda({ user, profile, onBack, onToast }) {
  const isAdmin = isAdminProfile(profile, user);
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState(() => readCart());
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [lightbox, setLightbox] = useState(null);
  const [storeEditing, setStoreEditing] = useState(null);
  const [shareMenuProduct, setShareMenuProduct] = useState(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [checkoutStep, setCheckoutStep] = useState(1);
  const [buyer, setBuyer] = useState(() => readStoreBuyer(profile, user));
  const [rememberBuyer, setRememberBuyer] = useState(true);
  const [savingOrder, setSavingOrder] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [recentlyAdded, setRecentlyAdded] = useState("");
  const [orderSentPrompt, setOrderSentPrompt] = useState(false);
  const [formErrors, setFormErrors] = useState({});
  const [storeAdminTab, setStoreAdminTab] = useState("preview");
  const [storeSettings, setStoreSettings] = useState(DEFAULT_STORE_SETTINGS);
  const [storeSettingsDraft, setStoreSettingsDraft] = useState(DEFAULT_STORE_SETTINGS);
  const [savingSocialLinks, setSavingSocialLinks] = useState(false);
  const [uploadingStoreBackground, setUploadingStoreBackground] = useState(false);
  const activeProducts = products
    .filter((product) => product.activo !== false)
    .sort((a, b) => sortStoreProducts(a, b, "novedades"));
  const productGroups = groupStoreProductsByCategory(activeProducts);
  const categoryOptions = storeCategoryOptions(products);
  const visibleStoreSettings = isAdmin ? normalizeStoreSettings(storeSettingsDraft) : storeSettings;
  const hasStoreBackground = Boolean(visibleStoreSettings.backgroundUrl);
  const hasStoreColor = Boolean(visibleStoreSettings.backgroundColor);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setLoadError("");
    void trackEvent("store_view", { screenName: "tienda" });
    loadList("productos")
      .then((items) => {
        if (!alive) return;
        setProducts(items);
      })
      .catch((error) => {
        if (!alive) return;
        setLoadError(error.message || "No se pudo cargar la tienda.");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    return onValue(ref(db, STORE_SOCIAL_LINKS_PATH), (snap) => {
      const settings = normalizeStoreSettings(snap.val());
      setStoreSettings(settings);
      setStoreSettingsDraft(settings);
    });
  }, []);

  async function refreshProducts() {
    setProducts(await loadList("productos"));
  }

  async function saveStoreSettings(event) {
    event.preventDefault();
    if (!isAdmin) return;
    setSavingSocialLinks(true);
    try {
      const settings = normalizeStoreSettings(storeSettingsDraft);
      await set(ref(db, STORE_SOCIAL_LINKS_PATH), settings);
      setStoreSettings(settings);
      onToast?.("Configuracion de tienda guardada.");
    } catch (error) {
      onToast?.(error.message || "No se pudo guardar la configuracion.");
    } finally {
      setSavingSocialLinks(false);
    }
  }

  async function uploadStoreBackground(event) {
    const file = event.target.files?.[0];
    if (!file || !isAdmin) return;
    setUploadingStoreBackground(true);
    try {
      const uploaded = await uploadImageWithFallback(file, "config/tienda-fondos");
      const nextSettings = normalizeStoreSettings({
        ...storeSettingsDraft,
        backgroundUrl: uploaded.url,
        backgroundPath: uploaded.path,
        backgroundFileName: file.name,
      });
      setStoreSettingsDraft(nextSettings);
      await set(ref(db, STORE_SOCIAL_LINKS_PATH), nextSettings);
      setStoreSettings(nextSettings);
      onToast?.("Fondo de tienda actualizado.");
    } catch (error) {
      onToast?.(error.message || "No se pudo subir el fondo de tienda.");
    } finally {
      setUploadingStoreBackground(false);
      event.target.value = "";
    }
  }

  useEffect(() => {
    localStorage.setItem("ashram-store-cart", JSON.stringify(cart));
  }, [cart]);

  useEffect(() => {
    if (loading || selectedProduct) return;
    const linkedProductId = storeProductIdFromUrl();
    if (!linkedProductId) return;
    const linkedProduct = activeProducts.find((product) => product.id === linkedProductId);
    if (!linkedProduct) return;
    void trackEvent("product_view", {
      contentType: "tienda",
      contentId: linkedProduct.id,
      contentTitle: productName(linkedProduct),
      contentCategory: linkedProduct.categoria || "",
      source: "deep_link",
    });
    setSelectedProduct(linkedProduct);
  }, [loading, products, selectedProduct]);

  const cartItems = Object.entries(cart)
    .map(([id, quantity]) => {
      const product = products.find((item) => item.id === id);
      return product ? { product, quantity } : null;
    })
    .filter(Boolean);
  const cartCount = cartItems.reduce((total, item) => total + item.quantity, 0);
  const cartTotal = cartItems.reduce((total, item) => total + (productHasPrice(item.product) ? productPrice(item.product) * item.quantity : 0), 0);
  const allCartItemsPriced = cartItems.length > 0 && cartItems.every(({ product }) => productHasPrice(product));

  function addProduct(product, amount = 1) {
    const stock = productStock(product);
    const safeAmount = Math.max(1, Math.trunc(toNumber(amount)) || 1);
    let added = false;
    setCart((old) => {
      const current = old[product.id] || 0;
      if (stock > 0 && current >= stock) {
        onToast?.("No hay mas stock disponible.");
        return old;
      }
      const nextQuantity = stock > 0 ? Math.min(stock, current + safeAmount) : current + safeAmount;
      added = nextQuantity > current;
      return { ...old, [product.id]: nextQuantity };
    });
    if (!added) return;
    setRecentlyAdded(product.id);
    window.setTimeout(() => setRecentlyAdded((current) => (current === product.id ? "" : current)), 850);
    void trackEvent("add_to_cart", {
      contentType: "tienda",
      contentId: product.id,
      contentTitle: productName(product),
      value: productHasPrice(product) ? productPrice(product) : 0,
      quantity: safeAmount,
    });
    onToast?.("Producto agregado al carrito.");
  }

  function removeProduct(product) {
    setCart((old) => {
      const next = { ...old };
      delete next[product.id];
      return next;
    });
    void trackEvent("remove_from_cart", {
      contentType: "tienda",
      contentId: product.id,
      contentTitle: productName(product),
    });
    onToast?.("Producto eliminado del carrito.");
  }

  function clearCart() {
    setCart({});
    setCheckoutOpen(false);
    setOrderSentPrompt(false);
    onToast?.("Carrito vacio.");
  }

  function openProduct(product) {
    setStoreProductUrlParam(product.id);
    void trackEvent("product_view", {
      contentType: "tienda",
      contentId: product.id,
      contentTitle: productName(product),
      contentCategory: product.categoria || "",
    });
    setSelectedProduct(product);
  }

  function closeProduct() {
    clearStoreProductUrlParam();
    setSelectedProduct(null);
  }

  async function shareProduct(product, preparedImageFile = null) {
    const productTitle = productName(product);
    const shareUrl = storeProductShareUrl(product);
    const shareText = storeProductShareText(product, shareUrl);
    let shareMethod = "clipboard";
    let imageAttached = false;

    if (navigator.share) {
      if (preparedImageFile && navigator.canShare?.({ files: [preparedImageFile] })) {
        try {
          await navigator.share({ title: productTitle, text: shareText, files: [preparedImageFile] });
          imageAttached = true;
          trackProductShare(product, "native_files", true, shareUrl);
          return;
        } catch (error) {
          if (error?.name === "AbortError") return;
        }
      }
      try {
        await navigator.share({ title: productTitle, text: shareText, url: shareUrl });
        shareMethod = "native";
        trackProductShare(product, shareMethod, imageAttached, shareUrl);
        return;
      } catch (error) {
        if (error?.name === "AbortError") return;
      }
    }

    const copied = await copyStoreShareText(shareText);
    if (copied) {
      onToast?.("Enlace del producto copiado.");
      trackProductShare(product, shareMethod, imageAttached, shareUrl);
    } else {
      onToast?.("No se pudo copiar el enlace del producto.");
    }
  }

  function openProductShareMenu(product) {
    setShareMenuProduct(product);
  }

  function shareProductWhatsapp(product) {
    const shareUrl = storeProductShareUrl(product);
    const shareText = storeProductShareText(product, shareUrl);
    window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, "_blank", "noopener,noreferrer");
    trackProductShare(product, "whatsapp", false, shareUrl);
  }

  async function copyProductShareLink(product) {
    const shareUrl = storeProductShareUrl(product);
    const copied = await copyStoreShareText(storeProductShareText(product, shareUrl));
    onToast?.(copied ? "Enlace del producto copiado." : "No se pudo copiar el enlace.");
    if (copied) trackProductShare(product, "clipboard", false, shareUrl);
  }

  async function saveProductShareImage(product, preparedImageFile = null) {
    const file = preparedImageFile || await shareProductImageFile(product, productName(product));
    if (file) {
      downloadBlobFile(file, cleanFileName(productName(product)) || "producto-ashram");
      await copyProductShareLink(product);
      onToast?.("Tu aplicación no admite compartir la imagen directamente. La guardé para que puedas publicarla.");
      trackProductShare(product, "save_image", true, storeProductShareUrl(product));
      return;
    }
    const imageUrl = productMainImage(product);
    if (imageUrl) {
      const link = document.createElement("a");
      link.href = imageUrl;
      link.download = `${cleanFileName(productName(product)) || "producto-ashram"}.jpg`;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.click();
      await copyProductShareLink(product);
      onToast?.("Abrí la imagen y copié el enlace del producto.");
      return;
    }
    onToast?.("Este producto no tiene imagen para guardar.");
  }

  async function deleteStoreProduct(product) {
    if (!isAdmin) return;
    if (!window.confirm(`Borrar "${productName(product) || "producto"}"?`)) return;
    try {
      await remove(ref(db, `productos/${product.id}`));
      await deleteStoragePath(product.imagen_path);
      await deleteStoragePath(product.imagen_detalle_path || product.detalle_imagen_path);
      await refreshProducts();
      onToast?.("Producto borrado.");
    } catch (error) {
      onToast?.(error.message || "No se pudo borrar el producto.");
    }
  }

  function openImage(product, index = 0) {
    void trackEvent("product_image_open", {
      contentType: "tienda",
      contentId: product.id,
      contentTitle: productName(product),
    });
    setLightbox({ product, index });
  }

  function openCheckout() {
    if (!cartItems.length) {
      onToast?.("Tu carrito esta vacio.");
      return;
    }
    setCheckoutStep(1);
    setCheckoutOpen(true);
  }

  function changeQuantity(product, delta) {
    const stock = productStock(product);
    setCart((old) => {
      const nextQuantity = (old[product.id] || 0) + delta;
      if (nextQuantity <= 0) {
        const next = { ...old };
        delete next[product.id];
        return next;
      }
      if (stock > 0 && nextQuantity > stock) {
        onToast?.("No hay mas stock disponible.");
        return old;
      }
      return { ...old, [product.id]: nextQuantity };
    });
  }

  function startCheckout() {
    if (!cartItems.length) {
      onToast?.("Tu carrito esta vacio.");
      return;
    }
    void trackEvent("begin_checkout", {
      contentType: "tienda",
      quantity: cartCount,
      value: cartTotal,
    });
    setFormErrors({});
    setCheckoutStep(1);
    setCheckoutOpen(true);
  }

  async function confirmOrder() {
    const errors = validateStoreBuyer(buyer);
    if (Object.keys(errors).length) {
      setFormErrors(errors);
      setCheckoutStep(2);
      onToast?.("Revisa los datos marcados.");
      return;
    }

    const order = {
      uid: user?.uid || "",
      email: cleanText(buyer.email),
      nombre: cleanText(buyer.nombre),
      domicilio: cleanText(buyer.domicilio),
      telefono: cleanText(buyer.telefono),
      localidad: cleanText(buyer.localidad),
      provincia: cleanText(buyer.provincia),
      codigo_postal: cleanText(buyer.codigo_postal),
      entrega: cleanText(buyer.entrega) || "A coordinar",
      observaciones: cleanText(buyer.observaciones),
      estado: "pendiente",
      fecha: new Date().toISOString(),
      total: allCartItemsPriced ? cartTotal : null,
      precio_a_confirmar: !allCartItemsPriced,
      items: cartItems.map(({ product, quantity }) => ({
        producto_id: product.id,
        nombre: productName(product),
        cantidad: quantity,
        precio: productHasPrice(product) ? productPrice(product) : null,
        subtotal: productHasPrice(product) ? productPrice(product) * quantity : null,
        disponibilidad: productAvailability(product),
        variante: cleanText(product.variante || product.variantes || ""),
      })),
    };

    setSavingOrder(true);
    try {
      const orderRef = await push(ref(db, "pedidos"), order);
      if (rememberBuyer) {
        localStorage.setItem("ashram-store-buyer", JSON.stringify({ ...buyer, observaciones: "" }));
      }
      void trackEvent("whatsapp_order_click", {
        contentType: "tienda",
        contentId: orderRef.key,
        quantity: cartCount,
        value: cartTotal,
      });
      window.open(storeWhatsappUrl({ ...order, id: orderRef.key }), "_blank", "noopener,noreferrer");
      setOrderSentPrompt(true);
      onToast?.("Abrimos WhatsApp para enviar el pedido.");
    } catch (error) {
      onToast?.(error.message || "No se pudo guardar el pedido.");
    } finally {
      setSavingOrder(false);
    }
  }

  return (
    <section
      className={`content-page store-page ${hasStoreBackground ? "has-store-background" : ""} ${hasStoreColor ? "has-store-color" : ""}`}
      style={{
        "--store-bg-color": visibleStoreSettings.backgroundColor || "transparent",
        "--store-bg-image": hasStoreBackground ? `url("${cssUrl(visibleStoreSettings.backgroundUrl)}")` : "none",
        "--store-bg-overlay": visibleStoreSettings.backgroundOverlay,
      }}
    >
      <div className="store-page-background" aria-hidden="true" />
      <div className="store-page-overlay" aria-hidden="true" />
      <PageTitle
        icon={ShoppingBag}
        title="Tienda del Ashram Ganesha"
        subtitle="Objetos creados con intención para acompañar tu práctica y tu hogar"
        onBack={onBack}
      />
      <section className="store-welcome">
        <span>Tienda</span>
        <h2>Bienvenido a este espacio de objetos sagrados</h2>
        <p>Elegí con calma. Al finalizar, recibo tu pedido por WhatsApp y luego te envío el link de pago o los datos de transferencia.</p>
        <StoreSocialLinks links={visibleStoreSettings} />
      </section>

      {isAdmin ? (
        <section className="store-admin-panel" aria-label="Administracion de productos">
          <header>
            <span>
              <strong>Administración de tienda</strong>
              <small>Cargá, editá o desactivá productos sin salir de la tienda.</small>
            </span>
          </header>
          <div className="store-admin-tabs" role="tablist" aria-label="Administracion de tienda">
            {[
              { id: "preview", label: "\uD83D\uDC41\uFE0F Publicación" },
              { id: "products", label: "\uD83D\uDECD\uFE0F Productos" },
              { id: "settings", label: "\u2699\uFE0F Configuración" },
            ].map((tab) => (
              <button key={tab.id} className={storeAdminTab === tab.id ? "active" : ""} type="button" onClick={() => setStoreAdminTab(tab.id)}>
                {tab.label}
              </button>
            ))}
          </div>
          {storeAdminTab === "preview" ? (
            <StoreAdminPreview products={activeProducts} settings={visibleStoreSettings} />
          ) : null}
          {storeAdminTab === "products" ? (
            <div className="store-admin-products">
              <button className="primary small" type="button" onClick={() => setStoreEditing({})}>
                <span aria-hidden="true">&#10133;</span> Nuevo producto
              </button>
              {storeEditing ? (
                <ProductAdminForm
                  item={storeEditing}
                  categoryOptions={categoryOptions}
                  onCancel={() => setStoreEditing(null)}
                  onSaved={() => {
                    setStoreEditing(null);
                    refreshProducts();
                    onToast?.("Producto guardado.");
                  }}
                  onToast={onToast}
                />
              ) : null}
              <div className="store-admin-list">
                {products.map((product) => (
                  <article className="admin-row" key={product.id}>
                    <img src={productMainImage(product)} alt="" loading="lazy" />
                    <span>
                      <strong>{productName(product)}</strong>
                      <small>{product.categoria || "Sin categoria"} - {product.activo === false ? "Inactivo" : "Activo"} - {productHasPrice(product) ? formatMoney(productPrice(product)) : "Precio a confirmar"}</small>
                    </span>
                                        <button className="icon-btn" type="button" title="Editar" onClick={() => setStoreEditing(product)} aria-label={`Editar ${productName(product)}`}>&#9999;&#65039;</button>
                                        <button className="icon-btn danger" type="button" title="Borrar" onClick={() => deleteStoreProduct(product)} aria-label={`Borrar ${productName(product)}`}>&#128465;&#65039;</button>
                  </article>
                ))}
              </div>
            </div>
          ) : null}
          {storeAdminTab === "settings" ? (
            <StoreSettingsForm
              draft={storeSettingsDraft}
              setDraft={setStoreSettingsDraft}
              saving={savingSocialLinks}
              onSubmit={saveStoreSettings}
              onUploadBackground={uploadStoreBackground}
              uploadingBackground={uploadingStoreBackground}
            />
          ) : null}
        </section>
      ) : null}

      <StoreFloatingCart
        cartCount={cartCount}
        total={cartTotal}
        allPriced={allCartItemsPriced}
        pulse={Boolean(recentlyAdded)}
        onClick={startCheckout}
      />

      <aside className={`store-summary store-cart-panel ${recentlyAdded ? "pulse" : ""}`} aria-label="Carrito de compra">
        <header>
          <span>
            <strong>Tu carrito</strong>
            <small>{cartCount} unidad{cartCount === 1 ? "" : "es"} - {!cartItems.length || allCartItemsPriced ? formatMoney(cartTotal) : "precio a confirmar"}</small>
          </span>
          <button className="primary small store-cart-button" type="button" onClick={startCheckout} aria-label={`Finalizar pedido con ${cartCount} unidades`}>
            <span aria-hidden="true">&#128722;</span>
            {cartCount ? <b>{cartCount}</b> : null}
          </button>
        </header>
        {cartItems.length ? (
          <div className="store-cart-list">
            {cartItems.map(({ product, quantity }) => (
              <article className="store-cart-mini" key={product.id}>
                <img src={productMainImage(product)} alt={productName(product)} loading="lazy" />
                <span>
                  <strong>{productName(product)}</strong>
                  <small>Cantidad: {quantity}</small>
                  <small>Total: {productHasPrice(product) ? formatMoney(productPrice(product) * quantity) : "Precio a confirmar"}</small>
                </span>
              </article>
            ))}
          </div>
        ) : (
          <small className="store-cart-empty">Tu carrito está esperando algo especial.</small>
        )}
      </aside>

      {false ? <div className={`store-summary ${recentlyAdded ? "pulse" : ""}`}>
        <span>
          <strong>Carrito</strong>
          <small>{cartCount} unidad{cartCount === 1 ? "" : "es"} - {!cartItems.length || allCartItemsPriced ? formatMoney(cartTotal) : "precio a confirmar"}</small>
        </span>
        <button className="primary small store-cart-button" type="button" onClick={openCheckout} disabled={!cartItems.length} aria-label={`Abrir carrito con ${cartCount} unidades`}>
          <ShoppingCart size={16} />
          <b>{cartCount}</b>
          Ver carrito
        </button>
      </div> : null}

      {false ? (
        <section className="store-featured" aria-label="Productos destacados">
          <h2>Destacados</h2>
          <div>
            {featuredProducts.map((product) => (
              <button key={product.id} type="button" onClick={() => openProduct(product)}>
                <img src={productMainImage(product)} alt={productName(product)} loading="lazy" />
                <span>{productName(product)}</span>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {false ? <div className="store-toolbar">
        <label>
          Buscar
          <input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Nombre o descripción" />
        </label>
        <label>
          Categoría
          <select value={category} onChange={(event) => setCategory(event.target.value)}>
            {storeCategories.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        <label>
          Ordenar
          <select value={sortMode} onChange={(event) => setSortMode(event.target.value)}>
            <option value="novedades">Novedades</option>
            <option value="precio-menor">Precio menor</option>
            <option value="precio-mayor">Precio mayor</option>
          </select>
        </label>
      </div> : null}

      {loading ? <StoreSkeletonGrid /> : null}
      {loadError ? <p className="empty-state store-state-error">{loadError}</p> : null}
      {false ? <div className="store-grid">
        {!loading && !loadError && activeProducts.map((product) => {
          const quantity = cart[product.id] || 0;
          const stock = productStock(product);
          const soldOut = productAvailability(product) === "agotado";
          return (
            <article className={`store-card ${recentlyAdded === product.id ? "just-added" : ""}`} key={product.id}>
              <button className="store-card-image" type="button" onClick={() => openImage(product)} aria-label={`Ampliar imagen de ${productName(product)}`}>
                <img src={productMainImage(product)} alt={productName(product)} loading="lazy" />
              </button>
              <div>
                <h3>{productName(product)}</h3>
                <strong>{productHasPrice(product) ? formatMoney(productPrice(product)) : "Precio a confirmar"}</strong>
                <small>{productCardBadge(product, stock)}</small>
                {quantity ? <em>{quantity} en carrito</em> : null}
              </div>
              <footer>
                <button className="ghost compact" type="button" onClick={() => openProduct(product)}>
                  Ver producto
                </button>
                <button className="primary compact" type="button" disabled={soldOut || recentlyAdded === product.id} onClick={() => addProduct(product)}>
                  <ShoppingCart size={16} /> Agregar
                </button>
              </footer>
            </article>
          );
        })}
      </div> : null}
      {!loading && !loadError && productGroups.map(({ category: groupName, items }) => (
        <section className="store-category-section" key={groupName}>
          <h2>{groupName}</h2>
          <div className="store-grid">
            {items.map((product) => {
              const quantity = cart[product.id] || 0;
              const stock = productStock(product);
              const soldOut = productAvailability(product) === "agotado";
              return (
                <article className={`store-card ${recentlyAdded === product.id ? "just-added" : ""}`} key={product.id}>
                  <button className="store-card-image" type="button" onClick={() => openProduct(product)} aria-label={`Ver ${productName(product)}`}>
                    <img src={productMainImage(product)} alt={productName(product)} loading="lazy" />
                    {productVideoInfo(product).url ? <span className="store-video-badge">&#127916; Video</span> : null}
                  </button>
                  <button className="store-card-info" type="button" onClick={() => openProduct(product)}>
                    <h3>{productName(product)}</h3>
                    <strong>{productHasPrice(product) ? formatMoney(productPrice(product)) : "Precio a confirmar"}</strong>
                    <small>{productCardBadge(product, stock)}</small>
                    {quantity ? <em>{quantity} en carrito</em> : null}
                  </button>
                  <button className="primary compact store-card-add" type="button" disabled={soldOut || recentlyAdded === product.id} onClick={() => addProduct(product)}>
                    <ShoppingCart size={15} /> Agregar
                  </button>
                </article>
              );
            })}
          </div>
        </section>
      ))}
      {!loading && !loadError && activeProducts.length === 0 ? (
        <div className="store-empty-state">
          <ShoppingBag size={34} />
          <strong>La tienda se está preparando</strong>
          <small>Todavía no hay productos activos cargados.</small>
        </div>
      ) : null}
      {false ? (
        <div className="store-empty-state">
          <SearchIcon size={34} />
          <strong>No encontramos productos</strong>
          <small>Probá cambiar la búsqueda o la categoría.</small>
        </div>
      ) : null}
      {selectedProduct ? (
        <ProductDetailModal
          product={selectedProduct}
          quantity={cart[selectedProduct.id] || 0}
          onClose={closeProduct}
          onAdd={(amount) => addProduct(selectedProduct, amount)}
          onWhatsapp={(amount) => {
            addProduct(selectedProduct, amount);
            setSelectedProduct(null);
            setCheckoutStep(1);
            setCheckoutOpen(true);
          }}
          onOpenImage={(index) => openImage(selectedProduct, index)}
          onChangeQuantity={(delta) => changeQuantity(selectedProduct, delta)}
          onShare={(preparedImageFile) => shareProduct(selectedProduct, preparedImageFile)}
          onOpenShareMenu={() => openProductShareMenu(selectedProduct)}
        />
      ) : null}
      {shareMenuProduct ? (
        <ProductShareMenu
          product={shareMenuProduct}
          onClose={() => setShareMenuProduct(null)}
          onShareImage={(preparedImageFile) => shareProduct(shareMenuProduct, preparedImageFile)}
          onWhatsapp={() => shareProductWhatsapp(shareMenuProduct)}
          onSaveImage={(preparedImageFile) => saveProductShareImage(shareMenuProduct, preparedImageFile)}
          onCopy={() => copyProductShareLink(shareMenuProduct)}
        />
      ) : null}
      {lightbox ? (
        <ProductImageViewer
          product={lightbox.product}
          index={lightbox.index}
          setIndex={(index) => setLightbox((current) => current ? { ...current, index } : current)}
          onClose={() => setLightbox(null)}
        />
      ) : null}
      {checkoutOpen ? (
        <StoreCheckoutModalV2
          step={checkoutStep}
          setStep={setCheckoutStep}
          cartItems={cartItems}
          total={cartTotal}
          allPriced={allCartItemsPriced}
          buyer={buyer}
          setBuyer={setBuyer}
          rememberBuyer={rememberBuyer}
          setRememberBuyer={setRememberBuyer}
          saving={savingOrder}
          onClose={() => setCheckoutOpen(false)}
          onConfirm={confirmOrder}
          onChangeQuantity={changeQuantity}
          onRemove={removeProduct}
          onClear={clearCart}
          errors={formErrors}
          setErrors={setFormErrors}
          orderSentPrompt={orderSentPrompt}
          onKeepCart={() => {
            setOrderSentPrompt(false);
            setCheckoutOpen(false);
          }}
          onConfirmSent={() => {
            void trackEvent("whatsapp_order_confirmed", {
              contentType: "tienda",
              quantity: cartCount,
              value: cartTotal,
            });
            clearCart();
          }}
        />
      ) : null}
      {cartItems.length ? (
        <button className="store-mobile-cart-bar" type="button" onClick={openCheckout}>
          Ver carrito · {cartCount} producto{cartCount === 1 ? "" : "s"} · {allCartItemsPriced ? formatMoney(cartTotal) : "precio a confirmar"}
        </button>
      ) : null}
      <span className="sr-only" aria-live="polite">
        {recentlyAdded ? `${productName(products.find((product) => product.id === recentlyAdded))} agregado al carrito` : ""}
      </span>
    </section>
  );
}

function Ofrendas({ onBack, onToast }) {
  async function copyAlias(alias) {
    await navigator.clipboard?.writeText(alias);
    onToast?.(`Alias copiado: ${alias}`);
  }

  return (
    <section className="content-page offerings-page">
      <PageTitle icon={Heart} title="Ofrendas al Ashram" subtitle="Gratitud, servicio y comunidad." onBack={onBack} />
      <article className="offerings-dialog" aria-label="Mensaje de Ganesha Guía">
        <div className="offerings-aura" aria-hidden="true" />
        <figure className="offerings-ganesha">
          <img src={ganeshaGuideImage} alt="Ganesha Guía dando la bienvenida" />
        </figure>
        <div className="offerings-message">
          <p>Bienvenido al Ashram Ganesha.</p>
          <p>Este espacio fue creado para compartir conocimientos, meditaciones, experiencias y herramientas que ayuden a las personas en su camino.</p>
          <p>Todo lo que encuentras aquí nace del deseo de servir y compartir.</p>
          <p>Si este espacio te ha acompañado, inspirado o ayudado de alguna manera, puedes realizar una ofrenda voluntaria para colaborar con el crecimiento y mantenimiento del Ashram.</p>
          <p>Toda contribución es recibida con gratitud.</p>
          <p>Gracias por caminar junto a nosotros.</p>
        </div>
      </article>

      <div className="offerings-section-title">
        <Heart size={18} />
        <h2>Realizar una Ofrenda</h2>
      </div>

      <div className="offerings-grid">
        <OfferingCard
          title="Mercado Pago"
          alias="gaby.ayurveda"
          holder="Carlos Gabriel Ramón Lucrezio"
          onCopy={copyAlias}
        />
        <OfferingCard
          title="Ualá"
          alias="ashram.ganesha"
          holder="Carlos Gabriel Ramón Lucrezio"
          onCopy={copyAlias}
        />
      </div>
    </section>
  );
}

function OfferingCard({ title, alias, holder, onCopy }) {
  return (
    <article className="offering-card">
      <h3><Heart size={18} /> {title}</h3>
      <dl>
        <div>
          <dt>Alias</dt>
          <dd>{alias}</dd>
        </div>
        <div>
          <dt>Titular</dt>
          <dd>{holder}</dd>
        </div>
      </dl>
      <button className="offering-copy" type="button" onClick={() => onCopy(alias)}>
        <Copy size={16} />
        Copiar alias
      </button>
    </article>
  );
}

function ProductDetailModal({ product, quantity, onClose, onAdd, onOpenImage, onChangeQuantity, onShare, onOpenShareMenu }) {
  const stock = productStock(product);
  const soldOut = productAvailability(product) === "agotado";
  const images = productDetailImages(product);
  const [activeIndex, setActiveIndex] = useState(0);
  const imageSrc = images[activeIndex] || productDetailImage(product);
  const productDetails = productDetailFields(product);
  const trustTexts = productTrustTexts(product);
  const [detailQuantity, setDetailQuantity] = useState(1);
  const [preparedShareImage, setPreparedShareImage] = useState(null);
  const description = truncateStoreDescription(product.descripcion);
  const productVideo = productVideoInfo(product);

  useEffect(() => {
    let alive = true;
    setPreparedShareImage(null);
    shareProductImageFile(product, productName(product)).then((file) => {
      if (alive) setPreparedShareImage(file);
    });
    return () => {
      alive = false;
    };
  }, [product.id]);

  return createPortal(
    <div className="modal-backdrop store-product-backdrop">
      <section className="store-modal">
        <button className="icon-btn store-modal-close" type="button" onClick={onClose} aria-label="Cerrar"><X size={18} /></button>
        <div className="store-modal-media">
          <button className="store-modal-image" type="button" onClick={() => onOpenImage(activeIndex)} aria-label="Ver imagen grande">
            <img src={imageSrc} alt={productName(product)} loading="lazy" />
          </button>
          {images.length > 1 ? (
            <div className="store-thumb-row" aria-label="Galería de imágenes">
              {images.map((image, index) => (
                <button key={`${image}-${index}`} className={index === activeIndex ? "active" : ""} type="button" onClick={() => setActiveIndex(index)} aria-label={`Ver foto ${index + 1}`}>
                  <img src={image} alt="" loading="lazy" />
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <div className="store-modal-body">
          <small>{product.categoria || "Ashram Ganesha"}</small>
          <h2>{productName(product)}</h2>
          <strong>{productHasPrice(product) ? formatMoney(productPrice(product)) : "Precio a confirmar"}</strong>
          <span className={`store-stock-pill ${soldOut ? "sold-out" : ""}`}>{soldOut ? "Agotado" : productAvailabilityLabel(product, stock)}</span>
          {description ? <p className="store-modal-description">{description}</p> : null}
          {productDetails.length ? (
            <dl className="store-product-details">
              {productDetails.map(({ label, value }) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          ) : null}
          {trustTexts.length ? (
            <div className="store-trust-list">
              {trustTexts.map((text) => <span key={text}>{text}</span>)}
            </div>
          ) : null}
          {productVideo.url ? (
            <div className="store-product-video">
              {productVideo.embedUrl ? (
                <iframe
                  title={`Video de ${productName(product)}`}
                  src={productVideo.embedUrl}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              ) : (
                <a href={productVideo.url} target="_blank" rel="noopener noreferrer">
                  <span aria-hidden="true">&#127916;</span> Ver video del producto
                </a>
              )}
            </div>
          ) : null}
          <div className="store-detail-quantity">
            <span>Cantidad</span>
            <div className="quantity-control compact">
              <button type="button" onClick={() => setDetailQuantity((current) => Math.max(1, current - 1))} aria-label="Disminuir cantidad"><Minus size={15} /></button>
              <span>{detailQuantity}</span>
              <button type="button" onClick={() => setDetailQuantity((current) => stock > 0 ? Math.min(stock, current + 1) : current + 1)} aria-label="Aumentar cantidad"><Plus size={15} /></button>
            </div>
          </div>
          {quantity ? (
            <div className="quantity-control">
              <button type="button" onClick={() => onChangeQuantity(-1)} aria-label="Quitar una unidad"><Minus size={16} /></button>
              <span>{quantity} en carrito</span>
              <button type="button" onClick={() => onChangeQuantity(1)} aria-label="Agregar una unidad"><Plus size={16} /></button>
            </div>
          ) : null}
          <div className="store-detail-actions">
            <button className="store-share-product-button" type="button" onClick={onOpenShareMenu}>
              <Share2 size={17} /> Compartir producto
            </button>
            <button className="primary" type="button" disabled={soldOut} onClick={() => onAdd(detailQuantity)}>
              <ShoppingCart size={18} /> Agregar al carrito
            </button>
          </div>
        </div>
      </section>
    </div>,
    document.body,
  );
}

function ProductShareMenu({ product, onClose, onShareImage, onWhatsapp, onSaveImage, onCopy }) {
  const [preparedShareImage, setPreparedShareImage] = useState(null);
  const [imageState, setImageState] = useState("Preparando imagen...");

  useEffect(() => {
    let alive = true;
    shareProductImageFile(product, productName(product)).then((file) => {
      if (!alive) return;
      setPreparedShareImage(file);
      setImageState(file ? "Imagen lista para compartir." : "Tu app puede usar texto, enlace o guardar imagen.");
    });
    return () => {
      alive = false;
    };
  }, [product.id]);

  return createPortal(
    <div className="modal-backdrop store-share-menu-backdrop" onMouseDown={onClose}>
      <section className="store-share-menu" onMouseDown={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-label="Compartir producto">
        <header>
          <span>
            <strong>Compartir producto</strong>
            <small>{productName(product)}</small>
          </span>
          <button className="icon-btn" type="button" onClick={onClose} aria-label="Cerrar"><X size={18} /></button>
        </header>
        <img src={productMainImage(product)} alt="" />
        <small>{imageState}</small>
        <button className="primary" type="button" onClick={() => onShareImage(preparedShareImage)}>
          <Share2 size={17} /> Compartir imagen y producto
        </button>
        <button className="ghost" type="button" onClick={onWhatsapp}>Compartir por WhatsApp</button>
        <button className="ghost" type="button" onClick={() => onSaveImage(preparedShareImage)}>
          <Download size={17} /> Guardar imagen
        </button>
        <button className="ghost" type="button" onClick={onCopy}>
          <Copy size={17} /> Copiar enlace
        </button>
      </section>
    </div>,
    document.body,
  );
}

function ProductImageViewer({ product, index, onClose }) {
  const images = productDetailImages(product);
  const safeIndex = Math.min(Math.max(index, 0), Math.max(images.length - 1, 0));

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  return createPortal(
    <div className="store-image-lightbox" role="dialog" aria-modal="true" aria-label={`Imagen ampliada de ${productName(product)}`} onMouseDown={onClose}>
      <section className="store-image-viewer" onMouseDown={(event) => event.stopPropagation()}>
        <button className="icon-btn store-image-viewer-close" type="button" onClick={onClose} aria-label="Cerrar imagen">
          <X size={24} />
        </button>
        <img src={images[safeIndex]} alt={productName(product)} />
      </section>
    </div>,
    document.body,
  );
}

function StoreSkeletonGrid() {
  return (
    <div className="store-grid" aria-label="Cargando productos">
      {[0, 1, 2, 3].map((item) => (
        <article className="store-card store-skeleton" key={item}>
          <span />
          <div><i /><i /><i /></div>
        </article>
      ))}
    </div>
  );
}

function StoreCheckoutModal({
  step,
  setStep,
  cartItems,
  total,
  allPriced,
  buyer,
  setBuyer,
  rememberBuyer,
  setRememberBuyer,
  saving,
  onClose,
  onConfirm,
  onChangeQuantity,
}) {
  const itemCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  function setBuyerField(key, value) {
    setBuyer((old) => ({ ...old, [key]: value }));
  }

  return (
    <div className="modal-backdrop">
      <section className="checkout-modal" aria-label="Finalizar pedido">
        <header className="checkout-head">
          <span>
            <small>Paso {step} de 3</small>
            <strong>{step === 1 ? "Revisar pedido" : step === 2 ? "Datos de entrega" : "Confirmar por WhatsApp"}</strong>
          </span>
          <button className="icon-btn" type="button" onClick={onClose} aria-label="Cerrar"><X size={18} /></button>
        </header>

        <div className="checkout-steps" aria-hidden="true">
          {[1, 2, 3].map((item) => <span key={item} className={item <= step ? "active" : ""} />)}
        </div>

        {step === 1 ? (
          <div className="checkout-panel">
            {cartItems.map(({ product, quantity }) => (
              <article className="cart-line" key={product.id}>
                <img src={product.imagen || "/icono_conocimiento.webp"} alt="" />
                <span>
                  <strong>{productName(product)}</strong>
                  <small>{productHasPrice(product) ? formatMoney(productPrice(product)) : "Precio a confirmar"}</small>
                </span>
                <div className="quantity-control compact">
                  <button type="button" onClick={() => onChangeQuantity(product, -1)}><Minus size={15} /></button>
                  <span>{quantity}</span>
                  <button type="button" onClick={() => onChangeQuantity(product, 1)}><Plus size={15} /></button>
                </div>
              </article>
            ))}
          </div>
        ) : null}

        {step === 2 ? (
          <form className="checkout-form">
            <label>Nombre y apellido<input value={buyer.nombre} onChange={(event) => setBuyerField("nombre", event.target.value)} /></label>
            <label>Correo electrónico<input type="email" value={buyer.email} onChange={(event) => setBuyerField("email", event.target.value)} /></label>
            <label>Teléfono<input inputMode="tel" value={buyer.telefono} onChange={(event) => setBuyerField("telefono", event.target.value)} /></label>
            <label>Dirección de entrega<input value={buyer.domicilio} onChange={(event) => setBuyerField("domicilio", event.target.value)} /></label>
            <label>Localidad<input value={buyer.localidad} onChange={(event) => setBuyerField("localidad", event.target.value)} /></label>
            <label>Provincia<input value={buyer.provincia} onChange={(event) => setBuyerField("provincia", event.target.value)} /></label>
            <label>Código postal<input inputMode="numeric" value={buyer.codigo_postal} onChange={(event) => setBuyerField("codigo_postal", event.target.value)} /></label>
            <label>Observaciones<textarea value={buyer.observaciones} onChange={(event) => setBuyerField("observaciones", event.target.value)} placeholder="Horario, referencias o detalles de entrega." /></label>
            <label className="check-row checkout-remember">
              <input type="checkbox" checked={rememberBuyer} onChange={(event) => setRememberBuyer(event.target.checked)} />
              Recordar estos datos en este dispositivo
            </label>
          </form>
        ) : null}

        {step === 3 ? (
          <div className="checkout-panel checkout-final">
            <div className="checkout-total">
              <span>
                <strong>{itemCount} producto{itemCount === 1 ? "" : "s"}</strong>
                <small>{allPriced ? formatMoney(total) : "Precio a confirmar"}</small>
              </span>
            </div>
            <dl>
              <div><dt>Comprador</dt><dd>{buyer.nombre}</dd></div>
              <div><dt>Correo</dt><dd>{buyer.email}</dd></div>
              <div><dt>Teléfono</dt><dd>{buyer.telefono}</dd></div>
              <div><dt>Entrega</dt><dd>{buyer.domicilio}, {buyer.localidad}, {buyer.provincia} ({buyer.codigo_postal})</dd></div>
              {buyer.observaciones ? <div><dt>Observaciones</dt><dd>{buyer.observaciones}</dd></div> : null}
            </dl>
            <p>Al confirmar se guardará el pedido y se abrirá WhatsApp para solicitar disponibilidad, total y forma de entrega.</p>
          </div>
        ) : null}

        <footer className="checkout-actions">
          <button className="ghost compact" type="button" onClick={step === 1 ? onClose : () => setStep(step - 1)}>
            {step === 1 ? "Volver a la tienda" : "Atrás"}
          </button>
          {step < 3 ? (
            <button className="primary" type="button" onClick={() => setStep(step + 1)} disabled={!cartItems.length}>
              Continuar
            </button>
          ) : (
            <button className="primary" type="button" onClick={onConfirm} disabled={saving}>
              <Send size={17} /> {saving ? "Guardando..." : "Confirmar por WhatsApp"}
            </button>
          )}
        </footer>
      </section>
    </div>
  );
}

function StoreSocialLinks({ links }) {
  const items = storeSocialItems(links);
  if (!items.length) return null;
  return (
    <div className="store-social-links" aria-label="Redes sociales de la tienda">
      {items.map(({ id, label, url }) => (
        <a key={id} className={`store-social-link ${id}`} href={url} target="_blank" rel="noopener noreferrer" aria-label={label} title={label}>
          <StoreSocialIcon id={id} />
          <span className="sr-only">{label}</span>
        </a>
      ))}
    </div>
  );
}

function StoreSocialIcon({ id }) {
  if (id === "instagram") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <defs>
          <linearGradient id="instagramGradient" x1="3" x2="21" y1="21" y2="3">
            <stop offset="0" stopColor="#feda75" />
            <stop offset="0.28" stopColor="#fa7e1e" />
            <stop offset="0.52" stopColor="#d62976" />
            <stop offset="0.76" stopColor="#962fbf" />
            <stop offset="1" stopColor="#4f5bd5" />
          </linearGradient>
        </defs>
        <rect width="18" height="18" x="3" y="3" rx="5" fill="url(#instagramGradient)" />
        <circle cx="12" cy="12" r="4" fill="none" stroke="#fff" strokeWidth="1.8" />
        <circle cx="17.2" cy="6.8" r="1.15" fill="#fff" />
      </svg>
    );
  }
  if (id === "facebook") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="10" fill="#1877f2" />
        <path fill="#fff" d="M13.3 18v-5.2h1.8l.3-2h-2.1V9.4c0-.6.2-1 1-1h1.2V6.6c-.2 0-1-.1-1.8-.1-1.8 0-3 1.1-3 3.1v1.2H8.8v2h1.9V18h2.6Z" />
      </svg>
    );
  }
  if (id === "youtube") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect width="20" height="14" x="2" y="5" rx="4" fill="#ff0000" />
        <path fill="#fff" d="m10 9 5.2 3L10 15V9Z" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="10" fill="#25d366" />
      <path fill="#fff" d="M8.4 17.1 9 14.9a5.7 5.7 0 1 1 2.2 1.9l-2.8.3Zm2.9-2.2.2.1a4 4 0 1 0-1.6-1.5l.1.2-.3 1.1 1.6-.2Z" />
      <path fill="#fff" d="M14.4 13.2c-.2-.1-1-.5-1.2-.6-.2-.1-.3-.1-.4.1l-.5.6c-.1.1-.2.2-.4.1-.2-.1-.8-.3-1.4-.9-.5-.5-.9-1.1-1-1.3-.1-.2 0-.3.1-.4l.3-.4c.1-.1.1-.2.2-.3v-.3c0-.1-.4-1-.6-1.4-.2-.4-.3-.3-.4-.3h-.4c-.1 0-.3.1-.5.2-.2.2-.7.7-.7 1.7s.7 1.9.8 2c.1.2 1.4 2.2 3.4 3 .5.2.9.3 1.2.4.5.2 1 .1 1.3.1.4-.1 1-.4 1.2-.8.1-.4.1-.8.1-.8-.1-.1-.2-.1-.4-.2Z" />
    </svg>
  );
}
function StoreFloatingCart({ cartCount, total, allPriced, pulse, onClick }) {
  return createPortal(
    <button
      className={`store-floating-cart ${pulse ? "pulse" : ""}`}
      type="button"
      onClick={onClick}
      aria-label={`Carrito con ${cartCount} unidades`}
    >
      <span aria-hidden="true">&#128722;</span>
      {cartCount ? <b>{cartCount}</b> : null}
      {cartCount ? <small>{allPriced ? formatMoney(total) : "A confirmar"}</small> : null}
    </button>,
    document.body,
  );
}

function StoreAdminPreview({ products, settings }) {
  const previewProducts = products.slice(0, 4);
  return (
    <div className="store-admin-preview">
      <section className="store-welcome store-preview-welcome">
        <span>Tienda</span>
        <h2>Bienvenido a este espacio de objetos sagrados</h2>
        <p>Elegí con calma. Al finalizar, recibo tu pedido por WhatsApp y luego te envío el link de pago o los datos de transferencia.</p>
        <StoreSocialLinks links={settings} />
      </section>
      <div className="store-grid store-preview-grid">
        {previewProducts.map((product) => (
          <article className="store-card" key={product.id}>
            <button className="store-card-image" type="button">
              <img src={productMainImage(product)} alt={productName(product)} loading="lazy" />
              {productVideoInfo(product).url ? <span className="store-video-badge">&#127916; Video</span> : null}
            </button>
            <span className="store-card-info">
              <h3>{productName(product)}</h3>
              <strong>{productHasPrice(product) ? formatMoney(productPrice(product)) : "Precio a confirmar"}</strong>
              <small>{productCardBadge(product)}</small>
            </span>
          </article>
        ))}
      </div>
      {!previewProducts.length ? <p className="empty-state">Todavía no hay productos activos para previsualizar.</p> : null}
    </div>
  );
}

function StoreSettingsForm({ draft, setDraft, saving, onSubmit, onUploadBackground, uploadingBackground }) {
  function setField(field, value) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  return (
    <form className="store-social-admin" onSubmit={onSubmit}>
      <strong>Configuración de tienda</strong>
      <label>Instagram<input value={draft.instagram} onChange={(event) => setField("instagram", event.target.value)} placeholder="https://instagram.com/..." /></label>
      <label>YouTube<input value={draft.youtube} onChange={(event) => setField("youtube", event.target.value)} placeholder="https://youtube.com/..." /></label>
      <label>Facebook<input value={draft.facebook} onChange={(event) => setField("facebook", event.target.value)} placeholder="https://facebook.com/..." /></label>
      <label>WhatsApp<input value={draft.whatsapp} onChange={(event) => setField("whatsapp", event.target.value)} placeholder="https://wa.me/... o teléfono" /></label>
      <label>Color base del fondo<div className="store-background-color-field"><input type="color" value={draft.backgroundColor || "#fff8e7"} onChange={(event) => setField("backgroundColor", event.target.value)} /><button className="ghost compact" type="button" onClick={() => setField("backgroundColor", "")}>Default</button></div></label>
      <label>Fondo de la tienda<input value={draft.backgroundUrl} onChange={(event) => setField("backgroundUrl", event.target.value)} placeholder="Link de imagen para estación o festividad" /></label>
      <label>Subir o reemplazar fondo<input type="file" accept="image/png,image/jpeg,image/webp" onChange={onUploadBackground} /></label>
      {draft.backgroundUrl ? <figure className="settings-image-preview store-background-preview"><img src={draft.backgroundUrl} alt="" /><figcaption>{uploadingBackground ? "Subiendo fondo..." : draft.backgroundFileName || "Fondo actual de tienda"}</figcaption></figure> : null}
      <label>Capa crema sobre el fondo
        <input type="range" min="0.18" max="0.78" step="0.02" value={draft.backgroundOverlay} onChange={(event) => setField("backgroundOverlay", event.target.value)} />
        <small>Vista previa en vivo: {Math.round(Number(draft.backgroundOverlay || 0) * 100)}% de capa crema.</small>
      </label>
      <div
        className="store-background-live-preview"
        style={{
          "--store-preview-color": draft.backgroundColor || "#fff8e7",
          "--store-preview-image": draft.backgroundUrl ? `url("${cssUrl(draft.backgroundUrl)}")` : "none",
          "--store-preview-overlay": draft.backgroundOverlay,
        }}
        aria-hidden="true"
      >
        <span>Vista previa del fondo</span>
      </div>
      <button className="primary small" disabled={saving}>{saving ? "Guardando..." : "Guardar configuración"}</button>
    </form>
  );
}

function StoreCheckoutModalV2({
  step,
  setStep,
  cartItems,
  total,
  allPriced,
  buyer,
  setBuyer,
  rememberBuyer,
  setRememberBuyer,
  saving,
  onClose,
  onConfirm,
  onChangeQuantity,
  onRemove,
  onClear,
  errors = {},
  setErrors,
  orderSentPrompt,
  onKeepCart,
  onConfirmSent,
}) {
  const itemCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  function setBuyerField(key, value) {
    setBuyer((old) => ({ ...old, [key]: value }));
    setErrors?.((old) => {
      if (!old[key]) return old;
      const next = { ...old };
      delete next[key];
      return next;
    });
  }

  function goNext() {
    if (step === 2) {
      const nextErrors = validateStoreBuyer(buyer);
      if (Object.keys(nextErrors).length) {
        setErrors?.(nextErrors);
        return;
      }
    }
    setStep(step + 1);
  }

  return createPortal(
    <div className="modal-backdrop store-checkout-backdrop">
      <section className="checkout-modal" aria-label="Finalizar pedido">
        <header className="checkout-head">
          <span>
            <small>Paso {step} de 3</small>
            <strong>{step === 1 ? "Carrito" : step === 2 ? "Datos del pedido" : "Enviar por WhatsApp"}</strong>
          </span>
          <button className="icon-btn" type="button" onClick={onClose} aria-label="Cerrar"><X size={18} /></button>
        </header>

        <div className="checkout-steps" aria-hidden="true">
          {[1, 2, 3].map((item) => <span key={item} className={item <= step ? "active" : ""} />)}
        </div>

        {step === 1 ? (
          <div className="checkout-panel">
            {cartItems.length ? cartItems.map(({ product, quantity }) => {
              const price = productPrice(product);
              const subtotal = price * quantity;
              return (
                <article className="cart-line cart-line-complete" key={product.id}>
                  <img src={productMainImage(product)} alt={productName(product)} loading="lazy" />
                  <span>
                    <strong>{productName(product)}</strong>
                    <small>Unitario: {productHasPrice(product) ? formatMoney(price) : "Precio a confirmar"}</small>
                    <em>Subtotal: {productHasPrice(product) ? formatMoney(subtotal) : "Precio a confirmar"}</em>
                  </span>
                  <div className="quantity-control compact">
                    <button type="button" onClick={() => onChangeQuantity(product, -1)} aria-label={`Quitar ${productName(product)}`}><Minus size={15} /></button>
                    <span>{quantity}</span>
                    <button type="button" onClick={() => onChangeQuantity(product, 1)} aria-label={`Agregar ${productName(product)}`}><Plus size={15} /></button>
                  </div>
                  <button className="cart-remove-button" type="button" onClick={() => onRemove(product)} aria-label={`Eliminar ${productName(product)}`}>
                    <Trash2 size={16} />
                    Borrar
                  </button>
                </article>
              );
            }) : (
              <div className="cart-empty-state">
                <ShoppingCart size={38} />
                <strong>Tu carrito está esperando algo especial</strong>
                <button className="primary small" type="button" onClick={onClose}>Volver a la tienda</button>
              </div>
            )}
            <CartTotals itemCount={itemCount} total={total} allPriced={allPriced} />
            {cartItems.length ? <button className="ghost compact" type="button" onClick={onClear}>Vaciar carrito</button> : null}
          </div>
        ) : null}

        {step === 2 ? (
          <form className="checkout-form">
            <label>Nombre y apellido<input value={buyer.nombre} onChange={(event) => setBuyerField("nombre", event.target.value)} />{errors.nombre ? <small className="field-error">{errors.nombre}</small> : null}</label>
            <label>Teléfono<input inputMode="tel" value={buyer.telefono} onChange={(event) => setBuyerField("telefono", event.target.value)} />{errors.telefono ? <small className="field-error">{errors.telefono}</small> : null}</label>
            <label>Localidad<input value={buyer.localidad} onChange={(event) => setBuyerField("localidad", event.target.value)} />{errors.localidad ? <small className="field-error">{errors.localidad}</small> : null}</label>
            <label>Entrega
              <select value={buyer.entrega} onChange={(event) => setBuyerField("entrega", event.target.value)}>
                <option>A coordinar</option>
                <option>Retiro</option>
                <option>Envío</option>
              </select>
            </label>
            <label>Correo electrónico<input type="email" value={buyer.email} onChange={(event) => setBuyerField("email", event.target.value)} /></label>
            <label>Dirección de entrega<input value={buyer.domicilio} onChange={(event) => setBuyerField("domicilio", event.target.value)} /></label>
            <label>Provincia<input value={buyer.provincia} onChange={(event) => setBuyerField("provincia", event.target.value)} /></label>
            <label>Código postal<input inputMode="numeric" value={buyer.codigo_postal} onChange={(event) => setBuyerField("codigo_postal", event.target.value)} /></label>
            <label>Observaciones<textarea value={buyer.observaciones} onChange={(event) => setBuyerField("observaciones", event.target.value)} placeholder="Horario, referencias o detalles de entrega." /></label>
            <label className="check-row checkout-remember">
              <input type="checkbox" checked={rememberBuyer} onChange={(event) => setRememberBuyer(event.target.checked)} />
              Recordar estos datos en este dispositivo
            </label>
          </form>
        ) : null}

        {step === 3 ? (
          <div className="checkout-panel checkout-final">
            <CartTotals itemCount={itemCount} total={total} allPriced={allPriced} />
            <dl>
              <div><dt>Comprador</dt><dd>{buyer.nombre}</dd></div>
              {buyer.email ? <div><dt>Correo</dt><dd>{buyer.email}</dd></div> : null}
              <div><dt>Teléfono</dt><dd>{buyer.telefono}</dd></div>
              <div><dt>Localidad</dt><dd>{buyer.localidad}</dd></div>
              <div><dt>Entrega</dt><dd>{buyer.entrega || "A coordinar"}</dd></div>
              {buyer.observaciones ? <div><dt>Observaciones</dt><dd>{buyer.observaciones}</dd></div> : null}
            </dl>
            <p>Al enviar se guardará el pedido y se abrirá WhatsApp con el detalle completo.</p>
            {orderSentPrompt ? (
              <div className="whatsapp-sent-panel">
                <strong>¿El pedido fue enviado?</strong>
                <div>
                  <button className="primary small" type="button" onClick={onConfirmSent}>Vaciar carrito</button>
                  <button className="ghost compact" type="button" onClick={onKeepCart}>Mantener carrito</button>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        <footer className="checkout-actions">
          <button className="ghost compact" type="button" onClick={step === 1 ? onClose : () => setStep(step - 1)}>
            {step === 1 ? "Volver a la tienda" : "Atrás"}
          </button>
          {step < 3 ? (
            <button className="primary" type="button" onClick={goNext} disabled={!cartItems.length}>
              Continuar
            </button>
          ) : (
            <button className="whatsapp-button" type="button" onClick={onConfirm} disabled={saving || orderSentPrompt}>
              <Send size={17} /> {saving ? "Guardando..." : "Enviar pedido por WhatsApp"}
            </button>
          )}
        </footer>
      </section>
    </div>,
    document.body,
  );
}

function CartTotals({ itemCount, total, allPriced }) {
  return (
    <div className="checkout-total">
      <span>
        <strong>Total de productos</strong>
        <small>{itemCount} unidad{itemCount === 1 ? "" : "es"}</small>
      </span>
      <span>
        <strong>Subtotal</strong>
        <small>{allPriced ? formatMoney(total) : "Precio a confirmar"}</small>
      </span>
      <span>
        <strong>Envío</strong>
        <small>A coordinar</small>
      </span>
      <span>
        <strong>Total</strong>
        <small>{allPriced ? formatMoney(total) : "Precio a confirmar"}</small>
      </span>
    </div>
  );
}

function Biblioteca({ profile, onBack, onToast, onShare }) {
  const [books, setBooks] = useState([]);
  const [query, setQuery] = useState("");
  const [pdfViewer, setPdfViewer] = useState(null);
  const [epubViewer, setEpubViewer] = useState(null);

  useEffect(() => {
    loadList("biblioteca").then(setBooks);
  }, []);

  useEffect(() => {
    if (query.trim().length < 3) return undefined;
    const timer = window.setTimeout(() => trackSearch(query, "biblioteca"), 900);
    return () => window.clearTimeout(timer);
  }, [query]);

  const filtered = books.filter((book) => (book.titulo || "").toLowerCase().includes(query.toLowerCase()));

  return (
    <section className="content-page">
      <PageTitle icon={BookOpen} title="Biblioteca" subtitle={sectionSubtitle("biblioteca")} onBack={onBack} />
      <input className="search" placeholder="Buscar libros..." value={query} onChange={(e) => setQuery(e.target.value)} />
      <div className="book-grid">
        {filtered.map((book) => (
          <article className="book-card" key={book.id}>
            <img src={book.portada_url || book.imagen || "/icono_biblioteca.webp"} alt="" />
            <div>
              <h3>{book.titulo}</h3>
              <p>{book.categoria || "Sin categoria"}</p>
              {contentAccessType(book) !== "gratis" ? <span className="access-badge">{accessLabel(book)}</span> : null}
              {book.pdf_url || book.pdf ? (
                <button
                  className="primary small"
                  onClick={() => {
                    if (!canOpenPaidContent(profile, book)) {
                      onToast?.(accessToast(book));
                      openAccessWhatsApp(profile, "biblioteca", book);
                      return;
                    }
                    trackContentOpen("biblioteca", book);
                    setPdfViewer({ title: book.titulo || "Libro", url: book.pdf_url || book.pdf });
                  }}
                >
                  <BookOpen size={16} /> {contentAccessType(book) === "compra" ? "Comprar" : contentAccessType(book) === "suscripcion" ? "Solicitar" : "Leer"}
                </button>
              ) : null}
              {book.epub_url || book.epub ? (
                <button
                  className="primary small"
                  type="button"
                  onClick={() => {
                    if (!canOpenPaidContent(profile, book)) {
                      onToast?.(accessToast(book));
                      openAccessWhatsApp(profile, "biblioteca", book);
                      return;
                    }
                    trackContentOpen("biblioteca", book);
                    setEpubViewer({
                      title: book.titulo || "Libro",
                      author: book.autor || "",
                      url: book.epub_url || book.epub,
                      path: book.epub_path || "",
                      chapters: book.epub_chapters || [],
                      epubTitle: book.epub_title || "",
                    });
                  }}
                >
                  <BookOpen size={16} /> Leer EPUB
                </button>
              ) : null}
              <button className="ghost compact share-content-button" type="button" onClick={() => onShare?.("biblioteca", book)}>
                <Share2 size={15} /> Compartir
              </button>
            </div>
          </article>
        ))}
      </div>
      {pdfViewer ? <PdfModal viewer={pdfViewer} onClose={() => setPdfViewer(null)} /> : null}
      {epubViewer ? (
        <Suspense fallback={<div className="modal-backdrop"><div className="reader-loading">Preparando lector EPUB...</div></div>}>
          <EpubReader viewer={epubViewer} onClose={() => setEpubViewer(null)} />
        </Suspense>
      ) : null}
    </section>
  );
}

function PdfModal({ viewer, onClose }) {
  const url = viewer.url;
  const viewerUrl = pdfViewerUrl(url);
  return (
    <div className="modal-backdrop">
      <div className="pdf-modal">
        <header>
          <button className="back-icon" onClick={onClose} aria-label="Cerrar">
            <ArrowLeft size={22} />
          </button>
          <strong>{viewer.title}</strong>
          <a className="icon-btn" href={downloadUrl(url, `${viewer.title || "libro"}.pdf`)} title="Descargar">
            <Download size={18} />
          </a>
        </header>
        <iframe title={viewer.title} src={viewerUrl} />
        <div className="pdf-fallback">
          <span>Si el PDF no aparece, usa descargar.</span>
          <a className="primary small" href={downloadUrl(url, `${viewer.title || "libro"}.pdf`)}>
            <Download size={16} /> Descargar PDF
          </a>
        </div>
      </div>
    </div>
  );
}

function Contenido({ coleccion, titulo, user, profile, onBack, onToast, onSubscribe, onShare }) {
  const [items, setItems] = useState([]);
  const [social, setSocial] = useState({});
  const [selected, setSelected] = useState(null);
  const [selectedCourse, setSelectedCourse] = useState(null);

  useEffect(() => {
    loadList(coleccion).then((nextItems) => {
      setItems(nextItems);
      if (coleccion === "satsang") loadSatsangSocial(nextItems).then(setSocial);
    });
  }, [coleccion]);

  useEffect(() => {
    const closeDetail = () => {
      setSelected(null);
      setSelectedCourse(null);
    };
    window.addEventListener("popstate", closeDetail);
    return () => window.removeEventListener("popstate", closeDetail);
  }, []);

  const isCourseCollection = ["conocimiento", "ejercicios"].includes(coleccion);
  const freeId = items[0]?.id;

  function openDetail(item) {
    trackContentOpen(coleccion, item);
    window.history.pushState({ detail: item.id }, "", `#${coleccion}/${item.id}`);
    setSelected(item);
  }

  function openCourse(tag) {
    trackEvent("open_course", {
      contentType: coleccion,
      contentId: tag,
      contentTitle: tag,
      contentCategory: titulo,
    });
    window.history.pushState({ course: tag }, "", `#${coleccion}/${encodeURIComponent(tag)}`);
    setSelectedCourse(tag);
  }

  if (selected) {
    if (coleccion === "satsang") {
      return <SatsangDetail item={selected} user={user} profile={profile} onBack={() => window.history.back()} onShare={() => onShare?.("satsang", selected)} />;
    }

    return (
      <DetalleModulo
        modulo={selected}
        titulo={titulo}
        coleccion={coleccion}
        profile={profile}
        showSubscribe={false}
        onBack={() => window.history.back()}
        onToast={onToast}
        onSubscribe={onSubscribe}
        onShare={() => onShare?.(coleccion, selected)}
      />
    );
  }

  const groups = coleccion === "satsang" ? { Satsang: items } : groupBy(items, "etiqueta");

  if (isCourseCollection && selectedCourse) {
    const modules = sortCourseModules(groups[selectedCourse] || []);
    return (
      <CourseDetail
        coleccion={coleccion}
        titulo={titulo}
        tag={selectedCourse}
        modules={modules}
        profile={profile}
        onBack={() => window.history.back()}
        onOpenModule={openDetail}
        onSubscribe={() => onSubscribe?.(coleccion)}
        onShare={(item) => onShare?.(coleccion, item)}
      />
    );
  }

  if (coleccion === "satsang") {
    return (
      <section className="content-page">
        <PageTitle icon={Heart} iconSrc="/satsang.webp" title="Satsang" subtitle={sectionSubtitle("satsang")} onBack={onBack} />
        <div className="blog-list">
          {items.length === 0 ? <p className="empty-state">Aun no hay encuentros compartidos.</p> : null}
          {items.map((item) => {
            const stats = social[item.id] || { likes: 0, comments: 0, lastComment: "" };
            const embed = satsangVideoEmbed(item);
            const description = satsangDescriptionText(item.descripcion);
            return (
              <article className="post-card" key={item.id}>
                {item.imagen ? <img src={item.imagen} alt="" /> : null}
                {embed ? (
                  <div className="video-frame satsang-card-video">
                    <iframe
                      title={contentTitle(item)}
                      src={embed}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                ) : null}
                <span>
                  <strong>{contentTitle(item)}</strong>
                  <small>Satsang</small>
                  {description ? <p>{summary(description, 130)}</p> : null}
                  <span className="post-meta">
                    <span><Heart size={15} /> {stats.likes}</span>
                    <span><MessageCircle size={15} /> {stats.comments}</span>
                  </span>
                  {stats.lastComment ? <em>Ultima reflexion: {summary(stats.lastComment, 70)}</em> : null}
                </span>
                <button className="ghost compact" type="button" onClick={() => openDetail(item)}>
                  Ver encuentro
                </button>
              </article>
            );
          })}
        </div>
      </section>
    );
  }

  if (isCourseCollection) {
    return (
      <section className="content-page">
        <PageTitle icon={sectionIcon(coleccion)} iconSrc={sectionIconSrc(coleccion)} title={titulo} subtitle={sectionSubtitle(coleccion)} onBack={onBack} />
        <div className="course-grid">
          {Object.entries(groups).map(([tag, modules]) => {
            const sortedModules = sortCourseModules(modules);
            const first = sortedModules[0] || {};
            const courseOpen = isCourseOpen(sortedModules);
            const paidCount = Math.max(0, sortedModules.length - 1);
            const price = coursePrice(sortedModules);
            return (
              <button className="course-card" type="button" key={tag} onClick={() => openCourse(tag)}>
                <span className="course-card-media">
                  <img src={first.imagen || sectionFallbackImage(coleccion)} alt="" />
                  {coleccion === "conocimiento" && price > 0 ? (
                    <b className="course-price-badge">{formatCourseMoney(price)}</b>
                  ) : null}
                </span>
                <span>
                  <small>{courseOpen ? "Acceso libre" : "Primer video gratis"}</small>
                  <strong>{tag}</strong>
                  <p>{summary(first.descripcion || `${sortedModules.length} clases para practicar paso a paso.`, 120)}</p>
                  <em>{sortedModules.length} clases - {courseOpen ? "todo abierto" : `${paidCount} por suscripcion`}</em>
                </span>
              </button>
            );
          })}
        </div>
      </section>
    );
  }

  return (
    <section className="content-page">
      <PageTitle icon={sectionIcon(coleccion)} iconSrc={sectionIconSrc(coleccion)} title={titulo} subtitle={sectionSubtitle(coleccion)} onBack={onBack} />
      {Object.entries(groups).map(([tag, modules]) => (
        <div className="group" key={tag}>
          <h2>{tag}</h2>
          <div className="list">
            {modules.map((item) => {
              const locked = !hasContentAccess(profile, coleccion, item, freeId);
              const stats = social[item.id] || { likes: 0, comments: 0, lastComment: "" };
              return (
                <button
                  className={`row-card ${locked ? "locked" : ""}`}
                  key={item.id}
                  onClick={() => {
                    if (locked) {
                      onToast?.("Este modulo se abre con acceso activo.");
                      return;
                    }
                    openDetail(item);
                  }}
                >
                  <img src={item.imagen || sectionFallbackImage(coleccion)} alt="" />
                  <span>
                    <strong>{contentTitle(item)}</strong>
                    <small>{item.descripcion}</small>
                    {coleccion === "satsang" ? (
                      <small className="row-meta">
                        <span><MessageCircle size={14} /> {stats.comments}</span>
                        <span><Heart size={14} /> {stats.likes}</span>
                      </small>
                    ) : null}
                  </span>
                  {locked ? <span className="lock-badge"><Lock size={18} /></span> : <Video size={22} />}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </section>
  );
}

function DetalleModulo({ modulo, titulo, coleccion, profile, showSubscribe, onBack, onToast, onSubscribe, onShare }) {
  const [epubViewer, setEpubViewer] = useState(null);
  const videoRef = useRef(null);
  const embed = youtubeEmbedUrl(modulo.video);
  const itemTitle = contentTitle(modulo);
  const epubUrl = modulo.epub_url || modulo.epub;
  const pdfUrl = modulo.pdf_url || modulo.pdf;

  function openEpub() {
    trackContentOpen("biblioteca", modulo, { contentTitle: itemTitle, contentCategory: coleccion });
    setEpubViewer({
      title: itemTitle || "Material",
      author: modulo.autor || "",
      url: epubUrl,
      path: modulo.epub_path || "",
      chapters: modulo.epub_chapters || [],
      epubTitle: modulo.epub_title || "",
    });
  }

  useEffect(() => {
    if (embed) trackContentOpen("video", modulo, { contentCategory: coleccion });
  }, [modulo.id, embed]);

  return (
    <section className="content-page">
      <PageTitle icon={sectionIcon(coleccion)} iconSrc={sectionIconSrc(coleccion)} title={titulo} subtitle={sectionSubtitle(coleccion)} onBack={onBack} />
      <article className="detail">
        <img className="detail-cover" src={modulo.imagen || sectionFallbackImage(coleccion)} alt="" />
        <h1>{itemTitle}</h1>
        {embed ? (
          <div className="video-frame" ref={videoRef}>
            <iframe
              title={itemTitle}
              src={embed}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        ) : null}
        <p>{modulo.descripcion}</p>
        <button className="ghost compact share-content-button" type="button" onClick={onShare}>
          <Share2 size={15} /> Compartir
        </button>
        {showSubscribe ? (
          <div className="subscribe-panel">
            <strong>Quieres abrir el resto del camino?</strong>
            <small>Completa tu perfil y enviamos tu solicitud por WhatsApp.</small>
            <button className="primary" onClick={() => onSubscribe?.(coleccion)}>
              <MessageCircle size={18} /> Solicitar acceso
            </button>
          </div>
        ) : null}
        <MaterialActions
          title={itemTitle}
          video={embed ? () => videoRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }) : null}
          pdf={pdfUrl}
          epub={epubUrl ? openEpub : null}
        />
      </article>
      {epubViewer ? (
        <Suspense fallback={<div className="modal-backdrop"><div className="reader-loading">Preparando lector EPUB...</div></div>}>
          <EpubReader viewer={epubViewer} onClose={() => setEpubViewer(null)} />
        </Suspense>
      ) : null}
    </section>
  );
}

function CourseDetail({ coleccion, titulo, tag, modules, profile, onBack, onOpenModule, onSubscribe, onShare }) {
  const [epubViewer, setEpubViewer] = useState(null);
  const [activeModuleId, setActiveModuleId] = useState(modules[0]?.id || "");
  const videoRef = useRef(null);
  const freeModule = modules[0];
  const courseOpen = isCourseOpen(modules);
  const activeModule = modules.find((item) => item.id === activeModuleId) || freeModule;
  const activeEmbed = youtubeEmbedUrl(activeModule?.video);
  const activeEpubUrl = activeModule?.epub_url || activeModule?.epub;
  const activePdfUrl = activeModule?.pdf_url || activeModule?.pdf;
  const activeTitle = contentTitle(activeModule);

  useEffect(() => {
    setActiveModuleId((currentId) => (modules.some((item) => item.id === currentId) ? currentId : modules[0]?.id || ""));
  }, [modules]);

  useEffect(() => {
    if (activeModule && activeEmbed) trackContentOpen("video", activeModule, { contentCategory: tag });
  }, [activeModule?.id, activeEmbed, tag]);

  function openEpub(item) {
    const itemEpubUrl = item.epub_url || item.epub;
    if (!itemEpubUrl) return;
    trackContentOpen("biblioteca", item, { contentCategory: tag });
    setEpubViewer({
      title: contentTitle(item) || "Libro",
      author: item.autor || freeModule?.autor || "",
      url: itemEpubUrl,
      path: item.epub_path || "",
      chapters: item.epub_chapters || [],
      epubTitle: item.epub_title || "",
    });
  }

  return (
    <section className="content-page">
      <PageTitle icon={sectionIcon(coleccion)} iconSrc={sectionIconSrc(coleccion)} title={titulo} subtitle={tag} onBack={onBack} />
      <article className="course-detail">
        <div className="course-hero">
          <img className="course-cover" src={activeModule?.imagen || freeModule?.imagen || sectionFallbackImage(coleccion)} alt="" />
          <span>
            <small>{tag}</small>
            <h1>{activeTitle || tag}</h1>
            <p>{activeModule?.descripcion || freeModule?.descripcion}</p>
          </span>
        </div>
        <div className="course-active-content">
          {activeEmbed ? (
            <>
              <div className="video-frame" ref={videoRef}>
                <iframe
                  title={activeTitle}
                  src={activeEmbed}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
              <MaterialActions
                title={activeTitle}
                video={() => videoRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })}
                pdf={activePdfUrl}
                epub={activeEpubUrl ? () => openEpub(activeModule) : null}
              />
            </>
          ) : activeEpubUrl ? (
            <MaterialActions title={activeTitle} pdf={activePdfUrl} epub={() => openEpub(activeModule)} />
          ) : activePdfUrl ? (
            <MaterialActions title={activeTitle} pdf={activePdfUrl} />
          ) : (
            <p>{activeModule?.descripcion || "Selecciona una clase del curso."}</p>
          )}
        </div>
        <div className="course-list-head">
          <strong>Contenido del curso</strong>
          <small>{courseOpen ? "Este curso esta configurado como acceso libre." : "La primera clase esta abierta como muestra. Las siguientes se habilitan con suscripcion."}</small>
        </div>
        <div className="course-class-list">
          {modules.map((item, index) => {
            const free = isFreeCourseModule(item);
            const locked = !free && !courseOpen && !hasContentAccess(profile, coleccion, item);
            const itemEpubUrl = item.epub_url || item.epub;
            const itemPdfUrl = item.pdf_url || item.pdf;
            return (
              <button
                className={`course-class ${locked ? "locked" : ""} ${activeModule?.id === item.id ? "active" : ""}`}
                type="button"
                key={item.id}
                onClick={() => {
                  if (locked) {
                    onSubscribe?.();
                    return;
                  }
                  setActiveModuleId(item.id);
                  if (itemEpubUrl && !item.video) openEpub(item);
                }}
              >
                <span>{index + 1}</span>
                <strong>{contentTitle(item)}</strong>
                <small>{locked ? "Suscripcion" : free ? "Muestra gratis" : "Disponible"}</small>
                {locked ? (
                  <Lock size={17} />
                ) : (
                  <span className="course-class-materials">
                    {item.video ? <Video size={15} /> : null}
                    {itemPdfUrl ? <FileText size={15} /> : null}
                    {itemEpubUrl ? <BookOpen size={15} /> : null}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <button className="ghost compact share-content-button" type="button" onClick={() => onShare?.(activeModule || freeModule)}>
          <Share2 size={15} /> Compartir
        </button>
      </article>
      {epubViewer ? (
        <Suspense fallback={<div className="modal-backdrop"><div className="reader-loading">Preparando lector EPUB...</div></div>}>
          <EpubReader viewer={epubViewer} onClose={() => setEpubViewer(null)} />
        </Suspense>
      ) : null}
    </section>
  );
}

function MaterialActions({ title, video, pdf, epub }) {
  if (!video && !pdf && !epub) return null;
  return (
    <div className="material-actions">
      <strong>Materiales disponibles</strong>
      <div>
        {video ? (
          <button type="button" onClick={video}>
            <Video size={16} /> Video
          </button>
        ) : null}
        {pdf ? (
          <a href={downloadUrl(pdf, `${title || "material"}.pdf`)}>
            <FileText size={16} /> PDF
          </a>
        ) : null}
        {epub ? (
          <button type="button" onClick={epub}>
            <BookOpen size={16} /> EPUB
          </button>
        ) : null}
      </div>
    </div>
  );
}

function SatsangDetail({ item, user, profile, onBack, onShare }) {
  const [likes, setLikes] = useState({});
  const [comments, setComments] = useState([]);
  const [comment, setComment] = useState("");
  const itemTitle = contentTitle(item);
  const embed = satsangVideoEmbed(item);
  const description = satsangDescriptionText(item.descripcion);

  useEffect(() => {
    refreshSocial();
  }, [item.id]);

  async function refreshSocial() {
    const [likeSnap, commentSnap] = await Promise.all([
      get(ref(db, `satsang_likes/${item.id}`)),
      get(ref(db, `satsang_comentarios/${item.id}`)),
    ]);
    setLikes(likeSnap.val() || {});
    const value = commentSnap.val() || {};
    setComments(
      Object.entries(value)
        .map(([id, commentItem]) => ({ id, ...commentItem }))
        .sort((a, b) => (b.fecha || "").localeCompare(a.fecha || "")),
    );
  }

  async function toggleLike() {
    const likeRef = ref(db, `satsang_likes/${item.id}/${user.uid}`);
    if (likes[user.uid]) {
      await remove(likeRef);
    } else {
      await set(likeRef, true);
    }
    refreshSocial();
  }

  async function sendComment(event) {
    event.preventDefault();
    if (!cleanText(comment)) return;
    await push(ref(db, `satsang_comentarios/${item.id}`), {
      texto: cleanText(comment),
      usuario: publicUserName(profile, user),
      usuario_email: user.email || "",
      uid: user.uid,
      fecha: new Date().toISOString(),
    });
    setComment("");
    refreshSocial();
  }

  return (
    <section className="content-page">
      <PageTitle icon={Heart} iconSrc="/satsang.webp" title="Satsang" subtitle={sectionSubtitle("satsang")} onBack={onBack} />
      <article className="post-detail">
        {item.imagen ? <img src={item.imagen} alt="" /> : null}
        <h1>{itemTitle}</h1>
        {embed ? (
          <div className="video-frame">
            <iframe
              title={itemTitle}
              src={embed}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        ) : null}
        {description ? <p>{description}</p> : null}
        <button className="ghost compact share-content-button" type="button" onClick={onShare}>
          <Share2 size={15} /> Compartir
        </button>
        <button className={`like-button ${likes[user.uid] ? "active" : ""}`} type="button" onClick={toggleLike}>
          <Heart size={18} /> {Object.keys(likes).length}
        </button>
      </article>
      <form className="comment-form" onSubmit={sendComment}>
        <textarea value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Comparte una reflexion" />
        <button className="primary"><Send size={17} /> Compartir</button>
      </form>
      <div className="comments">
        <h2><MessageCircle size={18} /> Comentarios</h2>
        {comments.length === 0 ? <p>Aun no hay reflexiones compartidas.</p> : null}
        {comments.map((commentItem) => (
          <article className="comment" key={commentItem.id}>
            <strong>{commentDisplayName(commentItem)}</strong>
            <p>{commentItem.texto}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function Meditaciones({ user, profile, onBack, onToast, onShare }) {
  const [items, setItems] = useState([]);
  const [favorites, setFavorites] = useState({});
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    loadList("meditaciones").then(setItems);
  }, []);

  useEffect(() => {
    return onValue(ref(db, `meditacion_favoritos/${user.uid}`), (snap) => {
      setFavorites(snap.val() || {});
    });
  }, [user.uid]);

  useEffect(() => {
    const closeDetail = () => setSelected(null);
    window.addEventListener("popstate", closeDetail);
    return () => window.removeEventListener("popstate", closeDetail);
  }, []);

  function openMeditation(item) {
    if (!canOpenPaidContent(profile, item)) {
      onToast?.(accessToast(item));
      openAccessWhatsApp(profile, "meditaciones", item);
      return;
    }
    trackContentOpen("meditaciones", item);
    window.history.pushState({ detail: item.id }, "", `#meditaciones/${item.id}`);
    setSelected(item);
  }

  async function toggleFavorite(item) {
    const favoriteRef = ref(db, `meditacion_favoritos/${user.uid}/${item.id}`);
    if (favorites[item.id]) {
      await remove(favoriteRef);
      onToast?.("Quitado de favoritos.");
    } else {
      await set(favoriteRef, true);
      onToast?.("Agregado a favoritos.");
    }
  }

  if (selected) {
    return (
      <MeditationDetail
        item={selected}
        favorite={Boolean(favorites[selected.id])}
        onBack={() => window.history.back()}
        onFavorite={() => toggleFavorite(selected)}
        onShare={() => onShare?.("meditaciones", selected)}
      />
    );
  }

  return (
    <section className="content-page">
      <PageTitle icon={Headphones} iconSrc="/icono_meditacion.webp" title="Meditacion" subtitle={sectionSubtitle("meditaciones")} onBack={onBack} />
      <div className="book-grid">
        {items.length === 0 ? <p className="empty-state">Aun no hay meditaciones disponibles.</p> : null}
        {items.map((item) => (
          <article className="book-card meditation-card" key={item.id}>
            <img src={item.imagen || "/icono_meditacion.webp"} alt="" />
            <div>
              <h3>{item.titulo || "Sin titulo"}</h3>
              <p>{item.descripcion || "Meditacion guiada"}</p>
              {contentAccessType(item) !== "gratis" ? <span className="access-badge">{accessLabel(item)}</span> : null}
              <button className="primary small" type="button" onClick={() => openMeditation(item)}>
                <Headphones size={16} /> Escuchar
              </button>
              <button className="ghost compact share-content-button" type="button" onClick={() => toggleFavorite(item)}>
                <Heart className={favorites[item.id] ? "favorite-mark" : ""} size={15} />
                {favorites[item.id] ? "Favorita" : "Favorito"}
              </button>
              <button className="ghost compact share-content-button" type="button" onClick={() => onShare?.("meditaciones", item)}>
                <Share2 size={15} /> Compartir
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function MeditationDetail({ item, favorite, onBack, onFavorite, onShare }) {
  const rawAudioUrl = item.audio_url || item.link_audio || item.audio || item.link_drive || "";
  const audioUrl = audioSourceUrl(rawAudioUrl);
  return (
    <section className="content-page">
      <PageTitle icon={Headphones} iconSrc="/icono_meditacion.webp" title="Meditacion" subtitle={sectionSubtitle("meditaciones")} onBack={onBack} />
      <article className="detail meditation-detail">
        <img className="detail-cover" src={item.imagen || "/icono_meditacion.webp"} alt="" />
        <h1>{item.titulo || "Meditacion"}</h1>
        {item.descripcion ? <p>{item.descripcion}</p> : null}
        {item.detalle ? <div className="detail-note">{item.detalle}</div> : null}
        {audioUrl ? (
          <SimpleAudioPlayer
            sources={audioSourceUrls(rawAudioUrl)}
            title={item.titulo || "Meditacion"}
            onEnded={() => trackEvent("finish_meditation", {
              contentType: "meditaciones",
              contentId: item.id || "",
              contentTitle: item.titulo || "Meditacion",
              contentCategory: item.categoria || item.etiqueta || "",
            })}
          />
        ) : (
          <p className="empty-state">Esta meditacion no tiene audio cargado.</p>
        )}
        {rawAudioUrl ? (
          <a className="primary small" href={rawAudioUrl} target="_blank" rel="noreferrer">
            Abrir audio
          </a>
        ) : null}
        <button className={`like-button ${favorite ? "active" : ""}`} type="button" onClick={onFavorite}>
          <Heart size={18} /> {favorite ? "En favoritos" : "Agregar a favoritos"}
        </button>
        <button className="ghost compact share-content-button" type="button" onClick={onShare}>
          <Share2 size={15} /> Compartir
        </button>
      </article>
    </section>
  );
}

function SimpleAudioPlayer({ sources, title, onEnded }) {
  const [audio, setAudio] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [failed, setFailed] = useState(false);
  const sourceList = sources?.length ? sources : [];

  useEffect(() => {
    if (!audio) return undefined;
    function updateTime() {
      setCurrent(audio.currentTime || 0);
    }
    function updateDuration() {
      setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
    }
    function stopPlaying() {
      setPlaying(false);
      onEnded?.();
    }
    function markFailed() {
      setPlaying(false);
      setFailed(true);
    }
    audio.addEventListener("timeupdate", updateTime);
    audio.addEventListener("loadedmetadata", updateDuration);
    audio.addEventListener("durationchange", updateDuration);
    audio.addEventListener("ended", stopPlaying);
    audio.addEventListener("error", markFailed);
    return () => {
      audio.removeEventListener("timeupdate", updateTime);
      audio.removeEventListener("loadedmetadata", updateDuration);
      audio.removeEventListener("durationchange", updateDuration);
      audio.removeEventListener("ended", stopPlaying);
      audio.removeEventListener("error", markFailed);
    };
  }, [audio, onEnded]);

  async function togglePlay() {
    if (!audio) return;
    if (audio.paused) {
      try {
        setFailed(false);
        await audio.play();
        setPlaying(true);
      } catch {
        setPlaying(false);
        setFailed(true);
      }
    } else {
      audio.pause();
      setPlaying(false);
    }
  }

  function seek(event) {
    const nextTime = Number(event.target.value);
    setCurrent(nextTime);
    if (audio) audio.currentTime = nextTime;
  }

  return (
    <div className="simple-player">
      <audio ref={setAudio} preload="metadata" title={title}>
        {sourceList.map((source) => (
          <source key={source} src={source} type="audio/mp4" />
        ))}
      </audio>
      <button className="player-toggle" type="button" onClick={togglePlay} aria-label={playing ? "Pausar" : "Reproducir"}>
        {playing ? <Pause size={22} /> : <Play size={22} />}
      </button>
      <div className="player-main">
        <strong>{playing ? "Reproduciendo" : "Meditacion"}</strong>
        <input type="range" min="0" max={duration || 0} step="1" value={Math.min(current, duration || current)} onChange={seek} />
        <small>{formatTime(current)} / {duration ? formatTime(duration) : "--:--"}</small>
      </div>
      {failed ? (
        <p className="player-error">No se pudo reproducir este enlace. Subi el M4A desde administracion para usar el reproductor de la app.</p>
      ) : null}
    </div>
  );
}

function Blog({ user, profile, onBack, onShare }) {
  const [posts, setPosts] = useState([]);
  const [social, setSocial] = useState({});
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    loadList("blog").then((items) => {
      const sorted = items.sort((a, b) => (b.fecha_carga || "").localeCompare(a.fecha_carga || ""));
      setPosts(sorted);
      loadBlogSocial(sorted).then(setSocial);
      const postId = hashDetailId("blog");
      if (postId) {
        const found = sorted.find((post) => post.id === postId);
        if (found) setSelected(found);
      }
    });
  }, []);

  useEffect(() => {
    const closeDetail = () => setSelected(null);
    window.addEventListener("popstate", closeDetail);
    return () => window.removeEventListener("popstate", closeDetail);
  }, []);

  function openPost(post) {
    trackContentOpen("blog", post);
    window.history.pushState({ detail: post.id }, "", `#blog/${post.id}`);
    setSelected(post);
  }

  if (selected) return <BlogDetail post={selected} user={user} profile={profile} onBack={() => window.history.back()} onShare={() => onShare?.("blog", selected)} />;

  return (
    <section className="content-page">
      <PageTitle icon={Newspaper} iconSrc="/icono_blog.webp" title="Blog" subtitle={sectionSubtitle("blog")} onBack={onBack} />
      <div className="blog-list">
        {posts.map((post) => {
          const stats = social[post.id] || { likes: 0, comments: 0, lastComment: "" };
          return (
            <button className="post-card" key={post.id} onClick={() => openPost(post)}>
              {post.imagen ? <img src={post.imagen} alt="" /> : null}
              <span>
                <strong>{post.titulo || "Sin titulo"}</strong>
                <small>{post.etiqueta || "Sin categoria"} - {formatDate(post.fecha_carga)}</small>
                <p>{summary(post.descripcion, 130)}</p>
                <span className="post-meta">
                  <span><Heart size={15} /> {stats.likes}</span>
                  <span><MessageCircle size={15} /> {stats.comments}</span>
                </span>
                {stats.lastComment ? <em>Ultimo comentario: {summary(stats.lastComment, 70)}</em> : null}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function BlogDetail({ post, user, profile, onBack, onShare }) {
  const [likes, setLikes] = useState({});
  const [comments, setComments] = useState([]);
  const [comment, setComment] = useState("");

  useEffect(() => {
    refreshSocial();
  }, [post.id]);

  async function refreshSocial() {
    const [likeSnap, commentSnap] = await Promise.all([
      get(ref(db, `blog_likes/${post.id}`)),
      get(ref(db, `blog_comentarios/${post.id}`)),
    ]);
    setLikes(likeSnap.val() || {});
    const value = commentSnap.val() || {};
    setComments(
      Object.entries(value)
        .map(([id, item]) => ({ id, ...item }))
        .sort((a, b) => (b.fecha || "").localeCompare(a.fecha || "")),
    );
  }

  async function toggleLike() {
    const likeRef = ref(db, `blog_likes/${post.id}/${user.uid}`);
    if (likes[user.uid]) {
      await remove(likeRef);
    } else {
      await set(likeRef, true);
    }
    refreshSocial();
  }

  async function sendComment(event) {
    event.preventDefault();
    if (!cleanText(comment)) return;
    await push(ref(db, `blog_comentarios/${post.id}`), {
      texto: cleanText(comment),
      usuario: publicUserName(profile, user),
      usuario_email: user.email || "",
      uid: user.uid,
      fecha: new Date().toISOString(),
    });
    setComment("");
    refreshSocial();
  }

  return (
    <section className="content-page">
      <button className="ghost back" onClick={onBack}>Volver</button>
      <article className="post-detail">
        {post.imagen ? <img src={post.imagen} alt="" /> : null}
        <h1>{post.titulo}</h1>
        <small>{post.etiqueta || "Sin categoria"} - {formatDate(post.fecha_carga)}</small>
        <p>{post.descripcion}</p>
        <button className="ghost compact share-content-button" type="button" onClick={onShare}>
          <Share2 size={15} /> Compartir
        </button>
        <button className={`like-button ${likes[user.uid] ? "active" : ""}`} onClick={toggleLike}>
          <Heart size={18} /> {Object.keys(likes).length}
        </button>
      </article>
      <form className="comment-form" onSubmit={sendComment}>
        <textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Comparte una reflexion" />
        <button className="primary"><Send size={17} /> Compartir</button>
      </form>
      <div className="comments">
        <h2><MessageCircle size={18} /> Comentarios</h2>
        {comments.length === 0 ? <p>Aun no hay comentarios.</p> : null}
        {comments.map((item) => (
          <article className="comment" key={item.id}>
            <strong>{commentDisplayName(item)}</strong>
            <p>{item.texto}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function Chat({ user, profile, onBack }) {
  const isAdmin = isAdminProfile(profile, user);
  const [threads, setThreads] = useState([]);
  const [activeThread, setActiveThread] = useState(isAdmin ? null : user.uid);
  const [notifyStatus, setNotifyStatus] = useState(
    typeof Notification === "undefined" ? "unsupported" : Notification.permission,
  );

  useEffect(() => {
    if (!isAdmin) return undefined;
    return onValue(ref(db, "chat"), (snap) => {
      const value = snap.val() || {};
      const nextThreads = Object.entries(value)
        .map(([id, item]) => ({ id, ...item }))
        .sort((a, b) => (b.ultima_fecha || "").localeCompare(a.ultima_fecha || ""));
      setThreads(nextThreads);
    });
  }, [isAdmin]);

  async function enableChatAlerts() {
    unlockNotificationSound();
    if (typeof Notification === "undefined") {
      setNotifyStatus("unsupported");
      return;
    }
    const result = await Notification.requestPermission();
    setNotifyStatus(result);
  }

  if (isAdmin && !activeThread) {
    return (
      <section className="content-page">
        <PageTitle icon={MessageCircle} title="Chat" subtitle={sectionSubtitle("chat")} onBack={onBack} />
        <div className="chat-alert-row">
          <span>{notifyStatus === "granted" ? "Avisos de chat activados" : "Activa avisos para recibir sonido y notificacion."}</span>
          {notifyStatus !== "granted" && notifyStatus !== "unsupported" ? (
            <button className="primary small" type="button" onClick={enableChatAlerts}>
              Activar avisos
            </button>
          ) : null}
        </div>
        <div className="list">
          {threads.length === 0 ? <p className="empty-state">Aun no hay consultas.</p> : null}
          {threads.map((thread) => (
            <button className="conversation-row" key={thread.id} onClick={() => setActiveThread(thread.id)}>
              <Avatar src={thread.usuario_foto} name={thread.usuario_nombre || thread.usuario_email || "Usuario"} />
              <span>
                <strong>{thread.usuario_nombre || thread.usuario_email || "Usuario"}</strong>
                <small>{thread.ultimo_mensaje || "Sin mensajes"}</small>
              </span>
              <small>{formatDate(thread.ultima_fecha)}</small>
            </button>
          ))}
        </div>
      </section>
    );
  }

  return (
    <ChatThread
      user={user}
      profile={profile}
      threadId={activeThread}
      isAdmin={isAdmin}
      onBack={isAdmin ? () => setActiveThread(null) : onBack}
    />
  );
}

function ChatThread({ user, profile, threadId, isAdmin, onBack }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [sendError, setSendError] = useState("");
  const lastIncomingMessageRef = useRef("");

  useEffect(() => {
    return onValue(ref(db, `chat/${threadId}/mensajes`), (snap) => {
      const value = snap.val() || {};
      const nextMessages = Object.entries(value)
        .map(([id, item]) => ({ id, ...item }))
        .sort((a, b) => (a.fecha || "").localeCompare(b.fecha || ""));
      const latestIncoming = [...nextMessages].reverse().find((item) => !isOwnChatMessage(item, user, isAdmin));
      const latestIncomingKey = latestIncoming ? `${latestIncoming.id}-${latestIncoming.fecha || ""}` : "";
      if (latestIncomingKey && lastIncomingMessageRef.current && latestIncomingKey !== lastIncomingMessageRef.current) {
        notifyIncomingChat({
          id: threadId,
          usuario_nombre: messageSenderName(latestIncoming),
          usuario_email: latestIncoming.remitente_email || "",
          ultimo_mensaje: latestIncoming.texto || "",
        });
      }
      if (latestIncomingKey) lastIncomingMessageRef.current = latestIncomingKey;
      setMessages(nextMessages);
    });
  }, [threadId, user.uid, isAdmin]);

  async function sendMessage(event) {
    event.preventDefault();
    const message = cleanText(text);
    if (!message) return;
    setBusy(true);
    setSendError("");
    const fecha = new Date().toISOString();
    const payload = {
      texto: message,
      fecha,
      remitente_uid: user.uid,
      remitente_nombre: senderName(profile, user, isAdmin),
      remitente_foto: profile?.foto_url || "",
      remitente_email: user.email || "",
      rol: isAdmin ? "admin" : "usuario",
      leido_admin: isAdmin,
      leido_usuario: !isAdmin,
    };
    const threadData = {
      ultima_fecha: fecha,
      ultimo_mensaje: message,
      ultimo_remitente_rol: isAdmin ? "admin" : "usuario",
    };
    if (!isAdmin) {
      threadData.usuario_email = user.email || "";
      threadData.usuario_nombre = profile?.nombre || "";
      threadData.usuario_foto = profile?.foto_url || "";
    }
    try {
      await push(ref(db, `chat/${threadId}/mensajes`), payload);
      await update(ref(db, `chat/${threadId}`), threadData);
      setText("");
    } catch (error) {
      console.warn("No se pudo enviar el mensaje", error);
      setSendError("No se pudo enviar el mensaje. Revisa la conexion e intenta nuevamente.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="content-page">
      <PageTitle icon={MessageCircle} title="Chat" subtitle={sectionSubtitle("chat")} onBack={onBack} />
      <div className="chat-box">
        <div className="chat-messages">
          {messages.length === 0 ? <p className="empty-state">Escribi tu consulta para comenzar.</p> : null}
          {messages.map((item) => {
            const mine = item.remitente_uid === user.uid || (isAdmin && item.rol === "admin");
            return (
              <article className={`chat-message ${mine ? "mine" : ""}`} key={item.id}>
                <Avatar src={item.remitente_foto} name={messageSenderName(item)} size="small" />
                <span className="chat-bubble">
                  <p>{item.texto}</p>
                  <small>
                    <span className="chat-author">{messageSenderName(item)}</span>
                    <span>{formatDate(item.fecha)}</span>
                  </small>
                </span>
              </article>
            );
          })}
        </div>
        {sendError ? <p className="player-error chat-send-error">{sendError}</p> : null}
        <form className="chat-input" onSubmit={sendMessage}>
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Escribe un mensaje..." />
          <button className="primary" disabled={busy || !cleanText(text)}>
            <Send size={17} />
          </button>
        </form>
      </div>
    </section>
  );
}

function Admin({ profile, menuConfig, appSettings, onToast, onBack }) {
  const [section, setSection] = useState("biblioteca");
  const [items, setItems] = useState([]);
  const [editing, setEditing] = useState(null);
  const [shareDraft, setShareDraft] = useState(null);
  const [courseSeries, setCourseSeries] = useState({ conocimiento: [], ejercicios: [] });
  const dataPath = adminDataPath(section);

  useEffect(() => {
    if (section === "cuaderno" || section === "libros" || section === "configuracion" || section === "analiticas" || section === "deidades" || section === "deity-comments") {
      setItems([]);
      return;
    }
    loadList(dataPath).then(setItems);
  }, [section]);

  useEffect(() => {
    refreshCourseSeries();
  }, []);

  async function refresh() {
    if (section === "cuaderno" || section === "libros" || section === "configuracion" || section === "analiticas" || section === "deidades" || section === "deity-comments") return;
    setItems(await loadList(dataPath));
    if (["conocimiento", "ejercicios"].includes(section)) refreshCourseSeries();
  }

  async function refreshCourseSeries() {
    const [knowledgeItems, exerciseItems] = await Promise.all([
      loadList("conocimiento"),
      loadList("ejercicios"),
    ]);
    setCourseSeries({
      conocimiento: courseSeriesOptions(knowledgeItems),
      ejercicios: courseSeriesOptions(exerciseItems),
    });
  }

  async function deleteItem(item) {
    const label = section === "tienda" ? productName(item) : section === "ganesha-guia-knowledge" ? ganeshaKnowledgeTitle(item) : contentTitle(item);
    if (!window.confirm(`Borrar "${label || "item"}"?`)) return;
    await remove(ref(db, `${dataPath}/${item.id}`));
    await deleteStoragePath(item.portada_path || item.imagen_path);
    await deleteStoragePath(item.imagen_detalle_path || item.detalle_imagen_path);
    await deleteStoragePath(item.pdf_path);
    await deleteStoragePath(item.epub_path);
    onToast(section === "tienda" ? "Producto borrado." : "Contenido borrado.");
    refresh();
  }

  return (
    <section className="content-page">
      <PageTitle icon={Shield} title="Administracion" subtitle="Cuida los contenidos que sostienen la practica." onBack={onBack} />
      <AdminNotificationSettings onToast={onToast} />
      <div className="tabs">
        {adminSections.map(({ id, label }) => (
          <button key={id} className={section === id ? "active" : ""} onClick={() => { setSection(id); setEditing(null); }}>
            {label}
          </button>
        ))}
      </div>
      {section !== "usuarios" && section !== "cuaderno" && section !== "libros" && section !== "configuracion" && section !== "analiticas" && section !== "deidades" && section !== "deity-comments" ? (
        <button className="primary" onClick={() => setEditing({})}>
          <Plus size={18} /> Nuevo
        </button>
      ) : null}
      {editing && section === "tienda" ? (
        <ProductAdminForm
          item={editing}
          categoryOptions={storeCategoryOptions(items)}
          onCancel={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            refresh();
            onToast("Producto guardado.");
          }}
          onToast={onToast}
        />
      ) : null}
      {editing && section === "ganesha-guia-knowledge" ? (
        <GaneshaKnowledgeForm
          item={editing}
          onCancel={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            refresh();
            onToast("Conocimiento de Ganesha Guia guardado.");
          }}
          onToast={onToast}
        />
      ) : null}
      {editing && section !== "usuarios" && section !== "cuaderno" && section !== "libros" && section !== "configuracion" && section !== "analiticas" && section !== "deidades" && section !== "deity-comments" && section !== "tienda" && section !== "ganesha-guia-knowledge" && (
        <AdminForm
          key={`${section}-${editing.id || "new"}`}
          section={section}
          item={editing}
          onCancel={() => setEditing(null)}
          onSaved={(savedItem) => {
            setEditing(null);
            refresh();
            onToast("Contenido guardado.");
            const draft = createShareDraft(section, savedItem);
            if (draft) setShareDraft(draft);
          }}
          onToast={onToast}
          seriesOptions={courseSeries[section] || []}
        />
      )}
      {section === "configuracion" ? (
        <MenuSettingsAdmin menuConfig={menuConfig} appSettings={appSettings} onToast={onToast} />
      ) : section === "analiticas" ? (
        <AnalyticsDashboard />
      ) : section === "deidades" ? (
        <DeitiesAdmin profile={profile} onToast={onToast} />
      ) : section === "deity-comments" ? (
        <DeityCommentsAdmin profile={profile} onToast={onToast} />
      ) : section === "ganesha-guia-knowledge" ? (
        <GaneshaKnowledgeAdmin items={items} onEdit={setEditing} onDelete={deleteItem} />
      ) : section === "cuaderno" ? (
        <CuadernoAshram
          profile={profile}
          onToast={onToast}
          onBackToAdminPanel={() => setSection("biblioteca")}
          onShared={(target, note) => {
            const draft = createShareDraft(noteTargetToSection(target), note);
            if (draft) setShareDraft(draft);
          }}
        />
      ) : section === "libros" ? (
        <BookStudio
          profile={profile}
          onToast={onToast}
          onPublishToLibrary={(target, draft) => {
            setSection(target === "biblioteca" ? "biblioteca" : "conocimiento");
            setEditing(draft);
          }}
        />
      ) : section === "usuarios" ? (
        <UserManagement users={items} currentProfile={profile} onToast={onToast} onRefresh={refresh} courseSeries={courseSeries} />
      ) : (
        <div className={`list ${section === "tienda" ? "admin-products-list" : ""}`}>
          {section === "tienda" ? (
            <header className="admin-list-head">
              <strong>Productos cargados</strong>
              <small>{items.length} producto{items.length === 1 ? "" : "s"} en la tienda</small>
            </header>
          ) : null}
          {items.length === 0 ? (
            <p className="empty-state">
              {section === "tienda" ? "Todavía no hay productos cargados." : "Todavía no hay contenidos cargados."}
            </p>
          ) : null}
          {items.map((item) => (
            <article className={`admin-row ${section === "tienda" ? "admin-product-row" : ""}`} key={item.id}>
              <img src={item.portada_url || item.imagen || sectionFallbackImage(section)} alt="" />
              <span>
                <strong>{section === "tienda" ? productName(item) : contentTitle(item)}</strong>
                <small>{section === "tienda" ? `${productHasPrice(item) ? formatMoney(productPrice(item)) : "Precio a confirmar"} - ${productAvailabilityLabel(item)} - ${item.activo === false ? "Oculto" : "Visible"}` : section === "satsang" ? "Satsang" : item.categoria || item.etiqueta || "Sin categoria"}</small>
                {section === "tienda" && item.categoria ? <em>{item.categoria}</em> : null}
                {contentKeywords(item) ? <em>Palabras clave: {contentKeywords(item)}</em> : null}
              </span>
                                  <button className="icon-btn" type="button" title="Editar" onClick={() => setEditing(item)} aria-label={`Editar ${contentTitle(item)}`}>&#9999;&#65039;</button>
                                  <button className="icon-btn danger" type="button" title="Borrar" onClick={() => deleteItem(item)} aria-label={`Borrar ${contentTitle(item)}`}>&#128465;&#65039;</button>
            </article>
          ))}
        </div>
      )}
      {shareDraft ? <SharePromoModal draft={shareDraft} onClose={() => setShareDraft(null)} onToast={onToast} /> : null}
    </section>
  );
}

function AdminNotificationSettings({ onToast }) {
  return (
    <PushNotificationSettings
      mode="admin"
      title="Notificaciones push"
      description="Recibi mensajes, pedidos y turnos aunque no tengas la app abierta."
      onToast={onToast}
    />
  );
}

function PushNotificationSettings({ mode = "user", title, description, onToast }) {
  const [state, setState] = useState({ status: "checking", label: "Revisando..." });
  const [busy, setBusy] = useState(false);
  const user = auth.currentUser;
  const isAdminMode = mode === "admin";

  useEffect(() => {
    notificationSupportState().then(setState);
    let unsubscribe = () => {};
    listenForegroundNotifications((notification) => {
      onToast?.(`${notification.title}: ${notification.body}`);
      if (notification.data?.route) window.history.pushState({ view: notification.data.route }, "", notification.data.route);
    }).then((stop) => {
      unsubscribe = stop || (() => {});
    });
    return () => unsubscribe();
  }, []);

  async function enable() {
    setBusy(true);
    try {
      const next = isAdminMode ? await enableAdminNotifications(user) : await enableUserNotifications(user);
      setState(next);
      onToast?.("Notificaciones activadas.");
    } catch (error) {
      onToast?.(error.message || "No se pudieron activar las notificaciones.");
      setState(await notificationSupportState());
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    try {
      const next = isAdminMode ? await disableAdminNotifications(user) : await disableUserNotifications(user);
      setState(next);
      onToast?.("Notificaciones desactivadas.");
    } catch (error) {
      onToast?.(error.message || "No se pudieron desactivar las notificaciones.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="admin-push-card">
      <span>
        <strong>{title || "Notificaciones"}</strong>
        <small>Estado: {state.label}. {description || "Se activan solo cuando tocas activar."}</small>
      </span>
      <div>
        <button className="primary small" type="button" onClick={enable} disabled={busy || state.status === "blocked" || state.status === "not-configured"}>
          <Bell size={15} /> {state.status === "enabled" ? "Actualizar avisos" : "Permitir avisos"}
        </button>
        <button className="ghost compact" type="button" onClick={disable} disabled={busy || state.status !== "enabled"}>Desactivar</button>
      </div>
    </section>
  );
}

function MenuSettingsAdmin({ menuConfig, appSettings, onToast }) {
  const [savingId, setSavingId] = useState("");
  const [settingsDraft, setSettingsDraft] = useState(() => normalizeAppSettings(appSettings));
  const [savingSettings, setSavingSettings] = useState(false);
  const [uploadingWelcomeImage, setUploadingWelcomeImage] = useState(false);
  const [uploadingCeremonialIndex, setUploadingCeremonialIndex] = useState(-1);

  useEffect(() => {
    setSettingsDraft(normalizeAppSettings(appSettings));
  }, [appSettings]);

  async function toggleSection(id) {
    const nextEnabled = !isMainMenuEnabled(menuConfig, id);
    setSavingId(id);
    try {
      await set(ref(db, `${MAIN_MENU_CONFIG_PATH}/${id}`), nextEnabled);
      onToast(nextEnabled ? "Boton habilitado." : "Boton deshabilitado.");
    } catch (error) {
      onToast(`No pude guardar la configuracion: ${error.message}`);
    } finally {
      setSavingId("");
    }
  }

  function setSettingsField(field, value) {
    setSettingsDraft((current) => ({ ...current, [field]: value }));
  }

  function setCeremonialEffect(index, field, value) {
    setSettingsDraft((current) => {
      const effects = normalizeCeremonialEffects(current.ceremonialEffects);
      effects[index] = normalizeCeremonialEffect({ ...effects[index], [field]: value });
      return { ...current, ceremonialEffects: effects };
    });
  }

  function setCeremonialModule(moduleId, field, value) {
    setSettingsDraft((current) => ({
      ...current,
      ceremonialModules: normalizeCeremonialModules({
        ...current.ceremonialModules,
        [moduleId]: {
          ...(current.ceremonialModules?.[moduleId] || {}),
          [field]: value,
        },
      }),
    }));
  }

  function setCeremonialLayer(effectIndex, layerIndex, field, value) {
    setSettingsDraft((current) => {
      const effects = normalizeCeremonialEffects(current.ceremonialEffects);
      const layers = normalizeCeremonialLayers(effects[effectIndex]?.layers);
      layers[layerIndex] = normalizeCeremonialLayer({ ...layers[layerIndex], [field]: value });
      effects[effectIndex] = normalizeCeremonialEffect({ ...effects[effectIndex], layers });
      return { ...current, ceremonialEffects: effects };
    });
  }

  function addCeremonialLayer(effectIndex, type = "text") {
    setSettingsDraft((current) => {
      const effects = normalizeCeremonialEffects(current.ceremonialEffects);
      const layers = [...normalizeCeremonialLayers(effects[effectIndex]?.layers), createCeremonialLayerDraft(type)];
      effects[effectIndex] = normalizeCeremonialEffect({ ...effects[effectIndex], layers });
      return { ...current, ceremonialEffects: effects };
    });
  }

  function removeCeremonialLayer(effectIndex, layerIndex) {
    setSettingsDraft((current) => {
      const effects = normalizeCeremonialEffects(current.ceremonialEffects);
      const layers = normalizeCeremonialLayers(effects[effectIndex]?.layers).filter((_, index) => index !== layerIndex);
      effects[effectIndex] = normalizeCeremonialEffect({ ...effects[effectIndex], layers });
      return { ...current, ceremonialEffects: effects };
    });
  }

  function addCeremonialEffect() {
    setSettingsDraft((current) => ({
      ...current,
      ceremonialEffects: [
        ...normalizeCeremonialEffects(current.ceremonialEffects),
        createCeremonialEffectDraft(),
      ],
    }));
  }

  function removeCeremonialEffect(index) {
    setSettingsDraft((current) => ({
      ...current,
      ceremonialEffects: normalizeCeremonialEffects(current.ceremonialEffects).filter((_, itemIndex) => itemIndex !== index),
    }));
  }

  function testCeremonialEffect(effect) {
    window.dispatchEvent(new CustomEvent("ashram-preview-ceremonial-effect", { detail: effect }));
    onToast("Vista previa del efecto ceremonial.");
  }

  async function uploadCeremonialEffectMedia(index, event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploadingCeremonialIndex(index);
    try {
      const uploaded = await uploadCeremonialMedia(file);
      const nextContentType = uploaded.contentType.startsWith("video/") ? "local_video" : "image";
      setSettingsDraft((current) => {
        const effects = normalizeCeremonialEffects(current.ceremonialEffects);
        effects[index] = normalizeCeremonialEffect({
          ...effects[index],
          contentType: nextContentType,
          mediaUrl: uploaded.url,
          mediaPath: uploaded.path,
          mediaContentType: uploaded.contentType,
        });
        return { ...current, ceremonialEffects: effects };
      });
      onToast("Archivo ceremonial cargado.");
    } catch (error) {
      onToast(`No pude subir el archivo: ${error.message}`);
    } finally {
      setUploadingCeremonialIndex(-1);
      event.target.value = "";
    }
  }

  async function uploadCeremonialLayerMedia(effectIndex, layerIndex, event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploadingCeremonialIndex(effectIndex);
    try {
      const uploaded = await uploadCeremonialMedia(file);
      const nextType = uploaded.contentType.startsWith("video/") ? "local_video" : "image";
      setSettingsDraft((current) => {
        const effects = normalizeCeremonialEffects(current.ceremonialEffects);
        const layers = normalizeCeremonialLayers(effects[effectIndex]?.layers);
        layers[layerIndex] = normalizeCeremonialLayer({
          ...layers[layerIndex],
          type: nextType,
          mediaUrl: uploaded.url,
          mediaPath: uploaded.path,
          mediaContentType: uploaded.contentType,
        });
        effects[effectIndex] = normalizeCeremonialEffect({ ...effects[effectIndex], layers });
        return { ...current, ceremonialEffects: effects };
      });
      onToast("Archivo de capa cargado.");
    } catch (error) {
      onToast(`No pude subir el archivo: ${error.message}`);
    } finally {
      setUploadingCeremonialIndex(-1);
      event.target.value = "";
    }
  }

  async function uploadCeremonialModuleMedia(moduleId, event) {
    const files = Array.from(event.target.files || []);
    const file = files[0];
    if (!file) return;
    setUploadingCeremonialIndex(999);
    if (moduleId === "contentSequence") {
      const orderedFiles = sortCeremonialSequenceFiles(files);
      const localItems = orderedFiles.map((item) => ({
        id: `seq-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        url: URL.createObjectURL(item),
        path: "",
        fileName: item.name,
        contentType: item.type,
      }));
      setSettingsDraft((current) => {
        const content = normalizeCeremonialContentModule(current.ceremonialModules?.content);
        return {
          ...current,
          ceremonialModules: normalizeCeremonialModules({
            ...current.ceremonialModules,
            content: {
              ...(current.ceremonialModules?.content || {}),
              contentType: "sequence",
              sequenceImages: [...content.sequenceImages, ...localItems],
            },
          }),
        };
      });
      try {
        const uploadedItems = await Promise.all(orderedFiles.map(async (item, index) => {
          const uploaded = await uploadOptimizedCeremonialImage(item, "config/ceremonial-sequences");
          return {
            ...localItems[index],
            url: uploaded.url,
            path: uploaded.path,
            fileName: item.name.replace(/\.[^.]+$/, ".webp"),
            contentType: uploaded.contentType,
          };
        }));
        setSettingsDraft((current) => {
          const content = normalizeCeremonialContentModule(current.ceremonialModules?.content);
          const localIds = new Set(localItems.map((item) => item.id));
          return {
            ...current,
            ceremonialModules: normalizeCeremonialModules({
              ...current.ceremonialModules,
              content: {
                ...(current.ceremonialModules?.content || {}),
                contentType: "sequence",
                sequenceImages: [
                  ...content.sequenceImages.filter((item) => !localIds.has(item.id)),
                  ...uploadedItems,
                ],
              },
            }),
          };
        });
        onToast("Secuencia de imagenes cargada.");
      } catch (error) {
        setSettingsDraft((current) => {
          const content = normalizeCeremonialContentModule(current.ceremonialModules?.content);
          const localIds = new Set(localItems.map((item) => item.id));
          return {
            ...current,
            ceremonialModules: normalizeCeremonialModules({
              ...current.ceremonialModules,
              content: {
                ...(current.ceremonialModules?.content || {}),
                sequenceImages: content.sequenceImages.filter((item) => !localIds.has(item.id)),
              },
            }),
          };
        });
        onToast(`No pude subir la secuencia: ${error.message}`);
      } finally {
        setUploadingCeremonialIndex(-1);
        event.target.value = "";
      }
      return;
    }
    const targetModuleId = moduleId === "contentImage" ? "content" : moduleId;
    const localUrl = URL.createObjectURL(file);
    const localPatch = moduleId === "header"
      ? { backgroundUrl: localUrl, backgroundFileName: file.name }
      : moduleId === "notifications"
        ? { imageUrl: localUrl, imageFileName: file.name }
        : moduleId === "contentImage"
          ? { imageUrl: localUrl, imageFileName: file.name }
          : { mediaUrl: localUrl, mediaFileName: file.name };
    setSettingsDraft((current) => ({
      ...current,
      ceremonialModules: normalizeCeremonialModules({
        ...current.ceremonialModules,
        [targetModuleId]: {
          ...(current.ceremonialModules?.[targetModuleId] || {}),
          ...localPatch,
        },
      }),
    }));
    try {
      const uploaded = moduleId === "header" || moduleId === "notifications" || moduleId === "contentImage"
        ? await uploadOptimizedImage(file, "config/ceremonial-header")
        : await uploadCeremonialMedia(file, "config/ceremonial-modules");
      const patch = moduleId === "header"
        ? { backgroundUrl: uploaded.url, backgroundPath: uploaded.path, backgroundFileName: file.name }
        : moduleId === "notifications"
          ? { imageUrl: uploaded.url, imagePath: uploaded.path, imageFileName: file.name }
          : moduleId === "contentImage"
            ? { imageUrl: uploaded.url, imagePath: uploaded.path, imageFileName: file.name }
            : { mediaUrl: uploaded.url, mediaPath: uploaded.path, mediaFileName: file.name };
      setSettingsDraft((current) => ({
        ...current,
        ceremonialModules: normalizeCeremonialModules({
          ...current.ceremonialModules,
          [targetModuleId]: {
            ...(current.ceremonialModules?.[targetModuleId] || {}),
            ...patch,
          },
        }),
      }));
      onToast("Archivo ceremonial cargado.");
    } catch (error) {
      onToast(`No pude subir el archivo: ${error.message}`);
    } finally {
      setUploadingCeremonialIndex(-1);
      event.target.value = "";
    }
  }

  async function saveAppSettings(event) {
    event.preventDefault();
    setSavingSettings(true);
    try {
      const nextSettings = normalizeAppSettings(settingsDraft);
      await set(ref(db, APP_SETTINGS_PATH), nextSettings);
      writeLocalAppSettings(nextSettings);
      onToast("Configuracion guardada.");
    } catch (error) {
      onToast(`No pude guardar la configuracion: ${error.message}`);
    } finally {
      setSavingSettings(false);
    }
  }

  async function testAdminNotification() {
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      await Notification.requestPermission();
    }
    writeLocalAppSettings(normalizeAppSettings(settingsDraft));
    notifyAdminAlert({
      type: "chat",
      title: "Prueba de aviso",
      body: "Asi va a sonar cuando llegue un mensaje o solicitud.",
      targetId: "test",
    });
    onToast("Aviso de prueba enviado.");
  }

  async function uploadWelcomeImage(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploadingWelcomeImage(true);
    try {
      const uploaded = await uploadOptimizedImage(file, "config/welcome");
      const nextSettings = normalizeAppSettings({
        ...settingsDraft,
        welcomeTheme: "custom",
        welcomeImageUrl: uploaded.url,
        welcomeImagePath: uploaded.path,
      });
      setSettingsDraft(nextSettings);
      await set(ref(db, APP_SETTINGS_PATH), nextSettings);
      writeLocalAppSettings(nextSettings);
      onToast("Imagen de bienvenida cargada.");
    } catch (error) {
      onToast(`No pude subir la imagen: ${error.message}`);
    } finally {
      setUploadingWelcomeImage(false);
      event.target.value = "";
    }
  }

  return (
    <div className="menu-settings">
      <form className="app-settings-panel" onSubmit={saveAppSettings}>
        <header className="admin-list-head">
          <strong>Avisos y bienvenida</strong>
          <small>Elegí el sonido de administración y el diseño del saludo inicial.</small>
        </header>
        <div className="app-settings-grid">
          <label>
            Sonido de avisos
            <select value={settingsDraft.notificationSound} onChange={(event) => setSettingsField("notificationSound", event.target.value)}>
              {NOTIFICATION_SOUND_OPTIONS.map((option) => (
                <option key={option.id} value={option.id}>{option.label}</option>
              ))}
            </select>
          </label>
          <label>
            Volumen
            <input
              type="range"
              min="0.2"
              max="1"
              step="0.1"
              value={settingsDraft.notificationVolume}
              onChange={(event) => setSettingsField("notificationVolume", Number(event.target.value))}
            />
          </label>
          <label>
            Titulo del inicio
            <input value={settingsDraft.welcomeTitle} onChange={(event) => setSettingsField("welcomeTitle", event.target.value)} placeholder="Ashram Ganesha" />
          </label>
          <label>
            Mensaje de bienvenida
            <input value={settingsDraft.welcomeText} onChange={(event) => setSettingsField("welcomeText", event.target.value)} placeholder="Bienvenido, nombre" />
          </label>
          <label>
            Decoracion
            <select value={settingsDraft.welcomeTheme} onChange={(event) => setSettingsField("welcomeTheme", event.target.value)}>
              {WELCOME_THEME_OPTIONS.map((option) => (
                <option key={option.id} value={option.id}>{option.label}</option>
              ))}
            </select>
          </label>
          <label>
            URL de imagen propia
            <input value={settingsDraft.welcomeImageUrl} onChange={(event) => setSettingsField("welcomeImageUrl", event.target.value)} placeholder="https://..." />
          </label>
          <label>
            Subir imagen desde el celular
            <input type="file" accept="image/png,image/jpeg,image/webp" onChange={uploadWelcomeImage} disabled={uploadingWelcomeImage} />
            <small>Ideal 1600 x 900 px. Minimo 1200 x 675 px. Formato horizontal.</small>
          </label>
        </div>
        {settingsDraft.welcomeImageUrl ? (
          <figure className="settings-image-preview">
            <img src={settingsDraft.welcomeImageUrl} alt="" />
            <figcaption>{uploadingWelcomeImage ? "Subiendo imagen..." : "Imagen actual de bienvenida"}</figcaption>
          </figure>
        ) : null}
        <div className="settings-actions">
          <button className="ghost" type="button" onClick={testAdminNotification}>
            <Bell size={17} /> Probar aviso
          </button>
          <button className="ghost" type="button" onClick={() => playChatSound(settingsDraft)}>
            <Music size={17} /> Probar sonido
          </button>
          <button className="primary" type="submit" disabled={savingSettings}>
            {savingSettings ? "Guardando..." : "Guardar configuracion"}
          </button>
        </div>
      </form>
      <section className="app-settings-panel ceremonial-settings-panel">
        <header className="admin-list-head">
          <strong>Efectos ceremoniales</strong>
          <small>Programa anuncios y efectos especiales para fechas concretas.</small>
        </header>
        <CeremonialModulesSettings
          modules={settingsDraft.ceremonialModules}
          onChange={setCeremonialModule}
          onUpload={uploadCeremonialModuleMedia}
          onPreview={(effect) => testCeremonialEffect(effect)}
          saving={savingSettings}
          onSave={saveAppSettings}
        />
        <div className="ceremonial-effects-list">
          {normalizeCeremonialEffects(settingsDraft.ceremonialEffects).map((effect, index) => (
            <article className="ceremonial-effect-card" key={effect.id}>
              <header>
                <span>
                  <strong>{effect.name || "Nuevo evento ceremonial"}</strong>
                  <small>{ceremonialEffectTypeLabel(effect.type)}{effect.startDate ? ` - desde ${effect.startDate}` : ""}</small>
                </span>
                <button
                  className={`toggle-btn ${effect.enabled ? "active" : ""}`}
                  type="button"
                  onClick={() => setCeremonialEffect(index, "enabled", !effect.enabled)}
                  aria-pressed={effect.enabled}
                >
                  <span>{effect.enabled ? "Activo" : "Inactivo"}</span>
                </button>
              </header>
              <div className="app-settings-grid">
                <label>
                  Nombre del evento
                  <input value={effect.name} onChange={(event) => setCeremonialEffect(index, "name", event.target.value)} placeholder="Ganesh Chaturthi" />
                </label>
                <label>
                  Fecha de inicio
                  <input type="date" value={effect.startDate} onChange={(event) => setCeremonialEffect(index, "startDate", event.target.value)} />
                </label>
                <label>
                  Fecha de fin opcional
                  <input type="date" value={effect.endDate} onChange={(event) => setCeremonialEffect(index, "endDate", event.target.value)} />
                </label>
                <label>
                  Tipo de efecto
                  <select value={effect.type} onChange={(event) => setCeremonialEffect(index, "type", event.target.value)}>
                    {CEREMONIAL_EFFECT_TYPES.map((option) => (
                      <option key={option.id} value={option.id}>{option.label}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Tipo de contenido
                  <select value={effect.contentType} onChange={(event) => setCeremonialEffect(index, "contentType", event.target.value)}>
                    {CEREMONIAL_CONTENT_TYPES.map((option) => (
                      <option key={option.id} value={option.id}>{option.label}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Duracion en segundos
                  <input type="number" min="1" max="60" value={effect.durationSeconds} onChange={(event) => setCeremonialEffect(index, "durationSeconds", event.target.value)} />
                </label>
                <label>
                  Subir GIF, imagen o video
                  <input type="file" accept="image/gif,image/png,image/webp,video/mp4,video/webm,.gif,.png,.webp,.mp4,.webm" onChange={(event) => uploadCeremonialEffectMedia(index, event)} disabled={uploadingCeremonialIndex === index} />
                  <small>{uploadingCeremonialIndex === index ? "Subiendo..." : "GIF, PNG, WEBP, MP4 o WEBM."}</small>
                </label>
                <label>
                  URL de media opcional
                  <input value={effect.mediaUrl} onChange={(event) => setCeremonialEffect(index, "mediaUrl", event.target.value)} placeholder="https://..." />
                </label>
                <label>
                  URL de YouTube
                  <input value={effect.youtubeUrl} onChange={(event) => setCeremonialEffect(index, "youtubeUrl", event.target.value)} placeholder="https://www.youtube.com/watch?v=..." disabled={effect.contentType !== "youtube"} />
                </label>
                <label>
                  Tamaño
                  <select value={effect.sizePreset} onChange={(event) => setCeremonialEffect(index, "sizePreset", event.target.value)}>
                    {CEREMONIAL_SIZE_PRESETS.map((option) => (
                      <option key={option.id} value={option.id}>{option.label}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Posicion
                  <select value={effect.position} onChange={(event) => setCeremonialEffect(index, "position", event.target.value)}>
                    {CEREMONIAL_POSITIONS.map((option) => (
                      <option key={option.id} value={option.id}>{option.label}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Ancho
                  <input value={effect.width} onChange={(event) => setCeremonialEffect(index, "width", event.target.value)} placeholder="Ej: 360px o 60vw" disabled={effect.sizePreset !== "custom"} />
                </label>
                <label>
                  Alto
                  <input value={effect.height} onChange={(event) => setCeremonialEffect(index, "height", event.target.value)} placeholder="auto o 420px" disabled={effect.sizePreset !== "custom"} />
                </label>
                <label>
                  Margen
                  <input type="number" min="0" max="80" value={effect.margin} onChange={(event) => setCeremonialEffect(index, "margin", event.target.value)} />
                </label>
                <label className="ceremonial-wide-field">
                  Mensaje opcional
                  <textarea value={effect.message} onChange={(event) => setCeremonialEffect(index, "message", event.target.value)} placeholder="Bendiciones en este dia sagrado de Ganesha." rows={3} />
                </label>
                <label>
                  Boton OK
                  <input value={effect.okButtonText} onChange={(event) => setCeremonialEffect(index, "okButtonText", event.target.value)} placeholder="OK" />
                </label>
              </div>
              <div className="ceremonial-checks">
                <label>
                  <input
                    type="checkbox"
                    checked={effect.oncePerDay}
                    onChange={(event) => setCeremonialEffect(index, "oncePerDay", event.target.checked)}
                  />
                  Mostrar una sola vez por dia
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={effect.showEveryVisit}
                    onChange={(event) => setCeremonialEffect(index, "showEveryVisit", event.target.checked)}
                  />
                  Mostrar cada vez que entra
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={effect.showOkButton}
                    onChange={(event) => setCeremonialEffect(index, "showOkButton", event.target.checked)}
                  />
                  Boton OK general
                </label>
              </div>
              <div className="ceremonial-layers-panel">
                <header className="admin-list-head">
                  <strong>Capas del evento</strong>
                  <small>Combina texto, media, petalos, papelitos, diya y Ganesha en el mismo dia.</small>
                </header>
                {normalizeCeremonialLayers(effect.layers).map((layer, layerIndex) => (
                  <article className="ceremonial-layer-card" key={layer.id}>
                    <header>
                      <span>
                        <strong>{CEREMONIAL_LAYER_TYPES.find((option) => option.id === layer.type)?.label || "Capa"}</strong>
                        <small>{layer.enabled ? "Activa" : "Inactiva"} - {layer.position} - {layer.durationSeconds}s</small>
                      </span>
                      <button
                        className={`toggle-btn ${layer.enabled ? "active" : ""}`}
                        type="button"
                        onClick={() => setCeremonialLayer(index, layerIndex, "enabled", !layer.enabled)}
                        aria-pressed={layer.enabled}
                      >
                        <span>{layer.enabled ? "Activa" : "Inactiva"}</span>
                      </button>
                    </header>
                    <div className="app-settings-grid">
                      <label>
                        Tipo de capa
                        <select value={layer.type} onChange={(event) => setCeremonialLayer(index, layerIndex, "type", event.target.value)}>
                          {CEREMONIAL_LAYER_TYPES.map((option) => (
                            <option key={option.id} value={option.id}>{option.label}</option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Titulo
                        <input value={layer.title} onChange={(event) => setCeremonialLayer(index, layerIndex, "title", event.target.value)} placeholder="Feliz Ganesh Chaturthi" />
                      </label>
                      <label>
                        Duracion
                        <input type="number" min="1" max="60" value={layer.durationSeconds} onChange={(event) => setCeremonialLayer(index, layerIndex, "durationSeconds", event.target.value)} />
                      </label>
                      <label>
                        Posicion
                        <select value={layer.position} onChange={(event) => setCeremonialLayer(index, layerIndex, "position", event.target.value)}>
                          {CEREMONIAL_POSITIONS.map((option) => (
                            <option key={option.id} value={option.id}>{option.label}</option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Tamaño
                        <select value={layer.sizePreset} onChange={(event) => setCeremonialLayer(index, layerIndex, "sizePreset", event.target.value)}>
                          {CEREMONIAL_SIZE_PRESETS.map((option) => (
                            <option key={option.id} value={option.id}>{option.label}</option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Margen
                        <input type="number" min="0" max="80" value={layer.margin} onChange={(event) => setCeremonialLayer(index, layerIndex, "margin", event.target.value)} />
                      </label>
                      <label>
                        Subir GIF/imagen/video
                        <input type="file" accept="image/gif,image/png,image/webp,video/mp4,video/webm,.gif,.png,.webp,.mp4,.webm" onChange={(event) => uploadCeremonialLayerMedia(index, layerIndex, event)} disabled={uploadingCeremonialIndex === index} />
                      </label>
                      <label>
                        URL media
                        <input value={layer.mediaUrl} onChange={(event) => setCeremonialLayer(index, layerIndex, "mediaUrl", event.target.value)} placeholder="https://..." />
                      </label>
                      <label>
                        URL YouTube
                        <input value={layer.youtubeUrl} onChange={(event) => setCeremonialLayer(index, layerIndex, "youtubeUrl", event.target.value)} placeholder="https://www.youtube.com/watch?v=..." />
                      </label>
                      <label className="ceremonial-wide-field">
                        Mensaje
                        <textarea value={layer.message} onChange={(event) => setCeremonialLayer(index, layerIndex, "message", event.target.value)} rows={2} placeholder="Que Ganesha remueva los obstaculos." />
                      </label>
                    </div>
                    <div className="ceremonial-checks">
                      <label>
                        <input type="checkbox" checked={layer.chromaEnabled} onChange={(event) => setCeremonialLayer(index, layerIndex, "chromaEnabled", event.target.checked)} />
                        Quitar fondo verde
                      </label>
                      <label>
                        <input type="checkbox" checked={layer.repeat} onChange={(event) => setCeremonialLayer(index, layerIndex, "repeat", event.target.checked)} />
                        Repetir
                      </label>
                      <label>
                        <input type="checkbox" checked={layer.showOkButton} onChange={(event) => setCeremonialLayer(index, layerIndex, "showOkButton", event.target.checked)} />
                        OK para cerrar todo
                      </label>
                    </div>
                    {layer.chromaEnabled ? (
                      <div className="ceremonial-chroma-controls">
                        <label>Color a quitar<input type="color" value={layer.chromaColor} onChange={(event) => setCeremonialLayer(index, layerIndex, "chromaColor", event.target.value)} /></label>
                        <label>Sensibilidad<input type="range" min="0.05" max="0.9" step="0.01" value={layer.chromaSensitivity} onChange={(event) => setCeremonialLayer(index, layerIndex, "chromaSensitivity", event.target.value)} /></label>
                        <label>Suavizado<input type="range" min="0" max="0.5" step="0.01" value={layer.chromaSmoothing} onChange={(event) => setCeremonialLayer(index, layerIndex, "chromaSmoothing", event.target.value)} /></label>
                        <small>Para GIF animado con chroma, el navegador puede exigir canvas y consumir mas recursos. WebM con transparencia es la opcion mas limpia.</small>
                      </div>
                    ) : null}
                    <div className="settings-actions">
                      <button className="ghost danger" type="button" onClick={() => removeCeremonialLayer(index, layerIndex)}>
                        <Trash2 size={17} /> Borrar capa
                      </button>
                    </div>
                  </article>
                ))}
                <div className="settings-actions">
                  <button className="ghost" type="button" onClick={() => addCeremonialLayer(index, "petals")}>Petalos</button>
                  <button className="ghost" type="button" onClick={() => addCeremonialLayer(index, "image")}>GIF/Imagen</button>
                  <button className="ghost" type="button" onClick={() => addCeremonialLayer(index, "text")}>Texto</button>
                  <button className="ghost" type="button" onClick={() => addCeremonialLayer(index, "diya")}>Diya</button>
                  <button className="ghost" type="button" onClick={() => addCeremonialLayer(index, "youtube")}>YouTube</button>
                </div>
              </div>
              <div className="settings-actions">
                <button className="ghost" type="button" onClick={() => testCeremonialEffect(effect)}>
                  <Eye size={17} /> Vista previa
                </button>
                <button className="ghost danger" type="button" onClick={() => removeCeremonialEffect(index)}>
                  <Trash2 size={17} /> Borrar
                </button>
              </div>
            </article>
          ))}
          {normalizeCeremonialEffects(settingsDraft.ceremonialEffects).length === 0 ? (
            <p className="empty-state">Todavia no hay efectos ceremoniales configurados.</p>
          ) : null}
        </div>
        <div className="settings-actions">
          <button className="ghost" type="button" onClick={addCeremonialEffect}>
            <Plus size={17} /> Nuevo efecto
          </button>
          <button className="primary" type="button" onClick={saveAppSettings} disabled={savingSettings}>
            {savingSettings ? "Guardando..." : "Guardar efectos"}
          </button>
        </div>
      </section>
      <header className="admin-list-head">
        <strong>Menu principal</strong>
        <small>Activa o desactiva los botones grandes del inicio y sus accesos inferiores.</small>
      </header>
      <div className="menu-settings-list">
        {sections.map(({ id, label, phrase, icon: Icon, iconSrc }) => {
          const enabled = isMainMenuEnabled(menuConfig, id);
          const saving = savingId === id;
          return (
            <article className="menu-setting-row" key={id}>
              <span className="menu-setting-icon">
                {iconSrc ? <img src={iconSrc} alt="" /> : <Icon size={22} />}
              </span>
              <span>
                <strong>{label}</strong>
                <small>{phrase}</small>
              </span>
              <button
                className={`toggle-btn ${enabled ? "active" : ""}`}
                type="button"
                onClick={() => toggleSection(id)}
                disabled={saving}
                aria-pressed={enabled}
              >
                <span>{enabled ? "Activo" : "Inactivo"}</span>
              </button>
            </article>
          );
        })}
      </div>
      <section className="internal-knowledge-sync">
        <span>
          <strong>Conocimiento interno de Ganesha Guia</strong>
          <small>
            Ganesha consulta directamente Firestore: ashramDocuments y los
            recursos publicos del Ashram.
          </small>
        </span>
      </section>
    </div>
  );
}

function CeremonialModulesSettings({ modules, onChange, onUpload, onPreview, saving, onSave }) {
  const normalized = normalizeCeremonialModules(modules);

  function previewNotifications() {
    const notifications = normalized.notifications;
    onPreview(ceremonialModulesToActiveEffect({ notifications: { ...notifications, enabled: true, startDate: todayIsoDate(), showEveryVisit: true } }));
  }

  function previewAmbient() {
    const ambient = normalized.ambient;
    onPreview(ceremonialModulesToActiveEffect({ ambient: { ...ambient, enabled: true, startDate: todayIsoDate(), showEveryVisit: true } }));
  }

  function previewContent() {
    const content = normalized.content;
    onPreview(ceremonialModulesToActiveEffect({ content: { ...content, enabled: true, startDate: todayIsoDate(), showEveryVisit: true } }));
  }

  function setSequenceImages(images) {
    onChange("content", "sequenceImages", images);
  }

  function moveSequenceImage(index, direction) {
    const images = [...normalized.content.sequenceImages];
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= images.length) return;
    [images[index], images[nextIndex]] = [images[nextIndex], images[index]];
    setSequenceImages(images);
  }

  function removeSequenceImage(index) {
    setSequenceImages(normalized.content.sequenceImages.filter((_, itemIndex) => itemIndex !== index));
  }

  function saveCurrentAnimation() {
    const name = cleanText(normalized.content.animationName || normalized.content.title);
    if (!name || !normalized.content.sequenceImages.length) return;
    const nextAnimation = {
      id: `animation-${firebaseKey(name)}-${Date.now()}`,
      name,
      images: normalized.content.sequenceImages,
      sequenceSpeedValue: normalized.content.sequenceSpeedValue,
      sequenceFrameMs: normalized.content.sequenceFrameMs,
      sizePreset: normalized.content.sizePreset,
      width: normalized.content.width,
      height: normalized.content.height,
      position: normalized.content.position,
      repeat: normalized.content.repeat,
      chromaEnabled: normalized.content.chromaEnabled,
      chromaColor: normalized.content.chromaColor,
      chromaSensitivity: normalized.content.chromaSensitivity,
      chromaSmoothing: normalized.content.chromaSmoothing,
      savedAt: new Date().toISOString(),
    };
    onChange("content", "savedAnimations", [
      nextAnimation,
      ...normalized.content.savedAnimations.filter((item) => item.name !== name),
    ].slice(0, 12));
  }

  function loadSavedAnimation(animationId) {
    const animation = normalized.content.savedAnimations.find((item) => item.id === animationId);
    if (!animation) return;
    onChange("content", "contentType", "sequence");
    onChange("content", "animationName", animation.name);
    onChange("content", "title", animation.name);
    onChange("content", "sequenceImages", animation.images);
    onChange("content", "sequenceSpeedValue", animation.sequenceSpeedValue);
    onChange("content", "sequenceFrameMs", animation.sequenceFrameMs);
    onChange("content", "sizePreset", animation.sizePreset);
    onChange("content", "width", animation.width);
    onChange("content", "height", animation.height);
    onChange("content", "position", animation.position);
    onChange("content", "repeat", animation.repeat);
    onChange("content", "chromaEnabled", animation.chromaEnabled);
    onChange("content", "chromaColor", animation.chromaColor);
    onChange("content", "chromaSensitivity", animation.chromaSensitivity);
    onChange("content", "chromaSmoothing", animation.chromaSmoothing);
  }

  function deleteSavedAnimation(animationId) {
    onChange("content", "savedAnimations", normalized.content.savedAnimations.filter((item) => item.id !== animationId));
  }

  const contentIsMotion = normalized.content.contentType === "gif" || normalized.content.contentType === "sequence";
  const contentPreviewLabel = normalized.content.contentType === "sequence"
    ? "Vista previa"
    : normalized.content.contentType === "gif"
      ? "Probar GIF"
      : "Probar contenido";

  return (
    <div className="ceremonial-modules">
      <article className="ceremonial-module-card">
        <header>
          <span><strong>1. Notificaciones</strong><small>Avisos importantes en ventana central con OK obligatorio.</small></span>
          <button className={`toggle-btn ${normalized.notifications.enabled ? "active" : ""}`} type="button" onClick={() => onChange("notifications", "enabled", !normalized.notifications.enabled)}>{normalized.notifications.enabled ? "Activo" : "Inactivo"}</button>
        </header>
        <div className="app-settings-grid">
          <CeremonialDateFields moduleId="notifications" module={normalized.notifications} onChange={onChange} />
          <label>Titulo<input value={normalized.notifications.title} onChange={(event) => onChange("notifications", "title", event.target.value)} /></label>
          <label>Imagen opcional<input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => onUpload("notifications", event)} /></label>
          <label className="ceremonial-wide-field">Mensaje<textarea rows={3} value={normalized.notifications.message} onChange={(event) => onChange("notifications", "message", event.target.value)} /></label>
        </div>
        {normalized.notifications.imageUrl ? <figure className="settings-image-preview"><img src={normalized.notifications.imageUrl} alt="" /><figcaption>Imagen de notificacion</figcaption></figure> : null}
        <CeremonialOnceControls moduleId="notifications" module={normalized.notifications} onChange={onChange} />
        <div className="settings-actions"><button className="ghost" type="button" onClick={previewNotifications}><Eye size={17} /> Probar notificacion</button></div>
      </article>

      <article className="ceremonial-module-card">
        <header>
          <span><strong>2. Encabezado especial</strong><small>Reemplaza titulo y subtitulo del inicio en fechas especiales.</small></span>
          <button className={`toggle-btn ${normalized.header.enabled ? "active" : ""}`} type="button" onClick={() => onChange("header", "enabled", !normalized.header.enabled)}>{normalized.header.enabled ? "Activo" : "Inactivo"}</button>
        </header>
        <div className="app-settings-grid">
          <CeremonialDateFields moduleId="header" module={normalized.header} onChange={onChange} />
          <label>Titulo especial<input value={normalized.header.title} onChange={(event) => onChange("header", "title", event.target.value)} placeholder="Feliz Ganesh Chaturthi" /></label>
          <label>Subtitulo especial<input value={normalized.header.subtitle} onChange={(event) => onChange("header", "subtitle", event.target.value)} placeholder="Que Ganesha remueva los obstaculos..." /></label>
        </div>
      </article>

      <article className="ceremonial-module-card">
        <header>
          <span><strong>3. Efectos ambientales</strong><small>No bloquean la app y desaparecen solos.</small></span>
          <button className={`toggle-btn ${normalized.ambient.enabled ? "active" : ""}`} type="button" onClick={() => onChange("ambient", "enabled", !normalized.ambient.enabled)}>{normalized.ambient.enabled ? "Activo" : "Inactivo"}</button>
        </header>
        <div className="app-settings-grid">
          <CeremonialDateFields moduleId="ambient" module={normalized.ambient} onChange={onChange} />
          <label>Tipo<select value={normalized.ambient.type} onChange={(event) => onChange("ambient", "type", event.target.value)}>
            <option value="gold_confetti">Papelitos dorados</option><option value="leaves">Hojas</option><option value="flowers">Flores</option><option value="petals">Petalos</option><option value="diya">Diya/flamita</option><option value="lanterns">Faroles colgantes antiguos</option>
          </select></label>
          <label>Cantidad<input type="number" min="6" max="90" value={normalized.ambient.amount} onChange={(event) => onChange("ambient", "amount", event.target.value)} /></label>
          <label>Duracion<input type="number" min="1" max="60" value={normalized.ambient.durationSeconds} onChange={(event) => onChange("ambient", "durationSeconds", event.target.value)} /></label>
          <label>Velocidad<select value={normalized.ambient.speed} onChange={(event) => onChange("ambient", "speed", event.target.value)}><option value="slow">Lenta</option><option value="medium">Media</option><option value="fast">Rapida</option></select></label>
          <label>Tamaño<select value={normalized.ambient.sizePreset} onChange={(event) => onChange("ambient", "sizePreset", event.target.value)}><option value="small">Pequeño</option><option value="medium">Mediano</option><option value="large">Grande</option></select></label>
        </div>
        <CeremonialOnceControls moduleId="ambient" module={normalized.ambient} onChange={onChange} />
        <div className="settings-actions"><button className="ghost" type="button" onClick={previewAmbient}><Eye size={17} /> Probar efecto</button></div>
      </article>

      <article className="ceremonial-module-card">
        <header>
          <span><strong>4. Contenido especial</strong><small>Elige un solo tipo: secuencia, GIF, video o mensaje.</small></span>
          <button className={`toggle-btn ${normalized.content.enabled ? "active" : ""}`} type="button" onClick={() => onChange("content", "enabled", !normalized.content.enabled)}>{normalized.content.enabled ? "Activo" : "Inactivo"}</button>
        </header>
        <div className="app-settings-grid">
          <CeremonialDateFields moduleId="content" module={normalized.content} onChange={onChange} />
          <label>Tipo<select value={normalized.content.contentType} onChange={(event) => onChange("content", "contentType", event.target.value)}><option value="sequence">Secuencia de imagenes</option><option value="gif">GIF</option><option value="video">Video</option><option value="message">Mensaje</option></select></label>
          <label>Titulo<input value={normalized.content.title} onChange={(event) => onChange("content", "title", event.target.value)} /></label>
          {normalized.content.contentType === "sequence" ? <label>Nombre de animacion<input value={normalized.content.animationName} onChange={(event) => onChange("content", "animationName", event.target.value)} placeholder="Ganesha saludando" /></label> : null}
          {normalized.content.contentType === "gif" ? <label>Subir GIF<input type="file" accept="image/gif,image/png,image/webp,.gif,.png,.webp" onChange={(event) => onUpload("content", event)} /></label> : null}
          {normalized.content.contentType === "sequence" ? <label>Subir imagenes numeradas<input type="file" multiple accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp" onChange={(event) => onUpload("contentSequence", event)} /><small>PNG, JPG o WEBP. Se ordenan por numero y se guardan optimizadas en WebP.</small></label> : null}
          {normalized.content.contentType === "sequence" && normalized.content.savedAnimations.length ? <label>Usar animacion guardada<select defaultValue="" onChange={(event) => { loadSavedAnimation(event.target.value); event.target.value = ""; }}><option value="" disabled>Elegir animacion</option>{normalized.content.savedAnimations.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label> : null}
          {normalized.content.contentType === "video" ? <label>YouTube<input value={normalized.content.youtubeUrl} onChange={(event) => onChange("content", "youtubeUrl", event.target.value)} /></label> : null}
          {normalized.content.contentType === "video" ? <label>Subir video local<input type="file" accept="video/mp4,video/webm,.mp4,.webm" onChange={(event) => onUpload("content", event)} /></label> : null}
          {normalized.content.contentType === "message" ? <label>Imagen opcional<input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => onUpload("contentImage", event)} /></label> : null}
          <label>Tamaño<select value={normalized.content.sizePreset} onChange={(event) => onChange("content", "sizePreset", event.target.value)}>{CEREMONIAL_SIZE_PRESETS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
          {contentIsMotion ? <label>Posicion<select value={normalized.content.position} onChange={(event) => onChange("content", "position", event.target.value)}>{CEREMONIAL_POSITIONS.filter((item) => item.id !== "fullscreen" && item.id !== "top" && item.id !== "bottom").map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label> : null}
          {contentIsMotion ? <label>Duracion<input type="number" min="1" max="60" value={normalized.content.durationSeconds} onChange={(event) => onChange("content", "durationSeconds", event.target.value)} /></label> : null}
          {normalized.content.contentType === "sequence" ? <label>Velocidad<input type="range" min="1" max="100" value={normalized.content.sequenceSpeedValue} onChange={(event) => onChange("content", "sequenceSpeedValue", event.target.value)} /><small>{ceremonialSequenceSpeedLabel(normalized.content)} - {ceremonialSequenceFrameMs(normalized.content)} ms por imagen</small></label> : null}
          {contentIsMotion ? <label>Ancho manual<input value={normalized.content.width} onChange={(event) => onChange("content", "width", event.target.value)} placeholder="Ej: 320px" disabled={normalized.content.sizePreset !== "custom"} /></label> : null}
          {contentIsMotion ? <label>Alto manual<input value={normalized.content.height} onChange={(event) => onChange("content", "height", event.target.value)} placeholder="auto" disabled={normalized.content.sizePreset !== "custom"} /></label> : null}
          {!contentIsMotion ? <label className="ceremonial-wide-field">Texto<textarea rows={3} value={normalized.content.message} onChange={(event) => onChange("content", "message", event.target.value)} /></label> : null}
        </div>
        {contentIsMotion ? <div className="ceremonial-checks">
          <label><input type="checkbox" checked={normalized.content.chromaEnabled} onChange={(event) => onChange("content", "chromaEnabled", event.target.checked)} />Quitar fondo verde</label>
          <label><input type="checkbox" checked={normalized.content.repeat} onChange={(event) => onChange("content", "repeat", event.target.checked)} />Repetir animacion</label>
          <label><input type="checkbox" checked={normalized.content.autoClose} onChange={(event) => onChange("content", "autoClose", event.target.checked)} />Cerrar automaticamente</label>
          <label><input type="checkbox" checked={normalized.content.showOkButton} onChange={(event) => onChange("content", "showOkButton", event.target.checked)} />Mostrar OK</label>
        </div> : null}
        {contentIsMotion && normalized.content.chromaEnabled ? <div className="ceremonial-chroma-controls">
          <label>Color a quitar<input type="color" value={normalized.content.chromaColor} onChange={(event) => onChange("content", "chromaColor", event.target.value)} /></label>
          <label>Sensibilidad<input type="range" min="0.05" max="0.9" step="0.01" value={normalized.content.chromaSensitivity} onChange={(event) => onChange("content", "chromaSensitivity", event.target.value)} /></label>
          <label>Suavizado<input type="range" min="0" max="0.5" step="0.01" value={normalized.content.chromaSmoothing} onChange={(event) => onChange("content", "chromaSmoothing", event.target.value)} /></label>
        </div> : null}
        {normalized.content.contentType === "gif" ? <CeremonialGifPreview content={normalized.content} /> : null}
        {normalized.content.contentType === "sequence" ? <CeremonialSequenceSettings content={normalized.content} onMove={moveSequenceImage} onRemove={removeSequenceImage} onSaveAnimation={saveCurrentAnimation} onLoadAnimation={loadSavedAnimation} onDeleteAnimation={deleteSavedAnimation} /> : null}
        {normalized.content.contentType === "message" ? <CeremonialMessagePreview content={normalized.content} /> : null}
        {normalized.content.contentType === "video" ? <CeremonialVideoPreview content={normalized.content} /> : null}
        <CeremonialOnceControls moduleId="content" module={normalized.content} onChange={onChange} />
        <div className="settings-actions">
          <button className="ghost" type="button" onClick={previewContent}><Eye size={17} /> {contentPreviewLabel}</button>
          {normalized.content.contentType === "gif" && normalized.content.mediaUrl ? <button className="ghost danger" type="button" onClick={() => { onChange("content", "mediaUrl", ""); onChange("content", "mediaPath", ""); onChange("content", "mediaFileName", ""); }}>Quitar GIF</button> : null}
          {normalized.content.contentType === "sequence" && normalized.content.sequenceImages.length ? <button className="ghost danger" type="button" onClick={() => setSequenceImages([])}>Quitar secuencia</button> : null}
        </div>
      </article>

      <div className="settings-actions"><button className="primary" type="button" onClick={onSave} disabled={saving}>{saving ? "Guardando..." : "Guardar Efectos Ceremoniales"}</button></div>
    </div>
  );
}

function CeremonialDateFields({ moduleId, module, onChange }) {
  return (
    <>
      <label>Nombre del evento<input value={module.eventName} onChange={(event) => onChange(moduleId, "eventName", event.target.value)} placeholder="Ganesh Chaturthi" /></label>
      <label>Fecha inicio<input type="date" value={module.startDate} onChange={(event) => onChange(moduleId, "startDate", event.target.value)} /></label>
      <label>Fecha fin opcional<input type="date" value={module.endDate} onChange={(event) => onChange(moduleId, "endDate", event.target.value)} /></label>
    </>
  );
}

function CeremonialOnceControls({ moduleId, module, onChange }) {
  return (
    <div className="ceremonial-checks">
      <label><input type="checkbox" checked={module.oncePerDay} onChange={(event) => onChange(moduleId, "oncePerDay", event.target.checked)} />Mostrar una vez por dia</label>
      <label><input type="checkbox" checked={module.showEveryVisit} onChange={(event) => onChange(moduleId, "showEveryVisit", event.target.checked)} />Mostrar siempre mientras este activo</label>
    </div>
  );
}

function CeremonialHeaderPreview({ header }) {
  const previewHeader = {
    ...header,
    title: header.title || "Ashram Ganesha",
    subtitle: header.subtitle || "Bienvenido, Gabriel Premananda",
  };

  return (
    <section className="ceremonial-header-preview" aria-label="Vista previa del encabezado especial">
      <div className="home-card welcome-theme-special" style={welcomeCardStyle({}, previewHeader)}>
        <img className="home-logo" src={APP_LOGO_SRC} alt="" />
        <span>
          <strong>{previewHeader.title}</strong>
          <small>{previewHeader.subtitle}</small>
          {header.backgroundFileName ? <em>{header.backgroundFileName}</em> : null}
        </span>
      </div>
    </section>
  );
}

function CeremonialGifPreview({ content }) {
  if (!content.mediaUrl) {
    return <p className="empty-state">Todavia no hay GIF cargado.</p>;
  }

  const effect = {
    ...content,
    contentType: "image",
    name: content.mediaFileName || "GIF ceremonial",
  };

  return (
    <figure className="ceremonial-gif-preview">
      <div style={ceremonialBoxStyle(content)}>
        <CeremonialMedia effect={effect} />
      </div>
      <figcaption>{content.mediaFileName || "GIF cargado"}</figcaption>
    </figure>
  );
}

function CeremonialSequenceSettings({ content, onMove, onRemove, onSaveAnimation, onLoadAnimation, onDeleteAnimation }) {
  const images = normalizeCeremonialSequenceImages(content.sequenceImages);
  if (!images.length) {
    return (
      <section className="ceremonial-sequence-editor">
        <p className="empty-state">Todavia no hay imagenes cargadas para la secuencia.</p>
        <CeremonialSavedAnimations animations={content.savedAnimations} onLoad={onLoadAnimation} onDelete={onDeleteAnimation} />
      </section>
    );
  }

  return (
    <section className="ceremonial-sequence-editor">
      <CeremonialSequencePreview content={content} />
      <div className="ceremonial-sequence-summary">
        <strong>{content.animationName || content.title || "Animacion sin nombre"}</strong>
        <small>{images.length} imagenes ordenadas - {ceremonialSequenceSpeedLabel(content)}</small>
        <button className="ghost" type="button" onClick={onSaveAnimation} disabled={!cleanText(content.animationName || content.title)}>
          <Download size={16} /> Guardar animacion
        </button>
      </div>
      <div className="ceremonial-sequence-list">
        {images.map((image, index) => (
          <article key={image.id} className="ceremonial-sequence-item">
            <img src={image.url} alt="" />
            <span>
              <strong>{index + 1}. {image.fileName || "Imagen de secuencia"}</strong>
              <small>{image.contentType || "imagen"}</small>
            </span>
            <button className="ghost" type="button" onClick={() => onMove(index, -1)} disabled={index === 0}>Subir</button>
            <button className="ghost" type="button" onClick={() => onMove(index, 1)} disabled={index === images.length - 1}>Bajar</button>
            <button className="icon-btn danger" type="button" title="Eliminar" onClick={() => onRemove(index)}><Trash2 size={16} /></button>
          </article>
        ))}
      </div>
      <CeremonialSavedAnimations animations={content.savedAnimations} onLoad={onLoadAnimation} onDelete={onDeleteAnimation} />
    </section>
  );
}

function CeremonialSavedAnimations({ animations, onLoad, onDelete }) {
  const saved = normalizeCeremonialSavedAnimations(animations);
  if (!saved.length) return null;
  return (
    <section className="ceremonial-saved-animations">
      <strong>Animaciones guardadas</strong>
      {saved.map((animation) => (
        <article key={animation.id}>
          <span>
            <b>{animation.name}</b>
            <small>{animation.images.length} imagenes</small>
          </span>
          <button className="ghost" type="button" onClick={() => onLoad(animation.id)}>Usar</button>
          <button className="icon-btn danger" type="button" title="Borrar animacion" onClick={() => onDelete(animation.id)}><Trash2 size={16} /></button>
        </article>
      ))}
    </section>
  );
}

function CeremonialSequencePreview({ content }) {
  const effect = {
    ...content,
    contentType: "sequence",
    name: content.title || "Secuencia ceremonial",
  };

  return (
    <figure className="ceremonial-gif-preview ceremonial-sequence-preview">
      <div style={ceremonialBoxStyle(content)}>
        <CeremonialMedia effect={effect} />
      </div>
      <figcaption>Vista previa de la secuencia</figcaption>
    </figure>
  );
}

function CeremonialMessagePreview({ content }) {
  if (!content.title && !content.message && !content.imageUrl) {
    return <p className="empty-state">Completa el titulo, texto o imagen para ver la vista previa del mensaje.</p>;
  }

  return (
    <section className="ceremonial-inline-preview">
      <article className="ceremony-floating-panel ceremony-preview-panel" style={ceremonialBoxStyle({ ...content, position: "center" })}>
        {content.imageUrl ? <img className="ceremony-media" src={content.imageUrl} alt="" /> : null}
        {content.title ? <h2>{content.title}</h2> : null}
        {content.message ? <p>{content.message}</p> : null}
        <button className="primary" type="button">OK</button>
      </article>
    </section>
  );
}

function CeremonialVideoPreview({ content }) {
  const effect = {
    ...content,
    contentType: content.youtubeUrl ? "youtube" : "local_video",
    name: content.title || "Video ceremonial",
  };

  if (!content.youtubeUrl && !content.mediaUrl) {
    return <p className="empty-state">Pega un enlace de YouTube o sube un video local para ver la vista previa.</p>;
  }

  return (
    <section className="ceremonial-inline-preview">
      <article className="ceremony-floating-panel ceremony-media-panel ceremony-preview-panel" style={ceremonialBoxStyle({ ...content, position: "center" })}>
        <CeremonialMedia effect={effect} />
        {content.title ? <h2>{content.title}</h2> : null}
        {content.message ? <p>{content.message}</p> : null}
        <button className="primary" type="button">OK</button>
      </article>
    </section>
  );
}

function AnalyticsDashboard() {
  const [overview, setOverview] = useState({});
  const [contentStats, setContentStats] = useState([]);
  const [topicStats, setTopicStats] = useState([]);
  const [keywordStats, setKeywordStats] = useState([]);
  const [searchStats, setSearchStats] = useState([]);
  const [categoryStats, setCategoryStats] = useState([]);
  const [questionStats, setQuestionStats] = useState([]);
  const [dailyStats, setDailyStats] = useState([]);
  const [diagnostics, setDiagnostics] = useState(null);
  const [diagnosticsError, setDiagnosticsError] = useState("");
  const [weeklyReports, setWeeklyReports] = useState([]);
  const [selectedReportId, setSelectedReportId] = useState("");
  const [generatingReport, setGeneratingReport] = useState(false);
  const [selectedDay, setSelectedDay] = useState(todayDateKey());
  const [dailyEvents, setDailyEvents] = useState([]);

  useEffect(() => {
    const unsubscribers = [
      onSnapshot(doc(firestoreDb, "analyticsStats", "overview"), (snap) => setOverview(snap.data() || {}), analyticsReadError(setDiagnosticsError)),
      onSnapshot(query(collection(firestoreDb, "contentStats"), orderBy("count", "desc"), limit(40)), (snap) => {
        setContentStats(snap.docs.map((item) => ({ id: item.id, ...item.data() })));
      }, analyticsReadError(setDiagnosticsError)),
      onSnapshot(query(collection(firestoreDb, "topicStats"), orderBy("count", "desc"), limit(20)), (snap) => {
        setTopicStats(snap.docs.map((item) => ({ id: item.id, ...item.data() })));
      }, analyticsReadError(setDiagnosticsError)),
      onSnapshot(query(collection(firestoreDb, "keywordStats"), orderBy("count", "desc"), limit(20)), (snap) => {
        setKeywordStats(snap.docs.map((item) => ({ id: item.id, ...item.data() })));
      }, analyticsReadError(setDiagnosticsError)),
      onSnapshot(query(collection(firestoreDb, "searchStats"), orderBy("count", "desc"), limit(20)), (snap) => {
        setSearchStats(snap.docs.map((item) => ({ id: item.id, ...item.data() })));
      }, analyticsReadError(setDiagnosticsError)),
      onSnapshot(query(collection(firestoreDb, "categoryStats"), orderBy("count", "desc"), limit(20)), (snap) => {
        setCategoryStats(snap.docs.map((item) => ({ id: item.id, ...item.data() })));
      }, analyticsReadError(setDiagnosticsError)),
      onSnapshot(query(collection(firestoreDb, "ganeshaQuestionStats"), orderBy("count", "desc"), limit(20)), (snap) => {
        setQuestionStats(snap.docs.map((item) => ({ id: item.id, ...item.data() })));
      }, analyticsReadError(setDiagnosticsError)),
      onSnapshot(query(collection(firestoreDb, "dailyInterestStats"), orderBy("dateKey", "desc"), limit(7)), (snap) => {
        setDailyStats(snap.docs.map((item) => ({ id: item.id, ...item.data() })).reverse());
      }, analyticsReadError(setDiagnosticsError)),
      onSnapshot(query(collection(firestoreDb, "weeklyStoreReports"), orderBy("generatedAt", "desc"), limit(12)), (snap) => {
        const reports = snap.docs.map((item) => ({ id: item.id, ...item.data() }));
        setWeeklyReports(reports);
        setSelectedReportId((current) => current || reports[0]?.id || "");
      }, analyticsReadError(setDiagnosticsError)),
    ];
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, []);

  useEffect(() => {
    if (!selectedDay) return undefined;
    return onSnapshot(query(collection(firestoreDb, "analyticsEvents"), where("dateKey", "==", selectedDay), limit(500)), (snap) => {
      setDailyEvents(snap.docs.map((item) => ({ id: item.id, ...item.data() })));
    }, analyticsReadError(setDiagnosticsError));
  }, [selectedDay]);

  const posts = contentStats.filter((item) => item.contentType === "blog" || item.eventType === "open_post").slice(0, 5);
  const satsangs = contentStats
    .filter((item) => item.contentType === "satsang" || item.category === "satsang" || item.category === "Satsang")
    .slice(0, 5);
  const sectionStats = contentStats.filter((item) => item.eventType === "open_section").slice(0, 8);
  const contentVisits = contentStats.filter((item) => item.eventType !== "open_section").slice(0, 8);
  const ganeshaTopics = topicStats.filter((item) => !["Ganesha", "Guia", "Ashram"].includes(analyticsItemTitle(item))).slice(0, 8);
  const selectedReport = weeklyReports.find((report) => report.id === selectedReportId) || weeklyReports[0] || null;
  const dailySummary = buildDailyAnalyticsSummary(dailyEvents);

  async function generateTestReport() {
    setGeneratingReport(true);
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("Necesitas iniciar sesion.");
      const token = await user.getIdToken();
      const response = await fetch("/api/generate-weekly-store-report", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "No se pudo generar el reporte.");
    } catch (error) {
      setDiagnosticsError(error.message || "No se pudo generar el reporte.");
    } finally {
      setGeneratingReport(false);
    }
  }

  return (
    <div className="analytics-dashboard">
      <header className="admin-list-head">
        <strong>Actividad diaria</strong>
        <small>Lectura simple de publicaciones, tienda, plataforma, registros y Ganesha Guia.</small>
      </header>
      <DailyAnalyticsToolbar selectedDay={selectedDay} setSelectedDay={setSelectedDay} />
      <div className="analytics-kpi-grid daily-kpi-grid">
        <AnalyticsKpi icon={Eye} label="Publicaciones vistas" value={dailySummary.publicationViews} />
        <AnalyticsKpi icon={ShoppingBag} label="Movimiento tienda" value={dailySummary.storeActivity} />
        <AnalyticsKpi icon={Library} label="Uso plataforma" value={dailySummary.platformActivity} />
        <AnalyticsKpi icon={User} label="Nuevos registros" value={dailySummary.signups} />
        <AnalyticsKpi icon={MessageCircle} label="Ganesha Guia" value={dailySummary.ganeshaQuestions} />
        <AnalyticsKpi icon={ActivityIcon} label="Eventos del dia" value={dailySummary.totalEvents} />
      </div>
      <section className="analytics-privacy-note">
        Estos datos muestran actividad general por dia. No se muestran nombres, correos ni informacion privada de visitantes.
      </section>
      <div className="analytics-grid">
        <AnalyticsRanking title="Publicaciones vistas ese dia" icon={Newspaper} items={dailySummary.publications} />
        <AnalyticsRanking title="Tienda ese dia" icon={ShoppingBag} items={dailySummary.storeItems} />
        <AnalyticsRanking title="Plataforma del Ashram" icon={Library} items={dailySummary.platformItems} />
        <AnalyticsRanking title="Donde se quedaron mas tiempo" icon={BarChart3} items={dailySummary.durationItems} />
      </div>
      <DailyAnalyticsBreakdown summary={dailySummary} />
      <section className="analytics-card analytics-wide">
        <div className="admin-list-head">
          <strong>Movimiento de los ultimos 7 dias</strong>
          <small>Entradas y consultas generales por dia.</small>
        </div>
        <AnalyticsTrend items={dailyStats} />
      </section>
      <WeeklyStoreReportCard
        reports={weeklyReports}
        selectedId={selectedReportId}
        setSelectedId={setSelectedReportId}
        report={selectedReport}
        generating={generatingReport}
        onGenerate={generateTestReport}
      />
      <div className="analytics-grid">
        <AnalyticsRanking title="Lo mas consultado en Ganesha Guia" icon={MessageCircle} items={questionStats.slice(0, 8)} />
        <AnalyticsRanking title="Temas que mas aparecen" icon={Leaf} items={ganeshaTopics} />
        <AnalyticsRanking title="Posts mas leidos" icon={Newspaper} items={posts} />
        <AnalyticsRanking title="Satsang mas vistos" icon={Heart} items={satsangs} />
        <AnalyticsRanking title="Busquedas frecuentes" icon={SearchIcon} items={searchStats.slice(0, 8)} />
        <AnalyticsRanking title="Categorias con mas interes" icon={Library} items={categoryStats.slice(0, 8)} />
      </div>
    </div>
  );
}

function DailyAnalyticsToolbar({ selectedDay, setSelectedDay }) {
  return (
    <section className="daily-analytics-toolbar">
      <button className={selectedDay === todayDateKey() ? "active" : ""} type="button" onClick={() => setSelectedDay(todayDateKey())}>Hoy</button>
      <button className={selectedDay === offsetDateKey(-1) ? "active" : ""} type="button" onClick={() => setSelectedDay(offsetDateKey(-1))}>Ayer</button>
      <button className={selectedDay === offsetDateKey(-7) ? "active" : ""} type="button" onClick={() => setSelectedDay(offsetDateKey(-7))}>Hace 7 dias</button>
      <label>
        Elegir fecha
        <input type="date" value={selectedDay} onChange={(event) => setSelectedDay(event.target.value)} />
      </label>
    </section>
  );
}

function DailyAnalyticsBreakdown({ summary }) {
  return (
    <section className="analytics-card analytics-wide daily-breakdown">
      <h2><BarChart3 size={18} /> Resumen del dia</h2>
      <div className="weekly-report-metrics">
        <span>Portada <strong>{summary.counts.landing_view || 0}</strong></span>
        <span>Tienda abierta <strong>{summary.counts.store_view || summary.counts.tienda_open || 0}</strong></span>
        <span>Productos vistos <strong>{summary.counts.product_view || 0}</strong></span>
        <span>Carrito <strong>{summary.counts.add_to_cart || 0}</strong></span>
        <span>WhatsApp <strong>{summary.counts.whatsapp_order_click || summary.counts.whatsapp_order_confirmed || 0}</strong></span>
        <span>App Ashram <strong>{summary.counts.app_open || 0}</strong></span>
        <span>Inicios sesion <strong>{summary.counts.login_success || 0}</strong></span>
        <span>Registros <strong>{summary.counts.signup_success || 0}</strong></span>
      </div>
      {!summary.totalEvents ? <p className="empty-state">Todavia no hay datos para este dia. Los datos internos aparecen cuando usuarios registrados interactuan con la app.</p> : null}
    </section>
  );
}

function WeeklyStoreReportCard({ reports, selectedId, setSelectedId, report, generating, onGenerate }) {
  const metrics = report?.metrics || {};
  return (
    <section className="analytics-card analytics-wide weekly-report-card">
      <div className="admin-list-head">
        <strong>Reporte semanal</strong>
        <small>Resumen de tienda generado cada domingo a las 20:00.</small>
      </div>
      <div className="weekly-report-toolbar">
        <select value={selectedId} onChange={(event) => setSelectedId(event.target.value)} disabled={!reports.length}>
          {reports.length ? reports.map((item) => <option key={item.id} value={item.id}>{item.id}</option>) : <option>Sin reportes</option>}
        </select>
        <button className="primary small" type="button" onClick={onGenerate} disabled={generating}>{generating ? "Generando..." : "Generar reporte de prueba"}</button>
      </div>
      {!report ? <p className="empty-state">Todavia no hay reportes semanales.</p> : null}
      {report ? (
        <>
          <p>{report.summaryText || "Reporte generado sin resumen."}</p>
          <div className="weekly-report-metrics">
            <span>Visitas tienda <strong>{metrics.storeViews ?? "sin dato"}</strong></span>
            <span>Productos abiertos <strong>{metrics.productViews ?? "sin dato"}</strong></span>
            <span>Compartidos <strong>{metrics.productShares ?? "sin dato"}</strong></span>
            <span>WhatsApp <strong>{metrics.whatsappClicks ?? "sin dato"}</strong></span>
            <span>Pedidos <strong>{metrics.ordersCreated ?? "sin dato"}</strong></span>
            <span>Mensajes <strong>{metrics.messagesReceived ?? "sin dato"}</strong></span>
          </div>
          {report.topProducts?.length ? <AnalyticsRanking title="Productos mas vistos" icon={ShoppingBag} items={report.topProducts} /> : null}
        </>
      ) : null}
    </section>
  );
}

function AnalyticsKpi({ icon: Icon, label, value }) {
  return (
    <article className="analytics-kpi">
      <Icon size={20} />
      <span>
        <strong>{value}</strong>
        <small>{label}</small>
      </span>
    </article>
  );
}

function AnalyticsRanking({ title, icon: Icon, items }) {
  return (
    <section className="analytics-card">
      <h2><Icon size={18} /> {title}</h2>
      <div className="analytics-ranking">
        {items.length === 0 ? <p className="empty-state">Sin datos todavia.</p> : null}
        {items.map((item) => (
          <article key={item.id}>
            <span>
              <strong>{analyticsItemTitle(item)}</strong>
              <small>{item.category || item.contentType || item.eventType || "Ashram"}</small>
            </span>
            <em>{item.count || 0}</em>
          </article>
        ))}
      </div>
    </section>
  );
}

function AnalyticsTrend({ items }) {
  if (!items.length) return <p className="empty-state">Sin tendencias todavia.</p>;
  const max = Math.max(...items.map((item) => Number(item.totalEvents || 0)), 1);
  return (
    <div className="analytics-trend">
      {items.map((item) => {
        const value = Number(item.totalEvents || 0);
        return (
          <article key={item.id}>
            <span>{item.dateKey || item.id}</span>
            <div><i style={{ width: `${Math.max(8, (value / max) * 100)}%` }} /></div>
            <strong>{value}</strong>
          </article>
        );
      })}
    </div>
  );
}

function AnalyticsSuggestions({ items }) {
  return (
    <section className="analytics-card analytics-wide">
      <h2><Leaf size={18} /> Sugerencias de contenido</h2>
      <div className="analytics-suggestions">
        {items.length === 0 ? <p className="empty-state">Cuando haya mas actividad, apareceran sugerencias para crear nuevo contenido.</p> : null}
        {items.map((item) => <article key={item}>{item}</article>)}
      </div>
    </section>
  );
}

function AnalyticsDiagnostics({ diagnostics, error }) {
  const counts = diagnostics?.counts || {};
  return (
    <section className="analytics-card analytics-wide analytics-diagnostics">
      <h2><BarChart3 size={18} /> Diagnostico temporal</h2>
      {error ? <p className="player-error">{error}</p> : null}
      {!diagnostics && !error ? <p className="empty-state">Leyendo diagnostico de Firestore...</p> : null}
      {diagnostics ? (
        <>
          <div className="analytics-diagnostics-grid">
            <span>analyticsEvents: <strong>{counts.analyticsEvents || 0}</strong></span>
            <span>topicStats: <strong>{counts.topicStats || 0}</strong></span>
            <span>contentStats: <strong>{counts.contentStats || 0}</strong></span>
            <span>searchStats: <strong>{counts.searchStats || 0}</strong></span>
            <span>ganeshaQuestionStats: <strong>{counts.ganeshaQuestionStats || 0}</strong></span>
          </div>
          <small>
            Ultimo evento: {diagnostics.latestEvent?.eventType || "sin eventos"} - {diagnostics.latestEvent?.contentType || "Ashram"}.
          </small>
        </>
      ) : null}
    </section>
  );
}

function analyticsItemTitle(item = {}) {
  return item.title || item.productName || item.contentTitle || item.question || item.searchQuery || item.topic || item.keyword || item.category || "Sin titulo";
}

function sumCounts(items = []) {
  return items.reduce((total, item) => total + Number(item.count || 0), 0);
}

function buildDailyAnalyticsSummary(events = []) {
  const counts = {};
  events.forEach((event) => {
    counts[event.eventType] = (counts[event.eventType] || 0) + 1;
  });
  const publicationEvents = events.filter((event) => ["open_post", "open_article", "open_content"].includes(event.eventType));
  const storeEvents = events.filter((event) => ["store_view", "tienda_open", "product_view", "add_to_cart", "store_product_shared", "whatsapp_order_click", "whatsapp_order_confirmed", "begin_checkout"].includes(event.eventType));
  const platformEvents = events.filter((event) => ["app_open", "open_section", "open_course", "open_meditation", "open_book", "open_video", "search_content", "click_related_resource"].includes(event.eventType));
  const durationEvents = events.filter((event) => event.eventType === "section_time" && Number(event.durationMinutes || 0) > 0);
  return {
    totalEvents: events.length,
    counts,
    publicationViews: publicationEvents.length,
    storeActivity: storeEvents.length,
    platformActivity: platformEvents.length,
    signups: counts.signup_success || 0,
    ganeshaQuestions: counts.ask_ganesha || 0,
    publications: rankDailyEvents(publicationEvents, "publication").slice(0, 8),
    storeItems: rankDailyEvents(storeEvents, "store").slice(0, 8),
    platformItems: rankDailyEvents(platformEvents, "platform").slice(0, 8),
    durationItems: rankDurationEvents(durationEvents).slice(0, 8),
  };
}

function rankDailyEvents(events = [], fallbackType = "Ashram") {
  const ranked = new Map();
  events.forEach((event) => {
    const title = event.productName || event.contentTitle || event.searchQuery || event.question || sectionLabel(event.contentId) || event.eventType;
    const key = `${event.eventType}-${event.productId || event.contentId || title}`;
    const current = ranked.get(key) || {
      id: key,
      title,
      category: event.category || event.contentCategory || event.contentType || fallbackType,
      eventType: event.eventType,
      count: 0,
    };
    current.count += 1;
    ranked.set(key, current);
  });
  return [...ranked.values()].sort((a, b) => b.count - a.count);
}

function rankDurationEvents(events = []) {
  const ranked = new Map();
  events.forEach((event) => {
    const title = event.contentTitle || sectionLabel(event.contentId) || "Seccion";
    const key = event.contentId || title;
    const minutes = Number(event.durationMinutes || 0);
    const current = ranked.get(key) || {
      id: key,
      title,
      category: "minutos aproximados",
      count: 0,
    };
    current.count = Math.round((current.count + minutes) * 10) / 10;
    ranked.set(key, current);
  });
  return [...ranked.values()].sort((a, b) => b.count - a.count);
}

function todayDateKey() {
  return offsetDateKey(0);
}

function offsetDateKey(offsetDays = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

function trackSectionDuration(viewId, startedAt, endedAt = Date.now()) {
  const elapsedMs = endedAt - startedAt;
  if (!viewId || elapsedMs < 15000) return;
  trackEvent("section_time", {
    contentType: "section",
    contentId: viewId,
    contentTitle: sectionLabel(viewId),
    durationMinutes: Math.round((elapsedMs / 60000) * 10) / 10,
  });
}

function buildCommunitySuggestions(topics = [], categories = []) {
  const mainTopics = topics.slice(0, 4).map(analyticsItemTitle).filter(Boolean);
  const mainCategory = analyticsItemTitle(categories[0] || {});
  if (!mainTopics.length) return [];
  const [first, second = "meditacion", third = "respiracion"] = mainTopics;
  return [
    `Crear un post sobre ${first}${second ? ` y ${second}` : ""}.`,
    `Crear una meditacion guiada relacionada con ${first}.`,
    `Preparar una clase sobre ${third} aplicada a ${first}.`,
    mainCategory && mainCategory !== "Sin titulo" ? `Reforzar la categoria ${mainCategory} con nuevo material practico.` : "",
  ].filter(Boolean);
}

function ActivityIcon(props) {
  return <BarChart3 {...props} />;
}

function analyticsReadError(setError) {
  return (error) => {
    console.warn("No se pudo leer analiticas", error);
    setError(error.message || "No se pudo leer analiticas.");
  };
}

async function loadAnalyticsDiagnostics() {
  const user = auth.currentUser;
  if (!user) throw new Error("Necesitas iniciar sesion para leer diagnostico.");
  const token = await user.getIdToken();
  const response = await fetch("/api/analytics-diagnostics", {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || "No se pudo leer diagnostico.");
  return body;
}

function GaneshaKnowledgeAdmin({ items, onEdit, onDelete }) {
  const sorted = [...items].sort((a, b) => Number(b.priority || b.prioridad || 0) - Number(a.priority || a.prioridad || 0));

  return (
    <div className="list ganesha-admin-list">
      <header className="admin-list-head">
        <strong>Conocimiento de Ganesha Guia</strong>
        <small>Base prioritaria que el asistente consulta antes que el resto del Ashram.</small>
      </header>
      {sorted.length === 0 ? <p className="empty-state">Todavia no hay conocimiento cargado para Ganesha Guia.</p> : null}
      {sorted.map((item) => (
        <article className="admin-row" key={item.id}>
          <span className={`knowledge-status-dot ${item.active === false ? "inactive" : "active"}`} />
          <span>
            <strong>{item.title || item.titulo || "Sin titulo"}</strong>
            <small>{item.category || item.categoria || "Sin categoria"} - Prioridad {item.priority || item.prioridad || 0} - {item.active === false ? "Inactivo" : "Activo"}</small>
            <em>{item.topic || item.pregunta || item.tema || "Sin tema"}</em>
            {contentKeywords(item) ? <em>Palabras clave: {contentKeywords(item)}</em> : null}
          </span>
          <button className="icon-btn" type="button" title="Editar" onClick={() => onEdit(item)} aria-label={`Editar ${ganeshaKnowledgeTitle(item)}`}>&#9999;&#65039;</button>
          <button className="icon-btn danger" type="button" title="Borrar" onClick={() => onDelete(item)} aria-label={`Borrar ${ganeshaKnowledgeTitle(item)}`}>&#128465;&#65039;</button>
        </article>
      ))}
    </div>
  );
}

function GaneshaKnowledgeForm({ item, onCancel, onSaved, onToast }) {
  const [form, setForm] = useState({
    title: item.title || item.titulo || "",
    category: item.category || item.categoria || "",
    topic: item.topic || item.pregunta || item.tema || "",
    answer: item.answer || item.respuesta || "",
    keywords: contentKeywords(item),
    phrase: item.phrase || item.frase || "",
    active: item.active !== false,
    priority: item.priority || item.prioridad || 0,
  });
  const [busy, setBusy] = useState(false);

  function setField(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function save(event) {
    event.preventDefault();
    if (!cleanText(form.title)) return onToast("Completa el titulo.");
    if (!cleanText(form.topic)) return onToast("Completa la pregunta o tema.");
    if (!cleanText(form.answer)) return onToast("Completa la respuesta base.");
    setBusy(true);
    try {
      const data = {
        title: cleanText(form.title),
        category: cleanText(form.category),
        topic: cleanText(form.topic),
        answer: cleanText(form.answer),
        keywords: cleanText(form.keywords),
        phrase: cleanText(form.phrase),
        active: Boolean(form.active),
        priority: Number(form.priority) || 0,
        updatedAt: new Date().toISOString(),
      };
      if (item.id) {
        await update(ref(db, `ganeshaKnowledge/${item.id}`), data);
      } else {
        await push(ref(db, "ganeshaKnowledge"), {
          ...data,
          createdAt: new Date().toISOString(),
        });
      }
      onSaved();
    } catch (error) {
      onToast(error.message || "No se pudo guardar el conocimiento.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="admin-form ganesha-knowledge-form" onSubmit={save}>
      <div className="form-head">
        <h2>{item.id ? "Editar conocimiento" : "Nuevo conocimiento"}</h2>
        <button className="icon-btn" type="button" onClick={onCancel}><X size={18} /></button>
      </div>
      <label>Titulo<input value={form.title} onChange={(event) => setField("title", event.target.value)} /></label>
      <label>Categoria<input value={form.category} onChange={(event) => setField("category", event.target.value)} placeholder="Ej: Ayurveda, meditacion, funcionamiento del Ashram" /></label>
      <label>Pregunta o tema<input value={form.topic} onChange={(event) => setField("topic", event.target.value)} placeholder="Ej: como calmar la ansiedad" /></label>
      <label>Respuesta base<textarea value={form.answer} onChange={(event) => setField("answer", event.target.value)} placeholder="Texto breve que Ganesha resumira al responder" /></label>
      <label>Palabras clave<input value={form.keywords} onChange={(event) => setField("keywords", event.target.value)} placeholder="Ej: ansiedad, vata, calma, respiracion, Ganesha" /></label>
      <label>Frase espiritual opcional<input value={form.phrase} onChange={(event) => setField("phrase", event.target.value)} placeholder="Ej: Respira. El centro siempre esta cerca." /></label>
      <label>Prioridad<input type="number" value={form.priority} onChange={(event) => setField("priority", event.target.value)} /></label>
      <label className="check-row">
        <input type="checkbox" checked={form.active} onChange={(event) => setField("active", event.target.checked)} />
        Activo
      </label>
      <button className="primary" disabled={busy}>{busy ? "Guardando..." : "Guardar conocimiento"}</button>
    </form>
  );
}

function SharePromoModal({ draft, onClose, onToast }) {
  async function copyText() {
    await navigator.clipboard?.writeText(draft.text);
    onToast?.("Texto para compartir copiado.");
  }

  async function nativeShare() {
    if (!navigator.share) {
      copyText();
      return;
    }
    try {
      const imageFile = await shareImageFile(draft.image, draft.title);
      const payload = {
        title: draft.title,
        text: draft.text,
        url: draft.url,
      };
      if (imageFile && navigator.canShare?.({ files: [imageFile] })) {
        payload.files = [imageFile];
      }
      await navigator.share(payload);
    } catch {
      // The user can cancel the native share sheet.
    }
  }

  function sendWhatsapp() {
    window.open(`https://wa.me/?text=${encodeURIComponent(draft.text)}`, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="modal-backdrop">
      <section className="share-modal">
        <div className="form-head">
          <h2>Compartir novedad</h2>
          <button className="icon-btn" type="button" onClick={onClose}><X size={18} /></button>
        </div>
        {draft.image ? <img className="share-image" src={draft.image} alt="" /> : null}
        <textarea readOnly value={draft.text} />
        <div className="share-actions">
          <button className="primary small" type="button" onClick={copyText}>Copiar texto</button>
          <button className="primary small" type="button" onClick={nativeShare}>Compartir</button>
          <button className="primary small" type="button" onClick={sendWhatsapp}>WhatsApp</button>
        </div>
        {draft.image ? <small>Si tu celular lo permite, Compartir adjunta la imagen. En WhatsApp por link puede aparecer el logo por como genera la vista previa.</small> : null}
      </section>
    </div>
  );
}

async function shareImageFile(imageUrl, title = "ashram-ganesha") {
  if (!imageUrl || typeof File === "undefined") return null;
  try {
    const response = await fetch(imageUrl, { mode: "cors" });
    if (!response.ok) return null;
    return blobToShareFile(await response.blob(), title);
  } catch {
    return null;
  }
}

async function shareProductImageFile(product, title = "ashram-ganesha") {
  if (typeof File === "undefined") return null;
  const storagePaths = [
    product?.imagen_path,
    product?.imagenCatalogoPath,
    product?.catalogo_imagen_path,
  ].map(cleanText).filter(Boolean);

  for (const path of storagePaths) {
    try {
      const file = blobToShareFile(await getBlob(storageRef(storage, path)), title);
      if (file) return file;
    } catch {
      // Some older products only have a public URL; try that below.
    }
  }

  const imageUrls = [
    productMainImage(product),
    product?.imagen,
    product?.imagen_url,
    product?.portada_url,
  ].map(cleanText).filter(Boolean);

  for (const imageUrl of [...new Set(imageUrls)]) {
    const file = await shareImageFile(imageUrl, title);
    if (file) return file;
  }
  return null;
}

function blobToShareFile(blob, title = "ashram-ganesha") {
  if (!blob?.type?.startsWith("image/") || typeof File === "undefined") return null;
  const extension = blob.type.split("/")[1]?.split(";")[0] || "jpg";
  const safeName = cleanFileName(title || "ashram-ganesha");
  return new File([blob], `${safeName}.${extension}`, { type: blob.type });
}

function downloadBlobFile(file, name = "ashram-ganesha") {
  const objectUrl = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = `${name}.${file.type?.split("/")[1] || "jpg"}`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

function cleanFileName(value) {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
    .slice(0, 48) || "ashram-ganesha";
}

function UserManagement({ users, currentProfile, onToast, onRefresh, courseSeries }) {
  const [editing, setEditing] = useState(null);
  const [presence, setPresence] = useState({});

  useEffect(() => {
    return onSnapshot(collection(firestoreDb, "userPresence"), (snap) => {
      setPresence(Object.fromEntries(snap.docs.map((item) => [item.id, { id: item.id, ...item.data() }])));
    }, (error) => {
      console.warn("No se pudo leer presencia de usuarios", error);
      onToast?.("No pude leer quienes estan conectados.");
    });
  }, []);

  if (editing) {
    return (
      <UserEditor
        userItem={editing}
        courseSeries={courseSeries}
        onCancel={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          onRefresh();
          onToast("Usuario actualizado.");
        }}
        onDelete={async (userItem) => {
          if (userItem.id === currentProfile?.uid) {
            onToast("No podes borrar tu propio usuario desde esta pantalla.");
            return;
          }
          const label = userItem.nombre || userItem.email || userItem.id;
          if (!window.confirm(`Borrar el usuario "${label}" de la app? Se eliminaran sus permisos, perfil, presencia y estadisticas de usuario.`)) return;
          try {
            await deleteAppUser(userItem);
            setEditing(null);
            await onRefresh();
            onToast("Usuario borrado de la app.");
          } catch (error) {
            onToast(error.message || "No se pudo borrar el usuario.");
          }
        }}
      />
    );
  }

  const usersWithPresence = users
    .map((item) => {
      const userPresence = presence[item.id] || {};
      return {
        ...item,
        _presence: userPresence,
        _isOnline: isUserOnline(userPresence),
      };
    })
    .sort((a, b) => Number(b._isOnline) - Number(a._isOnline) || (a.nombre || a.email || "").localeCompare(b.nombre || b.email || ""));
  const onlineCount = usersWithPresence.filter((item) => item._isOnline).length;

  return (
    <div className="list">
      <header className="admin-list-head user-list-head">
        <strong>Usuarios registrados</strong>
        <small>{users.length} usuario{users.length === 1 ? "" : "s"} en total - {onlineCount} conectado{onlineCount === 1 ? "" : "s"} ahora</small>
      </header>
      {usersWithPresence.map((item) => (
        <button className="admin-row user-row" key={item.id} onClick={() => setEditing(item)}>
          <span className="user-avatar-presence">
            <Avatar src={item.foto_url} name={item.nombre || item.email || "Usuario"} />
            <span className={`presence-dot ${item._isOnline ? "online" : ""}`} title={item._isOnline ? "Conectado" : "Desconectado"} />
          </span>
          <span>
            <strong>{item.nombre || item.email || item.id}</strong>
            <small>{item.email || ""}</small>
            <small>{item._isOnline ? "Conectado en la plataforma" : lastSeenText(item._presence?.lastActiveAt)}</small>
            <small>{userPermissionText(item)}</small>
          </span>
          <SlidersHorizontal size={20} />
        </button>
      ))}
    </div>
  );
}

function DriveArchive() {
  const [stack, setStack] = useState([{ id: DRIVE_ARCHIVE_FOLDER_ID, name: "myashram" }]);
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [markdown, setMarkdown] = useState(null);
  const currentFolder = stack[stack.length - 1];

  useEffect(() => {
    if (!GOOGLE_DRIVE_API_KEY) return;
    loadFolder(currentFolder.id);
  }, [currentFolder.id]);

  async function loadFolder(folderId) {
    setLoading(true);
    setError("");
    setMarkdown(null);
    try {
      setFiles(await fetchDriveChildren(folderId));
    } catch (err) {
      setError(err.message || "No se pudo leer la carpeta de Drive.");
    } finally {
      setLoading(false);
    }
  }

  function openFolder(file) {
    setStack((current) => [...current, { id: file.id, name: file.name }]);
  }

  function goToFolder(index) {
    setStack((current) => current.slice(0, index + 1));
  }

  async function openMarkdown(file) {
    setLoading(true);
    setError("");
    try {
      const text = await fetchDriveText(file.id);
      setMarkdown({ file, text, meta: parseMarkdownFrontmatter(text) });
    } catch (err) {
      setError(err.message || "No se pudo abrir el Markdown.");
    } finally {
      setLoading(false);
    }
  }

  if (!GOOGLE_DRIVE_API_KEY) {
    return (
      <div className="archive-panel">
        <h2>Archivo Drive</h2>
        <p>La carpeta ya esta configurada. Para mostrar el arbol automaticamente falta agregar la API key de Google Drive.</p>
        <a className="primary small" href={DRIVE_ARCHIVE_FOLDER_URL} target="_blank" rel="noreferrer">
          Abrir carpeta en Drive
        </a>
        <small>Variable esperada: VITE_GOOGLE_DRIVE_API_KEY</small>
      </div>
    );
  }

  return (
    <div className="archive-panel">
      <div className="archive-head">
        <span>
          <h2>Archivo Drive</h2>
          <small>Carpetas, imagenes, PDFs y notas Markdown del archivo myashram.</small>
        </span>
        <a className="ghost compact" href={DRIVE_ARCHIVE_FOLDER_URL} target="_blank" rel="noreferrer">Drive</a>
      </div>
      <div className="archive-breadcrumbs">
        {stack.map((folder, index) => (
          <button key={folder.id} type="button" onClick={() => goToFolder(index)}>
            {folder.name}
          </button>
        ))}
      </div>
      {loading ? <p className="empty-state">Leyendo Drive...</p> : null}
      {error ? <p className="fallback-error">{error}</p> : null}
      <div className="archive-list">
        {files.map((file) => {
          const isFolder = file.mimeType === "application/vnd.google-apps.folder";
          const isMarkdown = isMarkdownFile(file);
          return (
            <button
              className="archive-row"
              key={file.id}
              type="button"
              onClick={() => {
                if (isFolder) openFolder(file);
                else if (isMarkdown) openMarkdown(file);
                else window.open(file.webViewLink, "_blank", "noopener,noreferrer");
              }}
            >
              {file.thumbnailLink ? <img src={file.thumbnailLink} alt="" /> : <span className="archive-file-icon">{driveFileIcon(file)}</span>}
              <span>
                <strong>{file.name}</strong>
                <small>{isFolder ? "Carpeta" : driveFileLabel(file)}</small>
              </span>
            </button>
          );
        })}
      </div>
      {markdown ? (
        <article className="archive-markdown">
          <div className="form-head">
            <h2>{markdown.meta.titulo || markdown.file.name}</h2>
            <a className="ghost compact" href={markdown.file.webViewLink} target="_blank" rel="noreferrer">Drive</a>
          </div>
          {Object.keys(markdown.meta).length ? (
            <dl>
              {Object.entries(markdown.meta).map(([key, value]) => (
                <div key={key}>
                  <dt>{key}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          ) : null}
          <pre>{stripMarkdownFrontmatter(markdown.text)}</pre>
        </article>
      ) : null}
    </div>
  );
}

function UserEditor({ userItem, courseSeries, onCancel, onSaved, onDelete }) {
  const [form, setForm] = useState({
    nombre: userItem.nombre || "",
    domicilio: userItem.domicilio || "",
    telefono: userItem.telefono || "",
    localidad: userItem.localidad || "",
    codigo_postal: userItem.codigo_postal || "",
    fecha_nacimiento: userItem.fecha_nacimiento || "",
    rol: userItem.rol || "usuario",
    permiso_conocimientos: Boolean(userItem.permiso_conocimientos),
    permiso_ejercicios: Boolean(userItem.permiso_ejercicios),
    etiquetas_conocimiento: labelsFromValue(userItem.etiquetas_conocimiento),
    etiquetas_ejercicios: labelsFromValue(userItem.etiquetas_ejercicios),
  });
  const [busy, setBusy] = useState(false);
  const knowledgeSeries = mergeSeriesOptions(courseSeries?.conocimiento, form.etiquetas_conocimiento);
  const exerciseSeries = mergeSeriesOptions(courseSeries?.ejercicios, form.etiquetas_ejercicios);

  function setField(key, value) {
    setForm((old) => ({ ...old, [key]: value }));
  }

  function toggleLabel(group, label, checked) {
    setForm((old) => {
      const nextLabels = { ...old[group] };
      if (checked) nextLabels[label] = true;
      else delete nextLabels[label];
      return { ...old, [group]: nextLabels };
    });
  }

  async function save(event) {
    event.preventDefault();
    setBusy(true);
    const userPatch = {
      nombre: cleanText(form.nombre),
      domicilio: cleanText(form.domicilio),
      telefono: cleanText(form.telefono),
      localidad: cleanText(form.localidad),
      codigo_postal: cleanText(form.codigo_postal),
      fecha_nacimiento: cleanText(form.fecha_nacimiento),
      rol: form.rol,
      permiso_conocimientos: form.permiso_conocimientos,
      permiso_ejercicios: form.permiso_ejercicios,
      etiquetas_conocimiento: cleanLabelMap(form.etiquetas_conocimiento),
      etiquetas_ejercicios: cleanLabelMap(form.etiquetas_ejercicios),
    };
    await Promise.all([
      update(ref(db, `usuarios/${userItem.id}`), userPatch),
      setDoc(doc(firestoreDb, "users", userItem.id), { ...userPatch, uid: userItem.id, email: userItem.email || "", updatedAt: serverTimestamp() }, { merge: true }),
    ]);
    setBusy(false);
    onSaved();
  }

  return (
    <form className="admin-form" onSubmit={save}>
      <div className="form-head">
        <h2>{userItem.email || "Usuario"}</h2>
        <button className="icon-btn" type="button" onClick={onCancel}><X size={18} /></button>
      </div>
      <label>Nombre<input value={form.nombre} onChange={(e) => setField("nombre", e.target.value)} /></label>
      <label>Domicilio<input value={form.domicilio} onChange={(e) => setField("domicilio", e.target.value)} /></label>
      <label>Telefono<input value={form.telefono} onChange={(e) => setField("telefono", e.target.value)} /></label>
      <label>Localidad<input value={form.localidad} onChange={(e) => setField("localidad", e.target.value)} /></label>
      <label>Codigo postal<input value={form.codigo_postal} onChange={(e) => setField("codigo_postal", e.target.value)} /></label>
      <label>Fecha nacimiento<input value={form.fecha_nacimiento} onChange={(e) => setField("fecha_nacimiento", e.target.value)} /></label>
      <label>Rol
        <select value={form.rol} onChange={(e) => setField("rol", e.target.value)}>
          <option value="usuario">Usuario</option>
          <option value="admin">Admin</option>
        </select>
      </label>
      <label className="check-row">
        <input type="checkbox" checked={form.permiso_conocimientos} onChange={(e) => setField("permiso_conocimientos", e.target.checked)} />
        Acceso total conocimiento
      </label>
      <CourseSeriesChecks
        title="Series conocimiento"
        emptyText="Todavia no hay series cargadas en Conocimiento."
        options={knowledgeSeries}
        selected={form.etiquetas_conocimiento}
        onChange={(label, checked) => toggleLabel("etiquetas_conocimiento", label, checked)}
      />
      <label className="check-row">
        <input type="checkbox" checked={form.permiso_ejercicios} onChange={(e) => setField("permiso_ejercicios", e.target.checked)} />
        Acceso total ejercicios
      </label>
      <CourseSeriesChecks
        title="Series ejercicios"
        emptyText="Todavia no hay series cargadas en Ejercicios."
        options={exerciseSeries}
        selected={form.etiquetas_ejercicios}
        onChange={(label, checked) => toggleLabel("etiquetas_ejercicios", label, checked)}
      />
      <div className="user-editor-actions">
        <button className="primary" disabled={busy}>{busy ? "Guardando..." : "Guardar cambios"}</button>
        <button className="ghost danger" type="button" disabled={busy} onClick={() => onDelete?.(userItem)}>
          <Trash2 size={16} /> Borrar usuario
        </button>
      </div>
    </form>
  );
}

async function deleteAppUser(userItem) {
  if (!userItem?.id) throw new Error("Usuario invalido.");
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error("Necesitas iniciar sesion como administrador.");
  const response = await fetch("/api/delete-user", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ uid: userItem.id }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.ok !== true) throw new Error(body.error || "No se pudo borrar el usuario.");
  await deleteStoragePath(userItem.foto_path);
}

function isUserOnline(presence = {}) {
  if (!presence.isOnline) return false;
  const lastActive = timestampToMillis(presence.lastActiveAt);
  if (!lastActive) return false;
  return Date.now() - lastActive <= 1000 * 60 * 3;
}

function lastSeenText(value) {
  const lastActive = timestampToMillis(value);
  if (!lastActive) return "Sin actividad reciente";
  const minutes = Math.max(1, Math.round((Date.now() - lastActive) / 60000));
  if (minutes < 60) return `Ultima actividad hace ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `Ultima actividad hace ${hours} h`;
  return `Ultima actividad: ${new Date(lastActive).toLocaleDateString("es-AR")}`;
}

function timestampToMillis(value) {
  if (!value) return 0;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (typeof value.seconds === "number") return value.seconds * 1000;
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

function CourseSeriesChecks({ title, emptyText, options, selected, onChange }) {
  return (
    <fieldset>
      <legend>{title}</legend>
      {options.length === 0 ? <small>{emptyText}</small> : null}
      {options.map((label) => (
        <label className="check-row" key={label}>
          <input
            type="checkbox"
            checked={Boolean(selected?.[label])}
            onChange={(event) => onChange(label, event.target.checked)}
          />
          {label}
        </label>
      ))}
    </fieldset>
  );
}

function AdminForm({ section, item, onCancel, onSaved, onToast, seriesOptions = [] }) {
  const isBook = section === "biblioteca";
  const isBlog = section === "blog";
  const isBanner = section === "banners";
  const isMeditation = section === "meditaciones";
  const isSatsang = section === "satsang";
  const isCourseSection = ["conocimiento", "ejercicios"].includes(section);
  const isKnowledge = section === "conocimiento";
  const hasAccessMode = isBook || isMeditation;
  const includePdf = isBook || section === "conocimiento";
  const includeEpub = isBook || section === "conocimiento";
  const existingPdfUrl = item.pdf_url || item.pdf || "";
  const existingEpubUrl = item.epub_url || item.epub || "";
  const existingEpubLabel = item.epub_file_name || item.epub_title || (existingEpubUrl ? "EPUB ya generado" : "");
  const [form, setForm] = useState({
    titulo: item.tema || item.titulo || "",
    descripcion: item.descripcion || "",
    categoria: item.categoria || item.etiqueta || "",
    autor: item.autor || "",
    video: item.link_video_original || item.video || "",
    orden: item.orden || "",
    blog_id: item.blog_id || item.blogId || item.post_id || item.postId || "",
    detalle: item.detalle || "",
    link_drive: item.link_drive || "",
    keywords: contentKeywords(item),
    precio: item.precio || "",
    acceso: item.acceso || item.tipo_acceso || "gratis",
    curso_acceso: item.curso_acceso || item.acceso_curso || "suscripcion",
  });
  const [blogPosts, setBlogPosts] = useState([]);
  const [image, setImage] = useState(null);
  const [pdf, setPdf] = useState(null);
  const [epub, setEpub] = useState(null);
  const [audioFile, setAudioFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const seriesListId = `series-options-${section}`;

  useEffect(() => {
    if (isBanner) {
      loadList("blog").then((posts) => {
        setBlogPosts(posts.sort((a, b) => (b.fecha_carga || "").localeCompare(a.fecha_carga || "")));
      });
    }
  }, [isBanner]);

  function setField(key, value) {
    setForm((old) => ({ ...old, [key]: value }));
  }

  async function save(event) {
    event.preventDefault();
    if (!isKnowledge && !cleanText(form.titulo)) return onToast(isSatsang ? "Completa el tema." : "Completa el titulo.");
    if (!isKnowledge && !isBanner && !isMeditation && !isSatsang && !cleanText(form.categoria)) return onToast(isBook ? "Completa la categoria." : "Completa la etiqueta.");
    if (isBanner && !cleanText(form.blog_id)) return onToast("Selecciona el post del blog.");
    const existingAudio = item.audio_url || item.link_audio || item.audio || item.link_drive;
    if (isMeditation && !audioFile && !cleanText(form.link_drive) && !existingAudio) return onToast("Subi el audio M4A o completa una URL de audio.");
    if (!isKnowledge && !isSatsang && !image && !(item.portada_url || item.imagen)) return onToast("Selecciona una imagen.");
    if (!isKnowledge && includePdf && !pdf && !epub && !(item.pdf_url || item.pdf || item.epub_url || item.epub)) return onToast(isBook ? "Selecciona un PDF o EPUB." : "Selecciona un PDF.");

    setBusy(true);
    try {
      const data = {
        titulo: cleanText(form.titulo),
        descripcion: cleanText(form.descripcion),
        keywords: cleanText(form.keywords),
        fecha_creacion: item.fecha_creacion || new Date().toISOString(),
      };

      if (isBook) {
        data.categoria = cleanText(form.categoria);
        data.autor = cleanText(form.autor);
        data.acceso = form.acceso;
      } else if (isBlog) {
        data.etiqueta = cleanText(form.categoria);
        data.fecha_carga = item.fecha_carga || new Date().toISOString();
      } else if (isBanner) {
        data.orden = Number(form.orden) || 0;
        data.blog_id = cleanText(form.blog_id);
      } else if (isMeditation) {
        data.detalle = cleanText(form.detalle);
        data.link_drive = cleanText(form.link_drive);
        data.acceso = form.acceso;
      } else if (isSatsang) {
        data.tema = cleanText(form.titulo);
        data.titulo = cleanText(form.titulo);
        data.video = cleanText(form.video);
        data.link_video_original = cleanText(form.video);
      } else {
        data.etiqueta = cleanText(form.categoria);
        data.video = cleanText(form.video);
        data.link_video_original = cleanText(form.video);
        if (isCourseSection) {
          data.orden = Number(form.orden) || 0;
          data.curso_acceso = form.curso_acceso;
          if (isKnowledge) data.precio = toNumber(form.precio);
        }
      }

      if (isMeditation) {
        if (audioFile) {
          const uploaded = await uploadAudio(audioFile, "meditaciones/audios");
          data.audio_url = uploaded.url;
          data.audio_path = uploaded.path;
          data.link_audio = uploaded.url;
          data.audio = uploaded.url;
        } else {
          const savedAudio = item.audio_url || item.link_audio || item.audio || "";
          data.audio_url = item.audio_url || "";
          data.audio_path = item.audio_path || "";
          data.link_audio = savedAudio || cleanText(form.link_drive);
          data.audio = savedAudio || cleanText(form.link_drive);
        }
      }

      if (image) {
        const folder = isBook ? "biblioteca/portadas" : isBlog ? "blog/imagenes" : isMeditation ? "meditaciones/imagenes" : `contenidos/${section}/imagenes`;
        const uploaded = await uploadImageWithFallback(image, folder);
        if (isBook) {
          data.portada_url = uploaded.url;
          data.portada_path = uploaded.path;
          data.imagen = uploaded.url;
        } else {
          data.imagen = uploaded.url;
          data.imagen_path = uploaded.path;
        }
      } else {
        data.imagen = item.imagen || item.portada_url || "";
        data.portada_url = item.portada_url || "";
        data.portada_path = item.portada_path || "";
        data.imagen_path = item.imagen_path || "";
      }

      if (includePdf) {
        if (pdf) {
          const folder = isBook ? "biblioteca/pdfs" : `contenidos/${section}/pdfs`;
          const uploaded = await uploadPdf(pdf, folder);
          data.pdf = uploaded.url;
          data.pdf_url = isBook ? uploaded.url : item.pdf_url || "";
          data.pdf_path = uploaded.path;
        } else {
          data.pdf = item.pdf || item.pdf_url || "";
          data.pdf_url = item.pdf_url || item.pdf || "";
          data.pdf_path = item.pdf_path || "";
        }
      }

      if (includeEpub) {
        if (epub) {
          const parsedEpub = await parseEpubBuffer(await epub.arrayBuffer());
          const uploaded = await uploadEpub(epub, isBook ? "biblioteca/epubs" : `contenidos/${section}/epubs`);
          data.epub = uploaded.url;
          data.epub_url = uploaded.url;
          data.epub_path = uploaded.path;
          data.epub_file_name = epub.name;
          data.epub_title = parsedEpub.title || cleanText(form.titulo);
          data.epub_chapters = parsedEpub.chapters;
        } else {
          data.epub = item.epub || item.epub_url || "";
          data.epub_url = item.epub_url || item.epub || "";
          data.epub_path = item.epub_path || "";
          data.epub_file_name = item.epub_file_name || "";
          data.epub_title = item.epub_title || "";
          data.epub_chapters = item.epub_chapters || [];
        }
      }

      let savedId = item.id;
      if (item.id) {
        await update(ref(db, `${section}/${item.id}`), data);
      } else {
        const itemRef = await push(ref(db, section), data);
        savedId = itemRef.key;
      }

      onSaved({ id: savedId, ...item, ...data });
    } catch (error) {
      onToast(error.message || "No se pudo guardar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="admin-form" onSubmit={save}>
      <div className="form-head">
        <h2>{item.id ? "Editar" : "Nuevo"}</h2>
        <button className="icon-btn" type="button" onClick={onCancel}><X size={18} /></button>
      </div>
      <label>{isSatsang ? "Tema" : "Titulo"}<input value={form.titulo} onChange={(e) => setField("titulo", e.target.value)} /></label>
      {!isBanner ? <label>Descripcion<textarea value={form.descripcion} onChange={(e) => setField("descripcion", e.target.value)} /></label> : null}
      <label>Palabras clave<input value={form.keywords} onChange={(e) => setField("keywords", e.target.value)} placeholder="Ej: ansiedad, vata, calma, respiración, Ganesha" /></label>
      {hasAccessMode ? (
        <label>Tipo de acceso
          <select value={form.acceso} onChange={(e) => setField("acceso", e.target.value)}>
            <option value="gratis">Gratis</option>
            <option value="suscripcion">Por suscripcion</option>
            <option value="compra">Comprar</option>
          </select>
        </label>
      ) : null}
      {isMeditation ? <label>Detalle / sugerencia<textarea value={form.detalle} onChange={(e) => setField("detalle", e.target.value)} /></label> : null}
      {!isBanner && !isMeditation && !isSatsang ? (
        <label>{isBook ? "Categoria" : isCourseSection ? "Serie" : "Etiqueta"}
          <input
            value={form.categoria}
            onChange={(e) => setField("categoria", e.target.value)}
            list={isCourseSection ? seriesListId : undefined}
          />
          {isCourseSection ? (
            <datalist id={seriesListId}>
              {seriesOptions.map((serie) => <option value={serie} key={serie} />)}
            </datalist>
          ) : null}
        </label>
      ) : null}
      {isCourseSection ? (
        <label>Acceso del curso
          <select value={form.curso_acceso} onChange={(e) => setField("curso_acceso", e.target.value)}>
            <option value="suscripcion">Primera clase gratis y resto por suscripcion</option>
            <option value="gratis">Acceso libre a todo el curso</option>
          </select>
        </label>
      ) : null}
      {isKnowledge ? <label>Precio del curso<input type="number" inputMode="decimal" step="0.001" min="0" value={form.precio} onChange={(e) => setField("precio", e.target.value)} placeholder="Ej: 15000.000" /></label> : null}
      {isCourseSection ? <label>Orden de clase<input value={form.orden} onChange={(e) => setField("orden", e.target.value)} type="number" min="1" /></label> : null}
      {isBanner ? <label>Orden<input value={form.orden} onChange={(e) => setField("orden", e.target.value)} type="number" /></label> : null}
      {isBanner ? (
        <label>Post del blog
          <select value={form.blog_id} onChange={(e) => setField("blog_id", e.target.value)}>
            <option value="">Seleccionar post</option>
            {blogPosts.map((post) => (
              <option key={post.id} value={post.id}>{post.titulo || "Sin titulo"}</option>
            ))}
          </select>
        </label>
      ) : null}
      {isBook ? <label>Autor<input value={form.autor} onChange={(e) => setField("autor", e.target.value)} /></label> : null}
      {isMeditation ? <label>URL de audio M4A<input value={form.link_drive} onChange={(e) => setField("link_drive", e.target.value)} /></label> : null}
      {!isBook && !isBlog && !isBanner && !isMeditation ? <label>Link video YouTube<input value={form.video} onChange={(e) => setField("video", e.target.value)} /></label> : null}
      {!isSatsang ? <FileInput icon={ImageIcon} label="Imagen" file={image} accept="image/jpeg,image/png,image/webp" onChange={setImage} /> : null}
      {isMeditation ? <FileInput icon={Upload} label="Audio M4A" file={audioFile} accept="audio/mp4,audio/x-m4a,.m4a" onChange={setAudioFile} /> : null}
      {includePdf ? <FileInput icon={Upload} label="PDF" file={pdf} existingLabel={existingPdfUrl ? "PDF ya cargado" : ""} existingUrl={existingPdfUrl} accept="application/pdf" onChange={setPdf} /> : null}
      {includeEpub ? <FileInput icon={Upload} label="EPUB" file={epub} existingLabel={existingEpubLabel} existingUrl={existingEpubUrl} accept="application/epub+zip,.epub" onChange={setEpub} /> : null}
      <button className="primary" disabled={busy}>{busy ? "Subiendo..." : "Guardar"}</button>
    </form>
  );
}

function EnVivo({ user, profile, onBack, onToast }) {
  const [liveConfig, setLiveConfig] = useState({
    videoUrl: DEFAULT_LIVE_VIDEO,
    titulo: "Satsang en vivo",
    proximoTexto: "Próximo satsang",
  });
  const [adminDraft, setAdminDraft] = useState({
    videoUrl: DEFAULT_LIVE_VIDEO,
    titulo: "Satsang en vivo",
    proximoTexto: "Próximo satsang",
  });
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const isAdmin = isAdminProfile(profile, user);
  const activeVideo = liveConfig.videoUrl || liveConfig.videoId || DEFAULT_LIVE_VIDEO;
  const embedUrl = liveEmbedUrl(activeVideo);
  const isLive = Boolean(embedUrl);

  useEffect(() => {
    const unsubscribeConfig = onSnapshot(doc(firestoreDb, "config", "enVivo"), (snap) => {
      if (!snap.exists()) return;
      const data = snap.data() || {};
      setLiveConfig((current) => ({
        ...current,
        videoUrl: data.videoUrl || data.link || "",
        videoId: data.videoId || "",
        titulo: data.titulo || current.titulo,
        proximoTexto: data.proximoTexto || current.proximoTexto,
      }));
      setAdminDraft({
        videoUrl: data.videoUrl || data.link || "",
        titulo: data.titulo || "Satsang en vivo",
        proximoTexto: data.proximoTexto || "Próximo satsang",
      });
    });

    const messagesQuery = query(collection(firestoreDb, "enVivoMensajes"), orderBy("createdAt", "asc"), limit(100));
    const unsubscribeMessages = onSnapshot(messagesQuery, (snap) => {
      setMessages(snap.docs.map((item) => ({ id: item.id, ...item.data() })));
    });

    return () => {
      unsubscribeConfig();
      unsubscribeMessages();
    };
  }, []);

  async function saveLiveConfig(event) {
    event.preventDefault();
    if (!isAdmin) return;
    setSavingConfig(true);
    try {
      await setDoc(doc(firestoreDb, "config", "enVivo"), {
        videoUrl: adminDraft.videoUrl.trim(),
        titulo: adminDraft.titulo.trim() || "Satsang en vivo",
        proximoTexto: adminDraft.proximoTexto.trim() || "Próximo satsang",
        actualizadoEn: serverTimestamp(),
        actualizadoPor: user?.uid || "",
      }, { merge: true });
      onToast?.("Link del vivo actualizado.");
    } catch {
      onToast?.("No se pudo guardar el link del vivo.");
    } finally {
      setSavingConfig(false);
    }
  }

  async function sendLiveMessage(event) {
    event.preventDefault();
    const cleanMessage = text.trim();
    if (!user) {
      onToast?.("Inicia sesion para comentar en el vivo.");
      return;
    }
    if (!cleanMessage) return;
    setBusy(true);
    try {
      await addDoc(collection(firestoreDb, "enVivoMensajes"), {
        uid: user.uid,
        nombre: profileDisplayName(profile) || "Usuario",
        texto: cleanMessage,
        rol: isAdmin ? "admin" : "usuario",
        createdAt: serverTimestamp(),
      });
      setText("");
    } catch {
      onToast?.("No se pudo enviar el mensaje.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="content-page live-page">
      <PageTitle icon={Video} title="En Vivo" subtitle="Satsang, practica y comunidad en tiempo real." onBack={onBack} />
      <div className="live-status-card">
        <span className={`live-pill ${isLive ? "active" : ""}`}>{isLive ? "En vivo ahora" : "Próximo satsang"}</span>
        <strong>{isLive ? liveConfig.titulo || "Transmisión en vivo" : liveConfig.proximoTexto || "Próximo satsang"}</strong>
        <small>{isLive ? "Podes mirar la transmision y compartir en el chat comunitario." : "Todavia no hay transmision activa. El chat queda disponible para la comunidad."}</small>
      </div>

      {isAdmin ? (
        <form className="live-admin-card" onSubmit={saveLiveConfig}>
          <header>
            <strong>Administrar transmision</strong>
            <small>Solo vos ves este panel.</small>
          </header>
          <label>
            Link de YouTube Live
            <input
              value={adminDraft.videoUrl}
              onChange={(event) => setAdminDraft((current) => ({ ...current, videoUrl: event.target.value }))}
              placeholder="https://www.youtube.com/watch?v=..."
            />
          </label>
          <label>
            Titulo visible
            <input
              value={adminDraft.titulo}
              onChange={(event) => setAdminDraft((current) => ({ ...current, titulo: event.target.value }))}
              placeholder="Satsang en vivo"
            />
          </label>
          <label>
            Texto cuando no hay vivo
            <input
              value={adminDraft.proximoTexto}
              onChange={(event) => setAdminDraft((current) => ({ ...current, proximoTexto: event.target.value }))}
              placeholder="Próximo satsang"
            />
          </label>
          <div className="live-admin-actions">
            <button
              className="ghost compact"
              type="button"
              onClick={() => setAdminDraft((current) => ({ ...current, videoUrl: "" }))}
            >
              Dejar sin vivo
            </button>
            <button className="primary" disabled={savingConfig}>
              {savingConfig ? "Guardando..." : "Guardar link"}
            </button>
          </div>
        </form>
      ) : null}

      <div className="live-video-frame">
        {embedUrl ? (
          <iframe
            title="Ashram Ganesha en vivo"
            src={embedUrl}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        ) : (
          <div className="live-placeholder">
            <Video size={42} />
            <strong>Próximo satsang</strong>
            <small>Cuando haya un link activo, el video aparecera aqui.</small>
          </div>
        )}
      </div>

      <div className="live-chat-card">
        <header>
          <span>
            <strong>Chat comunitario</strong>
            <small>{user ? "Compartiendo como " + profileDisplayName(profile) : "Inicia sesion para comentar"}</small>
          </span>
        </header>
        <div className="live-chat-messages">
          {messages.length === 0 ? <p className="empty-state">Aun no hay mensajes en este vivo.</p> : null}
          {messages.map((message) => (
            <article className="live-chat-message" key={message.id}>
              <strong>{message.nombre || "Usuario"}</strong>
              <p>{message.texto}</p>
              <small>{formatLiveDate(message.createdAt, message.createdAtLocal)}</small>
            </article>
          ))}
        </div>
        <form className="live-chat-input" onSubmit={sendLiveMessage}>
          <input
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder={user ? "Escribe un mensaje..." : "Inicia sesion para comentar"}
            disabled={!user || busy}
          />
          <button className="primary" disabled={!user || busy}>
            Enviar
          </button>
        </form>
      </div>
    </section>
  );
}

function ProductAdminForm({ item, categoryOptions = [], onCancel, onSaved, onToast }) {
  const [form, setForm] = useState({
    nombre: item.nombre || "",
    descripcion: item.descripcion || "",
    precio: item.precio || "",
    stock: item.stock ?? "",
    categoria: item.categoria || "",
    video_url: item.video_url || item.videoUrl || item.video || item.link_video || "",
    estado: item.estado || item.disponibilidad || "disponible",
    variantes: item.variantes || "",
    orden: item.orden ?? "",
    keywords: contentKeywords(item),
    activo: item.activo !== false,
  });
  const [image, setImage] = useState(null);
  const [detailImage, setDetailImage] = useState(null);
  const [busy, setBusy] = useState(false);

  function setField(key, value) {
    setForm((old) => ({ ...old, [key]: value }));
  }

  async function save(event) {
    event.preventDefault();
    if (!cleanText(form.nombre)) return onToast("Completa el nombre.");
    if (!image && !item.imagen) return onToast("Selecciona la imagen del catalogo.");

    setBusy(true);
    try {
      const data = {
        nombre: cleanText(form.nombre),
        descripcion: cleanText(form.descripcion),
        precio: toNumber(form.precio),
        stock: Math.max(0, Math.trunc(toNumber(form.stock))),
        categoria: resolveStoreCategory(form.categoria, categoryOptions),
        video_url: cleanText(form.video_url),
        estado: cleanText(form.estado) || "disponible",
        variantes: cleanText(form.variantes),
        orden: Math.max(0, Math.trunc(toNumber(form.orden))),
        keywords: cleanText(form.keywords),
        activo: Boolean(form.activo),
        fecha_creacion: item.fecha_creacion || new Date().toISOString(),
      };

      if (image) {
        const uploaded = await uploadImageWithFallback(image, "productos/imagenes");
        data.imagen = uploaded.url;
        data.imagen_path = uploaded.path;
      } else {
        data.imagen = item.imagen || "";
        data.imagen_path = item.imagen_path || "";
      }

      if (detailImage) {
        const uploadedDetail = await uploadImageWithFallback(detailImage, "productos/detalle");
        data.imagen_detalle = uploadedDetail.url;
        data.imagen_detalle_path = uploadedDetail.path;
      } else {
        data.imagen_detalle = productDetailImage(item) === productMainImage(item) ? "" : productDetailImage(item);
        data.imagen_detalle_path = item.imagen_detalle_path || item.detalle_imagen_path || "";
      }

      if (item.id) {
        await update(ref(db, `productos/${item.id}`), data);
      } else {
        await push(ref(db, "productos"), data);
      }
      onSaved();
    } catch (error) {
      onToast(error.message || "No se pudo guardar el producto.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="admin-form" onSubmit={save}>
      <div className="form-head">
        <h2>{item.id ? "Editar producto" : "Nuevo producto"}</h2>
        <button className="icon-btn" type="button" onClick={onCancel}><X size={18} /></button>
      </div>
      <div className="product-form-main">
        <label>Nombre<input value={form.nombre} onChange={(event) => setField("nombre", event.target.value)} /></label>
        <label>Descripcion<textarea value={form.descripcion} onChange={(event) => setField("descripcion", event.target.value)} /></label>
        <label>Precio<input inputMode="decimal" value={form.precio} onChange={(event) => setField("precio", event.target.value)} placeholder="Dejar vacío para confirmar por WhatsApp" /></label>
        <label>Stock<input type="number" min="0" value={form.stock} onChange={(event) => setField("stock", event.target.value)} /></label>
        <label>Categoria
          <input
            list="store-product-categories"
            value={form.categoria}
            onChange={(event) => setField("categoria", event.target.value)}
            placeholder={categoryOptions.length ? "Elegí una existente o escribí una nueva" : "Ej: Sahumerios, Bienestar, Regalos"}
          />
          <datalist id="store-product-categories">
            {categoryOptions.map((category) => <option key={category} value={category} />)}
          </datalist>
        </label>
        <label>Disponibilidad
          <select value={form.estado} onChange={(event) => setField("estado", event.target.value)}>
            <option value="disponible">Disponible</option>
            <option value="por encargo">Por encargo</option>
            <option value="agotado">Agotado</option>
          </select>
        </label>
        <label>Variantes<input value={form.variantes} onChange={(event) => setField("variantes", event.target.value)} placeholder="Ej: chico, mediano, grande" /></label>
        <label>Orden<input type="number" min="0" value={form.orden} onChange={(event) => setField("orden", event.target.value)} /></label>
        <label>Palabras clave<input value={form.keywords} onChange={(event) => setField("keywords", event.target.value)} placeholder="Ej: ansiedad, vata, calma, respiración, Ganesha" /></label>
        <label className="check-row">
          <input type="checkbox" checked={form.activo} onChange={(event) => setField("activo", event.target.checked)} />
          Producto activo
        </label>
      </div>
      <div className="product-media-row">
        <section>
          <strong>Foto catálogo</strong>
          {item.imagen ? <img className="form-preview" src={item.imagen} alt="" /> : null}
          <FileInput icon={ImageIcon} label="Imagen catalogo" file={image} accept="image/jpeg,image/png,image/webp" onChange={setImage} />
        </section>
        <section>
          <strong>Foto detalle</strong>
          {productDetailImage(item) !== productMainImage(item) ? <img className="form-preview" src={productDetailImage(item)} alt="" /> : null}
          <FileInput icon={ImageIcon} label="Imagen detalle" file={detailImage} accept="image/jpeg,image/png,image/webp" onChange={setDetailImage} />
        </section>
        <section>
          <strong>Video</strong>
          <label>Link opcional<input value={form.video_url} onChange={(event) => setField("video_url", event.target.value)} placeholder="YouTube o Instagram" /></label>
          {form.video_url ? <small>&#127916; Se mostrará como video en el producto.</small> : <small>Sin video cargado.</small>}
        </section>
      </div>
      <button className="primary" disabled={busy}>{busy ? "Guardando..." : "Guardar producto"}</button>
    </form>
  );
}

function FileInput({ icon: Icon, label, accept, file, existingLabel = "", existingUrl = "", onChange }) {
  return (
    <label className="file-field">
      <Icon size={18} />
      <span>{file ? file.name : existingLabel ? `${label} cargado: ${existingLabel}` : `Seleccionar ${label}`}</span>
      {existingUrl && !file ? <a href={existingUrl} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}>Abrir</a> : null}
      <input type="file" accept={accept} onChange={(e) => onChange(e.target.files?.[0] || null)} />
    </label>
  );
}

function Perfil({ user, profile, pendingSubscription, onBack, onProfileSaved, onSubscriptionSent, onToast }) {
  const [form, setForm] = useState({
    nombre: profile?.nombre || "",
    domicilio: profile?.domicilio || "",
    telefono: profile?.telefono || "",
    localidad: profile?.localidad || "",
    codigo_postal: profile?.codigo_postal || "",
    fecha_nacimiento: profile?.fecha_nacimiento || "",
    foto_url: profile?.foto_url || "",
    foto_path: profile?.foto_path || "",
  });
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(profile?.foto_url || "");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!photoFile) {
      setPhotoPreview(form.foto_url || "");
      return;
    }
    const preview = URL.createObjectURL(photoFile);
    setPhotoPreview(preview);
    return () => URL.revokeObjectURL(preview);
  }, [photoFile, form.foto_url]);

  function setField(key, value) {
    setForm((old) => ({ ...old, [key]: value }));
  }

  function selectPhoto(file) {
    if (!file) return;
    setPhotoFile(file);
  }

  async function save(event) {
    event.preventDefault();
    const cleanedProfile = {
      nombre: cleanText(form.nombre),
      domicilio: cleanText(form.domicilio),
      telefono: cleanText(form.telefono),
      localidad: cleanText(form.localidad),
      codigo_postal: cleanText(form.codigo_postal),
      fecha_nacimiento: cleanText(form.fecha_nacimiento),
      foto_url: form.foto_url || "",
      foto_path: form.foto_path || "",
      email: user.email,
    };
    const missing = missingProfileFields(cleanedProfile);
    if (pendingSubscription && missing.length > 0) {
      onToast?.(`Completa estos datos: ${missing.join(", ")}.`);
      return;
    }

    setBusy(true);
    try {
      const previousPhotoPath = form.foto_path;
      if (photoFile) {
        const uploaded = await uploadImageWithFallback(photoFile, `usuarios/${user.uid}/perfil`);
        cleanedProfile.foto_url = uploaded.url;
        cleanedProfile.foto_path = uploaded.path;
      }
      await Promise.all([
        update(ref(db, `usuarios/${user.uid}`), cleanedProfile),
        setDoc(doc(firestoreDb, "users", user.uid), { ...cleanedProfile, uid: user.uid, updatedAt: serverTimestamp() }, { merge: true }),
      ]);
      if (photoFile && previousPhotoPath && previousPhotoPath !== cleanedProfile.foto_path) {
        deleteStoragePath(previousPhotoPath).catch(() => {});
      }
      setPhotoFile(null);
      setForm((current) => ({
        ...current,
        foto_url: cleanedProfile.foto_url,
        foto_path: cleanedProfile.foto_path,
      }));
      onProfileSaved?.(cleanedProfile);
      onToast?.("Perfil guardado.");
      if (pendingSubscription) {
        onSubscriptionSent?.();
        openSubscriptionWhatsApp({ ...profile, ...cleanedProfile }, pendingSubscription, user.email);
      }
    } catch (error) {
      onToast?.(error.message || "No se pudo guardar el perfil.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="content-page">
      <PageTitle icon={User} title="Mi espacio" subtitle="Tus datos ayudan a acompanar mejor tu camino." onBack={onBack} />
      <form className="profile-card" onSubmit={save}>
        <label className="profile-photo-field">
          <Avatar src={photoPreview} name={form.nombre || user.email} size="large" />
          <span>Cambiar foto</span>
          <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => selectPhoto(e.target.files?.[0])} />
        </label>
        <h1>{form.nombre || user.email}</h1>
        <p>{isAdminProfile(profile, user) ? "Administrador" : "Usuario"} - {user.email}</p>
        {pendingSubscription ? (
          <div className="profile-notice">
            <strong>Completa tus datos para solicitar acceso</strong>
            <small>Al guardar se abrira WhatsApp con la solicitud para {subscriptionLabel(pendingSubscription)}.</small>
          </div>
        ) : null}
        <label>Nombre<input value={form.nombre} onChange={(e) => setField("nombre", e.target.value)} /></label>
        <label>Domicilio<input value={form.domicilio} onChange={(e) => setField("domicilio", e.target.value)} /></label>
        <label>Telefono<input value={form.telefono} onChange={(e) => setField("telefono", e.target.value)} /></label>
        <label>Localidad<input value={form.localidad} onChange={(e) => setField("localidad", e.target.value)} /></label>
        <label>Codigo postal<input value={form.codigo_postal} onChange={(e) => setField("codigo_postal", e.target.value)} /></label>
        <label>Fecha nacimiento<input value={form.fecha_nacimiento} onChange={(e) => setField("fecha_nacimiento", e.target.value)} /></label>
        <button className="primary" disabled={busy}>{busy ? "Guardando..." : "Guardar mi espacio"}</button>
      </form>
      <PushNotificationSettings
        mode={isAdminProfile(profile, user) ? "admin" : "user"}
        title={isAdminProfile(profile, user) ? "Avisos de administrador" : "Avisos del Ashram"}
        description={isAdminProfile(profile, user)
          ? "Recibi mensajes, pedidos y turnos en este telefono."
          : "Activa avisos para recibir novedades importantes del Ashram en este telefono."}
        onToast={onToast}
      />
    </section>
  );
}

function PageTitle({ icon: Icon, iconSrc, title, subtitle, onBack }) {
  return (
    <div className="page-title">
      {onBack ? (
        <button className="back-icon" onClick={onBack} aria-label="Volver">
          <ArrowLeft size={22} />
        </button>
      ) : null}
      {iconSrc ? <img className="page-title-icon" src={iconSrc} alt="" /> : <Icon size={26} />}
      <span>
        <h1>{title}</h1>
        {subtitle ? <small>{subtitle}</small> : null}
      </span>
    </div>
  );
}

function Avatar({ src, name, size = "medium" }) {
  return (
    <span className={`avatar-frame ${size}`}>
      {src ? <img src={src} alt={name || "Usuario"} /> : <User size={size === "large" ? 38 : 20} />}
    </span>
  );
}

function profileDisplayName(profile) {
  return cleanText(profile?.nombre) || cleanText(profile?.email) || "bienvenido";
}

function contentTitle(item) {
  return cleanText(item?.tema) || cleanText(item?.titulo) || "Sin titulo";
}

function ganeshaKnowledgeTitle(item) {
  return cleanText(item?.title) || cleanText(item?.titulo) || "Sin titulo";
}

function contentKeywords(item) {
  const keywords = item?.keywords || item?.palabras_clave || item?.palabrasClave || item?.keywordList || item?.tags || "";
  return Array.isArray(keywords) ? keywords.join(", ") : cleanText(keywords);
}

function sectionConfig(id) {
  return sections.find((section) => section.id === id) || adminSections.find((section) => section.id === id);
}

function defaultMainMenuConfig() {
  return Object.fromEntries(sections.map((section) => [section.id, section.id !== "ejercicios"]));
}

function normalizeMainMenuConfig(value) {
  const defaults = defaultMainMenuConfig();
  if (!value || typeof value !== "object") return defaults;
  return Object.fromEntries(sections.map((section) => [section.id, value[section.id] ?? defaults[section.id]]));
}

function normalizeAppSettings(value) {
  const source = value && typeof value === "object" ? value : {};
  const soundIds = new Set(NOTIFICATION_SOUND_OPTIONS.map((option) => option.id));
  const themeIds = new Set(WELCOME_THEME_OPTIONS.map((option) => option.id));
  return {
    notificationSound: soundIds.has(source.notificationSound) ? source.notificationSound : DEFAULT_APP_SETTINGS.notificationSound,
    notificationVolume: Math.max(0.2, Math.min(1, Number(source.notificationVolume || DEFAULT_APP_SETTINGS.notificationVolume))),
    welcomeTitle: cleanText(source.welcomeTitle) || DEFAULT_APP_SETTINGS.welcomeTitle,
    welcomeText: cleanText(source.welcomeText),
    welcomeTheme: themeIds.has(source.welcomeTheme) ? source.welcomeTheme : DEFAULT_APP_SETTINGS.welcomeTheme,
    welcomeImageUrl: cleanText(source.welcomeImageUrl),
    welcomeImagePath: cleanText(source.welcomeImagePath),
    ceremonialEffects: normalizeCeremonialEffects(source.ceremonialEffects),
    ceremonialModules: normalizeCeremonialModules(source.ceremonialModules),
  };
}

function normalizeCeremonialModules(value) {
  const source = value && typeof value === "object" ? value : {};
  return {
    notifications: normalizeCeremonialNotificationModule(source.notifications || source.popup),
    ambient: normalizeCeremonialAmbientModule(source.ambient),
    header: normalizeCeremonialHeaderModule(source.header),
    content: normalizeCeremonialContentModule(source.content || source.gif || source.popup),
  };
}

function normalizeCeremonialBaseModule(value, defaults) {
  const source = value && typeof value === "object" ? value : {};
  return {
    ...defaults,
    enabled: source.enabled === true,
    eventName: cleanText(source.eventName),
    startDate: normalizeDateInput(source.startDate),
    endDate: normalizeDateInput(source.endDate),
    oncePerDay: source.showEveryVisit ? false : source.oncePerDay !== false,
    showEveryVisit: Boolean(source.showEveryVisit),
  };
}

function normalizeCeremonialAmbientModule(value) {
  const base = normalizeCeremonialBaseModule(value, DEFAULT_CEREMONIAL_MODULES.ambient);
  const allowed = new Set(["petals", "flowers", "gold_confetti", "leaves", "diya", "lanterns"]);
  const speedIds = new Set(["slow", "medium", "fast"]);
  const sizeIds = new Set(CEREMONIAL_SIZE_PRESETS.map((option) => option.id));
  return {
    ...base,
    type: allowed.has(value?.type) ? value.type : DEFAULT_CEREMONIAL_MODULES.ambient.type,
    durationSeconds: Math.max(1, Math.min(60, Number(value?.durationSeconds || base.durationSeconds))),
    amount: Math.max(6, Math.min(90, Number(value?.amount || base.amount))),
    speed: speedIds.has(value?.speed) ? value.speed : "medium",
    sizePreset: sizeIds.has(value?.sizePreset) ? value.sizePreset : "medium",
  };
}

function normalizeCeremonialHeaderModule(value) {
  const base = normalizeCeremonialBaseModule(value, DEFAULT_CEREMONIAL_MODULES.header);
  return {
    ...base,
    title: cleanText(value?.title),
    subtitle: cleanText(value?.subtitle),
    backgroundUrl: cleanText(value?.backgroundUrl),
    backgroundPath: cleanText(value?.backgroundPath),
    backgroundFileName: cleanText(value?.backgroundFileName),
    backgroundFit: ["cover", "contain"].includes(value?.backgroundFit) ? value.backgroundFit : "cover",
    backgroundPosition: cleanText(value?.backgroundPosition) || "center",
    darken: value?.darken !== false,
    backgroundOpacity: Math.max(0, Math.min(1, Number(value?.backgroundOpacity ?? DEFAULT_CEREMONIAL_MODULES.header.backgroundOpacity))),
  };
}

function normalizeCeremonialNotificationModule(value) {
  const base = normalizeCeremonialBaseModule(value, DEFAULT_CEREMONIAL_MODULES.notifications);
  return {
    ...base,
    title: cleanText(value?.title),
    message: cleanText(value?.message),
    imageUrl: cleanText(value?.imageUrl || value?.mediaUrl),
    imagePath: cleanText(value?.imagePath || value?.mediaPath),
    imageFileName: cleanText(value?.imageFileName || value?.mediaFileName),
  };
}

function normalizeCeremonialSequenceImages(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item, index) => {
      if (!item || typeof item !== "object") return null;
      const url = cleanText(item.url || item.mediaUrl || item.imageUrl);
      if (!url) return null;
      return {
        id: cleanText(item.id) || `seq-${index}-${firebaseKey(url).slice(0, 8)}`,
        url,
        path: cleanText(item.path || item.mediaPath || item.imagePath),
        fileName: cleanText(item.fileName || item.name || item.mediaFileName || `Imagen ${index + 1}`),
        contentType: cleanText(item.contentType || item.mediaContentType),
      };
    })
    .filter(Boolean);
}

function normalizeCeremonialSavedAnimations(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item, index) => {
      if (!item || typeof item !== "object") return null;
      const images = normalizeCeremonialSequenceImages(item.images || item.sequenceImages);
      if (!images.length) return null;
      return {
        id: cleanText(item.id) || `animation-${index}-${firebaseKey(item.name || "animacion")}`,
        name: cleanText(item.name) || `Animacion ${index + 1}`,
        images,
        sequenceSpeedValue: Math.max(1, Math.min(100, Number(item.sequenceSpeedValue || 55))),
        sequenceFrameMs: Math.max(30, Math.min(900, Number(item.sequenceFrameMs || 180))),
        sizePreset: ["small", "medium", "large", "custom"].includes(item.sizePreset) ? item.sizePreset : "medium",
        width: cleanText(item.width),
        height: cleanText(item.height),
        position: new Set(CEREMONIAL_POSITIONS.map((option) => option.id)).has(item.position) ? item.position : "center",
        repeat: Boolean(item.repeat),
        chromaEnabled: Boolean(item.chromaEnabled),
        chromaColor: /^#[0-9a-f]{6}$/i.test(cleanText(item.chromaColor)) ? cleanText(item.chromaColor) : "#00ff00",
        chromaSensitivity: Math.max(0.05, Math.min(0.9, Number(item.chromaSensitivity || DEFAULT_CEREMONIAL_MODULES.content.chromaSensitivity))),
        chromaSmoothing: Math.max(0, Math.min(0.5, Number(item.chromaSmoothing || DEFAULT_CEREMONIAL_MODULES.content.chromaSmoothing))),
        savedAt: cleanText(item.savedAt),
      };
    })
    .filter(Boolean);
}

function normalizeCeremonialContentModule(value) {
  const base = normalizeCeremonialBaseModule(value, DEFAULT_CEREMONIAL_MODULES.content);
  const sizeIds = new Set(CEREMONIAL_SIZE_PRESETS.map((option) => option.id));
  const positionIds = new Set(CEREMONIAL_POSITIONS.map((option) => option.id));
  const rawType = value?.contentType === "image" ? "gif" : value?.contentType;
  const contentType = ["sequence", "gif", "video", "message"].includes(rawType) ? rawType : value?.youtubeUrl || value?.contentType === "youtube" || value?.contentType === "local_video" ? "video" : "gif";
  return {
    ...base,
    contentType,
    animationName: cleanText(value?.animationName),
    sequenceImages: normalizeCeremonialSequenceImages(value?.sequenceImages),
    sequenceSpeed: ["slow", "normal", "fast", "custom"].includes(value?.sequenceSpeed) ? value.sequenceSpeed : "normal",
    sequenceSpeedValue: Math.max(1, Math.min(100, Number(value?.sequenceSpeedValue || DEFAULT_CEREMONIAL_MODULES.content.sequenceSpeedValue))),
    sequenceFrameMs: Math.max(30, Math.min(900, Number(value?.sequenceFrameMs || DEFAULT_CEREMONIAL_MODULES.content.sequenceFrameMs))),
    savedAnimations: normalizeCeremonialSavedAnimations(value?.savedAnimations),
    repeat: Boolean(value?.repeat),
    title: cleanText(value?.title),
    message: cleanText(value?.message),
    imageUrl: cleanText(value?.imageUrl),
    imagePath: cleanText(value?.imagePath),
    imageFileName: cleanText(value?.imageFileName),
    mediaUrl: cleanText(value?.mediaUrl),
    mediaPath: cleanText(value?.mediaPath),
    mediaFileName: cleanText(value?.mediaFileName),
    youtubeUrl: cleanText(value?.youtubeUrl),
    chromaEnabled: Boolean(value?.chromaEnabled),
    chromaColor: /^#[0-9a-f]{6}$/i.test(cleanText(value?.chromaColor)) ? cleanText(value.chromaColor) : "#00ff00",
    chromaSensitivity: Math.max(0.05, Math.min(0.9, Number(value?.chromaSensitivity || base.chromaSensitivity))),
    chromaSmoothing: Math.max(0, Math.min(0.5, Number(value?.chromaSmoothing || base.chromaSmoothing))),
    sizePreset: sizeIds.has(value?.sizePreset) ? value.sizePreset : "medium",
    width: cleanText(value?.width),
    height: cleanText(value?.height),
    position: positionIds.has(value?.position) ? value.position : "center",
    margin: Math.max(0, Math.min(80, Number(value?.margin ?? base.margin))),
    durationSeconds: Math.max(1, Math.min(60, Number(value?.durationSeconds || base.durationSeconds))),
    autoClose: value?.autoClose !== false,
    showOkButton: Boolean(value?.showOkButton),
  };
}

function ceremonialSequenceFrameMs(effect) {
  const speed = Math.max(1, Math.min(100, Number(effect?.sequenceSpeedValue || 0)));
  if (speed) return Math.round(700 - ((speed - 1) / 99) * 670);
  if (effect?.sequenceSpeed === "custom") return Math.max(30, Math.min(900, Number(effect.sequenceFrameMs || 180)));
  if (effect?.sequenceSpeed === "slow") return 280;
  if (effect?.sequenceSpeed === "fast") return 70;
  return 180;
}

function ceremonialSequenceSpeedLabel(effect) {
  const speed = Math.max(1, Math.min(100, Number(effect?.sequenceSpeedValue || 55)));
  if (speed < 25) return "Muy lenta";
  if (speed < 45) return "Lenta";
  if (speed < 70) return "Normal";
  if (speed < 88) return "Rapida";
  return "Muy rapida";
}

function sortCeremonialSequenceFiles(files) {
  return [...files].sort((a, b) => {
    const aNumber = firstNumberInText(a.name);
    const bNumber = firstNumberInText(b.name);
    if (aNumber !== bNumber) return aNumber - bNumber;
    return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" });
  });
}

function firstNumberInText(text) {
  const match = String(text || "").match(/\d+/);
  return match ? Number(match[0]) : Number.MAX_SAFE_INTEGER;
}

function normalizeCeremonialEffects(value) {
  if (!Array.isArray(value)) return [];
  return value.map(normalizeCeremonialEffect).filter(Boolean);
}

function normalizeCeremonialEffect(value) {
  if (!value || typeof value !== "object") return null;
  const typeIds = new Set(CEREMONIAL_EFFECT_TYPES.map((option) => option.id));
  const contentTypeIds = new Set(CEREMONIAL_CONTENT_TYPES.map((option) => option.id));
  const sizeIds = new Set(CEREMONIAL_SIZE_PRESETS.map((option) => option.id));
  const positionIds = new Set(CEREMONIAL_POSITIONS.map((option) => option.id));
  const type = typeIds.has(value.type) ? value.type : DEFAULT_CEREMONIAL_EFFECT.type;
  const contentType = contentTypeIds.has(value.contentType) ? value.contentType : inferCeremonialContentType(value);
  const duration = Math.max(1, Math.min(60, Number(value.durationSeconds || DEFAULT_CEREMONIAL_EFFECT.durationSeconds)));
  const oncePerDay = value.showEveryVisit ? false : value.oncePerDay !== false;
  return {
    id: cleanText(value.id) || `ceremony-${firebaseKey([value.name, value.startDate, type].filter(Boolean).join("-") || "event")}`,
    enabled: value.enabled !== false,
    name: cleanText(value.name),
    startDate: normalizeDateInput(value.startDate),
    endDate: normalizeDateInput(value.endDate),
    type,
    contentType,
    oncePerDay,
    showEveryVisit: Boolean(value.showEveryVisit),
    durationSeconds: duration,
    showOkButton: Boolean(value.showOkButton),
    message: cleanText(value.message),
    okButtonText: cleanText(value.okButtonText) || DEFAULT_CEREMONIAL_EFFECT.okButtonText,
    imageUrl: cleanText(value.imageUrl),
    mediaUrl: cleanText(value.mediaUrl),
    mediaPath: cleanText(value.mediaPath),
    mediaContentType: cleanText(value.mediaContentType),
    youtubeUrl: cleanText(value.youtubeUrl),
    chromaEnabled: Boolean(value.chromaEnabled),
    chromaColor: /^#[0-9a-f]{6}$/i.test(cleanText(value.chromaColor)) ? cleanText(value.chromaColor) : DEFAULT_CEREMONIAL_EFFECT.chromaColor,
    chromaSensitivity: Math.max(0.05, Math.min(0.9, Number(value.chromaSensitivity || DEFAULT_CEREMONIAL_EFFECT.chromaSensitivity))),
    chromaSmoothing: Math.max(0, Math.min(0.5, Number(value.chromaSmoothing || DEFAULT_CEREMONIAL_EFFECT.chromaSmoothing))),
    sizePreset: sizeIds.has(value.sizePreset) ? value.sizePreset : DEFAULT_CEREMONIAL_EFFECT.sizePreset,
    width: cleanText(value.width),
    height: cleanText(value.height),
    position: positionIds.has(value.position) ? value.position : DEFAULT_CEREMONIAL_EFFECT.position,
    margin: Math.max(0, Math.min(80, Number(value.margin ?? DEFAULT_CEREMONIAL_EFFECT.margin))),
    layers: normalizeCeremonialLayers(Array.isArray(value.layers) ? value.layers : legacyCeremonialLayers(value)),
  };
}

function normalizeCeremonialLayers(value) {
  if (!Array.isArray(value)) return [];
  return value.map(normalizeCeremonialLayer).filter(Boolean);
}

function normalizeCeremonialLayer(value) {
  if (!value || typeof value !== "object") return null;
  const layerIds = new Set(CEREMONIAL_LAYER_TYPES.map((option) => option.id));
  const sizeIds = new Set(CEREMONIAL_SIZE_PRESETS.map((option) => option.id));
  const positionIds = new Set(CEREMONIAL_POSITIONS.map((option) => option.id));
  const type = layerIds.has(value.type) ? value.type : DEFAULT_CEREMONIAL_LAYER.type;
  return {
    id: cleanText(value.id) || `layer-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    enabled: value.enabled !== false,
    type,
    title: cleanText(value.title),
    message: cleanText(value.message),
    mediaUrl: cleanText(value.mediaUrl || value.imageUrl),
    mediaPath: cleanText(value.mediaPath),
    mediaContentType: cleanText(value.mediaContentType),
    sequenceImages: normalizeCeremonialSequenceImages(value.sequenceImages),
    sequenceSpeed: ["slow", "normal", "fast", "custom"].includes(value.sequenceSpeed) ? value.sequenceSpeed : "normal",
    sequenceSpeedValue: Math.max(1, Math.min(100, Number(value.sequenceSpeedValue || DEFAULT_CEREMONIAL_MODULES.content.sequenceSpeedValue))),
    sequenceFrameMs: Math.max(30, Math.min(900, Number(value.sequenceFrameMs || DEFAULT_CEREMONIAL_MODULES.content.sequenceFrameMs))),
    youtubeUrl: cleanText(value.youtubeUrl),
    chromaEnabled: Boolean(value.chromaEnabled),
    chromaColor: /^#[0-9a-f]{6}$/i.test(cleanText(value.chromaColor)) ? cleanText(value.chromaColor) : DEFAULT_CEREMONIAL_LAYER.chromaColor,
    chromaSensitivity: Math.max(0.05, Math.min(0.9, Number(value.chromaSensitivity || DEFAULT_CEREMONIAL_LAYER.chromaSensitivity))),
    chromaSmoothing: Math.max(0, Math.min(0.5, Number(value.chromaSmoothing || DEFAULT_CEREMONIAL_LAYER.chromaSmoothing))),
    sizePreset: sizeIds.has(value.sizePreset) ? value.sizePreset : DEFAULT_CEREMONIAL_LAYER.sizePreset,
    width: cleanText(value.width),
    height: cleanText(value.height),
    position: positionIds.has(value.position) ? value.position : DEFAULT_CEREMONIAL_LAYER.position,
    margin: Math.max(0, Math.min(80, Number(value.margin ?? DEFAULT_CEREMONIAL_LAYER.margin))),
    durationSeconds: Math.max(1, Math.min(60, Number(value.durationSeconds || DEFAULT_CEREMONIAL_LAYER.durationSeconds))),
    repeat: value.repeat !== false,
    showOkButton: Boolean(value.showOkButton),
  };
}

function createCeremonialLayerDraft(type = "text") {
  return normalizeCeremonialLayer({
    ...DEFAULT_CEREMONIAL_LAYER,
    id: `layer-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    position: type === "diya" ? "bottom-right" : "center",
  });
}

function legacyCeremonialLayers(effect) {
  const layers = [];
  if (effect.type === "petals" || effect.type === "ganesha_petals") layers.push({ ...DEFAULT_CEREMONIAL_LAYER, type: "petals", durationSeconds: effect.durationSeconds });
  if (effect.type === "gold_confetti") layers.push({ ...DEFAULT_CEREMONIAL_LAYER, type: "gold_confetti", durationSeconds: effect.durationSeconds });
  if (effect.type === "diya") layers.push({ ...DEFAULT_CEREMONIAL_LAYER, type: "diya", position: "bottom-right", durationSeconds: effect.durationSeconds });
  if (effect.type === "ganesha" || effect.type === "ganesha_petals") layers.push({ ...DEFAULT_CEREMONIAL_LAYER, type: "ganesha", message: effect.message, durationSeconds: effect.durationSeconds });
  if (["image", "local_video", "youtube", "message"].includes(inferCeremonialContentType(effect)) || effect.type === "message") {
    layers.push({
      ...DEFAULT_CEREMONIAL_LAYER,
      type: effect.type === "message" ? "text" : inferCeremonialContentType(effect),
      title: effect.name,
      message: effect.message,
      mediaUrl: effect.mediaUrl || effect.imageUrl,
      mediaPath: effect.mediaPath,
      mediaContentType: effect.mediaContentType,
      youtubeUrl: effect.youtubeUrl,
      chromaEnabled: effect.chromaEnabled,
      chromaColor: effect.chromaColor,
      chromaSensitivity: effect.chromaSensitivity,
      chromaSmoothing: effect.chromaSmoothing,
      sizePreset: effect.sizePreset,
      width: effect.width,
      height: effect.height,
      position: effect.position,
      margin: effect.margin,
      durationSeconds: effect.durationSeconds,
      showOkButton: true,
    });
  }
  return layers.length ? layers : [{ ...DEFAULT_CEREMONIAL_LAYER, type: "text", title: effect.name, message: effect.message }];
}

function createCeremonialEffectDraft() {
  return normalizeCeremonialEffect({
    ...DEFAULT_CEREMONIAL_EFFECT,
    id: `ceremony-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  });
}

function ceremonialEffectTypeLabel(type) {
  return CEREMONIAL_EFFECT_TYPES.find((option) => option.id === type)?.label || "Efecto ceremonial";
}

function inferCeremonialContentType(value = {}) {
  if (value.youtubeUrl) return "youtube";
  if (value.mediaContentType?.startsWith?.("video/")) return "local_video";
  if (value.mediaUrl || value.imageUrl) return "image";
  return DEFAULT_CEREMONIAL_EFFECT.contentType;
}

function ceremonialEventNeedsOk(effect) {
  return Boolean(effect?.showOkButton || normalizeCeremonialLayers(effect?.layers).some((layer) => layer.showOkButton));
}

function ceremonialEventDuration(effect) {
  const layerDurations = normalizeCeremonialLayers(effect?.layers).map((layer) => Number(layer.durationSeconds || 0));
  return Math.max(1, Number(effect?.durationSeconds || 0), ...layerDurations);
}

function ceremonialYoutubeEmbedUrl(url, autoplay = false) {
  const embed = youtubeEmbedUrl(url);
  if (!embed) return "";
  const separator = embed.includes("?") ? "&" : "?";
  return autoplay ? `${embed}${separator}autoplay=1&mute=1` : embed;
}

function ceremonialBoxStyle(effect) {
  const presetWidth = {
    small: "min(280px, calc(100vw - 32px))",
    medium: "min(430px, calc(100vw - 32px))",
    large: "min(680px, calc(100vw - 32px))",
  };
  const style = {
    "--ceremony-margin": `${effect.margin ?? 18}px`,
    "--ceremony-box-width": effect.width || (effect.sizePreset === "custom" && effect.width ? effect.width : presetWidth[effect.sizePreset] || presetWidth.medium),
    "--ceremony-box-height": effect.height || (effect.sizePreset === "custom" && effect.height ? effect.height : "auto"),
  };
  if (effect.position === "fullscreen") {
    style["--ceremony-box-width"] = "calc(100vw - (var(--ceremony-margin) * 2))";
    style["--ceremony-box-height"] = "calc(100vh - (var(--ceremony-margin) * 2))";
  }
  return style;
}

function applyChromaToCanvas(ctx, width, height, effect) {
  const image = ctx.getImageData(0, 0, width, height);
  const data = image.data;
  const target = hexToRgb(effect.chromaColor || "#00ff00");
  const sensitivity = Number(effect.chromaSensitivity || 0.38) * 442;
  const smoothing = Number(effect.chromaSmoothing || 0.12) * 442;

  for (let index = 0; index < data.length; index += 4) {
    const distance = Math.hypot(data[index] - target.r, data[index + 1] - target.g, data[index + 2] - target.b);
    if (distance < sensitivity) {
      data[index + 3] = 0;
    } else if (smoothing > 0 && distance < sensitivity + smoothing) {
      const alpha = (distance - sensitivity) / smoothing;
      data[index + 3] = Math.round(data[index + 3] * alpha);
    }
  }

  ctx.putImageData(image, 0, 0);
}

function hexToRgb(hex) {
  const cleanValue = String(hex || "#00ff00").replace("#", "");
  const value = Number.parseInt(cleanValue, 16);
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  };
}

function shouldShowCeremonialEffect(effect) {
  if (!effect?.enabled || !effect.startDate) return false;
  const today = todayIsoDate();
  if (today < effect.startDate) return false;
  if (effect.endDate && today > effect.endDate) return false;
  if (effect.showEveryVisit) return true;
  if (!effect.oncePerDay) return true;
  return localStorage.getItem(ceremonialSeenKey(effect, today)) !== "true";
}

function ceremonialModulesToActiveEffect(modulesValue) {
  const modules = normalizeCeremonialModules(modulesValue);
  const layers = [];
  const moduleSeenKeys = [];

  if (shouldShowCeremonialModule(modules.notifications, "notifications")) {
    if (modules.notifications.oncePerDay && !modules.notifications.showEveryVisit) moduleSeenKeys.push(ceremonialModuleSeenKey("notifications", modules.notifications));
    layers.push({
      ...createCeremonialLayerDraft("text"),
      title: modules.notifications.title,
      message: modules.notifications.message,
      mediaUrl: modules.notifications.imageUrl,
      sizePreset: "medium",
      position: "center",
      showOkButton: true,
      durationSeconds: 60,
    });
  }

  if (shouldShowCeremonialModule(modules.ambient, "ambient")) {
    if (modules.ambient.oncePerDay && !modules.ambient.showEveryVisit) moduleSeenKeys.push(ceremonialModuleSeenKey("ambient", modules.ambient));
    if (modules.ambient.type === "diya") {
      layers.push({ ...createCeremonialLayerDraft("diya"), durationSeconds: modules.ambient.durationSeconds, position: "bottom-right" });
    } else {
      layers.push({
        ...createCeremonialLayerDraft(modules.ambient.type === "flowers" ? "petals" : modules.ambient.type === "lanterns" ? "lanterns" : modules.ambient.type),
        durationSeconds: modules.ambient.durationSeconds,
        amount: modules.ambient.amount,
        speed: modules.ambient.speed,
        sizePreset: modules.ambient.sizePreset,
      });
    }
  }

  if (shouldShowCeremonialModule(modules.content, "content")) {
    if (modules.content.oncePerDay && !modules.content.showEveryVisit && ["gif", "sequence"].includes(modules.content.contentType) && !modules.content.showOkButton) moduleSeenKeys.push(ceremonialModuleSeenKey("content", modules.content));
    if (!["gif", "sequence"].includes(modules.content.contentType) && modules.content.oncePerDay && !modules.content.showEveryVisit) moduleSeenKeys.push(ceremonialModuleSeenKey("content", modules.content));
  }

  if (shouldShowCeremonialModule(modules.content, "content") && modules.content.contentType === "gif" && modules.content.mediaUrl) {
    layers.push({
      ...createCeremonialLayerDraft("image"),
      mediaUrl: modules.content.mediaUrl,
      mediaPath: modules.content.mediaPath,
      chromaEnabled: modules.content.chromaEnabled,
      chromaColor: modules.content.chromaColor,
      chromaSensitivity: modules.content.chromaSensitivity,
      chromaSmoothing: modules.content.chromaSmoothing,
      sizePreset: modules.content.sizePreset,
      width: modules.content.width,
      height: modules.content.height,
      position: modules.content.position,
      margin: modules.content.margin,
      durationSeconds: modules.content.durationSeconds,
      repeat: true,
      showOkButton: modules.content.showOkButton,
    });
  }

  if (shouldShowCeremonialModule(modules.content, "content") && modules.content.contentType === "sequence" && modules.content.sequenceImages.length) {
    layers.push({
      ...createCeremonialLayerDraft("sequence"),
      title: modules.content.animationName || modules.content.title,
      sequenceImages: modules.content.sequenceImages,
      sequenceSpeed: modules.content.sequenceSpeed,
      sequenceSpeedValue: modules.content.sequenceSpeedValue,
      sequenceFrameMs: modules.content.sequenceFrameMs,
      chromaEnabled: modules.content.chromaEnabled,
      chromaColor: modules.content.chromaColor,
      chromaSensitivity: modules.content.chromaSensitivity,
      chromaSmoothing: modules.content.chromaSmoothing,
      sizePreset: modules.content.sizePreset,
      width: modules.content.width,
      height: modules.content.height,
      position: modules.content.position,
      margin: modules.content.margin,
      durationSeconds: modules.content.durationSeconds,
      repeat: modules.content.repeat,
      showOkButton: modules.content.showOkButton,
    });
  }

  if (shouldShowCeremonialModule(modules.content, "content") && modules.content.contentType === "message") {
    layers.push({
      ...createCeremonialLayerDraft("text"),
      title: modules.content.title,
      message: modules.content.message,
      mediaUrl: modules.content.imageUrl,
      mediaPath: modules.content.imagePath,
      sizePreset: modules.content.sizePreset,
      position: "center",
      showOkButton: true,
      durationSeconds: 60,
    });
  }

  if (shouldShowCeremonialModule(modules.content, "content") && modules.content.contentType === "video") {
    layers.push({
      ...createCeremonialLayerDraft(modules.content.youtubeUrl ? "youtube" : "local_video"),
      title: modules.content.title,
      message: modules.content.message,
      youtubeUrl: modules.content.youtubeUrl,
      mediaUrl: modules.content.mediaUrl,
      mediaPath: modules.content.mediaPath,
      sizePreset: modules.content.sizePreset,
      position: "center",
      showOkButton: true,
      durationSeconds: 60,
    });
  }

  if (!layers.length) return null;
  return {
    id: "ceremonial-modules",
    enabled: true,
    name: modules.notifications.eventName || modules.header.eventName || modules.ambient.eventName || modules.content.eventName || "Efectos ceremoniales",
    startDate: todayIsoDate(),
    oncePerDay: false,
    showEveryVisit: true,
    okButtonText: "OK",
    showOkButton: layers.some((layer) => layer.showOkButton),
    layers,
    moduleSeenKeys,
  };
}

function shouldShowCeremonialModule(module, id) {
  if (!module?.enabled || !module.startDate) return false;
  const today = todayIsoDate();
  if (today < module.startDate) return false;
  if (module.endDate && today > module.endDate) return false;
  if (module.showEveryVisit || !module.oncePerDay) return true;
  return localStorage.getItem(ceremonialModuleSeenKey(id, module)) !== "true";
}

function activeCeremonialHeader(value) {
  const header = normalizeCeremonialHeaderModule(value);
  if (!header.enabled || !header.startDate) return null;
  const today = todayIsoDate();
  if (today < header.startDate) return null;
  if (header.endDate && today > header.endDate) return null;
  return header.title || header.subtitle || header.backgroundUrl ? header : null;
}

function ceremonialModuleSeenKey(id, module) {
  return `ashram_ceremonial_seen_${firebaseKey(`${id}_${module.eventName || module.startDate || "module"}`)}_${todayIsoDate()}`;
}

function markCeremonialEffectSeen(effect) {
  if (!effect?.oncePerDay || effect.showEveryVisit) return;
  try {
    localStorage.setItem(ceremonialSeenKey(effect, todayIsoDate()), "true");
  } catch {
    // Si localStorage no esta disponible, el efecto simplemente puede repetirse.
  }
}

function ceremonialSeenKey(effect, date) {
  return `ashram_effect_seen_${firebaseKey(effect.id || effect.name || effect.type)}_${date}`;
}

function todayIsoDate() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function normalizeDateInput(value) {
  const cleanValue = cleanText(value);
  return /^\d{4}-\d{2}-\d{2}$/.test(cleanValue) ? cleanValue : "";
}

function appShellStyle(settings) {
  const imageUrl = cleanText(settings?.welcomeImageUrl);
  if (!imageUrl || settings?.welcomeTheme !== "custom") return undefined;
  return { "--app-custom-bg": `url("${cssUrl(imageUrl)}")` };
}

function welcomeCardStyle(settings, specialHeader) {
  const specialImage = cleanText(specialHeader?.backgroundUrl);
  if (specialImage) {
    return {
      "--welcome-custom-image": `url("${cssUrl(specialImage)}")`,
      "--welcome-bg-size": specialHeader.backgroundFit || "cover",
      "--welcome-bg-position": specialHeader.backgroundPosition || "center",
      "--welcome-special-overlay": specialHeader.darken ? "rgba(39, 31, 18, 0.32)" : "rgba(255, 253, 248, 0.56)",
      "--welcome-bg-opacity": String(specialHeader.backgroundOpacity ?? 0.5),
    };
  }
  const imageUrl = cleanText(settings?.welcomeImageUrl);
  if (!imageUrl || settings?.welcomeTheme !== "custom") return undefined;
  return { "--welcome-custom-image": `url("${cssUrl(imageUrl)}")` };
}

function cssUrl(value) {
  return String(value).replace(/["\\]/g, "");
}

function isMainMenuSection(id) {
  return sections.some((section) => section.id === id);
}

function isMainMenuEnabled(menuConfig, id) {
  return normalizeMainMenuConfig(menuConfig)[id] !== false;
}

function adminDataPath(section) {
  if (section === "tienda") return "productos";
  if (section === "ganesha-guia-knowledge") return "ganeshaKnowledge";
  return section;
}

function sectionIcon(id) {
  return sectionConfig(id)?.icon || BookOpen;
}

function sectionIconSrc(id) {
  return sectionConfig(id)?.iconSrc || "";
}

function sectionLabel(id) {
  if (id === "admin") return "Administracion";
  if (id === "perfil") return "Perfil";
  if (id === "chat") return "Chat";
  if (id === "test-dosha") return "Test Dosha";
  return sectionConfig(id)?.label || id;
}

function sectionSubtitle(id) {
  const subtitles = {
    biblioteca: "Lecturas para expandir la mirada.",
    conocimiento: "Ideas para estudiar y practicar con presencia.",
    blog: "Palabras, novedades y reflexiones del camino.",
    ejercicios: "Practicas simples para habitar el cuerpo.",
    meditaciones: "Un momento para volver al centro.",
    satsang: "Encuentros, palabras y presencia compartida.",
    deidades: "Historias, rituales y ofrendas para honrar lo sagrado.",
    "en-vivo": "Satsang y comunidad en tiempo real.",
    tienda: "Productos del Ashram para acompanar tu practica.",
    ofrendas: "Una colaboracion voluntaria para sostener el Ashram.",
    chat: "Un canal directo para acompanarte.",
  };
  return subtitles[id] || "";
}

function isPresenceOnline(item = {}) {
  if (!item.isOnline) return false;
  const date = firestoreDate(item.lastActiveAt);
  if (!date) return false;
  return Date.now() - date.getTime() < 5 * 60 * 1000;
}

function firestoreDate(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate();
  if (value.seconds) return new Date(value.seconds * 1000);
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatFirestoreDate(value) {
  const date = firestoreDate(value);
  if (!date) return "sin fecha";
  return date.toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function liveEmbedUrl(value) {
  const cleanValue = String(value || "").trim();
  if (!cleanValue) return "";
  if (/^[a-zA-Z0-9_-]{8,}$/.test(cleanValue) && !cleanValue.includes("http")) {
    return `https://www.youtube-nocookie.com/embed/${cleanValue}?rel=0&playsinline=1&autoplay=1`;
  }
  return youtubeEmbedUrl(cleanValue);
}

function formatLiveDate(timestamp, fallback) {
  const date = timestamp?.toDate ? timestamp.toDate() : fallback ? new Date(fallback) : null;
  if (!date || Number.isNaN(date.getTime())) return "Ahora";
  return date.toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function sectionFallbackImage(id) {
  if (id === "biblioteca") return "/icono_biblioteca.webp";
  if (id === "blog") return "/icono_blog.webp";
  if (id === "meditaciones") return "/icono_meditacion.webp";
  if (id === "tienda") return "/icono_conocimiento.webp";
  return sectionIconSrc(id) || "/icono_conocimiento.webp";
}

function productName(product) {
  return cleanText(product?.nombre) || cleanText(product?.titulo) || "Producto";
}

function toNumber(value) {
  const raw = String(value ?? "").trim().replace(/[^\d,.-]/g, "");
  let normalized = raw;
  if (raw.includes(".") && raw.includes(",")) {
    normalized = raw.replace(/\./g, "").replace(",", ".");
  } else if ((raw.match(/\./g) || []).length > 1) {
    normalized = raw.replace(/\./g, "");
  } else if (/\.\d{3}$/.test(raw)) {
    normalized = raw.replace(/\./g, "");
  } else if (/,\d{3}$/.test(raw)) {
    normalized = raw.replace(/,/g, "");
  } else if (raw.includes(",")) {
    normalized = raw.replace(",", ".");
  }
  const number = Number(normalized);
  return Number.isFinite(number) ? number : 0;
}

function productPrice(product) {
  return toNumber(product?.precio);
}

function productHasPrice(product) {
  return productPrice(product) > 0;
}

function productStock(product) {
  if (product?.stock === "" || product?.stock === undefined || product?.stock === null) return -1;
  return Math.trunc(toNumber(product.stock));
}

function productAvailability(product) {
  const status = cleanText(product?.estado || product?.disponibilidad).toLowerCase();
  if (["agotado", "sin stock"].includes(status)) return "agotado";
  if (["por encargo", "encargo", "a pedido"].includes(status)) return "por encargo";
  if (productStock(product) === 0) return "agotado";
  return "disponible";
}

function productAvailabilityLabel(product, stock = productStock(product)) {
  const availability = productAvailability(product);
  if (availability === "agotado") return "Agotado";
  if (availability === "por encargo") return "Por encargo";
  if (stock > 0) return `Disponible: ${stock}`;
  return "Disponible";
}

function splitStoreImages(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.flatMap(splitStoreImages);
  if (typeof value === "object") return Object.values(value).flatMap(splitStoreImages);
  return String(value)
    .split(/[\n,|;]/)
    .map(cleanText)
    .filter(Boolean);
}

function productImages(product = {}) {
  const images = [
    product.imagen,
    product.imagen_url,
    product.linkImagen,
    product.linkFoto,
    product.foto,
    product.portada,
    product.portada_url,
    product.thumbnail,
    ...splitStoreImages(product.imagenes),
    ...splitStoreImages(product.galeria),
  ]
    .map(cleanText)
    .filter(Boolean);
  return [...new Set(images)].length ? [...new Set(images)] : ["/icono_conocimiento.webp"];
}

function productMainImage(product) {
  return productImages(product)[0];
}

function storeProductIdFromUrl() {
  return cleanText(new URLSearchParams(window.location.search).get("producto"));
}

function storeProductShareUrl(product) {
  const isLocalHost = ["localhost", "127.0.0.1"].includes(window.location.hostname);
  const origin = isLocalHost ? "https://ashramganesha.web.app" : window.location.origin || "https://ashramganesha.web.app";
  return `${origin}/producto/${encodeURIComponent(product.id)}`;
}

function setStoreProductUrlParam(productId) {
  const url = new URL(window.location.href);
  url.searchParams.set("producto", productId);
  url.hash = "tienda";
  window.history.replaceState({ ...window.history.state, view: "tienda", producto: productId }, "", url.toString());
}

function clearStoreProductUrlParam() {
  const url = new URL(window.location.href);
  url.searchParams.delete("producto");
  window.history.replaceState({ ...window.history.state, view: "tienda" }, "", `${url.pathname}${url.search}${url.hash || "#tienda"}`);
}

function storeProductShareText(product, shareUrl) {
  const priceLine = productHasPrice(product) ? formatMoney(productPrice(product)) : "";
  const descriptionLine = summary(product?.descripcion || "", 160);
  return [
    "Mirá este producto de Ashram Ganesha:",
    productName(product),
    priceLine,
    descriptionLine,
    shareUrl,
  ].filter(Boolean).join("\n");
}

async function copyStoreShareText(text) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall through to the textarea fallback.
  }
  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand("copy");
    document.body.removeChild(textarea);
    return copied;
  } catch {
    return false;
  }
}

function trackProductShare(product, shareMethod, imageAttached = false, shareUrl = storeProductShareUrl(product)) {
  void trackEvent("store_product_shared", {
    productId: product.id,
    productName: productName(product),
    contentId: product.id,
    contentTitle: productName(product),
    contentType: "tienda",
    category: product.categoria || "",
    contentCategory: product.categoria || "",
    shareMethod,
    imageAttached,
    shareUrl,
  });
}

function productDetailImage(product = {}) {
  return cleanText(
    product.imagen_detalle ||
    product.imagenDetalle ||
    product.detalle_imagen ||
    product.imagen_detalle_url ||
    product.detalle_imagen_url,
  ) || productMainImage(product);
}

function productDetailImages(product = {}) {
  const images = [
    productDetailImage(product),
    productMainImage(product),
    ...productImages(product),
  ]
    .map(cleanText)
    .filter(Boolean);
  return [...new Set(images)].length ? [...new Set(images)] : ["/icono_conocimiento.webp"];
}

function productVideoInfo(product = {}) {
  const url = cleanText(product.video_url || product.videoUrl || product.video || product.link_video || product.linkVideo);
  if (!url) return { url: "", embedUrl: "" };
  return {
    url,
    embedUrl: youtubeEmbedUrl(url),
  };
}

function storeProductMatches(product, searchTerm, selectedCategory) {
  const search = cleanText(searchTerm).toLowerCase();
  const category = cleanText(selectedCategory).toLowerCase();
  const productCategory = cleanText(product?.categoria).toLowerCase();
  const searchable = [
    productName(product),
    product?.descripcion,
    product?.categoria,
    product?.keywords,
    product?.material,
    product?.significado,
  ]
    .map(cleanText)
    .join(" ")
    .toLowerCase();

  const matchesSearch = !search || searchable.includes(search);
  const matchesCategory = !category || category === "todas" || productCategory.includes(category) || searchable.includes(category);
  return matchesSearch && matchesCategory;
}

function sortStoreProducts(a, b, sortMode = "novedades") {
  if (sortMode === "precio-menor" || sortMode === "precio-mayor") {
    const priceA = productHasPrice(a) ? productPrice(a) : Number.POSITIVE_INFINITY;
    const priceB = productHasPrice(b) ? productPrice(b) : Number.POSITIVE_INFINITY;
    return sortMode === "precio-menor" ? priceA - priceB : priceB - priceA;
  }
  const order = toNumber(a?.orden) - toNumber(b?.orden);
  if (order) return order;
  return productName(a).localeCompare(productName(b), "es");
}

function groupStoreProductsByCategory(products = []) {
  const groups = new Map();
  products.forEach((product) => {
    const category = cleanText(product?.categoria) || "Productos";
    if (!groups.has(category)) groups.set(category, []);
    groups.get(category).push(product);
  });
  return [...groups.entries()]
    .sort(([categoryA], [categoryB]) => categoryA.localeCompare(categoryB, "es"))
    .map(([category, items]) => ({
      category,
      items: [...items].sort((a, b) => sortStoreProducts(a, b, "novedades")),
    }));
}

function storeCategoryOptions(products = []) {
  const categories = [];
  products.forEach((product) => {
    const category = cleanText(product?.categoria);
    if (!category) return;
    if (!categories.some((item) => comparableStoreCategory(item) === comparableStoreCategory(category))) {
      categories.push(category);
    }
  });
  return categories.sort((a, b) => a.localeCompare(b, "es"));
}

function resolveStoreCategory(value, categoryOptions = []) {
  const category = cleanText(value);
  if (!category) return "";
  const comparable = comparableStoreCategory(category);
  return categoryOptions.find((option) => comparableStoreCategory(option) === comparable) || category;
}

function comparableStoreCategory(value) {
  return cleanText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function normalizeStoreSettings(value = {}) {
  const overlay = Number(value.backgroundOverlay);
  return {
    ...DEFAULT_STORE_SETTINGS,
    instagram: cleanText(value.instagram),
    youtube: cleanText(value.youtube),
    facebook: cleanText(value.facebook),
    whatsapp: normalizeWhatsappLink(value.whatsapp),
    backgroundColor: normalizeStoreBackgroundColor(value.backgroundColor || value.fondoColor || value.colorFondo),
    backgroundUrl: storeBackgroundImageUrl(value.backgroundUrl || value.fondo || value.fondoUrl),
    backgroundPath: cleanText(value.backgroundPath || value.fondoPath),
    backgroundFileName: cleanText(value.backgroundFileName || value.fondoFileName),
    backgroundOverlay: Number.isFinite(overlay) ? Math.max(0.18, Math.min(0.78, overlay)) : DEFAULT_STORE_SETTINGS.backgroundOverlay,
  };
}

function normalizeStoreBackgroundColor(value = "") {
  const color = cleanText(value);
  return /^#[0-9a-f]{6}$/i.test(color) ? color : "";
}

function storeBackgroundImageUrl(value = "") {
  const url = cleanText(value);
  return url ? shareImageUrl(url) : "";
}
function normalizeWhatsappLink(value = "") {
  const text = cleanText(value);
  if (!text) return "";
  if (/^https?:\/\//i.test(text)) return text;
  const phone = whatsappPhone(text);
  return phone ? `https://wa.me/${phone}` : text;
}

function storeSocialItems(links = {}) {
  const normalized = normalizeStoreSettings(links);
  return [
    { id: "instagram", label: "Instagram", url: normalized.instagram },
    { id: "youtube", label: "YouTube", url: normalized.youtube },
    { id: "facebook", label: "Facebook", url: normalized.facebook },
    { id: "whatsapp", label: "WhatsApp", url: normalized.whatsapp },
  ].filter((item) => item.url);
}

function productCardBadge(product, stock = productStock(product)) {
  const explicit = cleanText(product?.etiqueta || product?.badge || product?.sello);
  if (explicit) return explicit;
  const text = [product?.keywords, product?.descripcion, product?.material, product?.elaboracion]
    .map(cleanText)
    .join(" ")
    .toLowerCase();
  if (text.includes("nuevo")) return "Nuevo";
  if (text.includes("pintad")) return "Pintado a mano";
  if (text.includes("creaci")) return "Creacion propia";
  return productAvailabilityLabel(product, stock);
}

function productDetailFields(product = {}) {
  return [
    ["Significado", product.significado || product.proposito || product.energia || product.intencion],
    ["Material", product.material || product.elaboracion || product.terminacion],
    ["Medidas", product.medidas || product.medida || product.tamano || product["tamaño"]],
    ["Variantes", product.variantes],
  ]
    .map(([label, value]) => [label, cleanText(value)])
    .filter(([, value]) => value);
}

function productTrustTexts(product = {}) {
  const text = [product.descripcion, product.keywords, product.material, product.elaboracion, product.terminacion]
    .map(cleanText)
    .join(" ")
    .toLowerCase();
  const items = [];
  if (text.includes("creaci")) items.push("Creacion propia");
  if (text.includes("3d") || text.includes("impres")) items.push("Impreso en 3D");
  if (text.includes("pintad") || text.includes("mano")) items.push("Terminacion y pintura realizadas a mano");
  if (text.includes("artesanal") || text.includes("vari")) items.push("Cada pieza puede presentar pequenas variaciones artesanales");
  return [...new Set(items)];
}

function truncateStoreDescription(value, maxLength = 260) {
  const text = cleanText(value);
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength).trim()}...`;
}

function formatMoney(value) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(toNumber(value));
}

function formatCourseMoney(value) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  }).format(toNumber(value));
}

function readCart() {
  try {
    const parsed = JSON.parse(localStorage.getItem("ashram-store-cart") || "{}");
    return Object.fromEntries(
      Object.entries(parsed || {})
        .map(([id, quantity]) => [id, Math.max(1, Math.trunc(toNumber(quantity)))])
        .filter(([id, quantity]) => id && quantity > 0),
    );
  } catch {
    return {};
  }
}

const requiredStoreBuyerFields = ["nombre", "telefono", "localidad"];

function readStoreBuyer(profile = {}, user = {}) {
  let saved = {};
  try {
    saved = JSON.parse(localStorage.getItem("ashram-store-buyer") || "{}");
  } catch {
    saved = {};
  }
  return {
    nombre: saved.nombre || profile?.nombre || "",
    email: saved.email || profile?.email || user?.email || "",
    telefono: saved.telefono || profile?.telefono || "",
    domicilio: saved.domicilio || profile?.domicilio || "",
    localidad: saved.localidad || profile?.localidad || "",
    provincia: saved.provincia || profile?.provincia || "",
    codigo_postal: saved.codigo_postal || profile?.codigo_postal || "",
    entrega: saved.entrega || "A coordinar",
    observaciones: "",
  };
}

function validateStoreBuyer(buyer = {}) {
  return requiredStoreBuyerFields.reduce((errors, field) => {
    if (!cleanText(buyer[field])) {
      const labels = { nombre: "Ingresá tu nombre.", telefono: "Ingresá un teléfono.", localidad: "Ingresá tu localidad." };
      errors[field] = labels[field] || "Completá este campo.";
    }
    return errors;
  }, {});
}

function storeWhatsappUrl(order) {
  const totalLabel = order.precio_a_confirmar ? "Precio a confirmar" : formatMoney(order.total);
  const totalProducts = order.items.reduce((sum, item) => sum + toNumber(item.cantidad), 0);
  const detailLines = order.items.flatMap((item, index) => {
    const variant = item.variante ? ` (${item.variante})` : "";
    return [
      `${index + 1}. ${item.nombre}${variant}`,
      `   Cantidad: ${item.cantidad}`,
      `   Precio unitario: ${item.precio ? formatMoney(item.precio) : "Precio a confirmar"}`,
      `   Subtotal: ${item.subtotal ? formatMoney(item.subtotal) : "Precio a confirmar"}`,
    ];
  });
  const lines = [
    "Hola, quiero realizar el siguiente pedido en la Tienda del Ashram Ganesha:",
    "",
    ...detailLines,
    "",
    `Total de productos: ${totalProducts}`,
    `TOTAL: ${totalLabel}`,
    `Nombre: ${order.nombre || ""}`,
    `Telefono: ${order.telefono || ""}`,
    `Localidad: ${order.localidad || ""}`,
    `Entrega: ${order.entrega || "A coordinar"}`,
    order.observaciones ? `Observaciones: ${order.observaciones}` : "Observaciones: ",
  ].filter(Boolean);
  return `https://wa.me/${ADMIN_WHATSAPP}?text=${encodeURIComponent(lines.join("\n"))}`;
}

function sessionWhatsappUrl(session) {
  const phone = whatsappPhone(session.telefono);
  const lines = [
    `Hola ${session.nombre || ""}, ¿cÃ³mo estás?`,
    "",
    "Te confirmamos tu turno en Ashram Ganesha:",
    `Día: ${formatSessionFullDay(session.fecha)}`,
    `Hora: ${formatSessionTime(session.fecha)}`,
    `Motivo: ${session.motivo || session.tipo || "Sesión"}`,
    "",
    "Muchas gracias. Te esperamos con alegrÃ­a.",
  ];
  return `https://wa.me/${phone}?text=${encodeURIComponent(lines.join("\n"))}`;
}

function whatsappPhone(value = "") {
  return String(value).replace(/[^\d]/g, "");
}

function noteTargetToSection(target) {
  if (target === "curso") return "conocimiento";
  return target;
}

function createShareDraft(section, item) {
  const config = shareSectionConfig(section);
  if (!config) return null;
  const title = contentTitle(item);
  const description = summary(item.descripcion || item.contenidoMarkdown || item.detalle || "", 120);
  const detailPath = item?.id && config.detail ? `/${item.id}` : "";
  const url = `${window.location.origin}/#${config.view}${detailPath}`;
  const image = shareImageUrl(item.imagen || item.imagenUrl || item.portada_url || "");
  const text = [
    `Nuevo contenido en Ashram Ganesha`,
    "",
    `${config.label}: ${title}`,
    description,
    "",
    `Te invito a verlo en la app:`,
    url,
    "",
    "Un espacio para practicar, leer y volver al centro.",
  ].filter((line) => line !== "").join("\n");
  return { title, text, url, image };
}

function shareSectionConfig(section) {
  const configs = {
    biblioteca: { label: "Libro", view: "biblioteca" },
    blog: { label: "Blog", view: "blog", detail: true },
    satsang: { label: "Satsang", view: "satsang" },
    meditaciones: { label: "Meditacion", view: "meditaciones" },
    conocimiento: { label: "Curso", view: "conocimiento", detail: true },
    ejercicios: { label: "Practica", view: "ejercicios", detail: true },
  };
  return configs[section] || null;
}

function shareImageUrl(url) {
  if (!url) return "";
  try {
    const parsed = new URL(url);
    const id = googleDriveFileId(parsed);
    return id ? `https://drive.google.com/thumbnail?id=${id}&sz=w1200` : url;
  } catch {
    return url;
  }
}

function contentAccessType(item) {
  const value = item?.acceso || item?.tipo_acceso || "gratis";
  return ["suscripcion", "compra"].includes(value) ? value : "gratis";
}

function accessLabel(item) {
  const type = contentAccessType(item);
  if (type === "suscripcion") return "Por suscripcion";
  if (type === "compra") return "Comprar";
  return "Gratis";
}

function accessToast(item) {
  return contentAccessType(item) === "compra"
    ? "Te abrimos WhatsApp para consultar la compra."
    : "Te abrimos WhatsApp para solicitar acceso.";
}

function canOpenPaidContent(profile, item) {
  if (isAdminProfile(profile)) return true;
  return contentAccessType(item) === "gratis";
}

function authProviderLabel(user) {
  const providerId = user?.providerData?.[0]?.providerId || "password";
  return providerId === "google.com" ? "google" : "email";
}

function defaultUserProfile(user, fallbackEmail = "", fallbackName = "") {
  const createdAt = new Date().toISOString();
  const email = user?.email || fallbackEmail || "";
  const provider = authProviderLabel(user);
  return {
    uid: user?.uid || "",
    email,
    nombre: user?.displayName || fallbackName || "",
    domicilio: "",
    telefono: "",
    localidad: "",
    codigo_postal: "",
    fecha_nacimiento: "",
    foto_url: user?.photoURL || "",
    foto_path: "",
    edad: null,
    rol: isAdminEmail(email) ? "admin" : "usuario",
    fecha_registro: createdAt,
    ultimo_ingreso: createdAt,
    proveedor: provider,
    fechaRegistro: createdAt,
    suscripcionActiva: false,
    cursosComprados: [],
    suscripcion_estado: "inactiva",
    suscripcion_activa: false,
    permiso_biblioteca: true,
    permiso_meditacion: true,
    permiso_conocimientos: false,
    permiso_ejercicios: false,
    etiquetas_conocimiento: {},
    etiquetas_ejercicios: {},
  };
}

async function ensureUserProfile(user, fallbackEmail = "", fallbackName = "") {
  if (!user?.uid) return null;
  const fallbackProfile = defaultUserProfile(user, fallbackEmail, fallbackName);
  const userDocRef = doc(firestoreDb, "users", user.uid);
  const realtimeRef = ref(db, `usuarios/${user.uid}`);
  const loginPatch = {
    uid: user.uid,
    email: user.email || fallbackEmail || "",
    nombre: user.displayName || fallbackName || fallbackProfile.nombre || "",
    foto_url: user.photoURL || fallbackProfile.foto_url || "",
    proveedor: authProviderLabel(user),
    ultimo_ingreso: new Date().toISOString(),
  };

  try {
    authDebug("ensure profile start", { uid: user.uid, email: loginPatch.email });
    const [firestoreSnap, realtimeSnap] = await Promise.all([
      getDoc(userDocRef),
      get(realtimeRef),
    ]);
    const savedFirestoreProfile = firestoreSnap.exists() ? firestoreSnap.data() : null;
    const realtimeProfile = realtimeSnap.exists() ? realtimeSnap.val() : null;
    const existingProfile = savedFirestoreProfile || realtimeProfile || {};
    const adminByEmail = isAdminEmail(loginPatch.email || existingProfile.email || fallbackProfile.email);
    const profile = {
      ...fallbackProfile,
      ...existingProfile,
      uid: user.uid,
      email: loginPatch.email || existingProfile.email || fallbackProfile.email,
      nombre: existingProfile.nombre || loginPatch.nombre || fallbackProfile.nombre,
      foto_url: existingProfile.foto_url || loginPatch.foto_url || fallbackProfile.foto_url,
      proveedor: loginPatch.proveedor,
      fecha_registro: existingProfile.fecha_registro || fallbackProfile.fecha_registro,
      fechaRegistro: existingProfile.fechaRegistro || existingProfile.fecha_registro || fallbackProfile.fechaRegistro,
      ultimo_ingreso: loginPatch.ultimo_ingreso,
      rol: adminByEmail || existingProfile.rol === "admin" ? "admin" : "usuario",
      suscripcion_estado: existingProfile.suscripcion_estado || (existingProfile.suscripcion_activa ? "activa" : "inactiva"),
      suscripcion_activa: hasActiveSubscription(existingProfile),
      suscripcionActiva: hasActiveSubscription(existingProfile),
      cursosComprados: Array.isArray(existingProfile.cursosComprados) ? existingProfile.cursosComprados : [],
      cursos_comprados: Array.isArray(existingProfile.cursos_comprados) ? existingProfile.cursos_comprados : [],
    };
    const profileForFirestore = {
      ...profile,
      registeredAt: savedFirestoreProfile?.registeredAt || serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    await Promise.all([
      setDoc(userDocRef, profileForFirestore, { merge: true }),
      set(realtimeRef, profile),
    ]);
    authDebug("ensure profile saved", {
      uid: user.uid,
      firestoreExists: firestoreSnap.exists(),
      realtimeExists: realtimeSnap.exists(),
    });
    return { ...profile, _profileSource: firestoreSnap.exists() ? "firestore" : realtimeSnap.exists() ? "realtime-migrated" : "created" };
  } catch (error) {
    console.warn("[auth-flow] No se pudo guardar el perfil completo del usuario.", error);
    try {
      const realtimeSnap = await get(realtimeRef);
      if (realtimeSnap.exists()) return { ...fallbackProfile, ...realtimeSnap.val(), _profileSource: "realtime-fallback" };
    } catch (fallbackError) {
      console.warn("[auth-flow] Tambien fallo el respaldo Realtime Database.", fallbackError);
    }
    return { ...fallbackProfile, _profileSource: "fallback" };
  }
}

function authDebug(message, payload = {}) {
  console.log(`[auth-flow] ${message}`, payload);
}

function isAdminEmail(email = "") {
  return ADMIN_EMAILS.has(String(email || "").trim().toLowerCase());
}

function isAdminProfile(profile = null, user = null) {
  const role = String(profile?.rol || profile?.role || profile?.tipo || "").trim().toLowerCase();
  return role === "admin" || role === "administrador" || profile?.admin === true || profile?.esAdmin === true || isAdminEmail(profile?.email || user?.email || "");
}

function authErrorMessage(error, mode = "login") {
  const code = error?.code || "";
  const messages = {
    "auth/admin-restricted-operation": "El proveedor de acceso no esta habilitado en Firebase Auth.",
    "auth/account-exists-with-different-credential": "Ese email ya existe con otro metodo de acceso.",
    "auth/email-already-in-use": "Ese email ya esta registrado. Usa Entrar u Olvide mi contrasena.",
    "auth/invalid-email": "El email no parece valido.",
    "auth/invalid-credential": "Email o contrasena incorrectos.",
    "auth/missing-password": "Escribi la contrasena.",
    "auth/operation-not-allowed": "Este metodo de acceso no esta habilitado en Firebase Auth.",
    "auth/popup-blocked": "El navegador bloqueo la ventana de Google. Intentamos redirigirte.",
    "auth/too-many-requests": "Hubo demasiados intentos. Espera unos minutos y proba de nuevo.",
    "auth/unauthorized-domain": "Este dominio no esta autorizado en Firebase Auth.",
    "auth/user-not-found": "No existe una cuenta con ese email.",
    "auth/weak-password": "La contrasena debe tener al menos 6 caracteres.",
    "auth/wrong-password": "Email o contrasena incorrectos.",
  };
  if (messages[code]) return messages[code];
  if (mode === "register") return "No se pudo registrar. Revisa email, contrasena y que Email/Password este habilitado.";
  if (mode === "reset") return "No se pudo enviar el email de recuperacion. Revisa que el email exista y que Email/Password este habilitado.";
  if (mode === "google") return "No se pudo iniciar con Google. Revisa que Google este habilitado y el dominio autorizado.";
  return "No se pudo iniciar sesion.";
}

async function uploadImageWithFallback(file, folder) {
  try {
    return await uploadOptimizedImage(file, folder);
  } catch {
    return {
      url: await optimizeImageToDataUrl(file),
      path: "",
    };
  }
}

function summary(text, limit) {
  const clean = (text || "").replace(/\s+/g, " ").trim();
  if (clean.length <= limit) return clean;
  return `${clean.slice(0, limit).trim()}...`;
}

function satsangVideoEmbed(item) {
  const source = [
    item?.video,
    item?.link_video_original,
    item?.videoUrl,
    item?.descripcion,
  ].map(extractYoutubeUrl).find(Boolean);
  return source ? youtubeEmbedUrl(source) : "";
}

function extractYoutubeUrl(value) {
  const text = String(value || "");
  const hrefMatch = text.match(/href=["']([^"']*(?:youtube\.com|youtu\.be)[^"']*)["']/i);
  const urlMatch = text.match(/https?:\/\/(?:www\.)?(?:youtube\.com|youtu\.be)\/[^\s<>"')]+/i);
  const url = hrefMatch?.[1] || urlMatch?.[0] || "";
  return url.replace(/&amp;/g, "&").replace(/[.,;!?]+$/, "");
}

function satsangDescriptionText(value) {
  return String(value || "")
    .replace(/<a\b[^>]*href=["'][^"']*(?:youtube\.com|youtu\.be)[^"']*["'][^>]*>.*?<\/a>/gi, "")
    .replace(/https?:\/\/(?:www\.)?(?:youtube\.com|youtu\.be)\/[^\s<>"')]+/gi, "")
    .replace(/<\/p>\s*<p>/gi, "\n\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+\n/g, "\n")
    .replace(/\n\s+/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function defaultSessionDateTime() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(18, 0, 0, 0);
  return toDateTimeInputValue(date);
}

function toDateTimeInputValue(date) {
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function dateTimeForDay(day) {
  if (!day || day === "sin-fecha") return defaultSessionDateTime();
  return `${day}T18:00`;
}

function sessionRoomName(uid, fecha) {
  return `ashram-sesion-${firebaseKey(uid || "alumno")}-${firebaseKey(fecha || Date.now())}`;
}

function jitsiRoomUrl(roomName) {
  const room = encodeURIComponent(roomName || `ashram-sesion-${Date.now()}`);
  return `https://meet.jit.si/${room}#config.prejoinPageEnabled=false&config.disableDeepLinking=true&interfaceConfig.SHOW_JITSI_WATERMARK=false`;
}

function formatSessionDate(value) {
  if (!value) return "Horario a confirmar";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("es-AR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatSessionFullDay(value) {
  if (!value) return "Día a confirmar";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("es-AR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function formatSessionDay(value) {
  if (!value) return "Sin fecha";
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(Number(value.slice(0, 4)), Number(value.slice(5, 7)) - 1, Number(value.slice(8, 10)))
    : new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("es-AR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  });
}

function formatSessionTime(value) {
  if (!value) return "Horario a confirmar";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function sessionDayKey(value) {
  if (!value) return "sin-fecha";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return toDateTimeInputValue(date).split("T")[0];
}

function groupSessionsByDay(sessions) {
  const groups = new Map();
  sessions.forEach((session) => {
    const day = sessionDayKey(session.fecha);
    if (!groups.has(day)) {
      groups.set(day, { day, label: formatSessionDay(session.fecha), items: [] });
    }
    groups.get(day).items.push(session);
  });
  return Array.from(groups.values()).map((group) => ({
    ...group,
    items: group.items.sort((a, b) => (a.fecha || "").localeCompare(b.fecha || "")),
  }));
}

function upsertById(items, nextItem) {
  if (!nextItem?.id) return items;
  const exists = items.some((item) => item.id === nextItem.id);
  if (!exists) return [...items, nextItem];
  return items.map((item) => item.id === nextItem.id ? { ...item, ...nextItem } : item);
}

function sortSessionsByDate(sessions) {
  return [...sessions].sort((a, b) => (a.fecha || "").localeCompare(b.fecha || ""));
}

async function saveSessionWithFallback(sessionData) {
  try {
    return await createSessionByRest(sessionData);
  } catch (restError) {
    try {
      const sessionRef = push(ref(db, "sesiones"));
      await set(sessionRef, sessionData);
      return { id: sessionRef.key, ...sessionData };
    } catch (sdkError) {
      throw new Error(`REST: ${restError.message || restError}. SDK: ${sdkError.message || sdkError}`);
    }
  }
}

async function fetchSessionsByRest() {
  const baseUrl = firebaseConfig.databaseURL?.replace(/\/$/, "");
  if (!baseUrl) throw new Error("No está configurada la base de datos.");
  const response = await fetch(`${baseUrl}/sesiones.json?ts=${Date.now()}`, { cache: "no-store" });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `REST ${response.status}`);
  }
  const value = await response.json();
  return Object.entries(value || {})
    .map(([id, item]) => ({ id, ...item }))
    .sort((a, b) => (a.fecha || "").localeCompare(b.fecha || ""));
}

async function updateExistingSessionWithFallback(sessionId, sessionData) {
  await updateSessionWithFallback(sessionId, sessionData);
  return { id: sessionId, ...sessionData };
}

async function createSessionByRest(sessionData) {
  const baseUrl = firebaseConfig.databaseURL?.replace(/\/$/, "");
  if (!baseUrl) throw new Error("No está configurada la base de datos.");
  const response = await fetch(`${baseUrl}/sesiones.json`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(sessionData),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `REST ${response.status}`);
  }
  const data = await response.json();
  if (!data?.name) throw new Error("Firebase no devolviÃ³ el id del turno.");
  return { id: data.name, ...sessionData };
}

async function updateSessionWithFallback(sessionId, changes) {
  try {
    await updateSessionByRest(sessionId, changes);
  } catch (restError) {
    try {
      await update(ref(db, `sesiones/${sessionId}`), changes);
    } catch (sdkError) {
      throw new Error(`REST: ${restError.message || restError}. SDK: ${sdkError.message || sdkError}`);
    }
  }
}

async function updateSessionByRest(sessionId, changes) {
  const baseUrl = firebaseConfig.databaseURL?.replace(/\/$/, "");
  if (!baseUrl || !sessionId) throw new Error("No está configurada la base de datos.");
  const response = await fetch(`${baseUrl}/sesiones/${encodeURIComponent(sessionId)}.json`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(changes),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `REST ${response.status}`);
  }
  return response.json();
}

async function deleteSessionWithFallback(sessionId) {
  try {
    await deleteSessionByRest(sessionId);
  } catch (restError) {
    try {
      await remove(ref(db, `sesiones/${sessionId}`));
    } catch (sdkError) {
      throw new Error(`REST: ${restError.message || restError}. SDK: ${sdkError.message || sdkError}`);
    }
  }
}

async function deleteSessionByRest(sessionId) {
  const baseUrl = firebaseConfig.databaseURL?.replace(/\/$/, "");
  if (!baseUrl || !sessionId) throw new Error("No está configurada la base de datos.");
  const response = await fetch(`${baseUrl}/sesiones/${encodeURIComponent(sessionId)}.json`, {
    method: "DELETE",
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `REST ${response.status}`);
  }
  return true;
}

function buildAdminAgendaDays(sessions) {
  const days = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let index = 0; index < 14; index += 1) {
    const date = new Date(today);
    date.setDate(today.getDate() + index);
    const day = sessionDayKey(date.toISOString());
    days.push({ day, label: formatSessionDay(date.toISOString()), items: [] });
  }

  const byDay = new Map(days.map((day) => [day.day, day]));
  sessions.forEach((session) => {
    const day = sessionDayKey(session.fecha);
    if (!byDay.has(day)) {
      byDay.set(day, { day, label: formatSessionDay(session.fecha), items: [] });
    }
    byDay.get(day).items.push(session);
  });

  return Array.from(byDay.values())
    .sort((a, b) => a.day.localeCompare(b.day))
    .map((group) => ({
      ...group,
      items: group.items.sort((a, b) => (a.fecha || "").localeCompare(b.fecha || "")),
    }));
}

function sessionStatusClass(session) {
  if (session.estado === "solicitado") return "session-request";
  if (session.estado === "finalizada") return "session-done";
  if (session.estado === "en curso") return "session-live";
  if (isSessionSoon(session.fecha)) return "session-now";
  return "session-booked";
}

function sessionStatusLabel(value) {
  const labels = {
    solicitado: "Solicitado",
    reservado: "Reservado",
    "en curso": "En curso",
    finalizada: "Finalizada",
    cancelada: "Cancelada",
  };
  return labels[value] || "Reservado";
}

function isSessionSoon(value) {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  return Math.abs(date.getTime() - Date.now()) <= 1000 * 60 * 20;
}

function formatDate(value) {
  if (!value) return "Sin fecha";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("es-AR");
}

function formatTime(seconds) {
  const safeSeconds = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
  const minutes = Math.floor(safeSeconds / 60);
  const rest = Math.floor(safeSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${rest}`;
}

function courseSeriesOptions(items) {
  return [...new Set(items.map((item) => cleanText(item.etiqueta || item.categoria)).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b));
}

function labelsFromValue(value) {
  if (!value) return {};
  if (typeof value === "string") return textToLabels(value);
  if (Array.isArray(value)) {
    return value.reduce((result, label) => {
      const cleanLabel = cleanText(label);
      return cleanLabel ? { ...result, [cleanLabel]: true } : result;
    }, {});
  }
  if (typeof value === "object") return cleanLabelMap(value);
  return {};
}

function textToLabels(text) {
  return cleanText(text)
    .split(",")
    .map((label) => cleanText(label))
    .filter(Boolean)
    .reduce((result, label) => ({ ...result, [label]: true }), {});
}

function cleanLabelMap(labels) {
  if (!labels || typeof labels !== "object") return {};
  return Object.entries(labels)
    .filter(([, value]) => value)
    .reduce((result, [label]) => {
      const cleanLabel = cleanText(label);
      return cleanLabel ? { ...result, [cleanLabel]: true } : result;
    }, {});
}

function mergeSeriesOptions(options = [], selected = {}) {
  const selectedLabels = Object.keys(cleanLabelMap(selected));
  return [...new Set([...options, ...selectedLabels].map((label) => cleanText(label)).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b));
}

function hasSelectedLabels(labels) {
  return Object.keys(cleanLabelMap(labels)).length > 0;
}

function userPermissionText(userItem) {
  const parts = [];
  if (userItem.rol === "admin") parts.push("Admin");
  if (userItem.permiso_conocimientos) parts.push("Conocimiento total");
  else if (hasSelectedLabels(userItem.etiquetas_conocimiento)) parts.push("Conocimiento por series");
  if (userItem.permiso_ejercicios) parts.push("Ejercicios total");
  else if (hasSelectedLabels(userItem.etiquetas_ejercicios)) parts.push("Ejercicios por series");
  return parts.join(", ") || "Sin accesos activos";
}

function senderName(profile, user, isAdmin) {
  if (isAdmin) return profile?.nombre || "Ashram Ganesha";
  return profile?.nombre || user?.email || "Usuario";
}

function publicUserName(profile, user) {
  return cleanText(profile?.nombre) || cleanText(user?.displayName) || "Usuario";
}

function commentDisplayName(comment) {
  const name = cleanText(comment?.usuario_nombre) || cleanText(comment?.nombre) || cleanText(comment?.usuario);
  if (!name || name.includes("@")) return "Usuario";
  return name;
}

function messageSenderName(message) {
  if (message.remitente_nombre) return message.remitente_nombre;
  if (message.rol === "admin") return "Ashram Ganesha";
  return message.remitente_email || "Usuario";
}

function isOwnChatMessage(message, user, isAdmin) {
  if (!message) return false;
  if (message.remitente_uid && message.remitente_uid === user?.uid) return true;
  return Boolean(isAdmin && message.rol === "admin");
}

function unlockNotificationSound() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    chatAudioContext ||= new AudioContext();
    chatAudioContext.resume?.();
  } catch {
    // Browsers can block audio until the user interacts with the page.
  }
}

function playChatSound(settings = readAppSettings()) {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    chatAudioContext ||= new AudioContext();
    chatAudioContext.resume?.();
    const normalized = normalizeAppSettings(settings);
    const volume = Math.max(0.02, Math.min(0.22, Number(normalized.notificationVolume || 0.8) * 0.22));
    const notes = soundNotes(normalized.notificationSound);
    notes.forEach((note, index) => {
      const oscillator = chatAudioContext.createOscillator();
      const gain = chatAudioContext.createGain();
      const startAt = chatAudioContext.currentTime + index * note.gap;
      oscillator.type = note.type || "sine";
      oscillator.frequency.setValueAtTime(note.frequency, startAt);
      gain.gain.setValueAtTime(0.001, startAt);
      gain.gain.exponentialRampToValueAtTime(volume, startAt + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, startAt + note.duration);
      oscillator.connect(gain);
      gain.connect(chatAudioContext.destination);
      oscillator.start(startAt);
      oscillator.stop(startAt + note.duration + 0.02);
    });
  } catch {
    // Sound is a bonus; chat updates should keep working even if it is blocked.
  }
}

function soundNotes(soundId) {
  const notes = {
    bell: [
      { frequency: 880, duration: 0.34, gap: 0.12, type: "sine" },
      { frequency: 1320, duration: 0.28, gap: 0.12, type: "triangle" },
    ],
    mantra: [
      { frequency: 432, duration: 0.26, gap: 0.18, type: "sine" },
      { frequency: 540, duration: 0.26, gap: 0.18, type: "sine" },
      { frequency: 648, duration: 0.34, gap: 0.18, type: "sine" },
    ],
    chime: [
      { frequency: 760, duration: 0.2, gap: 0.1, type: "triangle" },
      { frequency: 980, duration: 0.24, gap: 0.1, type: "triangle" },
      { frequency: 1240, duration: 0.24, gap: 0.1, type: "triangle" },
    ],
    temple: [
      { frequency: 620, duration: 0.22, gap: 0.12, type: "sine" },
      { frequency: 840, duration: 0.28, gap: 0.12, type: "sine" },
    ],
  };
  return notes[soundId] || notes.temple;
}

function notifyIncomingChat(thread) {
  playChatSound();
  if (typeof Notification !== "undefined" && Notification.permission === "granted") {
    new Notification(`Nuevo mensaje de ${thread.usuario_nombre || thread.usuario_email || "Usuario"}`, {
      body: thread.ultimo_mensaje || "Abrir chat",
      icon: APP_LOGO_SRC,
      tag: `chat-${thread.id}`,
    });
  }
}

function notifyAdminAlert(alert) {
  playChatSound();
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
  const isSession = alert.type === "session";
  new Notification(isSession ? "Nueva solicitud de turno" : `Nuevo mensaje de ${alert.title || "chat"}`, {
    body: alert.body || (isSession ? "Alguien solicito un turno." : "Abrir chat"),
    icon: APP_LOGO_SRC,
    tag: `${alert.type}-${alert.targetId || alert.id}`,
  });
}

function readAdminAlerts() {
  try {
    const alerts = JSON.parse(localStorage.getItem(ADMIN_ALERTS_STORAGE_KEY) || "[]");
    return Array.isArray(alerts) ? alerts.slice(0, 8) : [];
  } catch {
    return [];
  }
}

function readAppSettings() {
  try {
    return normalizeAppSettings(JSON.parse(localStorage.getItem(APP_SETTINGS_STORAGE_KEY) || "{}"));
  } catch {
    return DEFAULT_APP_SETTINGS;
  }
}

function writeLocalAppSettings(settings) {
  try {
    localStorage.setItem(APP_SETTINGS_STORAGE_KEY, JSON.stringify(normalizeAppSettings(settings)));
  } catch {
    // Local persistence is optional.
  }
}

function requiresAuthView(view) {
  return ["perfil", "chat", "admin"].includes(view);
}

function protectedViewMessage(view) {
  if (view === "admin") return "El panel de administracion requiere iniciar sesion con una cuenta administradora.";
  if (view === "chat") return "Para escribir al Ashram necesitas iniciar sesion o crear una cuenta.";
  return "Para entrar a tu perfil necesitas iniciar sesion o crear una cuenta.";
}

function shouldShowGuestAuthPrompt() {
  const dismissedUntil = Number(localStorage.getItem(GUEST_AUTH_PROMPT_STORAGE_KEY) || 0);
  return !dismissedUntil || dismissedUntil < Date.now();
}

function rememberGuestAuthPromptDismissal() {
  localStorage.setItem(GUEST_AUTH_PROMPT_STORAGE_KEY, String(Date.now() + GUEST_AUTH_PROMPT_DISMISS_MS));
}

function hasActiveSubscription(profile) {
  return Boolean(
    profile?.suscripcionActiva ||
    profile?.suscripcion_activa ||
    profile?.suscripcion_estado === "activa",
  );
}

function hasContentAccess(profile, coleccion, item, freeId) {
  if (!item) return false;
  if (item.id === freeId) return true;
  if (isAdminProfile(profile)) return true;
  if (hasActiveSubscription(profile)) return true;
  if (coleccion === "conocimiento") {
    if (profile?.permiso_conocimientos) return true;
    return Boolean(profile?.etiquetas_conocimiento?.[item.etiqueta]);
  }
  if (coleccion === "ejercicios") {
    if (profile?.permiso_ejercicios) return true;
    return Boolean(profile?.etiquetas_ejercicios?.[item.etiqueta]);
  }
  return true;
}

function needsSubscription(profile, coleccion) {
  if (isAdminProfile(profile)) return false;
  if (hasActiveSubscription(profile)) return false;
  if (coleccion === "conocimiento") return !profile?.permiso_conocimientos;
  if (coleccion === "ejercicios") return !profile?.permiso_ejercicios;
  return false;
}

function subscriptionLabel(coleccion) {
  return coleccion === "conocimiento" ? "Conocimiento" : "Ejercicios";
}

function openSubscriptionWhatsApp(profile, coleccion, fallbackEmail = "") {
  const label = subscriptionLabel(coleccion);
  const text = [
    `Hola, quiero suscribirme a ${label}.`,
    `Nombre: ${profile.nombre}`,
    `Email: ${profile.email || fallbackEmail}`,
    `Telefono: ${profile.telefono}`,
    `Domicilio: ${profile.domicilio}`,
    `Localidad: ${profile.localidad}`,
    `Codigo postal: ${profile.codigo_postal}`,
    `Fecha nacimiento: ${profile.fecha_nacimiento}`,
  ].join("\n");

  window.location.href = `https://wa.me/${ADMIN_WHATSAPP}?text=${encodeURIComponent(text)}`;
}

function openAccessWhatsApp(profile, coleccion, item) {
  const type = contentAccessType(item);
  const section = coleccion === "biblioteca" ? "Biblioteca" : "Meditacion";
  const action = type === "compra" ? "comprar" : "solicitar acceso a";
  const text = [
    `Hola, quiero ${action} este contenido de ${section}.`,
    `Contenido: ${contentTitle(item)}`,
    `Acceso: ${accessLabel(item)}`,
    `Nombre: ${profile?.nombre || ""}`,
    `Email: ${profile?.email || ""}`,
    `Telefono: ${profile?.telefono || ""}`,
  ].join("\n");

  window.location.href = `https://wa.me/${ADMIN_WHATSAPP}?text=${encodeURIComponent(text)}`;
}

function audioSourceUrl(url) {
  return audioSourceUrls(url)[0] || "";
}

function audioSourceUrls(url) {
  if (!url) return [];
  try {
    const parsed = new URL(url);
    const id = googleDriveFileId(parsed);
    if (!id) return [url];
    return [
      `https://drive.usercontent.google.com/download?id=${id}&export=download`,
      `https://drive.google.com/uc?export=download&id=${id}`,
      url,
    ];
  } catch {
    return [url];
  }
}

function googleDriveFileId(parsed) {
  if (!parsed.hostname.includes("drive.google.com") && !parsed.hostname.includes("drive.usercontent.google.com")) return "";
  const idFromQuery = parsed.searchParams.get("id");
  const match = parsed.pathname.match(/\/(?:file\/d|d)\/([^/]+)/);
  return idFromQuery || match?.[1] || "";
}

function missingProfileFields(profile) {
  const labels = {
    nombre: "nombre",
    domicilio: "domicilio",
    telefono: "telefono",
    localidad: "localidad",
    codigo_postal: "codigo postal",
    fecha_nacimiento: "fecha nacimiento",
  };
  return Object.entries(labels)
    .filter(([key]) => !cleanText(profile?.[key]))
    .map(([, label]) => label);
}

async function loadList(path) {
  const snap = await get(ref(db, path));
  const value = snap.val() || {};
  return Object.entries(value)
    .map(([id, item]) => ({ id, ...item }))
    .sort((a, b) => adminSortTitle(a, path).localeCompare(adminSortTitle(b, path)));
}

function adminSortTitle(item, path) {
  if (path === "productos" || path === "tienda") return productName(item);
  return contentTitle(item);
}

async function loadChatThreads() {
  const snap = await get(ref(db, "chat"));
  const value = snap.val() || {};
  return Object.entries(value)
    .map(([id, item]) => ({ id, ...item }))
    .sort((a, b) => (b.ultima_fecha || "").localeCompare(a.ultima_fecha || ""));
}

async function loadBlogSocial(posts) {
  const entries = await Promise.all(
    posts.map(async (post) => {
      const [likeSnap, commentSnap] = await Promise.all([
        get(ref(db, `blog_likes/${post.id}`)),
        get(ref(db, `blog_comentarios/${post.id}`)),
      ]);
      const comments = Object.values(commentSnap.val() || {}).sort((a, b) => (b.fecha || "").localeCompare(a.fecha || ""));
      return [
        post.id,
        {
          likes: Object.keys(likeSnap.val() || {}).length,
          comments: comments.length,
          lastComment: comments[0]?.texto || "",
        },
      ];
    }),
  );
  return Object.fromEntries(entries);
}

async function loadSatsangSocial(items) {
  const entries = await Promise.all(
    items.map(async (item) => {
      const [likeSnap, commentSnap] = await Promise.all([
        get(ref(db, `satsang_likes/${item.id}`)),
        get(ref(db, `satsang_comentarios/${item.id}`)),
      ]);
      const comments = Object.values(commentSnap.val() || {}).sort((a, b) => (b.fecha || "").localeCompare(a.fecha || ""));
      return [
        item.id,
        {
          likes: Object.keys(likeSnap.val() || {}).length,
          comments: comments.length,
          lastComment: comments[0]?.texto || "",
        },
      ];
    }),
  );
  return Object.fromEntries(entries);
}

async function fetchDriveChildren(folderId) {
  const params = new URLSearchParams({
    key: GOOGLE_DRIVE_API_KEY,
    q: `'${folderId}' in parents and trashed = false`,
    fields: "files(id,name,mimeType,webViewLink,thumbnailLink,modifiedTime)",
    orderBy: "folder,name",
    pageSize: "100",
    includeItemsFromAllDrives: "true",
    supportsAllDrives: "true",
  });
  const response = await fetch(`https://www.googleapis.com/drive/v3/files?${params.toString()}`);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || "Google Drive no respondio correctamente.");
  return data.files || [];
}

async function fetchDriveText(fileId) {
  const params = new URLSearchParams({
    key: GOOGLE_DRIVE_API_KEY,
    alt: "media",
  });
  const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?${params.toString()}`);
  if (!response.ok) throw new Error("No se pudo descargar el archivo Markdown.");
  return response.text();
}

function isMarkdownFile(file) {
  return /\.md$/i.test(file.name) || file.mimeType === "text/markdown" || file.mimeType === "text/plain";
}

function driveFileLabel(file) {
  if (isMarkdownFile(file)) return "Markdown";
  if (file.mimeType?.startsWith("image/")) return "Imagen";
  if (file.mimeType === "application/pdf") return "PDF";
  if (file.mimeType?.startsWith("audio/")) return "Audio";
  if (file.mimeType?.startsWith("video/")) return "Video";
  return file.mimeType || "Archivo";
}

function driveFileIcon(file) {
  if (file.mimeType === "application/vnd.google-apps.folder") return "Dir";
  if (isMarkdownFile(file)) return "MD";
  if (file.mimeType === "application/pdf") return "PDF";
  if (file.mimeType?.startsWith("image/")) return "IMG";
  if (file.mimeType?.startsWith("audio/")) return "AUD";
  if (file.mimeType?.startsWith("video/")) return "VID";
  return "FILE";
}

function parseMarkdownFrontmatter(text) {
  const match = text.match(/^---\s*[\r\n]+([\s\S]*?)[\r\n]+---/);
  if (!match) return {};
  return match[1]
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .reduce((meta, line) => {
      const separator = line.indexOf(":");
      if (separator === -1) return meta;
      const key = line.slice(0, separator).trim();
      const value = line.slice(separator + 1).trim();
      return key ? { ...meta, [key]: value } : meta;
    }, {});
}

function stripMarkdownFrontmatter(text) {
  return text.replace(/^---\s*[\r\n]+[\s\S]*?[\r\n]+---\s*/, "").trim();
}

function groupBy(items, key) {
  return items.reduce((groups, item) => {
    const group = cleanText(item[key]) || "Sin categoria";
    groups[group] ||= [];
    groups[group].push(item);
    return groups;
  }, {});
}

function sortCourseModules(modules) {
  return [...modules].sort((a, b) => {
    const orderA = courseModuleOrder(a);
    const orderB = courseModuleOrder(b);
    if (orderA || orderB) return (orderA || Number.MAX_SAFE_INTEGER) - (orderB || Number.MAX_SAFE_INTEGER);
    return contentTitle(a).localeCompare(contentTitle(b));
  });
}

function courseModuleOrder(item) {
  return Number(item?.orden) || 0;
}

function isFreeCourseModule(item) {
  return courseModuleOrder(item) === 1;
}

function coursePrice(modules = []) {
  const pricedModule = modules.find((item) => toNumber(item?.precio) > 0);
  return toNumber(pricedModule?.precio);
}

function courseAccessValue(item) {
  return item?.curso_acceso || item?.acceso_curso || "suscripcion";
}

function isCourseOpen(modules) {
  return modules.length > 0 && modules.every((item) => courseAccessValue(item) === "gratis");
}

function hashView() {
  if (isDeityPath()) return DEITIES_VIEW;
  if (storeProductIdFromUrl()) return "tienda";
  const value = window.location.hash.replace("#", "").split("/")[0];
  return value || "home";
}

function hashDetailId(view) {
  const [hashViewName, id] = window.location.hash.replace("#", "").split("/");
  return hashViewName === view ? id || "" : "";
}

function isDeityPath() {
  return window.location.pathname === "/deidades" || window.location.pathname.startsWith("/deidades/");
}

function deitySlugFromLocation() {
  if (window.location.pathname.startsWith("/deidades/")) {
    return decodeURIComponent(window.location.pathname.split("/").filter(Boolean)[1] || "");
  }
  const [hashViewName, slug] = window.location.hash.replace("#", "").split("/");
  return hashViewName === DEITIES_VIEW ? cleanText(slug) : "";
}

async function deleteStoragePath(path) {
  if (!path) return;
  try {
    await deleteObject(storageRef(storage, path));
  } catch {
    // The database item is the source of truth; stale storage references should not block deletion.
  }
}




















