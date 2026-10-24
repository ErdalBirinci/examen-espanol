-- ============================================================
--  Examen de Español — migration 13
--  Operasyon katmanı:
--   1) Filtre/sıralama indeksleri
--   2) Rubrik + denetim izi kolonları
--   3) Rubrik doğrulamalı yönetici değerlendirmesi
--   4) Panel özet RPC'si
--   5) Soru sürüm geçmişi
--   6) İstemci hata kaydı
--   7) Deneme (alıştırma) modu
--   8) Sınav bütünlüğü kaydı
--  Idempotent: tekrar çalıştırmak güvenli.
-- ============================================================

-- ------------------------------------------------------------
-- 1) İndeksler: liste, kuyruk ve dışa aktarma sorguları için
-- ------------------------------------------------------------
create index if not exists attempts_status_created_idx
  on public.attempts (status, created_at desc);
create index if not exists attempts_level_status_idx
  on public.attempts (level, status);
create index if not exists attempts_email_lower_idx
  on public.attempts (lower(email));
create index if not exists attempts_assignment_idx
  on public.attempts (assignment_id);
create index if not exists attempts_submitted_idx
  on public.attempts (submitted_at desc);
create index if not exists exam_assignments_level_idx
  on public.exam_assignments (level, created_at desc);

-- ------------------------------------------------------------
-- 2) Rubrik ve denetim kolonları
-- ------------------------------------------------------------
alter table public.attempts
  add column if not exists writing_rubric jsonb,
  add column if not exists speaking_rubric jsonb,
  add column if not exists graded_by uuid,
  add column if not exists graded_at timestamptz,
  add column if not exists integrity jsonb;

create table if not exists public.grading_audit (
  id bigint generated always as identity primary key,
  attempt_id uuid not null references public.attempts (id) on delete cascade,
  actor_id uuid,
  actor_email text,
  action text not null,
  before jsonb,
  after jsonb,
  created_at timestamptz not null default now()
);

create index if not exists grading_audit_attempt_idx
  on public.grading_audit (attempt_id, created_at desc);

alter table public.grading_audit enable row level security;

drop policy if exists "grading audit admin read" on public.grading_audit;
create policy "grading audit admin read" on public.grading_audit
  for select to authenticated
  using (public.is_admin());

-- INSERT ve UPDATE ayrı fonksiyonlar: bir INSERT trigger'ında OLD kaydına
-- erişmek "record OLD is not assigned yet" hatası üretebilir.
create or replace function public.log_attempt_submitted()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.grading_audit (
    attempt_id, actor_id, actor_email, action, before, after
  )
  values (
    new.id,
    auth.uid(),
    nullif(auth.jwt() ->> 'email', ''),
    'submitted',
    null,
    jsonb_build_object(
      'status', new.status,
      'total_score', new.total_score
    )
  );
  return new;
end;
$$;

create or replace function public.log_attempt_graded()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.grading_audit (
    attempt_id, actor_id, actor_email, action, before, after
  )
  values (
    new.id,
    auth.uid(),
    nullif(auth.jwt() ->> 'email', ''),
    case
      when new.status = 'graded' and coalesce(old.status, '') <> 'graded' then 'graded'
      else 'updated'
    end,
    jsonb_build_object(
      'writing_part1_score', old.writing_part1_score,
      'writing_part2_score', old.writing_part2_score,
      'speaking_score', old.speaking_score,
      'writing_score', old.writing_score,
      'total_score', old.total_score,
      'status', old.status,
      'admin_note', old.admin_note,
      'writing_rubric', old.writing_rubric,
      'speaking_rubric', old.speaking_rubric
    ),
    jsonb_build_object(
      'writing_part1_score', new.writing_part1_score,
      'writing_part2_score', new.writing_part2_score,
      'speaking_score', new.speaking_score,
      'writing_score', new.writing_score,
      'total_score', new.total_score,
      'status', new.status,
      'admin_note', new.admin_note,
      'writing_rubric', new.writing_rubric,
      'speaking_rubric', new.speaking_rubric
    )
  );
  return new;
end;
$$;

drop trigger if exists attempts_grading_audit_insert on public.attempts;
create trigger attempts_grading_audit_insert
  after insert on public.attempts
  for each row execute function public.log_attempt_submitted();

drop trigger if exists attempts_grading_audit on public.attempts;
create trigger attempts_grading_audit
  after update of
    writing_part1_score, writing_part2_score, speaking_score,
    admin_note, status, writing_rubric, speaking_rubric
  on public.attempts
  for each row execute function public.log_attempt_graded();

-- ------------------------------------------------------------
-- 3) Rubrik yardımcıları + yönetici değerlendirmesi
-- ------------------------------------------------------------
create or replace function public.rubric_total(p_rubric jsonb, p_keys text[])
returns numeric
language sql
immutable
as $$
  select coalesce(
    sum(greatest(0, least(5, coalesce((p_rubric ->> k)::numeric, 0)))),
    0
  )
  from unnest(p_keys) as k;
$$;

drop function if exists public.admin_grade_attempt(uuid, numeric, numeric, numeric, text);

