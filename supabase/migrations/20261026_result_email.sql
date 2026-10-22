-- ============================================================
--  Examen de Español — migration 4
--  Sonuç e-postası gönderim izi
--  Idempotent: tekrar çalıştırmak güvenli.
-- ============================================================

alter table public.attempts
  add column if not exists result_notified_at timestamptz;
