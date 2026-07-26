import * as LucideIcons from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { getLayoutComponents, getLayoutSize, getThemedProps } from "../store/useBuilderStore.js";

const testViewports = {
  mobile: { label: "Movil", width: 390, height: 844 },
  tablet: { label: "Tablet", width: 768, height: 1024 },
  desktop: { label: "PC", width: 1280, height: 720 },
};

const viewportIcons = {
  mobile: LucideIcons.Smartphone,
  tablet: LucideIcons.Tablet,
  desktop: LucideIcons.Monitor,
};

const clearableFieldTypes = new Set(["input", "textarea", "searchInput", "search", "select", "text"]);

export default function TestMode({ project, initialViewport = "mobile", onExit }) {
  const [viewport, setViewport] = useState(initialViewport);
  const [runtime, setRuntime] = useState(() => createRuntime(project));
  const [toast, setToast] = useState("");
  const [modal, setModal] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [warnings, setWarnings] = useState([]);
  const [flowRuns, setFlowRuns] = useState({});
  const flowDataRef = useRef({});
  const runtimeRef = useRef(runtime);

  const screen = useMemo(() => {
    return project.screens?.find((item) => item.id === runtime.currentScreenId) || project.screens?.[0];
  }, [runtime.currentScreenId, project.screens]);

  const size = getLayoutSize(screen, viewport);
  const components = getLayoutComponents(screen, viewport);

  const bindingScope = useMemo(() => createBindingScope(runtime), [runtime]);

  useEffect(() => {
    if (!screen) return;
    const key = screen.id;
    if (flowRuns[key]) return;
    setFlowRuns((current) => ({ ...current, [key]: true }));
    executeActions(components?.flatMap((component) => component.events?.onLoad || []) || []);
    runFlowsByTrigger("onLoad");
  }, [screen?.id]);

  useEffect(() => {
    setWarnings(validateRuntime(project, runtime));
  }, [project, runtime]);

  useEffect(() => {
    if (!toast) return undefined;
    const timeout = window.setTimeout(() => setToast(""), 2600);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  useEffect(() => {
    runtimeRef.current = runtime;
  }, [runtime]);

  function patchRuntime(patch) {
    setRuntime((current) => ({ ...current, ...patch }));
  }

  function setValue(component, value) {
    const nextRuntime = {
      ...runtimeRef.current,
      values: {
        ...runtimeRef.current.values,
        [component.id]: { value },
      },
    };
    runtimeRef.current = nextRuntime;
    setRuntime(nextRuntime);
    executeActions(component.events?.onChange || [], { runtime: nextRuntime });
    runFlowsByTrigger("onChange", component, nextRuntime);
  }

  function executeActions(actions = [], context = {}) {
    actions.forEach((action) => executeAction(action, context));
  }

  function executeAction(action, context = {}) {
    const params = action.params || {};
    const type = action.type === "navigateToScreen" ? "navigateTo" : action.type;
    const activeRuntime = context.runtime || runtimeRef.current;
    const scopedRuntime = () => ({ ...activeRuntime, variables: { ...activeRuntime.variables, ...(context.variables || {}) } });

    if (["event", "onClick", "onLoad", "onChange", "onSubmit", "onSelectItem"].includes(type)) {
      return { output: "next" };
    }

    if (type === "navigateTo") {
      const targetScreen = params.screenId || params.screen || action.screenId || action.screen;
      if (!project.screens?.some((item) => item.id === targetScreen || item.name === targetScreen)) {
        addWarning(`La accion navega a una pantalla inexistente: ${targetScreen || "(vacia)"}.`);
        return { output: "error" };
      }
      const resolved = project.screens.find((item) => item.id === targetScreen || item.name === targetScreen);
      setRuntime((current) => ({ ...current, currentScreenId: resolved.id, history: [...(current.history || []), current.currentScreenId].filter(Boolean) }));
      setDrawerOpen(false);
      setMoreOpen(false);
      return { output: "next" };
    }

    if (type === "goBack") {
      setRuntime((current) => {
        const history = [...(current.history || [])];
        const previous = history.pop();
        return previous ? { ...current, currentScreenId: previous, history } : current;
      });
      return { output: "next" };
    }

    if (["showMessage", "showSnackbar"].includes(type)) {
      setToast(resolveValue((params.__dataIn ?? params.message) || "Mensaje", scopedRuntime()));
      setMoreOpen(false);
      return { output: "next" };
    }

    if (type === "showDialog") {
      setModal({ id: "dialog", title: params.title || "Mensaje", message: resolveValue(params.message || "Mensaje", scopedRuntime()) });
      return { output: "next" };
    }

    if (type === "openModal") {
      const modalComponent = findComponent(project, params.modalId);
      setModal({
        id: params.modalId || "modal",
        title: params.title || modalComponent?.props?.title || "Modal",
        message: params.message || modalComponent?.props?.text || "Contenido de prueba",
        component: modalComponent,
      });
      setMoreOpen(false);
      return { output: "next" };
    }

    if (type === "closeModal") {
      setModal(null);
      return { output: "next" };
    }

    if (type === "setVariable") {
      const name = params.name || params.variable;
      if (!name) return { output: "error" };
      setRuntime((current) => ({
        ...current,
        variables: { ...current.variables, [name]: resolveValue(params.value, current) },
      }));
      return { output: "next" };
    }

    if (type === "getVariable") {
      const name = params.name || params.variable;
      if (!name) return { output: "error" };
      const target = params.targetVariable || name;
      setRuntime((current) => ({ ...current, variables: { ...current.variables, [target]: current.variables?.[name] } }));
      return { output: "dataOut", value: activeRuntime.variables?.[name] };
    }

    if (type === "clearVariable") {
      const name = params.name || params.variable;
      if (!name) return { output: "error" };
      setRuntime((current) => {
        const variables = { ...current.variables };
        delete variables[name];
        return { ...current, variables };
      });
      return { output: "next" };
    }

    if (type === "getComponentValue") {
      const componentId = params.componentId;
      if (!componentId) return { output: "error" };
      const value = readComponentProperty(componentId, params.property || "value", activeRuntime, project);
      if (params.targetVariable) setRuntime((current) => ({ ...current, variables: { ...current.variables, [params.targetVariable]: value } }));
      return { output: "dataOut", value };
    }

    if (type === "readText" || type === "readList") {
      const componentId = params.componentId;
      if (!componentId) return { output: "error" };
      const value = type === "readList"
        ? activeRuntime.componentState?.[componentId]?.items || activeRuntime.values?.[componentId]?.items || []
        : activeRuntime.componentState?.[componentId]?.text ?? activeRuntime.values?.[componentId]?.value ?? "";
      if (params.targetVariable) setRuntime((current) => ({ ...current, variables: { ...current.variables, [params.targetVariable]: value } }));
      return { output: "dataOut", value };
    }

    if (type === "addToList" || type === "clearList") {
      const componentId = params.listId || params.componentId || params.targetId || params.component;
      if (!componentId) return { output: "error" };
      const value = params.__dataIn !== undefined ? params.__dataIn : resolveValue(params.value ?? "", activeRuntime);
      if (type === "addToList" && params.__dataIn !== undefined && isEmptyConnectedValue(value)) addWarning("El valor conectado está vacío");
      setRuntime((current) => {
        const componentState = { ...(current.componentState || {}) };
        const currentItems = Array.isArray(componentState[componentId]?.items) ? componentState[componentId].items : [];
        const nextItems = type === "clearList" ? [] : isEmptyConnectedValue(value) ? currentItems : [...currentItems, value];
        componentState[componentId] = {
          ...(componentState[componentId] || {}),
          items: nextItems,
        };
        return { ...current, componentState };
      });
      return { output: "execOut" };
    }

    if (type === "clearFields") {
      const fields = resolveClearableFields(project, activeRuntime, viewport, params);
      setRuntime((current) => {
        const values = { ...(current.values || {}) };
        const componentState = { ...(current.componentState || {}) };
        fields.forEach((component) => {
          const value = defaultClearedValue(component);
          values[component.id] = { value };
          componentState[component.id] = { ...(componentState[component.id] || {}), value };
          if (component.type === "text") componentState[component.id].text = "";
        });
        const nextRuntime = { ...current, values, componentState };
        runtimeRef.current = nextRuntime;
        return nextRuntime;
      });
      return { output: "execOut" };
    }

    if (["setComponentValue", "setComponentText", "setComponentImage", "setComponentProperty", "showComponent", "hideComponent", "enableComponent", "disableComponent"].includes(type)) {
      const componentId = params.componentId || params.targetId || params.component;
      if (!componentId) return { output: "error" };
      const value = params.__dataIn !== undefined ? params.__dataIn : resolveValue(params.value ?? params.text ?? "", activeRuntime);
      setRuntime((current) => {
        const componentState = { ...(current.componentState || {}) };
        componentState[componentId] = { ...(componentState[componentId] || {}) };
        if (type === "setComponentValue") {
          return {
            ...current,
            values: { ...current.values, [componentId]: { value } },
            componentState,
          };
        }
        if (type === "setComponentText") componentState[componentId].text = value;
        if (type === "setComponentImage") componentState[componentId].src = value;
        if (type === "setComponentProperty") componentState[componentId][params.property || "text"] = value;
        if (type === "showComponent") componentState[componentId].hidden = false;
        if (type === "hideComponent") componentState[componentId].hidden = true;
        if (type === "enableComponent") componentState[componentId].disabled = false;
        if (type === "disableComponent") componentState[componentId].disabled = true;
        return { ...current, componentState };
      });
      return { output: "execOut" };
    }

    if (type === "createRecord") {
      const values = params.__dataIn && typeof params.__dataIn === "object" && !Array.isArray(params.__dataIn)
        ? params.__dataIn
        : resolveObjectValues(parseJsonObject(params.values || params.fields, {}), activeRuntime);
      if (!params.table) return { output: "error" };
      setRuntime((current) => ({
        ...current,
        dataSources: mutateTable(current.dataSources, params.table, (table) => {
          const now = new Date().toISOString();
          return { ...table, records: [...(table.records || []), { id: `record_${Date.now()}`, createdAt: now, updatedAt: now, ...values }] };
        }),
      }));
      setToast("Registro creado");
      return { output: "success" };
    }

    if (type === "listRecords") {
      const records = findTable(activeRuntime.dataSources, params.table)?.records || [];
      setRuntime((current) => ({ ...current, variables: { ...current.variables, [params.targetVariable || "registros"]: records } }));
      return { output: params.table ? "dataOut" : "error", value: records };
    }

    if (type === "getRecord") {
      const recordId = resolveValue(params.recordId, activeRuntime);
      const record = (findTable(activeRuntime.dataSources, params.table)?.records || []).find((item) => String(item.id) === String(recordId));
      setRuntime((current) => ({ ...current, variables: { ...current.variables, [params.targetVariable || "registro"]: record || null } }));
      return { output: record ? "dataOut" : "error", value: record };
    }

    if (type === "filterRecords") {
      const table = findTable(activeRuntime.dataSources, params.table);
      const [field, rawValue] = String(params.filter || "").split("=");
      const expected = resolveValue(rawValue || "", activeRuntime);
      const records = (table?.records || []).filter((record) => !field || String(record[field.trim()] ?? "").includes(expected.trim()));
      setRuntime((current) => ({ ...current, variables: { ...current.variables, [params.targetVariable || "registros"]: records } }));
      return { output: table ? "dataOut" : "error", value: records };
    }

    if (type === "updateRecord") {
      const values = resolveObjectValues(parseJsonObject(params.values || params.fields, {}), activeRuntime);
      if (!params.table) return { output: "error" };
      setRuntime((current) => ({
        ...current,
        dataSources: mutateTable(current.dataSources, params.table, (table) => ({
          ...table,
          records: (table.records || []).map((record) => String(record.id) === String(resolveValue(params.recordId, current)) ? { ...record, ...values, updatedAt: new Date().toISOString() } : record),
        })),
      }));
      setToast("Registro actualizado");
      return { output: "success" };
    }

    if (type === "deleteRecord") {
      if (!params.table) return { output: "error" };
      setRuntime((current) => ({
        ...current,
        dataSources: mutateTable(current.dataSources, params.table, (table) => ({
          ...table,
          records: (table.records || []).filter((record) => String(record.id) !== String(resolveValue(params.recordId, current))),
        })),
      }));
      setToast("Registro eliminado");
      return { output: "success" };
    }

    if (["if", "switch", "ifEmpty", "ifEquals", "ifGreater", "ifContains"].includes(type)) {
      const input = params.__dataIn !== undefined ? params.__dataIn : resolveValue(params.condition, activeRuntime);
      const compare = resolveValue(params.compareValue ?? params.condition ?? "", activeRuntime);
      let passed = truthy(input);
      if (type === "ifEmpty") passed = input === undefined || input === null || String(input).trim() === "" || (Array.isArray(input) && input.length === 0);
      if (type === "ifEquals") passed = String(input) === String(compare);
      if (type === "ifGreater") passed = Number(input) > Number(compare);
      if (type === "ifContains") passed = String(input || "").includes(String(compare || ""));
      return { output: passed ? "true" : "false" };
    }

    if (type === "openUrl") {
      const url = resolveValue(params.url || "", activeRuntime);
      if (url) window.open(url, "_blank", "noopener,noreferrer");
      return { output: "next" };
    }

    if (type === "customFunction") {
      const outputName = String(params.outputs || "resultado")
        .split(/\n|,/)
        .map((entry) => entry.trim().split(":")[0])
        .find(Boolean);
      if (outputName) {
        setRuntime((current) => ({
          ...current,
          variables: {
            ...current.variables,
            [outputName]: params.resultType || params.functionName || "resultado",
          },
        }));
      }
      return { output: "success", value: params.functionName || "customFunction" };
    }

    return { output: "next" };
  }

  function executeMenuAction(item) {
    const action = normalizeRuntimeAction(item);
    if (!action) return;
    executeAction(action);
  }

  function runFlowsByTrigger(triggerType, component = null, runtimeSnapshot = runtimeRef.current) {
    (project.flows || []).forEach((flow) => {
      const runtimeEvent = triggerType === "onTap" ? "onClick" : triggerType;
      const triggerMatches = flow.trigger
        ? flow.trigger.event === runtimeEvent && (!component || flow.trigger.componentId === component.id)
        : false;
      const starts = triggerMatches
        ? findFlowStartNodes(flow)
        : (flow.nodes || []).filter((node) => {
            const eventName = node.params?.event || node.type;
            const matchesTrigger = eventName === runtimeEvent || (triggerType === "onTap" && ["onClick", "onTap"].includes(eventName));
            const target = node.params?.componentId || node.params?.targetId || node.params?.component;
            return matchesTrigger && (!component || !target || target === component.id);
          });
      if (starts.length) clearFlowData(flow);
      starts.forEach((node) => executeFlowNode(flow, node.id, new Set(), runtimeSnapshot));
    });
  }

  function executeFlowNode(flow, nodeId, visited, runtimeSnapshot = runtimeRef.current) {
    if (visited.has(nodeId)) return;
    visited.add(nodeId);
    const node = flow.nodes?.find((item) => item.id === nodeId);
    if (!node) return;
    const dataInput = flowDataRef.current[`${nodeId}.dataIn`] ?? flowDataRef.current[`${nodeId}.value`] ?? resolveNodeInputValue(flow, node, "value", runtimeSnapshot);
    const params = dataInput === undefined ? (node.params || {}) : { ...(node.params || {}), __dataIn: dataInput };
    const result = executeAction({ type: node.type, params }, { runtime: runtimeSnapshot }) || { output: "next" };
    const output = result.output || "next";
    const connections = flow.edges || flow.connections || [];
    if (result.value !== undefined) {
      connections
        .filter((connection) => {
          const from = parseFlowRef(connection.from);
          return connection.type === "data" && from.nodeId === nodeId && sameFlowPort(from.portId, "dataOut");
        })
        .forEach((connection) => {
          const to = parseFlowRef(connection.to);
          const key = canonicalInputPort(to.portId);
          flowDataRef.current[`${to.nodeId}.${key}`] = result.value;
          if (key === "dataIn") flowDataRef.current[`${to.nodeId}.value`] = result.value;
        });
    }
    connections
      .filter((connection) => {
        const from = parseFlowRef(connection.from);
        if (from.nodeId !== nodeId) return false;
        if (connection.type === "data") return false;
        return !from.portId || sameFlowPort(from.portId, output) || (output === "success" && sameFlowPort(from.portId, "next"));
      })
      .forEach((connection) => executeFlowNode(flow, parseFlowRef(connection.to).nodeId, new Set(visited), runtimeSnapshot));
  }

  function resolveConnectedDataInput(flow, nodeId, portId, runtimeSnapshot = runtimeRef.current) {
    const connection = findDataConnection(flow, nodeId, portId);
    if (!connection) return undefined;
    const sourceRef = parseFlowRef(connection.from || `${connection.source || ""}.${connection.sourceHandle || connection.output || "dataOut"}`);
    const sourceNode = flow.nodes?.find((item) => item.id === sourceRef.nodeId);
    if (!sourceNode || !sameFlowPort(sourceRef.portId, "dataOut")) return undefined;
    const value = readFlowNodeData(sourceNode, runtimeSnapshot);
    if (isEmptyConnectedValue(value)) addWarning("El valor conectado está vacío");
    return value;
  }

  function resolveNodeInputValue(flow, targetNode, inputKey = "value", runtimeSnapshot = runtimeRef.current) {
    const connected = resolveConnectedDataInput(flow, targetNode.id, inputKey, runtimeSnapshot);
    if (connected !== undefined) return connected;
    return targetNode.params?.[inputKey] ?? targetNode.params?.value;
  }

  function clearFlowData(flow) {
    const nodeIds = new Set((flow.nodes || []).map((node) => node.id));
    Object.keys(flowDataRef.current).forEach((key) => {
      if (nodeIds.has(key.split(".")[0])) delete flowDataRef.current[key];
    });
  }

  function findDataConnection(flow, targetNodeId, inputKey = "value") {
    const acceptedPorts = new Set([canonicalInputPort(inputKey), inputKey, "value", "dataIn"]);
    return (flow.edges || flow.connections || []).find((edge) => {
      if (!["data", "green"].includes(edge.type)) return false;
      const to = parseFlowRef(edge.to || `${edge.target || ""}.${edge.targetHandle || edge.input || "dataIn"}`);
      const targetHandle = edge.targetHandle || edge.input || to.portId;
      return to.nodeId === targetNodeId && acceptedPorts.has(canonicalInputPort(targetHandle));
    });
  }

  function readFlowNodeData(node, runtimeSnapshot = runtimeRef.current) {
    const params = node.params || {};
    if (node.type === "getComponentValue") {
      const componentId = params.componentId;
      if (!componentId) return undefined;
      return readComponentProperty(componentId, params.property || "value", runtimeSnapshot, project);
    }
    if (node.type === "readText") {
      const componentId = params.componentId;
      if (!componentId) return undefined;
      return runtimeSnapshot.componentState?.[componentId]?.text ?? runtimeSnapshot.values?.[componentId]?.value ?? "";
    }
    if (node.type === "readList") {
      const componentId = params.componentId;
      if (!componentId) return undefined;
      return runtimeSnapshot.componentState?.[componentId]?.items || runtimeSnapshot.values?.[componentId]?.items || [];
    }
    if (node.type === "getVariable") {
      const name = params.name || params.variable;
      return name ? runtimeSnapshot.variables?.[name] : undefined;
    }
    if (node.type === "listRecords") {
      return findTable(runtimeSnapshot.dataSources, params.table)?.records || [];
    }
    if (node.type === "getRecord") {
      const recordId = resolveValue(params.recordId, runtimeSnapshot);
      return (findTable(runtimeSnapshot.dataSources, params.table)?.records || []).find((item) => String(item.id) === String(recordId));
    }
    if (node.type === "filterRecords") {
      const table = findTable(runtimeSnapshot.dataSources, params.table);
      const [field, rawValue] = String(params.filter || "").split("=");
      const expected = resolveValue(rawValue || "", runtimeSnapshot);
      return (table?.records || []).filter((record) => !field || String(record[field.trim()] ?? "").includes(expected.trim()));
    }
    return undefined;
  }

  function handleComponentTap(component, record = null) {
    if (isFormControl(component.type)) return;
    const hasFlow = (project.flows || []).some((flow) => flow.trigger?.componentId === component.id && ["onClick", "onTap"].includes(flow.trigger?.event));
    const hasActions = hasFlow || (component.events?.onTap || []).length > 0 || ["navigate", "link", "message"].includes(component.props?.actionType);
    if (!hasActions && ["button", "floatingActionButton", "card", "icon"].includes(component.type)) addWarning(`"${component.name}" no tiene flujo ni accion configurada.`);

    if (component.props?.actionType === "navigate" && component.props.actionTarget) executeAction({ type: "navigateTo", params: { screenId: component.props.actionTarget } });
    if (component.props?.actionType === "link" && component.props.actionUrl) executeAction({ type: "openUrl", params: { url: component.props.actionUrl } });
    if (component.props?.actionType === "message") {
      const activeRuntime = runtimeRef.current;
      setToast(resolveValue(component.props.actionMessage || "Mensaje", { ...activeRuntime, variables: { ...activeRuntime.variables, registro: record || {} } }));
    }
    executeActions(component.events?.onTap || [], { variables: { registro: record || {} } });
    if (record) runFlowsByTrigger("onSelectItem", component);
    runFlowsByTrigger("onTap", component);
  }

  function addWarning(message) {
    setWarnings((current) => Array.from(new Set([message, ...current])).slice(0, 8));
  }

  return (
    <div className="flex h-screen min-h-[720px] flex-col bg-[#eef2f7] text-slate-950">
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200 bg-white/95 px-5 shadow-panel backdrop-blur">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-600">Modo prueba funcional</p>
          <h1 className="text-xl font-semibold">{project.projectName || "GanFlow"}</h1>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-2xl border border-slate-200 bg-slate-100 p-1">
            {Object.entries(testViewports).map(([key, config]) => {
              const Icon = viewportIcons[key];
              return (
                <button key={key} className={`flex h-10 items-center gap-2 rounded-xl px-3 text-sm font-semibold transition ${viewport === key ? "bg-white text-emerald-700 shadow-panel" : "text-slate-500 hover:text-slate-900"}`} type="button" onClick={() => setViewport(key)}>
                  <Icon size={17} />
                  {config.label}
                </button>
              );
            })}
          </div>
          <button className="flex h-11 items-center gap-2 rounded-2xl bg-slate-950 px-4 text-sm font-semibold text-white shadow-panel transition hover:bg-slate-800" type="button" onClick={onExit}>
            <LucideIcons.X size={17} />
            Salir de prueba
          </button>
        </div>
      </header>

      <main className="grid min-h-0 flex-1 grid-cols-[1fr_280px] gap-4 overflow-hidden p-5">
        <section className="grid min-h-0 place-items-center overflow-auto">
          <div className="relative overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-soft" style={{ width: size.width, height: size.height, backgroundColor: screen?.settings?.background || project.theme?.colors?.surface || "#ffffff" }}>
            {screen?.settings?.appBar?.enabled ? (
              <RuntimeAppBar
                appBar={screen.settings.appBar}
                drawerEnabled={Boolean(screen.settings?.drawer?.enabled)}
                moreOpen={moreOpen}
                onToggleDrawer={() => setDrawerOpen((current) => !current)}
                onToggleMore={() => setMoreOpen((current) => !current)}
                onAction={executeMenuAction}
              />
            ) : null}
            {[...(components || [])]
              .filter((component) => !component.props?.hidden && !runtime.componentState?.[component.id]?.hidden)
              .sort((a, b) => (a.props?.zIndex || 0) - (b.props?.zIndex || 0))
              .map((component) => (
                <RuntimeComponent key={component.id} component={component} theme={project.theme} runtime={runtime} scope={bindingScope} onTap={handleComponentTap} onValueChange={setValue} />
              ))}

            {screen?.settings?.drawer?.enabled ? (
              <RuntimeDrawer open={drawerOpen} drawer={screen.settings.drawer} onClose={() => setDrawerOpen(false)} onAction={executeMenuAction} />
            ) : null}

            {modal ? (
              <div className="absolute inset-0 z-[999] grid place-items-center bg-slate-950/35 p-6">
                <section className="w-full max-w-xs rounded-3xl bg-white p-5 text-center shadow-soft">
                  <p className="text-lg font-semibold">{modal.title}</p>
                  <p className="mt-2 text-sm text-slate-500">{resolveValue(modal.message, runtime)}</p>
                  <button className="mt-4 h-10 rounded-2xl bg-slate-950 px-4 text-sm font-semibold text-white" type="button" onClick={() => setModal(null)}>Cerrar</button>
                </section>
              </div>
            ) : null}
          </div>
        </section>

        <aside className="min-h-0 overflow-auto rounded-3xl bg-white p-4 shadow-soft">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Runtime</p>
          <div className="mt-3 grid gap-2 text-xs text-slate-600">
            <RuntimeLine label="Pantalla" value={screen?.name || "-"} />
            <RuntimeLine label="Viewport" value={`${size.width} x ${size.height}`} />
            <RuntimeLine label="Inputs" value={Object.keys(runtime.values).length} />
            <RuntimeLine label="Variables" value={Object.keys(runtime.variables).length} />
          </div>
          <div className="mt-4 grid gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Advertencias</p>
            {warnings.length ? warnings.map((warning) => <p key={warning} className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">{warning}</p>) : <p className="rounded-xl bg-emerald-50 px-3 py-2 text-xs text-emerald-700">Sin advertencias por ahora.</p>}
          </div>
        </aside>
      </main>

      {toast ? <div className="fixed bottom-6 left-1/2 z-[1000] -translate-x-1/2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white shadow-soft">{toast}</div> : null}
    </div>
  );
}

function RuntimeLine({ label, value }) {
  return <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2"><span>{label}</span><strong className="font-medium text-slate-900">{value}</strong></div>;
}

function RuntimeAppBar({ appBar, drawerEnabled, moreOpen, onToggleDrawer, onToggleMore, onAction }) {
  const actions = normalizeRuntimeMenuItems(appBar.actions);
  const moreMenu = normalizeRuntimeMenuItems(appBar.moreMenu);
  const showMenu = drawerEnabled && appBar.showMenu !== false;
  const showMore = appBar.showMore || moreMenu.length > 0;

  return (
    <div className="absolute inset-x-0 top-0 z-40 flex items-center px-3" style={{ height: appBar.height, backgroundColor: appBar.backgroundColor, color: appBar.textColor, boxShadow: appBar.shadow ? "0 8px 18px rgba(15, 23, 42, 0.12)" : "none" }}>
      <div className="flex w-12 shrink-0 items-center">
        {showMenu ? (
          <button className="grid h-9 w-9 place-items-center rounded-full hover:bg-white/15" type="button" onClick={(event) => { event.stopPropagation(); onToggleDrawer(); }} aria-label="Abrir menu">
            <LucideIcons.Menu size={19} />
          </button>
        ) : appBar.showBack ? (
          <button className="grid h-9 w-9 place-items-center rounded-full hover:bg-white/15" type="button" aria-label="Volver">
            <LucideIcons.ChevronLeft size={21} />
          </button>
        ) : null}
      </div>
      <span className={`min-w-0 flex-1 truncate text-sm font-medium ${appBar.titleAlign === "center" ? "text-center" : appBar.titleAlign === "right" ? "text-right" : "text-left"}`}>{appBar.title}</span>
      <div className="relative flex min-w-12 shrink-0 items-center justify-end gap-1">
        {actions.map((item) => {
          const Icon = iconForName(item.icon);
          return (
            <button key={item.id || item.label} className="grid h-9 w-9 place-items-center rounded-full hover:bg-white/15" type="button" title={item.label} onClick={(event) => { event.stopPropagation(); onAction(item); }}>
              <Icon size={18} />
            </button>
          );
        })}
        {showMore ? (
          <button className="grid h-9 w-9 place-items-center rounded-full hover:bg-white/15" type="button" aria-label="Mas opciones" onClick={(event) => { event.stopPropagation(); onToggleMore(); }}>
            <LucideIcons.MoreVertical size={19} />
          </button>
        ) : null}
        {showMore && moreOpen ? (
          <div className="absolute right-0 top-11 z-[1000] min-w-44 overflow-hidden rounded-2xl border border-slate-200 bg-white py-1 text-slate-800 shadow-soft">
            {(moreMenu.length ? moreMenu : actions).map((item) => {
              const Icon = iconForName(item.icon);
              return (
                <button key={item.id || item.label} className="flex h-10 w-full items-center gap-2 px-3 text-left text-sm hover:bg-slate-50" type="button" onClick={(event) => { event.stopPropagation(); onAction(item); }}>
                  <Icon size={16} />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function RuntimeDrawer({ open, drawer, onClose, onAction }) {
  const items = normalizeRuntimeMenuItems(drawer.items);
  return (
    <div className={`absolute inset-0 z-[900] transition ${open ? "pointer-events-auto" : "pointer-events-none"}`}>
      <button className={`absolute inset-0 bg-slate-950/30 transition-opacity ${open ? "opacity-100" : "opacity-0"}`} type="button" aria-label="Cerrar drawer" onClick={onClose} />
      <aside className="absolute inset-y-0 left-0 w-[78%] max-w-[300px] bg-white shadow-soft transition-transform duration-200" style={{ transform: open ? "translateX(0)" : "translateX(-105%)" }}>
        <div className="flex h-16 items-center justify-between border-b border-slate-100 px-4">
          <span className="text-sm font-medium text-slate-900">Menu</span>
          <button className="grid h-9 w-9 place-items-center rounded-full text-slate-500 hover:bg-slate-100" type="button" onClick={onClose}>
            <LucideIcons.X size={18} />
          </button>
        </div>
        <nav className="grid gap-1 p-3">
          {items.length ? items.map((item) => {
            const Icon = iconForName(item.icon);
            return (
              <button key={item.id || item.label} className="flex h-11 items-center gap-3 rounded-2xl px-3 text-left text-sm text-slate-700 hover:bg-slate-100" type="button" onClick={() => onAction(item)}>
                <Icon size={18} />
                <span className="truncate">{item.label}</span>
              </button>
            );
          }) : <p className="rounded-2xl bg-slate-50 p-3 text-xs text-slate-400">Drawer sin items configurados.</p>}
        </nav>
      </aside>
    </div>
  );
}

function RuntimeComponent({ component, theme, runtime, scope, onTap, onValueChange }) {
  const runtimeProps = runtime.componentState?.[component.id] || {};
  const themedComponent = { ...component, props: { ...getThemedProps(component, theme), ...runtimeProps } };
  const props = themedComponent.props;
  const table = props.dataTable ? findTable(runtime.dataSources, props.dataTable) : null;
  const runtimeItems = runtime.componentState?.[component.id]?.items;
  const records = resolveRuntimeRecords(component, props, runtimeItems, table);
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
    boxSizing: "border-box",
  };
  const allowsVisibleText = component.type === "list" || component.type === "dynamicList";

  return (
    <div className={`absolute ${allowsVisibleText ? "overflow-visible" : "overflow-hidden"} ${props.disabled ? "pointer-events-none opacity-60" : ""}`} style={style} onClick={() => onTap(component)}>
      <ComponentView component={themedComponent} runtime={runtime} scope={scope} records={records} onValueChange={(value) => onValueChange(component, value)} onRecordTap={(record) => onTap(component, record)} />
    </div>
  );
}

function ComponentView({ component, runtime, scope, records, onValueChange, onRecordTap }) {
  const props = component.props;
  const value = runtime.values[component.id]?.value ?? props.value ?? "";
  const baseClass = "flex h-full w-full items-center overflow-hidden px-4";
  const text = interpolate(props.formula || props.text || props.placeholder, scope);
  const commonInput = "h-full w-full border-0 bg-transparent px-4 text-sm outline-none";

  if (component.type === "input" || component.type === "searchInput") return <div className={`${baseClass} gap-2 border border-slate-200 bg-white p-0 shadow-sm`}>{component.type === "searchInput" ? <LucideIcons.Search className="ml-3 shrink-0 text-slate-400" size={16} /> : null}<input className={commonInput} value={value} placeholder={text} onClick={(event) => event.stopPropagation()} onChange={(event) => onValueChange(event.target.value)} /></div>;
  if (component.type === "textarea") return <textarea className="h-full w-full resize-none border border-slate-200 bg-white px-4 py-3 text-sm outline-none shadow-sm" value={value} placeholder={text} onClick={(event) => event.stopPropagation()} onChange={(event) => onValueChange(event.target.value)} />;
  if (component.type === "select") return <select className={`${commonInput} border border-slate-200 bg-white shadow-sm`} value={value || optionsFromProps(props)[0] || ""} onClick={(event) => event.stopPropagation()} onChange={(event) => onValueChange(event.target.value)}>{optionsFromProps(props).map((option) => <option key={option} value={option}>{option}</option>)}</select>;
  if (component.type === "checkbox") return <label className={`${baseClass} gap-3 font-medium`} onClick={(event) => event.stopPropagation()}><input className="h-5 w-5 rounded border-slate-300" type="checkbox" checked={Boolean(value)} onChange={(event) => onValueChange(event.target.checked)} />{text}</label>;
  if (component.type === "switch") return <button className={`${baseClass} justify-between gap-3 font-medium`} type="button" onClick={(event) => { event.stopPropagation(); onValueChange(!Boolean(value)); }}><span>{text}</span><ModernSwitch checked={Boolean(value)} props={props} /></button>;
  if (component.type === "datePicker") return <input className={`${commonInput} border border-slate-200 bg-white shadow-sm`} type="date" min={props.minDate || undefined} max={props.maxDate || undefined} value={value} onClick={(event) => event.stopPropagation()} onChange={(event) => onValueChange(event.target.value)} />;
  if (component.type === "timePicker") return <input className={`${commonInput} border border-slate-200 bg-white shadow-sm`} type="time" value={value} onClick={(event) => event.stopPropagation()} onChange={(event) => onValueChange(event.target.value)} />;
  if (component.type === "radioGroup") return <div className={`${baseClass} flex-col items-start justify-center gap-2`}>{optionsFromProps(props).map((option) => <label key={option} className="flex items-center gap-2 text-sm" onClick={(event) => event.stopPropagation()}><input type="radio" checked={value === option} onChange={() => onValueChange(option)} />{option}</label>)}</div>;
  if (component.type === "slider") return <input className="h-full w-full px-4" type="range" min={props.min || 0} max={props.max || 100} step={props.step || 1} value={Number(value) || 0} onClick={(event) => event.stopPropagation()} onChange={(event) => onValueChange(Number(event.target.value))} />;
  if (component.type === "filePicker" || component.type === "imagePicker") return <label className={`${baseClass} flex-col justify-center gap-2 border border-blue-200 text-center font-medium`} onClick={(event) => event.stopPropagation()}><LucideIcons.Upload size={24} /><span>{value?.name || value || text}</span><input className="hidden" type="file" accept={component.type === "imagePicker" ? "image/*" : undefined} onChange={(event) => onValueChange(event.target.files?.[0]?.name || "")} /></label>;

  if (component.type === "button") return <button className={`${baseClass} justify-center font-medium shadow-panel`} type="button">{text}</button>;
  if (component.type === "icon" || component.type === "floatingActionButton") return <div className={`${baseClass} justify-center p-0`}><DynamicIcon name={props.iconName || props.text || "Star"} size={Math.max(18, Number(props.fontSize) || 28)} /></div>;
  if (component.type === "list" || component.type === "dynamicList") return <RecordList props={{ ...props, id: component.id, __runtimeItems: runtime.componentState?.[component.id]?.items }} records={records} fallback={records.length ? text : ""} onRecordTap={onRecordTap} />;
  if (component.type === "dataTable") return <RuntimeDataTable props={props} records={records} />;
  if (component.type === "detailView") return <DetailView record={records[0]} />;
  if (component.type === "emptyState") return <div className="grid h-full w-full place-items-center text-center text-sm text-slate-500"><LucideIcons.Inbox size={28} />{text}</div>;
  if (component.type === "pagination") return <div className={`${baseClass} justify-center gap-3 font-medium`}><LucideIcons.ChevronLeft size={16} />{value || props.value || 1} / {props.max || 5}<LucideIcons.ChevronRight size={16} /></div>;
  if (["badge", "chip"].includes(component.type)) return <div className={`${baseClass} justify-center text-xs font-medium`}>{text}</div>;
  if (component.type === "divider") return <div className="h-full w-full" />;
  if (component.type === "spacer") return <div className="h-full w-full rounded-xl border border-dashed border-slate-200 bg-slate-50/60" />;
  if (component.type === "avatar") return <div className={`${baseClass} justify-center p-0 text-center font-medium`}>{text.slice(0, 2).toUpperCase()}</div>;
  if (component.type === "image") return <div className={`${baseClass} flex-col justify-center gap-2 border border-blue-200 text-center font-medium`}><LucideIcons.Image size={30} /><span>{text}</span></div>;
  if (["video", "videoPlayer"].includes(component.type)) return <MediaShell icon={LucideIcons.PlayCircle} text={text} />;
  if (component.type === "audioPlayer") return <MediaShell icon={LucideIcons.AudioLines} text={text} />;
  if (component.type === "pdfViewer") return <MediaShell icon={LucideIcons.FileText} text={props.source || text} />;
  if (component.type === "webView") return <MediaShell icon={LucideIcons.Globe} text={props.url || text} />;
  if (component.type === "qrCode") return <MediaShell icon={LucideIcons.QrCode} text={props.value || text} />;
  if (component.type === "qrScanner") return <MediaShell icon={LucideIcons.ScanQrCode} text={text} />;
  if (component.type === "tabs" || component.type === "bottomNavigation") return <NavigationBar props={props} onValueChange={onValueChange} />;
  if (component.type === "drawer") return <RecordList props={{ ...props, dataTitleField: "" }} records={optionsFromProps(props).map((item) => ({ id: item, nombre: item }))} fallback={text} onRecordTap={onRecordTap} />;
  if (component.type === "breadcrumb") return <div className={`${baseClass} gap-1 text-sm text-slate-500`}>{text.split("/").map((item, index) => <span key={`${item}-${index}`} className="flex items-center gap-1">{index > 0 ? <LucideIcons.ChevronRight size={14} /> : null}{item.trim()}</span>)}</div>;
  if (component.type === "gradientBox") return <div className={`${baseClass} items-start p-4 font-medium`} style={{ background: `linear-gradient(135deg, ${props.backgroundColor}, ${props.gradientTo || "#14b8a6"})` }}>{text}</div>;
  if (component.type === "progressBar") return <div className={`${baseClass} p-0`}><span className="h-full w-full rounded-full bg-slate-200"><span className="block h-full rounded-full bg-current" style={{ width: `${percent(props.value, props.max)}%` }} /></span></div>;
  if (component.type === "circularProgress") return <div className={`${baseClass} justify-center p-0`}><LucideIcons.CircleGauge size={Math.min(props.width || 72, props.height || 72)} /><span className="absolute text-xs font-medium">{props.value}%</span></div>;
  if (component.type === "accordion") return <div className={`${baseClass} flex-col items-stretch justify-start border border-slate-200 py-3`}><strong className="font-medium">{text.split("\n")[0]}</strong><span className="mt-2 text-sm text-slate-500">{text.split("\n").slice(1).join(" ")}</span></div>;
  if (component.type === "stepper") return <div className={`${baseClass} justify-around gap-2`}>{optionsFromText(text).slice(0, 4).map((item, index) => <span key={item} className="grid place-items-center gap-1 text-[10px]"><span className={`grid h-6 w-6 place-items-center rounded-full ${index + 1 === Number(props.value || 1) ? "bg-blue-600 text-white" : "bg-slate-200 text-slate-500"}`}>{index + 1}</span>{item}</span>)}</div>;
  if (component.type === "modal" || component.type === "alertDialog") return <div className={`${baseClass} flex-col items-start justify-center border border-slate-200 p-4 shadow-panel`}><strong className="font-medium">{props.title || component.name}</strong><span className="mt-2 text-sm text-slate-500">{text}</span></div>;
  if (component.type === "container") return <div className={`${baseClass} items-start border border-slate-200 pt-4 font-medium`}>{text}</div>;
  if (component.type === "card") return <div className={`${baseClass} items-start border border-slate-200 p-5 font-medium shadow-panel`}>{text}</div>;
  return <div className={`${baseClass} font-medium`}>{text}</div>;
}

function RecordList({ props, records, fallback, onRecordTap }) {
  const rows = records.length ? records : optionsFromText(fallback).map((item) => ({ value: item, text: item }));
  const showIcon = props.showIcon === true;
  const renderedItems = rows.slice(0, 8);

  if (renderedItems.length === 0) {
    return (
      <div className="flex h-full w-full flex-col items-stretch gap-2 overflow-auto border border-slate-200 bg-white p-3 shadow-sm" style={{ boxSizing: "border-box" }}>
        <div className="grid min-h-9 w-full max-w-none place-items-center rounded-xl bg-slate-50 px-3 py-2 text-sm font-normal text-slate-400" style={{ boxSizing: "border-box" }}>Sin elementos</div>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col items-stretch gap-2 overflow-auto border border-slate-200 bg-white p-3 shadow-sm" style={{ boxSizing: "border-box" }}>
      {renderedItems.map((record, index) => {
        const itemText = getListItemText(record, props);
        return (
        <button key={record.id || record.value || record.text || index} className={`min-h-9 w-full max-w-none rounded-xl bg-slate-50 px-3 py-2 text-left text-sm font-normal ${showIcon ? "flex items-start gap-2" : "block"}`} style={{ boxSizing: "border-box" }} type="button" onClick={(event) => { event.stopPropagation(); onRecordTap(record); }}>
          {showIcon ? <LucideIcons.List className="mt-0.5 shrink-0" size={15} /> : null}
          <span className={`${showIcon ? "min-w-0" : ""} block w-full max-w-none whitespace-normal break-words overflow-visible`} style={{ boxSizing: "border-box" }}>
            <span className="block w-full max-w-none whitespace-normal break-words overflow-visible" style={{ boxSizing: "border-box" }}>{itemText}</span>
            {props.dataSubtitleField && record?.[props.dataSubtitleField] ? <span className="mt-0.5 block w-full max-w-none whitespace-normal break-words overflow-visible text-xs text-slate-500" style={{ boxSizing: "border-box" }}>{record[props.dataSubtitleField]}</span> : null}
          </span>
        </button>
        );
      })}
    </div>
  );
}

function RuntimeDataTable({ props, records }) {
  const columns = optionsFromText(props.columns || "nombre\ndosha");
  return <div className="h-full w-full overflow-auto border border-slate-200 bg-white text-xs"><div className="grid bg-slate-100 font-medium" style={{ gridTemplateColumns: `repeat(${columns.length || 1}, 1fr)` }}>{columns.map((column) => <span key={column} className="border-b border-slate-200 p-2">{column}</span>)}</div>{records.slice(0, 6).map((record, index) => <div key={record.id || index} className="grid border-b border-slate-100" style={{ gridTemplateColumns: `repeat(${columns.length || 1}, 1fr)` }}>{columns.map((column) => <span key={column} className="truncate p-2">{record[column] ?? ""}</span>)}</div>)}</div>;
}

function DetailView({ record }) {
  return <div className="h-full w-full overflow-auto border border-slate-200 bg-white p-4 text-sm">{Object.entries(record || {}).slice(0, 6).map(([key, value]) => <p key={key} className="mb-2"><span className="text-xs uppercase text-slate-400">{key}</span><br />{String(value)}</p>)}</div>;
}

function MediaShell({ icon: Icon, text }) {
  return <div className="flex h-full w-full flex-col items-center justify-center gap-2 border border-slate-200 bg-slate-50 text-center text-sm font-medium"><Icon size={30} />{text}</div>;
}

function NavigationBar({ props, onValueChange }) {
  const items = optionsFromText(props.items || props.tabs || props.text).slice(0, 5);
  const selected = Number(props.selectedIndex ?? props.activeTab ?? 0);
  return <div className="flex h-full w-full items-center justify-around gap-1 px-2 text-xs font-medium">{items.map((item, index) => <button key={item} className={index === selected ? "text-blue-600" : "text-slate-500"} type="button" onClick={(event) => { event.stopPropagation(); onValueChange(index); }}>{item}</button>)}</div>;
}

function ModernSwitch({ checked, props }) {
  const metrics = { small: { w: 34, h: 20, t: 16 }, medium: { w: 44, h: 26, t: 20 }, large: { w: 56, h: 32, t: 26 } }[props.switchSize] || { w: 44, h: 26, t: 20 };
  return <span className="relative inline-flex shrink-0 rounded-full transition-colors duration-200" style={{ width: metrics.w, height: metrics.h, backgroundColor: checked ? props.onColor || "#2563eb" : props.offColor || "#cbd5e1" }}><span className="absolute top-1 rounded-full shadow transition-transform duration-200" style={{ width: metrics.t, height: metrics.t, left: 4, backgroundColor: props.thumbColor || "#ffffff", transform: checked ? `translateX(${metrics.w - metrics.t - 8}px)` : "translateX(0)" }} /></span>;
}

function DynamicIcon({ name, size }) {
  const normalized = String(name || "Star").replace(/(^\w|-\w)/g, (part) => part.replace("-", "").toUpperCase());
  const Icon = LucideIcons[normalized] || LucideIcons.Star;
  return <Icon size={size} />;
}

function resolveRuntimeRecords(component, props, runtimeItems, table) {
  if (["list", "dynamicList"].includes(component.type)) {
    if (Array.isArray(runtimeItems)) return runtimeItems.map((item) => normalizeListItem(item));
    if (props.items) return optionsFromText(props.items).map((item) => ({ value: item, text: item }));
    if (props.text && !props.dataTable) return optionsFromText(props.text).map((item) => ({ value: item, text: item }));
    if (table?.records?.length) return table.records;
    return [];
  }
  return table?.records?.length ? table.records : sampleRecords();
}

function normalizeListItem(item) {
  if (item && typeof item === "object") return item;
  return { value: item, text: String(item ?? "") };
}

function getListItemText(record, props = {}) {
  if (record === null || record === undefined) return "";
  if (typeof record !== "object") return String(record);
  const titleField = props.dataTitleField;
  if (titleField && record[titleField] !== undefined && record[titleField] !== null && record[titleField] !== "") return String(record[titleField]);
  const value = record.label ?? record.text ?? record.value ?? record.nombre ?? record.name ?? record.titulo ?? record.title;
  if (value !== undefined && value !== null && value !== "") return String(value);
  return "";
}

function createRuntime(project) {
  const startScreen = project.screens?.find((screen) => screen.id === (project.startScreenId || project.activeScreenId)) || project.screens?.[0];
  const values = {};
  (project.screens || []).flatMap(allScreenComponents).forEach((component) => {
    if (isStateful(component.type)) values[component.id] = { value: component.props?.value ?? defaultValueForType(component.type) };
  });
  return {
    currentScreenId: startScreen?.id,
    history: [],
    values,
    componentState: {},
    variables: createRuntimeVariables(project, startScreen),
    dataSources: clone(project.dataSources || []),
  };
}

function createRuntimeVariables(project, startScreen) {
  const allVariables = [...(project.variables?.global || []), ...(startScreen?.variables || []), ...(project.variables?.local || [])];
  return Object.fromEntries(allVariables.map((variable) => [variable.name, variable.initialValue]));
}

function createBindingScope(runtime) {
  return {
    ...runtime.variables,
    ...Object.fromEntries(Object.entries(runtime.values).map(([id, entry]) => [id, entry])),
  };
}

function validateRuntime(project, runtime) {
  const warnings = [];
  const screenIds = new Set((project.screens || []).map((screen) => screen.id));
  const componentIds = new Set((project.screens || []).flatMap((screen) => allScreenComponents(screen).map((component) => component.id)));
  const tableIds = new Set((runtime.dataSources || []).flatMap((source) => (source.tables || []).flatMap((table) => [table.id, table.name])));
  (project.screens || []).forEach((screen) => allScreenComponents(screen).forEach((component) => {
    if (component.props?.actionType === "navigate" && component.props.actionTarget && !screenIds.has(component.props.actionTarget)) warnings.push(`"${component.name}" apunta a una pantalla inexistente.`);
    if (component.props?.dataTable && !tableIds.has(component.props.dataTable)) warnings.push(`"${component.name}" usa una tabla inexistente: ${component.props.dataTable}.`);
    bindingsIn(component.props?.text || component.props?.formula || "").forEach((binding) => {
      const root = binding.split(".")[0];
      if (!componentIds.has(root) && runtime.variables[root] === undefined && root !== "registro") warnings.push(`Binding sin origen: {{${binding}}}.`);
    });
    if (["list", "dynamicList", "dataTable"].includes(component.type) && !component.props?.dataTable && !component.props?.text) warnings.push(`"${component.name}" no tiene datos configurados.`);
  }));
  return Array.from(new Set(warnings)).slice(0, 8);
}

function bindingsIn(value) {
  return [...String(value || "").matchAll(/\{\{\s*([\w.]+)\s*\}\}/g)].map((match) => match[1]);
}

function allScreenComponents(screen) {
  const layoutComponents = Object.values(screen?.layouts || {}).flatMap((layout) => layout.components || []);
  return layoutComponents.length ? layoutComponents : screen?.components || [];
}

function findFlowStartNodes(flow) {
  const eventNodes = (flow.nodes || []).filter((node) => ["event", "onClick", "onLoad", "onChange", "onSubmit", "onSelectItem"].includes(node.type));
  if (eventNodes.length) return eventNodes;
  const targets = new Set((flow.edges || flow.connections || []).map((edge) => parseFlowRef(edge.to).nodeId));
  return (flow.nodes || []).filter((node) => !targets.has(node.id)).slice(0, 1);
}

function parseFlowRef(ref) {
  if (ref && typeof ref === "object") return { nodeId: ref.nodeId || ref.id || "", portId: ref.portId || ref.handle || "next" };
  const [nodeId, portId = "next"] = String(ref || "").split(".");
  return { nodeId, portId };
}

function canonicalFlowPort(portId) {
  return { in: "execIn", next: "execOut", value: "dataOut" }[portId] || portId;
}

function sameFlowPort(left, right) {
  return canonicalFlowPort(left) === canonicalFlowPort(right);
}

function canonicalInputPort(portId) {
  return { in: "execIn", next: "execOut", value: "dataIn", data: "dataIn", dataIn: "dataIn" }[portId] || canonicalFlowPort(portId);
}

function isEmptyConnectedValue(value) {
  return value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0);
}

function isStateful(type) {
  return ["input", "textarea", "searchInput", "select", "checkbox", "switch", "datePicker", "timePicker", "radioGroup", "slider", "filePicker", "imagePicker", "tabs", "bottomNavigation"].includes(type);
}

function isFormControl(type) {
  return ["input", "textarea", "searchInput", "select", "checkbox", "switch", "datePicker", "timePicker", "radioGroup", "slider", "filePicker", "imagePicker"].includes(type);
}

function defaultValueForType(type) {
  if (["checkbox", "switch"].includes(type)) return false;
  if (type === "slider") return 0;
  return "";
}

function mutateTable(dataSources, tableId, updater) {
  return dataSources.map((source) => ({ ...source, tables: (source.tables || []).map((table) => (table.id === tableId || table.name === tableId ? updater(table) : table)) }));
}

function findTable(dataSources, tableId) {
  return dataSources.flatMap((source) => source.tables || []).find((table) => table.id === tableId || table.name === tableId);
}

function findComponent(project, componentId) {
  return (project.screens || []).flatMap(allScreenComponents).find((component) => component.id === componentId);
}

function resolveClearableFields(project, runtime, viewport, params = {}) {
  const currentScreen = project.screens?.find((screen) => screen.id === runtime.currentScreenId) || project.screens?.[0];
  const components = getLayoutComponents(currentScreen, viewport).filter((component) => clearableFieldTypes.has(component.type));
  if (params.mode !== "selected") return components;
  const selectedIds = new Set(Array.isArray(params.componentIds) ? params.componentIds : []);
  return components.filter((component) => selectedIds.has(component.id));
}

function defaultClearedValue(component) {
  if (component.type === "select") return component.props?.value ?? optionsFromProps(component.props)[0] ?? "";
  return "";
}

function readComponentProperty(componentId, property, runtime, project) {
  const state = runtime.componentState?.[componentId] || {};
  const component = findComponent(project, componentId);
  const props = component?.props || {};
  if (property === "checked") return Boolean(runtime.values?.[componentId]?.value ?? state.value ?? props.value);
  if (property === "selectedItem") return state.selectedItem || state.items?.[0] || null;
  if (property === "items") return state.items || runtime.values?.[componentId]?.items || [];
  if (property === "text") return state.text ?? props.text ?? "";
  return runtime.values?.[componentId]?.value ?? state[property] ?? state.value ?? props[property] ?? props.value ?? "";
}

function parseJsonObject(value, fallback) {
  if (!value) return fallback;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function interpolate(value, scope) {
  return String(value || "").replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key) => {
    const path = key.split(".");
    return path.reduce((current, part) => current?.[part], scope) ?? "";
  });
}

function resolveValue(value, runtime) {
  if (typeof value !== "string") return value;
  return interpolate(value, createBindingScope(runtime));
}

function resolveObjectValues(value, runtime) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, resolveValue(entry, runtime)]));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
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

function truthy(value) {
  if (typeof value === "boolean") return value;
  const normalized = String(value || "").trim().toLowerCase();
  return Boolean(normalized) && !["false", "0", "no", "null", "undefined"].includes(normalized);
}

function sampleRecords() {
  return [
    { id: "demo-1", nombre: "Gabriel", dosha: "Vata-Pitta", descripcion: "Registro de prueba" },
    { id: "demo-2", nombre: "Ana", dosha: "Pitta", descripcion: "Registro de prueba" },
    { id: "demo-3", nombre: "Juan", dosha: "Kapha", descripcion: "Registro de prueba" },
  ];
}

function normalizeViewportSettings(viewport = {}) {
  return {
    mode: viewport?.mode || "mobile",
    mobile: { ...testViewports.mobile, ...(viewport?.mobile || {}) },
    tablet: { ...testViewports.tablet, ...(viewport?.tablet || {}) },
    desktop: { ...testViewports.desktop, ...(viewport?.desktop || {}) },
  };
}

function normalizeRuntimeMenuItems(items = []) {
  if (!Array.isArray(items)) return [];
  return items.map((item, index) => {
    if (typeof item === "string") return { id: `item_${index}`, label: item, icon: item, action: { type: "showMessage", message: item } };
    return {
      id: item.id || `item_${index}`,
      label: item.label || item.text || item.id || `Opcion ${index + 1}`,
      icon: item.icon || "circle",
      action: item.action || {
        type: item.actionType || "showMessage",
        screen: item.screen || item.screenId || "",
        message: item.message || item.label || "",
        modalId: item.modalId || "",
      },
    };
  });
}

function normalizeRuntimeAction(item) {
  const source = item?.action || item;
  if (!source) return null;
  const type = source.type === "navigateToScreen" ? "navigateTo" : source.type;
  return {
    type,
    params: {
      ...source,
      screenId: source.screenId || source.screen || source.target || "",
      message: source.message || item?.message || item?.label || "",
      modalId: source.modalId || source.modal || "",
    },
  };
}

function iconForName(name) {
  const normalized = String(name || "circle")
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
  return LucideIcons[normalized] || LucideIcons.Circle;
}

function shadowForTheme(theme) {
  if (theme?.effects?.shadow === "none") return "none";
  if (theme?.effects?.shadow === "medium") return "0 16px 35px rgba(15, 23, 42, 0.16)";
  return "0 10px 24px rgba(15, 23, 42, 0.10)";
}
