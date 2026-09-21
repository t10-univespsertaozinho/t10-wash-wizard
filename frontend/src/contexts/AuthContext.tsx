import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { TOKEN_STORAGE_KEY } from '@/utils/security';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export type UserRole = 'admin' | 'operador';

export interface AppUser {
  id: string;
  nome: string;
  email: string;
  role: UserRole;
}

interface AuthContextType {
  isAuthenticated: boolean;
  user: AppUser | null;
  login: (email: string, senha: string) => Promise<boolean>;
  logout: () => Promise<void>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadAuth() {
      const token = localStorage.getItem(TOKEN_STORAGE_KEY);
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const res = await fetch(`${API_URL}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          setAppUser(await res.json());
        } else {
          localStorage.removeItem(TOKEN_STORAGE_KEY);
        }
      } catch {
        localStorage.removeItem(TOKEN_STORAGE_KEY);
      }
      setLoading(false);
    }
    loadAuth();
  }, []);

  const login = useCallback(async (email: string, senha: string): Promise<boolean> => {
    try {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, senha }),
      });
      if (!res.ok) return false;

      const { token, user } = await res.json();
      localStorage.setItem(TOKEN_STORAGE_KEY, token);
      setAppUser(user);
      return true;
    } catch {
      return false;
    }
  }, []);

  const logout = useCallback(async () => {
    setAppUser(null);
    localStorage.removeItem(TOKEN_STORAGE_KEY);
  }, []);

  return (
    <AuthContext.Provider value={{
      isAuthenticated: !!appUser,
      user: appUser,
      login,
      logout,
      loading
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
