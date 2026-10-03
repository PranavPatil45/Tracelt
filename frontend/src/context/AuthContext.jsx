import { createContext, useContext, useState, useEffect } from "react";
import { loginUser, registerUser, getCurrentUser } from "../api/auth.js";

const AuthContext = createContext(null);

const TOKEN_KEY = "tracelt_token";
const USER_KEY = "tracelt_user";

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => {
    return (
      localStorage.getItem(TOKEN_KEY) ||
      sessionStorage.getItem(TOKEN_KEY) ||
      null
    );
  });
  const [user, setUser] = useState(() => {
    const saved =
      localStorage.getItem(USER_KEY) || sessionStorage.getItem(USER_KEY);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return null;
      }
    }
    return null;
  });
  const [loading, setLoading] = useState(true);

  // Verify and hydrate current user on initial load
  useEffect(() => {
    let mounted = true;

    async function hydrate() {
      const activeToken =
        localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY);
      if (!activeToken) {
        if (mounted) setLoading(false);
        return;
      }

      try {
        const freshUser = await getCurrentUser(activeToken);
        if (mounted) {
          setUser(freshUser);
          setToken(activeToken);
          // Update cached user in whichever storage holds the token
          if (localStorage.getItem(TOKEN_KEY)) {
            localStorage.setItem(USER_KEY, JSON.stringify(freshUser));
          } else {
            sessionStorage.setItem(USER_KEY, JSON.stringify(freshUser));
          }
        }
      } catch (err) {
        // Token is expired or invalid -> clear stored auth
        if (mounted) {
          localStorage.removeItem(TOKEN_KEY);
          localStorage.removeItem(USER_KEY);
          sessionStorage.removeItem(TOKEN_KEY);
          sessionStorage.removeItem(USER_KEY);
          setUser(null);
          setToken(null);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    hydrate();
    return () => {
      mounted = false;
    };
  }, []);

  async function login({ email, password, remember }) {
    const result = await loginUser({ email, password, remember });
    const { accessToken, user: authUser } = result;

    // Clear both storages first to ensure clean state
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);

    const storage = remember ? localStorage : sessionStorage;
    if (accessToken) {
      storage.setItem(TOKEN_KEY, accessToken);
      setToken(accessToken);
    }
    if (authUser) {
      storage.setItem(USER_KEY, JSON.stringify(authUser));
      setUser(authUser);
    }

    return result;
  }

  async function signup(details) {
    const result = await registerUser(details);
    const { accessToken, user: authUser } = result;

    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);

    if (accessToken) {
      localStorage.setItem(TOKEN_KEY, accessToken);
      setToken(accessToken);
    }
    if (authUser) {
      localStorage.setItem(USER_KEY, JSON.stringify(authUser));
      setUser(authUser);
    }

    return result;
  }

  function logout() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);
    setUser(null);
    setToken(null);
  }

  function updateUser(updatedUserData) {
    setUser((prev) => {
      const merged = { ...prev, ...updatedUserData };
      if (localStorage.getItem(TOKEN_KEY)) {
        localStorage.setItem(USER_KEY, JSON.stringify(merged));
      } else if (sessionStorage.getItem(TOKEN_KEY)) {
        sessionStorage.setItem(USER_KEY, JSON.stringify(merged));
      }
      return merged;
    });
  }

  async function refreshUser() {
    const activeToken =
      token ||
      localStorage.getItem(TOKEN_KEY) ||
      sessionStorage.getItem(TOKEN_KEY);
    if (!activeToken) return null;
    try {
      const freshUser = await getCurrentUser(activeToken);
      setUser(freshUser);
      if (localStorage.getItem(TOKEN_KEY)) {
        localStorage.setItem(USER_KEY, JSON.stringify(freshUser));
      } else if (sessionStorage.getItem(TOKEN_KEY)) {
        sessionStorage.setItem(USER_KEY, JSON.stringify(freshUser));
      }
      return freshUser;
    } catch {
      return null;
    }
  }

  const value = {
    user,
    token,
    loading,
    isAuthenticated: Boolean(token && user),
    login,
    signup,
    logout,
    updateUser,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
