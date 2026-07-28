const admin = require("firebase-admin");
const {setGlobalOptions} = require("firebase-functions");
const {defineSecret} = require("firebase-functions/params");
const {onRequest} = require("firebase-functions/https");
const {onDocumentCreated} = require("firebase-functions/v2/firestore");
const {onValueCreated} = require("firebase-functions/v2/database");
const {onSchedule} = require("firebase-functions/v2/scheduler");
const logger = require("firebase-functions/logger");

admin.initializeApp({
  credential: admin.credential.applicationDefault(),
  databaseURL: process.env.FIREBASE_DATABASE_URL ||
    "https://ashramganesha-default-rtdb.firebaseio.com",
});
setGlobalOptions({maxInstances: 10});

const GEMINI_API_KEY = defineSecret("GEMINI_API_KEY");
const GEMINI_MODEL = "gemini-2.5-flash";
const KNOWLEDGE_PATH = "ganeshaKnowledge";
const ASHRAM_DOCUMENTS_PATH = "ashramDocuments";
const ASHRAM_FOLDERS_PATH = "ashramFolders";
const ADMIN_EMAILS = new Set([
  "gabriel@ashramganesha.com",
  "ayurvedaunaformadevida@gmail.com",
]);
const MIN_MATCH_SCORE = 60;
const CONTENT_MATCH_SCORE = 35;
const MAX_REALTIME_ITEMS = 250;
const MAX_FIRESTORE_ITEMS = 150;
const DATABASE_READ_TIMEOUT_MS = 3500;
const UNKNOWN_MESSAGE =
  "No tengo suficiente conocimiento dentro del Ashram para responder " +
  "esta pregunta todavia.";
const ADMIN_UNKNOWN_MESSAGE =
  "No tengo suficiente conocimiento dentro del Ashram. Quieres ensenarme?";

const REALTIME_CONTENT_SOURCES = [
  {path: "posts", type: "Post", category: "Posts", link: ""},
  {path: "cursos", type: "Curso", category: "Cursos", link: "conocimiento"},
  {path: "modulos", type: "Modulo", category: "Modulos", link: "conocimiento"},
  {path: "clases", type: "Clase", category: "Clases", link: "conocimiento"},
  {
    path: "meditaciones",
    type: "Meditacion",
    category: "Practica",
    link: "meditaciones",
  },
  {
    path: "biblioteca",
    type: "Biblioteca",
    category: "Biblioteca",
    link: "biblioteca",
  },
  {path: "libros", type: "Libro", category: "Libros", link: "biblioteca"},
  {path: "archivosMarkdown", type: "Markdown", category: "Markdown", link: ""},
  {path: "markdown", type: "Markdown", category: "Markdown", link: ""},
  {
    path: "conocimiento",
    type: "Curso",
    category: "Conocimiento",
    link: "conocimiento",
  },
  {path: "blog", type: "Articulo", category: "Blog", link: "blog"},
  {path: "articulos", type: "Articulo", category: "Articulos", link: "blog"},
  {path: "satsang", type: "Satsang", category: "Encuentro", link: "satsang"},
  {
    path: "ejercicios",
    type: "Ejercicio",
    category: "Practica",
    link: "ejercicios",
  },
  {
    path: "publishedContent",
    type: "Publicacion",
    category: "Contenido",
    link: "",
  },
  {
    path: "bookProjects",
    type: "Libro interno",
    category: "Editor",
    link: "admin",
  },
  {
    path: "privateNotes",
    type: "Nota interna",
    category: "Cuaderno",
    link: "cuaderno",
  },
];

const FIRESTORE_CONTENT_COLLECTIONS = [
  "ganeshaIndexedContent",
  "ashramIndexedContent",
  "indexedContent",
  "posts",
  "cursos",
  "modulos",
  "clases",
  "meditaciones",
  "biblioteca",
  "libros",
  "archivosMarkdown",
  "markdown",
  "conocimiento",
  "blog",
  "articulos",
  "publishedContent",
  "bibliotecaRecursos",
  "pdfIndex",
  "epubIndex",
  "documents",
  "notas",
];

const INTERNAL_SOURCE_PATHS = new Set([
  ASHRAM_DOCUMENTS_PATH,
  "ganeshaKnowledge",
  "ganeshaGuiaKnowledge",
  "privateNotes",
  "bookProjects",
  "markdown",
  "archivosMarkdown",
  "documents",
  "notas",
]);

const NAVIGABLE_SOURCE_PATHS = new Set([
  "posts",
  "cursos",
  "modulos",
  "clases",
  "meditaciones",
  "biblioteca",
  "libros",
  "conocimiento",
  "blog",
  "articulos",
  "publishedContent",
  "ganeshaIndexedContent",
  "ashramIndexedContent",
  "indexedContent",
  "bibliotecaRecursos",
  "pdfIndex",
  "epubIndex",
]);

const INTERNAL_SOURCE_NOTE =
  "Basado en estudios y apuntes de Gabriel Premananda.";

const STOPWORDS = new Set([
  "a", "al", "algo", "ante", "asi", "aun", "cada", "como", "con",
  "contra", "cual", "cuando", "de", "del", "desde", "donde", "el",
  "ella", "en", "entre", "era", "es", "esa", "ese", "esta", "este",
  "esto", "hay", "la", "las", "le", "lo", "los", "mas", "me", "mi",
  "muy", "no", "nos", "o", "para", "pero", "por", "porque", "que",
  "se", "si", "sin", "su", "sus", "te", "tu", "un", "una", "y",
  "ya", "hacer", "hago", "quiero", "puedo", "puede", "siento",
  "saber", "sobre",
]);

exports.ganeshaChat = onRequest({
  secrets: [GEMINI_API_KEY],
  timeoutSeconds: 60,
  memory: "512MiB",
  invoker: "public",
  serviceAccount: "ashramganesha@appspot.gserviceaccount.com",
}, async (req, res) => {
  setCorsHeaders(res);
  console.log("ganeshaChat function ejecutada");
  let geminiCalled = false;

  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json(formatResponse("Método no permitido.", [], false));
    return;
  }

  try {
    const question = String(req.body?.question || "").trim();
    const userName = String(req.body?.userName || "querido caminante").trim();
    const isAdmin = Boolean(req.body?.isAdmin);
    console.log("Pregunta recibida:", question);

    if (!question) {
      console.log("Conocimientos encontrados:", 0);
      console.log("Gemini fue llamado:", false);
      res.status(400).json(formatResponse(
          "Necesito una pregunta para poder ayudarte.",
          [],
          false,
      ));
      return;
    }

    console.log("Buscando en ashramDocuments");
    const ashramDocumentMatches = await searchAshramDocuments(question);
    console.log("Resultados encontrados:", ashramDocumentMatches.length);

    console.log("Buscando en ganeshaKnowledge");
    const knowledgeMatches = await searchGaneshaKnowledge(question);
    console.log("Resultados encontrados:", knowledgeMatches.length);

    console.log("Buscando en contenido del Ashram");
    const contentMatches = await searchAshramContent(question);

    const matches = [
      ...ashramDocumentMatches,
      ...knowledgeMatches,
      ...contentMatches,
    ]
        .sort((a, b) => b.matchScore - a.matchScore)
        .slice(0, 8);

    console.log("Conocimientos encontrados:", matches.length);

    if (!matches.length) {
      console.log("Gemini fue llamado:", false);
      res.json(unknownResponse(isAdmin));
      return;
    }

    geminiCalled = true;
    console.log("Gemini fue llamado:", true);
    const answer = await askGemini({
      apiKey: GEMINI_API_KEY.value(),
      question,
      userName,
      context: buildContext(matches),
    });

    const cleanAnswer = cleanText(answer);
    if (!cleanAnswer || containsUnknownAnswer(cleanAnswer)) {
      res.json(unknownResponse(isAdmin));
      return;
    }

    const sources = uniqueSources(matches.map(sourceFromMatch));
    res.json(formatResponse(cleanAnswer, sources, true));
  } catch (error) {
    logger.error("ganeshaChat error", error);
    console.log("Gemini fue llamado:", geminiCalled);
    res.status(500).json(unknownResponse(Boolean(req.body?.isAdmin)));
  }
});

exports.englishTeacher = onRequest({
  secrets: [GEMINI_API_KEY],
  timeoutSeconds: 60,
  memory: "512MiB",
  invoker: "public",
  serviceAccount: "ashramganesha@appspot.gserviceaccount.com",
}, async (req, res) => {
  setCorsHeaders(res);
  console.log("englishTeacher function ejecutada");

  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({error: "Metodo no permitido."});
    return;
  }

  try {
    const lessonContext = {
      practiceType: cleanText(req.body?.practiceType || "speaking"),
      currentPhrase: cleanText(req.body?.currentPhrase || ""),
      pronunciation: cleanText(req.body?.pronunciation || ""),
      translation: cleanText(req.body?.translation || ""),
      userSpeech: cleanText(req.body?.userSpeech || ""),
      selectedAnswer: cleanText(req.body?.selectedAnswer || ""),
      correctAnswer: cleanText(req.body?.correctAnswer || ""),
      userAnswer: cleanText(req.body?.userAnswer || ""),
      missingWord: cleanText(req.body?.missingWord || ""),
      lessonId: cleanText(req.body?.lessonId || ""),
      validAnswers: Array.isArray(req.body?.validAnswers) ?
        req.body.validAnswers.map((item) => cleanText(item)) :
        [],
      conversationHistory: Array.isArray(req.body?.conversationHistory) ?
        req.body.conversationHistory.slice(-8) :
        [],
    };
    const lessonState = sanitizeEnglishLessonState(req.body?.lessonState);
    const userProgress = sanitizeEnglishUserProgress(req.body?.userProgress);
    const userName = cleanText(req.body?.userName || "estudiante");
    const question = cleanText(
        req.body?.message || req.body?.question || "Corrige mi practica.",
    );

    console.log("English Teacher practiceType:", lessonContext.practiceType);
    if (lessonContext.practiceType === "generate_practice") {
      const generated = await askGeminiEnglishLessonGenerator({
        apiKey: GEMINI_API_KEY.value(),
        userName,
        level: cleanText(req.body?.level || "basico"),
        topic: cleanText(req.body?.topic || "conversacion"),
      });
      res.json(generated);
      return;
    }

    if (lessonContext.practiceType === "chat") {
      const chatResult = await askGeminiEnglishTeacherChat({
        apiKey: GEMINI_API_KEY.value(),
        message: question,
        userName,
        currentTopic: cleanText(req.body?.currentTopic || ""),
        lessonState,
        userProgress,
      });
      res.json(chatResult);
      return;
    }

    const result = await askGeminiEnglishTeacher({
      apiKey: GEMINI_API_KEY.value(),
      question,
      userName,
      lessonContext,
    });
    res.json(result);
  } catch (error) {
    logger.error("englishTeacher error", error);
    res.status(500).json({
      answer: "No pude corregir la practica en este momento.",
      correct: false,
      score: 0,
      correctPhrase: cleanText(req.body?.currentPhrase || ""),
      userPhrase: cleanText(req.body?.userSpeech || req.body?.userAnswer || ""),
      correction: "Intenta nuevamente en unos instantes.",
      pronunciation: cleanText(req.body?.pronunciation || ""),
      translation: cleanText(req.body?.translation || ""),
      nextAction: "repeat",
    });
  }
});

