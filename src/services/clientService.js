import api from "./api";

// Client endpoints mix JSON CRUD and blob downloads, so the service keeps those response types explicit.
export const clientService = {
  list: (params) => api.get("/clients", { params }).then((res) => res.data),
  get: (id) => api.get(`/clients/${id}`).then((res) => res.data),
  create: (payload) => api.post("/clients", payload).then((res) => res.data),
  update: (id, payload) => api.put(`/clients/${id}`, payload).then((res) => res.data),
  remove: (id) => api.delete(`/clients/${id}`).then((res) => res.data),
  bulkUpload: (rows) => api.post("/clients/bulk-upload", { rows }).then((res) => res.data),
  export: () => api.get("/clients/export", { responseType: "blob" }).then((res) => res.data),
  uploadAttachment: (id, formData) => api.post(`/clients/${id}/attachments`, formData).then((res) => res.data),
  deleteAttachment: (id, attachId) => api.delete(`/clients/${id}/attachments/${attachId}`).then((res) => res.data),
};
