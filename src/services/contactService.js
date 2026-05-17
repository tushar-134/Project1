import api from "./api";

export const contactService = {
  list: (params) => api.get("/contacts", { params }).then((res) => res.data),
  create: (payload) => api.post("/contacts", payload).then((res) => res.data),
  update: (id, payload) => api.put(`/contacts/${id}`, payload).then((res) => res.data),
  remove: (id) => api.delete(`/contacts/${id}`).then((res) => res.data),
};
