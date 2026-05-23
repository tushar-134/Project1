import api from "./api";

// Reports are read-only endpoints, so this module stays intentionally simple.
export const reportService = {
  dashboardStats: (params) => api.get("/reports/dashboard-stats", { params }).then((res) => res.data),
  loginActivity: (params) => api.get("/reports/v2/login-activity", { params }).then((res) => res.data),
  taskActivity: (params) => api.get("/reports/v2/task-activity", { params }).then((res) => res.data),
  clientWise: (params) => api.get("/reports/v2/client-wise", { params }).then((res) => res.data),
  userWise: (params) => api.get("/reports/v2/user-wise", { params }).then((res) => res.data),
  overdue: (params) => api.get("/reports/v2/overdue", { params }).then((res) => res.data),
  ftaTracker: (params) => api.get("/reports/v2/fta-tracker", { params }).then((res) => res.data),
  exportCsv: (report, params) => api.get(`/reports/v2/${report}/export`, { params, responseType: "blob" }).then((res) => res.data),
};
