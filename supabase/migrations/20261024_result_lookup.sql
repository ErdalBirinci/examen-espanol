-- ============================================================
--  Examen de Español — migration 2
--  Aday sonuç sorgulama + dinleme transkripti
--  Idempotent: tekrar çalıştırmak güvenli.
-- ============================================================

-- ------------------------------------------------------------
-- 1) Dinleme metni (değerlendirici referansı)
-- ------------------------------------------------------------
alter table public.listening_items
  add column if not exists transcript text;

-- ------------------------------------------------------------
-- 2) Aday sonuç sorgulama
--    Referans kodu + e-posta birlikte doğrulanır; yalnızca
--    puan özeti döner, diğer adayların verisi açılmaz.
--    jsonb döner: tablo tipi uyuşmazlığı yaşanmaz.
-- ------------------------------------------------------------
drop function if exists public.get_attempt_result(text, text);

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
      a.mc_correct,
      a.mc_total,
      round(a.listening_score)::int as listening_score,
      round(a.writing_score)::int as writing_score,
      round(a.speaking_score)::int as speaking_score,
      case
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
    where a.email = v_email
      and a.id::text like v_code || '%'
    limit 1
  ) r;

  return v_row;
end;
$$;

revoke all on function public.lookup_attempt_result(text, text) from public;
grant execute on function public.lookup_attempt_result(text, text) to anon, authenticated;

create index if not exists attempts_email_idx on public.attempts (lower(email));
