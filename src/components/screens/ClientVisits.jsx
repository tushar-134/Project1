import { Briefcase, ChevronDown, CircleChevronRight, Download, Upload, Plus, Search, SquarePen, ArrowUp, ArrowDown } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { useAuth } from "../../context/AuthContext.jsx";
import { useApp } from "../../context/AppContext.jsx";
import { clientVisitService } from "../../services/clientVisitService.js";
import { downloadBlob } from "../../utils/adapterUtils.js";
import { toSentenceCase } from "../../utils/textCase";
import { canManageClientVisits } from "../../utils/permissions.js";
import Button from "../ui/Button.jsx";
import Card from "../ui/Card.jsx";
import ClientComboBox from "../ui/ClientComboBox.jsx";
import ClientVisitDrawer from "../ui/ClientVisitDrawer.jsx";
import ClientVisitHistoryDrawer from "../ui/ClientVisitHistoryDrawer.jsx";
import ExportModal from "../ui/ExportModal.jsx";
import StatusPill from "../ui/StatusPill.jsx";
import Table from "../ui/Table.jsx";

const statusOptions = [
  { value: "all", label: "All statuses" },
  { value: "planned", label: "Planned" },
  { value: "in_progress", label: "In progress" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

const visitTypeOptions = ["All Types", "Monthly Visit", "General Meeting"];

const clientTypeOptions = [
  { value: "all", label: "All clients" },
  { value: "new", label: "New clients" },
  { value: "existing", label: "Existing clients" },
];

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("en-GB");
}

function titleStatus(value) {
  return String(value || "")
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function sortParam(sort) {
  return {
    sortBy: sort.key,
    sortDir: sort.direction,
  };
}

export default function ClientVisits() {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { state } = useApp();
  const canManage = canManageClientVisits(currentUser?.role);
  const [activeTab, setActiveTab] = useState("all");
  const [filters, setFilters] = useState({
    status: "all",
    clientType: "all",
    visitType: "all",
    clientName: "",
    fromDate: "",
    toDate: "",
  });
  const [exportOpen, setExportOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [visits, setVisits] = useState([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, pages: 1 });
  const [visitTypes, setVisitTypes] = useState([]);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState({ key: "visitDate", direction: "desc" });
  const [drawerVisitId, setDrawerVisitId] = useState(null);
  const [historyClient, setHistoryClient] = useState(null);
  const exportRef = useRef(null);

  const BASE_EXPORT_FIELDS = [
    { key: "visitId", label: "Visit ID" },
    { key: "clientName", label: "Client Name" },
    { key: "clientType", label: "Client Type" },
    { key: "visitDate", label: "Visit Date" },
    { key: "visitTime", label: "Visit Time" },
    { key: "visitType", label: "Visit Type" },
    { key: "location", label: "Location" },
    { key: "status", label: "Status" },
    { key: "assignedUsers", label: "Assigned Users" },
    { key: "teamLead", label: "Team Lead" },
    { key: "checkInStatus", label: "Check-In Status" },
    { key: "checkOutStatus", label: "Check-Out Status" },
    { key: "createdBy", label: "Created By" },
    { key: "remarks", label: "Remarks" },
  ];

  const params = useMemo(() => ({
    page,
    limit: 10,
    status: filters.status,
    clientType: filters.clientType,
    visitType: filters.visitType,
    clientName: filters.clientName,
    fromDate: filters.fromDate,
    toDate: filters.toDate,
    ...sortParam(sort),
  }), [filters, page, sort]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    clientVisitService.list(params)
      .then((data) => {
        if (!active) return;
        setVisits(data.items || []);
        setMeta({ total: data.total || 0, page: data.page || 1, pages: data.pages || 1 });
        setVisitTypes(data.visitTypes || []);
      })
      .catch(() => {
        if (active) toast.error("Unable to load client visits.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [params]);

  useEffect(() => {
    function closeExportMenu(event) {
      if (exportRef.current && !exportRef.current.contains(event.target)) {
        setExportOpen(false);
      }
    }
    document.addEventListener("pointerdown", closeExportMenu);
    return () => document.removeEventListener("pointerdown", closeExportMenu);
  }, []);

  function updateFilter(key, value) {
    setPage(1);
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function handleTabChange(tab) {
    setActiveTab(tab);
    setPage(1);
    if (tab === "all") setFilters((current) => ({ ...current, status: "all" }));
    if (tab === "scheduled") setFilters((current) => ({ ...current, status: "planned" }));
    if (tab === "past") setFilters((current) => ({ ...current, status: "completed,cancelled" }));
  }

  function toggleSort(key) {
    setSort((current) => current.key === key
      ? { key, direction: current.direction === "asc" ? "desc" : "asc" }
      : { key, direction: "asc" });
  }

  async function exportVisits(format) {
    try {
      setExportOpen(false);
      const blob = await clientVisitService.export({ ...params, format });
      downloadBlob(blob, format === "pdf" ? "client-visits.pdf" : "client-visits.xlsx");
    } catch {
      toast.error("Unable to export client visits.");
    }
  }

  const exportAll = async () => {
    try {
      setIsExportModalOpen(false);
      const blob = await clientVisitService.export({ ...params, format: "xlsx", mode: "all" });
      downloadBlob(blob, "client-visits-all.xlsx");
    } catch {
      toast.error("Unable to export client visits.");
    }
  };

  const exportSelected = async (selectedKeys) => {
    try {
      setIsExportModalOpen(false);
      const blob = await clientVisitService.export({ ...params, format: "xlsx", columns: selectedKeys.join(",") || undefined });
      downloadBlob(blob, "client-visits-selected.xlsx");
    } catch {
      toast.error("Unable to export client visits.");
    }
  };

  function handleVisitUpdated(updatedVisit) {
    setVisits((current) => current.map((visit) => (visit._id === updatedVisit._id ? updatedVisit : visit)));
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-6 border-b border-slate-200">
        <button
          type="button"
          onClick={() => handleTabChange("all")}
          className={`pb-3 text-[14px] font-extrabold transition-colors ${activeTab === "all" ? "border-b-2 border-blue-600 text-blue-600" : "border-b-2 border-transparent text-slate-500 hover:text-slate-700"}`}
        >
          All Visits
        </button>
        <button
          type="button"
          onClick={() => handleTabChange("scheduled")}
          className={`pb-3 text-[14px] font-extrabold transition-colors ${activeTab === "scheduled" ? "border-b-2 border-blue-600 text-blue-600" : "border-b-2 border-transparent text-slate-500 hover:text-slate-700"}`}
        >
          Scheduled Visits
        </button>
        <button
          type="button"
          onClick={() => handleTabChange("past")}
          className={`pb-3 text-[14px] font-extrabold transition-colors ${activeTab === "past" ? "border-b-2 border-blue-600 text-blue-600" : "border-b-2 border-transparent text-slate-500 hover:text-slate-700"}`}
        >
          Past Visits
        </button>
      </div>

      <Card className="p-5">
        <div className="grid items-end gap-3 xl:grid-cols-[1fr_1fr_1.25fr_1fr_1fr_auto]">

          <FilterField label="Visit Type">
            <select className="input" value={filters.visitType} onChange={(event) => updateFilter("visitType", event.target.value)}>
              {visitTypeOptions.map((option) => (
                <option key={option} value={option === "All Types" ? "all" : option}>
                  {toSentenceCase(option)}
                </option>
              ))}
              {visitTypes
                .filter((option) => !visitTypeOptions.includes(option))
                .map((option) => <option key={option} value={option}>{toSentenceCase(option)}</option>)}
            </select>
          </FilterField>

          <FilterField label="Client Type">
            <select className="input" value={filters.clientType} onChange={(event) => updateFilter("clientType", event.target.value)}>
              {clientTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </FilterField>

          <FilterField label="Client Name">
            <ClientComboBox
              clients={state.clients}
              value={filters.clientName}
              onChange={(val) => updateFilter("clientName", val)}
              useNameAsValue={true}
              inputId="visits-filter-client"
              placeholder="Search client..."
            />
          </FilterField>

          <FilterField label="From Date">
            <input className="input" type="date" value={filters.fromDate} onChange={(event) => updateFilter("fromDate", event.target.value)} />
          </FilterField>

          <FilterField label="To Date">
            <input className="input" type="date" value={filters.toDate} onChange={(event) => updateFilter("toDate", event.target.value)} />
          </FilterField>

          <div className="flex shrink-0 items-center gap-2 xl:justify-end">
            <div ref={exportRef} className="relative">
              <Button variant="outlinePurple" onClick={() => setExportOpen((open) => !open)}>
                <Upload size={16} />
                Export
                <ChevronDown size={14} className={`transition ${exportOpen ? "rotate-180" : ""}`} />
              </Button>
              {exportOpen && (
                <div className="absolute right-0 top-full z-30 mt-2 w-40 rounded-xl border border-[#e2e8f0] bg-white p-1 shadow-xl shadow-slate-200">
                  <button
                    type="button"
                    onClick={() => { setExportOpen(false); setIsExportModalOpen(true); }}
                    className="flex w-full items-center rounded-lg px-3 py-2 text-left text-[13px] font-bold text-slate-700 hover:bg-slate-50"
                  >
                    Excel
                  </button>
                  <button
                    type="button"
                    onClick={() => exportVisits("pdf")}
                    className="flex w-full items-center rounded-lg px-3 py-2 text-left text-[13px] font-bold text-slate-700 hover:bg-slate-50"
                  >
                    PDF
                  </button>
                </div>
              )}
            </div>
            <Button onClick={() => navigate("/client-visits/new")}>
              <Plus size={16} />
              New Visit
            </Button>
          </div>
        </div>
      </Card>

      <Card>
        <Table>
          <thead>
            <tr>
              <SortableHeader label="Visit ID" onClick={() => toggleSort("visitId")} sortKey="visitId" currentSort={sort} />
              <SortableHeader label="Client" onClick={() => toggleSort("client")} sortKey="client" currentSort={sort} />
              <SortableHeader label="Schedule" onClick={() => toggleSort("visitDate")} sortKey="visitDate" currentSort={sort} />
              <SortableHeader label="Type" onClick={() => toggleSort("type")} sortKey="type" currentSort={sort} />
              <th>Visited By</th>
              <SortableHeader label="Status" onClick={() => toggleSort("status")} sortKey="status" currentSort={sort} />
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {visits.map((visit) => (
              <tr key={visit._id}>
                <td>
                  <button
                    type="button"
                    className="task-id-link"
                    onClick={() => setDrawerVisitId(visit._id)}
                  >
                    {visit.visitId}
                  </button>
                </td>
                <td>
                  {visit.client?._id ? (
                    <button
                      type="button"
                      className="group inline-flex items-center gap-2 text-left font-black text-[#1e3a8a] hover:underline cursor-pointer"
                      onClick={() => setHistoryClient({ id: visit.client._id, name: visit.clientName })}
                    >
                      <span>{visit.clientName}</span>
                      <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#1e3a8a] text-white shadow-sm transition group-hover:bg-[#172d6b] group-hover:translate-x-0.5">
                        <CircleChevronRight size={16} strokeWidth={2.5} />
                      </span>
                    </button>
                  ) : (
                    <div className="font-black text-slate-900">{visit.clientName}</div>
                  )}
                  <div className="mt-1 text-[12px] font-semibold text-slate-500">{visit.clientLocation || "-"}</div>
                </td>
                <td>
                  <div className="font-black text-slate-900">{formatDate(visit.visitDate)}</div>
                  <div className="mt-1 text-[12px] font-semibold text-slate-500">{visit.visitTime || "-"}</div>
                </td>
                <td className="font-bold text-slate-700">{visit.visitType || "-"}</td>
                <td>
                  <TeamPreview entries={visit.assignedUsers || []} />
                </td>
                <td>
                  <StatusPill status={titleStatus(visit.status)} />
                </td>
                <td>
                  <div className="flex items-center gap-2">
                    {canManage && (
                      <button
                        type="button"
                        className="grid h-10 w-10 place-items-center rounded-xl border border-[#dbe4f0] bg-white text-slate-500 transition hover:bg-slate-50 hover:text-slate-700"
                        onClick={() => navigate(`/client-visits/${visit._id}/edit`)}
                        title="Edit visit"
                      >
                        <SquarePen size={16} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}

            {!loading && !visits.length && (
              <tr>
                <td colSpan="7" className="py-10 text-center text-[13px] font-semibold text-slate-500">
                  No client visits found for the selected filters.
                </td>
              </tr>
            )}
          </tbody>
        </Table>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#e2e8f0] px-4 py-3">
          <div className="text-[12px] font-semibold text-slate-500">
            Showing page {meta.page} of {meta.pages} ({meta.total} total visits)
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={meta.page <= 1}>
              Previous
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setPage((current) => Math.min(meta.pages || 1, current + 1))} disabled={meta.page >= meta.pages}>
              Next
            </Button>
          </div>
        </div>
      </Card>

      <ClientVisitDrawer
        visitId={drawerVisitId}
        canManage={canManage}
        onClose={() => setDrawerVisitId(null)}
        onVisitUpdated={handleVisitUpdated}
      />

      <ClientVisitHistoryDrawer
        clientId={historyClient?.id}
        clientName={historyClient?.name}
        onClose={() => setHistoryClient(null)}
        onVisitClick={(visitId) => {
          setHistoryClient(null);
          setDrawerVisitId(visitId);
        }}
      />

      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        title="Export Client Visits"
        entityName="visits"
        baseFields={BASE_EXPORT_FIELDS}
        onExportAll={exportAll}
        onExportSelected={exportSelected}
      />
    </div>
  );
}

function FilterField({ label, children, className = "" }) {
  return (
    <label className={`space-y-2 ${className}`}>
      <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">{label}</span>
      {children}
    </label>
  );
}

function SortableHeader({ label, sortKey, currentSort, onClick }) {
  const isSorted = currentSort?.key === sortKey;
  return (
    <th>
      <button type="button" className="font-inherit group inline-flex items-center gap-1.5 text-left hover:text-slate-900" onClick={onClick}>
        {label}
        <span className={`text-slate-400 transition-opacity ${isSorted ? "opacity-100" : "opacity-0 group-hover:opacity-50"}`}>
          {isSorted && currentSort?.direction === "desc" ? <ArrowDown size={14} /> : <ArrowUp size={14} />}
        </span>
      </button>
    </th>
  );
}

function TeamPreview({ entries = [] }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);
  const users = entries
    .filter((entry) => entry.checkInAt || entry.checkOutAt || String(entry.visitSummary || "").trim())
    .map((entry) => entry.user)
    .filter(Boolean);
  const firstUser = users[0];
  const remainingUsers = users.slice(1);

  useEffect(() => {
    function closeMenu(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", closeMenu);
    return () => document.removeEventListener("pointerdown", closeMenu);
  }, []);

  if (!firstUser) {
    return <span className="text-[12px] italic text-slate-400">Not visited</span>;
  }

  return (
    <div className="flex items-center gap-1.5">
      <div className="flex h-6 w-6 items-center justify-center rounded-md bg-blue-50 text-blue-600">
        <Briefcase size={12} />
      </div>
      <span className="max-w-[120px] truncate text-[13px] font-bold text-slate-700">
        {firstUser.name || firstUser.email || "User"}
      </span>

      {remainingUsers.length > 0 && (
        <div ref={menuRef} className="relative">
          <button
            type="button"
            className={`flex h-5 items-center rounded-full border px-1.5 text-[10px] font-black transition-all ${
              open
                ? "border-blue-600 bg-blue-600 text-white shadow-sm shadow-blue-200"
                : "border-slate-200 bg-slate-100 text-slate-500 hover:border-slate-300 hover:bg-slate-200"
            }`}
            onClick={(event) => {
              event.stopPropagation();
              setOpen((current) => !current);
            }}
          >
            +{remainingUsers.length}
          </button>

          {open && (
            <div className="absolute left-0 top-full z-[100] mt-2 w-56 rounded-2xl border border-slate-100 bg-white p-3 shadow-xl shadow-slate-200/70">
              <div className="mb-2 flex items-center justify-between border-b border-slate-50 pb-2">
                <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">Other Users</span>
                <span className="rounded-md bg-blue-50 px-1.5 py-0.5 text-[10px] font-black text-blue-600">{remainingUsers.length} More</span>
              </div>
              <div className="max-h-40 overflow-y-auto pr-1">
                <div className="grid gap-1.5">
                  {remainingUsers.map((user, index) => (
                    <div key={user._id || user.id || user.email || index} className="flex items-center gap-2 rounded-xl border border-slate-50 bg-slate-50/30 p-2 transition-colors hover:border-blue-100 hover:bg-blue-50/30">
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-slate-100 bg-white text-[10px] font-black text-slate-400 shadow-sm">
                        {(user.name || user.email || "U").charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[11px] font-extrabold text-slate-700">{user.name || "Unnamed user"}</div>
                        {user.email && <div className="truncate text-[9px] font-bold text-slate-400">{user.email}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="absolute -top-1 left-4 h-2 w-2 rotate-45 border-l border-t border-slate-100 bg-white"></div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
