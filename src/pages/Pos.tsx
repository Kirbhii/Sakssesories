import { useRef, useState, type ReactNode } from 'react';
import SiteHeader from '@/components/SiteHeader';
import { useAuth } from '@/lib/auth';
import {
  COLOURS,
  PRODUCT,
  SHAPES,
  VARIANTS,
  cleanEngraving,
  engravingFee,
  peso,
  type ShapeId,
} from '@/lib/data';
import { PLAN, barWidth, creditRecipient, memberOf, quotaOf, roomOf } from '@/lib/quota';

type PaymentMethod = 'cash' | 'gcash' | 'card';
type Fulfilment = 'pickup' | 'delivery';

const PAYMENTS: { id: PaymentMethod; label: string }[] = [
  { id: 'cash', label: 'Cash' },
  { id: 'gcash', label: 'GCash' },
  { id: 'card', label: 'Card' },
];

// Both are free for now — the team confirms the arrangement after the order is
// sent. Change the fee here when a delivery charge is decided.
const FULFILMENT: { id: Fulfilment; label: string; fee: number }[] = [
  { id: 'pickup', label: 'Store pickup', fee: 0 },
  { id: 'delivery', label: 'Delivery', fee: 0 },
];

/** The colour each shape ships in — the one that matches its real photo. */
const HOME_COLOUR: Record<ShapeId, string> = { heart: 'maroon', teardrop: 'black' };

interface CartLine {
  key: string;
  shape: ShapeId;
  shapeName: string;
  colourId: string;
  colourName: string;
  hex: string;
  sku: string;
  base: number;
  unit: number;
  qty: number;
  engraving: string;
}

interface Details {
  name: string;
  mobile: string;
  email: string;
  fulfilment: Fulfilment;
  note: string;
}

/** A numbered step heading — "01 / Choose your shape". */
function Step({
  n,
  title,
  aside,
}: {
  n: string;
  title: string;
  aside?: ReactNode;
}) {
  return (
    <div data-step={n} className="flex items-baseline justify-between gap-3">
      <span className="text-[11px] font-medium text-ink-900">
        <span className="num text-ink-300">{n} /</span> {title}
      </span>
      {aside && <span className="text-[10.5px] text-ink-500">{aside}</span>}
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[8.5px] uppercase tracking-[0.14em] text-ink-300">
        {label}
        {required && <span className="ml-0.5 text-crimson-600">*</span>}
      </span>
      {children}
    </label>
  );
}

const inputClass =
  'w-full rounded-[5px] border border-blush-300 bg-white px-2.5 py-[7px] text-[11px] text-ink-900 outline-none placeholder:text-ink-300 focus:border-crimson-600';

