import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { 
  signInWithEmailAndPassword, signOut, onAuthStateChanged, User as FirebaseUser 
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { getFirebaseAuth, getFirebaseDb, initializeFirebase, isFirebaseConfigured } from '@/lib/firebase';

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

const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL || 'admin@washwizard.com';
const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD || 'admin123';
const USER_EMAIL = import.meta.env.VITE_USER_EMAIL || 'user@washwizard.com';
const USER_PASSWORD = import.meta.env.VITE_USER_PASSWORD || 'user123';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [isFirebaseReady, setIsFirebaseReady] = useState(false);

  useEffect(() => {
    initializeFirebase();
    setIsFirebaseReady(isFirebaseConfigured());
  }, []);

  useEffect(() => {
    if (!isFirebaseReady) {
      const savedUser = localStorage.getItem('t10_user');
      if (savedUser) {
        setAppUser(JSON.parse(savedUser));
      }
      setLoading(false);
      return;
    }

    const auth = getFirebaseAuth();
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      
      if (user) {
        const db = getFirebaseDb();
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data() as AppUser;
          setAppUser({ ...userData, id: user.uid });
          localStorage.setItem('t10_user', JSON.stringify({ ...userData, id: user.uid }));
        } else {
          const email = user.email || '';
          const role = email.startsWith('admin') ? 'admin' : 'user';
          const newUser: AppUser = {
            id: user.uid,
            nome: user.displayName || (role === 'admin' ? 'Administrador' : 'Usuário'),
            email,
            role,
          };
          await setDoc(doc(db, 'users', user.uid), newUser);
          setAppUser(newUser);
          localStorage.setItem('t10_user', JSON.stringify(newUser));
        }
      } else {
        setAppUser(null);
        localStorage.removeItem('t10_user');
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [isFirebaseReady]);

  const login = useCallback(async (email: string, senha: string): Promise<boolean> => {
    if (!isFirebaseReady) {
      if (email === ADMIN_EMAIL && senha === ADMIN_PASSWORD) {
        const user: AppUser = { id: 'admin-local', nome: 'Administrador', email, role: 'admin' };
        setAppUser(user);
        localStorage.setItem('t10_user', JSON.stringify(user));
        return true;
      }
      if (email === USER_EMAIL && senha === USER_PASSWORD) {
        const user: AppUser = { id: 'user-local', nome: 'Usuário', email, role: 'user' };
        setAppUser(user);
        localStorage.setItem('t10_user', JSON.stringify(user));
        return true;
      }
      return false;
    }

    try {
      const auth = getFirebaseAuth();
      await signInWithEmailAndPassword(auth, email, senha);
      return true;
    } catch (error) {
      console.error('Erro no login:', error);
      return false;
    }
  }, [isFirebaseReady]);

  const logout = useCallback(async () => {
    if (!isFirebaseReady) {
      setAppUser(null);
      localStorage.removeItem('t10_user');
      return;
    }

    try {
      const auth = getFirebaseAuth();
      await signOut(auth);
    } catch (error) {
      console.error('Erro no logout:', error);
    }
    setAppUser(null);
    localStorage.removeItem('t10_user');
  }, [isFirebaseReady]);

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
