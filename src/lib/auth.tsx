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
  setRoster,
  type Member,
  type MemberRole,
} from '@/lib/quota';
import { loadAccounts } from '@/lib/payaccounts';
import { localProfile } from '@/lib/profile';
import { loadProduction } from '@/lib/production';
import { loadSales } from '@/lib/sales';
import { supabase, type ProfileRow } from '@/lib/supabase';

const STORAGE_KEY = 'skph.session';

interface AuthValue {
  member: Member | null;
  role: MemberRole | null;
  /** True until the first session check has answered. */
  loading: boolean;
  /** Returns an error to show, or null when it worked. */
  signIn: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  /** Re-read the signed-in profile — call it after the member edits it. */
  refreshMember: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

/**
 * The columns the screens read. `PROFILE` is the full set; `PROFILE_BASE` is
 * what a database without `add-profile.sql` still has, so a member can sign in
 * before the migration is run instead of being locked out.
 */
const PROFILE =
  'slug, full_name, role, department, active, email, phone, address, birthday, avatar';
const PROFILE_BASE = 'slug, full_name, role, department, active, email';

type PickedProfile = Pick<ProfileRow, 'slug' | 'full_name' | 'role' | 'department' | 'active'> &
  Partial<Pick<ProfileRow, 'email' | 'phone' | 'address' | 'birthday' | 'avatar'>>;

/** The database row, shaped like the `Member` the screens already expect. */
function toMember(row: PickedProfile): Member {
  const local = MEMBERS.find((m) => m.id === row.slug);
  return {
    id: row.slug,
    name: row.full_name,
    role: row.role,
    department: row.department,
    active: row.active,
    rungUp: local?.rungUp ?? 0,
    credited: local?.credited ?? 0,
    email: row.email ?? undefined,
    phone: row.phone ?? undefined,
    address: row.address ?? undefined,
    birthday: row.birthday ?? undefined,
    avatar: row.avatar ?? null,
  };
}

async function memberFromAuth(userId: string): Promise<Member | null> {
  if (!supabase) return null;

  const read = async (columns: string): Promise<PickedProfile | null> => {
    const { data, error } = await supabase!
      .from('profiles')
      .select(columns)
      .eq('auth_id', userId)
      .maybeSingle();
    if (error) return null;
    return (data as unknown) as PickedProfile | null;
  };

  // Full set first; if `add-profile.sql` has not been run yet the extra columns
  // do not exist, and the member still has to be able to sign in.
  const row = (await read(PROFILE)) ?? (await read(PROFILE_BASE));
  return row ? toMember(row) : null;
}

/**
 * Hand the whole staff list to the quota engine.
 *
 * This is what makes "add a person" a database job instead of a code change:
 * every screen reads the roster from `quota.ts`, and this replaces it with
 * whatever `public.profiles` actually holds. Runs before the portal mounts, so
 * the quota split, the member picker and the Users list are all correct on the
 * first render.
 *
 * A failed read changes nothing — the four in `quota.ts` stay as the fallback.
 */
async function loadRoster(): Promise<void> {
  if (!supabase) return;
  const { data, error } = await supabase
    .from('profiles')
    .select('slug, full_name, role, department, active')
    .eq('active', true);
  if (error || !data) return;

  const rows = (data as unknown) as PickedProfile[];
  setRoster(
    rows.map((r) => ({
      id: r.slug,
      name: r.full_name,
      role: r.role,
      department: r.department,
      active: r.active,
      rungUp: 0,
      credited: 0,
    })),
  );
}

/** The dev stand-in: a member id remembered in localStorage. */
function readMock(): Member | null {
  try {
    const id = window.localStorage.getItem(STORAGE_KEY);
    if (!id) return null;
    const base = MEMBERS.find((m) => m.id === id);
    if (!base) return null;
    // Offline there is no profile row, so the Profile screen's edits live in
    // localStorage. Fold them in here and the rail shows the new name too.
    const saved = localProfile(id);
    if (!saved) return base;
    return {
      ...base,
      name: saved.fullName?.trim() || base.name,
      phone: saved.phone,
      address: saved.address,
      birthday: saved.birthday,
      avatar: saved.avatar ?? null,
    };
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
        // The roster has to be in place before the portal renders, otherwise
        // the first paint shows the fallback four and then jumps.
        await loadRoster();
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
        // Before the first screen, so the quota split already knows about them.
        await loadRoster();
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
      refreshMember: async () => {
        // Offline the stand-in is the source of truth, so re-read it — that is
        // what picks up a name edited on the Profile screen.
        if (!supabase) {
          setMember(readMock());
          return;
        }
        const { data } = await supabase.auth.getUser();
        if (!data.user) return;
        const fresh = await memberFromAuth(data.user.id);
        if (fresh) setMember(fresh);
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
