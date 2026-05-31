import { AlertTriangle, Briefcase, Calendar, Clock, ExternalLink, FileText, MessageSquare, Tag, User, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import { taskService } from "../../services/taskService.js";
import { ftaStatusFromApi, statusFromApi } from "../../utils/adapterUtils.js";
import Badge from "./Badge.jsx";
import Button from "./Button.jsx";
import Card from "./Card.jsx";
import StatusPill from "./StatusPill.jsx";

const categoryLabels = {
  CT: "Corporate Tax",
  MIS: "MIS Reporting",
  EInv: "E-Invoicing",
  Refund: "VAT Refund",
};

const actionMeta = {
  Created: { color: "#059669", bg: "bg-emerald-50", border: "border-emerald-200", icon: "C" },
  Updated: { color: "#0ea5e9", bg: "bg-sky-50", border: "border-sky-200", icon: "U" },
  "Status Changed": { color: "#7c3aed", bg: "bg-purple-50", border: "border-purple-200", icon: "S" },
  "FTA Status Changed": { color: "#ea580c", bg: "bg-orange-50", border: "border-orange-200", icon: "F" },
  "Generated Recurrence": { color: "#0891b2", bg: "bg-cyan-50", border: "border-cyan-200", icon: "R" },
};

function formatDate(dateStr) {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function formatDateTime(dateStr) {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  return `${d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })} at ${d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`;
}

function daysOverdue(dueDate, status) {
  if (!dueDate || status === "completed") return 0;
  const diff = Math.ceil((new Date() - new Date(dueDate)) / 86400000);
  return Math.max(0, diff);
}

function getActionMeta(action) {
  return actionMeta[action] || { color: "#64748b", bg: "bg-slate-50", border: "border-slate-200", icon: "." };
}


export default function TaskDrawer({ taskId, canManage, onClose }) {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [task, setTask] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [commentInput, setCommentInput] = useState("");
  const [remarkSaving, setRemarkSaving] = useState(false);
  const [remarkError, setRemarkError] = useState("");

  const loadTask = useCallback(async (active = true) => {
    setLoading(true);
    setError(null);
    try {
      const [taskData, logsData] = await Promise.all([
        taskService.get(taskId),
        taskService.getLogs(taskId),
      ]);
      if (active) {
        setTask(taskData);
        setLogs(logsData);
        setCommentInput("");
        setRemarkError("");
      }
    } catch (err) {
      if (active) setError(err.response?.data?.message || "Failed to load task details");
    } finally {
      if (active) setLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    if (!taskId) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [taskId, onClose]);

  useEffect(() => {
    if (!taskId) return undefined;

    let active = true;
    loadTask(active);
    return () => {
      active = false;
    };
  }, [taskId, loadTask]);

  if (!taskId) return null;

  const displayStatus = statusFromApi[task?.status] || task?.status;
  const displayCategory = categoryLabels[task?.category] || task?.category;
  const overdue = task ? daysOverdue(task.dueDate, task.status) : 0;
  const canEditRemarks = Boolean(
    task &&
    (
      canManage ||
      (currentUser?.role === "task_only" && String(task.assignedTo?._id) === String(currentUser?._id || currentUser?.id))
    )
  );

  // Parse remarks as JSON array of {text, author, at}; fall back to legacy string
  function parseComments(rawRemarks) {
    if (!rawRemarks) return [];
    try {
      const parsed = JSON.parse(rawRemarks);
      if (Array.isArray(parsed)) return parsed;
    } catch { /* not JSON */ }
    return [{ text: rawRemarks, author: "—", at: null }];
  }

  async function handleCommentPost() {
    const text = commentInput.trim();
    if (!text || remarkSaving) return;
    setRemarkSaving(true);
    setRemarkError("");
    try {
      const existing = parseComments(task.remarks);
      const next = [
        ...existing,
        { text, author: currentUser?.name || "You", at: new Date().toISOString() },
      ];
      const updatedTask = await taskService.updateRemarks(task._id, JSON.stringify(next));
      setTask((current) => current ? { ...current, remarks: updatedTask.remarks || "", updatedAt: updatedTask.updatedAt || current.updatedAt } : current);
      setCommentInput("");
      await loadTask(true);
    } catch (err) {
      setRemarkError(err.response?.data?.message || "Failed to post comment");
    } finally {
      setRemarkSaving(false);
    }
  }

  function openTaskDestination() {
    if (!task) return;
    if (canManage) {
      navigate(`/tasks/edit/${task._id}`, { state: { task } });
      return;
    }
    navigate(`/tasks/${task._id}`);
  }

  return (
    <>
      <div
        aria-hidden="true"
        className="fixed inset-0 z-40 bg-slate-900/30 backdrop-blur-[1px]"
        onClick={onClose}
      />
      <aside
        aria-label="Task details"
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[680px] flex-col border-l border-[#dbe4f0] bg-[#f8fbff] shadow-[-24px_0_60px_rgba(15,23,42,0.16)]"
      >
        <div className="flex items-center justify-between border-b border-[#e2e8f0] bg-white px-5 py-4">
          <div>
            <div className="page-kicker">Task Detail</div>
            {task ? (
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className="task-id-link text-[18px] font-black"
                  onClick={openTaskDestination}
                  title={canManage ? "Open edit task page" : "Open task page"}
                >
                  {task.taskId}
                </button>
                {overdue > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-[11px] font-extrabold text-[#dc2626]">
                    <AlertTriangle size={12} />
                    {overdue}d overdue
                  </span>
                )}
              </div>
            ) : (
              <div className="mt-1 text-[18px] font-black text-slate-900">Loading task</div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {task && (
              <Button variant="ghost" size="sm" onClick={openTaskDestination}>
                <ExternalLink size={15} />
                {canManage ? "Edit page" : "Full page"}
              </Button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="grid h-10 w-10 place-items-center rounded-xl border border-[#dbe4f0] bg-slate-50 text-slate-500 transition hover:bg-slate-100"
              title="Close"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          {loading ? (
            <div className="flex min-h-[320px] items-center justify-center">
              <div className="task-detail-loader" />
            </div>
          ) : error ? (
            <Card className="p-8 text-center">
              <AlertTriangle size={40} className="mx-auto mb-3 text-[#dc2626]" />
              <p className="text-[15px] font-bold text-slate-800">{error}</p>
            </Card>
          ) : !task ? null : (
            <div className="space-y-5">
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
                  <div className="task-detail-field">
                    <div className="task-detail-field-label">
                      <User size={13} /> Client
                    </div>
                    <div className="task-detail-field-value">{task.client?.legalName || "-"}</div>
                    {task.client?.fileNo && <div className="mt-0.5 text-[11px] text-slate-400">{task.client.fileNo}</div>}
                  </div>

                  <div className="task-detail-field">
                    <div className="task-detail-field-label">
                      <Tag size={13} /> Category
                    </div>
                    <div className="task-detail-field-value">
                      <Badge>{displayCategory}</Badge>
                    </div>
                  </div>

                  <div className="task-detail-field">
                    <div className="task-detail-field-label">
                      <Calendar size={13} /> Due Date
                    </div>
                    <div className={`task-detail-field-value ${overdue > 0 ? "text-[#dc2626]" : ""}`}>
                      {formatDate(task.dueDate)}
                    </div>
                  </div>

                  <div className="task-detail-field">
                    <div className="task-detail-field-label">
                      <User size={13} /> Assigned To
                    </div>
                    <div className="task-detail-field-value">{task.assignedTo?.name || "Unassigned"}</div>
                    {task.assignedTo?.email && <div className="mt-0.5 text-[11px] text-slate-400">{task.assignedTo.email}</div>}
                  </div>

                  {task.period && (
                    <div className="task-detail-field">
                      <div className="task-detail-field-label">
                        <Clock size={13} /> Period
                      </div>
                      <div className="task-detail-field-value">{task.period}</div>
                    </div>
                  )}

                  <div className="task-detail-field">
                    <div className="task-detail-field-label">
                      <User size={13} /> Created By
                    </div>
                    <div className="task-detail-field-value">{task.createdBy?.name || "-"}</div>
                  </div>

                  {task.isAwaitingFta && (
                    <div className="task-detail-field">
                      <div className="task-detail-field-label">
                        <AlertTriangle size={13} /> FTA Status
                      </div>
                      <div className="task-detail-field-value">
                        <StatusPill status={ftaStatusFromApi[task.ftaStatus] || task.ftaStatus || "-"} />
                      </div>
                    </div>
                  )}
                </div>

                {task.description && (
                  <div className="task-detail-description">
                    <div className="mb-2 task-detail-field-label">
                      <FileText size={13} /> Description
                    </div>
                    <p className="text-[13px] leading-relaxed text-slate-700">{task.description}</p>
                  </div>
                )}

                <div className="task-detail-description">
                  <div className="mb-3 task-detail-field-label">
                    <MessageSquare size={13} /> Comments
                  </div>
                  {/* Post new comment */}
                  {canEditRemarks && (
                    <div className="mb-5 border-b border-[#e2e8f0] pb-5">
                      <textarea
                        id="task-drawer-remark"
                        name="taskDrawerRemark"
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
                            <div className="flex-1 rounded-xl bg-slate-50 border border-slate-100 px-3 py-2">
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
                    <div className="mb-2 task-detail-field-label">
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
                          <Button size="sm" variant="ghost" disabled={!attachment.url} onClick={() => window.open(attachment.url, "_blank", "noopener,noreferrer")}>Open</Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="task-detail-timestamps">
                  <span>Created {formatDateTime(task.createdAt)}</span>
                  <span className="text-slate-300">.</span>
                  <span>Updated {formatDateTime(task.updatedAt)}</span>
                </div>
              </Card>

              <div>
                <div className="mb-4 flex items-center gap-2">
                  <div className="task-log-icon-box">
                    <Clock size={16} />
                  </div>
                  <h3 className="text-[16px] font-extrabold text-slate-900">Activity Log</h3>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-500">{logs.length}</span>
                </div>

                {logs.length === 0 ? (
                  <Card className="p-8 text-center">
                    <Clock size={32} className="mx-auto mb-2 text-slate-300" />
                    <p className="text-[13px] font-semibold text-slate-400">No activity recorded yet</p>
                  </Card>
                ) : (
                  <div className="task-log-timeline">
                    {logs.map((log, idx) => {
                      const meta = getActionMeta(log.action);
                      const isLast = idx === logs.length - 1;
                      return (
                        <div key={log._id} className="task-log-entry">
                          <div className="task-log-connector">
                            <div
                              className="task-log-dot"
                              style={{ backgroundColor: meta.color, boxShadow: `0 0 0 4px ${meta.color}22` }}
                            >
                              <span className="text-[9px] text-white">{meta.icon}</span>
                            </div>
                            {!isLast && <div className="task-log-line" />}
                          </div>

                          <Card className={`task-log-card ${meta.bg} ${meta.border}`}>
                            <div className="task-log-card-header">
                              <span className="text-[13px] font-extrabold" style={{ color: meta.color }}>
                                {log.action}
                              </span>
                              <span className="text-[11px] font-semibold text-slate-400">{formatDateTime(log.createdAt)}</span>
                            </div>

                            <div className="task-log-card-body">
                              <div className="text-[12px] text-slate-600">
                                <span className="font-bold text-slate-700">{log.user?.name || "System"}</span>
                                {log.user?.role && (
                                  <span className="ml-1.5 rounded-full border border-slate-200 bg-white/80 px-1.5 py-0.5 text-[10px] font-bold text-slate-400">
                                    {log.user.role}
                                  </span>
                                )}
                              </div>

                              {(log.previousStatus || log.newStatus) && (
                                <div className="task-log-status-change">
                                  {log.previousStatus && (
                                    <>
                                      <StatusPill status={statusFromApi[log.previousStatus] || ftaStatusFromApi[log.previousStatus] || log.previousStatus} />
                                      <span className="text-[12px] font-bold text-slate-400">to</span>
                                    </>
                                  )}
                                  {log.newStatus && (
                                    <StatusPill status={statusFromApi[log.newStatus] || ftaStatusFromApi[log.newStatus] || log.newStatus} />
                                  )}
                                </div>
                              )}

                              {log.notes && <div className="mt-1 text-[12px] italic text-slate-500">{log.notes}</div>}
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
      </aside>
    </>
  );
}
