import { Columns, Download, RefreshCw, Search, X } from "lucide-react";
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useApp } from "../../context/AppContext.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { useUsers } from "../../hooks/useUsers.js";
import { useTasks } from "../../hooks/useTasks.js";
import { useClients } from "../../hooks/useClients.js";
import { downloadBlob } from "../../utils/adapterUtils";
import { canManageTasks } from "../../utils/permissions.js";
import Badge from "../ui/Badge.jsx";
import Button from "../ui/Button.jsx";
import Card from "../ui/Card.jsx";
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
// "Active" = all non-completed/non-approved; surfaced in both column filter and scope logic
const FILTER_STATUSES = ["Not Yet Started", "WIP", "Submitted to FTA", "Completed", "Active", "All"];
const SCOPE_OPTIONS = ["By Month", "Overdue", "All"];
// Column count updated: +2 for Created Date and Last Modified
const TASK_TABLE_COLUMNS = 10;
const PAGE_SIZE = 20;

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
    status: "",
    remarks: "",
    recurring: "",
    scope: "",
    createdAt: "",
    updatedAt: "",
  };
}

function getCurrentMonthValue() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function sortStrings(values) {
  return [...new Set(values.filter(Boolean))].sort((left, right) => String(left).localeCompare(String(right)));
}

function buildActiveColumnFilterSummary(filters) {
  return [
    filters.taskId ? `Task ID: ${filters.taskId}` : null,
    filters.client ? `Client: ${filters.client}` : null,
    filters.category ? `Category: ${filters.category}` : null,
    filters.type ? `Task Type: ${filters.type}` : null,
    filters.dueDate ? `Due Date: ${filters.dueDate}` : null,
    filters.assigned ? `Assigned: ${filters.assigned}` : null,
    filters.status ? `Status: ${filters.status}` : null,
    filters.remarks ? `Remark: ${filters.remarks}` : null,
    filters.recurring ? `Recurring: ${filters.recurring === "recurring" ? "Recurring" : "One-time"}` : null,
    filters.scope ? `Scope: ${filters.scope}` : null,
    filters.createdAt ? `Created: ${filters.createdAt}` : null,
    filters.updatedAt ? `Modified: ${filters.updatedAt}` : null,
  ].filter(Boolean);
}

function formatDate(dateStr) {
  if (!dateStr) return "—";
  try {
    return new Date(dateStr).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return dateStr;
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

export default function TaskList() {
  const { state } = useApp();
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { fetchTasks, updateStatus, updateAssignee, exportTasks } = useTasks();
  const initialMonth = searchParams.get("month") || getCurrentMonthValue();

  // Scope & month still live as top-level state (drive server query) but are now
  // controlled from the column filter row rather than the old chip section.
  const [scope, setScope] = useState(searchParams.get("scope") || "By Month");
  const [month, setMonth] = useState(initialMonth);
  const [drawerTaskId, setDrawerTaskId] = useState(null);
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ total: 0, page: 1, pages: 1 });
  const [columnFilters, setColumnFilters] = useState(() => createEmptyColumnFilters());
  const [colVisibility, setColVisibility] = useState(() => {
    const init = {};
    COLUMN_DEFS.forEach((c) => { init[c.key] = c.defaultOn; });
    return init;
  });

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

  useEffect(() => {
    if (canManage) {
      fetchUsers().catch(() => {});
      fetchClients({ limit: 1000 }).catch(() => {});
    }
  }, [canManage]);

  const serverFilters = useMemo(() => ({
    category: deferredColumnFilters.category || undefined,
    status: deferredColumnFilters.status || undefined,
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

  // Map filter dropdown options from global data where available, fallback to currently visible tasks
  const categoryOptions = sortStrings(state.categories?.length ? state.categories.map((c) => c.name) : state.tasks.map((task) => task.category));
  const typeOptions = sortStrings(state.categories?.length ? state.categories.flatMap((c) => c.taskTypes) : state.tasks.map((task) => task.type));
  const assigneeOptions = sortStrings(state.users?.length ? state.users.map((u) => u.name) : state.tasks.map((task) => task.assigned));
  const clientSuggestions = sortStrings(state.clients?.length ? state.clients.map((c) => c.name) : state.tasks.map((task) => task.client));
  const rows = state.tasks;

  const completedCount = rows.filter((task) => task.status === "Completed").length;
  const workingCount = rows.length - completedCount;
  const activeCount = rows.filter((task) => task.status === "Not Yet Started" || task.status === "WIP").length;
  const activeColumnFilters = buildActiveColumnFilterSummary(columnFilters);
  const hasColumnFilters = activeColumnFilters.length > 0;
  const hasActiveFilters = hasColumnFilters || scope !== "By Month" || month !== initialMonth;

  const updateColumnFilter = (key, value) => {
    setPage(1);
    setColumnFilters((current) => ({ ...current, [key]: value }));
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

  const exportCsv = async () =>
    downloadBlob(await exportTasks(serverFilters), "tasks.csv");

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
            <span className="text-[12px] text-slate-600">{formatDate(task.createdAt)}</span>
          </td>
        )}
        {isVisible("updatedAt") && (
          <td>
            <span className="text-[12px] text-slate-600">{formatDate(task.updatedAt)}</span>
          </td>
        )}
      </tr>
    );
  };

  return (
    <div className="space-y-5">
      {/* ── Page header ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="page-kicker">Task Control</div>
          <h2 className="screen-title">Task List</h2>
        </div>
        {canManage && (
          <Button variant="ghost" onClick={exportCsv}>
            <Download size={16} />
            Export CSV
          </Button>
        )}
      </div>

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

            <Button variant="ghost" size="sm" onClick={refetchTasks} disabled={tasksLoading}>
              <RefreshCw size={14} className={tasksLoading ? "animate-spin" : ""} />
              Refresh
            </Button>
            {hasColumnFilters && (
              <Button variant="ghost" size="sm" onClick={clearColumnFilters}>
                <X size={14} />
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

        {/* ── Column filters ── */}
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
              <div className="task-list-input-wrap">
                <Search size={14} className="task-list-input-icon" aria-hidden="true" />
                <input
                  id="task-filter-client"
                  className="input"
                  type="search"
                  list="task-client-suggestions"
                  placeholder="Search client"
                  value={columnFilters.client}
                  onChange={(event) => updateColumnFilter("client", event.target.value)}
                />
              </div>
              <datalist id="task-client-suggestions">
                {clientSuggestions.map((client) => (
                  <option key={client} value={client} />
                ))}
              </datalist>
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
                  <option key={option} value={option}>{option}</option>
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
                  <option key={option} value={option}>{option}</option>
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
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </FilterField>

            {/* Status — now includes Active option */}
            <FilterField label="Status" htmlFor="task-filter-status">
              <select
                id="task-filter-status"
                className="input"
                value={columnFilters.status}
                onChange={(event) => updateColumnFilter("status", event.target.value)}
              >
                <option value="">All statuses</option>
                {FILTER_STATUSES.filter((s) => s !== "All").map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
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
        <TaskDrawer taskId={drawerTaskId} canManage={canManage} onClose={() => setDrawerTaskId(null)} />
      )}
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
