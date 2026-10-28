import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import {
  PRESET_METHODS,
  accountOf,
  accountsOf,
  approveAccount,
  methodLabel,
  readQrImage,
  removeAccount,
  saveAccount,
  slugMethod,
  useAccounts,
} from '@/lib/payaccounts';
import { memberOf } from '@/lib/quota';

/**
 * Where a member publishes the accounts they want to be paid into.
 *
 * When a customer orders from the website on their own, there is nobody at the
 * counter to take the money — the order goes to the member who needs it most,
 * and that member's QR is what the customer scans. So every member has to put
 * their own code here, with the name on the account, or their customer orders
 * cannot be paid at all (the POS says "unavailable").
 */

const inputClass =
  'w-full rounded-[5px] border border-blush-300 bg-white px-2.5 py-[7px] text-[11px] text-ink-900 outline-none placeholder:text-ink-300 focus:border-crimson-600';

const OTHER = '__other';

/** The first preset this member has not published yet, so the form opens empty. */
function firstFreeMethod(memberId: string): string {
  const have = new Set(accountsOf(memberId).map((a) => a.method));
  return PRESET_METHODS.find((m) => !have.has(m.id))?.id ?? PRESET_METHODS[0].id;
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span className="mb-1 block text-[8px] uppercase tracking-[0.15em] text-ink-300">{children}</span>
  );
}

