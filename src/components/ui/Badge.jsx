const colors = {
  VAT: "bg-sky-50 text-[#0ea5e9]",
  "Corporate Tax": "bg-purple-50 text-[#7c3aed]",
  CT: "bg-purple-50 text-[#7c3aed]",
  Audit: "bg-emerald-50 text-[#059669]",
  Accounting: "bg-orange-50 text-[#ea580c]",
  "MIS Reporting": "bg-blue-50 text-[#1e3a8a]",
  "E-Invoicing": "bg-sky-50 text-[#0ea5e9]",
  Other: "bg-slate-100 text-[#64748b]",
};
export default function Badge({ children, color, className = "" }) {
  // Category badges accept either a known label or an explicit override so API data and legacy labels can coexist.
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-extrabold ${color || colors[children] || "bg-slate-100 text-slate-600"} ${className}`}>{children}</span>;
}
