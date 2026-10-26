import { Outlet } from 'react-router-dom';
import SideRail from '@/components/SideRail';

/**
 * The staff side of the app is one Portal: the wine rail on the left, the
 * selected tab on the right. Every staff page is a child route of /portal, so a
 * member only ever sees the doors their role allows. Shop (Home) and the POS
 * stay outside the portal with the horizontal navbar.
 */
export default function Portal() {
  return (
    <div className="flex min-h-screen bg-blush-50 max-md:flex-col">
      <SideRail />
      <div className="min-w-0 flex-1">
        <Outlet />
      </div>
    </div>
  );
}
