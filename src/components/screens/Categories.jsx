import { Plus, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useApp } from "../../context/AppContext.jsx";
import { categoryService } from "../../services/categoryService";
import { mapCategory } from "../../utils/adapterUtils";
import Button from "../ui/Button.jsx";
import Card from "../ui/Card.jsx";
import Toggle from "../ui/Toggle.jsx";

export default function Categories() {
  const { state, dispatch } = useApp();
  const [newTypes, setNewTypes] = useState({});
  const [modal, setModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [cat, setCat] = useState({ name: "", icon: "Folder", color: "#1e3a8a", description: "" });
  const load = () => categoryService.list().then((data) => dispatch({ type: "SET_RESOURCE", resource: "categories", payload: data.map(mapCategory) })).catch(() => {});

  useEffect(() => { load(); }, []);

  const addType = async (id) => {
    if (!newTypes[id]) return;
    await categoryService.addTaskType(id, newTypes[id]);
    setNewTypes({ ...newTypes, [id]: "" });
    load();
  };

  async function toggleTaskType(categoryId, typeId, isActive) {
    if (!typeId) return;
    await categoryService.updateTaskTypeStatus(categoryId, typeId, isActive);
    load();
  }

  function openCreateModal() {
    setEditingId(null);
    setCat({ name: "", icon: "Folder", color: "#1e3a8a", description: "" });
    setModal(true);
  }

  function openEditModal(category) {
    setEditingId(category.id);
    setCat({
      name: category.name || "",
      icon: category.icon || "Folder",
      color: category.color || "#1e3a8a",
      description: category.description || "",
    });
    setModal(true);
  }

  async function saveCategory() {
    if (editingId) {
      await categoryService.update(editingId, cat);
    } else {
      await categoryService.create(cat);
    }
    setModal(false);
    setEditingId(null);
    load();
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="page-kicker">Task Taxonomy</div>
          <h2 className="screen-title">Categories & Task Types</h2>
        </div>
        <Button onClick={openCreateModal}><Plus size={16} />New Category</Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {state.categories.filter((category) => category.id !== "refund").map((category) => {
          const taskTypes = category.rawTaskTypes?.length
            ? category.rawTaskTypes
            : category.taskTypes.map((name) => ({ name, isActive: true }));

          return (
            <Card key={category.id} className="p-4">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="h-3 w-3 rounded-full" style={{ background: category.color }} />
                  <div>
                    <div className="font-extrabold">{category.name}</div>
                    <div className="text-[11px] font-bold text-[#059669]">Active</div>
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => openEditModal(category)}>Edit</Button>
              </div>

              <div className="space-y-2">
                {taskTypes.map((type) => {
                  const active = type.isActive !== false;
                  return (
                    <div key={type._id || type.name} className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2">
                      <span className={`font-semibold ${active ? "text-slate-900" : "text-slate-400"}`}>{type.name}</span>
                      <div className="flex items-center gap-2">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ${active ? "bg-emerald-50 text-[#059669]" : "bg-slate-200 text-slate-500"}`}>{active ? "Active" : "Inactive"}</span>
                        <Toggle checked={active} onChange={(next) => toggleTaskType(category.id, type._id, next)} />
                        <button onClick={() => type._id && categoryService.removeTaskType(category.id, type._id).then(load)} className="text-slate-400 hover:text-[#dc2626]" aria-label={`Delete ${type.name}`}>
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-3 flex gap-2">
                <input id={`new-task-type-${category.id}`} name={`newTaskType${category.id}`} className="input" placeholder="Add new task type" value={newTypes[category.id] || ""} onChange={(e) => setNewTypes({ ...newTypes, [category.id]: e.target.value })} />
                <Button variant="ghost" onClick={() => addType(category.id)}>Add</Button>
              </div>
            </Card>
          );
        })}
      </div>

      {modal && (
        <div className="fixed inset-0 z-40 grid place-items-center bg-slate-900/35 p-4">
          <Card className="w-full max-w-lg p-4">
            <div className="mb-4 flex items-center justify-between">
              <div className="text-[16px] font-extrabold">{editingId ? "Edit Category" : "New Category"}</div>
              <button onClick={() => { setModal(false); setEditingId(null); }}><X /></button>
            </div>
            <div className="grid gap-3">
              <Field label="Name"><input id="category-name" name="categoryName" className="input" value={cat.name} onChange={(e) => setCat({ ...cat, name: e.target.value })} /></Field>
              <Field label="Icon"><input id="category-icon" name="categoryIcon" className="input" value={cat.icon} onChange={(e) => setCat({ ...cat, icon: e.target.value })} /></Field>
              <Field label="Color"><input id="category-color" name="categoryColor" className="h-10 w-24 rounded-lg border border-[#e2e8f0]" type="color" value={cat.color} onChange={(e) => setCat({ ...cat, color: e.target.value })} /></Field>
              <Field label="Description"><textarea id="category-description" name="categoryDescription" className="input textarea" value={cat.description} onChange={(e) => setCat({ ...cat, description: e.target.value })} /></Field>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => { setModal(false); setEditingId(null); }}>Cancel</Button>
              <Button onClick={saveCategory}>{editingId ? "Save Changes" : "Create"}</Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }) {
  return <label><span className="field-label">{label}</span>{children}</label>;
}
