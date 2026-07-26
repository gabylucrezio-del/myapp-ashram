import { ArrowLeft, Leaf } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "ashram-dosha-result";

const DOSHAS = {
  vata: {
    label: "Vata",
    traits: "Creativo, sensible, liviano, intuitivo y cambiante. Se asocia con movimiento, aire, rapidez mental y entusiasmo.",
    imbalance: "Puede aparecer ansiedad, insomnio, sequedad, gases, irregularidad digestiva, miedo o dificultad para sostener rutinas.",
    recommendations: [
      "Alimentacion tibia, nutritiva y regular.",
      "Rutina estable con horarios simples.",
      "Descanso profundo, abrigo y respiracion lenta.",
      "Meditacion enraizante, japa pausado y caminatas conscientes.",
    ],
  },
  pitta: {
    label: "Pitta",
    traits: "Intenso, claro, decidido, organizado y transformador. Se asocia con fuego, digestion, foco y liderazgo.",
    imbalance: "Puede aparecer irritabilidad, acidez, inflamacion, exceso de critica, calor corporal, impaciencia o agotamiento.",
    recommendations: [
      "Alimentacion refrescante y moderada.",
      "Pausas reales durante el dia.",
      "Dormir temprano y bajar la intensidad mental.",
      "Meditacion del corazon, gratitud y respiracion refrescante.",
    ],
  },
  kapha: {
    label: "Kapha",
    traits: "Estable, amoroso, paciente, fuerte y protector. Se asocia con tierra, agua, nutricion, resistencia y calma.",
    imbalance: "Puede aparecer pesadez, apego, congestion, lentitud, exceso de sueno, desmotivacion o tendencia a acumular.",
    recommendations: [
      "Alimentacion liviana y estimulante.",
      "Movimiento diario y cambios pequenos.",
      "Evitar siestas largas y levantarse temprano.",
      "Canto, respiracion energizante y servicio consciente.",
    ],
  },
};

