import { Plus } from "lucide-react";
import { useEffect } from "react";
import { useApp } from "../../context/AppContext.jsx";
import { useUsers } from "../../hooks/useUsers";
import Button from "../ui/Button.jsx";
import Card from "../ui/Card.jsx";
import Table from "../ui/Table.jsx";

export default function Users() {
  const { state } = useApp();
  const { fetchUsers, updateRole, createUser, updateUser, updateStatus } = useUsers();
  useEffect(() => { fetchUsers().catch(() => {}); }, []);
  async function handleAddUser() {
    // These prompts are deliberately lightweight wiring so we can use the existing UI shell without redesigning it.
    const name = window.prompt("User name");
    if (!name) return;
    const email = window.prompt("User email");
    if (!email) return;
    const mobile = window.prompt("User mobile", "+971 ");
    const role = window.prompt("Role: Admin, Manager, or Task Only", "Task Only");
    await createUser({ name, email, mobile, role: role || "Task Only" });
  }
  async function handleEditUser(user) {
    const name = window.prompt("User name", user.name);
    if (!name) return;
    const email = window.prompt("User email", user.email);
    if (!email) return;
    const mobile = window.prompt("User mobile", user.mobile || "");
    await updateUser(user._id, { name, email, mobile });
    await fetchUsers();
  }
  return <div className="space-y-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><div className="page-kicker">Settings</div><h2 className="screen-title">User Management</h2></div><Button onClick={handleAddUser}><Plus size={16} />Add User</Button></div><Card><Table><thead><tr><th>Name</th><th>Email</th><th>Mobile</th><th>Role</th><th>Status</th><th>Actions</th></tr></thead><tbody>{state.users.map((u) => <tr key={u.id}><td><div className="flex items-center gap-2"><div className="grid h-8 w-8 place-items-center rounded-full bg-[#1e3a8a] text-[11px] font-black text-white">{u.name.split(" ").map(n => n[0]).join("")}</div><span className="font-extrabold">{u.name}</span></div></td><td>{u.email}</td><td>{u.mobile}</td><td><select className="input h-8 w-36" value={u.role} onChange={(e) => updateRole(u._id, e.target.value)}><option>Task Only</option><option>Manager</option><option>Admin</option></select></td><td><button className="rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-extrabold text-[#059669]" onClick={() => updateStatus(u._id, u.status !== "Active")}>{u.status}</button></td><td><Button size="sm" variant="ghost" onClick={() => deleteUser(u._id)}>Edit</Button></td></tr>)}</tbody></Table></Card><Card className="p-4"><div className="mb-2 text-[14px] font-extrabold">Role permissions</div><div className="grid gap-3 md:grid-cols-3"><Role title="Task Only" text="View assigned clients and update task status." /><Role title="Manager" text="Manage clients, tasks, FTA tracker, reports." /><Role title="Admin" text="Full access including users, groups, categories." /></div></Card></div>;
  return <div className="space-y-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><div className="page-kicker">Settings</div><h2 className="screen-title">User Management</h2></div><Button onClick={handleAddUser}><Plus size={16} />Add User</Button></div><Card><Table><thead><tr><th>Name</th><th>Email</th><th>Mobile</th><th>Role</th><th>Status</th><th>Actions</th></tr></thead><tbody>{state.users.map((u) => <tr key={u.id}><td><div className="flex items-center gap-2"><div className="grid h-8 w-8 place-items-center rounded-full bg-[#1e3a8a] text-[11px] font-black text-white">{u.name.split(" ").map(n => n[0]).join("")}</div><span className="font-extrabold">{u.name}</span></div></td><td>{u.email}</td><td>{u.mobile}</td><td><select className="input h-8 w-36" value={u.role} onChange={(e) => updateRole(u._id, e.target.value)}><option>Task Only</option><option>Manager</option><option>Admin</option></select></td><td><button className="rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-extrabold text-[#059669]" onClick={() => updateStatus(u._id, u.status !== "Active")}>{u.status}</button></td><td><Button size="sm" variant="ghost" onClick={() => handleEditUser(u)}>Edit</Button></td></tr>)}</tbody></Table></Card><Card className="p-4"><div className="mb-2 text-[14px] font-extrabold">Role permissions</div><div className="grid gap-3 md:grid-cols-3"><Role title="Task Only" text="View assigned clients and update task status." /><Role title="Manager" text="Manage clients, tasks, FTA tracker, reports." /><Role title="Admin" text="Full access including users, groups, categories." /></div></Card></div>;
}
function Role({ title, text }) { return <div className="rounded-xl bg-slate-50 p-3"><div className="font-extrabold">{title}</div><div className="mt-1 text-[12px] font-semibold text-slate-500">{text}</div></div>; }
