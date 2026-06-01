import { Plus, Briefcase, ChevronRight, Search, X, Eye, EyeOff } from "lucide-react";
import { cloneElement, isValidElement, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { useApp } from "../../context/AppContext.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { useUsers } from "../../hooks/useUsers";
import Button from "../ui/Button.jsx";
import Card from "../ui/Card.jsx";
import Table from "../ui/Table.jsx";
import { DIAL_CODE_OPTIONS } from "../../utils/dialCodeOptions.js";
import { getPhoneNumberSpec, normalizeDialCode, normalizePhoneNumber } from "../../utils/phoneUtils.js";

function normalizeUserField(value) {
  return String(value || "").trim().replace(/\s+/g, " ").toLowerCase();
}

function normalizeMobile(value) {
  return normalizePhoneNumber(value);
}

const DEFAULT_DIAL_CODE = "+971";
const ROLE_DETAILS = {
  "Task Only": {
    summary: "Execution-only access",
    text: "Can work only on assigned tasks. Cannot assign work and cannot delete work.",
  },
  Manager: {
    summary: "Assign only, no delete",
    text: "Can assign work and manage daily operations, but cannot delete work.",
  },
  Admin: {
    summary: "Full access",
    text: "Can assign work, delete work, and manage users, groups, categories, reports, clients, and tasks.",
  },
};

export default function Users({ setSettingsHeaderAction }) {
  const { state } = useApp();
  const { currentUser } = useAuth();
  const { fetchUsers, updateRole, createUser, updateUser, deleteUser, updateStatus } = useUsers();
  // Strictly restrict user management to admin roles
  const canManageUsers = currentUser?.role === "admin";
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [form, setForm] = useState({ name: "", email: "", mobileCountryCode: DEFAULT_DIAL_CODE, mobile: "", role: "Task Only", password: "", confirmPassword: "" });
  const [mobileError, setMobileError] = useState("");
  const [saving, setSaving] = useState(false);
  const [clientSearch, setClientSearch] = useState("");
  const [activeTooltip, setActiveTooltip] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const savingRef = useRef(false);
  const tooltipRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (tooltipRef.current && !tooltipRef.current.contains(event.target)) {
        setActiveTooltip(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    fetchUsers().catch(() => { });
  }, []);

  function closeModal() {
    if (saving) return;
    setModalOpen(false);
    setEditingUser(null);
    setForm({ name: "", email: "", mobileCountryCode: DEFAULT_DIAL_CODE, mobile: "", role: "Task Only", password: "", confirmPassword: "" });
    setMobileError("");
    setClientSearch("");
    setShowPassword(false);
    setShowConfirmPassword(false);
  }

  function handleAddUser() {
    setEditingUser(null);
    setForm({ name: "", email: "", mobileCountryCode: DEFAULT_DIAL_CODE, mobile: "", role: "Task Only", password: "", confirmPassword: "" });
    setMobileError("");
    setModalOpen(true);
  }

  function handleEditUser(user) {
    setEditingUser(user);
    const mobileCountryCode = normalizeDialCode(user.mobileCountryCode) || DEFAULT_DIAL_CODE;
    let mobileNumber = normalizePhoneNumber(user.mobile);
    if (mobileNumber.length > 10) mobileNumber = mobileNumber.slice(-10);
    setForm({
      name: user.name || "",
      email: user.email || "",
      mobileCountryCode,
      mobile: mobileNumber,
      role: user.role || "Task Only",
      password: "",
      confirmPassword: "",
    });
    setMobileError("");
    setModalOpen(true);
  }

  async function saveUser() {
    if (savingRef.current) return;
    if (!form.name.trim() || !form.email.trim()) {
      toast.error("Name and email are required.");
      return;
    }
    if (!editingUser) {
      if (!form.password) {
        toast.error("Password is required.");
        return;
      }
      if (form.password.length < 8) {
        toast.error("Password must be at least 8 characters.");
        return;
      }
      if (form.password !== form.confirmPassword) {
        toast.error("Password and confirm password must match.");
        return;
      }
    } else if (form.password || form.confirmPassword) {
      if (form.password.length < 8) {
        toast.error("Password must be at least 8 characters.");
        return;
      }
      if (form.password !== form.confirmPassword) {
        toast.error("Password and confirm password must match.");
        return;
      }
    }
    const mobileCountryCode = normalizeDialCode(form.mobileCountryCode);
    const mobile = normalizePhoneNumber(form.mobile);
    const { min, max } = getPhoneNumberSpec(mobileCountryCode);
    if (!mobileCountryCode) {
      setMobileError("Country code is required.");
      return;
    }
    if (mobile.length < min || mobile.length > max) {
      setMobileError(`Phone number must be between ${min} and ${max} digits.`);
      return;
    }
    setMobileError("");
    const mobileDigits = normalizePhoneNumber(`${mobileCountryCode}${mobile}`);
    const duplicateUser = state.users.find((user) =>
      user._id !== editingUser?._id &&
      (
        normalizeUserField(user.email) === normalizeUserField(form.email) ||
        (mobileDigits && normalizePhoneNumber(`${user.mobileCountryCode || ""}${user.mobile || ""}`) === mobileDigits) ||
        (!user.mobileCountryCode && normalizeMobile(user.mobile) === mobile)
      )
    );
    if (duplicateUser) {
      toast.error("User already added with this email or phone number.");
      return;
    }
    savingRef.current = true;
    setSaving(true);
    try {
      if (editingUser) {
        const payload = {
          name: form.name.trim(),
          email: form.email.trim(),
          mobileCountryCode,
          mobile,
          role: form.role || "Task Only",
        };
        if (form.password) payload.password = form.password;
        await updateUser(editingUser._id, payload);
        toast.success("User updated successfully.");
      } else {
        await createUser({ name: form.name.trim(), email: form.email.trim(), mobileCountryCode, mobile, role: form.role || "Task Only", password: form.password });
        toast.success("User created successfully.");
      }
      closeModal();
      await fetchUsers();
    } catch (error) {
      toast.error(error?.response?.data?.message || error?.response?.data?.errors?.[0]?.msg || (editingUser ? "Unable to update user." : "Unable to create user."));
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  async function handleRoleChange(user, value) {
    if (currentUser?.id === user._id) {
      toast.error("You cannot change your own role.");
      return;
    }
    try {
      await updateRole(user._id, value);
      toast.success("Role updated successfully.");
    } catch (error) {
      toast.error(error?.response?.data?.message || "Unable to update role.");
    }
  }

  async function handleStatusToggle(user) {
    if (currentUser?.id === user._id && user.status === "Active") {
      toast.error("You cannot deactivate your own account.");
      return;
    }
    try {
      await updateStatus(user._id, user.status !== "Active");
      toast.success("User status updated.");
    } catch (error) {
      toast.error(error?.response?.data?.message || "Unable to update status.");
    }
  }

  async function handleDeleteUser(user) {
    if (!window.confirm(`Delete ${user.name}?`)) return;
    try {
      await deleteUser(user._id);
      toast.success("User deleted successfully.");
    } catch (error) {
      toast.error(error?.response?.data?.message || "Unable to delete user.");
    }
  }

  useEffect(() => {
    if (!setSettingsHeaderAction) return undefined;
    setSettingsHeaderAction(canManageUsers ? (
      <Button onClick={handleAddUser}>
        <Plus size={16} />
        Add User
      </Button>
    ) : null);
    return () => setSettingsHeaderAction(null);
  }, [setSettingsHeaderAction, canManageUsers]);


  return (
    <div className="space-y-5">
      {canManageUsers && (
        <Card className="p-4">
          <div className="mb-2 text-[14px] font-extrabold">Role permissions</div>
          <div className="grid gap-3 md:grid-cols-3">
            <Role title="Task Only" summary={ROLE_DETAILS["Task Only"].summary} text={ROLE_DETAILS["Task Only"].text} />
            <Role title="Manager" summary={ROLE_DETAILS.Manager.summary} text={ROLE_DETAILS.Manager.text} />
            <Role title="Admin" summary={ROLE_DETAILS.Admin.summary} text={ROLE_DETAILS.Admin.text} />
          </div>
        </Card>
      )}
      <Card>
        <Table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Mobile</th>
              <th>Assigned Clients</th>
              <th>Role</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {state.users.map((u) => (
              <tr key={u.id}>
                <td>
                  <div className="flex items-center gap-2">
                    <div className="grid h-8 w-8 place-items-center rounded-full bg-[#1e3a8a] text-[11px] font-black text-white">
                      {u.name.split(" ").map((n) => n[0]).join("")}
                    </div>
                    <span className="font-extrabold">{u.name}</span>
                  </div>
                </td>
                <td>{u.email}</td>
                <td>{u.mobile}</td>
                <td>
                  {u.assignedClients && u.assignedClients.length > 0 ? (
                    <div className="flex items-center gap-1.5">
                      <div className="flex h-6 w-6 items-center justify-center rounded-md bg-blue-50 text-blue-600">
                        <Briefcase size={12} />
                      </div>
                      <span className="text-[13px] font-bold text-slate-700">
                        {u.assignedClients[0].legalName}
                      </span>
                      {u.assignedClients.length > 1 && (
                        <div className="relative">
                          <button
                            type="button"
                            className={`flex h-5 items-center rounded-full px-1.5 text-[10px] font-black transition-all border ${
                              activeTooltip === u._id 
                                ? "bg-blue-600 border-blue-600 text-white shadow-sm shadow-blue-200" 
                                : "bg-slate-100 border-slate-200 text-slate-500 hover:bg-slate-200 hover:border-slate-300"
                            }`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveTooltip(activeTooltip === u._id ? null : u._id);
                            }}
                          >
                            +{u.assignedClients.length - 1}
                          </button>
                          
                          {activeTooltip === u._id && (
                            <div 
                              ref={tooltipRef}
                              className="absolute right-0 top-full z-[100] mt-2 w-64 rounded-2xl border border-slate-100 bg-white p-3 shadow-xl shadow-slate-200/50 animate-in fade-in slide-in-from-top-2 duration-200"
                            >
                              <div className="mb-2 flex items-center justify-between border-b border-slate-50 pb-2">
                                <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">Other Assignments</span>
                                <span className="rounded-md bg-blue-50 px-1.5 py-0.5 text-[10px] font-black text-blue-600">{u.assignedClients.length - 1} More</span>
                              </div>
                              <div className="max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                                <div className="grid gap-1.5">
                                  {u.assignedClients.slice(1).map((client, cIdx) => (
                                    <div key={cIdx} className="flex items-center gap-2 rounded-xl border border-slate-50 bg-slate-50/30 p-2 transition-colors hover:border-blue-100 hover:bg-blue-50/30">
                                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-white text-[10px] font-black text-slate-400 border border-slate-100 shadow-sm">
                                        {client.legalName?.[0] || "C"}
                                      </div>
                                      <div className="min-w-0 flex-1">
                                        <div className="truncate text-[11px] font-extrabold text-slate-700">{client.legalName}</div>
                                        {client.fileNo && (
                                          <div className="text-[9px] font-bold text-slate-400">#{client.fileNo}</div>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                              <div className="absolute -top-1 right-4 h-2 w-2 rotate-45 border-l border-t border-slate-100 bg-white"></div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <span className="text-[12px] italic text-slate-400">Not assigned</span>
                  )}
                </td>
                <td>
                  <select
                    id={`user-role-${u.id}`}
                    name={`userRole${u.id}`}
                    className="input h-8 w-36"
                    value={u.role}
                    disabled={!canManageUsers || currentUser?.id === u._id}
                    onChange={(e) => handleRoleChange(u, e.target.value)}
                  >
                    <option>Task Only</option>
                    <option>Manager</option>
                    <option>Admin</option>
                  </select>
                </td>
                <td>
                  <button
                    className="rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-extrabold text-[#059669] disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={!canManageUsers || (currentUser?.id === u._id && u.status === "Active")}
                    onClick={() => handleStatusToggle(u)}
                  >
                    {u.status}
                  </button>
                </td>
                <td>
                  {canManageUsers ? (
                    <div className="flex gap-2">
                      <Button size="sm" variant="ghost" onClick={() => handleEditUser(u)}>
                        Edit
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => handleDeleteUser(u)}>
                        Delete
                      </Button>
                    </div>
                  ) : (
                    <span className="text-[12px] font-semibold text-slate-400">View only</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
      {modalOpen && (
        <div className="fixed inset-0 z-40 grid place-items-center bg-slate-900/35 p-4">
          <Card className="flex max-h-[calc(100vh-2rem)] w-full max-w-lg flex-col overflow-hidden p-0">
            <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-4 py-4">
              <div className="text-[16px] font-extrabold">{editingUser ? "Edit User" : "Add User"}</div>
              <button
                type="button"
                onClick={closeModal}
                disabled={saving}
                className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Close add user dialog"
                title="Close"
              >
                <X size={18} />
              </button>
            </div>
            <div className="grid gap-3 overflow-y-auto px-4 py-4 custom-scrollbar">
              <Field label="Name" field="user-form-name"><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
              <Field label="Email" field="user-form-email"><input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
              <Field label="Mobile" field="user-form-mobile">
                <div className="flex gap-2">
                  <select
                    className={`input w-44 ${mobileError ? "border-[#dc2626]" : ""}`}
                    value={form.mobileCountryCode}
                    onChange={(e) => {
                      const code = e.target.value;
                      setForm({ ...form, mobileCountryCode: code, mobile: normalizePhoneNumber(form.mobile) });
                      setMobileError("");
                    }}
                  >
                    <option value="">Code</option>
                    {DIAL_CODE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                  <input
                    className={`input ${mobileError ? "border-[#dc2626]" : ""}`}
                    type="tel"
                    autoComplete="tel"
                    inputMode="numeric"
                    placeholder={getPhoneNumberSpec(form.mobileCountryCode).placeholder}
                    value={form.mobile}
                    onChange={(e) => {
                      setForm({ ...form, mobile: normalizePhoneNumber(e.target.value) });
                      setMobileError("");
                    }}
                  />
                </div>
                {mobileError && <div className="mt-1 text-[12px] font-bold text-[#dc2626]">{mobileError}</div>}
              </Field>
              <Field label="Role" field="user-form-role">
                <select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                  <option>Task Only</option>
                  <option>Manager</option>
                  <option>Admin</option>
                </select>
              </Field>
              <div className="rounded-xl border border-[#dbeafe] bg-blue-50/60 p-3">
                <div className="text-[11px] font-black uppercase tracking-wider text-[#1e3a8a]">
                  {ROLE_DETAILS[form.role]?.summary}
                </div>
                <div className="mt-1 text-[13px] font-semibold text-slate-700">
                  {ROLE_DETAILS[form.role]?.text}
                </div>
              </div>
              {!editingUser ? (
                <div className="rounded-xl border border-[#dbeafe] bg-blue-50/60 p-3">
                  <div className="text-[12px] font-bold text-slate-700">
                    Set an initial password for this user.
                  </div>
                  <div className="mt-1 text-[12px] font-semibold text-slate-500">
                    They will use this password for their first login.
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="text-[12px] font-bold text-slate-700">
                    Password change is optional.
                  </div>
                  <div className="mt-1 text-[12px] font-semibold text-slate-500">
                    Leave it blank to keep the current password unchanged.
                  </div>
                </div>
              )}
              <Field label={editingUser ? "New Password" : "Password"} field="user-form-password">
                <div className="flex gap-2">
                  <input className="input" type={showPassword ? "text" : "password"} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
                  <button
                    type="button"
                    className="grid h-10 w-10 flex-none place-items-center rounded-lg border border-[#e2e8f0] bg-white text-slate-600 transition hover:bg-slate-50"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    title={showPassword ? "Hide password" : "Show password"}
                    onClick={() => setShowPassword((value) => !value)}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </Field>
              <Field label={editingUser ? "Confirm New Password" : "Confirm Password"} field="user-form-confirm-password">
                <div className="flex gap-2">
                  <input className="input" type={showConfirmPassword ? "text" : "password"} value={form.confirmPassword} onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })} />
                  <button
                    type="button"
                    className="grid h-10 w-10 flex-none place-items-center rounded-lg border border-[#e2e8f0] bg-white text-slate-600 transition hover:bg-slate-50"
                    aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
                    title={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
                    onClick={() => setShowConfirmPassword((value) => !value)}
                  >
                    {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </Field>
              {editingUser && editingUser.assignedClients && editingUser.assignedClients.length > 0 && (
                <div className="mt-4 border-t border-slate-100 pt-5">
                  <div className="mb-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm shadow-blue-200">
                        <Briefcase size={16} />
                      </div>
                      <div>
                        <div className="text-[14px] font-black text-slate-900 leading-tight">Assigned Clients</div>
                        <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{editingUser.assignedClients.length} Total Records</div>
                      </div>
                    </div>
                    {editingUser.assignedClients.length > 5 && (
                      <div className="relative">
                        <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input 
                          type="search" 
                          placeholder="Search..." 
                          className="h-8 w-32 rounded-lg border border-slate-200 bg-slate-50 pl-10 pr-2 text-[12px] font-bold transition-all focus:w-48 focus:border-blue-400 focus:bg-white focus:outline-none"
                          value={clientSearch}
                          onChange={(e) => setClientSearch(e.target.value)}
                        />
                        {clientSearch && (
                          <button onClick={() => setClientSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                            <X size={12} />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="grid gap-2.5 max-h-60 overflow-y-auto pr-1 custom-scrollbar">
                    {editingUser.assignedClients
                      .filter(c => !clientSearch || c.legalName?.toLowerCase().includes(clientSearch.toLowerCase()) || c.fileNo?.toLowerCase().includes(clientSearch.toLowerCase()))
                      .map((client, idx) => (
                      <div key={idx} className="group flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50/50 p-3 transition-all hover:border-blue-100 hover:bg-white hover:shadow-md hover:shadow-blue-500/5">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-[13px] font-black text-slate-400 border border-slate-100 shadow-sm transition-colors group-hover:border-blue-100 group-hover:bg-blue-50 group-hover:text-blue-600">
                            {client.legalName?.[0] || "C"}
                          </div>
                          <div className="min-w-0">
                            <div className="truncate text-[13px] font-black text-slate-700 group-hover:text-slate-900">{client.legalName}</div>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              {client.fileNo && (
                                <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-500 group-hover:bg-blue-100/50 group-hover:text-blue-500">
                                  {client.fileNo}
                                </span>
                              )}
                              <span className="text-[10px] font-bold text-slate-300">•</span>
                              <span className="text-[10px] font-bold text-slate-400 uppercase">Client</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white border border-slate-100 opacity-0 transition-all group-hover:opacity-100 group-hover:border-blue-100">
                          <ChevronRight size={14} className="text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-blue-500" />
                        </div>
                      </div>
                    ))}
                    {editingUser.assignedClients.filter(c => !clientSearch || c.legalName?.toLowerCase().includes(clientSearch.toLowerCase())).length === 0 && (
                      <div className="flex flex-col items-center justify-center py-6 text-center">
                        <div className="mb-2 rounded-full bg-slate-50 p-3 text-slate-300">
                          <Search size={20} />
                        </div>
                        <div className="text-[12px] font-bold text-slate-400">No clients match your search</div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
            <div className="flex shrink-0 justify-end gap-2 border-t border-slate-100 px-4 py-4">
              <Button variant="ghost" onClick={closeModal} disabled={saving}>Cancel</Button>
              <Button onClick={saveUser} disabled={saving}>{saving ? (editingUser ? "Saving..." : "Creating...") : (editingUser ? "Save Changes" : "Create User")}</Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

function Role({ title, summary, text }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <div className="font-extrabold">{title}</div>
      <div className="mt-1 text-[11px] font-black uppercase tracking-wider text-[#1e3a8a]">{summary}</div>
      <div className="mt-1 text-[12px] font-semibold text-slate-500">{text}</div>
    </div>
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
