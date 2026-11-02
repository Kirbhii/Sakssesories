import { MEMBERS, PLAN, quotaLabel, roomOf } from '@/lib/quota';
import { ROLE_LABEL } from '@/lib/auth';

const DEPT_NAME = Object.fromEntries(PLAN.departments.map((d) => [d.id, d.name]));

export default function Users() {
  return (
    <main className="mx-auto max-w-[1100px] px-7 pb-9 pt-[26px] max-md:px-4">
        <div className="flex items-start justify-between gap-6 max-md:flex-col max-md:gap-3.5">
          <div>
            <h1 className="text-[clamp(26px,2.3vw,31px)]">Who is on the team.</h1>
            <p className="mt-1.5 max-w-[64ch] text-[11.5px] leading-[1.7] text-ink-500">
              Every account, its role, and the quota that comes with it. People leave — their
              records do not, so accounts are deactivated, never deleted.
            </p>
          </div>
        </div>

        <section className="mt-[20px] overflow-hidden rounded-[7px] border border-blush-300 bg-white">
          <div className="flex items-baseline justify-between gap-3 border-b border-blush-300/60 px-4 py-3.5">
            <h2 className="text-[15px]">Accounts</h2>
            <span className="num text-[9px] uppercase tracking-[0.12em] text-ink-300">
              {MEMBERS.length} total
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-blush-50">
                  {['Name', 'Role', 'Department', 'Quota', 'Sold', 'Status'].map((h, i) => (
                    <th
                      key={h}
                      className={[
                        'border-b border-blush-300/60 px-4 py-[9px] text-left text-[7.5px] font-medium uppercase tracking-[0.16em] text-ink-300',
                        i === 3 || i === 4 ? 'text-right' : '',
                      ].join(' ')}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {MEMBERS.map((m) => (
                  <tr key={m.id} className="border-b border-blush-300/60 last:border-0">
                    <td className="px-4 py-[9px] text-[10.5px]">{m.name}</td>
                    <td className="px-4 py-[9px] text-[10.5px] text-ink-500">
                      {ROLE_LABEL[m.role]}
                    </td>
                    <td className="px-4 py-[9px] text-[10.5px] text-ink-500">
                      {DEPT_NAME[m.department] ?? m.department}
                    </td>
                    <td className="num px-4 py-[9px] text-right text-[10.5px]">
                      {quotaLabel(m.id)}
                    </td>
                    <td className="num px-4 py-[9px] text-right text-[10.5px]">{m.credited}</td>
                    <td className="px-4 py-[9px] text-[10.5px]">
                      {roomOf(m.id) === 0 ? (
                        <span className="text-ok-600">Full</span>
                      ) : m.active ? (
                        <span className="text-ink-300">Active</span>
                      ) : (
                        <span className="text-ink-300">Inactive</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <p className="mt-4 max-w-[74ch] text-[9.5px] leading-[1.8] text-ink-300">
          This list is the staff table in the database — there is no second list to keep
          in step. <b className="font-medium text-ink-500">To add someone:</b> create their
          login in Supabase under Authentication → Users and tick “Auto Confirm User”. If
          their address ends in <span className="text-ink-500">@marketing.com</span>,{' '}
          <span className="text-ink-500">@production.com</span>,{' '}
          <span className="text-ink-500">@finance.com</span> or{' '}
          <span className="text-ink-500">@gm.com</span> they appear here on their own. For
          any other address, add their row with{' '}
          <span className="text-ink-500">supabase/roster.sql</span>.
        </p>
    </main>
  );
}
