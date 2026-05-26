import { Download, Pencil, Search, Trash2, Upload } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../../context/AppContext.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { useClients } from "../../hooks/useClients";
import { downloadBlob } from "../../utils/adapterUtils";
import { canCreateClients, canManageClients } from "../../utils/permissions.js";
import Badge from "../ui/Badge.jsx";
import Button from "../ui/Button.jsx";
import Card from "../ui/Card.jsx";
import ClientDrawer from "../ui/ClientDrawer.jsx";
import Table from "../ui/Table.jsx";

const EMPTY_COLUMN_FILTERS = {
  group: "",
  contact: "",
};

export default function ClientList() {
  const { state } = useApp();
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const { fetchClients, deleteClient, exportClients } = useClients();
  const [query, setQuery] = useState("");
  const [columnFilters, setColumnFilters] = useState(EMPTY_COLUMN_FILTERS);
  const [drawerClientId, setDrawerClientId] = useState(null);
  const canManage = canManageClients(currentUser?.role);
  const canCreate = canCreateClients(currentUser?.role);

  useEffect(() => {
    const timer = setTimeout(() => fetchClients({ page: 1, limit: 200 }).catch(() => { }), 400);
    return () => clearTimeout(timer);
  }, [fetchClients]);

  const taskMatches = (value, filter) => String(value || "").toLowerCase().includes(String(filter || "").toLowerCase().trim());
  const filterOptions = (key) => [...new Set(state.clients.map((client) => client[key]).filter(Boolean))].sort();
  const hasColumnFilters = Object.values(columnFilters).some(Boolean);
  const updateColumnFilter = (key, value) => setColumnFilters((current) => ({ ...current, [key]: value }));
  const rows = state.clients.filter((client) => {
    const combinedSearch = [
      client.name,
      client.jurisdiction,
      client.type,
      client.group,
      client.licence,
      client.vatTrn,
      client.contact,
      client.mobile,
      client.email,
    ].join(" ");
    if (query && !taskMatches(combinedSearch, query)) return false;
    if (columnFilters.group && client.group !== columnFilters.group) return false;
    if (!taskMatches([client.contact, client.mobile, client.email].join(" "), columnFilters.contact)) return false;
    return true;
  });
  const exportCsv = async () => downloadBlob(await exportClients(), "clients.csv");

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="page-kicker">Client Directory</div>
          <h2 className="screen-title">Client List</h2>
        </div>
        {canManage && (
          <div className="flex gap-2">
            {canCreate && (
              <Button variant="ghost" onClick={() => navigate("/clients/bulk-upload")}>
                <Upload size={16} />
                Import
              </Button>
            )}
            <Button variant="ghost" onClick={exportCsv}>
              <Download size={16} />
              Export
            </Button>
          </div>
        )}
      </div>

      <Card className="p-3">
        <div className="relative">
          <Search className="absolute left-5 top-2.5 text-slate-400" size={16} />
          <input
            id="client-search"
            name="clientSearch"
            className="input pl-12"
            type="search"
            placeholder="Search by name, jurisdiction, type, group, trade licence, TRN, contact, mobile, email"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </Card>

      <Card>
        <Table>
          <thead>
            <tr>
              <th>Client</th>
              <th>Group</th>
              <th>Compliance</th>
              <th>Contact Details</th>
              {canManage && <th>Actions</th>}
            </tr>
            <tr>
              <th>
                <div className="text-[11px] font-semibold normal-case text-slate-400">
                  Search above for name, jurisdiction, type
                </div>
              </th>
              <th>
                <select
                  aria-label="Filter by group"
                  className="input h-8 min-w-28"
                  value={columnFilters.group}
                  onChange={(e) => updateColumnFilter("group", e.target.value)}
                >
                  <option value="">All</option>
                  {filterOptions("group").map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </th>
              <th>
                <div className="text-[11px] font-semibold normal-case text-slate-400">
                  Search above for licence, TRN
                </div>
              </th>
              <th>
                <input aria-label="Filter by contact details" className="input h-8 min-w-36" type="search" value={columnFilters.contact} onChange={(e) => updateColumnFilter("contact", e.target.value)} />
              </th>
              {canManage && (
                <th>
                  {hasColumnFilters && <Button size="sm" variant="ghost" onClick={() => setColumnFilters(EMPTY_COLUMN_FILTERS)}>Clear</Button>}
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {!rows.length && (
              <tr>
                <td colSpan={canManage ? 5 : 4} className="py-8 text-center font-semibold text-slate-500">
                  No clients match the current search or filters.
                </td>
              </tr>
            )}
            {rows.map((client) => (
              <tr key={client.id}>
                <td>
                  <button
                    type="button"
                    className="task-id-link font-extrabold text-left"
                    onClick={() => setDrawerClientId(client.id)}
                    title="Open client details"
                  >
                    {client.name}
                  </button>
                  <div className="mt-1 flex flex-wrap gap-2">
                    <span className="text-[12px] font-semibold text-slate-500">{client.jurisdiction}</span>
                    <Badge color={client.type === "Legal Person" ? "bg-blue-50 text-[#1e3a8a]" : "bg-emerald-50 text-[#059669]"}>
                      {client.type}
                    </Badge>
                  </div>
                </td>
                <td>{client.group ? <span className="rounded-full bg-purple-50 px-2 py-1 text-[11px] font-extrabold text-[#7c3aed]">{client.group}</span> : "-"}</td>
                <td>
                  <div className="space-y-1">
                    <div><span className="font-semibold text-slate-500">Licence:</span> {client.licence || "-"}</div>
                    <div><span className="font-semibold text-slate-500">VAT TRN:</span> {client.vatTrn || "-"}</div>
                  </div>
                </td>
                <td>
                  <div className="space-y-1">
                    <div><span className="font-semibold text-slate-500">Contact:</span> <span className="font-semibold text-slate-800">{client.contact || "-"}</span></div>
                    <div className="text-[12px] text-slate-500"><span className="font-semibold">Phone No:</span> {client.mobile || "-"}</div>
                    <div className="text-[12px] text-slate-500 break-all"><span className="font-semibold">Email:</span> {client.email || "-"}</div>
                  </div>
                </td>
                {canManage && (
                  <td>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => navigate(`/clients/edit/${client.id}`)}>
                        <Pencil size={14} />
                      </Button>
                      {currentUser?.role === "admin" && (
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={async () => {
                            if (confirm("Delete client?")) {
                              await deleteClient(client._id);
                              fetchClients();
                            }
                          }}
                        >
                          <Trash2 size={14} />
                        </Button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
      {drawerClientId && <ClientDrawer clientId={drawerClientId} onClose={() => setDrawerClientId(null)} />}
    </div>
  );
}
