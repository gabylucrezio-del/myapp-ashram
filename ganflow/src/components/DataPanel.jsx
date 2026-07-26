import { Database, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { fieldTypes, useBuilderStore } from "../store/useBuilderStore.js";

export default function DataPanel() {
  const dataSources = useBuilderStore((state) => state.dataSources);
  const addDataSource = useBuilderStore((state) => state.addDataSource);
  const updateDataSource = useBuilderStore((state) => state.updateDataSource);
  const deleteDataSource = useBuilderStore((state) => state.deleteDataSource);
  const addTable = useBuilderStore((state) => state.addTable);
  const updateTable = useBuilderStore((state) => state.updateTable);
  const deleteTable = useBuilderStore((state) => state.deleteTable);
  const addField = useBuilderStore((state) => state.addField);
  const updateField = useBuilderStore((state) => state.updateField);
  const deleteField = useBuilderStore((state) => state.deleteField);
  const addRelation = useBuilderStore((state) => state.addRelation);
  const updateRelation = useBuilderStore((state) => state.updateRelation);
  const deleteRelation = useBuilderStore((state) => state.deleteRelation);
  const addRecord = useBuilderStore((state) => state.addRecord);
  const updateRecord = useBuilderStore((state) => state.updateRecord);
  const deleteRecord = useBuilderStore((state) => state.deleteRecord);
  const [newSourceType, setNewSourceType] = useState("local");

  return (
    <aside className="flex min-h-0 flex-col rounded-2xl bg-white p-3 shadow-soft">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-xl bg-blue-50 text-blue-700">
            <Database size={15} />
          </span>
          <p className="text-xs font-semibold text-slate-700">Datos</p>
        </div>
        <div className="flex gap-1">
          <select
            className="h-7 rounded-lg border border-slate-200 bg-slate-50 px-1 text-[11px]"
            value={newSourceType}
            onChange={(event) => setNewSourceType(event.target.value)}
          >
            <option value="local">Local</option>
            <option value="firebase">Firebase</option>
          </select>
          <button className="grid h-7 w-7 place-items-center rounded-xl bg-blue-600 text-white" type="button" onClick={() => addDataSource(newSourceType)}>
            <Plus size={14} />
          </button>
        </div>
      </div>

      <div className="grid gap-3 overflow-auto pr-1">
        {dataSources.map((source) => (
          <details key={source.id} className="rounded-xl border border-slate-200 bg-slate-50 p-2" open={source.id === "local1"}>
            <summary className="cursor-pointer text-xs text-slate-600">
              <span className="mr-2 rounded-lg bg-white px-2 py-1 text-[10px] uppercase text-blue-600">{source.type}</span>
              {source.name}
            </summary>

            <div className="mt-2 grid gap-2">
              <div className="flex gap-1">
                <input className="h-8 min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2 text-xs" value={source.name} onChange={(event) => updateDataSource(source.id, { name: event.target.value })} />
                <IconButton danger onClick={() => deleteDataSource(source.id)} title="Eliminar fuente"><Trash2 size={13} /></IconButton>
              </div>
              <button className="h-8 rounded-lg bg-blue-600 text-xs text-white" type="button" onClick={() => addTable(source.id, "Nueva tabla")}>Nueva tabla</button>

              {source.tables.map((table) => (
                <TableEditor
                  key={table.id}
                  source={source}
                  table={table}
                  allTables={source.tables}
                  updateTable={updateTable}
                  deleteTable={deleteTable}
                  addField={addField}
                  updateField={updateField}
                  deleteField={deleteField}
                  addRelation={addRelation}
                  updateRelation={updateRelation}
                  deleteRelation={deleteRelation}
                  addRecord={addRecord}
                  updateRecord={updateRecord}
                  deleteRecord={deleteRecord}
                />
              ))}
            </div>
          </details>
        ))}
      </div>
    </aside>
  );
}

function TableEditor(props) {
  const { source, table, allTables } = props;
  const editableFields = useMemo(() => table.fields.filter((field) => !field.system), [table.fields]);

  return (
    <details className="rounded-xl border border-slate-200 bg-white p-2">
      <summary className="cursor-pointer text-xs text-slate-700">{table.name}</summary>
      <div className="mt-2 grid gap-2">
        <div className="flex gap-1">
          <input className="h-8 min-w-0 flex-1 rounded-lg border border-slate-200 px-2 text-xs" value={table.name} onChange={(event) => props.updateTable(source.id, table.id, { name: event.target.value })} />
          <IconButton danger onClick={() => props.deleteTable(source.id, table.id)} title="Eliminar tabla"><Trash2 size={13} /></IconButton>
        </div>

        <SectionTitle title="Campos" onAdd={() => props.addField(source.id, table.id)} />
        {table.fields.map((field) => (
          <div key={field.id} className="grid grid-cols-[1fr_88px_28px] gap-1">
            <input disabled={field.system} className="h-8 rounded-lg border border-slate-200 px-2 text-xs disabled:bg-slate-100" value={field.name} onChange={(event) => props.updateField(source.id, table.id, field.id, { name: event.target.value })} />
            <select disabled={field.system} className="h-8 rounded-lg border border-slate-200 px-1 text-xs disabled:bg-slate-100" value={field.type} onChange={(event) => props.updateField(source.id, table.id, field.id, { type: event.target.value })}>
              {fieldTypes.map((type) => <option key={type} value={type}>{type}</option>)}
            </select>
            <IconButton danger disabled={field.system} onClick={() => props.deleteField(source.id, table.id, field.id)} title="Eliminar campo"><Trash2 size={12} /></IconButton>
          </div>
        ))}

        <SectionTitle title="Relaciones" onAdd={() => props.addRelation(source.id, table.id)} />
        {(table.relations || []).map((relation) => (
          <div key={relation.id} className="grid grid-cols-[1fr_1fr_28px] gap-1">
            <select className="h-8 rounded-lg border border-slate-200 px-1 text-xs" value={relation.fieldName} onChange={(event) => props.updateRelation(source.id, table.id, relation.id, { fieldName: event.target.value })}>
              <option value="">campo</option>
              {editableFields.map((field) => <option key={field.id} value={field.name}>{field.name}</option>)}
            </select>
            <select className="h-8 rounded-lg border border-slate-200 px-1 text-xs" value={relation.targetTableId} onChange={(event) => props.updateRelation(source.id, table.id, relation.id, { targetTableId: event.target.value })}>
              <option value="">tabla</option>
              {allTables.map((item) => <option key={item.id} value={item.id}>{item.name}.id</option>)}
            </select>
            <IconButton danger onClick={() => props.deleteRelation(source.id, table.id, relation.id)} title="Eliminar relacion"><Trash2 size={12} /></IconButton>
          </div>
        ))}

        <SectionTitle title="Registros" onAdd={() => props.addRecord(source.id, table.id)} />
        {(table.records || []).slice(0, 5).map((record, index) => (
          <details key={record.id || index} className="rounded-lg bg-slate-50 p-2">
            <summary className="cursor-pointer text-[11px] text-slate-500">{record.nombre || record.id || `Registro ${index + 1}`}</summary>
            <div className="mt-2 grid gap-1">
              {table.fields.map((field) => (
                <input key={field.id} className="h-7 rounded-lg border border-slate-200 px-2 text-[11px]" value={record[field.name] || ""} placeholder={field.name} onChange={(event) => props.updateRecord(source.id, table.id, index, { [field.name]: event.target.value })} />
              ))}
              <button className="h-7 rounded-lg bg-rose-50 text-[11px] text-rose-600" type="button" onClick={() => props.deleteRecord(source.id, table.id, index)}>Eliminar registro</button>
            </div>
          </details>
        ))}
      </div>
    </details>
  );
}

function SectionTitle({ title, onAdd }) {
  return (
    <div className="flex items-center justify-between">
      <p className="text-[10px] uppercase tracking-wide text-slate-400">{title}</p>
      <button className="grid h-6 w-6 place-items-center rounded-lg bg-slate-100 text-slate-600" type="button" onClick={onAdd}>
        <Plus size={12} />
      </button>
    </div>
  );
}

function IconButton({ children, onClick, title, danger = false, disabled = false }) {
  return (
    <button
      className={`grid h-8 w-7 place-items-center rounded-lg ${danger ? "bg-rose-50 text-rose-600" : "bg-slate-100 text-slate-600"} disabled:opacity-35`}
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}
