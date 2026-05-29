import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  Clock,
  Info,
  RefreshCw,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import { useApp } from "../../context/AppContext.jsx";
import { useTasks } from "../../hooks/useTasks";
import { sortOptionsWithOtherLast } from "../../utils/optionSort";
import Badge from "../ui/Badge.jsx";
import Button from "../ui/Button.jsx";
import Card from "../ui/Card.jsx";
import ClientComboBox from "../ui/ClientComboBox.jsx";
import Table from "../ui/Table.jsx";

const CATEGORY_FILTERS = sortOptionsWithOtherLast([
  "VAT",
  "Corporate Tax",
  "Audit",
  "Accounting",
  "MIS Reporting",
  "E-Invoicing",
  "VAT Refund",
  "Other",
]);

const TABS = [
  {
    id: "in_review",
    label: "In Review",
    statusMatch: "In Review",
    icon: Clock,
    color: "#1e3a8a",
    bg: "bg-blue-50",
    text: "text-[#1e3a8a]",
    border: "border-[#1e3a8a]",
    description:
      "Initial state for all FTA submissions. Tasks remain here until FTA takes action.",
  },
  {
    id: "additional_query",
    label: "Additional Query (FTA)",
    statusMatch: "Additional Query From FTA",
    icon: AlertCircle,
    color: "#d97706",
    bg: "bg-yellow-50",
    text: "text-yellow-700",
    border: "border-yellow-500",
    description:
      "FTA has asked for more information. The firm must respond before status can advance.",
  },
];

const FTA_STATUSES = ["In Review", "Additional Query From FTA", "Approved"];

function createEmptyFilters() {
  return { client: "", category: "", assigned: "", recurring: "", dueDate: "" };
}

function buildFilterSummary(f) {
  return [
    f.client ? `Client: ${f.client}` : null,
    f.category ? `Category: ${f.category}` : null,
    f.assigned ? `Assigned: ${f.assigned}` : null,
    f.recurring ? `Recurring: ${f.recurring === "recurring" ? "Recurring" : "One-time"}` : null,
    f.dueDate ? `Due Date: ${f.dueDate}` : null,
  ].filter(Boolean);
}

