-- ============================================================
--  Examen de Español — migration 12
--  Madde analizi
--
--  Her test sorusu için:
--    appearances     — sorunun kaç denemede yer aldığı
--    correct_count   — doğru cevaplanma sayısı
--    p_value         — doğru oranı (0–1)
--    discrimination  — üst %27 ile alt %27 arasındaki doğru
--                      oranı farkı (klasik D değeri)
--
--  Yalnızca değerlendirilmiş ve toplam puanı hesaplanmış denemeler
--  kullanılır. Fonksiyon yönetici oturumu ister; adaylar çağıramaz.
--  Idempotent: tekrar çalıştırmak güvenli.
-- ============================================================

create or replace function public.question_stats(p_level text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_level text := upper(trim(coalesce(p_level, '')));
  v_rows jsonb;
begin
  if not public.is_admin() then
    raise exception 'FORBIDDEN';
  end if;
  if v_level not in ('A1', 'A2', 'B1', 'B2', 'C1', 'C2') then
    raise exception 'INVALID_LEVEL';
  end if;

  with answered as (
    select a.id, a.mc_answers, public.attempt_total(a)::numeric as total
    from public.attempts a
    where a.status = 'graded'
      and a.level = v_level
      and a.mc_answers is not null
      and public.attempt_total(a) is not null
  ),
  pairs as (
    select
      q.id as question_id,
      q.correct_index,
      ans.total,
      case
        when (ans.mc_answers ->> q.id::text) ~ '^[0-9]+$'
          then (ans.mc_answers ->> q.id::text)::int
      end as chosen
    from public.questions q
    join answered ans on ans.mc_answers ? q.id::text
    where q.level = v_level
  ),
  per_question as (
    select
      question_id,
      count(*) as appearances,
      count(*) filter (where chosen = correct_index) as correct_count
    from pairs
    group by question_id
  ),
  ranked as (
    select
      question_id,
      chosen,
      correct_index,
      percent_rank() over (partition by question_id order by total desc) as pr
    from pairs
  ),
  discrimination as (
    select
      question_id,
      coalesce(
        (count(*) filter (where pr <= 0.27 and chosen = correct_index))::numeric
          / nullif(count(*) filter (where pr <= 0.27), 0),
        0
      )
      - coalesce(
        (count(*) filter (where pr >= 0.73 and chosen = correct_index))::numeric
          / nullif(count(*) filter (where pr >= 0.73), 0),
        0
      ) as d
    from ranked
    group by question_id
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'question_id', q.id,
        'prompt', q.prompt,
        'options', q.options,
        'correct_index', q.correct_index,
        'position', q.position,
        'appearances', coalesce(pq.appearances, 0),
        'correct_count', coalesce(pq.correct_count, 0),
        'p_value',
          case
            when coalesce(pq.appearances, 0) = 0 then null
            else round(pq.correct_count::numeric / pq.appearances, 3)
          end,
        'discrimination', round(coalesce(disc.d, 0), 3)
      )
      order by q.position, q.created_at
    ),
    '[]'::jsonb
  )
  into v_rows
  from public.questions q
  left join per_question pq on pq.question_id = q.id
  left join discrimination disc on disc.question_id = q.id
  where q.level = v_level;

  return v_rows;
end;
$$;

revoke all on function public.question_stats(text) from public;
grant execute on function public.question_stats(text) to authenticated;
