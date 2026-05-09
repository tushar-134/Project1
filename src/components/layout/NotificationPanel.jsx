import { useEffect } from "react";
import { useApp } from "../../context/AppContext";
import { useNotifications } from "../../hooks/useNotifications";

export default function NotificationPanel({ open }) {
  const { state } = useApp();
  const { fetchNotifications, markRead, markAllRead } = useNotifications();
  useEffect(() => {
    // Polling keeps the panel and bell badge fresh even when other users or cron jobs create notifications.
    fetchNotifications().catch(() => {});
    const id = setInterval(() => fetchNotifications().catch(() => {}), 60000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => { if (open) fetchNotifications().catch(() => {}); }, [open]);
  return (
    <div className={`absolute right-5 top-[52px] z-30 w-[320px] overflow-hidden rounded-b-xl border border-t-0 border-[#e2e8f0] bg-white shadow-xl transition duration-200 ${open ? "translate-x-0 opacity-100" : "pointer-events-none translate-x-5 opacity-0"}`}>
      <div className="border-b border-[#e2e8f0] px-4 py-3">
        <div className="flex items-center justify-between"><div className="text-[13px] font-extrabold">Notifications</div><button onClick={markAllRead} className="text-[11px] font-bold text-[#1e3a8a]">Mark all read</button></div>
        <div className="text-[11px] font-semibold text-slate-500">Practice alerts and task updates</div>
      </div>
      <div className="max-h-[420px] overflow-y-auto p-2">
        {state.notifications.map((item) => (
          <button key={item._id} onClick={() => markRead(item._id)} className={`mb-2 block w-full rounded-lg border border-[#e2e8f0] p-3 text-left ${!item.isRead ? "bg-sky-50" : "bg-white"}`}>
            <div className="text-[12px] font-extrabold text-slate-900">{item.title}</div>
            <div className="mt-1 text-[12px] leading-5 text-slate-600">{item.message}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
