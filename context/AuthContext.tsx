'use client';

import { onAuthStateChanged, type User } from 'firebase/auth';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { getFirebaseAuth } from '@/lib/firebase';

type AuthContextValue = {
  user: User | null;
  loading: boolean;
};

const SESSION_COOKIE_NAME = 'attendx-session';
const SESSION_COOKIE_MAX_AGE = 60 * 60 * 24 * 7;

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function setSessionCookie(token: string) {
  document.cookie = `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}; path=/; max-age=${SESSION_COOKIE_MAX_AGE}; samesite=lax`;
}

function clearSessionCookie() {
  document.cookie = `${SESSION_COOKIE_NAME}=; path=/; max-age=0; samesite=lax`;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const firebaseAuth = getFirebaseAuth();

    if (!firebaseAuth) {
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(
      firebaseAuth,
      async (nextUser) => {
        setUser(nextUser);

        try {
          if (nextUser) {
            const token = await nextUser.getIdToken();
            setSessionCookie(token);
          } else {
            clearSessionCookie();
          }
        } finally {
          setLoading(false);
        }
      },
      () => {
        clearSessionCookie();
        setUser(null);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const value = useMemo(() => ({ user, loading }), [loading, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
}