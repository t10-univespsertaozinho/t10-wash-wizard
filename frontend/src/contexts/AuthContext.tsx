import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { TOKEN_STORAGE_KEY } from '@/utils/security';

const API_URL = import.meta.env.VITE_API_URL || '/api';

export type UserRole = 'admin' | 'operador';

export interface AppUser {
  id: string;
  nome: string;
  email: string;
  role: UserRole;
}

/**
 * Resultado do login. Antes `login` devolvia só um booleano, e a tela de login
 * traduzia qualquer falha como "Email ou senha inválidos" — inclusive bloqueio
 * do rate-limiter, servidor fora do ar e queda de rede, o que mandava o usuário
 * conferir a senha quando o problema era outro (FA-11).
 */
export type LoginErro = 'credenciais' | 'rate_limit' | 'servidor' | 'rede';

export interface LoginResult {
  sucesso: boolean;
  erro?: LoginErro;
  /** Mensagem devolvida pelo backend, quando houver. */
  detalhe?: string;
  /** Segundos até poder tentar de novo (header Retry-After do 429). */
  retryAfter?: number;
}

interface AuthContextType {
  isAuthenticated: boolean;
  user: AppUser | null;
  login: (email: string, senha: string) => Promise<LoginResult>;
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

  const login = useCallback(async (email: string, senha: string): Promise<LoginResult> => {
    let res: Response;
    try {
      res = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, senha }),
      });
    } catch {
      // fetch só rejeita por falha de transporte: backend desligado, DNS, CORS.
      return { sucesso: false, erro: 'rede' };
    }

    if (!res.ok) {
      const corpo = await res.json().catch(() => null);
      const detalhe = corpo?.error;

      if (res.status === 429) {
        const header = Number(res.headers.get('Retry-After'));
        return {
          sucesso: false,
          erro: 'rate_limit',
          detalhe,
          retryAfter: Number.isFinite(header) && header > 0 ? header : undefined,
        };
      }
      if (res.status >= 500) return { sucesso: false, erro: 'servidor', detalhe };
      return { sucesso: false, erro: 'credenciais', detalhe };
    }

    const { token, user } = await res.json();
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
    setAppUser(user);
    return { sucesso: true };
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
