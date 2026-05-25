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
import Table from "../ui/Table.jsx";

const EMPTY_COLUMN_FILTERS = {
  name: "",
  jurisdiction: "",
  type: "",
  group: "",
  licence: "",
  vatTrn: "",
  contact: "",
  mobile: "",
  email: "",
};

export default function ClientList() {
  const { state } = useApp();
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const { fetchClients, deleteClient, exportClients } = useClients();
  const [query, setQuery] = useState("");
  const [columnFilters, setColumnFilters] = useState(EMPTY_COLUMN_FILTERS);
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
    if (!taskMatches(client.name, columnFilters.name)) return false;
    if (columnFilters.jurisdiction && client.jurisdiction !== columnFilters.jurisdiction) return false;
    if (columnFilters.type && client.type !== columnFilters.type) return false;
    if (columnFilters.group && client.group !== columnFilters.group) return false;
    if (!taskMatches(client.licence, columnFilters.licence)) return false;
    if (!taskMatches(client.vatTrn, columnFilters.vatTrn)) return false;
    if (!taskMatches(client.contact, columnFilters.contact)) return false;
    if (!taskMatches(client.mobile, columnFilters.mobile)) return false;
    if (!taskMatches(client.email, columnFilters.email)) return false;
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
              <th>Name + Jurisdiction</th>
              <th>Type</th>
              <th>Group</th>
              <th>Trade Licence No.</th>
              <th>VAT TRN</th>
              <th>Primary Contact</th>
              <th>Mobile</th>
              <th>Email</th>
              {canManage && <th>Actions</th>}
            </tr>
            <tr>
              <th>
                <input
                  aria-label="Filter by client name"
                  className="input h-8 min-w-40"
                  type="search"
                  value={columnFilters.name}
                  onChange={(e) => updateColumnFilter("name", e.target.value)}
                />
                <select
                  aria-label="Filter by jurisdiction"
                  className="input mt-2 h-8 min-w-40"
                  value={columnFilters.jurisdiction}
                  onChange={(e) => updateColumnFilter("jurisdiction", e.target.value)}
                >
                  <option value="">All jurisdictions</option>
                  {filterOptions("jurisdiction").map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </th>
              <th>
                <select
                  aria-label="Filter by client type"
                  className="input h-8 min-w-32"
                  value={columnFilters.type}
                  onChange={(e) => updateColumnFilter("type", e.target.value)}
                >
                  <option value="">All</option>
                  {filterOptions("type").map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </th>
              <th>
                <select
                  aria-label="Filter by group"
                  className="input h-8 min-w-32"
                  value={columnFilters.group}
                  onChange={(e) => updateColumnFilter("group", e.target.value)}
                >
                  <option value="">All</option>
                  {filterOptions("group").map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </th>
              <th>
                <input aria-label="Filter by trade licence" className="input h-8 min-w-32" type="search" value={columnFilters.licence} onChange={(e) => updateColumnFilter("licence", e.target.value)} />
              </th>
              <th>
                <input aria-label="Filter by VAT TRN" className="input h-8 min-w-32" type="search" value={columnFilters.vatTrn} onChange={(e) => updateColumnFilter("vatTrn", e.target.value)} />
              </th>
              <th>
                <input aria-label="Filter by primary contact" className="input h-8 min-w-32" type="search" value={columnFilters.contact} onChange={(e) => updateColumnFilter("contact", e.target.value)} />
              </th>
              <th>
                <input aria-label="Filter by mobile" className="input h-8 min-w-32" type="search" value={columnFilters.mobile} onChange={(e) => updateColumnFilter("mobile", e.target.value)} />
              </th>
              <th>
                <input aria-label="Filter by email" className="input h-8 min-w-32" type="search" value={columnFilters.email} onChange={(e) => updateColumnFilter("email", e.target.value)} />
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
                <td colSpan={canManage ? 9 : 8} className="py-8 text-center font-semibold text-slate-500">
                  No clients match the current search or filters.
                </td>
              </tr>
            )}
            {rows.map((client) => (
              <tr key={client.id}>
                <td>
                  <div className="font-extrabold">{client.name}</div>
                  <div className="text-[12px] font-semibold text-slate-500">{client.jurisdiction}</div>
                </td>
                <td>
                  <Badge color={client.type === "Legal Person" ? "bg-blue-50 text-[#1e3a8a]" : "bg-emerald-50 text-[#059669]"}>
                    {client.type}
                  </Badge>
                </td>
                <td>{client.group ? <span className="rounded-full bg-purple-50 px-2 py-1 text-[11px] font-extrabold text-[#7c3aed]">{client.group}</span> : "-"}</td>
                <td>{client.licence}</td>
                <td>{client.vatTrn || "-"}</td>
                <td>{client.contact}</td>
                <td>{client.mobile}</td>
                <td>{client.email}</td>
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
    </div>
  );
}
