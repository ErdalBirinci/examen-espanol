-- ============================================================
--  Examen de Español — migration 10
--  Yeni puanlama ve rastgele sınav
--
--  Puan yapısı (toplam 100):
--    Test       50 soru × 1 puan  → 50
--    Dinleme    10 soru × 1 puan  → 10
--    Yazma      2 bölüm × 10 puan → 20
--    Konuşma    tek değerlendirme → 20
--
--  - Her adaya havuzdan rastgele test soruları seçilir.
--  - Dinleme bölümü, adminin ses kaydına eklediği çoktan seçmeli
--    sorulardan oluşur; doğru cevaplar sunucuda saklanır.
--  - Yazma iki ayrı konudan oluşur.
--  - Eski (scoring_version = 1) kayıtlar eski ağırlıklı formülle
--    okunmaya devam eder.
--  Idempotent: tekrar çalıştırmak güvenli.
-- ============================================================

-- ------------------------------------------------------------
-- 1) Dinleme soruları
-- ------------------------------------------------------------
create table if not exists public.listening_questions (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.listening_items (id) on delete cascade,
  prompt text not null,
  options jsonb not null,
  correct_index smallint not null check (correct_index between 0 and 5),
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists listening_questions_item_idx
  on public.listening_questions (item_id, position);

alter table public.listening_questions enable row level security;

drop policy if exists "listening questions admin" on public.listening_questions;
create policy "listening questions admin" on public.listening_questions
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create or replace view public.listening_questions_public
with (security_invoker = false) as
  select id, item_id, prompt, options, position
  from public.listening_questions;

revoke all on public.listening_questions_public from anon, authenticated;
grant select on public.listening_questions_public to anon, authenticated;

-- Adaylar dinleme kaydını görür ama değerlendirme transkriptini görmez.
drop policy if exists "listening public read" on public.listening_items;

create or replace view public.listening_items_public
with (security_invoker = false) as
  select id, level, title, audio_path, max_plays, position, created_at
  from public.listening_items;

revoke all on public.listening_items_public from anon, authenticated;
grant select on public.listening_items_public to anon, authenticated;

-- ------------------------------------------------------------
-- 2) Yazma: iki bölüm
-- ------------------------------------------------------------
alter table public.writing_prompts
  add column if not exists part smallint not null default 1;

-- Aynı seviyede ikinci konu varsa onu 2. bölüm yap.
with ranked as (
  select id,
         row_number() over (
           partition by level
           order by position, created_at
         ) as rn
  from public.writing_prompts
)
update public.writing_prompts w
set part = 2
from ranked r
where w.id = r.id
  and r.rn = 2
  and w.part = 1;

-- ------------------------------------------------------------
-- 3) Taslak: atama ve sabit soru seti
-- ------------------------------------------------------------
alter table public.exam_drafts
  add column if not exists assignment_id uuid
    references public.exam_assignments (id) on delete set null;
alter table public.exam_drafts
  add column if not exists test_question_ids uuid[] not null default '{}';
alter table public.exam_drafts
  add column if not exists listening_item_id uuid
    references public.listening_items (id) on delete set null;
alter table public.exam_drafts
  add column if not exists listening_question_ids uuid[] not null default '{}';
alter table public.exam_drafts
  add column if not exists writing_text_2 text not null default '';

-- Eski taslaklara da bir set ver; aksi halde açılamazlar.
update public.exam_drafts d
set test_question_ids = coalesce(
  (
    select array_agg(q.id)
    from (
      select id from public.questions
      where level = d.level
      order by random()
      limit 50
    ) q
  ),
  '{}'::uuid[]
)
where coalesce(array_length(d.test_question_ids, 1), 0) = 0;

update public.exam_drafts d
set listening_item_id = coalesce(
  (
    select i.id
    from public.listening_items i
    where i.level = d.level
      and exists (
        select 1 from public.listening_questions q where q.item_id = i.id
      )
    order by random()
    limit 1
  ),
  (
    select i.id
    from public.listening_items i
    where i.level = d.level
    order by i.position
    limit 1
  )
)
where d.listening_item_id is null;

