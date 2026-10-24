-- ============================================================
--  Examen de Español — migration 20
--  Dinleme sorularının sırası
--
--  Taslak başlatılırken dinleme soruları rastgele seçiliyor ve
--  rastgele sırayla saklanıyordu. Aday bu yüzden soruları admin
--  panelindeki sıradan farklı görüyordu.
--
--  1) start_exam_draft: soruları position sırasıyla seçer.
--  2) exam_bundle: sıra her zaman position (sonra created_at)
--     üzerinden kurulur; böylece eski taslaklar da düzelir.
--  Idempotent: tekrar çalıştırmak güvenli.
-- ============================================================

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
    -- Aday, soruları yöneticinin panelde gördüğü sırayla alır.
    select coalesce(array_agg(q.id), '{}'::uuid[])
    into v_listening_questions
    from (
      select id from public.listening_questions
      where item_id = v_listening_item
      order by position, created_at
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

revoke all on function public.start_exam_draft(text, text, text, uuid) from public, anon;
grant execute on function public.start_exam_draft(text, text, text, uuid) to authenticated;

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

    -- Admin panelindeki sıra: position, ardından created_at.
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', q.id,
          'item_id', q.item_id,
          'prompt', q.prompt,
          'options', q.options,
          'position', q.position
        )
        order by q.position nulls last, q.created_at
      ),
      '[]'::jsonb
    )
    into v_listening_questions
    from unnest(v_draft.listening_question_ids) as t(question_id)
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
        'part', w.part,
        'image_path', w.image_path
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

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', s.id,
        'level', s.level,
        'prompt', s.prompt,
        'guidance', s.guidance,
        'prep_seconds', s.prep_seconds,
        'max_seconds', s.max_seconds,
        'position', s.position,
        'part', s.part,
        'image_path', s.image_path
      )
      order by s.part, s.position
    ),
    '[]'::jsonb
  )
  into v_speaking
  from (
    select * from public.speaking_prompts
    where level = v_draft.level
    order by part, position
    limit 2
  ) s;

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

notify pgrst, 'reload schema';
