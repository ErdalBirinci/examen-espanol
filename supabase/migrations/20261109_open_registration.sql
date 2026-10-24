-- ============================================================
--  Examen de Español — migration 18
--  Açık aday kaydı
--
--  Kayıt artık davetle sınırlı değil: aday istediği e-posta ile
--  hesap açar, yönetici sınavı sonradan o e-postaya atar.
--  Bu nedenle kayıt öncesi "bu e-postanın sınavı var mı?"
--  sorgusuna gerek kalmadı.
--
--  check_candidate_email, kayıtlı aday e-postalarını yoklayan bir
--  sorgu oracle'ıydı; artık kullanılmadığı için kaldırılıyor.
--  Idempotent: tekrar çalıştırmak güvenli.
-- ============================================================

drop function if exists public.check_candidate_email(text);

-- PostgREST şema önbelleği kaldırılan imzayı hemen görsün.
notify pgrst, 'reload schema';
