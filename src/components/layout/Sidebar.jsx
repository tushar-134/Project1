import { NavLink } from "react-router-dom";
import { useEffect } from "react";
import { X, ClipboardList, ContactRound, FilePlus2, Files, LayoutDashboard, Upload, UserRoundPlus, PieChart, Landmark, Settings2, MapPinned, ChevronRight, ChevronLeft } from "lucide-react";
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
    { label: "FTA Tracker", to: "/tasks/fta-tracker", icon: Landmark },
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

export default function Sidebar({ mobileOpen = false, onMobileClose = () => {}, collapsed = false, onToggleCollapse = () => {} }) {
  const { currentUser } = useAuth();
  const { state } = useApp();
  const { fetchFtaTracker } = useTasks();
  const role = currentUser?.role;
  // Sidebar badges are driven from live task state so they stay accurate after status changes.
  useEffect(() => {
    if ((mobileOpen || !collapsed) && canViewFtaTracker(role)) fetchFtaTracker().catch(() => {});
  }, [mobileOpen, collapsed, role]);
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
  const asideClass = `side-scroll fixed left-0 top-0 z-50 flex h-dvh flex-col overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] bg-white border-r border-[#e2e8f0] transition-all duration-300 ease-[cubic-bezier(.4,0,.2,1)] 
    w-[272px] max-w-[88vw] ${mobileOpen ? "translate-x-0" : "-translate-x-full"}
    lg:translate-x-0 ${collapsed ? "lg:w-[88px]" : "lg:w-[240px]"}`;
  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div 
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm lg:hidden transition-opacity" 
          onClick={onMobileClose}
        />
      )}
      <aside className={asideClass} aria-hidden={!mobileOpen && typeof window !== 'undefined' && window.innerWidth < 1024}>
        {/* Toggle Button for Desktop — positioned at sidebar edge, vertically centered with logo */}
        <button
          onClick={onToggleCollapse}
          className="hidden lg:grid absolute -right-[14px] top-[22px] h-[28px] w-[28px] place-items-center rounded-full bg-[#7c3aed] text-white shadow-sm hover:bg-[#6d28d9] transition-colors z-10 border-[3.5px] border-white"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronRight size={14} strokeWidth={3} /> : <ChevronLeft size={14} strokeWidth={3} />}
        </button>

        {/* Sidebar header */}
        <div className={`flex items-center ${collapsed ? "justify-center" : "justify-between"} gap-3 px-4 py-3.5 min-h-[56px]`}>
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#7c3aed] text-[15px] font-black text-white shadow-sm">FB</div>
            {!collapsed && (
              <div className="min-w-0 transition-opacity duration-300">
                <div className="text-[14px] font-extrabold leading-tight tracking-tight text-slate-900">Filing Buddy</div>
                <div className="text-[10px] font-semibold text-slate-500">Accounting LLC</div>
              </div>
            )}
          </div>
          {/* Mobile Close Button */}
          <button
            onClick={onMobileClose}
            className="lg:hidden grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 active:scale-95"
            aria-label="Close navigation"
          >
            <X size={16} />
          </button>
        </div>

        <nav className="flex-1 px-3 py-6">
          {visibleNavItems.map((group) => (
            <div key={group.section} className={collapsed ? "mb-2" : "mb-6"}>
              {!collapsed && (
                <div className="mb-2 px-3 text-[10px] font-extrabold uppercase tracking-[.15em] text-slate-400">
                  {group.section}
                </div>
              )}
              <div className="space-y-1">
                {group.links.map(({ label, to, icon: Icon }) => {
                  return (
                    <NavLink
                      key={to}
                      to={to}
                      end={to === "/contacts"}
                      title={collapsed ? label : undefined}
                      className={({ isActive }) =>
                        `group flex h-11 items-center gap-3 rounded-2xl px-2 font-semibold transition-all duration-200 relative ${
                          isActive
                            ? "text-[#7c3aed]"
                            : "text-slate-500 hover:text-emerald-600"
                        } ${collapsed ? "justify-center" : ""}`
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <div className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-all duration-300 ${
                            isActive
                              ? "bg-purple-50 text-[#7c3aed] ring-2 ring-purple-100 ring-offset-2 ring-offset-white"
                              : "text-slate-400 group-hover:bg-emerald-50 group-hover:text-emerald-600 group-hover:ring-2 group-hover:ring-emerald-100 group-hover:ring-offset-2 group-hover:ring-offset-white"
                          }`}>
                            <Icon size={20} strokeWidth={isActive ? 2.5 : 2} className="relative z-10" />
                          </div>
                          {!collapsed && (
                            <span className="min-w-0 flex-1 truncate text-[13px] font-bold">{label}</span>
                          )}
                        </>
                      )}
                    </NavLink>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </aside>
    </>
  );
}
