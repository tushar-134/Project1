import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { authService } from "../services/authService";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem("filingBuddyToken"));
  const [currentUser, setCurrentUser] = useState(() => {
    const raw = localStorage.getItem("filingBuddyUser");
    return raw ? JSON.parse(raw) : null;
  });
  const [loading, setLoading] = useState(Boolean(token));

  useEffect(() => {
    let active = true;
    async function loadMe() {
      // On refresh we trust the stored token only long enough to ask the API for /me.
      // If that fails, we clear storage so the rest of the app falls back to /login cleanly.
      if (!token) { setLoading(false); return; }
      try {
        const user = await authService.me();
        if (active) {
          setCurrentUser(user);
          localStorage.setItem("filingBuddyUser", JSON.stringify(user));
        }
      } catch {
        localStorage.removeItem("filingBuddyToken");
        localStorage.removeItem("filingBuddyUser");
        if (active) { setToken(null); setCurrentUser(null); }
      } finally {
        if (active) setLoading(false);
      }
    }
    loadMe();
    return () => { active = false; };
  }, [token]);

  async function login(email, password) {
    // We persist both token and the last resolved user snapshot so the UI can paint
    // immediately on reload while /auth/me is still in flight.
    const data = await authService.login(email, password);
    localStorage.setItem("filingBuddyToken", data.token);
    localStorage.setItem("filingBuddyUser", JSON.stringify(data.user));
    setToken(data.token);
    setCurrentUser(data.user);
    return data.user;
  }

  async function logout() {
    try { await authService.logout(); } catch {}
    localStorage.removeItem("filingBuddyToken");
    localStorage.removeItem("filingBuddyUser");
    setToken(null);
    setCurrentUser(null);
    window.location.assign("/login");
  }

  const value = useMemo(() => ({ currentUser, token, loading, login, logout, isAuthenticated: Boolean(token && currentUser) }), [currentUser, token, loading]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
