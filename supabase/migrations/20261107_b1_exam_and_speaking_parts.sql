-- ============================================================
--  Examen de Español — migration 16
--  B1 içeriği + iki bölümlü konuşma
--
--  1) Konuşma ve yazma konularına görsel alanı
--  2) Konuşma iki bölüm: 1. bölüm kayıt (10 puan), 2. bölüm
--     yönetici değerlendirmesi (10 puan)
--  3) Puanlama, rubrik ve denetim izi güncellemesi
--  4) exam_bundle: konuşma bölümleri dizisi + görseller
--  5) B1 dinleme (10 soru), yazma (2 görev) ve konuşma (2 bölüm)
--     içeriğinin yerleştirilmesi
--  Idempotent: tekrar çalıştırmak güvenli.
-- ============================================================

-- ------------------------------------------------------------
-- 1) Yeni kolonlar
-- ------------------------------------------------------------
alter table public.writing_prompts
  add column if not exists image_path text;

alter table public.speaking_prompts
  add column if not exists part smallint not null default 1,
  add column if not exists image_path text;

alter table public.attempts
  add column if not exists speaking_part1_score numeric,
  add column if not exists speaking_part2_score numeric;

-- Görseller de dinleme sesleriyle aynı herkese açık kovada tutulur.
update storage.buckets
set allowed_mime_types = array[
  'audio/mpeg','audio/mp3','audio/wav','audio/x-wav','audio/ogg',
  'audio/mp4','audio/x-m4a','audio/aac','audio/webm',
  'image/jpeg','image/png','image/webp'
]
where id = 'exam-media';

-- ------------------------------------------------------------
-- 2) Sunucu tarafı puanlama: konuşma iki bölümün toplamı
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

    -- Konuşma bölüm puanları girildiyse toplam onlardan hesaplanır.
    -- Bölümlerden önce puanlanmış kayıtların tek parça puanı korunur.
    if new.speaking_part1_score is not null or new.speaking_part2_score is not null then
      new.speaking_score := coalesce(new.speaking_part1_score, 0)
        + coalesce(new.speaking_part2_score, 0);
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

-- ------------------------------------------------------------
-- 3) Denetim izi: konuşma bölüm puanları da kayda girer
-- ------------------------------------------------------------
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
      'speaking_part1_score', old.speaking_part1_score,
      'speaking_part2_score', old.speaking_part2_score,
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
      'speaking_part1_score', new.speaking_part1_score,
      'speaking_part2_score', new.speaking_part2_score,
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

drop trigger if exists attempts_grading_audit on public.attempts;
create trigger attempts_grading_audit
  after update of
    writing_part1_score, writing_part2_score,
    speaking_part1_score, speaking_part2_score, speaking_score,
    admin_note, status, writing_rubric, speaking_rubric
  on public.attempts
  for each row execute function public.log_attempt_graded();

-- ------------------------------------------------------------
-- 4) Yönetici değerlendirmesi: 2 yazma + 2 konuşma bölümü
-- ------------------------------------------------------------
drop function if exists public.admin_grade_attempt(uuid, numeric, numeric, numeric, text, jsonb, jsonb);
drop function if exists public.admin_grade_attempt(uuid, numeric, numeric, numeric, numeric, text, jsonb, jsonb);

create or replace function public.admin_grade_attempt(
  p_attempt_id uuid,
  p_writing_part1 numeric,
  p_writing_part2 numeric,
  p_speaking_part1 numeric,
  p_speaking_part2 numeric,
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

  if p_writing_part1 is null or p_writing_part2 is null
     or p_speaking_part1 is null or p_speaking_part2 is null then
    raise exception 'INCOMPLETE_GRADING';
  end if;
  if p_writing_part1 < 0 or p_writing_part1 > 10
     or p_writing_part2 < 0 or p_writing_part2 > 10 then
    raise exception 'INVALID_WRITING_SCORE';
  end if;
  if p_speaking_part1 < 0 or p_speaking_part1 > 10
     or p_speaking_part2 < 0 or p_speaking_part2 > 10 then
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
    if public.rubric_total(p_speaking_rubric -> 'part1', array['content', 'language'])
         <> p_speaking_part1
       or public.rubric_total(p_speaking_rubric -> 'part2', array['content', 'language'])
         <> p_speaking_part2 then
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
      speaking_part1_score = p_speaking_part1,
      speaking_part2_score = p_speaking_part2,
      speaking_score = p_speaking_part1 + p_speaking_part2,
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
    'speaking_part1_score', v_attempt.speaking_part1_score,
    'speaking_part2_score', v_attempt.speaking_part2_score,
    'speaking_score', v_attempt.speaking_score,
    'total_score', v_attempt.total_score
  );
