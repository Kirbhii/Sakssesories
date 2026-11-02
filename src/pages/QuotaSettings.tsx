import { Fragment, useEffect, useMemo, useState } from 'react';
import {
  activeMembers,
  currentMonth,
  monthKeyOf,
  monthLabel,
  weeksOf,
  type DepartmentId,
} from '@/lib/quota';
import { piecesOf, saveMonth, useQuotaEntries, type QuotaEntry } from '@/lib/quotas';

/**
 * The month's numbers, one person at a time.
 *
 * Marketing owns this page — the target is the number they work to every day —
 * and the GM keeps it alongside them, because the GM signs off on the month.
 *
 * ── Nothing is divided ──────────────────────────────────────────────────────
 * Every box is typed. Two people in the same department can carry very
 * different targets, because that is how the shop really runs. There is no
 * department total to split, so there is nothing here that can be "off by one".
 *
 * ── Two numbers per person ──────────────────────────────────────────────────
 * The week boxes are what the team works to day by day; the month box is what
 * the month is judged on. They are separate promises and are not forced to
 * agree — a week can be missed while the month still lands.
 *
 * ── Every month is its own sheet ────────────────────────────────────────────
 * The arrows move between months. December starts blank, and filling it in
 * leaves November exactly as it was.
 *
 * ── A blank box is not a zero ───────────────────────────────────────────────
 * Nothing set means no cap, so the shop never stops selling because somebody
 * forgot to fill a number in. `quota.ts` is where that rule lives.
 */

const DEPARTMENTS: { id: DepartmentId; name: string }[] = [
  { id: 'marketing', name: 'Marketing' },
  { id: 'production', name: 'Production' },
  { id: 'finance', name: 'Finance + GM' },
];

/** '2026-11' ± n months. */
function shiftMonth(month: string, delta: number): string {
  const year = Number(month.slice(0, 4));
  const m = Number(month.slice(5, 7)) - 1 + delta;
  return monthKeyOf(new Date(year, m, 1));
}

const key = (memberId: string, week: number): string => `${memberId}:${week}`;

