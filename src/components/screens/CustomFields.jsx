import { Plus, X, Trash2, Edit2, Settings2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useApp } from "../../context/AppContext.jsx";
import { customFieldService } from "../../services/customFieldService";
import Button from "../ui/Button.jsx";
import Card from "../ui/Card.jsx";
import CustomFieldModal from "../ui/CustomFieldModal.jsx";
import { toast } from "react-hot-toast";

export default function CustomFields() {
  const { state, dispatch } = useApp();
  const [modal, setModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editingData, setEditingData] = useState(null);

  const load = () =>
    customFieldService
      .list()
      .then((data) => {
        dispatch({ type: "SET_RESOURCE", resource: "customFields", payload: data });
      })
      .catch(() => toast.error("Failed to load custom fields"));

  useEffect(() => {
    load();
  }, []);

  function openCreateModal() {
    setEditingId(null);
    setEditingData(null);
    setModal(true);
  }

  function openEditModal(f) {
    setEditingId(f._id);
    setEditingData(f);
    setModal(true);
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

  const fields = state.customFields || [];

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
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

      <CustomFieldModal
        isOpen={modal}
        onClose={() => setModal(false)}
        onSave={() => load()}
        editingId={editingId}
        initialData={editingData}
      />
    </div>
  );
}
