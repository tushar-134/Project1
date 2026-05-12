import { Plus } from "lucide-react";
import { cloneElement, isValidElement, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useApp } from "../../context/AppContext.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { useUsers } from "../../hooks/useUsers";
import Button from "../ui/Button.jsx";
import Card from "../ui/Card.jsx";
import Table from "../ui/Table.jsx";

export default function Users() {
  const { state } = useApp();
  const { currentUser } = useAuth();
  const { fetchUsers, updateRole, createUser, updateUser, deleteUser, updateStatus } = useUsers();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [form, setForm] = useState({ name: "", email: "", mobile: "", role: "Task Only" });

  useEffect(() => {
    fetchUsers().catch(() => {});
  }, []);

  function closeModal() {
    setModalOpen(false);
    setEditingUser(null);
    setForm({ name: "", email: "", mobile: "", role: "Task Only" });
  }

  function handleAddUser() {
    setEditingUser(null);
    setForm({ name: "", email: "", mobile: "+971 ", role: "Task Only" });
    setModalOpen(true);
  }

  function handleEditUser(user) {
    setEditingUser(user);
    setForm({
      name: user.name || "",
      email: user.email || "",
      mobile: user.mobile || "",
      role: user.role || "Task Only",
    });
    setModalOpen(true);
  }

  async function saveUser() {
    if (!form.name.trim() || !form.email.trim()) {
      toast.error("Name and email are required.");
      return;
    }
    try {
      if (editingUser) {
        await updateUser(editingUser._id, { name: form.name.trim(), email: form.email.trim(), mobile: form.mobile.trim() });
        toast.success("User updated successfully.");
      } else {
        await createUser({ name: form.name.trim(), email: form.email.trim(), mobile: form.mobile.trim(), role: form.role || "Task Only" });
        toast.success("User created successfully.");
      }
      closeModal();
      await fetchUsers();
    } catch (error) {
      toast.error(error?.response?.data?.message || error?.response?.data?.errors?.[0]?.msg || (editingUser ? "Unable to update user." : "Unable to create user."));
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

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="page-kicker">Settings</div>
          <h2 className="screen-title">User Management</h2>
        </div>
        <Button onClick={handleAddUser}>
          <Plus size={16} />
          Add User
        </Button>
      </div>
      <Card>
        <Table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Mobile</th>
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
                  <select
                    id={`user-role-${u.id}`}
                    name={`userRole${u.id}`}
                    className="input h-8 w-36"
                    value={u.role}
                    disabled={currentUser?.id === u._id}
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
                    disabled={currentUser?.id === u._id && u.status === "Active"}
                    onClick={() => handleStatusToggle(u)}
                  >
                    {u.status}
                  </button>
                </td>
                <td>
                  <div className="flex gap-2">
                    <Button size="sm" variant="ghost" onClick={() => handleEditUser(u)}>
                      Edit
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => handleDeleteUser(u)}>
                      Delete
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
      <Card className="p-4">
        <div className="mb-2 text-[14px] font-extrabold">Role permissions</div>
        <div className="grid gap-3 md:grid-cols-3">
          <Role title="Task Only" text="View assigned clients and update task status." />
          <Role title="Manager" text="Manage clients, tasks, FTA tracker, reports." />
          <Role title="Admin" text="Full access including users, groups, categories." />
        </div>
      </Card>
      {modalOpen && (
        <div className="fixed inset-0 z-40 grid place-items-center bg-slate-900/35 p-4">
          <Card className="w-full max-w-lg p-4">
            <div className="mb-4 flex items-center justify-between">
              <div className="text-[16px] font-extrabold">{editingUser ? "Edit User" : "Add User"}</div>
              <button onClick={closeModal} className="text-slate-500 hover:text-slate-700">Close</button>
            </div>
            <div className="grid gap-3">
              <Field label="Name" field="user-form-name"><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
              <Field label="Email" field="user-form-email"><input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
              <Field label="Mobile" field="user-form-mobile"><input className="input" value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} /></Field>
              {!editingUser && (
                <Field label="Role" field="user-form-role">
                  <select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                    <option>Task Only</option>
                    <option>Manager</option>
                    <option>Admin</option>
                  </select>
                </Field>
              )}
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="ghost" onClick={closeModal}>Cancel</Button>
              <Button onClick={saveUser}>{editingUser ? "Save Changes" : "Create User"}</Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

function Role({ title, text }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <div className="font-extrabold">{title}</div>
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
