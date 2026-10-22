// Supabase projesi bilgileri.
// Anon key herkese açık olacak şekilde tasarlanmıştır; tüm erişim RLS ile korunur.
// Bu dosyayı elle doldurmak yerine .env içinde VITE_SUPABASE_URL /
// VITE_SUPABASE_ANON_KEY kullanabilirsin (GitHub Actions repository variables).
const FALLBACK_URL = "";
const FALLBACK_ANON_KEY = "";

export const SUPABASE_URL =
  (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() || FALLBACK_URL;

export const SUPABASE_ANON_KEY =
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim() || FALLBACK_ANON_KEY;

export const isSupabaseConfigured = Boolean(
  SUPABASE_URL.startsWith("http") && SUPABASE_ANON_KEY.length > 20,
);
