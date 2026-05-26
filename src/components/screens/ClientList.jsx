import { Download, Pencil, Search, Trash2, Upload } from "lucide-react";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
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
  client: "",
  group: "",
  compliance: "",
  contact: "",
};
const PAGE_SIZE = 20;

export default function ClientList() {
  const { state } = useApp();
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { fetchClients, deleteClient, exportClients } = useClients();
  const [query, setQuery] = useState(searchParams.get("search") || "");
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ total: 0, page: 1, pages: 1 });
  const [columnFilters, setColumnFilters] = useState(EMPTY_COLUMN_FILTERS);
  const [drawerClientId, setDrawerClientId] = useState(null);
  const canManage = canManageClients(currentUser?.role);
  const canCreate = canCreateClients(currentUser?.role);
  const clientsLoading = Boolean(state.loading.clients);
  const clientError = state.errors.clients;
  const deferredQuery = useDeferredValue(query);
  const deferredColumnFilters = useDeferredValue(columnFilters);

  const requestParams = useMemo(() => ({
    page,
    limit: PAGE_SIZE,
    search: deferredQuery.trim() || undefined,
    client: deferredColumnFilters.client.trim() || undefined,
    group: deferredColumnFilters.group.trim() || undefined,
    compliance: deferredColumnFilters.compliance.trim() || undefined,
    contact: deferredColumnFilters.contact.trim() || undefined,
  }), [deferredColumnFilters, deferredQuery, page]);

  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      fetchClients(requestParams)
        .then((data) => {
          if (!active) return;
          setMeta({
            total: data?.total || 0,
            page: data?.page || 1,
            pages: data?.pages || 1,
          });
        })
        .catch(() => {});
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [fetchClients, requestParams]);

  const hasColumnFilters = Object.values(columnFilters).some(Boolean);
  const hasActiveFilters = Boolean(query.trim()) || hasColumnFilters;
  const updateColumnFilter = (key, value) => {
    setPage(1);
    setColumnFilters((current) => ({ ...current, [key]: value }));
  };
  const rows = state.clients;
  const exportCsv = async () => downloadBlob(await exportClients({
    search: deferredQuery.trim() || undefined,
    client: deferredColumnFilters.client.trim() || undefined,
    group: deferredColumnFilters.group.trim() || undefined,
    compliance: deferredColumnFilters.compliance.trim() || undefined,
    contact: deferredColumnFilters.contact.trim() || undefined,
  }), "clients.csv");

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
            onChange={(e) => {
              setPage(1);
              setQuery(e.target.value);
            }}
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
                <input
                  aria-label="Filter by client"
                  className="input h-8 min-w-36"
                  type="search"
                  value={columnFilters.client}
                  onChange={(e) => updateColumnFilter("client", e.target.value)}
                />
              </th>
              <th>
                <input
                  aria-label="Filter by group"
                  className="input h-8 min-w-28"
                  type="search"
                  value={columnFilters.group}
                  onChange={(e) => updateColumnFilter("group", e.target.value)}
                />
              </th>
              <th>
                <input
                  aria-label="Filter by compliance"
                  className="input h-8 min-w-36"
                  type="search"
                  value={columnFilters.compliance}
                  onChange={(e) => updateColumnFilter("compliance", e.target.value)}
                />
              </th>
              <th>
                <input aria-label="Filter by contact details" className="input h-8 min-w-36" type="search" value={columnFilters.contact} onChange={(e) => updateColumnFilter("contact", e.target.value)} />
              </th>
              {canManage && (
                <th>
                  {hasActiveFilters && <Button size="sm" variant="ghost" onClick={() => {
                    setPage(1);
                    setQuery("");
                    setColumnFilters(EMPTY_COLUMN_FILTERS);
                  }}>Clear</Button>}
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {clientsLoading && (
              <tr>
                <td colSpan={canManage ? 5 : 4} className="py-8 text-center font-semibold text-slate-500">
                  Loading clients...
                </td>
              </tr>
            )}
            {!clientsLoading && clientError && (
              <tr>
                <td colSpan={canManage ? 5 : 4} className="py-8 text-center font-semibold text-red-600">
                  {String(clientError)}
                </td>
              </tr>
            )}
            {!clientsLoading && !clientError && !rows.length && (
              <tr>
                <td colSpan={canManage ? 5 : 4} className="py-8 text-center font-semibold text-slate-500">
                  No clients match the current search or filters.
                </td>
              </tr>
            )}
            {!clientsLoading && !clientError && rows.map((client) => (
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
                              if (rows.length === 1 && page > 1) {
                                setPage((current) => Math.max(1, current - 1));
                              } else {
                                const data = await fetchClients(requestParams);
                                setMeta({
                                  total: data?.total || 0,
                                  page: data?.page || 1,
                                  pages: data?.pages || 1,
                                });
                              }
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
      {meta.pages > 1 && (
        <Card className="px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-[12px] font-semibold text-slate-500">
              Showing {Math.max(1, (meta.page - 1) * PAGE_SIZE + 1)} to {Math.min(meta.page * PAGE_SIZE, meta.total)} of {meta.total} clients
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={meta.page <= 1}>
                Previous
              </Button>
              <span className="text-[12px] font-semibold text-slate-500">Page {meta.page} of {meta.pages}</span>
              <Button variant="ghost" size="sm" onClick={() => setPage((current) => Math.min(meta.pages || 1, current + 1))} disabled={meta.page >= meta.pages}>
                Next
              </Button>
            </div>
          </div>
        </Card>
      )}
      {drawerClientId && <ClientDrawer clientId={drawerClientId} onClose={() => setDrawerClientId(null)} />}
    </div>
  );
}