update public.exam_drafts d
set listening_question_ids = coalesce(
  (
    select array_agg(q.id)
    from (
      select id from public.listening_questions
      where item_id = d.listening_item_id
      order by random()
      limit 10
    ) q
  ),
  '{}'::uuid[]
)
where d.listening_item_id is not null
  and coalesce(array_length(d.listening_question_ids, 1), 0) = 0;

-- ------------------------------------------------------------
-- 4) Sınav kaydı: yeni puan alanları
-- ------------------------------------------------------------
alter table public.attempts
  add column if not exists scoring_version smallint not null default 1;
alter table public.attempts
  add column if not exists test_question_ids uuid[];
alter table public.attempts
  add column if not exists listening_question_ids uuid[];
alter table public.attempts
  add column if not exists mc_score numeric;
alter table public.attempts
  add column if not exists listening_correct integer;
alter table public.attempts
  add column if not exists listening_total integer;
alter table public.attempts
  add column if not exists writing_text_2 text;
alter table public.attempts
  add column if not exists writing_part1_score numeric;
alter table public.attempts
  add column if not exists writing_part2_score numeric;
alter table public.attempts
  add column if not exists total_score numeric;

-- ------------------------------------------------------------
-- 5) Sunucu tarafı puanlama
--    v2: test 50, dinleme 10, yazma iki bölüm (20), konuşma 20.
--    v1: eski ağırlıklı formül (geriye dönük uyumluluk).
-- ------------------------------------------------------------
create or replace function public.score_attempt()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  answers jsonb := coalesce(new.mc_answers, '{}'::jsonb);
  listening jsonb := coalesce(new.listening_answers, '{}'::jsonb);
begin
  if new.scoring_version >= 2 then
    new.mc_total := coalesce(array_length(new.test_question_ids, 1), 0);
    new.mc_correct := 0;

    if new.mc_total > 0 then
      select count(*)::int into new.mc_correct
      from public.questions q
      where q.id = any(new.test_question_ids)
        and answers ? q.id::text
        and (answers ->> q.id::text) ~ '^[0-9]+$'
        and (answers ->> q.id::text)::int = q.correct_index;

      new.mc_score := round(new.mc_correct::numeric * 50 / new.mc_total, 1);
    else
      new.mc_score := 0;
    end if;

    new.listening_total := coalesce(array_length(new.listening_question_ids, 1), 0);
    new.listening_correct := 0;

    if new.listening_total > 0 then
      select count(*)::int into new.listening_correct
      from public.listening_questions q
      where q.id = any(new.listening_question_ids)
        and listening ? q.id::text
        and (listening ->> q.id::text) ~ '^[0-9]+$'
        and (listening ->> q.id::text)::int = q.correct_index;

      new.listening_score := round(new.listening_correct::numeric * 10 / new.listening_total, 1);
    else
      new.listening_score := 0;
    end if;

    if new.writing_part1_score is null and new.writing_part2_score is null then
      new.writing_score := null;
    else
      new.writing_score := coalesce(new.writing_part1_score, 0)
        + coalesce(new.writing_part2_score, 0);
    end if;

    if new.mc_score is not null
       and new.listening_score is not null
       and new.writing_score is not null
       and new.speaking_score is not null then
      new.total_score := round(
        new.mc_score + new.listening_score + new.writing_score + new.speaking_score,
        1
      );
    else
      new.total_score := null;
    end if;
  else
    -- Eski kayıtlar: test yüzdesi, seviyedeki tüm sorular üzerinden.
    select count(*) into new.mc_total
    from public.questions q
    where q.level = new.level;

    select count(*) into new.mc_correct
    from public.questions q
    where q.level = new.level
      and answers ? q.id::text
      and (answers ->> q.id::text) ~ '^[0-9]+$'
      and (answers ->> q.id::text)::int = q.correct_index;
  end if;

  return new;
end;
$$;

drop trigger if exists attempts_score on public.attempts;
create trigger attempts_score
  before insert or update on public.attempts
  for each row execute function public.score_attempt();

