-- ============================================================
--  Examen de Español — migration 17
--  Sonuç sorgusu: konuşma bölüm puanları
--
--  Konuşma iki bölüme ayrıldı (20261107) ama herkese açık sonuç
--  sorgusu yalnızca toplam konuşma puanını döndürüyordu; aday
--  ekranında "Parte 1: —/10 · Parte 2: —/10" görünüyordu.
--  Bu migration lookup_attempt_result fonksiyonunu bölüm
--  puanlarını da döndürecek şekilde yeniler.
--  Idempotent: tekrar çalıştırmak güvenli.
-- ============================================================

create or replace function public.lookup_attempt_result(p_code text, p_email text)
returns jsonb
language plpgsql
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
      case when coalesce(s.results_visible, true) then a.speaking_part1_score else null end as speaking_part1_score,
      case when coalesce(s.results_visible, true) then a.speaking_part2_score else null end as speaking_part2_score,
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
