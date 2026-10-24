-- ============================================================
--  Examen de Español — migration 20261112
--  Atama akışı: RLS hatasını giderir, tarih/süre kısıtlarını kaldırır.
--  Idempotent: tekrar çalıştırmak güvenli.
-- ============================================================

-- ------------------------------------------------------------
-- 1) Yönetici politikası: is_admin() yerine doğrudan profil rolü
--    Böylece atama ekleme/güncelleme/silme işlemleri RLS'e takılmaz.
-- ------------------------------------------------------------
drop policy if exists "assignments admin" on public.exam_assignments;

create policy "assignments admin" on public.exam_assignments
  for all to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  )
  with check (
    public.is_admin()
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- ------------------------------------------------------------
-- 2) Yönetici, birden çok adaya tek çağrıda sınav atar.
--    security definer: RLS politikalarına bağlı kalmadan yazar,
--    yetkiyi fonksiyon içinde profil rolünden doğrular.
-- ------------------------------------------------------------
create or replace function public.admin_assign_exams(
  p_emails text[],
  p_level text,
  p_title text default null,
  p_note text default null,
  p_results_visible boolean default true
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
  v_count integer := 0;
begin
  if not exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  ) then
    raise exception 'UNAUTHORIZED';
  end if;

  if p_level not in ('A1','A2','B1','B2','C1','C2') then
    raise exception 'INVALID_LEVEL';
  end if;

  if p_emails is null or coalesce(array_length(p_emails, 1), 0) = 0 then
    raise exception 'NO_EMAILS';
  end if;

  foreach v_email in array p_emails loop
    v_email := lower(trim(coalesce(v_email, '')));

    if v_email = ''
       or char_length(v_email) < 5
       or char_length(v_email) > 254
       or v_email !~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]{2,}$' then
      continue;
    end if;

    insert into public.exam_assignments (
      email, level, title, note, due_at, duration_minutes, results_visible, created_by
    ) values (
      v_email,
      p_level,
      nullif(trim(coalesce(p_title, '')), ''),
      nullif(trim(coalesce(p_note, '')), ''),
      null,
      null,
      coalesce(p_results_visible, true),
      auth.uid()
    );

    v_count := v_count + 1;
  end loop;

  if v_count = 0 then
    raise exception 'NO_EMAILS';
  end if;

  return v_count;
end;
$$;

revoke all on function public.admin_assign_exams(text[], text, text, text, boolean) from public;
grant execute on function public.admin_assign_exams(text[], text, text, text, boolean)
  to authenticated;

-- ------------------------------------------------------------
-- 3) Eski kayıtlardaki son tarih ve süre değerlerini temizle:
--    adaya uygulanan bir zaman kısıtı kalmıyor.
-- ------------------------------------------------------------
update public.exam_assignments
set due_at = null
where due_at is not null;

update public.exam_assignments
set duration_minutes = null
where duration_minutes is not null;
