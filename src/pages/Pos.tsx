import { useMemo, useState } from 'react';
import SiteHeader from '@/components/SiteHeader';
import Chain from '@/components/Chain';
import { useAuth } from '@/lib/auth';
import { VARIANTS, engravingFee, cleanEngraving, peso, type Variant } from '@/lib/data';
import { PLAN, barWidth, creditRecipient, memberOf, quotaOf, roomOf } from '@/lib/quota';

type PaymentMethod = 'cash' | 'gcash' | 'card';

interface CartLine extends Variant {
  qty: number;
  engraving: string;
}

const PAYMENTS: { id: PaymentMethod; label: string }[] = [
  { id: 'cash', label: 'Cash' },
  { id: 'gcash', label: 'GCash' },
  { id: 'card', label: 'Card' },
];

export default function Pos() {
  const { member } = useAuth();

  const [cart, setCart] = useState<CartLine[]>(() => [
    { ...VARIANTS.find((v) => v.key === 'heart-maroon')!, qty: 1, engraving: '' },
    { ...VARIANTS.find((v) => v.key === 'teardrop-tan')!, qty: 1, engraving: '' },
  ]);
  const [shape, setShape] = useState<'all' | 'heart' | 'teardrop'>('all');
  const [query, setQuery] = useState('');
  const [payment, setPayment] = useState<PaymentMethod>('cash');
  const [cash, setCash] = useState('500');
  const [done, setDone] = useState(false);

  const visible = useMemo(
    () =>
      VARIANTS.filter(
        (v) =>
          (shape === 'all' || v.shape === shape) &&
          (query === '' ||
            `${v.shapeName} ${v.colour} ${v.sku}`.toLowerCase().includes(query.toLowerCase())),
      ),
    [shape, query],
  );

  // RequireAuth in App.tsx already blocks a signed-out visitor, so this is
  // unreachable — but the quota below belongs to a real person or to nobody.
  if (!member) return null;

  // ── The two gates ───────────────────────────────────────────────────────
  // Stock is checked per variant (cards at 0 are disabled and quantities are
  // capped at what is left). Quota is checked here: a sale can only be
  // recorded if somebody on the team still has room to carry it.
  //
  // Everything below follows the person who is signed in — not a fixed name.
  const meQuota = quotaOf(member.id);
  const meRoom = roomOf(member.id);
  const recipient = creditRecipient(member.id);
  const blocked = recipient === null;
  const creditName = recipient ? memberOf(recipient)?.name : null;

  const subtotal = cart.reduce((sum, l) => sum + l.price * l.qty, 0);
  const engravingTotal = cart.reduce(
    (sum, l) => sum + engravingFee(l.engraving.length) * l.qty,
    0,
  );
  const total = subtotal + engravingTotal;
  // `cash` is typed in pesos; totals are centavos — convert before comparing.
  const cashValue = Math.round(Number(cash || 0) * 100);
  const change = cashValue - total;

  function add(v: Variant) {
    setCart((prev) => {
      const found = prev.find((l) => l.key === v.key);
      if (found) {
        return prev.map((l) =>
          l.key === v.key ? { ...l, qty: Math.min(l.stock, l.qty + 1) } : l,
        );
      }
      return [...prev, { ...v, qty: 1, engraving: '' }];
    });
  }

  function bump(key: string, delta: number) {
    setCart((prev) =>
      prev
        .map((l) => (l.key === key ? { ...l, qty: Math.min(l.stock, l.qty + delta) } : l))
        .filter((l) => l.qty > 0),
    );
  }

  function setEngraving(key: string, value: string) {
    const cleaned = cleanEngraving(value);
    setCart((prev) => prev.map((l) => (l.key === key ? { ...l, engraving: cleaned } : l)));
  }

  function complete() {
    if (!cart.length || blocked) return;
    setDone(true);
    window.setTimeout(() => {
      setDone(false);
      setCart([]);
    }, 1400);
  }

  const inCart = (key: string) => cart.some((l) => l.key === key);

  return (
    <div className="min-h-screen bg-blush-50">
      <SiteHeader />

      <main className="mx-auto max-w-[1560px]">
        <div className="grid grid-cols-[1fr_352px] items-stretch max-xl:grid-cols-1">
          {/* ── Catalogue ─────────────────────────────────────────────── */}
          <section className="px-[34px] pb-[46px] pt-[26px] max-md:px-5">
            <h1 className="text-[clamp(26px,2.3vw,31px)]">A new little collection.</h1>
            <p className="mt-1.5 max-w-[62ch] text-[11.5px] text-ink-500">
              Tap a variant to add it to the order — stock updates as you go.
            </p>

            <div className="relative mt-5 max-w-[340px]">
              <svg
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.3"
                className="pointer-events-none absolute left-[13px] top-1/2 h-3 w-3 -translate-y-1/2 text-ink-300"
              >
                <circle cx="7" cy="7" r="4.4" />
                <path d="m10.4 10.4 3 3" strokeLinecap="round" />
              </svg>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search shape, colour, or SKU"
                className="w-full rounded-pill border border-blush-300 bg-white py-[9px] pl-[34px] pr-3.5 text-[11.5px] text-ink-900 outline-none placeholder:text-ink-300 focus:border-crimson-600"
              />
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              {[
                { id: 'all', label: 'All variants' },
                { id: 'heart', label: 'Heart' },
                { id: 'teardrop', label: 'Teardrop' },
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setShape(f.id as typeof shape)}
                  className={[
                    'rounded-pill border px-[15px] py-[7px] text-[10.5px] transition-colors',
                    shape === f.id
                      ? 'border-crimson-600 bg-crimson-600 text-white'
                      : 'border-blush-300 bg-white text-ink-500 hover:border-blush-400 hover:text-ink-900',
                  ].join(' ')}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <p className="mb-2.5 mt-[18px] text-[8.5px] uppercase tracking-[0.17em] text-ink-300">
              Showing {visible.length} of {VARIANTS.length} variants
            </p>

            <div className="grid grid-cols-3 gap-3 max-xl:grid-cols-2 max-md:grid-cols-1">
              {visible.map((v) => {
                const out = v.stock === 0;
                return (
                  <button
                    key={v.key}
                    disabled={out}
                    onClick={() => add(v)}
                    className={[
                      'overflow-hidden rounded-[7px] border bg-white text-left transition-all',
                      out
                        ? 'cursor-not-allowed border-blush-300 opacity-45'
                        : 'border-blush-300 hover:-translate-y-px hover:shadow-[0_10px_24px_-18px_rgba(74,17,26,0.5)]',
                      inCart(v.key) && !out ? 'border-wine-800 ring-1 ring-wine-800' : '',
                    ].join(' ')}
                  >
                    <div className="grid aspect-[4/3] place-items-center border-b border-blush-300/60 bg-blush-100">
                      <Chain shape={v.shape} colour={v.hex} className="w-[68px]" />
                    </div>
                    <div className="flex items-end justify-between gap-2 px-[11px] pb-[11px] pt-2.5">
                      <div>
                        <p className="font-serif text-[12px] leading-tight text-ink-900">
                          {v.shapeName} / {v.colour}
                        </p>
                        <p className="mt-[3px] text-[8.5px] tracking-[0.07em] text-ink-300">
                          {v.sku} · {v.stock} left
                        </p>
                        <span className="num mt-1.5 block text-[11.5px] font-medium">
                          {peso(v.price)}
                        </span>
                      </div>
                      <span className="grid h-[22px] w-[22px] flex-none place-items-center rounded-full border border-blush-300 bg-white text-ink-900">
                        <svg viewBox="0 0 12 12" className="h-[9px] w-[9px]" stroke="currentColor" strokeWidth="1.4">
                          <path d="M6 1v10M1 6h10" strokeLinecap="round" />
                        </svg>
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="mt-4 flex gap-2.5 rounded-md border border-[#f6e2e6] bg-[#fdf1f3] px-3.5 py-[11px] text-[10.5px] leading-[1.6] text-[#7d4a52]">
              <span className="mt-0.5 h-3 w-3 flex-none rounded-full border border-crimson-600" />
              <span>
                Every piece is hand-assembled. Engraving is free for 2 letters, then ₱2 per extra
                letter — up to 6.
              </span>
            </div>
          </section>

          {/* ── Cart ──────────────────────────────────────────────────── */}
          <aside className="sticky top-[76px] max-h-[calc(100vh-76px)] min-h-[calc(100vh-76px)] overflow-y-auto border-l border-blush-300 bg-white px-[22px] pb-7 pt-6 max-xl:static max-xl:min-h-0 max-xl:border-l-0 max-xl:border-t">
            <div className="flex items-baseline justify-between gap-2.5">
              <h2 className="text-[17px]">Current order</h2>
              <span className="text-[8.5px] tracking-[0.1em] text-ink-300">SK-261020-001</span>
            </div>

            <div className="mt-3.5 grid grid-cols-2 gap-2">
              <label className="block">
                <span className="mb-1 block text-[8px] uppercase tracking-[0.15em] text-ink-300">
                  Customer
                </span>
                <input
                  placeholder="Walk-in"
                  className="w-full rounded-[5px] border border-blush-300 px-2.5 py-[7px] text-[11px] outline-none focus:border-crimson-600"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-[8px] uppercase tracking-[0.15em] text-ink-300">
                  Mobile
                </span>
                <input
                  placeholder="09XX XXX XXXX"
                  className="w-full rounded-[5px] border border-blush-300 px-2.5 py-[7px] text-[11px] outline-none focus:border-crimson-600"
                />
              </label>
            </div>

            <div className="mt-3.5 border-t border-blush-300/60">
              {cart.length === 0 && (
                <p className="py-[18px] text-[11px] text-ink-300">
                  No items yet — tap a variant to start.
                </p>
              )}
              {cart.map((l) => (
                <div
                  key={l.key}
                  className="grid grid-cols-[1fr_auto] gap-1.5 border-b border-blush-300/60 py-[11px]"
                >
                  <div>
                    <p className="text-[11px] text-ink-900">
                      {l.shapeName} / {l.colour}
                    </p>
                    <p className="mt-0.5 text-[9px] text-ink-300">
                      {l.sku} · {peso(l.price)} each
                    </p>
                    <div className="mt-1.5 flex items-center gap-2">
                      <div className="inline-flex items-center overflow-hidden rounded-pill border border-blush-300">
                        <button
                          onClick={() => bump(l.key, -1)}
                          className="grid h-[18px] w-[18px] place-items-center text-[11px] text-ink-500 hover:bg-blush-100"
                        >
                          −
                        </button>
                        <span className="num min-w-[20px] text-center text-[10px]">{l.qty}</span>
                        <button
                          onClick={() => bump(l.key, 1)}
                          className="grid h-[18px] w-[18px] place-items-center text-[11px] text-ink-500 hover:bg-blush-100"
                        >
                          +
                        </button>
                      </div>
                      <input
                        value={l.engraving}
                        onChange={(e) => setEngraving(l.key, e.target.value)}
                        placeholder="Engraving"
                        maxLength={6}
                        className="w-[88px] rounded-pill border border-blush-300 px-[9px] py-[3px] text-[9.5px] uppercase tracking-[0.06em] outline-none focus:border-crimson-600"
                      />
                    </div>
                  </div>
                  <div className="num text-right text-[11px]">
                    {peso(l.price * l.qty + engravingFee(l.engraving.length) * l.qty)}
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-3 text-[11px]">
              <div className="flex justify-between py-[3px] text-ink-500">
                <span>Subtotal</span>
                <span className="num text-ink-900">{peso(subtotal)}</span>
              </div>
              <div className="flex justify-between py-[3px] text-ink-500">
                <span>Engraving</span>
                <span className="num text-ink-900">{peso(engravingTotal)}</span>
              </div>
              <div className="flex justify-between py-[3px] text-ink-500">
                <span>Discount</span>
                <span className="num text-ink-900">₱0</span>
              </div>
              <div className="mt-[9px] flex justify-between border-t border-blush-300 pt-[11px] text-[12px] font-medium text-ink-900">
                <span>Total due</span>
                <span className="num text-[16px]">{peso(total)}</span>
              </div>
            </div>

            <div className="mt-3.5">
              <span className="mb-1 block text-[8px] uppercase tracking-[0.15em] text-ink-300">
                Payment method
              </span>
              <div className="grid grid-cols-3 gap-1.5">
                {PAYMENTS.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setPayment(p.id)}
                    className={[
                      'rounded-[5px] border py-2 text-[10px] transition-colors',
                      payment === p.id
                        ? 'border-crimson-600 bg-crimson-600 text-white'
                        : 'border-blush-300 bg-white text-ink-500',
                    ].join(' ')}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {payment === 'cash' && (
              <label className="mt-2.5 block">
                <span className="mb-1 block text-[8px] uppercase tracking-[0.15em] text-ink-300">
                  Cash received
                </span>
                <input
                  type="number"
                  inputMode="numeric"
                  value={cash}
                  onChange={(e) => setCash(e.target.value)}
                  className="w-full rounded-[5px] border border-blush-300 px-2.5 py-[7px] text-[11px] outline-none focus:border-crimson-600"
                />
              </label>
            )}

            {payment === 'cash' && total > 0 && change >= 0 && (
              <div className="mt-2 flex items-center justify-between rounded-[5px] bg-ok-100 px-3 py-[9px] text-[10.5px] text-ok-600">
                <span>Change due</span>
                <b className="num text-[14px] font-medium">{peso(change)}</b>
              </div>
            )}

            <label className="mt-2.5 block">
              <span className="mb-1 block text-[8px] uppercase tracking-[0.15em] text-ink-300">
                Note for the order
              </span>
              <input
                placeholder="e.g. Gift — please wrap in tissue"
                className="w-full rounded-[5px] border border-blush-300 px-2.5 py-[7px] text-[11px] outline-none focus:border-crimson-600"
              />
            </label>

            <div
              className={[
                'mt-3 rounded-[5px] border px-3 py-2.5',
                meRoom === 0 ? 'border-warn-600/40 bg-warn-100' : 'border-blush-300 bg-blush-50',
              ].join(' ')}
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[8px] uppercase tracking-[0.15em] text-ink-300">
                  {PLAN.label} quota · {member.name}
                </span>
                <span className="num text-[10px] text-ink-500">
                  {member.credited} / {meQuota}
                </span>
              </div>
              <div className="mt-1.5 h-[3px] overflow-hidden rounded-full bg-blush-200">
                <i
                  className={[
                    'block h-full rounded-full',
                    meRoom === 0 ? 'bg-ok-600' : 'bg-crimson-600',
                  ].join(' ')}
                  style={{ width: `${barWidth(member.credited, meQuota)}%` }}
                />
              </div>
              <p
                className={[
                  'mt-1.5 text-[9px] leading-[1.5]',
                  meRoom === 0 ? 'text-warn-600' : 'text-ink-500',
                ].join(' ')}
              >
                {meRoom > 0
                  ? `${meRoom} left for you this month.`
                  : recipient
                    ? `Full. This sale is credited to ${creditName} instead.`
                    : `Full, and the team is at ${PLAN.team}/${PLAN.team}. No more pieces can be recorded.`}
              </p>
            </div>

            <button
              onClick={complete}
              disabled={!cart.length || blocked}
              className={[
                'mt-3 w-full justify-center rounded-pill px-[18px] py-3 text-[11.5px] font-medium text-white transition-colors',
                blocked ? 'bg-ink-500' : done ? 'bg-ok-600' : 'bg-crimson-600 hover:bg-wine-800',
                !cart.length && !blocked ? 'opacity-50' : '',
              ].join(' ')}
            >
              {blocked
                ? `Team quota reached · ${PLAN.team}/${PLAN.team}`
                : done
                  ? `Sale recorded — ${creditName} ✓`
                  : `Complete sale · ${peso(total)}`}
            </button>

            <div className="mt-2.5 flex items-center justify-between text-[9.5px] text-ink-300">
              <button className="border-b border-blush-300 pb-px hover:text-crimson-600">Hold order</button>
              <button className="border-b border-blush-300 pb-px hover:text-crimson-600">Print receipt</button>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