-- Toplam puan: v2'de kayıtlı, v1'de eski ağırlıklı formül.
create or replace function public.attempt_total(a public.attempts)
returns numeric
language sql
stable
as $$
  select case
    when a.scoring_version >= 2 then a.total_score
    when a.mc_total is not null
      and a.mc_total > 0
      and a.listening_score is not null
      and a.writing_score is not null
      and a.speaking_score is not null
    then round(
      (a.mc_correct::numeric / a.mc_total) * 40
      + a.listening_score * 0.2
      + a.writing_score * 0.2
      + a.speaking_score * 0.2
    )
    else null
  end;
$$;

-- ------------------------------------------------------------
-- 6) Taslak başlat: rastgele soru seti seç
-- ------------------------------------------------------------
drop function if exists public.start_exam_draft(text, text, text);

create or replace function public.start_exam_draft(
  p_level text,
  p_full_name text,
  p_email text,
  p_assignment_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text := trim(coalesce(p_full_name, ''));
  v_email text := lower(trim(coalesce(p_email, '')));
  v_assignment public.exam_assignments%rowtype;
  v_id uuid;
  v_code text;
  v_started timestamptz;
  v_question_ids uuid[];
  v_listening_item uuid;
  v_listening_questions uuid[];
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

  if p_assignment_id is not null then
    select * into v_assignment
    from public.exam_assignments s
    where s.id = p_assignment_id;

    if not found then
      raise exception 'ASSIGNMENT_NOT_FOUND';
    end if;
    if lower(v_assignment.email) <> v_email then
      raise exception 'ASSIGNMENT_MISMATCH';
    end if;
    if v_assignment.level <> p_level then
      raise exception 'LEVEL_MISMATCH';
    end if;
    if exists (
      select 1 from public.attempts a where a.assignment_id = p_assignment_id
    ) then
      raise exception 'ALREADY_SUBMITTED';
    end if;
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

  -- Havuzdan rastgele 50 test sorusu.
  select coalesce(array_agg(q.id), '{}'::uuid[])
  into v_question_ids
  from (
    select id from public.questions
    where level = p_level
    order by random()
    limit 50
  ) q;

  -- Soruları olan bir dinleme kaydı; yoksa seviyenin ilk kaydı.
  select i.id into v_listening_item
  from public.listening_items i
  where i.level = p_level
    and exists (
      select 1 from public.listening_questions q where q.item_id = i.id
    )
  order by random()
  limit 1;

  if v_listening_item is null then
    select i.id into v_listening_item
    from public.listening_items i
    where i.level = p_level
    order by i.position
    limit 1;
  end if;

  if v_listening_item is not null then
    select coalesce(array_agg(q.id), '{}'::uuid[])
    into v_listening_questions
    from (
      select id from public.listening_questions
      where item_id = v_listening_item
      order by random()
      limit 10
    ) q;
  else
    v_listening_questions := '{}'::uuid[];
  end if;

  insert into public.exam_drafts (
    full_name, email, level, assignment_id,
    test_question_ids, listening_item_id, listening_question_ids
  ) values (
    v_name, v_email, p_level, p_assignment_id,
    v_question_ids, v_listening_item, v_listening_questions
  )
  returning id, code, started_at into v_id, v_code, v_started;

  return jsonb_build_object(
    'token', v_id,
    'code', v_code,
    'started_at', v_started,
    'test_questions', coalesce(array_length(v_question_ids, 1), 0),
    'listening_questions', coalesce(array_length(v_listening_questions, 1), 0)
  );
end;
$$;

revoke all on function public.start_exam_draft(text, text, text, uuid) from public;
grant execute on function public.start_exam_draft(text, text, text, uuid) to anon, authenticated;

-- ------------------------------------------------------------
-- 7) Taslak okuma / kaydetme
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
    'writing_text', d.writing_text,
    'writing_text_2', d.writing_text_2
  ) into v_row
  from public.exam_drafts d
  where d.id = p_token;

  return v_row;
end;
$$;

revoke all on function public.get_exam_draft(uuid) from public;
grant execute on function public.get_exam_draft(uuid) to anon, authenticated;

drop function if exists public.save_exam_draft(uuid, jsonb, jsonb, text);

