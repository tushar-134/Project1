import api from "./api";

// Group membership edits are handled through a dedicated patch route to avoid replacing whole records.
export const groupService = {
  list: () => api.get("/groups").then((res) => res.data),
  create: (payload) => api.post("/groups", payload).then((res) => res.data),
  update: (id, payload) => api.put(`/groups/${id}`, payload).then((res) => res.data),
  updateClients: (id, payload) => api.patch(`/groups/${id}/clients`, payload).then((res) => res.data),
  remove: (id) => api.delete(`/groups/${id}`).then((res) => res.data),
};
