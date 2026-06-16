import { ArrowLeft, Calendar, Clock, FileText, User, Tag, Briefcase, AlertTriangle, RotateCw, MessageSquare } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import { taskService } from "../../services/taskService.js";
import { statusFromApi, ftaStatusFromApi } from "../../utils/adapterUtils.js";
import { canManageTasks } from "../../utils/permissions.js";
import { openDocumentSafely } from "../../utils/mediaUrl.js";
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

function getRecurringText(config) {
  if (!config) return "Yes";
  const { frequency, dayOfWeek, dateOfMonth, monthOfYear } = config;
  const monthNames = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  
  if (frequency === "weekly") {
    return `Weekly on ${dayOfWeek || "Sunday"}`;
  }
  if (frequency === "monthly") {
    return `Monthly on Day ${dateOfMonth || 1}`;
  }
  if (frequency === "quarterly") {
    return `Quarterly on Day ${dateOfMonth || 1}`;
  }
  if (frequency === "annual") {
    return `Yearly on ${monthNames[monthOfYear] || "Jan"} ${dateOfMonth || 1}`;
  }
  return frequency || "Yes";
}

// Action-specific colors and icons for the timeline
const actionMeta = {
  "Created": { color: "#059669", bg: "bg-emerald-50", border: "border-emerald-200", icon: "✦" },
  "Updated": { color: "#0ea5e9", bg: "bg-sky-50", border: "border-sky-200", icon: "✎" },
  "Status Changed": { color: "#7c3aed", bg: "bg-purple-50", border: "border-purple-200", icon: "⟳" },
  "FTA Status Changed": { color: "#ea580c", bg: "bg-orange-50", border: "border-orange-200", icon: "◉" },
  "Generated Recurrence": { color: "#0891b2", bg: "bg-cyan-50", border: "border-cyan-200", icon: "↻" },
};

const COMMENT_COLORS = [
  "bg-blue-50 border-blue-100",
  "bg-emerald-50 border-emerald-100",
  "bg-amber-50 border-amber-100",
  "bg-purple-50 border-purple-100",
  "bg-rose-50 border-rose-100",
  "bg-indigo-50 border-indigo-100",
];

function getActionMeta(action) {
  return actionMeta[action] || { color: "#64748b", bg: "bg-slate-50", border: "border-slate-200", icon: "•" };
}

