import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api, formatApiErrorDetail, setToken } from "../lib/api";

const AuthContext = createContext(null);

function errorText(e) {
  if (!e?.response) return "Can't reach the server right now. It may still be waking up, please try again in a few seconds.";
  return formatApiErrorDetail(e.response?.data?.detail) || e.message;
}

export function AuthProvider({ children }) {
  // null = checking, false = unauth, object = user
  const [user, setUser] = useState(null);

  const refresh = useCallback(async () => {
    try {
      const r = await api.get("/auth/me");
      if (r?.unauth || !r?.data) {
        setToken(null);
        setUser(false);
        return null;
      }
      setUser(r.data);
      return r.data;
    } catch {
      setUser(false);
      return null;
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const accept = (data) => {
    const { access_token, ...u } = data || {};
    if (access_token) setToken(access_token);
    setUser(u);
    return u;
  };

  const login = async (email, password) => {
    try {
      const { data } = await api.post("/auth/login", { email, password });
      return { ok: true, user: accept(data) };
    } catch (e) {
      return { ok: false, error: errorText(e) };
    }
  };

  // One tap into the public demo account — no typing.
  const demoLogin = async () => {
    try {
      const { data } = await api.post("/auth/demo");
      return { ok: true, user: accept(data) };
    } catch (e) {
      return { ok: false, error: errorText(e) };
    }
  };

  const register = async (payload) => {
    try {
      const { data } = await api.post("/auth/register", payload);
      return { ok: true, user: accept(data) };
    } catch (e) {
      return { ok: false, error: errorText(e) };
    }
  };

  const logout = async () => {
    try {
      await api.post("/auth/logout");
    } catch {}
    setToken(null);
    setUser(false);
  };

  return (
    <AuthContext.Provider value={{ user, setUser, login, demoLogin, register, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
