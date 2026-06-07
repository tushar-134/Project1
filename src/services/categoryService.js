import api from "./api";

// Categories expose task-type subdocument mutations that do not fit the normal CRUD shape.
export const categoryService = {
  list: (options = {}) => api.get("/categories", {
    params: options.includeInactive ? { includeInactive: true } : undefined,
  }).then((res) => res.data),
  create: (payload) => api.post("/categories", payload).then((res) => res.data),
  update: (id, payload) => api.put(`/categories/${id}`, payload).then((res) => res.data),
  remove: (id) => api.delete(`/categories/${id}`).then((res) => res.data),
  // addTaskType now accepts a full payload so the modal can pass visibility toggles alongside the name.
  addTaskType: (id, payload) => api.post(`/categories/${id}/task-types`, payload).then((res) => res.data),
  // updateTaskType updates a task type's name and/or field-visibility toggles from the edit modal.
  updateTaskType: (id, typeId, payload) => api.put(`/categories/${id}/task-types/${typeId}`, payload).then((res) => res.data),
  updateTaskTypeStatus: (id, typeId, isActive) => api.patch(`/categories/${id}/task-types/${typeId}/status`, { isActive }).then((res) => res.data),
  removeTaskType: (id, typeId) => api.delete(`/categories/${id}/task-types/${typeId}`).then((res) => res.data),
};
