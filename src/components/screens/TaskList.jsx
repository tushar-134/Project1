import { Download } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
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

// BRD 5.4 — all four statuses; "Submitted to FTA" is gated to FTA-tracked tasks only
// Order: Not Yet Started → WIP → Submitted to FTA → Completed
const ALL_STATUSES = ["Not Yet Started", "WIP", "Submitted to FTA", "Completed"];
const BASE_STATUSES = ["Not Yet Started", "WIP", "Completed"]; // for non-FTA tasks
const FILTER_STATUSES = ["All", "Not Yet Started", "WIP", "Submitted to FTA", "Completed"];
// Category order for stable display
const CAT_ORDER = ["VAT", "Corporate Tax", "Audit", "Accounting", "MIS Reporting", "E-Invoicing", "VAT Refund", "Other"];

// Colour map for the status pill shown in read-only states
const STATUS_PILL = {
  "Not Yet Started": { bg: "bg-slate-100", text: "text-slate-600" },
  WIP: { bg: "bg-blue-50", text: "text-blue-700" },
  Completed: { bg: "bg-green-100", text: "text-green-700" },
  "Submitted to FTA": { bg: "bg-purple-50", text: "text-purple-700" },
};

/** Read-only coloured pill used when the user cannot change a status */
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
  const [cat, setCat] = useState(searchParams.get("category") || "All");
  const [status, setStatus] = useState("All");
  const [scope, setScope] = useState("By Month");
  const [month, setMonth] = useState(searchParams.get("month") || "2026-05");
  const [drawerTaskId, setDrawerTaskId] = useState(null);

  const canManage = canManageTasks(currentUser?.role);
  const isTaskOnly = currentUser?.role === "task_only";
  const { fetchUsers } = useUsers();

  // Load users list for the inline assignee dropdown
  useEffect(() => { if (canManage) fetchUsers().catch(() => { }); }, [canManage]);

  // Keep a ref to current filter params so refetch after status-change always uses fresh values.
  const filterRef = useRef({});
  filterRef.current = { category: cat, status, month: scope === "By Month" ? month : undefined, overdue: scope === "Overdue" ? "true" : undefined };

  const refetchTasks = useCallback(() => fetchTasks(filterRef.current).catch(() => { }), [fetchTasks]);

  // Track which categories actually have tasks in the current scope/month.
  // We update this only when fetching with category=All so the filter buttons
  // don't disappear when the user drills into a specific category.
  const [availableCats, setAvailableCats] = useState(["All"]);

  useEffect(() => {
    const params = filterRef.current;
    fetchTasks(params)
      .then((tasks) => {
        if (cat === "All") {
          // Derive unique categories from actual tasks, in canonical order
          const found = new Set(tasks.map((t) => t.category));
          const ordered = ["All", ...CAT_ORDER.filter((c) => found.has(c))];
          setAvailableCats(ordered);
        }
      })
      .catch(() => { });
  }, [cat, status, scope, month]);

  const rows = state.tasks;
  const activeRows = rows.filter((task) => task.status !== "Completed");
  const completedRows = rows.filter((task) => task.status === "Completed");
  const exportCsv = async () =>
    downloadBlob(
      await exportTasks({
        category: cat,
        status,
        month: scope === "By Month" ? month : undefined,
        overdue: scope === "Overdue" ? "true" : undefined,
      }),
      "tasks.csv"
    );

  const renderTaskRow = (task) => {
    // BRD 5.4: task_only can only change status for tasks assigned to them
    const canChangeStatus =
      canManage ||
      (isTaskOnly && String(task.assignedId) === String(currentUser?._id || currentUser?.id));
    const isStatusLocked = task.ftaStatus === "approved" || task.status === "Completed";

    // BRD 5.4: "Submitted to FTA" available for all tasks — backend auto-routes to FTA Tracker
    const availableStatuses = ALL_STATUSES;

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
              onChange={(e) => {
                const selected = state.users.find((u) => u._id === e.target.value || u.id === e.target.value);
                updateAssignee(task.id, e.target.value || null, selected?.name || "Unassigned").catch(() => fetchTasks());
              }}
            >
              <option value="">Unassigned</option>
              {state.users.map((u) => (
                <option key={u._id || u.id} value={u._id || u.id}>{u.name}</option>
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
              onChange={(e) =>
                updateStatus(task.id, e.target.value).then(() => refetchTasks()).catch(() => refetchTasks())
              }
            >
              {availableStatuses.map((s) => (
                <option key={s}>{s}</option>
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

      <Filter label="Category" items={availableCats} value={cat} setValue={setCat} />
      <Filter label="Status" items={FILTER_STATUSES} value={status} setValue={setStatus} />

      <div className="flex flex-wrap items-center gap-2">
        <Filter label="Scope" items={["By Month", "Overdue", "All"]} value={scope} setValue={setScope} compact />
        <input
          id="task-list-month"
          name="taskListMonth"
          className="input w-40"
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
        />
      </div>

      {/* BRD 5.4 role note */}
      {isTaskOnly && (
        <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-2.5 text-[12px] font-medium text-blue-700">
          You can update status only for tasks assigned to you.
        </div>
      )}

      <div>
        <div className="mb-2 flex items-center justify-between gap-3">
          <h3 className="text-[15px] font-extrabold text-slate-900">Active Tasks</h3>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-extrabold text-slate-500">{activeRows.length}</span>
        </div>
      <Card>
        <Table>
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
            {!activeRows.length && (
              <tr>
                <td colSpan={8} className="py-8 text-center font-semibold text-slate-500">
                  No active tasks in the selected view.
                </td>
              </tr>
            )}
            {activeRows.map(renderTaskRow)}
          </tbody>
        </Table>
      </Card>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between gap-3">
          <h3 className="text-[15px] font-extrabold text-slate-900">Completed Tasks</h3>
          <span className="rounded-full bg-green-50 px-2.5 py-1 text-[11px] font-extrabold text-green-700">{completedRows.length}</span>
        </div>
        <Card>
          <Table>
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
              {!completedRows.length && (
                <tr>
                  <td colSpan={8} className="py-8 text-center font-semibold text-slate-500">
                    No completed tasks in the selected view.
                  </td>
                </tr>
              )}
              {completedRows.map(renderTaskRow)}
            </tbody>
          </Table>
        </Card>
      </div>

      {canManage && drawerTaskId && (
        <TaskDrawer taskId={drawerTaskId} canManage={canManage} onClose={() => setDrawerTaskId(null)} />
      )}
    </div>
  );
}

function Filter({ label, items, value, setValue, compact }) {
  return (
    <div className={`flex flex-wrap items-center gap-2 ${compact ? "" : "rounded-xl border border-[#e2e8f0] bg-white p-3"}`}>
      <span className="mr-1 text-[11px] font-extrabold uppercase text-slate-500">{label}</span>
      {items.map((item) => (
        <button
          key={item}
          onClick={() => setValue(item)}
          className={`rounded-full px-3 py-1.5 text-[12px] font-extrabold ${value === item ? "bg-[#1e3a8a] text-white" : "bg-slate-100 text-slate-600"
            }`}
        >
          {item}
        </button>
      ))}
    </div>
  );
}
