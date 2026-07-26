import { useDroppable } from "@dnd-kit/core";
import { Maximize2, Minus, Plus, RotateCcw } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import RenderedComponent from "./RenderedComponent.jsx";
import { getLayoutComponents, getLayoutSize, useBuilderStore } from "../store/useBuilderStore.js";

const snapSizes = [4, 8, 10, 16];

export default function Canvas({ dragFrame = null }) {
  const { setNodeRef, isOver } = useDroppable({ id: "canvas" });
  const viewportRef = useRef(null);
  const [panning, setPanning] = useState(null);
  const [touchGesture, setTouchGesture] = useState(null);
  const viewport = useBuilderStore((state) => state.viewport);
  const canvasSettings = useBuilderStore((state) => state.canvasSettings);
  const setCanvasSetting = useBuilderStore((state) => state.setCanvasSetting);
  const copyLayout = useBuilderStore((state) => state.copyLayout);
  const movingId = useBuilderStore((state) => state.movingId);
  const theme = useBuilderStore((state) => state.theme);
  const screens = useBuilderStore((state) => state.screens);
  const activeScreenId = useBuilderStore((state) => state.activeScreenId);
  const activeScreen = useMemo(() => {
    const screen = screens.find((item) => item.id === activeScreenId);
    return screen || screens[0];
  }, [activeScreenId, screens]);
  const components = getLayoutComponents(activeScreen, viewport);
  const setSelectedId = useBuilderStore((state) => state.setSelectedId);
  const size = getLayoutSize(activeScreen, viewport);
  const appBar = activeScreen?.settings?.appBar;
  const topInset = appBar?.enabled ? Number(appBar.height) || 0 : 0;
  const zoom = Number(canvasSettings.designZoom) || 1;
  const pan = canvasSettings.designPan || { x: 0, y: 0 };
  const guideState = useMemo(() => {
    if (!dragFrame) return null;
    return calculateGuides(dragFrame, components, size);
  }, [components, dragFrame, size]);

  function updateZoom(nextZoom, anchor = null) {
    const clamped = Math.min(2.5, Math.max(0.25, nextZoom));
    if (!anchor || !viewportRef.current) {
      setCanvasSetting("designZoom", clamped);
      return;
    }
    const rect = viewportRef.current.getBoundingClientRect();
    const base = { x: rect.width / 2 - size.width / 2, y: rect.height / 2 - size.height / 2 };
    const world = {
      x: (anchor.x - rect.left - base.x - pan.x) / zoom,
      y: (anchor.y - rect.top - base.y - pan.y) / zoom,
    };
    setCanvasSetting("designZoom", clamped);
    setCanvasSetting("designPan", {
      x: anchor.x - rect.left - base.x - world.x * clamped,
      y: anchor.y - rect.top - base.y - world.y * clamped,
    });
  }

  function resetZoom() {
    setCanvasSetting("designZoom", 1);
    setCanvasSetting("designPan", { x: 0, y: 0 });
  }

  function fitToScreen() {
    if (!viewportRef.current) return;
    const rect = viewportRef.current.getBoundingClientRect();
    const nextZoom = Math.min(1.4, Math.max(0.25, Math.min((rect.width - 96) / size.width, (rect.height - 96) / size.height)));
    setCanvasSetting("designZoom", nextZoom);
    setCanvasSetting("designPan", {
      x: (size.width * (1 - nextZoom)) / 2,
      y: (size.height * (1 - nextZoom)) / 2,
    });
  }

  function handlePointerMove(event) {
    if (!panning) return;
    setCanvasSetting("designPan", {
      x: panning.startPan.x + event.clientX - panning.startX,
      y: panning.startPan.y + event.clientY - panning.startY,
    });
  }

  function handleTouchStart(event) {
    if (event.touches.length !== 2) return;
    const gesture = getTouchGesture(event.touches);
    setTouchGesture({ ...gesture, startPan: pan, startZoom: zoom });
  }

  function handleTouchMove(event) {
    if (!touchGesture || event.touches.length !== 2) return;
    event.preventDefault();
    const next = getTouchGesture(event.touches);
    setCanvasSetting("designZoom", Math.min(2.5, Math.max(0.25, touchGesture.startZoom * (next.distance / touchGesture.distance))));
    setCanvasSetting("designPan", {
      x: touchGesture.startPan.x + next.center.x - touchGesture.center.x,
      y: touchGesture.startPan.y + next.center.y - touchGesture.center.y,
    });
  }

  return (
    <section className="min-w-0 overflow-hidden rounded-2xl bg-white p-3 shadow-soft">
      <div className="mb-2 flex items-center justify-between">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400">Canvas</p>
          <h2 className="text-sm font-medium">
            {size.label} <span className="text-xs font-normal text-slate-400">{size.width} x {size.height}</span>
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <ToggleButton active={canvasSettings.gridVisible} onClick={() => setCanvasSetting("gridVisible", !canvasSettings.gridVisible)}>
            Grilla
          </ToggleButton>
          <ToggleButton active={canvasSettings.snapToGrid} onClick={() => setCanvasSetting("snapToGrid", !canvasSettings.snapToGrid)}>
            Snap
          </ToggleButton>
          <select
            className="h-7 rounded-full border border-slate-200 bg-slate-100 px-2 text-xs font-bold text-slate-500 outline-none transition focus:border-blue-400 disabled:opacity-40"
            value={canvasSettings.gridSize || 8}
            onChange={(event) => setCanvasSetting("gridSize", Number(event.target.value))}
            disabled={!canvasSettings.snapToGrid}
            title="Tamano de snap"
          >
            {snapSizes.map((sizeOption) => (
              <option key={sizeOption} value={sizeOption}>{sizeOption}px</option>
            ))}
          </select>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-500">
            {components.length} elementos
          </span>
          <IconButton title="Zoom -" onClick={() => updateZoom(zoom - 0.1)}><Minus size={14} /></IconButton>
          <span className="w-12 text-center text-xs font-bold text-slate-500">{Math.round(zoom * 100)}%</span>
          <IconButton title="Zoom +" onClick={() => updateZoom(zoom + 0.1)}><Plus size={14} /></IconButton>
          <IconButton title="100%" onClick={resetZoom}><RotateCcw size={14} /></IconButton>
          <IconButton title="Ajustar a pantalla" onClick={fitToScreen}><Maximize2 size={14} /></IconButton>
        </div>
      </div>

      <div className="mb-2 flex flex-wrap items-center gap-1.5 rounded-xl bg-slate-50 p-1.5">
        <span className="px-2 text-xs font-medium text-slate-500">Layout activo: {size.label}</span>
        <ToggleButton active={(canvasSettings.responsiveMode || "manual") === "manual"} onClick={() => setCanvasSetting("responsiveMode", "manual")}>
          Reorganizar manualmente
        </ToggleButton>
        <ToggleButton active={canvasSettings.responsiveMode === "scale"} onClick={() => setCanvasSetting("responsiveMode", "scale")}>
          Escalar proporcionalmente
        </ToggleButton>
        <CopyButton onClick={() => copyLayout("mobile", "tablet")}>Mobile a Tablet</CopyButton>
        <CopyButton onClick={() => copyLayout("tablet", "desktop")}>Tablet a Desktop</CopyButton>
        <CopyButton onClick={() => copyLayout("desktop", "tablet")}>Desktop a Tablet</CopyButton>
        <CopyButton onClick={() => copyLayout("tablet", "mobile")}>Tablet a Mobile</CopyButton>
      </div>

      <div
        ref={viewportRef}
        className="relative h-[calc(100vh-130px)] min-h-[560px] overflow-auto rounded-2xl p-6 touch-none"
        style={{ backgroundColor: theme.colors.background }}
        onWheel={(event) => {
          if (!event.ctrlKey) return;
          event.preventDefault();
          updateZoom(zoom - event.deltaY * 0.0015, { x: event.clientX, y: event.clientY });
        }}
        onPointerDown={(event) => {
          if (event.button !== 1 && !event.altKey) return;
          event.preventDefault();
          setPanning({ startX: event.clientX, startY: event.clientY, startPan: pan });
        }}
        onPointerMove={handlePointerMove}
        onPointerUp={() => setPanning(null)}
        onPointerLeave={() => setPanning(null)}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={() => setTouchGesture(null)}
      >
        <div
          className="absolute left-0 top-0 origin-top-left"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            left: "50%",
            top: "50%",
            marginLeft: -size.width / 2,
            marginTop: -size.height / 2,
          }}
        >
          <div
            ref={setNodeRef}
            data-ganflow-canvas="true"
            className={`relative shrink-0 overflow-hidden rounded-[28px] border shadow-soft transition ${
              isOver ? "border-blue-400 ring-4 ring-blue-100" : "border-slate-200"
            }`}
            style={{ width: size.width, height: size.height, backgroundColor: activeScreen?.settings?.background || theme.colors.surface, borderColor: theme.colors.border }}
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) setSelectedId(null);
            }}
          >
            {appBar?.enabled ? <ScreenAppBar appBar={appBar} /> : null}

            {canvasSettings.gridVisible ? (
            <div
              className="pointer-events-none absolute inset-0 opacity-40"
              style={{
                top: topInset,
                backgroundImage:
                  "linear-gradient(to right, #e2e8f0 1px, transparent 1px), linear-gradient(to bottom, #e2e8f0 1px, transparent 1px)",
                backgroundSize: `${canvasSettings.gridSize}px ${canvasSettings.gridSize}px`,
              }}
            />
            ) : null}

            {movingId ? (
            <>
              <div className="pointer-events-none absolute left-1/2 top-0 z-30 h-full w-px bg-blue-400/70" />
              <div className="pointer-events-none absolute left-0 top-1/2 z-30 h-px w-full bg-blue-400/70" />
            </>
            ) : null}

            {guideState ? <Guides guides={guideState} /> : null}

            {components.length === 0 ? (
            <div className="pointer-events-none absolute inset-x-0 bottom-0 grid place-items-center text-center" style={{ top: topInset }}>
              <div>
                <p className="text-lg font-black text-slate-400">Arrastra componentes aqui</p>
                <p className="mt-1 text-sm font-medium text-slate-400">GanFlow guardara la pantalla como JSON.</p>
              </div>
            </div>
            ) : null}

            {[...components].sort((a, b) => (a.props.zIndex || 0) - (b.props.zIndex || 0)).map((component) => (
            <RenderedComponent key={component.id} component={component} onResizeFrame={() => {}} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function IconButton({ children, title, onClick }) {
  return (
    <button className="grid h-8 w-8 place-items-center rounded-full bg-slate-100 text-slate-600 transition hover:bg-slate-200" type="button" title={title} onClick={onClick}>
      {children}
    </button>
  );
}

function CopyButton({ children, onClick }) {
  return (
    <button className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 shadow-panel hover:text-blue-700" type="button" onClick={onClick}>
      {children}
    </button>
  );
}

function Guides({ guides }) {
  return (
    <>
      {guides.vertical.map((guide) => (
        <div key={`v-${guide.x}-${guide.kind}`} className={`pointer-events-none absolute top-0 z-[60] h-full w-px ${guide.kind === "center" ? "bg-fuchsia-500/75" : "bg-blue-500/75"}`} style={{ left: guide.x }} />
      ))}
      {guides.horizontal.map((guide) => (
        <div key={`h-${guide.y}-${guide.kind}`} className={`pointer-events-none absolute left-0 z-[60] h-px w-full ${guide.kind === "center" ? "bg-fuchsia-500/75" : "bg-blue-500/75"}`} style={{ top: guide.y }} />
      ))}
      {guides.distances.map((item) => (
        <div
          key={`${item.x}-${item.y}-${item.label}`}
          className="pointer-events-none absolute z-[70] rounded-full bg-slate-950 px-2 py-1 text-[10px] font-bold text-white shadow-panel"
          style={{ left: item.x, top: item.y }}
        >
          {item.label}
        </div>
      ))}
      <div
        className="pointer-events-none absolute z-[65] rounded-xl bg-blue-600 px-2 py-1 text-[11px] font-bold text-white shadow-panel"
        style={{ left: guides.frame.x, top: Math.max(0, guides.frame.y - 28) }}
      >
        x {Math.round(guides.frame.x)} y {Math.round(guides.frame.y)}
      </div>
    </>
  );
}

function ScreenAppBar({ appBar }) {
  return (
    <div
      className="absolute inset-x-0 top-0 z-40 flex items-center px-4"
      style={{
        height: appBar.height,
        backgroundColor: appBar.backgroundColor,
        color: appBar.textColor,
        boxShadow: appBar.shadow ? "0 8px 18px rgba(15, 23, 42, 0.12)" : "none",
        justifyContent: appBar.titleAlign === "center" ? "center" : appBar.titleAlign === "right" ? "flex-end" : "flex-start",
      }}
    >
      {appBar.showMenu ? <span className="mr-3 text-lg">☰</span> : null}
      {appBar.showBack ? <span className="mr-3 text-lg">‹</span> : null}
      <span className="truncate text-sm font-medium">{appBar.title}</span>
      {appBar.actions?.length ? <span className="ml-auto text-xs">{appBar.actions.map((action) => action.icon || action.label || action).join(" ")}</span> : null}
      {appBar.showMore || appBar.moreMenu?.length ? <span className="ml-2 text-lg">⋮</span> : null}
    </div>
  );
}

function ToggleButton({ active, children, onClick }) {
  return (
    <button
      className={`rounded-full px-3 py-1 text-xs font-black transition ${
        active ? "bg-blue-600 text-white shadow-panel" : "bg-slate-100 text-slate-500 hover:text-slate-900"
      }`}
      type="button"
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function calculateGuides(frame, components, canvasSize) {
  const tolerance = 6;
  const vertical = [];
  const horizontal = [];
  const distances = [];
  const frameEdges = {
    left: frame.x,
    centerX: frame.x + frame.width / 2,
    right: frame.x + frame.width,
    top: frame.y,
    centerY: frame.y + frame.height / 2,
    bottom: frame.y + frame.height,
  };

  const canvasCenterX = canvasSize.width / 2;
  const canvasCenterY = canvasSize.height / 2;
  if (near(frameEdges.centerX, canvasCenterX, tolerance)) vertical.push({ x: canvasCenterX, kind: "center" });
  if (near(frameEdges.centerY, canvasCenterY, tolerance)) horizontal.push({ y: canvasCenterY, kind: "center" });

  components.forEach((component) => {
    const props = component.props || {};
    if (props.hidden || component.id === frame.id) return;
    const other = {
      left: props.x,
      centerX: props.x + props.width / 2,
      right: props.x + props.width,
      top: props.y,
      centerY: props.y + props.height / 2,
      bottom: props.y + props.height,
    };

    [
      [frameEdges.left, other.left],
      [frameEdges.centerX, other.centerX],
      [frameEdges.right, other.right],
      [frameEdges.left, other.right],
      [frameEdges.right, other.left],
    ].forEach(([a, b]) => {
      if (near(a, b, tolerance)) vertical.push({ x: b, kind: "component" });
    });

    [
      [frameEdges.top, other.top],
      [frameEdges.centerY, other.centerY],
      [frameEdges.bottom, other.bottom],
      [frameEdges.top, other.bottom],
      [frameEdges.bottom, other.top],
    ].forEach(([a, b]) => {
      if (near(a, b, tolerance)) horizontal.push({ y: b, kind: "component" });
    });

    const horizontalGap = Math.min(Math.abs(frameEdges.left - other.right), Math.abs(other.left - frameEdges.right));
    if (horizontalGap > 0 && horizontalGap <= 32 && rangesOverlap(frame.y, frame.y + frame.height, props.y, props.y + props.height)) {
      distances.push({ x: Math.min(frameEdges.left, other.left) + Math.abs(frameEdges.left - other.left) / 2, y: Math.min(frame.y, props.y) + 8, label: `${Math.round(horizontalGap)}px` });
    }

    const verticalGap = Math.min(Math.abs(frameEdges.top - other.bottom), Math.abs(other.top - frameEdges.bottom));
    if (verticalGap > 0 && verticalGap <= 32 && rangesOverlap(frame.x, frame.x + frame.width, props.x, props.x + props.width)) {
      distances.push({ x: Math.min(frame.x, props.x) + 8, y: Math.min(frameEdges.top, other.top) + Math.abs(frameEdges.top - other.top) / 2, label: `${Math.round(verticalGap)}px` });
    }
  });

  return {
    frame,
    vertical: uniqueGuides(vertical, "x"),
    horizontal: uniqueGuides(horizontal, "y"),
    distances: distances.slice(0, 3),
  };
}

function near(a, b, tolerance) {
  return Math.abs(a - b) <= tolerance;
}

function rangesOverlap(a1, a2, b1, b2) {
  return Math.max(a1, b1) <= Math.min(a2, b2);
}

function uniqueGuides(guides, key) {
  const seen = new Set();
  return guides.filter((guide) => {
    const value = `${Math.round(guide[key])}-${guide.kind}`;
    if (seen.has(value)) return false;
    seen.add(value);
    return true;
  });
}

function getTouchGesture(touches) {
  const first = touches[0];
  const second = touches[1];
  const dx = second.clientX - first.clientX;
  const dy = second.clientY - first.clientY;
  return {
    distance: Math.hypot(dx, dy) || 1,
    center: {
      x: (first.clientX + second.clientX) / 2,
      y: (first.clientY + second.clientY) / 2,
    },
  };
}
