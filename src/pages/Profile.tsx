import { useEffect, useRef, useState } from 'react';
import { ROLE_LABEL, emailOf, useAuth } from '@/lib/auth';
import {
  MIN_PASSWORD,
  PHONE_LENGTH,
  changePassword,
  formatPhone,
  initialsOf,
  isValidPhone,
  phoneDigits,
  readAvatarImage,
  saveProfile,
} from '@/lib/profile';

// ─── Profile ────────────────────────────────────────────────────────────────
// What a member fills in about themselves: the name the team sees, a photo, and
// how to reach them.
//
// Two of the things on this page are deliberately not editable here. The email
// is the login — changing it has to go through a confirmation email, so it is
// shown read-only and the GM handles it. The role is the shop's decision, not
// the member's, and the database refuses to let a member write it at all (see
// `add-profile.sql`). Showing it greyed out is honest: it says "this is not
// yours to change" instead of hiding the fact that it exists.

// The border colour is kept out of the base on purpose: two border-colour
// utilities on one element are decided by stylesheet order, not by the order
// they appear in the class list, so an "invalid" border would lose to the
// normal one. Each caller adds exactly one.
const FIELD_BASE =
  'w-full rounded-[5px] border bg-white px-2.5 py-[7px] text-[11.5px] text-ink-900 outline-none transition-colors focus:border-crimson-600';
const FIELD = `${FIELD_BASE} border-blush-300`;
const LABEL = 'mb-1 block text-[8px] uppercase tracking-[0.16em] text-ink-300';

