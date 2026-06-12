import { AlertTriangle, CalendarDays, CalendarClock, CheckCircle2, ChevronLeft, ChevronRight, Clock, FileText, Briefcase, Landmark, PieChart, Files, ClipboardList, Boxes, GripVertical, RotateCcw, Settings2, X, ShieldAlert } from "lucide-react";
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
import { DATE_RANGE_OPTIONS, getDateRangeBounds } from "../../utils/dateRanges.js";

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
  const [dateRange, setDateRange] = useState("this_month");
  const [month, setMonth] = useState(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  });
  const [customFromDate, setCustomFromDate] = useState("");
  const [customToDate, setCustomToDate] = useState("");
  const [drawerTaskId, setDrawerTaskId] = useState(null);
  const [tileOrder, setTileOrder] = useState(DEFAULT_DASHBOARD_TILE_ORDER);
  const [visibleTileNames, setVisibleTileNames] = useState(DEFAULT_DASHBOARD_TILE_ORDER);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [draftTileOrder, setDraftTileOrder] = useState(DEFAULT_DASHBOARD_TILE_ORDER);
  const [draftVisibleTileNames, setDraftVisibleTileNames] = useState(DEFAULT_DASHBOARD_TILE_ORDER);
  const [draggingTile, setDraggingTile] = useState("");
  const settingsRef = useRef(null);

  const monthDate = useMemo(() => {
    if (!month) return new Date();
    const [y, m] = month.split("-");
    return new Date(parseInt(y, 10), parseInt(m, 10) - 1, 1);
  }, [month]);
  const monthText = monthDate.toLocaleDateString("en-GB", { month: "long", year: "numeric" });

  const canManage = canManageTasks(currentUser?.role);
  const moveMonth = (delta) => {
    const [y, m] = month.split("-");
    const nextDate = new Date(parseInt(y, 10), parseInt(m, 10) - 1 + delta, 1);
    setMonth(`${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, "0")}`);
  };

  useEffect(() => {
    let isCurrentRequest = true;
    let fromDate, toDate;
    if (dateRange === "custom") {
      fromDate = customFromDate || undefined;
      toDate = customToDate || undefined;
    } else {
      const bounds = getDateRangeBounds(dateRange);
      fromDate = bounds.fromDate;
      toDate = bounds.toDate;
    }
    const params = {
      month: dateRange === "specific_month" ? month : undefined,
      fromDate,
      toDate,
    };
    reportService.dashboardStats(params).then((data) => {
      if (isCurrentRequest) dispatch({ type: "SET_DASHBOARD", payload: data });
    }).catch(() => { });
    return () => {
      isCurrentRequest = false;
    };
  }, [month, dateRange, customFromDate, customToDate, dispatch]);
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
  const selectedMonth = month;
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
  // Builds a URLSearchParams object that mirrors the dashboard's current date
  // range selection so the task list opens with the exact same date filter.
  const buildTaskListParams = (extra = {}) => {
    const params = new URLSearchParams(extra);
    if (dateRange === "specific_month") {
      params.append("month", month);
    } else if (dateRange === "custom") {
      params.append("dateRange", "custom");
      if (customFromDate) params.append("fromDate", customFromDate);
      if (customToDate) params.append("toDate", customToDate);
    } else {
      params.append("dateRange", dateRange);
      // When "All time" is selected, tell the task list scope so it doesn't
      // misleadingly show "By Month" with no active month constraint.
      if (dateRange === "all") params.append("scope", "All");
    }
    return params;
  };

  const openTasks = (category) => {
    const params = buildTaskListParams({
      category: getCategoryFilterValue(state.categories, category),
      status: "Active",
    });
    navigate(`/tasks/list?${params.toString()}`);
  };

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <div className="relative flex flex-wrap items-center gap-3" ref={settingsRef}>
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-extrabold uppercase tracking-wide text-slate-500">Date Range</span>
            <select
              id="dashboard-date-range"
              className="input h-9 text-[13px] min-w-[130px] border border-[#e2e8f0] bg-white rounded-lg px-2 font-semibold"
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
            >
              {DATE_RANGE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {dateRange === "custom" && (
            <>
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-extrabold uppercase tracking-wide text-slate-500">From</span>
                <input
                  id="dashboard-from-date"
                  className="input h-9 text-[13px] w-[130px] border border-[#e2e8f0] bg-white rounded-lg px-2"
                  type="date"
                  value={customFromDate}
                  onChange={(e) => setCustomFromDate(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-extrabold uppercase tracking-wide text-slate-500">To</span>
                <input
                  id="dashboard-to-date"
                  className="input h-9 text-[13px] w-[130px] border border-[#e2e8f0] bg-white rounded-lg px-2"
                  type="date"
                  value={customToDate}
                  onChange={(e) => setCustomToDate(e.target.value)}
                />
              </div>
            </>
          )}

          {dateRange === "specific_month" && (
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-extrabold uppercase tracking-wide text-slate-500">Month</span>
              <div className="relative flex h-9 items-center overflow-hidden rounded-lg border border-[#e2e8f0] bg-white px-4 min-w-[130px] cursor-pointer hover:bg-slate-50 transition-colors">
                <CalendarDays size={15} className="text-slate-500 mr-2" />
                <span className="text-slate-800 text-[13px] font-extrabold">{monthText}</span>
                <input
                  type="month"
                  value={month}
                  onChange={(e) => {
                    if (e.target.value) setMonth(e.target.value);
                  }}
                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                  onClick={(e) => {
                    try {
                      e.target.showPicker();
                    } catch (err) {}
                  }}
                />
              </div>
            </div>
          )}

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
        <Stat
          icon={<Clock size={18} />}
          label="Pending Tasks"
          value={stats.pendingTasks || 0}
          color="text-[#eab308]"
          onClick={() => {
            const params = buildTaskListParams({ status: "Active" });
            navigate(`/tasks/list?${params.toString()}`);
          }}
        />
        <Stat
          icon={<AlertTriangle size={18} />}
          label="Overdue"
          value={stats.overdueTasks || 0}
          color="text-[#dc2626]"
          onClick={() => {
            navigate("/tasks/list?status=Active&scope=Overdue&dateRange=all");
          }}
        />
        <Stat
          icon={<ShieldAlert size={18} />}
          label="Licence Alerts"
          value={stats.licenceAlerts || 0}
          color="text-[#dc2626]"
          onClick={() => {
            navigate("/clients/list?licence_alerts=true");
          }}
        />
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
