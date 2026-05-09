import api from "./api";

// Service modules keep endpoint details out of screens and contexts.
export const authService = {
  login: (email, password) => api.post("/auth/login", { email, password }).then((res) => res.data),
  logout: () => api.post("/auth/logout").then((res) => res.data),
  me: () => api.get("/auth/me").then((res) => res.data.user),
  changePassword: (payload) => api.put("/auth/change-password", payload).then((res) => res.data),
};
