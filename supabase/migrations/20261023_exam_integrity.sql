-- ============================================================
--  Examen de Español — sınav bütünlüğü migration'ı
--  Mevcut projeye uygulamak için SQL Editor'da çalıştır.
--  Idempotent: tekrar çalıştırmak güvenli.
-- ============================================================

-- ------------------------------------------------------------
-- 1) Sınav süresi (seviye başına, dakika)
-- ------------------------------------------------------------
create table if not exists public.exam_settings (
  level text primary key check (level in ('A1','A2','B1','B2','C1','C2')),
  duration_minutes integer not null default 60 check (duration_minutes between 10 and 240),
  updated_at timestamptz not null default now()
);

insert into public.exam_settings (level, duration_minutes) values
  ('A1', 45), ('A2', 50), ('B1', 60), ('B2', 75), ('C1', 90), ('C2', 90)
on conflict (level) do nothing;

alter table public.exam_settings enable row level security;

drop policy if exists "settings public read" on public.exam_settings;
create policy "settings public read" on public.exam_settings
  for select to anon, authenticated
  using (true);

drop policy if exists "settings admin write" on public.exam_settings;
create policy "settings admin write" on public.exam_settings
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ------------------------------------------------------------
-- 2) Sunucu tarafı gönderim: doğrulama + e-posta bazlı bekleme
--    Adaylar artık attempts tablosuna doğrudan yazamaz.
-- ------------------------------------------------------------
create or replace function public.submit_attempt(
  p_level text,
  p_full_name text,
  p_email text,
  p_mc_answers jsonb,
  p_listening_answers jsonb,
  p_writing_text text,
  p_speaking_path text,
  p_speaking_duration integer
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid := gen_random_uuid();
  v_name text := trim(coalesce(p_full_name, ''));
  v_email text := lower(trim(coalesce(p_email, '')));
begin
  if p_level not in ('A1','A2','B1','B2','C1','C2') then
    raise exception 'INVALID_LEVEL';
  end if;
  if char_length(v_name) < 2 or char_length(v_name) > 120 then
    raise exception 'INVALID_NAME';
  end if;
  if char_length(v_email) < 5 or char_length(v_email) > 254
     or v_email !~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]{2,}$' then
    raise exception 'INVALID_EMAIL';
  end if;
  if jsonb_typeof(coalesce(p_mc_answers, '{}'::jsonb)) <> 'object' then
    raise exception 'INVALID_ANSWERS';
  end if;
  if jsonb_typeof(coalesce(p_listening_answers, '{}'::jsonb)) <> 'object' then
    raise exception 'INVALID_ANSWERS';
  end if;
  if p_writing_text is not null and char_length(p_writing_text) > 20000 then
    raise exception 'WRITING_TOO_LONG';
  end if;
  if p_speaking_path is not null
     and p_speaking_path !~ '^recordings/[A-Za-z0-9/_.-]+$' then
    raise exception 'INVALID_RECORDING';
  end if;
  if p_speaking_duration is not null
     and (p_speaking_duration < 0 or p_speaking_duration > 3600) then
    raise exception 'INVALID_DURATION';
  end if;

  -- Aynı e-posta ile 2 dakika içinde ikinci gönderim engellenir.
  if exists (
    select 1 from public.attempts a
    where a.email = v_email and a.created_at > now() - interval '2 minutes'
  ) then
    raise exception 'RATE_LIMIT';
  end if;

  insert into public.attempts (
    id, full_name, email, level, status, mc_answers, listening_answers,
    writing_text, speaking_path, speaking_duration, submitted_at
  ) values (
    v_id, v_name, v_email, p_level, 'submitted',
    coalesce(p_mc_answers, '{}'::jsonb),
    coalesce(p_listening_answers, '{}'::jsonb),
    nullif(trim(coalesce(p_writing_text, '')), ''),
    p_speaking_path, p_speaking_duration, now()
  );

  return v_id;
end;
$$;

revoke all on function public.submit_attempt(text, text, text, jsonb, jsonb, text, text, integer) from public;
grant execute on function public.submit_attempt(text, text, text, jsonb, jsonb, text, text, integer) to anon, authenticated;

drop policy if exists "attempts public insert" on public.attempts;

-- ------------------------------------------------------------
-- 3) İçerik tamlık istatistikleri (yalnızca admin)
-- ------------------------------------------------------------
create or replace function public.content_stats()
returns table (level text, questions integer, listening integer, writing integer, speaking integer)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'FORBIDDEN';
  end if;

  return query
  with levels(level) as (values ('A1'),('A2'),('B1'),('B2'),('C1'),('C2'))
  select
    l.level,
    (select count(*)::int from public.questions q where q.level = l.level),
    (select count(*)::int from public.listening_items i where i.level = l.level),
    (select count(*)::int from public.writing_prompts w where w.level = l.level),
    (select count(*)::int from public.speaking_prompts s where s.level = l.level)
  from levels l;
end;
$$;

revoke all on function public.content_stats() from public;
grant execute on function public.content_stats() to authenticated;
