import { create } from "zustand";

interface AuthState {
  token: string | null;
  role: string | null;
  displayName: string | null;
  userId: string | null;
  setAuth: (token: string, role: string, displayName: string, userId: string) => void;
  logout: () => void;
  isAuthenticated: () => boolean;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: localStorage.getItem("token"),
  role: localStorage.getItem("role"),
  displayName: localStorage.getItem("displayName"),
  userId: localStorage.getItem("userId"),

  setAuth: (token, role, displayName, userId) => {
    localStorage.setItem("token", token);
    localStorage.setItem("role", role);
    localStorage.setItem("displayName", displayName);
    localStorage.setItem("userId", userId);
    set({ token, role, displayName, userId });
  },

  logout: () => {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    localStorage.removeItem("displayName");
    localStorage.removeItem("userId");
    set({ token: null, role: null, displayName: null, userId: null });
  },

  isAuthenticated: () => !!get().token,
}));
