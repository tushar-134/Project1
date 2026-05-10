import axios from "axios";

function resolveApiBaseUrl() {
  const configured = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
  try {
    const url = new URL(configured);
    const appHost = window.location.hostname;
    // When the app is opened on 127.0.0.1 but env points at localhost (or the reverse),
    // we normalize both sides to the active host so browser CORS/origin behavior stays predictable.
    if ([ "localhost", "127.0.0.1" ].includes(url.hostname) && [ "localhost", "127.0.0.1" ].includes(appHost)) {
      url.hostname = appHost;
    }
    return url.toString().replace(/\/$/, "");
  } catch {
    return configured;
  }
}

const api = axios.create({
  baseURL: resolveApiBaseUrl(),
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
