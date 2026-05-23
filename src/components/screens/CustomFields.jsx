import { Plus, X, Trash2, Edit2, Settings2, GripVertical } from "lucide-react";
import { useEffect, useState } from "react";
import { useApp } from "../../context/AppContext.jsx";
import { customFieldService } from "../../services/customFieldService";
import Button from "../ui/Button.jsx";
import Card from "../ui/Card.jsx";
import { toast } from "react-hot-toast";

export default function CustomFields() {
  const { dispatch } = useApp();
  const [fields, setFields] = useState([]);
  const [modal, setModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [field, setField] = useState({
    label: "",
    key: "",
    type: "text",
    options: [],
    required: false,
  });
  const [newOption, setNewOption] = useState("");

  const load = () =>
    customFieldService
      .list()
      .then((data) => {
        setFields(data);
        dispatch({ type: "SET_RESOURCE", resource: "customFields", payload: data });
      })
      .catch(() => toast.error("Failed to load custom fields"));

  useEffect(() => {
    load();
  }, []);

  function openCreateModal() {
    setEditingId(null);
    setField({ label: "", key: "", type: "text", options: [], required: false });
    setModal(true);
  }

  function openEditModal(f) {
    setEditingId(f._id);
    setField({
      label: f.label || "",
      key: f.key || "",
      type: f.type || "text",
      options: f.options || [],
      required: !!f.required,
    });
    setModal(true);
  }

  async function saveField() {
    if (!field.label || !field.key) return toast.error("Label and Key are required");
    try {
      if (editingId) {
        await customFieldService.update(editingId, field);
        toast.success("Field updated");
      } else {
        await customFieldService.create(field);
        toast.success("Field created");
      }
      setModal(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save field");
    }
  }

  async function deleteField(id) {
    if (!window.confirm("Are you sure? Existing data for this field will be hidden.")) return;
    try {
      await customFieldService.remove(id);
      toast.success("Field removed");
      load();
    } catch (err) {
      toast.error("Failed to remove field");
    }
  }

  const addOption = () => {
    if (!newOption.trim()) return;
    setField({ ...field, options: [...field.options, newOption.trim()] });
    setNewOption("");
  };

  const removeOption = (index) => {
    setField({ ...field, options: field.options.filter((_, i) => i !== index) });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="page-kicker">Data Extension</div>
          <h2 className="screen-title">Custom Client Fields</h2>
        </div>
        <Button onClick={openCreateModal}>
          <Plus size={16} /> New Field
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {fields.map((f) => (
          <Card key={f._id} className="group relative overflow-hidden border-slate-200 transition-all hover:border-blue-300 hover:shadow-md">
            <div className="p-4">
              <div className="mb-3 flex items-start justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="grid h-8 w-8 place-items-center rounded-lg bg-blue-50 text-blue-600">
                    <Settings2 size={16} />
                  </div>
                  <div>
                    <div className="text-[13px] font-extrabold text-slate-900">{f.label}</div>
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{f.type}</div>
                  </div>
                </div>
                <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <button onClick={() => openEditModal(f)} className="p-1.5 text-slate-400 hover:text-blue-600">
                    <Edit2 size={14} />
                  </button>
                  <button onClick={() => deleteField(f._id)} className="p-1.5 text-slate-400 hover:text-red-600">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-bold text-slate-500">System Key</span>
                  <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-slate-600">{f.key}</code>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-bold text-slate-500">Required</span>
                  <span className={`font-extrabold ${f.required ? "text-amber-600" : "text-slate-400"}`}>
                    {f.required ? "YES" : "NO"}
                  </span>
                </div>
                {f.type === "select" && (
                  <div className="mt-2 border-t border-slate-100 pt-2">
                    <div className="mb-1 text-[10px] font-bold uppercase text-slate-400">Options</div>
                    <div className="flex flex-wrap gap-1">
                      {f.options?.map((opt) => (
                        <span key={opt} className="rounded-md bg-slate-50 px-2 py-0.5 text-[10px] font-bold text-slate-600 border border-slate-100">
                          {opt}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </Card>
        ))}

        {fields.length === 0 && (
          <div className="col-span-full flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 py-12 text-slate-400">
            <Settings2 size={40} strokeWidth={1.5} className="mb-3 opacity-20" />
            <div className="text-sm font-bold">No custom fields created yet</div>
            <div className="text-[11px]">Add fields to extend client profiles</div>
          </div>
        )}
      </div>

      {modal && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-slate-900/40 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <Card className="w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-5 py-4">
              <div className="flex items-center gap-2">
                <div className="grid h-7 w-7 place-items-center rounded-lg bg-blue-600 text-white">
                  <Plus size={14} />
                </div>
                <h3 className="text-sm font-extrabold text-slate-900">
                  {editingId ? "Edit Custom Field" : "Create Custom Field"}
                </h3>
              </div>
              <button onClick={() => setModal(false)} className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-200 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            <div className="max-h-[70vh] overflow-y-auto p-5">
              <div className="space-y-4">
                <Field label="Field Label" help="Visible to users in forms">
                  <input
                    className="input"
                    placeholder="e.g. Bank Name"
                    value={field.label}
                    onChange={(e) => setField({ ...field, label: e.target.value })}
                  />
                </Field>

                <Field label="System Key" help="Unique identifier (no spaces)">
                  <input
                    className="input font-mono"
                    placeholder="e.g. bank_name"
                    disabled={!!editingId}
                    value={field.key}
                    onChange={(e) => setField({ ...field, key: e.target.value.toLowerCase().replace(/\s+/g, "_") })}
                  />
                </Field>

                <Field label="Field Type">
                  <select
                    className="input"
                    value={field.type}
                    onChange={(e) => setField({ ...field, type: e.target.value, options: e.target.value === "select" ? field.options : [] })}
                  >
                    <option value="text">Short Text</option>
                    <option value="number">Number</option>
                    <option value="date">Date</option>
                    <option value="select">Dropdown Select</option>
                  </select>
                </Field>

                {field.type === "select" && (
                  <div className="space-y-2 rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
                    <label className="text-[11px] font-extrabold text-slate-700">Dropdown Options</label>
                    <div className="flex gap-2">
                      <input
                        className="input h-9"
                        placeholder="Option name"
                        value={newOption}
                        onChange={(e) => setNewOption(e.target.value)}
                        onKeyPress={(e) => e.key === "Enter" && addOption()}
                      />
                      <Button variant="ghost" className="h-9 px-3" onClick={addOption}>Add</Button>
                    </div>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {field.options.map((opt, i) => (
                        <span key={i} className="flex items-center gap-1 rounded-lg bg-white px-2 py-1 text-[11px] font-bold text-slate-600 shadow-sm ring-1 ring-slate-200">
                          {opt}
                          <button onClick={() => removeOption(i)} className="text-slate-300 hover:text-red-500">
                            <X size={12} />
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-2 pt-2">
                  <input
                    type="checkbox"
                    id="is-required"
                    className="h-4 w-4 rounded border-slate-300 text-blue-600"
                    checked={field.required}
                    onChange={(e) => setField({ ...field, required: e.target.checked })}
                  />
                  <label htmlFor="is-required" className="text-[12px] font-bold text-slate-700 cursor-pointer">
                    This field is mandatory
                  </label>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-slate-100 bg-slate-50/50 px-5 py-4">
              <Button variant="ghost" onClick={() => setModal(false)}>Cancel</Button>
              <Button onClick={saveField}>
                {editingId ? "Save Changes" : "Create Field"}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

function Field({ label, help, children }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="text-[12px] font-extrabold text-slate-700">{label}</label>
        {help && <span className="text-[10px] font-bold text-slate-400">{help}</span>}
      </div>
      {children}
    </div>
  );
}
