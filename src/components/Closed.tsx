import { nextOpenLabel, weekdayName } from '@/lib/schedule';

// ─── Closed for the day ─────────────────────────────────────────────────────
// Shown instead of the whole site on a day the shop does not operate (Wednesday
// for now). It sits outside the router, so even /login is unreachable — there is
// no operation, so there is nothing to sign in for. Deliberately calm and short:
// a customer or a member landing here should immediately understand it is the
// shop's rest day, not an error.

export default function Closed() {
  const today = new Date();
  const day = weekdayName(today.getDay());

  return (
    <main className="grid min-h-screen place-items-center bg-blush-50 px-6 text-center">
      <div className="max-w-[46ch]">
        <img
          src="/img/logo-mark.png"
          alt=""
          width={640}
          height={531}
          className="mx-auto h-12 w-auto opacity-90"
        />
        <p className="mt-6 text-[8px] uppercase tracking-[0.22em] text-ink-300">
          Saksesories PH
        </p>
        <h1 className="mt-2 text-[clamp(24px,3vw,32px)] text-ink-900">
          Sarado ngayong {day}.
        </h1>
        <p className="mt-3 text-[12px] leading-[1.7] text-ink-500">
          Walang operasyon tuwing {day}. Bubukas ulit kami sa{' '}
          <b className="text-ink-900">{nextOpenLabel(today)}</b>.
        </p>
        {today.getDay() === 5 && (
          <p className="mt-2 text-[10.5px] leading-[1.6] text-ink-400">
            Remittance day — the week's sales are turned in.
          </p>
        )}
        <p className="mt-6 text-[9px] uppercase tracking-[0.16em] text-ink-300">
          No operations today · Back on {nextOpenLabel(today)}
        </p>
      </div>
    </main>
  );
}
