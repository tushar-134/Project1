import api from "./api";

// Notification endpoints are tiny but grouped here so polling code does not inline route strings.
export const notificationService = {
  list: () => api.get("/notifications").then((res) => res.data),
  markAllRead: () => api.patch("/notifications/mark-all-read").then((res) => res.data),
  markRead: (id) => api.patch(`/notifications/${id}/read`).then((res) => res.data),
};
