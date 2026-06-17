import { create } from "zustand";

interface AuthState {
  token: string | null;
  role: string | null;
  displayName: string | null;
  userId: string | null;
  department: string | null;
  isAdmin: boolean;
  setAuth: (token: string, role: string, displayName: string, userId: string, department?: string, isAdmin?: boolean) => void;
  logout: () => void;
  isAuthenticated: () => boolean;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: localStorage.getItem("token"),
  role: localStorage.getItem("role"),
  displayName: localStorage.getItem("displayName"),
  userId: localStorage.getItem("userId"),
  department: localStorage.getItem("department"),
  isAdmin: localStorage.getItem("isAdmin") === "true",

  setAuth: (token, role, displayName, userId, department = "", isAdmin = false) => {
    localStorage.setItem("token", token);
    localStorage.setItem("role", role);
    localStorage.setItem("displayName", displayName);
    localStorage.setItem("userId", userId);
    localStorage.setItem("department", department);
    localStorage.setItem("isAdmin", String(isAdmin));
    set({ token, role, displayName, userId, department, isAdmin });
  },

  logout: () => {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    localStorage.removeItem("displayName");
    localStorage.removeItem("userId");
    localStorage.removeItem("department");
    localStorage.removeItem("isAdmin");
    set({ token: null, role: null, displayName: null, userId: null, department: null, isAdmin: false });
  },

  isAuthenticated: () => !!get().token,
}));
