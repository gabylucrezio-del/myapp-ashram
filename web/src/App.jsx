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
  Trash2,
  Upload,
  User,
  Video,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
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
import {
  cleanText,
  downloadUrl,
  optimizeImageToDataUrl,
  pdfViewerUrl,
  uploadAudio,
  uploadOptimizedImage,
  uploadPdf,
  youtubeEmbedUrl,
} from "./utils";

const ADMIN_WHATSAPP = "5493562514248";
let chatAudioContext = null;

const sections = [
  { id: "biblioteca", label: "Biblioteca", icon: Library },
  { id: "conocimiento", label: "Conocimiento", icon: GraduationCap },
  { id: "blog", label: "Blog", icon: Newspaper },
  { id: "ejercicios", label: "Ejercicios", icon: Dumbbell },
  { id: "meditaciones", label: "Meditacion", icon: Headphones },
];

const adminSections = [
  { id: "biblioteca", label: "Biblioteca", icon: Library },
  { id: "conocimiento", label: "Conocimiento", icon: GraduationCap },
  { id: "ejercicios", label: "Ejercicios", icon: Dumbbell },
  { id: "meditaciones", label: "Meditacion", icon: Headphones },
  { id: "blog", label: "Blog", icon: Newspaper },
  { id: "banners", label: "Banners", icon: ImageIcon },
  { id: "usuarios", label: "Usuarios", icon: User },
];

