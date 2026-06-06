const MIN_CHUNK_LENGTH = 500;
const MAX_CHUNK_LENGTH = 1000;

const STOPWORDS = new Set([
  "a", "al", "algo", "ante", "asi", "aun", "cada", "como", "con", "contra", "cual", "cuando",
  "de", "del", "desde", "donde", "dos", "el", "ella", "en", "entre", "era", "es", "esa", "ese",
  "esta", "este", "esto", "hay", "la", "las", "le", "lo", "los", "mas", "me", "mi", "muy", "no",
  "nos", "o", "para", "pero", "por", "que", "se", "si", "sin", "su", "sus", "te", "tu", "un",
  "una", "y", "ya", "hacer", "hago", "quiero", "puedo", "puede", "porque", "siento", "saber",
  "sobre",
]);

function normalizeText(value = "") {
  return String(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function keywordsFrom(value = "") {
  return normalizeText(value)
    .split(/\s+/)
    .filter((term) => term.length > 2 && !STOPWORDS.has(term));
}

function stripMarkdown(value = "") {
  return String(value)
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)]\([^)]*\)/g, "$1")
    .replace(/[#>*_`~-]/g, " ")
    .replace(/\|/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function textFromItem(item = {}) {
  const chapterText = Array.isArray(item.epub_chapters)
    ? item.epub_chapters.map((chapter) => `${chapter.title || ""}. ${chapter.content || ""}`).join("\n")
    : "";
  const keywords = Array.isArray(item.keywords || item.keywordList || item.tags)
    ? (item.keywords || item.keywordList || item.tags).join(", ")
    : item.keywords || item.palabras_clave || item.palabrasClave || "";

  return stripMarkdown([
    item.titulo,
    item.tema,
    item.nombre,
    item.title,
    item.originalQuestion,
    item.question,
    item.topic,
    item.mainTopic,
    item.categoria,
    item.etiqueta,
    item.category,
    keywords,
    item.descripcion,
    item.detalle,
    item.summary,
    item.description,
    item.answer,
    item.taughtAnswer,
    item.phrase,
    item.contenidoMarkdown,
    item.content,
    item.texto,
    chapterText,
  ].filter(Boolean).join("\n"));
}

function chunkText(text = "") {
  const clean = stripMarkdown(text);
  if (!clean) return [];
  if (clean.length <= MAX_CHUNK_LENGTH) return [clean];

  const sentences = clean.split(/(?<=[.!?])\s+/).filter(Boolean);
  const chunks = [];
  let current = "";

  sentences.forEach((sentence) => {
    const next = current ? `${current} ${sentence}` : sentence;
    if (next.length > MAX_CHUNK_LENGTH && current.length >= MIN_CHUNK_LENGTH) {
      chunks.push(current.trim());
      current = sentence;
    } else if (next.length > MAX_CHUNK_LENGTH) {
      chunks.push(next.slice(0, MAX_CHUNK_LENGTH).trim());
      current = next.slice(MAX_CHUNK_LENGTH).trim();
    } else {
      current = next;
    }
  });

  if (current.trim()) {
    if (chunks.length && current.length < MIN_CHUNK_LENGTH) {
      chunks[chunks.length - 1] = `${chunks[chunks.length - 1]} ${current}`.slice(0, MAX_CHUNK_LENGTH).trim();
    } else {
      chunks.push(current.trim());
    }
  }

  return chunks;
}

function scoreText(query = "", text = "") {
  const terms = keywordsFrom(query);
  if (!terms.length) return 0;
  const haystack = normalizeText(text);
  const uniqueTerms = [...new Set(terms)];
  const hits = uniqueTerms.reduce((total, term) => total + (haystack.includes(term) ? 1 : 0), 0);
  const density = hits / uniqueTerms.length;
  const exactBonus = haystack.includes(normalizeText(query)) ? 0.35 : 0;
  return density + exactBonus;
}

function similarityPercent(query = "", text = "") {
  const uniqueTerms = [...new Set(keywordsFrom(query))];
  if (!uniqueTerms.length) return 0;

  const haystack = normalizeText(text);
  if (!haystack) return 0;

  const hits = uniqueTerms.reduce((total, term) => total + (haystack.includes(term) ? 1 : 0), 0);
  return Math.round((hits / uniqueTerms.length) * 100);
}

module.exports = {
  chunkText,
  keywordsFrom,
  normalizeText,
  scoreText,
  similarityPercent,
  textFromItem,
};