export default function TaskDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const canManage = canManageTasks(currentUser?.role);
  const [task, setTask] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [commentInput, setCommentInput] = useState("");
  const [remarkSaving, setRemarkSaving] = useState(false);
  const [remarkError, setRemarkError] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const taskData = await taskService.get(id);
        if (active) {
          setTask(taskData);
          setLogs(taskData.logs || []);
          setCommentInput("");
          setRemarkError("");
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
  const canEditRemarks = canManage || (currentUser?.role === "associate" && String(task.assignedTo?._id) === String(currentUser?._id || currentUser?.id));

  // Parse remarks as JSON array of {text, author, at} objects; fall back to legacy string
  function parseComments(rawRemarks) {
    if (!rawRemarks) return [];
    try {
      const parsed = JSON.parse(rawRemarks);
      if (Array.isArray(parsed)) return parsed;
    } catch { /* not JSON */ }
    // Legacy plain string — surface as a single unnamed comment
    return [{ text: rawRemarks, author: "—", at: null }];
  }

  async function handleCommentPost() {
    const text = commentInput.trim();
    if (!text || remarkSaving) return;
    setRemarkSaving(true);
    setRemarkError(null);
    try {
      const existing = parseComments(task.remarks);
      const next = [
        ...existing,
        { text, author: currentUser?.name || "You", at: new Date().toISOString() },
      ];
      const updatedTask = await taskService.updateRemarks(task._id, JSON.stringify(next));
      setTask((current) => ({ ...current, remarks: updatedTask.remarks || "", updatedAt: updatedTask.updatedAt || current.updatedAt }));
      setCommentInput("");
      const taskData = await taskService.get(id);
      setLogs(taskData.logs || []);
    } catch (err) {
      setRemarkError(err.response?.data?.message || "Failed to post comment");
    } finally {
      setRemarkSaving(false);
    }
  }

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
              {canManage ? (
                <button
                  type="button"
                  className="task-id-link"
                  onClick={() => navigate(`/tasks/edit/${task._id}`)}
                  title="Edit task"
                >
                  {task.taskId}
                </button>
              ) : (
                task.taskId
              )}
              {overdue > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-[11px] font-extrabold text-[#dc2626]">
                  <AlertTriangle size={12} /> {overdue}d overdue
                </span>
              )}
            </h2>
          </div>
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

          {/* Financial Year */}
          {task.periodFY && (
            <div className="task-detail-field">
              <div className="task-detail-field-label">
                <Clock size={13} /> Financial Year
              </div>
              <div className="task-detail-field-value">{task.periodFY}</div>
            </div>
          )}

          {/* Period Quarter */}
          {task.periodQuarter && (
            <div className="task-detail-field">
              <div className="task-detail-field-label">
                <Clock size={13} /> Period
              </div>
              <div className="task-detail-field-value">{task.periodQuarter}</div>
            </div>
          )}

          {/* Legacy period (free-text) — shown only when new structured fields are absent */}
          {!task.periodFY && !task.periodQuarter && task.period && (
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
                  <RotateCw size={11} /> {getRecurringText(task.recurringConfig)}
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

        <div className="task-detail-description">
          <div className="task-detail-field-label mb-3">
            <MessageSquare size={13} /> Comments
          </div>

          {/* Post new comment */}
          {canEditRemarks && (
            <div className="mb-5 border-b border-[#e2e8f0] pb-5">
              <textarea
                id="task-detail-remark"
                name="taskDetailRemark"
                className="input min-h-20"
                placeholder="Write a comment…"
                value={commentInput}
                onChange={(event) => setCommentInput(event.target.value)}
                disabled={remarkSaving}
                onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleCommentPost(); }}
              />
              {remarkError && (
                <div className="mt-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[12px] font-semibold text-red-700">
                  {remarkError}
                </div>
              )}
              <div className="mt-2 flex items-center justify-between gap-2">
                <span className="text-[10px] text-slate-400">Ctrl+Enter to post</span>
                <Button size="sm" onClick={handleCommentPost} disabled={remarkSaving || !commentInput.trim()}>
                  <MessageSquare size={13} />
                  {remarkSaving ? "Posting..." : "Post Comment"}
                </Button>
              </div>
            </div>
          )}

          {/* Comment thread */}
          {(() => {
            const comments = parseComments(task.remarks).reverse();
            return comments.length === 0 ? (
              <p className="mb-3 text-[12px] text-slate-400 italic">No comments yet.</p>
            ) : (
              <div className="mb-3 space-y-3">
                {comments.map((comment, idx) => (
                  <div key={idx} className="flex items-start gap-2.5">
                    <div className="flex-shrink-0 h-7 w-7 rounded-full bg-[#1e3a8a] flex items-center justify-center text-[10px] font-extrabold text-white">
                      {String(comment.author || "?").charAt(0).toUpperCase()}
                    </div>
                    <div className={`flex-1 rounded-xl border px-3 py-2 ${COMMENT_COLORS[idx % COMMENT_COLORS.length]}`}>
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-[11px] font-extrabold text-slate-700">{comment.author || "—"}</span>
                        {comment.at && (
                          <span className="text-[10px] text-slate-400">
                            {new Date(comment.at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                            {" at "}
                            {new Date(comment.at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        )}
                      </div>
                      <p className="text-[13px] leading-relaxed text-slate-700 whitespace-pre-wrap">{comment.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>

        {!!task.attachments?.length && (
          <div className="task-detail-description">
            <div className="task-detail-field-label mb-2">
              <FileText size={13} /> Attachments
            </div>
            <div className="space-y-2">
              {task.attachments.map((attachment) => (
                <div key={attachment._id || attachment.url || attachment.name} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
                  <div className="min-w-0">
                    <div className="truncate text-[13px] font-bold text-slate-800">{attachment.name}</div>
                    <div className="text-[11px] font-semibold text-slate-500">
                      {[attachment.size, attachment.description, attachment.uploadedAt?.slice?.(0, 10), attachment.uploadedBy?.name].filter(Boolean).join(" • ")}
                    </div>
                  </div>
                  <Button size="sm" variant="ghost" disabled={!attachment.url} onClick={() => openDocumentSafely(attachment.url, attachment.name)}>Open</Button>
                </div>
              ))}
            </div>
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
