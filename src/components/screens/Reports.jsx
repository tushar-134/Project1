import { Activity, Clock, FileText, ListChecks, User, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useApp } from "../../context/AppContext.jsx";
import { reportService } from "../../services/reportService";
import Card from "../ui/Card.jsx";
import Table from "../ui/Table.jsx";

const tiles = [
  ["Login Activity", User],
  ["Task Activity", Activity],
  ["Client-wise Report", Users],
  ["User-wise Report", ListChecks],
  ["Overdue Report", Clock],
  ["FTA Tracker Report", FileText],
];

const reportCalls = {
  "Login Activity": reportService.loginActivity,
  "Task Activity": reportService.taskActivity,
  "Client-wise Report": reportService.clientWise,
  "User-wise Report": reportService.userWise,
  "Overdue Report": reportService.overdue,
  "FTA Tracker Report": reportService.ftaTracker,
};

const formatDateTime = (value) => (value ? new Date(value).toLocaleString() : "-");
const asText = (value) => {
  if (value === null || value === undefined || value === "") return "-";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
  if (value.name || value.email || value.legalName || value.taskId || value.fileNo) {
    return value.name || value.email || value.legalName || value.taskId || value.fileNo;
  }
  return "-";
};

const reportColumns = {
  "Login Activity": [
    ["Name", (row) => row.name || "-"],
    ["Email", (row) => row.email || "-"],
    ["Role", (row) => row.role || "-"],
    ["Last Login", (row) => formatDateTime(row.lastLogin)],
  ],
  "Task Activity": [
    ["Task ID", (row) => row.task?.taskId || row.taskId || "-"],
    ["User", (row) => row.user?.name || row.user?.email || asText(row.user)],
    ["Date & Time", (row) => formatDateTime(row.createdAt || row.date)],
    ["Client", (row) => row.task?.client?.legalName || row.client?.legalName || asText(row.client)],
    ["Task Name", (row) => row.task?.taskType || asText(row.task)],
    ["Category", (row) => row.task?.category || row.category || "-"],
    ["Action", (row) => row.action || "-"],
  ],
  "Client-wise Report": [
    ["Client", (row) => row.client?.legalName || "-"],
    ["File No", (row) => row.client?.fileNo || "-"],
    ["Total", (row) => row.total ?? 0],
    ["Not Started", (row) => row.not_started ?? 0],
    ["WIP", (row) => row.wip ?? 0],
    ["Completed", (row) => row.completed ?? 0],
    ["Submitted to FTA", (row) => row.submitted_to_fta ?? 0],
  ],
  "User-wise Report": [
    ["User", (row) => row.user?.name || "Unassigned"],
    ["Email", (row) => row.user?.email || "-"],
    ["Role", (row) => row.user?.role || "-"],
    ["Total", (row) => row.total ?? 0],
    ["Not Started", (row) => row.not_started ?? 0],
    ["WIP", (row) => row.wip ?? 0],
    ["Completed", (row) => row.completed ?? 0],
    ["Submitted to FTA", (row) => row.submitted_to_fta ?? 0],
  ],
  "Overdue Report": [
    ["Task ID", (row) => row.taskId || "-"],
    ["Client", (row) => row.client?.legalName || "-"],
    ["Assigned To", (row) => row.assignedTo?.name || "-"],
    ["Task Name", (row) => row.taskType || "-"],
    ["Category", (row) => row.category || "-"],
    ["Due Date", (row) => formatDateTime(row.dueDate)],
    ["Days Overdue", (row) => row.daysOverdue ?? 0],
  ],
  "FTA Tracker Report": [
    ["Task ID", (row) => row.taskId || "-"],
    ["Client", (row) => row.client?.legalName || "-"],
    ["Assigned To", (row) => row.assignedTo?.name || "-"],
    ["Task Name", (row) => row.taskType || "-"],
    ["Category", (row) => row.category || "-"],
    ["FTA Status", (row) => row.ftaStatus || "-"],
    ["Submitted", (row) => formatDateTime(row.ftaSubmittedDate)],
  ],
};

function normalizeReportData(data) {
  if (Array.isArray(data)) return data;
  return data?.tasks || [];
}

export default function Reports() {
  const { state, dispatch } = useApp();
  const [activeReport, setActiveReport] = useState("Login Activity");
  const columns = useMemo(() => reportColumns[activeReport] || reportColumns["Task Activity"], [activeReport]);

  const loadReport = (name = activeReport) => {
    setActiveReport(name);
    reportCalls[name]?.()
      .then((data) => dispatch({ type: "SET_RESOURCE", resource: "activity", payload: normalizeReportData(data) }))
      .catch(() => {});
  };

  useEffect(() => {
    loadReport("Login Activity");
  }, []);

  return (
    <div className="space-y-5">
      <div>
        <div className="page-kicker">Insights</div>
        <h2 className="screen-title">Reports</h2>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {tiles.map(([name, Icon]) => (
          <Card
            key={name}
            className={`cursor-pointer p-4 transition hover:-translate-y-0.5 hover:shadow-md ${activeReport === name ? "ring-2 ring-[#1e3a8a]" : ""}`}
            onClick={() => loadReport(name)}
          >
            <Icon className="mb-3 text-[#1e3a8a]" size={24} />
            <div className="font-extrabold">{name}</div>
            <div className="mt-1 text-[12px] font-semibold text-slate-500">Generate and export report</div>
          </Card>
        ))}
      </div>
      <Card>
        <div className="border-b border-[#e2e8f0] px-4 py-3 text-[14px] font-extrabold">{activeReport}</div>
        <Table>
          <thead>
            <tr>{columns.map(([label]) => <th key={label}>{label}</th>)}</tr>
          </thead>
          <tbody>
            {state.activity.map((row, index) => (
              <tr key={row._id || `${activeReport}-${index}`}>
                {columns.map(([label, render], cellIndex) => (
                  <td key={label} className={cellIndex === 0 ? "font-extrabold text-[#1e3a8a]" : ""}>
                    {asText(render(row))}
                  </td>
                ))}
              </tr>
            ))}
            {!state.activity.length && (
              <tr>
                <td className="text-center text-slate-500" colSpan={columns.length}>No report data found</td>
              </tr>
            )}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
