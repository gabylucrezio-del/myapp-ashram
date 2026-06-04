export default function CoverSelector({ value, onChange }) {
  function loadLocal(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => onChange(reader.result || "");
    reader.readAsDataURL(file);
  }

  return (
    <div className="cover-selector">
      <label>Portada por URL
        <input value={value || ""} onChange={(event) => onChange(event.target.value)} placeholder="https://..." />
      </label>
      <label>Imagen local
        <input type="file" accept="image/*" onChange={(event) => loadLocal(event.target.files?.[0])} />
      </label>
      <label>Biblioteca
        <select value={value || ""} onChange={(event) => onChange(event.target.value)}>
          <option value="">Sin portada</option>
          <option value="/LogoReal.png">Logo Ashram</option>
          <option value="/fondo_app.webp">Fondo Ashram</option>
          <option value="/satsang.webp">Satsang</option>
        </select>
      </label>
      {value ? <img src={value} alt="" /> : null}
    </div>
  );
}
