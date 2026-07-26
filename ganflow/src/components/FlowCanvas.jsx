import { ChevronDown, CircleAlert, Trash2, Workflow, ZoomIn, ZoomOut } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { flowNodeGroups, getFlowNodeDefinition } from "../flowNodeDefinitions.js";
import { componentDefaults, componentIcons, getLayoutComponents, useBuilderStore } from "../store/useBuilderStore.js";

const FLOW_NODE_WIDTH = 208;
const FLOW_NODE_MIN_HEIGHT = 96;
const FLOW_NODE_PORT_STEP = 34;

const nodeMeta = Object.fromEntries(flowNodeGroups.flatMap(([category, types]) =>
  types.map((type) => [type, { category, ...getFlowNodeDefinition(type) }]),
));
nodeMeta.event = { category: "Eventos", ...getFlowNodeDefinition("event") };

const actionNodeTypes = new Set(["addToList", "createRecord", "updateRecord", "deleteRecord", "navigateTo", "goBack", "showMessage", "showDialog", "showSnackbar", "openModal", "closeModal", "setVariable", "clearVariable", "setComponentValue", "setComponentText", "setComponentImage", "setComponentProperty", "showComponent", "hideComponent", "enableComponent", "disableComponent", "clearList", "clearFields"]);
const componentNodeTypes = new Set(["getComponentValue", "setComponentValue", "setComponentText", "readText", "setComponentImage", "addToList", "readList", "clearList", "setComponentProperty", "showComponent", "hideComponent", "enableComponent", "disableComponent"]);
const dataNodeTypes = new Set(["getComponentValue", "getVariable", "getRecord", "listRecords", "filterRecords", "readList", "readText"]);
const recordActionNodeTypes = new Set(["createRecord", "updateRecord", "deleteRecord"]);
const eventNodeTypes = new Set(["event", "onClick", "onLoad", "onChange", "onSubmit", "onSelectItem"]);
const conditionNodeTypes = new Set(["ifEmpty", "ifEquals", "ifGreater", "ifContains", "if", "switch"]);
const listNodeTypes = new Set(["addToList", "readList", "clearList"]);
const componentValueTypes = new Set(["input", "textarea", "select", "checkbox", "switch", "radioGroup", "datePicker", "timePicker", "slider", "searchInput"]);
const editableFieldTypes = new Set(["input", "textarea", "searchInput", "select", "text"]);
const clickableComponentTypes = new Set(["button", "card", "icon", "floatingActionButton"]);
const legacyPortAliases = { in: "execIn", next: "execOut", value: "dataOut" };

