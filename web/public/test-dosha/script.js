// Test de Dosha para Ashram Ganesha.
// Para agregar preguntas, suma objetos dentro de las secciones en DOSHA_TEST.

const STORAGE_KEY = "ashram-dosha-result";

const DOSHAS = {
  vata: {
    label: "Vata",
    traits: "Vata suele ser creativo, sensible, ligero, intuitivo y cambiante. Se asocia con movimiento, aire, entusiasmo y rapidez mental.",
    imbalance: "Cuando Vata se desequilibra puede aparecer ansiedad, insomnio, sequedad, gases, irregularidad digestiva, miedo o dificultad para sostener rutinas.",
    recommendations: [
      "Alimentacion tibia, nutritiva y regular: sopas, guisos suaves, raices, aceites buenos y especias digestivas suaves.",
      "Rutina estable: horarios simples para comer, descansar y practicar.",
      "Descanso profundo: reducir pantallas de noche, abrigo, automasaje con aceite y respiracion lenta.",
      "Practica espiritual: meditacion enraizante, japa pausado, pranayama suave y caminatas conscientes.",
    ],
  },
  pitta: {
    label: "Pitta",
    traits: "Pitta suele ser intenso, claro, decidido, organizado y transformador. Se asocia con fuego, digestion, foco y capacidad de liderazgo.",
    imbalance: "Cuando Pitta se desequilibra puede aparecer irritabilidad, acidez, inflamacion, exceso de critica, calor corporal, impaciencia o agotamiento por exigencia.",
    recommendations: [
      "Alimentacion refrescante y moderada: verduras, frutas dulces, granos suaves y menos picante, fritos, cafe o alcohol.",
      "Rutina con pausas reales: evitar sobrecargarse y practicar sin competir.",
      "Descanso fresco: dormir temprano, bajar intensidad mental y buscar ambientes tranquilos.",
      "Practica espiritual: meditacion del corazon, gratitud, mantras calmantes y respiracion refrescante.",
    ],
  },
  kapha: {
    label: "Kapha",
    traits: "Kapha suele ser estable, amoroso, paciente, fuerte y protector. Se asocia con tierra, agua, nutricion, resistencia y calma.",
    imbalance: "Cuando Kapha se desequilibra puede aparecer pesadez, apego, congestion, lentitud, exceso de sueño, desmotivacion o tendencia a acumular.",
    recommendations: [
      "Alimentacion liviana y estimulante: verduras, legumbres, especias, comidas simples y menos dulces, lacteos o exceso de harinas.",
      "Rutina activa: movimiento diario, orden y cambios pequenos que despierten energia.",
      "Descanso suficiente pero no excesivo: evitar siestas largas y levantarse temprano.",
      "Practica espiritual: canto, respiracion energizante, servicio consciente y meditacion activa.",
    ],
  },
};

