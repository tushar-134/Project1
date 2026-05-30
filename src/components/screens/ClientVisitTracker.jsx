import { CalendarDays, Clock3, MapPinned, Plus, Search, UsersRound } from "lucide-react";
import { cloneElement, isValidElement, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { useApp } from "../../context/AppContext.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { useClients } from "../../hooks/useClients";
import { useUsers } from "../../hooks/useUsers";
import { clientVisitService } from "../../services/clientVisitService";
import { ROLE_LABELS } from "../../utils/permissions.js";
import Badge from "../ui/Badge.jsx";
import Button from "../ui/Button.jsx";
import Card from "../ui/Card.jsx";
import ClientComboBox from "../ui/ClientComboBox.jsx";
import ClientVisitHistoryDrawer from "../ui/ClientVisitHistoryDrawer.jsx";
import Table from "../ui/Table.jsx";

const blankForm = () => ({
  visitDate: new Date().toISOString().slice(0, 10),
  clientId: "",
  visitorIds: [],
  visitorToAdd: "",
});

function getApiErrorMessage(error) {
  const data = error?.response?.data;
  if (data?.message) return data.message;
  if (Array.isArray(data?.errors) && data.errors[0]?.msg) return data.errors[0].msg;
  return "";
}

function formatVisitDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function hasLoggedTime(visitor) {
  return Boolean(String(visitor?.checkInTime || "").trim() || String(visitor?.checkOutTime || "").trim());
}

function ensureRowState(visits, currentSelection = {}, currentDrafts = {}) {
  const nextSelection = {};
  const nextDrafts = {};

  visits.forEach((visit) => {
    const validVisitorIds = visit.visitors.map((visitor) => visitor._id);
    const fallbackVisitorId = validVisitorIds[0] || "";
    const selectedVisitorId = validVisitorIds.includes(currentSelection[visit._id])
      ? currentSelection[visit._id]
      : fallbackVisitorId;
    const selectedVisitor = visit.visitors.find((visitor) => visitor._id === selectedVisitorId) || visit.visitors[0];

    nextSelection[visit._id] = selectedVisitorId;
    nextDrafts[visit._id] = {
      visitorId: selectedVisitorId,
      checkInTime: selectedVisitor?._id === currentDrafts[visit._id]?.visitorId
        ? currentDrafts[visit._id]?.checkInTime ?? selectedVisitor?.checkInTime ?? ""
        : selectedVisitor?.checkInTime ?? "",
      checkOutTime: selectedVisitor?._id === currentDrafts[visit._id]?.visitorId
        ? currentDrafts[visit._id]?.checkOutTime ?? selectedVisitor?.checkOutTime ?? ""
        : selectedVisitor?.checkOutTime ?? "",
    };
  });

  return { nextSelection, nextDrafts };
}

export default function ClientVisitTracker() {
  const { state } = useApp();
  const { currentUser } = useAuth();
  const { fetchClients } = useClients();
  const { fetchUsers } = useUsers();
  const [query, setQuery] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(blankForm);
  const [visits, setVisits] = useState([]);
  const [loading, setLoading] = useState(false);
  const [savingVisit, setSavingVisit] = useState(false);
  const [savingRow, setSavingRow] = useState({});
  const [selectedVisitorByVisit, setSelectedVisitorByVisit] = useState({});
  const [timeDrafts, setTimeDrafts] = useState({});
  const [historyClient, setHistoryClient] = useState(null);

  useEffect(() => {
    let active = true;
    fetchClients({ limit: 200 }).catch(() => {
      if (active) toast.error("Unable to load clients.");
    });
    if (currentUser?.role !== "task_only") {
      fetchUsers().catch(() => {
        if (active) toast.error("Unable to load users.");
      });
    }
    loadVisits(active);
    return () => {
      active = false;
    };
  }, [currentUser?.role]);

  useEffect(() => {
    const { nextSelection, nextDrafts } = ensureRowState(visits, selectedVisitorByVisit, timeDrafts);
    setSelectedVisitorByVisit(nextSelection);
    setTimeDrafts(nextDrafts);
  }, [visits]);

  async function loadVisits(active = true) {
    setLoading(true);
    try {
      const data = await clientVisitService.list();
      if (active) setVisits(data);
    } catch {
      if (active) toast.error("Unable to load client visits.");
    } finally {
      if (active) setLoading(false);
    }
  }

  const userOptions = useMemo(
    () => {
      if (currentUser?.role === "task_only") {
        return currentUser ? [{
          id: currentUser.id || currentUser._id,
          _id: currentUser.id || currentUser._id,
          name: currentUser.name,
          role: ROLE_LABELS[currentUser.role] || currentUser.role,
        }] : [];
      }
      return [...state.users].sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
    },
    [currentUser, state.users]
  );

  const filteredVisits = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return visits;
    return visits.filter((visit) => {
      const clientName = String(visit.client?.legalName || "").toLowerCase();
      const fileNo = String(visit.client?.fileNo || "").toLowerCase();
      const visitorNames = visit.visitors.map((entry) => String(entry.user?.name || "").toLowerCase());
      const visitDate = formatVisitDate(visit.visitDate).toLowerCase();
      return clientName.includes(term) || fileNo.includes(term) || visitDate.includes(term) || visitorNames.some((name) => name.includes(term));
    });
  }, [query, visits]);

  const summary = useMemo(() => {
    const loggedVisits = visits.filter((visit) => visit.visitors.some(hasLoggedTime));
    return {
      totalVisits: visits.length,
      uniqueClients: new Set(loggedVisits.map((visit) => String(visit.client?._id || "")).filter(Boolean)).size,
      uniqueVisitors: new Set(
        loggedVisits
          .flatMap((visit) => visit.visitors.filter(hasLoggedTime).map((entry) => String(entry.user?._id || "")))
          .filter(Boolean)
      ).size,
    };
  }, [visits]);

  const availableVisitors = useMemo(
    () => userOptions.filter((user) => !form.visitorIds.includes(user.id || user._id)),
    [form.visitorIds, userOptions]
  );

  const selectedVisitors = useMemo(
    () => form.visitorIds
      .map((id) => userOptions.find((user) => (user.id || user._id) === id))
      .filter(Boolean),
    [form.visitorIds, userOptions]
  );

  function closeModal() {
    if (savingVisit) return;
    setModalOpen(false);
    setForm(blankForm());
  }

  function addVisitor() {
    if (!form.visitorToAdd) {
      toast.error("Select a user to add.");
      return;
    }
    setForm((current) => ({
      ...current,
      visitorIds: current.visitorIds.includes(current.visitorToAdd)
        ? current.visitorIds
        : [...current.visitorIds, current.visitorToAdd],
      visitorToAdd: "",
    }));
  }

  function removeVisitor(userId) {
    setForm((current) => ({
      ...current,
      visitorIds: current.visitorIds.filter((item) => item !== userId),
    }));
  }

  async function saveVisit() {
    if (savingVisit) return;
    if (!form.visitDate || !form.clientId || !form.visitorIds.length) {
      toast.error("Visit date, client, and at least one visiting user are required.");
      return;
    }

    setSavingVisit(true);
    try {
      const created = await clientVisitService.create({
        visitDate: form.visitDate,
        client: form.clientId,
        visitors: form.visitorIds.map((user) => ({ user })),
      });
      setVisits((current) => [created, ...current]);
      toast.success("Client visit saved.");
      closeModal();
    } catch (error) {
      toast.error(getApiErrorMessage(error) || "Unable to save visit.");
    } finally {
      setSavingVisit(false);
    }
  }

  function setSelectedVisitor(visit, visitorId) {
    const visitor = visit.visitors.find((entry) => entry._id === visitorId);
    setSelectedVisitorByVisit((current) => ({ ...current, [visit._id]: visitorId }));
    setTimeDrafts((current) => ({
      ...current,
      [visit._id]: {
        visitorId,
        checkInTime: visitor?.checkInTime || "",
        checkOutTime: visitor?.checkOutTime || "",
      },
    }));
  }

  function setTimeDraft(visitId, key, value) {
    setTimeDrafts((current) => ({
      ...current,
      [visitId]: {
        ...(current[visitId] || {}),
        [key]: value,
      },
    }));
  }

  async function updateVisitTimes(visit) {
    const selectedVisitorId = selectedVisitorByVisit[visit._id];
    if (!selectedVisitorId) {
      toast.error("Select a visiting user first.");
      return;
    }

    const draft = timeDrafts[visit._id] || {};
    setSavingRow((current) => ({ ...current, [visit._id]: true }));
    try {
      const updated = await clientVisitService.updateVisitorTimes(visit._id, selectedVisitorId, {
        checkInTime: draft.checkInTime || "",
        checkOutTime: draft.checkOutTime || "",
      });
      setVisits((current) => current.map((item) => (item._id === updated._id ? updated : item)));
      toast.success("Visit timing updated.");
    } catch (error) {
      toast.error(getApiErrorMessage(error) || "Unable to update visit timing.");
    } finally {
      setSavingRow((current) => ({ ...current, [visit._id]: false }));
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="page-kicker">Contacts</div>
          <h2 className="screen-title">Client Visit Tracker</h2>
        </div>
        <Button onClick={() => setModalOpen(true)}>
          <Plus size={16} />
          Add Visit
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Summary icon={<MapPinned size={16} />} label="Total Visits" value={summary.totalVisits} />
        <Summary icon={<CalendarDays size={16} />} label="Clients Visited" value={summary.uniqueClients} />
        <Summary icon={<UsersRound size={16} />} label="Visitors Logged" value={summary.uniqueVisitors} />
      </div>

      <Card className="p-3">
        <div className="relative">
          <Search className="absolute left-5 top-2.5 text-slate-400" size={16} />
          <input
            id="visit-search"
            name="visitSearch"
            type="search"
            className="input pl-12"
            placeholder="Search by client, file number, visitor, or date..."
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
              <th>Visit Date</th>
              <th>Visited By</th>
              <th>Time For</th>
              <th>Check In</th>
              <th>Check Out</th>
              <th>Last Updated</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredVisits.map((visit) => {
              const selectedVisitorId = selectedVisitorByVisit[visit._id];
              const draft = timeDrafts[visit._id] || { checkInTime: "", checkOutTime: "" };
              const selectedVisitor = visit.visitors.find((entry) => entry._id === selectedVisitorId) || null;
              const isLocked = hasLoggedTime(selectedVisitor);
              return (
                <tr key={visit._id}>
                  <td>
                    {visit.client?._id ? (
                      <button
                        type="button"
                        className="font-extrabold text-[#1e3a8a] hover:underline text-left"
                        onClick={() => setHistoryClient({ id: visit.client._id, name: visit.client?.legalName })}
                      >
                        {visit.client?.legalName}
                      </button>
                    ) : (
                      <div className="font-extrabold text-slate-900">{visit.client?.legalName || "Unknown Client"}</div>
                    )}
                    <div className="text-[11px] font-semibold text-slate-500">{visit.client?.fileNo || "-"}</div>
                  </td>
                  <td>{formatVisitDate(visit.visitDate)}</td>
                  <td>
                    <div className="flex max-w-[220px] flex-wrap gap-1.5">
                      {visit.visitors.map((entry) => (
                        <Badge key={entry._id} color="bg-blue-50 text-[#1e3a8a]">
                          {entry.user?.name || "Unknown User"}
                        </Badge>
                      ))}
                    </div>
                  </td>
                  <td>
                    <select
                      className="input min-w-[170px]"
                      value={selectedVisitorId || ""}
                      onChange={(e) => setSelectedVisitor(visit, e.target.value)}
                    >
                      {visit.visitors.map((entry) => (
                        <option key={entry._id} value={entry._id}>
                          {entry.user?.name || "Unknown User"}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input
                      className="input min-w-[120px]"
                      type="time"
                      value={draft.checkInTime || ""}
                      onChange={(e) => setTimeDraft(visit._id, "checkInTime", e.target.value)}
                      disabled={isLocked || savingRow[visit._id]}
                    />
                  </td>
                  <td>
                    <input
                      className="input min-w-[120px]"
                      type="time"
                      value={draft.checkOutTime || ""}
                      onChange={(e) => setTimeDraft(visit._id, "checkOutTime", e.target.value)}
                      disabled={isLocked || savingRow[visit._id]}
                    />
                  </td>
                  <td>{formatDateTime(visit.updatedAt)}</td>
                  <td>
                    <Button
                      size="sm"
                      variant="success"
                      onClick={() => updateVisitTimes(visit)}
                      disabled={savingRow[visit._id] || isLocked}
                    >
                      <Clock3 size={14} />
                      {savingRow[visit._id] ? "Saving..." : isLocked ? "Locked" : "Save"}
                    </Button>
                  </td>
                </tr>
              );
            })}
            {!loading && filteredVisits.length === 0 && (
              <tr>
                <td colSpan="8" className="py-8 text-center text-[13px] font-semibold text-slate-500">
                  No client visits found yet.
                </td>
              </tr>
            )}
          </tbody>
        </Table>
      </Card>

      {modalOpen && (
        <div className="fixed inset-0 z-40 grid place-items-center bg-slate-900/35 p-4">
          <Card className="w-full max-w-3xl p-4">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <div className="text-[16px] font-extrabold">Add Client Visit</div>
                <div className="text-[12px] font-medium text-slate-500">Store the visit date, client, and everyone who visited.</div>
              </div>
              <button
                onClick={closeModal}
                disabled={savingVisit}
                className="text-slate-500 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Close
              </button>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Client*" field="visit-client">
                <ClientComboBox
                  clients={state.clients}
                  value={form.clientId}
                  onChange={(id) => setForm((current) => ({ ...current, clientId: id }))}
                  inputId="visit-client"
                  placeholder="Search client…"
                />
              </Field>
              <Field label="Visit Date*" field="visit-date">
                <input
                  className="input"
                  type="date"
                  value={form.visitDate}
                  onChange={(e) => setForm((current) => ({ ...current, visitDate: e.target.value }))}
                />
              </Field>
            </div>

            <div className="mt-4">
              <div className="field-label">Visited By*</div>
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-2 sm:flex-row">
                  <select
                    className="input flex-1"
                    value={form.visitorToAdd}
                    onChange={(e) => setForm((current) => ({ ...current, visitorToAdd: e.target.value }))}
                  >
                    <option value="">Select user to add</option>
                    {availableVisitors.map((user) => (
                      <option key={user.id || user._id} value={user.id || user._id}>
                        {user.name} - {user.role}
                      </option>
                    ))}
                  </select>
                  <Button type="button" onClick={addVisitor} disabled={!availableVisitors.length}>
                    <Plus size={16} />
                    Add User
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {selectedVisitors.map((user) => (
                    <div
                      key={user.id || user._id}
                      className="inline-flex items-center gap-2 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2"
                    >
                      <div className="min-w-0">
                        <div className="font-bold text-slate-900">{user.name}</div>
                        <div className="text-[11px] font-medium text-slate-500">{user.role}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeVisitor(user.id || user._id)}
                        className="rounded-md px-1 text-[12px] font-bold text-slate-500 transition hover:bg-white hover:text-slate-700"
                        aria-label={`Remove ${user.name}`}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                  {!selectedVisitors.length && (
                    <div className="rounded-lg border border-dashed border-slate-300 px-3 py-2 text-[12px] font-medium text-slate-500">
                      No visitors added yet.
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <Button variant="ghost" onClick={closeModal} disabled={savingVisit}>
                Cancel
              </Button>
              <Button onClick={saveVisit} disabled={savingVisit}>
                {savingVisit ? "Saving..." : "Save Visit"}
              </Button>
            </div>
          </Card>
        </div>
      )}

      <ClientVisitHistoryDrawer
        clientId={historyClient?.id}
        clientName={historyClient?.name}
        onClose={() => setHistoryClient(null)}
      />
    </div>
  );
}

function Summary({ icon, label, value }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-[11px] font-extrabold uppercase text-slate-500">
        {icon}
        <span>{label}</span>
      </div>
      <div className="mt-2 text-[24px] font-black text-slate-900">{value}</div>
    </Card>
  );
}

function Field({ label, field, children }) {
  const control = isValidElement(children)
    ? cloneElement(children, {
        id: children.props.id || field,
        name: children.props.name || field,
      })
    : children;
  return <label htmlFor={field}><span className="field-label">{label}</span>{control}</label>;
}
