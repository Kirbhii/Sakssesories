import { useLayoutEffect, type ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import Home from '@/pages/Home';
import Login from '@/pages/Login';
import Pos from '@/pages/Pos';
import Portal from '@/pages/Portal';
import MySales from '@/pages/MySales';
import Summary from '@/pages/Summary';
import PaymentQr from '@/pages/PaymentQr';
import Inventory from '@/pages/Inventory';
import Finance from '@/pages/Finance';
import QuotaSettings from '@/pages/QuotaSettings';
import Users from '@/pages/Users';
import Restricted from '@/components/Restricted';
import Closed from '@/components/Closed';
import { useAuth } from '@/lib/auth';
import { isClosed } from '@/lib/schedule';
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

/** A quiet mark while the session is being checked — never a bounce to /login. */
function Checking() {
  return (
    <div className="grid min-h-screen place-items-center bg-blush-50">
      <img src="/img/logo-mark.png" alt="" width={640} height={531} className="h-12 w-auto opacity-40" />
    </div>
  );
}

/** Signed out? Nothing behind this door is visible, not even a stub. */
function RequireAuth({ children }: { children: ReactNode }) {
  const { member, loading } = useAuth();
  if (loading) return <Checking />;
  if (!member) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

/**
 * Closed day? Ordering is shut, but the shop itself stays browsable — so only
 * the POS/ordering route is replaced with the closed screen, not the whole site.
 */
function RequireOpen({ children }: { children: ReactNode }) {
  if (isClosed()) return <Closed />;
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
        {/* ── Public face: Shop + POS keep the horizontal navbar ─────────── */}
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />

        {/* The POS is open to everyone — a signed-out visitor is a customer
            ordering for themselves (cash locked, no quota). A signed-in member
            is staff ringing up a sale (cash enabled, quota shown). */}
        <Route
          path="/pos"
          element={
            <RequireOpen>
              <Pos />
            </RequireOpen>
          }
        />

        {/* ── Staff face: one Portal, the rail on the left, the tab on the
            right. Every staff door lives inside /portal, so a member only sees
            the tabs their role allows. ─────────────────────────────────── */}
        <Route
          path="/portal"
          element={
            <RequireAuth>
              <Portal />
            </RequireAuth>
          }
        >
          <Route index element={<MySales />} />
          {/* The overall summary is open to every staff member, so no RequireRole. */}
          <Route path="summary" element={<Summary />} />
          {/* Every member publishes their own payment codes, so no RequireRole. */}
          <Route path="payment" element={<PaymentQr />} />
          <Route path="inventory" element={<Inventory />} />
          <Route
            path="finance"
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
            path="quota"
            element={
              <RequireRole allow={['gm']} need="Only the GM sets the monthly quota.">
                <QuotaSettings />
              </RequireRole>
            }
          />
          <Route
            path="users"
            element={
              <RequireRole allow={['gm']} need="Only the GM manages accounts and roles.">
                <Users />
              </RequireRole>
            }
          />
        </Route>

        <Route path="*" element={<Home />} />
      </Routes>
    </BrowserRouter>
  );
}
