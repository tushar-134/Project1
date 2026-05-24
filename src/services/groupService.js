import api from "./api";

// Group membership edits are handled through a dedicated patch route to avoid replacing whole records.
export const groupService = {
  list: (params) => api.get("/groups", { params }).then((res) => res.data),
  create: (payload) => api.post("/groups", payload).then((res) => res.data),
  update: (id, payload) => api.put(`/groups/${id}`, payload).then((res) => res.data),
  updateClients: (id, payload) => api.patch(`/groups/${id}/clients`, payload).then((res) => res.data),
  remove: (id) => api.delete(`/groups/${id}`).then((res) => res.data),
  exportGroups: () => api.get("/groups/export", { responseType: "blob" }).then((res) => res.data),
  exportClients: (groupId) =>
    api
      .get("/groups/export", {
        params: { mode: "client", ...(groupId ? { groupId } : {}) },
        responseType: "blob",
      })
      .then((res) => res.data),
};
