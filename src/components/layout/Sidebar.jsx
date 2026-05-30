import { NavLink } from "react-router-dom";
import { useEffect } from "react";
import { X, ClipboardList, ContactRound, FilePlus2, Files, LayoutDashboard, Upload, UserRoundPlus, PieChart, Landmark, Settings2, MapPinned } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useApp } from "../../context/AppContext";
import { useTasks } from "../../hooks/useTasks";
import { canCreateClients, canManageCategories, canManageGroups, canManageClients, canManageTasks, canViewClientVisits, canViewContacts, canViewFtaTracker, canViewReports, canViewUsers } from "../../utils/permissions.js";

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
  ]},
  { section: "Field Operations", links: [
    { label: "Client Visits", to: "/client-visits", icon: MapPinned },
  ]},
  { section: "Settings", links: [
    { label: "Settings", to: "/settings", icon: Settings2 },
    { label: "Reports", to: "/reports", icon: PieChart },
  ]},
  { section: "Contacts", links: [
    { label: "Contact Directory", to: "/contacts", icon: ContactRound },
  ]},
];

export default function Sidebar({ open = false, onClose = () => {} }) {
  const { currentUser } = useAuth();
  const { state } = useApp();
  const { fetchFtaTracker } = useTasks();
  const role = currentUser?.role;
  // Sidebar badges are driven from live task state so they stay accurate after status changes.
  useEffect(() => {
    if (open && canViewFtaTracker(role)) fetchFtaTracker().catch(() => {});
  }, [open, role]);
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
          case "/settings":
            return canViewUsers(role) || canManageCategories(role) || canManageGroups(role);
          case "/reports":
            return canViewReports(role);
          case "/contacts":
            return canViewContacts(role);
          case "/client-visits":
            return canViewClientVisits(role);
          default:
            return true;
        }
      }),
    }))
    .filter((group) => group.links.length);
  const asideClass = `side-scroll fixed left-0 top-0 z-50 flex h-dvh w-[260px] max-w-[82vw] flex-col overflow-y-auto bg-[#1e3a8a] text-white shadow-2xl transition-transform duration-200 lg:w-[220px] lg:max-w-none ${open ? "translate-x-0" : "-translate-x-full"}`;
  return (
    <aside className={asideClass} aria-hidden={!open}>
      <div className="border-b border-white/10 p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-[#eab308] text-base font-black text-white">FB</div>
            <div>
              <div className="text-[13px] font-extrabold leading-tight">Filing Buddy</div>
              <div className="text-[10px] font-semibold text-white/65">Accounting LLC</div>
            </div>
          </div>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-lg text-white/75 hover:bg-white/10 hover:text-white" aria-label="Close navigation"><X size={17} /></button>
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
                  onClick={onClose}
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
    </aside>
  );
}
