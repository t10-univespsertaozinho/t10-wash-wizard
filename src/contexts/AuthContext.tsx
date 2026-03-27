import React, { createContext, useContext, useState, useEffect } from 'react';

interface AuthContextType {
  isAuthenticated: boolean;
  user: { id: string; nome: string; role: 'admin' | 'user' } | null;
  login: (usuario: string, senha: string) => boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return localStorage.getItem('t10_auth') === 'true';
  });

  const [userState, setUserState] = useState<{ id: string; nome: string; role: 'admin' | 'user' } | null>(() => {
    const saved = localStorage.getItem('t10_user');
    return saved ? JSON.parse(saved) : null;
  });
 
  const user = isAuthenticated ? userState : null;
 
  useEffect(() => {
    localStorage.setItem('t10_auth', String(isAuthenticated));
    if (userState) localStorage.setItem('t10_user', JSON.stringify(userState));
    else localStorage.removeItem('t10_user');
  }, [isAuthenticated, userState]);
 
  const login = (usuario: string, senha: string) => {
    const adminUser = import.meta.env.VITE_ADMIN_USER || 'admin';
    const adminPass = import.meta.env.VITE_ADMIN_PASSWORD || 'admin';
    const userUser = import.meta.env.VITE_USER_USER || 'user';
    const userPass = import.meta.env.VITE_USER_PASSWORD || 'user';

    if (usuario === adminUser && senha === adminPass) {
      setIsAuthenticated(true);
      setUserState({ id: 'admin-1', nome: 'Administrador', role: 'admin' });
      return true;
    }
    if (usuario === userUser && senha === userPass) {
      setIsAuthenticated(true);
      setUserState({ id: 'user-1', nome: 'Usuário', role: 'user' });
      return true;
    }
    return false;
  };
 
  const logout = () => {
    setIsAuthenticated(false);
    setUserState(null);
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
