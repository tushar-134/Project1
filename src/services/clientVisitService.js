import api from "./api";

export const clientVisitService = {
  list: (params) => api.get("/client-visits", { params }).then((res) => res.data),
  get: (id) => api.get(`/client-visits/${id}`).then((res) => res.data),
  create: (payload) => api.post("/client-visits", payload).then((res) => res.data),
  update: (id, payload) => api.put(`/client-visits/${id}`, payload).then((res) => res.data),
  checkIn: (id, payload) => api.post(`/client-visits/${id}/checkin`, payload).then((res) => res.data),
  checkOut: (id, payload) => api.post(`/client-visits/${id}/checkout`, payload).then((res) => res.data),
  updateAttendance: (id, payload) => api.patch(`/client-visits/${id}/attendance`, payload).then((res) => res.data),
  updateStatus: (id, status) => api.patch(`/client-visits/${id}/status`, { status }).then((res) => res.data),
  updateRemarks: (id, remarks) => api.patch(`/client-visits/${id}/remarks`, { remarks }).then((res) => res.data),
  export: (params) => api.get("/client-visits/export", { params, responseType: "blob" }).then((res) => res.data),
};
