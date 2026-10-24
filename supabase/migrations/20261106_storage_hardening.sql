-- ============================================================
--  Examen de Español — migration 15
--  Konuşma kaydı yüklemesinin kısıtlanması
--
--  Çekirdek güvenlik sertleştirmesinden (20261105) ayrı tutulur:
--  hosted Supabase projelerinde storage.objects tablosunun sahibi
--  supabase_storage_admin'dir. SQL Editor postgres olarak çalıştığı için
--  bazı projelerde bu dosya 42501 "must be owner of table objects" hatası
--  verebilir. O durumda aşağıdaki "Yedek yol" bloğunu ya da Dashboard →
--  Storage → Policies ekranını kullan.
--  Idempotent: tekrar çalıştırmak güvenli.
-- ============================================================

begin;

update storage.buckets
set allowed_mime_types = array[
      'audio/webm', 'audio/ogg', 'audio/mpeg', 'audio/mp3',
      'audio/mp4', 'audio/x-m4a', 'audio/wav', 'audio/x-wav', 'audio/aac'
    ],
    file_size_limit = 52428800
where id = 'exam-recordings';

drop policy if exists "recordings public upload" on storage.objects;
drop policy if exists "recordings candidate upload" on storage.objects;

create policy "recordings candidate upload" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'exam-recordings'
    and auth.role() = 'authenticated'
    and name ~ '^recordings/[0-9]{4}-[0-9]{2}-[0-9]{2}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.[a-z0-9]{2,5}$'
  );

commit;

notify pgrst, 'reload schema';

-- ------------------------------------------------------------
--  Yedek yol — yukarıdaki blok 42501 verirse bunu çalıştır
--
--  begin;
--  set local role supabase_storage_admin;
--  drop policy if exists "recordings public upload" on storage.objects;
--  drop policy if exists "recordings candidate upload" on storage.objects;
--  create policy "recordings candidate upload" on storage.objects
--    for insert to authenticated
--    with check (
--      bucket_id = 'exam-recordings'
--      and auth.role() = 'authenticated'
--      and name ~ '^recordings/[0-9]{4}-[0-9]{2}-[0-9]{2}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.[a-z0-9]{2,5}$'
--    );
--  reset role;
--  commit;
--
--  Rol değişimi de reddedilirse Dashboard → Storage → Policies:
--  exam-recordings kovasına "authenticated" rolü için INSERT politikası
--  ekle ve ifade olarak yalnızca yukarıdaki with check koşulunu kullan.
-- ------------------------------------------------------------
