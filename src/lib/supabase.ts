import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// ─── Environment ────────────────────────────────────────────────────────────
// The app runs on local mock data until these are filled in. Keeping the client
// nullable means the UI can be developed and reviewed before the database
// exists — nothing crashes on a fresh clone.

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isSupabaseConfigured = Boolean(url && anonKey);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url as string, anonKey as string)
  : null;

// ─── Row types (mirror supabase/schema.sql) ─────────────────────────────────

export type UserRole = 'marketing' | 'production' | 'manager';
export type PaymentMethod = 'cash' | 'gcash' | 'card';

export interface ProfileRow {
  id: string;
  full_name: string;
  role: UserRole;
  active: boolean;
  created_at: string;
}

export interface MaterialRow {
  id: string;
  name: string;
  colour: string | null;
  sku: string;
  unit: string;
  on_hand: number;
  reorder_point: number;
  cost_cents: number;
  supplier: string | null;
}

export interface OrderRow {
  id: string;
  order_no: string;
  staff_id: string;
  customer_name: string | null;
  customer_mobile: string | null;
  payment_method: PaymentMethod;
  subtotal_cents: number;
  engraving_cents: number;
  discount_cents: number;
  total_cents: number;
  note: string | null;
  created_at: string;
}

export interface OrderItemRow {
  id: string;
  order_id: string;
  variant_id: string;
  engraving_text: string | null;
  engraving_letters: number;
  engraving_fee_cents: number;
  unit_price_cents: number;
  qty: number;
}
