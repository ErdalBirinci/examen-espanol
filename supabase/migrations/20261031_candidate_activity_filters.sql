-- ============================================================
--  Examen de Español — migration 9
--  Aday listesinde tarih ve aktivite filtresi
--  - Her aday için son giriş, atama, taslak, sınav ve
--    sertifika zaman damgalarını döndürür.
--  - Böylece yönetim paneli listeyi sunucudan tek seferde
--    çekip tarih aralığı ve aktivite türüne göre süzebilir.
--  Idempotent: tekrar çalıştırmak güvenli.
-- ============================================================

-- Dönüş tipi değiştiği için fonksiyonu yeniden oluşturmak gerekir.
drop function if exists public.admin_list_candidates();

create function public.admin_list_candidates()
returns table (
  id uuid,
  email text,
  full_name text,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  email_confirmed_at timestamptz,
  banned_until timestamptz,
  assignments_count integer,
  attempts_count integer,
  pending_count integer,
  certificates_count integer,
  latest_activity timestamptz,
  last_assignment_at timestamptz,
  last_draft_at timestamptz,
  last_attempt_at timestamptz,
  last_certificate_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'UNAUTHORIZED';
  end if;

  return query
  select
    u.id,
    u.email::text,
    coalesce(
      nullif(trim(u.raw_user_meta_data ->> 'full_name'), ''),
      split_part(u.email, '@', 1)
    ) as full_name,
    u.created_at,
    u.last_sign_in_at,
    u.email_confirmed_at,
    u.banned_until,
    (
      select count(*)::int
      from public.exam_assignments a
      where lower(a.email) = lower(u.email)
    ) as assignments_count,
    (
      select count(*)::int
      from public.attempts t
      where lower(t.email) = lower(u.email)
    ) as attempts_count,
    (
      select count(*)::int
      from public.attempts t
      where lower(t.email) = lower(u.email)
        and t.status = 'submitted'
    ) as pending_count,
    (
      select count(*)::int
      from public.attempts t
      where lower(t.email) = lower(u.email)
        and t.certificate_code is not null
    ) as certificates_count,
    greatest(
      u.created_at,
      u.last_sign_in_at,
      (
        select max(a.created_at)
        from public.exam_assignments a
        where lower(a.email) = lower(u.email)
      ),
      (
        select max(t.submitted_at)
        from public.attempts t
        where lower(t.email) = lower(u.email)
      ),
      (
        select max(d.updated_at)
        from public.exam_drafts d
        where lower(d.email) = lower(u.email)
      ),
      (
        select max(t.certificate_issued_at)
        from public.attempts t
        where lower(t.email) = lower(u.email)
      )
    ) as latest_activity,
    (
      select max(a.created_at)
      from public.exam_assignments a
      where lower(a.email) = lower(u.email)
    ) as last_assignment_at,
    (
      select max(d.updated_at)
      from public.exam_drafts d
      where lower(d.email) = lower(u.email)
    ) as last_draft_at,
    (
      select max(t.submitted_at)
      from public.attempts t
      where lower(t.email) = lower(u.email)
    ) as last_attempt_at,
    (
      select max(t.certificate_issued_at)
      from public.attempts t
      where lower(t.email) = lower(u.email)
    ) as last_certificate_at
  from auth.users u
  where u.email is not null
    and not exists (
      select 1 from public.profiles p where p.id = u.id
    )
  order by coalesce(u.last_sign_in_at, u.created_at) desc;
end;
$$;

revoke all on function public.admin_list_candidates() from public, anon;
grant execute on function public.admin_list_candidates() to authenticated;
