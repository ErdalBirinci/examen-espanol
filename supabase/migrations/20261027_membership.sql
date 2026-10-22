-- ============================================================
--  Examen de Español — migration 5
--  Aday üyeliği ve sınav atamaları
--  - Adaylar e-posta + şifre ile kayıt olur.
--  - Admin, bir e-postaya seviye sınavı atar.
--  - Aday yalnızca kendi atamalarını görür; gönderim atama ile eşleşir.
--  Idempotent: tekrar çalıştırmak güvenli.
-- ============================================================

create table if not exists public.exam_assignments (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  level text not null check (level in ('A1','A2','B1','B2','C1','C2')),
  title text,
  note text,
  due_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists exam_assignments_email_idx
  on public.exam_assignments (lower(email));
create index if not exists exam_assignments_created_idx
  on public.exam_assignments (created_at desc);

alter table public.exam_assignments enable row level security;

drop policy if exists "assignments own read" on public.exam_assignments;
create policy "assignments own read" on public.exam_assignments
  for select to authenticated
  using (lower(email) = lower(auth.jwt() ->> 'email'));

drop policy if exists "assignments admin" on public.exam_assignments;
create policy "assignments admin" on public.exam_assignments
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

alter table public.attempts
  add column if not exists assignment_id uuid references public.exam_assignments (id) on delete set null;

create unique index if not exists attempts_assignment_unique
  on public.attempts (assignment_id)
  where assignment_id is not null;

-- ------------------------------------------------------------
-- Aday kaydı: bu e-posta daha önce sınav göndermiş mi?
-- İsim döndürülmez; yalnızca kayıt uygunluğu kontrol edilir.
-- ------------------------------------------------------------
create or replace function public.check_candidate_email(p_email text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
begin
  if char_length(v_email) < 5 or char_length(v_email) > 254 then
    return false;
  end if;

  return exists (select 1 from public.attempts a where lower(a.email) = v_email)
      or exists (select 1 from public.exam_assignments s where lower(s.email) = v_email);
end;
$$;

revoke all on function public.check_candidate_email(text) from public;
grant execute on function public.check_candidate_email(text) to anon, authenticated;

-- ------------------------------------------------------------
-- Adayın kendi atamaları (tamamlananlar dahil)
-- ------------------------------------------------------------
create or replace function public.candidate_assignments()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_rows jsonb;
begin
  if v_email = '' then
    raise exception 'UNAUTHORIZED';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', s.id,
        'level', s.level,
        'title', s.title,
        'note', s.note,
        'due_at', s.due_at,
        'created_at', s.created_at,
        'attempt_id', a.id,
        'attempt_status', a.status,
        'submitted_at', a.submitted_at
      )
      order by s.created_at desc
    ),
    '[]'::jsonb
  ) into v_rows
  from public.exam_assignments s
  left join public.attempts a on a.assignment_id = s.id
  where lower(s.email) = v_email;

  return v_rows;
end;
$$;

revoke all on function public.candidate_assignments() from public;
grant execute on function public.candidate_assignments() to authenticated;

-- ------------------------------------------------------------
-- Gönderim: atama zorunlu
-- ------------------------------------------------------------
drop function if exists public.submit_attempt(text, text, text, jsonb, jsonb, text, text, integer);

create or replace function public.submit_attempt(
  p_level text,
  p_full_name text,
  p_email text,
  p_mc_answers jsonb,
  p_listening_answers jsonb,
  p_writing_text text,
  p_speaking_path text,
  p_speaking_duration integer,
  p_assignment_id uuid
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
  v_assignment public.exam_assignments%rowtype;
begin
  if p_assignment_id is null then
    raise exception 'ASSIGNMENT_REQUIRED';
  end if;

  select * into v_assignment
  from public.exam_assignments s
  where s.id = p_assignment_id
  for update;

  if not found then
    raise exception 'ASSIGNMENT_NOT_FOUND';
  end if;
  if lower(v_assignment.email) <> v_email then
    raise exception 'ASSIGNMENT_MISMATCH';
  end if;
  if v_assignment.level <> p_level then
    raise exception 'LEVEL_MISMATCH';
  end if;
  if v_assignment.due_at is not null and v_assignment.due_at < now() then
    raise exception 'DUE_DATE_PASSED';
  end if;
  if exists (select 1 from public.attempts a where a.assignment_id = p_assignment_id) then
    raise exception 'ALREADY_SUBMITTED';
  end if;

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

  if exists (
    select 1 from public.attempts a
    where a.email = v_email and a.created_at > now() - interval '2 minutes'
  ) then
    raise exception 'RATE_LIMIT';
  end if;

  insert into public.attempts (
    id, full_name, email, level, status, mc_answers, listening_answers,
    writing_text, speaking_path, speaking_duration, submitted_at, assignment_id
  ) values (
    v_id, v_name, v_email, p_level, 'submitted',
    coalesce(p_mc_answers, '{}'::jsonb),
    coalesce(p_listening_answers, '{}'::jsonb),
    nullif(trim(coalesce(p_writing_text, '')), ''),
    p_speaking_path, p_speaking_duration, now(), p_assignment_id
  );

  return v_id;
end;
$$;

revoke all on function public.submit_attempt(text, text, text, jsonb, jsonb, text, text, integer, uuid) from public;
grant execute on function public.submit_attempt(text, text, text, jsonb, jsonb, text, text, integer, uuid) to authenticated;
