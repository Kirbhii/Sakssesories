// ─── Session ────────────────────────────────────────────────────────────────
// A mock sign-in: pick a member, remember the id in localStorage. There is no
// password check yet and no Supabase auth — this exists so every screen can ask
// "who is this?" and "what are they allowed to do?".
//
// When real auth lands, only `AuthProvider` changes. Every page already reads
// `useAuth()`, so nothing else has to move.

import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { memberOf, type Member, type MemberRole } from '@/lib/quota';

const STORAGE_KEY = 'skph.session';

interface AuthValue {
  member: Member | null;
  role: MemberRole | null;
  signIn: (id: string) => void;
  signOut: () => void;
}

const AuthContext = createContext<AuthValue | null>(null);

function readSession(): Member | null {
  try {
    const id = window.localStorage.getItem(STORAGE_KEY);
    return id ? (memberOf(id) ?? null) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [member, setMember] = useState<Member | null>(readSession);

  const value = useMemo<AuthValue>(
    () => ({
      member,
      role: member?.role ?? null,
      signIn: (id: string) => {
        try {
          window.localStorage.setItem(STORAGE_KEY, id);
        } catch {
          /* private mode — the session just won't survive a reload */
        }
        setMember(memberOf(id) ?? null);
      },
      signOut: () => {
        try {
          window.localStorage.removeItem(STORAGE_KEY);
        } catch {
          /* nothing to clean up */
        }
        setMember(null);
      },
    }),
    [member],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

/** Where each role lands after signing in. */
export const HOME_FOR: Record<MemberRole, string> = {
  marketing: '/pos',
  production: '/inventory',
  finance: '/finance',
  gm: '/portal',
};

export const ROLE_LABEL: Record<MemberRole, string> = {
  marketing: 'Marketing',
  production: 'Production',
  finance: 'Finance',
  gm: 'General Manager',
};

/** Mock email so the sign-in form has something to match. */
export function emailOf(name: string): string {
  return `${name.toLowerCase().replace(/[^a-z ]/g, '').trim().replace(/ +/g, '.')}@saksesories.ph`;
}
