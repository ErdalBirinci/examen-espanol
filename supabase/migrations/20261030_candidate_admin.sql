-- ============================================================
--  Examen de Español — migration 8
--  Aday hesabı yönetimi
--  - Admin, kayıtlı aday hesaplarını listeleyebilir.
--  - Hesap, atama, taslak, sınav ve sertifika yaşam döngüsü
--    tek bir detay yanıtında döner.
--  - Admin hesabı devre dışı bırakabilir, oturumları kapatabilir
--    veya adayı tüm verileriyle silebilir.
--  - Yönetici hesapları bu listeye dahil edilmez.
--  Idempotent: tekrar çalıştırmak güvenli.
-- ============================================================

-- ------------------------------------------------------------
-- Aday listesi
-- ------------------------------------------------------------
create or replace function public.admin_list_candidates()
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
  latest_activity timestamptz
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
      )
    ) as latest_activity
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

-- ------------------------------------------------------------
-- Aday detayı: hesap + atamalar + sınavlar + taslaklar
-- ------------------------------------------------------------
create or replace function public.admin_candidate_detail(p_email text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_account jsonb;
  v_assignments jsonb;
  v_attempts jsonb;
  v_drafts jsonb;
begin
  if not public.is_admin() then
    raise exception 'UNAUTHORIZED';
  end if;

  select jsonb_build_object(
    'id', u.id,
    'email', u.email,
    'full_name', coalesce(
      nullif(trim(u.raw_user_meta_data ->> 'full_name'), ''),
      split_part(u.email, '@', 1)
    ),
    'created_at', u.created_at,
    'last_sign_in_at', u.last_sign_in_at,
    'email_confirmed_at', u.email_confirmed_at,
    'banned_until', u.banned_until,
    'sessions', (
      select count(*)::int
      from auth.sessions s
      where s.user_id = u.id
    )
  )
  into v_account
  from auth.users u
  where lower(u.email) = v_email
    and not exists (
      select 1 from public.profiles p where p.id = u.id
    )
  limit 1;

  if v_account is null then
    raise exception 'CANDIDATE_NOT_FOUND';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', a.id,
        'level', a.level,
        'title', a.title,
        'note', a.note,
        'due_at', a.due_at,
        'duration_minutes', a.duration_minutes,
        'results_visible', a.results_visible,
        'created_at', a.created_at,
        'attempt_id', t.id,
        'attempt_status', t.status,
        'submitted_at', t.submitted_at
      )
      order by a.created_at desc
    ),
    '[]'::jsonb
  )
  into v_assignments
  from public.exam_assignments a
  left join public.attempts t on t.assignment_id = a.id
  where lower(a.email) = v_email;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', t.id,
        'level', t.level,
        'status', t.status,
        'created_at', t.created_at,
        'submitted_at', t.submitted_at,
        'mc_correct', t.mc_correct,
        'mc_total', t.mc_total,
        'listening_score', t.listening_score,
        'writing_score', t.writing_score,
        'speaking_score', t.speaking_score,
        'certificate_code', t.certificate_code,
        'certificate_issued_at', t.certificate_issued_at,
        'result_notified_at', t.result_notified_at,
        'speaking_path', t.speaking_path
      )
      order by t.created_at desc
    ),
    '[]'::jsonb
  )
  into v_attempts
  from public.attempts t
  where lower(t.email) = v_email;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'code', d.code,
        'level', d.level,
        'started_at', d.started_at,
        'updated_at', d.updated_at,
        'answered', (
          select count(*)::int from jsonb_object_keys(d.mc_answers)
        ),
        'listening_answered', (
          select count(*)::int from jsonb_object_keys(d.listening_answers)
        ),
        'writing_chars', char_length(coalesce(d.writing_text, ''))
      )
      order by d.updated_at desc
    ),
    '[]'::jsonb
  )
  into v_drafts
  from public.exam_drafts d
  where lower(d.email) = v_email;

  return jsonb_build_object(
    'account', v_account,
    'assignments', v_assignments,
    'attempts', v_attempts,
    'drafts', v_drafts
  );
end;
$$;

revoke all on function public.admin_candidate_detail(text) from public, anon;
grant execute on function public.admin_candidate_detail(text) to authenticated;

-- ------------------------------------------------------------
-- Hesabı devre dışı bırak / yeniden aç
-- Devre dışı bırakırken açık oturumlar da kapatılır.
-- ------------------------------------------------------------
create or replace function public.admin_set_candidate_disabled(
  p_email text,
  p_disabled boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_id uuid;
  v_disabled boolean := coalesce(p_disabled, false);
begin
  if not public.is_admin() then
    raise exception 'UNAUTHORIZED';
  end if;

  select u.id into v_id
  from auth.users u
  where lower(u.email) = v_email
    and not exists (
      select 1 from public.profiles p where p.id = u.id
    )
  limit 1;

  if v_id is null then
    raise exception 'CANDIDATE_NOT_FOUND';
  end if;

  update auth.users
  set banned_until = case
        when v_disabled then now() + interval '100 years'
        else null
      end,
      updated_at = now()
  where id = v_id;

  if v_disabled then
    delete from auth.sessions where user_id = v_id;
  end if;

  return jsonb_build_object('disabled', v_disabled);
end;
$$;

revoke all on function public.admin_set_candidate_disabled(text, boolean) from public, anon;
grant execute on function public.admin_set_candidate_disabled(text, boolean) to authenticated;

-- ------------------------------------------------------------
-- Açık oturumları sonlandır
-- ------------------------------------------------------------
create or replace function public.admin_revoke_candidate_sessions(p_email text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_id uuid;
begin
  if not public.is_admin() then
    raise exception 'UNAUTHORIZED';
  end if;

  select u.id into v_id
  from auth.users u
  where lower(u.email) = v_email
    and not exists (
      select 1 from public.profiles p where p.id = u.id
    )
  limit 1;

  if v_id is null then
    raise exception 'CANDIDATE_NOT_FOUND';
  end if;

  delete from auth.refresh_tokens
  where session_id in (
    select id from auth.sessions where user_id = v_id
  );

  delete from auth.sessions where user_id = v_id;

  return jsonb_build_object('revoked', true);
end;
$$;

revoke all on function public.admin_revoke_candidate_sessions(text) from public, anon;
grant execute on function public.admin_revoke_candidate_sessions(text) to authenticated;

-- ------------------------------------------------------------
-- Adayı ve aday verilerini sil
-- Ses dosyaları istemci tarafından Storage'dan temizlenir;
-- bu fonksiyon veritabanı kayıtlarını ve Auth hesabını siler.
-- ------------------------------------------------------------
create or replace function public.admin_delete_candidate(p_email text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_id uuid;
begin
  if not public.is_admin() then
    raise exception 'UNAUTHORIZED';
  end if;

  select u.id into v_id
  from auth.users u
  where lower(u.email) = v_email
    and not exists (
      select 1 from public.profiles p where p.id = u.id
    )
  limit 1;

  if v_id is null then
    raise exception 'CANDIDATE_NOT_FOUND';
  end if;

  delete from public.exam_drafts where lower(email) = v_email;
  delete from public.attempts where lower(email) = v_email;
  delete from public.exam_assignments where lower(email) = v_email;
  delete from auth.users where id = v_id;

  return jsonb_build_object('deleted', true, 'email', v_email);
end;
$$;

revoke all on function public.admin_delete_candidate(text) from public, anon;
grant execute on function public.admin_delete_candidate(text) to authenticated;