create or replace function public.save_exam_draft(
  p_token uuid,
  p_mc_answers jsonb,
  p_listening_answers jsonb,
  p_writing_text text,
  p_writing_text_2 text
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
  if p_writing_text_2 is not null and char_length(p_writing_text_2) > 20000 then
    raise exception 'WRITING_TOO_LONG';
  end if;

  update public.exam_drafts
  set mc_answers = coalesce(p_mc_answers, '{}'::jsonb),
      listening_answers = coalesce(p_listening_answers, '{}'::jsonb),
      writing_text = coalesce(p_writing_text, ''),
      writing_text_2 = coalesce(p_writing_text_2, ''),
      updated_at = now()
  where id = p_token;

  if not found then
    raise exception 'DRAFT_NOT_FOUND';
  end if;
end;
$$;

revoke all on function public.save_exam_draft(uuid, jsonb, jsonb, text, text) from public;
grant execute on function public.save_exam_draft(uuid, jsonb, jsonb, text, text) to anon, authenticated;

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
    'writing_text', d.writing_text,
    'writing_text_2', d.writing_text_2
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
-- 8) Sınav içeriği: yalnızca bu taslağın soru seti
-- ------------------------------------------------------------
create or replace function public.exam_bundle(p_token uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_draft public.exam_drafts%rowtype;
  v_questions jsonb;
  v_listening jsonb;
  v_writing jsonb;
  v_speaking jsonb;
  v_settings jsonb;
  v_item jsonb;
  v_listening_questions jsonb;
begin
  select * into v_draft
  from public.exam_drafts d
  where d.id = p_token;

  if not found then
    raise exception 'DRAFT_NOT_FOUND';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', q.id,
        'level', q.level,
        'prompt', q.prompt,
        'options', q.options,
        'position', q.position
      )
      order by t.ord
    ),
    '[]'::jsonb
  )
  into v_questions
  from unnest(v_draft.test_question_ids) with ordinality as t(question_id, ord)
  join public.questions q on q.id = t.question_id;

  if v_draft.listening_item_id is not null then
    select jsonb_build_object(
      'id', i.id,
      'level', i.level,
      'title', i.title,
      'audio_path', i.audio_path,
      'max_plays', i.max_plays,
      'position', i.position
    )
    into v_item
    from public.listening_items i
    where i.id = v_draft.listening_item_id;

    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', q.id,
          'item_id', q.item_id,
          'prompt', q.prompt,
          'options', q.options,
          'position', q.position
        )
        order by t.ord
      ),
      '[]'::jsonb
    )
    into v_listening_questions
    from unnest(v_draft.listening_question_ids) with ordinality as t(question_id, ord)
    join public.listening_questions q on q.id = t.question_id;

    v_listening := jsonb_build_object(
      'item', v_item,
      'questions', v_listening_questions
    );
  else
    v_listening := null;
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', w.id,
        'level', w.level,
        'prompt', w.prompt,
        'min_words', w.min_words,
        'position', w.position,
        'part', w.part
      )
      order by w.part, w.position
    ),
    '[]'::jsonb
  )
  into v_writing
  from (
    select * from public.writing_prompts
    where level = v_draft.level
    order by part, position
    limit 2
  ) w;

  select jsonb_build_object(
    'id', s.id,
    'level', s.level,
    'prompt', s.prompt,
    'guidance', s.guidance,
    'prep_seconds', s.prep_seconds,
    'max_seconds', s.max_seconds,
    'position', s.position
  )
  into v_speaking
  from public.speaking_prompts s
  where s.level = v_draft.level
  order by s.position
  limit 1;

  select jsonb_build_object(
    'level', v_draft.level,
    'duration_minutes', coalesce(e.duration_minutes, 60)
  )
  into v_settings
  from public.exam_settings e
  where e.level = v_draft.level;

  v_settings := coalesce(
    v_settings,
    jsonb_build_object('level', v_draft.level, 'duration_minutes', 60)
  );

  return jsonb_build_object(
    'questions', v_questions,
    'listening', v_listening,
    'writing', v_writing,
    'speaking', v_speaking,
    'settings', v_settings
  );
end;
$$;

revoke all on function public.exam_bundle(uuid) from public;
grant execute on function public.exam_bundle(uuid) to anon, authenticated;

-- ------------------------------------------------------------
-- 9) Gönderim: taslak setiyle puanla
-- ------------------------------------------------------------
drop function if exists public.submit_attempt(text, text, text, jsonb, jsonb, text, text, integer, uuid);

