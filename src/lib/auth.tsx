// ─── Session ────────────────────────────────────────────────────────────────
// Who is signed in, and what they are allowed to do.
//
// With the database connected this is a real Supabase Auth session: email and
// password, checked on the server, and a profile row looked up by `auth_id`.
// The row is what every screen reads, so a login that is not linked to a staff
// profile can do nothing at all — the database refuses it too, not just the UI.
//
// Without a database (a fresh clone, or before `.env` is filled in) it falls
// back to the old pick-a-member stand-in so the screens can still be worked on.
// That branch is gated on `import.meta.env.DEV`, so a production build cannot
// use it even by accident.

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  MEMBERS,
  type DepartmentId,
  type Member,
  type MemberRole,
} from '@/lib/quota';
import { loadAccounts } from '@/lib/payaccounts';
import { loadProduction } from '@/lib/production';
import { loadSales } from '@/lib/sales';
import { supabase } from '@/lib/supabase';

const STORAGE_KEY = 'skph.session';

interface AuthValue {
  member: Member | null;
  role: MemberRole | null;
  /** True until the first session check has answered. */
  loading: boolean;
  /** Returns an error to show, or null when it worked. */
  signIn: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

interface ProfileRow {
  slug: string;
  full_name: string;
  role: MemberRole;
  department: DepartmentId;
  active: boolean;
}

/** The database row, shaped like the `Member` the screens already expect. */
function toMember(row: ProfileRow): Member {
  const local = MEMBERS.find((m) => m.id === row.slug);
  return {
    id: row.slug,
    name: row.full_name,
    role: row.role,
    department: row.department,
    active: row.active,
    rungUp: local?.rungUp ?? 0,
    credited: local?.credited ?? 0,
  };
}

async function memberFromAuth(userId: string): Promise<Member | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('profiles')
    .select('slug, full_name, role, department, active')
    .eq('auth_id', userId)
    .maybeSingle();
  if (error || !data) return null;
  return toMember(data as ProfileRow);
}

/** The dev stand-in: a member id remembered in localStorage. */
function readMock(): Member | null {
  try {
    const id = window.localStorage.getItem(STORAGE_KEY);
    return id ? (MEMBERS.find((m) => m.id === id) ?? null) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [member, setMember] = useState<Member | null>(() =>
    import.meta.env.DEV ? readMock() : null,
  );
  const [loading, setLoading] = useState(!!supabase);

  // Follow the real session. Nothing here runs without a database.
  useEffect(() => {
    if (!supabase) return;
    let alive = true;

    supabase.auth.getSession().then(async ({ data }) => {
      if (!alive) return;
      if (data.session) {
        const m = await memberFromAuth(data.session.user.id);
        if (alive) setMember(m);
      }
      if (alive) setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (!alive) return;
      if (event === 'SIGNED_OUT') {
        // In dev the stand-in may still be in localStorage; clearing it in
        // signOut() is what makes this land on null.
        setMember(import.meta.env.DEV ? readMock() : null);
        return;
      }
      if (session) {
        void memberFromAuth(session.user.id).then((m) => {
          if (alive) setMember(m);
        });
      }
    });

    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  // Pull the shop's data in behind the session. Both reads are scoped by row
  // level security rather than by anything here, so this one effect is right
  // for every role: a member gets their own book and their own codes, Finance
  // and the GM get the team's, and signing out drops back to an empty set.
  useEffect(() => {
    void loadSales();
    void loadAccounts();
    void loadProduction();
  }, [member?.id]);

  const value = useMemo<AuthValue>(
    () => ({
      member,
      role: member?.role ?? null,
      loading,
      signIn: async (email: string, password: string) => {
        if (!supabase) {
          // No database: keep the screens usable in development.
          const found = MEMBERS.find((m) => emailOf(m.name) === email.trim().toLowerCase());
          if (!found) return 'No account uses that email.';
          if (!password) return 'Enter a password.';
          try {
            window.localStorage.setItem(STORAGE_KEY, found.id);
          } catch {
            /* private mode — the session just won't survive a reload */
          }
          setMember(found);
          return null;
        }

        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) {
          return /invalid login credentials/i.test(error.message)
            ? 'Wrong email or password.'
            : error.message;
        }

        const m = await memberFromAuth(data.user.id);
        if (!m) {
          // A real login with no staff record behind it. That is a setup
          // problem, not a wrong password, so say which one it is — "ask the GM
          // to add you" is useless advice when the GM is the one signing in.
          await supabase.auth.signOut();
          return 'This login has no staff record linked to it yet. Run supabase/link-logins.sql once, then sign in again.';
        }
        setMember(m);
        return null;
      },
      signOut: async () => {
        try {
          window.localStorage.removeItem(STORAGE_KEY);
        } catch {
          /* nothing to clean up */
        }
        if (supabase) await supabase.auth.signOut();
        setMember(null);
      },
    }),
    [member, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

/**
 * Where each role lands after signing in. Everyone lands on the shop first —
 * the portal is one click away in the profile menu, so the storefront stays the
 * shared front door and no role is dropped straight into a back office.
 */
export const HOME_FOR: Record<MemberRole, string> = {
  marketing: '/',
  production: '/',
  finance: '/',
  gm: '/',
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
