/**
 * TaskDrawer — right-side sliding panel showing task detail + activity log.
 * Used by TaskList and Dashboard (admin/manager only).
 *
 * Props:
 *   taskId   : string  — Mongo _id of the task to load
 *   canManage: boolean — show Edit button if true
 *   onClose  : fn      — called when the drawer should close
 */
import {
  AlertTriangle, Briefcase, Calendar, Clock,
  ExternalLink, FileText, Pencil, RotateCw, Tag, User, X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { taskService } from "../../services/taskService.js";
import { statusFromApi, ftaStatusFromApi } from "../../utils/adapterUtils.js";
import Badge from "./Badge.jsx";
import Card from "./Card.jsx";
import StatusPill from "./StatusPill.jsx";

// ── helpers ────────────────────────────────────────────────────────────────
const categoryLabels = { CT: "Corporate Tax", MIS: "MIS Reporting", EInv: "E-Invoicing", Refund: "VAT Refund" };

function formatDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}
function formatDateTime(d) {
  if (!d) return "—";
  const dt = new Date(d);
  return dt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) +
    " at " + dt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}
function daysOverdue(due, status) {
  if (!due || status === "completed") return 0;
  return Math.max(0, Math.ceil((new Date() - new Date(due)) / 86400000));
}

const actionMeta = {
  "Created":             { color: "#059669", bg: "bg-emerald-50", border: "border-emerald-200", icon: "✦" },
  "Updated":             { color: "#0ea5e9", bg: "bg-sky-50",     border: "border-sky-200",     icon: "✎" },
  "Status Changed":      { color: "#7c3aed", bg: "bg-purple-50",  border: "border-purple-200",  icon: "⟳" },
  "FTA Status Changed":  { color: "#ea580c", bg: "bg-orange-50",  border: "border-orange-200",  icon: "◉" },
  "Generated Recurrence":{ color: "#0891b2", bg: "bg-cyan-50",    border: "border-cyan-200",    icon: "↻" },
};
function getActionMeta(a) {
  return actionMeta[a] || { color: "#64748b", bg: "bg-slate-50", border: "border-slate-200", icon: "•" };
}

// ── component ──────────────────────────────────────────────────────────────
export default function TaskDrawer({ taskId, canManage, onClose }) {
  const navigate    = useNavigate();
  const drawerRef   = useRef(null);
  const [task, setTask]       = useState(null);
  const [logs, setLogs]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [visible, setVisible] = useState(false);

  // Slide in
  useEffect(() => { requestAnimationFrame(() => setVisible(true)); }, []);

  // Escape key
  useEffect(() => {
    function onKey(e) { if (e.key === "Escape") handleClose(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  function handleClose() {
    setVisible(false);
    setTimeout(onClose, 280);
  }

  // Fetch task data
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

  const displayStatus   = task ? (statusFromApi[task.status]    || task.status)    : "";
  const displayCategory = task ? (categoryLabels[task.category] || task.category)  : "";
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
        {/* Header */}
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

        {/* Body */}
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

              {/* Status + type banner */}
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
                  { icon: <User size={13}/>,     label: "Client",      value: task.client?.legalName || "—", sub: task.client?.fileNo },
                  { icon: <Tag size={13}/>,      label: "Category",    value: <Badge>{displayCategory}</Badge> },
                  { icon: <Calendar size={13}/>, label: "Due Date",    value: formatDate(task.dueDate), red: overdue > 0 },
                  { icon: <User size={13}/>,     label: "Assigned To", value: task.assignedTo?.name || "Unassigned", sub: task.assignedTo?.email },
                  task.period && { icon: <Clock size={13}/>,     label: "Period",      value: task.period },
                  { icon: <User size={13}/>,     label: "Created By",  value: task.createdBy?.name || "—" },
                  task.isRecurring && {
                    icon: <RotateCw size={13}/>, label: "Recurring",
                    value: <span style={{ fontSize: 11, fontWeight: 700, color: "#1e3a8a", background: "#eff6ff", borderRadius: 20, padding: "3px 10px" }}>{task.recurringConfig?.frequency || "Yes"}</span>,
                  },
                  task.isAwaitingFta && {
                    icon: <AlertTriangle size={13}/>, label: "FTA Status",
                    value: <StatusPill status={ftaStatusFromApi[task.ftaStatus] || task.ftaStatus || "—"} />,
                  },
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
                      const meta   = getActionMeta(log.action);
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
                                {log.user?.role && (
                                  <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, color: "#94a3b8", background: "rgba(255,255,255,.8)", border: "1px solid #e2e8f0", borderRadius: 20, padding: "1px 6px" }}>
                                    {log.user.role}
                                  </span>
                                )}
                              </div>
                              {(log.previousStatus || log.newStatus) && (
                                <div className="task-log-status-change">
                                  {log.previousStatus && (
                                    <>
                                      <StatusPill status={statusFromApi[log.previousStatus] || ftaStatusFromApi[log.previousStatus] || log.previousStatus} />
                                      <span style={{ color: "#94a3b8", fontSize: 12, fontWeight: 700 }}>→</span>
                                    </>
                                  )}
                                  {log.newStatus && (
                                    <StatusPill status={statusFromApi[log.newStatus] || ftaStatusFromApi[log.newStatus] || log.newStatus} />
                                  )}
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
