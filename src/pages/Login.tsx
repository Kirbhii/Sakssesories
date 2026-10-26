import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { MEMBERS, quotaOf } from '@/lib/quota';
import { HOME_FOR, ROLE_LABEL, emailOf, useAuth } from '@/lib/auth';

/** One account per role, so the whole permission story can be walked through. */
const DEMO_IDS = ['ana', 'carlo', 'maria', 'gabriel'];

export default function Login() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  function enter(id: string) {
    const member = MEMBERS.find((m) => m.id === id);
    if (!member) return;
    signIn(member.id);
    navigate(HOME_FOR[member.role], { replace: true });
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    const wanted = email.trim().toLowerCase();
    const found = MEMBERS.find((m) => emailOf(m.name) === wanted);

    if (!found) {
      setError('No account uses that email.');
      return;
    }
    if (!password) {
      setError('Enter a password.');
      return;
    }
    setError('');
    enter(found.id);
  }

  return (
    <div className="grid min-h-screen place-items-center bg-blush-50 px-5 py-10">
      <div className="w-full max-w-[430px]">
        <div className="text-center">
          <img
            src="/img/logo-mark.png"
            alt=""
            width={220}
            height={203}
            className="mx-auto mb-3.5 h-16 w-auto"
          />
          <p className="font-serif text-[26px] leading-none tracking-[-0.01em] text-ink-900">
            Saksesories PH
          </p>
          <p className="mt-1.5 text-[7.5px] uppercase tracking-[0.2em] text-ink-300">
            Sakses anytime, Style anytime
          </p>
        </div>

        <form
          onSubmit={submit}
          className="mt-7 rounded-[10px] border border-blush-300 bg-white px-6 py-6"
        >
          <h1 className="text-[19px]">Staff sign in</h1>
          <p className="mt-1 text-[11px] text-ink-500">Use the email on your staff account.</p>

          <label className="mt-4 block">
            <span className="mb-1 block text-[8px] uppercase tracking-[0.15em] text-ink-300">
              Email
            </span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@saksesories.ph"
              className="w-full rounded-[5px] border border-blush-300 px-2.5 py-2 text-[11.5px] outline-none focus:border-crimson-600"
            />
          </label>

          <label className="mt-3 block">
            <span className="mb-1 block text-[8px] uppercase tracking-[0.15em] text-ink-300">
              Password
            </span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••"
              className="w-full rounded-[5px] border border-blush-300 px-2.5 py-2 text-[11.5px] outline-none focus:border-crimson-600"
            />
          </label>

          {error && (
            <p className="mt-2.5 rounded-[5px] bg-bad-100 px-2.5 py-2 text-[10px] text-bad-600">
              {error}
            </p>
          )}

          <button
            type="submit"
            className="mt-4 w-full rounded-pill bg-crimson-600 py-3 text-[11.5px] font-medium text-white transition-colors hover:bg-wine-800"
          >
            Sign in
          </button>

          <p className="mt-2.5 text-center text-[9px] leading-[1.6] text-ink-300">
            Demo build — any password is accepted, and no email is sent.
          </p>
        </form>

        <div className="mt-6">
          <p className="text-center text-[8px] uppercase tracking-[0.17em] text-ink-300">
            One account per role
          </p>
          <div className="mt-2.5 grid grid-cols-2 gap-2">
            {DEMO_IDS.map((id) => {
              const m = MEMBERS.find((x) => x.id === id);
              if (!m) return null;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => enter(id)}
                  className="rounded-[6px] border border-blush-300 bg-white px-3 py-2.5 text-left transition-colors hover:border-wine-800"
                >
                  <span className="block text-[10.5px] font-medium text-ink-900">{m.name}</span>
                  <span className="mt-0.5 block text-[8px] uppercase tracking-[0.12em] text-ink-300">
                    {ROLE_LABEL[m.role]} · {quotaOf(m.id)} pcs
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
