import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import SiteHeader from '@/components/SiteHeader';
import SiteFooter from '@/components/SiteFooter';
import { peso } from '@/lib/data';
import {
  STAGE_LABEL,
  payLabel,
  stageTrack,
  trackOrder,
  type TrackResult,
  type TrackedOrder,
} from '@/lib/sales';

/**
 * Where is my order?
 *
 * The shop has no customer accounts, so this page is the only way a buyer can
 * find out what happened to their order without ringing somebody. It asks for
 * two things and nothing else: the order number off their receipt, and the
 * mobile number they gave at the till.
 *
 * Both are required. Order numbers run in sequence, so the number on its own
 * would let anyone walk the ledger; the mobile is the part only the buyer has.
 * A wrong mobile and a number that does not exist give the same answer on
 * purpose — anything else turns this page into a way to test which numbers are
 * real.
 */
export default function Track() {
  const [orNo, setOrNo] = useState('');
  const [mobile, setMobile] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<TrackResult | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setResult(null);
    setResult(await trackOrder(orNo, mobile));
    setBusy(false);
  }

  const field =
    'w-full rounded-[5px] border border-blush-300 bg-white px-3 py-2.5 text-[12px] text-ink-900 outline-none placeholder:text-ink-300 focus:border-crimson-600';

  return (
    <div className="min-h-screen bg-blush-50">
      <SiteHeader />

      <main className="mx-auto max-w-[760px] px-5 pb-16 pt-9">
        <p className="eyebrow">Order tracking</p>
        <h1 className="mt-1.5 text-[clamp(24px,2.4vw,31px)]">Where is my order?</h1>
        <p className="mt-1.5 max-w-[58ch] text-[11.5px] leading-[1.65] text-ink-500">
          Enter the order number from your receipt, and the mobile number you gave when you
          ordered. Both are needed — they are what proves the order is yours.
        </p>

        <form onSubmit={submit} className="mt-5 rounded-[9px] border border-blush-300 bg-white p-5">
          <div className="grid grid-cols-2 gap-3.5 max-sm:grid-cols-1">
            <label className="block">
              <span className="mb-1 block text-[8.5px] uppercase tracking-[0.14em] text-ink-300">
                Order number
              </span>
              <input
                value={orNo}
                onChange={(e) => setOrNo(e.target.value)}
                placeholder="990342"
                inputMode="numeric"
                aria-label="Order number"
                className={`num ${field}`}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[8.5px] uppercase tracking-[0.14em] text-ink-300">
                Mobile number
              </span>
              <input
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                placeholder="0917 123 4567"
                inputMode="tel"
                aria-label="Mobile number"
                className={`num ${field}`}
              />
            </label>
          </div>

          <button
            type="submit"
            disabled={busy || !orNo.trim() || !mobile.trim()}
            className="mt-4 w-full justify-center rounded-pill bg-crimson-600 px-[18px] py-3 text-[11.5px] font-medium text-white transition-colors hover:bg-wine-800 disabled:opacity-50"
          >
            {busy ? 'Looking…' : 'Track order'}
          </button>

          <p className="mt-2.5 text-center text-[9px] leading-[1.6] text-ink-300">
            Lost your number? Message the team on the number you ordered from, or ask at the
            counter — we can find the order by your name.
          </p>
        </form>

        {result?.status === 'missing' && (
          <p className="mt-4 rounded-[6px] border border-blush-300 bg-white px-4 py-3 text-[11px] leading-[1.6] text-ink-500">
            No order matches that number and mobile. Check the number on your receipt — it is the
            digits above the date — and that the mobile is the one you gave at the till.
          </p>
        )}

        {result?.status === 'unavailable' && (
          <p className="mt-4 rounded-[6px] border border-blush-300 bg-white px-4 py-3 text-[11px] leading-[1.6] text-ink-500">
            Tracking is not switched on yet. This is our side, not yours — ask the team to look the
            order up by your name in the meantime.
          </p>
        )}

        {result?.status === 'found' && <OrderCard order={result.order} />}

        <p className="mt-6 text-[10px] text-ink-300">
          <Link to="/" className="underline underline-offset-2">
            Back to the shop
          </Link>
        </p>
      </main>

      <SiteFooter />
    </div>
  );
}

