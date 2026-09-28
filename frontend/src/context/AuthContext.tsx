import React, { createContext, useContext, useState, useEffect } from "react";
import { User, AuthResponse } from "../types";
import { api } from "../services/api";

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, fullName: string, role?: string, department?: string) => Promise<void>;
  logout: () => void;
  hasRole: (...roles: string[]) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Demo fallback user if running offline/initial seed
const DEFAULT_USER: User = {
  user_id: "demo-admin",
  email: "admin@railoptiblock.local",
  full_name: "Chief Planner (IR HQ)",
  role: "ADMIN",
  department: "Administration",
  is_active: true
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("rail_access_token"));
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem("rail_user");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return DEFAULT_USER;
      }
    }
    return DEFAULT_USER; // Default to admin for seamless navigation
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const verifyToken = async () => {
      const storedToken = localStorage.getItem("rail_access_token");
      if (storedToken) {
        try {
          const profile = await api.getMe();
          setUser(profile);
          localStorage.setItem("rail_user", JSON.stringify(profile));
        } catch {
          // Token expired or invalid, keep existing or fallback
          if (!user) setUser(DEFAULT_USER);
        }
      } else {
        if (!user) setUser(DEFAULT_USER);
      }
      setIsLoading(false);
    };

    verifyToken();
  }, []);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const res = await api.login({ email, password });
      setToken(res.access_token);
      setUser(res.user);
      localStorage.setItem("rail_access_token", res.access_token);
      if (res.refresh_token) {
        localStorage.setItem("rail_refresh_token", res.refresh_token);
      }
      localStorage.setItem("rail_user", JSON.stringify(res.user));
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (email: string, password: string, fullName: string, role = "PLANNER", department = "Operations") => {
    setIsLoading(true);
    try {
      await api.register({ email, password, full_name: fullName, role, department });
      // Automatically log in after registration
      await login(email, password);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem("rail_access_token");
    localStorage.removeItem("rail_refresh_token");
    localStorage.removeItem("rail_user");
  };

  const hasRole = (...roles: string[]) => {
    if (!user) return false;
    if (user.role === "ADMIN") return true; // Superuser bypass
    return roles.includes(user.role);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user,
        isLoading,
        login,
        register,
        logout,
        hasRole
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
