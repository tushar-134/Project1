import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../../context/AppContext.jsx";
import { useTasks } from "../../hooks/useTasks";
import Badge from "../ui/Badge.jsx";
import Button from "../ui/Button.jsx";
import Card from "../ui/Card.jsx";
import Table from "../ui/Table.jsx";

const filters = ["All", "VAT Refund", "CT Registration", "VAT Registration", "Other"];
const statuses = ["In Review", "Additional Query From FTA", "Approved"];

export default function FtaTracker() {
  const { state } = useApp();
  const navigate = useNavigate();
  const { fetchFtaTracker, updateFtaStatus } = useTasks();
  const [filter, setFilter] = useState("All");

  useEffect(() => {
    fetchFtaTracker(filter === "All" ? {} : { category: filter.includes("CT") ? "CT" : "VAT" }).catch(() => {});
  }, [filter]);

  const rows = state.ftaItems.filter((item) => filter === "All" || item.type.includes(filter));

  return (
    <div className="space-y-5">
      <div>
        <div className="page-kicker">FTA Response Queue</div>
        <h2 className="screen-title">FTA Tracker - Submissions Awaiting FTA Response</h2>
      </div>
      <div className="flex flex-wrap gap-2">
        {filters.map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={`rounded-full px-3 py-2 text-[12px] font-extrabold ${filter === f ? "bg-[#1e3a8a] text-white" : "border border-[#e2e8f0] bg-white text-slate-600"}`}>
            {f}
          </button>
        ))}
      </div>
      <Card>
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
              <th>Edit</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((item) => (
              <tr key={item.id} className={item.status === "Additional Query From FTA" ? "bg-yellow-50" : ""}>
                <td className="font-extrabold text-[#1e3a8a]">{item.taskId}</td>
                <td>{item.client}</td>
                <td><Badge>{item.category}</Badge></td>
                <td>{item.type}</td>
                <td>
                  <div>{item.dueDate}</div>
                  {item.overdueDays > 0 && <span className="mt-1 inline-flex rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-extrabold text-[#dc2626]">{item.overdueDays}d overdue</span>}
                </td>
                <td>{item.submitted || "-"}</td>
                <td>{item.assigned}</td>
                <td>
                  <select id={`fta-status-${item.id}`} name={`ftaStatus${item.id}`} className="input h-8 min-w-48" value={item.status} onChange={(e) => updateFtaStatus(item.id, e.target.value).catch(() => fetchFtaTracker())}>
                    {statuses.map((s) => <option key={s}>{s}</option>)}
                  </select>
                </td>
                <td>{item.recurring && <span className="rounded-full bg-blue-50 px-2 py-1 text-[11px] font-extrabold text-[#1e3a8a]">Recurring</span>}</td>
                <td><Button size="sm" variant="ghost" onClick={() => navigate(`/tasks/edit/${item.id}`)}>Edit</Button></td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