export default function QuotaSettings() {
  const [month, setMonth] = useState(currentMonth());
  const [draft, setDraft] = useState<Record<string, number>>({});
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState<{ ok: boolean; text: string } | null>(null);

  // Re-renders whenever a number is loaded or saved.
  const entries = useQuotaEntries();

  const weeks = useMemo(() => weeksOf(month), [month]);

  // Start each month from what is really stored.
  useEffect(() => {
    const next: Record<string, number> = {};
    for (const m of activeMembers) {
      for (let w = 0; w <= 5; w += 1) next[key(m.id, w)] = piecesOf(month, m.id, w);
    }
    setDraft(next);
    setDirty(false);
    setFlash(null);
  }, [month, entries]);

  function set(memberId: string, week: number, raw: string) {
    const n = raw === '' ? 0 : Math.max(0, Math.min(100000, Math.floor(Number(raw) || 0)));
    setDraft((prev) => ({ ...prev, [key(memberId, week)]: n }));
    setDirty(true);
    setFlash(null);
  }

  const value = (memberId: string, week: number): string => {
    const v = draft[key(memberId, week)];
    return v === undefined || v === 0 ? '' : String(v);
  };

  async function save() {
    setSaving(true);

    const next: QuotaEntry[] = [];
    for (const m of activeMembers) {
      // Week 0 is the month. Only the weeks this month actually has.
      for (let w = 0; w <= weeks.length; w += 1) {
        next.push({ memberId: m.id, month, week: w, pieces: draft[key(m.id, w)] ?? 0 });
      }
    }

    const problem = await saveMonth(month, next);
    setSaving(false);
    setFlash(
      problem
        ? { ok: false, text: problem }
        : { ok: true, text: `${monthLabel(month)} saved.` },
    );
    if (!problem) setDirty(false);
  }

  const monthTotal = activeMembers.reduce((sum, m) => sum + (draft[key(m.id, 0)] ?? 0), 0);
  const weekTotals = weeks.map((w) =>
    activeMembers.reduce((sum, m) => sum + (draft[key(m.id, w.n)] ?? 0), 0),
  );

  const thisMonth = currentMonth();

  return (
    <main className="mx-auto max-w-[1180px] px-7 pb-9 pt-[26px] max-md:px-4">
      <h1 className="text-[clamp(26px,2.3vw,31px)]">Set the month.</h1>
      <p className="mt-1.5 max-w-[68ch] text-[11.5px] leading-[1.7] text-ink-500">
        Every box is typed by hand — nothing is divided between people. The week boxes are what the
        team works to day by day; the month box is what the month is judged on. A blank box means
        no limit, so the shop never stops selling because a number was not filled in yet.
      </p>

      {/* ── Which month ──────────────────────────────────────────────────── */}
      <div className="mt-[18px] flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMonth((m) => shiftMonth(m, -1))}
            aria-label="Previous month"
            className="grid h-8 w-8 place-items-center rounded-[5px] border border-blush-300 bg-white text-[13px] text-ink-700 transition-colors hover:border-crimson-600 hover:text-crimson-600"
          >
            ‹
          </button>

          <span className="min-w-[132px] text-center text-[13px] font-medium text-ink-900">
            {monthLabel(month)} {month.slice(0, 4)}
          </span>

          <button
            type="button"
            onClick={() => setMonth((m) => shiftMonth(m, 1))}
            aria-label="Next month"
            className="grid h-8 w-8 place-items-center rounded-[5px] border border-blush-300 bg-white text-[13px] text-ink-700 transition-colors hover:border-crimson-600 hover:text-crimson-600"
          >
            ›
          </button>

          {month !== thisMonth && (
            <button
              type="button"
              onClick={() => setMonth(thisMonth)}
              className="ml-1 rounded-[5px] border border-blush-300 bg-white px-2.5 py-1 text-[10px] text-ink-500 transition-colors hover:border-crimson-600 hover:text-crimson-600"
            >
              This month
            </button>
          )}
        </div>

        <div className="flex items-center gap-3">
          <span className="num text-[11px] text-ink-500">
            Month total <b className="text-ink-900">{monthTotal}</b> pcs
          </span>
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving || !dirty}
            className={[
              'rounded-pill px-5 py-2 text-[11px] font-medium text-white transition-colors',
              saving || !dirty
                ? 'cursor-default bg-ink-300 opacity-70'
                : 'bg-crimson-600 hover:bg-wine-800',
            ].join(' ')}
          >
            {saving ? 'Saving…' : dirty ? 'Save the month' : 'No changes'}
          </button>
        </div>
      </div>

      {flash && (
        <p
          className={[
            'mt-3 rounded-[5px] px-3 py-2.5 text-[10px] leading-[1.6]',
            flash.ok ? 'bg-ok-100 text-ok-600' : 'bg-bad-100 text-bad-600',
          ].join(' ')}
        >
          {flash.text}
        </p>
      )}

      {/* ── The sheet ────────────────────────────────────────────────────── */}
      <section className="mt-[16px] overflow-x-auto rounded-[7px] border border-blush-300 bg-white">
        <table className="w-full min-w-[780px] border-collapse text-left">
          <thead>
            <tr className="border-b border-blush-300/60 bg-blush-50">
              <th className="px-4 py-2.5 text-[8px] font-medium uppercase tracking-[0.17em] text-ink-300">
                Person
              </th>
              {weeks.map((w) => (
                <th
                  key={w.n}
                  className="w-[96px] px-2 py-2.5 text-center text-[8px] font-medium uppercase tracking-[0.14em] text-ink-300"
                >
                  Week {w.n}
                  <span className="mt-0.5 block text-[8px] font-normal normal-case tracking-normal text-ink-300/80">
                    {w.label}
                  </span>
                </th>
              ))}
              <th className="w-[96px] border-l border-blush-300/60 px-3 py-2.5 text-center text-[8px] font-medium uppercase tracking-[0.14em] text-crimson-600">
                Month
              </th>
            </tr>
          </thead>

          <tbody>
            {DEPARTMENTS.map((dept) => {
              const people = activeMembers.filter((m) => m.department === dept.id);
              if (!people.length) return null;

              return (
                <Fragment key={dept.id}>
                  <tr className="border-b border-blush-300/60 bg-blush-50/60">
                    <td
                      colSpan={weeks.length + 2}
                      className="px-4 py-1.5 text-[9px] font-medium uppercase tracking-[0.15em] text-ink-500"
                    >
                      {dept.name}
                    </td>
                  </tr>

                  {people.map((m) => (
                    <tr key={m.id} className="border-b border-blush-300/40 last:border-0">
                      <td className="px-4 py-1.5">
                        <span className="text-[11.5px] text-ink-900">{m.name}</span>
                        {m.role === 'gm' && (
                          <span className="ml-1.5 text-[9px] text-ink-300">GM</span>
                        )}
                      </td>

                      {weeks.map((w) => (
                        <td key={w.n} className="px-2 py-1.5 text-center">
                          <input
                            type="number"
                            inputMode="numeric"
                            min={0}
                            value={value(m.id, w.n)}
                            onChange={(e) => set(m.id, w.n, e.target.value)}
                            aria-label={`${m.name}, week ${w.n}`}
                            placeholder="—"
                            className="num w-[52px] rounded-[5px] border border-blush-300 px-1.5 py-1 text-center text-[11.5px] outline-none transition-colors focus:border-crimson-600"
                          />
                        </td>
                      ))}

                      <td className="border-l border-blush-300/60 px-3 py-1.5 text-center">
                        <input
                          type="number"
                          inputMode="numeric"
                          min={0}
                          value={value(m.id, 0)}
                          onChange={(e) => set(m.id, 0, e.target.value)}
                          aria-label={`${m.name}, whole month`}
                          placeholder="—"
                          className="num w-[58px] rounded-[5px] border border-blush-300 bg-blush-50 px-1.5 py-1 text-center text-[11.5px] font-medium outline-none transition-colors focus:border-crimson-600"
                        />
                      </td>
                    </tr>
                  ))}
                </Fragment>
              );
            })}
          </tbody>

          <tfoot>
            <tr className="border-t border-blush-300 bg-blush-50">
              <td className="px-4 py-2 text-[9px] font-medium uppercase tracking-[0.15em] text-ink-300">
                Total
              </td>
              {weekTotals.map((t, i) => (
                <td key={i} className="num px-2 py-2 text-center text-[11px] text-ink-700">
                  {t || '—'}
                </td>
              ))}
              <td className="num border-l border-blush-300/60 px-3 py-2 text-center text-[11.5px] font-medium text-ink-900">
                {monthTotal || '—'}
              </td>
            </tr>
          </tfoot>
        </table>
      </section>

      <p className="mt-3 max-w-[70ch] text-[9.5px] leading-[1.7] text-ink-300">
        A week here runs from the 1st in blocks of seven days — 1–7, 8–14, 15–21, 22–28, then 29 to
        the end. That is not the same as the Saturday-to-Friday remittance week on the Summary
        screen, and it is deliberate: a target is set as “week 1”, and partial weeks at the edges of
        a month would make two months impossible to compare.
      </p>
    </main>
  );
}
