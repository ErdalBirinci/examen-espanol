-- ============================================================
--  Examen de Español — migration 14
--  Güvenlik sertleştirmesi
--   1) Deneme modu: cevap anahtarı sızıntısını kapat
--   2) Gönderim ve taslakları oturum sahibine bağla
--   3) Bütünlük kaydını yalnızca sınav sahibine aç
--   4) İstemci hata kaydına hız sınırı
--   5) Konuşma kaydı yüklemesini kısıtla
--  Idempotent: tekrar çalıştırmak güvenli.
-- ============================================================

-- ------------------------------------------------------------
-- 1) Deneme modu: oturum + cevap anahtarı gizleme
-- ------------------------------------------------------------
create table if not exists public.practice_sessions (
  id uuid primary key default gen_random_uuid(),
  level text not null check (level in ('A1','A2','B1','B2','C1','C2')),
  question_ids uuid[] not null,
  ip_hash text,
  created_at timestamptz not null default now(),
  checked_at timestamptz
);

create index if not exists practice_sessions_created_idx
  on public.practice_sessions (created_at desc);
create index if not exists practice_sessions_ip_idx
  on public.practice_sessions (ip_hash, created_at desc);

alter table public.practice_sessions enable row level security;
-- Policy yok: tabloya doğrudan erişim yok, yalnızca aşağıdaki RPC'ler.

drop function if exists public.practice_check(jsonb);

create or replace function public.practice_bundle(p_level text, p_count integer default 10)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := greatest(1, least(coalesce(p_count, 10), 25));
  v_headers jsonb := coalesce(current_setting('request.headers', true), '{}')::jsonb;
  v_ip text;
  v_limit integer;
  v_ids uuid[];
  v_session uuid;
  v_questions jsonb;
begin
  if p_level not in ('A1', 'A2', 'B1', 'B2', 'C1', 'C2') then
    raise exception 'INVALID_LEVEL';
  end if;

  v_ip := coalesce(
    nullif(split_part(coalesce(v_headers ->> 'x-forwarded-for', ''), ',', 1), ''),
    nullif(v_headers ->> 'cf-connecting-ip', ''),
    nullif(v_headers ->> 'x-real-ip', '')
  );
  -- Sınıf/okul NAT'ı arkasında aynı IP'den çok aday gelebilir; 120
  -- saatlik oturum normal kullanımı engellemez, betik bombardımanını keser.
  v_limit := case when v_ip is null then 600 else 120 end;
  v_ip := md5(coalesce(v_ip, 'unknown') || '|' || date_trunc('hour', now())::text);

  if (
    select count(*) from public.practice_sessions s
    where s.ip_hash = v_ip
      and s.created_at > now() - interval '1 hour'
  ) >= v_limit then
    raise exception 'RATE_LIMIT';
  end if;

  delete from public.practice_sessions where created_at < now() - interval '1 day';

  select array_agg(q.id) into v_ids
  from (
    select id from public.questions
    where level = p_level
    order by random()
    limit v_count
  ) q;

  if v_ids is null or array_length(v_ids, 1) = 0 then
    return jsonb_build_object('session', null, 'level', p_level, 'questions', '[]'::jsonb);
  end if;

  insert into public.practice_sessions (level, question_ids, ip_hash)
  values (p_level, v_ids, v_ip)
  returning id into v_session;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', q.id,
        'prompt', q.prompt,
        'options', q.options,
        'position', q.position
      )
      order by q.position
    ),
    '[]'::jsonb
  )
  into v_questions
  from public.questions q
  where q.id = any(v_ids);

  return jsonb_build_object(
    'session', v_session,
    'level', p_level,
    'questions', v_questions
  );
end;
$$;

revoke all on function public.practice_bundle(text, integer) from public;
grant execute on function public.practice_bundle(text, integer) to anon, authenticated;

