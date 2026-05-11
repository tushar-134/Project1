import { cloneElement, isValidElement, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, Send } from "lucide-react";
import toast from "react-hot-toast";
import { useApp } from "../../context/AppContext.jsx";
import { useClients } from "../../hooks/useClients";
import { useUsers } from "../../hooks/useUsers";
import { useTasks } from "../../hooks/useTasks";
import { categoryService } from "../../services/categoryService";
import { mapCategory } from "../../utils/adapterUtils";
import Button from "../ui/Button.jsx";
import Card from "../ui/Card.jsx";
import Toggle from "../ui/Toggle.jsx";

export default function AddTask() {
  const { state, dispatch } = useApp();
  const navigate = useNavigate();
  const { fetchClients } = useClients();
  const { fetchUsers } = useUsers();
  const { createTask } = useTasks();
  const [step, setStep] = useState(1);
  const [categoryId, setCategoryId] = useState("vat");
  const category = state.categories.find((cat) => cat.id === categoryId);
  const [type, setType] = useState("VAT Return");
  const [recurring, setRecurring] = useState(false);
  const [fta, setFta] = useState(false);
  const [details, setDetails] = useState({ client: "", assigned: "", dueDate: "2026-05-31", period: "Q2 2026", description: "", frequency: "monthly", nextDue: "2026-06-30", endDate: "" });
  const chips = useMemo(() => category?.taskTypes || [], [category]);
  useEffect(() => {
    // The task wizard needs lookup data up front so each step can stay synchronous and snappy.
    fetchClients({ limit: 100 }).catch(() => {});
    fetchUsers().catch(() => {});
    categoryService.list().then((data) => dispatch({ type: "SET_RESOURCE", resource: "categories", payload: data.map(mapCategory) })).catch(() => {});
  }, []);

  function selectCategory(id) {
    const next = state.categories.find((cat) => cat.id === id);
    setCategoryId(id);
    setType(next.taskTypes[0] || "");
    setStep(2);
  }
  async function submit() {
    if (!details.client) {
      toast.error("Please select a client before submitting the task.");
      return;
    }
    if (!details.dueDate) {
      toast.error("Please choose a due date before submitting the task.");
      return;
    }
    try {
      await createTask({
        category: category.name,
        taskType: type,
        client: details.client,
        assignedTo: details.assigned || undefined,
        dueDate: details.dueDate,
        period: details.period,
        description: details.description,
        isRecurring: recurring,
        recurringConfig: recurring ? { frequency: details.frequency, nextDueDate: details.nextDue, endDate: details.endDate || undefined } : undefined,
        isAwaitingFta: fta,
        status: fta ? "submitted_to_fta" : "not_started",
      });
      toast.success("Task created successfully.");
      navigate("/tasks/list");
    } catch (error) {
      const message = error?.response?.data?.errors?.[0]?.msg || error?.response?.data?.message || "Unable to create task right now.";
      toast.error(message);
    }
  }

  return (
    <div className="space-y-5">
      <div><div className="page-kicker">Task Workflow</div><h2 className="screen-title">Add Task</h2></div>
      <div className="grid gap-3 md:grid-cols-3">{["Select Category", "Select Task Type", "Task Details"].map((label, i) => <Step key={label} n={i + 1} active={step >= i + 1} label={label} />)}</div>
      {step === 1 && <Card className="p-4"><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{state.categories.map((cat) => <button key={cat.id} onClick={() => selectCategory(cat.id)} className="rounded-xl border border-[#e2e8f0] bg-white p-4 text-left transition hover:border-[#1e3a8a] hover:shadow"><div className="mb-3 h-2 w-10 rounded-full" style={{ background: cat.color }} /><div className="font-extrabold">{cat.name}</div><div className="mt-1 text-[12px] text-slate-500">{cat.taskTypes.length} task types</div></button>)}</div></Card>}
      {step === 2 && <Card className="p-4"><div className="mb-3 text-[14px] font-extrabold">Task types for {category.name}</div><div className="flex flex-wrap gap-2">{chips.map((chip) => <button key={chip} onClick={() => setType(chip)} className={`rounded-full px-3 py-2 text-[12px] font-extrabold ${type === chip ? "bg-[#1e3a8a] text-white" : "bg-slate-100 text-slate-600"}`}>{chip}</button>)}</div><div className="mt-5 flex gap-2"><Button variant="ghost" onClick={() => setStep(1)}>Back</Button><Button onClick={() => setStep(3)}>Continue</Button></div></Card>}
      {step === 3 && (
        <Card className="p-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Client*" field="taskClient"><select className="input" value={details.client} onChange={(e) => setDetails({ ...details, client: e.target.value })}><option value="">Select client</option>{state.clients.map((c) => <option key={c.id} value={c._id}>{c.name}</option>)}</select></Field>
            <Field label="Assign To" field="taskAssignedTo"><select className="input" value={details.assigned} onChange={(e) => setDetails({ ...details, assigned: e.target.value })}><option value="">Unassigned</option>{state.users.map((u) => <option key={u.id} value={u._id}>{u.name}</option>)}</select></Field>
            <Field label="Due Date*" field="taskDueDate"><input className="input" type="date" value={details.dueDate} onChange={(e) => setDetails({ ...details, dueDate: e.target.value })} /></Field>
            <Field label="Period" field="taskPeriod"><input className="input" value={details.period} onChange={(e) => setDetails({ ...details, period: e.target.value })} /></Field>
            <Field label="Description / Notes" field="taskDescription"><textarea className="input textarea" value={details.description} onChange={(e) => setDetails({ ...details, description: e.target.value })} /></Field>
          </div>
          <ToggleRow label="Recurring Task" checked={recurring} onChange={setRecurring} />
          <div className={`smooth-panel overflow-hidden ${recurring ? "max-h-44 opacity-100" : "max-h-0 opacity-0"}`}><div className="mt-3 grid gap-3 rounded-xl bg-slate-50 p-3 md:grid-cols-3"><Field label="Frequency" field="taskRecurringFrequency"><select className="input" value={details.frequency} onChange={(e) => setDetails({ ...details, frequency: e.target.value })}><option value="monthly">Monthly</option><option value="quarterly">Quarterly</option><option value="annual">Annually</option></select></Field><Field label="Next Due Date" field="taskNextDueDate"><input className="input" type="date" value={details.nextDue} onChange={(e) => setDetails({ ...details, nextDue: e.target.value })} /></Field><Field label="End Date" field="taskRecurringEndDate"><input className="input" type="date" value={details.endDate} onChange={(e) => setDetails({ ...details, endDate: e.target.value })} /></Field></div></div>
          <ToggleRow label="Awaiting FTA Response" checked={fta} onChange={setFta} />
          <div className={`smooth-panel overflow-hidden ${fta ? "max-h-20 opacity-100" : "max-h-0 opacity-0"}`}><div className="mt-3 rounded-xl border border-yellow-200 bg-yellow-50 p-3 text-[12px] font-semibold text-yellow-800">This task will be routed to FTA Tracker when submitted.</div></div>
          <div className="mt-5 flex gap-2"><Button variant="ghost" onClick={() => setStep(2)}>Back</Button><Button onClick={submit}><Send size={16} />Submit Task</Button></div>
        </Card>
      )}
    </div>
  );
}
function Step({ n, label, active }) { return <div className={`flex items-center gap-3 rounded-xl border p-3 ${active ? "border-[#1e3a8a] bg-white" : "border-[#e2e8f0] bg-white/60"}`}><div className={`grid h-7 w-7 place-items-center rounded-full text-[12px] font-black ${active ? "bg-[#1e3a8a] text-white" : "bg-slate-200 text-slate-500"}`}>{active ? <Check size={15} /> : n}</div><div className="font-extrabold">{label}</div></div>; }
function Field({ label, field, children }) {
  const control = isValidElement(children)
    ? cloneElement(children, {
        id: children.props.id || field,
        name: children.props.name || field,
      })
    : children;
  return <label htmlFor={field}><span className="field-label">{label}</span>{control}</label>;
}
function ToggleRow({ label, checked, onChange }) { return <div className="mt-4 flex items-center justify-between rounded-xl border border-[#e2e8f0] p-3"><span className="font-extrabold">{label}</span><Toggle checked={checked} onChange={onChange} /></div>; }
