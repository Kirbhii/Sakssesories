import { Link, NavLink, useNavigate } from 'react-router-dom';
import { ROLE_LABEL, useAuth } from '@/lib/auth';
import type { MemberRole } from '@/lib/quota';

// ─── Vertical wine rail ─────────────────────────────────────────────────────
// The staff side of the app is one Portal: this rail on the left, and the
// selected tab on the right. Every staff tab lives inside /portal, so a member
// only ever sees the doors their role allows. The public face of the brand —
// Shop (Home) and the POS — stays outside the portal with the horizontal
// navbar.
//
// Below `md` the rail turns into a horizontal strip that scrolls sideways, so it
// carries the same role-filtered links. A phone would otherwise be stranded on
// one screen with no way to reach the others.

interface RailItem {
  label: string;
  icon: string;
  to: string;
  roles?: MemberRole[];
  /** Match exactly, so /portal/inventory does not light up "My sales". */
  end?: boolean;
}

const STAFF: MemberRole[] = ['marketing', 'production', 'finance', 'gm'];

// Every rail tab lives inside the portal. The POS is a public page on the top
// navbar, so it is not repeated here; the logo (top of the rail) is the door
// back out to the shop.
const RAIL: RailItem[] = [
  { label: 'My sales', icon: 'M3.4 2h9.2v12l-2.3-1.5L8 14l-2.3-1.5L3.4 14V2Z', to: '/portal', end: true, roles: STAFF },
  { label: 'Inventory', icon: 'M8 1.8 13.6 4.5v7L8 14.2 2.4 11.5v-7L8 1.8Z', to: '/portal/inventory', roles: STAFF },
  {
    label: 'Finance',
    icon: 'M8 1.6v12.8M11.2 4.4c0-1.3-1.4-2.1-3.2-2.1s-3.2.8-3.2 2.1 1.4 2.1 3.2 2.1 3.2.8 3.2 2.1-1.4 2.1-3.2 2.1-3.2-.8-3.2-2.1',
    to: '/portal/finance',
    roles: ['finance', 'gm'],
  },
  { label: 'Quota', icon: 'M2.6 13V8.4M6.6 13V5.2M10.6 13V9.2M14 13V3', to: '/portal/quota', roles: ['gm'] },
  {
    label: 'Users',
    icon: 'M6 5.6a2.4 2.4 0 1 0 0 .1M1.8 13.4c0-2.3 1.9-3.8 4.2-3.8s4.2 1.5 4.2 3.8M11 4.2a2 0 1 1 0 4M11.6 9.8c1.7.3 2.8 1.5 2.8 3.2',
    to: '/portal/users',
    roles: ['gm'],
  },
];

export default function SideRail() {
  const { member, role, signOut } = useAuth();
  const navigate = useNavigate();

  const rail = RAIL.filter((item) => !item.roles || (role !== null && item.roles.includes(role)));

  function leave() {
    signOut();
    navigate('/login');
  }

  return (
    <aside className="sticky top-0 flex h-screen w-[232px] min-w-0 flex-none flex-col bg-wine-900 px-4 pb-[18px] pt-[22px] max-md:static max-md:h-auto max-md:w-full max-md:flex-row max-md:items-center max-md:gap-4 max-md:overflow-x-auto max-md:px-4 max-md:py-3">
      <Link
        to="/"
        className="flex flex-none items-center gap-2.5 whitespace-nowrap px-2 pb-[26px] max-md:px-0 max-md:pb-0"
      >
        <img
          src="/img/logo-mark-light.png"
          alt=""
          width={640}
          height={531}
          className="h-8 w-auto flex-none md:h-9"
        />
        <span className="flex flex-col">
          <span className="block font-serif text-[17px] leading-tight text-white">Saksesories PH</span>
          <span className="mt-1 block text-[7px] uppercase tracking-[0.22em] text-white/40 max-md:hidden">
            by Saksesories
          </span>
        </span>
      </Link>

      <nav className="grid gap-0.5 max-md:flex max-md:gap-1">
        {rail.map((item) => (
          <NavLink
            key={item.label}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              [
                'flex items-center gap-2.5 rounded-md px-[11px] py-[9px] text-[11.5px] transition-colors max-md:whitespace-nowrap',
                isActive
                  ? 'bg-white/12 text-white'
                  : 'text-white/60 hover:bg-white/5 hover:text-white/90',
              ].join(' ')
            }
          >
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" className="h-3 w-3 flex-none">
              <path d={item.icon} strokeLinejoin="round" strokeLinecap="round" />
            </svg>
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto flex items-center gap-2.5 px-2 max-md:ml-auto max-md:mt-0 max-md:px-0">
        <div className="min-w-0 max-md:hidden">
          <strong className="block truncate text-[10.5px] font-medium text-white/90">
            {member?.name ?? 'Signed out'}
          </strong>
          <small className="block truncate text-[8.5px] text-white/40">
            {member ? ROLE_LABEL[member.role] : 'No session'}
          </small>
        </div>
        <button
          onClick={leave}
          className="flex flex-none items-center gap-1.5 rounded-md border border-white/15 px-3 py-[9px] text-[10.5px] text-white/70 transition-colors hover:bg-white/5 hover:text-white max-md:px-2"
        >
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" className="h-3 w-3 flex-none">
            <path d="M6 3H3v10h3M10.5 11 13 8l-2.5-3M13 8H6.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Sign out
        </button>
      </div>
    </aside>
  );
}