export default function FlowCanvas() {
  const activeFlowId = useBuilderStore((state) => state.activeFlowId);
  const activeScreenId = useBuilderStore((state) => state.activeScreenId);
  const flows = useBuilderStore((state) => state.flows);
  const screens = useBuilderStore((state) => state.screens);
  const variables = useBuilderStore((state) => state.variables);
  const dataSources = useBuilderStore((state) => state.dataSources);
  const viewport = useBuilderStore((state) => state.viewport);
  const canvasSettings = useBuilderStore((state) => state.canvasSettings);
  const setCanvasSetting = useBuilderStore((state) => state.setCanvasSetting);
  const updateFlow = useBuilderStore((state) => state.updateFlow);
  const addFlowNode = useBuilderStore((state) => state.addFlowNode);
  const updateFlowNode = useBuilderStore((state) => state.updateFlowNode);
  const selectFlowNode = useBuilderStore((state) => state.selectFlowNode);
  const clearFlowSelection = useBuilderStore((state) => state.clearFlowSelection);
  const deleteFlowNode = useBuilderStore((state) => state.deleteFlowNode);
  const addFlowConnection = useBuilderStore((state) => state.addFlowConnection);
  const deleteFlowConnection = useBuilderStore((state) => state.deleteFlowConnection);
  const flow = flows.find((item) => item.id === activeFlowId) || flows[0];
  const activeScreen = screens.find((screen) => screen.id === activeScreenId) || screens[0];
  const [connectingFrom, setConnectingFrom] = useState(null);
  const [connectionPoint, setConnectionPoint] = useState(null);
  const [hoveredPort, setHoveredPort] = useState(null);
  const [hoveredConnectionId, setHoveredConnectionId] = useState(null);
  const [selectedConnectionId, setSelectedConnectionId] = useState(null);
  const [draggingNode, setDraggingNode] = useState(null);
  const [dragPreview, setDragPreview] = useState(null);
  const [panning, setPanning] = useState(null);
  const [spacePressed, setSpacePressed] = useState(false);
  const [touchGesture, setTouchGesture] = useState(null);
  const [inspectorCollapsed, setInspectorCollapsed] = useState(false);
  const [validationResult, setValidationResult] = useState(null);
  const canvasRef = useRef(null);
  const dragFrameRef = useRef(null);
  const dragStateRef = useRef(null);

  const displayNodes = useMemo(() => (flow?.nodes || []).map((node) => (
    dragPreview?.id === node.id ? { ...node, x: dragPreview.x, y: dragPreview.y } : node
  )), [dragPreview, flow?.nodes]);
  const nodesById = useMemo(() => Object.fromEntries(displayNodes.map((node) => [node.id, node])), [displayNodes]);
  const selectedNode = (flow?.nodes || []).find((node) => flow.selectedNodeIds.includes(node.id));
  const currentComponents = getLayoutComponents(activeScreen, viewport);
  const projectLibrary = useMemo(() => buildProjectLibrary({ activeScreen, components: currentComponents, screens, variables, dataSources }), [activeScreen, currentComponents, screens, variables, dataSources]);
  const componentNamesById = useMemo(() => Object.fromEntries(currentComponents.map((component) => [component.id, component.name || component.id])), [currentComponents]);
  const componentTypesById = useMemo(() => Object.fromEntries(currentComponents.map((component) => [component.id, componentDefaults[component.type]?.label || component.type])), [currentComponents]);
  const validation = useMemo(() => validateFlow(flow, { activeScreen, currentComponents, screens, variables, dataSources, nodesById }), [activeScreen, currentComponents, dataSources, flow, nodesById, screens, variables]);
  const nodeIssuesById = useMemo(() => groupIssuesByNode(validation.issues), [validation.issues]);

  useEffect(() => {
    function onKeyDown(event) {
      if (event.code === "Space") setSpacePressed(true);
      if (event.key === "Delete" || event.key === "Backspace") {
        const target = event.target;
        if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
        if (selectedConnectionId) {
          event.preventDefault();
          deleteFlowConnection(flow.id, selectedConnectionId);
          setSelectedConnectionId(null);
          return;
        }
        if (flow?.selectedNodeIds?.length) {
          event.preventDefault();
          flow.selectedNodeIds.forEach((nodeId) => deleteNodeWithConfirmation(nodeId));
        }
      }
    }
    function onKeyUp(event) {
      if (event.code === "Space") setSpacePressed(false);
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [deleteFlowConnection, flow, selectedConnectionId]);

  if (!flow) {
    return (
      <section className="grid min-w-0 place-items-center rounded-2xl bg-white shadow-soft">
        <p className="text-sm text-slate-400">Sin flujos.</p>
      </section>
    );
  }

  function screenToWorld(event) {
    const rect = canvasRef.current.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left - flow.pan.x) / flow.zoom,
      y: (event.clientY - rect.top - flow.pan.y) / flow.zoom,
    };
  }

  function addNode(payload, position = { x: 120, y: 120 }) {
    const definition = getFlowNodeDefinition(payload.type);
    const meta = nodeMeta[payload.type] || { category: payload.category || "Acciones", ...definition };
    addFlowNode(flow.id, {
      type: payload.type,
      category: payload.category || meta.category,
      label: payload.label || definition.label || meta.label,
      x: position.x,
      y: position.y,
      params: { ...defaultParamsForNode(payload.type), ...(payload.params || {}) },
    });
  }

  function handleDrop(event) {
    event.preventDefault();
    const raw = event.dataTransfer.getData("application/ganflow-node");
    if (!raw) return;
    const payload = parseNodePayload(raw);
    addNode(payload, screenToWorld(event));
  }

  function startNodeDrag(event, node) {
    if (event.target.closest("[data-flow-port]")) return;
    event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    selectFlowNode(flow.id, node.id, event.shiftKey);
    const pointer = screenToWorld(event);
    const dragState = {
      id: node.id,
      offset: { x: pointer.x - node.x, y: pointer.y - node.y },
      target: { x: node.x, y: node.y },
      preview: { x: node.x, y: node.y },
    };
    dragStateRef.current = dragState;
    setDraggingNode({ id: node.id });
    setDragPreview({ id: node.id, x: node.x, y: node.y });
  }

  function handlePointerMove(event) {
    if (draggingNode) {
      const pointer = screenToWorld(event);
      const dragState = dragStateRef.current;
      if (!dragState) return;
      dragState.target = {
        x: pointer.x - dragState.offset.x,
        y: pointer.y - dragState.offset.y,
      };
      if (!dragFrameRef.current) {
        dragFrameRef.current = requestAnimationFrame(() => {
          dragFrameRef.current = null;
          const current = dragStateRef.current;
          if (!current) return;
          const sensitivity = canvasSettings?.flowDragSensitivity || "smooth";
          const factor = sensitivity === "smooth" ? 0.72 : 1;
          current.preview = {
            x: current.preview.x + (current.target.x - current.preview.x) * factor,
            y: current.preview.y + (current.target.y - current.preview.y) * factor,
          };
          setDragPreview({ id: current.id, x: current.preview.x, y: current.preview.y });
        });
      }
    }

    if (panning) {
      updateFlow(flow.id, {
        pan: {
          x: panning.startPan.x + event.clientX - panning.startX,
          y: panning.startPan.y + event.clientY - panning.startY,
        },
      });
    }

    if (connectingFrom) {
      setConnectionPoint(screenToWorld(event));
      setHoveredPort(getPortAtPoint(event.clientX, event.clientY));
    }
  }

  function finishPointer(event) {
    const dragState = dragStateRef.current;
    if (dragState) {
      const finalPosition = snapFlowPosition(dragState.target, canvasSettings);
      updateFlowNode(flow.id, dragState.id, finalPosition);
      if (dragFrameRef.current) cancelAnimationFrame(dragFrameRef.current);
      dragFrameRef.current = null;
      dragStateRef.current = null;
      setDragPreview(null);
    }
    setDraggingNode(null);
    setPanning(null);
    if (connectingFrom) {
      const targetPort = getPortAtPoint(event.clientX, event.clientY);
      if (targetPort) {
        connectPorts(connectingFrom, targetPort);
      }
      setConnectingFrom(null);
      setConnectionPoint(null);
      setHoveredPort(null);
    }
  }

  function startConnection(event, node, port) {
    event.stopPropagation();
    if (!getNodePorts(node).outputs.some((output) => output.id === port.id)) return;
    setConnectingFrom({ nodeId: node.id, portId: port.id, kind: port.kind, direction: "output" });
    setConnectionPoint(screenToWorld(event));
  }

  function connectTo(event, node, port) {
    event.stopPropagation();
    if (!connectingFrom) return;
    if (!getNodePorts(node).inputs.some((input) => input.id === port.id)) return;
    connectPorts(connectingFrom, { nodeId: node.id, portId: port.id, kind: port.kind, direction: "input" });
    setConnectingFrom(null);
    setConnectionPoint(null);
    setHoveredPort(null);
  }

  function connectPorts(sourcePort, targetPort) {
    const validation = validatePortConnection(sourcePort, targetPort);
    if (!validation.valid) {
      updateFlow(flow.id, { errors: ["ConexiÃ³n invÃ¡lida"] });
      return false;
    }
    addFlowConnection(flow.id, `${sourcePort.nodeId}.${sourcePort.portId}`, `${targetPort.nodeId}.${targetPort.portId}`, validation.type);
    setValidationResult(null);
    return true;
  }

  function deleteNodeWithConfirmation(nodeId) {
    const connectionCount = (flow.connections || []).filter((connection) => {
      const from = parsePortRef(connection.from).nodeId;
      const to = parsePortRef(connection.to).nodeId;
      return from === nodeId || to === nodeId;
    }).length;
    if (connectionCount > 0 && !window.confirm(`Este nodo tiene ${connectionCount} conexion(es). Si lo borras, tambien se eliminaran sus conexiones.`)) return;
    deleteFlowNode(flow.id, nodeId);
  }

  function handleValidateFlow() {
    const nextValidation = validateFlow(flow, { activeScreen, currentComponents, screens, variables, dataSources, nodesById });
    setValidationResult(nextValidation);
    updateFlow(flow.id, { errors: nextValidation.issues.map((issue) => `${issue.nodeId ? `${issue.nodeId}: ` : ""}${issue.message}`) });
  }

  function setZoom(nextZoom, anchor = null) {
    const zoom = Math.min(2, Math.max(0.25, nextZoom));
    if (!anchor || !canvasRef.current) {
      updateFlow(flow.id, { zoom });
      return;
    }
    const rect = canvasRef.current.getBoundingClientRect();
    const world = {
      x: (anchor.x - rect.left - flow.pan.x) / flow.zoom,
      y: (anchor.y - rect.top - flow.pan.y) / flow.zoom,
    };
    updateFlow(flow.id, {
      zoom,
      pan: {
        x: anchor.x - rect.left - world.x * zoom,
        y: anchor.y - rect.top - world.y * zoom,
      },
    });
  }

  function fitFlowToScreen() {
    if (!canvasRef.current || displayNodes.length === 0) {
      updateFlow(flow.id, { zoom: 1, pan: { x: 0, y: 0 } });
      return;
    }
    const rect = canvasRef.current.getBoundingClientRect();
    const bounds = displayNodes.reduce((box, node) => ({
      minX: Math.min(box.minX, node.x),
      minY: Math.min(box.minY, node.y),
      maxX: Math.max(box.maxX, node.x + 220),
      maxY: Math.max(box.maxY, node.y + 130),
    }), { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity });
    const zoom = Math.min(1.4, Math.max(0.45, Math.min((rect.width - 96) / (bounds.maxX - bounds.minX), (rect.height - 96) / (bounds.maxY - bounds.minY))));
    updateFlow(flow.id, {
      zoom,
      pan: {
        x: rect.width / 2 - ((bounds.minX + bounds.maxX) / 2) * zoom,
        y: rect.height / 2 - ((bounds.minY + bounds.maxY) / 2) * zoom,
      },
    });
  }

  function handleTouchStart(event) {
    if (event.touches.length !== 2) return;
    const gesture = getTouchGesture(event.touches);
    setTouchGesture({ ...gesture, startPan: flow.pan, startZoom: flow.zoom });
  }

  function handleTouchMove(event) {
    if (!touchGesture || event.touches.length !== 2) return;
    event.preventDefault();
    const next = getTouchGesture(event.touches);
    const zoom = Math.min(2, Math.max(0.25, touchGesture.startZoom * (next.distance / touchGesture.distance)));
    updateFlow(flow.id, {
      zoom,
      pan: {
        x: touchGesture.startPan.x + next.center.x - touchGesture.center.x,
        y: touchGesture.startPan.y + next.center.y - touchGesture.center.y,
      },
    });
  }

  return (
    <section className="flex min-w-0 flex-col overflow-hidden rounded-2xl bg-white shadow-soft">
      <header className="flex h-10 items-center justify-between border-b border-slate-200 px-2.5">
        <div className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-blue-50 text-blue-700">
            <Workflow size={14} />
          </span>
          <div>
            <p className="text-xs font-medium text-slate-700">Flujos</p>
            <p className="text-[11px] text-slate-400">{flow.nodes.length} nodos Â· {flow.connections.length} conexiones</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <select
            className="h-7 rounded-lg bg-slate-100 px-2 text-[10px] font-medium text-slate-600 outline-none"
            title="Movimiento"
            value={canvasSettings?.flowSnapToGrid ? "snap" : "free"}
            onChange={(event) => setCanvasSetting("flowSnapToGrid", event.target.value === "snap")}
          >
            <option value="free">Libre</option>
            <option value="snap">Snap</option>
          </select>
          <select
            className="h-7 rounded-lg bg-slate-100 px-2 text-[10px] font-medium text-slate-600 outline-none"
            title="TamaÃ±o de grilla"
            value={canvasSettings?.flowGridSize || 12}
            onChange={(event) => setCanvasSetting("flowGridSize", Number(event.target.value))}
          >
            {[8, 12, 16, 24].map((size) => <option key={size} value={size}>{size}</option>)}
          </select>
          <select
            className="h-7 rounded-lg bg-slate-100 px-2 text-[10px] font-medium text-slate-600 outline-none"
            title="Sensibilidad del drag"
            value={canvasSettings?.flowDragSensitivity || "smooth"}
            onChange={(event) => setCanvasSetting("flowDragSensitivity", event.target.value)}
          >
            <option value="smooth">Suave</option>
            <option value="normal">Normal</option>
          </select>
          <ToolbarButton onClick={() => setZoom(flow.zoom - 0.1)} title="Alejar"><ZoomOut size={14} /></ToolbarButton>
          <span className="w-12 text-center text-xs text-slate-500">{Math.round(flow.zoom * 100)}%</span>
          <ToolbarButton onClick={() => setZoom(flow.zoom + 0.1)} title="Acercar"><ZoomIn size={14} /></ToolbarButton>
          <ToolbarButton onClick={() => updateFlow(flow.id, { zoom: 1, pan: { x: 0, y: 0 } })} title="100%">100</ToolbarButton>
          <ToolbarButton onClick={handleValidateFlow} title="Validar flujo">Validar</ToolbarButton>
          <ToolbarButton onClick={fitFlowToScreen} title="Ajustar">Fit</ToolbarButton>
          <ToolbarButton onClick={() => setInspectorCollapsed((value) => !value)} title={inspectorCollapsed ? "Mostrar propiedades" : "Ocultar propiedades"}><CircleAlert size={13} /></ToolbarButton>
        </div>
      </header>

      <div className="grid min-h-0 flex-1" style={{ gridTemplateColumns: selectedNode && !inspectorCollapsed ? "240px minmax(0,1fr) 280px" : "240px minmax(0,1fr)" }}>
        <aside className="min-h-0 overflow-auto border-r border-slate-200 bg-slate-50 p-3">
          <p className="mb-2 text-[11px] uppercase tracking-wide text-slate-400">Proyecto y nodos</p>
          <div className="grid gap-3">
            {projectLibrary.map((section) => (
              <LibrarySection key={section.title} title={section.title} items={section.items} onAdd={(item) => addNode(item)} />
            ))}
            {flowNodeGroups.map(([category, types]) => (
              <LibrarySection
                key={category}
                title={category}
                items={types.map((type) => {
                  const definition = getFlowNodeDefinition(type);
                  return { type, icon: definition.icon, label: definition.label, subtitle: definition.description, category, params: defaultParamsForNode(type) };
                })}
                compact
                onAdd={(item) => addNode(item)}
              />
            ))}
          </div>
        </aside>

        <div
          ref={canvasRef}
          className="relative min-h-0 overflow-hidden bg-slate-100"
          onDrop={handleDrop}
          onDragOver={(event) => event.preventDefault()}
          onPointerMove={handlePointerMove}
          onPointerUp={finishPointer}
          onPointerLeave={finishPointer}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={() => setTouchGesture(null)}
          onPointerDown={(event) => {
            if (event.target === event.currentTarget) {
              clearFlowSelection(flow.id);
              setSelectedConnectionId(null);
              if (event.button === 1 || spacePressed) {
                setPanning({ startX: event.clientX, startY: event.clientY, startPan: flow.pan });
              }
            }
          }}
          onWheel={(event) => {
            event.preventDefault();
            setZoom(flow.zoom - event.deltaY * 0.0012, { x: event.clientX, y: event.clientY });
          }}
        >
          <div
            className="absolute left-0 top-0 h-[2400px] w-[3400px] origin-top-left"
            style={{
              transform: `translate(${flow.pan.x}px, ${flow.pan.y}px) scale(${flow.zoom})`,
              backgroundImage:
                "linear-gradient(to right, #e2e8f0 1px, transparent 1px), linear-gradient(to bottom, #e2e8f0 1px, transparent 1px)",
              backgroundSize: "32px 32px",
            }}
          >
            <svg className="absolute inset-0 h-full w-full overflow-visible">
              <defs>
                <marker id="flow-arrow-execution" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto" markerUnits="strokeWidth">
                  <path d="M 1.5 1.5 L 7 4 L 1.5 6.5 z" fill="#2563eb" />
                </marker>
                <marker id="flow-arrow-data" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto" markerUnits="strokeWidth">
                  <path d="M 1.5 1.5 L 7 4 L 1.5 6.5 z" fill="#14b8a6" />
                </marker>
                <marker id="flow-arrow-error" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto" markerUnits="strokeWidth">
                  <path d="M 1.5 1.5 L 7 4 L 1.5 6.5 z" fill="#ef4444" />
                </marker>
                <marker id="flow-arrow-selected" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto" markerUnits="strokeWidth">
                  <path d="M 1.5 1.5 L 7 4 L 1.5 6.5 z" fill="#7c3aed" />
                </marker>
              </defs>
              {flow.connections.map((connection) => {
                const fromRef = parsePortRef(connection.from);
                const toRef = parsePortRef(connection.to);
                const from = nodesById[fromRef.nodeId];
                const to = nodesById[toRef.nodeId];
                const invalid = !from || !to || !isValidConnection(connection, from, to);
                const endpoint = from && to ? getConnectionEndpoints(from, to, fromRef.portId, toRef.portId) : null;
                const start = endpoint?.start || (from ? getPortPosition(from, fromRef.portId, "output") : { x: 32, y: 32 });
                const end = endpoint?.end || (to ? getPortPosition(to, toRef.portId, "input") : { x: start.x + 120, y: start.y });
                const path = buildConnectionPath(start, end);
                const labelPoint = getPathLabelPoint(start, end);
                const isData = connection.type === "data";
                const selected = selectedConnectionId === connection.id;
                const hovered = hoveredConnectionId === connection.id;
                const stroke = invalid ? "#ef4444" : selected ? "#7c3aed" : hovered ? "#0f172a" : isData ? "#14b8a6" : "#2563eb";
                const label = connectionLabel(connection, fromRef);
                const marker = invalid ? "url(#flow-arrow-error)" : selected ? "url(#flow-arrow-selected)" : isData ? "url(#flow-arrow-data)" : "url(#flow-arrow-execution)";
                return (
                  <g
                    key={connection.id}
                    className="cursor-pointer transition-opacity"
                    onMouseEnter={() => setHoveredConnectionId(connection.id)}
                    onMouseLeave={() => setHoveredConnectionId(null)}
                    onClick={(event) => { event.stopPropagation(); setSelectedConnectionId(connection.id); }}
                  >
                    <path
                      d={path}
                      fill="none"
                      stroke="transparent"
                      strokeWidth="10"
                    />
                    <path
                      d={path}
                      fill="none"
                      markerEnd={marker}
                      stroke={stroke}
                      strokeDasharray={invalid ? "8 6" : isData ? "4 5" : undefined}
                      strokeLinecap="round"
                      strokeWidth={selected || hovered ? "3" : "2"}
                    />
                    <foreignObject x={labelPoint.x - 34} y={labelPoint.y - 10} width="68" height="20">
                      <div className={`grid h-5 place-items-center rounded-full border bg-white px-1.5 text-[9px] font-normal shadow-panel ${invalid ? "border-rose-200 text-rose-600" : isData ? "border-teal-200 text-teal-700" : "border-blue-200 text-blue-700"}`}>
                        {label}
                      </div>
                    </foreignObject>
                    {invalid ? (
                      <foreignObject x={labelPoint.x - 54} y={labelPoint.y - 12} width="22" height="22">
                        <div className="grid h-5 w-5 place-items-center rounded-full bg-rose-50 text-[11px] text-rose-600 shadow-panel">âš </div>
                      </foreignObject>
                    ) : null}
                    {selected ? (
                      <foreignObject x={labelPoint.x + 38} y={labelPoint.y - 13} width="28" height="26">
                        <button
                          className="grid h-6 w-6 place-items-center rounded-full border border-rose-100 bg-white text-rose-500 shadow-panel hover:bg-rose-50"
                          type="button"
                          title="Borrar conexiÃ³n"
                          onClick={(event) => { event.stopPropagation(); deleteFlowConnection(flow.id, connection.id); setSelectedConnectionId(null); }}
                        >
                          Ã—
                        </button>
                      </foreignObject>
                    ) : null}
                  </g>
                );
              })}
              {connectingFrom && connectionPoint && nodesById[connectingFrom.nodeId] ? (
                <path
                  d={buildTempPath(nodesById[connectingFrom.nodeId], connectingFrom.portId, connectionPoint)}
                  fill="none"
                  markerEnd={connectingFrom.kind === "data" ? "url(#flow-arrow-data)" : "url(#flow-arrow-execution)"}
                  stroke={connectingFrom.kind === "data" ? "#14b8a6" : "#f59e0b"}
                  strokeDasharray="6 6"
                  strokeLinecap="round"
                  strokeWidth="2"
                />
              ) : null}
            </svg>

            {displayNodes.map((node) => (
              <FlowNode
                key={node.id}
                node={node}
                dragging={draggingNode?.id === node.id}
                selected={flow.selectedNodeIds.includes(node.id)}
                missingConnection={nodeHasMissingConnection(flow, node)}
                issues={nodeIssuesById[node.id] || []}
                connectingFrom={connectingFrom}
                hoveredPort={hoveredPort}
                componentNamesById={componentNamesById}
                componentTypesById={componentTypesById}
                onDragStart={startNodeDrag}
                onStartConnection={startConnection}
                onConnectTo={connectTo}
                onDelete={(event) => { event.stopPropagation(); deleteNodeWithConfirmation(node.id); }}
              />
            ))}
          </div>

          {flow.errors.length > 0 ? (
            <div className="absolute bottom-3 left-3 rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-700 shadow-panel">
              {flow.errors.join(" ")}
            </div>
          ) : null}
          {validationResult ? (
            <div className={`absolute right-3 top-3 max-w-xs rounded-xl px-3 py-2 text-xs shadow-panel ${validationResult.valid ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
              <p className="font-medium">{validationResult.valid ? "Flujo vÃ¡lido" : `${validationResult.issues.length} error(es) en el flujo`}</p>
              {!validationResult.valid ? (
                <ul className="mt-1 grid max-h-36 gap-1 overflow-auto">
                  {validationResult.issues.slice(0, 6).map((issue) => <li key={`${issue.nodeId || "flow"}-${issue.message}`}>âš  {issue.message}</li>)}
                </ul>
              ) : null}
            </div>
          ) : null}
        </div>

        {selectedNode && !inspectorCollapsed ? (
          <NodeInspector
            node={selectedNode}
            flow={flow}
            screens={screens}
            viewport={viewport}
            dataSources={dataSources}
            variables={variables}
            onChange={(patch) => selectedNode && updateFlowNode(flow.id, selectedNode.id, patch)}
          />
        ) : null}
      </div>
    </section>
  );
}

function LibrarySection({ title, items, compact = false, onAdd }) {
  const [open, setOpen] = useState(true);
  if (!items.length) return null;
  return (
    <section className="grid gap-1">
      <button className="flex h-7 items-center justify-between text-left text-[11px] font-medium text-slate-500" type="button" onClick={() => setOpen((current) => !current)}>
        <span>{title}</span>
        <ChevronDown size={13} className={open ? "" : "-rotate-90"} />
      </button>
      {open ? (
        <div className={compact ? "grid grid-cols-2 gap-1" : "grid gap-1"}>
          {items.map((item) => {
            const icon = item.icon || nodeMeta[item.type]?.icon || "âš™ï¸";
            const payload = JSON.stringify(item);
            return (
              <button
                key={`${item.type}-${item.label}-${item.params?.componentId || item.params?.table || item.params?.screenId || ""}`}
                className={compact ? "flex h-14 flex-col items-center justify-center gap-1 rounded-xl border border-slate-200 bg-white text-slate-600 shadow-panel" : "flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-2 py-2 text-left text-slate-600 shadow-panel"}
                type="button"
                draggable
                title={item.label}
                onDragStart={(event) => event.dataTransfer.setData("application/ganflow-node", payload)}
                onClick={() => onAdd(item)}
              >
                <span className="text-base leading-none" aria-hidden="true">{icon}</span>
                <span className={compact ? "max-w-full truncate text-[10px]" : "min-w-0 flex-1 truncate text-xs"}>
                  <span className="block truncate">{item.label}</span>
                  {item.subtitle ? <span className="block truncate text-[10px] text-slate-400">{item.subtitle}</span> : null}
                </span>
              </button>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}

function FlowNode({ node, dragging, selected, missingConnection, issues = [], connectingFrom, hoveredPort, componentNamesById, componentTypesById, onDragStart, onStartConnection, onConnectTo, onDelete }) {
  const definition = getFlowNodeDefinition(node.type);
  const meta = nodeMeta[node.type] || { ...definition, category: node.category || "Acciones" };
  const ports = getNodePorts(node);
  const warning = issues[0]?.message || getNodeWarning(node) || (missingConnection ? "Falta conectar salida." : "");
  const hasError = issues.some((issue) => issue.level === "error") || Boolean(getNodeWarning(node));
  return (
    <article
      className={`group absolute grid min-h-[96px] w-52 touch-none gap-2 rounded-xl border bg-white p-2 shadow-panel transition-[box-shadow,opacity,transform,border-color] hover:border-slate-300 hover:shadow-soft ${dragging ? "cursor-grabbing opacity-95 shadow-soft" : "cursor-grab"} ${selected ? "border-blue-500 ring-4 ring-blue-100" : hasError ? "border-rose-400 ring-2 ring-rose-100" : warning ? "border-amber-300 ring-2 ring-amber-100" : "border-slate-200"}`}
      style={{ left: node.x, top: node.y }}
      title={warning || node.label}
      onPointerDown={(event) => onDragStart(event, node)}
    >
      <div className="flex items-center gap-2">
        <span className={`grid h-8 w-8 place-items-center rounded-xl ${colorClassForCategory(node.category || meta.category)}`}>
          <span className="text-lg leading-none">{nodeIcon(node)}</span>
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium text-slate-700">{nodeTitle(node, componentNamesById)}</p>
          <p className="line-clamp-2 text-[10px] leading-4 text-slate-400">{definition.description}</p>
        </div>
        {warning ? <CircleAlert size={14} className={hasError ? "text-rose-500" : "text-amber-500"} /> : null}
        <span className="grid h-5 w-5 place-items-center rounded-full bg-slate-100 text-[10px] text-slate-500" title={definition.description}>?</span>
      </div>

      <button
        className={`absolute -right-2 -top-2 z-20 grid h-7 w-7 place-items-center rounded-full border border-rose-100 bg-white text-rose-500 opacity-0 shadow-panel transition hover:bg-rose-50 ${selected ? "opacity-100" : "group-hover:opacity-100"}`}
        type="button"
        title="Borrar nodo"
        onPointerDown={(event) => event.stopPropagation()}
        onClick={onDelete}
      >
        <Trash2 size={13} />
      </button>

      <div className={`rounded-lg px-2 py-1 text-[10px] ${hasError ? "bg-rose-50 text-rose-700" : warning ? "bg-amber-50 text-amber-700" : "bg-slate-50 text-slate-500"}`}>
        {warning ? `âš  ${warning}` : nodeSummary(node, componentNamesById, componentTypesById)}
      </div>

      {node.type === "customFunction" ? (
        <div className="grid gap-1 rounded-lg bg-slate-50 px-2 py-1 text-[10px] text-slate-500">
          {parseCustomPorts(node.params?.inputs || "respuestasTest:lista", "input").slice(0, 3).map((port) => (
            <span key={`in-${port.id}`} className="truncate">â—‹ {port.label.replace("entrada ", "entrada ")}</span>
          ))}
          {parseCustomPorts(node.params?.outputs || "resultadoDosha:texto\nerror:error", "output").slice(0, 3).map((port) => (
            <span key={`out-${port.id}`} className="truncate">â—‹ {port.label.replace("salida ", "salida ")}</span>
          ))}
        </div>
      ) : null}

      <div className="pointer-events-none absolute inset-y-0 left-0 flex flex-col justify-center gap-2">
        {ports.inputs.map((port) => (
          <button
            key={port.id}
            data-flow-port
            data-node-id={node.id}
            data-port-id={port.id}
            data-port-kind={port.kind}
            data-port-direction="input"
            className={`pointer-events-auto -ml-2 grid h-4 w-4 place-items-center rounded-full border-2 border-white text-white shadow-panel transition ${portHandleClass({ node, port, direction: "input", connectingFrom, hoveredPort })}`}
            type="button"
            title={`Entrada: ${port.label}`}
            onPointerUp={(event) => onConnectTo(event, node, port)}
            onPointerDown={(event) => event.stopPropagation()}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-white" />
          </button>
        ))}
      </div>

      <div className="pointer-events-none absolute inset-y-0 right-0 flex flex-col justify-center gap-2">
        {ports.outputs.map((port) => (
          <button
            key={port.id}
            data-flow-port
            data-node-id={node.id}
            data-port-id={port.id}
            data-port-kind={port.kind}
            data-port-direction="output"
            className={`pointer-events-auto -mr-2 grid h-4 w-4 place-items-center rounded-full border-2 border-white text-white shadow-panel transition ${portHandleClass({ node, port, direction: "output", connectingFrom, hoveredPort })}`}
            type="button"
            title={`Salida: ${port.label}`}
            onPointerDown={(event) => onStartConnection(event, node, port)}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-white" />
          </button>
        ))}
      </div>
    </article>
  );
}

function ToolbarButton({ children, title, onClick }) {
  return (
    <button className="grid h-7 min-w-7 place-items-center rounded-lg bg-slate-100 px-1.5 text-[10px] font-medium text-slate-600 hover:bg-slate-200" type="button" title={title} onClick={onClick}>
      {children}
    </button>
  );
}

function NodeInspector({ node, flow, screens, viewport, components, dataSources, variables, onChange }) {
  const definition = node ? getFlowNodeDefinition(node.type) : null;
  const selectedScreenId = node?.params?.screenId || flow?.trigger?.screenId || screens[0]?.id || "";
  const selectedScreen = screens.find((screen) => screen.id === selectedScreenId) || screens[0];
  const screenComponents = components || getLayoutComponents(selectedScreen, viewport);
  const editableComponents = screenComponents.filter((component) => editableFieldTypes.has(component.type));
  const tables = dataSources.flatMap((source) => source.tables || []);
  const variableList = [...(variables?.global || []), ...(selectedScreen?.variables || []), ...(variables?.local || [])];
  const warnings = node ? getNodeWarnings(node) : [];

  if (!node) {
    return (
      <aside className="min-h-0 overflow-auto border-l border-slate-200 bg-white p-3">
        <p className="text-[11px] uppercase tracking-wide text-slate-400">Propiedades</p>
        <div className="mt-3 rounded-2xl bg-slate-50 p-4 text-sm text-slate-400">Selecciona un nodo para editar parametros.</div>
      </aside>
    );
  }

  function updateParams(paramsPatch) {
    onChange({ params: { ...(node.params || {}), ...paramsPatch } });
  }

  function toggleClearField(componentId) {
    const currentIds = Array.isArray(node.params?.componentIds) ? node.params.componentIds : [];
    const nextIds = currentIds.includes(componentId) ? currentIds.filter((id) => id !== componentId) : [...currentIds, componentId];
    updateParams({ componentIds: nextIds });
  }

  return (
    <aside className="min-h-0 overflow-auto border-l border-slate-200 bg-white p-3">
      <p className="text-[11px] uppercase tracking-wide text-slate-400">Propiedades nodo</p>
      <div className="mt-3 grid gap-3">
        <section className="grid gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-3">
          <div>
            <p className="text-[10px] uppercase tracking-wide text-slate-400">Nodo</p>
            <p className="text-xs text-slate-700">{definition.icon} {definition.label}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wide text-slate-400">QuÃ© hace</p>
            <p className="text-[11px] leading-4 text-slate-500">{definition.description}</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <PortList title="Entradas" ports={getNodePorts(node).inputs} />
            <PortList title="Salidas" ports={getNodePorts(node).outputs} />
          </div>
          <p className="font-mono text-[10px] text-slate-400">{node.type} Â· {node.id}</p>
        </section>

        <TextField label="Nombre del nodo" value={node.label || definition.label} onChange={(value) => onChange({ label: value })} />
        <div className="rounded-2xl bg-slate-50 px-3 py-2 text-[11px] text-slate-500">
          ParÃ¡metros
        </div>
        {warnings.length ? (
          <div className="grid gap-1 rounded-xl border border-rose-100 bg-rose-50 px-3 py-2">
            <p className="text-[10px] uppercase tracking-wide text-rose-500">Errores</p>
            {warnings.map((warning) => <p key={warning} className="text-[11px] text-rose-700">âš  {warning}</p>)}
          </div>
        ) : null}

        {eventNodeTypes.has(node.type) ? (
          <div className="grid gap-2">
            <SelectField label="Pantalla" value={selectedScreenId} onChange={(value) => updateParams({ screenId: value })}>
              {screens.map((screen) => <option key={screen.id} value={screen.id}>{screen.name}</option>)}
            </SelectField>
            <SelectField label="Componente" value={node.params?.componentId || ""} onChange={(value) => updateParams({ componentId: value })}>
              <option value="">Pantalla</option>
              {screenComponents.map((component) => <option key={component.id} value={component.id}>{componentIcons[component.type] || "□"} {component.name || component.id} - {componentDefaults[component.type]?.label || component.type}</option>)}
            </SelectField>
            <SelectField label="Evento" value={node.params?.event || node.type || "onClick"} onChange={(value) => updateParams({ event: value })}>
              {["onClick", "onLoad", "onChange", "onSubmit", "onSelectItem"].map((eventName) => <option key={eventName} value={eventName}>{eventName}</option>)}
            </SelectField>
          </div>
        ) : null}

        {componentNodeTypes.has(node.type) ? (
          <div className="grid gap-2">
            <SelectField label={["getComponentValue", "readText", "readList"].includes(node.type) ? "Componente origen" : listNodeTypes.has(node.type) ? "Lista destino" : "Componente destino"} value={node.params?.componentId || ""} onChange={(value) => updateParams({ componentId: value })}>
              <option value="">Elegir componente</option>
              {screenComponents.map((component) => <option key={component.id} value={component.id}>{componentIcons[component.type] || "□"} {component.name || component.id} - {componentDefaults[component.type]?.label || component.type}</option>)}
            </SelectField>
            {node.type === "getComponentValue" ? <TextField label="Propiedad" value={node.params?.property || "value"} onChange={(value) => updateParams({ property: value })} /> : null}
            {node.type === "setComponentProperty" ? <TextField label="Propiedad" value={node.params?.property || "text"} onChange={(value) => updateParams({ property: value })} /> : null}
            {["setComponentText", "setComponentValue", "setComponentProperty", "setComponentImage", "addToList"].includes(node.type) ? <TextArea label={node.type === "addToList" ? "Valor manual opcional" : "Valor"} value={node.params?.value || ""} onChange={(value) => updateParams({ value })} /> : null}
            {["getComponentValue", "readText", "readList"].includes(node.type) ? <TextField label="Variable destino" value={node.params?.targetVariable || ""} onChange={(value) => updateParams({ targetVariable: value })} /> : null}
          </div>
        ) : null}

        {node.type === "clearFields" ? (
          <div className="grid gap-2">
            <SelectField label="Modo" value={node.params?.mode || "all"} onChange={(value) => updateParams({ mode: value })}>
              <option value="all">Limpiar todos los campos</option>
              <option value="selected">Elegir campos</option>
            </SelectField>
            {(node.params?.mode || "all") === "selected" ? (
              <div className="grid gap-1 rounded-xl border border-slate-200 bg-slate-50 p-2">
                {editableComponents.length ? editableComponents.map((component) => {
                  const checked = Array.isArray(node.params?.componentIds) && node.params.componentIds.includes(component.id);
                  return (
                    <label key={component.id} className="flex items-center gap-2 rounded-lg bg-white px-2 py-1.5 text-xs text-slate-600">
                      <input type="checkbox" checked={checked} onChange={() => toggleClearField(component.id)} />
                      <span className="min-w-0 flex-1 truncate">{component.name || component.id}</span>
                    </label>
                  );
                }) : <p className="px-2 py-1 text-[11px] text-slate-400">No hay campos editables en esta pantalla.</p>}
              </div>
            ) : null}
          </div>
        ) : null}

        {["getVariable", "setVariable", "clearVariable"].includes(node.type) ? (
          <div className="grid gap-2">
            <SelectField label="Variable" value={node.params?.name || node.params?.variable || ""} onChange={(value) => updateParams({ name: value })}>
              <option value="">Elegir variable</option>
              {variableList.map((variable) => <option key={variable.id} value={variable.name}>{variable.name}</option>)}
            </SelectField>
            {node.type === "setVariable" ? <TextArea label="Valor" value={node.params?.value || ""} onChange={(value) => updateParams({ value })} /> : null}
            {node.type === "getVariable" ? <TextField label="Alias salida" value={node.params?.targetVariable || ""} onChange={(value) => updateParams({ targetVariable: value })} /> : null}
          </div>
        ) : null}

        {["getRecord", "listRecords", "filterRecords", "createRecord", "updateRecord", "deleteRecord"].includes(node.type) ? (
          <div className="grid gap-2">
            <SelectField label="Tabla" value={node.params?.table || ""} onChange={(value) => updateParams({ table: value })}>
              <option value="">Elegir tabla</option>
              {tables.map((table) => <option key={table.id} value={table.id}>{table.name || table.id}</option>)}
            </SelectField>
            {["createRecord", "updateRecord"].includes(node.type) ? <TextArea label="Campos JSON" value={stringifyParam(node.params?.values || node.params?.fields || {})} onChange={(value) => updateParams({ values: value })} /> : null}
            {["getRecord", "updateRecord", "deleteRecord"].includes(node.type) ? <TextField label="recordId" value={node.params?.recordId || ""} onChange={(value) => updateParams({ recordId: value })} /> : null}
            {["getRecord", "listRecords", "filterRecords"].includes(node.type) ? <TextField label="Variable destino" value={node.params?.targetVariable || "registros"} onChange={(value) => updateParams({ targetVariable: value })} /> : null}
            {node.type === "filterRecords" ? <TextField label="Filtro campo=valor" value={node.params?.filter || ""} onChange={(value) => updateParams({ filter: value })} /> : null}
          </div>
        ) : null}

        {node.type === "navigateTo" ? (
          <SelectField label="Pantalla destino" value={node.params?.screenId || ""} onChange={(value) => updateParams({ screenId: value })}>
            <option value="">Elegir pantalla</option>
            {screens.map((screen) => <option key={screen.id} value={screen.id}>{screen.name}</option>)}
          </SelectField>
        ) : null}

        {["showMessage", "showDialog", "showSnackbar"].includes(node.type) ? (
          <TextArea label="Mensaje" value={node.params?.message || ""} onChange={(value) => updateParams({ message: value })} />
        ) : null}

        {["openModal", "closeModal"].includes(node.type) ? (
          <TextField label="Modal ID" value={node.params?.modalId || ""} onChange={(value) => updateParams({ modalId: value })} />
        ) : null}

        {conditionNodeTypes.has(node.type) ? (
          <div className="grid gap-2">
            <TextArea label="Condicion / expresion" value={node.params?.condition || ""} onChange={(value) => updateParams({ condition: value })} />
            {["ifEquals", "ifGreater", "ifContains"].includes(node.type) ? <TextField label="Comparar con" value={node.params?.compareValue || ""} onChange={(value) => updateParams({ compareValue: value })} /> : null}
          </div>
        ) : null}

        {node.type === "customFunction" ? (
          <div className="grid gap-2">
            <TextField label="Nombre de funciÃ³n" value={node.params?.functionName || ""} onChange={(value) => updateParams({ functionName: value })} />
            <TextArea label="DescripciÃ³n" value={node.params?.description || ""} onChange={(value) => updateParams({ description: value })} />
            <TextArea label="Entradas" value={node.params?.inputs || ""} onChange={(value) => updateParams({ inputs: value })} />
            <p className="rounded-xl bg-slate-50 px-3 py-2 text-[10px] text-slate-500">Formato: nombre:tipo. Tipos: texto, nÃºmero, booleano, objeto, lista, imagen.</p>
            <TextArea label="Salidas" value={node.params?.outputs || ""} onChange={(value) => updateParams({ outputs: value })} />
            <p className="rounded-xl bg-slate-50 px-3 py-2 text-[10px] text-slate-500">TambiÃ©n permite error y success.</p>
            <TextArea label="ParÃ¡metros" value={node.params?.parameters || ""} onChange={(value) => updateParams({ parameters: value })} />
            <TextArea label="CÃ³digo o pseudocÃ³digo" value={node.params?.code || ""} onChange={(value) => updateParams({ code: value })} />
            <TextField label="Tipo de resultado" value={node.params?.resultType || ""} onChange={(value) => updateParams({ resultType: value })} />
          </div>
        ) : null}
      </div>
    </aside>
  );
}

function TextField({ label, value, onChange }) {
  return (
    <label className="grid gap-1">
      <span className="text-[10px] uppercase tracking-wide text-slate-400">{label}</span>
      <input className="h-9 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs text-slate-700 outline-none focus:border-blue-400 focus:bg-white" value={value || ""} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function TextArea({ label, value, onChange }) {
  return (
    <label className="grid gap-1">
      <span className="text-[10px] uppercase tracking-wide text-slate-400">{label}</span>
      <textarea className="min-h-20 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700 outline-none focus:border-blue-400 focus:bg-white" value={value || ""} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function SelectField({ label, value, onChange, children }) {
  return (
    <label className="grid gap-1">
      <span className="text-[10px] uppercase tracking-wide text-slate-400">{label}</span>
      <select className="h-9 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs text-slate-700 outline-none focus:border-blue-400 focus:bg-white" value={value || ""} onChange={(event) => onChange(event.target.value)}>
        {children}
      </select>
    </label>
  );
}

function PortList({ title, ports }) {
  return (
    <div className="grid gap-1">
      <p className="text-[10px] uppercase tracking-wide text-slate-400">{title}</p>
      {ports.length ? ports.map((port) => (
        <span key={port.id} className="truncate rounded-lg bg-white px-2 py-1 text-[9px] text-slate-500">
          {port.label}
        </span>
      )) : <span className="text-[9px] text-slate-400">Sin puertos</span>}
    </div>
  );
}

function buildProjectLibrary({ activeScreen, components, screens, variables, dataSources }) {
  const componentItems = components
    .filter((component) => componentDefaults[component.type])
    .flatMap((component) => {
      const componentName = component.name || component.id;
      const componentIcon = componentIcons[component.type] || "□";
      const componentLabel = componentDefaults[component.type]?.label || component.type;
      const baseParams = { screenId: activeScreen?.id || "", componentId: component.id };
      const makeItem = (type, subtitle = componentLabel, extraParams = {}) => {
        const definition = getFlowNodeDefinition(type);
        return {
          type,
          category: dataNodeTypes.has(type) ? "Datos" : eventNodeTypes.has(type) ? "Eventos" : "Acciones",
          icon: definition.icon || componentIcon,
          label: `${definition.label}: ${componentName}`,
          subtitle,
          params: { ...baseParams, ...extraParams },
        };
      };

      if (clickableComponentTypes.has(component.type)) return [makeItem("onClick", componentLabel, { event: "onClick" })];
      if (componentValueTypes.has(component.type)) {
        return [
          makeItem("getComponentValue", `${componentLabel} · dato`, { property: defaultPropertyForComponent(component.type), targetVariable: componentName }),
          makeItem("clearFields", componentLabel, { mode: "selected", componentIds: [component.id] }),
        ];
      }
      if (component.type === "list" || component.type === "dynamicList") {
        return [
          makeItem("addToList", componentLabel),
          makeItem("readList", `${componentLabel} · dato`, { property: "items", targetVariable: componentName }),
          makeItem("clearList", componentLabel),
        ];
      }
      if (component.type === "text") return [
        makeItem("setComponentText", componentLabel),
        makeItem("readText", `${componentLabel} · dato`, { property: "text", targetVariable: componentName }),
        makeItem("clearFields", componentLabel, { mode: "selected", componentIds: [component.id] }),
      ];
      if (component.type === "image" || component.type === "imagePicker") return [makeItem("setComponentImage", componentLabel)];
      return [makeItem("setComponentProperty", componentLabel, { property: "text" })];
    });

  const variableItems = [
    ...(variables?.global || []).map((variable) => ({ ...variable, scopeLabel: "global" })),
    ...(activeScreen?.variables || []).map((variable) => ({ ...variable, scopeLabel: "pantalla" })),
    ...(variables?.local || []).map((variable) => ({ ...variable, scopeLabel: "local" })),
  ].map((variable) => ({
    type: "getVariable",
    category: "Datos",
    icon: "v",
    label: `${variable.name} (${variable.scopeLabel})`,
    params: { name: variable.name, targetVariable: variable.name },
  }));

  const tableItems = dataSources.flatMap((source) => (source.tables || []).map((table) => ({
    type: "listRecords",
    category: "Datos",
    icon: "▤",
    label: `Consulta: ${table.name || table.id}`,
    params: { table: table.id, targetVariable: table.id },
  })));

  const screenItems = screens.map((screen) => ({
    type: "navigateTo",
    category: "Acciones",
    icon: "→",
    label: screen.name,
    params: { screenId: screen.id },
  }));

  return [
    { title: "Componentes pantalla", items: componentItems },
    { title: "Variables", items: variableItems },
    { title: "Datos", items: tableItems },
    { title: "Pantallas", items: screenItems },
  ];
}

function getNodePorts(node) {
  if (node.type === "customFunction") {
    const inputs = parseCustomPorts(node.params?.inputs || "respuestasTest:texto", "input");
    const outputs = parseCustomPorts(node.params?.outputs || "resultadoDosha:texto\nerror:error", "output");
    return {
      inputs: [{ id: "execIn", label: "Entrada", kind: "execution" }, ...inputs],
      outputs: [{ id: "success", label: "Success", kind: "execution" }, ...outputs],
    };
  }
  if (eventNodeTypes.has(node.type)) return { inputs: [], outputs: [{ id: "execOut", label: "Siguiente", kind: "execution" }] };
  if (dataNodeTypes.has(node.type)) {
    return {
      inputs: [],
      outputs: [{ id: "dataOut", label: "Valor", kind: "data" }],
    };
  }
  if (node.type === "addToList") {
    return {
      inputs: [{ id: "execIn", label: "Entrada", kind: "execution" }, { id: "dataIn", label: "Dato", kind: "data" }],
      outputs: [{ id: "execOut", label: "Siguiente", kind: "execution" }],
    };
  }
  if (["setComponentValue", "setComponentText", "setComponentImage", "setComponentProperty"].includes(node.type)) {
    return {
      inputs: [{ id: "execIn", label: "Entrada", kind: "execution" }, { id: "dataIn", label: "Dato", kind: "data" }],
      outputs: [{ id: "execOut", label: "Siguiente", kind: "execution" }],
    };
  }
  if (["showComponent", "hideComponent", "enableComponent", "disableComponent", "clearList", "clearFields"].includes(node.type)) {
    return {
      inputs: [{ id: "execIn", label: "Entrada", kind: "execution" }],
      outputs: [{ id: "execOut", label: "Siguiente", kind: "execution" }],
    };
  }
  if (conditionNodeTypes.has(node.type)) {
    return {
      inputs: [{ id: "execIn", label: "Entrada", kind: "execution" }, { id: "dataIn", label: "Dato", kind: "data" }],
      outputs: [{ id: "true", label: "Verdadero", kind: "execution" }, { id: "false", label: "Falso", kind: "execution" }],
    };
  }
  if (recordActionNodeTypes.has(node.type)) {
    return {
      inputs: [{ id: "execIn", label: "Entrada", kind: "execution" }, { id: "dataIn", label: "Dato", kind: "data" }],
      outputs: [{ id: "success", label: "Ã‰xito", kind: "execution" }, { id: "error", label: "Error", kind: "execution" }],
    };
  }
  return {
    inputs: [{ id: "execIn", label: "Entrada", kind: "execution" }],
    outputs: [{ id: "execOut", label: "Siguiente", kind: "execution" }],
  };
}

function getPortPosition(node, portId, side) {
  const ports = getNodePorts(node)[side === "input" ? "inputs" : "outputs"];
  const index = Math.max(0, ports.findIndex((port) => samePortId(port.id, portId)));
  const total = Math.max(1, ports.length);
  return {
    x: node.x + (side === "input" ? 0 : FLOW_NODE_WIDTH),
    y: node.y + 28 + ((index + 1) * FLOW_NODE_PORT_STEP) / (total + 1),
  };
}

function buildTempPath(node, portId, point) {
  const start = { ...getPortPosition(node, portId, "output"), side: point.x >= node.x + FLOW_NODE_WIDTH / 2 ? "right" : "left" };
  return buildConnectionPath(start, point);
}

function getConnectionEndpoints(fromNode, toNode, fromPortId, toPortId) {
  const fromCenter = getNodeCenter(fromNode);
  const toCenter = getNodeCenter(toNode);
  const leftToRight = toCenter.x >= fromCenter.x;
  return {
    start: { ...getPortPosition(fromNode, fromPortId, "output"), side: leftToRight ? "right" : "left" },
    end: { ...getPortPosition(toNode, toPortId, "input"), side: leftToRight ? "left" : "right" },
  };
}

function getNodeCenter(node) {
  return { x: node.x + FLOW_NODE_WIDTH / 2, y: node.y + getNodeHeight(node) / 2 };
}

function getNodeHeight(node) {
  return Math.max(FLOW_NODE_MIN_HEIGHT, 72 + Math.max(getNodePorts(node).inputs.length, getNodePorts(node).outputs.length) * 14);
}

function getNodeBoundaryPoint(node, side, portId, portSide) {
  const ports = getNodePorts(node)[portSide === "input" ? "inputs" : "outputs"];
  const index = Math.max(0, ports.findIndex((port) => samePortId(port.id, portId)));
  const total = Math.max(1, ports.length);
  const width = FLOW_NODE_WIDTH;
  const height = getNodeHeight(node);
  const offset = ((index + 1) / (total + 1));
  if (side === "left") return { x: node.x, y: node.y + height * offset, side };
  if (side === "right") return { x: node.x + width, y: node.y + height * offset, side };
  if (side === "top") return { x: node.x + width * offset, y: node.y, side };
  return { x: node.x + width * offset, y: node.y + height, side };
}

function buildConnectionPath(start, end) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const distance = Math.max(48, Math.hypot(dx, dy) * 0.45);
  const c1 = controlPointForSide(start, distance);
  const c2 = controlPointForSide(end, -distance);
  return `M ${start.x} ${start.y} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${end.x} ${end.y}`;
}

function controlPointForSide(point, distance) {
  if (point.side === "left") return { x: point.x - distance, y: point.y };
  if (point.side === "right") return { x: point.x + distance, y: point.y };
  if (point.side === "top") return { x: point.x, y: point.y - distance };
  if (point.side === "bottom") return { x: point.x, y: point.y + distance };
  return { x: point.x + distance, y: point.y };
}

function getPathLabelPoint(start, end) {
  return { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
}

function isValidConnection(connection, fromNode, toNode) {
  const fromRef = parsePortRef(connection.from);
  const toRef = parsePortRef(connection.to);
  const output = findPort(getNodePorts(fromNode).outputs, fromRef.portId);
  const input = findPort(getNodePorts(toNode).inputs, toRef.portId);
  if (!output || !input) return false;
  if (connection.type === "data") return output.kind === "data" && input.kind === "data";
  return output.kind === "execution" && input.kind === "execution";
}

function defaultPropertyForComponent(type) {
  if (type === "switch" || type === "checkbox") return "checked";
  if (type === "list" || type === "dynamicList" || type === "dataTable") return "selectedItem";
  if (type === "text" || type === "badge" || type === "chip") return "text";
  return "value";
}

function connectionLabel(connection, fromRef) {
  if (connection.type === "data") return "datos";
  if (fromRef.portId === "success") return "Ã©xito";
  if (fromRef.portId === "error") return "error";
  if (fromRef.portId === "true") return "verdadero";
  if (fromRef.portId === "false") return "falso";
  return "siguiente";
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

function snapFlowPosition(position, settings = {}) {
  if (!settings?.flowSnapToGrid) return { x: Math.round(position.x), y: Math.round(position.y) };
  const gridSize = Number(settings.flowGridSize) || 12;
  return {
    x: Math.round(position.x / gridSize) * gridSize,
    y: Math.round(position.y / gridSize) * gridSize,
  };
}

function parsePortRef(ref) {
  const [nodeId, portId = "next"] = String(ref || "").split(".");
  return { nodeId, portId };
}

function canonicalPortId(portId) {
  return legacyPortAliases[portId] || portId;
}

function samePortId(left, right) {
  return canonicalPortId(left) === canonicalPortId(right);
}

function findPort(ports, portId) {
  return ports.find((port) => samePortId(port.id, portId));
}

function connectionTouchesPort(connection, nodeId, portId, side) {
  const ref = parsePortRef(side === "from" ? connection.from : connection.to);
  return ref.nodeId === nodeId && samePortId(ref.portId, portId);
}

function getPortAtPoint(clientX, clientY) {
  const element = document.elementFromPoint(clientX, clientY);
  const portElement = element?.closest?.("[data-flow-port]");
  if (!portElement) return null;
  return {
    nodeId: portElement.dataset.nodeId,
    portId: portElement.dataset.portId,
    kind: portElement.dataset.portKind,
    direction: portElement.dataset.portDirection,
  };
}

function validatePortConnection(sourcePort, targetPort) {
  if (!sourcePort || !targetPort) return { valid: false, message: "ConexiÃ³n invÃ¡lida" };
  if (sourcePort.direction !== "output" || targetPort.direction !== "input") return { valid: false, message: "ConexiÃ³n invÃ¡lida" };
  if (sourcePort.nodeId === targetPort.nodeId) return { valid: false, message: "ConexiÃ³n invÃ¡lida" };
  if (sourcePort.kind !== targetPort.kind) return { valid: false, message: "ConexiÃ³n invÃ¡lida" };
  return { valid: true, type: sourcePort.kind === "data" ? "data" : "execution" };
}

function portHandleClass({ node, port, direction, connectingFrom, hoveredPort }) {
  const base = port.kind === "data" ? "bg-teal-500" : direction === "input" ? "bg-slate-500" : "bg-blue-600";
  const isActiveSource = connectingFrom?.nodeId === node.id && connectingFrom?.portId === port.id && direction === "output";
  const isHovered = hoveredPort?.nodeId === node.id && hoveredPort?.portId === port.id && hoveredPort?.direction === direction;
  if (isActiveSource) return "bg-amber-500 scale-125";
  if (connectingFrom && isHovered) {
    return validatePortConnection(connectingFrom, hoveredPort).valid ? `${port.kind === "data" ? "bg-teal-500" : "bg-blue-600"} scale-125 ring-4 ring-emerald-100` : "bg-rose-500 scale-125 ring-4 ring-rose-100";
  }
  if (connectingFrom && direction === "input") {
    const canConnect = validatePortConnection(connectingFrom, { nodeId: node.id, portId: port.id, kind: port.kind, direction }).valid;
    return canConnect ? `${base} hover:scale-125` : "bg-slate-300";
  }
  return base;
}

function parseNodePayload(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return { type: raw };
  }
}

function parseCustomPorts(value, direction) {
  return String(value || "")
    .split(/\n|,/)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry, index) => {
      const [rawName, rawType = direction === "output" ? "texto" : "texto"] = entry.split(":").map((part) => part.trim());
      const name = rawName || `${direction}${index + 1}`;
      const type = rawType || "texto";
      const isExecution = ["error", "success"].includes(type.toLowerCase()) || ["error", "success"].includes(name.toLowerCase());
      return {
        id: slugPortId(name),
        label: `${direction === "input" ? "entrada" : "salida"} ${name}`,
        kind: isExecution ? "execution" : "data",
        dataType: type,
      };
    });
}

function slugPortId(value) {
  return String(value || "port")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_]+/g, "_")
    .replace(/^_|_$/g, "") || "port";
}

function nodeTitle(node, componentNamesById = {}) {
  const componentName = componentNamesById[node.params?.componentId] || node.params?.componentId;
  const definition = getFlowNodeDefinition(node.type);
  if (node.type === "customFunction") return node.params?.functionName || definition.label;
  if (eventNodeTypes.has(node.type) && componentName) return `${definition.label}: ${componentName}`;
  if (componentNodeTypes.has(node.type) && componentName) return `${definition.label}: ${componentName}`;
  return definition.label || node.label;
}

function nodeSummary(node, componentNamesById = {}, componentTypesById = {}) {
  const componentName = componentNamesById[node.params?.componentId] || node.params?.componentId;
  const componentType = componentTypesById[node.params?.componentId] || "Componente";
  if (eventNodeTypes.has(node.type)) return `${node.params?.event || node.type} Â· ${componentName || "pantalla"}`;
  if (componentNodeTypes.has(node.type)) {
    if (!componentName) return "sin componente";
    if (node.type === "getComponentValue") return `${componentName}.${node.params?.property || "value"} · ${componentType}`;
    if (node.type === "readList") return `${componentName}.items Â· ${componentType}`;
    if (node.type === "addToList") return `agrega en ${componentName} Â· ${componentType}`;
    if (node.type === "clearList") return `limpia ${componentName} Â· ${componentType}`;
    if (node.type === "setComponentText") return `${componentName}.text Â· ${componentType}`;
    if (node.type === "readText") return `${componentName}.text Â· ${componentType}`;
    if (node.type === "setComponentImage") return `${componentName}.image Â· ${componentType}`;
    return `${componentName} Â· ${componentType}`;
  }
  if (["getRecord", "listRecords", "filterRecords"].includes(node.type)) return node.params?.table || "sin tabla";
  if (node.type === "customFunction") return node.params?.description || node.params?.resultType || "FunciÃ³n personalizada";
  if (node.type === "clearFields") return (node.params?.mode || "all") === "selected" ? `${(node.params?.componentIds || []).length} campo(s)` : "todos los campos";
  if (node.type === "navigateTo") return node.params?.screenId || "sin pantalla";
  if (["showMessage", "showDialog", "showSnackbar"].includes(node.type)) return node.params?.message || "sin mensaje";
  return getFlowNodeDefinition(node.type).description;
}

function nodeIcon(node) {
  return getFlowNodeDefinition(node.type).icon || nodeMeta[node.type]?.icon || "âš™ï¸";
}

function getNodeWarnings(node) {
  const warnings = [];
  if (componentNodeTypes.has(node.type) && !node.params?.componentId) {
    if (listNodeTypes.has(node.type)) warnings.push("Falta lista destino.");
    else warnings.push(["getComponentValue", "readText", "readList"].includes(node.type) ? "Falta elegir componente origen." : "Falta elegir componente destino.");
  }
  if (["getRecord", "listRecords", "filterRecords", "createRecord", "updateRecord", "deleteRecord"].includes(node.type) && !node.params?.table) warnings.push("Falta elegir tabla.");
  if (node.type === "navigateTo" && !node.params?.screenId) warnings.push("Falta elegir pantalla destino.");
  if (["showMessage", "showDialog", "showSnackbar"].includes(node.type) && !node.params?.message) warnings.push("Falta escribir mensaje.");
  if (node.type === "setVariable" && !(node.params?.name || node.params?.variable)) warnings.push("Falta elegir variable.");
  if (node.type === "customFunction" && !node.params?.functionName) warnings.push("Falta nombre de funciÃ³n.");
  if (node.type === "clearFields" && node.params?.mode === "selected" && !(node.params?.componentIds || []).length) warnings.push("Falta elegir campos.");
  return warnings;
}

function getNodeWarning(node) {
  return getNodeWarnings(node)[0];
}

function nodeHasMissingConnection(flow, node) {
  const ports = getNodePorts(node).outputs.filter((port) => port.kind === "execution");
  if (!ports.length) return false;
  if (["showMessage", "showDialog", "showSnackbar", "closeModal", "openUrl"].includes(node.type)) return false;
  return ports.every((port) => !(flow.connections || []).some((connection) => connectionTouchesPort(connection, node.id, port.id, "from")));
}

function hasIncomingConnection(flow, node, portId, type = null) {
  return (flow.connections || []).some((connection) => {
    if (type && connection.type !== type) return false;
    return connectionTouchesPort(connection, node.id, portId, "to");
  });
}

function validateFlow(flow, context) {
  if (!flow) return { valid: false, issues: [{ level: "error", message: "No hay flujo activo." }] };
  const issues = [];
  const nodes = flow.nodes || [];
  const connections = flow.connections || [];
  const nodeIds = new Set(nodes.map((node) => node.id));
  const componentIds = new Set((context.currentComponents || []).map((component) => component.id));
  const componentsById = Object.fromEntries((context.currentComponents || []).map((component) => [component.id, component]));
  const screenIds = new Set((context.screens || []).map((screen) => screen.id));
  const tableIds = new Set((context.dataSources || []).flatMap((source) => (source.tables || []).map((table) => table.id)));
  const variableNames = new Set([
    ...((context.variables?.global || []).map((variable) => variable.name)),
    ...((context.variables?.local || []).map((variable) => variable.name)),
    ...((context.activeScreen?.variables || []).map((variable) => variable.name)),
  ].filter(Boolean));

  nodes.forEach((node) => {
    getNodeWarnings(node).forEach((message) => issues.push({ level: "error", nodeId: node.id, message }));
    if (componentNodeTypes.has(node.type) || eventNodeTypes.has(node.type)) {
      const componentId = node.params?.componentId;
      if (componentId && !componentIds.has(componentId)) issues.push({ level: "error", nodeId: node.id, message: "Referencia a componente inexistente." });
      const componentType = componentsById[componentId]?.type;
      if (listNodeTypes.has(node.type) && componentId && !["list", "dynamicList"].includes(componentType)) {
        issues.push({ level: "error", nodeId: node.id, message: "Falta lista destino." });
      }
    }
    if (node.type === "clearFields" && node.params?.mode === "selected") {
      (node.params?.componentIds || []).forEach((componentId) => {
        const componentType = componentsById[componentId]?.type;
        if (!componentIds.has(componentId)) issues.push({ level: "error", nodeId: node.id, message: "Referencia a componente inexistente." });
        else if (!editableFieldTypes.has(componentType)) issues.push({ level: "error", nodeId: node.id, message: "El componente elegido no es editable." });
      });
    }
    if (["addToList", "setComponentText", "setComponentValue", "setComponentImage", "setComponentProperty"].includes(node.type) && !hasIncomingConnection(flow, node, "dataIn", "data") && !node.params?.value) {
      issues.push({ level: "error", nodeId: node.id, message: node.type === "addToList" ? "Falta valor para agregar." : "Falta valor de entrada." });
    }
    if (node.type === "navigateTo" && node.params?.screenId && !screenIds.has(node.params.screenId)) {
      issues.push({ level: "error", nodeId: node.id, message: "Referencia a pantalla inexistente." });
    }
    if (["getRecord", "listRecords", "filterRecords", "createRecord", "updateRecord", "deleteRecord"].includes(node.type) && node.params?.table && !tableIds.has(node.params.table)) {
      issues.push({ level: "error", nodeId: node.id, message: "Referencia a tabla inexistente." });
    }
    if (["getVariable", "setVariable", "clearVariable"].includes(node.type)) {
      const variableName = node.params?.name || node.params?.variable;
      if (!variableName) issues.push({ level: "error", nodeId: node.id, message: "Falta variable." });
      if (variableName && !variableNames.has(variableName) && node.type !== "setVariable") issues.push({ level: "error", nodeId: node.id, message: "Variable inexistente." });
    }
    if (node.type === "setComponentProperty" && !node.params?.property) issues.push({ level: "error", nodeId: node.id, message: "Falta propiedad destino." });
    if (["setComponentText", "setComponentValue", "setComponentProperty", "showMessage", "showDialog", "showSnackbar"].includes(node.type) && node.params?.value === "") {
      issues.push({ level: "warning", nodeId: node.id, message: "Valor requerido vacÃ­o." });
    }
    if (node.type === "customFunction") {
      if (!node.params?.inputs) issues.push({ level: "warning", nodeId: node.id, message: "Sin entradas definidas." });
      if (!node.params?.outputs) issues.push({ level: "warning", nodeId: node.id, message: "Sin salidas definidas." });
    }
    if (nodeHasMissingConnection(flow, node)) issues.push({ level: "warning", nodeId: node.id, message: "Nodo sin salida o flujo cortado." });
  });

  connections.forEach((connection) => {
    const fromRef = parsePortRef(connection.from);
    const toRef = parsePortRef(connection.to);
    const from = context.nodesById?.[fromRef.nodeId] || nodes.find((node) => node.id === fromRef.nodeId);
    const to = context.nodesById?.[toRef.nodeId] || nodes.find((node) => node.id === toRef.nodeId);
    if (!nodeIds.has(fromRef.nodeId) || !nodeIds.has(toRef.nodeId)) {
      issues.push({ level: "error", nodeId: nodeIds.has(fromRef.nodeId) ? fromRef.nodeId : toRef.nodeId, message: "ConexiÃ³n con nodo inexistente." });
      return;
    }
    if (!isValidConnection(connection, from, to)) {
      issues.push({ level: "error", nodeId: toRef.nodeId, message: "ConexiÃ³n invÃ¡lida." });
    }
  });

  return { valid: issues.filter((issue) => issue.level === "error").length === 0, issues };
}

function groupIssuesByNode(issues = []) {
  return issues.reduce((groups, issue) => {
    if (!issue.nodeId) return groups;
    return { ...groups, [issue.nodeId]: [...(groups[issue.nodeId] || []), issue] };
  }, {});
}

function colorClassForCategory(category) {
  if (category === "Datos") return "bg-emerald-50 text-emerald-700";
  if (category === "Variables") return "bg-violet-50 text-violet-700";
  if (category === "Componentes") return "bg-cyan-50 text-cyan-700";
  if (category === "Logica" || category === "LÃ³gica" || category === "Condiciones") return "bg-amber-50 text-amber-700";
  if (category === "Mensajes") return "bg-rose-50 text-rose-700";
  return "bg-blue-50 text-blue-700";
}

function stringifyParam(value) {
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value || {}, null, 2);
  } catch {
    return "{}";
  }
}

function defaultParamsForNode(type) {
  if (eventNodeTypes.has(type)) return { screenId: "", componentId: "", event: type === "event" ? "onClick" : type };
  if (type === "clearFields") return { mode: "all", componentIds: [] };
  if (componentNodeTypes.has(type)) return { componentId: "", value: "", targetVariable: "", property: type === "getComponentValue" ? "value" : type === "setComponentProperty" ? "text" : "" };
  if (type === "navigateTo") return { screenId: "" };
  if (["showMessage", "showDialog", "showSnackbar"].includes(type)) return { message: "Mensaje" };
  if (["getVariable", "setVariable", "clearVariable"].includes(type)) return { name: "", value: "" };
  if (["getRecord", "listRecords", "filterRecords", "createRecord", "updateRecord", "deleteRecord"].includes(type)) return { table: "", values: {}, targetVariable: "registros" };
  if (conditionNodeTypes.has(type)) return { condition: "", compareValue: "" };
  if (type === "customFunction") {
    return {
      functionName: "calcularDosha",
      description: "Tomar respuestas del test y devolver Vata/Pitta/Kapha.",
      inputs: "respuestasTest:lista",
      outputs: "resultadoDosha:texto\nerror:error",
      parameters: "",
      code: "Tomar respuestas del test y devolver Vata/Pitta/Kapha.",
      resultType: "texto",
    };
  }
  return {};
}