create or replace function public.submit_attempt(
  p_level text,
  p_full_name text,
  p_email text,
  p_mc_answers jsonb,
  p_listening_answers jsonb,
  p_writing_text text,
  p_writing_text_2 text,
  p_speaking_path text,
  p_speaking_duration integer,
  p_assignment_id uuid,
  p_draft_token uuid
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
  v_draft public.exam_drafts%rowtype;
begin
  if p_assignment_id is null then
    raise exception 'ASSIGNMENT_REQUIRED';
  end if;
  if p_draft_token is null then
    raise exception 'DRAFT_REQUIRED';
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

  select * into v_draft
  from public.exam_drafts d
  where d.id = p_draft_token
  for update;

  if not found then
    raise exception 'DRAFT_NOT_FOUND';
  end if;
  if lower(v_draft.email) <> v_email then
    raise exception 'DRAFT_MISMATCH';
  end if;
  if v_draft.level <> p_level then
    raise exception 'LEVEL_MISMATCH';
  end if;
  if v_draft.assignment_id is not null and v_draft.assignment_id <> p_assignment_id then
    raise exception 'DRAFT_MISMATCH';
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
  if p_writing_text_2 is not null and char_length(p_writing_text_2) > 20000 then
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
    id, full_name, email, level, status, scoring_version,
    mc_answers, listening_answers,
    test_question_ids, listening_question_ids,
    writing_text, writing_text_2,
    speaking_path, speaking_duration, submitted_at, assignment_id
  ) values (
    v_id, v_name, v_email, p_level, 'submitted', 2,
    coalesce(p_mc_answers, '{}'::jsonb),
    coalesce(p_listening_answers, '{}'::jsonb),
    v_draft.test_question_ids,
    v_draft.listening_question_ids,
    nullif(trim(coalesce(p_writing_text, '')), ''),
    nullif(trim(coalesce(p_writing_text_2, '')), ''),
    p_speaking_path, p_speaking_duration, now(), p_assignment_id
  );

  return v_id;
end;
$$;

revoke all on function public.submit_attempt(
  text, text, text, jsonb, jsonb, text, text, text, integer, uuid, uuid
) from public;
grant execute on function public.submit_attempt(
  text, text, text, jsonb, jsonb, text, text, text, integer, uuid, uuid
) to authenticated;

-- ------------------------------------------------------------
-- 10) Yönetici değerlendirmesi (yazma 2 bölüm + konuşma)
-- ------------------------------------------------------------
create or replace function public.admin_grade_attempt(
  p_attempt_id uuid,
  p_writing_part1 numeric,
  p_writing_part2 numeric,
  p_speaking numeric,
  p_note text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attempt public.attempts%rowtype;
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

revoke all on function public.admin_grade_attempt(uuid, numeric, numeric, numeric, text) from public, anon;
grant execute on function public.admin_grade_attempt(uuid, numeric, numeric, numeric, text) to authenticated;

-- ------------------------------------------------------------
-- 11) Sonuç sorgusu: yeni alanlar
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
      a.scoring_version,
      case when coalesce(s.results_visible, true) then a.mc_correct else null end as mc_correct,
      case when coalesce(s.results_visible, true) then a.mc_total else null end as mc_total,
      case when coalesce(s.results_visible, true) then a.mc_score else null end as mc_score,
      case when coalesce(s.results_visible, true) then a.listening_score else null end as listening_score,
      case when coalesce(s.results_visible, true) then a.listening_correct else null end as listening_correct,
      case when coalesce(s.results_visible, true) then a.listening_total else null end as listening_total,
      case when coalesce(s.results_visible, true) then a.writing_score else null end as writing_score,
      case when coalesce(s.results_visible, true) then a.writing_part1_score else null end as writing_part1_score,
      case when coalesce(s.results_visible, true) then a.writing_part2_score else null end as writing_part2_score,
      case when coalesce(s.results_visible, true) then a.speaking_score else null end as speaking_score,
      case when coalesce(s.results_visible, true) then public.attempt_total(a) else null end as total_score
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

