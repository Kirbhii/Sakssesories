import { Link, NavLink, useNavigate } from 'react-router-dom';
import { ROLE_LABEL, useAuth } from '@/lib/auth';
import { initialsOf } from '@/lib/profile';
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
  {
    label: 'Orders',
    // A parcel with its flap open — the things still owed to somebody.
    icon: 'M2.4 5.2 8 2.4l5.6 2.8v5.6L8 13.6 2.4 10.8V5.2ZM2.4 5.2 8 8m0 0 5.6-2.8M8 8v5.6',
    to: '/portal/orders',
    roles: STAFF,
  },
  {
    label: 'Payment QR',
    icon: 'M2.4 2.4h3.6v3.6H2.4zM10 2.4h3.6v3.6H10zM2.4 10h3.6v3.6H2.4zM9.4 9.4h1.5v1.5H9.4zM11.9 11.9h1.5v1.5h-1.5z',
    to: '/portal/payment',
    roles: STAFF,
  },
  { label: 'Summary', icon: 'M2.6 3.2h10.8M2.6 6.5h10.8M2.6 9.8h10.8M2.6 13.1h6.4', to: '/portal/summary', roles: STAFF },
  {
    label: 'Production',
    icon: 'M8 2 14 5.2 8 8.4 2 5.2 8 2ZM2 8.6 8 11.8 14 8.6M2 11.4 8 14.6 14 11.4',
    to: '/portal/production',
    roles: ['production', 'gm'],
  },
  {
    label: 'Finance',
    icon: 'M8 1.6v12.8M11.2 4.4c0-1.3-1.4-2.1-3.2-2.1s-3.2.8-3.2 2.1 1.4 2.1 3.2 2.1 3.2.8 3.2 2.1-1.4 2.1-3.2 2.1-3.2-.8-3.2-2.1',
    to: '/portal/finance',
    roles: ['finance', 'gm'],
  },
  {
    label: 'Quota',
    icon: 'M2.6 13V8.4M6.6 13V5.2M10.6 13V9.2M14 13V3',
    to: '/portal/quota',
    // Marketing owns the target — it is their number to set, and the GM keeps
    // it too because the GM signs off on the month.
    roles: ['marketing', 'gm'],
  },
  {
    label: 'Users',
    // Two heads and a shoulder each. The old path had an arc with six numbers
    // instead of seven, which is not a shape — it threw on every render.
    icon: 'M3.6 5.6a2.4 2.4 0 1 0 4.8 0a2.4 2.4 0 1 0-4.8 0M1.8 13.4c0-2.3 1.9-3.8 4.2-3.8s4.2 1.5 4.2 3.8M9.7 4.6a1.8 1.8 0 1 0 3.6 0a1.8 1.8 0 1 0-3.6 0M11.6 9.8c1.7.3 2.8 1.5 2.8 3.2',
    to: '/portal/users',
    roles: ['gm'],
  },
  // Last on purpose: it is about the person, not the shop's numbers.
  {
    label: 'Profile',
    icon: 'M8 2.8a2.8 2.8 0 1 1 0 5.6 2.8 2.8 0 0 1 0-5.6ZM2.6 13.8c0-2.9 2.4-4.8 5.4-4.8s5.4 1.9 5.4 4.8',
    to: '/portal/profile',
    roles: STAFF,
  },
];

export default function SideRail() {
  const { member, role, signOut } = useAuth();
  const navigate = useNavigate();

  const rail = RAIL.filter((item) => !item.roles || (role !== null && item.roles.includes(role)));

  async function leave() {
    await signOut();
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
          <span className="block font-serif text-[17px] leading-tight text-white">Sakssesories PH</span>
          <span className="mt-1 block text-[7px] uppercase tracking-[0.22em] text-white/40 max-md:hidden">
            by Sakssesories
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

      {/* Stacked, not side by side: the name needs the full width of the rail,
          and "Carlo M…" is not a name. */}
      <div className="mt-auto grid gap-1.5 px-2 max-md:ml-auto max-md:mt-0 max-md:flex max-md:items-center max-md:px-0">
        {/* The corner is the shortcut to your own page — and the one place the
            photo you set actually shows up. */}
        <Link
          to="/portal/profile"
          title="Your profile"
          className="flex min-w-0 items-center gap-2.5 rounded-md px-1.5 py-1.5 transition-colors hover:bg-white/5 max-md:hidden"
        >
          <span className="grid h-7 w-7 flex-none place-items-center overflow-hidden rounded-full bg-white/12">
            {member?.avatar ? (
              <img src={member.avatar} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="text-[9px] leading-none text-white/70">
                {initialsOf(member?.name ?? '')}
              </span>
            )}
          </span>
          <span className="min-w-0">
            <strong className="block truncate text-[10.5px] font-medium text-white/90">
              {member?.name ?? 'Signed out'}
            </strong>
            <small className="block truncate text-[8.5px] text-white/40">
              {member ? ROLE_LABEL[member.role] : 'No session'}
            </small>
          </span>
        </Link>
        <button
          onClick={leave}
          className="flex items-center justify-center gap-1.5 rounded-md border border-white/15 px-3 py-[9px] text-[10.5px] text-white/70 transition-colors hover:bg-white/5 hover:text-white max-md:px-2"
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
