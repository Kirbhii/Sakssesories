// ─── A member's own profile ─────────────────────────────────────────────────
// The details a person fills in about themselves: the name the team sees, a
// photo, and how to reach them.
//
// Two rules shape this file.
//
// 1. **A member may only ever write their own row.** The database enforces it
//    (`profiles_self_update`: auth_id = auth.uid()), and the column grant in
//    `add-profile.sql` narrows it further — name, phone, address, birthday and
//    photo, and nothing else. `role` is not on that list, so a member cannot
//    promote themselves to GM even if the app were tricked into trying.
//
// 2. **The photo is a data URL, not a file in a bucket.** It is centre-cropped
//    to a 320 px square and re-encoded as JPEG (~25 KB) before it is ever sent,
//    which is the same trick `payment_accounts.qr` already uses. That keeps the
//    whole feature to three columns and no storage setup to get wrong.
//
// Without a database the same edits are kept in localStorage so the screen can
// still be worked on offline; `localProfile` is what `auth.tsx` reads back.

import { supabase } from './supabase';

export interface ProfileInfo {
  fullName: string;
  phone: string;
  address: string;
  /** 'YYYY-MM-DD', or '' when they have not said. */
  birthday: string;
  /** A downscaled JPEG data URL, or null for "no photo". */
  avatar: string | null;
}

const LOCAL_KEY = 'skph.profiles';

type LocalMap = Record<string, Partial<ProfileInfo>>;

function readLocal(): LocalMap {
  try {
    const raw = window.localStorage.getItem(LOCAL_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as LocalMap) : {};
  } catch {
    return {};
  }
}

/** The saved stand-in for one member, when there is no database. */
export function localProfile(slug: string): Partial<ProfileInfo> | null {
  return readLocal()[slug] ?? null;
}

function writeLocal(slug: string, info: ProfileInfo): boolean {
  try {
    const all = readLocal();
    all[slug] = info;
    window.localStorage.setItem(LOCAL_KEY, JSON.stringify(all));
    return true;
  } catch {
    return false; // private mode, or the shelf is full
  }
}

/**
 * Save the four fields. Resolves `null` when it worked, or a sentence to show
 * the member when it did not — the difference between "your connection" and
 * "the migration has not been run" is worth saying out loud.
 */
export async function saveProfile(slug: string, info: ProfileInfo): Promise<string | null> {
  const clean: ProfileInfo = {
    fullName: info.fullName.trim(),
    phone: info.phone.trim(),
    address: info.address.trim(),
    birthday: info.birthday,
    avatar: info.avatar,
  };

  if (!supabase) {
    return writeLocal(slug, clean)
      ? null
      : 'Could not save on this device — storage is full or blocked.';
  }

  const { error } = await supabase
    .from('profiles')
    .update({
      full_name: clean.fullName,
      phone: clean.phone || null,
      address: clean.address || null,
      birthday: clean.birthday || null,
      avatar: clean.avatar,
    })
    .eq('slug', slug);

  if (error) {
    console.error('[profile] could not save:', error.message);
    // 42703 = undefined column, 42501 = permission denied on that column.
    if (error.code === '42703' || error.code === 'PGRST204') {
      return 'The profile fields are not in the database yet — run supabase/add-profile.sql once.';
    }
    if (error.code === '42501') {
      return 'The database refused that change. Only your own details can be edited.';
    }
    return 'Could not save — check your connection and try again.';
  }
  return null;
}

// ── The photo ───────────────────────────────────────────────────────────────
// A phone camera hands over 3–5 MB. Nobody needs more than a 320 px square for
// a circle in the corner of a rail, so it is cropped and re-encoded here rather
// than shipped whole.

const AVATAR_PX = 320;

export async function readAvatarImage(file: File): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Could not read that file.'));
    reader.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('That file is not an image.'));
    image.src = dataUrl;
  });

  // Centre-crop to a square first, so faces are not stretched by the circle.
  const side = Math.min(img.width, img.height);
  const sx = (img.width - side) / 2;
  const sy = (img.height - side) / 2;

  const canvas = document.createElement('canvas');
  canvas.width = AVATAR_PX;
  canvas.height = AVATAR_PX;
  const ctx = canvas.getContext('2d');
  if (!ctx) return dataUrl; // no canvas — send the original rather than nothing

  ctx.drawImage(img, sx, sy, side, side, 0, 0, AVATAR_PX, AVATAR_PX);
  return canvas.toDataURL('image/jpeg', 0.85);
}

/** 'Ana Reyes' → 'AR'. Used when there is no photo to show. */
export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  const first = parts[0][0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1][0] ?? '') : '';
  return (first + last).toUpperCase();
}
