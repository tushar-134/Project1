import api from "./api";

// User management is admin-only on the backend, but the service stays generic for reuse in hooks.
export const userService = {
  list: () => api.get("/users").then((res) => res.data),
  get: (id) => api.get(`/users/${id}`).then((res) => res.data),
  create: (payload) => api.post("/users", payload).then((res) => res.data),
  update: (id, payload) => api.put(`/users/${id}`, payload).then((res) => res.data),
  updateRole: (id, role) => api.patch(`/users/${id}/role`, { role }).then((res) => res.data),
  updateStatus: (id, isActive) => api.patch(`/users/${id}/status`, { isActive }).then((res) => res.data),
  remove: (id) => api.delete(`/users/${id}`).then((res) => res.data),
};
