import { Activity, Clock, FileText, ListChecks, User, Users } from "lucide-react";
import { useEffect } from "react";
import { useApp } from "../../context/AppContext.jsx";
import { reportService } from "../../services/reportService";
import Card from "../ui/Card.jsx";
import Table from "../ui/Table.jsx";

const tiles = [["Login Activity", User], ["Task Activity", Activity], ["Client-wise Report", Users], ["User-wise Report", ListChecks], ["Overdue Report", Clock], ["FTA Tracker Report", FileText]];

export default function Reports() {
  const { state, dispatch } = useApp();
  useEffect(() => { reportService.taskActivity().then((activity) => dispatch({ type: "SET_RESOURCE", resource: "activity", payload: activity })).catch(() => {}); }, []);
  const loadReport = (name) => {
    // Report tiles funnel into one shared table, so each endpoint result is normalized just enough for that surface.
    const calls = { "Login Activity": reportService.loginActivity, "Task Activity": reportService.taskActivity, "Client-wise Report": reportService.clientWise, "User-wise Report": reportService.userWise, "Overdue Report": reportService.overdue, "FTA Tracker Report": reportService.ftaTracker };
    calls[name]?.().then((data) => dispatch({ type: "SET_RESOURCE", resource: "activity", payload: Array.isArray(data) ? data : data.tasks || [] })).catch(() => {});
  };
  return <div className="space-y-5"><div><div className="page-kicker">Insights</div><h2 className="screen-title">Reports</h2></div><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{tiles.map(([name, Icon]) => <Card key={name} className="cursor-pointer p-4 transition hover:-translate-y-0.5 hover:shadow-md" onClick={() => loadReport(name)}><Icon className="mb-3 text-[#1e3a8a]" size={24} /><div className="font-extrabold">{name}</div><div className="mt-1 text-[12px] font-semibold text-slate-500">Generate and export report</div></Card>)}</div><Card><div className="border-b border-[#e2e8f0] px-4 py-3 text-[14px] font-extrabold">Task Activity Log</div><Table><thead><tr><th>Task ID</th><th>User</th><th>Date & Time</th><th>Client</th><th>Task Name</th><th>Category</th><th>Action</th></tr></thead><tbody>{state.activity.map((a) => <tr key={a._id || `${a.taskId}${a.date}`}><td className="font-extrabold text-[#1e3a8a]">{a.task?.taskId || a.taskId || a.client?.fileNo || "—"}</td><td>{a.user?.name || a.user?.email || a.user || "—"}</td><td>{a.createdAt || a.date || "—"}</td><td>{a.task?.client?.legalName || a.client?.legalName || a.client || "—"}</td><td>{a.task?.taskType || a.task || "—"}</td><td>{a.task?.category || a.category || "—"}</td><td>{a.action || "—"}</td></tr>)}</tbody></Table></Card></div>;
}
