import { AlertTriangle, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Clock, FileText, Briefcase, Landmark, PieChart, Files, ClipboardList, Boxes } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../../context/AppContext.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { categoryService } from "../../services/categoryService.js";
import { reportService } from "../../services/reportService";
import { mapCategory } from "../../utils/adapterUtils.js";
import { DEFAULT_DASHBOARD_TILE_ORDER, loadDashboardTileOrder, subscribeDashboardTileOrder } from "../../utils/dashboardPreferences.js";
import { canManageTasks, ROLE_LABELS } from "../../utils/permissions.js";
import Badge from "../ui/Badge.jsx";
import Card from "../ui/Card.jsx";
import StatusPill from "../ui/StatusPill.jsx";
import Table from "../ui/Table.jsx";
import TaskDrawer from "../ui/TaskDrawer.jsx";

const categoryLabels = {
  CT: "Corporate Tax",
  MIS: "MIS Reporting",
  EInv: "E-Invoicing",
  Refund: "VAT Refund",
};

function displayCategoryName(category) {
  return categoryLabels[category?.name] || category?.name || "";
}

function getTileMeta(name) {
  switch (name) {
    case "VAT":
      return { icon: <Landmark size={18} />, color: "text-[#0284c7]" };
    case "Corporate Tax":
      return { icon: <Briefcase size={18} />, color: "text-[#1e3a8a]" };
    case "Audit":
      return { icon: <ClipboardList size={18} />, color: "text-[#4f46e5]" };
    case "Accounting":
      return { icon: <Boxes size={18} />, color: "text-[#059669]" };
    case "MIS Reporting":
      return { icon: <PieChart size={18} />, color: "text-[#eab308]" };
    case "E-Invoicing":
      return { icon: <Files size={18} />, color: "text-[#16a34a]" };
    case "VAT Refund":
      return { icon: <CheckCircle2 size={18} />, color: "text-[#dc2626]" };
    default:
      return { icon: <FileText size={18} />, color: "text-slate-500" };
  }
}

