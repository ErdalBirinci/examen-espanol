-- ============================================================
--  Examen de Español — migration 11
--  Aday detayındaki sınav kayıtlarına yeni puan alanlarını ekler.
--  Idempotent: tekrar çalıştırmak güvenli.
-- ============================================================

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
        'scoring_version', t.scoring_version,
        'created_at', t.created_at,
        'submitted_at', t.submitted_at,
        'mc_correct', t.mc_correct,
        'mc_total', t.mc_total,
        'mc_score', t.mc_score,
        'listening_correct', t.listening_correct,
        'listening_total', t.listening_total,
        'listening_score', t.listening_score,
        'writing_score', t.writing_score,
        'writing_part1_score', t.writing_part1_score,
        'writing_part2_score', t.writing_part2_score,
        'speaking_score', t.speaking_score,
        'total_score', t.total_score,
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
          + char_length(coalesce(d.writing_text_2, ''))
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
