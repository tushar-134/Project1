import { useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";
import NotificationPanel from "./NotificationPanel.jsx";
import { useAuth } from "../../context/AuthContext";
import { useApp } from "../../context/AppContext";

export default function TopBar({ title }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const { currentUser } = useAuth();
  const { state } = useApp();
  const initials = (currentUser?.name || "User").split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();

  useEffect(() => {
    // Clicking outside the bell/panel cluster should close notifications without affecting the rest of the page.
    function onPointerDown(event) {
      if (wrapRef.current && !wrapRef.current.contains(event.target)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  return (
    <header className="relative flex h-[52px] shrink-0 items-center justify-between border-b border-[#e2e8f0] bg-white px-6">
      <h1 className="text-[18px] font-extrabold text-slate-900">{title}</h1>
      <div ref={wrapRef} className="flex items-center gap-4">
        <button onClick={() => setOpen((v) => !v)} className="relative grid h-9 w-9 place-items-center rounded-lg border border-[#e2e8f0] bg-white text-slate-600 hover:bg-slate-50" aria-label="Notifications">
          <Bell size={17} />
          {state.unreadCount > 0 && <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-[#dc2626] ring-2 ring-white" />}
        </button>
        <div className="hidden text-right sm:block">
          <div className="text-[12px] font-extrabold">Filing Buddy Accounting LLC</div>
          <div className="text-[10px] font-bold text-slate-500">UAE Practice Management</div>
        </div>
        <div className="grid h-9 w-9 place-items-center rounded-full bg-[#1e3a8a] text-[12px] font-black text-white">{initials}</div>
        <NotificationPanel open={open} />
      </div>
    </header>
  );
}
