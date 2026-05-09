import api from "./api";

// Categories expose task-type subdocument mutations that do not fit the normal CRUD shape.
export const categoryService = {
  list: () => api.get("/categories").then((res) => res.data),
  create: (payload) => api.post("/categories", payload).then((res) => res.data),
  update: (id, payload) => api.put(`/categories/${id}`, payload).then((res) => res.data),
  remove: (id) => api.delete(`/categories/${id}`).then((res) => res.data),
  addTaskType: (id, name) => api.post(`/categories/${id}/task-types`, { name }).then((res) => res.data),
  removeTaskType: (id, typeId) => api.delete(`/categories/${id}/task-types/${typeId}`).then((res) => res.data),
};
