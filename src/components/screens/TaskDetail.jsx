import { ArrowLeft, Calendar, Clock, FileText, User, Tag, Briefcase, AlertTriangle, RotateCw } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { taskService } from "../../services/taskService.js";
import { statusFromApi, ftaStatusFromApi } from "../../utils/adapterUtils.js";
import Badge from "../ui/Badge.jsx";
import Button from "../ui/Button.jsx";
import Card from "../ui/Card.jsx";
import StatusPill from "../ui/StatusPill.jsx";

const categoryLabels = {
  CT: "Corporate Tax",
  MIS: "MIS Reporting",
  EInv: "E-Invoicing",
  Refund: "VAT Refund",
};

function formatDate(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function formatDateTime(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) +
    " at " +
    d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

function daysOverdue(dueDate, status) {
  if (!dueDate || status === "completed") return 0;
  const diff = Math.ceil((new Date() - new Date(dueDate)) / 86400000);
  return Math.max(0, diff);
}

// Action-specific colors and icons for the timeline
const actionMeta = {
  "Created": { color: "#059669", bg: "bg-emerald-50", border: "border-emerald-200", icon: "✦" },
  "Updated": { color: "#0ea5e9", bg: "bg-sky-50", border: "border-sky-200", icon: "✎" },
  "Status Changed": { color: "#7c3aed", bg: "bg-purple-50", border: "border-purple-200", icon: "⟳" },
  "FTA Status Changed": { color: "#ea580c", bg: "bg-orange-50", border: "border-orange-200", icon: "◉" },
  "Generated Recurrence": { color: "#0891b2", bg: "bg-cyan-50", border: "border-cyan-200", icon: "↻" },
};

function getActionMeta(action) {
  return actionMeta[action] || { color: "#64748b", bg: "bg-slate-50", border: "border-slate-200", icon: "•" };
}

export default function TaskDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [task, setTask] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [taskData, logsData] = await Promise.all([
          taskService.get(id),
          taskService.getLogs(id),
        ]);
        if (active) {
          setTask(taskData);
          setLogs(logsData);
        }
      } catch (err) {
        if (active) setError(err.response?.data?.message || "Failed to load task details");
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => { active = false; };
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="task-detail-loader" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-5">
        <Button variant="ghost" onClick={() => navigate(-1)}>
          <ArrowLeft size={16} /> Back
        </Button>
        <Card className="p-8 text-center">
          <AlertTriangle size={40} className="mx-auto mb-3 text-[#dc2626]" />
          <p className="text-[15px] font-bold text-slate-800">{error}</p>
        </Card>
      </div>
    );
  }

  if (!task) return null;

  const displayStatus = statusFromApi[task.status] || task.status;
  const displayCategory = categoryLabels[task.category] || task.category;
  const overdue = daysOverdue(task.dueDate, task.status);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft size={16} />
          </Button>
          <div>
            <div className="page-kicker">Task Detail</div>
            <h2 className="screen-title flex items-center gap-2">
              {task.taskId}
              {overdue > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-[11px] font-extrabold text-[#dc2626]">
                  <AlertTriangle size={12} /> {overdue}d overdue
                </span>
              )}
            </h2>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => navigate(`/tasks/edit/${task._id}`)}>
            <FileText size={14} /> Edit Task
          </Button>
        </div>
      </div>

      {/* Task Details Card */}
      <Card className="task-detail-card">
        <div className="task-detail-header">
          <div className="flex items-center gap-3">
            <div className="task-detail-icon-box">
              <Briefcase size={20} />
            </div>
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Task Type</div>
              <div className="text-[16px] font-extrabold text-slate-900">{task.taskType}</div>
            </div>
          </div>
          <StatusPill status={displayStatus} />
        </div>

        <div className="task-detail-grid">
          {/* Client */}
          <div className="task-detail-field">
            <div className="task-detail-field-label">
              <User size={13} /> Client
            </div>
            <div className="task-detail-field-value">{task.client?.legalName || "—"}</div>
            {task.client?.fileNo && (
              <div className="text-[11px] text-slate-400 mt-0.5">{task.client.fileNo}</div>
            )}
          </div>

          {/* Category */}
          <div className="task-detail-field">
            <div className="task-detail-field-label">
              <Tag size={13} /> Category
            </div>
            <div className="task-detail-field-value">
              <Badge>{displayCategory}</Badge>
            </div>
          </div>

          {/* Due Date */}
          <div className="task-detail-field">
            <div className="task-detail-field-label">
              <Calendar size={13} /> Due Date
            </div>
            <div className={`task-detail-field-value ${overdue > 0 ? "text-[#dc2626]" : ""}`}>
              {formatDate(task.dueDate)}
            </div>
          </div>

          {/* Assigned To */}
          <div className="task-detail-field">
            <div className="task-detail-field-label">
              <User size={13} /> Assigned To
            </div>
            <div className="task-detail-field-value">{task.assignedTo?.name || "Unassigned"}</div>
            {task.assignedTo?.email && (
              <div className="text-[11px] text-slate-400 mt-0.5">{task.assignedTo.email}</div>
            )}
          </div>

          {/* Period */}
          {task.period && (
            <div className="task-detail-field">
              <div className="task-detail-field-label">
                <Clock size={13} /> Period
              </div>
              <div className="task-detail-field-value">{task.period}</div>
            </div>
          )}

          {/* Created By */}
          <div className="task-detail-field">
            <div className="task-detail-field-label">
              <User size={13} /> Created By
            </div>
            <div className="task-detail-field-value">{task.createdBy?.name || "—"}</div>
          </div>

          {/* Recurring */}
          {task.isRecurring && (
            <div className="task-detail-field">
              <div className="task-detail-field-label">
                <RotateCw size={13} /> Recurring
              </div>
              <div className="task-detail-field-value">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-extrabold text-[#1e3a8a]">
                  <RotateCw size={11} /> {task.recurringConfig?.frequency || "Yes"}
                </span>
              </div>
            </div>
          )}

          {/* FTA Status */}
          {task.isAwaitingFta && (
            <div className="task-detail-field">
              <div className="task-detail-field-label">
                <AlertTriangle size={13} /> FTA Status
              </div>
              <div className="task-detail-field-value">
                <StatusPill status={ftaStatusFromApi[task.ftaStatus] || task.ftaStatus || "—"} />
              </div>
            </div>
          )}
        </div>

        {/* Description */}
        {task.description && (
          <div className="task-detail-description">
            <div className="task-detail-field-label mb-2">
              <FileText size={13} /> Description
            </div>
            <p className="text-[13px] leading-relaxed text-slate-700">{task.description}</p>
          </div>
        )}

        {/* Timestamps */}
        <div className="task-detail-timestamps">
          <span>Created {formatDateTime(task.createdAt)}</span>
          <span className="text-slate-300">•</span>
          <span>Updated {formatDateTime(task.updatedAt)}</span>
        </div>
      </Card>

      {/* Activity Logs */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <div className="task-log-icon-box">
            <Clock size={16} />
          </div>
          <h3 className="text-[16px] font-extrabold text-slate-900">Activity Log</h3>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-500">{logs.length}</span>
        </div>

        {logs.length === 0 ? (
          <Card className="p-8 text-center">
            <Clock size={32} className="mx-auto mb-2 text-slate-300" />
            <p className="text-[13px] text-slate-400 font-semibold">No activity recorded yet</p>
          </Card>
        ) : (
          <div className="task-log-timeline">
            {logs.map((log, idx) => {
              const meta = getActionMeta(log.action);
              const isLast = idx === logs.length - 1;
              return (
                <div key={log._id} className="task-log-entry">
                  {/* Timeline connector */}
                  <div className="task-log-connector">
                    <div
                      className="task-log-dot"
                      style={{ backgroundColor: meta.color, boxShadow: `0 0 0 4px ${meta.color}22` }}
                    >
                      <span className="text-white text-[9px]">{meta.icon}</span>
                    </div>
                    {!isLast && <div className="task-log-line" />}
                  </div>

                  {/* Log content */}
                  <Card className={`task-log-card ${meta.bg} ${meta.border}`}>
                    <div className="task-log-card-header">
                      <span className="text-[13px] font-extrabold" style={{ color: meta.color }}>
                        {log.action}
                      </span>
                      <span className="text-[11px] text-slate-400 font-semibold">
                        {formatDateTime(log.createdAt)}
                      </span>
                    </div>

                    <div className="task-log-card-body">
                      <div className="text-[12px] text-slate-600">
                        <span className="font-bold text-slate-700">{log.user?.name || "System"}</span>
                        {log.user?.role && (
                          <span className="ml-1.5 rounded-full bg-white/80 px-1.5 py-0.5 text-[10px] font-bold text-slate-400 border border-slate-200">
                            {log.user.role}
                          </span>
                        )}
                      </div>

                      {(log.previousStatus || log.newStatus) && (
                        <div className="task-log-status-change">
                          {log.previousStatus && (
                            <>
                              <StatusPill status={statusFromApi[log.previousStatus] || ftaStatusFromApi[log.previousStatus] || log.previousStatus} />
                              <span className="text-slate-400 text-[12px] font-bold">→</span>
                            </>
                          )}
                          {log.newStatus && (
                            <StatusPill status={statusFromApi[log.newStatus] || ftaStatusFromApi[log.newStatus] || log.newStatus} />
                          )}
                        </div>
                      )}

                      {log.notes && (
                        <div className="text-[12px] text-slate-500 italic mt-1">{log.notes}</div>
                      )}
                    </div>
                  </Card>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