exports.ganeshaTransformDocument = onRequest({
  secrets: [GEMINI_API_KEY],
  timeoutSeconds: 60,
  memory: "512MiB",
  invoker: "public",
  serviceAccount: "ashramganesha@appspot.gserviceaccount.com",
}, async (req, res) => {
  setCorsHeaders(res);

  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({error: "Metodo no permitido."});
    return;
  }

  try {
    await verifyAdminRequest(req);
    const action = cleanText(req.body?.action || "summary");
    const title = cleanText(req.body?.title || "Documento del Ashram");
    const content = cleanText(req.body?.content || "");
    if (!content) {
      res.status(400).json({error: "Falta contenido para transformar."});
      return;
    }

    const result = await askGeminiTransform({
      apiKey: GEMINI_API_KEY.value(),
      action,
      title,
      content: limitText(content, 12000),
    });
    res.json(result);
  } catch (error) {
    logger.error("ganeshaTransformDocument error", error);
    res.status(error.status || 500).json({
      error: error.message || "No se pudo transformar el documento.",
      code: error.code || "",
    });
  }
});

exports.libraryDiagnostics = onRequest({
  timeoutSeconds: 30,
  memory: "256MiB",
  invoker: "public",
  serviceAccount: "ashramganesha@appspot.gserviceaccount.com",
}, async (req, res) => {
  setCorsHeaders(res);

  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }

  if (req.method !== "GET") {
    res.status(405).json({error: "Metodo no permitido."});
    return;
  }

  try {
    const decoded = await verifyAdminRequest(req);
    const firestore = admin.firestore();
    const [documents, folders] = await Promise.all([
      collectionDiagnostics(firestore, ASHRAM_DOCUMENTS_PATH),
      collectionDiagnostics(firestore, ASHRAM_FOLDERS_PATH),
    ]);
    res.json({
      ok: true,
      checkedAt: new Date().toISOString(),
      adminEmail: decoded.email || "",
      collections: {
        [ASHRAM_DOCUMENTS_PATH]: documents,
        [ASHRAM_FOLDERS_PATH]: folders,
      },
    });
  } catch (error) {
    logger.error("libraryDiagnostics error", error);
    res.status(error.status || 500).json({
      ok: false,
      error: error.message || "No se pudo diagnosticar la biblioteca.",
    });
  }
});

exports.recordAnalyticsEvent = onRequest({
  timeoutSeconds: 30,
  memory: "256MiB",
  invoker: "public",
  serviceAccount: "ashramganesha@appspot.gserviceaccount.com",
}, async (req, res) => {
  setCorsHeaders(res);
  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }
  if (req.method !== "POST") {
    res.status(405).json({error: "Metodo no permitido."});
    return;
  }

  try {
    const decoded = await verifySignedRequest(req);
    const firestore = admin.firestore();
    const data = normalizeAnalyticsEvent(req.body || {}, decoded);
    logger.info("Evento registrado", {
      eventType: data.eventType,
      contentType: data.contentType,
      hasQuestion: Boolean(data.question),
      topics: data.detectedTopics,
    });
    await firestore.collection("analyticsEvents").add(data);
    await aggregateAnalyticsData(firestore, data);
    res.json({ok: true});
  } catch (error) {
    logger.error("recordAnalyticsEvent error", error);
    res.status(error.status || 500).json({
      error: error.message || "No se pudo registrar analitica.",
    });
  }
});

exports.analyticsDiagnostics = onRequest({
  timeoutSeconds: 30,
  memory: "256MiB",
  invoker: "public",
  serviceAccount: "ashramganesha@appspot.gserviceaccount.com",
}, async (req, res) => {
  setCorsHeaders(res);
  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }
  try {
    const decoded = await verifySignedRequest(req);
    if (!ADMIN_EMAILS.has(String(decoded.email || ""))) {
      res.status(403).json({error: "Solo administrador."});
      return;
    }
    const firestore = admin.firestore();
    const collections = [
      "analyticsEvents",
      "analyticsStats",
      "contentStats",
      "topicStats",
      "keywordStats",
      "searchStats",
      "categoryStats",
      "dailyInterestStats",
      "ganeshaQuestionStats",
    ];
    const counts = {};
    await Promise.all(collections.map(async (name) => {
      const snap = await firestore.collection(name).count().get();
      counts[name] = snap.data().count || 0;
    }));
    const latestEvent = await firestore.collection("analyticsEvents")
        .orderBy("timestamp", "desc")
        .limit(1)
        .get();
    res.json({
      ok: true,
      counts,
      latestEvent: latestEvent.docs[0]?.data() || null,
    });
  } catch (error) {
    logger.error("analyticsDiagnostics error", error);
    res.status(error.status || 500).json({
      error: error.message || "No se pudo leer diagnostico.",
    });
  }
});

exports.productSharePage = onRequest({
  timeoutSeconds: 20,
  memory: "256MiB",
  invoker: "public",
  serviceAccount: "ashramganesha@appspot.gserviceaccount.com",
}, async (req, res) => {
  try {
    const productId = decodeURIComponent(String(req.path || req.url || "")
        .split("/").filter(Boolean).pop() || "");
    const productSnap = productId ?
      await admin.database().ref(`productos/${productId}`).once("value") :
      null;
    const product = productSnap?.val() || null;
    const origin = publicOrigin(req);
    const title = product ? productNameBackend(product) : "Ashram Ganesha";
    const price = product && productPriceBackend(product) ?
      formatMoneyBackend(productPriceBackend(product)) :
      "";
    const description = product ?
      [price, limitText(product.descripcion || "", 160)].filter(Boolean)
          .join(" - ") :
      "Tienda, cursos, biblioteca, meditaciones y comunidad.";
    const image = absolutePublicImageUrl(
        productMainImageBackend(product),
        origin,
    );
    const pageUrl = productId ?
      `${origin}/producto/${encodeURIComponent(productId)}` :
      origin;
    const appUrl = productId ?
      `${origin}/?producto=${encodeURIComponent(productId)}#tienda` :
      `${origin}/#tienda`;

    res.set("Cache-Control", "public, max-age=300, s-maxage=300");
    res.status(200).send(productShareHtml({
      title,
      description,
      image,
      pageUrl,
      appUrl,
      exists: Boolean(product),
    }));
  } catch (error) {
    logger.error("productSharePage error", error);
    res.status(500).send("Ashram Ganesha");
  }
});

exports.onLiveMessageCreated = onDocumentCreated({
  document: "enVivoMensajes/{messageId}",
  serviceAccount: "ashramganesha@appspot.gserviceaccount.com",
}, async (event) => {
  const message = event.data?.data() || {};
  if (message.rol === "admin" ||
      ADMIN_EMAILS.has(String(message.email || ""))) return;
  await sendAdminNotificationOnce({
    eventId: `message-${event.params.messageId}`,
    type: "message",
    title: `Nuevo mensaje de ${limitText(
        message.nombre || "la comunidad",
        40,
    )}`,
    body: limitText(message.texto || "Mensaje recibido en el Ashram.", 90),
    route: "/#en-vivo",
    id: event.params.messageId,
  });
});

exports.onDirectChatMessageCreated = onValueCreated({
  ref: "/chat/{threadId}/mensajes/{messageId}",
  instance: "ashramganesha-default-rtdb",
  serviceAccount: "ashramganesha@appspot.gserviceaccount.com",
}, async (event) => {
  const message = event.data.val() || {};
  if (message.rol === "admin" ||
      ADMIN_EMAILS.has(String(message.remitente_email || ""))) return;
  await sendAdminNotificationOnce({
    eventId: `chat-${event.params.threadId}-${event.params.messageId}`,
    type: "chat",
    title: `Nuevo mensaje de ${limitText(
        message.remitente_nombre || "la comunidad",
        40,
    )}`,
    body: limitText(message.texto || "Mensaje recibido en el chat.", 90),
    route: "/#chat",
    id: event.params.threadId,
  });
});

exports.onStoreOrderCreated = onValueCreated({
  ref: "/pedidos/{orderId}",
  instance: "ashramganesha-default-rtdb",
  serviceAccount: "ashramganesha@appspot.gserviceaccount.com",
}, async (event) => {
  await sendAdminNotificationOnce({
    eventId: `order-${event.params.orderId}`,
    type: "order",
    title: "Tenés un nuevo pedido en la tienda",
    body: "Abrí la tienda para revisar el detalle del pedido.",
    route: "/#tienda",
    id: event.params.orderId,
  });
});

exports.onSessionRequestCreated = onValueCreated({
  ref: "/sesiones/{sessionId}",
  instance: "ashramganesha-default-rtdb",
  serviceAccount: "ashramganesha@appspot.gserviceaccount.com",
}, async (event) => {
  const session = event.data.val() || {};
  if (session.estado && session.estado !== "solicitado") return;
  await sendAdminNotificationOnce({
    eventId: `session-${event.params.sessionId}`,
    type: "session",
    title: "Nueva solicitud de turno",
    body: `${limitText(session.nombre || "Alumno", 40)} pidió una sesión.`,
    route: "/#sesiones",
    id: event.params.sessionId,
  });
});

exports.generateWeeklyStoreReport = onSchedule({
  schedule: "0 20 * * 0",
  timeZone: "America/Argentina/Buenos_Aires",
  serviceAccount: "ashramganesha@appspot.gserviceaccount.com",
}, async () => {
  await generateAndStoreWeeklyReport();
});

