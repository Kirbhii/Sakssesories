import { useLayoutEffect, type ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import Home from '@/pages/Home';
import Login from '@/pages/Login';
import Pos from '@/pages/Pos';
import Portal from '@/pages/Portal';
import Inventory from '@/pages/Inventory';
import Finance from '@/pages/Finance';
import QuotaSettings from '@/pages/QuotaSettings';
import Users from '@/pages/Users';
import Restricted from '@/components/Restricted';
import { useAuth } from '@/lib/auth';
import type { MemberRole } from '@/lib/quota';

/** Every route starts at the top — no inheriting the previous page's scroll. */
function ScrollToTop() {
  const { pathname } = useLocation();

  useLayoutEffect(() => {
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
  }, [pathname]);

  return null;
}

/** Signed out? Nothing behind this door is visible, not even a stub. */
function RequireAuth({ children }: { children: ReactNode }) {
  const { member } = useAuth();
  if (!member) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

/** Signed in but wrong role? Say so plainly instead of bouncing to the homepage. */
function RequireRole({
  allow,
  need,
  children,
}: {
  allow: MemberRole[];
  need: string;
  children: ReactNode;
}) {
  const { role } = useAuth();
  if (!role) return <Navigate to="/login" replace />;
  if (!allow.includes(role)) return <Restricted need={need} />;
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />

        <Route
          path="/pos"
          element={
            <RequireAuth>
              <Pos />
            </RequireAuth>
          }
        />
        <Route
          path="/portal"
          element={
            <RequireAuth>
              <Portal />
            </RequireAuth>
          }
        />
        <Route
          path="/inventory"
          element={
            <RequireAuth>
              <Inventory />
            </RequireAuth>
          }
        />

        <Route
          path="/finance"
          element={
            <RequireRole
              allow={['finance', 'gm']}
              need="Revenue, cost and cash belong to Finance and the GM."
            >
              <Finance />
            </RequireRole>
          }
        />
        <Route
          path="/quota"
          element={
            <RequireRole allow={['gm']} need="Only the GM sets the monthly quota.">
              <QuotaSettings />
            </RequireRole>
          }
        />
        <Route
          path="/users"
          element={
            <RequireRole allow={['gm']} need="Only the GM manages accounts and roles.">
              <Users />
            </RequireRole>
          }
        />

        <Route path="*" element={<Home />} />
      </Routes>
    </BrowserRouter>
  );
}