const TEST_SECTIONS = [
  {
    title: "Constitucion fisica",
    questions: [
      {
        text: "Mi cuerpo tiende a ser...",
        options: {
          vata: "Delgado, liviano, huesos marcados, movimientos rapidos.",
          pitta: "Cuerpo mediano, musculatura moderada, piel caliente.",
          kapha: "Cuerpo fuerte, estructura grande, tendencia a subir de peso.",
        },
      },
      {
        text: "Mi piel suele ser...",
        options: {
          vata: "Seca, fina, fria o aspera.",
          pitta: "Caliente, sensible, rojiza o con tendencia a irritarse.",
          kapha: "Suave, humeda, gruesa o fresca.",
        },
      },
      {
        text: "Mi apetito suele ser...",
        options: {
          vata: "Irregular, cambia mucho segun el dia.",
          pitta: "Fuerte, claro, me molesta saltear comidas.",
          kapha: "Lento o estable, puedo pasar horas sin comer.",
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
        text: "Mi energia durante el dia es...",
        options: {
          vata: "En picos, sube y baja.",
          pitta: "Intensa y dirigida.",
          kapha: "Estable, pero tarda en arrancar.",
        },
      },
    ],
  },
  {
    title: "Estado actual",
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

export default function TestDosha({ onBack }) {
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const questions = useMemo(() => flattenQuestions(TEST_SECTIONS), []);
  const answeredCount = Object.keys(answers).length;

  useEffect(() => {
    const saved = readSavedResult();
    if (saved) setResult(saved);
  }, []);

  function choose(questionId, dosha) {
    setAnswers((current) => ({ ...current, [questionId]: dosha }));
  }

  function showResult() {
    if (answeredCount < questions.length) {
      window.alert("Responde todas las preguntas antes de ver el resultado.");
      return;
    }
    const nextResult = calculateResult(answers);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextResult));
    setResult(nextResult);
  }

  function resetTest() {
    setAnswers({});
    setResult(null);
  }

  function clearSaved() {
    localStorage.removeItem(STORAGE_KEY);
    setResult(null);
  }

  return (
    <section className="content-page dosha-module-page">
      <div className="dosha-module-title">
        <button className="back-icon" type="button" onClick={onBack} aria-label="Volver">
          <ArrowLeft size={22} />
        </button>
        <Leaf size={28} />
        <span>
          <h1>Test de Dosha</h1>
          <small>Una experiencia guiada para observar Vata, Pitta y Kapha.</small>
        </span>
      </div>

      <div className="dosha-module-hero">
        <p>Elegí la opción que más se parece a vos en cada pregunta. Cada tarjeta suma un punto al dosha elegido.</p>
        <strong>{answeredCount}/{questions.length}</strong>
      </div>

      <div className="dosha-question-list">
        {TEST_SECTIONS.map((section, sectionIndex) => (
          <div className="dosha-section-block" key={section.title}>
            <h2><span>{sectionIndex + 1}</span>{section.title}</h2>
            {section.questions.map((question, questionIndex) => {
              const id = `s${sectionIndex}-q${questionIndex}`;
              return (
                <article className="dosha-question-card" key={id}>
                  <div className="dosha-question-heading">
                    <span>Pregunta {questionIndex + 1}</span>
                    <h3>{question.text}</h3>
                  </div>
                  <div className="dosha-option-grid">
                    {["vata", "pitta", "kapha"].map((dosha) => {
                      const optionId = `${id}-${dosha}`;
                      return (
                        <div
                          className={`dosha-option-card ${dosha} ${answers[id] === dosha ? "selected" : ""}`}
                          key={dosha}
                        >
                          <input
                            id={optionId}
                            type="radio"
                            name={id}
                            value={dosha}
                            checked={answers[id] === dosha}
                            onChange={() => choose(id, dosha)}
                            aria-label={`Seleccionar ${DOSHAS[dosha].label}`}
                          />
                          <span className="dosha-option-content">
                            <strong>{DOSHAS[dosha].label}</strong>
                            <span>{question.options[dosha]}</span>
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </article>
              );
            })}
          </div>
        ))}
      </div>

      <div className="dosha-actions">
        <button className="primary" type="button" onClick={showResult}>Ver resultado</button>
        <button className="ghost compact" type="button" onClick={resetTest}>Reiniciar test</button>
        {result ? <button className="ghost compact" type="button" onClick={clearSaved}>Borrar resultado guardado</button> : null}
      </div>

      {result ? <DoshaResult result={result} /> : null}
    </section>
  );
}

function DoshaResult({ result }) {
  const profile = buildResultProfile(result.constitution);
  return (
    <section className="dosha-result-card">
      <p>Resultado</p>
      <h2>{result.constitution.label}</h2>
      <div className="dosha-score-grid">
        {["vata", "pitta", "kapha"].map((dosha) => (
          <div className={`dosha-score-card ${dosha}`} key={dosha}>
            <strong>{DOSHAS[dosha].label}</strong>
            <span>{result.scores[dosha]}</span>
          </div>
        ))}
      </div>
      <div className="dosha-result-text">
        <article>
          <h3>Caracteristicas principales</h3>
          <p>{profile.traits}</p>
        </article>
        <article>
          <h3>Posibles desequilibrios</h3>
          <p>{profile.imbalance}</p>
        </article>
        <article>
          <h3>Recomendaciones</h3>
          <ul>{profile.recommendations.map((item) => <li key={item}>{item}</li>)}</ul>
        </article>
      </div>
    </section>
  );
}

function flattenQuestions(sections) {
  return sections.flatMap((section, sectionIndex) => section.questions.map((question, questionIndex) => ({
    ...question,
    id: `s${sectionIndex}-q${questionIndex}`,
  })));
}

function calculateResult(answers) {
  const scores = { vata: 0, pitta: 0, kapha: 0 };
  Object.values(answers).forEach((dosha) => {
    scores[dosha] += 1;
  });
  return { scores, constitution: getConstitution(scores), savedAt: new Date().toISOString() };
}

function getConstitution(scores) {
  const ordered = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const [first, second, third] = ordered;
  if (first[1] - third[1] <= 1) return { label: "Tridosha", type: "tridosha", doshas: ["vata", "pitta", "kapha"] };
  if (first[1] - second[1] <= 1) return { label: `${DOSHAS[first[0]].label}-${DOSHAS[second[0]].label}`, type: "mixed", doshas: [first[0], second[0]] };
  return { label: DOSHAS[first[0]].label, type: "single", doshas: [first[0]] };
}

function buildResultProfile(constitution) {
  if (constitution.type === "tridosha") {
    return {
      traits: "Tus respuestas muestran una relacion equilibrada entre Vata, Pitta y Kapha.",
      imbalance: "Observa cual dosha se altera por estres, clima, alimentacion o descanso.",
      recommendations: ["Comidas simples y de temporada.", "Rutina moderada sin rigidez.", "Practica ajustada al estado del dia."],
    };
  }
  if (constitution.type === "mixed") {
    const [first, second] = constitution.doshas;
    return {
      traits: `${DOSHAS[first].traits} ${DOSHAS[second].traits}`,
      imbalance: `${DOSHAS[first].imbalance} ${DOSHAS[second].imbalance}`,
      recommendations: [...DOSHAS[first].recommendations.slice(0, 2), ...DOSHAS[second].recommendations.slice(0, 2)],
    };
  }
  return DOSHAS[constitution.doshas[0]];
}

function readSavedResult() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
  } catch {
    return null;
  }
}
