import { documentIcons } from "./documentIcons";

export default function IconPicker({ value, onChange }) {
  return (
    <div className="icon-picker">
      {documentIcons.map(({ id, label, icon: Icon }) => (
        <button className={value === id ? "active" : ""} key={id} type="button" onClick={() => onChange(id)} title={label}>
          <Icon size={15} />
        </button>
      ))}
    </div>
  );
}
