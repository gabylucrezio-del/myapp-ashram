const FALLBACK_MESSAGE = "Sobre este tema todavía no tengo suficiente conocimiento dentro del Ashram.";

function isMedicalRequest(value = "") {
  const text = String(value).toLowerCase();
  return ["diagnóstico", "diagnostico", "tratamiento", "medicamento", "recetar", "dosis", "curar"].some((term) => text.includes(term));
}

function buildAnswer({ question, fragments, userName = "querido caminante" }) {
  if (isMedicalRequest(question)) {
    return {
      answer: `${userName}, no puedo dar diagnósticos ni indicar tratamientos médicos. Puedo ayudarte a encontrar contenidos del Ashram que acompañen tu camino interior, pero para temas de salud es importante consultar a un profesional y a Gabriel Premananda.`,
      enough: true,
    };
  }

  if (!fragments.length) {
    return { answer: FALLBACK_MESSAGE, enough: false };
  }

  const excerpts = fragments.slice(0, 3).map((fragment) => summarize(fragment.text)).filter(Boolean);
  if (!excerpts.length) return { answer: FALLBACK_MESSAGE, enough: false };

  const answer = [
    `${userName}, dentro del conocimiento del Ashram encuentro una orientación clara: ${excerpts[0]}`,
    excerpts[1] ? `Al mirar otra fuente, aparece también esta idea: ${excerpts[1]}` : "",
    excerpts[2] ? `Unificando estas enseñanzas, la invitación es observar con calma, volver al cuerpo y llevar la comprensión a una práctica simple. ${excerpts[2]}` : "Unificando esta enseñanza, la invitación es observar con calma, volver al cuerpo y llevar la comprensión a una práctica simple.",
    "Te lo comparto como guía espiritual basada en el Ashram, no como diagnóstico ni reemplazo de una consulta profesional.",
  ].filter(Boolean).join("\n");

  return { answer, enough: true };
}

function summarize(value = "") {
  const clean = String(value).replace(/\s+/g, " ").trim();
  if (clean.length <= 260) return clean;
  return `${clean.slice(0, 257).replace(/\s+\S*$/, "")}...`;
}

module.exports = {
  FALLBACK_MESSAGE,
  buildAnswer,
  isMedicalRequest,
};
