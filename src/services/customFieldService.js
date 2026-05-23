import api from "./api";

export const customFieldService = {
  list: () => api.get("/custom-fields").then((res) => res.data),
  create: (data) => api.post("/custom-fields", data).then((res) => res.data),
  update: (id, data) => api.put(`/custom-fields/${id}`, data).then((res) => res.data),
  remove: (id) => api.delete(`/custom-fields/${id}`).then((res) => res.data),
};