exports.generateWeeklyStoreReportTest = onRequest({
  timeoutSeconds: 60,
  memory: "512MiB",
  invoker: "public",
  serviceAccount: "ashramganesha@appspot.gserviceaccount.com",
}, async (req, res) => {
  setCorsHeaders(res);
  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }
  if (req.method !== "POST") {
    res.status(405).json({error: "Metodo no permitido."});
    return;
  }
  try {
    await verifyAdminRequest(req);
    const report = await generateAndStoreWeeklyReport();
    res.json({ok: true, report});
  } catch (error) {
    logger.error("generateWeeklyStoreReportTest error", error);
    res.status(error.status || 500).json({
      error: error.message || "No se pudo generar el reporte.",
    });
  }
});

exports.deleteUserAccount = onRequest({
  timeoutSeconds: 30,
  memory: "256MiB",
  invoker: "public",
  serviceAccount: "ashramganesha@appspot.gserviceaccount.com",
}, async (req, res) => {
  setCorsHeaders(res);
  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }
  if (req.method !== "POST") {
    res.status(405).json({error: "Metodo no permitido."});
    return;
  }

  try {
    const decoded = await verifyAdminRequest(req);
    const uid = cleanText(req.body?.uid || "");
    if (!uid) {
      res.status(400).json({error: "Falta uid."});
      return;
    }
    if (uid === decoded.uid) {
      res.status(400).json({error: "No podes borrar tu propio usuario."});
      return;
    }

    const firestore = admin.firestore();
    const realtime = admin.database();
    await Promise.all([
      deleteAuthUser(uid),
      realtime.ref(`usuarios/${uid}`).remove(),
      firestore.collection("users").doc(uid).delete(),
    ]);
    await Promise.allSettled([
      realtime.ref(`chat/${uid}`).remove(),
      firestore.collection("userPresence").doc(uid).delete(),
      firestore.collection("userAnalytics").doc(uid).delete(),
      firestore.collection("analyticsUserSeen").doc(uid).delete(),
    ]);

    res.json({ok: true});
  } catch (error) {
    logger.error("deleteUserAccount error", error);
    res.status(error.status || 500).json({
      error: error.message || "No se pudo borrar el usuario.",
    });
  }
});

async function deleteAuthUser(uid) {
  try {
    await admin.auth().deleteUser(uid);
  } catch (error) {
    if (error.code === "auth/user-not-found") return;
    throw error;
  }
}

async function aggregateAnalyticsData(firestore, data = {}) {
  const eventType = cleanText(data.eventType || "");
  if (!eventType) return;

  const fieldValue = admin.firestore.FieldValue;
  const dateKey = cleanText(data.dateKey || todayKey());
  const contentCategory = cleanText(
      data.contentCategory || data.category || "",
  );
  const topics = Array.isArray(data.detectedTopics) ?
    data.detectedTopics
        .map((topic) => cleanText(topic))
        .filter(Boolean)
        .slice(0, 12) :
    [];
  const keywords = Array.isArray(data.keywords) ?
    data.keywords
        .map((keyword) => cleanText(keyword))
        .filter(Boolean)
        .slice(0, 12) :
    topics;
  const batch = firestore.batch();

  batch.set(firestore.collection("analyticsStats").doc("overview"), {
    totalEvents: fieldValue.increment(1),
    [eventType]: fieldValue.increment(1),
    updatedAt: fieldValue.serverTimestamp(),
  }, {merge: true});

  if (data.contentId || data.contentTitle) {
    const contentStatId = stableId([
      eventType,
      data.contentType || "content",
      data.contentId || data.contentTitle,
    ].join("_"));
    batch.set(firestore.collection("contentStats").doc(contentStatId), {
      eventType,
      contentType: cleanText(data.contentType || ""),
      contentId: cleanText(data.contentId || ""),
      title: cleanText(data.contentTitle || "Sin titulo"),
      category: contentCategory,
      tags: Array.isArray(data.tags) ? data.tags.slice(0, 20) : [],
      topics,
      count: fieldValue.increment(1),
      lastEventAt: fieldValue.serverTimestamp(),
    }, {merge: true});
  }

  if (dateKey) {
    batch.set(firestore.collection("dailyInterestStats").doc(dateKey), {
      dateKey,
      totalEvents: fieldValue.increment(1),
      [eventType]: fieldValue.increment(1),
      updatedAt: fieldValue.serverTimestamp(),
    }, {merge: true});
  }

  if (contentCategory) {
    const categoryId = stableId(contentCategory);
    batch.set(firestore.collection("categoryStats").doc(categoryId), {
      category: contentCategory,
      title: contentCategory,
      count: fieldValue.increment(1),
      lastEventAt: fieldValue.serverTimestamp(),
    }, {merge: true});
  }

  topics.forEach((topic) => {
    const topicId = stableId(topic);
    batch.set(firestore.collection("topicStats").doc(topicId), {
      topic,
      title: topic,
      count: fieldValue.increment(1),
      lastEventAt: fieldValue.serverTimestamp(),
    }, {merge: true});
  });

  keywords.forEach((keyword) => {
    const keywordId = stableId(keyword);
    batch.set(firestore.collection("keywordStats").doc(keywordId), {
      keyword,
      title: keyword,
      count: fieldValue.increment(1),
      lastEventAt: fieldValue.serverTimestamp(),
    }, {merge: true});
  });

  if (eventType === "search_content") {
    const searchQuery = cleanText(data.searchQuery || "");
    if (searchQuery) {
      const searchId = stableId(searchQuery.slice(0, 120));
      batch.set(firestore.collection("searchStats").doc(searchId), {
        searchQuery: searchQuery.slice(0, 180),
        title: searchQuery.slice(0, 120),
        topics,
        count: fieldValue.increment(1),
        lastSearchedAt: fieldValue.serverTimestamp(),
      }, {merge: true});
    }
  }

  if (eventType === "ask_ganesha") {
    const question = cleanText(data.question || "");
    if (question) {
      const questionId = stableId(question.slice(0, 140));
      batch.set(firestore.collection("ganeshaQuestionStats").doc(questionId), {
        question: question.slice(0, 220),
        title: question.slice(0, 120),
        topics,
        count: fieldValue.increment(1),
        lastAskedAt: fieldValue.serverTimestamp(),
      }, {merge: true});
    }
  }

  await batch.commit();
}

async function verifySignedRequest(req) {
  const authHeader = req.get("Authorization") || "";
  const token = authHeader.startsWith("Bearer ") ?
    authHeader.slice("Bearer ".length) :
    "";
  if (!token) {
    const error = new Error("Necesitas iniciar sesion.");
    error.status = 401;
    throw error;
  }
  return admin.auth().verifyIdToken(token);
}

function normalizeAnalyticsEvent(body = {}, decoded = {}) {
  const eventType = cleanText(body.eventType || "").slice(0, 80);
  if (!eventType) {
    const error = new Error("Falta eventType.");
    error.status = 400;
    throw error;
  }
  const userHash = decoded.uid ? stableId(decoded.uid).slice(0, 24) : "";
  return {
    userHash,
    eventType,
    contentId: cleanText(body.contentId || "").slice(0, 180),
    contentTitle: cleanText(body.contentTitle || "").slice(0, 220),
    contentType: cleanText(body.contentType || "").slice(0, 80),
    contentCategory: cleanText(body.contentCategory || body.category || "")
        .slice(0, 160),
    category: cleanText(body.category || body.contentCategory || "")
        .slice(0, 160),
    tags: Array.isArray(body.tags) ?
      body.tags.map((tag) => cleanText(tag)).filter(Boolean).slice(0, 20) :
      [],
    keywords: Array.isArray(body.keywords) ?
      body.keywords.map((keyword) => cleanText(keyword)).filter(Boolean)
          .slice(0, 20) :
      [],
    question: cleanText(body.question || "").slice(0, 900),
    searchQuery: cleanText(body.searchQuery || "").slice(0, 220),
    detectedTopics: Array.isArray(body.detectedTopics) ?
      body.detectedTopics.map((topic) => cleanText(topic)).filter(Boolean)
          .slice(0, 12) :
      [],
    durationMinutes: Math.max(0, Number(body.durationMinutes || 0)),
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
    dateKey: cleanText(body.dateKey || todayKey()).slice(0, 20),
    deviceType: cleanText(body.deviceType || "").slice(0, 40),
    productId: cleanText(body.productId || body.contentId || "").slice(0, 180),
    productName: cleanText(body.productName || body.contentTitle || "")
        .slice(0, 220),
    shareMethod: cleanText(body.shareMethod || "").slice(0, 80),
    imageAttached: Boolean(body.imageAttached),
    shareUrl: cleanText(body.shareUrl || "").slice(0, 500),
    value: Math.max(0, Number(body.value || 0)),
    quantity: Math.max(0, Number(body.quantity || 0)),
  };
}

async function searchAshramDocuments(question) {
  const firestore = admin.firestore();
  try {
    const snapshot = await withTimeout(
        firestore.collection(ASHRAM_DOCUMENTS_PATH)
            .limit(MAX_FIRESTORE_ITEMS)
            .get(),
        `Firestore ${ASHRAM_DOCUMENTS_PATH}`,
    );
    return snapshot.docs.flatMap((doc) => {
      const data = doc.data() || {};
      const content = cleanText(
          indexedTextFromItem(data) ||
          data.contentMarkdown || data.content || data.markdown || "",
      );
      if (!content) return [];
      const privateSearchText = [
        data.title,
        data.folderPath,
        data.fullPath,
        Array.isArray(data.tags) ? data.tags.join(", ") : data.tags,
        data.keywords,
        content,
      ].filter(Boolean).join("\n");
      const normalized = {
        id: doc.id,
        contentId: doc.id,
        title: "Fuente interna del Ashram",
        type: "Apunte interno",
        category: "Estudios internos",
        keywords: Array.isArray(data.tags) ?
          data.tags.join(", ") :
          data.keywords || "",
        description: "",
        text: content,
        contextText: content,
        privateSearchText,
        sourceName: ASHRAM_DOCUMENTS_PATH,
        source: ASHRAM_DOCUMENTS_PATH,
        link: "",
        isPrivate: data.isPrivate !== false,
      };
      return chunkContent(content).map((fragment, index) => ({
        ...normalized,
        id: `${ASHRAM_DOCUMENTS_PATH}_${doc.id}_${index}`,
        text: fragment,
        contextText: fragment,
        chunkIndex: index,
        matchScore: contentMatchScore(question, normalized, fragment),
      }));
    })
        .filter((item) => item.text && item.matchScore >= CONTENT_MATCH_SCORE)
        .sort((a, b) => b.matchScore - a.matchScore)
        .slice(0, 6);
  } catch (error) {
    logger.warn(`No se pudo consultar ${ASHRAM_DOCUMENTS_PATH}`, error);
    console.log("Resultados encontrados:", 0);
    return [];
  }
}