-- Yalnızca toplam skor döner: doğru şık veya soru bazlı doğruluk yok.
create or replace function public.practice_check(p_session uuid, p_answers jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.practice_sessions%rowtype;
  v_answers jsonb := coalesce(p_answers, '{}'::jsonb);
  v_total integer;
  v_correct integer;
begin
  if jsonb_typeof(v_answers) <> 'object' then
    raise exception 'INVALID_ANSWERS';
  end if;

  select * into v_session
  from public.practice_sessions s
  where s.id = p_session
  for update;

  if not found then
    raise exception 'SESSION_NOT_FOUND';
  end if;
  if v_session.checked_at is not null then
    raise exception 'ALREADY_CHECKED';
  end if;
  if v_session.created_at < now() - interval '2 hours' then
    raise exception 'SESSION_EXPIRED';
  end if;

  update public.practice_sessions set checked_at = now() where id = p_session;

  v_total := coalesce(array_length(v_session.question_ids, 1), 0);

  select count(*)::int into v_correct
  from public.questions q
  where q.id = any(v_session.question_ids)
    and (v_answers ->> q.id::text) ~ '^[0-9]+$'
    and (v_answers ->> q.id::text)::int = q.correct_index;

  return jsonb_build_object('correct', v_correct, 'total', v_total);
end;
$$;

revoke all on function public.practice_check(uuid, jsonb) from public;
grant execute on function public.practice_check(uuid, jsonb) to anon, authenticated;

-- ------------------------------------------------------------
-- 2) Gönderim ve taslaklar oturum sahibine bağlı
-- ------------------------------------------------------------
create or replace function public.enforce_attempt_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  -- JWT yoksa (servis rolü / SQL editörü) bakım işlemlerine izin ver.
  if v_email <> '' and lower(new.email) <> v_email then
    raise exception 'EMAIL_MISMATCH';
  end if;
  return new;
end;
$$;

drop trigger if exists attempts_owner_check on public.attempts;
create trigger attempts_owner_check
  before insert on public.attempts
  for each row execute function public.enforce_attempt_owner();

create or replace function public.enforce_draft_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  if v_email = '' then
    raise exception 'AUTH_REQUIRED';
  end if;
  if lower(new.email) <> v_email then
    raise exception 'EMAIL_MISMATCH';
  end if;
  return new;
end;
$$;

drop trigger if exists exam_drafts_owner_check on public.exam_drafts;
create trigger exam_drafts_owner_check
  before insert or update on public.exam_drafts
  for each row execute function public.enforce_draft_owner();

-- Taslak ve sınav içeriği yalnızca giriş yapmış adaya açık.
-- PUBLIC dahil: PostgreSQL yeni fonksiyonlara varsayılan olarak PUBLIC
-- üzerinden EXECUTE verir; yalnızca anon'dan almak yetmez.
revoke all on function public.start_exam_draft(text, text, text, uuid) from public, anon;
grant execute on function public.start_exam_draft(text, text, text, uuid) to authenticated;

revoke all on function public.get_exam_draft(uuid) from public, anon;
grant execute on function public.get_exam_draft(uuid) to authenticated;

revoke all on function public.save_exam_draft(uuid, jsonb, jsonb, text, text) from public, anon;
grant execute on function public.save_exam_draft(uuid, jsonb, jsonb, text, text) to authenticated;

revoke all on function public.resume_exam_draft(text, text, text) from public, anon;
grant execute on function public.resume_exam_draft(text, text, text) to authenticated;

revoke all on function public.delete_exam_draft(text, text) from public, anon;
grant execute on function public.delete_exam_draft(text, text) to authenticated;

revoke all on function public.exam_bundle(uuid) from public, anon;
grant execute on function public.exam_bundle(uuid) to authenticated;

-- Doğrudan tablo yazımı tamamen kapatılır. Sınav kaydı yalnızca
-- submit_attempt (SECURITY DEFINER, atama + taslak + e-posta doğrular)
-- üzerinden oluşur. Böylece bir aday kendi e-postasıyla bile doğrudan
-- "graded" bir kayıt uydurup sonuç/katılım belgesi üretemez.
drop policy if exists "attempts public insert" on public.attempts;
drop policy if exists "attempts owner insert" on public.attempts;

