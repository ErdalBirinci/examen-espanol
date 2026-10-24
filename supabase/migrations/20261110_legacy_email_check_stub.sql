-- ============================================================
--  Examen de Español — migration 19
--  Eski istemciler için kayıt uyumluluğu
--
--  Açık kayıtla birlikte check_candidate_email kaldırıldı
--  (20261109). Ancak GitHub Pages'te hâlâ eski derleme
--  çalışıyorsa kayıt formu bu fonksiyonu çağırıyor ve
--  "Could not find the function" hatası alıyor.
--
--  Bu köprü sabit true döndürür: e-posta varlığını sorgulamaz,
--  hiçbir bilgi sızdırmaz, yalnızca eski istemcinin kapısını açar.
--  Yeni derleme yayınlandıktan sonra fonksiyon tekrar kaldırılabilir.
--  Idempotent: tekrar çalıştırmak güvenli.
-- ============================================================

create or replace function public.check_candidate_email(p_email text)
returns boolean
language sql
immutable
security definer
set search_path = public
as $$
  select true;
$$;

revoke all on function public.check_candidate_email(text) from public;
grant execute on function public.check_candidate_email(text) to anon, authenticated;

notify pgrst, 'reload schema';
