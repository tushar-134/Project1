import { Plus, X } from "lucide-react";
import { useState, useEffect } from "react";
import { customFieldService } from "../../services/customFieldService";
import Button from "./Button.jsx";
import Card from "./Card.jsx";
import { toast } from "react-hot-toast";

export default function CustomFieldModal({ isOpen, onClose, onSave, editingId = null, initialData = null }) {
  const [field, setField] = useState({
    label: "",
    key: "",
    type: "text",
    options: [],
    required: false,
  });
  const [newOption, setNewOption] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (initialData) {
      setField({
        label: initialData.label || "",
        key: initialData.key || "",
        type: initialData.type || "text",
        options: initialData.options || [],
        required: !!initialData.required,
      });
    } else {
      setField({ label: "", key: "", type: "text", options: [], required: false });
    }
  }, [initialData, isOpen]);

  async function saveField() {
    if (!field.label || !field.key) return toast.error("Label and Key are required");
    setIsSaving(true);
    try {
      let savedField;
      if (editingId) {
        savedField = await customFieldService.update(editingId, field);
        toast.success("Field updated");
      } else {
        savedField = await customFieldService.create(field);
        toast.success("Field created");
      }
      onSave(savedField);
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save field");
    } finally {
      setIsSaving(false);
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

  if (!isOpen) return null;

  return (
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
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-200 hover:text-slate-600">
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
                onChange={(e) => {
                  const newLabel = e.target.value;
                  const newField = { ...field, label: newLabel };
                  if (!editingId) {
                    newField.key = newLabel.toLowerCase().trim().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
                  }
                  setField(newField);
                }}
              />
            </Field>

            <Field label="System Key" help="Unique identifier (no spaces)">
              <input
                className="input font-mono"
                placeholder="e.g. bank_name"
                disabled={!!editingId}
                value={field.key}
                onChange={(e) => setField({ ...field, key: e.target.value.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "") })}
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
                <option value="currency">Currency Amount</option>
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
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={saveField} disabled={isSaving}>
            {isSaving ? "Saving..." : editingId ? "Save Changes" : "Create Field"}
          </Button>
        </div>
      </Card>
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