create or replace function public.admin_grade_attempt(
  p_attempt_id uuid,
  p_writing_part1 numeric,
  p_writing_part2 numeric,
  p_speaking numeric,
  p_note text,
  p_writing_rubric jsonb default null,
  p_speaking_rubric jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attempt public.attempts%rowtype;
  v_actor uuid := auth.uid();
begin
  if not public.is_admin() then
    raise exception 'UNAUTHORIZED';
  end if;

  if p_writing_part1 is null or p_writing_part2 is null or p_speaking is null then
    raise exception 'INCOMPLETE_GRADING';
  end if;
  if p_writing_part1 < 0 or p_writing_part1 > 10
     or p_writing_part2 < 0 or p_writing_part2 > 10 then
    raise exception 'INVALID_WRITING_SCORE';
  end if;
  if p_speaking < 0 or p_speaking > 20 then
    raise exception 'INVALID_SPEAKING_SCORE';
  end if;

  -- Rubrik verilmişse puanlar rubrik toplamıyla birebir eşleşmeli.
  if p_writing_rubric is not null then
    if public.rubric_total(p_writing_rubric -> 'part1', array['task', 'language'])
         <> p_writing_part1
       or public.rubric_total(p_writing_rubric -> 'part2', array['task', 'language'])
         <> p_writing_part2 then
      raise exception 'RUBRIC_MISMATCH';
    end if;
  end if;

  if p_speaking_rubric is not null then
    if public.rubric_total(
         p_speaking_rubric,
         array['fluency', 'pronunciation', 'vocabulary', 'grammar']
       ) <> p_speaking then
      raise exception 'RUBRIC_MISMATCH';
    end if;
  end if;

  select * into v_attempt
  from public.attempts a
  where a.id = p_attempt_id
  for update;

  if not found then
    raise exception 'ATTEMPT_NOT_FOUND';
  end if;
  if v_attempt.scoring_version < 2 then
    raise exception 'LEGACY_ATTEMPT';
  end if;

  update public.attempts
  set writing_part1_score = p_writing_part1,
      writing_part2_score = p_writing_part2,
      speaking_score = p_speaking,
      admin_note = nullif(trim(coalesce(p_note, '')), ''),
      writing_rubric = p_writing_rubric,
      speaking_rubric = p_speaking_rubric,
      graded_by = v_actor,
      graded_at = now(),
      status = 'graded'
  where id = p_attempt_id
  returning * into v_attempt;

  return jsonb_build_object(
    'status', v_attempt.status,
    'writing_score', v_attempt.writing_score,
    'speaking_score', v_attempt.speaking_score,
    'total_score', v_attempt.total_score
  );
end;
$$;

revoke all on function public.admin_grade_attempt(uuid, numeric, numeric, numeric, text, jsonb, jsonb)
  from public, anon;
grant execute on function public.admin_grade_attempt(uuid, numeric, numeric, numeric, text, jsonb, jsonb)
  to authenticated;

-- ------------------------------------------------------------
-- 4) Panel özeti: tek çağrıda sayaçlar ve ortalamalar
-- ------------------------------------------------------------
create or replace function public.admin_dashboard_summary()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_attempts jsonb;
  v_levels jsonb;
  v_content jsonb;
begin
  if not public.is_admin() then
    raise exception 'UNAUTHORIZED';
  end if;

  select jsonb_build_object(
    'total', count(*),
    'pending', count(*) filter (where status <> 'graded'),
    'graded', count(*) filter (where status = 'graded'),
    'last7', count(*) filter (where created_at > now() - interval '7 days'),
    'avg_total', round(avg(total_score) filter (where total_score is not null), 1),
    'passed', count(*) filter (where total_score >= 60),
    'awaiting_email', count(*) filter (
      where status = 'graded' and result_notified_at is null
    )
  )
  into v_attempts
  from public.attempts;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'level', l.level,
        'attempts', coalesce(s.attempts, 0),
        'pending', coalesce(s.pending, 0),
        'avg_total', s.avg_total
      )
      order by l.level
    ),
    '[]'::jsonb
  )
  into v_levels
  from (values ('A1'), ('A2'), ('B1'), ('B2'), ('C1'), ('C2')) as l(level)
  left join (
    select a.level,
           count(*)::int as attempts,
           count(*) filter (where a.status <> 'graded')::int as pending,
           round(avg(a.total_score) filter (where a.total_score is not null), 1) as avg_total
    from public.attempts a
    group by a.level
  ) s on s.level = l.level;

  select jsonb_build_object(
    'questions', (select count(*) from public.questions),
    'listening', (select count(*) from public.listening_items),
    'writing', (select count(*) from public.writing_prompts),
    'speaking', (select count(*) from public.speaking_prompts)
  )
  into v_content;

  return jsonb_build_object(
    'attempts', v_attempts,
    'levels', v_levels,
    'content', v_content
  );
end;
$$;

revoke all on function public.admin_dashboard_summary() from public, anon;
grant execute on function public.admin_dashboard_summary() to authenticated;

