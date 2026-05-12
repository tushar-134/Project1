import { Download, Pencil, Search, Trash2, Upload } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../../context/AppContext.jsx";
import { useClients } from "../../hooks/useClients";
import { downloadBlob } from "../../utils/adapterUtils";
import Badge from "../ui/Badge.jsx";
import Button from "../ui/Button.jsx";
import Card from "../ui/Card.jsx";
import Table from "../ui/Table.jsx";

export default function ClientList() {
  const { state } = useApp();
  const navigate = useNavigate();
  const { fetchClients, deleteClient, exportClients } = useClients();
  const [query, setQuery] = useState("");
  useEffect(() => {
    // Search is debounced so the list does not issue a request on every keystroke.
    const timer = setTimeout(() => fetchClients({ search: query, page: 1, limit: 20 }).catch(() => {}), 400);
    return () => clearTimeout(timer);
  }, [query]);
  const rows = state.clients;
  const exportCsv = async () => downloadBlob(await exportClients(), "clients.csv");
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><div className="page-kicker">Client Directory</div><h2 className="screen-title">Client List</h2></div><div className="flex gap-2"><Button variant="ghost" onClick={() => navigate("/clients/bulk-upload")}><Upload size={16} />Import</Button><Button variant="ghost" onClick={exportCsv}><Download size={16} />Export</Button></div></div>
      <Card className="p-3"><div className="relative"><Search className="absolute left-3 top-2.5 text-slate-400" size={16} /><input id="client-search" name="clientSearch" className="input pl-9" placeholder="Search by name, TRN, trade licence, group" value={query} onChange={(e) => setQuery(e.target.value)} /></div></Card>
      <Card><Table><thead><tr><th>Name + Jurisdiction</th><th>Type</th><th>Group</th><th>Trade Licence No.</th><th>VAT TRN</th><th>Primary Contact</th><th>Mobile</th><th>Email</th><th>Actions</th></tr></thead><tbody>{rows.map((client) => <tr key={client.id}><td><div className="font-extrabold">{client.name}</div><div className="text-[12px] font-semibold text-slate-500">{client.jurisdiction}</div></td><td><Badge color={client.type === "Legal Person" ? "bg-blue-50 text-[#1e3a8a]" : "bg-emerald-50 text-[#059669]"}>{client.type}</Badge></td><td>{client.group ? <span className="rounded-full bg-purple-50 px-2 py-1 text-[11px] font-extrabold text-[#7c3aed]">{client.group}</span> : "—"}</td><td>{client.licence}</td><td>{client.vatTrn || "—"}</td><td>{client.contact}</td><td>{client.mobile}</td><td>{client.email}</td><td><div className="flex gap-1"><Button size="sm" variant="ghost" onClick={() => navigate(`/clients/edit/${client.id}`)}><Pencil size={14} /></Button><Button size="sm" variant="danger" onClick={async () => { if (confirm("Delete client?")) { await deleteClient(client._id); fetchClients(); } }}><Trash2 size={14} /></Button></div></td></tr>)}</tbody></Table></Card>
    </div>
  );
}
