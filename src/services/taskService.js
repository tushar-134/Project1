import api from "./api";

// Task endpoints are split between regular CRUD and smaller workflow-specific patch calls.
export const taskService = {
  list: (params) => api.get("/tasks", { params }).then((res) => res.data),
  get: (id) => api.get(`/tasks/${id}`).then((res) => res.data),
  create: (payload) => api.post("/tasks", payload).then((res) => res.data),
  update: (id, payload) => api.put(`/tasks/${id}`, payload).then((res) => res.data),
  remove: (id) => api.delete(`/tasks/${id}`).then((res) => res.data),
  updateStatus: (id, status) => api.patch(`/tasks/${id}/status`, { status }).then((res) => res.data),
  ftaTracker: (params) => api.get("/tasks/fta-tracker", { params }).then((res) => res.data),
  updateFtaStatus: (id, ftaStatus) => api.patch(`/tasks/${id}/fta-status`, { ftaStatus }).then((res) => res.data),
  export: (params) => api.get("/tasks/export", { params, responseType: "blob" }).then((res) => res.data),
};
