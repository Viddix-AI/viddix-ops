-- Viddix Ops — adds the team enum + column on profiles, and updates the
-- handle_new_user() trigger so signups honour an optional team key from
-- the auth metadata. Without this, post-signup profile inserts would fail
-- against the profiles.team NOT NULL constraint added by this migration.

do $$ begin
  create type team as enum ('madrid', 'us');
exception when duplicate_object then null; end $$;

alter table public.profiles
  add column if not exists team team not null default 'madrid';

create index if not exists profiles_team_idx on public.profiles(team);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, email, team)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.email,
    coalesce((new.raw_user_meta_data->>'team')::team, 'madrid')
  )
  on conflict (id) do nothing;
  return new;
end $$;