export default function Pos() {
  const { member } = useAuth();
  const builder = useRef<HTMLDivElement>(null);

  // ── The builder (left) ───────────────────────────────────────────────────
  const [shape, setShape] = useState<ShapeId>('heart');
  const [colour, setColour] = useState<string>('maroon');
  const [engraving, setEngraving] = useState('');
  const [qty, setQty] = useState(1);
  const [flash, setFlash] = useState('');

  // ── The collection (right) ───────────────────────────────────────────────
  const [cart, setCart] = useState<CartLine[]>([]);
  const [details, setDetails] = useState<Details>({
    name: '',
    mobile: '',
    email: '',
    fulfilment: 'pickup',
    note: '',
  });
  const [payment, setPayment] = useState<PaymentMethod>(member ? 'cash' : 'gcash');
  const [cash, setCash] = useState('');
  const [done, setDone] = useState(false);

  // The POS is open to everyone. A signed-out visitor is a customer ordering
  // for themselves (cash locked, no quota); a signed-in member is staff ringing
  // up a sale (cash enabled, quota shown). `member` is null for the former, so
  // every member-only bit below is guarded by `isStaff`.
  const isStaff = !!member;

  const variant = VARIANTS.find((v) => v.key === `${shape}-${colour}`);
  const stock = variant?.stock ?? 0;
  const base = variant?.price ?? SHAPES[0].price;
  const engraved = cleanEngraving(engraving);
  const letters = engraved.length;
  const letterFee = engravingFee(letters);
  const unitPrice = base + letterFee;
  const addTotal = unitPrice * qty;

  const pieces = cart.reduce((sum, l) => sum + l.qty, 0);
  const subtotal = cart.reduce((sum, l) => sum + l.unit * l.qty, 0);
  const fulfilmentFee = FULFILMENT.find((f) => f.id === details.fulfilment)?.fee ?? 0;
  const total = subtotal + fulfilmentFee;

  // `cash` is typed in pesos; totals are centavos — convert before comparing.
  const cashValue = Math.round(Number(cash || 0) * 100);
  const change = cashValue - total;

  const meQuota = member ? quotaOf(member.id) : 0;
  const meRoom = member ? roomOf(member.id) : 0;
  const recipient = member ? creditRecipient(member.id) : null;
  const blocked = isStaff && recipient === null;
  const creditName = recipient ? memberOf(recipient)?.name : null;

  const missing: string[] = [];
  if (!details.name.trim()) missing.push('name');
  if (!details.mobile.trim()) missing.push('mobile');

  function pickShape(next: ShapeId) {
    setShape(next);
    setColour(HOME_COLOUR[next]);
  }

  function addToCart() {
    if (!variant || stock === 0) return;
    const name = cleanEngraving(engraving);
    const key = `${shape}-${colour}-${name}`;

    setCart((prev) => {
      const found = prev.find((l) => l.key === key);
      if (found) {
        return prev.map((l) =>
          l.key === key ? { ...l, qty: Math.min(stock, l.qty + qty) } : l,
        );
      }
      return [
        ...prev,
        {
          key,
          shape,
          shapeName: variant.shapeName,
          colourId: colour,
          colourName: variant.colour,
          hex: variant.hex,
          sku: variant.sku,
          base,
          unit: base + engravingFee(name.length),
          qty: Math.min(stock, qty),
          engraving: name,
        },
      ];
    });

    setFlash(
      `Added to your order — ${qty} ${variant.shapeName.toLowerCase()}${
        qty > 1 ? 's' : ''
      } in ${variant.colour.toLowerCase()}.`,
    );
    setQty(1);
    window.setTimeout(() => setFlash(''), 4000);
  }

  function bump(key: string, delta: number) {
    setCart((prev) =>
      prev
        .map((l) => {
          if (l.key !== key) return l;
          const limit = VARIANTS.find((v) => v.key === `${l.shape}-${l.colourId}`)?.stock ?? l.qty;
          return { ...l, qty: Math.min(limit, Math.max(0, l.qty + delta)) };
        })
        .filter((l) => l.qty > 0),
    );
  }

  function setLineEngraving(key: string, value: string) {
    const clean = cleanEngraving(value);
    setCart((prev) =>
      prev.map((l) =>
        l.key === key ? { ...l, engraving: clean, unit: l.base + engravingFee(clean.length) } : l,
      ),
    );
  }

  function complete() {
    if (!cart.length || missing.length) return;
    if (isStaff && blocked) return;
    setDone(true);
    window.setTimeout(() => {
      setDone(false);
      setCart([]);
      setEngraving('');
    }, 1400);
  }

  const lineCount = cart.reduce((sum, l) => sum + l.qty, 0);

  return (
    <div className="min-h-screen bg-blush-50">
      <SiteHeader />

      <main className="mx-auto max-w-[1560px]">
        <div className="grid grid-cols-[1fr_352px] items-stretch max-xl:grid-cols-1">
          {/* ── Builder ────────────────────────────────────────────────── */}
          <section className="px-[34px] pb-[46px] pt-[26px] max-md:px-5">
            <h1 className="text-[clamp(26px,2.3vw,31px)]">Your ClearChain, your way.</h1>
            <p className="mt-1.5 max-w-[62ch] text-[11.5px] text-ink-500">
              Pick a shape, fill in a name, and build a collection of your own.
            </p>

            <div ref={builder} className="mt-5 overflow-hidden rounded-[9px] border border-blush-300 bg-white">
              {/* Product */}
              <div className="flex items-center justify-between gap-3 px-5 pt-4">
                <span className="eyebrow">The everyday companion</span>
                <span className="num text-[15px] font-medium text-ink-900">{peso(base)}</span>
              </div>

              <div className="grid grid-cols-[236px_1fr] items-center gap-6 p-5 max-md:grid-cols-1">
                <div>
                  <div className="overflow-hidden rounded-[7px] border border-blush-300/60">
                    <img
                      key={`${shape}-${colour}`}
                      src={`/img/product-${shape}-${colour}.webp`}
                      alt={`The ${variant?.colour.toLowerCase() ?? ''} ${variant?.shapeName.toLowerCase() ?? ''} ClearChain`}
                      className="swap-in aspect-[16/10] w-full object-cover"
                    />
                  </div>
                  <p className="mt-2 text-center text-[8.5px] uppercase tracking-[0.14em] text-ink-300">
                    {variant?.shapeName} / {variant?.colour}
                  </p>
                </div>

                <div>
                  <h2 className="text-[19px]">ClearChain</h2>
                  <p className="mt-1.5 max-w-[46ch] text-[11px] leading-[1.65] text-ink-500">
                    Leather insole, microfiber on the reverse. A little something for glasses and
                    screens, and a name that only you know.
                  </p>
                  <p className="mt-2.5 text-[10px] text-ink-300">
                    {letters > 0 ? (
                      <>
                        <span className="num">{letters}</span> letter{letters === 1 ? '' : 's'} ·{' '}
                        <span className="num text-ink-900">{peso(letterFee)}</span> engraving
                      </>
                    ) : (
                      <>First {PRODUCT.freeLetters} letters are free</>
                    )}
                  </p>
                </div>
              </div>

              {/* 01 — shape */}
              <div className="border-t border-blush-300/60 px-5 py-4">
                <Step n="01" title="Choose your shape" />
                <div className="mt-2.5 flex flex-wrap gap-2">
                  {SHAPES.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => pickShape(s.id)}
                      aria-pressed={shape === s.id}
                      className={[
                        'rounded-pill border px-[18px] py-[7px] text-[10.5px] transition-colors',
                        shape === s.id
                          ? 'border-crimson-600 bg-crimson-600 text-white'
                          : 'border-blush-300 bg-white text-ink-500 hover:border-wine-800 hover:text-wine-800',
                      ].join(' ')}
                    >
                      {s.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* 02 — colour */}
              <div className="border-t border-blush-300/60 px-5 py-4">
                <Step
                  n="02"
                  title="Choose your colour"
                  aside={<span className="text-ink-900">{variant?.colour}</span>}
                />
                <div className="mt-2.5 flex flex-wrap items-center gap-2.5">
                  {COLOURS.map((c) => {
                    const out =
                      VARIANTS.find((v) => v.key === `${shape}-${c.id}`)?.stock === 0;
                    return (
                      <button
                        key={c.id}
                        onClick={() => setColour(c.id)}
                        disabled={out}
                        aria-label={c.name}
                        aria-pressed={colour === c.id}
                        title={out ? `${c.name} — out of stock` : c.name}
                        className={[
                          'h-[26px] w-[26px] rounded-full border transition-all',
                          out ? 'cursor-not-allowed border-black/5 opacity-30' : '',
                          colour === c.id
                            ? 'border-ink-900 ring-2 ring-ink-900 ring-offset-2 ring-offset-white'
                            : 'border-black/15 hover:scale-105',
                        ].join(' ')}
                        style={{ background: c.hex }}
                      />
                    );
                  })}
                </div>
              </div>

              {/* 03 — the name */}
              <div className="border-t border-blush-300/60 px-5 py-4">
                <Step
                  n="03"
                  title="Name it"
                  aside={
                    <span className="text-ink-900">
                      {letterFee > 0 ? `+${peso(letterFee)}` : 'Free'}
                    </span>
                  }
                />

                <input
                  value={engraving}
                  onChange={(e) => setEngraving(cleanEngraving(e.target.value))}
                  placeholder="Type up to 6 letters"
                  aria-label="Engraving"
                  className="mt-2.5 w-full max-w-[320px] rounded-[5px] border border-blush-300 bg-white px-3 py-2 text-[12px] uppercase tracking-[0.18em] text-ink-900 outline-none placeholder:normal-case placeholder:tracking-normal placeholder:text-ink-300 focus:border-crimson-600"
                />

                <div className="mt-2.5 flex gap-1.5">
                  {Array.from({ length: PRODUCT.maxLetters }, (_, i) => {
                    const ch = engraved[i];
                    const isNext = i === letters;
                    return (
                      <span
                        key={i}
                        className={[
                          'grid h-[30px] w-[30px] place-items-center rounded-[5px] border text-[12px] font-medium',
                          ch
                            ? 'border-wine-800 bg-blush-100 text-wine-800'
                            : isNext
                              ? 'border-crimson-600 bg-white text-ink-300'
                              : 'border-blush-300 bg-blush-50 text-ink-300',
                        ].join(' ')}
                      >
                        {ch ?? ''}
                      </span>
                    );
                  })}
                </div>

                <p className="mt-2 text-[9.5px] text-ink-300">
                  The first {PRODUCT.freeLetters} letters are free. Every letter after that is{' '}
                  {peso(PRODUCT.extraLetterCents)}, up to {PRODUCT.maxLetters} letters.
                </p>
              </div>

              {/* 04 — quantity */}
              <div className="border-t border-blush-300/60 px-5 py-4">
                <Step
                  n="04"
                  title="Quantity"
                  aside={
                    stock === 0 ? (
                      <span className="text-bad-600">Out of stock</span>
                    ) : (
                      <span className="text-ink-900">Available to order: {stock}</span>
                    )
                  }
                />
                <div className="mt-2.5 inline-flex items-center overflow-hidden rounded-pill border border-blush-300">
                  <button
                    onClick={() => setQty((q) => Math.max(1, q - 1))}
                    disabled={qty <= 1}
                    aria-label="Decrease quantity"
                    className="grid h-[30px] w-[32px] place-items-center text-[13px] text-ink-500 transition-colors hover:bg-blush-100 disabled:opacity-30"
                  >
                    −
                  </button>
                  <span className="num min-w-[28px] text-center text-[12px]">{qty}</span>
                  <button
                    onClick={() => setQty((q) => Math.min(Math.max(stock, 1), q + 1))}
                    disabled={qty >= stock}
                    aria-label="Increase quantity"
                    className="grid h-[30px] w-[32px] place-items-center text-[13px] text-ink-500 transition-colors hover:bg-blush-100 disabled:opacity-30"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Add to order */}
              <div className="border-t border-blush-300/60 px-5 py-4">
                <button
                  onClick={addToCart}
                  disabled={stock === 0}
                  className={[
                    'flex w-full items-center justify-center gap-2 rounded-pill px-[18px] py-3 text-[11.5px] font-medium text-white transition-colors',
                    stock === 0
                      ? 'cursor-not-allowed bg-ink-500'
                      : 'bg-crimson-600 hover:bg-wine-800',
                  ].join(' ')}
                >
                  {stock === 0
                    ? 'Out of stock'
                    : `Add ${qty} to order · ${peso(addTotal)}`}
                </button>

                {flash && (
                  <p className="mt-2.5 flex items-center gap-1.5 text-[10px] text-ok-600">
                    <svg viewBox="0 0 12 12" className="h-3 w-3 flex-none" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M2 6.3 4.7 9 10 3.4" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    {flash} Keep going.
                  </p>
                )}
              </div>
            </div>

            {/* Details */}
            <div className="mt-4 rounded-[9px] border border-blush-300 bg-white px-5 py-5">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="text-[15px]">A few details, please.</h2>
                <span className="text-[9px] text-ink-300">Required to add your order</span>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3.5 max-md:grid-cols-1">
                <Field label="Full name" required>
                  <input
                    value={details.name}
                    onChange={(e) => setDetails({ ...details, name: e.target.value })}
                    placeholder="Jane Santos"
                    className={inputClass}
                  />
                </Field>
                <Field label="Mobile number" required>
                  <input
                    value={details.mobile}
                    onChange={(e) => setDetails({ ...details, mobile: e.target.value })}
                    placeholder="0917 551 0128"
                    inputMode="tel"
                    className={inputClass}
                  />
                </Field>
                <Field label="Email (optional)">
                  <input
                    value={details.email}
                    onChange={(e) => setDetails({ ...details, email: e.target.value })}
                    placeholder="jane@email.com"
                    className={inputClass}
                  />
                </Field>
                <Field label="Fulfilment" required>
                  <select
                    value={details.fulfilment}
                    onChange={(e) =>
                      setDetails({ ...details, fulfilment: e.target.value as Fulfilment })
                    }
                    className={inputClass}
                  >
                    {FULFILMENT.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>

              <div className="mt-3.5">
                <Field label="Order note (optional)">
                  <input
                    value={details.note}
                    onChange={(e) => setDetails({ ...details, note: e.target.value })}
                    placeholder="Please keep the heart and wedding pieces together"
                    className={inputClass}
                  />
                </Field>
              </div>

              <p className="mt-3.5 text-[9.5px] leading-[1.6] text-ink-300">
                Pickup, delivery, and payment arrangements will be confirmed by the team after you
                send your order.
              </p>
            </div>
          </section>

          {/* ── Collection ──────────────────────────────────────────────── */}
          <aside className="sticky top-[76px] max-h-[calc(100vh-76px)] min-h-[calc(100vh-76px)] overflow-y-auto border-l border-blush-300 bg-white px-[22px] pb-7 pt-6 max-xl:static max-xl:min-h-0 max-xl:border-l-0 max-xl:border-t">
            <div className="flex items-baseline justify-between gap-2.5">
              <h2 className="text-[17px]">Your little collection</h2>
              <span className="rounded-pill bg-blush-100 px-2 py-[3px] text-[9px] text-ink-500">
                {lineCount} {lineCount === 1 ? 'item' : 'items'}
              </span>
            </div>

            <div className="mt-3.5 border-t border-blush-300/60">
              {cart.length === 0 && (
                <p className="py-[18px] text-[11px] text-ink-300">
                  Nothing here yet — build a piece on the left to start.
                </p>
              )}

              {cart.map((l) => (
                <div
                  key={l.key}
                  className="grid grid-cols-[42px_1fr_auto] items-start gap-2.5 border-b border-blush-300/60 py-[12px]"
                >
                  <span
                    className="h-[42px] w-[42px] overflow-hidden rounded-[5px] border border-blush-300/60"
                  >
                    <img
                      src={`/img/product-${l.shape}-${l.colourId}.webp`}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  </span>

                  <div className="min-w-0">
                    <p className="text-[11px] leading-tight text-ink-900">{PRODUCT.name}</p>
                    <p className="mt-[3px] text-[9.5px] text-ink-500">
                      {l.shapeName} / {l.colourName}
                    </p>
                    <p className="mt-[3px] text-[8.5px] text-ink-300">
                      {l.engraving ? `Engraved ${l.engraving}` : 'No name'} · {l.sku}
                    </p>

                    <div className="mt-2 flex items-center gap-2">
                      <div className="inline-flex items-center overflow-hidden rounded-pill border border-blush-300">
                        <button
                          onClick={() => bump(l.key, -1)}
                          aria-label={`Remove one ${l.shapeName}`}
                          className="grid h-[20px] w-[20px] place-items-center text-[11px] text-ink-500 transition-colors hover:bg-blush-100"
                        >
                          −
                        </button>
                        <span className="num min-w-[22px] text-center text-[10px]">{l.qty}</span>
                        <button
                          onClick={() => bump(l.key, 1)}
                          aria-label={`Add one ${l.shapeName}`}
                          className="grid h-[20px] w-[20px] place-items-center text-[11px] text-ink-500 transition-colors hover:bg-blush-100"
                        >
                          +
                        </button>
                      </div>
                      <input
                        value={l.engraving}
                        onChange={(e) => setLineEngraving(l.key, e.target.value)}
                        placeholder="Name"
                        aria-label={`Engraving for ${l.shapeName} ${l.colourName}`}
                        maxLength={PRODUCT.maxLetters}
                        className="w-[74px] rounded-pill border border-blush-300 px-[9px] py-[3px] text-[9px] uppercase tracking-[0.08em] outline-none placeholder:normal-case placeholder:tracking-normal placeholder:text-ink-300 focus:border-crimson-600"
                      />
                    </div>
                  </div>

                  <span className="num text-[11px] text-ink-900">{peso(l.unit * l.qty)}</span>
                </div>
              ))}
            </div>

            {cart.length > 0 && (
              <button
                onClick={() =>
                  builder.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                }
                className="mt-3 text-[10px] text-crimson-600 underline underline-offset-2"
              >
                + Add another piece
              </button>
            )}

            {/* Totals */}
            <div className="mt-4 border-t border-blush-300 pt-3.5 text-[11px]">
              <div className="flex justify-between py-[3px] text-ink-500">
                <span>Subtotal · {pieces} {pieces === 1 ? 'piece' : 'pieces'}</span>
                <span className="num text-ink-900">{peso(subtotal)}</span>
              </div>
              <div className="flex justify-between py-[3px] text-ink-500">
                <span>
                  {FULFILMENT.find((f) => f.id === details.fulfilment)?.label}
                </span>
                <span className="num text-ink-900">{peso(fulfilmentFee)}</span>
              </div>
              <div className="mt-[9px] flex items-baseline justify-between border-t border-blush-300 pt-[11px] font-medium text-ink-900">
                <span className="text-[12px]">Order total</span>
                <span className="num text-[18px]">{peso(total)}</span>
              </div>
            </div>

            {/* Payment */}
            <div className="mt-4">
              <span className="mb-1 block text-[8px] uppercase tracking-[0.15em] text-ink-300">
                Payment method
              </span>
              <div className="grid grid-cols-3 gap-1.5">
                {PAYMENTS.map((p) => {
                  const locked = p.id === 'cash' && !isStaff;
                  return (
                    <button
                      key={p.id}
                      onClick={() => !locked && setPayment(p.id)}
                      disabled={locked}
                      aria-pressed={payment === p.id}
                      aria-disabled={locked}
                      title={locked ? 'Cash is for staff selling on-site' : undefined}
                      className={[
                        'rounded-[5px] border py-2 text-[10px] transition-colors',
                        locked
                          ? 'cursor-not-allowed border-blush-300 bg-blush-50 text-ink-300 line-through'
                          : '',
                        payment === p.id
                          ? 'border-crimson-600 bg-crimson-600 text-white'
                          : 'border-blush-300 bg-white text-ink-500',
                      ].join(' ')}
                    >
                      {p.label}
                    </button>
                  );
                })}
              </div>

              {!isStaff && (
                <p className="mt-1.5 text-[9px] leading-[1.5] text-ink-300">
                  Cash is for staff selling on-site. Choose GCash or Card, and the team will confirm
                  payment when your order is ready.
                </p>
              )}
            </div>

            {payment === 'cash' && total > 0 && (
              <div className="mt-2.5">
                <label className="block">
                  <span className="mb-1 block text-[8px] uppercase tracking-[0.15em] text-ink-300">
                    Cash received
                  </span>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={cash}
                    onChange={(e) => setCash(e.target.value)}
                    placeholder="0"
                    className={inputClass}
                  />
                </label>

                {cash !== '' && change < 0 && (
                  <p className="mt-1.5 text-[9.5px] text-bad-600">
                    Short by {peso(Math.abs(change))} — the customer still owes this much.
                  </p>
                )}

                {cash !== '' && change >= 0 && (
                  <div className="mt-2 flex items-center justify-between rounded-[5px] bg-ok-100 px-3 py-[9px] text-[10.5px] text-ok-600">
                    <span>Change due</span>
                    <b className="num text-[14px] font-medium">{peso(change)}</b>
                  </div>
                )}
              </div>
            )}

            {/* Quota — staff only; a customer has no quota to fill */}
            {isStaff && (
              <div
                className={[
                  'mt-3.5 rounded-[5px] border px-3 py-2.5',
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
            )}

            <button
              onClick={complete}
              disabled={!cart.length || (isStaff && blocked) || missing.length > 0}
              className={[
                'mt-3.5 w-full justify-center rounded-pill px-[18px] py-3 text-[11.5px] font-medium text-white transition-colors',
                blocked ? 'bg-ink-500' : done ? 'bg-ok-600' : 'bg-crimson-600 hover:bg-wine-800',
                (!cart.length || missing.length > 0) && !blocked ? 'opacity-50' : '',
              ].join(' ')}
            >
              {blocked
                ? `Team quota reached · ${PLAN.team}/${PLAN.team}`
                : done
                  ? isStaff
                    ? `Sale recorded — ${creditName} ✓`
                    : 'Order sent ✓'
                  : `${isStaff ? 'Complete sale' : 'Send order'} · ${peso(total)}`}
            </button>

            {missing.length > 0 && cart.length > 0 && (
              <p className="mt-2 text-[9.5px] text-ink-300">
                {missing.includes('name') && missing.includes('mobile')
                  ? "Add the customer's name and mobile to continue."
                  : missing.includes('name')
                    ? "Add the customer's name to continue."
                    : "Add the customer's mobile number to continue."}
              </p>
            )}

            <p className="mt-2.5 text-[9px] leading-[1.6] text-ink-300">
              Need a hand? Ask the team on duty.
            </p>
          </aside>
        </div>
      </main>
    </div>
  );
}
