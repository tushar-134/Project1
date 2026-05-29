import { Download, Plus, UserPlus, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { useApp } from "../../context/AppContext.jsx";
import { clientService } from "../../services/clientService";
import { groupService } from "../../services/groupService";
import { downloadBlob } from "../../utils/adapterUtils";
import Button from "../ui/Button.jsx";
import Card from "../ui/Card.jsx";
import Table from "../ui/Table.jsx";

export default function ClientGroups({ setSettingsHeaderAction }) {
  const { state, dispatch } = useApp();
  const [name, setName] = useState("");
  const [editingGroup, setEditingGroup] = useState(null);
  const [editName, setEditName] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [viewingGroup, setViewingGroup] = useState(null);
  const [viewOpen, setViewOpen] = useState(false);
  const [selectedExportGroupId, setSelectedExportGroupId] = useState("");
  const [selectedExportClientId, setSelectedExportClientId] = useState("");
  const [allClients, setAllClients] = useState([]);
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const [groupClientBusy, setGroupClientBusy] = useState(false);
  const listItems = (response) => Array.isArray(response) ? response : response?.items || [];
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

  const selectedExportGroup = state.groups.find((group) => group._id === selectedExportGroupId);
  const exportClientOptions = selectedExportGroup
    ? selectedExportGroup.clients || []
    : state.groups.flatMap((group) => group.clients || []);
  const assignedClientIds = useMemo(
    () => new Set((viewingGroup?.clients || []).map((client) => String(client._id))),
    [viewingGroup],
  );
  const availableClients = useMemo(() => {
    return allClients
      .filter((client) => !assignedClientIds.has(String(client._id)))
      .sort((a, b) => String(a.legalName || "").localeCompare(String(b.legalName || "")));
  }, [allClients, assignedClientIds]);
  const safeFilename = (value, fallback) =>
    String(value || fallback)
      .trim()
      .replaceAll(" ", "-")
      .replace(/[^a-zA-Z0-9-_]/g, "")
      .toLowerCase();

  const exportGroupsExcel = async () => {
    const filename = selectedExportGroup ? `${safeFilename(selectedExportGroup.name, "client-group")}.xlsx` : "client-groups.xlsx";
    downloadBlob(await groupService.exportGroups(selectedExportGroupId), filename);
  };
  const exportClientsExcel = async () => {
    const selectedClient = exportClientOptions.find((client) => client._id === selectedExportClientId);
    const filename = selectedClient
      ? `${safeFilename(selectedClient.legalName, "client")}.xlsx`
      : selectedExportGroup
        ? `${safeFilename(selectedExportGroup.name, "group")}-clients.xlsx`
        : "clients.xlsx";
    downloadBlob(
      await groupService.exportClients({
        groupId: selectedExportGroupId,
        clientId: selectedExportClientId,
      }),
      filename,
    );
  };
  const exportThisGroupClientsExcel = async (groupId, groupName) =>
    downloadBlob(await groupService.exportClients({ groupId }), `${safeFilename(groupName, "group")}-clients.xlsx`);

  function closeModal() {
    setEditingGroup(null);
    setEditName("");
    setModalOpen(false);
  }
  function closeView() {
    setViewingGroup(null);
    setViewOpen(false);
    setShowClientDropdown(false);
  }
  function handleEdit(group) {
    setEditingGroup(group);
    setEditName(group.name);
    setModalOpen(true);
  }
  function handleView(group) {
    setViewingGroup(group);
    setViewOpen(true);
    setShowClientDropdown(false);
    if (!allClients.length) loadClients();
  }
  async function loadClients() {
    try {
      const response = await clientService.list({ page: 1, limit: 500 });
      setAllClients(listItems(response));
    } catch (error) {
      toast.error(error?.response?.data?.message || "Unable to load clients.");
    }
  }
  async function syncViewingGroup(groupId) {
    const groups = await groupService.list();
    const mappedGroups = groups.map((g) => ({
      ...g,
      id: g._id,
      clients: g.clients || [],
      clientNames: g.clients?.map((c) => c.legalName) || [],
    }));
    dispatch({ type: "SET_RESOURCE", resource: "groups", payload: mappedGroups });
    setViewingGroup(mappedGroups.find((group) => group._id === groupId) || null);
  }
  async function addClientToGroup(clientId) {
    if (!viewingGroup?._id) return;
    try {
      setGroupClientBusy(true);
      await groupService.updateClients(viewingGroup._id, { add: [clientId] });
      await syncViewingGroup(viewingGroup._id);
      setShowClientDropdown(false);
      toast.success("Client added to group.");
    } catch (error) {
      toast.error(error?.response?.data?.message || "Unable to add client.");
    } finally {
      setGroupClientBusy(false);
    }
  }
  async function removeClientFromGroup(clientId) {
    if (!viewingGroup?._id) return;
    try {
      setGroupClientBusy(true);
      await groupService.updateClients(viewingGroup._id, { remove: [clientId] });
      await syncViewingGroup(viewingGroup._id);
      toast.success("Client removed from group.");
    } catch (error) {
      toast.error(error?.response?.data?.message || "Unable to remove client.");
    } finally {
      setGroupClientBusy(false);
    }
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

  useEffect(() => {
    if (!setSettingsHeaderAction) return undefined;
    setSettingsHeaderAction(
      <div className="flex flex-wrap justify-end gap-2">
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
    );
    return () => setSettingsHeaderAction(null);
  }, [setSettingsHeaderAction, name]);

  return (
    <div className="space-y-5">
      <Card className="p-4">
        <div className="grid gap-3 md:grid-cols-[minmax(180px,1fr)_minmax(180px,1fr)_auto_auto] md:items-end">
          <label htmlFor="export-group">
            <span className="field-label">Group</span>
            <select
              id="export-group"
              name="exportGroup"
              className="input"
              value={selectedExportGroupId}
              onChange={(event) => {
                setSelectedExportGroupId(event.target.value);
                setSelectedExportClientId("");
              }}
            >
              <option value="">All groups</option>
              {state.groups.map((group) => (
                <option key={group._id} value={group._id}>
                  {group.name}
                </option>
              ))}
            </select>
          </label>

          <label htmlFor="export-client">
            <span className="field-label">Client</span>
            <select
              id="export-client"
              name="exportClient"
              className="input"
              value={selectedExportClientId}
              onChange={(event) => setSelectedExportClientId(event.target.value)}
            >
              <option value="">All clients</option>
              {exportClientOptions.map((client) => (
                <option key={client._id} value={client._id}>
                  {client.legalName}
                </option>
              ))}
            </select>
          </label>

          <Button variant="ghost" onClick={exportGroupsExcel} disabled={!!selectedExportClientId}>
            <Download size={16} />
            Export Group-wise
          </Button>
          <Button variant="ghost" onClick={exportClientsExcel}>
            <Download size={16} />
            Export Client-wise
          </Button>
        </div>
      </Card>

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
              <button
                type="button"
                onClick={closeView}
                aria-label="Close group details"
                className="grid h-9 w-9 place-items-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm font-semibold text-slate-600">
                {(viewingGroup.clients || []).length} client(s)
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="ghost"
                  onClick={() => exportThisGroupClientsExcel(viewingGroup._id, viewingGroup.name)}
                  disabled={!(viewingGroup.clients || []).length}
                >
                  <Download size={16} />
                  Export This Group (Client-wise)
                </Button>
              </div>
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
                          <td className="text-slate-600">
                            <div className="flex items-center justify-between gap-3">
                              <span>{c.fileNo || "-"}</span>
                              <button
                                type="button"
                                disabled={groupClientBusy}
                                onClick={() => removeClientFromGroup(c._id)}
                                aria-label={`Remove ${c.legalName} from group`}
                                className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-slate-400 transition hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                <X size={15} />
                              </button>
                            </div>
                          </td>
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

            <div className="mt-4 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="ghost"
                  disabled={groupClientBusy}
                  onClick={() => {
                    setShowClientDropdown(true);
                    if (!allClients.length) loadClients();
                  }}
                >
                  <UserPlus size={16} />
                  Add Client
                </Button>
              </div>

              {showClientDropdown && (
                <div className="max-h-56 overflow-auto rounded-2xl border border-slate-200 bg-slate-50/70 p-2">
                  {availableClients.length ? (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {availableClients.map((client) => (
                        <button
                          key={client._id}
                          type="button"
                          disabled={groupClientBusy}
                          onClick={() => addClientToGroup(client._id)}
                          className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-white px-3 py-2 text-left transition hover:border-blue-200 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-extrabold text-slate-800">{client.legalName}</span>
                            <span className="block truncate text-xs font-semibold text-slate-500">{client.fileNo || "No file no."}</span>
                          </span>
                          <Plus size={16} className="shrink-0 text-blue-600" />
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-xl bg-white p-3 text-sm font-semibold text-slate-500">
                      No clients available to add
                    </div>
                  )}
                </div>
              )}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
