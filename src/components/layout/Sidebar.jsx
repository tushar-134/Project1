import { NavLink } from "react-router-dom";
import { useEffect } from "react";
import { BarChart3, Boxes, ClipboardList, FilePlus2, Files, LayoutDashboard, ListChecks, Settings, Upload, Users, UserRoundPlus, Folders, PieChart, Landmark } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useApp } from "../../context/AppContext";
import { useTasks } from "../../hooks/useTasks";

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
    { label: "Client Groups", to: "/settings/groups", icon: Folders },
    { label: "Reports", to: "/reports", icon: PieChart },
  ]},
];

export default function Sidebar() {
  const { currentUser } = useAuth();
  const { state } = useApp();
  const { fetchFtaTracker } = useTasks();
  // Sidebar badges are driven from live task state so they stay accurate after status changes.
  useEffect(() => { fetchFtaTracker().catch(() => {}); }, []);
  const ftaCount = state.ftaItems.filter((task) => task.ftaStatus !== "approved" && task.status !== "Approved").length;
  const initials = (currentUser?.name || "User").split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();
  return (
    <aside className="side-scroll fixed left-0 top-0 z-30 flex h-screen w-[220px] min-w-[220px] flex-col overflow-y-auto bg-[#1e3a8a] text-white">
      <div className="border-b border-white/10 p-4">
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-[#eab308] text-base font-black text-white">FB</div>
          <div>
            <div className="text-[13px] font-extrabold leading-tight">Filing Buddy</div>
            <div className="text-[10px] font-semibold text-white/65">Accounting LLC</div>
          </div>
        </div>
      </div>
      <nav className="flex-1 px-3 py-4">
        {navItems.map((group) => (
          <div key={group.section} className="mb-5">
            <div className="mb-2 px-2 text-[10px] font-extrabold uppercase tracking-[.12em] text-white/45">{group.section}</div>
            <div className="space-y-1">
              {group.links.map(({ label, to, icon: Icon, badge }) => (
                <NavLink key={to} to={to} className={({ isActive }) => `flex h-9 items-center gap-2.5 rounded-lg px-3 text-[12px] font-bold transition ${isActive ? "bg-white/18 text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,.14)]" : "text-white/76 hover:bg-white/10 hover:text-white"}`}>
                  <Icon size={16} />
                  <span className="min-w-0 flex-1 truncate">{label}</span>
                  {badge && <span className="rounded-full bg-[#eab308] px-1.5 py-0.5 text-[10px] font-black text-white">{label === "FTA Tracker" ? ftaCount : badge}</span>}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>
      <div className="m-3 rounded-xl bg-white/10 p-3">
        <div className="flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-full bg-[#eab308] text-[12px] font-black text-white">{initials}</div>
          <div className="min-w-0">
            <div className="truncate text-[12px] font-extrabold">{currentUser?.name}</div>
            <div className="text-[10px] font-bold text-white/60">{currentUser?.role}</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
