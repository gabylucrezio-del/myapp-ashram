import { useDraggable } from "@dnd-kit/core";
import { paletteItems } from "../store/useBuilderStore.js";

export default function ComponentPalette() {
  const categories = ["Básicos", "Formularios", "Layout", "Navegación", "Datos", "Multimedia", "Diseño"];

  return (
    <aside className="flex min-h-0 flex-col rounded-3xl bg-white p-3 shadow-soft">
      <div className="mb-3 px-1 text-center">
        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Paleta</p>
      </div>

      <div className="grid gap-4 overflow-auto px-1 pb-1">
        {categories.map((category) => (
          <section key={category} className="grid gap-2">
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">{category}</p>
            <div className="grid grid-cols-2 gap-2">
              {paletteItems
                .filter((item) => item.category === category)
                .map((item) => (
                  <PaletteItem key={item.type} item={item} />
                ))}
            </div>
          </section>
        ))}
      </div>
    </aside>
  );
}

function PaletteItem({ item }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `palette-${item.type}`,
    data: { source: "palette", type: item.type },
  });

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  return (
    <button
      ref={setNodeRef}
      className={`group relative grid h-11 w-11 place-items-center rounded-2xl border border-slate-200 bg-white text-slate-700 shadow-panel transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 ${
        isDragging ? "opacity-40" : ""
      }`}
      type="button"
      title={item.label}
      aria-label={item.label}
      style={style}
      {...listeners}
      {...attributes}
    >
      <span className="text-xl leading-none" aria-hidden="true">{item.icon}</span>
      <span className="pointer-events-none absolute left-[calc(100%+10px)] top-1/2 z-40 hidden w-52 -translate-y-1/2 rounded-xl bg-slate-950 px-3 py-2 text-left shadow-soft group-hover:block">
        <span className="block text-xs font-bold text-white">{item.icon} {item.label}</span>
        {item.description ? <span className="mt-1 block text-[11px] font-normal leading-4 text-slate-300">{item.description}</span> : null}
      </span>
    </button>
  );
}
