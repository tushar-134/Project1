import { AlertTriangle, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Clock, FileText } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../../context/AppContext.jsx";
import { reportService } from "../../services/reportService";
import Badge from "../ui/Badge.jsx";
import Button from "../ui/Button.jsx";
import Card from "../ui/Card.jsx";
import StatusPill from "../ui/StatusPill.jsx";
import Table from "../ui/Table.jsx";

// Bug #12 Fix: removed the hardcoded serviceTiles fallback so the dashboard
// never shows fake numbers (7 VAT tasks, 4 CT tasks, etc.) when the API fails.
// The UI now always shows real zeros instead of misleading placeholder counts.

export default function Dashboard() {
  const { state, dispatch } = useApp();
  const navigate = useNavigate();
  const [month, setMonth] = useState(new Date(2026, 4, 1));
  const [overdueAlerts, setOverdueAlerts] = useState([]);
  const monthText = month.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  const moveMonth = (delta) => setMonth(new Date(month.getFullYear(), month.getMonth() + delta, 1));
  useEffect(() => {
    // Dashboard stats are month-sensitive, so the page refetches whenever the picker changes.
    const selected = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}`;
    reportService.dashboardStats({ month: selected }).then((data) => dispatch({ type: "SET_DASHBOARD", payload: data })).catch(() => {});
    reportService.overdue().then((tasks) => {
      setOverdueAlerts(tasks.filter((task) => task.dueDate?.slice?.(0, 7) === selected));
    }).catch(() => setOverdueAlerts([]));
  }, [month, dispatch]);
  const stats = state.dashboardStats || {};
  const tiles = stats.categoryBreakdown?.length
    ? stats.categoryBreakdown.map((item) => [item.category, item.pending, item.overdue])
    : [];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><div className="page-kicker">Practice Overview</div><h2 className="screen-title">Dashboard</h2></div>
        <div className="flex h-9 items-center overflow-hidden rounded-lg border border-[#e2e8f0] bg-white">
          <button onClick={() => moveMonth(-1)} className="grid h-9 w-9 place-items-center hover:bg-slate-50"><ChevronLeft size={16} /></button>
          <div className="min-w-36 px-3 text-center text-[12px] font-extrabold">{monthText}</div>
          <button onClick={() => moveMonth(1)} className="grid h-9 w-9 place-items-center hover:bg-slate-50"><ChevronRight size={16} /></button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Stat icon={<FileText size={18} />} label="Total Clients" value={stats.totalClients || 0} color="text-[#1e3a8a]" />
        <Stat icon={<Clock size={18} />} label="Pending Tasks" value={stats.pendingTasks || 0} color="text-[#eab308]" />
        <Stat icon={<AlertTriangle size={18} />} label="Overdue" value={stats.overdueTasks || 0} color="text-[#dc2626]" />
      </div>

      {(stats.overdueTasks || overdueAlerts.length) > 0 && (
        <Card className="overflow-hidden border-red-100">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-red-100 bg-red-50 px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="grid h-9 w-9 place-items-center rounded-lg bg-white text-[#dc2626]">
                <AlertTriangle size={18} />
              </div>
              <div>
                <div className="text-[14px] font-extrabold text-[#991b1b]">Overdue Alerts</div>
                <div className="text-[12px] font-semibold text-red-700">{stats.overdueTasks || overdueAlerts.length} task{(stats.overdueTasks || overdueAlerts.length) === 1 ? "" : "s"} need attention in {monthText}</div>
              </div>
            </div>
            <Button size="sm" variant="danger" onClick={() => navigate("/tasks/list")}>View Tasks</Button>
          </div>
          <div className="divide-y divide-red-100">
            {overdueAlerts.slice(0, 5).map((task) => (
              <button key={task._id} onClick={() => navigate(`/tasks/edit/${task._id}`)} className="flex w-full flex-col gap-2 px-4 py-3 text-left hover:bg-red-50/60 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-extrabold text-[#1e3a8a]">{task.taskId}</span>
                    <Badge>{task.category || "Other"}</Badge>
                    <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-extrabold text-[#dc2626]">{task.daysOverdue}d overdue</span>
                  </div>
                  <div className="mt-1 font-semibold text-slate-900">{task.taskType}</div>
                  <div className="mt-0.5 text-[12px] font-semibold text-slate-500">{task.client?.legalName || "No client"} | Due {task.dueDate?.slice?.(0, 10)} | {task.assignedTo?.name || "Unassigned"}</div>
                </div>
              </button>
            ))}
            {overdueAlerts.length === 0 && <div className="px-4 py-3 text-[13px] font-semibold text-red-700">Overdue tasks were found for this month. Open the task list to review them.</div>}
            {overdueAlerts.length > 5 && <div className="px-4 py-3 text-[12px] font-bold text-slate-500">{overdueAlerts.length - 5} more overdue task{overdueAlerts.length - 5 === 1 ? "" : "s"} hidden</div>}
          </div>
        </Card>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {tiles.map(([name, pending, overdue]) => (
          <Card key={name} className="cursor-pointer p-4 transition hover:-translate-y-0.5 hover:shadow-md">
            <div className="mb-3 h-1 w-10 rounded-full bg-[#eab308]" />
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[13px] font-extrabold">{name}</div>
                <div className="mt-1 text-[12px] font-semibold text-slate-500">Open service tasks</div>
              </div>
              <div className="grid h-9 w-9 place-items-center rounded-lg bg-slate-50 text-[#1e3a8a]"><CheckCircle2 size={17} /></div>
            </div>
            <div className="mt-4 flex items-center justify-between">
              <div className="text-[24px] font-black">{pending}</div>
              {overdue > 0 && <span className="rounded-full bg-red-50 px-2 py-1 text-[11px] font-extrabold text-[#dc2626]">{overdue} overdue</span>}
            </div>
          </Card>
        ))}
      </div>

      <Card>
        <div className="flex items-center justify-between border-b border-[#e2e8f0] px-4 py-3">
          <div><div className="text-[14px] font-extrabold">Recent Activity</div><div className="text-[11px] font-semibold text-slate-500">Latest task movements</div></div>
          <CalendarDays size={18} className="text-slate-400" />
        </div>
        <Table>
          <thead><tr><th>Task ID</th><th>Client</th><th>Category</th><th>Task Type</th><th>Due Date</th><th>Assigned To</th><th>Status</th></tr></thead>
          <tbody>
            {(state.activity || []).map((item) => {
              const task = item.task || item;
              return (
              <tr key={item._id || item.taskId}>
                <td className="font-extrabold text-[#1e3a8a]">{task.taskId || item.taskId}</td><td>{task.client?.legalName || item.client || "—"}</td><td><Badge>{task.category || item.category || "Other"}</Badge></td><td>{task.taskType || item.task}</td><td>{task.dueDate?.slice?.(0, 10) || item.createdAt?.slice?.(0, 10)}</td><td>{item.user?.name || item.user || "—"}</td><td><StatusPill status={item.newStatus || item.action} /></td>
              </tr>
            );})}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}

function Stat({ icon, label, value, color }) {
  return <Card className="flex items-center gap-3 p-4"><div className={`grid h-10 w-10 place-items-center rounded-xl bg-slate-50 ${color}`}>{icon}</div><div><div className="text-[11px] font-extrabold uppercase text-slate-500">{label}</div><div className="text-[24px] font-black">{value}</div></div></Card>;
}
