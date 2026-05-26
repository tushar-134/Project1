import { Download, RefreshCw, Search, SlidersHorizontal, X } from "lucide-react";
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useApp } from "../../context/AppContext.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { useUsers } from "../../hooks/useUsers.js";
import { useTasks } from "../../hooks/useTasks";
import { downloadBlob } from "../../utils/adapterUtils";
import { canManageTasks } from "../../utils/permissions.js";
import Badge from "../ui/Badge.jsx";
import Button from "../ui/Button.jsx";
import Card from "../ui/Card.jsx";
import Table from "../ui/Table.jsx";
import TaskDrawer from "../ui/TaskDrawer.jsx";

const ALL_STATUSES = ["Not Yet Started", "WIP", "Submitted to FTA", "Completed"];
const BASE_STATUSES = ["Not Yet Started", "WIP", "Completed"]; // for non-FTA tasks
const FILTER_STATUSES = ["Not Yet Started", "WIP", "Submitted to FTA", "Completed", "All"];
// Chip filter includes "Active" (all non-completed). Column dropdown uses FILTER_STATUSES without "Active".
const CHIP_STATUSES = ["Not Yet Started", "WIP", "Submitted to FTA", "Completed", "Active", "All"];
// Category order for stable display
const CAT_ORDER = ["VAT", "Corporate Tax", "Audit", "Accounting", "MIS Reporting", "E-Invoicing", "VAT Refund", "Other"];
const TASK_TABLE_COLUMNS = 8;
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
  };
}

