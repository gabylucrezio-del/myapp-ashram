const colors = [
  { id: "orange", label: "Naranja", value: "#d9822b" },
  { id: "yellow", label: "Amarillo", value: "#d9a51f" },
  { id: "green", label: "Verde", value: "#2f7d57" },
  { id: "blue", label: "Azul", value: "#2f6f9f" },
  { id: "violet", label: "Violeta", value: "#4a324c" },
  { id: "red", label: "Rojo suave", value: "#a85f64" },
  { id: "brown", label: "Marron", value: "#8a5a18" },
  { id: "gold", label: "Dorado", value: "#c69a2d" },
];

export default function ColorPicker({ value, onChange }) {
  return (
    <div className="icon-color-picker">
      {colors.map((color) => (
        <button
          className={value === color.value ? "active" : ""}
          key={color.id}
          type="button"
          onClick={() => onChange(color.value)}
          style={{ "--icon-color": color.value }}
          title={color.label}
        />
      ))}
      <input type="color" value={value || "#d9a51f"} onChange={(event) => onChange(event.target.value)} title="Color personalizado" />
    </div>
  );
}
