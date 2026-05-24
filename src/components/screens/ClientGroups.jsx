import { Download, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useApp } from "../../context/AppContext.jsx";
import { groupService } from "../../services/groupService";
import { downloadBlob } from "../../utils/adapterUtils";
import Button from "../ui/Button.jsx";
import Card from "../ui/Card.jsx";
import Table from "../ui/Table.jsx";

export default function ClientGroups() {
  const { state, dispatch } = useApp();
  const [name, setName] = useState("");
  const [editingGroup, setEditingGroup] = useState(null);
  const [editName, setEditName] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [viewingGroup, setViewingGroup] = useState(null);
  const [viewOpen, setViewOpen] = useState(false);
  const load = () => groupService.list().then((groups) => dispatch({
    type: "SET_RESOURCE",
    resource: "groups",
    payload: groups.map((g) => ({
      ...g,
      id: g._id,
      clients: g.clients || [],
      clientNames: g.clients?.map((c) => c.legalName) || [],
    })),
  })).catch(() => {});
  // Groups are reloaded after mutations because the current table renders a simplified client-name list.
  useEffect(() => { load(); }, []);

  const exportGroupsCsv = async () => downloadBlob(await groupService.exportGroups(), "client-groups.csv");
  const exportClientsCsv = async () => downloadBlob(await groupService.exportClients(), "clients.csv");
  const exportThisGroupClientsCsv = async (groupId, groupName) =>
    downloadBlob(await groupService.exportClients(groupId), `${(groupName || "group").replaceAll(" ", "-").toLowerCase()}-clients.csv`);

  function closeModal() {
    setEditingGroup(null);
    setEditName("");
    setModalOpen(false);
  }
  function closeView() {
    setViewingGroup(null);
    setViewOpen(false);
  }
  function handleEdit(group) {
    setEditingGroup(group);
    setEditName(group.name);
    setModalOpen(true);
  }
  function handleView(group) {
    setViewingGroup(group);
    setViewOpen(true);
  }
  async function saveGroup() {
    if (!editName.trim() || !editingGroup) {
      toast.error("Group name is required.");
      return;
    }
    try {
      await groupService.update(editingGroup._id, { name: editName.trim() });
      await load();
      toast.success("Group updated successfully.");
      closeModal();
  } catch (error) {
    toast.error(error?.response?.data?.message || "Unable to update group.");
  }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="page-kicker">Settings</div>
          <h2 className="screen-title">Client Groups</h2>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="ghost" onClick={exportGroupsCsv}>
            <Download size={16} />
            Export (Group-wise)
          </Button>
          <Button variant="ghost" onClick={exportClientsCsv}>
            <Download size={16} />
            Export (Client-wise)
          </Button>

          <input
            id="new-group-name"
            name="newGroupName"
            className="input w-56"
            placeholder="New group name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Button
            onClick={async () => {
              if (name) {
                await groupService.create({ name });
                setName("");
                load();
              }
            }}
          >
            <Plus size={16} />
            Create Group
          </Button>
        </div>
      </div>

      <Card>
        <Table>
          <thead>
            <tr>
              <th>Group Name</th>
              <th>Clients</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {state.groups.map((g) => (
              <tr key={g.id}>
                <td>
                  <button
                    type="button"
                    onClick={() => handleView(g)}
                    className="rounded-full bg-purple-50 px-3 py-1 text-[12px] font-extrabold text-[#7c3aed] hover:bg-purple-100"
                  >
                    {g.name}
                  </button>
                </td>
                <td>{g.clientNames?.join(", ") || "No clients assigned"}</td>
                <td>
                  <Button size="sm" variant="ghost" onClick={() => handleEdit(g)}>
                    Edit
                  </Button>{" "}
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={async () => {
                      await groupService.remove(g._id);
                      load();
                    }}
                  >
                    Ungroup
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>

      {modalOpen && (
        <div className="fixed inset-0 z-40 grid place-items-center bg-slate-900/35 p-4">
          <Card className="w-full max-w-md p-4">
            <div className="mb-4 flex items-center justify-between">
              <div className="text-[16px] font-extrabold">Edit Group</div>
              <button onClick={closeModal} className="text-slate-500 hover:text-slate-700">
                Close
              </button>
            </div>
            <label htmlFor="edit-group-name">
              <span className="field-label">Group Name</span>
              <input
                id="edit-group-name"
                name="editGroupName"
                className="input"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </label>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="ghost" onClick={closeModal}>
                Cancel
              </Button>
              <Button onClick={saveGroup}>Save Changes</Button>
            </div>
          </Card>
        </div>
      )}

      {viewOpen && viewingGroup && (
        <div className="fixed inset-0 z-40 grid place-items-center bg-slate-900/35 p-4">
          <Card className="w-full max-w-lg p-4">
            <div className="mb-4 flex items-center justify-between">
              <div className="text-[16px] font-extrabold">{viewingGroup.name}</div>
              <button onClick={closeView} className="text-slate-500 hover:text-slate-700">
                Close
              </button>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm font-semibold text-slate-600">
                {(viewingGroup.clients || []).length} client(s)
              </div>
              <Button
                variant="ghost"
                onClick={() => exportThisGroupClientsCsv(viewingGroup._id, viewingGroup.name)}
                disabled={!(viewingGroup.clients || []).length}
              >
                <Download size={16} />
                Export This Group (Client-wise)
              </Button>
            </div>

            <div className="mt-3 space-y-2">
              {(viewingGroup.clients || []).length ? (
                <div className="max-h-[55vh] overflow-auto rounded-xl border border-slate-200">
                  <Table>
                    <thead>
                      <tr>
                        <th>Client</th>
                        <th>File No.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(viewingGroup.clients || []).map((c) => (
                        <tr key={c._id}>
                          <td className="font-semibold">{c.legalName}</td>
                          <td className="text-slate-600">{c.fileNo || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </div>
              ) : (
                <div className="rounded-xl bg-slate-50 p-4 text-sm font-semibold text-slate-600">
                  No clients assigned
                </div>
              )}
            </div>

            <div className="mt-4 flex justify-end">
              <Button variant="ghost" onClick={closeView}>
                Close
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
