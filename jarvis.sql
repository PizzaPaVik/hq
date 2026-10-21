-- HQ + Jarvis – kör hela detta skript EN gång i Supabase → SQL Editor → New query → Run.
-- (supabase.sql måste ha körts först.)
--
-- Datorn (Jarvis) får en egen nyckel som bara kan:
--   1. skriva Jarvis-statusen som HQ visar under Butik → Jarvis
--   2. läsa de uppdrag du skickar från HQ och sätta deras status och svar
-- Nyckeln kommer inte åt något annat i HQ. Du skapar den i HQ → Inställningar → Jarvis.

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.jarvis_links (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  token_hash text not null,
  created_at timestamptz not null default now()
);
-- Inga policies: tabellen nås bara via funktionerna nedan.
alter table public.jarvis_links enable row level security;

-- Anropas från HQ när du är inloggad. Skapar (eller byter) datorns nyckel och visar den en gång.
create or replace function public.jarvis_link() returns text
language plpgsql security definer set search_path = public, extensions as $$
declare t text := encode(gen_random_bytes(24), 'hex');
begin
  if auth.uid() is null then raise exception 'Inte inloggad'; end if;
  insert into jarvis_links (user_id, token_hash) values (auth.uid(), encode(digest(t, 'sha256'), 'hex'))
  on conflict (user_id) do update set token_hash = excluded.token_hash, created_at = now();
  return t;
end $$;
revoke all on function public.jarvis_link() from public, anon;
grant execute on function public.jarvis_link() to authenticated;

-- Tar bort datorns nyckel (HQ → Inställningar → Koppla bort).
create or replace function public.jarvis_unlink() returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from jarvis_links where user_id = auth.uid();
end $$;
revoke all on function public.jarvis_unlink() from public, anon;
grant execute on function public.jarvis_unlink() to authenticated;

-- Anropas av datorn. p_status = Jarvis-statusen (eller null), p_done = [{id, status, svar, …}] för uppdrag
-- som datorn har tagit hand om. Svarar med de uppdrag som väntar (status "ny").
create or replace function public.jarvis_sync(p_token text, p_status jsonb, p_done jsonb default '[]'::jsonb) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  uid uuid;
  res jsonb;
  now_ms bigint := (extract(epoch from clock_timestamp()) * 1000)::bigint;
begin
  select user_id into uid from jarvis_links where token_hash = encode(digest(p_token, 'sha256'), 'hex');
  if uid is null then raise exception 'Okänd nyckel – koppla datorn igen i HQ'; end if;

  if p_status is not null then
    insert into items (id, user_id, kind, data, deleted, client_updated_at)
    values ('jarvis-status-' || uid, uid, 'jarvis', p_status, false, now_ms)
    on conflict (id) do update set data = excluded.data, deleted = false, client_updated_at = excluded.client_updated_at
      where items.user_id = uid;
  end if;

  update items i set data = i.data || d.patch, client_updated_at = now_ms
  from (select x ->> 'id' as id, x - 'id' as patch from jsonb_array_elements(coalesce(p_done, '[]'::jsonb)) x) d
  where i.id = d.id and i.user_id = uid and i.kind = 'jarvis-order';

  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'data', data) order by updated_at), '[]'::jsonb) into res
  from items
  where user_id = uid and kind = 'jarvis-order' and not deleted and coalesce(data ->> 'status', 'ny') = 'ny';
  return res;
end $$;
revoke all on function public.jarvis_sync(text, jsonb, jsonb) from public;
grant execute on function public.jarvis_sync(text, jsonb, jsonb) to anon, authenticated;
