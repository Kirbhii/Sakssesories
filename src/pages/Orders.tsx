import { useMemo, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { peso } from '@/lib/data';
import { memberOf } from '@/lib/quota';
import {
  STAGE_ACTION,
  STAGE_LABEL,
  payLabel,
  allSales,
  dateOf,
  setStage,
  stageTrack,
  useLedger,
  type Sale,
  type Stage,
} from '@/lib/sales';

/**
 * The orders the shop still owes somebody.
 *
 * Tracking is only worth having if the stage it reports is true, and nothing
 * else in the app moves an order along — this is that screen. It lists every
 * order that is not finished yet, and gives whoever is on duty one control to
 * push it to the next step.
 *
 * Everyone can open it, but the database decides who may write: the member who
 * sold the order, or anyone who handles money (`set_order_stage`). A seller who
 * could edit their own row freely could mark their own sale paid, which is the
 * hole we spent the week closing.
 *
 * An order is several rows in the ledger — one per piece — so everything here
 * is grouped by OR number and written back the same way.
 */

interface Order {
  orNo: string;
  rows: Sale[];
  customer: string;
  mobile: string;
  placedOn: string;
  location: string;
  pay: string;
  paid: boolean;
  stage: Stage;
  pieces: number;
  cents: number;
  items: string;
  staffId: string;
}

const CLOSED: Stage[] = ['claimed', 'delivered', 'cancelled'];

export default function Orders() {
  const version = useLedger();
  const { member } = useAuth();
  const [showClosed, setShowClosed] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [problem, setProblem] = useState('');

  const orders = useMemo(() => {
    void version;
    const byOr = new Map<string, Sale[]>();
    for (const s of allSales()) {
      if (s.status === 'void') continue;
      const list = byOr.get(s.orNo);
      if (list) list.push(s);
      else byOr.set(s.orNo, [s]);
    }

    const built: Order[] = [];
    for (const [orNo, rows] of byOr) {
      const first = rows[0];
      built.push({
        orNo,
        rows,
        customer: first.customer,
        mobile: first.mobile ?? '',
        placedOn: dateOf(first.ago),
        location: first.location,
        pay: first.pay,
        paid: first.status === 'paid',
        stage: first.stage,
        pieces: rows.reduce((n, r) => n + r.qty, 0),
        cents: rows.reduce((n, r) => n + r.cents, 0),
        items: rows.map((r) => `${r.variant} × ${r.qty}`).join(', '),
        staffId: first.staffId,
      });
    }

    // Newest first. The OR number is a counter, so the highest number is the
    // most recent order — no date parsing needed, and it cannot be thrown off
    // by a row recorded just after midnight.
    built.sort((a, b) => Number(b.orNo) - Number(a.orNo) || a.orNo.localeCompare(b.orNo));
    return built;
  }, [version]);

  const open = orders.filter((o) => !CLOSED.includes(o.stage));
  const shown = showClosed ? orders : open;

  async function move(orNo: string, stage: Stage) {
    setBusy(orNo);
    setProblem('');
    const ok = await setStage(orNo, stage);
    setBusy(null);
    if (!ok) {
      setProblem(
        'That did not save. Only the member who sold the order, or someone who handles money, can move it.',
      );
    }
  }

  return (
    <main className="mx-auto max-w-[1560px] px-7 pb-9 pt-[26px] max-md:px-4">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <p className="eyebrow">On the table</p>
          <h1 className="mt-1.5 text-[clamp(26px,2.3vw,31px)]">Orders to move.</h1>
          <p className="mt-1 max-w-[58ch] text-[11px] leading-[1.6] text-ink-500">
            Every order that is not finished yet. Whatever you set here is what the customer sees
            on the tracking page.
          </p>
        </div>
        <button
          onClick={() => setShowClosed((v) => !v)}
          className="rounded-pill border border-blush-300 bg-white px-3 py-1.5 text-[9.5px] text-ink-500 transition-colors hover:border-crimson-600 hover:text-crimson-600"
        >
          {showClosed ? `Showing all ${orders.length}` : `Showing open ${open.length}`}
        </button>
      </div>

      {problem && (
        <p className="mt-4 rounded-[6px] bg-bad-100 px-3.5 py-2.5 text-[10px] leading-[1.6] text-bad-600">
          {problem}
        </p>
      )}

      {shown.length === 0 && (
        <p className="mt-6 rounded-[9px] border border-blush-300 bg-white px-5 py-6 text-[11.5px] text-ink-300">
          Nothing waiting. Every order has been handed over.
        </p>
      )}

      <div className="mt-4 grid gap-2.5">
        {shown.map((o) => {
          const track = stageTrack(o.location);
          const at = Math.max(0, track.indexOf(o.stage));
          const closed = CLOSED.includes(o.stage);
          const next = track[at + 1] as Stage | undefined;
          const owner = memberOf(o.staffId);
          return (
            <div
              key={o.orNo}
              className={[
                'rounded-[9px] border bg-white px-4 py-3.5',
                closed ? 'border-blush-300/60 opacity-70' : 'border-blush-300',
              ].join(' ')}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="num text-[13px] font-medium text-ink-900">{o.orNo}</span>
                    <span className="rounded-pill bg-blush-100 px-2 py-[2px] text-[7.5px] uppercase tracking-[0.1em] text-ink-500">
                      {o.location}
                    </span>
                    <span
                      className={[
                        'rounded-pill px-2 py-[2px] text-[7.5px] uppercase tracking-[0.1em]',
                        o.paid ? 'bg-ok-100 text-ok-600' : 'bg-warn-100 text-warn-600',
                      ].join(' ')}
                    >
                      {payLabel(o.pay)} · {o.paid ? 'paid' : 'to check'}
                    </span>
                    <span className="text-[8.5px] uppercase tracking-[0.1em] text-ink-300">
                      {STAGE_LABEL[o.stage]}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-ink-900">{o.customer}</p>
                  <p className="num mt-0.5 text-[9.5px] text-ink-300">
                    {o.mobile || 'no mobile'} · {o.placedOn}
                    {owner ? ` · sold by ${owner.name}` : ''}
                  </p>
                  <p className="mt-1 text-[10px] text-ink-500">{o.items}</p>
                </div>

                <div className="flex flex-none flex-col items-end gap-1.5">
                  <span className="num text-[14px] font-medium text-ink-900">{peso(o.cents)}</span>
                  <span className="text-[9px] text-ink-300">
                    {o.pieces} {o.pieces === 1 ? 'piece' : 'pieces'}
                  </span>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-blush-300/60 pt-2.5">
                {next && (
                  <button
                    onClick={() => move(o.orNo, next)}
                    disabled={busy === o.orNo}
                    className="rounded-pill bg-crimson-600 px-3 py-1.5 text-[9.5px] font-medium text-white transition-colors hover:bg-wine-800 disabled:opacity-50"
                  >
                    {busy === o.orNo ? 'Saving…' : STAGE_ACTION[next]}
                  </button>
                )}
                <select
                  value={o.stage}
                  onChange={(e) => move(o.orNo, e.target.value as Stage)}
                  disabled={busy === o.orNo}
                  aria-label={`Stage for order ${o.orNo}`}
                  className="rounded-pill border border-blush-300 bg-white px-2.5 py-1.5 text-[9.5px] text-ink-500 outline-none focus:border-crimson-600"
                >
                  {[...track, 'cancelled' as Stage].map((s) => (
                    <option key={s} value={s}>
                      {STAGE_LABEL[s]}
                    </option>
                  ))}
                </select>
                {member && owner && member.id !== owner.id && (
                  <span className="text-[8.5px] text-ink-300">Someone else's order</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </main>
  );
}
