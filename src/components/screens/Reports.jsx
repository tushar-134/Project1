import { Activity, Clock, Download, FileText, ListChecks, User, Users, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useApp } from "../../context/AppContext.jsx";
import { reportService } from "../../services/reportService";
import { downloadBlob } from "../../utils/adapterUtils";
import Button from "../ui/Button.jsx";
import Card from "../ui/Card.jsx";
import Table from "../ui/Table.jsx";

const tiles = [
  ["Login Activity", "login-activity", User],
  ["Task Activity", "task-activity", Activity],
  ["Client-wise Report", "client-wise", Users],
  ["User-wise Report", "user-wise", ListChecks],
  ["Overdue Report", "overdue", Clock],
  ["FTA Tracker Report", "fta-tracker", FileText],
];

const reportCalls = {
  "login-activity": reportService.loginActivity,
  "task-activity": reportService.taskActivity,
  "client-wise": reportService.clientWise,
  "user-wise": reportService.userWise,
  overdue: reportService.overdue,
  "fta-tracker": reportService.ftaTracker,
};

const reportNames = Object.fromEntries(tiles.map(([name, key]) => [key, name]));
const pad = (value) => String(value).padStart(2, "0");
const dateInputValue = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const displayDateValue = (date) => `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
const defaultDates = () => {
  const end = new Date();
  const start = new Date(end.getTime() - 24 * 60 * 60 * 1000);
  return { startDate: dateInputValue(start), endDate: dateInputValue(end) };
};
const defaultDraftDates = () => {
  const end = new Date();
  const start = new Date(end.getTime() - 24 * 60 * 60 * 1000);
  return { startDate: displayDateValue(start), endDate: displayDateValue(end) };
};
const displayToApiDate = (value) => {
  const match = String(value || "").trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;
  const [, day, month, year] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  if (date.getFullYear() !== Number(year) || date.getMonth() !== Number(month) - 1 || date.getDate() !== Number(day)) return null;
  return `${year}-${month}-${day}`;
};
const formatDate = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
};
const formatDateTime = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  const hours = date.getHours();
  const displayHours = hours % 12 || 12;
  const period = hours >= 12 ? "PM" : "AM";
  return `${formatDate(date)} ${pad(displayHours)}:${pad(date.getMinutes())} ${period}`;
};
const formatStatus = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return "-";
  return raw
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
};
const asText = (value) => {
  if (value === null || value === undefined || value === "") return "-";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
  if (value.name || value.email || value.legalName || value.taskId || value.fileNo) return value.name || value.email || value.legalName || value.taskId || value.fileNo;
  return "-";
};

function ClientTaskDrawer({ detail, loading, onClose }) {
  if (!detail && !loading) return null;

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-40 bg-slate-950/30 backdrop-blur-[1px]"
        onClick={onClose}
        aria-label="Close client task report"
      />
      <aside className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[680px] flex-col border-l border-[#dbe4f0] bg-[#f8fbff] shadow-[-24px_0_60px_rgba(15,23,42,0.16)]">
        <div className="flex items-center justify-between border-b border-[#e2e8f0] bg-white px-5 py-4">
          <div>
            <div className="page-kicker">Client Report</div>
            <div className="mt-1 text-[18px] font-black text-slate-900">{detail?.client?.legalName || "Loading client"}</div>
            <div className="text-[12px] font-semibold text-slate-500">{detail?.client?.fileNo || "Task activity for this client"}</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-10 w-10 place-items-center rounded-xl border border-[#dbe4f0] bg-slate-50 text-slate-500 transition hover:bg-slate-100"
            aria-label="Close client task drawer"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          {loading ? (
            <Card className="p-8 text-center text-[14px] font-semibold text-slate-500">Loading client tasks...</Card>
          ) : !detail?.items?.length ? (
            <Card className="p-8 text-center text-[14px] font-semibold text-slate-500">No tasks found for this client in the selected date range.</Card>
          ) : (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <Card className="p-4">
                  <div className="text-[11px] font-black uppercase tracking-wider text-slate-400">Client</div>
                  <div className="mt-1 text-[14px] font-extrabold text-slate-900">{detail.client?.legalName || "-"}</div>
                </Card>
                <Card className="p-4">
                  <div className="text-[11px] font-black uppercase tracking-wider text-slate-400">File No</div>
                  <div className="mt-1 text-[14px] font-extrabold text-slate-900">{detail.client?.fileNo || "-"}</div>
                </Card>
                <Card className="p-4">
                  <div className="text-[11px] font-black uppercase tracking-wider text-slate-400">Tasks</div>
                  <div className="mt-1 text-[14px] font-extrabold text-slate-900">{detail.total ?? detail.items.length}</div>
                </Card>
              </div>

              <Card>
                <Table>
                  <thead>
                    <tr>
                      <th>Task ID</th>
                      <th>Task Name</th>
                      <th>Status</th>
                      <th>User</th>
                      <th>Last Action</th>
                      <th>Last Updated</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.items.map((task) => (
                      <tr key={task._id}>
                        <td className="font-extrabold text-[#1e3a8a]">{task.taskId || "-"}</td>
                        <td>{task.taskType || "-"}</td>
                        <td>{formatStatus(task.status)}</td>
                        <td>{task.performedBy?.name || task.assignedTo?.name || "-"}</td>
                        <td>{task.latestAction || "-"}</td>
                        <td>{formatDateTime(task.latestActionAt || task.updatedAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </Card>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}

function UserTaskDrawer({ detail, loading, onClose }) {
  if (!detail && !loading) return null;

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-40 bg-slate-950/30 backdrop-blur-[1px]"
        onClick={onClose}
        aria-label="Close user task report"
      />
      <aside className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[680px] flex-col border-l border-[#dbe4f0] bg-[#f8fbff] shadow-[-24px_0_60px_rgba(15,23,42,0.16)]">
        <div className="flex items-center justify-between border-b border-[#e2e8f0] bg-white px-5 py-4">
          <div>
            <div className="page-kicker">User Report</div>
            <div className="mt-1 text-[18px] font-black text-slate-900">{detail?.user?.name || "Loading user"}</div>
            <div className="text-[12px] font-semibold text-slate-500">{detail?.user?.email || detail?.user?.role || "Task activity for this user"}</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-10 w-10 place-items-center rounded-xl border border-[#dbe4f0] bg-slate-50 text-slate-500 transition hover:bg-slate-100"
            aria-label="Close user task drawer"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          {loading ? (
            <Card className="p-8 text-center text-[14px] font-semibold text-slate-500">Loading user tasks...</Card>
          ) : !detail?.items?.length ? (
            <Card className="p-8 text-center text-[14px] font-semibold text-slate-500">No tasks found for this user in the selected date range.</Card>
          ) : (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <Card className="p-4">
                  <div className="text-[11px] font-black uppercase tracking-wider text-slate-400">User</div>
                  <div className="mt-1 text-[14px] font-extrabold text-slate-900">{detail.user?.name || "-"}</div>
                </Card>
                <Card className="p-4">
                  <div className="text-[11px] font-black uppercase tracking-wider text-slate-400">Email</div>
                  <div className="mt-1 break-all text-[14px] font-extrabold leading-5 text-slate-900">
                    {detail.user?.email || "-"}
                  </div>
                </Card>
                <Card className="p-4">
                  <div className="text-[11px] font-black uppercase tracking-wider text-slate-400">Tasks</div>
                  <div className="mt-1 text-[14px] font-extrabold text-slate-900">{detail.total ?? detail.items.length}</div>
                </Card>
              </div>

              <Card>
                <Table>
                  <thead>
                    <tr>
                      <th>Client</th>
                      <th>Task ID</th>
                      <th>Task Name</th>
                      <th>Status</th>
                      <th>Last Updated</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.items.map((task) => (
                      <tr key={task._id}>
                        <td className="font-extrabold text-[#1e3a8a]">{task.client?.legalName || "-"}</td>
                        <td>{task.taskId || "-"}</td>
                        <td>{task.taskType || "-"}</td>
                        <td>{formatStatus(task.status)}</td>
                        <td>{formatDateTime(task.latestActionAt || task.updatedAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </Card>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}

const reportColumns = {
  "login-activity": [
    ["Name", (row) => row.name || "-"],
    ["Email", (row) => row.email || "-"],
    ["Role", (row) => row.role || "-"],
    ["Last Login", (row) => formatDateTime(row.lastLogin)],
  ],
  "task-activity": [
    ["Task ID", (row) => row.task?.taskId || row.taskId || "-"],
    ["User", (row) => row.user?.name || row.user?.email || asText(row.user)],
    ["Date & Time", (row) => formatDateTime(row.createdAt || row.date)],
    ["Client", (row) => row.task?.client?.legalName || row.client?.legalName || asText(row.client)],
    ["Task Name", (row) => row.task?.taskType || asText(row.task)],
    ["Category", (row) => row.task?.category || row.category || "-"],
    ["Status", (row) => formatStatus(row.newStatus || row.task?.status || row.status)],
    ["Last Updated", (row) => formatDateTime(row.updatedAt)],
  ],
  "client-wise": [
    ["Client", (row) => row.client?.legalName || "-"],
    ["File No", (row) => row.client?.fileNo || "-"],
    ["Total", (row) => row.total ?? 0],
    ["Not Started", (row) => row.not_started ?? 0],
    ["WIP", (row) => row.wip ?? 0],
    ["Completed", (row) => row.completed ?? 0],
    ["Submitted to FTA", (row) => row.submitted_to_fta ?? 0],
    ["Last Updated", (row) => formatDateTime(row.updatedAt)],
  ],
  "user-wise": [
    ["User", (row) => row.user?.name || "Unassigned"],
    ["Email", (row) => row.user?.email || "-"],
    ["Role", (row) => row.user?.role || "-"],
    ["Total", (row) => row.total ?? 0],
    ["Not Started", (row) => row.not_started ?? 0],
    ["WIP", (row) => row.wip ?? 0],
    ["Completed", (row) => row.completed ?? 0],
    ["Submitted to FTA", (row) => row.submitted_to_fta ?? 0],
    ["Last Updated", (row) => formatDateTime(row.updatedAt)],
  ],
  overdue: [
    ["Task ID", (row) => row.taskId || "-"],
    ["Client", (row) => row.client?.legalName || "-"],
    ["Assigned To", (row) => row.assignedTo?.name || "-"],
    ["Task Name", (row) => row.taskType || "-"],
    ["Category", (row) => row.category || "-"],
    ["Due Date", (row) => formatDate(row.dueDate)],
    ["Days Overdue", (row) => row.daysOverdue ?? 0],
    ["Last Updated", (row) => formatDateTime(row.updatedAt)],
  ],
  "fta-tracker": [
    ["Task ID", (row) => row.taskId || "-"],
    ["Client", (row) => row.client?.legalName || "-"],
    ["Assigned To", (row) => row.assignedTo?.name || "-"],
    ["Task Name", (row) => row.taskType || "-"],
    ["Category", (row) => row.category || "-"],
    ["FTA Status", (row) => row.ftaStatus || "-"],
    ["Submitted", (row) => formatDateTime(row.ftaSubmittedDate)],
    ["Last Updated", (row) => formatDateTime(row.updatedAt)],
  ],
};

function normalizeReportData(data) {
  if (Array.isArray(data)) return { items: data, total: data.length, page: 1, pages: 1 };
  return { items: data?.items || data?.tasks || [], total: data?.total || 0, page: data?.page || 1, pages: data?.pages || 1 };
}

export default function Reports() {
  const { state, dispatch } = useApp();
  const [activeReport, setActiveReport] = useState("login-activity");
  const [draftRange, setDraftRange] = useState(defaultDraftDates);
  const [range, setRange] = useState(defaultDates);
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ total: 0, page: 1, pages: 1 });
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [rangeError, setRangeError] = useState("");
  const [clientTaskDetail, setClientTaskDetail] = useState(null);
  const [clientTaskLoading, setClientTaskLoading] = useState(false);
  const [userTaskDetail, setUserTaskDetail] = useState(null);
  const [userTaskLoading, setUserTaskLoading] = useState(false);
  const columns = useMemo(() => reportColumns[activeReport] || reportColumns["task-activity"], [activeReport]);

  const loadReport = (report = activeReport, nextPage = page, nextRange = range) => {
    setLoading(true);
    reportCalls[report]?.({ ...nextRange, page: nextPage })
      .then((data) => {
        const result = normalizeReportData(data);
        dispatch({ type: "SET_RESOURCE", resource: "activity", payload: result.items });
        setMeta({ total: result.total, page: result.page, pages: result.pages });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  const selectReport = (report) => {
    setActiveReport(report);
    setPage(1);
    setClientTaskDetail(null);
    setUserTaskDetail(null);
    loadReport(report, 1);
  };

  const applyRange = () => {
    const nextRange = { startDate: displayToApiDate(draftRange.startDate), endDate: displayToApiDate(draftRange.endDate) };
    if (!nextRange.startDate || !nextRange.endDate) {
      setRangeError("Use dd/mm/yyyy for both dates.");
      return;
    }
    if (new Date(nextRange.startDate) > new Date(nextRange.endDate)) {
      setRangeError("From date must be before To date.");
      return;
    }
    setRangeError("");
    setRange(nextRange);
    setPage(1);
    loadReport(activeReport, 1, nextRange);
  };

  const goToPage = (nextPage) => {
    const safePage = Math.min(Math.max(1, nextPage), meta.pages || 1);
    setPage(safePage);
    loadReport(activeReport, safePage);
  };

  const downloadCsv = () => {
    setDownloading(true);
    reportService.exportCsv(activeReport, range)
      .then((blob) => downloadBlob(blob, `${activeReport}-${range.startDate}-to-${range.endDate}.csv`))
      .catch(() => {})
      .finally(() => setDownloading(false));
  };

  const openClientTaskDetail = (row) => {
    const clientId = row?.client?._id;
    if (!clientId) return;
    setClientTaskLoading(true);
    setClientTaskDetail({ client: row.client, items: [], total: row.total || 0 });
    reportService.clientTaskDetail(clientId, range)
      .then((data) => setClientTaskDetail(data))
      .catch(() => setClientTaskDetail({ client: row.client, items: [], total: 0 }))
      .finally(() => setClientTaskLoading(false));
  };

  const openUserTaskDetail = (row) => {
    const userId = row?.user?._id;
    if (!userId) return;
    setUserTaskLoading(true);
    setUserTaskDetail({ user: row.user, items: [], total: row.total || 0 });
    reportService.userTaskDetail(userId, range)
      .then((data) => setUserTaskDetail(data))
      .catch(() => setUserTaskDetail({ user: row.user, items: [], total: 0 }))
      .finally(() => setUserTaskLoading(false));
  };

  useEffect(() => {
    loadReport("login-activity", 1, range);
  }, []);

  return (
    <div className="space-y-5">
      <div>
        <div className="page-kicker">Insights</div>
        <h2 className="screen-title">Reports</h2>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {tiles.map(([name, key, Icon]) => (
          <Card
            key={key}
            className={`cursor-pointer p-4 transition hover:-translate-y-0.5 hover:shadow-md ${activeReport === key ? "ring-2 ring-[#1e3a8a]" : ""}`}
            onClick={() => selectReport(key)}
          >
            <Icon className="mb-3 text-[#1e3a8a]" size={24} />
            <div className="font-extrabold">{name}</div>
            <div className="mt-1 text-[12px] font-semibold text-slate-500">Generate and export report</div>
          </Card>
        ))}
      </div>
      <Card className="p-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-[12px] font-extrabold text-slate-600">
            From
            <input className="mt-1 block rounded border border-[#cbd5e1] px-3 py-2 text-[14px]" inputMode="numeric" placeholder="dd/mm/yyyy" value={draftRange.startDate} onChange={(event) => setDraftRange((current) => ({ ...current, startDate: event.target.value }))} />
          </label>
          <label className="text-[12px] font-extrabold text-slate-600">
            To
            <input className="mt-1 block rounded border border-[#cbd5e1] px-3 py-2 text-[14px]" inputMode="numeric" placeholder="dd/mm/yyyy" value={draftRange.endDate} onChange={(event) => setDraftRange((current) => ({ ...current, endDate: event.target.value }))} />
          </label>
          <Button onClick={applyRange}>Apply</Button>
          <Button variant="ghost" onClick={downloadCsv} disabled={downloading}>
            <Download size={16} /> {downloading ? "Preparing CSV" : "Download CSV Report"}
          </Button>
        </div>
        {rangeError && <div className="mt-2 text-[12px] font-semibold text-[#dc2626]">{rangeError}</div>}
      </Card>
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e2e8f0] px-4 py-3">
          <div className="text-[14px] font-extrabold">{reportNames[activeReport]}</div>
          <div className="text-[12px] font-semibold text-slate-500">Sorted by {activeReport === "login-activity" ? "last login time" : "last updated time"}</div>
        </div>
        <Table>
          <thead>
            <tr>{columns.map(([label]) => <th key={label}>{label}</th>)}</tr>
          </thead>
          <tbody>
            {state.activity.map((row, index) => (
              <tr key={row._id || `${activeReport}-${index}`}>
                {columns.map(([label, render], cellIndex) => (
                  <td key={label} className={cellIndex === 0 ? "font-extrabold text-[#1e3a8a]" : ""}>
                    {activeReport === "client-wise" && label === "Client" && row.client?._id ? (
                      <button
                        type="button"
                        className="font-extrabold text-[#1e3a8a] underline-offset-4 hover:underline"
                        onClick={() => openClientTaskDetail(row)}
                      >
                        {asText(render(row))}
                      </button>
                    ) : activeReport === "user-wise" && label === "User" && row.user?._id ? (
                      <button
                        type="button"
                        className="font-extrabold text-[#1e3a8a] underline-offset-4 hover:underline"
                        onClick={() => openUserTaskDetail(row)}
                      >
                        {asText(render(row))}
                      </button>
                    ) : (
                      asText(render(row))
                    )}
                  </td>
                ))}
              </tr>
            ))}
            {!loading && !state.activity.length && (
              <tr><td className="text-center text-slate-500" colSpan={columns.length}>No report data found</td></tr>
            )}
            {loading && (
              <tr><td className="text-center text-slate-500" colSpan={columns.length}>Loading report...</td></tr>
            )}
          </tbody>
        </Table>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#e2e8f0] px-4 py-3 text-[13px] font-semibold text-slate-600">
          <div>Page {meta.page} of {meta.pages} - {meta.total} total</div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => goToPage(page - 1)} disabled={loading || page <= 1}>Previous</Button>
            <Button variant="ghost" onClick={() => goToPage(page + 1)} disabled={loading || page >= meta.pages}>Next</Button>
          </div>
        </div>
      </Card>
      <ClientTaskDrawer detail={clientTaskDetail} loading={clientTaskLoading} onClose={() => setClientTaskDetail(null)} />
      <UserTaskDrawer detail={userTaskDetail} loading={userTaskLoading} onClose={() => setUserTaskDetail(null)} />
    </div>
  );
}
