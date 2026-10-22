-- ============================================================
--  Examen de Español — Supabase şeması
--  Supabase Dashboard → SQL Editor → bu dosyanın tamamını çalıştır.
--  Idempotent: tekrar çalıştırmak güvenli.
-- ============================================================

create extension if not exists pgcrypto;

-- ------------------------------------------------------------
-- 1) Admins
-- ------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text unique not null,
  display_name text,
  role text not null default 'admin' check (role in ('admin')),
  created_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  );
$$;

alter table public.profiles enable row level security;

drop policy if exists "profiles read own" on public.profiles;
create policy "profiles read own" on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_admin());

-- ------------------------------------------------------------
-- 2) Test soruları (50 çoktan seçmeli / seviye)
-- ------------------------------------------------------------
create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  level text not null check (level in ('A1','A2','B1','B2','C1','C2')),
  prompt text not null,
  options jsonb not null,
  correct_index smallint not null check (correct_index between 0 and 5),
  explanation text,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists questions_level_idx on public.questions (level, position);

alter table public.questions enable row level security;

drop policy if exists "questions admin all" on public.questions;
create policy "questions admin all" on public.questions
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Adaylar soruları cevapsız görür: doğru şık bu görünümde yok.
-- View sahibi (postgres) RLS'i atlar, anon yalnızca görünümü okur.
create or replace view public.questions_public
with (security_invoker = false) as
  select id, level, prompt, options, position
  from public.questions;

revoke all on public.questions_public from anon, authenticated;
grant select on public.questions_public to anon, authenticated;

-- ------------------------------------------------------------
-- 3) Dinleme bölümü
-- ------------------------------------------------------------
create table if not exists public.listening_items (
  id uuid primary key default gen_random_uuid(),
  level text not null check (level in ('A1','A2','B1','B2','C1','C2')),
  title text not null,
  audio_path text not null,
  max_plays integer not null default 2,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists listening_level_idx on public.listening_items (level, position);

alter table public.listening_items enable row level security;

drop policy if exists "listening admin all" on public.listening_items;
create policy "listening admin all" on public.listening_items
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "listening public read" on public.listening_items;
create policy "listening public read" on public.listening_items
  for select to anon, authenticated
  using (true);

-- ------------------------------------------------------------
-- 4) Yazma bölümü
-- ------------------------------------------------------------
create table if not exists public.writing_prompts (
  id uuid primary key default gen_random_uuid(),
  level text not null check (level in ('A1','A2','B1','B2','C1','C2')),
  prompt text not null,
  min_words integer not null default 80,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.writing_prompts enable row level security;

drop policy if exists "writing admin all" on public.writing_prompts;
create policy "writing admin all" on public.writing_prompts
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "writing public read" on public.writing_prompts;
create policy "writing public read" on public.writing_prompts
  for select to anon, authenticated
  using (true);

-- ------------------------------------------------------------
-- 5) Konuşma bölümü
-- ------------------------------------------------------------
create table if not exists public.speaking_prompts (
  id uuid primary key default gen_random_uuid(),
  level text not null check (level in ('A1','A2','B1','B2','C1','C2')),
  prompt text not null,
  guidance text,
  prep_seconds integer not null default 60,
  max_seconds integer not null default 120,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.speaking_prompts enable row level security;

drop policy if exists "speaking admin all" on public.speaking_prompts;
create policy "speaking admin all" on public.speaking_prompts
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "speaking public read" on public.speaking_prompts;
create policy "speaking public read" on public.speaking_prompts
  for select to anon, authenticated
  using (true);

-- ------------------------------------------------------------
-- 6) Aday sınav kayıtları
-- ------------------------------------------------------------
create table if not exists public.attempts (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text not null,
  level text not null check (level in ('A1','A2','B1','B2','C1','C2')),
  status text not null default 'submitted' check (status in ('submitted','graded')),
  mc_answers jsonb not null default '{}'::jsonb,
  mc_correct integer,
  mc_total integer,
  listening_answers jsonb not null default '{}'::jsonb,
  writing_text text,
  speaking_path text,
  speaking_duration integer,
  listening_score numeric,
  writing_score numeric,
  speaking_score numeric,
  admin_note text,
  created_at timestamptz not null default now(),
  submitted_at timestamptz not null default now()
);

