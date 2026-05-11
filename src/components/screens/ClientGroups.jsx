import { Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { useApp } from "../../context/AppContext.jsx";
import { groupService } from "../../services/groupService";
import Button from "../ui/Button.jsx";
import Card from "../ui/Card.jsx";
import Table from "../ui/Table.jsx";

export default function ClientGroups() {
  const { state, dispatch } = useApp();
  const [name, setName] = useState("");
  const load = () => groupService.list().then((groups) => dispatch({ type: "SET_RESOURCE", resource: "groups", payload: groups.map((g) => ({ ...g, id: g._id, clients: g.clients?.map((c) => c.legalName) || [] })) })).catch(() => {});
  // Groups are reloaded after mutations because the current table renders a simplified client-name list.
  useEffect(() => { load(); }, []);
  async function handleEdit(group) {
    const nextName = window.prompt("Group name", group.name);
    if (!nextName) return;
    await groupService.update(group._id, { name: nextName });
    load();
  }
 return <div className="space-y-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><div className="page-kicker">Settings</div><h2 className="screen-title">Client Groups</h2></div><div className="flex gap-2"><input id="new-group-name" name="newGroupName" className="input w-56" placeholder="New group name" value={name} onChange={(e) => setName(e.target.value)} /><Button onClick={async () => { if (name) { await groupService.create({ name }); setName(""); load(); } }}><Plus size={16} />Create Group</Button></div></div><Card><Table><thead><tr><th>Group Name</th><th>Clients</th><th>Actions</th></tr></thead><tbody>{state.groups.map((g) => <tr key={g.id}><td><span className="rounded-full bg-purple-50 px-3 py-1 text-[12px] font-extrabold text-[#7c3aed]">{g.name}</span></td><td>{g.clients.join(", ") || "No clients assigned"}</td><td><Button size="sm" variant="ghost" onClick={() => handleEdit(g)}>Edit</Button> <Button size="sm" variant="danger" onClick={async () => { await groupService.remove(g._id); load(); }}>Ungroup</Button></td></tr>)}</tbody></Table></Card></div>;
}
