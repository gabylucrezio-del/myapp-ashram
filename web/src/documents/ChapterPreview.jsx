export default function ChapterPreview({ chapters }) {
  return (
    <section className="chapter-preview">
      <strong>Capitulos detectados</strong>
      {chapters.length === 0 ? <p className="empty-state">No se detectaron capitulos.</p> : null}
      <ol>
        {chapters.map((chapter, index) => (
          <li key={`${chapter.title}-${index}`}>
            <span>{chapter.title}</span>
            {chapter.subtitles?.length ? <small>{chapter.subtitles.length} subtitulos</small> : null}
          </li>
        ))}
      </ol>
    </section>
  );
}
