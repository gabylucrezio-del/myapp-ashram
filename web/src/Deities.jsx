import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Check,
  Copy,
  Download,
  Eye,
  MessageCircle,
  Pencil,
  Plus,
  Printer,
  QrCode,
  Search,
  Share2,
  Sparkles,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { get, ref as dbRef } from "firebase/database";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";
import { db, firestoreDb } from "./firebase";
import { trackEvent } from "./analyticsService";
import { cleanText, uploadOptimizedImage, youtubeEmbedUrl } from "./utils";

const DEITIES_COLLECTION = "deities";
const DEITY_COMMENTS_COLLECTION = "deityComments";
const PUBLIC_ORIGIN = "https://ashramganesha.web.app";
const DEFAULT_DEITY_IMAGE = "/LogoReal.png";
const COMMENT_STATUSES = ["pendiente", "aprobado", "rechazado", "oculto"];

const GANESHA_SAMPLE = {
  id: "ganesha",
  name: "Ganesha",
  slug: "ganesha",
  shortDescription: "Ganesha es la deidad de la sabiduria, los nuevos comienzos y la superacion de los obstaculos.",
  inspirationalPhrase: "Cada obstaculo puede convertirse en una puerta hacia una nueva comprension.",
  mainImageUrl: DEFAULT_DEITY_IMAGE,
  about: "Ganesha abre caminos, cuida los comienzos y recuerda que toda dificultad puede transformarse en aprendizaje.",
  history: "Su imagen une fuerza, dulzura y discernimiento. En la tradicion se lo invoca antes de iniciar una practica, un viaje o una etapa nueva.",
  spiritualTeaching: "La verdadera sabiduria aparece cuando la mente se aquieta y el corazon puede escuchar.",
  mainMantra: "Om Gam Ganapataye Namah",
  mantraMeaning: "Saludo y honro a Ganesha, guia de los nuevos comienzos y removedor de obstaculos.",
  ritual: {
    title: "Ritual simple para honrar a Ganesha",
    introduction: "Una practica breve para abrir caminos con presencia.",
    preparation: "Prepara un espacio limpio y tranquilo.",
    requiredElements: "Imagen de Ganesha, flor, agua, fruta, sahumerio o vela.",
    steps: [
      { id: "paso-1", order: 1, title: "Preparar", description: "Preparar un espacio limpio y tranquilo." },
      { id: "paso-2", order: 2, title: "Colocar", description: "Colocar la imagen de Ganesha." },
      { id: "paso-3", order: 3, title: "Encender", description: "Encender una vela o diya y un sahumerio." },
      { id: "paso-4", order: 4, title: "Respirar", description: "Realizar tres respiraciones conscientes." },
      { id: "paso-5", order: 5, title: "Ofrecer", description: "Ofrecer flores, agua o frutas." },
      { id: "paso-6", order: 6, title: "Mantra", description: "Repetir el mantra 9, 21 o 108 veces." },
      { id: "paso-7", order: 7, title: "Silencio", description: "Permanecer unos minutos en silencio." },
      { id: "paso-8", order: 8, title: "Agradecer", description: "Agradecer y cerrar la practica." },
    ],
    mantra: "Om Gam Ganapataye Namah",
    repetitions: "9, 21 o 108 repeticiones",
    closing: "Agradece y permanece unos instantes en silencio.",
    recommendations: "Realizalo con respeto, sencillez y una intencion clara.",
  },
  offerings: [
    { id: "flores", name: "Flores", description: "Belleza ofrecida desde el corazon.", category: "tradicional", order: 1 },
    { id: "frutas", name: "Frutas", description: "Abundancia y gratitud.", category: "tradicional", order: 2 },
    { id: "durva", name: "Durva", description: "Hierba sagrada asociada a Ganesha.", category: "tradicional", order: 3 },
    { id: "coco", name: "Coco", description: "Entrega del ego y pureza interior.", category: "sugerida", order: 4 },
    { id: "dulces", name: "Dulces", description: "Dulzura para el camino.", category: "sugerida", order: 5 },
    { id: "agua", name: "Agua", description: "Claridad, limpieza y vida.", category: "tradicional", order: 6 },
    { id: "sahumerio", name: "Sahumerio", description: "Aroma para elevar la presencia.", category: "opcional", order: 7 },
    { id: "diya", name: "Diya o vela", description: "Luz para la comprension.", category: "opcional", order: 8 },
  ],
  status: "publicada",
  allowComments: true,
  showRitual: true,
  showOfferings: true,
  showMantra: true,
  showRelatedProducts: true,
  relatedProductIds: [],
  displayOrder: 1,
};

export function DeitiesPage({ user, profile, slug, onOpenDeity, onBackToList, onBack, onToast }) {
  if (slug) {
    return (
      <DeityDetail
        user={user}
        profile={profile}
        slug={slug}
        onBack={onBackToList}
        onToast={onToast}
      />
    );
  }
  return <DeityList onOpenDeity={onOpenDeity} onBack={onBack} />;
}

