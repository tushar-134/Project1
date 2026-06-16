import { Download, Upload, Plus, Search, UserPlus, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
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
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState(null);
  const [editName, setEditName] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [viewingGroup, setViewingGroup] = useState(null);
  const [selectedExportGroupId, setSelectedExportGroupId] = useState("");
  const [selectedExportClientId, setSelectedExportClientId] = useState("");
  const [allClients, setAllClients] = useState([]);
  const [clientSearch, setClientSearch] = useState("");
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const [groupClientBusy, setGroupClientBusy] = useState(false);
  const clientDropdownRef = useRef(null);

  useEffect(() => {
    if (!showClientDropdown) return;
    function handleClickOutside(event) {
      if (clientDropdownRef.current && !clientDropdownRef.current.contains(event.target)) {
        setShowClientDropdown(false);
        setClientSearch("");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showClientDropdown]);
  const listItems = (response) => Array.isArray(response) ? response : response?.items || response?.clients || [];
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
  const assignedClientIds = useMemo(() => {
    const currentGroupId = String(viewingGroup?._id || "");
    return new Set(
      state.groups
        .filter((group) => String(group._id) !== currentGroupId)
        .flatMap((group) => group.clients || [])
        .map((client) => String(client._id)),
    );
  }, [state.groups, viewingGroup]);
  const availableClients = useMemo(() => {
    const currentGroupId = String(viewingGroup?._id || "");
    return allClients
      .filter((client) => {
        if (assignedClientIds.has(String(client._id))) return false;
        const clientGroupId = String(client.group?._id || client.group || "");
        return !clientGroupId || clientGroupId === currentGroupId;
      })
      .sort((a, b) => String(a.legalName || "").localeCompare(String(b.legalName || "")));
  }, [allClients, assignedClientIds, viewingGroup]);
  const filteredClients = useMemo(() => {
    const query = clientSearch.trim().toLowerCase();
    if (!query) return availableClients;
    return availableClients.filter((client) =>
      [client.legalName, client.fileNo, client.tradeName]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query)),
    );
  }, [availableClients, clientSearch]);
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
    setViewingGroup(null);
    setEditName("");
    setModalOpen(false);
    setClientSearch("");
    setShowClientDropdown(false);
  }
  function handleEdit(group) {
    setEditingGroup(group);
    setViewingGroup(group);
    setEditName(group.name);
    setModalOpen(true);
    setClientSearch("");
    setShowClientDropdown(false);
    if (!allClients.length) loadClients();
  }
  async function loadClients() {
    try {
      const response = await clientService.list({ page: 1, limit: 500, mode: "options" });
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
    const syncedGroup = mappedGroups.find((group) => group._id === groupId) || null;
    setViewingGroup(syncedGroup);
    setEditingGroup(syncedGroup);
  }
  async function addClientToGroup(clientId) {
    if (!viewingGroup?._id) return;
    try {
      setGroupClientBusy(true);
      await groupService.updateClients(viewingGroup._id, { add: [clientId] });
      await syncViewingGroup(viewingGroup._id);
      setShowClientDropdown(false);
      setClientSearch("");
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
  async function createGroup() {
    if (!name.trim()) {
      toast.error("Group name is required.");
      return;
    }
    try {
      await groupService.create({ name: name.trim() });
      setName("");
      setCreateModalOpen(false);
      await load();
      toast.success("Group created successfully.");
    } catch (error) {
      toast.error(error?.response?.data?.message || "Unable to create group.");
    }
  }

  useEffect(() => {
    if (!setSettingsHeaderAction) return undefined;
    setSettingsHeaderAction(
      <div className="flex justify-end">
        <Button onClick={() => setCreateModalOpen(true)}>
          <Plus size={16} />
          Create Group
        </Button>
      </div>
    );
    return () => setSettingsHeaderAction(null);
  }, [setSettingsHeaderAction]);

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

          <Button variant="outlinePurple" onClick={exportGroupsExcel} disabled={!!selectedExportClientId}>
            <Upload size={16} />
            Export Group-wise
          </Button>
          <Button variant="outlinePurple" onClick={exportClientsExcel}>
            <Upload size={16} />
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
                <td className="font-semibold text-slate-800">{g.name}</td>
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

      {createModalOpen && (
        <div className="fixed inset-0 z-40 grid place-items-center bg-slate-900/35 p-4">
          <Card className="w-full max-w-md p-4">
            <div className="mb-4 flex items-center justify-between">
              <div className="text-[16px] font-extrabold">New Group</div>
              <button
                type="button"
                onClick={() => {
                  setName("");
                  setCreateModalOpen(false);
                }}
                aria-label="Close new group"
                className="grid h-9 w-9 place-items-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
              >
                <X size={18} />
              </button>
            </div>

            <label htmlFor="new-group-name">
              <span className="field-label">Group Name</span>
              <input
                id="new-group-name"
                name="newGroupName"
                className="input"
                placeholder="New group name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </label>

            <div className="mt-4 flex justify-end gap-2">
              <Button
                variant="ghost"
                onClick={() => {
                  setName("");
                  setCreateModalOpen(false);
                }}
              >
                Cancel
              </Button>
              <Button onClick={createGroup}>
                <Plus size={16} />
                Create Group
              </Button>
            </div>
          </Card>
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-40 grid place-items-center bg-slate-900/35 p-4">
          <Card className="w-full max-w-lg p-4">
            <div className="mb-4 flex items-center justify-between">
              <div className="text-[16px] font-extrabold">Edit Group</div>
              <button
                type="button"
                onClick={closeModal}
                aria-label="Close edit group"
                className="grid h-9 w-9 place-items-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
              >
                <X size={18} />
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

            {viewingGroup && (
              <>
                <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm font-semibold text-slate-600">
                    {(viewingGroup.clients || []).length} client(s)
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      variant="ghost"
                      onClick={() => exportThisGroupClientsExcel(viewingGroup._id, viewingGroup.name)}
                      disabled={!(viewingGroup.clients || []).length}
                    >
                      <Upload size={16} />
                      Export This Group (Client-wise)
                    </Button>
                  </div>
                </div>

                <div className="mt-3 space-y-2">
                  {(viewingGroup.clients || []).length ? (
                    <div className="max-h-[45vh] overflow-auto rounded-xl border border-slate-200">
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
                  <div className="relative inline-flex" ref={clientDropdownRef}>
                    <Button
                      variant="ghost"
                      disabled={groupClientBusy}
                      onClick={() => {
                        setShowClientDropdown((open) => !open);
                        if (!allClients.length) loadClients();
                      }}
                    >
                      <UserPlus size={16} />
                      Add Client
                    </Button>

                    {showClientDropdown && (
                      <div className="absolute left-0 top-full z-50 mt-2 w-[min(26rem,calc(100vw-3rem))] rounded-2xl border border-slate-200 bg-white p-3 shadow-2xl shadow-slate-900/10">
                        <div className="relative">
                          <Search size={15} className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" />
                          <input
                            className="h-10 w-full rounded-lg border border-slate-200 bg-white py-2 pl-12 pr-3 text-[13px] outline-none transition placeholder:text-slate-400 focus:border-[#1e3a8a] focus:ring-2 focus:ring-[#1e3a8a]/15"
                            placeholder="Search existing clients..."
                            value={clientSearch}
                            onChange={(event) => setClientSearch(event.target.value)}
                            autoFocus
                          />
                        </div>

                        <div className="mt-3 max-h-32 overflow-auto pr-1">
                          {filteredClients.length ? (
                            <div className="space-y-2">
                              {filteredClients.map((client) => (
                                <button
                                  key={client._id}
                                  type="button"
                                  disabled={groupClientBusy}
                                  onClick={() => addClientToGroup(client._id)}
                                  className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2 text-left transition hover:border-blue-200 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60"
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
                            <div className="rounded-xl bg-slate-50 p-3 text-sm font-semibold text-slate-500">
                              {availableClients.length ? "No clients match your search" : "No clients available to add"}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            <div className="mt-4 flex justify-end gap-2">
              <Button variant="ghost" onClick={closeModal}>
                Cancel
              </Button>
              <Button onClick={saveGroup}>Save Changes</Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
