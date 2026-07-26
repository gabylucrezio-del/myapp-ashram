import { useDraggable } from "@dnd-kit/core";
import * as LucideIcons from "lucide-react";
import { memo, useMemo, useRef, useState } from "react";
import { getThemedProps, useBuilderStore, VIEWPORTS } from "../store/useBuilderStore.js";

function RenderedComponent({ component }) {
  const variables = useBuilderStore((state) => state.variables);
  const screens = useBuilderStore((state) => state.screens);
  const activeScreenId = useBuilderStore((state) => state.activeScreenId);
  const variableValues = useMemo(() => {
    const screen = screens.find((item) => item.id === activeScreenId);
    const allVariables = [
      ...(variables?.global || []),
      ...(screen?.variables || []),
      ...(variables?.local || []),
    ];
    return Object.fromEntries(allVariables.map((variable) => [variable.name, variable.initialValue]));
  }, [activeScreenId, screens, variables]);
  const selectedId = useBuilderStore((state) => state.selectedId);
  const setSelectedId = useBuilderStore((state) => state.setSelectedId);
  const setMovingId = useBuilderStore((state) => state.setMovingId);
  const moveComponent = useBuilderStore((state) => state.moveComponent);
  const updateComponent = useBuilderStore((state) => state.updateComponent);
  const deleteComponent = useBuilderStore((state) => state.deleteComponent);
  const duplicateComponent = useBuilderStore((state) => state.duplicateComponent);
  const canvasSettings = useBuilderStore((state) => state.canvasSettings);
  const viewport = useBuilderStore((state) => state.viewport);
  const theme = useBuilderStore((state) => state.theme);
  const [resizeFrame, setResizeFrame] = useState(null);
  const themedComponent = useMemo(() => ({ ...component, props: getThemedProps(component, theme) }), [component, theme]);
  const props = resizeFrame ? { ...themedComponent.props, ...resizeFrame } : themedComponent.props;
  const isSelected = selectedId === component.id;
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `canvas-${component.id}`,
    data: { source: "canvas", id: component.id },
    disabled: props.locked,
  });

  const style = {
    left: props.x,
    top: props.y,
    width: props.width,
    height: props.height,
    color: props.color,
    fontSize: props.fontSize,
    fontFamily: theme?.typography?.fontFamily || "Inter",
    fontWeight: theme?.typography?.weight || 400,
    backgroundColor: props.backgroundColor,
    borderRadius: props.borderRadius,
    zIndex: props.zIndex,
    boxShadow: shadowForTheme(theme),
    opacity: props.hidden || !evaluateCondition(props.visibleIf, variableValues) ? 0.28 : 1,
    transform: transform && !resizeFrame ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    transition: isDragging || resizeFrame ? "none" : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      className={`absolute select-none outline outline-2 transition ${
        isSelected ? "outline-blue-500 ring-4 ring-blue-200/60" : "outline-transparent hover:outline-blue-200"
      } ${isDragging || resizeFrame ? "z-[80] opacity-85 shadow-soft outline-blue-400 ring-4 ring-blue-100/70" : ""} ${props.locked ? "cursor-not-allowed" : isDragging ? "cursor-grabbing" : "cursor-grab"}`}
      style={style}
      tabIndex={0}
      onMouseDown={(event) => {
        event.stopPropagation();
        setSelectedId(component.id);
      }}
      onKeyDown={(event) => {
        if (!isSelected) return;
        const step = canvasSettings.snapToGrid ? canvasSettings.gridSize : event.shiftKey ? 10 : 1;
        const keyMap = {
          ArrowUp: { x: 0, y: -step },
          ArrowDown: { x: 0, y: step },
          ArrowLeft: { x: -step, y: 0 },
          ArrowRight: { x: step, y: 0 },
        };
        if (keyMap[event.key]) {
          event.preventDefault();
          moveComponent(component.id, keyMap[event.key]);
        }
      }}
      onPointerDown={(event) => {
        setMovingId(component.id);
        listeners?.onPointerDown?.(event);
      }}
      onPointerUp={() => setMovingId(null)}
      {...attributes}
    >
      {isSelected ? (
        <>
          <div className="absolute -top-7 left-0 z-40 flex items-center gap-2 rounded-xl bg-blue-600 px-2 py-1 text-[11px] font-black text-white shadow-panel">
            {component.name}
            {props.locked ? <LucideIcons.Lock size={12} /> : null}
          </div>
          <div className="absolute -right-2 -top-10 z-40 flex items-center gap-1">
            <button
              className="grid h-8 w-8 place-items-center rounded-xl bg-white text-slate-700 shadow-panel hover:text-blue-700"
              type="button"
              title="Duplicar"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation();
                duplicateComponent(component.id);
              }}
            >
              <LucideIcons.Copy size={15} />
            </button>
            <button
              className="grid h-8 w-8 place-items-center rounded-xl bg-white text-rose-600 shadow-panel hover:bg-rose-50"
              type="button"
              title="Eliminar"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation();
                deleteComponent(component.id);
              }}
            >
              <LucideIcons.Trash2 size={15} />
            </button>
          </div>
          <div className="absolute -bottom-7 left-0 z-40 rounded-xl bg-slate-950 px-2 py-1 text-[11px] font-bold text-white shadow-panel">
            x {props.x} y {props.y} / {props.width} x {props.height}
          </div>
          {!props.locked ? (
            <>
              {["n", "e", "s", "w", "nw", "ne", "sw", "se"].map((position) => (
                <ResizeHandle
                  key={position}
                  position={position}
                  component={component}
                  screen={screens.find((item) => item.id === activeScreenId) || screens[0]}
                  viewport={VIEWPORTS[viewport]}
                  canvasSettings={canvasSettings}
                  onFrame={setResizeFrame}
                  onCommit={(patch) => updateComponent(component.id, patch)}
                  onResizeStart={() => setMovingId(component.id)}
                  onResizeEnd={() => setMovingId(null)}
                />
              ))}
            </>
          ) : null}
        </>
      ) : null}
      <ComponentView component={themedComponent} variableValues={variableValues} />
    </div>
  );
}

