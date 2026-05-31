import { ChevronDown, Columns, Download, RefreshCw, Search, SlidersHorizontal, X } from "lucide-react";
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useApp } from "../../context/AppContext.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { useUsers } from "../../hooks/useUsers.js";
import { useTasks } from "../../hooks/useTasks";
import { useClients } from "../../hooks/useClients";
import { categoryService } from "../../services/categoryService";
import { clientService } from "../../services/clientService";
import { downloadBlob, mapCategory, mapClient } from "../../utils/adapterUtils";
import { compareOptionsWithOtherLast } from "../../utils/optionSort";
import { canManageTasks } from "../../utils/permissions.js";
import Badge from "../ui/Badge.jsx";
import Button from "../ui/Button.jsx";
import Card from "../ui/Card.jsx";
import ClientComboBox from "../ui/ClientComboBox.jsx";
import ExportModal from "../ui/ExportModal.jsx";
import Table from "../ui/Table.jsx";
import TaskDrawer from "../ui/TaskDrawer.jsx";

const COLUMN_DEFS = [
  { key: "taskId", label: "Task ID", defaultOn: true, description: "Unique task identifier" },
  { key: "client", label: "Client", defaultOn: true, description: "Client name" },
  { key: "category", label: "Category", defaultOn: true, description: "Task category (e.g. VAT)" },
  { key: "type", label: "Task Type", defaultOn: true, description: "Specific task type" },
  { key: "dueDate", label: "Due Date", defaultOn: true, description: "Task deadline" },
  { key: "assigned", label: "Assigned", defaultOn: true, description: "Staff member assigned" },
  { key: "status", label: "Status", defaultOn: true, description: "Current task status" },
  { key: "recurring", label: "Recurring", defaultOn: false, description: "Whether task repeats" },
  { key: "createdAt", label: "Created Date", defaultOn: false, description: "When task was created" },
  { key: "updatedAt", label: "Last Modified", defaultOn: false, description: "When task was last updated" },
];

const ALL_STATUSES = ["Not Yet Started", "WIP", "Submitted to FTA", "Completed"];
const BASE_STATUSES = ["Not Yet Started", "WIP", "Completed"]; // for non-FTA tasks
// "Active" = all non-completed/non-approved; surfaced in scope logic
const FILTER_STATUSES = ["Not Yet Started", "WIP", "Submitted to FTA", "Completed", "All"];
const SCOPE_OPTIONS = ["By Month", "Overdue", "All"];
// Column count updated: +2 for Created Date and Last Modified
const TASK_TABLE_COLUMNS = 10;
const PAGE_SIZE = 20;
const LOOKUP_PAGE_SIZE = 100;

const CATEGORY_LABELS = {
  CT: "Corporate Tax",
  MIS: "MIS Reporting",
  EInv: "E-Invoicing",
  Refund: "VAT Refund",
};
const CATEGORY_VALUES_BY_LABEL = Object.fromEntries(
  Object.entries(CATEGORY_LABELS).map(([value, label]) => [label.toLowerCase(), value])
);
const OPTION_ACRONYMS = new Map([
  ["ct", "CT"],
  ["einv", "EInv"],
  ["esr", "ESR"],
  ["fta", "FTA"],
  ["mis", "MIS"],
  ["trn", "TRN"],
  ["ubo", "UBO"],
  ["vat", "VAT"],
]);

const STATUS_PILL = {
  "Not Yet Started": { bg: "bg-slate-100", text: "text-slate-600" },
  WIP: { bg: "bg-blue-50", text: "text-blue-700" },
  Completed: { bg: "bg-green-100", text: "text-green-700" },
  "Submitted to FTA": { bg: "bg-purple-50", text: "text-purple-700" },
};

function createEmptyColumnFilters() {
  return {
    taskId: "",
    client: "",
    category: "",
    type: "",
    dueDate: "",
    assigned: "",
    status: [],
    remarks: "",
    recurring: "",
    scope: "",
    createdAt: "",
    updatedAt: "",
  };
}

function normalizeStatusFilterValue(value) {
  if (!value) return [];
  const raw = String(value).trim();
  if (!raw) return [];
  if (raw.toLowerCase() === "active") {
    return ["Not Yet Started", "WIP", "Submitted to FTA"];
  }
  const found = FILTER_STATUSES.find((s) => s.toLowerCase() === raw.toLowerCase());
  return found ? [found] : [];
}

function normalizeCategoryFilterValue(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  return CATEGORY_VALUES_BY_LABEL[raw.toLowerCase()] || raw;
}