-- ------------------------------------------------------------
-- 5) Soru sürüm geçmişi
-- ------------------------------------------------------------
create table if not exists public.question_revisions (
  id bigint generated always as identity primary key,
  question_id uuid not null,
  level text,
  prompt text,
  options jsonb,
  correct_index integer,
  explanation text,
  position integer,
  action text not null,
  actor_email text,
  created_at timestamptz not null default now()
);

create index if not exists question_revisions_question_idx
  on public.question_revisions (question_id, created_at desc);

alter table public.question_revisions enable row level security;

drop policy if exists "question revisions admin read" on public.question_revisions;
create policy "question revisions admin read" on public.question_revisions
  for select to authenticated
  using (public.is_admin());

create or replace function public.log_question_revision()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.questions%rowtype;
begin
  if tg_op = 'DELETE' then
    v_row := old;
  else
    v_row := new;
  end if;

  insert into public.question_revisions (
    question_id, level, prompt, options, correct_index, explanation, position,
    action, actor_email
  )
  values (
    v_row.id,
    v_row.level,
    v_row.prompt,
    v_row.options,
    v_row.correct_index,
    v_row.explanation,
    v_row.position,
    case tg_op when 'INSERT' then 'created' when 'DELETE' then 'deleted' else 'updated' end,
    nullif(auth.jwt() ->> 'email', '')
  );

  return v_row;
end;
$$;

drop trigger if exists questions_revision_log on public.questions;
create trigger questions_revision_log
  after insert or update or delete on public.questions
  for each row execute function public.log_question_revision();

-- ------------------------------------------------------------
-- 6) İstemci hata kaydı
-- ------------------------------------------------------------
create table if not exists public.client_errors (
  id bigint generated always as identity primary key,
  message text not null,
  stack text,
  url text,
  user_agent text,
  email text,
  context jsonb,
  created_at timestamptz not null default now()
);

create index if not exists client_errors_created_idx
  on public.client_errors (created_at desc);

alter table public.client_errors enable row level security;

drop policy if exists "client errors admin read" on public.client_errors;
create policy "client errors admin read" on public.client_errors
  for select to authenticated
  using (public.is_admin());

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
begin
  insert into public.client_errors (message, stack, url, user_agent, email, context)
  values (
    left(coalesce(nullif(trim(p_message), ''), 'Bilinmeyen hata'), 500),
    left(p_stack, 4000),
    left(p_url, 500),
    left(p_user_agent, 300),
    nullif(auth.jwt() ->> 'email', ''),
    case when jsonb_typeof(p_context) = 'object' then p_context else null end
  );
end;
$$;

revoke all on function public.log_client_error(text, text, text, text, jsonb) from public;
grant execute on function public.log_client_error(text, text, text, text, jsonb)
  to anon, authenticated;

-- ------------------------------------------------------------
-- 7) Deneme (alıştırma) modu: cevaplar sınav öncesi gizli
-- ------------------------------------------------------------
create or replace function public.practice_bundle(p_level text, p_count integer default 10)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_count integer := greatest(1, least(coalesce(p_count, 10), 50));
  v_questions jsonb;
begin
  if p_level not in ('A1', 'A2', 'B1', 'B2', 'C1', 'C2') then
    raise exception 'INVALID_LEVEL';
  end if;

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
  from (
    select * from public.questions
    where level = p_level
    order by random()
    limit v_count
  ) q;

  return jsonb_build_object('level', p_level, 'questions', v_questions);
end;
$$;

revoke all on function public.practice_bundle(text, integer) from public;
grant execute on function public.practice_bundle(text, integer) to anon, authenticated;

create or replace function public.practice_check(p_answers jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_answers jsonb := coalesce(p_answers, '{}'::jsonb);
  v_result jsonb;
begin
  if jsonb_typeof(v_answers) <> 'object' then
    raise exception 'INVALID_ANSWERS';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', q.id,
        'correct_index', q.correct_index,
        'chosen', case
          when (v_answers ->> q.id::text) ~ '^[0-9]+$'
          then (v_answers ->> q.id::text)::int
          else null
        end,
        'correct', (v_answers ->> q.id::text) ~ '^[0-9]+$'
          and (v_answers ->> q.id::text)::int = q.correct_index
      )
    ),
    '[]'::jsonb
  )
  into v_result
  from public.questions q
  where v_answers ? q.id::text;

  return v_result;
end;
$$;

revoke all on function public.practice_check(jsonb) from public;
grant execute on function public.practice_check(jsonb) to anon, authenticated;

-- ------------------------------------------------------------
-- 8) Sınav bütünlüğü: gönderim sonrası kısa pencerede kayıt
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
begin
  if jsonb_typeof(coalesce(p_integrity, '{}'::jsonb)) <> 'object' then
    raise exception 'INVALID_INTEGRITY';
  end if;

  update public.attempts
  set integrity = left(coalesce(p_integrity, '{}'::jsonb)::text, 4000)::jsonb
  where id = p_attempt_id
    and created_at > now() - interval '30 minutes';
end;
$$;

revoke all on function public.record_attempt_integrity(uuid, jsonb) from public;
grant execute on function public.record_attempt_integrity(uuid, jsonb) to anon, authenticated;
