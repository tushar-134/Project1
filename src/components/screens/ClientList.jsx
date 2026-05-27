import { ChevronLeft, ChevronRight, Columns, Download, Pencil, RefreshCw, Search, SlidersHorizontal, Trash2, Upload, X } from "lucide-react";
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useApp } from "../../context/AppContext.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { useClients } from "../../hooks/useClients";
import { downloadBlob } from "../../utils/adapterUtils";
import { canCreateClients, canManageClients } from "../../utils/permissions.js";
import Badge from "../ui/Badge.jsx";
import Button from "../ui/Button.jsx";
import Card from "../ui/Card.jsx";
import ClientDrawer from "../ui/ClientDrawer.jsx";
import Table from "../ui/Table.jsx";

// ─── Column definitions ────────────────────────────────────────────────────
// key         : stable id used as the export "columns" param and visibility key
// label       : header label shown in the table
// defaultOn   : whether the column is visible by default
// description : short tooltip / subtitle in the column picker
const COLUMN_DEFS = [
  { key: "client",    label: "Client",        defaultOn: true,  description: "Name, type & jurisdiction" },
  { key: "group",     label: "Group",         defaultOn: true,  description: "Client group membership" },
  { key: "compliance",label: "Compliance",    defaultOn: true,  description: "Licence & VAT TRN" },
  { key: "contact",   label: "Contact",       defaultOn: true,  description: "Primary contact details" },
  { key: "createdAt", label: "Created Date",  defaultOn: false, description: "Date the client was added" },
  { key: "createdBy", label: "Created By",    defaultOn: false, description: "Staff member who created the client" },
];

// Keys that map to table columns the server knows about for CSV export.
// The "client" key maps to several server columns (name, jurisdiction, type).
const EXPORT_KEY_MAP = {
  client:     ["fileNo", "name", "jurisdiction", "type"],
  group:      ["group"],
  compliance: ["licence", "vatTrn"],
  contact:    ["contact", "mobile", "email"],
  createdAt:  ["createdAt"],
  createdBy:  ["createdBy"],
};

// ─── Filter helpers ────────────────────────────────────────────────────────
const EMPTY_COLUMN_FILTERS = {
  client: "",
  jurisdiction: "",
  type: "",
  group: "",
  compliance: "",
  contact: "",
  createdAt: "",
  createdBy: "",
};
const PAGE_SIZE = 20;

const JURISDICTION_OPTIONS = ["Mainland", "Free Zone", "Designated Zone", "Offshore"];
const TYPE_OPTIONS = ["Legal Person", "Natural Person"];

function buildActiveFilterSummary(columnFilters, query) {
  const chips = [];
  if (query.trim()) chips.push(`Search: ${query.trim()}`);
  if (columnFilters.client) chips.push(`Client: ${columnFilters.client}`);
  if (columnFilters.jurisdiction) chips.push(`Jurisdiction: ${columnFilters.jurisdiction}`);
  if (columnFilters.type) chips.push(`Type: ${columnFilters.type}`);
  if (columnFilters.group) chips.push(`Group: ${columnFilters.group}`);
  if (columnFilters.compliance) chips.push(`Compliance: ${columnFilters.compliance}`);
  if (columnFilters.contact) chips.push(`Contact: ${columnFilters.contact}`);
  if (columnFilters.createdAt) chips.push(`Created: ${columnFilters.createdAt}`);
  if (columnFilters.createdBy) chips.push(`Created By: ${columnFilters.createdBy}`);
  return chips;
}

function formatDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${String(d.getDate()).padStart(2, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}-${d.getFullYear()}`;
}

// ─── Sub-components ────────────────────────────────────────────────────────
function InfoPill({ tone, label }) {
  const tones = {
    navy:  "bg-[#dbe7ff] text-[#1e3a8a]",
    slate: "bg-slate-100 text-slate-600",
    amber: "bg-amber-100 text-amber-700",
    blue:  "bg-blue-50 text-blue-700",
    green: "bg-emerald-50 text-emerald-700",
  };
  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-[11px] font-extrabold ${tones[tone] || tones.slate}`}>
      {label}
    </span>
  );
}

