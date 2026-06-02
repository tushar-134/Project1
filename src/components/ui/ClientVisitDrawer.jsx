import { AlertTriangle, Calendar, Clock3, ExternalLink, Link2, Mail, MapPin, MessageSquare, NotebookPen, Pencil, Phone, Save, User, UserCheck, UsersRound, X, XCircle } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { clientVisitService } from "../../services/clientVisitService.js";
import { useAuth } from "../../context/AuthContext.jsx";
import Button from "./Button.jsx";
import Card from "./Card.jsx";
import StatusPill from "./StatusPill.jsx";
import UserAvatar from "./UserAvatar.jsx";
import ClientComboBox from "./ClientComboBox.jsx";

function titleStatus(value) {
  return String(value || "")
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

const COMMENT_COLORS = [
  "bg-blue-50 border-blue-100",
  "bg-emerald-50 border-emerald-100",
  "bg-amber-50 border-amber-100",
  "bg-purple-50 border-purple-100",
  "bg-rose-50 border-rose-100",
  "bg-indigo-50 border-indigo-100",
];

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function formatDateTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return `${date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })} at ${date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
}

function formatTimeInput(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function visitTimeToInput(value) {
  const match = String(value || "").trim().match(/^(\d{1,2}):(\d{2})\s?(AM|PM)$/i);
  if (!match) return "";
  let hours = Number(match[1]) % 12;
  if (match[3].toUpperCase() === "PM") hours += 12;
  return `${String(hours).padStart(2, "0")}:${match[2]}`;
}

function getClientInfo(visit) {
  const primaryContact = visit?.client?.contactPersons?.find((contact) => contact.isPrimary) || visit?.client?.contactPersons?.[0] || {};
  const mobile = primaryContact.mobile?.number
    ? [primaryContact.mobile.countryCode, primaryContact.mobile.number].filter(Boolean).join(" ")
    : visit?.newClient?.mobileNumber
      ? [visit.newClient.mobileCountryCode, visit.newClient.mobileNumber].filter(Boolean).join(" ")
      : "-";

  return {
    name: visit?.clientName || visit?.client?.legalName || visit?.newClient?.authorityName || "-",
    number: mobile || "-",
    email: primaryContact.email || visit?.newClient?.email || "-",
    location: visit?.clientLocation || visit?.location || visit?.newClient?.location || "-",
  };
}

export default function ClientVisitDrawer({ visitId, canManage, onClose, onVisitUpdated = () => {} }) {
  const navigate = useNavigate();
  const [visit, setVisit] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusSaving, setStatusSaving] = useState(false);
  const [attendanceSaving, setAttendanceSaving] = useState(false);
  const [attendanceEditing, setAttendanceEditing] = useState(true);
  const [attendanceForm, setAttendanceForm] = useState({ checkInTime: "", checkOutTime: "", visitSummary: "" });
  const { currentUser } = useAuth();
  const [commentInput, setCommentInput] = useState("");
  const [remarkSaving, setRemarkSaving] = useState(false);
  const [remarkError, setRemarkError] = useState("");
  // Conversion / linking state
  const [showLinkBox, setShowLinkBox] = useState(false);
  const [linkClientId, setLinkClientId] = useState("");
  const [linkSaving, setLinkSaving] = useState(false);

  const loadVisit = useCallback(async (active = true) => {
    setLoading(true);
    setError("");
    try {
      const data = await clientVisitService.get(visitId);
      if (active) {
        setVisit(data);
        setCommentInput("");
        setRemarkError("");
      }
    } catch (err) {
      if (active) setError(err.response?.data?.message || "Failed to load visit details.");
    } finally {
      if (active) setLoading(false);
    }
  }, [visitId]);

  useEffect(() => {
    if (!visit) return;
    const firstAssignedUser = visit.assignedUsers?.[0] || {};
    setAttendanceForm({
      checkInTime: formatTimeInput(firstAssignedUser.checkInAt) || visitTimeToInput(visit.visitTime),
      checkOutTime: formatTimeInput(firstAssignedUser.checkOutAt),
      visitSummary: firstAssignedUser.visitSummary || "",
    });
    setAttendanceEditing(!firstAssignedUser.checkInAt && visit.status !== "cancelled");
  }, [visit]);

  useEffect(() => {
    if (!visitId) return undefined;
    let active = true;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleKeyDown);
    loadVisit(active);
    return () => {
      active = false;
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [visitId, onClose, loadVisit]);

  if (!visitId) return null;

  const hasSavedAttendance = Boolean(
    visit?.assignedUsers?.some((entry) => entry.checkInAt || entry.checkOutAt || String(entry.visitSummary || "").trim())
  );
  const canCancelVisit = canManage && visit && visit.status === "planned" && !hasSavedAttendance;

  async function handleCancelVisit() {
    if (!canCancelVisit || statusSaving) return;
    setStatusSaving(true);
    try {
      const updated = await clientVisitService.updateStatus(visit._id, "cancelled");
      setVisit(updated);
      onVisitUpdated(updated);
    } catch (err) {
      setError(err.response?.data?.message || "Unable to cancel visit.");
    } finally {
      setStatusSaving(false);
    }
  }

  async function handleAttendanceSave() {
    if (!visit) return;
    setAttendanceSaving(true);
    setError("");
    try {
      const updated = await clientVisitService.updateAttendance(visit._id, attendanceForm);
      setVisit(updated);
      onVisitUpdated(updated);
      setAttendanceEditing(false);
    } catch (err) {
      setError(err.response?.data?.message || "Unable to save visit timing.");
    } finally {
      setAttendanceSaving(false);
    }
  }

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
      const existing = parseComments(visit.remarks);
      const next = [
        ...existing,
        { text, author: currentUser?.name || "You", at: new Date().toISOString() },
      ];
      const updatedVisit = await clientVisitService.updateRemarks(visit._id, JSON.stringify(next));
      setVisit((current) => current ? { ...current, remarks: updatedVisit.remarks || "", activityLogs: updatedVisit.activityLogs || current.activityLogs } : current);
      setCommentInput("");
    } catch (err) {
      setRemarkError(err.response?.data?.message || "Failed to post comment");
    } finally {
      setRemarkSaving(false);
    }
  }

  function openEditPage() {
    navigate(`/client-visits/${visitId}/edit`);
  }

  async function handleLinkClient() {
    if (!linkClientId || linkSaving) return;
    setLinkSaving(true);
    setError("");
    try {
      const updated = await clientVisitService.update(visit._id, {
        clientType: "existing",
        client: linkClientId,
        newClient: undefined,
      });
      setVisit(updated);
      onVisitUpdated(updated);
      setShowLinkBox(false);
      setLinkClientId("");
    } catch (err) {
      setError(err.response?.data?.message || "Unable to link client.");
    } finally {
      setLinkSaving(false);
    }
  }

  function openNewVisitPage() {
    if (!visit) return;
    navigate("/client-visits/new", {
      state: {
        prefillVisit: {
          clientType: visit.client?._id ? "existing" : "new",
          clientId: visit.client?._id || "",
          newClient: visit.client?._id ? undefined : {
            authorityName: visit.newClient?.authorityName || visit.clientName || "",
            mobileCountryCode: visit.newClient?.mobileCountryCode || "+971",
            mobileNumber: visit.newClient?.mobileNumber || "",
            email: visit.newClient?.email || "",
            location: visit.newClient?.location || visit.clientLocation || visit.location || "",
          },
          location: visit.clientLocation || visit.location || visit.newClient?.location || "",
          assignedUsers: (visit.assignedUsers || []).map((entry) => entry.user?._id || entry.user).filter(Boolean),
        },
      },
    });
  }

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-40 bg-slate-950/30 backdrop-blur-[1px]"
        onClick={onClose}
        aria-label="Close client visit drawer"
      />
      <aside className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[720px] flex-col border-l border-[#dbe4f0] bg-[#f8fbff] shadow-[-24px_0_60px_rgba(15,23,42,0.16)]">
        <div className="flex items-center justify-between border-b border-[#e2e8f0] bg-white px-5 py-4">
          <div>
            <div className="page-kicker">Client Visit</div>
              <div className="mt-1 flex items-center gap-3">
                <div className="task-id-link text-[18px] font-black">{visit?.visitId || "Loading visit"}</div>
                {visit && <StatusPill status={titleStatus(visit.status)} />}
              </div>
          </div>
          <div className="flex items-center gap-2">
            {canManage && visit && (
              <Button variant="ghost" size="sm" onClick={openEditPage}>
                <ExternalLink size={15} />
                Edit page
              </Button>
            )}
            {canManage && visit && (
              <Button variant="danger" size="sm" onClick={handleCancelVisit} disabled={statusSaving || !canCancelVisit}>
                <XCircle size={15} />
                {statusSaving ? "Cancelling..." : "Cancelled"}
              </Button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="grid h-10 w-10 place-items-center rounded-xl border border-[#dbe4f0] bg-slate-50 text-slate-500 transition hover:bg-slate-100"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          {loading ? (
            <Card className="p-8 text-center text-[14px] font-semibold text-slate-500">Loading visit details...</Card>
          ) : error && !visit ? (
            <Card className="p-8 text-center text-[14px] font-semibold text-red-600">{error}</Card>
          ) : !visit ? null : (
            <div className="space-y-5">
              {error && (
                <Card className="border border-red-200 bg-red-50 p-3 text-[12px] font-bold text-red-700">
                  <div className="flex items-center gap-2">
                    <AlertTriangle size={14} />
                    <span>{error}</span>
                  </div>
                </Card>
              )}

              {/* ── Client Conversion Card (only for prospective / new-client visits) ── */}
              {visit.clientType === "new" && (
                <Card className="border border-amber-200 bg-amber-50 p-5">
                  <div className="mb-3 flex items-center gap-2">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-500 text-white">
                      <UserCheck size={15} />
                    </span>
                    <div>
                      <div className="text-[14px] font-black text-slate-900">Prospective Client</div>
                      <div className="text-[11px] font-semibold text-slate-500">This visit was logged for a new (prospective) client. Convert or link once they're onboarded.</div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {/* Option A — navigate to AddClient pre-filled */}
                    <Button
                      size="sm"
                      onClick={() => navigate("/clients/new", {
                        state: {
                          fromVisitId: visit._id,
                          newClient: visit.newClient || {},
                        },
                      })}
                    >
                      <UserCheck size={14} />
                      Convert to Client
                    </Button>

                    {/* Option B — link to already-created client inline */}
                    {!showLinkBox ? (
                      <Button size="sm" variant="ghost" onClick={() => setShowLinkBox(true)}>
                        <Link2 size={14} />
                        Link to Existing
                      </Button>
                    ) : (
                      <div className="flex w-full flex-wrap items-center gap-2 rounded-xl border border-amber-200 bg-white p-3">
                        <div className="flex-1 min-w-[180px]">
                          <ClientComboBox
                            value={linkClientId}
                            onChange={setLinkClientId}
                            placeholder="Search & select client…"
                          />
                        </div>
                        <Button size="sm" onClick={handleLinkClient} disabled={!linkClientId || linkSaving}>
                          <Save size={13} />
                          {linkSaving ? "Linking…" : "Confirm Link"}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => { setShowLinkBox(false); setLinkClientId(""); }}>
                          <X size={13} />
                          Cancel
                        </Button>
                      </div>
                    )}
                  </div>
                </Card>
              )}

              <Card className="space-y-4 p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="text-[18px] font-black text-slate-900">{visit.clientName}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-3 text-[12px] font-semibold text-slate-500">
                      <span className="inline-flex items-center gap-1">
                        <Calendar size={13} />
                        {formatDate(visit.visitDate)}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Clock3 size={13} />
                        {visit.visitTime || "-"}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <MapPin size={13} />
                        {visit.clientLocation || visit.location || "-"}
                      </span>
                    </div>
                  </div>
                  <div className="min-w-[160px]">
                    <div className="mb-1 text-[11px] font-black uppercase tracking-wider text-slate-400">
                      Visit Status
                    </div>
                    <StatusPill status={titleStatus(visit.status)} />
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <Detail label="Visit Type" icon={<NotebookPen size={13} />}>{visit.visitType || "-"}</Detail>
                  <Detail label="Created By" icon={<User size={13} />}>{visit.createdBy?.name || "-"}</Detail>
                  <Detail label="Client Type" icon={<UsersRound size={13} />}>{titleStatus(visit.clientType)}</Detail>
                </div>
              </Card>

              <Card className="p-5">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="text-[16px] font-black text-slate-900">Visit Timing</div>
                  {!attendanceEditing && visit.status !== "cancelled" && (
                    <Button size="sm" variant="ghost" onClick={() => setAttendanceEditing(true)}>
                      <Pencil size={14} />
                      Edit
                    </Button>
                  )}
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label>
                    <span className="field-label">Check In</span>
                    <input
                      className="input"
                      type="time"
                      value={attendanceForm.checkInTime}
                      onChange={(event) => setAttendanceForm((current) => ({ ...current, checkInTime: event.target.value }))}
                      disabled={!attendanceEditing || attendanceSaving || visit.status === "cancelled"}
                    />
                  </label>
                  <label>
                    <span className="field-label">Check Out</span>
                    <input
                      className="input"
                      type="time"
                      value={attendanceForm.checkOutTime}
                      onChange={(event) => setAttendanceForm((current) => ({ ...current, checkOutTime: event.target.value }))}
                      disabled={!attendanceEditing || attendanceSaving || visit.status === "cancelled"}
                    />
                  </label>
                </div>
                <div className="mt-4 flex justify-end">
                  <Button onClick={handleAttendanceSave} disabled={!attendanceEditing || attendanceSaving || visit.status === "cancelled"}>
                    <Save size={15} />
                    {attendanceSaving ? "Saving..." : "Save Timing"}
                  </Button>
                </div>
              </Card>

              {(() => {
                const clientInfo = getClientInfo(visit);
                return (
                  <Card className="p-5">
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                      <div className="text-[16px] font-black text-slate-900">Client Information</div>
                      <Button size="sm" onClick={openNewVisitPage}>
                        <Calendar size={14} />
                        Add Visit
                      </Button>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Detail label="Name" icon={<User size={13} />}>{clientInfo.name}</Detail>
                      <Detail label="Number" icon={<Phone size={13} />}>{clientInfo.number}</Detail>
                      <Detail label="Email" icon={<Mail size={13} />}>{clientInfo.email}</Detail>
                      <Detail label="Location" icon={<MapPin size={13} />}>{clientInfo.location}</Detail>
                    </div>
                  </Card>
                );
              })()}

              {/* Comments Section moved here */}
              <div className="rounded-2xl border border-[#e2e8f0] bg-white p-5 shadow-sm">
                <div className="mb-4 flex items-center gap-2 text-[16px] font-black text-slate-900">
                  <MessageSquare size={18} />
                  Comments
                </div>

                {/* Post new comment */}
                {canManage || (visit.assignedUsers || []).some((entry) => String(entry.user?._id || entry.user) === String(currentUser?._id || currentUser?.id)) ? (
                  <div className="mb-5 border-b border-[#e2e8f0] pb-5">
                    <textarea
                      className="input min-h-[90px] py-3 text-[14px]"
                      placeholder="Write a comment…"
                      value={commentInput}
                      onChange={(event) => setCommentInput(event.target.value)}
                      disabled={remarkSaving}
                      onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleCommentPost(); }}
                    />
                    {remarkError && (
                      <div className="mt-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[13px] font-semibold text-red-700">
                        {remarkError}
                      </div>
                    )}
                    <div className="mt-3 flex items-center justify-between gap-2">
                      <span className="text-[12px] font-semibold text-slate-400">Ctrl+Enter or ⌘+Enter to post</span>
                      <Button size="sm" onClick={handleCommentPost} disabled={remarkSaving || !commentInput.trim()}>
                        <MessageSquare size={14} />
                        {remarkSaving ? "Posting..." : "Post Comment"}
                      </Button>
                    </div>
                  </div>
                ) : null}

                {/* Comment thread */}
                {(() => {
                  const comments = parseComments(visit.remarks).reverse();
                  return comments.length === 0 ? (
                    <p className="mb-4 text-[13px] text-slate-400 italic">No comments yet.</p>
                  ) : (
                    <div className="mb-5 space-y-4 max-h-[280px] overflow-y-auto pr-2 custom-scrollbar">
                      {comments.map((comment, idx) => (
                        <div key={idx} className="flex items-start gap-3">
                          <div className="flex-shrink-0 h-8 w-8 rounded-full bg-[#1e3a8a] flex items-center justify-center text-[12px] font-extrabold text-white">
                            {String(comment.author || "?").charAt(0).toUpperCase()}
                          </div>
                          <div className={`flex-1 rounded-2xl border px-4 py-3 ${COMMENT_COLORS[idx % COMMENT_COLORS.length]}`}>
                            <div className="flex items-center justify-between gap-2 mb-1.5">
                              <span className="text-[12px] font-extrabold text-slate-700">{comment.author || "—"}</span>
                              {comment.at && (
                                <span className="text-[11px] font-semibold text-slate-400">
                                  {new Date(comment.at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                                  {" at "}
                                  {new Date(comment.at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                                </span>
                              )}
                            </div>
                            <p className="text-[14px] leading-relaxed text-slate-700 whitespace-pre-wrap">{comment.text}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>

              <Card className="p-5">
                <div className="mb-3 text-[16px] font-black text-slate-900">Assigned Users</div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {(visit.assignedUsers || []).map((entry) => (
                    <div key={entry._id} className="flex items-center gap-3 rounded-2xl border border-[#e2e8f0] bg-white p-4">
                      <UserAvatar user={entry.user} size="sm" />
                      <div className="min-w-0">
                        <div className="truncate font-black text-slate-900">{entry.user?.name || "Unknown User"}</div>
                        <div className="truncate text-[12px] font-semibold text-slate-500">{entry.user?.role || entry.user?.email || "-"}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              <Card className="p-5">
                <div className="mb-3 text-[16px] font-black text-slate-900">Activity Timeline</div>
                <div className="space-y-3">
                  {(visit.activityLogs || []).map((entry) => (
                    <div key={entry._id} className="rounded-2xl border border-[#e2e8f0] bg-white p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="font-black text-slate-900">{entry.action}</div>
                        <div className="text-[11px] font-semibold text-slate-500">{formatDateTime(entry.createdAt)}</div>
                      </div>
                      <div className="mt-1 text-[12px] font-semibold text-slate-500">{entry.user?.name || "-"}</div>
                      {entry.message && <div className="mt-2 text-[13px] font-medium text-slate-600">{entry.message}</div>}
                    </div>
                  ))}
                </div>
              </Card>

            </div>
          )}
        </div>
      </aside>
    </>
  );
}

function Detail({ label, icon, children }) {
  return (
    <div className="rounded-2xl border border-[#e2e8f0] bg-white p-4">
      <div className="flex items-center gap-1 text-[11px] font-black uppercase tracking-wider text-slate-400">
        {icon}
        <span>{label}</span>
      </div>
      <div className="mt-1 text-[14px] font-bold text-slate-900">{children}</div>
    </div>
  );
}
