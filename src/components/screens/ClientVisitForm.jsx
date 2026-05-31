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
import ClientComboBox from "../ui/ClientComboBox.jsx";
import UserAvatar from "../ui/UserAvatar.jsx";
import UnsavedChangesGuard from "../ui/UnsavedChangesGuard.jsx";

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
    visitTime24: "10:00",
    visitType: "Requirement Gathering",
    location: "",
    remarks: "",
    assignedUsers: currentUser?.role === "task_only" ? [currentUser._id || currentUser.id] : [],
  };
}

function parseVisitTime(value) {
  const match = String(value || "").trim().match(/^(\d{1,2}):(\d{2})\s?(AM|PM)$/i);
  if (!match) return "10:00";
  let hour = parseInt(match[1], 10);
  const min = match[2];
  const meridiem = match[3].toUpperCase();
  if (meridiem === "PM" && hour < 12) hour += 12;
  if (meridiem === "AM" && hour === 12) hour = 0;
  return `${String(hour).padStart(2, "0")}:${min}`;
}

function joinVisitTime(time24) {
  if (!time24) return "10:00 AM";
  const [h, m] = time24.split(":");
  let hour = parseInt(h, 10);
  const meridiem = hour >= 12 ? "PM" : "AM";
  if (hour > 12) hour -= 12;
  if (hour === 0) hour = 12;
  return `${hour}:${m} ${meridiem}`;
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
  const [isDirty, setIsDirty] = useState(false);
  const [form, setFormRaw] = useState(() => blankForm(currentUser));
  const setForm = (val) => { setIsDirty(true); setFormRaw(val); };
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
        setFormRaw({
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
          visitTime24: parseVisitTime(visit.visitTime),
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
    setFormRaw((current) => {
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
    if (!form.visitTime24) {
      toast.error("Visit Time is required.");
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
      visitTime: joinVisitTime(form.visitTime24),
      visitType: form.visitType,
      location: form.location,
      assignedUsers: form.assignedUsers.map((user) => ({ user })),
    };

    // Include remarks only for a new visit
    if (!isEditMode) {
      payload.remarks = form.remarks;
    }

    setSaving(true);
    try {
      if (isEditMode) {
        await clientVisitService.update(id, payload);
        toast.success("Visit updated.");
      } else {
        await clientVisitService.create(payload);
        toast.success("Visit scheduled.");
      }
      setIsDirty(false);
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
        <h1 className="screen-title">{isEditMode ? "Edit Visit" : "New Visit"}</h1>
        <Card className="p-8 text-center text-[14px] font-semibold text-slate-500">Loading visit...</Card>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <UnsavedChangesGuard isDirty={isDirty} />
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => navigate("/client-visits")}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-[#dbe4f0] bg-white text-slate-600 transition hover:bg-slate-50"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="min-w-0 flex-1">
          <div className="page-kicker">Field Operations</div>
          <h1 className="screen-title">{isEditMode ? "Edit Visit" : "New Visit"}</h1>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="ghost" onClick={() => navigate("/client-visits")} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={saveVisit} disabled={saving}>
            <Save size={15} />
            {saving ? "Saving..." : isEditMode ? "Save Changes" : "Save Visit"}
          </Button>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.55fr_1fr]">
        <Card className="flex h-full flex-col p-6">
          <div className="mb-5 text-[18px] font-black text-slate-900">Visit Information</div>

          <div className="flex flex-1 flex-col gap-5">
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
                  <ClientComboBox
                    clients={clientOptions}
                    value={form.clientId}
                    onChange={(id) => updateField("clientId", id)}
                    placeholder="Search client…"
                  />
                </Field>
              </>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Name *">
                  <input className="input" value={form.newClient.authorityName} onChange={(event) => updateNewClient("authorityName", event.target.value)} />
                </Field>
                <Field label="Email">
                  <input className="input" value={form.newClient.email} onChange={(event) => updateNewClient("email", event.target.value)} />
                </Field>
                <div className="md:col-span-2">
                  <Field label="Mobile Number *">
                    <div className="grid gap-3 md:grid-cols-[260px_minmax(0,1fr)]">
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
                </div>
                <div className="md:col-span-2">
                  <Field label="Location *">
                    <input className="input" value={form.newClient.location} onChange={(event) => updateNewClient("location", event.target.value)} />
                  </Field>
                </div>
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Visit Date *">
                <div className="relative">
                  <input className="input pr-10" type="date" min={todayValue()} value={form.visitDate} onChange={(event) => updateField("visitDate", event.target.value)} />
                  <Calendar className="pointer-events-none absolute right-4 top-3 text-slate-400" size={16} />
                </div>
              </Field>
              <Field label="Visit Time *">
                <input type="time" className="input" value={form.visitTime24} onChange={(event) => updateField("visitTime24", event.target.value)} />
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
          </div>
        </Card>

        <Card className="flex h-full min-h-[540px] flex-col overflow-hidden p-0">
          <div className="border-b border-[#e2e8f0] px-6 py-5">
            <div className="text-[18px] font-black text-slate-900">Assigned Users *</div>
            <div className="mt-1 text-[14px] font-medium text-slate-500">Select one or more users for this visit</div>
          </div>

          <div className="flex shrink-0 flex-wrap gap-1.5 px-4 py-3">
            {selectedUsers.length ? selectedUsers.map((user) => (
              <div key={user._id || user.id} className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-blue-100 bg-blue-50 px-2 py-1">
                <UserAvatar user={user} size="sm" className="h-6 w-6 p-0 text-[10px]" />
                <div className="truncate text-[12px] font-bold text-slate-900">{user.name}</div>
                {currentUser?.role !== "task_only" && (
                  <button type="button" className="text-[11px] font-black text-slate-400 hover:text-slate-700" onClick={() => toggleAssignedUser(user._id || user.id)}>
                    ×
                  </button>
                )}
              </div>
            )) : (
              <div className="rounded-xl border border-dashed border-slate-300 px-3 py-1.5 text-[12px] font-medium text-slate-500">
                No users assigned yet.
              </div>
            )}
          </div>

          <div className="border-t border-[#e2e8f0] px-4 py-3">
            <div className="flex h-8 items-center gap-2 rounded-lg border border-[#e2e8f0] bg-white px-3 text-[13px] transition focus-within:ring-2 focus-within:[--tw-ring-color:rgb(30_58_138_/_0.16)] focus-within:border-[#1e3a8a]">
              <Search className="shrink-0 text-slate-400" size={14} />
              <input
                className="min-w-0 flex-1 border-0 bg-transparent p-0 text-[13px] text-slate-900 outline-none placeholder:text-slate-400"
                value={userSearch}
                onChange={(event) => setUserSearch(event.target.value)}
                placeholder="Search users..."
              />
            </div>
          </div>

          <div className="h-[180px] overflow-y-auto px-4 pb-4 md:h-[210px] lg:h-[240px]">
            <div className="space-y-1">
              {userOptions.map((user) => {
                const userId = user._id || user.id;
                const checked = form.assignedUsers.includes(userId);
                return (
                  <button
                    key={userId}
                    type="button"
                    onClick={() => toggleAssignedUser(userId)}
                    disabled={currentUser?.role === "task_only"}
                    className={`flex w-full items-center gap-2.5 rounded-xl border px-3 py-2 text-left transition ${
                      checked ? "border-blue-200 bg-blue-50" : "border-transparent bg-white hover:border-[#dbe4f0] hover:bg-slate-50"
                    } ${currentUser?.role === "task_only" ? "cursor-default" : ""}`}
                  >
                    <UserAvatar user={user} size="sm" className="h-8 w-8 shrink-0 p-0 text-[11px]" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] font-bold text-slate-900">{user.name}</div>
                    </div>
                    <div className={`grid h-4 w-4 shrink-0 place-items-center rounded-full border ${checked ? "border-[#1e3a8a] bg-[#1e3a8a] text-white" : "border-slate-300 bg-white text-transparent"}`}>
                      <UsersRound size={9} />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

function Field({ label, children, className = "" }) {
  return (
    <label className={`block space-y-2 ${className}`}>
      <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">{label}</span>
      {children}
    </label>
  );
}
