create table if not exists public.waitlist (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  city text,
  region text,
  consent boolean not null default false,
  source text,
  created_at timestamptz not null default now(),
  constraint waitlist_email_format check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  constraint waitlist_email_len check (char_length(email) <= 254),
  constraint waitlist_consent_true check (consent = true),
  constraint waitlist_city_len check (city is null or char_length(city) <= 40),
  constraint waitlist_region_len check (region is null or char_length(region) <= 40),
  constraint waitlist_source_len check (source is null or char_length(source) <= 40)
);
create unique index if not exists waitlist_email_lower_idx on public.waitlist (lower(email));
alter table public.waitlist enable row level security;
revoke all on public.waitlist from anon, authenticated;
drop policy if exists "waitlist_insert_anon" on public.waitlist;
create policy "waitlist_insert_anon" on public.waitlist for insert to anon with check (consent = true);
grant insert on public.waitlist to anon;

create table if not exists public.city_interest (
  id bigint generated always as identity primary key,
  city text not null check (char_length(city) <= 40),
  region text check (region is null or char_length(region) <= 40),
  source text check (source is null or char_length(source) <= 40),
  created_at timestamptz not null default now()
);
alter table public.city_interest enable row level security;
revoke all on public.city_interest from anon, authenticated;
drop policy if exists "city_interest_insert_anon" on public.city_interest;
create policy "city_interest_insert_anon" on public.city_interest for insert to anon with check (true);
grant insert on public.city_interest to anon;

create or replace view public.city_demand with (security_invoker = true) as
select coalesce(w.region, i.region, 'Altro') as region, coalesce(w.city, i.city) as city,
       coalesce(w.iscritti,0) as iscritti_con_email, coalesce(i.scelte,0) as scelte_totali
from (select region, city, count(*) iscritti from public.waitlist group by 1,2) w
full join (select region, city, count(*) scelte from public.city_interest group by 1,2) i
  on w.city = i.city
order by scelte_totali desc, iscritti_con_email desc;
revoke all on public.city_demand from anon, authenticated;