const DOSHA_TEST = [
  {
    title: "Constitucion fisica",
    questions: [
      {
        text: "Mi cuerpo tiende a ser...",
        options: {
          vata: "Delgado, liviano, huesos marcados.",
          pitta: "Mediano, musculatura moderada.",
          kapha: "Grande, fuerte, tendencia a subir de peso.",
        },
      },
      {
        text: "Mi piel suele ser...",
        options: {
          vata: "Seca, fina o fria.",
          pitta: "Caliente, sensible o rojiza.",
          kapha: "Suave, gruesa o humeda.",
        },
      },
      {
        text: "Mi cabello suele ser...",
        options: {
          vata: "Seco, fino o quebradizo.",
          pitta: "Fino, claro, rojizo o con tendencia a caer.",
          kapha: "Abundante, grueso, fuerte o aceitoso.",
        },
      },
    ],
  },
  {
    title: "Digestion y metabolismo",
    questions: [
      {
        text: "Mi apetito normalmente es...",
        options: {
          vata: "Irregular, cambia mucho.",
          pitta: "Fuerte, me molesta saltear comidas.",
          kapha: "Lento o estable, puedo pasar horas sin comer.",
        },
      },
      {
        text: "Mi digestion tiende a ser...",
        options: {
          vata: "Variable, con gases o hinchazon.",
          pitta: "Rapida, con acidez o calor si me excedo.",
          kapha: "Pesada, lenta o con somnolencia despues de comer.",
        },
      },
      {
        text: "Con el peso corporal...",
        options: {
          vata: "Me cuesta subir o mantener peso.",
          pitta: "Subo o bajo con relativa facilidad.",
          kapha: "Subo con facilidad y bajo lentamente.",
        },
      },
    ],
  },
  {
    title: "Mente y emociones",
    questions: [
      {
        text: "Mi mente suele ser...",
        options: {
          vata: "Rapida, creativa, dispersa.",
          pitta: "Focalizada, analitica, intensa.",
          kapha: "Calma, constante, memoriosa.",
        },
      },
      {
        text: "Bajo presion tiendo a...",
        options: {
          vata: "Preocuparme, dudar o sentir miedo.",
          pitta: "Irritarme, controlar o criticar.",
          kapha: "Cerrarme, evitar o postergar.",
        },
      },
      {
        text: "Mi forma de aprender es...",
        options: {
          vata: "Capto rapido, pero puedo olvidar rapido.",
          pitta: "Comprendo ordenando y comparando.",
          kapha: "Aprendo lento, pero retengo mucho.",
        },
      },
    ],
  },
  {
    title: "Sueno y energia",
    questions: [
      {
        text: "Mi sueno suele ser...",
        options: {
          vata: "Liviano, interrumpido o variable.",
          pitta: "Moderado, pero puedo despertarme con calor o ideas.",
          kapha: "Profundo, largo o pesado.",
        },
      },
      {
        text: "Mi energia durante el dia es...",
        options: {
          vata: "En picos, sube y baja.",
          pitta: "Intensa y dirigida.",
          kapha: "Estable, pero tarda en arrancar.",
        },
      },
      {
        text: "Cuando me canso...",
        options: {
          vata: "Me pongo nervioso o inquieto.",
          pitta: "Me vuelvo impaciente.",
          kapha: "Me da pesadez o ganas de dormir.",
        },
      },
    ],
  },
  {
    title: "Habitos y comportamiento",
    questions: [
      {
        text: "Mi ritmo natural es...",
        options: {
          vata: "Rapido, cambiante, espontaneo.",
          pitta: "Organizado, productivo, exigente.",
          kapha: "Pausado, constante, tranquilo.",
        },
      },
      {
        text: "Frente a cambios...",
        options: {
          vata: "Me entusiasmo, pero me desordeno.",
          pitta: "Planifico y busco controlar.",
          kapha: "Prefiero estabilidad y me cuesta moverme.",
        },
      },
      {
        text: "Mi relacion con la rutina es...",
        options: {
          vata: "Me cuesta sostenerla.",
          pitta: "La uso para lograr objetivos.",
          kapha: "Me aferro a lo conocido.",
        },
      },
    ],
  },
  {
    title: "Estado actual / desequilibrio",
    questions: [
      {
        text: "Ultimamente noto mas...",
        options: {
          vata: "Ansiedad, frio, sequedad o insomnio.",
          pitta: "Calor, irritacion, acidez o enojo.",
          kapha: "Pesadez, congestion, apego o lentitud.",
        },
      },
      {
        text: "Mi cuerpo hoy pide...",
        options: {
          vata: "Calma, abrigo, aceite y estabilidad.",
          pitta: "Frescura, descanso y suavidad.",
          kapha: "Movimiento, liviandad y estimulo.",
        },
      },
      {
        text: "Mi practica espiritual necesita...",
        options: {
          vata: "Enraizar y aquietar la mente.",
          pitta: "Ablandar exigencia y abrir el corazon.",
          kapha: "Despertar energia y soltar comodidad.",
        },
      },
    ],
  },
];

