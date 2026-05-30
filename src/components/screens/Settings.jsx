import { Boxes, Folders, Settings2, Users, LayoutGrid } from "lucide-react";
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
  const [sidebarOpen, setSidebarOpen] = useState(false);
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
    <div className="space-y-4">

      {/* ── Top bar: hamburger + breadcrumb ── */}
      <div className="flex items-center gap-3">
        {/* Animated hamburger — scoped to this page */}
        <button
          type="button"
          aria-label={sidebarOpen ? "Close settings menu" : "Open settings menu"}
          aria-expanded={sidebarOpen}
          onClick={() => setSidebarOpen((o) => !o)}
          className="settings-hamburger-btn"
          title={sidebarOpen ? "Close menu" : "Open menu"}
        >
          <span className={`settings-bar ${sidebarOpen ? "sbar-top-open" : ""}`} />
          <span className={`settings-bar ${sidebarOpen ? "sbar-mid-open" : ""}`} />
          <span className={`settings-bar ${sidebarOpen ? "sbar-bot-open" : ""}`} />
        </button>

      </div>

      {/* ── Inline layout: collapsible left nav + content ── */}
      <div className="flex min-h-[560px] gap-4">

        {/* Collapsible nav panel — inline, not fixed */}
        <div
          className={`shrink-0 overflow-hidden rounded-2xl border border-[#e2e8f0] bg-white shadow-sm transition-all duration-300 ease-[cubic-bezier(.4,0,.2,1)] ${
            sidebarOpen ? "w-[220px] opacity-100" : "w-0 opacity-0 border-transparent shadow-none"
          }`}
        >
          {/* Nav header */}
          <div className="border-b border-[#e2e8f0] bg-gradient-to-r from-[#1e3a8a] to-[#1d4ed8] px-4 py-3.5">
            <div className="flex items-center gap-2">
              <div className="grid h-7 w-7 place-items-center rounded-lg bg-white/15 text-white">
                <Settings2 size={14} />
              </div>
              <span className="whitespace-nowrap text-[13px] font-extrabold text-white">Settings</span>
            </div>
          </div>

          {/* Nav items */}
          <nav className="p-2.5">
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
                      setSidebarOpen(false);
                    }}
                    className={`group w-full rounded-xl px-3 py-2.5 text-left transition-all duration-150 ${
                      isActive
                        ? "bg-[#1e3a8a] text-white shadow-md shadow-blue-900/20"
                        : "hover:bg-blue-50 hover:text-blue-900 border border-[#e2e8f0] hover:border-blue-200 bg-white"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg transition-colors ${
                          isActive
                            ? "bg-white/15 text-white"
                            : "bg-slate-100 text-slate-500 group-hover:bg-blue-100 group-hover:text-blue-700"
                        }`}
                      >
                        <Icon size={16} />
                      </div>
                      <div className="min-w-0">
                        <div className={`whitespace-nowrap text-[12.5px] font-extrabold leading-tight ${isActive ? "text-white" : "text-slate-800"}`}>
                          {tab.label}
                        </div>
                        <div className={`whitespace-nowrap text-[9.5px] font-semibold uppercase tracking-wider ${isActive ? "text-white/65" : "text-slate-400"}`}>
                          {tab.category}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </nav>
        </div>

        {/* Content panel */}
        <div className="min-w-0 flex-1 overflow-x-auto rounded-2xl border border-[#e2e8f0] bg-white shadow-sm">
          {activeTab && (
            <div
              className="border-b border-[#e2e8f0] px-6 py-5"
              style={{ background: "linear-gradient(135deg, rgba(30,58,138,.025), rgba(30,58,138,.065))" }}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#1e3a8a] text-white shadow-md">
                    <activeTab.icon size={20} />
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-[17px] font-black text-slate-900">{activeTab.label}</div>
                    <div className="text-[12px] font-medium text-slate-500">{activeTab.description}</div>
                  </div>
                </div>
                {headerAction && <div className="shrink-0">{headerAction}</div>}
              </div>
            </div>
          )}
          <div className="p-6">
            {ActiveComponent && <ActiveComponent setSettingsHeaderAction={setHeaderAction} />}
          </div>
        </div>

      </div>
    </div>
  );
}
