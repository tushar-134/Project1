import api from "./api";

// Client endpoints mix JSON CRUD and blob downloads, so the service keeps those response types explicit.
export const clientService = {
  list: (params) => api.get("/clients", { params }).then((res) => res.data),
  get: (id) => api.get(`/clients/${id}`).then((res) => res.data),
  expiryAlerts: () => api.get("/clients/expiry-alerts").then((res) => res.data),
  create: (payload) => api.post("/clients", payload).then((res) => res.data),
  update: (id, payload) => api.put(`/clients/${id}`, payload).then((res) => res.data),
  remove: (id) => api.delete(`/clients/${id}`).then((res) => res.data),
  // Restores an inactive client back to active status
  restore: (id) => api.patch(`/clients/${id}/restore`).then((res) => res.data),
  reactivate: (id) => api.patch(`/clients/${id}/restore`).then((res) => res.data), // Alias to avoid breaking useClients temporarily
  bulkUpload: (rows) => api.post("/clients/bulk-upload", { rows }).then((res) => res.data),
  export: (params) => api.get("/clients/export", { params, responseType: "blob" }).then((res) => res.data),
  uploadAttachment: (id, formData) => api.post(`/clients/${id}/attachments`, formData).then((res) => res.data),
  uploadDocument: (id, formData) => api.post(`/clients/${id}/documents`, formData).then((res) => res.data),
  deleteAttachment: (id, attachId) => api.delete(`/clients/${id}/attachments/${attachId}`).then((res) => res.data),
  deleteDocument: (id, section, index, documentId) => api.delete(`/clients/${id}/documents/${section}/${index}/${documentId}`).then((res) => res.data),
};
