import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../../context/AppContext";
import { useNotifications } from "../../hooks/useNotifications";
import { CheckCheck, Bell, ExternalLink } from "lucide-react";

// ─── Type metadata ────────────────────────────────────────────────────────────
const TYPE_META = {
  task_due:     { label: "Task Due",      color: "bg-amber-100 text-amber-700",   dot: "bg-amber-400" },
  task_overdue: { label: "Task Overdue",  color: "bg-red-100 text-red-700",       dot: "bg-red-500"   },
  client_added: { label: "Client Added",  color: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-400" },
  fta_query:    { label: "FTA Query",     color: "bg-purple-100 text-purple-700", dot: "bg-purple-500" },
  task_update:  { label: "Task Update",   color: "bg-sky-100 text-sky-700",       dot: "bg-sky-400"   },
};

// ─── Decide where a notification should navigate to ──────────────────────────
function getNavTarget(notification) {
  const { type, relatedTask, relatedClient } = notification;
  if (type === "fta_query") return "/tasks/fta-tracker";
  if ((type === "task_due" || type === "task_overdue" || type === "task_update") && relatedTask)
    return `/tasks/${relatedTask}`;
  if (type === "client_added" && relatedClient)
    return `/clients/list`;
  // Fallback — send to task list or dashboard
  if (relatedTask) return `/tasks/${relatedTask}`;
  return "/dashboard";
}

// ─── Relative time helper ─────────────────────────────────────────────────────
function timeAgo(dateStr) {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1)  return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function NotificationPanel({ open, onClose }) {
  const { state } = useApp();
  const { fetchNotifications, markRead, markAllRead } = useNotifications();
  const navigate = useNavigate();

  // Which notification ID is being dismissed (CSS animation)
  const [dismissing, setDismissing] = useState(new Set());

  // ── Polling & refresh on open ─────────────────────────────────────────────
  useEffect(() => {
    fetchNotifications().catch(() => {});
    const id = setInterval(() => fetchNotifications().catch(() => {}), 60_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (open) fetchNotifications().catch(() => {});
  }, [open]);

  // ── Click a single notification: read → animate out → navigate → close panel
  function handleNotificationClick(event, item) {
    event.stopPropagation();

    // 1. Start slide-out animation
    setDismissing((prev) => new Set(prev).add(item._id));

    // 2. After animation (300ms): mark read in DB + remove from state → navigate → close
    setTimeout(async () => {
      await markRead(item._id);               // marks read in DB + removes from state
      const target = getNavTarget(item);
      onClose?.();                            // close the notification panel
      navigate(target);                       // go to the related page
      setDismissing((prev) => {
        const next = new Set(prev);
        next.delete(item._id);
        return next;
      });
    }, 280);
  }

  // ── Mark all read: clear instantly + close panel ──────────────────────────
  async function handleMarkAllRead(event) {
    event.stopPropagation();
    await markAllRead();
    onClose?.();
  }

  const unread    = state.notifications.filter((n) => !n.isRead);
  const unreadCount = state.unreadCount || 0;

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div
      className={`absolute right-0 top-[46px] z-50 w-[calc(100vw-24px)] max-w-[340px] overflow-hidden rounded-b-xl border border-t-0 border-[#e2e8f0] bg-white shadow-2xl transition-all duration-200 ${
        open
          ? "translate-x-0 opacity-100 pointer-events-auto"
          : "translate-x-4 opacity-0 pointer-events-none"
      }`}
    >
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="bg-gradient-to-r from-[#1e3a8a] to-[#1d4ed8] px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Bell size={14} className="text-white/70" />
            <div>
              <p className="text-[13px] font-extrabold text-white leading-none">Notifications</p>
              <p className="mt-0.5 text-[10px] font-medium text-white/60">
                {unreadCount > 0
                  ? `${unreadCount} unread alert${unreadCount > 1 ? "s" : ""}`
                  : "You're all caught up"}
              </p>
            </div>
          </div>

          {unreadCount > 0 ? (
            <button
              type="button"
              onClick={handleMarkAllRead}
              className="flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1.5 text-[10px] font-bold text-white transition hover:bg-white/30 active:scale-95"
            >
              <CheckCheck size={11} />
              Mark all read
            </button>
          ) : (
            <span className="rounded-full bg-emerald-500/20 px-2.5 py-1 text-[10px] font-bold text-emerald-200">
              ✓ All read
            </span>
          )}
        </div>
      </div>

      {/* ── List ───────────────────────────────────────────────────────── */}
      <div className="max-h-[420px] overflow-y-auto p-2">
        {unread.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center px-4 py-10 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 ring-4 ring-emerald-100">
              <CheckCheck size={20} className="text-emerald-500" />
            </div>
            <p className="text-[13px] font-bold text-slate-700">You're all caught up!</p>
            <p className="mt-1 text-[11px] text-slate-400">No new notifications right now.</p>
          </div>
        ) : (
          unread.map((item) => {
            const meta        = TYPE_META[item.type] || { label: item.type, color: "bg-slate-100 text-slate-600", dot: "bg-slate-400" };
            const isDismissing = dismissing.has(item._id);

            return (
              <div
                key={item._id}
                style={{ transition: "all 0.28s ease" }}
                className={`mb-2 overflow-hidden rounded-xl border border-sky-100 bg-sky-50 shadow-sm ${
                  isDismissing
                    ? "max-h-0 opacity-0 scale-95 mb-0 py-0"
                    : "max-h-[200px] opacity-100 scale-100"
                }`}
              >
                <button
                  type="button"
                  onClick={(e) => handleNotificationClick(e, item)}
                  className="group w-full p-3 text-left transition hover:bg-sky-100/70 active:scale-[0.98]"
                >
                  <div className="flex items-start gap-3">
                    {/* Coloured dot */}
                    <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${meta.dot}`} />

                    <div className="min-w-0 flex-1">
                      {/* Badge + time row */}
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider ${meta.color}`}>
                          {meta.label}
                        </span>
                        <span className="text-[10px] text-slate-400">{timeAgo(item.createdAt)}</span>
                      </div>

                      {/* Title */}
                      <p className="text-[12px] font-bold text-slate-900 leading-snug">{item.title}</p>

                      {/* Message */}
                      <p className="mt-0.5 text-[11px] text-slate-500 leading-4 line-clamp-2">{item.message}</p>
                    </div>

                    {/* Navigation arrow */}
                    <ExternalLink
                      size={13}
                      className="mt-0.5 shrink-0 text-slate-300 transition group-hover:text-sky-500"
                    />
                  </div>

                  {/* Tap to view hint */}
                  <p className="mt-2 text-right text-[9px] font-semibold uppercase tracking-wider text-sky-400 opacity-0 transition group-hover:opacity-100">
                    Tap to view →
                  </p>
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* ── Footer ─────────────────────────────────────────────────────── */}
      {unread.length > 0 && (
        <div className="border-t border-[#e2e8f0] px-4 py-2 text-center">
          <p className="text-[10px] text-slate-400">
            Click any notification to open its details page
          </p>
        </div>
      )}
    </div>
  );
}
