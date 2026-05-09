import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000/api",
});

api.interceptors.request.use((config) => {
  // Auth is token-based, so every API request can derive credentials from local storage at send time.
  const token = localStorage.getItem("filingBuddyToken");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    // We treat any 401 as a session reset so the UI does not drift into a half-authenticated state.
    if (error.response?.status === 401) {
      localStorage.removeItem("filingBuddyToken");
      localStorage.removeItem("filingBuddyUser");
      if (!window.location.pathname.includes("/login")) window.location.assign("/login");
    }
    return Promise.reject(error);
  },
);

export default api;
