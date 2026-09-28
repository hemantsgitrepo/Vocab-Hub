-- Profile row per account: full name + mobile number, created automatically
-- for every new auth user regardless of sign-up method (email+password,
-- Google, GitHub, Azure, Apple, or email OTP). Mobile number is UNIQUE so
-- the same number can't be attached to two different accounts.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  mobile_number text unique,
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Defined here rather than assumed, so this migration stands on its own.
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row
  execute function public.set_updated_at();

-- Auto-creates the profile row the moment a new auth user is created, for
-- every sign-up method. full_name/mobile_number come from the signup
-- metadata (set client-side via `options.data` on supabase.auth.signUp);
-- OAuth/OTP signups won't have these, so those columns start null.
create or replace function public.handle_new_user()
returns trigger as $$
begin
  begin
    insert into public.profiles (id, full_name, mobile_number, email)
    values (
      new.id,
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'mobile_number',
      new.email
    );
  exception when unique_violation then
    -- Extremely rare race: the mobile number was taken by someone else in
    -- the split second between the client's availability check and this
    -- insert. Don't fail the whole signup over it -- create the profile
    -- without the mobile number rather than leaving the user half-created.
    insert into public.profiles (id, full_name, email)
    values (new.id, new.raw_user_meta_data->>'full_name', new.email)
    on conflict (id) do nothing;
  end;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Lets the client check "is this mobile number already registered?" BEFORE
-- calling signUp, so a duplicate shows a friendly error instead of a raw
-- database error. security definer + no direct table grant means this can
-- answer yes/no without ever exposing whose account has it.
create or replace function public.is_mobile_taken(p_mobile text)
returns boolean as $$
  select exists(select 1 from public.profiles where mobile_number = p_mobile);
$$ language sql security definer stable set search_path = public;

grant execute on function public.is_mobile_taken(text) to anon, authenticated;
