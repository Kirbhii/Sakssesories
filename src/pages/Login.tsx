import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { isSupabaseConfigured } from '@/lib/supabase';

export default function Login() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    const problem = await signIn(email, password);
    setBusy(false);
    if (problem) {
      setError(problem);
      return;
    }
    // Every role lands on the shop; the portal is one click from the profile menu.
    navigate('/', { replace: true });
  }

  return (
    <div className="grid min-h-screen place-items-center bg-blush-50 px-5 py-10">
      <div className="w-full max-w-[430px]">
        <div className="text-center">
          <img
            src="/img/logo-mark.png"
            alt=""
            width={640}
            height={531}
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
            disabled={busy}
            className="mt-4 w-full rounded-pill bg-crimson-600 py-3 text-[11.5px] font-medium text-white transition-colors hover:bg-wine-800 disabled:opacity-60"
          >
            {busy ? 'Signing in…' : 'Sign in'}
          </button>

          {!isSupabaseConfigured && (
            <p className="mt-2.5 text-center text-[9px] leading-[1.6] text-ink-300">
              Not connected to the database yet — any password is accepted, and no email is sent.
            </p>
          )}
        </form>

        <p className="mt-5 text-center text-[9.5px] leading-[1.7] text-ink-300">
          No account yet? Ask the GM to add you.
        </p>
      </div>
    </div>
  );
}
