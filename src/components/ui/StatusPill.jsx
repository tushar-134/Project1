export const statusClasses = {
  "Not yet started": "bg-slate-100 text-slate-600",
  "In progress": "bg-sky-50 text-[#0ea5e9]",
  Completed: "bg-emerald-50 text-[#059669]",
  "Submitted to FTA": "bg-yellow-100 text-[#a16207]",
  Planned: "bg-slate-100 text-slate-700",
  Cancelled: "bg-red-50 text-[#dc2626]",
  Approved: "bg-emerald-50 text-[#059669]",
  "Additional query from FTA": "bg-red-50 text-[#dc2626]",
  "In review": "bg-sky-50 text-[#0ea5e9]",
};

export default function StatusPill({ status }) {
  if (!status) return null;
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-extrabold ${statusClasses[status] || statusClasses["Not yet started"]}`}>{status}</span>;
}