async function verifyAdminRequest(req) {
  const authHeader = String(req.get("authorization") || "");
  const token = authHeader.startsWith("Bearer ") ?
    authHeader.slice("Bearer ".length).trim() :
    "";
  if (!token) {
    const error = new Error("Necesitas iniciar sesion como administrador.");
    error.status = 401;
    throw error;
  }

  const decoded = await admin.auth().verifyIdToken(token);
  const profileSnap = await admin.database()
      .ref(`usuarios/${decoded.uid}/rol`)
      .once("value");
  const isAdminEmail = ADMIN_EMAILS.has(String(decoded.email || ""));
  if (profileSnap.val() !== "admin" && !isAdminEmail) {
    const error = new Error(
        "Solo el administrador puede sincronizar cuadernos.",
    );
    error.status = 403;
    throw error;
  }
  return decoded;
}

async function collectionDiagnostics(firestore, collectionName) {
  const ref = firestore.collection(collectionName);
  let count = null;
  try {
    const countSnap = await ref.count().get();
    count = countSnap.data().count;
  } catch (error) {
    logger.warn(`No se pudo contar ${collectionName} con aggregate`, error);
  }

  const sampleSnap = await ref.limit(10).get();
  return {
    count: count === null ? sampleSnap.size : count,
    sampleSize: sampleSnap.size,
    sample: sampleSnap.docs.map((doc) => {
      const data = doc.data() || {};
      return {
        id: doc.id,
        title: data.title || data.name || data.displayName || "",
        type: data.type || "",
        folderPath: data.folderPath || "",
        fullPath: data.fullPath || "",
        isPrivate: data.isPrivate !== false,
        updatedAt: timestampToIso(data.updatedAt),
        createdAt: timestampToIso(data.createdAt),
      };
    }),
  };
}

function timestampToIso(value) {
  if (!value) return "";
  if (typeof value.toDate === "function") return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

async function searchGaneshaKnowledge(question) {
  let knowledge = {};
  try {
    const snapshot = await withTimeout(
        admin.database().ref(KNOWLEDGE_PATH).once("value"),
        `Realtime Database ${KNOWLEDGE_PATH}`,
    );
    knowledge = snapshot.val() || {};
  } catch (error) {
    logger.warn(`No se pudo consultar ${KNOWLEDGE_PATH}`, error);
    return [];
  }

  return Object.entries(knowledge)
      .map(([id, item]) => ({
        id,
        ...item,
        matchScore: matchScore(question, item),
      }))
      .filter((item) => item.active !== false)
      .filter((item) => item.matchScore >= MIN_MATCH_SCORE)
      .sort((a, b) => {
        const priorityDiff = Number(b.priority || 0) - Number(a.priority || 0);
        return b.matchScore - a.matchScore || priorityDiff;
      })
      .slice(0, 4);
}

async function searchAshramContent(question) {
  const realtimeMatches = await searchRealtimeContent(question);
  const firestoreMatches = await searchFirestoreContent(question);
  const matches = [...realtimeMatches, ...firestoreMatches]
      .filter((item) => item.matchScore >= CONTENT_MATCH_SCORE)
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, 6);

  console.log("Resultados encontrados:", matches.length);
  return matches;
}

async function searchRealtimeContent(question) {
  const db = admin.database();
  const groups = await Promise.all(REALTIME_CONTENT_SOURCES.map(
      async (config) => {
        console.log("Colección consultada:", config.path);
        try {
          const read = db.ref(config.path)
              .orderByKey()
              .limitToLast(MAX_REALTIME_ITEMS)
              .once("value");
          const snapshot = await withTimeout(
              read,
              `Realtime Database ${config.path}`,
          );
          const value = snapshot.val() || {};
          const matches = Object.entries(value)
              .flatMap(([id, item]) => contentMatchesFromItem(
                  question,
                  id,
                  item,
                  config,
                  config.path,
              ));
          console.log("Resultados encontrados:", matches.length);
          return matches;
        } catch (error) {
          logger.warn(`No se pudo consultar ${config.path}`, error);
          console.log("Resultados encontrados:", 0);
          return [];
        }
      },
  ));

  return groups.flat();
}

async function searchFirestoreContent(question) {
  const firestore = admin.firestore();
  const groups = [];

  for (const collectionName of FIRESTORE_CONTENT_COLLECTIONS) {
    console.log("Colección consultada:", collectionName);
    try {
      const snapshot = await firestore.collection(collectionName)
          .limit(MAX_FIRESTORE_ITEMS)
          .get();
      const config = firestoreConfig(collectionName);
      const matches = snapshot.docs.flatMap((doc) => contentMatchesFromItem(
          question,
          doc.id,
          doc.data(),
          config,
          collectionName,
      ));
      console.log("Resultados encontrados:", matches.length);
      groups.push(matches);
    } catch (error) {
      logger.warn(`No se pudo consultar Firestore ${collectionName}`, error);
      console.log("Resultados encontrados:", 0);
      if (isFirestoreDisabled(error)) break;
    }
  }

  return groups.flat();
}

function isFirestoreDisabled(error = {}) {
  const message = String(error.message || "");
  return error.code === 7 ||
    error.code === "permission-denied" ||
    message.includes("Cloud Firestore API has not been used") ||
    message.includes("firestore.googleapis.com") ||
    message.includes("SERVICE_DISABLED");
}

function withTimeout(promise, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`${label} superó el tiempo de espera`));
    }, DATABASE_READ_TIMEOUT_MS);
  });

  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function firestoreConfig(collectionName) {
  const realtimeConfig = REALTIME_CONTENT_SOURCES
      .find((config) => config.path === collectionName);

  return realtimeConfig || {
    path: collectionName,
    type: "Contenido",
    category: "Ashram",
    link: "",
  };
}

function contentMatchesFromItem(question, id, item = {}, config, sourceName) {
  if (typeof item === "string") {
    item = {content: item};
  }
  if (!isActiveContent(item)) return [];
  const normalized = normalizeContentItem(id, item, config, sourceName);
  if (!normalized.text && !normalized.title && !normalized.keywords) return [];

  const fragments = chunkContent(normalized.text || normalized.summaryText);
  return fragments.map((text, index) => {
    const matchScore = contentMatchScore(question, normalized, text);
    return {
      ...normalized,
      id: `${sourceName}_${id}_${index}`,
      contentId: id,
      text,
      chunkIndex: index,
      matchScore,
    };
  }).filter((match) => match.matchScore >= CONTENT_MATCH_SCORE);
}

function normalizeContentItem(id, item = {}, config = {}, sourceName = "") {
  const title = firstText(
      item.title,
      item.titulo,
      item.nombre,
      item.name,
      item.tema,
      item.question,
      item.pregunta,
      `Contenido ${id}`,
  );
  const category = firstText(
      item.category,
      item.categoria,
      item.etiqueta,
      item.seccion,
      config.category,
      "Ashram",
  );
  const keywords = keywordTextFromItem(item);
  const description = firstText(
      item.description,
      item.descripcion,
      item.summary,
      item.resumen,
      item.extracto,
      item.sinopsis,
  );
  const text = contentTextFromItem(item);
  const indexedText = indexedTextFromItem(item);
  const mediaType = mediaTypeFromItem(item, config, sourceName);
  const summaryText = [
    title,
    category,
    keywords,
    description,
    indexedText,
    text,
  ].filter(Boolean).join("\n");

  return {
    title,
    type: firstText(item.type, item.tipo, mediaType, config.type, "Contenido"),
    category,
    keywords,
    description,
    text: summaryText,
    sourceName,
    link: sourceLinkFromItem(id, item, config, sourceName),
    imageUrl: imageUrlFromItem(item),
    openUrl: openUrlFromItem(item),
    mediaType,
  };
}

function sourceLinkFromItem(id, item = {}, config = {}, sourceName = "") {
  if (isInternalSource({sourceName})) return "";

  const directLink = firstText(
      item.link,
      item.enlace,
      item.internalLink,
      item.urlInterna,
      item.href,
      item.url,
  );
  if (directLink) return directLink;
  if (!NAVIGABLE_SOURCE_PATHS.has(sourceName)) return "";
  if (!config.link) return "";
  return id ? `${config.link}/${encodeURIComponent(id)}` : config.link;
}

function contentTextFromItem(item = {}) {
  const direct = [
    item.indexedText,
    item.searchText,
    item.extractedText,
    item.pdfText,
    item.epubText,
    item.textoIndexado,
    item.textoExtraido,
    item.textoPdf,
    item.textoEpub,
    item.content,
    item.contenido,
    item.body,
    item.texto,
    item.text,
    item.markdown,
    item.contenidoMarkdown,
    item.contentMarkdown,
    item.html,
    item.respuesta,
    item.answer,
  ];
  const nested = [
    item.sections,
    item.secciones,
    item.modules,
    item.modulos,
    item.classes,
    item.clases,
    item.chapters,
    item.capitulos,
    item.pages,
    item.paginas,
    item.items,
  ].flatMap(extractNestedText);

  return [...direct, ...nested].filter(Boolean).join("\n");
}

function indexedTextFromItem(item = {}) {
  const chapters = [
    item.indexedChapters,
    item.chapters,
    item.capitulos,
    item.toc,
  ].flatMap(extractNestedText);
  const headings = [
    item.extractedTitles,
    item.titles,
    item.titulos,
    item.headings,
  ].flatMap(extractNestedText);
  return [
    item.indexedText,
    item.searchText,
    item.extractedText,
    item.pdfText,
    item.epubText,
    item.textoIndexado,
    item.textoExtraido,
    item.textoPdf,
    item.textoEpub,
    ...headings,
    ...chapters,
  ].filter(Boolean).join("\n");
}