function FilterField({ label, htmlFor, children }) {
  return (
    <label htmlFor={htmlFor} className="task-list-field">
      <span className="task-list-field-label">{label}</span>
      {children}
    </label>
  );
}

function LoadingRows({ columns }) {
  return Array.from({ length: 6 }).map((_, index) => (
    <tr key={`loading-row-${index}`}>
      {Array.from({ length: columns }).map((__, cellIndex) => (
        <td key={`loading-cell-${index}-${cellIndex}`}>
          <div className="h-4 animate-pulse rounded-full bg-slate-200" />
        </td>
      ))}
    </tr>
  ));
}

// ─── Column Customizer Popover ─────────────────────────────────────────────
function ColumnCustomizer({ visibility, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  // Close when clicking outside
  useEffect(() => {
    if (!open) return;
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const visibleCount = Object.values(visibility).filter(Boolean).length;

  return (
    <div ref={ref} className="relative">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-haspopup="true"
        id="col-customizer-btn"
      >
        <Columns size={15} />
        Columns
        {visibleCount < COLUMN_DEFS.length && (
          <span className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-[#1e3a8a] text-[9px] font-extrabold text-white">
            {visibleCount}
          </span>
        )}
      </Button>

      {open && (
        <div
          role="dialog"
          aria-label="Customize visible columns"
          className="absolute right-0 top-full z-50 mt-2 w-72 rounded-2xl border border-slate-200 bg-white shadow-xl"
          style={{ boxShadow: "0 8px 32px rgba(30,58,138,0.12)" }}
        >
          <div className="border-b border-slate-100 px-4 py-3">
            <div className="text-[13px] font-extrabold text-slate-900">Visible Columns</div>
            <div className="mt-0.5 text-[11px] font-medium text-slate-500">
              Toggle columns shown in the table and exported to Excel.
            </div>
          </div>
          <ul className="px-3 py-3 space-y-1 max-h-60 overflow-y-auto">
            {COLUMN_DEFS.map((col) => {
              const checked = visibility[col.key] ?? col.defaultOn;
              return (
                <li key={col.key}>
                  <label
                    htmlFor={`col-toggle-${col.key}`}
                    className="flex cursor-pointer items-center gap-3 rounded-xl px-2 py-2 hover:bg-slate-50 transition-colors"
                  >
                    <input
                      id={`col-toggle-${col.key}`}
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => onChange(col.key, e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 accent-[#1e3a8a]"
                    />
                    <span className="flex-1">
                      <span className="block text-[12px] font-bold text-slate-800">{col.label}</span>
                      <span className="block text-[11px] font-medium text-slate-400">{col.description}</span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
          <div className="border-t border-slate-100 px-4 py-3 flex justify-between">
            <button
              type="button"
              className="text-[11px] font-bold text-[#1e3a8a] hover:underline"
              onClick={() => {
                const all = {};
                COLUMN_DEFS.forEach((c) => { all[c.key] = true; });
                COLUMN_DEFS.forEach((c) => onChange(c.key, true));
                // bulk reset — call onChange for each
              }}
            >
              Show all
            </button>
            <button
              type="button"
              className="text-[11px] font-bold text-slate-500 hover:underline"
              onClick={() => {
                // Reset to defaults
                COLUMN_DEFS.forEach((c) => onChange(c.key, c.defaultOn));
              }}
            >
              Reset to defaults
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Month / Year Picker Popover ───────────────────────────────────────────
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function MonthYearPicker({ value, onChange }) {
  // value is "YYYY-MM" or ""
  const [open, setOpen]   = useState(false);
  const ref               = useRef(null);
  const now               = new Date();
  const parsed            = value ? { year: Number(value.split("-")[0]), month: Number(value.split("-")[1]) - 1 } : null;
  const [viewYear, setViewYear] = useState(parsed?.year ?? now.getFullYear());

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handleClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const displayLabel = parsed
    ? `${MONTH_NAMES[parsed.month]} ${parsed.year}`
    : "All months";

  const selectMonth = (monthIdx) => {
    const mm = String(monthIdx + 1).padStart(2, "0");
    onChange(`${viewYear}-${mm}`);
    setOpen(false);
  };

  const clear = (e) => { e.stopPropagation(); onChange(""); };

  return (
    <div ref={ref} className="relative">
      {/* Trigger button styled like the other inputs */}
      <button
        type="button"
        id="client-filter-created-at"
        onClick={() => setOpen((v) => !v)}
        className="input flex w-full items-center justify-between gap-1 text-left"
        style={{ minWidth: 0 }}
      >
        <span className={`text-[13px] font-semibold truncate ${parsed ? "text-slate-800" : "text-slate-400"}`}>
          {displayLabel}
        </span>
        <span className="flex shrink-0 items-center gap-1">
          {parsed && (
            <span
              role="button"
              tabIndex={0}
              aria-label="Clear month filter"
              onClick={clear}
              onKeyDown={(e) => e.key === "Enter" && clear(e)}
              className="grid h-4 w-4 place-items-center rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-700 transition-colors"
            >
              <X size={11} />
            </span>
          )}
          <ChevronRight size={13} className={`text-slate-400 transition-transform ${open ? "rotate-90" : ""}`} />
        </span>
      </button>

      {open && (
        <div
          className="absolute left-0 top-full z-50 mt-1 w-64 rounded-2xl border border-slate-200 bg-white shadow-xl"
          style={{ boxShadow: "0 8px 32px rgba(30,58,138,0.12)" }}
        >
          {/* Year navigation */}
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <button
              type="button"
              onClick={() => setViewYear((y) => y - 1)}
              className="grid h-7 w-7 place-items-center rounded-lg hover:bg-slate-100 text-slate-600 transition-colors"
              aria-label="Previous year"
            >
              <ChevronLeft size={15} />
            </button>
            <span className="text-[13px] font-extrabold text-slate-900">{viewYear}</span>
            <button
              type="button"
              onClick={() => setViewYear((y) => y + 1)}
              disabled={viewYear >= now.getFullYear()}
              className="grid h-7 w-7 place-items-center rounded-lg hover:bg-slate-100 text-slate-600 transition-colors disabled:opacity-30"
              aria-label="Next year"
            >
              <ChevronRight size={15} />
            </button>
          </div>

          {/* Month grid */}
          <div className="grid grid-cols-3 gap-1.5 px-3 py-3">
            {MONTH_NAMES.map((name, idx) => {
              const isSelected = parsed && parsed.year === viewYear && parsed.month === idx;
              const isFuture   = viewYear === now.getFullYear() && idx > now.getMonth();
              return (
                <button
                  key={name}
                  type="button"
                  disabled={isFuture}
                  onClick={() => selectMonth(idx)}
                  className={[
                    "rounded-xl py-2 text-[12px] font-bold transition-colors",
                    isSelected
                      ? "bg-[#1e3a8a] text-white shadow-sm"
                      : isFuture
                      ? "cursor-not-allowed text-slate-300"
                      : "text-slate-700 hover:bg-slate-100",
                  ].join(" ")}
                >
                  {name}
                </button>
              );
            })}
          </div>

          {/* Clear row */}
          {parsed && (
            <div className="border-t border-slate-100 px-4 py-2.5">
              <button
                type="button"
                onClick={() => { onChange(""); setOpen(false); }}
                className="text-[11px] font-bold text-slate-500 hover:text-[#1e3a8a] hover:underline transition-colors"
              >
                Clear filter
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────
export default function ClientList() {
  const { state } = useApp();
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { fetchClients, deleteClient, exportClients } = useClients();
  const [query, setQuery] = useState(searchParams.get("search") || "");
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ total: 0, page: 1, pages: 1, workingTasksTotal: 0 });
  const [columnFilters, setColumnFilters] = useState(EMPTY_COLUMN_FILTERS);
  const [drawerClientId, setDrawerClientId] = useState(null);

  // Column visibility state: key → boolean. Undefined means "use defaultOn".
  const [colVisibility, setColVisibility] = useState(() => {
    const init = {};
    COLUMN_DEFS.forEach((c) => { init[c.key] = c.defaultOn; });
    return init;
  });

  const canManage = canManageClients(currentUser?.role);
  const canCreate = canCreateClients(currentUser?.role);
  const clientsLoading = Boolean(state.loading.clients);
  const clientError = state.errors.clients;
  const deferredQuery = useDeferredValue(query);
  const deferredColumnFilters = useDeferredValue(columnFilters);

  // Visible columns list (ordered by COLUMN_DEFS order)
  const visibleColumns = useMemo(
    () => COLUMN_DEFS.filter((c) => colVisibility[c.key] !== false),
    [colVisibility]
  );
  const isVisible = useCallback((key) => colVisibility[key] !== false, [colVisibility]);

  // Total visible columns count for colspan (client + optional cols + actions)
  const tableColSpan = visibleColumns.length + (canManage ? 1 : 0);

  const requestParams = useMemo(() => ({
    page,
    limit: PAGE_SIZE,
    search: deferredQuery.trim() || undefined,
    client: deferredColumnFilters.client.trim() || undefined,
    jurisdiction: deferredColumnFilters.jurisdiction || undefined,
    type: deferredColumnFilters.type || undefined,
    group: deferredColumnFilters.group.trim() || undefined,
    compliance: deferredColumnFilters.compliance.trim() || undefined,
    contact: deferredColumnFilters.contact.trim() || undefined,
    createdAt: deferredColumnFilters.createdAt || undefined,
    createdBy: deferredColumnFilters.createdBy.trim() || undefined,
  }), [deferredColumnFilters, deferredQuery, page]);

  const filterRef = useRef(requestParams);
  filterRef.current = requestParams;

  const refetchClients = useCallback(async () => {
    const data = await fetchClients(filterRef.current);
    setMeta({
      total: data?.total || 0,
      page: data?.page || 1,
      pages: data?.pages || 1,
      workingTasksTotal: data?.workingTasksTotal || 0,
    });
    return data;
  }, [fetchClients]);

  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      refetchClients().catch(() => {}).finally(() => { if (!active) return; });
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [refetchClients, requestParams]);

  const rows = state.clients;
  const activeColumnFilters = buildActiveFilterSummary(columnFilters, query);
  const hasColumnFilters = Object.values(columnFilters).some(Boolean);
  const hasActiveFilters = Boolean(query.trim()) || hasColumnFilters;
  const activeFilterCount = activeColumnFilters.length;
  const workingCount = rows.filter((c) => (c.activeTasks || 0) > 0).length;

  const updateColumnFilter = (key, value) => {
    setPage(1);
    setColumnFilters((current) => ({ ...current, [key]: value }));
  };

  const clearColumnFilters = () => {
    setPage(1);
    setQuery("");
    setColumnFilters(EMPTY_COLUMN_FILTERS);
  };

  const resetAllFilters = () => {
    setPage(1);
    setQuery("");
    setColumnFilters(EMPTY_COLUMN_FILTERS);
  };

  const updateColVisibility = useCallback((key, value) => {
    setColVisibility((prev) => ({ ...prev, [key]: value }));
  }, []);

  // Build the `columns` param for the Excel export — only server-mappable keys that are visible
  const exportCsv = async () => {
    const serverCols = visibleColumns
      .flatMap((c) => EXPORT_KEY_MAP[c.key] || [])
      .filter(Boolean);
    const params = {
      search: deferredQuery.trim() || undefined,
      client: deferredColumnFilters.client.trim() || undefined,
      jurisdiction: deferredColumnFilters.jurisdiction || undefined,
      type: deferredColumnFilters.type || undefined,
      group: deferredColumnFilters.group.trim() || undefined,
      compliance: deferredColumnFilters.compliance.trim() || undefined,
      contact: deferredColumnFilters.contact.trim() || undefined,
      createdAt: deferredColumnFilters.createdAt || undefined,
      createdBy: deferredColumnFilters.createdBy.trim() || undefined,
      columns: serverCols.join(",") || undefined,
    };
    downloadBlob(await exportClients(params), "clients.xlsx");
  };

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="page-kicker">Client Directory</div>
          <h2 className="screen-title">Client List</h2>
        </div>
        {canManage && (
          <div className="flex gap-2">
            {canCreate && (
              <Button variant="ghost" onClick={() => navigate("/clients/bulk-upload")}>
                <Upload size={16} />
                Import
              </Button>
            )}
            <Button variant="ghost" onClick={exportCsv}>
              <Download size={16} />
              Export
            </Button>
          </div>
        )}
      </div>

      {/* Filter & review toolbar — mirrors TaskList design */}
      <Card>
        <div className="task-list-toolbar border-b border-slate-200 px-4 py-4 sm:px-5">
          {/* Header row: title + summary pills */}
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-2xl">
              <div className="flex items-center gap-2 text-[14px] font-extrabold text-slate-900">
                <SlidersHorizontal size={16} className="text-[#1e3a8a]" />
                Filter and review clients
              </div>
              <p className="mt-1 text-[12px] font-medium text-slate-500">
                Use the filters below to narrow the client list by name, type, jurisdiction, group, or contact details.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <InfoPill tone="navy" label={`${workingCount} with active tasks`} />
              <InfoPill tone="slate" label={`${meta.total} total`} />
              {meta.workingTasksTotal > 0 && (
                <InfoPill tone="green" label={`${meta.workingTasksTotal} active tasks`} />
              )}
              {clientsLoading && <InfoPill tone="amber" label="Refreshing" />}
              {hasActiveFilters && <InfoPill tone="blue" label={`${activeFilterCount} active filters`} />}
            </div>
          </div>

          {/* Global search + action buttons row */}
          <div className="mt-4 flex flex-wrap items-end gap-3">
            <label htmlFor="client-search" className="task-list-field flex-1 min-w-[200px]">
              <span className="task-list-field-label">Search</span>
              <div className="task-list-input-wrap">
                <Search size={14} className="task-list-input-icon" aria-hidden="true" />
                <input
                  id="client-search"
                  name="clientSearch"
                  className="input"
                  type="search"
                  placeholder="Name, TRN, licence, contact, email…"
                  value={query}
                  onChange={(e) => {
                    setPage(1);
                    setQuery(e.target.value);
                  }}
                />
              </div>
            </label>

            <div className="flex flex-wrap items-center gap-2 pb-0.5">
              {/* Column customizer */}
              <ColumnCustomizer visibility={colVisibility} onChange={updateColVisibility} />

              <Button variant="ghost" size="sm" onClick={refetchClients} disabled={clientsLoading}>
                <RefreshCw size={15} className={clientsLoading ? "animate-spin" : ""} />
                Refresh
              </Button>
              {hasColumnFilters && (
                <Button variant="ghost" size="sm" onClick={clearColumnFilters}>
                  <X size={15} />
                  Clear columns
                </Button>
              )}
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={resetAllFilters}>
                  Reset all
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Column filter grid — styled exactly like TaskList */}
        <div className="px-4 py-4 sm:px-5">
          <div className="task-list-column-grid">
            <FilterField label="Client Name" htmlFor="client-filter-name">
              <div className="task-list-input-wrap">
                <Search size={14} className="task-list-input-icon" aria-hidden="true" />
                <input
                  id="client-filter-name"
                  className="input"
                  type="search"
                  placeholder="Search client"
                  value={columnFilters.client}
                  onChange={(e) => updateColumnFilter("client", e.target.value)}
                />
              </div>
            </FilterField>

            <FilterField label="Jurisdiction" htmlFor="client-filter-jurisdiction">
              <select
                id="client-filter-jurisdiction"
                className="input"
                value={columnFilters.jurisdiction}
                onChange={(e) => updateColumnFilter("jurisdiction", e.target.value)}
              >
                <option value="">All jurisdictions</option>
                {JURISDICTION_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </FilterField>

            <FilterField label="Type" htmlFor="client-filter-type">
              <select
                id="client-filter-type"
                className="input"
                value={columnFilters.type}
                onChange={(e) => updateColumnFilter("type", e.target.value)}
              >
                <option value="">All types</option>
                {TYPE_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </FilterField>

            <FilterField label="Group" htmlFor="client-filter-group">
              <div className="task-list-input-wrap">
                <Search size={14} className="task-list-input-icon" aria-hidden="true" />
                <input
                  id="client-filter-group"
                  className="input"
                  type="search"
                  placeholder="Search group"
                  value={columnFilters.group}
                  onChange={(e) => updateColumnFilter("group", e.target.value)}
                />
              </div>
            </FilterField>

            <FilterField label="Compliance" htmlFor="client-filter-compliance">
              <div className="task-list-input-wrap">
                <Search size={14} className="task-list-input-icon" aria-hidden="true" />
                <input
                  id="client-filter-compliance"
                  className="input"
                  type="search"
                  placeholder="TRN or licence no."
                  value={columnFilters.compliance}
                  onChange={(e) => updateColumnFilter("compliance", e.target.value)}
                />
              </div>
            </FilterField>

            <FilterField label="Contact" htmlFor="client-filter-contact">
              <div className="task-list-input-wrap">
                <Search size={14} className="task-list-input-icon" aria-hidden="true" />
                <input
                  id="client-filter-contact"
                  className="input"
                  type="search"
                  placeholder="Name, phone or email"
                  value={columnFilters.contact}
                  onChange={(e) => updateColumnFilter("contact", e.target.value)}
                />
              </div>
            </FilterField>

            <FilterField label="Created Month" htmlFor="client-filter-created-at">
              <MonthYearPicker
                value={columnFilters.createdAt}
                onChange={(val) => updateColumnFilter("createdAt", val)}
              />
            </FilterField>

            <FilterField label="Created By" htmlFor="client-filter-created-by">
              <div className="task-list-input-wrap">
                <Search size={14} className="task-list-input-icon" aria-hidden="true" />
                <input
                  id="client-filter-created-by"
                  className="input"
                  type="search"
                  placeholder="Staff name"
                  value={columnFilters.createdBy}
                  onChange={(e) => updateColumnFilter("createdBy", e.target.value)}
                />
              </div>
            </FilterField>
          </div>

          {/* Active filter chips */}
          {hasActiveFilters && (
            <div className="mt-3 flex flex-wrap gap-2">
              {activeColumnFilters.map((item) => (
                <span key={item} className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-[11px] font-bold text-slate-600">
                  {item}
                </span>
              ))}
            </div>
          )}
        </div>
      </Card>

      {/* Client table */}
      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 sm:px-5">
          <div>
            <div className="text-[14px] font-extrabold text-[#1e3a8a]">Client List</div>
            <div className="mt-1 text-[12px] font-medium text-slate-500">
              {clientsLoading
                ? "Updating client list…"
                : hasActiveFilters
                  ? `Showing ${rows.length} of ${meta.total} matching clients.`
                  : "Click a client name to open details."}
            </div>
          </div>
          <div className="text-[12px] font-semibold text-slate-500">Click a name to open details</div>
        </div>
        <Table>
          <thead>
            <tr>
              {isVisible("client")     && <th>Client</th>}
              {isVisible("group")      && <th>Group</th>}
              {isVisible("compliance") && <th>Compliance</th>}
              {isVisible("contact")    && <th>Contact Details</th>}
              {isVisible("createdAt")  && <th>Created Date</th>}
              {isVisible("createdBy")  && <th>Created By</th>}
              {canManage               && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {clientsLoading && !rows.length && <LoadingRows columns={tableColSpan} />}

            {!clientsLoading && clientError && (
              <tr>
                <td colSpan={tableColSpan} className="px-4 py-10">
                  <div className="rounded-2xl border border-red-100 bg-red-50 px-5 py-5 text-center">
                    <div className="text-[14px] font-extrabold text-red-700">Unable to load clients</div>
                    <div className="mt-1 text-[12px] font-medium text-red-600">{String(clientError)}</div>
                    <div className="mt-4">
                      <Button variant="ghost" size="sm" onClick={refetchClients}>
                        <RefreshCw size={15} />
                        Try again
                      </Button>
                    </div>
                  </div>
                </td>
              </tr>
            )}

            {!clientsLoading && !clientError && !rows.length && (
              <tr>
                <td colSpan={tableColSpan} className="px-4 py-10">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-6 text-center">
                    <div className="text-[14px] font-extrabold text-slate-900">No clients match the current filters</div>
                    <div className="mt-1 text-[12px] font-medium text-slate-500">Adjust a filter or clear the search to see all clients.</div>
                    {hasActiveFilters && (
                      <div className="mt-4">
                        <Button variant="ghost" size="sm" onClick={resetAllFilters}>
                          Reset all filters
                        </Button>
                      </div>
                    )}
                  </div>
                </td>
              </tr>
            )}

            {!clientsLoading && !clientError && rows.map((client) => (
              <tr key={client.id}>
                {isVisible("client") && (
                  <td>
                    <button
                      type="button"
                      className="task-id-link font-extrabold text-left"
                      onClick={() => setDrawerClientId(client.id)}
                      title="Open client details"
                    >
                      {client.name}
                    </button>
                    <div className="mt-1 flex flex-wrap gap-2">
                      <span className="text-[12px] font-semibold text-slate-500">{client.jurisdiction}</span>
                      <Badge color={client.type === "Legal Person" ? "bg-blue-50 text-[#1e3a8a]" : "bg-emerald-50 text-[#059669]"}>
                        {client.type}
                      </Badge>
                      {client.activeTasks > 0 && (
                        <span className="inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-extrabold text-amber-700">
                          {client.activeTasks} active {client.activeTasks === 1 ? "task" : "tasks"}
                        </span>
                      )}
                    </div>
                  </td>
                )}
                {isVisible("group") && (
                  <td>{client.group ? <span className="rounded-full bg-purple-50 px-2 py-1 text-[11px] font-extrabold text-[#7c3aed]">{client.group}</span> : "—"}</td>
                )}
                {isVisible("compliance") && (
                  <td>
                    <div className="space-y-1">
                      <div><span className="font-semibold text-slate-500">Licence:</span> {client.licence || "—"}</div>
                      <div><span className="font-semibold text-slate-500">VAT TRN:</span> {client.vatTrn || "—"}</div>
                    </div>
                  </td>
                )}
                {isVisible("contact") && (
                  <td>
                    <div className="space-y-1">
                      <div><span className="font-semibold text-slate-500">Contact:</span> <span className="font-semibold text-slate-800">{client.contact || "—"}</span></div>
                      <div className="text-[12px] text-slate-500"><span className="font-semibold">Phone No:</span> {client.mobile || "—"}</div>
                      <div className="text-[12px] text-slate-500 break-all"><span className="font-semibold">Email:</span> {client.email || "—"}</div>
                    </div>
                  </td>
                )}
                {isVisible("createdAt") && (
                  <td>
                    <span className="text-[12px] font-semibold text-slate-700">{formatDate(client.createdAt)}</span>
                  </td>
                )}
                {isVisible("createdBy") && (
                  <td>
                    {client.createdByName
                      ? <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-700">{client.createdByName}</span>
                      : <span className="text-[12px] text-slate-400">—</span>}
                  </td>
                )}
                {canManage && (
                  <td>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => navigate(`/clients/edit/${client.id}`)}>
                        <Pencil size={14} />
                      </Button>
                      {currentUser?.role === "admin" && (
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={async () => {
                            if (confirm("Delete client?")) {
                              await deleteClient(client._id);
                              if (rows.length === 1 && page > 1) {
                                setPage((current) => Math.max(1, current - 1));
                              } else {
                                refetchClients().catch(() => {});
                              }
                            }
                          }}
                        >
                          <Trash2 size={14} />
                        </Button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </Table>

        {/* Pagination */}
        {meta.pages > 1 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-3 sm:px-5">
            <div className="text-[12px] font-semibold text-slate-500">
              Showing {Math.max(1, (meta.page - 1) * PAGE_SIZE + 1)} to {Math.min(meta.page * PAGE_SIZE, meta.total)} of {meta.total} clients
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={meta.page <= 1}>
                Previous
              </Button>
              <span className="text-[12px] font-semibold text-slate-500">Page {meta.page} of {meta.pages}</span>
              <Button variant="ghost" size="sm" onClick={() => setPage((current) => Math.min(meta.pages || 1, current + 1))} disabled={meta.page >= meta.pages}>
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>

      {drawerClientId && <ClientDrawer clientId={drawerClientId} onClose={() => setDrawerClientId(null)} />}
    </div>
  );
}
