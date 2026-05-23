import { Download } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useApp } from "../../context/AppContext.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { useUsers } from "../../hooks/useUsers.js";
import { useTasks } from "../../hooks/useTasks";
import { downloadBlob } from "../../utils/adapterUtils";
import { canManageTasks } from "../../utils/permissions.js";
import Badge from "../ui/Badge.jsx";
import Button from "../ui/Button.jsx";
import Card from "../ui/Card.jsx";
import Table from "../ui/Table.jsx";
import TaskDrawer from "../ui/TaskDrawer.jsx";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────
const ALL_STATUSES    = ["Not Yet Started", "WIP", "Submitted to FTA", "Completed"];
const FILTER_STATUSES = ["All", "Not Yet Started", "WIP", "Submitted to FTA", "Completed"];
const CAT_ORDER       = ["VAT", "Corporate Tax", "Audit", "Accounting", "MIS Reporting", "E-Invoicing", "VAT Refund", "Other"];
const categoryLabels  = { CT: "Corporate Tax", MIS: "MIS Reporting", EInv: "E-Invoicing", Refund: "VAT Refund" };

const STATUS_PILL = {
  "Not Yet Started": { bg: "bg-slate-100",  text: "text-slate-600"  },
  WIP:               { bg: "bg-blue-50",    text: "text-blue-700"   },
  Completed:         { bg: "bg-green-100",  text: "text-green-700"  },
  "Submitted to FTA":{ bg: "bg-purple-50",  text: "text-purple-700" },
};

const actionMeta = {
  "Created":             { color: "#059669", bg: "bg-emerald-50", border: "border-emerald-200", icon: "✦" },
  "Updated":             { color: "#0ea5e9", bg: "bg-sky-50",     border: "border-sky-200",     icon: "✎" },
  "Status Changed":      { color: "#7c3aed", bg: "bg-purple-50",  border: "border-purple-200",  icon: "⟳" },
  "FTA Status Changed":  { color: "#ea580c", bg: "bg-orange-50",  border: "border-orange-200",  icon: "◉" },
  "Generated Recurrence":{ color: "#0891b2", bg: "bg-cyan-50",    border: "border-cyan-200",    icon: "↻" },
};
function getActionMeta(action) {
  return actionMeta[action] || { color: "#64748b", bg: "bg-slate-50", border: "border-slate-200", icon: "•" };
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
function formatDate(d)     { if (!d) return "—"; return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }); }
function formatDateTime(d) { if (!d) return "—"; const dt = new Date(d); return dt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) + " at " + dt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }); }
function daysOverdue(due, status) { if (!due || status === "completed") return 0; return Math.max(0, Math.ceil((new Date() - new Date(due)) / 86400000)); }

