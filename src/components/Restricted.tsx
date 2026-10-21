import { Link } from 'react-router-dom';
import SiteHeader from '@/components/SiteHeader';
import { HOME_FOR, ROLE_LABEL, useAuth } from '@/lib/auth';

interface RestrictedProps {
  /** One line explaining who this screen belongs to. */
  need: string;
}

/**
 * Shown instead of a silent redirect. Being bounced to the homepage feels like
 * a broken link; being told plainly which door is yours does not.
 */
export default function Restricted({ need }: RestrictedProps) {
  const { member, role } = useAuth();

  return (
    <div className="min-h-screen bg-blush-50">
      <SiteHeader strip="Staff" />

      <main className="mx-auto max-w-[680px] px-7 py-16 max-md:px-5">
        <span className="eyebrow">Restricted</span>
        <h1 className="mt-2.5 text-[clamp(24px,2.2vw,30px)]">This screen is not yours.</h1>
        <p className="mt-2 max-w-[52ch] text-[11.5px] leading-[1.75] text-ink-500">
          You are signed in as <b className="font-medium text-ink-900">{member?.name}</b>
          {role ? ` — ${ROLE_LABEL[role]}` : ''}. {need}
        </p>
        <Link
          to={role ? HOME_FOR[role] : '/'}
          className="mt-5 inline-block rounded-pill bg-crimson-600 px-[18px] py-2.5 text-[11px] font-medium text-white transition-colors hover:bg-wine-800"
        >
          Back to your page
        </Link>
      </main>
    </div>
  );
}