create index if not exists attempts_created_idx on public.attempts (created_at desc);
create index if not exists attempts_level_idx on public.attempts (level);

-- Puanlama sunucuda yapılır: aday doğru cevapları göremez veya puanı değiştiremez.
create or replace function public.score_attempt()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  answers jsonb := coalesce(new.mc_answers, '{}'::jsonb);
begin
  select count(*) into new.mc_total
  from public.questions q
  where q.level = new.level;

  select count(*) into new.mc_correct
  from public.questions q
  where q.level = new.level
    and answers ? q.id::text
    and (answers ->> q.id::text) ~ '^[0-9]+$'
    and (answers ->> q.id::text)::int = q.correct_index;

  return new;
end;
$$;

drop trigger if exists attempts_score on public.attempts;
create trigger attempts_score
  before insert or update of mc_answers, level on public.attempts
  for each row execute function public.score_attempt();

alter table public.attempts enable row level security;

drop policy if exists "attempts public insert" on public.attempts;
create policy "attempts public insert" on public.attempts
  for insert to anon, authenticated
  with check (true);

drop policy if exists "attempts admin read" on public.attempts;
create policy "attempts admin read" on public.attempts
  for select to authenticated
  using (public.is_admin());

drop policy if exists "attempts admin update" on public.attempts;
create policy "attempts admin update" on public.attempts
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "attempts admin delete" on public.attempts;
create policy "attempts admin delete" on public.attempts
  for delete to authenticated
  using (public.is_admin());

-- ------------------------------------------------------------
-- 7) Storage kovaları
--    exam-media      → dinleme sesleri (herkese açık okuma)
--    exam-recordings → aday konuşma kayıtları (yalnızca admin, 50 MB)
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'exam-media', 'exam-media', true, 52428800,
  array['audio/mpeg','audio/mp3','audio/wav','audio/x-wav','audio/ogg','audio/mp4','audio/x-m4a','audio/aac','audio/webm']
)
on conflict (id) do update
  set public = true, file_size_limit = 52428800;

insert into storage.buckets (id, name, public, file_size_limit)
values ('exam-recordings', 'exam-recordings', false, 52428800)
on conflict (id) do update
  set public = false, file_size_limit = 52428800;

drop policy if exists "media public read" on storage.objects;
create policy "media public read" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'exam-media');

drop policy if exists "media admin write" on storage.objects;
create policy "media admin write" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'exam-media' and public.is_admin());

drop policy if exists "media admin update" on storage.objects;
create policy "media admin update" on storage.objects
  for update to authenticated
  using (bucket_id = 'exam-media' and public.is_admin());

drop policy if exists "media admin delete" on storage.objects;
create policy "media admin delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'exam-media' and public.is_admin());

drop policy if exists "recordings public upload" on storage.objects;
create policy "recordings public upload" on storage.objects
  for insert to anon, authenticated
  with check (bucket_id = 'exam-recordings');

drop policy if exists "recordings admin read" on storage.objects;
create policy "recordings admin read" on storage.objects
  for select to authenticated
  using (bucket_id = 'exam-recordings' and public.is_admin());

drop policy if exists "recordings admin delete" on storage.objects;
create policy "recordings admin delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'exam-recordings' and public.is_admin());

-- ============================================================
--  8) ADMIN HESABI (şifreyi bu dosyaya yazma)
--  Dashboard → Authentication → Users → "Add user"
--    email    : <kullanıcı_adı>@examen.local   (örn. yonetici@examen.local)
--    password : kendi belirlediğin güçlü şifre
--    (Auto Confirm User seçili olsun)
--  Panelde giriş yaparken kullanıcı adı olarak @ işaretinden önceki
--  kısmı yazarsın (örn. yonetici).
--  Ardından aşağıdaki bloğu e-postayı değiştirerek çalıştır:
-- ------------------------------------------------------------
-- insert into public.profiles (id, username, display_name, role)
-- select id, 'yonetici', 'Yönetici', 'admin'
-- from auth.users
-- where email = 'yonetici@examen.local'
-- on conflict (id) do update set username = excluded.username, role = 'admin';
