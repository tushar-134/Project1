import { Boxes, Folders, Settings2, Users, LayoutGrid, ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { useAuth } from "../../context/AuthContext.jsx";
import { canManageCategories, canManageGroups, canViewUsers } from "../../utils/permissions.js";
import UsersScreen from "./Users.jsx";
import CustomFieldsScreen from "./CustomFields.jsx";
import ClientGroupsScreen from "./ClientGroups.jsx";
import CategoriesScreen from "./Categories.jsx";

// Each tab is self-contained; add future settings categories here without touching layout code.
function buildTabs(role) {
  const tabs = [];

  if (canViewUsers(role)) {
    tabs.push({
      id: "users",
      label: "User Management",
      description: "Manage team members, roles, and access control",
      icon: Users,
      category: "People",
      component: UsersScreen,
    });
  }

  if (canManageCategories(role)) {
    tabs.push({
      id: "custom-fields",
      label: "Custom Fields",
      description: "Extend client profiles with additional data fields",
      icon: Settings2,
      category: "Data & Fields",
      component: CustomFieldsScreen,
    });
  }

  if (canManageGroups(role)) {
    tabs.push({
      id: "groups",
      label: "Client Groups",
      description: "Organise clients into logical business groups",
      icon: Folders,
      category: "Client Organisation",
      component: ClientGroupsScreen,
    });
  }

  if (canManageCategories(role)) {
    tabs.push({
      id: "categories",
      label: "Categories & Types",
      description: "Manage task categories and their associated task types",
      icon: Boxes,
      category: "Task Taxonomy",
      component: CategoriesScreen,
    });
  }

  return tabs;
}

export default function Settings() {
  const { currentUser } = useAuth();
  const role = currentUser?.role;
  const tabs = buildTabs(role);
  const [activeId, setActiveId] = useState(tabs[0]?.id ?? "");
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const activeTab = tabs.find((t) => t.id === activeId);
  const ActiveComponent = activeTab?.component ?? null;

  if (!tabs.length) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-slate-400">
        <LayoutGrid size={40} strokeWidth={1.5} />
        <div className="text-sm font-bold">No settings available for your role.</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Main layout: vertical sidebar tabs + content panel ── */}
      <div className="flex gap-5 min-h-[600px]">

        {/* Collapsible sidebar tab list */}
        <div className={`relative shrink-0 transition-all duration-300 ${sidebarOpen ? "w-[220px]" : "w-12"}`}>
          {/* Toggle button */}
          <button
            type="button"
            aria-label={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
            onClick={() => setSidebarOpen((o) => !o)}
            className="absolute -right-3 top-3 z-10 grid h-6 w-6 place-items-center rounded-full border border-[#e2e8f0] bg-white text-slate-500 shadow-sm transition hover:border-blue-300 hover:text-blue-600"
          >
            {sidebarOpen ? <ChevronLeft size={13} /> : <ChevronRight size={13} />}
          </button>

          <div className="space-y-1 overflow-hidden">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = tab.id === activeId;
              return (
                <button
                  key={tab.id}
                  type="button"
                  title={!sidebarOpen ? tab.label : undefined}
                  onClick={() => setActiveId(tab.id)}
                  className={`
                    group w-full rounded-xl text-left transition-all
                    ${sidebarOpen ? "px-4 py-3" : "px-2 py-3 flex justify-center"}
                    ${isActive
                      ? "bg-[#1e3a8a] text-white shadow-lg shadow-blue-900/20"
                      : "bg-white text-slate-700 border border-[#e2e8f0] hover:border-blue-200 hover:bg-blue-50/60"}
                  `}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg transition-colors
                        ${isActive ? "bg-white/15 text-white" : "bg-slate-100 text-slate-500 group-hover:bg-blue-100 group-hover:text-blue-700"}`}
                    >
                      <Icon size={16} />
                    </div>
                    {sidebarOpen && (
                      <div className="min-w-0">
                        <div className={`truncate text-[13px] font-extrabold leading-tight ${isActive ? "text-white" : "text-slate-800"}`}>
                          {tab.label}
                        </div>
                        <div className={`mt-0.5 truncate text-[10px] font-semibold uppercase tracking-wider ${isActive ? "text-white/65" : "text-slate-400"}`}>
                          {tab.category}
                        </div>
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Content panel */}
        <div className="min-w-0 flex-1 overflow-x-auto rounded-2xl border border-[#e2e8f0] bg-white shadow-sm">
          {/* Panel header */}
          {activeTab && (
            <div className="border-b border-[#e2e8f0] px-6 py-5"
              style={{ background: "linear-gradient(135deg, rgba(30,58,138,.025), rgba(30,58,138,.065))" }}
            >
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#1e3a8a] text-white shadow-md">
                  <activeTab.icon size={20} />
                </div>
                <div>
                  <div className="text-[17px] font-black text-slate-900">{activeTab.label}</div>
                  <div className="text-[12px] font-medium text-slate-500">{activeTab.description}</div>
                </div>
              </div>
            </div>
          )}

          {/* Screen content — rendered inside the panel */}
          <div className="p-6">
            {ActiveComponent && <ActiveComponent />}
          </div>
        </div>
      </div>
    </div>
  );
}
