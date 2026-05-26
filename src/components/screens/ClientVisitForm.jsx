import { ArrowLeft, Calendar, Clock3, Save, Search, UsersRound } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import { useApp } from "../../context/AppContext.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { useClients } from "../../hooks/useClients.js";
import { useUsers } from "../../hooks/useUsers.js";
import { clientVisitService } from "../../services/clientVisitService.js";
import { DIAL_CODE_OPTIONS } from "../../utils/dialCodeOptions.js";
import { getPhoneNumberSpec, normalizeDialCode, normalizePhoneNumber } from "../../utils/phoneUtils.js";
import Button from "../ui/Button.jsx";
import Card from "../ui/Card.jsx";
import UserAvatar from "../ui/UserAvatar.jsx";

const visitTypes = ["Requirement Gathering", "Verification", "Onboarding Discussion", "Follow Up", "Collection", "Meeting"];

function todayValue() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function blankForm(currentUser) {
  return {
    clientType: "existing",
    clientId: "",
    newClient: {
      authorityName: "",
      mobileCountryCode: "+971",
      mobileNumber: "",
      email: "",
      location: "",
    },
    visitDate: todayValue(),
    visitHourMinute: "10:00",
    visitMeridiem: "AM",
    visitType: "Requirement Gathering",
    location: "",
    remarks: "",
    assignedUsers: currentUser?.role === "task_only" ? [currentUser._id || currentUser.id] : [],
  };
}

function parseVisitTime(value) {
  const match = String(value || "").trim().match(/^(\d{1,2}:\d{2})\s?(AM|PM)$/i);
  if (!match) return { visitHourMinute: "10:00", visitMeridiem: "AM" };
  return { visitHourMinute: match[1], visitMeridiem: match[2].toUpperCase() };
}

function joinVisitTime(hourMinute, meridiem) {
  return `${hourMinute} ${meridiem}`;
}

function firstClientLocation(client) {
  const registered = client?.registeredAddress || {};
  const correspondence = client?.correspondenceAddress || {};
  return [registered.emirate, registered.street].filter(Boolean).join(", ")
    || [correspondence.emirate, correspondence.street].filter(Boolean).join(", ")
    || "";
}

function normalizeError(error) {
  const data = error?.response?.data;
  if (data?.message) return data.message;
  if (Array.isArray(data?.errors) && data.errors[0]?.msg) return data.errors[0].msg;
  return "Unable to save client visit.";
}

