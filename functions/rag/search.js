const { scoreText } = require("./text");

function searchFragments(question, fragments, limit = 6) {
  return fragments
    .map((fragment) => ({
      ...fragment,
      score: scoreText(question, [
        fragment.title,
        fragment.type,
        fragment.category,
        fragment.text,
      ].join(" ")),
    }))
    .filter((fragment) => fragment.score >= 0.6)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

function uniqueSources(fragments) {
  const seen = new Set();
  return fragments.filter((fragment) => {
    const key = `${fragment.source}:${fragment.contentId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).map((fragment) => ({
    title: fragment.title,
    type: fragment.type,
    category: fragment.category,
    source: fragment.source,
    link: fragment.link,
  }));
}

module.exports = {
  searchFragments,
  uniqueSources,
};