function createInitialColumnFilters(searchParams) {
  return {
    ...createEmptyColumnFilters(),
    category: normalizeCategoryFilterValue(searchParams.get("category")),
    status: normalizeStatusFilterValue(searchParams.get("status")),
  };
}

function getCurrentMonthValue() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function formatOptionLabel(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .split(" ")
    .map((word) => {
      const acronym = OPTION_ACRONYMS.get(word.toLocaleLowerCase());
      if (acronym) return acronym;
      if (/^[A-Z0-9&/-]{2,}$/.test(word)) return word;
      return `${word.charAt(0).toUpperCase()}${word.slice(1).toLowerCase()}`;
    })
    .join(" ");
}

function normalizeOptionKey(value) {
  return formatOptionLabel(value).toLocaleLowerCase();
}

function buildNormalizedOptions(values) {
  const options = new Map();
  values.forEach((value) => {
    const rawValue = String(value || "").trim().replace(/\s+/g, " ");
    const label = formatOptionLabel(rawValue);
    if (!label) return;
    const key = normalizeOptionKey(label);
    if (!options.has(key)) options.set(key, { value: rawValue, label });
  });
  return [...options.values()].sort((left, right) => compareOptionsWithOtherLast(left, right, (option) => option.label));
}

function displayCategoryName(category) {
  return CATEGORY_LABELS[category] || category || "";
}


function buildActiveColumnFilterSummary(filters) {
  return [
    filters.taskId ? `Task ID: ${filters.taskId}` : null,
    filters.client ? `Client: ${filters.client}` : null,
    filters.category ? `Category: ${displayCategoryName(filters.category)}` : null,
    filters.type ? `Task Type: ${filters.type}` : null,
    filters.dueDate ? `Due Date: ${filters.dueDate}` : null,
    filters.assigned ? `Assigned: ${filters.assigned}` : null,
    filters.status?.length ? `Status: ${filters.status.join(", ")}` : null,
    filters.remarks ? `Remark: ${filters.remarks}` : null,
    filters.recurring ? `Recurring: ${filters.recurring === "recurring" ? "Recurring" : "One-time"}` : null,
    filters.scope ? `Scope: ${filters.scope}` : null,
    filters.createdAt ? `Created: ${filters.createdAt}` : null,
    filters.updatedAt ? `Modified: ${filters.updatedAt}` : null,
  ].filter(Boolean);
}

function formatDateTime(dateStr) {
  if (!dateStr) return { date: "—", time: null };
  try {
    const d = new Date(dateStr);
    const date = d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
    const time = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: true });
    return { date, time };
  } catch {
    return { date: dateStr, time: null };
  }
}