function getCurrentMonthValue() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
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
  ].filter(Boolean);
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
  const [cat, setCat] = useState(searchParams.get("category") || "All");
  const [status, setStatus] = useState("Not Yet Started");
  const [scope, setScope] = useState("By Month");
  const [month, setMonth] = useState(initialMonth);
  const [drawerTaskId, setDrawerTaskId] = useState(null);
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ total: 0, page: 1, pages: 1 });
  const [columnFilters, setColumnFilters] = useState(() => createEmptyColumnFilters());
  const deferredColumnFilters = useDeferredValue(columnFilters);

  const canManage = canManageTasks(currentUser?.role);
  const isTaskOnly = currentUser?.role === "task_only";
  const { fetchUsers } = useUsers();
  const tasksLoading = Boolean(state.loading.tasks);
  const taskError = state.errors.tasks;

  useEffect(() => {
    if (canManage) fetchUsers().catch(() => {});
  }, [canManage]);

  const serverFilters = useMemo(() => ({
    category: deferredColumnFilters.category || (cat !== "All" ? cat : undefined),
    // "Active" chip = all non-completed; otherwise the column filter takes priority, then the chip.
    status: deferredColumnFilters.status ||
      (status === "Active" ? "Active" : (status !== "All" ? status : undefined)),
    month: scope === "By Month" ? month : undefined,
    overdue: scope === "Overdue" ? "true" : undefined,
    taskId: deferredColumnFilters.taskId || undefined,
    client: deferredColumnFilters.client || undefined,
    type: deferredColumnFilters.type || undefined,
    dueDate: deferredColumnFilters.dueDate || undefined,
    assigned: deferredColumnFilters.assigned || undefined,
    remarks: deferredColumnFilters.remarks || undefined,
    recurring: deferredColumnFilters.recurring || undefined,
  }), [cat, deferredColumnFilters, month, scope, status]);
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

  const categoryOptions = sortStrings(state.tasks.map((task) => task.category));
  const typeOptions = sortStrings(state.tasks.map((task) => task.type));
  const assigneeOptions = sortStrings(state.tasks.map((task) => task.assigned));
  const clientSuggestions = sortStrings(state.tasks.map((task) => task.client));
  const availableCats = useMemo(() => ["All", ...CAT_ORDER], []);
  const rows = state.tasks;

  const completedCount = rows.filter((task) => task.status === "Completed").length;
  const workingCount = rows.length - completedCount;
  const activeCount = rows.filter((task) => task.status === "Not Yet Started" || task.status === "WIP").length;
  const activeColumnFilters = buildActiveColumnFilterSummary(columnFilters);
  const activeTopFilterCount =
    (cat !== "All" ? 1 : 0) +
    (status !== "All" ? 1 : 0) +
    (scope !== "By Month" ? 1 : 0) +
    (scope === "By Month" && month !== initialMonth ? 1 : 0);
  const activeFilterCount = activeTopFilterCount + activeColumnFilters.length;
  const hasColumnFilters = activeColumnFilters.length > 0;
  const hasActiveFilters = activeFilterCount > 0;

  const updateColumnFilter = (key, value) => {
    setPage(1);
    // Keep the status chip and the column status dropdown in sync — only one can be active at a time.
    if (key === "status" && value) {
      setStatus("All");
    }
    setColumnFilters((current) => ({ ...current, [key]: value }));
  };

  const clearColumnFilters = () => {
    setPage(1);
    setColumnFilters(createEmptyColumnFilters());
  };

  const resetAllFilters = () => {
    setPage(1);
    setCat("All");
    setStatus("All");
    setScope("By Month");
    setMonth(initialMonth);
    setColumnFilters(createEmptyColumnFilters());
  };

  const exportCsv = async () =>
    downloadBlob(
      await exportTasks(serverFilters),
      "tasks.csv",
    );

  const renderTaskRow = (task) => {
    const canEditTask =
      canManage ||
      (isTaskOnly && String(task.assignedId) === String(currentUser?._id || currentUser?.id));
    const canChangeStatus = canEditTask;
    const isStatusLocked = task.ftaStatus === "approved" || task.status === "Completed";

    return (
      <tr key={task.id}>
        <td className="font-extrabold text-[#1e3a8a]">
          <button
            className="task-id-link"
            onClick={() => (canManage ? setDrawerTaskId(task.id) : navigate(`/tasks/${task.id}`))}
            title={canManage ? "Open task details" : "View task details"}
          >
            {task.taskId}
          </button>
        </td>
        <td>{task.client}</td>
        <td>
          <Badge>{task.category}</Badge>
        </td>
        <td>{task.type}</td>
        <td>
          <div>{task.dueDate}</div>
          {task.overdueDays > 0 && (
            <span className="mt-1 inline-flex rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-extrabold text-[#dc2626]">
              {task.overdueDays}d overdue
            </span>
          )}
        </td>
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
        <td>
          {task.recurring ? (
            <span className="rounded-full bg-blue-50 px-2 py-1 text-[11px] font-extrabold text-[#1e3a8a]">
              Recurring
            </span>
          ) : (
            <span className="text-[12px] font-semibold text-slate-500">One-time</span>
          )}
        </td>
      </tr>
    );
  };

  return (
    <div className="space-y-5">
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

      <Card className="overflow-hidden">
        <div className="task-list-toolbar border-b border-slate-200 px-4 py-4 sm:px-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-2xl">
              <div className="flex items-center gap-2 text-[14px] font-extrabold text-slate-900">
                <SlidersHorizontal size={16} className="text-[#1e3a8a]" />
                Filter and review tasks
              </div>
              <p className="mt-1 text-[12px] font-medium text-slate-500">
                Tasks are shown in one list, newest activity first, and completed work appears in the same table when you filter for it.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <InfoPill tone="navy" label={`${workingCount} working`} />
              <InfoPill tone="orange" label={`${activeCount} active tasks`} />
              <InfoPill tone="green" label={`${completedCount} completed`} />
              <InfoPill tone="slate" label={`${meta.total} matches`} />
              {tasksLoading && <InfoPill tone="amber" label="Refreshing" />}
              {hasActiveFilters && <InfoPill tone="blue" label={`${activeFilterCount} active filters`} />}
            </div>
          </div>

          <div className="mt-4 space-y-3">
            <FilterChips label="Category" items={availableCats} value={cat} setValue={(value) => {
              setPage(1);
              setCat(value);
            }} />
            <FilterChips label="Status" items={CHIP_STATUSES} value={status} setValue={(value) => {
              setPage(1);
              setStatus(value);
              // Clear the column status dropdown so the two filters don't conflict.
              if (value !== "All") {
                setColumnFilters((current) => ({ ...current, status: "" }));
              }
            }} />

            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(220px,auto)_auto] lg:items-end">
              <FilterChips label="Scope" items={["By Month", "Overdue", "All"]} value={scope} setValue={(value) => {
                setPage(1);
                setScope(value);
              }} compact />

              <label htmlFor="task-list-month" className={`task-list-field ${scope !== "By Month" ? "opacity-60" : ""}`}>
                <span className="task-list-field-label">Month</span>
                <input
                  id="task-list-month"
                  name="taskListMonth"
                  className="input"
                  type="month"
                  value={month}
                  disabled={scope !== "By Month"}
                  onChange={(event) => {
                    setPage(1);
                    setMonth(event.target.value);
                  }}
                />
              </label>

              <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                <Button variant="ghost" size="sm" onClick={refetchTasks} disabled={tasksLoading}>
                  <RefreshCw size={15} className={tasksLoading ? "animate-spin" : ""} />
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
        </div>

        <div className="px-4 py-4 sm:px-5">
          <div className="task-list-column-grid">
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

            <FilterField label="Category" htmlFor="task-filter-category">
              <select
                id="task-filter-category"
                className="input"
                value={columnFilters.category}
                onChange={(event) => updateColumnFilter("category", event.target.value)}
              >
                <option value="">All categories</option>
                {categoryOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </FilterField>

            <FilterField label="Task Type" htmlFor="task-filter-type">
              <select
                id="task-filter-type"
                className="input"
                value={columnFilters.type}
                onChange={(event) => updateColumnFilter("type", event.target.value)}
              >
                <option value="">All task types</option>
                {typeOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </FilterField>

            <FilterField label="Due Date" htmlFor="task-filter-due-date">
              <input
                id="task-filter-due-date"
                className="input"
                type="date"
                value={columnFilters.dueDate}
                onChange={(event) => updateColumnFilter("dueDate", event.target.value)}
              />
            </FilterField>

            <FilterField label="Assigned" htmlFor="task-filter-assigned">
              <select
                id="task-filter-assigned"
                className="input"
                value={columnFilters.assigned}
                onChange={(event) => updateColumnFilter("assigned", event.target.value)}
              >
                <option value="">All assignees</option>
                {assigneeOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </FilterField>

            <FilterField label="Status" htmlFor="task-filter-status">
              <select
                id="task-filter-status"
                className="input"
                value={columnFilters.status}
                onChange={(event) => updateColumnFilter("status", event.target.value)}
              >
                <option value="">All statuses</option>
                {FILTER_STATUSES.filter((option) => option !== "All").map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </FilterField>

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
          </div>

          {hasColumnFilters && (
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

      {isTaskOnly && (
        <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-2.5 text-[12px] font-medium text-blue-700">
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

function TaskTableState({ tasks, tasksLoading, taskError, hasActiveFilters, emptyTitle, emptyDescription, onReset, onRetry, children }) {
  return (
    <Table className="task-list-table">
      <thead>
        <tr>
          <th>Task ID</th>
          <th>Client</th>
          <th>Category</th>
          <th>Task Type</th>
          <th>Due Date</th>
          <th>Assigned</th>
          <th>Status</th>
          <th>Recurring</th>
        </tr>
      </thead>
      <tbody>
        {tasksLoading && !tasks.length && <LoadingRows columns={TASK_TABLE_COLUMNS} />}

        {!tasksLoading && taskError && (
          <tr>
            <td colSpan={TASK_TABLE_COLUMNS} className="px-4 py-10">
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
            <td colSpan={TASK_TABLE_COLUMNS} className="px-4 py-10">
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

function FilterChips({ label, items, value, setValue }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="mr-1 text-[11px] font-extrabold uppercase tracking-[0.08em] text-slate-500">{label}</span>
      {items.map((item) => (
        <button
          key={item}
          type="button"
          onClick={() => setValue(item)}
          className={`task-filter-chip ${value === item ? "task-filter-chip-active" : "task-filter-chip-idle"}`}
        >
          {item}
        </button>
      ))}
    </div>
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
