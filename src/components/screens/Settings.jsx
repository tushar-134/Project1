import { Boxes, Folders, Settings2, Users, LayoutGrid, ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { useAuth } from "../../context/AuthContext.jsx";
import { canManageCategories, canManageGroups, canViewUsers } from "../../utils/permissions.js";
import UsersScreen from "./Users.jsx";
import CustomFieldsScreen from "./CustomFields.jsx";
import ClientGroupsScreen from "./ClientGroups.jsx";
import CategoriesScreen from "./Categories.jsx";

function buildTabs(role) {
  const tabs = [];
  if (canViewUsers(role))
    tabs.push({ id: "users", label: "User Management", description: "Manage team members, roles, and access control", icon: Users, category: "People", component: UsersScreen });
  if (canManageCategories(role))
    tabs.push({ id: "custom-fields", label: "Custom Fields", description: "Extend client profiles with additional data fields", icon: Settings2, category: "Data & Fields", component: CustomFieldsScreen });
  if (canManageGroups(role))
    tabs.push({ id: "groups", label: "Client Groups", description: "Organise clients into logical business groups", icon: Folders, category: "Client Organisation", component: ClientGroupsScreen });
  if (canManageCategories(role))
    tabs.push({ id: "categories", label: "Categories & Types", description: "Manage task categories and their associated task types", icon: Boxes, category: "Task Taxonomy", component: CategoriesScreen });
  return tabs;
}

export default function Settings() {
  const { currentUser } = useAuth();
  const role = currentUser?.role;
  const tabs = buildTabs(role);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeId, setActiveId] = useState(tabs[0]?.id ?? "");
  const [headerAction, setHeaderAction] = useState(null);

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
    <div className="flex min-h-[560px] gap-4">
      {/* Collapsible nav panel wrapper */}
      <div
        className={`shrink-0 relative transition-all duration-300 ease-[cubic-bezier(.4,0,.2,1)] ${
          sidebarOpen ? "w-[240px]" : "w-[80px]"
        }`}
      >
        {/* Toggle Button on the edge */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="hidden lg:grid absolute -right-[12px] top-[26px] h-[24px] w-[24px] place-items-center rounded-full bg-[#1e3a8a] text-white shadow-md hover:bg-[#172d6b] transition-colors z-[60] border-2 border-white"
          aria-label={sidebarOpen ? "Collapse settings sidebar" : "Expand settings sidebar"}
        >
          {sidebarOpen ? <ChevronLeft size={13} strokeWidth={3} /> : <ChevronRight size={13} strokeWidth={3} />}
        </button>

        {/* Actual Sidebar box */}
        <div className="w-full h-full overflow-hidden rounded-2xl bg-white border border-[#e2e8f0] shadow-sm flex flex-col">
          {/* Nav header */}
          <div className={`flex items-center ${sidebarOpen ? "px-4 gap-3" : "justify-center px-0"} py-4 border-b border-[#e2e8f0] min-h-[65px]`}>
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#1e3a8a] text-white shadow-sm">
              <Settings2 size={16} />
            </div>
            {sidebarOpen && (
              <div className="min-w-0 transition-opacity duration-300">
                <div className="text-[14px] font-extrabold leading-tight tracking-tight text-slate-900">Settings</div>
                <div className="text-[10px] font-semibold text-slate-500">Management</div>
              </div>
            )}
          </div>

          {/* Nav items */}
          <nav className="flex-1 px-3 py-4">
            <div className="space-y-1">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = tab.id === activeId;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      setActiveId(tab.id);
                    }}
                    className={`group flex w-full h-11 items-center gap-3 ${sidebarOpen ? "rounded-2xl px-2" : "justify-center px-0"} font-semibold transition-all duration-200 relative ${
                      isActive
                        ? "text-[#1e3a8a]"
                        : "text-slate-500 hover:text-blue-700"
                    }`}
                  >
                    <div className={`relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-all duration-300 ${
                      isActive
                        ? "bg-blue-50 text-[#1e3a8a] ring-2 ring-blue-200 ring-offset-2 ring-offset-white"
                        : "text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-600 group-hover:ring-2 group-hover:ring-blue-100 group-hover:ring-offset-2 group-hover:ring-offset-white"
                    }`}>
                      <Icon size={18} strokeWidth={isActive ? 2.5 : 2} className="relative z-10" />
                    </div>
                    {sidebarOpen && (
                      <span className="min-w-0 flex-1 truncate text-left text-[13px] font-bold">{tab.label}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </nav>
        </div>
      </div>

      {/* Content panel */}
      <div className="min-w-0 flex-1 flex flex-col rounded-2xl border border-[#e2e8f0] bg-white shadow-sm overflow-hidden">
        {/* Top bar header moved inside the box */}
        <div className="flex flex-wrap items-center justify-between gap-4 p-6 border-b border-[#e2e8f0]">
          <div className="flex min-w-0 items-center gap-4">
            {activeTab && (
              <div className="flex min-w-0 items-center gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#1e3a8a] text-white shadow-md">
                  <activeTab.icon size={20} />
                </div>
                <div className="min-w-0">
                  <div className="truncate text-[17px] font-black text-slate-900">{activeTab.label}</div>
                  <div className="text-[12px] font-medium text-slate-500">{activeTab.description}</div>
                </div>
              </div>
            )}
          </div>
          {headerAction && <div className="shrink-0">{headerAction}</div>}
        </div>

        {/* Page Content */}
        <div className="p-6 flex-1 overflow-x-auto">
          {ActiveComponent && <ActiveComponent setSettingsHeaderAction={setHeaderAction} />}
        </div>
      </div>
    </div>
  );
}
