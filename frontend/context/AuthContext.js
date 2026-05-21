import { createContext, useContext, useState, useEffect } from "react";
import { api } from "../utils/api";

const AuthContext = createContext(null);

// Decode JWT payload without verifying signature (client-side only)
function parseJwtExpiry(token) {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.exp ? payload.exp * 1000 : Infinity; // convert to ms
  } catch {
    return 0; // invalid token
  }
}

export function AuthProvider({ children }) {
  const [user, setUser]   = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedToken = localStorage.getItem("stegochain_token");
    const savedUser  = localStorage.getItem("stegochain_user");

    if (savedToken && savedUser) {
      // Check JWT expiry client-side — no network call needed
      const expiry = parseJwtExpiry(savedToken);
      if (expiry > Date.now()) {
        // Token is still valid — set immediately, no round-trip required
        try {
          setToken(savedToken);
          setUser(JSON.parse(savedUser));
        } catch {
          localStorage.removeItem("stegochain_token");
          localStorage.removeItem("stegochain_user");
        }
        setLoading(false);

        // Background re-validate only if token expires within 30 mins
        const expiresInMs = expiry - Date.now();
        if (expiresInMs < 30 * 60 * 1000) {
          api.get("/api/auth/me", { headers: { Authorization: `Bearer ${savedToken}` } })
            .catch(() => {
              setToken(null); setUser(null);
              localStorage.removeItem("stegochain_token");
              localStorage.removeItem("stegochain_user");
            });
        }
      } else {
        // Token expired — clear it immediately
        localStorage.removeItem("stegochain_token");
        localStorage.removeItem("stegochain_user");
        setLoading(false);
      }
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