function StatusPill({ status }) {
  const { bg, text } = STATUS_PILL[status] || { bg: "bg-slate-100", text: "text-slate-500" };
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-extrabold ${bg} ${text}`}>
      {status}
    </span>
  );
}

const SELECTABLE_STATUSES = FILTER_STATUSES.filter((s) => s !== "All");

function StatusMultiSelect({ selected, onChange, open, setOpen, dropdownRef }) {
  // Close on outside click
  useEffect(() => {
    function handleOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [dropdownRef, setOpen]);

  function toggle(status) {
    const next = selected.includes(status)
      ? selected.filter((s) => s !== status)
      : [...selected, status];
    onChange(next);
  }

  const label = selected.length === 0
    ? "All statuses"
    : selected.length === 1
      ? selected[0]
      : `${selected.length} statuses`;

  return (
    <div ref={dropdownRef} className="relative">
      <button
        id="task-filter-status"
        type="button"
        className="input flex items-center justify-between gap-2 text-left"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className={selected.length === 0 ? "text-slate-400" : "text-slate-800 font-semibold"}>
          {label}
        </span>
        <ChevronDown size={13} className={`text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <ul
          role="listbox"
          aria-multiselectable="true"
          className="absolute top-full left-0 z-50 mt-1 w-48 overflow-hidden rounded-xl border border-[#e2e8f0] bg-white shadow-lg"
        >
          {SELECTABLE_STATUSES.map((status) => {
            const checked = selected.includes(status);
            const { bg, text } = STATUS_PILL[status] || { bg: "bg-slate-100", text: "text-slate-600" };
            return (
              <li
                key={status}
                role="option"
                aria-selected={checked}
                onMouseDown={(e) => { e.preventDefault(); toggle(status); }}
                className={`flex cursor-pointer items-center gap-2.5 px-3 py-2.5 text-[12px] font-semibold transition-colors hover:bg-slate-50 ${
                  checked ? "bg-blue-50/60" : ""
                }`}
              >
                <span
                  className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border-2 transition-colors ${
                    checked
                      ? "border-[#1e3a8a] bg-[#1e3a8a]"
                      : "border-slate-300 bg-white"
                  }`}
                >
                  {checked && (
                    <svg viewBox="0 0 10 8" fill="none" width="8" height="8">
                      <path d="M1 4l3 3 5-6" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </span>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-extrabold ${bg} ${text}`}>{status}</span>
              </li>
            );
          })}
          {selected.length > 0 && (
            <li
              onMouseDown={(e) => { e.preventDefault(); onChange([]); }}
              className="flex cursor-pointer items-center gap-2 border-t border-slate-100 px-3 py-2 text-[12px] font-semibold text-slate-400 transition-colors hover:text-[#dc2626]"
            >
              <X size={12} /> Clear selection
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

export default function TaskList() {
  const { state, dispatch } = useApp();
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { fetchTasks, updateStatus, updateAssignee, exportTasks } = useTasks();
  const initialMonth = searchParams.get("month") || getCurrentMonthValue();

  // Scope & month still live as top-level state (drive server query) but are now
  // controlled from the column filter row rather than the old chip section.
  const [scope, setScope] = useState(searchParams.get("scope") || "By Month");
  const [month, setMonth] = useState(initialMonth);
  const [drawerTaskId, setDrawerTaskId] = useState(searchParams.get("drawer") || null);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

  const BASE_EXPORT_FIELDS = COLUMN_DEFS.map((c) => ({ key: c.key, label: c.label }));

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ total: 0, page: 1, pages: 1 });
  const [columnFilters, setColumnFilters] = useState(() => createInitialColumnFilters(searchParams));
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
  const statusDropdownRef = useRef(null);
  const [colVisibility, setColVisibility] = useState(() => {
    // Restore from localStorage so column choices persist across refreshes
    // and navigation. Fall back to COLUMN_DEFS defaults if nothing is saved.
    try {
      const saved = localStorage.getItem("task_list_columns");
      if (saved) {
        const parsed = JSON.parse(saved);
        // Merge with defaults so any newly-added columns still get their defaultOn value
        const init = {};
        COLUMN_DEFS.forEach((c) => { init[c.key] = c.key in parsed ? parsed[c.key] : c.defaultOn; });
        return init;
      }
    } catch { /* ignore parse errors */ }
    const init = {};
    COLUMN_DEFS.forEach((c) => { init[c.key] = c.defaultOn; });
    return init;
  });

  // Persist column visibility to localStorage whenever it changes
  useEffect(() => {
    try { localStorage.setItem("task_list_columns", JSON.stringify(colVisibility)); } catch { /* ignore quota errors */ }
  }, [colVisibility]);

  const visibleColumns = useMemo(
    () => COLUMN_DEFS.filter((c) => colVisibility[c.key] !== false),
    [colVisibility]
  );
  const isVisible = useCallback((key) => colVisibility[key] !== false, [colVisibility]);
  const tableColSpan = visibleColumns.length;

  const updateColVisibility = useCallback((key, value) => {
    setColVisibility((prev) => ({ ...prev, [key]: value }));
  }, []);

  const deferredColumnFilters = useDeferredValue(columnFilters);

  const canManage = canManageTasks(currentUser?.role);
  const isTaskOnly = currentUser?.role === "task_only";
  const { fetchUsers } = useUsers();
  const { fetchClients } = useClients();
  const tasksLoading = Boolean(state.loading.tasks);
  const taskError = state.errors.tasks;

  const hasFetchedClients = useRef(false);

  useEffect(() => {
    if (canManage) {
      fetchUsers().catch(() => {});
    }
  }, [canManage]);

  useEffect(() => {
    if (!hasFetchedClients.current) {
      hasFetchedClients.current = true;
      fetchClients({ limit: 10 }).catch(() => {});
    }
  }, [fetchClients]);

  useEffect(() => {
    categoryService.list()
      .then((data) => dispatch({ type: "SET_RESOURCE", resource: "categories", payload: data.map(mapCategory) }))
      .catch(() => {});
  }, [dispatch]);

  const serverFilters = useMemo(() => ({
    category: deferredColumnFilters.category || undefined,
    status: deferredColumnFilters.status?.length > 0 ? deferredColumnFilters.status.join(",") : undefined,
    month: scope === "By Month" ? month : undefined,
    overdue: scope === "Overdue" ? "true" : undefined,
    taskId: deferredColumnFilters.taskId || undefined,
    client: deferredColumnFilters.client || undefined,
    type: deferredColumnFilters.type || undefined,
    dueDate: deferredColumnFilters.dueDate || undefined,
    assigned: deferredColumnFilters.assigned || undefined,
    remarks: deferredColumnFilters.remarks || undefined,
    recurring: deferredColumnFilters.recurring || undefined,
    createdAt: deferredColumnFilters.createdAt || undefined,
    updatedAt: deferredColumnFilters.updatedAt || undefined,
  }), [deferredColumnFilters, month, scope]);

  const requestParams = useMemo(() => ({ ...serverFilters, page, limit: PAGE_SIZE }), [page, serverFilters]);
  const filterRef = useRef(requestParams);
  filterRef.current = requestParams;

  const refetchTasks = useCallback(async () => {
    const data = await fetchTasks(filterRef.current);
    setMeta({
      total: data?.total || 0,
      page: data?.page || 1,
      pages: data?.pages || 1,
    });
    return data;
  }, [fetchTasks]);

  useEffect(() => {
    refetchTasks().catch(() => {});
  }, [refetchTasks, requestParams]);

  const categoryOptions = useMemo(
    () => buildNormalizedOptions(state.categories.map((category) => category.name)),
    [state.categories],
  );
  const typeOptions = useMemo(
    () => {
      const selectedCategory = state.categories.find((category) => category.name === columnFilters.category);
      const sourceCategories = selectedCategory ? [selectedCategory] : state.categories;
      return buildNormalizedOptions(sourceCategories.flatMap((category) => category.taskTypes || []));
    },
    [columnFilters.category, state.categories],
  );

  const assigneeOptions = useMemo(
    () => buildNormalizedOptions(state.users.map((user) => user.name)),
    [state.users],
  );
  const clientSuggestions = useMemo(
    () => buildNormalizedOptions(state.clients.map((client) => client.name || client.legalName)),
    [state.clients],
  );
  const rows = state.tasks;

  const completedCount = rows.filter((task) => task.status === "Completed").length;
  const workingCount = rows.length - completedCount;
  const activeCount = rows.filter((task) => task.status === "Not Yet Started" || task.status === "WIP").length;
  const activeColumnFilters = buildActiveColumnFilterSummary(columnFilters);
  const hasColumnFilters = activeColumnFilters.length > 0;
  const hasActiveFilters = hasColumnFilters || scope !== "By Month" || month !== initialMonth;

  const updateColumnFilter = (key, value) => {
    setPage(1);
    setColumnFilters((current) => ({
      ...current,
      [key]: value,
      ...(key === "category" ? { type: "" } : {}),
    }));
  };

  // Scope is managed via the column-filter row Scope dropdown
  const updateScope = (value) => {
    setPage(1);
    setScope(value);
  };

  const clearColumnFilters = () => {
    setPage(1);
    setColumnFilters(createEmptyColumnFilters());
  };

  const resetAllFilters = () => {
    setPage(1);
    setScope("By Month");
    setMonth(initialMonth);
    setColumnFilters(createEmptyColumnFilters());
  };

  const exportVisible = async () => {
    const serverCols = Object.keys(colVisibility).filter((k) => colVisibility[k]);
    const params = { ...serverFilters, columns: serverCols.join(",") || undefined };
    setIsExportModalOpen(false);
    downloadBlob(await exportTasks(params), "tasks.xlsx");
  };

  const exportAll = async () => {
    const params = { ...serverFilters, mode: "all" };
    setIsExportModalOpen(false);
    downloadBlob(await exportTasks(params), "tasks_full_export.xlsx");
  };

  const exportSelected = async (selectedKeys) => {
    const cols = selectedKeys.join(",");
    const params = { ...serverFilters, columns: cols || undefined };
    setIsExportModalOpen(false);
    downloadBlob(await exportTasks(params), "tasks_selected.xlsx");
  };

  const renderTaskRow = (task) => {
    const canEditTask =
      canManage ||
      (isTaskOnly && String(task.assignedId) === String(currentUser?._id || currentUser?.id));
    const canChangeStatus = canEditTask;
    const isStatusLocked = task.ftaStatus === "approved" || task.status === "Completed";

    return (
      <tr key={task.id}>
        {isVisible("taskId") && (
          <td className="font-extrabold text-[#1e3a8a]">
            <button
              className="task-id-link"
              onClick={() => (canManage ? setDrawerTaskId(task.id) : navigate(`/tasks/${task.id}`))}
              title={canManage ? "Open task details" : "View task details"}
            >
              {task.taskId}
            </button>
          </td>
        )}
        {isVisible("client") && <td>{task.client}</td>}
        {isVisible("category") && (
          <td>
            <Badge>{task.category}</Badge>
          </td>
        )}
        {isVisible("type") && <td>{task.type}</td>}
        {isVisible("dueDate") && (
          <td>
            <div>{task.dueDate}</div>
            {task.overdueDays > 0 && (
              <span className="mt-1 inline-flex rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-extrabold text-[#dc2626]">
                {task.overdueDays}d overdue
              </span>
            )}
          </td>
        )}
        {isVisible("assigned") && (
          <td>
            {canManage ? (
              <select
                id={`task-assignee-${task.id}`}
                className="input h-8 min-w-36"
                value={task.assignedId || ""}
                onChange={(event) => {
                  const selected = state.users.find((user) => user._id === event.target.value || user.id === event.target.value);
                  updateAssignee(task.id, event.target.value || null, selected?.name || "Unassigned")
                    .then(() => refetchTasks())
                    .catch(() => refetchTasks());
                }}
              >
                <option value="">Unassigned</option>
                {state.users.map((user) => (
                  <option key={user._id || user.id} value={user._id || user.id}>
                    {user.name}
                  </option>
                ))}
              </select>
            ) : (
              <span>{task.assigned}</span>
            )}
          </td>
        )}
        {isVisible("status") && (
          <td>
            {canChangeStatus && !isStatusLocked ? (
              <select
                id={`task-status-${task.id}`}
                name={`taskStatus${task.id}`}
                className="input h-8 min-w-40"
                value={task.displayStatus ?? task.status}
                onChange={(event) =>
                  updateStatus(task.id, event.target.value)
                    .then(() => refetchTasks())
                    .catch(() => refetchTasks())
                }
              >
                {ALL_STATUSES.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            ) : (
              <StatusPill status={task.status} />
            )}
          </td>
        )}
        {isVisible("recurring") && (
          <td>
            {task.recurring ? (
              <span className="rounded-full bg-blue-50 px-2 py-1 text-[11px] font-extrabold text-[#1e3a8a]">
                Recurring
              </span>
            ) : (
              <span className="text-[12px] font-semibold text-slate-500">One-time</span>
            )}
          </td>
        )}
        {isVisible("createdAt") && (
          <td>
            {(() => { const { date, time } = formatDateTime(task.createdAt); return (
              <span className="flex flex-col gap-0.5">
                <span className="text-[12px] font-medium text-slate-700">{date}</span>
                {time && <span className="text-[10px] font-medium text-slate-400">{time}</span>}
              </span>
            ); })()}
          </td>
        )}
        {isVisible("updatedAt") && (
          <td>
            {(() => { const { date, time } = formatDateTime(task.updatedAt); return (
              <span className="flex flex-col gap-0.5">
                <span className="text-[12px] font-medium text-slate-700">{date}</span>
                {time && <span className="text-[10px] font-medium text-slate-400">{time}</span>}
              </span>
            ); })()}
          </td>
        )}
      </tr>
    );
  };

  return (
    <div className="space-y-5">

      {/* ── Filter card ── */}
      <Card>
        {/* Toolbar header: stats + Month + actions */}
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-5 py-3.5">
          {/* Stats pills */}
          <div className="flex flex-wrap items-center gap-2">
            <InfoPill tone="navy" label={`${workingCount} working`} />
            <InfoPill tone="orange" label={`${activeCount} active tasks`} />
            <InfoPill tone="green" label={`${completedCount} completed`} />
            <InfoPill tone="slate" label={`${meta.total} matches`} />
            {tasksLoading && <InfoPill tone="amber" label="Refreshing…" />}
            {hasColumnFilters && (
              <InfoPill tone="blue" label={`${activeColumnFilters.length} filter${activeColumnFilters.length > 1 ? "s" : ""} active`} />
            )}
          </div>

          {/* Month selector + action buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor="task-list-month" className={`flex items-center gap-1.5 ${scope !== "By Month" ? "opacity-50" : ""}`}>
              <span className="text-[11px] font-extrabold uppercase tracking-wide text-slate-500">Month</span>
              <input
                id="task-list-month"
                name="taskListMonth"
                className="input h-8 w-[130px] text-[13px]"
                type="month"
                value={month}
                disabled={scope !== "By Month"}
                onChange={(event) => {
                  setPage(1);
                  setMonth(event.target.value);
                }}
              />
            </label>

            <ColumnCustomizer visibility={colVisibility} onChange={updateColVisibility} />

            <button
              className="grid h-8 w-8 place-items-center rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 transition hover:bg-emerald-100 hover:text-emerald-800 disabled:opacity-40"
              onClick={refetchTasks}
              disabled={tasksLoading}
              aria-label="Refresh task list"
              title="Refresh"
            >
              <RefreshCw size={14} className={tasksLoading ? "animate-spin" : ""} />
            </button>

            {canManage && (
              <button
                className="grid h-8 w-8 place-items-center rounded-lg border border-purple-200 bg-purple-50 text-purple-700 transition hover:bg-purple-100 hover:text-purple-800"
                onClick={() => setIsExportModalOpen(true)}
                aria-label="Export tasks to Excel"
                title="Export Excel"
              >
                <Download size={14} />
              </button>
            )}

            {hasColumnFilters && (
              <Button variant="ghost" size="sm" onClick={clearColumnFilters}>
                <X size={14} />
                Clear
              </Button>
            )}
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={resetAllFilters}>
                Reset all
              </Button>
            )}
          </div>
        </div>

        {/* ── Column filters accordion ── */}
        <div>
          {/* Accordion toggle */}
          <button
            type="button"
            id="filter-accordion-toggle"
            aria-expanded={filtersOpen}
            aria-controls="filter-accordion-body"
            onClick={() => setFiltersOpen((prev) => !prev)}
            className={[
              "group flex w-full items-center justify-between gap-3 border-y px-5 py-2.5 text-left transition-all duration-150",
              hasColumnFilters
                ? "border-blue-100 bg-blue-50/60 hover:bg-blue-50"
                : "border-slate-100 bg-slate-50/80 hover:bg-slate-100/80",
            ].join(" ")}
          >
            {/* Left: icon + label + active badge */}
            <span className="flex items-center gap-2">
              <span
                className={[
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-md transition-colors duration-150",
                  hasColumnFilters
                    ? "bg-[#1e3a8a] text-white shadow-sm shadow-blue-200"
                    : "bg-white text-slate-400 ring-1 ring-slate-200 group-hover:text-slate-600",
                ].join(" ")}
              >
                <SlidersHorizontal size={12} />
              </span>
              <span
                className={[
                  "text-[11px] font-extrabold uppercase tracking-widest",
                  hasColumnFilters ? "text-[#1e3a8a]" : "text-slate-500",
                ].join(" ")}
              >
                Filter Options
              </span>
              {hasColumnFilters && (
                <span className="inline-flex items-center gap-1 rounded-full bg-[#1e3a8a] px-2 py-0.5 text-[10px] font-extrabold text-white">
                  {activeColumnFilters.length} active
                </span>
              )}
            </span>

            {/* Right: show/hide hint + chevron */}
            <span className="flex items-center gap-1.5">
              <span className={`text-[10px] font-semibold transition-colors duration-150 ${
                hasColumnFilters ? "text-blue-400" : "text-slate-300 group-hover:text-slate-400"
              }`}>
                {filtersOpen ? "Hide" : "Show"}
              </span>
              <ChevronDown
                size={14}
                className={[
                  "transition-all duration-200",
                  filtersOpen ? "rotate-180" : "",
                  hasColumnFilters ? "text-[#1e3a8a]" : "text-slate-400",
                ].join(" ")}
              />
            </span>
          </button>

          {/* Accordion body */}
          <div
            id="filter-accordion-body"
            role="region"
            aria-labelledby="filter-accordion-toggle"
            style={{
              display: "grid",
              gridTemplateRows: filtersOpen ? "1fr" : "0fr",
              transition: "grid-template-rows 0.25s ease",
              overflow: filtersOpen ? "visible" : "hidden",
              position: "relative",
              zIndex: 20,
            }}
          >
            <div style={{ overflow: filtersOpen ? "visible" : "hidden" }}>
              <div className="px-5 py-4">
                <div className="task-list-column-grid">
            {/* Task ID */}
            <FilterField label="Task ID" htmlFor="task-filter-id">
              <div className="task-list-input-wrap">
                <Search size={14} className="task-list-input-icon" aria-hidden="true" />
                <input
                  id="task-filter-id"
                  className="input"
                  type="search"
                  placeholder="Search ID"
                  value={columnFilters.taskId}
                  onChange={(event) => updateColumnFilter("taskId", event.target.value)}
                />
              </div>
            </FilterField>

            {/* Client */}
            <FilterField label="Client" htmlFor="task-filter-client">
              <ClientComboBox
                clients={state.clients}
                value={columnFilters.client}
                onChange={(val) => updateColumnFilter("client", val)}
                useNameAsValue={true}
                inputId="task-filter-client"
                placeholder="Search client"
              />
            </FilterField>

            {/* Category */}
            <FilterField label="Category" htmlFor="task-filter-category">
              <select
                id="task-filter-category"
                className="input"
                value={columnFilters.category}
                onChange={(event) => updateColumnFilter("category", event.target.value)}
              >
                <option value="">All categories</option>
                {categoryOptions.map((option) => (
                  <option key={option.value} value={option.value}>{displayCategoryName(option.value)}</option>
                ))}
              </select>
            </FilterField>

            {/* Task Type */}
            <FilterField label="Task Type" htmlFor="task-filter-type">
              <select
                id="task-filter-type"
                className="input"
                value={columnFilters.type}
                onChange={(event) => updateColumnFilter("type", event.target.value)}
              >
                <option value="">All task types</option>
                {typeOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </FilterField>

            {/* Due Date */}
            <FilterField label="Due Date" htmlFor="task-filter-due-date">
              <input
                id="task-filter-due-date"
                className="input"
                type="date"
                value={columnFilters.dueDate}
                onChange={(event) => updateColumnFilter("dueDate", event.target.value)}
              />
            </FilterField>

            {/* Assigned */}
            <FilterField label="Assigned" htmlFor="task-filter-assigned">
              <select
                id="task-filter-assigned"
                className="input"
                value={columnFilters.assigned}
                onChange={(event) => updateColumnFilter("assigned", event.target.value)}
              >
                <option value="">All assignees</option>
                {assigneeOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </FilterField>

            {/* Status — multi-select checkbox dropdown */}
            <FilterField label="Status" htmlFor="task-filter-status">
              <StatusMultiSelect
                selected={columnFilters.status}
                onChange={(val) => updateColumnFilter("status", val)}
                open={statusDropdownOpen}
                setOpen={setStatusDropdownOpen}
                dropdownRef={statusDropdownRef}
              />
            </FilterField>

            {/* Remark */}
            <FilterField label="Remark" htmlFor="task-filter-remarks">
              <div className="task-list-input-wrap">
                <Search size={14} className="task-list-input-icon" aria-hidden="true" />
                <input
                  id="task-filter-remarks"
                  className="input"
                  type="search"
                  placeholder="Search remarks"
                  value={columnFilters.remarks}
                  onChange={(event) => updateColumnFilter("remarks", event.target.value)}
                />
              </div>
            </FilterField>

            {/* Recurring */}
            <FilterField label="Recurring" htmlFor="task-filter-recurring">
              <select
                id="task-filter-recurring"
                className="input"
                value={columnFilters.recurring}
                onChange={(event) => updateColumnFilter("recurring", event.target.value)}
              >
                <option value="">All tasks</option>
                <option value="recurring">Recurring</option>
                <option value="one-time">One-time</option>
              </select>
            </FilterField>

            {/* Scope — replaces the removed chip row */}
            <FilterField label="Scope" htmlFor="task-filter-scope">
              <select
                id="task-filter-scope"
                className="input"
                value={scope}
                onChange={(event) => updateScope(event.target.value)}
              >
                {SCOPE_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </FilterField>

            {/* Created Date filter */}
            <FilterField label="Created Date" htmlFor="task-filter-created">
              <input
                id="task-filter-created"
                className="input"
                type="date"
                value={columnFilters.createdAt}
                onChange={(event) => updateColumnFilter("createdAt", event.target.value)}
              />
            </FilterField>

            {/* Last Modified filter */}
            <FilterField label="Last Modified" htmlFor="task-filter-updated">
              <input
                id="task-filter-updated"
                className="input"
                type="date"
                value={columnFilters.updatedAt}
                onChange={(event) => updateColumnFilter("updatedAt", event.target.value)}
              />
            </FilterField>
          </div>

                {/* Active filter tags */}
                {hasColumnFilters && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {activeColumnFilters.map((item) => (
                      <span key={item} className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-[11px] font-bold text-blue-700 ring-1 ring-blue-100">
                        {item}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </Card>

      {isTaskOnly && (
        <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-2.5 text-[12px] font-medium text-blue-700">
          You can update status and remarks only for tasks assigned to you.
        </div>
      )}

      <TaskSection
        title="Task List"
        subtitle={
          tasksLoading
            ? "Task list is updating with your latest filters."
            : hasActiveFilters
              ? `Showing ${rows.length} of ${meta.total} matching tasks.`
              : "Latest activity is shown first so the most recently touched work stays at the top."
        }
        accentClassName="task-list-section-title"
      >
        <TaskTableState
          tasks={rows}
          tasksLoading={tasksLoading}
          taskError={taskError}
          hasActiveFilters={hasActiveFilters}
          emptyTitle="No tasks match the current view"
          emptyDescription="Adjust a filter or create a new task to start filling this list."
          onReset={resetAllFilters}
          onRetry={refetchTasks}
          isVisible={isVisible}
          tableColSpan={tableColSpan}
        >
          {rows.map(renderTaskRow)}
        </TaskTableState>
        {meta.pages > 1 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-3 sm:px-5">
            <div className="text-[12px] font-semibold text-slate-500">
              Showing {Math.max(1, (meta.page - 1) * PAGE_SIZE + 1)} to {Math.min(meta.page * PAGE_SIZE, meta.total)} of {meta.total} tasks
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
      </TaskSection>

      {canManage && drawerTaskId && (
        <TaskDrawer 
          taskId={drawerTaskId} 
          canManage={canManage} 
          onClose={() => {
            setDrawerTaskId(null);
            if (searchParams.has("drawer")) {
              searchParams.delete("drawer");
              setSearchParams(searchParams, { replace: true });
            }
          }} 
        />
      )}

      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        title="Export Tasks"
        entityName="tasks"
        baseFields={BASE_EXPORT_FIELDS}
        onExportVisible={exportVisible}
        onExportAll={exportAll}
        onExportSelected={exportSelected}
      />
    </div>
  );
}

function TaskSection({ title, subtitle, accentClassName, children }) {
  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 sm:px-5">
        <div>
          <div className={`text-[14px] font-extrabold ${accentClassName}`}>{title}</div>
          <div className="mt-1 text-[12px] font-medium text-slate-500">{subtitle}</div>
        </div>
        <div className="text-[12px] font-semibold text-slate-500">Click a task ID to open details</div>
      </div>
      {children}
    </Card>
  );
}

function TaskTableState({ tasks, tasksLoading, taskError, hasActiveFilters, emptyTitle, emptyDescription, onReset, onRetry, isVisible, tableColSpan, children }) {
  return (
    <Table className="task-list-table">
      <thead>
        <tr>
          {isVisible("taskId") && <th>Task ID</th>}
          {isVisible("client") && <th>Client</th>}
          {isVisible("category") && <th>Category</th>}
          {isVisible("type") && <th>Task Type</th>}
          {isVisible("dueDate") && <th>Due Date</th>}
          {isVisible("assigned") && <th>Assigned</th>}
          {isVisible("status") && <th>Status</th>}
          {isVisible("recurring") && <th>Recurring</th>}
          {isVisible("createdAt") && <th>Created Date</th>}
          {isVisible("updatedAt") && <th>Last Modified</th>}
        </tr>
      </thead>
      <tbody>
        {tasksLoading && !tasks.length && <LoadingRows columns={tableColSpan} />}

        {!tasksLoading && taskError && (
          <tr>
            <td colSpan={tableColSpan} className="px-4 py-10">
              <div className="rounded-2xl border border-red-100 bg-red-50 px-5 py-5 text-center">
                <div className="text-[14px] font-extrabold text-red-700">Unable to load tasks</div>
                <div className="mt-1 text-[12px] font-medium text-red-600">{taskError}</div>
                <div className="mt-4">
                  <Button variant="ghost" size="sm" onClick={onRetry}>
                    <RefreshCw size={15} />
                    Try again
                  </Button>
                </div>
              </div>
            </td>
          </tr>
        )}

        {!tasksLoading && !taskError && !tasks.length && (
          <tr>
            <td colSpan={tableColSpan} className="px-4 py-10">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-6 text-center">
                <div className="text-[14px] font-extrabold text-slate-900">{emptyTitle}</div>
                <div className="mt-1 text-[12px] font-medium text-slate-500">{emptyDescription}</div>
                {hasActiveFilters && (
                  <div className="mt-4">
                    <Button variant="ghost" size="sm" onClick={onReset}>
                      Reset all filters
                    </Button>
                  </div>
                )}
              </div>
            </td>
          </tr>
        )}

        {!taskError && children}
      </tbody>
    </Table>
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

function InfoPill({ tone, label }) {
  const tones = {
    navy: "bg-[#dbe7ff] text-[#1e3a8a]",
    slate: "bg-slate-100 text-slate-600",
    amber: "bg-amber-100 text-amber-700",
    orange: "bg-orange-100 text-orange-700",
    blue: "bg-blue-50 text-blue-700",
    green: "bg-emerald-50 text-emerald-700",
  };
  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-[11px] font-extrabold ${tones[tone] || tones.slate}`}>
      {label}
    </span>
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
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-haspopup="true"
        id="col-customizer-btn"
        className="inline-flex h-8 items-center justify-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 text-[13px] font-bold text-blue-700 transition hover:bg-blue-100 hover:text-blue-800"
      >
        <Columns size={15} />
        Columns
        {visibleCount < COLUMN_DEFS.length && (
          <span className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-[#1e3a8a] text-[9px] font-extrabold text-white">
            {visibleCount}
          </span>
        )}
      </button>

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
              Toggle columns shown in the table.
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
                COLUMN_DEFS.forEach((c) => onChange(c.key, true));
              }}
            >
              Show all
            </button>
            <button
              type="button"
              className="text-[11px] font-bold text-slate-500 hover:underline"
              onClick={() => {
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
