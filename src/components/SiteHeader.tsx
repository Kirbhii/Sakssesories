import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { ROLE_LABEL, useAuth } from '@/lib/auth';
import type { MemberRole } from '@/lib/quota';

// ─── Top navbar ─────────────────────────────────────────────────────────────
// The public face only: Shop and the POS. The staff area is one Portal, and it
// is reached from the profile menu — so a shopper and a staff member see the
// same clean navbar, and the portal tabs never crowd it.
//
// Below `md` the links move into a panel behind the menu button, and the
// profile menu (Portal + Sign out) is mirrored there so a phone is never
// stranded with no way into — or out of — the portal.

interface NavItem {
  to: string;
  label: string;
  end?: boolean;
  /** Omit to show the link to everyone, signed in or not. */
  roles?: MemberRole[];
}

const NAV: NavItem[] = [
  { to: '/', label: 'Shop', end: true },
  // The POS is open to everyone — a signed-out visitor is a customer building
  // their own order, a signed-in member is staff ringing one up.
  { to: '/pos', label: 'Point of sale' },
];

export default function SiteHeader() {
  const { member, role, signOut } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false); // mobile nav panel
  const [menu, setMenu] = useState(false); // desktop profile dropdown

  const items = NAV.filter((item) => !item.roles || (role !== null && item.roles.includes(role)));

  const initials = member
    ? member.name
        .split(' ')
        .map((w) => w[0])
        .slice(0, 2)
        .join('')
    : '';

  function leave() {
    signOut();
    setOpen(false);
    setMenu(false);
    navigate('/login');
  }

  return (
    <header className="sticky top-0 z-40 border-b border-blush-300/60 bg-white">
      <div className="mx-auto flex h-[64px] w-full max-w-[1240px] items-center justify-between gap-4 px-4 md:h-[76px] md:gap-6 md:px-8">
        <NavLink
          to="/"
          className="flex min-w-0 items-center gap-2.5 md:gap-3"
          onClick={() => setOpen(false)}
        >
          <img
            src="/img/logo-mark.png"
            alt=""
            width={640}
            height={531}
            className="h-8 w-auto flex-none md:h-11"
          />
          <span className="flex min-w-0 flex-col">
            <span className="truncate font-serif text-[18px] leading-[1.1] tracking-[-0.01em] text-wine-800 md:text-[20px]">
              Saksesories PH
            </span>
            <span className="truncate text-[7.5px] uppercase tracking-[0.2em] text-ink-300">
              Sakses anytime, Style anytime
            </span>
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
          <div className="relative hidden flex-none md:block">
            <button
              onClick={() => setMenu((v) => !v)}
              aria-haspopup="menu"
              aria-expanded={menu}
              className="flex items-center gap-2.5 rounded-pill border border-blush-300 bg-white py-1 pl-1.5 pr-2.5 transition-colors hover:border-wine-800"
            >
              <span className="grid h-6 w-6 flex-none place-items-center rounded-full border border-blush-300 bg-blush-200 text-[8.5px] font-medium text-wine-800">
                {initials}
              </span>
              <span className="text-left">
                <b className="block text-[10.5px] font-medium leading-tight">{member.name}</b>
                <small className="block text-[8px] tracking-[0.04em] text-ink-300">
                  {ROLE_LABEL[member.role]}
                </small>
              </span>
              <svg
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.4"
                className={[
                  'h-2.5 w-2.5 flex-none text-ink-300 transition-transform',
                  menu ? 'rotate-180' : '',
                ].join(' ')}
              >
                <path d="m4 6 4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>

            {menu && (
              <>
                {/* Click-away — the dropdown closes the moment anything else is tapped. */}
                <div className="fixed inset-0 z-40" onClick={() => setMenu(false)} aria-hidden />
                <div
                  role="menu"
                  className="absolute right-0 top-[calc(100%+8px)] z-50 w-[212px] overflow-hidden rounded-[8px] border border-blush-300 bg-white shadow-[0_12px_34px_rgba(74,17,26,0.14)]"
                >
                  <div className="border-b border-blush-300/60 px-3.5 py-2.5">
                    <p className="text-[7.5px] uppercase tracking-[0.15em] text-ink-300">
                      Signed in as
                    </p>
                    <p className="mt-0.5 truncate text-[11px] font-medium text-ink-900">
                      {member.name}
                    </p>
                    <p className="text-[8.5px] text-ink-300">{ROLE_LABEL[member.role]}</p>
                  </div>

                  <NavLink
                    to="/portal"
                    role="menuitem"
                    onClick={() => setMenu(false)}
                    className="flex items-center gap-2.5 px-3.5 py-2.5 text-[11px] text-ink-900 transition-colors hover:bg-blush-50 hover:text-crimson-600"
                  >
                    <svg
                      viewBox="0 0 16 16"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.3"
                      className="h-3 w-3 flex-none text-ink-300"
                    >
                      <path
                        d="M2.5 2.5h4v4h-4zM9.5 2.5h4v4h-4zM2.5 9.5h4v4h-4zM9.5 9.5h4v4h-4z"
                        strokeLinejoin="round"
                      />
                    </svg>
                    Portal
                  </NavLink>

                  <button
                    onClick={leave}
                    role="menuitem"
                    className="flex w-full items-center gap-2.5 border-t border-blush-300/60 px-3.5 py-2.5 text-left text-[11px] text-ink-500 transition-colors hover:bg-blush-50 hover:text-crimson-600"
                  >
                    <svg
                      viewBox="0 0 16 16"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.3"
                      className="h-3 w-3 flex-none"
                    >
                      <path
                        d="M6 3H3v10h3M10.5 11 13 8l-2.5-3M13 8H6.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    Sign out
                  </button>
                </div>
              </>
            )}
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
          </nav>

          {member ? (
            <div className="border-t border-blush-300/60 px-4 py-3">
              <div className="flex items-center gap-2.5 pb-1.5">
                <span className="grid h-7 w-7 flex-none place-items-center rounded-full border border-blush-300 bg-blush-200 text-[9px] font-medium text-wine-800">
                  {initials}
                </span>
                <span className="min-w-0">
                  <b className="block truncate text-[11px] font-medium">{member.name}</b>
                  <small className="block text-[8.5px] text-ink-300">
                    {ROLE_LABEL[member.role]}
                  </small>
                </span>
              </div>
              <NavLink
                to="/portal"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 border-t border-blush-300/50 py-2.5 text-[12.5px] text-ink-900"
              >
                <svg
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.3"
                  className="h-3 w-3 flex-none text-ink-300"
                >
                  <path
                    d="M2.5 2.5h4v4h-4zM9.5 2.5h4v4h-4zM2.5 9.5h4v4h-4zM9.5 9.5h4v4h-4z"
                    strokeLinejoin="round"
                  />
                </svg>
                Portal
              </NavLink>
              <button
                onClick={leave}
                className="flex w-full items-center gap-2 py-2.5 text-left text-[12.5px] text-crimson-600"
              >
                <svg
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.3"
                  className="h-3 w-3 flex-none"
                >
                  <path
                    d="M6 3H3v10h3M10.5 11 13 8l-2.5-3M13 8H6.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                Sign out
              </button>
            </div>
          ) : (
            <NavLink
              to="/login"
              onClick={() => setOpen(false)}
              className="block px-4 py-3 text-[12.5px] font-medium text-crimson-600"
            >
              Staff sign in
            </NavLink>
          )}
        </div>
      )}
    </header>
  );
}