function OrderCard({ order }: { order: TrackedOrder }) {
  const steps = stageTrack(order.fulfilment);
  const cancelled = order.stage === 'cancelled';
  // A stage that is not on this order's own track (a pickup marked 'shipped')
  // would otherwise show nothing at all; treat it as the first step so the
  // customer still sees the order rather than an empty rail.
  const at = Math.max(0, steps.indexOf(order.stage));

  return (
    <div className="mt-4 overflow-hidden rounded-[9px] border border-blush-300 bg-white">
      <div className="flex items-baseline justify-between gap-3 border-b border-blush-300/60 px-5 py-4">
        <div>
          <p className="text-[8px] uppercase tracking-[0.18em] text-ink-300">Order</p>
          <p className="num mt-1 text-[22px] font-medium leading-none text-ink-900">{order.orNo}</p>
        </div>
        <div className="text-right">
          <p className="text-[8px] uppercase tracking-[0.18em] text-ink-300">Placed</p>
          <p className="num mt-1 text-[11px] text-ink-500">{order.placedOn}</p>
        </div>
      </div>

      {cancelled ? (
        <div className="px-5 py-5">
          <p className="rounded-[5px] bg-bad-100 px-3 py-2.5 text-[11px] leading-[1.6] text-bad-600">
            This order was cancelled. If that is a surprise, message the team — nothing was
            collected for it.
          </p>
        </div>
      ) : (
        <ol className="px-5 py-5">
          {steps.map((s, i) => {
            const done = i < at;
            const current = i === at;
            return (
              <li key={s} className="flex gap-3">
                <div className="flex w-4 flex-none flex-col items-center">
                  <span
                    className={[
                      'mt-[3px] flex h-[13px] w-[13px] flex-none items-center justify-center rounded-full border',
                      done
                        ? 'border-ok-600 bg-ok-600 text-white'
                        : current
                          ? 'border-crimson-600 bg-white'
                          : 'border-blush-300 bg-white',
                    ].join(' ')}
                  >
                    {done && (
                      <svg viewBox="0 0 12 12" className="h-2 w-2" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M2 6.2 4.6 8.8 10 3.4" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                    {current && <i className="h-[5px] w-[5px] rounded-full bg-crimson-600" />}
                  </span>
                  {i < steps.length - 1 && (
                    <span
                      className={`w-px flex-1 ${done ? 'bg-ok-600' : 'bg-blush-300'}`}
                      style={{ minHeight: 18 }}
                    />
                  )}
                </div>
                <div className={`pb-3 ${i === steps.length - 1 ? 'pb-0' : ''}`}>
                  <p
                    className={[
                      'text-[11.5px] leading-tight',
                      current ? 'font-medium text-ink-900' : done ? 'text-ink-500' : 'text-ink-300',
                    ].join(' ')}
                  >
                    {STAGE_LABEL[s]}
                  </p>
                  {current && (
                    <p className="mt-0.5 text-[9.5px] leading-[1.5] text-ink-300">
                      {s === 'placed'
                        ? 'We have your order. The team is checking the payment next.'
                        : s === 'preparing'
                          ? 'Your piece is being made and packed.'
                          : s === 'ready'
                            ? 'Ready to collect inside the campus, at Quezon City University - Main.'
                            : s === 'shipped'
                              ? 'Out with the courier. Keep the exact amount ready for the shipping fee.'
                              : s === 'claimed'
                                ? 'Collected. Thank you!'
                                : 'Delivered. Thank you!'}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}

      <dl className="border-t border-blush-300/60 px-5 py-4 text-[10.5px]">
        {[
          ['Name', order.customer],
          ['Mobile', `•••• ${order.mobileLast4}`],
          ['Items', order.items],
          ['Pieces', String(order.pieces)],
          ['Payment', `${payLabel(order.payment)} · ${order.paid ? 'confirmed' : 'being checked'}`],
          ['Fulfilment', order.fulfilment],
        ].map(([k, v]) => (
          <div key={k} className="flex justify-between gap-4 py-[5px]">
            <dt className="flex-none text-ink-300">{k}</dt>
            <dd className="text-right text-ink-900">{v}</dd>
          </div>
        ))}
        <div className="mt-1.5 flex items-baseline justify-between border-t border-blush-300 pt-2.5">
          <dt className="text-[12px] font-medium text-ink-900">Total paid</dt>
          <dd className="num text-[16px]">{peso(order.cents)}</dd>
        </div>
      </dl>

      {order.fulfilment.toLowerCase().includes('deliver') && (
        <p className="border-t border-blush-300/60 px-5 py-3 text-[9px] leading-[1.55] text-ink-300">
          The shipping fee is shouldered by the customer and paid to the courier on delivery. It is
          not part of the total above.
        </p>
      )}
    </div>
  );
}
