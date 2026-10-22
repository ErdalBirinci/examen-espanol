-- ============================================================
--  Examen de Español — migration 6
--  Atamaya özel süre ve sonuç görünürlüğü
--  Idempotent: tekrar çalıştırmak güvenli.
-- ============================================================

alter table public.exam_assignments
  add column if not exists duration_minutes integer
    check (duration_minutes is null or duration_minutes between 10 and 240);

alter table public.exam_assignments
  add column if not exists results_visible boolean not null default true;

-- ------------------------------------------------------------
-- Adayın kendi atamaları: yeni alanlarla
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
        'duration_minutes', s.duration_minutes,
        'results_visible', s.results_visible,
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
-- Sonuç sorgusu: görünürlük kapalıysa puanlar gizlenir
-- ------------------------------------------------------------
create or replace function public.lookup_attempt_result(p_code text, p_email text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_code text := lower(trim(coalesce(p_code, '')));
  v_email text := lower(trim(coalesce(p_email, '')));
  v_row jsonb;
begin
  if v_code !~ '^[0-9a-f]{8}$' then
    raise exception 'INVALID_CODE';
  end if;
  if char_length(v_email) < 5 or char_length(v_email) > 254 then
    raise exception 'INVALID_EMAIL';
  end if;

  select to_jsonb(r) into v_row from (
    select
      upper(substr(a.id::text, 1, 8)) as reference,
      a.full_name,
      a.level,
      a.status,
      a.submitted_at,
      coalesce(s.results_visible, true) as results_visible,
      case when coalesce(s.results_visible, true) then a.mc_correct else null end as mc_correct,
      case when coalesce(s.results_visible, true) then a.mc_total else null end as mc_total,
      case when coalesce(s.results_visible, true) then round(a.listening_score)::int else null end as listening_score,
      case when coalesce(s.results_visible, true) then round(a.writing_score)::int else null end as writing_score,
      case when coalesce(s.results_visible, true) then round(a.speaking_score)::int else null end as speaking_score,
      case
        when not coalesce(s.results_visible, true) then null
        when a.mc_total > 0
          and a.listening_score is not null
          and a.writing_score is not null
          and a.speaking_score is not null
        then round(
          (a.mc_correct::numeric / a.mc_total) * 40
          + a.listening_score * 0.2
          + a.writing_score * 0.2
          + a.speaking_score * 0.2
        )::int
        else null
      end as total_score
    from public.attempts a
    left join public.exam_assignments s on s.id = a.assignment_id
    where a.email = v_email
      and a.id::text like v_code || '%'
    limit 1
  ) r;

  return v_row;
end;
$$;

revoke all on function public.lookup_attempt_result(text, text) from public;
grant execute on function public.lookup_attempt_result(text, text) to anon, authenticated;
