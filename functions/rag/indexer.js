const admin = require("firebase-admin");
const { chunkText, textFromItem } = require("./text");

const FRAGMENTS_PATH = "ganeshaRagFragments";

const SOURCE_CONFIGS = [
  { path: "biblioteca", type: "Biblioteca", fallbackCategory: "Libro", link: "biblioteca" },
  { path: "conocimiento", type: "Curso", fallbackCategory: "Conocimiento", link: "conocimiento" },
  { path: "meditaciones", type: "Meditacion", fallbackCategory: "Practica", link: "meditaciones" },
  { path: "blog", type: "Articulo", fallbackCategory: "Blog", link: "blog" },
  { path: "satsang", type: "Satsang", fallbackCategory: "Encuentro", link: "satsang" },
  { path: "ejercicios", type: "Ejercicio", fallbackCategory: "Practica", link: "ejercicios" },
  { path: "publishedContent", type: "Publicacion", fallbackCategory: "Contenido", link: "" },
  { path: "privateNotes", type: "Nota interna", fallbackCategory: "Cuaderno", link: "cuaderno" },
  { path: "bookProjects", type: "Libro interno", fallbackCategory: "Editor de libros", link: "admin" },
  { path: "ganeshaKnowledge", type: "Enseñanza de Gabriel Premananda", fallbackCategory: "Ganesha Guia", link: "" },
  { path: "ganeshaGuiaKnowledge", type: "Base manual", fallbackCategory: "Ganesha Guia", link: "" },
];

function configByPath(path) {
  return SOURCE_CONFIGS.find((config) => config.path === path);
}

function titleFromItem(item = {}) {
  return item.titulo || item.tema || item.nombre || item.title || item.topic || item.pregunta || "Sin titulo";
}

function categoryFromItem(item = {}, config = {}) {
  return item.categoria || item.etiqueta || item.category || config.fallbackCategory || "Ashram";
}

function isActive(item = {}) {
  return item.active !== false && item.activo !== false && item.status !== "archived";
}

function buildFragments(sourcePath, itemId, item = {}) {
  const config = configByPath(sourcePath);
  if (!config || !item || !isActive(item)) return [];
  const fullText = textFromItem(item);
  return chunkText(fullText).map((text, index) => ({
    id: `${sourcePath}_${itemId}_${index}`,
    contentId: itemId,
    title: titleFromItem(item),
    type: item.type || config.type,
    category: categoryFromItem(item, config),
    source: sourcePath,
    text,
    link: config.link,
    chunkIndex: index,
    updatedAt: new Date().toISOString(),
  }));
}

async function indexContent(sourcePath, itemId, item) {
  const db = admin.database();
  const targetRef = db.ref(`${FRAGMENTS_PATH}/${sourcePath}/${itemId}`);
  if (!item || !isActive(item)) {
    await targetRef.remove();
    return 0;
  }
  const fragments = buildFragments(sourcePath, itemId, item);
  if (!fragments.length) {
    await targetRef.remove();
    return 0;
  }
  await targetRef.set(Object.fromEntries(fragments.map((fragment) => [fragment.chunkIndex, fragment])));
  return fragments.length;
}

async function removeIndexedContent(sourcePath, itemId) {
  await admin.database().ref(`${FRAGMENTS_PATH}/${sourcePath}/${itemId}`).remove();
}

async function loadAllFragments() {
  const snap = await admin.database().ref(FRAGMENTS_PATH).once("value");
  const value = snap.val() || {};
  return Object.values(value)
    .flatMap((sourceGroup) => Object.values(sourceGroup || {}))
    .flatMap((itemGroup) => Object.values(itemGroup || {}))
    .filter((fragment) => fragment && fragment.text);
}

async function rebuildAllFragments() {
  const db = admin.database();
  const groups = await Promise.all(SOURCE_CONFIGS.map(async (config) => {
    const snap = await db.ref(config.path).once("value");
    const value = snap.val() || {};
    return Object.entries(value).flatMap(([id, item]) => buildFragments(config.path, id, item));
  }));
  const fragments = groups.flat();
  const next = {};
  fragments.forEach((fragment) => {
    if (!next[fragment.source]) next[fragment.source] = {};
    if (!next[fragment.source][fragment.contentId]) next[fragment.source][fragment.contentId] = {};
    next[fragment.source][fragment.contentId][fragment.chunkIndex] = fragment;
  });
  await db.ref(FRAGMENTS_PATH).set(next);
  return fragments.length;
}

module.exports = {
  FRAGMENTS_PATH,
  SOURCE_CONFIGS,
  indexContent,
  loadAllFragments,
  rebuildAllFragments,
  removeIndexedContent,
};
