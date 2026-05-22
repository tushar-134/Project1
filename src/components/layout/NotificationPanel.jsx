import { useEffect, useState } from "react";
import { useApp } from "../../context/AppContext";
import { useNotifications } from "../../hooks/useNotifications";
import { CheckCheck, Bell, X, ChevronDown, ChevronUp } from "lucide-react";

// Type labels for the detail view badge
const TYPE_LABELS = {
  task_due: "Task Due",
  task_overdue: "Task Overdue",
  client_added: "Client Added",
  fta_query: "FTA Query",
  task_update: "Task Update",
};

const TYPE_COLORS = {
  task_due: "bg-amber-100 text-amber-700",
  task_overdue: "bg-red-100 text-red-700",
  client_added: "bg-emerald-100 text-emerald-700",
  fta_query: "bg-purple-100 text-purple-700",
  task_update: "bg-sky-100 text-sky-700",
};

export default function NotificationPanel({ open }) {
  const { state } = useApp();
  const { fetchNotifications, markRead, markAllRead } = useNotifications();
  // Track which notification is expanded (showing detail)
  const [expandedId, setExpandedId] = useState(null);
  // Track items that are animating out (fading/sliding away)
  const [dismissing, setDismissing] = useState(new Set());

  useEffect(() => {
    // Polling keeps the panel and bell badge fresh even when other users or cron jobs create notifications.
    fetchNotifications().catch(() => {});
    const id = setInterval(() => fetchNotifications().catch(() => {}), 60_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (open) fetchNotifications().catch(() => {});
    // Collapse any expanded notification when panel is closed
    if (!open) setExpandedId(null);
  }, [open]);

  // Clicking a notification: expand to show detail, mark read, then remove after animation
  function handleNotificationClick(event, item) {
    event.stopPropagation();

    if (expandedId === item._id) {
      // Already expanded — collapse it
      setExpandedId(null);
      return;
    }

    // Expand to show detail
    setExpandedId(item._id);

    // Mark as read via API + remove from state after user has seen the detail (800ms)
    setTimeout(() => {
      setDismissing((prev) => new Set(prev).add(item._id));
      // After the CSS transition (300ms), remove from state entirely
      setTimeout(() => {
        markRead(item._id);
        setExpandedId(null);
        setDismissing((prev) => {
          const next = new Set(prev);
          next.delete(item._id);
          return next;
        });
      }, 300);
    }, 1200);
  }

  async function handleMarkAllRead(event) {
    event.stopPropagation();
    setExpandedId(null);
    await markAllRead();
  }

  const unreadNotifications = state.notifications.filter((n) => !n.isRead);
  const unreadCount = state.unreadCount || 0;

  function formatTime(dateStr) {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60_000);
    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHrs = Math.floor(diffMins / 60);
    if (diffHrs < 24) return `${diffHrs}h ago`;
    return `${Math.floor(diffHrs / 24)}d ago`;
  }

  return (
    <div
      className={`absolute right-0 top-[46px] z-50 w-[calc(100vw-24px)] max-w-[340px] overflow-hidden rounded-b-xl border border-t-0 border-[#e2e8f0] bg-white shadow-2xl transition-all duration-200 ${
        open ? "translate-x-0 opacity-100" : "pointer-events-none translate-x-5 opacity-0"
      }`}
    >
      {/* Header */}
      <div className="border-b border-[#e2e8f0] bg-gradient-to-r from-[#1e3a8a] to-[#1d4ed8] px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Bell size={14} className="text-white/80" />
            <div>
              <div className="text-[13px] font-extrabold text-white">Notifications</div>
              <div className="text-[10px] font-semibold text-white/60">
                {unreadCount > 0 ? `${unreadCount} unread alert${unreadCount > 1 ? "s" : ""}` : "All caught up"}
              </div>
            </div>
          </div>
          {unreadCount > 0 ? (
            <button
              type="button"
              onClick={handleMarkAllRead}
              className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1.5 text-[10px] font-extrabold text-white backdrop-blur transition hover:bg-white/30"
            >
              <CheckCheck size={11} />
              Mark all read
            </button>
          ) : (
            <span className="rounded-full bg-emerald-400/20 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.08em] text-emerald-200">
              ✓ All read
            </span>
          )}
        </div>
      </div>

      {/* Notification List */}
      <div className="max-h-[440px] overflow-y-auto p-2">
        {unreadNotifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-3 py-10 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50">
              <CheckCheck size={22} className="text-emerald-500" />
            </div>
            <div className="text-[13px] font-extrabold text-slate-700">You're all caught up!</div>
            <div className="mt-1 text-[11px] text-slate-400">No new notifications at the moment.</div>
          </div>
        ) : (
          unreadNotifications.map((item) => {
            const isExpanded = expandedId === item._id;
            const isDismissing = dismissing.has(item._id);
            const typeColor = TYPE_COLORS[item.type] || "bg-slate-100 text-slate-600";
            const typeLabel = TYPE_LABELS[item.type] || item.type;

            return (
              <div
                key={item._id}
                className={`mb-2 overflow-hidden rounded-xl border border-sky-200 bg-sky-50 shadow-sm transition-all duration-300 ${
                  isDismissing ? "max-h-0 scale-95 opacity-0 mb-0" : "max-h-[400px] scale-100 opacity-100"
                }`}
              >
                {/* Notification Row */}
                <button
                  type="button"
                  onClick={(e) => handleNotificationClick(e, item)}
                  className="w-full p-3 text-left transition hover:bg-sky-100/60"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      {/* Type badge + time */}
                      <div className="flex items-center gap-2">
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider ${typeColor}`}>
                          {typeLabel}
                        </span>
                        {item.createdAt && (
                          <span className="text-[10px] text-slate-400">{formatTime(item.createdAt)}</span>
                        )}
                      </div>
                      {/* Title */}
                      <div className="text-[12px] font-extrabold text-slate-900 leading-tight">{item.title}</div>
                      {/* Short message preview when collapsed */}
                      {!isExpanded && (
                        <div className="text-[11px] text-slate-500 leading-4 line-clamp-1">{item.message}</div>
                      )}
                    </div>
                    {/* Expand / collapse chevron */}
                    <div className="shrink-0 mt-0.5 text-slate-400">
                      {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </div>
                  </div>
                </button>

                {/* Expanded Detail Panel */}
                {isExpanded && (
                  <div className="border-t border-sky-200 bg-white px-3 pb-3 pt-2.5">
                    {/* Full message */}
                    <p className="text-[12px] leading-5 text-slate-700">{item.message}</p>

                    {/* Meta info */}
                    <div className="mt-2.5 flex flex-wrap gap-2">
                      {item.createdAt && (
                        <div className="rounded-lg bg-slate-100 px-2.5 py-1 text-[10px] text-slate-500">
                          🕐 {new Date(item.createdAt).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </div>
                      )}
                    </div>

                    {/* Dismiss hint */}
                    <div className="mt-2.5 flex items-center justify-between">
                      <span className="text-[10px] italic text-slate-400">This notification will be dismissed after reading…</span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          // Immediately dismiss
                          setDismissing((prev) => new Set(prev).add(item._id));
                          setTimeout(() => {
                            markRead(item._id);
                            setExpandedId(null);
                            setDismissing((prev) => {
                              const next = new Set(prev);
                              next.delete(item._id);
                              return next;
                            });
                          }, 300);
                        }}
                        className="flex items-center gap-1 rounded-full bg-slate-900 px-2.5 py-1 text-[10px] font-bold text-white transition hover:bg-slate-700"
                      >
                        <X size={9} />
                        Dismiss
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
