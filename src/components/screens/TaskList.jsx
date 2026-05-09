import { Download } from "lucide-react";
import { useEffect, useState } from "react";
import { useApp } from "../../context/AppContext.jsx";
import { useTasks } from "../../hooks/useTasks";
import { downloadBlob } from "../../utils/adapterUtils";
import Badge from "../ui/Badge.jsx";
import Button from "../ui/Button.jsx";
import Card from "../ui/Card.jsx";
import Table from "../ui/Table.jsx";

const statuses = ["All", "Not Yet Started", "WIP", "Completed", "Submitted to FTA"];
const cats = ["All", "VAT", "Corporate Tax", "Audit", "Accounting", "MIS Reporting", "E-Invoicing", "Other"];

export default function TaskList() {
  const { state } = useApp();
  const { fetchTasks, updateStatus, exportTasks } = useTasks();
  const [cat, setCat] = useState("All");
  const [status, setStatus] = useState("All");
  const [scope, setScope] = useState("By Month");
  const [month, setMonth] = useState("2026-05");
  useEffect(() => {
    // Filters are translated directly into API query params so server-side role rules still apply.
    fetchTasks({ category: cat, status, month: scope === "By Month" ? month : undefined, overdue: scope === "Overdue" ? "true" : undefined }).catch(() => {});
  }, [cat, status, scope, month]);
  const rows = state.tasks;
  const exportCsv = async () => downloadBlob(await exportTasks({ category: cat, status, month: scope === "By Month" ? month : undefined, overdue: scope === "Overdue" ? "true" : undefined }), "tasks.csv");
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><div className="page-kicker">Task Control</div><h2 className="screen-title">Task List</h2></div><Button variant="ghost" onClick={exportCsv}><Download size={16} />Export CSV</Button></div>
      <Filter label="Category" items={cats} value={cat} setValue={setCat} />
      <Filter label="Status" items={statuses} value={status} setValue={setStatus} />
      <div className="flex flex-wrap items-center gap-2"><Filter label="Scope" items={["By Month", "Overdue", "All"]} value={scope} setValue={setScope} compact /><input className="input w-40" type="month" value={month} onChange={(e) => setMonth(e.target.value)} /></div>
      <Card><Table><thead><tr><th>Task ID</th><th>Client</th><th>Category</th><th>Task Type</th><th>Due Date</th><th>Assigned</th><th>Status</th><th>Recurring</th><th>Edit</th></tr></thead><tbody>{rows.map((task) => <tr key={task.id}><td className="font-extrabold text-[#1e3a8a]">{task.taskId}</td><td>{task.client}</td><td><Badge>{task.category}</Badge></td><td>{task.type}</td><td><div>{task.dueDate}</div>{task.overdueDays > 0 && <span className="mt-1 inline-flex rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-extrabold text-[#dc2626]">{task.overdueDays}d overdue</span>}</td><td>{task.assigned}</td><td><select className="input h-8 min-w-36" value={task.status} onChange={(e) => updateStatus(task.id, e.target.value).catch(() => fetchTasks())}>{statuses.filter(s => s !== "All").map((s) => <option key={s}>{s}</option>)}</select></td><td>{task.recurring && <span className="rounded-full bg-blue-50 px-2 py-1 text-[11px] font-extrabold text-[#1e3a8a]">Recurring</span>}</td><td><Button size="sm" variant="ghost">Edit</Button></td></tr>)}</tbody></Table></Card>
    </div>
  );
}
function Filter({ label, items, value, setValue, compact }) { return <div className={`flex flex-wrap items-center gap-2 ${compact ? "" : "rounded-xl border border-[#e2e8f0] bg-white p-3"}`}><span className="mr-1 text-[11px] font-extrabold uppercase text-slate-500">{label}</span>{items.map((item) => <button key={item} onClick={() => setValue(item)} className={`rounded-full px-3 py-1.5 text-[12px] font-extrabold ${value === item ? "bg-[#1e3a8a] text-white" : "bg-slate-100 text-slate-600"}`}>{item}</button>)}</div>; }