// ─────────────────────────────────────────────────────────────────────────────
// StatusPill (local, matches TaskList pill)
// ─────────────────────────────────────────────────────────────────────────────
function TaskStatusPill({ status }) {
  const { bg, text } = STATUS_PILL[status] || { bg: "bg-slate-100", text: "text-slate-500" };
  return <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-extrabold ${bg} ${text}`}>{status}</span>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Task Detail Drawer
// ─────────────────────────────────────────────────────────────────────────────
function TaskDrawer({ taskId, onClose, canManage }) {
  const navigate = useNavigate();
  const drawerRef = useRef(null);
  const [task, setTask]       = useState(null);
  const [logs, setLogs]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [visible, setVisible] = useState(false);

  // Animate in
  useEffect(() => { requestAnimationFrame(() => setVisible(true)); }, []);

  // Close on Escape
  useEffect(() => {
    function onKey(e) { if (e.key === "Escape") handleClose(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // Lock body scroll while drawer is open
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  function handleClose() {
    setVisible(false);
    setTimeout(onClose, 280);
  }

  // Load task data
  useEffect(() => {
    if (!taskId) return;
    let active = true;
    setLoading(true); setError(null);
    Promise.all([taskService.get(taskId), taskService.getLogs(taskId)])
      .then(([t, l]) => { if (active) { setTask(t); setLogs(l); } })
      .catch((err) => { if (active) setError(err.response?.data?.message || "Failed to load task"); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [taskId]);

  const displayStatus   = task ? (statusFromApi[task.status]   || task.status)   : "";
  const displayCategory = task ? (categoryLabels[task.category] || task.category) : "";
  const overdue         = task ? daysOverdue(task.dueDate, task.status) : 0;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={handleClose}
        style={{
          position: "fixed", inset: 0, zIndex: 9998,
          background: "rgba(15,23,42,.35)",
          opacity: visible ? 1 : 0,
          transition: "opacity .28s ease",
          backdropFilter: "blur(2px)",
        }}
      />

      {/* Drawer panel */}
      <div
        ref={drawerRef}
        style={{
          position: "fixed", top: 0, right: 0, bottom: 0, zIndex: 9999,
          width: "min(520px, 96vw)",
          background: "#fff",
          boxShadow: "-8px 0 40px rgba(15,23,42,.18)",
          display: "flex", flexDirection: "column",
          transform: visible ? "translateX(0)" : "translateX(100%)",
          transition: "transform .28s cubic-bezier(.4,0,.2,1)",
          overflowY: "auto",
        }}
      >
        {/* ── Drawer header ── */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "16px 20px", borderBottom: "1px solid #f1f5f9",
          background: "#fff", position: "sticky", top: 0, zIndex: 10,
        }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".06em" }}>Task Detail</div>
            <div style={{ fontSize: 17, fontWeight: 800, color: "#0f172a", display: "flex", alignItems: "center", gap: 8 }}>
              {task?.taskId || "Loading…"}
              {overdue > 0 && (
                <span style={{ fontSize: 11, fontWeight: 700, color: "#dc2626", background: "#fef2f2", borderRadius: 20, padding: "2px 8px", display: "inline-flex", alignItems: "center", gap: 4 }}>
                  <AlertTriangle size={11} /> {overdue}d overdue
                </span>
              )}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {task && (
              <button
                title="Open full page"
                onClick={() => navigate(`/tasks/${task._id}`)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b", display: "flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 600 }}
              >
                <ExternalLink size={14} /> Full page
              </button>
            )}
            <button
              onClick={handleClose}
              style={{ width: 32, height: 32, borderRadius: 8, border: "1px solid #e2e8f0", background: "#f8fafc", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#64748b" }}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* ── Drawer body ── */}
        <div style={{ flex: 1, padding: "20px", overflowY: "auto" }}>
          {loading && (
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: 200 }}>
              <div className="task-detail-loader" />
            </div>
          )}
          {error && (
            <div style={{ textAlign: "center", padding: 40 }}>
              <AlertTriangle size={36} style={{ color: "#dc2626", margin: "0 auto 12px" }} />
              <div style={{ fontSize: 13, color: "#64748b" }}>{error}</div>
            </div>
          )}
          {!loading && !error && task && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

              {/* Status + type header */}
              <div style={{ background: "#f8fafc", borderRadius: 12, padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", border: "1px solid #f1f5f9" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: "#1e3a8a", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Briefcase size={18} color="#fff" />
                  </div>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase" }}>Task Type</div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: "#0f172a" }}>{task.taskType}</div>
                  </div>
                </div>
                <StatusPill status={displayStatus} />
              </div>

              {/* Info grid */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                {[
                  { icon: <User size={13}/>,     label: "Client",      value: task.client?.legalName || "—",     sub: task.client?.fileNo },
                  { icon: <Tag size={13}/>,      label: "Category",    value: <Badge>{displayCategory}</Badge> },
                  { icon: <Calendar size={13}/>, label: "Due Date",    value: formatDate(task.dueDate), red: overdue > 0 },
                  { icon: <User size={13}/>,     label: "Assigned To", value: task.assignedTo?.name || "Unassigned", sub: task.assignedTo?.email },
                  task.period && { icon: <Clock size={13}/>,    label: "Period",      value: task.period },
                  { icon: <User size={13}/>,     label: "Created By",  value: task.createdBy?.name || "—" },
                  task.isRecurring && { icon: <RotateCw size={13}/>, label: "Recurring", value: <span style={{ fontSize: 11, fontWeight: 700, color: "#1e3a8a", background: "#eff6ff", borderRadius: 20, padding: "3px 10px" }}>{task.recurringConfig?.frequency || "Yes"}</span> },
                  task.isAwaitingFta && { icon: <AlertTriangle size={13}/>, label: "FTA Status", value: <StatusPill status={ftaStatusFromApi[task.ftaStatus] || task.ftaStatus || "—"} /> },
                ].filter(Boolean).map((field, i) => (
                  <div key={i} style={{ background: "#fafafa", borderRadius: 10, padding: "10px 12px", border: "1px solid #f1f5f9" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", marginBottom: 4 }}>
                      {field.icon} {field.label}
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: field.red ? "#dc2626" : "#1e293b" }}>{field.value}</div>
                    {field.sub && <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>{field.sub}</div>}
                  </div>
                ))}
              </div>

              {/* Description */}
              {task.description && (
                <div style={{ background: "#fafafa", borderRadius: 10, padding: "12px 14px", border: "1px solid #f1f5f9" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", marginBottom: 6 }}>
                    <FileText size={13} /> Description
                  </div>
                  <p style={{ fontSize: 13, color: "#475569", lineHeight: 1.6 }}>{task.description}</p>
                </div>
              )}

              {/* Timestamps */}
              <div style={{ fontSize: 11, color: "#94a3b8", display: "flex", gap: 12 }}>
                <span>Created {formatDateTime(task.createdAt)}</span>
                <span>•</span>
                <span>Updated {formatDateTime(task.updatedAt)}</span>
              </div>

              {/* Edit button */}
              {canManage && (
                <button
                  onClick={() => navigate(`/tasks/edit/${task._id}`, { state: { task } })}
                  style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", padding: "10px", borderRadius: 10, border: "1.5px solid #c7d7f8", background: "#eff6ff", color: "#1e3a8a", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
                >
                  <Pencil size={14} /> Edit Task
                </button>
              )}

              {/* Activity Log */}
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                  <div style={{ width: 30, height: 30, borderRadius: 8, background: "#1e3a8a", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Clock size={14} color="#fff" />
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 800, color: "#0f172a" }}>Activity Log</span>
                  <span style={{ borderRadius: 20, background: "#f1f5f9", padding: "2px 8px", fontSize: 11, fontWeight: 700, color: "#64748b" }}>{logs.length}</span>
                </div>

                {logs.length === 0 ? (
                  <div style={{ textAlign: "center", padding: 24, background: "#fafafa", borderRadius: 10, border: "1px solid #f1f5f9" }}>
                    <Clock size={28} style={{ color: "#cbd5e1", margin: "0 auto 8px" }} />
                    <div style={{ fontSize: 12, color: "#94a3b8" }}>No activity recorded yet</div>
                  </div>
                ) : (
                  <div className="task-log-timeline">
                    {logs.map((log, idx) => {
                      const meta = getActionMeta(log.action);
                      const isLast = idx === logs.length - 1;
                      return (
                        <div key={log._id} className="task-log-entry">
                          <div className="task-log-connector">
                            <div className="task-log-dot" style={{ backgroundColor: meta.color, boxShadow: `0 0 0 4px ${meta.color}22` }}>
                              <span style={{ color: "#fff", fontSize: 9 }}>{meta.icon}</span>
                            </div>
                            {!isLast && <div className="task-log-line" />}
                          </div>
                          <Card className={`task-log-card ${meta.bg} ${meta.border}`}>
                            <div className="task-log-card-header">
                              <span style={{ fontSize: 13, fontWeight: 800, color: meta.color }}>{log.action}</span>
                              <span style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600 }}>{formatDateTime(log.createdAt)}</span>
                            </div>
                            <div className="task-log-card-body">
                              <div style={{ fontSize: 12, color: "#475569" }}>
                                <span style={{ fontWeight: 700, color: "#334155" }}>{log.user?.name || "System"}</span>
                                {log.user?.role && <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, color: "#94a3b8", background: "rgba(255,255,255,.8)", border: "1px solid #e2e8f0", borderRadius: 20, padding: "1px 6px" }}>{log.user.role}</span>}
                              </div>
                              {(log.previousStatus || log.newStatus) && (
                                <div className="task-log-status-change">
                                  {log.previousStatus && <><StatusPill status={statusFromApi[log.previousStatus] || ftaStatusFromApi[log.previousStatus] || log.previousStatus} /><span style={{ color: "#94a3b8", fontSize: 12, fontWeight: 700 }}>→</span></>}
                                  {log.newStatus && <StatusPill status={statusFromApi[log.newStatus] || ftaStatusFromApi[log.newStatus] || log.newStatus} />}
                                </div>
                              )}
                              {log.notes && <div style={{ fontSize: 12, color: "#94a3b8", fontStyle: "italic", marginTop: 4 }}>{log.notes}</div>}
                            </div>
                          </Card>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Filter pill bar
// ─────────────────────────────────────────────────────────────────────────────
function Filter({ label, items, value, setValue, compact }) {
  return (
    <div className={`flex flex-wrap items-center gap-2 ${compact ? "" : "rounded-xl border border-[#e2e8f0] bg-white p-3"}`}>
      <span className="mr-1 text-[11px] font-extrabold uppercase text-slate-500">{label}</span>
      {items.map((item) => (
        <button
          key={item}
          onClick={() => setValue(item)}
          className={`rounded-full px-3 py-1.5 text-[12px] font-extrabold ${value === item ? "bg-[#1e3a8a] text-white" : "bg-slate-100 text-slate-600"}`}
        >
          {item}
        </button>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main TaskList screen
// ─────────────────────────────────────────────────────────────────────────────
export default function TaskList() {
  const { state }       = useApp();
  const { currentUser } = useAuth();
  const navigate        = useNavigate();
  const [searchParams]  = useSearchParams();
  const { fetchTasks, updateStatus, updateAssignee, exportTasks } = useTasks();
  const [cat, setCat]     = useState(searchParams.get("category") || "All");
  const [status, setStatus] = useState("All");
  const [scope, setScope]   = useState("By Month");
  const [month, setMonth]   = useState(searchParams.get("month") || "2026-05");
  const [drawerTaskId, setDrawerTaskId] = useState(null); // task _id to show in drawer

  const canManage  = canManageTasks(currentUser?.role);
  const isTaskOnly = currentUser?.role === "task_only";
  const { fetchUsers } = useUsers();

  useEffect(() => { if (canManage) fetchUsers().catch(() => {}); }, [canManage]);

  const filterRef = useRef({});
  filterRef.current = { category: cat, status, month: scope === "By Month" ? month : undefined, overdue: scope === "Overdue" ? "true" : undefined };
  const refetchTasks = useCallback(() => fetchTasks(filterRef.current).catch(() => {}), [fetchTasks]);

  const [availableCats, setAvailableCats] = useState(["All"]);
  useEffect(() => {
    fetchTasks(filterRef.current)
      .then((tasks) => {
        if (cat === "All") {
          const found = new Set(tasks.map((t) => t.category));
          setAvailableCats(["All", ...CAT_ORDER.filter((c) => found.has(c))]);
        }
      })
      .catch(() => {});
  }, [cat, status, scope, month]);

  const rows = state.tasks;
  const exportCsv = async () =>
    downloadBlob(await exportTasks({ category: cat, status, month: scope === "By Month" ? month : undefined, overdue: scope === "Overdue" ? "true" : undefined }), "tasks.csv");

  return (
    <div className="space-y-5">
      {/* Drawer */}
      {drawerTaskId && (
        <TaskDrawer
          taskId={drawerTaskId}
          canManage={canManage}
          onClose={() => setDrawerTaskId(null)}
        />
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="page-kicker">Task Control</div>
          <h2 className="screen-title">Task List</h2>
        </div>
        {canManage && (
          <Button variant="ghost" onClick={exportCsv}>
            <Download size={16} /> Export CSV
          </Button>
        )}
      </div>

      <Filter label="Category" items={availableCats} value={cat} setValue={setCat} />
      <Filter label="Status"   items={FILTER_STATUSES} value={status} setValue={setStatus} />

      <div className="flex flex-wrap items-center gap-2">
        <Filter label="Scope" items={["By Month", "Overdue", "All"]} value={scope} setValue={setScope} compact />
        <input id="task-list-month" name="taskListMonth" className="input w-40" type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
      </div>

      {isTaskOnly && (
        <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-2.5 text-[12px] font-medium text-blue-700">
          You can update status only for tasks assigned to you.
        </div>
      )}

      <Card>
        <Table>
          <thead>
            <tr>
              <th>Task ID</th>
              <th>Client</th>
              <th>Category</th>
              <th>Task Type</th>
              <th>Due Date</th>
              <th>Assigned</th>
              <th>Status</th>
              <th>Recurring</th>
              {canManage && <th>Edit</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((task) => {
              const canChangeStatus = canManage || (isTaskOnly && String(task.assignedId) === String(currentUser?._id || currentUser?.id));
              return (
                <tr key={task.id}>
                  <td className="font-extrabold text-[#1e3a8a]">
                    {/* Click → open drawer instead of navigate */}
                    <button
                      className="task-id-link"
                      onClick={() => setDrawerTaskId(task.id)}
                      title="View task details"
                    >
                      {task.taskId}
                    </button>
                  </td>
                  <td>{task.client}</td>
                  <td><Badge>{task.category}</Badge></td>
                  <td>{task.type}</td>
                  <td>
                    <div>{task.dueDate}</div>
                    {task.overdueDays > 0 && (
                      <span className="mt-1 inline-flex rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-extrabold text-[#dc2626]">
                        {task.overdueDays}d overdue
                      </span>
                    )}
                  </td>
                  <td>
                    {canManage ? (
                      <select
                        id={`task-assignee-${task.id}`}
                        className="input h-8 min-w-36"
                        value={task.assignedId || ""}
                        onChange={(e) => {
                          const selected = state.users.find((u) => u._id === e.target.value || u.id === e.target.value);
                          updateAssignee(task.id, e.target.value || null, selected?.name || "Unassigned").catch(() => fetchTasks());
                        }}
                      >
                        <option value="">Unassigned</option>
                        {state.users.map((u) => <option key={u._id || u.id} value={u._id || u.id}>{u.name}</option>)}
                      </select>
                    ) : (
                      <span>{task.assigned}</span>
                    )}
                  </td>
                  <td>
                    {canChangeStatus ? (
                      <select
                        id={`task-status-${task.id}`}
                        name={`taskStatus${task.id}`}
                        className="input h-8 min-w-40"
                        value={task.displayStatus ?? task.status}
                        onChange={(e) => updateStatus(task.id, e.target.value).then(() => refetchTasks()).catch(() => refetchTasks())}
                      >
                        {ALL_STATUSES.map((s) => <option key={s}>{s}</option>)}
                      </select>
                    ) : (
                      <TaskStatusPill status={task.status} />
                    )}
                  </td>
                  <td>
                    {task.recurring && (
                      <span className="rounded-full bg-blue-50 px-2 py-1 text-[11px] font-extrabold text-[#1e3a8a]">Recurring</span>
                    )}
                  </td>
                  {canManage && (
                    <td>
                      <Button size="sm" variant="ghost" onClick={() => navigate(`/tasks/edit/${task.id}`, { state: { task } })}>
                        Edit
                      </Button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
