import { AlertCircle, CheckCircle2, Clock, Filter, Info, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import { useApp } from "../../context/AppContext.jsx";
import { useTasks } from "../../hooks/useTasks";
import Badge from "../ui/Badge.jsx";
import Button from "../ui/Button.jsx";
import Card from "../ui/Card.jsx";
import Table from "../ui/Table.jsx";

const CATEGORY_FILTERS = ["All", "VAT", "Corporate Tax", "Audit", "Accounting", "MIS Reporting", "E-Invoicing", "VAT Refund", "Other"];

// Maps display tab label -> ftaStatus value stored in state after mapFtaTask()
const TABS = [
  {
    id: "in_review",
    label: "In Review",
    statusMatch: "In Review",
    icon: Clock,
    color: "#1e3a8a",
    bg: "bg-blue-50",
    text: "text-[#1e3a8a]",
    border: "border-[#1e3a8a]",
    description: "Initial state for all FTA submissions. Tasks remain here until FTA takes action.",
  },
  {
    id: "additional_query",
    label: "Additional Query (FTA)",
    statusMatch: "Additional Query From FTA",
    icon: AlertCircle,
    color: "#d97706",
    bg: "bg-yellow-50",
    text: "text-yellow-700",
    border: "border-yellow-500",
    description: "FTA has asked for more information. The firm must respond before status can advance.",
  },
  {
    id: "approved",
    label: "Approved",
    statusMatch: "Approved",
    icon: CheckCircle2,
    color: "#059669",
    bg: "bg-green-50",
    text: "text-green-700",
    border: "border-green-500",
    description: "FTA has approved the application. Task moves here and is removed from the active tracker view.",
    readOnly: true,
  },
];

const FTA_STATUSES = ["In Review", "Additional Query From FTA", "Approved"];

export default function FtaTracker() {
  const { currentUser } = useAuth();
  const isTaskOnly = currentUser?.role === "task_only";
  const { state } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const { fetchFtaTracker, updateFtaStatus } = useTasks();
  const [activeTab, setActiveTab] = useState("in_review");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [loading, setLoading] = useState(false);

  function refresh() {
    setLoading(true);
    fetchFtaTracker({}).catch(() => {}).finally(() => setLoading(false));
  }

  // Re-fetch every time the user navigates to this page
  useEffect(() => {
    refresh();
  }, [location.pathname]);


  const currentTab = TABS.find((t) => t.id === activeTab);

  // Apply category filter then split by FTA status
  const filtered = state.ftaItems.filter(
    (item) => categoryFilter === "All" || item.category === categoryFilter
  );

  // Items for the current tab
  const tabItems = filtered.filter((item) => item.status === currentTab.statusMatch);

  // Count badges per tab
  const countFor = (tab) =>
    filtered.filter((item) => item.status === tab.statusMatch).length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="page-kicker">FTA Response Queue</div>
          <h2 className="screen-title">FTA Submission Tracker</h2>
          <p className="mt-1 text-[13px] text-slate-500">
            Dedicated module for managing submissions that require FTA to review and respond. Triggered when any task
            status is set to &apos;Submitted to FTA&apos;.
          </p>
        </div>
        <Button variant="ghost" onClick={refresh} disabled={loading}>
          <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
          Refresh
        </Button>
      </div>

      {/* Task-only info banner */}
      {isTaskOnly && (
        <div className="flex items-center gap-2.5 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-[13px] text-blue-800">
          <Info size={15} className="shrink-0 text-blue-500" />
          <span>You are viewing FTA tasks <strong>assigned to you only</strong>. Contact your manager to update FTA status.</span>
        </div>
      )}

      {/* Category filter */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[#e2e8f0] bg-white p-3">
        <span className="mr-1 flex items-center gap-1.5 text-[11px] font-extrabold uppercase text-slate-500">
          <Filter size={12} /> Category
        </span>
        {CATEGORY_FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setCategoryFilter(f)}
            className={`rounded-full px-3 py-1.5 text-[12px] font-extrabold transition-colors ${
              categoryFilter === f
                ? "bg-[#1e3a8a] text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Tab bar */}
      <div className="flex flex-wrap gap-0 overflow-hidden rounded-xl border border-[#e2e8f0] bg-white">
        {TABS.map((tab, idx) => {
          const Icon = tab.icon;
          const count = countFor(tab);
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex flex-1 min-w-[160px] items-center justify-center gap-2 px-5 py-4 text-[13px] font-extrabold transition-all border-b-2 ${
                isActive
                  ? `${tab.border} ${tab.text} bg-white`
                  : "border-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-700"
              } ${idx > 0 ? "border-l border-l-[#e2e8f0]" : ""}`}
              style={isActive ? { borderBottomColor: tab.color } : {}}
            >
              <Icon size={15} style={{ color: isActive ? tab.color : undefined }} />
              {tab.label}
              {count > 0 && (
                <span
                  className="ml-1 rounded-full px-2 py-0.5 text-[11px] font-extrabold"
                  style={
                    isActive
                      ? { background: tab.color, color: "#fff" }
                      : { background: "#f1f5f9", color: "#64748b" }
                  }
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Table */}
      <Card>
        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-400 text-[13px]">Loading…</div>
        ) : tabItems.length === 0 ? (
          <EmptyState tab={currentTab} />
        ) : (
          <Table>
            <thead>
              <tr>
                <th>Task ID</th>
                <th>Client</th>
                <th>Category</th>
                <th>FTA Task</th>
                <th>Due Date</th>
                <th>Submitted On</th>
                <th>Assigned</th>
                <th>FTA Status</th>
                <th>Recurring</th>
                {!isTaskOnly && <th>Edit</th>}
              </tr>
            </thead>
            <tbody>
              {tabItems.map((item) => (
                <tr
                  key={item.id}
                  className={
                    currentTab.id === "additional_query"
                      ? "bg-yellow-50/60"
                      : currentTab.id === "approved"
                      ? "opacity-80"
                      : ""
                  }
                >
                  <td className="font-extrabold text-[#1e3a8a]">{item.taskId}</td>
                  <td>{item.client}</td>
                  <td>
                    <Badge>{item.category}</Badge>
                  </td>
                  <td>{item.type}</td>
                  <td>
                    <div>{item.dueDate}</div>
                    {item.overdueDays > 0 && (
                      <span className="mt-1 inline-flex rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-extrabold text-[#dc2626]">
                        {item.overdueDays}d overdue
                      </span>
                    )}
                  </td>
                  <td>{item.submitted || "—"}</td>
                  <td>{item.assigned}</td>
                  <td>
                    {/* task_only: always read-only badge; others: dropdown unless tab is readOnly */}
                    {isTaskOnly || currentTab.readOnly ? (
                      <FtaStatusBadge status={item.status} />
                    ) : (
                      <select
                        id={`fta-status-${item.id}`}
                        name={`ftaStatus${item.id}`}
                        className="input h-8 min-w-48"
                        value={item.status}
                        onChange={(e) =>
                          updateFtaStatus(item.id, e.target.value).catch(() =>
                            fetchFtaTracker({})
                          )
                        }
                      >
                        {FTA_STATUSES.map((s) => (
                          <option key={s}>{s}</option>
                        ))}
                      </select>
                    )}
                  </td>
                  <td>
                    {item.recurring && (
                      <span className="rounded-full bg-blue-50 px-2 py-1 text-[11px] font-extrabold text-[#1e3a8a]">
                        Recurring
                      </span>
                    )}
                  </td>
                  {!isTaskOnly && (
                    <td>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => navigate(`/tasks/edit/${item.id}`, { state: { task: item } })}
                      >
                        Edit
                      </Button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}

function EmptyState({ tab }) {
  const Icon = tab.icon;
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <div
        className="flex h-12 w-12 items-center justify-center rounded-full"
        style={{ background: tab.color + "18" }}
      >
        <Icon size={22} style={{ color: tab.color }} />
      </div>
      <div className="text-[14px] font-extrabold text-slate-700">No tasks in "{tab.label}"</div>
      <div className="max-w-xs text-[13px] text-slate-400">{tab.description}</div>
    </div>
  );
}

function FtaStatusBadge({ status }) {
  if (status === "Approved") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-3 py-1 text-[11px] font-extrabold text-green-700">
        <CheckCircle2 size={11} /> Approved
      </span>
    );
  }
  if (status === "Additional Query From FTA") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 px-3 py-1 text-[11px] font-extrabold text-yellow-700">
        <AlertCircle size={11} /> Additional Query
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-3 py-1 text-[11px] font-extrabold text-[#1e3a8a]">
      <Clock size={11} /> In Review
    </span>
  );
}
