import { useEffect, useState } from "react";
import { useApp } from "../../context/AppContext.jsx";
import { useTasks } from "../../hooks/useTasks";
import Badge from "../ui/Badge.jsx";
import Card from "../ui/Card.jsx";

const filters = ["All", "VAT Refund", "CT Registration", "VAT Registration", "Other"];
const statuses = ["In Review", "Additional Query From FTA", "Approved"];

export default function FtaTracker() {
  const { state } = useApp();
  const { fetchFtaTracker, updateFtaStatus } = useTasks();
  const [filter, setFilter] = useState("All");
  useEffect(() => { fetchFtaTracker(filter === "All" ? {} : { category: filter.includes("CT") ? "CT" : "VAT" }).catch(() => {}); }, [filter]);
  // The UI still uses user-friendly card labels, while the backend filter remains category-driven.
  const rows = state.ftaItems.filter((item) => filter === "All" || item.type.includes(filter.replace("CT", "CT")));
  return (
    <div className="space-y-5">
      <div><div className="page-kicker">FTA Response Queue</div><h2 className="screen-title">FTA Tracker — Submissions Awaiting FTA Response</h2></div>
      <div className="flex flex-wrap gap-2">{filters.map((f) => <button key={f} onClick={() => setFilter(f)} className={`rounded-full px-3 py-2 text-[12px] font-extrabold ${filter === f ? "bg-[#1e3a8a] text-white" : "bg-white text-slate-600 border border-[#e2e8f0]"}`}>{f}</button>)}</div>
      <div className="space-y-3">{rows.map((item) => <Card key={item.id} className={`p-4 ${item.status === "Additional Query From FTA" ? "bg-yellow-50 border-yellow-200" : ""}`}><div className="flex flex-wrap items-center justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-[#1e3a8a] px-2.5 py-1 text-[11px] font-black text-white">{item.taskId}</span><Badge>{item.category}</Badge></div><div className="mt-3 text-[15px] font-extrabold">{item.type}</div><div className="mt-1 text-[12px] font-semibold text-slate-500">{item.client} · Submitted {item.submitted} · {item.assigned}</div></div><select className="input w-64" value={item.status} onChange={(e) => updateFtaStatus(item.id, e.target.value).catch(() => fetchFtaTracker())}>{statuses.map((s) => <option key={s}>{s}</option>)}</select></div></Card>)}</div>
    </div>
  );
}