export default function Dashboard() {
  const { state, dispatch } = useApp();
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [month, setMonth] = useState(new Date(2026, 4, 1));
  const [drawerTaskId, setDrawerTaskId] = useState(null);
  const [tileOrder, setTileOrder] = useState(DEFAULT_DASHBOARD_TILE_ORDER);
  const monthText = month.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  const roleLabel = ROLE_LABELS[currentUser?.role] || currentUser?.role || "User";
  const canManage = canManageTasks(currentUser?.role);
  const moveMonth = (delta) => setMonth(new Date(month.getFullYear(), month.getMonth() + delta, 1));
  useEffect(() => {
    // Dashboard stats are month-sensitive, so the page refetches whenever the picker changes.
    const selected = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}`;
    reportService.dashboardStats({ month: selected }).then((data) => dispatch({ type: "SET_DASHBOARD", payload: data })).catch(() => { });
  }, [month, dispatch]);
  useEffect(() => {
    categoryService.list()
      .then((data) => dispatch({ type: "SET_RESOURCE", resource: "categories", payload: data.map(mapCategory) }))
      .catch(() => {});
  }, [dispatch]);
  const availableTileNames = useMemo(() => {
    const names = state.categories.map(displayCategoryName).filter(Boolean);
    return names.length ? names : DEFAULT_DASHBOARD_TILE_ORDER;
  }, [state.categories]);
  useEffect(() => {
    setTileOrder(loadDashboardTileOrder(currentUser, availableTileNames));
    return subscribeDashboardTileOrder((event) => {
      setTileOrder(event.detail?.order || loadDashboardTileOrder(currentUser, availableTileNames));
    });
  }, [currentUser, availableTileNames]);
  const stats = state.dashboardStats || {};
  const selectedMonth = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}`;
  const tileMetrics = new Map(
    (stats.categoryBreakdown || []).map((item) => [categoryLabels[item.category] || item.category, item])
  );
  const tiles = tileOrder.map((name) => {
    const metric = tileMetrics.get(name);
    return [name, metric?.active || 0, metric?.closed || 0, metric?.overdue || 0];
  });
  const openTasks = (category) => {
    const params = new URLSearchParams({ category, month: selectedMonth });
    navigate(`/tasks/list?${params.toString()}`);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="page-kicker">Practice Overview</div>
          <h2 className="screen-title">Dashboard</h2>
          <div className="mt-2 inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-[12px] font-extrabold text-slate-700 shadow-[inset_0_0_0_1px_#e2e8f0]">
            <span className="text-slate-500">Logged in as</span>
            <span>{currentUser?.name || "User"}</span>
            <span className="rounded-full bg-[#1e3a8a] px-2 py-0.5 text-[11px] text-white">{roleLabel}</span>
          </div>
        </div>
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

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {tiles.map(([name, active, closed, overdue]) => {
          const { icon, color } = getTileMeta(name);
          return (
            <Card 
              key={name} 
              className="cursor-pointer transition hover:-translate-y-0.5 hover:shadow-md overflow-hidden" 
              onClick={() => openTasks(name)}
            >
              {/* Tile header — category name + icon + overdue badge */}
              <div className="flex items-center justify-between gap-2 px-4 pt-3 pb-2">
                <div className="flex items-center gap-2.5">
                  <div className={`grid h-8 w-8 place-items-center rounded-lg bg-slate-50 ${color}`}>
                    {icon}
                  </div>
                  <div className="text-[12px] font-extrabold uppercase tracking-wide text-slate-600">{name}</div>
                </div>
                {overdue > 0 && (
                  <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-extrabold text-[#dc2626]">
                    {overdue} overdue
                  </span>
                )}
              </div>
              {/* Split body — Active | Closed */}
              <div className="grid grid-cols-2 divide-x divide-[#e2e8f0] border-t border-[#e2e8f0]">
                <div className="px-4 py-3 text-center">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">Pending</div>
                  <div className="mt-0.5 text-[22px] font-black text-slate-800">{active}</div>
                </div>
                <div className="px-4 py-3 text-center">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#0284c7]">Closed</div>
                  <div className="mt-0.5 text-[22px] font-black text-slate-800">{closed}</div>
                </div>
              </div>
            </Card>
          );
        })}
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
              const taskMongoId = task._id || item._id;
              return (
                <tr key={item._id || item.taskId}>
                  <td className="font-extrabold text-[#1e3a8a]">
                    {taskMongoId ? (
                      <button
                        className="task-id-link"
                        onClick={() => (canManage ? setDrawerTaskId(taskMongoId) : navigate(`/tasks/${taskMongoId}`))}
                        title={canManage ? "Open task details" : "View task details"}
                      >
                        {task.taskId || item.taskId}
                      </button>
                    ) : (
                      task.taskId || item.taskId
                    )}
                  </td><td>{task.client?.legalName || item.client || "—"}</td><td><Badge>{task.category || item.category || "Other"}</Badge></td><td>{task.taskType || item.task}</td><td>{task.dueDate?.slice?.(0, 10) || item.createdAt?.slice?.(0, 10)}</td><td>{item.user?.name || item.user || "—"}</td><td><StatusPill status={item.newStatus || item.action} /></td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      </Card>

      {canManage && drawerTaskId && (
        <TaskDrawer taskId={drawerTaskId} canManage={canManage} onClose={() => setDrawerTaskId(null)} />
      )}
    </div>
  );
}

function Stat({ icon, label, value, color }) {
  return <Card className="flex items-center gap-3 p-4"><div className={`grid h-10 w-10 place-items-center rounded-xl bg-slate-50 ${color}`}>{icon}</div><div><div className="text-[11px] font-extrabold uppercase text-slate-500">{label}</div><div className="text-[24px] font-black">{value}</div></div></Card>;
}
