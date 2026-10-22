-- ============================================================
--  Examen de Español — migration 3
--  Sunucu taraflı sınav taslağı
--  - Aday sınavı başlatınca taslak oluşur, cevaplar düzenli kaydedilir.
--  - Aynı cihaz token ile, başka cihaz referans kodu + e-posta ile devam eder.
--  Idempotent: tekrar çalıştırmak güvenli.
-- ============================================================

create table if not exists public.exam_drafts (
  id uuid primary key default gen_random_uuid(),
  code text not null unique
    default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
  full_name text not null,
  email text not null,
  level text not null check (level in ('A1','A2','B1','B2','C1','C2')),
  mc_answers jsonb not null default '{}'::jsonb,
  listening_answers jsonb not null default '{}'::jsonb,
  writing_text text not null default '',
  started_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists exam_drafts_email_level_idx
  on public.exam_drafts (lower(email), level);
create index if not exists exam_drafts_updated_idx
  on public.exam_drafts (updated_at desc);

alter table public.exam_drafts enable row level security;
-- Policy yok: tabloya doğrudan erişim kapalı, yalnızca aşağıdaki RPC'ler.

-- ------------------------------------------------------------
-- Taslak başlat
-- ------------------------------------------------------------
create or replace function public.start_exam_draft(
  p_level text,
  p_full_name text,
  p_email text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text := trim(coalesce(p_full_name, ''));
  v_email text := lower(trim(coalesce(p_email, '')));
  v_id uuid;
  v_code text;
  v_started timestamptz;
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

  -- Aynı e-posta ile saatte en fazla 10 taslak başlatılabilir.
  if (
    select count(*) from public.exam_drafts d
    where d.email = v_email and d.started_at > now() - interval '1 hour'
  ) >= 10 then
    raise exception 'RATE_LIMIT';
  end if;

  -- 7 günden eski taslakları temizle.
  delete from public.exam_drafts where updated_at < now() - interval '7 days';

  insert into public.exam_drafts (full_name, email, level)
  values (v_name, v_email, p_level)
  returning id, code, started_at into v_id, v_code, v_started;

  return jsonb_build_object(
    'token', v_id,
    'code', v_code,
    'started_at', v_started
  );
end;
$$;

revoke all on function public.start_exam_draft(text, text, text) from public;
grant execute on function public.start_exam_draft(text, text, text) to anon, authenticated;

-- ------------------------------------------------------------
-- Aynı cihazda taslağı getir
-- ------------------------------------------------------------
create or replace function public.get_exam_draft(p_token uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_row jsonb;
begin
  select jsonb_build_object(
    'token', d.id,
    'code', d.code,
    'level', d.level,
    'started_at', d.started_at,
    'updated_at', d.updated_at,
    'mc_answers', d.mc_answers,
    'listening_answers', d.listening_answers,
    'writing_text', d.writing_text
  ) into v_row
  from public.exam_drafts d
  where d.id = p_token;

  return v_row;
end;
$$;

revoke all on function public.get_exam_draft(uuid) from public;
grant execute on function public.get_exam_draft(uuid) to anon, authenticated;

-- ------------------------------------------------------------
-- Cevapları kaydet
-- ------------------------------------------------------------
create or replace function public.save_exam_draft(
  p_token uuid,
  p_mc_answers jsonb,
  p_listening_answers jsonb,
  p_writing_text text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if jsonb_typeof(coalesce(p_mc_answers, '{}'::jsonb)) <> 'object' then
    raise exception 'INVALID_ANSWERS';
  end if;
  if jsonb_typeof(coalesce(p_listening_answers, '{}'::jsonb)) <> 'object' then
    raise exception 'INVALID_ANSWERS';
  end if;
  if p_writing_text is not null and char_length(p_writing_text) > 20000 then
    raise exception 'WRITING_TOO_LONG';
  end if;

  update public.exam_drafts
  set mc_answers = coalesce(p_mc_answers, '{}'::jsonb),
      listening_answers = coalesce(p_listening_answers, '{}'::jsonb),
      writing_text = coalesce(p_writing_text, ''),
      updated_at = now()
  where id = p_token;

  if not found then
    raise exception 'DRAFT_NOT_FOUND';
  end if;
end;
$$;

revoke all on function public.save_exam_draft(uuid, jsonb, jsonb, text) from public;
grant execute on function public.save_exam_draft(uuid, jsonb, jsonb, text) to anon, authenticated;

-- ------------------------------------------------------------
-- Başka cihazdan devam et
-- ------------------------------------------------------------
create or replace function public.resume_exam_draft(
  p_code text,
  p_email text,
  p_level text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_code text := upper(trim(coalesce(p_code, '')));
  v_email text := lower(trim(coalesce(p_email, '')));
  v_row jsonb;
begin
  if v_code !~ '^[A-Z0-9]{8}$' then
    raise exception 'INVALID_CODE';
  end if;
  if char_length(v_email) < 5 or char_length(v_email) > 254 then
    raise exception 'INVALID_EMAIL';
  end if;
  if p_level not in ('A1','A2','B1','B2','C1','C2') then
    raise exception 'INVALID_LEVEL';
  end if;

  select jsonb_build_object(
    'token', d.id,
    'code', d.code,
    'level', d.level,
    'started_at', d.started_at,
    'updated_at', d.updated_at,
    'mc_answers', d.mc_answers,
    'listening_answers', d.listening_answers,
    'writing_text', d.writing_text
  ) into v_row
  from public.exam_drafts d
  where d.code = v_code
    and d.email = v_email
    and d.level = p_level;

  return v_row;
end;
$$;

revoke all on function public.resume_exam_draft(text, text, text) from public;
grant execute on function public.resume_exam_draft(text, text, text) to anon, authenticated;

-- ------------------------------------------------------------
-- Gönderimden sonra taslağı sil
-- ------------------------------------------------------------
create or replace function public.delete_exam_draft(p_code text, p_email text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
begin
  delete from public.exam_drafts d
  where d.code = upper(trim(coalesce(p_code, '')))
    and d.email = v_email;
end;
$$;

revoke all on function public.delete_exam_draft(text, text) from public;
grant execute on function public.delete_exam_draft(text, text) to anon, authenticated;
