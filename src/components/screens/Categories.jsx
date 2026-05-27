import { Pencil, Plus, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useApp } from "../../context/AppContext.jsx";
import { categoryService } from "../../services/categoryService";
import { mapCategory } from "../../utils/adapterUtils";
import Button from "../ui/Button.jsx";
import Card from "../ui/Card.jsx";
import Toggle from "../ui/Toggle.jsx";

// Default state for the Task Type modal — all visibility toggles start off for new task types.
const EMPTY_TASK_TYPE = { name: "", showPeriod: false, showRecurring: false, showAwaitingFta: false };

export default function Categories() {
  const { state, dispatch } = useApp();
  const [modal, setModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [cat, setCat] = useState({ name: "", icon: "Folder", color: "#1e3a8a", description: "" });

  // Task-type modal state
  const [ttModal, setTtModal] = useState(false);
  const [ttCategoryId, setTtCategoryId] = useState(null);
  const [ttEditingTypeId, setTtEditingTypeId] = useState(null);
  const [ttForm, setTtForm] = useState(EMPTY_TASK_TYPE);

  const load = () =>
    categoryService
      .list()
      .then((data) => dispatch({ type: "SET_RESOURCE", resource: "categories", payload: data.map(mapCategory) }))
      .catch(() => {});

  useEffect(() => { load(); }, []);

  // ── Category modal ──────────────────────────────────────────────────────────
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

  // ── Task-type modal ─────────────────────────────────────────────────────────
  function openAddTaskType(categoryId) {
    setTtCategoryId(categoryId);
    setTtEditingTypeId(null);
    setTtForm(EMPTY_TASK_TYPE); // new task types: all toggles default off
    setTtModal(true);
  }

  function openEditTaskType(categoryId, type) {
    setTtCategoryId(categoryId);
    setTtEditingTypeId(type._id);
    setTtForm({
      name: type.name || "",
      showPeriod: type.showPeriod ?? true,   // existing task types: respect saved value (DB defaults true)
      showRecurring: type.showRecurring ?? true,
      showAwaitingFta: type.showAwaitingFta ?? true,
    });
    setTtModal(true);
  }

  function closeTtModal() {
    setTtModal(false);
    setTtCategoryId(null);
    setTtEditingTypeId(null);
    setTtForm(EMPTY_TASK_TYPE);
  }

  async function saveTaskType() {
    if (!ttForm.name.trim()) return;
    if (ttEditingTypeId) {
      await categoryService.updateTaskType(ttCategoryId, ttEditingTypeId, ttForm);
    } else {
      await categoryService.addTaskType(ttCategoryId, ttForm);
    }
    closeTtModal();
    load();
  }

  async function toggleTaskType(categoryId, typeId, isActive) {
    if (!typeId) return;
    await categoryService.updateTaskTypeStatus(categoryId, typeId, isActive);
    load();
  }

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
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
                        {/* Field visibility badges */}
                        {type._id && (
                          <div className="flex items-center gap-1">
                            {[
                              { key: "showPeriod", label: "P" },
                              { key: "showRecurring", label: "R" },
                              { key: "showAwaitingFta", label: "F" },
                            ].map(({ key, label }) => (
                              <span
                                key={key}
                                title={`${key === "showPeriod" ? "Period" : key === "showRecurring" ? "Recurring" : "Awaiting FTA"}: ${type[key] !== false ? "Visible" : "Hidden"}`}
                                className={`rounded px-1.5 py-0.5 text-[9px] font-black leading-none ${
                                  type[key] !== false
                                    ? "bg-blue-100 text-blue-700"
                                    : "bg-slate-200 text-slate-400"
                                }`}
                              >
                                {label}
                              </span>
                            ))}
                          </div>
                        )}
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ${active ? "bg-emerald-50 text-[#059669]" : "bg-slate-200 text-slate-500"}`}>
                          {active ? "Active" : "Inactive"}
                        </span>
                        <Toggle checked={active} onChange={(next) => toggleTaskType(category.id, type._id, next)} />
                        <button
                          onClick={() => type._id && openEditTaskType(category.id, type)}
                          className="text-slate-400 hover:text-[#1e3a8a]"
                          aria-label={`Edit ${type.name}`}
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          onClick={() => type._id && categoryService.removeTaskType(category.id, type._id).then(load)}
                          className="text-slate-400 hover:text-[#dc2626]"
                          aria-label={`Delete ${type.name}`}
                        >
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Add Task Type button — opens modal instead of inline input */}
              <div className="mt-3">
                <Button variant="ghost" size="sm" onClick={() => openAddTaskType(category.id)}>
                  <Plus size={14} />Add Task Type
                </Button>
              </div>
            </Card>
          );
        })}
      </div>

      {/* ── Category modal ───────────────────────────────────────────────────── */}
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

      {/* ── Task Type modal ──────────────────────────────────────────────────── */}
      {ttModal && (
        <div className="fixed inset-0 z-40 grid place-items-center bg-slate-900/35 p-4">
          <Card className="w-full max-w-md p-4">
            <div className="mb-4 flex items-center justify-between">
              <div className="text-[16px] font-extrabold">{ttEditingTypeId ? "Edit Task Type" : "Add Task Type"}</div>
              <button onClick={closeTtModal}><X /></button>
            </div>

            <div className="grid gap-3">
              <Field label="Task Type Name">
                <input
                  id="tt-name"
                  name="ttName"
                  className="input"
                  placeholder="e.g. VAT Return"
                  value={ttForm.name}
                  onChange={(e) => setTtForm({ ...ttForm, name: e.target.value })}
                />
              </Field>
            </div>

            {/* Optional field visibility toggles */}
            <div className="mt-4 space-y-1">
              <div className="mb-2 text-[11px] font-extrabold uppercase tracking-[.08em] text-slate-500">
                Optional Fields Visibility
              </div>
              <p className="mb-3 text-[11px] text-slate-400">
                Control which optional fields appear when adding or editing a task of this type.
              </p>

              {[
                { key: "showPeriod", label: "Period", description: "The task period field (e.g. Q1 2026)" },
                { key: "showRecurring", label: "Recurring Task", description: "Recurring task toggle and schedule settings" },
                { key: "showAwaitingFta", label: "Awaiting FTA Response", description: "FTA response toggle for regulatory submissions" },
              ].map(({ key, label, description }) => (
                <div key={key} className="flex items-center justify-between rounded-lg border border-[#e2e8f0] px-3 py-2.5">
                  <div>
                    <div className="text-[13px] font-extrabold text-slate-800">{label}</div>
                    <div className="text-[11px] text-slate-400">{description}</div>
                  </div>
                  <Toggle
                    checked={ttForm[key]}
                    onChange={(val) => setTtForm({ ...ttForm, [key]: val })}
                  />
                </div>
              ))}
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <Button variant="ghost" onClick={closeTtModal}>Cancel</Button>
              <Button onClick={saveTaskType} disabled={!ttForm.name.trim()}>
                {ttEditingTypeId ? "Save Changes" : "Add Task Type"}
              </Button>
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
