import { NavLink } from "react-router-dom";
import { useEffect } from "react";
import { X, Boxes, ClipboardList, ContactRound, FilePlus2, Files, LayoutDashboard, LogOut, Upload, Users, UserRoundPlus, Folders, PieChart, Landmark, Settings2, MapPinned } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useApp } from "../../context/AppContext";
import { useTasks } from "../../hooks/useTasks";
import { canCreateClients, canManageCategories, canManageClients, canManageGroups, canManageUsers, canManageTasks, canViewClientVisits, canViewContacts, canViewFtaTracker, canViewReports, canViewUsers, ROLE_LABELS } from "../../utils/permissions.js";
import UserAvatar from "../ui/UserAvatar.jsx";

export const navItems = [
  { section: "Main", links: [{ label: "Dashboard", to: "/dashboard", icon: LayoutDashboard }] },
  { section: "Clients", links: [
    { label: "Add Client", to: "/clients/add", icon: UserRoundPlus },
    { label: "Client List", to: "/clients/list", icon: Files },
    { label: "Bulk Upload", to: "/clients/bulk-upload", icon: Upload },
  ]},
  { section: "Tasks", links: [
    { label: "Add Task", to: "/tasks/add", icon: FilePlus2 },
    { label: "Task List", to: "/tasks/list", icon: ClipboardList },
    { label: "FTA Tracker", to: "/tasks/fta-tracker", icon: Landmark, badge: "3" },
    { label: "Categories & Types", to: "/tasks/categories", icon: Boxes },
  ]},
  { section: "Settings", links: [
    { label: "Users", to: "/settings/users", icon: Users },
    { label: "Custom Fields", to: "/settings/custom-fields", icon: Settings2 },
    { label: "Client Groups", to: "/settings/groups", icon: Folders },
    { label: "Reports", to: "/reports", icon: PieChart },
  ]},
  { section: "Contacts", links: [
    { label: "Contact Directory", to: "/contacts", icon: ContactRound },
    { label: "Client Visit Tracker", to: "/contacts/visit-tracker", icon: MapPinned },
  ]},
];

export default function Sidebar({ open = false, onClose = () => {}, mobile = false }) {
  const { currentUser, logout } = useAuth();
  const { state } = useApp();
  const { fetchFtaTracker } = useTasks();
  const role = currentUser?.role;
  // Sidebar badges are driven from live task state so they stay accurate after status changes.
  useEffect(() => {
    if ((!mobile || open) && canViewFtaTracker(role)) fetchFtaTracker().catch(() => {});
  }, [mobile, open, role]);
  const ftaCount = state.ftaItems.filter((task) => task.ftaStatus !== "approved" && task.status !== "Approved").length;
  const visibleNavItems = navItems
    .map((group) => ({
      ...group,
      links: group.links.filter((link) => {
        switch (link.to) {
          case "/clients/add":
          case "/clients/bulk-upload":
            return canCreateClients(role);
          case "/tasks/add":
            return canManageTasks(role);
          case "/tasks/fta-tracker":
            return canViewFtaTracker(role);
          case "/tasks/categories":
            return canManageCategories(role);
          case "/settings/users":
            return canViewUsers(role);
          case "/settings/custom-fields":
            return canManageCategories(role); // Admins only
          case "/settings/groups":
            return canManageGroups(role);
          case "/reports":
            return canViewReports(role);
          case "/contacts":
            return canViewContacts(role);
          case "/contacts/visit-tracker":
            return canViewClientVisits(role);
          default:
            return true;
        }
      }),
    }))
    .filter((group) => group.links.length);
  const asideClass = mobile
    ? `side-scroll fixed left-0 top-0 z-50 flex h-dvh w-[260px] max-w-[82vw] flex-col overflow-y-auto bg-[#1e3a8a] text-white shadow-2xl transition-transform duration-200 ${open ? "translate-x-0" : "-translate-x-full"}`
    : "side-scroll fixed left-0 top-0 z-30 hidden h-screen w-[220px] min-w-[220px] flex-col overflow-y-auto bg-[#1e3a8a] text-white lg:flex";
  return (
    <aside className={asideClass} aria-hidden={mobile && !open}>
      <div className="border-b border-white/10 p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-[#eab308] text-base font-black text-white">FB</div>
            <div>
              <div className="text-[13px] font-extrabold leading-tight">Filing Buddy</div>
              <div className="text-[10px] font-semibold text-white/65">Accounting LLC</div>
            </div>
          </div>
          {mobile && <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-lg text-white/75 hover:bg-white/10 hover:text-white" aria-label="Close navigation"><X size={17} /></button>}
        </div>
      </div>
      <nav className="flex-1 px-3 py-4">
        {visibleNavItems.map((group) => (
          <div key={group.section} className="mb-5">
            <div className="mb-2 px-2 text-[10px] font-extrabold uppercase tracking-[.12em] text-white/45">{group.section}</div>
            <div className="space-y-1">
              {group.links.map(({ label, to, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={to === "/contacts"}
                  onClick={mobile ? onClose : undefined}
                  className={({ isActive }) => `flex h-9 items-center gap-2.5 rounded-lg px-3 text-[12px] font-bold transition ${isActive ? "bg-white/18 text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,.14)]" : "text-white/76 hover:bg-white/10 hover:text-white"}`}
                >
                  <Icon size={16} />
                  <span className="min-w-0 flex-1 truncate">{label}</span>
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>
      <div className="m-3 rounded-xl bg-white/10 p-3">
        <div className="flex items-center gap-2">
          <UserAvatar user={currentUser} size="sm" />
          <div className="min-w-0">
            <div className="truncate text-[12px] font-extrabold">{currentUser?.name}</div>
            <div className="text-[10px] font-bold text-white/60">{ROLE_LABELS[currentUser?.role] || currentUser?.role}</div>
          </div>
        </div>
        <button onClick={logout} className="mt-3 flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-white/15 bg-white/10 text-[12px] font-extrabold text-white/85 transition hover:bg-white/20 hover:text-white">
          <LogOut size={15} />
          Logout
        </button>
      </div>
    </aside>
  );
}