const elements = {
  startButton: document.querySelector("#startButton"),
  viewSavedButton: document.querySelector("#viewSavedButton"),
  clearSavedTopButton: document.querySelector("#clearSavedTopButton"),
  savedNotice: document.querySelector("#savedNotice"),
  testShell: document.querySelector("#testShell"),
  doshaForm: document.querySelector("#doshaForm"),
  answeredCount: document.querySelector("#answeredCount"),
  totalCount: document.querySelector("#totalCount"),
  resultButton: document.querySelector("#resultButton"),
  resetButton: document.querySelector("#resetButton"),
  resultCard: document.querySelector("#resultCard"),
  resultTitle: document.querySelector("#resultTitle"),
  scoreGrid: document.querySelector("#scoreGrid"),
  traitsText: document.querySelector("#traitsText"),
  imbalanceText: document.querySelector("#imbalanceText"),
  recommendationsList: document.querySelector("#recommendationsList"),
  restartFromResultButton: document.querySelector("#restartFromResultButton"),
  clearSavedButton: document.querySelector("#clearSavedButton"),
};

let answers = {};
let flatQuestions = [];

init();

function init() {
  flatQuestions = flattenQuestions(DOSHA_TEST);
  elements.totalCount.textContent = flatQuestions.length;
  renderQuestions();
  bindEvents();
  updateSavedNotice();
}

// Convierte las secciones en una lista simple para calcular y validar.
function flattenQuestions(sections) {
  return sections.flatMap((section, sectionIndex) =>
    section.questions.map((question, questionIndex) => ({
      ...question,
      id: `s${sectionIndex}-q${questionIndex}`,
      sectionTitle: section.title,
      sectionIndex,
      questionIndex,
    })),
  );
}

function bindEvents() {
  elements.startButton.addEventListener("click", startTest);
  elements.viewSavedButton.addEventListener("click", showSavedResult);
  elements.clearSavedTopButton.addEventListener("click", clearSavedResult);
  elements.resultButton.addEventListener("click", showCurrentResult);
  elements.resetButton.addEventListener("click", resetTest);
  elements.restartFromResultButton.addEventListener("click", resetTest);
  elements.clearSavedButton.addEventListener("click", clearSavedResult);
  elements.doshaForm.addEventListener("change", handleAnswerChange);
}

function renderQuestions() {
  elements.doshaForm.innerHTML = DOSHA_TEST.map((section, sectionIndex) => {
    const questionsHtml = section.questions.map((question, questionIndex) => {
      const questionId = `s${sectionIndex}-q${questionIndex}`;
      return `
        <article class="question-card" role="radiogroup" aria-label="${question.text}">
          <div class="question-heading">
            <span>Pregunta ${questionIndex + 1}</span>
            <h4>${question.text}</h4>
          </div>
          <div class="option-grid">
            ${renderOption(questionId, "vata", question.options.vata)}
            ${renderOption(questionId, "pitta", question.options.pitta)}
            ${renderOption(questionId, "kapha", question.options.kapha)}
          </div>
        </article>
      `;
    }).join("");

    return `
      <div class="section-block">
        <h3 class="section-title"><span>${sectionIndex + 1}</span>${section.title}</h3>
        ${questionsHtml}
      </div>
    `;
  }).join("");
}

function renderOption(questionId, dosha, label) {
  return `
    <label class="option-card ${dosha}">
      <input type="radio" name="${questionId}" value="${dosha}" />
      <strong>${DOSHAS[dosha].label}</strong>
      <span>${label}</span>
      <small>Seleccionar</small>
    </label>
  `;
}

function handleAnswerChange(event) {
  const input = event.target;
  if (!input.matches("input[type='radio']")) return;
  answers[input.name] = input.value;
  updateProgress();
}

function startTest() {
  elements.testShell.classList.remove("hidden");
  elements.resultCard.classList.add("hidden");
  elements.testShell.scrollIntoView({ behavior: "smooth", block: "start" });
}

function updateProgress() {
  elements.answeredCount.textContent = Object.keys(answers).length;
}

function showCurrentResult() {
  if (Object.keys(answers).length < flatQuestions.length) {
    alert("Responde todas las preguntas antes de ver el resultado.");
    return;
  }

  const result = calculateResult(answers);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(result));
  renderResult(result);
  updateSavedNotice();
}

function showSavedResult() {
  const result = getSavedResult();
  if (!result) {
    alert("Todavia no hay un resultado guardado.");
    return;
  }
  renderResult(result);
}

