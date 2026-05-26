import { AlertTriangle, Calendar, Clock3, ExternalLink, MapPin, NotebookPen, User, UsersRound, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import { clientVisitService } from "../../services/clientVisitService.js";
import Button from "./Button.jsx";
import Card from "./Card.jsx";
import StatusPill from "./StatusPill.jsx";
import UserAvatar from "./UserAvatar.jsx";

const VISIT_STATUS_OPTIONS = ["planned", "in_progress", "completed", "cancelled"];

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

export default function ClientVisitDrawer({ visitId, canManage, onClose, onVisitUpdated = () => {} }) {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [visit, setVisit] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusSaving, setStatusSaving] = useState(false);
  const [actingUser, setActingUser] = useState("");

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

  async function handleStatusChange(nextStatus) {
    if (!canManage || !visit || nextStatus === visit.status || statusSaving) return;
    setStatusSaving(true);
    try {
      const updated = await clientVisitService.updateStatus(visit._id, nextStatus);
      setVisit(updated);
      onVisitUpdated(updated);
    } catch (err) {
      setError(err.response?.data?.message || "Unable to update visit status.");
    } finally {
      setStatusSaving(false);
    }
  }

  async function handleCheckIn(entry) {
    if (!visit) return;
    setActingUser(entry._id);
    try {
      const updated = await clientVisitService.checkIn(visit._id, canManage ? { userId: entry.user?._id || entry.user } : {});
      setVisit(updated);
      onVisitUpdated(updated);
    } catch (err) {
      setError(err.response?.data?.message || "Unable to complete check-in.");
    } finally {
      setActingUser("");
    }
  }

  async function handleCheckOut(entry) {
    if (!visit) return;
    setActingUser(entry._id);
    try {
      const updated = await clientVisitService.checkOut(visit._id, canManage ? { userId: entry.user?._id || entry.user } : {});
      setVisit(updated);
      onVisitUpdated(updated);
    } catch (err) {
      setError(err.response?.data?.message || "Unable to complete check-out.");
    } finally {
      setActingUser("");
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
              <div className="text-[18px] font-black text-[#1e3a8a]">{visit?.visitId || "Loading visit"}</div>
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
                  {canManage && (
                    <div className="min-w-[220px]">
                      <label className="mb-1 block text-[11px] font-black uppercase tracking-wider text-slate-400">
                        Visit Status
                      </label>
                      <select
                        className="input h-9"
                        value={visit.status}
                        onChange={(event) => handleStatusChange(event.target.value)}
                        disabled={statusSaving}
                      >
                        {VISIT_STATUS_OPTIONS.map((status) => (
                          <option key={status} value={status}>
                            {titleStatus(status)}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <Detail label="Visit Type" icon={<NotebookPen size={13} />}>{visit.visitType || "-"}</Detail>
                  <Detail label="Created By" icon={<User size={13} />}>{visit.createdBy?.name || "-"}</Detail>
                  <Detail label="Client Type" icon={<UsersRound size={13} />}>{titleStatus(visit.clientType)}</Detail>
                  <Detail label="Remarks" icon={<NotebookPen size={13} />}>{visit.remarks || "-"}</Detail>
                </div>
              </Card>

              <Card className="p-5">
                <div className="mb-3 text-[16px] font-black text-slate-900">Assigned Users</div>
                <div className="space-y-3">
                  {(visit.assignedUsers || []).map((entry) => {
                    const targetUserId = String(entry.user?._id || entry.user);
                    const canAct = canManage || String(currentUser?._id || currentUser?.id) === targetUserId;
                    return (
                      <div key={entry._id} className="rounded-2xl border border-[#e2e8f0] bg-white p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <UserAvatar user={entry.user} size="sm" />
                            <div>
                              <div className="font-black text-slate-900">{entry.user?.name || "Unknown User"}</div>
                              <div className="text-[12px] font-semibold text-slate-500">{entry.user?.role || entry.user?.email || "-"}</div>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            {!entry.checkInAt && canAct && (
                              <Button size="sm" variant="success" onClick={() => handleCheckIn(entry)} disabled={actingUser === entry._id || visit.status === "cancelled"}>
                                {actingUser === entry._id ? "Working..." : "Check In"}
                              </Button>
                            )}
                            {entry.checkInAt && !entry.checkOutAt && canAct && (
                              <Button size="sm" variant="primary" onClick={() => handleCheckOut(entry)} disabled={actingUser === entry._id || visit.status === "cancelled"}>
                                {actingUser === entry._id ? "Working..." : "Check Out"}
                              </Button>
                            )}
                          </div>
                        </div>

                        <div className="mt-3 grid gap-3 sm:grid-cols-3">
                          <Detail label="Check In" icon={<Clock3 size={13} />}>{formatDateTime(entry.checkInAt)}</Detail>
                          <Detail label="Check Out" icon={<Clock3 size={13} />}>{formatDateTime(entry.checkOutAt)}</Detail>
                          <Detail label="Duration" icon={<Clock3 size={13} />}>
                            {entry.durationMinutes ? `${entry.durationMinutes} min` : "-"}
                          </Detail>
                        </div>
                        {(entry.visitSummary || entry.notes) && (
                          <div className="mt-3 rounded-xl bg-slate-50 p-3 text-[12px] font-medium text-slate-600">
                            {entry.visitSummary || entry.notes}
                          </div>
                        )}
                      </div>
                    );
                  })}
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