function ResizeHandle({ position, component, screen, viewport, canvasSettings, onFrame, onCommit, onResizeStart, onResizeEnd }) {
  const frameRef = useRef(null);
  const rafRef = useRef(null);
  const positionClass = {
    n: "left-1/2 -top-1.5 h-3 w-7 -translate-x-1/2 cursor-ns-resize rounded-full",
    e: "-right-1.5 top-1/2 h-7 w-3 -translate-y-1/2 cursor-ew-resize rounded-full",
    s: "bottom-[-6px] left-1/2 h-3 w-7 -translate-x-1/2 cursor-ns-resize rounded-full",
    w: "-left-1.5 top-1/2 h-7 w-3 -translate-y-1/2 cursor-ew-resize rounded-full",
    nw: "-left-1.5 -top-1.5 h-3 w-3 cursor-nwse-resize rounded-full",
    ne: "-right-1.5 -top-1.5 h-3 w-3 cursor-nesw-resize rounded-full",
    sw: "-bottom-1.5 -left-1.5 h-3 w-3 cursor-nesw-resize rounded-full",
    se: "-bottom-1.5 -right-1.5 h-3 w-3 cursor-nwse-resize rounded-full",
  }[position];

  function startResize(event) {
    event.stopPropagation();
    event.preventDefault();

    const startX = event.clientX;
    const startY = event.clientY;
    const start = { ...component.props };
    const scale = getCanvasScale(screen, viewport);
    onResizeStart();

    function onMove(moveEvent) {
      const dx = (moveEvent.clientX - startX) / scale.x;
      const dy = (moveEvent.clientY - startY) / scale.y;
      const patch = { x: start.x, y: start.y, width: start.width, height: start.height };

      if (position.includes("e")) patch.width = start.width + dx;
      if (position.includes("s")) patch.height = start.height + dy;
      if (position.includes("w")) {
        patch.width = start.width - dx;
        patch.x = start.x + dx;
      }
      if (position.includes("n")) {
        patch.height = start.height - dy;
        patch.y = start.y + dy;
      }

      const next = clampAndSnapRect(patch, screen, viewport, canvasSettings);
      frameRef.current = next;
      if (!rafRef.current) {
        rafRef.current = window.requestAnimationFrame(() => {
          rafRef.current = null;
          onFrame(frameRef.current);
        });
      }
    }

    function onUp() {
      if (rafRef.current) window.cancelAnimationFrame(rafRef.current);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      if (frameRef.current) onCommit(frameRef.current);
      onFrame(null);
      onResizeEnd();
      frameRef.current = null;
    }

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  return (
    <span
      className={`absolute z-50 border-2 border-white bg-blue-600 shadow-panel ${positionClass}`}
      onPointerDown={startResize}
    />
  );
}

function ComponentView({ component, variableValues }) {
  const baseClass = "flex h-full w-full items-center overflow-hidden px-4";
  const text = interpolate(component.props.formula || component.props.text, variableValues);

  if (component.type === "appbar") {
    return (
      <div className={`${baseClass} justify-between font-black shadow-panel`}>
        <span>{text}</span>
        <LucideIcons.Search size={20} />
      </div>
    );
  }

  if (component.type === "drawer") {
    return (
      <div className={`${baseClass} flex-col items-start justify-start gap-4 border border-slate-200 py-5 font-bold shadow-panel`}>
        <div className="flex items-center gap-2">
          <LucideIcons.Menu size={20} />
          <span>{text}</span>
        </div>
        <span className="text-sm text-slate-500">Inicio</span>
        <span className="text-sm text-slate-500">Perfil</span>
        <span className="text-sm text-slate-500">Ajustes</span>
      </div>
    );
  }

  if (component.type === "list") {
    return (
      <div className={`${baseClass} flex-col items-stretch justify-center gap-2 border border-slate-200 py-3 shadow-sm`}>
        {text.split("\n").slice(0, 4).map((item, index) => (
          <div key={`${item}-${index}`} className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-sm font-semibold">
            <LucideIcons.List size={15} />
            {item}
          </div>
        ))}
      </div>
    );
  }

  if (component.type === "textarea") return <div className={`${baseClass} items-start border border-slate-200 bg-white py-3 text-slate-500 shadow-sm`}>{text}</div>;
  if (component.type === "badge" || component.type === "chip") return <div className={`${baseClass} justify-center text-xs font-medium shadow-sm`}>{text}</div>;
  if (component.type === "spacer") return <div className="h-full w-full rounded-xl border border-dashed border-slate-200 bg-slate-50/60" />;
  if (component.type === "searchInput") return <div className={`${baseClass} gap-2 border border-slate-200 bg-white text-slate-500 shadow-sm`}><LucideIcons.Search size={16} />{text}</div>;
  if (component.type === "datePicker") return <div className={`${baseClass} gap-2 border border-slate-200 bg-white text-slate-600 shadow-sm`}><LucideIcons.CalendarDays size={16} />{component.props.value || text}</div>;
  if (component.type === "timePicker") return <div className={`${baseClass} gap-2 border border-slate-200 bg-white text-slate-600 shadow-sm`}><LucideIcons.Clock size={16} />{component.props.value || text}</div>;
  if (component.type === "radioGroup") return (
    <div className={`${baseClass} flex-col items-start justify-center gap-2`}>
      {optionsFromProps(component.props).slice(0, 3).map((item, index) => <span key={item} className="flex items-center gap-2 text-sm"><LucideIcons.CircleDot size={15} className={index === 0 ? "text-blue-600" : "text-slate-300"} />{item}</span>)}
    </div>
  );
  if (component.type === "slider") return <div className={`${baseClass} gap-3`}><span className="h-2 flex-1 rounded-full bg-slate-200"><span className="block h-2 rounded-full bg-blue-600" style={{ width: `${percent(component.props.value, component.props.max)}%` }} /></span><span className="text-xs">{component.props.value}</span></div>;
  if (component.type === "filePicker" || component.type === "imagePicker") return <div className={`${baseClass} flex-col justify-center gap-2 border border-blue-200 text-center font-semibold`}><LucideIcons.Upload size={24} /><span>{text}</span></div>;
  if (["dataTable", "dynamicList", "detailView", "emptyState", "pagination"].includes(component.type)) return <DataPreview component={component} text={text} />;
  if (["audioPlayer", "videoPlayer", "pdfViewer", "webView", "qrCode", "qrScanner"].includes(component.type)) return <MediaPreview component={component} text={text} />;
  if (["bottomNavigation", "tabs", "breadcrumb", "floatingActionButton"].includes(component.type)) return <NavigationPreview component={component} text={text} />;
  if (component.type === "gradientBox") return <div className={`${baseClass} items-start p-4 font-semibold`} style={{ background: `linear-gradient(135deg, ${component.props.backgroundColor}, ${component.props.gradientTo || "#14b8a6"})` }}>{text}</div>;
  if (component.type === "progressBar") return <div className={`${baseClass} p-0`}><span className="h-full w-full rounded-full bg-slate-200"><span className="block h-full rounded-full bg-current" style={{ width: `${percent(component.props.value, component.props.max)}%` }} /></span></div>;
  if (component.type === "circularProgress") return <div className={`${baseClass} justify-center p-0`}><LucideIcons.CircleGauge size={Math.min(component.props.width || 72, component.props.height || 72)} /><span className="absolute text-xs font-medium">{component.props.value}%</span></div>;
  if (component.type === "accordion") return <div className={`${baseClass} flex-col items-stretch justify-start border border-slate-200 py-3`}><strong className="font-medium">{text.split("\n")[0]}</strong><span className="mt-2 text-sm text-slate-500">{text.split("\n").slice(1).join(" ")}</span></div>;
  if (component.type === "stepper") return <div className={`${baseClass} justify-around gap-2`}>{optionsFromText(text).slice(0, 4).map((item, index) => <span key={item} className="grid place-items-center gap-1 text-[10px]"><span className={`grid h-6 w-6 place-items-center rounded-full ${index === 0 ? "bg-blue-600 text-white" : "bg-slate-200 text-slate-500"}`}>{index + 1}</span>{item}</span>)}</div>;
  if (component.type === "modal" || component.type === "alertDialog") return <div className={`${baseClass} flex-col items-start justify-center border border-slate-200 p-4 shadow-panel`}><strong className="font-medium">{component.props.title || component.name}</strong><span className="mt-2 text-sm text-slate-500">{text}</span></div>;

  if (component.type === "checkbox") {
    return (
      <div className={`${baseClass} gap-3 font-semibold`}>
        <span className="grid h-5 w-5 place-items-center rounded-md border-2 border-blue-600 bg-blue-600 text-xs text-white">v</span>
        {text}
      </div>
    );
  }

  if (component.type === "switch") {
    return (
      <div className={`${baseClass} justify-between gap-3 font-semibold`}>
        <span>{text}</span>
        <ModernSwitch checked color={component.props.onColor || "#2563eb"} offColor={component.props.offColor || "#cbd5e1"} size={component.props.switchSize} />
      </div>
    );
  }

  if (component.type === "select") {
    return (
      <div className={`${baseClass} justify-between border border-slate-200 bg-white font-semibold text-slate-500 shadow-sm`}>
        <span>{text}</span>
        <span>v</span>
      </div>
    );
  }

  if (component.type === "divider") {
    return <div className="h-full w-full" />;
  }

  if (component.type === "avatar") {
    return <div className={`${baseClass} justify-center p-0 text-center font-black`}>{text.slice(0, 2).toUpperCase()}</div>;
  }

  if (component.type === "icon") {
    return (
      <div className={`${baseClass} justify-center p-0`}>
        <DynamicIcon name={component.props.iconName || component.props.text || "Star"} size={Math.max(18, Number(component.props.fontSize) || 28)} />
      </div>
    );
  }

  if (component.type === "video") {
    return (
      <div className={`${baseClass} flex-col justify-center gap-2 text-center font-black shadow-panel`}>
        <span className="grid h-12 w-12 place-items-center rounded-full bg-white/15">
          <LucideIcons.Play size={24} fill="currentColor" />
        </span>
        {text}
      </div>
    );
  }

  if (component.type === "button") {
    return <button className={`${baseClass} justify-center font-bold shadow-panel`} type="button">{text}</button>;
  }

  if (component.type === "input") {
    return <div className={`${baseClass} border border-slate-200 bg-white text-slate-500 shadow-sm`}>{text}</div>;
  }

  if (component.type === "image") {
    return (
      <div className={`${baseClass} flex-col justify-center gap-2 border border-blue-200 text-center font-bold`}>
        <LucideIcons.Image size={30} />
        <span>{text}</span>
      </div>
    );
  }

  if (component.type === "container") {
    return <div className={`${baseClass} items-start border border-slate-200 pt-4 font-semibold`}>{text}</div>;
  }

  if (component.type === "card") {
    return <div className={`${baseClass} items-start border border-slate-200 p-5 font-black shadow-panel`}>{text}</div>;
  }

  return <div className={`${baseClass} font-black`}>{text}</div>;
}

function DynamicIcon({ name, size }) {
  const normalized = String(name || "Star").replace(/(^\w|-\w)/g, (part) => part.replace("-", "").toUpperCase());
  const Icon = LucideIcons[normalized] || LucideIcons.Star;
  return <Icon size={size} />;
}

function ModernSwitch({ checked, color = "#2563eb", offColor = "#cbd5e1", size = "medium" }) {
  const metrics = {
    small: { w: 34, h: 20, t: 16 },
    medium: { w: 44, h: 26, t: 20 },
    large: { w: 56, h: 32, t: 26 },
  }[size] || { w: 44, h: 26, t: 20 };
  return (
    <span className="relative inline-flex shrink-0 rounded-full transition-colors duration-200" style={{ width: metrics.w, height: metrics.h, backgroundColor: checked ? color : offColor }}>
      <span className="absolute top-1 rounded-full bg-white shadow transition-transform duration-200" style={{ width: metrics.t, height: metrics.t, left: 4, transform: checked ? `translateX(${metrics.w - metrics.t - 8}px)` : "translateX(0)" }} />
    </span>
  );
}

function DataPreview({ component, text }) {
  const rows = optionsFromText(text || "Gabriel\nAna\nJuan");
  if (component.type === "dataTable") {
    const columns = optionsFromProps({ options: component.props.columns || "nombre\ndosha" }).slice(0, 3);
    return <div className="h-full w-full overflow-hidden border border-slate-200 bg-white text-xs"><div className="grid bg-slate-100 font-medium" style={{ gridTemplateColumns: `repeat(${columns.length || 1}, 1fr)` }}>{columns.map((col) => <span key={col} className="border-b border-slate-200 p-2">{col}</span>)}</div>{rows.slice(0, 3).map((row) => <div key={row} className="border-b border-slate-100 p-2">{row}</div>)}</div>;
  }
  if (component.type === "emptyState") return <div className="grid h-full w-full place-items-center text-center text-sm text-slate-500"><LucideIcons.Inbox size={28} />{text}</div>;
  if (component.type === "pagination") return <div className="flex h-full w-full items-center justify-center gap-3 text-sm font-medium"><LucideIcons.ChevronLeft size={16} />{component.props.value || 1} / {component.props.max || 5}<LucideIcons.ChevronRight size={16} /></div>;
  return <div className="grid h-full w-full gap-2 overflow-hidden border border-slate-200 bg-white p-3">{rows.slice(0, 4).map((row) => <div key={row} className="rounded-xl bg-slate-50 px-3 py-2 text-sm">{row}</div>)}</div>;
}

function MediaPreview({ component, text }) {
  const iconMap = { audioPlayer: LucideIcons.AudioLines, videoPlayer: LucideIcons.PlayCircle, pdfViewer: LucideIcons.FileText, webView: LucideIcons.Globe, qrCode: LucideIcons.QrCode, qrScanner: LucideIcons.ScanQrCode };
  const Icon = iconMap[component.type] || LucideIcons.File;
  return <div className="flex h-full w-full flex-col items-center justify-center gap-2 border border-slate-200 bg-slate-50 text-center text-sm font-medium"><Icon size={30} />{component.type === "qrCode" ? component.props.value : text}</div>;
}

function NavigationPreview({ component, text }) {
  if (component.type === "floatingActionButton") return <div className="grid h-full w-full place-items-center rounded-full font-medium shadow-panel"><DynamicIcon name={component.props.iconName || "Plus"} size={24} /></div>;
  const items = optionsFromProps({ options: component.props.items || component.props.tabs || text }).slice(0, 4);
  return <div className="flex h-full w-full items-center justify-around gap-1 px-2 text-xs font-medium">{items.map((item, index) => <span key={item} className={index === Number(component.props.selectedIndex || component.props.activeTab || 0) ? "text-blue-600" : "text-slate-500"}>{item}</span>)}</div>;
}

function optionsFromProps(props = {}) {
  return optionsFromText(props.options || props.items || props.tabs || props.text || "");
}

function optionsFromText(value) {
  return String(value || "").split(/\n|,/).map((item) => item.trim()).filter(Boolean);
}

function percent(value, max = 100) {
  const top = Number(max) || 100;
  return Math.max(0, Math.min(100, ((Number(value) || 0) / top) * 100));
}

function interpolate(value, variables) {
  return String(value || "").replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key) => variables[key] ?? "");
}