-- ------------------------------------------------------------
-- 12) Sertifikalar: yeni toplam puan
-- ------------------------------------------------------------
create or replace function public.issue_certificate(p_code text, p_email text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text := lower(trim(coalesce(p_code, '')));
  v_email text := lower(trim(coalesce(p_email, '')));
  v_attempt public.attempts%rowtype;
  v_visible boolean;
  v_total numeric;
  v_cert_code text;
  v_issued_at timestamptz;
begin
  if v_code !~ '^[0-9a-f]{8}$' then
    raise exception 'INVALID_CODE';
  end if;
  if char_length(v_email) < 5 or char_length(v_email) > 254 then
    raise exception 'INVALID_EMAIL';
  end if;

  select * into v_attempt
  from public.attempts a
  where a.email = v_email
    and a.id::text like v_code || '%'
  limit 1
  for update;

  if not found then
    raise exception 'CERTIFICATE_NOT_FOUND';
  end if;

  select coalesce(s.results_visible, true) into v_visible
  from public.exam_assignments s
  where s.id = v_attempt.assignment_id;
  v_visible := coalesce(v_visible, true);

  if not v_visible then
    raise exception 'CERTIFICATE_HIDDEN';
  end if;
  if v_attempt.status <> 'graded' then
    raise exception 'CERTIFICATE_NOT_READY';
  end if;

  v_total := public.attempt_total(v_attempt);

  if v_total is null then
    raise exception 'CERTIFICATE_NOT_READY';
  end if;
  if v_total < 60 then
    raise exception 'CERTIFICATE_NOT_ELIGIBLE';
  end if;

  update public.attempts a
  set certificate_code = coalesce(a.certificate_code, lower(encode(extensions.gen_random_bytes(8), 'hex'))),
      certificate_issued_at = coalesce(a.certificate_issued_at, now())
  where a.id = v_attempt.id
  returning a.certificate_code, a.certificate_issued_at into v_cert_code, v_issued_at;

  return jsonb_build_object(
    'code', v_cert_code,
    'full_name', v_attempt.full_name,
    'level', v_attempt.level,
    'total_score', round(v_total)::int,
    'submitted_at', v_attempt.submitted_at,
    'reference', upper(substr(v_attempt.id::text, 1, 8)),
    'issued_at', v_issued_at
  );
end;
$$;

revoke all on function public.issue_certificate(text, text) from public;
grant execute on function public.issue_certificate(text, text) to anon, authenticated;

create or replace function public.get_certificate(p_certificate text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_code text := lower(trim(coalesce(p_certificate, '')));
  v_row jsonb;
begin
  if v_code !~ '^[0-9a-f]{16}$' then
    return null;
  end if;

  select to_jsonb(r) into v_row from (
    select
      a.certificate_code as code,
      a.full_name,
      a.level,
      round(public.attempt_total(a))::int as total_score,
      a.submitted_at,
      upper(substr(a.id::text, 1, 8)) as reference,
      a.certificate_issued_at as issued_at
    from public.attempts a
    left join public.exam_assignments s on s.id = a.assignment_id
    where a.certificate_code = v_code
      and a.certificate_issued_at is not null
      and a.status = 'graded'
      and coalesce(s.results_visible, true)
      and public.attempt_total(a) is not null
      and public.attempt_total(a) >= 60
    limit 1
  ) r;

  return v_row;
end;
$$;

revoke all on function public.get_certificate(text) from public;
grant execute on function public.get_certificate(text) to anon, authenticated;

-- ------------------------------------------------------------
-- 13) İçerik istatistikleri: dinleme soruları ve 2 yazma hedefi
-- ------------------------------------------------------------
drop function if exists public.content_stats();

create function public.content_stats()
returns table (
  level text,
  questions integer,
  listening integer,
  listening_questions integer,
  writing integer,
  speaking integer
)
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
    (
      select count(*)::int
      from public.listening_questions q
      join public.listening_items i on i.id = q.item_id
      where i.level = l.level
    ),
    (select count(*)::int from public.writing_prompts w where w.level = l.level),
    (select count(*)::int from public.speaking_prompts s where s.level = l.level)
  from levels l;
end;
$$;

revoke all on function public.content_stats() from public;
grant execute on function public.content_stats() to authenticated;
