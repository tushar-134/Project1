import { Plus } from "lucide-react";
import { useEffect } from "react";
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

  useEffect(() => {
    fetchUsers().catch(() => {});
  }, []);

  async function handleAddUser() {
    // These prompts are deliberately lightweight wiring so we can use the existing UI shell without redesigning it.
    const name = window.prompt("User name");
    if (!name) return;
    const email = window.prompt("User email");
    if (!email) return;
    const mobile = window.prompt("User mobile", "+971 ");
    const role = window.prompt("Role: Admin, Manager, or Task Only", "Task Only");
    try {
      await createUser({ name, email, mobile, role: role || "Task Only" });
      toast.success("User created successfully.");
    } catch (error) {
      toast.error(error?.response?.data?.message || error?.response?.data?.errors?.[0]?.msg || "Unable to create user.");
    }
  }

  async function handleEditUser(user) {
    const name = window.prompt("User name", user.name);
    if (!name) return;
    const email = window.prompt("User email", user.email);
    if (!email) return;
    const mobile = window.prompt("User mobile", user.mobile || "");
    try {
      await updateUser(user._id, { name, email, mobile });
      await fetchUsers();
      toast.success("User updated successfully.");
    } catch (error) {
      toast.error(error?.response?.data?.message || "Unable to update user.");
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
