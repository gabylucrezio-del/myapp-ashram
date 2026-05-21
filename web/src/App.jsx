import {
  ArrowLeft,
  BookOpen,
  Eye,
  EyeOff,
  Lock,
  Heart,
  MessageCircle,
  Newspaper,
  Pause,
  Play,
  Send,
  Share2,
  Download,
  Dumbbell,
  GraduationCap,
  Headphones,
  ImageIcon,
  Library,
  LogOut,
  Pencil,
  Plus,
  Shield,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Upload,
  User,
  Video,
  X,
} from "lucide-react";
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { get, onValue, push, ref, remove, set, update } from "firebase/database";
import { deleteObject, ref as storageRef } from "firebase/storage";
import { auth, db, storage } from "./firebase";
import BookStudio from "./BookStudio";
import CuadernoAshram from "./CuadernoAshram";
import { parseEpubBuffer } from "./epubParser";
import {
  cleanText,
  downloadUrl,
  optimizeImageToDataUrl,
  pdfViewerUrl,
  uploadAudio,
  uploadEpub,
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
let chatAudioContext = null;

const sections = [
  { id: "biblioteca", label: "Biblioteca", icon: Library, iconSrc: "/icono_biblioteca.webp" },
  { id: "conocimiento", label: "Conocimiento", icon: GraduationCap, iconSrc: "/icono_conocimiento.webp" },
  { id: "blog", label: "Blog", icon: Newspaper, iconSrc: "/icono_blog.webp" },
  { id: "ejercicios", label: "Ejercicios", icon: Dumbbell, iconSrc: "/icono_ejercicios.webp" },
  { id: "meditaciones", label: "Meditacion", icon: Headphones, iconSrc: "/icono_meditacion.webp" },
  { id: "satsang", label: "Satsang", icon: Heart, iconSrc: "/satsang.webp" },
];

const adminSections = [
  { id: "biblioteca", label: "Biblioteca", icon: Library, iconSrc: "/icono_biblioteca.webp" },
  { id: "conocimiento", label: "Conocimiento", icon: GraduationCap, iconSrc: "/icono_conocimiento.webp" },
  { id: "ejercicios", label: "Ejercicios", icon: Dumbbell, iconSrc: "/icono_ejercicios.webp" },
  { id: "meditaciones", label: "Meditacion", icon: Headphones, iconSrc: "/icono_meditacion.webp" },
  { id: "satsang", label: "Satsang", icon: Heart, iconSrc: "/satsang.webp" },
  { id: "blog", label: "Blog", icon: Newspaper, iconSrc: "/icono_blog.webp" },
  { id: "banners", label: "Banners", icon: ImageIcon },
  { id: "usuarios", label: "Usuarios", icon: User },
  { id: "libros", label: "Libros", icon: BookOpen },
  { id: "cuaderno", label: "Cuaderno", icon: Library },
];

export default function App() {
  const [authState, setAuthState] = useState({ loading: true, user: null, profile: null });
  const [view, setView] = useState(hashView());
  const [toast, setToast] = useState("");
  const [pendingSubscription, setPendingSubscription] = useState(null);
  const [quickNoteRequest, setQuickNoteRequest] = useState(0);
  const [shareDraft, setShareDraft] = useState(null);

  useEffect(() => {
    return onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setAuthState({ loading: false, user: null, profile: null });
        setView("home");
        return;
      }

      try {
        const profileSnap = await get(ref(db, `usuarios/${user.uid}`));
        let profile = profileSnap.val();
        if (!profile) {
          profile = defaultUserProfile(user);
          await set(ref(db, `usuarios/${user.uid}`), profile);
        }
        setAuthState({ loading: false, user, profile });
      } catch {
        setAuthState({
          loading: false,
          user,
          profile: { email: user.email, rol: "usuario" },
        });
      }
    });
  }, []);

  useEffect(() => {
    window.addEventListener("pointerdown", unlockNotificationSound, { once: true });
    return () => window.removeEventListener("pointerdown", unlockNotificationSound);
  }, []);

  useEffect(() => {
    if (authState.profile?.rol !== "admin") return undefined;
    let firstLoad = true;
    let previousLatest = {};

    return onValue(ref(db, "chat"), (snap) => {
      const value = snap.val() || {};
      const threads = Object.entries(value).map(([id, item]) => ({ id, ...item }));

      if (!firstLoad) {
        threads.forEach((thread) => {
          const previousDate = previousLatest[thread.id];
          const isNewUserMessage = thread.ultima_fecha && thread.ultimo_remitente_rol === "usuario" && (!previousDate || thread.ultima_fecha !== previousDate);
          if (isNewUserMessage) notifyIncomingChat(thread);
        });
      }

      previousLatest = Object.fromEntries(threads.map((thread) => [thread.id, thread.ultima_fecha || ""]));
      firstLoad = false;
    });
  }, [authState.profile?.rol]);

  useEffect(() => {
    window.history.replaceState({ view }, "", `#${view}`);
    const onPopState = () => setView(hashView());
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  function notify(message) {
    setToast(message);
    window.setTimeout(() => setToast(""), 3200);
  }

  function navigate(nextView) {
    if (nextView === view) return;
    window.history.pushState({ view: nextView }, "", `#${nextView}`);
    setView(nextView);
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

  function openQuickNote() {
    setQuickNoteRequest(Date.now());
    navigate("admin");
  }

  function openShare(section, item) {
    const draft = createShareDraft(section, item);
    if (draft) setShareDraft(draft);
  }

  function startSubscription(coleccion) {
    const profile = authState.profile || {};
    const missing = missingProfileFields(profile);
    if (missing.length > 0) {
      const wantsProfile = window.confirm(
        `Para acompañar tu solicitud faltan estos datos: ${missing.join(", ")}. Queres completar tu perfil ahora?`,
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
  if (!authState.user) {
    return (
      <>
        <Login onToast={notify} />
        <InstallPrompt />
      </>
    );
  }

  return (
    <>
      <Shell
        profile={authState.profile}
        view={view}
        setView={navigate}
        onToast={notify}
        onLogout={() => signOut(auth)}
        onQuickNote={openQuickNote}
      >
        {view === "home" && <Home profile={authState.profile} setView={navigate} />}
        {view === "biblioteca" && <Biblioteca profile={authState.profile} onBack={() => navigate("home")} onToast={notify} onShare={openShare} />}
        {view === "conocimiento" && <Contenido coleccion="conocimiento" titulo="Conocimiento" profile={authState.profile} onBack={() => navigate("home")} onToast={notify} onSubscribe={startSubscription} onShare={openShare} />}
        {view === "blog" && <Blog user={authState.user} profile={authState.profile} onBack={() => navigate("home")} onShare={openShare} />}
        {view === "ejercicios" && <Contenido coleccion="ejercicios" titulo="Ejercicios" profile={authState.profile} onBack={() => navigate("home")} onToast={notify} onSubscribe={startSubscription} onShare={openShare} />}
        {view === "meditaciones" && <Meditaciones user={authState.user} profile={authState.profile} onBack={() => navigate("home")} onToast={notify} onShare={openShare} />}
        {view === "satsang" && <Contenido coleccion="satsang" titulo="Satsang" user={authState.user} profile={authState.profile} onBack={() => navigate("home")} onToast={notify} onSubscribe={startSubscription} onShare={openShare} />}
        {view === "chat" && <Chat user={authState.user} profile={authState.profile} onBack={() => navigate("home")} />}
        {view === "admin" && (
          <Admin
            profile={authState.profile}
            quickNoteRequest={quickNoteRequest}
            onQuickNoteHandled={() => setQuickNoteRequest(0)}
            onToast={notify}
            onBack={() => navigate("home")}
          />
        )}
        {view === "perfil" && (
          <Perfil
            user={authState.user}
            profile={authState.profile}
            pendingSubscription={pendingSubscription}
            onBack={() => navigate("home")}
            onProfileSaved={updateProfile}
            onSubscriptionSent={() => setPendingSubscription(null)}
            onToast={notify}
          />
        )}
        {toast && <div className="toast">{toast}</div>}
        {shareDraft ? <SharePromoModal draft={shareDraft} onClose={() => setShareDraft(null)} onToast={notify} /> : null}
      </Shell>
      <InstallPrompt />
    </>
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

function Login({ onToast }) {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    if (!email || !password) return onToast("Completa email y contrasena.");
    if (mode === "register" && password.length < 6) return onToast("La contrasena debe tener minimo 6 caracteres.");

    setBusy(true);
    try {
      if (mode === "register") {
        const credential = await createUserWithEmailAndPassword(auth, email, password);
        await set(ref(db, `usuarios/${credential.user.uid}`), defaultUserProfile(credential.user, email));
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch {
      onToast(mode === "register" ? "No se pudo registrar." : "Email o contrasena incorrectos.");
    } finally {
      setBusy(false);
    }
  }

  async function resetPassword() {
    if (!email) return onToast("Escribi tu email primero.");
    try {
      await sendPasswordResetEmail(auth, email);
      onToast("Te enviamos un email para recuperar la contrasena.");
    } catch {
      onToast("No se pudo enviar el email.");
    }
  }

  return (
    <main className="login-screen">
      <img className="login-bg" src="/fondo_app.webp" alt="" />
      <form className="login-panel" onSubmit={submit}>
        <img className="logo-xl" src={APP_LOGO_SRC} alt="Ashram Ganesha" />
        <h1>{mode === "register" ? "Crear cuenta" : "Entrar al espacio"}</h1>
        <label>
          Email
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" />
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

function Shell({ children, profile, view, setView, onLogout, onQuickNote }) {
  const isAdmin = profile?.rol === "admin";
  const profileName = profileDisplayName(profile);
  const navItems = [
    { id: "home", label: "Inicio", icon: BookOpen, iconSrc: APP_LOGO_SRC },
    sections.find((section) => section.id === "conocimiento"),
    sections.find((section) => section.id === "blog"),
    isAdmin ? { id: "quick-note", label: "Rápida", icon: Sparkles, action: onQuickNote } : null,
    { id: "chat", label: "Chat", icon: MessageCircle },
  ].filter(Boolean);

  return (
    <main className="app-shell">
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
          <button className={view === "perfil" ? "active" : ""} onClick={() => setView("perfil")}>
            <Avatar src={profile?.foto_url} name={profileName} size="tiny" />
            <span>Mi perfil</span>
          </button>
          <button onClick={onLogout} title="Salir">
            <LogOut size={18} />
          </button>
        </nav>
      </header>
      {children}
      <nav className={`bottom-nav ${isAdmin ? "admin-bottom-nav" : ""}`}>
        {navItems.map(({ id, label, icon: Icon, iconSrc, action }) => (
          <button key={id} className={view === id ? "active" : ""} onClick={() => action ? action() : setView(id)}>
            {iconSrc ? <img className="nav-icon" src={iconSrc} alt="" /> : <Icon size={19} />}
            <span>{label}</span>
          </button>
        ))}
      </nav>
    </main>
  );
}

function Home({ profile, setView }) {
  const [banners, setBanners] = useState([]);
  const [bannerIndex, setBannerIndex] = useState(0);

  useEffect(() => {
    loadList("banners").then((items) => {
      setBanners(items.sort((a, b) => (a.orden || 0) - (b.orden || 0)));
    });
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

  function openBannerBlog() {
    if (bannerBlogId) {
      window.history.pushState({ view: "blog", detail: bannerBlogId }, "", `#blog/${bannerBlogId}`);
    }
    setView("blog");
  }

  return (
    <section className="home">
      <div className="home-card">
        <img className="home-logo" src={APP_LOGO_SRC} alt="" />
        <span>
          <strong>Ashram Ganesha</strong>
          <small>Bienvenido, {profileDisplayName(profile)}</small>
        </span>
      </div>
      <p className="home-intention">Un espacio para practicar, leer y volver al centro.</p>
      <button className="banner" type="button" onClick={openBannerBlog}>
        {currentBanner?.imagen ? <img src={currentBanner.imagen} alt="" /> : null}
        <div className="banner-caption">
          {currentBanner?.titulo || "Que la luz guie tu practica de hoy."}
        </div>
      </button>
      <div className="module-grid">
        {sections.map(({ id, label, icon: Icon, iconSrc }) => (
          <button key={id} className="module-tile" onClick={() => setView(id)}>
            {iconSrc ? <img className="module-icon" src={iconSrc} alt="" /> : <Icon size={34} />}
            <span>{label}</span>
          </button>
        ))}
        <button className="module-tile muted" onClick={() => setView("perfil")}>
          <img className="module-icon" src="/icono_perfil.webp" alt="" />
          <span>Mi perfil</span>
        </button>
      </div>
    </section>
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

  const filtered = books.filter((book) => (book.titulo || "").toLowerCase().includes(query.toLowerCase()));

  return (
    <section className="content-page">
      <PageTitle icon={BookOpen} title="Biblioteca" subtitle={sectionSubtitle("biblioteca")} onBack={onBack} />
      <input className="search" placeholder="Buscar libros..." value={query} onChange={(e) => setQuery(e.target.value)} />
      <div className="book-grid">
        {filtered.map((book) => (
          <article className="book-card" key={book.id}>
            <img src={book.portada_url || book.imagen || "/icono_biblioteca.webp"} alt="" />
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
                  setEpubViewer({
                    title: book.titulo || "Libro",
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

  useEffect(() => {
    loadList(coleccion).then((nextItems) => {
      setItems(nextItems);
      if (coleccion === "satsang") loadSatsangSocial(nextItems).then(setSocial);
    });
  }, [coleccion]);

  useEffect(() => {
    const closeDetail = () => setSelected(null);
    window.addEventListener("popstate", closeDetail);
    return () => window.removeEventListener("popstate", closeDetail);
  }, []);

  const freeId = items[0]?.id;

  function openDetail(item) {
    window.history.pushState({ detail: item.id }, "", `#${coleccion}/${item.id}`);
    setSelected(item);
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
        showSubscribe={selected.id === freeId && needsSubscription(profile, coleccion)}
        onBack={() => window.history.back()}
        onToast={onToast}
        onSubscribe={onSubscribe}
        onShare={() => onShare?.(coleccion, selected)}
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
            return (
              <button className="post-card" key={item.id} onClick={() => openDetail(item)}>
                {item.imagen ? <img src={item.imagen} alt="" /> : null}
                <span>
                  <strong>{contentTitle(item)}</strong>
                  <small>Satsang</small>
                  <p>{summary(item.descripcion, 130)}</p>
                  <span className="post-meta">
                    <span><Heart size={15} /> {stats.likes}</span>
                    <span><MessageCircle size={15} /> {stats.comments}</span>
                  </span>
                  {stats.lastComment ? <em>Ultima reflexion: {summary(stats.lastComment, 70)}</em> : null}
                </span>
              </button>
            );
          })}
        </div>
      </section>
    );
  }

  const groups = coleccion === "satsang" ? { Satsang: items } : groupBy(items, "etiqueta");
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
  const embed = youtubeEmbedUrl(modulo.video);
  const itemTitle = contentTitle(modulo);
  return (
    <section className="content-page">
      <PageTitle icon={sectionIcon(coleccion)} iconSrc={sectionIconSrc(coleccion)} title={titulo} subtitle={sectionSubtitle(coleccion)} onBack={onBack} />
      <article className="detail">
        <img className="detail-cover" src={modulo.imagen || sectionFallbackImage(coleccion)} alt="" />
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
        {modulo.pdf ? (
          <a className="primary" href={downloadUrl(modulo.pdf, `${itemTitle || "material"}.pdf`)}>
            <Download size={18} /> Descargar PDF
          </a>
        ) : null}
      </article>
    </section>
  );
}

function SatsangDetail({ item, user, profile, onBack, onShare }) {
  const [likes, setLikes] = useState({});
  const [comments, setComments] = useState([]);
  const [comment, setComment] = useState("");
  const itemTitle = contentTitle(item);
  const embed = youtubeEmbedUrl(item.video);

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
        <p>{item.descripcion}</p>
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
      <div className="list">
        {items.length === 0 ? <p className="empty-state">Aun no hay meditaciones disponibles.</p> : null}
        {items.map((item) => (
          <button className="row-card" key={item.id} onClick={() => openMeditation(item)}>
            <img src={item.imagen || "/icono_meditacion.webp"} alt="" />
            <span>
              <strong>{item.titulo || "Sin titulo"}</strong>
              <small>{item.descripcion || "Meditacion guiada"}</small>
              {contentAccessType(item) !== "gratis" ? <small className="row-meta"><span>{accessLabel(item)}</span></small> : null}
            </span>
            {favorites[item.id] ? <Heart className="favorite-mark" size={20} /> : <Headphones size={22} />}
          </button>
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

function SimpleAudioPlayer({ sources, title }) {
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
  }, [audio]);

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
  const isAdmin = profile?.rol === "admin";
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

  useEffect(() => {
    return onValue(ref(db, `chat/${threadId}/mensajes`), (snap) => {
      const value = snap.val() || {};
      setMessages(
        Object.entries(value)
          .map(([id, item]) => ({ id, ...item }))
          .sort((a, b) => (a.fecha || "").localeCompare(b.fecha || "")),
      );
    });
  }, [threadId]);

  async function sendMessage(event) {
    event.preventDefault();
    const message = cleanText(text);
    if (!message) return;
    setBusy(true);
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
    await push(ref(db, `chat/${threadId}/mensajes`), payload);
    await update(ref(db, `chat/${threadId}`), threadData);
    setText("");
    setBusy(false);
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
        <form className="chat-input" onSubmit={sendMessage}>
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Escribe un mensaje..." />
          <button className="primary" disabled={busy}>
            <Send size={17} />
          </button>
        </form>
      </div>
    </section>
  );
}

function Admin({ profile, quickNoteRequest = 0, onQuickNoteHandled, onToast, onBack }) {
  const [section, setSection] = useState("biblioteca");
  const [items, setItems] = useState([]);
  const [editing, setEditing] = useState(null);
  const [shareDraft, setShareDraft] = useState(null);

  useEffect(() => {
    if (section === "cuaderno" || section === "libros") {
      setItems([]);
      return;
    }
    loadList(section).then(setItems);
  }, [section]);

  useEffect(() => {
    if (!quickNoteRequest) return;
    setSection("cuaderno");
    setEditing(null);
  }, [quickNoteRequest]);

  async function refresh() {
    setItems(await loadList(section));
  }

  async function deleteItem(item) {
    if (!window.confirm(`Borrar "${contentTitle(item) || "item"}"?`)) return;
    await remove(ref(db, `${section}/${item.id}`));
    await deleteStoragePath(item.portada_path || item.imagen_path);
    await deleteStoragePath(item.pdf_path);
    await deleteStoragePath(item.epub_path);
    onToast("Contenido borrado.");
    refresh();
  }

  return (
    <section className="content-page">
      <PageTitle icon={Shield} title="Administracion" subtitle="Cuida los contenidos que sostienen la practica." onBack={onBack} />
      <div className="tabs">
        {adminSections.map(({ id, label }) => (
          <button key={id} className={section === id ? "active" : ""} onClick={() => { setSection(id); setEditing(null); }}>
            {label}
          </button>
        ))}
      </div>
      {section !== "usuarios" && section !== "cuaderno" && section !== "libros" ? (
        <button className="primary" onClick={() => setEditing({})}>
          <Plus size={18} /> Nuevo
        </button>
      ) : null}
      {editing && section !== "usuarios" && section !== "cuaderno" && section !== "libros" && (
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
        />
      )}
      {section === "cuaderno" ? (
        <CuadernoAshram
          profile={profile}
          quickNoteRequest={quickNoteRequest}
          onQuickNoteHandled={onQuickNoteHandled}
          onToast={onToast}
          onShared={(target, note) => {
            const draft = createShareDraft(noteTargetToSection(target), note);
            if (draft) setShareDraft(draft);
          }}
        />
      ) : section === "libros" ? (
        <BookStudio profile={profile} onToast={onToast} />
      ) : section === "usuarios" ? (
        <UserManagement users={items} onToast={onToast} onRefresh={refresh} />
      ) : (
        <div className="list">
          {items.map((item) => (
            <article className="admin-row" key={item.id}>
              <img src={item.portada_url || item.imagen || sectionFallbackImage(section)} alt="" />
              <span>
                <strong>{contentTitle(item)}</strong>
                <small>{section === "satsang" ? "Satsang" : item.categoria || item.etiqueta || "Sin categoria"}</small>
              </span>
              <button className="icon-btn" onClick={() => setEditing(item)}><Pencil size={18} /></button>
              <button className="icon-btn danger" onClick={() => deleteItem(item)}><Trash2 size={18} /></button>
            </article>
          ))}
        </div>
      )}
      {shareDraft ? <SharePromoModal draft={shareDraft} onClose={() => setShareDraft(null)} onToast={onToast} /> : null}
    </section>
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
    const blob = await response.blob();
    if (!blob.type?.startsWith("image/")) return null;
    const extension = blob.type.split("/")[1]?.split(";")[0] || "jpg";
    const safeName = cleanFileName(title || "ashram-ganesha");
    return new File([blob], `${safeName}.${extension}`, { type: blob.type });
  } catch {
    return null;
  }
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

function UserManagement({ users, onToast, onRefresh }) {
  const [editing, setEditing] = useState(null);

  if (editing) {
    return (
      <UserEditor
        userItem={editing}
        onCancel={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          onRefresh();
          onToast("Usuario actualizado.");
        }}
      />
    );
  }

  return (
    <div className="list">
      {users.map((item) => (
        <button className="admin-row user-row" key={item.id} onClick={() => setEditing(item)}>
          <Avatar src={item.foto_url} name={item.nombre || item.email || "Usuario"} />
          <span>
            <strong>{item.nombre || item.email || item.id}</strong>
            <small>{item.email || ""}</small>
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

function UserEditor({ userItem, onCancel, onSaved }) {
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
    etiquetas_conocimiento: labelsToText(userItem.etiquetas_conocimiento),
    etiquetas_ejercicios: labelsToText(userItem.etiquetas_ejercicios),
  });
  const [busy, setBusy] = useState(false);

  function setField(key, value) {
    setForm((old) => ({ ...old, [key]: value }));
  }

  async function save(event) {
    event.preventDefault();
    setBusy(true);
    await update(ref(db, `usuarios/${userItem.id}`), {
      nombre: cleanText(form.nombre),
      domicilio: cleanText(form.domicilio),
      telefono: cleanText(form.telefono),
      localidad: cleanText(form.localidad),
      codigo_postal: cleanText(form.codigo_postal),
      fecha_nacimiento: cleanText(form.fecha_nacimiento),
      rol: form.rol,
      permiso_conocimientos: form.permiso_conocimientos,
      permiso_ejercicios: form.permiso_ejercicios,
      etiquetas_conocimiento: textToLabels(form.etiquetas_conocimiento),
      etiquetas_ejercicios: textToLabels(form.etiquetas_ejercicios),
    });
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
      <label>Etiquetas conocimiento<input value={form.etiquetas_conocimiento} onChange={(e) => setField("etiquetas_conocimiento", e.target.value)} /></label>
      <label className="check-row">
        <input type="checkbox" checked={form.permiso_ejercicios} onChange={(e) => setField("permiso_ejercicios", e.target.checked)} />
        Acceso total ejercicios
      </label>
      <label>Etiquetas ejercicios<input value={form.etiquetas_ejercicios} onChange={(e) => setField("etiquetas_ejercicios", e.target.value)} /></label>
      <button className="primary" disabled={busy}>{busy ? "Guardando..." : "Guardar cambios"}</button>
    </form>
  );
}

function AdminForm({ section, item, onCancel, onSaved, onToast }) {
  const isBook = section === "biblioteca";
  const isBlog = section === "blog";
  const isBanner = section === "banners";
  const isMeditation = section === "meditaciones";
  const isSatsang = section === "satsang";
  const hasAccessMode = isBook || isMeditation;
  const includePdf = isBook || section === "conocimiento";
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
    acceso: item.acceso || item.tipo_acceso || "gratis",
  });
  const [blogPosts, setBlogPosts] = useState([]);
  const [image, setImage] = useState(null);
  const [pdf, setPdf] = useState(null);
  const [epub, setEpub] = useState(null);
  const [audioFile, setAudioFile] = useState(null);
  const [busy, setBusy] = useState(false);

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
    if (!cleanText(form.titulo)) return onToast(isSatsang ? "Completa el tema." : "Completa el titulo.");
    if (!isBanner && !isMeditation && !isSatsang && !cleanText(form.categoria)) return onToast(isBook ? "Completa la categoria." : "Completa la etiqueta.");
    if (isBanner && !cleanText(form.blog_id)) return onToast("Selecciona el post del blog.");
    const existingAudio = item.audio_url || item.link_audio || item.audio || item.link_drive;
    if (isMeditation && !audioFile && !cleanText(form.link_drive) && !existingAudio) return onToast("Subi el audio M4A o completa el link de Google Drive.");
    if (!isSatsang && !image && !(item.portada_url || item.imagen)) return onToast("Selecciona una imagen.");
    if (includePdf && !pdf && !epub && !(item.pdf_url || item.pdf || item.epub_url || item.epub)) return onToast(isBook ? "Selecciona un PDF o EPUB." : "Selecciona un PDF.");

    setBusy(true);
    try {
      const data = {
        titulo: cleanText(form.titulo),
        descripcion: cleanText(form.descripcion),
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

      if (isBook) {
        if (epub) {
          const parsedEpub = await parseEpubBuffer(await epub.arrayBuffer());
          const uploaded = await uploadEpub(epub, "biblioteca/epubs");
          data.epub = uploaded.url;
          data.epub_url = uploaded.url;
          data.epub_path = uploaded.path;
          data.epub_title = parsedEpub.title || cleanText(form.titulo);
          data.epub_chapters = parsedEpub.chapters;
        } else {
          data.epub = item.epub || item.epub_url || "";
          data.epub_url = item.epub_url || item.epub || "";
          data.epub_path = item.epub_path || "";
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
      {!isBanner && !isMeditation && !isSatsang ? <label>{isBook ? "Categoria" : "Etiqueta"}<input value={form.categoria} onChange={(e) => setField("categoria", e.target.value)} /></label> : null}
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
      {isMeditation ? <label>Link Google Drive M4A<input value={form.link_drive} onChange={(e) => setField("link_drive", e.target.value)} /></label> : null}
      {!isBook && !isBlog && !isBanner && !isMeditation ? <label>Link video YouTube<input value={form.video} onChange={(e) => setField("video", e.target.value)} /></label> : null}
      {!isSatsang ? <FileInput icon={ImageIcon} label="Imagen" file={image} accept="image/jpeg,image/png,image/webp" onChange={setImage} /> : null}
      {isMeditation ? <FileInput icon={Upload} label="Audio M4A" file={audioFile} accept="audio/mp4,audio/x-m4a,.m4a" onChange={setAudioFile} /> : null}
      {includePdf ? <FileInput icon={Upload} label="PDF" file={pdf} accept="application/pdf" onChange={setPdf} /> : null}
      {isBook ? <FileInput icon={Upload} label="EPUB" file={epub} accept="application/epub+zip,.epub" onChange={setEpub} /> : null}
      <button className="primary" disabled={busy}>{busy ? "Subiendo..." : "Guardar"}</button>
    </form>
  );
}

function FileInput({ icon: Icon, label, accept, file, onChange }) {
  return (
    <label className="file-field">
      <Icon size={18} />
      <span>{file ? file.name : `Seleccionar ${label}`}</span>
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
      await update(ref(db, `usuarios/${user.uid}`), cleanedProfile);
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
        <p>{profile?.rol === "admin" ? "Administrador" : "Usuario"} - {user.email}</p>
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

function sectionConfig(id) {
  return sections.find((section) => section.id === id) || adminSections.find((section) => section.id === id);
}

function sectionIcon(id) {
  return sectionConfig(id)?.icon || BookOpen;
}

function sectionIconSrc(id) {
  return sectionConfig(id)?.iconSrc || "";
}

function sectionSubtitle(id) {
  const subtitles = {
    biblioteca: "Lecturas para expandir la mirada.",
    conocimiento: "Ideas para estudiar y practicar con presencia.",
    blog: "Palabras, novedades y reflexiones del camino.",
    ejercicios: "Practicas simples para habitar el cuerpo.",
    meditaciones: "Un momento para volver al centro.",
    satsang: "Encuentros, palabras y presencia compartida.",
    chat: "Un canal directo para acompanarte.",
  };
  return subtitles[id] || "";
}

function sectionFallbackImage(id) {
  if (id === "biblioteca") return "/icono_biblioteca.webp";
  if (id === "blog") return "/icono_blog.webp";
  if (id === "meditaciones") return "/icono_meditacion.webp";
  return sectionIconSrc(id) || "/icono_conocimiento.webp";
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
  if (profile?.rol === "admin") return true;
  return contentAccessType(item) === "gratis";
}

function defaultUserProfile(user, fallbackEmail = "") {
  return {
    email: user?.email || fallbackEmail || "",
    nombre: user?.displayName || "",
    domicilio: "",
    telefono: "",
    localidad: "",
    codigo_postal: "",
    fecha_nacimiento: "",
    foto_url: user?.photoURL || "",
    foto_path: "",
    edad: null,
    rol: "usuario",
    permiso_biblioteca: true,
    permiso_meditacion: true,
    permiso_conocimientos: false,
    permiso_ejercicios: false,
    etiquetas_conocimiento: {},
    etiquetas_ejercicios: {},
  };
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

function labelsToText(labels) {
  if (!labels || typeof labels !== "object") return "";
  return Object.entries(labels)
    .filter(([, value]) => value)
    .map(([key]) => key)
    .sort()
    .join(", ");
}

function textToLabels(text) {
  return cleanText(text)
    .split(",")
    .map((label) => cleanText(label))
    .filter(Boolean)
    .reduce((result, label) => ({ ...result, [label]: true }), {});
}

function userPermissionText(userItem) {
  const parts = [];
  if (userItem.rol === "admin") parts.push("Admin");
  if (userItem.permiso_conocimientos) parts.push("Conocimiento total");
  else if (userItem.etiquetas_conocimiento) parts.push("Conocimiento por etiquetas");
  if (userItem.permiso_ejercicios) parts.push("Ejercicios total");
  else if (userItem.etiquetas_ejercicios) parts.push("Ejercicios por etiquetas");
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

function playChatSound() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    chatAudioContext ||= new AudioContext();
    const oscillator = chatAudioContext.createOscillator();
    const gain = chatAudioContext.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(760, chatAudioContext.currentTime);
    oscillator.frequency.setValueAtTime(980, chatAudioContext.currentTime + 0.09);
    gain.gain.setValueAtTime(0.001, chatAudioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.18, chatAudioContext.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, chatAudioContext.currentTime + 0.22);
    oscillator.connect(gain);
    gain.connect(chatAudioContext.destination);
    oscillator.start();
    oscillator.stop(chatAudioContext.currentTime + 0.24);
  } catch {
    // Sound is a bonus; chat updates should keep working even if it is blocked.
  }
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

function hasContentAccess(profile, coleccion, item, freeId) {
  if (!item) return false;
  if (item.id === freeId) return true;
  if (profile?.rol === "admin") return true;
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
  if (profile?.rol === "admin") return false;
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
    .sort((a, b) => (a.titulo || "").localeCompare(b.titulo || ""));
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

function hashView() {
  const value = window.location.hash.replace("#", "").split("/")[0];
  return value || "home";
}

function hashDetailId(view) {
  const [hashViewName, id] = window.location.hash.replace("#", "").split("/");
  return hashViewName === view ? id || "" : "";
}

async function deleteStoragePath(path) {
  if (!path) return;
  try {
    await deleteObject(storageRef(storage, path));
  } catch {
    // The database item is the source of truth; stale storage references should not block deletion.
  }
}