end;
$$;

revoke all on function public.admin_grade_attempt(
  uuid, numeric, numeric, numeric, numeric, text, jsonb, jsonb
) from public, anon;
grant execute on function public.admin_grade_attempt(
  uuid, numeric, numeric, numeric, numeric, text, jsonb, jsonb
) to authenticated;

-- ------------------------------------------------------------
-- 5) Sınav paketi: konuşma bölümleri dizisi + görseller
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

-- ------------------------------------------------------------
-- 6) B1 içeriği
-- ------------------------------------------------------------
update public.listening_items
set title = 'Diálogos cotidianos',
    audio_path = 'listening/b1-dialogos-cotidianos.mp3',
    max_plays = 2,
    position = 1,
    transcript = 'Diálogo 1 — HOMBRE: ¿La Plaza del Zócalo, por favor? MUJER: Lo siento, no soy de aquí.
Diálogo 2 — HOMBRE: ¡Uy! Tengo que avisar a Bruno sobre el cambio de dirección. MUJER: Pues envíale un correo electrónico.
Diálogo 3 — HOMBRE: Creo que el partido es en la segunda, ¿no? MUJER: ¿Sí? Pues cambia de canal.
Diálogo 4 — HOMBRE: Pues he hablado con Sandra y estamos pensando en instalar una alarma. MUJER: Sí, yo también estoy preocupada por los robos que ha habido en el barrio.
Diálogo 5 — HOMBRE: ¿Sabes hasta qué hora están abiertos los bancos? MUJER: Creo que cierran a las dos o dos y media.
Diálogo 6 — HOMBRE: En el periódico de hoy dicen que el túnel de la Gloriosa va a estar cortado a partir de mañana. MUJER: Sí, claro, por las obras del metro.
Diálogo 7 — HOMBRE: Pues no estoy muy seguro, pero creo que el 5 pasa cerca de la escuela. MUJER: Pero es más rápido el metro.
Diálogo 8 — HOMBRE: ¡Qué ganas tengo de que acaben la nueva estación de autobuses! MUJER: Sí, el ruido es insoportable.
Diálogo 9 — HOMBRE: ¿Tú crees que puedo aparcar aquí? MUJER: No creo, mira esa señal.
Diálogo 10 — HOMBRE: ¿No hemos pasado ya por aquí? Me parece que nos hemos perdido. MUJER: Vamos a preguntarle a ese policía.'
where id = '33333333-3333-3333-3333-333333333333';

delete from public.listening_questions
where item_id = '33333333-3333-3333-3333-333333333333';

insert into public.listening_questions
  (item_id, prompt, options, correct_index, position)
values
  ('33333333-3333-3333-3333-333333333333',
   '¿La Plaza del Zócalo, por favor?',
   '["Lo siento, no soy de aquí.","Es muy grande y bonita.","En el número 4."]'::jsonb, 0, 1),
  ('33333333-3333-3333-3333-333333333333',
   '¡Uy! Tengo que avisar a Bruno sobre el cambio de dirección.',
   '["Vale, se lo diré.","Pues envíale un correo electrónico.","Sí, sí, tenemos que cambiar ya."]'::jsonb, 1, 2),
  ('33333333-3333-3333-3333-333333333333',
   'Creo que el partido es en la segunda, ¿no?',
   '["Pues yo creo que este programa es muy interesante.","¿Sí? Pues cambia de canal.","Sí, cada vez hay más telebasura."]'::jsonb, 1, 3),
  ('33333333-3333-3333-3333-333333333333',
   'Pues he hablado con Sandra y estamos pensando en instalar una alarma.',
   '["El despertador está en la mesilla.","He visto unos muy modernos en un catálogo.","Sí, yo también estoy preocupada por los robos que ha habido en el barrio."]'::jsonb, 2, 4),
  ('33333333-3333-3333-3333-333333333333',
   '¿Sabes hasta qué hora están abiertos los bancos?',
   '["Creo que cierran a las dos o dos y media.","Abren a las ocho y media.","De ocho y media a dos."]'::jsonb, 0, 5),
  ('33333333-3333-3333-3333-333333333333',
   'En el periódico de hoy dicen que el túnel de la Gloriosa va a estar cortado a partir de mañana.',
   '["Mañana tengo una cita en el dentista.","Sí, claro, por las obras del metro.","¡Qué bien!"]'::jsonb, 1, 6),
  ('33333333-3333-3333-3333-333333333333',
   'Pues no estoy muy seguro, pero creo que el 5 pasa cerca de la escuela.',
   '["Pero es más rápido el metro.","A las 5 no puedo.","No, salgo a las seis."]'::jsonb, 0, 7),
  ('33333333-3333-3333-3333-333333333333',
   '¡Qué ganas tengo de que acaben la nueva estación de autobuses!',
   '["Pues a mí me apetece un café.","Salen a las tres.","Sí, el ruido es insoportable."]'::jsonb, 2, 8),
  ('33333333-3333-3333-3333-333333333333',
   '¿Tú crees que puedo aparcar aquí?',
   '["Pues la hora cuesta 1,45 euros.","No creo, mira esa señal.","Todas las casas tienen garaje."]'::jsonb, 1, 9),
  ('33333333-3333-3333-3333-333333333333',
   '¿No hemos pasado ya por aquí? Me parece que nos hemos perdido.',
   '["Vamos a preguntarle a ese policía.","Las llaves las tengo yo.","No te preocupes, mañana la ponen otra vez."]'::jsonb, 0, 10);

