import { useEffect, useRef, useState } from "react";
import { Bell, Menu } from "lucide-react";
import NotificationPanel from "./NotificationPanel.jsx";
import { useAuth } from "../../context/AuthContext";
import { useApp } from "../../context/AppContext";
import { ROLE_LABELS } from "../../utils/permissions.js";

export default function TopBar({ title, onMenuClick }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const { currentUser } = useAuth();
  const { state } = useApp();
  const initials = (currentUser?.name || "User").split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();
  const roleLabel = ROLE_LABELS[currentUser?.role] || currentUser?.role || "User";

  useEffect(() => {
    // Clicking outside the bell/panel cluster should close notifications without affecting the rest of the page.
    function onPointerDown(event) {
      if (wrapRef.current && !wrapRef.current.contains(event.target)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  return (
    <header className="relative flex min-h-[52px] shrink-0 items-center justify-between gap-3 border-b border-[#e2e8f0] bg-white px-3 py-2 sm:px-4 lg:px-6">
      <div className="flex min-w-0 items-center gap-2">
        <button onClick={onMenuClick} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-[#e2e8f0] bg-white text-slate-700 hover:bg-slate-50 lg:hidden" aria-label="Open navigation">
          <Menu size={18} />
        </button>
        <h1 className="min-w-0 truncate text-[16px] font-extrabold text-slate-900 sm:text-[18px]">{title}</h1>
      </div>
      <div ref={wrapRef} className="relative flex shrink-0 items-center gap-2 sm:gap-4">
        <button onClick={() => setOpen((v) => !v)} className="relative grid h-9 w-9 place-items-center rounded-lg border border-[#e2e8f0] bg-white text-slate-600 hover:bg-slate-50" aria-label="Notifications" aria-expanded={open}>
          <Bell size={17} />
          {state.unreadCount > 0 && <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-[#dc2626] ring-2 ring-white" />}
        </button>
        <div className="hidden text-right sm:block">
          <div className="text-[12px] font-extrabold">{currentUser?.name || "Signed In User"}</div>
          <div className="text-[10px] font-bold text-slate-500">{roleLabel}</div>
        </div>
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#1e3a8a] text-[12px] font-black text-white">{initials}</div>
        <NotificationPanel open={open} onClose={() => setOpen(false)} />
      </div>
    </header>
  );
}
