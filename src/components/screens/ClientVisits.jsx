import { ChevronDown, Download, Plus, Search, SquarePen } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { useAuth } from "../../context/AuthContext.jsx";
import { useApp } from "../../context/AppContext.jsx";
import { clientVisitService } from "../../services/clientVisitService.js";
import { downloadBlob } from "../../utils/adapterUtils.js";
import { canManageClientVisits } from "../../utils/permissions.js";
import Button from "../ui/Button.jsx";
import Card from "../ui/Card.jsx";
import ClientComboBox from "../ui/ClientComboBox.jsx";
import ClientVisitDrawer from "../ui/ClientVisitDrawer.jsx";
import StatusPill from "../ui/StatusPill.jsx";
import Table from "../ui/Table.jsx";
import UserAvatar from "../ui/UserAvatar.jsx";

const statusOptions = [
  { value: "all", label: "All Statuses" },
  { value: "planned", label: "Planned" },
  { value: "in_progress", label: "In Progress" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

const visitTypeOptions = ["All Types", "Requirement Gathering", "Verification", "Onboarding Discussion", "Follow Up", "Collection", "Meeting"];

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
  const [filters, setFilters] = useState({
    status: "all",
    visitType: "all",
    clientName: "",
    fromDate: "",
    toDate: "",
  });
  const [exportOpen, setExportOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [visits, setVisits] = useState([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, pages: 1 });
  const [visitTypes, setVisitTypes] = useState([]);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState({ key: "visitDate", direction: "desc" });
  const [drawerVisitId, setDrawerVisitId] = useState(null);
  const exportRef = useRef(null);

  const params = useMemo(() => ({
    page,
    limit: 10,
    status: filters.status,
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

  function handleVisitUpdated(updatedVisit) {
    setVisits((current) => current.map((visit) => (visit._id === updatedVisit._id ? updatedVisit : visit)));
  }

  return (
    <div className="space-y-5">
      <Card className="p-5">
        <div className="grid items-end gap-3 xl:grid-cols-[1fr_1fr_1.25fr_1fr_1fr_auto]">
          <FilterField label="Status">
            <select className="input" value={filters.status} onChange={(event) => updateFilter("status", event.target.value)}>
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </FilterField>

          <FilterField label="Visit Type">
            <select className="input" value={filters.visitType} onChange={(event) => updateFilter("visitType", event.target.value)}>
              {visitTypeOptions.map((option) => (
                <option key={option} value={option === "All Types" ? "all" : option}>{option}</option>
              ))}
              {visitTypes
                .filter((option) => !visitTypeOptions.includes(option))
                .map((option) => <option key={option} value={option}>{option}</option>)}
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
              <Button variant="ghost" onClick={() => setExportOpen((open) => !open)}>
                <Download size={16} />
                Export
                <ChevronDown size={14} className={`transition ${exportOpen ? "rotate-180" : ""}`} />
              </Button>
              {exportOpen && (
                <div className="absolute right-0 top-full z-30 mt-2 w-40 rounded-xl border border-[#e2e8f0] bg-white p-1 shadow-xl shadow-slate-200">
                  <button
                    type="button"
                    onClick={() => exportVisits("xlsx")}
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
              <SortableHeader label="Visit ID" onClick={() => toggleSort("visitId")} />
              <SortableHeader label="Client" onClick={() => toggleSort("client")} />
              <SortableHeader label="Schedule" onClick={() => toggleSort("visitDate")} />
              <SortableHeader label="Type" onClick={() => toggleSort("type")} />
              <th>Team</th>
              <SortableHeader label="Status" onClick={() => toggleSort("status")} />
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
                  <div className="font-black text-slate-900">{visit.clientName}</div>
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

function SortableHeader({ label, onClick }) {
  return (
    <th>
      <button type="button" className="font-inherit inline-flex items-center gap-1 text-left" onClick={onClick}>
        {label}
      </button>
    </th>
  );
}

function TeamPreview({ entries = [] }) {
  const visible = entries.slice(0, 3);
  const remaining = entries.length - visible.length;
  return (
    <div className="flex items-center">
      <div className="flex -space-x-2">
        {visible.map((entry) => (
          <UserAvatar
            key={entry._id}
            user={entry.user}
            size="sm"
            className="h-8 w-8 border-2 border-white bg-[#e2ecff] p-0 text-[11px]"
          />
        ))}
        {remaining > 0 && (
          <div className="grid h-8 w-8 place-items-center rounded-full border-2 border-white bg-[#e2ecff] text-[11px] font-black text-[#1e3a8a]">
            +{remaining}
          </div>
        )}
      </div>
    </div>
  );
}
