import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { createSignedUser, verifySignedUser, SignedUser } from '@/utils/security';

export type UserRole = 'admin' | 'user';

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

const ADMIN_EMAIL = 'admin@washwizard.com';
const ADMIN_PASSWORD = 'admin123';
const USER_EMAIL = 'user@washwizard.com';
const USER_PASSWORD = 'user123';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedUser = localStorage.getItem('t10_user');
    if (savedUser) {
      try {
        const parsed = JSON.parse(savedUser) as SignedUser;
        const verified = verifySignedUser(parsed);
        
        if (verified) {
          const { _signature, _timestamp, ...userData } = verified;
          setAppUser(userData);
        } else {
          localStorage.removeItem('t10_user');
        }
      } catch {
        localStorage.removeItem('t10_user');
      }
    }
    setLoading(false);
  }, []);

  const login = useCallback(async (email: string, senha: string): Promise<boolean> => {
    if (email === ADMIN_EMAIL && senha === ADMIN_PASSWORD) {
      const user: AppUser = { id: 'admin-local', nome: 'Administrador', email, role: 'admin' };
      const signedUser = createSignedUser(user);
      setAppUser(user);
      localStorage.setItem('t10_user', JSON.stringify(signedUser));
      return true;
    }
    if (email === USER_EMAIL && senha === USER_PASSWORD) {
      const user: AppUser = { id: 'user-local', nome: 'Usuário', email, role: 'user' };
      const signedUser = createSignedUser(user);
      setAppUser(user);
      localStorage.setItem('t10_user', JSON.stringify(signedUser));
      return true;
    }
    return false;
  }, []);

  const logout = useCallback(async () => {
    setAppUser(null);
    localStorage.removeItem('t10_user');
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