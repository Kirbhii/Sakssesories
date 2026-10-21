import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { ROLE_LABEL, useAuth } from '@/lib/auth';
import type { MemberRole } from '@/lib/quota';

// ─── Top navbar ─────────────────────────────────────────────────────────────
// One navbar for the whole app, but each role only sees the doors it may open.
// Hiding a link is a courtesy, not a lock — every page is guarded in App.tsx as
// well, so typing the URL by hand lands on the Restricted screen.
//
// Below `md` the links cannot fit next to the logo, so they move into a panel
// behind the menu button. They are never simply hidden — a phone would then
// have no way to move between screens at all.

interface NavItem {
  to: string;
  label: string;
  end?: boolean;
  /** Omit to show the link to everyone, signed in or not. */
  roles?: MemberRole[];
}

const STAFF: MemberRole[] = ['marketing', 'production', 'finance', 'gm'];

const NAV: NavItem[] = [
  { to: '/', label: 'Shop', end: true },
  { to: '/pos', label: 'Point of sale', roles: STAFF },
  { to: '/portal', label: 'My sales', roles: STAFF },
  { to: '/inventory', label: 'Inventory', roles: STAFF },
  { to: '/finance', label: 'Finance', roles: ['finance', 'gm'] },
  { to: '/quota', label: 'Quota', roles: ['gm'] },
  { to: '/users', label: 'Users', roles: ['gm'] },
];

interface SiteHeaderProps {
  /** Small line in the wine strip above the navbar. */
  strip?: string;
}

export default function SiteHeader({ strip }: SiteHeaderProps) {
  const { member, role, signOut } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const items = NAV.filter((item) => !item.roles || (role !== null && item.roles.includes(role)));

  function leave() {
    signOut();
    setOpen(false);
    navigate('/login');
  }

  return (
    <>
      <div className="bg-wine-800 text-[9.5px] uppercase tracking-[0.16em] text-white/70">
        <div className="mx-auto flex h-[30px] w-full max-w-[1240px] items-center justify-between px-4 md:px-8 max-md:justify-center">
          <span>Saksesories PH{strip ? ` · ${strip}` : ''}</span>
          <span className="max-md:hidden">
            Free engraving on 2 letters
            <span className="mx-2.5 opacity-40">·</span>
            Pickup &amp; delivery
          </span>
        </div>
      </div>

      <header className="sticky top-0 z-40 border-b border-blush-300/60 bg-white">
        <div className="mx-auto flex h-[64px] w-full max-w-[1240px] items-center justify-between gap-4 px-4 md:h-[76px] md:gap-6 md:px-8">
          <NavLink to="/" className="flex min-w-0 flex-col" onClick={() => setOpen(false)}>
            <span className="truncate font-serif text-[18px] leading-[1.1] tracking-[-0.01em] text-ink-900 md:text-[20px]">
              Saksesories PH
            </span>
            <span className="truncate text-[7.5px] uppercase tracking-[0.2em] text-ink-300">
              Sakses anytime, Style anytime
            </span>
          </NavLink>

          <nav className="ml-auto mr-6 hidden items-center gap-4 md:flex lg:gap-[22px]">
            {items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  [
                    'border-b py-1 text-[11px] tracking-[0.05em] transition-colors lg:text-[11.5px]',
                    isActive
                      ? 'border-crimson-600 text-crimson-600'
                      : 'border-transparent text-ink-900 hover:border-crimson-600 hover:text-crimson-600',
                  ].join(' ')
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          {member ? (
            <div className="hidden flex-none items-center gap-2.5 md:flex">
              <span className="flex items-center gap-2.5 rounded-pill border border-blush-300 bg-white py-1 pl-1.5 pr-3.5">
                <span className="h-6 w-6 rounded-full border border-blush-300 bg-blush-200" />
                <span>
                  <b className="block text-[10.5px] font-medium leading-tight">{member.name}</b>
                  <small className="block text-[8px] tracking-[0.04em] text-ink-300">
                    {ROLE_LABEL[member.role]}
                  </small>
                </span>
              </span>
              <button
                onClick={leave}
                className="text-[9.5px] text-ink-300 transition-colors hover:text-crimson-600"
              >
                Sign out
              </button>
            </div>
          ) : (
            <NavLink
              to="/login"
              className="hidden flex-none rounded-pill bg-crimson-600 px-[22px] py-3 text-[12px] font-medium text-white transition-colors hover:bg-wine-800 md:block"
            >
              Staff sign in
            </NavLink>
          )}

          <button
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            className="grid h-9 w-9 flex-none place-items-center rounded-md border border-blush-300 text-ink-900 md:hidden"
          >
            <svg
              viewBox="0 0 16 16"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.4"
            >
              {open ? (
                <path d="M4 4l8 8M12 4l-8 8" strokeLinecap="round" />
              ) : (
                <path d="M2.5 4.5h11M2.5 8h11M2.5 11.5h11" strokeLinecap="round" />
              )}
            </svg>
          </button>
        </div>

        {open && (
          <div className="border-t border-blush-300/60 bg-white md:hidden">
            <nav className="flex flex-col px-4 py-1">
              {items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  onClick={() => setOpen(false)}
                  className={({ isActive }) =>
                    [
                      'border-b border-blush-300/50 py-3 text-[12.5px] last:border-0',
                      isActive ? 'text-crimson-600' : 'text-ink-900',
                    ].join(' ')
                  }
                >
                  {item.label}
                </NavLink>
              ))}
              {!member && (
                <NavLink
                  to="/login"
                  onClick={() => setOpen(false)}
                  className="py-3 text-[12.5px] font-medium text-crimson-600"
                >
                  Staff sign in
                </NavLink>
              )}
            </nav>

            {member && (
              <div className="flex items-center justify-between gap-3 border-t border-blush-300/60 px-4 py-3">
                <div className="min-w-0">
                  <b className="block truncate text-[11px] font-medium">{member.name}</b>
                  <small className="block text-[8.5px] text-ink-300">
                    {ROLE_LABEL[member.role]}
                  </small>
                </div>
                <button onClick={leave} className="flex-none text-[10.5px] text-ink-500">
                  Sign out
                </button>
              </div>
            )}
          </div>
        )}
      </header>
    </>
  );
}
