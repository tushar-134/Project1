import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Bell, ChevronDown, Menu, Settings, UserCircle2 } from "lucide-react";
import NotificationPanel from "./NotificationPanel.jsx";
import ProfilePanel from "./ProfilePanel.jsx";
import ExpiryAlertPanel from "./ExpiryAlertPanel.jsx";
import { useAuth } from "../../context/AuthContext";
import { useApp } from "../../context/AppContext";
import { ROLE_LABELS } from "../../utils/permissions.js";
import UserAvatar from "../ui/UserAvatar.jsx";

export default function TopBar({ title, onMenuClick }) {
  const [open, setOpen] = useState(false);
  const [expiryOpen, setExpiryOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileTab, setProfileTab] = useState("profile");
  const wrapRef = useRef(null);
  const expiryRef = useRef(null);
  const menuRef = useRef(null);
  const { currentUser } = useAuth();
  const { state } = useApp();
  const roleLabel = ROLE_LABELS[currentUser?.role] || currentUser?.role || "User";
  const [expirySummary, setExpirySummary] = useState({ total: 0, expiredCount: 0, expiringSoonCount: 0 });

  useEffect(() => {
    // Clicking outside the bell/panel cluster should close notifications without affecting the rest of the page.
    function onPointerDown(event) {
      if (wrapRef.current && !wrapRef.current.contains(event.target)) setOpen(false);
      if (expiryRef.current && !expiryRef.current.contains(event.target)) setExpiryOpen(false);
      if (menuRef.current && !menuRef.current.contains(event.target)) setMenuOpen(false);
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
        <div ref={expiryRef} className="relative">
          <button
            onClick={() => {
              setExpiryOpen((v) => !v);
              setOpen(false);
            }}
            className="relative grid h-9 w-9 place-items-center rounded-lg border border-[#e2e8f0] bg-white text-slate-600 hover:bg-slate-50"
            aria-label="Expiry alerts"
            aria-expanded={expiryOpen}
          >
            <AlertTriangle size={17} />
            {expirySummary.total > 0 && <span className="absolute right-1.5 top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-[#ea580c] px-1 text-[9px] font-extrabold text-white ring-2 ring-white">{Math.min(expirySummary.total, 99)}</span>}
          </button>
          <ExpiryAlertPanel open={expiryOpen} onClose={() => setExpiryOpen(false)} onSummaryChange={setExpirySummary} />
        </div>
        <button onClick={() => setOpen((v) => !v)} className="relative grid h-9 w-9 place-items-center rounded-lg border border-[#e2e8f0] bg-white text-slate-600 hover:bg-slate-50" aria-label="Notifications" aria-expanded={open}>
          <Bell size={17} />
          {state.unreadCount > 0 && <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-[#dc2626] ring-2 ring-white" />}
        </button>
        <div className="hidden text-right sm:block">
          <div className="text-[12px] font-extrabold">{currentUser?.name || "Signed In User"}</div>
          <div className="text-[10px] font-bold text-slate-500">{roleLabel}</div>
        </div>
        <div ref={menuRef} className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((value) => !value)}
            className="flex items-center gap-1 rounded-full border border-[#e2e8f0] bg-white p-1 pr-2 text-slate-700 hover:bg-slate-50"
            aria-label="Open profile menu"
            aria-expanded={menuOpen}
          >
            <UserAvatar user={currentUser} size="sm" />
            <ChevronDown size={14} className={`transition ${menuOpen ? "rotate-180" : ""}`} />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-full z-50 mt-2 w-56 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl shadow-slate-200">
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  setProfileTab("profile");
                  setProfileOpen(true);
                }}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-[13px] font-semibold text-slate-700 hover:bg-slate-50"
              >
                <UserCircle2 size={16} />
                My Profile
              </button>
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  setProfileTab("settings");
                  setProfileOpen(true);
                }}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-[13px] font-semibold text-slate-700 hover:bg-slate-50"
              >
                <Settings size={16} />
                Settings
              </button>
            </div>
          )}
        </div>
        <NotificationPanel open={open} onClose={() => setOpen(false)} />
      </div>
      <ProfilePanel open={profileOpen} initialTab={profileTab} onClose={() => setProfileOpen(false)} />
    </header>
  );
}
