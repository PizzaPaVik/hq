-- Vencare City – live-ordrar. Kör hela detta skript EN gång i Supabase → SQL Editor → New query → Run.
-- Shopify skickar varje ny order till funktionen shopify-order, som sparar en rad här.
-- Bara belopp, antal varor och tid sparas – aldrig namn, adress eller e-post.

create table if not exists public.live_orders (
  id          text primary key,              -- Shopifys order-id (dubbletter ignoreras)
  user_id     uuid not null references auth.users(id) on delete cascade,
  total       numeric not null default 0,
  currency    text not null default 'SEK',
  items       integer not null default 0,
  test        boolean not null default false,
  created_at  timestamptz not null default now(),
  received_at timestamptz not null default now()
);

create index if not exists live_orders_user_created on public.live_orders (user_id, created_at desc);

-- Du kan bara läsa dina egna ordrar. Bara funktionen (med service-nyckeln) kan skriva.
alter table public.live_orders enable row level security;

drop policy if exists "egna ordrar" on public.live_orders;
create policy "egna ordrar" on public.live_orders
  for select
  using (auth.uid() = user_id);

-- Inställning för funktionen shopify-order: en egen nyckel som står i webhook-adressen (?k=…)
-- och vems ordrarna är. Ingen policy = bara funktionen (service-nyckeln) kan läsa den.
create table if not exists public.stad_inst (
  id      integer primary key default 1 check (id = 1),
  token   text not null default replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
  user_id uuid not null references auth.users(id) on delete cascade
);
alter table public.stad_inst enable row level security;

insert into public.stad_inst (user_id)
select coalesce(
  (select user_id from public.items where kind = 'jarvis' order by updated_at desc limit 1),
  (select id from auth.users order by created_at limit 1))
on conflict (id) do nothing;

-- Webhook-adressen till Shopify: https://DITT-PROJEKT.supabase.co/functions/v1/shopify-order?k=<token>
select token, user_id from public.stad_inst;