update public.writing_prompts
set prompt = 'Has recibido este correo electrónico de tu amigo Andrés:

«Hola, ¿qué tal? Te escribo porque el otro día me pediste ayuda para preparar la fiesta de aniversario de Luis. Tenemos que preparar una gran fiesta, pero es muy importante que Luis no sepa nada. Quiero que me expliques en qué tipo de fiesta habías pensado, así puedo empezar a ver qué podemos hacer. ¿Quieres venir este fin de semana a cenar a mi casa un día y concretamos los detalles? Ya me dirás algo. Hasta pronto, Andrés»

Escribe un correo electrónico a Andrés en el que deberás:
- saludar;
- explicar qué personas quieres que asistan a la fiesta;
- decir qué tipo de celebración habías pensado (lugar, música, comida…);
- hablar sobre el regalo que habías pensado comprar;
- despedirte.

Número de palabras: entre 100 y 120.',
    min_words = 100,
    part = 1,
    position = 1,
    image_path = 'prompts/b1-writing-1.jpg'
where id = 'ef0e031f-bedf-49d7-bfcf-cdf807b34fab';

insert into public.writing_prompts
  (id, level, prompt, min_words, position, part, image_path)
values (
  'b1000000-0000-4000-8000-000000000012',
  'B1',
  'Lee el siguiente mensaje publicado en una revista de viajes:

«Viajamás presenta una nueva edición de su concurso “El viaje de mi vida”. Necesitamos la colaboración de nuestros lectores. Escribidnos contando cuál sería vuestro viaje ideal. Entre todos los correos recibidos sortearemos una vuelta al mundo para dos personas.»

Escribe un correo electrónico a la revista en el que expliques:
- qué países quieres visitar;
- con quién te gustaría viajar;
- qué actividades te gustaría realizar a lo largo del viaje.

Número de palabras: entre 130 y 150.',
  130,
  2,
  2,
  'prompts/b1-writing-2.jpg'
)
on conflict (id) do update
set prompt = excluded.prompt,
    min_words = excluded.min_words,
    position = excluded.position,
    part = excluded.part,
    image_path = excluded.image_path;

update public.speaking_prompts
set part = 1,
    prompt = 'Habla sobre el transporte público y el transporte privado.',
    guidance = 'Incluye información sobre: las ventajas e inconvenientes de ambos medios de transporte; tus medios de transporte favoritos; el uso de los medios de transporte en tu país.',
    prep_seconds = 60,
    max_seconds = 150,
    position = 1,
    image_path = null
where id = '95aa4740-7652-4410-9308-56e2b8951b76';

insert into public.speaking_prompts
  (id, level, prompt, guidance, prep_seconds, max_seconds, position, part, image_path)
values (
  'b1000000-0000-4000-8000-000000000021',
  'B1',
  'Describe con detalle lo que ves en la foto y lo que imaginas que está ocurriendo.',
  'El examinador te mostrará la fotografía. Habla durante unos dos minutos. Esta parte la evalúa el examinador en directo: no se sube ninguna grabación.',
  0,
  180,
  2,
  2,
  'prompts/b1-oral-2.jpg'
)
on conflict (id) do update
set prompt = excluded.prompt,
    guidance = excluded.guidance,
    prep_seconds = excluded.prep_seconds,
    max_seconds = excluded.max_seconds,
    position = excluded.position,
    part = excluded.part,
    image_path = excluded.image_path;

insert into public.exam_settings (level, duration_minutes)
values ('B1', 90)
on conflict (level) do nothing;
