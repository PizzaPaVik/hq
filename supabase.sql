-- HQ – kör hela detta skript EN gång i Supabase → SQL Editor → New query → Run.

create table if not exists public.items (
  id                text primary key,
  user_id           uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind              text not null,
  data              jsonb not null default '{}'::jsonb,
  deleted           boolean not null default false,
  client_updated_at bigint not null default 0,
  updated_at        timestamptz not null default now()
);

create index if not exists items_user_updated on public.items (user_id, updated_at);

-- Bara du kommer åt dina egna rader.
alter table public.items enable row level security;

drop policy if exists "egna rader" on public.items;
create policy "egna rader" on public.items
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Sätter serverns tidsstämpel och skyddar mot att en äldre ändring
-- (t.ex. från en enhet som varit offline) skriver över en nyare.
create or replace function public.items_touch() returns trigger
language plpgsql as $$
begin
  if tg_op = 'UPDATE' and new.client_updated_at < old.client_updated_at then
    return null;
  end if;
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists items_touch on public.items;
create trigger items_touch before insert or update on public.items
  for each row execute function public.items_touch();
