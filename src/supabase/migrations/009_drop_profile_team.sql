-- Drop the team segmentation entirely.
--
-- The CRM is a 3-person operation; team filters / badges / coloured rings
-- added friction without segmenting anything that mattered. Removing the
-- column + enum + trigger reference brings the schema back in line with the
-- TypeScript model (Profile no longer has a `team` field).

drop index if exists profiles_team_idx;

alter table public.profiles
  drop column if exists team;

drop type if exists team;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.email
  )
  on conflict (id) do nothing;
  return new;
end $$;
