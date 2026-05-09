export const statusClasses = {
  "Not Yet Started": "bg-slate-100 text-slate-600",
  WIP: "bg-sky-50 text-[#0ea5e9]",
  Completed: "bg-emerald-50 text-[#059669]",
  "Submitted to FTA": "bg-yellow-100 text-[#a16207]",
  Approved: "bg-emerald-50 text-[#059669]",
  "Additional Query From FTA": "bg-red-50 text-[#dc2626]",
  "In Review": "bg-sky-50 text-[#0ea5e9]",
};
export default function StatusPill({ status }) {
  // Status labels are presentation-only here; translation from API enums happens in adapterUtils.
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-extrabold ${statusClasses[status] || statusClasses["Not Yet Started"]}`}>{status}</span>;
}
