-- ============================================================
--  Examen de Español — migration 7
--  Doğrulanabilir sertifikalar
--  - Yalnızca değerlendirilmiş, sonuçları yayınlanmış ve 60/100
--    ve üzeri puan alan adaylara sertifika verilir.
--  - Sertifika kodu rastgele üretilir; public sayfada e-posta
--    gösterilmeden doğrulanabilir.
--  Idempotent: tekrar çalıştırmak güvenli.
-- ============================================================

alter table public.attempts
  add column if not exists certificate_code text;

alter table public.attempts
  add column if not exists certificate_issued_at timestamptz;

create unique index if not exists attempts_certificate_code_unique
  on public.attempts (certificate_code)
  where certificate_code is not null;

-- ------------------------------------------------------------
--  Aday: referans kodu + e-posta ile sertifika oluştur/getir
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
  v_total integer;
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

  if v_attempt.mc_total is null or v_attempt.mc_total <= 0
     or v_attempt.mc_correct is null
     or v_attempt.listening_score is null
     or v_attempt.writing_score is null
     or v_attempt.speaking_score is null then
    raise exception 'CERTIFICATE_NOT_READY';
  end if;

  v_total := round(
    (v_attempt.mc_correct::numeric / v_attempt.mc_total) * 40
    + v_attempt.listening_score * 0.2
    + v_attempt.writing_score * 0.2
    + v_attempt.speaking_score * 0.2
  )::int;

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
    'total_score', v_total,
    'submitted_at', v_attempt.submitted_at,
    'reference', upper(substr(v_attempt.id::text, 1, 8)),
    'issued_at', v_issued_at
  );
end;
$$;

revoke all on function public.issue_certificate(text, text) from public;
grant execute on function public.issue_certificate(text, text) to anon, authenticated;

-- ------------------------------------------------------------
--  Herkese açık doğrulama: yalnızca sertifika kodu ile
--  E-posta, cevaplar veya diğer aday bilgileri dönmez.
-- ------------------------------------------------------------
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
      round(
        (a.mc_correct::numeric / a.mc_total) * 40
        + a.listening_score * 0.2
        + a.writing_score * 0.2
        + a.speaking_score * 0.2
      )::int as total_score,
      a.submitted_at,
      upper(substr(a.id::text, 1, 8)) as reference,
      a.certificate_issued_at as issued_at
    from public.attempts a
    left join public.exam_assignments s on s.id = a.assignment_id
    where a.certificate_code = v_code
      and a.certificate_issued_at is not null
      and a.status = 'graded'
      and coalesce(s.results_visible, true)
      and a.mc_total > 0
      and a.listening_score is not null
      and a.writing_score is not null
      and a.speaking_score is not null
      and round(
        (a.mc_correct::numeric / a.mc_total) * 40
        + a.listening_score * 0.2
        + a.writing_score * 0.2
        + a.speaking_score * 0.2
      ) >= 60
    limit 1
  ) r;

  return v_row;
end;
$$;

revoke all on function public.get_certificate(text) from public;
grant execute on function public.get_certificate(text) to anon, authenticated;
