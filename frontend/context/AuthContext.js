import { createContext, useContext, useState, useEffect } from "react";
import { api } from "../utils/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedToken = localStorage.getItem("stegochain_token");
    const savedUser = localStorage.getItem("stegochain_user");
    
    if (savedToken && savedUser) {
      // Optimistically set user
      try {
        setToken(savedToken);
        setUser(JSON.parse(savedUser));
      } catch {
        localStorage.removeItem("stegochain_token");
        localStorage.removeItem("stegochain_user");
      }

      // Validate token with backend
      api.get("/api/auth/me", { headers: { Authorization: `Bearer ${savedToken}` } })
        .catch(() => {
          setToken(null);
          setUser(null);
          localStorage.removeItem("stegochain_token");
          localStorage.removeItem("stegochain_user");
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  function login(tokenStr, userData) {
    setToken(tokenStr);
    setUser(userData);
    localStorage.setItem("stegochain_token", tokenStr);
    localStorage.setItem("stegochain_user", JSON.stringify(userData));
  }

  function logout() {
    setToken(null);
    setUser(null);
    localStorage.removeItem("stegochain_token");
    localStorage.removeItem("stegochain_user");
  }

  return (
    <AuthContext.Provider value={{ user, token, login, logout, loading, isAuthenticated: !!token }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() { return useContext(AuthContext); }
