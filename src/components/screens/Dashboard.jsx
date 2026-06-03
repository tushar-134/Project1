import { AlertTriangle, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Clock, FileText, Briefcase, Landmark, PieChart, Files, ClipboardList, Boxes, GripVertical, RotateCcw, Settings2, X, ShieldAlert } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../../context/AppContext.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { categoryService } from "../../services/categoryService.js";
import { reportService } from "../../services/reportService";
import { mapCategory } from "../../utils/adapterUtils.js";
import { clearDashboardTileOrder, clearDashboardTileVisibility, DEFAULT_DASHBOARD_TILE_ORDER, loadDashboardTileOrder, loadDashboardTileVisibility, saveDashboardTileOrder, saveDashboardTileVisibility, subscribeDashboardTileOrder } from "../../utils/dashboardPreferences.js";
import { canManageTasks } from "../../utils/permissions.js";
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
const categoryValuesByLabel = Object.fromEntries(
  Object.entries(categoryLabels).map(([value, label]) => [label, value])
);

function displayCategoryName(category) {
  return categoryLabels[category?.name] || category?.name || "";
}

function getCategoryFilterValue(categories, displayName) {
  const category = categories.find((item) => displayCategoryName(item) === displayName);
  return category?.name || categoryValuesByLabel[displayName] || displayName;
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
  const [month, setMonth] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });
  const [drawerTaskId, setDrawerTaskId] = useState(null);
  const [tileOrder, setTileOrder] = useState(DEFAULT_DASHBOARD_TILE_ORDER);
  const [visibleTileNames, setVisibleTileNames] = useState(DEFAULT_DASHBOARD_TILE_ORDER);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [draftTileOrder, setDraftTileOrder] = useState(DEFAULT_DASHBOARD_TILE_ORDER);
  const [draftVisibleTileNames, setDraftVisibleTileNames] = useState(DEFAULT_DASHBOARD_TILE_ORDER);
  const [draggingTile, setDraggingTile] = useState("");
  const settingsRef = useRef(null);
  const monthText = month.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  const canManage = canManageTasks(currentUser?.role);
  const moveMonth = (delta) => setMonth((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1));
  useEffect(() => {
    // Dashboard stats are month-sensitive, so the page refetches whenever the picker changes.
    let isCurrentRequest = true;
    const selected = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}`;
    reportService.dashboardStats({ month: selected }).then((data) => {
      if (isCurrentRequest) dispatch({ type: "SET_DASHBOARD", payload: data });
    }).catch(() => { });
    return () => {
      isCurrentRequest = false;
    };
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
    setVisibleTileNames(loadDashboardTileVisibility(currentUser, availableTileNames));
    return subscribeDashboardTileOrder((event) => {
      setTileOrder(event.detail?.order || loadDashboardTileOrder(currentUser, availableTileNames));
      setVisibleTileNames(event.detail?.visible || loadDashboardTileVisibility(currentUser, availableTileNames));
    });
  }, [currentUser, availableTileNames]);
  useEffect(() => {
    if (!settingsOpen) return;
    setDraftTileOrder(tileOrder);
    setDraftVisibleTileNames(visibleTileNames);
  }, [settingsOpen, tileOrder, visibleTileNames]);
  useEffect(() => {
    if (!settingsOpen) return undefined;
    const closeOnOutsideClick = (event) => {
      if (settingsRef.current && !settingsRef.current.contains(event.target)) {
        setSettingsOpen(false);
      }
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, [settingsOpen]);
  const stats = state.dashboardStats || {};
  const selectedMonth = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}`;
  const tileMetrics = new Map(
    (stats.categoryBreakdown || []).map((item) => [categoryLabels[item.category] || item.category, item])
  );
  const visibleTileSet = new Set(visibleTileNames);
  const tiles = tileOrder.filter((name) => visibleTileSet.has(name)).map((name) => {
    const metric = tileMetrics.get(name);
    return [name, metric?.active || 0, metric?.closed || 0, metric?.overdue || 0];
  });
  const draftVisibleSet = new Set(draftVisibleTileNames);
  const moveDraftTile = (targetName) => {
    if (!draggingTile || draggingTile === targetName) return;
    const fromIndex = draftTileOrder.indexOf(draggingTile);
    const toIndex = draftTileOrder.indexOf(targetName);
    if (fromIndex < 0 || toIndex < 0) return;
    const next = [...draftTileOrder];
    next.splice(fromIndex, 1);
    next.splice(toIndex, 0, draggingTile);
    setDraftTileOrder(next);
  };
  const toggleDraftTile = (name) => {
    setDraftVisibleTileNames((current) => {
      if (current.includes(name)) {
        return current.length > 1 ? current.filter((item) => item !== name) : current;
      }
      return draftTileOrder.filter((item) => item === name || current.includes(item));
    });
  };
  const saveDashboardSettings = () => {
    const nextOrder = saveDashboardTileOrder(currentUser, draftTileOrder, availableTileNames);
    const nextVisible = saveDashboardTileVisibility(currentUser, draftVisibleTileNames, availableTileNames);
    setTileOrder(nextOrder);
    setVisibleTileNames(nextVisible);
    setSettingsOpen(false);
  };
  const resetDashboardSettings = () => {
    const nextOrder = clearDashboardTileOrder(currentUser, availableTileNames);
    const nextVisible = clearDashboardTileVisibility(currentUser, availableTileNames);
    setDraftTileOrder(nextOrder);
    setDraftVisibleTileNames(nextVisible);
    setTileOrder(nextOrder);
    setVisibleTileNames(nextVisible);
  };
  const openTasks = (category) => {
    const params = new URLSearchParams({
      category: getCategoryFilterValue(state.categories, category),
      status: "Active",
      month: selectedMonth,
    });
    navigate(`/tasks/list?${params.toString()}`);
  };

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <div className="relative flex items-center gap-2" ref={settingsRef}>
          <div className="flex h-9 items-center overflow-hidden rounded-lg border border-[#e2e8f0] bg-white">
            <label className="relative flex h-full min-w-36 cursor-pointer items-center justify-center gap-2 px-4 text-[13px] font-extrabold transition-colors hover:bg-slate-50">
              <CalendarDays size={15} className="text-slate-500" />
              <span className="text-slate-800">{monthText}</span>
              <input
                type="month"
                value={`${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}`}
                onChange={(e) => {
                  if (!e.target.value) return;
                  const [y, m] = e.target.value.split("-");
                  setMonth(new Date(parseInt(y, 10), parseInt(m, 10) - 1, 1));
                }}
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                onClick={(e) => {
                  try {
                    e.target.showPicker();
                  } catch (err) {
                    // Ignore if showPicker is not supported
                  }
                }}
              />
            </label>
          </div>
          <button
            type="button"
            onClick={() => setSettingsOpen((open) => !open)}
            className="grid h-9 w-9 place-items-center rounded-lg border border-[#e2e8f0] bg-white text-[#1e3a8a] shadow-sm transition hover:bg-slate-50"
            aria-label="Dashboard card priority settings"
            title="Dashboard Card Priority"
          >
            <Settings2 size={17} />
          </button>
          {settingsOpen && (
            <div className="absolute right-0 top-11 z-30 w-[340px] max-w-[calc(100vw-2rem)] rounded-2xl border border-[#dbe4f0] bg-white shadow-[0_18px_45px_rgba(15,23,42,0.18)]">
              <div className="flex items-center justify-between border-b border-[#e2e8f0] px-4 py-3">
                <div>
                  <div className="text-[14px] font-black text-slate-900">Dashboard Card Priority</div>
                  <div className="text-[11px] font-semibold text-slate-500">Select cards and drag to arrange.</div>
                </div>
                <button type="button" onClick={() => setSettingsOpen(false)} className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 hover:bg-slate-100">
                  <X size={16} />
                </button>
              </div>
              <div className="max-h-[360px] space-y-2 overflow-y-auto p-3">
                {draftTileOrder.map((name, index) => {
                  const checked = draftVisibleSet.has(name);
                  return (
                    <div
                      key={name}
                      draggable
                      onDragStart={() => setDraggingTile(name)}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={() => moveDraftTile(name)}
                      onDragEnd={() => setDraggingTile("")}
                      className={`flex cursor-grab items-center justify-between gap-3 rounded-xl border bg-white px-3 py-2 transition ${draggingTile === name ? "border-[#1e3a8a] opacity-70" : "border-slate-200 hover:border-[#1e3a8a]/40"} ${checked ? "" : "opacity-55"}`}
                      title="Drag to reorder"
                    >
                      <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleDraftTile(name)}
                          className="h-4 w-4 rounded border-slate-300 text-[#1e3a8a] focus:ring-[#1e3a8a]"
                        />
                        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-slate-100 text-[11px] font-extrabold text-slate-500">{index + 1}</span>
                        <span className="truncate text-[13px] font-bold text-slate-800">{name}</span>
                      </label>
                      <GripVertical size={16} className="shrink-0 text-slate-400" />
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center justify-between border-t border-[#e2e8f0] px-3 py-3">
                <button
                  type="button"
                  onClick={resetDashboardSettings}
                  className="inline-flex h-9 items-center gap-2 rounded-lg px-3 text-[12px] font-extrabold text-slate-600 hover:bg-slate-100"
                >
                  <RotateCcw size={14} />
                  Reset
                </button>
                <button
                  type="button"
                  onClick={saveDashboardSettings}
                  className="h-9 rounded-lg bg-[#1e3a8a] px-4 text-[12px] font-extrabold text-white shadow-sm hover:bg-[#172f70]"
                >
                  Save Settings
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat icon={<FileText size={18} />} label="Total Clients" value={stats.totalClients || 0} color="text-[#1e3a8a]" onClick={() => navigate("/clients/list")} />
        <Stat icon={<Clock size={18} />} label="Pending Tasks" value={stats.pendingTasks || 0} color="text-[#eab308]" onClick={() => navigate(`/tasks/list?status=Active&month=${selectedMonth}`)} />
        <Stat icon={<AlertTriangle size={18} />} label="Overdue" value={stats.overdueTasks || 0} color="text-[#dc2626]" onClick={() => navigate(`/tasks/list?status=Active&scope=Overdue&overdue=true&month=${selectedMonth}`)} />
        <Stat icon={<ShieldAlert size={18} />} label="Expired Licences" value={stats.expiredLicences || 0} color="text-[#9333ea]" onClick={() => navigate("/clients/list?expired=true")} />
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

function Stat({ icon, label, value, color, onClick }) {
  return (
    <Card
      className={`flex items-center gap-3 p-4 transition ${
        onClick ? "cursor-pointer hover:-translate-y-0.5 hover:shadow-md" : ""
      }`}
      onClick={onClick}
    >
      <div className={`grid h-10 w-10 place-items-center rounded-xl bg-slate-50 ${color}`}>{icon}</div>
      <div>
        <div className="text-[11px] font-extrabold uppercase text-slate-500">{label}</div>
        <div className="text-[24px] font-black">{value}</div>
      </div>
    </Card>
  );
}
