import { AlertTriangle, Calendar, Clock3, ExternalLink, MapPin, NotebookPen, Pencil, Save, User, UsersRound, X, XCircle } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { clientVisitService } from "../../services/clientVisitService.js";
import Button from "./Button.jsx";
import Card from "./Card.jsx";
import StatusPill from "./StatusPill.jsx";
import UserAvatar from "./UserAvatar.jsx";

function titleStatus(value) {
  return String(value || "")
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

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

export default function ClientVisitDrawer({ visitId, canManage, onClose, onVisitUpdated = () => {} }) {
  const navigate = useNavigate();
  const [visit, setVisit] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusSaving, setStatusSaving] = useState(false);
  const [attendanceSaving, setAttendanceSaving] = useState(false);
  const [attendanceEditing, setAttendanceEditing] = useState(true);
  const [attendanceForm, setAttendanceForm] = useState({ checkInTime: "", checkOutTime: "", visitSummary: "" });

  const loadVisit = useCallback(async (active = true) => {
    setLoading(true);
    setError("");
    try {
      const data = await clientVisitService.get(visitId);
      if (active) setVisit(data);
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

  async function handleCancelVisit() {
    if (!canManage || !visit || visit.status === "cancelled" || statusSaving) return;
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

  function openEditPage() {
    navigate(`/client-visits/${visitId}/edit`);
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
              <Button variant="danger" size="sm" onClick={handleCancelVisit} disabled={statusSaving || visit.status === "cancelled"}>
                <XCircle size={15} />
                {statusSaving ? "Cancelling..." : "Cancel"}
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
                  <Detail label="Remarks" icon={<NotebookPen size={13} />}>{visit.remarks || "-"}</Detail>
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
                <label className="mt-3 block">
                  <span className="field-label">Visit Remark</span>
                  <textarea
                    className="input min-h-[110px] py-3"
                    value={attendanceForm.visitSummary}
                    onChange={(event) => setAttendanceForm((current) => ({ ...current, visitSummary: event.target.value }))}
                    disabled={!attendanceEditing || attendanceSaving || visit.status === "cancelled"}
                    placeholder="Add visit notes or outcome..."
                  />
                </label>
                <div className="mt-3 flex justify-end">
                  <Button onClick={handleAttendanceSave} disabled={!attendanceEditing || attendanceSaving || visit.status === "cancelled"}>
                    <Save size={15} />
                    {attendanceSaving ? "Saving..." : "Save"}
                  </Button>
                </div>
              </Card>

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
