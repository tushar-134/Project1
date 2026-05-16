import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { authService } from "../services/authService";

const AuthContext = createContext(null);

function readStoredUser() {
  try {
    const raw = localStorage.getItem("filingBuddyUser");
    return raw ? JSON.parse(raw) : null;
  } catch {
    localStorage.removeItem("filingBuddyUser");
    return null;
  }
}

function clearStoredSession() {
  localStorage.removeItem("filingBuddyToken");
  localStorage.removeItem("filingBuddyUser");
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem("filingBuddyToken"));
  const [currentUser, setCurrentUser] = useState(() => readStoredUser());
  const [loading, setLoading] = useState(Boolean(token));
  // Tracks whether we just completed a login so the token-change effect
  // can skip a redundant /me call (we already have a fresh user object).
  const justLoggedIn = useRef(false);

  useEffect(() => {
    let active = true;
    async function loadMe() {
      // On refresh we trust the stored token only long enough to ask the API for /me.
      // If that fails, we clear storage so the rest of the app falls back to /login cleanly.
      if (!token) { setLoading(false); return; }
      // Skip the refetch when login() just set the token — we already have a fresh user.
      if (justLoggedIn.current) { justLoggedIn.current = false; setLoading(false); return; }
      try {
        const user = await authService.me();
        if (active) {
          setCurrentUser(user);
          localStorage.setItem("filingBuddyUser", JSON.stringify(user));
        }
      } catch {
        clearStoredSession();
        if (active) { setToken(null); setCurrentUser(null); }
      } finally {
        if (active) setLoading(false);
      }
    }
    loadMe();
    return () => { active = false; };
  }, [token]);

  const login = useCallback(async (email, password) => {
    // We persist both token and the last resolved user snapshot so the UI can paint
    // immediately on reload while /auth/me is still in flight.
    clearStoredSession();
    const data = await authService.login(email.trim(), password);
    if (data?.token && data?.user) {
      justLoggedIn.current = true;
      localStorage.setItem("filingBuddyToken", data.token);
      localStorage.setItem("filingBuddyUser", JSON.stringify(data.user));
      setToken(data.token);
      setCurrentUser(data.user);
      return data.user;
    }
    throw new Error("Login response was incomplete.");
  }, []);

  const logout = useCallback(async () => {
    try { await authService.logout(); } catch {}
    clearStoredSession();
    setToken(null);
    setCurrentUser(null);
    window.location.assign("/login");
  }, []);

  const value = useMemo(() => ({ currentUser, token, loading, login, logout, isAuthenticated: Boolean(token && currentUser) }), [currentUser, token, loading, login, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