function extractNestedText(value) {
  if (!value) return [];
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(extractNestedText);
  if (typeof value !== "object") return [];

  const text = contentTextFromItem(value);
  const metadata = [
    value.title,
    value.titulo,
    value.nombre,
    value.description,
    value.descripcion,
    value.keywords,
    value.categoria,
  ].filter(Boolean);
  return [text, ...metadata].filter(Boolean);
}

function keywordTextFromItem(item = {}) {
  return [
    item.keywords,
    item.keywordList,
    item.tags,
    item.extractedKeywords,
    item.palabrasClaveExtraidas,
    item.palabras_clave,
    item.palabrasClave,
    item.categoria,
    item.category,
  ].map((value) => Array.isArray(value) ? value.join(", ") : value)
      .filter(Boolean)
      .join(", ");
}

function mediaTypeFromItem(item = {}, config = {}, sourceName = "") {
  const fileType = normalizeText(firstText(
      item.mediaType,
      item.fileType,
      item.tipoArchivo,
      item.mimeType,
      item.formato,
      item.type,
      item.tipo,
      config.type,
      sourceName,
  ));
  const url = normalizeText(firstText(
      item.pdfUrl,
      item.pdf_url,
      item.epubUrl,
      item.epub_url,
      item.archivo_url,
      item.fileUrl,
      item.url,
  ));
  if (fileType.includes("epub") || url.includes("epub")) return "EPUB";
  if (fileType.includes("pdf") || url.includes("pdf")) return "PDF";
  if (sourceName === "biblioteca" || sourceName === "libros") return "Libro";
  return "";
}

function imageUrlFromItem(item = {}) {
  return firstText(
      item.coverUrl,
      item.cover_url,
      item.portadaUrl,
      item.portada_url,
      item.portada,
      item.imageUrl,
      item.image_url,
      item.imagenUrl,
      item.imagen_url,
      item.imagen,
      item.thumbnail,
      item.thumbnailUrl,
  );
}

function openUrlFromItem(item = {}) {
  return firstText(
      item.openUrl,
      item.open_url,
      item.pdfUrl,
      item.pdf_url,
      item.epubUrl,
      item.epub_url,
      item.fileUrl,
      item.file_url,
      item.archivoUrl,
      item.archivo_url,
      item.url,
      item.link,
      item.enlace,
  );
}

function contentMatchScore(question, item = {}, fragment = "") {
  const queryTerms = new Set(keywordsFrom(question));
  if (!queryTerms.size) return 0;

  let score = 0;
  if (hasIntersection(queryTerms, termsFrom(item.keywords))) score += 35;
  if (hasIntersection(queryTerms, termsFrom(item.title))) score += 35;
  if (hasIntersection(queryTerms, termsFrom(item.category))) score += 10;
  if (hasIntersection(queryTerms, termsFrom(item.description))) score += 20;

  const fragmentTerms = termsFrom(fragment);
  const hits = [...queryTerms].filter((term) => fragmentTerms.has(term)).length;
  score += Math.round((hits / queryTerms.size) * 45);

  const privateTerms = termsFrom(item.privateSearchText || "");
  const privateHits = [...queryTerms]
      .filter((term) => privateTerms.has(term))
      .length;
  if (privateHits) score += Math.round((privateHits / queryTerms.size) * 30);

  return score;
}

function chunkContent(value = "") {
  const clean = cleanText(value);
  if (!clean) return [];
  if (clean.length <= 1000) return [clean];

  const chunks = [];
  let cursor = 0;
  while (cursor < clean.length && chunks.length < 12) {
    const raw = clean.slice(cursor, cursor + 1000);
    const breakAt = raw.lastIndexOf(". ");
    const size = breakAt > 500 ? breakAt + 1 : raw.length;
    chunks.push(raw.slice(0, size).trim());
    cursor += size;
  }
  return chunks.filter(Boolean);
}

function firstText(...values) {
  const found = values.find((value) => {
    if (value === null || value === undefined) return false;
    return cleanText(Array.isArray(value) ? value.join(", ") : value);
  });
  if (found === undefined) return "";
  return cleanText(Array.isArray(found) ? found.join(", ") : found);
}

function isActiveContent(item = {}) {
  return item.active !== false &&
    item.activo !== false &&
    item.visible !== false &&
    item.status !== "archived" &&
    item.estado !== "archivado";
}

function matchScore(question, item = {}) {
  const queryTerms = new Set(keywordsFrom(question));
  if (!queryTerms.size) return 0;

  const keywordTerms = termsFrom(item.keywords || item.palabras_clave);
  const topicTerms = termsFrom(item.topic || item.mainTopic || item.tema);
  const questionTerms = termsFrom(
      item.originalQuestion || item.question || item.pregunta,
  );
  const categoryTerms = termsFrom(item.category || item.categoria);

  let score = 0;
  if (hasIntersection(queryTerms, keywordTerms)) score += 30;
  if (hasIntersection(queryTerms, topicTerms)) score += 40;
  if (isSimilarQuestion(queryTerms, questionTerms)) score += 50;
  if (hasIntersection(queryTerms, categoryTerms)) score += 10;
  return score;
}

function buildContext(matches) {
  return matches.map((item, index) => {
    const internal = isInternalSource(item);
    const title = internal ? "Fuente interna del Ashram" :
      item.title || item.titulo || item.topic ||
      item.originalQuestion || `Conocimiento ${index + 1}`;
    const category = item.category || item.categoria || "Ashram";
    const topic = item.topic || item.mainTopic || item.tema || "";
    const savedQuestion = item.originalQuestion || item.question ||
      item.pregunta || "";
    const keywords = Array.isArray(item.keywords) ?
      item.keywords.join(", ") :
      item.keywords || item.palabras_clave || "";
    const answer = item.contextText || item.text || item.taughtAnswer ||
      item.answer || item.respuesta || "";
    const type = item.type || item.tipo || "Contenido del Ashram";
    const source = item.sourceName || item.source || KNOWLEDGE_PATH;
    const isCourse = isCourseSource(item);
    const authorizedContent = isCourse ?
      courseContextText(item, answer) :
      limitText(answer, 1800);

    return [
      `Fuente ${index + 1}: ${title}`,
      `Tipo: ${type}`,
      `Categoría: ${category}`,
      `Origen: ${internal ? "interno" : source}`,
      isCourse ?
        "Nota: usar solo como referencia tematica; no copiar contenido " +
          "completo del curso." :
        "",
      topic ? `Tema: ${topic}` : "",
      savedQuestion && !internal ? `Pregunta guardada: ${savedQuestion}` : "",
      keywords ? `Keywords: ${keywords}` : "",
      `Contenido autorizado: ${authorizedContent}`,
    ].filter(Boolean).join("\n");
  }).join("\n\n---\n\n");
}

function isCourseSource(item = {}) {
  const sourceName = item.sourceName || item.source || "";
  const type = normalizeText(item.type || item.tipo || "");
  const category = normalizeText(item.category || item.categoria || "");
  return sourceName === "cursos" ||
    sourceName === "courses" ||
    sourceName === "conocimiento" ||
    type.includes("curso") ||
    category.includes("curso");
}

function courseContextText(item = {}, answer = "") {
  return limitText([
    item.title,
    item.description,
    item.keywords,
    answer,
  ].filter(Boolean).join("\n"), 700);
}

async function askGemini({apiKey, question, userName, context}) {
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY no configurado");
  }

  const endpoint =
    `https://generativelanguage.googleapis.com/v1beta/models/` +
    `${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({
      systemInstruction: {
        parts: [{text: buildSystemInstruction(userName)}],
      },
      contents: [{
        role: "user",
        parts: [{
          text:
            `Pregunta del usuario:\n${question}\n\n` +
            `Contexto del Ashram:\n${context}`,
        }],
      }],
      generationConfig: {
        temperature: 0.55,
        topP: 0.8,
        maxOutputTokens: 1100,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw geminiError(response.status, errorText);
  }

  const data = await response.json();
  return data?.candidates?.[0]?.content?.parts
      ?.map((part) => part.text || "")
      .join("\n")
      .trim() || "";
}

async function askGeminiEnglishTeacher({
  apiKey,
  question,
  userName,
  lessonContext = {},
}) {
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY no configurado");
  }

  const endpoint =
    `https://generativelanguage.googleapis.com/v1beta/models/` +
    `${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({
      systemInstruction: {
        parts: [{text: buildEnglishTeacherInstruction()}],
      },
      contents: [{
        role: "user",
        parts: [{
          text: buildEnglishTeacherPrompt({
            question,
            userName,
            lessonContext,
          }),
        }],
      }],
      generationConfig: {
        temperature: 0.25,
        topP: 0.8,
        maxOutputTokens: 900,
        responseMimeType: "application/json",
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw geminiError(response.status, errorText);
  }

  const text = (await response.json())?.candidates?.[0]?.content?.parts
      ?.map((part) => part.text || "")
      .join("\n")
      .trim() || "";
  return normalizeEnglishTeacherResponse(parseJsonObject(text), lessonContext);
}

async function askGeminiEnglishTeacherChat({
  apiKey,
  message,
  userName,
  currentTopic,
  lessonState = {},
  userProgress = {},
}) {
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY no configurado");
  }

  const endpoint =
    `https://generativelanguage.googleapis.com/v1beta/models/` +
    `${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({
      systemInstruction: {
        parts: [{text: buildEnglishTeacherChatInstruction()}],
      },
      contents: [{
        role: "user",
        parts: [{
          text: buildEnglishTeacherChatPrompt({
            message,
            userName,
            currentTopic,
            lessonState,
            userProgress,
          }),
        }],
      }],
      generationConfig: {
        temperature: 0.45,
        topP: 0.85,
        maxOutputTokens: 1400,
        responseMimeType: "application/json",
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw geminiError(response.status, errorText);
  }

  const text = (await response.json())?.candidates?.[0]?.content?.parts
      ?.map((part) => part.text || "")
      .join("\n")
      .trim() || "";
  return normalizeEnglishTeacherChatResponse(parseJsonObject(text), {
    currentTopic,
    lessonState,
  });
}

async function askGeminiEnglishLessonGenerator({
  apiKey,
  userName,
  level,
  topic,
}) {
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY no configurado");
  }

  const endpoint =
    `https://generativelanguage.googleapis.com/v1beta/models/` +
    `${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({
      systemInstruction: {
        parts: [{text: buildEnglishLessonGeneratorInstruction()}],
      },
      contents: [{
        role: "user",
        parts: [{
          text: [
            `Usuario: ${userName}`,
            `Nivel: ${level}`,
            `Tema: ${topic}`,
            "Genera una practica completa lista para importar.",
          ].join("\n"),
        }],
      }],
      generationConfig: {
        temperature: 0.65,
        topP: 0.9,
        maxOutputTokens: 5000,
        responseMimeType: "application/json",
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw geminiError(response.status, errorText);
  }

  const text = (await response.json())?.candidates?.[0]?.content?.parts
      ?.map((part) => part.text || "")
      .join("\n")
      .trim() || "";
  return normalizeGeneratedEnglishLesson(parseJsonObject(text), level, topic);
}

async function askGeminiTransform({apiKey, action, title, content}) {
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY no configurado");
  }

  const endpoint =
    `https://generativelanguage.googleapis.com/v1beta/models/` +
    `${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const spec = transformSpec(action);

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({
      systemInstruction: {
        parts: [{text: [
          "Eres asistente editorial del Ashram Ganesha.",
          "Transformas apuntes privados en borradores claros y publicables.",
          "Usa solamente el documento recibido.",
          "No inventes datos, citas, enlaces ni promesas.",
          "Conserva un tono calido, docente, espiritual y simple.",
          "Devuelve exclusivamente JSON valido con: title, type, " +
            "content, summary, tags.",
        ].join("\n")}],
      },
      contents: [{
        role: "user",
        parts: [{
          text: [
            `Accion: ${spec.label}`,
            `Tipo destino: ${spec.type}`,
            `Titulo original: ${title}`,
            `Instrucciones: ${spec.instructions}`,
            "",
            "Documento base:",
            content,
          ].join("\n"),
        }],
      }],
      generationConfig: {
        temperature: 0.6,
        topP: 0.85,
        maxOutputTokens: 1800,
        responseMimeType: "application/json",
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error ${response.status}: ${errorText}`);
  }

  const text = (await response.json())?.candidates?.[0]?.content?.parts
      ?.map((part) => part.text || "")
      .join("\n")
      .trim() || "";
  const parsed = parseJsonObject(text);
  return {
    title: cleanText(parsed.title || `${spec.label}: ${title}`),
    type: cleanText(parsed.type || spec.type),
    content: String(parsed.content || "").trim(),
    summary: cleanText(parsed.summary || ""),
    tags: Array.isArray(parsed.tags) ? parsed.tags.slice(0, 12) : [],
  };
}