export default function Profile() {
  const { member, refreshMember } = useAuth();

  const [fullName, setFullName] = useState(member?.name ?? '');
  const [phone, setPhone] = useState(member?.phone ?? '');
  const [address, setAddress] = useState(member?.address ?? '');
  const [birthday, setBirthday] = useState(member?.birthday ?? '');
  const [avatar, setAvatar] = useState<string | null>(member?.avatar ?? null);

  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Password — its own little form, because it is a different thing entirely:
  // the row above is data, this is the key to the account.
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [reveal, setReveal] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Fill the form once the session resolves. Keyed on the member id, not the
  // whole object, so a refresh after saving cannot wipe what is being typed.
  useEffect(() => {
    if (!member) return;
    setFullName(member.name);
    setPhone(phoneDigits(member.phone ?? ''));
    setAddress(member.address ?? '');
    setBirthday(member.birthday ?? '');
    setAvatar(member.avatar ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [member?.id]);

  async function pickPhoto(e: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = e.target.files?.[0];
    e.target.value = ''; // so choosing the same picture again still fires
    if (!file) return;
    setPhotoError(null);
    setMsg(null);
    try {
      setAvatar(await readAvatarImage(file));
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : 'Could not read that picture.');
    }
  }

  async function save(): Promise<void> {
    if (!member) return;
    setMsg(null);

    if (!fullName.trim()) {
      setMsg({ ok: false, text: 'Your name cannot be empty.' });
      return;
    }
    if (phone && !isValidPhone(phone)) {
      setMsg({
        ok: false,
        text: `Enter an ${PHONE_LENGTH}-digit mobile number, like 0917 123 4567.`,
      });
      return;
    }

    setSaving(true);
    const error = await saveProfile(member.id, { fullName, phone, address, birthday, avatar });
    setSaving(false);

    if (error) {
      setMsg({ ok: false, text: error });
      return;
    }
    await refreshMember();
    setMsg({ ok: true, text: 'Saved.' });
  }

  async function updatePassword(): Promise<void> {
    setPwMsg(null);

    if (!current) {
      setPwMsg({ ok: false, text: 'Enter your current password.' });
      return;
    }
    if (next.length < MIN_PASSWORD) {
      setPwMsg({ ok: false, text: `Use at least ${MIN_PASSWORD} characters.` });
      return;
    }
    if (next !== confirm) {
      setPwMsg({ ok: false, text: 'The two new passwords do not match.' });
      return;
    }
    if (next === current) {
      setPwMsg({ ok: false, text: 'That is already your password — pick a different one.' });
      return;
    }

    setPwSaving(true);
    const error = await changePassword(current, next);
    setPwSaving(false);

    if (error) {
      setPwMsg({ ok: false, text: error });
      return;
    }
    setCurrent('');
    setNext('');
    setConfirm('');
    setReveal(false);
    setPwMsg({ ok: true, text: 'Password changed. Use the new one next time you sign in.' });
  }

  if (!member) return null;

  const shown = fullName.trim() || member.name;

  return (
    <>
      <header className="flex h-[52px] items-center justify-between gap-5 border-b border-blush-300 bg-white px-7 max-md:px-4">
        <span className="text-[8.5px] uppercase tracking-[0.19em] text-ink-300">
          <b className="font-medium text-ink-900">Account</b> / Profile
        </span>
        <span className="rounded-pill border border-blush-300 px-3 py-1 text-[9.5px] text-ink-500">
          Sakssesories PH · Main
        </span>
      </header>

      <div className="px-7 pb-9 pt-[26px] max-md:px-4">
        <h1 className="text-[clamp(26px,2.3vw,31px)]">Your details.</h1>
        <p className="mt-1.5 max-w-[64ch] text-[11.5px] text-ink-500">
          The name and photo the team sees, and how to reach you. Only you can
          change these — nobody else on the team can edit your page.
        </p>

        <div className="mt-[18px] grid max-w-[860px] gap-[18px]">
          {/* ── Photo + personal information ───────────────────────────── */}
          <section className="overflow-hidden rounded-[7px] border border-blush-300 bg-white">
            <div className="border-b border-blush-300/60 px-4 py-3.5">
              <h2 className="text-[15px]">Profile</h2>
            </div>

            <div className="flex items-center gap-4 border-b border-blush-300/60 px-4 py-4 max-md:flex-col max-md:items-start">
              <div className="grid h-[76px] w-[76px] flex-none place-items-center overflow-hidden rounded-full bg-wine-900">
                {avatar ? (
                  <img src={avatar} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="font-serif text-[22px] leading-none text-white/90">
                    {initialsOf(shown)}
                  </span>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] text-ink-900">{shown}</p>
                <p className="mt-0.5 text-[10px] text-ink-300">{ROLE_LABEL[member.role]}</p>

                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => fileRef.current?.click()}
                    className="rounded-pill border border-blush-300 px-3 py-[5px] text-[9.5px] text-ink-500 transition-colors hover:border-crimson-600 hover:text-ink-900"
                  >
                    {avatar ? 'Change photo' : 'Add a photo'}
                  </button>
                  {avatar && (
                    <button
                      onClick={() => {
                        setAvatar(null);
                        setPhotoError(null);
                        setMsg(null);
                      }}
                      className="rounded-pill border border-blush-300 px-3 py-[5px] text-[9.5px] text-ink-300 transition-colors hover:border-bad-600/40 hover:text-bad-600"
                    >
                      Remove
                    </button>
                  )}
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    onChange={pickPhoto}
                    className="hidden"
                  />
                </div>

                {photoError && <p className="mt-2 text-[9.5px] text-bad-600">{photoError}</p>}
                {!photoError && (
                  <p className="mt-2 text-[9px] leading-[1.6] text-ink-300">
                    Any photo works — it is cropped to a square and shrunk before it
                    is saved.
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 px-4 py-4 max-sm:grid-cols-1">
              <label className="col-span-2 max-sm:col-span-1">
                <span className={LABEL}>Full name</span>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  maxLength={60}
                  placeholder="Ana Reyes"
                  className={FIELD}
                />
              </label>

              <label>
                <span className={LABEL}>Mobile number</span>
                <input
                  type="tel"
                  inputMode="numeric"
                  value={formatPhone(phone)}
                  onChange={(e) => setPhone(phoneDigits(e.target.value))}
                  placeholder="0917 123 4567"
                  aria-invalid={!!phone && !isValidPhone(phone)}
                  className={[
                    FIELD_BASE,
                    phone && !isValidPhone(phone) ? 'border-bad-600' : 'border-blush-300',
                  ].join(' ')}
                />
                <span
                  className={[
                    'mt-1 block text-[9px] leading-[1.5]',
                    phone && !isValidPhone(phone) ? 'text-bad-600' : 'text-ink-300',
                  ].join(' ')}
                >
                  {phone && !isValidPhone(phone)
                    ? `${phone.length} of ${PHONE_LENGTH} digits — it needs all ${PHONE_LENGTH}, starting with 09.`
                    : `Exactly ${PHONE_LENGTH} digits, starting with 09.`}
                </span>
              </label>

              <label>
                <span className={LABEL}>Birthday</span>
                <input
                  type="date"
                  value={birthday}
                  onChange={(e) => setBirthday(e.target.value)}
                  className={FIELD}
                />
              </label>

              <label className="col-span-2 max-sm:col-span-1">
                <span className={LABEL}>Address</span>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  maxLength={140}
                  placeholder="Street, barangay, city"
                  className={FIELD}
                />
              </label>
            </div>

            <div className="flex flex-wrap items-center gap-3 border-t border-blush-300/60 bg-blush-50 px-4 py-3">
              <button
                onClick={save}
                disabled={saving}
                className="rounded-pill bg-crimson-600 px-[18px] py-2 text-[11px] font-medium text-white transition-colors hover:bg-wine-800 disabled:opacity-60"
              >
                {saving ? 'Saving…' : 'Save changes'}
              </button>
              {msg && (
                <span className={['text-[10px]', msg.ok ? 'text-ok-600' : 'text-bad-600'].join(' ')}>
                  {msg.text}
                </span>
              )}
            </div>
          </section>

          {/* ── Account, set by the shop ──────────────────────────────── */}
          <section className="overflow-hidden rounded-[7px] border border-blush-300 bg-white">
            <div className="border-b border-blush-300/60 px-4 py-3.5">
              <h2 className="text-[15px]">Account</h2>
              <p className="mt-0.5 text-[9.5px] text-ink-300">
                Set by the shop. Ask the GM if any of it is wrong.
              </p>
            </div>

            <dl className="grid grid-cols-2 gap-4 px-4 py-4 max-md:grid-cols-1">
              <div className="min-w-0">
                <dt className={LABEL}>Email</dt>
                <dd className="truncate text-[11px] text-ink-900">
                  {/* Offline there is no row to read, so fall back to the same
                      address the dev sign-in already matches on. */}
                  {member.email ?? emailOf(member.name)}
                </dd>
              </div>
              <div className="min-w-0">
                <dt className={LABEL}>Role</dt>
                <dd className="text-[11px] text-ink-900">{ROLE_LABEL[member.role]}</dd>
              </div>
            </dl>
          </section>

          {/* ── Password ──────────────────────────────────────────────── */}
          <section className="overflow-hidden rounded-[7px] border border-blush-300 bg-white">
            <div className="border-b border-blush-300/60 px-4 py-3.5">
              <h2 className="text-[15px]">Password</h2>
              <p className="mt-0.5 text-[9.5px] text-ink-300">
                Change it whenever you like. Nobody else can see it — not even the GM.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3 px-4 py-4 max-md:grid-cols-1">
              <label>
                <span className={LABEL}>Current password</span>
                <input
                  type={reveal ? 'text' : 'password'}
                  value={current}
                  onChange={(e) => setCurrent(e.target.value)}
                  autoComplete="current-password"
                  placeholder="••••••"
                  className={FIELD}
                />
              </label>

              <label>
                <span className={LABEL}>New password</span>
                <input
                  type={reveal ? 'text' : 'password'}
                  value={next}
                  onChange={(e) => setNext(e.target.value)}
                  autoComplete="new-password"
                  placeholder={`At least ${MIN_PASSWORD} characters`}
                  className={FIELD}
                />
              </label>

              <label>
                <span className={LABEL}>Type it again</span>
                <input
                  type={reveal ? 'text' : 'password'}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  autoComplete="new-password"
                  placeholder="Same as above"
                  className={FIELD}
                />
              </label>
            </div>

            <div className="flex flex-wrap items-center gap-3 border-t border-blush-300/60 bg-blush-50 px-4 py-3">
              <button
                onClick={updatePassword}
                disabled={pwSaving}
                className="rounded-pill bg-crimson-600 px-[18px] py-2 text-[11px] font-medium text-white transition-colors hover:bg-wine-800 disabled:opacity-60"
              >
                {pwSaving ? 'Changing…' : 'Change password'}
              </button>
              <button
                onClick={() => setReveal((v) => !v)}
                className="text-[9.5px] text-ink-300 underline-offset-2 transition-colors hover:text-ink-900 hover:underline"
              >
                {reveal ? 'Hide' : 'Show'} the letters
              </button>
              {pwMsg && (
                <span
                  className={[
                    'text-[10px]',
                    pwMsg.ok ? 'text-ok-600' : 'text-bad-600',
                  ].join(' ')}
                >
                  {pwMsg.text}
                </span>
              )}
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
