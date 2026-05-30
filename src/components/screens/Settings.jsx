import { Boxes, Folders, Settings2, Users, LayoutGrid, X } from "lucide-react";
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
  // Default closed — user opens with hamburger
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
    <div className="relative space-y-4">

      {/* ── Top bar: hamburger + active tab label ── */}
      <div className="flex items-center gap-3">
        {/* Animated hamburger button */}
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

        {/* Active tab breadcrumb */}
        {activeTab && (
          <div className="flex items-center gap-2.5">
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#1e3a8a] text-white shadow-md shadow-blue-900/20">
              <activeTab.icon size={16} />
            </div>
            <div>
              <div className="text-[14px] font-extrabold leading-tight text-slate-900">{activeTab.label}</div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{activeTab.category}</div>
            </div>
          </div>
        )}
      </div>

      {/* ── Slide-in settings nav panel (overlay) ── */}
      {/* Backdrop — dims content but doesn't block interaction */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-30 bg-slate-900/20 backdrop-blur-[1px] pointer-events-none" />
      )}

      {/* Slide panel */}
      <div
        className={`fixed left-0 top-0 z-40 flex h-dvh w-[260px] flex-col bg-white shadow-2xl shadow-slate-900/20 transition-transform duration-300 ease-[cubic-bezier(.4,0,.2,1)] ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Panel header */}
        <div className="flex items-center justify-between border-b border-[#e2e8f0] bg-gradient-to-r from-[#1e3a8a] to-[#1d4ed8] px-4 py-4">
          <div className="flex items-center gap-2.5">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-white/15 text-white">
              <Settings2 size={16} />
            </div>
            <span className="text-[14px] font-extrabold text-white">Settings</span>
          </div>
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="grid h-8 w-8 place-items-center rounded-lg text-white/70 transition hover:bg-white/15 hover:text-white active:scale-95"
            aria-label="Close settings menu"
          >
            <X size={16} />
          </button>
        </div>

        {/* Nav items */}
        <nav className="flex-1 overflow-y-auto px-3 py-3">
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
                  className={`group w-full rounded-xl px-3 py-3 text-left transition-all duration-150 ${
                    isActive
                      ? "bg-[#1e3a8a] text-white shadow-md shadow-blue-900/20"
                      : "bg-white text-slate-700 hover:bg-blue-50 hover:text-blue-900 border border-[#e2e8f0] hover:border-blue-200"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg transition-colors ${
                        isActive
                          ? "bg-white/15 text-white"
                          : "bg-slate-100 text-slate-500 group-hover:bg-blue-100 group-hover:text-blue-700"
                      }`}
                    >
                      <Icon size={17} />
                    </div>
                    <div className="min-w-0">
                      <div className={`truncate text-[13px] font-extrabold leading-tight ${isActive ? "text-white" : "text-slate-800"}`}>
                        {tab.label}
                      </div>
                      <div className={`mt-0.5 truncate text-[10px] font-semibold uppercase tracking-wider ${isActive ? "text-white/65" : "text-slate-400"}`}>
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

      {/* ── Content panel ── */}
      <div className="min-w-0 flex-1 overflow-x-auto rounded-2xl border border-[#e2e8f0] bg-white shadow-sm">
        {/* Panel header */}
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

        {/* Screen content */}
        <div className="p-6">
          {ActiveComponent && <ActiveComponent setSettingsHeaderAction={setHeaderAction} />}
        </div>
      </div>
    </div>
  );
}