function transformSpec(action = "") {
  const specs = {
    summary: {
      label: "Crear resumen",
      type: "summary",
      instructions: "Resume el documento en Markdown con ideas principales, " +
        "puntos clave y una conclusion breve.",
    },
    post: {
      label: "Crear post",
      type: "post",
      instructions: "Crea un post breve para blog o red social, con titulo, " +
        "introduccion, desarrollo y cierre.",
    },
    article: {
      label: "Crear articulo",
      type: "article",
      instructions: "Crea un articulo en Markdown con subtitulos, " +
        "desarrollo claro y tono docente.",
    },
    video_script: {
      label: "Crear guion para video",
      type: "video_script",
      instructions: [
        "Crea un texto nuevo editable en Markdown para grabar un video.",
        "Debe usar exactamente estas secciones:",
        "# Titulo del video",
        "## Gancho inicial",
        "## Desarrollo",
        "## Ejemplo practico",
        "## Cierre espiritual",
        "## Llamada a la accion",
        "El guion debe ser claro, calido, profundo y util para narracion oral.",
      ].join("\n"),
    },
  };
  return specs[action] || specs.summary;
}

function geminiError(status, rawText = "") {
  const message = `Gemini API error ${status}: ${rawText}`;
  const error = new Error(message);
  error.status = status;
  const normalized = `${status} ${rawText}`.toUpperCase();
  if (status === 503 || normalized.includes("UNAVAILABLE")) {
    error.code = "UNAVAILABLE";
  }
  return error;
}

function stableId(value = "") {
  const clean = String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 140);
  return clean || "sin-id";
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function parseJsonObject(value = "") {
  try {
    return JSON.parse(value);
  } catch {
    const match = String(value).match(/\{[\s\S]*\}/);
    if (!match) return {};
    try {
      return JSON.parse(match[0]);
    } catch {
      return {};
    }
  }
}

function buildSystemInstruction(userName) {
  return [
    "Eres Ganesha Guía.",
    "Actúas como guía espiritual del Ashram Virtual Ganesha.",
    `Puedes dirigirte al usuario como ${userName} cuando sea natural.`,
    "Usa únicamente el contexto recibido.",
    "No inventes información.",
    "No uses conocimientos externos.",
    "Si el contexto no contiene la respuesta, responde exactamente:",
    UNKNOWN_MESSAGE,
    "No respondas como un buscador ni como una lista de enlaces.",
    "No escribas frases como 'encontre este documento', 'segun el archivo' " +
      "ni nombres de fuentes privadas.",
    "Antes de mencionar recursos, construye una explicación clara.",
    "La respuesta debe tener al menos 2 párrafos.",
    "Idealmente usa 3 a 5 párrafos cortos.",
    "Analiza el contexto, explícalo con palabras simples y relaciónalo " +
      "con la pregunta.",
    "La respuesta final debe quedar entre 3 y 5 parrafos cortos.",
    "Integra cuadernos, libros, posts, cursos, meditaciones y biblioteca " +
      "en una sola respuesta coherente cuando haya contexto suficiente.",
    "Si el contexto incluye cursos, no copies ni expongas el contenido " +
      "completo del curso; solo usa la idea general para orientar.",
    "No reveles rutas internas, IDs, nombres de archivos ni carpetas privadas.",
    "Incluye una reflexión breve, cálida y espiritual.",
    "No te limites a resumir una fuente.",
    "No respondas con una sola frase.",
    "No incluyas enlaces en el texto; la aplicación los mostrará aparte.",
    "Puedes organizar la respuesta con este flujo: respuesta, explicación " +
      "y reflexión breve.",
    "Responde de forma cálida, simple, docente, reflexiva y espiritual.",
    "No des diagnósticos médicos.",
    "No indiques tratamientos médicos.",
    "Habla como un guía amable.",
  ].join("\n");
}

function buildEnglishTeacherInstruction() {
  return [
    "Eres un profesor de ingles para un usuario hispanohablante.",
    "Tu tarea es ensenar ingles de forma clara, amable, practica y progresiva.",
    "Responde siempre en espanol, salvo cuando muestres frases en ingles.",
    "Debes ayudar al usuario a hablar ingles, escuchar ingles, comprender " +
      "frases, corregir pronunciacion, corregir gramatica, responder " +
      "preguntas, mejorar fluidez y aprender vocabulario.",
    "Cuando el usuario practique una frase, compara la frase correcta con " +
      "lo que dijo el usuario.",
    "Detecta palabras faltantes.",
    "Detecta palabras mal pronunciadas o mal reconocidas.",
    "Explica el error de forma simple.",
    "Da la frase correcta.",
    "Da la pronunciacion aproximada en espanol.",
    "Da una version mas natural si corresponde.",
    "Devuelve un puntaje de 0 a 100.",
    "Si score >= 85, correct debe ser true.",
    "Si score < 85, correct debe ser false.",
    "Si correct es true, nextAction debe ser \"continue\".",
    "Si correct es false, nextAction debe ser \"repeat\".",
    "No uses fuentes del Ashram.",
    "No muestres enlaces.",
    "No respondas como guia espiritual.",
    "Devuelve exclusivamente JSON valido.",
    "El JSON debe tener exactamente estas claves principales: answer, " +
      "correct, score, correctPhrase, userPhrase, correction, " +
      "pronunciation, translation, nextAction.",
  ].join("\n");
}

function buildEnglishTeacherChatInstruction() {
  return [
    "Eres un profesor de ingles para Gabriel, un usuario hispanohablante.",
    "La experiencia es una clase guiada en formato chat para celular.",
    "Habla siempre en espanol para guiar, salvo cuando muestres frases " +
      "en ingles.",
    "No uses fuentes del Ashram.",
    "No respondas como guia espiritual.",
    "No muestres enlaces.",
    "Debes interpretar mensajes como: quiero practicar Ayurveda, haceme " +
      "la clase mas facil, haceme la clase mas dificil, no entendi, dame " +
      "otro ejemplo, quiero hablar de meditacion, repetir clase, tema nuevo " +
      "o hagamos una conversacion.",
    "Acciones permitidas: continue_lesson, repeat_lesson, choose_new_topic, " +
      "generate_new_lesson, explain_again, free_conversation.",
    "Si el usuario pide tema nuevo u otro tema, usa action " +
      "choose_new_topic.",
    "Si el usuario pide repetir clase, usa action repeat_lesson.",
    "Si el usuario pide una clase de un tema nuevo o cambiar dificultad, " +
      "usa action generate_new_lesson e incluye phrases.",
    "Si el usuario no entiende, usa action explain_again.",
    "Si el usuario quiere conversar libremente, usa action free_conversation.",
    "Si conviene seguir la clase actual, usa action continue_lesson.",
    "Cuando generes phrases, crea entre 5 y 10 frases simples con: id, " +
      "english, pronunciation, translation.",
    "Devuelve exclusivamente JSON valido.",
    "El JSON debe tener estas claves: answer, action, topic, currentPhrase, " +
      "phrases, suggestedReplies.",
    "currentPhrase debe tener: english, pronunciation, translation.",
    "suggestedReplies debe tener hasta 3 frases cortas en ingles.",
  ].join("\n");
}

function buildEnglishLessonGeneratorInstruction() {
  return [
    "Eres un profesor de ingles para hispanohablantes.",
    "Generas material de practica claro, util y progresivo.",
    "Devuelve exclusivamente JSON valido.",
    "No incluyas texto fuera del JSON.",
    "El JSON debe tener: title, level, topic, phrases, questions, " +
      "fill_blanks, listening, words.",
    "phrases debe contener exactamente 10 objetos con: id, english, " +
      "pronunciation, spanish.",
    "questions debe contener exactamente 10 objetos con: id, question, " +
      "validAnswers, options.",
    "fill_blanks debe contener exactamente 10 objetos con: id, prompt, " +
      "answer, options.",
    "listening debe contener exactamente 10 objetos con: id, title, text, " +
      "correctAnswers, options.",
    "words debe contener exactamente 10 objetos con: id, word, answer, " +
      "options.",
    "Usa ingles simple si el nivel es basico.",
    "Incluye temas de Ayurveda, yoga o meditacion solo si el tema lo pide.",
  ].join("\n");
}

