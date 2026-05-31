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
    <div className="space-y-4">

      {/* ── Top bar: hamburger + header ── */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          {/* Animated hamburger — scoped to this page */}
          <button
            type="button"
            aria-label={sidebarOpen ? "Close settings menu" : "Open settings menu"}
            aria-expanded={sidebarOpen}
            onClick={() => setSidebarOpen((o) => !o)}
            className="settings-hamburger-btn shrink-0"
            title={sidebarOpen ? "Close menu" : "Open menu"}
          >
            <span className={`settings-bar ${sidebarOpen ? "sbar-top-open" : ""}`} />
            <span className={`settings-bar ${sidebarOpen ? "sbar-mid-open" : ""}`} />
            <span className={`settings-bar ${sidebarOpen ? "sbar-bot-open" : ""}`} />
          </button>

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

      {/* ── Inline layout: collapsible left nav + content ── */}
      <div className="flex min-h-[560px] gap-4">

        {/* Collapsible nav panel — inline, not fixed */}
        <div
          className={`shrink-0 overflow-hidden rounded-2xl bg-gradient-to-b from-[#1e3a8a] to-[#172d6b] text-white shadow-[0_4px_20px_rgba(0,0,0,0.15)] transition-all duration-300 ease-[cubic-bezier(.4,0,.2,1)] ${
            sidebarOpen ? "w-[240px] opacity-100" : "w-0 opacity-0 shadow-none"
          }`}
        >
          {/* Nav header */}
          <div className="flex items-center gap-3 px-4 py-3.5 min-h-[56px] border-b border-white/10">
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/15 text-white shadow-sm">
              <Settings2 size={16} />
            </div>
            <div className="min-w-0">
              <div className="text-[14px] font-extrabold leading-tight tracking-tight text-white">Settings</div>
              <div className="text-[10px] font-semibold text-white/55">Management</div>
            </div>
          </div>

          {/* Nav items */}
          <nav className="flex-1 px-2.5 py-4">
            <div className="space-y-0.5">
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
                    className={`group flex w-full h-9 items-center gap-3 rounded-xl px-3 font-semibold transition-all duration-150 relative ${
                      isActive
                        ? "bg-white/16 text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,.16)] shadow-[0_2px_8px_rgba(0,0,0,.15)]"
                        : "text-white/70 hover:bg-white/9 hover:text-white"
                    }`}
                  >
                    <Icon size={20} strokeWidth={isActive ? 2.5 : 2} className={`shrink-0 ${isActive ? "opacity-100" : "opacity-80"}`} />
                    <span className="min-w-0 flex-1 truncate text-left text-[12.5px]">{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </nav>
        </div>

        {/* Content panel */}
        <div className="min-w-0 flex-1 overflow-x-auto rounded-2xl border border-[#e2e8f0] bg-white shadow-sm">

          <div className="p-6">
            {ActiveComponent && <ActiveComponent setSettingsHeaderAction={setHeaderAction} />}
          </div>
        </div>

      </div>
    </div>
  );
}