function DeityList({ onOpenDeity, onBack }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    document.title = "Deidades y Rituales | Ashram Ganesha";
    const q = query(collection(firestoreDb, DEITIES_COLLECTION), where("status", "==", "publicada"), limit(80));
    return onSnapshot(q, (snap) => {
      setItems(snap.docs.map((item) => normalizeDeity({ id: item.id, ...item.data() })).sort(sortDeities));
      setLoading(false);
    }, () => {
      setItems([]);
      setLoading(false);
    });
  }, []);

  const visibleItems = useMemo(() => {
    const term = cleanText(search).toLowerCase();
    if (!term) return items;
    return items.filter((item) => `${item.name} ${item.shortDescription}`.toLowerCase().includes(term));
  }, [items, search]);

  return (
    <section className="content-page deities-page">
      <PageHead icon={Sparkles} title="Deidades y Rituales" subtitle="Historias, simbolos, ofrendas y practicas para acercarte a lo sagrado." onBack={onBack} />
      <label className="deity-search">
        <Search size={18} />
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar deidad" />
      </label>
      {loading ? <div className="deity-skeleton">Cargando deidades...</div> : null}
      {!loading && !visibleItems.length ? <p className="empty-state">No hay deidades publicadas para mostrar.</p> : null}
      <div className="deity-grid">
        {visibleItems.map((deity) => (
          <article className="deity-card" key={deity.id}>
            <DeityImage src={deity.mainImageUrl || DEFAULT_DEITY_IMAGE} alt={deity.name} />
            <div>
              <h2>{deity.name}</h2>
              <p>{summary(deity.shortDescription, 120)}</p>
              <button className="primary" type="button" onClick={() => onOpenDeity(deity.slug)}>
                Conocer mas
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function DeityDetail({ user, profile, slug, onBack, onToast }) {
  const [deity, setDeity] = useState(null);
  const [comments, setComments] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onSnapshot(doc(firestoreDb, DEITIES_COLLECTION, slug), (snap) => {
      const next = snap.exists() && snap.data().status === "publicada" ? normalizeDeity({ id: snap.id, ...snap.data() }) : null;
      setDeity(next);
      setLoading(false);
      if (next) applyDeityMeta(next);
    }, () => setLoading(false));
  }, [slug]);

  useEffect(() => {
    const q = query(collection(firestoreDb, DEITY_COMMENTS_COLLECTION), where("status", "==", "aprobado"), limit(120));
    return onSnapshot(q, (snap) => {
      setComments(snap.docs.map((item) => ({ id: item.id, ...item.data() })).filter((item) => item.deitySlug === slug || item.deityId === slug));
    });
  }, [slug]);

  useEffect(() => {
    get(dbRef(db, "productos")).then((snap) => {
      const value = snap.val() || {};
      setProducts(Object.entries(value).map(([id, item]) => ({ id, ...item })));
    }).catch(() => setProducts([]));
  }, []);

  if (loading) {
    return (
      <section className="content-page deities-page">
        <PageHead icon={Sparkles} title="Deidades y Rituales" subtitle="Cargando..." onBack={onBack} />
      </section>
    );
  }

  if (!deity) {
    return (
      <section className="content-page deities-page">
        <PageHead icon={Sparkles} title="Deidad no encontrada" subtitle="La pagina no existe o todavia no esta publicada." onBack={onBack} />
      </section>
    );
  }

  const embedUrl = youtubeEmbedUrl(deity.videoUrl);
  const relatedProducts = products.filter((product) => deity.relatedProductIds.includes(product.id));

  return (
    <section className="content-page deities-page deity-detail-page">
      <button className="ghost deity-back" type="button" onClick={onBack}><ArrowLeft size={18} /> Deidades y Rituales</button>
      <header className="deity-hero">
        <DeityImage src={deity.mainImageUrl || DEFAULT_DEITY_IMAGE} alt={deity.name} />
        <div>
          <span className="deity-kicker">Ashram Ganesha</span>
          <h1>{deity.name}</h1>
          {deity.inspirationalPhrase ? <blockquote>{deity.inspirationalPhrase}</blockquote> : null}
          <p>{deity.shortDescription}</p>
          <div className="deity-actions">
            <button className="secondary" type="button" onClick={() => shareDeity(deity, onToast)}><Share2 size={17} /> Compartir</button>
            <a className="secondary" href={`https://wa.me/?text=${encodeURIComponent(deityShareText(deity))}`} target="_blank" rel="noreferrer">WhatsApp</a>
          </div>
        </div>
      </header>

      <TextBlock title="Sobre la deidad" text={deity.about} />
      <TextBlock title="Historia" text={deity.history} />
      <TextBlock title="Ensenanza espiritual" text={deity.spiritualTeaching} />

      {deity.showMantra && (deity.mainMantra || deity.mantraMeaning) ? (
        <section className="deity-section mantra-panel">
          <h2>Mantra</h2>
          {deity.mainMantra ? <strong>{deity.mainMantra}</strong> : null}
          {deity.mantraPronunciation ? <p>Pronunciacion: {deity.mantraPronunciation}</p> : null}
          {deity.mantraMeaning ? <p>{deity.mantraMeaning}</p> : null}
        </section>
      ) : null}

      {deity.showRitual ? <RitualView ritual={deity.ritual} /> : null}
      {deity.showOfferings ? <OfferingsView offerings={deity.offerings} /> : null}
      {embedUrl ? (
        <section className="deity-section">
          <h2>Video explicativo</h2>
          <div className="deity-video"><iframe src={embedUrl} title={`Video de ${deity.name}`} allowFullScreen /></div>
        </section>
      ) : null}
      {deity.showRelatedProducts && relatedProducts.length ? <RelatedProducts products={relatedProducts} /> : null}
      {deity.allowComments ? <DeityComments deity={deity} comments={comments} user={user} profile={profile} onToast={onToast} /> : null}
    </section>
  );
}

function DeityComments({ deity, comments, user, profile, onToast }) {
  const [displayName, setDisplayName] = useState(profile?.nombre || user?.displayName || "");
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);

  async function submitComment(event) {
    event.preventDefault();
    const name = sanitizePlain(displayName);
    const text = sanitizePlain(content);
    const lastKey = `ashram_deity_comment_${deity.id}`;
    const lastValue = Number(localStorage.getItem(lastKey) || 0);
    if (Date.now() - lastValue < 45000) return onToast?.("Espera un momento antes de enviar otro comentario.");
    if (name.length < 2) return onToast?.("Completa tu nombre.");
    if (text.length < 8) return onToast?.("El comentario es muy breve.");
    if (text.length > 900) return onToast?.("El comentario es demasiado largo.");
    setBusy(true);
    try {
      await addDoc(collection(firestoreDb, DEITY_COMMENTS_COLLECTION), {
        deityId: deity.id,
        deitySlug: deity.slug,
        displayName: name,
        userId: user?.uid || "",
        content: text,
        status: "pendiente",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      localStorage.setItem(lastKey, String(Date.now()));
      setContent("");
      onToast?.("Comentario enviado. Se publicara cuando sea aprobado.");
    } catch (error) {
      console.error(error);
      onToast?.("No pude enviar el comentario.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="deity-section deity-comments">
      <h2>Comentarios</h2>
      {comments.length ? comments.map((comment) => (
        <article className="deity-comment" key={comment.id}>
          <strong>{comment.displayName || "Visitante"}</strong>
          <small>{formatFirestoreDate(comment.createdAt)}</small>
          <p>{comment.content}</p>
          {comment.adminReply ? <em>Respuesta del Ashram: {comment.adminReply}</em> : null}
        </article>
      )) : <p className="empty-state">Todavia no hay comentarios publicados.</p>}
      <form className="deity-comment-form" onSubmit={submitComment}>
        <label>Nombre<input value={displayName} onChange={(event) => setDisplayName(event.target.value)} maxLength={80} /></label>
        <label>Comentario<textarea value={content} onChange={(event) => setContent(event.target.value)} rows={4} maxLength={900} /></label>
        <button className="primary" type="submit" disabled={busy}>{busy ? "Enviando..." : "Enviar comentario"}</button>
      </form>
    </section>
  );
}

export function DeitiesAdmin({ profile, onToast }) {
  const [items, setItems] = useState([]);
  const [products, setProducts] = useState([]);
  const [editing, setEditing] = useState(null);
  const [filter, setFilter] = useState("todos");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const unsub = onSnapshot(collection(firestoreDb, DEITIES_COLLECTION), (snap) => {
      const nextItems = snap.docs.map((item) => normalizeDeity({ id: item.id, ...item.data() })).sort(sortDeities);
      setItems(nextItems);
      seedGaneshaIfNeeded(nextItems, profile).catch(console.warn);
    });
    get(dbRef(db, "productos")).then((snap) => {
      const value = snap.val() || {};
      setProducts(Object.entries(value).map(([id, item]) => ({ id, ...item })));
    }).catch(() => setProducts([]));
    return unsub;
  }, [profile?.email]);

  const visibleItems = useMemo(() => {
    const term = cleanText(search).toLowerCase();
    return items.filter((item) => {
      if (filter !== "todos" && item.status !== filter) return false;
      if (!term) return true;
      return `${item.name} ${item.slug} ${item.shortDescription}`.toLowerCase().includes(term);
    });
  }, [items, filter, search]);

  async function removeDeity(item) {
    if (!window.confirm(`Borrar "${item.name}"?`)) return;
    await deleteDoc(doc(firestoreDb, DEITIES_COLLECTION, item.id));
    onToast?.("Deidad borrada.");
  }

  if (editing) {
    return (
      <DeityAdminForm
        item={editing}
        products={products}
        profile={profile}
        onCancel={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          onToast?.("Deidad guardada.");
        }}
        onToast={onToast}
      />
    );
  }

  return (
    <div className="deity-admin">
      <div className="admin-list-head">
        <strong>Deidades y Rituales</strong>
        <small>{items.length} deidad{items.length === 1 ? "" : "es"} cargada{items.length === 1 ? "" : "s"}</small>
      </div>
      <div className="deity-admin-toolbar">
        <label><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar" /></label>
        <select value={filter} onChange={(event) => setFilter(event.target.value)}>
          <option value="todos">Todos</option>
          <option value="publicada">Publicadas</option>
          <option value="borrador">Borradores</option>
          <option value="oculta">Ocultas</option>
        </select>
        <button className="primary" type="button" onClick={() => setEditing(createDeityDraft())}><Plus size={17} /> Nueva deidad</button>
      </div>
      <div className="list deity-admin-list">
        {visibleItems.map((item) => (
          <article className="admin-row deity-admin-row" key={item.id}>
            <DeityImage src={item.mainImageUrl || DEFAULT_DEITY_IMAGE} alt="" />
            <span>
              <strong>{item.name}</strong>
              <small>{item.status} - /deidades/{item.slug}</small>
              <em>{summary(item.shortDescription, 120)}</em>
            </span>
            <button className="icon-btn" type="button" title="Editar" onClick={() => setEditing(item)}><Pencil size={17} /></button>
            <button className="icon-btn" type="button" title="Duplicar" onClick={() => setEditing({ ...item, id: "", slug: `${item.slug}-copia`, name: `${item.name} copia`, status: "borrador" })}><Copy size={17} /></button>
            <a className="icon-btn" title="Ver publica" href={deityPublicUrl(item.slug)} target="_blank" rel="noreferrer"><Eye size={17} /></a>
            <QrTools deity={item} onToast={onToast} compact />
            <button className="icon-btn danger" type="button" title="Borrar" onClick={() => removeDeity(item)}><Trash2 size={17} /></button>
          </article>
        ))}
        {!visibleItems.length ? <p className="empty-state">No hay resultados.</p> : null}
      </div>
    </div>
  );
}

function DeityAdminForm({ item, products, profile, onCancel, onSaved, onToast }) {
  const [form, setForm] = useState(() => normalizeDeity(item));
  const [previewUrl, setPreviewUrl] = useState(() => cleanText(item.mainImageUrl || item.imageUrl));
  const [productImageSearch, setProductImageSearch] = useState("");
  const [busy, setBusy] = useState(false);

  function setField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function setRitual(field, value) {
    setForm((current) => ({ ...current, ritual: { ...current.ritual, [field]: value } }));
  }

  function updateRitualStep(index, field, value) {
    setForm((current) => ({
      ...current,
      ritual: {
        ...current.ritual,
        steps: current.ritual.steps.map((step, stepIndex) => stepIndex === index ? { ...step, [field]: value } : step),
      },
    }));
  }

  function addRitualStep() {
    setForm((current) => ({
      ...current,
      ritual: {
        ...current.ritual,
        steps: [...current.ritual.steps, { id: uniqueId("paso"), order: current.ritual.steps.length + 1, title: "", description: "" }],
      },
    }));
  }

  function removeRitualStep(index) {
    setForm((current) => ({
      ...current,
      ritual: { ...current.ritual, steps: current.ritual.steps.filter((_, stepIndex) => stepIndex !== index) },
    }));
  }

  function updateOffering(index, field, value) {
    setForm((current) => ({
      ...current,
      offerings: current.offerings.map((offering, offeringIndex) => offeringIndex === index ? { ...offering, [field]: value } : offering),
    }));
  }

  function addOffering() {
    setForm((current) => ({
      ...current,
      offerings: [...current.offerings, { id: uniqueId("ofrenda"), name: "", description: "", imageUrl: "", category: "sugerida", order: current.offerings.length + 1 }],
    }));
  }

  function removeOffering(index) {
    setForm((current) => ({ ...current, offerings: current.offerings.filter((_, offeringIndex) => offeringIndex !== index) }));
  }

  async function uploadImage(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const localPreview = URL.createObjectURL(file);
    setPreviewUrl(localPreview);
    setBusy(true);
    try {
      const uploaded = await uploadOptimizedImage(file, "deities");
      setForm((current) => ({ ...current, mainImageUrl: uploaded.url, mainImagePath: uploaded.path }));
      setPreviewUrl(uploaded.url);
      onToast?.("Imagen subida.");
    } catch (error) {
      console.error(error);
      onToast?.("No pude subir la imagen.");
    } finally {
      setBusy(false);
    }
  }

  function chooseExistingImage(url) {
    const cleanUrl = cleanText(url);
    if (!cleanUrl) return;
    setForm((current) => ({ ...current, mainImageUrl: cleanUrl, mainImagePath: "" }));
    setPreviewUrl(cleanUrl);
    onToast?.("Imagen de tienda seleccionada.");
  }

  const storeImageOptions = productStoreImageOptions(products, productImageSearch);

  async function save(event) {
    event.preventDefault();
    const name = sanitizePlain(form.name);
    const slug = slugify(form.slug || name);
    if (!name) return onToast?.("Completa el nombre.");
    if (!slug) return onToast?.("Completa el slug.");
    const existing = await getDoc(doc(firestoreDb, DEITIES_COLLECTION, slug));
    if (existing.exists() && existing.id !== item.id) return onToast?.("Ese slug ya existe.");
    const videoEmbed = form.videoUrl ? youtubeEmbedUrl(form.videoUrl) : "";
    if (form.videoUrl && !videoEmbed) return onToast?.("El enlace de YouTube no es valido.");
    const payload = normalizeDeity({ ...form, id: slug, name, slug });
    const nowPayload = {
      ...payload,
      updatedAt: serverTimestamp(),
      updatedBy: profile?.email || "",
      publishedAt: payload.status === "publicada" ? serverTimestamp() : payload.publishedAt || null,
    };
    if (!item.id) {
      nowPayload.createdAt = serverTimestamp();
      nowPayload.createdBy = profile?.email || "";
    }
    await setDoc(doc(firestoreDb, DEITIES_COLLECTION, slug), nowPayload, { merge: true });
    if (item.id && item.id !== slug) await deleteDoc(doc(firestoreDb, DEITIES_COLLECTION, item.id));
    onSaved?.();
  }

  return (
    <form className="admin-form deity-form" onSubmit={save}>
      <div className="deity-form-head">
        <button className="ghost" type="button" onClick={onCancel}><ArrowLeft size={17} /> Volver</button>
        <button className="primary" type="submit" disabled={busy}>Guardar deidad</button>
      </div>
      <section className="deity-form-section">
        <h3>Datos generales</h3>
        <label>Nombre<input value={form.name} onChange={(event) => setField("name", event.target.value)} /></label>
        <label>Slug<input value={form.slug} onChange={(event) => setField("slug", slugify(event.target.value))} /></label>
        <label>Frase inspiradora<input value={form.inspirationalPhrase} onChange={(event) => setField("inspirationalPhrase", event.target.value)} /></label>
        <label>Descripcion breve<textarea rows={3} value={form.shortDescription} onChange={(event) => setField("shortDescription", event.target.value)} /></label>
        <label>Imagen principal
          <span className="deity-upload">
            <Upload size={17} />
            <input type="file" accept="image/*" onChange={uploadImage} />
          </span>
        </label>
        <label>Link de imagen
          <input
            value={form.mainImageUrl}
            onChange={(event) => {
              setField("mainImageUrl", event.target.value);
              setPreviewUrl(event.target.value);
            }}
            placeholder="https://..."
          />
        </label>
        <div className="deity-store-image-picker">
          <div className="deity-array-head">
            <strong>Usar imagen ya cargada en tienda</strong>
            <small>No duplica espacio en Firebase.</small>
          </div>
          <label className="deity-inline-search">Buscar producto
            <input value={productImageSearch} onChange={(event) => setProductImageSearch(event.target.value)} placeholder="Nombre o categoria" />
          </label>
          <div className="deity-store-image-grid">
            {storeImageOptions.map((option) => (
              <button type="button" key={`${option.productId}-${option.url}`} onClick={() => chooseExistingImage(option.url)}>
                <DeityImage src={option.url} alt={option.productName} />
                <span>{option.productName}</span>
                <small>{option.label}</small>
              </button>
            ))}
          </div>
          {!storeImageOptions.length ? <small>No encontre imagenes de productos para mostrar.</small> : null}
        </div>
        <div className="deity-preview-panel">
          <strong>Vista previa de imagen principal</strong>
          <DeityImage className="deity-form-preview" src={previewUrl || form.mainImageUrl || DEFAULT_DEITY_IMAGE} alt={form.name || "Vista previa"} />
          <small>{busy ? "Subiendo imagen..." : previewUrl || form.mainImageUrl ? "Esta es la imagen que se vera en la publicacion." : "Subi una imagen o pega un link para verla aca."}</small>
        </div>
        <label>Sobre la deidad<textarea rows={5} value={form.about} onChange={(event) => setField("about", event.target.value)} /></label>
        <label>Historia<textarea rows={5} value={form.history} onChange={(event) => setField("history", event.target.value)} /></label>
        <label>Ensenanza espiritual<textarea rows={4} value={form.spiritualTeaching} onChange={(event) => setField("spiritualTeaching", event.target.value)} /></label>
        <label>Mantra principal<input value={form.mainMantra} onChange={(event) => setField("mainMantra", event.target.value)} /></label>
        <label>Pronunciacion<input value={form.mantraPronunciation} onChange={(event) => setField("mantraPronunciation", event.target.value)} /></label>
        <label>Significado del mantra<textarea rows={3} value={form.mantraMeaning} onChange={(event) => setField("mantraMeaning", event.target.value)} /></label>
        <label>Color o tema<input value={form.themeColor} onChange={(event) => setField("themeColor", event.target.value)} placeholder="#8a5a2b" /></label>
        <label>Orden<input type="number" value={form.displayOrder} onChange={(event) => setField("displayOrder", event.target.value)} /></label>
        <label>Estado<select value={form.status} onChange={(event) => setField("status", event.target.value)}><option value="borrador">Borrador</option><option value="publicada">Publicada</option><option value="oculta">Oculta</option></select></label>
      </section>
      <section className="deity-form-section">
        <h3>Ritual</h3>
        <label>Titulo<input value={form.ritual.title} onChange={(event) => setRitual("title", event.target.value)} /></label>
        <label>Introduccion<textarea rows={3} value={form.ritual.introduction} onChange={(event) => setRitual("introduction", event.target.value)} /></label>
        <label>Preparacion<textarea rows={3} value={form.ritual.preparation} onChange={(event) => setRitual("preparation", event.target.value)} /></label>
        <label>Elementos necesarios<textarea rows={3} value={form.ritual.requiredElements} onChange={(event) => setRitual("requiredElements", event.target.value)} /></label>
        <div className="deity-array-head"><strong>Pasos</strong><button className="secondary" type="button" onClick={addRitualStep}><Plus size={15} /> Paso</button></div>
        {form.ritual.steps.map((step, index) => (
          <div className="deity-array-row" key={step.id || index}>
            <input value={step.title} onChange={(event) => updateRitualStep(index, "title", event.target.value)} placeholder="Titulo" />
            <textarea value={step.description} onChange={(event) => updateRitualStep(index, "description", event.target.value)} placeholder="Descripcion" />
            <button className="icon-btn danger" type="button" onClick={() => removeRitualStep(index)}><X size={16} /></button>
          </div>
        ))}
        <label>Mantra del ritual<input value={form.ritual.mantra} onChange={(event) => setRitual("mantra", event.target.value)} /></label>
        <label>Repeticiones<input value={form.ritual.repetitions} onChange={(event) => setRitual("repetitions", event.target.value)} /></label>
        <label>Cierre<textarea rows={3} value={form.ritual.closing} onChange={(event) => setRitual("closing", event.target.value)} /></label>
        <label>Recomendaciones<textarea rows={3} value={form.ritual.recommendations} onChange={(event) => setRitual("recommendations", event.target.value)} /></label>
      </section>
      <section className="deity-form-section">
        <h3>Ofrendas</h3>
        <div className="deity-array-head"><strong>Ofrendas</strong><button className="secondary" type="button" onClick={addOffering}><Plus size={15} /> Ofrenda</button></div>
        {form.offerings.map((offering, index) => (
          <div className="deity-array-row deity-offering-edit" key={offering.id || index}>
            <input value={offering.name} onChange={(event) => updateOffering(index, "name", event.target.value)} placeholder="Nombre" />
            <input value={offering.imageUrl} onChange={(event) => updateOffering(index, "imageUrl", event.target.value)} placeholder="Imagen o icono opcional" />
            <select value={offering.category} onChange={(event) => updateOffering(index, "category", event.target.value)}><option value="tradicional">Tradicional</option><option value="sugerida">Sugerida</option><option value="opcional">Opcional</option></select>
            <textarea value={offering.description} onChange={(event) => updateOffering(index, "description", event.target.value)} placeholder="Descripcion" />
            <button className="icon-btn danger" type="button" onClick={() => removeOffering(index)}><X size={16} /></button>
          </div>
        ))}
      </section>
      <section className="deity-form-section">
        <h3>Video y productos</h3>
        <label>Link de YouTube<input value={form.videoUrl} onChange={(event) => setField("videoUrl", event.target.value)} /></label>
        {youtubeEmbedUrl(form.videoUrl) ? <div className="deity-video small"><iframe src={youtubeEmbedUrl(form.videoUrl)} title="Vista previa" allowFullScreen /></div> : null}
        <div className="deity-product-picker">
          {products.map((product) => (
            <label key={product.id}>
              <input
                type="checkbox"
                checked={form.relatedProductIds.includes(product.id)}
                onChange={(event) => {
                  setField("relatedProductIds", event.target.checked
                    ? [...form.relatedProductIds, product.id]
                    : form.relatedProductIds.filter((id) => id !== product.id));
                }}
              />
              {product.nombre || product.titulo || "Producto"}
            </label>
          ))}
        </div>
      </section>
      <section className="deity-form-section">
        <h3>Configuracion</h3>
        <label><input type="checkbox" checked={form.allowComments} onChange={(event) => setField("allowComments", event.target.checked)} /> Permitir comentarios</label>
        <label><input type="checkbox" checked={form.showRitual} onChange={(event) => setField("showRitual", event.target.checked)} /> Mostrar ritual</label>
        <label><input type="checkbox" checked={form.showOfferings} onChange={(event) => setField("showOfferings", event.target.checked)} /> Mostrar ofrendas</label>
        <label><input type="checkbox" checked={form.showMantra} onChange={(event) => setField("showMantra", event.target.checked)} /> Mostrar mantra</label>
        <label><input type="checkbox" checked={form.showRelatedProducts} onChange={(event) => setField("showRelatedProducts", event.target.checked)} /> Mostrar productos relacionados</label>
        {form.slug ? <QrPanel deity={form} onToast={onToast} /> : null}
      </section>
    </form>
  );
}

export function DeityCommentsAdmin({ onToast }) {
  const [comments, setComments] = useState([]);
  const [deities, setDeities] = useState([]);
  const [filter, setFilter] = useState("pendiente");
  const [search, setSearch] = useState("");

  useEffect(() => onSnapshot(collection(firestoreDb, DEITY_COMMENTS_COLLECTION), (snap) => {
    setComments(snap.docs.map((item) => ({ id: item.id, ...item.data() })).sort((a, b) => firestoreMillis(b.createdAt) - firestoreMillis(a.createdAt)));
  }), []);

  useEffect(() => onSnapshot(collection(firestoreDb, DEITIES_COLLECTION), (snap) => {
    setDeities(snap.docs.map((item) => ({ id: item.id, ...item.data() })));
  }), []);

  const deityNames = useMemo(() => Object.fromEntries(deities.map((item) => [item.id, item.name])), [deities]);
  const visibleComments = comments.filter((comment) => {
    if (filter !== "todos" && comment.status !== filter) return false;
    const term = cleanText(search).toLowerCase();
    if (!term) return true;
    return `${comment.displayName} ${comment.content} ${deityNames[comment.deityId] || comment.deitySlug}`.toLowerCase().includes(term);
  });
  const pendingCount = comments.filter((comment) => comment.status === "pendiente").length;

  async function setStatus(comment, status) {
    await setDoc(doc(firestoreDb, DEITY_COMMENTS_COLLECTION, comment.id), { status, updatedAt: serverTimestamp() }, { merge: true });
    onToast?.("Comentario actualizado.");
  }

  async function reply(comment) {
    const text = window.prompt("Respuesta del administrador", comment.adminReply || "");
    if (text === null) return;
    await setDoc(doc(firestoreDb, DEITY_COMMENTS_COLLECTION, comment.id), {
      adminReply: sanitizePlain(text),
      adminReplyDate: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }, { merge: true });
    onToast?.("Respuesta guardada.");
  }

  async function removeComment(comment) {
    if (!window.confirm("Eliminar este comentario?")) return;
    await deleteDoc(doc(firestoreDb, DEITY_COMMENTS_COLLECTION, comment.id));
    onToast?.("Comentario eliminado.");
  }

  return (
    <div className="deity-admin">
      <div className="admin-list-head">
        <strong>Comentarios de Deidades</strong>
        <small>{pendingCount} pendiente{pendingCount === 1 ? "" : "s"}</small>
      </div>
      <div className="deity-admin-toolbar">
        <label><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar comentario" /></label>
        <select value={filter} onChange={(event) => setFilter(event.target.value)}>
          <option value="todos">Todos</option>
          {COMMENT_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
        </select>
      </div>
      <div className="list deity-comments-admin-list">
        {visibleComments.map((comment) => (
          <article className="deity-comment-admin" key={comment.id}>
            <span>
              <strong>{comment.displayName || "Visitante"}</strong>
              <small>{deityNames[comment.deityId] || comment.deitySlug || "Deidad"} - {comment.status} - {formatFirestoreDate(comment.createdAt)}</small>
              <p>{comment.content}</p>
              {comment.adminReply ? <em>Respuesta: {comment.adminReply}</em> : null}
            </span>
            <div className="deity-comment-actions">
              <button className="icon-btn" type="button" title="Aprobar" onClick={() => setStatus(comment, "aprobado")}><Check size={17} /></button>
              <button className="icon-btn" type="button" title="Ocultar" onClick={() => setStatus(comment, "oculto")}><X size={17} /></button>
              <button className="icon-btn" type="button" title="Responder" onClick={() => reply(comment)}><MessageCircle size={17} /></button>
              <button className="icon-btn danger" type="button" title="Eliminar" onClick={() => removeComment(comment)}><Trash2 size={17} /></button>
            </div>
          </article>
        ))}
        {!visibleComments.length ? <p className="empty-state">No hay comentarios para este filtro.</p> : null}
      </div>
    </div>
  );
}

function RitualView({ ritual }) {
  if (!ritual || !Object.values(ritual).some(Boolean)) return null;
  return (
    <section className="deity-section ritual-panel">
      <h2>{ritual.title || "Ritual"}</h2>
      <Text value={ritual.introduction} />
      <Text label="Preparacion" value={ritual.preparation} />
      <Text label="Elementos necesarios" value={ritual.requiredElements} />
      {ritual.steps?.length ? (
        <ol className="ritual-steps">
          {ritual.steps.map((step, index) => (
            <li key={step.id || index}>
              <strong>{step.title || `Paso ${index + 1}`}</strong>
              <p>{step.description}</p>
            </li>
          ))}
        </ol>
      ) : null}
      <Text label="Mantra" value={ritual.mantra} />
      <Text label="Repeticiones" value={ritual.repetitions} />
      <Text label="Cierre" value={ritual.closing} />
      <Text label="Recomendaciones" value={ritual.recommendations} />
    </section>
  );
}

function OfferingsView({ offerings }) {
  if (!offerings?.length) return null;
  return (
    <section className="deity-section">
      <h2>Ofrendas</h2>
      <div className="offering-grid">
        {offerings.sort((a, b) => Number(a.order || 0) - Number(b.order || 0)).map((offering, index) => (
          <article className="offering-card" key={offering.id || index}>
            {offering.imageUrl ? <DeityImage src={offering.imageUrl} alt={offering.name} /> : <Sparkles size={22} />}
            <strong>{offering.name}</strong>
            <small>{offering.category}</small>
            <p>{offering.description}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function RelatedProducts({ products }) {
  return (
    <section className="deity-section">
      <h2>Productos relacionados</h2>
      <div className="related-products">
        {products.map((product) => (
          <a href={`/?producto=${encodeURIComponent(product.id)}#tienda`} key={product.id}>
            <DeityImage src={product.imagen || product.portada_url || DEFAULT_DEITY_IMAGE} alt={product.nombre || product.titulo || "Producto"} />
            <span>{product.nombre || product.titulo || "Producto"}</span>
          </a>
        ))}
      </div>
    </section>
  );
}

function TextBlock({ title, text }) {
  if (!cleanText(text)) return null;
  return (
    <section className="deity-section">
      <h2>{title}</h2>
      <Text value={text} />
    </section>
  );
}

function Text({ label, value }) {
  const text = sanitizePlain(value);
  if (!text) return null;
  return label ? <p><strong>{label}: </strong>{text}</p> : <p>{text}</p>;
}

function PageHead({ icon: Icon, title, subtitle, onBack }) {
  return (
    <div className="page-title">
      {onBack ? <button className="back-icon" onClick={onBack} aria-label="Volver"><ArrowLeft size={22} /></button> : null}
      <Icon size={26} />
      <span>
        <h1>{title}</h1>
        {subtitle ? <small>{subtitle}</small> : null}
      </span>
    </div>
  );
}

function DeityImage({ src, alt, className = "" }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  if (!src || failed) {
    return (
      <div className={`deity-image-fallback ${className}`} role="img" aria-label={alt || "Sin imagen"}>
        <Sparkles size={24} />
        <span>Sin imagen</span>
      </div>
    );
  }
  return <img className={className} src={src} alt={alt} loading="lazy" onError={() => setFailed(true)} />;
}

function QrTools({ deity, onToast }) {
  return (
    <button className="icon-btn" type="button" title="Copiar QR" onClick={() => copyText(deityPublicUrl(deity.slug), onToast)}>
      <QrCode size={17} />
    </button>
  );
}

function QrPanel({ deity, onToast }) {
  const url = deityPublicUrl(deity.slug);
  return (
    <div className="qr-panel">
      <img src={qrImageUrl(url, 220, "png")} alt={`QR ${deity.name}`} />
      <span>
        <strong>QR publico</strong>
        <small>{url}</small>
      </span>
      <button className="secondary" type="button" onClick={() => copyText(url, onToast)}><Copy size={16} /> Copiar enlace</button>
      <a className="secondary" href={qrImageUrl(url, 720, "png")} download={`${deity.slug}-qr.png`}><Download size={16} /> PNG</a>
      <a className="secondary" href={qrImageUrl(url, 720, "svg")} download={`${deity.slug}-qr.svg`}><Download size={16} /> SVG</a>
      <button className="secondary" type="button" onClick={() => printQrCard(deity)}><Printer size={16} /> Imprimir tarjeta</button>
    </div>
  );
}

function normalizeDeity(value = {}) {
  const ritual = value.ritual && typeof value.ritual === "object" ? value.ritual : {};
  return {
    id: cleanText(value.id || value.slug),
    name: cleanText(value.name),
    slug: slugify(value.slug || value.id || value.name),
    shortDescription: sanitizePlain(value.shortDescription),
    inspirationalPhrase: sanitizePlain(value.inspirationalPhrase),
    mainImageUrl: cleanText(value.mainImageUrl || value.imageUrl),
    mainImagePath: cleanText(value.mainImagePath || value.imagePath),
    about: sanitizePlain(value.about),
    history: sanitizePlain(value.history),
    spiritualTeaching: sanitizePlain(value.spiritualTeaching),
    mainMantra: sanitizePlain(value.mainMantra),
    mantraPronunciation: sanitizePlain(value.mantraPronunciation),
    mantraMeaning: sanitizePlain(value.mantraMeaning),
    videoUrl: cleanText(value.videoUrl),
    themeColor: cleanText(value.themeColor),
    displayOrder: Number(value.displayOrder || 0),
    status: ["borrador", "publicada", "oculta"].includes(value.status) ? value.status : "borrador",
    allowComments: value.allowComments !== false,
    showRitual: value.showRitual !== false,
    showOfferings: value.showOfferings !== false,
    showMantra: value.showMantra !== false,
    showRelatedProducts: value.showRelatedProducts !== false,
    relatedProductIds: Array.isArray(value.relatedProductIds) ? value.relatedProductIds.map(cleanText).filter(Boolean) : [],
    ritual: {
      title: sanitizePlain(ritual.title),
      introduction: sanitizePlain(ritual.introduction),
      preparation: sanitizePlain(ritual.preparation),
      requiredElements: sanitizePlain(ritual.requiredElements),
      steps: Array.isArray(ritual.steps) ? ritual.steps.map((step, index) => ({
        id: cleanText(step.id) || uniqueId("paso"),
        order: Number(step.order || index + 1),
        title: sanitizePlain(step.title),
        description: sanitizePlain(step.description),
      })).filter((step) => step.title || step.description) : [],
      mantra: sanitizePlain(ritual.mantra),
      repetitions: sanitizePlain(ritual.repetitions),
      closing: sanitizePlain(ritual.closing),
      recommendations: sanitizePlain(ritual.recommendations),
    },
    offerings: Array.isArray(value.offerings) ? value.offerings.map((offering, index) => ({
      id: cleanText(offering.id) || uniqueId("ofrenda"),
      name: sanitizePlain(offering.name),
      description: sanitizePlain(offering.description),
      imageUrl: cleanText(offering.imageUrl),
      category: ["tradicional", "sugerida", "opcional"].includes(offering.category) ? offering.category : "sugerida",
      order: Number(offering.order || index + 1),
    })).filter((offering) => offering.name || offering.description) : [],
    createdAt: value.createdAt || null,
    updatedAt: value.updatedAt || null,
    publishedAt: value.publishedAt || null,
    createdBy: cleanText(value.createdBy),
    updatedBy: cleanText(value.updatedBy),
  };
}

function createDeityDraft() {
  return normalizeDeity({
    id: "",
    slug: "",
    status: "borrador",
    allowComments: true,
    showRitual: true,
    showOfferings: true,
    showMantra: true,
    showRelatedProducts: true,
    ritual: { steps: [] },
    offerings: [],
  });
}

async function seedGaneshaIfNeeded(items, profile) {
  if (items.some((item) => item.id === "ganesha")) return;
  const ref = doc(firestoreDb, DEITIES_COLLECTION, "ganesha");
  const snap = await getDoc(ref);
  if (snap.exists()) return;
  await setDoc(ref, {
    ...GANESHA_SAMPLE,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    createdBy: profile?.email || "admin",
    updatedBy: profile?.email || "admin",
  }, { merge: true });
}

function sortDeities(a, b) {
  return Number(a.displayOrder || 0) - Number(b.displayOrder || 0) || a.name.localeCompare(b.name, "es");
}

function productStoreImageOptions(products = [], search = "") {
  const term = cleanText(search).toLowerCase();
  return products
    .filter((product) => {
      if (!term) return true;
      return `${product.nombre || ""} ${product.titulo || ""} ${product.categoria || ""}`.toLowerCase().includes(term);
    })
    .flatMap((product) => {
      const images = productImages(product).slice(0, 2);
      const productName = cleanText(product.nombre || product.titulo) || "Producto";
      return images.map((url, index) => ({
        productId: product.id,
        productName,
        url,
        label: index === 0 ? "Imagen de catalogo" : "Imagen de detalle",
      }));
    })
    .filter((item, index, list) => item.url && list.findIndex((other) => other.url === item.url) === index)
    .slice(0, 24);
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
    product.imagen_detalle,
    product.detalle_imagen,
    product.imagen_detalle_url,
    ...splitStoreImages(product.imagenes),
    ...splitStoreImages(product.galeria),
  ]
    .map(cleanText)
    .filter(Boolean);
  return [...new Set(images)];
}

function sanitizePlain(value, max = 5000) {
  return cleanText(value)
    .replace(/<[^>]*>/g, "")
    .replace(/[{}[\]<>]/g, "")
    .slice(0, max)
    .trim();
}

function slugify(value) {
  return cleanText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function uniqueId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function summary(value, limit = 120) {
  const text = sanitizePlain(value);
  return text.length <= limit ? text : `${text.slice(0, limit).trim()}...`;
}

function deityPublicUrl(slug) {
  const isLocal = ["localhost", "127.0.0.1"].includes(window.location.hostname);
  const origin = isLocal ? PUBLIC_ORIGIN : window.location.origin || PUBLIC_ORIGIN;
  return `${origin}/deidades/${encodeURIComponent(slug)}`;
}

function deityShareText(deity) {
  return [
    `Conoce a ${deity.name} en Ashram Ganesha:`,
    deity.shortDescription,
    deityPublicUrl(deity.slug),
  ].filter(Boolean).join("\n");
}

async function shareDeity(deity, onToast) {
  const url = deityPublicUrl(deity.slug);
  const text = deityShareText(deity);
  try {
    if (navigator.share) {
      await navigator.share({ title: deity.name, text, url });
      trackEvent("deity_shared", { contentId: deity.id, contentTitle: deity.name, contentType: "deity", shareMethod: "native" });
      return;
    }
  } catch {
    // Fallback to clipboard.
  }
  await copyText(`${text}\n${url}`, onToast);
  trackEvent("deity_shared", { contentId: deity.id, contentTitle: deity.name, contentType: "deity", shareMethod: "clipboard" });
}

async function copyText(text, onToast) {
  try {
    await navigator.clipboard.writeText(text);
    onToast?.("Enlace copiado.");
  } catch {
    onToast?.("No pude copiar el enlace.");
  }
}

function qrImageUrl(url, size = 420, format = "png") {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&format=${format}&data=${encodeURIComponent(url)}`;
}

function printQrCard(deity) {
  const url = deityPublicUrl(deity.slug);
  const win = window.open("", "_blank", "width=420,height=700");
  if (!win) return;
  win.document.write(`
    <html><head><title>${deity.name} - QR</title><style>
      body{font-family:Arial,sans-serif;background:#f8efe0;color:#4b2f21;display:grid;place-items:center;min-height:100vh;margin:0}
      .card{width:5cm;min-height:10cm;border-radius:18px;background:#fff8eb;border:1px solid #d8b46a;padding:16px;text-align:center;box-shadow:0 12px 30px rgba(75,47,33,.18)}
      img{width:150px;height:150px;margin:10px auto;display:block} h1{font-size:22px;margin:8px 0} p{font-size:12px;line-height:1.4}
    </style></head><body><div class="card"><h1>${sanitizePlain(deity.name)}</h1><p>${sanitizePlain(deity.inspirationalPhrase || deity.shortDescription)}</p><img src="${qrImageUrl(url, 300, "png")}" alt="QR"><p>Conoce su historia, significado, ofrendas y ritual.</p><strong>Ashram Ganesha</strong><p>${PUBLIC_ORIGIN}</p></div><script>window.onload=()=>window.print()</script></body></html>
  `);
  win.document.close();
}

function applyDeityMeta(deity) {
  document.title = `${deity.name} | Deidades y Rituales | Ashram Ganesha`;
  setMeta("description", deity.shortDescription);
  setMeta("og:title", `${deity.name} | Ashram Ganesha`, true);
  setMeta("og:description", deity.shortDescription, true);
  setMeta("og:image", deity.mainImageUrl || `${PUBLIC_ORIGIN}/LogoReal.png`, true);
  setCanonical(deityPublicUrl(deity.slug));
}

function setMeta(name, content, property = false) {
  if (!content) return;
  const selector = property ? `meta[property="${name}"]` : `meta[name="${name}"]`;
  let node = document.querySelector(selector);
  if (!node) {
    node = document.createElement("meta");
    node.setAttribute(property ? "property" : "name", name);
    document.head.appendChild(node);
  }
  node.setAttribute("content", content);
}

function setCanonical(url) {
  let node = document.querySelector('link[rel="canonical"]');
  if (!node) {
    node = document.createElement("link");
    node.setAttribute("rel", "canonical");
    document.head.appendChild(node);
  }
  node.setAttribute("href", url);
}

function firestoreDate(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate();
  if (value.seconds) return new Date(value.seconds * 1000);
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function firestoreMillis(value) {
  return firestoreDate(value)?.getTime() || 0;
}

function formatFirestoreDate(value) {
  const date = firestoreDate(value);
  if (!date) return "sin fecha";
  return date.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
}