export default function ClientVisitForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditMode = Boolean(id);
  const { currentUser } = useAuth();
  const { state } = useApp();
  const { fetchClients } = useClients();
  const { fetchUsers } = useUsers();
  const [form, setForm] = useState(() => blankForm(currentUser));
  const [userSearch, setUserSearch] = useState("");
  const [loading, setLoading] = useState(isEditMode);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchClients({ limit: 500 }).catch(() => toast.error("Unable to load clients."));
    if (currentUser?.role !== "task_only") {
      fetchUsers().catch(() => toast.error("Unable to load users."));
    }
  }, [currentUser?.role]);

  useEffect(() => {
    if (!isEditMode) return undefined;
    let active = true;
    setLoading(true);
    clientVisitService.get(id)
      .then((visit) => {
        if (!active) return;
        const { visitHourMinute, visitMeridiem } = parseVisitTime(visit.visitTime);
        setForm({
          clientType: visit.clientType || "existing",
          clientId: visit.client?._id || "",
          newClient: {
            authorityName: visit.newClient?.authorityName || "",
            mobileCountryCode: visit.newClient?.mobileCountryCode || "+971",
            mobileNumber: visit.newClient?.mobileNumber || "",
            email: visit.newClient?.email || "",
            location: visit.newClient?.location || "",
          },
          visitDate: visit.visitDate ? visit.visitDate.slice(0, 10) : todayValue(),
          visitHourMinute,
          visitMeridiem,
          visitType: visit.visitType || "Requirement Gathering",
          location: visit.location || "",
          remarks: visit.remarks || "",
          assignedUsers: (visit.assignedUsers || []).map((entry) => entry.user?._id || entry.user).filter(Boolean),
        });
      })
      .catch((error) => toast.error(error?.response?.data?.message || "Unable to load visit."))
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id, isEditMode]);

  const clientOptions = useMemo(() => {
    const items = [...state.clients];
    return items;
  }, [state.clients]);

  const userOptions = useMemo(() => {
    if (currentUser?.role === "task_only") {
      return [{
        _id: currentUser._id || currentUser.id,
        id: currentUser._id || currentUser.id,
        name: currentUser.name,
        role: "Task Only",
      }];
    }
    const term = userSearch.trim().toLowerCase();
    const items = [...state.users];
    return items.filter((user) => `${user.name || ""} ${user.email || ""} ${user.role || ""}`.toLowerCase().includes(term));
  }, [currentUser, state.users, userSearch]);

  const selectedUsers = useMemo(
    () => form.assignedUsers.map((userId) => userOptions.find((user) => String(user._id || user.id) === String(userId)) || state.users.find((user) => String(user._id || user.id) === String(userId))).filter(Boolean),
    [form.assignedUsers, state.users, userOptions]
  );

  useEffect(() => {
    if (form.clientType !== "existing" || !form.clientId) return;
    const client = state.clients.find((entry) => String(entry._id || entry.id) === String(form.clientId));
    if (!client) return;
    setForm((current) => {
      const assignedId = client.assignedUser?._id || client.assignedUser || "";
      const nextAssignedUsers = assignedId && currentUser?.role !== "task_only"
        ? current.assignedUsers.includes(assignedId) ? current.assignedUsers : [...current.assignedUsers, assignedId]
        : current.assignedUsers;
      const nextLocation = current.location || firstClientLocation(client);
      if (nextAssignedUsers === current.assignedUsers && nextLocation === current.location) return current;
      return { ...current, assignedUsers: nextAssignedUsers, location: nextLocation };
    });
  }, [form.clientType, form.clientId, state.clients, currentUser?.role]);

  function updateField(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function updateNewClient(key, value) {
    setForm((current) => ({
      ...current,
      newClient: { ...current.newClient, [key]: value },
    }));
  }

  function toggleAssignedUser(userId) {
    if (currentUser?.role === "task_only") return;
    setForm((current) => ({
      ...current,
      assignedUsers: current.assignedUsers.includes(userId)
        ? current.assignedUsers.filter((id) => id !== userId)
        : [...current.assignedUsers, userId],
    }));
  }

  async function saveVisit() {
    if (saving) return;
    if (form.clientType === "existing" && !form.clientId) {
      toast.error("Please select an existing client.");
      return;
    }
    if (form.clientType === "new") {
      if (!form.newClient.authorityName || !form.newClient.mobileNumber || !form.newClient.location) {
        toast.error("Please complete the new client basics.");
        return;
      }
      const dialCode = normalizeDialCode(form.newClient.mobileCountryCode);
      const mobileNumber = normalizePhoneNumber(form.newClient.mobileNumber);
      const { min, max } = getPhoneNumberSpec(dialCode);
      if (!dialCode) {
        toast.error("Please select a mobile country code.");
        return;
      }
      if (mobileNumber.length < min || mobileNumber.length > max) {
        toast.error(`Mobile number must be between ${min} and ${max} digits.`);
        return;
      }
    }
    if (!form.visitDate) {
      toast.error("Visit Date is required.");
      return;
    }
    if (!/^\d{1,2}:\d{2}$/.test(form.visitHourMinute)) {
      toast.error("Visit Time must look like 10:00.");
      return;
    }
    if (!form.assignedUsers.length) {
      toast.error("Please assign at least one user.");
      return;
    }

    const payload = {
      clientType: form.clientType,
      client: form.clientType === "existing" ? form.clientId : undefined,
      newClient: form.clientType === "new" ? {
        ...form.newClient,
        mobileCountryCode: normalizeDialCode(form.newClient.mobileCountryCode),
        mobileNumber: normalizePhoneNumber(form.newClient.mobileNumber),
      } : undefined,
      visitDate: form.visitDate,
      visitTime: joinVisitTime(form.visitHourMinute, form.visitMeridiem),
      visitType: form.visitType,
      location: form.location,
      remarks: form.remarks,
      assignedUsers: form.assignedUsers.map((user) => ({ user })),
    };

    setSaving(true);
    try {
      if (isEditMode) {
        await clientVisitService.update(id, payload);
        toast.success("Visit updated.");
      } else {
        await clientVisitService.create(payload);
        toast.success("Visit scheduled.");
      }
      navigate("/client-visits");
    } catch (error) {
      toast.error(normalizeError(error));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-5">
        <div className="page-kicker">Field Operations</div>
        <h1 className="screen-title">{isEditMode ? "Edit Visit" : "Schedule New Visit"}</h1>
        <Card className="p-8 text-center text-[14px] font-semibold text-slate-500">Loading visit...</Card>
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-24">
      <div className="flex items-start gap-4">
        <button
          type="button"
          onClick={() => navigate("/client-visits")}
          className="grid h-12 w-12 place-items-center rounded-2xl border border-[#dbe4f0] bg-white text-slate-600 transition hover:bg-slate-50"
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <div className="page-kicker">Field Operations</div>
          <h1 className="screen-title">{isEditMode ? "Edit Visit" : "Schedule New Visit"}</h1>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.55fr_1fr]">
        <Card className="p-6">
          <div className="mb-5 text-[18px] font-black text-slate-900">Visit Information</div>

          <div className="space-y-5">
            <div>
              <div className="mb-2 text-[11px] font-black uppercase tracking-wider text-slate-500">Client Type *</div>
              <div className="flex flex-wrap gap-5">
                {[
                  { value: "existing", label: "Existing Client" },
                  { value: "new", label: "New Client" },
                ].map((option) => (
                  <label key={option.value} className="inline-flex items-center gap-2 text-[14px] font-semibold text-slate-700">
                    <input
                      type="radio"
                      checked={form.clientType === option.value}
                      onChange={() => updateField("clientType", option.value)}
                    />
                    {option.label}
                  </label>
                ))}
              </div>
            </div>

            {form.clientType === "existing" ? (
              <>
                <Field label="Select Client *">
                  <div>
                    <select className="input" value={form.clientId} onChange={(event) => updateField("clientId", event.target.value)}>
                      <option value="">Select Client</option>
                      {clientOptions.map((client) => (
                        <option key={client._id || client.id} value={client._id || client.id}>
                          {client.legalName || client.name} {client.fileNo ? `(${client.fileNo})` : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                </Field>
              </>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Name *">
                  <input className="input" value={form.newClient.authorityName} onChange={(event) => updateNewClient("authorityName", event.target.value)} />
                </Field>
                <Field label="Mobile Number *">
                  <div className="grid grid-cols-[minmax(220px,0.9fr)_minmax(0,1fr)] gap-2">
                    <select
                      className="input"
                      value={form.newClient.mobileCountryCode}
                      onChange={(event) => updateNewClient("mobileCountryCode", normalizeDialCode(event.target.value))}
                    >
                      {DIAL_CODE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <input
                      className="input"
                      value={form.newClient.mobileNumber}
                      onChange={(event) => updateNewClient("mobileNumber", normalizePhoneNumber(event.target.value))}
                      placeholder={getPhoneNumberSpec(form.newClient.mobileCountryCode).placeholder}
                    />
                  </div>
                </Field>
                <Field label="Email">
                  <input className="input" value={form.newClient.email} onChange={(event) => updateNewClient("email", event.target.value)} />
                </Field>
                <div className="md:col-span-2">
                  <Field label="Location *">
                    <input className="input" value={form.newClient.location} onChange={(event) => updateNewClient("location", event.target.value)} />
                  </Field>
                </div>
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-[1fr_1fr_110px]">
              <Field label="Visit Date *">
                <div className="relative">
                  <input className="input pr-10" type="date" min={todayValue()} value={form.visitDate} onChange={(event) => updateField("visitDate", event.target.value)} />
                  <Calendar className="pointer-events-none absolute right-4 top-3 text-slate-400" size={16} />
                </div>
              </Field>
              <Field label="Visit Time *">
                <div className="relative">
                  <input className="input pr-10" value={form.visitHourMinute} onChange={(event) => updateField("visitHourMinute", event.target.value)} placeholder="10:00" />
                  <Clock3 className="pointer-events-none absolute right-4 top-3 text-slate-400" size={16} />
                </div>
              </Field>
              <Field label="AM / PM">
                <select className="input" value={form.visitMeridiem} onChange={(event) => updateField("visitMeridiem", event.target.value)}>
                  <option value="AM">AM</option>
                  <option value="PM">PM</option>
                </select>
              </Field>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Visit Type">
                <select className="input" value={form.visitType} onChange={(event) => updateField("visitType", event.target.value)}>
                  {visitTypes.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </Field>
              <Field label="Location">
                <input className="input" value={form.location} onChange={(event) => updateField("location", event.target.value)} placeholder="Physical address or location name" />
              </Field>
            </div>

            <Field label="Remarks / Notes">
              <textarea className="input min-h-[140px] py-3" value={form.remarks} onChange={(event) => updateField("remarks", event.target.value)} />
            </Field>
          </div>
        </Card>

        <Card className="flex min-h-[540px] flex-col overflow-hidden p-0">
          <div className="border-b border-[#e2e8f0] px-6 py-5">
            <div className="text-[18px] font-black text-slate-900">Assigned Users *</div>
            <div className="mt-1 text-[14px] font-medium text-slate-500">Select one or more users for this visit</div>
          </div>

          <div className="flex shrink-0 flex-wrap gap-2 px-6 py-4">
            {selectedUsers.length ? selectedUsers.map((user) => (
              <div key={user._id || user.id} className="inline-flex max-w-full items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-2">
                <UserAvatar user={user} size="sm" className="h-8 w-8 p-0 text-[11px]" />
                <div className="min-w-0">
                  <div className="truncate text-[13px] font-black text-slate-900">{user.name}</div>
                  <div className="truncate text-[11px] font-semibold text-slate-500">{user.role}</div>
                </div>
                {currentUser?.role !== "task_only" && (
                  <button type="button" className="text-[11px] font-black text-slate-500 hover:text-slate-700" onClick={() => toggleAssignedUser(user._id || user.id)}>
                    Remove
                  </button>
                )}
              </div>
            )) : (
              <div className="rounded-xl border border-dashed border-slate-300 px-3 py-2 text-[12px] font-medium text-slate-500">
                No users assigned yet.
              </div>
            )}
          </div>

          <div className="border-t border-[#e2e8f0] px-6 py-4">
            <div className="flex h-9 items-center gap-2 rounded-lg border border-[#e2e8f0] bg-white px-3 text-[13px] transition focus-within:ring-2 focus-within:[--tw-ring-color:rgb(30_58_138_/_0.16)] focus-within:border-[#1e3a8a]">
              <Search className="shrink-0 text-slate-400" size={16} />
              <input
                className="min-w-0 flex-1 border-0 bg-transparent p-0 text-[13px] text-slate-900 outline-none placeholder:text-slate-400"
                value={userSearch}
                onChange={(event) => setUserSearch(event.target.value)}
                placeholder="Search users..."
              />
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-32">
            <div className="space-y-2">
              {userOptions.map((user) => {
                const userId = user._id || user.id;
                const checked = form.assignedUsers.includes(userId);
                return (
                  <button
                    key={userId}
                    type="button"
                    onClick={() => toggleAssignedUser(userId)}
                    disabled={currentUser?.role === "task_only"}
                    className={`flex w-full items-center gap-3 rounded-2xl border px-3 py-3 text-left transition ${
                      checked ? "border-blue-200 bg-blue-50" : "border-transparent bg-white hover:border-[#dbe4f0] hover:bg-slate-50"
                    } ${currentUser?.role === "task_only" ? "cursor-default" : ""}`}
                  >
                    <UserAvatar user={user} size="sm" className="h-10 w-10 p-0 text-[12px]" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[14px] font-black text-slate-900">{user.name}</div>
                      <div className="truncate text-[12px] font-semibold text-slate-500">{user.role}</div>
                    </div>
                    <div className={`grid h-5 w-5 place-items-center rounded-full border ${checked ? "border-[#1e3a8a] bg-[#1e3a8a] text-white" : "border-slate-300 bg-white text-transparent"}`}>
                      <UsersRound size={11} />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-auto border-t border-[#e2e8f0] bg-white/95 px-5 py-4 shadow-[0_-12px_30px_rgba(15,23,42,0.08)] backdrop-blur">
            <div className="flex flex-col gap-3">
              <Button onClick={saveVisit} disabled={saving}>
                <Save size={16} />
                {saving ? (isEditMode ? "Saving..." : "Scheduling...") : (isEditMode ? "Save Changes" : "Schedule Visit")}
              </Button>
              <Button variant="ghost" onClick={() => navigate("/client-visits")} disabled={saving}>
                Cancel
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block space-y-2">
      <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">{label}</span>
      {children}
    </label>
  );
}