function buildEnglishTeacherChatPrompt({
  message,
  userName,
  currentTopic,
  lessonState,
  userProgress,
}) {
  return [
    `Usuario: ${cleanText(userName || "Gabriel")}`,
    `Mensaje escrito: ${cleanText(message || "")}`,
    `Tema actual: ${cleanText(currentTopic || "")}`,
    "",
    "Estado actual de la clase:",
    JSON.stringify(lessonState || {}),
    "",
    "Progreso del usuario:",
    JSON.stringify(userProgress || {}),
    "",
    "Responde como profesor real y decide la accion mas util.",
  ].join("\n");
}

function buildEnglishTeacherPrompt({question, userName, lessonContext = {}}) {
  return [
    `Usuario: ${cleanText(userName || "estudiante")}`,
    `Pedido del usuario: ${cleanText(question || "")}`,
    `Tipo de practica: ${cleanText(lessonContext.practiceType || "speaking")}`,
    "",
    "Contexto de la leccion:",
    JSON.stringify({
      lessonId: cleanText(lessonContext.lessonId || ""),
      currentPhrase: cleanText(lessonContext.currentPhrase || ""),
      pronunciation: cleanText(lessonContext.pronunciation || ""),
      translation: cleanText(lessonContext.translation || ""),
      userSpeech: cleanText(lessonContext.userSpeech || ""),
      selectedAnswer: cleanText(lessonContext.selectedAnswer || ""),
      correctAnswer: cleanText(lessonContext.correctAnswer || ""),
      validAnswers: Array.isArray(lessonContext.validAnswers) ?
        lessonContext.validAnswers.map((item) => cleanText(item)) :
        [],
      missingWord: cleanText(lessonContext.missingWord || ""),
      userAnswer: cleanText(lessonContext.userAnswer || ""),
      conversationHistory: Array.isArray(lessonContext.conversationHistory) ?
        lessonContext.conversationHistory.slice(-8) :
        [],
    }),
    "",
    "Instrucciones por practiceType:",
    "speaking: corrige lo que el usuario dijo.",
    "listening_translation: evalua si la traduccion elegida es correcta.",
    "question_answer: evalua si la respuesta es apropiada.",
    "fill_blank: evalua si la palabra completada es correcta.",
    "conversation: conversa en ingles sencillo y corrige en espanol.",
  ].join("\n");
}

function normalizeEnglishTeacherChatResponse(parsed = {}, context = {}) {
  const allowedActions = new Set([
    "continue_lesson",
    "repeat_lesson",
    "choose_new_topic",
    "generate_new_lesson",
    "explain_again",
    "free_conversation",
  ]);
  const action = cleanText(parsed.action || "continue_lesson");
  const topic = cleanText(
      parsed.topic ||
      context.currentTopic ||
      context.lessonState?.topic ||
      "libre",
  );
  const phrases = normalizeGeneratedArray(parsed.phrases)
      .map((item, index) => normalizeEnglishPhrase(item, topic, index))
      .filter((item) => item.english && item.pronunciation && item.translation)
      .slice(0, 10);
  const currentPhrase = normalizeEnglishPhrase(
      parsed.currentPhrase || phrases[0] || context.lessonState?.phrases?.[
        context.lessonState?.currentIndex || 0
      ],
      topic,
      0,
  );

  return {
    answer: cleanText(parsed.answer ||
      "Claro, Gabriel. Sigamos practicando paso a paso."),
    action: allowedActions.has(action) ? action : "continue_lesson",
    topic,
    currentPhrase,
    phrases,
    suggestedReplies: normalizeGeneratedArray(parsed.suggestedReplies)
        .map((item) => cleanText(item))
        .filter(Boolean)
        .slice(0, 3),
  };
}

function normalizeEnglishPhrase(item = {}, topic = "libre", index = 0) {
  return {
    id: cleanText(item.id || `${topic}-${index + 1}`),
    english: cleanText(item.english || item.frase_ingles ||
      item.correctPhrase || ""),
    pronunciation: cleanText(item.pronunciation || item.pronunciacion || ""),
    translation: cleanText(item.translation || item.spanish ||
      item.traduccion || ""),
  };
}

function normalizeEnglishTeacherResponse(parsed = {}, lessonContext = {}) {
  const score = clampScore(Number(parsed.score));
  const correct = score >= 85;
  const correctPhrase = cleanText(
      parsed.correctPhrase || lessonContext.currentPhrase || "",
  );
  const userPhrase = cleanText(
      parsed.userPhrase ||
      lessonContext.userSpeech ||
      lessonContext.userAnswer ||
      lessonContext.selectedAnswer ||
      "",
  );

  return {
    answer: cleanText(parsed.answer || parsed.explanation ||
      "Vamos paso a paso. Revisa la correccion y repeti la frase."),
    correct,
    score,
    correctPhrase,
    userPhrase,
    correction: cleanText(parsed.correction ||
      (correct ? "Muy bien, la respuesta esta aprobada." :
        "Hay algo para corregir antes de avanzar.")),
    pronunciation: cleanText(
        parsed.pronunciation || lessonContext.pronunciation || "",
    ),
    translation: cleanText(
        parsed.translation || lessonContext.translation || "",
    ),
    nextAction: correct ? "continue" : "repeat",
  };
}

function normalizeGeneratedEnglishLesson(parsed = {}, level = "", topic = "") {
  const title = cleanText(parsed.title ||
    `Practica ${topic || "ingles"} - ${level || "basico"}`);
  return {
    title,
    level: cleanText(parsed.level || level || "basico"),
    topic: cleanText(parsed.topic || topic || "conversacion"),
    phrases: normalizeGeneratedArray(parsed.phrases).slice(0, 10),
    questions: normalizeGeneratedArray(parsed.questions).slice(0, 10),
    fill_blanks: normalizeGeneratedArray(parsed.fill_blanks).slice(0, 10),
    listening: normalizeGeneratedArray(parsed.listening).slice(0, 10),
    words: normalizeGeneratedArray(parsed.words).slice(0, 10),
  };
}

function normalizeGeneratedArray(value) {
  return Array.isArray(value) ? value : [];
}

function sanitizeEnglishLessonState(value = {}) {
  const phrases = Array.isArray(value?.phrases) ?
    value.phrases.map((item, index) =>
      normalizeEnglishPhrase(item, cleanText(value?.topic || "libre"), index),
    ).filter((item) =>
      item.english && item.pronunciation && item.translation,
    ).slice(0, 10) :
    [];
  return {
    topic: cleanText(value?.topic || ""),
    phrases,
    currentIndex: clampIndex(value?.currentIndex, phrases.length),
    completed: Boolean(value?.completed),
  };
}

function sanitizeEnglishUserProgress(value = {}) {
  return {
    correctPhrases: normalizeGeneratedArray(value?.correctPhrases)
        .map((item) => cleanText(item))
        .filter(Boolean)
        .slice(0, 30),
    incorrectPhrases: normalizeGeneratedArray(value?.incorrectPhrases)
        .map((item) => cleanText(item))
        .filter(Boolean)
        .slice(0, 30),
    frequentErrors: normalizeGeneratedArray(value?.frequentErrors)
        .map((item) => {
          if (typeof item === "string") return cleanText(item);
          return cleanText(item?.error || item?.correction || "");
        })
        .filter(Boolean)
        .slice(0, 12),
  };
}