function calculateResult(selectedAnswers) {
  const scores = { vata: 0, pitta: 0, kapha: 0 };
  Object.values(selectedAnswers).forEach((dosha) => {
    scores[dosha] += 1;
  });

  const constitution = getConstitution(scores);
  return {
    scores,
    constitution,
    savedAt: new Date().toISOString(),
  };
}

function getConstitution(scores) {
  const ordered = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const [first, second, third] = ordered;

  if (first[1] - third[1] <= 1) {
    return {
      type: "tridosha",
      label: "Tridosha",
      doshas: ["vata", "pitta", "kapha"],
    };
  }

  if (first[1] - second[1] <= 1) {
    return {
      type: "mixed",
      label: `${DOSHAS[first[0]].label}-${DOSHAS[second[0]].label}`,
      doshas: [first[0], second[0]],
    };
  }

  return {
    type: "single",
    label: DOSHAS[first[0]].label,
    doshas: [first[0]],
  };
}

function renderResult(result) {
  const { scores, constitution } = result;
  const profile = buildResultProfile(constitution);

  elements.resultTitle.textContent = constitution.type === "tridosha"
    ? "Resultado: Tridosha"
    : `Resultado: ${constitution.label}`;

  elements.scoreGrid.innerHTML = ["vata", "pitta", "kapha"].map((dosha) => `
    <div class="score-card ${dosha}">
      <strong>${DOSHAS[dosha].label}</strong>
      <span>${scores[dosha]}</span>
    </div>
  `).join("");

  elements.traitsText.textContent = profile.traits;
  elements.imbalanceText.textContent = profile.imbalance;
  elements.recommendationsList.innerHTML = profile.recommendations.map((item) => `<li>${item}</li>`).join("");

  elements.resultCard.classList.remove("hidden");
  elements.resultCard.scrollIntoView({ behavior: "smooth", block: "start" });
}

function buildResultProfile(constitution) {
  if (constitution.type === "tridosha") {
    return {
      traits: "Tus respuestas muestran una relacion bastante equilibrada entre Vata, Pitta y Kapha. Esto puede indicar adaptabilidad y una constitucion armonica.",
      imbalance: "Cuando hay equilibrio general, el cuidado principal es observar cual dosha se altera por temporada, alimentacion, estres o descanso.",
      recommendations: [
        "Mantener comidas simples, frescas y de temporada.",
        "Sostener una rutina moderada sin rigidez.",
        "Ajustar la practica segun el estado del dia: calma para Vata, frescura para Pitta, movimiento para Kapha.",
        "Registrar cambios de energia, digestion y sueno para detectar desequilibrios temprano.",
      ],
    };
  }

  if (constitution.type === "mixed") {
    const [first, second] = constitution.doshas;
    return {
      traits: `Tu biotipo mixto combina cualidades de ${DOSHAS[first].label} y ${DOSHAS[second].label}. ${DOSHAS[first].traits} ${DOSHAS[second].traits}`,
      imbalance: `Podrias alternar desequilibrios de ambos doshas. ${DOSHAS[first].imbalance} ${DOSHAS[second].imbalance}`,
      recommendations: [
        ...DOSHAS[first].recommendations.slice(0, 2),
        ...DOSHAS[second].recommendations.slice(0, 2),
      ],
    };
  }

  const main = constitution.doshas[0];
  return {
    traits: DOSHAS[main].traits,
    imbalance: DOSHAS[main].imbalance,
    recommendations: DOSHAS[main].recommendations,
  };
}

function resetTest() {
  answers = {};
  elements.doshaForm.reset();
  updateProgress();
  elements.resultCard.classList.add("hidden");
  elements.testShell.classList.remove("hidden");
  elements.testShell.scrollIntoView({ behavior: "smooth", block: "start" });
}

function clearSavedResult() {
  localStorage.removeItem(STORAGE_KEY);
  updateSavedNotice();
  alert("Resultado guardado borrado.");
}

function getSavedResult() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
  } catch {
    return null;
  }
}

function updateSavedNotice() {
  const hasSaved = Boolean(getSavedResult());
  elements.savedNotice.classList.toggle("hidden", !hasSaved);
}
