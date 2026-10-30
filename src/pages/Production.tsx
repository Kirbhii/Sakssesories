import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { SHAPES, VARIANTS } from '@/lib/data';
import {
  addProduction,
  allProduction,
  allSold,
  refreshSold,
  todayIso,
  useProduction,
  type ProductionEntry,
} from '@/lib/production';

// ─── Production sheet ───────────────────────────────────────────────────────
// The manual log that replaced the inventory screen, laid out like the sheet the
// shop already keeps by hand:
//
//   Beg. Inventory + Produced − Sold − Rejects = Ending Inventory
//
// Production types how many pieces of each variant they finished on a day and
// how many they threw away. "Sold" is never typed — it is read from the sales
// ledger as a count, so nobody here sees a customer name or a peso amount.
//
// Pick a day and the whole page follows it: the sheet shows that day, the form
// adds to that day, and the history lists every day with its ending stock.

const uid = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `p-${Date.now()}-${Math.random().toString(36).slice(2)}`;

/** 'YYYY-MM-DD' → "Mon, Oct 26, 2026". Parsed at local midnight, no drift. */
function dateLabel(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString('en-PH', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

interface Cell {
  beg: number;
  produced: number;
  sold: number;
  rejected: number;
  ending: number;
}

const ZERO = (): Cell => ({ beg: 0, produced: 0, sold: 0, rejected: 0, ending: 0 });

export default function Production() {
  const { member } = useAuth();
  const version = useProduction();
  const entries = allProduction();
  const soldRows = allSold();

  const [date, setDate] = useState(todayIso());
  const [qty, setQty] = useState<Record<string, string>>({});
  const [rej, setRej] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Pull the sold counts once the screen opens — they are an aggregate query,
  // not part of the log, so nothing else refreshes them.
  useEffect(() => {
    refreshSold();
  }, []);

  const digits = (value: string): string => value.replace(/[^0-9]/g, '');
  const setMade = (key: string, value: string): void =>
    setQty((prev) => ({ ...prev, [key]: digits(value) }));
  const setRejected = (key: string, value: string): void =>
    setRej((prev) => ({ ...prev, [key]: digits(value) }));

  async function save(): Promise<void> {
    setMsg(null);
    const rows: ProductionEntry[] = [];
    for (const v of VARIANTS) {
      const made = Math.floor(Number(qty[v.key] || 0));
      const bad = Math.floor(Number(rej[v.key] || 0));
      if (made <= 0 && bad <= 0) continue;
      rows.push({
        id: uid(),
        producedOn: date,
        variantKey: v.key,
        qty: made,
        rejected: bad,
        createdBy: member?.id ?? null,
        createdAt: new Date().toISOString(),
      });
    }
    if (!rows.length) {
      setMsg({ ok: false, text: 'Enter at least one quantity before saving.' });
      return;
    }

    setSaving(true);
    const ok = await addProduction(rows);
    setSaving(false);

    if (ok) {
      setQty({});
      setRej({});
      const made = rows.reduce((n, r) => n + r.qty, 0);
      const bad = rows.reduce((n, r) => n + r.rejected, 0);
      const bits = [`${made} produced`];
      if (bad) bits.push(`${bad} rejected`);
      setMsg({
        ok: true,
        text: `Logged ${bits.join(' · ')} across ${rows.length} ${
          rows.length === 1 ? 'variant' : 'variants'
        }.`,
      });
    } else {
      setMsg({ ok: false, text: 'Could not save — check your connection and try again.' });
    }
  }

  // The sheet for the chosen day. Anything logged before it rolls into Beg.;
  // anything sold before it comes back out of Beg. again.
  const sheet = useMemo(() => {
    const cells = new Map<string, Cell>();
    for (const v of VARIANTS) cells.set(v.key, ZERO());

    for (const e of entries) {
      const c = cells.get(e.variantKey);
      if (!c) continue;
      if (e.producedOn < date) c.beg += e.qty - e.rejected;
      else if (e.producedOn === date) {
        c.produced += e.qty;
        c.rejected += e.rejected;
      }
    }
    for (const s of soldRows) {
      const c = cells.get(s.variantKey);
      if (!c) continue;
      if (s.soldOn < date) c.beg -= s.qty;
      else if (s.soldOn === date) c.sold += s.qty;
    }
    for (const c of cells.values()) c.ending = c.beg + c.produced - c.sold - c.rejected;
    return cells;
  }, [entries, soldRows, date, version]);

  const total = useMemo(() => {
    const t = ZERO();
    for (const c of sheet.values()) {
      t.beg += c.beg;
      t.produced += c.produced;
      t.sold += c.sold;
      t.rejected += c.rejected;
      t.ending += c.ending;
    }
    return t;
  }, [sheet]);

  // Every day with a number on it, newest first, with the ending stock rolled
  // forward from the first day the log covers.
  const history = useMemo(() => {
    const map = new Map<string, Cell & { iso: string }>();
    const get = (iso: string) => {
      let d = map.get(iso);
      if (!d) {
        d = { iso, ...ZERO() };
        map.set(iso, d);
      }
      return d;
    };

    for (const e of entries) {
      const d = get(e.producedOn);
      d.produced += e.qty;
      d.rejected += e.rejected;
    }
    for (const s of soldRows) get(s.soldOn).sold += s.qty;

    const today = todayIso();
    const days = [...map.values()]
      .filter((d) => d.iso <= today)
      .sort((a, b) => (a.iso < b.iso ? -1 : 1));

    let running = 0;
    for (const d of days) {
      running += d.produced - d.sold - d.rejected;
      d.ending = running;
    }
    return days.reverse();
  }, [entries, soldRows, version]);

  const isToday = date === todayIso();

  const cellClass = (n: number, negative = false): string =>
    [
      'num px-3 py-[7px] text-right text-[10.5px] tabular-nums',
      negative && n < 0
        ? 'font-medium text-bad-600'
        : n
          ? 'font-medium text-ink-900'
          : 'text-ink-300',
    ].join(' ');

  return (
    <>
      <header className="flex h-[52px] items-center justify-between gap-5 border-b border-blush-300 bg-white px-7 max-md:px-4">
        <span className="text-[8.5px] uppercase tracking-[0.19em] text-ink-300">
          <b className="font-medium text-ink-900">Production</b> / Sheet
        </span>
        <span className="rounded-pill border border-blush-300 px-3 py-1 text-[9.5px] text-ink-500">
          Saksesories PH · Main
        </span>
      </header>

      <div className="px-7 pb-9 pt-[26px] max-md:px-4">
        <div className="flex items-start justify-between gap-6 max-md:flex-col max-md:gap-3.5">
          <div>
            <h1 className="text-[clamp(26px,2.3vw,31px)]">What the shop made.</h1>
            <p className="mt-1.5 max-w-[64ch] text-[11.5px] text-ink-500">
              Log the pieces finished each day and the ones thrown away. The shop
              counts what was sold on its own, so the sheet always ends where the
              stock really is.
            </p>
          </div>

          <div className="flex flex-none items-center gap-2">
            {!isToday && (
              <button
                onClick={() => setDate(todayIso())}
                className="rounded-pill border border-blush-300 px-3 py-[5px] text-[9.5px] text-ink-500 transition-colors hover:border-crimson-600 hover:text-ink-900"
              >
                Today
              </button>
            )}
            <label className="flex items-center gap-2 rounded-pill border border-blush-300 bg-white px-3 py-[5px]">
              <span className="text-[7.5px] uppercase tracking-[0.14em] text-ink-300">Date</span>
              <input
                type="date"
                value={date}
                max={todayIso()}
                onChange={(e) => setDate(e.target.value || todayIso())}
                className="bg-transparent text-[10.5px] text-ink-900 outline-none"
              />
            </label>
          </div>
        </div>

        <div className="mt-[18px] grid grid-cols-[minmax(0,1fr)_340px] items-start gap-[18px] max-xl:grid-cols-1">
          {/* ── The sheet ─────────────────────────────────────────────────── */}
          <section className="overflow-hidden rounded-[7px] border border-blush-300 bg-white">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-blush-300/60 px-4 py-3.5">
              <h2 className="text-[15px]">{isToday ? "Today's sheet" : 'Sheet'}</h2>
              <span className="text-[9.5px] text-ink-300">{dateLabel(date)}</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-blush-50">
                    <th className="border-b border-blush-300/60 px-3 py-[8px] text-left text-[7.5px] font-medium uppercase tracking-[0.14em] text-ink-300">
                      Variant
                    </th>
                    {['Beg.', 'Produced', 'Sold', 'Rejects', 'Ending'].map((h) => (
                      <th
                        key={h}
                        className="border-b border-blush-300/60 px-3 py-[8px] text-right text-[7.5px] font-medium uppercase tracking-[0.14em] text-ink-300"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {VARIANTS.map((v) => {
                    const c = sheet.get(v.key) ?? ZERO();
                    return (
                      <tr key={v.key} className="border-b border-blush-300/60 last:border-0">
                        <td className="px-3 py-[7px]">
                          <div className="flex items-center gap-2">
                            <span
                              className="h-[10px] w-[10px] flex-none rounded-[2px] border border-black/10"
                              style={{ background: v.hex }}
                            />
                            <span className="whitespace-nowrap text-[10px] text-ink-900">
                              {v.shapeName} · {v.colour}
                            </span>
                          </div>
                        </td>
                        <td className={cellClass(c.beg, true)}>{c.beg || '—'}</td>
                        <td className={cellClass(c.produced)}>{c.produced || '—'}</td>
                        <td className={cellClass(c.sold)}>{c.sold || '—'}</td>
                        <td className={cellClass(c.rejected)}>{c.rejected || '—'}</td>
                        <td className={cellClass(c.ending, true)}>{c.ending || '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-blush-50">
                    <td className="px-3 py-2 text-[8px] uppercase tracking-[0.14em] text-ink-300">
                      Total
                    </td>
                    {[total.beg, total.produced, total.sold, total.rejected, total.ending].map(
                      (n, i) => (
                        <td
                          key={i}
                          className={[
                            'num px-3 py-2 text-right text-[10.5px] font-medium tabular-nums',
                            n < 0 ? 'text-bad-600' : 'text-ink-900',
                          ].join(' ')}
                        >
                          {n}
                        </td>
                      ),
                    )}
                  </tr>
                </tfoot>
              </table>
            </div>

            <p className="border-t border-blush-300/60 px-4 py-2.5 text-[9.5px] leading-[1.7] text-ink-300">
              <b className="font-medium text-ink-500">Beg.</b> carries the ending stock
              from the day before. <b className="font-medium text-ink-500">Sold</b> comes
              from the sales ledger — nobody types it here.
            </p>
          </section>

          {/* ── Log form ──────────────────────────────────────────────────── */}
          <section className="rounded-[7px] border border-blush-300 bg-white max-xl:order-first">
            <div className="border-b border-blush-300/60 px-4 py-3.5">
              <h2 className="text-[15px]">Log production</h2>
              <p className="mt-0.5 text-[9.5px] text-ink-300">Adds to {dateLabel(date)}.</p>
            </div>

            <div className="px-4 pb-4 pt-3">
              {SHAPES.map((shape) => (
                <div key={shape.id} className="mb-3.5 last:mb-0">
                  <div className="mb-1.5 flex items-center gap-2 px-0.5">
                    <p className="flex-1 text-[8px] uppercase tracking-[0.16em] text-ink-300">
                      {shape.name}
                    </p>
                    <span className="w-11 text-right text-[7px] uppercase tracking-[0.12em] text-ink-300">
                      Made
                    </span>
                    <span className="w-11 text-right text-[7px] uppercase tracking-[0.12em] text-ink-300">
                      Rej.
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    {VARIANTS.filter((v) => v.shape === shape.id).map((v) => (
                      <div
                        key={v.key}
                        className="flex items-center gap-2 rounded-[5px] border border-blush-300 px-2 py-[5px]"
                      >
                        <span
                          className="h-[12px] w-[12px] flex-none rounded-[3px] border border-black/10"
                          style={{ background: v.hex }}
                        />
                        <span className="min-w-0 flex-1 truncate text-[10.5px] text-ink-900">
                          {v.colour}
                        </span>
                        <input
                          type="number"
                          inputMode="numeric"
                          min={0}
                          aria-label={`${shape.name} ${v.colour} produced`}
                          value={qty[v.key] ?? ''}
                          placeholder="0"
                          onChange={(e) => setMade(v.key, e.target.value)}
                          className="w-11 rounded-[4px] border border-blush-300 px-1.5 py-[3px] text-right text-[10.5px] outline-none focus:border-crimson-600"
                        />
                        <input
                          type="number"
                          inputMode="numeric"
                          min={0}
                          aria-label={`${shape.name} ${v.colour} rejected`}
                          value={rej[v.key] ?? ''}
                          placeholder="0"
                          onChange={(e) => setRejected(v.key, e.target.value)}
                          className="w-11 rounded-[4px] border border-blush-300 px-1.5 py-[3px] text-right text-[10.5px] text-ink-500 outline-none focus:border-crimson-600"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              <div className="mt-3">
                <button
                  onClick={save}
                  disabled={saving}
                  className="w-full rounded-pill bg-crimson-600 px-[18px] py-2.5 text-[11px] font-medium text-white transition-colors hover:bg-wine-800 disabled:opacity-60"
                >
                  {saving ? 'Saving…' : 'Log production'}
                </button>
                {msg && (
                  <p
                    className={[
                      'mt-2 text-center text-[10px] leading-[1.6]',
                      msg.ok ? 'text-ok-600' : 'text-bad-600',
                    ].join(' ')}
                  >
                    {msg.text}
                  </p>
                )}
              </div>
            </div>
          </section>
        </div>

        {/* ── History ────────────────────────────────────────────────────── */}
        <section className="mt-[18px] overflow-hidden rounded-[7px] border border-blush-300 bg-white">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-blush-300/60 px-4 py-3.5">
            <h2 className="text-[15px]">History</h2>
            <span className="text-[9.5px] text-ink-300">Pick a day to open its sheet</span>
          </div>

          {history.length === 0 ? (
            <p className="px-4 py-8 text-center text-[10.5px] leading-[1.7] text-ink-300">
              Nothing logged yet. Type the pieces you finished on the right and save —
              every day shows up here with its ending stock.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-blush-50">
                    <th className="border-b border-blush-300/60 px-4 py-[8px] text-left text-[7.5px] font-medium uppercase tracking-[0.14em] text-ink-300">
                      Day
                    </th>
                    {['Produced', 'Sold', 'Rejects', 'Ending'].map((h) => (
                      <th
                        key={h}
                        className="border-b border-blush-300/60 px-4 py-[8px] text-right text-[7.5px] font-medium uppercase tracking-[0.14em] text-ink-300"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {history.map((d) => (
                    <tr
                      key={d.iso}
                      onClick={() => setDate(d.iso)}
                      className={[
                        'cursor-pointer border-b border-blush-300/60 transition-colors last:border-0 hover:bg-blush-50',
                        d.iso === date ? 'bg-blush-50' : '',
                      ].join(' ')}
                    >
                      <td className="px-4 py-[9px] text-[10.5px] text-ink-900">
                        {d.iso === todayIso() ? (
                          <>
                            Today
                            <span className="ml-2 text-[9px] text-ink-300">{dateLabel(d.iso)}</span>
                          </>
                        ) : (
                          dateLabel(d.iso)
                        )}
                      </td>
                      <td className={cellClass(d.produced)}>{d.produced || '—'}</td>
                      <td className={cellClass(d.sold)}>{d.sold || '—'}</td>
                      <td className={cellClass(d.rejected)}>{d.rejected || '—'}</td>
                      <td className={cellClass(d.ending, true)}>{d.ending || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
