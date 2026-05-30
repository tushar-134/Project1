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
  const asideClass = `side-scroll fixed left-0 top-0 z-50 flex h-dvh w-[272px] max-w-[88vw] flex-col overflow-y-auto bg-gradient-to-b from-[#1e3a8a] to-[#172d6b] text-white shadow-[4px_0_32px_rgba(0,0,0,0.22)] transition-transform duration-300 ease-[cubic-bezier(.4,0,.2,1)] lg:w-[240px] lg:max-w-none ${open ? "translate-x-0" : "-translate-x-full"}`;
  return (
    <aside className={asideClass} aria-hidden={!open}>
      {/* Sidebar header */}
      <div className="border-b border-white/10 px-4 py-3.5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#eab308] text-[15px] font-black text-white shadow-lg shadow-yellow-500/30">FB</div>
            <div>
              <div className="text-[14px] font-extrabold leading-tight tracking-tight">Filing Buddy</div>
              <div className="text-[10px] font-semibold text-white/55">Accounting LLC</div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-lg text-white/60 transition hover:bg-white/12 hover:text-white active:scale-95"
            aria-label="Close navigation"
          >
            <X size={16} />
          </button>
        </div>
      </div>
      <nav className="flex-1 px-2.5 py-4">
        {visibleNavItems.map((group) => (
          <div key={group.section} className="mb-5">
            <div className="mb-1.5 px-3 text-[9.5px] font-extrabold uppercase tracking-[.14em] text-white/38">{group.section}</div>
            <div className="space-y-0.5">
              {group.links.map(({ label, to, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={to === "/contacts"}
                  onClick={onClose}
                  className={({ isActive }) =>
                    `flex h-9 items-center gap-3 rounded-xl px-3 text-[12.5px] font-semibold transition-all duration-150 ${
                      isActive
                        ? "bg-white/16 text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,.16)] shadow-[0_2px_8px_rgba(0,0,0,.15)]"
                        : "text-white/70 hover:bg-white/9 hover:text-white"
                    }`
                  }
                >
                  <Icon size={16} className="shrink-0 opacity-80" />
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
