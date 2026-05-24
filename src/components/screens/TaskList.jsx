import { CalendarRange, ClipboardList, Download, Filter as FilterIcon, MessageSquareMore, TriangleAlert, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
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
const FILTER_STATUSES = ["All", "Not Yet Started", "WIP", "Submitted to FTA", "Completed"];
const CAT_ORDER = ["VAT", "Corporate Tax", "Audit", "Accounting", "MIS Reporting", "E-Invoicing", "VAT Refund", "Other"];

const STATUS_PILL = {
  "Not Yet Started": { bg: "bg-slate-100", text: "text-slate-600" },
  WIP: { bg: "bg-blue-50", text: "text-blue-700" },
  Completed: { bg: "bg-green-100", text: "text-green-700" },
  "Submitted to FTA": { bg: "bg-purple-50", text: "text-purple-700" },
};

const EMPTY_COLUMN_FILTERS = {
  taskId: "",
  client: "",
  category: "",
  type: "",
  remarks: "",
  dueDate: "",
  assigned: "",
  status: "",
  recurring: "",
};

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
  const [searchParams, setSearchParams] = useSearchParams();
  const { fetchTasks, updateStatus, updateAssignee, exportTasks } = useTasks();
  const [cat, setCat] = useState(searchParams.get("category") || "All");
  const [status, setStatus] = useState(searchParams.get("status") || "All");
  const [scope, setScope] = useState(searchParams.get("scope") || "By Month");
  const [month, setMonth] = useState(searchParams.get("month") || getCurrentMonthValue());
  const [drawerTaskId, setDrawerTaskId] = useState(null);
  const [columnFilters, setColumnFilters] = useState(EMPTY_COLUMN_FILTERS);

  const canManage = canManageTasks(currentUser?.role);
  const isTaskOnly = currentUser?.role === "task_only";
  const { fetchUsers } = useUsers();

  useEffect(() => {
    if (canManage) fetchUsers().catch(() => { });
  }, [canManage, fetchUsers]);

  const filterRef = useRef({});
  filterRef.current = {
    category: cat,
    status,
    month: scope === "By Month" ? month : undefined,
    overdue: scope === "Overdue" ? "true" : undefined,
  };

  const refetchTasks = useCallback(() => fetchTasks(filterRef.current).catch(() => { }), [fetchTasks]);
  const [availableCats, setAvailableCats] = useState(["All"]);

  useEffect(() => {
    fetchTasks(filterRef.current)
      .then((tasks) => {
        if (cat === "All") {
          const found = new Set(tasks.map((task) => task.category));
          const ordered = ["All", ...CAT_ORDER.filter((category) => found.has(category))];
          setAvailableCats(ordered);
        }
      })
      .catch(() => { });
  }, [cat, status, scope, month, fetchTasks]);

  useEffect(() => {
    const nextParams = new URLSearchParams();
    if (cat !== "All") nextParams.set("category", cat);
    if (status !== "All") nextParams.set("status", status);
    if (scope !== "By Month") nextParams.set("scope", scope);
    if (month) nextParams.set("month", month);
    if (nextParams.toString() !== searchParams.toString()) {
      setSearchParams(nextParams, { replace: true });
    }
  }, [cat, month, scope, searchParams, setSearchParams, status]);

  const taskMatches = (value, filter) => String(value || "").toLowerCase().includes(String(filter || "").toLowerCase().trim());
  const filterOptions = (key) => [...new Set(state.tasks.map((task) => task[key]).filter(Boolean))].sort();
  const updateColumnFilter = (key, value) => setColumnFilters((current) => ({ ...current, [key]: value }));
  const hasColumnFilters = Object.values(columnFilters).some(Boolean);
  const filteredRows = state.tasks.filter((task) => {
    if (!taskMatches(task.taskId, columnFilters.taskId)) return false;
    if (!taskMatches(task.client, columnFilters.client)) return false;
    if (columnFilters.category && task.category !== columnFilters.category) return false;
    if (!taskMatches(task.type, columnFilters.type)) return false;
    if (!taskMatches(task.remarks, columnFilters.remarks)) return false;
    if (!taskMatches(task.dueDate, columnFilters.dueDate)) return false;
    if (!taskMatches(task.assigned, columnFilters.assigned)) return false;
    if (columnFilters.status && task.status !== columnFilters.status) return false;
    if (columnFilters.recurring === "recurring" && !task.recurring) return false;
    if (columnFilters.recurring === "one-time" && task.recurring) return false;
    return true;
  });

  const activeRows = filteredRows.filter((task) => task.status !== "Completed");
  const completedRows = filteredRows.filter((task) => task.status === "Completed");
  const overdueCount = activeRows.filter((task) => task.overdueDays > 0).length;
  const remarkedCount = filteredRows.filter((task) => String(task.remarks || "").trim()).length;
  const currentMonthValue = getCurrentMonthValue();
  const hasActiveFilters = cat !== "All" || status !== "All" || scope !== "By Month" || month !== currentMonthValue;

  async function exportCsv() {
    return downloadBlob(
      await exportTasks({
        category: cat,
        status,
        month: scope === "By Month" ? month : undefined,
        overdue: scope === "Overdue" ? "true" : undefined,
      }),
      "tasks.csv"
    );
  }

  function clearFilters() {
    setCat("All");
    setStatus("All");
    setScope("By Month");
    setMonth(currentMonthValue);
  }

  function clearColumnFilters() {
    setColumnFilters(EMPTY_COLUMN_FILTERS);
  }

  function openTask(taskId) {
    setDrawerTaskId(taskId);
  }

  function renderTaskRow(task) {
    const canChangeStatus =
      canManage ||
      (isTaskOnly && String(task.assignedId) === String(currentUser?._id || currentUser?.id));
    const isStatusLocked = task.ftaStatus === "approved" || task.status === "Completed";
    const remarkLabel = task.remarks?.trim()
      ? (canChangeStatus ? "Edit remark" : "View remark")
      : (canChangeStatus ? "Add remark" : "Open task");

    return (
      <tr key={task.id}>
        <td className="font-extrabold text-[#1e3a8a]">
          <button
            type="button"
            className="task-id-link"
            onClick={() => openTask(task.id)}
            title="Open task details"
          >
            {task.taskId}
          </button>
        </td>
        <td>{task.client}</td>
        <td>
          <Badge>{task.category}</Badge>
        </td>
        <td>{task.type}</td>
        <td className="max-w-[290px]">
          <div className="space-y-2">
            {task.remarks?.trim() ? (
              <p className="task-remark-preview text-[12px] leading-5">{task.remarks}</p>
            ) : (
              <span className="task-remark-placeholder text-[12px]">No remarks added yet.</span>
            )}
            <button
              type="button"
              className="task-remark-action"
              onClick={() => openTask(task.id)}
            >
              <MessageSquareMore size={12} />
              {remarkLabel}
            </button>
          </div>
        </td>
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
                updateStatus(task.id, event.target.value).then(() => refetchTasks()).catch(() => refetchTasks())
              }
            >
              {ALL_STATUSES.map((option) => (
                <option key={option}>{option}</option>
              ))}
            </select>
          ) : (
            <StatusPill status={task.status} />
          )}
        </td>
        <td>
          {task.recurring && (
            <span className="rounded-full bg-blue-50 px-2 py-1 text-[11px] font-extrabold text-[#1e3a8a]">
              Recurring
            </span>
          )}
        </td>
      </tr>
    );
  }

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

      <div className="grid gap-3 xl:grid-cols-4">
        <TaskStat
          icon={ClipboardList}
          label="Visible tasks"
          value={filteredRows.length}
          helper={`${activeRows.length} active · ${completedRows.length} completed`}
        />
        <TaskStat
          icon={TriangleAlert}
          label="Overdue items"
          value={overdueCount}
          helper={scope === "By Month" ? `Tracking ${formatMonthLabel(month)}` : "Across the current view"}
        />
        <TaskStat
          icon={MessageSquareMore}
          label="Tasks with remarks"
          value={remarkedCount}
          helper="Quick context for handoffs and follow-ups"
        />
        <div className="flex items-end justify-end gap-2">
          {hasColumnFilters && (
            <Button variant="ghost" onClick={clearColumnFilters}>
              <X size={16} />
              Clear column filters
            </Button>
          )}
        </div>
      </div>

      <div className="task-filter-panel p-4 md:p-5">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200/70 pb-4">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[.12em] text-slate-500">
              <FilterIcon size={13} />
              Filters
            </div>
            <h3 className="mt-2 text-[18px] font-extrabold text-slate-900">Sharper views for daily execution</h3>
            <p className="mt-1 text-[13px] text-slate-500">
              Filter by category, delivery status, time window, and table columns without losing context.
            </p>
          </div>
          {hasActiveFilters && (
            <button type="button" className="task-remark-action" onClick={clearFilters}>
              <X size={12} />
              Reset filters
            </button>
          )}
        </div>

        <div className="mt-4 space-y-4">
          <FilterGroup label="Category" items={availableCats} value={cat} setValue={setCat} icon={ClipboardList} />
          <FilterGroup label="Status" items={FILTER_STATUSES} value={status} setValue={setStatus} icon={FilterIcon} />

          <div className="task-filter-group">
            <FilterGroup label="Scope" items={["By Month", "Overdue", "All"]} value={scope} setValue={setScope} icon={CalendarRange} />
            <label className="block min-w-[180px] flex-1 max-w-[220px]" htmlFor="task-list-month">
              <span className="field-label">Month</span>
              <input
                id="task-list-month"
                name="taskListMonth"
                className="input task-filter-month"
                type="month"
                value={month}
                disabled={scope !== "By Month"}
                onChange={(event) => setMonth(event.target.value)}
              />
            </label>
          </div>
        </div>
      </div>

      {isTaskOnly && (
        <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-2.5 text-[12px] font-medium text-blue-700">
          You can update status and remarks only for tasks assigned to you.
        </div>
      )}

      <TaskTableSection
        title="Active Tasks"
        count={activeRows.length}
        countClassName="bg-slate-100 text-slate-500"
        rows={activeRows}
        emptyMessage="No active tasks in the selected view."
        columnFilters={columnFilters}
        filterOptions={filterOptions}
        updateColumnFilter={updateColumnFilter}
        renderTaskRow={renderTaskRow}
      />

      <TaskTableSection
        title="Completed Tasks"
        count={completedRows.length}
        countClassName="bg-green-50 text-green-700"
        rows={completedRows}
        emptyMessage="No completed tasks in the selected view."
        columnFilters={columnFilters}
        filterOptions={filterOptions}
        updateColumnFilter={updateColumnFilter}
        renderTaskRow={renderTaskRow}
      />

      {drawerTaskId && (
        <TaskDrawer taskId={drawerTaskId} canManage={canManage} onClose={() => setDrawerTaskId(null)} />
      )}
    </div>
  );
}