export default function App() {
  const [authState, setAuthState] = useState({ loading: true, user: null, profile: null });
  const [view, setView] = useState(hashView());
  const [toast, setToast] = useState("");
  const [pendingSubscription, setPendingSubscription] = useState(null);

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

  function startSubscription(coleccion) {
    const profile = authState.profile || {};
    const missing = missingProfileFields(profile);
    if (missing.length > 0) {
      const wantsProfile = window.confirm(
        `Para solicitar la suscripcion faltan estos datos: ${missing.join(", ")}. Queres completar tu perfil ahora?`,
      );
      if (!wantsProfile) {
        notify("Completa tu perfil para solicitar la suscripcion.");
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
      >
        {view === "home" && <Home profile={authState.profile} setView={navigate} />}
        {view === "biblioteca" && <Biblioteca onBack={() => navigate("home")} />}
        {view === "conocimiento" && <Contenido coleccion="conocimiento" titulo="Conocimiento" profile={authState.profile} onBack={() => navigate("home")} onToast={notify} onSubscribe={startSubscription} />}
        {view === "blog" && <Blog user={authState.user} onBack={() => navigate("home")} />}
        {view === "ejercicios" && <Contenido coleccion="ejercicios" titulo="Ejercicios" profile={authState.profile} onBack={() => navigate("home")} onToast={notify} onSubscribe={startSubscription} />}
        {view === "meditaciones" && <Meditaciones user={authState.user} onBack={() => navigate("home")} onToast={notify} />}
        {view === "chat" && <Chat user={authState.user} profile={authState.profile} onBack={() => navigate("home")} />}
        {view === "admin" && <Admin onToast={notify} onBack={() => navigate("home")} />}
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
      <img src="/Logo Ashram.webp" alt="" />
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
      <div className="login-panel">
        <img className="logo-xl" src="/Logo Ashram.webp" alt="Ashram Ganesha" />
        <p>Cargando...</p>
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
        <img className="logo-xl" src="/Logo Ashram.webp" alt="Ashram Ganesha" />
        <h1>{mode === "register" ? "Crear cuenta" : "Iniciar sesion"}</h1>
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

function Shell({ children, profile, view, setView, onLogout }) {
  const isAdmin = profile?.rol === "admin";
  const profileName = profileDisplayName(profile);
  const navItems = [
    { id: "home", label: "Inicio", icon: BookOpen },
    { id: "biblioteca", label: "Biblioteca", icon: Library },
    { id: "conocimiento", label: "Conocimiento", icon: GraduationCap },
    { id: "blog", label: "Blog", icon: Newspaper },
    { id: "ejercicios", label: "Ejercicios", icon: Dumbbell },
    { id: "meditaciones", label: "Meditacion", icon: Headphones },
    { id: "chat", label: "Chat", icon: MessageCircle },
  ];

  return (
    <main className="app-shell">
      <header className="topbar">
        <button className="brand" onClick={() => setView("home")}>
          <img src="/Logo Ashram.webp" alt="" />
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
      <nav className="bottom-nav">
        {navItems.map(({ id, label, icon: Icon }) => (
          <button key={id} className={view === id ? "active" : ""} onClick={() => setView(id)}>
            <Icon size={19} />
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
        <img className="home-logo" src="/Logo Ashram.webp" alt="" />
        <span>
          <strong>Ashram Ganesha</strong>
          <small>Bienvenido, {profileDisplayName(profile)}</small>
        </span>
      </div>
      <button className="banner" type="button" onClick={openBannerBlog}>
        {currentBanner?.imagen ? <img src={currentBanner.imagen} alt="" /> : null}
        <div className="banner-caption">
          {currentBanner?.titulo || "Descubre la magia de Ashram Ganesha, un espacio para conectar con tu interior y encontrar armonia."}
        </div>
      </button>
      <div className="module-grid">
        {sections.map(({ id, label, icon: Icon }) => (
          <button key={id} className="module-tile" onClick={() => setView(id)}>
            <Icon size={34} />
            <span>{label}</span>
          </button>
        ))}
        <button className="module-tile muted" onClick={() => setView("perfil")}>
          <User size={34} />
          <span>Mi perfil</span>
        </button>
      </div>
    </section>
  );
}

function Biblioteca({ onBack }) {
  const [books, setBooks] = useState([]);
  const [query, setQuery] = useState("");
  const [pdfViewer, setPdfViewer] = useState(null);

  useEffect(() => {
    loadList("biblioteca").then(setBooks);
  }, []);

  const filtered = books.filter((book) => (book.titulo || "").toLowerCase().includes(query.toLowerCase()));

  return (
    <section className="content-page">
      <PageTitle icon={BookOpen} title="Biblioteca" onBack={onBack} />
      <input className="search" placeholder="Buscar libros..." value={query} onChange={(e) => setQuery(e.target.value)} />
      <div className="book-grid">
        {filtered.map((book) => (
          <article className="book-card" key={book.id}>
            <img src={book.portada_url || book.imagen || "/icono_biblioteca.webp"} alt="" />
            <h3>{book.titulo}</h3>
            <p>{book.categoria || "Sin categoria"}</p>
            {book.pdf_url || book.pdf ? (
              <button
                className="primary small"
                onClick={() => setPdfViewer({ title: book.titulo || "Libro", url: book.pdf_url || book.pdf })}
              >
                <BookOpen size={16} /> Leer
              </button>
            ) : null}
          </article>
        ))}
      </div>
      {pdfViewer ? <PdfModal viewer={pdfViewer} onClose={() => setPdfViewer(null)} /> : null}
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

function Contenido({ coleccion, titulo, profile, onBack, onToast, onSubscribe }) {
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    loadList(coleccion).then(setItems);
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
      />
    );
  }

  const groups = groupBy(items, "etiqueta");
  return (
    <section className="content-page">
      <PageTitle icon={coleccion === "conocimiento" ? GraduationCap : Dumbbell} title={titulo} onBack={onBack} />
      {Object.entries(groups).map(([tag, modules]) => (
        <div className="group" key={tag}>
          <h2>{tag}</h2>
          <div className="list">
            {modules.map((item) => {
              const locked = !hasContentAccess(profile, coleccion, item, freeId);
              return (
                <button
                  className={`row-card ${locked ? "locked" : ""}`}
                  key={item.id}
                  onClick={() => {
                    if (locked) {
                      onToast?.("Este modulo requiere suscripcion.");
                      return;
                    }
                    openDetail(item);
                  }}
                >
                  <img src={item.imagen || "/icono_conocimiento.webp"} alt="" />
                  <span>
                    <strong>{item.titulo}</strong>
                    <small>{item.descripcion}</small>
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

function DetalleModulo({ modulo, titulo, coleccion, profile, showSubscribe, onBack, onToast, onSubscribe }) {
  const embed = youtubeEmbedUrl(modulo.video);
  return (
    <section className="content-page">
      <PageTitle icon={GraduationCap} title={titulo} onBack={onBack} />
      <article className="detail">
        <img className="detail-cover" src={modulo.imagen || "/icono_conocimiento.webp"} alt="" />
        <h1>{modulo.titulo}</h1>
        {embed ? (
          <div className="video-frame">
            <iframe
              title={modulo.titulo}
              src={embed}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        ) : null}
        <p>{modulo.descripcion}</p>
        {showSubscribe ? (
          <div className="subscribe-panel">
            <strong>Quieres acceder al resto del contenido?</strong>
            <small>Completa tu perfil y enviamos la solicitud por WhatsApp con tus datos.</small>
            <button className="primary" onClick={() => onSubscribe?.(coleccion)}>
              <MessageCircle size={18} /> Solicitar suscripcion
            </button>
          </div>
        ) : null}
        {modulo.pdf ? (
          <a className="primary" href={downloadUrl(modulo.pdf, `${modulo.titulo || "material"}.pdf`)}>
            <Download size={18} /> Descargar PDF
          </a>
        ) : null}
      </article>
    </section>
  );
}

function Meditaciones({ user, onBack, onToast }) {
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
      />
    );
  }

  return (
    <section className="content-page">
      <PageTitle icon={Headphones} title="Meditacion" onBack={onBack} />
      <div className="list">
        {items.length === 0 ? <p className="empty-state">Todavia no hay meditaciones cargadas.</p> : null}
        {items.map((item) => (
          <button className="row-card" key={item.id} onClick={() => openMeditation(item)}>
            <img src={item.imagen || "/icono_conocimiento.webp"} alt="" />
            <span>
              <strong>{item.titulo || "Sin titulo"}</strong>
              <small>{item.descripcion || "Meditacion guiada"}</small>
            </span>
            {favorites[item.id] ? <Heart className="favorite-mark" size={20} /> : <Headphones size={22} />}
          </button>
        ))}
      </div>
    </section>
  );
}

function MeditationDetail({ item, favorite, onBack, onFavorite }) {
  const rawAudioUrl = item.audio_url || item.link_audio || item.audio || item.link_drive || "";
  const audioUrl = audioSourceUrl(rawAudioUrl);
  return (
    <section className="content-page">
      <PageTitle icon={Headphones} title="Meditacion" onBack={onBack} />
      <article className="detail meditation-detail">
        <img className="detail-cover" src={item.imagen || "/icono_conocimiento.webp"} alt="" />
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

function Blog({ user, onBack }) {
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

  if (selected) return <BlogDetail post={selected} user={user} onBack={() => window.history.back()} />;

  return (
    <section className="content-page">
      <PageTitle icon={Newspaper} title="Blog" onBack={onBack} />
      <div className="blog-list">
        {posts.map((post) => {
          const stats = social[post.id] || { likes: 0, comments: 0, lastComment: "" };
          return (
            <button className="post-card" key={post.id} onClick={() => openPost(post)}>
              {post.imagen ? <img src={post.imagen} alt="" /> : null}
              <span>
                <strong>{post.titulo || "Sin titulo"}</strong>
                <small>{post.etiqueta || "Sin etiqueta"} - {formatDate(post.fecha_carga)}</small>
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

function BlogDetail({ post, user, onBack }) {
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
      usuario: user.email || "Usuario",
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
        <small>{post.etiqueta || "Sin etiqueta"} - {formatDate(post.fecha_carga)}</small>
        <p>{post.descripcion}</p>
        <button className={`like-button ${likes[user.uid] ? "active" : ""}`} onClick={toggleLike}>
          <Heart size={18} /> {Object.keys(likes).length}
        </button>
      </article>
      <form className="comment-form" onSubmit={sendComment}>
        <textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Deja tu comentario" />
        <button className="primary"><Send size={17} /> Enviar</button>
      </form>
      <div className="comments">
        <h2><MessageCircle size={18} /> Comentarios</h2>
        {comments.length === 0 ? <p>Sin comentarios todavia.</p> : null}
        {comments.map((item) => (
          <article className="comment" key={item.id}>
            <strong>{item.usuario || "Usuario"}</strong>
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
        <PageTitle icon={MessageCircle} title="Chat" onBack={onBack} />
        <div className="chat-alert-row">
          <span>{notifyStatus === "granted" ? "Avisos de chat activados" : "Activa avisos para recibir sonido y notificacion."}</span>
          {notifyStatus !== "granted" && notifyStatus !== "unsupported" ? (
            <button className="primary small" type="button" onClick={enableChatAlerts}>
              Activar avisos
            </button>
          ) : null}
        </div>
        <div className="list">
          {threads.length === 0 ? <p className="empty-state">Todavia no hay consultas.</p> : null}
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
      <PageTitle icon={MessageCircle} title="Chat" onBack={onBack} />
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

function Admin({ onToast, onBack }) {
  const [section, setSection] = useState("biblioteca");
  const [items, setItems] = useState([]);
  const [editing, setEditing] = useState(null);

  useEffect(() => {
    loadList(section).then(setItems);
  }, [section]);

  async function refresh() {
    setItems(await loadList(section));
  }

  async function deleteItem(item) {
    if (!window.confirm(`Borrar "${item.titulo || "item"}"?`)) return;
    await remove(ref(db, `${section}/${item.id}`));
    await deleteStoragePath(item.portada_path || item.imagen_path);
    await deleteStoragePath(item.pdf_path);
    onToast("Contenido borrado.");
    refresh();
  }

  return (
    <section className="content-page">
      <PageTitle icon={Shield} title="Administracion" onBack={onBack} />
      <div className="tabs">
        {adminSections.map(({ id, label }) => (
          <button key={id} className={section === id ? "active" : ""} onClick={() => { setSection(id); setEditing(null); }}>
            {label}
          </button>
        ))}
      </div>
      {section !== "usuarios" ? (
        <button className="primary" onClick={() => setEditing({})}>
          <Plus size={18} /> Nuevo
        </button>
      ) : null}
      {editing && section !== "usuarios" && (
        <AdminForm
          key={`${section}-${editing.id || "new"}`}
          section={section}
          item={editing}
          onCancel={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            refresh();
            onToast("Contenido guardado.");
          }}
          onToast={onToast}
        />
      )}
      {section === "usuarios" ? (
        <UserManagement users={items} onToast={onToast} onRefresh={refresh} />
      ) : (
        <div className="list">
          {items.map((item) => (
            <article className="admin-row" key={item.id}>
              <img src={item.portada_url || item.imagen || "/icono_conocimiento.webp"} alt="" />
              <span>
                <strong>{item.titulo}</strong>
                <small>{item.categoria || item.etiqueta || "Sin etiqueta"}</small>
              </span>
              <button className="icon-btn" onClick={() => setEditing(item)}><Pencil size={18} /></button>
              <button className="icon-btn danger" onClick={() => deleteItem(item)}><Trash2 size={18} /></button>
            </article>
          ))}
        </div>
      )}
    </section>
  );
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
  const includePdf = section !== "ejercicios" && !isBlog && !isBanner && !isMeditation;
  const [form, setForm] = useState({
    titulo: item.titulo || "",
    descripcion: item.descripcion || "",
    categoria: item.categoria || item.etiqueta || "",
    autor: item.autor || "",
    video: item.link_video_original || item.video || "",
    orden: item.orden || "",
    blog_id: item.blog_id || item.blogId || item.post_id || item.postId || "",
    detalle: item.detalle || "",
    link_drive: item.link_drive || "",
  });
  const [blogPosts, setBlogPosts] = useState([]);
  const [image, setImage] = useState(null);
  const [pdf, setPdf] = useState(null);
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
    if (!cleanText(form.titulo)) return onToast("Completa el titulo.");
    if (!isBanner && !isMeditation && !cleanText(form.categoria)) return onToast(isBook ? "Completa la categoria." : "Completa la etiqueta.");
    if (isBanner && !cleanText(form.blog_id)) return onToast("Selecciona el post del blog.");
    const existingAudio = item.audio_url || item.link_audio || item.audio || item.link_drive;
    if (isMeditation && !audioFile && !cleanText(form.link_drive) && !existingAudio) return onToast("Subi el audio M4A o completa el link de Google Drive.");
    if (!image && !(item.portada_url || item.imagen)) return onToast("Selecciona una imagen.");
    if (includePdf && !pdf && !(item.pdf_url || item.pdf)) return onToast("Selecciona un PDF.");

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
      } else if (isBlog) {
        data.etiqueta = cleanText(form.categoria);
        data.fecha_carga = item.fecha_carga || new Date().toISOString();
      } else if (isBanner) {
        data.orden = Number(form.orden) || 0;
        data.blog_id = cleanText(form.blog_id);
      } else if (isMeditation) {
        data.detalle = cleanText(form.detalle);
        data.link_drive = cleanText(form.link_drive);
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

      if (item.id) {
        await update(ref(db, `${section}/${item.id}`), data);
      } else {
        await push(ref(db, section), data);
      }

      onSaved();
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
      <label>Titulo<input value={form.titulo} onChange={(e) => setField("titulo", e.target.value)} /></label>
      {!isBanner ? <label>Descripcion<textarea value={form.descripcion} onChange={(e) => setField("descripcion", e.target.value)} /></label> : null}
      {isMeditation ? <label>Detalle / sugerencia<textarea value={form.detalle} onChange={(e) => setField("detalle", e.target.value)} /></label> : null}
      {!isBanner && !isMeditation ? <label>{isBook ? "Categoria" : "Etiqueta"}<input value={form.categoria} onChange={(e) => setField("categoria", e.target.value)} /></label> : null}
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
      <FileInput icon={ImageIcon} label="Imagen" file={image} accept="image/jpeg,image/png,image/webp" onChange={setImage} />
      {isMeditation ? <FileInput icon={Upload} label="Audio M4A" file={audioFile} accept="audio/mp4,audio/x-m4a,.m4a" onChange={setAudioFile} /> : null}
      {includePdf ? <FileInput icon={Upload} label="PDF" file={pdf} accept="application/pdf" onChange={setPdf} /> : null}
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
      <PageTitle icon={User} title="Perfil" onBack={onBack} />
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
            <strong>Completa tus datos para solicitar la suscripcion</strong>
            <small>Al guardar se abrira WhatsApp con la solicitud para {subscriptionLabel(pendingSubscription)}.</small>
          </div>
        ) : null}
        <label>Nombre<input value={form.nombre} onChange={(e) => setField("nombre", e.target.value)} /></label>
        <label>Domicilio<input value={form.domicilio} onChange={(e) => setField("domicilio", e.target.value)} /></label>
        <label>Telefono<input value={form.telefono} onChange={(e) => setField("telefono", e.target.value)} /></label>
        <label>Localidad<input value={form.localidad} onChange={(e) => setField("localidad", e.target.value)} /></label>
        <label>Codigo postal<input value={form.codigo_postal} onChange={(e) => setField("codigo_postal", e.target.value)} /></label>
        <label>Fecha nacimiento<input value={form.fecha_nacimiento} onChange={(e) => setField("fecha_nacimiento", e.target.value)} /></label>
        <button className="primary" disabled={busy}>{busy ? "Guardando..." : "Guardar perfil"}</button>
      </form>
    </section>
  );
}

function PageTitle({ icon: Icon, title, onBack }) {
  return (
    <div className="page-title">
      {onBack ? (
        <button className="back-icon" onClick={onBack} aria-label="Volver">
          <ArrowLeft size={22} />
        </button>
      ) : null}
      <Icon size={26} />
      <h1>{title}</h1>
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
  return cleanText(profile?.nombre) || cleanText(profile?.email) || "Completa tu nombre";
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
  return parts.join(", ") || "Sin permisos de suscripcion";
}

function senderName(profile, user, isAdmin) {
  if (isAdmin) return profile?.nombre || "Ashram Ganesha";
  return profile?.nombre || user?.email || "Usuario";
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
      icon: "/Logo Ashram.webp",
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

function groupBy(items, key) {
  return items.reduce((groups, item) => {
    const group = cleanText(item[key]) || "Sin etiqueta";
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
