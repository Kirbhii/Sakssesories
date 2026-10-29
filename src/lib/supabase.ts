import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// ─── Environment ────────────────────────────────────────────────────────────
// With `.env` filled in, this is a real client against the shop's project and
// every screen reads live data. Without it the app still runs on the local
// stand-in so the UI can be worked on before the database exists — nothing
// crashes on a fresh clone.
//
// The anon key is public by design: it identifies the project, it does not
// grant anything. What a visitor may actually do is decided by the row level
// security policies in `supabase/schema.sql` — a signed-out customer can insert
// one pending customer order and read nothing at all.

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isSupabaseConfigured = Boolean(url && anonKey);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url as string, anonKey as string)
  : null;

// ─── Row types ──────────────────────────────────────────────────────────────
// These mirror `supabase/schema.sql` one-for-one, snake_case and all. They are
// what the client hands back, so the mapping into the app's own shapes happens
// in one place per table (`rowToSale`, `rowToAccount`) instead of everywhere.

export type MemberRole = 'marketing' | 'production' | 'finance' | 'gm';
export type DepartmentId = 'marketing' | 'production' | 'finance';
export type Origin = 'counter' | 'customer';
export type SaleStatus = 'pending' | 'paid' | 'void';

export interface ProfileRow {
  slug: string;
  email: string;
  full_name: string;
  role: MemberRole;
  department: DepartmentId;
  active: boolean;
  auth_id: string | null;
  created_at: string;
}

export interface PaymentAccountRow {
  id: string;
  member_slug: string;
  method: string;
  label: string;
  account_name: string;
  account_number: string;
  qr: string | null;
  /** False until a person has looked at the code and said it is really theirs. */
  approved: boolean;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
}

export interface SaleRow {
  id: string;
  or_no: string;
  /** 'YYYY-MM-DD'. The app turns this back into its "days ago" counter. */
  sold_on: string;
  /** 'HH:MM:SS'. */
  sold_at: string;
  staff_slug: string;
  customer: string;
  customer_mobile: string | null;
  variant: string;
  engraving: string;
  occupation: string;
  sex: string;
  location: string;
  qty: number;
  cents: number;
  pay: string;
  origin: Origin;
  status: SaleStatus;
  pay_ref: string | null;
  /**
   * Finance flips this once the money for an order has been turned in. Off by
   * default; only Finance and the GM may write it (policy `sales_money_update`).
   */
  remitted: boolean;
  created_at: string;
}

/**
 * What `payee_for(method)` hands back to a signed-out customer: one account,
 * and only the fields the payer has to see. No listing, no other members'
 * numbers, no sales figures.
 */
export interface PayeeRow {
  member_slug: string;
  member_name: string;
  method: string;
  label: string;
  account_name: string;
  account_number: string;
  qr: string | null;
}