-- Taslak okuma/yeniden açma/silme yalnızca oturum sahibinin kendi taslağı.
-- Kod + e-posta bilinse bile başka bir adayın taslağı açılamaz.
create or replace function public.get_exam_draft(p_token uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_row jsonb;
begin
  if v_email = '' then
    raise exception 'AUTH_REQUIRED';
  end if;

  select jsonb_build_object(
    'token', d.id,
    'code', d.code,
    'level', d.level,
    'started_at', d.started_at,
    'updated_at', d.updated_at,
    'mc_answers', d.mc_answers,
    'listening_answers', d.listening_answers,
    'writing_text', d.writing_text,
    'writing_text_2', d.writing_text_2
  ) into v_row
  from public.exam_drafts d
  where d.id = p_token
    and d.email = v_email;

  return v_row;
end;
$$;

revoke all on function public.get_exam_draft(uuid) from public, anon;
grant execute on function public.get_exam_draft(uuid) to authenticated;

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
  v_jwt text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_row jsonb;
begin
  if v_jwt = '' then
    raise exception 'AUTH_REQUIRED';
  end if;
  if lower(trim(coalesce(p_email, ''))) <> v_jwt then
    raise exception 'EMAIL_MISMATCH';
  end if;
  if v_code !~ '^[A-Z0-9]{8}$' then
    raise exception 'INVALID_CODE';
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
    'writing_text', d.writing_text,
    'writing_text_2', d.writing_text_2
  ) into v_row
  from public.exam_drafts d
  where d.code = v_code
    and d.email = v_jwt
    and d.level = p_level;

  return v_row;
end;
$$;

revoke all on function public.resume_exam_draft(text, text, text) from public, anon;
grant execute on function public.resume_exam_draft(text, text, text) to authenticated;

create or replace function public.delete_exam_draft(p_code text, p_email text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_jwt text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_email text := lower(trim(coalesce(p_email, '')));
begin
  if v_jwt = '' then
    raise exception 'AUTH_REQUIRED';
  end if;
  if v_email <> v_jwt then
    raise exception 'EMAIL_MISMATCH';
  end if;

  delete from public.exam_drafts d
  where d.code = upper(trim(coalesce(p_code, '')))
    and d.email = v_jwt;
end;
$$;

revoke all on function public.delete_exam_draft(text, text) from public, anon;
grant execute on function public.delete_exam_draft(text, text) to authenticated;

-- ------------------------------------------------------------
-- 3) Bütünlük kaydı: yalnızca sınav sahibi, giriş yapmış aday
-- ------------------------------------------------------------
create or replace function public.record_attempt_integrity(
  p_attempt_id uuid,
  p_integrity jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  if v_email = '' then
    raise exception 'AUTH_REQUIRED';
  end if;
  if jsonb_typeof(coalesce(p_integrity, '{}'::jsonb)) <> 'object' then
    raise exception 'INVALID_INTEGRITY';
  end if;

  update public.attempts
  set integrity = left(coalesce(p_integrity, '{}'::jsonb)::text, 4000)::jsonb
  where id = p_attempt_id
    and lower(email) = v_email
    and created_at > now() - interval '30 minutes';
end;
$$;

revoke all on function public.record_attempt_integrity(uuid, jsonb) from public, anon;
grant execute on function public.record_attempt_integrity(uuid, jsonb) to authenticated;

-- ------------------------------------------------------------
-- 4) İstemci hata kaydı: saatlik IP sınırı
-- ------------------------------------------------------------
alter table public.client_errors add column if not exists ip_hash text;

create index if not exists client_errors_ip_idx
  on public.client_errors (ip_hash, created_at desc);