function clampScore(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function clampIndex(value, total) {
  const index = Number(value);
  if (!Number.isFinite(index) || index < 0) return 0;
  if (!total) return 0;
  return Math.min(Math.round(index), total - 1);
}

function formatResponse(answer, sources, enough) {
  const navigableSources = sources.filter((source) =>
    source.navigable && source.link,
  );
  const internalSourcesUsed = sources.some((source) => source.internal);
  const enlaces = navigableSources.map((source) => source.link || "");
  return {
    respuesta: answer,
    answer,
    fuentes: navigableSources.map((source) => source.title),
    enlaces,
    sources: [
      ...navigableSources,
      ...(internalSourcesUsed ? [{
        title: INTERNAL_SOURCE_NOTE,
        type: "Apunte interno",
        category: "Estudios internos",
        link: "",
        internal: true,
        navigable: false,
      }] : []),
    ],
    navigableSources,
    internalSourcesUsed,
    internalSourceNote: internalSourcesUsed ? INTERNAL_SOURCE_NOTE : "",
    enough,
    teachable: false,
    provider: "gemini",
  };
}

function uniqueSources(sources = []) {
  const seen = new Set();
  return sources.filter((source) => {
    const key = [
      source.internal ? "internal" : source.source,
      source.link || source.openUrl || "",
      source.title || "",
      source.type || "",
    ].join("|");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 6);
}

function unknownResponse(isAdmin) {
  const message = isAdmin ? ADMIN_UNKNOWN_MESSAGE : UNKNOWN_MESSAGE;
  return {
    respuesta: message,
    answer: message,
    fuentes: [],
    enlaces: [],
    sources: [],
    navigableSources: [],
    internalSourcesUsed: false,
    internalSourceNote: "",
    enough: false,
    teachable: isAdmin,
    provider: "gemini",
  };
}

function sourceFromMatch(item = {}) {
  const internal = isInternalSource(item);
  if (internal) {
    return {
      title: INTERNAL_SOURCE_NOTE,
      type: "Apunte interno",
      category: "Estudios internos",
      source: "interno",
      link: "",
      internal: true,
      navigable: false,
    };
  }

  const sourceName = item.sourceName || item.source || KNOWLEDGE_PATH;
  const link = item.link || item.enlace || item.internalLink || "";
  return {
    title: item.title || item.titulo || item.topic || item.originalQuestion ||
      "Contenido del Ashram",
    type: item.type || item.tipo || "Aprendizaje manual",
    category: item.category || item.categoria || "Ashram",
    source: sourceName,
    link,
    imageUrl: item.imageUrl || "",
    openUrl: item.openUrl || "",
    mediaType: item.mediaType || "",
    actionLabel: actionLabelForSource(item, sourceName),
    internal: false,
    navigable: NAVIGABLE_SOURCE_PATHS.has(sourceName) && Boolean(link),
  };
}

function actionLabelForSource(item = {}, sourceName = "") {
  if (isCourseSource({...item, sourceName})) return "Ver curso";
  const type = normalizeText(item.type || item.tipo || item.mediaType || "");
  if (type.includes("meditacion") || sourceName === "meditaciones") {
    return "Escuchar meditacion";
  }
  if (type.includes("articulo") || sourceName === "blog" ||
    sourceName === "articulos" || sourceName === "posts") {
    return "Leer articulo";
  }
  if (type.includes("libro") || type.includes("pdf") ||
    type.includes("epub") || sourceName === "biblioteca" ||
    sourceName === "libros") {
    return "Abrir libro";
  }
  return "Ver recurso";
}

function isInternalSource(item = {}) {
  const sourceName = item.sourceName || item.source || "";
  const category = normalizeText(item.category || item.categoria || "");
  const type = normalizeText(item.type || item.tipo || "");
  return INTERNAL_SOURCE_PATHS.has(sourceName) ||
    category.includes("cuaderno") ||
    category.includes("nota interna") ||
    category.includes("estudio interno") ||
    type.includes("nota interna") ||
    type.includes("libro interno") ||
    type.includes("markdown personal");
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

function keywordsFrom(value = "") {
  return normalizeText(value)
      .split(/\s+/)
      .filter((term) => term.length > 2 && !STOPWORDS.has(term));
}

function termsFrom(value = "") {
  const text = Array.isArray(value) ? value.join(" ") : value;
  return new Set(keywordsFrom(text));
}

function hasIntersection(left, right) {
  if (!left.size || !right.size) return false;
  return [...left].some((term) => right.has(term));
}

function isSimilarQuestion(queryTerms, savedQuestionTerms) {
  if (!queryTerms.size || !savedQuestionTerms.size) return false;
  const hits = [...queryTerms]
      .filter((term) => savedQuestionTerms.has(term))
      .length;
  return hits / queryTerms.size >= 0.5 ||
    hits / savedQuestionTerms.size >= 0.5;
}

function cleanText(value = "") {
  return String(value).replace(/\s+/g, " ").trim();
}

function containsUnknownAnswer(value = "") {
  return normalizeText(value).includes(
      normalizeText("No tengo suficiente conocimiento dentro del Ashram"),
  );
}

function limitText(value = "", maxLength) {
  const clean = cleanText(value);
  if (clean.length <= maxLength) return clean;
  return `${clean.slice(0, maxLength - 3).replace(/\s+\S*$/, "")}...`;
}

async function sendAdminNotificationOnce({
  eventId,
  type,
  title,
  body,
  route,
  id,
}) {
  const firestore = admin.firestore();
  try {
    await firestore.collection("adminNotificationEvents").doc(eventId).create({
      type,
      id,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch (error) {
    if (error.code === 6 ||
        String(error.message || "").includes("ALREADY_EXISTS")) {
      return;
    }
    throw error;
  }
  await sendAdminPush({eventId, type, title, body, route, id});
}

async function sendAdminPush({eventId, type, title, body, route, id}) {
  const firestore = admin.firestore();
  const snap = await firestore.collection("adminNotificationTokens")
      .where("enabled", "==", true)
      .limit(500)
      .get();
  const docs = snap.docs;
  const tokens = docs.map((doc) => cleanText(doc.data().token))
      .filter(Boolean);
  if (!tokens.length) return;
  const response = await admin.messaging().sendEachForMulticast({
    tokens,
    notification: {title, body},
    data: {
      eventId: cleanText(eventId),
      type: cleanText(type),
      id: cleanText(id),
      route: cleanText(route || "/#admin"),
    },
    webpush: {
      fcmOptions: {
        link: `https://ashramganesha.web.app${route || "/#admin"}`,
      },
    },
  });
  await Promise.all(response.responses.map((result, index) => {
    if (result.success) return null;
    const code = result.error?.code || "";
    if (code.includes("registration-token-not-registered") ||
        code.includes("invalid-registration-token")) {
      return docs[index].ref.delete();
    }
    logger.warn("No se pudo enviar push admin", result.error);
    return null;
  }));
}

async function generateAndStoreWeeklyReport() {
  const firestore = admin.firestore();
  const realtime = admin.database();
  const end = new Date();
  const start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
  const previousStart = new Date(start.getTime() - 7 * 24 * 60 * 60 * 1000);
  const [eventsSnap, previousEventsSnap, pedidosSnap, messagesSnap] =
    await Promise.all([
      firestore.collection("analyticsEvents")
          .where("timestamp", ">=", start)
          .where("timestamp", "<=", end)
          .get(),
      firestore.collection("analyticsEvents")
          .where("timestamp", ">=", previousStart)
          .where("timestamp", "<", start)
          .get(),
      realtime.ref("pedidos").once("value"),
      firestore.collection("enVivoMensajes")
          .where("createdAt", ">=", start)
          .where("createdAt", "<=", end)
          .get()
          .catch(() => ({size: 0})),
    ]);
  const events = eventsSnap.docs.map((doc) => doc.data() || {});
  const previousEvents = previousEventsSnap.docs.map((doc) => doc.data() || {});
  const orders = Object.entries(pedidosSnap.val() || {})
      .map(([id, item]) => ({id, ...item}))
      .filter((item) => {
        const date = new Date(item.fecha || item.createdAt || 0);
        return !Number.isNaN(date.getTime()) && date >= start && date <= end;
      });
  const metrics = reportMetrics(events, orders, messagesSnap.size || 0);
  const previousMetrics = reportMetrics(previousEvents, [], 0);
  const topProducts = topProductsFromEvents(events);
  const comparison = {
    storeViews: metrics.storeViews - previousMetrics.storeViews,
    productViews: metrics.productViews - previousMetrics.productViews,
    productShares: metrics.productShares - previousMetrics.productShares,
    whatsappClicks: metrics.whatsappClicks - previousMetrics.whatsappClicks,
  };
  const reportId = weekId(end);
  const summaryText = `Reporte semanal de la tienda: ${metrics.storeViews} ` +
    `visitas, ${metrics.whatsappClicks} consultas y ` +
    `${metrics.ordersCreated} pedidos.`;
  const report = {
    startDate: start.toISOString(),
    endDate: end.toISOString(),
    generatedAt: admin.firestore.FieldValue.serverTimestamp(),
    metrics,
    topProducts,
    comparison,
    summaryText,
  };
  await firestore.collection("weeklyStoreReports").doc(reportId)
      .set(report, {merge: true});
  await sendAdminPush({
    eventId: `weekly-report-${reportId}`,
    type: "weekly_report",
    title: "Reporte semanal de la tienda",
    body: summaryText,
    route: "/#admin",
    id: reportId,
  });
  return {...report, id: reportId};
}

function reportMetrics(events = [], orders = [], messagesReceived = 0) {
  const count = (eventType) =>
    events.filter((event) => event.eventType === eventType).length;
  const totalSold = orders.reduce((sum, order) =>
    sum + Number(order.total || 0), 0);
  return {
    sessions: new Set(events.map((event) => event.userHash)
        .filter(Boolean)).size,
    storeViews: count("store_view"),
    productViews: count("product_view"),
    searches: count("search_content"),
    productShares: count("store_product_shared"),
    whatsappClicks: count("whatsapp_order_click"),
    ordersCreated: orders.length,
    ordersConfirmed: count("whatsapp_order_confirmed"),
    totalSold,
    messagesReceived,
  };
}

function topProductsFromEvents(events = []) {
  const map = new Map();
  events.filter((event) => event.eventType === "product_view")
      .forEach((event) => {
        const id = event.productId || event.contentId ||
          event.contentTitle || "producto";
        const old = map.get(id) || {
          id,
          title: event.productName || event.contentTitle || "Producto",
          category: event.category || event.contentCategory || "Tienda",
          count: 0,
        };
        old.count += 1;
        map.set(id, old);
      });
  return [...map.values()].sort((a, b) => b.count - a.count).slice(0, 8);
}

function weekId(date) {
  const first = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const days = Math.floor((date - first) / 86400000);
  const week = Math.ceil((days + first.getUTCDay() + 1) / 7);
  return `${date.getUTCFullYear()}-${String(week).padStart(2, "0")}`;
}

function productShareHtml({
  title,
  description,
  image,
  pageUrl,
  appUrl,
  exists,
}) {
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<link rel="canonical" href="${escapeHtml(pageUrl)}">
<meta property="og:type" content="product">
<meta property="og:site_name" content="Ashram Ganesha">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(description)}">
<meta property="og:image" content="${escapeHtml(image)}">
<meta property="og:url" content="${escapeHtml(pageUrl)}">
<meta name="twitter:card" content="summary_large_image">
<meta http-equiv="refresh" content="1;url=${escapeHtml(appUrl)}">
</head>
<body>
<main>
<h1>${escapeHtml(title)}</h1>
<p>${escapeHtml(description)}</p>
<p><a href="${escapeHtml(appUrl)}">${exists ? "Abrir producto" :
    "Abrir Ashram Ganesha"}</a></p>
</main>
<script>
setTimeout(function(){
  location.replace(${JSON.stringify(appUrl)});
},700);
</script>
</body>
</html>`;
}

function publicOrigin(req) {
  const proto = req.get("x-forwarded-proto") || "https";
  const host = req.get("x-forwarded-host") ||
    req.get("host") ||
    "ashramganesha.web.app";
  return `${proto}://${host}`;
}

function productNameBackend(product = {}) {
  return cleanText(product.nombre || product.titulo || "Producto del Ashram");
}

function productPriceBackend(product = {}) {
  const raw = String(product.precio || "")
      .replace(/[^0-9,.-]/g, "")
      .replace(",", ".");
  const value = Number(raw);
  return Number.isFinite(value) ? value : 0;
}

function formatMoneyBackend(value) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(value);
}

function productMainImageBackend(product = {}) {
  return cleanText(product.imagen ||
    product.imagen_url ||
    product.portada_url ||
    product.foto ||
    "");
}

function absolutePublicImageUrl(value = "", origin = "") {
  const image = cleanText(value);
  if (/^https:\/\//i.test(image)) return image;
  if (image.startsWith("/")) return `${origin}${image}`;
  return `${origin}/LogoReal.png`;
}

function escapeHtml(value = "") {
  return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
}

function setCorsHeaders(res) {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
}