export default function PaymentQr() {
  const { member } = useAuth();
  const accounts = useAccounts();
  const mine = useMemo(() => (member ? accountsOf(member.id) : []), [accounts, member]);
  // The GM sees every member's codes, because the one thing an upload cannot
  // prove is whose account it is — somebody has to look.
  const pending = useMemo(
    () => accounts.filter((a) => !a.approved && a.memberId !== member?.id),
    [accounts, member?.id],
  );

  // Open on the first method they have not published yet — landing on
  // "replace your GCash code" when there is nothing to replace reads wrong.
  const [method, setMethod] = useState<string>(() => firstFreeMethod(member?.id ?? ''));
  const [customName, setCustomName] = useState('');
  const [accountName, setAccountName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [qr, setQr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [flash, setFlash] = useState('');
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  if (!member) return null;

  // Narrowed once, because the handlers below run later and TS will not carry
  // the guard across a function boundary.
  const me = member;
  const isGm = me.role === 'gm';

  const resolved =
    method === OTHER
      ? { id: slugMethod(customName), label: customName.trim() }
      : { id: method, label: methodLabel(method) };

  const editing = mine.find((a) => a.method === resolved.id);

  function reset() {
    setMethod(firstFreeMethod(me.id));
    setCustomName('');
    setAccountName('');
    setAccountNumber('');
    setQr(null);
    setError('');
    if (fileRef.current) fileRef.current.value = '';
  }

  function loadForEdit(accountMethod: string) {
    const a = mine.find((x) => x.method === accountMethod);
    if (!a) return;
    setMethod(PRESET_METHODS.some((p) => p.id === a.method) ? a.method : OTHER);
    setCustomName(PRESET_METHODS.some((p) => p.id === a.method) ? '' : a.label);
    setAccountName(a.accountName);
    setAccountNumber(a.accountNumber);
    setQr(a.qr);
    setError('');
    setFlash('');
    if (fileRef.current) fileRef.current.value = '';
  }

  async function pickFile(file: File | undefined) {
    if (!file) return;
    setError('');
    try {
      const dataUrl = await readQrImage(file);
      setQr(dataUrl);
    } catch {
      setError('That file could not be read. Try a PNG or a JPG.');
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setFlash('');

    if (!resolved.label) {
      setError('Name the payment method first.');
      return;
    }
    if (!accountName.trim()) {
      setError('Add the name on the account — the customer checks it before paying.');
      return;
    }
    if (!accountNumber.trim()) {
      setError('Add the number the customer pays into.');
      return;
    }
    if (!qr) {
      setError('Upload the picture of your QR code.');
      return;
    }

    setBusy(true);
    const stored = await saveAccount({
      memberId: me.id,
      method: resolved.id,
      label: resolved.label,
      accountName,
      accountNumber,
      qr,
    });
    setBusy(false);

    // Read back what actually landed: a fresh upload is not approved, so the
    // page must not promise the customer can pay into it yet.
    const row = accountOf(me.id, resolved.id);
    const needsCheck = !!row && !row.approved;

    setFlash(
      !stored
        ? `That ${resolved.label} account did not save. Try a smaller picture, or try again.`
        : needsCheck
          ? `${resolved.label} saved. The GM has to check the code before a customer can pay into it.`
          : `${resolved.label} saved. Customers can pay you at this account.`,
    );
    reset();
  }

  async function drop(id: string, label: string) {
    const ok = await removeAccount(id);
    setConfirmId(null);
    setFlash(ok ? `${label} removed.` : `That ${label} account could not be removed. Try again.`);
  }

  async function approve(id: string) {
    const ok = await approveAccount(id, me.id);
    setFlash(ok ? 'Code checked. Customers can pay into it now.' : 'That code could not be approved.');
  }

  const nameMismatch =
    accountName.trim() !== '' &&
    !accountName.toLowerCase().includes(me.name.split(' ')[0].toLowerCase());

  return (
    <main className="mx-auto max-w-[1560px] px-7 pb-9 pt-[26px] max-md:px-4">
      <div className="flex items-start justify-between gap-6 max-md:flex-col max-md:gap-3.5">
        <div>
          <h1 className="text-[clamp(26px,2.3vw,31px)]">Payment QR.</h1>
          <p className="mt-1.5 max-w-[64ch] text-[11.5px] text-ink-500">
            The accounts customers pay into when they order on their own. Upload the code and the
            name on it — the customer sees both before paying, so they know whose account it is.
          </p>
        </div>
        <Link
          to="/pos"
          className="rounded-pill border border-blush-300 bg-white px-[15px] py-2 text-[11px] font-medium transition-colors hover:border-wine-800 hover:text-wine-800"
        >
          Open the POS
        </Link>
      </div>

      <div className="mt-[18px] grid grid-cols-[1fr_340px] items-start gap-4 max-lg:grid-cols-1">
        {/* ── The GM's queue ───────────────────────────────────────────── */}
        {/* An upload proves nothing about whose account it is — the only proof
            is a person comparing the name on the code with the member. Until
            that happens the code is never shown to a customer. */}
        {isGm && pending.length > 0 && (
          <section className="rounded-[7px] border border-warn-600/40 bg-warn-100/50 p-[18px] lg:col-span-2">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[11px] font-medium text-ink-900">Waiting to be checked</span>
              <span className="num text-[10px] text-ink-500">
                {pending.length} {pending.length === 1 ? 'code' : 'codes'}
              </span>
            </div>
            <p className="mt-1 max-w-[76ch] text-[10px] leading-[1.6] text-ink-500">
              A code only reaches a customer once someone has confirmed it is really that member's
              account. Compare the name on it with the member before approving.
            </p>
            <ul className="mt-3 divide-y divide-blush-300/50">
              {pending.map((a) => (
                <li key={a.id} className="flex items-center gap-3 py-2.5">
                  <div className="h-[46px] w-[46px] flex-none overflow-hidden rounded-[4px] border border-blush-300 bg-white p-0.5">
                    {a.qr ? (
                      <img src={a.qr} alt="" className="h-full w-full object-contain" />
                    ) : (
                      <div className="grid h-full place-items-center text-[7px] text-ink-300">
                        none
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[10.5px] font-medium text-ink-900">
                      {memberOf(a.memberId)?.name ?? a.memberId} · {a.label}
                    </p>
                    <p className="truncate text-[9.5px] text-ink-500">
                      {a.accountName} · {a.accountNumber}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void approve(a.id)}
                    className="flex-none rounded-pill bg-ok-600 px-3 py-1.5 text-[10px] font-medium text-white transition-opacity hover:opacity-90"
                  >
                    Approve
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* ── What is already published ─────────────────────────────────── */}
        <section className="overflow-hidden rounded-[7px] border border-blush-300 bg-white">
          <div className="flex items-baseline justify-between gap-3 border-b border-blush-300/60 px-[18px] py-3.5">
            <span className="text-[11px] font-medium text-ink-900">
              {me.name.split(' ')[0]}'s accounts
            </span>
            <span className="num text-[10px] text-ink-300">
              {mine.length} {mine.length === 1 ? 'account' : 'accounts'}
            </span>
          </div>

          {mine.length === 0 ? (
            <div className="px-[18px] py-10 text-center">
              <p className="text-[12px] font-medium text-ink-900">No payment account yet.</p>
              <p className="mx-auto mt-1.5 max-w-[46ch] text-[10.5px] leading-[1.7] text-ink-500">
                Until you add one, an order that lands on you from the website cannot be paid — the
                POS will show it as unavailable. Add at least one method on the right.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-blush-300/50">
              {mine.map((a) => (
                <li key={a.id} className="flex items-start gap-3.5 px-[18px] py-3.5">
                  <div className="w-[74px] flex-none overflow-hidden rounded-[5px] border border-blush-300 bg-white p-1">
                    {a.qr ? (
                      <img
                        src={a.qr}
                        alt={`${a.label} QR for ${a.accountName}`}
                        className="h-[64px] w-full object-contain"
                      />
                    ) : (
                      <div className="grid h-[64px] place-items-center text-[8px] text-ink-300">
                        no code
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-pill bg-blush-100 px-2 py-[2px] text-[8px] uppercase tracking-[0.12em] text-ink-500">
                        {a.label}
                      </span>
                      <span className="num text-[11px] font-medium text-ink-900">
                        {a.accountNumber}
                      </span>
                      {a.approved ? (
                        <span className="rounded-pill bg-ok-100 px-2 py-[2px] text-[8px] uppercase tracking-[0.12em] text-ok-600">
                          Live
                        </span>
                      ) : (
                        <span className="rounded-pill bg-warn-100 px-2 py-[2px] text-[8px] uppercase tracking-[0.12em] text-warn-600">
                          Not checked yet
                        </span>
                      )}
                    </div>
                    <p className="mt-1 truncate text-[10.5px] text-ink-500">{a.accountName}</p>
                    <p className="mt-0.5 text-[9px] text-ink-300">
                      Added{' '}
                      {new Date(a.addedAt).toLocaleDateString('en-PH', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                      {a.approved
                        ? ' · customers can pay into it'
                        : ' · the GM has to check it first'}
                    </p>
                  </div>

                  <div className="flex flex-none gap-1.5">
                    {isGm && !a.approved && (
                      <button
                        type="button"
                        onClick={() => void approve(a.id)}
                        className="rounded-[4px] border border-ok-600 px-2 py-1 text-[9.5px] text-ok-600 transition-colors hover:bg-ok-600 hover:text-white"
                      >
                        Approve
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => loadForEdit(a.method)}
                      className="rounded-[4px] border border-blush-300 px-2 py-1 text-[9.5px] text-ink-500 transition-colors hover:border-wine-800 hover:text-wine-800"
                    >
                      Replace
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (confirmId === a.id) {
                          void drop(a.id, a.label);
                        } else {
                          setConfirmId(a.id);
                        }
                      }}
                      className={[
                        'rounded-[4px] border px-2 py-1 text-[9.5px] transition-colors',
                        confirmId === a.id
                          ? 'border-bad-600 bg-bad-600 text-white'
                          : 'border-blush-300 text-ink-500 hover:border-bad-600 hover:text-bad-600',
                      ].join(' ')}
                    >
                      {confirmId === a.id ? 'Sure?' : 'Remove'}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ── Add / replace ─────────────────────────────────────────────── */}
        <section className="rounded-[7px] border border-blush-300 bg-white p-[18px]">
          <span className="eyebrow">{editing ? 'Replace a code' : 'Add a code'}</span>

          <form onSubmit={submit} className="mt-3 space-y-3">
            <div>
              <Label>Payment method</Label>
              <div className="grid grid-cols-2 gap-1.5">
                {PRESET_METHODS.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setMethod(m.id)}
                    aria-pressed={method === m.id}
                    className={[
                      'rounded-[5px] border py-2 text-[10px] transition-colors',
                      method === m.id
                        ? 'border-crimson-600 bg-crimson-600 text-white'
                        : 'border-blush-300 bg-white text-ink-500',
                    ].join(' ')}
                  >
                    {m.label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setMethod(OTHER)}
                  aria-pressed={method === OTHER}
                  className={[
                    'rounded-[5px] border py-2 text-[10px] transition-colors',
                    method === OTHER
                      ? 'border-crimson-600 bg-crimson-600 text-white'
                      : 'border-blush-300 bg-white text-ink-500',
                  ].join(' ')}
                >
                  Other
                </button>
              </div>

              {method === OTHER && (
                <input
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder="e.g. BPI, Palawan, Seabank"
                  className={`${inputClass} mt-1.5`}
                  aria-label="Name of the payment method"
                />
              )}

              {editing && (
                <p className="mt-1.5 text-[9px] leading-[1.5] text-warn-600">
                  You already have a {resolved.label} account. Saving replaces it.
                </p>
              )}
            </div>

            <label className="block">
              <Label>Name on the account</Label>
              <input
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
                placeholder="As it appears in the app"
                className={inputClass}
              />
            </label>

            {nameMismatch && (
              <p className="-mt-1 text-[9px] leading-[1.5] text-warn-600">
                This is not {me.name}. That is allowed — just know the customer will see this
                name, not yours.
              </p>
            )}

            <label className="block">
              <Label>Number to pay into</Label>
              <input
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
                placeholder="09xx xxx xxxx"
                className={inputClass}
              />
            </label>

            <div>
              <Label>QR code</Label>
              <div className="flex items-center gap-2.5">
                <div className="h-[74px] w-[74px] flex-none overflow-hidden rounded-[5px] border border-dashed border-blush-300 bg-blush-50 p-1">
                  {qr ? (
                    <img src={qr} alt="The QR you selected" className="h-full w-full object-contain" />
                  ) : (
                    <div className="grid h-full place-items-center text-center text-[8px] leading-[1.3] text-ink-300">
                      no code
                      <br />
                      yet
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    onChange={(e) => pickFile(e.target.files?.[0])}
                    className="block w-full text-[9.5px] text-ink-500 file:mr-2 file:rounded-[4px] file:border file:border-blush-300 file:bg-white file:px-2 file:py-1 file:text-[9.5px] file:text-ink-500"
                    aria-label="Upload your QR code"
                  />
                  <p className="mt-1.5 text-[9px] leading-[1.5] text-ink-300">
                    A screenshot of your QR is fine. It is shrunk before saving.
                  </p>
                </div>
              </div>
            </div>

            {error && (
              <p className="rounded-[5px] bg-bad-100 px-2.5 py-2 text-[9.5px] leading-[1.5] text-bad-600">
                {error}
              </p>
            )}

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={busy}
                className="flex-1 rounded-pill bg-crimson-600 px-[15px] py-2.5 text-[11px] font-medium text-white transition-colors hover:bg-wine-800 disabled:opacity-50"
              >
                {editing ? 'Replace this code' : 'Save this account'}
              </button>
              {(qr || accountName || accountNumber || method === OTHER) && (
                <button
                  type="button"
                  onClick={reset}
                  className="rounded-pill border border-blush-300 px-3 py-2.5 text-[11px] text-ink-500"
                >
                  Clear
                </button>
              )}
            </div>

            {flash && (
              <p className="rounded-[5px] bg-ok-100 px-2.5 py-2 text-[9.5px] leading-[1.5] text-ok-600">
                {flash}
              </p>
            )}
          </form>
        </section>
      </div>
    </main>
  );
}