export default function FtaTracker() {
  const { currentUser } = useAuth();
  const isTaskOnly = currentUser?.role === "task_only";
  const { state } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const { fetchFtaTracker, updateFtaStatus } = useTasks();

  const [activeTab, setActiveTab] = useState("in_review");
  const [filters, setFilters] = useState(createEmptyFilters());
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [loading, setLoading] = useState(false);

  function refresh() {
    setLoading(true);
    fetchFtaTracker({})
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    refresh();
  }, [location.pathname]);

  const currentTab = TABS.find((t) => t.id === activeTab);

  const filtered = state.ftaItems.filter((item) => {
    if (filters.category && item.category !== filters.category) return false;
    if (filters.client && !item.client?.toLowerCase().includes(filters.client.toLowerCase()))
      return false;
    if (filters.assigned && !item.assigned?.toLowerCase().includes(filters.assigned.toLowerCase()))
      return false;
    if (filters.recurring === "recurring" && !item.recurring) return false;
    if (filters.recurring === "one-time" && item.recurring) return false;
    if (filters.dueDate && item.dueDate !== filters.dueDate) return false;
    return true;
  });

  const tabItems = filtered.filter((item) => item.status === currentTab.statusMatch);
  const countFor = (tab) => filtered.filter((item) => item.status === tab.statusMatch).length;

  const activeFilterSummary = buildFilterSummary(filters);
  const hasFilters = activeFilterSummary.length > 0;

  const updateFilter = (key, value) =>
    setFilters((prev) => ({ ...prev, [key]: value }));

  const clearFilters = () => setFilters(createEmptyFilters());

  // Unique assignee options derived from loaded items
  const assigneeOptions = [
    ...new Set(state.ftaItems.map((i) => i.assigned).filter(Boolean)),
  ].sort();

  return (
    <div className="space-y-5">
      {/* Task-only info banner */}
      {isTaskOnly && (
        <div className="flex items-center gap-2.5 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-[13px] text-blue-800">
          <Info size={15} className="shrink-0 text-blue-500" />
          <span>
            You are viewing FTA tasks{" "}
            <strong>assigned to you only</strong>. Contact your manager to
            update FTA status.
          </span>
        </div>
      )}

      {/* ── Filter accordion ── */}
      <Card className="p-0 overflow-hidden">
        {/* Toolbar row: stats + clear actions */}
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-5 py-3.5">
          {/* Stats pills */}
          <div className="flex flex-wrap items-center gap-2">
            <InfoPill tone="navy" label={`${filtered.length} items`} />
            <InfoPill tone="slate" label={`${tabItems.length} in ${currentTab.label}`} />
            {loading && <InfoPill tone="amber" label="Refreshing…" />}
            {hasFilters && (
              <InfoPill
                tone="blue"
                label={`${activeFilterSummary.length} filter${activeFilterSummary.length > 1 ? "s" : ""} active`}
              />
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={refresh}
              disabled={loading}
              className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:border-blue-200 hover:bg-blue-50 hover:text-[#1e3a8a] disabled:cursor-not-allowed disabled:opacity-60"
              aria-label="Refresh FTA tracker"
              title="Refresh"
            >
              <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
            </button>
            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X size={14} />
                Clear
              </Button>
            )}
          </div>
        </div>

        {/* Accordion toggle */}
        <button
          type="button"
          id="fta-filter-toggle"
          aria-expanded={filtersOpen}
          aria-controls="fta-filter-body"
          onClick={() => setFiltersOpen((prev) => !prev)}
          className={[
            "group flex w-full items-center justify-between gap-3 border-y px-5 py-2.5 text-left transition-all duration-150",
            hasFilters
              ? "border-blue-100 bg-blue-50/60 hover:bg-blue-50"
              : "border-slate-100 bg-slate-50/80 hover:bg-slate-100/80",
          ].join(" ")}
        >
          <span className="flex items-center gap-2">
            <span
              className={[
                "flex h-6 w-6 shrink-0 items-center justify-center rounded-md transition-colors duration-150",
                hasFilters
                  ? "bg-[#1e3a8a] text-white shadow-sm shadow-blue-200"
                  : "bg-white text-slate-400 ring-1 ring-slate-200 group-hover:text-slate-600",
              ].join(" ")}
            >
              <SlidersHorizontal size={12} />
            </span>
            <span
              className={[
                "text-[11px] font-extrabold uppercase tracking-widest",
                hasFilters ? "text-[#1e3a8a]" : "text-slate-500",
              ].join(" ")}
            >
              Filter Options
            </span>
            {hasFilters && (
              <span className="inline-flex items-center gap-1 rounded-full bg-[#1e3a8a] px-2 py-0.5 text-[10px] font-extrabold text-white">
                {activeFilterSummary.length} active
              </span>
            )}
          </span>

          <span className="flex items-center gap-1.5">
            <span
              className={`text-[10px] font-semibold transition-colors duration-150 ${
                hasFilters
                  ? "text-blue-400"
                  : "text-slate-300 group-hover:text-slate-400"
              }`}
            >
              {filtersOpen ? "Hide" : "Show"}
            </span>
            <ChevronDown
              size={14}
              className={[
                "transition-all duration-200",
                filtersOpen ? "rotate-180" : "",
                hasFilters ? "text-[#1e3a8a]" : "text-slate-400",
              ].join(" ")}
            />
          </span>
        </button>

        {/* Accordion body */}
        <div
          id="fta-filter-body"
          role="region"
          aria-labelledby="fta-filter-toggle"
          style={{
            display: "grid",
            gridTemplateRows: filtersOpen ? "1fr" : "0fr",
            transition: "grid-template-rows 0.25s ease",
          }}
        >
          <div style={{ overflow: filtersOpen ? "visible" : "hidden" }}>
            <div className="px-5 py-4">
              <div className="task-list-column-grid">
                {/* Client */}
                <FilterField label="Client" htmlFor="fta-filter-client">
                  <ClientComboBox
                    clients={state.clients}
                    value={filters.client}
                    onChange={(val) => updateFilter("client", val)}
                    useNameAsValue={true}
                    inputId="fta-filter-client"
                    placeholder="Search client"
                  />
                </FilterField>

                {/* Category */}
                <FilterField label="Category" htmlFor="fta-filter-category">
                  <select
                    id="fta-filter-category"
                    className="input"
                    value={filters.category}
                    onChange={(e) => updateFilter("category", e.target.value)}
                  >
                    <option value="">All categories</option>
                    {CATEGORY_FILTERS.map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </select>
                </FilterField>

                {/* Assigned */}
                <FilterField label="Assigned" htmlFor="fta-filter-assigned">
                  <select
                    id="fta-filter-assigned"
                    className="input"
                    value={filters.assigned}
                    onChange={(e) => updateFilter("assigned", e.target.value)}
                  >
                    <option value="">All assignees</option>
                    {assigneeOptions.map((a) => (
                      <option key={a} value={a}>
                        {a}
                      </option>
                    ))}
                  </select>
                </FilterField>

                {/* Recurring */}
                <FilterField label="Recurring" htmlFor="fta-filter-recurring">
                  <select
                    id="fta-filter-recurring"
                    className="input"
                    value={filters.recurring}
                    onChange={(e) => updateFilter("recurring", e.target.value)}
                  >
                    <option value="">All tasks</option>
                    <option value="recurring">Recurring</option>
                    <option value="one-time">One-time</option>
                  </select>
                </FilterField>

                {/* Due Date */}
                <FilterField label="Due Date" htmlFor="fta-filter-due-date">
                  <input
                    id="fta-filter-due-date"
                    className="input"
                    type="date"
                    value={filters.dueDate}
                    onChange={(e) => updateFilter("dueDate", e.target.value)}
                  />
                </FilterField>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* ── Status tab bar ── */}
      <div className="flex flex-wrap gap-0 overflow-hidden rounded-xl border border-[#e2e8f0] bg-white">
        {TABS.map((tab, idx) => {
          const Icon = tab.icon;
          const count = countFor(tab);
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex flex-1 min-w-[160px] items-center justify-center gap-2 px-5 py-4 text-[13px] font-extrabold transition-all border-b-2 ${
                isActive
                  ? `${tab.border} ${tab.text} bg-white`
                  : "border-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-700"
              } ${idx > 0 ? "border-l border-l-[#e2e8f0]" : ""}`}
              style={isActive ? { borderBottomColor: tab.color } : {}}
            >
              <Icon size={15} style={{ color: isActive ? tab.color : undefined }} />
              {tab.label}
              {count > 0 && (
                <span
                  className="ml-1 rounded-full px-2 py-0.5 text-[11px] font-extrabold"
                  style={
                    isActive
                      ? { background: tab.color, color: "#fff" }
                      : { background: "#f1f5f9", color: "#64748b" }
                  }
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Table ── */}
      <Card>
        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-400 text-[13px]">
            Loading…
          </div>
        ) : tabItems.length === 0 ? (
          <EmptyState tab={currentTab} />
        ) : (
          <Table>
            <thead>
              <tr>
                <th>Task ID</th>
                <th>Client</th>
                <th>Category</th>
                <th>FTA Task</th>
                <th>Due Date</th>
                <th>Submitted On</th>
                <th>Assigned</th>
                <th>FTA Status</th>
                <th>Recurring</th>
                {!isTaskOnly && <th>Edit</th>}
              </tr>
            </thead>
            <tbody>
              {tabItems.map((item) => (
                <tr
                  key={item.id}
                  className={
                    currentTab.id === "additional_query" ? "bg-yellow-50/60" : ""
                  }
                >
                  <td className="font-extrabold text-[#1e3a8a]">{item.taskId}</td>
                  <td>{item.client}</td>
                  <td>
                    <Badge>{item.category}</Badge>
                  </td>
                  <td>{item.type}</td>
                  <td>
                    <div>{item.dueDate}</div>
                    {item.overdueDays > 0 && (
                      <span className="mt-1 inline-flex rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-extrabold text-[#dc2626]">
                        {item.overdueDays}d overdue
                      </span>
                    )}
                  </td>
                  <td>{item.submitted || "—"}</td>
                  <td>{item.assigned}</td>
                  <td>
                    {isTaskOnly || currentTab.readOnly ? (
                      <FtaStatusBadge status={item.status} />
                    ) : (
                      <select
                        id={`fta-status-${item.id}`}
                        name={`ftaStatus${item.id}`}
                        className="input h-8 min-w-48"
                        value={item.status}
                        onChange={(e) =>
                          updateFtaStatus(item.id, e.target.value).catch(() =>
                            fetchFtaTracker({})
                          )
                        }
                      >
                        {FTA_STATUSES.map((s) => (
                          <option key={s}>{s}</option>
                        ))}
                      </select>
                    )}
                  </td>
                  <td>
                    {item.recurring && (
                      <span className="rounded-full bg-blue-50 px-2 py-1 text-[11px] font-extrabold text-[#1e3a8a]">
                        Recurring
                      </span>
                    )}
                  </td>
                  {!isTaskOnly && (
                    <td>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => navigate(`/tasks/edit/${item.id}`)}
                      >
                        Edit
                      </Button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}

/* ── Sub-components ── */

function InfoPill({ tone, label }) {
  const styles = {
    navy: "bg-[#1e3a8a]/10 text-[#1e3a8a]",
    slate: "bg-slate-100 text-slate-600",
    amber: "bg-amber-50 text-amber-600",
    blue: "bg-blue-100 text-blue-700",
    green: "bg-green-100 text-green-700",
    orange: "bg-orange-50 text-orange-600",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-extrabold ${styles[tone] ?? styles.slate}`}
    >
      {label}
    </span>
  );
}

function FilterField({ label, htmlFor, children }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={htmlFor}
        className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500"
      >
        {label}
      </label>
      {children}
    </div>
  );
}

function EmptyState({ tab }) {
  const Icon = tab.icon;
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <div
        className="flex h-12 w-12 items-center justify-center rounded-full"
        style={{ background: tab.color + "18" }}
      >
        <Icon size={22} style={{ color: tab.color }} />
      </div>
      <div className="text-[14px] font-extrabold text-slate-700">
        No tasks in &quot;{tab.label}&quot;
      </div>
      <div className="max-w-xs text-[13px] text-slate-400">{tab.description}</div>
    </div>
  );
}

function FtaStatusBadge({ status }) {
  if (status === "Approved") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-3 py-1 text-[11px] font-extrabold text-green-700">
        <CheckCircle2 size={11} /> Approved
      </span>
    );
  }
  if (status === "Additional Query From FTA") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 px-3 py-1 text-[11px] font-extrabold text-yellow-700">
        <AlertCircle size={11} /> Additional Query
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-3 py-1 text-[11px] font-extrabold text-[#1e3a8a]">
      <Clock size={11} /> In Review
    </span>
  );
}
