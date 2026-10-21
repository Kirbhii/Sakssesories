import { useState } from 'react';
import SiteHeader from '@/components/SiteHeader';
import { PLAN, activeMembers, splitEven } from '@/lib/quota';

/**
 * The GM's one job that nobody else can do: set the numbers for the month.
 *
 * The GM types a quota per department and the team total. Per-member shares are
 * never typed — 250 ÷ 8 is 31.25, and half a keychain cannot be sold — so they
 * are derived with `splitEven`, which hands the remainder to the first few and
 * always adds back up to the department target.
 */
export default function QuotaSettings() {
  const [team, setTeam] = useState(PLAN.team);
  const [quotas, setQuotas] = useState<number[]>(() => PLAN.departments.map((d) => d.quota));

  const total = quotas.reduce((sum, q) => sum + q, 0);
  const balanced = total === team;
  const gap = total - team;

  function setDept(index: number, value: number) {
    setQuotas((prev) => prev.map((q, i) => (i === index ? value : q)));
  }

  return (
    <div className="min-h-screen bg-blush-50">
      <SiteHeader strip="Staff" />

      <main className="mx-auto max-w-[1100px] px-7 pb-9 pt-[26px] max-md:px-4">
        <h1 className="text-[clamp(26px,2.3vw,31px)]">Set the month.</h1>
        <p className="mt-1.5 max-w-[64ch] text-[11.5px] leading-[1.7] text-ink-500">
          Nobody may sell past their own number. When someone is full, the next sale is credited to
          whoever is furthest behind — so these figures decide who gets helped and who stops.
        </p>

        <section className="mt-[20px] overflow-hidden rounded-[7px] border border-blush-300 bg-white">
          <div className="flex flex-wrap items-end justify-between gap-5 border-b border-blush-300/60 px-4 py-4">
            <div>
              <p className="text-[8px] uppercase tracking-[0.17em] text-ink-300">Team total</p>
              <div className="mt-1.5 flex items-baseline gap-2.5">
                <input
                  type="number"
                  inputMode="numeric"
                  value={team}
                  onChange={(e) => setTeam(Number(e.target.value || 0))}
                  className="num w-[96px] rounded-[5px] border border-blush-300 px-2.5 py-1.5 text-[19px] font-medium outline-none focus:border-crimson-600"
                />
                <span className="text-[11px] text-ink-300">pieces this month</span>
              </div>
            </div>

            <div className="text-right">
              <p className="text-[8px] uppercase tracking-[0.17em] text-ink-300">
                Departments add up to
              </p>
              <p
                className={[
                  'num mt-1 text-[19px] font-medium leading-none',
                  balanced ? 'text-ok-600' : 'text-bad-600',
                ].join(' ')}
              >
                {total}
              </p>
            </div>
          </div>

          {PLAN.departments.map((d, i) => {
            const members = activeMembers.filter((m) => m.department === d.id);
            const split = splitEven(quotas[i], members.length);

            return (
              <div
                key={d.id}
                className="grid grid-cols-[1fr_110px_1.4fr] items-center gap-4 border-b border-blush-300/60 px-4 py-3.5 last:border-0 max-lg:grid-cols-1 max-lg:gap-2.5"
              >
                <div>
                  <p className="text-[11.5px] font-medium text-ink-900">{d.name}</p>
                  <p className="mt-0.5 text-[9px] text-ink-300">
                    {members.length} {members.length === 1 ? 'member' : 'members'}
                  </p>
                </div>

                <input
                  type="number"
                  inputMode="numeric"
                  value={quotas[i]}
                  onChange={(e) => setDept(i, Number(e.target.value || 0))}
                  className="num w-full rounded-[5px] border border-blush-300 px-2.5 py-[7px] text-[12px] outline-none focus:border-crimson-600"
                />

                <div>
                  <p className="text-[8px] uppercase tracking-[0.15em] text-ink-300">
                    Each one gets
                  </p>
                  <p className="num mt-1 text-[10px] leading-[1.6] text-ink-500">
                    {split.join(' · ') || '—'}
                  </p>
                </div>
              </div>
            );
          })}
        </section>

        {!balanced && (
          <p className="mt-3 rounded-[5px] bg-bad-100 px-3 py-2.5 text-[10px] leading-[1.6] text-bad-600">
            Off by {Math.abs(gap)} {Math.abs(gap) === 1 ? 'piece' : 'pieces'} — the departments
            {gap > 0 ? ' exceed ' : ' fall short of '}
            the team total. Fix it before saving, or the month will never close.
          </p>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            disabled
            className="rounded-pill bg-ink-300 px-5 py-2.5 text-[11px] font-medium text-white opacity-70"
          >
            Save the month
          </button>
          <span className="text-[9.5px] text-ink-300">
            Draft — saving needs the database. The numbers above are live but not stored.
          </span>
        </div>
      </main>
    </div>
  );
}
