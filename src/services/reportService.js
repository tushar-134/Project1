import api from "./api";

// Reports are read-only endpoints, so this module stays intentionally simple.
export const reportService = {
  dashboardStats: (params) => api.get("/reports/dashboard-stats", { params }).then((res) => res.data),
  loginActivity: () => api.get("/reports/login-activity").then((res) => res.data),
  taskActivity: () => api.get("/reports/task-activity").then((res) => res.data),
  clientWise: () => api.get("/reports/client-wise").then((res) => res.data),
  userWise: () => api.get("/reports/user-wise").then((res) => res.data),
  overdue: () => api.get("/reports/overdue").then((res) => res.data),
  ftaTracker: () => api.get("/reports/fta-tracker").then((res) => res.data),
};