function getCanvasScale(screen, viewport) {
  const node = document.querySelector("[data-ganflow-canvas='true']");
  const width = screen?.settings?.width || viewport.width;
  const height = screen?.settings?.height || viewport.height;
  if (!node) return { x: 1, y: 1 };
  const rect = node.getBoundingClientRect();
  return {
    x: rect.width / width || 1,
    y: rect.height / height || 1,
  };
}

function clampAndSnapRect(rect, screen, viewport, canvasSettings) {
  const screenWidth = screen?.settings?.width || viewport.width;
  const screenHeight = screen?.settings?.height || viewport.height;
  const topInset = screen?.settings?.appBar?.enabled ? Number(screen.settings.appBar.height) || 0 : 0;
  let next = {
    x: rect.x,
    y: rect.y,
    width: Math.max(20, rect.width),
    height: Math.max(12, rect.height),
  };

  if (canvasSettings?.snapToGrid) {
    const size = Number(canvasSettings.gridSize) || 8;
    next = {
      x: Math.round(next.x / size) * size,
      y: Math.round(next.y / size) * size,
      width: Math.max(size, Math.round(next.width / size) * size),
      height: Math.max(size, Math.round(next.height / size) * size),
    };
  } else {
    next = {
      x: Math.round(next.x),
      y: Math.round(next.y),
      width: Math.round(next.width),
      height: Math.round(next.height),
    };
  }

  next.width = Math.min(next.width, screenWidth);
  next.height = Math.min(next.height, screenHeight);
  next.x = Math.min(Math.max(0, next.x), Math.max(0, screenWidth - next.width));
  next.y = Math.min(Math.max(topInset, next.y), Math.max(topInset, screenHeight - next.height));
  return next;
}

function evaluateCondition(value, variables) {
  if (!value) return true;
  const interpolated = interpolate(value, variables).trim();
  if (["false", "0", "no"].includes(interpolated.toLowerCase())) return false;
  return true;
}

function shadowForTheme(theme) {
  if (theme?.effects?.shadow === "none") return "none";
  if (theme?.effects?.shadow === "medium") return "0 16px 35px rgba(15, 23, 42, 0.16)";
  return "0 10px 24px rgba(15, 23, 42, 0.10)";
}

export default memo(RenderedComponent);