create or replace function public.log_client_error(
  p_message text,
  p_stack text default null,
  p_url text default null,
  p_user_agent text default null,
  p_context jsonb default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_headers jsonb := coalesce(current_setting('request.headers', true), '{}')::jsonb;
  v_ip text;
begin
  v_ip := coalesce(
    nullif(split_part(coalesce(v_headers ->> 'x-forwarded-for', ''), ',', 1), ''),
    nullif(v_headers ->> 'cf-connecting-ip', ''),
    nullif(v_headers ->> 'x-real-ip', '')
  );
  v_ip := md5(coalesce(v_ip, 'unknown'));

  if (
    select count(*) from public.client_errors e
    where e.ip_hash = v_ip
      and e.created_at > now() - interval '1 hour'
  ) >= 20 then
    return;
  end if;

  insert into public.client_errors (
    message, stack, url, user_agent, email, context, ip_hash
  )
  values (
    left(coalesce(nullif(trim(p_message), ''), 'Bilinmeyen hata'), 500),
    left(p_stack, 4000),
    left(p_url, 500),
    left(p_user_agent, 300),
    nullif(auth.jwt() ->> 'email', ''),
    case when jsonb_typeof(p_context) = 'object' then p_context else null end,
    v_ip
  );
end;
$$;

revoke all on function public.log_client_error(text, text, text, text, jsonb) from public;
grant execute on function public.log_client_error(text, text, text, text, jsonb)
  to anon, authenticated;

-- ------------------------------------------------------------
-- 4b) E-posta varlığı sorgusu: saatlik IP sınırı
--     check_candidate_email, kayıtlı aday e-postalarını tek tek denemeye
--     açık bir sorgu oracle'ıydı. Artık IP başına saatte 60 sorgu.
-- ------------------------------------------------------------
create table if not exists public.access_throttle (
  kind text not null,
  ip_hash text not null,
  created_at timestamptz not null default now()
);

create index if not exists access_throttle_idx
  on public.access_throttle (kind, ip_hash, created_at desc);

alter table public.access_throttle enable row level security;
-- Policy yok: yalnızca aşağıdaki SECURITY DEFINER yardımcısı yazar.

create or replace function public.throttle_hit(
  p_kind text,
  p_limit integer,
  p_window interval
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_headers jsonb := coalesce(current_setting('request.headers', true), '{}')::jsonb;
  v_ip text;
  v_hash text;
begin
  v_ip := coalesce(
    nullif(split_part(coalesce(v_headers ->> 'x-forwarded-for', ''), ',', 1), ''),
    nullif(v_headers ->> 'cf-connecting-ip', ''),
    nullif(v_headers ->> 'x-real-ip', '')
  );
  v_hash := md5(coalesce(v_ip, 'unknown') || '|' || p_kind);

  if (
    select count(*) from public.access_throttle t
    where t.kind = p_kind
      and t.ip_hash = v_hash
      and t.created_at > now() - p_window
  ) >= p_limit then
    raise exception 'RATE_LIMIT';
  end if;

  insert into public.access_throttle (kind, ip_hash) values (p_kind, v_hash);
  delete from public.access_throttle where created_at < now() - interval '2 days';
end;
$$;

revoke all on function public.throttle_hit(text, integer, interval) from public, anon, authenticated;

create or replace function public.check_candidate_email(p_email text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
begin
  perform public.throttle_hit('email-check', 60, interval '1 hour');

  if char_length(v_email) < 5 or char_length(v_email) > 254 then
    return false;
  end if;

  return exists (select 1 from public.attempts a where lower(a.email) = v_email)
      or exists (select 1 from public.exam_assignments s where lower(s.email) = v_email);
end;
$$;

revoke all on function public.check_candidate_email(text) from public;
grant execute on function public.check_candidate_email(text) to anon, authenticated;
-- Depolama (kova/politika) değişiklikleri 20261106_storage_hardening.sql
-- dosyasındadır: hosted Supabase'de storage.objects tablosunun sahibi
-- supabase_storage_admin olduğu için o DDL ayrı çalıştırılmalıdır.

-- PostgREST şema önbelleği yeni imzaları hemen görsün.
notify pgrst, 'reload schema';