function TaskTableSection({
  title,
  count,
  countClassName,
  rows,
  emptyMessage,
  columnFilters,
  filterOptions,
  updateColumnFilter,
  renderTaskRow,
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <h3 className="text-[15px] font-extrabold text-slate-900">{title}</h3>
        <span className={`rounded-full px-2.5 py-1 text-[11px] font-extrabold ${countClassName}`}>{count}</span>
      </div>
      <Card>
        <Table>
          <thead>
            <tr>
              <th>Task ID</th>
              <th>Client</th>
              <th>Category</th>
              <th>Task Type</th>
              <th>Remarks</th>
              <th>Due Date</th>
              <th>Assigned</th>
              <th>Status</th>
              <th>Recurring</th>
            </tr>
            <tr>
              <th>
                <input
                  aria-label="Filter by task ID"
                  className="input h-8 min-w-28"
                  type="search"
                  value={columnFilters.taskId}
                  onChange={(event) => updateColumnFilter("taskId", event.target.value)}
                />
              </th>
              <th>
                <input
                  aria-label="Filter by client"
                  className="input h-8 min-w-36"
                  type="search"
                  value={columnFilters.client}
                  onChange={(event) => updateColumnFilter("client", event.target.value)}
                />
              </th>
              <th>
                <select
                  aria-label="Filter by category"
                  className="input h-8 min-w-36"
                  value={columnFilters.category}
                  onChange={(event) => updateColumnFilter("category", event.target.value)}
                >
                  <option value="">All</option>
                  {filterOptions("category").map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </th>
              <th>
                <input
                  aria-label="Filter by task type"
                  className="input h-8 min-w-36"
                  type="search"
                  value={columnFilters.type}
                  onChange={(event) => updateColumnFilter("type", event.target.value)}
                />
              </th>
              <th>
                <input
                  aria-label="Filter by remarks"
                  className="input h-8 min-w-36"
                  type="search"
                  value={columnFilters.remarks || ""}
                  onChange={(event) => updateColumnFilter("remarks", event.target.value)}
                />
              </th>
              <th>
                <input
                  aria-label="Filter by due date"
                  className="input h-8 min-w-32"
                  type="search"
                  value={columnFilters.dueDate}
                  onChange={(event) => updateColumnFilter("dueDate", event.target.value)}
                />
              </th>
              <th>
                <input
                  aria-label="Filter by assignee"
                  className="input h-8 min-w-36"
                  type="search"
                  value={columnFilters.assigned}
                  onChange={(event) => updateColumnFilter("assigned", event.target.value)}
                />
              </th>
              <th>
                <select
                  aria-label="Filter by status"
                  className="input h-8 min-w-40"
                  value={columnFilters.status}
                  onChange={(event) => updateColumnFilter("status", event.target.value)}
                >
                  <option value="">All</option>
                  {FILTER_STATUSES.filter((option) => option !== "All").map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </th>
              <th>
                <select
                  aria-label="Filter by recurring"
                  className="input h-8 min-w-32"
                  value={columnFilters.recurring}
                  onChange={(event) => updateColumnFilter("recurring", event.target.value)}
                >
                  <option value="">All</option>
                  <option value="recurring">Recurring</option>
                  <option value="one-time">One-time</option>
                </select>
              </th>
            </tr>
          </thead>
          <tbody>
            {!rows.length && (
              <tr>
                <td colSpan={9} className="py-8 text-center font-semibold text-slate-500">
                  {emptyMessage}
                </td>
              </tr>
            )}
            {rows.map(renderTaskRow)}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}

function FilterGroup({ label, items, value, setValue, icon: Icon }) {
  return (
    <div className="task-filter-group">
      <div className="task-filter-heading">
        <div className="task-stat-icon h-10 w-10 rounded-xl">
          <Icon size={18} />
        </div>
        <div>
          <div className="text-[12px] font-extrabold text-slate-800">{label}</div>
          <div className="text-[11px] text-slate-500">Choose a focused view</div>
        </div>
      </div>
      <div className="task-filter-chip-row">
        {items.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setValue(item)}
            className={`task-filter-chip ${value === item ? "is-active" : ""}`}
          >
            {item}
          </button>
        ))}
      </div>
    </div>
  );
}

function TaskStat({ icon: Icon, label, value, helper }) {
  return (
    <div className="task-stat-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-extrabold uppercase tracking-[.08em] text-slate-500">{label}</div>
          <div className="mt-2 text-[26px] font-black leading-none text-slate-900">{value}</div>
          <div className="mt-2 text-[12px] text-slate-500">{helper}</div>
        </div>
        <div className="task-stat-icon">
          <Icon size={18} />
        </div>
      </div>
    </div>
  );
}

function getCurrentMonthValue() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function formatMonthLabel(value) {
  if (!value) return "current month";
  const [year, month] = value.split("-").map(Number);
  if (!year || !month) return value;
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(new Date(year, month - 1, 1));
}
