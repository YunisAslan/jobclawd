"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

export interface User {
  email: string;
  name: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (token: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

function getJcToken(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/(?:^|; )jc_token=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : null;
}

function setJcToken(token: string) {
  const maxAge = 30 * 24 * 60 * 60;
  document.cookie = `jc_token=${encodeURIComponent(token)};max-age=${maxAge};path=/;SameSite=Lax`;
}

function clearJcToken() {
  document.cookie = "jc_token=;max-age=0;path=/";
}

function decodeJwt(token: string): User | null {
  try {
    const b64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(atob(b64));
    if (payload.exp && Date.now() / 1000 > payload.exp) return null;
    if (!payload.sub) return null;
    return {
      email: payload.sub,
      name: payload.name || payload.sub.split("@")[0],
    };
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const token = getJcToken();
    if (token) {
      const decoded = decodeJwt(token);
      setUser(decoded);
      if (!decoded) clearJcToken();
    }
    setIsLoading(false);
  }, []);

  const login = useCallback((token: string) => {
    setJcToken(token);
    setUser(decodeJwt(token));
  }, []);

  const logout = useCallback(() => {
    clearJcToken();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
