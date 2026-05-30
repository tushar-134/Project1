import { Calendar, Clock3, MapPin, X } from "lucide-react";
import { useEffect, useState } from "react";
import { clientVisitService } from "../../services/clientVisitService.js";
import StatusPill from "./StatusPill.jsx";

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function titleStatus(value) {
  return String(value || "")
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

const STATUS_COLORS = {
  planned: "bg-blue-50 border-blue-200",
  in_progress: "bg-amber-50 border-amber-200",
  completed: "bg-emerald-50 border-emerald-200",
  cancelled: "bg-red-50 border-red-200",
};

export default function ClientVisitHistoryDrawer({ clientId, clientName, onClose, onVisitClick }) {
  const [visits, setVisits] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!clientId) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handleKeyDown);

    let active = true;
    setLoading(true);
    setError("");

    // Fetch all visits for this client (no pagination, all records)
    clientVisitService.list({ clientId, limit: 200, sortBy: "visitDate", sortDir: "desc" })
      .then((data) => {
        if (!active) return;
        // Filter to only visits belonging to this client
        const clientVisits = (data.items || []).filter(
          (v) => v.client?._id === clientId || v.client === clientId
        );
        setVisits(clientVisits);
      })
      .catch(() => {
        if (active) setError("Unable to load visit history.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [clientId, onClose]);

  if (!clientId) return null;

  const upcoming = visits.filter((v) => v.status === "planned" || v.status === "in_progress");
  const past = visits.filter((v) => v.status === "completed" || v.status === "cancelled");

  return (
    <>
      {/* Backdrop */}
      <button
        type="button"
        className="fixed inset-0 z-40 bg-slate-950/30 backdrop-blur-[1px]"
        onClick={onClose}
        aria-label="Close visit history drawer"
      />

      {/* Drawer */}
      <aside className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[560px] flex-col border-l border-[#dbe4f0] bg-[#f8fbff] shadow-[-24px_0_60px_rgba(15,23,42,0.16)]">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#e2e8f0] bg-white px-5 py-4">
          <div>
            <div className="page-kicker">Visit History</div>
            <div className="mt-1 text-[18px] font-black text-slate-900">{clientName || "Client"}</div>
            <div className="mt-0.5 text-[12px] font-semibold text-slate-500">
              {loading ? "Loading..." : `${visits.length} visit${visits.length !== 1 ? "s" : ""} total`}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-10 w-10 place-items-center rounded-xl border border-[#dbe4f0] bg-slate-50 text-slate-500 transition hover:bg-slate-100"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">
          {loading && (
            <div className="py-16 text-center text-[14px] font-semibold text-slate-500">
              Loading visit history...
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-[13px] font-bold text-red-700">
              {error}
            </div>
          )}

          {!loading && !error && visits.length === 0 && (
            <div className="py-16 text-center text-[14px] font-semibold text-slate-500">
              No visits found for this client.
            </div>
          )}

          {/* Upcoming / In Progress */}
          {upcoming.length > 0 && (
            <section>
              <div className="mb-3 text-[11px] font-black uppercase tracking-widest text-slate-400">
                Upcoming & In Progress
              </div>
              <div className="space-y-3">
                {upcoming.map((v) => (
                  <VisitCard key={v._id} visit={v} onVisitClick={onVisitClick} />
                ))}
              </div>
            </section>
          )}

          {/* Past visits */}
          {past.length > 0 && (
            <section>
              <div className="mb-3 text-[11px] font-black uppercase tracking-widest text-slate-400">
                Past Visits
              </div>
              <div className="space-y-3">
                {past.map((v) => (
                  <VisitCard key={v._id} visit={v} onVisitClick={onVisitClick} />
                ))}
              </div>
            </section>
          )}
        </div>
      </aside>
    </>
  );
}

function VisitCard({ visit, onVisitClick }) {
  const colorClass = STATUS_COLORS[visit.status] || "bg-white border-slate-200";

  return (
    <button
      type="button"
      onClick={() => onVisitClick && onVisitClick(visit._id)}
      className={`w-full rounded-2xl border p-4 text-left transition hover:shadow-md ${colorClass}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="task-id-link text-[13px]">{visit.visitId}</span>
            <StatusPill status={titleStatus(visit.status)} />
          </div>
          <div className="mt-1 text-[13px] font-bold text-slate-700">{visit.visitType || "-"}</div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-3 text-[12px] font-semibold text-slate-500">
        <span className="inline-flex items-center gap-1">
          <Calendar size={12} />
          {formatDate(visit.visitDate)}
        </span>
        {visit.visitTime && (
          <span className="inline-flex items-center gap-1">
            <Clock3 size={12} />
            {visit.visitTime}
          </span>
        )}
        {(visit.clientLocation || visit.location) && (
          <span className="inline-flex items-center gap-1">
            <MapPin size={12} />
            {visit.clientLocation || visit.location}
          </span>
        )}
      </div>

      {visit.assignedUsers?.length > 0 && (
        <div className="mt-2 text-[11px] font-semibold text-slate-400">
          Visited by: {visit.assignedUsers.map((e) => e.user?.name || "—").join(", ")}
        </div>
      )}
    </button>
  );
}
