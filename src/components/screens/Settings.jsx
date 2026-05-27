import {
  Bell,
  Folders,
  LayoutGrid,
  Lock,
  Settings2,
  SlidersHorizontal,
  Users,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext.jsx";
import {
  canManageCategories,
  canManageGroups,
  canViewUsers,
} from "../../utils/permissions.js";
import ClientGroupsScreen from "./ClientGroups.jsx";
import CustomFieldsScreen from "./CustomFields.jsx";
import UsersScreen from "./Users.jsx";

/* ─── Placeholder panel for upcoming setting categories ─── */
function ComingSoonPanel({ icon: Icon, title, description, items = [] }) {
  return (
    <div className="flex flex-col items-center justify-center gap-6 py-10 text-center">
      <div
        className="grid h-16 w-16 place-items-center rounded-2xl shadow-lg"
        style={{
          background: "linear-gradient(135deg,#1e3a8a 0%,#3b82f6 100%)",
        }}
      >
        <Icon size={28} className="text-white" />
      </div>
      <div>
        <div className="text-[18px] font-black text-slate-800">{title}</div>
        <div className="mt-1 max-w-xs text-[13px] font-medium text-slate-500">
          {description}
        </div>
      </div>
      {items.length > 0 && (
        <div className="w-full max-w-md space-y-2 text-left">
          {items.map((item) => (
            <div
              key={item}
              className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3"
            >
              <div className="h-2 w-2 rounded-full bg-blue-400" />
              <span className="text-[13px] font-semibold text-slate-600">
                {item}
              </span>
              <span className="ml-auto rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-amber-600">
                Soon
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Tab definitions, role-gated ─── */
function buildTabs(role) {
  const tabs = [];

  if (canViewUsers(role)) {
    tabs.push({
      id: "users",
      label: "User Management",
      description: "Manage team members, roles, and access control",
      icon: Users,
      category: "People",
      accent: "#6366f1",
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
      accent: "#0ea5e9",
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
      accent: "#10b981",
      component: ClientGroupsScreen,
    });
  }

  // ── Placeholder tabs visible to admin / manager ──
  if (canManageCategories(role) || canViewUsers(role)) {
    tabs.push({
      id: "task-preferences",
      label: "Task Preferences",
      description: "Default settings for task creation and automation",
      icon: SlidersHorizontal,
      category: "Tasks",
      accent: "#f59e0b",
      placeholder: true,
      placeholderItems: [
        "Default task due-date offset (days)",
        "Auto-assign tasks on client creation",
        "Task status workflow customisation",
        "FTA reminder threshold (days before due)",
        "Default task category per client type",
      ],
    });

    tabs.push({
      id: "notifications",
      label: "Notifications",
      description: "Configure alerts, reminders, and email preferences",
      icon: Bell,
      category: "Alerts",
      accent: "#ec4899",
      placeholder: true,
      placeholderItems: [
        "Email alerts for overdue tasks",
        "Client licence expiry reminders",
        "Daily digest summary emails",
        "In-app notification preferences",
        "Push notification support (mobile)",
      ],
    });

    tabs.push({
      id: "security",
      label: "Security & Access",
      description: "Passwords, sessions, and role-based access policies",
      icon: Lock,
      category: "Security",
      accent: "#dc2626",
      placeholder: true,
      placeholderItems: [
        "Password complexity requirements",
        "Session timeout policy",
        "Two-factor authentication (2FA)",
        "Audit log retention period",
        "IP allowlist for admin access",
      ],
    });
  }

  return tabs;
}

/* ─── Main component ─── */
export default function Settings() {
  const { currentUser } = useAuth();
  const role = currentUser?.role;
  const tabs = buildTabs(role);
  const [activeId, setActiveId] = useState(tabs[0]?.id ?? "");
  const [animating, setAnimating] = useState(false);

  const activeTab = tabs.find((t) => t.id === activeId);
  const ActiveComponent = activeTab?.component ?? null;

  function switchTab(id) {
    if (id === activeId) return;
    setAnimating(true);
    setTimeout(() => {
      setActiveId(id);
      setAnimating(false);
    }, 120);
  }

  useEffect(() => {
    if (tabs.length && !tabs.find((t) => t.id === activeId)) {
      setActiveId(tabs[0].id);
    }
  }, [role]);

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
      {/* ── Page header ── */}
      <div
        className="relative overflow-hidden rounded-2xl px-7 py-6"
        style={{
          background:
            "linear-gradient(135deg, #0f172a 0%, #1e3a8a 55%, #2563eb 100%)",
        }}
      >
        {/* decorative blobs */}
        <div
          className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full opacity-20"
          style={{ background: "radial-gradient(circle, #60a5fa, transparent 70%)" }}
        />
        <div
          className="pointer-events-none absolute bottom-0 left-1/2 h-24 w-64 -translate-x-1/2 opacity-10"
          style={{ background: "radial-gradient(ellipse, #818cf8, transparent 70%)" }}
        />
        <div className="relative z-10">
          <div className="mb-1 text-[11px] font-black uppercase tracking-[.14em] text-blue-300">
            Administration
          </div>
          <h1 className="text-[24px] font-black leading-tight text-white sm:text-[28px]">
            Settings
          </h1>
          <p className="mt-1 max-w-xl text-[13px] font-medium text-blue-200/80">
            Control users, data fields, task behaviour, notifications, and security policies — all from one place.
          </p>
        </div>
      </div>

      {/* ── Main layout ── */}
      <div className="flex gap-5" style={{ minHeight: 620 }}>
        {/* ── Sidebar tab list ── */}
        <div className="w-[230px] min-w-[230px] shrink-0 space-y-1.5">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = tab.id === activeId;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => switchTab(tab.id)}
                className="group w-full rounded-xl px-3.5 py-3 text-left transition-all duration-150"
                style={
                  isActive
                    ? {
                        background: `linear-gradient(135deg, ${tab.accent}22 0%, ${tab.accent}11 100%)`,
                        border: `1.5px solid ${tab.accent}55`,
                        boxShadow: `0 4px 18px ${tab.accent}22`,
                      }
                    : {
                        background: "white",
                        border: "1.5px solid #e2e8f0",
                      }
                }
              >
                <div className="flex items-center gap-3">
                  <div
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-lg transition-all duration-150"
                    style={
                      isActive
                        ? { background: tab.accent, color: "white", boxShadow: `0 3px 10px ${tab.accent}55` }
                        : { background: "#f1f5f9", color: "#64748b" }
                    }
                  >
                    <Icon size={15} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div
                      className="truncate text-[12.5px] font-extrabold leading-tight transition-colors"
                      style={{ color: isActive ? tab.accent : "#1e293b" }}
                    >
                      {tab.label}
                    </div>
                    <div className="mt-0.5 truncate text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      {tab.category}
                    </div>
                  </div>
                  {tab.placeholder && (
                    <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-amber-600">
                      Soon
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* ── Content panel ── */}
        <div
          className="min-w-0 flex-1 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
          style={{ transition: "box-shadow .2s" }}
        >
          {/* Panel header */}
          {activeTab && (
            <div
              className="border-b border-slate-100 px-6 py-5"
              style={{
                background: `linear-gradient(135deg, ${activeTab.accent}0a 0%, ${activeTab.accent}18 100%)`,
              }}
            >
              <div className="flex items-center gap-3.5">
                <div
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-xl shadow-md"
                  style={{
                    background: `linear-gradient(135deg, ${activeTab.accent} 0%, ${activeTab.accent}cc 100%)`,
                    color: "white",
                  }}
                >
                  <activeTab.icon size={20} />
                </div>
                <div>
                  <div className="text-[17px] font-black text-slate-900">
                    {activeTab.label}
                  </div>
                  <div className="text-[12px] font-medium text-slate-500">
                    {activeTab.description}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Screen content */}
          <div
            className="p-6 transition-opacity duration-150"
            style={{ opacity: animating ? 0 : 1 }}
          >
            {activeTab?.placeholder ? (
              <ComingSoonPanel
                icon={activeTab.icon}
                title={activeTab.label}
                description={activeTab.description}
                items={activeTab.placeholderItems}
              />
            ) : (
              ActiveComponent && <ActiveComponent />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
